/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_selos_contexto.js — OS SELOS DE CONTEXTO NA FICHA (fatia B14) · 14/08/2026

   A caixa pede: *"um negócio com registro de preço e um sigiloso exibindo os selos com dado
   real do banco; nenhum selo inventado quando o campo é nulo."*

   ══ ELA LÊ O BANCO E EXECUTA A FUNÇÃO DA TELA ═══════════════════════════════════════════════
   `selosDoContexto` é arrancada do fpmed_negocios.html e rodada aqui com as linhas REAIS de
   `licitacoes` e `licitacao_itens`, exatamente como a ficha as lê. Não é uma cópia da regra
   escrita nesta prova — seria uma segunda regra, que envelheceria em silêncio.

   ══ O SELO "ORÇAMENTO SIGILOSO" NÃO PODE SER PROVADO HOJE, E ESTA PROVA MOSTRA POR QUÊ ══════
   Medido: ZERO das 3.876 licitações do índice têm `orcamentoSigilosoCodigo` no `bruto`. O campo
   não é coletado — a coleta usa o endpoint de BUSCA, e ele não traz sigilo. Então a prova mede a
   ausência e conferre que ela NÃO vira selo, que é a metade que me cabe. A outra metade (coletar
   o campo) é do A e está nas PENDÊNCIAS, com o endpoint e o nome do campo medidos.

     node tools/prova_selos_contexto.js
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

const HTML = fs.readFileSync(path.join(RAIZ, 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');
const fSemRef = (HTML.match(/const semReferencia = it => [^\n]+/) || [])[0];
const fSelos = (HTML.match(/function selosDoContexto\(lic, itens\)\{[\s\S]*?\n\}/) || [])[0];
if (!fSemRef || !fSelos) { console.error('não achei as funções da fatia B14 no fpmed_negocios.html'); process.exit(1); }
const selosDoContexto = new Function(fSemRef + '; ' + fSelos + '; return selosDoContexto;')();

/* O MESMO SELECT QUE A FICHA FAZ. Escrito uma vez e conferido contra o HTML logo abaixo: se a
   tela mudar o dela e esquecer desta prova, a prova reprova em vez de medir outra coisa. */
const SELECT_LIC = 'id,numero_controle,modo_disputa,valor_estimado,srp:bruto->>srp,'
  + 'sigiloso_cod:bruto->>orcamentoSigilosoCodigo,sigiloso_txt:bruto->>orcamentoSigilosoDescricao';

const T_SEMREF = '[PROVA B14 — registro de teste, pode apagar] edital sem valor de referência';

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

async function le(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(q + ' -> HTTP ' + r.status);
  return r.json();
}
async function conta(tabela, filtro) {
  const r = await fetch(`${SB}/rest/v1/${tabela}?select=id&${filtro}`,
    { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  return Number((r.headers.get('content-range') || '').split('/')[1]) || 0;
}
async function token() {
  for (const email of ['licitacao@fpmed.com.br', 'comercial@fpmed.com.br']) {
    try {
      const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: SENHA }),
      });
      if (r.ok) { const j = await r.json(); if (j.access_token) return j.access_token; }
    } catch { }
  }
  return null;
}
/* A FICHA LÊ ASSIM: a licitação pela chave do negócio, e os itens pela mesma chave. Nada mais. */
async function contextoDoNegocio(neg) {
  const chave = String(neg.numero_controle || '').trim();
  const filtro = chave ? 'numero_controle=eq.' + encodeURIComponent(chave)
    : (neg.licitacao_id ? 'id=eq.' + neg.licitacao_id : null);
  if (!filtro) return { lic: false, itens: [] };
  const lic = (await le(`licitacoes?select=${SELECT_LIC}&${filtro}&limit=1`))[0] || false;
  const itens = chave
    ? await le('licitacao_itens?select=numero_item,valor_unitario_ref'
      + `&numero_controle=eq.${encodeURIComponent(chave)}&order=id&limit=2000`)
    : [];
  return { lic, itens };
}
const mostra = l => l.length ? l.map(x => `[${x.tom}] ${x.txt}`).join('  ') : '(nenhum selo)';

