/* ═══════════════════════════════════════════════════════════════════════════════════════════
   muta_a39.js — A CATRACA DO RELATORIO EM PEDACOS, PROVADA VERMELHA (fatia A39 · 20/08/2026)

   Uma suite que nunca ficou vermelha e indistinguivel de uma suite quebrada — a A31 desta casa
   pagou caro por isso (oito catracas verdes sobre 320 linhas que elas nao liam). Entao a
   `tests/testa_relatorio_parcial.js` nao vale nada ate alguem QUEBRAR a regra no arquivo DE
   VERDADE e ela gritar.

   As sete mutacoes sao as que alguem faria de boa fe. A primeira e a mais perigosa e a mais
   plausivel de todas: trocar o "escreve num temporario e renomeia" por um `writeFileSync` direto,
   que e o que qualquer um escreveria sem pensar — e que troca um relatorio completo por um
   arquivo pela metade na primeira queda no meio da escrita.

   O alvo e sempre um trecho DE UMA LINHA SO: a mutacao da A36 se enganou sozinha procurando alvo
   com `\n` num arquivo CRLF e relatou "o trecho nao esta mais la", que e o mesmo defeito que ela
   cacava. E a restauracao e conferida BYTE A BYTE.

     node tools/muta_a39.js
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ALVO = path.join(RAIZ, 'tools', 'relatorio_parcial.js');
const SUITE = path.join(RAIZ, 'tests', 'testa_relatorio_parcial.js');

/* [ nome, trecho procurado, trecho trocado, que assert tem de gritar ] */
const MUTACOES = [
  ['a gravacao atomica vira `writeFileSync` direto (o truncamento, escrito de boa fe)',
   '  fs.renameSync(tmp, caminho);  // atômico no mesmo volume: ou o velho inteiro, ou o novo inteiro',
   '  fs.writeFileSync(caminho, novo, \'utf8\');',
   '18, 21, 23'],

  ['o fsync some — o rename pode chegar ao disco antes do conteudo',
   '    fs.fsyncSync(fd);           // sem isto o rename pode chegar ao disco antes do conteúdo',
   '    void fd;',
   '22'],

  ['bloco vazio passa a ser aceito (cabecalho sozinho dizendo que a fatia foi prestada)',
   '  if (!corpo && !interrompida) {',
   '  if (false) {',
   '6, 26'],

  ['o bloco novo vai pro RODAPE — quem abre o relatorio le a rodada 1 primeiro',
   '  const novo = bloco + separador + velho;',
   '  const novo = velho + separador + bloco;',
   '14, 15, 16'],

  ['o que estava embaixo e jogado fora a cada fatia (o relatorio vira so o ultimo bloco)',
   '  const novo = bloco + separador + velho;',
   '  const novo = bloco;',
   '15, 17, 20'],

  ['a frase da interrupcao vira texto livre — procurar por ela vira leitura de texto corrido',
   "  'interrompida por ' + (motivo || 'rede') + ' às ' + soHora(d);",
   "  'não terminou';",
   '8, 9, 12'],

  ['a interrupcao para de dizer a HORA (fica "morreu", sem quando)',
   "  'interrompida por ' + (motivo || 'rede') + ' às ' + soHora(d);",
   "  'interrompida por ' + (motivo || 'rede');",
   '8, 12'],
];

function rodaSuite() {
  const r = spawnSync(process.execPath, [SUITE], { cwd: RAIZ, encoding: 'utf8' });
  const m = /RESULTADO: (\d+) ok, (\d+) falha/.exec(r.stdout || '');
  return { vermelha: r.status !== 0, ok: m ? +m[1] : null, falhas: m ? +m[2] : null,
           saida: (r.stdout || '') + (r.stderr || '') };
}

const original = fs.readFileSync(ALVO);          // Buffer: bytes, nao texto
const texto = original.toString('utf8');

console.log('MUTACAO DA CATRACA DO RELATORIO EM PEDACOS — ' + path.relative(RAIZ, ALVO) + '\n');

const partida = rodaSuite();
let p = 0, f = 0;
const conta = (c, msg) => { if (c) { p++; console.log('  OK   ' + msg); } else { f++; console.log('  FALHA ' + msg); } };
conta(!partida.vermelha, 'a suite parte VERDE (' + partida.ok + ' asserts) — sem isso nada abaixo mede nada');
if (partida.vermelha) { console.log(partida.saida); process.exit(1); }

for (const [nome, de, para, quem] of MUTACOES) {
  const achou = texto.indexOf(de);
  if (achou < 0) { f++; console.log('  FALHA  o trecho nao esta no arquivo: ' + nome); continue; }
  if (texto.indexOf(de, achou + 1) >= 0) { f++; console.log('  FALHA  o trecho aparece mais de uma vez: ' + nome); continue; }

  fs.writeFileSync(ALVO, texto.replace(de, para), 'utf8');
  const r = rodaSuite();
  fs.writeFileSync(ALVO, original);               // restaura ANTES de julgar, sempre

  conta(r.vermelha, nome + '  ->  VERMELHA (esperado nos asserts ' + quem + '; deu '
    + (r.falhas == null ? 'sem resultado' : r.falhas + ' falha(s)') + ')');
}

const depois = fs.readFileSync(ALVO);
conta(depois.equals(original), 'o arquivo voltou IDENTICO byte a byte (' + original.length
  + ' bytes -> ' + depois.length + ')');

const fim = rodaSuite();
conta(!fim.vermelha, 'e a suite volta VERDE no fim (' + fim.ok + ' asserts) — nao ficou defeito plantado');

console.log('\nRESULTADO: ' + p + ' de ' + (p + f));
if (f) process.exit(1);
