/* ══════════════════════════════════════════════════════════════════════════════════════════════
   muta_b36.js — A CATRACA DO AVISO DE ERRO CONTRA O MATERIAL DE VERDADE (21/08/2026)

   A fatia B36 é de LEITURA, e a catraca dela guarda um conserto de três linhas. Justamente por
   ser pequena ela precisa disto: catraca de fatia pequena é a que ninguém confere, e a lei desta
   casa é a da B26 — *"instrumento que não é atacado não é instrumento, é decoração"*.

   A primeira mutação é o código que estava no ar até hoje de manhã.

     node tools/muta_b36.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ARQUIVOS = ['fpmed_negocios.html', 'fpmed_documentos.html', 'fpmed_giovana.html',
                  'fpmed_ajuda.html', 'fpmed_licitacoes.html', 'tests/testa_erro_visivel.js',
  /* A suíte passou a `require` a régua do A para ler SEM COMENTÁRIO (o conserto do falso vermelho
     desta mesma ferramenta), e a régua `require` a prova do papel desde a A37. Sem os quatro, o
     controle abortaria por arquivo faltando — que é abortar por causa da lista de cópia. */
                  'tools/regua_visual.js', 'tools/prova_papel_congelado.js',
                  'fpmed_tema.css', 'tests/telas_adotadas.json'];
const SUITES = ['testa_erro_visivel.js'];
const NEG = 'fpmed_negocios.html';
const DOC = 'fpmed_documentos.html';

const MUTACOES = [
  /* O ESTADO EM QUE O CÓDIGO ESTAVA. Ele não quebra nada: a tela pinta, o botão volta a
     funcionar, o evento sai. A pessoa é que lê uma etiqueta HTML no lugar do aviso. */
  { nome: '*** o aviso volta a `textContent` com <svg> dentro (a pessoa le a etiqueta) ***',
    deveRuir: true, arq: NEG,
    de: /msg\.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#ic-alerta"\/><\/svg> ' \+ esc\(e\.message\);/,
    para: "msg.textContent = '<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#ic-alerta\"/></svg> ' + e.message;" },
  { nome: '*** o innerHTML fica, mas a mensagem para de ser escapada (troca defeito por buraco) ***',
    deveRuir: true, arq: NEG,
    de: /<use href="#ic-alerta"\/><\/svg> ' \+ esc\(e\.message\);/,
    para: '<use href="#ic-alerta"/></svg> \' + e.message;' },
  { nome: 'o "nao salvou" volta a imprimir a etiqueta', deveRuir: true, arq: NEG,
    de: /msg\.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#ic-alerta"\/><\/svg> não salvou: ' \+ esc\(e\.message\);/,
    para: "msg.textContent = '<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#ic-alerta\"/></svg> não salvou: ' + e.message;" },
  /* A REGRA VALE PARA A CASA, E NÃO SÓ PARA O ARQUIVO CONSERTADO: uma tela que ainda não tinha o
     defeito é onde ele nasce da próxima vez. */
  { nome: '*** o defeito nasce numa tela que nao o tinha (Documentos) ***', deveRuir: true, arq: DOC,
    de: /    msg\.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#ic-alerta"\/><\/svg> ' \+ esc\(e\.message\);/,
    para: "    msg.textContent = '<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#ic-alerta\"/></svg> ' + e.message;" },
  /* A FALHA MAIS SILENCIOSA DA FATIA: mexer num `catch` e levar a chamada de telemetria junto.
     A tela continua funcionando e o painel simplesmente para de receber. */
  { nome: '*** o conserto leva junto a chamada de telemetria do Negocios ***', deveRuir: true, arq: NEG,
    de: /    window\.FPMED_TELEMETRIA && FPMED_TELEMETRIA\.evento\('erro_visto_pelo_usuario',\n      \{ causa: e\.message, tela: 'negocios' \}\); \}/,
    para: '    }' },
  { nome: 'um dos dois pontos do Documentos some', deveRuir: true, arq: DOC,
    de: /    window\.FPMED_TELEMETRIA && FPMED_TELEMETRIA\.evento\('erro_visto_pelo_usuario',\n      \{ causa: e\.message, tela: 'documentos' \}\);\n  \}/,
    para: '  }' },
  /* O EVENTO PASSA A LEVAR A FRASE DA TELA em vez da causa — é a regra 3 do docs/TELEMETRIA.md
     virando do avesso, e é a tentação natural de quem acabou de descobrir que o painel não vê a
     frase. A saída certa é ler a frase daqui, não mandá-la para lá. */
  { nome: '*** o evento passa a levar o conteudo da tela em vez da causa ***', deveRuir: true, arq: NEG,
    de: /\{ causa: e\.message, tela: 'negocios' \}/, para: "{ causa: msg.innerHTML, tela: 'negocios' }" },

  // ── AS QUE **NÃO** PODEM FICAR VERMELHAS ─────────────────────────────────────────────────
  { nome: 'um comentario cita `textContent` com <svg> como o erro a evitar', deveRuir: false, arq: NEG,
    de: /const esc = s => String/,
    para: '/* nunca msg.textContent = \'<svg ...>\': textContent imprime a etiqueta em vez de desenhar */\nconst esc = s => String' },
  { nome: 'a suite ganha comentario citando o literal do defeito', deveRuir: false,
    arq: 'tests/testa_erro_visivel.js',
    de: /console\.log\('\\nRESULTADO: '/,
    para: "/* o que esta proibido e `textContent = '<svg ...>'`, e o assert acima e quem cobra */\nconsole.log('\\nRESULTADO: '" },
];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'muta-b36-'));
function semeia() {
  for (const rel of ARQUIVOS) {
    const dest = path.join(TMP, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, rel), dest);
  }
}
function roda() {
  let verde = true, saida = '', quem = [];
  for (const s of SUITES) {
    try { execFileSync(process.execPath, [path.join(TMP, 'tests', s)], { stdio: 'pipe', encoding: 'utf8' }); }
    catch (e) { verde = false; quem.push(s.replace(/^testa_|\.js$/g, '')); saida += String((e.stdout || '') + (e.stderr || '')); }
  }
  return { verde: verde, saida: saida, quem: quem.join(', ') };
}

