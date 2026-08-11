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
const FN = R('supabase', 'functions', 'ler-edital', 'index.ts');   // onde o custo e a permissao moram
const PROVA = R('tools', 'prova_custo_edital.js');
const SW = R('sw.js');
const MENU = R('fpmed_sistema_final.html');
const LIC = R('fpmed_licitacoes.html');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_edital_ia — leitor de edital em prova de custo\n');

// ══════════ 1. *** A PORTA — E QUEM A ABRE *** ══════════
// ── 11/08: a tela DEIXOU de ser "nao liberada". O Lemuel liberou em piloto, e ai o assert que
//    exigia zero links passou de protecao a estorvo: ele estava travando o estado ANTERIOR do
//    projeto. O que ele protegia de verdade continua travado, so que pela regra nova — a porta
//    existe, e ela so aparece pra quem tem o piloto.
//    >>> O MENU LATERAL DO SISTEMA CONTINUA SEM ELA, de proposito: o leitor pertence ao portal
//        de Licitacoes, e o menu do sistema tem UMA entrada pra esse portal inteiro.
ok('1. *** a tela continua fora do menu lateral (ela e do portal de Licitacoes) ***',
  !/fpmed_edital_ia/.test(MENU));
ok('2. *** na barra do portal ela existe, mas nasce ESCONDIDA ***',
  /<a href="fpmed_edital_ia\.html" id="nav-edital-ia" hidden/.test(LIC)
  && /function abreLeitorNaBarra\(\)/.test(LIC));
ok('3. *** nem na casca do service worker ***', !/fpmed_edital_ia/.test(SW));
ok('4. ...e o motivo da casca esta escrito (tela que so funciona pagando nao serve offline)',
  /não tem o que fazer offline/.test(TELA));
ok('5. *** o aviso de "nao liberado" e a PRIMEIRA coisa da tela, nao um rodape ***',
  TELA.indexOf('não está liberada') < TELA.indexOf('id="arq"'));
ok('6. ...e ele diz que CUSTA DINHEIRO, com os numeros medidos',
  /custa dinheiro/.test(TELA) && /R\$ 0,31/.test(TELA) && /R\$ 0,88/.test(TELA));

// ══════════ 2. O PRECO APARECE ANTES DO CLIQUE ══════════
ok('7. *** a tela estima o custo assim que o arquivo e escolhido ***',
  // 11/08: a estimativa passou a ser DUAS (resumo e tabela de itens gastam saídas muito
  // diferentes). O que este assert protege continua igual: o preço aparece ANTES do clique.
  /estimativa grosseira:/.test(TELA) && /el\('info-arq'\)\.innerHTML/.test(TELA));
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
// ── 11/08, à tarde: O TETO DEIXOU DE RECUSAR. Estes dois asserts travavam a recusa por 1,5 MB,
//    e ela era o defeito — o Lemuel tentou ler um edital e levou um "não". O que era protegido
//    (não apresentar meio edital como o edital inteiro) continua travado, agora do lado certo:
//    a tela PARTE o documento e RELATA o que ficou de fora. Ver testa_leitura_partes.
ok('12. *** o teto de MB nao recusa mais: virou o calculo de quantas partes ***',
  !/const TETO_MB = 1\.5;/.test(TELA) && /const CHARS_POR_PARTE = 240000;/.test(TELA));
ok('13. *** e o limite que sobrou e so o absurdo, com o motivo dito ***',
  /const MB_ABSURDO = 100;/.test(TELA) && /preferi não gastar uma leitura pra descobrir/.test(TELA));
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
  // 11/08: a cópia MORTA do prompt que estava na tela foi apagada. Ela não era usada — quem
  // pergunta é a edge function — e prompt duplicado é o par que diverge sem ninguém notar: a
  // tela mostraria o texto de uma pergunta que o servidor não faz mais.
  /NAO invente: ponha o nome do campo em "nao_encontrado"/.test(FN)
  && /NAO invente: ponha o campo em "nao_encontrado"/.test(PROVA));
ok('21. *** e a tela mostra os nao-encontrados em DESTAQUE, nao escondidos no fim ***',
  /O que ele NÃO achou no edital/.test(TELA));
ok('22. ...dizendo que "nao achou" nao e "nao existe"',
  /não quer dizer que não exista/.test(TELA));
// 11/08: com leitura em partes, "voltou fora do formato" deixou de ser um `if` na tela e passou
// a ser uma parte que não entra em `respostas`. A recusa de adivinhar continua — ela mudou de
// lugar: quando NENHUMA parte volta legível, a tela diz isso e não inventa um resumo.
ok('23. resposta fora do formato esperado NAO vira adivinhacao',
  /nenhuma parte do edital voltou legível/.test(TELA) && /a leitura voltou fora do formato esperado/.test(FN));

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
// UM ARQUIVO POR MEDICAO (--rotulo). Na 1a rodada era um arquivo unico, sobrescrito, e foi
// assim que a resposta do primeiro edital se perdeu — nao dava pra comparar os dois modos.
ok('29. grava a medicao pra conferencia depois, UMA POR RODADA',
  /'prova_custo_' \+ \(arg\('--rotulo'\)/.test(PROVA) && /--rotulo/.test(PROVA));
ok('30. *** e usa o mesmo proxy com trava de origem que ja esta no ar ***',
  /functions\/v1\/ler-pedido/.test(PROVA) && /trava de origem/.test(PROVA));

// ══════════ 7. O MODELO ══════════
// claude-haiku-4-5 e decisao de CUSTO ja registrada no projeto (22/07). Trocar por um modelo
// maior multiplica a conta -- se um dia mudar, que mude junto nos dois lugares e com numero novo.
ok('31. os dois lados usam o MESMO modelo', /claude-haiku-4-5/.test(TELA) && /claude-haiku-4-5/.test(PROVA));
// O teto de saida MUDOU DE LUGAR em 10/08: a tela nao chama mais a IA direto — quem chama e a
// edge function `ler-edital`, que e onde moram a permissao e o contador. O limite foi junto,
// e e assim que tem que ser: parametro de custo do lado que o usuario nao edita.
ok('32. a saida e limitada, e o limite mora no SERVIDOR (custo de saida e 5x o de entrada)',
  // 11/08: virou teto POR TAREFA (resumo 2000, itens 12000). O limite continua morando no
  // servidor — que é o ponto do assert; um teto que a tela mandasse seria um teto negociável.
  /const MAX_SAIDA: Record<string, number> = \{ resumo: 2000, itens: 12000, juntar: 3000 \};/.test(FN)
  && /max_tokens: MAX_SAIDA\[tarefa\]/.test(FN) && /max_tokens: 2000/.test(PROVA));
ok('33. ...e o motivo esta dito na ferramenta',
  /o custo de saida e 5x o de entrada/.test(PROVA));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
