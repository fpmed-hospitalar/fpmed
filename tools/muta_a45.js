/* ══════════════════════════════════════════════════════════════════════════════════════════
   muta_a45.js — A CATRACA DA COBERTURA MORDE? (fatia A45, 21/08/2026)

   O medidor da A45 PUBLICA NÚMEROS, e número publicado vira decisão. A pior falha aqui não é
   travar: é imprimir, com confiança, uma projeção errada — foi o que ele fez na primeira
   escrita, anunciando +27.088 itens onde a conta certa dá +1.762.

   Estas 13 mutações são de boa fé: são os erros que um humano cometeria mexendo neste medidor
   — voltar à média por licitação, achar que `Number(null)` é seguro, concatenar a carência no
   SQL "que é só leitura mesmo".

     node tools/muta_a45.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const CATRACA = path.join(RAIZ, 'tests', 'testa_cobertura_resultado.js');
const ALVO = path.join(RAIZ, 'tools', 'mede_cobertura_resultado.js');
const original = fs.readFileSync(ALVO);

const MUTACOES = [
  ['*** volta a projetar por licitações × rendimento médio (o erro que a fatia cometeu) ***',
    'return Math.round(pendentes * taxa);', 'return Math.round(pendentes * 9.5);'],
  ['*** "não medi" volta a virar "medi e deu zero" (o Number(null) === 0) ***',
    'if (o == null || o.itensPendentes == null || o.taxaResposta == null) return null;', ''],
  ['aceita taxa acima de 100% (a projeção passa a inventar itens)',
    '|| taxa < 0 || taxa > 1) return null;', '|| taxa < 0) return null;'],
  ['deixa "perguntei 0" virar taxa 0% em vez de "não sei"',
    'if (!isFinite(p) || p <= 0 || !isFinite(s) || s < 0 || s > p) return null;',
    'if (!isFinite(p) || p < 0) return null;'],
  ['aceita banco inconsistente (sem-resultado maior que perguntados)',
    ' || s < 0 || s > p) return null;', ' || s < 0) return null;'],
  ['faz o rendimento cair num valor de partida em vez de devolver null',
    'return (lics > 0 && isFinite(itens)) ? itens / lics : null;',
    'return (lics > 0 && isFinite(itens)) ? itens / lics : 6.0;'],
  ['*** concatena a carência no SQL ("é só leitura mesmo") ***',
    "($1 || ' days')::interval", "(' 7 days')::interval"],
  ['põe um UPDATE no medidor que só deveria ler',
    'select\n    (select count(*) from licitacao_itens)',
    'select\n    (select count(*) from licitacao_itens where id in (update x set y=1 returning id))'],
  ['para de separar "perguntou e não há" de "não perguntei"',
    'as perguntou_sem_resultado', 'as ignorado_1'],
  ['some com a medição do gargalo (as da dívida sem item lido)',
    'as divida_sem_itens_lidos', 'as ignorado_2'],
  ['copia o `planoDaRodada` em vez de importá-lo do coletor',
    "const { planoDaRodada, CARENCIA_DIAS } = require('./coleta_resultado_item.js');",
    "const CARENCIA_DIAS = 7; function planoDaRodada(o) { return { segPorLic: 6, cabe: 150 }; }"],
  ['tira o portão do require.main (a catraca passa a abrir conexão com o banco)',
    'if (require.main !== module) return;', ''],
  ['apaga a frase que devolve ao dono a decisão de produto',
    'DECISÃO DE PRODUTO, NÃO MINHA', 'DECIDI POR ELE'],
];

console.log('=== MUTAÇÕES DE BOA FÉ NO MEDIDOR DE COBERTURA (fatia A45) ===\n');
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
      const linha = (saida.split('\n').find(l => /FALHA/.test(l)) || saida.split('\n')[0] || '').trim();
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
console.log(`  ${igual ? 'ok  ' : 'FALHA'} mede_cobertura_resultado.js restaurado byte a byte (${original.length} -> ${agora.length})`);

console.log('\nRESULTADO: ' + pegou + ' de ' + MUTACOES.length + ' mutações pegas' + (escapou ? ', ' + escapou + ' ESCAPOU(ARAM)' : ''));
if (fugas.length) { console.log('\n>>> BURACOS:'); fugas.forEach(l => console.log('    ' + l)); }
process.exitCode = (escapou || !igual) ? 1 : 0;
