// ═══════════════════════════════════════════════════════════════════════════════
// CARGA MENSAL DA REFERENCIA CMED -> tabela cmed_pf (PF GO 19% + PF 0%)
//
// Uso:  node tools/carrega_cmed_pf.js            -> PREVIEW (xlsx mais recente xls_conformidade*)
//       node tools/carrega_cmed_pf.js --apply    -> insere a edicao nova e REMOVE a edicao anterior
//       node tools/carrega_cmed_pf.js caminho.xlsx [--apply]
//
// Fonte: planilha "xls_conformidade_site_*.xlsx" da ANVISA/CMED (publicada todo mes em
// gov.br/anvisa -> medicamentos -> cmed -> precos). Colunas usadas: SUBSTANCIA, PRODUTO,
// APRESENTACAO, PF 0%, PF 19% (aliquota modal de GOIAS, 19% desde 01/04/2024 — Lei 22.460/2023),
// RESTRICAO HOSPITALAR. PMC fica fora de proposito (regua do B2B e o PF).
// dose_key = doseKey REAL da tela (extraido do sistema_final) aplicado na APRESENTACAO, com
// normalizacoes de combo: "(400 + 57) MG" -> "400+57MG" e "MG/1ML" -> "MG/ML".
// A troca de edicao (delete da anterior) faz parte do desenho aprovado 22/07: cmed_pf guarda
// SO a edicao vigente; reverter = rodar de novo com a planilha antiga.
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'node_modules', 'xlsx'));

const APPLY = process.argv.includes('--apply');
const argPath = process.argv.slice(2).find(a => !a.startsWith('--'));

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
if (!SR) { console.error('service_role nao encontrada'); process.exit(1); }
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

// doseKey REAL do sistema_final (extraido por ancora — nao recopia)
const src = fs.readFileSync('C:/fpmed/fpmed_sistema_final.html', 'utf8');
const L = src.split(/\r?\n/);
const block = (a, b) => { const s = L.findIndex(x => x.includes(a)); let e = -1; for (let i = s + 1; i < L.length; i++) { if (L[i].includes(b)) { e = i; break; } } if (s < 0 || e < 0) throw new Error('ancora ' + a); return L.slice(s, e).join('\n'); };
const { doseKey } = (new Function(block('function _gmNorm(s)', 'var _GM_SAL_RE') + '\n' + block('function normPA', 'function labelExibicao') + '\nreturn { doseKey };'))();

