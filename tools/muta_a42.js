/* ══════════════════════════════════════════════════════════════════════════════════════════
   muta_a42.js — A CATRACA DO MOTOR MORDE? (fatia A42, 21/08/2026)

   Uma catraca verde não prova nada até alguém tentar passar por ela. Aqui eu estrago os
   `.bat.novo` de propósito, 14 vezes, e exijo que `tests/testa_motor_respira.js` FALHE nas 14.
   Se alguma mutação passar verde, a catraca tem um buraco — e o buraco é impresso com nome.

   >>> AS MUTAÇÕES SÃO DE BOA FÉ: são os erros que um humano cometeria mexendo neste .bat —
       tirar um `/b` que "parece sobrando", trocar `if not errorlevel 1` por `if errorlevel 1`
       (que se lê igual em voz alta e significa o contrário), digitar um "ç" no cabeçalho.

   >>> E A RESTAURAÇÃO É BYTE A BYTE: o arquivo original é lido em Buffer antes de tudo e
       reescrito no `finally`, e o tamanho é conferido no fim. Um mutador que deixa lixo no
       disco é pior do que nenhum.

     node tools/muta_a42.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const CATRACA = path.join(RAIZ, 'tests', 'testa_motor_respira.js');
const A = path.join(RAIZ, 'motor_A.bat.novo');
const B = path.join(RAIZ, 'motor_B.bat.novo');

const original = { [A]: fs.readFileSync(A), [B]: fs.readFileSync(B) };

/* Cada mutação: [alvo, nome, o que trocar, pelo quê]. `troca` string = literal; regex = regex. */
const MUTACOES = [
  [A, 'tira o /b do findstr (o "parece sobrando" que faz o motor dormir de caixa cheia)',
    'findstr /b /i /c:"SINAL: AGUARDE"', 'findstr /i /c:"SINAL: AGUARDE"'],
  [A, 'tira o /i (o sinal em minúscula deixa de ser sinal)',
    'findstr /b /i /c:"SINAL: AGUARDE"', 'findstr /b /c:"SINAL: AGUARDE"'],
  [A, '*** troca "if not errorlevel 1" por "if errorlevel 1" (lê-se igual, significa o contrário) ***',
    'if not errorlevel 1 goto dormir', 'if errorlevel 1 goto dormir'],
  [A, 'troca o 1 por 2 no errorlevel (a caixa sumida e a cheia trocam de lado)',
    'if not errorlevel 1 goto dormir', 'if not errorlevel 2 goto dormir'],
  [A, 'aponta o findstr para a caixa do B (motor do A obedecendo caixa alheia)',
    'set CAIXA=C:\\fpmed\\caixas\\CAIXA_A.md', 'set CAIXA=C:\\fpmed\\caixas\\CAIXA_B.md'],
  [A, 'troca uma palavra do PROMPT (o contrato da fábrica)',
    'execute a caixa inteira no regime nao-parar', 'execute a caixa toda no regime nao-parar'],
  [A, 'muda a espera de 600 para 1800 sem dizer a ninguém',
    '\nset ESPERA=600\n', '\nset ESPERA=1800\n'],
  [A, 'põe um "ç" no cabeçalho (mojibake justo no texto que o dono lê para trocar)',
    'DEU ERRADO?', 'DEU ERRADO, faça assim?'],
  /* Byte 0xFF na frente do `@echo off` — é o que sobra de um BOM salvo em página de código
     errada, e é o que faz o cmd reclamar logo na primeira linha do arquivo. */
  [A, 'põe um byte estranho na frente do @echo off (BOM salvo torto)', /^/, '\xFF'],
  [A, 'apaga a seção "O QUE SE PERDE" (a mudança fica só com a parte boa)',
    'rem  == O QUE SE PERDE =======================================================================',
    'rem  == O QUE MELHOROU ======================================================================='],
  [A, 'joga o passo a passo da troca para DEPOIS do código (o dono não vai rolar atrás dele)',
    /rem {4}1\. FECHE as duas janelas pretas[\s\S]*?rem\r?\n/, ''],
  [A, 'apaga o marcador INICIO do bloco (a prova perde o que recortar)',
    'rem == INICIO DO BLOCO DA RESPIRACAO', 'rem -- comeco do bloco'],
  [A, 'acrescenta uma linha que APAGA os logs "para limpar"',
    '\n:espera\n', '\ndel /q C:\\fpmed\\logs\\*.log\n:espera\n'],
  [B, 'faz o motor do B usar o título do A (duas janelas com o mesmo nome)',
    'title fpmed 2 (Trabalhador B - automatico)', 'title fpmed (Trabalhador A - automatico)'],

  /* ══ AS QUATRO DE BAIXO SÃO A A36, QUE MORA NO MESMO ARQUIVO ═══════════════════════════
     Escrevendo a A42 eu sobrescrevi este `.bat.novo` e apaguei a A36 sem notar. Ela voltou —
     e agora tem mutação própria, para que a próxima fatia que mexer aqui não a perca calada. */
  [A, '*** apaga a A36 inteira: o limite do plano volta a custar 10 min de porrada na porta ***',
    /rem == INICIO DO BLOCO DO LIMITE DO PLANO[\s\S]*?rem == FIM DO BLOCO DO LIMITE DO PLANO[^\r\n]*\r?\n/,
    'set ESPERA=600\r\nset MOTIVO=nova leitura da caixa em 10 min\r\n'],
  [A, 'deixa só "weekly limit" (cobre o que alguém lembrou de listar)',
    'findstr /i /c:"weekly limit" /c:"usage limit"', 'findstr /i /c:"weekly limit"'],
  [A, 'troca a espera do limite de 3600 para 600 (o respeito vira enfeite)',
    'set ESPERA=3600', 'set ESPERA=600'],
  [A, 'cala o rastro do limite no índice (1 hora parada sem dizer por quê)',
    /\n    echo \[%date% %time%\] ciclo %N%: LIMITE DO PLANO[^\n]*\n/, '\n'],
  [A, 'apaga o aviso ao arquiteto de que UMA troca entrega as duas fatias',
    'UMA troca entrega as duas', 'so a A42'],
];

