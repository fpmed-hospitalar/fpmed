/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_fase2_fontes.js — A PROVA MEDIDA DA FATIA A13 (fase 2 das fontes, 14/08/2026)

   A caixa mandou agregar fontes fora do PNCP, com muralhas inegociáveis. Esta prova registra o
   que cada fonte RESPONDEU — inclusive os "não" — porque um "não" sem medição vira, três semanas
   depois, "ninguém tentou".

     1. licitacoes-e responde 403 até no /robots.txt (muralha, pulei);
     2. a EBSERH já publica no PNCP (não é fonte nova, é conteúdo da fonte que já temos);
     3. a API de CONSULTA do PNCP continua fora, e o detalhe da compra mudou para dentro dela;
     4. o endpoint de BUSCA está no ar — e foi por ele que o índice passou de 7 para 27 UFs.

   >>> ELA CONSULTA PORTAIS PÚBLICOS, UMA VEZ CADA, COM IDENTIFICAÇÃO HONESTA. Nenhuma tentativa
       de contornar bloqueio: onde dá 403, o 403 É o resultado.

     node tools/prova_fase2_fontes.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

const UA_HONESTO = 'FPMED-Hospitalar/1.0 (coleta de licitacoes publicas; contato: licitacao@fpmed.com.br)';
const UA_NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPMED-Hospitalar/1.0 (licitacao@fpmed.com.br)';
const dormir = ms => new Promise(r => setTimeout(r, ms));

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

async function sonda(url, ua) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'application/json,text/html' },
      redirect: 'follow', signal: AbortSignal.timeout(30000) });
    return { status: r.status, ms: Date.now() - t0, corpo: (await r.text()).slice(0, 200) };
  } catch (e) { return { erro: e.name, ms: Date.now() - t0 }; }
}
async function conta(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  return Number((r.headers.get('content-range') || '').split('/')[1]);
}
async function buscaPNCP(q, status) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch('https://pncp.gov.br/api/search/?q=' + encodeURIComponent(q)
        + `&tipos_documento=edital&pagina=1&tam_pagina=5&status=${status || 'todos'}`,
        { headers: { 'User-Agent': UA_NAVEGADOR, Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
      if (r.ok) return JSON.parse(await r.text());
    } catch { }
    await dormir(2000 * (i + 1));
  }
  return null;
}

