// ═══════════════════════════════════════════════════════════════════════════════
// RESOLVE O PACK DOS ITENS SEM CONTAGEM NO NOME, pela apresentacao oficial da CMED.
// Item 6 da fila (camada 1). Camada 2 (busca web) fica pra depois.
//
// Uso:  node tools/resolve_pack_cmed.js            -> PREVIEW (nada gravado)
//       node tools/resolve_pack_cmed.js --apply    -> INSERT em pack_confirmado (tabela vazia)
//
// O PROBLEMA: linha cujo nome nao declara quantas unidades vem na caixa. A tela mostra
// "⚠ conferir emb." em vez de chutar um divisor — resposta certa, mas que nao avanca: o item
// fica fora da comparacao de preco.
//
// A FONTE: a cmed_pf tem a apresentacao OFICIAL da ANVISA com `qtd_apres` ja extraido
// ("CX 25 FA VD TRANS X 5 ML" -> 25). Se o nosso item casa por PRINCIPIO ATIVO + DOSE, o
// pack de la e o nosso.
//
// >>> NAO ALTERA PRECO. Grava so em pack_confirmado; nenhum valor de `cotacoes` e tocado.
//     A tela le o pack daqui e divide SO NA EXIBICAO (regra de 04/08).
//
// ⛔ ACHADO DE 05/08 QUE MUDOU O DESENHO — LEIA ANTES DE MEXER AQUI:
// casar por PRINCIPIO ATIVO + DOSE **NAO** determina o nosso pack, e o primeiro preview
// provou isso com dado real. "OMNISCAN 287MG/ML **1FR/AP** 10ML" recebeu pack 10, vindo da
// apresentacao "CT 10 FA VD TRANS X 10 ML" da CMED. So que essa apresentacao e a CAIXA DO
// FABRICANTE; o nosso item e UM frasco. PA+dose descreve o MEDICAMENTO, nao a EMBALAGEM que
// o distribuidor nos vendeu. Aplicar aquele resultado teria dividido o preco por 10 e criado
// exatamente o erro que a tabela existe pra evitar.
//
// Determinar o pack pela CMED so seria seguro com GGREM ou EAN — que identificam a
// apresentacao exata — e o nosso cadastro nao tem nem um nem outro. Enquanto nao tiver, esta
// camada fica LIMITADA aos casos em que o nosso PROPRIO NOME declara o pack, e o papel da
// CMED e so CONFERIR o que o nome diz, nunca substituir.
//
// A parte que rendeu de verdade nesta rodada foi outra e esta na tela: o "1 + recipiente"
// declarado no nome ("1FR/AP", "1SER", "1 F/A") passou a valer como pack 1 em vez de cair em
// "nao sei" — 27 das 112 linhas, com ZERO falso positivo entre as 8.720 que ja tinham pack.
// Ver _CMP_UM_DECLARADO no fpmed_sistema_final.html.
//
// A REGRA DE OURO AQUI E A AMBIGUIDADE: o mesmo principio ativo na mesma dose tem varias
// apresentacoes na CMED, com packs diferentes (1, 25, 50, 100). Casar e facil; saber QUAL
// e o nosso e o problema. Por isso este tool RODA EM PREVIEW e nao grava sozinho: ele lista
// candidatos pra conferencia humana. Melhor "conferir emb." do que um pack inventado — pack
// errado vira preco unitario errado no orcamento, que e o erro que sai da empresa.
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');

const APPLY = process.argv.includes('--apply');
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
if (!SR) { console.error('service_role nao encontrada'); process.exit(1); }
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

