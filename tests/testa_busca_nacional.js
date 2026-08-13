// SUITE testa_busca_nacional — quando o operador digita um termo, a pergunta e sobre o BRASIL.
//
// ══ O QUE FOI MEDIDO EM 11/08, e que esta suite existe pra nao deixar quebrar ═══════════════
// Termo "albumina", contra o endpoint publico /api/search/ do PNCP:
//   total no Brasil ..... 3.639        · trazidos 30 · **30/30 contem a palavra**
//   estados ............. RJ 11 · SP 8 · BA 3 · MG 2 · PR/RS/PB/ES/MS/AM 1 cada
//   ja no nosso indice .. **0 de 30**  (e exatamente isto que a busca nacional acrescenta)
//   filtrando por GO .... 213
//   PORTAL de origem .... NAO EXISTE (dos 53 campos da resposta)
//
// >>> A DESCOBERTA QUE MAIS IMPORTA: `ordenacao=-data` devolve **0/30** com a palavra. Eu copiei
//     esse parametro da URL do site, medi, e quase relatei que o endpoint nao servia. Ele joga a
//     relevancia fora e traz os editais mais NOVOS que casaram com qualquer coisa. Na ordenacao
//     PADRAO sao 30/30. Por isso a tela NAO manda `ordenacao` — e este assert existe pra que
//     ninguem "melhore" a busca acrescentando ordem por data e quebre tudo em silencio.
//
//   node tests/testa_busca_nacional.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const L = R('fpmed_licitacoes.html');
const P = R('tools', 'prova_busca_nacional.js');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_busca_nacional — o Brasil inteiro, com procedencia dita\n');

// ══════════ 1. A ORDENACAO ══════════
ok('1. *** a tela NAO manda `ordenacao` na busca nacional ***',
  /function buscarNacional\(termo, uf\)/.test(L)
  && !/buscarNacional[\s\S]{0,600}ordenacao=/.test(L));
ok('2. *** e o motivo esta escrito, com o numero medido ***',
  /\*\*0 de 20 resultados continham a palavra buscada\*\*/.test(uc(L)));
ok('3. ...e que o erro foi MEU, nao do endpoint', /O erro era MEU/.test(L));
ok('4. *** a prova mede as DUAS ordenacoes lado a lado ***',
  /url\(TERMO, '', '-data'\)/.test(P) && /A ORDENACAO, MEDIDA/.test(P));
