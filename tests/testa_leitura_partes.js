// SUITE testa_leitura_partes — o edital que nao cabia numa leitura passa a ser lido inteiro.
//
// ══ O QUE MUDOU, E POR QUE E DELICADO ═══════════════════════════════════════════════════════
// Ate 11/08 a tela RECUSAVA edital acima de ~1,5 MB. A recusa estava certa pelo que ela sabia
// fazer — mandar meio edital e chamar de edital inteiro seria pior. Mas ela transformava um
// limite tecnico nosso num limite do trabalho do operador.
// O conserto e PARTIR. E partir cria tres jeitos novos de mentir, que sao os que esta suite
// existe pra impedir:
//   1. UMA PARTE NAO SABE QUE HA OUTRAS. Sem ser avisada, ela inventa campo que esta em outra
//      parte, so pra nao devolver vazio.
//   2. LISTA COM BURACO NAO SE PARECE COM LISTA COM BURACO — parece uma lista. Se a costura nao
//      conferir a continuidade e RELATAR, uma proposta sai faltando itens sem sinal nenhum.
//   3. N PARTES VIRAM N COBRANCAS. O cliente paga por leitura; 23 linhas na fatura pra um edital
//      lido uma vez e tecnicamente correto e comercialmente indefensavel.
//
// PROVADO NO AR (11/08, edital de 92 paginas / 339.106 chars, 2 partes):
//   itens ... 47 costurados · 46 repetidos entre as partes · 0 buracos · R$ 0,79 · 1 linha
//   resumo .. os 2 parciais + a juncao · 0 conflitos · R$ 0,61 · 1 linha
//
//   node tests/testa_leitura_partes.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const T = R('fpmed_edital_ia.html');
const F = R('supabase', 'functions', 'ler-edital', 'index.ts');
const D = R('ddl', 'usos_ia_lote.sql');
const P = R('tools', 'prova_partes_edital.js');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_leitura_partes — edital de qualquer tamanho, sem fingir que leu tudo\n');

// ══════════ 1. A RECUSA VIROU CALCULO ══════════
ok('1. *** o teto de 1,5 MB nao recusa mais ***', !/const TETO_MB = 1\.5;/.test(T));
ok('2. *** e o que sobrou de limite e so o absurdo ***',
  /const MB_ABSURDO = 100;/.test(T) && /Acima de ' \+ MB_ABSURDO \+ ' MB não costuma/.test(T));
ok('3. ...com o motivo (nao gastar uma leitura pra descobrir que era outra coisa)',
  /preferi não gastar uma leitura pra descobrir/.test(uc(T)));
ok('4. ...e o historico registrado (a recusa antiga estava certa pelo que a tela sabia fazer)',
  /a recusa estava certa pelo que ela sabia fazer/.test(uc(T)));

// ══════════ 2. O CORTE E POR PAGINA ══════════
ok('5. *** o texto e extraido PAGINA A PAGINA ***', /async function pdfPorPagina\(buf\)/.test(T));
ok('6. ...pra dar pra dizer "li as paginas 1-18" em vez de "li um pedaco"',
  /é o que permite dizer "li as páginas 1-18" em vez de "li um pedaço"/.test(uc(T)));
ok('7. *** e o corte e SEMPRE em fim de pagina ***', /function partirPorPagina\(paginas, limiteChars\)/.test(T));
ok('8. ...com o motivo (cortar no meio parte a linha da tabela: qtd numa parte, descricao na outra)',
  /a quantidade ficaria numa parte e a descrição\s*na outra/.test(uc(T)));
ok('9. *** os DOIS lados usam o mesmo teto de caracteres ***',
  /const CHARS_POR_PARTE = 240000;/.test(T) && /const CHARS_POR_PARTE = 240000;/.test(P));
ok('10. ...e a prova DIZ por que repete a logica (o <script> do HTML nao da pra importar no node)',
  /nao ha como importa-la no node sem\s*um navegador/.test(uc(P)));
ok('11. o numero de 240 mil chars vem de medicao, nao de chute',
  /medido: 117\.575 chars = 39\.013 tokens/.test(T));
ok('12. PDF escaneado e recortado com pdf-lib, baixado so quando precisa',
  /function carregarPdflib\(\)/.test(T) && /async function partirPdf\(buf, pagsPorParte\)/.test(T)
  && !/<script src="[^"]*pdf-lib/.test(T));

// ══════════ 3. A PARTE SABE QUE E UMA PARTE ══════════
ok('13. *** a funcao avisa o modelo de qual parte ele esta lendo ***',
  /Este documento foi dividido em \$\{partes\} partes e voce esta lendo a PARTE \$\{parte\} de \$\{partes\}/.test(F));