// normalizacoes de dose da APRESENTACAO CMED antes do doseKey (exportadas p/ a suite)
function cmedApresNorm(apres) {
  let s = String(apres || '');
  s = s.replace(/\(\s*([\d.,]+(?:\s*\+\s*[\d.,]+)+)\s*\)\s*(MG|MCG|G|UI)/gi, (m, nums, un) => nums.replace(/\s+/g, '') + un);  // (400 + 57) MG -> 400+57MG
  s = s.replace(/(MG|MCG|G|UI)\s*\/\s*1\s*ML\b/gi, '$1/ML');                                                                    // MG/1ML -> MG/ML
  return s;
}
function cmedDoseKey(apres) { return doseKey(cmedApresNorm(apres)); }
// QTD DA APRESENTACAO: o PF da CMED e por EMBALAGEM — pra regua unitaria precisa dividir.
// Padroes reais: "CX 25 FA VD TRANS X 5 ML"->25 | "CT 1 FA"->1 | "CT BL AL X 30"->30 |
// "CT 5 AMP X 5 ML"->5 | "CT SER PREENCHIDA X 1,0 ML"->1 (X seguido de volume NAO e qtd).
function cmedQtdApres(apres) {
  const s = String(apres || '').toUpperCase();
  let m = s.match(/\b(?:CX|CT)\s+(\d{1,4})\s*(?:FA|AMP|SER|CARP|FR|BG|TB|ENV|SACHE|BOLS|BL\b)/);
  if (m) return parseInt(m[1]);
  m = s.match(/X\s+(\d{1,4})(?!\s*(?:[.,]\d|ML|MG|MCG|G\b|GR|UI|L\b|%))\b/);
  if (m) return parseInt(m[1]);
  return 1;
}
// ';' da CMED separa componentes de COMBO -> vira ' + ' (senão o marcador some e o combo-guard
// do Catálogo não vê que é combo — pego no E2E de 23/07 com DORIL/CAFEINA)
const norm = s => String(s || '').toUpperCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/;/g, ' + ').replace(/[^A-Z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim();
module.exports = { cmedApresNorm, cmedDoseKey, cmedQtdApres, norm };
if (require.main !== module) return;

function acharXlsx() {
  if (argPath) { if (!fs.existsSync(argPath)) { console.error('nao existe: ' + argPath); process.exit(1); } return argPath; }
  const fs2 = fs.readdirSync('C:/fpmed').filter(f => /^xls_conformidade.*\.xlsx$/i.test(f))
    .map(f => ({ f, t: fs.statSync('C:/fpmed/' + f).mtimeMs })).sort((a, b) => b.t - a.t);
  if (!fs2.length) { console.error('nenhum xls_conformidade*.xlsx em C:\fpmed'); process.exit(1); }
  return 'C:/fpmed/' + fs2[0].f;
}
const numBR = v => { const n = parseFloat(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')); return isFinite(n) && n > 0 ? n : null; };

(async () => {
  const arq = acharXlsx();
  console.log('planilha: ' + arq + (APPLY ? '   [APPLY]' : '   [PREVIEW]'));
  const wb = XLSX.readFile(arq);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const pubM = rows.slice(0, 8).map(r => String(r && r[0] || '')).join(' ').match(/Publicada em (\d{2})\/(\d{2})\/(\d{4})/);
  const publicada = pubM ? `${pubM[3]}-${pubM[2]}-${pubM[1]}` : null;
  if (!publicada) { console.error('nao achei "Publicada em dd/mm/aaaa" no topo'); process.exit(1); }
  let hi = -1; rows.forEach((r, i) => { if (hi < 0 && Array.isArray(r) && r.filter(Boolean).length > 8 && r.some(c => /^SUBST/i.test(String(c)))) hi = i; });
  const head = rows[hi].map(c => String(c || '').replace(/\s+/g, ' ').trim().toUpperCase());
  const col = nome => head.findIndex(h => h === nome || h.startsWith(nome));
  const iS = col('SUBSTÂNCIA'), iP = col('PRODUTO'), iA = col('APRESENTAÇÃO'), iPF0 = col('PF 0%'), iPF19 = col('PF 19 %'), iRH = col('RESTRIÇÃO HOSPITALAR');
  const iLab = col('LABORATÓRIO'), iTipo = col('TIPO DE PRODUTO'), iTarja = col('TARJA');   // Catálogo por PA (22/07)
  // colunas novas (28/07, aprovado): identificação e preços extras da lista oficial.
  // PMVG fica de fora: NÃO existe nesta planilha — vem na lista CAP/PMVG, publicação separada.
  const iEan1 = col('EAN 1'), iEan2 = col('EAN 2'), iEan3 = col('EAN 3'), iGgrem = col('CÓDIGO GGREM'),
        iReg = col('REGISTRO'), iClasse = col('CLASSE TERAPÊUTICA'), iCap = col('CAP'),
        iConfaz = col('CONFAZ 87'), iComerc = col('COMERCIALIZAÇÃO'), iPmc19 = col('PMC 19 %');
  const limpaEan = v => { const s = String(v == null ? '' : v).replace(/[^\d]/g, ''); return s.length >= 8 ? s : null; };
  const txt = (v, n) => { const s = String(v == null ? '' : v).trim(); return s && s !== '-' ? s.slice(0, n) : null; };
  if ([iS, iP, iA, iPF0, iPF19].some(i => i < 0)) { console.error('coluna nao achada: ' + JSON.stringify({ iS, iP, iA, iPF0, iPF19 })); process.exit(1); }
  console.log(`publicada ${publicada} | header linha ${hi} | cols S=${iS} P=${iP} A=${iA} PF0=${iPF0} PF19=${iPF19}`);

  const regs = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r || !r[iS] || !r[iP]) continue;
    const pf0 = numBR(r[iPF0]), pf19 = numBR(r[iPF19]);
    if (!pf0 && !pf19) continue;                              // sem preco = nao serve de regua
    regs.push({ subst_norm: norm(r[iS]), marca_norm: norm(r[iP]), apresentacao: String(r[iA] || '').slice(0, 300),
      dose_key: cmedDoseKey(r[iA]) || null, qtd_apres: cmedQtdApres(r[iA]), pf_go19: pf19, pf_0: pf0, restricao_hosp: String(r[iRH] || '').slice(0, 30) || null,
      laboratorio: iLab >= 0 ? (String(r[iLab] || '').slice(0, 80) || null) : null,
      tipo_produto: iTipo >= 0 ? (String(r[iTipo] || '').slice(0, 30) || null) : null,
      tarja: iTarja >= 0 ? (String(r[iTarja] || '').slice(0, 40) || null) : null,
      ean1: iEan1 >= 0 ? limpaEan(r[iEan1]) : null,
      ean2: iEan2 >= 0 ? limpaEan(r[iEan2]) : null,
      ean3: iEan3 >= 0 ? limpaEan(r[iEan3]) : null,
      ggrem: iGgrem >= 0 ? txt(r[iGgrem], 20) : null,
      registro: iReg >= 0 ? txt(r[iReg], 20) : null,
      classe_terapeutica: iClasse >= 0 ? txt(r[iClasse], 120) : null,
      cap: iCap >= 0 ? txt(r[iCap], 10) : null,
      confaz87: iConfaz >= 0 ? txt(r[iConfaz], 10) : null,
      comercializacao: iComerc >= 0 ? txt(r[iComerc], 10) : null,
      pmc: iPmc19 >= 0 ? numBR(r[iPmc19]) : null,
      pmvg: null,                       // lista CAP/PMVG é outro arquivo — entra quando o Lemuel baixar
      publicada });
  }
  const comDose = regs.filter(r => r.dose_key).length;
  console.log(`linhas com preco: ${regs.length} | com dose_key parseavel: ${comDose} (${Math.round(comDose / regs.length * 100)}%)`);

  // edicoes ja na tabela
  const cur = await (await fetch(`${SB}/rest/v1/cmed_pf?select=publicada&limit=1&order=publicada.desc`, { headers: H })).json();
  const edicaoAtual = (Array.isArray(cur) && cur[0]) ? cur[0].publicada : null;
  console.log('edicao na tabela hoje: ' + (edicaoAtual || 'nenhuma') + ' -> nova: ' + publicada);
  if (!APPLY) { console.log('\nPreview OK. Rodar com --apply pra gravar (insere a nova e remove a anterior).'); return; }
  if (edicaoAtual === publicada && !process.argv.includes('--recarregar')) { console.log('mesma edicao ja carregada — nada a fazer (use --recarregar p/ refazer).'); return; }
  if (edicaoAtual === publicada) {   // --recarregar: apaga a propria edicao antes de reinserir (refeita do zero da planilha)
    const del0 = await fetch(`${SB}/rest/v1/cmed_pf?publicada=eq.${publicada}`, { method: 'DELETE', headers: { ...H, Prefer: 'count=exact' } });
    console.log('recarregando: edicao ' + publicada + ' removida p/ reinsercao (HTTP ' + del0.status + ')');
  }

  let ins = 0;
  for (let i = 0; i < regs.length; i += 500) {
    const r = await fetch(`${SB}/rest/v1/cmed_pf`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(regs.slice(i, i + 500)) });
    if (!r.ok) { console.error('ERRO no lote ' + i + ': ' + r.status + ' ' + (await r.text()).slice(0, 120)); process.exit(1); }
    ins += Math.min(500, regs.length - i);
    if (i % 5000 === 0) console.log('  inseridos ' + ins + '/' + regs.length + '…');
  }
  console.log('inseridos: ' + ins + ' (edicao ' + publicada + ')');
  // remove SO edicao DIFERENTE da recem-inserida (no --recarregar a data e a mesma — deletar
  // aqui apagaria o que acabou de entrar; foi exatamente o bug pego em 22/07, tabela foi a 0)
  if (edicaoAtual && edicaoAtual !== publicada) {
    const del = await fetch(`${SB}/rest/v1/cmed_pf?publicada=eq.${edicaoAtual}`, { method: 'DELETE', headers: { ...H, Prefer: 'count=exact' } });
    console.log('edicao anterior ' + edicaoAtual + ' removida: HTTP ' + del.status + ' (' + (del.headers.get('content-range') || '') + ')');
  }
  const tot = await fetch(`${SB}/rest/v1/cmed_pf?select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  console.log('total na tabela agora: ' + (tot.headers.get('content-range') || '').split('/')[1]);
})();
