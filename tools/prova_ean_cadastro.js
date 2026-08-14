// ═══════════════════════════════════════════════════════════════════════════════════════════
// PROVA DA FATIA B7 — EAN/REGISTRO NO CADASTRO DE PRODUTOS       (14/08/2026, Trabalhador B)
//
// Mede, contra o BANCO REAL e com a MESMA função que roda na tela, quanto o casamento com a
// CMED consegue afirmar — e, mais importante, quanto ele se RECUSA a afirmar.
//
//   node tools/prova_ean_cadastro.js
//
// ── POR QUE ESTE ARQUIVO EXTRAI O CÓDIGO DA TELA EM VEZ DE RECOPIAR ─────────────────────────
// Prova que roda uma cópia do algoritmo prova a cópia, não a tela. As funções são recortadas do
// fpmed_sistema_final.html por ÂNCORA (o mesmo padrão do tools/carrega_cmed_pf.js): se alguém
// mexer no casamento lá, esta medição muda junto — ou quebra na âncora, que também é um aviso.
//
// ── ESTE SCRIPT É 100% SÓ-LEITURA ──────────────────────────────────────────────────────────
// Nenhum INSERT, UPDATE ou DELETE. Ele mede o que a tela SUGERIRIA; quem grava é o clique de
// uma pessoa, um produto por vez.
// ═══════════════════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// ── as funções REAIS da tela, recortadas por âncora ────────────────────────────────────────
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');
const L = src.split(/\r?\n/);
const bloco = (de, ate) => {
  const s = L.findIndex(x => x.includes(de));
  if (s < 0) throw new Error('âncora inicial não encontrada: ' + de);
  let e = -1;
  for (let i = s + 1; i < L.length; i++) if (L[i].includes(ate)) { e = i; break; }
  if (e < 0) throw new Error('âncora final não encontrada: ' + ate);
  return L.slice(s, e).join('\n');
};
const TELA = new Function(
  bloco('function _gmNorm(s)', 'var _GM_SAL_RE') + '\n' +
  bloco('var _GM_SAL_RE', 'var _GM_MATCAT_RE') + '\n' +
  bloco('function doseKey(produto)', '// Chave de agrupamento') + '\n' +
  bloco('function _undNum(und)', 'function qtdEmbalagem(') + '\n' +
  bloco('function _eanDigitos(s)', '// ── A CAIXA DE SUGESTÃO DO CADASTRO') + '\n' +
  'return { normPA, doseKey, eanDigitoConfere, eanLabCasa, escolheSugestaoCmed, _eanDigitos };'
)();

