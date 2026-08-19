/* ══════════════════════════════════════════════════════════════════════════════════════════
   muta_cofre_b25.js — A SUÍTE DO COFRE SABE FICAR VERMELHA? (fatia B25) · 19/08/2026

   Põe de volta, uma de cada vez, cada coisa que a fatia B25 tirou, e cobra que a
   `tests/testa_cofre_certidoes.js` FIQUE VERMELHA. Assert é fácil de escrever e fácil de
   escrever errado — este arquivo é o que separa um do outro.

   >>> E ELE JÁ PAGOU O PRÓPRIO CUSTO DUAS VEZES nesta casa: um assert de prosa que passava
       porque procurava a frase no lugar errado, e um que passava porque a régua não enxergava a
       região. Suíte verde não é prova de nada até alguém tentar quebrá-la de propósito.

   Trabalha numa CÓPIA da árvore (pasta temporária): não toca no repositório.
     node tools/muta_cofre_b25.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

const raiz = 'C:/fpmed';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mutab25-'));
const ARQUIVOS = ['fpmed_documentos.html', 'ddl/documentos_versao.sql', 'ddl/documentos.sql'];

for (const f of ARQUIVOS) {
  const dest = path.join(tmp, f);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(raiz, f), dest);
}
fs.mkdirSync(path.join(tmp, 'tests'), { recursive: true });
fs.copyFileSync(path.join(raiz, 'tests/testa_cofre_certidoes.js'), path.join(tmp, 'tests/suite.js'));

const ORIGINAL = {};
for (const f of ARQUIVOS) ORIGINAL[f] = fs.readFileSync(path.join(tmp, f), 'utf8');

function roda() {
  try { return { vermelha: false, saida: cp.execSync(`node "${path.join(tmp, 'tests/suite.js')}"`, { encoding: 'utf8' }) }; }
  catch (e) { return { vermelha: true, saida: (e.stdout || '') + (e.stderr || '') }; }
}

// ── CONTROLE: harness que já falha sem mutação faria toda mutação "ser barrada" ──────────────
{
  const c = roda();
  if (c.vermelha) {
    console.error('>>> HARNESS QUEBRADO: a suite ja falha SEM mutacao. Nada abaixo valeria nada.');
    console.error(c.saida.split('\n').slice(0, 8).join('\n'));
    process.exit(1);
  }
  console.log('  CONTROLE  suite sem mutacao: ' + (c.saida.match(/RESULTADO:[^\n]*/) || ['?'])[0] + '\n');
}

