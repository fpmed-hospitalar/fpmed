/* ══════════════════════════════════════════════════════════════════════════════════════════
   testa_motor_respira.js — O MOTOR NÃO ACORDA O CLAUDE NO AGUARDE (fatia A42, 21/08/2026)

   ══ O QUE ESTA CATRACA TEM QUE EVITAR ═════════════════════════════════════════════════════
   Regra da casa (A26): *"nunca prova que só lê o próprio código-fonte quando há um servidor no
   caminho"*. Aqui o "servidor" é o **cmd.exe**, e ele é um intérprete de humor difícil:
   `if not errorlevel 1` significa "menor que 1", `%VAR%` expande na hora do PARSE e não da
   execução, e um `/b` a menos muda o significado da linha inteira. Ler o .bat e dizer "está
   certo" seria conferir a minha própria opinião sobre uma linguagem que ninguém acerta de
   olho.

   Então são três camadas, e a 2ª é a que vale:
     1. O TEXTO dos dois `.bat.novo` (o passo a passo da troca, o prompt intacto, ASCII puro).
     2. O BLOCO DA RESPIRAÇÃO, **recortado do .bat.novo e executado pelo cmd.exe de verdade**
        contra caixas de mentira — inclusive as três que o desenho precisa acertar: a linha de
        ajuda que contém a palavra AGUARDE, a caixa que sumiu, e a caixa vazia.
     3. AS CAIXAS DE VERDADE: o veredito do cmd contra `caixas\CAIXA_A.md` e `CAIXA_B.md` de
        agora tem que bater com o que a primeira linha delas diz.

   >>> O QUE ELA NÃO FAZ: trocar o motor. Os `.bat.novo` ficam ao lado dos `.bat` e o `.bat`
       de hoje continua intocado — o cmd.exe relê o .bat de dentro do laço, então a troca é do
       DONO, com as duas janelas fechadas. O passo a passo está no cabeçalho do `.bat.novo`.

     node tests/testa_motor_respira.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
let p = 0, f = 0, n = 1;
const ok = (t, c, e) => {
  if (c) { p++; console.log('  ok   ' + t); }
  else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); }
};

console.log('=== O MOTOR RESPIRA NO AGUARDE (fatia A42) ===\n');

// ⚠ A TROCA ACONTECEU — 01/09/2026, pela mão do dono, com as janelas fechadas (A51).
// Esta suíte nasceu na A42, quando o motor novo ainda esperava em `.bat.novo` ao lado do
// `.bat` em uso. Depois da troca os dois nomes andaram um degrau:
//     motor_A.bat.novo  ->  motor_A.bat          (o novo, agora em uso)
//     motor_A.bat       ->  motor_A.bat.velho    (o antigo, guardado para desfazer)
// Só os NOMES mudaram aqui. A suíte continua provando exatamente o mesmo: o texto do motor em
// uso, o bloco da respiração executado pelo cmd.exe de verdade, e o veredito contra as caixas
// reais. `novo` = o que está rodando hoje; `velho` = o de antes, que serve de referência para
// o assert byte a byte do prompt.
// >>> NÃO renomeie de volta para .bat.novo: se esta suíte voltar a procurar um `.bat.novo`,
//     ela passa a medir um arquivo que não existe mais e vira 38 falhas de mentira.
const MOTORES = [
  { quem: 'A', velho: 'motor_A.bat.velho', novo: 'motor_A.bat', caixa: 'CAIXA_A.md', titulo: 'fpmed (Trabalhador A' },
  { quem: 'B', velho: 'motor_B.bat.velho', novo: 'motor_B.bat', caixa: 'CAIXA_B.md', titulo: 'fpmed 2 (Trabalhador B' },
];

// ══ 1. O TEXTO ════════════════════════════════════════════════════════════════════════════
console.log('── 1. os dois .bat.novo e o que eles dizem ──');
const txt = {};
for (const m of MOTORES) {
  const alvo = path.join(RAIZ, m.novo);
  const existe = fs.existsSync(alvo);
  ok(n++ + `. ${m.novo} existe`, existe);
  if (!existe) { txt[m.quem] = ''; continue; }
  const buf = fs.readFileSync(alvo);
  txt[m.quem] = buf.toString('latin1');

  /* O cmd.exe lê .bat na página de código do CONSOLE, não em UTF-8. Um "ç" no cabeçalho sai
     embaralhado justo no texto que o DONO precisa ler para trocar o arquivo. E um BOM na
     frente do `@echo off` faz o cmd tentar executar "﻿@echo" e reclamar na primeira linha. */
  const forasteiros = buf.filter(b => b > 127).length;
  ok(n++ + `. *** ${m.novo} é ASCII puro (${forasteiros} byte(s) acima de 127) ***`,
    forasteiros === 0, forasteiros);
  ok(n++ + `. ...e não tem BOM na frente do @echo off`,
    buf.slice(0, 9).toString('latin1') === '@echo off', buf.slice(0, 9).toString('latin1'));
}

