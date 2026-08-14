/* ══════════════════════════════════════════════════════════════════════════════════════════
   mede_diario_municipal.js — A REGRA DE ECONOMIA APLICADA AO diariomunicipal.com.br
   Fatia A25 · 14/08/2026

   ══ A PERGUNTA, E POR QUE ELA NÃO É "QUANTOS AVISOS TEM LÁ" ════════════════════════════════
   O `diariomunicipal.com.br` (SIGPub, da Vox) é o único diário do alvo 2 com a porta aberta:
   `robots.txt` = `Disallow:` vazio, medido de novo nesta fatia. Mas porta aberta não é motivo
   para construir coletor. A regra de economia que salvou a obra na EBSERH e de novo na BEC/SP
   manda perguntar antes:

       **a fonte publica certame que o PNCP não tem?**

   Se o aviso do diário já está no PNCP, um coletor novo é uma segunda estrada para o mesmo
   lugar — e uma segunda estrada custa manutenção para sempre.

   ══ COMO ESTA MEDIÇÃO RESPONDE, EM QUATRO NÚMEROS QUE NÃO SE SUBSTITUEM ════════════════════
   (A) O AVISO SE DECLARA. O texto do próprio edital diz onde ele está publicado ("www.gov.br/
       pncp", "portaldecompraspublicas", "licitanet"...). É a prova mais forte que existe aqui,
       porque não depende de eu casar nome com nome: é o órgão dizendo.
   (B) O MUNICÍPIO ESTÁ NO PNCP? Para cada município da amostra, uma consulta ao `/api/search/`.
       Município sem NENHUM certame no PNCP seria o achado que justifica coletor.
   (C) O CERTAME ESPECÍFICO ESTÁ NO PNCP? Casamento fino por (município + modalidade + número +
       ano) dentro dos certames daquele município. Este é o número CONSERVADOR: quando ele não
       casa, pode ser que o certame não esteja lá — ou que o número no diário e o número no PNCP
       sejam grandezas diferentes. Ele é declarado como piso, não como verdade.
   (D) O NOSSO ÍNDICE JÁ TEM? Esta conta é sobre a NOSSA coleta, não sobre a fonte. A diferença
       entre (B) e (D) é o trabalho que existe: ampliar a varredura que já temos.

   >>> A ARMADILHA QUE ESTE ARQUIVO NÃO CAI: contar (D) como se fosse (B). Se o nosso índice tem
       pouco daquele município, isso NÃO diz que a fonte é nova — diz que a nossa varredura é
       rasa. Foi exatamente o erro que a A22 evitou em São Paulo, e ele é fácil de cometer porque
       os dois números têm a mesma cara.

   ══ MURALHAS ══════════════════════════════════════════════════════════════════════════════
   Só consulta pública: a mesma página de busca que qualquer pessoa abre, com o token CSRF e o
   cookie que o próprio formulário entrega. Sem login, sem captcha, sem barreira contornada.
   Ritmo educado (a busca do SIGPub leva ~13 s por si só; a pausa é somada a isso).
   Identificação honesta no `User-Agent`, com nome e e-mail — a lição da A22: o formato é de
   navegador porque filtro de portal exige, e o nome vai junto porque o portal tem direito de
   saber quem chama.

     node tools/mede_diario_municipal.js [--assoc amupe] [--de 01/07/2026] [--ate 14/08/2026]
                                         [--meta 50] [--json arquivo.json]
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

/* Ver o cabeçalho: formato de navegador porque o filtro exige, nome e e-mail porque o portal
   tem direito de saber quem está chamando. Tirar a identificação para passar seria a única
   versão disto que eu não escreveria. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
  + 'Chrome/120.0.0.0 Safari/537.36 FPMED-Hospitalar/1.0 (coleta de licitacoes publicas; +licitacao@fpmed.com.br)';

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const ASSOC = arg('--assoc') || 'amupe';
const DE = arg('--de') || '01/07/2026';
const ATE = arg('--ate') || '14/08/2026';
const META = parseInt(arg('--meta') || '50', 10);
const JSON_SAIDA = arg('--json');
const PAUSA = parseInt(arg('--pausa') || '1200', 10);
const dormir = ms => new Promise(r => setTimeout(r, ms));

/* A UF de cada associação do SIGPub. Serve para filtrar a consulta ao PNCP — sem ela, o nome de
   um município pequeno casa com homônimo de outro estado, e o "achei no PNCP" seria falso. */
