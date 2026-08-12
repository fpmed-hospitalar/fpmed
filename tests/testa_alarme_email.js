// SUITE testa_alarme_email — O SILENCIO VIRA AVISO, E O AVISO NAO VIRA BARULHO.
//
// ══ A CICATRIZ ══════════════════════════════════════════════════════════════════════════════
// A Coleta PNCP falhou 12 vezes seguidas entre 07 e 10/08 e voltou sozinha ao verde. Ninguem
// soube. O sino (parte B) e o workflow (parte A) fecharam dois furos; sobrou o terceiro, que e
// o mais silencioso de todos:
//
//   >>> O `enviar-boletim` JA SE RECUSAVA a enviar com o indice atrasado, e a decisao escrita
//       era que a AUSENCIA do boletim seria lida como "algo esta errado".
//       MAS AUSENCIA NAO E MENSAGEM. Ninguem repara no e-mail que nao chegou — e nao reparar e
//       exatamente o que aconteceu durante quatro dias.
//
// Agora, no lugar do silencio, sai um aviso pros MESMOS assinantes que esperavam o boletim.
//
// ══ E A REGRA DE ALARME NAO FOI REESCRITA AQUI ══════════════════════════════════════════════
// O veredito sai do `fpmed_alarme_coleta.js`, o MESMO arquivo que o sino le, COLADO dentro da
// edge function pelo `deploy_edge.js` na hora de publicar (a diretiva `@inline`). Uma copia em
// TypeScript faria o sino dizer uma coisa e o e-mail dizer outra sobre o mesmo banco.
// >>> ESTA SUITE PROVA A COLAGEM DE VERDADE: ela roda o inliner e EXECUTA o que saiu num
//     escopo sem `window` e sem `module` (que e o que a funcao encontra no Deno). "O arquivo
//     tem a linha @inline" nao prova nada — prova quem executa.
//
//   node tests/testa_alarme_email.js
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const FN = fs.readFileSync(path.join(RAIZ, 'supabase', 'functions', 'enviar-boletim', 'index.ts'), 'utf8');
const { colaInlines } = require(path.join(RAIZ, 'tools', 'deploy_edge.js'));

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) { p++; console.log('  ok  ' + n); } else { f++; console.log('  FALHA  ' + n + (e != null ? '  -> ' + JSON.stringify(e) : '')); } };
console.log('SUITE testa_alarme_email — o silencio vira aviso, e o aviso nao vira barulho\n');

// ══ 1. A COLAGEM ACONTECE, E O QUE SAI FUNCIONA ═════════════════════════════════════════════
let COLADO = '';
{
  const antes = console.log; console.log = () => {};            // o inliner anuncia o que colou
  COLADO = colaInlines(FN, 'enviar-boletim/index.ts');
  console.log = antes;

  ok('*** 1. o deploy cola o motor do alarme dentro da funcao ***',
    /function avaliar\(linha, agora\)/.test(COLADO));
  ok('2. e nao sobra diretiva por colar (uma que sobrasse seria um motor que nao subiu)',
    !/^[ \t]*\/\/[ \t]*@inline[ \t]/m.test(COLADO));
  ok('3. o que foi colado vem marcado como gerado (ninguem edita o texto colado)',
    /COLADO PELO deploy_edge\.js/.test(COLADO) && /NAO EDITE AQUI/.test(COLADO));

  /* ══ O ASSERT QUE VALE POR TODOS OS OUTROS: EXECUTAR ══════════════════════════════════════
     O motor termina com `})(typeof window !== 'undefined' ? window : globalThis)`. No navegador
     ele se pendura no `window`; na suite, no `module.exports`. No Deno nao ha nenhum dos dois —
     e antes de 12/08 ele nao se pendurava em lugar NENHUM ali, ou seja, a funcao teria colado
     um motor inalcancavel e o alarme nunca sairia. Aqui o escopo e montado igual ao do Deno. */
  const motor = COLADO.split('// ── COLADO PELO')[1].split('// ── fim de')[0].replace(/^[^\n]*\n/, '');
  const caixa = { console: { log() {} } };                       // sem window, sem module
  vm.createContext(caixa);
  vm.runInContext(motor, caixa);
  const A = caixa.AlarmeColeta;
  ok('*** 4. o motor colado SE PENDURA no globalThis (e o que o Deno enxerga) ***', !!A, Object.keys(caixa));
  ok('5. e chega inteiro: avaliar, resumo e os dois limites com nome',
    !!A && typeof A.avaliar === 'function' && typeof A.resumo === 'function'
    && A.DIAS_INDICE_VELHO === 2 && A.HORAS_SEM_TENTAR === 12);
  const AGORA = new Date('2026-08-12T18:00:00Z');
  ok('*** 6. e DECIDE IGUAL ao sino: o estado real de 12/08 nao alarma ***',
    !!A && A.avaliar({ ultima_ok: null, ultimo_erro: 'esgotou as tentativas',
                       ultima_tentativa: '2026-08-12T15:56:00Z', ultimo_dia_ok: '2026-08-12' }, AGORA) === null);
  ok('7. ...e indice de 3 dias atras alarma tambem la dentro',
    !!A && (A.avaliar({ ultima_tentativa: '2026-08-12T15:56:00Z', ultimo_dia_ok: '2026-08-09' }, AGORA) || {}).nivel === 'grave');
}

