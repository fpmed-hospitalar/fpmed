/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_acoes_por_estado.js — A FATIA A21 CONTRA O DADO REAL (14/08/2026)

   A caixa pediu quatro coisas que só o dado real prova, e cada uma delas tem um jeito
   convincente de passar errado:

     1. AS 400 LINHAS MUDAS. O `bruto` do índice vem em DUAS formas (consulta e busca). A prova
        roda o `normalizaBruto` DA PRÓPRIA TELA (extraído do .html, não recopiado aqui) contra as
        linhas REAIS de cada forma, e exige que a de busca passe a responder título, órgão,
        município e a CHAVE DO FUNIL.
     2. O ESTADO. Um cartão aberto e um encerrado, tirados do banco, com as ações que cada um
        pode oferecer. O erro fácil aqui é "encerrada" virar o balde de tudo o que não tem data.
     3. O SELO SIGILOSO. Ele vem do ITEM, não da licitação — e um selo que nunca aparece passa
        despercebido para sempre. A prova procura um edital REAL com item sigiloso.
     4. A EDGE `indexar-licitacao`. Sem sessão, sem número, número inexistente, e o caminho
        feliz: um certame do PNCP ao vivo virando linha no índice com o selo de origem.

   node tools/prova_acoes_por_estado.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const ANON = (seg.match(/anon[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '\n         ' + JSON.stringify(e) : '')); } };

/* ══ AS FUNÇÕES SÃO EXTRAÍDAS DA TELA, E NÃO RECOPIADAS AQUI ═══════════════════════════════
   Recopiar `normalizaBruto` nesta prova provaria que a MINHA cópia funciona — que é o tipo de
   verde que não protege nada. É o mesmo arranjo do `testa_grifo`. */
