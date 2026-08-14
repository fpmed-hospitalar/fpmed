/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_papel_congelado.js — O DOCUMENTO IMPRESSO DA PROPOSTA NÃO MUDOU · 14/08/2026

   O papel da Proposta está CONGELADO por ordem da caixa desde a B8. "Congelado" não é uma
   intenção: é uma coisa que dá pra MEDIR. Esta prova recorta as três regiões que fazem o papel
   e compara o que está no disco com o que está numa versão anterior do git, byte a byte.

     · o HTML do `print-doc` (a folha em si: cabeçalho, tabela, rodapé)
     · o CSS de impressão (o `@media print` e o bloco DOCUMENTO DE IMPRESSÃO)
     · a função `gerarPDF` (quem preenche a folha antes do `window.print()`)

   Comparar o ARQUIVO INTEIRO não serviria: toda fatia mexe na tela, e um diff que sempre acusa
   é um diff que ninguém lê. Comparar as três regiões responde a pergunta certa — "o que sai na
   impressora mudou?" — e responde com um sim ou um não.

     node tools/prova_papel_congelado.js [ref-do-git]      (padrão: HEAD)
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const ALVO = 'fpmed_giovana.html';
const REF = process.argv[2] || 'HEAD';

const norm = s => String(s).replace(/\r\n/g, '\n');
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

const REGIOES = {
  'o HTML do papel (print-doc)':
    s => (s.match(/<div class="print-doc" id="print-doc">[\s\S]*?\n<!-- MODAL MANUAL -->/) || [''])[0],
  'o CSS de impressão (@media print + DOCUMENTO DE IMPRESSÃO)':
    s => (s.match(/\/\* PRINT \*\/[\s\S]*?<\/style>/) || [''])[0],
  'gerarPDF (quem preenche a folha)':
    s => (s.match(/function gerarPDF\(\)[\s\S]*?\n\}/) || [''])[0],
};

const antes = norm(execFileSync('git', ['show', REF + ':' + ALVO], { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024 }).toString('utf8'));
const agora = norm(fs.readFileSync(path.join(RAIZ, ALVO), 'utf8'));

console.log(`=== O PAPEL DA PROPOSTA CONTINUA CONGELADO? (${ALVO} · ${REF} -> disco) ===\n`);
let tudoIgual = true;
for (const [nome, corta] of Object.entries(REGIOES)) {
  const a = corta(antes), b = corta(agora);
  /* Região que sumiu do recorte NÃO é "igual": é âncora quebrada, e um assert que passa por
     não ter achado nada é pior que assert nenhum. */
  if (!a.length || !b.length) {
    tudoIgual = false;
    console.log(`  ÂNCORA QUEBRADA  ${nome}  (${a.length} -> ${b.length} chars)`);
    continue;
  }
  const igual = a === b;
  if (!igual) tudoIgual = false;
  console.log(`  ${igual ? 'IDÊNTICA ' : 'MUDOU !!!'}  ${nome}`);
  console.log(`             ${a.length} chars ${hash(a)}  ->  ${b.length} chars ${hash(b)}`);
}
console.log(tudoIgual
  ? '\nRESULTADO: o papel NÃO foi tocado — as três regiões estão byte a byte iguais.'
  : '\nRESULTADO: o papel MUDOU. Se não foi de propósito, desfaça; se foi, a caixa precisa saber.');
process.exitCode = tudoIgual ? 0 : 1;
