// SUITE testa_gerenciamento_ata — a fase final: documentos assinados, o que se ganhou, e por
// quanto se perdeu.
//
// ══ AS CINCO DECISOES QUE ESTA SUITE TRAVA ══════════════════════════════════════════════════
//   1. ROTULO MUDA, CHAVE NAO. Mesma regra do Habilitacao: `contrato` esta no check constraint,
//      no MAPA_STATUS e no historico. Renomear o VALOR exigiria migracao de dado pra mudar uma
//      palavra que so existe pra ser lida.
//   2. AS DUAS LEITURAS DE IA ENTRAM NA FUNCAO QUE JA EXISTE. Ela ja tem a permissao conferida
//      no servidor, o contador, o teto por tarefa e o bloqueio de leitura cortada. Funcao nova
//      seria uma segunda permissao e um segundo contador pra mesma cobranca.
//   3. A IA NUNCA ESCREVE NO `valor_ganho`. Ele alimenta a TAXA DE VITORIA — o numero que a
//      empresa usa pra decidir onde disputar. O relatorio SUGERE; confirmar e clique de gente,
//      e o rastro guarda de onde veio.
//   4. A IA NAO FAZ CONTA. No mapa de precos ela COPIA os valores; a diferenca em R$ e % sai de
//      aritmetica na tela. Modelo de linguagem errando uma subtracao e um jeito silencioso de a
//      analise inteira ficar errada.
//   5. UM CONTADOR DE FATURAMENTO NAO FALHA CALADO. (Ver o defeito medido no ddl/usos_ia_tarefas5.)
//
//   node tests/testa_gerenciamento_ata.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const N = R('fpmed_negocios.html');
const F = R('supabase', 'functions', 'ler-edital', 'index.ts');
const D5 = R('ddl', 'usos_ia_tarefas5.sql');
const DA = R('ddl', 'negocio_anexos.sql');
const TELA = R('fpmed_edital_ia.html');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_gerenciamento_ata — o fim da historia do negocio\n');

// ══════════ 1. O ROTULO ══════════
// O BLOCO DAS FASES, recortado. Sem recortar, `k:'ata'` e `n:'Contrato'` da lista de CATEGORIAS
// DE ANEXO (que sao legitimos: existe a categoria "ata" e a categoria "Contrato") faziam o
// assert falhar por um motivo que nao tem nada a ver com o que ele protege.
const FASES_BLOCO = (() => {
  const i = N.indexOf('const FASES = ['); if (i < 0) return '';
  const j = N.indexOf('];', i); return j < 0 ? '' : N.slice(i, j + 2);
})();

