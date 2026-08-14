/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_anexo_documentos.js — O "ANEXAR" DA TELA DOCUMENTOS (fatia B16) · 14/08/2026

   A caixa pede: *"subir 1 arquivo de verdade e ver a linha nascer; 1 tipo recusado mostrando a
   mensagem traduzida; assert que falha se o cabeçalho errado voltar."*

   ══ ELA NÃO PERGUNTA AO CÓDIGO-FONTE, PERGUNTA AO COFRE ═════════════════════════════════════
   A regra de ouro da B15 virou lei da caixa: prova de tela que só lê o código-fonte não prova
   nada sobre o servidor. Então esta prova percorre o MESMO caminho do navegador — inclusive
   com o MESMO crachá que o navegador carrega (o token da sessão, e não a service_role, que
   passa por cima de toda RLS e mentiria dizendo "funciona").

   ══ E FOI ASSIM QUE O DEFEITO APARECEU INTEIRO ══════════════════════════════════════════════
   A hipótese da caixa (Content-Type: application/json -> 415) é VERDADEIRA e não é a única:
   o `gm-auth.js` só troca o crachá em `/rest/v1/`, e o envio de arquivo vai para `/storage/v1/`.
   Ou seja: o arquivo subia com a chave `anon`, e a policy do cofre exige `authenticated` +
   `cargo_gestor()`. Duas travas, uma atrás da outra. Medidas as duas, nos dois sentidos.

     node tools/prova_anexo_documentos.js
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
const H_SR = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

/* ══ AS FUNÇÕES SÃO ARRANCADAS DA TELA, e não reescritas aqui ══════════════════════════════
   Se esta prova escrevesse "application/pdf" na mão, ela provaria o cofre e não provaria a
   tela — que é exatamente o buraco por onde o defeito da B15 passou. */
const HTML = fs.readFileSync(path.join(RAIZ, 'fpmed_documentos.html'), 'utf8').replace(/\r\n/g, '\n');
const pega = re => (HTML.match(re) || [])[0] || '';
const API = new Function(
  pega(/const MIME_POR_EXT = \{[\s\S]*?\};/) + '\n'
  + pega(/function tipoDoArquivo\(arq\)\{[\s\S]*?\n\}/) + '\n'
  + 'return { tipoDoArquivo, MIME_POR_EXT };')();

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

async function token() {
  for (const email of ['licitacao@fpmed.com.br', 'comercial@fpmed.com.br']) {
    try {
      const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: SENHA }),
      });
      if (r.ok) { const j = await r.json(); if (j.access_token) return { tk: j.access_token, email }; }
    } catch { }
  }
  return null;
}
async function le(q, tk) {
  const h = tk ? { apikey: ANON, Authorization: 'Bearer ' + tk } : H_SR;
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: h });
  if (!r.ok) throw new Error(q + ' -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return r.json();
}

/* Um PDF mínimo de verdade — mandar bytes que não são do formato declarado seria uma prova
   mentindo sobre si mesma. */
const PDF_MINIMO = corpo => Buffer.from(
  '%PDF-1.4\n% ' + corpo + '\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
  + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
  + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n'
  + 'trailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');

/* O ENVIO, COM O CRACHÁ E O TIPO QUE A GENTE MANDAR — é isto que a prova varia. */
async function envia({ auth, ct, alvo, corpo }) {
  const r = await fetch(`${SB}/storage/v1/object/documentos/${encodeURIComponent(alvo)}`, {
    method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + auth, 'Content-Type': ct },
    body: corpo });
  return { http: r.status, corpo: (await r.text()).slice(0, 160) };
}

const NOME_PROVA = '[PROVA B16 — registro de teste, pode apagar] CND de teste';

