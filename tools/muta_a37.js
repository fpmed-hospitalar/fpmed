/* ═══════════════════════════════════════════════════════════════════════════════════════════
   muta_a37.js — A CATRACA DA ISENCAO DO PAPEL, PROVADA VERMELHA (fatia A37 · 20/08/2026)

   Uma isencao sem catraca e um `// ignore` com nome comprido. A `tests/testa_papel_congelado.js`
   nao vale nada ate alguem QUEBRAR cada uma das promessas dela no arquivo DE VERDADE e ela
   gritar — e a promessa mais importante e a terceira: se o hash nao bater, a isencao SUSPENDE.
   Sem essa, a decisao desta fatia vira a porta dos fundos por onde se muda o papel que o
   hospital assina sem ninguem ver.

   As sete mutacoes atravessam os TRES arquivos da decisao (a prova, a regua e a catraca), porque
   a promessa esta repartida entre eles e quebrar qualquer um dos tres a desfaz.

   O alvo e sempre um trecho DE UMA LINHA SO, e a restauracao e conferida BYTE A BYTE.

     node tools/muta_a37.js
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const SUITE = path.join(RAIZ, 'tests', 'testa_papel_congelado.js');
const PROVA = path.join(RAIZ, 'tools', 'prova_papel_congelado.js');
const REGUA = path.join(RAIZ, 'tools', 'regua_visual.js');
const CATRACA = path.join(RAIZ, 'tests', 'catraca.js');

/* [ arquivo, nome, trecho procurado, trecho trocado, que assert tem de gritar ] */
const MUTACOES = [
  [PROVA, 'a isencao para de conferir o hash — o papel pode mudar e continuar isento',
   '    if (r.hash !== esperado.hash) {',
   '    if (false) {',
   '11, 12'],

  [PROVA, 'regiao DIVERGENTE volta a isentar (a porta dos fundos aberta)',
   '    if (!r.achou || ruins.has(r.nome)) continue;',
   '    if (!r.achou) continue;',
   '10'],

  [PROVA, 'a ancora do OBS_PADRAO perde o comeco de linha e congela a MENCAO no comentario',
   "    re: /^var OBS_PADRAO = '[\\s\\S]*?';/m },",
   "    re: /var OBS_PADRAO = '[\\s\\S]*?';/ },",
   '5, 14, 16'],

  [REGUA, 'a isencao passa a valer para QUALQUER arquivo, e nao so para o papel',
   "  if (path.basename(arquivo) !== PAPEL.ALVO) {",
   "  if (false) {",
   '19'],

  [REGUA, 'o achado congelado e jogado fora em vez de mudar de coluna (divida escondida)',
   "      (so === 'contagem' ? cong.contados : cong.achados)",
   "      (so === 'contagem' ? cong.contados : [])",
   '14, 15, 16'],

  [CATRACA, 'a catraca para de imprimir a linha do papel congelado — a divida some da vista',
   "    console.log('\\n  >>> ' + total + ' achado(s) dentro do papel congelado por ordem do dono — fora da');",
   "    console.log('');",
   '20'],

  [CATRACA, 'hash que nao bate deixa de ser FALHA — a catraca ve o papel mudar e cala',
   '    if (r.congelado && r.congelado.divergentes.length) {',
   '    if (false) {',
   '22'],
];

function rodaSuite() {
  const r = spawnSync(process.execPath, [SUITE], { cwd: RAIZ, encoding: 'utf8' });
  const m = /RESULTADO: (\d+) ok, (\d+) falha/.exec(r.stdout || '');
  return { vermelha: r.status !== 0, ok: m ? +m[1] : null, falhas: m ? +m[2] : null,
           saida: (r.stdout || '') + (r.stderr || '') };
}

const originais = new Map();
for (const arq of [PROVA, REGUA, CATRACA]) originais.set(arq, fs.readFileSync(arq));

console.log('MUTACAO DA CATRACA DA ISENCAO DO PAPEL — 3 arquivos\n');

const partida = rodaSuite();
let p = 0, f = 0;
const conta = (c, msg) => { if (c) { p++; console.log('  OK   ' + msg); } else { f++; console.log('  FALHA ' + msg); } };
conta(!partida.vermelha, 'a suite parte VERDE (' + partida.ok + ' asserts) — sem isso nada abaixo mede nada');
if (partida.vermelha) { console.log(partida.saida); process.exit(1); }

for (const [arq, nome, de, para, quem] of MUTACOES) {
  const texto = originais.get(arq).toString('utf8');
  const achou = texto.indexOf(de);
  if (achou < 0) { f++; console.log('  FALHA  o trecho nao esta em ' + path.basename(arq) + ': ' + nome); continue; }
  /* O trecho tem de ser UNICO: trocar "o primeiro dos dois" mutaria um lugar que nao e o que a
     mutacao diz estar medindo, e o relatorio sairia falando de outra coisa. */
  if (texto.indexOf(de, achou + 1) >= 0) { f++; console.log('  FALHA  o trecho aparece mais de uma vez: ' + nome); continue; }

  fs.writeFileSync(arq, texto.replace(de, para), 'utf8');
  const r = rodaSuite();
  fs.writeFileSync(arq, originais.get(arq));       // restaura ANTES de julgar, sempre

  conta(r.vermelha, path.basename(arq) + ' · ' + nome + '  ->  VERMELHA (esperado nos asserts '
    + quem + '; deu ' + (r.falhas == null ? 'sem resultado' : r.falhas + ' falha(s)') + ')');
}

for (const arq of [PROVA, REGUA, CATRACA]) {
  const depois = fs.readFileSync(arq);
  conta(depois.equals(originais.get(arq)), path.basename(arq) + ' voltou IDENTICO byte a byte ('
    + originais.get(arq).length + ' -> ' + depois.length + ')');
}

const fim = rodaSuite();
conta(!fim.vermelha, 'e a suite volta VERDE no fim (' + fim.ok + ' asserts) — nao ficou defeito plantado');

console.log('\nRESULTADO: ' + p + ' de ' + (p + f));
if (f) process.exit(1);
