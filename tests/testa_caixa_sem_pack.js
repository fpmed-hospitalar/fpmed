// SUITE testa_caixa_sem_pack — PRECO DE CAIXA NAO PODE VIRAR PRECO UNITARIO NO ESCURO.
//
// O CASO REAL (bug #3 da proposta 68036): LEVOFLOXACINO 5MG/ML 100ML saiu a R$622,66 A BOLSA.
// A linha do banco (MCW) tem compra_unit NULL e compra_caixa R$471,71; 471,71 x 1,32 = 622,66.
// O pv() dividia pela "quantidade da embalagem", que era 1 — mas esse 1 nao era "a caixa tem uma
// unidade", era "nao consegui achar o pack". A MESMA MCW vende a mesma bolsa a R$8,58 numa linha
// cujo nome nao foi truncado ("...100ML CX/60BLS", pack 60).
//
// CAUSA DE ORIGEM: a descricao da MCW e cortada em 50 caracteres e o pack fica no FIM do nome.
// O importador JA decide certo (deixa compra_unit NULL de proposito, "chutar pack vira preco
// unitario errado no orcamento") — o pv() e que desfazia essa abstencao.
// MEDIDO NO BANCO: 574 linhas nessa situacao, 118 com preco >3x a mediana de >=3 concorrentes do
// mesmo PA, a pior 1.144x.
//   node tests/testa_caixa_sem_pack.js
const fs = require('fs'), path = require('path');
const lines = fs.readFileSync(path.join(__dirname, '..', 'fpmed_giovana.html'), 'utf8').split(/\r?\n/);
function block(a, b) {
  const s = lines.findIndex(l => l.includes(a));
  let e = -1; for (let i = s + 1; i < lines.length; i++) { if (lines[i].includes(b)) { e = i; break; } }
  return lines.slice(s, e).join('\n');
}
const ctx = (new Function('let cotacoes=[];let _bmCmed=new Map();let _bmClasseB=new Set();console.warn=function(){};\n'
  + block('function _undNum(und)', 'let searchTO') + '\n'
  + block('const _bmStrip = s =>', '/* ─── busca antiga') + '\n'
  + 'return { api:{ pv, incluiNaBusca, qtdEmbalagem, _packDeclarado, buscarMelhorProduto }, setCot:function(a){cotacoes=a;} };'))();
const { pv, incluiNaBusca, qtdEmbalagem, _packDeclarado, buscarMelhorProduto } = ctx.api;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e != null ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_caixa_sem_pack — preco de caixa x preco unitario\n');

const R = (o) => Object.assign({ produto: '', principio_ativo: '', und: null, compra_unit: null,
  compra_caixa: null, global_venda1: null, tipo: 'fornecedor', fornecedor: 'MCW', estoque: null }, o);

// ══════════ A LINHA EXATA DA 68036 ══════════
{
  const ruim = R({ produto: 'LEVOFLOXACINO 5MG/ML INJ 100ML HALEX ISTAR/ISOFARM', compra_caixa: 471.7117 });
  ok('1. o nome truncado nao tem pack: qtdEmbalagem cai no 1 (que aqui significa "nao sei")',
    qtdEmbalagem(ruim.und, ruim.produto) === 1, qtdEmbalagem(ruim.und, ruim.produto));
  ok('2. *** ela NAO pode mais valer R$622,66 a bolsa ***', pv(ruim) !== 622.66, pv(ruim));
  ok('3. *** sem pack nao ha preco unitario: pv = 0 ***', pv(ruim) === 0, pv(ruim));
  ok('4. *** e por isso ela sai da busca, em vez de entrar com numero inventado ***',
    incluiNaBusca(ruim) === false);

  // as irmas com o pack visivel continuam valendo, com o preco certo
  const boa = R({ produto: 'LEVOFLOXACINO 5MG/ML 100ML CX/60BLS', und: 'CX', compra_unit: 6.5, compra_caixa: 390 });
  ok('5. a linha com pack 60 e compra_unit continua valendo R$8,58',
    Math.abs(pv(boa) - 8.58) < 0.01, pv(boa));
  const so_caixa_com_pack = R({ produto: 'LEVOFLOXACINO 5MG/ML 150ML GENERICO EUROFARMA CX20', compra_caixa: 304.6023 });
  ok('6. *** so caixa MAS com pack no nome (CX20) continua dividindo certo ***',
    Math.abs(pv(so_caixa_com_pack) - (304.6023 / 20 * 1.32)) < 0.01, pv(so_caixa_com_pack));
  ok('7. e essa continua na busca (o pack e sabido, nao chutado)', incluiNaBusca(so_caixa_com_pack) === true);
}

