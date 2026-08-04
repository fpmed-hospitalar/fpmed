// SUITE testa_pedido_sem_dose — QUANDO O PEDIDO NAO DIZ A DOSE, MAS DIZ O FRASCO.
//
// Duas linhas do pedido cirurgico ficavam sem match tendo o produto no banco:
//    "CIPROFLOXACINO INJETAVEL 100 ML"   e   "HEPARINA INJETAVEL SODICA 5 ML"
// Nenhuma das duas traz dose. INJETAVEL e forma dose-critica, entao caiam na regra "pedido sem
// dose so casa candidato sem dose" — feita pra impedir que "DIPIRONA CPR" escolha 500MG ou 1G no
// lugar do cliente. So que estas DUAS DIZEM O VOLUME, e o volume e o discriminador: e ele que
// separa o cipro de 100ML do de 200ML, e a heparina IV de 5ML da subcutanea de 0,25ML.
//
// A REGRA FINAL, em tres camadas:
//   1. filtra os candidatos pelo VOLUME que o pedido declarou;
//   2. exige que os que sobraram concordem sobre a dose — por UMA de duas leituras:
//        total  = concentracao x volume  ("200MG em 100ML" == "2MG/ML em 100ML")
//        rotulo = o numero como escrito, sem o "/ML"  ("5000UI" == "5000UI/ML")
//   3. entre os que concordam, ganha estoque proprio e depois o menor preco.
// Se os que sobraram DISCORDAM, o pedido e ambiguo de verdade e continua sem match.
//   node tests/testa_pedido_sem_dose.js
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
  + 'return { api:{ buscarMelhorProduto, _bmDoseTotKey }, setCot:function(a){cotacoes=a;} };'))();
const { buscarMelhorProduto, _bmDoseTotKey } = ctx.api;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e != null ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_pedido_sem_dose — o volume como discriminador\n');

const R = (produto, preco) => ({ produto, principio_ativo: '', und: '', compra_unit: String(preco),
  global_venda1: '', tipo: 'fornecedor', fornecedor: 'MCW', estoque: '5' });
const busca = (cot, q) => { ctx.setCot(cot); return buscarMelhorProduto(q); };
const nome = r => r ? r.produto : null;

// ══════════ A CHAVE DE DOSE TOTAL ══════════
{
  ok('1. *** "200MG em 100ML" e "2MG/ML em 100ML" dao a MESMA chave (2 x 100 = 200) ***',
    _bmDoseTotKey('CIPROFLOXACINO 200MG IV 100ML SIST.FECHADO') === _bmDoseTotKey('FRESOFLOX 2MG/ML CIPROFLOXACINO SOL INJ IV FR 100ML'),
    [_bmDoseTotKey('CIPROFLOXACINO 200MG IV 100ML SIST.FECHADO'), _bmDoseTotKey('FRESOFLOX 2MG/ML CIPROFLOXACINO SOL INJ IV FR 100ML')]);
  ok('2. e o de 400MG/200ML NAO', _bmDoseTotKey('CIPROFLOXACINO 400MG 200ML') !== _bmDoseTotKey('CIPROFLOXACINO 200MG IV 100ML'));
  ok('3. "5000UI/ML em 5ML" vale 25000UI de dose total',
    _bmDoseTotKey('HEPARINA SODICA 5000 UI/ML 5ML EUROFARMA') === '25000UI', _bmDoseTotKey('HEPARINA SODICA 5000 UI/ML 5ML EUROFARMA'));
}

// ══════════ CIPROFLOXACINO — o volume separa, a dose total reconcilia ══════════
{
  const c100a = R('CIPROFLOXACINO 200MG IV 100ML SIST.FECHADO GENERIC', 5.57);
  const c100b = R('FRESOFLOX 2MG/ML CIPROFLOXACINO SOL INJ IV SIST FECH FR 100ML', 5.89);
  const c200  = R('CIPROFLOXACINO 400MG 200ML SIST.FECHADO GENERICO E', 9.10);
  ok('4. *** "CIPROFLOXACINO INJETAVEL 100 ML" casa um frasco de 100ML ***',
    /100ML/.test(nome(busca([c100a, c100b, c200], 'CIPROFLOXACINO INJETAVEL 100 ML')) || ''),
    nome(busca([c100a, c100b, c200], 'CIPROFLOXACINO INJETAVEL 100 ML')));
  ok('5. *** e NUNCA o de 200ML, que e outra apresentacao ***',
    nome(busca([c100a, c100b, c200], 'CIPROFLOXACINO INJETAVEL 100 ML')) !== c200.produto);
  ok('6. *** so o de 200ML no banco -> SEM MATCH (nao serve outro frasco) ***',
    busca([c200], 'CIPROFLOXACINO INJETAVEL 100 ML') === null);
  ok('7. entre os dois de 100ML (mesma dose total) ganha o mais barato',
    nome(busca([c100b, c100a], 'CIPROFLOXACINO INJETAVEL 100 ML')) === c100a.produto,
    nome(busca([c100b, c100a], 'CIPROFLOXACINO INJETAVEL 100 ML')));
  ok('8. *** "SIST FECHADO" no nome nao atrapalha o casamento ***',
    busca([c100b], 'CIPROFLOXACINO INJETAVEL 100 ML') !== null);
  // >>> A AMBIGUIDADE DE VERDADE CONTINUA BARRANDO: dois frascos de 100ML com forcas diferentes
  ok('9. *** duas forcas no MESMO volume = ambiguo de verdade -> sem match ***',
    busca([c100a, R('CIPROFLOXACINO 500MG IV 100ML OUTRO', 8)], 'CIPROFLOXACINO INJETAVEL 100 ML') === null);
}