ok('14. *** e manda NAO inventar pra preencher ***',
  /outra parte pode te-lo, e juntar e trabalho de outra etapa\. NAO invente/.test(F));
ok('15. ...com o motivo (senao responde "orgao" de um bloco que so tem tabela de itens)',
  /o modelo tenta responder "abertura" e "orgao" de um bloco que so\s*tem a tabela de itens, e inventa/.test(uc(F)));
ok('16. o cabecalho de parte NAO aparece quando ha uma parte so',
  /const cabecalhoParte = partes > 1/.test(F));

// ══════════ 4. A COSTURA DOS ITENS ══════════
ok('17. *** existe a costura, e ela deduplica por nº de item ***',
  /function costurarItens\(respostas, falhas, totalPaginas\)/.test(T) && /if\(vistos\.has\(k\)\)\{/.test(T));
ok('18. ...com o motivo (a tabela atravessa a pagina; sem dedup o item 47 dobra a quantidade)',
  /a proposta sairia com quantidade dobrada/.test(uc(T)));
ok('19. *** o empate e ganho pela copia mais COMPLETA, e nao pela primeira ***',
  /function riquezaItem\(it\)/.test(T) && /if\(riquezaItem\(it\) > riquezaItem\(vistos\.get\(k\)\)\)/.test(T));
ok('20. ...com a medicao que motivou (45 de 48 itens vieram nas duas partes)',
  /45 dos 48 itens vieram nas DUAS partes/.test(uc(T)));
ok('21. ...e o risco que isso evitava (a versao resumida ganharia sistematicamente)',
  /a proposta nasceria com a versão pobre de 45 itens/.test(uc(T)));
ok('22. *** a continuidade da numeracao e conferida e o buraco vira lista ***',
  /if\(nums\[i\] - nums\[i-1\] > 1\) buracos\.push/.test(T));
ok('23. *** e o buraco e RELATADO como duvida, e nao como erro ***',
  /Pode ser que o edital pule mesmo \(item cancelado, lote desmembrado\)/.test(T));
ok('24. ...com o motivo (afirmar que faltou seria tao desonesto quanto omitir)',
  /Afirmar que faltou seria tão desonesto quanto omitir/.test(uc(T)));
ok('25. *** a tela MOSTRA a faixa lida e o que faltou ***',
  /Vieram os itens <b>/.test(T) && /Faltam na numeração:/.test(T));
ok('26. *** e diz quais partes nao voltaram, e que os itens delas NAO estao na tabela ***',
  /Partes que não voltaram:/.test(T) && /não estão<\/b> na tabela abaixo/.test(T));
ok('27. o relatorio da costura vem ANTES da tabela (e mais importante que ela)',
  T.indexOf('blocoCostura') < T.indexOf('Confira esta tabela contra o edital'));
ok('28. ...com o motivo escrito', /Uma lista com buraco não se parece com uma lista com buraco: parece uma lista/.test(uc(T)));

// ══════════ 5. A JUNCAO DO RESUMO (map-reduce) ══════════
ok('29. *** existe a tarefa `juntar` na funcao, com prompt proprio ***',
  /const PERGUNTA_JUNTAR = /.test(F) && /body\.tarefa === "juntar" \? "juntar"/.test(F));
ok('30. *** e ela tem teto de saida proprio ***', /juntar: 3000/.test(F));
ok('31. *** conflito entre partes NAO e resolvido no escuro ***',
  /Se DUAS partes disserem coisas diferentes do mesmo campo, NAO escolha uma/.test(F));
ok('32. ...e a tela MOSTRA os conflitos', /As partes discordaram em/.test(T) && /Não escolhi por você/.test(T));
ok('33. *** a juncao falhar nao joga fora o que ja foi lido ***',
  /_naoJuntou: true/.test(T) && /_parciais: respostas\.map/.test(T));
ok('34. ...e a tela DIZ que o que aparece e so a primeira parte',
  /resumo da <b>primeira parte só<\/b>/.test(T));
ok('35. a juncao aceita texto curto (os parciais sao curtos de proposito)',
  /t\.length < 500 && tarefa !== "juntar"/.test(F));

// ══════════ 6. LEITURA CORTADA REFAZ MENOR ══════════
ok('36. *** a funcao devolve `cortou` separado do texto do erro ***', /const cortou = !!erro &&/.test(F));
ok('37. ...com o motivo (amarrar comportamento a uma string que alguem reescreve)',
  /seria amarrar comportamento a uma string que um dia alguem reescreve/.test(uc(F)));
ok('38. *** a tela reparte o bloco no meio das paginas quando corta ***',
  /if\(j\.cortou && bloco\.texto && bloco\.ate > bloco\.de\)\{/.test(T));
ok('39. *** e para depois de duas divisoes (4 pedacos) ***', /while\(fila\.length && tentativa <= 2\)/.test(T));
ok('40. ...com o motivo (insistir alem disso e pagar pra repetir um resultado ja sabido)',
  /é gastar dinheiro repetindo um resultado que já se sabe qual é/.test(uc(T)));
ok('41. e a parte que nem dividida coube e REGISTRADA como falha, nao esquecida',
  /nem dividida em quatro a parte coube na resposta/.test(T));

// ══════════ 7. UMA COBRANCA SO ══════════
ok('42. *** o lote existe e a funcao registra por RPC ***',
  /rest\/v1\/rpc\/registra_uso_ia/.test(F) && /lote, partes,/.test(F));
ok('43. *** o banco SOMA as partes, com on conflict atomico ***',
  /on conflict \(lote\) where lote is not null do update set/.test(D)
  && /tokens_entrada = usos_ia\.tokens_entrada \+ excluded\.tokens_entrada/.test(D));
ok('44. ...e o motivo de nao ser a tela a somar (duas partes juntas sobrescreveriam a soma)',
  /a\s*cobranca sai MENOR que o custo, silenciosamente/.test(uc(D)));
ok('45. *** uma parte que falha derruba o `ok` da leitura inteira, sem volta ***',
  /ok\s+= usos_ia\.ok and excluded\.ok,/.test(D));
ok('46. ...com o motivo (a mentira mais cara: diz que a lista esta completa)',
  /ela\s*diz que a lista de itens esta completa quando falta um pedaco/.test(uc(D)));
ok('47. *** o indice unico impede duas linhas pro mesmo lote ***',
  /create unique index if not exists usos_ia_lote_unico on public\.usos_ia \(lote\) where lote is not null;/.test(D));
ok('48. leitura sem lote continua criando linha propria (o caso antigo nao muda)',
  /Null = leitura de parte unica \(o caso antigo\)/.test(D));
ok('49. *** o erro acumulado nao nasce com separador solto na frente ***',
  /concat_ws\(' · ', nullif\(usos_ia\.erro, ''\), nullif\(excluded\.erro, ''\)\)/.test(D));
ok('50. ...com o motivo (erro que comeca com separador parece mensagem cortada)',
  /Erro que\s*comeca com separador parece mensagem cortada/.test(uc(D)));
ok('51. o DDL e aditivo (nenhum drop nem update de dado)',
  !/\b(drop table|drop column|delete from|truncate)\b/i.test(D.replace(/--[^\n]*/g, '')));

// ══════════ 8. O CUSTO ANTES DO CLIQUE ══════════
ok('52. *** a tela pergunta antes, com o nº de partes e o custo total ***',
  /vai ser lido em '\s*\+ partes\.length \+ ' partes/.test(T) && /Custo estimado total: '/.test(T));
ok('53. *** e diz que e UMA cobranca, nao N ***',
  /é uma cobrança só, somada — não '/.test(T));
ok('54. *** a pergunta NAO aparece quando e uma parte so ***', /if\(partes\.length > 1\)\{/.test(T));
ok('55. ...com o motivo (alerta por clique vira alerta que se aperta sem ler)',
  /um alerta por clique vira um\s*alerta que se aperta sem ler/.test(uc(T)));
ok('56. o nº de partes aparece junto do custo no resultado',
  /' · <b>' \+ j\.partes \+ ' partes<\/b>, uma cobrança só'/.test(T));
ok('57. ...com o motivo (R\$ 4,00 sem "foram 12 partes" ao lado parece erro de cobranca)',
  /parece erro de cobrança/.test(uc(T)));

// ══════════ 9. A PROVA REAL ══════════
ok('58. *** a prova chama a funcao de verdade, com login de verdade ***',
  /grant_type=password/.test(P) && /Authorization: 'Bearer ' \+ tok/.test(P));
ok('59. *** e confere NO BANCO que as N partes viraram UMA linha ***',
  /linhas em usos_ia para este lote: \$\{linhas\.length\}  \(tem que ser 1\)/.test(P));
ok('60. ...que e a metade comercial da prova', /e a metade comercial da prova/.test(uc(P)));
ok('61. *** ela costura e relata buracos, como a tela ***', /buracos na numeracao/.test(P));
ok('62. *** e prova a juncao, inclusive os conflitos ***',
  /juntando os resumos parciais/.test(P) && /CONFLITOS/.test(P));
ok('63. `--so-partir` mostra a divisao sem gastar credito', /--so-partir: nada foi enviado, zero credito gasto/.test(P));
ok('64. e o resultado medido esta no cabecalho da suite (nao so no commit)',
  /47 costurados · 46 repetidos entre as partes · 0 buracos · R\$ 0,79 · 1 linha/.test(uc(R('tests', 'testa_leitura_partes.js'))));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
