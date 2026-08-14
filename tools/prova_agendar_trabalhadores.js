/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_agendar_trabalhadores.js — O AGENDAMENTO DOS MOTORES, CONFERIDO (fatia A26, 14/08/2026)

   ══ O QUE ESTA PROVA TEM QUE EVITAR ═══════════════════════════════════════════════════════
   A regra da casa: *"nunca prova que só lê o próprio código-fonte quando há servidor no
   caminho — pergunte ao servidor."* Aqui o servidor é o AGENDADOR DO WINDOWS. Ler o .bat e
   dizer "está certo" seria conferir a minha própria opinião.

   Então a prova tem três camadas, e as duas últimas são as que valem:
     1. O TEXTO do .bat (o menu, o aviso das duas cópias, as duas tarefas, o desligar).
     2. A LINHA DE COMANDO, expandida pelo PRÓPRIO cmd.exe. O único jeito de o `/tr` sair errado
        é o escape das aspas, e escape é coisa que ninguém acerta de olho: aqui a linha é
        executada de verdade contra um eco de argumentos, e o que o `schtasks` receberia é
        impresso e comparado com o caminho real no disco.
     3. O AGENDADOR, perguntado. Tenta `/create`, `/query` e `/delete` de verdade. Se a máquina
        recusar por falta de elevação, isso NÃO é falha do .bat — é a resposta do Windows, e ela
        é impressa como PENDÊNCIA DO DONO em vez de virar um "ok" mentiroso.

   >>> E O QUE ELA NÃO FAZ: instalar. A tarefa criada nesta prova é APAGADA no mesmo passo, e
       ela tem nome próprio (`_PROVA`) para nunca se confundir com a de verdade. Instalar tarefa
       permanente na máquina do dono é decisão dele.

     node tools/prova_agendar_trabalhadores.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) { p++; console.log('  ok   ' + t); } else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

const BAT = path.join(RAIZ, 'AGENDAR_TRABALHADORES.bat');
console.log('=== O AGENDAMENTO DOS MOTORES (fatia A26) ===\n');

// ══ 1. O TEXTO ════════════════════════════════════════════════════════════════════════════
const txt = fs.readFileSync(BAT, 'latin1');
console.log('── 1. o .bat e o que ele diz ──');
ok(n++ + '. o arquivo existe e não está vazio', txt.length > 500, txt.length);
ok(n++ + '. cria a tarefa do A apontando para motor_A.bat',
  /schtasks \/create \/tn "FPMED_MOTOR_A"[\s\S]{0,80}motor_A\.bat/.test(txt));
ok(n++ + '. cria a tarefa do B apontando para motor_B.bat',
  /schtasks \/create \/tn "FPMED_MOTOR_B"[\s\S]{0,80}motor_B\.bat/.test(txt));
ok(n++ + '. as duas sobem NO LOGON (é disso que a fatia trata)',
  (txt.match(/\/sc onlogon/g) || []).length === 2, (txt.match(/\/sc onlogon/g) || []).length);
/* O AVISO TEM QUE VIR ANTES DA ESCOLHA. Um alerta depois do clique é decoração. */
ok(n++ + '. *** o aviso das DUAS CÓPIAS aparece ANTES da linha da opção [1] ***',
  /DUAS copias/i.test(txt) && txt.search(/DUAS copias/i) < txt.search(/\[1\] LIGAR/));
ok(n++ + '. ...e instalar exige confirmação digitada (um Enter de sobra não instala nada)',
  /set \/p CF=/.test(txt) && /if \/i not "%CF%"=="SIM"/.test(txt));
ok(n++ + '. a opção 2 remove AS DUAS tarefas (meia remoção deixaria a fábrica torta)',
  /\/delete \/tn "FPMED_MOTOR_A"/.test(txt) && /\/delete \/tn "FPMED_MOTOR_B"/.test(txt));
ok(n++ + '. tem o [3] VER, que é como o dono confere sem instalar nada',
  /\[3\] VER/.test(txt) && /\/query \/tn "FPMED_MOTOR_A"/.test(txt));
/* O atraso de 30 s não é capricho: motor que nasce antes da rede erra a primeira leitura da
   caixa e só tenta de novo 10 minutos depois. */
ok(n++ + '. sobe com atraso (a rede da máquina ainda está subindo no logon)',
  (txt.match(/\/delay 0000:30/g) || []).length === 2);
ok(n++ + '. e ele NÃO inicia motor nenhum agora — só registra', !/^\s*start /mi.test(txt));
/* MEDIDO nesta máquina: `schtasks /create` sem elevação responde "Acesso negado". Descobrir
   isso depois de digitar SIM é fazer o dono perder o clique — a checagem tem que vir ANTES. */
