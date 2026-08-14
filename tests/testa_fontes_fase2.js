// SUITE testa_fontes_fase2 — as muralhas da fase 2 das fontes (fatia A13, 14/08/2026).
//
// == O QUE ESTA SUITE PROTEGE ==================================================
// A caixa aprovou agregar fontes COM MURALHAS INEGOCIAVEIS: so pagina publica de
// consulta, sem login, sem burlar captcha ou qualquer barreira; ritmo educado;
// identificacao honesta; cada fonte na MESMA tabela com selo de origem; zero
// copia de codigo ou asset de terceiro. E: se o portal bloquear, PULA e anota.
//
// >>> MURALHA NAO SE PROVA COM BOA INTENCAO. Ela se prova cobrando a AUSENCIA das
//     coisas que atravessariam: cookie de sessao, campo de senha, leitura de
//     captcha, User-Agent que finge ser outra pessoa sem dizer quem e. Um coletor
//     que um dia ganhar uma dessas passa a ser outra coisa — e quem escrever a
//     linha talvez nao esteja lendo a caixa.
//
// >>> E ELA GUARDA A MEDICAO QUE EXPLICA A FATIA. Um "nao" sem numero vira, tres
//     semanas depois, "ninguem tentou". Os numeros ficam no codigo e no doc.
//
//   node tests/testa_fontes_fase2.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const C = R('tools', 'coleta_pncp_busca.js');
const P = R('tools', 'prova_fase2_fontes.js');
const D = R('docs', 'plano_fontes.md');
const semJs = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const Cc = semJs(C);

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_fontes_fase2 — as muralhas da fase 2 (fatia A13)\n');

// ══════════ 1. AS MURALHAS, COBRADAS PELA AUSENCIA ══════════
/* Nada de sessao, senha, cookie ou captcha em lugar nenhum do coletor. Se um dia uma dessas
   linhas aparecer, o coletor deixou de ser o que a caixa autorizou. */
ok(n + '. *** o coletor nao faz login, nao manda cookie e nao toca em captcha ***',
  !/\b(login|senha|password|captcha|recaptcha|hcaptcha|cookie|set-cookie|credentials)\b/i.test(Cc)); n++;
/* O `/api/search/` recusa cliente sem User-Agent de navegador — medido em 11/08. O UA daqui tem
   a string de navegador E o nome e o e-mail da FPMED: nao e disfarce, e identificacao. */
ok(n + '. *** o User-Agent diz QUEM esta chamando (nao e disfarce anonimo) ***',
  /FPMED-Hospitalar\/1\.0/.test(Cc) && /licitacao@fpmed\.com\.br/.test(Cc)); n++;
ok(n + '. ...e o motivo de ele parecer navegador esta escrito, com a medicao',
  /RECUSA CLIENTE SEM `User-Agent` DE NAVEGADOR/.test(C) && /ECONNRESET/.test(C)); n++;
/* Ritmo educado: pausa entre chamadas, backoff e circuit breaker — emprestados do coletor do
   indice, e nao reescritos. Duas reguas de "estou indo rapido demais" contra o MESMO portal
   publico um dia discordam. */
ok(n + '. *** ritmo, backoff e breaker vem do coletor do indice, nao de copia ***',
  /require\('\.\/coleta_pncp\.js'\)/.test(Cc)
  && /criaRitmo\(400\)/.test(Cc) && /criaBreaker/.test(Cc) && /esperaRateLimit/.test(Cc)); n++;
ok(n + '. ...e o 429 desacelera a rodada inteira (nao so retenta)',
  /r\.status === 429/.test(Cc) && /ritmo\.freou\(\)/.test(Cc)); n++;

// ══════════ 2. MESMA TABELA, SELO DE ORIGEM, CHAVE CERTA ══════════
ok(n + '. *** despeja na MESMA tabela licitacoes, com selo de origem no `portal` ***',
  /rest\/v1\/licitacoes\?on_conflict=/.test(Cc) && /portal: 'PNCP',/.test(Cc)); n++;
/* O alvo do conflito TEM que ser o indice unico que a tabela tem — (portal, cnpj, ano,
   sequencial). Errar isso nao da linha duplicada: da 23505 e a rodada inteira nao grava nada.
   E a licao da A7, e ela custou uma tarde. */
ok(n + '. *** o alvo do conflito e a chave natural que a tabela realmente tem ***',
  /on_conflict=portal,cnpj,ano,sequencial/.test(Cc)
  && !/on_conflict=numero_controle&/.test(Cc)); n++;
ok(n + '. ...e a linha sem chave natural nao entra (a mesma trava da varredura)',
  /\.filter\(valida\)/.test(Cc)); n++;
/* A licitacao que ja esta no indice veio da varredura COM a janela de proposta. Reescreve-la por
   aqui apagaria o prazo — trocaria dado bom por dado incompleto, em silencio. */
ok(n + '. *** o que ja esta no indice NAO e reescrito (senao o prazo seria apagado) ***',
  /const novos = todos\.filter\(nc => !tenho\.has\(nc\)\)/.test(Cc)); n++;

// ══════════ 3. O QUE ELE NAO SABE, ELE NAO INVENTA ══════════
/* A busca nao traz a janela de proposta e o detalhe da compra esta fora do ar. `null` e "nao
   sei"; uma data inventada seria pior que a ausencia, porque teria a mesma cara de uma certa. */
