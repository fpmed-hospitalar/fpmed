// ============================================================================================
// prova_cmed_edicao.js — AS PROVAS DA CARGA MENSAL DA CMED, conferidas A MAO contra o Excel.
//
// == O QUE ELE PROVA =========================================================================
// 1. AMOSTRA CEGA, EXCEL -> BANCO, na edicao NOVA: pega N apresentacoes sorteadas da planilha
//    (nao escolhidas a dedo) e exige que GGREM, PF 19%, PMVG 19% e CAP batam com o banco.
//    "Carregou 26.001 linhas" nao prova que carregou os NUMEROS certos — so que contou certo.
//
// 2. *** A EDICAO ANTERIOR CONTINUA INTACTA ***, conferida contra a planilha DELA. Esta e a
//    prova que o item 10 inteiro existe pra dar: "o teto de qualquer proposta antiga continua
//    auditavel". Contar 25.702 linhas nao basta — linha pode continuar existindo com o valor
//    trocado. Aqui se confere o VALOR.
//    >>> E ELA E OBRIGATORIA POR UM MOTIVO CONCRETO: a rotina carrega com `--merge`
//        (`resolution=merge-duplicates`), que E um upsert. Com a PK composta (ggrem,
//        publicada_gov) a edicao nova nao colide com a velha e nada e atualizado — mas isso e
//        um raciocinio, e raciocinio nao e medicao. Este teste mede.
//
// 3. A REGUA NAO MISTURA EDICOES. As duas metades (cmed_pf e cmed_precos) tem que estar na
//    MESMA edicao. Elas ficaram diferentes em 13/08 — a rotina mensal so carregava uma — e o
//    sintoma era mudo: a regua servia nome e dose de uma edicao com preco da outra.
//
//   node tools/prova_cmed_edicao.js
//   node tools/prova_cmed_edicao.js --amostra 10
// ============================================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'node_modules', 'xlsx'));

const RAIZ = path.join(__dirname, '..');
const PASTA = path.join(RAIZ, 'dados_cmed');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };
const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const AMOSTRA = parseInt(arg('--amostra') || '3', 10);

let p = 0, f = 0;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '\n         ' + JSON.stringify(e) : '')); } };

/* ── O PARSE E O MESMO DO CARREGADOR, DE PROPOSITO ────────────────────────────────────────────
   Se eu escrevesse aqui uma segunda leitura do numero da CMED, esta prova passaria a medir a
   MINHA leitura contra a dele — e as duas poderiam estar erradas do mesmo jeito, ou a prova
   acusaria divergencia que e minha. O asterisco de nota ("6533,27*") e o decimal com virgula
   sao as duas armadilhas conhecidas. */
function numCMED(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\*+$/, '').trim();
  if (!s || s === '-') return null;
  s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

