// SUITE testa_menu_clique — CLICAR no item do menu abre a visao que ele promete.
//
// == POR QUE ELA EXISTE ========================================================
// URGENCIA DO DONO, 13/08: "clicar em RADAR no menu lateral NAO FAZ NADA — botao
// morto". Era verdade, e estava assim desde que o menu lateral nasceu.
//
// A CAUSA nao estava no menu: estava no CONTRATO ENTRE OS DOIS LADOS. O
// limedtec-menu.js manda Radar/Desertas/Meus Jornais como ANCORA
// (`fpmed_licitacoes.html#radar`) e escreve no proprio arquivo que "quem decide o
// que fazer com ele e a TELA DE DESTINO". A tela de destino nunca fez a metade
// dela — nao havia UM `location.hash` nem UM `hashchange` no arquivo inteiro.
//
// >>> O QUE NENHUMA SUITE DE ENTAO PODIA PEGAR, e por isso esta aqui: as duas
//     metades estavam CERTAS SEPARADAMENTE. O menu montava o href certo (a
//     testa_menu_lateral prova isso ate hoje) e a tela abria o painel certo
//     quando alguem chamava `abrirRadar()` (o laco visual provava isso). O que
//     ninguem media era o PULO ENTRE AS DUAS — e defeito de contrato so aparece
//     em teste que atravessa a fronteira.
//
// >>> E ELA E ESCRITA PRA CRESCER SOZINHA. A lista de ancoras NAO esta escrita
//     aqui: ela e LIDA do `MODULOS` do menu. No dia em que entrar a quarta
//     ancora, esta suite ja cobra a quarta sem ninguem lembrar de vir aqui. E se
//     aparecer uma ancora apontando pra um arquivo que esta suite nao sabe
//     conferir, ela fica VERMELHA em vez de pular em silencio — pular em
//     silencio e exatamente como o Radar passou meses morto.
//     (Mesma licao do item 7e: o assert que contava DUAS consultas ficou cego pra
//      terceira, que era o Radar lendo 31% da base. Assert que enumera casos
//      conhecidos morre; assert que PROCURA os casos cresce.)
//
//   node tests/testa_menu_clique.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const M = R('limedtec-menu.js');
const L = R('fpmed_licitacoes.html');
const N = R('fpmed_negocios.html');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_menu_clique — o item do menu abre o que promete\n');

// ══════════ 1. AS ANCORAS SAEM DO MENU, NAO DE UMA LISTA MINHA ══════════
const ANCORAS = [...M.matchAll(/\{\s*id:\s*'([^']+)',\s*rotulo:\s*'([^']+)',\s*href:\s*'([^']+)',\s*ancora:\s*'([^']+)'\s*\}/g)]
  .map(m => ({ id: m[1], rotulo: m[2], href: m[3], ancora: m[4], arquivo: m[3].split('#')[0] }));

ok(n + '. o MODULOS declara ancoras (se este assert cair, a extracao quebrou — nao o codigo)',
  ANCORAS.length >= 3, { achadas: ANCORAS.length }); n++;
ok(n + '. e o href de cada ancora TERMINA no proprio `#` dela (href e ancora nao podem divergir)',
  ANCORAS.every(a => a.href === a.arquivo + '#' + a.ancora),
  ANCORAS.filter(a => a.href !== a.arquivo + '#' + a.ancora)); n++;

/* ── QUEM SABE CONFERIR CADA TELA DE DESTINO ──────────────────────────────────
   O `desconhecido` NAO e um detalhe: e o assert 3. Uma ancora nova apontando pra
   uma tela que ninguem ensinou esta suite a conferir tem que ficar VERMELHA. */
const CONFERIDORES = {
  'fpmed_licitacoes.html': (a) => ({
    tem_rota: new RegExp("'" + a.ancora + "'\\s*:").test(L.slice(L.indexOf('const ROTAS_HASH = {'), L.indexOf('function aplicaHash()'))),
    onde: 'ROTAS_HASH',
  }),
  'fpmed_negocios.html': (a) => ({
    tem_rota: new RegExp("'" + a.ancora + "'").test(N.slice(N.indexOf('const VISOES ='), N.indexOf('const VISOES =') + 200)),
    onde: 'VISOES',
  }),
};
const semConferidor = ANCORAS.filter(a => !CONFERIDORES[a.arquivo]);
ok(n + '. *** toda tela de destino de ancora tem quem confira ela aqui (ancora nova NAO passa calada) ***',
  semConferidor.length === 0, semConferidor.map(a => a.rotulo + ' -> ' + a.arquivo)); n++;

const semRota = ANCORAS.filter(a => CONFERIDORES[a.arquivo] && !CONFERIDORES[a.arquivo](a).tem_rota);
ok(n + '. *** TODA ancora do menu tem rota na tela de destino ***',
  semRota.length === 0, semRota.map(a => a.rotulo + ' (#' + a.ancora + ') sem rota em ' + a.arquivo)); n++;

