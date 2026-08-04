// REVERTE o sync de dados de 04/08/2026, usando o backup COMPLETO pre-sync.
//   node tools/reverte_sync_dados.js            -> PREVIEW (nada tocado)
//   node tools/reverte_sync_dados.js --gravar   -> executa
//
// CRITERIO: id. O backup backups/backup_2026-08-04_1528/cotacoes.json foi tirado pelo hook
// obrigatorio IMEDIATAMENTE antes do sync e tem as 8.832 linhas do estado anterior
// (7.451 distribuidor + 1.381 estoque proprio). Entao:
//   - id que existe HOJE e NAO existe no backup  -> foi INSERIDO pelo sync -> apagar
//   - id que existe nos dois com valor diferente -> foi ATUALIZADO -> restaurar do backup
//   - id que existe no backup e sumiu do banco   -> ALERTA (nao deveria acontecer)
// Nada e identificado por data, lote ou heuristica. Compliance: COMPLIANCE.md
'use strict';
const fs = require('fs');

const GRAVAR = process.argv.includes('--gravar');
const BACKUP = 'C:/fpmed/backups/backup_2026-08-04_1528/cotacoes.json';
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const SR = seg.match(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

// colunas que o sync mexe (as unicas que precisam voltar)
const COLS = ['compra_unit', 'compra_caixa', 'estoque', 'vencimento', 'marca', 'produto',
              'principio_ativo', 'und', 'data', 'pedido', 'fornecedor', 'fornecedor_nome', 'tipo'];
const dif = (a, b) => COLS.some(c => String(a[c] == null ? '' : a[c]) !== String(b[c] == null ? '' : b[c]));

(async () => {
  console.log('\n══ REVERTER O SYNC DE DADOS DE 04/08 ══  ' + (GRAVAR ? '[GRAVAR]' : '[PREVIEW]') + '\n');

  const antes = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  const mapAntes = new Map(antes.map(x => [x.id, x]));
  console.log(`backup pre-sync: ${antes.length} linhas (${antes.filter(x => String(x.fornecedor) !== '1').length} distribuidor + ${antes.filter(x => String(x.fornecedor) === '1').length} proprio)`);

  let hoje = [], off = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/cotacoes?select=*&limit=1000&offset=${off}`, { headers: H });
    const d = await r.json(); if (!Array.isArray(d) || !d.length) break;
    hoje = hoje.concat(d); if (d.length < 1000) break; off += 1000;
  }
  console.log(`banco hoje:      ${hoje.length} linhas\n`);

  const inseridos = hoje.filter(x => !mapAntes.has(x.id));
  const alterados = hoje.filter(x => mapAntes.has(x.id) && dif(x, mapAntes.get(x.id)));
  const idsHoje = new Set(hoje.map(x => x.id));
  const sumiram = antes.filter(x => !idsHoje.has(x.id));

  console.log('── PLANO ──');
  console.log(`  APAGAR (inseridos pelo sync) ......... ${inseridos.length}`);
  console.log(`  RESTAURAR (alterados pelo sync) ...... ${alterados.length}`);
  console.log(`  ⚠ sumiram do banco (nao deveria) ..... ${sumiram.length}`);
  console.log(`\n  alvo final: ${antes.length} linhas (${antes.filter(x => String(x.fornecedor) !== '1').length} distribuidor + ${antes.filter(x => String(x.fornecedor) === '1').length} proprio)`);

  // trava de sanidade: nao apagar nada do estoque proprio da FPMED
  const proprioNoLote = inseridos.filter(x => String(x.fornecedor) === '1').length;
  console.log(`  🔒 estoque proprio no lote de exclusao: ${proprioNoLote} (tem que ser 0)`);
  if (proprioNoLote > 0) { console.error('\n⛔ ABORTADO: o lote de exclusao tocaria o estoque proprio da FPMED.'); process.exit(1); }
  if (hoje.length - inseridos.length !== antes.length) {
    console.error(`\n⛔ ABORTADO: a conta nao fecha (${hoje.length} - ${inseridos.length} != ${antes.length}).`); process.exit(1);
  }

  console.log('\n  amostra a apagar: ' + inseridos.slice(0, 3).map(x => `[${x.fornecedor}] ${String(x.produto).slice(0, 34)}`).join(' | '));
  if (alterados.length) console.log('  amostra a restaurar: ' + alterados.slice(0, 3).map(x => `id=${x.id} ${String(x.produto).slice(0, 30)}`).join(' | '));

  if (!GRAVAR) { console.log('\nPREVIEW encerrado — NADA foi tocado. Para executar: --gravar\n'); return; }

  // ---- 1) restaurar os alterados (por id, campo a campo) ----
  let rOk = 0, rErr = 0;
  for (const a of alterados) {
    const o = mapAntes.get(a.id);
    const body = {}; COLS.forEach(c => body[c] = o[c] === undefined ? null : o[c]);
    const r = await fetch(`${SB}/rest/v1/cotacoes?id=eq.${a.id}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) });
    if (r.status === 204) rOk++; else { rErr++; if (rErr <= 3) console.log(`  erro restaurando id=${a.id}: HTTP ${r.status}`); }
  }
  console.log(`\nRESTAURADOS: ${rOk} · erros: ${rErr}`);

  // ---- 2) apagar os inseridos, em lotes por id ----
  let dOk = 0, dErr = 0;
  const ids = inseridos.map(x => x.id);
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const r = await fetch(`${SB}/rest/v1/cotacoes?id=in.(${lote.join(',')})`, { method: 'DELETE', headers: H });
    if (r.ok) dOk += lote.length; else { dErr += lote.length; if (dErr <= 400) console.log(`  erro no lote ${i}: HTTP ${r.status} ${(await r.text()).slice(0, 90)}`); }
    if (dOk && dOk % 2000 === 0) console.log(`  ...apagados ${dOk}/${ids.length}`);
  }
  console.log(`APAGADOS: ${dOk} · erros: ${dErr}`);

  const fim = await fetch(`${SB}/rest/v1/cotacoes?select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  console.log(`\nTOTAL AGORA: ${(fim.headers.get('content-range') || '').split('/')[1]} (alvo ${antes.length})`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
