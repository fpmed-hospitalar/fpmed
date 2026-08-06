// GERA o manifest.webmanifest A PARTIR do cliente.config.js. Nao editar o manifest a mao.
//   node tools/gera_manifest.js            -> PREVIEW
//   node tools/gera_manifest.js --aplicar  -> grava
//
// POR QUE UM GERADOR e nao um JSON editado: o manifest repete coisas que ja vivem no config —
// o nome do cliente, a cor do tema, o nome do produto. Repetido a mao, no dia de criar o cliente
// seguinte alguem troca o config e esquece o manifest, e o app instala com o nome da empresa
// errada embaixo do icone. Aqui so existe uma fonte da verdade: cliente.config.js.
//
// A REGRA DO MOLDE (decisao do Lemuel, 05/08):
//   name       = "LIMEDTEC — {cliente}"   (o nome completo, aparece na loja/instalador)
//   short_name = "{cliente}"              (o que cabe EMBAIXO DO ICONE na area de trabalho)
// Embaixo do icone o espaco e curto: "LIMEDTEC — FPMED" seria cortado. Quem instalou ja sabe
// que o produto e o LIMEDTEC; o que ele precisa distinguir na tela e a EMPRESA.
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CFG = require(path.join(RAIZ, 'cliente.config.js'));
const APLICAR = process.argv.includes('--aplicar');

const marca = CFG.marca || {};
const cores = marca.cores || {};
const produto = marca.produto || 'LIMEDTEC';

// so entram os icones que EXISTEM em disco: apontar pra 404 no manifest faz o navegador
// simplesmente nao oferecer a instalacao, e sem mensagem nenhuma.
const CANDIDATOS = [
  { src: 'icones/limedtec-192.png',          sizes: '192x192', purpose: 'any' },
  { src: 'icones/limedtec-512.png',          sizes: '512x512', purpose: 'any' },
  { src: 'icones/limedtec-192-maskable.png', sizes: '192x192', purpose: 'maskable' },
  { src: 'icones/limedtec-512-maskable.png', sizes: '512x512', purpose: 'maskable' },
];
const icons = CANDIDATOS
  .filter(i => fs.existsSync(path.join(RAIZ, i.src)))
  .map(i => ({ src: i.src, sizes: i.sizes, type: 'image/png', purpose: i.purpose }));

const manifest = {
  name: produto + ' — ' + CFG.nome,
  short_name: CFG.nome,
  description: 'Cotacao, comparativo, licitacoes e proposta para distribuidoras hospitalares.',
  lang: 'pt-BR',
  dir: 'ltr',
  start_url: './index.html',
  scope: './',
  display: 'standalone',
  display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
  orientation: 'any',
  background_color: cores.bg || '#FFFFFF',
  theme_color: cores.destaque || '#000000',
  categories: ['business', 'productivity', 'medical'],
  icons: icons,
  shortcuts: [
    { name: 'Propostas',  url: './fpmed_giovana.html', icons: [{ src: 'icones/limedtec-192.png', sizes: '192x192' }] },
    { name: 'Licitacoes', url: './fpmed_licitacoes.html' },
    { name: 'Negocios', url: './fpmed_negocios.html' },
    { name: 'Painel',     url: './fpmed_painel.html' },
  ],
};

const txt = JSON.stringify(manifest, null, 2) + '\n';
console.log('name       = ' + manifest.name);
console.log('short_name = ' + manifest.short_name + '   (o que aparece embaixo do icone)');
console.log('theme      = ' + manifest.theme_color + '  ·  fundo ' + manifest.background_color);
console.log('icones     = ' + icons.length + ' de ' + CANDIDATOS.length + ' (so os que existem em disco)');
icons.forEach(i => console.log('   ' + i.src + '  ' + i.sizes + '  ' + i.purpose));
if (icons.length === 0) { console.error('\nERRO: nenhum icone em disco. O app nao instalaria.'); process.exit(1); }

if (APLICAR) { fs.writeFileSync(path.join(RAIZ, 'manifest.webmanifest'), txt); console.log('\n>>> manifest.webmanifest GRAVADO.'); }
else console.log('\n>>> PREVIEW. Rode com --aplicar pra gravar.');
