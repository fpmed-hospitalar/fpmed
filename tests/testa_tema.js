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
ok('8. os tres raios do adendo: cartao 8, botao 6, pilula 999',
  token('raio-cartao') === '8px' && token('raio-botao') === '6px' && token('raio-pilula') === '999px');
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
const nus = seletores.filter(s => !/^\./.test(s) && !/^:root/.test(s));
ok('18. nenhum seletor de elemento nu - carregar o tema nao muda nenhuma tela sozinho',
  nus.length === 0, nus);
ok('19. toda classe do tema tem prefixo fp- (nao colide com o CSS que ja existe nas telas)',
  seletores.filter(s => /^\./.test(s)).every(s => /^\.fp-/.test(s)),
  seletores.filter(s => /^\./.test(s) && !/^\.fp-/.test(s)));

// ── 4. cor e espacamento so saem dos tokens ──────────────────────────────────
// A razao de existir do arquivo. Uma cor escrita na mao la embaixo e o comeco do
// fim da consistencia - e a janela quebrada da lei L8.
const corSolta = (foraDaRaiz.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) || []);
ok('20. ZERO cor literal fora do :root - toda cor vem de var()', corSolta.length === 0, corSolta);
const espSolto = (foraDaRaiz.match(/(?:padding|margin|gap)[a-z-]*\s*:\s*[^;]*?\b\d+px/g) || []);
ok('21. ZERO espacamento literal em padding/margin/gap - todo espaco vem de var()', espSolto.length === 0, espSolto);
const msSolto = (foraDaRaiz.match(/transition\s*:\s*[^;]*?\b\d+m?s/g) || []);
ok('22. ZERO duracao literal de transicao fora do token', msSolto.length === 0, msSolto);

// ── 5. a lista negra do D13 ──────────────────────────────────────────────────
ok('23. nenhum emoji no arquivo (emoji como icone e proibido)',
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(CSS));
ok('24. nenhum gradiente colorido de enfeite - o unico gradiente e o cinza do skeleton',
  (semComentario.match(/gradient\(/g) || []).length === 1);
ok('25. nenhuma sombra colorida (D13) - toda sombra e preta translucida',
  ['sombra-1','sombra-2','sombra-3'].every(t => !/rgba\((?!18,\s*23,\s*33)/.test(token(t))));
ok('26. nenhum backdrop-filter - glassmorphism esta na lista negra', !/backdrop-filter/.test(semComentario));
ok('27. nenhum raio gigante em cartao (border-radius enorme em tudo e cara de IA)',
  parseInt(token('raio-cartao'), 10) <= 12);

// ── 6. o preto puro e o branco puro ──────────────────────────────────────────
// D4 nomeia os dois extremos, e nomeia por um motivo: preto sobre branco vibra e
// cansa. O branco existe como SUPERFICIE de cartao, nunca como fundo de pagina.
ok('28. texto principal e #1a202c, nao preto puro', token('cinza-800').toLowerCase() === '#1a202c');
ok('29. fundo da pagina e #f7fafc, nao branco puro', token('cinza-50').toLowerCase() === '#f7fafc');
ok('30. #000000 nao existe no arquivo', !/#000000|#000\b/i.test(semComentario));
ok('31. a pagina usa o cinza-50 como fundo (o branco fica pro cartao)',
  /\.fp-pagina\{[^}]*background:\s*var\(--cinza-50\)/.test(semComentario.replace(/\s+/g, ' ').replace(/ \{/g, '{')));

// ── 7. CONTRASTE MEDIDO (WCAG 2.1) ───────────────────────────────────────────
// L1: medir, nunca achar. Cada par abaixo e um par que o tema USA de verdade -
// nao uma amostra bonita. Se um dia alguem clarear um token, o par cai aqui.
const lum = hex => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map(i => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
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
