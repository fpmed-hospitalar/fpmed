/* ══════════════════════════════════════════════════════════════════════════════════════════════
   limedtec-menu.js — O MENU LATERAL DE MÓDULOS. Reforma visual de 11/08/2026, referência de
   ESTRUTURA no Licitante Prime (ver docs/spec_reforma_prime.md).

   ══ POR QUE UM ARQUIVO SÓ, E NÃO HTML EM CADA TELA ═════════════════════════════════════════
   A barra horizontal `nav.portal` que ele substitui estava COPIADA em 6 telas. Toda vez que uma
   entrada nova entrava, era preciso lembrar de mexer nas 6 — e isso já cobrou o preço: a entrada
   do Leitor de Edital foi posta na Encontrar e na Negócios, e as outras quatro ficaram sem ela.
   Aqui a lista mora UMA vez. Acrescentar módulo é uma linha, e ela vale em todo lugar.

   ══ COMPLIANCE ════════════════════════════════════════════════════════════════════════════════
   Referência de LAYOUT (menu lateral de módulos, item ativo destacado) e nada mais. Nenhum
   código, ícone, cor ou texto do Prime. As cores são as da marca FPMED — azul #2CA9E0 e verde
   #8DC63F, os mesmos do resto do sistema.

   ══ O QUE O MENU NÃO FAZ ══════════════════════════════════════════════════════════════════════
   Ele não decide permissão. O Leitor de Edital só aparece pra quem está no piloto — mas quem
   IMPEDE é a edge function, que confere o JWT no servidor e responde 403. Esconder item de menu
   é conforto, não trava.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  /* OS MÓDULOS, na ordem que o Lemuel declarou. `arq: null` = ainda não existe: entra
     ACINZENTADO com selo "em breve" em vez de sumir, porque o cliente PERGUNTOU por ele — e um
     módulo que não aparece parece um módulo que não vai existir. */
  var MODULOS = [
    { k:'buscar',      rot:'Buscar',       ic:'🔍', arq:'fpmed_licitacoes.html',
      dica:'oportunidades no PNCP — nosso índice e a busca nacional' },
    { k:'radar',       rot:'Radar',        ic:'🎯', arq:'fpmed_licitacoes.html#radar',
      dica:'cidades num raio daqui com licitação aberta' },
    { k:'desertas',    rot:'Desertas',     ic:'🔁', arq:'fpmed_licitacoes.html#desertas',
      dica:'processos que não seguiram — costumam ser republicados' },
    { k:'jornais',     rot:'Meus Jornais', ic:'📰', arq:'fpmed_licitacoes.html#jornais',
      dica:'buscas salvas: mostra o que chegou desde a última vez' },
    { k:'calendario',  rot:'Calendário',   ic:'📅', arq:'fpmed_negocios.html#agenda',
      dica:'as sessões por dia e hora' },
    { k:'negocios',    rot:'Negócios',     ic:'📊', arq:'fpmed_negocios.html',
      dica:'o funil: em que pé está cada disputa' },
    { k:'documentos',  rot:'Documentos',   ic:'📁', arq:'fpmed_documentos.html',
      dica:'certidões de habilitação, com aviso de vencimento' },
    { k:'proposta',    rot:'Proposta',     ic:'🧾', arq:'fpmed_giovana.html',
      dica:'montar a proposta comercial' },
    { k:'edital-ia',   rot:'Leitor IA',    ic:'✨', arq:'fpmed_edital_ia.html', piloto:true,
      dica:'lê o PDF do edital com IA — cada leitura tem custo e fica registrada' },
    { k:'pecas',       rot:'Peças',        ic:'📜', arq:'fpmed_pecas.html',
      dica:'impugnação, esclarecimento, recurso — com o prazo na frente' },
    { k:'declaracoes', rot:'Declarações',  ic:'✍️', arq:'fpmed_declaracoes.html',
      dica:'modelos de declaração preenchidos com os dados da empresa' },
    { k:'conferir',    rot:'Conferir',     ic:'⚖️', arq:'fpmed_conferidor.html',
      dica:'preço da proposta contra o teto legal da CMED' },
    { k:'favoritas',   rot:'Favoritas',    ic:'⭐', arq:null,
      dica:'salvar licitações pra olhar depois' },
  ];

  // Quem pode ver o leitor. MESMA lista das telas — e, como lá, NÃO é a permissão.
  var LEITORES = ['licitacao@fpmed.com.br'];
  function podeLeitor() {
    try {
      var e = (raiz.gmAuth && raiz.gmAuth.user && raiz.gmAuth.user.email) || '';
      return LEITORES.indexOf(String(e).toLowerCase()) >= 0;
    } catch (x) { return false; }
  }

  /* QUAL MÓDULO ESTÁ ABERTO — sai do nome do arquivo, e não de uma variável que cada tela teria
     que declarar. Variável por tela é a mesma armadilha da barra copiada: uma esquece, e o menu
     não marca nada. */
  function moduloAtual() {
    var f = (location.pathname.split('/').pop() || '').toLowerCase();
    var h = (location.hash || '').toLowerCase();
    if (f.indexOf('licitacoes') >= 0) {
      if (h.indexOf('radar') >= 0) return 'radar';
      if (h.indexOf('desertas') >= 0) return 'desertas';
      if (h.indexOf('jornais') >= 0) return 'jornais';
      return 'buscar';
    }
    if (f.indexOf('negocios') >= 0) return h.indexOf('agenda') >= 0 ? 'calendario' : 'negocios';
    if (f.indexOf('documentos') >= 0) return 'documentos';
    if (f.indexOf('giovana') >= 0) return 'proposta';
    if (f.indexOf('conferidor') >= 0) return 'conferir';
    if (f.indexOf('pecas') >= 0) return 'pecas';
    if (f.indexOf('declaracoes') >= 0) return 'declaracoes';
    if (f.indexOf('edital_ia') >= 0) return 'edital-ia';
    return '';
  }

  /* ══ O TEMA CLARO ══════════════════════════════════════════════════════════════════════════
     O menu nasce claro porque a reforma é claro. Ele NÃO impõe o tema ao resto da tela: cada
     tela ganha o tema na vez dela (a Encontrar foi a primeira). Um menu claro ao lado de uma
     tela escura fica estranho por um dia; um menu que reescreve o CSS de telas que ainda não
     foram reformadas quebra seis telas de uma vez. */
  var CSS = [
    ':root{--lm-larg:216px}',
    '#lm-menu{position:fixed;left:0;top:0;bottom:0;width:var(--lm-larg);z-index:60;overflow-y:auto;',
    '  background:#fff;border-right:1px solid #E3E9F0;padding:16px 0 20px;',
    '  font-family:Inter,system-ui,sans-serif;box-shadow:0 0 24px rgba(16,38,60,.06)}',
    '#lm-menu .marca{display:flex;align-items:center;gap:10px;padding:0 16px 15px;',
    '  border-bottom:1px solid #EEF2F7;margin-bottom:11px}',
    '#lm-menu .marca .cruz{width:30px;height:30px;border-radius:8px;background:#2CA9E0;color:#fff;',
    '  display:grid;place-items:center;font-size:16px;font-weight:700;flex:0 0 auto}',
    '#lm-menu .marca b{color:#173A5E;font-family:Montserrat,sans-serif;font-size:14px;letter-spacing:.4px;line-height:1.1;display:block}',
    '#lm-menu .marca small{display:block;color:#8A9BAD;font-size:8.5px;letter-spacing:2.2px}',
    '#lm-menu .grupo{padding:11px 16px 5px;font-size:9.5px;letter-spacing:1.2px;text-transform:uppercase;color:#A6B4C4;font-weight:700}',
    '#lm-menu a{display:flex;align-items:center;gap:10px;padding:9px 16px;color:#4A5B6E;',
    '  text-decoration:none;font-size:12.5px;cursor:pointer;border-left:3px solid transparent;',
    '  transition:background .15s,color .15s,border-color .15s}',
    '#lm-menu a:hover{background:#F4F8FC;color:#173A5E}',
    /* O ATIVO é o único com barra azul e fundo: o "você está aqui" tem que ser achado de
       relance, e não lido item por item. */
    '#lm-menu a.on{background:#EAF6FD;color:#12699A;border-left-color:#2CA9E0;font-weight:600}',
    '#lm-menu a .ic{width:18px;text-align:center;font-size:13.5px;flex:0 0 auto}',
    /* "EM BREVE" não é link: acinzentado, sem cursor de mão, e diz o que é. Item que parece
       clicável e não faz nada ensina a desconfiar do menu inteiro. */
    '#lm-menu a.breve{opacity:.45;cursor:default}',
    '#lm-menu a.breve:hover{background:none;color:#4A5B6E}',
    '#lm-menu .breve-tag{margin-left:auto;font-size:8px;letter-spacing:.6px;text-transform:uppercase;',
    '  border:1px solid #D7E0EA;color:#8A9BAD;border-radius:20px;padding:1px 6px}',
    '#lm-menu .sep{height:1px;background:#EEF2F7;margin:11px 16px}',
    '#lm-menu .rodape{padding:9px 16px 0;font-size:10.5px;color:#8A9BAD;line-height:1.5}',
    // O CORPO ANDA PRA DIREITA. `padding-left`, e não `margin`, pra não brigar com telas que já
    // usam margin no body.
    'body{padding-left:var(--lm-larg)}',
    /* GAVETA no estreito: 216px de coluna num telefone não sobra tela pro conteúdo, e o menu
       existe pra levar a ele. O ☰ fica fixo e o menu desliza por cima. */
    '#lm-abrir{display:none;position:fixed;left:10px;top:10px;z-index:62;width:38px;height:38px;',
    '  border-radius:10px;border:1px solid #E3E9F0;background:#fff;color:#173A5E;font-size:17px;',
    '  cursor:pointer;box-shadow:0 2px 10px rgba(16,38,60,.12)}',
    '#lm-velcro{display:none;position:fixed;inset:0;background:rgba(16,38,60,.35);z-index:59}',
    '@media(max-width:900px){',
    '  body{padding-left:0}',
    '  #lm-abrir{display:block}',
    '  #lm-velcro.on{display:block}',
    '  #lm-menu{transform:translateX(-100%);transition:transform .22s}',
    '  #lm-menu.on{transform:translateX(0)}',
    '}',
    /* A BARRA HORIZONTAL ANTIGA some onde o menu existe — as duas juntas seriam duas navegações
       pro mesmo lugar, e o operador teria que decidir qual usar. */
    'nav.portal{display:none !important}',
  ].join('\n');

  function pinta() {
    if (document.getElementById('lm-menu')) return;   // um só, mesmo se o boot rodar duas vezes
    if (!document.getElementById('lm-css')) {
      var st = document.createElement('style');
      st.id = 'lm-css'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    var atual = moduloAtual();
    var cli = (raiz.LIMEDTEC_CLIENTE && raiz.LIMEDTEC_CLIENTE.empresa) || {};
    var nome = (raiz.LIMEDTEC_CLIENTE && raiz.LIMEDTEC_CLIENTE.nome) || 'FPMED';

    var h = '<div class="marca"><div class="cruz">✚</div>'
          + '<div><b>' + nome + '</b><small>HOSPITALAR</small></div></div>';
    MODULOS.forEach(function (m) {
      if (m.piloto && !podeLeitor()) return;
      if (!m.arq) {
        h += '<a class="breve" title="' + m.dica + ' — ainda não está pronto">'
           + '<span class="ic">' + m.ic + '</span>' + m.rot
           + '<span class="breve-tag">em breve</span></a>';
        return;
      }
      h += '<a href="' + m.arq + '"' + (m.k === atual ? ' class="on"' : '')
         + ' title="' + m.dica + '"><span class="ic">' + m.ic + '</span>' + m.rot + '</a>';
    });
    h += '<div class="sep"></div>'
       + '<a href="fpmed_sistema_final.html" title="volta pro sistema interno">'
       + '<span class="ic">←</span>Sistema</a>'
       + '<div class="rodape">' + (cli.telefone ? '📞 ' + cli.telefone : '') + '</div>';

    var nav = document.createElement('nav');
    nav.id = 'lm-menu'; nav.innerHTML = h;
    var velcro = document.createElement('div'); velcro.id = 'lm-velcro';
    var bt = document.createElement('button');
    bt.id = 'lm-abrir'; bt.type = 'button'; bt.textContent = '☰';
    bt.setAttribute('aria-label', 'abrir o menu');
    var abre = function (v) { nav.classList.toggle('on', v); velcro.classList.toggle('on', v); };
    bt.onclick = function () { abre(!nav.classList.contains('on')); };
    velcro.onclick = function () { abre(false); };
    // Clicar num item fecha a gaveta: no celular o menu cobre a tela, e ficar aberto por cima do
    // que a pessoa acabou de pedir é o mesmo que não ter navegado.
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) abre(false); });

    document.body.insertBefore(velcro, document.body.firstChild);
    document.body.insertBefore(nav, document.body.firstChild);
    document.body.insertBefore(bt, document.body.firstChild);
  }

  /* MESMA CORRIDA DO gm-auth de 05/08: com token fresco ele dispara `gm-auth-ready` ainda dentro
     do <head>, antes deste arquivo existir. Pinta agora se der, e REPINTA quando o evento chegar
     — o item do piloto depende de saber quem está logado. */
  if (document.body) pinta();
  else document.addEventListener('DOMContentLoaded', pinta, { once: true });
  document.addEventListener('gm-auth-ready', function () {
    var n = document.getElementById('lm-menu');
    if (n) n.parentNode.removeChild(n);
    pinta();
  });

  raiz.LimedtecMenu = { MODULOS: MODULOS, moduloAtual: moduloAtual, pinta: pinta };
})(typeof window !== 'undefined' ? window : globalThis);
