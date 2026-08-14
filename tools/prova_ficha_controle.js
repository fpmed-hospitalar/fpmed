/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_ficha_controle.js — O NÚMERO DE CONTROLE INFORMADO NA FICHA (fatia B13) · 14/08/2026

   A caixa pede TRÊS provas, e as três são de comportamento, não de código:
     1. um negócio antigo recebendo o número CERTO e passando a listar itens/resultado;
     2. um número ERRADO recusado com mensagem clara;
     3. um caso de AVISO exigindo confirmação.

   ══ O QUE ESTA PROVA MEDE, E POR QUE ELA MEDE OS DOIS LADOS JUNTOS ═══════════════════════════
   Ela chama a edge `valida-controle` DE VERDADE (a mesma porta que a ficha usa, com sessão de
   gente) e joga a resposta REAL dentro da função REAL da tela — `decideAcaoControle`, arrancada
   do fpmed_negocios.html e executada aqui. É a única forma de responder a pergunta que importa:
   *"com o que o servidor respondeu hoje, o que a tela faria?"*
   >>> Conferir só o servidor deixaria a tela livre pra tratar `nao_sei` como "não existe`.
   >>> Conferir só a tela deixaria a suíte verde sobre uma resposta que o servidor não dá mais.

   ══ POR QUE ELA CRIA REGISTROS, E COMO ISSO NÃO SUJA NADA ═══════════════════════════════════
   Medido hoje: `negocios` tem 2.562 linhas e UMA com `numero_controle` (a que a prova da A19
   criou). Não existe, na base, um par verdadeiro "Ata antiga + número certo" pra provar com — e
   inventar um sobre uma Ata real seria fazer, dentro da prova, exatamente o que a fatia proíbe.
   Então ela usa DOIS registros de prova, montados a partir de uma licitação REAL do índice:
     · o do caminho FELIZ  — órgão e município iguais aos da licitação de verdade;
     · o do caminho de AVISO — o MESMO número, num negócio de outro município, que é como o
       aviso de divergência nasce no mundo real (nome de órgão escrito de outro jeito).
   Os dois nascem ARQUIVADOS e o título diz o que são. A prova é IDEMPOTENTE: rodar de novo reusa
   os mesmos dois. Apagá-los é um DELETE, e DELETE é decisão do dono — fica nas PENDÊNCIAS.

     node tools/prova_ficha_controle.js
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

/* A FUNÇÃO DA TELA, DE VERDADE. Arrancada do HTML e executada — não uma cópia escrita aqui, que
   envelheceria em silêncio no dia em que a tela mudasse. */
