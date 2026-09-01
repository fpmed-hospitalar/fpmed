// PROVA DA FATIA B37 — o `?adicionar=` aceita VÁRIAS, e diz a verdade sobre quantas entraram.
//
// 01/09/2026. A dívida era minha e eu a declarei na B36: o rodapé da Encontrar mostra o número
// exato que a pessoa marcou ("12 licitações marcadas") e esta porta aceitava UMA. O dono marcava
// doze e adicionava uma — sem erro, sem aviso e sem jeito de perceber, porque a tela que abria
// estava certa: ela só estava certa sobre a primeira.
//
// >>> POR QUE ESTA PROVA FORJA O BANCO EM VEZ DE FALAR COM ELE: `licitacoes` e `negocios` são
//     fechadas para o `anon` (medido: HTTP 401, `permission denied for table licitacoes` — a RLS
//     está certa), e eu não tenho o crachá do dono. Então o banco é interceptado no navegador e
//     responde o que EU escolhi, o que é melhor do que parece: dá para montar exatamente os casos
//     que raramente acontecem juntos — uma já no funil, uma fora do índice, uma repetida no
//     endereço, e cem de uma vez. O que NÃO está provado aqui é a gravação contra o Supabase de
//     verdade; isso está dito no relatório em vez de suposto.
//
// >>> E O QUE NÃO É FORJADO: o código da tela. Nada é reimplementado aqui. A prova navega para a
//     `fpmed_negocios.html` de verdade com a query de verdade, deixa o `assistenteDaUrl()` da
//     própria tela decidir o caminho, e depois LÊ o que apareceu na tela e o que saiu pela rede.
//
//   node tools/prova_b37_lote.js [--base http://127.0.0.1:8099] [--visivel]
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = (arg('--base', 'http://127.0.0.1:8099')).replace(/\/+$/, '');
const TELA = BASE + '/fpmed_negocios.html';
const TETO = 80;                      // tem que bater com LOTE_ADICIONAR da tela — o assert 0 confere

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) { p++; console.log('  ok    ' + n + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 300) + ']' : '')); } else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 500) + ']' : '')); } };

// ── o índice forjado: número de controle no formato REAL, medido no backup de 01/09 ──────────
// 35.613 linhas, 28 caracteres em todas, zero nulos, zero vírgulas, só `-` e `/` fora do
// alfanumérico. Se um dia esse formato mudar, é aqui que a prova tem que mudar junto.
const nc = (i) => '4231894900' + String(1000 + i).slice(-4) + '-1-' + String(100000 + i).slice(-6) + '/2026';
const licDe = (i) => ({
  id: 9000 + i, numero_controle: nc(i), portal: 'PNCP', numero_compra: 'PE ' + (10 + i) + '/2026',
  modalidade: 'Pregão - Eletrônico', orgao: 'ORGAO ' + i, municipio: 'Goiânia', uf: 'GO',
  objeto: 'objeto do certame ' + i, data_abertura: '2026-10-1' + (i % 10) + 'T09:00:00+00:00',
  valor_estimado: 1000 * (i + 1),
});

