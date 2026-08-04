// Restaura a coluna `und` (UNIDADE do relatorio) nas linhas de estoque proprio.
//   node tools/restaura_und_global.js            -> PREVIEW
//   node tools/restaura_und_global.js --gravar   -> grava
//
// POR QUE IMPORTA (descoberto 04/08): a UNIDADE nao muda o qtdEmbalagem (CX/FR/UND nao carregam
// numero), mas e ela que DECLARA A BASE DO PRECO — CX = preco da caixa, FR/UND = preco por
// unidade. Sem ela nao da pra saber se um preco precisa ser dividido pelo pack ou nao, e
// dividir errado corrompe a Competitividade. Casa por codigo (7 digitos, ja corrigido).
'use strict';
const fs = require('fs');
const { lerEstoque } = require('./le_estoque_fpmed');

const GRAVAR = process.argv.includes('--gravar');
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const SR = seg.match(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

(async () => {
  console.log('\n══ Restaurar UNIDADE do estoque proprio ══ ' + (GRAVAR ? '[GRAVAR]' : '[PREVIEW]') + '\n');
  let banco = [], off = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/cotacoes?select=id,codigo,produto,und&fornecedor=eq.1&limit=1000&offset=${off}`, { headers: H });
    const d = await r.json();
    if (!Array.isArray(d) || !d.length) break;
    banco = banco.concat(d); if (d.length < 1000) break; off += 1000;
  }
  // planilha: chave codigo+produto (o codigo repete — 907 codigos p/ 1.381 linhas)
  const plan = new Map();
  for (const x of lerEstoque('C:/fpmed/Pasta1.xlsx').linhas) {
    const k = x.codigo + '|' + x.produto.trim().toUpperCase();
    if (!plan.has(k) && x.und) plan.set(k, x.und);
  }

  const plano = [], semPar = [];
  for (const b of banco) {
    if (b.und) continue;
    const u = plan.get(String(b.codigo) + '|' + String(b.produto || '').trim().toUpperCase());
    if (!u) { semPar.push(b.produto); continue; }
    plano.push({ id: b.id, und: u });
  }
  const porUnd = {};
  for (const p of plano) porUnd[p.und] = (porUnd[p.und] || 0) + 1;
  console.log(`banco: ${banco.length} · a preencher: ${plano.length} · sem par na planilha: ${semPar.length}`);
  console.log('distribuicao: ' + Object.entries(porUnd).sort((a, b) => b[1] - a[1]).map(([u, n]) => `${u}=${n}`).join(' · ') + '\n');
  if (semPar.length) console.log('  sem par (amostra): ' + semPar.slice(0, 5).join(' | ') + '\n');

  if (!GRAVAR) { console.log('PREVIEW — nada gravado.\n'); return; }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  fs.mkdirSync('C:/fpmed/backups', { recursive: true });
  fs.writeFileSync(`C:/fpmed/backups/backup_und_global_${stamp}.json`, JSON.stringify({ quando: stamp, antes: banco }, null, 1));
  console.log(`BACKUP em backups/backup_und_global_${stamp}.json\n`);
  let ok = 0, erro = 0;
  for (const p of plano) {
    const r = await fetch(`${SB}/rest/v1/cotacoes?id=eq.${p.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ und: p.und }) });
    if (r.status === 204) ok++; else erro++;
    if (ok && ok % 300 === 0) console.log(`  ...${ok}/${plano.length}`);
  }
  console.log(`\nGRAVADO: ${ok} · erros: ${erro}`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
