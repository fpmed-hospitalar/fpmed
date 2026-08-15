/* ============================================================================================
   fpmed_icones.js — O DICIONÁRIO DE ÍCONES DO SISTEMA, EM UM LUGAR SÓ.

   FRONTEIRA (as três linhas do topo, como manda o padrão):
     · ele NÃO desenha nada e não decide nada: só injeta o sprite <symbol> no documento;
     · quem escolhe o ícone é a tela, por <use href="#ic-...">;
     · em node ele é um módulo de leitura (SPRITE / ICONES), pra suíte conferir sem navegador.

   ── POR QUE ESTE ARQUIVO EXISTE (13/08/2026, item 7d) ────────────────────────────────────────
   O sprite nasceu INLINE no fpmed_negocios.html (19 símbolos, 12/08) e a Encontrar não tinha
   sprite nenhum: ela desenhava os ícones com <svg> e <path> escritos à mão, ali mesmo.
   >>> E A CÓPIA JÁ TINHA COMEÇADO A DIVERGIR, o que é a prova de que o problema é real e não
       teórico. O selo do órgão existia nos DOIS lugares com desenhos QUASE iguais:
         Negócios (#ic-orgao) .... M5.5 21V10 M10 21V10 M14 21V10 M18.5 21V10 · m12 3 9 5H3z
         Encontrar (inline) ...... M5 21V10  M9.5 21V10 M14.5 21V10 M19 21V10 · m12 3 8 5H4z
       Meio pixel de diferença nas colunas e no frontão. Ninguém enxerga isso lado a lado — e é
       exatamente esse o problema: é o "quase igual" que D3 chama de pior que o desalinhado,
       porque não gera reclamação, só cansaço.
   >>> ORDEM DO DONO (13/08): "use o MESMO sprite SVG que o Negócios já usa — consistência
       entre telas. Nada de conjunto novo à parte." Copiar os 19 símbolos pro segundo arquivo
       cumpriria a ordem HOJE e a quebraria no dia da primeira correção feita num só lado.
       Então o sprite passou a morar aqui, e esta é a fonte única.

   >>> ATENÇÃO — A ADOÇÃO ESTÁ PELA METADE, DE PROPÓSITO, E ISSO ESTÁ MEDIDO.
       Quem carrega este arquivo hoje é só a Encontrar. O fpmed_negocios.html continua com o
       sprite INLINE porque ele está sendo trabalhado em outra frente (item 7b) e mexer nele
       daqui seria escrever por cima de quem está com o arquivo aberto.
       Ou seja: a cópia ainda existe — mas ela não pode mais divergir EM SILÊNCIO. A suíte
       tests/testa_busca_nacional_molde.js compara símbolo a símbolo o sprite inline do
       Negócios com este arquivo e fica VERMELHA se um desenho mudar num lado só. E ela é
       escrita pra continuar verde no dia em que o Negócios adotar este módulo e apagar o
       inline — a checagem só vale enquanto houver sprite inline lá.
       O passo que fecha isto: trocar o <svg id="ic-sprite"> do Negócios por
       <script src="fpmed_icones.js"></script>. Está anotado no CONTINUAR_AQUI.

   ── COMO ELE ENTRA NA PÁGINA, E POR QUE ASSIM ────────────────────────────────────────────────
   A tag <script src="fpmed_icones.js"></script> vai logo depois do <body>, e a injeção usa
   `document.currentScript.insertAdjacentHTML('afterend', ...)`: ela roda DURANTE a análise do
   documento, então o sprite já está no lugar quando o navegador encontra o primeiro <use>.
   >>> ISSO NÃO É PREFERÊNCIA DE ESTILO. Injetar depois (DOMContentLoaded, por exemplo) faz o
       <use> ser analisado apontando pra um alvo que ainda não existe, e a resolução tardia de
       fragmento não é confiável em todo navegador: o sintoma seria ícone invisível de vez em
       quando, que é o defeito mais caro de perseguir.
   >>> E ELE É IDEMPOTENTE (F4): duas tags na mesma página injetam UMA vez. Sprite duplicado
       significa `id` repetido no documento, e aí qual símbolo o <use> pega é sorte.
   ============================================================================================ */