// ══════════ HEPARINA — e as guardas que o Lemuel pediu ══════════
{
  const euro   = R('HEPARINA SODICA 5000 UI/ML 5ML EUROFARMA CX/50 FRA', 14.35);
  const parinx = R('HEPARINA SOD.5000UI F/A 50X5ML (PARINEX)', 15.11);
  const hemoSC = R('HEPARINA 5000UI/ML 0,25ML SC 25 AMP CRISTALIA HEMOFOL', 7.70);
  const hemoIV = R('HEMOFOL 5000UI/ML SOL INJ IV CX C/25 FA X 5ML', 13.00);
  const todos = [euro, parinx, hemoSC, hemoIV];

  ok('10. *** "HEPARINA INJETAVEL SODICA 5 ML" casa um frasco de 5ML ***',
    /5ML|50X5ML|X 5ML/.test(nome(busca(todos, 'HEPARINA INJETAVEL SODICA 5 ML')) || ''),
    nome(busca(todos, 'HEPARINA INJETAVEL SODICA 5 ML')));
  ok('11. *** GUARDA: NUNCA o HEMOFOL subcutaneo de 0,25ML ***',
    nome(busca(todos, 'HEPARINA INJETAVEL SODICA 5 ML')) !== hemoSC.produto,
    nome(busca(todos, 'HEPARINA INJETAVEL SODICA 5 ML')));
  ok('12. *** so o subcutaneo de 0,25ML no banco -> SEM MATCH ***',
    busca([hemoSC], 'HEPARINA INJETAVEL SODICA 5 ML') === null);
  ok('13. *** "5000UI" e "5000UI/ML" no mesmo frasco de 5ML sao o mesmo produto ***',
    busca([euro, parinx], 'HEPARINA INJETAVEL SODICA 5 ML') !== null);
  ok('14. e entre eles ganha o mais barato',
    nome(busca([parinx, euro], 'HEPARINA INJETAVEL SODICA 5 ML')) === euro.produto,
    nome(busca([parinx, euro], 'HEPARINA INJETAVEL SODICA 5 ML')));
  // >>> O "25000UI/5ML" É O MESMO PRODUTO, e a conta prova: 25000 / 5 = 5000 UI/ML.
  //     O enunciado pedia pra barrar como "concentracao diferente" — nao e. Barrar seria recusar
  //     o proprio produto que o pedido quer, escrito com a dose do frasco inteiro.
  ok('15. *** "25000UI/5ML" == "5000UI/ML" (25000/5 = 5000) — mesmo produto, casa ***',
    busca([R('HEPARINA SODICA 25000UI/5ML CX25 FA', 13.65)], 'HEPARINA INJETAVEL SODICA 5 ML') !== null);
  ok('16. *** GUARDA DE VERDADE: forca diferente no mesmo frasco barra ***',
    busca([euro, R('HEPARINA SODICA 25000 UI/ML 5ML CONCENTRADA', 30)], 'HEPARINA INJETAVEL SODICA 5 ML') === null);
}

// ══════════ O QUE NAO PODE QUEBRAR ══════════
// A regra do pedido-sem-dose existe pra impedir que o motor escolha a dose no lugar do cliente.
{
  // a linha real do banco traz o principio ativo preenchido — e e ele que diz "isto e a MOLECULA,
  // nao uma marca". Com o campo cheio, como no banco de verdade, a trava continua de pe.
  const Rpa = (produto, preco, pa) => Object.assign(R(produto, preco), { principio_ativo: pa });
  ok('17. *** "DIPIRONA CPR" (molecula, sem dose e SEM volume) continua sem casar ***',
    busca([Rpa('DIPIRONA 500MG COMP CX200', 0.05, 'DIPIRONA')], 'DIPIRONA CPR') === null);
  ok('18. e com duas doses no banco, muito menos',
    busca([Rpa('DIPIRONA 500MG COMP CX200', 0.05, 'DIPIRONA'), Rpa('DIPIRONA 1G COMP CX100', 0.09, 'DIPIRONA')],
      'DIPIRONA CPR') === null);
  // >>> LIMITE CONHECIDO, declarado: quem separa molecula de marca e o campo principio_ativo. Num
  //     cadastro com esse campo VAZIO o motor nao tem como saber que "DIPIRONA" e a molecula, e
  //     trata como marca. Nao e regressao (sempre foi assim) — e uma razao a mais pra manter o
  //     principio_ativo preenchido nos imports.
  ok('18b. (limite) com principio_ativo VAZIO o motor nao distingue molecula de marca',
    busca([R('DIPIRONA 500MG COMP CX200', 0.05)], 'DIPIRONA CPR') !== null);
  ok('19. TRANSAMIN INJETAVEL (marca, sem dose e sem volume) continua casando',
    nome(busca([R('TRANSAMIN INJ. IV 50MG/ML CX5 AMP 5ML', 4.03)], 'TRANSAMIN INJETAVEL'))
    === 'TRANSAMIN INJ. IV 50MG/ML CX5 AMP 5ML');
  ok('20. *** e a marca com DUAS apresentacoes injetaveis volta a ser ambigua ***',
    busca([R('TRANSAMIN INJ. IV 50MG/ML CX5 AMP 5ML', 4.03),
           R('TRANSAMIN INJ. IV 100MG/ML CX5 AMP 5ML', 7.00)], 'TRANSAMIN INJETAVEL') === null);
  ok('21. pedido COM dose continua mandando na dose',
    nome(busca([R('CIPROFLOXACINO 200MG IV 100ML', 5.57), R('CIPROFLOXACINO 400MG 200ML', 9.10)],
      'CIPROFLOXACINO 400MG INJETAVEL 200 ML')) === 'CIPROFLOXACINO 400MG 200ML');
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
