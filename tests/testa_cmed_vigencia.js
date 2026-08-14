// SUITE testa_cmed_vigencia — QUAL regua esta valendo, e a rotina que troca de regua sem quebrar.
//
// ══ O ERRO QUE ESTA SUITE EXISTE PRA IMPEDIR ════════════════════════════════════════════════
// A CMED publica tabela nova TODO MES. Uma proposta conferida contra a edicao de dois meses atras
// pode estar acima do teto que vale hoje — e nada na tela pareceu errado em momento nenhum. O
// numero saiu verde, o operador mandou, e o pregoeiro desclassificou.
// Por isso:
//   1. A VIGENCIA E DERIVADA DO DADO, e nao de uma configuracao escrita a mao. Configuracao pode
//      discordar da base; derivada nao tem como, porque ela E a base.
//   2. A TELA DIZ QUAL REGUA USOU — e o .xlsx exportado carrega a data junto, porque ele sai da
//      tela e vive semanas no e-mail de alguem, longe de qualquer aviso.
//   3. A ROTINA DE TROCA PARA quando a planilha nao tem o que precisa — e NAO para quando o
//      cabecalho so mudou de linha, que e falso positivo mensal.
//
//   node tests/testa_cmed_vigencia.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const V = R('ddl', 'cmed_vigencia.sql');
const T = R('tools', 'atualiza_cmed.js');
const C = R('fpmed_conferidor.html');
const N = R('fpmed_negocios.html');
const CARR = R('tools', 'carrega_cmed_precos.js');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_cmed_vigencia — qual regua esta valendo\n');

// ══════════ 1. A VIGENCIA E DERIVADA ══════════
ok('1. *** a vigencia sai de uma VIEW sobre o dado, nao de uma tabela de configuracao ***',
  /create or replace view public\.v_cmed_vigencia/.test(V) && !/create table[^\n]*cmed_config/i.test(V));
ok('2. ...e o motivo esta escrito (configuracao vira uma resposta segura e errada)',
  /E o pior tipo de erro deste sistema: uma resposta segura e errada/.test(uc(V)));
ok('3. *** a regua vale pela data MAIS ANTIGA das duas listas ***',
  /least\(max\(p\.publicada_site\), max\(p\.publicada_gov\)\) as vigente_desde/.test(V));
ok('4. ...com o motivo (anunciar a mais nova promete um frescor que metade da regua nao tem)',
  /prometer um frescor que a base nao tem/.test(uc(V)));
ok('5. *** `edicoes` denuncia carga pela metade ***',
  /count\(distinct p\.publicada_gov\)\s+as edicoes/.test(V));
ok('6. ...e a view diz o que fazer com isso (a tela precisa DIZER, e nao escolher uma)',
  /a tela precisa dizer isso, e nao escolher uma e seguir em frente/.test(uc(V)));
ok('7. a view roda com os direitos de quem consulta', /with \(security_invoker = true\)/.test(V));
ok('8. e o anon nao a alcanca', /revoke all on public\.v_cmed_vigencia from anon;/.test(V));
ok('9. o DDL e aditivo (nenhum drop de tabela nem update de dado)',
  !/\b(drop table|drop column|delete from|truncate|update )\b/i.test(V.replace(/--[^\n]*/g, '')));

// ══════════ 2. O CONFERIDOR DIZ QUAL REGUA USOU ══════════
ok('10. *** a tela le a vigencia junto com a regua ***', /v_cmed_vigencia\?select=\*/.test(C));
ok('11. *** e a frase sai de UM lugar (tela e planilha nao podem discordar) ***',
  /function frasePelaRegua\(\)/.test(C));
ok('12. ...com o motivo escrito', /num documento que vale como conferência de preço legal/.test(uc(C)));
ok('13. *** a frase mostra a DATA da edicao, e nao so o tamanho da base ***',
  /CMED publicada em \$\{d\.toLocaleDateString\('pt-BR'\)\}/.test(C));
ok('14. ...e diz ha quantos dias', /há \$\{dias\} dias/.test(C));
ok('15. *** regua velha (>45 dias) vira AVISO na tela ***',
  /const velha = isFinite\(dias\) && dias > 45;/.test(C) && /provavelmente há edição mais nova/.test(C));
