// AUDITA o detector de pack (_qtdDoNome/qtdEmbalagem) contra os itens "a conferir".
// SO LEITURA. Nao grava nada, nao altera o banco.
//   node tools/audita_pack.js
'use strict';
const fs = require('fs');

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
const { qtdEmbalagem, _qtdDoNome, doseKey, _cpzPaNorm } = (new Function(`
  ${konst('CPZ_SALT')} ${konst('_GM_SAL_RE')}
  ${fn('normPA')} ${fn('_gmNorm')} ${fn('doseKey')} ${fn('_cpzPaNorm')}
  ${fn('_undNum')} ${fn('_qtdDoNome')} ${fn('qtdEmbalagem')}
  return { qtdEmbalagem, _qtdDoNome, doseKey, _cpzPaNorm };`))();

const med = a => { const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
async function tudo(f, c) {
  let o = [], k = 0;
  for (;;) { const r = await fetch(`${SB}/rest/v1/cotacoes?select=${c}&${f}&limit=1000&offset=${k}`, { headers: H });
    const d = await r.json(); if (!Array.isArray(d) || !d.length) break; o = o.concat(d); if (d.length < 1000) break; k += 1000; }
  return o;
}

(async () => {
  const glob = await tudo('fornecedor=eq.1', 'codigo,produto,und,principio_ativo,global_venda1');
  const conc = await tudo('fornecedor=neq.1', 'produto,principio_ativo,compra_unit');
  const pool = new Map();
  for (const c of conc) {
    const cu = Number(c.compra_unit); if (!isFinite(cu) || cu <= 0) continue;
    const pk = _cpzPaNorm(c.principio_ativo || ''), dk = doseKey(c.produto || '');
    if (pk.length < 3 || !dk) continue;
    const k = pk + '|' + dk; if (!pool.has(k)) pool.set(k, []); pool.get(k).push(cu);
  }

  const suspeitos = [];
  for (const g of glob) {
    const v1 = Number(g.global_venda1); if (!isFinite(v1) || v1 <= 0) continue;
    const pk = _cpzPaNorm(g.principio_ativo || ''), dk = doseKey(g.produto || '');
    if (pk.length < 3 || !dk) continue;
    const p = pool.get(pk + '|' + dk); if (!p || !p.length) continue;
    const pack = qtdEmbalagem(g.und, g.produto) || 1;
    const nosso = v1 / pack, melhor = Math.min(...p), mediana = med(p);
    if (nosso <= melhor * 1.6) continue;
    suspeitos.push({ ...g, pack, nosso, mediana, razao: nosso / mediana });
  }
  console.log(`\n══ AUDITORIA DO DETECTOR DE PACK ══  ${suspeitos.length} itens acima da regua\n`);

  // qual PACK faria o preco bater no mercado? (pack implicito ideal)
  console.log('── itens onde o detector deu 1 mas o nome PARECE ter contagem ──');
  const PADROES = [
    { nome: '25F/A  (N + F/A)',            re: /\b(\d{1,4})\s*F\s*\/\s*A\b/i },
    { nome: '50FRS/AMP',                   re: /\b(\d{1,4})\s*FRS?\s*\/\s*AMP\b/i },
    { nome: '100AMP',                      re: /\b(\d{1,4})\s*AMP\b/i },
    { nome: 'C/25 · C/ 100',               re: /\bC\/\s*(\d{1,4})\b/i },
    { nome: '120X5ML  (NxM ml)',           re: /\b(\d{1,4})\s*X\s*\d/i },
    { nome: 'CX C/ 100 BLS',               re: /\bBLS?\b/i },
    { nome: '250PCT C/10UND',              re: /\b(\d{1,4})\s*PCT\b/i },
    { nome: '20FR/AMP · 25FR',             re: /\b(\d{1,4})\s*FR\b/i },
    { nome: '30CPR · 500 CPR',             re: /\b(\d{1,4})\s*CPR?\b/i },
    { nome: '250CAPS · 21CPS',             re: /\b(\d{1,4})\s*C[AP]PS\b/i },
    { nome: '100UND · 10UN',               re: /\b(\d{1,4})\s*UND?\b/i },
    { nome: '10SER (seringas)',            re: /\b(\d{1,4})\s*SER\b/i },
    { nome: '35UND no fim',                re: /\b(\d{1,4})\s*UND\s*$/i },
  ];
  const perdidos = suspeitos.filter(s => s.pack <= 1);
  console.log(`  ${perdidos.length} de ${suspeitos.length} sairam com pack 1\n`);

  const contaPadrao = {};
  for (const s of perdidos) {
    const achou = PADROES.filter(p => p.re.test(s.produto)).map(p => p.nome);
    for (const a of achou) contaPadrao[a] = (contaPadrao[a] || 0) + 1;
    if (achou.length) {
      const m = s.produto.match(PADROES.find(p => p.nome === achou[0]).re);
      const packSug = m && m[1] ? parseInt(m[1]) : null;
      const unitSug = packSug ? s.nosso / packSug : null;
      console.log(`  ${s.produto.slice(0, 50).padEnd(50)} [${achou[0]}] pack? ${String(packSug).padStart(4)} · ${s.nosso.toFixed(2).padStart(9)} -> ${unitSug ? unitSug.toFixed(4).padStart(9) : '   —'} · mercado ${s.mediana.toFixed(4)}`);
    }
  }
  console.log('\n── padroes que o detector esta perdendo (frequencia) ──');
  Object.entries(contaPadrao).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`  ${String(n).padStart(3)}x  ${p}`));

  const semPadrao = perdidos.filter(s => !PADROES.some(p => p.re.test(s.produto)));
  console.log(`\n── pack 1 e SEM padrao reconhecivel no nome (${semPadrao.length}) — ficam pro cliente ──`);
  semPadrao.slice(0, 10).forEach(s => console.log(`  ${s.produto.slice(0, 52).padEnd(52)} ${s.nosso.toFixed(2)} vs ${s.mediana.toFixed(4)}`));
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