// ── funcoes REAIS da tela, extraidas por ancora (nao recopiadas) ──────────────────────────
const src = fs.readFileSync('C:/fpmed/fpmed_sistema_final.html', 'utf8');
function fn(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + nome + '\\s*\\(').exec(src);
  if (!m) throw new Error('nao achei function ' + nome);
  let i = src.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < src.length; j++) { if (src[j] === '{') n++; else if (src[j] === '}') { n--; if (!n) return src.slice(m.index, j + 1); } }
  throw new Error('chave nao fechou: ' + nome);
}
function konst(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:var|const|let)\\s+' + nome + '\\s*=[^;]*;').exec(src);
  if (!m) throw new Error('nao achei const ' + nome);
  return m[0];
}
const ctx = (new Function(`console.warn=function(){};
  ${konst('CPZ_SALT')} ${konst('_GM_SAL_RE')} ${konst('_CMP_CALIBRE')}
  ${konst('_CMP_UND_UNITARIA')} ${konst('_CMP_UND_AGREGADORA')}
  ${fn('normPA')} ${fn('_gmNorm')} ${fn('doseKey')} ${fn('_cpzPaNorm')}
  ${fn('_undNum')} ${fn('_qtdDoNome')} ${fn('_semCalibre')} ${fn('qtdEmbalagem')} ${fn('cmpUnitario')}
  return { _gmNorm, doseKey, _cpzPaNorm, qtdEmbalagem, cmpUnitario };`))();
const { _gmNorm, doseKey, _cpzPaNorm, qtdEmbalagem, cmpUnitario } = ctx;

