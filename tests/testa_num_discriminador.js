// SUITE testa_num_discriminador — EM MATERIAL, O NUMERO E O PRODUTO.
//
// QUATRO CASOS REAIS, todos do MESMO pedido cirurgico de 37 linhas:
//    SONDA FOLEY 24/3 VIAS  casava  SONDA DE FOLEY 2 VIAS N.14   (calibre E vias errados)
//    LAMINA BISTURI N 15    casava  LAMINA BISTURI N.23
//    PAPEL LENCOL 50X70     casava  PAPEL LENCOL 50CMX50MT
//    DRENO SUCTOR 4.8/3.2   casavam DRENO SUCCAO CANULA 6,4      (os TRES na mesma linha)
// O motor ja lia esses numeros no PEDIDO — a guarda de calibre existe pra que "N 16" nao vire
// QUANTIDADE — mas nunca os comparava com o CANDIDATO. Calibre, numero de vias e medida viravam
// enfeite: o item entrava no orcamento com o produto errado, no preco do errado.
//
// O 4o caso nasceu do de-para de palavra (SUCTOR<->SUCCAO) do lote B: aproximar produtos parecidos
// SEM comparar o numero e trocar sem-match por match errado. Por isso as duas coisas andam juntas.
//   node tests/testa_num_discriminador.js
const fs = require('fs'), path = require('path');
const lines = fs.readFileSync(path.join(__dirname, '..', 'fpmed_giovana.html'), 'utf8').split(/\r?\n/);
function block(a, b) {
  const s = lines.findIndex(l => l.includes(a));
  if (s < 0) throw new Error('ancora inicio: ' + a);
  let e = -1; for (let i = s + 1; i < lines.length; i++) { if (lines[i].includes(b)) { e = i; break; } }
  if (e < 0) throw new Error('ancora fim: ' + b);
  return lines.slice(s, e).join('\n');
}
const ctx = (new Function('let cotacoes=[];let _bmCmed=new Map();let _bmClasseB=new Set();console.warn=function(){};\n'
  + block('function _undNum(und)', 'let searchTO') + '\n'
  + block('const _bmStrip = s =>', '/* ─── busca antiga') + '\n'
  + 'return { api:{ buscarMelhorProduto, _bmDiscrim, _bmDiscrimConflito, _bmMaterial },'
  + '         setCot:function(a){cotacoes=a;}, setDic:function(pc){_bmPalCanon=pc;} };'))();
const { buscarMelhorProduto, _bmDiscrim, _bmDiscrimConflito, _bmMaterial } = ctx.api;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e != null ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_num_discriminador — calibre, vias e medida\n');

const R = (produto, preco) => ({ produto, principio_ativo: '', und: '', compra_unit: String(preco),
  global_venda1: '', tipo: 'fornecedor', fornecedor: 'MCW', estoque: '5' });
const busca = (cot, q) => { ctx.setCot(cot); return buscarMelhorProduto(q); };
const nome = r => r ? r.produto : null;
// os asserts de leitura usam o modo MATERIAL (decimal solto conta como calibre) — é onde a
// barreira roda com decimal; no caminho de medicamento o decimal é dose e fica de fora
const D = t => { const d = _bmDiscrim(t, true); return { cal: [...d.cal].sort(), vias: [...d.vias].sort(), med: [...d.med].sort() }; };

// ══════════ A LEITURA DOS TRES TIPOS DE NUMERO ══════════
{
  ok('1. "N 15" e calibre 15', D('LAMINA BISTURI N 15').cal.join() === '15', D('LAMINA BISTURI N 15'));
  ok('2. "N.23" tambem', D('LAMINA BISTURI N.23 ACO CARBONO CX100').cal.join() === '23', D('LAMINA BISTURI N.23 ACO CARBONO CX100'));
  ok('3. "18G" e calibre 18', D('CATETER EPIDURAL 18G PORTEX').cal.join() === '18');
  ok('4. *** "24/3 VIAS" e calibre 24 COM 3 vias ***',
    D('SONDA DE FOLEY 24/3 VIAS SOLIDOR').cal.join() === '24' && D('SONDA DE FOLEY 24/3 VIAS SOLIDOR').vias.join() === '3',
    D('SONDA DE FOLEY 24/3 VIAS SOLIDOR'));
  ok('5. "2 VIAS N.14" e calibre 14 com 2 vias',
    D('SONDA DE FOLEY 2 VIAS N.14 BL.30ML CX10').cal.join() === '14' && D('SONDA DE FOLEY 2 VIAS N.14 BL.30ML CX10').vias.join() === '2',
    D('SONDA DE FOLEY 2 VIAS N.14 BL.30ML CX10'));
  ok('6. "50X70" e uma medida, nao dois calibres', D('PAPEL LENCOL 50X70 100% CELULOSE').med.join() === '50x70');
  ok('7. *** a unidade nao conta na medida: 50CMX50MT == 50x50 ***',
    D('PAPEL LENCOL 100% CEL. 50CMX50MT').med.join() === '50x50', D('PAPEL LENCOL 100% CEL. 50CMX50MT'));
  ok('8. "7,5 X 7,5" da gaze le com virgula decimal', D('GAZES NAO ESTERIL 7,5 X 7,5').med.join() === '7.5x7.5');
}

