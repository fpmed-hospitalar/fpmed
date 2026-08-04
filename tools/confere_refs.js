// Confere que cada simbolo usado no boot da tela EXISTE (definido) no proprio arquivo.
// Nasceu de um susto real: as chamadas de _fpOpcional entraram no arquivo antes da funcao, e o
// boot teria estourado ReferenceError na primeira abertura — sem teste nenhum acusar, porque as
// suites fatiam o MOTOR e nao passam pelo boot.
//   node tools/confere_refs.js [arquivo.html]
'use strict';
const fs = require('fs');
const ARQ = process.argv[2] || 'C:/fpmed/fpmed_giovana.html';
const h = fs.readFileSync(ARQ, 'utf8');
const alvos = ['_fpOpcional', 'carregarCmed', 'carregarDicMarcaPa', 'carregarVariacoes',
               '_bmClasseB', '_packColunaAtual', 'buscarMelhorProduto', 'incluiNaBusca',
               'pv', 'qtdEmbalagem', '_bmIdxCandidatos', '_bmDoses'];
let ruim = 0;
console.log('simbolo                  definido   usos');
for (const n of alvos) {
  const def = new RegExp('(?:function|let|const|var)\\s+' + n + '\\b').test(h);
  const usos = (h.match(new RegExp('\\b' + n + '\\s*\\(', 'g')) || []).length;
  if (!def && usos) ruim++;
  console.log('  ' + n.padEnd(22) + (def ? 'sim' : 'NAO').padEnd(10) + usos + (!def && usos ? '   <<< USADO SEM DEFINIR' : ''));
}
console.log(ruim ? '\n>>> ' + ruim + ' SIMBOLO(S) USADO(S) SEM DEFINICAO' : '\n>>> todos os simbolos do boot existem');
process.exitCode = ruim ? 1 : 0;
