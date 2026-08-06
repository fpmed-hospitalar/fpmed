/* LIMEDTEC — SESSAO: quem esta logado, qual o papel dele, e o que a tela pode ler.
 * Molde puro: nao conhece nenhum cliente, nenhuma pessoa e nenhum banco (tudo vem do config).
 *
 * ══ POR QUE ESTE ARQUIVO EXISTE ═══════════════════════════════════════════════════════════════
 * A RLS ja esta ligada no banco e as policies de `cotacoes` sao RESTRICTIVE: quem nao pode ver
 * custo nao le NADA da tabela — nem o nome do produto. Ele le a VIEW `cotacoes_vendedor`.
 * Enquanto a tela continuar pedindo `cotacoes` direto, no minuto em que alguem virar vendedor essa
 * pessoa recebe ZERO LINHA: banco vazio, busca sem resultado, sistema inutil. Foi exatamente o que
 * aconteceu no teste de 05/08 e obrigou a reverter os papeis.
 *
 * >>> A TROCA DE TABELA MORA NO PATCH DO fetch, NAO EM CADA CHAMADA. Sao 3 lugares so na tela de
 *     cotacao, mais os de outras telas, mais os que ainda nao existem. Uma regra espalhada por
 *     chamada e uma regra que a proxima tela vai esquecer — e o modo de falha do esquecimento aqui
 *     nao e um erro na cara: e um vendedor com a busca vazia achando que o produto acabou.
 *     No patch, tela nova nasce obedecendo.
 *
 * >>> ISTO NAO E A SEGURANCA. Quem impede o vendedor de ler custo e a RLS do Postgres. Este
 *     arquivo existe pra que o sistema DELE FUNCIONE (leia a view certa) e pra que a tela nao
 *     mostre campo vazio e botao que daria erro. Se um dia os dois discordarem, quem manda e a RLS.
 *
 * >>> SEM PAPEL = NEGADO, com mensagem clara. Nunca "acesso total por omissao" — mesmo principio
 *     do banco() sem valor-padrao no limedtec-config.js.
 */
