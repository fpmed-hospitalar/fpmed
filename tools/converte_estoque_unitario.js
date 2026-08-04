// Converte o preco do ESTOQUE PROPRIO (fornecedor='1') de PRECO DE CAIXA -> PRECO UNITARIO.
//   node tools/converte_estoque_unitario.js            -> PREVIEW (nada gravado)
//   node tools/converte_estoque_unitario.js --gravar   -> grava (SO com OK do Lemuel)
//
// POR QUE: o relatorio de estoque da FPMED veio com preco de CAIXA e os concorrentes cotam por
// UNIDADE — por isso os itens de pack grande apareciam com +45602% na Competitividade e caiam
// no balde "Em revisao".
//
// SEGURANCA (a regra do Lemuel):
//   - pack vem do NOME, pela funcao qtdEmbalagem que o sistema ja usa (CX100, 50F/A, C/25...)
//   - converte SO onde o pack e >1 e identificado com confianca; pack 1/ambiguo NAO e tocado
//   - o preco de caixa original e PRESERVADO na coluna venda_caixa_orig (+ backup JSON completo)
//   - sanidade contra o mercado: se o unitario sair >10x ou <0,1x a mediana dos concorrentes,
//     a linha e SEGURADA (nao converte) e sai listada
//   - idempotente: linha que ja tem venda_caixa_orig preenchida nunca e convertida de novo
'use strict';
const fs = require('fs');