const UF_DA_ASSOC = { amupe: 'PE', famem: 'MA', aam: 'AM', arom: 'RO', 'amm-mt': 'MT',
  'amm-mg': 'MG', famurs: 'RS', amp: 'PR', apm: 'SP', aprece: 'CE', femurn: 'RN', famup: 'PB',
  agm: 'GO', fgm: 'GO', bahia: 'BA', sergipe: 'SE', ama: 'AL', appm: 'PI', ms: 'MS', amr: 'RR' };

// ══ 1. A CONVERSA COM O SIGPub ════════════════════════════════════════════════════════════
let COOKIE = '';
async function pega(url, timeout) {
  const t0 = Date.now();
  const h = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' };
  if (COOKIE) h.Cookie = COOKIE;
  try {
    const r = await fetch(url, { headers: h, redirect: 'follow', signal: AbortSignal.timeout(timeout || 60000) });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    if (sc.length) COOKIE = sc.map(c => c.split(';')[0]).join('; ');
    return { http: r.status, ms: Date.now() - t0, txt: await r.text() };
  } catch (e) { return { erro: e.name + ': ' + e.message, ms: Date.now() - t0 }; }
}

/* O token é CSRF de sessão e vem no HTML do próprio formulário. Não é chave nem segredo: é o
   que o navegador de qualquer pessoa manda de volta ao clicar em "pesquisar". */
async function pegaToken() {
  const f = await pega(`https://www.diariomunicipal.com.br/${ASSOC}/pesquisar`, 40000);
  if (f.erro) return { erro: f.erro };
  const t = (f.txt.match(/name="busca_avancada\[_token\]"\s+value="([^"]+)"/) || [])[1];
  return t ? { token: t, ms: f.ms } : { erro: 'não achei o token no formulário' };
}

function linhasDaTabela(html) {
  const out = [];
  const tb = (html.match(/<tbody>([\s\S]*?)<\/tbody>/) || [])[1] || '';
  for (const tr of tb.split(/<tr[^>]*>/).slice(1)) {
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
    const href = (tr.match(/href="(\/[^"]*\/load\/([^"\/]+))"/) || []);
    if (tds.length >= 4 && href[2]) {
      out.push({ entidade: tds[0], titulo: tds[1], orgao: tds[2], data: tds[3], codigo: href[2] });
    }
  }
  return out;
}
const totalRegistros = h => Number(((h.match(/de\s+([\d.]+)\s*\n?\s*registros/) || [])[1] || '0').replace(/\./g, ''));

async function busca(token, titulo, texto, pagina) {
  const q = new URLSearchParams();
  q.set('busca_avancada[page]', pagina > 1 ? String(pagina) : '');
  q.set('busca_avancada[entidadeUsuaria]', '');
  q.set('busca_avancada[nome_orgao]', '');
  q.set('busca_avancada[titulo]', titulo || '');
  q.set('busca_avancada[texto]', texto || '');
  q.set('busca_avancada[dataInicio]', DE);
  q.set('busca_avancada[dataFim]', ATE);
  q.set('busca_avancada[_token]', token);
  const r = await pega(`https://www.diariomunicipal.com.br/${ASSOC}/pesquisar?` + q.toString());
  if (r.erro) return { erro: r.erro, ms: r.ms };
  return { linhas: linhasDaTabela(r.txt), total: totalRegistros(r.txt), ms: r.ms };
}

// ══ 2. A MATÉRIA, LIDA ════════════════════════════════════════════════════════════════════
const limpa = s => s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&ordm;/gi, 'º').replace(/&deg;/gi, '°')
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');

const MODALIDADES = 'Pregão Eletrônico|Pregão Presencial|Pregão|Concorrência Eletrônica|Concorrência'
  + '|Chamada Pública|Chamamento Público|Tomada de Preços|Convite|Concurso|Leilão|Credenciamento'
  + '|Dispensa|Inexigibilidade';

