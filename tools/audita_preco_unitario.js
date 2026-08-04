// AUDITORIA COMPLETA DO PRECO UNITARIO DO ESTOQUE PROPRIO — 100% SO LEITURA.
// Nao grava nada no banco, nao altera arquivo nenhum (alem do relatorio de saida).
//   node tools/audita_preco_unitario.js            -> resumo no console
//   node tools/audita_preco_unitario.js --xlsx     -> + planilha completa item a item
//
// PERGUNTA QUE RESPONDE: "o preco unitario que a TELA exibe esta certo, item a item?"
// Roda a MESMA funcao que a tela usa (qtdEmbalagem, extraida do fpmed_sistema_final.html)
// e compara com a mediana unitaria do mercado (compra_unit dos concorrentes, que JA e por
// unidade — nao dividir de novo, foi o erro pego em 04/08).
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { lerEstoque } = require('./le_estoque_fpmed');

const GERA_XLSX = process.argv.includes('--xlsx');
const PLANILHA = 'C:/fpmed/Pasta1.xlsx';
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const SR = seg.match(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

// ---- funcoes REAIS da tela ----
const src = fs.readFileSync('C:/fpmed/fpmed_sistema_final.html', 'utf8');
function fn(n) {
  const m = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + n + '\\s*\\(').exec(src);
  if (!m) throw new Error('nao achei ' + n);
  let i = src.indexOf('{', m.index + m[0].length - 1), c = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') c++;
    else if (src[j] === '}') { c--; if (!c) return src.slice(m.index, j + 1); }
  }
}
function konst(n) { return new RegExp('(?:^|\\n)\\s*(?:var|const|let)\\s+' + n + '\\s*=[^;]*;').exec(src)[0]; }
const { qtdEmbalagem, doseKey, _cpzPaNorm } = (new Function(`
  ${konst('CPZ_SALT')} ${konst('_GM_SAL_RE')}
  ${fn('normPA')} ${fn('_gmNorm')} ${fn('doseKey')} ${fn('_cpzPaNorm')}
  ${fn('_undNum')} ${fn('_qtdDoNome')} ${fn('qtdEmbalagem')}
  return { qtdEmbalagem, doseKey, _cpzPaNorm };`))();

const med = a => { const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const money = n => (n == null ? '—' : 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }));

