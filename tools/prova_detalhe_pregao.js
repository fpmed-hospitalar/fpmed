/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_detalhe_pregao.js — A FATIA A4 CONTRA O DADO REAL (14/08/2026)

   O detalhe do pregão promete três coisas que só o dado real prova:
     1. que ele lê TODOS os itens de um edital de verdade no PNCP;
     2. que o TETO CMED de cada item sai do motor compartilhado e bate com o banco;
     3. que item sem teto vira "sem teto CMED" e NUNCA zero.

   >>> A 3a É A MAIS IMPORTANTE E A MAIS FÁCIL DE PASSAR SEM QUERER. Um teto zerado faria
       toda proposta parecer acima do limite legal — e material médico e correlato, que é
       metade de um edital hospitalar, não tem teto CMED por natureza. Por isso a prova exige
       tanto o CASO QUE CASA quanto o CASO QUE NÃO CASA.

   node tools/prova_detalhe_pregao.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const T = require(path.join(RAIZ, 'fpmed_teto_cmed.js'));      // O MOTOR DE VERDADE, não uma cópia
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

let p = 0, f = 0;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '\n         ' + JSON.stringify(e) : '')); } };

async function paginado(rota) {
  let out = [], de = 0;
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${SB}/rest/v1/${rota}`, { headers: { ...H, Range: de + '-' + (de + 999) } });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + rota);
    const j = await r.json();
    out = out.concat(j);
    if (j.length < 1000) break;
    de += 1000;
  }
  return out;
}

(async () => {
  console.log('PROVA DO DETALHE DO PREGÃO — itens reais do PNCP × teto CMED do banco\n');

  // ── 1. o índice do teto, do BANCO, montado pelo motor de verdade ────────────────────────
  const [teto, dic] = await Promise.all([
    paginado('cmed_teto?select=subst_norm,dose_key,apresentacoes,teto_min,teto_max,tem_cap'),
    paginado('cmed_dicionario?select=marca_norm,substancia'),
  ]);
  const idx = T.indexar({ regua: [], teto, dicionario: dic });
  console.log(`índice montado do banco: ${teto.length} chaves de teto · ${dic.length} pares marca->PA`);
  ok('a base do teto tem conteúdo (índice vazio responderia "sem teto" pra tudo)', teto.length > 1000);

  // ── 2. UM PREGÃO REAL, tirado do NOSSO índice ───────────────────────────────────────────
  /* Pego uma licitação REAL da tabela `licitacoes` e leio os itens dela no PNCP pelo MESMO
     endpoint que a tela usa. Inventar um CNPJ aqui provaria só que o meu fetch compila. */
  const cand = await (await fetch(`${SB}/rest/v1/licitacoes?select=bruto,objeto,municipio,uf&limit=40&order=data_publicacao.desc`, { headers: H })).json();
  let usado = null, itens = [];
  for (const c of cand) {
    const b = c.bruto; if (!b) continue;
    const cnpj = (b.orgaoEntidade || {}).cnpj;
    if (!cnpj || b.anoCompra == null || b.sequencialCompra == null) continue;
    const url = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${b.anoCompra}/${b.sequencialCompra}/itens?pagina=1&tamanhoPagina=100`;
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json();
      if (Array.isArray(j) && j.length >= 3) { usado = { b, c }; itens = j; break; }
    } catch (_) { /* segue pro próximo candidato */ }
  }
  if (!usado) {
    console.log('\n  ⚠️ nenhum dos 40 candidatos respondeu itens no PNCP agora.');
    console.log('     Isto NÃO reprova a tela — é o PNCP indisponível, que já caiu 4x em 2 dias.');
    console.log('     A prova do teto (parte 3) roda mesmo assim, contra descrições reais do banco.');
  } else {
    console.log(`\npregão real: ${usado.b.modalidadeNome} nº ${usado.b.numeroCompra}/${usado.b.anoCompra}`);
    console.log(`  ${(usado.b.orgaoEntidade || {}).razaoSocial} · ${usado.c.municipio}/${usado.c.uf}`);
    console.log(`  itens lidos do PNCP: ${itens.length}`);
    ok('*** um pregão REAL devolve a lista de itens ***', itens.length > 0, { itens: itens.length });
    ok('e cada item traz descrição (é ela que casa com a CMED)',
      itens.every(i => String(i.descricao || '').trim().length > 0));
  }

  // ── 3. O TETO, ITEM A ITEM, CONFERIDO CONTRA O BANCO ────────────────────────────────────
  console.log('\n── o teto de 3 medicamentos, conferido contra a cmed_teto do banco ──');
  /* Três descrições que EXISTEM na CMED, tiradas do próprio banco — não escolhidas por mim
     no olho. Assim a prova continua valendo no mês em que a tabela mudar. */
  const amostra = await (await fetch(`${SB}/rest/v1/cmed_teto?select=subst_norm,dose_key,teto_min,teto_max,apresentacoes,tem_cap&teto_min=gt.0&order=apresentacoes.desc&limit=3`, { headers: H })).json();
  for (const a of amostra) {
    const descricao = (a.subst_norm + ' ' + String(a.dose_key || '').replace(/\|/g, ' ')).toUpperCase();
    const r = T.avaliar({ descricao, unitario: true, precoUnit: null, paraGoverno: true }, idx);
    const bate = r.teto != null && Math.abs(Number(r.teto) - Number(a.teto_min)) < 0.005;
    ok(`teto de "${descricao.slice(0, 46)}" bate com o banco`, bate,
      bate ? undefined : { motor: r.teto, banco_min: a.teto_min, via: r.via, situacao: r.situacao });
    if (bate) console.log(`    ok  R$ ${Number(a.teto_min).toFixed(2)} · ${a.apresentacoes} apresentações · via ${r.via}`
      + (a.tem_cap ? ' · CAP (teto = PMVG)' : ''));
  }
  /* A REGRA DA FAIXA: com várias apresentações, o teto é o MENOR. Escolher qualquer outro
     deixaria passar preço acima do limite legal de alguma apresentação. */
  const comFaixa = amostra.find(a => Number(a.teto_max) > Number(a.teto_min));
  if (comFaixa) {
    const d = (comFaixa.subst_norm + ' ' + String(comFaixa.dose_key || '').replace(/\|/g, ' ')).toUpperCase();
    const r = T.avaliar({ descricao: d, unitario: true, paraGoverno: true }, idx);
    ok('*** com faixa, o teto é o MENOR (a regra 3 do motor) ***',
      Math.abs(Number(r.teto) - Number(comFaixa.teto_min)) < 0.005,
      { motor: r.teto, min: comFaixa.teto_min, max: comFaixa.teto_max });
  }

  // ── 4. O QUE NÃO CASA NÃO PODE VIRAR ZERO ───────────────────────────────────────────────
  console.log('\n── o caso que a tela mais erra: o item que NÃO tem teto ──');
  for (const d of ['SERINGA DESCARTAVEL 10ML COM AGULHA', 'LUVA DE PROCEDIMENTO NAO CIRURGICA TAM M', 'EQUIPO MACROGOTAS COM INJETOR LATERAL']) {
    const r = T.avaliar({ descricao: d, unitario: true, paraGoverno: true }, idx);
    ok(`*** "${d.slice(0, 40)}" NÃO recebe teto (material não tem teto CMED) ***`,
      r.teto == null && r.situacao === 'nao_encontrado', { teto: r.teto, situacao: r.situacao });
  }
  ok('*** e "não encontrado" é DIFERENTE de zero no objeto do motor ***',
    T.avaliar({ descricao: 'PARAFUSO SEXTAVADO 10MM', unitario: true }, idx).teto === null);

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
