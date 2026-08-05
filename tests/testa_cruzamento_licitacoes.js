// SUITE testa_cruzamento_licitacoes — o CRUZAMENTO POR ITEM da tela de Licitações.
// Extrai as funções REAIS do fpmed_licitacoes.html (não recopia) e roda contra fixtures tiradas
// de dado de verdade: itens de editais do PNCP de 03/08/2026 (GO) e linhas do estoque FPMED.
// Cada assert aqui trava um erro que foi MEDIDO na construção — não é teste decorativo.
//   node tests/testa_cruzamento_licitacoes.js
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8');

function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora sumiu do HTML: ' + ini);
  return src.slice(s, e);
}
const ctx = (new Function(
  bloco('const semAcento =', 'const ymd =') +
  bloco('// ══ PACK', '// ══ MATCHING') +
  bloco('const STOP =', '// ADERÊNCIA:') +
  bloco('function numCompra', '\n\n// ══ ESTOQUE') +
  'return { qtdEmbalagem, unitarioNosso, unitarioEdital, unidadePack, doses, termos,' +
  '         indexaEstoque, cruzaItem, numCompra };'))();
const { qtdEmbalagem, unitarioNosso, unitarioEdital, unidadePack, doses,
        indexaEstoque, cruzaItem, numCompra } = ctx;

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? ' [' + JSON.stringify(got) + ']' : '')); } };
const perto = (a, b) => Math.abs(a - b) < 0.0001;
console.log('SUITE testa_cruzamento_licitacoes — pack, unitario e matching\n');

// ══ 1. PACK DO EDITAL (unidadeMedida) ═════════════════════════════════════════════════════
// Valores reais vistos na consulta de GO: "Caixa 100 UN", "Frasco 1000 ML", "Galão 5 L"...
ok('"Caixa 100 UN" -> pack 100',        unidadePack('Caixa 100 UN') === 100, unidadePack('Caixa 100 UN'));
ok('"Embalagem 10 UN" -> pack 10',      unidadePack('Embalagem 10 UN') === 10);
ok('"Unidade" -> pack 1',               unidadePack('Unidade') === 1);
ok('"UN" -> pack 1',                    unidadePack('UN') === 1);
// MEDIDA nao e contagem: 1000 ML e o volume de UM frasco, nao 1000 frascos.
ok('"Frasco 1000 ML" -> pack 1 (medida)', unidadePack('Frasco 1000 ML') === 1, unidadePack('Frasco 1000 ML'));
ok('"Galão 5 L" -> pack 1 (medida)',    unidadePack('Galão 5 L') === 1, unidadePack('Galão 5 L'));
ok('"Embalagem 500 G" -> pack 1',       unidadePack('Embalagem 500 G') === 1, unidadePack('Embalagem 500 G'));
ok('"Rolo 2 M" -> pack 1',              unidadePack('Rolo 2 M') === 1);
// Agregador SEM numero: nao da pra unitarizar -> null (a tela mostra "conferir emb.")
ok('"Caixa" sem numero -> null',        unidadePack('Caixa') === null, unidadePack('Caixa'));
ok('"PCT" sem numero -> null',          unidadePack('PCT') === null, unidadePack('PCT'));
ok('vazio -> 1',                        unidadePack('') === 1);

// ══ 2. UNITARIO DO EDITAL ═════════════════════════════════════════════════════════════════
// Caso real: agulha hipodermica 22G, Caixa 100 UN, R$ 8,20 -> R$ 0,082 por agulha.
const ag = unitarioEdital({ valorUnitarioEstimado: 8.20, unidadeMedida: 'Caixa 100 UN' });
ok('agulha cx100 R$8,20 -> unitario 0,082', ag.status === 'ok' && perto(ag.valor, 0.082), ag);
ok('agulha guarda o pack 100',              ag.pack === 100);
// Orcamento sigiloso: o PNCP manda valorUnitarioEstimado=0. Nunca mostrar isso como R$ 0,00.
const sig = unitarioEdital({ valorUnitarioEstimado: 0, unidadeMedida: 'Unidade', orcamentoSigiloso: true });
ok('orcamento sigiloso nao vira R$ 0,00',   sig.status === 'sigiloso', sig);
const pct = unitarioEdital({ valorUnitarioEstimado: 5.77, unidadeMedida: 'PCT' });
ok('PCT sem contagem -> conferir emb.',     pct.status === 'conferir' && pct.bruto === 5.77, pct);
ok('conferir NAO devolve valor unitario',   pct.valor === undefined, pct);

