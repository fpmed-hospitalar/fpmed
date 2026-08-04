// SUITE testa_compliance — GUARD PERMANENTE da regra master de proteção de dados.
// Política: COMPLIANCE.md (raiz). Roda OFFLINE, entra na suíte padrão (run_all.js).
//
// O que trava:
//   (a) nenhum arquivo do projeto referencia a base da GlobalMed FORA de comentário histórico;
//   (b) nenhum script de ESCRITA aponta pra base da outra empresa;
//   (c) o sync de DADOS continua com a trava de abort no topo;
//   (d) o segredos.local.txt (se existir) não guarda credencial da GlobalMed.
//   node tests/testa_compliance.js
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const REF_GLOBAL = 'vikewlbhkrikcalzsbeb';                 // project ref do Supabase da GlobalMed
const REF_FPMED = 'xzdowrksuswekwffoluk';

let p = 0, f = 0;
const ok = (n, c, extra) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (extra ? ' -> ' + extra : '')); } };
console.log('SUITE testa_compliance — protecao de dados Global x FPMED\n');

// ---- varre os arquivos de codigo/doc do projeto ----
const IGNORAR = new Set(['node_modules', '.git', 'backups', 'scratchpad']);
const EXT = new Set(['.js', '.html', '.sql', '.md', '.json', '.txt', '.bat']);
function arquivos(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) arquivos(full, acc);
    else if (EXT.has(path.extname(e.name))) acc.push(full);
  }
  return acc;
}

// uma linha "historica" e comentario OU texto de documentacao que so cita o passado.
const ehComentario = l => /^\s*(\/\/|\/\*|\*|--|#|>|\|)/.test(l) || /^\s*$/.test(l);

// ALLOWLIST POR PROPOSITO — nao por sintaxe.
// Citar a ref da GlobalMed e LEGITIMO quando o proposito da linha e PROIBIR ou DETECTAR a ref.
// Um guard precisa nomear o que ele bloqueia. O que nao pode e a ref viva num caminho de acesso.
// Cada entrada aqui e uma decisao consciente, revisada em 04/08/2026:
const PERMITIDOS = [
  // a checklist de rebrand manda NUNCA aceitar essa ref num porte — precisa cita-la
  { arq: 'SYNC_GLOBAL.md', motivo: 'checklist de rebrand: proibe a ref' },
  // registro de auditoria: lista os termos que foram varridos
  { arq: 'TAREFAS_FPMED.md', motivo: 'registro da varredura' },
  // o detector do porte de codigo: a ref e o PADRAO que ele procura pra barrar
  { arq: 'tools/porta_motor_da_global.js', motivo: 'detector: a ref e o padrao procurado' },
  // sync de DADOS morto: a constante fica como registro de procedencia, mas o arquivo aborta
  // na primeira linha (verificado pelo teste (c) abaixo) — nao ha caminho de acesso vivo
  { arq: 'tools/sync_cotacoes_global.js', motivo: 'desativado por abort no topo; constante e registro historico' },
];
const permitido = rel => PERMITIDOS.some(x => x.arq === rel.replace(/\\/g, '/'));

const todos = arquivos(RAIZ);
const ativas = [];       // ocorrencias NAO-comentario da ref da Global
for (const arq of todos) {
  const rel = path.relative(RAIZ, arq);
  if (rel === 'COMPLIANCE.md' || rel.replace(/\\/g, '/') === 'tests/testa_compliance.js') continue;  // falam da regra
  if (permitido(rel)) continue;                                                                       // guards/registros
  let txt;
  try { txt = fs.readFileSync(arq, 'utf8'); } catch (_) { continue; }
  if (!txt.includes(REF_GLOBAL)) continue;
  txt.split(/\r?\n/).forEach((l, i) => {
    if (l.includes(REF_GLOBAL) && !ehComentario(l)) ativas.push(`${rel}:${i + 1}`);
  });
}
ok('(a) zero referencia ATIVA a base da GlobalMed (fora de comentario)',
   ativas.length === 0, ativas.slice(0, 6).join(' · '));

// ---- (b) scripts de ESCRITA nao podem apontar pra outra base ----
const escritores = todos.filter(a => {
  const rel = path.relative(RAIZ, a).replace(/\\/g, '/');
  if (!rel.startsWith('tools/') && !rel.startsWith('.claude/')) return false;
  if (!rel.endsWith('.js')) return false;
  const t = fs.readFileSync(a, 'utf8');
  return /method:\s*['"`](POST|PATCH|PUT|DELETE)['"`]/.test(t);
});
const escritorSujo = escritores.filter(a => {
  if (permitido(path.relative(RAIZ, a))) return false;
  const t = fs.readFileSync(a, 'utf8');
  return t.split(/\r?\n/).some(l => l.includes(REF_GLOBAL) && !ehComentario(l));
});
ok(`(b) nenhum script de escrita aponta pra base da outra empresa (${escritores.length} escritores)`,
   escritorSujo.length === 0, escritorSujo.map(a => path.relative(RAIZ, a)).join(' · '));

// todo escritor tem que apontar pra FPMED (ou nao ter base nenhuma)
const escritorSemBase = escritores.filter(a => {
  const t = fs.readFileSync(a, 'utf8');
  return /supabase\.co/.test(t) && !t.includes(REF_FPMED);
});
ok('(b2) todo escritor com base aponta pra FPMED',
   escritorSemBase.length === 0, escritorSemBase.map(a => path.relative(RAIZ, a)).join(' · '));

// ---- (c) trava de abort no sync de DADOS ----
const syncDados = path.join(RAIZ, 'tools', 'sync_cotacoes_global.js');
if (fs.existsSync(syncDados)) {
  const t = fs.readFileSync(syncDados, 'utf8');
  const topo = t.slice(0, 2000);
  ok('(c) sync de DADOS tem trava de abort no topo',
     /process\.exit\(1\)/.test(topo) && /BLOQUEADO|DESATIVADO/i.test(topo));
  ok('(c2) a trava vem ANTES de qualquer fetch',
     t.indexOf('process.exit(1)') < (t.indexOf('fetch(') === -1 ? Infinity : t.indexOf('fetch(')));
} else {
  ok('(c) sync de DADOS removido do repo (tambem aceitavel)', true);
}

// ---- (d) segredos locais nao guardam credencial da GlobalMed ----
const seg = path.join(RAIZ, 'segredos.local.txt');
if (fs.existsSync(seg)) {
  const t = fs.readFileSync(seg, 'utf8');
  ok('(d) segredos.local.txt sem ref da GlobalMed', !t.includes(REF_GLOBAL));
  ok('(d2) segredos.local.txt sem mencao a globalmed', !/globalmed/i.test(t));
} else {
  ok('(d) segredos.local.txt ausente nesta maquina', true);
}

// ---- (e) o sync de CODIGO nao precisa de credencial de banco ----
const syncCod = path.join(RAIZ, 'tools', 'sync_da_global.js');
if (fs.existsSync(syncCod)) {
  const t = fs.readFileSync(syncCod, 'utf8');
  ok('(e) sync de CODIGO nao usa service_role nem fetch de banco',
     !/service_role/i.test(t) && !/supabase\.co/.test(t));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
