/* ════════════════════════════════════════════════════════════════════════════════════════════
   muta_prazo_a33.js — A PROVA DE QUE A testa_preenche_prazo SABE FICAR VERMELHA (A33, 19/08/2026)

   A suíte `tests/testa_preenche_prazo.js` passou 18 de 18 na primeira execução. Suíte que nasce
   verde é suspeita por definição — ela pode estar guardando as três decisões do condutor ou
   pode estar afirmando o óbvio de um jeito que nenhuma quebra alcança. Só a mutação separa os
   dois, e é a mesma lei que pegou o defeito 10 da régua visual: *verde de quem não olhou é
   indistinguível de verde de quem conferiu.*

   As quatro mutações miram as quatro decisões, uma a uma. Cada uma diz qual ASSERT tem de cair
   — não basta "a suíte ficou vermelha": suíte que fica vermelha pelo assert errado prova que
   outra coisa quebrou.

     node tools/muta_prazo_a33.js
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const ALVO = path.join(RAIZ, 'tools', 'preenche_prazo.js');

const MUTACOES = [
  { nome: 'a taxa passa a contar as linhas da BUSCA',
    de: "    if (l._coleta === 'busca') continue;          // a busca não traz o campo: não é amostra",
    para: '    // (mutado)',
    assertsQueCaem: [1, 2],
    porque: 'e o zero que se alimenta de si mesmo: a modalidade 6 sairia com 7,4% em vez de '
      + '100%, e o condutor deixaria de pedir justamente o que da para preencher' },

  { nome: 'o alvo passa a repescar quem ja veio da porta certa',
    de: "    if (l._coleta !== 'busca') { jaPerguntamos++; continue; }",
    para: '    if (false) { jaPerguntamos++; continue; }',
    assertsQueCaem: [4, 5],
    porque: 'sao 2.882 linhas as quais o PNCP JA respondeu "nao tenho" — repeti-las e gastar '
      + 'requisicao contra portal publico para nao mudar um campo' },

  { nome: 'a amostra curta passa a virar taxa',
    de: '    const taxa = amostra >= 30 ? t.com / amostra : null;   // amostra curta não vira taxa',
    para: '    const taxa = amostra > 0 ? t.com / amostra : 0.5;',
    assertsQueCaem: [10, 11],
    porque: 'modalidade nunca pedida a porta certa (a 12, com 2.068 linhas) receberia uma taxa '
      + 'inventada e furaria a fila na frente de quem tem taxa medida' },

  { nome: '4xx volta a ser lido como "portal fora"',
    de: "  if (http >= 400 && http < 500) return 'pergunta-errada';   // 4xx é NOSSO erro, não queda",
    para: '  // (mutado)',
    assertsQueCaem: [14, 18],
    porque: 'e a lei da A30 pelo avesso — o condutor esperaria para sempre por uma porta que '
      + 'esta aberta, culpando o PNCP de um erro nosso' },
];

const original = fs.readFileSync(ALVO, 'utf8');
let ok = 0, falhou = 0; const sujo = [];
console.log('MUTACAO DA A33 — a suite nasceu verde; isto e o que separa conferido de nao-olhado.\n');

for (const m of MUTACOES) {
  let veredito = [];
  try {
    const alvo = original.replace(/\r\n/g, '\n');
    if (!alvo.includes(m.de)) {
      console.log('  ✗ ' + m.nome + '\n      A MUTACAO NAO ENCONTROU O ALVO — virou teatro. Procurado: '
        + JSON.stringify(m.de.slice(0, 70)));
      falhou++; continue;
    }
    const mutado = alvo.split(m.de).join(m.para);
    if (mutado === alvo) { console.log('  ✗ ' + m.nome + '  NAO ALTEROU NADA'); falhou++; continue; }
    fs.writeFileSync(ALVO, mutado);
    veredito.push('mutou L' + (alvo.slice(0, alvo.indexOf(m.de)).split('\n').length));

    const r = spawnSync(process.execPath, [path.join(RAIZ, 'tests', 'testa_preenche_prazo.js')],
      { cwd: RAIZ, encoding: 'utf8' });
    const saida = (r.stdout || '') + (r.stderr || '');
    const vermelha = r.status !== 0 && /FALHA/.test(saida);
    // Quais asserts caíram DE VERDADE — "ficou vermelha" nao basta: pode ter caido a errada.
    const caidos = [...saida.matchAll(/FALHA (\d+)\./g)].map(x => Number(x[1]));
    const certos = m.assertsQueCaem.every(a => caidos.includes(a));
    veredito.push(vermelha ? 'vermelha' : '*** NAO FICOU VERMELHA ***');
    veredito.push('caiu: [' + caidos.join(',') + ']  esperado conter: [' + m.assertsQueCaem.join(',') + ']');
    const bom = vermelha && certos;
    console.log('  ' + (bom ? '✓' : '✗') + ' ' + m.nome + '\n      ' + veredito.join(' · '));
    console.log('      quebrou: ' + m.porque);
    if (bom) ok++; else { falhou++; saida.split('\n').filter(l => /FALHA|RESULTADO/.test(l)).slice(0, 4).forEach(l => console.log('      ' + l.trim())); }
  } finally {
    fs.writeFileSync(ALVO, original);
    if (fs.readFileSync(ALVO, 'utf8') !== original) sujo.push(ALVO);
  }
}

console.log('\n───────────────────────────────');
console.log('MUTACOES: ' + ok + ' provada(s), ' + falhou + ' falha(s) de ' + MUTACOES.length);
if (sujo.length) console.log('>>> ARQUIVO NAO RESTAURADO: ' + sujo.join(', '));
console.log(falhou || sujo.length ? '>>> VERMELHO' : '>>> A SUITE DA A33 SABE FICAR VERMELHA');
process.exitCode = (falhou || sujo.length) ? 1 : 0;
