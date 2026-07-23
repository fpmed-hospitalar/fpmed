#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   SYNC DE CÓDIGO GlobalMed -> FPMED  (relatório; o porte em si é revisado)
   Uso:
     node tools/sync_da_global.js                  -> relatório do que está pendente
     node tools/sync_da_global.js --marcar <hash>  -> grava o marcador após um sync concluído

   REGRAS:
   - C:\globalmed é SÓ LEITURA (só `git log`/`git show`, nunca escreve lá).
   - Este script NÃO porta nada sozinho: gera a lista de melhorias pendentes.
     O porte é feito com revisão (Claude/Lemuel), reaplicando o REBRAND (ver
     SYNC_GLOBAL.md) e rodando os testes da FPMED antes do commit.
   ═══════════════════════════════════════════════════════════════════════════ */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GLOBAL = 'C:\\globalmed';
const FPMED = path.join(__dirname, '..');
const MARCADOR = path.join(FPMED, 'SYNC_GLOBAL.md');

// mapa GlobalMed -> FPMED. status: portavel | manual | fora
const MAPA = {
  'globalmed_sistema_final.html':     { fpmed: 'fpmed_sistema_final.html', status: 'manual', motivo: 'DIVERGÊNCIA ALTA: FPMED removeu 4 páginas do menu, Global->FPMED nos textos, upload de PDF próprio, gates por role' },
  'globalmed_giovana.html':           { fpmed: 'fpmed_giovana.html', status: 'portavel' },
  'globalmed_vendas.html':            { fpmed: 'fpmed_vendas.html', status: 'portavel' },
  'globalmed_viabilidade.html':       { fpmed: 'fpmed_viabilidade.html', status: 'portavel' },
  'globalmed_painel.html':            { fpmed: 'fpmed_painel.html', status: 'portavel' },
  'dashboard_clientes.html':          { fpmed: 'dashboard_clientes.html', status: 'manual', motivo: 'FPMED usa dados 100% fictícios (nunca trazer a lista de clientes da Global)' },
  'globalmed_competitividade.html':   { fpmed: 'fpmed_competitividade.html', status: 'portavel' },
  'globalmed_competitividade_dark.html': { fpmed: 'fpmed_competitividade_dark.html', status: 'portavel' },
  'gm-auth.js':                       { fpmed: 'gm-auth.js', status: 'manual', motivo: 'aponta pro Supabase/URLs da FPMED — portar só a LÓGICA, nunca as constantes' },
  'reset-senha.html':                 { fpmed: 'reset-senha.html', status: 'portavel' },
  'index.html':                       { fpmed: 'index.html', status: 'manual', motivo: 'entradas diferentes: Global tem portal de cards; FPMED abre direto o sistema (decisão do Lemuel 22/07)' },
  'calculadora_comissao_globalmed.html': { fpmed: null, status: 'fora', motivo: 'removida do pacote FPMED (22/07)' },
  'globalmed_vendedora.html':         { fpmed: null, status: 'fora', motivo: 'Prospecção fora do pacote FPMED (regra master)' },
  'GLOBALMED-loja.html':              { fpmed: null, status: 'fora', motivo: 'Loja fora do pacote FPMED' },
  'auditoria_precos.js':              { fpmed: null, status: 'manual', motivo: 'script de banco da Global — avaliar utilidade na FPMED antes de portar' },
  'salvar_espelho.js':                { fpmed: null, status: 'manual', motivo: 'script de banco da Global — avaliar utilidade na FPMED antes de portar' },
  'restore_sulmedic.js':              { fpmed: null, status: 'fora', motivo: 'restauração pontual de dado da Global' },
  'package.json':                     { fpmed: 'package.json', status: 'manual', motivo: 'FPMED não tem package.json — criar se portar tools com deps (pdfjs-dist)' },
  'package-lock.json':                { fpmed: 'package-lock.json', status: 'manual', motivo: 'acompanha o package.json' },
  '.gitignore':                       { fpmed: '.gitignore', status: 'manual', motivo: 'mesclar linha a linha (o da FPMED tem regras próprias)' },
};
function mapear(arq) {
  if (MAPA[arq]) return MAPA[arq];
  if (arq.startsWith('tests/')) return { fpmed: arq, status: 'portavel', motivo: 'suite de testes — portar dá teste de graça pra FPMED' };
  if (arq.startsWith('tools/')) return { fpmed: arq, status: 'portavel', motivo: 'ferramenta — revisar caminhos/segredos ao portar' };
  if (/^CONTINUAR|^README|^SYNC|\.md$|\.txt$/i.test(arq)) return { fpmed: null, status: 'fora', motivo: 'doc interna da Global' };
  return { fpmed: arq, status: 'manual', motivo: 'arquivo sem mapeamento conhecido — avaliar' };
}

