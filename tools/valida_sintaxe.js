// Valida a SINTAXE do JS embutido nos .html do app (o modo classico de quebrar a tela num porte).
// Nao executa nada: so compila cada <script> inline com vm.Script.
//   node tools/valida_sintaxe.js                -> todos os .html da raiz
//   node tools/valida_sintaxe.js fpmed_giovana.html
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const alvos = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync('C:/fpmed').filter(f => f.endsWith('.html')).map(f => path.join('C:/fpmed', f));

let erros = 0, blocos = 0;
for (const arq of alvos) {
  const html = fs.readFileSync(arq, 'utf8');
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, i = 0, ruins = 0;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '', corpo = m[2] || '';
    i++;
    if (/\bsrc\s*=/.test(attrs)) continue;                    // externo: nada a compilar
    if (/type\s*=\s*["']?(application\/json|text\/template)/i.test(attrs)) continue;
    if (!corpo.trim()) continue;
    blocos++;
    // conta a linha real do bloco no arquivo, pra mensagem util
    const linha = html.slice(0, m.index).split('\n').length;
    try {
      new vm.Script(/\btype\s*=\s*["']?module/i.test(attrs) ? `(async()=>{${corpo}})()` : corpo,
                    { filename: `${path.basename(arq)}:script#${i}@L${linha}` });
    } catch (e) {
      ruins++; erros++;
      console.log(`  ERRO ${path.basename(arq)} script#${i} (linha ~${linha}): ${e.message}`);
    }
  }
  console.log(`  ${ruins ? 'FALHA' : 'ok   '} ${path.basename(arq).padEnd(30)} ${i} bloco(s) <script>`);
}
console.log(`\n${blocos} bloco(s) inline compilado(s), ${erros} erro(s) de sintaxe`);
console.log(erros ? '>>> VERMELHO' : '>>> SINTAXE OK');
process.exit(erros ? 1 : 0);
