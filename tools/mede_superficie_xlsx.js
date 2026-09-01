/* ══════════════════════════════════════════════════════════════════════════════════════════════
   tools/mede_superficie_xlsx.js — QUEM AQUI ABRE PLANILHA DE FORA?

   Fatia A52 (01/09/2026). O `xlsx` 0.18.5 tem dois avisos `high` sem correção no npm:
   prototype pollution (GHSA-4r6h-8v6p-xvw6) e ReDoS (GHSA-5pgg-2g8v-p4x9).

   >>> A PERGUNTA QUE MUDA A DECISÃO NÃO É "USAMOS xlsx?" — É "QUEM **LÊ**?".
       Os dois avisos são de PARSE: eles precisam de um arquivo hostil entrando. Quem só
       MONTA planilha (`json_to_sheet` + `writeFile`) não toca no parser e não está exposto,
       por mais que apareça na busca por "XLSX". Contar chamadas dá um número grande e errado;
       contar PARSE dá o número que decide.

   Por isso esta ferramenta separa três coisas:
     LÊ DE FORA   — parse de arquivo que ninguém desta casa produziu. É a superfície real.
     LÊ DA CASA   — parse de arquivo que a própria casa acabou de gerar (conferência de ida e
                    volta). Risco só existe se a nossa própria geração for hostil.
     SÓ ESCREVE   — monta e salva. Não passa pelo parser.

   A origem de cada leitura NÃO é adivinhada pelo código: está declarada na tabela ORIGENS
   abaixo, com o porquê. Adivinhar origem de arquivo por regex seria inventar precisão.

     node tools/mede_superficie_xlsx.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');

// ── DE ONDE VEM O ARQUIVO QUE CADA PONTO DE LEITURA ABRE ────────────────────────────────────
// `fora`  = origem externa (o dono escolhe no disco, ou veio da ANVISA/de um fornecedor).
// `casa`  = a própria casa gerou o arquivo na linha de cima.
const ORIGENS = {
  'fpmed_conferidor.html':      { origem: 'fora', nota: 'input de arquivo: o dono escolhe a planilha (lista de fornecedor, extração da CMED)' },
  'fpmed_viabilidade.html':     { origem: 'fora', nota: 'input de arquivo: o dono escolhe a planilha de compra' },
  'tools/atualiza_cmed.js':     { origem: 'fora', nota: 'planilha da CMED baixada da ANVISA' },
  'tools/carrega_cmed_pf.js':   { origem: 'fora', nota: 'planilha PF da CMED, da ANVISA' },
  'tools/carrega_cmed_precos.js': { origem: 'fora', nota: 'planilha de preços da CMED, da ANVISA' },
  'tools/prova_cmed_edicao.js': { origem: 'fora', nota: 'planilhas da CMED, da ANVISA' },
  'tools/prova_trava_cmed.js':  { origem: 'fora', nota: 'planilhas da CMED, da ANVISA' },
  'tools/carrega_calendario.js': { origem: 'fora', nota: 'Calendario 2025.xlsm — planilha do dono, mantida fora do repo' },
  'tools/explora_calendario.js': { origem: 'fora', nota: 'a mesma Calendario 2025.xlsm' },
  'tools/le_estoque_fpmed.js':  { origem: 'fora', nota: 'export de estoque que o dono tira do sistema dele' },
  'tools/fechamento_mes.js':    { origem: 'casa', nota: 'relê a fatura que ELE MESMO acabou de escrever, para conferir a ida e volta' },
};

const IGNORA = new Set(['node_modules', '.git', 'backups', 'video_narracao', 'logs', 'prints',
                        '.playwright-mcp', 'icones', 'dados_cmed', 'kit_cliente']);
function varre(dir, achado = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_')) continue;
    if (e.isDirectory()) { if (!IGNORA.has(e.name)) varre(path.join(dir, e.name), achado); }
    else if (/\.(html|js|mjs)$/.test(e.name)) achado.push(path.relative(RAIZ, path.join(dir, e.name)));
  }
  return achado;
}

// PARSE: read / readFile. ESCRITA: write / writeFile / *_to_sheet / book_*.
// `sheet_to_json` NÃO é parse: ele já recebe a planilha aberta, o estrago já teria acontecido.
const RE_PARSE   = /\b(?:XLSX|X)\s*\.\s*(read|readFile)\s*\(/g;
const RE_ESCRITA = /\b(?:XLSX|X)\s*\.\s*(write|writeFile)\s*\(/g;
const RE_CDN     = /cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/([0-9.]+)\/|cdn\.sheetjs\.com\/xlsx-([0-9.]+)\//g;

const linhaDe = (src, i) => src.slice(0, i).split('\n').length;
const parse = [], escrita = [], cdns = new Map(), npm = [];

for (const arq of varre(RAIZ)) {
  let src; try { src = fs.readFileSync(path.join(RAIZ, arq), 'utf8'); } catch (e) { continue; }
  if (!/XLSX|xlsx/.test(src)) continue;
  const chave = arq.replace(/\\/g, '/');
  for (const m of src.matchAll(RE_PARSE))   parse.push({ arq: chave, linha: linhaDe(src, m.index), como: m[1] });
  for (const m of src.matchAll(RE_ESCRITA)) escrita.push({ arq: chave, linha: linhaDe(src, m.index) });
  for (const m of src.matchAll(RE_CDN)) {
    const v = m[1] || m[2], onde = m[1] ? 'cdnjs' : 'sheetjs';
    if (!cdns.has(chave)) cdns.set(chave, new Set());
    cdns.get(chave).add(onde + ' ' + v);
  }
  if (/require\(\s*['"]xlsx['"]\s*\)/.test(src)) npm.push(chave);
}

console.log('\n=== SUPERFICIE DE EXPOSICAO DO xlsx — quem ABRE planilha, e de onde ela vem ===\n');
console.log('Os dois avisos `high` do xlsx 0.18.5 sao de PARSE. Quem so monta planilha nao entra.\n');

const grupos = { fora: [], casa: [], semClassificacao: [] };
for (const p of parse) {
  const o = ORIGENS[p.arq];
  (o ? grupos[o.origem] : grupos.semClassificacao).push({ ...p, nota: o && o.nota });
}

console.log('── LE ARQUIVO DE FORA (a superficie real) ──────────────────────────────────────');
for (const p of grupos.fora) console.log(`  ${(p.arq + ':' + p.linha).padEnd(38)} ${p.como.padEnd(9)} ${p.nota}`);
console.log(`  >>> ${grupos.fora.length} ponto(s) de leitura em ${new Set(grupos.fora.map(p => p.arq)).size} arquivo(s)\n`);

console.log('── LE ARQUIVO QUE A CASA GEROU (nao e superficie externa) ──────────────────────');
for (const p of grupos.casa) console.log(`  ${(p.arq + ':' + p.linha).padEnd(38)} ${p.como.padEnd(9)} ${p.nota}`);
console.log(`  >>> ${grupos.casa.length} ponto(s)\n`);

if (grupos.semClassificacao.length) {
  console.log('── !! LEITURA SEM ORIGEM DECLARADA — alguem abriu planilha e nao disse de onde ──');
  for (const p of grupos.semClassificacao) console.log(`  ${p.arq}:${p.linha}  ${p.como}`);
  console.log('  >>> declare a origem na tabela ORIGENS deste arquivo.\n');
}

const soEscrevem = [...new Set(escrita.map(e => e.arq))].filter(a => !parse.some(p => p.arq === a));
console.log('── SO ESCREVE (monta e salva; nao passa pelo parser, nao esta exposto) ─────────');
for (const a of soEscrevem) console.log('  ' + a);
console.log(`  >>> ${soEscrevem.length} arquivo(s)\n`);

console.log('── DE ONDE A BIBLIOTECA VEM ───────────────────────────────────────────────────');
for (const [a, v] of cdns) console.log(`  ${a.padEnd(30)} ${[...v].join(', ')}`);
console.log('  npm (require): ' + (npm.length ? npm.join(', ') : 'nenhum'));

const totalTelas = [...cdns.keys()].filter(a => a.endsWith('.html'));
const telasQueLeem = [...new Set(grupos.fora.filter(p => p.arq.endsWith('.html')).map(p => p.arq))];
console.log('\n── O NUMERO QUE DECIDE ────────────────────────────────────────────────────────');
console.log(`  telas que CARREGAM o xlsx ........... ${totalTelas.length}`);
console.log(`  telas que ABREM planilha de fora .... ${telasQueLeem.length}  (${telasQueLeem.join(', ')})`);
console.log(`  telas que so GERAM planilha ......... ${totalTelas.length - telasQueLeem.length}  <- nao expostas`);
console.log(`  ferramentas Node que abrem de fora .. ${new Set(grupos.fora.filter(p => p.arq.endsWith('.js')).map(p => p.arq)).size}`);
console.log('');
