/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_itens_lote.js — A PROVA MEDIDA DA FATIA A9 (14/08/2026)

   A suite `tests/testa_itens_em_lote.js` prova o CÓDIGO. Esta aqui prova o BANCO — e as duas
   são necessárias por motivos diferentes: código certo sobre tabela vazia responde "não achei"
   com a mesma confiança de código certo sobre tabela cheia, e foi exatamente esse o defeito
   que a A8 mediu e esta fatia veio desfazer.

   O que ela confere, contra o banco de verdade e contra o PNCP:
     1. contagens ANTES/DEPOIS (a linha de partida está escrita aqui: 195 itens, 1 licitação);
     2. os 192 resultados da A7 continuam de pé (o teste de que a varredura não apagou nada);
     3. termos de produto que davam ZERO no objeto agora respondem pelos itens;
     4. 3 itens conferidos campo a campo contra o PNCP.

     node tools/prova_itens_lote.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

/* A LINHA DE PARTIDA, ESCRITA E NÃO LEMBRADA. Medido em 14/08, antes da primeira rodada em
   lote — é contra estes números que o "depois" quer dizer alguma coisa. */
const ANTES = { itens: 195, licitacoes_com_itens: 1, resultados: 192 };

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

async function conta(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  return Number((r.headers.get('content-range') || '').split('/')[1]);
}
async function le(q) { const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H }); return r.json(); }
const norm = v => (v == null || v === '') ? null : Number(v);

