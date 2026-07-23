#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   SYNC DE DADOS: cotações de DISTRIBUIDOR GlobalMed -> FPMED
   Uso:
     node tools/sync_cotacoes_global.js            -> PREVIEW (não grava nada)
     node tools/sync_cotacoes_global.js --gravar   -> grava (SÓ após OK do Lemuel)

   FILTROS OBRIGATÓRIOS (regra master):
   - EXCLUI fornecedor='1' e tipo='global' (estoque próprio da GlobalMed)
   - SÓ a tabela cotacoes — nunca clientes/prospects/compras/orçamentos
   SANITIZAÇÃO (igual ao seed de 22/07):
   - venda_loja=NULL, global_venda1/2=NULL, datas DD/MM/YYYY -> ISO, id novo
   DEDUP por (fornecedor, produto) normalizados; do lado Global vale a linha
   mais recente (maior id) de cada chave.
   SEGREDOS: lidos em runtime dos segredos.local.txt (NUNCA commitados).
   ═══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const GRAVAR = process.argv.includes('--gravar');
const GLOBAL_URL = 'https://vikewlbhkrikcalzsbeb.supabase.co';
const FPMED_URL = 'https://xzdowrksuswekwffoluk.supabase.co';

function segredo(arquivo, regex) {
  const txt = fs.readFileSync(arquivo, 'utf8');
  const m = txt.match(regex);
  if (!m) throw new Error('segredo não encontrado em ' + arquivo);
  return m[1].trim();
}
const KEY_GLOBAL = segredo('C:\\globalmed\\segredos.local.txt', /SERVICE_ROLE \(REST\)[^\n]*\n(eyJ[^\s]+)/);
const KEY_FPMED = segredo(path.join(__dirname, '..', 'segredos.local.txt'), /SERVICE_ROLE=\s*(\S+)/);

async function todas(url, key, tabela, select) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${url}/rest/v1/${tabela}?select=${select}&order=id.asc&limit=1000&offset=${off}`,
      { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (!r.ok) throw new Error(`${tabela}: HTTP ${r.status} ${await r.text()}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}
const norm = s => String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const chave = c => norm(c.fornecedor) + '|' + norm(c.produto);
const isoData = v => { if (!v) return null; let m = String(v).match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1];
  m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const numEq = (a, b) => (a == null ? null : +a) === (b == null ? null : +b);
const MAPA_COD = { '2': 'SUPERMEDICA', '13': 'RANBAXY', '18': 'MCW' };
const nomeForn = f => { const c = String(f || '').trim(); return /^\d+$/.test(c) ? (MAPA_COD[c] || c) : c; };

function sanitizar(c) {
  return {
    fornecedor: c.fornecedor, fornecedor_nome: nomeForn(c.fornecedor), tipo: c.tipo, pedido: c.pedido,
    data: isoData(c.data), codigo: c.codigo, produto: c.produto, principio_ativo: c.principio_ativo,
    und: c.und, vencimento: isoData(c.vencimento), marca: c.marca,
    compra_unit: c.compra_unit, compra_caixa: c.compra_caixa, qtd_orcamento: c.qtd_orcamento,
    total_compra: c.total_compra, estoque: c.estoque,
    global_venda1: null, global_venda2: null, markup: c.markup, regra: c.regra,
    venda_unit_calculada: c.venda_unit_calculada, venda_caixa_calculada: c.venda_caixa_calculada,
    total_venda_calculado: c.total_venda_calculado, venda_loja: null, created_at: c.created_at,
  };
}

