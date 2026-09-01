// SUITE testa_resultado_zero — R$ 0,00 PUBLICADO NÃO É "AINDA NÃO TEMOS" (fatia B39, 01/09/2026).
//
// ══ O DEFEITO, E ELE ERA MUDO DOS DOIS LADOS ═══════════════════════════════════════════════════
// O motor recusa preço zero, e essa decisão está certa e foi confirmada pelo arquiteto: zero não é
// preço homologado, e usá-lo puxaria faixa e mediana para baixo com um número que ninguém praticou.
// Só que ele recusava com um `continue` — a linha era DESCARTADA e sumia. Do outro lado, a tela
// lia o campo com `Number(x) > 0 ? x : null`, e `null` e `0` viravam o mesmo `null`.
//
// >>> RESULTADO: "o órgão homologou este item e publicou R$ 0,00" e "ainda não temos resultado
//     para este item" eram A MESMA TELA VAZIA. Para quem lê, as duas frases mandam fazer coisas
//     opostas: a segunda manda ESPERAR; a primeira manda ir atrás do órgão. Dizer a segunda sobre
//     a primeira é mandar a pessoa esperar por uma informação que já chegou.
//
// ══ E AQUI O ZERO É MESMO UMA AFIRMAÇÃO, NÃO UM CAMPO VAZIO ════════════════════════════════════
// Medido no backup de 01/09, `licitacao_itens.json` inteiro (886 MB, 428.658 itens, lido em
// streaming porque não cabe em string do V8):
//     423.363  resultado_valor_unit NULO ....... ninguém publicou resultado
//       5.294  com resultado publicado, em 217 certames
//       5.250  com preço maior que zero
//          44  a ZERO, em 7 certames
//           0  negativos
// As 44 têm vencedor NOMEADO e `resultado_situacao` = "Informado". Alguém preencheu com zero.
//
// >>> A CAIXA DA RODADA 13 DIZIA "38 linhas em 8 certames". São 44 em 7. O número vai medido.
//
// ══ POR QUE ESTA SUÍTE NÃO ABRE NAVEGADOR ══════════════════════════════════════════════════════
// A regra mora no motor (`fpmed_teto_homologado.js`), que é um arquivo de JavaScript puro sem
// nenhuma dependência de DOM — de propósito, desde a B28. Então ela é carregada aqui do jeito que
// a tela a carrega e interrogada direto. O pedaço que é de TELA (a frase que a pessoa lê) é
// cobrado por recorte do HTML, sem recopiá-lo.
//
//   node tests/testa_resultado_zero.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_resultado_zero — R$ 0,00 publicado não é "ainda não temos"\n');

// o motor, carregado como a tela o carrega
const win = {};
new Function('window', fs.readFileSync(path.join(raiz, 'fpmed_teto_homologado.js'), 'utf8'))(win);
const T = win.FPMED_TETO_HOMOLOGADO;
ok('1. o motor do teto homologado carrega fora do navegador', !!T && typeof T.indexa === 'function');

// ── um índice com as três situações que existem no banco, de propósito juntas ────────────────
const linha = (o) => Object.assign({
  numero_controle: '11111111111111-1-000001/2026', numero_item: '1',
  descricao: 'SERINGA DESCARTAVEL 10ML', unidade: 'UN', quantidade: 100,
  resultado_valor_unit: null, resultado_quantidade: 100, resultado_situacao: 'Informado',
  resultado_vencedor: 'FORNECEDOR A', resultado_cnpj: '11111111000111',
}, o);

const linhas = [
  linha({ numero_controle: 'A-1-000001/2026', numero_item: '1', resultado_valor_unit: 1.50 }),
  linha({ numero_controle: 'B-1-000002/2026', numero_item: '1', resultado_valor_unit: 2.50, resultado_vencedor: 'FORNECEDOR B' }),
  // as duas que interessam: preço publicado ZERO, em dois certames diferentes
  linha({ numero_controle: 'C-1-000003/2026', numero_item: '7', resultado_valor_unit: 0, resultado_vencedor: 'FORNECEDOR C' }),
  linha({ numero_controle: 'D-1-000004/2026', numero_item: '9', resultado_valor_unit: 0, resultado_vencedor: 'FORNECEDOR D' }),
  // outro produto, para provar que o zero não vaza de uma chave para outra
  linha({ numero_controle: 'E-1-000005/2026', numero_item: '2', descricao: 'LUVA DE PROCEDIMENTO M', resultado_valor_unit: 0 }),
];
const idx = T.indexa(linhas, { certames: {}, total: linhas.length, truncado: false });

