// SUITE testa_edital_ia — O LEITOR DE EDITAL COM IA, EM MODO PROVA DE CUSTO.
//
// Este e o unico recurso do sistema que custa DINHEIRO POR USO, e edital tem dezenas de paginas.
// O pedido do Lemuel foi explicito: montar o fluxo, MEDIR o custo de um edital real e NAO
// liberar na tela ate ele bater o martelo. Esta suite trava as duas metades disso.
//
// O QUE FOI MEDIDO (dois editais reais do PNCP, claude-haiku-4-5, 10/08/2026):
//   0,17 MB ·  51.449 tokens de entrada · 22 s · R$ 0,31
//   1,34 MB · 165.479 tokens de entrada · 19 s · R$ 0,88
//
// E O ACHADO QUE NAO E O PRECO: o Haiku le 200 mil tokens de uma vez, e o segundo edital ja
// consumiu 165 mil. Edital grande NAO CABE -- e o pior jeito de errar aqui seria mandar assim
// mesmo e resumir o pedaco que coube como se fosse o edital inteiro.
//
//   node tests/testa_edital_ia.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const TELA = R('fpmed_edital_ia.html');
const PROVA = R('tools', 'prova_custo_edital.js');
const SW = R('sw.js');
const MENU = R('fpmed_sistema_final.html');
const LIC = R('fpmed_licitacoes.html');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_edital_ia — leitor de edital em prova de custo\n');

// ══════════ 1. *** NAO LIBERADO *** ══════════
// A metade mais importante: a tela existe e a porta esta fechada.
ok('1. *** a tela NAO esta no menu do sistema ***', !/fpmed_edital_ia/.test(MENU));
ok('2. *** nem linkada na tela de Licitacoes ***', !/fpmed_edital_ia/.test(LIC));
ok('3. *** nem na casca do service worker ***', !/fpmed_edital_ia/.test(SW));
ok('4. ...e o motivo da casca esta escrito (tela que so funciona pagando nao serve offline)',
  /não tem o que fazer offline/.test(TELA));
ok('5. *** o aviso de "nao liberado" e a PRIMEIRA coisa da tela, nao um rodape ***',
  TELA.indexOf('não está liberada') < TELA.indexOf('id="arq"'));
ok('6. ...e ele diz que CUSTA DINHEIRO, com os numeros medidos',
  /custa dinheiro/.test(TELA) && /R\$ 0,31/.test(TELA) && /R\$ 0,88/.test(TELA));

// ══════════ 2. O PRECO APARECE ANTES DO CLIQUE ══════════
ok('7. *** a tela estima o custo assim que o arquivo e escolhido ***',
  /estimativa: ~/.test(TELA) && /el\('info-arq'\)\.innerHTML/.test(TELA));
ok('8. ...e o motivo (preco que so aparece depois de gastar nao e preco)',
  /Preço que só aparece depois de gastar não é preço/.test(TELA));
ok('9. o preco por token e o da tabela publica do Haiku (US$ 1 entrada / US$ 5 saida)',
  /USD_ENTRADA_MTOK = 1\.00, USD_SAIDA_MTOK = 5\.00/.test(TELA)
  && /USD_ENTRADA_POR_MTOK = 1\.00/.test(PROVA) && /USD_SAIDA_POR_MTOK = 5\.00/.test(PROVA));
ok('10. *** o cambio NAO e chutado: e buscado, e sem ele o valor fica em dolar ***',
  /economia\.awesomeapi\.com\.br/.test(TELA) && /inventar câmbio seria pior/.test(TELA));
ok('11. ...e o mesmo criterio vale na ferramenta de medicao',
  /inventar taxa seria pior/.test(PROVA) && /economia\.awesomeapi/.test(PROVA));

