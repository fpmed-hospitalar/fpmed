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

/* Duas frentes publicando no mesmo dia usam ESTE arquivo em comum, e a regra combinada é: quem
   commitar depois SOBE o número, nunca volta. O rastro do dia: -41 e -43 do TRABALHADOR B
   (item 7b), -42 do 7f, -44 e -45 do item 8, e -46 do TRABALHADOR B (item 8b, a Proposta).
   >>> POR QUE NÃO DÁ PRA REAPROVEITAR O NÚMERO DO OUTRO: quem já instalou a casca no deploy dele
       não refetcharia os meus arquivos — o service worker só troca quando a VERSÃO muda. O
       usuário ficaria com a versão de ontem e sem sintoma nenhum, que é a lição S13.
   >>> E O ITEM 8 PRECISA DE BUMP mesmo sem tela nova: ele mexe no `fpmed_teto_cmed.js`, que ESTÁ
       na casca. Motor velho servido do cache é teto legal calculado pela regra antiga. */
/* -73 pela FATIA A16: a janela de custo entrou no `fpmed_leitor_motor.js`, que ESTÁ na casca.
   Sem bump, quem já instalou continuaria recebendo o motor velho do cache — e o motor velho
   pergunta pelo `confirm()` do navegador. Não quebraria nada; simplesmente a fatia não existiria
   para quem já usa o app, e sem um sintoma sequer. É a lição S13 de novo. */
/* -74 pela FATIA B10: a ordem da lista "Produtos sem EAN" mudou dentro do
   `fpmed_sistema_final.html`, que ESTÁ na casca (linha 40). O -73 da A16 foi commitado ANTES
   desta fatia, então ele não carrega esta tela: quem já tivesse pegado o -73 continuaria com a
   lista na ordem velha, sem selo nenhum, e sem nada que denunciasse isso. Bump por caminho e
   sozinho, para não levar linha da outra janela junto. */
/* -75 pela FATIA B11: o Guia do usuario (`fpmed_ajuda.html`) ENTROU na casca acima. Arquivo novo
   na lista sem bump nao e baixado por quem ja instalou — a casca so e remontada quando a versao
   muda. Seria a ajuda existindo pra quem chega hoje e nao existindo pra quem ja usa o app. */
/* -76 pela FATIA B12: os tres consertos de clique moram no `fpmed_negocios.html`, que ESTA na
   casca. Sem bump, quem ja instalou continuaria com a marcacao de tarefa que mente quando a rede
   cai — e esse e justamente o defeito que so aparece com rede ruim, ou seja, exatamente na
   situacao em que o cache velho e servido. */
/* -77 pela FATIA B13: o campo "Numero de controle do PNCP" entrou no `fpmed_negocios.html`, que
   ESTA na casca. Sem bump, quem ja instalou continuaria com a ficha sem o campo — e a Ata antiga
   seguiria sem caminho nenhum pra recuperar os itens, sem nada na tela que denunciasse isso. */
/* -78 pela FATIA B14: os selos de contexto e o conserto da referencia ZERO estao no
   `fpmed_negocios.html`, que ESTA na casca. Este bump importa mais que os outros: sem ele, quem
   ja instalou continuaria vendo "R$ 0,00 · referencia do edital" em 7.456 itens — um preco que
   ninguem publicou, escrito como se existisse, na tela onde se decide preco. */
/* -79 pela FATIA A21: o cartao inteiro passou a abrir o detalhe, as acoes passaram a seguir o
   estado do certame e o `normalizaBruto` entrou — tudo dentro do `fpmed_licitacoes.html`, que
   ESTA na casca. Este bump e dos que mais importam: sem ele, quem ja instalou continuaria vendo
   os 400 cartoes MUDOS (sem titulo, sem objeto, com "R$ 0" e sem a chave do funil), que e
   exatamente o defeito que esta fatia foi feita pra apagar. O sintoma continuaria identico, e a
   conclusao seria "o conserto nao funcionou". */
/* -80 pela FATIA B16: o conserto do "Anexar" e do "abrir arquivo" esta no `fpmed_documentos.html`
   e no `fpmed_negocios.html`, os dois na casca. Sem bump, quem ja instalou continuaria com as
   telas que mandam o arquivo pro cofre com o cracha `anon` — ou seja, continuaria sem conseguir
   anexar NADA, com a tela dizendo "salvando..." e o banco recebendo zero linha. E o sintoma seria
   identico ao de antes do conserto, o que faria qualquer um concluir que o conserto nao pegou. */
