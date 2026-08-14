// SUITE testa_ficha_controle — O CAMPO DO NUMERO DE CONTROLE NA FICHA (fatia B13, 14/08/2026).
//
// == O QUE ESTA FATIA E =========================================================
// O A publicou a edge `valida-controle` (contrato, secao 7) e documentou os CINCO
// vereditos. O campo na ficha do negocio e do B. Esta suite protege a fronteira:
// a tela PERGUNTA, o servidor DECIDE.
//
// == O QUE ELA PROTEGE ==========================================================
//  1. QUE A TELA NAO VIRE A TERCEIRA COPIA DA CONFERENCIA. A regra ja vive em node
//     (o operador) e em Deno (a edge), com uma suite comparando as duas. Uma
//     terceira no navegador seria a que discorda no dia em que alguem amarrar um
//     resultado no edital errado — e resultado errado nao aparece como defeito,
//     aparece como um preco plausivel na tela onde se decide preco.
//  2. QUE "NAO CONSEGUI PERGUNTAR" NUNCA VIRE "NAO EXISTE". `nao_sei` sai em ambar,
//     sem botao e sem acusar o numero de ninguem — e nada e apagado.
//  3. QUE CONFERIR NAO GRAVE, e que gravar com divergencia exija o "sim" explicito.
//  4. QUE A MENSAGEM SEJA A DO SERVIDOR, palavra por palavra.
//
// == POR QUE ELA EXECUTA A FUNCAO EM VEZ DE PROCURAR TEXTO ======================
// A fatia B2 pagou por isso: `corpoDrawer` estourava na PRIMEIRA linha e nenhuma
// suite via, porque todas conferiam o codigo-fonte por expressao regular — texto
// que existe no arquivo passa no teste mesmo quando a funcao nunca roda. Entao
// `decideAcaoControle` nasceu PURA (sem DOM, sem rede) e esta suite a arranca do
// HTML e a EXECUTA, com os cinco vereditos do contrato.
//
//   node tests/testa_ficha_controle.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const HTML = R('fpmed_negocios.html');
const CONTRATO = R('docs', 'contrato_itens_editais.md');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_ficha_controle — o numero do PNCP informado na ficha (fatia B13)\n');

// ══════════ 1. A FUNCAO PURA, ARRANCADA DO HTML E EXECUTADA ══════════
const fonte = (HTML.match(/function decideAcaoControle\(r\)\{[\s\S]*?\n\}/) || [])[0];
ok(n + '. *** `decideAcaoControle` existe e e uma funcao pura (da pra executar fora do navegador) ***',
  !!fonte && !/document|fetch|window|localStorage/.test(fonte)); n++;
if (!fonte) { console.log('\nRESULTADO: ' + p + ' ok, ' + (f + 1) + ' falha(s) — sem a funcao nao da pra seguir'); process.exit(1); }
const decide = new Function('return (' + fonte + ')')();

// ── os CINCO vereditos do contrato, seção 7 ──────────────────────────────────────────────────
const conf = decide({ veredito: 'confere', podeGravar: true, divergencias: [] });
ok(n + '. *** confere -> verde e OFERECE gravar ***',
  conf.tom === 'ok' && !!conf.botao && conf.confirmar === false, conf); n++;

/* ══ O ASSERT QUE MAIS IMPORTA DESTA FATIA ═══════════════════════════════════════════════════
   A API de consulta do PNCP ja caiu uma vez neste projeto (esta escrito no contrato do A). Se a
   tela tratar "nao consegui perguntar" como "seu numero esta errado", a pessoa apaga um numero
   CERTO — e nao tem como saber que apagou. */
const sei = decide({ veredito: 'nao_sei', podeGravar: false, divergencias: [] });
ok(n + '. *** nao_sei -> AMBAR, sem botao de gravar (nunca vermelho, nunca "nao existe") ***',
  sei.tom === 'aviso' && sei.botao === null, sei); n++;
ok(n + '. ...e o rotulo dele fala de MIM, nao do numero ("nao deu para conferir agora")',
  /nao deu para conferir|não deu para conferir/i.test(sei.rot) && !/errado|inv[áa]lid|existe/i.test(sei.rot), sei.rot); n++;

const nex = decide({ veredito: 'nao_existe', podeGravar: false, divergencias: [] });
ok(n + '. *** nao_existe -> vermelho e SEM botao ***', nex.tom === 'erro' && nex.botao === null, nex); n++;
const fmt = decide({ veredito: 'formato', podeGravar: false, divergencias: [] });
ok(n + '. *** formato -> vermelho e SEM botao ***', fmt.tom === 'erro' && fmt.botao === null, fmt); n++;

/* O contrato e explicito: se `podeGravar`, mostre os dois nomes e um botao que reenvia com
   `confirmado: true`; se NAO, *nao ofereca o botao*. Sao dois caminhos do MESMO veredito. */