for (const m of MOTORES) {
  const t = txt[m.quem];
  const velho = fs.readFileSync(path.join(RAIZ, m.velho), 'latin1');

  /* O PROMPT É CONTRATO DA FÁBRICA. A A42 muda QUANDO chamar, nunca O QUE é dito — se uma
     palavra escorregar aqui, o trabalhador passa a ler outra ordem e ninguém percebe. */
  /* A LINHA, e não a primeira ocorrência do texto: o cabeçalho do .bat.novo CITA `call claude`
     dentro de um `rem` para explicar a regra, e um indexOf() cru pegaria a citação em vez da
     ordem. Só vale a linha que começa na coluna 0 — que é a que o cmd.exe executa. */
  const pega = (s) => {
    const l = s.split(/\r?\n/).find(x => /^call claude\b/.test(x));
    return l === undefined ? null : l.replace(/\s*>\s*"%CICLO%".*$/, '').trim();
  };
  const pNovo = pega(t), pVelho = pega(velho);
  ok(n++ + `. *** o prompt do ${m.quem} é BYTE A BYTE o mesmo do ${m.velho} ***`,
    pNovo !== null && pNovo === pVelho, { novo: (pNovo || '').slice(0, 60), velho: (pVelho || '').slice(0, 60) });

  ok(n++ + `. o ${m.novo} mantém o título da janela ("${m.titulo}...")`, t.includes(m.titulo));
  ok(n++ + `. ...e a caixa que ele lê é a ${m.caixa}`,
    new RegExp('set CAIXA=C:\\\\fpmed\\\\caixas\\\\' + m.caixa.replace('.', '\\.')).test(t));

  /* O passo a passo tem que vir ANTES do código — o dono não vai rolar o arquivo atrás dele. */
  ok(n++ + `. *** o passo a passo da TROCA está no cabeçalho, antes do title ***`,
    /FECHE as duas janelas/.test(t) && t.search(/FECHE as duas janelas/) < t.search(/^title /m));
  ok(n++ + `. ...e explica POR QUE eu não troquei sozinho (o cmd relê o .bat rodando)`,
    /RELE o \.bat de dentro do laco/i.test(t));
  ok(n++ + `. ...e diz como DESFAZER (renomear o .velho de volta)`, /DEU ERRADO\?/.test(t));

  /* UM `timeout` só no arquivo inteiro: dois lugares esperando é dois lugares para esquecer
     de mexer. As duas pernas (trabalhou / dormiu) caem no mesmo `:espera`. */
  ok(n++ + `. há UM ÚNICO timeout no arquivo, e ele lê %ESPERA%`,
    (t.match(/timeout \/t %ESPERA% \/nobreak/g) || []).length === 1 &&
    (t.match(/^timeout /gm) || []).length === 1);
  ok(n++ + `. ...e as duas esperas normais são 600 (a do AGUARDE e a do fim do ciclo)`,
    (t.match(/^set ESPERA=600$/gm) || []).length === 2, (t.match(/^set ESPERA=600$/gm) || []).length);
  ok(n++ + `. ...e o cabeçalho diz onde trocar a do AGUARDE para 30 min`,
    /set ESPERA=600" que esta logo abaixo do rotulo/.test(t) && /1800 = 30 min/.test(t));

  /* "Declare o que se perde" — a lei do dono. Aqui o que se perde é o log do ciclo vazio. */
  ok(n++ + `. *** declara O QUE SE PERDE (o log de 11 bytes do ciclo em AGUARDE) ***`,
    /== O QUE SE PERDE ==/.test(t) && /11 bytes/.test(t));
  ok(n++ + `. ...e põe a prova de vida no índice no lugar dele`,
    /AGUARDE - ciclo economizado/.test(t));

  /* ══ A A36 ESTAVA AQUI ANTES DE MIM, E EU QUASE A APAGUEI ═══════════════════════════════
     Este `.bat.novo` já existia desde 20/08 (commit e14f8be) com o respeito ao LIMITE DO
     PLANO dentro, esperando uma troca do dono que nunca veio. Escrevendo a A42 eu sobrescrevi
     o arquivo e só descobri porque o `git status` disse "M" e não "??" — um arquivo pendente
     não tem quem cobre por ele. Estes asserts são o cobrador. */
  ok(n++ + `. *** [${m.quem}] a A36 continua no arquivo: 3600s quando o log traz o limite ***`,
    /^\s*set ESPERA=3600$/m.test(t) && /findstr \/i \/c:"weekly limit" \/c:"usage limit"/.test(t));
  ok(n++ + `. ...e as DUAS frases do limite ("weekly" e "usage"), não só a que alguém lembrou`,
    /\/c:"weekly limit"/.test(t) && /\/c:"usage limit"/.test(t));
  ok(n++ + `. ...e o cabeçalho ainda conta a história dela (os 168 ciclos batendo na porta)`,
    /168 ciclos/.test(t) && /A36/.test(t));
  ok(n++ + `. ...e avisa o arquiteto de que UMA troca entrega as duas fatias`,
    /UMA troca entrega as duas/.test(t));

  /* Um .bat que o dono vai rodar para sempre não pode ter uma linha que apaga coisa. */
  const perigo = t.split('\n').filter(l => !/^\s*rem\b/i.test(l) && /(^|[\s&|(])(del|erase|rd|rmdir|format|reg\s+delete)\s/i.test(l));
  ok(n++ + `. o ${m.novo} não tem nenhuma linha que apaga nada`, perigo.length === 0, perigo);

  /* E o motor de HOJE continua o de hoje: a fatia não trocou nada por baixo do dono. */
  ok(n++ + `. o ${m.velho} de hoje continua INTOCADO (sem findstr, sem :dormir)`,
    !/findstr/.test(velho) && !/:dormir/.test(velho));
  ok(n++ + `. ...e é por isso que ele acorda o Claude até em AGUARDE (o gasto que a A42 corta)`,
    /call claude/.test(velho) && velho.indexOf('call claude') < velho.indexOf('timeout /t 600'));
}

// ══ 2. O BLOCO, EXECUTADO PELO cmd.exe DE VERDADE ═════════════════════════════════════════
console.log('\n── 2. o bloco da respiração, recortado e rodado no cmd.exe ──');

function recorta(t, qual) {
  const linhas = t.split(/\r?\n/);
  const i = linhas.findIndex(l => new RegExp('^rem == INICIO DO BLOCO ' + qual).test(l));
  const j = linhas.findIndex(l => new RegExp('^rem == FIM DO BLOCO ' + qual).test(l));
  return (i < 0 || j < 0 || j <= i) ? null : linhas.slice(i, j + 1).join('\r\n');
}

/* Um log de VERDADE da parada de 15-18/08, se ainda houver algum no disco. Provar o detector
   do limite com um texto que eu mesmo escrevi é provar a minha ideia da mensagem; provar com
   a mensagem que o Claude Code realmente gravou é provar o detector. */
function logRealDoLimite() {
  const dir = path.join(RAIZ, 'logs');
  if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir)) {
    if (!/_ciclo_\d+\.log$/.test(f)) continue;
    const cheio = path.join(dir, f);
    try {
      if (/weekly limit|usage limit/i.test(fs.readFileSync(cheio, 'latin1'))) return cheio;
    } catch (e) { }
  }
  return null;
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'a42_'));
let vereditoReal = {};
try {
  for (const m of MOTORES) {
    const bloco = recorta(txt[m.quem], 'DA RESPIRACAO');
    ok(n++ + `. o bloco da respiração do ${m.quem} está delimitado (INICIO..FIM)`, !!bloco);
    if (!bloco) continue;

    /* O RECORTE É A PROVA: quem responde é o cmd.exe lendo as MESMAS linhas que vão rodar na
       máquina do dono. Se eu reescrevesse o findstr aqui, estaria testando a minha cópia. */
    ok(n++ + `. ...e ele usa /b (só casa no COMEÇO da linha)`, /findstr \/b \/i \/c:"SINAL: AGUARDE"/.test(bloco));
    ok(n++ + `. ...e desvia com "if not errorlevel 1" (= achou, código 0)`, /if not errorlevel 1 goto dormir/.test(bloco));

    const arn = path.join(TMP, `bloco_${m.quem}.bat`);
    fs.writeFileSync(arn, ['@echo off', bloco, 'echo TRABALHA', 'goto :fim', ':dormir', 'echo DORME', ':fim', ''].join('\r\n'), 'latin1');

    const roda = (conteudoDaCaixa, nome) => {
      const cx = path.join(TMP, nome);
      if (conteudoDaCaixa !== null) fs.writeFileSync(cx, conteudoDaCaixa, 'latin1');
      const saida = execFileSync('cmd.exe', ['/c', arn], {
        encoding: 'latin1', env: Object.assign({}, process.env, { CAIXA: cx }),
      });
      return saida.trim();
    };

    const CABECALHO = '> SINAL: TRABALHE = executar a caixa inteira; AGUARDE = nada novo, responder em uma linha.';
    const CASOS = [
      ['AGUARDE na 1a linha  -> dorme', 'SINAL: AGUARDE\r\n\r\n# caixa do ' + m.quem + '\r\n', 'DORME', 'c1.md'],
      ['TRABALHE na 1a linha -> trabalha', 'SINAL: TRABALHE\r\n\r\n# caixa do ' + m.quem + '\r\n', 'TRABALHA', 'c2.md'],
      ['*** TRABALHE + a linha de ajuda que CONTÉM "AGUARDE" -> trabalha (é o /b) ***',
        'SINAL: TRABALHE\r\n\r\n' + CABECALHO + '\r\n', 'TRABALHA', 'c3.md'],
      ['*** a caixa SUMIU -> trabalha (nao consegui ler nunca vira "esta em AGUARDE") ***', null, 'TRABALHA', 'nao_existe.md'],
      ['caixa VAZIA (0 bytes) -> trabalha', '', 'TRABALHA', 'c5.md'],
      ['minúscula "sinal: aguarde" -> dorme (é o /i)', 'sinal: aguarde\r\n', 'DORME', 'c6.md'],
      ['SINAL indentado com espaços -> trabalha (o sinal mora na coluna 0)', '  SINAL: AGUARDE\r\n', 'TRABALHA', 'c7.md'],
      ['AGUARDE numa linha do MEIO, na coluna 0 -> dorme (é assim mesmo)',
        '# nota\r\nSINAL: AGUARDE\r\n', 'DORME', 'c8.md'],
    ];
    for (const [nome, conteudo, esperado, arq] of CASOS) {
      let got; try { got = roda(conteudo, arq); } catch (e) { got = 'ERRO: ' + e.message; }
      ok(n++ + `. [${m.quem}] ${nome}`, got === esperado, { esperado, veio: got });
    }

    // ══ 2b. O BLOCO DO LIMITE DO PLANO (A36), TAMBÉM RECORTADO E RODADO ═══════════════════
    /* A A36 mora no mesmo arquivo e espera a mesma troca. Ela já tinha sido medida em 20/08,
       mas contra uma CÓPIA do bloco escrita à mão (tools/_prova_motor_limite.bat). Cópia à
       mão é o jeito de a prova continuar verde depois de o original mudar — aqui o bloco é
       RECORTADO do `.bat.novo`, então ele não pode divergir do que vai rodar. */
    const bl = recorta(txt[m.quem], 'DO LIMITE DO PLANO');
    ok(n++ + `. [${m.quem}] o bloco do LIMITE DO PLANO (A36) está delimitado`, !!bl);
    if (bl) {
      const arnL = path.join(TMP, `limite_${m.quem}.bat`);
      const indice = path.join(TMP, `indice_${m.quem}.log`);
      fs.writeFileSync(arnL, ['@echo off', 'set N=1', 'set CODIGO=0', bl,
        'echo ESPERA=%ESPERA%', 'echo MOTIVO=%MOTIVO%', ''].join('\r\n'), 'latin1');

      const rodaL = (conteudoDoLog, nome) => {
        const lg = nome === null ? path.join(TMP, 'ciclo_que_nunca_existiu.log') : path.join(TMP, nome);
        if (conteudoDoLog !== null) fs.writeFileSync(lg, conteudoDoLog, 'latin1');
        const s = execFileSync('cmd.exe', ['/c', arnL], {
          encoding: 'latin1', env: Object.assign({}, process.env, { CICLO: lg, INDICE: indice }),
        });
        return (s.match(/ESPERA=(\d+)/) || [])[1] || s.trim();
      };

      const CASOS_L = [
        ['"weekly limit" no log -> espera 3600', "You've hit your weekly limit - resets Aug 18, 1am\r\n", '3600', 'l1.log'],
        ['"usage limit" no log  -> espera 3600 (a segunda forma da frase)', 'Claude usage limit reached\r\n', '3600', 'l2.log'],
        ['log limpo             -> espera 600', 'aguardando\r\n', '600', 'l3.log'],
        ['*** o ciclo morreu sem escrever log -> espera 600, sem erro de findstr ***', null, '600', null],
        ['log vazio (0 bytes)   -> espera 600', '', '600', 'l5.log'],
      ];
      for (const [nome, conteudo, esperado, arq] of CASOS_L) {
        let got; try { got = rodaL(conteudo, arq); } catch (e) { got = 'ERRO: ' + e.message; }
        ok(n++ + `. [${m.quem}] ${nome}`, got === esperado, { esperado, veio: got });
      }

      /* O DONO PRECISA SABER POR QUE A FÁBRICA PAROU UMA HORA. Espera silenciosa de 1 h é
         indistinguível de motor travado — a linha no índice é o que separa as duas. */
      const idx = fs.existsSync(indice) ? fs.readFileSync(indice, 'latin1') : '';
      ok(n++ + `. [${m.quem}] ...e o limite deixa RASTRO no índice ("LIMITE DO PLANO - esperando 3600s")`,
        /LIMITE DO PLANO - esperando 3600s/.test(idx), idx.slice(0, 120));

      /* E a prova que vale mais que as cinco de cima: um log DE VERDADE da parada de 15-18/08. */
      const real = logRealDoLimite();
      if (real) {
        const s = execFileSync('cmd.exe', ['/c', arnL], {
          encoding: 'latin1', env: Object.assign({}, process.env, { CICLO: real, INDICE: indice }),
        });
        const veio = (s.match(/ESPERA=(\d+)/) || [])[1];
        console.log(`    log REAL da parada: ${path.basename(real)} -> ESPERA=${veio}`);
        ok(n++ + `. *** [${m.quem}] contra um log DE VERDADE da parada de 15-18/08, espera 3600 ***`,
          veio === '3600', { arquivo: path.basename(real), veio });
      } else {
        console.log('    (nenhum log da parada sobrou no disco — só as cinco de mentira acima)');
      }
    }

    // ══ 3. A CAIXA DE VERDADE, AGORA ══════════════════════════════════════════════════════
    const caixaReal = path.join(RAIZ, 'caixas', m.caixa);
    if (fs.existsSync(caixaReal)) {
      const primeira = fs.readFileSync(caixaReal, 'latin1').split(/\r?\n/)[0].trim();
      const dizAguarde = /^SINAL:\s*AGUARDE\b/i.test(primeira);
      ok(n++ + `. [${m.quem}] a 1a linha da caixa de verdade tem a forma "SINAL: TRABALHE|AGUARDE"`,
        /^SINAL:\s*(TRABALHE|AGUARDE)\b/i.test(primeira), primeira);
      const saida = execFileSync('cmd.exe', ['/c', arn], {
        encoding: 'latin1', env: Object.assign({}, process.env, { CAIXA: caixaReal }),
      }).trim();
      vereditoReal[m.quem] = { primeira, saida };
      console.log(`    ${m.caixa} diz "${primeira}" -> o cmd responde ${saida}`);
      ok(n++ + `. *** [${m.quem}] o veredito do cmd na caixa REAL bate com a 1a linha dela ***`,
        saida === (dizAguarde ? 'DORME' : 'TRABALHA'), { primeira, saida });

      /* O caso 3 acima não é hipotético: a caixa de verdade TEM a palavra AGUARDE fora da
         coluna 0 (na linha de ajuda). Sem o /b, o motor dormiria de caixa cheia. */
      const linhas = fs.readFileSync(caixaReal, 'latin1').split(/\r?\n/);
      const iscas = linhas.filter(l => /AGUARDE/i.test(l) && !/^SINAL:/i.test(l));
      ok(n++ + `. *** [${m.quem}] a caixa real tem ${iscas.length} linha(s) com "AGUARDE" fora da coluna 0 — a armadilha é real ***`,
        iscas.length > 0, iscas.slice(0, 2));
    } else {
      ok(n++ + `. [${m.quem}] a caixa de verdade existe em caixas/${m.caixa}`, false);
    }
  }
} finally {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { }
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
