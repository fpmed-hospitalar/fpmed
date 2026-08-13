// SUITE testa_ponte_edital — OS ITENS DO EDITAL CHEGANDO NO GERADOR DE PROPOSTA.
//
// A ponte Licitacoes -> Propostas (secao 8.3 do SPEC, 10/08). Nao ha dado novo aqui: os itens ja
// vieram do PNCP no cruzamento e as Propostas ja sabem casar uma lista contra o estoque. O que
// esta suite protege e o UNICO ponto onde a ponte pode estragar dado: A QUANTIDADE.
//
//   No edital a quantidade vem na unidade DELE ("Caixa 100 UN", "Unidade", "Galao 5 L").
//   Na proposta a quantidade e em CAIXAS NOSSAS.
//   500 unidades viradas em 500 caixas e erro de 100x num documento que vale como proposta.
//
// AS TRES RECUSAS QUE ESTA SUITE TRAVA:
//   1. NAO CHUTA. Pack desconhecido de qualquer um dos dois lados -> entra 1 + etiqueta de
//      conferir, e o item aparece na lista de "confira antes de mandar".
//   2. NAO PERDE ITEM. Item sem equivalente no estoque vai pra lista de nao encontrados (e de la
//      pra fila de cotacao), nao some.
//   3. NAO IMPORTA SOZINHO. Quem abriu as Propostas pode estar no meio de outra proposta.
//
//   node tests/testa_ponte_edital.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
// CRLF -> LF: mesma razao explicada no testa_cruzamento_licitacoes.js.
const licit = fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const giov  = fs.readFileSync(path.join(raiz, 'fpmed_giovana.html'),   'utf8').replace(/\r\n/g, '\n');
const M     = require(path.join(raiz, 'fpmed_teto_cmed.js'));

function bloco(src, ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora sumiu do HTML: ' + ini);
  return src.slice(s, e);
}

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_ponte_edital — os itens do edital viram proposta\n');

// ══════════ LADO LICITACOES: o pacote que sai ══════════
const win = { LimedtecTetoCMED: M };
const L = (new Function('window',
  bloco(licit, 'const { semAcento', 'const ymd =') +
  bloco(licit, '// ══ PACK', '// ══ MATCHING') +
  bloco(licit, 'function numCompra', '\n\n// ══ ESTOQUE') +
  bloco(licit, 'function itensProPedido', 'function mandarProPropostas') +
  'return { itensProPedido, unidadePack, unitarioEdital };'))(win);

const LIC = {
  modalidadeNome: 'Pregão Eletrônico', numeroCompra: '90014', anoCompra: 2026,
  numeroControlePNCP: '01612092000123-1-000014/2026',
  orgaoEntidade: { razaoSocial: 'MUNICIPIO DE URUACU' },
  unidadeOrgao: { municipioNome: 'Uruaçu', ufSigla: 'GO' },
  usuarioNome: 'Compras.gov.br', dataAberturaProposta: '2026-08-20T09:00:00',
};
const item = (n, d, q, und, vu) => ({ it: { numeroItem:n, descricao:d, quantidade:q, unidadeMedida:und, valorUnitarioEstimado:vu }, pares: [] });
const R = {
  truncado: false, casados: 1,
  itens: [
    Object.assign(item(1, 'DIPIRONA SODICA 500MG/ML SOLUCAO INJETAVEL', 500, 'Caixa 100 UN', 120), { pares:[{conf:'alta'}] }),
    item(2, 'SERINGA DESCARTAVEL 3ML', 2000, 'Unidade', 0.55),
    item(3, 'ALCOOL GEL 70%', 300, 'Frasco 1000 ML', 12.4),
    item(4, 'GAZE ESTERIL 7,5X7,5', 80, 'Caixa', 30),
  ],
};
const pacote = L.itensProPedido(R, LIC);

ok('1. o pacote se identifica (quem mandou e de qual licitacao)',
  pacote.de === 'licitacoes' && pacote.lic.numero === '01612092000123-1-000014/2026'
  && /Pregão Eletrônico/.test(pacote.lic.titulo), pacote.lic);
ok('2. leva orgao/municipio/UF — sem isso ninguem sabe pra quem e a proposta',
  pacote.lic.orgao === 'MUNICIPIO DE URUACU' && pacote.lic.municipio === 'Uruaçu' && pacote.lic.uf === 'GO');
ok('3. os 4 itens vao inteiros (a ponte nao filtra o que nao casou)', pacote.itens.length === 4);