/* -81 pela FATIA B17: a identidade do item (marca, EAN e registro ANVISA) e o conserto do
   `hdr()`/`esc()` estao no `fpmed_giovana.html`, que ESTA na casca. Sem bump, quem ja instalou
   continuaria montando proposta sem ver que o item nao tem EAN — e continuaria com a fila de
   pendencia respondendo "nao consegui ler a lista" para sempre, que e o defeito que manteve
   8.455 itens com estoque sem codigo de barras desde a B7. */
/* -82 pela FATIA B18: o Guia (`fpmed_ajuda.html`) ESTA na casca (linha 89), e ele e o unico
   arquivo dela que foi posto la de proposito para responder OFFLINE — quem esta sem rede e
   exatamente quem vai abrir a ajuda. Por isso este bump e diferente dos outros: nos demais, o
   cache velho so aparece quando a rede falha; aqui, servir o cache velho e o comportamento
   PROJETADO. Sem bump, o offline continuaria lendo o guia da B11 — o que manda procurar uma aba
   "historico" que nao existe e nao conta que "Meus arquivos", o numero de controle, os selos e
   os campos de EAN passaram a existir. Guia velho servido com confianca e pior que guia nenhum:
   quem nao acha o que ele descreve conclui que e ELE quem nao sabe usar o sistema. */
/* ══ -84 (fatia A28, 15/08/2026) ═════════════════════════════════════════════════════════════
   Mudaram a `fpmed_licitacoes.html` e o `limedtec-menu.js`, e os dois são SERVIDOS. Sem bump,
   quem já instalou o aplicativo continua com o de ontem quando estiver offline — e o de ontem
   tem contador de filtro e pastilha de prazo em 10px, botão de fechar de 32px no celular e
   cabeçalho de tabela que some ao rolar. O bump aqui é a diferença entre "consertei" e
   "consertei para quem abrir amanhã". */
/* ══ -85 (fatia B26, 20/08/2026) ═════════════════════════════════════════════════════════════
   AS QUATRO TELAS DO B adotaram o `fpmed_telemetria.js`, e as quatro ESTÃO na casca (Proposta,
   Negócios, Ajuda e Documentos). Sem bump, quem já instalou o aplicativo continua servindo as
   quatro do cache — e as do cache não chamam a telemetria. O defeito seria o pior formato
   possível para esta fatia em particular: o painel encheria de evento de quem chegou hoje e
   ficaria MUDO sobre quem já usa o sistema, ou seja, mudo justamente sobre o Natanael. E a
   conclusão óbvia diante de um painel assim — "quase ninguém usa a tela X" — seria falsa, e
   ninguém teria como desconfiar dela. É a lição S13 outra vez, agora medindo a si mesma.
   >>> E O `fpmed_telemetria.js` NÃO ENTRA NA CASCA — decisão, não esquecimento. Ele carrega o
       MASCARAMENTO dos dois gravadores de tela, e configuração de privacidade servida do cache é
       a única coisa aqui que envelhece perigosamente: apertar o mascaramento amanhã não valeria
       para quem já tem a versão de hoje instalada. Fora da casca, ele vem sempre da rede ou não
       vem — e não vir é inofensivo, porque as chamadas das telas são todas guardadas por
       `window.FPMED_TELEMETRIA &&`, e offline não há para onde mandar evento mesmo. */
/* ══ -86 (fatia B28, 20/08/2026) ═════════════════════════════════════════════════════════════
   O `fpmed_teto_homologado.js` NASCEU nesta fatia e é chamado pela Proposta e pelo Negócios — as
   duas na casca. Sem bump acontecem DUAS coisas, e a segunda é pior que a primeira:
     1. as telas do cache não têm a linha do `<script>`, então quem já instalou o aplicativo nunca
        veria o teto competitivo — o recurso existiria só para quem chegou hoje;
     2. e o arquivo novo não estaria na casca, então quem abrisse OFFLINE receberia a tela nova
        pedindo um script que o cache não tem. As chamadas são guardadas (`window.FPMED_TETO_
        HOMOLOGADO` e o `if(!T)`), então nada quebra — mas o badge diria "procurando…" para
        sempre, que é o formato de defeito que ninguém reporta porque parece lentidão.
   >>> E ELE ENTRA NA CASCA, ao contrário do `fpmed_telemetria.js`: aquele carrega configuração de
       PRIVACIDADE, que envelhece perigosamente no cache; este carrega uma regra de preço, que
       envelhece do mesmo jeito que as telas e é substituído no mesmo bump que elas. */
