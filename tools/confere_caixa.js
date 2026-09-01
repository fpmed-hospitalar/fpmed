// confere_caixa.js — O ARQUITETO ESTÁ FUNCIONANDO?
//
// 01/09/2026 (A49). O dono perguntou uma coisa que a fábrica nunca soube responder sozinha:
// *"testar para ver se o arquiteto está funcionando"*.
//
// Até hoje isso se respondia no olho — alguém abria a caixa e achava que estava boa. Mas
// "o arquiteto trabalhou" tem sinais objetivos, e eles são os mesmos que a caixa cobra dos
// trabalhadores: sinal ligado, fila com mais de uma fatia, critério em NÚMERO, ordem
// declarada, território dito. Isto aqui mede esses sinais e devolve um veredito.
//
// >>> O QUE ELE NÃO FAZ: julgar se a fatia é uma BOA IDEIA. Isso é do dono. Ele mede se a
//     caixa está EXECUTÁVEL — se um trabalhador consegue pegar e começar sem perguntar nada.
//     Caixa executável com ideia ruim é problema de rumo; caixa não-executável trava a
//     fábrica, que é o que aconteceu por onze dias.
//
//   node tools/confere_caixa.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');

const CAIXAS = ['CAIXA_A.md', 'CAIXA_B.md'];
let problemas = 0, avisos = 0;

console.log('\n=== O ARQUITETO ESTÁ FUNCIONANDO? — leitura das duas caixas ===\n');

for (const nome of CAIXAS) {
  const arq = path.join(raiz, 'caixas', nome);
  if (!fs.existsSync(arq)) { console.log(`${nome}: NÃO EXISTE`); problemas++; continue; }

  const txt = fs.readFileSync(arq, 'utf8');
  const linhas = txt.split(/\r?\n/);
  const idade = Math.floor((Date.now() - fs.statSync(arq).mtimeMs) / 86400000);

  const sinal = (linhas[0].match(/SINAL:\s*(\w+)/i) || [])[1] || '(nenhum)';
  const trabalhe = /^trabalhe$/i.test(sinal);

  // As fatias: blocos "### A50 — ..." ou "## B37 — ...". O identificador é o que o
  // trabalhador cita no commit e no relatório, então fatia sem identificador não presta contas.
  const fatias = [...txt.matchAll(/^#{2,3}\s+([AB]\d{2,3})\s*[—\-·]/gm)].map(m => m[1]);

  console.log(`── ${nome}  (tocada há ${idade} dia(s))`);
  console.log(`   SINAL ............ ${sinal}`);
  console.log(`   fatias na fila ... ${fatias.length}${fatias.length ? '  (' + fatias.join(', ') + ')' : ''}`);

  if (!trabalhe) {
    // AGUARDE só é legítimo logo depois de uma entrega. AGUARDE velho é fábrica parada.
    if (idade >= 2) { console.log(`   >>> PARADA: em ${sinal} há ${idade} dias. O gargalo é a caixa vazia.`); problemas++; }
    else            { console.log(`   (em ${sinal}, mas recém-tocada — pode ser entrega de hoje)`); avisos++; }
  }

  if (trabalhe && fatias.length === 0) {
    console.log('   >>> QUEBRADO: SINAL diz TRABALHE mas não há fatia nenhuma para puxar.');
    problemas++;
  }

  if (trabalhe && fatias.length === 1) {
    console.log('   >>> AVISO: uma fatia só. A lei da caixa pede FILA — com uma, o arquiteto');
    console.log('       volta a ser gargalo assim que ela fechar (foi a cicatriz das 17 horas).');
    avisos++;
  }

  if (fatias.length) {
    // Critério em número: sem isso o trabalhador não sabe quando terminou, e "pronto" vira opinião.
    const temNumero = /\b\d{1,3}([.,]\d{3})*([.,]\d+)?\s*(%|bytes|linhas|itens|tabelas|asserts|MB|KB|dias|min|segundos|:1)\b/i.test(txt)
                   || /\bde\s+\d+\s+(para|a)\s+\d+\b/i.test(txt);
    if (!temNumero) { console.log('   >>> AVISO: nenhum critério em NÚMERO. Sem número, "pronto" é opinião.'); avisos++; }

    const temOrdem = /##\s*ORDEM|→\s*[AB]\d{2,3}|puxe a próxima/i.test(txt);
    if (!temOrdem) { console.log('   >>> AVISO: a ordem das fatias não está declarada.'); avisos++; }

    const temTerritorio = /territ[óo]rio|NÃO toca|nao toca/i.test(txt);
    if (!temTerritorio) { console.log('   >>> AVISO: território não declarado — risco de as duas janelas colidirem.'); avisos++; }
  }
  console.log('');
}

console.log('─────────────────────────────────────────');
if (problemas) {
  console.log(`VEREDITO: O ARQUITETO NÃO ESTÁ FUNCIONANDO — ${problemas} bloqueio(s), ${avisos} aviso(s).`);
  console.log('A fábrica não anda enquanto isso não for resolvido: os trabalhadores não podem');
  console.log('se auto-atribuir tarefa (isso fura a fila), então caixa vazia = fábrica parada.');
  process.exit(1);
}
console.log(`VEREDITO: O ARQUITETO ESTÁ FUNCIONANDO — 0 bloqueio(s), ${avisos} aviso(s).`);
console.log('As caixas estão executáveis: um trabalhador pega e começa sem perguntar nada.');
