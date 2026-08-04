// SUITE testa_tripla_onco — A TRIPLA (PA, dose total, volume) e o DESEMPATE POR PRECO.
//
// DE ONDE VEM: o pedido de oncologia com 24 itens sem match. O pedido escreve tudo como
// "PA + dose total + concentracao + volume" ("DOCETAXEL 20MG ... 20MG/ML ... C/1ML") e o banco
// cadastra so a concentracao ("DOCETAXEL 20MG/ML F/A 1ML") — a mesma dose dita de dois jeitos.
// Produto de onco e caro (Docelibbs R$340, pemetrexede R$270), entao cada linha que escapa e
// dinheiro grande na mesa.
//
// SAO TRES REGRAS QUE SO FUNCIONAM JUNTAS, e a suite existe pra provar que nenhuma delas
// atropela as outras:
//   (1) TRIPLA — quando concentracao x volume == dose total, o total sai (e a mesma informacao
//       dita duas vezes). Tolerancia de 2%, a UNICA do sistema, e so aqui: o rotulo do paclitaxel
//       escreve "6MG/ML C/16,7ML" e 6 x 16,7 = 100,2, porque 16,7 ja e 16,666... arredondado.
//   (2) VOLUME COMO BARREIRA — sem ela, a regra (1) faz CISPLATINA 50MG/50ML e 100MG/100ML
//       virarem a mesma coisa (as duas sao 1MG/ML) e o motor oferta a apresentacao errada.
//   (3) DESEMPATE POR PRECO — mesma tripla = mesmo produto = ganha o mais barato. O score mede
//       semelhanca de TEXTO, e quem escreve o nome mais parecido com o pedido nao e quem vende
//       mais barato: era assim que a cisplatina saia a R$278,66 tendo a de R$144,79 no banco.
// AS LINHAS DE PRODUTO SAO REAIS, copiadas do banco pelo tools/diag_onco.js.
//   node tests/testa_tripla_onco.js
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
  + 'return { api:{ buscarMelhorProduto, _bmDoses, _bmMl, _bmVolume, pv, _bmFormaCand },'
  + '         setCot:function(a){cotacoes=a;} };'))();
const { buscarMelhorProduto, _bmDoses, _bmVolume, pv, _bmFormaCand } = ctx.api;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e != null ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_tripla_onco — tripla, volume e desempate por preco\n');

const R = (produto, preco, o) => Object.assign({ produto, principio_ativo: '', und: '',
  compra_unit: String(preco), global_venda1: '', tipo: 'fornecedor', fornecedor: 'MCW', estoque: '5' }, o || {});
const busca = (cot, q) => { ctx.setCot(cot); return buscarMelhorProduto(q); };
const nome = r => r ? r.produto : null;
const dz = t => [..._bmDoses(t)].sort();

