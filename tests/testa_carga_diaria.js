// SUITE testa_carga_diaria — O TETO OBEDECE A DIVIDA, E O SALDO DIZ A CADENCIA
// (fatia A34, fechamento · 20/08/2026)
//
// == A EXIGENCIA QUE ESTA SUITE GUARDA =========================================================
// A caixa A34, exigencia (b), letra por letra: "O teto de 400 tem que ser dimensionado pela
// DIVIDA, nao por um numero fixo. (...) e ai DECLARA O SALDO: faltam N, volto na proxima. Teto
// fixo que nunca alcanca a chegada e divida perpetua disfarcada de sucesso."
//
// O condutor cumpriu a primeira metade em 20/08 — e a segunda ficou sem catraca NENHUMA. O
// `tools/carga_diaria.js` inteiro era guardado por UM assert em outra suite (o `FRESCOR_HORAS`
// da testa_pncp_fora, 27), que confere um numero e nao a regra.
//
// == E FOI MEDINDO A CADENCIA QUE O TETO FIXO APARECEU DE NOVO, POR UMA TERCEIRA PORTA =========
// Medido em 20/08 13:12, com o ritmo ja aprendido (0,94 s por licitacao):
//
//     divida 4.558 vivas · orcamento PADRAO de 20 min · teto da rodada: 429
//
// O teto obedece a divida — mas ele e o MENOR entre a divida e o que cabe no orcamento, e a
// rotina escrita no CONTINUAR_AQUI.txt (`node tools/carga_diaria.js`, sem argumento) roda com o
// padrao de 20 minutos. O "400 por rodada" que a A34 matou tinha voltado com o numero 429 e sem
// nome — nao no teto, no ORCAMENTO que alimenta o teto.
//
// >>> E A FRASE "volto na proxima" ERA VERDADEIRA E INSUFICIENTE. Ela e uma PROMESSA: quem le
//     entende que mais algumas rodadas pagam a conta. Sao ONZE, e no meio-tempo a varredura da
//     propria rodada traz mais vivas do que a etapa de itens paga (medido: +2.989 chegaram
//     enquanto 2.887 eram pagas). Saldo sem cadencia esconde a unica pergunta que importa:
//     "isto esta sendo pago, ou esta andando para tras?"
//
// == POR QUE A REGRA E IMPORTADA, E NAO COPIADA AQUI ===========================================
// Duas copias sao duas reguas, e a que discorda calada e a que fica (licao da testa_familia_rok,
// que importa o detector da ferramenta). O `require` do condutor NAO dispara a rodada e NAO le a
// service_role — o bloco 4 cobra as duas coisas, porque um teste que fala com o governo nao e um
// teste, e uma regra que so se testa com a chave-mestra na mao e uma regra que ninguem testa.
//
//   node tests/testa_carga_diaria.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const C = require('../tools/carga_diaria.js');
const src = fs.readFileSync(path.join(raiz, 'tools', 'carga_diaria.js'), 'utf8');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_carga_diaria — o teto pela divida, e o saldo com cadencia\n');

