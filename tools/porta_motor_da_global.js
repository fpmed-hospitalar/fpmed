// PORTA O MOTOR DE BUSCA DA GLOBAL PRA FPMED — sem trazer a casca (tema/marca).
//
// POR QUE ASSIM, E NAO PELA "OPCAO B" DO SYNC_GLOBAL.md:
// A Opcao B mandava adotar a giovana da Global inteira e reaplicar 49 marcadores de marca. Medi
// antes de fazer, e a conta nao fecha: a giovana da Global e TEMA ESCURO, com 146+ cores escuras
// cravadas no CSS (#0d1b2a 16x, #1e3048 30x, #29b8ff 40x) contra 89 cores no arquivo inteiro da
// FPMED. Adotar o arquivo inteiro escureceria a tela de Propostas — que e exatamente o que o
// BLOCO 5 do proprio SYNC_GLOBAL.md proibe ("a FPMED e tema claro por decisao de marca").
// Os 49 marcadores contavam os valores FPMED presentes no arquivo da FPMED, nao as cores escuras
// presentes no arquivo da Global. Sao coisas diferentes.
//
// O QUE ESTE PORTE FAZ: troca so as DUAS FATIAS DO MOTOR — as mesmas que o
// tools/gera_motor_busca.js da Global extrai pra gerar o motor_busca.js. Medido: essas 1.456
// linhas tem ZERO cor hex, ZERO "GlobalMed", ZERO URL do Supabase deles, ZERO e-mail hardcoded,
// ZERO telefone e ZERO nome de modelo de IA. E logica pura. O risco de rebrand e nulo por
// construcao, nao por revisao.
//
// O QUE ELE PRESERVA: a FPMED nao tem logica propria no motor (conferido: a fatia dela e a versao
// ANTIGA da Global, nao uma variante) — com UMA excecao, o fallback venda_unit_forn no pv(), que
// e da view cotacoes_vendedor da FPMED (vendedor nao recebe custo, recebe o preco ja calculado).
// Esse trecho e reinjetado no pv() novo.
//
//   node tools/porta_motor_da_global.js           -> gera a previa em tools/_previa_giovana.html
//   node tools/porta_motor_da_global.js --aplicar -> grava no fpmed_giovana.html (com backup)
'use strict';
const fs = require('fs');
const GLOBAL = 'C:/globalmed/globalmed_giovana.html';   // C:\globalmed e SO LEITURA (regra master)
const FPMED  = 'C:/fpmed/fpmed_giovana.html';
const PREVIA = 'C:/fpmed/tools/_previa_giovana.html';

const rd = p => fs.readFileSync(p, 'utf8');
const linhas = p => rd(p).split(/\r?\n/);

function faixa(L, ini, fim) {
  const s = L.findIndex(x => x.includes(ini));
  if (s < 0) throw new Error('ancora inicial nao achada: ' + ini);
  let e = -1; for (let i = s + 1; i < L.length; i++) { if (L[i].includes(fim)) { e = i; break; } }
  if (e < 0) throw new Error('ancora final nao achada: ' + fim);
  return { s, e };   // [s, e) — o fim NAO entra
}

// o trecho da FPMED que precisa sobreviver ao porte
const TRECHO_VENDEDOR = [
  '',
  '  // VENDEDOR (view cotacoes_vendedor): não recebe custo; recebe o preço de venda já calculado.',
  '  // ISTO É DA FPMED — não existe na Global (lá o gate é por e-mail, aqui é por cargo).',
  '  // Reinjetado pelo tools/porta_motor_da_global.js a cada sync; se sumir, o vendedor perde preço.',
  '  if (c.venda_unit_forn && parseFloat(c.venda_unit_forn) > 0) {',
  '    return parseFloat(c.venda_unit_forn);',
  '  }'
].join('\n');

const G = linhas(GLOBAL), F = linhas(FPMED);
const gA = faixa(G, 'function _undNum(und)', 'let searchTO');
const gB = faixa(G, 'const _bmStrip = s =>', 'busca antiga');
const fA = faixa(F, 'function _undNum(und)', 'let searchTO');
const fB = faixa(F, 'const _bmStrip = s =>', 'busca antiga');

let novaA = G.slice(gA.s, gA.e).join('\n');
// reinjeta o fallback do vendedor logo ANTES do fallback final do pv()
const marcaFallback = '  // Fallback';
if (novaA.indexOf(marcaFallback) < 0) throw new Error('nao achei o ponto de reinjecao no pv() da Global');
novaA = novaA.replace(marcaFallback, TRECHO_VENDEDOR + '\n' + marcaFallback);
const novaB = G.slice(gB.s, gB.e).join('\n');