// ══════════ (1) A TRIPLA: A MESMA DOSE DITA DUAS VEZES ══════════
{
  ok('1. *** "DOCETAXEL 20MG 20MG/ML C/1ML" -> uma dose so (20 x 1 = 20, o total e redundante) ***',
    dz('DOCETAXEL 20MG 20MG/ML SOLUCAO INJETAVEL C/1ML').join() === '20MG/ML',
    dz('DOCETAXEL 20MG 20MG/ML SOLUCAO INJETAVEL C/1ML'));
  ok('2. "CISPLATINA 50MG 1MG/ML C/50ML" idem (1 x 50 = 50)',
    dz('CISPLATINA 50MG 1MG/ML SOLUCAO INJETAVEL C/50ML').join() === '1MG/ML');
  ok('3. *** a tolerancia de 2%: 6MG/ML x 16,7ML = 100,2 fecha com 100MG ***',
    dz('PACLITAXEL 100MG 6MG/ML SOLUCAO INJETAVEL C/16,7ML').join() === '6MG/ML',
    dz('PACLITAXEL 100MG 6MG/ML SOLUCAO INJETAVEL C/16,7ML'));
  // >>> A GUARDA DA TOLERANCIA: divergencia de verdade NAO colapsa — as duas doses ficam no
  //     conjunto e a barreira de dose volta a rejeitar. 2% e pra arredondamento de rotulo, nao
  //     pra deixar passar pedido que se contradiz.
  ok('4. *** 6MG/ML x 16,7ML NAO fecha com 200MG: o conjunto fica com as duas doses ***',
    dz('PACLITAXEL 200MG 6MG/ML C/16,7ML').length === 2, dz('PACLITAXEL 200MG 6MG/ML C/16,7ML'));
  ok('5. e uma divergencia de 10% tambem nao colapsa',
    dz('X 110MG 10MG/ML C/10ML').length === 2, dz('X 110MG 10MG/ML C/10ML'));
  // >>> O NUMERO NUNCA PODE SAIR CORTADO NO MEIO. O _bmVolume lia "C/16,7ML" como **6,7ML**: o
  //     lookbehind barrava ML depois de "/" e de letra, mas nao depois de DIGITO — entao ele
  //     pulava o "1" (que vinha logo apos a barra) e casava a partir do "6".
  //     Volume depois de barra continua fora do _bmVolume DE PROPOSITO (limitacao antiga e
  //     conhecida: e o que impedia o FIXADOR CITOLOGICO 100ML de casar o de 500ML), e quem cobre
  //     esse formato e o _bmMl, que trabalha com CONJUNTO. O que nao se admite e numero truncado:
  //     devolver 6,7 quando esta escrito 16,7 e pior que nao devolver nada.
  ok('6. *** "C/16,7ML" NUNCA pode virar 6,7 (numero cortado no meio) ***',
    _bmVolume('PACLITAXEL 6MG/ML C/16,7ML') !== 6.7, _bmVolume('PACLITAXEL 6MG/ML C/16,7ML'));
  ok('7. *** e sem a barra na frente, le 16,7 inteiro ***',
    _bmVolume('TAXILAN 6 MG/ML CT 1 FA 16,7 ML') === 16.7, _bmVolume('TAXILAN 6 MG/ML CT 1 FA 16,7 ML'));
  // (o _bmMl guarda os volumes como STRING — a barreira de volume compara os dois lados pelo
  //  mesmo conjunto, entao a representacao e consistente; o assert respeita isso)
  ok('7b. o _bmMl (conjunto) e quem enxerga o volume depois da barra',
    ctx.api._bmMl('CISPLATINA 1MG/ML C/50ML').has('50'), [...ctx.api._bmMl('CISPLATINA 1MG/ML C/50ML')]);
}

// ══════════ (2) O VOLUME SEPARA AS APRESENTACOES ══════════
// Sem esta barreira a tripla junta a cisplatina de 50 com a de 100 — as duas sao 1MG/ML.
{
  const c50  = R('CISPLATINA 50MG/50ML BLAU CX/1FRS C-PLATIN', 109.69);
  const c100 = R('CISPLATINA 100MG/100ML BLAU CX/1FRS C-PLATIN', 183.11);
  ok('8. *** pedido de 50MG/50ML casa a de 50, nao a de 100 ***',
    nome(busca([c50, c100], 'CISPLATINA 50MG 1MG/ML SOLUCAO INJETAVEL C/50ML')) === c50.produto,
    nome(busca([c50, c100], 'CISPLATINA 50MG 1MG/ML SOLUCAO INJETAVEL C/50ML')));
  ok('9. *** e o de 100MG/100ML casa a de 100 ***',
    nome(busca([c50, c100], 'CISPLATINA 100MG 1MG/ML SOLUCAO INJETAVEL C/100ML')) === c100.produto);
  ok('10. *** com SO a de 100 no banco, o pedido de 50 fica SEM MATCH (nao serve meia caixa) ***',
    busca([c100], 'CISPLATINA 50MG 1MG/ML SOLUCAO INJETAVEL C/50ML') === null);
  // docetaxel: 1ML x 4ML
  const d1 = R('DOCETAXEL 20MG/ML CX/1FRS-AMP 1ML GENERICO BLAU', 30.74);
  const d4 = R('DOCETAXEL 80MG/4ML CX/1FRS GENERICO BLAU', 49.58);
  ok('11. *** DOCETAXEL 20MG C/1ML casa o frasco de 1ML ***',
    nome(busca([d1, d4], 'DOCETAXEL 20MG 20MG/ML SOLUCAO INJETAVEL C/1ML')) === d1.produto);
  ok('12. *** DOCETAXEL 80MG C/4ML casa o de 4ML, nao o de 1ML (que e mais barato) ***',
    nome(busca([d1, d4], 'DOCETAXEL 80MG 20MG/ML SOLUCAO INJETAVEL C/4ML')) === d4.produto,
    nome(busca([d1, d4], 'DOCETAXEL 80MG 20MG/ML SOLUCAO INJETAVEL C/4ML')));
}

