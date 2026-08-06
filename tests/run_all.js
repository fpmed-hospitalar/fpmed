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

// >>> AS SUITES DE BANCO NAO RODAM AQUI, E ISSO PRECISA APARECER (06/08/2026).
//     Elas exigem rede + a DB_PASSWORD do segredos.local.txt, entao este runner, que e offline,
//     nunca as chamou. O problema nao era esse — era o SILENCIO: em 06/08 a tabela `perfis`
//     ficou SEM RLS e LEGIVEL PELA ANON num repo publico, e o guard que pega exatamente isso
//     (tests/db/testa_rls_cobertura.js) ja existia e estava verde por nao ter sido chamado.
//     "TUDO VERDE" sem esta lista se le como "conferi tudo", e nao era verdade.
try {
  const dbDir = path.join(dir, 'db');
  const dbs = fs.readdirSync(dbDir).filter(f => /^testa_.*\.js$/.test(f)).sort();
  if (dbs.length) {
    console.log('\n>>> NAO RODADAS AQUI (exigem banco + segredos): ' + dbs.length + ' suite(s) em tests/db/');
    for (const d of dbs) console.log('      node tests/db/' + d);
    console.log('    Rode-as antes de dizer que o sistema esta conferido — em especial a');
    console.log('    testa_rls_cobertura, que e a que pega tabela aberta pro anon.');
  }
} catch (e) { console.log('\n>>> nao consegui listar tests/db (' + e.message + ')'); }

process.exitCode = suitesFail ? 1 : 0;
