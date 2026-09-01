// SUITE testa_pdfjs_eval — TODO getDocument() TEM QUE DESLIGAR O eval.
//
// 01/09/2026 (A49). Nasceu de um susto que terminou bem, e é por isso que vira catraca.
//
// O QUE ACONTECEU: o GitHub avisou 11 vulnerabilidades no push. Fui olhar e descobri que as
// cinco telas que leem PDF carregam **pdf.js 3.11.174 do CDN** — uma versão atingida pela
// CVE-2024-4367, em que um PDF preparado por terceiro consegue **executar JavaScript no
// navegador de quem abre**. Corrigida no pdf.js só a partir da 4.2.67.
//
// >>> POR QUE ISSO MORDE AQUI E NÃO É TEORIA: as telas que leem PDF (edital_ia, conferidor,
//     negocios, sistema_final) leem **edital que vem de portal de licitação** — arquivo de
//     origem externa, que ninguém desta casa produziu. É exatamente o cenário da CVE.
//
// A BOA NOTÍCIA, MEDIDA: as cinco chamadas já passam `isEvalSupported: false`, que é a
// mitigação oficial da própria CVE. Ninguém está exposto hoje.
//
// >>> ENTÃO POR QUE ESTE ARQUIVO EXISTE: porque isso está certo por HÁBITO, não por REGRA.
//     Nada impede a sexta chamada de nascer sem o parâmetro — e ela nasceria silenciosa, com
//     o mesmo aspecto das outras cinco, num arquivo de 500 KB. Segurança que depende de
//     alguém lembrar não é segurança; é sorte com prazo de validade.
//     A catraca troca a lembrança por falha de suíte.
//
//   node tests/testa_pdfjs_eval.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_pdfjs_eval — nenhum PDF de terceiro executa script aqui\n');

// Descoberto no diretório, não escrito à mão: uma tela nova que leia PDF entra nesta conta
// sozinha. Lista cravada envelheceria do mesmo jeito que a lista de tabelas do backup.
const telas = fs.readdirSync(raiz).filter(a => a.endsWith('.html'));

const achadas = [];      // toda chamada getDocument( do projeto
const semGuarda = [];    // as que não desligam o eval
const versoes = new Set();

for (const arq of telas) {
  const src = fs.readFileSync(path.join(raiz, arq), 'utf8');

  for (const m of src.matchAll(/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/([0-9.]+)\//g)) versoes.add(m[1]);

  // pega getDocument( ... ) e olha o que vai dentro dos parênteses. 400 caracteres cobrem
  // com folga o objeto de opções sem atravessar para a próxima instrução.
  for (const m of src.matchAll(/getDocument\s*\(([\s\S]{0,400}?)\)\s*\.promise/g)) {
    const linha = src.slice(0, m.index).split('\n').length;
    const onde = `${arq}:${linha}`;
    achadas.push(onde);
    if (!/isEvalSupported\s*:\s*false/.test(m[1])) semGuarda.push(onde);
  }
}

ok('1. o projeto tem chamadas de leitura de PDF para conferir (senão a catraca é decorativa)',
  achadas.length > 0, achadas.length);

// ═══════ A CATRACA ═══════
// Se esta linha falhar: a chamada apontada aceita PDF de terceiro com o eval do pdf.js LIGADO.
// O conserto é uma palavra — acrescente `isEvalSupported: false` no objeto de opções, como
// nas outras. Não desative este teste; ele é a única coisa que separa o edital de um script.
ok('2. *** TODA chamada getDocument passa isEvalSupported:false (CVE-2024-4367) ***',
  semGuarda.length === 0, semGuarda);

// ═══════ O LEMBRETE DE VERSÃO ═══════
// Não falha o build: o `isEvalSupported:false` já segura a CVE, e subir major de pdf.js no
// CDN é decisão do dono, não de uma suíte. Mas fica registrado, com número, para a conversa
// acontecer com dado em vez de memória.
const VULN = '3.11.174', SEGURA = '4.2.67';
if (versoes.has(VULN)) {
  console.log(`\n  AVISO (não é falha): o CDN serve pdf.js ${VULN} em ${[...versoes].length} versão(ões) declarada(s).`);
  console.log(`  A CVE-2024-4367 só é corrigida na ${SEGURA}. Hoje quem segura é o isEvalSupported:false`);
  console.log(`  desta suíte — ou seja, a defesa é de uma camada só. Subir o CDN daria a segunda.`);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
