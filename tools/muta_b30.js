/* ══════════════════════════════════════════════════════════════════════════════════════════════
   muta_b30.js — APONTA A CATRACA DO SALDO PARA O MATERIAL DE VERDADE (20/08/2026)

   Mesma lei do `muta_b29.js`, e ela vem da B26: *"um detector provado só contra exemplos que eu
   mesmo escrevi herda o meu engano inteiro, e herda em silêncio, com relatório verde."* Aqui a
   `tests/testa_ata_saldo.js` é apontada para os arquivos REAIS da fatia, com o defeito plantado
   dentro deles, e cobrada de vermelho.

   ══ E ELA MEDE OS DOIS LADOS ════════════════════════════════════════════════════════════════
   `deveRuir: true` são defeitos — a catraca TEM de ficar vermelha. `deveRuir: false` são
   mudanças legítimas (prosa que nomeia o que a regra proíbe) — e a catraca TEM de deixar passar.
   Catraca que fica vermelha com as duas não protege nada; ela só ensina a apagar comentário.

   ══ O QUE ESTA FATIA TEM DE PARTICULAR ══════════════════════════════════════════════════════
   Quase toda mutação daqui produz **um número redondo e plausível** em vez de uma exceção. Não há
   pilha de erro, não há tela quebrada: há um "0" onde devia haver "não informado", e um "0" numa
   coluna de saldo é a frase *"esta ata acabou"* dita pela tela, sem que ninguém a tenha afirmado.
   É por isso que estas mutações precisam existir: **o defeito desta fatia tem a cara da resposta.**

     node tools/muta_b30.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ARQUIVOS = [
  'fpmed_ata_saldo.js', 'fpmed_negocios.html', 'sw.js', 'ddl/ata_saldo.sql',
  'tools/regua_visual.js', 'tests/testa_ata_saldo.js',
  // A régua do A lê o tema e a lista de telas adotadas no `require` — sem eles a cópia nem
  // carrega, e o controle acusaria "já está vermelha" sobre um erro de arquivo faltando.
  'fpmed_tema.css', 'tests/telas_adotadas.json',
];
const SUITE = 'testa_ata_saldo.js';
const MOTOR = 'fpmed_ata_saldo.js';
const NEG = 'fpmed_negocios.html';
const DDL = 'ddl/ata_saldo.sql';

const MUTACOES = [
  // ── as que TÊM de ficar vermelhas ────────────────────────────────────────────────────────
  /* O DEFEITO CENTRAL DA FATIA, e ele é o atalho que qualquer um escreveria: "ninguém empenhou
     ainda, então o saldo é a quantidade inteira". É uma AFIRMAÇÃO sobre o comportamento do órgão
     que ninguém verificou — e ela enche a agenda de faturamento de dinheiro que não existe. */
  { nome: 'sem empenho informado, o saldo passa a ser a quantidade INTEIRA', deveRuir: true, arq: MOTOR,
    de: /var saldo = \(qtd != null && emp != null\) \? qtd - emp : null;/,
    para: 'var saldo = (qtd != null) ? qtd - (emp || 0) : null;' },
  { nome: '"a entregar" passa a tratar entrega desconhecida como zero', deveRuir: true, arq: MOTOR,
    de: /var aEntregar = \(emp != null && ent != null\) \? emp - ent : null;/,
    para: 'var aEntregar = (emp != null) ? emp - (ent || 0) : null;' },
  { nome: 'o saldo em dinheiro vira R$ 0,00 quando nao ha preco', deveRuir: true, arq: MOTOR,
    de: /saldoValor: \(saldo != null && unit != null\) \? saldo \* unit : null,/,
    para: 'saldoValor: (saldo != null && unit != null) ? saldo * unit : 0,' },
  { nome: 'o saldo aparece mesmo sem quantidade registrada (subtrai do que nao existe)', deveRuir: true, arq: MOTOR,
    de: /\(qtd != null && emp != null\)/, para: '(emp != null)' },
  /* O TOTAL QUE SOMA O DESCONHECIDO COMO ZERO. Ele fecha, parece completo, e está errado para
     baixo — e some com o `comSaldo`, que é o que deixa a tela distinguir "somou zero" de "não
     havia o que somar". */
  { nome: 'o total soma o desconhecido como zero e perde a conta de quem entrou', deveRuir: true, arq: MOTOR,
    de: /if \(l\.saldo != null\) \{ t\.saldo \+= l\.saldo; t\.comSaldo\+\+; \}/,
    para: 't.saldo += (l.saldo || 0);' },
  { nome: 'linha informada mas com empenho nulo deixa de contar como "sem informacao"', deveRuir: true, arq: MOTOR,
    de: /if \(!l\.informado \|\| l\.empenhado == null\) \{ t\.semInfo\+\+; \}/,
    para: 'if (!l.informado) { t.semInfo++; }' },
  /* O `Math.round` É QUEM ABSORVE O FUSO — medido, e corrigindo a prosa que este arquivo tinha.
     Com `Math.floor` todo prazo sai truncado para baixo, calado. */
  { nome: 'a conta de dias passa a arredondar PARA BAIXO', deveRuir: true, arq: MOTOR,
    de: /var dias = Math\.round\(/, para: 'var dias = Math.floor(' },
  { nome: 'a ata que vence HOJE passa a sair como vencida', deveRuir: true, arq: MOTOR,
    de: /dias < 0 \? 'vencida'/, para: "dias <= 0 ? 'vencida'" },
  { nome: 'o corte de "vencendo" cai para 30 (o do cofre de certidoes)', deveRuir: true, arq: MOTOR,
    de: /dias <= 60 \? 'vencendo'/, para: "dias <= 30 ? 'vencendo'" },
  { nome: 'data em branco passa a valer como "vigente" (a ata que nao vence)', deveRuir: true, arq: MOTOR,
    de: /return \{ situacao: 'sem_vigencia', dias: null \};/,
    para: "return { situacao: 'vigente', dias: null };" },
  { nome: '*** as atas SEM vigencia vao pro TOPO da lista ***', deveRuir: true, arq: MOTOR,
    de: /if \(!fa\) return 1;\n      if \(!fb\) return -1;/,
    para: 'if (!fa) return -1;\n      if (!fb) return 1;' },
  { nome: 'a entrega maior que o empenho deixa de virar alerta', deveRuir: true, arq: MOTOR,
    de: /if \(emp != null && ent != null && ent > emp\)\n        alertas\.push\('entregue maior que o empenhado'\);/,
    para: '' },
  { nome: 'a linha incoerente passa a ser RECUSADA em vez de mostrada', deveRuir: true, arq: MOTOR,
    de: /var alertas = \[\];/, para: 'var alertas = [];\n      if (qtd != null && emp != null && emp > qtd) return null;' },

  // ── a tela ────────────────────────────────────────────────────────────────────────────────
  { nome: 'o Negocios deixa de carregar o motor do saldo', deveRuir: true, arq: NEG,
    de: /<script src="fpmed_ata_saldo\.js"><\/script>/, para: '' },
  /* O CAMPO QUE DIGITA PELO USUÁRIO. Um `value="0"` num campo vazio grava, com o nome de quem
     abriu a ficha, a única afirmação que esta fatia inteira existe para não fazer. */
  { nome: '*** o campo de empenho nasce com ZERO em vez de vazio ***', deveRuir: true, arq: NEG,
    de: /== null \? '' : l\[qual === 'emp' \? 'empenhado' : 'entregue'\]\) \+ '">'/,
    para: "== null ? '0' : l[qual === 'emp' ? 'empenhado' : 'entregue']) + '\">'" },
  { nome: '*** o total imprime 0 quando nenhuma linha entrou nele ***', deveRuir: true, arq: NEG,
    de: /\(t\.comSaldo === 0 \? '<span class="sd-nao">não informado<\/span>'\n        : nb\(t\.saldo\)/,
    para: '(false ? \'\'\n        : nb(t.saldo)' },
  { nome: 'a coluna sem dado passa a mostrar travessao em vez de "nao informado"', deveRuir: true, arq: NEG,
    de: /const naoInf = '<span class="sd-nao">não informado<\/span>';/,
    para: "const naoInf = '—';" },
  { nome: 'o erro de leitura do saldo passa a se parecer com "nao informado"', deveRuir: true, arq: NEG,
    de: /'Não consegui ler o saldo<\/b>'/, para: "'Saldo não informado</b>'" },
  { nome: 'a ata sem itens deixa de dizer que nao e saldo zero', deveRuir: true, arq: NEG,
    de: /Esta ata ainda não tem itens lidos/, para: 'Saldo desta ata: 0' },
  { nome: 'a validade em branco passa a prometer que a ata nao vence', deveRuir: true, arq: NEG,
    de: /não<\/b> quer dizer que ela não vença/, para: 'ata sem prazo' },
  { nome: '*** a tela grava o saldo digitado como se fosse publicado pelo PNCP ***', deveRuir: true, arq: NEG,
    de: /origem: 'informado', informado_por: quem/, para: "origem: 'pncp', informado_por: quem" },
  { nome: 'a gravacao sobe TODAS as linhas, mudadas ou nao', deveRuir: true, arq: NEG,
    de: /if\(emp === l\.empenhado && ent === l\.entregue\) return;\s*\/\/ não mudou/, para: '' },
  { nome: 'linha em branco que nunca existiu passa a ser gravada', deveRuir: true, arq: NEG,
    de: /if\(emp === null && ent === null && !l\.informado\) return;/, para: '' },
  { nome: 'o upsert perde a chave e a segunda informacao do item vira 409', deveRuir: true, arq: NEG,
    de: /\?on_conflict=negocio_id,item_n/, para: '' },
  { nome: 'o `atualizado_em` volta a depender do default do banco (que so vale no insert)', deveRuir: true, arq: NEG,
    de: /atualizado_em: agora \}\);/, para: '});' },
  { nome: 'a tela passa a contar os dias por conta propria', deveRuir: true, arq: NEG,
    de: /const v = M\.vigencia\(n\.ata_vigencia_fim, M\.hojeISO\(\)\);/,
    para: 'const v = { dias: Math.round((new Date(n.ata_vigencia_fim) - Date.now())/86400000), situacao: "vigente" };' },
  { nome: 'a tabela do saldo passa a montar as linhas por conta propria', deveRuir: true, arq: NEG,
    de: /const ls = M\.linhas\(itens, ATA_SALDOS\);/,
    para: 'const ls = itens.map(x => ({ item: x.item, saldo: x.quantidade, alertas: [] }));' },
  { nome: 'a ordem "ata vencendo primeiro" vira uma copia da comparacao', deveRuir: true, arq: NEG,
    de: /if\(ord === 'ata_vence' && window\.FPMED_ATA_SALDO\) return FPMED_ATA_SALDO\.ordenaPorVencimento\(l\);/,
    para: "if(ord === 'ata_vence') return l.sort((a,b) => String(a.ata_vigencia_fim||'').localeCompare(String(b.ata_vigencia_fim||'')));" },
  /* A CORRIDA DAS DUAS LEITURAS. Esta é a mutação cujo sintoma NÃO se reproduz: a tabela do saldo
     aparece ou não conforme qual `fetch` voltar primeiro. */
  { nome: '*** o saldo para de repintar quando a lista de itens chega ***', deveRuir: true, arq: NEG,
    de: /\n  pintaSaldoAta\(id\);\n/, para: '\n' },

  // ── a casca ───────────────────────────────────────────────────────────────────────────────
  { nome: 'o motor sai da casca do service worker', deveRuir: true, arq: 'sw.js',
    de: /\n\s*'\.\/fpmed_ata_saldo\.js',[^\n]*\n/, para: '\n' },
  /* O PADRÃO É GENÉRICO DE PROPÓSITO. Fixar o número exato faz a mutação parar de casar no dia do
     próximo bump — e mutação que não casa não fica vermelha: ela se declara "escapada" e o placar
     acusa um buraco que não existe. Foi o que aconteceu com a `muta_b29.js` quando esta fatia
     subiu a casca de -87 para -88. */
  { nome: 'a casca ganha arquivo novo mas ninguem bumpa a versao', deveRuir: true, arq: 'sw.js',
    de: /limedtec-fpmed-\d{4}-\d{2}-\d{2}-\d+/, para: 'limedtec-fpmed-2026-08-20-87' },

  // ── o banco ───────────────────────────────────────────────────────────────────────────────
  { nome: '*** `empenhado` nasce NOT NULL DEFAULT 0 (toda ata nova diz "ninguem empenhou") ***',
    deveRuir: true, arq: DDL,
    de: /empenhado     numeric check \(empenhado >= 0\),/,
    para: 'empenhado     numeric not null default 0,' },
  { nome: 'some a unicidade por item (dois saldos, e a escolha vira sorteio)', deveRuir: true, arq: DDL,
    de: /constraint ata_saldo_item_unico unique \(negocio_id, item_n\)/,
    para: 'constraint ata_saldo_item_solto check (true)' },
  { nome: 'a chave do item vira numero de um lado so ("07" e "7" viram itens diferentes)', deveRuir: true, arq: DDL,
    de: /item_n        text not null,/, para: 'item_n        numeric not null,' },
  { nome: 'aparece uma policy de DELETE (saldo informado apagado sem rastro)', deveRuir: true, arq: DDL,
    de: /revoke all on public\.ata_saldo from anon;/,
    para: 'create policy ata_saldo_del on public.ata_saldo for delete to authenticated using (true);\nrevoke all on public.ata_saldo from anon;' },
  { nome: 'o anon passa a enxergar o saldo', deveRuir: true, arq: DDL,
    de: /revoke all on public\.ata_saldo from anon;/, para: '' },
  { nome: 'a view deixa de respeitar o cracha de quem pergunta', deveRuir: true, arq: DDL,
    de: /\n  with \(security_invoker = on\) as/, para: ' as' },
  { nome: '*** as sem vigencia sobem pro topo da view ***', deveRuir: true, arq: DDL,
    de: /nulls last/, para: 'nulls first' },
  { nome: 'a origem perde o CHECK e digitado se mistura com publicado', deveRuir: true, arq: DDL,
    de: /check \(origem in \('informado','pncp'\)\)/, para: '' },
  { nome: 'o saldo passa a aceitar numero negativo', deveRuir: true, arq: DDL,
    de: /empenhado     numeric check \(empenhado >= 0\),/, para: 'empenhado     numeric,' },

  // ── as que NÃO podem ficar vermelhas ─────────────────────────────────────────────────────
  /* A prosa desta casa NOMEIA o que a regra proíbe — é a única maneira de um comentário ensinar
     uma regra. Se a catraca cobrar do comentário, o conserto vira "apagar a explicação", e
     explicação apagada é a causa da próxima geração do mesmo defeito. Esta metade do controle
     já pegou o autor uma vez, na B29, no arquivo em que a explicação era mais longa que a regra. */
  { nome: 'um comentario explica por que o saldo nao e `qtd - (emp || 0)`', deveRuir: false, arq: MOTOR,
    de: /function linhas\(itens, saldos\) \{/,
    para: '/* nunca qtd - (emp || 0): "posso entregar tudo" e uma afirmacao sobre o orgao */\n  function linhas(itens, saldos) {' },
  { nome: 'um comentario cita o Math.floor como o erro a evitar', deveRuir: false, arq: MOTOR,
    de: /function hojeISO\(d\) \{/,
    para: '/* Math.floor aqui trunca todo prazo pra baixo, calado */\n  function hojeISO(d) {' },
  { nome: 'a tela ganha comentario citando value="0" como proibido', deveRuir: false, arq: NEG,
    de: /function pintaSaldoAta\(id\)\{/,
    para: '/* aqui nunca sai value="0" nem R$ 0,00 no lugar de "nao informado" */\nfunction pintaSaldoAta(id){' },
  { nome: 'o DDL ganha comentario explicando por que nao ha "for delete"', deveRuir: false, arq: DDL,
    de: /-- ── RLS ─/,
    para: '-- nao existe policy "for delete" aqui, e o motivo esta abaixo\n-- ── RLS ─' },
  { nome: 'o DDL ganha comentario citando "not null default 0" como o erro', deveRuir: false, arq: DDL,
    de: /create index if not exists ata_saldo_negocio_idx/,
    para: '-- jamais "empenhado numeric not null default 0": zero e uma afirmacao\ncreate index if not exists ata_saldo_negocio_idx' },
];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'muta-b30-'));
function semeia() {
  for (const rel of ARQUIVOS) {
    const dest = path.join(TMP, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, rel), dest);
  }
}
function roda() {
  try { execFileSync(process.execPath, [path.join(TMP, 'tests', SUITE)], { stdio: 'pipe', encoding: 'utf8' }); return { verde: true, saida: '' }; }
  catch (e) { return { verde: false, saida: String((e.stdout || '') + (e.stderr || '')) }; }
}

