// Roda TODAS as suites de tests/ e agrega. Uso: node tests/run_all.js
// Cada suite extrai as funcoes REAIS dos .html do app (nao recopia) e sai com exitCode!=0 se falhar.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const suites = fs.readdirSync(dir).filter(f => /^testa_.*\.js$/.test(f)).sort();
let totalOk = 0, totalFail = 0, suitesFail = 0;
console.log('═══ SUITES FPMED (' + suites.length + ') ═══\n');
for (const s of suites) {
  try {
    const out = execSync('node ' + JSON.stringify(path.join(dir, s)), { encoding: 'utf8' });
    const m = out.match(/RESULTADO:\s*(\d+)\s*ok,\s*(\d+)\s*falha/);
    const ok = m ? +m[1] : 0, fl = m ? +m[2] : 0;
    totalOk += ok; totalFail += fl; if (fl) suitesFail++;
    console.log('  ' + (fl ? '✗' : '✓') + ' ' + s.padEnd(22) + ok + ' ok' + (fl ? ', ' + fl + ' FALHA' : ''));
  } catch (e) {
    suitesFail++; totalFail++;
    const out = (e.stdout || '') + (e.stderr || '');
    const m = out.match(/RESULTADO:\s*(\d+)\s*ok,\s*(\d+)\s*falha/);
    if (m) { totalOk += +m[1]; totalFail += (+m[2] - 1); console.log('  ✗ ' + s.padEnd(22) + m[1] + ' ok, ' + m[2] + ' FALHA'); }
    else console.log('  ✗ ' + s.padEnd(22) + 'ERRO: ' + out.trim().split('\n').pop());
  }
}
console.log('\n───────────────────────────────');
console.log('TOTAL: ' + totalOk + ' asserts ok, ' + totalFail + ' falha(s) em ' + suites.length + ' suites');
console.log(suitesFail ? '>>> ' + suitesFail + ' SUITE(S) COM FALHA' : '>>> TUDO VERDE');
process.exitCode = suitesFail ? 1 : 0;
