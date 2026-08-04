// DIAGNOSTICO so-leitura: por que a Competitividade nao popula depois do import do estoque FPMED.
// Roda as funcoes REAIS da tela (_cpzKey/_cpzPaNorm/doseKey/_bmForma) sobre o banco REAL.
//   node tools/diag_competitividade.js
'use strict';
const fs = require('fs');

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const SR = seg.match(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

// --- extrai as funcoes da tela sem executar a pagina ---
const src = fs.readFileSync('C:/fpmed/fpmed_sistema_final.html', 'utf8');
const L = src.split(/\r?\n/);
// extrai UMA funcao (ou const) pelo casamento de chaves, sem arrastar o vizinho
function fn(nome) {
  const re = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + nome + '\\s*\\(');
  const m = re.exec(src);
  if (!m) throw new Error('nao achei function ' + nome);
  let i = src.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') n++;
    else if (c === '}') { n--; if (!n) return src.slice(m.index, j + 1); }
  }
  throw new Error('chave nao fechou em ' + nome);
}
function konst(nome) {
  const re = new RegExp('(?:^|\\n)\\s*(?:var|const|let)\\s+' + nome + '\\s*=[^;]*;');
  const m = re.exec(src);
  if (!m) throw new Error('nao achei const ' + nome);
  return m[0];
}

// So os 2 primeiros portoes do _cpzKey: PA (>=3 chars) e doseKey. Se o PA nao passa,
// a chave ja sai null e forma/concorrente nem sao consultados.
const ctx = (new Function(`
  ${konst('CPZ_SALT')} ${konst('_GM_SAL_RE')}
  ${fn('normPA')} ${fn('_gmNorm')} ${fn('doseKey')} ${fn('_cpzPaNorm')}
  return { _cpzPaNorm, doseKey };
`))();

(async () => {
  async function tudo(filtro) {
    let out = [], off = 0;
    for (;;) {
      const r = await fetch(`${SB}/rest/v1/cotacoes?select=fornecedor,tipo,produto,principio_ativo,und,estoque,global_venda1,compra_unit&${filtro}&limit=1000&offset=${off}`, { headers: H });
      const d = await r.json();
      if (!Array.isArray(d) || !d.length) break;
      out = out.concat(d); if (d.length < 1000) break; off += 1000;
    }
    return out;
  }
  const glob = await tudo('fornecedor=eq.1');
  const conc = await tudo('fornecedor=neq.1');
  console.log(`\nGLOBAL (estoque FPMED): ${glob.length} linhas Â· concorrentes: ${conc.length}\n`);

  // ---- FUNIL do lado GLOBAL ----
  let semPA = 0, semDose = 0, comChave = 0;
  const chavesG = new Map();
  for (const g of glob) {
    const pa = ctx._cpzPaNorm(g.principio_ativo || '');
    const dk = ctx.doseKey(g.produto || '');
    if (pa.length < 3) { semPA++; continue; }
    if (!dk) { semDose++; continue; }
    comChave++;
    chavesG.set(pa+"|"+dk,1);
  }
  console.log('FUNIL (estado de hoje):');
  console.log(`  1) sem PA (principio_ativo vazio) ... ${semPA}   <-- barreira`);
  console.log(`  2) com PA mas sem dose no nome ..... ${semDose}`);
  console.log(`  3) formam chave e entram ........... ${comChave}`);

  // ---- E SE o PA fosse preenchido? mede quantos teriam dose + concorrente ----
  const chavesC = new Set();
  for (const c of conc) { const p=ctx._cpzPaNorm(c.principio_ativo||""), d=ctx.doseKey(c.produto||""); if(p.length>=3&&d) chavesC.add(p+"|"+d); }
  let teriaDose = 0;
  for (const g of glob) if (ctx.doseKey(g.produto || '')) teriaDose++;
  console.log(`\nPOTENCIAL (se o principio_ativo for preenchido):`);
  console.log(`  GLOBAL com dose lida do nome ....... ${teriaDose} de ${glob.length}`);
  console.log(`  chaves distintas do lado concorrente ${chavesC.size}`);
  console.log(`  (o teto real depende do PA resolvido item a item â€” resolvePA/CMED)\n`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
