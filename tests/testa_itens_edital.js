// SUITE testa_itens_edital — a extracao da tabela de itens e a ponte dela ate a proposta.
//
// O QUE ESTA SUITE PROTEGE, e por que cada coisa e um jeito conhecido de perder dinheiro:
//
//   1. TABELA CORTADA NAO VIRA PROPOSTA. Uma resposta truncada no meio do array ainda parece uma
//      lista de itens. Se ela passasse, a proposta iria pro pregao com metade dos itens — e
//      metade de uma lista nao se parece com erro nenhum, se parece com uma lista menor.
//   2. "NAO ACHEI" E "NAO TEM" SAO COISAS DIFERENTES. Lista vazia entregue como resultado diria
//      que o edital nao tem itens. `tabela_encontrada:false` existe so pra separar os dois.
//   3. A CONVERSAO DE QUANTIDADE MORA NUM LUGAR SO. A ponte do PNCP e a ponte da IA escrevem o
//      MESMO formato e usam o MESMO `unidadePack`. Duas regras de embalagem sao um erro de 100x
//      esperando (500 unidades viradas em 500 caixas num documento que vale como proposta).
//   4. QUEM LE, PAGA — E SABE. Cada leitura e cobrada; erro DEPOIS de consumir token tambem
//      custou, e some da vista se a tela so disser "nao deu certo".
//
//   node tests/testa_itens_edital.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const T = R('fpmed_edital_ia.html');
const F = R('supabase', 'functions', 'ler-edital', 'index.ts');
const N = R('fpmed_negocios.html');
const G = R('fpmed_giovana.html');
const L = R('fpmed_licitacoes.html');
const DDL = R('ddl', 'usos_ia_tarefa.sql');
const P = R('tools', 'prova_itens_edital.js');
const um = s => s.replace(/\s*\n\s*/g, ' ');
// `uc` junta linhas TIRANDO o marcador de comentario do comeco de cada uma (//, --, *). Sem isso
// uma frase quebrada em duas linhas de comentario vira "...de um //     edital de 80..." e o
// assert falha por um motivo que nao tem nada a ver com o que ele quer proteger.
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_itens_edital — a tabela de itens, do PDF ate a proposta\n');

// ══════════ 1. A FUNCAO TEM DUAS TAREFAS, E ELAS SAO DIFERENTES DE VERDADE ══════════
ok('1. *** a funcao aceita `tarefa` e ela decide o prompt ***',
  /const tarefa = body\.tarefa === "itens" \? "itens" : "resumo";/.test(F)
  && /const PERGUNTA = tarefa === "itens" \? PERGUNTA_ITENS : PERGUNTA_RESUMO;/.test(F));
ok('2. o padrao e `resumo` (corpo antigo continua funcionando igual)',
  /body\.tarefa === "itens" \? "itens" : "resumo"/.test(F));
ok('3. *** o teto de saida MUDA com a tarefa ***',
  /const MAX_SAIDA: Record<string, number> = \{ resumo: 2000, itens: 12000 \};/.test(F)
  && /max_tokens: MAX_SAIDA\[tarefa\]/.test(F));
ok('4. ...e o motivo esta escrito (teto de resumo aplicado a itens corta a tabela)',
  /Teto de resumo aplicado a itens nao devolve tabela menor: devolve tabela CORTADA no meio/.test(F));

// ══════════ 2. O PROMPT DA TABELA — as tres travas ══════════
ok('5. *** manda copiar a descricao INTEIRA (descricao e o que identifica o produto) ***',
  /Copie a descricao INTEIRA de cada item, sem resumir/.test(F));
ok('6. *** proibe inventar item e completar sequencia ***',
  /NAO invente item nem complete sequencia de numeracao/.test(F));
ok('7. *** proibe CONVERTER quantidade e unidade (a conversao e da ponte, num lugar so) ***',
  /NAO converta quantidade nem unidade\. Copie como esta escrito no documento/.test(F));
ok('8. ...e o motivo (converter aqui seria uma segunda regra de embalagem)',
  /Converter aqui seria uma\s*segunda regra de embalagem/.test(um(F)) || /segunda regra de embalagem/.test(um(F)));
ok('9. *** proibe ESTIMAR valor unitario (null quando nao aparece) ***',
  /Se o valor unitario estimado nao aparecer, use null\. NAO estime/.test(F));