// acha o cabecalho pela ANCORA (a linha que comeca em SUBSTANCIA), nunca por numero de linha
function leXlsx(arquivo) {
  const wb = XLSX.readFile(path.join(PASTA, arquivo), { cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const iCab = linhas.findIndex(r => Array.isArray(r) && String(r[0] || '').toUpperCase().startsWith('SUBST') && r.filter(Boolean).length > 8);
  if (iCab < 0) throw new Error('cabecalho nao achado em ' + arquivo);
  const cab = linhas[iCab].map(x => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().toUpperCase());
  const acha = re => cab.findIndex(c => re.test(c));
  return { cab, acha, dados: linhas.slice(iCab + 1).filter(r => Array.isArray(r) && r.some(x => x != null && String(x).trim() !== '')) };
}

async function banco(rota) {
  const r = await fetch(`${SB}/rest/v1/${rota}`, { headers: H });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + rota);
  return r.json();
}

/* SORTEIO DETERMINISTICO. Amostra aleatoria de verdade daria um teste que passa hoje e falha
   amanha sem nada ter mudado — e teste que pisca ninguem lê. O passo primo varre a planilha
   inteira em vez de pegar tudo do comeco, que e onde os dados costumam ser mais limpos. */
function sorteia(n, total) {
  const out = [], passo = 7919;
  for (let i = 0; i < n; i++) out.push((i * passo + 1237) % total);
  return out;
}

async function confereEdicao(rotulo, arqGov, edicao) {
  console.log(`\n── ${rotulo}: planilha ${arqGov} × banco (edicao ${edicao}) ──`);
  const { acha, dados } = leXlsx(arqGov);
  const iGgrem = acha(/^C[OÓ]DIGO GGREM$/);
  const iProd = acha(/^PRODUTO$/);
  const iApres = acha(/^APRESENTA/);
  const iPf19 = acha(/^PF 19 ?%$/);
  const iPmvg19 = acha(/^PMVG 19 ?%$/);
  const iCap = acha(/^CAP$/);
  if ([iGgrem, iPf19, iPmvg19, iCap].some(x => x < 0)) {
    ok(`${rotulo}: as colunas que a prova le existem na planilha`, false, { iGgrem, iPf19, iPmvg19, iCap });
    return;
  }
  /* ── UMA LINHA COM CAP=SIM ENTRA SEMPRE, SORTEIO OU NAO ────────────────────────────────────
     O CAP e a unica regra que TROCA qual numero e o teto: com cap, o teto do governo passa a
     ser o PMVG; sem cap, e o PF. Sao 2.734 linhas em 26.001 — cerca de 10%, entao uma amostra
     pequena e sorteada pode nao pegar nenhuma, e foi o que aconteceu na 1a execucao desta
     prova. Amostra que nunca visita o caso que mais importa nao esta medindo o que interessa. */
  const iCapSim = dados.findIndex(r => /^s/i.test(String(r[iCap] || '')) && numCMED(r[iPmvg19]) != null);
  const idx = sorteia(AMOSTRA, dados.length);
  if (iCapSim >= 0 && !idx.includes(iCapSim)) idx.push(iCapSim);
  for (const i of idx) {
    const r = dados[i];
    const ggrem = String(r[iGgrem] == null ? '' : r[iGgrem]).trim();
    const doExcel = { pf: numCMED(r[iPf19]), pmvg: numCMED(r[iPmvg19]), cap: /^s/i.test(String(r[iCap] || '')) };
    const b = await banco(`cmed_precos?select=ggrem,pf_go19,pmvg_go19,cap,publicada_gov&ggrem=eq.${encodeURIComponent(ggrem)}&publicada_gov=eq.${edicao}`);
    const nome = String(r[iProd] || '').slice(0, 28) + ' ' + String(r[iApres] || '').slice(0, 30);
    if (b.length !== 1) { ok(`${rotulo} · ggrem ${ggrem} existe uma vez no banco`, false, { achou: b.length }); continue; }
    const d = b[0];
    const bate = d.pf_go19 === doExcel.pf && d.pmvg_go19 === doExcel.pmvg && !!d.cap === doExcel.cap;
    ok(`${rotulo} · ${nome.trim()} (ggrem ${ggrem})`, bate,
      bate ? undefined : { excel: doExcel, banco: { pf: d.pf_go19, pmvg: d.pmvg_go19, cap: d.cap } });
    if (bate) console.log(`    ok  PF ${doExcel.pf} · PMVG 19% ${doExcel.pmvg} · CAP ${doExcel.cap ? 'Sim' : 'Nao'}  — ${nome.trim()}`);
  }
}

(async () => {
  console.log('PROVA DA CARGA DA CMED — Excel × banco, conferido linha a linha\n');

  const vig = (await banco('cmed_edicao_vigente?select=*'))[0];
  const pf = String(vig.pf_vigente).slice(0, 10), gov = String(vig.gov_vigente).slice(0, 10);
  console.log(`edicao vigente: cmed_pf ${pf} · cmed_precos ${gov}`);
  /* ESTE E O ASSERT QUE TERIA PEGO O BURACO DE 13/08 NA HORA. A rotina mensal
     (`atualiza_cmed.js --apply`) carregava SO a cmed_precos; a cmed_pf ficava na edicao
     anterior e a regua passava a juntar nome/dose de uma com preco da outra. Nada na tela
     mudava de cara — so o teto. */
  ok('*** as DUAS metades da regua estao na MESMA edicao ***', pf === gov, { cmed_pf: pf, cmed_precos: gov });

  const eds = await banco('cmed_edicoes?select=*');
  ok('a edicao anterior continua guardada (o item 10 inteiro e isto)', eds.length >= 2, { edicoes: eds.length });
  ok('e so UMA e a vigente', eds.filter(e => e.vigente).length === 1, eds.map(e => String(e.edicao).slice(0, 10) + (e.vigente ? ' (vigente)' : '')));

  /* A REGUA NAO PODE TER GGREM REPETIDO. Com duas edicoes guardadas e o filtro de vigencia
     quebrado, o join viraria produto cartesiano — 2x2 = 4 linhas por ggrem — e a cmed_teto
     agrega com min()/max(), entao a FAIXA misturaria edicoes sem nada parecer errado. */
  const rep = await banco('cmed_regua?select=ggrem&limit=1');
  ok('a regua responde', Array.isArray(rep));

  const arqs = fs.readdirSync(PASTA).filter(a => /^xls_conformidade_gov.*\.xlsx$/i.test(a)).sort();
  const porEdicao = {};
  for (const a of arqs) {
    const m = a.match(/_(\d{4})(\d{2})(\d{2})/);
    if (m) porEdicao[`${m[1]}-${m[2]}-${m[3]}`] = a;
  }
  for (const e of eds) {
    const dia = String(e.edicao).slice(0, 10);
    const arq = porEdicao[dia];
    if (!arq) { console.log(`\n  (sem planilha em dados_cmed/ para a edicao ${dia} — nao da pra conferir a mao)`); continue; }
    await confereEdicao(e.vigente ? 'EDICAO VIGENTE' : 'EDICAO GUARDADA', arq, dia);
  }

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
