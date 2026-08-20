/* ═══════════════════════════════════════════════════════════════════════════════════════════
   prova_a37_congelado.js — AS 8 CATRACAS COM A GIOVANA DENTRO (fatia A37 · 20/08/2026)

   ══ O QUE ESTA PROVA RESPONDE ═══════════════════════════════════════════════════════════════
   A caixa pediu: *"as oito catracas rodadas com `fpmed_giovana.html` dentro de `adotadas`,
   mostrando 8 verdes e a linha nova do papel congelado com os 2 achados nomeados; mais um teste
   de mutação que QUEBRA se alguém alterar um byte de região congelada e a régua deixar passar"*.

   ══ E A LISTA É RESTAURADA BYTE A BYTE, PORQUE ADOTAR NÃO É ATO MEU ═════════════════════════
   `tests/telas_adotadas.json` diz, com as palavras de quem a escreveu: *"COMO UMA TELA ENTRA: no
   dia da fatia dela, quando o DONO DO TERRITÓRIO conserta a causa"*. A `fpmed_giovana.html` é do
   trabalhador B. O que esta fatia entrega é a FERRAMENTA ficando pronta, com o número medido —
   exatamente o que o A já fez na A31, e com a lista voltando idêntica no fim.
   >>> Se a prova terminasse com a linha movida, ela teria adotado a tela do outro pelas costas
       dele, e o `git status` da janela do B apareceria sujo sem ele ter escrito nada.

     node tools/prova_a37_congelado.js
     node tools/prova_a37_congelado.js --sem-mutacao   (só o placar das 8, sem mexer no HTML)
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const LISTA = path.join(RAIZ, 'tests', 'telas_adotadas.json');
const GIOVANA = path.join(RAIZ, 'fpmed_giovana.html');
const TELA = 'fpmed_giovana.html';

const CATRACAS = ['testa_cor_token', 'testa_espaco_token', 'testa_texto_piso', 'testa_icones',
                  'testa_toque_celular', 'testa_contraste', 'testa_tabela_densa', 'testa_numero_honesto'];

let p = 0, f = 0;
const conta = (c, msg, extra) => {
  if (c) { p++; console.log('  OK    ' + msg); }
  else { f++; console.log('  FALHA ' + msg + (extra !== undefined ? '\n        ' + extra : '')); }
};

function rodaCatraca(nome) {
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'tests', nome + '.js')],
    { cwd: RAIZ, encoding: 'utf8' });
  const saida = (r.stdout || '') + (r.stderr || '');
  const m = /RESULTADO: (\d+) ok, (\d+) falha/.exec(saida);
  return { nome, ok: m ? +m[1] : null, falhas: m ? +m[2] : null, verde: r.status === 0, saida };
}

// ── a lista, guardada em BYTES (não em texto): ela volta idêntica ou a prova reprova ──────────
const listaOriginal = fs.readFileSync(LISTA);
const htmlOriginal = fs.readFileSync(GIOVANA);

function comGiovanaDentro(fn) {
  const j = JSON.parse(listaOriginal.toString('utf8'));
  if (!j.adotadas.includes(TELA)) j.adotadas.push(TELA);
  j.pendentes = j.pendentes.filter(t => t !== TELA);
  fs.writeFileSync(LISTA, JSON.stringify(j, null, 2), 'utf8');
  try { return fn(); }
  finally { fs.writeFileSync(LISTA, listaOriginal); }
}

console.log('PROVA A37 — A RÉGUA SABE QUE O PAPEL ESTÁ CONGELADO\n');

// ══════════ 1. A PROVA DO PAPEL, ANTES DE TUDO ══════════
{
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'tools', 'prova_papel_congelado.js')],
    { cwd: RAIZ, encoding: 'utf8' });
  conta(r.status === 0, 'o papel está congelado e a impressão digital BATE — sem isso, nada abaixo vale',
    (r.stdout || '').trim().split('\n').slice(-3).join('\n        '));
}

// ══════════ 2. AS 8 CATRACAS COM A GIOVANA DENTRO ══════════
const placar = comGiovanaDentro(() => {
  console.log('\n── as 8 catracas, com ' + TELA + ' dentro de `adotadas` ──');
  return CATRACAS.map(nome => {
    const r = rodaCatraca(nome);
    console.log('   ' + (r.verde ? '✓' : '✗') + ' ' + nome.padEnd(22)
      + (r.ok == null ? 'SEM RESULTADO' : r.ok + ' ok' + (r.falhas ? ', ' + r.falhas + ' FALHA' : '')));
    return r;
  });
});

const verdes = placar.filter(r => r.verde).length;
const conferencias = placar.reduce((s, r) => s + (r.ok || 0), 0);
conta(verdes === 8, '*** AS 8 CATRACAS VERDES com a Giovana dentro (' + conferencias
  + ' conferências, ' + placar.reduce((s, r) => s + (r.falhas || 0), 0) + ' falha) ***',
  placar.filter(r => !r.verde).map(r => r.nome + ':\n' + r.saida).join('\n'));

// ══════════ 3. A LINHA NOVA, COM OS DOIS ACHADOS NOMEADOS ══════════
{
  const piso = placar.find(r => r.nome === 'testa_texto_piso');
  const icones = placar.find(r => r.nome === 'testa_icones');
  const linha = /achado\(s\) dentro do papel congelado por ordem do dono/;
  conta(linha.test(piso.saida) && linha.test(icones.saida),
    'a linha nova do papel congelado SAI nas catracas que tinham o achado');
  conta(/fpmed_giovana\.html:\d+\s+texto abaixo do piso\s+\[gerarPDF/.test(piso.saida),
    '*** achado 1 NOMEADO com arquivo, linha e região: o 10px dentro do `gerarPDF` ***',
    (piso.saida.match(/fpmed_giovana[^\n]*/g) || []).join('\n        '));
  conta(/fpmed_giovana\.html:\d+\s+pictograma escrito como texto\s+\[OBS_PADRAO/.test(icones.saida),
    '*** achado 2 NOMEADO com arquivo, linha e região: o ⚠ do `OBS_PADRAO` ***',
    (icones.saida.match(/fpmed_giovana[^\n]*/g) || []).join('\n        '));
  /* O NÚMERO DA LINHA TEM DE SER DOIS, e não "pelo menos dois": se a isenção começar a engolir
     achado que não é papel, é aqui que aparece. */
  const nomeados = [...new Set((piso.saida.match(/fpmed_giovana\.html:\d+[^\n]*/g) || [])
    .concat(icones.saida.match(/fpmed_giovana\.html:\d+[^\n]*/g) || []).map(s => s.trim()))];
  conta(nomeados.length === 2, '*** e são EXATAMENTE 2 — a isenção não engordou por dentro ***',
    nomeados.join('\n        '));
  console.log('        ' + nomeados.join('\n        '));
}

