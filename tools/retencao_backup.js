// retencao_backup.js — A REGRA DE RETENÇÃO DE `backups/`, APLICADA POR MÁQUINA.
//
// Fatia A51 (01/09/2026). A pasta chegou a 2.400 MB em 23 backups, e cada volta agrega ~1.090 MB
// desde que a `licitacao_itens` (846 MB sozinha) passou a ser salva. Isso dobra a cada duas voltas.
//
// A REGRA É DO ARQUITETO, não minha: **os 3 backups mais recentes + o último de cada mês.**
//
// >>> ESTE SCRIPT NÃO APAGA NADA. Ele MOVE para `backups/_a_remover/`. A ordem foi explícita e a
//     razão é boa: "quem apaga de primeira não tem como provar que apagou o certo". Quem confere
//     e decide apagar de verdade é o dono, com a pasta na frente dele.
//
// >>> E ELE NUNCA SAI DE `backups/`. O caminho de origem e o de destino são conferidos antes de
//     cada movimento; qualquer coisa fora de `backups/` aborta o script inteiro.
//
//   node tools/retencao_backup.js            só mostra o que faria (padrão — não mexe em nada)
//   node tools/retencao_backup.js --aplicar  move de verdade
'use strict';
const fs = require('fs'), path = require('path');

const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'backups');
const QUARENTENA = path.join(DIR, '_a_remover');
const GUARDAR_RECENTES = 3;
const PADRAO = /^backup_(\d{4})-(\d{2})-(\d{2})_(\d{4})$/;

const mb = n => (n / 1048576).toFixed(1);
function tamanho(p) {
  let t = 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    t += e.isDirectory() ? tamanho(f) : fs.statSync(f).size;
  }
  return t;
}

// ── A REGRA, SOZINHA E TESTÁVEL ─────────────────────────────────────────────────────────────
// Ela saiu do meio do script (A51, 01/09/2026) por um motivo medido: hoje `backups/` só tem UM
// mês, então a metade "o último de cada mês" da regra **nunca foi exercitada** — ela estava
// escrita e não estava provada. Regra que só se testa quando o calendário virar é regra que
// ninguém testa. Agora `tests/testa_retencao_backup.js` a chama com meses de mentira.
// Recebe nomes de pasta, devolve o que fica e o que sai. Não toca no disco.
function decide(nomes, guardarRecentes = GUARDAR_RECENTES) {
  const pastas = nomes.filter(n => PADRAO.test(n))
    .map(n => { const m = n.match(PADRAO); return { nome: n, mes: `${m[1]}-${m[2]}` }; })
    .sort((a, b) => a.nome.localeCompare(b.nome));   // o nome ordena por data, de propósito

  const recentes = new Set(pastas.slice(-guardarRecentes).map(p => p.nome));
  const ultimoDoMes = new Set(Object.values(
    pastas.reduce((acc, p) => { acc[p.mes] = p.nome; return acc; }, {})));
  const guardar = new Set([...recentes, ...ultimoDoMes]);

  return {
    fica: pastas.filter(p => guardar.has(p.nome)),
    sai:  pastas.filter(p => !guardar.has(p.nome)),
    recentes,
  };
}

module.exports = { decide, PADRAO, GUARDAR_RECENTES };
// required por uma suíte: só entrega a regra e para aqui. Nada de varrer disco nem mover pasta.
if (require.main !== module) return;

const aplicar = process.argv.includes('--aplicar');

const { fica, sai, recentes } = decide(
  fs.readdirSync(DIR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name));

console.log(`\n=== RETENÇÃO DE backups/ — ${aplicar ? 'APLICANDO' : 'SIMULAÇÃO (nada é movido)'} ===\n`);
console.log(`regra: os ${GUARDAR_RECENTES} mais recentes + o último de cada mês\n`);

let bFica = 0, bSai = 0;
for (const p of fica) { const t = tamanho(path.join(DIR, p.nome)); bFica += t;
  console.log(`  FICA  ${p.nome}  ${mb(t).padStart(8)} MB` + (recentes.has(p.nome) ? '   (recente)' : '   (último de ' + p.mes + ')')); }
console.log('');
for (const p of sai) { const t = tamanho(path.join(DIR, p.nome)); bSai += t;
  console.log(`  move  ${p.nome}  ${mb(t).padStart(8)} MB`); }

console.log(`\n  ficam ..... ${fica.length} pasta(s), ${mb(bFica)} MB`);
console.log(`  movidas ... ${sai.length} pasta(s), ${mb(bSai)} MB`);
console.log(`  total ..... ${mb(bFica + bSai)} MB antes -> ${mb(bFica)} MB depois de esvaziar a quarentena`);

if (!aplicar) { console.log('\n(simulação — rode com --aplicar para mover)\n'); process.exit(0); }

fs.mkdirSync(QUARENTENA, { recursive: true });
let n = 0;
for (const p of sai) {
  const de = path.join(DIR, p.nome), para = path.join(QUARENTENA, p.nome);
  // A trava: nada aqui pode olhar para fora de backups/. Se olhar, o script inteiro morre.
  if (!path.resolve(de).startsWith(path.resolve(DIR)) || !path.resolve(para).startsWith(path.resolve(DIR))) {
    console.error('ABORTANDO: caminho fora de backups/ -> ' + de); process.exit(1);
  }
  if (fs.existsSync(para)) { console.log(`  (já estava na quarentena: ${p.nome})`); continue; }
  fs.renameSync(de, para); n++;
}
console.log(`\n${n} pasta(s) movida(s) para backups/_a_remover/.`);
console.log('NADA FOI APAGADO. Confira e apague você mesmo quando quiser.\n');