// ── A CONVERSAO, item a item ──
const i1 = pacote.itens[0], i2 = pacote.itens[1], i3 = pacote.itens[2], i4 = pacote.itens[3];
ok('4. *** "Caixa 100 UN" x 500 -> 50.000 UNIDADES (nao 500) ***',
  i1.packEdital === 100 && i1.qtdUnidades === 50000, { pack: i1.packEdital, un: i1.qtdUnidades });
ok('5. "Unidade" x 2000 -> 2.000 unidades', i2.packEdital === 1 && i2.qtdUnidades === 2000);
ok('6. *** "Frasco 1000 ML" -> pack 1: 1000 ML e MEDIDA, nao contagem ***',
  i3.packEdital === 1 && i3.qtdUnidades === 300, { pack: i3.packEdital, un: i3.qtdUnidades });
ok('7. *** "Caixa" sem numero -> packEdital null e qtdUnidades NULL (nao 1, nao 80) ***',
  i4.packEdital === null && i4.qtdUnidades === null, { pack: i4.packEdital, un: i4.qtdUnidades });
ok('8. a quantidade CRUA do edital vai junto (pra tela poder mostrar o que foi pedido)',
  i4.qtdEdital === 80 && i4.unidade === 'Caixa');
ok('9. o unitario ESTIMADO do edital vai como referencia, ja unitarizado',
  Math.abs(i1.unitEdital - 1.2) < 0.0001, i1.unitEdital);
ok('10. e diz quais ja tinham casado no cruzamento',
  i1.casouAqui === true && i2.casouAqui === false);
ok('11. a descricao vai com o espaco normalizado (uma linha, sem quebra do PNCP)',
  !/\s{2,}|\n/.test(i1.descricao));