function lerMarcador() {
  try {
    const m = fs.readFileSync(MARCADOR, 'utf8').match(/ultimo_sync:\s*([0-9a-f]{7,40})/);
    return m ? m[1] : null;
  } catch (e) { return null; }
}
function git(args) { return execSync(`git -C "${GLOBAL}" ${args}`, { encoding: 'utf8' }); }
function gitFpmed(args) { try { return execSync(`git -C "${FPMED}" ${args}`, { encoding: 'utf8' }); } catch (e) { return ''; } }

// ── modo --marcar ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (argv[0] === '--marcar') {
  const hash = argv[1];
  if (!/^[0-9a-f]{7,40}$/.test(hash || '')) { console.error('uso: --marcar <hash>'); process.exit(1); }
  const md = fs.readFileSync(MARCADOR, 'utf8').replace(/ultimo_sync:\s*[0-9a-f]{7,40}/, 'ultimo_sync: ' + hash);
  fs.writeFileSync(MARCADOR, md);
  console.log('marcador atualizado para ' + hash + ' — commite o SYNC_GLOBAL.md junto com o porte.');
  process.exit(0);
}

// ── relatório ─────────────────────────────────────────────────────────────────
const base = lerMarcador();
if (!base) { console.error('SYNC_GLOBAL.md sem marcador ultimo_sync — abortando.'); process.exit(1); }
const head = git('rev-parse --short HEAD').trim();
console.log(`\n══ SYNC GlobalMed -> FPMED ══  base: ${base}  head Global: ${head}\n`);

const log = git(`log --reverse --format="@@%h|%ci|%s" --name-status ${base}..HEAD`).trim();
if (!log) { console.log('Nada pendente — FPMED em dia com a Global. ✓'); process.exit(0); }

const commits = [];
let cur = null;
for (const linha of log.split('\n')) {
  if (linha.startsWith('@@')) {
    const [h, data, ...s] = linha.slice(2).split('|');
    cur = { hash: h, data: data.slice(0, 10), msg: s.join('|'), arquivos: [] };
    commits.push(cur);
  } else if (cur && /^[AMDR]/.test(linha)) {
    const partes = linha.split('\t');
    cur.arquivos.push(partes[partes.length - 1].trim());
  }
}

const porArquivo = {};
console.log(`── ${commits.length} commits pendentes ──`);
for (const c of commits) {
  console.log(`\n[${c.hash}] ${c.data}  ${c.msg.slice(0, 110)}`);
  for (const a of [...new Set(c.arquivos)]) {
    const m = mapear(a);
    const tag = m.status === 'fora' ? 'FORA DO PACOTE' : m.status === 'manual' ? 'PORTE MANUAL' : 'portável';
    console.log(`     ${a}  ->  ${m.fpmed || '—'}  [${tag}]`);
    (porArquivo[a] = porArquivo[a] || { n: 0, m }).n++;
  }
}

console.log('\n── resumo por arquivo ──');
for (const [a, info] of Object.entries(porArquivo).sort((x, y) => y[1].n - x[1].n)) {
  const alvo = info.m.fpmed;
  let divergencia = '';
  if (alvo) {
    const nLocal = gitFpmed(`log --oneline -- "${alvo}"`).split('\n').filter(Boolean).length;
    if (nLocal > 5 && info.m.status !== 'fora') divergencia = `  ⚠️ ${nLocal} commits locais na FPMED — conferir conflito`;
  }
  console.log(`  ${String(info.n).padStart(2)}x ${a} [${info.m.status}]${info.m.motivo ? ' — ' + info.m.motivo : ''}${divergencia}`);
}
console.log(`\nPróximo passo: escolher o que portar (com OK do Lemuel), portar com REBRAND
(checklist no SYNC_GLOBAL.md), testar, commitar e rodar:
  node tools/sync_da_global.js --marcar ${head}\n`);
