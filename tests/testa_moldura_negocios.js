// SUITE testa_moldura_negocios - a moldura do molde aplicada ao Negocios (item 7b).
//
// == POR QUE ESTA SUITE E QUASE UMA COPIA DA testa_header_encontrar ============
// Porque a moldura E a mesma, e esse e o ponto. Duas telas do mesmo sistema com
// duas molduras "parecidas" produzem o desalinhamento que o olho percebe e ninguem
// consegue nomear. Entao esta suite cobra as MESMAS promessas na outra tela - e
// acrescenta as duas que so existem aqui:
//   · a TRILHA tem que concordar com o MENU (Gestao, e nao Oportunidades): trilha
//     que discorda do menu vira uma segunda taxonomia, e e ela que ensina onde as
//     coisas ficam;
//   · as QUATRO VISOES nao podem perder o comportamento na troca de roupa. Elas
//     sairam de links num header e viraram um alternador segmentado; o `setVis` e o
//     `data-vis` sao os mesmos, e a divida do "mapa por indice" - que ja acendeu o
//     link errado uma vez em 12/08 - nao pode voltar.
//
//   node tests/testa_moldura_negocios.js
'use strict';
const fs = require('fs'), path = require('path');
const N = fs.readFileSync(path.join(__dirname, '..', 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');
const E = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const LIMPO = N.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const CSS1 = N.replace(/\s*\n\s*/g, '');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_moldura_negocios - a moldura do molde (item 7b)\n');

// ── 1. a faixa velha morreu, e o que ela carregava sobreviveu ────────────────
ok(n + '. a topfaixa cinza nao existe mais (nem no CSS, nem no HTML)',
  !/class="topfaixa"/.test(LIMPO) && !/^\.topfaixa\{/m.test(N)); n++;
ok(n + '. *** A PORTA DE SAIDA CONTINUA: a trilha leva ao sistema comercial ***',
  /<nav class="trilha"[\s\S]{0,400}?href="fpmed_sistema_final\.html"/.test(LIMPO)); n++;
ok(n + '. *** e a trilha diz GESTAO, que e o grupo do modulo no menu lateral ***',
  /<nav class="trilha"[\s\S]{0,600}?>Gestão</.test(LIMPO)
  && /<nav class="trilha"[\s\S]{0,800}?aria-current="page">Negócios</.test(LIMPO)); n++;
/* O grupo tem que existir no menu com esse nome. Se alguem renomear o grupo la e esquecer aqui,
   a trilha passa a apontar pra uma gaveta que nao existe — e trilha errada e pior que trilha
   nenhuma, porque ela ENSINA o mapa. */
ok(n + '. ...e esse grupo existe mesmo no menu lateral (a trilha nao inventa taxonomia)',
  /\{ g: 'Gestão' \}/.test(fs.readFileSync(path.join(__dirname, '..', 'limedtec-menu.js'), 'utf8'))); n++;
ok(n + '. o header e sticky - o sino nao pode rolar pra fora numa lista longa',
  /\.topo\{[^}]*position:sticky/.test(CSS1)); n++;
ok(n + '. *** O GANCHO DO PWA sobreviveu, e dentro da regua do conteudo ***',
  /<div class="faixa-int" data-limedtec-instalar>/.test(LIMPO)); n++;

// ── 2. a moldura e A MESMA da Encontrar, e nao uma parecida ──────────────────
/* Este e o assert que da sentido a suite existir: as duas telas usam as MESMAS classes. Se um
   dia alguem criar `.cabecalho-negocios` aqui, as duas comecam a divergir em silencio — e a
   divergencia so aparece quando as duas estao lado a lado num print. */
/* O assert cobra as TRES pontas de cada classe, e nao a mera aparicao do nome: a regra existe
   AQUI, a regra existe LA, e a marcacao usa o nome. Sem as tres, uma renomeacao parcial
   (`.pagina-topo-negocios{...}` deixando `.pagina-topo h1{...}` pra tras) passaria verde — foi
   exatamente o que uma mutacao fez na primeira rodada. */
const _EC = E.replace(/\s*\n\s*/g, '');
for (const cls of ['topo', 'trilha', 'pagina-topo']) {
  ok(n + '. a classe .' + cls + ' e a MESMA das duas telas (vocabulario unico)',
    new RegExp('\\.' + cls + '\\{').test(CSS1)
    && new RegExp('\\.' + cls + '\\{').test(_EC)
    && new RegExp('class="' + cls + '"').test(LIMPO),
    { regraAqui: new RegExp('\\.' + cls + '\\{').test(CSS1),
      regraLa: new RegExp('\\.' + cls + '\\{').test(_EC),
      usada: new RegExp('class="' + cls + '"').test(LIMPO) }); n++;
}
ok(n + '. e a altura do header e a mesma nas duas (52px de min-height)',
  /\.topo \.faixa-int\{[^}]*min-height:52px/.test(CSS1)
  && /\.topo \.faixa-int\{[^}]*min-height:52px/.test(E.replace(/\s*\n\s*/g, ''))); n++;
/* A reserva da etiqueta do gm-auth so vale no desktop: em 390px ela comeria a faixa inteira e a
   trilha (a porta de saida) encolheria pra zero. Foi um defeito MEDIDO na Encontrar, e ele
   viajaria junto com a moldura se eu tivesse copiado sem a media query. */
ok(n + '. a reserva do gm-auth veio com o conserto junto (so acima de 900px)',
  /@media\(min-width:901px\)\{[\s\S]{0,300}?padding-right:calc\(var\(--esp-6\) \+ var\(--reserva-auth/.test(LIMPO)); n++;
ok(n + '. e a largura da reserva e MEDIDA da etiqueta, nao chutada',
  /function reservaAuth\(\)\{[\s\S]{0,400}?getElementById\('gm-auth-bar'\)[\s\S]{0,300}?getBoundingClientRect\(\)\.width/.test(LIMPO)); n++;
/* 22px de padding no `.wrap` contra 24 no header desalinhava a trilha do H1 em 2px. Ninguem
   enxerga 2px isoladamente — e e exatamente por isso que D3 chama o "quase alinhado" de pior que
   o desalinhado: o olho sente sem saber o que. */
ok(n + '. o conteudo e o header usam a MESMA regua lateral (--esp-6 nos dois)',
  /\.wrap\{[^}]*padding:0 var\(--esp-6\)/.test(CSS1)
  && /\.faixa-int\{[^}]*padding:0 var\(--esp-6\)/.test(CSS1)); n++;

// ── 3. as quatro visoes trocaram de roupa, nao de comportamento ──────────────
const VIS = ['quadros', 'lista', 'calendario', 'agenda'];
ok(n + '. as quatro visoes continuam existindo, no cabecalho da pagina',
  VIS.every(v => new RegExp('<a data-vis="' + v + '" onclick="setVis\\(\'' + v + '\'\\)').test(LIMPO)),
  VIS.filter(v => !new RegExp('data-vis="' + v + '"').test(LIMPO))); n++;
ok(n + '. ...e elas moram dentro do .pagina-topo (viraram seletor, nao navegacao do sistema)',
  /<div class="pagina-topo">[\s\S]{0,1200}?<nav aria-label="Visão da lista">/.test(LIMPO)); n++;
/* ══ A DIVIDA DO `data-vis` NAO PODE VOLTAR ═══════════════════════════════════
   O mapa visao->link era por INDICE e vivia em DOIS lugares; ele ja acendeu o link
   errado uma vez, em 12/08, porque so um dos dois foi corrigido. A divida foi paga
   fazendo o link CARREGAR a propria visao. Trocar a roupa das visoes e exatamente
   o tipo de mexida em que alguem reintroduz um indice "porque e mais simples". */
ok(n + '. *** o link carrega a PROPRIA visao (o mapa por indice nao voltou) ***',
  VIS.every(v => new RegExp('data-vis="' + v + '"').test(LIMPO))     // cada link se identifica
  && /a\[data-vis\]/.test(LIMPO)                                     // e quem le, le o atributo
  && !/nav a'?\)\[\s*\d\s*\]/.test(LIMPO)); n++;                     // ninguem le por indice
ok(n + '. o alternador tem o mesmo desenho da densidade da Encontrar (fundo recuado, ativo branco)',
  /\.pagina-topo nav\{[^}]*background:var\(--cinza-100\)/.test(CSS1)
  && /\.pagina-topo nav a\.on\{[^}]*background:var\(--branco\)/.test(CSS1)); n++;

// ── 4. o sino ────────────────────────────────────────────────────────────────
ok(n + '. o sino subiu pro header sticky, e continua sendo o mesmo botao',
  /<div class="topo">[\s\S]{0,1500}?id="sino" onclick="toggleNotif\(event\)"/.test(LIMPO)); n++;
ok(n + '. e ele nao virou emoji: continua o icone do sprite da tela (D11)',
  /id="sino"[\s\S]{0,200}?<use href="#ic-sino"\/>/.test(LIMPO)); n++;
ok(n + '. o sino tem foco visivel (quem navega por teclado precisa saber onde esta)',
  /\.sino:focus-visible\{[^}]*var\(--foco\)/.test(CSS1)); n++;

// ── 4b. OS INDICADORES ganharam a anatomia do molde (fatia 2) ────────────────
/* Eles eram uma FITA de celulas grudadas por um fio — cinco caixas dentro de uma caixa. Viraram
   cinco CARTOES separados, com a mesma anatomia da fila da Encontrar. O assert cobra o par:
   a fita virou grade COM ESPACO entre os cartoes, e cada cartao tem borda propria. */
ok(n + '. os indicadores viraram cartoes separados (a fita de celulas acabou)',
  /\.kpis\{[^}]*gap:var\(--esp-3\)/.test(CSS1)
  && /\.kpi\{[^}]*border:1px solid var\(--cinza-200\)/.test(CSS1)
  && !/\.kpi\{[^}]*border-right:1px solid/.test(CSS1)); n++;
/* A legenda e a novidade que a fita nao tinha espaco pra ter, e e ela que responde a pergunta
   seguinte a "quanto?": de onde veio este numero. Os quatro fixos tem uma; o quinto (total
   ganho) so existe pra gestor. */
ok(n + '. e cada um diz DE ONDE o numero vem (a legenda)',
  (LIMPO.match(/<span class="leg">/g) || []).length >= 1
  && /\.kpi \.leg\{/.test(CSS1)); n++;
ok(n + '. o "no funil agora" e o cartao de destaque navy (o unico que fala do que esta VIVO)',
  /_ind\('funil'[\s\S]{0,200}?' destaque'\)/.test(LIMPO)
  && /\.kpi\.destaque\{[^}]*background:var\(--navy\)/.test(CSS1)); n++;
/* O hover deixou de LEVANTAR: com os cinco virando cartoes separados, um que sobe empurra a
   percepcao da fila inteira. Quem diz "da pra clicar" e a borda e a sombra — a dupla do
   `.fp-cartao--clicavel` do tema. Mesma correcao que a linha do painel da Encontrar levou. */
ok(n + '. o hover do cartao nao levanta mais (ele acende a borda e cresce a sombra)',
  /\.kpi\.bt:hover\{[^}]*box-shadow:var\(--sombra-2\)/.test(CSS1)
  && !/\.kpi\.bt:hover\{[^}]*transform/.test(CSS1)); n++;

// ── 5. a memoria do porque (L6) ──────────────────────────────────────────────
const _corrido = N.replace(/\s+/g, ' ');
ok(n + '. o arquivo registra por que a trilha diz Gestao e nao Oportunidades',
  /grupo em que o módulo vive no menu lateral/.test(_corrido)); n++;
ok(n + '. e por que as visoes deixaram de ser links de header',
  /deixaram de parecer NAVEGAÇÃO/.test(_corrido)); n++;
/* ══ O DEFEITO QUE ESTA SUITE ACHOU NA PRIMEIRA RODADA ═══════════════════════
   O `marcarVisaoNoMenu` procurava `header nav a[data-vis]`. Com o `<header>` fora,
   ele passou a nao encontrar NADA — nenhum link acenderia, EM SILENCIO. A tela nao
   reclama: ela so para de marcar, e a pessoa deixa de saber em que visao esta.
   >>> O ASSERT COBRA A CAUSA, e nao o sintoma: o seletor procura pelo `data-vis`,
       que e a identidade da coisa, e nao pelo lugar onde ela esta montada hoje. */
ok(n + '. *** o link aceso e achado pelo `data-vis`, nao pela posicao na arvore ***',
  /querySelectorAll\('a\[data-vis\]'\)/.test(LIMPO)
  && !/querySelectorAll\('header /.test(LIMPO)); n++;
ok(n + '. e nao sobrou regra de CSS apontando pro <header> que nao existe mais',
  !/(^|[\s,{])header[\s.{]/m.test(N.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').split('</style>')[0]),
  (N.split('</style>')[0].match(/(^|\n)\s*header[\s.][^{]*\{/g) || []).slice(0, 4)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
