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

   1. TAMANHOS DE TEXTO. O molde usa 12,5px nos links e 9,5px nos grupos — nenhum
      dos dois existe na nossa escala. Aqui: --txt-1 (12px) nos links e --txt-0
      (10px) nos grupos, que são os degraus MAIS PRÓXIMOS de cada um. A hierarquia
      (grupo bem menor e mais espaçado que o item) fica idêntica à do molde.
      >>> ESTA DIVERGÊNCIA FOI REVISADA DUAS VEZES NO MESMO DIA, e as duas revisões
          valem mais que o texto final:
          · de manhã (fatia 2) o grupo desceu de --txt-1 pra --txt-0, que NASCEU pra
            ele — a amostra mostrou que o rótulo precisa ser bem menor e bem mais
            espaçado que a etiqueta comum, e é essa combinação que o faz recuar sem
            clarear. Foi por ele estar CLAREADO demais (2,44:1) que a medição o pegou;
          · à tarde (passo 2 do molde) o LINK desceu de --txt-2 (14px) pra --txt-1
            (12px). O texto anterior dizia "fica --txt-2, o menu fica um fio maior e
            ganha legibilidade" — aquilo valia pro menu branco e espaçado. Com a linha
            de 30px do molde, 14px não é um fio maior: é texto fora da régua onde ele
            foi desenhado. E o --txt-1 sempre foi o degrau mais perto dos 12,5px; a
            escolha da manhã tinha ido pro lado errado.
          >>> E A LEGIBILIDADE NÃO CAIU, foi MEDIDA: o item em repouso saiu de
              --cinza-600 sobre branco (6,17:1) pra --navy-tinta sobre navy (10,78:1).

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
    /* ══ O SELO "IA" (13/08, item 7c) ═══════════════════════════════════════════════
       O molde põe um selo verde "IA" neste item. Ele não é enfeite nem contador: é
       AVISO DE NATUREZA — este é o único módulo do menu que gasta dinheiro por uso
       (cada leitura de edital consome crédito da Anthropic e entra no `usos_ia`).
       >>> POR QUE ELE NÃO É O `contador`, que já existe ao lado: o contador é NÚMERO e
           muda; o selo é RÓTULO e não muda. Se eu tivesse reaproveitado o slot do
           número, o dia em que este item ganhasse contagem apagaria o aviso — e o
           aviso é o que impede alguém de clicar sem saber que aquilo custa. */
    { id: 'leitor', rotulo: 'Leitor de edital', href: 'fpmed_edital_ia.html', tela: 'fpmed_edital_ia',
      selo: 'IA', permissao: ['licitacao@fpmed.com.br'] },
    /* ══ "CONFERIR CMED" SAIU DA LISTA (item 8, 13/08) ═══════════════════════════════════════
       Ordem do dono: a CMED deixa de ser ABA e vira BASE por baixo de todo preço. Um item de
       menu chamado "Conferir CMED" ensina que conferir o teto legal é uma parada separada, que
       alguém lembra de fazer — e é justamente isso que o item 8 desfaz: o teto passa a aparecer
       ONDE O PREÇO ESTÁ, no detalhe do item e na Proposta.
       >>> A TELA NÃO FOI APAGADA E NÃO VIROU LINK QUEBRADO. Ela continua existindo e continua na
           casca do service worker; o que mudou foi o lugar de onde se chega nela — o rodapé do
           menu, como consulta crua, que é o que ela de fato é.
       >>> POR QUE NO RODAPÉ E NÃO SUMINDO DE VEZ: colar uma planilha e conferir 200 linhas de
           uma proposta pronta continua sendo um trabalho legítimo, e é um trabalho que nenhuma
           camada de base faz por você. Tirar o acesso obrigaria a decorar a URL. */
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
    /* ══ A SIDEBAR NAVY — passo 2 do molde oficial (13/08) ═══════════════════════════
       O menu era BRANCO com borda à direita; virou a superfície escura do molde.

       >>> POR QUE ISSO NÃO É "TROCAR DE COR", e sim o desenho certo: com a sidebar
           branca, ela e a área de conteúdo eram a MESMA superfície separada por uma
           linha de 1px — e o olho tinha que procurar onde acabava a navegação e
           começava o trabalho. O navy resolve isso sem gastar uma borda: a moldura é
           escura, o palco é claro, e a fronteira é a diferença de matéria.
       >>> E ELE NÃO ROUBA A ATENÇÃO. Um escuro chapado ao lado de conteúdo claro
           poderia puxar o olho pra si o dia inteiro; o do molde não puxa porque a
           tinta dos itens é discreta (--navy-tinta em repouso) e só o item ACESO
           recebe fundo, peso e ícone azul. O escuro é fundo, não destaque.

       228px em vez de 236, com a densidade nova: item de 30px de altura em vez de 40.
       Menu mais estreito COM o mesmo aperto seria só menu menor — aqui o que encolheu
       foi a ALTURA da linha, e o respiro lateral continua. */
    '#limedtec-menu{position:fixed;left:0;top:0;bottom:0;width:var(--menu-largura);z-index:40;',
    '  display:flex;flex-direction:column;overflow-y:auto;',
    '  background:var(--navy);',
    '  font-family:var(--fonte);padding:0 0 var(--esp-3)}',

    /* A MARCA. O quadrado é o do molde (26×26, raio 7, azul da marca) e o símbolo
       dentro dele é a CRUZ FPMED, não o escudo do molde: o próprio README dele diz
       que o logo é placeholder e manda substituir pelo logotipo oficial. */
    '#limedtec-menu .lm-marca{display:flex;align-items:center;gap:var(--esp-2);',
    '  padding:var(--esp-3) var(--esp-3);min-height:52px;box-sizing:border-box;',
    '  border-bottom:1px solid var(--navy-borda);margin-bottom:var(--esp-3)}',
    '#limedtec-menu .lm-cruz{width:26px;height:26px;flex:0 0 auto;border-radius:var(--raio-botao);',
    '  background:var(--azul-500);color:var(--branco);display:grid;place-items:center;',
    '  font-weight:var(--peso-forte);font-size:var(--txt-3);line-height:1}',
    '#limedtec-menu .lm-marca b{display:block;font-size:var(--txt-2);font-weight:var(--peso-forte);',
    '  color:var(--branco);line-height:1.15}',
    '#limedtec-menu .lm-marca small{display:block;font-size:var(--txt-0);letter-spacing:.22em;',
    '  color:var(--navy-marca);font-weight:var(--peso-semi);line-height:1.4}',

    /* ══ O RÓTULO DE GRUPO — a peça que o dono elogiou ═══════════════════════════════
       Ele é o que transforma 14 links numa lista organizada: sem ele o olho tem que ler
       tudo pra achar. É ele que separa LICITAÇÃO (Oportunidades + Gestão) das
       FERRAMENTAS de apoio, que foi o pedido de 13/08.
       O tamanho (--txt-0) e o espaçamento (.14em) são os mesmos de antes — é essa
       combinação que faz o rótulo RECUAR sem precisar clarear.
       >>> A COR MUDOU DE PROBLEMA, e vale registrar: no menu branco ela era o
           --cinza-500, escolhido de manhã porque o --cinza-400 dava 2,44:1. Sobre o
           navy, o cinza claro seria ilegível pelo motivo OPOSTO; quem serve aqui é o
           --navy-rotulo (#7C90AE), medido em 5,28:1 contra o navy. */
    '#limedtec-menu .lm-grupo{padding:var(--esp-4) var(--esp-2) var(--esp-1);',
    '  font-size:var(--txt-0);letter-spacing:.14em;text-transform:uppercase;',
    '  color:var(--navy-rotulo);font-weight:var(--peso-semi)}',
    /* O primeiro grupo não precisa do respiro de cima: ele já vem depois da divisória
       da marca, e dois espaços empilhados leem como buraco, não como separação. */
    '#limedtec-menu .lm-grupo:first-of-type{padding-top:0}',

    /* O ITEM. 30px de altura, raio 6, ícone de 14 — a densidade do molde.
       >>> O TEXTO DESCEU DE --txt-2 (14px) PRA --txt-1 (12px), e isso REVISA a
           divergência nº 1 declarada no topo deste arquivo. Ela dizia "o protótipo usa
           12,5px, que não existe na nossa escala; fica --txt-2, o menu fica um fio
           maior e ganha legibilidade". Aquilo valia pro menu BRANCO e espaçado. Com a
           linha de 30px do molde, 14px não é "um fio maior": é texto que não cabe na
           régua onde ele foi desenhado. E o --txt-1 é o degrau MAIS PRÓXIMO dos 12,5px
           do molde — ele sempre foi, e a escolha anterior tinha ido pro lado errado.
       >>> E A LEGIBILIDADE NÃO CAIU, foi medida: o item em repouso passou de
           --cinza-600 sobre branco (6,17:1) pra --navy-tinta sobre navy (10,78:1). */
    '#limedtec-menu a,#limedtec-menu .lm-off{display:flex;align-items:center;gap:var(--esp-2);',
    '  min-height:30px;box-sizing:border-box;margin:0 var(--esp-2);',
    '  padding:0 var(--esp-2);font-size:var(--txt-1);text-decoration:none;',
    '  color:var(--navy-tinta);border-radius:var(--raio-item);',
    '  transition:background-color var(--transicao),color var(--transicao)}',
    '#limedtec-menu a{cursor:pointer}',
    '#limedtec-menu a:hover{background:var(--navy-hover);color:var(--branco)}',
    '#limedtec-menu a:focus-visible{outline:none;box-shadow:var(--foco)}',

    /* O item aceso usa TRÊS sinais: fundo, cor do texto e cor do ícone. Não é
       exagero — quem não distingue o azul do cinza ainda enxerga o fundo e o peso.
       Cor sozinha marcando estado é a falha de acessibilidade mais comum que existe.
       >>> A BARRA DA ESQUERDA SAIU, e é a única peça do desenho anterior que eu não
           troquei por equivalente: com o item virando uma pílula arredondada de 30px
           dentro da sidebar, uma barra colada na borda esquerda ficaria FORA da
           pílula — marcando o menu, não o item. O fundo faz o mesmo trabalho e é o
           que o molde usa. */
    '#limedtec-menu a.lm-on{background:var(--navy-ativo);color:var(--branco);',
    '  font-weight:var(--peso-medio)}',
    '#limedtec-menu a.lm-on svg{color:var(--azul-500)}',

    '#limedtec-menu .lm-off{color:var(--navy-rotulo);cursor:default}',
    /* "em breve" é ETIQUETA contornada: um texto solto na ponta da linha lê como parte
       do nome do módulo ("Calendário em breve"); dentro de uma borda, lê como estado. */
    '#limedtec-menu .lm-breve{margin-left:auto;font-size:var(--txt-0);letter-spacing:.06em;',
    '  text-transform:uppercase;color:var(--navy-rotulo);font-weight:var(--peso-semi);',
    '  border:1px solid var(--navy-borda);border-radius:var(--raio-pilula);padding:0 var(--esp-1)}',

    /* ══ O CONTADOR — o slot existe, o número NÃO É INVENTADO ════════════════════════
       O molde põe número em quatro itens (Buscar 9.050 · Radar 12 · Desertas 38 ·
       Negócios 71). Esses quatro são DADO FICTÍCIO DE DEMONSTRAÇÃO — está escrito no
       README dele — e a ordem do dono sobre os KPIs vale igual aqui: número na tela
       tem que vir do banco.
       >>> ENTÃO O QUE ENTROU FOI O SLOT, e ele nasce VAZIO. Quem tem o número é a
           tela (ela é que lê o banco); ela chama `LimedtecMenu.contador(id, n)`.
           Sem chamada, nada aparece — ausência é honesta, e um "0" chumbado seria a
           lição S6 outra vez ("não sei" nunca vira zero), agora dentro do menu.
       >>> `tabular-nums` porque o contador fica na borda direita: sem ele, "12" e "38"
           terminam em posições diferentes e a coluna dança a cada troca de tela. */
    /* O SELO é o mesmo formato do contador — mesma altura, mesmo raio, mesmo degrau de
       texto — porque os dois ocupam a mesma ponta da linha. Cor: o verde da marca, com o
       navy por cima (9,04:1). O que muda entre eles é o ofício: número x rótulo. */
    '#limedtec-menu .lm-selo{margin-left:auto;font-size:var(--txt-0);font-weight:var(--peso-forte);',
    '  letter-spacing:.06em;background:var(--verde-500);color:var(--navy);',
    '  border-radius:var(--raio-selo);padding:0 var(--esp-1);line-height:1.6}',
    /* Com selo E contador na mesma linha, o `margin-left:auto` do contador o empurraria pra
       longe do selo. Aqui só o PRIMEIRO da dupla empurra; o segundo cola no primeiro. */
    '#limedtec-menu .lm-selo + .lm-num{margin-left:var(--esp-1)}',
    '#limedtec-menu .lm-num{margin-left:auto;font-size:var(--txt-0);font-weight:var(--peso-semi);',
    '  font-variant-numeric:tabular-nums;background:var(--navy-selo);color:var(--navy-selo-tinta);',
    '  border-radius:var(--raio-selo);padding:0 var(--esp-1);line-height:1.6}',
    '#limedtec-menu .lm-num[hidden]{display:none}',
    '#limedtec-menu .lm-num.lm-num--destaque{background:var(--verde-500);color:var(--navy)}',

    '#limedtec-menu svg{width:14px;height:14px;flex:0 0 auto;stroke:currentColor;fill:none;',
    '  stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',

    '#limedtec-menu .lm-rodape{margin-top:auto;padding:var(--esp-3) var(--esp-3) 0;',
    '  border-top:1px solid var(--navy-borda);font-size:var(--txt-0);color:var(--navy-apoio);',
    '  line-height:1.7}',
    '#limedtec-menu .lm-rodape span{display:flex;align-items:center;gap:var(--esp-2)}',
    /* A busca crua: mesmo alvo de clique dos itens de cima, peso menor. O `--navy-apoio` é o
       tom do rodapé, e ela acende pro tom de leitura no hover — o mesmo gesto dos outros. */
    '#limedtec-menu .lm-crua{display:flex;align-items:center;gap:var(--esp-2);',
    '  padding:var(--esp-2) 0;color:var(--navy-apoio);text-decoration:none;',
    '  transition:color var(--transicao)}',
    '#limedtec-menu .lm-crua:hover{color:var(--navy-tinta)}',
    '#limedtec-menu .lm-crua:focus-visible{outline:none;box-shadow:var(--foco);border-radius:var(--raio-item)}',

    /* Em tela estreita o menu vira uma faixa horizontal rolável no topo. Escondê-lo
       não é opção: sumiria a navegação inteira do sistema no celular. */
    '@media (max-width:900px){',
    '  #limedtec-menu{position:static;width:auto;flex-direction:row;overflow-x:auto;',
    '    border-bottom:1px solid var(--navy-borda);padding:0}',
    '  #limedtec-menu .lm-marca,#limedtec-menu .lm-grupo,#limedtec-menu .lm-rodape{display:none}',
    '  #limedtec-menu a,#limedtec-menu .lm-off{white-space:nowrap;border-radius:0;',
    '    margin:0;border-bottom:3px solid transparent}',
    '  #limedtec-menu a.lm-on{background:none;border-bottom-color:var(--azul-500)}}'
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
        '>' + svg(m.id) + m.rotulo +
        (m.selo ? '<span class="lm-selo" title="este módulo usa inteligência artificial e '
                + 'consome crédito por uso">' + m.selo + '</span>' : '') +
        '<span class="lm-num" hidden data-num="' + m.id + '"></span></a>');
    }

    /* ══ O RODAPÉ É O NOSSO, E NÃO O DO MOLDE — decisão declarada ══════════════════
       O molde põe aqui um BLOCO DE USUÁRIO (avatar, nome, "Plano Empresarial",
       chevron). Ele não entrou, e o motivo não é preguiça: essa mesma informação já
       é impressa pelo `gm-auth.js` na etiqueta fixa do canto superior direito, em
       TODAS as dez telas. Ter a identidade em dois lugares é pior que tê-la num só
       — no dia em que uma delas ficasse desatualizada, ninguém saberia qual acreditar.
       >>> ELE ENTRA JUNTO COM O CONSERTO DO gm-auth.js, que está registrado como
           dívida e bloqueado pelas 8 telas ainda escuras (trocar a etiqueta por
           tokens claros conserta duas telas e quebra oito).
       Até lá fica o que o menu já dizia: o telefone e o compromisso. */
    /* ══ A BUSCA CRUA DA CMED, DISCRETA, NO RODAPÉ (item 8, 13/08) ═══════════════════════════
       Ela saiu da lista de módulos junto com o "Conferir CMED" e reapareceu aqui embaixo, como
       consulta — que é o que ela é. Fica acima do telefone porque é ação; o telefone é dado.
       >>> DISCRETA NÃO É ESCONDIDA. Ela é um link de verdade, com o mesmo ícone e o mesmo alvo
           de clique dos outros; o que muda é o PESO, e é o peso que diz "isto não é uma parada
           do seu fluxo". Esconder de vez obrigaria a decorar a URL. */
    h.push('<div class="lm-rodape">'
      + '<a class="lm-crua" href="fpmed_conferidor.html" '
      +   'title="consulta crua da tabela CMED: cole uma planilha ou um texto e confira preço contra o teto legal">'
      +   svg('conferir') + 'Consultar a tabela CMED</a>'
      + '<span>' + svg('telefone') + '(62) 3290-4241</span>'
      + 'Compromisso com qualidade!</div>');

    nav.innerHTML = h.join('');
    alvo.appendChild(nav);
    alvo.setAttribute('data-montado', '1');
    return nav;
  }

  /* ══ O ITEM ACESO TEM QUE SEGUIR O `#`, E NÃO SÓ A CARGA DA PÁGINA ═══════════════
     Achado na urgência do dono de 13/08 ("clicar em RADAR não faz nada"). O defeito
     principal era da tela de destino, que não lia o `#` — mas o menu tinha a sua
     parte: `montar()` calcula o módulo atual UMA vez, no boot, e escreve `lm-on` no
     HTML. Quem já estava no Encontrar e clicava em "Radar" trocava o `#` sem
     recarregar, e o menu continuava acendendo "Buscar" — apontando pro lugar errado.
     >>> ISSO É PIOR QUE ENFEITE ERRADO: o item aceso é a única coisa na tela que
         responde "onde eu estou?". Ele mentindo, a pessoa clica de novo achando que
         não clicou — que foi exatamente o que o dono viu.
     >>> REPINTA, NÃO REMONTA: remontar o menu a cada `#` apagaria o que a tela
         escreveu nele depois (o contador, e a revelação do Leitor pra quem tem
         permissão). Aqui só as classes mudam. */
  function acender() {
    var navs = document.querySelectorAll('#limedtec-menu');
    for (var n = 0; n < navs.length; n++) {
      var atual = moduloAtual(navs[n].parentElement);
      var links = navs[n].querySelectorAll('a[href]');
      for (var i = 0; i < links.length; i++) {
        var mod = null;
        for (var j = 0; j < MODULOS.length; j++) {
          if (MODULOS[j].href === links[i].getAttribute('href')) { mod = MODULOS[j]; break; }
        }
        var on = !!mod && mod.id === atual;
        links[i].classList.toggle('lm-on', on);
        if (on) links[i].setAttribute('aria-current', 'page');
        else links[i].removeAttribute('aria-current');
      }
    }
  }

  function iniciar() {
    var alvos = document.querySelectorAll('[data-limedtec-menu]');
    for (var i = 0; i < alvos.length; i++) montar(alvos[i]);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
    if (typeof window !== 'undefined') window.addEventListener('hashchange', acender);
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

  /* ── O CONTADOR ────────────────────────────────────────────────────────────────
     Quem sabe o número é a TELA, porque é ela que lê o banco; o menu só tem o lugar
     onde ele aparece. Mesma divisão de trabalho do `revelarPara`, e pelo mesmo
     motivo: cada um faz a parte que só ele pode fazer.

     >>> O SLOT NASCE VAZIO E VOLTA A FICAR VAZIO. Passar `null`, `undefined` ou algo
         que não seja número esconde o contador — e esconder é o comportamento certo,
         não um caso de borda: se a leitura do banco falhou, a tela NÃO SABE quantos
         são, e "não sei" nunca vira zero (lição S6). Um "0" aceso ali diria
         "não há nenhum", que é uma afirmação diferente e pode ser falsa.
     >>> `destaque` pinta de verde (o do molde, no "Buscar" e no badge "IA"). É a
         única cor que o contador tem além da neutra, e ela quer dizer NOVIDADE —
         não "importante". Um contador verde permanente vira enfeite em três dias.
     >>> DEVOLVE `true`/`false` (achou o slot?) pra suíte poder cobrar o
         comportamento em vez de confiar que deve ter funcionado. */
  function contador(id, n, destaque) {
    var el = document.querySelector('#limedtec-menu [data-num="' + String(id).replace(/"/g, '') + '"]');
    if (!el) return false;
    var vale = (typeof n === 'number' && isFinite(n));
    if (!vale) { el.hidden = true; el.textContent = ''; return true; }
    el.textContent = n.toLocaleString('pt-BR');
    el.className = 'lm-num' + (destaque ? ' lm-num--destaque' : '');
    el.hidden = false;
    return true;
  }

  /* Exportado pra suíte e pra tela que precise montar depois (modal, troca de aba). */
  if (typeof window !== 'undefined') {
    window.LimedtecMenu = { montar: montar, moduloAtual: moduloAtual, MODULOS: MODULOS,
      ICONE: ICONE, CSS: CSS, revelarPara: revelarPara, contador: contador, acender: acender };
  }
})();