(async () => {
  console.log('=== OS SELOS DE CONTEXTO NA FICHA DO NEGÓCIO (fatia B14) ===\n');

  ok(n + '. (controle) o SELECT desta prova é o mesmo que a ficha faz',
    HTML.includes('srp:bruto->>srp') && HTML.includes('sigiloso_txt:bruto->>orcamentoSigilosoDescricao')); n++;

  // ══════════ 1. UM NEGÓCIO COM REGISTRO DE PREÇO, COM DADO REAL ══════════
  console.log('  ─── 1. um negócio com REGISTRO DE PREÇO ───');
  const comChave = await le('negocios?select=id,titulo,numero_controle,licitacao_id,valor_estimado'
    + '&numero_controle=not.is.null&order=id.asc');
  ok(n + '. (controle) há negócio com a chave do PNCP gravada (a fatia B13 abriu essa porta)',
    comChave.length > 0, comChave.length); n++;

  let provouSrp = false;
  for (const neg of comChave) {
    const { lic, itens } = await contextoDoNegocio(neg);
    if (!lic || String(lic.srp) !== 'true') continue;
    const l = selosDoContexto(lic, itens);
    console.log(`  negócio ${neg.id} · ${lic.numero_controle}`);
    console.log(`    banco: srp=${lic.srp} · modo_disputa=${JSON.stringify(lic.modo_disputa)}`
      + ` · sigiloso=${JSON.stringify(lic.sigiloso_txt)} · ${itens.length} itens`);
    console.log(`    a ficha desenha: ${mostra(l)}`);
    ok(n + '. *** o selo "Registro de preço" sai de `bruto->>srp` = true, dado real do banco ***',
      l.some(x => x.txt === 'Registro de preço' && x.tom === 'verde'), l); n++;
    ok(n + '. *** e o modo de disputa sai da coluna `modo_disputa`, com o valor do PNCP ***',
      l.some(x => x.txt === 'Disputa: ' + lic.modo_disputa), { modo: lic.modo_disputa, l }); n++;
    /* A METADE QUE NÃO DÁ PRA PROVAR HOJE, medida onde ela falta. */
    ok(n + '. *** e NENHUM selo de sigiloso é desenhado, porque o campo não existe no banco ***',
      lic.sigiloso_txt == null && lic.sigiloso_cod == null
      && !l.some(x => x.txt === 'Orçamento sigiloso'), { txt: lic.sigiloso_txt, cod: lic.sigiloso_cod }); n++;
    provouSrp = true;
    break;
  }
  ok(n + '. (controle) achei um negócio de registro de preço pra medir', provouSrp); n++;

  // ══════════ 2. UM EDITAL SEM VALOR DE REFERÊNCIA — O QUE O DONO PEDIU DE VERDADE ══════════
  console.log('\n  ─── 2. um edital SEM VALOR DE REFERÊNCIA (a metade do sigiloso que dá pra provar) ───');
  /* O selo do sigiloso existe pra dizer uma coisa: *não há valor de referência, e o teto CMED é a
     única régua*. Isso não depende da bandeira que falta — depende dos ITENS, que estão no banco. */
  const zerados = await le('licitacao_itens?select=numero_controle&valor_unitario_ref=eq.0&limit=1');
  ok(n + '. (controle) existem itens com referência ZERO no banco', zerados.length > 0); n++;
  const ctrlZero = zerados[0].numero_controle;
  const licZero = (await le(`licitacoes?select=${SELECT_LIC},orgao,municipio,uf&numero_controle=eq.${encodeURIComponent(ctrlZero)}&limit=1`))[0];

  const tk = await token();
  if (!tk) { console.error('nenhum e-mail logou com a SENHA_PADRAO — sem sessão não dá pra gravar a chave.'); process.exit(1); }

  let negZ = (await le('negocios?select=id,titulo,numero_controle,licitacao_id,valor_estimado'
    + `&titulo=eq.${encodeURIComponent(T_SEMREF)}&limit=1`))[0];
  if (!negZ) {
    /* O registro nasce com o órgão e o município REAIS daquela licitação — o par é verdadeiro por
       construção, e a chave entra pela mesma porta que a ficha usa (a edge da B13), conferida
       contra o PNCP. Nasce ARQUIVADO e o título diz o que é. */
    const r = await fetch(`${SB}/rest/v1/negocios`, {
      method: 'POST', headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify({
        titulo: T_SEMREF, estagio: 'qualificacao', arquivado: true, origem: 'prova B14',
        orgao: licZero.orgao, municipio: licZero.municipio, uf: licZero.uf,
        objeto: 'Registro da prova da fatia B14 (edital sem valor de referência). Nasce ARQUIVADO. Pode ser apagado.',
      }),
    });
    if (!r.ok) { console.error('não consegui criar: ' + r.status); process.exit(1); }
    negZ = (await r.json())[0];
    console.log(`  criei o registro de prova: negócio ${negZ.id} (arquivado)`);
  } else console.log(`  reusando o registro de prova: negócio ${negZ.id}`);

  if (!negZ.numero_controle) {
    const g = await fetch(`${SB}/functions/v1/valida-controle`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
      body: JSON.stringify({ numero_controle: ctrlZero, negocio_id: negZ.id, gravar: true, confirmado: true }),
    });
    const j = await g.json().catch(() => ({}));
    console.log(`  chave gravada pela porta da B13: ${j.veredito} · gravou=${j.gravou}`);
    negZ = (await le(`negocios?select=id,numero_controle,licitacao_id,valor_estimado&id=eq.${negZ.id}`))[0];
  }

  const ctxZ = await contextoDoNegocio(negZ);
  const lZ = selosDoContexto(ctxZ.lic, ctxZ.itens);
  const semRef = ctxZ.itens.filter(x => x.valor_unitario_ref == null || !(Number(x.valor_unitario_ref) > 0)).length;
  console.log(`  negócio ${negZ.id} · ${negZ.numero_controle}`);
  console.log(`    ${licZero.orgao} · ${licZero.municipio}/${licZero.uf}`);
  console.log(`    banco: valor_estimado=${licZero.valor_estimado} · ${ctxZ.itens.length} itens, ${semRef} SEM referência`);
  console.log(`    a ficha desenha: ${mostra(lZ)}`);
  ok(n + '. *** o edital inteiro sem preço publicado vira o selo âmbar "Sem valor de referência" ***',
    semRef === ctxZ.itens.length && ctxZ.itens.length > 0
    && lZ.some(x => x.txt === 'Sem valor de referência' && x.tom === 'ambar'), { semRef, total: ctxZ.itens.length }); n++;
  ok(n + '. *** e a dica nomeia a régua que sobra, que é o teto da CMED ***',
    /teto da CMED é a única régua/.test((lZ.find(x => x.txt === 'Sem valor de referência') || {}).dica || '')); n++;

  // ══════════ 3. NENHUM SELO INVENTADO ══════════
  console.log('\n  ─── 3. nenhum selo inventado ───');
  const semSrp = (await le(`licitacoes?select=${SELECT_LIC}&bruto->>srp=eq.false&limit=1`))[0];
  if (semSrp) {
    const l = selosDoContexto(semSrp, []);
    console.log(`  licitação ${semSrp.numero_controle}: srp=${semSrp.srp} -> ${mostra(l)}`);
    ok(n + '. *** licitação com srp=false NÃO ganha o selo verde ***',
      !l.some(x => x.txt === 'Registro de preço'), l); n++;
  }
  const semNada = (await le(`licitacoes?select=${SELECT_LIC}&modo_disputa=is.null&limit=1`))[0];
  if (semNada) {
    const l = selosDoContexto(semNada, []);
    console.log(`  licitação ${semNada.numero_controle} (coleta antiga, sem os campos) -> ${mostra(l)}`);
    ok(n + '. *** licitação sem os campos coletados não ganha selo nenhum ***', l.length === 0, l); n++;
  }

  // ══════════ 4. OS NÚMEROS QUE SUSTENTAM ESTA FATIA ══════════
  console.log('\n  ─── 4. o que está medido no banco hoje ───');
  const licTotal = await conta('licitacoes', 'id=not.is.null');
  const comSrp = await conta('licitacoes', 'bruto->>srp=not.is.null');
  const srpTrue = await conta('licitacoes', 'bruto->>srp=eq.true');
  const comModo = await conta('licitacoes', 'modo_disputa=not.is.null');
  const comSigiloso = await conta('licitacoes', 'bruto->>orcamentoSigilosoCodigo=not.is.null');
  const itensTotal = await conta('licitacao_itens', 'id=not.is.null');
  const itensZero = await conta('licitacao_itens', 'valor_unitario_ref=eq.0');
  const itensNulo = await conta('licitacao_itens', 'valor_unitario_ref=is.null');
  console.log(`  licitações: ${licTotal} · com srp: ${comSrp} (${srpTrue} são registro de preço)`);
  console.log(`  com modo_disputa: ${comModo}`);
  console.log(`  com orcamentoSigiloso: ${comSigiloso}   <<< o campo que falta`);
  console.log(`  itens: ${itensTotal} · com referência ZERO: ${itensZero} · com referência nula: ${itensNulo}`);
  ok(n + '. *** o orçamento sigiloso NÃO está no banco — e é por isso que o selo não é desenhado ***',
    comSigiloso === 0, comSigiloso); n++;
  ok(n + '. *** e o zero é o caso real: a referência nunca é nula, mas é zero em milhares de itens ***',
    itensNulo === 0 && itensZero > 1000, { nulo: itensNulo, zero: itensZero }); n++;

  console.log('\n  ⚠️  PENDÊNCIA PARA O A (medida hoje, com o caminho exato):');
  console.log('      o campo do orçamento sigiloso existe no PNCP e responde AGORA, na API de');
  console.log('      CONSULTA (a de detalhe devolve 301 apontando pra ela):');
  console.log('        GET https://pncp.gov.br/api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{seq}');
  console.log('        -> orcamentoSigilosoCodigo · orcamentoSigilosoDescricao');
  console.log('      Medido em 14/08 no CNPJ 01640429000106, compra 117/2026: codigo=2,');
  console.log('      descricao="Compra parcialmente sigilosa". Basta a coleta guardar os dois');
  console.log('      campos no `bruto` (ou em coluna própria) e o selo âmbar acende sozinho —');
  console.log('      a ficha já o lê por `bruto->>orcamentoSigilosoDescricao`.');
  console.log('\n  ⚠️  PENDÊNCIA: o negócio ' + negZ.id + ' é registro de PROVA (nasce arquivado, e o');
  console.log('      título diz). Apagá-lo é um DELETE — decisão do dono.');
  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
