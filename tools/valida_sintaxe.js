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

/* ══ O QUE ESTÁ DENTRO DE <style> NÃO É SCRIPT ═══════════════════════════════════════════════
   ACHADO EM 12/08, e o defeito era DAQUI. Duas telas apareceram "com erro de sintaxe" apontando
   pra uma linha dentro do CSS. O motivo: um COMENTÁRIO de CSS que explica de onde vem uma cor
   escreve a palavra `<script>` no meio da frase — e a varredura, que só procurava a etiqueta,
   passou a ler o CSS inteiro como JavaScript a partir dali.
   >>> O CONSERTO NÃO PODIA SER "não escrever <script> em comentário". Ferramenta que obriga a
       prosa a desviar dela é ferramenta que vai ser desligada — e um validador que acusa erro
       onde não há ensina todo mundo a ignorar o vermelho dele, que é justamente o dia em que
       ele deixa de servir.
   O <style> some ANTES da varredura, trocado por linhas em branco na mesma quantidade: sem
   isso, o número de linha de todo erro seguinte sairia errado — e número de linha errado num
   validador custa mais tempo que o erro que ele achou.

   >>> E A ÂNCORA `^[ \t]*` NÃO É ENFEITE — a 1ª versão disto QUEBROU DUAS TELAS. O Negócios e o
       o sistema_final MONTAM DOCUMENTO PRA IMPRESSÃO dentro do JavaScript, e ali existe a
       string `'<style>'` no meio de uma concatenação. Sem a âncora, a varredura apagava do
       `'<style>'` até o `'</style>'` — ou seja, apagava JAVASCRIPT DE VERDADE — e as duas telas
       passaram a acusar erro de sintaxe que não existia. O conserto do falso positivo criou
       outro falso positivo, em dobro.
       Etiqueta de verdade abre no começo da linha; a que mora dentro de uma string vem depois
       de uma aspa, no meio da concatenação. É essa a diferença que a âncora enxerga. */
const semEstilo = (html) => html.replace(/(^|\n)([ \t]*)<style\b[^>]*>[\s\S]*?<\/style>/gi,
  (bloco, quebra) => quebra + '\n'.repeat((bloco.match(/\n/g) || []).length - (quebra ? 1 : 0)));

let erros = 0, blocos = 0;
for (const arq of alvos) {
  const html = semEstilo(fs.readFileSync(arq, 'utf8'));
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