// ══════════ 1. O TETO E DIMENSIONADO PELA DIVIDA (exigencia b) ══════════
{
  ok('1. o condutor pode ser IMPORTADO sem disparar a carga (a regra e perguntavel)',
    typeof C.planoDeItens === 'function' && typeof C.textoDoSaldo === 'function');

  // divida PEQUENA: quem manda e ela, e nao o que caberia no relogio
  const curta = C.planoDeItens({ dividaVivas: 300, orcamentoMin: 200, taxaAnterior: 0.9 });
  ok('2. *** divida menor que o orcamento: o teto e a DIVIDA (nao se pede alvo que nao existe) ***',
    curta.teto === 300 && curta.zeraHoje === true, curta);

  // divida GRANDE: quem manda e o relogio, e a rodada diz que nao zera
  const longa = C.planoDeItens({ dividaVivas: 4558, orcamentoMin: 20, taxaAnterior: 0.944 });
  ok('3. *** divida maior que o orcamento: o teto e o que CABE, e a rodada NAO se diz completa ***',
    longa.teto === longa.cabe && longa.teto < 4558 && longa.zeraHoje === false, longa);

  /* O CORACAO DA EXIGENCIA (b): teto FIXO e o defeito. Se o numero nao se mexe quando o mundo se
     mexe, ele e um 400 com outro nome. As duas entradas que o movem sao medidas de verdade — o
     orcamento (decisao de quem dispara) e o ritmo (medido na rodada anterior). */
  const orcDobro = C.planoDeItens({ dividaVivas: 999999, orcamentoMin: 40, taxaAnterior: 0.944 });
  ok('4. *** dobrar o orcamento dobra o que cabe — o teto NAO e uma constante ***',
    orcDobro.cabe === longa.cabe * 2 || Math.abs(orcDobro.cabe - longa.cabe * 2) <= 1,
    { um: longa.cabe, dois: orcDobro.cabe });

  const ritmoDobro = C.planoDeItens({ dividaVivas: 999999, orcamentoMin: 20, taxaAnterior: 0.472 });
  ok('5. *** e um ritmo duas vezes melhor tambem dobra: a rodada APRENDE, nao decora ***',
    Math.abs(ritmoDobro.cabe - longa.cabe * 2) <= 2, { um: longa.cabe, dois: ritmoDobro.cabe });

  /* A PROVA AO CONTRARIO, e ela e a que pega o retorno do defeito: varro uma faixa de entradas e
     exijo que o teto assuma MUITOS valores distintos. Um teto fixo (400, 429, o que for) passaria
     nos asserts 2 e 3 por acaso em algum ponto da faixa, e reprovaria aqui sempre. */
  const vistos = new Set();
  for (let m = 10; m <= 300; m += 10) vistos.add(C.planoDeItens({ dividaVivas: 999999, orcamentoMin: m, taxaAnterior: 1 }).teto);
  ok('6. *** o "400 por rodada" nao volta por porta nenhuma: 30 orcamentos dao 30 tetos ***',
    vistos.size >= 25, { distintos: vistos.size });

  const semDivida = C.planoDeItens({ dividaVivas: 0, orcamentoMin: 20, taxaAnterior: 0.944 });
  ok('7. divida zerada NAO vira teto zero — a etapa nao fica sem alvo por falta de medida',
    semDivida.teto > 0, semDivida);
  const naoContou = C.planoDeItens({ dividaVivas: null, orcamentoMin: 20, taxaAnterior: 0.944 });
  ok('8. "nao consegui contar a divida" tambem nao vira teto zero (nem vira divida zero)',
    naoContou.teto > 0 && naoContou.divida === null, naoContou);
}

// ══════════ 2. A TAXA APRENDIDA, E O LIMITE DELA ══════════
{
  const medida = C.planoDeItens({ dividaVivas: 999999, orcamentoMin: 20, taxaAnterior: 0.944 });
  ok('9. a taxa da rodada anterior e PREFERIDA sobre o valor de partida',
    medida.medida === true && medida.segPorLic === 0.944, medida);

  const semTaxa = C.planoDeItens({ dividaVivas: 999999, orcamentoMin: 20, taxaAnterior: null });
  ok('10. sem medida, cai no valor de partida — e ele e o PIOR caso conhecido, nao o melhor',
    semTaxa.medida === false && semTaxa.segPorLic === C.SEG_POR_LIC_PADRAO
    && C.SEG_POR_LIC_PADRAO > 0.944, { usou: semTaxa.segPorLic, padrao: C.SEG_POR_LIC_PADRAO });

  /* Uma etapa morta em dois segundos sem processar nada devolveria uma taxa perto de zero. Aceita,
     ela faria o teto seguinte ficar astronomico — e a etapa morreria de novo, agora por culpa da
     propria medicao. O defeito se realimentaria e pareceria piora do PNCP. */
  const absurda = C.planoDeItens({ dividaVivas: 999999, orcamentoMin: 20, taxaAnterior: 0.001 });
  ok('11. *** taxa absurda e RECUSADA: medicao de etapa morta nao pode dimensionar a proxima ***',
    absurda.medida === false && absurda.segPorLic === C.SEG_POR_LIC_PADRAO, absurda);
}