ok('10. *** exige dizer quando NAO achou a tabela ***',
  /tabela_encontrada": false/.test(F) && /Lista vazia sem esse aviso seria dizer que o edital nao tem itens/.test(F));

// ══════════ 3. LEITURA CORTADA BLOQUEIA — E NAO SALVA METADE ══════════
ok('11. *** stop_reason max_tokens vira ERRO, nao resultado parcial ***',
  /if \(j\.stop_reason === "max_tokens"\) \{/.test(F));
ok('12. *** e a mensagem de itens explica o que foi recusado ***',
  /entregar metade dos itens como se fosse a lista inteira seria pior que nao entregar/.test(F));
ok('13. ...com o motivo registrado (metade de 80 parece um edital de 40)',
  /Uma lista de 40 itens de um edital de 80 nao se parece com erro nenhum/.test(uc(F)));
ok('14. e o codigo NAO tenta aproveitar os itens que vieram antes do corte',
  !/slice\(0, ?bruto\.lastIndexOf\('\},'\)/.test(F));

// ══════════ 4. O CONTADOR SEPARA AS DUAS LEITURAS ══════════
ok('15. *** a leitura registrada guarda QUAL tarefa foi ***', /modo_motivo: String\(body\.motivo \|\| ""\) \|\| null, tarefa,/.test(F));
ok('16. *** a coluna nasce ADITIVA, sem drop nem update ***',
  /add column if not exists tarefa text not null default 'resumo'/.test(DDL)
  && !/\b(drop|delete|truncate)\b/i.test(DDL.replace(/--[^\n]*/g, '')));
ok('17. ...travada nos dois valores', /check \(tarefa in \('resumo','itens'\)\)/.test(DDL));
ok('18. *** `tipo` NAO foi reaproveitado (ele responde outra pergunta: qual ferramenta) ***',
  /Coluna nova responde a pergunta nova sem mexer na resposta antiga/.test(DDL));
ok('19. ...e o motivo economico esta escrito (a soma por tipo mostraria 2 ferramentas onde ha 1)',
  /a conta do mes passaria a mostrar duas ferramentas onde ha uma/.test(uc(DDL)));
ok('20. a view de cobranca leva a coluna (e por replace, pra nao perder grant)',
  /create or replace view public\.v_leituras_cobranca/.test(DDL) && /l\.tarefa\nfrom public\.usos_ia l;/.test(DDL));

// ══════════ 5. A TELA — DUAS LEITURAS, DOIS PRECOS, DITOS ANTES DO CLIQUE ══════════
ok('21. *** ha DOIS botoes, um por leitura ***',
  /onclick="lerEdital\('resumo'\)"/.test(T) && /onclick="lerEdital\('itens'\)"/.test(T));
ok('22. ...e a tela diz que sao duas cobrancas', /duas cobranças, se você usar as duas/.test(um(T)));
ok('23. *** a estimativa de custo mostra os DOIS precos antes do clique ***',
  /<b>resumo<\/b> ~US\$ ' \+ custo\(1500\)/.test(T) && /<b>tabela de itens<\/b> ~US\$ ' \+ custo\(8000\)/.test(T));
ok('24. ...com o motivo (a entrada e igual; o que muda e a saida)',
  /o que muda é a SAÍDA/.test(um(T)));
ok('25. o corpo da chamada leva a tarefa', /let corpo = \{ tarefa, titulo: ARQUIVO\.name/.test(T));
ok('26. o bloco de custo e UM SO pras duas leituras (nao duplicado)',
  /function blocoCusto\(j, segundos\)\{/.test(T) && (T.match(/O que esta leitura custou/g) || []).length === 1);
ok('27. ...e ele DIZ qual das duas leituras foi', /j\.tarefa === 'itens' \? 'tabela de itens' : 'resumo do edital'/.test(T));

// ══════════ 6. A TELA TRATA A TABELA COMO LEITURA DE TERCEIRO ══════════
ok('28. *** "nao achei a tabela" tem cara propria — nao e lista vazia ***',
  /d\.tabela_encontrada === false \|\| !itens\.length/.test(T)
  && /Não achei a tabela de itens neste documento/.test(T));
ok('29. ...e explica o caso comum (a relacao esta em ANEXO separado)',
  /está num ANEXO separado/.test(um(T)));
ok('30. *** o aviso de conferir e o CABECALHO do resultado, nao um rodape ***',
  /⚠️ Confira esta tabela contra o edital antes de usar/.test(T));
ok('31. ...e diz COMO conferir (o edital tem quantos itens?)',
  /o edital tem quantos itens\?/.test(um(T)));
ok('32. *** item sem quantidade aparece MARCADO, nao com zero ***',
  /q == null \? falta\('sem qtd'\)/.test(T) && /sem unidade/.test(T));
ok('33. *** o total soma so o que tem preco E DIZ quantos ficaram de fora ***',
  /item\(ns\) sem valor estimado ficaram de fora da soma/.test(T));
ok('34. ...e quando nenhum tem preco, diz isso em vez de mostrar R\$ 0,00',
  /Nenhum item trouxe valor unitário estimado — não há total a somar/.test(T));

// ══════════ 7. AS TRES SAIDAS ══════════
ok('35. *** existem os tres botoes: proposta, Excel e copiar ***',
  /montarProposta\(\)/.test(T) && /baixarExcel\(\)/.test(T) && /copiarLista\(\)/.test(T));
ok('36. o SheetJS so baixa QUANDO ALGUEM CLICA (nao pesa o boot de quem nao usa)',
  /function carregarXlsx\(\)/.test(T) && !/<script src="[^"]*xlsx/.test(T));
ok('37. *** celula sem quantidade sai VAZIA na planilha, e nao zero ***',
  /'Quantidade': q,\s+\/\/ null = célula VAZIA, não zero/.test(T));
ok('38. *** o nome do arquivo .xlsx carrega o aviso de que foi lido por IA ***',
  /'_lido-por-IA\.xlsx'/.test(T));
ok('39. ...e o motivo (o arquivo vive longe da tela que avisa)',
  /vive semanas na área de trabalho de alguém, longe de qualquer aviso da tela/.test(uc(T)));
ok('40. a copia sai em TSV (cola em Excel ja nas colunas; virgula quebraria nas descricoes)',
  /\.join\('\\t'\)/.test(T) && /Vírgula quebraria em toda descrição de medicamento/.test(um(T)));

// ══════════ 8. A PONTE — UM CAMINHO SO ATE A PROPOSTA ══════════
ok('41. *** escreve na MESMA chave de sessao que a ponte do PNCP ***',
  /sessionStorage\.setItem\('fpmed_pedido_edital'/.test(T) && /sessionStorage\.setItem\('fpmed_pedido_edital'/.test(L));
ok('42. *** e no MESMO formato (os campos que a Giovana le) ***',
  /qtdEdital: q, unidade: und/.test(T) && /packEdital: pack/.test(T)
  && /qtdUnidades: \(pack && q\) \? q \* pack : null/.test(T) && /unitEdital:/.test(T));
ok('43. *** usa o `unidadePack` DO MOTOR, e nao uma regra propria ***',
  /const pack = M\.unidadePack\(und\);/.test(T) && /<script src="fpmed_teto_cmed\.js"><\/script>/.test(T));
ok('44. ...e recusa montar se o motor nao carregou (sem ele a quantidade seria chute)',
  /sem ele a quantidade seria chute/.test(T));
ok('45. ...com o motivo do caminho unico registrado (duas regras = erro de 100x)',
  /é exatamente aí que mora o\s*erro de 100×/.test(um(T)));
ok('46. *** unidade que o motor nao le vira qtdUnidades null (= 1 + etiqueta na Giovana) ***',
  /Onde ela não souber ler a unidade, `qtdUnidades` vai null/.test(um(T)));
ok('47. *** o pacote NAO finge que cruzou contra o estoque ***',
  /casouAqui: null,\s+\/\/ ninguém cruzou contra o estoque ainda/.test(T));
ok('48. *** e leva a ORIGEM junto (a Giovana nao teria como saber olhando os itens) ***',
  /origem: 'ia', origemArquivo:/.test(T));

// ══════════ 9. A GIOVANA TRATA AS DUAS ORIGENS DIFERENTE ══════════
ok('49. *** a Giovana LE a origem e muda o aviso ***', /const daIA = l\.origem === 'ia';/.test(G));
ok('50. *** e diz, em cima, que os itens foram lidos por IA ***',
  /Estes itens foram LIDOS POR IA/.test(G));
ok('51. ...mandando conferir QUANTOS itens o edital tem',
  /confira contra o edital <strong>quantos itens ele tem<\/strong>/.test(um(G)));
ok('52. ...e explicando por que (item pulado nao aparece como faltando)',
  /some sem deixar sinal/.test(um(G)));
ok('53. *** o caminho de importacao continua UM SO (mesma funcao pras duas origens) ***',
  (G.match(/function importarPedidoEdital\(\)/g) || []).length === 1);
ok('54. ...e a razao da confianca diferente esta escrita',
  /o índice erra por estar desatualizado/.test(um(G)));

// ══════════ 10. O BOTAO NA FICHA DO NEGOCIO ══════════
ok('55. *** o botao esta na FILEIRA DO RODAPE da ficha (junto de Documentos/Fechar) ***',
  /class="dw-acoes"[\s\S]{0,1400}lerEditalIA\(\$\{n\.id\}\)[\s\S]{0,400}fecharDrawer\(\)/.test(N));
ok('56. *** e ele NEM APARECE pra quem nao tem a permissao do piloto ***',
  /\$\{podeLerEdital\(\) \? `<button onclick="lerEditalIA/.test(N));
ok('57. *** mas a tela DIZ que esconder botao nao e a permissao ***',
  /ESCONDER O BOTÃO NÃO É A PERMISSÃO/.test(N));
ok('58. ...e diz quem impede de verdade (a edge function, com 403 testado)',
  /confere o JWT no servidor e responde 403/.test(um(N)));
ok('59. ...e o que acontece se as duas listas divergirem (vale a do servidor)',
  /se um dia divergirem, quem vale é a do servidor/.test(um(N)));
ok('60. *** o PDF nao vai da ficha (a ficha nao guarda o arquivo) ***',
  /O PDF\s*do edital NÃO vai daqui/.test(um(N)));
ok('61. leva so o nome do certame, pra proposta nascer identificada',
  /sessionStorage\.setItem\('fpmed_edital_negocio'/.test(N) && /titulo: n\.titulo \|\| n\.objeto \|\| null/.test(N));
ok('62. e o leitor LE esse contexto e volta pro negocio (nao joga todo mundo nas Licitacoes)',
  /function negocioDaSessao\(\)/.test(T) && /location\.href = n \? 'fpmed_negocios\.html' : 'fpmed_licitacoes\.html'/.test(T));
ok('63. *** o contexto NAO e consumido (quem veio da ficha pode ler dois anexos seguidos) ***',
  !/removeItem\('fpmed_edital_negocio'\)/.test(T));

// ══════════ 11. ERRO QUE CUSTOU DINHEIRO APARECE COM O CUSTO ══════════
ok('64. *** a funcao devolve o custo JUNTO do erro ***',
  /if \(erro\) return J\(\{ ok: false, erro, modo, tarefa, leituraId, usd: \+usd\.toFixed\(4\),/.test(F));
ok('65. *** e a tela mostra quanto a tentativa fracassada custou ***',
  /esta tentativa já custou/.test(T));
ok('66. ...e recarrega a conta de leituras mesmo no erro (a cobranca ja existe)',
  /catch\(e\)\{ travaBotoes\(false\); carregarLeituras\(\); return falhou\(2, e\.message\); \}/.test(T));
ok('67. o motivo esta escrito (custo escondido em erro faz a conta do mes nao fechar)',
  /Custo escondido em erro e a forma mais rapida de a conta do mes nao fechar com a fatura/.test(uc(F)));

// ══════════ 12. A PROVA REAL TEM GABARITO DE FORA ══════════
ok('68. *** a prova compara contra o PNCP, e nao contra a propria IA ***',
  /async function itensOficiais\(l\)/.test(P) && /GABARITO DO PNCP/.test(P));
ok('69. *** ela chama a funcao REAL com login REAL do gestor ***',
  /grant_type=password/.test(P) && /licitacao@fpmed\.com\.br/.test(P)
  && /Authorization: 'Bearer ' \+ tok/.test(P));
ok('70. ...e nao com service_role (que atravessaria uma porta que usuario nenhum usa)',
  /mediria uma porta que nenhum usuario atravessa/.test(P));
ok('71. *** o gabarito e PAGINADO (compra de 300 itens nao cabe numa pagina) ***',
  /tamanhoPagina=500/.test(P) && /uma pagina so devolveria um gabarito menor que a verdade/.test(uc(P)));
ok('72. *** escolhe o PDF por pontuacao, e nao "o primeiro" ***',
  /function notaDoArquivo\(nome\)/.test(P) && /esclarecim\|impugna/.test(P));
ok('73. ...porque a 1a rodada leu uma Resposta de Esclarecimento',
  /a 1a rodada desta prova escolheu uma "Resposta de Esclarecimento"/.test(um(P)));
ok('74. *** "01" e "1" sao o mesmo item — e quem normaliza e o COMPARADOR ***',
  /function normNum\(v\)/.test(P) && /Quem normaliza e quem COMPARA — aqui, e so aqui/.test(um(P)));
ok('75. ...e o prompt segue mandando copiar como esta escrito, com o motivo',
  /Numero do item e o que o pregoeiro\s*chama em voz alta na sessao/.test(um(P)));
ok('76. *** da pra reconferir sem pagar de novo (o defeito pode estar no comparador) ***',
  /if \(arg\('--conferir'\)\) return reconferir\(arg\('--conferir'\)\)/.test(P));
ok('77. e a recusa por tabela cortada tambem e RESULTADO, com o custo junto',
  /ISTO TAMBEM E RESULTADO, e nao falha do script/.test(P));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