const divS = decide({ veredito: 'diverge', podeGravar: true, divergencias: [{ campo: 'órgão', bloqueia: false }] });
ok(n + '. *** diverge + podeGravar -> ambar, botao "assim mesmo" e EXIGE confirmacao ***',
  divS.tom === 'aviso' && !!divS.botao && divS.confirmar === true, divS); n++;
const divN = decide({ veredito: 'diverge', podeGravar: false, divergencias: [{ campo: 'ano', bloqueia: true }] });
ok(n + '. *** diverge + podeGravar FALSE -> NENHUM botao (nem com confirmacao) ***',
  divN.botao === null && divN.confirmar === false, divN); n++;

// Veredito que a tela nao conhece nao pode virar permissao. Botao para estado desconhecido e a
// tela apostando que entendeu — e apostando com a chave de um negocio.
const novo = decide({ veredito: 'algo_que_o_servidor_inventou_depois', podeGravar: true, divergencias: [] });
ok(n + '. *** veredito desconhecido NAO ganha botao de gravar (nem com podeGravar:true) ***',
  novo.botao === null, novo); n++;
ok(n + '. *** sem resposta nenhuma nao ha botao ***',
  decide(null).botao === null && decide({}).botao === null); n++;

// ══════════ 2. A TELA NAO REIMPLEMENTA A CONFERENCIA ══════════
/* O trecho da fatia, isolado: do primeiro estado dela ate o comeco do bloco da conversa. Conferir
   o arquivo inteiro daria falso positivo (a tela tem CNPJ, PNCP e `negocios` em outros assuntos).
   >>> O RECORTE ERROU NA PRIMEIRA ESCRITA, E O ERRO ENSINA: eu ancorei no titulo do bloco, e o
       MESMO titulo esta no comentario da secao dentro do drawer, 2.600 linhas acima. O recorte
       engoliu meia tela e reprovou por codigo que nao e desta fatia. Ancorar num simbolo que so
       existe uma vez (`let NC_RESP`) e o que torna o recorte verificavel. */
const bloco = (HTML.match(/let NC_RESP = null;[\s\S]*?CONVERSAR COM O EDITAL, DE DENTRO DA FICHA/) || [])[0] || '';
ok(n + '. (controle) o bloco da fatia foi encontrado no arquivo', bloco.length > 3000, bloco.length); n++;
const semCom = bloco.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

ok(n + '. *** a tela nao tem a expressao do formato do numero de controle ***',
  !/\\d\{14\}/.test(semCom) && !/\{14\}/.test(semCom)); n++;