console.log('=== MUTAÇÕES DE BOA FÉ NO MOTOR (fatia A42) ===\n');
console.log('  original A: ' + original[A].length + ' bytes · original B: ' + original[B].length + ' bytes\n');

let pegou = 0, escapou = 0;
const fugas = [];
try {
  for (let i = 0; i < MUTACOES.length; i++) {
    const [alvo, nome, de, para] = MUTACOES[i];
    const qual = alvo === A ? 'A' : 'B';
    let t = original[alvo].toString('latin1');
    const antes = t;
    t = typeof de === 'string' ? t.replace(de, para) : t.replace(de, para);
    if (t === antes) {
      escapou++; fugas.push(`${i + 1}. [${qual}] ${nome}  <-- A MUTAÇÃO NÃO APLICOU (o texto alvo não existe mais)`);
      console.log(`  ??   ${i + 1}. [${qual}] ${nome}\n         >>> não consegui aplicar — o texto alvo sumiu do .bat`);
      continue;
    }
    fs.writeFileSync(alvo, Buffer.from(t, 'latin1'));
    let falhou = false, saida = '';
    try { execFileSync('node', [CATRACA], { encoding: 'utf8' }); }
    catch (e) { falhou = true; saida = String(e.stdout || ''); }
    fs.writeFileSync(alvo, original[alvo]);

    if (falhou) {
      pegou++;
      const linha = (saida.split('\n').find(l => /FALHA/.test(l)) || '').trim();
      console.log(`  ok   ${i + 1}. [${qual}] ${nome}\n         pega por: ${linha.slice(0, 100)}`);
    } else {
      escapou++; fugas.push(`${i + 1}. [${qual}] ${nome}`);
      console.log(`  ESCAPOU ${i + 1}. [${qual}] ${nome}  <<< BURACO NA CATRACA`);
    }
  }
} finally {
  fs.writeFileSync(A, original[A]);
  fs.writeFileSync(B, original[B]);
}

console.log('\n── restauração ──');
let restOk = true;
for (const alvo of [A, B]) {
  const agora = fs.readFileSync(alvo);
  const igual = agora.equals(original[alvo]);
  if (!igual) restOk = false;
  console.log(`  ${igual ? 'ok  ' : 'FALHA'} ${path.basename(alvo)} restaurado byte a byte (${original[alvo].length} -> ${agora.length})`);
}

console.log('\nRESULTADO: ' + pegou + ' de ' + MUTACOES.length + ' mutações pegas' + (escapou ? ', ' + escapou + ' ESCAPOU(ARAM)' : ''));
if (fugas.length) { console.log('\n>>> BURACOS:'); fugas.forEach(l => console.log('    ' + l)); }
process.exitCode = (escapou || !restOk) ? 1 : 0;
