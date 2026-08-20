/* ══════════════════════════════════════════════════════════════════════════════════════════
   muta_telemetria_b26.js — A CATRACA DA TELEMETRIA SABE FICAR VERMELHA? (fatia B26) · 20/08/2026

   Desfaz, uma de cada vez, cada coisa que a fatia B26 pôs de pé, e cobra que a
   `tests/testa_telemetria_adotada.js` FIQUE VERMELHA. Assert é fácil de escrever e fácil de
   escrever errado — este arquivo é o que separa um do outro.

   >>> AQUI ELE VALE MAIS QUE O NORMAL, e a razão é do próprio docs/TELEMETRIA.md: "prova que só
       lê o próprio código-fonte não vale quando há servidor no caminho". A parte do servidor eu
       provei no navegador (o POST para us.i.posthog.com voltando 200). O que ESTE arquivo prova é
       a outra metade — que a catraca que vigia o código-fonte não está verde por não olhar.
       Catraca cega é pior que catraca ausente: a ausente ninguém confunde com proteção.

   Trabalha numa CÓPIA da árvore (pasta temporária): não toca no repositório.
     node tools/muta_telemetria_b26.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

const raiz = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mutab26-'));
const TELAS = ['fpmed_negocios.html', 'fpmed_giovana.html', 'fpmed_ajuda.html', 'fpmed_documentos.html'];

for (const f of TELAS) fs.copyFileSync(path.join(raiz, f), path.join(tmp, f));
// o arquivo do A entra na cópia porque o assert 5 pergunta se ele EXISTE — sem ele, a mutação
// "tirar o <script src>" seria barrada pelo motivo errado (a fila, e não a adoção).
fs.copyFileSync(path.join(raiz, 'fpmed_telemetria.js'), path.join(tmp, 'fpmed_telemetria.js'));
fs.mkdirSync(path.join(tmp, 'tests'), { recursive: true });
fs.copyFileSync(path.join(raiz, 'tests/testa_telemetria_adotada.js'), path.join(tmp, 'tests/suite.js'));

const ORIGINAL = {};
for (const f of TELAS) ORIGINAL[f] = fs.readFileSync(path.join(tmp, f), 'utf8');

function roda() {
  try { return { vermelha: false, saida: cp.execSync(`node "${path.join(tmp, 'tests/suite.js')}"`, { encoding: 'utf8' }) }; }
  catch (e) { return { vermelha: true, saida: (e.stdout || '') + (e.stderr || '') }; }
}

// ── CONTROLE: harness que já falha sem mutação faria toda mutação "ser barrada" ──────────────
{
  const c = roda();
  if (c.vermelha) {
    console.error('>>> HARNESS QUEBRADO: a suite ja falha SEM mutacao. Nada abaixo valeria nada.');
    console.error(c.saida.split('\n').slice(0, 10).join('\n'));
    process.exit(1);
  }
  console.log('  CONTROLE  suite sem mutacao: ' + (c.saida.match(/RESULTADO:[^\n]*/) || ['?'])[0] + '\n');
}

const N = 'fpmed_negocios.html', G = 'fpmed_giovana.html', A = 'fpmed_ajuda.html', D = 'fpmed_documentos.html';
const TAG = '<script src="fpmed_telemetria.js"></script>';

