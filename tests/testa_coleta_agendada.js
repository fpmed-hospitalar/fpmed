// SUITE testa_coleta_agendada — A COLETA TEM QUE SE VIRAR SOZINHA, 3x POR DIA.
//
// O item 10 so fecha quando ninguem precisa rodar script no notebook: edge function que grava
// + agendamento. Esta suite protege as duas coisas que a rodada de 06/08 descobriu COM A FONTE
// REAL na frente, e que nenhum teste de caminho feliz pegaria:
//
//   1. **429 NAO E QUEDA.** A 1a coleta que de fato conversou com o PNCP gravou 70 licitacoes e
//      levou HTTP 429. A fonte estava SAUDAVEL -- so pediu pra desacelerar. Como o codigo
//      tratava 429 igual a queda, o CIRCUIT BREAKER MATOU A RODADA COM A API NO AR.
//      A correcao nao e retentar melhor, e ANDAR MAIS DEVAGAR.
//
//   2. **A CHAVE-MESTRA NAO PODE ENTRAR NO CI.** O repo e PUBLICO e a service_role ignora toda
//      a RLS. Quem grava e a edge function; o pipeline so conhece um segredo dedicado.
//
//   node tests/testa_coleta_agendada.js
const fs = require('fs');
const path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

const { criaRitmo, esperaRateLimit, criaBreaker, PAUSA_MS, PAUSA_TETO_MS, TETO_RATE_LIMIT,
        FALHAS_ATE_ABRIR } = require('../tools/coleta_pncp.js');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_coleta_agendada — coleta desassistida e o 429\n');

const LOCAL = R('tools', 'coleta_pncp.js');
const EDGE  = R('supabase', 'functions', 'coletar-licitacoes', 'index.ts');
const YML   = R('.github', 'workflows', 'coleta-pncp.yml');
const DEP   = R('tools', 'deploy_edge.js');

// ══════════ 1. A ESPERA DO 429 — o servidor sabe da propria cota melhor que nos ══════════
ok('1. *** sem Retry-After a espera do 429 comeca em 5s, nao em 1s como a queda ***',
  esperaRateLimit(0, null) === 5000, esperaRateLimit(0, null));
ok('2. ...e dobra a cada rate limit seguido', esperaRateLimit(1, null) === 10000 && esperaRateLimit(2, null) === 20000);
ok('3. com teto de 60s (rodada que espera 10 min nao vale mais que voltar depois)',
  esperaRateLimit(9, null) === 60000, esperaRateLimit(9, null));
ok('4. *** quando o PNCP manda Retry-After, ele MANDA ***', esperaRateLimit(0, '12') === 12000);
ok('5. ...mesmo que isso seja mais que a heuristica', esperaRateLimit(3, '7') === 7000);
ok('6. Retry-After absurdo continua limitado a 60s (nao pendura a rodada)',
  esperaRateLimit(0, '3600') === 60000);
ok('7. Retry-After vazio/HTTP-date cai na heuristica em vez de virar NaN',
  esperaRateLimit(0, 'Wed, 21 Oct 2026 07:28:00 GMT') === 5000 && esperaRateLimit(0, '') === 5000);
ok('8. Retry-After 0 nao vira "sem espera" (0 seria bater de novo na hora)',
  esperaRateLimit(0, '0') === 5000);

// ══════════ 2. O RITMO — o que EVITA o 429; retentar melhor so o remedia ══════════
{
  const r = criaRitmo();
  ok('9. nasce com a pausa base entre chamadas', r.pausa === PAUSA_MS && PAUSA_MS === 300, r.pausa);
  ok('10. *** cada 429 DOBRA a pausa da rodada inteira ***', r.freou() === 600 && r.freou() === 1200, r.pausa);
  ok('11. ...e nao volta a acelerar sozinho (acelerar so provoca o proximo 429)', r.pausa === 1200, r.pausa);
  for (let i = 0; i < 10; i++) r.freou();
  ok('12. a pausa tem teto de 8s', r.pausa === PAUSA_TETO_MS && PAUSA_TETO_MS === 8000, r.pausa);
}
{
  const r = criaRitmo();
  for (let i = 0; i < TETO_RATE_LIMIT; i++) r.freou();
  ok('13. ate o teto de rate limits a rodada continua', r.estourou === false, r.vezes);
  r.freou();
  ok('14. *** passou do teto, PARA (cota esgotada nao pode virar laco eterno) ***', r.estourou === true);
  ok('15. o teto e 20 por rodada', TETO_RATE_LIMIT === 20, TETO_RATE_LIMIT);
}
{
  // A separacao que e o coracao da correcao: o breaker conta QUEDA; o ritmo conta LENTIDAO.
  const b = criaBreaker(FALHAS_ATE_ABRIR), r = criaRitmo();
  for (let i = 0; i < 10; i++) r.freou();
  ok('16. *** 10 rate limits NAO abrem o circuit breaker (a API respondeu as 10 vezes) ***',
    b.aberto === false && b.seguidas === 0, [b.aberto, b.seguidas]);
}

