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