(async () => {
  console.log('\n══ SYNC de cotações GlobalMed -> FPMED ══  modo: ' + (GRAVAR ? '💾 GRAVAR' : '👁 PREVIEW (nada será gravado)') + '\n');
  const brutas = await todas(GLOBAL_URL, KEY_GLOBAL, 'cotacoes', '*');
  const dist = brutas.filter(c => String(c.fornecedor) !== '1' && String(c.tipo || '').toLowerCase() !== 'global');
  const excluidas = brutas.length - dist.length;
  console.log(`Global: ${brutas.length} linhas · ${excluidas} GLOBAL excluídas (fornecedor='1'/tipo global) · ${dist.length} de distribuidor`);

  // lado Global: 1 linha por chave (a mais recente = maior id)
  const src = new Map();
  for (const c of dist) { const k = chave(c); const atual = src.get(k); if (!atual || c.id > atual.id) src.set(k, c); }
  console.log(`Global dedup por (fornecedor, produto): ${src.size} chaves únicas`);

  const fp = await todas(FPMED_URL, KEY_FPMED, 'cotacoes', '*');
  const alvo = new Map();
  for (const c of fp) { const k = chave(c); const atual = alvo.get(k); if (!atual || c.id > atual.id) alvo.set(k, c); }
  console.log(`FPMED hoje: ${fp.length} linhas · ${alvo.size} chaves únicas\n`);

  const novos = [], atualizados = [], pulados = [];
  for (const [k, g] of src) {
    const f = alvo.get(k);
    if (!f) { novos.push(g); continue; }
    const difere = !numEq(g.compra_unit, f.compra_unit) || !numEq(g.compra_caixa, f.compra_caixa) ||
      !numEq(g.estoque, f.estoque) || isoData(g.vencimento) !== (f.vencimento || null) ||
      norm(g.marca) !== norm(f.marca);
    if (difere) atualizados.push({ g, f }); else pulados.push(k);
  }

  console.log('── PREVIEW ──');
  console.log(`  ➕ NOVOS:       ${novos.length}`);
  console.log(`  🔄 ATUALIZADOS: ${atualizados.length}  (preço/estoque/vencimento/marca mudou)`);
  console.log(`  ⏭  PULADOS:     ${pulados.length}  (idênticos)`);
  const fornNovos = {};
  novos.forEach(c => { fornNovos[c.fornecedor] = (fornNovos[c.fornecedor] || 0) + 1; });
  const topN = Object.entries(fornNovos).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (topN.length) console.log('  novos por fornecedor (top): ' + topN.map(([f, n]) => `${f}=${n}`).join(' · '));
  console.log('  amostra de novos: ' + novos.slice(0, 3).map(c => `[${c.fornecedor}] ${String(c.produto).slice(0, 45)}`).join(' | '));
  console.log('  amostra de atualizados: ' + atualizados.slice(0, 3).map(({ g, f }) => `[${g.fornecedor}] ${String(g.produto).slice(0, 35)} (compra ${f.compra_unit}→${g.compra_unit}, est ${f.estoque}→${g.estoque})`).join(' | '));

  // segurança: prova de que nada GLOBAL/cliente entra
  const vazouGlobal = [...src.values()].filter(c => String(c.fornecedor) === '1' || String(c.tipo || '').toLowerCase() === 'global').length;
  console.log(`\n  🔒 linhas GLOBAL no lote: ${vazouGlobal} (deve ser 0) · tabelas tocadas: SÓ cotacoes`);

  if (!GRAVAR) { console.log('\n👁 PREVIEW encerrado — nada foi gravado. Para gravar (após OK): node tools/sync_cotacoes_global.js --gravar\n'); return; }

  console.log('\n💾 gravando...');
  const H = { apikey: KEY_FPMED, Authorization: 'Bearer ' + KEY_FPMED, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  for (let i = 0; i < novos.length; i += 500) {
    const lote = novos.slice(i, i + 500).map(sanitizar);
    const r = await fetch(`${FPMED_URL}/rest/v1/cotacoes`, { method: 'POST', headers: H, body: JSON.stringify(lote) });
    if (!r.ok) throw new Error('INSERT: HTTP ' + r.status + ' ' + await r.text());
    console.log(`  inseridos ${Math.min(i + 500, novos.length)}/${novos.length}`);
  }
  let na = 0;
  for (const { g, f } of atualizados) {
    const s = sanitizar(g); delete s.created_at;  // atualização preserva o created_at original da FPMED
    const r = await fetch(`${FPMED_URL}/rest/v1/cotacoes?id=eq.${f.id}`, { method: 'PATCH', headers: H, body: JSON.stringify(s) });
    if (!r.ok) throw new Error('PATCH id ' + f.id + ': HTTP ' + r.status);
    if (++na % 200 === 0) console.log(`  atualizados ${na}/${atualizados.length}`);
  }
  console.log(`\n✅ GRAVADO: ${novos.length} novos + ${atualizados.length} atualizados + ${pulados.length} pulados.\n`);
})().catch(e => { console.error('❌ ' + e.message); process.exit(1); });