ok(n++ + '. *** avisa da falta de elevação ANTES de pedir a confirmação ***',
  /net session >nul 2>&1/.test(txt) && txt.search(/net session/) < txt.search(/set \/p CF=/));

// ══ 2. OS CAMINHOS, E A LINHA EXPANDIDA PELO PRÓPRIO cmd.exe ══════════════════════════════
console.log('\n── 2. a linha de comando, expandida pelo cmd (não pela minha leitura) ──');
for (const m of ['motor_A.bat', 'motor_B.bat']) {
  ok(n++ + `. ${m} existe no disco (tarefa que aponta para o vazio falha calada)`,
    fs.existsSync(path.join(RAIZ, m)));
}
const ECO = path.join(__dirname, '_eco_args.js');
fs.writeFileSync(ECO, 'console.log(JSON.stringify(process.argv.slice(1)));\n');
try {
  for (const [alvo, quem] of [['motor_A.bat', 'A'], ['motor_B.bat', 'B']]) {
    const linha = `node "${ECO}" /create /tn "FPMED_MOTOR_${quem}" /tr "\\"C:\\fpmed\\${alvo}\\"" /sc onlogon /delay 0000:30 /f`;
    const saida = execSync(linha, { shell: 'cmd.exe', encoding: 'utf8' });
    const args = JSON.parse(saida);
    const i = args.indexOf('/tr');
    const valor = i > -1 ? args[i + 1] : null;
    const semAspas = String(valor || '').replace(/^"|"$/g, '');
    console.log(`    /tr do ${quem} chega ao schtasks como: ${JSON.stringify(valor)}`);
    ok(n++ + `. *** o /tr do ${quem} é o caminho certo, entre aspas, sem escape sobrando ***`,
      valor === `"C:\\fpmed\\${alvo}"`, valor);
    ok(n++ + `. ...e esse caminho existe mesmo no disco`, fs.existsSync(semAspas), semAspas);
  }
} finally { try { fs.unlinkSync(ECO); } catch (e) { } }

// ══ 3. O AGENDADOR, PERGUNTADO ════════════════════════════════════════════════════════════
console.log('\n── 3. perguntando ao Agendador do Windows (create -> query -> delete) ──');
const NOME = 'FPMED_MOTOR_A_PROVA';
const sch = (args) => {
  try { return { saida: execFileSync('schtasks', args, { encoding: 'latin1' }), erro: null }; }
  catch (e) { return { saida: String(e.stdout || '') + String(e.stderr || ''), erro: true }; }
};
const criou = sch(['/create', '/tn', NOME, '/tr', '"C:\\fpmed\\motor_A.bat"', '/sc', 'onlogon', '/delay', '0000:30', '/f']);
if (criou.erro) {
  const negado = /negado|denied/i.test(criou.saida);
  console.log('    o Agendador RECUSOU: ' + criou.saida.trim().split('\n')[0]);
  /* Recusa por elevação não é defeito do .bat — é a máquina dizendo "isto é decisão de
     administrador". Declarar isso é mais honesto do que passar um "ok" que ninguém mediu. */
  ok(n++ + '. o Agendador respondeu (não ficou mudo)', criou.saida.trim().length > 0);
  console.log('\n    >>> PENDÊNCIA DO DONO: o registro da tarefa exige ELEVAÇÃO nesta máquina.');
  console.log('        Esta prova NÃO conseguiu registrar, e por isso NÃO declara registrado.');
  console.log('        Quem prova o resto é o próprio .bat, aberto como Administrador,');
  console.log('        na opção [3] VER depois da [1] LIGAR.');
  if (!negado) { f++; console.log('  FALHA ' + (n++) + '. a recusa não foi por permissão — leia a mensagem acima'); }
} else {
  const q = sch(['/query', '/tn', NOME, '/v', '/fo', 'list']);
  const linhaTr = (q.saida.split('\n').find(l => /motor_A\.bat/i.test(l)) || '').trim();
  console.log('    /query devolveu: ' + (linhaTr || '(não achei a linha do executável)'));
  ok(n++ + '. *** a tarefa registrada aponta para C:\\fpmed\\motor_A.bat ***',
    /C:\\fpmed\\motor_A\.bat/i.test(q.saida), linhaTr);
  ok(n++ + '. ...e o gatilho registrado é o logon',
    /logon|Ao fazer logon/i.test(q.saida));
  const del = sch(['/delete', '/tn', NOME, '/f']);
  const sumiu = sch(['/query', '/tn', NOME]);
  ok(n++ + '. e a tarefa de prova foi APAGADA (nada permanente ficou na máquina)',
    !!del && !!sumiu.erro);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