// ══════════ 1. O ZERO CONTINUA FORA DA CONTA — a decisão não mudou ══════════
ok('2. *** o zero NÃO entra no índice de preço: 5 linhas entram, 2 ficam ***', idx.linhas === 2, idx.linhas);
ok('3. ...e o motor CONTA quantos zeros viu, em vez de descartá-los calado', idx.zeros === 3, idx.zeros);
ok('4. ...com o denominador junto: em quantos certames (número com recorte publica o recorte)',
  idx.zerosCertames === 3, idx.zerosCertames);

// ══════════ 2. A AVALIAÇÃO SEPARA AS DUAS CONTAS ══════════
{
  const r = T.avaliar({ descricao: 'SERINGA DESCARTAVEL 10ML', precoUnit: null }, idx);
  ok('5. *** a faixa é dos 2 com preço, e o zero NÃO virou um terceiro resultado ***', r.n === 2, r.n);
  ok('6. ...e a mediana é a dos dois com preço (2,00), não a de três com um zero dentro (1,50)',
    r.mediana === 2, r.mediana);
  ok('7. ...e os zeros vêm por fora, contados, com os certames', r.zeros === 2 && r.zerosCertames === 2,
    { zeros: r.zeros, certames: r.zerosCertames });
}
// ══════════ 3. O ZERO NÃO VAZA DE UM PRODUTO PARA OUTRO ══════════
{
  const r = T.avaliar({ descricao: 'LUVA DE PROCEDIMENTO M', precoUnit: null }, idx);
  ok('8. produto que só tem zero: n=0 e zeros=1 — as duas coisas ditas, e nenhuma inventada',
    r.n === 0 && r.zeros === 1, { n: r.n, zeros: r.zeros });
  const s = T.avaliar({ descricao: 'PRODUTO QUE NAO EXISTE NO INDICE', precoUnit: null }, idx);
  ok('9. produto sem nada: n=0 E zeros=0 — "não temos" continua sendo "não temos"',
    s.n === 0 && s.zeros === 0, { n: s.n, zeros: s.zeros });
}
// ══════════ 4. O `ignorar` VALE PARA O ZERO TAMBÉM ══════════
/* Sem isso, o item do certame C se veria na própria lista de zeros e a tela diria "e mais 1 vez
   publicaram sem preço" sobre a única vez, que é ELE — a mesma tautologia que o `ignorar` já
   impedia do lado do preço. */
{
  const r = T.avaliar({ descricao: 'SERINGA DESCARTAVEL 10ML', precoUnit: null,
    ignorar: { numero_controle: 'C-1-000003/2026', numero_item: '7' } }, idx);
  ok('10. *** o item não se conta como zero de outro certame (o `ignorar` vale para os dois lados) ***',
    r.zeros === 1 && r.zerosCertames === 1, { zeros: r.zeros, certames: r.zerosCertames });
}
// ══════════ 5. NULL NÃO É ZERO — a lei da casa, cobrada no motor ══════════
{
  const so = [linha({ numero_controle: 'F-1-000006/2026', resultado_valor_unit: null })];
  const i2 = T.indexa(so, { certames: {} });
  ok('11. *** `null` não é contado como zero: "não informado" e "acabou" são coisas diferentes ***',
    i2.zeros === 0 && i2.linhas === 0, { zeros: i2.zeros, linhas: i2.linhas });
}