/* O QUE ESTE PARSER PROMETE, E O QUE NÃO: o aviso do diário é texto escrito por gente, e nem
   todo município escreve igual. Campo que não sai vira `null` — nunca chute. Um número inventado
   aqui viraria "certame que o PNCP não tem", e a conclusão da fatia inteira sairia errada. */
function leAviso(txt) {
  const t = txt.replace(/[–—]/g, '-');
  const mMod = t.match(new RegExp('(' + MODALIDADES + ')[^\\n]{0,30}?N[ºo°\\.:\\s]{0,6}\\s*(\\d{1,5})\\s*\\/\\s*(\\d{4})', 'i'));
  const mProc = t.match(/Processo[^\n]{0,40}?N[ºo°\.:\s]{0,6}\s*([\d.]+\s*\/\s*\d{4})/i);
  const mVal = t.match(/Valor[^\n]{0,20}?R\$\s*([\d.]+,\d{2})/i);
  const mAbre = t.match(/(?:abertura|sessão)[^\n]{0,120}?(\d{1,2})\s*(?:de\s+([a-zçãéêíóú]+)\s+de|\/)\s*(\d{1,2}|\d{4})[\/\s]*(\d{4})?/i);
  return {
    modalidade: mMod ? mMod[1] : null,
    numero: mMod ? String(parseInt(mMod[2], 10)) : null,
    ano: mMod ? mMod[3] : null,
    processo: mProc ? mProc[1].replace(/\s+/g, '') : null,
    valor: mVal ? Number(mVal[1].replace(/\./g, '').replace(',', '.')) : null,
    abertura_texto: mAbre ? mAbre[0].slice(0, 90) : null,
    /* (A) O AVISO SE DECLARA. `gov.br/pncp` ou `pncp` no corpo é o órgão dizendo onde publicou. */
    cita_pncp: /gov\.br\/pncp|\bpncp\b|portal nacional de contrata/i.test(t),
    cita_portal: (t.match(/portaldecompraspublicas|licitanet|bnc\.org|bllcompras|comprasnet|bbmnet|licitardigital/ig) || [])
      .map(x => x.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i),
    saude: /medicament|hospitalar|farmac|enfermagem|odontolog|saúde|saude|insumo|laboratori|seringa|soro|luva/i.test(t),
  };
}

async function leMateria(codigo) {
  const r = await pega(`https://www.diariomunicipal.com.br/${ASSOC}/load/${codigo}`, 40000);
  if (r.erro) return { erro: r.erro };
  const t = limpa(r.txt);
  const i = t.indexOf('Imprimir a Matéria');
  const j = t.indexOf('Publicado por:');
  const corpo = t.slice(i > -1 ? i + 18 : 0, j > -1 ? j : t.length).trim();
  return Object.assign({ corpo, ms: r.ms }, leAviso(corpo));
}

// ══ 3. O PNCP E O NOSSO ÍNDICE ════════════════════════════════════════════════════════════
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const soMunicipio = e => String(e || '').replace(/^Munic[íi]pio d[eoa]s?\s*/i, '')
  .replace(/\s*Poder Legislativo$/i, '').replace(/^Prefeitura Municipal d[eoa]s?\s*/i, '').trim();

/* ══ QUANTAS PÁGINAS DO PNCP POR MUNICÍPIO, E POR QUE MAIS DE UMA ═══════════════════════════
   A primeira volta desta medição leu UMA página de 100 e o casamento fino deu 46%. O número
   era baixo por defeito da MEDIÇÃO, não da fonte: Escada tem 1.444 certames no PNCP e a página
   trazia 100. "Não achei nas 100 primeiras" estava sendo lido como "não está no PNCP" — que é
   exatamente o erro que a A19 batizou: *não consegui perguntar NUNCA vira não existe*.
   Três páginas cobrem 300 por município. Onde nem isso cobre, o relatório DIZ que não cobriu. */
