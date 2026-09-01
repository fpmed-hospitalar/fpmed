// SUITE testa_tema - o design system, conferido em vez de alegado.
//
// == POR QUE UM CSS PRECISA DE SUITE ============================================
// Porque o valor do fpmed_tema.css nao esta no que ele PINTA - esta no que ele
// IMPEDE. Ele so cumpre a lei P6 ("quem abre qualquer tela deve sentir que UMA
// pessoa excelente fez tudo") enquanto ninguem escrever cor na mao ao lado dele.
// Regra que depende de disciplina humana morre na terceira pressa; regra que tem
// assert morre nunca. Esta suite e o guardiao do arquivo (F3: constraint e
// guardiao, nao enfeite - aqui aplicado fora do banco).
//
// == O TESTE QUE VALE MAIS QUE TODOS ============================================
// O bloco de CONTRASTE. O manual manda "AA medido", nao "AA alegado", e a
// diferenca entre os dois e exatamente esta suite: cada par de cor que o tema
// usa de verdade e CALCULADO pela formula da WCAG e comparado com 4,5:1.
// Isso ja pagou por si: o verde da marca (#8DC63F) NAO passa como texto sobre
// branco - da 1,9:1. Sem medir, ele teria virado "texto verde de sucesso" em
// alguma tela e ninguem enxergaria o valor ganho no monitor do cliente.
//
//   node tests/testa_tema.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const CSS = R('fpmed_tema.css');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_tema - o design system\n');

// ── ferramentas de leitura do arquivo ────────────────────────────────────────
const semComentario = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const mRaiz = semComentario.match(/:root\s*\{([\s\S]*?)\n\}/);
const RAIZ = mRaiz ? mRaiz[1] : '';
const foraDaRaiz = mRaiz ? semComentario.replace(mRaiz[0], '') : semComentario;

const token = nome => {
  const m = RAIZ.match(new RegExp('--' + nome + '\\s*:\\s*([^;]+);'));
  return m ? m[1].trim() : null;
};

// ── 1. os tokens existem ─────────────────────────────────────────────────────
// L2: a estrutura vem antes do codigo. Aqui a "estrutura" e a lista de tokens -
// se ela estiver incompleta, cada tela inventa o que falta e o sistema racha.
const CINZAS = [50,100,200,300,400,500,600,700,800,900];
ok('1. dez tons de cinza (Refactoring UI: 8-10, porque quase tudo na tela e cinza)',
  CINZAS.every(n => token('cinza-' + n)), CINZAS.filter(n => !token('cinza-' + n)));
ok('2. nove tons de azul, com a marca no 500', [50,100,200,300,400,500,600,700,800,900].every(n => token('azul-' + n)));
ok('3. nove tons de verde, com a marca no 500', [50,100,200,300,400,500,600,700,800,900].every(n => token('verde-' + n)));
ok('4. vermelho e ambar com os tons que o sistema usa', [50,100,300,500,600,700,800].every(n => token('vermelho-' + n) && token('ambar-' + n)));
ok('5. o azul da marca e o #2CA9E0 tirado do codigo, nao um azul inventado', token('azul-500').toLowerCase() === '#2ca9e0', token('azul-500'));
ok('6. o verde da marca e o #8DC63F', token('verde-500').toLowerCase() === '#8dc63f', token('verde-500'));
ok('7. escala de espacamento completa', [1,2,3,4,6,8,12,16].every(n => token('esp-' + n)));
// Os TRES raios existem (a hierarquia entre eles e cobrada no 27). Os valores
// literais sairam daqui em 13/08 pelo mesmo motivo dos asserts 25, 28 e 29: eles
// diziam "mudou", nunca "piorou" — e a paleta aprovada mudou os tres de uma vez.
ok('8. os tres raios do adendo existem: cartao, botao e pilula',
  ['raio-cartao','raio-botao','raio-pilula'].every(t => token(t)));
ok('9. tres niveis de sombra', ['sombra-1','sombra-2','sombra-3'].every(t => token(t)));
ok('10. escala tipografica de seis degraus', [1,2,3,4,5,6].every(n => token('txt-' + n)));
ok('11. quatro pesos declarados', ['peso-normal','peso-medio','peso-semi','peso-forte'].every(t => token(t)));
ok('12. uma transicao so, de 150ms (A4)', /150ms/.test(token('transicao') || ''), token('transicao'));
ok('13. altura de linha 1.5 em texto e 1.2 em titulo (D4)',
  token('altura-texto') === '1.5' && token('altura-titulo') === '1.2');
ok('14. anel de foco declarado - foco visivel e obrigatorio', !!token('foco'));
ok('15. largura maxima de leitura declarada', !!token('largura-leitura'));

// ── 2. a grade de 8px ────────────────────────────────────────────────────────
// D3: "quase alinhado e pior que desalinhado". Um token de 10px ou 15px passaria
// despercebido pra sempre e desalinharia tudo que encostasse nele.
const espacos = [1,2,3,4,6,8,12,16].map(n => ({ n, v: parseInt(token('esp-' + n), 10) }));
ok('16. todo espacamento e multiplo de 4 (grade de 8, com meia-unidade pra colar rotulo)',
  espacos.every(e => e.v % 4 === 0), espacos.filter(e => e.v % 4 !== 0));
