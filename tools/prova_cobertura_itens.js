/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_cobertura_itens.js — A COBERTURA DE ITENS, CONFERIDA CONTRA O PNCP (fatia A18, 14/08)

   Duas perguntas, e a segunda é a que um teste preguiçoso pularia:

     1. QUANTO já está coberto? (o número que o selo da tela mostra — ele tem que ser o real)
     2. O QUE ESTÁ GRAVADO É O QUE O PNCP DIZ? Contar linha não prova nada sobre conteúdo. Uma
        coleta pode gravar 40 mil linhas erradas com a mesma cara de trabalho feito.

   >>> E UMA TERCEIRA, QUE É A QUE MAIS IMPORTA NESTA OBRA: os 192 resultados que a fatia A7
       conferiu item a item contra o PNCP continuam lá? As colunas `resultado_*` ficam FORA do
       corpo do upsert de propósito — o que não está no corpo não entra no ON CONFLICT DO
       UPDATE. Se elas fossem junto com `null`, cada varredura de itens apagaria os resultados
       em silêncio, e o defeito pareceria trabalho. Esta prova conta antes e depois.

     node tools/prova_cobertura_itens.js [--itens 3]
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const QUANTOS = parseInt(arg('--itens') || '3', 10);

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function conta(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  return Number((r.headers.get('content-range') || '').split('/')[1]);
}
async function le(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(q + ' -> HTTP ' + r.status);
  return r.json();
}
const num = v => (v == null || v === '' || !isFinite(Number(v))) ? null : Number(v);

