// SUITE testa_painel_negocios - o painel do molde nas visoes de LISTA (item 7b, fatias 3, 4 e 5).
//
// == O QUE ESTA SUITE GUARDA, E POR QUE ELA E SEPARADA DA testa_moldura_negocios ==========
// A moldura (fatia 1) e os indicadores (fatia 2) sao o TOPO da tela. Isto aqui e a LISTA,
// e ela tem uma promessa que nenhuma das outras duas tem:
//
//   *** A LISTA NAO PODE ESCONDER NEGOCIO EM SILENCIO. ***
//
// O `slice(0,200)` existe nesta tela desde que a visao Lista nasceu, e ate hoje ninguem
// era avisado: com 300 negocios no escopo, cem sumiam sem uma palavra. Quem procurasse um
// deles concluiria que o negocio NAO ESTA NO SISTEMA - que e a conclusao mais cara que esta
// tela pode induzir, e a licao S6 na sua forma mais direta ("nao sei" virando "nao ha").
// Entao metade dos asserts daqui e sobre o RODAPE, e nao sobre a borda do painel.
//
// A outra metade cobra que a moldura seja A MESMA da Encontrar - mesmos nomes de classe e
// mesmos valores. Duas telas do mesmo sistema com dois paineis "parecidos" produzem o
// desalinhamento que o olho percebe e ninguem consegue nomear.
//
//   node tests/testa_painel_negocios.js
'use strict';
const fs = require('fs'), path = require('path');
const raw = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const N = raw('fpmed_negocios.html');
const E = raw('fpmed_licitacoes.html');
const semCom = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const LIMPO = semCom(N);                       // sem comentario: o que a tela FAZ
const CSS1  = N.replace(/\s*\n\s*/g, '');      // regra de CSS numa linha so
const CSSE  = E.replace(/\s*\n\s*/g, '');
const CORPO = LIMPO.replace(/\s+/g, ' ');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_painel_negocios - o painel nas visoes de lista (item 7b, fatias 3, 4 e 5)\n');

// ── 1. A LISTA NAO E MAIS UMA PILHA DE CARTOES SOLTOS ────────────────────────
ok(n + '. a visao Lista passa pelo painel (o `map(card).join` solto acabou)',
  /corpo\.innerHTML = painelLista\(l, base\);/.test(LIMPO)
  && !/corpo\.innerHTML = l\.length \? l\.slice/.test(LIMPO)); n++;
