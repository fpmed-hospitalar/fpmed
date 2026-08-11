// ============================================================================================
// prova_partes_edital.js — PROVA da LEITURA EM PARTES: um edital que nao cabia numa leitura so
// e lido inteiro, e o contador registra UMA cobranca.
//
// ══ O QUE ELE MEDE, E CONTRA O QUE ══════════════════════════════════════════════════════════
// Repete a MESMA logica de particao da tela (por PAGINA, com teto de caracteres) e chama a edge
// function de verdade, parte por parte, com o mesmo `lote`. No fim:
//   · costura os itens como a tela costura (dedup + continuidade) e RELATA os buracos;
//   · confere no banco que as N partes viraram UMA linha em usos_ia, com os custos somados;
//   · quando a compra tem itens no PNCP, compara com o gabarito oficial.
//
// >>> POR QUE REPETIR A LOGICA AQUI, se em todo o resto deste projeto eu recuso duplicar: porque
//     a logica da tela vive dentro de um <script> de HTML e nao ha como importa-la no node sem
//     um navegador. A alternativa seria nao provar nada. O que se faz pra segurar isso e a suite
//     testa_leitura_partes, que confere que os DOIS lados usam os mesmos numeros (CHARS_POR_PARTE
//     e o corte por fim de pagina) — se um mudar sem o outro, ela fica vermelha.
//
// USO:
//   node tools/prova_partes_edital.js --url <pdf>      (um PDF especifico)
//   node tools/prova_partes_edital.js --pncp <numero>  (uma compra do nosso indice)
//   node tools/prova_partes_edital.js --arquivo x.pdf  (um PDF do disco — o do print do Lemuel)
//   node tools/prova_partes_edital.js ... --resumo     (tarefa `resumo` em vez de `itens`)
//   node tools/prova_partes_edital.js ... --so-partir  (so parte e mostra; ZERO credito gasto)
// ============================================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const EDGE = SB + '/functions/v1/ler-edital';
const ORIGEM = 'https://fpmed-hospitalar.github.io';

// OS MESMOS NUMEROS DA TELA. A suite testa_leitura_partes trava que eles sao os mesmos.
const CHARS_POR_PARTE = 240000;
const MIN_CHARS_TEXTO = 500;

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = n => process.argv.includes(n);

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const ANON = (seg.match(/anon[\s\S]{0,200}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

async function tokenDoGestor() {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'licitacao@fpmed.com.br', password: SENHA }),
  });
  return (await r.json()).access_token || null;
}
async function cotacaoDolar() {
  try {
    const r = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL', { signal: AbortSignal.timeout(8000) });
    const v = parseFloat((await r.json()).USDBRL.bid);
    return isFinite(v) && v > 0 ? v : null;
  } catch (e) { return null; }
}

// TEXTO PAGINA A PAGINA — o mesmo pdf.js do navegador, agrupando por Y pra preservar a LINHA.
async function pdfPorPagina(buf) {
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const linhas = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const x = it.transform[4], y = it.transform[5];
      let alvo = linhas.find(l => Math.abs(l.y - y) <= 2.5);
      if (!alvo) { alvo = { y, itens: [] }; linhas.push(alvo); }
      alvo.itens.push({ x, str: it.str });
    }
    linhas.sort((a, b) => b.y - a.y);
    out.push({ pagina: p, texto: linhas.map(l => l.itens.sort((a, b) => a.x - b.x).map(i => i.str).join(' ')).join('\n') });
  }
  return { paginas: out, total: doc.numPages };
}

// O CORTE E SEMPRE EM FIM DE PAGINA — cortar no meio partiria uma linha da tabela de itens, e a
// quantidade ficaria numa parte e a descricao na outra.
function partirPorPagina(paginas, limiteChars) {
  const partes = [];
  let atual = null;
  for (const p of paginas) {
    if (!atual || (atual.chars + p.texto.length > limiteChars && atual.chars > 0)) {
      atual = { de: p.pagina, ate: p.pagina, texto: '', chars: 0 };
      partes.push(atual);
    }
    atual.ate = p.pagina;
    atual.texto += '\n\n===== página ' + p.pagina + ' =====\n' + p.texto;
    atual.chars += p.texto.length;
  }
  return partes.filter(x => x.chars > 0);
}