(function (raiz) {
  'use strict';

  /* Lucide (MIT), copiado pro repo, sem CDN. `stroke` e tamanho são decididos por quem usa —
     aqui só mora o DESENHO, porque o mesmo ícone aparece em 14px no menu e em 22px no selo. */
  var SIMBOLOS = {
    'ic-alerta':     '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'ic-bloqueado':  '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    'ic-impressora': '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
    'ic-baixar':     '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
    'ic-clipe':      '<path d="M13.2 20.5 21 12.7a4.5 4.5 0 0 0-6.4-6.4L5.6 15.4a2.5 2.5 0 0 0 3.5 3.5l8.1-8.1"/>',
    'ic-balanca':    '<path d="M12 3v18"/><path d="M7 21h10"/><path d="M5 7h14"/><path d="m5 7-3 6h6z"/><path d="m19 7-3 6h6z"/>',
    'ic-trofeu':     '<path d="M6 4h12v6a6 6 0 0 1-12 0z"/><path d="M6 6H4a2 2 0 0 0 2 4"/><path d="M18 6h2a2 2 0 0 1-2 4"/><path d="M10 16h4v4h-4z"/><path d="M8 20h8"/>',
    'ic-telefone':   '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18.5h2"/>',
    'ic-nota':       '<path d="M5 3h8l5 5v13H5z"/><path d="M13 3v5h5"/><path d="M9 13h5M9 16.5h4"/>',
    'ic-documento':  '<path d="M5 3h8l5 5v13H5z"/><path d="M13 3v5h5"/>',
    'ic-calendario': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    'ic-sino':       '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
    'ic-relogio':    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'ic-orgao':      '<path d="M3 21h18"/><path d="M5.5 21V10M10 21V10M14 21V10M18.5 21V10"/><path d="m12 3 9 5H3z"/>',
    'ic-queda':      '<path d="M22 17 13.5 8.5 9 13 2 6"/><path d="M16 17h6v-6"/>',
    'ic-lapis':      '<path d="M17 3.5a2.1 2.1 0 0 1 3 3L7.5 19 3 20.5 4.5 16z"/>',
    'ic-industria':  '<path d="M3 21V9l6 4V9l6 4V4h6v17z"/><path d="M7.5 21v-3M12 21v-3M16.5 21v-3"/>',
    'ic-entrada':    '<path d="M3 12h5l2 3h4l2-3h5"/><path d="M4.5 6h15L21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z"/>',
    'ic-seta':       '<path d="M4 12h14"/><path d="m13 6 6 6-6 6"/>',
    /* ── OS DOIS QUE ENTRARAM COM O ITEM 7d ──────────────────────────────────────────────────
       Eles não são "conjunto novo à parte": são acréscimo AO conjunto único, no mesmo traço e
       na mesma grade 24x24. O globo substitui o 🌎 que marcava a busca nacional (D11 proíbe
       emoji como ícone) e a seta-pra-fora marca a ação que SAI do sistema. */
    'ic-globo':      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 3.6 9A14 14 0 0 1 12 21a14 14 0 0 1-3.6-9A14 14 0 0 1 12 3z"/>',
    'ic-sai':        '<path d="M14 3h7v7"/><path d="M10 14 20.5 3.5"/><path d="M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5"/>',
    /* ── OS OITO QUE ENTRARAM COM O ITEM 7f (a varredura de emoji da Encontrar) ──────────────
       Mesma regra dos dois de cima: acréscimo AO conjunto único, no mesmo traço e na mesma
       grade 24x24 — nunca um conjunto novo à parte (ordem do dono, 13/08).
       >>> `ic-certo` e `ic-x` substituem ✓/✅ e ✕. Eles são os únicos aqui que às vezes são a
           ÚNICA coisa dentro de um botão, então quem os usa assim é obrigado a pôr um
           `aria-label` — ícone sozinho sem nome é um botão mudo pra quem usa leitor de tela. */
    'ic-alvo':       '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    'ic-certo':      '<path d="m4 12.5 5 5L20 6.5"/>',
    'ic-x':          '<path d="M6 6l12 12M18 6 6 18"/>',
    /* ic-mais entrou na fatia B19 (14/08), e ele é ADITIVO: nenhum desenho existente mudou,
       então nenhuma tela que já usava o sprite muda de aparência. Ele existe porque a Negócios
       escrevia "＋ Agendar" com o caractere U+FF0B (o "mais" de largura inteira), e caractere
       não é ícone: ele muda de desenho por fonte instalada e não aceita a cor da marca. */
    'ic-mais':       '<path d="M12 5v14M5 12h14"/>',
    'ic-lupa':       '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    'ic-envelope':   '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    'ic-caixa':      '<path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5z"/><path d="m3 8.5 9 4.5 9-4.5"/><path d="M12 13v7"/>',
    'ic-raio':       '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    'ic-jornal':     '<path d="M4 5h13v14H4z"/><path d="M17 8h3v11H5"/><path d="M7 9h7M7 12.5h7M7 16h4"/>',

    /* ══ OS CINCO QUE A PROPOSTA PEDIU (13/08, item 8b · fatia 3c) ═══════════════════════════
       Eles nasceram porque a tela de Proposta tinha 🤖 💰 🗑 🚀 🔴 como ícone, e a regra do
       projeto é uma só: o desenho mora AQUI, e não na tela que precisou dele. Vieram do mesmo
       conjunto (Lucide, MIT) e na mesma grade 24×24, traço 1.8 e pontas arredondadas — quem
       aplica traço e tamanho é o `.ic` de cada tela, aqui só mora a FORMA.
       >>> `ic-marcador` MERECE O PORQUÊ. Ele substitui o 🔴 do botão "Pedido Fechado", e alguém
           vai perguntar por que ele não é vermelho: porque NENHUM símbolo daqui tem cor. Todos
           herdam `currentColor` de quem os contém, e é isso que faz o mesmo desenho sair navy no
           título, cinza no rótulo e branco no botão. O vermelho daquele botão já é dele — o
           ícone o acompanha sozinho. Cor chumbada dentro do sprite seria o primeiro símbolo que
           não obedece ao tema do cliente, e o white-label morre por aí. */
    'ic-robo':       '<path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2"/><path d="M9 13v2M15 13v2"/>',
    'ic-dinheiro':   '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    'ic-lixeira':    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/>',
    'ic-foguete':    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91 0z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    'ic-marcador':   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2"/>'
  };

  /* `aria-hidden` no sprite inteiro: quem lê em voz alta pula isto e vai direto ao texto — o
     ícone SEMPRE acompanha uma palavra nas nossas telas, então ele nunca é a única portadora
     do sentido. E `width/height 0` porque um <svg> sem tamanho ainda ocupa uma linha de texto
     no fluxo, e isso apareceria como um respiro fantasma no topo da página. */
  var SPRITE = '<svg id="ic-sprite" aria-hidden="true" focusable="false" width="0" height="0"'
    + ' style="position:absolute" xmlns="http://www.w3.org/2000/svg"><defs>'
    + Object.keys(SIMBOLOS).map(function (id) {
        return '<symbol id="' + id + '" viewBox="0 0 24 24">' + SIMBOLOS[id] + '</symbol>';
      }).join('')
    + '</defs></svg>';

  var API = { SPRITE: SPRITE, ICONES: Object.keys(SIMBOLOS), SIMBOLOS: SIMBOLOS, injeta: injeta };

  function injeta() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById('ic-sprite')) return false;      // idempotente: id repetido é sorte
    var s = document.currentScript;
    if (s && s.parentNode) { s.insertAdjacentHTML('afterend', SPRITE); return true; }
    /* Sem `currentScript` (script adiado, ou injetado por outro código) o melhor lugar possível
       é o começo do body. Não é o caminho normal, e por isso não é o caminho otimizado — é o
       que evita a página ficar SEM ícone nenhum. */
    var alvo = document.body || document.documentElement;
    if (!alvo) return false;
    alvo.insertAdjacentHTML('afterbegin', SPRITE);
    return true;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = API;   // node: só leitura
  if (typeof document !== 'undefined') { raiz.FpmedIcones = API; injeta(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