ok(n + '. o painel existe como funcao, e ela recebe o UNIVERSO junto (pro "de M")',
  /function painelLista\(l, base\)\{/.test(LIMPO)); n++;

// ── 2. A MOLDURA E A MESMA DA ENCONTRAR, NAO UMA PARECIDA ────────────────────
/* O assert cobra as TRES pontas de cada classe - a regra existe AQUI, existe LA, e a
   marcacao usa o nome. Sem as tres, uma renomeacao parcial passaria verde: foi exatamente
   o que uma mutacao fez na suite da fatia 1. */
for (const cls of ['painel-res', 'cabecalho', 'rodape-painel']) {
  const usa = cls === 'painel-res'
    ? /class="painel-res"/.test(LIMPO)
    : new RegExp('class="' + cls + '"').test(LIMPO);
  ok(n + '. a classe .' + cls + ' e a MESMA das duas telas (vocabulario unico)',
    new RegExp('\\.painel-res(\\{| \\.' + cls + '\\{)').test(CSS1)
    && new RegExp('\\.painel-res(\\{| \\.' + cls + '\\{)').test(CSSE)
    && usa,
    { aqui: new RegExp('\\.painel-res(\\{| \\.' + cls + '\\{)').test(CSS1),
      la: new RegExp('\\.painel-res(\\{| \\.' + cls + '\\{)').test(CSSE), usada: usa }); n++;
}
/* Nao basta o NOME bater: o valor tem que bater. Duas alturas de cabecalho "quase iguais"
   sao o que produz o desalinhamento que so aparece com os dois prints lado a lado. */
const parDeValores = [
  ['cabecalho', 'min-height:42px'],
  ['cabecalho', 'background:var\\(--superficie-sutil\\)'],
  ['cabecalho', 'border-bottom:1px solid var\\(--borda-divisor\\)'],
  ['rodape-painel', 'min-height:44px'],
  ['rodape-painel', 'border-top:1px solid var\\(--borda-divisor\\)'],
];
for (const [cls, val] of parDeValores) {
  const re = new RegExp('\\.painel-res \\.' + cls + '\\{[^}]*' + val);
  ok(n + '. .' + cls + ' tem o MESMO ' + val.replace(/\\/g, '') + ' das duas telas',
    re.test(CSS1) && re.test(CSSE), { aqui: re.test(CSS1), la: re.test(CSSE) }); n++;
}
ok(n + '. o painel tem UMA fronteira desenhada (borda + raio + sombra), e ela e a de la',
  /\.painel-res\{[^}]*border:1px solid var\(--cinza-200\)/.test(CSS1)
  && /\.painel-res\{[^}]*border-radius:var\(--raio-cartao\)/.test(CSS1)
  && /\.painel-res\{[^}]*box-shadow:var\(--sombra-1\)/.test(CSS1)); n++;

// ── 3. O CARTAO VIROU LINHA - MAS SO DENTRO DO PAINEL ────────────────────────
/* *** ESTE E O ASSERT DO "SEM APAGAO" NESTA FATIA. *** O `.card` e a mesma peca em tres
   lugares: linha da lista, cartao arrastavel do kanban e cartao ao lado da hora na agenda.
   Mexer na REGRA BASE pra achatar a lista apagaria o quadro inteiro - que e a visao de
   ABERTURA desta tela. A linha e o `.card` DENTRO do painel, e so ele. */
/* Os tres valores so existem na regra BASE: a regra do painel zera os tres, entao um casamento
   aqui e prova de que ela continua de pe. */
ok(n + '. *** o `.card` base continua CARTAO (borda, raio e sombra proprios) ***',
  /\.card\{[^}]*border:1px solid var\(--linha\)/.test(CSS1)
  && /\.card\{[^}]*border-radius:13px/.test(CSS1)
  && /\.card\{[^}]*box-shadow:var\(--sombra\)/.test(CSS1)); n++;
ok(n + '. ...e quem vira linha e ele DENTRO do painel (regra descendente, nao a base)',
  /\.painel-res \.card\{[^}]*border:0/.test(CSS1)
  && /\.painel-res \.card\{[^}]*border-bottom:1px solid var\(--borda-divisor\)/.test(CSS1)
  && /\.painel-res \.card\{[^}]*border-radius:0/.test(CSS1)); n++;
/* *** ESTE ASSERT NASCEU DE UM DEFEITO QUE SO A MEDICAO ACHOU. ***
   A regra era `.painel-res .card:last-child` - e o ULTIMO FILHO do painel e o RODAPE, nao a
   ultima linha. Ela nunca casava: o fio da ultima linha somava com a borda de cima do rodape e
   dava 1,6px onde o sistema desenha 0,8. O conserto e ESTRUTURAL (um pai que so tem linhas), e
   nao posicional (`:nth-last-child(2)` devolveria o pixel e deixaria a armadilha de pe).
   >>> O MESMO PADRAO EXISTE NA ENCONTRAR (`.lic:last-child`), e esta anotado no relatorio:
       arquivo do outro trabalhador, nao mexo nele. */
ok(n + '. *** a ultima linha nao desenha o fio, e o `:last-child` tem um pai SO de linhas ***',
  /\.painel-res \.linhas \.card:last-child\{[^}]*border-bottom:0/.test(CSS1)
  && /'<div class="linhas">' \+ most\.map\(n => card\(n\)\)\.join\(''\) \+ '<\/div>'/.test(LIMPO)
  && !/\.painel-res \.card:last-child\{/.test(CSS1)); n++;
/* Linha que sobe dentro de um painel arrasta a de baixo junto e a lista inteira treme. Foi a
   correcao do passo 6 da Encontrar e a da fatia 2 destes indicadores; a terceira vez que a
   mesma decisao aparece e a hora de ela virar assert. */
ok(n + '. *** o hover da LINHA nao levanta: ele so troca o fundo ***',
  /\.painel-res \.card:hover\{[^}]*background:var\(--linha-hover\)/.test(CSS1)
  && /\.painel-res \.card:hover\{[^}]*transform:none/.test(CSS1)
  && /\.painel-res \.card:hover\{[^}]*box-shadow:none/.test(CSS1)); n++;
ok(n + '. e o cartao do KANBAN continua levantando (la ele e peca solta mesmo)',
  /(^|\})\.card:hover\{[^}]*transform:translateY\(-1px\)/.test(CSS1)); n++;

// ── 4. O CABECALHO NAO PODE MENTIR ───────────────────────────────────────────
ok(n + '. ele diz N DE M - "12" sozinho nao diz se o filtro cortou 3 ou 300',
  /<b>' \+ nfmt\(l\.length\) \+ '<\/b> de <b>' \+ nfmt\(total\) \+ '<\/b>/.test(LIMPO)); n++;
/* O universo troca de NOME com o escopo. Com "ver arquivados" ligado ele e o HISTORICO;
   chamar aquilo de "funil" contaria arquivado como negocio vivo, na propria moldura. */
ok(n + '. *** e o M troca de nome com o escopo (historico != funil) ***',
  /arq \? 'no histórico' : 'no funil'/.test(LIMPO)); n++;
ok(n + '. ...e o "arq" lido aqui e o MESMO checkbox que monta o universo',
  /function painelLista[\s\S]{0,400}?getElementById\('f-arquivados'\)\.checked/.test(LIMPO)); n++;
/* "0 abrem hoje" e ruido em todo dia sem sessao, e ruido diario e como se ensina alguem a
   nao ler o cabecalho. Mesma regra do painel da Encontrar. */
ok(n + '. "abrem hoje" so aparece QUANDO EXISTE (nada de "0 abrem hoje")',
  /hj \? ' · <b>' \+ hj \+ '<\/b> ' \+ \(hj === 1 \? 'abre hoje' : 'abrem hoje'\) : ''/.test(LIMPO)); n++;
ok(n + '. e "abre hoje" e contado pelo DIA LOCAL, do mesmo jeito que o resto da tela',
  /const hoje\s+= hojeYMD\(\);/.test(LIMPO)
  && /diaDe\(n\.abertura\) === hoje/.test(LIMPO)); n++;

// ── 5. *** O RODAPE, E O CORTE QUE ERA SILENCIOSO *** ────────────────────────
/* Esta e a razao de a fatia existir. O teto continua existindo - o que mudou e que ele
   passou a ser DITO. Um teto declarado e uma decisao; um teto calado e um negocio perdido. */
/* O numero saiu do meio do codigo e virou constante COM NOME: um teto anonimo enfiado num
   `slice` e o tipo de coisa que ninguem enxerga ao reler a funcao - foi assim que ele passou
   despercebido todo esse tempo. (A AGENDA ainda tem os dois cortes calados dela, 300 e 200:
   e o mesmo defeito, e ele e o assunto da proxima fatia.) */
const _PL = (LIMPO.match(/function painelLista\(l, base\)\{[\s\S]*?\n\}/) || [''])[0];
ok(n + '. o teto tem nome e um valor so (nada de 200 anonimo dentro do painel)',
  /const TETO_LISTA = 200;/.test(LIMPO)
  && /l\.slice\(0, TETO_LISTA\)/.test(_PL)
  && !/\b200\b/.test(_PL), { achouCorpo: !!_PL }); n++;
ok(n + '. *** e o rodape CONTA quantos ficaram de fora, com o numero na frente ***',
  /const fora\s+= l\.length - most\.length;/.test(LIMPO)
  && /nfmt\(fora\) \+ '<\/b> '/.test(LIMPO)
  && /de fora desta tela/.test(CORPO)); n++;
ok(n + '. ...e ele diz O QUE FAZER pra chegar neles (aviso sem saida e beco)',
  /Filtre por fase, empresa ou busca para chegar/.test(CORPO)); n++;
/* Os DOIS casos tem frases diferentes de proposito: "todos estao aqui" e "faltam 87" pedem
   acoes opostas, e uma frase so que servisse pros dois nao diria nem uma coisa nem outra. */
ok(n + '. o caso completo tem frase PROPRIA ("todos de uma vez")',
  /todos de uma vez, esta lista não pagina/.test(CORPO)
  && /fora\s*\?/.test(LIMPO)); n++;
/* Copiar o "Mostrando 1-20 de 2.312" do molde seria prometer uma pagina 2 que nao existe -
   e quem a procurasse concluiria que o sistema perdeu negocio. Mesma decisao da Encontrar. */
ok(n + '. e a lista NAO finge paginar (a promessa de pagina 2 nao entrou)',
  /esta lista não pagina/.test(CORPO)
  && !/Mostrando 1–|Mostrando 1-|página 2|proxima página/.test(CORPO)); n++;

// ── 6. O VAZIO CONTINUA SENDO O VAZIO COM ACAO ───────────────────────────────
/* Painel com cabecalho dizendo "0 de 300" e corpo vazio e uma moldura em volta de nada - e
   pior, ele TIRARIA a tela de saida que o `vazioComAcao` da (qual filtro esta segurando o
   resultado, e o botao de incluir). Sem resultado, quem fala e ele. */
ok(n + '. sem nenhuma linha, quem aparece e o vazio com acao - nao um painel oco',
  /function painelLista\(l, base\)\{\s*if\(!l\.length\) return vazioComAcao\(\);/.test(LIMPO)); n++;

// ── 6b. A AGENDA — a outra visao de LISTA, e a que tinha DOIS cortes calados ──
/* A Lista cortava em 200 sem dizer; a Agenda corta em DOIS lugares (300 no que vem pela frente,
   200 no que ja passou) e tambem nunca disse. O da frente e o mais perigoso dos tres: quem abre
   a Agenda esta procurando A PROXIMA SESSAO, e uma agenda que engole o fim da fila em silencio
   nao parece incompleta - parece vazia daquele dia em diante. */
const _AG = (LIMPO.match(/function agenda\(l\)\{[\s\S]*?\n\}/) || [''])[0];
ok(n + '. *** os dois tetos da Agenda tem nome (nenhum numero solto num slice) ***',
  /const TETO_FUTURO = 300, TETO_PASSADO = 200;/.test(_AG)
  && /lista\.slice\(0, teto\)/.test(_AG)
  && !/slice\(0,\s*300\)/.test(_AG) && !/slice\(0,\s*200\)/.test(_AG), { achouCorpo: !!_AG }); n++;
/* Eles moram DENTRO da funcao de proposito: a `testa_funil_negocios` extrai este bloco do
   arquivo e o roda isolado. Constante la fora vira ReferenceError no teste - e a suite que
   existe pra provar a ORDEM da agenda quebraria por causa de um numero. */
ok(n + '. ...e eles moram DENTRO da funcao, que e de onde a outra suite a extrai',
  /function agenda\(l\)\{[\s\S]{0,1600}?const TETO_FUTURO/.test(LIMPO)); n++;
ok(n + '. a Agenda passa pelo painel, com a marca de que ela e a variante de agenda',
  /'<div class="painel-res agenda">'/.test(LIMPO)
  && /const painelDeSessoes = \(titulo, lista, teto, cresc, quais\)/.test(LIMPO)); n++;
/* SAO DOIS PAINEIS, e nao um com divisoria: os dois blocos correm em ordens OPOSTAS (um cresce,
   o outro decresce) e tem TETOS diferentes. Um rodape so teria de contar dois cortes numa frase
   - e a frase que serve pros dois nao serve pra nenhum. */
ok(n + '. sao DOIS paineis (frente e passado), cada um com o seu teto',
  /painelDeSessoes\([\s\S]{0,400}?futuro, TETO_FUTURO, true, 'mais próximas'\)/.test(LIMPO)
  && /painelDeSessoes\([\s\S]{0,300}?passado, TETO_PASSADO, false, 'mais recentes'\)/.test(LIMPO)); n++;
/* Numa lista ordenada por TEMPO, "as 300 primeiras" nao informa nada: "as 300 mais proximas"
   diz ONDE a tesoura passou. E a mesma exigencia do rodape da Lista, um degrau mais fina. */
ok(n + '. *** e o rodape diz QUAIS ficaram, nao so quantas ("mais proximas"/"mais recentes") ***',
  /'Mostrando as <b>' \+ nfmt\(most\.length\) \+ '<\/b> ' \+ quais/.test(LIMPO)); n++;
/* *** SEGUNDA MUTACAO QUE PASSOU VERDE, E PELO MESMO MOTIVO DA PRIMEIRA. *** Trocar o `(fora` do
   rodape da Agenda por `(false` mata o aviso do corte e a suite nao piscava: o assert de cima
   so provava que a FRASE existe no arquivo, e ela continuava la - num ramo morto. Frase escrita
   nao e frase mostrada. O assert agora cobra que quem escolhe o ramo seja o NUMERO dos que
   ficaram de fora, e cobra isso DENTRO do corpo da agenda. */
ok(n + '. ...e quem escolhe o ramo do rodape e o numero dos que ficaram de fora',
  /const most = lista\.slice\(0, teto\), fora = lista\.length - most\.length;/.test(_AG)
  && /\(fora\s*\n?\s*\?/.test(_AG)); n++;
ok(n + '. o "Ja passaram" virou CABECALHO do 2o painel (nao sobrou rotulo solto na pagina)',
  /'Já passaram · <b>'/.test(LIMPO)
  && !/class="ag-secao"/.test(LIMPO)); n++;
/* Quem desenha o fio e o hover e a LINHA INTEIRA (`.ag-lin`), e nao o cartao de dentro: se o fio
   fosse do cartao ele comecaria depois da hora, e uma lista com o divisor recuado parece uma
   lista com duas colunas desalinhadas. E o cartao fica TRANSPARENTE - branco por cima do fundo
   de hover apagaria justamente o pedaco que o mouse esta tocando. */
ok(n + '. na Agenda quem desenha o fio e o hover e a LINHA, nao o cartao',
  /\.painel-res\.agenda \.ag-lin\{[^}]*border-bottom:1px solid var\(--borda-divisor\)/.test(CSS1)
  && /\.painel-res\.agenda \.ag-lin:hover\{[^}]*background:var\(--linha-hover\)/.test(CSS1)
  && /\.painel-res\.agenda \.ag-lin \.card\{[^}]*background:transparent/.test(CSS1)
  && /\.painel-res\.agenda \.ag-lin \.card\{[^}]*border-bottom:0/.test(CSS1)); n++;
/* *** ESTE ASSERT NASCEU DE UMA MUTACAO QUE PASSOU VERDE. *** Eu tinha guardado o fio da ultima
   linha da LISTA (foi ele que a medicao pegou desenhando 1,6px) e ESQUECI o mesmo fio na Agenda
   - apagar a regra de la nao acendia nada. E o mesmo defeito, no mesmo painel, na visao ao lado:
   guardar so a metade que ja doeu e como a segunda metade volta. */
ok(n + '. *** e a ultima LINHA DA AGENDA tambem nao desenha o fio contra a borda ***',
  /\.painel-res\.agenda \.linhas \.ag-lin:last-child\{[^}]*border-bottom:0/.test(CSS1)); n++;
ok(n + '. e o cabecalho de dia vira degrau na MESMA superficie do cabecalho e do rodape',
  /\.painel-res\.agenda \.ag-dia\{[^}]*background:var\(--superficie-sutil\)/.test(CSS1)
  && /\.painel-res\.agenda \.linhas > \.ag-dia:first-child\{[^}]*border-top:0/.test(CSS1)); n++;
/* `.painel-res` tem `overflow:hidden` (e ele que apara os cantos das linhas contra o raio do
   painel), e sticky dentro de um ancestral que corta nao gruda em lugar nenhum. Prometer no CSS
   o que o navegador nao faz e pior que nao prometer. */
ok(n + '. e ninguem prometeu cabecalho de dia GRUDADO dentro de um painel que corta',
  !/\.painel-res[^{]*\.ag-dia\{[^}]*position:sticky/.test(CSS1)); n++;
/* A Agenda tem UM caso vazio que nao e o da Lista: ha sessao no passado e nenhuma na frente. Ali
   o painel do passado aparece sozinho, e o lugar do futuro fala por escrito - sem ele a tela
   diria "Ja passaram" e mais nada, e quem lesse concluiria que a agenda inteira e historico. */
ok(n + '. sem nada de hoje em diante, o lugar do futuro FALA (nao fica so o historico)',
  /Nada marcado de hoje em diante/.test(CORPO)); n++;

// ── 6c. O KANBAN — o caso a parte, e a decisao de ele NAO virar painel ───────
/* As duas visoes de LISTA viraram painel (fatias 3 e 4). O Quadros nao vira, e o motivo nao e
   "nao deu tempo": a coluna cinza e uma ZONA DE SOLTAR, nao uma moldura. Ela e recuada e os
   cartoes flutuam brancos por cima - e e esse degrau que diz "isto aqui recebe o que voce esta
   arrastando". Coluna branca faria cartao e coluna virarem a MESMA materia, e o alvo do arrasto
   sumiria no instante em que a tela ficasse mais bonita. */
ok(n + '. *** o kanban NAO virou painel: a coluna continua zona de soltar (recuada) ***',
  /\.col\{[^}]*background:var\(--cinza-100\)/.test(CSS1)
  && /function kanban\(l\)\{\s*return '<div class="kb">'/.test(LIMPO)
  && !/kanban[\s\S]{0,200}?painel-res/.test(LIMPO)); n++;
ok(n + '. ...e o cartao dentro dele continua branco (o degrau que sustenta o arrasto)',
  /\.card\{[^}]*background:var\(--painel\)/.test(CSS1)
  && !/\.kb \.card\{[^}]*background/.test(CSS1)); n++;
ok(n + '. e a coluna acesa durante o arrasto continua se distinguindo da apagada',
  /\.col\.alvo\{[^}]*border-color:var\(--azul-500\)/.test(CSS1)
  && /\.col\.alvo\{[^}]*background:var\(--azul-50\)/.test(CSS1)); n++;
/* *** "NAO VIRA PAINEL" NAO E PASSE LIVRE PRA FICAR FORA DO SISTEMA. *** Este bloco era o mais
   fora da regua da tela inteira: gap 14, margem 10, 12,5px, 11,5px, raio 11, padding 26/14 -
   sete linhas com valor que nao existe em token nenhum. E o Quadros e a visao de ABERTURA desta
   tela: e a primeira coisa que se ve.
   >>> O assert varre o bloco e reprova QUALQUER px que nao esteja na lista curta de excecoes
       com motivo. Ele nao cobra "usa var()" - cobra que nao sobrou numero solto, que e o que
       de fato se quebra quando alguem acrescenta uma regra no meio. */
const _KB = (N.split('</style>')[0].match(/\/\* ══ O KANBAN[\s\S]*?\.kb \.card\.arrastando\{[^}]*\}/) || [''])[0]
  .replace(/\/\*[\s\S]*?\*\//g, '');
const PX_OK = { '0': 'zero', '1': 'borda de 1px', '9': 'a bola, que casa com a do chip de fase',
                '300': 'a largura da coluna' };
const pxSoltos = [...new Set((_KB.match(/(\d+(?:\.\d+)?)px/g) || []).map(v => v.replace('px', '')))]
  .filter(v => !(v in PX_OK));
ok(n + '. *** nao sobrou valor fora da grade nem da escala no bloco do kanban ***',
  !!_KB && pxSoltos.length === 0, { achouBloco: !!_KB, soltos: pxSoltos }); n++;
ok(n + '. e nao sobrou nome de fonte chumbado (o --fonte do tema JA e Montserrat)',
  !!_KB && !/font-family:\s*Montserrat/.test(_KB)); n++;
/* *** MUTACAO QUE PASSOU VERDE: zerar o respiro lateral do `.kb`. *** O assert de "nada fora da
   grade" deixa passar, porque `0` E da grade - mas aqui zero nao e um valor neutro: `.kb` tem
   `overflow-x:auto`, e sem folga lateral ele CORTA a sombra e o ANEL DE FOCO do primeiro e do
   ultimo cartao. Foco cortado e foco que nao se ve, e quem navega por teclado perde o lugar. */
ok(n + '. *** o `.kb` guarda folga lateral: `overflow-x` sem ela corta o anel de foco ***',
  (() => { const m = _KB.match(/\.kb\{[^}]*padding:\s*([^;}]+)/);
           if (!m) return false;
           const partes = m[1].trim().split(/\s+/);
           const lateral = partes.length >= 2 ? partes[1] : partes[0];
           return lateral !== '0' && lateral !== '0px'; })(),
  (_KB.match(/\.kb\{[^}]*padding:\s*([^;}]+)/) || [])[1]); n++;
/* A bola da coluna e a MESMA coisa que a bola do chip de fase: mesma cor, mesma funcao, mesmo
   significado. Dois tamanhos pra mesma bolinha na mesma tela e o "quase igual" que o olho sente
   e ninguem nomeia (D3). O assert compara as DUAS, e nao guarda o numero 9. */
ok(n + '. a bola da coluna tem o MESMO tamanho da bola do chip de fase',
  (CSS1.match(/\.chip \.bola\{width:(\d+)px/) || [])[1]
  === (CSS1.match(/\.col h3 \.bola\{width:(\d+)px/) || [])[1],
  { chip: (CSS1.match(/\.chip \.bola\{width:(\d+)px/) || [])[1],
    coluna: (CSS1.match(/\.col h3 \.bola\{width:(\d+)px/) || [])[1] }); n++;
/* Sem `tabular-nums` a contagem dança de largura ao passar de 9 pra 10 - e o que dança durante
   um arrasto parece que MUDOU DE VALOR. Mesma razao do contador do menu lateral. */
ok(n + '. a contagem da coluna nao dança de largura durante o arrasto',
  /\.col h3 \.n\{[^}]*font-variant-numeric:tabular-nums/.test(CSS1)); n++;
/* O kanban NAO tem teto, e isso e o certo: ele mostra tudo, e a contagem do cabecalho da coluna
   e exata. O assert existe pra que ninguem "resolva" um dia a lentidao de 2.555 cartoes
   acrescentando um slice calado - que e exatamente o defeito que as fatias 3 e 4 desenterraram. */
ok(n + '. *** e ninguem enfiou um teto calado no kanban (a contagem da coluna e exata) ***',
  /function kanban\(l\)\{[\s\S]{0,600}?const da = l\.filter\(n => n\.estagio === f\.k\);/.test(LIMPO)
  && !/function kanban\(l\)\{[\s\S]{0,600}?\.slice\(0/.test(LIMPO)); n++;

// ── 6d. A AFORDANCIA NAO PODE MENTIR (cacada de botao morto, 13/08) ─────────
/* Varri as duas telas clicando em TUDO. Nenhum handler morto - mas apareceu o primo silencioso
   do botao morto: o item do sino de CREDENCIAMENTO SEM negocio de origem e `<a class="nf">` sem
   `onclick` e sem `href`, e isso e DECISAO (o credenciamento e da empresa e pode ter nascido
   antes de qualquer negocio; ali nao ha pra onde ir). O errado nao era o comportamento, era a
   PROMESSA: ele herdava `cursor:pointer` e o fundo que acende no hover dos irmaos que navegam.
   >>> Botao morto nao e so o que quebra: e tambem o que PROMETE E NAO CUMPRE. Esse e o tipo que
       ninguem reporta - a pessoa clica, nada acontece, e conclui que o sistema travou.
   >>> A REGRA OLHA O QUE O ELEMENTO TEM, e nao uma classe nova que alguem teria de lembrar de
       por: item novo que nascer inerte ja nasce honesto. */
ok(n + '. *** item de aviso sem clique nao finge ser clicavel (cursor) ***',
  /\.nf:not\(\[onclick\]\):not\(\[href\]\)\{cursor:default\}/.test(CSS1)); n++;
ok(n + '. ...nem acende no hover como os irmaos que navegam',
  /\.nf:not\(\[onclick\]\):not\(\[href\]\):hover\{[^}]*background:transparent/.test(CSS1)); n++;
/* E o par: os que NAVEGAM continuam com a promessa acesa. Sem este, "consertar" a mentira
   apagando o ponteiro de TODOS passaria verde - e ai nenhum aviso pareceria clicavel. */
ok(n + '. e os que navegam continuam prometendo o clique (cursor + hover)',
  /\.nf\{[^}]*cursor:pointer/.test(CSS1)
  && /\.nf:hover\{[^}]*background:var\(--azul-50\)/.test(CSS1)); n++;
/* O item inerte tem de DIZER por que nao leva a lugar nenhum - senao ele so fica quieto, e
   quieto e indistinguivel de quebrado. */
ok(n + '. e ele diz por que nao navega ("sem negocio de origem")',
  /sem negócio de origem/.test(LIMPO)); n++;

// ── 6e. *** COR SÓ DO TOKEN — a prova que o dono pediu em TODA fatia *** ────
/* ORDEM DO DONO (13/08): "seguir o molde nas cores ATE O PONTO DA LINHA. Toda cor sai do token,
   valor EXATO: fundo, texto, borda, divisoria, sombra, hover, selo, barra lateral, icone. Nada
   de cor aproximada no olho, nada inventada, nada de style= inline com hex escrito a mao.
   Isso inclui as MIUDAS, que e onde o olho do dono pega."
   >>> ESTE ASSERT NASCEU DE UMA FALHA MINHA. Eu reportei esta tela como molde-ficada ao fechar
       o item 7b; ela estava molde-ficada NAS PARTES QUE AS FATIAS TOCARAM. A varredura no
       arquivo INTEIRO, que a ordem me obrigou a fazer, achou 14 cores chumbadas no CSS e 23 em
       `style=` inline. O que faltava nao era zelo: era o instrumento.
   >>> `rgba(var(--token), .55)` NAO conta como chumbada: a TINTA vem do token e so o alfa e
       local - e alfa nao e cor. E o unico jeito de compor transparencia a partir de um hex
       guardado em `var()`. */
const COR_CHUMBADA = /#[0-9a-fA-F]{3,8}\b|\brgba?\((?!\s*var\()[^)]+\)/g;
const _cssTela = (N.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1].replace(/\/\*[\s\S]*?\*\//g, '');
const chumbadasCss = [...new Set(_cssTela.match(COR_CHUMBADA) || [])];
ok(n + '. *** ZERO cor chumbada no CSS desta tela (ate as miudas) ***',
  chumbadasCss.length === 0, chumbadasCss.slice(0, 6)); n++;
/* O `style=` inline e o `.style.x = '...'` sao o outro lado, e sao onde a cor volta a entrar
   sem ninguem ver: ela nao aparece em varredura de folha de estilo. */
const _semComHtml = N.replace(/<!--[\s\S]*?-->/g, '').split('\n')
  .filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
const chumbadasInline = [];
for (const m of _semComHtml.matchAll(/style\s*=\s*"([^"]*)"/g))
  for (const c of (m[1].match(COR_CHUMBADA) || [])) chumbadasInline.push(c);
for (const m of _semComHtml.matchAll(/\.style\.[A-Za-z]+\s*=\s*'([^']*)'/g))
  for (const c of (m[1].match(COR_CHUMBADA) || [])) chumbadasInline.push(c);
ok(n + '. *** e ZERO em style= inline ou escrito por JS ***',
  chumbadasInline.length === 0, [...new Set(chumbadasInline)].slice(0, 6)); n++;
/* AS MIUDAS COM O TOKEN DO SEU OFICIO, e nunca trocadas entre si — foi essa a parte que o dono
   nomeou. O fio entre linhas de tabela e DIVISOR, nao borda de cartao: sao dois tokens
   diferentes de propósito, e usar um pelo outro e o "quase igual" que o olho sente. */
/* *** ESTE ASSERT NASCEU DE UMA MUTACAO QUE PASSOU VERDE, e ela e justamente a que o dono
   nomeou: "cada uma com o token certo do seu OFICIO, NUNCA TROCADAS ENTRE SI". A primeira
   versao so cobrava que o divisor existisse em ALGUM lugar - entao trocar UMA celula pelo
   token de borda de CARTAO passava batido. E e assim que acontece na vida real: ninguem troca
   as quinze, alguem escreve uma nova e pega o token errado. Agora o assert olha CELULA A
   CELULA. */
{
  const celulas = [...N.matchAll(/<td[^>]*border-bottom:1px solid ([^;">]+)/g)].map(m => m[1].trim());
  const erradas = celulas.filter(c => c !== 'var(--borda-divisor)');
  ok(n + '. *** TODO fio entre linhas de tabela usa o token de DIVISOR (nunca o de cartao) ***',
    celulas.length > 0 && erradas.length === 0,
    { celulas: celulas.length, erradas: [...new Set(erradas)].slice(0, 4) }); n++;
}
ok(n + '. e a familia ROXA da etiqueta de empresa vive no TEMA, nao na tela',
  /--roxo:\s*var\(--roxo-500\)/.test(CSS1)
  && /--roxo-700:/.test(fs.readFileSync(path.join(__dirname, '..', 'fpmed_tema.css'), 'utf8'))); n++;
/* O trio do azul TEM de andar junto com o `--azul-500`: trio que envelhece sozinho e a copia
   de novo, so que mais dificil de ver (o olho nao compara "44,169,224" com "#2ca9e0"). */
{
  const _tema = fs.readFileSync(path.join(__dirname, '..', 'fpmed_tema.css'), 'utf8');
  const hex = (_tema.match(/--azul-500:\s*#([0-9a-fA-F]{6})/) || [])[1];
  const trio = (_tema.match(/--azul-500-rgb:\s*([\d,\s]+);/) || [])[1];
  const doHex = hex ? [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16)).join(',') : null;
  ok(n + '. *** o trio --azul-500-rgb diz o MESMO que o --azul-500 ***',
    !!doHex && !!trio && trio.replace(/\s/g, '') === doHex,
    { doHex, trio: trio && trio.replace(/\s/g, '') }); n++;
}

// ── 6f. FATIA B1 — HIERARQUIA NA FICHA (a dor no 1 do dono) ─────────────────
/* "Ta tudo igual, chato." A ficha era o pior caso: sete abas com o MESMO peso, e a ativa
   separada por um fundo azul a 16% de opacidade - o degrau que o olho quase nao ve. A pessoa
   tinha de LER as sete pra saber onde estava, em vez de ENXERGAR. */
ok(n + '. *** a aba ATIVA e um botao cheio (fundo da acao + texto branco), nao um veu ***',
  /\.dw-abas button\.on\{[^}]*background:var\(--azul-600\)/.test(CSS1)
  && /\.dw-abas button\.on\{[^}]*color:var\(--branco\)/.test(CSS1)
  && !/\.dw-abas button\.on\{[^}]*rgba\(var\(--azul-500-rgb\),\.16\)/.test(CSS1)); n++;
/* Sem borda, "botao inativo" e "texto solto" sao a mesma coisa - e era isso que fazia a
   fileira de sete parecer uma frase. */
ok(n + '. ...e as inativas tem BORDA (senao nao parecem clicaveis antes do hover)',
  /\.dw-abas button\{[^}]*border:1px solid var\(--borda-controle\)/.test(CSS1)
  && /\.dw-abas button:hover\{[^}]*background:var\(--cinza-100\)/.test(CSS1)); n++;
/* O dono pediu reacao visivel em <=100ms. 120ms de transicao ja pinta no primeiro quadro e
   termina antes de o olho procurar a resposta; o que nao pode e nao ter transicao nenhuma
   (troca seca parece falha) nem ter meio segundo (parece travamento). */
/* O CSS1 vem com as quebras COLAPSADAS, entao o comentario que explica a regra entra no meio
   do `[^}]` e estoura qualquer janela curta. Le-se do arquivo SEM comentario. */
const _cssSemCom = N.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '');
ok(n + '. a aba responde ao toque em tempo de olho (transicao curta, nao seca nem lenta)',
  /\.dw-abas button\{[^}]*transition:background-color 120ms/.test(_cssSemCom)); n++;
ok(n + '. o contador da aba so aparece quando HA conteudo',
  /\.dw-abas \.cnt:empty\{display:none\}/.test(CSS1)
  && /\.dw-abas \.cnt\{[^}]*font-variant-numeric:tabular-nums/.test(CSS1)); n++;
/* ROTULO APAGADO, VALOR FORTE. Eram pesos parecidos demais (rotulo 700 x valor normal): o
   rotulo GRITAVA tanto quanto o dado, e numa ficha o dado e a unica coisa que se veio ler. */
ok(n + '. *** o VALOR pesa mais que o rotulo (a abertura e o orgao saltam aos olhos) ***',
  /\.fc-val\{[^}]*font-weight:var\(--peso-semi\)/.test(CSS1)
  && /\.fc-val\{[^}]*color:var\(--cinza-800\)/.test(CSS1)
  && /\.fc-rot\{[^}]*color:var\(--cinza-500\)/.test(CSS1)); n++;
/* O "vazio" continua LEVE: ausencia de dado nao pode ter o peso do dado, senao a ficha parece
   cheia quando esta pela metade. */
ok(n + '. e o campo vazio continua leve (ausencia nao pesa como dado)',
  /\.fc-val i\{[^}]*font-weight:var\(--peso-normal\)/.test(CSS1)); n++;
/* O "Alterar" era FANTASMA (`opacity:0`): quem nao sabia que a ficha e editavel nunca passava
   o mouse pra descobrir. Agora existe apagado e ACENDE - e continua sem ser azul, porque o
   argumento antigo ("ficha cheia de botao azul compete com o conteudo") continua valendo. */
ok(n + '. o "Alterar" deixou de ser fantasma (existe apagado e acende no hover)',
  /\.fc-bt\{[^}]*opacity:\.55/.test(CSS1)
  && !/\.fc-bt\{[^}]*opacity:0[;,]/.test(CSS1)
  && /\.fc:hover \.fc-bt\{opacity:1\}/.test(CSS1)); n++;
/* SUSPENSO vira SELO (par fechado do tema), e a cor sai do CSS pela CLASSE - nao mais por
   atributo de estilo montado no JS. Cor decidida em JavaScript nao aparece em varredura de
   folha de estilo: e assim que hex escrito a mao sobrevive a auditoria. */
ok(n + '. *** o selo de situacao e pintado por CLASSE, nao por estilo montado no JS ***',
  /class="sit-tag \$\{esc\(sit\)\}"/.test(LIMPO)
  && /\.card \.sit-tag\.suspenso[^{]*\{[^}]*background:var\(--ambar-50\)/.test(CSS1)
  && !/sit-tag" style="color:\$\{corSituacao/.test(LIMPO)); n++;
/* "JA PASSOU" estava em --cinza-500, o mesmo tom do texto de apoio: uma sessao PERDIDA tinha o
   peso de um rodape. E a coisa mais cara que este funil mostra. */
ok(n + '. *** "ja passou" e sinal (vermelho de texto), e nao desbotado ***',
  /\.card \.ab\.passou b\{color:var\(--vermelho-700\)/.test(CSS1)); n++;

// ── 7. A MEMORIA DO PORQUE (L6) ──────────────────────────────────────────────
const _corrido = N.replace(/\s+/g, ' ');
ok(n + '. o arquivo registra por que o cartao vira linha SO dentro do painel',
  /continua CARTÃO onde é mesmo uma peça solta/.test(_corrido)); n++;
ok(n + '. e registra que o corte em 200 existia e era MUDO',
  /SEMPRE CORTOU EM 200, E NUNCA DISSE/.test(_corrido)); n++;
ok(n + '. e por que o seletor de ordenacao do molde nao entrou nesta tela',
  /já existe um seletor de ordenação na barra/.test(_corrido)); n++;
ok(n + '. registra por que a Agenda tem DOIS paineis, e nao um com divisoria',
  /respondem perguntas diferentes, correm em ordens OPOSTAS/.test(_corrido)); n++;
ok(n + '. e por que o cabecalho de dia NAO e sticky (o painel corta)',
  /sticky dentro de um ancestral que corta não gruda em lugar nenhum/.test(_corrido)); n++;
ok(n + '. registra por que o kanban NAO vira painel (a coluna e zona de soltar)',
  /A COLUNA CINZA É UMA ZONA DE SOLTAR, NÃO UMA MOLDURA/.test(_corrido)); n++;
ok(n + '. e que "nao vira painel" nao dispensa a grade e a escala',
  /não é passe livre para ficar fora do sistema/.test(_corrido)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
