/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_ean_na_proposta.js — EAN E REGISTRO ANVISA NA PROPOSTA (fatia B17) · 14/08/2026

   A caixa pede: *"1 proposta real com item que tem EAN e item que não tem, cada um com o texto
   certo"*.

   ══ E A PRIMEIRA MEDIÇÃO JÁ MUDOU A FATIA ═══════════════════════════════════════════════════
   Perguntei ao banco antes de escrever tela, e ele respondeu duas coisas que o código-fonte não
   contava:
     · `cotacoes`: 8.832 linhas, **0 com EAN**, **0 com registro_anvisa** — as colunas nasceram
       na B7 e continuam inteiramente vazias;
     · `orcamentos`: **0 linhas** — nenhuma proposta foi salva neste banco até hoje.
   Ou seja: "1 proposta real com item que tem EAN" não EXISTE para ser lida. Então esta prova
   monta a proposta do jeito que a tela monta — em memória, a partir de linhas REAIS — e vai
   buscar a causa de os campos estarem vazios, que é o que a fatia tinha de resolver de verdade.

   ══ O ITEM "COM EAN" NÃO É INVENTADO ════════════════════════════════════════════════════════
   Ele é montado de uma linha REAL da `cmed_pf` (EAN, laboratório e registro oficiais, do mesmo
   jeito que o `eanAplicar` do cadastro monta). O que esta prova NÃO faz é gravar esse EAN numa
   linha de `cotacoes`: casar produto por nome e gravar é exatamente a invenção que o projeto
   proíbe desde a B7 — um palpite gravado num campo de identidade não deixa rastro de que era
   palpite. Quem digita é gente.

     node tools/prova_ean_na_proposta.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const ANON = (seg.match(/anon[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

const HTML = fs.readFileSync(path.join(RAIZ, 'fpmed_giovana.html'), 'utf8').replace(/\r\n/g, '\n');
const pega = re => (HTML.match(re) || [])[0] || '';

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

/* A PENDÊNCIA É LIDA COM O CRACHÁ DO NAVEGADOR, e não com a service_role. A B16 acabou de
   custar uma fatia inteira por causa disso: medir com a chave que passa por cima da RLS prova o
   servidor e não prova a tela. `cotacoes` só responde a quem tem sessão. */
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';
async function token() {
  for (const email of ['licitacao@fpmed.com.br', 'comercial@fpmed.com.br']) {
    try {
      const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: SENHA }) });
      if (r.ok) { const j = await r.json(); if (j.access_token) return { tk: j.access_token, email }; }
    } catch { }
  }
  return null;
}
async function le(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(q + ' -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 140));
  return r.json();
}
async function conta(q) {
  const r = await fetch(`${SB}/rest/v1/${q}&limit=1`, { headers: { ...H, Prefer: 'count=exact' } });
  const cr = r.headers.get('content-range') || '';
  const t = (cr.split('/')[1] || '').trim();
  return /^\d+$/.test(t) ? +t : null;
}

/* ══ AS FUNÇÕES SÃO ARRANCADAS DA TELA — o que roda aqui é o que a tela desenha ═══════════════ */
const TELA = new Function(
  pega(/function _escEd\(s\)\{[\s\S]*?\n\}/) + '\n'
  + pega(/function esc\(s\)\{[^\n]*\n/) + '\n'
  + pega(/function eanValido\(v\) \{[\s\S]*?\n\}/) + '\n'
  + pega(/function identidadeDoItem\(c\)\{[\s\S]*?\n\}/) + '\n'
  + pega(/function identidadeHTML\(c\)\{[\s\S]*?\n\}/) + '\n'
  + 'return { identidadeDoItem, identidadeHTML, eanValido, temPodeImportar: typeof podeImportarCotacao };'
)();

(async () => {
  console.log('=== EAN E REGISTRO ANVISA NA PROPOSTA (fatia B17) ===\n');

  // ══════════ 1. O ESTADO DO BANCO, QUE FOI QUEM CONTOU A VERDADE ═══════════════════════════
  console.log('  ─── o que o banco respondeu ───');
  const total = await conta('cotacoes?select=id');
  const comEan = await conta('cotacoes?select=id&ean=not.is.null');
  const comReg = await conta('cotacoes?select=id&registro_anvisa=not.is.null');
  const semEanEstoque = await conta('cotacoes?select=id&ean=is.null&estoque=gt.0');
  const orcs = await conta('orcamentos?select=id');
  console.log(`    cotacoes: ${total} linhas · com EAN: ${comEan} · com registro ANVISA: ${comReg}`);
  console.log(`    sem EAN e com estoque (a fila da pendência): ${semEanEstoque}`);
  console.log(`    orcamentos (propostas salvas): ${orcs}`);
  ok(n + '. (controle) as colunas da B7 existem no banco (a consulta não deu 400)',
    comEan !== null && comReg !== null); n++;
  ok(n + '. *** e elas estão VAZIAS: nenhum EAN e nenhum registro foi gravado até hoje ***',
    comEan === 0 && comReg === 0, [comEan, comReg]); n++;

  // ══════════ 2. O RED TEST: POR QUE ESTAVAM VAZIAS ═════════════════════════════════════════
  /* `hdr()` e `esc()` são chamados por três funções da fatia do EAN e não eram declarados em
     lugar nenhum — nem neste arquivo, nem nos nove scripts que a tela carrega. Isto não se prova
     lendo: prova-se EXECUTANDO a função da tela nos dois estados. */
  console.log('\n  ─── o defeito, executado nos dois estados ───');
  const sess = await token();
  if (!sess) { console.error('nenhum e-mail logou com a SENHA_PADRAO.'); process.exit(1); }
  console.log(`    (com o crachá do navegador: sessão de ${sess.email})`);
  const fPend = pega(/async function abrirPendenciaEan\(alvo\) \{[\s\S]*?\n\}/);
  const stubDom = () => {
    let escrito = '';
    return { el: { style: {}, set innerHTML(v){ escrito = v; }, get innerHTML(){ return escrito; } },
             lido: () => escrito };
  };
  const rodaPendencia = async (comAjudantes, alvo) => {
    const d = stubDom();
    const ambiente = {
      document: { getElementById: () => d.el },
      LIMEDTEC: { rest: c => `${SB}/rest/v1/${c}` },
      fetch,
      // o par que faltava — a prova liga e desliga para mostrar a diferença
      ...(comAjudantes ? {
        hdr: () => ({ apikey: ANON, Authorization: 'Bearer ' + sess.tk }),
        esc: s => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])),
      } : {}),
    };
    const chaves = Object.keys(ambiente);
    let erro = null;
    try {
      const fn = new Function(...chaves, fPend + '\nreturn abrirPendenciaEan;')(...chaves.map(k => ambiente[k]));
      await fn(alvo);
    } catch (e) { erro = e; }
    return { erro, html: d.lido() };
  };
  const antes = await rodaPendencia(false);
  const depois = await rodaPendencia(true);
  // o texto do catch vem com <b> no meio; comparar sem as marcações é o que mede o que se vê
  const semTags = s => String(s).replace(/<[^>]*>/g, '');
  const caiuNoCatch = /não quer dizer que está tudo preenchido/.test(semTags(antes.html));
  console.log(`    sem hdr()/esc()  -> a tela mostra: "${antes.html.replace(/<[^>]*>/g, '').slice(0, 66)}…"`);
  console.log(`    com hdr()/esc()  -> a tela mostra: "${depois.html.replace(/<[^>]*>/g, '').slice(0, 66)}…"`);
  ok(n + '. *** sem os dois ajudantes, a pendência SEMPRE caía no aviso de falha ***',
    caiuNoCatch, antes.html.slice(0, 120)); n++;
  ok(n + '. *** com eles, a mesma função conta a fila de verdade e desenha a lista ***',
    /itens .*sem código de barras/.test(depois.html) && /<div style="max-height/.test(depois.html),
    depois.html.slice(0, 140)); n++;
  ok(n + '. *** e o número que ela mostra é o do banco, não o tamanho da página ***',
    depois.html.includes(String(semEanEstoque).replace(/\B(?=(\d{3})+(?!\d))/g, '.')),
    [semEanEstoque, depois.html.slice(0, 120)]); n++;
  /* O par existe AGORA no arquivo, e é um só escapador: dois seria onde um deles um dia
     deixa passar uma aspa. */
  ok(n + '. *** `hdr` e `esc` passaram a ser declarados na tela ***',
    /^function hdr\(\)\{ return Object\.assign/m.test(HTML) && /^function esc\(s\)\{ return _escEd/m.test(HTML)); n++;

  // ══════════ 3. O ATALHO LEVA O PRODUTO JUNTO ══════════════════════════════════════════════
  console.log('\n  ─── o atalho da pendência, com o produto identificado ───');
  const fila = await le('cotacoes?select=produto,marca,und,estoque&ean=is.null&produto=not.is.null'
    + '&estoque=gt.0&order=produto.asc&limit=1');
  const alvoReal = (fila[0] || {}).produto;
  const comAlvo = await rodaPendencia(true, alvoReal);
  const semTal = await rodaPendencia(true, 'PRODUTO QUE NAO EXISTE NA FILA — PROVA B17');
  console.log(`    alvo real: "${String(alvoReal).slice(0, 58)}"`);
  ok(n + '. *** o produto que veio da proposta aparece MARCADO e na frente da lista ***',
    comAlvo.html.includes('background:var(--ambar-50);font-weight:600'), comAlvo.html.slice(0, 100)); n++;
  ok(n + '. *** e um produto fora da fila é DITO, não some em silêncio ***',
    /não apareceu nesta lista/.test(semTal.html)); n++;
  ok(n + '. (controle) sem alvo, a lista continua a de sempre — nada marcado',
    !depois.html.includes('background:var(--ambar-50);font-weight:600')); n++;

  // ══════════ 4. A LINHA DO ITEM: UM COM EAN E UM SEM ═══════════════════════════════════════
  console.log('\n  ─── a proposta, montada como a tela monta ───');
  /* O item SEM EAN é uma linha real da `cotacoes` — e hoje TODAS são assim.
     O item COM EAN é montado de uma linha real da `cmed_pf`, do mesmo jeito que o `eanAplicar`
     do cadastro monta: EAN, laboratório e registro oficiais, nada inventado. */
  const semEan = (await le('cotacoes?select=id,produto,marca,und,ean,registro_anvisa'
    + '&ean=is.null&produto=not.is.null&estoque=gt.0&order=id&limit=1'))[0];
  const daCmed = (await le('cmed_pf?select=marca_norm,subst_norm,apresentacao,laboratorio,registro,ean1'
    + '&ean1=not.is.null&registro=not.is.null&limit=1'))[0];
  const comEanItem = {
    id: 'prova-b17', produto: [daCmed.marca_norm || daCmed.subst_norm, daCmed.apresentacao].filter(Boolean).join(' '),
    marca: daCmed.laboratorio, ean: daCmed.ean1, registro_anvisa: daCmed.registro };

  for (const [rot, it] of [['COM EAN', comEanItem], ['SEM EAN', semEan]]) {
    const id = TELA.identidadeDoItem(it);
    const html = TELA.identidadeHTML(it);
    console.log(`    ${rot}: ${String(it.produto).slice(0, 44).padEnd(46)}`);
    console.log(`             marca: ${it.marca || '—'}`);
    console.log(`             tela : ${html.replace(/<[^>]*>/g, '').trim()}`);
    ok(n + `. (controle) [${rot}] a identidade foi lida sem estourar`, !!id); n++;
  }
  const htmlCom = TELA.identidadeHTML(comEanItem), htmlSem = TELA.identidadeHTML(semEan);
  ok(n + '. *** o item COM EAN mostra o código e o registro ANVISA, sem enfeite ***',
    htmlCom.includes('EAN ' + daCmed.ean1) && htmlCom.includes('ANVISA ' + daCmed.registro)
    && !/sem EAN/.test(htmlCom), htmlCom); n++;
  ok(n + '. *** o item SEM EAN diz "sem EAN cadastrado" — e não some nem finge ***',
    /sem EAN cadastrado/.test(htmlSem) && !/EAN \d/.test(htmlSem), htmlSem); n++;
  ok(n + '. *** e diz também que falta o registro ANVISA ***',
    /sem registro ANVISA/.test(htmlSem)); n++;
  ok(n + '. *** o que falta NÃO é inventado: nenhum número aparece onde o banco tem nulo ***',
    TELA.identidadeDoItem(semEan).ean === null
    && TELA.identidadeDoItem(semEan).registro === null); n++;
  /* O EAN de verdade da CMED tem que FECHAR — se não fechasse, a fonte estaria podre e a tela
     estaria certa em denunciar. */
  ok(n + '. *** o EAN real da CMED fecha no dígito verificador ***',
    TELA.eanValido(daCmed.ean1) === true, daCmed.ean1); n++;
  const quebrado = { ...comEanItem, ean: String(daCmed.ean1).slice(0, 12) + ((+String(daCmed.ean1)[12] + 1) % 10) };
  ok(n + '. *** e um dígito trocado é DENUNCIADO, não exibido como se valesse ***',
    /não fecha/.test(TELA.identidadeHTML(quebrado)), TELA.identidadeHTML(quebrado)); n++;

  console.log('\n  ⚠️  NADA FOI GRAVADO NESTA PROVA. O item "com EAN" foi montado em memória a partir');
  console.log('      de uma linha real da CMED. Gravar esse EAN numa linha de `cotacoes` seria casar');
  console.log('      produto por nome — a invenção que o projeto proíbe desde a B7.');
  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