/* -87 pela FATIA B29: o `fpmed_piso.js` NASCEU e é chamado pela Proposta (que calcula o piso) e
   pela Documentos (que cadastra os parâmetros dele). As duas estão na casca. Sem bump, quem já
   instalou o aplicativo receberia as telas velhas do cache — sem a linha do `<script>`, sem o
   painel de parâmetros e sem o terceiro selo — e o recurso existiria só para quem chegou hoje.
   E offline seria pior: a tela nova pedindo um arquivo que a casca não tem. As chamadas são
   guardadas (`window.FPMED_PISO` e o `if(!P)`), então nada quebra: o selo simplesmente nunca
   apareceria, que é o formato de defeito que ninguém reporta porque parece que o recurso não
   existe. É a lição S13 outra vez, e é a terceira fatia seguida em que ela vale. */
/* -88 pela FATIA B30: o `fpmed_ata_saldo.js` NASCEU e é chamado pelo `fpmed_negocios.html`, que
   ESTÁ na casca. Sem bump, quem já instalou receberia a tela velha do cache — sem a faixa da
   validade, sem a tabela do saldo e sem a ordem "ata vencendo primeiro" — e o recurso existiria
   só para quem chegou hoje.
   >>> ESTE BUMP TEM UM AGRAVANTE QUE OS ANTERIORES NÃO TINHAM. As chamadas são guardadas
       (`window.FPMED_ATA_SALDO` e o `if(!M)`), então nada quebra: a faixa e a tabela simplesmente
       não nascem. Só que o assunto delas é PRAZO — e a tela que se cala sobre uma ata vencendo
       não parece quebrada, parece uma ata que não corre risco. O defeito, aqui, tem a mesma cara
       da boa notícia. É a lição S13 pela quarta fatia seguida. */
/* -89 pelas FATIAS B31 e B32: nasceram DOIS arquivos, `fpmed_ata_entrada.js` (o caminho de
   entrada do dado da ata) e `fpmed_vai_embora.js` (a lista da manhã), e os dois são chamados pelo
   `fpmed_negocios.html`, que ESTÁ na casca. Sem bump, quem já instalou receberia a tela velha —
   sem o quadro de marcar itens, sem o arquivar da ata e sem a lista do que vence.
   >>> E O AGRAVANTE DA B30 VOLTA MAIOR AQUI, porque agora ele é a tela INTEIRA. As chamadas
       continuam guardadas (`window.FPMED_VAI_EMBORA` e o `if(!V)`), então nada quebra: a lista
       simplesmente não nasce. Só que essa lista é a resposta de "o que morre primeiro se eu não
       fizer nada hoje" — e a ausência dela lê-se como **"não há nada vencendo"**. É a única tela
       desta casa em que o defeito e a boa notícia são graficamente a MESMA coisa: uma tela calma.
       Por isso o bloco vazio de verdade é DESENHADO e escrito (regra 4 da caixa), e nunca um
       espaço em branco — para que a ausência do motor não consiga se passar por ele. */
const VERSAO = 'limedtec-fpmed-2026-08-21-90';
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
  /* GUIA DO USUARIO — entrou 14/08 com a fatia B11. Ele e a tela que MAIS precisa funcionar
     offline: quem esta perdido no meio de uma sessao de pregao, num lugar com internet ruim, e
     exatamente quem vai abrir a ajuda. Tela de ajuda que so abre com rede ajuda quem nao precisa. */
  './fpmed_ajuda.html',                // Guia do usuario (passo a passo da jornada)
  './fpmed_teto_cmed.js',
  './fpmed_teto_homologado.js',      // o teto COMPETITIVO (B28) — Proposta e Negocios chamam o mesmo
  './fpmed_piso.js',                 // o PISO (B29) — Proposta calcula, Documentos cadastra o parametro
  './fpmed_ata_saldo.js',            // o SALDO DA ATA (B30) — so o Negocios chama, e ja basta
  './fpmed_ata_entrada.js',          // o CAMINHO DE ENTRADA do dado da ata (B31) — de graca, sem IA
  './fpmed_vai_embora.js',           // "o que esta indo embora" (B32) — a lista da manha
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
  /* O sprite de icones, fonte unica desde 13/08 (item 7d). Ele entra na casca NO MESMO commit
     em que a Encontrar passou a depender dele — que e exatamente a licao dos dois de cima, que
     ficaram no ar sem casca por um dia. Offline, sem ele a tela abre sem os icones das linhas. */
  './fpmed_icones.js',
  /* A PORTA INTERNA DO LEITOR (fatia A2, 14/08). Ela entra na casca NO MESMO commit em que
     nasce — que e a licao ja paga duas vezes aqui: o fpmed_tema.css e o limedtec-menu.js
     ficaram um dia no ar sem casca porque a tela nova foi publicada sem reler esta lista, e
     offline a tela abria sem tema e sem navegacao. Com rede, o 404 nao acontece e o defeito
     nao aparece. */
  './fpmed_leitor_motor.js',
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
  // ── FICARAM DE FORA DE PROPOSITO ────────────────────────────────────────────────────────────
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


