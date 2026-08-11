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
ok('9. *** o bloco nacional e SEPARADO do indice, no HTML ***',
  /<div id="nacional"/.test(L) && /border-top:1px dashed/.test(L));
ok('10. ...e o motivo esta escrito (misturar faria tratar como igual o que nao e)',
  /misturar as duas numa lista só faria o operador\s*tratar como igual o que não é/.test(uc(L)));
ok('11. *** cada bloco se identifica: 🌎 nacional ao vivo x o indice acima ***',
  /🌎 <b>Busca nacional no PNCP<\/b> \(ao vivo\)/.test(L));
ok('12. *** o nacional e disparado DEPOIS, pra nao segurar o indice ***',
  /dispararBuscaNacional\(\);/.test(L) && /Segurar a tela esperando a rede/.test(uc(L)));
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
  /não consegui consultar o PNCP nacional agora/.test(L));
ok('20. *** e nunca "nenhum resultado nacional" ***',
  /Isto <b>não<\/b> quer dizer que não haja nada/.test(L));
ok('21. ...com o motivo (seria afirmar que o Brasil nao tem o que a pessoa procura)',
  /que seria afirmar que o Brasil não tem o que a pessoa procura/.test(uc(L)));
ok('22. *** e zero DE VERDADE e dito como zero (a consulta foi feita e voltou vazia) ***',
  /Aqui <b>zero quer dizer zero<\/b> — a consulta foi feita e voltou vazia/.test(L));

// ══════════ 6. AS LIMITACOES, DITAS ONDE SE OLHA ══════════
ok('23. *** o PORTAL de origem NAO existe na resposta, e a tela diz ***',
  /o PNCP <b>não informa o portal<\/b>/.test(L));
ok('24. ...e a coluna fica em branco em vez de chutar',
  /por isso a coluna fica em branco em vez de chutar/.test(L));
ok('25. ...e a prova CONFIRMA que o campo nao existe (nao e desleixo meu)',
  /ok\('7\. \*\*\* e o PORTAL de origem NAO existe/.test(P) && /temPortal\.length === 0/.test(P));
ok('26. *** a ordem por semelhanca (nao por data) e dita na tela ***',
  /a ordem é por <b>semelhança, não por data<\/b>/.test(L));
ok('27. ...avisando que pode vir edital antigo', /pode vir edital antigo/.test(L));
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
