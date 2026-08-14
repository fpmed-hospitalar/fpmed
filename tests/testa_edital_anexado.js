// SUITE testa_edital_anexado — o edital vira arquivo NA MAO da empresa, e o leitor de IA usa ele.
//
// ══ O QUE ISTO RESOLVE ══════════════════════════════════════════════════════════════════════
// O indice do PNCP guarda o LINK do arquivo no site deles. Ter o PDF aqui e outra coisa: e o
// documento na mao de quem vai disputar, que nao depende do portal estar no ar no dia da sessao.
// (O caso do Lemuel: edital 50 da BLL, Prefeitura de Palmas — clicou, abriu.)
//
// ══ AS QUATRO DECISOES ══════════════════════════════════════════════════════════════════════
//   1. DUAS CATEGORIAS, e nao uma. `edital` e O documento (o que a IA le); `anexo_edital` sao os
//      que vem junto. Com tudo numa categoria so, o botao "Ler edital (IA)" teria que adivinhar
//      qual mandar — e adivinhar errado e pagar uma leitura pra resumir uma planilha de itens.
//   2. O NEGOCIO E SALVO ANTES DOS ARQUIVOS. Se um upload falha, o cadastro nao se perde. O
//      contrario perderia doze campos digitados por causa de um PDF grande demais.
//   3. FALHA PARCIAL E DITA, ARQUIVO POR ARQUIVO. "Nao deu certo" faria a pessoa mandar tudo de
//      novo e criar versoes duplicadas do que ja tinha subido.
//   4. A SECAO E DE QUALQUER NEGOCIO, e nao so dos manuais.
//
//   node tests/testa_edital_anexado.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const N = R('fpmed_negocios.html');
const T = R('fpmed_edital_ia.html');
const D = R('ddl', 'anexos_edital.sql');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_edital_anexado — o edital na mao da empresa\n');

// ══════════ 1. AS DUAS CATEGORIAS ══════════
ok('1. *** `edital` e `anexo_edital` entraram no check ***',
  /'edital',          -- O documento do certame/.test(D) && /'anexo_edital'\)\);/.test(D));
ok('2. *** e as SETE que ja existiam continuam ***',
  ['proposta', 'ata', 'contrato', 'proposta_final', 'ata_sessao', 'itens_ganhos', 'retorno_precos']
    .every(k => new RegExp("'" + k + "'").test(D)));
ok('3. *** duas categorias, e nao uma — com o motivo ***',
  /o botao "Ler edital \(IA\)" precisa saber QUAL arquivo mandar/.test(uc(D)));
ok('4. ...e o custo de adivinhar errado esta dito',
  /pagar uma leitura pra resumir uma planilha de itens/.test(uc(D)));
ok('5. o DDL e aditivo (troca a REGRA, nao apaga linha)',
  /Trocar um CHECK nao e apagar dado: e trocar a regra que valida o dado/.test(uc(D))
  && !/\b(delete from|truncate|drop table|drop column)\b/i.test(D.replace(/--[^\n]*/g, '')));

// ══════════ 2. NO FORMULARIO DE INCLUSAO ══════════
ok('6. *** existe o campo Observacao ***', /<textarea id="m-obs"/.test(N));
ok('7. *** e ele vai pras ANOTACOES, e nao pra um campo novo ***', /anotacoes: v\('m-obs'\) \|\| null,/.test(N));
ok('8. ...com o motivo (campo separado = dois lugares pra mesma coisa)',
  /o segundo seria o que ninguém lembra de ler/.test(uc(N)));
ok('9. ...e a tela DIZ pra onde vai', /Vai para as <b>Anotações<\/b> da ficha/.test(N));
ok('10. *** existe a area de arquivos, aceitando VARIOS ***', /<input type="file" id="m-arqs" multiple/.test(N));
ok('11. *** o primeiro vira `edital` e os demais `anexo_edital` ***',
  /i === 0 \? 'edital' : 'anexo_edital'/.test(N));
