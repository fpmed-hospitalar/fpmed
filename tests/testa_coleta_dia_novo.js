// SUITE testa_coleta_dia_novo — O COLETOR TEM QUE GASTAR O ORCAMENTO NO DIA MAIS NOVO.
//
// O DEFEITO QUE ESTA SUITE TRAVA, medido em 10/08/2026 com o indice sendo enchido pela 1a vez:
//   a varredura pedia a JANELA INTEIRA de uma vez (dataInicial=ini & dataFinal=fim) e caminhava
//   as paginas ate o orcamento de 100s acabar. Com a janela de 7 dias, os 100s foram gastos em
//   04-06/08 e o dia de HOJE ficou com 25 linhas. Forcando `--dias 1`, entraram 272.
//   >>> O coletor perdia sistematicamente a publicacao MAIS NOVA, que e a unica razao de ele
//       existir: quem abre a tela quer o edital que abre amanha, nao o da semana passada.
//   A mesma marca aparecia por UF: das 7 configuradas, so GO, DF e MG entravam.
//
// E O SEGUNDO DEFEITO, que so apareceu depois: `coleta_status.ultima_ok` so avanca quando a
// rodada TERMINA a janela inteira -- e nenhuma termina. As tres rodadas de 10/08 gravaram 190,
// 213 e 272 linhas e o carimbo seguiu NULL, com a tela dizendo "a ultima coleta falhou" enquanto
// o indice ia de 70 pra 651. Aviso sempre aceso e aviso que ninguem le no dia da falha de
// verdade. Dai o `ultimo_dia_ok`: ate que DIA o indice esta completo -- fato sobre o DADO, e nao
// sobre a execucao.
//
//   node tests/testa_coleta_dia_novo.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const EDGE  = R('supabase', 'functions', 'coletar-licitacoes', 'index.ts');
const LOCAL = R('tools', 'coleta_pncp.js');
const TELA  = R('fpmed_licitacoes.html');
const DDL   = R('ddl', 'coleta_ultimo_dia.sql');
const DDL0  = R('ddl', 'licitacoes.sql');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_coleta_dia_novo — o orcamento gasto no dia de hoje\n');

// ══════════ 1. A VARREDURA E DIA A DIA, DO MAIS NOVO PRO MAIS VELHO ══════════
for (const [nome, src] of [['edge', EDGE], ['local', LOCAL]]) {
  ok(`1.${nome}: *** a consulta pede UM DIA (dataInicial === dataFinal), nao a janela inteira ***`,
    /dataInicial=\$\{yyyymmdd\(dia\)\}&dataFinal=\$\{yyyymmdd\(dia\)\}/.test(src)
    && !/dataInicial=\$\{yyyymmdd\(ini\)\}&dataFinal=\$\{yyyymmdd\(fim\)\}/.test(src));
  ok(`2.${nome}: *** e caminha do FIM pro INICIO (d-- a partir de `+'`fim`'+`) ***`,
    /for \(const d = new Date\(fim\); d >= ini; d\.setDate\(d\.getDate\(\) - 1\)\)/.test(src));
  ok(`3.${nome}: o motivo esta escrito (senao alguem "otimiza" de volta pra uma consulta so)`,
    /DIA A DIA, DO MAIS NOVO PRO MAIS VELHO/.test(src));
  ok(`4.${nome}: e o que se perde quando o orcamento acaba e o dia VELHO, dito por escrito`,
    /dia velho|dia VELHO/.test(src));
}