// ══════════ 6. A TELA DIZ AS DUAS COISAS, E COM PALAVRAS DIFERENTES ══════════
const N = fs.readFileSync(path.join(raiz, 'fpmed_negocios.html'), 'utf8');
const BL = N.slice(N.indexOf('function homologadoDoItem'), N.indexOf('function pintaConferencia'));
ok('12. o recorte da tela existe e não é vazio (âncora quebrada não pode virar verde)', BL.length > 2000, BL.length);
ok('13. a tela lê o zero do PRÓPRIO item separado do null', /meuZero/.test(BL) && /resultado_valor_unit != null/.test(BL));
ok('14. *** e escreve "publicou ... sem preço", que é outra frase que "ainda não temos" ***',
  /publicou[^']*<b>sem preço<\/b>|publicado <b>sem preço<\/b>/.test(BL) && /ainda não temos resultado para este item/.test(BL));
/* O ZERO É UMA `parte`, E NÃO SÓ UM ESTADO VAZIO. A primeira versão desta fatia o pôs apenas
   dentro do `if(!partes.length)` — e aí um item com faixa vinda de outros certames nunca diria
   que o próprio órgão publicou zero. Informação existente que some porque outra existe é o
   mesmo defeito uma camada acima.
   >>> A PERGUNTA É DE ORDEM, ENTÃO ELA SE FAZ NO CÓDIGO SEM COMENTÁRIO. A primeira versão deste
       assert leu o recorte cru e reprovou uma tela que estava CERTA: o comentário que explica a
       correção cita `if(!partes.length)` por escrito, e o `indexOf` achou a citação antes do
       código. Assert de posição que lê comentário mede o texto, não o programa — e empurra o
       motivo para fora do código, que é onde o motivo morre. */
const CODIGO = BL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok('15. *** o zero do item entra como PARTE, antes do `if(!partes.length)` ***',
  CODIGO.indexOf('if(meuZero)') > 0 && CODIGO.indexOf('if(meuZero)') < CODIGO.indexOf('if(!partes.length)'),
  { meuZero: CODIGO.indexOf('if(meuZero)'), partesVazio: CODIGO.indexOf('if(!partes.length)') });
ok('16. e os zeros de OUTROS certames também aparecem, com o número de certames junto',
  /r\.zeros > 0/.test(BL) && /zerosCertames/.test(BL));
// A tela não pode dizer que saiu de graça: isso seria acreditar no zero que o motor recusa.
ok('17. *** a tela nega as duas leituras erradas: nem "sem resultado", nem "de graça" ***',
  /não<\/b> quer dizer que o item ficou sem resultado/.test(BL) && /saiu de graça/.test(BL));

// ══════════ 7. A PROPOSTA TAMBÉM — O MOTOR É O MESMO, O SELO ERA CEGO IGUAL ══════════
/* A `fpmed_giovana.html` carrega o mesmo motor e tinha o mesmo buraco: `if(!r.n)` pegava as duas
   coisas, porque o zero era descartado antes de chegar lá. As duas telas do B falam do mesmo
   dado; consertar uma e deixar a outra faria as duas responderem diferente à mesma pergunta —
   que é o defeito que a `precoDaLinha` compartilhada existe para impedir. */
const G = fs.readFileSync(path.join(raiz, 'fpmed_giovana.html'), 'utf8');
const SELO = G.slice(G.indexOf('function homolBadgeHTML'), G.indexOf('function ', G.indexOf('function homolBadgeHTML') + 40));
const SELO_CODIGO = SELO.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok('18. o recorte do selo da Proposta existe (âncora quebrada não pode virar verde)', SELO.length > 800, SELO.length);
ok('19. *** o selo da Proposta distingue "sem preço" de "ainda sem resultado" ***',
  /publicou[^']*<b>sem preço<\/b>|publicado <b>sem preço<\/b>/.test(SELO) && /ainda sem resultado homologado/.test(SELO));
ok('20. ...e o teste do zero vem ANTES do `if(!r.n)`, senão ele nunca dispara',
  SELO_CODIGO.indexOf('r.zeros > 0') > 0 && SELO_CODIGO.indexOf('r.zeros > 0') < SELO_CODIGO.indexOf('if(!r.n)'),
  { zeros: SELO_CODIGO.indexOf('r.zeros > 0'), semN: SELO_CODIGO.indexOf('if(!r.n)') });
/* O CASO QUE MAIS ENGANA: o item TEM faixa e TAMBÉM tem zero. Aí o `if(!r.n)` não dispara, e
   sem esta linha o zero sumiria mais fundo — a pessoa leria "2 resultados" e suporia que os 2
   são tudo que houve. */
ok('21. *** e quando há faixa E zero, o zero entra no título em vez de sumir ***',
  /r\.zeros > 0 \?/.test(SELO) && /SEM PREÇO/.test(SELO));
ok('22. as duas telas do B dizem o número de CERTAMES junto (recorte publica o critério)',
  /zerosCertames/.test(BL) && /zerosCertames/.test(SELO));

/* ══ 23. O ZERO É DITO COM A PALAVRA, NUNCA COM O CIFRÃO ═══════════════════════════════════════
   Duas catracas da casa me pegaram por ter escrito `R$ 0,00` nestas frases novas, e as duas
   estavam certas: `R$ 0,00` FORMATA o zero como dinheiro, e a lei destas telas é que zero nunca
   sai vestido de preço (a Proposta inteira nasceu de "R$ 0,00 numa proposta comercial não é
   espaço em branco, é uma AFIRMAÇÃO", B22; no Negócios foram 7.456 itens aparecendo como se
   custassem nada). O zero aqui é o SUJEITO da frase — "o valor publicado foi zero" — e não o
   valor de uma linha. Este assert é para a próxima pessoa não refazer o mesmo caminho. */
const soFrases = (s) => (s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').match(/R\$ 0,00/g) || []).length;
ok('23. *** nem a frase do Negócios nem a da Proposta escrevem o zero com cifrão ***',
  soFrases(BL) === 0 && soFrases(SELO) === 0, { negocios: soFrases(BL), proposta: soFrases(SELO) });

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