console.log('=== MUTACAO DA FATIA B30 — a catraca do saldo contra o material de verdade ===\n');
semeia();
const ctrl = roda();
console.log(`  controle · ${SUITE} ${ctrl.verde ? 'VERDE' : '*** JA ESTA VERMELHA ***'}`);
if (!ctrl.verde) {
  // Sem este passo, uma suíte já vermelha faria TODA mutação `deveRuir:true` "passar" — e o placar
  // sairia cheio sem ter provado nada. É o formato exato do detector cego da B26.
  console.log(ctrl.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 6).join('\n'));
  console.log('\n>>> ABORTADO: com a suite ja vermelha, a mutacao nao prova nada.');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(1);
}
console.log('');

let pegou = 0, escapou = 0, falso = 0;
const escapadas = [], falsas = [];
for (const m of MUTACOES) {
  semeia();
  const alvo = path.join(TMP, m.arq);
  const antes = fs.readFileSync(alvo, 'utf8').replace(/\r\n/g, '\n');
  const depois = antes.replace(m.de, m.para);
  if (depois === antes) {
    escapou++; escapadas.push(m.nome + '  (o padrao nao casou — o alvo mudou de forma)');
    console.log(`  ?? ${m.nome}\n     >>> o padrao nao casou; esta mutacao nao mediu nada`);
    continue;
  }
  fs.writeFileSync(alvo, depois, 'utf8');
  const r = roda();
  if (m.deveRuir) {
    if (!r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  vermelha, como devia`); }
    else { escapou++; escapadas.push(m.nome); console.log(`  ** ESCAPOU: ${m.nome}  ->  a catraca ficou VERDE`); }
  } else {
    if (r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  passou, como devia (nao e defeito)`); }
    else {
      falso++; falsas.push(m.nome);
      console.log(`  ** FALSO VERMELHO: ${m.nome}`);
      console.log('     ' + r.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 2).join('\n     '));
    }
  }
}
fs.rmSync(TMP, { recursive: true, force: true });

console.log('\n== PLACAR ==');
console.log(`  ${pegou} de ${MUTACOES.length} mutacoes se comportaram como deviam`);
console.log(`  ${escapou} escaparam · ${falso} falso(s) vermelho(s)`);
if (escapadas.length) console.log('\n  ESCAPARAM:\n   - ' + escapadas.join('\n   - '));
if (falsas.length) console.log('\n  FALSO VERMELHO:\n   - ' + falsas.join('\n   - '));
process.exitCode = (escapou || falso) ? 1 : 0;