console.log('=== MUTACAO DA FATIA B36 — o aviso de erro contra o material de verdade ===\n');
semeia();
const ctrl = roda();
console.log(`  controle · ${SUITES.join(' + ')} ${ctrl.verde ? 'VERDE' : '*** JA ESTA VERMELHA ***'}`);
if (!ctrl.verde) {
  console.log(ctrl.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 6).join('\n'));
  console.log('\n>>> ABORTADO: com a suite ja vermelha, a mutacao nao prova nada.');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(1);
}
console.log('');

let pegou = 0, escapou = 0, falso = 0;
const escapadas = [], falsas = [];
for (const m of MUTACOES) {
  semeia();
  const alvo = path.join(TMP, m.arq);
  const antes = fs.readFileSync(alvo, 'utf8').replace(/\r\n/g, '\n');
  const depois = antes.replace(m.de, m.para);
  if (depois === antes) {
    escapou++; escapadas.push(m.nome + '  (o padrao nao casou — o alvo mudou de forma)');
    console.log(`  ?? ${m.nome}\n     >>> o padrao nao casou; esta mutacao nao mediu nada`);
    continue;
  }
  fs.writeFileSync(alvo, depois, 'utf8');
  const r = roda();
  if (m.deveRuir) {
    if (!r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  vermelha (${r.quem}), como devia`); }
    else { escapou++; escapadas.push(m.nome); console.log(`  ** ESCAPOU: ${m.nome}  ->  a catraca ficou VERDE`); }
  } else {
    if (r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  passou, como devia (nao e defeito)`); }
    else {
      falso++; falsas.push(m.nome);
      console.log(`  ** FALSO VERMELHO: ${m.nome}`);
      console.log('     ' + r.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 2).join('\n     '));
    }
  }
}
fs.rmSync(TMP, { recursive: true, force: true });

console.log('\n== PLACAR ==');
console.log(`  ${pegou} de ${MUTACOES.length} mutacoes se comportaram como deviam`);
console.log(`  ${escapou} escaparam · ${falso} falso(s) vermelho(s)`);
if (escapadas.length) console.log('\n  ESCAPARAM:\n   - ' + escapadas.join('\n   - '));
if (falsas.length) console.log('\n  FALSO VERMELHO:\n   - ' + falsas.join('\n   - '));
process.exitCode = (escapou || falso) ? 1 : 0;