const PAGINAS_PNCP = parseInt(arg('--paginas') || '3', 10);
const cachePNCP = new Map();
async function pncpDoMunicipio(mun, uf) {
  const k = semAcento(mun) + '|' + uf;
  if (cachePNCP.has(k)) return cachePNCP.get(k);
  let out = { total: 0, itens: [], erro: null, lidos: 0, coberto: false };
  for (let pag = 1; pag <= PAGINAS_PNCP; pag++) {
    const u = 'https://pncp.gov.br/api/search/?q=' + encodeURIComponent(mun)
      + '&tipos_documento=edital&pagina=' + pag + '&tam_pagina=100&status=todos&ufs=' + uf;
    try {
      const r = await fetch(u, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) { out.erro = 'HTTP ' + r.status; break; }
      const j = await r.json();
      out.total = Number(j.total) || 0;
      const lote = j.items || [];
      out.lidos += lote.length;
      /* O `q` é textual e traz vizinho: filtra pelo nome exato do município, sem acento. Sem
         isto, "Bom Jardim" casaria com "Bom Jardim de Minas" e o achado seria falso. */
      out.itens = out.itens.concat(lote.filter(i => semAcento(i.municipio_nome) === semAcento(mun)));
      if (lote.length < 100) break;
    } catch (e) { out.erro = e.name; break; }
    if (pag < PAGINAS_PNCP) await dormir(700);
  }
  out.coberto = out.lidos >= out.total;   // li tudo que o PNCP tem daquele município?
  cachePNCP.set(k, out);
  return out;
}

const cacheIndice = new Map();
async function indiceDoMunicipio(mun, uf) {
  const k = semAcento(mun) + '|' + uf;
  if (cacheIndice.has(k)) return cacheIndice.get(k);
  const esc = String(mun).replace(/[%,()*]/g, ' ');
  const q = `licitacoes?select=numero_controle,objeto,ano,modalidade&uf=eq.${uf}`
    + `&municipio=ilike.${encodeURIComponent(esc)}&limit=200`;
  let out = [];
  try {
    const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H });
    if (r.ok) out = await r.json();
  } catch (e) { /* índice fora é "não sei", não é "não tem" — ver o assert da A19 */ }
  cacheIndice.set(k, out);
  return out;
}

/* (C) O CASAMENTO FINO, E O QUE ELE VALE. O `title` do PNCP é "Edital nº N/ANO". O aviso do
   diário traz "Pregão Eletrônico Nº N/ANO". Quando N e o ano batem no MESMO município, é o
   mesmo certame com altíssima probabilidade — mas não é certeza, porque numeração de edital e
   numeração de processo são grandezas que alguns municípios misturam. Por isso este número
   entra no relatório como PISO, e três casos são conferidos à mão. */
function casaFino(aviso, itensPNCP) {
  /* DOIS NÚMEROS, PORQUE O MUNICÍPIO ESCREVE OS DOIS. O aviso traz "Pregão Eletrônico Nº 2/2026"
     E "Processo Nº 00008/2026", e o PNCP guarda UM deles no `title` — qual, depende de quem
     cadastrou. Tentar só um seria decidir por ele. */
  const chaves = [];
  if (aviso.numero && aviso.ano) chaves.push([aviso.numero, aviso.ano]);
  if (aviso.processo) {
    const m = String(aviso.processo).match(/(\d+)\s*\/\s*(\d{4})/);
    if (m) chaves.push([String(parseInt(m[1], 10)), m[2]]);
  }
  for (const [n, a] of chaves) {
    const alvo = new RegExp('n[ºo°\\.:\\s]{0,4}\\s*0*' + n + '\\s*\\/\\s*' + a + '(?!\\d)', 'i');
    const achou = itensPNCP.find(i => alvo.test(String(i.title || '')));
    if (achou) return achou;
  }
  return null;
}

// ══ 4. A MEDIÇÃO ══════════════════════════════════════════════════════════════════════════
/* Título "AVISO" porque a fatia pede o AVISO de licitação — o diário é dominado por extrato de
   aditivo, resultado de julgamento e homologação, que são o DEPOIS do certame e não servem para
   quem quer disputar. Os textos são os do ramo, os mesmos seis da coleta do índice. */
const TERMOS = ['medicamento', 'hospitalar', 'material médico', 'farmacêutico', 'saúde', 'insumo'];

