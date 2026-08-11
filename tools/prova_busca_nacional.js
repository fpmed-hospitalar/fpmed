// ============================================================================================
// prova_busca_nacional.js — PROVA da busca nacional no PNCP: ela acha o que o nosso indice nao
// acha, e os resultados de fato contem a palavra procurada.
//
// ══ A DESCOBERTA QUE ESTE ARQUIVO GUARDA ════════════════════════════════════════════════════
// A ORDENACAO DECIDE TUDO. Copiando `ordenacao=-data` da URL do site, a busca por "albumina"
// devolve 20 resultados dos quais **ZERO contem a palavra** — sao os editais mais NOVOS que
// casaram com qualquer coisa. Eu quase relatei que o endpoint nao servia.
// Na ordenacao PADRAO (relevancia), 20 de 20 contem a palavra.
// Esta prova mede as duas, lado a lado, pra que ninguem "melhore" a busca acrescentando
// ordenacao por data e quebre tudo em silencio.
//
//   node tools/prova_busca_nacional.js [termo]
// ============================================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H_SB = { apikey: SR, Authorization: 'Bearer ' + SR };
// O `User-Agent` e obrigatorio: sem ele o PNCP corta a conexao (ECONNRESET). Isso vale pra
// script em node; a TELA nao precisa, porque navegador manda o dele sozinho.
const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Accept': 'application/json',
};
const url = (q, uf, ord) => 'https://pncp.gov.br/api/search/?q=' + encodeURIComponent(q)
  + '&tipos_documento=edital&pagina=1&tam_pagina=30&status=todos'
  + (uf ? '&ufs=' + uf : '') + (ord ? '&ordenacao=' + ord : '');

const TERMO = process.argv[2] || 'albumina';

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

(async () => {
  console.log(`=== BUSCA NACIONAL NO PNCP — termo "${TERMO}" ===\n`);

  const r = await fetch(url(TERMO, '', ''), { headers: H, signal: AbortSignal.timeout(40000) });
  if (!r.ok) { console.error('HTTP ' + r.status); process.exit(1); }
  const j = await r.json();
  const itens = j.items || [];
  const re = new RegExp(TERMO.slice(0, 7).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const contem = itens.filter(x => re.test((x.description || '') + ' ' + (x.title || '')));

  console.log(`total no Brasil ..... ${Number(j.total).toLocaleString('pt-BR')}`);
  console.log(`trazidos ............ ${itens.length}`);
  console.log(`contem a palavra .... ${contem.length}/${itens.length}`);

  const porUf = {};
  itens.forEach(x => { porUf[x.uf || '?'] = (porUf[x.uf || '?'] || 0) + 1; });
  console.log(`estados ............. ${Object.entries(porUf).sort((a, b) => b[1] - a[1]).map(([u, n]) => u + ' ' + n).join(' · ')}`);

  const mods = {};
  itens.forEach(x => { const m = x.modalidade_licitacao_nome || '?'; mods[m] = (mods[m] || 0) + 1; });
  console.log(`modalidades ......... ${Object.entries(mods).sort((a, b) => b[1] - a[1]).map(([m, n]) => m + ' ' + n).join(' · ')}`);

  const anos = {};
  itens.forEach(x => { const a = String(x.data_publicacao_pncp || '').slice(0, 4); anos[a] = (anos[a] || 0) + 1; });
  console.log(`anos de publicacao .. ${Object.entries(anos).sort().map(([a, n]) => a + ': ' + n).join(' · ')}`);

  // ── O PORTAL DE ORIGEM ────────────────────────────────────────────────────────────────────
  const campos = Object.keys(itens[0] || {});
  const temPortal = campos.filter(c => /portal|sistema|origem|usuario/i.test(c));
  console.log(`campo de PORTAL ..... ${temPortal.length ? temPortal.join(',') : 'NAO EXISTE (dos ' + campos.length + ' campos)'}`);

  // ── O QUE ELE ACRESCENTA AO NOSSO INDICE ─────────────────────────────────────────────────
  const nums = [...new Set(itens.map(x => x.numero_controle_pncp).filter(Boolean))];
  const rn = await fetch(SB + '/rest/v1/licitacoes?select=numero_controle&numero_controle=in.('
    + nums.map(n => '"' + n + '"').join(',') + ')', { headers: H_SB });
  const nossos = rn.ok ? (await rn.json()).length : -1;
  console.log(`ja no nosso indice .. ${nossos} de ${nums.length}`);

  // ── E EM GO? ─────────────────────────────────────────────────────────────────────────────
  await new Promise(s => setTimeout(s, 700));
  const rg = await fetch(url(TERMO, 'GO', ''), { headers: H, signal: AbortSignal.timeout(40000) });
  const jg = await rg.json();
  console.log(`filtrando por GO .... ${Number(jg.total).toLocaleString('pt-BR')} (de ${Number(j.total).toLocaleString('pt-BR')} nacionais)`);

  // ── A ORDENACAO, LADO A LADO ─────────────────────────────────────────────────────────────
  await new Promise(s => setTimeout(s, 700));
  const rd = await fetch(url(TERMO, '', '-data'), { headers: H, signal: AbortSignal.timeout(40000) });
  const jd = await rd.json();
  const contemData = (jd.items || []).filter(x => re.test((x.description || '') + ' ' + (x.title || ''))).length;
  console.log(`\n>>> A ORDENACAO, MEDIDA:`);
  console.log(`    padrao (relevancia) . ${contem.length}/${itens.length} contem a palavra`);
  console.log(`    ordenacao=-data ..... ${contemData}/${(jd.items || []).length} contem a palavra`);

  console.log('\n=== OS 8 PRIMEIROS ===');
  itens.slice(0, 8).forEach(x => console.log(`  [${x.uf}] ${String(x.description || '').slice(0, 44).padEnd(46)} ${String(x.municipio_nome || '').slice(0, 18).padEnd(20)} ${String(x.data_publicacao_pncp || '').slice(0, 10)}`));

  console.log('\n=== ASSERTS ===');
  ok('1. *** o endpoint responde e devolve resultado ***', itens.length > 0, { itens: itens.length });
  ok('2. *** e os resultados CONTEM a palavra procurada (>=80%) ***',
    contem.length >= Math.ceil(itens.length * 0.8), { contem: contem.length, de: itens.length });
  ok('3. *** a ordenacao por DATA quebra isso — e por isso a tela nao a manda ***',
    contemData < contem.length, { relevancia: contem.length, data: contemData });
  ok('4. *** ele acha o que o nosso indice NAO tem ***', nossos < nums.length, { nossos, total: nums.length });
  ok('5. *** o filtro por UF funciona (GO < nacional) ***', jg.total < j.total, { go: jg.total, br: j.total });
  ok('6. *** os campos que a tela mostra vem preenchidos ***',
    ['uf', 'orgao_nome', 'numero_controle_pncp', 'modalidade_licitacao_nome', 'data_publicacao_pncp']
      .every(c => itens.filter(x => x[c]).length === itens.length));
  ok('7. *** e o PORTAL de origem NAO existe (limitacao real, dita na tela) ***', temPortal.length === 0);
  ok('8. CORS liberado, entao a tela chama direto (sem proxy)',
    (r.headers.get('access-control-allow-origin') || '') === '*');

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('ERRO: ' + (e && e.message)); process.exit(1); });
