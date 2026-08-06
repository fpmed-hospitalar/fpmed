// SUITE testa_abrir_fila — DOIS CLIQUES TEM QUE COMECAR A RODADA **DO JEITO COMBINADO**.
//
// Item 11. O que ele pediu: fechar tudo, dar 2 cliques e a fila roda sozinha.
//
// >>> O MECANISMO ja existia (`claude --dangerously-skip-permissions "<prompt>"`, confirmado no
//     --help: `claude [options] [prompt]` abre sessao interativa com o prompt). O QUE ESTAVA
//     ERRADO era o CONTEUDO: os dois .bat mandavam textos DIFERENTES. O ABRIR_FILA.bat mandava
//     so "continua a fila" -- sem "nunca DELETE/UPDATE sem OK", sem "commit + CONTINUAR + push
//     a cada task", sem "relatorio unico". Dois cliques abriam uma rodada automatica com
//     CONTRATO MAIS FRACO que o da rodada manual, e ninguem notaria ate a rodada fazer algo
//     que a regra proibia.
//
// >>> POR ISSO O PROMPT VIVE NUM ARQUIVO SO. Esta suite existe pra que os dois nunca mais
//     divirjam, e pra travar os detalhes de batch que quebram em silencio (delims, BOM, %).
//
//   node tests/testa_abrir_fila.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = p => path.join(__dirname, '..', p);
const bytes = fs.readFileSync(raiz('.claude/prompt_fila.txt'));
const prompt = bytes.toString('utf8');
const fila = fs.readFileSync(raiz('ABRIR_FILA.bat'), 'utf8');
const total = fs.readFileSync(raiz('ABRIR_CLAUDE_TOTAL.bat'), 'utf8');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_abrir_fila — 2 cliques abrem a rodada com o contrato certo\n');

// ══════════ 1. O ARQUIVO DO PROMPT — detalhes de batch que quebram calados ══════════
ok('1. o prompt da rodada existe', prompt.trim().length > 80, prompt.length);
ok('2. *** UMA linha so ***', prompt.trim().split(/\n/).length === 1, prompt.trim().split(/\n/).length);
// o `for /f` guarda a ULTIMA linha lida: um arquivo de 3 linhas mandaria so a 3a, e o .bat
// abriria a rodada com um pedaco do contrato -- sem erro nenhum na tela.
ok('3. *** sem BOM ***', !(bytes[0] === 0xEF && bytes[1] === 0xBB), [bytes[0], bytes[1]]);
// com BOM, os 3 primeiros bytes entram no comando e a 1a palavra do prompt chega corrompida.
ok('4. *** so ASCII ***', !bytes.some(b => b > 127));
// o console do .bat e chcp 65001, mas o `for /f` le pelo codepage do processo: acento vira
// caractere trocado no meio da instrucao.
ok('5. *** sem aspas duplas (fechariam o argumento no meio) ***', !prompt.includes('"'));
ok('6. *** sem % (o cmd expandiria como variavel e comeria o texto) ***', !prompt.includes('%'));

// ══════════ 2. O CONTRATO DA RODADA — o que nao pode faltar ══════════
ok('7. manda ler o CONTINUAR_AQUI', /CONTINUAR_AQUI/.test(prompt));
ok('8. manda seguir a fila NA ORDEM e sozinho', /fila de tarefas na ordem/.test(prompt) && /sozinho/.test(prompt));
ok('9. *** proibe DELETE/DROP/TRUNCATE/UPDATE de dado sem OK ***',
  /DELETE\/DROP\/TRUNCATE\/UPDATE de dados sem OK/.test(prompt));
ok('10. ...e diz o que fazer no lugar (pula e anota)', /pula e anota/.test(prompt));
ok('11. decisao de negocio acumula pro checkpoint, nao e decidida sozinha',
  /Decisao de negocio acumula/.test(prompt));
ok('12. *** commit + CONTINUAR + push a cada task ***', /Commit \+ CONTINUAR \+ push a cada task/.test(prompt));
ok('13. relatorio unico no fim', /relatorio unico/.test(prompt));

// ══════════ 3. OS DOIS .BAT NAO PODEM DIVERGIR ══════════
for (const [nome, src] of [['ABRIR_FILA', fila], ['ABRIR_CLAUDE_TOTAL', total]]) {
  ok(`14.${nome} — le o prompt do arquivo unico`,
    /\.claude\\prompt_fila\.txt/.test(src) && /for \/f "usebackq delims=" %%p in \(".claude\\prompt_fila.txt"\) do set "FILA=%%p"/.test(src));
  ok(`15.${nome} — *** usa delims= (sem isso o prompt seria cortado no 1o ESPACO) ***`,
    /"usebackq delims="/.test(src));
  ok(`16.${nome} — passa o prompt inteiro, entre aspas`,
    /claude --dangerously-skip-permissions "%FILA%"/.test(src));
  ok(`17.${nome} — *** nao tem prompt escrito na unha (era assim que os dois divergiam) ***`,
    !/claude --dangerously-skip-permissions "[A-Za-z]/.test(src));
  ok(`18.${nome} — sem o arquivo de prompt, ABORTA em vez de abrir rodada sem contrato`,
    /if not defined FILA \(/.test(src) && /exit \/b 1/.test(src));
  ok(`19.${nome} — confere o "claude" ANTES do backup (falhar cedo custa menos)`,
    src.indexOf('where claude') > -1 && src.indexOf('where claude') < src.indexOf('backup_tabelas.js'));
  ok(`20.${nome} — janela nao fecha calada no erro (tem pause)`, /pause/.test(src));
  ok(`21.${nome} — backup que falha NAO vira rodada automatica`,
    /goto backupfail/.test(src) && /BACKUP FALHOU/.test(src));
}
ok('22. *** e o motivo da divergencia esta registrado nos dois, pra ninguem "simplificar" de volta ***',
  /mandavam prompts DIFERENTES|carregavam textos diferentes/.test(fila + total));

// ══════════ 4. O QUE ESTA SUITE **NAO** PROVA — dito, pra nao virar teste falso ══════════
// Ele pediu "fechar tudo, dar 2 cliques e confirmar que retoma sozinho". Isso NAO da pra
// validar de dentro de uma sessao em andamento: lancar o .bat daqui abriria uma sessao
// ANINHADA, que e exatamente o cenario que o teste nao quer provar. O que da pra garantir
// daqui e o que esta acima -- o comando montado, o contrato certo e as saidas de erro.
// A prova final e o proximo boot dele.
ok('23. a limitacao esta registrada no TAREFAS, e nao escondida',
  /não dá pra validar de dentro de uma sessão\s+em\s*\*{0,2}\s*andamento/.test(fs.readFileSync(raiz('TAREFAS_FPMED.md'), 'utf8')));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