(async () => {
  console.log('PROVA B37 — o ?adicionar= aceita várias\n');
  let chromium;
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('  SEM playwright-core — não dá para medir no navegador. Não vou supor.'); process.exit(2); }
  const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')].find(a => fs.existsSync(a));
  if (!CHROME) { console.log('  SEM Chrome no caminho conhecido. Não vou supor.'); process.exit(2); }

  // A prova sobe o próprio servidor se não houver um. Antes ela apontava para o de outra janela
  // e ficava vermelha quando aquela janela fechava — vermelho que não é defeito é ruído.
  const srv = await require('./servidor_estatico').sobeSePreciso(BASE);
  console.log('  servidor: ' + BASE + (srv.proprio ? ' (subi eu)' : ' (já estava de pé)'));

  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'fpmed-b37-'));
  /* SERVICE WORKER BLOQUEADO, e a razão foi medida: em perfil novo o `limedtec-pwa.js` registra
     o SW, ele assume o controle, dispara `controllerchange` e chama `location.reload()` — aos
     2.624 ms, cronometrado. A recarga no meio de um lote de doze faria a prova piscar por um
     motivo que não tem nada a ver com o lote. Nada do que se mede aqui passa pelo SW. */
  const ctx = await chromium.launchPersistentContext(perfil, { executablePath: CHROME, headless: !process.argv.includes('--visivel'), viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });

  // gmAuth entra ANTES de qualquer script da página, e travado: o gm-auth.js real tentaria
  // sobrescrever, e aí o `ehGestor()` voltaria a ser falso no meio da prova.
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'gmAuth', {
      configurable: false, writable: false,
      value: { isGestor: () => true, user: { email: 'prova-b37@fpmed.local' }, pronto: Promise.resolve(true) },
    });
  });

  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', e => erros.push(String(e.message)));

  // ── o banco forjado ────────────────────────────────────────────────────────────────────────
  let INDICE = [];        // o que `licitacoes` responde
  let FUNIL = [];         // o que `negocios` responde
  const POSTS = [];       // o que a tela tentou GRAVAR — é esta a testemunha que importa
  let QUERY_LIC = null;   // a URL exata com que ela pediu as licitações
  await pg.route('**/*.supabase.co/**', async (route) => {
    const req = route.request(), url = req.url(), m = req.method();
    const json = (b, extra) => route.fulfill({ status: 200, contentType: 'application/json',
      headers: Object.assign({ 'access-control-allow-origin': '*' }, extra || {}), body: JSON.stringify(b) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (m === 'POST' && /\/rest\/v1\/negocios(\?|$)/.test(url)) {
      const corpo = JSON.parse(req.postData() || '{}');
      POSTS.push(corpo);
      const novo = Object.assign({ id: 700 + POSTS.length }, corpo);
      FUNIL.push(novo);
      return json([novo]);
    }
    if (/\/rest\/v1\/licitacoes\?/.test(url)) {
      QUERY_LIC = url;
      const dentro = decodeURIComponent((url.match(/numero_controle=in\.\(([^)]*)\)/) || [, ''])[1]).split(',').map(s => s.replace(/"/g, ''));
      return json(INDICE.filter(l => dentro.includes(l.numero_controle)));
    }
    if (/\/rest\/v1\/negocios\?/.test(url)) return json(FUNIL, { 'content-range': '0-' + Math.max(0, FUNIL.length - 1) + '/' + FUNIL.length });
    if (/\/rest\/v1\/empresas/.test(url)) return json([{ id: 1, razao_social: 'FPMED HOSPITALAR LTDA' }, { id: 2, razao_social: 'SEGUNDA EMPRESA LTDA' }]);
    return json([]);                                     // as outras tabelas da tela: lista vazia
  });

  /* O CLIQUE É `element.click()`, E NÃO O CLIQUE DE MOUSE DO AUTOMATIZADOR. A tela verdadeira
     sobe o `#gm-auth-overlay` por cima de tudo enquanto ninguém entrou, e ele intercepta o
     ponteiro — medido: o Playwright acha o botão, vê que está visível e habilitado, e fica 30s
     tentando. Como o crachá aqui já é forjado, o overlay é cenário e não regra; disparar o
     `onclick` do próprio botão exercita exatamente o mesmo caminho de código. */
  const clicar = (sel) => pg.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('botao ' + s + ' nao existe'); b.click(); }, sel);

  // abre a tela com a query e devolve o texto do painel + o estado interno
  /* A ESPERA É PELA CONDIÇÃO, NÃO PELO RELÓGIO — e isso foi medido, não escolhido por gosto.
     Com `await pg.waitForTimeout(1400)` a prova passou com o servidor de outra janela e reprovou
     com o meu, no assert 1 e só nele: a PRIMEIRA carga de um perfil novo, sem nada em cache, não
     tinha terminado de rodar o `assistenteDaUrl()` em 1400 ms. Um número de espera que funciona
     na máquina de quem escreveu é a receita do teste que pisca — e teste que pisca é teste que
     todo mundo aprende a re-rodar em vez de ler. */
  const abrir = async (query) => {
    POSTS.length = 0; QUERY_LIC = null;
    await pg.goto(TELA + query, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.waitForFunction(() => (typeof ASS !== 'undefined' && ASS) || (typeof ASSLOTE !== 'undefined' && ASSLOTE),
      null, { timeout: 20000 }).catch(() => {});
    // e depois um respiro curto pela leitura do índice, que é assíncrona e repinta a lista
    await pg.waitForTimeout(600);
    return pg.evaluate(() => {
      const el = document.getElementById('form-manual');
      return {
        visivel: !!el && el.style.display !== 'none',
        texto: el ? el.innerText.replace(/\s+/g, ' ').trim() : '',
        modo: (typeof ASSLOTE !== 'undefined' && ASSLOTE) ? 'lote' : ((typeof ASS !== 'undefined' && ASS) ? 'assistente' : 'nenhum'),
        pedidas: (typeof ASSLOTE !== 'undefined' && ASSLOTE) ? ASSLOTE.ncs.length : null,
        sobraram: (typeof ASSLOTE !== 'undefined' && ASSLOTE) ? ASSLOTE.sobraram : null,
        buscaLimpa: location.search === '',
        teto: typeof LOTE_ADICIONAR !== 'undefined' ? LOTE_ADICIONAR : null,
      };
    });
  };

  try {
    INDICE = [];
    for (let i = 0; i < 120; i++) INDICE.push(licDe(i));

    // ── 0. o teto da tela é o que esta prova pensa que é ────────────────────────────────────
    FUNIL = [];
    let r = await abrir('?adicionar=' + nc(0) + ',' + nc(1));
    ok('0. o teto declarado na tela é ' + TETO + ' (a prova e a tela usam o mesmo número)', r.teto === TETO, r.teto);

    // ── 1. UMA continua caindo no assistente de 3 passos — nada do que existia mudou ────────
    FUNIL = [];
    r = await abrir('?adicionar=' + nc(0));
    ok('1. uma só continua abrindo o ASSISTENTE de 3 passos (o caminho antigo não mudou)',
      r.modo === 'assistente' && /Itens/.test(r.texto), { modo: r.modo });

    // ── 2. VÁRIAS abrem o lote, e a tela diz o número certo ─────────────────────────────────
    FUNIL = [];
    r = await abrir('?adicionar=' + [nc(0), nc(1), nc(2)].join(','));
    ok('2. três abrem o LOTE, e o título diz três', r.modo === 'lote' && r.pedidas === 3
      && /Adicionar 3 aos meus neg/.test(r.texto), { modo: r.modo, pedidas: r.pedidas });
    ok('3. e a conta diz "3 de 3 vão ser criadas"', /3 de 3 v[aã]o ser criadas/.test(r.texto), r.texto.slice(0, 160));

    // ── 4. O CASO DA CAIXA: 12 pedidas, 3 já no funil. Tem que DIZER OS TRÊS NÚMEROS. ───────
    FUNIL = [
      { id: 1, numero_controle: nc(3), titulo: 'já estava 1', arquivado: false, estagio: 'oportunidade' },
      { id: 2, numero_controle: nc(7), titulo: 'já estava 2', arquivado: false, estagio: 'oportunidade' },
      { id: 3, numero_controle: nc(11), titulo: 'já estava 3', arquivado: false, estagio: 'oportunidade' },
    ];
    const doze = [];
    for (let i = 0; i < 12; i++) doze.push(nc(i));
    r = await abrir('?adicionar=' + doze.join(','));
    ok('4. *** 12 pedidas com 3 já no funil: a tela diz "9 de 12", não diz "pronto" ***',
      /9 de 12 v[aã]o ser criadas/.test(r.texto), r.texto.match(/\d+ de \d+ v\S+ ser criadas/));
    const tresNomeados = [nc(3), nc(7), nc(11)].every(x => r.texto.includes(x));
    ok('5. *** e NOMEIA as três que já estavam (número com recorte publica o critério) ***',
      tresNomeados && /3 j[aá] est[aã]o no funil/.test(r.texto), { nomeadas: tresNomeados });

    // ── 6. Grava, e grava só as 9 ───────────────────────────────────────────────────────────
    await clicar('#lt-bt');
    await pg.waitForTimeout(1500);
    const depois = await pg.evaluate(() => document.getElementById('form-manual').innerText.replace(/\s+/g, ' ').trim());
    ok('6. *** gravou 9 POSTs, nem um a mais: as 3 que já existiam não entraram de novo ***',
      POSTS.length === 9, POSTS.length);
    ok('7. e o resultado na tela diz 9 de 12, com os três números de novo',
      /9 de 12/.test(depois) && [nc(3), nc(7), nc(11)].every(x => depois.includes(x)), depois.slice(0, 240));
    ok('8. cada negócio gravado leva o número de controle, a origem e o autor',
      POSTS.length > 0 && POSTS.every(b => b.numero_controle && b.origem === 'licitacoes' && b.criado_por === 'prova-b37@fpmed.local'),
      POSTS[0] && { nc: POSTS[0].numero_controle, origem: POSTS[0].origem, por: POSTS[0].criado_por });
    ok('9. e nenhum deles é uma das três que já estavam',
      POSTS.every(b => ![nc(3), nc(7), nc(11)].includes(b.numero_controle)),
      POSTS.map(b => b.numero_controle).filter(x => [nc(3), nc(7), nc(11)].includes(x)));
    // `null` é O PREGÃO INTEIRO, e não "nenhum item" — as duas coisas são diferentes no DDL.
    ok('10. itens_participo vai NULL (o pregão inteiro), nunca [] (nenhum item)',
      POSTS.length > 0 && POSTS.every(b => b.itens_participo === null), POSTS.map(b => b.itens_participo).slice(0, 3));
    // A data volta como veio: ida e volta sem passar pelo fuso.
    ok('11. a abertura é gravada VERBATIM como o índice a devolveu (sem passeio pelo fuso)',
      POSTS.length > 0 && POSTS[0].abertura === licDe(0).data_abertura,
      { gravado: POSTS[0] && POSTS[0].abertura, indice: licDe(0).data_abertura });

    // ── 12. FORA DO ÍNDICE: recusa e nomeia, não cria um card sem título ────────────────────
    FUNIL = [];
    const fantasma = '99999999999999-1-999999/2026';
    r = await abrir('?adicionar=' + [nc(0), fantasma, nc(1)].join(','));
    ok('12. quem não está no índice é RECUSADO e nomeado (card sem título é card que ninguém acha)',
      /2 de 3 v[aã]o ser criadas/.test(r.texto) && r.texto.includes(fantasma) && /fora do [ií]ndice/.test(r.texto),
      r.texto.match(/\d+ de \d+ v\S+ ser criadas/));
    await clicar('#lt-bt'); await pg.waitForTimeout(1200);
    ok('13. e ele não vira POST nenhum', POSTS.length === 2 && !POSTS.some(b => b.numero_controle === fantasma), POSTS.length);

    // ── 14. O TETO, e ele fala ──────────────────────────────────────────────────────────────
    FUNIL = [];
    const cem = []; for (let i = 0; i < 100; i++) cem.push(nc(i));
    const qs = '?adicionar=' + cem.join(',');
    r = await abrir(qs);
    ok('14. 100 pedidas: entram ' + TETO + ' e a tela DIZ que 20 ficaram de fora, e por quê',
      r.pedidas === TETO && r.sobraram === 20 && /Vieram 100/.test(r.texto) && new RegExp('teto [eé] ' + TETO).test(r.texto),
      { pedidas: r.pedidas, sobraram: r.sobraram });
    ok('15. e o endereço de 100 números de controle chegou inteiro no navegador (' + qs.length + ' caracteres)',
      qs.length > 2900, qs.length);
    ok('16. a consulta ao banco pediu ' + TETO + ' controles numa vez só, e ' + TETO + ' < 1000 (o teto do PostgREST não corta)',
      !!QUERY_LIC && (decodeURIComponent(QUERY_LIC).match(/"/g) || []).length === TETO * 2,
      { aspas: QUERY_LIC ? (decodeURIComponent(QUERY_LIC).match(/"/g) || []).length : null });

    // ── 17. Repetido no endereço é engano de quem montou o link ─────────────────────────────
    FUNIL = [];
    r = await abrir('?adicionar=' + [nc(0), nc(1), nc(0), nc(1), nc(0)].join(','));
    ok('17. número repetido no endereço não cria duas vezes (5 pedidos, 2 licitações)',
      r.pedidas === 2 && /2 de 2 v[aã]o ser criadas/.test(r.texto), { pedidas: r.pedidas });

    // ── 18. `&itens=` com várias: ignorado, e DITO ──────────────────────────────────────────
    FUNIL = [];
    r = await abrir('?adicionar=' + [nc(0), nc(1)].join(',') + '&itens=1,2,3');
    ok('18. com várias, o &itens= é ignorado E a tela diz que ignorou',
      /ignorei/.test(r.texto) && /pregão inteiro/.test(r.texto), r.texto.slice(0, 200));
    await clicar('#lt-bt'); await pg.waitForTimeout(1200);
    ok('19. e nenhum negócio nasceu com itens marcados por engano',
      POSTS.length === 2 && POSTS.every(b => b.itens_participo === null), POSTS.map(b => b.itens_participo));

    // ── 20. `&itens=` com UMA continua valendo: o contrato antigo não foi quebrado ──────────
    FUNIL = [];
    r = await abrir('?adicionar=' + nc(0) + '&itens=1,2,3');
    const marcados = await pg.evaluate(() => (typeof ASS !== 'undefined' && ASS) ? ASS.marcados : null);
    ok('20. com UMA, o &itens= continua marcando os itens (contrato A5 intacto)',
      r.modo === 'assistente' && Array.isArray(marcados) && marcados.join(',') === '1,2,3', marcados);

    // ── 21. O endereço é consumido: F5 não recria ───────────────────────────────────────────
    ok('21. a query é apagada do endereço (recarregar não cria o mesmo negócio de novo)', r.buscaLimpa === true, r.buscaLimpa);

    ok('22. nada disso derrubou a tela (zero erro de JavaScript)', erros.length === 0, erros.slice(0, 3));
  } catch (e) {
    f++; console.log('  FALHA (exceção): ' + e.message + '\n' + String(e.stack).split('\n').slice(1, 4).join('\n'));
  } finally {
    await ctx.close();
    await srv.fecha();
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
  }

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exit(f ? 1 : 0);
})();
