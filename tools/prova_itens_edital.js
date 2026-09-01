// ============================================================
// prova_itens_edital.js — PROVA da extracao de itens: quantos itens o edital TEM x quantos a IA
// achou. Roda contra a edge function DE VERDADE, com login de verdade, e gasta credito de
// verdade (a leitura fica registrada em usos_ia como qualquer outra).
//
// ══ POR QUE ESTA PROVA E DIFERENTE DA PROVA DE CUSTO ════════════════════════════════════════
// A prova de custo respondia "quanto custa". Esta responde a pergunta que decide se a funcao
// serve: **ela pegou TODOS os itens?** E essa pergunta so tem valor com uma resposta certa do
// lado de fora — senao a conferencia vira "a IA disse 40, e eu acredito".
//
// O GABARITO E O PROPRIO PNCP. A mesma compra tem uma API de itens
// (/orgaos/{cnpj}/compras/{ano}/{seq}/itens) que devolve a relacao OFICIAL, item a item, com
// numero, descricao, quantidade e unidade. Ela e a fonte que a tela de Licitacoes ja usa pra
// cruzar contra o estoque. Entao da pra medir a extracao contra um numero que nao saiu da IA:
//   · o PNCP diz que a compra tem N itens;
//   · a IA leu o PDF e devolveu M;
//   · e da pra ir alem do numero e conferir QUAIS numeros de item bateram.
//
// >>> O GABARITO NAO E PERFEITO, E ISSO IMPORTA. O PDF lido e o EDITAL; a lista do PNCP e o que
//     o orgao cadastrou no sistema. Normalmente sao a mesma relacao, mas nao ha garantia: o
//     anexo de itens as vezes esta em ARQUIVO SEPARADO (planilha), e ai o edital legitimamente
//     nao tem a tabela. Por isso o script imprime os dois lados e a divergencia item a item, em
//     vez de cuspir "passou/nao passou" — quem le decide o que a divergencia significa.
//
// USO:
//   node tools/prova_itens_edital.js                    (acha um edital de MEDICAMENTO no indice)
//   node tools/prova_itens_edital.js --pncp <numero>    (uma compra especifica do nosso indice)
//   node tools/prova_itens_edital.js --so-achar         (so procura e mostra; ZERO credito gasto)
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const EDGE = SB + '/functions/v1/ler-edital';
const ORIGEM = 'https://fpmed-hospitalar.github.io';

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = (n) => process.argv.includes(n);

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const ANON = (seg.match(/anon[\s\S]{0,200}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

// A CHAMADA VAI COM O LOGIN DO GESTOR — que e quem tem a permissao. Chamar com service_role
// mediria uma porta que nenhum usuario atravessa: o gate confere o JWT do USUARIO.
async function tokenDoGestor() {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'licitacao@fpmed.com.br', password: SENHA }),
  });
  const j = await r.json();
  return j.access_token || null;
}

/* ══ "01" E "1" SAO O MESMO ITEM ═════════════════════════════════════════════════════════════
   A 1a rodada desta prova acusou 74% de cobertura num resultado que era 100%: o PNCP guarda o
   item como `1` e o edital imprime `01`, e eu comparei os dois como texto. O erro era MEU, e
   nao da extracao — a IA fez exatamente o que o prompt manda, que e copiar o numero COMO ESTA
   ESCRITO no documento.
   >>> E o prompt continua mandando copiar, de proposito. Numero do item e o que o pregoeiro
       chama em voz alta na sessao; normalizar na origem faria a nossa planilha discordar do
       edital na hora de dar lance. Quem normaliza e quem COMPARA — aqui, e so aqui. */
function normNum(v) {
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/^0*(\d+)$/);              // "01" -> "1"; "1.2" e "3-A" ficam como estao
  return m ? m[1] : s.toUpperCase();
}

async function cotacaoDolar() {
  try {
    const r = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL', { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const v = parseFloat(j.USDBRL && j.USDBRL.bid);
    return isFinite(v) && v > 0 ? v : null;
  } catch (e) { return null; }
}

// Medicamento, e nao "qualquer edital": a extracao de itens de material de escritorio nao prova
// nada sobre a que vai virar proposta. A palavra tem que estar no OBJETO da compra.
const PALAVRAS_MED = 'medicamento|farmac|remedio|remédio|injet|comprimido|ampola|frasco|soro|antibiotic';

