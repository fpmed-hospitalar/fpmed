/* ═══════════════════════════════════════════════════════════════════════════════════════════
   relatorio_parcial.js — O RELATÓRIO NÃO PODE DEPENDER DA ÚLTIMA CHAMADA (fatia A39, 20/08/2026)

   ══ O QUE CUSTOU, E O NÚMERO ════════════════════════════════════════════════════════════════
   Três ciclos do trabalhador A morreram com `API Error: Can't reach the API server —
   ENOTFOUND`: às 09:15:43, às 12:29:29 e nos ciclos 3 e 4. O de 12:29 tinha DUAS HORAS E MEIA
   de trabalho, já tinha carimbado a carga das 12:19 no banco — e morreu ANTES de escrever o
   relatório. O trabalho existiu no banco e no disco; a prestação de contas se perdeu.

   >>> O DEFEITO NÃO É "A REDE CAIU". É O RELATÓRIO SER O ÚLTIMO ATO. Um ciclo que só presta
       contas no fim é um ciclo cujo registro inteiro cabe numa única chamada de rede — e essa
       chamada é a que tem mais horas de trabalho pendurada nela. Qualquer coisa que a derrube
       apaga tudo o que veio antes, mesmo que o trabalho esteja gravado.
   >>> ENTÃO A UNIDADE DE PRESTAÇÃO DE CONTAS DEIXA DE SER O CICLO E PASSA A SER A FATIA. Cada
       fatia que fecha acrescenta o SEU bloco no topo do relatório NA HORA. Se o ciclo morrer no
       meio, o que já foi feito está prestado — e a fatia que estava aberta fica registrada como
       aberta, com a hora.

   ══ POR QUE ELE ESCREVE ATÔMICO, E ISSO NÃO É ZELO DE ARQUITETO ═════════════════════════════
   O gesto é "ler o arquivo, pôr o bloco na frente, gravar por cima". A gravação por cima TRUNCA
   o arquivo antes de escrever o conteúdo novo — e a janela entre o truncar e o terminar de
   escrever é onde mora o relatório inteiro. Uma queda ali (energia, `kill`, disco cheio) troca
   um relatório completo por um arquivo pela metade.
   >>> ISSO SERIA A FERRAMENTA CONTRA A DÍVIDA CRIANDO UMA DÍVIDA MAIOR: um relatório perdido
       por rede se remedia com o próximo bloco; um relatório TRUNCADO leva junto tudo o que
       estava escrito debaixo dele, de todas as rodadas anteriores.
   >>> O CONSERTO É O DE SEMPRE: escreve inteiro num arquivo ao lado, força pro disco (`fsync`)
       e só então RENOMEIA por cima. O `rename` no mesmo volume é atômico: ou o arquivo velho
       está lá inteiro, ou o novo está lá inteiro. Nunca meio.

   ══ E ELE RECUSA BLOCO VAZIO ════════════════════════════════════════════════════════════════
   Bloco sem corpo é pior do que bloco nenhum: o cabeçalho fica no relatório dizendo que a fatia
   foi prestada, e quem lê depois não tem como saber que não foi. Um erro que se vê é mais
   barato que um registro que mente.

     node tools/relatorio_parcial.js --quem A --fatia A39 --titulo "..." --arquivo bloco.md
     node tools/relatorio_parcial.js --quem A --fatia A39 --titulo "..." --texto "corpo"
     ... | node tools/relatorio_parcial.js --quem A --fatia A39 --titulo "..."     (pela entrada)
     node tools/relatorio_parcial.js --quem A --fatia A40 --interrompida rede      (a fatia aberta)
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PASTA = path.join(RAIZ, 'relatorios');

/* dd/MM/aaaa HH:mm — o mesmo formato que o relatório já usa desde a rodada 1. Duas grafias de
   data no mesmo arquivo fariam quem lê achar que são dois documentos. */
function carimboDeHora(d) {
  const p2 = n => String(n).padStart(2, '0');
  return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear()
    + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
}
const soHora = d => carimboDeHora(d).slice(-5);

/* ══ AS DUAS PALAVRAS QUE A CAIXA EXIGIU LITERALMENTE ════════════════════════════════════════
   "interrompida por rede às HH:MM". Ela é constante e é comparada por catraca porque é a frase
   que o arquiteto vai procurar no relatório de um ciclo que morreu — se cada fatia inventar a
   sua, procurar por ela vira leitura de texto corrido. */
const INTERROMPIDA = (motivo, d) =>
  'interrompida por ' + (motivo || 'rede') + ' às ' + soHora(d);

/* ══ O BLOCO ═════════════════════════════════════════════════════════════════════════════════
   Função pura: entra o que a fatia tem, sai o texto. Ela não lê disco e não escreve nada — é
   por isso que a catraca consegue perguntar "o bloco de uma fatia interrompida diz a hora?" sem
   precisar de um relatório de verdade em cima da mesa. */