// ══════════ "NAO SEI" x "SEI QUE E 1" ══════════
// Embalagem unitaria DECLARADA no campo und ("FR1", "CX1", "UN1") e informacao. Silencio nao e.
{
  ok('8. und "CX1" e uma declaracao de embalagem', _packDeclarado(R({ und: 'CX1' })) === true);
  ok('9. und "FR 1" tambem', _packDeclarado(R({ und: 'FR 1' })) === true);
  ok('10. *** und vazio/null NAO e declaracao — e silencio ***',
    _packDeclarado(R({ und: null })) === false && _packDeclarado(R({ und: '' })) === false
    && _packDeclarado(R({ und: 'CX' })) === false);
  const decl = R({ produto: 'PRODUTO AVULSO SEM PACK NO NOME', und: 'FR1', compra_caixa: 12.5 });
  ok('11. *** com o pack 1 DECLARADO, o preco da caixa E o unitario: R$16,50 ***',
    Math.abs(pv(decl) - 16.5) < 0.01, pv(decl));
  ok('12. e ela entra na busca normalmente', incluiNaBusca(decl) === true);
}

// ══════════ O QUE NAO PODE MUDAR ══════════
{
  ok('13. quem tem compra_unit nao passa nem perto desta regra',
    Math.abs(pv(R({ produto: 'X SEM PACK NENHUM', compra_unit: 10 })) - 13.2) < 0.001);
  ok('14. GLOBAL (estoque proprio) segue pelo global_venda1, nao por compra_caixa',
    Math.abs(pv(R({ produto: 'X CX10 CPR', fornecedor: '1', tipo: 'global', global_venda1: 100, estoque: 5 })) - 10) < 0.001);
  ok('15. e sem preco nenhum continua 0', pv(R({ produto: 'X' })) === 0);
}

// ══════════ NO CAMINHO DA BUSCA ══════════
// O que importa de verdade: a linha sem pack nao pode ser oferecida ao cliente.
{
  const cot = [
    R({ produto: 'LEVOFLOXACINO 5MG/ML INJ 100ML HALEX ISTAR/ISOFARM', principio_ativo: 'LEVOFLOXACINO', compra_caixa: 471.7117 }),
    R({ produto: 'LEVOFLOXACINO 5MG/ML 100ML CX/60BLS', principio_ativo: 'LEVOFLOXACINO', und: 'CX', compra_unit: 6.5, compra_caixa: 390 }),
  ].filter(incluiNaBusca);
  ok('16. *** a linha de R$622,66 nem chega a entrar no banco de busca ***', cot.length === 1, cot.map(c => c.produto));
  ctx.setCot(cot);
  const r = buscarMelhorProduto('LEVOFLOXACINO 5MG/ML 100ML');
  ok('17. *** e a busca devolve a bolsa a R$8,58, nao a R$622,66 ***',
    r && Math.abs(pv(r) - 8.58) < 0.01, r ? [r.produto, pv(r)] : null);

  // sozinha, ela nao vira "a melhor opcao por falta de concorrente"
  ctx.setCot([R({ produto: 'LEVOFLOXACINO 5MG/ML INJ 100ML HALEX ISTAR/ISOFARM', principio_ativo: 'LEVOFLOXACINO', compra_caixa: 471.7117 })].filter(incluiNaBusca));
  ok('18. *** sem concorrente, o item vira "nao encontrado" — e vai pra fila de cotacao, que e o certo ***',
    buscarMelhorProduto('LEVOFLOXACINO 5MG/ML 100ML') === null);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