// ══════════ 3. O 429 NO CODIGO — nos DOIS coletores ══════════
for (const [nome, src] of [['coletor local', LOCAL], ['edge function', EDGE]]) {
  ok(`17.${nome} — trata 429 antes de tratar como erro`, /if \(r\.status === 429\)/.test(src));
  ok(`18.${nome} — *** o 429 NAO conta como falha do breaker ***`,
    (src.match(/breaker\.falhou\(\)/g) || []).length === 1 && /catch[\s\S]{0,80}breaker\.falhou\(\)/.test(src));
  ok(`19.${nome} — o 429 desacelera e tenta de novo, sem gastar tentativa de queda`,
    /ritmo\.freou\(\)/.test(src) && /await dormir\(espera\);\s*\n\s*continue;/.test(src));
  ok(`20.${nome} — *** existe pausa ENTRE chamadas (o que de fato evita o 429) ***`,
    /await dormir\(ritmo\.pausa\)/.test(src));
  ok(`21.${nome} — e o motivo esta escrito no codigo`,
    /429 N[AÃ]O [EÉ] QUEDA/.test(src) && /ANDAR MAIS DEVAGAR/i.test(src));
  ok(`22.${nome} — rate limit persistente encerra a rodada com erro, nao em silencio`,
    /rate limit persistente do PNCP/.test(src));
}

// ══════════ 4. OS DOIS COLETORES NAO PODEM DIVERGIR ══════════
// Sao dois arquivos com a MESMA responsabilidade (um local, um no ar). No dia em que um for
// corrigido e o outro nao, a producao passa a se comportar diferente do que se testa na mao.
{
  const cte = (src, nome) => (src.match(new RegExp(nome + '\\s*=\\s*(\\d+)')) || [])[1];
  for (const c of ['PAUSA_MS', 'PAUSA_TETO_MS', 'TETO_RATE_LIMIT', 'FALHAS_ATE_ABRIR', 'TAM_PAGINA', 'TIMEOUT_MS']) {
    ok(`23.${c} igual nos dois coletores`, cte(LOCAL, c) === cte(EDGE, c) && cte(EDGE, c) !== undefined,
      [cte(LOCAL, c), cte(EDGE, c)]);
  }
  ok('24. a chave natural do upsert e a mesma nos dois',
    /on_conflict=portal,cnpj,ano,sequencial/.test(LOCAL) && /on_conflict=portal,cnpj,ano,sequencial/.test(EDGE));
  ok('25. a sobreposicao de 2 dias da janela incremental e a mesma',
    /setDate\(ini\.getDate\(\) - 2\)/.test(LOCAL) && /setDate\(ini\.getDate\(\) - 2\)/.test(EDGE));
}