const SRC = fs.readFileSync(path.join(RAIZ, 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
function bloco(ini, fim) {
  const s = SRC.indexOf(ini); const e = SRC.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora nao encontrada: ' + ini);
  return SRC.slice(s, e);
}
const TELA = new Function('dt', 'brl', 'esc', '_ehSrp', 'CRUZ', 'chaveLic',
  bloco('function normalizaBruto(b){', '\nfunction categoriasDosItens')
  + '\nreturn { normalizaBruto, estadoLic, celValor, selosContexto, EST_ABERTA, EST_ENCERRADA, EST_SEM_PRAZO };')(
  (s) => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d; },
  (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR'),
  (s) => String(s == null ? '' : s),
  (l) => l.srp === true || String(l.srp) === 'true',
  new Map(), (l) => 'k');

async function paginado(rota) {
  let out = [], de = 0;
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${SB}/rest/v1/${rota}`, { headers: { ...H, Range: de + '-' + (de + 999) } });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + rota);
    const j = await r.json();
    out = out.concat(j);
    if (j.length < 1000) break;
    de += 1000;
  }
  return out;
}
async function token() {
  for (const email of ['licitacao@fpmed.com.br', 'comercial@fpmed.com.br']) {
    try {
      const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: SENHA }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (j.access_token) return j.access_token;
    } catch { }
  }
  return null;
}
async function edge(tk, corpo) {
  const r = await fetch(`${SB}/functions/v1/indexar-licitacao`, {
    method: 'POST',
    headers: Object.assign({ apikey: ANON, 'Content-Type': 'application/json' },
      tk ? { Authorization: 'Bearer ' + tk } : {}),
    body: JSON.stringify(corpo),
  });
  let j = null; try { j = await r.json(); } catch { }
  return { http: r.status, corpo: j };
}

(async () => {
  console.log('PROVA DA FATIA A21 — as ações seguem o estado, e as 400 linhas mudas voltam a falar\n');

  // ══ 1. AS DUAS FORMAS DO `bruto`, E A TRADUÇÃO ══════════════════════════════════════════
  console.log('── 1. as duas formas do índice ─────────────────────────────────────────────');
  const todos = await paginado('licitacoes?select=id,numero_controle,origem_registro,bruto');
  const daBusca = todos.filter(x => x.bruto && x.bruto._coleta === 'busca');
  const daConsulta = todos.filter(x => x.bruto && x.bruto.objetoCompra != null);
  console.log(`  índice: ${todos.length} linhas · consulta ${daConsulta.length} · busca ${daBusca.length}`);
  ok(n + '. o índice tem linhas das DUAS formas (se um dia só houver uma, esta prova avisa)',
    daBusca.length > 0 && daConsulta.length > 0,
    { busca: daBusca.length, consulta: daConsulta.length }); n++;

  /* O ANTES é medido no bruto CRU, e não afirmado no comentário: é ele que prova que o defeito
     existia de verdade, e é a única forma de o assert continuar valendo daqui a um mês. */
  const cru = daBusca[0].bruto;
  const mudos = ['objetoCompra', 'modalidadeNome', 'orgaoEntidade', 'numeroControlePNCP']
    .filter(k => cru[k] == null);
  console.log(`  ANTES (bruto cru da forma busca): ${mudos.length} de 4 campos que o cartão lê vêm nulos`);
  ok(n + '. *** o defeito EXISTIA: os 4 campos do cartão vinham nulos na forma de busca ***',
    mudos.length === 4, mudos); n++;

  let traduzidas = 0, comChave = 0, comObjeto = 0, comOrgao = 0, comMunicipio = 0;
  for (const x of daBusca) {
    const l = TELA.normalizaBruto(x.bruto);
    if (!l || !l._daBusca) continue;
    traduzidas++;
    if (String(l.numeroControlePNCP || '').trim()) comChave++;
    if (String(l.objetoCompra || '').trim()) comObjeto++;
    if ((l.orgaoEntidade || {}).razaoSocial) comOrgao++;
    if ((l.unidadeOrgao || {}).municipioNome) comMunicipio++;
  }
  console.log(`  DEPOIS: ${traduzidas} traduzidas · chave do funil ${comChave} · objeto ${comObjeto}`
    + ` · órgão ${comOrgao} · município ${comMunicipio}`);
  ok(n + '. *** as ' + daBusca.length + ' linhas da busca passam a ter a CHAVE DO FUNIL ***',
    comChave === daBusca.length, { comChave, total: daBusca.length }); n++;
  ok(n + '. ...e objeto, órgão e município (o cartão deixa de nascer em branco)',
    comObjeto === daBusca.length && comOrgao === daBusca.length && comMunicipio >= daBusca.length * 0.9,
    { comObjeto, comOrgao, comMunicipio, total: daBusca.length }); n++;
  /* A TRADUÇÃO NÃO PODE INVENTAR: o que a busca não manda tem que continuar nulo. Um tradutor
     que preenche prazo com "hoje" e valor com 0 conserta a aparência e estraga a decisão. */
  const l0 = TELA.normalizaBruto(cru);
  ok(n + '. *** e ela NÃO inventa o que a fonte não mandou (prazo, valor e SRP ficam nulos) ***',
    l0.dataAberturaProposta == null && l0.dataEncerramentoProposta == null
    && l0.valorTotalEstimado == null && l0.srp == null,
    { ab: l0.dataAberturaProposta, fim: l0.dataEncerramentoProposta, val: l0.valorTotalEstimado, srp: l0.srp }); n++;
  ok(n + '. ...e "valor não informado" não é "R$ 0" na tela',
    /não informado/.test(TELA.celValor(null)) && /não informado/.test(TELA.celValor(0))
    && !/não informado/.test(TELA.celValor(1234)),
    { nulo: TELA.celValor(null), zero: TELA.celValor(0), real: TELA.celValor(1234) }); n++;
  // a forma de consulta passa INTACTA — o tradutor não pode mexer em quem já falava a língua
  const antes = daConsulta[0].bruto;
  ok(n + '. a forma de consulta passa intacta pelo tradutor (mesmo objeto, sem cópia)',
    TELA.normalizaBruto(antes) === antes); n++;

  // ══ 2. O ESTADO, E AS AÇÕES QUE ELE LIBERA ══════════════════════════════════════════════
  console.log('\n── 2. o estado de cada certame ─────────────────────────────────────────────');
  const agora = new Date();
  const conta = { aberta: 0, encerrada: 0, 'sem-prazo': 0 };
  const exemplo = {};
  for (const x of todos) {
    const l = TELA.normalizaBruto(x.bruto);
    const e = TELA.estadoLic(l, agora);
    conta[e] = (conta[e] || 0) + 1;
    if (!exemplo[e]) exemplo[e] = { l, id: x.id, ctrl: x.numero_controle };
  }
  console.log(`  aberta ${conta.aberta} · encerrada ${conta.encerrada} · sem prazo ${conta['sem-prazo']}`);
  ok(n + '. *** os TRÊS estados existem no dado real (sem prazo não foi engolido por encerrada) ***',
    conta.aberta > 0 && conta.encerrada > 0 && conta['sem-prazo'] > 0, conta); n++;
  for (const e of ['aberta', 'encerrada', 'sem-prazo']) {
    if (!exemplo[e]) continue;
    const l = exemplo[e].l, un = l.unidadeOrgao || {};
    console.log(`  ${e.padEnd(10)} ${exemplo[e].ctrl} · ${l.modalidadeNome || '?'} · `
      + `${((l.orgaoEntidade || {}).razaoSocial || '?').slice(0, 40)} · ${un.municipioNome || '?'}/${un.ufSigla || '?'}`
      + ` · encerra ${l.dataEncerramentoProposta || '(não informado)'}`);
  }
  /* A AFIRMAÇÃO QUE A CAIXA MAIS COBRA: encerrada NÃO pode oferecer "adicionar aos negócios".
     Aqui isso é conferido na REGRA (o estado), porque é ela que a tela consulta pra decidir. */
  const abertas = todos.map(x => TELA.normalizaBruto(x.bruto))
    .filter(l => TELA.estadoLic(l, agora) === 'aberta');
  ok(n + '. *** toda "aberta" tem encerramento NO FUTURO (é o que autoriza o botão verde) ***',
    abertas.every(l => new Date(l.dataEncerramentoProposta) > agora), { n: abertas.length }); n++;
  const encerradas = todos.map(x => TELA.normalizaBruto(x.bruto))
    .filter(l => TELA.estadoLic(l, agora) === 'encerrada');
  ok(n + '. ...e nenhuma "encerrada" tem prazo no futuro',
    encerradas.every(l => {
      const d = l.dataEncerramentoProposta ? new Date(l.dataEncerramentoProposta) : null;
      return !d || d <= agora;
    }), { n: encerradas.length }); n++;
  /* A VIGÊNCIA SÓ FECHA: vigência correndo NÃO pode virar "aberta", porque o prazo de proposta
     fecha antes dela. Este assert é o que impede o botão verde de aparecer por dedução. */
  ok(n + '. *** vigência CORRENDO não vira "aberta" (a busca não devolve prazo de proposta) ***',
    TELA.estadoLic({ dataFimVigencia: new Date(Date.now() + 30 * 86400000).toISOString() }, agora) === 'sem-prazo'
    && TELA.estadoLic({ dataFimVigencia: '2020-01-01' }, agora) === 'encerrada'); n++;

  // ══ 3. O SELO "ORÇAMENTO SIGILOSO" VEM DO ITEM ══════════════════════════════════════════
  console.log('\n── 3. o orçamento sigiloso, medido no /itens do PNCP ───────────────────────');
  const semNoIndice = todos.filter(x => x.bruto && (x.bruto.orcamentoSigilosoCodigo != null
    || x.bruto.orcamentoSigilosoDescricao != null)).length;
  ok(n + '. *** o sigiloso NÃO existe na licitação do índice — por isso o selo espera os itens ***',
    semNoIndice === 0, { linhasComCampo: semNoIndice }); n++;
  let testados = 0, comCampo = 0, comSigiloso = 0, achado = null;
  for (const x of daConsulta.slice(0, 25)) {
    const b = x.bruto, cnpj = (b.orgaoEntidade || {}).cnpj;
    if (!cnpj || b.anoCompra == null || b.sequencialCompra == null) continue;
    try {
      const r = await fetch(`https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${b.anoCompra}/${b.sequencialCompra}/itens?pagina=1&tamanhoPagina=50`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const j = await r.json();
      if (!Array.isArray(j) || !j.length) continue;
      testados++;
      if (Object.prototype.hasOwnProperty.call(j[0], 'orcamentoSigiloso')) comCampo++;
      const sig = j.filter(i => i.orcamentoSigiloso === true).length;
      if (sig) { comSigiloso++; if (!achado) achado = { ctrl: x.numero_controle, sig, total: j.length }; }
    } catch { /* PNCP fora: segue */ }
    if (comSigiloso && testados >= 12) break;
  }
  console.log(`  editais lidos ${testados} · com o campo ${comCampo} · com item sigiloso ${comSigiloso}`);
  if (achado) console.log(`  exemplo: ${achado.ctrl} — ${achado.sig} de ${achado.total} itens sigilosos`);
  if (testados) {
    ok(n + '. o campo `orcamentoSigiloso` vem em TODO item lido (o selo tem base real)',
      comCampo === testados, { comCampo, testados }); n++;
    ok(n + '. *** e existe edital REAL com item sigiloso (selo que nunca aparece não é selo) ***',
      comSigiloso > 0, { comSigiloso, testados }); n++;
  } else {
    console.log('  ~ o PNCP não respondeu itens agora: a parte 3 não pôde ser medida nesta rodada.');
  }

  // ══ 4. A EDGE `indexar-licitacao` ═══════════════════════════════════════════════════════
  console.log('\n── 4. a edge que guarda o certame do ao vivo no índice ─────────────────────');
  const semTk = await edge(null, { numero_controle: '00000000000000-1-000001/2026' });
  ok(n + '. a edge exige sessão (401 sem token) — ela escreve no índice',
    semTk.http === 401, semTk); n++;
  const tk = await token();
  if (!tk) {
    console.log('  ~ nenhum e-mail logou com a SENHA_PADRAO: a metade autenticada não foi medida.');
  } else {
    const semNum = await edge(tk, {});
    ok(n + '. sem número de controle ela recusa com 422, e diz o que falta',
      semNum.http === 422, semNum); n++;
    const torto = await edge(tk, { numero_controle: 'nao-e-um-numero' });
    ok(n + '. formato errado é recusado ANTES de qualquer chamada ao PNCP',
      torto.http === 422 && torto.corpo && torto.corpo.error === 'formato', torto); n++;
    /* O NÚMERO INEXISTENTE É DO FORMATO CERTO E DO CNPJ CERTO — é o engano provável de quem
       digita. Um "abc" seria recusado pelo formato e não provaria nada sobre a conferência. */
    const inexistente = await edge(tk, { numero_controle: '05816630000152-1-999999/2026' });
    ok(n + '. *** número inexistente NÃO entra no índice (409, e nada gravado) ***',
      inexistente.http === 409 && inexistente.corpo && inexistente.corpo.error === 'nao_existe',
      inexistente); n++;

    // ── o caminho feliz: um certame do PNCP ao vivo que o índice NÃO tem ──────────────────
    const jaTem = new Set(todos.map(x => String(x.numero_controle || '')));
    let alvo = null;
    try {
      const r = await fetch('https://pncp.gov.br/api/search/?q=' + encodeURIComponent('medicamento')
        + '&tipos_documento=edital&pagina=1&tam_pagina=30&status=todos',
        { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
      const j = await r.json();
      alvo = (j.items || []).find(i => i.numero_controle_pncp && !jaTem.has(String(i.numero_controle_pncp)));
      console.log(`  busca ao vivo: ${(j.items || []).length} devolvidos · fora do índice: `
        + `${(j.items || []).filter(i => !jaTem.has(String(i.numero_controle_pncp))).length}`);
    } catch (e) { console.log('  ~ o PNCP ao vivo não respondeu (' + e.message + ')'); }

    if (!alvo) {
      console.log('  ~ nenhum certame do ao vivo estava FORA do índice agora — caminho feliz não medido.');
    } else {
      console.log(`  alvo: ${alvo.numero_controle_pncp} · ${alvo.orgao_nome} · ${alvo.municipio_nome}/${alvo.uf}`);
      const g = await edge(tk, { numero_controle: alvo.numero_controle_pncp, origem: 'busca_ao_vivo' });
      ok(n + '. *** o certame do ao vivo VIRA linha no índice ***',
        g.http === 200 && g.corpo && g.corpo.ok && g.corpo.gravou, g); n++;
      const [gravada] = await (await fetch(`${SB}/rest/v1/licitacoes?select=id,numero_controle,portal,`
        + `origem_registro,orgao,municipio,uf,objeto,data_abertura,valor_estimado`
        + `&numero_controle=eq.${encodeURIComponent(alvo.numero_controle_pncp)}`, { headers: H })).json();
      ok(n + '. ...com o SELO DE ORIGEM, e sem mexer na chave natural (portal continua PNCP)',
        gravada && gravada.origem_registro === 'busca_ao_vivo' && gravada.portal === 'PNCP', gravada); n++;
      ok(n + '. ...com órgão, município e objeto do PNCP (não do que o navegador mandou)',
        gravada && gravada.orgao && gravada.municipio && gravada.objeto, gravada); n++;
      ok(n + '. *** e o que a busca não devolve continua NULO, nunca zero ***',
        gravada && gravada.data_abertura == null && gravada.valor_estimado == null, gravada); n++;
      // idempotente: clicar duas vezes não pode criar duas linhas
      const g2 = await edge(tk, { numero_controle: alvo.numero_controle_pncp });
      const dupes = await (await fetch(`${SB}/rest/v1/licitacoes?select=id`
        + `&numero_controle=eq.${encodeURIComponent(alvo.numero_controle_pncp)}`, { headers: H })).json();
      ok(n + '. *** clicar duas vezes dá UMA linha (o 2º pedido responde "já está") ***',
        g2.corpo && g2.corpo.ja === true && dupes.length === 1, { g2: g2.corpo, linhas: dupes.length }); n++;
      console.log(`  gravada: id ${gravada && gravada.id} · ${gravada && gravada.orgao}`);
    }
  }

  // ══ 5. O CERTAME DE JEQUIÉ QUE O DONO CITOU ═════════════════════════════════════════════
  /* A caixa pede a prova com "a Dispensa 551/2025 (Fundo Estadual de Saúde/BA, Jequié)".
     >>> ELA NÃO EXISTE COM ESSE NÚMERO NO PNCP, e a razão é a mesma que está escrita no
         `normalizaBruto`: o número que o órgão usa no edital NÃO é o sequencial do PNCP.
         Medido hoje: `q="551/2025 Jequie"` devolve total 0; `q="Fundo Estadual de Saude Jequie"`
         devolve 3, e a Dispensa de Jequié é a 05816630000152-1-004392/2024.
     >>> ENTÃO A PROVA USA O CERTAME REAL DAQUELE ÓRGÃO E DAQUELA CIDADE, e diz que trocou. Rodar
         a prova contra um número que não existe daria "não achei" — e "não achei" sobre um
         número errado não prova nada sobre a tela. */
  console.log('\n── 5. o certame de Jequié (Fundo Estadual de Saúde/BA) ─────────────────────');
  const JEQUIE = '05816630000152-1-004392/2024';
  try {
    const base = 'https://pncp.gov.br/api/pncp/v1/orgaos/05816630000152/compras/2024/4392';
    const [ri, ra] = await Promise.all([
      fetch(base + '/itens?pagina=1&tamanhoPagina=100', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) }),
      fetch(base + '/arquivos', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) }),
    ]);
    const itens = ri.ok ? await ri.json() : [];
    const arqs = ra.ok ? await ra.json() : [];
    console.log(`  ${JEQUIE} · itens ${itens.length} · arquivos ${arqs.length}`);
    itens.slice(0, 3).forEach(i => console.log(`    ${i.numeroItem} · ${String(i.descricao || '').slice(0, 50)}`
      + ` · ${i.quantidade} ${i.unidadeMedida} · R$ ${i.valorUnitarioEstimado}`
      + (i.orcamentoSigiloso ? ' · SIGILOSO' : '')));
    ok(n + '. *** o certame de Jequié abre com ITENS (número, descrição, qtd, unidade e valor) ***',
      itens.length > 0 && itens.every(i => String(i.descricao || '').trim()
        && i.numeroItem != null && i.unidadeMedida != null), { itens: itens.length }); n++;
    ok(n + '. ...e com ARQUIVO do edital (nome e tipo, que é o que a seção de documentos mostra)',
      arqs.length > 0 && arqs.every(a => a.titulo), { arquivos: arqs.length }); n++;
    /* SERVIÇO NÃO TEM TETO CMED, e este certame é de controle de pragas — de propósito: é o caso
       em que a coluna do teto TEM que dizer "sem teto CMED" e nunca zero. */
    ok(n + '. ...e os itens dele são SERVIÇO, o caso em que o teto CMED tem que calar',
      itens.every(i => i.materialOuServico === 'S'),
      itens.map(i => i.materialOuServicoNome)); n++;
  } catch (e) { console.log('  ~ o PNCP não respondeu para o certame de Jequié (' + e.message + ')'); }

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message + '\n' + e.stack); process.exit(1); });