function montaBloco(o) {
  const quando = o.quando instanceof Date ? o.quando : new Date();
  const fatia = String(o.fatia || '').trim();
  if (!fatia) throw new Error('bloco sem fatia — o relatório não sabe do que está falando');
  const corpo = String(o.corpo == null ? '' : o.corpo).trim();
  const interrompida = o.interrompida ? INTERROMPIDA(o.interrompida, quando) : null;
  /* Recusa bloco vazio — a não ser que ele seja a marca de uma fatia INTERROMPIDA, que é um
     bloco cujo conteúdo inteiro é "isto não terminou, e foi nesta hora". */
  if (!corpo && !interrompida) {
    throw new Error('bloco sem corpo (' + fatia + ') — cabeçalho sozinho diz que a fatia foi '
      + 'prestada quando ela não foi');
  }
  const titulo = String(o.titulo || '').trim();
  const linhas = [];
  linhas.push('<!-- FATIA ' + fatia + ' — gravada em ' + carimboDeHora(quando) + ' -->');
  linhas.push('');
  linhas.push('## ' + fatia + (titulo ? ' — ' + titulo : '')
    + (interrompida ? '  ⚠ ' + interrompida.toUpperCase() : ''));
  linhas.push('');
  if (interrompida) {
    linhas.push('**Esta fatia NÃO fechou: ' + interrompida + '.** O que está escrito abaixo é o');
    linhas.push('que já estava feito e medido na hora da queda — nada aqui é promessa.');
    linhas.push('');
  }
  if (corpo) { linhas.push(corpo); linhas.push(''); }
  linhas.push('---');
  linhas.push('');
  return linhas.join('\n');
}

/* ══ ACRESCENTAR NO TOPO, SEM PODER PERDER O QUE ESTAVA EMBAIXO ══════════════════════════════
   Devolve o caminho gravado. O arquivo velho é lido, o bloco entra na frente e o conjunto vai
   pro disco pelo caminho temporário → fsync → rename. */
function acrescentaNoTopo(caminho, bloco) {
  const velho = fs.existsSync(caminho) ? fs.readFileSync(caminho, 'utf8') : '';
  const separador = (velho && !velho.startsWith('\n')) ? '\n' : '';
  const novo = bloco + separador + velho;
  const tmp = caminho + '.parcial.tmp';
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, novo, 'utf8');
    fs.fsyncSync(fd);           // sem isto o rename pode chegar ao disco antes do conteúdo
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, caminho);  // atômico no mesmo volume: ou o velho inteiro, ou o novo inteiro
  return caminho;
}

const caminhoDe = quem => path.join(PASTA, 'RELATORIO_' + String(quem || 'A').toUpperCase() + '.md');

/* O ato inteiro, que é o que as fatias chamam: monta e grava. */
function grava(o) {
  const bloco = montaBloco(o);
  const caminho = o.caminho || caminhoDe(o.quem);
  if (!fs.existsSync(path.dirname(caminho))) fs.mkdirSync(path.dirname(caminho), { recursive: true });
  acrescentaNoTopo(caminho, bloco);
  return { caminho, bloco };
}

module.exports = { montaBloco, acrescentaNoTopo, grava, caminhoDe, carimboDeHora, INTERROMPIDA };
if (require.main !== module) return;

// ── linha de comando ────────────────────────────────────────────────────────────────────────
const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };

(async () => {
  const quem = arg('--quem') || 'A';
  const fatia = arg('--fatia');
  const titulo = arg('--titulo');
  const interrompida = process.argv.includes('--interrompida')
    ? (arg('--interrompida') && !String(arg('--interrompida')).startsWith('--') ? arg('--interrompida') : 'rede')
    : null;

  let corpo = arg('--texto');
  const deArquivo = arg('--arquivo');
  if (deArquivo) corpo = fs.readFileSync(path.resolve(RAIZ, deArquivo), 'utf8');
  if (corpo == null && !process.stdin.isTTY) {
    corpo = await new Promise(res => {
      let t = ''; process.stdin.setEncoding('utf8');
      process.stdin.on('data', d => { t += d; });
      process.stdin.on('end', () => res(t));
    });
  }

  /* `--caminho` existe pela catraca: uma suite que precisasse escrever no RELATORIO_A.md de
     verdade para provar que a gravação funciona sujaria a prestação de contas a cada rodada de
     teste — e ninguém saberia distinguir um bloco de fatia de um bloco de assert. */
  const { caminho } = grava({ quem, fatia, titulo, corpo, interrompida, caminho: arg('--caminho') });
  console.log('bloco da fatia ' + fatia + ' gravado no topo de ' + caminho
    + (interrompida ? '  (INTERROMPIDA)' : ''));
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