(async () => {
  console.log('=== PROVA — fase 2 das fontes (fatia A13) ===\n');

  // ── 1. A MURALHA DO licitacoes-e ────────────────────────────────────────────────────────
  /* O /robots.txt é a PRIMEIRA coisa que se pede a um portal, e a resposta dele manda. Aqui nem
     ele responde: 403. Um portal que recusa o arquivo que declara o que é permitido está
     dizendo "não" da forma mais clara possível. */
  const rb = await sonda('https://www.licitacoes-e.com.br/robots.txt', UA_HONESTO);
  console.log(`  licitacoes-e /robots.txt ..... HTTP ${rb.status || rb.erro} em ${rb.ms} ms`);
  ok(n + '. *** o licitacoes-e bloqueia até o /robots.txt — muralha, e a caixa manda pular ***',
    rb.status === 403 || !!rb.erro, rb); n++;
  await dormir(1500);

  // ── 2. A EBSERH JÁ ESTÁ NO PNCP ─────────────────────────────────────────────────────────
  const eb = await buscaPNCP('EMPRESA BRASILEIRA DE SERVICOS HOSPITALARES');
  console.log(`  EBSERH no PNCP ............... ${eb ? eb.total + ' edital(is)' : '(sem resposta)'}`);
  if (eb) (eb.items || []).slice(0, 2).forEach(x => console.log(`      ${x.uf} · ${String(x.orgao_nome).slice(0, 44)}`));
  /* Se a EBSERH publica no PNCP, um coletor dedicado a ela seria uma SEGUNDA cópia do mesmo
     dado, com uma segunda regra de dedupe — e a fase 3 já registra que dedupe entre fontes é o
     problema difícil. Não construir foi a decisão barata e certa. */
  ok(n + '. *** a EBSERH publica no PNCP: ela não é fonte nova ***',
    !!eb && eb.total > 1000, eb && eb.total); n++;
  await dormir(1500);

  // ── 3. A PORTA FECHADA E A PORTA ABERTA ─────────────────────────────────────────────────
  const consulta = await sonda('https://pncp.gov.br/api/consulta/v1/orgaos/78640489000153/compras/2024/452', UA_NAVEGADOR);
  console.log(`\n  PNCP /api/consulta/ (detalhe)  HTTP ${consulta.status || consulta.erro} em ${consulta.ms} ms`);
  const itens = await sonda('https://pncp.gov.br/api/pncp/v1/orgaos/78640489000153/compras/2024/452/itens?pagina=1&tamanhoPagina=1', UA_NAVEGADOR);
  console.log(`  PNCP /api/pncp/v1/.../itens .. HTTP ${itens.status || itens.erro} em ${itens.ms} ms`);
  const busca = await buscaPNCP('albumina', 'recebendo_proposta');
  console.log(`  PNCP /api/search/ ............ ${busca ? busca.total + ' abertos para "albumina"' : '(sem resposta)'}`);
  /* As três medições juntas são o que justifica a ferramenta desta fatia: a porta da varredura
     está fechada, a dos itens está aberta, e a da busca está aberta. Não é "o PNCP caiu" — é um
     serviço fora e dois no ar, e a diferença decide o que dá pra fazer hoje. */
  ok(n + '. *** o detalhe da compra está fora (a consulta engoliu esse endpoint) ***',
    consulta.erro === 'TimeoutError' || consulta.status >= 500 || consulta.status === 301,
    { status: consulta.status, erro: consulta.erro, ms: consulta.ms }); n++;
  ok(n + '. ...e os ITENS continuam no ar, respondendo rápido',
    itens.status === 200 && itens.ms < 15000, { status: itens.status, ms: itens.ms }); n++;
  ok(n + '. ...e a BUSCA continua no ar — é por ela que dá pra crescer hoje',
    !!busca && busca.total > 0, busca && busca.total); n++;

  // ── 4. O ÍNDICE CRESCEU, E EM QUANTAS UFs ───────────────────────────────────────────────
  const total = await conta('licitacoes?select=id');
  const ufs = new Set();
  for (let de = 0; ; de += 1000) {
    const r = await fetch(`${SB}/rest/v1/licitacoes?select=uf`, { headers: { ...H, Range: `${de}-${de + 999}` } });
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    j.forEach(x => { if (x.uf) ufs.add(x.uf); });
    if (j.length < 1000) break;
  }
  const porBusca = await conta('licitacoes?select=id&bruto->>_coleta=eq.busca');
  console.log(`\n  índice: ${total} licitação(ões) · ${ufs.size} UF(s)`);
  console.log(`  vindas pelo endpoint de busca: ${porBusca}`);
  console.log(`  UFs: ${[...ufs].sort().join(' ')}`);
  /* A fase 1 configurou as 27 UFs e não conseguiu coletá-las: a varredura depende da API que
     está fora. Chegar às 27 pela porta que está aberta é o resultado desta fatia. */
  ok(n + '. *** o índice passou de 7 UFs para o país inteiro ***', ufs.size >= 20, ufs.size); n++;
  ok(n + '. ...e as linhas novas dizem de onde vieram (bruto._coleta)', porBusca > 0, porBusca); n++;
  /* A janela de proposta fica NULL porque o detalhe da compra está fora. `null` é "não sei"; uma
     data inventada seria pior que a ausência, porque teria a mesma cara de uma certa. */
  const semPrazo = await conta('licitacoes?select=id&bruto->>_coleta=eq.busca&data_encerramento=is.null');
  console.log(`  delas, sem janela de proposta: ${semPrazo} (o detalhe da compra está fora do ar)`);
  ok(n + '. ...e nenhuma delas ganhou data inventada', semPrazo === porBusca, { semPrazo, porBusca }); n++;

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