// ── a tela: o botao e a trava ──
ok('12. a tabela de itens oferece o botao de montar proposta',
  /onclick="mandarProPropostas\('\+i\+'\)"/.test(licit) || /mandarProPropostas\(/.test(licit));
ok('13. *** sem itens lidos, nao manda nada: manda abrir os itens antes ***',
  /Abra os itens desta licitação antes/.test(licit));
ok('14. *** sessionStorage, nao localStorage: o pedido morre com a aba ***',
  /sessionStorage\.setItem\('fpmed_pedido_edital'/.test(licit)
  && !/localStorage\.setItem\('fpmed_pedido_edital'/.test(licit));

// ══════════ LADO PROPOSTAS: o que entra na proposta ══════════
// DOM e dependencias de mentira; a FUNCAO e a de verdade, extraida do HTML.
const CAIXA = {};
const doc = { getElementById: id => (CAIXA[id] === undefined ? null : CAIXA[id]) };
const SESSAO = {};
const sessionStorage = {
  getItem: k => (SESSAO[k] === undefined ? null : SESSAO[k]),
  setItem: (k, v) => { SESSAO[k] = String(v); },
  removeItem: k => { delete SESSAO[k]; },
};
// O ESTOQUE DE MENTIRA. Tres produtos, com packs diferentes de proposito:
//   CX/250 (pack lido do nome) · CX/20 · CX sem contagem (pack NAO sabido)
// >>> E OS PACKS SAO DIFERENTES DOS DO EDITAL DE PROPOSITO. Na primeira versao desta suite a
//     DIPIRONA era CX/100 e o edital pedia "Caixa 100 UN": a conversao dava 500 caixas e a
//     quantidade CRUA do edital tambem era 500. Os dois numeros coincidiam, e o teste passava
//     ate com a conta trocada por `qtd = it.qtdEdital` — provado mutando o codigo. Fixture em
//     que o certo e o errado dao o mesmo numero nao testa nada.
const ESTOQUE = [
  { id:'a', produto:'DIPIRONA 500MG/ML SOL INJ CX/250',  und:'CX', marca:'GENERICO' },
  { id:'b', produto:'SERINGA DESCARTAVEL 3ML CX/20',     und:'CX', marca:'SR' },
  { id:'c', produto:'GAZE ESTERIL 7,5X7,5',              und:'CX', marca:'GZ' },
];
const PRELUDIO = `
  let cotacoes = ${JSON.stringify(ESTOQUE)};
  let itens = [], naoEncontrados = [];
  const _log = { toasts: [], render: 0, naoEnc: 0 };
  function toast(m, t){ _log.toasts.push(String(m) + (t ? '/' + t : '')); }
  function renderItens(){ _log.render++; }
  function renderNaoEncontrados(){ _log.naoEnc++; }
  function calcTotal(){}
  function atualizarVisibilidade(){}
  function pv(c){ return 10; }
  function bpAlerta(c){ return null; }
  function _bmConfianca(pedido, c){ return {nivel:'alta', motivos:[]}; }
  // leitor de pack de mentira, com a MESMA resposta do de verdade nos 3 casos que importam
  function qtdEmbalagem(und, produto){ const m = String(produto||'').match(/CX\\/(\\d+)/); return m ? parseInt(m[1],10) : 1; }
  function buscarMelhorProduto(linha){
    const t = String(linha||'').toUpperCase();
    if(/DIPIRONA/.test(t)) return cotacoes[0];
    if(/SERINGA/.test(t))  return cotacoes[1];
    if(/GAZE/.test(t))     return cotacoes[2];
    return null;                                  // ALCOOL GEL nao existe no nosso estoque
  }
`;
const G = (new Function('document', 'window', 'sessionStorage',
  PRELUDIO +
  bloco(giov, 'function _escEd', '// ─── NOME DE FORNECEDOR') +
  'return { pedidoDoEdital, pintaPedidoEdital, importarPedidoEdital, descartarPedidoEdital,'
  + '         _estado: () => ({ itens, naoEncontrados, _log }) };'))(doc, { LimedtecTetoCMED: M }, sessionStorage);

CAIXA['pedido-edital'] = { style:{}, innerHTML:'' };

ok('15. sem pedido guardado, a faixa nem aparece', G.pedidoDoEdital() === null);
G.pintaPedidoEdital();
ok('16. ...e a area fica escondida', CAIXA['pedido-edital'].style.display === 'none');

sessionStorage.setItem('fpmed_pedido_edital', JSON.stringify(pacote));
G.pintaPedidoEdital();
ok('17. *** com pedido, CONVIDA — nao importa sozinho (pode haver outra proposta aberta) ***',
  /Importar os 4 itens/.test(CAIXA['pedido-edital'].innerHTML)
  && G._estado().itens.length === 0, G._estado().itens.length);
ok('18. o convite diz de qual licitacao e de qual orgao',
  /Pregão Eletrônico/.test(CAIXA['pedido-edital'].innerHTML)
  && /MUNICIPIO DE URUACU/.test(CAIXA['pedido-edital'].innerHTML));
ok('19. e avisa, ANTES de importar, que quantidade sem embalagem sabida entra com 1',
  /nunca com um número chutado/.test(CAIXA['pedido-edital'].innerHTML));

G.importarPedidoEdital();
const est = G._estado();
const porId = id => est.itens.find(i => i.id === id);

ok('20. entraram os 3 que casaram (o 4o nao existe no estoque)', est.itens.length === 3, est.itens.map(i=>i.id));
// O edital pede 500 CAIXAS DE 100 = 50.000 unidades; a nossa caixa tem 250 -> 200 caixas nossas.
// Os tres numeros (500 do edital, 50.000 unidades, 200 caixas nossas) sao diferentes de
// proposito: e a unica forma de o teste distinguir a conta certa das duas erradas.
ok('21. *** DIPIRONA: 50.000 unidades / CX nossa de 250 = 200 CAIXAS (nao 500, nao 50.000) ***',
  porId('a') && porId('a').qtd === 200, porId('a') && porId('a').qtd);
ok('22. *** SERINGA: 2.000 unidades / CX nossa de 20 = 100 CAIXAS (nao 2.000) ***',
  porId('b') && porId('b').qtd === 100, porId('b') && porId('b').qtd);
ok('23. *** GAZE: o edital pediu "Caixa" sem contagem -> entra 1, NAO 80 ***',
  porId('c') && porId('c').qtd === 1, porId('c') && porId('c').qtd);
ok('24. ...e o item CARREGA o motivo, na propria linha da proposta',
  porId('c') && /não dá pra saber quantas unidades/.test(porId('c')._qtdAlerta || ''), porId('c') && porId('c')._qtdAlerta);
ok('25. os convertidos NAO ganham etiqueta de conferir (senao ninguem olha nenhuma)',
  !porId('a')._qtdAlerta && !porId('b')._qtdAlerta);
ok('26. *** o resumo LISTA os que precisam de conferencia, com numero do item ***',
  /confira antes de mandar/.test(CAIXA['pedido-edital'].innerHTML)
  && /Item 4/.test(CAIXA['pedido-edital'].innerHTML), CAIXA['pedido-edital'].innerHTML.slice(0,200));
ok('27. *** o que nao casou NAO SOME: vai pra lista de nao encontrados ***',
  est.naoEncontrados.length === 1 && /ALCOOL GEL/.test(est.naoEncontrados[0]), est.naoEncontrados);
ok('28. o numero do item do edital fica gravado no item da proposta (pra conferir depois)',
  porId('a')._itemEdital === 1);
ok('29. a confianca do match entra junto (a trava do PDF depende dela)',
  !!porId('a')._conf && porId('a')._conf.nivel === 'alta');
ok('30. a tela repintou itens e nao-encontrados', est._log.render >= 1 && est._log.naoEnc >= 1);
ok('31. *** o pedido e CONSUMIDO: reabrir a tela nao reimporta em cima ***',
  G.pedidoDoEdital() === null);

// ── repetido no edital: soma, nao duplica ──
sessionStorage.setItem('fpmed_pedido_edital', JSON.stringify({
  de:'licitacoes', lic:{titulo:'Pregão X'},
  itens: [ { n:9, descricao:'SERINGA DESCARTAVEL 3ML', qtdEdital:10, unidade:'Unidade', packEdital:1, qtdUnidades:10, casouAqui:true } ],
}));
G.importarPedidoEdital();
// 10 unidades / CX de 20 = 0,5 caixa -> arredonda PRA CIMA (meia caixa nao se vende), somando 1.
ok('32. item que ja esta na proposta tem a quantidade SOMADA, nao duplicada',
  G._estado().itens.length === 3 && porId('b').qtd === 101, porId('b') && porId('b').qtd);

// ── O OUTRO LADO DA IGNORANCIA: o edital sabe o pack, mas NOS nao ──
// A GAZE de cima caiu no aviso porque o EDITAL nao declarou a contagem. Aqui o edital declara
// ("Unidade" x 80) e quem nao sabe e a NOSSA embalagem ("CX" sem contagem no nome). Os dois
// casos tem que parar na mesma recusa -- e o motivo tem que dizer QUAL dos dois lados nao sabia,
// senao quem confere nao sabe onde procurar.
{
  const antes = porId('c').qtd;
  sessionStorage.setItem('fpmed_pedido_edital', JSON.stringify({
    de:'licitacoes', lic:{titulo:'Pregão Y'},
    itens: [ { n:7, descricao:'GAZE ESTERIL 7,5X7,5', qtdEdital:80, unidade:'Unidade', packEdital:1, qtdUnidades:80, casouAqui:true } ],
  }));
  G.importarPedidoEdital();
  ok('34. *** edital sabe o pack mas a NOSSA embalagem nao e sabida -> soma 1, nao 80 ***',
    porId('c').qtd === antes + 1, { antes, depois: porId('c').qtd });
  ok('35. ...e o aviso aponta o lado certo (a nossa embalagem)',
    /a nossa embalagem não é sabida/.test(CAIXA['pedido-edital'].innerHTML), CAIXA['pedido-edital'].innerHTML.slice(0,300));
}

// ── descartar ──
sessionStorage.setItem('fpmed_pedido_edital', JSON.stringify(pacote));
G.descartarPedidoEdital();
ok('36. descartar apaga o pedido e some com a faixa',
  G.pedidoDoEdital() === null && CAIXA['pedido-edital'].style.display === 'none');

// ── o que a tela promete por escrito ──
ok('37. a proposta avisa que o preco nasce de TABELA, nao do edital',
  /preço de tabela, não com o preço do edital/.test(giov));
/* ══ ASSERT REAPONTADO (13/08, item 8b fatia 3b) — S8 outra vez ══════════════════════════════
   Ele ancorava no LITERAL do toast: `toast(\`✓ ${cotacoes.length} produtos carregados\`)`. O ✓
   era um EMOJI USADO COMO ICONE, e saiu na varredura do D11 — a promessa nao mudou nem um
   pouco, mas o assert ficou vermelho.
   >>> Assert preso a um literal nao guarda a regra, guarda a DECORACAO dela: ele so sabe dizer
       "mudou", nunca "piorou". Agora ele ancora no que a promessa realmente depende — a linha
       que PREENCHE `cotacoes` — e cobra que o `pintaPedidoEdital()` venha DEPOIS dela e antes
       dos enriquecimentos opcionais. Trocar o texto do toast passa; convidar pra importar antes
       do estoque existir, nao. */
ok('38. *** a faixa so aparece depois do estoque carregar (senao o clique nao acha nada) ***',
  /cotacoes = allData\.filter\(incluiNaBusca\);[\s\S]{0,600}?pintaPedidoEdital\(\);/.test(giov)
  && giov.indexOf('pintaPedidoEdital();') < giov.indexOf('_fpOpcional('));
ok('39. e sem estoque carregado o import recusa, em vez de importar zero',
  /if\(!cotacoes\.length\)\{ toast\('O estoque ainda não carregou/.test(giov));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
