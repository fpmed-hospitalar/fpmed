/* ══════════════════════════════════════════════════════════════════════════════════════════════
   muta_b34.js — A CATRACA DO RASTRO CONTRA O MATERIAL DE VERDADE (21/08/2026)

   Mesma lei do `muta_b31.js`, e ela vem da B26: *"um detector provado só contra exemplos que eu
   mesmo escrevi herda o meu engano inteiro, e herda em silêncio, com relatório verde."*

   ══ E ESTA FATIA TEM UMA PARTICULARIDADE QUE MUDA O QUE AS MUTAÇÕES SÃO ══════════════════════
   A primeira mutação da lista **não é uma hipótese: é o código que estava no ar até hoje de
   manhã.** O `arquivar()` do kanban gravava `{ arquivado: true }` e mais nada, e a catraca da
   casa não tinha como ver — porque não havia catraca. Plantar de volta o estado real anterior é
   a única maneira honesta de perguntar "e agora, ela vê?".

   ══ ELA MEDE OS DOIS LADOS ══════════════════════════════════════════════════════════════════
   `deveRuir: true` são defeitos — a catraca TEM de ficar vermelha. `deveRuir: false` são
   mudanças legítimas (prosa que nomeia o que a regra proíbe) — e a catraca TEM de deixar passar.
   Catraca que fica vermelha com as duas não protege nada; ela só ensina a apagar comentário.

     node tools/muta_b34.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ARQUIVOS = [
  'fpmed_ata_entrada.js', 'fpmed_negocios.html', 'ddl/rastro_arquivamento.sql',
  'tests/testa_arquivar_rastro.js',
  /* A SEGUNDA SUÍTE, e ela está aqui por medição e não por simetria: a `testa_funil_negocios`
     guarda o caminho do arquivar desde 11/08, e foi ela que teve de mudar nesta fatia. Rodar só a
     suíte nova deixaria a mutação "a tela para de chamar o motor" parecer coberta por um lugar
     quando na verdade está coberta por dois — e é útil saber por quantos. */
  'tests/testa_funil_negocios.js', 'tools/semeia_negocios.js',
  // A régua do A é lida no `require` das suítes, e desde a A37 ela mesma `require` a prova do
  // papel congelado. Sem os dois, o controle acusaria "já está vermelha" sobre arquivo faltando.
  'tools/regua_visual.js', 'tools/prova_papel_congelado.js',
  /* E OS QUATRO ABAIXO NÃO SÃO ZELO: a `testa_funil_negocios` confere que a tela é ALCANÇÁVEL
     (menu, sistema final, a ponte com a Encontrar e a casca do service worker). Sem eles o
     controle abortaria por arquivo faltando — que é abortar por causa da lista de cópia, e não
     por causa do código medido. Foi assim que esta ferramenta abortou na primeira execução. */
  'fpmed_tema.css', 'tests/telas_adotadas.json', 'limedtec-menu.js',
  'fpmed_sistema_final.html', 'fpmed_licitacoes.html', 'sw.js',
];
const SUITES = ['testa_arquivar_rastro.js', 'testa_funil_negocios.js'];
const SUITE = SUITES.join(' + ');
const MOTOR = 'fpmed_ata_entrada.js';
const NEG = 'fpmed_negocios.html';
const DDL = 'ddl/rastro_arquivamento.sql';