ok('17. o numero do token bate com o passo (--esp-4 vale 4x4=16px, e nao "medio")',
  espacos.every(e => e.v === e.n * 4), espacos.filter(e => e.v !== e.n * 4));

// ── 3. o arquivo e inerte ────────────────────────────────────────────────────
// "Sem apagao" aplicado ao CSS: da pra ligar o tema em QUALQUER tela hoje sem
// mudar um pixel, porque nao existe seletor de elemento nu. Cada tela adota no
// dia da fatia dela. Se um dia alguem escrever `button{...}` aqui, este assert
// fica vermelho antes de a tela do cliente ficar torta.
const seletores = (foraDaRaiz.match(/(^|\})\s*([^{}@]+)\{/g) || [])
  .map(s => s.replace(/^[\}\s]*/, '').replace(/\s*\{$/, '').trim())
  .filter(Boolean)
  .flatMap(s => s.split(',').map(x => x.trim()))
  .filter(s => s && !/^\d+%$/.test(s) && s !== 'from' && s !== 'to');
/* ══ O 18 MEDIA "COMECA COM PONTO"; A PROMESSA E "NAO AGE SEM A TELA PEDIR" (A53) ══
   Ele exigia que TODO seletor comecasse com `.` ou `:root`. Isso e um bom proxy e
   segurou o arquivo por semanas. A A53 trouxe o caso em que o proxy e a promessa se
   separam:

     html:has(body.fp-imprimivel) #gm-auth-overlay { display:none }   (dentro do @media print)

   O `#gm-auth-overlay` do gm-auth.js e filho direto do <html> - NAO mora dentro do
   <body>. Nenhum seletor que comece com `.fp-imprimivel` alcanca um irmao do body,
   entao a regra tinha de comecar em `html`. Mas ela e gatilhada por
   `:has(body.fp-imprimivel)`: **em tela que nao optou, ela nao existe.** A promessa
   esta intacta; so a letra nao.

   >>> ENTAO ELE PASSA A MEDIR A PROMESSA: todo seletor tem de CONTER uma classe
       `.fp-` em algum lugar (ou ser `:root`). Isso continua barrando `button{...}`,
       que era o ponto - e barra tambem `#alguma-coisa{...}` solto, que a versao
       antiga tambem barrava. O que ele deixa de barrar e exatamente o caso legitimo:
       seletor ancorado em elemento mas TRANCADO por uma classe do tema.
   >>> S8 DE NOVO, e vale nomear: assert que guarda a forma reprova o certo no dia em
       que aparece um caminho novo. Aqui o caminho novo foi um elemento fora do body. */
const nus = seletores.filter(s => !/^:root\b/.test(s) && !/\.fp-/.test(s));
ok('18. todo seletor e trancado por uma classe .fp- - carregar o tema nao muda nenhuma tela sozinho',
  nus.length === 0, nus);
ok('19. toda classe do tema tem prefixo fp- (nao colide com o CSS que ja existe nas telas)',
  seletores.filter(s => /^\./.test(s)).every(s => /^\.fp-/.test(s)),
  seletores.filter(s => /^\./.test(s) && !/^\.fp-/.test(s)));

// ── 4. cor e espacamento so saem dos tokens ──────────────────────────────────
// A razao de existir do arquivo. Uma cor escrita na mao la embaixo e o comeco do
// fim da consistencia - e a janela quebrada da lei L8.
const corSolta = (foraDaRaiz.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) || []);
ok('20. ZERO cor literal fora do :root - toda cor vem de var()', corSolta.length === 0, corSolta);
const espSolto = (foraDaRaiz.match(/(?:padding|margin|gap)[a-z-]*\s*:\s*[^;}]*?\b\d+px/g) || []);
ok('21. ZERO espacamento literal em padding/margin/gap - todo espaco vem de var()', espSolto.length === 0, espSolto);
const msSolto = (foraDaRaiz.match(/transition\s*:\s*[^;]*?\b\d+m?s/g) || []);
ok('22. ZERO duracao literal de transicao fora do token', msSolto.length === 0, msSolto);