// ══ 3. UNITARIO DO NOSSO ESTOQUE ══════════════════════════════════════════════════════════
// global_venda1 e preco de CAIXA; a divisao pelo pack acontece SO na tela.
const luva = unitarioNosso({ produto: 'LUVA P/ PROCEDIMENTO LATEX TAM. P COM PO C/100 UND', und: 'CX', global_venda1: 20.91 });
ok('luva cx100 R$20,91 -> 0,2091/un', luva.status === 'ok' && perto(luva.valor, 0.2091) && luva.pack === 100, luva);
const amp = unitarioNosso({ produto: 'DIPIRONA 500MG/ML IV/IM 2ML', und: 'AMP', global_venda1: 0.42 });
ok('und AMP sem contagem -> ja e unitario', amp.status === 'ok' && perto(amp.valor, 0.42) && amp.pack === 1, amp);
const cxCega = unitarioNosso({ produto: 'CABO PARA BISTURI DUPLO 3 E 4', und: 'CX', global_venda1: 30 });
ok('und CX sem contagem -> conferir emb.',  cxCega.status === 'conferir', cxCega);
const semUnd = unitarioNosso({ produto: 'PRODUTO QUALQUER SEM PACK', und: null, global_venda1: 99 });
ok('und NULL sem contagem -> conferir',     semUnd.status === 'conferir', semUnd);
ok('sem preco -> sem-preco',                unitarioNosso({ produto: 'X', und: 'CX', global_venda1: 0 }).status === 'sem-preco');

// ── CALIBRE FRENCH x PACK (bug MEDIDO em 03/08: dividia o preco da sonda pelo calibre) ──
ok('sonda 22FR: calibre nao e pack',        qtdEmbalagem('CX', 'SONDA URETRAL DESC 22FR') === 1, qtdEmbalagem('CX', 'SONDA URETRAL DESC 22FR'));
ok('sonda 20FR C/50: le o pack DE VERDADE', qtdEmbalagem('CX', 'SONDA URETRAL DESC 20FR C/50') === 50, qtdEmbalagem('CX', 'SONDA URETRAL DESC 20FR C/50'));
ok('cateter 14FR: calibre nao e pack',      qtdEmbalagem('CX', 'CATETER NASAL TIPO OCULOS 14FR') === 1);
// A guarda vale SO pra classe de calibre: no soro, "16FR" e 16 frascos mesmo.
ok('soro 16FR: 16 frascos, pack preservado', qtdEmbalagem('CX', 'SORO FISIOLOGICO 0,9% 500ML S/F 16FR') === 16, qtdEmbalagem('CX', 'SORO FISIOLOGICO 0,9% 500ML S/F 16FR'));
const sonda = unitarioNosso({ produto: 'SONDA NUTRICAO ENTERAL GASTROSTOMIA SILICONE 22FR WELL', und: 'CX', global_venda1: 47.10 });
ok('sonda de calibre sem pack -> conferir', sonda.status === 'conferir', sonda);

// ══ 4. DOSES (o discriminador) ════════════════════════════════════════════════════════════
const d1 = doses('DIPIRONA 500MG/ML IV/IM 2ML');
ok('le 500mg/ml e 2ml',              d1.has('500mg/ml') && d1.has('2ml'), [...d1]);
ok('zero a esquerda normaliza (03ML->3ml)', doses('SERINGA DESC 03ML').has('3ml'), [...doses('SERINGA DESC 03ML')]);
ok('gauge colado "22GX1" vira 22g',  doses('AGULHA 25X,7 (22GX1) C/100').has('22g'), [...doses('AGULHA 25X,7 (22GX1) C/100')]);
ok('gauge separado "23 g x 1" vira 23g', doses('dimensão: 23 g x 1"').has('23g'), [...doses('dimensão: 23 g x 1"')]);
// CATMAT escreve "capacidade: 3" onde o nosso nome escreve "3ML".
ok('"capacidade: 3" vira 3ml',       doses('Seringa, capacidade: 3, tipo bico').has('3ml'), [...doses('Seringa, capacidade: 3, tipo bico')]);
ok('"capacidade: 100 litros" NAO vira 100ml', !doses('Bebedouro capacidade: 100 litros').has('100ml'), [...doses('Bebedouro capacidade: 100 litros')]);