// ══ 2. A ORDEM: COMPLIANCE ANTES DE TUDO ════════════════════════════════════════════════════
// >>> ALARME NAO E MOTIVO PRA FURAR A REGRA DO REMETENTE, e "urgente" e justamente a desculpa
//     com que regra de compliance cede (licao S5). A trava do dominio da GlobalMed recusa a
//     rodada INTEIRA, e ela roda antes de qualquer envio — inclusive o do alarme.
{
  const iTrava = FN.indexOf('if (proibido) return J({');
  const iAlarme = FN.indexOf('if (alarme && !body.forcar)');
  const iResend = FN.indexOf('https://api.resend.com/emails');
  ok('*** 8. a trava de remetente roda ANTES do bloco do alarme ***',
    iTrava > 0 && iAlarme > iTrava, [iTrava, iAlarme]);
  ok('*** 9. ...e antes de QUALQUER chamada ao provedor de e-mail ***',
    iTrava > 0 && iResend > iTrava, [iTrava, iResend]);
}

// ══ 3. O ALARME SAI NO LUGAR DO BOLETIM, PRA QUEM ESPERAVA O BOLETIM ════════════════════════
{
  ok('*** 10. o alarme e avaliado pelo motor colado, nao por regra escrita na funcao ***',
    /ALARME\.avaliar\(statusColeta, new Date\(\)\)/.test(FN)
    && !/ultimo_dia_ok[\s\S]{0,80}>=?\s*2\b/.test(FN.split('Deno.serve')[1] || ''));
  ok('11. a funcao le a LINHA INTEIRA da coleta_status (so o carimbo do dia nao pega o pior caso)',
    /coleta_status\?fonte=eq\.PNCP&select=\*/.test(FN));
  ok('*** 12. o destinatario e o assinante do boletim — nao um canal novo ***',
    /jornais[\s\S]{0,120}email_destino \|\| donos\.get\(j\.usuario\)/.test(FN.split('if (alarme')[1] || ''));
  ok('13. e um destino por pessoa: dois jornais do mesmo dono nao viram dois e-mails iguais',
    /new Set\(jornais/.test(FN));
  ok('*** 14. o e-mail diz POR QUE o boletim nao veio (senao ele e so mais um alarme solto) ***',
    /Por isso o boletim de \$\{esc\(dm\(dia\)\)\} n[aã]o foi enviado/.test(FN));
  ok('15. ...e diz o que conferir, na ordem, em vez de so anunciar a falha',
    /COLETA_TOKEN/.test(FN) && /coletar-licitacoes/.test(FN) && /Actions/.test(FN));
  // ancora SEM ACENTO de proposito: um dia alguem reescreve o comentario acentuado logo abaixo
  // do bloco e este assert quebraria por motivo que nao tem nada a ver com a promessa dele.
  ok('16. o alarme NAO marca vistos_email (nada foi contado sobre licitacao nenhuma)',
    !/vistos_email/.test(FN.split('if (alarme && !body.forcar)')[1].split('if (!body.forcar && (!ultimoDiaOk')[0]));
}

// ══ 4. E O AVISO NAO VIRA O BARULHO QUE ELE EXISTE PRA EVITAR ═══════════════════════════════
// A funcao roda 2x por dia (cron 08:17 + rede 11:23). Sem trava, um indice atrasado renderia
// dois e-mails identicos toda manha — e dois e-mails iguais ensinam a ignorar os dois.
{
  ok('*** 17. ha trava de repeticao por tempo, e ela e de 20h ***',
    /HORAS_ENTRE_AVISOS = 20/.test(FN));
  ok('18. a trava le o carimbo do banco, e nao memoria da funcao (que morre a cada chamada)',
    /statusColeta\?\.alarme_email_em/.test(FN));
  ok('*** 19. o carimbo so e gravado SE ALGUEM FOI AVISADO ***',
    /if \(avisados\) \{[\s\S]{0,320}alarme_email_em/.test(FN));
  ok('20. ...e sem RESEND_API_KEY nada e enviado E nada e carimbado',
    /if \(!RESEND\) return J\(\{ \.\.\.base[\s\S]{0,220}NADA foi carimbado/.test(FN));
  ok('21. o intervalo entre avisos e menor que um dia (24h pularia o dia seguinte por atraso do cron)',
    (FN.match(/HORAS_ENTRE_AVISOS = (\d+)/) || [])[1] < 24);
}

// ══ 5. SEM MOTOR, ELE DIZ QUE ESTA SEM MOTOR ════════════════════════════════════════════════
// Deploy feito por outro caminho (sem a diretiva) subiria a funcao SEM o alarme. Se ela seguisse
// calada, o dono continuaria confiando num aviso que deixou de existir — que e a cicatriz de
// novo, agora com a nossa assinatura.
{
  ok('*** 22. a sonda `conferir` denuncia motor ausente ***',
    /motor_alarme: !!ALARME/.test(FN) && /MOTOR AUSENTE/.test(FN));
  ok('23. e a sonda responde o veredito de agora SEM enviar e-mail (provar sem efeito)',
    /body\.conferir === true/.test(FN) && /alarme_resumo: ALARME \? ALARME\.resumo\(v\)/.test(FN)
    && FN.indexOf('body.conferir === true') < FN.indexOf('https://api.resend.com/emails'));
  ok('24. a funcao nao estoura sem motor: ela testa antes de chamar',
    /ALARME \? ALARME\.avaliar\(/.test(FN) && /const ALARME: any = \(globalThis as any\)\.AlarmeColeta \|\| null/.test(FN));
}

// ══ 6. O QUE NAO PODE TER REGREDIDO ═════════════════════════════════════════════════════════
// A recusa de enviar boletim com indice atrasado e ANTERIOR ao alarme e continua valendo pro
// unico dia de tolerancia (1 dia de atraso nao alarma, mas tambem nao rende boletim honesto).
{
  ok('*** 25. a recusa de boletim com indice atrasado continua de pe ***',
    /boletim NAO enviado de proposito/.test(FN));
  ok('26. o `forcar` continua furando as duas (e a saida de emergencia de quem opera)',
    /if \(alarme && !body\.forcar\)/.test(FN) && /if \(!body\.forcar && \(!ultimoDiaOk/.test(FN));
  ok('27. a regra "nada novo nao vira e-mail" segue viva',
    /if \(!novas\.length && !sessoes\.length\)/.test(FN));
  ok('28. e o bloco de sessoes do dia continua mandando o boletim sair',
    /sessoes\.length/.test(FN) && /HOJE tem sess/.test(FN));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
