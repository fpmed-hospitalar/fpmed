/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_buscar_edital.js — A PROVA MEDIDA DO "BUSCAR EDITAL AGORA" (fatia A14 item 3, 14/08)

   A pergunta que esta prova responde não é "o código compila?", é: **a porta está trancada, e
   ela abre pra quem tem a chave?** As duas metades importam, e a segunda sozinha é o erro
   clássico — funcionar com token e nunca ter conferido o que acontece sem ele.

     1. SEM token  -> 401. Se isto virar 200 um dia, qualquer um na internet faz o PNCP
        trabalhar em nome da FPMED.
     2. COM token  -> coleta de verdade, e a linha entra em `usos_coleta_edital`.
     3. Negócio SEM número de controle -> 422 com a mensagem certa ("anexe manualmente"),
        e não um erro genérico.

   >>> O TOKEN VEM DE UM LOGIN DE VERDADE, com a senha do segredos.local.txt. Forjar um JWT com
       a service_role provaria que a service_role funciona — que ninguém duvidava — e não que a
       porta reconhece um usuário do sistema.

     node tools/prova_buscar_edital.js [--controle <numero_controle>]
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const ANON = (seg.match(/anon[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H_SR = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };
const FN = SB + '/functions/v1/buscar-edital';

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

async function conta(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: { ...H_SR, Prefer: 'count=exact', Range: '0-0' } });
  return Number((r.headers.get('content-range') || '').split('/')[1]);
}

/* O login de verdade, no MESMO desenho do tools/prova_gate_edital.js: e-mail real do sistema com
   a SENHA_PADRAO do segredos.local.txt. Forjar um JWT com a service_role provaria que a
   service_role funciona — que ninguém duvidava — e não que a porta reconhece um usuário.
   >>> QUANDO O LOGIN NÃO SAI (senha trocada, usuário removido), a prova DIZ que não conferiu a
       metade autenticada em vez de fingir que conferiu. "Não testei" e "passou" são coisas
       diferentes, e confundir as duas é como uma suíte fica verde sobre código que ninguém rodou
       — foi exatamente o que aconteceu com o assert de upsert da fatia A6. */
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';
const EMAILS = ['licitacao@fpmed.com.br', 'comercial@fpmed.com.br'];
async function token() {
  for (const email of EMAILS) {
    try {
      const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: SENHA }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (j.access_token) { console.log(`  (logado como ${email})`); return j.access_token; }
    } catch { /* tenta o próximo */ }
  }
  return null;
}

(async () => {
  console.log('=== PROVA — buscar-edital (fatia A14 item 3) ===\n');

  // ── 1. A PORTA TRANCADA ─────────────────────────────────────────────────────────────────
  const semToken = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numero_controle: '03659166002156-1-000034/2026' }) });
  const jSem = await semToken.json().catch(() => ({}));
  console.log(`  sem token .......... HTTP ${semToken.status}  ${JSON.stringify(jSem).slice(0, 90)}`);
  ok(n + '. *** sem token a função responde 401 (a porta é trancada, não escondida) ***',
    semToken.status === 401, { status: semToken.status }); n++;

  const tokenTorto = await fetch(FN, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer nao-sou-um-jwt' },
    body: JSON.stringify({ numero_controle: '03659166002156-1-000034/2026' }) });
  console.log(`  token inventado .... HTTP ${tokenTorto.status}`);
  ok(n + '. ...e token inventado também é 401 (o formato não basta)',
    tokenTorto.status === 401, { status: tokenTorto.status }); n++;

  // ── 2. COM TOKEN, ELA TRABALHA ──────────────────────────────────────────────────────────
  const tk = await token();
  if (!tk) {
    console.log('\n  ~ NÃO CONFERI a metade autenticada: nenhum dos e-mails do sistema logou com a');
    console.log('    SENHA_PADRAO do segredos.local.txt (trocada?). Isto NÃO é um assert verde — é');
    console.log('    uma conferência que não aconteceu, e está dito pra ninguém ler como completo.');
    console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)   [metade autenticada NÃO conferida]');
    process.exitCode = f ? 1 : 0;
    return;
  }

  const antes = await conta('usos_coleta_edital?select=id');
  const controle = arg('--controle') || (await (async () => {
    // uma licitação viva qualquer do índice, pra não depender de um número escrito à mão que
    // um dia sai do ar
    const r = await fetch(`${SB}/rest/v1/licitacoes?select=numero_controle&data_encerramento=gte.`
      + new Date().toISOString() + '&order=data_encerramento.asc&limit=1', { headers: H_SR });
    const j = await r.json();
    return (j[0] || {}).numero_controle;
  })());
  console.log(`\n  alvo: ${controle}`);

  const r = await fetch(FN, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify({ numero_controle: controle }) });
  const j = await r.json().catch(() => ({}));
  console.log(`  com token .......... HTTP ${r.status}  ${JSON.stringify(j).slice(0, 260)}`);
  ok(n + '. *** com token ela responde (200 = coletou · 502 = o PNCP caiu agora) ***',
    r.status === 200 || r.status === 502, { status: r.status, j }); n++;

  const depois = await conta('usos_coleta_edital?select=id');
  console.log(`  registro de uso .... ${antes} -> ${depois}`);
  /* O REGISTRO É GRAVADO ATÉ QUANDO FALHA. Registrar só o sucesso faria a tentativa que derruba
     o PNCP ser a única invisível — e o freio, que conta desta tabela, contaria zero pra quem
     estivesse batendo mais. */
  ok(n + '. *** e a chamada foi registrada — inclusive se ela falhou ***',
    depois === antes + 1, { antes, depois }); n++;

  if (r.status === 200 && !j.semArquivo) {
    const arq = await conta('licitacao_arquivos?select=id&numero_controle=eq.' + encodeURIComponent(controle));
    console.log(`  arquivos gravados .. ${arq}`);
    ok(n + '. o edital coletado ficou em licitacao_arquivos', arq > 0, { arq }); n++;
  } else {
    console.log('  (esta licitação não tem edital publicado no PNCP — o caso honesto da A6)');
  }

  // ── 3. NEGÓCIO SEM NÚMERO DE CONTROLE ───────────────────────────────────────────────────
  /* O caso REAL, e não um "parâmetro inválido": negócio vindo do Calendário 2025 não tem número
     do PNCP — ele veio de uma planilha. A mensagem certa é a que leva a pessoa a anexar o
     edital à mão em vez de clicar de novo. */
  const rSem = await fetch(FN, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify({ numero_controle: 'isto-nao-e-um-numero-de-controle' }) });
  const jSemC = await rSem.json().catch(() => ({}));
  console.log(`\n  sem nº de controle . HTTP ${rSem.status}  ${JSON.stringify(jSemC).slice(0, 140)}`);
  ok(n + '. *** sem número de controle: 422 dizendo "anexe manualmente", e não erro genérico ***',
    rSem.status === 422 && /anexe o edital manualmente/i.test(JSON.stringify(jSemC)),
    { status: rSem.status, jSemC }); n++;

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