// ══════════ 3. A CADENCIA — a diferenca entre um saldo e uma promessa ══════════
{
  const longa = C.planoDeItens({ dividaVivas: 4558, orcamentoMin: 20, taxaAnterior: 0.944 });
  ok('12. *** quando nao zera, o plano diz EM QUANTAS RODADAS zera ***',
    longa.rodadasParaZerar === 11, longa.rodadasParaZerar);
  ok('13. ...e diz o --minutos que zeraria numa rodada so',
    longa.minutosParaZerar > 0 && longa.minutosParaZerar > 20, longa.minutosParaZerar);

  /* A CONTA FECHA NELA MESMA, e este e o assert que impede um numero decorativo: devolvo ao plano
     o proprio `--minutos` que ele recomendou e exijo que agora a divida CAIBA. Um numero
     recomendado que nao resolve o que prometeu e pior que nao recomendar nada. */
  const comOTempoQuePediu = C.planoDeItens({
    dividaVivas: 4558, orcamentoMin: longa.minutosParaZerar, taxaAnterior: 0.944 });
  ok('14. *** e o --minutos recomendado DE FATO zera: a conta fecha nela mesma ***',
    comOTempoQuePediu.zeraHoje === true && comOTempoQuePediu.teto === 4558, comOTempoQuePediu);

  const curta = C.planoDeItens({ dividaVivas: 300, orcamentoMin: 200, taxaAnterior: 0.9 });
  ok('15. quando zera hoje NAO ha cadencia — nao se inventa promessa onde nao ha divida',
    curta.rodadasParaZerar === null && curta.minutosParaZerar === null, curta);

  // ── o texto, que e o que a pessoa le ──
  const t = C.textoDoSaldo(4558, longa);
  ok('16. *** o saldo diz o NUMERO e a CADENCIA, e nao so "volto na proxima" ***',
    /4\.558/.test(t) && /11 rodadas/.test(t) && /--minutos 213/.test(t), t);
  ok('17. ...e nao promete uma proxima rodada que nao alcanca',
    !/volto na próxima/.test(t) && !/volto na proxima/.test(t), t);

  ok('18. divida zerada: o texto diz zerada, e nao promete rodada nenhuma',
    /zerada/.test(C.textoDoSaldo(0, longa)), C.textoDoSaldo(0, longa));

  /* "NAO CONSEGUI PERGUNTAR" NUNCA VIRA "NAO EXISTE" — a lei da A19, aqui na forma do saldo. Se a
     contagem do depois falhar, `null` NAO pode sair como "a divida esta zerada": a tela e o
     relatorio leriam sucesso onde houve cegueira. */
  ok('19. *** saldo que nao pode ser medido NAO vira "zerada" (a lei da A19) ***',
    C.textoDoSaldo(null, longa) === null, C.textoDoSaldo(null, longa));
}

