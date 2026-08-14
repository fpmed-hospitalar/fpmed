// Confere que a IMPRESSÃO da Proposta ficou IDÊNTICA — a ordem do dono na fatia B8.
//   node tools/confere_impressao_proposta.js <arquivo_antes.html>
// Pra tirar o "antes" de um commit:  git show <sha>:fpmed_giovana.html > antes.html
// Compara as três regiões do papel entre a versão antiga e a atual: o CSS do .print-doc,
// o bloco @media print e a marcação do documento.
const fs = require('fs');
const antes = process.argv[2];
if (!antes) { console.error('uso: node tools/confere_impressao_proposta.js <antes.html>'); process.exit(1); }

// >>> ESTA FUNÇÃO JÁ NASCEU ERRADA UMA VEZ, e o molde_proposta.md avisa: um regex
//     `@media print\{[\s\S]*?\}` casa com o PRIMEIRO @media print (o de uma linha, do selo do
//     teto) e corre até a chave errada, engolindo ~200 linhas de CSS que não são do papel.
//     A leitura correta é por CHAVES BALANCEADAS, escolhendo o bloco pelo que ele CONTÉM.
function blocoPrint(s) {
  const re = /@media print\s*\{/g;
  let m;
  while ((m = re.exec(s))) {
    let i = m.index + m[0].length, prof = 1;
    while (i < s.length && prof > 0) { if (s[i] === '{') prof++; else if (s[i] === '}') prof--; i++; }
    const bloco = s.slice(m.index, i);
    if (bloco.includes('.print-doc')) return bloco;
  }
  return '';
}
function regioes(p) {
  const s = fs.readFileSync(p, 'utf8');
  const css = s.split('\n').filter(l => l.startsWith('.print-doc')).join('\n');
  const mp = blocoPrint(s);
  const i = s.indexOf('<div class="print-doc"');
  const j = s.indexOf('<!-- MODAL MANUAL -->');
  return { css, mediaprint: mp, marcacao: (i >= 0 && j > i) ? s.slice(i, j) : 'NAO_ACHOU' };
}
const a = regioes(antes), b = regioes('C:/fpmed/fpmed_giovana.html');
let dif = 0;
for (const k of ['css', 'mediaprint', 'marcacao']) {
  const igual = a[k] === b[k];
  if (!igual) dif++;
  console.log(`  ${k.padEnd(11)} ${igual ? 'IDENTICO' : '*** MUDOU ***'}  (${a[k].length} chars antes, ${b[k].length} depois)`);
}
console.log(dif ? '\n>>> A IMPRESSAO MUDOU — a fatia B8 proibe isso' : '\n>>> IMPRESSAO INTACTA');
process.exit(dif ? 1 : 0);