// ── 5. a lista negra do D13 ──────────────────────────────────────────────────
ok('23. nenhum emoji no arquivo (emoji como icone e proibido)',
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(CSS));
ok('24. nenhum gradiente colorido de enfeite - o unico gradiente e o cinza do skeleton',
  (semComentario.match(/gradient\(/g) || []).length === 1);
/* ══ ESTE ASSERT TAMBEM MEDIA O MEIO (13/08) ═══════════════════════════════════
   Ele cobrava a string literal "rgba(18,23,33" — ou seja, cobrava UMA sombra
   especifica, nao a REGRA. Quando a familia de sombra da amostra entrou
   (rgba(30,41,59), mais macia e mais longa), ele ficou vermelho sem que nada
   tivesse piorado: continua sendo um escuro neutro e translucido.
   >>> AGORA ELE COBRA O QUE D13 PROIBE DE VERDADE: sombra COLORIDA. Um brilho
       azul da marca — rgba(44,169,224,.35), que ja existiu neste projeto — passa
       no assert antigo se alguem trocar o literal junto, e reprova neste aqui.
       Dois testes: o tom tem que ser ESCURO (o olho le sombra clara como sujeira)
       e quase NEUTRO (canais proximos entre si). */
const _coresDeSombra = t => [...String(token(t)).matchAll(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)]
  .map(m => [+m[1], +m[2], +m[3]]);
/* O "length >= 2" saiu em 13/08 junto com a familia do molde: ele exigia DUAS
   CAMADAS por sombra, e duas camadas nao e a regra - e uma das receitas de
   sombra macia. A sombra de repouso do molde tem UMA camada de 1px a 4%, e nao
   ha nada de errado com ela. O que o assert guarda e "nenhuma sombra colorida",
   e isso se mede em CADA cor declarada, tendo ela uma camada ou tres. */
ok('25. nenhuma sombra colorida (D13) - toda sombra e um escuro neutro e translucido',
  ['sombra-1','sombra-2','sombra-3'].every(t => _coresDeSombra(t).length >= 1
    && _coresDeSombra(t).every(([r, g, b]) =>
         Math.max(r, g, b) < 80                                  // escura
      && Math.max(r, g, b) - Math.min(r, g, b) <= 35)),           // quase neutra
  ['sombra-1','sombra-2','sombra-3'].map(t => t + ': ' + JSON.stringify(_coresDeSombra(t))));
/* ══ ESTE ASSERT MEDIA O MEIO, E ELE ERA MEU, DE HOJE DE MANHA (13/08) ═════════
   Escrito assim: "a sombra de repouso e MACIA (desfoque longo)" - cobrando um
   desfoque >= 12px no repouso. Isso nao e regra nenhuma: e a RECEITA da amostra
   da manha, promovida a lei por quem tinha acabado de gostar dela. O molde
   oficial resolve a mesma coisa pelo caminho oposto (sombra de 2px quase
   invisivel + borda de 1px desenhando a fronteira), e o assert ficou vermelho
   sem que nada tivesse piorado.
   >>> O QUE D6 PEDE DE VERDADE sao duas coisas, e sao estas que ficam:
       (a) uma ESCADA de elevacao - repouso < elevado < o que paira sobre a tela;
       (b) sombra DISCRETA em repouso, porque "sombra pesada + borda" e o que a
           lista negra chama de cara de template.
   Assim o assert acompanha o tema em vez de virar detector de mudanca: qualquer
   familia de sombra passa, contanto que a escada exista e o repouso seja leve. */
const _maiorDesfoque = t => Math.max(...(String(token(t)).match(/(-?\d+)px/g) || ['0px'])
  .map(v => Math.abs(parseInt(v, 10))));
ok('25b. ha ESCADA de elevacao: o desfoque cresce do repouso ate o que paira sobre a tela (D6)',
  _maiorDesfoque('sombra-1') < _maiorDesfoque('sombra-2')
  && _maiorDesfoque('sombra-2') < _maiorDesfoque('sombra-3'),
  ['sombra-1','sombra-2','sombra-3'].map(t => t + ': ' + _maiorDesfoque(t) + 'px'));
const _maiorAlfa = t => Math.max(...([...String(token(t)).matchAll(/rgba\([^)]*,\s*([\d.]+)\s*\)/g)]
  .map(m => parseFloat(m[1])).concat([0])));
ok('25c. a sombra de REPOUSO e discreta - sombra pesada colada na borda e cara de template (D13)',
  _maiorAlfa('sombra-1') <= 0.12, _maiorAlfa('sombra-1'));
ok('26. nenhum backdrop-filter - glassmorphism esta na lista negra', !/backdrop-filter/.test(semComentario));
/* ══ E ESTE ERA O MAIS FRACO DOS TRES (13/08) ══════════════════════════════════
   Ele cobrava "raio do cartao <= 12px". Esse teto era MEU, nao da regra: D13 poe
   na lista negra "border-radius gigante EM TUDO", e a palavra que carrega a
   proibicao e *em tudo*. O que faz cara de IA nao e o canto grande, e o canto
   UNICO — botao, campo, cartao e etiqueta com o mesmo raio apagam a hierarquia de
   tamanho e a tela vira um monte de retangulos macios iguais.
   A amostra aprovada usa 16 no cartao, e com o teto antigo ela reprovaria. */
const _raioCartao = parseInt(token('raio-cartao'), 10), _raioBotao = parseInt(token('raio-botao'), 10);
ok('27. ha HIERARQUIA de raio: o botao/campo e sempre menor que o cartao (D13)',
  _raioBotao < _raioCartao, { cartao: _raioCartao, botao: _raioBotao });
ok('27b. e o raio do cartao continua proporcional, nao gigante',
  _raioCartao <= 20, _raioCartao);
ok('27c. so a pilula pode ser totalmente arredondada',
  parseInt(token('raio-pilula'), 10) > 100 && _raioCartao <= 20 && _raioBotao <= 20);

/* A LUMINANCIA RELATIVA DA WCAG. Ela morava la embaixo, junto do bloco de
   contraste; subiu porque a secao 6 passou a medir em vez de comparar literal.
   Uma definicao so — duas copias da mesma formula e o jeito classico de uma
   envelhecer calada, e esta aqui e a que sustenta os 27 pares. */
