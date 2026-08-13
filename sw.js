/* LIMEDTEC - service worker.
 *
 * A REGRA QUE MANDA AQUI: preco velho servido do cache e proposta errada mandada pro hospital.
 * Um erro desses nao aparece como bug - aparece como o vendedor prometendo um valor que a empresa
 * nao pratica mais. Entao este arquivo e deliberadamente burro.
 *
 * O DESENHO E LISTA BRANCA, NAO LISTA NEGRA. A tentacao era "cacheia tudo menos o Supabase".
 * Lista negra erra por omissao: no dia em que entrar uma origem nova (outra API, um proxy no mesmo
 * dominio, um .json de importacao) ela e cacheada por padrao e ninguem percebe. Aqui, o que nao
 * esta no SHELL nem entra no respondWith - e requisicao que o service worker nunca toca nao tem
 * como vir do cache. A prova e estrutural, nao e vigilancia.
 *
 * So entra CASCA: HTML de tela, o auth, o config, o manifest e os icones. Nenhum dado.
 *
 * ESTRATEGIA: network-first. Sempre tenta a rede; o cache so responde quando a rede falhou, ou
 * seja, offline. Nunca "cache-first" - seria escolher o rapido em cima do correto.
 */
'use strict';

const VERSAO = 'limedtec-fpmed-2026-08-13-29';
const CACHE = 'limedtec-shell-' + VERSAO;

// A CASCA DA FPMED. Lista MONTADA A MAO conferindo `git ls-files` (= o que o Pages serve),
// NAO copiada de outra instalacao. Cada linha foi decidida:
const SHELL = [
  './',
  './index.html',                      // splash/porta de entrada
  './fpmed_sistema_final.html',        // o sistema interno (porta de entrada real, menu completo)
  './fpmed_giovana.html',              // Propostas
  './fpmed_vendas.html',               // Vendas Ativas
  './fpmed_viabilidade.html',          // Viabilidade de compra
  './fpmed_painel.html',               // Painel de notas
  './fpmed_licitacoes.html',           // Licitacoes
  './fpmed_negocios.html',             // Negocios (funil) — entrou 06/08 com o item 9
  './fpmed_documentos.html',           // Documentos (habilitacao) — entrou 08/08, 3a aba do portal
  './fpmed_declaracoes.html',          // Declaracoes — 4a aba do portal, modulo 2.10 da spec
  './fpmed_pecas.html',                // Pecas juridicas — 5a aba, modulo 2.9 da spec
  './fpmed_conferidor.html',           // Conferidor de proposta x teto CMED — 6a aba
  './fpmed_teto_cmed.js',
  './fpmed_alarme_coleta.js',        // o sino do Negocios depende dele              // o motor "meu preco x teto", compartilhado
  './fpmed_competitividade.html',      // aqui ELA ENTRA (na instalacao de origem estava fora por
                                       // ficar no .gitignore; na FPMED e versionada e vai pro ar)
  './dashboard_clientes.html',         // demo 100% ficticio (nao ha dado real dentro)
  './limedtec-usuarios.html',          // Usuarios e acessos (tela do MOLDE) — entrou 06/08
  './reset-senha.html',
  './gm-auth.js',                      // motor de autenticacao compartilhado
  './cliente.config.js',
  './limedtec-config.js',
  './limedtec-tema.js',                // faltava: o red test de 05/08 mostrou 21 itens sem ele,
                                       // e sem ele o tema do cliente nao pinta offline (404).
  /* ══ OS DOIS QUE FALTAVAM, E JA ESTAVAM NO AR SEM CASCA (achado em 12/08) ══════════════════
     A tela Encontrar foi publicada ONTEM (bd35ff1) dependendo dos dois, e nenhum entrou aqui.
     Offline, ela abriria SEM O TEMA (todo `var(--token)` sem valor: texto invisivel, fundo
     branco cru) e SEM O MENU — ou seja, sem navegacao nenhuma, porque a barra do portal foi
     removida no mesmo commit. O sintoma nao apareceu porque com rede o 404 nao acontece.
     >>> A LICAO E DA CASA E ESTA ESCRITA NO PROPRIO REPO: "a casca e lista branca, e tela que
         depende de script fora dela quebra offline". Publiquei uma tela nova sem reler a lista.
     Entram os dois agora, junto com o Negocios, que depende dos mesmos. */
  './fpmed_tema.css',                  // o design system: sem ele, NENHUM token tem valor
  './limedtec-menu.js',                // a navegacao do modulo — sem ele a tela vira beco
  './limedtec-licenca.js',
  './limedtec-papeis.js',              // a matriz de papeis que a tela de Usuarios imprime
  './limedtec-sessao.js',              // portao de perfil da tela de Usuarios (so ela o carrega)
  './limedtec-pwa.js',
  './manifest.webmanifest',
  './icones/limedtec-192.png',
  './icones/limedtec-512.png',
  './icones/limedtec-192-maskable.png',   // logo oficial (cruz com o L) — 4 arquivos desde 05/08
  './icones/limedtec-512-maskable.png',
  './logo_fpmed.png',                  // usado nos PDFs e no cabecalho; e casca, nao dado
  // â”€â”€ FICARAM DE FORA DE PROPOSITO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // fpmed_template.html ....... referencia de design, nao e tela que alguem abre.
  // *.xlsx / *.xlsm / *.pdf ... DADO COMERCIAL. Nunca. (E nem sobem pro repo: .gitignore.)
  // o xlsx.full.min.js do CDN . outra origem; o SW nem chega a olhar. Offline, a Viabilidade
  //                             perde a leitura de planilha - e preferivel a servir versao velha.
];