const GRAVAR = process.argv.includes('--gravar');
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const SR = seg.match(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

// ---- funcoes REAIS do sistema (nao recopia) ----
const src = fs.readFileSync('C:/fpmed/fpmed_sistema_final.html', 'utf8');
function fn(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + nome + '\\s*\\(').exec(src);
  if (!m) throw new Error('nao achei ' + nome);
  let i = src.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') n++;
    else if (src[j] === '}') { n--; if (!n) return src.slice(m.index, j + 1); }
  }
  throw new Error('chave nao fechou: ' + nome);
}
function konst(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:var|const|let)\\s+' + nome + '\\s*=[^;]*;').exec(src);
  if (!m) throw new Error('nao achei const ' + nome);
  return m[0];
}
const ctx = (new Function(`
  ${konst('CPZ_SALT')} ${konst('_GM_SAL_RE')}
  ${fn('normPA')} ${fn('_gmNorm')} ${fn('doseKey')} ${fn('_cpzPaNorm')}
  ${fn('_undNum')} ${fn('_qtdDoNome')} ${fn('qtdEmbalagem')}
  return { qtdEmbalagem, _qtdDoNome, doseKey, _cpzPaNorm };
`))();
const { qtdEmbalagem, _qtdDoNome, doseKey, _cpzPaNorm } = ctx;

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
const med = a => { const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const money = n => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  console.log('\n══ Estoque proprio: PRECO DE CAIXA -> PRECO UNITARIO ══  ' +
              (GRAVAR ? '[GRAVAR]' : '[PREVIEW — nada sera gravado]') + '\n');

  const glob = await tudo('fornecedor=eq.1', 'id,codigo,produto,und,principio_ativo,global_venda1,global_venda2,venda_caixa_orig');
  const conc = await tudo('fornecedor=neq.1', 'produto,principio_ativo,und,compra_unit');
  console.log(`estoque proprio: ${glob.length} linhas · concorrentes: ${conc.length}`);

  // mediana de mercado por chave PA|dose (custo do concorrente, ja por unidade)
  const poolPorChave = new Map();
  for (const c of conc) {
    const cu = Number(c.compra_unit); if (!isFinite(cu) || cu <= 0) continue;
    const pk = _cpzPaNorm(c.principio_ativo || ''), dk = doseKey(c.produto || '');
    if (pk.length < 3 || !dk) continue;
    const k = pk + '|' + dk;
    // ⚠️ compra_unit do concorrente JA E POR UNIDADE (blueprint do projeto: compra_unit =
    // preco_unit POR UNIDADE). NAO dividir pelo pack aqui — a 1a versao dividia e a mediana
    // saia 10-100x barata demais, o que fez o teste de sanidade segurar 206 linhas corretas
    // (ceftriaxona a "R$ 0,07/frasco", amiodarona a "R$ 0,03/ampola").
    if (!poolPorChave.has(k)) poolPorChave.set(k, []);
    poolPorChave.get(k).push(cu);
  }
  console.log(`mercado: ${poolPorChave.size} chaves com preco unitario\n`);

  const converter = [], intocados = [], segurados = [], discordaUnd = [];
  for (const g of glob) {
    const v1 = Number(g.global_venda1);
    if (g.venda_caixa_orig != null) { intocados.push({ g, motivo: 'ja convertido antes' }); continue; }
    if (!isFinite(v1) || v1 <= 0) { intocados.push({ g, motivo: 'sem preco' }); continue; }

    const pack = qtdEmbalagem(g.und, g.produto) || 1;
    if (pack <= 1) { intocados.push({ g, motivo: 'pack 1 / nao identificado no nome' }); continue; }

    const unit = v1 / pack;
    const pk = _cpzPaNorm(g.principio_ativo || ''), dk = doseKey(g.produto || '');
    const pool = (pk.length >= 3 && dk) ? poolPorChave.get(pk + '|' + dk) : null;
    const mercado = pool && pool.length ? med(pool) : null;

    // sanidade: unitario absurdo contra o mercado -> SEGURA
    if (mercado && (unit > mercado * 10 || unit < mercado * 0.1)) {
      segurados.push({ g, pack, unit, mercado, razao: unit / mercado });
      continue;
    }
    // sinal extra: a UNIDADE declara base unitaria mas o nome traz contagem -> registra (nao barra)
    const u = String(g.und || '').toUpperCase().replace(/\./g, '');
    if (['FR', 'UND', 'UN', 'UNID', 'UNI', 'AMP', 'F/A', 'CP'].includes(u)) {
      discordaUnd.push({ produto: g.produto, und: g.und, pack, de: v1, para: unit, mercado });
    }
    converter.push({ id: g.id, produto: g.produto, und: g.und, pack, de: v1, para: unit,
                     v2: Number(g.global_venda2), mercado });
  }

  console.log('── PLANO ──');
  console.log(`  converter (pack >1, sanidade ok) ... ${converter.length}`);
  console.log(`  intocados ......................... ${intocados.length}`);
  console.log(`  SEGURADOS (unitario absurdo) ...... ${segurados.length}`);
  const porMotivo = {};
  intocados.forEach(x => porMotivo[x.motivo] = (porMotivo[x.motivo] || 0) + 1);
  console.log('    motivos: ' + Object.entries(porMotivo).map(([m, n]) => `${m}=${n}`).join(' · ') + '\n');

  console.log('── 10 EXEMPLOS (nome · pack · caixa -> unitario · mercado) ──');
  converter.filter(c => c.mercado).slice(0, 10).forEach(c => {
    const d = ((c.para / c.mercado - 1) * 100).toFixed(0);
    console.log(`  ${c.produto.slice(0, 46).padEnd(46)} pack ${String(c.pack).padStart(4)} · ${money(c.de).padStart(12)} -> ${money(c.para).padStart(10)} · mercado ${money(c.mercado)} (${d > 0 ? '+' : ''}${d}%)`);
  });

  if (segurados.length) {
    console.log('\n── ⚠ SEGURADOS (nao convertidos — conferir a mao) ──');
    segurados.slice(0, 12).forEach(s => console.log(`  ${s.g.produto.slice(0, 48).padEnd(48)} pack ${s.pack} · ${money(s.g.global_venda1)} -> ${money(s.unit)} · mercado ${money(s.mercado)} (${s.razao.toFixed(1)}x)`));
  }
  if (discordaUnd.length) {
    console.log(`\n── ℹ UNIDADE diz unitario mas o nome traz contagem (${discordaUnd.length}) — convertidos, confira ──`);
    discordaUnd.slice(0, 8).forEach(d => console.log(`  [${d.und}] ${d.produto.slice(0, 44).padEnd(44)} pack ${d.pack} · ${money(d.de)} -> ${money(d.para)}`));
  }

  if (!GRAVAR) { console.log('\nPREVIEW encerrado — nada gravado. Para gravar: --gravar\n'); return; }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  fs.mkdirSync('C:/fpmed/backups', { recursive: true });
  const arq = `C:/fpmed/backups/backup_unitario_${stamp}.json`;
  fs.writeFileSync(arq, JSON.stringify({ quando: stamp, antes: glob }, null, 1));
  console.log(`\nBACKUP das ${glob.length} linhas em: ${arq}\n`);

  let ok = 0, erro = 0;
  for (const c of converter) {
    const body = { venda_caixa_orig: c.de, global_venda1: Number(c.para.toFixed(6)) };
    if (isFinite(c.v2) && c.v2 > 0) body.global_venda2 = Number((c.v2 / c.pack).toFixed(6));
    const r = await fetch(`${SB}/rest/v1/cotacoes?id=eq.${c.id}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) });
    if (r.status === 204) ok++; else { erro++; if (erro <= 3) console.log(`  erro id=${c.id}: HTTP ${r.status}`); }
    if (ok && ok % 200 === 0) console.log(`  ...${ok}/${converter.length}`);
  }
  console.log(`\nGRAVADO: ${ok} · erros: ${erro}`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