// ── banco (mesma escada de conexão do tools/roda_sql.js) ───────────────────────────────────
const REF = 'xzdowrksuswekwffoluk';
const PW = (fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8').match(/DB_PASSWORD\s*[:=]\s*(\S+)/i) || [])[1];
if (!PW) { console.error('DB_PASSWORD não encontrada'); process.exit(1); }
const ALVOS = [
  { nome: 'direta',    host: `db.${REF}.supabase.co`,               port: 5432, user: 'postgres' },
  { nome: 'pooler',    host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
  { nome: 'pooler-tx', host: 'aws-0-sa-east-1.pooler.supabase.com', port: 6543, user: `postgres.${REF}` },
];
async function conecta() {
  let ultimo;
  for (const a of ALVOS) {
    const c = new Client({ host: a.host, port: a.port, user: a.user, password: PW, database: 'postgres',
                           ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    try { await c.connect(); console.log(`[conexão: ${a.nome}]`); return c; } catch (e) { ultimo = e; try { await c.end(); } catch (_) {} }
  }
  throw ultimo;
}

const pct = (n, d) => d ? (n / d * 100).toFixed(1) + '%' : '—';

(async () => {
  const db = await conecta();
  try {
    const cot = (await db.query(
      `select id, produto, marca, principio_ativo, und, ean, registro_anvisa from cotacoes`)).rows;
    const cmed = (await db.query(
      `select subst_norm, dose_key, qtd_apres, laboratorio, apresentacao, ean1, registro from cmed_regua`)).rows;

    console.log('\n═══ B7 · PROVA DO CASAMENTO EAN/REGISTRO CONTRA A CMED ═══');
    console.log(`  cotações .......... ${cot.length}`);
    console.log(`  linhas da CMED .... ${cmed.length}`);
    console.log(`  já com EAN ........ ${cot.filter(c => TELA._eanDigitos(c.ean)).length}`);

    // índice por substância normalizada — é o que a tela faz com o ilike, só que de uma vez
    const idx = new Map();
    for (const r of cmed) {
      const k = TELA.normPA(r.subst_norm);
      if (!k) continue;
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(r);
    }

    // agrupa por produto+marca, igual à lista de pendência da tela
    const grupos = new Map();
    for (const c of cot) {
      const p = String(c.produto || '').trim();
      if (!p) continue;
      const k = p.toUpperCase() + '|' + String(c.marca || '').trim().toUpperCase();
      if (!grupos.has(k)) grupos.set(k, { produto: p, marca: String(c.marca || '').trim(), principio_ativo: String(c.principio_ativo || '').trim(), linhas: 0 });
      const g = grupos.get(k);
      g.linhas++;
      if (!g.principio_ativo && c.principio_ativo) g.principio_ativo = String(c.principio_ativo).trim();
    }

    let comEan = 0, soRegistro = 0, semNada = 0;
    const motivos = {}, exemplosBons = [], exemplosSem = [];
    for (const g of grupos.values()) {
      const s = TELA.escolheSugestaoCmed(g, idx.get(TELA.normPA(g.principio_ativo)) || []);
      if (s.ean) { comEan++; if (exemplosBons.length < 6) exemplosBons.push({ g, s }); }
      else if (s.registro) soRegistro++;
      else {
        semNada++;
        const chave = s.motivo.replace(/"[^"]*"/g, '"…"').replace(/\(.*?\)/g, '(…)');
        motivos[chave] = (motivos[chave] || 0) + 1;
        if (exemplosSem.length < 4 && g.principio_ativo) exemplosSem.push({ g, s });
      }
    }
    const T = grupos.size;
    console.log(`\n── PRODUTOS DISTINTOS (produto + marca): ${T} ──`);
    console.log(`  EAN confirmado pela CMED ........ ${String(comEan).padStart(5)}   ${pct(comEan, T)}`);
    console.log(`  só o registro ANVISA ............ ${String(soRegistro).padStart(5)}   ${pct(soRegistro, T)}`);
    console.log(`  sem casamento seguro (pendência)  ${String(semNada).padStart(5)}   ${pct(semNada, T)}`);

    console.log('\n── POR QUE A CMED NÃO CONFIRMA (e é isso que a tela escreve na tela) ──');
    Object.entries(motivos).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .forEach(([m, n]) => console.log(`  ${String(n).padStart(5)}  ${m}`));

    console.log('\n── EXEMPLOS COM SUGESTÃO (confira estes contra a cmed_regua) ──');
    exemplosBons.forEach(({ g, s }, i) => {
      console.log(`\n  ${i + 1}. ${g.produto}`);
      console.log(`     marca ${g.marca} · PA ${g.principio_ativo} · dose ${TELA.doseKey(g.produto) || '—'} · ${g.linhas} linha(s)`);
      console.log(`     -> EAN ${s.ean} ${TELA.eanDigitoConfere(s.ean) ? '(dígito confere)' : '(DÍGITO NÃO CONFERE!)'} · registro ${s.registro || '—'}`);
      console.log(`        ${s.apresentacao || '(mais de uma apresentação)'} — ${s.laboratorio}`);
    });

    console.log('\n── EXEMPLOS SEM CASAMENTO: campo fica VAZIO, sem chute ──');
    exemplosSem.forEach(({ g, s }, i) => {
      console.log(`  ${i + 1}. ${g.produto} (${g.marca}) -> EAN "${s.ean}" · motivo: ${s.motivo}`);
    });

    // guarda-corpo: nenhum EAN sugerido pode falhar no dígito verificador
    const ruins = exemplosBons.filter(({ s }) => !TELA.eanDigitoConfere(s.ean));
    console.log(`\n>>> ${ruins.length ? 'FALHA: EAN sugerido com dígito inválido' : 'OK: todo EAN sugerido passa no dígito verificador'}`);
    process.exitCode = ruins.length ? 1 : 0;
  } finally { await db.end(); }
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