// ══ 5. MATCHING ═══════════════════════════════════════════════════════════════════════════
// Estoque de teste: linhas REAIS da FPMED (produto/und/preco conferidos no banco em 04/08).
const ESTOQUE = [
  { produto:'SERINGA 3ML SLIP BICO CEN 1000UND',            principio_ativo:null,       und:'CX', global_venda1:295.10 },
  { produto:'SERINGA DESC. 60ML S/AG. LUER LOCK C/50',      principio_ativo:null,       und:'CX', global_venda1:109.61 },
  { produto:'AGULHA 25X,7 (22GX1) C/100',                   principio_ativo:null,       und:'CX', global_venda1:9.06  },
  { produto:'ABAIXADOR DE LINGUA MADEIRA 100UND',           principio_ativo:null,       und:'CX', global_venda1:4.94  },
  { produto:'APARELHO DE BARBEAR MAXICOR PLUS 2 LAM. C/5',  principio_ativo:null,       und:'CX', global_venda1:4.29  },
  { produto:'TELA CIR. DE POLIPROPILENO 15X15CM',           principio_ativo:null,       und:'UND',global_venda1:26.93 },
  { produto:'SACO DE LIXO INFECTANTE 50 LT C/100',          principio_ativo:null,       und:'CX', global_venda1:21.52 },
  { produto:'DIPIRONA 500MG/ML IV/IM 2ML',                  principio_ativo:'DIPIRONA', und:'AMP',global_venda1:0.42  },
  { produto:'DIPIRONA 500MG 200CPR (G)',                    principio_ativo:'DIPIRONA', und:'CX', global_venda1:43.77 },
  { produto:'ATENSINA 0,100MG 30CPR MAWDSLEYS',             principio_ativo:'CLORIDRATO DE CLONIDINA', und:'CX', global_venda1:10.50 },
  { produto:'ACETILCISTEINA XPE ADL 20MG 120ML 48 FR (CYSTEIN)', principio_ativo:'ACETILCISTEINA', und:'CX', global_venda1:327.31 },
  { produto:'ACEBROFILINA 50MG/5ML XPE ADL 120ML (G)',      principio_ativo:'ACEBROFILINA', und:'CX', global_venda1:8.70 },
];
indexaEstoque(ESTOQUE);
const nomes = it => cruzaItem(it, 5).map(x => x.c.produto);
const conf  = (it, nome) => (cruzaItem(it, 5).find(x => x.c.produto === nome) || {}).conf;

// ── casa o que TEM que casar ──
const itSeringa3 = { descricao:'Seringa material: polipropileno, capacidade: 3, tipo bico: bico central luer lock ou slip, esterilidade: estéril, descartável' };
ok('seringa 3ml casa com a nossa de 3ML',  nomes(itSeringa3).includes('SERINGA 3ML SLIP BICO CEN 1000UND'), nomes(itSeringa3));
ok('e casa com confianca ALTA (dose bate)', conf(itSeringa3,'SERINGA 3ML SLIP BICO CEN 1000UND') === 'alta', conf(itSeringa3,'SERINGA 3ML SLIP BICO CEN 1000UND'));
// A de 60 ML NAO pode entrar num item de 3 ml: era o falso positivo do "capacidade" sem unidade.
ok('seringa de 60ML fica FORA do item de 3ml', !nomes(itSeringa3).includes('SERINGA DESC. 60ML S/AG. LUER LOCK C/50'), nomes(itSeringa3));

const itAbaixador = { descricao:'ABAIXADOR DE LINGUA: Em madeira; Descartável; Formato convencional liso' };
ok('abaixador de lingua casa',             nomes(itAbaixador).includes('ABAIXADOR DE LINGUA MADEIRA 100UND'), nomes(itAbaixador));

const itDipirona = { descricao:'Dipirona sódica, 500 mg/ml, solução injetável, ampola 2 ml' };
ok('dipirona injetavel casa pelo PA+dose', nomes(itDipirona).includes('DIPIRONA 500MG/ML IV/IM 2ML'), nomes(itDipirona));
ok('dipirona injetavel: confianca ALTA',   conf(itDipirona,'DIPIRONA 500MG/ML IV/IM 2ML') === 'alta');
// mesmo PA, dose diferente (500mg comprimido x 500mg/ml injetavel) nao pode virar o mesmo item
ok('dipirona 500MG comprimido fica FORA do injetavel 500MG/ML',
   !nomes(itDipirona).includes('DIPIRONA 500MG 200CPR (G)'), nomes(itDipirona));

// MARCA nossa x GENERICO do edital: so casa porque o principio_ativo entra como ancora.
const itClonidina = { descricao:'Clonidina, cloridrato 0,100 mg, comprimido' };
ok('marca ATENSINA casa pelo PA clonidina', nomes(itClonidina).includes('ATENSINA 0,100MG 30CPR MAWDSLEYS'), nomes(itClonidina));

// ── NAO casa o que nao pode casar (falsos positivos MEDIDOS em 03/08) ──
const itAr = { descricao:'APARELHO DE AR CONDICIONADO 12.000 BTUS - INVERTER, Especificações Técnicas: Tipo do Produto' };
ok('ar condicionado NAO casa com aparelho de barbear', nomes(itAr).length === 0, nomes(itAr));

const itCadeira = { descricao:'ENCOSTO CADEIRA PRESIDENTE TELA MESH GIRATORIA REVESTIMENTO TELA MESH' };
ok('cadeira com TELA mesh NAO casa com TELA cirurgica', nomes(itCadeira).length === 0, nomes(itCadeira));

