/* ═══════════════════════════════════════════════════════════════════════════════════════════
   mede_modalidade12.js — A TAXA DE JANELA DO CREDENCIAMENTO, MEDIDA (fatia A36, 20/08/2026)

   ══ A ORDEM DO ARQUITETO, com as palavras dele ══════════════════════════════════════════════
   *"Modalidade 12 (credenciamento): MEÇA, NÃO ADIVINHE. Peça a porta certa para uma amostra de
   30 e publique a taxa. Se der ~0%, escreva a conclusão e pare de perguntar; se der alto, é
   buraco novo e vira fatia. Você mesmo escreveu que sem uma pergunta sequer não há taxa medida.
   Faça a pergunta."*

   ══ O QUE ESTÁ EM ABERTO, e por que era HONESTO deixar em aberto ════════════════════════════
   A fatia A33 repartiu as 8.599 licitações sem prazo em três causas e mediu a taxa de cada
   modalidade NA PORTA CERTA (a de consulta, que é a única que traz a janela de proposta):

       modalidade  6 · Pregão Eletrônico ....... 99,94% têm janela
       modalidade  8 · Dispensa ................ 49,6%
       modalidade  9 · Inexigibilidade ......... 0,16%
       modalidade 12 · Credenciamento .......... ???  ← nunca foi perguntada, nem uma vez

   O `coleta_pncp.js` varre `6,8,9`. As 2.068 linhas de modalidade 12 entraram pela porta de
   BUSCA, que não tem o campo. Então não havia taxa — e a A33 se recusou a inventar uma por
   analogia ("credenciamento é chamamento aberto, logo não tem prazo" é plausível e não é
   medição). Este arquivo faz a pergunta.

   ══ COMO A MEDIÇÃO É FEITA, e por que ela não pergunta "modalidade 12 em geral" ══════════════
   A pergunta útil não é *"o PNCP publica janela para credenciamento?"* — é *"se eu perguntar à
   porta certa pelas 2.068 que EU tenho, quantas voltam com janela?"*. São perguntas diferentes:
   a primeira mede o Brasil, a segunda mede a nossa dívida.
   >>> ENTÃO A AMOSTRA SAI DO NOSSO ÍNDICE: 30 linhas de modalidade 12 sem `data_encerramento`,
       espalhadas pelas combinações (dia de publicação · UF) em que elas estão. Para cada
       combinação, a porta de consulta é perguntada exatamente como o coletor pergunta, e o
       casamento é por `numero_controle` — não por posição na lista, que mudaria a cada rodada.
   >>> E A AMOSTRA É ESPALHADA, NÃO AS 30 PRIMEIRAS. Trinta linhas do mesmo dia e da mesma UF
       medem um edital de um órgão, não uma modalidade. O sorteio é determinístico (passo fixo
       sobre a lista ordenada), para que duas execuções no mesmo índice deem a mesma amostra e a
       taxa possa ser conferida.
   >>> O CUSTO É DECLARADO: uma requisição por combinação (dia · UF), com o mesmo ritmo educado
       do coletor. Trinta linhas costumam cair em menos de 30 combinações.

     node tools/mede_modalidade12.js
     node tools/mede_modalidade12.js --n 60      (amostra maior)
     node tools/mede_modalidade12.js --mod 8     (a mesma régua em outra modalidade, para conferir)
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const C = require('./coleta_pncp.js');   // tem `if (require.main !== module) return` — não coleta nada

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const N = parseInt(arg('--n'), 10) || 30;
const MOD = parseInt(arg('--mod'), 10) || 12;

const PORTA_CONSULTA = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';
const dormir = ms => new Promise(r => setTimeout(r, ms));
const ymd = s => String(s).slice(0, 10).replace(/-/g, '');

async function conta(filtro) {
  const r = await fetch(`${SB}/rest/v1/${filtro}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (!r.ok) throw new Error(filtro + ' -> HTTP ' + r.status);
  const n = parseInt(String(r.headers.get('content-range') || '').split('/')[1], 10);
  return isFinite(n) ? n : null;
}

/* A LEITURA PAGINA. São 2.068 linhas e o PostgREST desta instância corta em 1000 — ler sem
   paginar daria uma amostra tirada de 48% da população, com cara de amostra da população. */
