// REVERTE a conversao caixa->unitario de 04/08/2026, a partir do backup JSON.
//   node tools/reverte_unitario.js <backup.json>            -> PREVIEW
//   node tools/reverte_unitario.js <backup.json> --gravar   -> reverte
//
// POR QUE REVERTER: a Competitividade JA divide pelo pack na propria tela
// (`var qtd=qtdEmbalagem(g.und,g.produto)||1; var nosso=gv1/qtd;`). Converter tambem no banco
// virou DIVISAO DUPLA: MKP mediano saltou p/ +6136% e so 13 de 284 itens ficaram acima da
// media. O banco guarda o preco como o relatorio manda; quem normaliza e a tela.
'use strict';
const fs = require('fs');
const GRAVAR = process.argv.includes('--gravar');
const arq = process.argv[2];
if (!arq || !fs.existsSync(arq)) { console.error('uso: node tools/reverte_unitario.js <backup.json> [--gravar]'); process.exit(1); }

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const SR = seg.match(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

(async () => {
  const bk = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const antes = bk.antes || [];
  console.log(`\n══ REVERTER conversao unitaria ══ ${GRAVAR ? '[GRAVAR]' : '[PREVIEW]'}`);
  console.log(`backup: ${arq} (${bk.quando}) · ${antes.length} linhas\n`);

  let agora = [], off = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/cotacoes?select=id,global_venda1,venda_caixa_orig&fornecedor=eq.1&limit=1000&offset=${off}`, { headers: H });
    const d = await r.json();
    if (!Array.isArray(d) || !d.length) break;
    agora = agora.concat(d); if (d.length < 1000) break; off += 1000;
  }
  const porId = new Map(agora.map(x => [x.id, x]));

  const plano = [];
  for (const a of antes) {
    const at = porId.get(a.id);
    if (!at) continue;
    const mudou = String(at.global_venda1) !== String(a.global_venda1) || at.venda_caixa_orig != null;
    if (mudou) plano.push({ id: a.id, v1: a.global_venda1, v2: a.global_venda2 });
  }
  console.log(`linhas a restaurar: ${plano.length}`);
  console.log('amostra: ' + plano.slice(0, 3).map(p => `id=${p.id} -> ${p.v1}`).join(' · ') + '\n');
  if (!GRAVAR) { console.log('PREVIEW — nada gravado.\n'); return; }

  let ok = 0, erro = 0;
  for (const p of plano) {
    const r = await fetch(`${SB}/rest/v1/cotacoes?id=eq.${p.id}`, { method: 'PATCH', headers: H,
      body: JSON.stringify({ global_venda1: p.v1, global_venda2: p.v2, venda_caixa_orig: null }) });
    if (r.status === 204) ok++; else erro++;
    if (ok && ok % 200 === 0) console.log(`  ...${ok}/${plano.length}`);
  }
  console.log(`\nRESTAURADO: ${ok} · erros: ${erro}`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
