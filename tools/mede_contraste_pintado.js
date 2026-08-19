/* ════════════════════════════════════════════════════════════════════════════════════════════
   tools/mede_contraste_pintado.js — O CONTRASTE QUE SÓ A TELA PINTADA RESPONDE (fatia A32)

   ══ A PENDÊNCIA QUE ISTO FECHA ══════════════════════════════════════════════════════════════
   A `tools/regua_visual.js` mede o contraste do USO: quando uma regra declara `color` e
   `background` JUNTAS, o par está afirmado pelo autor e dá para calcular no arquivo. Ela sabe o
   que NÃO alcança, e sai declarado no cabeçalho dela desde a A28: *"par montado por herança
   (texto numa regra, fundo no pai) e par montado em tempo de execução por JS. Só a tela pintada
   responde esses — e eu não logo."*
   São SETE pares assim na Encontrar, e eles ficaram cinco rodadas como "não sei declarado". Este
   arquivo os transforma em aprovado ou reprovado COM NÚMERO.

   ══ POR QUE UM ARQUIVO NOVO, E NÃO UMA FUNÇÃO NO medidor_tela.js ════════════════════════════
   O `tools/medidor_tela.js` é do trabalhador B (fatia B21) e já resolve vazamento, alvo de toque
   e os 4 estados. Este condutor REUSA os três em vez de reescrevê-los — mas escrever dentro do
   arquivo dele quebraria a lei de território da casa, e ele está com a janela aberta agora. Cada
   um no seu; os dois são carregados na mesma página.

   ══ AS TRÊS COISAS QUE O ARQUIVO NÃO CONSEGUE E A TELA CONSEGUE ═════════════════════════════
   1. O FUNDO HERDADO. `.lic .titulo{color:var(--cinza-800)}` não diz fundo nenhum. O fundo é o
      do pai, ou do pai do pai. Aqui se sobe a árvore até achar tinta de verdade.
   2. O ALFA COMPOSTO. Um fundo `rgba(...,.55)` não é uma cor: é um véu SOBRE outra. A conta
      certa compõe o véu sobre o que está atrás — senão o número sai errado nos dois sentidos.
   3. O TAMANHO REAL DA LETRA. A régua da WCAG muda com o tamanho (3:1 acima de 24px, ou 18,5px
      em negrito). No arquivo o tamanho pode vir de um token, de herança ou de `em`; na tela ele
      é um número em pixel, resolvido.

   >>> E O QUE ELE NÃO INVENTA: elemento que não está pintado (display:none, sem tamanho, ou que
       só existe depois de um clique) NÃO vira nota. Ele sai na lista `naoPintados`, com o motivo.
       Contraste que não se conseguiu medir contado como aprovado é a mentira por omissão que a
       BASE proíbe — e é a mesma regra que a régua estática já segue.

   Carregado dentro da página (o condutor faz isso):
       __contraste.mede(['.lic .titulo', '.dens button', …])
       __contraste.varreTudo()      -> todo elemento com texto visível
   ════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── A cor como número, e o alfa junto ─────────────────────────────────────────────────────
  function rgba(str) {
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.%]+))?\s*\)/i.exec(String(str || ''));
    if (!m) return null;
    var a = m[4] == null ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return { r: +m[1], g: +m[2], b: +m[3], a: isFinite(a) ? a : 1 };
  }
  // Véu sobre fundo: a conta de composição alfa, canal a canal.
  function compoe(frente, atras) {
    var a = frente.a;
    return { r: frente.r * a + atras.r * (1 - a), g: frente.g * a + atras.g * (1 - a),
             b: frente.b * a + atras.b * (1 - a), a: 1 };
  }
  // A MESMA fórmula da tools/regua_visual.js e da tests/testa_tema.js. Três cópias do mesmo
  // número seriam três chances de discordar; esta é a terceira e ela é idêntica de propósito —
  // o dia em que uma divergir, a que estiver errada estará verde.
  function lum(c) {
    var v = [c.r, c.g, c.b].map(function (x) {
      x = x / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function razao(a, b) {
    var x = lum(a), y = lum(b);
    var alto = Math.max(x, y), baixo = Math.min(x, y);
    return (alto + 0.05) / (baixo + 0.05);
  }

  /* ── O FUNDO EFETIVO — subindo a árvore até achar tinta ─────────────────────────────────────
     Um fundo pode ser: opaco (acabou), translúcido (compõe e continua subindo), ou totalmente
     transparente (ignora e sobe). O branco do documento é o último recurso, e ele sai DECLARADO
     na resposta (`chegouNaRaiz`) — porque "assumi branco" e "medi branco" são coisas diferentes,
     e a segunda é a única que vale como prova.
     >>> IMAGEM E GRADIENTE PARAM A CONTA. `background-image` não é uma cor, e fingir que o fundo
         é o `background-color` por baixo dele daria um número com cara de medido sobre um pixel
         que ninguém vê. Vai para `naoPintados` com o motivo. */
  function fundoEfetivo(el) {
    var camadas = [], n = el, raiz = false, img = null;
    while (n && n.nodeType === 1) {
      var cs = getComputedStyle(n);
      var bi = cs.backgroundImage;
      if (bi && bi !== 'none') { img = { seletor: sel(n), valor: bi.slice(0, 60) }; break; }
      var c = rgba(cs.backgroundColor);
      if (c && c.a > 0) {
        camadas.push(c);
        if (c.a >= 1) break;              // opaco: o que está atrás não aparece
      }
      if (n === document.documentElement) { raiz = true; break; }
      n = n.parentElement || (n === document.body ? document.documentElement : null);
      if (!n) { raiz = true; break; }
    }
    if (img) return { erro: 'fundo é imagem/gradiente (' + img.valor + ') em ' + img.seletor };
    /* >>> DEFEITO DESTE ARQUIVO, ACHADO NA PRIMEIRA MEDIÇÃO: o "assumi branco" era calculado
           DEPOIS do `pop()`, então toda camada opaca zerava a lista e o retrato dizia "FUNDO
           ASSUMIDO BRANCO" em cima de um branco MEDIDO no `<input>`. Assumido e medido são
           fatos diferentes, e um retrato que os confunde faz o leitor desconfiar do número
           certo — que é o custo mais caro de um instrumento. A pergunta é feita ANTES. */
    var achouTinta = camadas.length > 0;
    var base = achouTinta && camadas[camadas.length - 1].a >= 1
      ? camadas.pop() : { r: 255, g: 255, b: 255, a: 1 };
    while (camadas.length) base = compoe(camadas.pop(), base);
    return { cor: base, chegouNaRaiz: raiz, assumiuBranco: !achouTinta };
  }

  function sel(el) {
    if (!el || el === document.documentElement) return 'html';
    if (el === document.body) return 'body';
    var s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    var c = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean);
    if (c.length) s += '.' + c.slice(0, 3).join('.');
    return s;
  }

  function temTextoProprio(el) {
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) return true;
    }
    return false;
  }

  function pintado(el) {
    var cs = getComputedStyle(el);
    if (cs.display === 'none') return 'display:none';
    if (cs.visibility === 'hidden') return 'visibility:hidden';
    if (parseFloat(cs.opacity) === 0) return 'opacity:0';
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return 'sem area (0x0)';
    return null;
  }

  /* ── A RÉGUA DA WCAG, e ela é TRÊS e não uma ────────────────────────────────────────────────
     4,5:1 é o padrão. 3:1 vale para texto grande (>=24px, ou >=18,66px em negrito — WCAG 1.4.3)
     e para elemento não-textual (1.4.11). E componente DESLIGADO é isento (1.4.3, exceção
     literal): botão desligado precisa PARECER desligado, e "consertar" isso apagaria a única
     pista de que ele não funciona. As três decisões são as MESMAS da régua estática, de
     propósito — duas réguas com limiares diferentes sobre o mesmo par é o jeito clássico de uma
     ficar verde estando errada. */
  function minimoDe(el, cs) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true'
        || el.closest('[disabled],[aria-disabled="true"],:disabled')) return { min: 0, isento: 'componente desligado (WCAG 1.4.3 isenta)' };
    var px = parseFloat(cs.fontSize) || 16;
    var peso = parseInt(cs.fontWeight, 10) || 400;
    if (px >= 24 || (px >= 18.66 && peso >= 700)) return { min: 3, regra: 'texto grande (>=24px ou >=18,66px negrito)' };
    return { min: 4.5, regra: 'texto normal' };
  }

  function medeUm(el, rotulo) {
    var motivo = pintado(el);
    if (motivo) return { naoPintado: true, seletor: rotulo || sel(el), motivo: motivo };
    var cs = getComputedStyle(el);
    var fg = rgba(cs.color);
    if (!fg) return { naoPintado: true, seletor: rotulo || sel(el), motivo: 'cor de texto ilegivel: ' + cs.color };
    var f = fundoEfetivo(el);
    if (f.erro) return { naoPintado: true, seletor: rotulo || sel(el), motivo: f.erro };
    // texto com alfa próprio também é véu: compõe sobre o fundo antes de medir
    var tinta = fg.a < 1 ? compoe(fg, f.cor) : fg;
    var m = minimoDe(el, cs);
    var r = razao(tinta, f.cor);
    return {
      seletor: rotulo || sel(el),
      texto: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      cor: 'rgb(' + [tinta.r, tinta.g, tinta.b].map(Math.round).join(',') + ')',
      fundo: 'rgb(' + [f.cor.r, f.cor.g, f.cor.b].map(Math.round).join(',') + ')',
      fundoAssumido: !!f.assumiuBranco,
      tamanho: parseFloat(cs.fontSize), peso: cs.fontWeight,
      razao: Math.round(r * 100) / 100,
      minimo: m.min, regra: m.isento || m.regra,
      passa: m.min === 0 ? null : r >= m.min,
    };
  }

  /* Mede uma lista de SELETORES CSS — os sete pares pendentes entram por aqui. Cada seletor pode
     casar com vários elementos; mede-se o PRIMEIRO PINTADO, e diz-se quantos casaram. Medir só o
     primeiro e calar sobre os outros esconderia o caso em que a mesma classe aparece sobre dois
     fundos diferentes. */
  function mede(seletores) {
    return seletores.map(function (s) {
      var todos;
      try { todos = [].slice.call(document.querySelectorAll(s)); }
      catch (e) { return { seletor: s, naoPintado: true, motivo: 'seletor invalido: ' + e.message }; }
      if (!todos.length) return { seletor: s, naoPintado: true, motivo: 'nenhum elemento na tela (0 casamentos)' };
      var pintados = todos.filter(function (el) { return !pintado(el); });
      if (!pintados.length) {
        var r = medeUm(todos[0], s);
        r.casamentos = todos.length; r.pintados = 0;
        return r;
      }
      // quantos FUNDOS diferentes esta classe encontra? é o que separa "medi" de "amostrei".
      var fundos = {};
      pintados.forEach(function (el) {
        var f = fundoEfetivo(el);
        if (!f.erro) fundos['rgb(' + [f.cor.r, f.cor.g, f.cor.b].map(Math.round).join(',') + ')'] = 1;
      });
      var out = medeUm(pintados[0], s);
      out.casamentos = todos.length;
      out.pintados = pintados.length;
      out.fundosDistintos = Object.keys(fundos);
      return out;
    });
  }

  // Varre TUDO que tem texto próprio e está pintado. É a rede larga: os sete pares são a
  // pendência nomeada, mas a tela pode ter reprovações que ninguém listou.
  function varreTudo(teto) {
    var out = [], todos = document.querySelectorAll('body *');
    for (var i = 0; i < todos.length; i++) {
      var el = todos[i];
      if (!temTextoProprio(el)) continue;
      if (pintado(el)) continue;
      var r = medeUm(el);
      if (r.naoPintado) continue;
      out.push(r);
      if (out.length >= (teto || 4000)) break;
    }
    var reprovados = out.filter(function (x) { return x.passa === false; });
    // agrupa por seletor+razão: 300 células de tabela iguais são UM defeito, não trezentos.
    var chaves = {}, unicos = [];
    reprovados.forEach(function (x) {
      var k = x.seletor + '|' + x.razao + '|' + x.cor + '|' + x.fundo;
      if (chaves[k]) { chaves[k].vezes++; return; }
      chaves[k] = x; x.vezes = 1; unicos.push(x);
    });
    return { medidos: out.length, reprovados: reprovados.length,
             isentos: out.filter(function (x) { return x.passa === null; }).length,
             unicos: unicos.sort(function (a, b) { return a.razao - b.razao; }).slice(0, 30) };
  }

  window.__contraste = { mede: mede, varreTudo: varreTudo, medeUm: medeUm,
                         fundoEfetivo: fundoEfetivo, razao: razao, rgba: rgba, compoe: compoe, lum: lum };
  return 'contraste pronto: __contraste.mede([sel]) / .varreTudo()';
})();
