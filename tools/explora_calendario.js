// EXPLORA o Calendario 2025.xlsm — 100% SO LEITURA. Nao grava nada, nao toca no banco.
// Planilha de 50MB com macros: mapeia abas (inclusive OCULTAS), colunas, linhas e amostra.
//   node tools/explora_calendario.js
'use strict';
const fs = require('fs');
const XLSX = require('xlsx');

const ARQ = 'C:/fpmed/Calendario 2025.xlsm';
console.log('\n══ EXPLORACAO (so leitura) ══');
console.log('arquivo: ' + ARQ + '  ·  ' + (fs.statSync(ARQ).size/1048576).toFixed(1) + ' MB\n');

// LIMITE DE LINHAS — medido em 05/08: ler o workbook inteiro deste arquivo (49,7 MB, com macro)
// passa de 15 MINUTOS sem terminar. O custo está no parse de CÉLULA, não no unzip. Com
// sheetRows a leitura para na linha N de cada aba e o arquivo abre em segundos.
// A dimensão VERDADEIRA não se perde: quando sheetRows trunca, o SheetJS guarda o range
// original em `!fullref` — é de lá que sai a contagem real de linhas/colunas abaixo.
const AMOSTRA_LINHAS = 25;
const t0 = Date.now();
const wb = XLSX.readFile(ARQ, { sheetRows:AMOSTRA_LINHAS, cellFormula:false, cellHTML:false,
                                cellStyles:false, cellNF:false, cellText:false, sheetStubs:false });
console.log('lido em ' + ((Date.now()-t0)/1000).toFixed(1) + 's (amostra de ' + AMOSTRA_LINHAS + ' linhas por aba)\n');

console.log('abas: ' + wb.SheetNames.length);
// abas ocultas ficam no Workbook.Sheets[i].Hidden (0=visivel, 1=oculta, 2=muito oculta)
const meta = (wb.Workbook && wb.Workbook.Sheets) || [];
const oculta = i => { const h = meta[i] && meta[i].Hidden; return h===1?'OCULTA':h===2?'MUITO OCULTA':'visivel'; };
console.log('macros (vbaraw presente): ' + (wb.vbaraw ? 'SIM' : 'nao') + '\n');

wb.SheetNames.forEach((nome, i) => {
  const ws = wb.Sheets[nome];
  const ref = ws['!ref'];
  if (!ref) { console.log(`─ [${i}] "${nome}"  (${oculta(i)})  VAZIA`); return; }
  // !fullref = dimensão REAL da aba (existe quando o sheetRows truncou a leitura)
  const refReal = ws['!fullref'] || ref;
  const r = XLSX.utils.decode_range(refReal);
  const linhas = r.e.r - r.s.r + 1, colunas = r.e.c - r.s.c + 1;
  console.log(`─ [${i}] "${nome}"  (${oculta(i)})  ${linhas} linhas × ${colunas} colunas  [${refReal}]`);

  // cabecalho: 1a linha nao-vazia
  const grade = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:true, blankrows:false, range:0 });
  const head = (grade.find(l => l.filter(Boolean).length >= 2) || []).map(c => String(c).trim()).filter(Boolean);
  if (head.length) console.log('   colunas: ' + head.slice(0,18).join(' | ') + (head.length>18 ? ` … (+${head.length-18})` : ''));

  const hi = grade.findIndex(l => l.filter(Boolean).length >= 2);
  const amostra = grade.slice(hi+1).filter(l => l.filter(Boolean).length).slice(0,5);
  amostra.forEach((l,k) => console.log(`   ex${k+1}: ` + l.slice(0,8).map(c=>String(c).slice(0,26)).join(' | ')));
  if (!amostra.length) console.log('   (sem linhas de dado abaixo do cabecalho)');
  console.log('');
});
console.log('NADA foi gravado. Proximo passo: propor destino e esperar OK do Lemuel.\n');