async function candidatos() {
  const alvo = arg('--pncp');
  const filtro = alvo
    ? `&numero_controle=eq.${encodeURIComponent(alvo)}`
    : `&objeto=ilike.*medicament*`;
  const r = await fetch(`${SB}/rest/v1/licitacoes?select=cnpj,ano,sequencial,orgao,objeto,numero_controle,valor_estimado`
    + `${filtro}&order=valor_estimado.desc&limit=25`, { headers: H });
  if (!r.ok) throw new Error('nao consegui ler o indice: HTTP ' + r.status);
  return await r.json();
}

// O GABARITO. Pagina de 500, porque compra de medicamento com 300 itens e comum e uma pagina so
// devolveria um gabarito menor que a verdade — que e exatamente o erro que esta prova procura.
async function itensOficiais(l) {
  const out = [];
  for (let pag = 1; pag <= 6; pag++) {
    const u = `https://pncp.gov.br/api/pncp/v1/orgaos/${l.cnpj}/compras/${l.ano}/${l.sequencial}/itens`
      + `?pagina=${pag}&tamanhoPagina=500`;
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

/* QUAL PDF LER — a 1a rodada desta prova escolheu uma "Resposta de Esclarecimento" e teria
   medido a extracao de itens contra um documento que nao tem tabela de itens. O primeiro PDF da
   lista nao e o edital: e o primeiro que o orgao subiu, e orgao sobe esclarecimento, aviso,
   impugnacao e ata na mesma pasta.
   Entao vale PONTUACAO, e nao "o primeiro": o que promete tabela de itens sobe, o que
   comprovadamente nao tem cai pra baixo de zero (e e descartado). */
function notaDoArquivo(nome) {
  const n = String(nome || '').toLowerCase();
  if (/esclarecim|impugna|recurso|ata[ _-]|aviso|errata|resultado|contrato|respost/.test(n)) return -1;
  let s = 0;
  if (/edital/.test(n)) s += 3;
  if (/termo[ _-]?de[ _-]?refer|anexo[ _-]?i\b|relacao|rela[cç][aã]o|itens|planilha|lote/.test(n)) s += 4;
  if (/medicament|farmac/.test(n)) s += 1;
  return s;
}
async function pdfDoEdital(l, verboso) {
  const u = `https://pncp.gov.br/api/pncp/v1/orgaos/${l.cnpj}/compras/${l.ano}/${l.sequencial}/arquivos`;
  const r = await fetch(u, { signal: AbortSignal.timeout(25000) });
  if (!r.ok) return null;
  const arqs = await r.json();
  const pdfs = (Array.isArray(arqs) ? arqs : [])
    .map(a => ({ a, nome: a.titulo || a.nomeArquivo || '' }))
    .filter(x => /\.pdf$/i.test(x.nome))
    .map(x => ({ ...x, nota: notaDoArquivo(x.nome) }));
  if (verboso) pdfs.forEach(x => console.log(`      [${x.nota >= 0 ? x.nota : 'x'}] ${x.nome}`));
  const bons = pdfs.filter(x => x.nota >= 0).sort((p, q) => q.nota - p.nota);
  return bons.length ? bons[0].a : null;
}

// O MESMO pdf.js do navegador, agrupando por Y pra preservar a LINHA. Numa tabela de itens a
// linha e tudo: e ela que amarra o numero do item a quantidade e a unidade. Extracao que
// embaralha coluna com coluna entrega uma tabela que parece certa e nao e.
async function pdfParaTexto(buf) {
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  // isEvalSupported:false (A50, 01/09/2026) — a mesma catraca das telas, que passava longe daqui
  // porque `testa_pdfjs_eval` so varria .html. Em Node o estrago e MAIOR que no navegador: la o
  // script preparado fica preso na aba, aqui ele nasce dentro do processo que le o edital.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, isEvalSupported: false }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const linhas = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const x = it.transform[4], y = it.transform[5];
      let alvo = linhas.find(li => Math.abs(li.y - y) <= 2.5);
      if (!alvo) { alvo = { y, itens: [] }; linhas.push(alvo); }
      alvo.itens.push({ x, str: it.str });
    }
    linhas.sort((a, b) => b.y - a.y);
    out += linhas.map(li => li.itens.sort((a, b) => a.x - b.x).map(i => i.str).join(' ')).join('\n') + '\n';
  }
  return { texto: out, paginas: doc.numPages };
}

