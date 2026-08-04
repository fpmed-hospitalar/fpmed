// SUITE testa_melhor_fonte — qual fonte a tela recomenda comprar.
// Extrai a funcao REAL do fpmed_sistema_final.html.
//
// BUG QUE ISTO TRAVA (portado da Global em 04/08/2026): a versao antiga era
//   menorInd ? industria : distribuidor
// ou seja, a INDUSTRIA vencia SEMPRE que existisse, mesmo custando muito mais que o
// distribuidor da mesma linha. A tela recomendava comprar na fonte cara tendo a barata do lado,
// e ainda exibia margem negativa (o seuPreco sai da media do mercado, o custo vinha errado).
// Regra certa: menor custo GERAL, com tolerancia de 5% a favor da industria (prazo/condicao).
//   node tests/testa_melhor_fonte.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');
function fn(nome) {
  const m = new RegExp('(?:^|\\n)\\s*function\\s+' + nome + '\\s*\\(').exec(src);
  if (!m) throw new Error('nao achei ' + nome);
  let i = src.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') n++;
    else if (src[j] === '}') { n--; if (!n) return src.slice(m.index, j + 1); }
  }
}
const { _cmpMelhorFonte } = (new Function(fn('_cmpMelhorFonte') + 'return { _cmpMelhorFonte };'))();

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? ' [got ' + JSON.stringify(got) + ']' : '')); } };
console.log('SUITE testa_melhor_fonte — qual fonte comprar\n');

// ── O CASO DO BUG: industria MUITO mais cara que o distribuidor ──
let r = _cmpMelhorFonte(43.00, 0.68);
ok('industria 43,00 x dist 0,68 -> DIST (era o bug)', r.tipo === 'dist' && r.custo === 0.68, r);

// ── industria mais barata: ganha ──
r = _cmpMelhorFonte(10.00, 12.00);
ok('industria mais barata -> IND', r.tipo === 'ind' && r.custo === 10, r);

// ── tolerancia de 5%: industria ate 5% acima ainda ganha ──
r = _cmpMelhorFonte(10.50, 10.00);
ok('industria 5% acima (10,50 x 10,00) -> IND', r.tipo === 'ind', r);
r = _cmpMelhorFonte(10.49, 10.00);
ok('industria 4,9% acima -> IND', r.tipo === 'ind', r);
r = _cmpMelhorFonte(10.51, 10.00);
ok('industria 5,1% acima -> DIST (passou da regua)', r.tipo === 'dist' && r.custo === 10, r);

// ── empate ──
r = _cmpMelhorFonte(10.00, 10.00);
ok('empate -> IND (tolerancia cobre)', r.tipo === 'ind', r);

// ── so uma fonte ──
ok('so industria -> IND', _cmpMelhorFonte(7, null).tipo === 'ind');
ok('so distribuidor -> DIST', _cmpMelhorFonte(null, 7).tipo === 'dist');

// ── fallback pro estoque proprio ──
r = _cmpMelhorFonte(null, null, 5.5);
ok('sem fonte externa -> GLOBAL (estoque proprio)', r && r.tipo === 'global' && r.custo === 5.5, r);
ok('sem fonte nenhuma -> null', _cmpMelhorFonte(null, null) === null, _cmpMelhorFonte(null, null));
ok('sem fonte e sem global -> null', _cmpMelhorFonte(null, null, null) === null);

// ── zero e valor legitimo, nao "ausente" (guarda contra `menorInd ?` de novo) ──
r = _cmpMelhorFonte(0, 5);
ok('industria a 0 NAO e tratada como ausente', r.tipo === 'ind' && r.custo === 0, r);

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
