// Gera o Excel "FPMED — Itens com preço a conferir" com os itens que a Competitividade
// joga em "Em revisão" por preço muito acima do mercado.
//   node tools/gera_xlsx_precos_conferir.js [saida.xlsx]
// SO LEITURA do banco. Nao grava nada.
//
// CRITERIO (o mesmo da tela): item do estoque proprio que forma chave PA|dose, tem concorrente
// cotando, e cujo preco unitario fica >60% acima do MELHOR concorrente. E o balde que a tela
// isola dos KPIs ate conferencia item a item.
'use strict';
const fs = require('fs');
const XLSX = require('xlsx');

const SAIDA = process.argv[2] || 'C:/fpmed/FPMED_precos_a_conferir.xlsx';
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const SR = seg.match(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

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

async function tudo(filtro, cols) {
  let out = [], off = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/cotacoes?select=${cols}&${filtro}&limit=1000&offset=${off}`, { headers: H });
    const d = await r.json();
    if (!Array.isArray(d) || !d.length) break;
    out = out.concat(d); if (d.length < 1000) break; off += 1000;
  }
  return out;
}

(async () => {
  const glob = await tudo('fornecedor=eq.1', 'codigo,produto,und,principio_ativo,global_venda1');
  const conc = await tudo('fornecedor=neq.1', 'produto,principio_ativo,compra_unit');

  const pool = new Map();
  for (const c of conc) {
    const cu = Number(c.compra_unit); if (!isFinite(cu) || cu <= 0) continue;   // ja e por UNIDADE
    const pk = _cpzPaNorm(c.principio_ativo || ''), dk = doseKey(c.produto || '');
    if (pk.length < 3 || !dk) continue;
    const k = pk + '|' + dk;
    if (!pool.has(k)) pool.set(k, []);
    pool.get(k).push(cu);
  }

  const linhas = [];
  for (const g of glob) {
    const v1 = Number(g.global_venda1); if (!isFinite(v1) || v1 <= 0) continue;
    const pk = _cpzPaNorm(g.principio_ativo || ''), dk = doseKey(g.produto || '');
    if (pk.length < 3 || !dk) continue;
    const p = pool.get(pk + '|' + dk); if (!p || !p.length) continue;
    const pack = qtdEmbalagem(g.und, g.produto) || 1;
    const nosso = v1 / pack;
    const melhor = Math.min(...p), mediana = med(p);
    if (nosso <= melhor * 1.6) continue;                       // dentro da regua: nao entra
    linhas.push({
      'CÓDIGO': g.codigo,
      'PRODUTO': g.produto,
      'UND': g.und || '',
      'PREÇO DO RELATÓRIO': Number(v1.toFixed(4)),
      'PACK DETECTADO': pack,
      'NOSSO UNITÁRIO (relatório ÷ pack)': Number(nosso.toFixed(4)),
      'MEDIANA UNITÁRIA DO MERCADO': Number(mediana.toFixed(4)),
      '% ACIMA DO MERCADO': Number(((nosso / mediana - 1) * 100).toFixed(0)),
      'PREÇO CORRETO (preencher)': '',
    });
  }
  linhas.sort((a, b) => b['% ACIMA DO MERCADO'] - a['% ACIMA DO MERCADO']);

  const ws = XLSX.utils.json_to_sheet(linhas);
  ws['!cols'] = [{ wch: 10 }, { wch: 54 }, { wch: 7 }, { wch: 18 }, { wch: 15 },
                 { wch: 26 }, { wch: 27 }, { wch: 18 }, { wch: 24 }];
  ws['!autofilter'] = { ref: ws['!ref'] };
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Preços a conferir');
  XLSX.writeFile(wb, SAIDA);
  console.log(`${linhas.length} itens · arquivo: ${SAIDA}`);
  console.log('top 5: ' + linhas.slice(0, 5).map(l => `${l['PRODUTO'].slice(0, 34)} (+${l['% ACIMA DO MERCADO']}%)`).join(' · '));
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
