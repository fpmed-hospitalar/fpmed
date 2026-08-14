/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_custo_as_claras.js — O AVISO DE CUSTO ANTES DE GASTAR (fatia A12, 14/08/2026)

   Decisão do dono em 14/08: *a conversa com o edital FICA, com os clientes cientes do custo.*
   Esta prova responde às três perguntas que essa decisão levanta, e a terceira é a que importa:

     1. o servidor sabe orçar? (o preço vem de UM lugar — quem cobra é quem estima);
     2. o orçamento NÃO GASTA nada e NÃO registra nada em `usos_ia`;
     3. cancelar não deixa rastro nem custo — nem uma linha, nem um centavo.

   >>> A TERCEIRA É A QUE UM TESTE PREGUIÇOSO PULARIA, e é justamente ela que o dono comprou.
       "O aviso aparece" é fácil de ver na tela; "cancelar não cobra" só se prova contando o
       livro-caixa antes e depois.

     node tools/prova_custo_as_claras.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const ANON = (seg.match(/anon[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H_SR = { apikey: SR, Authorization: 'Bearer ' + SR };
const FN = SB + '/functions/v1/ler-edital';
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

async function conta(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: { ...H_SR, Prefer: 'count=exact', Range: '0-0' } });
  return Number((r.headers.get('content-range') || '').split('/')[1]);
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
      if (j.access_token) { console.log(`  (logado como ${email})`); return j.access_token; }
    } catch { }
  }
  return null;
}