// ══════════ 5. A PORTA DA EDGE FUNCTION ══════════
ok('26. *** sem COLETA_TOKEN configurado a funcao fica FECHADA, nao aberta ***',
  /if \(!TOKEN\) return J\(\{ error: "COLETA_TOKEN nao configurado/.test(EDGE));
ok('27. ...e o motivo esta escrito (e assim que endpoint de escrita vira publico por esquecimento)',
  /sem segredo,\s*\n?\s*\/\/\s*libera|"sem segredo, libera"/.test(EDGE));
ok('28. so aceita POST', /if \(req\.method !== "POST"\) return J\(\{ error: "use POST" \}, 405\)/.test(EDGE));
ok('29. *** token errado ou ausente = 401 ***',
  /req\.headers\.get\("x-coleta-token"\) !== TOKEN\) return J\(\{ error: "nao autorizado" \}, 401\)/.test(EDGE));
// (o YML FALA de service_role nos comentarios de propósito — o que ele nao pode e USAR uma:
//  nada de `secrets.*SERVICE*`, nada de JWT colado. Proibir a palavra apagaria a explicacao.)
ok('30. *** a service_role vem da PLATAFORMA, nunca do corpo nem do CI ***',
  /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/.test(EDGE)
  && !/secrets\.[A-Za-z_]*SERVICE/i.test(YML) && !/eyJ/.test(YML));
ok('31. o token do agendador NAO e a service_role, e isso esta dito',
  /segredo dedicado — NÃO é a service_role|NAO e a service_role|não é a `service_role`/i.test(EDGE + YML));
ok('32. *** a funcao NUNCA apaga (coleta que falha deixa a tela igual, nunca vazia) ***',
  !/method:\s*"DELETE"/.test(EDGE) && /NUNCA APAGA/.test(EDGE));
ok('33. *** o carimbo de frescor so avanca em rodada inteira e sem falha ***',
  /const okDeVerdade = !breaker\.aberto && !erro && !estourouTempo;/.test(EDGE)
  && /if \(okDeVerdade\) st\.ultima_ok/.test(EDGE));
ok('34. ...e o motivo (avancar numa rodada que falhou faria a tela mentir sobre a idade do dado)',
  /faria a tela mentir sobre a idade do dado/.test(EDGE));
ok('35. rodada parcial responde 200, senao o agendador reexecuta achando que a falha foi nossa',
  /200 mesmo em rodada parcial/.test(EDGE) && /ok: okDeVerdade/.test(EDGE));
ok('36. tem orcamento de tempo (edge function nao roda pra sempre)',
  /TETO_MS = \d+/.test(EDGE) && /estourouTempo = true/.test(EDGE));
ok('37. o verify_jwt=false esta declarado no config.toml, nao so no deploy',
  /\[functions\.coletar-licitacoes\]\s*\nverify_jwt = false/.test(R('supabase', 'config.toml')));

// ══════════ 6. O AGENDAMENTO ══════════
ok('38. *** roda 3x por dia ***', /cron: '0 9,15,21 \* \* \*'/.test(YML));
ok('39. ...em horario de expediente de Goias (UTC-3), nao de madrugada',
  /Goiás é UTC−3 → 06h, 12h e 18h/.test(YML));
ok('40. da pra rodar na mao sem esperar o cron', /workflow_dispatch:/.test(YML));
ok('41. *** o CI so conhece o segredo dedicado ***',
  /secrets\.COLETA_TOKEN/.test(YML) && !/SERVICE_ROLE|SUPABASE_SERVICE|eyJ[A-Za-z0-9]/.test(YML));
ok('42. o workflow nao escreve no repositorio', /permissions:\s*\n\s*contents: read/.test(YML));
ok('43. sem o secret, para com mensagem clara em vez de falhar sem explicacao',
  /::error::Falta o secret COLETA_TOKEN/.test(YML));
ok('44. *** HTTP != 200 e problema NOSSO -> job vermelho ***',
  /if \[ "\$HTTP" != "200" \]; then[\s\S]{0,120}exit 1/.test(YML));
ok('45. *** "o PNCP estava fora" vira AVISO, nao X vermelho ***',
  /::warning::Coleta parcial/.test(YML) && /treina qualquer um a ignorar o CI/.test(YML));
ok('46. duas coletas nao rodam sobrepostas (so fariam o PNCP nos limitar mais)',
  /concurrency:/.test(YML) && /cancel-in-progress: false/.test(YML));
ok('47. usa `if/fi` no lugar de `[ .. ] && ..` (com set -e um teste falso derrubaria o passo)',
  /if \[ -n "\$\{DIAS:-\}" \]; then/.test(YML) && !/\[ -n "\$\{DIAS:-\}" \] &&/.test(YML));

// ══════════ 7. O DEPLOY NAO PODE VAZAR SEGREDO ══════════
ok('48. o token de deploy sai do segredos.local.txt (gitignored), nao da linha de comando',
  /leSegredo\('SUPABASE_ACCESS_TOKEN'\)/.test(DEP) && /segredos\.local\.txt/.test(DEP));
ok('49. *** valor de secret so aparece como tamanho, nunca impresso ***',
  /\(len \$\{valor\.length\}\)/.test(DEP) && !/console\.log\(.{0,40}\bvalor\b\s*\)/.test(DEP));
ok('50. o gerador NAO sobrescreve um COLETA_TOKEN existente (rotacao e ato deliberado)',
  /nao vou sobrescrever/.test(DEP));
ok('51. o segredos.local.txt continua fora do git', /^segredos\.local\.txt$/m.test(R('.gitignore')));
ok('52. o smoke test confere a porta fechada, nao so o caminho feliz',
  /sem token   -> HTTP \$\{semToken\.status\}/.test(DEP) && /ESPERAVA 401/.test(DEP));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