/* ── REFAZER A CONFERENCIA SEM PAGAR DE NOVO ─────────────────────────────────────────────────
   A leitura ja aconteceu e esta gravada em backups/. Quando o defeito esta no COMPARADOR — e foi
   o que aconteceu em 11/08 com o "01" x "1" — repetir a chamada seria gastar credito de novo pra
   corrigir um erro que nao esta do lado da IA. `--conferir <json>` reconfere o que ja foi lido. */
async function reconferir(arqJson) {
  const p = JSON.parse(fs.readFileSync(arqJson, 'utf8'));
  const lidos = (p.dados && p.dados.itens) || [];
  console.log(`=== RECONFERINDO ${path.basename(arqJson)} (leitura de ${p.quando}) ===`);
  console.log(`compra ${p.pncp} · ${p.orgao}`);
  console.log(`PNCP declarou ${p.oficiais} itens; a leitura devolveu ${lidos.length}.`);
  const oficiais = await itensOficiais({ cnpj: p.pncp.split('-')[0], ano: p.pncp.slice(-4), sequencial: Number(p.pncp.split('-')[2].split('/')[0]) });
  if (!oficiais) { console.error('nao consegui rebuscar o gabarito no PNCP agora.'); process.exit(1); }
  const numOf = new Set(oficiais.map(o => normNum(o.numeroItem)));
  const numIA = new Set(lidos.map((x, k) => normNum(x.n != null && x.n !== '' ? x.n : (k + 1))));
  const faltando = [...numOf].filter(n => !numIA.has(n));
  const sobrando = [...numIA].filter(n => !numOf.has(n));
  const porNum = new Map(oficiais.map(o => [normNum(o.numeroItem), o]));
  let qtdOk = 0, qtdDif = 0; const div = [];
  lidos.forEach((x, k) => {
    const o = porNum.get(normNum(x.n != null && x.n !== '' ? x.n : (k + 1)));
    if (!o) return;
    const a = Number(x.quantidade), b = Number(o.quantidade);
    if (!isFinite(a) || !isFinite(b)) return;
    if (Math.abs(a - b) < 0.001) qtdOk++;
    else { qtdDif++; if (div.length < 12) div.push(`  item ${o.numeroItem}: PNCP ${b} x IA ${a} — ${String(o.descricao || '').slice(0, 60)}`); }
  });
  console.log(`\nPNCP .............. ${oficiais.length} itens`);
  console.log(`IA ................ ${lidos.length} itens`);
  console.log(`cobertura ......... ${oficiais.length ? Math.round(100 * (oficiais.length - faltando.length) / oficiais.length) : 0}%`);
  if (faltando.length) console.log(`NAO vieram (${faltando.length}) ... ${faltando.slice(0, 40).join(', ')}`);
  if (sobrando.length) console.log(`so na IA (${sobrando.length}) ..... ${sobrando.slice(0, 40).join(', ')}`);
  console.log(`quantidade confere  ${qtdOk} · DIVERGE em ${qtdDif}`);
  div.forEach(l => console.log(l));
  console.log(`\ncusto desta leitura (ja pago, nada novo gasto agora): R$ ${Number(p.brl || 0).toFixed(4)}`);
}