// declaracoes que a fatia B espera e que a FPMED ainda nao tem
const faltantes = [];
const txtF = rd(FPMED);
if (!/let\s+_bmClasseB/.test(txtF)) faltantes.push('let _bmClasseB = new Set();   // classe CMED (COMPLEXO_B) — preenchida pelo carregarCmed');
if (!/_packColunaAtual/.test(txtF)) faltantes.push('let _packColunaAtual = null;  // pack lido da COLUNA do pedido em tabela (usado pelos avisos)');

// monta o arquivo novo (B primeiro, pra nao invalidar os indices de A)
let out = F.slice();
out.splice(fB.s, fB.e - fB.s, novaB);
out.splice(fA.s, fA.e - fA.s, novaA);
if (faltantes.length) out.splice(fA.s, 0, '// ── declarações que o motor portado espera (add pelo porta_motor_da_global.js) ──', ...faltantes);
const texto = out.join('\n');

fs.writeFileSync(PREVIA, texto);
console.log('══ PORTE DO MOTOR (previa) ══');
console.log('   fatia A: FPMED ' + (fA.e - fA.s) + ' -> Global ' + (gA.e - gA.s) + ' linhas  (+ trecho do vendedor reinjetado)');
console.log('   fatia B: FPMED ' + (fB.e - fB.s) + ' -> Global ' + (gB.e - gB.s) + ' linhas');
console.log('   declaracoes adicionadas: ' + (faltantes.length ? faltantes.length : 'nenhuma'));
faltantes.forEach(l => console.log('      + ' + l.split('=')[0].trim()));

// ── CONFERENCIA DE REBRAND: nada da Global pode ter entrado ──
const proibido = [
  ['URL do Supabase da Global', /vikewlbhkrikcalzsbeb/g],
  ['nome GlobalMed',           /GlobalMed|GLOBALMED/g],
  ['telefone da Global',       /99612-7968/g],
  ['e-mail hardcoded',         /isadora|lemuelempresas/gi],
  ['cor escura #0d1b2a',       /#0d1b2a/gi],
  ['cor escura #1e3048',       /#1e3048/gi],
  ['ciano da Global #29b8ff',  /#29b8ff/gi],
];
console.log('\n══ CONFERENCIA DE REBRAND NA PREVIA ══');
let sujo = 0;
const antes = txtF;
for (const [nome, re] of proibido) {
  const nA = (antes.match(re) || []).length, nD = (texto.match(re) || []).length;
  const pior = nD > nA;
  if (pior) sujo++;
  console.log('   ' + (pior ? '✗' : '✓') + ' ' + nome.padEnd(28) + ' antes:' + String(nA).padStart(3) + '  depois:' + String(nD).padStart(3)
    + (pior ? '   <<< O PORTE TROUXE' : ''));
}
// e o que e da FPMED tem que continuar la
const exigido = [['FPMED', /FPMED/g], ['Supabase FPMED', /xzdowrksuswekwffoluk/g], ['telefone FPMED', /3290-4241/g],
                 ['tema claro (navy)', /#173A5E/gi], ['venda_unit_forn', /venda_unit_forn/g]];
console.log('\n══ O QUE E DA FPMED CONTINUA? ══');
for (const [nome, re] of exigido) {
  const nA = (antes.match(re) || []).length, nD = (texto.match(re) || []).length;
  const perdeu = nD < nA;
  if (perdeu) sujo++;
  console.log('   ' + (perdeu ? '✗' : '✓') + ' ' + nome.padEnd(28) + ' antes:' + String(nA).padStart(3) + '  depois:' + String(nD).padStart(3)
    + (perdeu ? '   <<< O PORTE APAGOU' : ''));
}

if (!process.argv.includes('--aplicar')) {
  console.log('\n' + (sujo ? '>>> ' + sujo + ' PROBLEMA(S) — nao aplicar assim.' : '>>> previa limpa. Rodar com --aplicar pra gravar.'));
  console.log('    previa em: ' + PREVIA);
  process.exitCode = sujo ? 1 : 0;
  return;
}
if (sujo) { console.log('\n>>> RECUSANDO APLICAR: ' + sujo + ' problema(s) de rebrand acima.'); process.exitCode = 1; return; }
const bkp = 'C:/fpmed/backups/fpmed_giovana_antes_porte_motor.html';
try { fs.mkdirSync('C:/fpmed/backups', { recursive: true }); } catch (e) {}
fs.writeFileSync(bkp, antes);
fs.writeFileSync(FPMED, texto);
console.log('\n>>> APLICADO. backup em ' + bkp);