// Cada mutação: [nome, arquivo, de, para]  ou  [nome, arquivo, funcao(texto) -> texto]
const MUTS = [
  // ── 1. A ADOÇÃO SOME (uma tela de cada vez: uma catraca que só olha a primeira não serve) ──
  ['o Negocios deixa de chamar o arquivo de telemetria', N, TAG, ''],
  ['a Proposta deixa de chamar o arquivo de telemetria', G, TAG, ''],
  ['a Ajuda deixa de chamar o arquivo de telemetria', A, TAG, ''],
  ['a Documentos deixa de chamar o arquivo de telemetria', D, TAG, ''],
  // e o jeito mais provável de ela sumir de verdade: alguém comenta a linha "por um minuto"
  ['alguem COMENTA a linha da telemetria no Negocios', N, TAG, '<!-- ' + TAG + ' -->'],

  // ── 2. O TRECHO VOLTA A SER COLADO NA TELA (a duplicação que a fatia existe para impedir) ──
  ['o init do PostHog e colado direto na Proposta', G, TAG,
    TAG + '\n<script>posthog.init(\'phc_deadbeefdeadbeefdead1234\', {api_host:\'https://us.i.posthog.com\'})</script>'],
  ['a chave do projeto e escrita na tela de Documentos', D, TAG,
    TAG + '\n<script>var CHAVE = \'phc_ovoRYDgQYQL8BwDKL9c2eqhSAsMHmUtFy7WeikLACvxz\';</script>'],
  ['o loader do Sentry e colado no Negocios', N, TAG,
    TAG + '\n<script src="https://js-de.sentry-cdn.com/797bc66e72aad46ad75098bf1efcf3db.min.js"></script>'],
  ['o DSN do Sentry aparece na Ajuda', A, TAG,
    TAG + '\n<script>var DSN = \'https://abc@o1.ingest.de.sentry.io/2\';</script>'],

  // ── 3. CONTEÚDO DA TELA COMEÇA A VIAJAR DENTRO DE UM EVENTO ────────────────────────────────
  // As quatro formas que eu consigo imaginar de isso acontecer sem ninguém ter má intenção: o
  // campo lido direto, o texto do nó, o HTML do bloco, e o formulário inteiro empacotado.
  ['o termo digitado entra no evento pelo `.value`', N,
    "{ de: 'negocios', itens: ITENS_EDITAL.length, deu_erro: !!ITENS_ERRO }",
    "{ de: 'negocios', termo: document.getElementById('q').value }"],
  ['o nome do cliente entra pelo `.textContent`', G,
    "{ achou: true, base: _tetoBase, tela: 'proposta' }",
    "{ achou: true, termo: document.querySelector('#cliente').textContent }"],
  ['o bloco inteiro entra pelo `.innerHTML`', D,
    "{ causa: e.message, tela: 'documentos' }",
    "{ causa: document.getElementById('lista').innerHTML }"],
  ['o formulario inteiro e empacotado no evento', D,
    "{ causa: e.message, tela: 'documentos' }",
    "{ causa: String(new FormData(document.forms[0])) }"],

  // ── 4. E O CONTRÁRIO: o que NÃO pode ficar vermelho ───────────────────────────────────────
  // Estas três não são mutações para barrar — são o teste do teste. Se qualquer uma delas ficar
  // vermelha, a catraca está cobrando de quem explica, que é o defeito que esta casa já pagou
  // cinco vezes (quatro na régua do A, uma na minha mutação da B25).
  ['[DEVE PASSAR] um comentario CITA a chave do PostHog para explicar por que ela nao mora ali', N,
    TAG, '<!-- nao escreva phc_ovoRYDgQYQL8BwDKL9c2eqhSAsMHmUtFy7WeikLACvxz aqui -->\n' + TAG, 'passa'],
  ['[DEVE PASSAR] um comentario mostra o EXEMPLO ERRADO com posthog.init( e .value', G,
    TAG, '<!-- errado: posthog.init( ... ) e capture(\'x\',{t:campo.value}) -->\n' + TAG, 'passa'],
  ['[DEVE PASSAR] um evento novo, so com numero e booleano', D,
    "{ causa: e.message, tela: 'documentos' }", "{ vencidos: 3, tem_certidao: true }", 'passa'],
];

let barradas = 0, escaparam = 0, falsoVermelho = 0;
for (const m of MUTS) {
  const [nome, arq, de, para, esperado] = m;
  const texto = ORIGINAL[arq];
  const novo = typeof de === 'function' ? de(texto) : texto.split(de).join(para);
  if (novo === texto) {
    console.log('  ??  MUTACAO NAO APLICOU: ' + nome + '  (o alvo mudou de forma — conserte o alvo)');
    escaparam++; continue;
  }
  fs.writeFileSync(path.join(tmp, arq), novo);
  const r = roda();
  fs.writeFileSync(path.join(tmp, arq), texto);          // devolve antes da próxima

  if (esperado === 'passa') {
    if (r.vermelha) { console.log('  X   FALSO VERMELHO: ' + nome); falsoVermelho++; }
    else { console.log('  ok  passou (e tinha de passar): ' + nome); barradas++; }
  } else if (r.vermelha) { console.log('  ok  BARRADA: ' + nome); barradas++; }
  else { console.log('  X   ESCAPOU: ' + nome); escaparam++; }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('\nRESULTADO: ' + barradas + ' de ' + MUTS.length + ' como esperado · '
  + escaparam + ' escaparam · ' + falsoVermelho + ' falso(s) vermelho(s)');
process.exitCode = (escaparam || falsoVermelho) ? 1 : 0;