// ══════════ 4. A MUTAÇÃO: mudar UM BYTE do papel congelado e a régua NÃO pode deixar passar ══
if (!process.argv.includes('--sem-mutacao')) {
  console.log('\n── a mutação: um byte a mais dentro de região congelada ──');
  const texto = htmlOriginal.toString('utf8');
  /* O alvo é dentro do `gerarPDF`, que é a região que carrega o achado do piso. A mutação é uma
     que alguém faria de boa fé: "apagar o font-size:10px redundante, que a cascata já dá". Ela
     NÃO muda um pixel do papel — e mesmo assim a régua tem de gritar, porque a autorização para
     mexer ali é do dono e não do bom senso de quem lê. */
  const DE = 'font-size:10px', PARA = 'font-size:10.0px';
  const dentro = texto.indexOf('function gerarPDF()');
  const alvo = texto.indexOf(DE, dentro);
  if (alvo < 0 || dentro < 0) {
    f++; console.log('  FALHA nao achei o alvo da mutacao dentro do gerarPDF');
  } else {
    fs.writeFileSync(GIOVANA, texto.slice(0, alvo) + PARA + texto.slice(alvo + DE.length), 'utf8');
    const r = comGiovanaDentro(() => rodaCatraca('testa_texto_piso'));
    fs.writeFileSync(GIOVANA, htmlOriginal);          // restaura ANTES de julgar, sempre

    conta(!r.verde, '*** um byte trocado dentro do papel congelado -> a catraca PARA E GRITA ***',
      r.saida);
    conta(/O PAPEL CONGELADO MUDOU/.test(r.saida) && /isencao esta SUSPENSA/i.test(r.saida),
      '...e ela diz POR QUÊ: o papel mudou e a isenção está suspensa',
      (r.saida.match(/FALHA[^\n]*\n[^\n]*\n[^\n]*/) || [''])[0]);
    conta(/achado\(s\) dentro do papel congelado/.test(r.saida) === false
      || !/gerarPDF/.test((r.saida.split('>>>')[1] || '')),
      '...e a isenção daquela região NÃO vale mais — o achado volta a contar');
  }
}

// ══════════ 5. NADA FICOU MEXIDO ══════════
{
  const lista = fs.readFileSync(LISTA), html = fs.readFileSync(GIOVANA);
  conta(lista.equals(listaOriginal), 'a lista de adotadas voltou IDÊNTICA byte a byte ('
    + listaOriginal.length + ' -> ' + lista.length + ') — adotar é ato do dono do território');
  conta(html.equals(htmlOriginal), 'a ' + TELA + ' voltou IDÊNTICA byte a byte ('
    + htmlOriginal.length + ' -> ' + html.length + ')');
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'tools', 'prova_papel_congelado.js')],
    { cwd: RAIZ, encoding: 'utf8' });
  conta(r.status === 0, 'e a prova do papel volta VERDE no fim — não ficou defeito plantado');
}

console.log('\nRESULTADO: ' + p + ' de ' + (p + f));
process.exit(f ? 1 : 0);