async function itensOficiais(cnpj, ano, seq) {
  const out = [];
  for (let pag = 1; pag <= 6; pag++) {
    const u = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens?pagina=${pag}&tamanhoPagina=500`;
    const r = await fetch(u, { signal: AbortSignal.timeout(25000) });
    if (!r.ok) { if (pag === 1) return null; break; }
    const j = await r.json();
    const lote = Array.isArray(j) ? j : (j.data || []);
    out.push(...lote);
    if (lote.length < 500) break;
    await new Promise(s => setTimeout(s, 700));
  }
  return out;
}
const normNum = v => { const s = String(v == null ? '' : v).trim(); const m = s.match(/^0*(\d+)$/); return m ? m[1] : s.toUpperCase(); };

(async () => {
  console.log('=== PROVA DA LEITURA EM PARTES ===\n');
  const TAREFA = tem('--resumo') ? 'resumo' : 'itens';

  // ── 1. O DOCUMENTO ────────────────────────────────────────────────────────────────────────
  let buf, rotulo, url = arg('--url'), gabarito = null;
  if (arg('--arquivo')) {
    const p = path.isAbsolute(arg('--arquivo')) ? arg('--arquivo') : path.join(RAIZ, arg('--arquivo'));
    buf = fs.readFileSync(p); rotulo = path.basename(p); url = null;
  } else if (arg('--pncp')) {
    const r = await fetch(`${SB}/rest/v1/licitacoes?select=cnpj,ano,sequencial,orgao,objeto,numero_controle`
      + `&numero_controle=eq.${encodeURIComponent(arg('--pncp'))}`, { headers: H });
    const l = (await r.json())[0];
    if (!l) { console.error('nao achei essa compra no nosso indice.'); process.exit(1); }
    const ra = await fetch(`https://pncp.gov.br/api/pncp/v1/orgaos/${l.cnpj}/compras/${l.ano}/${l.sequencial}/arquivos`);
    const pdfs = (await ra.json()).filter(a => /\.pdf$/i.test(a.titulo || a.nomeArquivo || ''));
    const alvo = pdfs.sort((a, b) => (/edital|termo|anexo/i.test(b.titulo || '') ? 1 : 0) - (/edital|termo|anexo/i.test(a.titulo || '') ? 1 : 0))[0];
    url = alvo.url; rotulo = alvo.titulo || alvo.nomeArquivo;
    gabarito = await itensOficiais(l.cnpj, l.ano, l.sequencial);
    console.log(`compra ${l.numero_controle} · ${l.orgao}`);
    if (gabarito) console.log(`>>> GABARITO DO PNCP: ${gabarito.length} itens`);
  }
  if (!buf) {
    if (!url) { console.error('use --url, --pncp ou --arquivo'); process.exit(1); }
    console.log('baixando ' + url.slice(0, 90) + '...');
    const rp = await fetch(url, { signal: AbortSignal.timeout(180000) });
    if (!rp.ok) { console.error('download HTTP ' + rp.status); process.exit(1); }
    buf = Buffer.from(await rp.arrayBuffer());
    rotulo = rotulo || url.split('/').pop();
  }
  const mb = buf.length / 1024 / 1024;
  console.log(`documento: ${rotulo} · ${mb.toFixed(2)} MB`);

  // ── 2. PARTIR ─────────────────────────────────────────────────────────────────────────────
  console.log('extraindo o texto pagina a pagina...');
  const ex = await pdfPorPagina(buf);
  const totalChars = ex.paginas.reduce((s, p) => s + p.texto.length, 0);
  console.log(`  ${ex.total} paginas · ${totalChars.toLocaleString('pt-BR')} caracteres`);
  if (totalChars < MIN_CHARS_TEXTO) {
    console.error('extracao pobre (PDF escaneado). Esta prova cobre o caminho de TEXTO; o de PDF nativo '
      + 'em partes usa o pdf-lib e so roda no navegador.');
    process.exit(1);
  }
  const partes = partirPorPagina(ex.paginas, CHARS_POR_PARTE);
  console.log(`\n>>> DIVIDIDO EM ${partes.length} PARTE(S):`);
  partes.forEach((p, i) => console.log(`    ${i + 1}. paginas ${p.de}-${p.ate} · ${p.chars.toLocaleString('pt-BR')} chars`));
  if (tem('--so-partir')) { console.log('\n--so-partir: nada foi enviado, zero credito gasto.'); return; }

  // ── 3. LER ────────────────────────────────────────────────────────────────────────────────
  const tok = await tokenDoGestor();
  if (!tok) { console.error('nao consegui logar como licitacao@fpmed.com.br'); process.exit(1); }
  const cambio = await cotacaoDolar();
  const lote = 'PROVA-' + Date.now().toString(36);
  console.log(`\nlendo (tarefa ${TAREFA}, lote ${lote})...`);

  const t0 = Date.now();
  const respostas = [], falhas = [];
  let leituraId = null;
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i];
    process.stdout.write(`  parte ${i + 1}/${partes.length} (pag ${p.de}-${p.ate})... `);
    const r = await fetch(EDGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGEM, Authorization: 'Bearer ' + tok },
      body: JSON.stringify({
        tarefa: TAREFA, modo: 'texto', texto: p.texto, titulo: rotulo, url, mb: +mb.toFixed(2),
        cambio, paginas: p.ate - p.de + 1, chars: p.chars, lote, parte: i + 1, partes: partes.length,
      }),
      signal: AbortSignal.timeout(600000),
    });
    const txt = await r.text();
    if (!r.ok) { console.log('HTTP ' + r.status); falhas.push({ de: p.de, ate: p.ate, motivo: 'HTTP ' + r.status }); continue; }
    const j = JSON.parse(txt);
    leituraId = j.leituraId || leituraId;
    if (j.ok === false) { console.log('FALHOU: ' + j.erro); falhas.push({ de: p.de, ate: p.ate, motivo: j.erro }); continue; }
    const n = TAREFA === 'itens' ? ((j.dados && j.dados.itens) || []).length : 1;
    console.log(TAREFA === 'itens' ? `${n} itens` : 'ok');
    respostas.push({ de: p.de, ate: p.ate, dados: j.dados });
  }
  const segundos = Math.round((Date.now() - t0) / 1000);

  // ── 4. COSTURAR ───────────────────────────────────────────────────────────────────────────
  if (TAREFA === 'itens') {
    // MESMO DESEMPATE DA TELA: ganha a copia mais COMPLETA, e nao a primeira. Medido: o edital
    // traz tabela resumida no corpo e anexo detalhado no fim, e "a primeira ganha" escolheria
    // sistematicamente a resumida.
    const riqueza = it => !it ? -1 : String(it.descricao || '').trim().length
      + (String(it.unidade || '').trim() ? 40 : 0)
      + (it.quantidade != null && it.quantidade !== '' ? 40 : 0)
      + (it.valor_unitario != null && it.valor_unitario !== '' ? 20 : 0);
    const vistos = new Map(); const dup = [];
    for (const r of respostas) for (const it of ((r.dados && r.dados.itens) || [])) {
      const k = normNum(it.n); if (!k) continue;
      if (vistos.has(k)) { dup.push(k); if (riqueza(it) > riqueza(vistos.get(k))) vistos.set(k, it); continue; }
      vistos.set(k, it);
    }
    const nums = [...vistos.keys()].map(x => parseInt(x, 10)).filter(isFinite).sort((a, b) => a - b);
    const buracos = [];
    for (let i = 1; i < nums.length; i++) if (nums[i] - nums[i - 1] > 1) buracos.push(`${nums[i - 1] + 1}-${nums[i] - 1}`);
    console.log('\n=== A COSTURA ===');
    console.log(`itens depois de juntar . ${vistos.size}`);
    console.log(`faixa .................. ${nums.length ? nums[0] + '-' + nums[nums.length - 1] : '—'}`);
    console.log(`repetidos entre partes . ${[...new Set(dup)].length}  (tabela que atravessa a pagina)`);
    console.log(`buracos na numeracao ... ${buracos.length ? buracos.join(', ') : 'NENHUM'}`);
    if (falhas.length) console.log(`partes que falharam .... ${falhas.map(f => f.de + '-' + f.ate).join(', ')}`);
    if (gabarito) {
      const of = new Set(gabarito.map(o => normNum(o.numeroItem)));
      const faltando = [...of].filter(n => !vistos.has(n));
      console.log(`\n>>> CONTRA O PNCP: ${gabarito.length} oficiais x ${vistos.size} extraidos · cobertura `
        + `${of.size ? Math.round(100 * (of.size - faltando.length) / of.size) : 0}%`);
      if (faltando.length) console.log(`    nao vieram: ${faltando.slice(0, 40).join(', ')}`);
    }
  } else {
    console.log('\n=== OS PARCIAIS ===');
    respostas.forEach(r => console.log(`  pag ${r.de}-${r.ate}: ${String((r.dados || {}).objeto || '—').slice(0, 90)}`));
    // ── A JUNCAO (map-reduce) ──────────────────────────────────────────────────────────────
    // Ela e uma leitura tambem, mas do MESMO lote: entra na soma em vez de virar uma 2a cobranca.
    if (respostas.length > 1) {
      console.log('\njuntando os resumos parciais...');
      const texto = respostas.map(r =>
        '--- resumo da parte (páginas ' + r.de + '-' + r.ate + ') ---\n' + JSON.stringify(r.dados)).join('\n\n');
      const rj = await fetch(EDGE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGEM, Authorization: 'Bearer ' + tok },
        body: JSON.stringify({ tarefa: 'juntar', modo: 'texto', texto, titulo: rotulo, cambio,
          lote, parte: partes.length, partes: partes.length }),
        signal: AbortSignal.timeout(300000),
      });
      const tj = await rj.text();
      if (!rj.ok) { console.log('  a juncao respondeu HTTP ' + rj.status); }
      else {
        const j = JSON.parse(tj);
        if (j.ok === false) console.log('  a juncao falhou: ' + j.erro + '  (os parciais acima nao se perdem)');
        else {
          const d = j.dados || {};
          console.log('=== O RESUMO JUNTO ===');
          console.log(`  objeto ....... ${String(d.objeto || '—').slice(0, 110)}`);
          console.log(`  orgao ........ ${String(d.orgao || '—').slice(0, 80)}`);
          console.log(`  modalidade ... ${String(d.modalidade || '—').slice(0, 60)}`);
          console.log(`  abertura ..... ${String(d.abertura || '—').slice(0, 60)}`);
          console.log(`  habilitacao .. ${(d.habilitacao || []).length} item(ns)`);
          console.log(`  atencao ...... ${(d.pontos_de_atencao || []).length} ponto(s)`);
          console.log(`  nao achou .... ${(d.nao_encontrado || []).length} campo(s)`);
          // >>> O CONFLITO E O PONTO. Quando duas partes discordam, a juncao NAO escolhe calada.
          const cf = d.conflitos || [];
          console.log(`  CONFLITOS .... ${cf.length}` + (cf.length ? ':' : ' (as partes nao se contradisseram)'));
          cf.forEach(c => console.log(`     · ${c.campo}: ${(c.versoes || []).join('  x  ')}`.slice(0, 160)));
        }
      }
    }
  }

  // ── 5. UMA COBRANCA SO? ───────────────────────────────────────────────────────────────────
  // Esta e a pergunta que so o BANCO responde, e e a metade comercial da prova.
  console.log('\n=== O CONTADOR ===');
  const rc = await fetch(`${SB}/rest/v1/usos_ia?lote=eq.${lote}&select=*`, { headers: H });
  const linhas = await rc.json();
  console.log(`linhas em usos_ia para este lote: ${linhas.length}  (tem que ser 1)`);
  if (linhas.length === 1) {
    const l = linhas[0];
    console.log(`  partes=${l.partes} · partes_ok=${l.partes_ok} · ok=${l.ok}`);
    console.log(`  entrada=${Number(l.tokens_entrada).toLocaleString('pt-BR')} · saida=${Number(l.tokens_saida).toLocaleString('pt-BR')} · ${l.segundos}s`);
    console.log(`  CUSTO TOTAL: ${l.brl != null ? 'R$ ' + Number(l.brl).toFixed(4) : 'US$ ' + Number(l.usd).toFixed(4)}`);
    if (l.erro) console.log(`  erro registrado: ${l.erro}`);
  }
  console.log(`tempo de parede: ${segundos}s`);
})().catch(e => { console.error('ERRO: ' + (e && e.message)); process.exit(1); });