const lum = hex => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map(i => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

// ── 6. o preto puro e o branco puro ──────────────────────────────────────────
// D4 nomeia os dois extremos, e nomeia por um motivo: preto sobre branco vibra e
// cansa. O branco existe como SUPERFICIE de cartao, nunca como fundo de pagina.
/* ══ ESTES DOIS ASSERTS MEDIAM O MEIO, E A TROCA DE PALETA MOSTROU ISSO (13/08) ══
   Eles cobravam o VALOR LITERAL ("e #1a202c", "e #f7fafc"). Quando a paleta da
   amostra aprovada entrou, os dois ficaram vermelhos — e nada tinha piorado: o
   texto continuava escuro-sem-ser-preto e o fundo continuava claro-sem-ser-branco.
   Assert preso a um literal nao guarda a regra, guarda a decoracao dela; ele so
   sabe dizer "mudou", nunca "piorou". E a licao S8, que ja apareceu cinco vezes
   nesta obra com roupas diferentes.
   >>> AGORA ELES COBRAM A PROMESSA DO D4, que e o que a regra sempre quis dizer:
       o texto principal NAO e preto puro e e escuro o bastante; o fundo da pagina
       NAO e branco puro e e claro o bastante. Trocar de paleta passa; afundar o
       contraste ou cair no preto/branco puro, nao. */
const _lumTexto = lum(token('cinza-800')), _lumFundo = lum(token('cinza-50'));
ok('28. texto principal e escuro SEM ser preto puro (D4)',
  token('cinza-800').toLowerCase() !== '#000000' && _lumTexto > 0 && _lumTexto < 0.05,
  { cor: token('cinza-800'), luminancia: Math.round(_lumTexto * 1e4) / 1e4 });
ok('29. fundo da pagina e claro SEM ser branco puro — o branco fica pro cartao (D4)',
  !['#ffffff', '#fff'].includes(token('cinza-50').toLowerCase()) && _lumFundo > 0.8 && _lumFundo < 1,
  { cor: token('cinza-50'), luminancia: Math.round(_lumFundo * 1e4) / 1e4 });
/* ══ E ESTE TAMBEM ERA MEU E TAMBEM MEDIA O MEIO (13/08, tarde) ════════════════
   Escrito de manha assim: "ha degrau visivel entre o fundo da pagina e o branco
   do cartao", exigindo 0,05 de luminancia. A promessa e boa - o cartao tem que
   se separar da pagina. O ERRO foi eu decidir POR QUAL MEIO isso acontece.

   O molde oficial poe o fundo da pagina em #FAFBFC, a 3,7 pontos do branco: o
   degrau sozinho quase nao existe. E o cartao continua perfeitamente separado,
   porque a separacao ali e feita pela BORDA de 1px (#E9EDF3, 15,6 pontos abaixo
   do branco) mais a sombra. Sao dois caminhos legitimos pro mesmo fim; o assert
   antigo so conhecia um, e teria reprovado o molde inteiro por isso.
   >>> AGORA ELE COBRA A PROMESSA: o cartao tem fronteira. Ou o fundo da pagina
       faz o degrau, ou existe uma borda que faca. Se um dia alguem clarear a
       borda ATE o branco com um fundo tambem quase branco, a tela fica chapada
       e este assert e que avisa - que era o ponto desde o comeco. */
const _degrauFundo = lum(token('branco')) - _lumFundo;
const _degrauBorda = lum(token('branco')) - lum(token('cinza-200'));
ok('29b. o cartao se separa da pagina - pelo degrau do fundo, ou por uma borda que o desenhe',
  _degrauFundo >= 0.05 || _degrauBorda >= 0.05,
  { degrauDoFundo: Math.round(_degrauFundo * 1e4) / 1e4, degrauDaBorda: Math.round(_degrauBorda * 1e4) / 1e4 });
/* ══ O ASSERT 30 CONFUNDIA DOIS SUPORTES, E A A53 SEPAROU (01/09/2026) ═══════════
   Escrito assim: "#000000 nao existe no arquivo". A promessa por tras dele e boa e
   e a do Refactoring UI: NUNCA PRETO PURO SOBRE BRANCO PURO. Mas a razao dessa
   regra e FISICA e e da TELA - num monitor retroiluminado o preto puro sobre branco
   puro e contraste duro demais e cansa a vista.

   >>> NO PAPEL essa razao nao existe. Tinta preta sobre papel branco e o contraste
       para o qual a impressora foi feita, e mandar o --cinza-800 (#0A1526) para o
       papel so gasta ciano e magenta para produzir um preto pior. Quando a A53
       trouxe o @media print, o assert reprovou uma coisa CERTA - ele media o
       arquivo, e a promessa era sobre a tela.

   >>> ENTAO ELE NAO FOI AFROUXADO, FOI APERTADO. Antes: "nao existe preto puro".
       Agora, tres cobrancas onde havia uma:
         30a  o preto puro so pode aparecer como valor do token --papel-tinta;
         30b  nenhum token de TELA e preto puro (a promessa original, agora medida
              nos tokens em vez de no texto do arquivo);
         30c  a tinta do papel nao vaza para fora do @media print.
       A 30c e a que importa mais: sem ela, alguem usa var(--papel-tinta) numa
       regra de tela um dia e o preto duro volta pela porta dos fundos - com token,
       que e pior, porque parece legitimo.
   >>> A LICAO E A S8 OUTRA VEZ: o assert guardava a LETRA ("nao ter #000") e nao a
       PROMESSA ("a tela nao cansa a vista"). Assert que mede o meio reprova o certo
       no dia em que aparece um caminho novo - aqui, um suporte novo. */
{
  const pretos = (semComentario.match(/#000000\b|#000\b/gi) || []);
  const soNoTokenDoPapel = /--papel-tinta:\s*#000000\b/.test(semComentario);
  ok('30a. o preto puro so aparece como valor do token --papel-tinta',
    pretos.length === 0 || (soNoTokenDoPapel && pretos.length === 1), pretos);

  // A promessa original, agora medida onde ela mora: nos tokens que a TELA usa.
  const tokensDeTela = ['cinza-800', 'cinza-900', 'cinza-50', 'branco', 'navy'];
  const pretoNaTela = tokensDeTela.filter(t => {
    const v = (token(t) || '').toLowerCase();
    return v === '#000000' || v === '#000';
  });
  ok('30b. *** nenhum token de TELA e preto puro (a regra do D4, medida no token) ***',
    pretoNaTela.length === 0, pretoNaTela);

  // A tinta do papel so vale no papel. Fora do @media print ela nao pode ser usada.
  const iPrint = semComentario.indexOf('@media print');
  const foraDoPrint = iPrint === -1 ? semComentario : semComentario.slice(0, iPrint);
  const vazou = (foraDoPrint.match(/var\(--papel[a-z-]*\)/g) || []);
  ok('30c. *** a tinta do papel NAO vaza para fora do @media print ***',
    vazou.length === 0, vazou);
}
ok('31. a pagina usa o cinza-50 como fundo (o branco fica pro cartao)',
  /\.fp-pagina\{[^}]*background:\s*var\(--cinza-50\)/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{')));

// ── 7. CONTRASTE MEDIDO (WCAG 2.1) ───────────────────────────────────────────
// L1: medir, nunca achar. Cada par abaixo e um par que o tema USA de verdade -
// nao uma amostra bonita. Se um dia alguem clarear um token, o par cai aqui.
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const PARES = [
  ['cinza-800', 'cinza-50',   'texto principal sobre a pagina'],
  ['cinza-800', 'branco',     'texto principal dentro do cartao'],
  ['cinza-600', 'branco',     'ROTULO sobre cartao (D9)'],
  ['cinza-600', 'cinza-50',   'texto de apoio sobre a pagina'],
  ['cinza-500', 'branco',     'placeholder do campo'],
  ['branco',    'azul-600',   'botao principal'],
  ['branco',    'azul-700',   'botao principal em hover'],
  ['branco',    'vermelho-600', 'botao de perigo'],
  ['branco',    'vermelho-700', 'botao de perigo em hover'],
  ['azul-700',  'branco',     'link / botao de texto'],
  ['azul-700',  'azul-50',    'botao de texto em hover'],
  ['azul-700',  'azul-100',   'pilula info'],
  ['verde-700', 'verde-100',  'pilula de sucesso'],
  ['ambar-700', 'ambar-100',  'pilula de atencao'],
  ['vermelho-700', 'vermelho-100', 'pilula de perigo'],
  ['cinza-700', 'cinza-100',  'pilula neutra'],
  ['azul-900',  'azul-50',    'aviso info'],
  ['verde-900', 'verde-50',   'aviso de sucesso'],
  ['ambar-800', 'ambar-50',   'aviso de atencao'],
  ['vermelho-800', 'vermelho-50', 'aviso de erro'],
  ['vermelho-700', 'branco',  'mensagem de erro do campo'],
  ['cinza-800', 'verde-500',  'texto sobre o verde da marca (pilula cheia)'],
  // AS CINCO TENUES (12/08, item 6): fundo da pilula do calendario mensal. Elas
  // nascem de uma medicao que REPROVOU o caminho obvio - pilula pintada com a
  // cor cheia da etapa da 2,94:1 na 2 e 4,42:1 na 4. Sem estes cinco asserts,
  // o dia em que alguem "escurecer um pouquinho" uma tenue pra ela aparecer
  // mais volta a produzir o mesmo defeito, e de novo sem ninguem ver.
  ['cinza-800', 'etapa-1-tenue', 'pilula do calendario · Oportunidade'],
  ['cinza-800', 'etapa-2-tenue', 'pilula do calendario · Qualificacao'],
  ['cinza-800', 'etapa-3-tenue', 'pilula do calendario · Disputa'],
  ['cinza-800', 'etapa-4-tenue', 'pilula do calendario · Habilitacao'],
  ['cinza-800', 'etapa-5-tenue', 'pilula do calendario · Ata'],
  /* ══ OS PARES FECHADOS DO MOLDE (13/08) ═════════════════════════════════════
     Cada um destes e um selo do molde oficial, com tinta e fundo escolhidos
     JUNTOS. Eles entram aqui pelo mesmo motivo das tenues: o dia em que alguem
     clarear um fundo "pra ficar mais leve" e o dia em que o selo para de ser
     legivel, e ninguem ve isso olhando. Os numeros que o molde publica sao
     info 5,92 · bom 6,27 · aviso 5,51 · perigo 5,92 · neutro 11,45 - e a conta
     daqui bate com a deles, o que tambem confere o instrumento. */
  ['sinal-info-tinta',    'sinal-info-fundo',    'selo de informacao (modalidade)'],
  ['sinal-bom-tinta',     'sinal-bom-fundo',     'selo de sucesso ("No funil")'],
  ['sinal-atencao-tinta', 'sinal-atencao-fundo', 'pastilha de prazo · abre amanha'],
  ['sinal-perigo-tinta',  'sinal-perigo-fundo',  'pastilha de prazo · abre HOJE'],
  ['sinal-neutro-tinta',  'sinal-neutro-fundo',  'selo neutro'],
  ['sinal-normal-tinta',  'sinal-normal-fundo',  'pastilha de prazo · sem urgencia'],
  ['cinza-800',           'grifo',               'o termo buscado em <mark>'],
  /* ══ E A SUPERFICIE ESCURA (a sidebar navy do molde) ═════════════════════════
     Ela tem tinta propria, e tinta propria sem medicao e como nasce um menu
     bonito e ilegivel. Nenhuma das quatro precisou de fuga - a sidebar do molde
     sai bem na regua, e isso vale registrar em vez de supor. */
  ['branco',      'navy', 'numero do cartao de destaque, sobre o navy'],
  ['navy-tinta',  'navy', 'item de menu em repouso, sobre o navy'],
  ['navy-apoio',  'navy', 'legenda do cartao de destaque, sobre o navy'],
  ['navy-rotulo', 'navy', 'rotulo de grupo do menu, sobre o navy'],
  ['navy-marca',  'navy', '"HOSPITALAR" da marca, sobre o navy'],
];
let n = 32;
for (const [fg, bg, ctx] of PARES) {
  const r = contraste(token(fg), token(bg));
  ok(n + '. AA em ' + ctx + ' (' + fg + ' sobre ' + bg + ')', r >= 4.5, Math.round(r * 100) / 100);
  n++;
}

// A prova pelo avesso: o verde da marca NAO serve de texto sobre branco. Este
// assert existe pra que o dia em que alguem "melhorar" o verde-500 pra passar em
// AA, ele saiba que mudou a MARCA - e nao so um token.
ok(n + '. o verde da marca reprova como texto sobre branco (por isso texto verde usa o 700)',
  contraste(token('verde-500'), token('branco')) < 4.5,
  Math.round(contraste(token('verde-500'), token('branco')) * 100) / 100); n++;
ok(n + '. e o azul da marca tambem reprova (por isso link usa o 700 e botao usa o 600)',
  contraste(token('azul-500'), token('branco')) < 4.5,
  Math.round(contraste(token('azul-500'), token('branco')) * 100) / 100); n++;

// A PROVA PELO AVESSO DAS TENUES, e ela e a que da sentido as cinco de cima:
// as tenues existem PORQUE a cor cheia reprova como fundo de texto. Se um dia
// alguem trocar as cinco cores de etapa por versoes claras o suficiente pra
// passar em AA, este assert cai - e cair aqui e o aviso de que a pilula do
// calendario pode voltar a ser pintada com a cor cheia, sem a camada extra.
// (Sem ele, os cinco asserts acima medem o resultado e escondem o motivo.)
ok(n + '. a cor CHEIA da etapa continua reprovando como fundo de texto (e por isso a tenue existe)',
  [1, 2, 3, 4, 5].some(i => contraste(token('cinza-800'), token('etapa-' + i)) < 4.5),
  [1, 2, 3, 4, 5].map(i => 'etapa-' + i + ': ' + Math.round(contraste(token('cinza-800'), token('etapa-' + i)) * 100) / 100)); n++;
/* ══ E ESTE ASSERT NASCEU VERMELHO, o que e o motivo de ele existir ═══════════
   Eu ia cobrar 3:1 da barra lateral da pilula (WCAG 1.4.11, componente nao
   textual) achando que era formalidade. A medicao:

       etapa-1 sobre branco .. 2,67:1     etapa-4 .. 4,17:1
       etapa-2 ............... 2,94:1     etapa-5 .. 3,02:1
       etapa-3 ............... 3,62:1

   DUAS das cinco reprovam. Ou seja: a cor da etapa, sozinha, NAO alcanca o
   minimo pra identificar coisa nenhuma - nem no kanban, onde ela ja vive desde
   12/08, nem na pilula do calendario.

   >>> O QUE ISSO **NAO** AUTORIZA: escurecer as cinco. Elas sao identidade
       visual vinda do prototipo, e o projeto ja tem uma regra escrita que
       resolve o problema pela raiz - "a cor nunca anda sozinha: o NOME da etapa
       aparece junto". Cor redundante nao precisa de 3:1; cor SOZINHA precisaria,
       e nunca alcancaria sem deixar de ser a cor da marca.
   >>> ENTAO O ASSERT MUDOU DE ALVO, e ficou com mais dente: enquanto qualquer
       uma das cinco estiver abaixo de 3:1, a suite do calendario e OBRIGADA a
       provar que a pilula carrega o nome da etapa. Se um dia alguem escurecer
       as cinco de verdade, a exigencia cai sozinha - o assert melhora junto com
       o tema em vez de virar detector de mudanca. */
const fracas = [1, 2, 3, 4, 5]
  .map(i => ({ i, r: Math.round(contraste(token('etapa-' + i), token('branco')) * 100) / 100 }))
  .filter(x => x.r < 3);
const calTexto = (() => { try { return R('tests', 'testa_calendario.js'); } catch (_) { return ''; } })();
ok(n + '. cor de etapa abaixo de 3:1 obriga o nome junto, e a suite do calendario cobra isso',
  fracas.length === 0 || /nome da etapa|nomeFase/.test(calTexto),
  { abaixoDe3: fracas.map(x => 'etapa-' + x.i + ': ' + x.r), suiteDoCalendario: calTexto ? 'existe' : 'NAO EXISTE' }); n++;

/* ══ A PROVA PELO AVESSO DO --cinza-400 (13/08) ════════════════════════════════
   Ele e o unico tom da rampa PROIBIDO de carregar texto, e o comentario dele diz
   isso. Comentario nao segura ninguem: este projeto ja consertou tres vezes a
   mesma coisa (o #1b8dc4 da licao S12, o #9AA7B8 do menu de manha, o #8C99A9 do
   molde a tarde). O assert existe pra que a proibicao tenha dente - e ele mede,
   nao le: se um dia o 400 escurecer o bastante pra passar em AA, ele mesmo deixa
   de reprovar, e a proibicao cai sozinha porque deixou de fazer sentido.
   >>> E o testa_menu_lateral guarda o outro lado (o 400 nao aparece em `color:`). */
ok(n + '. o --cinza-400 REPROVA como texto sobre branco - e e por isso que ele e so borda e icone',
  contraste(token('cinza-400'), token('branco')) < 4.5,
  Math.round(contraste(token('cinza-400'), token('branco')) * 100) / 100); n++;

/* ── AS TRES BORDAS DO MOLDE, e a ordem entre elas ──────────────────────────
   O molde declara tres fronteiras que diferem em poucos pontos de cinza, e a
   ORDEM entre elas e a informacao (divisor mais leve que cartao, cartao mais
   leve que controle). Trocada a ordem, o divisor entre linhas de uma lista longa
   passa a pesar mais que o contorno do painel - e a lista vira grade. Cobrar os
   valores nao guardaria isso; cobrar a ordem, sim. */
const _lumB = t => lum(token(t));
ok(n + '. as tres bordas do molde existem, e a mais leve e a que divide a lista',
  ['borda-divisor','borda-controle'].every(t => token(t))
  && _lumB('borda-divisor') > _lumB('cinza-200')
  && _lumB('cinza-200') > _lumB('borda-controle'),
  { divisor: token('borda-divisor'), cartao: token('cinza-200'), controle: token('borda-controle') }); n++;

/* ── A ESCALA DE RAIOS ──────────────────────────────────────────────────────
   Seis degraus com oficio. O que a suite guarda e a MONOTONIA (peca menor tem
   canto menor), porque e ela que sustenta a hierarquia que D13 pede - e nao os
   valores, que ja mudaram duas vezes num dia so. */
const _raios = ['raio-mini','raio-selo','raio-item','raio-botao','raio-campo','raio-cartao'];
ok(n + '. a escala de raios sobe junto com o tamanho da peca (mini < selo < item < botao < campo < cartao)',
  _raios.every(t => token(t))
  && _raios.map(t => parseInt(token(t), 10)).every((v, i, a) => i === 0 || v > a[i - 1]),
  _raios.map(t => t + ': ' + token(t))); n++;

/* ── SUPERFICIE E ESTADOS DE LINHA ──────────────────────────────────────────
   Hover e "o mouse esta aqui"; ativa e "o teclado esta aqui". Um valor so pros
   dois faz a navegacao por teclado sumir no instante em que alguem encosta o
   mouse - e quem navega por teclado e justamente quem menos usa o mouse. */
ok(n + '. hover de linha e linha ativa sao cores DIFERENTES (senao o teclado some sob o mouse)',
  !!token('linha-hover') && !!token('linha-ativa')
  && token('linha-hover').toLowerCase() !== token('linha-ativa').toLowerCase(),
  { hover: token('linha-hover'), ativa: token('linha-ativa') }); n++;
ok(n + '. a superficie sutil e mais clara que a pagina e mais escura que o branco (ela e o degrau do meio)',
  lum(token('superficie-sutil')) > _lumFundo && lum(token('superficie-sutil')) < lum(token('branco')),
  { pagina: token('cinza-50'), sutil: token('superficie-sutil'), branco: token('branco') }); n++;

// ── 8. os estados que o adendo exige desenhados ──────────────────────────────
// "Todo estado desenhado" nao e frase de efeito: estado que nao existe no tema
// nasce improvisado na tela, e improviso nao se repete igual duas vezes.
// Cobrado pelo BRILHO, nao pelo nome: uma classe vazia com o nome certo passaria
// num assert que so procura o seletor - e o cliente veria um retangulo morto.
// (Buraco achado por mutacao: `testa_padrao` pegou, esta suite nao. Corrigido.)
ok(n + '. skeleton existe E anima (A5: skeleton imediato, nunca tela branca)',
  /\.fp-skeleton\{[^}]*fp-brilho/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{')) &&
  /@keyframes fp-brilho/.test(semComentario)); n++;
ok(n + '. vazio COM acao existe (vazio que so diz "nada encontrado" e um beco)',
  /\.fp-vazio\{/.test(semComentario) && /\.fp-vazio__titulo\{/.test(semComentario)); n++;
ok(n + '. hover no cartao clicavel', /\.fp-cartao--clicavel:hover\{/.test(semComentario)); n++;
ok(n + '. foco visivel no botao e no campo, os dois pelo mesmo anel',
  /\.fp-btn:focus-visible\{[^}]*var\(--foco\)/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{')) &&
  /\.fp-campo:focus\{[^}]*var\(--foco\)/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{'))); n++;
ok(n + '. desabilitado desenhado no botao e no campo',
  /\.fp-btn\[disabled\]/.test(semComentario) && /\.fp-campo\[disabled\]/.test(semComentario)); n++;
ok(n + '. campo com erro tem borda E mensagem (so a cor nao basta pra quem nao distingue vermelho)',
  /\.fp-campo--erro\{/.test(semComentario) && /\.fp-erro-campo\{/.test(semComentario)); n++;
ok(n + '. erro que nao grita: o aviso de erro tem fundo claro, nao vermelho saturado',
  /\.fp-aviso--erro\{[^}]*background:\s*var\(--vermelho-50\)/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{'))); n++;
ok(n + '. quem prefere menos movimento tem o brilho do skeleton desligado',
  /prefers-reduced-motion/.test(semComentario)); n++;

// ── 9. as leis do desenho viraram codigo ─────────────────────────────────────
ok(n + '. D9 - o rotulo e menor e mais claro que o valor, e cola nele (esp-1)',
  /\.fp-rotulo\{[^}]*var\(--txt-1\)/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{')) &&
  /\.fp-rotulo\{[^}]*var\(--cinza-600\)/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{')) &&
  /\.fp-rotulo\{[^}]*margin-bottom:\s*var\(--esp-1\)/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{'))); n++;
ok(n + '. D9 - o valor e maior e mais forte que o rotulo',
  /\.fp-valor\{[^}]*var\(--txt-3\)/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{')) &&
  /\.fp-valor\{[^}]*var\(--peso-semi\)/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{'))); n++;
ok(n + '. numero tabular existe (senao a coluna de R$ danca a cada linha)',
  /\.fp-num\{[^}]*tabular-nums/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{'))); n++;
ok(n + '. D8 - quatro variantes de botao e so: principal, contorno, texto, perigo',
  (semComentario.match(/\.fp-btn--(principal|contorno|texto|perigo)\{/g) || []).length === 4); n++;
ok(n + '. D6 - o cartao em repouso usa a sombra 1, e a 3 fica so pro que paira sobre a tela',
  /\.fp-cartao\{[^}]*var\(--sombra-1\)/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{')) &&
  /\.fp-sobreposto\{[^}]*var\(--sombra-3\)/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{'))); n++;
ok(n + '. D6 - sombra pesada e borda grossa nao andam juntas: a borda do cartao e de 1px',
  /\.fp-cartao\{[^}]*border:\s*1px/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{'))); n++;

// ── 10. a fonte nao e uma aposta na rede ─────────────────────────────────────
// A5/D14: tela que espera a rede pra pintar texto parece quebrada, e o sistema e
// PWA - tem que continuar legivel offline. A familia da marca continua na frente
// da pilha; o que mudou e que atras dela ha fonte de sistema, nao o vazio.
ok(n + '. a familia da marca (Montserrat) esta na frente da pilha', /Montserrat/.test(token('fonte'))); n++;
ok(n + '. e tem reserva de fonte do sistema atras dela - a tela nunca espera a rede pra ter texto',
  /-apple-system|BlinkMacSystemFont|Segoe UI/.test(token('fonte')) && /sans-serif\s*$/.test(token('fonte'))); n++;
// Uma familia so: toda declaracao de font-family aponta pro token, e o unico
// lugar do arquivo onde nome de fonte aparece escrito e dentro do proprio token.
const familias = semComentario.match(/font-family\s*:[^;]+;/g) || [];
ok(n + '. toda declaracao de font-family usa o token (D4: tipografia com avareza)',
  familias.length > 0 && familias.every(x => /var\(--fonte\)/.test(x)),
  familias.filter(x => !/var\(--fonte\)/.test(x))); n++;
ok(n + '. nome de fonte escrito aparece UMA vez so no arquivo: dentro do token',
  (semComentario.match(/Montserrat/g) || []).length === 1); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
