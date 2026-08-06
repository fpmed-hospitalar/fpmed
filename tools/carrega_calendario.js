// ═══════════════════════════════════════════════════════════════════════════════
// CARGA DO Calendario 2025.xlsm -> licitacoes_acompanhadas   (item 8 FASE 2, 05/08/2026)
//
// Uso:  node tools/carrega_calendario.js            -> PREVIEW (nada gravado)
//       node tools/carrega_calendario.js --apply    -> grava (so em tabela vazia)
//
// O QUE E: as 2.578 linhas da aba AGENDA -- o que a FPMED acompanhou, o que disputou, em que
// portal, por qual orgao e QUANTO GANHOU. E a memoria da propria empresa: o PNCP diz o que
// EXISTE, isto diz o que a FPMED FEZ.
//
// CONDICOES QUE O LEMUEL DEU AO LIBERAR: backup antes e relatorio do que entrou. Os dois estao
// aqui -- o backup e o JSON do que FOI PARSEADO (nao do banco, que esta vazio), gravado em
// backups/ antes do primeiro insert. Ele e o que permite conferir depois "o parser leu certo?"
// sem reabrir um xlsm de 50 MB.
//
// AS CONVERSOES (ditadas na FASE 1):
//   ABERTURA  serial do Excel -> data ISO
//   HORA      fracao do dia   -> HH:MM
//   VALOR GANHO pt-BR          -> numerico
//   NUMERO    pelo mesmo numCompra() ja testado no Licitacoes (extraido de la, nao recopiado)
//
// ⚠️ O .xlsm NAO vai pro repo (gitignore desde 05/08): tem VALOR GANHO dentro e o repo e publico.
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const APPLY = process.argv.includes('--apply');
const ARQ = 'C:/fpmed/Calendario 2025.xlsm';

// ── numCompra REAL da tela de Licitacoes (extraido por ancora, nao recopiado) ───────────────
const srcLic = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8');
function fnLic(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + nome + '\\s*\\(').exec(srcLic);
  if (!m) throw new Error('nao achei ' + nome + ' no fpmed_licitacoes.html');
  let i = srcLic.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < srcLic.length; j++) { if (srcLic[j] === '{') n++; else if (srcLic[j] === '}') { n--; if (!n) return srcLic.slice(m.index, j + 1); } }
  throw new Error('chave nao fechou: ' + nome);
}
const { numCompra } = (new Function(fnLic('numCompra') + '\nreturn { numCompra };'))();

// ── conversoes ─────────────────────────────────────────────────────────────────────────────
// Serial do Excel: dias desde 30/12/1899. O bug do ano bissexto de 1900 nao afeta datas >= 1901,
// e a planilha e de 2024-2026 -- entao a conversao direta serve.
function serialParaISO(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (!isFinite(n) || n < 1) return null;
  // 25569 = dias entre 30/12/1899 e 01/01/1970. Meio-dia UTC evita a data virar pelo fuso.
  const ms = Math.round((Math.floor(n) - 25569) * 86400000) + 12 * 3600000;
  const d = new Date(ms);
  if (isNaN(d) || d.getUTCFullYear() < 2000 || d.getUTCFullYear() > 2100) return null;
  return d.toISOString().slice(0, 10);
}
// Hora vem como fracao do dia (0,375 = 09:00). Texto "09:30" tambem e aceito, porque planilha
// preenchida a mao mistura os dois.
function fracaoParaHora(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v.trim())) {
    const [h, m] = v.trim().split(':');
    return String(h).padStart(2, '0') + ':' + String(m).slice(0, 2);
  }
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (!isFinite(n)) return null;
  const frac = n - Math.floor(n);                 // serial com data junta: fica so a hora
  const total = Math.round(frac * 24 * 60);
  if (total < 0 || total > 1439) return null;
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}
// pt-BR -> numero. Celula ja numerica NAO passa pelo replace de milhar (o mesmo cuidado do
// loader da CMED: 6533.27 viraria 653327).
function valorBR(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
  let s = String(v).replace(/R\$/gi, '').trim();
  if (!s || /^-+$/.test(s)) return null;
  s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : null;
}
const txt = (v, n) => { const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return s && s !== '-' ? s.slice(0, n) : null; };

module.exports = { serialParaISO, fracaoParaHora, valorBR };
if (require.main !== module) return;

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
if (!SR) { console.error('service_role nao encontrada'); process.exit(1); }
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

