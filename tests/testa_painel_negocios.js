// SUITE testa_painel_negocios - o painel do molde em volta da visao LISTA (item 7b, fatia 3).
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
console.log('SUITE testa_painel_negocios - o painel da lista (item 7b, fatia 3)\n');

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

// ── 7. A MEMORIA DO PORQUE (L6) ──────────────────────────────────────────────
const _corrido = N.replace(/\s+/g, ' ');
ok(n + '. o arquivo registra por que o cartao vira linha SO dentro do painel',
  /continua CARTÃO onde é mesmo uma peça solta/.test(_corrido)); n++;
ok(n + '. e registra que o corte em 200 existia e era MUDO',
  /SEMPRE CORTOU EM 200, E NUNCA DISSE/.test(_corrido)); n++;
ok(n + '. e por que o seletor de ordenacao do molde nao entrou nesta tela',
  /já existe um seletor de ordenação na barra/.test(_corrido)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