// ══════════ 4. O QUE A A34 JA TINHA E NAO PODE REGREDIR (na fonte) ══════════
{
  /* `ultima_ok` e o que a FAIXA DE FRESCOR da Encontrar le para dizer a idade do dado. Avanca-lo
     numa rodada cortada faria a tela dizer "atualizado agora" sobre uma carga que nao terminou —
     e e exatamente a exigencia (c) da caixa, que chamou o `ultima_ok` NULL de alarme. */
  ok('20. *** `ultima_ok` so e escrito quando a rodada foi boa de verdade ***',
    /if \(okDeVerdade\) linha\.ultima_ok = iso\(fim\);/.test(src));
  ok('21. ...e "boa de verdade" exclui etapa morta pelo relogio',
    /const okDeVerdade = !feitas\.some\(f => f\.interrompida/.test(src));

  /* `motivos` vira o `ultimo_erro` da linha, e a tela le `ultimo_erro` para dizer "a ultima carga
     falhou". Um saldo la dentro faria toda rodada honesta ser acusada de falha. */
  ok('22. o saldo NAO entra em `motivos` (senao a tela acusa falha em rodada honesta)',
    !/motivos\.push\([^)]*saldo/i.test(src));

  ok('23. a taxa aprendida ENTRA no carimbo — aprender sem anotar e nao aprender',
    /seg_por_lic:/.test(src) && /rodadas_para_zerar: plano\.rodadasParaZerar/.test(src));

  /* A CREDENCIAL E PREGUICOSA, e isto e o que permite esta suite existir: um `require` que lesse a
     service_role morreria com `process.exit(1)` em qualquer maquina sem o segredo — e a regra
     ficaria sem catraca por causa da porta, nao por causa da regra. */
  const iBanco = src.indexOf('function banco()');
  /* `lastIndexOf`, e a primeira versao deste assert usava `indexOf` e ficou VERMELHA com o codigo
     certo: ha DOIS `return _banco;` — o de cima e o atalho do memo (`if (_banco) return _banco;`),
     que fica ANTES da leitura do segredo. Fechar a janela no primeiro media um pedaco da funcao
     que nao contem o que a pergunta procura. */
  const iFim = src.lastIndexOf('return _banco;');
  const iSeg = src.indexOf("'segredos.local.txt'");
  ok('24. *** o segredo e lido DENTRO de banco(), nunca ao carregar o arquivo ***',
    iBanco > 0 && iSeg > iBanco && iSeg < iFim, { banco: iBanco, segredo: iSeg, fim: iFim });
  ok('25. ...e o corpo da rodada so dispara quando o arquivo E o comando',
    /if \(require\.main !== module\) return;/.test(src));

  ok('26. o numero de horas do frescor continua sendo UM SO, e a tela le o mesmo',
    C.FRESCOR_HORAS === 12
    && /const FRESCOR_HORAS = 12;/.test(fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8')));
}

// ══════════ 6. O ORCAMENTO DEIXOU DE SER UM NUMERO E VIROU UMA DECISAO (A44 · 21/08/2026) ══════════
// A caixa A44: "a carga vira servico, e o dono para de ser operador". Em 20/08 ele teve de abrir o
// Explorador e dar dois cliques num .bat com `--forcar --minutos 213` para zerar a divida de itens.
//
// == O NUMERO DA REGRA, MEDIDO EM 21/08 11:37 ==================================================
//     divida 3.094 vivas sem item · ritmo MEDIDO 0,755 s por licitacao · padrao 20 min
//     zerar de uma vez = 3.094 x 0,755 / (0,45 x 60 x 0,75) = 116 min
// Com 20 min cabem 429 -> 8 rodadas. Com o teto automatico de 60 cabem 1.609 -> 2 rodadas.
//
// == E O ACHADO QUE MUDOU O DESENHO DA REGRA ===================================================
// O orcamento e rateado pelo FATIA, entao os `--minutos 213` do dono deram 47 minutos a
// VARREDURA tambem — e ela usou 1.263 s para trazer 7.273 licitacoes NOVAS. A divida que ele
// estava pagando terminou a rodada MAIOR do que comecou. Comprar tempo para todas as etapas
// para pagar a divida de UMA delas e encher o balde pelo mesmo cano que se esvazia.
// >>> ENTAO, NO CAMINHO AUTOMATICO, so a etapa de ITENS cresce.
// >>> E NO CAMINHO DO DONO, NADA disso se aplica: o numero dele e o orcamento inteiro. Uma
//     ferramenta que faz outra coisa com o numero que voce digitou e pior que o defeito.
{
  const R = (o) => C.orcamentoDaRodada(o);
  const HOJE = { dividaVivas: 3094, taxaAnterior: 0.755 };

  ok('42. a regra do orcamento pode ser IMPORTADA sem chave-mestra e sem disparar a carga',
    typeof C.orcamentoDaRodada === 'function' && C.ORCAMENTO_PADRAO_MIN === 20);

  // ── o caminho do dono: a ordem dele nao e reinterpretada ──
  const dono = R(Object.assign({ pedidoDoDono: 213 }, HOJE));
  ok('43. *** o `--minutos` do DONO vence a regra, sempre ***',
    dono.minutos === 213 && dono.quem === 'dono', [dono.minutos, dono.quem]);
  ok('44. ...e no caminho dele TODAS as etapas crescem (o numero dele e o orcamento inteiro)',
    Math.round(dono.etapas.varredura) === Math.round(213 * C.FATIA.varredura)
    && Math.round(dono.etapas.prazos) === Math.round(213 * C.FATIA.prazos),
    dono.etapas);
  // Um `--minutos 0` ou `--minutos -5` nao pode desligar a rodada pela porta dos fundos.
  ok('45. um pedido de 0 ou negativo NAO vale como ordem (a rodada nao morre por digito torto)',
    R(Object.assign({ pedidoDoDono: 0 }, HOJE)).quem !== 'dono'
    && R(Object.assign({ pedidoDoDono: -5 }, HOJE)).quem !== 'dono');

  // ── o caminho automatico ──
  const auto = R(HOJE);
  ok('46. *** com a divida de hoje a regra compra tempo sozinha: 60 min, sem o dono clicar em nada ***',
    auto.minutos === 60 && auto.quem === 'teto', [auto.minutos, auto.quem]);
  ok('47. ...e ela DIZ o que a divida pediria e qual `--minutos` passaria do teto',
    auto.querido === 116 && /--minutos 116/.test(auto.frase), [auto.querido, auto.frase]);
  ok('48. *** SO A ETAPA DE ITENS CRESCEU — a varredura ficou com a fatia do PADRAO ***',
    Math.abs(auto.etapas.varredura - 20 * C.FATIA.varredura) < 1e-9
    && Math.abs(auto.etapas.prazos - 20 * C.FATIA.prazos) < 1e-9
    && Math.abs(auto.etapas.itens - 60 * C.FATIA.itens) < 1e-9, auto.etapas);
  // Se a varredura crescesse junto, o relogio da rodada seria 60; ele e 38 porque ela nao cresceu.
  ok('49. ...e por isso o relogio no pior caso e 38 min, e nao 60',
    auto.minutosDeRelogio === 38, auto.minutosDeRelogio);

  ok('50. divida que cabe no padrao NAO faz a regra comprar nada',
    R({ dividaVivas: 200, taxaAnterior: 0.755 }).quem === 'padrao'
    && R({ dividaVivas: 200, taxaAnterior: 0.755 }).minutos === 20);
  ok('51. *** a regra NUNCA encolhe a rodada abaixo do padrao ***',
    R({ dividaVivas: 5, taxaAnterior: 0.755 }).minutos >= 20
    && R({ dividaVivas: null, taxaAnterior: 0.755 }).minutos === 20);
  // Sem teto, uma divida grande pediria 746 min: 12 HORAS de maquina decididas por ninguem.
  ok('52. *** o teto AUTOMATICO existe e ele PARA: divida de 20.000 nao vira 746 min sozinha ***',
    R({ dividaVivas: 20000, taxaAnterior: 0.755 }).minutos === 60
    && R({ dividaVivas: 20000, taxaAnterior: 0.755 }).querido === 746,
    R({ dividaVivas: 20000, taxaAnterior: 0.755 }));
  ok('53. ...e o teto e um parametro, entao o dono pode move-lo sem editar codigo',
    R({ dividaVivas: 20000, taxaAnterior: 0.755, tetoAutomatico: 120 }).minutos === 120
    && C.TETO_AUTOMATICO_MIN === 60);

  // ── o ritmo E a divida mandam nos dois: a regra tem que responder aos DOIS ──
  // Se so a divida mandasse, uma maquina lenta pediria os mesmos minutos de uma rapida.
  const lento = R({ dividaVivas: 1000, taxaAnterior: 2.0 });
  const rapido2 = R({ dividaVivas: 1000, taxaAnterior: 0.5 });
  ok('54. *** o RITMO MEDIDO manda junto com a divida: a mesma divida a 2,0 s/lic pede mais ***',
    lento.querido > rapido2.querido, [lento.querido, rapido2.querido]);
  // taxa absurda (etapa que morreu em 2 s) cai no valor de partida, e nao num teto astronomico
  ok('55. taxa absurda da rodada anterior cai no valor de partida, e nao vira orcamento de brinquedo',
    R({ dividaVivas: 3094, taxaAnterior: 0.001 }).querido
      === R({ dividaVivas: 3094, taxaAnterior: null }).querido);

  // ── e na FONTE: o rateio nao pode voltar a ser escrito em dois lugares ──
  ok('56. *** o orcamento e decidido DEPOIS do retrato (antes ninguem sabe o tamanho da divida) ***',
    src.indexOf('const antes = await retrato()') < src.indexOf('const orc = orcamentoDaRodada('));
  /* O ASSERT 57 PRECISOU OLHAR SO O CODIGO, e isso e um achado pequeno que vale anotar: na
     primeira escrita ele reprovou contra o arquivo CERTO, porque o comentario que explica a
     mudanca CITA a forma antiga (`ORCAMENTO_MIN * e.fatia`) para dizer que ela saiu. Um assert
     de "isto nao existe mais" que le comentario proibe a ferramenta de EXPLICAR o proprio
     conserto — e explicar o conserto e metade do valor do comentario nesta casa. */
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  ok('57. ...e o orcamento de cada etapa vem de `orc.etapas`, nao de uma multiplicacao solta',
    /const minutosDa = e => orc\.etapas\[e\.nome\]/.test(codigo)
    && !/ORCAMENTO_MIN \* e\.fatia/.test(codigo));
  ok('58. *** QUEM decidiu o orcamento vai pro carimbo (60 min sem dono e frase ambigua) ***',
    /orcamento_quem: orc\.quem/.test(src) && /orcamento_querido: orc\.querido/.test(src)
    && /orcamento_teto_automatico: orc\.teto/.test(src));
  ok('59. ...e o `--carimbo` mostra isso para quem abre o carimbo dias depois',
    /decidido por: /.test(src) && /ORDEM DO DONO \(--minutos\)/.test(src));
  // A ociosidade que a caixa pediu NAO foi medida — e o arquivo tem que dizer isso, nao fingir.
  ok('60. *** o arquivo DECLARA que nao sabe medir "maquina ociosa" em vez de inventar um sensor ***',
    /EU NÃO SEI MEDIR ISSO, E NÃO VOU FINGIR/.test(src));
  ok('61. ...e declara O QUE SE PERDE (a previsibilidade do relogio da rodada)',
    /══ O QUE SE PERDE ══/.test(src) && /mediana é 57 min/.test(src));
  /* UMA REGRA CEGA DECIDE SEMPRE 20. Os asserts de 46 a 55 chamam a funcao com os numeros na
     mao, entao eles continuariam verdes se a RODADA parasse de passar a divida e o ritmo para
     ela — a regra estaria certa e nunca seria consultada de verdade. Este assert e a ligacao
     entre as duas pontas: o que a rodada MEDE tem que chegar em quem DECIDE. */
  /* ══ O ASSERT QUE NASCEU DE UMA MUTACAO QUE ESCAPOU ═════════════════════════════════════
     O `tools/muta_a44.js` tirou o `Math.max(padrao, ...)` do orcamento e esta suite NAO
     reclamou. Investigado: o `Math.max` era INALCANCAVEL — chegar la exige `divida > cabe`, e
     como `cabe` e `minutosParaZerar` sao a mesma conversao em sentidos opostos, isso ja
     implica `querido > padrao`. O cinto de seguranca nunca podia apertar, e a casa chama gesto
     sem efeito de "a pior categoria de codigo vivo" (testa_busca_placeholder, 32). Ele saiu.
     >>> MAS A PROPRIEDADE CONTINUA VALENDO, e agora e ELA que e cobrada, em 40 pares de
         (divida, ritmo) — inclusive os absurdos. A garantia era da algebra; algebra se guarda
         com prova, nao com uma linha que finge trabalhar. Se alguem desacoplar as formulas
         (mexer no zeraHoje, por exemplo), este assert grita — o Math.max teria escondido. */
  {
    let piorMin = Infinity, piorCaso = null;
    for (const d of [1, 5, 50, 429, 430, 1000, 3094, 20000, 500000])
      for (const t of [null, 0.001, 0.05, 0.3, 0.755, 0.944, 2.0, 12.0]) {
        const r = R({ dividaVivas: d, taxaAnterior: t });
        if (r.minutos < piorMin) { piorMin = r.minutos; piorCaso = { divida: d, taxa: t, r }; }
      }
    ok('63. *** a regra NUNCA compra menos que o padrao, em 72 pares de (divida, ritmo) ***',
      piorMin >= C.ORCAMENTO_PADRAO_MIN, { piorMin, piorCaso });
  }

  ok('62. *** e a rodada alimenta a regra com a divida E o ritmo MEDIDOS, nao com o vazio ***',
    /orcamentoDaRodada\(\{[\s\S]{0,400}?dividaVivas: antes\.vivas_sem_itens[\s\S]{0,400}?taxaAnterior: carimboAntes[\s\S]{0,400}?pedidoDoDono: ORCAMENTO_PEDIDO/.test(codigo));
}

// ══════════ 5. A REDE QUE PISCA NAO E FIM DE RODADA (fatia A39 · 20/08/2026) ══════════
// A rodada inteira terminava numa unica chamada — o `POST coleta_status` — sem retentativa, com um
// `.catch` que devolvia um objeto falso-ok. Um `fetch failed` ali apagava a prestacao de contas de
// vinte minutos de trabalho que JA ESTAVA no banco. E o mesmo defeito que matou tres ciclos do
// trabalhador A com ENOTFOUND, um deles com 2h33 de trabalho.
{
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a39carga_'));
  // um plano CURTO, para a suite nao esperar 26 s por assert. O plano de PRODUCAO e conferido
  // logo abaixo, pelo numero — as duas perguntas sao diferentes e as duas precisam de resposta.
  const rapido = { tentativas: 3, espera: () => 1 };
  const MORTA = 'http://nao-existe-fpmed-a39.invalid';

  ok('27. as regras da A39 podem ser IMPORTADAS sem chave-mestra e sem disparar a carga',
    typeof C.fetchTeimoso === 'function' && typeof C.gravaCarimbo === 'function'
    && typeof C.reenviaPendentes === 'function' && typeof C.guardaCarimboEmDisco === 'function');

  ok('28. *** o plano de PRODUCAO e teto de 4 tentativas com espera CRESCENTE (2s · 6s · 18s) ***',
    C.TENTATIVAS_REDE === 4 && C.esperaCrescente(0) === 2000 && C.esperaCrescente(1) === 6000
    && C.esperaCrescente(2) === 18000,
    [C.TENTATIVAS_REDE, C.esperaCrescente(0), C.esperaCrescente(1), C.esperaCrescente(2)]);
  ok('29. ...e a espera tem TETO — sem ele a decima tentativa dormiria 33 horas',
    C.esperaCrescente(9) === 18000 && C.esperaCrescente(50) === 18000, C.esperaCrescente(9));

  ok('30. ENOTFOUND e `fetch failed` sao reconhecidos como queda de rede',
    C.ehQuedaDeRede(new Error('getaddrinfo ENOTFOUND pncp.gov.br'))
    && C.ehQuedaDeRede(new Error('fetch failed')) && C.ehQuedaDeRede(new Error('ECONNRESET')));
  ok('31. ...e um 401 NAO e: retentar porta trancada e bater tres vezes na mesma porta',
    !C.ehQuedaDeRede(new Error('HTTP 401 Unauthorized')));

  // ── o desfecho de verdade, com uma queda de rede de verdade (dominio .invalid) ──
  // O fecho da suite mora AQUI DENTRO porque estes asserts sao assincronos: imprimir o RESULTADO
  // la embaixo, fora da promessa, contaria o placar antes de eles rodarem — e a suite sairia
  // verde por nao ter esperado. E o `run_all.js` le exatamente essa linha.
  const linha = { fonte: 'CARGA', registros: 7273, detalhe: { saldo: 'faltam 4.558 vivas sem item' } };
  (async () => {
    let subiu = null;
    try { await C.fetchTeimoso(MORTA + '/x', {}, 'teste', rapido); }
    catch (e) { subiu = e; }
    ok('32. *** depois das tentativas o erro CONTINUA sendo erro — retentar e legitimo, engolir nao ***',
      subiu instanceof Error && subiu.tentativas === 3 && subiu.quedaDeRede === true,
      subiu && subiu.message);

    const r = await C.gravaCarimbo(linha, { SB: MORTA, H: {} }, rapido, tmp);
    ok('33. *** a rede caiu e o carimbo NAO se declara gravado ***', r.ok === false, r.status);
    ok('34. *** ...e o carimbo foi GRAVADO NO DISCO, inteiro, em vez de evaporar ***',
      !!r.pendente && fs.existsSync(r.pendente), r.pendente);

    const guardado = JSON.parse(fs.readFileSync(r.pendente, 'utf8'));
    ok('35. o que foi pro disco e a LINHA INTEIRA, com o saldo medido — nao um resumo',
      guardado.linha.registros === 7273
      && guardado.linha.detalhe.saldo === 'faltam 4.558 vivas sem item', guardado.linha);
    ok('36. ...e ele diz POR QUE ficou pendente e a que hora',
      /invalid|fetch failed|ENOTFOUND|tentativas/i.test(guardado.porque) && !!guardado.gravado_em,
      guardado.porque);

    // ── o reenvio: com a porta ainda fechada, o arquivo NAO pode sumir ──
    const antes = fs.readdirSync(tmp).length;
    await C.reenviaPendentes({ SB: MORTA, H: {} }, rapido, tmp);
    ok('37. *** porta ainda fechada: o pendente FICA no disco (apagar antes = registro adiado -> nenhum) ***',
      fs.readdirSync(tmp).length === antes, fs.readdirSync(tmp));

    // duas quedas seguidas nao podem virar um arquivo so
    const r2 = await C.gravaCarimbo(linha, { SB: MORTA, H: {} }, rapido, tmp);
    ok('38. duas quedas no mesmo instante geram DOIS arquivos (uma nao sobrescreve a outra)',
      r2.pendente !== r.pendente && fs.readdirSync(tmp).length === antes + 1, fs.readdirSync(tmp));

    // ── e na FONTE: o `.catch` falso-ok nao pode voltar ──
    ok('39. *** a gravacao do carimbo passa pela teimosa, e nao por um `fetch` nu com .catch ***',
      /const r = await gravaCarimbo\(linha\)/.test(src)
      && !/\}\)\.catch\(e => \(\{ ok: false, status: e\.message \}\)\)/.test(src));
    ok('40. carimbo que nao chegou ao banco faz a rodada sair com codigo != 0',
      /if \(!r \|\| !r\.ok\) \{[\s\S]{0,900}?process\.exitCode = 1;/.test(src));
    ok('41. e o console DIZ onde o carimbo ficou e como reenviar',
      /--carimbos-pendentes/.test(src) && /O CARIMBO ESTÁ NO DISCO/.test(src));

    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
    console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
    process.exit(f ? 1 : 0);
  })().catch(e => { console.log('  FALHA bloco 5 estourou: ' + e.message);
    console.log('\nRESULTADO: ' + p + ' ok, ' + (f + 1) + ' falha(s)'); process.exit(1); });
}
