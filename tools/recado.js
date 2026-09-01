// recado.js — O CANAL ENTRE OS CHATS DO FPMED.
//
// 01/09/2026. O dono pediu "uma forma de se comunicar com o chat da FPMED". Havia três jeitos
// tentados antes, e os três falham por um motivo diferente:
//
//   1. MENSAGEM DIRETA — não existe. As sessões não se enxergam; o único chão comum é este disco.
//   2. O RELATÓRIO — vira arquivo de 200 KB. Recado curto lá dentro é recado perdido. Foi assim
//      que a fábrica ficou ONZE DIAS parada com `FILA VAZIA` escrito e ninguém viu.
//   3. UM ARQUIVO .md COMPARTILHADO — **duas janelas escrevendo se sobrescrevem.** O dono avisou
//      hoje: "cuidado para não cruzar, o arquiteto está escrevendo lá".
//
// Este canal resolve os três de uma vez, e a decisão de projeto que faz isso é uma só:
//
//   >>> APPEND-ONLY, UMA LINHA JSON POR RECADO. Ninguém reescreve o arquivo, ninguém abre para
//       editar, ninguém salva por cima. Cada recado é um `append` de uma linha — a operação que
//       duas janelas podem fazer ao mesmo tempo sem uma apagar a outra. LER é abrir e ler; nunca
//       trava, nunca cruza. Até o "marcar como lido" é um recado novo, não uma edição.
//
// COMO USAR (qualquer chat do FPMED, de qualquer janela):
//   node tools/recado.js caixa <quem>                  o que chegou para você e você não leu
//   node tools/recado.js manda <de> <para> "texto"     deixa um recado
//   node tools/recado.js li <quem>                     marca como lido o que você acabou de ler
//   node tools/recado.js tudo [quantos]                o histórico inteiro, mais recente primeiro
//
//   <quem>/<de>/<para>: A · B · arquiteto · dono · todos
//
// EXEMPLO REAL:
//   node tools/recado.js manda A arquiteto "A50 travada: nao posso tocar fpmed_negocios.html, e do B"
//   node tools/recado.js caixa arquiteto
'use strict';
const fs = require('fs'), path = require('path');
const ARQ = path.join(__dirname, '..', 'caixas', 'RECADOS.jsonl');
const PAPEIS = ['A', 'B', 'arquiteto', 'dono', 'todos'];

const agora = () => {
  const d = new Date(), z = n => String(n).padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}`;
};

function lerTudo() {
  if (!fs.existsSync(ARQ)) return [];
  return fs.readFileSync(ARQ, 'utf8').split('\n').filter(l => l.trim())
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// A ÚNICA escrita do arquivo inteiro. Uma linha, no fim, e pronto.
function grava(obj) {
  fs.mkdirSync(path.dirname(ARQ), { recursive: true });
  fs.appendFileSync(ARQ, JSON.stringify(obj) + '\n', 'utf8');
}

function valida(papel, rotulo) {
  if (!PAPEIS.includes(papel)) {
    console.error(`${rotulo} inválido: "${papel}". Use um de: ${PAPEIS.join(' · ')}`);
    process.exit(1);
  }
}

// Um recado está lido quando existe um evento `li` do destinatário POSTERIOR a ele.
function naoLidos(quem) {
  const tudo = lerTudo();
  const ultimaLeitura = tudo.filter(r => r.tipo === 'li' && r.quem === quem)
                            .reduce((m, r) => Math.max(m, r.t), 0);
  return tudo.filter(r => r.tipo === 'recado' && r.t > ultimaLeitura
                       && (r.para === quem || r.para === 'todos') && r.de !== quem);
}

function mostra(lista, titulo) {
  console.log(`\n=== ${titulo} ===\n`);
  if (!lista.length) { console.log('  (nada)\n'); return; }
  for (const r of lista) console.log(`  [${r.quando}] ${r.de} → ${r.para}:\n      ${r.texto}\n`);
}

const [, , cmd, a1, a2, ...resto] = process.argv;

switch (cmd) {
  case 'manda': {
    const texto = resto.join(' ').trim();
    if (!a1 || !a2 || !texto) {
      console.error('uso: node tools/recado.js manda <de> <para> "o recado"'); process.exit(1);
    }
    valida(a1, 'remetente'); valida(a2, 'destinatário');
    grava({ tipo: 'recado', t: Date.now(), quando: agora(), de: a1, para: a2, texto });
    console.log(`\nrecado deixado para ${a2}. Ele vê com:  node tools/recado.js caixa ${a2}\n`);
    break;
  }
  case 'caixa': {
    if (!a1) { console.error('uso: node tools/recado.js caixa <quem>'); process.exit(1); }
    valida(a1, 'quem');
    const n = naoLidos(a1);
    mostra(n, `RECADOS NÃO LIDOS DE ${a1.toUpperCase()} — ${n.length}`);
    if (n.length) console.log(`  Depois de ler, marque:  node tools/recado.js li ${a1}\n`);
    // saída != 0 quando há recado esperando: dá para pendurar num script sem ler a tela
    process.exit(n.length ? 2 : 0);
  }
  case 'li': {
    if (!a1) { console.error('uso: node tools/recado.js li <quem>'); process.exit(1); }
    valida(a1, 'quem');
    const n = naoLidos(a1).length;
    grava({ tipo: 'li', t: Date.now(), quando: agora(), quem: a1 });
    console.log(`\n${n} recado(s) marcado(s) como lido(s) por ${a1}.\n`);
    break;
  }
  case 'tudo': {
    const quantos = parseInt(a1 || '20', 10);
    const r = lerTudo().filter(x => x.tipo === 'recado').slice(-quantos).reverse();
    mostra(r, `HISTÓRICO — últimos ${r.length}`);
    break;
  }
  default:
    console.log(fs.readFileSync(__filename, 'utf8').split('\n')
      .filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
}