// ══════════ CASO 1 — SONDA DE FOLEY ══════════
{
  const f14 = R('SONDA DE FOLEY 2 VIAS N.14 BL.30ML CX10', 2.12);
  const f24 = R('SONDA DE FOLEY 3 VIAS N.24 BL.30ML CX10', 8.90);
  ok('9. *** FOLEY 24/3 VIAS nao casa a de 2 VIAS N.14 ***',
    busca([f14], 'SONDA DE FOLEY 24/3 VIAS SOLIDOR') === null,
    nome(busca([f14], 'SONDA DE FOLEY 24/3 VIAS SOLIDOR')));
  ok('10. e casa a de 3 VIAS N.24 quando ela existe',
    nome(busca([f14, f24], 'SONDA DE FOLEY 24/3 VIAS SOLIDOR')) === f24.produto,
    nome(busca([f14, f24], 'SONDA DE FOLEY 24/3 VIAS SOLIDOR')));
  ok('11. *** e o pedido de 14/2 continua casando a de 14 (a barreira nao virou parede) ***',
    nome(busca([f14, f24], 'SONDA DE FOLEY 14/2 VIAS SOLIDOR')) === f14.produto);
  ok('12. mesmo calibre e vias diferentes tambem barra',
    busca([R('SONDA DE FOLEY 2 VIAS N.24 CX10', 5)], 'SONDA DE FOLEY 24/3 VIAS SOLIDOR') === null);
}

// ══════════ CASO 2 — LAMINA DE BISTURI ══════════
{
  const l23 = R('LAMINA BISTURI N.23 ACO CARBONO CX100', 0.26);
  const l15 = R('LAMINA BISTURI N.15 ACO CARBONO CX100', 0.26);
  ok('13. *** LAMINA N 15 nao casa a N.23 ***', busca([l23], 'LAMINA BISTURI N 15') === null,
    nome(busca([l23], 'LAMINA BISTURI N 15')));
  ok('14. e casa a N.15 quando existe', nome(busca([l23, l15], 'LAMINA BISTURI N 15')) === l15.produto);
  ok('15. a N 23 continua casando a N.23', nome(busca([l23, l15], 'LAMINA BISTURI N 23')) === l23.produto);
}

// ══════════ CASO 3 — PAPEL LENCOL ══════════
{
  const p50 = R('PAPEL LENCOL 100% CEL. (PREMIUM) 50CMX50MT', 9.92);
  const p70 = R('PAPEL LENCOL 100% CEL. (PREMIUM) 50CMX70MT', 13.50);
  ok('16. *** LENCOL 50X70 nao casa o 50CMX50MT ***',
    busca([p50], 'PAPEL LENCOL 50X70 100% CELULOSE') === null,
    nome(busca([p50], 'PAPEL LENCOL 50X70 100% CELULOSE')));
  ok('17. e casa o de 50x70 quando existe',
    nome(busca([p50, p70], 'PAPEL LENCOL 50X70 100% CELULOSE')) === p70.produto);
  ok('18. o 50X50 continua casando o 50CMX50MT (a unidade nao atrapalha)',
    nome(busca([p50, p70], 'PAPEL LENCOL 50X50 100% CELULOSE')) === p50.produto);
}