(function (raiz) {
  'use strict';

  var doc = raiz.document;
  var SB = raiz.LIMEDTEC.urlBanco();
  var ANON = raiz.LIMEDTEC.chaveBanco();

  // O fetch DE BAIXO: o que ja existe quando este arquivo carrega. Se o gm-auth ja tiver aplicado
  // o patch dele, este e o patch do gm-auth (com o token do usuario) — que e o que queremos pra
  // ler o proprio perfil. Guardar a referencia aqui tambem e o que impede o loop: a leitura do
  // perfil e uma chamada /rest/v1/ e passaria pelo patch de baixo pra cima, esperando ela mesma.
  var fetchBase = raiz.fetch.bind(raiz);

  // ── ESTADO ──────────────────────────────────────────────────────────────────────────────────
  //   'esperando-login'  ainda nao ha sessao (o gm-auth cuida disso; nao e problema nosso)
  //   'ok'               perfil lido, papel conhecido
  //   'negado'           logado mas sem papel / desativado  -> bloqueia e explica
  //   'indefinido'       nao consegui confirmar o perfil    -> bloqueia e oferece tentar de novo
  var estado = 'esperando-login';
  var perfil = null;      // { papel, ativo, permissoes }
  var motivo = '';
  var espera = null;      // single-flight da carga do perfil

  function papeis() {
    return raiz.LimedtecPapeis || null;   // limedtec-papeis.js e opcional: sem ele, so o papel cru
  }

  // ── LER O PROPRIO PERFIL ────────────────────────────────────────────────────────────────────
  // FILTRA POR id=eq.<uid> DE PROPOSITO. A policy `perfis_gestor_le` deixa o gestor ler TODOS os
  // perfis; sem o filtro, o gestor pegaria linhas[0] — o perfil de OUTRA pessoa, em ordem
  // arbitraria — e o sistema decidiria a permissao dele pelo papel de um colega.
  async function leRemoto(uid) {
    var url = SB + '/rest/v1/perfis?select=papel,ativo,permissoes&id=eq.' + encodeURIComponent(uid);
    var r = await fetchBase(url, { headers: { apikey: ANON } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var d = await r.json();
    if (!Array.isArray(d)) throw new Error('resposta inesperada');
    return d.length ? d[0] : null;
  }

  function usuario() {
    var a = raiz.gmAuth;
    return (a && a.user) || null;
  }

  // Espera o portao de login abrir. O gm-auth dispara `gm-auth-ready` quando ha sessao valida.
  // TETO DE ESPERA: sem sessao (1o acesso), a promessa nunca chegaria e as chamadas de dados
  // ficariam penduradas pra sempre atras do overlay de login. Melhor desistir e deixar passar:
  // sem token a RLS ja nega tudo, e o dono dessa tela e o gm-auth, nao eu.
  function esperaLogin(ms) {
    return new Promise(function (resolve) {
      if (usuario()) return resolve(true);
      var pronto = false;
      function acabou(v) { if (!pronto) { pronto = true; resolve(v); } }
      if (doc) doc.addEventListener('gm-auth-ready', function () { acabou(true); });
      setTimeout(function () { acabou(!!usuario()); }, ms || 15000);
    });
  }

  async function carrega() {
    var temLogin = await esperaLogin(15000);
    var u = usuario();
    if (!temLogin || !u || !u.id) {
      estado = 'esperando-login'; perfil = null;
      return estado;
    }
    // TENTA 3 VEZES ANTES DE DESISTIR. Uma falha de rede nao pode virar tranca: o unico jeito de
    // sair de "indefinido" e recarregar, e um F5 no meio de um orcamento perde o orcamento.
    var erro = null;
    for (var i = 0; i < 3; i++) {
      try { var p = await leRemoto(u.id); erro = null;
        if (!p) { estado = 'negado'; perfil = null; motivo = 'sem papel definido'; return estado; }
        if (p.ativo === false) { estado = 'negado'; perfil = p; motivo = 'usuario desativado'; return estado; }
        var P = papeis();
        if (P && !P.PADRAO[p.papel]) { estado = 'negado'; perfil = p; motivo = 'papel desconhecido: ' + p.papel; return estado; }
        estado = 'ok'; perfil = p; motivo = ''; return estado;
      } catch (e) { erro = e; await new Promise(function (r) { setTimeout(r, 400 * (i + 1)); }); }
    }
    // NAO CONSEGUI CONFIRMAR: bloqueia. Seguir em frente com "provavelmente e gestor" e o modo de
    // falha que este projeto proibe — e seguir com "provavelmente e vendedor" trocaria a tabela de
    // quem tem direito a tabela crua. Sem resposta do banco nao ha decisao, ha chute.
    estado = 'indefinido'; perfil = null;
    motivo = 'nao consegui confirmar seu perfil de acesso' + (erro ? ' (' + erro.message + ')' : '');
    return estado;
  }

  function pronta() {
    if (!espera) espera = carrega().then(function (e) { avisa(); return e; });
    return espera;
  }
  // recomeca do zero (o botao "tentar de novo" do aviso de indefinido)
  function recarrega() { espera = null; return pronta(); }

  function avisa() {
    // a tela exigiu uma chave e o perfil nao tem: vira 'sem-permissao' ANTES de avisar, senao a
    // tela receberia 'ok' por um instante e pintaria o que nao devia antes do aviso cobrir.
    if (estado === 'ok' && exigida && !pode(exigida)) estado = 'sem-permissao';
    if (doc && doc.dispatchEvent) {
      doc.dispatchEvent(new CustomEvent('limedtec-sessao-pronta',
        { detail: { estado: estado, papel: papel(), perfil: perfil } }));
    }
    if (estado !== 'ok' && estado !== 'esperando-login') mostraBloqueio();
  }

  // ── A TELA DIZ DE QUE PERMISSAO ELA PRECISA ─────────────────────────────────────────────────
  //     <script src="limedtec-sessao.js" data-exige="ver_paineis"></script>
  // Um ATRIBUTO na propria tela, e nao uma lista de nomes de arquivo aqui dentro: o molde nao pode
  // conhecer as telas de nenhum cliente, e uma lista central e a coisa que a tela nova esquece de
  // atualizar. Aqui, quem cria a tela declara junto com o include ou nao declara nunca.
  var exigida = (function () {
    try {
      var s = doc && doc.currentScript;
      if (!s && doc) { var t = doc.querySelectorAll('script[src*="limedtec-sessao"]'); s = t[t.length - 1]; }
      return (s && s.getAttribute('data-exige')) || null;
    } catch (e) { return null; }
  })();

  // ── O QUE A TELA PERGUNTA ───────────────────────────────────────────────────────────────────
  function papel() { return (perfil && perfil.papel) || null; }

  // ANTES DE CARREGAR, `pode` E FALSO. Nao e pessimismo decorativo: e a mesma regra do banco.
  // Toda tela tem que perguntar depois do `pronta()` (ou no evento) — e se esquecer, esconde
  // demais em vez de mostrar custo pra quem nao pode.
  function pode(chave) {
    if (estado !== 'ok' || !perfil) return false;
    var P = papeis();
    if (P) return P.pode(perfil, chave);
    return perfil.papel === 'gestor_geral';   // sem o limedtec-papeis.js, so o gestor
  }

  // ── A TROCA DE TABELA ───────────────────────────────────────────────────────────────────────
  // A CONDICAO E A PERMISSAO, NAO O PAPEL. Um gerente com o toggle ver_custo desligado e barrado
  // pela MESMA policy RESTRICTIVE que barra o vendedor; se aqui a pergunta fosse "papel ===
  // vendedor", esse gerente pediria `cotacoes`, receberia zero linha e ficaria sem sistema — o
  // mesmo buraco, so que num usuario que ninguem lembraria de testar. Perguntando pela chave, tela
  // e banco concordam por construcao.
  var TROCA = { cotacoes: 'cotacoes_vendedor' };
  function tabela(nome) {
    if (TROCA[nome] && !pode('ver_custo')) return TROCA[nome];
    return nome;
  }

  // ── O PATCH DO fetch ────────────────────────────────────────────────────────────────────────
  var ALVO = new RegExp('/rest/v1/(' + Object.keys(TROCA).join('|') + ')(?=[?#]|$)');
  function reescreve(url) {
    return url.replace(ALVO, function (todo, tab) { return '/rest/v1/' + tabela(tab); });
  }
  var fetchAnterior = fetchBase;
  raiz.fetch = async function (input, init) {
    try {
      var url = (typeof input === 'string') ? input : null;
      if (url && url.indexOf('/rest/v1/') >= 0) {
        await pronta();
        // BLOQUEIO DE DADO: sem papel confirmado nao sai leitura nenhuma. Devolver [] com 403 (e
        // nao deixar estourar) e o mesmo contrato que o gm-auth ja usa: as telas sabem lidar com
        // lista vazia, e o aviso na frente do usuario ja explica o porque.
        if (estado === 'negado' || estado === 'indefinido' || estado === 'sem-permissao') {
          return new Response('[]', { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
        // SO LEITURA E REESCRITA. Um POST/PATCH em `cotacoes` nao pode virar escrita numa view:
        // ou a pessoa pode gravar (e a RLS deixa), ou nao pode — e ai o erro tem que aparecer,
        // nao ser desviado pra outro lugar.
        var metodo = ((init && init.method) || 'GET').toUpperCase();
        if (metodo === 'GET' || metodo === 'HEAD') input = reescreve(url);
      }
    } catch (e) { /* qualquer erro aqui: segue com a chamada original */ }
    return fetchAnterior(input, init);
  };

  // ── O AVISO NA FRENTE DO USUARIO ────────────────────────────────────────────────────────────
  // Sem isto, "sem papel = negado" apareceria como uma tela normal com a busca vazia — a pessoa
  // acharia que o banco caiu e ligaria pro suporte, em vez de pedir acesso a quem administra.
  function mostraBloqueio() {
    if (!doc || !doc.body && !doc.documentElement) return;
    if (doc.getElementById('limedtec-bloqueio')) return;
    var negado = (estado === 'negado' || estado === 'sem-permissao');
    var box = doc.createElement('div');
    box.id = 'limedtec-bloqueio';
    box.setAttribute('style', 'position:fixed;inset:0;z-index:2147483646;background:#0b1220;'
      + 'color:#e5e7eb;display:flex;align-items:center;justify-content:center;'
      + "font-family:system-ui,'Segoe UI',Arial,sans-serif");
    var txt = (estado === 'sem-permissao')
      ? 'Seu perfil (' + (papel() || '—') + ') nao tem acesso a esta tela. '
        + 'Fale com quem administra o sistema.'
      : negado
      ? 'Sua conta esta autenticada, mas ' + (motivo === 'usuario desativado'
          ? 'foi desativada.' : 'ainda nao tem um papel de acesso definido.')
        + ' Fale com quem administra o sistema.'
      : 'Nao consegui confirmar seu perfil de acesso agora. Isso costuma ser falha de rede.';
    box.innerHTML = '<div style="width:380px;max-width:92vw;background:#111a2e;border:1px solid #22314f;'
      + 'border-radius:16px;padding:28px 24px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)">'
      + '<div style="font-size:30px;margin-bottom:6px">' + (negado ? '🔒' : '⚠️') + '</div>'
      + '<div style="font-weight:800;font-size:17px;margin-bottom:6px">'
      + (negado ? 'Acesso nao liberado' : 'Perfil nao confirmado') + '</div>'
      + '<div style="color:#a9bbdb;font-size:13px;line-height:1.5;margin-bottom:18px">' + txt + '</div>'
      + (negado ? '' : '<button id="limedtec-retentar" style="width:100%;padding:11px;border:none;'
          + 'border-radius:9px;background:#2563eb;color:#fff;font-weight:700;font-size:14px;'
          + 'cursor:pointer;margin-bottom:9px">Tentar de novo</button>')
      + '</div>';
    (doc.body || doc.documentElement).appendChild(box);
    var b = doc.getElementById('limedtec-retentar');
    if (b) b.onclick = function () { box.parentNode.removeChild(box); recarrega(); };
  }

  raiz.LimedtecSessao = {
    pronta: pronta, recarrega: recarrega, papel: papel, pode: pode, tabela: tabela,
    estado: function () { return estado; }, perfil: function () { return perfil; },
    motivo: function () { return motivo; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.LimedtecSessao;

  // comeca a carregar assim que a pagina abre: quando a tela pedir dados, o perfil ja esta pronto
  // (e se nao estiver, o patch acima espera por ele).
  pronta();
})(typeof window !== 'undefined' ? window : globalThis);
