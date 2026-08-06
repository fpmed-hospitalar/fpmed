/* LIMEDTEC - a cola do lado da pagina: registra o service worker, oferece a instalacao e avisa
 * quando ha versao nova. UM arquivo, para que cada tela precise de uma unica linha - e para que o
 * molde do produto (LIMEDTEC) seja copiavel pro proximo cliente sem garimpar codigo espalhado.
 *
 * NAO TEM NADA DE CLIENTE AQUI DENTRO: nem cor de marca, nem nome de empresa, nem URL de banco.
 * As cores saem das variaveis CSS da propria pagina, com queda pro tema escuro. Isso e o que
 * permite este arquivo ir pro cliente 003 sem edicao. (Mesma disciplina das duas fatias do motor.)
 *
 * O aviso de versao nova NAO recarrega sozinho. Recarregar no meio de uma cotacao de 40 linhas
 * perde o trabalho de quem esta digitando. Quem decide a hora e o vendedor.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var css = function (nome, queda) {
    try { var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
      return v || queda; } catch (e) { return queda; }
  };
  // As quedas sao NEUTRAS de proposito. Elas ja foram as cores do cliente de origem - o que
  // significa que, num cliente que ainda nao definiu o tema, o botao de instalar apareceria com a
  // marca de OUTRA empresa. Marca vazando por valor-padrao e o tipo de defeito que ninguem
  // procura, porque no cliente de origem fica perfeito. Cinza nao e a marca de ninguem.
  var CIANO = css('--ciano', '#9aa4b2');
  var PANEL = css('--panel', '#1c1f24');
  var TXT = css('--txt', '#eceff3');
  var BORDA = css('--borda', 'rgba(255,255,255,.18)');

  function faixa(texto, rotulo, aoClicar) {
    var d = document.createElement('div');
    d.setAttribute('role', 'status');
    d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:2147483000;'
      + 'display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;'
      + 'background:' + PANEL + ';color:' + TXT + ';border:1px solid ' + BORDA + ';'
      + 'font:500 13px Inter,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.45);max-width:92vw';
    var s = document.createElement('span'); s.textContent = texto; d.appendChild(s);
    var b = document.createElement('button'); b.type = 'button'; b.textContent = rotulo;
    b.style.cssText = 'background:' + CIANO + ';border:0;border-radius:20px;padding:6px 14px;'
      + 'font:600 12px Inter,system-ui,sans-serif;color:#06121a;cursor:pointer;white-space:nowrap';
    b.addEventListener('click', function () { aoClicar(d); });
    d.appendChild(b);
    var x = document.createElement('button'); x.type = 'button'; x.textContent = '×';
    x.setAttribute('aria-label', 'fechar');
    x.style.cssText = 'background:none;border:0;color:' + TXT + ';opacity:.55;font-size:18px;'
      + 'line-height:1;cursor:pointer;padding:0 2px';
    x.addEventListener('click', function () { d.remove(); });
    d.appendChild(x);
    document.body.appendChild(d);
    return d;
  }

  // ── 1. INSTALAR ────────────────────────────────────────────────────────────────────────────
  // O beforeinstallprompt so dispara em navegador que suporta E quando o app ainda nao esta
  // instalado. Guardar o evento e obrigatorio: ele so pode ser usado uma vez, e a partir de um
  // gesto do usuario - por isso o prompt() fica dentro do clique, nunca solto.
  var guardado = null;
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    guardado = ev;
    var alvo = document.querySelector('[data-limedtec-instalar]');
    var b;
    if (alvo) {
      b = document.createElement('button'); b.type = 'button'; b.textContent = 'Instalar aplicativo';
      b.style.cssText = 'background:none;border:1px solid ' + BORDA + ';color:' + CIANO + ';'
        + 'border-radius:20px;padding:5px 14px;font:500 12px Inter,system-ui,sans-serif;cursor:pointer';
      alvo.appendChild(b);
    } else {
      b = document.createElement('button'); b.type = 'button'; b.textContent = 'Instalar aplicativo';
      // sobe se a tarja de licenca estiver no rodape (ela publica a propria altura)
      b.style.cssText = 'position:fixed;right:16px;bottom:calc(16px + var(--limedtec-rodape, 0px));'
        + 'z-index:2147483000;background:' + PANEL
        + ';color:' + CIANO + ';border:1px solid ' + BORDA + ';border-radius:20px;padding:8px 16px;'
        + 'font:600 12px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4)';
      document.body.appendChild(b);
    }
    b.addEventListener('click', function () {
      if (!guardado) return;
      guardado.prompt();
      guardado.userChoice.then(function () { guardado = null; b.remove(); });
    });
  });
  window.addEventListener('appinstalled', function () { guardado = null; });

  // ── 2. SERVICE WORKER ──────────────────────────────────────────────────────────────────────
  if (!('serviceWorker' in navigator)) return;
  // file:// nao tem service worker, e tentar registrar so polui o console de quem abre o HTML
  // direto do disco pra testar.
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      function vigia(sw) {
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          // "installed" COM controller ja existindo = e atualizacao, nao primeira instalacao.
          // Sem essa condicao o aviso apareceria na primeira visita de todo mundo.
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            faixa('Nova versao disponivel.', 'Recarregar', function () {
              sw.postMessage('LIMEDTEC_ATUALIZAR');
            });
          }
        });
      }
      if (reg.waiting && navigator.serviceWorker.controller) {
        faixa('Nova versao disponivel.', 'Recarregar', function () {
          reg.waiting.postMessage('LIMEDTEC_ATUALIZAR');
        });
      }
      vigia(reg.installing);
      reg.addEventListener('updatefound', function () { vigia(reg.installing); });
    }).catch(function () { /* sem SW o app funciona igual, so nao abre offline */ });

    var recarregando = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (recarregando) return;              // sem esta trava o controllerchange faz laco de reload
      recarregando = true;
      location.reload();
    });
  });

  // ── VACINA DE CACHE: a aba velha nao pode GRAVAR calada ─────────────────────────────────
  // O aviso "Nova versao disponivel" e passivo de proposito (recarregar no meio de uma cotacao
  // de 40 linhas perde o trabalho de quem digita). So que passivo tem um custo: a aba fica
  // aberta, o usuario ignora a faixa, e horas depois clica em GRAVAR -- rodando codigo VELHO
  // contra o banco ATUAL. Ja aconteceu em instalacao real, com versionamento de `?v=` no <script>.
  //
  // O caso caro nao e a tela feia: e a escrita. Se o codigo velho tem um defeito que ja foi
  // corrigido -- e hoje mesmo saiu daqui uma funcao que gravava preco de caixa como unitario --
  // a aba velha reintroduz o defeito NO DADO, e ninguem liga o problema ao cache.
  //
  // Isto NAO bloqueia: pergunta. Bloquear seria pior que o defeito em dia de PNCP fora e
  // relatorio pra importar. Quem decide continua sendo quem esta na frente da tela.
  var _regSw = null;
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
    navigator.serviceWorker.getRegistration().then(function (r) { _regSw = r || null; }).catch(function () {});
  }
  function abaDesatualizada() {
    try { return !!(_regSw && _regSw.waiting && navigator.serviceWorker.controller); }
    catch (e) { return false; }
  }
  // `acao` entra na pergunta pra ela ser especifica ("atualizar o estoque"), nao um alerta
  // generico que se aprende a clicar em OK sem ler.
  function confirmarSeAbaVelha(acao) {
    if (!abaDesatualizada()) return true;
    return window.confirm(
      'Esta aba esta rodando uma versao ANTIGA do sistema — ja existe uma nova instalada.\n\n'
      + 'Continuar ' + (acao || 'esta gravacao') + ' agora usa o codigo velho contra o banco atual, '
      + 'e pode gravar dado errado sem dar erro.\n\n'
      + 'Cancelar = recarregar a pagina primeiro (recomendado)\n'
      + 'OK = gravar assim mesmo');
  }
  window.LIMEDTEC_PWA = window.LIMEDTEC_PWA || {};
  window.LIMEDTEC_PWA.abaDesatualizada = abaDesatualizada;
  window.LIMEDTEC_PWA.confirmarSeAbaVelha = confirmarSeAbaVelha;
})();