(async () => {
  console.log('=== PROVA — o custo às claras (fatia A12) ===\n');

  // ── 1. O ORÇAMENTO EXIGE SESSÃO ─────────────────────────────────────────────────────────
  const semTok = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orcar: true, chars: 100000, tarefa: 'resumo' }) });
  console.log(`  orçar sem token .... HTTP ${semTok.status}`);
  ok(n + '. o orçamento também exige sessão (não é porta aberta pra sondar preço)',
    semTok.status === 401, { status: semTok.status }); n++;

  const tk = await token();
  if (!tk) {
    console.log('\n  ~ NÃO CONFERI a metade autenticada (nenhum e-mail logou com a SENHA_PADRAO).');
    console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)   [metade autenticada NÃO conferida]');
    process.exitCode = f ? 1 : 0;
    return;
  }

  // ── 2. O ORÇAMENTO NÃO GASTA E NÃO REGISTRA ─────────────────────────────────────────────
  const antes = await conta('usos_ia?select=id');
  const somaAntes = (await (await fetch(`${SB}/rest/v1/usos_ia?select=usd`, { headers: H_SR })).json())
    .reduce((s, x) => s + (Number(x.usd) || 0), 0);

  const CHARS = 339106;   // o tamanho de um edital real desta base, pra o número sair comparável
  const r = await fetch(FN, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify({ orcar: true, chars: CHARS, tarefa: 'resumo', partes: 2 }) });
  const j = await r.json().catch(() => ({}));
  const o = j.orcamento || {};
  console.log(`\n  orçamento HTTP ${r.status}:`);
  console.log(`    modelo ${o.modelo} · tarefa ${o.tarefa} · ${o.partes} parte(s)`);
  console.log(`    ${Number(o.chars || 0).toLocaleString('pt-BR')} chars ÷ ${o.charsPorToken} = `
    + `${Number(o.tokensEntrada || 0).toLocaleString('pt-BR')} tokens de entrada`);
  console.log(`    teto de saída ${Number(o.tetoSaida || 0).toLocaleString('pt-BR')} tokens`);
  console.log(`    US$ ${o.usd}  ·  câmbio ${o.cambio}  ·  R$ ${o.brl}`);

  ok(n + '. *** o servidor devolve o orçamento (o preço vem de quem cobra) ***',
    r.status === 200 && o.usd > 0 && o.tokensEntrada > 0, { status: r.status, o }); n++;
  /* A razão chars/token é MEDIDA nas 7 leituras reais desta base (2,90 a 3,05). O "4 chars por
     token" que se repete por aí é do inglês e subestimaria a entrada em 33% — e num aviso de
     custo, errar para menos é o único erro que não se pode cometer. */
  ok(n + '. ...com a razão chars/token MEDIDA (3,00), e não a regra de bolso do inglês',
    o.charsPorToken === 3, o.charsPorToken); n++;
  /* O número anunciado é o TETO, e não a média: a saída já variou de 213 a 8.878 tokens na mesma
     tarefa. Anunciar a média faria a cobrança passar do anunciado em metade das vezes. */
  ok(n + '. *** e o valor é declarado como TETO (a tela diz "até", e o "até" é verdade) ***',
    o.teto === true && o.tetoSaida === 2000 * 2, { teto: o.teto, tetoSaida: o.tetoSaida }); n++;
  ok(n + '. o câmbio vem do servidor (preço em reais calculado no navegador não é preço)',
    o.cambio === null || (o.cambio > 3 && o.cambio < 12), o.cambio); n++;

  const depois = await conta('usos_ia?select=id');
  const somaDepois = (await (await fetch(`${SB}/rest/v1/usos_ia?select=usd`, { headers: H_SR })).json())
    .reduce((s, x) => s + (Number(x.usd) || 0), 0);
  console.log(`\n  usos_ia: ${antes} linha(s) / US$ ${somaAntes.toFixed(6)}`
    + `  ->  ${depois} linha(s) / US$ ${somaDepois.toFixed(6)}`);
  /* ESTE É O ASSERT QUE A DECISÃO DO DONO COMPROU. Cancelar (ou só olhar o preço) não pode
     custar nada — e "nada" aqui é o livro-caixa não se mexer, e não a promessa de que não se
     mexeu. O orçamento sai da edge function ANTES da chamada à IA: não há o que cancelar. */
  ok(n + '. *** orçar NÃO criou linha em usos_ia ***', depois === antes, { antes, depois }); n++;
  ok(n + '. *** e NÃO somou um centavo ao consumo ***',
    Math.abs(somaDepois - somaAntes) < 1e-9, { antes: somaAntes, depois: somaDepois }); n++;

  // ── 3. O PORTÃO DO MOTOR: SEM "SIM", NÃO GASTA ──────────────────────────────────────────
  /* Aqui o motor roda FORA do navegador, com o `fetch` e o `confirm` de mentira. É o único jeito
     de provar o CAMINHO DO CANCELAR sem gastar de verdade — e o caminho do cancelar é o que
     ninguém testa, porque não deixa rastro nenhum quando funciona. */
  const glob = {
    LIMEDTEC_CLIENTE: { banco: { url: SB } },
    gmAuth: { session: { access_token: tk } },
    fetch: globalThis.fetch,
  };
  const src = fs.readFileSync(path.join(RAIZ, 'fpmed_leitor_motor.js'), 'utf8');
  new Function('window', 'fetch', 'AbortSignal', src)(glob, globalThis.fetch, globalThis.AbortSignal);
  const M = glob.LeitorEdital;
  ok(n + '. (controle) o motor carregou e expõe orcar/frasePreco/confirmador',
    !!M && typeof M.orcar === 'function' && typeof M.frasePreco === 'function'); n++;

  let perguntou = null;
  M.confirmador = (txt) => { perguntou = txt; return false; };     // o usuário diz NÃO
  const a2 = await conta('usos_ia?select=id');
  let cancelou = false;
  try {
    await M.perguntar({ texto: 'x'.repeat(120000), tarefa: 'resumo' });
  } catch (e) { cancelou = !!e.cancelado; }
  const d2 = await conta('usos_ia?select=id');
  console.log(`\n  a pergunta que apareceu ao usuário:\n    ${String(perguntou || '(nenhuma)').split('\n').join('\n    ')}`);
  ok(n + '. *** o motor PERGUNTA antes de gastar, com o preço na frase ***',
    !!perguntou && /custa até/.test(perguntou) && /(R\$|US\$)/.test(perguntou), perguntou); n++;
  ok(n + '. *** dizer NÃO cancela a leitura, com erro marcado (não é falha) ***', cancelou); n++;
  ok(n + '. *** e cancelar NÃO gerou registro nenhum em usos_ia ***', d2 === a2, { antes: a2, depois: d2 }); n++;

  /* O PORTÃO É LIGADO POR PADRÃO: quem não sabe dele não gasta calado. Sem `confirm` disponível
     (node, worker), a resposta padrão é NÃO — portão que se abre sozinho quando não sabe
     perguntar não é portão. */
  const M2 = glob.LeitorEdital;
  M2.confirmador = undefined;   // o setter recusa não-função: o padrão continua valendo
  ok(n + '. o confirmador só aceita função (não dá pra desligar o portão por acidente)',
    typeof M2.confirmador === 'function'); n++;

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
