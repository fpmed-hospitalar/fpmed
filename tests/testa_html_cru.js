// SUITE testa_html_cru — DADO QUE ENTRA EM MARCA-UP TEM DE PASSAR POR `esc()`.
//
// Fatia A54 (01/09/2026). Molde: `tests/testa_pdfjs_eval.js` — descoberta por diretório,
// nunca lista escrita à mão, e prova por mutação de boa fé com restauração byte a byte.
//
// ══ O QUE A CAIXA PEDIU, O QUE EU MEDI, E POR QUE A REGRA MUDOU ══════════════════════════════
// A caixa pediu "a catraca do `textContent` com marca-up": achar os lugares onde alguém usa
// `innerHTML` para pôr texto puro, que deveria ser `textContent`. Tentei medir isso TRÊS vezes,
// e as três deram falso positivo demais para virar catraca:
//
//   1ª  regex de uma linha .................. 208 achados — e a marca-up estava três linhas
//                                             abaixo, dentro do `.map()`. Medida errada.
//   2ª  extrator de expressão multilinha .... 108 — mas 39 eram `innerHTML = ''` (só limpa o
//                                             elemento; não é buraco nenhum).
//   3ª  só o que dá para provar ............. 13 — e os 13 ERAM FALSOS: `ic('certo','bom')`,
//                                             `bloco(...)`, `K(...)`, `ICONE_CERTO`. Nesta casa
//                                             a marca-up é composta por FUNÇÃO, e nenhuma
//                                             análise estática sabe o que uma função devolve.
//
// >>> ENTÃO A REGRA LITERAL DA CAIXA NÃO É PROVÁVEL AQUI, e forçar a barra criaria uma catraca
//     que grita no lugar errado — que é como catraca morre: em duas semanas alguém põe
//     `|| true` no script e ninguém nunca mais olha. Catraca que erra é pior do que não ter.
//
// >>> O QUE EU PUS NO LUGAR É PROVÁVEL, E PEGA O RISCO DE VERDADE. A casa já tem a disciplina
//     certa: existe um `esc()` e ele é usado em 110 interpolações. O invariante é esse —
//     **dado interpolado DENTRO de marca-up tem de passar por `esc()`**. Aqui não há chute:
//     se o pedaço escrito à mão tem `<td>` e o que entra no meio é `${c.nome}` vindo do banco,
//     um nome com `<img onerror=...>` vira script. É a mesma família da CVE-2024-4367 da A50 —
//     conteúdo de fora chegando a um interpretador —, só que a porta é o parser de HTML.
//
// MEDIDO HOJE: 575 interpolações dentro de marca-up · 110 escapadas · **465 CRUAS**.
//
// ══ E ELA NASCE COM O PLACAR TRAVADO, NÃO ZERADA ═════════════════════════════════════════════
// Ordem do arquiteto, e ela está certa: "catraca que nasce vermelha ninguém liga; catraca que
// proíbe piorar todo mundo aceita". O número de hoje vira teto POR ARQUIVO. Não pode subir.
// Arquivo que não está na lista tem teto ZERO — tela nova nasce escapando.
// **O CONSERTO DAS 465 NÃO É MEU.** 445 delas estão nas telas do Trabalhador B; eu não toco.
//
//   node tests/testa_html_cru.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_html_cru — dado em marca-up passa por esc()\n');

// ── O PLACAR TRAVADO, medido em 01/09/2026 ──────────────────────────────────────────────────
const PLACAR = {
  'fpmed_sistema_final.html': 258,
  'fpmed_giovana.html': 91,
  'fpmed_negocios.html': 73,
  'dashboard_clientes.html': 20,
  'fpmed_conferidor.html': 12,
  'fpmed_painel.html': 4,
  'fpmed_viabilidade.html': 3,
  'fpmed_pecas.html': 2,
  'fpmed_licitacoes.html': 1,
  'fpmed_vendas.html': 1,
};

// ── O EXTRATOR. Regex de uma linha não serve: a expressão atravessa linha, aspas e crase.
//    `el.innerHTML = lista.map(x => `<tr>...`).join('')` tem a marca-up três linhas abaixo.
function expressao(src, i) {
  let d = 0, s = null, out = '';
  for (; i < src.length && out.length < 6000; i++) {
    const c = src[i], anterior = src[i - 1];
    if (s) { out += c; if (c === s && anterior !== '\\') s = null; continue; }
    if (c === '"' || c === "'" || c === '`') { s = c; out += c; continue; }
    if (c === '(' || c === '[' || c === '{') d++;
    if (c === ')' || c === ']' || c === '}') { if (d === 0) break; d--; }
    if (c === ';' && d === 0) break;
    if (c === '\n' && d === 0) {
      // continua se a próxima linha começa com + ou . — concatenação/encadeamento
      if (!/^[+.]/.test(src.slice(i + 1, i + 200).replace(/^[\s\r]*/, ''))) break;
    }
    out += c;
  }
  return out;
}