(async () => {
  console.log(APPLY ? '[APPLY]' : '[PREVIEW — nada e gravado]');
  const t0 = Date.now();
  // >>> LER O WORKBOOK INTEIRO NAO TERMINA. A FASE 1 ja tinha medido isso (passa de 15 min num
  //     arquivo de 49,7 MB) e eu repeti o erro na primeira versao deste loader: os flags de
  //     parse minimo NAO bastam, porque o custo esta em varrer o range das outras abas.
  //     `sheets:'AGENDA'` faz o SheetJS parsear SO a aba que interessa, e `sheetRows` poe um
  //     teto de linhas -- 2.578 de dado + folga. Com os dois, abre em segundos.
  // >>> POR QUE `dense` E POR QUE SEM `sheetRows` — as duas coisas foram medidas hoje, depois
  //     de duas tentativas que NAO voltavam:
  //     · o range declarado da aba e `A1:XFD2578`. XFD = 16.384 colunas. A FASE 1 reportou
  //       "16 colunas" contando o CABECALHO, nao o range — e e o range que manda no custo.
  //     · com `sheetRows:3000` a leitura nunca terminava (o modo esparso cria objeto por
  //       celula sobre um range de 49 milhoes). Com `dense`, o SheetJS usa arrays por linha e
  //       a mesma aba abre em ~78 s. Lento, mas FINITO — e esta e uma carga unica.
  const TETO_LINHAS = 3000;
  const wb = XLSX.readFile(ARQ, { sheets: 'AGENDA', dense: true,
    cellFormula: false, cellHTML: false, cellStyles: false, cellNF: false, cellText: false, sheetStubs: false });
  const ws = wb.Sheets['AGENDA'];
  if (!ws) { console.error('aba AGENDA nao encontrada'); process.exit(1); }
  // >>> O QUE DE FATO TRAVAVA: o range declarado da aba e `A1:XFD2578`. XFD = 16.384 colunas.
  //     A FASE 1 reportou "16 colunas" contando o CABECALHO, nao o range -- e o
  //     `sheet_to_json` percorre o RANGE, nao as celulas existentes. Com 3.000 linhas isso da
  //     49 MILHOES de iteracoes, e o processo nunca voltava. As celulas de verdade sao ~41 mil.
  //     Estreitar o `!ref` para as colunas que existem resolve; a leitura em si nunca foi o
  //     problema (6 s), e por isso o diagnostico "e o parse de celula" da FASE 1 apontava pro
  //     lugar errado.
  const refReal = ws['!fullref'] || ws['!ref'];
  const rr = XLSX.utils.decode_range(refReal);
  const linhasReais = rr.e.r + 1;
  if (linhasReais > TETO_LINHAS) {
    console.error(`\nABORTA: a aba tem ${linhasReais} linhas e o teto de leitura e ${TETO_LINHAS}.`);
    console.error('Gravar assim carregaria a planilha PELA METADE sem avisar. Subir TETO_LINHAS e rodar de novo.');
    process.exit(1);
  }
  const COLS_UTEIS = 20;                        // a AGENDA tem 16; 20 da folga sem custar nada
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhasReais - 1, c: COLS_UTEIS - 1 } });
  const grade = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
  console.log(`AGENDA lida em ${((Date.now() - t0) / 1000).toFixed(1)}s · ${grade.length} linhas cruas · range original ${refReal} estreitado p/ ${ws['!ref']}`);

  const hi = grade.findIndex(l => l.some(c => /^STATUS$/i.test(String(c).trim())));
  if (hi < 0) { console.error('cabecalho (STATUS) nao encontrado'); process.exit(1); }
  const head = grade[hi].map(c => String(c || '').replace(/\s+/g, ' ').trim().toUpperCase());
  const col = n => head.findIndex(h => h === n || h.startsWith(n));
  const iStatus = col('STATUS'), iAb = col('ABERTURA'), iH = col('HORA'), iMod = col('MOD'),
        iNC = col('Nº COMPRA') >= 0 ? col('Nº COMPRA') : col('N COMPRA'),
        iNum = col('NUMERO') >= 0 ? col('NUMERO') : col('NÚMERO'),
        iPor = col('PORTAL'), iCid = col('CIDADE'), iUF = col('UF'), iOrg = col('ORGAO') >= 0 ? col('ORGAO') : col('ÓRGÃO'),
        iObj = col('OBJETO'), iVal = col('VALOR GANHO'), iObs = col('OBSERVA'), iAno = col('ANO');
  console.log(`cabecalho na linha ${hi + 1} · ${head.filter(Boolean).length} colunas`);

  const regs = [];
  let semNada = 0;
  for (let i = hi + 1; i < grade.length; i++) {
    const r = grade[i];
    if (!r || !r.filter(x => String(x).trim()).length) continue;
    const orgao = txt(r[iOrg], 200), objeto = txt(r[iObj], 600), numero = txt(r[iNum], 40);
    const abertura = serialParaISO(r[iAb]);
    if (!orgao && !objeto && !numero && !abertura) { semNada++; continue; }   // linha de rodape/separador
    const ano = (abertura && abertura.slice(0, 4)) || txt(r[iAno], 4) || '';
    regs.push({
      origem: 'calendario_2025',
      status: txt(r[iStatus], 40), abertura, hora: fracaoParaHora(r[iH]),
      modalidade: txt(r[iMod], 20), numero_compra: txt(r[iNC], 40),
      numero: numero ? numCompra(numero, ano) : null,
      portal: txt(r[iPor], 60), cidade: txt(r[iCid], 80), uf: txt(r[iUF], 4),
      orgao, objeto, valor_ganho: valorBR(r[iVal]), observacao: txt(r[iObs], 600),
      linha_planilha: i + 1,
    });
  }

  const comData = regs.filter(x => x.abertura).length;
  const comValor = regs.filter(x => x.valor_ganho != null);
  const totalGanho = comValor.reduce((a, x) => a + x.valor_ganho, 0);
  const porStatus = {}, porPortal = {}, porUF = {};
  regs.forEach(x => { porStatus[x.status || '(vazio)'] = (porStatus[x.status || '(vazio)'] || 0) + 1;
                      porPortal[x.portal || '(vazio)'] = (porPortal[x.portal || '(vazio)'] || 0) + 1;
                      porUF[x.uf || '(vazio)'] = (porUF[x.uf || '(vazio)'] || 0) + 1; });
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(' · ');
  const datas = regs.map(x => x.abertura).filter(Boolean).sort();

  console.log('\n── PREVIEW ────────────────────────────────────────────');
  console.log(`linhas a gravar ......... ${regs.length}`);
  console.log(`  linhas puladas (vazias/rodape) ... ${semNada}`);
  console.log(`com data de abertura .... ${comData} (${(comData / regs.length * 100).toFixed(0)}%)`);
  console.log(`  periodo ............... ${datas[0] || '—'}  ate  ${datas[datas.length - 1] || '—'}`);
  console.log(`com hora ................ ${regs.filter(x => x.hora).length}`);
  console.log(`com numero normalizado .. ${regs.filter(x => x.numero).length}`);
  console.log(`com orgao ............... ${regs.filter(x => x.orgao).length}`);
  console.log(`*** COM VALOR GANHO ..... ${comValor.length}  (as disputas VENCIDAS)`);
  console.log(`    total ganho ......... R$ ${totalGanho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`    maior ............... R$ ${Math.max(...comValor.map(x => x.valor_ganho)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`\nstatus : ${top(porStatus)}`);
  console.log(`portal : ${top(porPortal)}`);
  console.log(`UF     : ${top(porUF)}`);
  console.log('\namostra (sem valor, pra nao imprimir dado comercial no console):');
  regs.slice(0, 4).forEach(x => console.log(`  ${x.abertura || '—'} ${x.hora || '—'} · ${x.modalidade || '—'} ${x.numero || '—'} · ${(x.portal || '—').slice(0, 16)} · ${(x.orgao || '—').slice(0, 40)}`));

  const jaTem = await fetch(`${SB}/rest/v1/licitacoes_acompanhadas?select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (jaTem.status === 404 || jaTem.status === 400) { console.error('\ntabela nao existe — rodar antes: node tools/roda_sql.js --arquivo ddl/licitacoes_acompanhadas.sql'); process.exit(1); }
  const nExist = parseInt((jaTem.headers.get('content-range') || '/0').split('/')[1]) || 0;
  console.log(`\nlinhas ja na tabela: ${nExist}`);

  if (!APPLY) { console.log('\nPreview OK. Gravar com --apply.'); return; }
  if (nExist > 0) { console.error('\nRECUSADO: a tabela ja tem linha. Recarregar exige apagar antes — decisao do Lemuel.'); process.exit(1); }

  // BACKUP antes da primeira escrita (condicao dele). O banco esta vazio, entao o que se guarda
  // e o PARSE: e ele que permite conferir depois "o parser leu certo?" sem reabrir 50 MB de xlsm.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  fs.mkdirSync('C:/fpmed/backups', { recursive: true });
  const arqBk = `C:/fpmed/backups/calendario_parse_${stamp}.json`;
  fs.writeFileSync(arqBk, JSON.stringify({ quando: stamp, arquivo: ARQ, linhas: regs.length, regs }, null, 1));
  console.log(`\nBACKUP do parse: ${arqBk}  (gitignored — tem VALOR GANHO dentro)`);

  let n = 0;
  for (let i = 0; i < regs.length; i += 500) {
    const lote = regs.slice(i, i + 500);
    const r = await fetch(`${SB}/rest/v1/licitacoes_acompanhadas`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(lote) });
    if (!r.ok) { console.error('ERRO no lote ' + i + ': ' + r.status + ' ' + (await r.text()).slice(0, 200)); process.exit(1); }
    n += lote.length;
    console.log(`  gravadas ${n}/${regs.length}…`);
  }
  const tot = await fetch(`${SB}/rest/v1/licitacoes_acompanhadas?select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  console.log(`\ngravadas ${n} | total na tabela: ${(tot.headers.get('content-range') || '').split('/')[1]}`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
