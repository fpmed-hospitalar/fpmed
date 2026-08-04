// SUITE testa_marca_fornecedor — o rótulo de EXIBIÇÃO do estoque próprio nunca pode ser "GLOBAL".
// Extrai a função REAL nomeForn de TODAS as telas que a têm.
//
// BUG QUE ISTO TRAVA (04/08/2026): o card de Propostas mostrava o badge azul "GLOBAL" ao lado do
// selo "ESTOQUE PRÓPRIO" — o nome da outra empresa vazando numa tela que o CLIENTE vê.
// A causa era `nomeForn` devolver 'GLOBAL' para o código '1'. O dado interno (fornecedor='1',
// tipo='global') NÃO muda — só o rótulo.
//   node tests/testa_marca_fornecedor.js
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const TELAS = ['fpmed_giovana.html', 'fpmed_vendas.html', 'fpmed_sistema_final.html', 'fpmed_painel.html'];

function extrai(arq) {
  const src = fs.readFileSync(path.join(RAIZ, arq), 'utf8');
  const m = /(?:^|\n)\s*function\s+nomeForn\s*\(/.exec(src);
  if (!m) return null;
  let i = src.indexOf('{', m.index + m[0].length - 1), c = 0, corpo = '';
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') c++;
    else if (src[j] === '}') { c--; if (!c) { corpo = src.slice(m.index, j + 1); break; } }
  }
  // FORN_NOMES vem junto (a função depende dele)
  const fm = /(?:^|\n)\s*(?:const|var|let)\s+FORN_NOMES\s*=\s*\{[\s\S]*?\};/.exec(src);
  return (new Function((fm ? fm[0] : 'const FORN_NOMES={};') + corpo + 'return nomeForn;'))();
}

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? ' [got ' + JSON.stringify(got) + ']' : '')); } };
console.log('SUITE testa_marca_fornecedor — rotulo do estoque proprio\n');

let telasComFuncao = 0;
for (const tela of TELAS) {
  const nomeForn = extrai(tela);
  if (!nomeForn) { console.log('  (sem nomeForn: ' + tela + ')'); continue; }
  telasComFuncao++;
  const curto = tela.replace('fpmed_', '').replace('.html', '');

  // ── o essencial: o codigo do estoque proprio exibe FPMED ──
  ok(`${curto}: codigo '1' -> FPMED`, nomeForn('1') === 'FPMED', nomeForn('1'));
  ok(`${curto}: vazio -> FPMED`, nomeForn('') === 'FPMED', nomeForn(''));
  ok(`${curto}: null -> FPMED`, nomeForn(null) === 'FPMED', nomeForn(null));
  ok(`${curto}: undefined -> FPMED`, nomeForn(undefined) === 'FPMED', nomeForn(undefined));
  ok(`${curto}: numero 1 (nao string) -> FPMED`, nomeForn(1) === 'FPMED', nomeForn(1));
  ok(`${curto}: ' 1 ' com espaco -> FPMED`, nomeForn(' 1 ') === 'FPMED', nomeForn(' 1 '));

  // ── A REGRA DE OURO: nenhum codigo pode exibir exatamente "GLOBAL" ──
  const codigos = ['', null, undefined, 0, 1, '1', ' 1 '];
  for (let i = 2; i <= 30; i++) codigos.push(String(i));
  const vazou = codigos.filter(c => nomeForn(c) === 'GLOBAL');
  ok(`${curto}: NENHUM codigo devolve a string "GLOBAL"`, vazou.length === 0, vazou);

  // ── mas nome REAL de distribuidor com GLOBAL e DADO, nao rotulo: passa intacto ──
  ok(`${curto}: 'GLOBAL HOSPITALAR' (distribuidor real) intacto`,
     nomeForn('GLOBAL HOSPITALAR') === 'GLOBAL HOSPITALAR', nomeForn('GLOBAL HOSPITALAR'));
  ok(`${curto}: 'GLOBALMED DISTRIBUIDORA' intacto`,
     nomeForn('GLOBALMED DISTRIBUIDORA') === 'GLOBALMED DISTRIBUIDORA', nomeForn('GLOBALMED DISTRIBUIDORA'));

  // ── distribuidor normal segue com o nome dele ──
  ok(`${curto}: codigo '2' -> SUPERMEDICA`, nomeForn('2') === 'SUPERMEDICA', nomeForn('2'));
  ok(`${curto}: nome em texto passa direto`, nomeForn('SANTA CRUZ') === 'SANTA CRUZ', nomeForn('SANTA CRUZ'));
}

ok('todas as telas esperadas tem nomeForn', telasComFuncao >= 4, telasComFuncao);

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
