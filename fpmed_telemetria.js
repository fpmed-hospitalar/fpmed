/* ═══════════════════════════════════════════════════════════════════════════════════════════
   fpmed_telemetria.js — UM ARQUIVO, E SÓ UM, PARA VER O QUE ACONTECE EM PRODUÇÃO
   Fatia A35 · 20/08/2026 · fonte da configuração: docs/TELEMETRIA.md (leia antes de mexer)

   ══ POR QUE UM ARQUIVO, E NÃO O TRECHO DO PAINEL COLADO EM CADA TELA ════════════════════════
   O painel do PostHog entrega um `<script>` pronto e o caminho óbvio é colá-lo nas sete telas.
   Sete cópias é SETE LUGARES PARA ESQUECER: no dia em que a chave girar, ou em que o
   mascaramento precisar de mais um seletor, seis telas ficam certas e uma fica errada — e a
   errada é a que ninguém abre para conferir. É a denúncia nº 3 de "feito por IA" da
   BASE_ENGENHARIA, e ela custa exatamente quando mais importa.
   >>> ENTÃO A CONFIGURAÇÃO MORA AQUI, UMA VEZ. As telas só chamam.

   ══ COMO CHAMAR — é UMA LINHA, e o B usa a mesma ═════════════════════════════════════════════
   No `<head>`, depois do `cliente.config.js` e ANTES dos scripts da tela:

       <script src="fpmed_telemetria.js"></script>

   E, no código da tela, nos seis momentos que interessam:

       FPMED_TELEMETRIA.evento('busca_executada', { resultados: 12, tem_uf: true });
       FPMED_TELEMETRIA.evento('resultado_zero',  { termo: 'dipirona' });
       FPMED_TELEMETRIA.evento('licitacao_aberta',{ de: 'busca' });
       FPMED_TELEMETRIA.evento('item_comparado_com_cmed', { achou: true });
       FPMED_TELEMETRIA.evento('adicionado_aos_negocios', { de: 'detalhe' });
       FPMED_TELEMETRIA.evento('erro_visto_pelo_usuario', { causa: 'portal fora do ar' });

   >>> CHAMAR NUNCA QUEBRA A TELA. Se o PostHog não carregar (rede, bloqueador, offline), o
       `evento()` devolve `false` e segue. Telemetria que derruba a tela que ela veio observar é
       o pior negócio possível — e é o desfecho normal de quem chama `posthog.capture` direto.

   ══ A LEI DESTE ARQUIVO, e ela vem antes de qualquer métrica ════════════════════════════════
   O Natanael trabalha com dado da empresa dele e de órgão público. Então:
     1. MASCARAMENTO TOTAL POR PADRÃO nos dois gravadores de tela. Libera-se depois o que
        precisar ser visto. O contrário — liberar tudo e esconder depois — é literalmente como
        toda empresa que vazou dado vazou.
     2. EVENTO É SOBRE COMPORTAMENTO, NÃO SOBRE CONTEÚDO. "buscou e não achou" é métrica;
        "buscou dipirona para o cliente X" é vazamento com nome de métrica.
     3. NA DÚVIDA, NÃO VAI — e a dúvida vira linha de relatório para o arquiteto decidir.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FPMED_TELEMETRIA) return;   // duas telas, um só init — ver `jaLigado` abaixo

  /* ── AS DUAS CHAVES ────────────────────────────────────────────────────────────────────────
     A do PostHog é a chave de ESCRITA de evento: ela é feita para viver dentro da página e não
     dá acesso de leitura a painel nenhum (docs/TELEMETRIA.md §1). O Sentry nem chave tem aqui —
     o loader carrega o DSN do lado do servidor deles. Nenhum segredo neste arquivo, e é por isso
     que ele pode ser versionado num repositório que um dia pode virar público. */
  var POSTHOG_CHAVE = 'phc_ovoRYDgQYQL8BwDKL9c2eqhSAsMHmUtFy7WeikLACvxz';
  var POSTHOG_HOST  = 'https://us.i.posthog.com';
  var SENTRY_LOADER = 'https://js-de.sentry-cdn.com/797bc66e72aad46ad75098bf1efcf3db.min.js';

  /* ── OS SEIS EVENTOS, E A LISTA É FECHADA ──────────────────────────────────────────────────
     "NÃO meça o que você não vai usar para decidir nada. Painel cheio de métrica que ninguém lê
     é o mesmo defeito de teste vermelho permanente: ensina todo mundo a ignorar" (TELEMETRIA §4).
     >>> A LISTA SER FECHADA É O QUE FAZ ELA CONTINUAR CURTA. Um `capture()` solto no meio de uma
         tela entra sem ninguém revisar; um nome que precisa estar aqui passa por esta linha, e
         esta linha tem a pergunta de cada evento escrita ao lado. Nome fora da lista é RECUSADO
         e denunciado no console — em vez de virar um evento órfão que ninguém sabe de onde veio. */
  var EVENTOS = {
    busca_executada:        'em que forma de busca a pessoa está — e quantas voltam com algo',
    resultado_zero:         'quantas buscas terminam em NADA, e com quais palavras (sinônimo faltando)',
    licitacao_aberta:       'de onde ela abre o edital: busca, meus negócios, link direto',
    item_comparado_com_cmed:'ela chega a usar o cruzamento com o teto CMED, ou para antes',
    adicionado_aos_negocios:'a conversão que importa — de olhar para trabalhar',
    erro_visto_pelo_usuario:'o que ele VÊ quebrado (a causa, nunca o dado)',
  };

  /* ══ O FILTRO DE CONTEÚDO — a regra 3 virada em código ═══════════════════════════════════════
     A regra "na dúvida não vai" só vale se houver um lugar onde a dúvida é resolvida sempre do
     mesmo jeito. Este é o lugar. Toda propriedade passa por aqui antes de sair da máquina.

     >>> O QUE PASSA: número, booleano, e um punhado de textos curtos que são VOCABULÁRIO DE
         CATÁLOGO (o nome de um produto, a sigla de uma UF).
     >>> O QUE NÃO PASSA, NUNCA: qualquer coisa com cara de documento ou de identidade — CNPJ,
         CPF, e-mail, telefone, sequência longa de dígitos. Não sai o valor mascarado nem o valor
         cortado: sai a etiqueta `(parece documento)`, que conta que HOUVE algo ali sem contar o
         quê. Assim o painel ainda mostra que o evento aconteceu.
     >>> E TEXTO LONGO NÃO PASSA INTEIRO. Objeto de edital, descrição de item e corpo de proposta
         são textos longos; 80 caracteres é curto demais para caber um deles e mais que suficiente
         para um termo de busca. Um limite generoso aqui seria a porta por onde o conteúdo sai. */
  var SO_TEXTO_EM = { termo: 1, causa: 1, de: 1, uf: 1, tela: 1 };   // as únicas chaves de texto
  var CARA_DE_DOCUMENTO = [
    /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/,                 // CPF
    /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/,         // CNPJ
    /[\w.+-]+@[\w-]+\.[\w.]+/,                      // e-mail
    /\d[\d\s().-]{7,}/,                             // telefone / sequência longa de dígitos
  ];

  function limpaTexto(v) {
    var s = String(v).trim();
    if (!s) return null;
    for (var i = 0; i < CARA_DE_DOCUMENTO.length; i++) {
      if (CARA_DE_DOCUMENTO[i].test(s)) return '(parece documento)';
    }
    return s.length > 80 ? s.slice(0, 80) + '…' : s;
  }

  function limpa(props) {
    var out = {};
    if (!props || typeof props !== 'object') return out;
    for (var k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      var v = props[k];
      if (v == null) continue;
      if (typeof v === 'number') { if (isFinite(v)) out[k] = v; continue; }
      if (typeof v === 'boolean') { out[k] = v; continue; }
      /* >>> TEXTO SÓ NAS CHAVES DA LISTA. Uma chave de texto nova entra no painel sem ninguém
             ler o que ela carrega — e é assim que `empresa`, `orgao` ou `objeto` chegariam lá
             sem má intenção nenhuma. Chave fora da lista some, e o console diz que sumiu. */
      if (typeof v === 'string') {
        if (!SO_TEXTO_EM[k]) { aviso('propriedade de texto "' + k + '" descartada (fora da lista curta)'); continue; }
        var t = limpaTexto(v);
        if (t) out[k] = t;
        continue;
      }
      aviso('propriedade "' + k + '" descartada (só número, booleano e os textos da lista)');
    }
    return out;
  }

  function aviso(m) { try { console.warn('[telemetria] ' + m); } catch (e) {} }

  /* ══ O CARREGADOR DO POSTHOG ════════════════════════════════════════════════════════════════
     O trecho oficial do painel é um minificado de uma linha. Aqui ele está escrito por extenso,
     porque um minificado colado é código que ninguém desta casa consegue auditar — e este é o
     código que decide o que sai da máquina do dono.
     >>> A FILA (`_i`) É O CORAÇÃO DELE, e é o que faz `evento()` funcionar antes de o script da
         CDN chegar: as chamadas ficam numa fila e são reproduzidas quando ele carrega. Sem ela,
         todo evento disparado no primeiro segundo da página se perderia — e o primeiro segundo é
         justamente onde mora o carregamento da tela. */
  function carregaPosthog() {
    if (window.posthog && window.posthog.__loaded) return;
    var ph = window.posthog = window.posthog || [];
    if (ph.__SV) return;
    ph._i = [];
    ph.init = function (chave, cfg, nome) {
      function fila(alvo, metodo) {
        var partes = metodo.split('.');
        if (partes.length === 2) { alvo = alvo[partes[0]]; metodo = partes[1]; }
        alvo[metodo] = function () {
          ph.push([metodo].concat(Array.prototype.slice.call(arguments, 0)));
        };
      }
      var alvo = ph;
      if (typeof nome !== 'undefined') { alvo = ph[nome] = []; } else { nome = 'posthog'; }
      alvo.people = alvo.people || [];
      alvo.toString = function (curto) { var s = 'posthog'; if (nome !== 'posthog') s += '.' + nome; if (!curto) s += ' (stub)'; return s; };
      alvo.people.toString = function () { return alvo.toString(1) + '.people (stub)'; };
      var metodos = ('capture identify alias people.set people.set_once set_config register register_once '
        + 'unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled '
        + 'onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment '
        + 'getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId '
        + 'startSessionRecording stopSessionRecording').split(' ');
      for (var i = 0; i < metodos.length; i++) fila(alvo, metodos[i]);
      ph._i.push([chave, cfg, nome]);
      return alvo;
    };
    ph.__SV = 1;

    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = POSTHOG_HOST + '/static/array.js';
    /* Um bloqueador de anúncio derruba este `src`, e isso é comum e legítimo. O `onerror` existe
       para que o desfecho seja uma linha no console em vez de uma promessa pendurada — e para
       que `pronto()` responda a verdade a quem perguntar. */
    s.onerror = function () { aviso('o PostHog não carregou (rede ou bloqueador) — a tela segue igual'); };
    var primeiro = document.getElementsByTagName('script')[0];
    if (primeiro && primeiro.parentNode) primeiro.parentNode.insertBefore(s, primeiro);
    else (document.head || document.documentElement).appendChild(s);

    window.posthog.init(POSTHOG_CHAVE, {
      api_host: POSTHOG_HOST,
      defaults: '2026-05-30',
      /* não cria perfil para visitante anônimo — TELEMETRIA §2.4 */
      person_profiles: 'identified_only',

      /* ══ O MASCARAMENTO, E ELE É TOTAL ═══════════════════════════════════════════════════════
         `maskAllInputs` já vem `true` de fábrica; `maskTextSelectorAll: '*'` NÃO vem, e é ele
         que faz a diferença entre esconder o que foi DIGITADO e esconder o que foi MOSTRADO.
         Nesta casa, o que está na tela é CNPJ de órgão, valor de proposta e descrição de item —
         ou seja, a parte perigosa é justamente a que o padrão deixa passar.
         >>> `blockClass`/`ignoreClass`: as duas gavetas de escape para o dia em que alguém
             precisar esconder um bloco inteiro sem discutir seletor. Nomeadas antes de precisar,
             porque na hora do aperto ninguém inventa nome bom. */
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '*',
        blockClass: 'tel-bloqueia',
        ignoreClass: 'tel-ignora',
      },
      /* O autocapture manda TEXTO DE ELEMENTO junto do clique — o rótulo do botão, e com ele o
         que estiver escrito dentro do cartão. É a porta mais silenciosa deste arquivo para
         conteúdo sair, e por isso ela fica fechada: os seis eventos daqui são explícitos e
         chamados à mão, que é o oposto de capturar tudo e filtrar depois. */
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      /* respeita "Do Not Track" do navegador — quem pediu para não ser seguido, não é */
      respect_dnt: true,
    });
  }

  /* ══ O CARREGADOR DO SENTRY ══════════════════════════════════════════════════════════════════
     O loader script é UMA LINHA sem DSN, sem npm e sem build (TELEMETRIA §3) — e o `window
     .sentryOnLoad` é o gancho oficial dele: o loader chama esta função quando o SDK de verdade
     terminou de descer, e é o ÚNICO lugar em que dá para configurar antes do primeiro evento.
     >>> `tracesSampleRate: 0.1` E ISSO ESTÁ NA CAIXA COM TINTA: o padrão do loader é 1, que
         captura TODAS as transações e queima a cota grátis em dias. Um décimo é o número que o
         arquiteto mandou e é o que está escrito aqui.
     >>> E O REPLAY DO SENTRY MASCARA IGUAL. Ele tem gravador de tela próprio, com padrões
         próprios, e a regra da §2 vale para os dois "sem exceção". `maskAllText` e
         `blockAllMedia` fecham texto e imagem; sem eles, esconder no PostHog e deixar aberto
         aqui seria mascarar uma porta e deixar a outra encostada. */
  function carregaSentry() {
    if (window.__fpmedSentry) return;
    window.__fpmedSentry = true;
    window.sentryOnLoad = function () {
      try {
        window.Sentry.init({
          tracesSampleRate: 0.1,
          replaysSessionSampleRate: 0.0,   // sessão normal não é gravada; só a que deu erro
          replaysOnErrorSampleRate: 1.0,
          /* o `?token=` de um link, o `#senha` de um hash: a URL é o lugar mais fácil de vazar
             sem querer, e o Sentry a manda em todo evento. Cortada aqui, na saída. */
          sendDefaultPii: false,
        });
        if (window.Sentry.replayIntegration) {
          window.Sentry.addIntegration(window.Sentry.replayIntegration({
            maskAllText: true, maskAllInputs: true, blockAllMedia: true,
          }));
        }
      } catch (e) { aviso('o Sentry carregou mas não aceitou a configuração: ' + e.message); }
    };
    var s = document.createElement('script');
    s.src = SENTRY_LOADER;
    s.crossOrigin = 'anonymous';
    s.onerror = function () { aviso('o Sentry não carregou — a tela segue igual'); };
    (document.head || document.documentElement).appendChild(s);
  }

  /* ══ O PORTÃO — quando a telemetria NÃO liga ═════════════════════════════════════════════════
     Abrir a tela por `file://` é o que o desenvolvedor faz o dia inteiro, e cada abertura dessas
     mandaria um pageview para o painel. Painel poluído por sessão de desenvolvimento é painel em
     que ninguém confia — e o `resultado_zero` é a métrica desta casa que mais depende de o
     denominador ser real.
     >>> `?semtelemetria=1` desliga na mão, e existe para o dia da demonstração ao cliente. */
  function podeLigar() {
    try {
      if (location.protocol === 'file:') return false;
      if (/(^|[?&])semtelemetria=1/.test(location.search)) return false;
      if (window.localStorage && localStorage.getItem('fpmed_sem_telemetria') === '1') return false;
    } catch (e) { /* sem localStorage (aba anônima estrita): liga, que é o padrão */ }
    return true;
  }

  var jaLigado = false;

  var API = {
    /* Chamado sozinho no fim deste arquivo. Fica público porque uma tela pode querer ligar depois
       de um consentimento — e porque um teste precisa poder chamar sem carregar a página inteira. */
    ligar: function () {
      if (jaLigado) return true;
      if (!podeLigar()) { aviso('desligada nesta página (file://, ?semtelemetria=1 ou preferência salva)'); return false; }
      jaLigado = true;
      try { carregaPosthog(); } catch (e) { aviso('PostHog não iniciou: ' + e.message); }
      try { carregaSentry(); }  catch (e) { aviso('Sentry não iniciou: ' + e.message); }
      return true;
    },

    /* ── O ÚNICO JEITO DE MANDAR EVENTO ─────────────────────────────────────────────────────
       Devolve `true` se saiu, `false` se não — e NUNCA lança. Quem chama é uma tela no meio de
       uma busca; um `throw` aqui derrubaria a busca por causa de uma métrica. */
    evento: function (nome, props) {
      try {
        if (!EVENTOS[nome]) { aviso('evento "' + nome + '" não está na lista dos seis — não foi enviado'); return false; }
        if (!jaLigado) return false;
        var ph = window.posthog;
        if (!ph || typeof ph.capture !== 'function') return false;
        ph.capture(nome, limpa(props));
        return true;
      } catch (e) { aviso('não consegui enviar "' + nome + '": ' + e.message); return false; }
    },

    /* `pronto()` responde se o PostHog de verdade (não o stub da fila) está de pé. É o que a
       prova de navegador pergunta, e é o que separa "escrevi o script" de "o evento saiu". */
    pronto: function () { return !!(window.posthog && window.posthog.__loaded); },
    ligada: function () { return jaLigado; },
    eventos: function () { return Object.keys(EVENTOS); },
    /* exposto para o teste: é a função que decide o que sai da máquina, e ela merece ser
       exercitada com CPF, CNPJ e texto de 500 caracteres sem precisar de um navegador. */
    _limpa: limpa,
  };

  window.FPMED_TELEMETRIA = API;
  API.ligar();
})();
