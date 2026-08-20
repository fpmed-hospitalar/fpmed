/* ═══════════════════════════════════════════════════════════════════════════════════════════
   prova_busca_sem_portal.js — A BUSCA COM A REDE DO PNCP CORTADA (fatia A34, 20/08/2026)

   ══ A EXIGÊNCIA, com as palavras da caixa ═══════════════════════════════════════════════════
   *"A busca da tela NUNCA fala com o PNCP. Ela consulta só o nosso banco. Se hoje existe
   qualquer caminho em que a Encontrar dispara requisição ao portal durante a busca, ele sai.
   **Prova: rodar a busca com a rede do portal bloqueada e a tela responder igual.**"*

   ══ POR QUE A PROVA ESTÁTICA NÃO BASTA AQUI ═════════════════════════════════════════════════
   A `testa_pncp_fora` já cobra que não há `pncp.gov.br` dentro do corpo da `buscar()`. Isso é
   leitura de código — e código tem `import`, tem função chamada de longe, tem `sw.js`. A
   pergunta da caixa é sobre a REDE, e rede só se mede olhando a rede.
   >>> ENTÃO AQUI O NAVEGADOR É DE VERDADE (o Chrome desta máquina, como na A32), a tela é a de
       verdade, e TODA requisição para `pncp.gov.br` é ABORTADA no nível do navegador. Se sobrar
       um caminho, ele aparece como um pedido abortado — e um pedido abortado é visível, ao
       contrário de um pedido que deu certo por acaso.

   ══ O QUE ESTA PROVA MEDE E O QUE ELA NÃO MEDE — DITO ANTES DO NÚMERO ════════════════════════
   Ela roda SEM SESSÃO, porque a regra desta casa é que ferramenta nenhuma digita senha. Sem
   sessão o `anon` toma 401 na `licitacoes` (medido agora: `42501 permission denied`), então a
   busca cai no caminho do "não consegui ler o banco".
   >>> E ISSO NÃO ENFRAQUECE A PROVA — É O CASO MAIS FORTE QUE EXISTE PARA ELA. O caminho em que
       o banco não responde é EXATAMENTE onde a tela antiga ia ao portal: era o `puxarPagina`
       contra a API de consulta, até 20 páginas, o desfecho que virou 70 segundos de espera e um
       painel vermelho. Se há um dia em que a Encontrar velha falaria com o PNCP, é este.
   >>> O QUE ELA NÃO MEDE, e está declarado: a lista de resultados com sessão. Isso a
       `tools/mede_encontrar.js` mede pelo lado do banco, com os bytes e os milissegundos.

   ══ AS DUAS RODADAS, E A COMPARAÇÃO ENTRE ELAS ══════════════════════════════════════════════
   A tela é aberta DUAS vezes: uma com o PNCP bloqueado e outra com ele liberado. O que a tela
   escreve tem que ser IGUAL nas duas. "Responder igual" é a palavra da caixa, e igual aqui é
   comparação de texto, não impressão.

     node tools/prova_busca_sem_portal.js
     node tools/prova_busca_sem_portal.js --termo albumina
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const RAIZ = path.join(__dirname, '..');
const PORTA = 8123;
const BASE = 'http://127.0.0.1:' + PORTA + '/';
const TELA = 'fpmed_licitacoes.html';
const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const TERMO = arg('--termo') || 'dipirona';

const dormir = ms => new Promise(r => setTimeout(r, ms));

// ── o servidor local, subido sozinho (mesmo caminho do roda_medicao_tela.js) ────────────────
function servidorDePe() {
  return new Promise(res => {
    const r = http.get(BASE, { timeout: 2500 }, x => { x.resume(); res(true); });
    r.on('error', () => res(false));
    r.on('timeout', () => { r.destroy(); res(false); });
  });
}
async function garanteServidor() {
  if (await servidorDePe()) return { subiu: false, proc: null };
  const arq = path.join(__dirname, 'servidor_estatico.js');
  if (!fs.existsSync(arq)) return { erro: 'nao achei tools/servidor_estatico.js' };
  const proc = spawn(process.execPath, [arq, String(PORTA)], { cwd: RAIZ, stdio: 'ignore' });
  for (let i = 0; i < 20; i++) { await dormir(400); if (await servidorDePe()) return { subiu: true, proc }; }
  try { proc.kill(); } catch (_) {}
  return { erro: 'o servidor nao respondeu em 8s' };
}

async function umaRodada(navegador, bloqueia) {
  const ctx = await navegador.newContext({ viewport: { width: 1366, height: 768 }, locale: 'pt-BR' });
  const page = await ctx.newPage();

  const aoPNCP = [];      // TUDO que a página tentou mandar para o portal
  /* A ROTA PEGA `**` E FILTRA AQUI, e não um padrão só de `pncp.gov.br`. Um subdomínio novo, um
     espelho, um proxy — qualquer um deles escaparia de um padrão estreito, e o resultado seria
     um verde de quem não olhou o caminho por onde a requisição de fato saiu. */
  await page.route('**', rota => {
    const u = rota.request().url();
    if (/pncp\.gov\.br/i.test(u)) {
      aoPNCP.push({ url: u.slice(0, 140), quando: Date.now() });
      return bloqueia ? rota.abort('failed') : rota.continue();
    }
    return rota.continue();
  });

  const erros = [];
  page.on('pageerror', e => erros.push(String(e.message).slice(0, 160)));

  await page.goto(BASE + TELA, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await dormir(2500);
  const naBoot = aoPNCP.length;

  /* A BUSCA É DISPARADA PELO MESMO CAMINHO DA PESSOA: preenche o campo e chama a `buscar()`.
     Chamar `buscarNoBanco` direto mediria uma função, e a pergunta é sobre a TELA. */
  const rodou = await page.evaluate(`(async () => {
    const kw = document.getElementById('f-kw');
    if (!kw || typeof buscar !== 'function') return { erro: 'a tela nao expos o campo ou a buscar()' };
    kw.value = ${JSON.stringify(TERMO)};
    const t0 = performance.now();
    try { await buscar(); } catch (e) { return { erro: String(e && e.message) }; }
    return { ms: Math.round(performance.now() - t0) };
  })()`);
  await dormir(3000);

  const tela = await page.evaluate(`(() => {
    const t = el => (el ? (el.innerText || '').replace(/\\s+/g, ' ').trim() : '(sem elemento)');
    return {
      lista: t(document.getElementById('lista')).slice(0, 400),
      frescor: t(document.getElementById('frescor')).slice(0, 300),
      nacional: t(document.getElementById('nacional')).slice(0, 300),
      status: t(document.getElementById('status')).slice(0, 120),
    };
  })()`);

  await ctx.close();
  return { aoPNCP, naBoot, rodou, tela, erros };
}