(async () => {
  console.log('=== O "ANEXAR" DA TELA DOCUMENTOS (fatia B16) ===\n');

  const s = await token();
  if (!s) { console.error('nenhum e-mail logou com a SENHA_PADRAO.'); process.exit(1); }
  console.log(`  sessão de verdade: ${s.email}`);

  // ── 0. O ESTADO DE PARTIDA, DITO PELO BANCO ─────────────────────────────────────────────
  const antes = await le('documentos?select=id');
  console.log(`  linhas em \`documentos\` antes desta prova: ${antes.length}\n`);

  // ══════════ 1. O DEFEITO, MEDIDO NOS DOIS SENTIDOS ══════════════════════════════════════
  console.log('  ─── as duas travas, uma atrás da outra ───');
  const base = 'prova-b16-red/' + Date.now();
  const tipoCerto = API.tipoDoArquivo({ name: 'cnd.pdf', type: '' });

  // (a) como era: crachá anon (o gm-auth só troca em /rest/v1/) + tipo certo
  const comAnon = await envia({ auth: ANON, ct: tipoCerto, alvo: base + '-anon.pdf', corpo: PDF_MINIMO('red anon') });
  // (b) crachá da sessão, mas o Content-Type do REST
  const comJson = await envia({ auth: s.tk, ct: 'application/json', alvo: base + '-json.pdf', corpo: PDF_MINIMO('red json') });
  // (c) como fica: crachá da sessão + tipo do arquivo
  const comCerto = await envia({ auth: s.tk, ct: tipoCerto, alvo: base + '-ok.pdf', corpo: PDF_MINIMO('red ok') });

  console.log(`    (a) crachá anon        + ${tipoCerto}   -> HTTP ${comAnon.http} ${comAnon.corpo.slice(0, 70)}`);
  console.log(`    (b) crachá da sessão   + application/json -> HTTP ${comJson.http} ${comJson.corpo.slice(0, 70)}`);
  console.log(`    (c) crachá da sessão   + ${tipoCerto}   -> HTTP ${comCerto.http}`);

  ok(n + '. *** o crachá `anon` é recusado pelo cofre (trava 1: a policy exige sessão) ***',
    comAnon.http >= 400, comAnon); n++;
  ok(n + '. *** o Content-Type do REST é recusado pelo cofre (trava 2: 415) ***',
    comJson.http >= 400 && /mime/i.test(comJson.corpo), comJson); n++;
  ok(n + '. *** com o crachá da sessão E o tipo do arquivo, o cofre aceita ***',
    comCerto.http === 200, comCerto); n++;

  // ── 2. A REGRA DE TIPO VEIO DA TELA ─────────────────────────────────────────────────────
  ok(n + '. *** a regra do tipo foi arrancada da TELA (não escrita nesta prova) ***',
    API.tipoDoArquivo({ name: 'contrato.PDF', type: '' }) === 'application/pdf'
    && API.tipoDoArquivo({ name: 'foto.png', type: '' }) === 'image/png'
    && API.tipoDoArquivo({ name: 'x.pdf', type: 'application/pdf' }) === 'application/pdf'); n++;

  // ══════════ 3. O CAMINHO INTEIRO: 1 ARQUIVO DE VERDADE, E A LINHA NASCENDO ══════════════
  console.log('\n  ─── o caminho inteiro, do jeito que a tela faz ───');
  let doc = (await le(`documentos?select=id,nome,arquivo_path,arquivo_nome,arquivo_bytes`
    + `&nome=eq.${encodeURIComponent(NOME_PROVA)}&limit=1`, s.tk))[0];
  if (!doc) {
    const bytes = PDF_MINIMO('PROVA B16 - nao e certidao de verdade');
    const alvo = Date.now() + '-cnd-de-teste.pdf';
    const up = await envia({ auth: s.tk, ct: API.tipoDoArquivo({ name: 'cnd-de-teste.pdf', type: '' }), alvo, corpo: bytes });
    if (up.http !== 200) { console.error('o envio respondeu ' + up.http + ' ' + up.corpo); process.exit(1); }
    const r = await fetch(`${SB}/rest/v1/documentos`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: 'Bearer ' + s.tk, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ nome: NOME_PROVA, tipo: 'prova', orgao_emissor: 'fatia B16',
        validade: null, dias_aviso: 30,
        arquivo_path: alvo, arquivo_nome: 'cnd-de-teste.pdf', arquivo_bytes: bytes.length }) });
    if (!r.ok) { console.error('não consegui registrar: ' + r.status + ' ' + (await r.text()).slice(0, 200)); process.exit(1); }
    doc = (await r.json())[0];
    console.log(`    subiu de verdade e a linha NASCEU: documento ${doc.id}`);
  } else console.log(`    reusando o registro de prova: documento ${doc.id}`);

  const depois = await le('documentos?select=id');
  ok(n + '. *** a tabela `documentos` saiu do ZERO — a linha existe no banco ***',
    depois.length >= 1, depois.length); n++;
  ok(n + '. *** e a linha carrega o arquivo (caminho, nome e tamanho) ***',
    !!doc.arquivo_path && !!doc.arquivo_nome && doc.arquivo_bytes > 0,
    [doc.arquivo_path, doc.arquivo_nome, doc.arquivo_bytes]); n++;

  // A VIEW é quem a tela lê — se a linha nasceu mas a view não a mostra, a tela continua vazia.
  const naView = await le(`v_documentos_situacao?select=id,nome,situacao,arquivo_path&id=eq.${doc.id}`, s.tk);
  ok(n + '. *** e a tela enxerga: a linha aparece em `v_documentos_situacao` ***',
    naView.length === 1 && naView[0].arquivo_path === doc.arquivo_path, naView); n++;
  ok(n + '. *** sem validade, a situação é "sem_validade" e não "vencido" ***',
    naView[0] && naView[0].situacao === 'sem_validade', naView[0] && naView[0].situacao); n++;

  // ══════════ 4. ABRIR O ARQUIVO TAMBÉM PASSA PELO COFRE ══════════════════════════════════
  /* O botão "abrir arquivo" assina uma URL em /storage/v1/object/sign/ — mesma porta, mesma
     policy. Com o crachá anon ele também não passava: o arquivo subiria (depois do conserto) e
     ninguém conseguiria abrir. */
  console.log('\n  ─── abrir o arquivo (a mesma porta, a mesma policy) ───');
  const assina = async auth => {
    const r = await fetch(`${SB}/storage/v1/object/sign/documentos/${encodeURIComponent(doc.arquivo_path)}`, {
      method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 60 }) });
    return { http: r.status, corpo: (await r.text()).slice(0, 120) };
  };
  const assAnon = await assina(ANON), assSess = await assina(s.tk);
  console.log(`    crachá anon      -> HTTP ${assAnon.http} ${assAnon.corpo.slice(0, 60)}`);
  console.log(`    crachá da sessão -> HTTP ${assSess.http}`);
  ok(n + '. *** assinar com `anon` é recusado (o "abrir arquivo" também estava quebrado) ***',
    assAnon.http >= 400, assAnon); n++;
  ok(n + '. *** e com o crachá da sessão a URL assinada sai ***',
    assSess.http === 200 && /signedURL/.test(assSess.corpo), assSess); n++;

  // ══════════ 5. O RED TEST QUE FALHA SE O CABEÇALHO ERRADO VOLTAR ═══════════════════════
  /* A caixa pediu com estas palavras: "assert que falha se o cabeçalho errado voltar". Este
     olha o código da tela — de propósito: os asserts de cima já mediram o servidor, e este é o
     alarme para o dia em que alguém reescrever o envio de volta para o jeito antigo. */
  console.log('');
  const envioTela = pega(/const tipo = tipoDoArquivo\(arq\);[\s\S]*?body: arq \}\);/);
  ok(n + '. *** o envio da tela NÃO manda o Content-Type do REST ***',
    !!envioTela && !/'Content-Type'\s*:\s*'application\/json'/.test(envioTela), envioTela.slice(0, 200)); n++;
  ok(n + '. *** o envio da tela manda o tipo DO ARQUIVO ***',
    /tipoDoArquivo\(arq\)/.test(envioTela)); n++;
  ok(n + '. *** e o envio da tela leva o crachá da SESSÃO, não o `anon` ***',
    /cabecalhoCofre\(/.test(envioTela), envioTela.slice(0, 200)); n++;
  ok(n + '. *** a tela TRADUZ a recusa do cofre em vez de guardar a lista dele ***',
    /invalid_mime_type\|415/.test(HTML) && /Converta para PDF e mande de novo/.test(HTML)); n++;

  console.log('\n  ⚠️  PENDÊNCIA: o documento ' + doc.id + ' é registro de PROVA (o título diz), com');
  console.log('      1 arquivo de teste no bucket. Apagá-lo é um DELETE — decisão do dono.');
  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