ok('16. ...com o motivo (a CMED publica todo mes)', /A CMED publica todo mês; a tela avisa/.test(uc(C)));
/* ══ 17 REAPONTADO EM 13/08 (item 10), E POR DECISAO ═══════════════════════════════════════
   Ele cobrava a frase "edições convivendo" — a redacao do ALARME. Depois que a base passou a
   guardar todas as edicoes de proposito, esse alarme acusava o comportamento CERTO, e a cada
   carga mensal a tela passaria a gritar pra sempre. Assert que exige o alarme errado IMPEDE o
   conserto: pra apagar o grito eu teria que deixar a suite vermelha.
   >>> O QUE ELE GUARDAVA DE VALIOSO CONTINUA GUARDADO, e e a INFORMACAO: quem confere preco
       legal tem direito de saber contra qual regua conferiu e que ha outra guardada. Entao o
       assert cobra o NUMERO na tela, e nao a palavra escolhida.
   >>> E ENTROU O 17b, QUE E O QUE FALTAVA: cobrar que essa frase NAO seja alarme. Sem ele,
       alguem "melhora" a tela devolvendo o ⚠️ e a suite nao reclama — que e exatamente como o
       alarme errado sobreviveu ate hoje. */
ok('17. *** a tela diz quantas edicoes estao guardadas (quem confere preco tem que saber) ***',
  /\$\{v\.edicoes\} edições guardadas/.test(C));
