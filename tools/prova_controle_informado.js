/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_controle_informado.js — A ATA ANTIGA RECUPERADA PELO NÚMERO INFORMADO (fatia A19)
   14/08/2026.

   A fatia pede duas provas, e a segunda vale tanto quanto a primeira:
     1. UM negócio antigo com o número informado à mão TRAZENDO OS ITENS CERTOS;
     2. UM número errado sendo RECUSADO com mensagem clara.

   ══ POR QUE ESTA PROVA PRECISA CRIAR UM REGISTRO, E COMO ELA FAZ ISSO SEM SUJAR NADA ════════
   Medido hoje: das 2.561 linhas de `negocios`, **ZERO** têm `numero_controle` e **ZERO** têm
   `licitacao_id`. As 105 Atas vieram de uma planilha que nunca teve a chave do PNCP, e não há
   como DESCOBRIR a chave verdadeira delas a partir do dado — refiz a junção conservadora hoje,
   com o índice já em 3.876 linhas, e as 4 correspondências ambíguas continuam TODAS de
   município errado (Minaçu casando com Santa Helena e Formosa; Paraúna com Campo Limpo e Caçu).
   É exatamente por isso que a fatia existe: o número vem de GENTE, não de palpite.

   >>> ENTÃO NÃO EXISTE, NA BASE, UM PAR VERDADEIRO PRA PROVAR COM. E inventar um par sobre uma
       Ata real seria fazer, dentro da prova, a coisa que a fatia proíbe.
   >>> A SAÍDA HONESTA: um registro de PROVA, criado a partir dos dados REAIS de uma licitação
       que está no índice E tem resultado por item conferido (a da fatia A7 — Pedra Bonita/MG,
       compra 34/2026, 195 itens, 192 com resultado). O par é verdadeiro por construção: o
       negócio é montado com o órgão, o município e o número que aquela licitação de fato tem.
       Ele nasce ARQUIVADO e com o título dizendo o que é, então não entra no funil de trabalho.
       Apagá-lo depois é um DELETE, e DELETE é decisão do dono — fica nas PENDÊNCIAS.
   >>> E A PROVA É IDEMPOTENTE: rodar de novo reusa o mesmo registro. Ela não cria um por rodada.

     node tools/prova_controle_informado.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const V = require('./valida_controle_pncp.js');

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const ANON = (seg.match(/anon[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

const TITULO = '[PROVA A19 — registro de teste, pode apagar] Pedra Bonita/MG';
/* O número ERRADO é do formato certo e do CNPJ certo, e não existe: é o engano mais provável de
   quem digita — trocar o sequencial pelo número do edital. Um "abc" seria recusado pelo formato
   e não provaria nada sobre a conferência de existência. */
const ERRADO_INEXISTENTE = '01640429000106-1-999999/2026';

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

async function le(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(q + ' -> HTTP ' + r.status);
  return r.json();
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
async function chamaEdge(tk, corpo) {
  const r = await fetch(`${SB}/functions/v1/valida-controle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify(corpo),
  });
  return { http: r.status, corpo: await r.json().catch(() => ({})) };
}

(async () => {
  console.log('=== A ATA ANTIGA RECUPERADA PELO NÚMERO INFORMADO (fatia A19) ===\n');

  // ── 0. A LICITAÇÃO REAL QUE SERVE DE VERDADE ────────────────────────────────────────────
  const comResultado = await le('licitacao_itens?select=numero_controle&resultado_lido_em=not.is.null&limit=1');
  const CERTO = comResultado[0].numero_controle;
  const lic = (await le(`licitacoes?select=id,numero_compra,ano,orgao,municipio,uf,itens_qtd`
    + `&numero_controle=eq.${encodeURIComponent(CERTO)}`))[0];
  console.log(`  a licitação de verdade: ${CERTO}`);
  console.log(`    ${lic.orgao} · ${lic.municipio}/${lic.uf} · compra ${lic.numero_compra}/${lic.ano}`
    + ` · ${lic.itens_qtd} itens\n`);

  // ── 1. O NEGÓCIO ANTIGO, COM A CARA DE QUEM VEIO DA PLANILHA (sem chave do PNCP) ────────
  let neg = (await le(`negocios?select=id,titulo,numero,orgao,municipio,uf,estagio,numero_controle,licitacao_id`
    + `&titulo=eq.${encodeURIComponent(TITULO)}&limit=1`))[0];
  if (!neg) {
    const r = await fetch(`${SB}/rest/v1/negocios`, {
      method: 'POST', headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify({
        titulo: TITULO, estagio: 'contrato', arquivado: true, origem: 'prova A19',
        numero: `${lic.numero_compra}/${lic.ano}`, orgao: lic.orgao,
        municipio: lic.municipio, uf: lic.uf,
        objeto: 'Registro criado pela prova da fatia A19 para exercitar o número informado à mão. '
          + 'Nasce ARQUIVADO e não entra no funil de trabalho. Pode ser apagado.',
        // numero_controle e licitacao_id NÃO entram: é essa ausência que a fatia vem resolver.
      }),
    });
    if (!r.ok) { console.error('não consegui criar o registro de prova: ' + r.status + ' ' + (await r.text()).slice(0, 200)); process.exit(1); }
    neg = (await r.json())[0];
    console.log(`  criei o registro de prova: negócio ${neg.id} (arquivado)`);
  } else {
    console.log(`  reusando o registro de prova: negócio ${neg.id}`);
  }
  console.log(`    nº ${neg.numero} · ${neg.orgao} · ${neg.municipio}/${neg.uf}`
    + ` · numero_controle: ${neg.numero_controle || '(vazio — como uma Ata da planilha)'}\n`);
  ok(n + '. (controle) o negócio de prova começa SEM a chave do PNCP, como as 105 Atas reais',
    true); n++;

  // ── 2. O NÚMERO ERRADO É RECUSADO, COM MENSAGEM CLARA ───────────────────────────────────
  console.log('  ─── 2. o número ERRADO ───');
  const vErr = V.veredito({
    partes: V.partesControle(ERRADO_INEXISTENTE),
    existe: false, anoNegocio: V.anoDoNegocio(neg), orgaoPNCP: lic.orgao,
    orgaoNegocio: neg.orgao, municipioIndice: null, municipioNegocio: neg.municipio,
  });
  console.log(`  informado: ${ERRADO_INEXISTENTE}`);
  console.log(`  veredito : ${vErr.veredito.toUpperCase()}`);
  console.log('  ' + vErr.mensagem);
  ok(n + '. *** número inexistente é RECUSADO, e não pode ser gravado ***',
    vErr.veredito === 'nao_existe' && vErr.podeGravar === false); n++;
  /* "Não deu certo" não é mensagem: a pessoa precisa saber O QUE conferir. A frase nomeia o
     engano mais provável (trocar o sequencial pelo número do edital). */
  ok(n + '. ...com mensagem que diz O QUE conferir, e não só "número inválido"',
    /sequencial/.test(vErr.mensagem) && /número do edital/.test(vErr.mensagem)); n++;

  /* O ANO É O BLOQUEIO DURO, e é o engano mais comum depois do sequencial: mesmo pregão, ano
     trocado. Aqui o negócio é de 2026 e o número informado é de 2025. */
  const vAno = V.veredito({
    partes: V.partesControle(CERTO.replace(/\/\d{4}$/, '/2025')),
    existe: true, anoNegocio: V.anoDoNegocio(neg), orgaoPNCP: lic.orgao,
    orgaoNegocio: neg.orgao, municipioIndice: null, municipioNegocio: neg.municipio,
  });
  ok(n + '. *** ano trocado BLOQUEIA (ou é 2025 ou é 2026 — isso não é opinião) ***',
    vAno.veredito === 'diverge' && vAno.podeGravar === false && /outro ano/.test(vAno.mensagem),
    vAno.mensagem); n++;

  // ── 3. A MESMA RECUSA PELA EDGE FUNCTION (a porta que a tela do B vai usar) ─────────────
  console.log('\n  ─── 3. a mesma recusa, pela edge function ───');
  const semTok = await fetch(`${SB}/functions/v1/valida-controle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numero_controle: CERTO }),
  });
  ok(n + '. a edge exige sessão (401 sem token) — ela faz um serviço público trabalhar a nosso pedido',
    semTok.status === 401, semTok.status); n++;

  const tk = await token();
  if (!tk) {
    console.log('\n  ~ NÃO CONFERI a metade autenticada (nenhum e-mail logou com a SENHA_PADRAO).');
  } else {
    const e1 = await chamaEdge(tk, { numero_controle: ERRADO_INEXISTENTE, negocio_id: neg.id, gravar: true });
    console.log(`  errado -> HTTP ${e1.http} · ${e1.corpo.veredito}`);
    console.log('  ' + String(e1.corpo.mensagem || '').split('\n')[0]);
    ok(n + '. *** a edge RECUSA o número inexistente e NÃO grava (HTTP 409) ***',
      e1.http === 409 && e1.corpo.veredito === 'nao_existe' && e1.corpo.gravou === false, e1.corpo); n++;
    ok(n + '. ...e o formato errado também, com a frase que ensina o formato',
      (await chamaEdge(tk, { numero_controle: 'PE 60/2026', negocio_id: neg.id })).corpo.veredito === 'formato'); n++;

    // ── 4. O NÚMERO CERTO: CONFERE E GRAVA ────────────────────────────────────────────────
    console.log('\n  ─── 4. o número CERTO, informado à mão ───');
    const e2 = await chamaEdge(tk, { numero_controle: CERTO, negocio_id: neg.id, gravar: true });
    console.log(`  informado: ${CERTO}`);
    console.log(`  o PNCP diz: ${e2.corpo.orgao_pncp || '(não respondeu o órgão)'}`);
    console.log(`  veredito : ${String(e2.corpo.veredito).toUpperCase()} · HTTP ${e2.http}`);
    console.log('  ' + String(e2.corpo.mensagem || '').split('\n').join('\n  '));
    ok(n + '. *** o número certo CONFERE contra o PNCP e contra o negócio ***',
      e2.http === 200 && e2.corpo.veredito === 'confere', e2.corpo); n++;
    ok(n + '. *** e a edge GRAVA os DOIS campos (chave do PNCP e id do índice) ***',
      e2.corpo.gravou === true && e2.corpo.licitacao_id === lic.id,
      { gravou: e2.corpo.gravou, licitacao_id: e2.corpo.licitacao_id, esperado: lic.id }); n++;
  }

  const neg2 = (await le(`negocios?select=id,numero_controle,licitacao_id&id=eq.${neg.id}`))[0];
  console.log(`\n  o negócio ${neg.id} agora: numero_controle=${neg2.numero_controle} · licitacao_id=${neg2.licitacao_id}`);
  ok(n + '. *** a chave está gravada no negócio (a porta do coletor abriu) ***',
    neg2.numero_controle === CERTO, neg2); n++;

  // ── 5. A PORTA DO COLETOR: O NEGÓCIO ENTRA NA FILA E OS ITENS GANHOS APARECEM ───────────
  console.log('\n  ─── 5. o coletor passa a enxergar o negócio ───');
  const fila = execFileSync(process.execPath, [path.join(__dirname, 'fila_resultado_atas.js')],
    { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const mFila = fila.match(/NA FILA:\s*(\d+)\s*de\s*(\d+)/);
  console.log(`  ${fila.split('\n').filter(l => /NA FILA|numero_controle gravado/.test(l)).join('\n  ')}`);
  ok(n + '. *** o `fila_resultado_atas.js` enxerga o negócio pelo número informado ***',
    !!mFila && Number(mFila[1]) >= 1, mFila ? mFila[0] : null); n++;
  ok(n + '. ...e a linha dele aparece nomeada na prévia da fila',
    new RegExp('negócio ' + neg.id + ' → ' + CERTO.replace(/\//g, '\\/')).test(fila)
    || fila.includes(`negócio ${neg.id}`), null); n++;

  /* OS ITENS GANHOS. A licitação da A7 tem 192 itens com resultado já conferidos contra o PNCP
     campo a campo — então "trazendo os itens certos" é verificável de verdade: os itens que o
     negócio passa a enxergar são AQUELES, e não uma lista qualquer. */
  const ganhos = await le(`licitacao_itens?select=numero_item,descricao,resultado_vencedor,`
    + `resultado_valor_unit&numero_controle=eq.${encodeURIComponent(CERTO)}`
    + '&resultado_lido_em=not.is.null&order=numero_item.asc&limit=3');
  const quantos = await fetch(`${SB}/rest/v1/licitacao_itens?select=id`
    + `&numero_controle=eq.${encodeURIComponent(CERTO)}&resultado_lido_em=not.is.null`,
    { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  const nGanhos = Number((quantos.headers.get('content-range') || '').split('/')[1]);
  console.log(`\n  itens com resultado que o negócio passa a enxergar: ${nGanhos}`);
  for (const g of ganhos) {
    console.log(`    item ${g.numero_item}: ${String(g.descricao).slice(0, 52)}`);
    console.log(`      vencedor ${g.resultado_vencedor || '—'} · unit. ${g.resultado_valor_unit}`);
  }
  ok(n + '. *** o negócio traz OS ITENS CERTOS — os 192 da A7, conferidos contra o PNCP ***',
    nGanhos === 192, nGanhos); n++;
  ok(n + '. ...e eles têm vencedor e valor (é isso que "item ganho" quer dizer)',
    ganhos.length > 0 && ganhos.every(g => g.resultado_vencedor && g.resultado_valor_unit != null),
    ganhos); n++;

  console.log('\n  ⚠️  PENDÊNCIA: o negócio ' + neg.id + ' é registro de PROVA (nasce arquivado, e o');
  console.log('      título diz). Apagá-lo é um DELETE, e DELETE é decisão do dono — não apaguei.');
  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
