// SUITE testa_kpis_clicaveis — as caixinhas do topo viram botoes, e o resultado ganho fica
// gravado no negocio.
//
// ══ O QUE FOI MEDIDO CONTRA O BANCO (11/08, tools/prova_kpis_negocios.js) ═══════════════════
//   no funil 8 · historico 2.558 · ganhas 105 · perdidas 590 · EM disputa 1
//   taxa 15,1% (105 de 695) · total ganho R$ 63.034.332,63
//   a soma da LISTA das ganhas bate centavo a centavo com o cartao · a view do banco concorda
//
// ══ A TAXA DE VITORIA TINHA UMA DISTORCAO, e ela foi corrigida ══════════════════════════════
// O denominador era `estagio='classificacao' OR valor_ganho>0` — e isso contava como PERDIDO o
// negocio que ainda ESTA na Habilitacao, ou seja, em disputa. Um pregao que acontece semana que
// vem entrava na conta como ja perdido.
// Hoje e 1 de 696 e quase nao muda (15,09% -> 15,11%). Numa semana com 20 disputas abertas a
// taxa despencaria sozinha, sem nada ter dado errado — e alguem tomaria decisao comercial com
// base nisso. A regra passou a ser: so entra no denominador o que JA ACABOU ou ja ganhou.
//
//   node tests/testa_kpis_clicaveis.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const N = R('fpmed_negocios.html');
const D = R('ddl', 'negocio_itens_ganhos.sql');
const P = R('tools', 'prova_kpis_negocios.js');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_kpis_clicaveis — as caixinhas viram botoes, e o resultado fica gravado\n');

