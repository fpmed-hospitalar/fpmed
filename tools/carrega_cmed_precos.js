// ═══════════════════════════════════════════════════════════════════════════════
// CARGA DA GRADE DE PREÇOS DA CMED -> tabela cmed_precos   (item 1B, 05/08/2026)
//
// Uso:  node tools/carrega_cmed_precos.js              -> PREVIEW (não grava nada)
//       node tools/carrega_cmed_precos.js --apply      -> INSERT (só em tabela vazia)
//       node tools/carrega_cmed_precos.js --apply --merge  -> upsert por ggrem (ATUALIZA linha
//                                                            existente; exige OK do Lemuel)
//       node tools/carrega_cmed_precos.js --site x.xlsx --gov y.xlsx [--apply]
//
// AS DUAS LISTAS DA ANVISA/CMED (mesma edição, 74 colunas, MESMA base de 25.702 GGREM):
//   xls_conformidade_site_*.xlsx -> colunas 13-38 = PF por alíquota, 39-64 = PMC por alíquota
//   xls_conformidade_gov_*.xlsx  -> colunas 13-38 = PF por alíquota, 39-64 = PMVG por alíquota
// O PF aparece nas duas e é conferido: divergência entre elas é ERRO e aborta a carga.
//
// ARMADILHAS DE PARSE (ditadas pelo Lemuel em 05/08, não descobertas do zero):
//   1. valor vem com ASTERISCO no fim ("6533,27*") — marcador de nota da CMED, tirar antes
//      de converter. O asterisco marca apresentação isenta de ICMS (coluna "ICMS 0%").
//   2. decimal com VÍRGULA e milhar com PONTO ("1.234,56").
//   3. "-", " - " e vazio significam "não se aplica", não zero.
//   4. CAP = "Sim" -> desconto obrigatório pro governo: nessas o teto é o PMVG, não o PF.
//
// NÃO É DESTRUTIVO: cria linha nova numa tabela nova. Sem --merge, recusa gravar se a
// tabela já tiver linhas — carga repetida é decisão do Lemuel, não do script.
// DDL: ddl/cmed_precos.sql
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'node_modules', 'xlsx'));

const APPLY = process.argv.includes('--apply');
const MERGE = process.argv.includes('--merge');
const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };

// ── parse dos números da CMED ────────────────────────────────────────────────
// Exportado para a suíte: estas 4 regras são o coração do loader.
function numCMED(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;   // célula já numérica: NÃO mexer nos pontos
  let s = String(v).trim();
  if (!s || s === '-' || /^-+$/.test(s)) return null;
  s = s.replace(/\*+\s*$/, '').trim();          // (1) tira o asterisco de nota da CMED
  if (!s) return null;
  s = s.replace(/\./g, '').replace(',', '.');   // (2) 1.234,56 -> 1234.56
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : null;
}
// "Sim"/"Não" da planilha -> boolean. Vazio e "-" viram null (não sabido != não).
function simNao(v) {
  const s = String(v == null ? '' : v).trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (s === 'SIM') return true;
  if (s === 'NAO') return false;
  return null;
}
const txt = (v, n) => { const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return s && s !== '-' ? s.slice(0, n) : null; };
// "PF 17,5 % ALC" -> "17,5 ALC" | "PF 0%" -> "0" | "PMVG Sem Impostos" -> "SEM_IMPOSTO"
function chaveAliquota(header, prefixo) {
  let s = String(header || '').replace(/\s+/g, ' ').trim();
  if (!s.toUpperCase().startsWith(prefixo.toUpperCase())) return null;
  s = s.slice(prefixo.length).trim();
  if (/^sem\s+impostos?$/i.test(s)) return 'SEM_IMPOSTO';
  s = s.replace(/\s*%\s*/, ' ').replace(/\s+/g, ' ').trim();   // "17,5 % ALC" -> "17,5 ALC"
  return s || null;
}

module.exports = { numCMED, simNao, chaveAliquota };
if (require.main !== module) return;

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
if (!SR) { console.error('service_role nao encontrada no segredos.local.txt'); process.exit(1); }
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

