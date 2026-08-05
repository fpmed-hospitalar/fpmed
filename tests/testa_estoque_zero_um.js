// SUITE testa_estoque_zero_um — A REGRA "ESTOQUE 0 VIRA 1" TEM QUE VALER NO FLUXO, NAO SO NO SEED.
//
// A REGRA (decisao do Lemuel, 04/08/2026): item que vier com estoque 0 no relatorio entra ou
// atualiza com estoque = 1.
// POR QUE: com estoque 0 o item some da Competitividade e das Vendas Ativas — e junto some o
// HISTORICO DE PRECO dele, que e justamente o que permite comparar depois. Com 1 ele fica
// visivel na comparacao sem fingir que ha saldo relevante.
//
// O QUE ESTA SUITE GUARDA: a regra foi aplicada em 04/08 como CORRECAO DE DADO (781 linhas).
// Sem valer no FLUXO, o proximo relatorio de estoque desfazia tudo silenciosamente — os 781
// voltavam a 0 no primeiro import. E o tipo de regressao que ninguem ve acontecer.
//
//   node tests/testa_estoque_zero_um.js
const fs = require('fs'), path = require('path');
const { estoqueGravar } = require('../tools/le_estoque_fpmed.js');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_estoque_zero_um — a regra 0->1 no fluxo\n');

// ══════════ 1. O NUCLEO DA REGRA ══════════
ok('1. *** 0 vira 1 ***', estoqueGravar(0) === 1, estoqueGravar(0));
ok('2. "0" como texto tambem', estoqueGravar('0') === 1, estoqueGravar('0'));
ok('3. saldo positivo passa intacto', estoqueGravar(37) === 37);
ok('4. 1 continua 1 (nao dobra)', estoqueGravar(1) === 1);

// ══════════ 2. NEGATIVO — erro de inventario, nao "menos que zero de item" ══════════
// Aparece em relatorio de ERP quando a baixa foi lancada antes da entrada. Deixar negativo
// esconde o item igual ao zero, e ainda quebra qualquer soma de saldo.
ok('5. -3 vira 1, nao fica negativo', estoqueGravar(-3) === 1, estoqueGravar(-3));
ok('6. -0,5 vira 1', estoqueGravar(-0.5) === 1);

// ══════════ 3. "NAO INFORMADO" ≠ "INFORMOU ZERO" ══════════
// Esta e a distincao que impede a regra de virar um 1 solto. Coluna de estoque ausente na
// planilha nao autoriza afirmar saldo nenhum: devolve null e quem grava decide (o campo fica
// intacto no banco em vez de virar 1 por otimismo).
ok('7. null continua null (nao vira 1)', estoqueGravar(null) === null, estoqueGravar(null));
ok('8. undefined continua null', estoqueGravar(undefined) === null);
ok('9. string vazia continua null', estoqueGravar('') === null);
ok('10. texto nao numerico continua null', estoqueGravar('n/d') === null, estoqueGravar('n/d'));

// ══════════ 4. FRACIONARIO ══════════
// Estoque e contagem de itens. 2,7 caixas nao existe; o ERP as vezes manda por causa de
// conversao de unidade. Trunca, e nunca arredonda pra cima (inventar saldo e pior).
ok('11. 2,7 vira 2 (trunca, nao arredonda pra cima)', estoqueGravar(2.7) === 2, estoqueGravar(2.7));
ok('12. 0,4 vira 1 (e <= 0? nao; mas trunca daria 0, que a regra proibe)', estoqueGravar(0.4) === 1, estoqueGravar(0.4));

// ══════════ 5. A REGRA ESTA MESMO NA TELA (nao so no tool) ══════════
// O caminho que o Lemuel usa de verdade e a tela Atualizar Estoque, nao o tool. Aqui a suite
// le o proprio HTML e prova que a aplicacao esta la, DEPOIS dos dois parsers (formato novo e
// antigo) — num ponto so. Se ficasse dentro de cada parser, o dia em que entrar um terceiro
// formato a regra escapa sem ninguem notar.
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');
  ok('13. *** a tela Atualizar Estoque aplica a regra ***',
    /if \(p\.estoque === 0\) \{ p\.estoque = 1;/.test(src));
  ok('14. ...e conta quantos foram, pra mostrar no preview', src.includes('egZeroVirou1'));
  ok('15. ...e o preview EXIBE o numero (regra silenciosa e regra que ninguem confere)',
    src.includes('vieram com 0 e entram com 1'));
  // a aplicacao tem que vir DEPOIS do push dos dois parsers e ANTES da gravacao
  const iPush   = src.lastIndexOf('egProdutos.push({ codigo, produto: nome');
  const iRegra  = src.indexOf('p._zeroVirou1 = true');
  const iGravar = src.indexOf('async function egExecutarReal');
  ok('16. a regra roda depois do parse e antes da gravacao', iPush > 0 && iRegra > iPush && iGravar > iRegra,
    { iPush, iRegra, iGravar });
}

// ══════════ 6. O QUE A REGRA NAO PODE TOCAR: a zeragem de AUSENTES ══════════
// A tela tem um passo separado que zera itens que NAO vieram no relatorio — o operador marca
// item por item e confirma num dialogo que diz "vai ZERAR". Transformar aquilo em 1 faria a
// tela mentir sobre o que acabou de fazer. A regra e sobre o que VEM no relatorio.
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');
  ok('17. a zeragem de ausentes continua gravando 0 de verdade', src.includes("{ estoque: 0 }"));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