// ══════════ 1. AS CINCO CAIXINHAS SAO BOTOES ══════════
['funil', 'historico', 'ganhas', 'taxa', 'total'].forEach((k, i) => {
  ok((i + 1) + '. *** a caixinha "' + k + '" abre painel ***',
    new RegExp("onclick=\"abrirPainel\\('" + k + "'\\)\"").test(N));
});
ok('6. *** e elas PARECEM botao (cursor de mao + hover) ***',
  /\.kpi\.bt\{cursor:pointer/.test(N) && /\.kpi\.bt:hover\{border-color:var\(--azul\)/.test(N));
ok('7. ...com o motivo (senao a funcao existe so pra quem leu o commit)',
  /a função existe\s*só pra quem leu o commit/.test(uc(N)));
ok('8. *** o painel e DENTRO do Negocios, e nao uma tela nova ***',
  /<div id="painel-kpi"/.test(N) && /function abrirPainel\(qual\)/.test(N));
ok('9. ...com o motivo (tela nova teria o proprio jeito de discordar do que e uma "ganha")',
  /o seu\s*próprio jeito de discordar desta sobre o que é uma "ganha"/.test(uc(N)));

// ══════════ 2. UM LUGAR SO PARA OS NUMEROS ══════════
ok('10. *** os cinco numeros saem de UMA funcao ***', /function numerosDoTopo\(\)/.test(N));
ok('11. *** e o painel usa a MESMA funcao (nao reconta) ***',
  (N.match(/numerosDoTopo\(\)/g) || []).length >= 4);
ok('12. ...com o motivo (dois resultados na mesma tela e o operador sem saber em qual acreditar)',
  /o operador não teria como saber qual acreditar/.test(uc(N)));

// ══════════ 3. A TAXA DE VITORIA, CORRIGIDA E ESCRITA ══════════
ok('13. *** negocio EM disputa NAO conta como perdido ***',
  /const perdidas = NEG\.filter\(n => n\.estagio === 'classificacao' && n\.arquivado && !\(Number\(n\.valor_ganho\) > 0\)\);/.test(N));
ok('14. *** e a distorcao antiga esta registrada, com o numero ***',
  /Hoje isso é 1 de 696/.test(uc(N)));
ok('15. ...e o risco (com 20 disputas abertas a taxa despencaria sozinha)',
  /numa semana com 20 disputas abertas a taxa despencaria sozinha/.test(uc(N)));
ok('16. *** a tela DIZ a conta por extenso, e nao so o percentual ***',
  /ganhas<\/b> de <b>\$\{k\.decididas\} decididas<\/b>/.test(N));
ok('17. ...definindo o que e "decidida"', /<b>Decididas<\/b> = as que a empresa ganhou/.test(N));
ok('18. ...e dizendo que quem parou antes da Habilitacao NAO entra',
  /desistir na triagem não é perder uma disputa/.test(N));
ok('19. ...e quantos estao em disputa sem contar', /ainda em disputa <b>não contam<\/b>/.test(N));
ok('20. ...com o motivo de a conta aparecer ("10,6%" ninguem confere)',
  /é um número que ninguém confere/.test(uc(N)));

// ══════════ 4. A LISTA DAS GANHAS ══════════
ok('21. *** ordenada por valor, como pedido ***',
  /sort\(\(a,b\) => Number\(b\.valor_ganho\|\|0\) - Number\(a\.valor_ganho\|\|0\)\)/.test(N));
ok('22. *** com orgao, nº, municipio, data e valor ***',
  /\['ÓRGÃO','Nº','MUNICÍPIO','ABERTURA','ITENS','VALOR GANHO'\]/.test(N));
ok('23. *** cada linha clica e abre a FICHA ***', /onclick="irPara\(\$\{n\.id\}\)"/.test(N));
ok('24. *** o rodape soma e tem que bater com o cartao ***',
  /const somaTotal = linhas\.reduce\(\(s,n\) => s \+ Number\(n\.valor_ganho\|\|0\), 0\);/.test(N)
  && /<td style="text-align:right"><b>' \+ brl\(somaTotal\)/.test(N));
ok('25. ...e o motivo (divergir = alguem criou uma segunda contagem)',
  /é porque alguém criou uma segunda contagem/.test(uc(N)));
ok('26. *** ha exportar: Excel e imprimir ***',
  /function excelGanhas\(\)/.test(N) && /function imprimirGanhas\(\)/.test(N));
ok('27. ...e os dois levam a taxa e a definicao junto',
  /ganhas de ' \+ k\.decididas \+ ' decididas/.test(N));
ok('28. o "no funil" e o "historico" MEXEM nos filtros em vez de duplicar a lista',
  /Duplicar a lista aqui seria manter dois lugares que mostram a mesma coisa/.test(uc(N)));
ok('29. e o historico REVELA o campo de busca (que nasce escondido)',
  /b\.style\.display = \(qual === 'historico'\) \? '' : 'none'/.test(N));
ok('30. ...com o motivo (mil e tantos negocios sem busca e lista pra rolar, nao pra usar)',
  /é uma lista pra rolar, não pra\s*usar/.test(uc(N)));

// ══════════ 5. O RESULTADO GRAVADO ══════════
ok('31. *** existe a tabela dos itens ganhos ***',
  /create table if not exists public\.negocio_itens_ganhos/.test(D));
ok('32. *** com marca, origem da marca e origem do numero ***',
  /marca_origem text check \(marca_origem in \('ata','estoque'\)\)/.test(D)
  && /origem       text not null default 'ia' check \(origem in \('ia','digitado'\)\)/.test(D));
ok('33. *** SEM delete e SEM update ***',
  !/on public\.negocio_itens_ganhos for (delete|update)/i.test(D));
ok('34. *** correcao e CONFIRMACAO NOVA, com a anterior visivel ***',
  /create trigger nig_confirmacao_t before insert/.test(D)
  && /Corrigir nao e apagar: e uma CONFIRMACAO NOVA/.test(uc(D)));
ok('35. ...com o motivo (e a unica coisa que responde "por que este negocio vale isso?")',
  /que e a unica coisa que responde "por que este negocio vale isso\?"/.test(uc(D)));
ok('36. *** a confirmacao do valor grava os itens junto ***',
  /rest\/v1\/negocio_itens_ganhos`, \{method:'POST'/.test(N));
ok('37. *** e gravar os itens falhar NAO desfaz o valor ***',
  /os itens NÃO foram gravados \(HTTP/.test(N) && /São duas gravações e a primeira já valeu/.test(uc(N)));
ok('38. *** a MARCA nunca e inventada ***',
  /marca_origem: x\.marca \? 'ata' : null/.test(N) && /A MARCA NUNCA É INVENTADA/.test(N));
ok('39. ...e a tela diz "sem marca no documento" em vez de campo vazio',
  /sem marca no documento/.test(N) && /Marca em branco é marca não sabida/.test(N));

// ══════════ 6. O QUADRO PRONTO NA FICHA ══════════
ok('40. *** o quadro le do BANCO, e nao de documento ***',
  /v_negocio_itens_ganhos\?negocio_id=eq\./.test(N));
ok('41. ...com o motivo (quem confirmou nao paga leitura de novo)',
  /quem confirmou uma vez não paga leitura de novo pra ver o que ganhou/.test(uc(N)));
ok('42. *** ele vem ANTES dos botoes de IA ***', N.indexOf('id="ata-resultado"') < N.indexOf('id="ata-relatorios"'));
ok('43. ...com o motivo (quem abre um negocio ganho quer VER, nao ser convidado a pagar)',
  /não ser convidado a pagar uma leitura/.test(uc(N)));
ok('44. *** negocio antigo do calendario NAO fica com tabela vazia ***',
  /Resultado <b>importado do histórico<\/b>/.test(N));
ok('45. ...com o motivo (tabela vazia pareceria erro de carregamento)',
  /faria alguém procurar um defeito que não existe/.test(uc(N)));
ok('46. *** quando os dois numeros divergem, a tela MOSTRA a diferenca ***',
  // (12/08: o ⚠️ virou ícone SVG. A promessa é o AVISO existir e nomear os dois números.)
  /Conferir:<\/b> valor da ficha /.test(N) && /soma dos itens /.test(N));
ok('47. ...com o motivo (escolher em qual acreditar e de quem confere, nao da tela)',
  /essa escolha é de quem confere, não da tela/.test(uc(N)));
ok('48. *** e a lista das ganhas tambem mostra a divergencia ***', /— conferir<\/div>/.test(N));
ok('49. *** `diferenca` e NULL quando nao ha itens (nao zero) ***',
  /case when g\.soma_itens is null then null/.test(D));
ok('50. ...com o motivo (sem detalhe e o normal do importado, e nao um erro)',
  /o que e o normal do historico ' 'importado do calendario — e nao um erro/.test(uc(D))
  || (/e o normal do historico/.test(uc(D)) && /e nao um erro/.test(uc(D))));
ok('51. erro de leitura dos itens nao vira "sem detalhe por item"',
  /isto <b>não<\/b> quer dizer que não existam/.test(N));

// ══════════ 7. A PROVA CONTRA O BANCO ══════════
ok('52. *** a prova refaz a conta com as MESMAS definicoes ***',
  /AS MESMAS DEFINICOES DA TELA \(numerosDoTopo\)/.test(P));
ok('53. *** e exige que a lista some EXATAMENTE o cartao ***',
  /Math\.abs\(somaLista - total\) < 0\.005/.test(P));
ok('54. *** e que a view do banco concorde ***', /Math\.abs\(somaView - total\) < 0\.005/.test(P));
ok('55. *** e que em-disputa nao entre no denominador ***',
  /!perdidas\.some\(n => !n\.arquivado\)/.test(P));
ok('56. e ela mostra o tamanho da correcao, sem defende-la',
  /pra mostrar o tamanho da correcao, e nao pra defende-la/.test(uc(P)));
ok('57. os numeros medidos ficam no cabecalho da suite (nao so no commit)',
  /taxa 15,1% \(105 de 695\) · total ganho R\$ 63\.034\.332,63/.test(R('tests', 'testa_kpis_clicaveis.js')));

// ══════════ 8. O TETO DE 1000 QUE FAZIA TODO NUMERO MENTIR ══════════
// MEDIDO NO AR em 11/08, com a tela aberta: `NEG.length === 1000` e o banco com 2.558 negocios.
// A consulta pedia `limit=3000`, e o teto NAO e do pedido — e do servidor. Pedir mais do que ele
// da nao levanta erro: devolve 1.000 linhas, calado.
// Todos os cartoes mentiam: historico 1.000 (real 2.558) · ganhas 23 (105) · taxa 10,6% (15,1%)
// · total ganho R$ 12,4 mi (R$ 63,0 mi). Nenhum parecia errado.
ok('64. *** a leitura dos negocios e PAGINADA por Range ***',
  /async function lerNegociosPaginado\(\)/.test(N) && /Range: `\$\{de\}-\$\{ate\}`/.test(N));
ok('65. *** e o `limit=3000` que nao resolvia saiu ***', !/negocios\?select=\*&order=abertura\.desc&limit=3000/.test(N));
ok('66. ...com a medicao registrada (1.000 de 2.558, e os 4 numeros errados)',
  /`NEG\.length === 1000`, e o banco com 2\.558 negócios/.test(uc(N))
  && /taxa vitória \.\. 10,6%    \(real 15,1%\)/.test(N));
ok('67. ...e a ligacao com o mesmo defeito da busca',
  /É exatamente o defeito que mordeu a busca do Natanael/.test(N));
ok('68. *** o teto de paginas existe, e bater nele AVISA na tela ***',
  /window\._negTruncou = true;/.test(N) && /leitura truncada/.test(N));
ok('69. ...com o motivo (20.000 truncados em silencio seriam este bug de novo)',
  /seriam este mesmo bug de novo/.test(uc(N)));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
