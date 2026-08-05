// SUITE testa_licitacoes — funções puras da tela de Licitações (categorias e último dia útil).
// Extrai do fpmed_licitacoes.html, não recopia.
//   node tests/testa_licitacoes.js
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8');

function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora: ' + ini);
  return src.slice(s, e);
}
const ctx = (new Function(
  bloco('const semAcento =', 'const ymd =') +
  bloco('const CATEGORIAS =', 'function categorias') +
  bloco('function categorias', '// ══ PACK') +      // âncora movida: o bloco da ADERÊNCIA virou o cruzamento por item
  bloco('function ultimoDiaUtil', '(function(){ const d=ultimoDiaUtil') +
  'return { categorias, ultimoDiaUtil, semAcento };'))();
const { categorias, ultimoDiaUtil } = ctx;

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? ' [' + JSON.stringify(got) + ']' : '')); } };
console.log('SUITE testa_licitacoes — categorias e data padrao\n');

// ── ETIQUETAS DE CATEGORIA ──
const objReal = 'FORNECIMENTO PARCELADO DE MEDICAMENTOS, MATERIAIS MÉDICO HOSPITALARES, INSUMOS LABORATORIAIS, MATERIAIS ODONTOLÓGICOS E DEMAIS ITENS CORRELATOS';
const c1 = categorias(objReal);
ok('objeto real de GO -> Medicamentos', c1.includes('Medicamentos'), c1);
ok('objeto real de GO -> Material hospitalar', c1.includes('Material hospitalar'), c1);
ok('objeto real de GO -> Insumos laboratoriais', c1.includes('Insumos laboratoriais'), c1);
ok('objeto real de GO -> Odontológico', c1.includes('Odontológico'), c1);

ok('acento não atrapalha (MÉDICO)', categorias('MATERIAL MÉDICO').includes('Material hospitalar'));
ok('minúscula funciona', categorias('aquisição de medicamentos').includes('Medicamentos'));
ok('soro -> Soros e soluções', categorias('SORO FISIOLOGICO 0,9%').includes('Soros e soluções'));
ok('psicotrópico -> Controle especial', categorias('MEDICAMENTOS PSICOTROPICOS').includes('Controle especial'));
ok('seringa -> Material hospitalar', categorias('SERINGAS E AGULHAS DESCARTAVEIS').includes('Material hospitalar'));

// ── CONTROLES: objeto fora do ramo não pode gerar etiqueta ──
ok('veículos -> nenhuma etiqueta', categorias('AQUISICAO DE VEICULOS ZERO KM').length === 0, categorias('AQUISICAO DE VEICULOS ZERO KM'));
ok('obra -> nenhuma etiqueta', categorias('REFORMA DE PRACA PUBLICA').length === 0, categorias('REFORMA DE PRACA PUBLICA'));
ok('objeto vazio -> nenhuma etiqueta', categorias('').length === 0);
ok('null nao quebra', categorias(null).length === 0);

// ── ÚLTIMO DIA ÚTIL ──
const d = ultimoDiaUtil();
ok('último dia útil nunca é sábado', d.getDay() !== 6, d.getDay());
ok('último dia útil nunca é domingo', d.getDay() !== 0, d.getDay());
ok('último dia útil é no passado', d < new Date(), d.toISOString());

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