function achar(padrao, explicito) {
  if (explicito) { if (!fs.existsSync(explicito)) { console.error('nao existe: ' + explicito); process.exit(1); } return explicito; }
  const achados = fs.readdirSync('C:/fpmed').filter(f => padrao.test(f))
    .map(f => ({ f, t: fs.statSync('C:/fpmed/' + f).mtimeMs })).sort((a, b) => b.t - a.t);
  if (!achados.length) { console.error('nenhum arquivo casando ' + padrao + ' em C:\\fpmed'); process.exit(1); }
  return 'C:/fpmed/' + achados[0].f;
}

// Lê uma das duas listas e devolve {publicada, head, linhas[], prefixoVar}
function leLista(arq, rotulo) {
  const t0 = Date.now();
  const wb = XLSX.readFile(arq);
  const sh = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1 });
  // "Publicada em dd/mm/aaaa" no cabeçalho institucional (linha varia entre as listas)
  const topo = rows.slice(0, 60).map(r => String((r && r[0]) || '')).join(' ');
  const pm = topo.match(/Publicada em (\d{2})\/(\d{2})\/(\d{4})/);
  if (!pm) { console.error(`[${rotulo}] nao achei "Publicada em dd/mm/aaaa" no topo`); process.exit(1); }
  const publicada = `${pm[3]}-${pm[2]}-${pm[1]}`;
  // header = a linha com muitas células que começa em SUBSTÂNCIA (mesma âncora do carrega_cmed_pf)
  let hi = -1;
  rows.forEach((r, i) => { if (hi < 0 && Array.isArray(r) && r.filter(Boolean).length > 8 && r.some(c => /^SUBST/i.test(String(c)))) hi = i; });
  if (hi < 0) { console.error(`[${rotulo}] header nao encontrado`); process.exit(1); }
  const head = rows[hi].map(c => String(c || '').replace(/\s+/g, ' ').trim());
  // a variável da lista está na coluna 39: "PMC Sem Impostos" ou "PMVG Sem Impostos"
  const prefixoVar = /^PMVG/i.test(head[39] || '') ? 'PMVG' : /^PMC/i.test(head[39] || '') ? 'PMC' : null;
  if (!prefixoVar) { console.error(`[${rotulo}] coluna 39 nao e PMC nem PMVG: "${head[39]}"`); process.exit(1); }
  console.log(`[${rotulo}] ${path.basename(arq)} | publicada ${publicada} | header linha ${hi + 1} | ${head.length} col | variavel ${prefixoVar} | ${rows.length - hi - 1} linhas cruas | ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { publicada, head, hi, rows, prefixoVar };
}

// mapa {indiceColuna -> chaveAliquota} para um prefixo ("PF" / "PMC" / "PMVG")
function mapaAliquotas(head, prefixo) {
  const m = [];
  head.forEach((h, i) => {
    // "PMC 19 %" começa com "PM"; exigir a palavra inteira pra "PF" não casar dentro de nada
    const re = new RegExp('^' + prefixo + '\\b', 'i');
    if (re.test(String(h || '').trim())) { const k = chaveAliquota(h, prefixo); if (k) m.push({ i, k }); }
  });
  return m;
}

(async () => {
  const arqSite = achar(/^xls_conformidade_site.*\.xlsx$/i, arg('--site'));
  const arqGov = achar(/^xls_conformidade_gov.*\.xlsx$/i, arg('--gov'));
  console.log(APPLY ? (MERGE ? '[APPLY + MERGE — atualiza linhas existentes]' : '[APPLY]') : '[PREVIEW — nada e gravado]');

  const site = leLista(arqSite, 'site');
  const gov = leLista(arqGov, 'gov ');
  if (site.prefixoVar !== 'PMC' || gov.prefixoVar !== 'PMVG') {
    console.error(`ERRO: esperava site=PMC e gov=PMVG, veio site=${site.prefixoVar} gov=${gov.prefixoVar}. Arquivos trocados?`);
    process.exit(1);
  }
  if (site.publicada !== gov.publicada) {
    console.log(`AVISO: edicoes diferentes — site ${site.publicada} x gov ${gov.publicada}. Segue, mas as duas datas ficam gravadas.`);
  }

  const iG = site.head.indexOf('CÓDIGO GGREM');
  const iGgov = gov.head.indexOf('CÓDIGO GGREM');
  if (iG < 0 || iGgov < 0) { console.error('coluna CÓDIGO GGREM nao encontrada'); process.exit(1); }

  const mapPFsite = mapaAliquotas(site.head, 'PF');
  const mapPMC = mapaAliquotas(site.head, 'PMC');
  const mapPFgov = mapaAliquotas(gov.head, 'PF');
  const mapPMVG = mapaAliquotas(gov.head, 'PMVG');
  console.log(`aliquotas: PF ${mapPFsite.length} | PMC ${mapPMC.length} | PMVG ${mapPMVG.length}`);
  if (!mapPMVG.some(x => x.k === '19')) { console.error('ERRO: nao achei a coluna "PMVG 19 %" (aliquota de GOIAS)'); process.exit(1); }

  // ── indexa a lista do governo por GGREM (é a que traz o PMVG) ──────────────
  const porGgrem = new Map();
  for (let i = gov.hi + 1; i < gov.rows.length; i++) {
    const r = gov.rows[i]; if (!r) continue;
    const g = txt(r[iGgov], 20); if (!g) continue;
    porGgrem.set(g, r);
  }
  console.log(`gov indexado por GGREM: ${porGgrem.size} linhas`);

  const grade = (r, mapa) => { const o = {}; for (const { i, k } of mapa) { const n = numCMED(r[i]); if (n != null) o[k] = n; } return Object.keys(o).length ? o : null; };
  const iCNPJ = site.head.indexOf('CNPJ'), iReg = site.head.indexOf('REGIME DE PREÇO');
  const iRH = site.head.indexOf('RESTRIÇÃO HOSPITALAR'), iCAP = site.head.indexOf('CAP');
  const iCFZ = site.head.indexOf('CONFAZ 87'), iICMS0 = site.head.indexOf('ICMS 0%');
  const iAR = site.head.findIndex(h => /^AN.LISE RECURSAL/i.test(h));
  const iPC = site.head.findIndex(h => /^LISTA DE CONCESS/i.test(h));
  const iCom = site.head.findIndex(h => /^COMERCIALIZA/i.test(h));
  const iTarja = site.head.indexOf('TARJA');
  const iDest = site.head.findIndex(h => /^DESTINA/i.test(h));

  const regs = [];
  let semGov = 0, divergPF = 0, comPMVG = 0, comCAP = 0;
  const exemplosDiverg = [];
  for (let i = site.hi + 1; i < site.rows.length; i++) {
    const r = site.rows[i]; if (!r) continue;
    const g = txt(r[iG], 20); if (!g) continue;
    const rg = porGgrem.get(g) || null;
    if (!rg) semGov++;

    const pfSite = grade(r, mapPFsite);
    const pfGov = rg ? grade(rg, mapPFgov) : null;
    // conferência: o PF aparece nas duas listas. Divergência = arquivos de edições diferentes.
    if (pfSite && pfGov && pfSite['19'] != null && pfGov['19'] != null && Math.abs(pfSite['19'] - pfGov['19']) > 0.005) {
      divergPF++; if (exemplosDiverg.length < 5) exemplosDiverg.push(`${g}: site ${pfSite['19']} x gov ${pfGov['19']}`);
    }
    const pmc = grade(r, mapPMC);
    const pmvg = rg ? grade(rg, mapPMVG) : null;
    if (pmvg && pmvg['19'] != null) comPMVG++;
    const cap = simNao(r[iCAP]);
    if (cap) comCAP++;

    regs.push({
      ggrem: g,
      cnpj: iCNPJ >= 0 ? txt(r[iCNPJ], 20) : null,
      regime_preco: iReg >= 0 ? txt(r[iReg], 20) : null,
      pf_go19: pfSite ? (pfSite['19'] ?? null) : null,
      pmc_go19: pmc ? (pmc['19'] ?? null) : null,
      pmvg_go19: pmvg ? (pmvg['19'] ?? null) : null,
      pf_0: pfSite ? (pfSite['0'] ?? null) : null,
      pmc_0: pmc ? (pmc['0'] ?? null) : null,
      pmvg_0: pmvg ? (pmvg['0'] ?? null) : null,
      pf_sem_imposto: pfSite ? (pfSite.SEM_IMPOSTO ?? null) : null,
      pmc_sem_imposto: pmc ? (pmc.SEM_IMPOSTO ?? null) : null,
      pmvg_sem_imposto: pmvg ? (pmvg.SEM_IMPOSTO ?? null) : null,
      pf_aliq: pfSite, pmc_aliq: pmc, pmvg_aliq: pmvg,
      cap,
      confaz87: iCFZ >= 0 ? simNao(r[iCFZ]) : null,
      icms0: iICMS0 >= 0 ? simNao(r[iICMS0]) : null,
      restricao_hosp: iRH >= 0 ? simNao(r[iRH]) : null,
      analise_recursal: iAR >= 0 ? txt(r[iAR], 120) : null,
      lista_pis_cofins: iPC >= 0 ? txt(r[iPC], 40) : null,
      comercializacao: iCom >= 0 ? txt(r[iCom], 10) : null,
      tarja: iTarja >= 0 ? txt(r[iTarja], 40) : null,
      destinacao: iDest >= 0 ? txt(r[iDest], 60) : null,
      publicada_site: site.publicada,
      publicada_gov: gov.publicada,
    });
  }

  console.log('\n── PREVIEW ────────────────────────────────────────────');
  console.log(`linhas montadas ............ ${regs.length}`);
  console.log(`com PMVG 19% (GO) .......... ${comPMVG} (${(comPMVG / regs.length * 100).toFixed(1)}%)`);
  console.log(`sem par na lista do governo  ${semGov}`);
  console.log(`CAP = Sim (teto vira PMVG) . ${comCAP}`);
  console.log(`com PF 19% ................. ${regs.filter(r => r.pf_go19 != null).length}`);
  console.log(`com PMC 19% ................ ${regs.filter(r => r.pmc_go19 != null).length}`);
  console.log(`isentos de ICMS (ICMS 0%) .. ${regs.filter(r => r.icms0).length}`);
  console.log(`restricao hospitalar ....... ${regs.filter(r => r.restricao_hosp).length}`);
  console.log(`sob analise recursal ....... ${regs.filter(r => r.analise_recursal && !/^-$/.test(r.analise_recursal)).length}`);
  if (divergPF) {
    console.error(`\n!! ABORTA: PF 19% diverge entre as duas listas em ${divergPF} linhas — sao edicoes diferentes.`);
    exemplosDiverg.forEach(e => console.error('   ' + e));
    process.exit(1);
  }
  console.log('conferencia do PF nas 2 listas: OK (zero divergencia)');
  const am = regs.find(r => r.pmvg_go19 && r.cap) || regs.find(r => r.pmvg_go19) || regs[0];
  console.log('\namostra: ' + JSON.stringify({ ggrem: am.ggrem, pf_go19: am.pf_go19, pmc_go19: am.pmc_go19, pmvg_go19: am.pmvg_go19, cap: am.cap, aliq_pmvg: am.pmvg_aliq }, null, 1).slice(0, 700));

  // ── quantas linhas ja existem? ────────────────────────────────────────────
  const jaTem = await fetch(`${SB}/rest/v1/cmed_precos?select=ggrem`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (jaTem.status === 404 || jaTem.status === 400) { console.error('\ntabela cmed_precos nao existe — rodar antes: node tools/roda_sql.js --arquivo ddl/cmed_precos.sql'); process.exit(1); }
  const nExist = parseInt((jaTem.headers.get('content-range') || '/0').split('/')[1]) || 0;
  console.log(`\nlinhas ja na cmed_precos: ${nExist}`);

  if (!APPLY) { console.log('\nPreview OK. Gravar com --apply.'); return; }
  if (nExist > 0 && !MERGE) {
    console.error('\nRECUSADO: a tabela ja tem linha. Regravar por cima e UPDATE de dado — exige OK do Lemuel.');
    console.error('Se ele autorizar: node tools/carrega_cmed_precos.js --apply --merge');
    process.exit(1);
  }

  let n = 0;
  const prefer = MERGE ? 'return=minimal,resolution=merge-duplicates' : 'return=minimal';
  for (let i = 0; i < regs.length; i += 500) {
    const lote = regs.slice(i, i + 500);
    const r = await fetch(`${SB}/rest/v1/cmed_precos`, { method: 'POST', headers: { ...H, Prefer: prefer }, body: JSON.stringify(lote) });
    if (!r.ok) { console.error('ERRO no lote ' + i + ': ' + r.status + ' ' + (await r.text()).slice(0, 200)); process.exit(1); }
    n += lote.length;
    if (i % 5000 === 0) console.log('  gravadas ' + n + '/' + regs.length + '…');
  }
  const tot = await fetch(`${SB}/rest/v1/cmed_precos?select=ggrem`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  console.log(`gravadas ${n} | total na tabela: ${(tot.headers.get('content-range') || '').split('/')[1]}`);
})();
