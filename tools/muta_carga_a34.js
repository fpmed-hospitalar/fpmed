/* ═══════════════════════════════════════════════════════════════════════════════════════════
   muta_carga_a34.js — A CATRACA DO CONDUTOR, PROVADA VERMELHA (fatia A34, fechamento · 20/08/2026)

   ══ POR QUE ISTO EXISTE ═════════════════════════════════════════════════════════════════════
   Uma suite que nunca ficou vermelha e indistinguivel de uma suite quebrada. A A31 desta casa
   pagou caro por isso: OITO catracas davam verde sobre 320 linhas que elas nao estavam lendo.
   Entao a `tests/testa_carga_diaria.js` nao vale nada ate alguem QUEBRAR a regra que ela guarda,
   no arquivo DE VERDADE, e ela gritar.

   ══ AS SETE MUTACOES SAO AS QUE ALGUEM FARIA DE BOA FE ══════════════════════════════════════
   Nenhuma delas e sabotagem inventada. Cada uma e uma "simplificacao" plausivel de quem le o
   arquivo com pressa — inclusive a primeira, que e literalmente o defeito que a fatia matou
   voltando a ser escrito.

   ══ E A RESTAURACAO E CONFERIDA BYTE A BYTE ═════════════════════════════════════════════════
   A mutacao mexe no arquivo que a fabrica usa para falar com o PNCP. Devolve-lo "parecido" nao
   serve: o arquivo volta IDENTICO, e o programa diz o tamanho dos dois lados. E o alvo e sempre
   um trecho DE UMA LINHA SO — a mutacao da A36 se enganou sozinha procurando alvo com `\n` num
   arquivo CRLF e relatou "o trecho nao esta mais la", que e o mesmo defeito que ela cacava.

     node tools/muta_carga_a34.js
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ALVO = path.join(RAIZ, 'tools', 'carga_diaria.js');
const SUITE = path.join(RAIZ, 'tests', 'testa_carga_diaria.js');

/* [ nome, trecho procurado, trecho trocado, que assert tem de gritar ] */
const MUTACOES = [
  ['o teto volta a ser um numero fixo (o defeito da fatia, escrito de novo)',
   'const teto = divida == null ? cabe : Math.max(50, Math.min(divida, cabe));',
   'const teto = 400;',
   '2, 3, 6, 14'],

  ['o teto ignora a divida e pede sempre o que cabe no relogio',
   'Math.max(50, Math.min(divida, cabe))',
   'Math.max(50, cabe)',
   '2'],

  ['a cadencia some, e o saldo volta a ser so uma promessa',
   'const rodadasParaZerar = (divida != null && !zeraHoje) ? Math.ceil(divida / cabe) : null;',
   'const rodadasParaZerar = null;',
   '12, 16'],

  ['o --minutos recomendado vira um numero decorativo (30% menor, "quase")',
   '? Math.ceil((divida * segPorLic) / (FATIA.itens * 60 * 0.75))',
   '? Math.ceil((divida * segPorLic) / (FATIA.itens * 60 * 0.75) * 0.7)',
   '14'],

  ['a taxa absurda de uma etapa morta passa a dimensionar a proxima rodada',
   'const medida = isFinite(taxa) && taxa > 0.05;',
   'const medida = isFinite(taxa);',
   '11'],

  ['`ultima_ok` avanca em rodada cortada (a faixa da tela mente a idade)',
   '  if (okDeVerdade) linha.ultima_ok = iso(fim);',
   '  linha.ultima_ok = iso(fim);',
   '20'],

  ['o portao cai e um `require` da suite passa a disparar a carga inteira',
   'if (require.main !== module) return;',
   'if (false) return;',
   '25'],
];

function rodaSuite() {
  const r = spawnSync(process.execPath, [SUITE], { cwd: RAIZ, encoding: 'utf8' });
  const m = /RESULTADO: (\d+) ok, (\d+) falha/.exec(r.stdout || '');
  return { vermelha: r.status !== 0, ok: m ? +m[1] : null, falhas: m ? +m[2] : null,
           saida: (r.stdout || '') + (r.stderr || '') };
}

const original = fs.readFileSync(ALVO);          // Buffer: bytes, nao texto
const texto = original.toString('utf8');

console.log('MUTACAO DA CATRACA DO CONDUTOR — ' + path.relative(RAIZ, ALVO) + '\n');

/* ══ ANTES DE TUDO: A SUITE TEM DE ESTAR VERDE ═══════════════════════════════════════════════
   Sem esta linha, uma suite que ja estivesse vermelha por outro motivo daria "7 de 7" aqui e eu
   comemoraria uma mutacao que nao mediu nada. */
const partida = rodaSuite();
let p = 0, f = 0;
const conta = (c, msg) => { if (c) { p++; console.log('  OK   ' + msg); } else { f++; console.log('  FALHA ' + msg); } };
conta(!partida.vermelha, 'a suite parte VERDE (' + partida.ok + ' asserts) — sem isso nada abaixo mede nada');
if (partida.vermelha) { console.log(partida.saida); process.exit(1); }

for (const [nome, de, para, quem] of MUTACOES) {
  const achou = texto.indexOf(de);
  if (achou < 0) { f++; console.log('  FALHA  o trecho nao esta no arquivo: ' + nome); continue; }
  /* O trecho tem de ser UNICO. Trocar "o primeiro dos dois" mutaria um lugar que nao e o que a
     mutacao diz estar medindo — e o relatorio sairia falando de outra coisa. */
  if (texto.indexOf(de, achou + 1) >= 0) { f++; console.log('  FALHA  o trecho aparece mais de uma vez: ' + nome); continue; }

  fs.writeFileSync(ALVO, texto.replace(de, para), 'utf8');
  const r = rodaSuite();
  fs.writeFileSync(ALVO, original);               // restaura ANTES de julgar, sempre

  conta(r.vermelha, nome + '  ->  VERMELHA (esperado nos asserts ' + quem + '; deu '
    + (r.falhas == null ? 'sem resultado' : r.falhas + ' falha(s)') + ')');
}

/* ══ E O ARQUIVO VOLTOU IDENTICO ═════════════════════════════════════════════════════════════ */
const depois = fs.readFileSync(ALVO);
conta(depois.equals(original), 'o arquivo voltou IDENTICO byte a byte (' + original.length
  + ' bytes -> ' + depois.length + ')');

const fim = rodaSuite();
conta(!fim.vermelha, 'e a suite volta VERDE no fim (' + fim.ok + ' asserts) — nao ficou defeito plantado');

console.log('\nRESULTADO: ' + p + ' de ' + (p + f));
if (f) process.exit(1);
