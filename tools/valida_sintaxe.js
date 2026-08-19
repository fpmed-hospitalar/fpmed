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

/* ══ E A TERCEIRA VEZ FOI O COMENTÁRIO DE HTML (15/08, fatia B21) ═══════════════════════════════
   Este arquivo já conta a mesma história duas vezes: o `<style>` citado em comentário e o
   `<script>` citado em comentário. Faltava o caso que a âncora `^[ \t]*` **não** enxerga —
   a etiqueta escrita no COMEÇO DE UMA LINHA, DENTRO DE UM COMENTÁRIO DE HTML:

       >>> ELE VEM AQUI, e não no <head>: a injeção é insertAdjacentHTML no próprio
           <script>, então o sprite já está no documento quando o navegador ...

   Aquele `<script>` abre no começo da linha, passa na âncora, e a varredura compila a prosa em
   português que vem depois. Resultado: `fpmed_negocios.html` e `fpmed_giovana.html` estavam
   **VERMELHOS HÁ DIAS** por dois comentários que EXPLICAM consertos — e o vermelho fixo que não
   é erro é o pior estado de uma ferramenta, como o próprio bloco acima já tinha escrito.
   Comentário de HTML não é executado por navegador nenhum: apagá-lo antes da varredura é a
   leitura certa, não uma tolerância.

   >>> A ÂNCORA `^[ \t]*<!--` SOZINHA NÃO SERVE, E EU MEDI ISSO ANTES DE ENTREGAR — era o mesmo
       defeito que esta ferramenta já cometeu uma vez, indo pro terceiro round. O `card()` do
       Negócios monta HTML dentro de um template literal, e lá dentro há **23 comentários de HTML
       começando no início da linha** (o da Proposta tem 3). Apagá-los tira 11.530 caracteres de
       dentro de uma STRING DE JAVASCRIPT — e um `-->` casado com o `<!--` errado leva junto a
       crase que fecha o template. A versão anterior desta ferramenta nasceu de exatamente esse
       erro com o `<style>`; repeti-lo com o comentário seria a terceira vez.
   >>> ENTÃO A REGRA NÃO É ÂNCORA, É ORDEM DE ABERTURA, numa varredura da esquerda pra direita:
       **quem abre primeiro manda.** Comentário aberto ANTES de qualquer `<script>` engole tudo
       até o `-->` (inclusive uma etiqueta `<script>` citada na prosa — que é o defeito que se
       queria matar). E `<script>` aberto antes de qualquer `<!--` protege o corpo inteiro até o
       `</script>` — que é o que salva os 23 comentários de dentro do template literal.
       Isso não é heurística: é a mesma ordem que o navegador usa pra ler o documento.
   >>> Espaços no lugar do que sai, e as quebras de linha mantidas: número de linha errado num
       validador custa mais tempo que o erro que ele achou. */
function semComentarioHTML(html) {
  const reCom = /<!--/g, reScr = /<script\b[^>]*>/gi;
  const branco = (s) => s.replace(/[^\n]/g, ' ');
  let saida = '', i = 0;
  while (i < html.length) {
    reCom.lastIndex = i; reScr.lastIndex = i;
    const c = reCom.exec(html), s = reScr.exec(html);
    if (!c) { saida += html.slice(i); break; }                 // não há mais comentário: o resto é como está
    if (s && s.index < c.index) {                              // o <script> abriu primeiro: corpo intocado
      const fim = html.indexOf('</script>', s.index);
      const ate = fim === -1 ? html.length : fim + 9;
      saida += html.slice(i, ate); i = ate; continue;
    }
    const fim = html.indexOf('-->', c.index + 4);
    if (fim === -1) { saida += html.slice(i); break; }          // comentário sem fecho: não inventa
    saida += html.slice(i, c.index) + branco(html.slice(c.index, fim + 3));
    i = fim + 3;
  }
  return saida;
}

let erros = 0, blocos = 0;
for (const arq of alvos) {
  const html = semComentarioHTML(semEstilo(fs.readFileSync(arq, 'utf8')));
  /* ══ E A ETIQUETA `<script>` PRECISAVA DA MESMA ÂNCORA QUE O `<style>` (achado em 14/08) ═══
     O bloco acima resolveu o falso positivo do `<style>` citado em comentário, e deixou o
     `<script>` com o defeito idêntico. O `fpmed_negocios.html` acusa erro de sintaxe HÁ DIAS
     por causa de um COMENTÁRIO que explica um defeito antigo e escreve, na frase, a palavra
     `<script>`: a varredura abre um bloco ali e passa a compilar PROSA em português.
     >>> E este é o pior estado possível pra uma ferramenta: um vermelho fixo, que não é erro,
         numa tela grande. Ele ensina todo mundo a passar o olho e seguir — e o dia em que
         houver erro de verdade, o vermelho vai estar lá do mesmo jeito, dizendo o mesmo nada.
     Mesma diferença que a âncora do `<style>` enxerga: etiqueta de verdade abre no começo da
     linha; a que mora dentro de uma frase (ou de uma string) vem depois de outra coisa. */
  const re = /(?:^|\n)[ \t]*<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
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
