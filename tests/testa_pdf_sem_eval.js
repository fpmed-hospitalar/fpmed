// SUITE testa_pdf_sem_eval — PDF DE FORA NAO EXECUTA SCRIPT NA ABA LOGADA.
//
// A CICATRIZ (12/08/2026): o push do item 4 fez o GitHub avisar vulnerabilidades de dependencia.
// O `npm audit` apontou 4 (1 critica), mas TODAS na arvore do Node — e o node_modules daqui
// nem esta instalado. O buraco de verdade estava fora do audit: QUATRO TELAS carregavam o
// PDF.js 3.11.174 de um CDN, e essa e exatamente a faixa do CVE-2024-4367 — execucao de
// JavaScript arbitrario ao abrir um PDF malicioso.
//
// >>> POR QUE ERA ALCANCAVEL, e nao teorico: a FPMED abre PDF de EDITAL, que vem de fora (PNCP,
//     portal do orgao, e-mail). O script roda na aba de quem abriu, que esta logada.
//
// >>> A TRAVA E `isEvalSupported: false`, a mitigacao oficial da Mozilla. Ela entrou no lugar do
//     salto de versao porque a 4.x mudou pra ESM e trocou a API de worker: subir agora mexeria
//     em quatro telas de leitura de edital de uma vez, sem prova de que a extracao de texto
//     continua igual. Fechar o buraco hoje e barato; o salto de versao e item de fila, com prova.
//
// >>> E ELA NAO CUSTA FUNCIONALIDADE: o eval so acelera compilacao de fonte. Estas telas chamam
//     `getTextContent()` — extraem TEXTO, nao renderizam pagina. O caminho nem e percorrido.
//
//   node tests/testa_pdf_sem_eval.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) { p++; console.log('  ok  ' + n); } else { f++; console.log('  FALHA  ' + n + (e != null ? '  -> ' + JSON.stringify(e) : '')); } };
console.log('SUITE testa_pdf_sem_eval — PDF de fora nao executa script na aba logada\n');

// A VARREDURA E POR REGRA, NAO POR LISTA: tela nova que abrir PDF entra na conta sozinha. Lista
// escrita a mao envelhece no dia em que alguem cria a quinta tela e nao lembra de vir aqui.
const telas = fs.readdirSync(path.join(__dirname, '..'))
  .filter(n => /\.html$/i.test(n))
  .map(n => ({ n, s: R(n) }))
  .filter(x => /getDocument\s*\(/.test(x.s));

ok('*** 1. a varredura achou as telas que abrem PDF (nao ficou vazia por engano) ***',
  telas.length >= 4, telas.map(x => x.n));

// ══ A TRAVA, EM TODA CHAMADA ════════════════════════════════════════════════════════════════
{
  const abertas = [];
  for (const t of telas) {
    for (const m of (t.s.match(/getDocument\s*\(\{[^}]*\}\)/g) || [])) {
      if (!/isEvalSupported\s*:\s*false/.test(m)) abertas.push(t.n + ': ' + m.slice(0, 70));
    }
  }
  ok('*** 2. TODA chamada de getDocument desliga o eval (CVE-2024-4367) ***',
    abertas.length === 0, abertas);
}

// ══ E A VERSAO DO CDN, QUE E O QUE TORNA A TRAVA NECESSARIA ═════════════════════════════════
// >>> ESTE ASSERT NAO REPROVA A 3.x. Ele EXISTE pra que, no dia em que alguem subir a versao, a
//     suite lembre de conferir se a trava ainda faz sentido — e pra que o numero da versao nao
//     fique escondido no meio de 500 KB de tela. Quem le a suite fica sabendo em que versao a
//     casa esta, sem procurar.
{
  const versoes = new Set();
  for (const t of telas) {
    for (const m of (t.s.match(/pdf\.js\/([0-9.]+)\//g) || [])) versoes.add(m.replace(/pdf\.js\/|\//g, ''));
  }
  ok('3. a versao do PDF.js e a MESMA em todas as telas (duas versoes = dois comportamentos)',
    versoes.size <= 1, [...versoes]);
  const v = [...versoes][0] || '';
  const major = parseInt(v.split('.')[0] || '0', 10);
  ok('4. e enquanto for anterior a 4.2.67, a trava do assert 2 e OBRIGATORIA (esta em vigor)',
    major >= 4 || /isEvalSupported/.test(telas.map(t => t.s).join('')), v);
}

// ══ O MOTIVO ESCRITO JUNTO DA TRAVA ═════════════════════════════════════════════════════════
// Trava sem motivo escrito e a primeira coisa que alguem tira num refactor "de limpeza".
{
  const comMotivo = telas.filter(t => /CVE-2024-4367/.test(t.s)).length;
  ok('*** 5. o motivo (CVE-2024-4367) esta escrito nas telas que tem a trava ***',
    comMotivo >= 1, comMotivo + ' de ' + telas.length);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