(async () => {
  const srv = await garanteServidor();
  if (srv.erro) { console.error('SERVIDOR: ' + srv.erro); process.exit(1); }
  console.log('PROVA: A BUSCA COM A REDE DO PNCP CORTADA — Chrome da maquina, tela ' + TELA);
  console.log('termo: "' + TERMO + '"   base: ' + BASE
    + (srv.subiu ? '  (subi o servidor agora)' : '  (ja estava de pe)'));
  console.log('sem sessao de proposito: esta casa nao digita senha. Ver o cabecalho.\n');

  const navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const bloqueada = await umaRodada(navegador, true);
  const livre = await umaRodada(navegador, false);
  await navegador.close();
  if (srv.subiu && srv.proc) { try { srv.proc.kill(); } catch (_) {} }

  let p = 0, f = 0;
  const ok = (n, c, e) => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

  console.log('=== RODADA COM O PNCP BLOQUEADO ===');
  console.log('  pedidos ao pncp.gov.br no BOOT ....... ' + bloqueada.naBoot);
  console.log('  pedidos ao pncp.gov.br na BUSCA ...... ' + (bloqueada.aoPNCP.length - bloqueada.naBoot));
  console.log('  a busca terminou em .................. '
    + (bloqueada.rodou.erro ? 'ERRO: ' + bloqueada.rodou.erro : bloqueada.rodou.ms + ' ms'));
  for (const x of bloqueada.aoPNCP) console.log('     ! ' + x.url);
  console.log('\n=== RODADA COM O PNCP LIBERADO ===');
  console.log('  pedidos ao pncp.gov.br (total) ....... ' + livre.aoPNCP.length);
  console.log('  a busca terminou em .................. '
    + (livre.rodou.erro ? 'ERRO: ' + livre.rodou.erro : livre.rodou.ms + ' ms'));

  console.log('\n=== O QUE A TELA ESCREVEU ===');
  console.log('  [bloqueado] lista: ' + bloqueada.tela.lista.slice(0, 180));
  console.log('  [livre]     lista: ' + livre.tela.lista.slice(0, 180));

  console.log('\n=== VEREDITO ===');
  ok('a busca rodou de verdade (a tela expos o campo e a funcao)', !bloqueada.rodou.erro, bloqueada.rodou.erro);
  ok('*** ZERO requisicoes ao pncp.gov.br durante a busca ***',
    bloqueada.aoPNCP.length - bloqueada.naBoot === 0, bloqueada.aoPNCP.slice(0, 3));
  ok('...e ZERO tambem no boot da tela', bloqueada.naBoot === 0);
  /* A IGUALDADE É A PALAVRA DA CAIXA: "a tela responder igual". Comparar os quatro pedaços em
     vez de um só é o que impede a prova de passar porque a lista ficou vazia nas duas. */
  ok('*** a tela responde IGUAL com o portal bloqueado e liberado (lista) ***',
    bloqueada.tela.lista === livre.tela.lista, { bloq: bloqueada.tela.lista.slice(0, 90), livre: livre.tela.lista.slice(0, 90) });
  ok('...e igual na faixa de frescor', bloqueada.tela.frescor === livre.tela.frescor);
  ok('...e igual no bloco nacional', bloqueada.tela.nacional === livre.tela.nacional);
  ok('a tela nao ficou muda (escreveu alguma coisa na lista)', bloqueada.tela.lista.length > 20);
  ok('e nenhum erro de pagina apareceu por causa do bloqueio',
    bloqueada.erros.length === 0, bloqueada.erros.slice(0, 3));

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