// ══════════ 3. O TETO DE CONTEXTO — A TRAVA QUE IMPORTA ══════════
ok('12. *** existe teto de tamanho e ele RECUSA antes de mandar ***',
  /const TETO_MB = 1\.5;/.test(TELA) && /if\(mb > TETO_MB\)\{/.test(TELA));
ok('13. *** e o motivo esta dito: meio edital resumido como se fosse o todo ***',
  /é pior que resumo nenhum/.test(TELA.replace(/\s+/g, ' ')));
ok('14. o teto vem de MEDICAO, nao de chute (tokens por MB anotados)',
  /TOKENS_POR_MB = 123000;\s*\/\/ medido: 165\.479 tokens \/ 1,34 MB/.test(TELA));
ok('15. e a medicao de 200 mil tokens do Haiku esta registrada no cabecalho',
  /200 mil tokens/.test(TELA));

// ══════════ 4. A JANELINHA DE 4 PASSOS ══════════
ok('16. *** sao exatamente 4 passos ***', (TELA.match(/\{ t:'/g) || []).length === 4);
ok('17. ...e o passo que falha fica vermelho NO LUGAR DELE',
  /function falhou\(i, msg\)/.test(TELA) && /falhouEm === i\) \? 'falhou'/.test(TELA));
ok('18. ...com o motivo escrito (erro solto nao diz em que ponto parou)',
  /em vez de\s*\n?\s*virar um erro solto que não diz em que ponto parou/.test(TELA)
  || /não diz em que ponto parou/.test(TELA));
ok('19. e a razao da janelinha (20 s parados parecem tela travada)',
  /parece travada/.test(TELA));

// ══════════ 5. O QUE ELE NAO ACHOU ══════════
// A mesma regra do motor do teto CMED: nao encontrado != ok.
ok('20. *** o prompt PROIBE inventar e manda listar o que nao achou ***',
  /NAO invente: ponha o nome do campo em "nao_encontrado"/.test(TELA)
  && /NAO invente: ponha o campo em "nao_encontrado"/.test(PROVA));
ok('21. *** e a tela mostra os nao-encontrados em DESTAQUE, nao escondidos no fim ***',
  /O que ele NÃO achou no edital/.test(TELA));
ok('22. ...dizendo que "nao achou" nao e "nao existe"',
  /não quer dizer que não exista/.test(TELA));
ok('23. resposta fora do formato esperado NAO vira adivinhacao',
  /não vou tentar adivinhar o que ela quis dizer/.test(TELA));

// ══════════ 6. A FERRAMENTA DE MEDICAO ══════════
ok('24. *** ela NAO libera nada: so mede ***',
  /Nao mexe em tela, nao grava no banco, nao cria menu\. So mede\./.test(PROVA));
ok('25. tem modo --so-baixar (mede o arquivo sem gastar credito)',
  /--so-baixar/.test(PROVA) && /zero credito gasto/.test(PROVA));
ok('26. *** confere que o arquivo E um PDF antes de gastar credito ***',
  /startsWith\('%PDF'\)/.test(PROVA) && /abortando antes de gastar credito/.test(PROVA));
ok('27. ...e recusa arquivo grande demais pra requisicao, em vez de descobrir na recusa',
  /Abortando\./.test(PROVA) && /32 MB/.test(PROVA));
ok('28. respeita a cota do PNCP entre chamadas (mesma licao do coletor)',
  /o PNCP tem cota dura/.test(PROVA));
ok('29. grava a medicao pra conferencia depois', /prova_custo_edital\.json/.test(PROVA));
ok('30. *** e usa o mesmo proxy com trava de origem que ja esta no ar ***',
  /functions\/v1\/ler-pedido/.test(PROVA) && /trava de origem/.test(PROVA));

// ══════════ 7. O MODELO ══════════
// claude-haiku-4-5 e decisao de CUSTO ja registrada no projeto (22/07). Trocar por um modelo
// maior multiplica a conta -- se um dia mudar, que mude junto nos dois lugares e com numero novo.
ok('31. os dois lados usam o MESMO modelo', /claude-haiku-4-5/.test(TELA) && /claude-haiku-4-5/.test(PROVA));
ok('32. a saida e limitada (custo de saida e 5x o de entrada)',
  /max_tokens: 2000/.test(TELA) && /max_tokens: 2000/.test(PROVA));
ok('33. ...e o motivo esta dito na ferramenta',
  /o custo de saida e 5x o de entrada/.test(PROVA));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
