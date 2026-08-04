// Porta as SUITES da Global que testam SO O MOTOR (as duas fatias que a FPMED acabou de receber).
// Sem elas o motor novo chega aqui sem rede de protecao: a FPMED tinha 110 asserts, a Global tem
// 1.926 — e a diferenca e quase toda regressao de casamento, que e o que acabou de ser portado.
//
// FICAM DE FORA, de proposito, as suites que testam a CASCA da Global (cabecalho, abas, gerarPDF,
// painel de conferencia) e as que dependem de trechos que NAO foram portados (_parseLinhaQtd e
// _addLinhaAoOrcamento vivem numa terceira regiao do arquivo, fora das duas fatias do motor).
// Portar essas quebraria por falta de contexto, nao por bug — e teste que quebra por motivo errado
// vira teste desligado.
//
//   node tools/porta_suites_da_global.js            -> previa (diz quais passam)
//   node tools/porta_suites_da_global.js --aplicar  -> grava em tests/
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const GT = 'C:/globalmed/tests', FT = 'C:/fpmed/tests';
const SUITES = [
  'testa_bug5_concentracao.js',   // aritmetica de concentracao + de-para + guardas
  'testa_mono_x_combo.js',        // monodroga nao recebe associacao
  'testa_num_discriminador.js',   // calibre / vias / medida
  'testa_tripla_onco.js',         // tripla PA+dose+volume e desempate por preco
  'testa_pedido_sem_dose.js',     // o volume como discriminador
  'testa_caixa_sem_pack.js',      // preco de caixa nao vira unitario
  'testa_dose_total.js',          // dose total = concentracao x volume
  'testa_indice.js',              // o indice nao muda nenhuma resposta
];
const aplicar = process.argv.includes('--aplicar');
let ok = 0, falhou = 0;
for (const s of SUITES) {
  const src = path.join(GT, s);
  if (!fs.existsSync(src)) { console.log('  — ' + s + ': nao existe na Global'); continue; }
  // a unica adaptacao: o caminho do HTML que a suite fatia
  let txt = fs.readFileSync(src, 'utf8').replace(/globalmed_giovana\.html/g, 'fpmed_giovana.html');
  const dst = path.join(FT, s);
  const tmp = path.join(FT, '_tmp_' + s);
  fs.writeFileSync(tmp, txt);
  let saida = '', code = 0;
  try { saida = cp.execSync('node ' + JSON.stringify(tmp), { encoding: 'utf8' }); }
  catch (e) { saida = (e.stdout || '') + (e.stderr || ''); code = 1; }
  const m = saida.match(/RESULTADO:\s*(\d+)\s*ok,\s*(\d+)\s*falha/);
  const passou = m && +m[2] === 0 && code === 0;
  console.log('  ' + (passou ? '✓' : '✗') + ' ' + s.padEnd(30) + (m ? (m[1] + ' ok, ' + m[2] + ' falha') : 'ERRO: ' + saida.trim().split('\n').pop().slice(0, 70)));
  if (passou) { ok++; if (aplicar) fs.renameSync(tmp, dst); else fs.unlinkSync(tmp); }
  else { falhou++; fs.unlinkSync(tmp); }
}
console.log('\n' + ok + ' suite(s) passam na FPMED · ' + falhou + ' nao passam (ficam de fora)');
console.log(aplicar ? '>>> as que passam foram gravadas em tests/' : '>>> previa. Rodar com --aplicar pra gravar as que passam.');
