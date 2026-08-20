/* ═══════════════════════════════════════════════════════════════════════════════════════════
   prova_a39_queda.js — A QUEDA SIMULADA NO MEIO DE UM CICLO (fatia A39 · 20/08/2026)

   A caixa pediu com estas palavras: *"simular a queda (derrubar a rede ou forçar o erro) no meio
   de um ciclo e mostrar o relatório parcial gravado, com a última fatia dizendo 'interrompida por
   rede às HH:MM'"*.

   ══ E A QUEDA AQUI É DE VERDADE, NÃO É UM `throw` ENCENADO ══════════════════════════════════
   O endereço `http://nao-existe-fpmed-a39.invalid` é um domínio reservado pela RFC 2606
   justamente para não existir. O `fetch` contra ele produz o MESMO `fetch failed` /
   `getaddrinfo ENOTFOUND` que matou três ciclos do trabalhador A. Nada é simulado a não ser a
   hora: a rede que cai é a rede caindo.

   ══ AS DUAS METADES DA FATIA, provadas em sequência ══════════════════════════════════════════
   1. O CICLO: duas fatias fecham e gravam o bloco delas NA HORA; a terceira é pega pela queda e
      grava o bloco de interrompida. O relatório resultante é impresso inteiro.
   2. O CARIMBO DA CARGA: a chamada que carregava a rodada inteira retenta com espera crescente,
      desiste, e GRAVA O QUE TEM no disco em vez de evaporar.

     node tools/prova_a39_queda.js            (com o plano de PRODUÇÃO: 2s · 6s · 18s, ~26 s)
     node tools/prova_a39_queda.js --rapido   (mesma prova, esperas de 1 ms — para conferir a
                                               lógica sem esperar; o plano real sai impresso)
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.join(__dirname, '..');
const REL = require(path.join(RAIZ, 'tools', 'relatorio_parcial.js'));
const C = require(path.join(RAIZ, 'tools', 'carga_diaria.js'));

const RAPIDO = process.argv.includes('--rapido');
const MORTA = 'http://nao-existe-fpmed-a39.invalid';
const plano = RAPIDO ? { tentativas: C.TENTATIVAS_REDE, espera: () => 1 } : undefined;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prova_a39_'));
const relatorio = path.join(tmp, 'RELATORIO_SIMULADO.md');

let p = 0, f = 0;
const conta = (c, msg, extra) => {
  if (c) { p++; console.log('  OK    ' + msg); }
  else { f++; console.log('  FALHA ' + msg + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
};

(async () => {
  console.log('PROVA A39 — A QUEDA DE REDE NO MEIO DE UM CICLO');
  console.log('plano de teimosia: ' + C.TENTATIVAS_REDE + ' tentativas, esperando '
    + [0, 1, 2].map(t => C.esperaCrescente(t) / 1000 + 's').join(' · ')
    + (RAPIDO ? '   (--rapido: as esperas desta execução são de 1 ms)' : '') + '\n');

  // ══════════ 1. O CICLO — duas fatias fecham, a terceira é pega pela queda ══════════
  console.log('── 1. o ciclo ───────────────────────────────────────────────');
  REL.grava({ caminho: relatorio, fatia: 'A39', titulo: 'o relatório em pedaços',
    corpo: 'gravador atômico + a teimosia da rede. Suíte: 27 asserts; mutação: 10 de 10.' });
  console.log('  fatia A39 fechou — bloco gravado na hora.');

  REL.grava({ caminho: relatorio, fatia: 'A37', titulo: 'a régua e o papel congelado',
    corpo: 'a régua passou a ler as regiões congeladas da prova do papel.' });
  console.log('  fatia A37 fechou — bloco gravado na hora.');

  const trabalhoJaFeito = 'Antes da queda eu JÁ tinha medido: 192 de 358.710 itens com resultado '
    + '(0,053%), vindos de UM único certame. Este número existiu e está prestado.';
  console.log('  fatia A40 começou... e a rede cai agora:');

  let caiu = null;
  const t0 = Date.now();
  try { await C.fetchTeimoso(MORTA + '/rest/v1/licitacoes', {}, 'a fatia A40 falando com o banco', plano); }
  catch (e) { caiu = e; }
  const gastou = ((Date.now() - t0) / 1000).toFixed(1);

  conta(!!caiu && caiu.quedaDeRede === true,
    'a queda é REAL e reconhecida como queda de rede: ' + (caiu && caiu.message));
  conta(!!caiu && caiu.tentativas === C.TENTATIVAS_REDE,
    'ela retentou ' + (caiu && caiu.tentativas) + ' vezes com espera crescente antes de desistir ('
    + gastou + 's)');

  /* E AO DESISTIR, GRAVA O QUE TEM. Este é o gesto inteiro da fatia. */
  const quandoCaiu = new Date();
  REL.grava({ caminho: relatorio, fatia: 'A40', titulo: 'o ingestor de resultado de item',
    corpo: trabalhoJaFeito, interrompida: 'rede', quando: quandoCaiu });
  console.log('  fatia A40 NÃO fechou — e mesmo assim prestou contas.\n');

  const texto = fs.readFileSync(relatorio, 'utf8');
  const hh = REL.carimboDeHora(quandoCaiu).slice(-5);
  conta(texto.includes('interrompida por rede às ' + hh),
    '*** a última fatia diz "interrompida por rede às ' + hh + '" — a frase que a caixa exigiu ***');
  conta(texto.indexOf('A40') < texto.indexOf('A37') && texto.indexOf('A37') < texto.indexOf('A39'),
    'o relatório está em ordem inversa: a fatia mais recente no topo');
  conta(texto.includes('192 de 358.710'),
    '*** o trabalho JÁ FEITO na fatia interrompida está prestado, com o número medido ***');
  conta(texto.includes('Suíte: 27 asserts') && texto.includes('regiões congeladas'),
    'e as duas fatias que fecharam ANTES da queda continuam inteiras no relatório');
  conta(!fs.existsSync(relatorio + '.parcial.tmp'), 'nenhum arquivo pela metade ficou para trás');

  console.log('\n╔══ O RELATÓRIO QUE SOBROU DO CICLO MORTO ' + '═'.repeat(24) + '╗');
  texto.split('\n').forEach(l => console.log('║ ' + l));
  console.log('╚' + '═'.repeat(64) + '╝\n');

  // ══════════ 2. O CARIMBO DA CARGA — a rodada não depende da última chamada ══════════
  console.log('── 2. o carimbo da carga ────────────────────────────────────');
  const linha = { fonte: 'CARGA', ultima_tentativa: new Date().toISOString(), registros: 7273,
    detalhe: { licitacoes: 30548, itens: 358710, divida_vivas_depois: 4558,
               saldo: 'saldo: faltam 4.558 vivas sem item — neste orçamento são 11 rodadas' } };

  const r = await C.gravaCarimbo(linha, { SB: MORTA, H: {} }, plano, tmp);
  conta(r.ok === false, 'a rede caiu e o carimbo NÃO se declarou gravado');
  conta(!!r.pendente && fs.existsSync(r.pendente),
    '*** e ele foi GRAVADO NO DISCO em vez de evaporar: ' + (r.pendente && path.basename(r.pendente)) + ' ***');

  const guardado = JSON.parse(fs.readFileSync(r.pendente, 'utf8'));
  conta(guardado.linha.detalhe.divida_vivas_depois === 4558 && guardado.linha.registros === 7273,
    'o que foi pro disco é a LINHA INTEIRA da rodada, com os números medidos — não um resumo');
  console.log('        porque: ' + guardado.porque);
  console.log('        saldo guardado: ' + guardado.linha.detalhe.saldo);

  const antes = fs.readdirSync(tmp).filter(n => /^carimbo_pendente_/.test(n)).length;
  await C.reenviaPendentes({ SB: MORTA, H: {} }, plano, tmp);
  const depois = fs.readdirSync(tmp).filter(n => /^carimbo_pendente_/.test(n)).length;
  conta(depois === antes,
    '*** com a porta ainda fechada o pendente FICA no disco — só some depois do banco confirmar ***');

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  console.log('\nRESULTADO: ' + p + ' de ' + (p + f));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