const itAdubo = { descricao:'ADUBO 04-14-08 SACO 50 KG' };
ok('SACO de adubo NAO casa com SACO de lixo', nomes(itAdubo).length === 0, nomes(itAdubo));

const itAgulha23 = { descricao:'Agulha Hipodérmica material: aço inoxidável siliconizado, dimensão: 23 g x 1", tipo ponta: bisel curto trifacetado' };
ok('agulha 23G NAO casa com a nossa 22G', nomes(itAgulha23).length === 0, nomes(itAgulha23));
const itAgulha22 = { descricao:'Agulha Hipodérmica material: aço inoxidável siliconizado, dimensão: 22 g x 1", tipo ponta: bisel curto trifacetado' };
ok('agulha 22G CASA com a nossa 22G',     nomes(itAgulha22).includes('AGULHA 25X,7 (22GX1) C/100'), nomes(itAgulha22));

// ── CONCENTRACAO x VOLUME (defeito visto NO AR em 05/08, no card de Uruacu) ──
// "ACETILCISTEINA 40MG/ML XPE 120ML" casava com a nossa de 20MG e ainda dizia "dose confere",
// so porque os dois falam "120ML". Volume do frasco e EMBALAGEM; concentracao e IDENTIDADE.
const itAcetil20 = { descricao:'ACETILCISTEINA 20MG/ML XPE INF 120ML' };
const itAcetil40 = { descricao:'ACETILCISTEINA 40MG/ML XPE ADL 120ML' };
ok('acetilcisteina 20MG/ML CASA com a nossa de 20MG',
   nomes(itAcetil20).includes('ACETILCISTEINA XPE ADL 20MG 120ML 48 FR (CYSTEIN)'), nomes(itAcetil20));
ok('acetilcisteina 40MG/ML NAO casa com a nossa de 20MG (mesmo volume 120ML)',
   !nomes(itAcetil40).includes('ACETILCISTEINA XPE ADL 20MG 120ML 48 FR (CYSTEIN)'), nomes(itAcetil40));
const itAcebro25 = { descricao:'ACEBROFILINA XAROPE 25MG/ML PED. 120ML' };
ok('acebrofilina 25MG/ML NAO casa com a nossa 50MG/5ML (so o 120ML em comum)',
   !nomes(itAcebro25).includes('ACEBROFILINA 50MG/5ML XPE ADL 120ML (G)'), nomes(itAcebro25));

// ── FORMA FARMACEUTICA ──
ok('comprimido nao casa com injetavel (dipirona 500)',
   !nomes({ descricao:'Dipirona 500 mg comprimido' }).includes('DIPIRONA 500MG/ML IV/IM 2ML'),
   nomes({ descricao:'Dipirona 500 mg comprimido' }));
// forma desconhecida em UM dos lados nao pode rejeitar: o abaixador nao declara forma nenhuma
ok('sem forma declarada, o match sobrevive',
   nomes({ descricao:'ABAIXADOR DE LINGUA em madeira, descartavel' }).includes('ABAIXADOR DE LINGUA MADEIRA 100UND'),
   nomes({ descricao:'ABAIXADOR DE LINGUA em madeira, descartavel' }));

ok('descricao vazia nao casa nada',       cruzaItem({ descricao:'' }, 3).length === 0);
ok('descricao nula nao quebra',           cruzaItem({ descricao:null }, 3).length === 0);
ok('teto de resultados respeitado',       cruzaItem(itSeringa3, 1).length <= 1);

// ══ 6. numeroCompra ═══════════════════════════════════════════════════════════════════════
// Formatos MEDIDOS na consulta de GO de 03/08 + a regra que o Lemuel escreveu.
ok('"(6128) | 32-0/2026" -> 32/2026', numCompra('(6128) | 32-0/2026', 2026) === '32/2026', numCompra('(6128) | 32-0/2026', 2026));
ok('"(20410) | 33-0" -> 33/2026',     numCompra('(20410) | 33-0', 2026) === '33/2026', numCompra('(20410) | 33-0', 2026));
ok('"90" -> 90/2026',                 numCompra('90', 2026) === '90/2026');
ok('"040" -> 40/2026',                numCompra('040', 2026) === '40/2026', numCompra('040', 2026));
ok('"0262026" -> 26/2026 (ano colado)', numCompra('0262026', 2026) === '26/2026', numCompra('0262026', 2026));
ok('"120695" -> 120695/2026',         numCompra('120695', 2026) === '120695/2026');
ok('vazio nao quebra',                typeof numCompra('', 2026) === 'string');
ok('null nao quebra',                 typeof numCompra(null, 2026) === 'string');

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
