// SUITE testa_cor_chumbada — COR SÓ SAI DO `fpmed_tema.css`.
//
// Fatia A53 (01/09/2026). A ordem do dono é uma só e é antiga: *"o valor exato do token do
// molde, inclusive as miúdas"*. O `fpmed_tema.css` já é a fonte única de cor e espaçamento —
// o que faltava era isso ser **obrigatório** em vez de combinado.
//
// ══ O QUE ESTA SUÍTE MEDE, E POR QUE NÃO É "PROCURAR # NO ARQUIVO" ═══════════════════════════
// A primeira versão contava todo `#RRGGBB` do arquivo e dava 1.403. Fui conferir a
// `fpmed_licitacoes.html`, que tinha 17, e **os 17 estavam dentro de comentário** — não eram
// cor chumbada, eram a MEDIÇÃO escrita ao lado da decisão: "o #2CA9E0 dá 2,67:1, por isso a
// ação usa o --azul-600". A tela já era 100% token.
//
// >>> ISSO TERIA SIDO UM ESTRAGO, NÃO UMA CATRACA. Uma régua que conta hex em comentário
//     acusa de dívida justamente a tela mais bem documentada da casa, e empurra quem quer
//     ficar verde a **apagar a medição** — que é o único registro de por que a cor é aquela.
//     A régua tem de separar quem PINTA de quem DOCUMENTA. Aqui, comentário (`/* */`,
//     `<!-- -->`, `//` no começo da linha) sai antes da contagem.
//     Com a separação, 1.403 viram **1.281 que realmente pintam** — e a `fpmed_licitacoes`
//     cai de 17 para **ZERO**.
//
// ══ O PLACAR NASCE TRAVADO, NÃO ZERADO ══════════════════════════════════════════════════════
// São 1.344 ocorrências vivas em 23 arquivos. Zerar isso não cabe numa fatia, e catraca que
// nasce vermelha ninguém liga — vira `|| true` no script em duas semanas. Então ela nasce com
// o número de HOJE travado por arquivo: **não pode aumentar**. Quem consertar, baixa o número
// aqui junto (a suíte exige isso: sobrou folga, o teto tem de descer).
// Foi assim que a régua visual pegou, e é a mesma ideia da catraca do `textContent` (A54).
//
//   node tests/testa_cor_chumbada.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_cor_chumbada — cor só sai do fpmed_tema.css\n');

// ── O PLACAR TRAVADO, medido em 01/09/2026. Número = quantos hex VIVOS o arquivo pode ter.
//    Arquivo que não está nesta lista tem teto ZERO: tela nova nasce sem cor chumbada.
const PLACAR = {
  'fpmed_sistema_final.html': 731,
  'dashboard_clientes.html': 81,
  'fpmed_template.html': 55,
  'fpmed_viabilidade.html': 46,
  'fpmed_painel.html': 44,
  'fpmed_vendas.html': 44,
  'fpmed_edital_ia.html': 33,
  'fpmed_competitividade.html': 31,
  'fpmed_encontrar_amostra.html': 31,
  'fpmed_pecas.html': 31,
  'fpmed_negocios.html': 28,
  'fpmed_declaracoes.html': 27,
  'fpmed_conferidor.html': 23,
  'reset-senha.html': 20,
  'fpmed_giovana.html': 18,
  'fpmed_documentos.html': 17,
  'limedtec-usuarios.html': 11,
  'index.html': 10,
  'gm-auth.js': 40,
  'limedtec-sessao.js': 7,
  'cliente.config.js': 6,
  'limedtec-licenca.js': 6,
  'limedtec-pwa.js': 4,
  // >>> A TELA DESTA FATIA, E ELA ESTÁ EM ZERO. Ela não aparece acima de propósito: teto
  //     ausente = teto zero. `fpmed_licitacoes.html` não pode ganhar UMA cor chumbada.
};

// A FONTE. Ela é o único lugar do sistema onde hex é legítimo — é para isso que ela existe.
const FONTE = 'fpmed_tema.css';

// Comentário fora antes de contar: é a diferença entre medir tinta e medir documentação.
const semComentario = s => s
  .replace(/<!--[\s\S]*?-->/g, ' ')      // HTML
  .replace(/\/\*[\s\S]*?\*\//g, ' ')     // CSS e JS em bloco
  .replace(/^[ \t]*\/\/.*$/gm, ' ');     // JS de linha inteira (o `//` de URL não começa linha)

const RE_HEX = /#[0-9a-fA-F]{3,8}\b/g;

const arquivos = fs.readdirSync(raiz)
  .filter(a => /\.(html|css|js)$/.test(a) && !a.startsWith('_') && a !== FONTE)
  .sort();

const medido = {};
for (const a of arquivos) {
  let s; try { s = fs.readFileSync(path.join(raiz, a), 'utf8'); } catch (e) { continue; }
  const n = (semComentario(s).match(RE_HEX) || []).length;
  if (n) medido[a] = n;
}

ok('1. a fonte única existe e é ela que carrega a cor', fs.existsSync(path.join(raiz, FONTE)));

// ── A CATRACA: ninguém piora ────────────────────────────────────────────────────────────────
const piorou = [], novos = [], melhorou = [];
for (const [a, n] of Object.entries(medido)) {
  const teto = PLACAR[a];
  if (teto === undefined) novos.push({ arquivo: a, tem: n });
  else if (n > teto) piorou.push({ arquivo: a, tem: n, teto });
  else if (n < teto) melhorou.push({ arquivo: a, tem: n, teto });
}

ok('2. *** nenhum arquivo GANHOU cor chumbada (o placar não sobe) ***', piorou.length === 0, piorou);
ok('3. *** nenhum arquivo NOVO nasceu com cor chumbada (tela nova nasce limpa) ***',
  novos.length === 0, novos);

// >>> A CATRACA DA CATRACA. Se alguém limpar uma tela e não baixar o teto, a folga vira espaço
//     para sujar de novo sem a suíte reclamar — e o placar deixa de dizer a verdade.
ok('4. *** quem limpou, baixou o teto junto (placar sem folga escondida) ***',
  melhorou.length === 0, melhorou);

// A tela desta fatia, nomeada: ela é o alvo declarado e não pode escorregar em silêncio.
ok('5. *** fpmed_licitacoes.html continua em ZERO cor chumbada ***',
  !medido['fpmed_licitacoes.html'], medido['fpmed_licitacoes.html'] || 0);

const total = Object.values(medido).reduce((s, n) => s + n, 0);
const tetoTotal = Object.values(PLACAR).reduce((s, n) => s + n, 0);
console.log(`\n  DÍVIDA DECLARADA: ${total} ocorrência(s) vivas em ${Object.keys(medido).length} arquivo(s).`);
console.log(`  Teto somado do placar: ${tetoTotal}. A catraca proíbe subir; ela não exige descer.`);
console.log('  As 5 maiores:');
for (const [a, n] of Object.entries(medido).sort((x, y) => y[1] - x[1]).slice(0, 5)) {
  console.log(`    ${String(n).padStart(4)}  ${a}`);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