(async () => {
  const uf = UF_DA_ASSOC[ASSOC];
  console.log('═══ diariomunicipal.com.br (SIGPub) — a regra de economia da fatia A25 ═══\n');
  console.log(`associação: ${ASSOC}${uf ? ' (' + uf + ')' : ''} · janela ${DE} a ${ATE} · meta ${META} avisos de saúde\n`);
  if (!uf) { console.error('não sei a UF desta associação — acrescente em UF_DA_ASSOC.'); process.exit(1); }

  // robots, medido de novo e não confiado ao que ficou escrito antes
  const rb = await pega('https://www.diariomunicipal.com.br/robots.txt', 20000);
  const liberado = !rb.erro && /User-agent:\s*\*/i.test(rb.txt) && /Disallow:\s*$/im.test(rb.txt);
  console.log(`robots.txt: HTTP ${rb.http} · ${liberado ? 'LIBERADO (Disallow vazio)' : 'ATENÇÃO — leia antes de seguir'}`);
  if (!liberado) { console.error('\nA porta não está aberta. Parando aqui — nunca se insiste.'); process.exit(1); }

  const tk = await pegaToken();
  if (tk.erro) { console.error('formulário de busca: ' + tk.erro); process.exit(1); }
  console.log(`formulário de busca: token ok · ${tk.ms} ms\n`);

  /* ══ REAPROVEITAR A AMOSTRA JÁ COLHIDA ═══════════════════════════════════════════════════
     A colheita no SIGPub custa ~15 minutos (a busca dele leva 13 s por página, e isso é dele,
     não nosso). Quando o que mudou foi o CASAMENTO — e mudou: a primeira volta lia 100
     certames por município e agora lê 300 —, repetir a colheita seria bater de novo num portal
     público para reler o que já está no disco. `--recasar` refaz só a conta. */
  const RECASAR = arg('--recasar');
  if (RECASAR) {
    const j = JSON.parse(fs.readFileSync(path.join(RAIZ, RECASAR), 'utf8'));
    console.log(`── recasando a amostra já colhida (${RECASAR}: ${j.detalhe.length} avisos de saúde) ──`);
    const saude = j.detalhe.map(d => Object.assign({}, d, { saude: true }));
    const muns = [...new Set(saude.map(a => a.municipio))];
    let munNoPNCP = 0, casados = 0, semNumero = 0, cobertos = 0;
    for (const m of muns) {
      await dormir(500);
      const r = await pncpDoMunicipio(m, uf);
      console.log(`  ${m}: ${r.erro ? 'ERRO ' + r.erro : r.total + ' no PNCP · li ' + r.lidos
        + (r.coberto ? ' (COBERTO)' : ' (parcial)')}`);
    }
    /* ══ A CONTA MAIS LIMPA, E ELA PRECISA SER SEPARADA ═══════════════════════════════════
       Município cujo PNCP foi lido POR INTEIRO responde a pergunta certa: "este certame está
       no PNCP?" — sim ou não, sem terceira possibilidade. Município lido pela metade responde
       outra coisa: "está nas 500 primeiras?", e o "não" dele é ambíguo. Misturar os dois
       rebaixa a medição inteira ao pior dos dois — foi o que a primeira volta fez. */
    let legCob = 0, casCob = 0;
    for (const a of saude) {
      const p = await pncpDoMunicipio(a.municipio, uf);
      if (!p.erro && p.itens.length) munNoPNCP++;
      if (p.coberto) cobertos++;
      const casa = casaFino(a, p.itens);
      const legivel = !!(a.numero || a.processo);
      if (!legivel) semNumero++; else if (casa) { casados++; a.pncp_casou = casa.numero_controle_pncp; }
      if (legivel && p.coberto) { legCob++; if (casa) casCob++; }
      a.pncp_coberto = !!p.coberto;
    }
    const pct = (x, d) => d ? Math.round(x / d * 100) : 0;
    const legiveis = saude.length - semNumero;
    console.log(`\n  avisos de saúde ................... ${saude.length}`);
    console.log(`  município no PNCP ................. ${munNoPNCP}  (${pct(munNoPNCP, saude.length)}%)`);
    console.log(`  com número legível ................ ${legiveis}`);
    console.log(`  CASARAM com certame do PNCP ....... ${casados}  (${pct(casados, legiveis)}% dos legíveis)`);
    console.log(`  avisos cujo município foi lido POR INTEIRO no PNCP: ${cobertos}`);
    console.log(`\n  >>> sobreposição fina, TODOS os legíveis .......... ${pct(casados, legiveis)}%  (${casados}/${legiveis})`);
    console.log(`  >>> sobreposição fina, SÓ onde li o PNCP inteiro .. ${pct(casCob, legCob)}%  (${casCob}/${legCob})`);
    console.log('      (a segunda é a que responde "está no PNCP?" sem ambiguidade — na primeira,');
    console.log('       "não achei" pode ser "não li tudo")');
    fs.writeFileSync(path.join(RAIZ, RECASAR.replace(/\.json$/, '') + '_recasado.json'),
      JSON.stringify({ saude: saude.length, munNoPNCP, casados, legiveis, cobertos,
        legiveis_cobertos: legCob, casados_cobertos: casCob,
        pct: pct(casados, legiveis), pct_cobertos: pct(casCob, legCob), detalhe: saude }, null, 2));
    console.log(`  (detalhe em ${RECASAR.replace(/\.json$/, '')}_recasado.json)`);
    return;
  }

  // ── amostra ────────────────────────────────────────────────────────────────────────────
  const achados = new Map();
  console.log('── colhendo a amostra (título "AVISO" × termo do ramo) ──');
  for (const termo of TERMOS) {
    if (achados.size >= META) break;
    for (let pag = 1; pag <= 4 && achados.size < META; pag++) {
      await dormir(PAUSA);
      const r = await busca(tk.token, 'AVISO', termo, pag);
      if (r.erro) { console.log(`  "${termo}" p.${pag}: ERRO ${r.erro}`); break; }
      let novos = 0;
      for (const l of r.linhas) if (!achados.has(l.codigo)) { achados.set(l.codigo, Object.assign({ termo }, l)); novos++; }
      console.log(`  "${termo}" p.${pag}: ${r.total} registro(s) na fonte · ${r.linhas.length} na página · ${novos} novo(s) · ${(r.ms / 1000).toFixed(1)}s`);
      if (r.linhas.length < 10) break;
    }
  }
  const amostra = [...achados.values()];
  console.log(`\namostra: ${amostra.length} matéria(s) única(s)`
    + (amostra.length >= META ? `  (>= ${META}, como a regra pede)` : `  (< ${META} — a regra pede ${META}; DECLARADO)`));

  // ── leitura de cada aviso ──────────────────────────────────────────────────────────────
  console.log('\n── lendo cada matéria ──');
  const avisos = [];
  for (let i = 0; i < amostra.length; i++) {
    const a = amostra[i];
    await dormir(600);
    const m = await leMateria(a.codigo);
    if (m.erro) { console.log(`  [${i + 1}/${amostra.length}] ${a.codigo}: ERRO ${m.erro}`); continue; }
    avisos.push(Object.assign({}, a, m, { municipio: soMunicipio(a.entidade) }));
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${amostra.length} lidas`);
  }
  const saude = avisos.filter(a => a.saude);
  console.log(`  lidas ${avisos.length} · de saúde ${saude.length}`);

  // ── (A) o aviso se declara ─────────────────────────────────────────────────────────────
  const citam = saude.filter(a => a.cita_pncp).length;
  console.log('\n══ (A) O QUE O PRÓPRIO AVISO DIZ ════════════════════════════════════════════');
  console.log(`  avisos de saúde na amostra ......... ${saude.length}`);
  console.log(`  que citam o PNCP no próprio texto .. ${citam}  (${saude.length ? Math.round(citam / saude.length * 100) : 0}%)`);
  const portais = {};
  saude.forEach(a => (a.cita_portal || []).forEach(p => portais[p] = (portais[p] || 0) + 1));
  console.log('  portais citados: ' + (Object.entries(portais).sort((a, b) => b[1] - a[1])
    .map(([p, n]) => `${p} ${n}`).join(' · ') || '(nenhum)'));

  // ── (B) (C) (D) ────────────────────────────────────────────────────────────────────────
  console.log('\n── perguntando ao PNCP, um município por vez ──');
  const muns = [...new Set(saude.map(a => a.municipio))];
  for (const m of muns) { await dormir(900); const r = await pncpDoMunicipio(m, uf);
    console.log(`  ${m}: ${r.erro ? 'ERRO ' + r.erro : r.total + ' certame(s) no PNCP · ' + r.itens.length + ' na página deste município'}`); }

  let munNoPNCP = 0, casados = 0, semNumero = 0, noNosso = 0;
  const detalhe = [];
  for (const a of saude) {
    const p = await pncpDoMunicipio(a.municipio, uf);
    const ix = await indiceDoMunicipio(a.municipio, uf);
    const temMun = !p.erro && p.itens.length > 0;
    if (temMun) munNoPNCP++;
    const casa = temMun ? casaFino(a, p.itens) : null;
    if (!a.numero) semNumero++; else if (casa) casados++;
    if (ix.length) noNosso++;
    detalhe.push({ codigo: a.codigo, municipio: a.municipio, titulo: a.titulo, data: a.data,
      modalidade: a.modalidade, numero: a.numero, ano: a.ano, processo: a.processo, valor: a.valor,
      cita_pncp: a.cita_pncp, pncp_municipio: p.total, pncp_casou: casa ? casa.numero_controle_pncp : null,
      indice_municipio: ix.length });
  }

  const pct = (n, d) => d ? Math.round(n / d * 100) : 0;
  console.log('\n══ (B) O MUNICÍPIO DO AVISO ESTÁ NO PNCP? ═══════════════════════════════════');
  console.log(`  municípios distintos na amostra .... ${muns.length}`);
  console.log(`  avisos cujo município tem certame no PNCP: ${munNoPNCP} de ${saude.length}  (${pct(munNoPNCP, saude.length)}%)`);

  console.log('\n══ (C) O CERTAME ESPECÍFICO, CASADO POR NÚMERO+ANO ══════════════════════════');
  console.log(`  avisos com número legível no texto . ${saude.length - semNumero}`);
  console.log(`  casaram com um certame do PNCP ..... ${casados}  (${pct(casados, saude.length - semNumero)}% dos legíveis)`);
  console.log('  >>> ESTE NÚMERO É PISO, NÃO VERDADE: a página do PNCP por município traz 100');
  console.log('      certames, e municípios grandes têm mais. Não casar aqui pode ser "está lá,');
  console.log('      fora da página" — por isso (A) e (B) mandam mais que (C).');

  console.log('\n══ (D) E O NOSSO ÍNDICE? (conta sobre a NOSSA coleta, não sobre a fonte) ════');
  console.log(`  avisos cujo município já aparece no nosso índice: ${noNosso} de ${saude.length}  (${pct(noNosso, saude.length)}%)`);

  // ── o veredito da regra de economia ────────────────────────────────────────────────────
  const sobre = Math.max(pct(citam, saude.length), pct(munNoPNCP, saude.length));
  console.log('\n══ VEREDITO DA REGRA DE ECONOMIA ════════════════════════════════════════════');
  console.log(`  sobreposição medida com o PNCP: ${sobre}%  (o maior entre (A) e (B))`);
  console.log(sobre >= 80
    ? '  >= 80% -> NÃO CONSTRUIR COLETOR. Registrar em docs/plano_fontes.md e parar.'
    : '  < 80% -> a fonte tem conteúdo próprio: construir coletor separado, mesma tabela,\n'
      + '     selo de origem próprio, chave própria (o Código Identificador do SIGPub).');

  if (JSON_SAIDA) {
    fs.writeFileSync(path.join(RAIZ, JSON_SAIDA), JSON.stringify({
      assoc: ASSOC, uf, de: DE, ate: ATE, amostra: amostra.length, lidas: avisos.length,
      saude: saude.length, citam_pncp: citam, municipios: muns.length, mun_no_pncp: munNoPNCP,
      casados, sem_numero: semNumero, no_nosso_indice: noNosso, sobreposicao: sobre, detalhe,
    }, null, 2));
    console.log(`\n  (detalhe gravado em ${JSON_SAIDA} — é dele que saem os 3 conferidos à mão)`);
  }
})().catch(e => { console.error('ERRO: ' + e.message + '\n' + e.stack); process.exit(1); });