ok(n + '. *** data_abertura / data_encerramento NAO sao inventadas ***',
  !/data_abertura:/.test(Cc) && !/data_encerramento:/.test(Cc)); n++;
ok(n + '. ...e a ausencia e explicada com a medicao dos dois endpoints',
  /HTTP 301/.test(C) && /TimeoutError em 30\.034 ms/.test(C)
  && /Este endpoint foi movido para/.test(C)); n++;
ok(n + '. ...e a linha nova DIZ de onde veio (bruto._coleta)',
  /_coleta: 'busca'/.test(Cc)); n++;
/* O buraco se fecha sozinho: a varredura normal grava pela MESMA chave e PREENCHE essas linhas. */
ok(n + '. ...e esta escrito que a varredura normal preenche o buraco depois',
  /buraco se fecha sozinho/i.test(C) || /vai PREENCHER a\s*janela/i.test(C.replace(/\n\s*/g, ' '))); n++;

// ══════════ 4. INDICE GRANDE NAO E INDICE BOM ══════════
/* Medido: "albumina" com status=todos da 3.658 e os primeiros sao de 2023-2024 (a busca ordena
   por relevancia, nao por data); com recebendo_proposta da 169, de julho e agosto de 2026. */
ok(n + '. *** so o que esta recebendo proposta entra, por padrao ***',
  /const STATUS = arg\('--status'\) \|\| 'recebendo_proposta';/.test(Cc)); n++;
ok(n + '. ...com a medicao que justifica o corte escrita ao lado',
  /3\.658 editais/.test(C) && /dá 169/.test(C)); n++;
ok(n + '. ...e a rodada AVISA quando alguem pedir o historico inteiro',
  /inclui edital já encerrado/.test(C)); n++;

// ══════════ 5. OS TERMOS SAO OS MESMOS DA TELA ══════════
/* Duas listas do "que e o nosso ramo" acabariam discordando, e a discordancia apareceria como
   "a tela mostra o que a coleta nao trouxe" — que ninguem liga a duas constantes em arquivos
   diferentes. */
const RAMO_TELA = (R('fpmed_licitacoes.html').match(/const CATEGORIAS_RAMO = \[([^\]]+)\]/) || [])[1] || '';
const RAMO_COLETA = (C.match(/const TERMOS_RAMO = \[([^\]]+)\]/) || [])[1] || '';
const soPalavras = s => (s.match(/'[^']+'/g) || []).map(x => x.replace(/'/g, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()).sort().join(',');
ok(n + '. (controle) as duas listas do ramo foram encontradas',
  !!RAMO_TELA && !!RAMO_COLETA); n++;
/* ══ UMA TROCA, E SO UMA, E ELA E DECLARADA ═════════════════════════════════════════════════
   A tela usa `farmac` — um PEDACO de palavra — porque la o filtro e `String.includes()`. Aqui o
   consumidor e um motor de busca TEXTUAL, que casa PALAVRA: `farmac` nao existe em documento
   nenhum e a resposta seria ZERO, silenciosamente, porque zero tambem e resposta valida.
   >>> O ASSERT COBRA A LISTA IGUAL A MENOS DESTE PAR. Aceitar "sao parecidas" deixaria passar a
       PROXIMA diferenca — a que alguem acrescenta sem pensar — que e justamente a que faz a tela
       mostrar o que a coleta nao trouxe. */
const semFarmac = s => soPalavras(s).replace(/farmaceutico/, 'farmac');
ok(n + '. *** o ramo da coleta e o MESMO da tela, a menos da troca declarada farmac->farmaceutico ***',
  semFarmac(RAMO_TELA) === semFarmac(RAMO_COLETA),
  { tela: soPalavras(RAMO_TELA), coleta: soPalavras(RAMO_COLETA) }); n++;
ok(n + '. ...e a troca esta explicada no coletor, com o motivo tecnico',
  /farmac -> farmacêutico/.test(C) && /motor de BUSCA TEXTUAL, que casa PALAVRA/.test(C)); n++;

// ══════════ 6. O REGISTRO DOS "NAO" ══════════
/* Um "nao" sem medicao vira "ninguem tentou". Os numeros ficam no doc E na prova viva. */
ok(n + '. *** o doc registra o 403 do licitacoes-e, inclusive no /robots.txt ***',
  /HTTP 403 em tudo\*\*, inclusive no `\/robots\.txt`/.test(D)); n++;
ok(n + '. *** e registra que a EBSERH ja publica no PNCP (17.981) ***',
  /17\.981 editais dela JÁ ESTÃO NO PNCP/.test(D)); n++;
ok(n + '. ...e que a Petronect saiu por barreira E por escopo (nao e saude)',
  /não é saúde/.test(D) && /SAP/.test(D)); n++;
ok(n + '. a prova viva sonda os portais de verdade, uma vez cada',
  /licitacoes-e\.com\.br\/robots\.txt/.test(P) && /api\/consulta\/v1\/orgaos/.test(P)); n++;
/* A prova nao pode "conseguir" onde a caixa manda parar: onde da 403, o 403 E o resultado. */
ok(n + '. *** e a prova NAO tenta contornar o bloqueio ***',
  !/\b(cookie|captcha|puppeteer|playwright|selenium|proxy)\b/i.test(semJs(P))); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