async function leSemPrazo() {
  const linhas = [];
  for (let off = 0; off < 20000; off += 1000) {
    const r = await fetch(`${SB}/rest/v1/licitacoes`
      + `?select=numero_controle,uf,data_publicacao,modalidade_cod,data_encerramento`
      + `&modalidade_cod=eq.${MOD}&data_encerramento=is.null&data_publicacao=not.is.null`
      + `&order=numero_controle&limit=1000&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error('leitura do indice -> HTTP ' + r.status);
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error('a resposta veio 200 mas nao e uma lista');
    linhas.push(...j);
    if (j.length < 1000) break;
  }
  return linhas;
}

async function pergunta(dia, uf, breaker, ritmo) {
  const achados = new Map();
  for (let pag = 1; pag <= 3; pag++) {
    const url = `${PORTA_CONSULTA}?dataInicial=${dia}&dataFinal=${dia}`
      + `&codigoModalidadeContratacao=${MOD}&uf=${uf}&pagina=${pag}&tamanhoPagina=50`;
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 30000);
    let r;
    try { r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ac.signal }); }
    catch (e) { clearTimeout(to); breaker.falhou(); return { erro: e.name === 'AbortError' ? 'timeout' : e.message, achados }; }
    clearTimeout(to);
    if (r.status === 429) { ritmo.freou(); await dormir(C.esperaRateLimit(0, r.headers.get('retry-after'))); pag--; continue; }
    /* 204 É "NÃO HÁ NADA NESTA COMBINAÇÃO", e é resposta — a API devolve isso quando o dia/UF
       não tem contratação da modalidade. Confundi-lo com falha faria a taxa cair por um motivo
       que não é sobre o dado. */
    if (r.status === 204) { breaker.ok(); return { vazio: true, achados }; }
    if (!r.ok) { breaker.falhou(); return { erro: 'HTTP ' + r.status, achados }; }
    const j = await r.json();
    breaker.ok();
    for (const x of (j.data || [])) {
      const nc = x.numeroControlePNCP;
      if (nc) achados.set(String(nc), x);
    }
    if (pag >= (j.totalPaginas || 1)) break;
    await dormir(ritmo.pausa);
  }
  return { achados };
}

(async () => {
  console.log('=== A TAXA DE JANELA DA MODALIDADE ' + MOD + ', MEDIDA NA PORTA CERTA ===');
  console.log('    ' + new Date().toLocaleString('pt-BR') + '\n');

  const totalMod = await conta(`licitacoes?select=id&modalidade_cod=eq.${MOD}`);
  const semPrazo = await conta(`licitacoes?select=id&modalidade_cod=eq.${MOD}&data_encerramento=is.null`);
  console.log(`no nosso índice: ${totalMod} da modalidade ${MOD} · ${semPrazo} sem janela de proposta`);

  const todas = await leSemPrazo();
  if (!todas.length) { console.log('\nnão há linhas dessa modalidade sem prazo — nada a medir.'); return; }

  /* A AMOSTRA ESPALHADA, com passo fixo. Determinística: o mesmo índice devolve a mesma amostra,
     e por isso a taxa pode ser conferida por outra pessoa em vez de acreditada. */
  const passo = Math.max(1, Math.floor(todas.length / N));
  const amostra = [];
  for (let i = 0; i < todas.length && amostra.length < N; i += passo) amostra.push(todas[i]);
  console.log(`amostra: ${amostra.length} de ${todas.length} (passo ${passo}, determinístico)`);

  // as combinações (dia · UF) que a amostra ocupa — é uma requisição por combinação
  const combos = new Map();
  for (const l of amostra) {
    const k = ymd(l.data_publicacao) + '|' + l.uf;
    if (!combos.has(k)) combos.set(k, []);
    combos.get(k).push(l);
  }
  console.log(`combinações (dia · UF) a perguntar: ${combos.size}\n`);

  const breaker = C.criaBreaker(C.FALHAS_ATE_ABRIR);
  const ritmo = C.criaRitmo();
  let comJanela = 0, semJanela = 0, naoVoltou = 0, erros = 0;
  const exemplos = [];

  for (const [k, linhas] of combos) {
    const [dia, uf] = k.split('|');
    if (breaker.aberto) { console.log('  BREAKER ABERTO — parando a medição aqui.'); break; }
    const r = await pergunta(dia, uf, breaker, ritmo);
    if (r.erro) { erros++; console.log(`  ${dia} ${uf}  ⚠️ ${r.erro}`); await dormir(ritmo.pausa); continue; }
    for (const l of linhas) {
      const x = r.achados.get(String(l.numero_controle));
      if (!x) { naoVoltou++; continue; }
      /* O CAMPO É O MESMO QUE O `normaliza` DO COLETOR LÊ. Perguntar por outro nome aqui mediria
         uma coisa que a coleta nunca gravaria — taxa certa sobre um campo que não é usado. */
      const temJanela = !!(x.dataEncerramentoProposta || x.dataAberturaProposta);
      if (temJanela) { comJanela++; if (exemplos.length < 3) exemplos.push({ nc: l.numero_controle, ate: x.dataEncerramentoProposta }); }
      else semJanela++;
    }
    console.log(`  ${dia} ${uf}  ${r.achados.size} na porta · ${linhas.length} da amostra aqui`);
    await dormir(ritmo.pausa);
  }

  const perguntadas = comJanela + semJanela;
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('AMOSTRA DE ' + amostra.length + ' · modalidade ' + MOD);
  console.log('  voltaram da porta de consulta ..... ' + perguntadas);
  console.log('    · COM janela de proposta ........ ' + comJanela
    + (perguntadas ? '   (' + (comJanela * 100 / perguntadas).toFixed(1) + '%)' : ''));
  console.log('    · SEM janela de proposta ........ ' + semJanela
    + (perguntadas ? '   (' + (semJanela * 100 / perguntadas).toFixed(1) + '%)' : ''));
  console.log('  NÃO voltaram (não estão na porta) . ' + naoVoltou);
  console.log('  combinações com erro .............. ' + erros);
  if (exemplos.length) {
    console.log('\n  exemplos com janela:');
    for (const e of exemplos) console.log('    ' + e.nc + '  até ' + e.ate);
  }
  /* A CONCLUSÃO SAI COM A CONDIÇÃO ESCRITA, e não como veredito seco: quem lê precisa poder
     discordar do CORTE, e não só do número. E ela só é dita se houve o que medir — taxa sobre
     zero resposta é uma divisão por zero com cara de conclusão. */
  console.log('\n  >>> ' + (perguntadas === 0
    ? 'NÃO HÁ TAXA: nenhuma linha da amostra voltou da porta de consulta. Isso é resultado, '
      + 'mas é sobre a PORTA e não sobre a modalidade — e não autoriza conclusão nenhuma.'
    : (comJanela * 100 / perguntadas) < 5
      ? 'TAXA BAIXA (< 5%): o PNCP não publica janela de proposta para esta modalidade. '
        + 'Perguntar pelas ' + semPrazo + ' restantes gastaria requisição e não mudaria uma linha. '
        + 'CONCLUSÃO ESCRITA — parar de perguntar.'
      : 'TAXA ALTA: há dado a ganhar. É buraco novo, e vira fatia.'));
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
