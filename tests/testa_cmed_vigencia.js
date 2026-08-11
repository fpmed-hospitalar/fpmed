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
ok('17. *** duas edicoes convivendo aparecem na tela ***', /edições convivendo/.test(C));
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
ok('34. *** para quando a base ja tem duas edicoes convivendo ***', /EDICOES convivendo/.test(T));
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
ok('44. *** existe "Conferir preços (CMED)" na fileira do rodape da ficha ***',
  FILEIRA.includes("fpmed_conferidor.html") && FILEIRA.includes('Conferir preços (CMED)'));
ok('45. ...e ele e ATALHO, nao uma segunda tela de conferencia',
  /O Conferidor já existe; isto é atalho/.test(uc(N)));
ok('46. ...com o motivo de estar aqui (a hora do preço é a hora do pregão)',
  /quem está com a\s*ficha do pregão aberto é quem vai cotar/.test(uc(N)));

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

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
