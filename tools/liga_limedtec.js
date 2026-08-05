// LIGA o LIMEDTEC nas telas da FPMED. Idempotente: rodar de novo nao duplica nada.
//   node tools/liga_limedtec.js            -> PREVIEW (nao grava)
//   node tools/liga_limedtec.js --aplicar  -> grava
//
// ORDEM QUE IMPORTA (e por que): cliente.config.js define o CFG; limedtec-config.js le o CFG e
// pinta o tema; SO DEPOIS entra a licenca (que le o CFG) e o gm-auth (que abre a sessao). Se o
// gm-auth subisse antes, a tela ja teria pintado com a cor do molde e trocaria na frente do
// usuario. O pwa.js vai no FIM do body: ele le as variaveis CSS ja aplicadas pra colorir o botao.
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const APLICAR = process.argv.includes('--aplicar');

// tela -> sufixo do titulo ("LIMEDTEC — FPMED · {sufixo}"; null = so "LIMEDTEC — FPMED")
const TELAS = {
  'index.html':                   null,
  'fpmed_sistema_final.html':     'Sistema Interno',
  'fpmed_giovana.html':           'Proposta Comercial',
  'fpmed_vendas.html':            'Vendas Ativas',
  'fpmed_viabilidade.html':       'Viabilidade',
  'fpmed_painel.html':            'Painel',
  'fpmed_licitacoes.html':        'Licitações',
  'fpmed_competitividade.html':   'Competitividade',
  'dashboard_clientes.html':      'Clientes',
  'reset-senha.html':             'Redefinir senha',
};

const BLOCO_HEAD = [
  '<!-- LIMEDTEC = o produto; FPMED = o cliente. Padrão do molde: "LIMEDTEC — {cliente}". -->',
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="icon" type="image/png" sizes="192x192" href="icones/limedtec-192.png">',
  '<link rel="apple-touch-icon" href="icones/limedtec-192.png">',
  '<script src="cliente.config.js"></script>',
  '<script src="limedtec-config.js"></script>',
  // arquivo, nao <script> inline: ver o comentario dentro do limedtec-tema.js
  '<script src="limedtec-tema.js"></script>',
  '<script src="limedtec-licenca.js"></script>',
].join('\n');

const BLOCO_PWA = '<script src="limedtec-pwa.js" defer></script>';

let mudados = 0, pulados = 0;
for (const [arq, sufixo] of Object.entries(TELAS)) {
  const p = path.join(RAIZ, arq);
  if (!fs.existsSync(p)) { console.log('  AUSENTE  ' + arq); continue; }
  let s = fs.readFileSync(p, 'utf8');
  const antes = s;

  // 1. bloco do head — antes do gm-auth quando ele existe; senao, antes do </head>
  if (!s.includes('cliente.config.js')) {
    const mGm = s.match(/[ \t]*<script src="gm-auth\.js[^"]*"><\/script>/);
    if (mGm) s = s.replace(mGm[0], BLOCO_HEAD + '\n' + mGm[0]);
    else     s = s.replace(/<\/head>/i, BLOCO_HEAD + '\n</head>');
  }

  // 2. pwa no fim do body — no ÚLTIMO </body>, nunca no primeiro.
  //    ISTO CUSTOU UM ESTRAGO REAL, medido em 05/08: `.replace(/<\/body>/i, ...)` pega a PRIMEIRA
  //    ocorrencia, e no fpmed_sistema_final.html a primeira `</body>` esta DENTRO da string que
  //    monta o PDF da proposta ('...<\/script></body></html>'). O resultado foi um
  //    <script src="limedtec-pwa.js"> injetado no documento IMPRESSO que vai pro hospital.
  //    O `</body>` de verdade e o ultimo do arquivo — e por isso a busca e de tras pra frente.
  if (!s.includes('limedtec-pwa.js')) {
    const i = s.toLowerCase().lastIndexOf('</body>');
    if (i < 0) { console.log('  SEM </body>  ' + arq + '  (pwa nao ligado)'); }
    else s = s.slice(0, i) + BLOCO_PWA + '\n' + s.slice(i);
  }

  // 3. titulo "LIMEDTEC — FPMED · {sufixo}"
  const novoTitulo = 'LIMEDTEC — FPMED' + (sufixo ? ' · ' + sufixo : '');
  if (!/<title>LIMEDTEC/.test(s)) s = s.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + novoTitulo + '</title>');

  if (s === antes) { pulados++; console.log('  ja ligado  ' + arq); continue; }
  mudados++;
  console.log('  ' + (APLICAR ? 'GRAVADO   ' : 'mudaria   ') + arq + '   -> <title>' + novoTitulo + '</title>');
  if (APLICAR) fs.writeFileSync(p, s);
}
console.log('\n' + mudados + ' arquivo(s) ' + (APLICAR ? 'gravados' : 'a mudar') + ', ' + pulados + ' ja ligado(s).');
if (!APLICAR) console.log('>>> PREVIEW. Rode com --aplicar pra gravar.');