// o mesmo SHELL como conjunto de caminhos absolutos, pra decidir em O(1) no fetch
const permitido = new Set(SHELL.map(p => new URL(p, self.location).pathname));

self.addEventListener('install', ev => {
  // addAll falha inteiro se UM arquivo faltar, e ai o SW nem instala. Cada um por si: um HTML
  // renomeado nao pode derrubar o app offline todo.
  ev.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))));
  // sem skipWaiting: trocar de versao no meio de uma cotacao aberta e pior que esperar.
  // Quem decide e o usuario, pelo aviso "Nova versao disponivel".
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n.startsWith('limedtec-shell-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', ev => {
  if (ev.data === 'LIMEDTEC_ATUALIZAR') self.skipWaiting();
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  // 1. so GET. POST/PATCH sao escrita: nunca passam por aqui.
  if (req.method !== 'GET') return;
  let u;
  try { u = new URL(req.url); } catch (e) { return; }
  // 2. so a propria origem. Supabase, PNCP, fontes e IA sao outra origem e saem por aqui.
  if (u.origin !== self.location.origin) return;
  // 3. cinto e suspensorio: se um dia o Supabase for servido pela mesma origem (proxy, dominio
  //    proprio como sistema.fpmed.com.br), a checagem de origem acima deixaria passar. Esta nao.
  if (/supabase|\/rest\/v1\/|\/auth\/v1\/|\/functions\/v1\//i.test(u.pathname + u.search)) return;
  // 4. e, no fim, so o que esta na casca. Query string tambem descarta: "?v=cruz5" e "?nocache=1"
  //    sao pedido explicito de arquivo fresco.
  if (u.search || !permitido.has(u.pathname)) return;

  ev.respondWith((async () => {
    try {
      // `cache: 'no-cache'` NAO quer dizer "nao use cache" - quer dizer "revalide com o servidor
      // antes de usar". Sem isso o fetch aqui podia ser respondido pelo cache HTTP do navegador,
      // e o GitHub Pages manda `Cache-Control: max-age=600`: uma casca de ate 10 minutos atras,
      // com o aviso de "nova versao" atrasado na mesma medida.
      // O custo e um 304 vazio quando nada mudou.
      const resp = await fetch(new Request(req, { cache: 'no-cache' }));
      if (resp && resp.ok && resp.type === 'basic') {
        const c = await caches.open(CACHE);
        c.put(req, resp.clone());
      }
      return resp;
    } catch (e) {
      const doCache = await caches.match(req);
      if (doCache) return doCache;
      throw e;
    }
  })());
});