// ══════════ 2. O CARIMBO DO DIA ══════════
ok('5. *** a edge function grava CADA DIA ao fechar, nao tudo no fim ***',
  /for \(const dia of diasDaJanela\) \{[\s\S]{0,4000}rest\/v1\/licitacoes\?on_conflict/.test(EDGE));
ok('6. ...e o motivo (rodada cortada no meio deixa no banco os dias que ja terminou)',
  /rodada cortada no meio deixa no banco/.test(EDGE));
ok('7. *** dia TRUNCADO (bateu no teto de paginas) NAO conta como completo ***',
  /if \(\(r\.paginas \|\| 1\) > TETO_PAGINAS && pag === 1\) \{ truncou\+\+; diaInteiro = false; \}/.test(EDGE)
  && /if \(\(r\.paginas \|\| 1\) > TETO_PAGINAS && pag === 1\) \{ truncou\+\+; diaInteiro = false; \}/.test(LOCAL));
// o carimbo do dia vem DEPOIS do laco de gravacao no arquivo — carimbar um dia cujo dado nao
// entrou no banco seria dizer "este dia esta fechado" sobre dado que nao existe
ok('8. *** o dia so e carimbado DEPOIS de gravado ***',
  EDGE.indexOf('rest/v1/licitacoes?on_conflict') < EDGE.indexOf('if (fechouAgora && !ultimoDiaCompleto)')
  && /gravadas \+= lote\.length;/.test(EDGE));
ok('9. *** o carimbo do dia SO ANDA PRA FRENTE ***',
  /if \(ultimoDiaCompleto && \(!ultimoDiaOk \|\| ultimoDiaCompleto > ultimoDiaOk\)\) st\.ultimo_dia_ok/.test(EDGE)
  && /if \(ultimoDiaCompleto && \(!ultimoDiaOk \|\| ultimoDiaCompleto > ultimoDiaOk\)\) st\.ultimo_dia_ok/.test(LOCAL));
ok('10. ...e o motivo (rodada que so alcancou dia velho nao pode desconfiar do dia novo)',
  /não pode puxar o carimbo pra trás|nao pode puxar o carimbo pra tras/.test(EDGE + LOCAL));
ok('11. o dia guardado e o MAIS NOVO da rodada (o primeiro que fechar, ja que varre ao contrario)',
  /if \(fechouAgora && !ultimoDiaCompleto\) ultimoDiaCompleto = iso;/.test(EDGE)
  && /if \(fechouAgora && !ultimoDiaCompleto\) ultimoDiaCompleto = iso;/.test(LOCAL));
ok('12. `ultima_ok` NAO mudou de significado (continua sendo "a rodada inteira terminou")',
  /const okDeVerdade = !breaker\.aberto && !erro && !estourouTempo;/.test(EDGE)
  && /if \(okDeVerdade\) st\.ultima_ok/.test(EDGE));
ok('13. a resposta da funcao DIZ ate que dia fechou (senao ninguem confere de fora)',
  /ultimoDiaCompleto,\s*\/\/ até que dia esta rodada fechou/.test(EDGE));

// ══════════ 2B. O RODIZIO DE UF — A RODADA LEMBRA ONDE PAROU ══════════
// MEDIDO em 10/08, sondando o PNCP direto a 1 requisicao por 700ms: as 7 primeiras responderam
// 200 e da 8a em diante vieram 14 x HTTP 429 SEGUIDOS. A cota e DURA, e um dia sao 21 combinacoes
// (7 UFs x 3 modalidades) -- nenhuma rodada de 100s cobre isso. Sem memoria, toda rodada
// recomecava em GO: o banco tinha 689 licitacoes, TODAS de GO/DF/MG, e MT/MS/TO/BA nunca haviam
// sido coletadas uma unica vez. Com o cursor, duas rodadas fecharam a volta e o carimbo encheu.
for (const [nome, src] of [['edge', EDGE], ['local', LOCAL]]) {
  // (a praca principal entra na frente por decisao do Lemuel — o assert dela e o 39c)
  ok(`33.${nome}: *** o dia mais novo pula as UFs que rodada anterior ja varreu ***`,
    /const ufsDaVez = doDiaNovo[\s\S]{0,140}!ufsFeitas\.includes\(u\)\)\)?\s*\n?\s*: UFS;/.test(src));
  ok(`34.${nome}: *** a UF so entra no progresso com as 3 modalidades lidas ***`,
    /if \(doDiaNovo && ufInteira && !ufsFeitas\.includes\(uf\)\) ufsFeitas\.push\(uf\);/.test(src));
  // o texto quebra de linha em lugares diferentes nos dois arquivos — normaliza antes de olhar
  ok(`35.${nome}: ...e o motivo (meia UF marcada como feita e buraco que ninguem volta pra tapar)`,
    /meia UF marcada como feita seria um buraco/.test(src.replace(/\s*\n\s*\/\/\s*/g, ' ')));
  ok(`36.${nome}: *** o dia so fecha quando TODAS as UFs entraram, somando rodadas ***`,
    /UFS\.every\(\(?u\)? => ufsFeitas\.includes\(u\)\) && !truncou && !erro/.test(src));
  ok(`37.${nome}: *** fechada a volta, o progresso ZERA (pra pegar o que publicarem a tarde) ***`,
    /st\.ufs_feitas = voltaFechou \? \[\] : ufsFeitas;/.test(src));
  ok(`38.${nome}: dia novo diferente do guardado zera o progresso (nao mistura dois dias)`,
    /if \(diaEmCurso !== diaMaisNovo\) \{ diaEmCurso = diaMaisNovo; ufsFeitas = \[\]; \}/.test(src));
  ok(`39.${nome}: a cota medida do PNCP esta registrada (senao alguem "conserta" tirando o cursor)`,
    /14 × HTTP 429 seguidos|14 x HTTP 429 seguidos|14 × HTTP 429/.test(src));
}
// ══════════ 2C. O PESO DAS PRACAS — GO EM TODA RODADA (decisao do Lemuel, 10/08) ══════════
// O rodizio puro tratava as 7 UFs como iguais, e elas nao sao: GO e onde a FPMED disputa. Com o
// rodizio sozinho Goias era revisto ~1x por volta (~1,5x/dia). Agora entra SEMPRE, na frente.
for (const [nome, src] of [['edge', EDGE], ['local', LOCAL]]) {
  ok(`39b.${nome}: *** a praca principal e GO, declarada em lista propria ***`,
    /const UFS_SEMPRE = UFS\.filter\(\(?u\)? => u === ['"]GO['"]\);/.test(src));
  ok(`39c.${nome}: *** e ela vem NA FRENTE, antes do que o rodizio ainda deve ***`,
    /UFS_SEMPRE\.concat\(UFS\.filter\(\(?u\)? => !UFS_SEMPRE\.includes\(u\) && !ufsFeitas\.includes\(u\)\)\)/.test(src));
  ok(`39d.${nome}: *** e a volta SO fecha com as 7 (GO passar toda rodada nao fecha volta) ***`,
    /UFS\.every\(\(?u\)? => ufsFeitas\.includes\(u\)\)/.test(src));
  ok(`39e.${nome}: o dia VELHO nao tem privilegio (la nao ha progresso guardado)`,
    /: UFS;/.test(src));
}
ok('39f. a lista da praca e DE CASA, e isso esta dito (senao alguem procura na API do PNCP)',
  /A LISTA É DE CASA, NÃO DA API/.test(EDGE));
ok('40. a resposta da funcao diz quais UFs faltam (da pra conferir de fora, sem abrir o banco)',
  /faltamUFs: UFS\.filter\(\(?u\)? => !ufsFeitas\.includes\(u\)\)/.test(EDGE) && /voltaFechou,/.test(EDGE)
  && /ufsSempre: UFS_SEMPRE,/.test(EDGE));
ok('41. o script local imprime o andamento da volta',
  /UFs varridas/.test(LOCAL) && /volta do dia \$\{diaEmCurso\} FECHADA/.test(LOCAL));
ok('42. *** os dois coletores compartilham o MESMO progresso (indice unico, conta unica) ***',
  /dia_em_curso/.test(EDGE) && /dia_em_curso/.test(LOCAL)
  && /ufs_feitas/.test(EDGE) && /ufs_feitas/.test(LOCAL));

// ══════════ 3. A COLUNA ══════════
ok('14. o DDL e ADITIVO (add column if not exists), sem DELETE/UPDATE/DROP',
  /add column if not exists ultimo_dia_ok date/.test(DDL)
  && /add column if not exists dia_em_curso date/.test(DDL)
  && /add column if not exists ufs_feitas\s+text\[\]/.test(DDL)
  && !/\b(delete|drop|truncate|update)\b/i.test(DDL.replace(/--[^\n]*/g, '')));
ok('15. e do tipo DATE, com o motivo escrito (dia de calendario, nao instante)',
  /`?date`? e não `?timestamptz`?/.test(DDL) || /date` e não `timestamptz/.test(DDL));
ok('16. o schema de origem tambem ganhou a coluna (quem criar o banco do zero tem ela)',
  /ultimo_dia_ok date/.test(DDL0));
ok('17. a coluna esta comentada NO BANCO (quem abrir o schema entende sem vir aqui)',
  /comment on column public\.coleta_status\.ultimo_dia_ok/.test(DDL));

// ══════════ 4. A TELA ══════════
ok('18. a tela LE o carimbo do dia', /select=ultima_ok,ultimo_dia_ok,ultimo_erro/.test(TELA));
ok('19. *** e mostra "completo ate DD/MM" na procedencia ***',
  /completo até \$\{dm\(emDiaAte\)\}/.test(TELA));
ok('20. *** rodada parcial NAO vira mais "a ultima coleta falhou" ***',
  /* REAPONTADO em 13/08 (item 7f): o ⚠️ do rotulo virou <use> do sprite. O que este assert
     guarda e a CONDICAO — o aviso so acende com erro carimbado E sem dia fechado —, e ela nao
     mudou. Cobrar a frase inteira letra por letra fazia o assert quebrar por tipografia. */
  /const alerta = \(carimbo && carimbo\.ultimo_erro && !emDiaAte\) \? ' · a última coleta falhou' : '';/.test(TELA));
ok('21. ...e o motivo (aviso sempre aceso e aviso que ninguem le no dia da falha de verdade)',
  /Aviso que fica sempre aceso é aviso que ninguém lê/.test(TELA));
/* ══ REAPONTADOS NA FATIA A34 (20/08) — A REGRA E A MESMA, O LUGAR ONDE ELA SE DIZ E QUE MUDOU ══
   O 22 cobrava a frase "a coleta nunca rodou com sucesso" e o 23 cobrava a `avisoBrandoPNCP`.
   As duas eram do tempo em que a busca caia pro PNCP ao vivo: a faixa discreta falava de um
   ACIDENTE ("o portal nao respondeu agora") e o painel vazio precisava separar "portal fora" de
   "gaveta vazia". Com a busca lendo so o nosso banco, sobrou UMA causa de vazio — e a pergunta
   virou a idade do dado, que e a `faixaFrescor`.
   >>> O QUE NAO PODE MUDAR, E E O QUE OS DOIS GUARDAM AGORA: a tela nunca pode responder "nao ha
       licitacao" quando a verdade e "eu nunca carreguei nada". As duas frases levam a pessoa a
       decisoes opostas — uma manda procurar outro termo, a outra manda consertar a carga. */
ok('22. *** "nunca carregado" continua separado de "nao ha nada para esta busca" ***',
  /const podeEstarVelho = !emDiaAte && !quando;/.test(TELA)
  && /E o índice ainda não foi carregado nenhuma vez com sucesso/.test(TELA)
  && /não é resposta sobre o Brasil, é resposta sobre uma gaveta vazia/.test(TELA));
ok('23. e a faixa de frescor prefere o DIA/hora do CARIMBO DA CARGA a chutar idade',
  /async function faixaFrescor\(\)/.test(TELA)
  && /if\(!c \|\| !c\.ultima_ok\)\{/.test(TELA)
  && /A carga nunca terminou por inteiro/.test(TELA));

// ══════════ 5. OS DOIS COLETORES CONTINUAM IRMAOS ══════════
// (o testa_coleta_agendada ja compara as constantes; aqui e a ESTRUTURA nova que nao pode
//  entrar num so — foi o que aconteceu com as funcoes de dose e custou uma copia divergente.)
ok('24. *** os dois coletores tem o carimbo do dia ***',
  /ultimo_dia_ok/.test(EDGE) && /ultimo_dia_ok/.test(LOCAL));
// (o `: Date[]` so existe no lado TypeScript — a estrutura e que tem que ser a mesma)
ok('25. os dois montam a lista de dias do mesmo jeito',
  /const diasDaJanela(: Date\[\])? = \[\];/.test(EDGE) && /const diasDaJanela(: Date\[\])? = \[\];/.test(LOCAL));
ok('26. o script local IMPRIME ate que dia fechou (quem roda na mao precisa saber)',
  /índice completo até \$\{ultimoDiaCompleto\}/.test(LOCAL));
// O teto de paginas e DIFERENTE de proposito nos dois (o da funcao tem orcamento de segundos),
// mas o da funcao precisava crescer: 12 paginas x 10 = 120 num dia de GO ESTOURA, e dia truncado
// nao pode ser carimbado -- o teto baixo travava o carimbo no mesmo lugar do bug anterior.
ok('27. *** o teto de paginas da funcao subiu pra 30, e o motivo esta escrito ***',
  /const TETO_PAGINAS = 30;/.test(EDGE) && /12 páginas × 10 = 120/.test(EDGE));
ok('28. o do script local continua maior (ele nao tem orcamento de segundos)',
  parseInt((LOCAL.match(/TETO_PAGINAS = (\d+)/) || [])[1], 10)
    > parseInt((EDGE.match(/TETO_PAGINAS = (\d+)/) || [])[1], 10));

// ══════════ 6. O QUE NAO PODE TER MUDADO ══════════
ok('29. *** continua NUNCA APAGANDO ***',
  !/method:\s*"DELETE"/.test(EDGE) && !/method: 'DELETE'/.test(LOCAL) && /NUNCA APAGA/.test(EDGE));
ok('30. a chave natural do upsert e a mesma de antes',
  /on_conflict=portal,cnpj,ano,sequencial/.test(EDGE) && /on_conflict=portal,cnpj,ano,sequencial/.test(LOCAL));
ok('31. a sobreposicao de 2 dias da janela incremental continua de pe',
  /setDate\(ini\.getDate\(\) - 2\)/.test(EDGE) && /setDate\(ini\.getDate\(\) - 2\)/.test(LOCAL));
ok('32. o ritmo anti-429 continua no meio do laco (a pausa e o que EVITA o 429)',
  /await dormir\(ritmo\.pausa\);\s*\/\/ o que EVITA o 429/.test(EDGE)
  && /await dormir\(ritmo\.pausa\);\s*\/\/ o que EVITA o 429/.test(LOCAL));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
