/* ══════════════════════════════════════════════════════════════════════════════════════════
   muta_a44.js — A CATRACA DO ORÇAMENTO MORDE? (fatia A44, 21/08/2026)

   A regra da A44 decide sozinha gastar até uma hora de máquina. Uma regra que gasta dinheiro
   do dono sem perguntar precisa de uma catraca que grite quando alguém a afrouxar — e catraca
   verde não prova nada até alguém tentar passar por ela.

   Aqui eu estrago `tools/carga_diaria.js` de propósito e exijo que
   `tests/testa_carga_diaria.js` FALHE em cada mutação. As mutações são de boa fé: são os
   erros que um humano cometeria mexendo nesta regra — tirar o `Math.max` que parece
   redundante, deixar a varredura crescer junto "por simetria", subir o teto "só um pouco".

     node tools/muta_a44.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const CATRACA = path.join(RAIZ, 'tests', 'testa_carga_diaria.js');
const ALVO = path.join(RAIZ, 'tools', 'carga_diaria.js');
const original = fs.readFileSync(ALVO);

const MUTACOES = [
  ['*** deixa a varredura crescer junto ("por simetria") — o balde enchendo pelo cano que esvazia ***',
    'varredura: minutosOutros * FATIA.varredura', 'varredura: minutosItens * FATIA.varredura'],
  ['*** tira o teto automático: a regra passa a poder gastar 12 horas sozinha ***',
    'const minutos = Math.min(querido, teto);',
    'const minutos = querido;'],
  /* ESTA MUTAÇÃO EXISTE POR CAUSA DE UMA QUE ESCAPOU. Na primeira rodada deste mutador eu
     tirei o `Math.max(padrao, ...)` do orçamento e a catraca ficou verde — porque o `Math.max`
     era inalcançável (ver o comentário dele em `orcamentoDaRodada`). Ele saiu, e no lugar
     ficou a invariante "a regra nunca compra menos que o padrão", cobrada em 72 pares.
     Esta mutação é o jeito REAL de quebrá-la: desacoplar o `zeraHoje` da conta do `cabe` faz
     uma dívida de 5 licitações pedir 1 minuto — e a rodada inteira duraria um minuto. */
  ['*** desacopla o `zeraHoje` do `cabe`: uma dívida de 5 vira uma rodada de 1 minuto ***',
    'const zeraHoje = divida == null ? true : divida <= cabe;',
    'const zeraHoje = divida == null ? true : divida <= 0;'],
  ['sobe o teto automático de 60 para 240 sem dizer a ninguém',
    "const TETO_AUTOMATICO_MIN = parseInt(arg('--teto-automatico'), 10) || 60;",
    "const TETO_AUTOMATICO_MIN = parseInt(arg('--teto-automatico'), 10) || 240;"],
  ['*** faz a regra ignorar a ordem do dono e decidir por ele ***',
    'if (isFinite(pedido) && pedido > 0) {', 'if (false) {'],
  ['aceita `--minutos 0` como ordem (um dígito torto desliga a rodada)',
    'if (isFinite(pedido) && pedido > 0) {', 'if (isFinite(pedido)) {'],
  ['faz a regra ignorar o RITMO medido e olhar só a dívida',
    'taxaAnterior: o.taxaAnterior });', 'taxaAnterior: null });'],
  /* A REGRA CERTA, NUNCA CONSULTADA. Esta é a mutação mais sorrateira do conjunto: a função
     continua impecável e todos os asserts que a chamam direto continuam verdes — só que a
     rodada deixa de lhe contar a dívida, e ela passa a responder 20 para sempre. */
  ['*** deixa de contar a dívida e o ritmo à regra (ela fica certa e nunca é consultada) ***',
    /  const orc = orcamentoDaRodada\(\{[\s\S]*?\n  \}\);\n/,
    '  const orc = orcamentoDaRodada({ pedidoDoDono: ORCAMENTO_PEDIDO });\n'],
  ['volta a multiplicar o rateio solto no laço das etapas',
    'const minutosDa = e => orc.etapas[e.nome];',
    'const minutosDa = e => ORCAMENTO_MIN * e.fatia;'],
  ['cala QUEM decidiu o orçamento no carimbo (60 min vira frase ambígua)',
    '    orcamento_quem: orc.quem,', '    orcamento_quem: null,'],
  ['tira do carimbo o que a dívida TERIA pedido (some a prova de que o teto mordeu)',
    '    orcamento_querido: orc.querido,', '    orcamento_querido: null,'],
  ['apaga a confissão de que a "máquina ociosa" da caixa não foi medida',
    'EU NÃO SEI MEDIR ISSO, E NÃO VOU FINGIR', 'A OCIOSIDADE E MEDIDA PELA HORA DO DIA'],
  ['apaga a seção "O QUE SE PERDE" da regra',
    '   ══ O QUE SE PERDE ══', '   ══ O QUE MELHOROU ══'],
  ['some com o `--carimbo` dizendo quem decidiu', 'decidido por: ', 'orcamento: '],
];

console.log('=== MUTAÇÕES DE BOA FÉ NO ORÇAMENTO DA CARGA (fatia A44) ===\n');
console.log('  original: ' + original.length + ' bytes\n');

let pegou = 0, escapou = 0;
const fugas = [];
try {
  for (let i = 0; i < MUTACOES.length; i++) {
    const [nome, de, para] = MUTACOES[i];
    const antes = original.toString('utf8');
    const depois = antes.replace(de, para);
    if (depois === antes) {
      escapou++; fugas.push(`${i + 1}. ${nome}  <-- NÃO APLICOU (o texto alvo sumiu do arquivo)`);
      console.log(`  ??   ${i + 1}. ${nome}\n         >>> não consegui aplicar — o texto alvo sumiu`);
      continue;
    }
    fs.writeFileSync(ALVO, Buffer.from(depois, 'utf8'));
    let falhou = false, saida = '';
    try { execFileSync('node', [CATRACA], { encoding: 'utf8' }); }
    catch (e) { falhou = true; saida = String(e.stdout || '') + String(e.stderr || ''); }
    fs.writeFileSync(ALVO, original);

    if (falhou) {
      pegou++;
      const linha = (saida.split('\n').find(l => /FALHA/.test(l)) || '').trim();
      console.log(`  ok   ${i + 1}. ${nome}\n         pega por: ${linha.slice(0, 105)}`);
    } else {
      escapou++; fugas.push(`${i + 1}. ${nome}`);
      console.log(`  ESCAPOU ${i + 1}. ${nome}  <<< BURACO NA CATRACA`);
    }
  }
} finally { fs.writeFileSync(ALVO, original); }

console.log('\n── restauração ──');
const agora = fs.readFileSync(ALVO);
const igual = agora.equals(original);
console.log(`  ${igual ? 'ok  ' : 'FALHA'} carga_diaria.js restaurado byte a byte (${original.length} -> ${agora.length})`);

console.log('\nRESULTADO: ' + pegou + ' de ' + MUTACOES.length + ' mutações pegas' + (escapou ? ', ' + escapou + ' ESCAPOU(ARAM)' : ''));
if (fugas.length) { console.log('\n>>> BURACOS:'); fugas.forEach(l => console.log('    ' + l)); }
process.exitCode = (escapou || !igual) ? 1 : 0;