(async () => {
  console.log('=== PROVA MEDIDA — FATIA A9 (itens em lote) ===\n');

  // ── 1. ANTES x DEPOIS ─────────────────────────────────────────────────────────────────────
  const itens = await conta('licitacao_itens?select=id');
  const carimbadas = await conta('licitacoes?select=id&itens_lidos_em=not.is.null');
  const comItem = await conta('licitacoes?select=id&itens_qtd=gt.0');
  const total = await conta('licitacoes?select=id');
  const resultados = await conta('licitacao_itens?select=id&resultado_vencedor=not.is.null');
  console.log(`  itens .................. ${ANTES.itens} -> ${itens}`);
  console.log(`  licitações com itens ... ${ANTES.licitacoes_com_itens} -> ${comItem}  (carimbadas: ${carimbadas} de ${total})`);
  console.log(`  resultados por item .... ${ANTES.resultados} -> ${resultados}\n`);

  ok(n + '. *** a tabela de itens cresceu de verdade (não é a mesma licitação relida) ***',
    itens > ANTES.itens * 5 && comItem > 50, { itens, comItem }); n++;
  /* ESTE É O ASSERT QUE MAIS IMPORTA DESTA PROVA. Uma varredura de itens que zera resultado seria
     o defeito mais caro possível aqui: silencioso, e com cara de trabalho feito. */
  ok(n + '. *** e os 192 resultados conferidos na A7 continuam TODOS de pé ***',
    resultados >= ANTES.resultados, { antes: ANTES.resultados, agora: resultados }); n++;
  ok(n + '. a licitação da A7 continua com 195 itens (o upsert reescreve, não duplica)',
    (await conta('licitacao_itens?select=id&numero_controle=eq.'
      + encodeURIComponent('01640429000106-1-000117/2026'))) === 195); n++;

  // ── 2. O ACHADO DA A8, DESFEITO ───────────────────────────────────────────────────────────
  console.log('  termo        no OBJETO   nos ITENS   licitações');
  const termos = ['albumina', 'dipirona', 'soro', 'seringa', 'luva', 'caneta'];
  let viraram = 0;
  for (const t of termos) {
    const nObj = await conta('licitacoes?select=id&busca=wfts(pt_sem_acento).' + encodeURIComponent(t));
    const nIt = await conta('licitacao_itens?select=id&busca=wfts(pt_sem_acento).' + encodeURIComponent(t));
    const linhas = await le('licitacao_itens?select=numero_controle&busca=wfts(pt_sem_acento).'
      + encodeURIComponent(t) + '&limit=400');
    const lics = new Set(linhas.map(x => x.numero_controle)).size;
    console.log(`  ${t.padEnd(12)} ${String(nObj).padStart(7)}   ${String(nIt).padStart(9)}   ${String(lics).padStart(10)}`);
    if (nObj === 0 && nIt > 0) viraram++;
  }
  console.log('');
  /* "0 no objeto e N no item" é o achado da A8 medido do outro lado: a busca por produto passou a
     responder onde antes ela dizia "não achei" com toda a confiança do mundo. */
  ok(n + '. *** termos que davam ZERO no objeto agora respondem pelos itens ***',
    viraram >= 2, { viraram }); n++;

  // ── 3. TRÊS ITENS CONFERIDOS CONTRA O PNCP ────────────────────────────────────────────────
  /* Conferir contra o próprio banco provaria só que ele é consistente consigo mesmo. A pergunta é
     outra: o que está gravado aqui é o que o PNCP publicou? Então a fonte da conferência é o
     PNCP, campo a campo, em licitações que a rodada em lote trouxe (nunca a da A7). */
  const amostra = await le('licitacao_itens?select=numero_controle,numero_item,descricao,quantidade,'
    + 'unidade,valor_unitario_ref,licitacao_id&numero_controle=neq.'
    + encodeURIComponent('01640429000106-1-000117/2026') + '&order=id.desc&limit=60');
  const escolhidos = [];
  const vistos = new Set();
  for (const it of amostra) {
    if (vistos.has(it.numero_controle)) continue;
    vistos.add(it.numero_controle); escolhidos.push(it);
    if (escolhidos.length === 3) break;
  }
  for (const it of escolhidos) {
    const lic = (await le(`licitacoes?select=cnpj,ano,sequencial&numero_controle=eq.`
      + encodeURIComponent(it.numero_controle)))[0];
    if (!lic) { ok(n + '. item ' + it.numero_controle + ' — licitação sumiu do índice', false); n++; continue; }
    const url = `https://pncp.gov.br/api/pncp/v1/orgaos/${lic.cnpj}/compras/${lic.ano}/${lic.sequencial}`
      + `/itens/${encodeURIComponent(it.numero_item)}`;
    let vivo = null;
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      if (r.ok) { const t = await r.text(); vivo = t.trim() ? JSON.parse(t) : null; }
    } catch (e) { /* o PNCP fora do ar não é defeito nosso — o assert diz isso */ }
    if (!vivo) { console.log(`  ~ ${it.numero_controle} item ${it.numero_item}: o PNCP não respondeu agora (não conta como falha)`); continue; }
    const bateDesc = String(vivo.descricao || '').trim() === String(it.descricao || '').trim();
    const bateQtd = norm(vivo.quantidade) === norm(it.quantidade);
    const bateUnid = String(vivo.unidadeMedida || '') === String(it.unidade || '');
    const bateVal = norm(vivo.valorUnitarioEstimado) === norm(it.valor_unitario_ref);
    console.log(`  ${it.numero_controle} item ${it.numero_item}: `
      + `descrição ${bateDesc ? 'ok' : 'DIVERGE'} · qtd ${bateQtd ? 'ok' : 'DIVERGE'} · `
      + `unidade ${bateUnid ? 'ok' : 'DIVERGE'} · valor ${bateVal ? 'ok' : 'DIVERGE'}`);
    ok(n + `. item ${it.numero_item} de ${it.numero_controle} bate com o PNCP campo a campo`,
      bateDesc && bateQtd && bateUnid && bateVal,
      { banco: { d: it.descricao, q: it.quantidade, u: it.unidade, v: it.valor_unitario_ref },
        pncp: { d: vivo.descricao, q: vivo.quantidade, u: vivo.unidadeMedida, v: vivo.valorUnitarioEstimado } });
    n++;
  }

  // ── 4. A COBERTURA É HONESTA ──────────────────────────────────────────────────────────────
  /* O selo da tela lê exatamente estes dois números. Enquanto o primeiro for menor que o
     segundo, ele DIZ que a carga ainda anda — e é isso que impede "não achei" de passar por
     "ninguém está comprando". */
  console.log(`\n  cobertura do selo: itens carregados de ${carimbadas} de ${total} licitações`);
  ok(n + '. a cobertura do selo é contável e menor ou igual ao total',
    carimbadas > 0 && carimbadas <= total, { carimbadas, total }); n++;

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
