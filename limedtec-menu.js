/* ══════════════════════════════════════════════════════════════════════════════
   LIMEDTEC · MENU LATERAL DE MÓDULOS
   Item 3 da fila da reforma. Alvo visual: docs/prototipo/fpmed_prototipo_prime.html

   ── FRONTEIRA DESTE ARQUIVO (F9: o que entra e o que sai, em 3 linhas) ─────────
   ENTRA:  o nome do arquivo da tela aberta (window.location) e, opcionalmente,
           `data-modulo` no elemento de montagem.
   SAI:    um <nav id="limedtec-menu"> pintado, com o módulo atual marcado.
   NÃO FAZ: não busca dado, não lê banco, não guarda estado, não altera a tela.

   ── POR QUE ELE NÃO SE MONTA SOZINHO ──────────────────────────────────────────
   Incluir o <script> numa tela NÃO faz nada. O menu só aparece onde existir um
   elemento `[data-limedtec-menu]`. Isso é o "sem apagão" outra vez: dá pra pôr o
   script em todas as telas hoje e nenhuma muda; cada uma ganha o menu no dia da
   fatia dela. Menu que aparece sozinho em 15 telas ao mesmo tempo é o oposto de
   fatia fina — e se sair torto, sai torto em 15 lugares de uma vez.

   ── ESTE ARQUIVO FOI REESCRITO DO ZERO ────────────────────────────────────────
   A primeira versão foi escrita ANTES do adendo de excelência e violava duas
   regras dele: usava EMOJI como ícone (D11) e tinha cor chumbada no CSS em vez
   de token (D5/P6). Ela nunca foi carregada por tela nenhuma — ficou no repo
   como rascunho justamente pra não entrar no ar torta. O que sobreviveu dela é
   a ideia que continua certa: a lista de módulos mora UMA vez. A barra que ela
   substitui estava copiada em 6 telas, e isso já cobrou o preço — a entrada do
   Leitor de Edital entrou em duas e faltou nas outras quatro.

   ── AS DIVERGÊNCIAS COM O PROTÓTIPO, E POR QUE CADA UMA ───────────────────────
   A constituição manda: o protótipo manda no visual, mas onde divergir em TOKEN,
   vence o fpmed_tema.css. Três divergências, todas declaradas:

   1. TAMANHOS DE TEXTO. O protótipo usa 12,5px nos links e 9,5px nos grupos —
      não existem na nossa escala. Aqui: --txt-2 (14px) nos links e --txt-1 (12px)
      nos grupos. O menu fica um fio maior e ganha legibilidade; a hierarquia
      (grupo menor e mais claro que o item) fica idêntica à do protótipo.

   2. O TELEFONE DO RODAPÉ. O protótipo escreve "(62) 3290-4241" precedido de um
      emoji de telefone. Emoji como ícone é PROIBIDO por D11 — e essa regra não é
      token, é regra, então ela não cede pro protótipo. Aqui o telefone usa o
      ícone do mesmo conjunto dos outros.

   3. OS ÍCONES. A regra original pedia Lucide (MIT) copiado pro repo. O conjunto
      que está aqui é o DO PROTÓTIPO — desenhado pela nossa própria equipe, no
      mesmo grid 24×24, mesmo traço, mesmas pontas arredondadas.
      >>> DECIDIDO PELO LEMUEL EM 11/08: FICA O NOSSO CONJUNTO. Consistente,
      autoral, sem licença de terceiro — e cumpre o que a regra realmente queria
      (UM conjunto só, tamanho e traço iguais em todo o sistema). Lucide sai da
      regra e entra "o conjunto FPMED". Eu não inventei paths dizendo que eram
      Lucide, e é por isso que essa escolha pôde ser feita com o dado certo.

      >>> CONSEQUÊNCIA, pra quem vier depois: ícone novo se desenha AQUI, no
      mesmo grid 24×24 e traço 1.8. Não se baixa de biblioteca nenhuma — meio
      conjunto de um lugar e meio de outro é exatamente o que faz um sistema
      parecer montado em vez de desenhado.

   ── COMPLIANCE ────────────────────────────────────────────────────────────────
   Referência de LAYOUT e COMPORTAMENTO apenas. Nenhum código, ícone, cor ou texto
   de terceiro. Identidade FPMED — azul #2CA9E0 e verde #8DC63F, pelos tokens.
   ══════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Os ícones. Todos 24×24, traço de 1.8, pontas arredondadas — o conjunto é UM só,
     e é isso que faz o menu parecer desenhado por uma pessoa, não montado. */
  var ICONE = {
    buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    desertas: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    jornais: '<path d="M4 5h13v14H4z"/><path d="M17 8h3v11H5"/><path d="M7 9h7M7 12.5h7M7 16h4"/>',
    negocios: '<rect x="4" y="4" width="4.5" height="16" rx="1"/><rect x="10" y="4" width="4.5" height="11" rx="1"/><rect x="16" y="4" width="4.5" height="7" rx="1"/>',
    calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    documentos: '<path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
    proposta: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 15.5h5"/>',
    leitor: '<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.2l-1.8-5.6L4.5 10.8 10.2 9z"/>',
    conferir: '<path d="M12 4v16M6 7l6-3 6 3"/><path d="M4 13a3 3 0 0 0 6 0L7 7zM14 13a3 3 0 0 0 6 0l-3-6z"/>',
    pecas: '<path d="M14 4 20 10 9 21H4v-5z"/><path d="m12.5 6.5 5 5"/>',
    declaracoes: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 15.5h7M9 8.5h3"/>',
    sistema: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    telefone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4z"/>'
  };

  /* O MAPA. Cada módulo diz para onde vai e como se reconhece que já se está nele.

     >>> RADAR, DESERTAS E JORNAIS NÃO SÃO TELAS. Conferido no código: são seções
     DENTRO do Encontrar (`id="radar"`, `id="jornais"`, e os atalhos `lk-desertas`
     e `lk-jornais`). Tratá-las como telas separadas quebraria o clique dentro da
     própria tela e deixaria o menu marcando o módulo errado. Por isso `ancora`:
     estando no Encontrar, rola até a seção; vindo de fora, abre o Encontrar já
     na seção certa. */
  var MODULOS = [
    { g: 'Oportunidades' },
    { id: 'buscar', rotulo: 'Buscar', href: 'fpmed_licitacoes.html', tela: 'fpmed_licitacoes' },
    { id: 'radar', rotulo: 'Radar', href: 'fpmed_licitacoes.html#radar', ancora: 'radar' },
    { id: 'desertas', rotulo: 'Desertas', href: 'fpmed_licitacoes.html#lk-desertas', ancora: 'lk-desertas' },
    { id: 'jornais', rotulo: 'Meus Jornais', href: 'fpmed_licitacoes.html#jornais', ancora: 'jornais' },

    { g: 'Gestão' },
    { id: 'negocios', rotulo: 'Negócios', href: 'fpmed_negocios.html', tela: 'fpmed_negocios' },
    /* ══ O CALENDÁRIO ACENDEU (12/08, item 6) ═══════════════════════════════════════════════
       Ele nasceu aqui DESLIGADO, com "em breve", pra que o menu não mudasse de tamanho no dia
       da entrega — e agora só troca de estado, no mesmo lugar da lista onde já estava.
       >>> ELE APONTA PRA UMA VISÃO DO NEGÓCIOS, e não pra uma tela nova, porque é o MESMO
           dado (a abertura dos negócios) respondendo outra pergunta. Uma tela separada teria
           que reescrever a leitura paginada, o cartão, a ficha e o sino — quatro cópias que
           envelheceriam em ritmos diferentes. É o mesmo raciocínio que fez Radar, Desertas e
           Jornais serem âncoras dentro do Encontrar em vez de telas.
       >>> `#calendario` NÃO É ÂNCORA DE ROLAGEM, e é a primeira que não é: a tela lê o `#` no
           boot e abre já na VISÃO certa. Sem isso, clicar em "Calendário" cairia nos Quadros,
           porque a tela guarda a última visão escolhida — e item de menu que leva a outro lugar
           estraga a confiança no menu inteiro. O campo continua se chamando `ancora` porque o
           que ele guarda é o mesmo: o `#` que identifica este módulo. Quem decide o que fazer
           com ele é a tela de destino.
       >>> `tela` FICA DE FORA de propósito: com ela, abrir o Negócios SEM `#` acenderia os dois
           itens. Quem responde por `fpmed_negocios` sem hash é o Negócios. */
    { id: 'calendario', rotulo: 'Calendário', href: 'fpmed_negocios.html#calendario', ancora: 'calendario' },
    { id: 'documentos', rotulo: 'Documentos', href: 'fpmed_documentos.html', tela: 'fpmed_documentos' },

    { g: 'Ferramentas' },
    { id: 'proposta', rotulo: 'Proposta', href: 'fpmed_giovana.html', tela: 'fpmed_giovana' },
    /* ── A ÚNICA ENTRADA COM PORTÃO (12/08) ───────────────────────────────────────
       O Leitor é piloto: ele nasce ESCONDIDO e só é revelado pra quem está na lista.
       Isso não é segurança — quem barra de verdade é a edge function, que confere o
       JWT e responde 403. É pra NÃO OFERECER o que vai ser negado: porta na cara é
       atrito, e atrito repetido ensina a pessoa a desconfiar do menu inteiro.

       >>> A LISTA MORA AQUI PORQUE ELA ESTAVA EM TRÊS LUGARES. O mesmo array vivia
       copiado no Encontrar, na ficha do negócio e na tela do Leitor — a doença que
       este arquivo inteiro existe pra curar (a barra do portal estava em 6 telas, e
       foi assim que a entrada do Leitor entrou em 2 e faltou em 4).
       >>> E O MENU CONTINUA BURRO, de propósito: ele não lê sessão, não chama banco,
       não sabe quem está logado. Ele guarda a LISTA (que é dado sobre módulo) e
       expõe `revelarPara(email)`. Quem tem a sessão é a tela, e é ela que pergunta. */
    { id: 'leitor', rotulo: 'Leitor de edital', href: 'fpmed_edital_ia.html', tela: 'fpmed_edital_ia',
      permissao: ['licitacao@fpmed.com.br'] },
    { id: 'conferir', rotulo: 'Conferir CMED', href: 'fpmed_conferidor.html', tela: 'fpmed_conferidor' },
    { id: 'pecas', rotulo: 'Peças', href: 'fpmed_pecas.html', tela: 'fpmed_pecas' },
    { id: 'declaracoes', rotulo: 'Declarações', href: 'fpmed_declaracoes.html', tela: 'fpmed_declaracoes' },
    { id: 'sistema', rotulo: 'Sistema comercial', href: 'fpmed_sistema_final.html', tela: 'fpmed_sistema_final' }
  ];

  /* Qual módulo está aberto. DERIVA do arquivo; o `data-modulo` só existe pra tela
     que precise dizer outra coisa. Derivar em vez de configurar evita a classe de
     defeito mais chata de menu: a tela que esqueceu de se identificar e fica com o
     item errado aceso pra sempre — e ninguém percebe, porque menu a gente não lê,
     a gente só clica. */
  function moduloAtual(alvo) {
    var dito = alvo && alvo.getAttribute && alvo.getAttribute('data-modulo');
    if (dito) return dito;
    var arq = (window.location.pathname.split('/').pop() || '').replace(/\.html?$/i, '');
    var h = (window.location.hash || '').replace('#', '');
    /* ══ O `#` DECIDE, E AGORA EM QUALQUER TELA (12/08, item 6) ═══════════════════════════════
       Esta busca era travada em `fpmed_licitacoes` — o único lugar que tinha módulos dentro de
       uma tela. Com o Calendário virando uma VISÃO do Negócios, o travamento passou a produzir
       o defeito que o comentário lá em cima descreve: clicar em "Calendário" acendia "Negócios".
       >>> E ELA CONFERE A TELA JUNTO COM O `#`, e não só o `#`: sem isso, um `#calendario` numa
           tela qualquer acenderia o Calendário de outra. Módulo é (tela + hash), não hash. */
    if (h) {
      for (var i = 0; i < MODULOS.length; i++) {
        var mm = MODULOS[i];
        if (mm.ancora === h && mm.href
            && mm.href.split('#')[0].replace(/\.html?$/i, '') === arq) return mm.id;
      }
    }
    for (var j = 0; j < MODULOS.length; j++) if (MODULOS[j].tela === arq) return MODULOS[j].id;
    return null;
  }

  /* O tema é a única fonte de cor e espaçamento. Se a tela ainda não o carregou, o
     menu carrega — e isso é seguro POR CONSTRUÇÃO: o fpmed_tema.css não tem um
     único seletor de elemento nu, então entrar numa tela antiga não muda um pixel
     dela. Foi exatamente pra isso que ele nasceu inerte. */
  function garanteTema() {
    if (document.querySelector('link[href*="fpmed_tema.css"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = 'fpmed_tema.css';
    document.head.appendChild(l);
  }

  /* Todo o CSS mora sob #limedtec-menu. Nada aqui pode vazar pra tela que hospeda:
     o menu é convidado, e convidado não mexe na mobília da casa. */
  var CSS = [
    '#limedtec-menu{position:fixed;left:0;top:0;bottom:0;width:224px;z-index:40;',
    '  display:flex;flex-direction:column;overflow-y:auto;',
    '  background:var(--branco);border-right:1px solid var(--cinza-200);',
    '  font-family:var(--fonte);padding:var(--esp-2) 0 var(--esp-3)}',

    '#limedtec-menu .lm-marca{display:flex;align-items:center;gap:var(--esp-3);',
    '  padding:var(--esp-2) var(--esp-4) var(--esp-4);',
    '  border-bottom:1px solid var(--cinza-100);margin-bottom:var(--esp-2)}',
    '#limedtec-menu .lm-cruz{width:32px;height:32px;flex:0 0 auto;border-radius:var(--raio-botao);',
    '  background:var(--azul-500);color:var(--branco);display:grid;place-items:center;',
    '  font-weight:var(--peso-forte);font-size:var(--txt-4);line-height:1}',
    '#limedtec-menu .lm-marca b{display:block;font-size:var(--txt-2);font-weight:var(--peso-semi);',
    '  color:var(--azul-800);line-height:1.15}',
    '#limedtec-menu .lm-marca small{display:block;font-size:var(--txt-1);letter-spacing:.18em;',
    '  color:var(--cinza-400);font-weight:var(--peso-semi);line-height:1.4}',

    /* O rótulo de grupo é o que transforma 14 links numa lista organizada: sem ele
       o olho tem que ler tudo pra achar. Menor e mais claro que os itens, sempre. */
    '#limedtec-menu .lm-grupo{padding:var(--esp-3) var(--esp-4) var(--esp-1);',
    '  font-size:var(--txt-1);letter-spacing:.1em;text-transform:uppercase;',
    '  color:var(--cinza-400);font-weight:var(--peso-semi)}',

    '#limedtec-menu a,#limedtec-menu .lm-off{display:flex;align-items:center;gap:var(--esp-3);',
    '  padding:var(--esp-2) var(--esp-4);font-size:var(--txt-2);text-decoration:none;',
    '  color:var(--cinza-600);border-left:3px solid transparent;',
    '  transition:background-color var(--transicao),color var(--transicao)}',
    '#limedtec-menu a{cursor:pointer}',
    '#limedtec-menu a:hover{background:var(--cinza-50);color:var(--cinza-800)}',
    '#limedtec-menu a:focus-visible{outline:none;box-shadow:var(--foco)}',

    /* O item aceso usa TRÊS sinais: fundo, cor e a barra da esquerda. Não é
       exagero — quem não distingue o azul do cinza ainda enxerga a barra e o peso.
       Cor sozinha marcando estado é a falha de acessibilidade mais comum que existe. */
    '#limedtec-menu a.lm-on{background:var(--azul-50);color:var(--azul-700);',
    '  border-left-color:var(--azul-500);font-weight:var(--peso-semi)}',

    '#limedtec-menu .lm-off{color:var(--cinza-400);cursor:default}',
    '#limedtec-menu .lm-breve{margin-left:auto;font-size:var(--txt-1);',
    '  color:var(--cinza-400);font-weight:var(--peso-normal)}',

    '#limedtec-menu svg{width:20px;height:20px;flex:0 0 auto;stroke:currentColor;fill:none;',
    '  stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',

    '#limedtec-menu .lm-rodape{margin-top:auto;padding:var(--esp-3) var(--esp-4) 0;',
    '  border-top:1px solid var(--cinza-100);font-size:var(--txt-1);color:var(--cinza-500);',
    '  line-height:1.6}',
    '#limedtec-menu .lm-rodape span{display:flex;align-items:center;gap:var(--esp-2)}',
    '#limedtec-menu .lm-rodape svg{width:16px;height:16px}',

    /* Em tela estreita o menu vira uma faixa horizontal rolável no topo. Escondê-lo
       não é opção: sumiria a navegação inteira do sistema no celular. */
    '@media (max-width:900px){',
    '  #limedtec-menu{position:static;width:auto;flex-direction:row;overflow-x:auto;',
    '    border-right:none;border-bottom:1px solid var(--cinza-200);padding:0}',
    '  #limedtec-menu .lm-marca,#limedtec-menu .lm-grupo,#limedtec-menu .lm-rodape{display:none}',
    '  #limedtec-menu a,#limedtec-menu .lm-off{white-space:nowrap;border-left:none;',
    '    border-bottom:3px solid transparent}',
    '  #limedtec-menu a.lm-on{border-left-color:transparent;border-bottom-color:var(--azul-500)}}'
  ].join('\n');

  function svg(nome) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONE[nome] || '') + '</svg>';
  }

  function montar(alvo) {
    if (!alvo || alvo.getAttribute('data-montado') === '1') return null;
    garanteTema();

    if (!document.getElementById('limedtec-menu-css')) {
      var st = document.createElement('style');
      st.id = 'limedtec-menu-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    var atual = moduloAtual(alvo);
    var nav = document.createElement('nav');
    nav.id = 'limedtec-menu';
    nav.setAttribute('aria-label', 'Módulos do sistema');

    var h = ['<div class="lm-marca"><div class="lm-cruz">+</div>',
      '<div><b>FPMED</b><small>HOSPITALAR</small></div></div>'];

    for (var i = 0; i < MODULOS.length; i++) {
      var m = MODULOS[i];
      if (m.g) { h.push('<div class="lm-grupo">' + m.g + '</div>'); continue; }
      if (m.emBreve) {
        h.push('<div class="lm-off" aria-disabled="true">' + svg(m.id) + m.rotulo +
          '<span class="lm-breve">em breve</span></div>');
        continue;
      }
      var on = (m.id === atual);
      /* `hidden` NO HTML, e não um item que some depois de pintado: menu que pisca com
         um link a mais no boot ensina a pessoa a esperar que ele mude sozinho — e aí
         ela para de confiar no que está vendo. Nasce escondido, é revelado. */
      h.push('<a href="' + m.href + '" class="' + (on ? 'lm-on' : '') + '"' +
        (on ? ' aria-current="page"' : '') +
        (m.permissao ? ' hidden data-permissao="' + m.id + '"' : '') +
        '>' + svg(m.id) + m.rotulo + '</a>');
    }

    h.push('<div class="lm-rodape"><span>' + svg('telefone') + '(62) 3290-4241</span>' +
      'Compromisso com qualidade!</div>');

    nav.innerHTML = h.join('');
    alvo.appendChild(nav);
    alvo.setAttribute('data-montado', '1');
    return nav;
  }

  function iniciar() {
    var alvos = document.querySelectorAll('[data-limedtec-menu]');
    for (var i = 0; i < alvos.length; i++) montar(alvos[i]);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
  }

  /* ── REVELAR O QUE TEM PORTÃO ────────────────────────────────────────────────────
     A tela sabe quem está logado; o menu sabe quais módulos têm lista. Cada um faz a
     parte que só ele pode fazer, e a decisão fica num lugar só.
     >>> É TOLERANTE POR CONSTRUÇÃO: sem e-mail, com e-mail fora da lista, ou com o
     menu ainda não montado, ele simplesmente não revela nada. Nunca estoura — porque
     quem chama isso é o boot da tela, e derrubar o boot por causa de um item de menu
     seria trocar um atrito por uma tela morta.
     >>> DEVOLVE QUANTOS REVELOU, pra suíte poder cobrar o comportamento em vez de
     confiar que "deve ter funcionado". */
  function revelarPara(email) {
    var e = String(email || '').trim().toLowerCase();
    if (!e) return 0;
    var n = 0;
    for (var i = 0; i < MODULOS.length; i++) {
      var m = MODULOS[i];
      if (!m.permissao || m.permissao.indexOf(e) < 0) continue;
      var el = document.querySelector('#limedtec-menu [data-permissao="' + m.id + '"]');
      if (el) { el.hidden = false; n++; }
    }
    return n;
  }

  /* Exportado pra suíte e pra tela que precise montar depois (modal, troca de aba). */
  if (typeof window !== 'undefined') {
    window.LimedtecMenu = { montar: montar, moduloAtual: moduloAtual, MODULOS: MODULOS,
      ICONE: ICONE, CSS: CSS, revelarPara: revelarPara };
  }
})();
