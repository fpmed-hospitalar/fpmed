// ============================================================================================
// prova_trava_cmed.js — PROVA que a rotina mensal da CMED PARA quando o layout muda, e que ela
// NAO para quando o cabecalho so anda de linha.
//
// ══ POR QUE UMA PROVA, E NAO SO UM ASSERT DE TEXTO ══════════════════════════════════════════
// A suite le o arquivo e confere que a mensagem de parada existe. Isso prova que a MENSAGEM
// existe — nao que ela dispara. Uma trava que nunca e exercitada e uma trava que ninguem sabe se
// funciona, e esta em particular so seria testada de verdade no mes em que a ANVISA mudar a
// planilha: o pior dia possivel pra descobrir que ela nao pegava.
// Entao aqui as planilhas defeituosas sao FABRICADAS a partir das reais, numa pasta temporaria,
// e o comando e rodado de verdade contra elas.
//
// >>> O TERCEIRO CASO E O QUE IMPORTA TANTO QUANTO OS DOIS PRIMEIROS: cabecalho 10 linhas mais
//     abaixo tem que SEGUIR. Uma trava que para com isso seria um falso positivo TODO MES — e
//     alarme que toca a toa e alarme que se aprende a ignorar.
//
// NAO TOCA NAS PLANILHAS ORIGINAIS e nao grava nada no banco (roda sem --apply).
//   node tools/prova_trava_cmed.js
// ============================================================================================
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const XLSX = require(path.join(RAIZ, 'node_modules', 'xlsx'));

const TMP = path.join(os.tmpdir(), 'fpmed_prova_cmed');
fs.mkdirSync(TMP, { recursive: true });

const SITE = path.join(RAIZ, fs.readdirSync(RAIZ).filter(f => /^xls_conformidade_site.*\.xlsx$/i.test(f))[0] || '');
const GOV = fs.readdirSync(RAIZ).filter(f => /^xls_conformidade_gov.*\.xlsx$/i.test(f))[0];
if (!GOV || !fs.existsSync(SITE)) {
  console.error('as duas planilhas da CMED precisam estar em C:\\fpmed pra esta prova rodar.');
  process.exit(1);
}

function carrega(p) {
  const wb = XLSX.readFile(p);
  return { wb, rows: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) };
}
function grava(rows, destino) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Plan1');
  XLSX.writeFile(wb, destino);
}
function achaHeader(rows) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (Array.isArray(r) && r.filter(Boolean).length > 8 && r.some(c => /^SUBST/i.test(String(c)))) return i;
  }
  return -1;
}

console.log('lendo as planilhas reais...');
const g = carrega(path.join(RAIZ, GOV));
const hi = achaHeader(g.rows);
console.log('header do gov na linha ' + (hi + 1));

// DEFEITO 1: a coluna "PMVG 19 %" some (renomeada). E o cenario que o Lemuel nomeou.
const d1 = g.rows.map(r => Array.isArray(r) ? r.slice() : r);
const iPmvg = d1[hi].findIndex(c => /^PMVG 19\s*%?$/i.test(String(c || '').replace(/\s+/g, ' ').trim()));
console.log('PMVG 19 % estava na coluna ' + (iPmvg + 1) + ' — renomeando pra "PMVG 19,5 %"');
d1[hi][iPmvg] = 'PMVG 19,5 %';
grava(d1, TMP + '/xls_conformidade_gov_SEM_PMVG19.xlsx');

// DEFEITO 2: some o "Publicada em" do topo — sem ele nao da pra saber que regua e essa.
const d2 = g.rows.map(r => Array.isArray(r) ? r.slice() : r);
for (let i = 0; i < Math.min(60, d2.length); i++) {
  if (Array.isArray(d2[i]) && /Publicada em/.test(String(d2[i][0] || ''))) d2[i][0] = 'Lista de precos';
}
grava(d2, TMP + '/xls_conformidade_gov_SEM_DATA.xlsx');

// DEFEITO 3: o cabecalho MUDA DE LINHA (10 linhas a mais no topo). Isto NAO pode parar nada —
// a ancora acha o cabecalho onde ele estiver, e parar aqui seria um falso positivo mensal.
const d3 = [];
for (let i = 0; i < 10; i++) d3.push(['(linha institucional nova ' + i + ')']);
g.rows.forEach(r => d3.push(Array.isArray(r) ? r.slice() : r));
grava(d3, TMP + '/xls_conformidade_gov_HEADER_MOVIDO.xlsx');

const CASOS = [
  ['coluna PMVG 19 % renomeada', TMP + '/xls_conformidade_gov_SEM_PMVG19.xlsx', true],
  ['sem "Publicada em" no topo', TMP + '/xls_conformidade_gov_SEM_DATA.xlsx', true],
  ['cabecalho 10 linhas mais abaixo', TMP + '/xls_conformidade_gov_HEADER_MOVIDO.xlsx', false],
];

let erros = 0;
console.log('');
for (const [nome, arq, deveParar] of CASOS) {
  let parou = false, saida = '';
  try {
    saida = execFileSync(process.execPath,
      [path.join(__dirname, 'atualiza_cmed.js'), '--site', SITE, '--gov', arq],
      { encoding: 'utf8' });
  } catch (e) { parou = true; saida = String(e.stdout || '') + String(e.stderr || ''); }
  const certo = parou === deveParar;
  if (!certo) erros++;
  console.log((certo ? '  OK   ' : '  ERRO ') + nome + ' -> ' + (parou ? 'PAROU' : 'seguiu')
    + '  (esperado: ' + (deveParar ? 'PARAR' : 'seguir') + ')');
  const motivo = (saida.match(/⛔ ([^\n]+)/) || [])[1];
  if (motivo) console.log('         motivo: ' + motivo.trim().slice(0, 120));
}
console.log('\n' + (erros ? erros + ' caso(s) errado(s)' : 'os 3 casos se comportaram como o desenho manda'));
process.exit(erros ? 1 : 0);