const TAG = /<\/?[a-zA-Z][a-zA-Z0-9-]*(\s|\/|>)/;

// SEGURO = já escapado, ou incapaz de carregar marca-up por construção.
// `.length` e `Number()` devolvem número; `toFixed`/`toLocaleString`/`brl*` devolvem dígito,
// ponto e vírgula. Nenhum deles produz `<`. Não é indulgência: é o mesmo raciocínio do
// `isEvalSupported:false` — fechar a porta, e reconhecer as que já estão fechadas.
const SEGURO = /\besc\s*\(|\bescapa\s*\(|\bencodeURIComponent\s*\(|\bNumber\s*\(|\bparseInt\s*\(|\bparseFloat\s*\(|\.length\b|\btoLocaleString\s*\(|\btoFixed\s*\(|\bbrl\w*\s*\(|\bJSON\.stringify\s*\(/;

// Descoberta por diretório — tela nova entra nesta conta sozinha, como na testa_pdfjs_eval.
const arquivos = fs.readdirSync(raiz)
  .filter(a => /\.(html|js)$/.test(a) && !a.startsWith('_'))
  .sort();

let totalInterp = 0, totalEscapadas = 0;
const medido = {}, exemplos = {};
for (const a of arquivos) {
  let src; try { src = fs.readFileSync(path.join(raiz, a), 'utf8'); } catch (e) { continue; }
  if (!src.includes('.innerHTML')) continue;
  for (const m of src.matchAll(/\.innerHTML\s*\+?=\s*/g)) {
    const e = expressao(src, m.index + m[0].length);
    if (!TAG.test(e)) continue;                     // sem marca-up: outro assunto
    const linha = src.slice(0, m.index).split('\n').length;
    for (const it of e.matchAll(/\$\{([^{}]{1,160})\}/g)) {
      totalInterp++;
      if (SEGURO.test(it[1])) { totalEscapadas++; continue; }
      medido[a] = (medido[a] || 0) + 1;
      if (!exemplos[a]) exemplos[a] = a + ':' + linha + '  ${' + it[1].trim().slice(0, 50) + '}';
    }
  }
}

ok('1. o projeto tem interpolação em marca-up para conferir (senão a catraca é decorativa)',
  totalInterp > 0, totalInterp);
ok('2. a disciplina do esc() existe e é usada (a regra não é invenção minha)',
  totalEscapadas > 0, totalEscapadas);

// ═══════ A CATRACA ═══════
const piorou = [], novos = [], melhorou = [];
for (const [a, n] of Object.entries(medido)) {
  const teto = PLACAR[a];
  if (teto === undefined) novos.push({ arquivo: a, tem: n, exemplo: exemplos[a] });
  else if (n > teto) piorou.push({ arquivo: a, tem: n, teto, exemplo: exemplos[a] });
  else if (n < teto) melhorou.push({ arquivo: a, tem: n, teto });
}

// Se esta falhar: alguém interpolou dado dentro de marca-up sem `esc()`. O conserto é uma
// palavra — envolva a expressão em `esc(...)`, como nas outras 110. Não desative este teste.
ok('3. *** nenhum arquivo GANHOU interpolação crua (o placar não sobe) ***',
  piorou.length === 0, piorou);
ok('4. *** nenhum arquivo NOVO nasceu com interpolação crua (tela nova nasce escapando) ***',
  novos.length === 0, novos);
// Folga escondida faz o placar mentir: quem limpou tem de baixar o teto junto.
ok('5. *** quem limpou, baixou o teto junto (placar sem folga escondida) ***',
  melhorou.length === 0, melhorou);

const total = Object.values(medido).reduce((s, n) => s + n, 0);
console.log(`\n  ${totalInterp} interpolação(ões) dentro de marca-up · ${totalEscapadas} escapada(s) · ${total} CRUA(S).`);
console.log('  DÍVIDA DECLARADA por arquivo (o conserto das telas do B é do B):');
for (const [a, n] of Object.entries(medido).sort((x, y) => y[1] - x[1])) {
  console.log(`    ${String(n).padStart(4)}  ${a}`);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
