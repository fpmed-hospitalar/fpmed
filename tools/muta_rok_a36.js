/* ═══════════════════════════════════════════════════════════════════════════════════════════
   muta_rok_a36.js — A MUTAÇÃO DA CATRACA DO `r.ok` (fatia A36, 20/08/2026)

   ══ POR QUE ELA EXISTE ══════════════════════════════════════════════════════════════════════
   A `tests/testa_familia_rok.js` acabou de ficar verde sobre 60 `fetch`. Verde de suíte nova é
   exatamente o estado em que esta casa já foi enganada: as oito catracas da A31 davam verde
   sobre 320 linhas que elas não estavam lendo, e o bloco 4 da `testa_telemetria_adotada` do B
   ficou verde o tempo todo porque as fixtures dele foram escritas pela mesma mão que errou o
   nome do global.

   >>> ENTÃO A PROVA NÃO É "ela passou". É: **eu apago a conferência de um `fetch` de verdade,
       num arquivo de verdade, e a suíte tem que ficar VERMELHA.** Se ela não ficar, o verde
       dela não quer dizer nada — e é melhor descobrir isso agora do que no dia em que alguém
       apagar a conferência sem querer.
   >>> E A RESTAURAÇÃO É BYTE A BYTE, conferida por comprimento e por conteúdo. Uma mutação que
       deixa resíduo num arquivo de produção é pior que o defeito que ela procurava.

     node tools/muta_rok_a36.js
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');

/* ══ AS MUTAÇÕES — CADA UMA É UM DEFEITO QUE JÁ EXISTIU NESTE REPOSITÓRIO ═══════════════════
   Nenhuma delas é inventada: as três são a forma LITERAL que o código tinha até esta manhã, e
   estão aqui com o arquivo em que estavam. Mutação inventada prova que o detector acha o que eu
   imaginei; mutação histórica prova que ele acharia o que de fato aconteceu. */
const MUTACOES = [
  {
    nome: 'a Encontrar volta a ler o carimbo sem conferir o ok',
    arquivo: 'fpmed_licitacoes.html',
    de: '    if(!r.ok) return null;              // "n\u00e3o consegui perguntar" \u2014 e o selo tem estado pra isso\n',
    para: '',
  },
  {
    nome: 'o coletor do índice volta a ler o estado anterior sem conferir o ok',
    arquivo: 'tools/coleta_pncp.js',
    de: "    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));\n",
    para: '',
  },
  {
    nome: 'o watchdog volta a devolver NaN quando não pode contar',
    arquivo: 'tools/watchdog_pncp.js',
    de: '      if (!r.ok) return null;\n',
    para: '',
  },
  /* ══ A 3a FORMA TAMBÉM É MUTADA, e ela é a que mais parece inofensiva ═══════════════════════
     Juntar as duas saídas de novo é uma edição de um caractere de distância — é o tipo de
     "simplificação" que alguém faz de boa fé lendo duas linhas parecidas. Se a catraca não
     ficar vermelha aqui, ela não guarda a terceira forma. */
  {
    nome: 'o laço de paginação volta a juntar "página vazia" com "200 que não é lista"',
    arquivo: 'tools/coleta_itens_lote.js',
    de: '    if (!Array.isArray(lote)) throw new Error(base + \' -> 200, mas a resposta não é uma lista\');\n    if (!lote.length) break;\n',
    para: '    if (!Array.isArray(lote) || !lote.length) break;\n',
  },
];

function rodaSuite() {
  try {
    execFileSync(process.execPath, [path.join(RAIZ, 'tests', 'testa_familia_rok.js')],
      { cwd: RAIZ, stdio: 'pipe' });
    return { verde: true, saida: '' };
  } catch (e) {
    return { verde: false, saida: String(e.stdout || '') };
  }
}

let p = 0, f = 0;
console.log('=== MUTAÇÃO DA CATRACA DO `r.ok` (A36) ===\n');

const zero = rodaSuite();
if (zero.verde) { p++; console.log('  ✓ ponto de partida: a suíte está VERDE com o código como está'); }
else { f++; console.log('  ✗ ponto de partida JÁ VERMELHO — a mutação não mede nada assim:\n' + zero.saida); }

for (const m of MUTACOES) {
  const abs = path.join(RAIZ, m.arquivo);
  const original = fs.readFileSync(abs);
  const texto = original.toString('utf8');

  /* ══ AS DUAS PONTAS DE LINHA, E ESTA MUTAÇÃO JÁ ME PEGOU COM ELAS ═══════════════════════════
     Medido agora: o `fpmed_licitacoes.html` e o `watchdog_pncp.js` são CRLF (6.561 e 305) e o
     `coleta_pncp.js` é LF puro (424). Escritos com `\n` no alvo, dois dos três "não estavam
     mais lá" — e a mutação relatou como notícia o que era erro dela.
     >>> É O MESMO ERRO DE FORMA QUE ELA ESTÁ CAÇANDO, virado para dentro: eu confundi "não
         encontrei" com "não existe". A diferença é que aqui a mutação FALOU, em vez de dar
         verde — e é só por isso que eu vi. */
  const alvo = texto.includes(m.de) ? m.de
    : texto.includes(m.de.replace(/\n/g, '\r\n')) ? m.de.replace(/\n/g, '\r\n')
    : null;
  if (!alvo) {
    f++;
    console.log('  ✗ NÃO APLIQUEI "' + m.nome + '": o trecho não está mais em ' + m.arquivo);
    console.log('     (isto é notícia, não erro da mutação — alguém mexeu na conferência)');
    continue;
  }

  fs.writeFileSync(abs, texto.replace(alvo, m.para), 'utf8');
  const r = rodaSuite();
  /* A RESTAURAÇÃO VEM ANTES DO VEREDITO, e de propósito: se o assert abaixo levantar, o arquivo
     de produção já está inteiro. Deixar o restore depois do julgamento é como um `finally`
     esquecido vira um arquivo mutilado no repositório. */
  fs.writeFileSync(abs, original);
  const voltou = fs.readFileSync(abs);
  const intacto = voltou.length === original.length && voltou.equals(original);

  if (!r.verde) { p++; console.log('  ✓ ' + m.nome + ' → a suíte ficou VERMELHA'); }
  else { f++; console.log('  ✗ ESCAPOU: ' + m.nome + ' → a suíte continuou verde'); }

  if (intacto) { p++; console.log('      · ' + m.arquivo + ' restaurado byte a byte (' + original.length + ' bytes)'); }
  else { f++; console.log('      · ✗ RESTAURAÇÃO FALHOU em ' + m.arquivo + ' — CONFIRA À MÃO'); }
}

const fim = rodaSuite();
if (fim.verde) { p++; console.log('\n  ✓ ponto de chegada: a suíte voltou ao VERDE com tudo restaurado'); }
else { f++; console.log('\n  ✗ a suíte ficou VERMELHA no fim — sobrou resíduo de mutação:\n' + fim.saida); }

console.log('\nRESULTADO DA MUTAÇÃO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
