/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_resultado_item.js — O RESULTADO POR ITEM, CONFERIDO CONTRA O PNCP (fatia A7, 14/08)

   "Gravou 192 resultados" não prova que gravou os resultados CERTOS — prova que contou certo.
   Esta prova pega itens gravados no banco, vai ao PNCP buscar o resultado DAQUELE item, e
   exige que vencedor, CNPJ, valor unitário e quantidade batam.

   >>> E ELA CONFERE TAMBÉM O QUE **NÃO** FOI GRAVADO. Item sem resultado tem que estar com os
       campos em `null` — e `null` aqui significa "ainda não sei", nunca "não ganhei". Uma
       prova que só olha o que foi preenchido deixa passar exatamente o erro mais caro: o dia
       em que um item ainda não julgado aparecer como perdido.

   node tools/prova_resultado_item.js [--controle <numero_controle>]
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };
const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };

let p = 0, f = 0;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '\n         ' + JSON.stringify(e) : '')); } };
const num = v => (v == null || v === '') ? null : Number(v);

(async () => {
  console.log('PROVA DO RESULTADO POR ITEM — banco × PNCP\n');

  const ctrl = arg('--controle')
    || (await (await fetch(`${SB}/rest/v1/licitacao_itens?select=numero_controle&resultado_vencedor=not.is.null&limit=1`, { headers: H })).json())[0]?.numero_controle;
  if (!ctrl) { console.log('nenhuma licitação com resultado gravado — rode antes o tools/coleta_resultados.js'); process.exit(1); }

  const lic = (await (await fetch(`${SB}/rest/v1/licitacoes?select=cnpj,ano,sequencial,municipio,uf,objeto&numero_controle=eq.${encodeURIComponent(ctrl)}`, { headers: H })).json())[0];
  console.log(`licitação: ${ctrl}  (${lic.municipio}/${lic.uf})`);
  console.log(`objeto: ${String(lic.objeto || '').slice(0, 90)}…\n`);

  const todos = await (await fetch(`${SB}/rest/v1/licitacao_itens?select=numero_item,descricao,resultado_vencedor,resultado_cnpj,resultado_valor_unit,resultado_quantidade&numero_controle=eq.${encodeURIComponent(ctrl)}&order=numero_item&limit=1000`, { headers: H })).json();
  const com = todos.filter(x => x.resultado_vencedor);
  const sem = todos.filter(x => !x.resultado_vencedor);
  console.log(`no banco: ${todos.length} itens · ${com.length} com resultado · ${sem.length} sem\n`);
  ok('a licitação tem itens gravados', todos.length > 0);

  const base = `https://pncp.gov.br/api/pncp/v1/orgaos/${lic.cnpj}/compras/${lic.ano}/${lic.sequencial}`;
  async function doPncp(nItem) {
    const r = await fetch(`${base}/itens/${encodeURIComponent(nItem)}/resultados`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) return null;
    const t = await r.text();
    if (!t.trim()) return null;
    const j = JSON.parse(t);
    if (!Array.isArray(j) || !j.length) return null;
    return j.filter(x => !x.dataCancelamento).sort((a, b) => (a.ordemClassificacaoSrp || 99) - (b.ordemClassificacaoSrp || 99))[0] || null;
  }

  // ── 3 ITENS COM RESULTADO, CONFERIDOS UM A UM ────────────────────────────────────────────
  console.log('── itens COM resultado, conferidos no PNCP ──');
  for (const it of com.slice(0, 3)) {
    const r = await doPncp(it.numero_item);
    const bate = r
      && String(r.nomeRazaoSocialFornecedor || '') === String(it.resultado_vencedor || '')
      && String(r.niFornecedor || '') === String(it.resultado_cnpj || '')
      && num(r.valorUnitarioHomologado) === num(it.resultado_valor_unit)
      && num(r.quantidadeHomologada) === num(it.resultado_quantidade);
    ok(`item ${it.numero_item} bate com o PNCP`, bate,
      bate ? undefined : { banco: { v: it.resultado_vencedor, cnpj: it.resultado_cnpj, u: it.resultado_valor_unit, q: it.resultado_quantidade },
                           pncp: r && { v: r.nomeRazaoSocialFornecedor, cnpj: r.niFornecedor, u: r.valorUnitarioHomologado, q: r.quantidadeHomologada } });
    if (bate) console.log(`    ok  item ${String(it.numero_item).padStart(3)} · ${String(it.resultado_vencedor).slice(0, 34).padEnd(34)}`
      + ` · R$ ${Number(it.resultado_valor_unit).toFixed(2)} × ${it.resultado_quantidade}`);
  }

  // ── E OS QUE NÃO TÊM: null É "AINDA NÃO SEI" ─────────────────────────────────────────────
  console.log('\n── itens SEM resultado: o PNCP também não tem (null é "ainda não sei") ──');
  if (!sem.length) {
    console.log('    (esta licitação teve resultado em todos os itens)');
  } else {
    for (const it of sem.slice(0, 3)) {
      const r = await doPncp(it.numero_item);
      ok(`item ${it.numero_item} está null aqui porque o PNCP não publicou`, r === null,
        r === null ? undefined : { pncp_tem: r.nomeRazaoSocialFornecedor });
      if (r === null) console.log(`    ok  item ${String(it.numero_item).padStart(3)} · sem resultado nos dois lados`);
    }
  }
  /* O ASSERT QUE IMPEDE O ERRO MAIS CARO: nenhum item pode ter vencedor em branco e valor
     preenchido, nem o contrário. Meia-linha de resultado é pior que linha nenhuma — ela tem
     cara de fato conferido. */
  const meias = todos.filter(x => (!!x.resultado_vencedor) !== (x.resultado_valor_unit != null));
  ok('*** nenhum item tem resultado pela METADE (vencedor sem valor, ou valor sem vencedor) ***',
    meias.length === 0, meias.slice(0, 3));

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