ok('17b. *** ...e NAO como alarme: guardar a edicao anterior e o desenho, nao defeito ***',
  (function () {
    const m = C.match(/Number\(v\.edicoes\) > 1 \? `[^`]*`/);
    return !!m && !/⚠️/.test(m[0]) && !/--vermelho|--ambar/.test(m[0]);
  })(), (C.match(/Number\(v\.edicoes\) > 1 \? `[^`]*`/) || [])[0]);
ok('18. *** falhar em ler a vigencia NAO derruba a conferencia ***',
  /\.catch\(\(\) => null\)/.test(C) && /ela é a legenda do resultado, não o\s*resultado/.test(uc(C)));
ok('19. ...e a tela DIZ que nao sabe a data, em vez de inventar uma',
  /não consegui ler qual edição/.test(C) && /Sem ela a tela diz que não sabe a data — e não inventa uma/.test(uc(C)));

// ══════════ 3. O EXCEL CARREGA A REGUA ══════════
ok('20. *** o .xlsx exportado leva a data da CMED dentro ***',
  /Conferido contra a tabela CMED publicada em /.test(C) && /sheet_add_aoa\(ws, \[\[\], \[regua\]/.test(C));
ok('21. ...e diz quando foi gerado e que a CMED muda todo mes',
  /a CMED publica nova tabela todo mês/.test(C));
ok('22. ...e avisa quando NAO conseguiu identificar a edicao (nao omite)',
  /ATENÇÃO: não foi possível identificar a edição da CMED usada nesta conferência/.test(C));
ok('23. ...entrando ABAIXO da tabela, pra nao atrapalhar filtro e ordenacao',
  /\{ origin: -1 \}/.test(C) && /pra não atrapalhar quem filtra ou ordena as colunas/.test(uc(C)));

// ══════════ 4. A ROTINA MENSAL ══════════
ok('24. *** ela NAO reimplementa o parse: delega ao carregador de sempre ***',
  /carrega_cmed_precos\.js'\)/.test(T) && /execFileSync\(process\.execPath, \[path\.join\(__dirname, 'carrega_cmed_precos\.js'\)/.test(T));
ok('25. ...com o motivo (duas leituras da mesma planilha, uma errando em silencio num TETO LEGAL)',
  /uma delas errando em silencio num numero que vira TETO LEGAL/.test(uc(T)));
ok('26. *** ela para quando a coluna "PMVG 19 %" (GO) nao existe ***',
  /nao achei a coluna \$\{?"?\$\{prefixoEsperado\} 19 %/.test(T) || /19 %" \(a aliquota de GOIAS\)/.test(T));
ok('27. *** para quando nao ha "Publicada em" (sem data nao se sabe que regua e essa) ***',
  /sem a data da edicao nao da pra saber que regua e essa/.test(T));
ok('28. *** para quando o cabecalho SUMIU (mas nao quando so mudou de linha) ***',
  /nao achei o cabecalho \(a linha que comeca em SUBSTANCIA\)/.test(T));
ok('29. ...e explica que a ancora ja resolve mudanca de linha',
  /O CABECALHO E ACHADO POR ANCORA/.test(T) && /Mudar de linha nao quebra nada/.test(uc(T)));
ok('30. *** a POSICAO da coluna e informacao, e nao criterio ***',
  /a posicao nao e criterio/.test(T));
ok('31. ...e o motivo (a 1a versao gerava alarme mensal por nada)',
  /Alarme que toca a toa e alarme\s*que se aprende a ignorar/.test(uc(T)));
ok('32. *** para quando a planilha e MAIS VELHA que a base no ar ***',
  /e MAIS VELHA que a base no ar/.test(T));
ok('33. ...com o motivo (rebaixar a regua sem ninguem perceber)',
  /Carregar uma planilha mais velha por cima da vigente\s*REBAIXA a regua sem ninguem perceber/.test(uc(T)));
/* ══ REAPONTADO POR DECISAO DO DONO (item 10, 13/08) ═══════════════════════════════════════
   Este assert guardava "para quando a base ja tem duas edicoes convivendo". Conviver ERA
   sintoma de carga pela metade — e virou o DESENHO: "VERSIONAR POR EDICAO, nada de apagar a
   anterior; assim o teto de qualquer proposta antiga continua auditavel".
   >>> O ALARME VELHO NAO SO FICOU INUTIL: ele PARARIA TODA CARGA a partir da segunda. Um assert
       que exige o alarme errado e pior que assert nenhum — ele impede o conserto.
   >>> O QUE ELE VIGIA AGORA e o que continua sendo defeito de verdade: edicao guardada com
       CONTAGEM ESTRANHA (a CMED publica ~26 mil por edicao; um punhado de linhas nao e
       historico, e carga que morreu no meio). E ele so PARA quando a incompleta e a VIGENTE —
       porque ai o teto de HOJE sai de uma carga pela metade. */
ok('34. *** vigia edicao INCOMPLETA (e nao "duas edicoes"), e so para se a incompleta for a vigente ***',
  /carga que morreu no meio/.test(T)
  && /Number\(e\.apresentacoes\) < 1000/.test(T)
  && /magras\.some\(e => e\.vigente\)/.test(T)
  && !/EDICOES convivendo/.test(T));
ok('35. *** sem --apply nada e gravado ***',
  /\[CONFERENCIA — nada foi gravado\]/.test(T) && /if \(!APPLY\)/.test(T));
ok('36. *** e ela confere DEPOIS da carga, e nao so antes ***',
  /a regua DEPOIS da carga/.test(T) && /Carga que termina sem erro nao e carga que deu certo/.test(uc(T)));
ok('37. *** o desconto do CAP e a prova barata de que leu a coluna certa (~21,5%) ***',
  /desconto medio do CAP/.test(T) && /m < 15 \|\| m > 30/.test(T));
ok('38. ...com o motivo (teto errado em 2.722 apresentacoes sem erro na tela)',
  /o teto sairia errado em 2\.722\s*apresentacoes sem nenhum erro na tela/.test(uc(T)));
ok('39. falha de leitura da vigencia vira "nao sei", nunca "a base esta vazia"',
  /Isto NAO quer dizer que a base esta vazia — quer dizer que nao sei/.test(T));
ok('40. *** o download automatico foi investigado e NAO feito, com o porque ***',
  /O DOWNLOAD AUTOMATICO: investigado em 11\/08 e NAO implementado/.test(T)
  && /"nao baixou" viraria "a regua nao mudou"/.test(T));

// ══════════ 5. O QUE JA EXISTIA E CONTINUA VALENDO ══════════
ok('41. *** o carregador acha o cabecalho por ancora (nao por numero de linha) ***',
  /r\.some\(c => \/\^SUBST\/i\.test\(String\(c\)\)\)/.test(CARR));
ok('42. *** e mapeia as aliquotas por NOME (nao por posicao) ***',
  /function mapaAliquotas\(head, prefixo\)/.test(CARR) && /new RegExp\('\^' \+ prefixo \+ '\\\\b', 'i'\)/.test(CARR));
ok('43. *** e ja abortava sem a coluna PMVG 19 % ***',
  /nao achei a coluna "PMVG 19 %" \(aliquota de GOIAS\)/.test(CARR));

// ══════════ 6. O ATALHO NA FICHA ══════════
// Mesma escolha das outras suites: recortar a fileira, e nao casar distancia. Ela cresce.
const FILEIRA = (() => {
  const i = N.indexOf('class="dw-acoes"'); if (i < 0) return '';
  const j = N.indexOf('fecharDrawer()', i); return j < 0 ? '' : N.slice(i, j + 40);
})();
/* ══ 14/08 (fatia B3): A PROMESSA DESTE BLOCO SE INVERTEU, POR ORDEM DO DONO ═════════════════
   Ate 13/08 esta suite exigia que existisse "Conferir preços (CMED)" no rodape da ficha,
   levando pro Conferidor. A ordem do dono e literal: *a CMED nunca abre janela nem aba fora*.
   Aquele botao fazia `location.href` — ele TROCAVA a tela e largava o negocio pra tras, e de
   la so se volta pelo botao do navegador. Chamar aquilo de "atalho" era eu me enganando.
   >>> ENTAO O QUE SE EXIGE AGORA E O CONTRARIO, e com a mesma severidade: que o botao NAO
       exista, que NENHUM caminho da ficha leve pro Conferidor, e que a comparacao contra o teto
       esteja na LINHA DO ITEM, dentro da propria ficha.
   >>> O CONFERIDOR NAO FOI DESLIGADO. Ele continua no menu e continua sendo a tela de quem
       chega com um PDF de proposta. O que ele deixou de ser e um destino alcancado de DENTRO
       do negocio — e e isso que as tres linhas abaixo passam a guardar. */
/* O NOME DA TELA CONTINUA ESCRITO NO ARQUIVO, e tem que continuar: os dois comentarios que
   explicam POR QUE o botao saiu citam o `location.href` que ele fazia. Apagar a explicacao
   junto com o codigo deixaria a proxima pessoa reintroduzindo o botao por achar que faltava.
   >>> ENTAO A PROVA E SOBRE O CODIGO, e nao sobre o texto: os comentarios de bloco saem antes
       de procurar. O que nao pode existir e um caminho EXECUTAVEL pro Conferidor. */
const semComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
ok('44. *** NENHUM caminho EXECUTAVEL da ficha leva pra tela do Conferidor (lei do dono) ***',
  !/fpmed_conferidor\.html/.test(semComentarios(N)),
  (semComentarios(N).match(/.{60}fpmed_conferidor\.html.{20}/) || [''])[0]);
ok('45. ...e a acao do rodape virou a ABA ITENS desta mesma ficha, sem sair dela',
  /itens:\s*\{ rot: '[^']*Itens e teto CMED', fn: `abaFicha\(/.test(N));
ok('46. ...com o motivo escrito (um atalho que TROCA a tela e uma segunda tela)',
  /um atalho que\s*TROCA a tela e larga o negócio pra trás é uma segunda tela/.test(uc(N)));
// *** E A CMED NAO PODE ABRIR JANELA NENHUMA ***: `window.open` existe nesta tela para imprimir
// (conferencia, ganhas, mapa, carta) e para o zap. O que nao pode e um `window.open`/`_blank`
// que leve A CMED pra fora. A prova e por RECORTE do bloco da aba Itens, que e o unico lugar
// onde a comparacao contra o teto agora vive.
const ABA_ITENS = (() => {
  const i = N.indexOf('A ABA ITENS — E O TETO CMED POR BAIXO (14/08, fatia B3)');
  // >>> O RECORTE COMECA DEPOIS DO `*/` DO CABECALHO, e isso nao e detalhe: a ancora esta DENTRO
  //     de um comentario de bloco, entao fatiar a partir dela deixa um pedaco de comentario sem
  //     o `/*` que o abre — e o `semComentarios` nao tem como reconhece-lo. Como esse cabecalho
  //     e justamente o que explica o `location.href` que FOI REMOVIDO, o teste acusava o proprio
  //     texto que documenta a remocao. O recorte e de CODIGO.
  const c = i < 0 ? -1 : N.indexOf('*/', i);
  const j = N.indexOf('OS PRAZOS QUE PENDEM DESTA DATA', i);
  return c < 0 || j < 0 ? '' : N.slice(c + 2, j);
})();
ok('46b. *** a comparacao contra o teto nao abre janela nem aba nenhuma ***',
  ABA_ITENS.length > 2000 && !/window\.open|_blank|location\.href/.test(semComentarios(ABA_ITENS)),
  ABA_ITENS.length);
ok('46c. ...e ela usa o MESMO motor de teto, nao uma segunda regra',
  /window\.LimedtecTetoCMED/.test(ABA_ITENS) && /carregarIdxCMED\(\)/.test(ABA_ITENS));
// *** "NAO ENCONTRADO" NUNCA VIRA VERDE E NUNCA VIRA ZERO ***
ok('46d. *** item que a CMED nao conhece fica NEUTRO, e a tela diz que neutro nao e ok ***',
  /sem teto CMED/.test(ABA_ITENS)
  && /Sem teto na CMED não quer dizer dentro do teto/.test(uc(ABA_ITENS)));

// ══════════ 7. A TRAVA E EXERCITADA, E NAO SO LIDA ══════════
// Assert de texto prova que a MENSAGEM de parada existe. Nao prova que ela dispara — e esta
// trava so seria testada de verdade no mes em que a ANVISA mudar a planilha, que e o pior dia
// possivel pra descobrir que ela nao pegava.
const PT = R('tools', 'prova_trava_cmed.js');
ok('47. *** existe uma prova que RODA o comando contra planilhas defeituosas ***',
  /execFileSync\(process\.execPath,\s*\n?\s*\[path\.join\(__dirname, 'atualiza_cmed\.js'\)/.test(PT));
ok('48. *** ela fabrica os defeitos a partir das planilhas REAIS, sem toca-las ***',
  /NAO TOCA NAS PLANILHAS ORIGINAIS/.test(PT) && /os\.tmpdir\(\)/.test(PT)
  && /FABRICADAS a partir das reais/.test(uc(PT)));
ok('49. *** e o 3o caso exige que a rotina SIGA quando o cabecalho so muda de linha ***',
  /\['cabecalho 10 linhas mais abaixo', TMP \+ '\/xls_conformidade_gov_HEADER_MOVIDO\.xlsx', false\]/.test(PT));
ok('50. ...com o motivo (parar nisso seria falso positivo TODO MES)',
  /seria um falso positivo TODO MES/.test(uc(PT)));
ok('51. e ela nao grava nada (roda sem --apply)', /nao grava nada no banco \(roda sem --apply\)/.test(uc(PT)));

/* ══════════ 8. A ROTINA MENSAL CARREGA AS DUAS METADES ══════════════════════════════════════
   ACHADO RODANDO A CARGA DE VERDADE EM 13/08, e nao lendo codigo: `atualiza_cmed.js --apply`
   chamava SO o carregador da `cmed_precos`. A `cmed_pf` — substancia, apresentacao, dose_key —
   ficava na edicao anterior.
   >>> E O ESTADO RESULTANTE NAO QUEBRAVA NADA, que e o que o torna grave: a
       `cmed_edicao_vigente` responde separado por metade, entao a regua continuava servindo —
       com NOME E DOSE de uma edicao e PRECO da outra. Medido: pf 2026-07-21 x gov 2026-08-11,
       regua com 25.702 das 26.001 linhas, `cmed_teto` caindo de 4.875 pra 4.857 chaves.
   >>> POR QUE O ASSERT E DE ORDEM E NAO SO DE PRESENCA: se a segunda carga morrer no meio, o
       estado que sobra tem que ser o que DENUNCIA A SI MESMO. Com a `cmed_pf` primeiro, a
       regua encolhe de forma visivel; ao contrario, ela serviria mistura em silencio. */
const AT = R('tools', 'atualiza_cmed.js');
/* ══ O ARQUIVO PRECISA COMPILAR, E ISSO NAO ERA COBRADO ═════════════════════════════════════
   Enquanto eu consertava a rotina em 13/08 eu apaguei um `catch` junto com um bloco. O arquivo
   ficou com SyntaxError — `node tools/atualiza_cmed.js` morria antes da primeira linha — e
   ESTA SUITE FICOU VERDE, porque todos os asserts dela leem o arquivo como TEXTO.
   >>> Assert que procura frase no fonte prova que a frase esta escrita. Nao prova que o
       programa existe. Uma suite inteira de regex pode passar sobre um arquivo que nao roda,
       e foi o que aconteceu — eu descobri por acaso, rodando `node -c` por outro motivo.
   >>> `vm.Script` compila sem executar: e a mesma checagem do `node --check`, sem rodar carga
       nenhuma contra o banco. */
(function () {
  const vm = require('vm');
  let erro = null;
  try { new vm.Script(AT, { filename: 'atualiza_cmed.js' }); } catch (e) { erro = e.message; }
  ok('51b. *** o tools/atualiza_cmed.js COMPILA (a suite lia texto e nao via arquivo quebrado) ***',
    erro === null, erro);
})();
(function () {
  const iPf = AT.indexOf("'carrega_cmed_pf.js'");
  const iPrecos = AT.indexOf("'carrega_cmed_precos.js'");
  ok('52. *** a rotina mensal carrega a cmed_pf, e nao so a cmed_precos ***', iPf > -1, { iPf });
  ok('53. *** ...e a cmed_pf vem PRIMEIRO (a metade incompleta que se denuncia sozinha) ***',
    iPf > -1 && iPrecos > -1 && iPf < iPrecos, { iPf, iPrecos });
  ok('54. ...com o motivo escrito, pra ninguem "simplificar" isso de volta',
    /juntando NOME E DOSE de uma edicao com PRECO da outra/.test(AT));
})();
/* O ALARME MUDOU DE ALVO: nao e QUANTAS edicoes existem (guardar e o desenho), e se a VIGENTE
   esta incompleta. O assert cobra o alvo novo E proibe a volta do velho. */
/* ESTE ASSERT PASSOU VERDE NUMA MUTACAO QUE DEVIA TE-LO MATADO, e o motivo era ele mesmo:
   a conferencia de "edicao incompleta" existia DUAS VEZES no arquivo (antes e depois da
   carga), e o assert so procurava o padrao em qualquer lugar. Mutei uma copia, a outra
   segurou o verde. Agora ha UMA funcao e o assert cobra a funcao, alem de exigir que ela seja
   chamada nos DOIS momentos — que e o que a duplicacao mascarava. */
ok('55. *** o alarme vigia edicao INCOMPLETA, nao a quantidade de edicoes ***',
  /async function conferirAcervo\(momento\)/.test(AT)
  && /apresentacoes\) < 1000/.test(AT) && /carga que morreu no meio/.test(AT));
ok('55b. *** e a conferencia e UMA SO, chamada antes E depois da carga ***',
  (AT.match(/apresentacoes\) < 1000/g) || []).length === 1
  && /conferirAcervo\('antes'\)/.test(AT) && /conferirAcervo\('depois'\)/.test(AT),
  { copias: (AT.match(/apresentacoes\) < 1000/g) || []).length });
ok('55c. ...e ANTES ela PARA, DEPOIS ela so diagnostica (parar depois nao desfaz a carga)',
  /momento === 'antes'\) parar\(/.test(AT) && /A EDICAO VIGENTE FICOU INCOMPLETA/.test(AT));
/* ESTE ASSERT NASCEU VERMELHO MORDENDO O PROPRIO COMENTARIO que explica por que o alarme saiu
   — a lapide cita a frase antiga, como toda lapide honesta deve citar. Assert de AUSENCIA tem
   que ler CODIGO, nunca prosa: senao explicar bem uma remocao passa a quebrar a suite, e a
   saida mais facil vira apagar a explicacao. (S9/S10 de novo, agora em cima de mim.) */
const semComentario = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok('56. *** e o alarme velho ("ficaram DUAS edicoes") nao voltou ao codigo ***',
  !/ficaram DUAS edicoes na base/.test(semComentario(AT)));
ok('57. *** as duas metades sao impressas SEPARADAS (a linha antiga misturava data e contagem) ***',
  /cmed_pf     publicada em \$\{pf\}/.test(AT) && /cmed_precos publicada em \$\{gov\}/.test(AT));
ok('58. *** e metade em edicao diferente da outra e ALARME ***',
  /if \(pf !== gov\)/.test(AT) && /EDICOES DIFERENTES/.test(AT));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