ok('12. ...e o formulario ANUNCIA essa convencao', /O <b>primeiro<\/b> arquivo entra como <b>edital<\/b>/.test(N));
ok('13. ...com o motivo de existir (quem inclui a mao esta com o edital aberto na frente)',
  /Pedir pra anexar depois é pedir pra ela procurar de novo/.test(uc(N)));

// ══════════ 3. O FLUXO: NEGOCIO PRIMEIRO ══════════
ok('14. *** o negocio e criado ANTES de subir arquivo ***',
  N.indexOf('const novo = (await r.json())[0];') < N.indexOf("document.getElementById('m-arqs')"));
ok('15. *** e o comentario diz por que ***',
  /O negócio JÁ ESTÁ CRIADO neste ponto/.test(N));
ok('16. ...com o custo do contrario (perderia doze campos por causa de um PDF)',
  /a pessoa teria que digitar os doze campos de novo/.test(uc(N)));
ok('17. *** o progresso e mostrado arquivo a arquivo ***',
  /'negócio criado · subindo ' \+ \(i\+1\) \+ ' de ' \+ arqs\.length \+ '…'/.test(N));
ok('18. *** falha de um arquivo NAO aborta os outros ***',
  /if\(!r2\.ok\) falhou\.push\(\{ nome: arqs\[i\]\.name, motivo: r2\.erro \}\);/.test(N));