// ══════════ 2. OS DOIS CAMINHOS, QUE SAO DOIS EVENTOS DIFERENTES ══════════
/* O defeito morria de dois jeitos, e cobrir so um deixaria metade de pe:
     · JA ESTANDO na tela: so o `#` troca, o navegador nao recarrega -> `hashchange`;
     · VINDO DE FORA: a pagina abre ja com o `#` -> chamada no BOOT.
   O navegador NAO dispara `hashchange` quando a pagina abre com `#` na URL. Sao
   dois eventos, e por isso sao dois asserts. */
ok(n + '. *** a tela reage ao `#` com a pagina JA ABERTA (hashchange) — o caso que o dono viu ***',
  /window\.addEventListener\('hashchange', aplicaHash\)/.test(L)); n++;
ok(n + '. *** e reage ao `#` que veio na CARGA (o boot chama aplicaHash) ***',
  /function _aoAutenticar\(\)\{[^}]*aplicaHash\(\)/.test(L)); n++;
ok(n + '. o Negocios tambem reage com a pagina aberta (o Calendario tinha o MESMO defeito)',
  /addEventListener\('hashchange'/.test(N) && /VISOES\.includes\(daUrl\)\s*&&\s*daUrl\s*!==\s*VIS/.test(N)); n++;
ok(n + '. e o item aceso no menu SEGUE o `#` (menu apontando pro lugar errado e pior que enfeite)',
  /addEventListener\('hashchange', acender\)/.test(M)); n++;
/* REPINTA, NAO REMONTA: remontar apagaria o contador e a revelacao do Leitor, que
   a tela escreve no menu DEPOIS do boot. */
ok(n + '. ...repintando as classes, e nao remontando o menu (remontar apaga contador e Leitor)',
  /function acender\(\)/.test(M) && !/function acender\(\)[\s\S]{0,600}montar\(/.test(M)); n++;

// ══════════ 2b. A ORDEM NO ARQUIVO — O DEFEITO QUE A EXTRAÇÃO NÃO VÊ ══════════
/* ESTE ASSERT NASCEU DE UM DEFEITO MEU QUE FOI AO AR (13/08). O roteador estava
   DEPOIS do `_aoAutenticar()`, que o chama. A funcao sobe por hoisting, o
   `const ROTAS_HASH` NAO sobe — e o site publicado respondia
       ReferenceError: Cannot access 'ROTAS_HASH' before initialization
   abortando o resto do bloco <script>, inclusive o `addEventListener('hashchange')`.
   O conserto do botao morto tinha virado outro jeito de o botao ficar morto.
   >>> A LICAO E SOBRE O INSTRUMENTO: os asserts da secao 3 EXTRAEM o roteador e o
       rodam isolado. Isolado ele esta certo — o errado era a VIZINHANCA. Assert que
       recorta um pedaco e cego pra onde o pedaco mora. Por isso este mede POSICAO. */
(function () {
  const decl = L.indexOf('const ROTAS_HASH = {');
  const usoNoBoot = L.indexOf('function _aoAutenticar()');
  ok(n + '. *** a tabela de rotas e declarada ANTES de quem a chama no boot (zona morta temporal) ***',
    decl > -1 && usoNoBoot > -1 && decl < usoNoBoot, { decl, usoNoBoot }); n++;
  const escuta = L.indexOf("window.addEventListener('hashchange', aplicaHash);");
  ok(n + '. ...e o `hashchange` tambem, senao uma excecao no boot leva a escuta junto',
    escuta > -1 && escuta < usoNoBoot, { escuta, usoNoBoot }); n++;
})();

// ══════════ 3. O CLIQUE, SIMULADO DE VERDADE ══════════
/* Aqui a suite EXECUTA o roteador extraido do .html, em vez de procurar texto
   nele. Assert que le codigo prova que o codigo esta escrito; assert que RODA o
   codigo prova que ele funciona — e foi justamente um "esta escrito" que deixou
   o Radar morto (o painel existia, a funcao existia, o href existia). */
/* DEGRADA EM VERMELHO, NAO EM EXPLOSAO: se o roteador sumir do arquivo, esta funcao
   devolve um resultado VAZIO e os asserts abaixo caem um por um, dizendo qual visao
   morreu. Estourando, a suite morre na primeira linha e esconde as outras nove — e
   uma suite que explode e uma suite que ninguem le ate o fim. */
function clicaNoMenu(hash, jaDesertas) {
  const ini = L.indexOf('const ROTAS_HASH = {');
  const fim = L.indexOf("window.addEventListener('hashchange', aplicaHash);");
  if (ini < 0 || fim < 0 || fim <= ini) return { achou: false, chamou: [], rolou: [], soDesertas: !!jaDesertas, semRoteador: true };
  const corpo = L.slice(ini, fim);
  const chamou = [], rolou = [];
  const win = { _soDesertas: !!jaDesertas };
  const fn = new Function('location', 'window', 'document', 'abrirRadar', 'abrirJornais', 'soDesertas',
    corpo + '\n; return aplicaHash();');
  const achou = fn(
    { hash },
    win,
    { getElementById: (id) => ({ scrollIntoView: () => rolou.push(id) }) },
    () => chamou.push('abrirRadar'),
    () => chamou.push('abrirJornais'),
    () => { chamou.push('soDesertas'); win._soDesertas = !win._soDesertas; });
  return { achou, chamou, rolou, soDesertas: win._soDesertas };
}

/* O "Radar" era o 1o caso desta secao — foi ele que originou a suite. Saiu em 14/08 (fatia A1,
   decisao do dono: desnecessario), e os asserts dele sairam JUNTO, no mesmo commit.
   >>> ASSERT ORFAO NAO E ZELO, E RUIDO: ele fica vermelho pra sempre por uma remocao
       intencional, e suite que mora vermelha para de ser lida. A promessa que o Radar
       exercitava continua exercitada pelos Jornais e pelas Desertas, e o assert final da
       secao 4 cobra CADA ancora que o menu tiver — entao a cobertura nao encolheu com ele. */
const cJor = clicaNoMenu('#jornais');
ok(n + '. *** CLICAR "Meus Jornais" abre os jornais *** (era isto que nao acontecia)',
  cJor.achou === true && cJor.chamou.join() === 'abrirJornais', cJor); n++;
ok(n + '. ...e ROLA ate ele — depois de abrir, porque `display:none` nao tem pra onde rolar',
  cJor.rolou.join() === 'jornais', cJor.rolou); n++;

const cDes = clicaNoMenu('#lk-desertas', false);
ok(n + '. CLICAR "Desertas" LIGA o filtro de desertas',
  cDes.achou === true && cDes.soDesertas === true, cDes); n++;
/* ESTE E O ASSERT QUE ME FEZ NAO USAR `soDesertas()` CRU NA ROTA. O `soDesertas`
   da tela ALTERNA (e certo que alterne: o atalho da propria tela e um liga/desliga).
   Ligado a uma rota de menu, o segundo clique no MESMO item DESLIGARIA o filtro —
   um item de menu que desfaz o que o nome dele promete. */
const cDes2 = clicaNoMenu('#lk-desertas', true);
ok(n + '. *** e clicar "Desertas" DE NOVO nao desliga (item de menu nao desfaz o que promete) ***',
  cDes2.soDesertas === true && cDes2.chamou.length === 0, cDes2); n++;

const cNada = clicaNoMenu('#naoexiste');
ok(n + '. `#` desconhecido nao faz nada e nao estoura (a tela tem outros `#` que nao sao modulo)',
  cNada.achou === false && cNada.chamou.length === 0, cNada); n++;
const cVazio = clicaNoMenu('');
ok(n + '. e sem `#` nenhum a tela abre normal (o boot chama isto em TODA carga)',
  cVazio.achou === false && cVazio.chamou.length === 0, cVazio); n++;

// ══════════ 4. A ROTA COBRE AS ANCORAS, UMA POR UMA ══════════
/* O laco fecha o circulo: cada ancora do MODULOS e CLICADA aqui, e tem que
   produzir alguma acao. Ancora nova que entre no menu sem rota cai neste assert
   mesmo que ninguem lembre de escrever um teste pra ela. */
const mortas = ANCORAS
  .filter(a => a.arquivo === 'fpmed_licitacoes.html')
  .filter(a => { try { return clicaNoMenu('#' + a.ancora).chamou.length === 0; } catch (_) { return true; } });
ok(n + '. *** nenhuma ancora do Encontrar e botao morto (clicada uma a uma) ***',
  mortas.length === 0, mortas.map(a => a.rotulo)); n++;

// ══════════ 5. O PAINEL SO APARECE COM `.open` ══════════
/* A ancora nativa do navegador nunca salvou este caso e a razao esta no CSS:
   `#radar` e `#jornais` sao `display:none` ate ganharem `.open`. Se um dia alguem
   "simplificar" isso pra display:block, o painel passa a nascer aberto na tela —
   e o defeito vira o oposto, igualmente errado. */
ok(n + '. o painel dos Jornais nasce fechado e so abre com `.open` (por isso a ancora nativa nao bastava)',
  /#jornais\{display:none/.test(L) && /#jornais\.open\{display:block\}/.test(L)); n++;
ok(n + '. idem o painel de Orgaos',
  /#orgaos\{display:none/.test(L) && /#orgaos\.open\{display:block\}/.test(L)); n++;

// ══════════ 6. O MOTIVO FICA ESCRITO ══════════
// Conserto sem o porque escrito volta na proxima refatoracao.
ok(n + '. o contrato do `#` esta explicado no codigo, com os DOIS jeitos de morrer',
  /OUTRA METADE DO CONTRATO COM O MENU/.test(L) && /JÁ ESTANDO no Encontrar/.test(L)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