async function tudo(f, c) {
  let o = [], k = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/cotacoes?select=${c}&${f}&limit=1000&offset=${k}`, { headers: H });
    const d = await r.json(); if (!Array.isArray(d) || !d.length) break;
    o = o.concat(d); if (d.length < 1000) break; k += 1000;
  }
  return o;
}

(async () => {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  AUDITORIA DO PRECO UNITARIO — ESTOQUE PROPRIO (SO LEITURA)      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // ── 0) A PLANILHA EM C:\fpmed E A MESMA QUE FOI IMPORTADA? ──────────────
  const daPlan = lerEstoque(PLANILHA).linhas;
  const glob = await tudo('fornecedor=eq.1', 'id,codigo,produto,und,principio_ativo,global_venda1,venda_caixa_orig');
  const conc = await tudo('fornecedor=neq.1', 'produto,principio_ativo,compra_unit');

  const chavePlan = new Set(daPlan.map(x => x.codigo + '|' + x.produto.trim().toUpperCase()));
  const chaveBanco = new Set(glob.map(x => String(x.codigo) + '|' + String(x.produto || '').trim().toUpperCase()));
  const soNaPlan = [...chavePlan].filter(k => !chaveBanco.has(k));
  const soNoBanco = [...chaveBanco].filter(k => !chavePlan.has(k));
  // preco divergente entre planilha e banco?
  const precoPlan = new Map();
  for (const x of daPlan) { const k = x.codigo + '|' + x.produto.trim().toUpperCase(); if (!precoPlan.has(k)) precoPlan.set(k, x.preco); }
  let precoDif = 0;
  for (const g of glob) {
    const k = String(g.codigo) + '|' + String(g.produto || '').trim().toUpperCase();
    const p = precoPlan.get(k);
    if (p != null && Math.abs(Number(g.global_venda1) - p) > 0.005) precoDif++;
  }

  console.log('── 0) A PLANILHA E A MESMA QUE FOI IMPORTADA? ──');
  console.log(`   planilha: ${daPlan.length} linhas · banco: ${glob.length} linhas`);
  console.log(`   so na planilha: ${soNaPlan.length} · so no banco: ${soNoBanco.length} · preco divergente: ${precoDif}`);
  const igual = soNaPlan.length === 0 && soNoBanco.length === 0 && precoDif === 0;
  console.log(`   >>> ${igual ? 'MESMA VERSAO — nada a reimportar' : '⚠️ VERSAO DIFERENTE — NAO REIMPORTAR SEM OK DO LEMUEL'}\n`);
  if (!igual) {
    soNaPlan.slice(0, 5).forEach(k => console.log(`     [so na planilha] ${k.split('|')[1].slice(0, 56)}`));
    soNoBanco.slice(0, 5).forEach(k => console.log(`     [so no banco]    ${k.split('|')[1].slice(0, 56)}`));
  }

  // ── 1) MERCADO: compra_unit JA E POR UNIDADE ────────────────────────────
  const pool = new Map();
  for (const c of conc) {
    const cu = Number(c.compra_unit); if (!isFinite(cu) || cu <= 0) continue;
    const pk = _cpzPaNorm(c.principio_ativo || ''), dk = doseKey(c.produto || '');
    if (pk.length < 3 || !dk) continue;
    const k = pk + '|' + dk; if (!pool.has(k)) pool.set(k, []); pool.get(k).push(cu);
  }

  // ── 2) AUDITORIA ITEM A ITEM ────────────────────────────────────────────
  const linhas = [];
  for (const g of glob) {
    const preco = Number(g.global_venda1);
    const pack = qtdEmbalagem(g.und, g.produto) || 1;
    const unit = isFinite(preco) && preco > 0 ? preco / pack : null;
    const pk = _cpzPaNorm(g.principio_ativo || ''), dk = doseKey(g.produto || '');
    const p = (pk.length >= 3 && dk) ? pool.get(pk + '|' + dk) : null;
    const mercado = p && p.length ? med(p) : null;

    let status, razao = null;
    if (unit == null) status = '❌ SUSPEITO';
    else if (mercado == null) status = '⚠️ SEM COMPARACAO';
    else { razao = unit / mercado; status = (razao >= 0.3 && razao <= 3) ? '✅ OK' : '❌ SUSPEITO'; }

    linhas.push({
      'STATUS': status, 'CÓDIGO': g.codigo, 'PRODUTO': g.produto, 'UND': g.und || '',
      'PREÇO DO RELATÓRIO': isFinite(preco) ? Number(preco.toFixed(4)) : null,
      'PACK DETECTADO': pack,
      'UNITÁRIO QUE A TELA MOSTRA': unit == null ? null : Number(unit.toFixed(4)),
      'MEDIANA DO MERCADO': mercado == null ? null : Number(mercado.toFixed(4)),
      'RAZÃO (nosso ÷ mercado)': razao == null ? null : Number(razao.toFixed(2)),
    });
  }

  const ok = linhas.filter(l => l.STATUS === '✅ OK');
  const sem = linhas.filter(l => l.STATUS === '⚠️ SEM COMPARACAO');
  const sus = linhas.filter(l => l.STATUS === '❌ SUSPEITO');

  console.log('── 1) CLASSIFICACAO DOS ' + linhas.length + ' ITENS ──');
  console.log(`   ✅ OK (unitario 0,3x–3x do mercado) ...... ${String(ok.length).padStart(5)}  ${(ok.length / linhas.length * 100).toFixed(1)}%`);
  console.log(`   ⚠️  SEM COMPARACAO (sem chave de mercado)  ${String(sem.length).padStart(5)}  ${(sem.length / linhas.length * 100).toFixed(1)}%`);
  console.log(`   ❌ SUSPEITO (fora da faixa) .............. ${String(sus.length).padStart(5)}  ${(sus.length / linhas.length * 100).toFixed(1)}%`);
  const comparaveis = ok.length + sus.length;
  console.log(`\n   >>> Dos ${comparaveis} itens COM referencia de mercado, ${ok.length} estao certos (${(ok.length / comparaveis * 100).toFixed(1)}%).`);
  console.log(`   >>> Os outros ${sem.length} nao tem concorrente cotando a mesma chave — o unitario`);
  console.log(`       calculado esta na planilha, mas nao ha contra o que conferir.\n`);

  console.log('── 2) OS 10 PIORES ❌ ──');
  sus.filter(l => l['RAZÃO (nosso ÷ mercado)'] != null)
     .sort((a, b) => b['RAZÃO (nosso ÷ mercado)'] - a['RAZÃO (nosso ÷ mercado)'])
     .slice(0, 10)
     .forEach(l => console.log(`   ${String(l['PRODUTO']).slice(0, 44).padEnd(44)} pack ${String(l['PACK DETECTADO']).padStart(4)} · ${money(l['UNITÁRIO QUE A TELA MOSTRA']).padStart(14)} vs ${money(l['MEDIANA DO MERCADO']).padStart(12)} · ${l['RAZÃO (nosso ÷ mercado)']}x`));

  const baratos = sus.filter(l => l['RAZÃO (nosso ÷ mercado)'] != null && l['RAZÃO (nosso ÷ mercado)'] < 0.3);
  console.log(`\n   (dos ❌, ${baratos.length} sao BARATOS demais <0,3x e ${sus.length - baratos.length} sao CAROS demais >3x)`);

  if (GERA_XLSX) {
    const ordem = { '❌ SUSPEITO': 0, '⚠️ SEM COMPARACAO': 1, '✅ OK': 2 };
    linhas.sort((a, b) => (ordem[a.STATUS] - ordem[b.STATUS]) || ((b['RAZÃO (nosso ÷ mercado)'] || 0) - (a['RAZÃO (nosso ÷ mercado)'] || 0)));
    const ws = XLSX.utils.json_to_sheet(linhas);
    ws['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 52 }, { wch: 7 }, { wch: 18 }, { wch: 15 }, { wch: 26 }, { wch: 20 }, { wch: 22 }];
    ws['!autofilter'] = { ref: ws['!ref'] };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoria unitario');
    const saida = 'C:/fpmed/FPMED - Auditoria preco unitario.xlsx';
    XLSX.writeFile(wb, saida);
    console.log(`\n   planilha completa: ${saida}`);
  }
  console.log('\n(nada foi gravado no banco)\n');
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