(async () => {
  console.log('=== COBERTURA DE ITENS, CONFERIDA CONTRA O PNCP (fatia A18) ===\n');
  const agora = new Date().toISOString();

  // ── 1. A COBERTURA, COMO O SELO DA TELA A LÊ ────────────────────────────────────────────
  const total = await conta('licitacoes?select=id');
  const lidas = await conta('licitacoes?select=id&itens_lidos_em=not.is.null');
  const comItens = await conta('licitacoes?select=id&itens_qtd=gt.0');
  const vivas = await conta(`licitacoes?select=id&data_encerramento=gte.${agora}`);
  const vivasSem = await conta(`licitacoes?select=id&data_encerramento=gte.${agora}&itens_lidos_em=is.null`);
  const semPrazoSem = await conta('licitacoes?select=id&data_encerramento=is.null&itens_lidos_em=is.null');
  const itens = await conta('licitacao_itens?select=id');

  console.log(`  licitações no índice ......... ${total.toLocaleString('pt-BR')}`);
  console.log(`    já perguntei os itens ...... ${lidas.toLocaleString('pt-BR')}  (o número do selo)`);
  console.log(`    e o PNCP tinha itens ....... ${comItens.toLocaleString('pt-BR')}`
    + `  (${lidas - comItens} responderam "não publiquei nada")`);
  console.log(`  VIVAS (encerra >= agora) ..... ${vivas.toLocaleString('pt-BR')}`);
  console.log(`    ainda sem itens lidos ...... ${vivasSem}`);
  console.log(`  sem prazo, ainda sem itens ... ${semPrazoSem.toLocaleString('pt-BR')}`);
  console.log(`  itens gravados ............... ${itens.toLocaleString('pt-BR')}\n`);

  /* O ALVO DA FATIA É O ÍNDICE VIVO. As sem prazo não são "vivas" — chamá-las assim seria
     inventar prazo —, e elas só viram vivas quando o watchdog trouxer as datas do PNCP. */
  ok(n + '. *** as licitações VIVAS do índice estão cobertas (o alvo da fatia) ***',
    vivasSem <= 2, { vivasSemItens: vivasSem, vivas }); n++;
  /* O SELO NÃO PODE CHUTAR: ele conta "perguntei", e não "tem item". São perguntas diferentes,
     e é a primeira que separa "ninguém compra albumina" de "ainda não olhei". */
  ok(n + '. *** o selo conta quem foi PERGUNTADA, que é o que separa "não tem" de "não olhei" ***',
    /itens_lidos_em=not\.is\.null/.test(fs.readFileSync(path.join(RAIZ, 'fpmed_licitacoes.html'), 'utf8'))); n++;

  // ── 2. OS RESULTADOS DA A7 CONTINUAM LÁ ─────────────────────────────────────────────────
  const resultados = await conta('licitacao_itens?select=id&resultado_lido_em=not.is.null');
  console.log(`  resultados por item (fatia A7): ${resultados}`);
  /* 192 é o número que a A7 conferiu campo a campo contra o PNCP. Se uma varredura de ITENS
     mexer nisso, o defeito é silencioso e parece trabalho. */
  ok(n + '. *** os 192 resultados da A7 continuam INTACTOS depois de 4.805 itens novos ***',
    resultados === 192, resultados); n++;

  // ── 3. O CONTEÚDO: 3 ITENS CONFERIDOS CONTRA O PNCP, CAMPO A CAMPO ──────────────────────
  /* Escolhidos entre as licitações lidas MAIS RECENTEMENTE — ou seja, as desta rodada. Conferir
     um item coletado semana passada provaria a coleta de semana passada. */
  const alvos = await le('licitacoes?select=numero_controle,cnpj,ano,sequencial,itens_qtd'
    + '&itens_qtd=gt.0&order=itens_lidos_em.desc&limit=' + QUANTOS);
  console.log(`\n  --- ${alvos.length} licitação(ões) desta rodada, conferida(s) contra o PNCP ---`);

  for (const l of alvos) {
    const url = `https://pncp.gov.br/api/pncp/v1/orgaos/${l.cnpj}/compras/${l.ano}/${l.sequencial}`
      + '/itens?pagina=1&tamanhoPagina=100';
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 45000);
    let doPncp = null;
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ac.signal });
      clearTimeout(to);
      if (r.ok) { const t = await r.text(); doPncp = t.trim() ? JSON.parse(t) : []; }
      else console.log(`  ${l.numero_controle}: o PNCP respondeu HTTP ${r.status}`);
    } catch (e) { clearTimeout(to); console.log(`  ${l.numero_controle}: ${e.name}`); }

    ok(n + `. o PNCP devolveu os itens de ${l.numero_controle} (para haver o que conferir)`,
      Array.isArray(doPncp) && doPncp.length > 0, doPncp ? doPncp.length : null); n++;
    if (!Array.isArray(doPncp) || !doPncp.length) continue;

    const noBanco = await le('licitacao_itens?select=numero_item,descricao,quantidade,unidade,valor_unitario_ref'
      + `&numero_controle=eq.${encodeURIComponent(l.numero_controle)}&limit=200`);
    const porNum = new Map(noBanco.map(x => [String(x.numero_item), x]));

    /* O PRIMEIRO ITEM DA PÁGINA, campo a campo. Conferir "quantos" não prova conteúdo — uma
       coleta pode gravar o número certo de linhas erradas. */
    const it = doPncp[0];
    const b = porNum.get(String(it.numeroItem));
    const conferem = {
      descricao: b && String(b.descricao) === String(it.descricao || '(sem descrição)'),
      quantidade: b && num(b.quantidade) === num(it.quantidade),
      unidade: b && (b.unidade || null) === (it.unidadeMedida || null),
      valor: b && num(b.valor_unitario_ref) === num(it.valorUnitarioEstimado),
    };
    console.log(`\n  ${l.numero_controle}  ·  PNCP ${doPncp.length} item(ns) nesta página · banco ${noBanco.length}`);
    console.log(`    item ${it.numeroItem}: ${String(it.descricao || '').slice(0, 74)}`);
    console.log(`      quantidade ${it.quantidade} · ${it.unidadeMedida} · unit. ref. ${it.valorUnitarioEstimado}`);
    console.log(`      confere -> descrição ${conferem.descricao ? 'ok' : 'NÃO'}`
      + ` · quantidade ${conferem.quantidade ? 'ok' : 'NÃO'}`
      + ` · unidade ${conferem.unidade ? 'ok' : 'NÃO'}`
      + ` · valor ${conferem.valor ? 'ok' : 'NÃO'}`);

    ok(n + `. *** ${l.numero_controle} item ${it.numeroItem}: os 4 campos batem com o PNCP ***`,
      !!b && conferem.descricao && conferem.quantidade && conferem.unidade && conferem.valor,
      { conferem, banco: b || null }); n++;
    /* A CONTAGEM DA PÁGINA TAMBÉM: se o PNCP entregou 100 nesta página e o banco tem menos que
       isso no total, algo se perdeu entre ler e gravar. */
    ok(n + `. ...e o banco tem pelo menos os itens desta página (${doPncp.length})`,
      noBanco.length >= Math.min(doPncp.length, 200),
      { pncpNaPagina: doPncp.length, noBanco: noBanco.length }); n++;
    await dormir(400);   // ritmo educado, o mesmo do coletor
  }

  // ── 4. O WATCHDOG DEIXOU RASTRO ─────────────────────────────────────────────────────────
  const sond = await le('pncp_sondagens?select=api,no_ar,http,ms,erro,virada,criado_em&order=criado_em.desc&limit=3');
  console.log('\n  --- últimas sondagens do watchdog ---');
  for (const s of sond) {
    console.log(`  ${String(s.criado_em).slice(0, 19)}  ${s.api}  ${s.no_ar ? 'NO AR' : 'FORA'}`
      + `  ${s.ms} ms  ${s.erro || ('HTTP ' + s.http)}${s.virada ? '   *** VIRADA ***' : ''}`);
  }
  ok(n + '. *** o watchdog está gravando o log próprio dele ***', sond.length > 0); n++;
  ok(n + '. ...e a sondagem que FALHOU também entrou (é ela que dá a duração da queda)',
    sond.some(s => s.no_ar === false && s.erro)); n++;

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