(async () => {
  if (arg('--conferir')) return reconferir(arg('--conferir'));
  console.log('=== PROVA DA EXTRACAO DE ITENS — o edital tem quantos x a IA achou quantos ===\n');

  const lista = await candidatos();
  console.log(`${lista.length} compra(s) candidata(s) no nosso indice.`);

  // Procura uma que tenha as DUAS coisas: gabarito (itens no PNCP) e PDF que caiba na leitura.
  let escolhida = null;
  for (const l of lista) {
    if (!arg('--pncp') && !new RegExp(PALAVRAS_MED, 'i').test(String(l.objeto || ''))) continue;
    process.stdout.write(`  ${l.numero_controle}... `);
    let oficiais = null;
    try { oficiais = await itensOficiais(l); } catch (e) { console.log('itens: ' + e.name); continue; }
    if (!oficiais || !oficiais.length) { console.log('sem itens no PNCP'); continue; }
    console.log(`${oficiais.length} itens no PNCP; arquivos:`);
    let arqv = null;
    try { arqv = await pdfDoEdital(l, true); } catch (e) { /* segue */ }
    if (!arqv) { console.log('      (nenhum PDF serve — só esclarecimento/ata/aviso)'); continue; }
    console.log(`      >>> ESCOLHIDA: ${arqv.titulo || arqv.nomeArquivo}`);
    escolhida = { lic: l, oficiais, arquivo: arqv };
    break;
  }
  if (!escolhida) { console.error('\nnao achei uma compra de medicamento com itens no PNCP E PDF agora.'); process.exit(1); }

  const { lic, oficiais, arquivo } = escolhida;
  const url = arquivo.url || arquivo.uri || arquivo.link;
  console.log(`\norgao ..... ${lic.orgao}`);
  console.log(`objeto .... ${String(lic.objeto || '').slice(0, 140)}`);
  console.log(`PNCP ...... ${lic.numero_controle}`);
  console.log(`arquivo ... ${arquivo.titulo || arquivo.nomeArquivo}`);
  console.log(`>>> GABARITO DO PNCP: ${oficiais.length} itens`);

  console.log('\nbaixando o PDF...');
  const rp = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!rp.ok) { console.error('download HTTP ' + rp.status); process.exit(1); }
  const buf = Buffer.from(await rp.arrayBuffer());
  const mb = buf.length / 1024 / 1024;
  console.log(`baixado: ${mb.toFixed(2)} MB`);

  console.log('extraindo o texto (o mesmo pdf.js do navegador)...');
  const ex = await pdfParaTexto(buf);
  console.log(`  ${ex.paginas} paginas · ${ex.texto.length.toLocaleString('pt-BR')} caracteres`);

  if (tem('--so-achar')) { console.log('\n--so-achar: nada foi enviado, zero credito gasto.'); return; }

  const tok = await tokenDoGestor();
  if (!tok) { console.error('nao consegui logar como licitacao@fpmed.com.br — abortando.'); process.exit(1); }

  // O HIBRIDO, igual ao da tela: texto quando ha texto, PDF inteiro quando nao ha.
  const corpo = {
    tarefa: 'itens', titulo: arquivo.titulo || arquivo.nomeArquivo, url, mb: +mb.toFixed(2),
    cambio: await cotacaoDolar(), paginas: ex.paginas, chars: ex.texto.length,
  };
  if (ex.texto.trim().length >= 500) { corpo.modo = 'texto'; corpo.texto = ex.texto; }
  else { corpo.modo = 'pdf-nativo'; corpo.motivo = 'extracao-pobre'; corpo.pdfBase64 = buf.toString('base64'); }
  console.log(`\nchamando a edge function (modo ${corpo.modo}, tarefa itens)...`);

  const t0 = Date.now();
  const r = await fetch(EDGE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGEM, Authorization: 'Bearer ' + tok },
    body: JSON.stringify(corpo), signal: AbortSignal.timeout(600000),
  });
  const segundos = Math.round((Date.now() - t0) / 1000);
  const txt = await r.text();
  if (!r.ok) { console.error('HTTP ' + r.status + ' ' + txt.slice(0, 400)); process.exit(1); }
  const j = JSON.parse(txt);

  console.log('\n=== O QUE CUSTOU ===');
  console.log(`tempo ............. ${segundos}s`);
  if (j.usage) console.log(`tokens ............ ${j.usage.entrada.toLocaleString('pt-BR')} entrada · ${j.usage.saida.toLocaleString('pt-BR')} saida`);
  console.log(`custo ............. ${j.brl != null ? 'R$ ' + Number(j.brl).toFixed(4) : 'US$ ' + Number(j.usd || 0).toFixed(4)}`);
  console.log(`registro .......... usos_ia nº ${j.leituraId}`);

  if (j.ok === false) {
    // ISTO TAMBEM E RESULTADO, e nao falha do script. "A tabela nao coube" e a resposta honesta
    // do desenho, e ela precisa aparecer no relatorio com o custo junto.
    console.log('\n=== A LEITURA FOI RECUSADA ===');
    console.log(j.erro);
    console.log('\n>>> A funcao preferiu nao entregar nada a entregar meia tabela. O credito gasto ate o');
    console.log('    corte foi cobrado e esta registrado acima.');
    return;
  }

  const d = j.dados || {};
  const lidos = Array.isArray(d.itens) ? d.itens : [];
  console.log('\n=== O QUE A IA ACHOU ===');
  console.log(`tabela encontrada . ${d.tabela_encontrada === false ? 'NAO' : 'sim'}${d.onde ? ' (' + d.onde + ')' : ''}`);
  console.log(`itens extraidos ... ${lidos.length}`);
  if (d.observacao) console.log(`observacao ........ ${d.observacao}`);

  // ── A CONFERENCIA ─────────────────────────────────────────────────────────────────────────
  // Numero contra numero primeiro, depois QUAIS. "40 de 42" nao diz se faltaram dois do fim ou
  // dois do meio — e faltar do meio e o sintoma de tabela que virou pagina e nao foi seguida.
  const numOf = new Set(oficiais.map(o => normNum(o.numeroItem)));
  const numIA = new Set(lidos.map((x, k) => normNum(x.n != null && x.n !== '' ? x.n : (k + 1))));
  const faltando = [...numOf].filter(n => !numIA.has(n));
  const sobrando = [...numIA].filter(n => !numOf.has(n));

  console.log('\n=== CONFERENCIA CONTRA O PNCP ===');
  console.log(`PNCP .............. ${oficiais.length} itens`);
  console.log(`IA ................ ${lidos.length} itens`);
  console.log(`cobertura ......... ${oficiais.length ? Math.round(100 * (oficiais.length - faltando.length) / oficiais.length) : 0}% dos numeros de item do PNCP apareceram na leitura`);
  if (faltando.length) console.log(`NAO vieram (${faltando.length}) ... ${faltando.slice(0, 40).join(', ')}${faltando.length > 40 ? ' ...' : ''}`);
  if (sobrando.length) console.log(`so na IA (${sobrando.length}) ..... ${sobrando.slice(0, 40).join(', ')}${sobrando.length > 40 ? ' ...' : ''}`);

  // Quantidade e o campo que vira dinheiro: um item certo com quantidade errada e pior que um
  // item faltando, porque o faltando alguem nota.
  let qtdOk = 0, qtdDif = 0;
  const porNum = new Map(oficiais.map(o => [normNum(o.numeroItem), o]));
  const divergencias = [];
  for (let k = 0; k < lidos.length; k++) {
    const x = lidos[k];
    const o = porNum.get(normNum(x.n != null && x.n !== '' ? x.n : (k + 1)));
    if (!o) continue;
    const a = Number(x.quantidade), b = Number(o.quantidade);
    if (!isFinite(a) || !isFinite(b)) continue;
    if (Math.abs(a - b) < 0.001) qtdOk++;
    else { qtdDif++; if (divergencias.length < 12) divergencias.push(`  item ${o.numeroItem}: PNCP ${b} x IA ${a} — ${String(o.descricao || '').slice(0, 60)}`); }
  }
  console.log(`\nquantidade confere  ${qtdOk} item(ns) · DIVERGE em ${qtdDif}`);
  if (divergencias.length) { console.log('divergencias de quantidade (primeiras):'); divergencias.forEach(l2 => console.log(l2)); }

  console.log('\n=== PRIMEIROS 5 ITENS LIDOS ===');
  lidos.slice(0, 5).forEach((x, k) => console.log(`  [${x.n != null ? x.n : k + 1}] ${String(x.descricao || '').slice(0, 90)} · ${x.quantidade} ${x.unidade || ''} · unit ${x.valor_unitario == null ? '—' : x.valor_unitario}`));

  const destino = path.join(RAIZ, 'backups', 'prova_itens_' + lic.numero_controle.replace(/[^\w-]/g, '_') + '.json');
  try {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, JSON.stringify({
      quando: new Date().toISOString(), pncp: lic.numero_controle, orgao: lic.orgao, objeto: lic.objeto,
      arquivo: arquivo.titulo || arquivo.nomeArquivo, url, mb: +mb.toFixed(2), paginas: ex.paginas,
      modo: corpo.modo, segundos, usage: j.usage, usd: j.usd, brl: j.brl, leituraId: j.leituraId,
      oficiais: oficiais.length, extraidos: lidos.length, faltando, sobrando, qtdOk, qtdDif,
      dados: d,
    }, null, 1), 'utf8');
    console.log('\nprova gravada em backups/' + path.basename(destino) + ' (gitignored)');
  } catch (e) { /* o log e conforto */ }
})().catch(e => { console.error('ERRO: ' + (e && e.message)); process.exit(1); });