// ══════════ (2b) CANDIDATO QUE NAO DECLARA VOLUME NAO E BARRADO ══════════
// Era a mesma doenca do _bmFormaCand: ausencia tratada como divergencia. O banco cadastra muito
// oncologico so pela massa ("OXALIPLATINA 100MG CX/1FRS"), sem volume nenhum.
{
  const ox100 = R('OXALIPLATINA 100MG CX/1FRS FARMARIN EVOXALI', 76.98);
  const ox50  = R('OXALIPLATINA 50MG CX/1FRS FARMARIN EVOXALI', 41.86);
  ok('13. *** OXALIPLATINA 100MG 5MG/ML C/20ML casa o cadastro so-massa de 100MG ***',
    nome(busca([ox100, ox50], 'OXALIPLATINA 100MG 5MG/ML SOLUCAO INJETAVEL C/20ML')) === ox100.produto,
    nome(busca([ox100, ox50], 'OXALIPLATINA 100MG 5MG/ML SOLUCAO INJETAVEL C/20ML')));
  ok('14. *** e o de 50MG C/10ML casa o de 50MG (a conta 5 x 10 = 50 e quem decide) ***',
    nome(busca([ox100, ox50], 'OXALIPLATINA 50MG 5MG/ML SOLUCAO INJETAVEL C/10ML')) === ox50.produto);
  ok('15. *** a conta tem que FECHAR: 100MG nao casa um cadastro de 200MG ***',
    busca([R('OXALIPLATINA 200MG CX/1FRS ACCORD OXA', 178.34)],
      'OXALIPLATINA 100MG 5MG/ML SOLUCAO INJETAVEL C/20ML') === null);
  ok('16. paclitaxel 100MG casa o TAXILAN de 100,2MG (a mesma tolerancia de rotulo)',
    nome(busca([R('PACLITAXEL 100,2MG CX/1FRS BERGAMO TAXILAN', 46.80)],
      'PACLITAXEL 100MG 6MG/ML SOLUCAO INJETAVEL C/16,7ML')) === 'PACLITAXEL 100,2MG CX/1FRS BERGAMO TAXILAN');
  // >>> O CASO QUE A BARREIRA DE VOLUME PROTEGE CONTINUA PROTEGIDO: quando os DOIS declaram.
  ok('17. *** ALCOOL 70% 1000ML nao casa ALCOOL 70% 50ML (os dois declaram volume) ***',
    busca([R('ALCOOL ETILICO 70% FR 50ML', 3.10)], 'ALCOOL 70% 1000ML') === null);
}

// ══════════ (3) DESEMPATE POR PRECO ENTRE APRESENTACOES IDENTICAS ══════════
// A decisao do Lemuel: GLOBAL com estoque -> mesma tripla = MENOR PRECO -> score.
{
  // FAULDCISPLA tem MAIS palavras do pedido no nome (score maior) e e quase o dobro do preco
  const fauld = R('FAULDCISPLA 50 MG / 50ML INJ 1 FA OR', 211.11, { fornecedor: 'S3MED' });
  const blau  = R('CISPLATINA 50MG/50ML BLAU CX/1FRS C-PLATIN', 109.69);
  ok('18. *** CISPLATINA 50MG C/50ML casa a de R$144,79 (BLAU), nao a de R$278,66 (FAULDCISPLA) ***',
    nome(busca([fauld, blau], 'CISPLATINA 50MG 1MG/ML SOLUCAO INJETAVEL C/50ML')) === blau.produto,
    nome(busca([fauld, blau], 'CISPLATINA 50MG 1MG/ML SOLUCAO INJETAVEL C/50ML')));
  ok('19. e a ordem em que entram no banco nao muda o resultado',
    nome(busca([blau, fauld], 'CISPLATINA 50MG 1MG/ML SOLUCAO INJETAVEL C/50ML')) === blau.produto);
  // >>> O ESTOQUE PROPRIO CONTINUA NA FRENTE, mesmo mais caro — a regra nao virou "sempre o mais barato"
  const global = R('CISPLATINA 50MG/50ML CX1 FR', 0, { fornecedor: '1', tipo: 'global',
    global_venda1: '400.00', estoque: '9', und: 'CX1' });
  ok('20. *** GLOBAL com estoque ganha do fornecedor mais barato (a regra nao inverteu) ***',
    nome(busca([blau, global], 'CISPLATINA 50MG 1MG/ML SOLUCAO INJETAVEL C/50ML')) === global.produto,
    nome(busca([blau, global], 'CISPLATINA 50MG 1MG/ML SOLUCAO INJETAVEL C/50ML')));
  // >>> E O SCORE CONTINUA MANDANDO ENTRE APRESENTACOES DIFERENTES: preco nao atropela produto.
  ok('21. *** tripla diferente: o mais barato NAO ganha so por ser barato ***',
    nome(busca([R('DOCETAXEL 20MG/ML CX/1FRS-AMP 1ML GENERICO BLAU', 30.74),
                R('DOCETAXEL 80MG/4ML CX/1FRS GENERICO BLAU', 49.58)],
      'DOCETAXEL 80MG 20MG/ML SOLUCAO INJETAVEL C/4ML')) === 'DOCETAXEL 80MG/4ML CX/1FRS GENERICO BLAU');
}