ok(n + '. *** a tela nao compara nome de orgao nem de municipio ***',
  !/nomesBatem|tokens\(|VAZIAS|normalize\(["']NFD/.test(semCom)); n++;
ok(n + '. *** a tela nao fala com o PNCP por conta propria ***',
  !/pncp\.gov\.br/.test(semCom)); n++;
ok(n + '. *** e nao escreve em `negocios` por fora da edge (quem grava a chave e o servidor) ***',
  !/rest\/v1\/negocios/.test(semCom) && !/gravar\(/.test(semCom)); n++;
ok(n + '. *** a unica porta e a edge valida-controle ***',
  /functions\/v1\/valida-controle/.test(semCom)); n++;

// ══════════ 3. CONFERIR NAO GRAVA ══════════
/* Conferir tem que poder ser feito enquanto a pessoa digita, sem medo. */
ok(n + '. *** o corpo do pedido so leva `gravar` quando o clique foi o de gravar ***',
  /if\(gravar\)\{[\s\S]{0,400}?corpo\.gravar = true/.test(semCom)); n++;
ok(n + '. *** e `confirmado` so vai quando o servidor disse que ha divergencia confirmavel ***',
  /decideAcaoControle\(NC_RESP\)\.confirmar\) corpo\.confirmado = true/.test(semCom)); n++;
/* Entre o "Conferir" e o "Gravar" a pessoa pode mexer no texto. Gravar o texto novo seria gravar
   um numero que ninguem conferiu — pela porta do botao que diz que conferiu. */
ok(n + '. *** gravar reusa o numero que o servidor JA conferiu, e nao o que esta na caixa agora ***',
  /gravar \? String\(\(NC_RESP && NC_RESP\.numero_controle\)/.test(semCom)); n++;
ok(n + '. *** e o botao de gravar nao volta depois de ter gravado ***',
  /a\.botao && r\.gravou !== true/.test(semCom)); n++;

// ══════════ 4. O CORPO MANDA, E NAO O HTTP ══════════
/* A edge devolve 409 COM o veredito dentro quando recusa gravar. Ler so o status transformaria
   "existe mas o nome nao bate" num erro sem nome — e um erro sem nome nao ensina o que fazer. */
ok(n + '. *** a resposta e lida pelo veredito, e nao pelo status HTTP ***',
  /if\(j && j\.veredito\)/.test(semCom) && !/r\.status === 409/.test(semCom)); n++;
/* Falha de conversa (timeout, 500, proxy) NAO e um veredito sobre o numero. */
ok(n + '. *** falha de rede vira "nao consegui perguntar", com NC_RESP zerado ***',
  /catch\(e\)\{[\s\S]{0,320}?NC_RESP = null;[\s\S]{0,200}?NC_FALHA =/.test(semCom)); n++;
ok(n + '. ...e a frase da falha diz que ela NAO diz nada sobre o numero',
  /Isso não diz nada sobre o número/.test(bloco)); n++;
ok(n + '. ...e que nada foi alterado no negocio',
  /Nada foi alterado neste negócio/.test(bloco)); n++;

// ══════════ 5. A MENSAGEM E A DO SERVIDOR ══════════
ok(n + '. *** a mensagem exibida e `r.mensagem`, escapada, e nao uma frase montada aqui ***',
  /esc\(r\.mensagem \|\| ''\)/.test(semCom)); n++;
/* Divergencia mostra OS DOIS NOMES lado a lado: quem sabe qual e o certo e a pessoa. */
ok(n + '. *** a divergencia mostra o que o PNCP diz E o que o negocio diz ***',
  /o PNCP diz/.test(bloco) && /este negócio diz/.test(bloco)); n++;

// ══════════ 6. O QUE MUDA DEPOIS DE GRAVAR, DITO NA HORA ══════════
ok(n + '. *** depois de gravar a tela RELE os itens e conta o que voltou ***',
  /await carregarItensEdital\(id\);[\s\S]{0,200}?const q = ITENS_EDITAL\.length/.test(semCom)); n++;
ok(n + '. *** "agora este negocio enxerga N itens" e dito com o numero medido ***',
  /Agora este negócio enxerga ' \+ q \+/.test(bloco)); n++;
/* ZERO ITENS TAMBEM E UMA RESPOSTA, e precisa explicar-se: a chave recem-gravada nao traz item
   nenhum sozinha. Um "0 itens" seco faria a pessoa achar que gravou errado e apagar. */
ok(n + '. *** e zero itens NAO fica sem explicacao (o coletor passa na proxima rodada) ***',
  /ainda não<\/b> foram trazidos do PNCP/.test(bloco) && /próxima rodada/.test(bloco)); n++;

// ══════════ 7. A CAIXA NAO ATRAVESSA DE UM NEGOCIO PARA OUTRO ══════════
/* O veredito conferido no negocio anterior embaixo do campo do proximo traria junto um botao
   "Gravar" — que gravaria no negocio errado. */
ok(n + '. *** abrir outro negocio zera o veredito, a falha e o aviso ***',
  /NC_RESP = null; NC_FALHA = null; NC_AVISO = null; NC_DEPOIS = null; NC_TROCANDO = false;/.test(HTML)); n++;
ok(n + '. *** e a caixa e pintada quando a gaveta abre ***',
  /pintaControlePNCP\(id\);/.test(HTML) && /id="nc-cx"/.test(HTML)); n++;
/* A contagem de itens da caixa e a mesma lista da aba Itens — contar por outra leitura seria uma
   segunda contagem do mesmo fato, e duas contagens um dia discordam. */
ok(n + '. *** a contagem sai de ITENS_EDITAL (a mesma lista da aba Itens) ***',
  /const comResultado = ITENS_EDITAL\.filter/.test(semCom)); n++;
ok(n + '. ...e a caixa e repintada quando os itens chegam (a corrida das duas leituras)',
  /if\(cnt\) cnt\.textContent = ITENS_EDITAL\.length[\s\S]{0,700}?pintaControlePNCP\(id\);/.test(HTML)); n++;

// ══════════ 8. QUEM NAO GRAVA NAO DIGITA ══════════
/* Campo editavel para quem levaria 403 do banco ao salvar e um convite a digitar e perder o
   trabalho — a mesma regra que a ficha ja usa desde 08/08. */
ok(n + '. *** so quem grava ve o campo, e o arquivado explica por que nao ve ***',
  /const editavel = ehGestor\(\) && !n\.arquivado/.test(semCom)
  && /Negócio arquivado — desarquive/.test(bloco)); n++;

// ══════════ 9. O CONTRATO DO A ESTA SENDO SEGUIDO ══════════
ok(n + '. (controle) o contrato descreve os cinco vereditos que esta tela trata',
  ['formato', 'nao_existe', 'nao_sei', 'diverge', 'confere'].every(v => CONTRATO.includes(v))); n++;
ok(n + '. (controle) e diz que a tela nao deve reimplementar a conferencia',
  /não reimplemente a conferência na tela/.test(CONTRATO)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