ok('19. *** e a ficha AVISA qual arquivo faltou ***',
  /O negócio foi criado, mas '/.test(N) && /arquivo\(s\) NÃO subiram:/.test(N));
ok('20. ...com o motivo de o aviso ir pra ficha e nao pra um toast',
  /precisa saber\s*EXATAMENTE qual arquivo não subiu/.test(uc(N)));

// ══════════ 4. UM CAMINHO SO PRA SUBIR ══════════
ok('21. *** `subirAnexo` existe e e o caminho unico ***', /async function subirAnexo\(negocioId, arq, categoria\)/.test(N));
ok('22. ...com o motivo (havia duas copias; a terceira e onde uma comeca a divergir)',
  /três cópias é onde uma delas começa a divergir/.test(uc(N)));
ok('23. *** ela devolve {ok,erro} em vez de estourar ***',
  /return \{ ok:false, erro:/.test(N) && /return \{ ok:true, linha:/.test(N));
ok('24. ...com o motivo (quem chama precisa CONTINUAR com os outros arquivos)',
  /e não abortar a fila inteira no primeiro tropeço/.test(uc(N)));
ok('25. *** arquivo no bucket sem linha no banco conta como FALHA ***',
  /ARQUIVO NO BUCKET SEM LINHA NO BANCO É ARQUIVO QUE NINGUÉM ACHA/.test(N));
ok('26. o caminho do arquivo e limpo de acento e espaco',
  /normalize\('NFD'\)\.replace\(\/\\p\{M\}\/gu,''\)\.toLowerCase\(\)\.replace\(\/\[\^a-z0-9\._-\]\+\/g,'-'\)/.test(N));

// ══════════ 5. NA FICHA DE QUALQUER NEGOCIO ══════════
ok('27. *** a secao existe na aba Informacoes (de qualquer negocio) ***',
  /<div class="dw-sec" id="aba-edital">/.test(N) && /<h4>Edital e anexos<\/h4>/.test(N));
ok('28. *** e o comentario diz que NAO e so dos manuais ***',
  /Não só nos incluídos à mão/.test(uc(N)));
ok('29. ...com o motivo (o PNCP guarda o link; ter o PDF aqui nao depende do portal estar no ar)',
  /que não depende do portal\s*estar no ar no dia da sessão/.test(uc(N)));
/* Em 14/08 (fatia B12) este assert ficou vermelho SEM nada ter piorado: a chamada ganhou um
   segundo argumento (`this`), pra função poder escrever "abrindo…" no próprio nome enquanto a
   URL assinada não volta. O que ele guarda é a PROMESSA — clicar no nome abre o arquivo —, e
   ela continua de pé; o que mudou foi a forma de escrever. Reapontado pra promessa, com o
   parâmetro opcional, para o mesmo susto não se repetir na próxima melhoria. */
ok('30. *** o CLIQUE no nome ABRE o arquivo ***',
  /<span class="n" onclick="abrirAnexo\('\$\{esc\(a\.arquivo_path\)\}'(?:, this)?\)" title="abrir o arquivo">/.test(N));
ok('31. *** por link ASSINADO e curto (o bucket e privado) ***',
  /expiresIn: 60/.test(N) && /link de edital que vale para sempre é link que vaza/.test(uc(N)));
ok('32. *** os dois grupos aparecem separados ***', /bloco\('edital', 'Edital'\) \+ bloco\('anexo_edital', 'Anexos do edital'\)/.test(N));
ok('33. *** anexar da ficha tambem aceita varios, com falha parcial dita ***',
  /<input type="file" id="ed-arq" multiple>/.test(N)
  && /' de ' \+ arqs\.length \+ ' não subiram:/.test(N));
ok('34. ...dizendo que os outros ficaram', /Os outros ' \+ \(arqs\.length - falhou\.length\) \+ ' estão na lista acima/.test(N));
ok('35. ...com o motivo (senao a pessoa manda tudo de novo e duplica versoes)',
  /faria a pessoa mandar tudo de novo e criar versões duplicadas/.test(uc(N)));
ok('36. erro de leitura nao vira "nenhum anexo"', /isto <b>não<\/b> quer dizer que não existam/.test(N));

// ══════════ 6. A AMARRACAO COM O LEITOR DE IA ══════════
ok('37. *** o botao busca o edital anexado antes de ir ***',
  /categoria=eq\.edital&select=id,arquivo_path,arquivo_nome,versao&order=versao\.desc&limit=1/.test(N));
ok('38. *** e leva o CAMINHO, e nao o arquivo ***',
  /anexo: anexo \? \{ path: anexo\.arquivo_path, nome: anexo\.arquivo_nome, versao: anexo\.versao \} : null,/.test(N));
ok('39. ...com o motivo (megabytes por sessionStorage estouram a cota)',
  /Passar megabytes por sessionStorage estouraria\s*a cota do navegador no primeiro edital de verdade/.test(uc(N)));
ok('40. *** o leitor OFERECE usar o anexo ***',
  /📎 Usar o edital anexado/.test(T) && /async function usarAnexoDoNegocio\(\)/.test(T));
ok('41. *** e o anexo vira o MESMO `ARQUIVO` do upload ***',
  /ARQUIVO = new File\(\[blob\], n\.anexo\.nome/.test(T));
ok('42. ...com o motivo (dois fluxos = duas chances de um esquecer a particao ou o aviso de custo)',
  /Dois fluxos seriam duas chances de um deles esquecer a partição em\s*partes, ou o aviso de custo/.test(uc(T)));
ok('43. *** o upload manual CONTINUA como alternativa ***',
  /O UPLOAD CONTINUA LOGO ABAIXO, intocado/.test(T) && /<input type="file" id="arq"/.test(T));
ok('44. *** e a estimativa de custo aparece igual no atalho ***',
  /estimativa grosseira: <b>resumo<\/b> ~US\$ ' \+ custo\(1500\)/.test(T.slice(T.indexOf('usarAnexoDoNegocio'))));
ok('45. ...com o motivo (o operador nao pode ter menos informacao por usar o atalho)',
  /não\s*pode ter menos informação por ter usado o atalho/.test(uc(T)));
ok('46. falha ao baixar o anexo manda escolher do computador, e nao trava',
  /escolha o PDF do computador aqui embaixo/.test(T));
ok('47. e sem anexo a caixa diz o que dizia antes (o PDF e voce que escolhe)',
  /o PDF é você que escolhe aqui/.test(T));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