// ══════════ A FORMA NAO PODE VOLTAR A SER ADIVINHADA ══════════
// Frasco-ampola de quimioterapico era classificado como COMPRIMIDO (sem palavra de forma) ou
// como XAROPE (com "/ML"), e barrado contra um pedido injetavel.
{
  ok('22. *** cadastro sem palavra de forma = NAO SEI (null), nao "comprimido" ***',
    _bmFormaCand('PEMETREXEDE DISSODICO 100MG CX/1FRS GENERICO BLAU') === null,
    _bmFormaCand('PEMETREXEDE DISSODICO 100MG CX/1FRS GENERICO BLAU'));
  ok('23. *** ter "/ML" diz que e liquido, nao que e oral: tambem null ***',
    _bmFormaCand('DOCETAXEL 80MG/4ML CX/1FRS GENERICO BLAU') === null);
  ok('24. e quem DECLARA a forma continua declarando',
    _bmFormaCand('CISPLATINA 1MG/ML SOL INJ FA 50ML') === 'INJETAVEL');
  ok('25. *** PEMETREXEDE 100MG "PO PARA SOLUCAO INJETAVEL" casa o cadastro sem forma ***',
    nome(busca([R('PEMETREXEDE DISSODICO 100MG CX/1FRS GENERICO BLAU', 92.29)],
      'PEMETREXEDE DISSODICO 100MG PO PARA SOLUCAO INJETAVEL FRASCO/AMPOLA'))
    === 'PEMETREXEDE DISSODICO 100MG CX/1FRS GENERICO BLAU');
  ok('26. e o de 500MG casa o de 500MG, nao o de 100MG',
    nome(busca([R('PEMETREXEDE DISSODICO 100MG CX/1FRS GENERICO BLAU', 92.29),
                R('PEMETREXEDE DISSODICO 500MG CX/1FRS CRISTALIA MESO', 205.13)],
      'PEMETREXEDE DISSODICO 500MG PO PARA SOLUCAO INJETAVEL FRASCO/AMPOLA'))
    === 'PEMETREXEDE DISSODICO 500MG CX/1FRS CRISTALIA MESO');
  // a barreira de forma continua barrando quando os DOIS lados declaram
  ok('27. *** pedido INJETAVEL nao recebe comprimido declarado ***',
    busca([R('PACLITAXEL 100MG CX30 COMPRIMIDOS', 10)],
      'PACLITAXEL 100MG 6MG/ML SOLUCAO INJETAVEL C/16,7ML') === null);
}

// ══════════ FOLINICO x FOLICO — a guarda que mantem o sem-match CERTO ══════════
{
  ok('28. *** FOLINATO DE CALCIO 300MG nao casa ACIDO FOLICO, nem de longe ***',
    busca([R('AFOLIMAX SOL 0,2MG/ML 30ML (ACIDO FOLICO)', 8.50)],
      'FOLINATO DE CALCIO (ACIDO FOLINICO) 300MG 10MG/ML C/30ML') === null);
  ok('29. *** nem "ACIDO FOLINICO" contra "ACIDO FOLICO" (uma letra de diferenca) ***',
    busca([R('ACIDO FOLICO 5MG CX30 CPR', 2)], 'ACIDO FOLINICO 300MG') === null);
  ok('30. e o folinico casa folinico',
    nome(busca([R('FOLINATO DE CALCIO 300MG/30ML FA', 90)],
      'FOLINATO DE CALCIO (ACIDO FOLINICO) 300MG 10MG/ML C/30ML')) === 'FOLINATO DE CALCIO 300MG/30ML FA');
  ok('31. leucovorin tambem e folinico (mesmo medicamento, outro nome)',
    busca([R('ACIDO FOLICO 5MG CX30 CPR', 2)], 'LEUCOVORIN CALCIO 300MG') === null);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