ok('5. ...e exige que a por data seja PIOR (senao alguem a reintroduz)',
  /ok\('3\. \*\*\* a ordenacao por DATA quebra isso/.test(P) && /contemData < contem\.length/.test(P));

// ══════════ 2. SO API PUBLICA DO PNCP ══════════
ok('6. *** o endpoint e o do PNCP, publico ***', /const PNCP_BUSCA = 'https:\/\/pncp\.gov\.br\/api\/search\/';/.test(L));
ok('7. *** e nao ha nenhum endpoint de portal privado ***',
  !/bll\.org|bllcompras|bnccompras|licitanet\.com|portaldecompraspublicas\.com/i.test(L));
ok('8. ...e a tela DIZ por que o PNCP basta (todos publicam la por obrigacao)',
  /todos os portais \(BLL, BNC, Licitanet, Compras\.gov\) publicam lá por obrigação/.test(L));

// ══════════ 3. DUAS PROCEDENCIAS, NUNCA MISTURADAS ══════════
/* ══ 13/08, ITEM 7d — TRES ASSERTS REAPONTADOS, e os tres mediam O MEIO (licao S8) ═══════════
   A busca nacional deixou de ser tabela crua e virou o painel do molde. Nada do que estes tres
   asserts PROMETIAM piorou — o que mudou foi a peca que eles estavam olhando:
     · o 9 cobrava `border-top:1px dashed`. O tracejado separava a tabela do que vinha acima;
       agora o que vem e um PAINEL, que tem fronteira propria, e duas linhas dizendo a mesma
       coisa e ruido. A promessa e "os dois blocos sao separados", nao "ha um tracejado";
     · o 11 cobrava o emoji 🌎 no titulo. Emoji como icone e proibido por D11, e o recado de
       procedencia virou um SELO com o icone do sprite. A promessa e "cada bloco se identifica";
     · (o 24, 26 e 27 estao mais abaixo, pelo mesmo motivo.)
   >>> ELES FICARAM COM MAIS DENTE, e nao com menos: o 9 agora exige que o bloco nacional esteja
       FORA do #lista (que e o que "separado" quer dizer de verdade — o tracejado podia sumir com
       os dois blocos ainda separados, e podia existir com os dois grudados). */
(function () {
  /* "SEPARADO" quer dizer IRMAO, nao vizinho: o #lista tem que FECHAR antes de o #nacional
     abrir. Se um dia o nacional cair dentro do #lista, o `lista.innerHTML = h` do render
     apagaria o bloco nacional a cada busca — e o sintoma seria a busca nacional "sumindo"
     sozinha, que e o defeito de 11/08 voltando por outra porta.
     >>> A CONTA E DE DIVS BALANCEADAS. A minha primeira versao usava uma regex gulosa que
         varria o arquivo inteiro e dava vermelho sem defeito nenhum — instrumento torto pela
         terceira vez nesta rodada (S10). */
  const iL = L.indexOf('<div id="lista">'), iN = L.indexOf('<div id="nacional"');
  const meio = iL >= 0 && iN > iL ? L.slice(iL, iN) : '';
  const abre = (meio.match(/<div\b/g) || []).length;
  const fecha = (meio.match(/<\/div>/g) || []).length;
  ok('9. *** o bloco nacional e SEPARADO do indice (o #lista fecha antes) ***',
    iL >= 0 && iN > iL && abre > 0 && abre === fecha, { abre, fecha, iL, iN });
})();
ok('10. ...e o motivo esta escrito (misturar faria tratar como igual o que nao e)',
  /misturar as duas numa lista só faria o operador\s*tratar como igual o que não é/.test(uc(L)));
ok('11. *** cada bloco se identifica: nacional ao vivo x o indice acima ***',
  /ao vivo · PNCP/.test(L) && /selo-fonte/.test(L));
/* ── 11/08, DEFEITO EM PRODUCAO: O BLOCO NAO PINTAVA COM 0 NO INDICE ────────────────────────
   O disparo estava DEPOIS do `return` do caso vazio, entao com "0 batem" a busca nacional nunca
   rodava — justamente a hora em que ela mais faz falta. O operador viu "0 batem" e nada embaixo
   e concluiu que o recurso nao estava no ar; estava, e o PNCP tambem (medido: HTTP 200 em 102ms).
   Estes tres asserts existem pra que isso nao volte. */
ok('12. *** o disparo vem ANTES do return do caso vazio ***',
  L.indexOf('nacionalProtegido();') < L.indexOf('lista.innerHTML=h; return;')
  && L.indexOf('nacionalProtegido();') > 0);
ok('12b. *** e o caso "0 no indice" AVISA que esta procurando no Brasil ***',
  /Procurando "' \+ esc\(termoNacional\(\)\) \+ '" no PNCP nacional logo abaixo/.test(L)
  && /ZERO NO ÍNDICE NÃO É ZERO NO BRASIL/.test(L));
ok('12c. *** sem termo o bloco tambem NAO some calado: explica o gesto ***',
  /digite <b>um único termo<\/b> no campo de busca/.test(L)
  && /só aparece quando alguém adivinha o gesto certo é um recurso que ninguém acha/.test(uc(L)));
/* O `i` entrou em 13/08: a frase virou inicio de sentenca em negrito ("A busca nacional
   falhou..."), entao a inicial subiu. Cobrar a CAIXA da primeira letra e cobrar tipografia, nao
   comportamento — e o comportamento e o que este assert existe pra guardar. */
ok('12d. *** e um erro sincrono nao derruba a lista inteira ***',
  /function nacionalProtegido\(\)/.test(L) && /a busca nacional falhou aqui na tela/i.test(L));
ok('12e. ...com a regra escrita (busca que falha calada parece busca que nao existe)',
  /BUSCA QUE FALHA CALADA PARECE BUSCA QUE NÃO EXISTE/.test(L));
ok('13. resposta lenta de uma busca antiga nao pinta em cima da nova',
  /const meu = \+\+_nacToken;/.test(L) && /if\(meu !== _nacToken\) return;/.test(L));

// ══════════ 4. QUANDO ELA ENTRA ══════════
ok('14. *** so com UM termo especifico, e nao com a lista de categorias ***',
  /if\(partes\.length !== 1\) return null;/.test(L));
ok('15. ...com o motivo (as 6 categorias padrao dariam dezenas de milhares de qualquer coisa)',
  /uma lista assim não é uma resposta, é ruído com\s*aparência de trabalho/.test(uc(L)));
ok('16. ...e o gesto que dispara e o do pedido (apagou tudo e escreveu "albumina")',
  /a pessoa apagou tudo e escreveu "albumina"/.test(uc(L)));
ok('17. termo curto demais nao dispara', /partes\[0\]\.length >= 3 \? partes\[0\] : null/.test(L));
ok('18. o filtro de UF da tela e respeitado', /uf \? '&ufs=' \+ encodeURIComponent\(uf\) : ''/.test(L));

// ══════════ 5. O TRATAMENTO DE QUEDA ══════════
ok('19. *** PNCP fora NAO apaga o indice: vira faixa discreta ***',
  /não consegui consultar o PNCP nacional agora/i.test(L));
ok('20. *** e nunca "nenhum resultado nacional" ***',
  /Isto <b>não<\/b> quer dizer que não haja nada/.test(L));
ok('21. ...com o motivo (seria afirmar que o Brasil nao tem o que a pessoa procura)',
  /que seria afirmar que o Brasil não tem o que a pessoa procura/.test(uc(L)));
ok('22. *** e zero DE VERDADE e dito como zero (a consulta foi feita e voltou vazia) ***',
  /Aqui <b>zero quer dizer zero<\/b> — a consulta foi feita e voltou vazia/.test(L));

// ══════════ 6. AS LIMITACOES, DITAS ONDE SE OLHA ══════════
ok('23. *** o PORTAL de origem NAO existe na resposta, e a tela diz ***',
  /o PNCP <b>não informa o portal<\/b>/.test(L));
/* REAPONTADO em 13/08 (item 7d): nao ha mais COLUNA — a tabela crua virou linha de painel. E a
   promessa ficou MAIOR, porque o valor entrou nela: o PNCP tambem nao manda `valor_global`
   (medido, 0 de 30), e o perigo dos dois campos e o mesmo — alguem "completar" a ausencia com
   um travessao, e o proximo completar com R$ 0 (S6). Agora o assert cobra os dois. */
ok('24. ...e os campos ausentes ficam FORA da linha em vez de chutados (portal e valor)',
  /ficam de fora da linha em vez de aparecerem chutados/.test(L)
  && /não traz o valor estimado/.test(L));
ok('25. ...e a prova CONFIRMA que o campo nao existe (nao e desleixo meu)',
  /ok\('7\. \*\*\* e o PORTAL de origem NAO existe/.test(P) && /temPortal\.length === 0/.test(P));
ok('26. *** a ordem por semelhanca (nao por data) e dita na tela ***',
  /a ordem é por <b>semelhança, não por data<\/b>/.test(L));
/* REAPONTADO em 13/08: "pode vir edital antigo" era o aviso possivel quando ninguem tinha
   medido. Agora esta medido — "albumina" 26/30 com vigencia e ZERO no futuro; "dipirona" 22/30
   e ZERO no futuro — e a tela diz a consequencia, que e mais forte que a possibilidade:
   a MAIORIA ja esta com a vigencia encerrada. Assert que exigisse a frase velha obrigaria a
   tela a ser mais vaga do que ela pode ser. */
ok('27. ...avisando que a maioria ja vem com a vigencia encerrada (medido, nao suposto)',
  /a maioria dos resultados já está com a vigência encerrada/.test(L));
ok('28. *** o que ja esta no nosso indice e MARCADO, e nao escondido ***',
  /já no nosso índice/.test(L));
ok('29. ...com o motivo (escondido, o total nacional nao bate com a lista)',
  /o operador não entende\s*por que o total nacional não bate com a lista/.test(uc(L)));

// ══════════ 7. A PROVA REAL ══════════
ok('30. *** a prova exige que >=80% dos resultados contenham a palavra ***',
  /contem\.length >= Math\.ceil\(itens\.length \* 0\.8\)/.test(P));
ok('31. *** e que ele ache o que o nosso indice NAO tem ***', /nossos < nums\.length/.test(P));
ok('32. *** e que o filtro de UF funcione ***', /jg\.total < j\.total/.test(P));
ok('33. *** e que o CORS seja aberto (senao a tela precisaria de proxy) ***',
  /access-control-allow-origin'\) \|\| ''\) === '\*'/.test(P));
ok('34. a prova registra que o User-Agent so e preciso no node, e nao na tela',
  /a TELA nao precisa, porque navegador manda o dele sozinho/.test(uc(P)));
ok('35. e os numeros medidos ficam no cabecalho da suite (nao so no commit)',
  /total no Brasil \.\.\.\.\. 3\.639/.test(R('tests', 'testa_busca_nacional.js')));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