const HTML = fs.readFileSync(path.join(RAIZ, 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');
const fonteDecide = (HTML.match(/function decideAcaoControle\(r\)\{[\s\S]*?\n\}/) || [])[0];
if (!fonteDecide) { console.error('não achei `decideAcaoControle` no fpmed_negocios.html'); process.exit(1); }
const decide = new Function('return (' + fonteDecide + ')')();

const T_FELIZ = '[PROVA B13 — registro de teste, pode apagar] caminho feliz';
const T_AVISO = '[PROVA B13 — registro de teste, pode apagar] divergência de órgão';
/* Formato certo, CNPJ certo, sequencial que não existe: é o engano mais provável de quem digita
   (trocar o sequencial pelo número do edital). Um "abc" seria barrado pelo formato e não provaria
   nada sobre a conferência de existência. */
const ERRADO = '01640429000106-1-999999/2026';

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
/* A CHAMADA É A MESMA QUE A FICHA FAZ: POST, Bearer da sessão, corpo igual. */
async function chamaEdge(tk, corpo) {
  const r = await fetch(`${SB}/functions/v1/valida-controle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify(corpo),
  });
  return { http: r.status, corpo: await r.json().catch(() => ({})) };
}
async function achaOuCria(titulo, campos) {
  const achado = (await le(`negocios?select=id,titulo,numero,orgao,municipio,uf,numero_controle,licitacao_id`
    + `&titulo=eq.${encodeURIComponent(titulo)}&limit=1`))[0];
  if (achado) { console.log(`  reusando o registro de prova: negócio ${achado.id}`); return { neg: achado, novo: false }; }
  const r = await fetch(`${SB}/rest/v1/negocios`, {
    method: 'POST', headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ titulo, estagio: 'contrato', arquivado: true, origem: 'prova B13', ...campos }),
  });
  if (!r.ok) { console.error('não consegui criar: ' + r.status + ' ' + (await r.text()).slice(0, 200)); process.exit(1); }
  const neg = (await r.json())[0];
  console.log(`  criei o registro de prova: negócio ${neg.id} (arquivado)`);
  return { neg, novo: true };
}
const linha1 = s => String(s || '').split('\n')[0];

(async () => {
  console.log('=== O NÚMERO DE CONTROLE INFORMADO NA FICHA (fatia B13) ===\n');

  // ── 0. A LICITAÇÃO REAL QUE SERVE DE VERDADE ────────────────────────────────────────────
  const comResultado = await le('licitacao_itens?select=numero_controle&resultado_lido_em=not.is.null&limit=1');
  const CERTO = comResultado[0].numero_controle;
  const lic = (await le('licitacoes?select=id,numero_compra,ano,orgao,municipio,uf,itens_qtd'
    + `&numero_controle=eq.${encodeURIComponent(CERTO)}`))[0];
  console.log(`  a licitação de verdade: ${CERTO}`);
  console.log(`    ${lic.orgao} · ${lic.municipio}/${lic.uf} · compra ${lic.numero_compra}/${lic.ano}\n`);

  const tk = await token();
  if (!tk) { console.error('nenhum e-mail logou com a SENHA_PADRAO — sem sessão não dá pra provar a porta.'); process.exit(1); }

  // ══════════ 1. O NÚMERO ERRADO É RECUSADO, COM MENSAGEM CLARA ══════════
  console.log('  ─── 1. o número ERRADO ───');
  const { neg: negF } = await achaOuCria(T_FELIZ, {
    numero: `${lic.numero_compra}/${lic.ano}`, orgao: lic.orgao, municipio: lic.municipio, uf: lic.uf,
    objeto: 'Registro da prova da fatia B13 (caminho feliz). Nasce ARQUIVADO. Pode ser apagado.',
  });
  const itensAntes = await conta(negF.numero_controle);

  const eErr = await chamaEdge(tk, { numero_controle: ERRADO, negocio_id: negF.id, gravar: true });
  const aErr = decide(eErr.corpo);
  console.log(`  informado: ${ERRADO}`);
  console.log(`  servidor : HTTP ${eErr.http} · ${eErr.corpo.veredito} · gravou=${eErr.corpo.gravou}`);
  console.log(`  a tela   : ${aErr.tom} · ${aErr.rot} · botão=${aErr.botao || '(nenhum)'}`);
  console.log('  ' + linha1(eErr.corpo.mensagem));
  ok(n + '. *** o número inexistente é RECUSADO pela edge e NÃO grava (HTTP 409) ***',
    eErr.http === 409 && eErr.corpo.veredito === 'nao_existe' && eErr.corpo.gravou === false, eErr.corpo); n++;
  ok(n + '. *** e a TELA não oferece botão nenhum de gravar para ele ***',
    aErr.botao === null && aErr.tom === 'erro', aErr); n++;
  /* "Não deu certo" não é mensagem: a pessoa precisa saber O QUE conferir. */
  ok(n + '. ...com mensagem que nomeia o engano mais provável, e não só "número inválido"',
    /sequencial/.test(eErr.corpo.mensagem) && /número do edital/.test(eErr.corpo.mensagem)); n++;

  const eFmt = await chamaEdge(tk, { numero_controle: 'PE 60/2026', negocio_id: negF.id });
  const aFmt = decide(eFmt.corpo);
  ok(n + '. *** e o que nem é número de controle também: formato, sem botão, com o exemplo junto ***',
    eFmt.corpo.veredito === 'formato' && aFmt.botao === null
    && /03659166002156-1-000034\/2026/.test(eFmt.corpo.mensagem), eFmt.corpo.veredito); n++;
  console.log('  "PE 60/2026" -> ' + eFmt.corpo.veredito + ' · ' + linha1(eFmt.corpo.mensagem));

  // ══════════ 2. O NÚMERO CERTO: CONFERE, GRAVA, E O NEGÓCIO PASSA A ENXERGAR ══════════
  console.log('\n  ─── 2. o número CERTO, informado à mão ───');
  /* CONFERIR NÃO GRAVA — e isso se prova pedindo pra conferir e olhando o banco depois. */
  const eConf = await chamaEdge(tk, { numero_controle: CERTO, negocio_id: negF.id });
  const aConf = decide(eConf.corpo);
  const depoisDeConferir = (await le(`negocios?select=numero_controle&id=eq.${negF.id}`))[0];
  console.log(`  conferir : HTTP ${eConf.http} · ${eConf.corpo.veredito} · gravou=${eConf.corpo.gravou}`);
  console.log(`  o PNCP diz: ${eConf.corpo.orgao_pncp || '(não respondeu o órgão)'}`);
  console.log(`  a tela   : ${aConf.tom} · botão="${aConf.botao}" · confirmar=${aConf.confirmar}`);
  ok(n + '. *** conferir CONFERE contra o PNCP e a tela oferece o botão de gravar ***',
    eConf.corpo.veredito === 'confere' && aConf.tom === 'ok' && !!aConf.botao, { v: eConf.corpo.veredito, a: aConf }); n++;
  ok(n + '. *** e conferir NÃO GRAVOU (o banco continua como estava) ***',
    eConf.corpo.gravou === false
    && (depoisDeConferir.numero_controle || null) === (negF.numero_controle || null),
    { edge: eConf.corpo.gravou, banco: depoisDeConferir.numero_controle }); n++;
  ok(n + '. *** e a tela não manda `confirmado` num caso que confere ***', aConf.confirmar === false); n++;

  const eGrava = await chamaEdge(tk, { numero_controle: CERTO, negocio_id: negF.id, gravar: true });
  console.log(`  gravar   : HTTP ${eGrava.http} · gravou=${eGrava.corpo.gravou} · licitacao_id=${eGrava.corpo.licitacao_id}`);
  ok(n + '. *** o segundo clique grava OS DOIS campos (chave do PNCP e id do índice) ***',
    eGrava.corpo.gravou === true && eGrava.corpo.licitacao_id === lic.id,
    { gravou: eGrava.corpo.gravou, licitacao_id: eGrava.corpo.licitacao_id, esperado: lic.id }); n++;

  const negF2 = (await le(`negocios?select=numero_controle,licitacao_id&id=eq.${negF.id}`))[0];
  ok(n + '. *** e a chave está no banco, não só na resposta ***',
    negF2.numero_controle === CERTO && negF2.licitacao_id === lic.id, negF2); n++;

  /* "AGORA ESTE NEGÓCIO TEM N ITENS" — a frase que a caixa pede é uma CONTAGEM, e é ela que a
     ficha mostra. Aqui ela é medida do mesmo lugar de onde a tela a lê. */
  const itensDepois = await conta(CERTO);
  console.log(`\n  itens que este negócio enxerga: ${itensAntes.itens} -> ${itensDepois.itens}`);
  console.log(`  destes, com resultado publicado: ${itensAntes.comResultado} -> ${itensDepois.comResultado}`);
  ok(n + '. *** o negócio passa a LISTAR os itens do edital ***', itensDepois.itens > 0, itensDepois); n++;
  ok(n + '. *** e o RESULTADO por item vem junto (é isso que a Ata antiga foi buscar) ***',
    itensDepois.comResultado > 0, itensDepois); n++;
  const amostra = await le('licitacao_itens?select=numero_item,descricao,resultado_vencedor,resultado_valor_unit'
    + `&numero_controle=eq.${encodeURIComponent(CERTO)}&resultado_lido_em=not.is.null&order=numero_item.asc&limit=2`);
  for (const g of amostra) {
    console.log(`    item ${g.numero_item}: ${String(g.descricao).slice(0, 48)}`);
    console.log(`      vencedor ${g.resultado_vencedor || '—'} · unit. ${g.resultado_valor_unit}`);
  }
  ok(n + '. ...e eles têm vencedor e valor de verdade',
    amostra.length > 0 && amostra.every(g => g.resultado_vencedor && g.resultado_valor_unit != null)); n++;

  // ══════════ 3. O AVISO: EXISTE, MAS O NOME NÃO BATE — E PRECISA DE "SIM" ══════════
  console.log('\n  ─── 3. o caso de AVISO (divergência de nome) ───');
  /* O MESMO número certo, num negócio de outro município. É assim que o aviso nasce no mundo
     real: o nome do órgão é texto escrito por gente, e "MUNICIPIO DE X" / "P. M. X" são a mesma
     entidade — por isso ele AVISA em vez de bloquear. */
  const { neg: negA } = await achaOuCria(T_AVISO, {
    numero: `${lic.numero_compra}/${lic.ano}`,
    orgao: 'MUNICIPIO DE JATAI', municipio: 'Jataí', uf: 'GO',
    objeto: 'Registro da prova da fatia B13 (divergência de órgão/município). Nasce ARQUIVADO. Pode ser apagado.',
  });
  const eDiv = await chamaEdge(tk, { numero_controle: CERTO, negocio_id: negA.id });
  const aDiv = decide(eDiv.corpo);
  console.log(`  servidor : ${eDiv.corpo.veredito} · podeGravar=${eDiv.corpo.podeGravar}`);
  for (const d of (eDiv.corpo.divergencias || []))
    console.log(`    ${d.campo}: PNCP "${d.informado}" x negócio "${d.negocio}" · bloqueia=${d.bloqueia}`);
  console.log(`  a tela   : ${aDiv.tom} · botão="${aDiv.botao}" · confirmar=${aDiv.confirmar}`);
  ok(n + '. *** o número existe, mas o nome não bate: veredito `diverge` que AVISA (não bloqueia) ***',
    eDiv.corpo.veredito === 'diverge' && eDiv.corpo.podeGravar === true
    && (eDiv.corpo.divergencias || []).some(d => d.bloqueia === false), eDiv.corpo.divergencias); n++;
  ok(n + '. *** a TELA pinta em âmbar e o botão que ela oferece EXIGE confirmação ***',
    aDiv.tom === 'aviso' && !!aDiv.botao && aDiv.confirmar === true, aDiv); n++;

  /* GRAVAR SEM O "SIM" TEM QUE FALHAR. Se passasse, o botão "gravar assim mesmo" seria enfeite —
     e a confirmação que a caixa pede não existiria de fato. */
  const eSemSim = await chamaEdge(tk, { numero_controle: CERTO, negocio_id: negA.id, gravar: true });
  console.log(`  gravar sem confirmar -> HTTP ${eSemSim.http} · gravou=${eSemSim.corpo.gravou} · precisaConfirmar=${eSemSim.corpo.precisaConfirmar}`);
  ok(n + '. *** gravar SEM o "sim" explícito é recusado (409) e não grava ***',
    eSemSim.http === 409 && eSemSim.corpo.gravou === false && eSemSim.corpo.precisaConfirmar === true, eSemSim.corpo); n++;

  const eComSim = await chamaEdge(tk, { numero_controle: CERTO, negocio_id: negA.id, gravar: true, confirmado: true });
  console.log(`  gravar COM confirmação -> HTTP ${eComSim.http} · gravou=${eComSim.corpo.gravou}`);
  ok(n + '. *** e COM o "sim" ele grava — a decisão é da pessoa, e ela foi tomada ***',
    eComSim.corpo.gravou === true, eComSim.corpo); n++;

  // ══════════ 4. "NÃO CONSEGUI PERGUNTAR" NUNCA VIRA "NÃO EXISTE" ══════════
  /* Não dá pra derrubar o PNCP pra medir, e não se derruba serviço público pra testar. O que dá
     pra medir é o que a TELA faz com essa resposta — e é ela que erraria. */
  console.log('\n  ─── 4. o veredito que não acusa ninguém ───');
  const aSei = decide({ veredito: 'nao_sei', podeGravar: false, divergencias: [], mensagem: 'Não consegui falar com o PNCP agora…' });
  console.log(`  nao_sei -> tela: ${aSei.tom} · "${aSei.rot}" · botão=${aSei.botao || '(nenhum)'}`);
  ok(n + '. *** `nao_sei` sai em ÂMBAR, sem botão, e o rótulo fala de MIM e não do número ***',
    aSei.tom === 'aviso' && aSei.botao === null && !/errado|inválid|existe/i.test(aSei.rot), aSei); n++;

  // ── e a porta continua exigindo sessão ─────────────────────────────────────────────────
  const semTok = await fetch(`${SB}/functions/v1/valida-controle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numero_controle: CERTO }),
  });
  ok(n + '. (controle) a edge exige sessão — 401 sem Bearer', semTok.status === 401, semTok.status); n++;

  console.log('\n  ⚠️  PENDÊNCIA: os negócios ' + negF.id + ' e ' + negA.id + ' são registros de PROVA');
  console.log('      (nascem arquivados, e o título diz). Apagá-los é um DELETE — decisão do dono.');
  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;

  async function conta(controle) {
    if (!controle) return { itens: 0, comResultado: 0 };
    const q = async filtro => {
      const r = await fetch(`${SB}/rest/v1/licitacao_itens?select=id`
        + `&numero_controle=eq.${encodeURIComponent(controle)}${filtro}`,
        { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
      return Number((r.headers.get('content-range') || '').split('/')[1]) || 0;
    };
    return { itens: await q(''), comResultado: await q('&resultado_lido_em=not.is.null') };
  }
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