ok('1. *** a fase exibe "Ata" no funil ***', /\{ k:'contrato',      n:'Ata',/.test(FASES_BLOCO));
ok('2. *** e a CHAVE continua `contrato` (nada de migracao de dado) ***',
  /k:'contrato'/.test(FASES_BLOCO) && !/k:'ata'/.test(FASES_BLOCO));
ok('3. *** a aba da ficha diz por extenso "Gerenciamento de Ata" ***',
  /data-aba="ata"\s+onclick="abaFicha\(this,'ata'\)">Gerenciamento de Ata/.test(N));
ok('4. ...e a razao dos dois nomes esta escrita (espacos diferentes, nao nomes diferentes)',
  /são\s*dois lugares com espaço diferente, não dois nomes para a mesma coisa/.test(uc(N)));
ok('5. o rotulo continua saindo de UM lugar (FASES)',
  /const nomeFase = k => \(FASES\.find\(f=>f\.k===k\)\|\|\{\}\)\.n \|\| k;/.test(N));
ok('6. nao sobrou "Contrato" como rotulo de fase', !/n:'Contrato'/.test(FASES_BLOCO));

// ══════════ 2. OS ANEXOS TIPADOS ══════════
ok('7. *** as SEIS categorias da ata estao na tela ***',
  ["'ata'", "'contrato'", "'proposta_final'", "'ata_sessao'", "'itens_ganhos'", "'retorno_precos'"]
    .every(k => new RegExp('\\{ k:' + k).test(N)));
ok('8. *** e todas ja existiam no check do banco (a fundacao nasceu inteira) ***',
  ['ata', 'contrato', 'proposta_final', 'ata_sessao', 'itens_ganhos', 'retorno_precos']
    .every(k => new RegExp("'" + k + "'").test(DA)));
ok('9. *** a lista e AGRUPADA por tipo ***', /const porCat = \{\};/.test(N) && /nomeCat\(/.test(N));
ok('10. *** categoria vazia NAO aparece ***',
  /const cheias = ATA_CATS\.filter\(c => porCat\[c\.k\]\);/.test(N));
ok('11. ...com o motivo (seis cabecalhos com "nenhum" empurram pra baixo os dois que existem)',
  /a lista deixa de ser lida/.test(uc(N)));
ok('12. cada anexo mostra versao, data e quem subiu',
  /<span class="v">v\$\{a\.versao\}<\/span>/.test(N) && /a\.enviado_por/.test(N));
ok('13. *** as versoes empilham (a versao vem da trigger, e nao da tela) ***',
  /create trigger anexo_versao_t before insert/.test(DA) && !/versao: /.test(N.match(/function anexarAta[\s\S]{0,1400}/)[0]));
ok('14. o link do anexo continua assinado e curto', /expiresIn: 60/.test(N));

// ══════════ 3. AS DUAS LEITURAS, NA FUNCAO QUE JA EXISTE ══════════
ok('15. *** os dois prompts moram na `ler-edital` ***',
  /const PERGUNTA_GANHOS = /.test(F) && /const PERGUNTA_MAPA = /.test(F));
ok('16. *** e as cinco tarefas saem de um objeto, e nao de escada de ternario ***',
  /const PROMPTS: Record<string, string> = \{/.test(F) && /"itens-ganhos": PERGUNTA_GANHOS/.test(F));
ok('17. ...com o motivo (com cinco, a escada esconde qual prompt vai com qual teto)',
  /a escada passa a esconder qual prompt vai com qual teto/.test(uc(F)));
ok('18. *** cada uma tem teto de saida proprio ***',
  /"itens-ganhos": 12000, "mapa-precos": 16000/.test(F));
ok('19. ...e o mapa e o maior, com o motivo (uma LINHA POR CONCORRENTE de cada item)',
  /e o mapa de precos e a maior de todas, porque traz uma LINHA POR CONCORRENTE de cada item/.test(uc(F)));
ok('20. *** a tela chama a funcao que ja existe, e nao uma nova ***',
  /functions\/v1\/ler-edital`, \{method:'POST'/.test(N));
ok('21. ...com o motivo (funcao nova = 2a permissao e 2o contador pra mesma cobranca)',
  /Função nova seria uma segunda permissão e um segundo contador\s*para a mesma cobrança/.test(uc(N)));
ok('22. *** os botoes so aparecem pra quem tem o piloto ***',
  /if\(!podeLerEdital\(\)\)\{/.test(N) && /estão em piloto, liberados só para o '/.test(N));
ok('23. *** e so quando HA o documento que eles leem ***',
  /const temGanhos = porCat\['itens_ganhos'\] \|\| porCat\['ata_sessao'\];/.test(N)
  && /const temMapa   = porCat\['ata_sessao'\] \|\| porCat\['retorno_precos'\];/.test(N));
ok('24. ...com o motivo (botao sem documento so pode gastar uma leitura pra dizer "nao achei")',
  /só pode fazer uma coisa: gastar uma leitura\s*pra dizer "não achei"/.test(uc(N)));
ok('25. o documento lido e escolhido por CATEGORIA, e nao "o mais recente"',
  /const prefs = tarefa === 'itens-ganhos' \? \['itens_ganhos','ata_sessao'\] : \['ata_sessao','retorno_precos'\];/.test(N));

// ══════════ 4. A HONESTIDADE DAS DUAS LEITURAS ══════════
ok('26. *** o prompt dos ganhos proibe chutar a nosso favor ***',
  /Na duvida, ponha em "nao_consegui_ler" — nunca chute a nosso favor/.test(F));
ok('27. *** e exige o DENOMINADOR (quantos itens o documento tinha) ***',
  /"itens_no_documento" e o TOTAL de itens que aparecem no documento/.test(F));
ok('28. ...com o motivo (o X sozinho de "ganhou X de Y" nao informa nada)',
  /e o denominador do "ganhou X de Y", e sem\s*ele o X sozinho nao informa nada/.test(uc(F)));
ok('29. *** lista vazia nao vira "nao ganhou nada" ***',
  /Lista vazia sem esse aviso seria dizer que a empresa nao ganhou nada/.test(F));
ok('30. ...e a tela repete isso', /Isto não quer dizer que a empresa não ganhou nada/.test(N));
ok('31. *** o prompt do mapa PROIBE a IA de calcular ***',
  /NAO calcule diferencas, percentuais nem medias/.test(F));
ok('32. *** e a diferenca e feita com aritmetica na tela ***',
  /const difRS = \(nosso != null && venc != null\) \? \+\(nosso - venc\)\.toFixed\(4\) : null;/.test(N));
ok('33. ...com o motivo (modelo errando subtracao e erro silencioso, e a conta e barata)',
  /essa conta e barata\s*demais pra terceirizar/.test(uc(F)));
ok('34. *** meio dado vira "—", e nao zero ***',
  /A diferença só existe quando os DOIS números existem/.test(uc(N)));
ok('35. "nao participamos" e diferente de "perdeu"',
  /Isso e diferente de ter perdido/.test(F));
ok('36. *** o aviso de conferir e o cabecalho dos dois relatorios ***',
  (N.match(/Confira contra (o documento|a ata) antes de usar/g) || []).length >= 2);
ok('37. o que a leitura NAO leu aparece, em vez de sumir',
  (N.match(/nao_consegui_ler/g) || []).length >= 2);
ok('38. o total dos ganhos soma so o que tem valor, e diz quantos ficaram de fora',
  /sem valor legível ficaram de fora da soma/.test(N));

// ══════════ 5. A SUGESTAO COM CONFIRMACAO DE GENTE ══════════
ok('39. *** o total vira SUGESTAO, e o texto diz que NAO foi gravado ***',
  /Sugestão para o valor ganho:/.test(N) && /Este número <b>não foi gravado<\/b>/.test(N));
ok('40. ...com o motivo (a IA nao escreve num campo que decide onde disputar)',
  /a IA não escreve\s*sozinha num campo que a empresa usa pra decidir onde disputar/.test(uc(N)));
ok('41. *** confirmar exige um clique E um confirm ***',
  /function confirmarValorGanho\(id, valor\)/.test(N) && /if\(!confirm\('Gravar '/.test(N));
ok('42. ...e o confirm avisa que o numero alimenta a taxa de vitoria',
  /Este número alimenta a taxa de vitória/.test(N));
ok('43. ...e avisa quando ja havia um valor que vai ser substituido',
  /O valor atual é ' \+ brl\(antes\) \+ ' e será substituído/.test(N));
ok('44. *** o rastro guarda que o numero veio de leitura por IA ***',
  /confirmado a partir do relatório de itens ganhos lido por IA/.test(N));
ok('45. ...com o motivo (daqui a seis meses "por que vale isso?" tem resposta)',
  /tem resposta/.test(uc(N)) && /Daqui a seis meses/.test(uc(N)));
ok('46. a sugestao so aparece pra gestor (valor ganho e campo de gestor)',
  /comTotal\.length && ehGestor\(\)/.test(N));

// ══════════ 6. EXPORTAVEL, NO PADRAO DOS DOCUMENTOS ══════════
ok('47. *** o mapa e imprimivel e exportavel ***',
  /function imprimirMapa\(id\)/.test(N) && /function excelMapa\(\)/.test(N));
ok('48. *** e os dois carregam o aviso de que foi lido por IA ***',
  /Este mapa foi lido por IA a partir do documento acima/.test(N)
  && /Lido por IA a partir de ' \+ RELATORIO_ATA\.anexo\.arquivo_nome/.test(N));
ok('49. ...e explicam o sinal da diferenca (positivo = nosso preco acima do vencedor)',
  (N.match(/nosso preço acima do vencedor|Positivo = nosso preço acima do vencedor/g) || []).length >= 1);
ok('50. o Excel leva os concorrentes junto', /'Concorrentes': \(l\.concorrentes\|\|\[\]\)/.test(N));
ok('51. "perdidos por 5% ou menos" aparece (e o que muda a estrategia da proxima)',
  /perdidos por 5% ou menos/.test(N));

// ══════════ 7. O CONTADOR QUE FALHAVA CALADO ══════════
ok('52. *** o check da coluna aceita as CINCO tarefas ***',
  /check \(tarefa in \('resumo','itens','juntar','itens-ganhos','mapa-precos'\)\)/.test(D5));
ok('53. *** e o DDL registra o defeito que o motivou ***',
  /custo consumido e NAO cobrado/.test(D5));
ok('54. ...com a prova de como foi descoberto',
  /nao tinha nenhuma\s*linha 'juntar', mesmo depois de duas provas que rodaram a juncao/.test(uc(D5)));
ok('55. *** a funcao NAO engole mais o erro do contador ***',
  /regErro = "o contador respondeu "/.test(F) && !/\} catch \{ \/\* o registro falhar/.test(F));
ok('56. *** e devolve `registrado` ***', /const registrado = !regErro;/.test(F));
ok('57. ...que nao e derivavel do leituraId sozinho, e o codigo diz por que',
  /Ela não é derivável do\s*`leituraId` sozinho/.test(uc(F)));
ok('58. *** a tela do leitor DIZ quando a leitura nao entrou no contador ***',
  /esta leitura NÃO entrou no contador/.test(TELA));
ok('59. ...e a ficha tambem', /NÃO entrou no contador/.test(N));
ok('60. ...com o motivo (essa diferenca aparece na fatura)',
  /porque essa diferença aparece na fatura/.test(uc(TELA)));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
