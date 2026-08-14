// Mutação da fatia B11: põe de volta, uma de cada vez, cada coisa que o guia NÃO pode ter, e
// cobra que a tests/testa_ajuda.js fique VERMELHA. Assert de prosa é fácil de escrever e fácil
// de escrever errado — este arquivo é o que separa um do outro.
//   node tools/muta_ajuda.js
// Trabalha numa CÓPIA da árvore (pasta temporária): não toca no repositório.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

const raiz = 'C:/fpmed';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mutab11-'));

// Tudo que a suíte lê, tirado da própria suíte. Harness que esquece um arquivo faz a suíte
// CRASHAR — e crash conta como vermelho, ou seja, toda mutação passaria a "ser barrada".
const SUITE = fs.readFileSync(path.join(raiz, 'tests/testa_ajuda.js'), 'utf8');
const lidos = [...new Set([...SUITE.matchAll(/R\('([^']+)'\)/g)].map(m => m[1]))];
for (const f of lidos) {
  const dest = path.join(tmp, f);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(raiz, f), dest);
}
fs.mkdirSync(path.join(tmp, 'tests'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'tests/suite.js'), SUITE);
const A0 = fs.readFileSync(path.join(raiz, 'fpmed_ajuda.html'), 'utf8');

// ── CONTROLE ────────────────────────────────────────────────────────────────────────────────
try {
  const c = cp.execSync(`node "${path.join(tmp, 'tests/suite.js')}"`, { encoding: 'utf8' });
  console.log('  CONTROLE  suite sem mutacao: ' + (c.match(/RESULTADO:[^\n]*/) || ['?'])[0]);
} catch (e) {
  console.error('>>> HARNESS QUEBRADO: a suite ja falha SEM mutacao. Nada abaixo valeria nada.');
  console.error(((e.stdout || '') + (e.stderr || '')).split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}

// cada mutação = [nome, de, para] — o "de" é o que está no ar hoje
const MUTS = [
  ['cor em hex volta pro fundo do topo',
    'background:var(--branco);\n  border-bottom:1px solid var(--cinza-200);',
    'background:#ffffff;\n  border-bottom:1px solid var(--cinza-200);'],
  ['cor em hex escondida DENTRO de um atributo de estilo no corpo',
    '<h1 class="fp-titulo-tela">Guia do FPMED</h1>',
    '<h1 class="fp-titulo-tela" style="color:#0A1526">Guia do FPMED</h1>'],
  ['cor por rgba() (o truque que a varredura de hex nao pega)',
    '.aviso--info{background:var(--sinal-info-fundo);',
    '.aviso--info{background:rgba(234,246,252,1);'],
  ['cor por NOME (o outro truque)',
    '.rodape b{color:var(--cinza-800);',
    '.rodape b{color:black;'],
  ['token que NAO EXISTE no tema (o pedaco sem cor que so aparece no navegador)',
    '.sec h2 .n{\n  display:inline-flex;align-items:center;justify-content:center;\n  width:26px;height:26px;flex:none;border-radius:var(--raio-pilula);\n  background:var(--azul-600);',
    '.sec h2 .n{\n  display:inline-flex;align-items:center;justify-content:center;\n  width:26px;height:26px;flex:none;border-radius:var(--raio-pilula);\n  background:var(--azul-650);'],
  ['a largura do menu volta a ser numero copiado',
    '.pg{margin-left:var(--menu-largura);min-height:100vh}',
    '.pg{margin-left:228px;min-height:100vh}'],
  ['*** jargao: "edge function" entra no texto ***',
    'e a resposta vem do texto do edital daquele',
    'e a resposta vem da edge function que le o texto do edital daquele'],
  ['*** jargao: "cache" entra no texto ***',
    'que responde na hora;',
    'que responde na hora direto do cache;'],
  ['*** jargao: "JSON" entra no texto ***',
    'os itens, os totais e o',
    'os itens em JSON, os totais e o'],
  ['*** o custo da IA some do guia ***',
    '<b>Cada leitura custa dinheiro de verdade.</b>',
    '<b>A leitura do edital e rapida.</b>'],
  ['*** "o valor aparece antes de confirmar" some ***',
    'mostra o valor antes de\n        você confirmar</b>',
    'faz a leitura</b>'],
  ['*** o guia deixa de dizer que o valor e TETO ***',
    'O valor mostrado é o <b>teto</b> daquela leitura',
    'O valor cobrado é exatamente o que apareceu'],
  ['*** "sem teto nao e aprovacao" some ***',
    '<b>“Sem teto CMED” não quer dizer “pode cobrar o que quiser”.</b>',
    '<b>“Sem teto CMED” quer dizer que aquele item esta liberado.</b>'],
  ['*** "linha sem selo e linha nao conferida" some ***',
    '<b>Linha sem selo nenhum é linha NÃO conferida.</b>',
    '<b>Linha sem selo nenhum esta dentro do teto.</b>'],
  ['*** o guia manda remarcar tarefa por tarefa (o defeito que a casa ja pagou) ***',
    '<b>Não remarque tarefa por tarefa</b>',
    '<b>Depois remarque tarefa por tarefa</b>'],
  ['a amostra de botao ganha cursor de mao (o clique morto)',
    '  white-space:nowrap;\n  cursor:default;\n}',
    '  white-space:nowrap;\n  cursor:pointer;\n}'],
  ['a amostra de botao vira clicavel de verdade, sem fazer nada',
    '<span class="bt">IA · tem custo</span>',
    '<span class="bt" onclick="void 0">IA · tem custo</span>'],
  ['o foco de teclado some do indice',
    '.indice a:focus-visible{outline:none;box-shadow:var(--foco)}',
    '.indice a:focus-visible{outline:none}'],
  ['*** o rodape deixa de mandar pro suporte da LIMEDTEC ***',
    '<b>Dúvidas → suporte da LIMEDTEC.</b>',
    '<b>Dúvidas → fale com alguem.</b>'],
  ['*** compliance: a GlobalMed e citada ***',
    'Do achar a licitação até imprimir a proposta',
    'Mesmo sistema da GlobalMed. Do achar a licitação até imprimir a proposta'],
  ['uma secao da jornada some do indice',
    '<a href="#s5"><span class="n">5</span> Ata</a>',
    ''],
  ['a pagina para de pendurar o menu do sistema',
    '<script src="limedtec-menu.js"><\/script>',
    ''],
  ['a pagina para de carregar o tema (e passa a nao ter cor nenhuma)',
    '<link rel="stylesheet" href="fpmed_tema.css">',
    ''],
  ['*** o caminho de volta some (a tela prende quem esta perdido) ***',
    '<a id="lt-voltar" class="voltar" href="#" style="display:none">← Sistema</a>',
    ''],
  ['o destino do voltar e chumbado em vez de vir do config',
    'var destino = window.LIMEDTEC && LIMEDTEC.telaPrincipal && LIMEDTEC.telaPrincipal();',
    "var destino = 'fpmed_sistema_final.html';"],
  ['sem config, o link aparece assim mesmo e leva a 404',
    '  if (!destino) return;\n  var a = document.getElementById(\'lt-voltar\');',
    '  var a = document.getElementById(\'lt-voltar\');'],
  ['*** a limitacao declarada (sem print de tela) some ***',
    'POR QUE NÃO TEM PRINT DE TELA',
    'POR QUE TEM DESENHO'],
];

let barradas = 0; const escaparam = [];
for (const [nome, de, para] of MUTS) {
  if (!A0.includes(de)) { escaparam.push(nome + '  (ANCORA NAO ENCONTRADA — a mutacao nem foi aplicada)'); console.log('  ANCORA?   ' + nome); continue; }
  fs.writeFileSync(path.join(tmp, 'fpmed_ajuda.html'), A0.replace(de, para));
  let vermelho = false, saida = '';
  try { saida = cp.execSync(`node "${path.join(tmp, 'tests/suite.js')}"`, { encoding: 'utf8' }); }
  catch (e) { vermelho = true; saida = (e.stdout || '') + (e.stderr || ''); }
  if (vermelho) { barradas++; console.log('  BARRADA   ' + nome + '   -> ' + ((saida.match(/FALHA [^\n]*/g) || ['?'])[0]).slice(0, 70)); }
  else { escaparam.push(nome); console.log('  ESCAPOU   ' + nome); }
}
fs.writeFileSync(path.join(tmp, 'fpmed_ajuda.html'), A0);
console.log(`\nMUTACAO: ${barradas} de ${MUTS.length} barradas`);
if (escaparam.length) { console.log('>>> ESCAPARAM:'); escaparam.forEach(e => console.log('    - ' + e)); }
process.exitCode = escaparam.length ? 1 : 0;
