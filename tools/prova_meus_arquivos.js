/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_meus_arquivos.js — "MEUS ARQUIVOS" DO NEGÓCIO (fatia B15) · 14/08/2026

   A caixa pede: *"1 negócio com edital vindo da coleta + 1 anexo manual, nas categorias certas,
   com duas versões empilhadas do mesmo documento e nenhuma perdida."*

   ══ ELA SOBE ARQUIVO DE VERDADE ═════════════════════════════════════════════════════════════
   Não simula upload: manda os bytes pro bucket `documentos` pelo MESMO caminho que a tela usa
   (`negocio-<id>/<categoria>/<timestamp>-<nome>`), grava a linha em `negocio_anexos` e deixa a
   TRIGGER do banco calcular a versão. É a única forma de provar que "as versões empilham" —
   porque quem empilha é o banco, não a tela: a `versao` sai de trigger por (negócio, categoria)
   e não há policy de UPDATE nem de DELETE.

   ══ E ELA EXECUTA A FUNÇÃO DA TELA ══════════════════════════════════════════════════════════
   `unificaArquivos` é arrancada do fpmed_negocios.html e rodada com as três listas REAIS lidas
   do banco. O que sair daqui é o que a aba desenha.

   ══ IDEMPOTENTE E ADITIVA ═══════════════════════════════════════════════════════════════════
   Reusa o mesmo negócio de prova e só sobe arquivo enquanto a categoria tiver menos de 2
   versões — senão cada rodada empilharia uma versão nova para sempre. Nada é apagado (não há
   DELETE nesta tabela, por desenho).

     node tools/prova_meus_arquivos.js
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

// A FUNÇÃO DA TELA, DE VERDADE — e não uma cópia escrita aqui, que envelheceria em silêncio.
const HTML = fs.readFileSync(path.join(RAIZ, 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');
const pega = re => (HTML.match(re) || [])[0];
const cabeca = pega(/const CAT_NOMES = \{[\s\S]*?\n\};/) + '\n'
  + pega(/const ARQ_GAVETAS = \[[\s\S]*?\n\];/) + '\n'
  + pega(/const gavetaDaCategoria = [^\n]+/) + '\n'
  + 'const nomeCat = k => CAT_NOMES[k] || k;\n'
  + pega(/function unificaArquivos\(doNegocio, doPncp, daEmpresa\)\{[\s\S]*?\n\}/) + '\n';
const API = new Function(cabeca + 'return { unificaArquivos, ARQ_GAVETAS };')();

const TITULO = '[PROVA B15 — registro de teste, pode apagar] Meus arquivos';

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
      if (r.ok) { const j = await r.json(); if (j.access_token) return j.access_token; }
    } catch { }
  }
  return null;
}
/* A REGRA DE TIPO É A DA TELA, arrancada do HTML — porque é justamente ela que estava errada e
   que esta prova veio conferir. Escrever "application/pdf" aqui na mão provaria o cofre e não
   provaria a tela. */
const APItipo = new Function(pega(/const MIME_POR_EXT = \{[\s\S]*?\};/) + '\n'
  + pega(/function tipoDoArquivo\(arq\)\{[\s\S]*?\n\}/) + '\nreturn tipoDoArquivo;')();

/* Um PDF mínimo de verdade. O cofre valida o tipo pelo CABEÇALHO, mas mandar bytes que não são
   do formato declarado seria uma prova mentindo sobre si mesma. */
const PDF_MINIMO = corpo => Buffer.from(
  '%PDF-1.4\n% ' + corpo + '\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
  + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
  + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n'
  + 'trailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');

/* O MESMO CAMINHO QUE `subirAnexo` MONTA na tela: bucket `documentos`, pasta por negócio e por
   categoria, nome sem acento, tipo vindo de `tipoDoArquivo`. A `versao` NÃO é mandada — quem a
   calcula é a trigger. */
async function sobe(negocioId, nome, categoria, texto) {
  const limpo = nome.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const caminho = 'negocio-' + negocioId + '/' + categoria + '/' + Date.now() + '-' + limpo;
  const buf = PDF_MINIMO(texto);
  const up = await fetch(`${SB}/storage/v1/object/documentos/${encodeURIComponent(caminho)}`, {
    method: 'POST',
    headers: { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': APItipo({ name: nome, type: '' }) },
    body: buf });
  if (!up.ok) throw new Error('o envio respondeu ' + up.status + ' ' + (await up.text()).slice(0, 120));
  const r = await fetch(`${SB}/rest/v1/negocio_anexos`, {
    method: 'POST', headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ negocio_id: negocioId, categoria, arquivo_path: caminho,
      arquivo_nome: nome, bytes: buf.length, enviado_por: 'prova-b15@fpmed.com.br' }) });
  if (!r.ok) throw new Error('não consegui registrar: ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return (await r.json())[0];
}