// Cada mutação: [nome, arquivo, de, para]  ou  [nome, arquivo, funcao(texto) -> texto]
const T = 'fpmed_documentos.html', D = 'ddl/documentos_versao.sql';
const MUTS = [
  // ── a migração deixa de ser aditiva ──
  ['a view volta a usar `select d.*` (e a migracao passa a exigir drop)', D,
    'select d.id, d.empresa_id, d.nome, d.tipo, d.orgao_emissor, d.numero,', 'select d.*,'],
  ['as tres colunas novas entram NO MEIO, antes de dias_para_vencer', D,
    '       (d.validade - current_date)                                   as dias_para_vencer,',
    '       d.substitui_id, d.versao, d.substituido_em,\n       (d.validade - current_date)                                   as dias_para_vencer,'],
  ['alguem resolve o problema com `drop view`', D,
    'create or replace view public.v_documentos_situacao',
    'drop view if exists public.v_documentos_situacao;\ncreate or replace view public.v_documentos_situacao'],
  ['`versao` perde o piso (aceitaria versao 0 ou negativa)', D,
    'versao integer not null default 1 check (versao >= 1)', 'versao integer not null default 1'],

  // ── o histórico deixa de existir ──
  ['a view do historico passa a filtrar `ativo` (e nao sobra historico nenhum)', D,
    '  from public.documentos d;', '  from public.documentos d\n where d.ativo;'],
  ['o `anon` fica com a view que enxerga tudo que a empresa ja teve', D,
    'revoke all on public.v_documentos_historico from anon;', ''],
  ['a trava de ciclo da corrente some (um ciclo trava a aba inteira)', T,
    '    const vistos = new Set();\n', '\n'],
  ['falha ao ler o historico vira "sem versoes anteriores"', T,
    "não consegui ler o histórico ('+esc(e.message)+') — ", 'sem versões anteriores. '],

  // ── o tipo volta a ser campo livre ──
  ['o tipo volta a ser campo de texto livre', T,
    '<select id="f-tipo" onchange="tipoMudou()" style="width:100%">',
    '<input type="text" id="f-tipo" placeholder="fiscal, trabalhista…"><select id="f-tipo-velho" style="display:none">'],
  ['um tipo gravado fora da lista some ao substituir', T,
    "  else if(v){ s.value = '__outro'; o.value = v; o.style.display = ''; }\n", ''],

  // ── o estado deixa de ser honesto ──
  ['o rotulo volta a dizer "SEM VALIDADE"', T,
    "sem_validade:'VALIDADE NÃO INFORMADA'", "sem_validade:'SEM VALIDADE'"],
  ['a tela volta a prometer "nao vence"', T,
    "'validade não informada — este documento não avisa ninguém'", "'não vence'"],
  ['o quinto contador sai do painel', T,
    "    + '<div class=\"regua sem_validade\"><b>'+cont.sem_validade+'</b><span>sem validade informada</span></div>'\n", ''],
  ['os contadores passam a nascer do dado (e um estado vazio SOME do painel)', T,
    '  const c = { vencido:0, vencendo:0, ok:0, sem_validade:0 };\n  (docs||[]).forEach(d => { if(c[d.situacao] !== undefined) c[d.situacao]++; });',
    '  const c = {};\n  (docs||[]).forEach(d => { c[d.situacao] = (c[d.situacao]||0)+1; });'],
  ['o contador do "sem validade" fica verde (verde e promessa)', T,
    '.regua.sem_validade b{color:var(--muted)}', '.regua.sem_validade b{color:var(--verde)}'],

  // ── a substituição perde o cuidado ──
  /* A ORDEM INVERSA É O DEFEITO QUE SE ESCONDE: a certidão que valia sai da lista, a nova não
     nasce, e ninguém vê nada — o painel diria "3 em dia" com uma certidão a menos. */
  ['*** a velha sai de cena ANTES de a nova nascer (a ordem que esconde a falha) ***', T,
    texto => {
      const post = texto.match(/    const r = await fetch\(`\$\{SB_URL\}\/rest\/v1\/documentos`, \{method:'POST',[\s\S]*?\n    \}\n/);
      const velho = texto.match(/    if\(velho\)\{\n[\s\S]*?\n    \}\n/);
      if (!post || !velho) throw new Error('nao achei os dois blocos para trocar de ordem');
      return texto.replace(post[0], '@@POST@@').replace(velho[0], post[0]).replace('@@POST@@', velho[0]);
    }],
  ['a versao velha e APAGADA em vez de virar historico', T,
    "{ ativo:false, substituido_em:new Date().toISOString(),", "{ substituido_em:new Date().toISOString(),"],
  ['a substituicao herda a validade da via ANTIGA (e a nova nasce "em dia" sem ninguem conferir)', T,
    "  ['f-numero','f-emissao','f-validade','f-arq'].forEach(i => document.getElementById(i).value = '');",
    "  ['f-numero','f-arq'].forEach(i => document.getElementById(i).value = '');\n"
    + "  document.getElementById('f-validade').value = d.validade || '';"],
  ['fechar o formulario deixa a substituicao pendente de pe', T,
    '  SUBSTITUINDO = null;\n  document.getElementById(\'aviso-subst\').style.display = \'none\';', ''],
  ['a falha no meio passa a dizer que nada foi gravado', T,
    "'a versão nova foi gravada, mas a anterior NÃO saiu da lista (HTTP '", "'não consegui salvar (HTTP '"],

  // ── o caminho do arquivo ──
  ['o caminho volta a ser escapado inteiro (assina 200 e nao baixa)', T,
    "const caminhoNaUrl = p => String(p==null?'':p).split('/').map(encodeURIComponent).join('/');",
    'const caminhoNaUrl = p => encodeURIComponent(String(p==null?\'\':p));'],
  ['so UMA das duas portas do cofre e consertada', T,
    'object/sign/documentos/${caminhoNaUrl(caminho)}', 'object/sign/documentos/${encodeURIComponent(caminho)}'],
  ['o caminho no onclick para de escapar a aspa simples', T,
    "const jsq = s => esc(String(s==null?'':s).replace(/\\\\/g,'\\\\\\\\').replace(/'/g,\"\\\\'\"));",
    "const jsq = s => esc(String(s==null?'':s));"],
  ['o "abrir arquivo" volta a receber o id (e o botao do historico nao faz nada)', T,
    'async function abrirArquivo(caminho){', 'async function abrirArquivo(id){ const caminho = id;'],
];

let barradas = 0, escaparam = [];
for (const m of MUTS) {
  const [nome, arquivo] = m;
  let mutado;
  if (typeof m[2] === 'function') {
    try { mutado = m[2](ORIGINAL[arquivo]); }
    catch (e) { console.log('  ?? NAO APLICOU  ' + nome + '  (' + e.message + ')'); escaparam.push(nome + ' [nao aplicou]'); continue; }
  } else {
    const [, , de, para] = m;
    if (!ORIGINAL[arquivo].includes(de)) {
      // MUTAÇÃO QUE NÃO ENCONTRA O ALVO É PIOR QUE MUTAÇÃO QUE ESCAPA: ela conta como "barrada"
      // sem ter mudado nada. Sai declarada.
      console.log('  ?? NAO APLICOU  ' + nome + '  (o trecho "de" nao existe mais no arquivo)');
      escaparam.push(nome + ' [nao aplicou]'); continue;
    }
    mutado = ORIGINAL[arquivo].replace(de, para);
  }
  if (mutado === ORIGINAL[arquivo]) {
    console.log('  ?? NAO APLICOU  ' + nome + '  (a troca nao mudou nada)');
    escaparam.push(nome + ' [nao aplicou]'); continue;
  }
  fs.writeFileSync(path.join(tmp, arquivo), mutado);
  const r = roda();
  fs.writeFileSync(path.join(tmp, arquivo), ORIGINAL[arquivo]);
  if (r.vermelha) { barradas++; console.log('  BARRADA  ' + nome); }
  else { escaparam.push(nome); console.log('  ESCAPOU  ' + nome + '   <<< a suite nao pega isto'); }
}

console.log('\n─────────────────────────────');
console.log('MUTACOES: ' + barradas + ' de ' + MUTS.length + ' barradas pela suite');
if (escaparam.length) {
  console.log('>>> ESCAPARAM (' + escaparam.length + '):');
  escaparam.forEach(e => console.log('    ' + e));
}
console.log('\nRESULTADO: ' + barradas + ' ok, ' + escaparam.length + ' falha(s)');
process.exitCode = escaparam.length ? 1 : 0;