const MUTACOES = [
  // ── O DEFEITO QUE ESTAVA NO AR ATÉ HOJE ───────────────────────────────────────────────────
  /* ESTAS TRÊS SÃO A FATIA INTEIRA, e nenhuma delas levanta erro. Todas produzem uma tela que
     funciona: o cartão sai do funil, o botão responde, nada pisca vermelho. O que muda é só que a
     decisão de uma pessoa passa a ser indistinguível de uma linha que uma máquina arquivou. */
  { nome: '*** o kanban volta a gravar `{ arquivado:true }` — o codigo que estava no ar ***',
    deveRuir: true, arq: NEG,
    de: /const p = E \? E\.pedidoArquivarNegocio\(n, quem, new Date\(\)\.toISOString\(\)\)/,
    para: 'const p = { ok:true, campos:{ arquivado:true } } || E.pedidoArquivarNegocio(n, quem, new Date().toISOString())' },
  { nome: '*** o carimbo some do pedido do kanban (a decisao vira importacao) ***',
    deveRuir: true, arq: MOTOR,
    de: /      arquivado_em: agoraISO \|\| new Date\(\)\.toISOString\(\),\n      arquivado_por: quem \|\| null,/,
    para: '      arquivado_por: quem || null,' },
  { nome: 'a origem some do pedido do kanban', deveRuir: true, arq: MOTOR,
    de: /      arquivado_por: quem \|\| null,\n      arquivado_origem: 'decisao',/,
    para: '      arquivado_por: quem || null,' },
  { nome: 'a origem some do pedido da ATA (os dois caminhos param de falar a mesma lingua)',
    deveRuir: true, arq: MOTOR,
    de: /      arquivado_por: quem \|\| null,\n      arquivado_origem: 'decisao',\n    \} \};\n  \}/,
    para: '      arquivado_por: quem || null,\n    } };\n  }' },
  { nome: 'o autor deixa de ir junto (arquivado por ninguem)', deveRuir: true, arq: NEG,
    de: /const quem = \(window\.gmAuth && gmAuth\.user && gmAuth\.user\.email\) \|\| null;\n  \/\* SEM O MOTOR/,
    para: 'const quem = null;\n  /* SEM O MOTOR' },

  // ── A ATA RECUSADA, E A RECUSA QUE PRECISA SER VISTA ─────────────────────────────────────
  /* A pior das quatro é a primeira: ela conserta o SINTOMA (o cartão some do funil) e mantém o
     defeito (a ata continua no painel de vigência), que é a forma de defeito que mais dura. */
  { nome: '*** a ata volta a poder ser arquivada pelo kanban (fica no painel de vigencia) ***',
    deveRuir: true, arq: MOTOR,
    de: /if \(n\.estagio === 'contrato'\) \{/, para: "if (false) {" },
  { nome: 'a ata passa a ser arquivada pelo kanban COM carimbo, mas sem motivo (cemiterio anonimo)',
    deveRuir: true, arq: MOTOR,
    de: /if \(n\.estagio === 'contrato'\) \{\n      return \{ ok: false/,
    para: "if (n.estagio === 'contrato' && false) {\n      return { ok: false" },
  { nome: '*** a recusa deixa de ser mostrada (o botao simplesmente nao faz nada) ***',
    deveRuir: true, arq: NEG,
    de: /if\(!p\.ok\)\{ alert\(p\.erro\); return; \}/, para: 'if(!p.ok){ return; }' },
  { nome: 'a recusa deixa de dizer PARA ONDE ir', deveRuir: true, arq: MOTOR,
    de: /'Esta é uma ATA: arquive por "Arquivar esta ata", na aba Ata desta '/,
    para: "'Não dá para arquivar esta linha por aqui. '" },
  { nome: 'a recusa vem DEPOIS do confirm (a pessoa decide a toa e leva um nao)',
    deveRuir: true, arq: NEG,
    de: /  if\(!p\.ok\)\{ alert\(p\.erro\); return; \}\n  if\(!confirm\('Arquivar este negócio\? Ele sai do funil e continua no histórico\.'\)\) return;/,
    para: "  if(!confirm('Arquivar este negócio? Ele sai do funil e continua no histórico.')) return;\n  if(!p.ok){ alert(p.erro); return; }" },

  // ── A VOLTA ──────────────────────────────────────────────────────────────────────────────
  { nome: '*** desarquivar volta a gravar so `{ arquivado:false }` (o carimbo fica para tras) ***',
    deveRuir: true, arq: NEG,
    de: /const campos = E\.pedidoDesarquivar\(new Date\(\)\.toISOString\(\)\);/,
    para: 'const campos = { arquivado:false };' },
  { nome: '*** a volta "limpa" tambem o motivo e o autor (desfaz o fato, e nao so o ato) ***',
    deveRuir: true, arq: MOTOR,
    de: /return \{ arquivado: false, arquivado_em: null,\n             desarquivado_em: agoraISO \|\| new Date\(\)\.toISOString\(\) \};/,
    para: 'return { arquivado: false, arquivado_em: null, arquivado_motivo: null, arquivado_por: null,\n             desarquivado_em: agoraISO || new Date().toISOString() };' },
  { nome: 'a volta deixa de limpar o carimbo (a ata nao volta ao painel de vigencia)',
    deveRuir: true, arq: MOTOR,
    de: /return \{ arquivado: false, arquivado_em: null,/, para: 'return { arquivado: false,' },
  { nome: 'a terceira data some da volta', deveRuir: true, arq: MOTOR,
    de: /\n             desarquivado_em: agoraISO \|\| new Date\(\)\.toISOString\(\) \};/, para: ' };' },

  // ── O MOTOR COMO LUGAR ÚNICO DA REGRA ────────────────────────────────────────────────────
  { nome: 'o motor para de exportar o pedido do kanban', deveRuir: true, arq: MOTOR,
    de: /    pedidoArquivarNegocio: pedidoArquivarNegocio,\n/, para: '' },
  { nome: 'a tela para de chamar o motor e monta o pedido sozinha (a segunda implementacao)',
    deveRuir: true, arq: NEG,
    de: /await gravar\(id, p\.campos\); Object\.assign\(n, p\.campos\);/,
    para: 'await gravar(id, { arquivado:true, arquivado_em:new Date().toISOString() }); n.arquivado = true;' },

  // ── O DDL: O UPDATE QUE PRECISA CONTINUAR CERCADO ────────────────────────────────────────
  /* As quatro seguintes são a diferença entre "um UPDATE cuidadoso" e "um UPDATE que se chama
     cuidadoso". Nenhuma delas apaga uma linha; todas escrevem onde não deviam. */
  { nome: '*** o UPDATE da importacao perde o `arquivado_origem is null` (deixa de ser idempotente) ***',
    deveRuir: true, arq: DDL,
    de: / where arquivado_origem is null\n   and arquivado\n   and arquivado_em is null\n   and origem = 'calendario_2025';/,
    para: " where arquivado\n   and arquivado_em is null\n   and origem = 'calendario_2025';" },
  { nome: '*** o UPDATE passa a carimbar `arquivado_em` junto (a aba Ata iria a zero) ***',
    deveRuir: true, arq: DDL,
    de: /   set arquivado_origem = 'importacao_calendario_2025'/,
    para: "   set arquivado_origem = 'importacao_calendario_2025', arquivado_em = now()" },
  { nome: '*** o UPDATE passa a DESLIGAR a bandeira (2.551 cartoes mortos voltam ao kanban) ***',
    deveRuir: true, arq: DDL,
    de: /   set arquivado_origem = 'importacao_calendario_2025'/,
    para: "   set arquivado_origem = 'importacao_calendario_2025', arquivado = false" },
  { nome: 'o UPDATE deixa de exigir `arquivado` (quem esta no funil ganha origem de arquivamento)',
    deveRuir: true, arq: DDL,
    de: / where arquivado_origem is null\n   and arquivado\n   and arquivado_em is not null;/,
    para: ' where arquivado_origem is null\n   and arquivado_em is not null;' },
  { nome: 'o grupo sem carimbo passa a usar `<>` (a linha de origem nula sai calada)',
    deveRuir: true, arq: DDL,
    de: /and origem is distinct from 'calendario_2025';/, para: "and origem <> 'calendario_2025';" },
  { nome: 'o grupo sem carimbo ganha uma data inventada', deveRuir: true, arq: DDL,
    de: /   set arquivado_origem = 'decisao_sem_carimbo'/,
    para: "   set arquivado_origem = 'decisao_sem_carimbo', arquivado_em = now()" },
  { nome: 'o DDL vira destrutivo (`drop view` no lugar do `create or replace`)', deveRuir: true, arq: DDL,
    de: /create or replace view public\.v_arquivamento_origem/,
    para: 'drop view if exists public.v_arquivamento_origem;\ncreate view public.v_arquivamento_origem' },
  { nome: 'a view de auditoria perde o security_invoker (porta lateral sobre a RLS)',
    deveRuir: true, arq: DDL,
    de: /create or replace view public\.v_arquivamento_origem\n  with \(security_invoker = on\) as/,
    para: 'create or replace view public.v_arquivamento_origem as' },
  { nome: 'o anon passa a enxergar a auditoria', deveRuir: true, arq: DDL,
    de: /revoke all  on public\.v_arquivamento_origem from anon;/, para: '' },
  { nome: 'a coluna nova perde o `if not exists` (a segunda rodada quebra)', deveRuir: true, arq: DDL,
    de: /add column if not exists arquivado_origem text;/, para: 'add column arquivado_origem text;' },
  { nome: 'o PostgREST deixa de ser avisado (a tela grava numa coluna que ele nao conhece)',
    deveRuir: true, arq: DDL, de: /notify pgrst, 'reload schema';/, para: '' },
  { nome: 'a coluna deixa de se explicar no banco', deveRuir: true, arq: DDL,
    de: /comment on column public\.negocios\.arquivado_origem is[\s\S]*?';\n/, para: '' },
  { nome: 'a bandeira velha volta a nao dizer nada sobre si mesma', deveRuir: true, arq: DDL,
    de: /comment on column public\.negocios\.arquivado is[\s\S]*?';\n/, para: '' },

  // ── AS DUAS OPÇÕES RECUSADAS ─────────────────────────────────────────────────────────────
  /* Opção listada sem veredito não é opção: é fila. E o número medido é o que separa "decidi" de
     "achei" — sem ele, a próxima pessoa refaz a pergunta do zero e pode responder diferente. */
  { nome: '*** a opcao de carimbar as atas some do registro (a decisao perde a razao) ***',
    deveRuir: true, arq: DDL, de: /-- OPÇÃO A —/, para: '-- (a) ' },
  { nome: 'a opcao de desligar a bandeira perde o numero medido do kanban', deveRuir: true, arq: DDL,
    de: /o kanban iria de \*\*6\*\* para \*\*2\.566\*\* cartões/, para: 'o kanban ficaria muito maior' },
  { nome: 'as opcoes deixam de ter veredito (viram fila em vez de decisao)', deveRuir: true, arq: DDL,
    de: /RECUSADA\./g, para: 'A ver.' },
  { nome: 'o registro deixa de dizer que a bandeira foi decisao do semeador', deveRuir: true, arq: DDL,
    de: /`tools\/semeia_negocios\.js`, em\n-- 06\/08/, para: 'alguma importação, em\n-- algum dia de agosto' },

  // ── AS QUE **NÃO** PODEM FICAR VERMELHAS ─────────────────────────────────────────────────
  /* A prosa desta casa NOMEIA o que a regra proíbe — é a única maneira de um comentário ensinar
     uma regra. Se a catraca cobrar do comentário, o conserto vira "apagar a explicação", e
     explicação apagada é a causa da próxima geração do mesmo defeito. */
  { nome: 'um comentario cita `{ arquivado:true }` como o erro a evitar', deveRuir: false, arq: MOTOR,
    de: /  function pedidoDesarquivar\(agoraISO\) \{/,
    para: '  /* jamais gravar so { arquivado:true } aqui: sem carimbo a decisao vira importacao */\n  function pedidoDesarquivar(agoraISO) {' },
  { nome: 'a tela ganha comentario citando `arquivado_em = now()` como proibido', deveRuir: false, arq: NEG,
    de: /async function desarquivar\(id\)\{/,
    para: '/* nunca inventar arquivado_em = now() para clique antigo: data nao sabida nao e hoje */\nasync function desarquivar(id){' },
  { nome: 'o DDL ganha comentario citando `delete from negocios` como o que nao se faz',
    deveRuir: false, arq: DDL,
    de: /-- 3\. A VISÃO QUE RESPONDE/,
    para: '-- nao existe delete from public.negocios aqui, e nunca vai existir: arquivar, nao apagar\n-- 3. A VISÃO QUE RESPONDE' },
  { nome: 'a suite ganha um comentario citando `drop view` como o proibido', deveRuir: false,
    arq: 'tests/testa_arquivar_rastro.js',
    de: /console\.log\('\\nRESULTADO: '/,
    para: "/* nenhum drop view / truncate neste DDL, e o assert acima e quem cobra isso */\nconsole.log('\\nRESULTADO: '" },
];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'muta-b34-'));
function semeia() {
  for (const rel of ARQUIVOS) {
    const dest = path.join(TMP, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, rel), dest);
  }
}
// Vermelha em QUALQUER uma das duas já é a catraca da casa vendo o defeito. O nome de quem pegou
// vai junto: saber qual suíte mordeu é o que permite mudar um recorte sem apagar uma promessa.
function roda() {
  let verde = true, saida = '', quem = [];
  for (const s of SUITES) {
    try { execFileSync(process.execPath, [path.join(TMP, 'tests', s)], { stdio: 'pipe', encoding: 'utf8' }); }
    catch (e) { verde = false; quem.push(s.replace(/^testa_|\.js$/g, '')); saida += String((e.stdout || '') + (e.stderr || '')); }
  }
  return { verde: verde, saida: saida, quem: quem.join(', ') };
}

console.log('=== MUTACAO DA FATIA B34 — a catraca do rastro contra o material de verdade ===\n');
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
    if (!r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  vermelha (${r.quem}), como devia`); }
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
