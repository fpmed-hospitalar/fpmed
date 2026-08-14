// Mutação da fatia B8: desfaz UMA mudança de cada vez e cobra que a testa_molde_proposta
// FIQUE VERMELHA. Assert que não fica vermelho quando o defeito volta não guarda nada.
//   node tools/muta_molde_proposta.js
// Trabalha numa CÓPIA da árvore (pasta temporária): não toca no repositório.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

const raiz = 'C:/fpmed';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mutab8-'));

// TUDO que a suite le, tirado da propria suite: harness que esquece um arquivo faz a suite
// CRASHAR, e crash conta como vermelho — ou seja, TODA mutacao passaria a "ser barrada".
// Foi exatamente o que aconteceu na 1a versao disto: 12 de 12 barradas, e nenhuma de verdade.
const SUITE = fs.readFileSync(path.join(raiz, 'tests/testa_molde_proposta.js'), 'utf8');
const lidos = [...new Set([...SUITE.matchAll(/R\('([^']+)'\)/g)].map(m => m[1]))];
for (const f of lidos) {
  const dest = path.join(tmp, f);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(raiz, f), dest);
}
fs.mkdirSync(path.join(tmp, 'tests'), { recursive: true });
const G0 = fs.readFileSync(path.join(raiz, 'fpmed_giovana.html'), 'utf8');
fs.writeFileSync(path.join(tmp, 'tests/suite.js'), SUITE);

// ── CONTROLE: sem mutacao, a suite TEM de estar verde aqui dentro. Sem esta conferencia o
//    harness nao sabe distinguir "o assert pegou" de "o harness esta quebrado".
try {
  const c = cp.execSync(`node "${path.join(tmp, 'tests/suite.js')}"`, { encoding: 'utf8' });
  console.log('  CONTROLE  suite sem mutacao: ' + (c.match(/RESULTADO:[^\n]*/) || ['?'])[0]);
} catch (e) {
  console.error('>>> HARNESS QUEBRADO: a suite ja falha SEM mutacao. Nada abaixo valeria nada.');
  console.error(((e.stdout || '') + (e.stderr || '')).split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}

// cada mutação = [nome, de, para] — o "de" é o que está no ar hoje
const MUTS = [
  ['selo de variacao volta pro hex vermelho', `up ? 'var(--vermelho)'`, `up ? '#e0483d'`],
  ['selo de variacao volta pro hex verde', `: 'var(--verde-700)';`, `: '#16c060';`],
  ['selo de variacao volta pro verde da MARCA (branco por cima 2,04:1)', `: 'var(--verde-700)';`, `: 'var(--verde-500)';`],
  ['MKP volta pro hex verde', `tinta:'var(--sinal-bom-tinta)'`, `tinta:'#22c55e'`],
  ['MKP volta pro truque do alfa grudado', `background:\${mkp.fundo};color:\${mkp.tinta};`, `background:\${mkp.tinta}22;color:\${mkp.tinta};`],
  ['MKP volta a ter DUAS listas (o recalculo desalinha)', `  const mkp = corMkp(margem);   // a MESMA`, `  const mkp = { fundo:'var(--sinal-normal-fundo)', tinta:'var(--sinal-normal-tinta)' };   // a MESMA`],
  ['veu volta pro preto puro', `background:var(--veu);z-index:200`, `background:rgba(0,0,0,0.7);z-index:200`],
  ['fundo do modal volta pro #fff', `<div style="background:var(--card);border-radius:16px;padding:24px;width:480px`, `<div style="background:#fff;border-radius:16px;padding:24px;width:480px`],
  ['input do import volta pro #fff', `sans-serif;background:var(--card);color:var(--texto)"`, `sans-serif;background:#fff;color:var(--texto)"`],
  ['btn-danger volta pro white nu', `.btn-danger{background:var(--vermelho);color:var(--branco);}`, `.btn-danger{background:var(--vermelho);color:white;}`],
  ['toast volta pro white nu', `background:var(--navy);color:var(--branco);z-index:999`, `background:var(--navy);color:white;z-index:999`],
  ['*** o PAPEL e tokenizado (o dono proibiu) ***', `.print-doc .doc-pagina{font-size:10px;text-align:right;color:#4A5B6B;}`, `.print-doc .doc-pagina{font-size:10px;text-align:right;color:var(--muted);}`],
];

let barradas = 0, escaparam = [];
for (const [nome, de, para] of MUTS) {
  if (!G0.includes(de)) { escaparam.push(nome + '  (ANCORA NAO ENCONTRADA — a mutacao nem foi aplicada)'); continue; }
  fs.writeFileSync(path.join(tmp, 'fpmed_giovana.html'), G0.replace(de, para));
  let vermelho = false, saida = '';
  try { saida = cp.execSync(`node "${path.join(tmp, 'tests/suite.js')}"`, { encoding: 'utf8' }); }
  catch (e) { vermelho = true; saida = (e.stdout || '') + (e.stderr || ''); }
  if (vermelho) { barradas++; console.log('  BARRADA   ' + nome + '   -> ' + ((saida.match(/FALHA [^\n]*/g) || ['?'])[0]).slice(0, 72)); }
  else { escaparam.push(nome); console.log('  ESCAPOU   ' + nome); }
}
fs.writeFileSync(path.join(tmp, 'fpmed_giovana.html'), G0);
console.log(`\nMUTACAO: ${barradas} de ${MUTS.length} barradas`);
if (escaparam.length) { console.log('>>> ESCAPARAM:'); escaparam.forEach(e => console.log('    - ' + e)); }
process.exitCode = escaparam.length ? 1 : 0;