// ══════════ CASO 4 — O DRENO (o que o de-para de palavra abriu) ══════════
{
  ctx.setDic(new Map([['suctor', 'succao']]));
  const d48 = R('DRENO SUCCAO 600ML CANULA 4,8 = 3/16 BIOVAC BIONAL', 40.00);
  const d64 = R('DRENO SUCCAO 600ML CANULA 6,4 = 1/4 BIOVAC BIONAL', 38.14);
  const d32 = R('DRENO SUCCAO 500ML CANULA 3,2 = 1/8 EZ-SUC CREMER', 44.77);
  const todos = [d48, d64, d32];
  ok('19. *** DRENO SUCTOR 4.8 casa a canula 4,8 (nao a 6,4, que e mais barata) ***',
    nome(busca(todos, 'DRENO SUCTOR 4.8')) === d48.produto, nome(busca(todos, 'DRENO SUCTOR 4.8')));
  ok('20. *** DRENO SUCTOR 3.2 casa a canula 3,2 ***',
    nome(busca(todos, 'DRENO SUCTOR 3.2')) === d32.produto, nome(busca(todos, 'DRENO SUCTOR 3.2')));
  ok('21. *** DRENO SUCTOR 6.4 casa a canula 6,4 ***',
    nome(busca(todos, 'DRENO SUCTOR 6.4')) === d64.produto, nome(busca(todos, 'DRENO SUCTOR 6.4')));
  ok('22. *** os tres NAO caem todos na mesma linha (era exatamente o bug) ***',
    new Set([nome(busca(todos, 'DRENO SUCTOR 4.8')), nome(busca(todos, 'DRENO SUCTOR 3.2')),
             nome(busca(todos, 'DRENO SUCTOR 6.4'))]).size === 3);
  ok('23. e sem a canula pedida no banco, fica SEM MATCH em vez de pegar outra',
    busca([d64], 'DRENO SUCTOR 4.8') === null);
}

// ══════════ QUEM NAO DECLARA NAO VOTA (a barreira e dos DOIS lados) ══════════
// Igual a todas as outras barreiras da casa: numero so barra contra numero.
{
  ok('24. *** candidato sem calibre declarado nao e barrado por um pedido com calibre ***',
    _bmDiscrimConflito('LAMINA BISTURI N 15', 'LAMINA DE BISTURI ACO CARBONO CX100') === false);
  ok('25. e pedido sem calibre nao e barrado por candidato com calibre',
    _bmDiscrimConflito('LAMINA BISTURI', 'LAMINA BISTURI N.23 ACO CARBONO CX100') === false);
  ok('26. *** calibre nao conversa com numero de vias (3 VIAS nao barra calibre 3) ***',
    _bmDiscrimConflito('SONDA FOLEY 3 VIAS', 'SONDA FOLEY N.3 2 VIAS') === true
    && _bmDiscrimConflito('SONDA FOLEY 3 VIAS', 'SONDA FOLEY N.14 3 VIAS') === false);
  ok('27. e medida nao conversa com calibre',
    _bmDiscrimConflito('PAPEL LENCOL 50X70', 'LAMINA N.50') === false);
}

// ══════════ O QUE NAO PODE QUEBRAR ══════════
// A barreira mexe em MATERIAL, que e metade do pedido cirurgico. Estes casavam antes e continuam.
{
  ok('28. SONDA URETRAL N 8 casa a N. 08 (zero a esquerda nao atrapalha)',
    nome(busca([R('SONDA URETRAL N. 08 BIOFARMACEUTICA', 0.54)], 'SONDA URETRAL N 8 EMBRAMED'))
    === 'SONDA URETRAL N. 08 BIOFARMACEUTICA');
  ok('29. *** SONDA URETRAL N 8 NAO casa a N.10 ***',
    busca([R('SONDA URETRAL N.10 PCT50', 0.50)], 'SONDA URETRAL N 8 EMBRAMED') === null);
  ok('30. GAZE 7,5 X 7,5 casa a 7,5x7,5',
    nome(busca([R('COMPR GAZ 7,5x7,5 11 FIOS C/500 PREMIUM', 0.07)], 'GAZES NAO ESTERIL 7,5 X 7,5 PACOTE COM 500'))
    === 'COMPR GAZ 7,5x7,5 11 FIOS C/500 PREMIUM');
  ok('31. TUBO ENDOTRAQUEAL 7,0 casa o N7 (o pack CX10 nao vira calibre)',
    nome(busca([R('TUBO ENDOTRAQUEAL C/BL N7 CX10', 1.32)], 'TUBO ENDOTRAQUEAL 7,0 COM BALAO SOLIDOR'))
    === 'TUBO ENDOTRAQUEAL C/BL N7 CX10');
  ok('32. CATETER PERIDURAL N 18 casa o EPIDURAL 18G (calibre igual, palavra diferente)',
    _bmDiscrimConflito('CATETER PERIDURAL N 18', 'CATETER EPIDURAL 18G PORTEX') === false);
  ok('33. *** e NAO casa o EPIDURAL 16G ***',
    _bmDiscrimConflito('CATETER PERIDURAL N 18', 'CATETER EPIDURAL 16G PORTEX') === true);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