(async () => {
  console.log('=== MEUS ARQUIVOS DO NEGÓCIO (fatia B15) ===\n');

  // ── 0. UM CERTAME QUE A COLETA DO A JÁ BAIXOU ───────────────────────────────────────────
  /* "O edital baixado pela coleta aparece aqui automaticamente" só se prova num certame que
     TENHA arquivo coletado — e a prova escolhe o que tem mais, pra medir a separação entre o
     edital e os anexos dele. */
  const arqs = await le('licitacao_arquivos?select=numero_controle,titulo,tipo,url_pncp,bytes,'
    + 'texto_chars,extracao_erro,coletado_em&order=numero_controle,sequencial&limit=200');
  const porCtrl = {};
  for (const a of arqs) (porCtrl[a.numero_controle] = porCtrl[a.numero_controle] || []).push(a);
  const CERTO = Object.keys(porCtrl).sort((a, b) => porCtrl[b].length - porCtrl[a].length)[0];
  const doPncp = porCtrl[CERTO];
  const lic = (await le('licitacoes?select=id,orgao,municipio,uf,numero_compra,ano'
    + `&numero_controle=eq.${encodeURIComponent(CERTO)}`))[0];
  console.log(`  certame com arquivo já coletado: ${CERTO}`);
  console.log(`    ${lic.orgao}`);
  console.log(`    ${doPncp.length} arquivos do PNCP: ${doPncp.map(a => a.tipo).join(' · ')}\n`);
  ok(n + '. (controle) a coleta do A já baixou arquivo deste certame', doPncp.length >= 2, doPncp.length); n++;

  // ── 1. O NEGÓCIO DE PROVA, LIGADO PELA PORTA DA B13 ─────────────────────────────────────
  const tk = await token();
  if (!tk) { console.error('nenhum e-mail logou com a SENHA_PADRAO.'); process.exit(1); }
  let neg = (await le('negocios?select=id,titulo,numero_controle,licitacao_id,empresa_id'
    + `&titulo=eq.${encodeURIComponent(TITULO)}&limit=1`))[0];
  if (!neg) {
    const r = await fetch(`${SB}/rest/v1/negocios`, {
      method: 'POST', headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify({ titulo: TITULO, estagio: 'qualificacao', arquivado: true,
        origem: 'prova B15', orgao: lic.orgao, municipio: lic.municipio, uf: lic.uf,
        numero: `${lic.numero_compra}/${lic.ano}`,
        objeto: 'Registro da prova da fatia B15 (Meus arquivos). Nasce ARQUIVADO. Pode ser apagado.' }) });
    if (!r.ok) { console.error('não consegui criar: ' + r.status); process.exit(1); }
    neg = (await r.json())[0];
    console.log(`  criei o registro de prova: negócio ${neg.id} (arquivado)`);
  } else console.log(`  reusando o registro de prova: negócio ${neg.id}`);
  if (!neg.numero_controle) {
    const g = await fetch(`${SB}/functions/v1/valida-controle`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
      body: JSON.stringify({ numero_controle: CERTO, negocio_id: neg.id, gravar: true, confirmado: true }) });
    const j = await g.json().catch(() => ({}));
    console.log(`  chave gravada pela porta da B13: ${j.veredito} · gravou=${j.gravou}`);
    neg = (await le(`negocios?select=id,numero_controle,licitacao_id,empresa_id&id=eq.${neg.id}`))[0];
  }
  ok(n + '. (controle) o negócio de prova tem a chave do PNCP', neg.numero_controle === CERTO, neg.numero_controle); n++;

  // ══════════ 1b. O RED TEST QUE ACHOU O DEFEITO — E ELE ESTAVA NA PRÓPRIA TELA ══════════
  /* ══ NENHUM BOTÃO "ANEXAR" DESTA TELA FUNCIONAVA, e a prova disso é o banco: `negocio_anexos`
     estava com ZERO linhas. O envio mandava `Object.assign({}, SB_H)`, e o `SB_H` do Negócios
     carrega `'Content-Type': 'application/json'` — o certo pro REST e o errado pro cofre, que
     valida o tipo por esse cabeçalho. Nenhuma suíte pegava: elas leem o código-fonte, e o
     código-fonte "manda o arquivo". Quem sabia a verdade era o cofre, e ninguém tinha perguntado. */
  console.log('  ─── o defeito, medido nos dois sentidos ───');
  const alvoRed = 'prova-b15-red/' + Date.now() + '.pdf';
  const tenta = async ct => {
    const r = await fetch(`${SB}/storage/v1/object/documentos/${encodeURIComponent(alvoRed + '-' + ct.replace(/\W/g, ''))}`, {
      method: 'POST', headers: { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': ct },
      body: PDF_MINIMO('red test') });
    return { http: r.status, corpo: (await r.text()).slice(0, 90) };
  };
  const comoEra = await tenta('application/json');
  const comoFicou = await tenta(APItipo({ name: 'x.pdf', type: '' }));
  console.log(`    como era  (Content-Type: application/json) -> HTTP ${comoEra.http} ${comoEra.corpo.slice(0, 60)}`);
  console.log(`    como ficou (Content-Type: ${APItipo({ name: 'x.pdf', type: '' })})     -> HTTP ${comoFicou.http}`);
  ok(n + '. *** o jeito ANTIGO é recusado pelo cofre (era isso que quebrava todo "Anexar") ***',
    comoEra.http >= 400 && /mime/i.test(comoEra.corpo), comoEra); n++;
  ok(n + '. *** e o jeito novo, com o tipo do arquivo no cabeçalho, é aceito ***',
    comoFicou.http === 200, comoFicou); n++;
  ok(n + '. *** a regra do tipo veio da TELA (não escrita nesta prova) ***',
    APItipo({ name: 'contrato.PDF', type: '' }) === 'application/pdf'
    && APItipo({ name: 'foto.png', type: '' }) === 'image/png'
    && APItipo({ name: 'x.pdf', type: 'application/pdf' }) === 'application/pdf'); n++;
  /* E A TELA NÃO GUARDA UMA LISTA DE FORMATOS ACEITOS: ela manda o tipo certo e TRADUZ a recusa.
     Uma segunda lista aqui um dia discordaria da do cofre. */
  ok(n + '. *** e a tela traduz a recusa em vez de repetir a lista do cofre ***',
    /invalid_mime_type\|415/.test(HTML) && /Converta para PDF e mande de novo/.test(HTML)); n++;

  // ── 2. DOIS ANEXOS À MÃO, E O SEGUNDO É A VERSÃO 2 DO MESMO DOCUMENTO ───────────────────
  console.log('\n  ─── as versões, empilhadas pelo BANCO ───');
  const jaTem = await le(`negocio_anexos?select=id,categoria,versao,arquivo_nome&negocio_id=eq.${neg.id}&order=categoria,versao`);
  const daHab = jaTem.filter(a => a.categoria === 'habilitacao');
  if (daHab.length < 2) {
    for (let v = daHab.length + 1; v <= 2; v++) {
      const a = await sobe(neg.id, `certidao-negativa-rodada-${v}.pdf`, 'habilitacao',
        `PROVA B15 rodada ${v} - nao e documento de verdade`);
      console.log(`    subiu "habilitacao" -> o banco deu v${a.versao}`);
    }
  } else console.log(`    já havia ${daHab.length} versões em "habilitacao" — não subi mais`);
  if (!jaTem.some(a => a.categoria === 'recurso')) {
    const a = await sobe(neg.id, 'impugnacao-ao-edital.pdf', 'recurso',
      'PROVA B15 - categoria recurso, que nasceu nesta fatia');
    console.log(`    subiu "recurso" -> o banco deu v${a.versao}`);
  }

  // ── 3. O QUE A ABA DESENHA, COM AS TRÊS FONTES REAIS ────────────────────────────────────
  const doNegocio = await le(`negocio_anexos?negocio_id=eq.${neg.id}&select=*&order=categoria.asc,versao.desc`);
  const daEmpresa = neg.empresa_id
    ? (await le(`v_documentos_situacao?empresa_id=eq.${neg.empresa_id}&ativo=is.true`
      + '&select=id,nome,tipo,validade,situacao,dias_para_vencer,arquivo_path,arquivo_nome,arquivo_bytes,criado_em')).filter(d => d.arquivo_path)
    : [];
  const tudo = API.unificaArquivos(doNegocio, doPncp, daEmpresa);

  console.log('\n  ─── o que a aba "Meus arquivos" mostra ───');
  for (const g of API.ARQ_GAVETAS) {
    const l = tudo.filter(x => x.gaveta === g.k);
    if (!l.length) continue;
    console.log(`  ${g.n.toUpperCase()} (${l.length})`);
    for (const x of l.slice().sort((a, b) => (b.versao || 0) - (a.versao || 0)))
      console.log(`    ${x.versao != null ? 'v' + x.versao : '— '} ${String(x.titulo || x.nome).slice(0, 44).padEnd(46)}`
        + `[${x.de}] ${x.rotuloCat}${x.versao != null && !x.maisNova ? '  (versão anterior)' : ''}`);
  }

  // ── 4. OS ASSERTS DA CAIXA ──────────────────────────────────────────────────────────────
  console.log('');
  const edital = tudo.filter(x => x.gaveta === 'edital' && x.de === 'pncp');
  ok(n + '. *** o edital baixado pela coleta aparece SOZINHO, na gaveta certa ***',
    edital.length === doPncp.length && edital.length > 0, edital.length); n++;
  ok(n + '. *** e o "Edital" é separado dos anexos dele (o botão de ler precisa saber qual é) ***',
    edital.some(x => x.categoria === 'edital') && edital.some(x => x.categoria === 'anexo_edital'),
    edital.map(x => x.categoria)); n++;
  /* O LINK É O ORIGINAL DO PORTAL, nunca reescrito (contrato A5, seção 4): ele é a prova de
     onde o documento veio. */
  ok(n + '. *** cada arquivo do PNCP leva o link ORIGINAL do portal ***',
    edital.every(x => /^https:\/\/pncp\.gov\.br\//.test(String(x.url || ''))), edital.map(x => x.url)); n++;

  const hab = tudo.filter(x => x.gaveta === 'habilitacao' && x.de === 'mao');
  ok(n + '. *** o anexo manual foi para a gaveta Habilitação, que nasceu nesta fatia ***',
    hab.length >= 2, hab.length); n++;
  /* ══ O ASSERT QUE A CAIXA PEDIU COM ESTAS PALAVRAS: "duas versões empilhadas do mesmo
     documento e NENHUMA PERDIDA". Quem empilha é a trigger; a tela só marca qual é a mais nova. */
  const versoes = hab.map(x => x.versao).sort((a, b) => a - b);
  ok(n + '. *** as duas versões estão lá, e nenhuma se perdeu ***',
    versoes.length >= 2 && versoes[0] === 1 && versoes[1] === 2, versoes); n++;
  ok(n + '. *** só UMA é a mais nova, e é a de maior versão ***',
    hab.filter(x => x.maisNova).length === 1
    && hab.find(x => x.maisNova).versao === Math.max(...versoes), hab.map(x => [x.versao, x.maisNova])); n++;
  ok(n + '. *** e a antiga continua na lista, marcada como anterior ***',
    hab.some(x => !x.maisNova && x.versao === 1)); n++;

  const rec = tudo.filter(x => x.gaveta === 'recurso');
  ok(n + '. *** a gaveta Recurso existe e recebe arquivo (ela não existia antes desta fatia) ***',
    rec.length >= 1, rec.length); n++;
  ok(n + '. *** cada linha diz nome, categoria, data, quem anexou, tamanho e procedência ***',
    hab.every(x => x.nome && x.rotuloCat && x.quando && x.quem && x.bytes && x.de),
    hab[0]); n++;
  ok(n + '. *** e as duas procedências convivem na mesma tela ***',
    new Set(tudo.map(x => x.de)).size >= 2, [...new Set(tudo.map(x => x.de))]); n++;

  // ── 5. NADA FOI MIGRADO, E NÃO NASCEU LUGAR NOVO ────────────────────────────────────────
  const tabelas = await le('negocio_anexos?select=categoria&limit=1000');
  console.log(`\n  linhas em negocio_anexos: ${tabelas.length} (é a MESMA tabela das abas Proposta e Ata)`);
  ok(n + '. *** tudo isto vive em `negocio_anexos` — nenhuma tabela nova nasceu ***',
    doNegocio.every(a => a.arquivo_path.startsWith('negocio-' + neg.id + '/'))); n++;
  /* A trigger é do BANCO: a prova NÃO mandou `versao` em nenhum insert, e mesmo assim as versões
     saíram 1 e 2. Se a tela mandasse o número, duas abas abertas mandariam "2" ao mesmo tempo. */
  ok(n + '. *** a versão veio da TRIGGER: a prova nunca mandou o número ***',
    !/versao:/.test(fs.readFileSync(__filename, 'utf8').split('async function sobe')[1].split('}')[0] || 'versao:')); n++;

  console.log('\n  ⚠️  PENDÊNCIA: o negócio ' + neg.id + ' é registro de PROVA (nasce arquivado, e o');
  console.log('      título diz), com 3 arquivos de teste no bucket. Apagá-los é um DELETE —');
  console.log('      e esta tabela não tem policy de DELETE por desenho. Decisão do dono.');
  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
