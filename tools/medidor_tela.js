/* ══════════════════════════════════════════════════════════════════════════════════════════════
   tools/medidor_tela.js — AS MEDIDAS QUE SÓ A TELA PINTADA RESPONDE.

   POR QUE ELE EXISTE (fatia B21, 15/08/2026):
   Cinco rodadas seguidas eu escrevi no relatório "isto é medição do ARQUIVO; quem responde é a
   tela, e eu não tenho navegador". O navegador chegou. Este arquivo é para a medição não morrer
   dentro de uma janela de chat: **o que foi feito duas vezes vira script** (lei da autonomia,
   item 2). Ele é lido DENTRO do navegador, servido pelo `tools/servidor_estatico.js`:

       await fetch('/tools/medidor_tela.js').then(r=>r.text()).then(eval);
       __medidor.vazamento();  __medidor.alvos();  __medidor.estados();

   >>> REGRA DA BASE, PARTE 4, QUE ESTE ARQUIVO OBEDECE: em emulação de celular usa-se
       `document.documentElement.clientWidth`, NUNCA `innerWidth`. E isto deixou de ser teoria na
       primeira medição: a 405px de janela, `clientWidth` deu **390** e `innerWidth` deu **406** —
       16px de diferença, que é a barra de rolagem do navegador de mesa. Quem mede com o
       `innerWidth` mede a janela; quem mede com o `clientWidth` mede a TELA, que é o que o layout
       enxerga.
   >>> NÃO BASTA O NÚMERO: quando vaza, este medidor NOMEIA o elemento culpado (seletor, largura,
       quanto passou). "A tela vaza 40px" não conserta nada; "o `.kb` vaza 40px" conserta.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  function seletor(el) {
    if (!el || el === document.documentElement) return 'html';
    if (el === document.body) return 'body';
    var s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    var c = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean);
    if (c.length) s += '.' + c.slice(0, 3).join('.');
    return s;
  }
  function visivel(el) {
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // ── 1. VAZAMENTO HORIZONTAL ────────────────────────────────────────────────────────────────
  // A conta é `scrollWidth > clientWidth` no <html>. Quem vaza é quem tem borda direita além do
  // clientWidth E não está preso a um pai com `overflow` próprio (esse é rolagem de componente,
  // que é desenho, não defeito). Um carrossel que rola de propósito não é vazamento da página.
  function vazamento() {
    var de = document.documentElement;
    var largura = de.clientWidth, rolagem = de.scrollWidth;
    var culpados = [];
    if (rolagem > largura) {
      var todos = document.querySelectorAll('body *');
      for (var i = 0; i < todos.length; i++) {
        var el = todos[i];
        if (!visivel(el)) continue;
        var r = el.getBoundingClientRect();
        if (r.right <= largura + 0.5 && r.left >= -0.5) continue;
        // pai com rolagem própria = componente que rola de propósito
        var rolante = false;
        for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          var ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') { rolante = true; break; }
        }
        if (rolante) continue;
        culpados.push({ el: seletor(el), largura: +r.width.toFixed(2),
                        passouDireita: +(r.right - largura).toFixed(2),
                        passouEsquerda: +(0 - r.left).toFixed(2),
                        pai: seletor(el.parentElement) });
      }
      culpados.sort(function (a, b) { return b.passouDireita - a.passouDireita; });
    }
    return { clientWidth: largura, scrollWidth: rolagem, vazou: +(rolagem - largura).toFixed(2),
             culpados: culpados.slice(0, 12), totalCulpados: culpados.length };
  }

  // ── 2. ALVO DE TOQUE ───────────────────────────────────────────────────────────────────────
  // `cursor:pointer` É HERDADO: uma barra com o cursor de mão dá 20 "alvos" onde o dedo acha 1.
  // Por isso o alvo aqui é o elemento INTERATIVO (a, button, input, select, [onclick], [role]),
  // e o retângulo é o `getBoundingClientRect` de verdade, não a soma de padding do CSS.
  var MIN = 44; // px — o piso de dedo que a casa adotou
  function alvos(min) {
    min = min || MIN;
    var sel = 'a[href],button,input,select,textarea,[onclick],[role="button"],[role="tab"],[tabindex]:not([tabindex="-1"])';
    var lista = [], pequenos = [];
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!visivel(el)) continue;
      if (el.closest('#gm-auth-overlay,#gm-auth-bar')) continue;   // portão de login: não é tela nossa
      var r = el.getBoundingClientRect();
      var o = { el: seletor(el), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
                texto: (el.innerText || el.value || el.title || '').trim().slice(0, 28) };
      lista.push(o);
      if (r.width < min || r.height < min) pequenos.push(o);
    }
    return { total: lista.length, piso: min, abaixoDoPiso: pequenos.length, pequenos: pequenos.slice(0, 40) };
  }

  // ── 3. OS 4 ESTADOS ────────────────────────────────────────────────────────────────────────
  // Vazio, carregando COM NÚMERO, erro COM CAUSA E SAÍDA, cheio. Aqui só se mede o que está
  // DESENHADO agora: o medidor devolve o texto visível de quem se declara estado, e quem lê o
  // relatório julga. Medidor que decide sozinho "isto é um bom estado vazio" mente com facilidade.
  function estados() {
    var marcas = '[data-estado],.estado,.vazio,.carregando,.erro,.skeleton,.esqueleto,.empty,.loading,' +
                 '.fp-skeleton,.nf-vazio,[aria-busy="true"]';
    var achados = [];
    var els = document.querySelectorAll(marcas);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      achados.push({ el: seletor(el), visivel: visivel(el),
                     texto: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120) });
    }
    return { encontrados: achados.length, itens: achados.slice(0, 30) };
  }

  window.__medidor = { vazamento: vazamento, alvos: alvos, estados: estados, seletor: seletor };
  return 'medidor pronto: __medidor.vazamento() / .alvos() / .estados()';
})();