const normProduto = s => _gmNorm(String(s || '').replace(/^[*#+>&@.\s]+/, ''));

async function tudo(path) {
  let out = [], off = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/${path}&limit=1000&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error(path + ' -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
    const d = await r.json();
    if (!Array.isArray(d) || !d.length) break;
    out = out.concat(d); if (d.length < 1000) break; off += 1000;
  }
  return out;
}

(async () => {
  console.log(APPLY ? '[APPLY]' : '[PREVIEW — nada e gravado]');
  const cot = await tudo('cotacoes?select=id,fornecedor,tipo,produto,principio_ativo,marca,und,compra_unit,compra_caixa,global_venda1,global_venda2,venda_unit_calculada');
  const cmed = await tudo('cmed_pf?select=ggrem,subst_norm,marca_norm,apresentacao,dose_key,qtd_apres&qtd_apres=gt.1');
  console.log(`cotacoes: ${cot.length} | apresentacoes CMED com pack > 1: ${cmed.length}`);

  // ── quem precisa: linha cujo unitario nao da pra calcular por falta de pack ──────────────
  const semPack = cot.filter(c => cmpUnitario(c).status === 'conferir');
  console.log(`linhas sem pack conhecido (a tela mostra "conferir emb."): ${semPack.length}`);

  // ── indice da CMED por PA + dose ────────────────────────────────────────────────────────
  const porChave = new Map();
  for (const x of cmed) {
    const pa = _cpzPaNorm(x.subst_norm || ''), dk = x.dose_key || '';
    if (pa.length < 3 || !dk) continue;
    const k = pa + '|' + dk;
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(x);
  }
  console.log(`chaves PA+dose na CMED: ${porChave.size}`);

  const plano = [], recusados = [];
  const vistos = new Set();
  for (const c of semPack) {
    const pa = _cpzPaNorm(c.principio_ativo || ''), dk = doseKey(c.produto || '');
    const pnorm = normProduto(c.produto);
    if (!pnorm || vistos.has(pnorm)) continue;         // um registro por produto (a chave e o nome)
    if (pa.length < 3 || !dk) { recusados.push({ p: c.produto, por: 'sem PA ou sem dose no nosso lado' }); continue; }
    const cands = porChave.get(pa + '|' + dk);
    if (!cands || !cands.length) { recusados.push({ p: c.produto, por: 'nenhuma apresentacao da CMED com este PA+dose' }); continue; }

    // (b) a MARCA do nosso item restringe as candidatas?
    const marcaN = _gmNorm(c.marca || '');
    let usadas = cands, via = 'PA+dose';
    if (marcaN.length >= 4) {
      const porMarca = cands.filter(x => _gmNorm(x.marca_norm || '') === marcaN);
      if (porMarca.length) { usadas = porMarca; via = 'PA+dose+marca'; }
    }
    const packs = [...new Set(usadas.map(x => x.qtd_apres))];
    if (packs.length !== 1) {
      recusados.push({ p: c.produto, por: `${usadas.length} apresentacoes discordam do pack (${packs.slice(0,6).join('/')})` });
      continue;
    }
    vistos.add(pnorm);
    plano.push({
      produto_norm: pnorm, produto: c.produto, pack: packs[0], fonte: 'cmed',
      ggrem: usadas[0].ggrem, evidencia: String(usadas[0].apresentacao || '').slice(0, 240),
      confianca: via === 'PA+dose+marca' ? 'alta' : (usadas.length === 1 ? 'alta' : 'media'),
      criado_por: 'tools/resolve_pack_cmed.js', _via: via, _n: usadas.length,
    });
  }

  console.log('\n── PREVIEW ────────────────────────────────────────────');
  console.log(`resolvidos ............. ${plano.length}`);
  console.log(`  por PA+dose+marca .... ${plano.filter(x => x._via === 'PA+dose+marca').length}`);
  console.log(`  por PA+dose (todas as apresentacoes concordam) ... ${plano.filter(x => x._via === 'PA+dose').length}`);
  console.log(`  confianca alta ....... ${plano.filter(x => x.confianca === 'alta').length}`);
  console.log(`nao resolvidos ......... ${recusados.length}`);
  const porMotivo = {};
  recusados.forEach(r => { const k = r.por.replace(/\d+/g, 'N'); porMotivo[k] = (porMotivo[k] || 0) + 1; });
  Object.entries(porMotivo).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(v).padStart(4)}  ${k}`));

  console.log('\namostra do que SERIA gravado:');
  plano.slice(0, 12).forEach(x => console.log(`  ${x.produto.slice(0, 46).padEnd(48)} pack ${String(x.pack).padStart(4)}  [${x._via}, ${x._n} apres.]  <- ${x.evidencia.slice(0, 46)}`));
  console.log('\namostra do que FICA DE FORA (segue "conferir emb."):');
  recusados.slice(0, 8).forEach(r => console.log(`  ${String(r.p).slice(0, 46).padEnd(48)} ${r.por}`));

  const jaTem = await fetch(`${SB}/rest/v1/pack_confirmado?select=produto_norm`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (jaTem.status === 404 || jaTem.status === 400) { console.error('\ntabela pack_confirmado nao existe — rodar antes: node tools/roda_sql.js --arquivo ddl/pack_confirmado.sql'); process.exit(1); }
  const nExist = parseInt((jaTem.headers.get('content-range') || '/0').split('/')[1]) || 0;
  console.log(`\nlinhas ja na pack_confirmado: ${nExist}`);

  console.log('\n⛔ ESTE TOOL NAO GRAVA SEM OK EXPLICITO DO LEMUEL, e a razao esta no cabecalho:');
  console.log('   casar por PA+dose descreve o MEDICAMENTO, nao a EMBALAGEM que nos venderam.');
  console.log('   Cada linha acima precisa de conferencia humana antes de virar divisor de preco.');
  if (!APPLY) { console.log('\nPreview OK. Nada gravado.'); return; }
  if (!process.argv.includes('--confirmado-pelo-lemuel')) {
    console.error('\nRECUSADO: --apply sozinho nao basta aqui. Rodar com --confirmado-pelo-lemuel');
    console.error('depois que ele conferir a lista acima item a item.');
    process.exit(1);
  }
  if (nExist > 0) { console.error('\nRECUSADO: a tabela ja tem linha. Regravar por cima e UPDATE — exige OK do Lemuel.'); process.exit(1); }
  if (!plano.length) { console.log('nada a gravar.'); return; }

  const linhas = plano.map(({ _via, _n, ...r }) => r);
  let n = 0;
  for (let i = 0; i < linhas.length; i += 500) {
    const lote = linhas.slice(i, i + 500);
    const r = await fetch(`${SB}/rest/v1/pack_confirmado`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(lote) });
    if (!r.ok) { console.error('ERRO no lote ' + i + ': ' + r.status + ' ' + (await r.text()).slice(0, 200)); process.exit(1); }
    n += lote.length;
  }
  console.log(`gravadas: ${n}`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
