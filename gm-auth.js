/* ══════════════════════════════════════════════════════════════════════════
   FPMED — Portão de login (Supabase Auth · Nível 1)
   Uso: incluir <script src="gm-auth.js"></script> no <head> de cada sistema.
   - Mostra um overlay de login até haver sessão válida (email + senha).
   - Guarda a sessão no localStorage e renova pelo refresh_token.
   - Expõe window.gmAuth = { user, isAdmin(), logout(), trocarSenha() }.
   - Nível 1: é PORTÃO DE ACESSO (não é RLS). Dados seguem via anon key.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  var SB   = 'https://xzdowrksuswekwffoluk.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6ZG93cmtzdXN3ZWt3ZmZvbHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NzE2MTMsImV4cCI6MjEwMDI0NzYxM30.Pk-SlV_pZdniESyrajDdfHdHcnmyCwCMtP_TrShh75Y';
  var K = 'gm_session';

  // ── CARGOS e CAPACIDADES ──────────────────────────────────────────────────────
  // Cargos: diretor, gerente, vendedor, propostas. Legado: admin=diretor, vendedora=vendedor,
  // giovana_only=propostas. GESTOR = diretor|gerente (vê custo/fornecedor/intel, grava, apaga).
  // ATENÇÃO: isto é a camada de TELA/UX. A segurança REAL é a RLS no banco (db_rls_cargos.sql),
  // que decide por app_metadata.role do JWT — não dá pra burlar pelo F12.
  function _normCargo(r){
    r = (r||'').toLowerCase();
    if(r==='admin') return 'diretor';
    if(r==='vendedora') return 'vendedor';
    if(r==='giovana_only') return 'propostas';
    if(r==='diretor'||r==='gerente'||r==='vendedor'||r==='propostas') return r;
    return 'vendedor';   // desconhecido = menor privilégio
  }
  function _cargoLabel(c){ return ({diretor:'Diretor',gerente:'Gerente',vendedor:'Vendedor',propostas:'Propostas'})[c] || 'Vendedor'; }
  function _gestor(c){ return c==='diretor' || c==='gerente'; }
  function _can(c, cap){
    switch(cap){
      case 'verSensivel': case 'grava': case 'gestor': return _gestor(c);   // custo/fornecedor/intel/gravar/apagar
      case 'usarIA':      return _gestor(c) || c==='vendedor';              // IA Ler Pedido / Importar lista
      case 'destrutivo':  return c==='diretor';                            // (reservado p/ futuro)
      default: return false;
    }
  }

  // ── Controle de acesso por PÁGINA ─────────────────────────────────────────────
  // vendedor e propostas: SÓ a tela Propostas (fpmed_giovana). gerente/diretor: tudo.
  var _blocked = false;
  function _paginaGiovana(){ return /giovana/i.test(location.pathname || location.href || ''); }
  function _pagPermitida(role){
    var c = _normCargo(role);
    if(c==='propostas' || c==='vendedor') return _paginaGiovana();
    return true;
  }

  function getSess(){ try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch(e){ return null; } }
  function setSess(s){ localStorage.setItem(K, JSON.stringify(s)); }
  function clearSess(){ localStorage.removeItem(K); }

  // ── E1 (Nível 2): manda o JWT do usuário logado nas chamadas de DADOS (/rest/v1/) ──
  // Assim, quando a RLS for ligada, as requisições dos sistemas contam como "authenticated".
  // NÃO mexe em /auth/v1/ (login/refresh) nem /functions/v1/ (ler-pedido). Token lido a cada
  // chamada (cobre o refresh). Enquanto a RLS está OFF, funciona igual (anon e authenticated valem).
  var _origFetch = window.fetch.bind(window);
  var _refreshing = null;
  // Garante token válido ANTES de cada chamada de dados: renova se expirado (single-flight).
  async function _tokenFresco(){
    var s = getSess();
    if(!s || !s.access_token) return s;
    if(s.expires_at && s.expires_at < Date.now() + 60000){   // expirado ou < 60s p/ expirar
      if(!_refreshing) _refreshing = refreshEstado().finally(function(){ _refreshing = null; });
      var estado = await _refreshing;
      if(estado === 'morta'){                                 // o servidor recusou: re-login (sem loop)
        try{ if(ov && !ov.parentNode) (document.documentElement||document.body).appendChild(ov); showLogin('Sua sessão expirou — entre novamente.'); }catch(e){}
        return null;
      }
      // 'rede': a sessão CONTINUA VÁLIDA — só não deu pra renovar agora. Seguimos com o token
      // que temos. Se ele já venceu, o PostgREST responde 401 e o tratamento abaixo cuida;
      // derrubar o usuário aqui seria deslogar por causa de uma piscada de Wi-Fi.
      s = getSess();
    }
    return s;
  }
  // 401/403 do PostgREST com sessão: pode ser token vencido (relógio fora, token revogado) ou
  // falta de permissão real. Antes, cada tela imprimia o status cru — e "401 permission denied
  // ... GRANT SELECT ON public.negocios TO anon" na tela vira "o banco sumiu" pra quem lê.
  function _pareceSessao(status, corpo){
    if(status !== 401 && status !== 403) return false;
    return /42501|PGRST301|JWT|permission denied|expired/i.test(String(corpo || ''));
  }
  window.fetch = async function(input, init){
    var ehDados = false;
    try{
      if(typeof input === 'string' && input.indexOf('/rest/v1/') >= 0){
        ehDados = true;
        // bloqueio de acesso: usuário sem permissão nesta página NÃO carrega dados
        if(_blocked){ return new Response('[]', { status: 403, headers: { 'Content-Type': 'application/json' } }); }
        var s = await _tokenFresco();
        if(s && s.access_token){
          init = Object.assign({}, init || {});
          var h = new Headers((init && init.headers) || {});
          h.set('Authorization', 'Bearer ' + s.access_token);
          if(!h.has('apikey')) h.set('apikey', ANON);
          init.headers = h;
        }
      }
    }catch(e){ /* qualquer erro no patch: segue com o fetch original */ }
    var resp = await _origFetch(input, init);
    // ── 2ª CHANCE: token recusado pelo servidor mesmo achando a gente que estava bom ──
    // Renova UMA vez e repete a chamada. Sem isto, a tela pinta um erro de banco e o operador
    // recarrega a página no escuro. Com sessão morta de verdade, cai no overlay de login —
    // que é a mensagem certa, em vez de "GRANT SELECT ... TO anon" numa caixa vermelha.
    if(ehDados && resp && (resp.status === 401 || resp.status === 403) && getSess()){
      var corpo = '';
      try{ corpo = await resp.clone().text(); }catch(e){}
      if(_pareceSessao(resp.status, corpo)){
        try{
          if(!_refreshing) _refreshing = refreshEstado().finally(function(){ _refreshing = null; });
          var estado = await _refreshing;
          if(estado === 'ok'){
            var s2 = getSess();
            init = Object.assign({}, init || {});
            var h2 = new Headers((init && init.headers) || {});
            h2.set('Authorization', 'Bearer ' + s2.access_token);
            if(!h2.has('apikey')) h2.set('apikey', ANON);
            init.headers = h2;
            return _origFetch(input, init);          // repete UMA vez só — sem laço
          }
          if(estado === 'morta'){
            try{ if(ov && !ov.parentNode) (document.documentElement||document.body).appendChild(ov); showLogin('Sua sessão expirou — entre novamente.'); }catch(e){}
          }
          // 'rede': devolve o 401 original. A tela mostra o erro dela, a sessão fica de pé,
          // e a próxima tentativa do usuário funciona sozinha quando a rede voltar.
        }catch(e){ /* nunca deixar o patch derrubar a chamada */ }
      }
    }
    return resp;
  };

  // CARGO: lido do app_metadata (NÃO editável pelo usuário) com fallback pro user_metadata
  // (compat) — a fonte de verdade de segurança é a RLS no banco, que lê o app_metadata do JWT.
  function _roleFrom(u){
    if(!u) return 'vendedor';
    return (u.app_metadata && u.app_metadata.role)
        || (u.user_metadata && u.user_metadata.role)
        || 'vendedor';
  }
  function saveFromToken(d){
    var s = {
      access_token:  d.access_token,
      refresh_token: d.refresh_token,
      expires_at:    Date.now() + (d.expires_in || 3600) * 1000,
      user: { id: d.user && d.user.id, email: d.user && d.user.email, role: _roleFrom(d.user) }
    };
    setSess(s); return s;
  }

  async function login(email, senha){
    var r = await fetch(SB + '/auth/v1/token?grant_type=password', {
      method:'POST', headers:{ apikey:ANON, 'Content-Type':'application/json' },
      body: JSON.stringify({ email: email, password: senha })
    });
    var d = await r.json();
    if(!r.ok) throw new Error(d.error_description || d.msg || d.error || 'Falha no login');
    return saveFromToken(d);
  }
  // ── RENOVAÇÃO DA SESSÃO ───────────────────────────────────────────────────────
  // >>> DEFEITO CORRIGIDO EM 06/08/2026, e ele era a causa de "o sistema perde o banco
  //     de vez em quando": esta função devolvia `false` para DUAS coisas diferentes —
  //       (a) o servidor RECUSOU o refresh_token  = a sessão morreu de verdade;
  //       (b) não consegui FALAR com o servidor   = piscada de rede, sessão intacta.
  //     Quem chama tratava os dois como "sessão morta". Resultado: uma oscilação de Wi-Fi de
  //     2 segundos no instante do refresh (que acontece a cada ~1h, em CADA aba aberta)
  //     derrubava a sessão. Dali em diante toda consulta ia como `anon` e o PostgREST
  //     respondia 401 "permission denied ... GRANT SELECT ON public.X TO anon" — que na tela
  //     vira uma mensagem vermelha com cara de "as tabelas sumiram / o banco caiu".
  //     O banco nunca esteve fora. Medido em 06/08: as 20 tabelas/views respondendo 200
  //     logado, e as MESMAS respondendo 401 sem sessão.
  //
  // >>> E O TIMEOUT: não havia nenhum. Como o `_tokenFresco` é aguardado ANTES de cada
  //     consulta, um refresh pendurado travava a TELA INTEIRA pelo tempo que a rede levasse
  //     pra desistir — o "ora carrega, ora fica 25s girando".
  //
  // Devolve: 'ok' | 'morta' | 'rede'.  Só 'morta' pode derrubar alguém pro login.
  var REFRESH_TIMEOUT_MS = 12000;
  async function refreshEstado(){
    var s = getSess(); if(!s || !s.refresh_token) return 'morta';
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var to = ctrl ? setTimeout(function(){ ctrl.abort(); }, REFRESH_TIMEOUT_MS) : null;
    try{
      var r = await fetch(SB + '/auth/v1/token?grant_type=refresh_token', {
        method:'POST', headers:{ apikey:ANON, 'Content-Type':'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
        signal: ctrl ? ctrl.signal : undefined
      });
      var d = null; try{ d = await r.json(); }catch(e){ d = null; }
      if(r.ok && d && d.access_token){ saveFromToken(d); return 'ok'; }
      // 5xx é servidor com problema, não credencial errada: manter a sessão e tentar depois.
      if(r.status >= 500) return 'rede';
      return 'morta';                      // 400/401 do GoTrue = o refresh_token não vale mais
    }catch(e){
      return 'rede';                       // abort/offline/DNS/TLS — NÃO é sessão inválida
    }finally{ if(to) clearTimeout(to); }
  }
  // compatibilidade: quem só quer saber "renovou?" continua chamando refresh()
  async function refresh(){ return (await refreshEstado()) === 'ok'; }
  async function trocarSenha(nova){
    var s = getSess(); if(!s || !s.access_token) throw new Error('Sessão expirada');
    var r = await fetch(SB + '/auth/v1/user', {
      method:'PUT', headers:{ apikey:ANON, 'Content-Type':'application/json', Authorization:'Bearer '+s.access_token },
      body: JSON.stringify({ password: nova })
    });
    var d = await r.json();
    if(!r.ok) throw new Error(d.error_description || d.msg || 'Não foi possível trocar a senha');
    return true;
  }
  function logout(){ clearSess(); location.reload(); }
  async function recuperar(email){
    var r = await fetch(SB + '/auth/v1/recover?redirect_to=' + encodeURIComponent('https://fpmed-hospitalar.github.io/fpmed/reset-senha.html'), {
      method:'POST', headers:{ apikey:ANON, 'Content-Type':'application/json' },
      body: JSON.stringify({ email: email })
    });
    if(!r.ok){ var d = await r.json().catch(function(){ return {}; }); throw new Error(d.msg || d.error_description || d.error || ('HTTP '+r.status)); }
    return true;
  }

  // Nunca imprimir a barra de login / overlay no PDF client-facing
  var _pst = document.createElement('style');
  _pst.textContent = '@media print{#gm-auth-bar,#gm-auth-overlay{display:none !important}}';
  (document.head || document.documentElement).appendChild(_pst);

  // ── Overlay ────────────────────────────────────────────────────────────────
  var ov = document.createElement('div');
  ov.id = 'gm-auth-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0b1220;color:#e5e7eb;display:flex;align-items:center;justify-content:center;font-family:system-ui,\'Segoe UI\',Arial,sans-serif;';
  ov.innerHTML = '<div style="opacity:.65;font-size:14px">🔒 Carregando…</div>';
  (document.documentElement || document.body).appendChild(ov);

  function esc(x){ return (x==null?'':String(x)).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  function showLogin(msg, tipo){
    ov.innerHTML =
      '<div style="width:340px;max-width:92vw;background:#111a2e;border:1px solid #22314f;border-radius:16px;padding:26px 24px;box-shadow:0 20px 60px rgba(0,0,0,.5)">' +
        '<div style="text-align:center;font-weight:800;font-size:18px;letter-spacing:.5px;margin-bottom:2px">FPMED</div>' +
        '<div style="text-align:center;color:#8aa0c6;font-size:12px;margin-bottom:18px">Acesso ao sistema</div>' +
        '<input id="gm-email" type="email" placeholder="email" autocomplete="username" style="width:100%;box-sizing:border-box;padding:11px 12px;margin-bottom:10px;border-radius:9px;border:1px solid #2a3a5c;background:#0c1526;color:#e5e7eb;font-size:14px">' +
        '<input id="gm-pass" type="password" placeholder="senha" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:11px 12px;border-radius:9px;border:1px solid #2a3a5c;background:#0c1526;color:#e5e7eb;font-size:14px">' +
        '<div id="gm-msg" style="min-height:16px;margin:9px 0;font-size:12px;color:'+(tipo==='ok'?'#34d399':'#f87171')+'">'+esc(msg||'')+'</div>' +
        '<button id="gm-btn" style="width:100%;padding:11px;border:none;border-radius:9px;background:#2563eb;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Entrar</button>' +
        '<div style="text-align:center;margin-top:12px"><a id="gm-forgot" href="#" style="color:#8aa0c6;font-size:12px;text-decoration:none">Esqueci minha senha</a></div>' +
      '</div>';
    var emailEl = ov.querySelector('#gm-email'), passEl = ov.querySelector('#gm-pass'),
        btn = ov.querySelector('#gm-btn'), msgEl = ov.querySelector('#gm-msg');
    var lastEmail = (getSess()||{}).__lastEmail; if(lastEmail) emailEl.value = lastEmail;
    (lastEmail ? passEl : emailEl).focus();
    async function tentar(){
      var email = (emailEl.value||'').trim().toLowerCase(), senha = passEl.value||'';
      if(!email || !senha){ msgEl.style.color='#f87171'; msgEl.textContent='Preencha email e senha.'; return; }
      btn.disabled = true; btn.textContent = 'Entrando…'; msgEl.style.color='#8aa0c6'; msgEl.textContent='';
      try{
        var s = await login(email, senha);
        s.__lastEmail = email; setSess(s);
        // Recarrega após login "do zero": garante que a app re-inicialize já autenticada
        // (os sistemas disparam a carga de dados no load; com RLS ligada, precisa da sessão presente).
        location.reload();
      }catch(e){
        btn.disabled = false; btn.textContent = 'Entrar';
        msgEl.style.color='#f87171'; msgEl.textContent = /invalid|grant|credentials/i.test(e.message) ? 'Email ou senha incorretos.' : e.message;
        passEl.value=''; passEl.focus();
      }
    }
    btn.onclick = tentar;
    passEl.addEventListener('keydown', function(e){ if(e.key==='Enter') tentar(); });
    ov.querySelector('#gm-forgot').onclick = async function(e){
      e.preventDefault();
      var email = (emailEl.value||'').trim().toLowerCase();
      if(!email){ msgEl.style.color='#f87171'; msgEl.textContent='Digite seu email acima primeiro, depois clique aqui.'; emailEl.focus(); return; }
      msgEl.style.color='#8aa0c6'; msgEl.textContent='Enviando link de recuperação…';
      try{ await recuperar(email); msgEl.style.color='#34d399'; msgEl.textContent='Link enviado! Verifique seu email (e a caixa de spam).'; }
      catch(err){ msgEl.style.color='#f87171'; msgEl.textContent='Erro: '+err.message; }
    };
  }

  function injectBar(){
    if(document.getElementById('gm-auth-bar')) return;
    var s = getSess() || {}; var email = (s.user && s.user.email) || '';
    var cargoLbl = _cargoLabel(_normCargo(s.user && s.user.role));
    var bar = document.createElement('div');
    bar.id = 'gm-auth-bar';
    bar.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483000;display:flex;gap:6px;align-items:center;font-family:system-ui,\'Segoe UI\',Arial,sans-serif;font-size:11px;';
    bar.innerHTML =
      '<span style="background:#111a2e;color:#a9bbdb;border:1px solid #22314f;border-radius:20px;padding:3px 9px;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">👤 '+esc(email)+' <b style="color:#7fd0ff">· '+esc(cargoLbl)+'</b></span>' +
      '<button id="gm-troca" title="Trocar minha senha" style="background:#1f2b45;color:#cdd7ea;border:1px solid #2a3a5c;border-radius:20px;padding:3px 9px;cursor:pointer;font-size:11px">🔑</button>' +
      '<button id="gm-sair" style="background:#7f1d1d;color:#fff;border:none;border-radius:20px;padding:3px 10px;cursor:pointer;font-size:11px">Sair</button>';
    document.body.appendChild(bar);
    bar.querySelector('#gm-sair').onclick = function(){ if(confirm('Sair do sistema?')) logout(); };
    bar.querySelector('#gm-troca').onclick = async function(){
      var nova = prompt('Nova senha (mínimo 6 caracteres):'); if(nova==null) return;
      if((nova||'').length < 6){ alert('Senha muito curta (mínimo 6).'); return; }
      try{ await trocarSenha(nova); alert('✅ Senha alterada com sucesso!'); }
      catch(e){ alert('❌ ' + e.message); }
    };
  }

  function showSemPermissao(s){
    var email = (s.user && s.user.email) || '';
    if(ov && !ov.parentNode) (document.documentElement || document.body).appendChild(ov);
    ov.innerHTML =
      '<div style="width:360px;max-width:92vw;background:#111a2e;border:1px solid #22314f;border-radius:16px;padding:28px 24px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)">' +
        '<div style="font-size:30px;margin-bottom:6px">🔒</div>' +
        '<div style="font-weight:800;font-size:17px;margin-bottom:6px">Sem permissão</div>' +
        '<div style="color:#a9bbdb;font-size:13px;line-height:1.5;margin-bottom:18px">Sua conta ('+esc(email)+') tem acesso apenas ao sistema de <b>Propostas</b>. Este sistema não está liberado para você.</div>' +
        '<button id="gm-ir-giovana" style="width:100%;padding:11px;border:none;border-radius:9px;background:#2563eb;color:#fff;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:9px">Ir para Propostas</button>' +
        '<button id="gm-sair2" style="width:100%;padding:10px;border:1px solid #2a3a5c;border-radius:9px;background:#1f2b45;color:#cdd7ea;font-size:13px;cursor:pointer">Sair</button>' +
      '</div>';
    ov.querySelector('#gm-ir-giovana').onclick = function(){ location.href = 'fpmed_giovana.html'; };
    ov.querySelector('#gm-sair2').onclick = function(){ logout(); };
  }

  function reveal(){
    var sg = getSess() || {};
    var roleg = sg.user && sg.user.role;
    if(!_pagPermitida(roleg)){ _blocked = true; showSemPermissao(sg); return; }  // giovana_only fora da giovana
    if(ov && ov.parentNode) ov.parentNode.removeChild(ov);
    var s = getSess() || {};
    var _cargo = _normCargo(s.user && s.user.role);
    window.gmAuth = {
      user: s.user || null,
      cargo: _cargo,                                   // diretor|gerente|vendedor|propostas
      cargoLabel: _cargoLabel(_cargo),
      can: function(cap){ return _can(_cargo, cap); }, // gate de tela (a RLS é a trava real)
      isGestor: function(){ return _gestor(_cargo); },
      isAdmin: function(){ return _cargo === 'diretor'; },   // compat: diretor = admin de antes
      logout: logout,
      trocarSenha: trocarSenha
    };
    if(document.body) injectBar();
    else document.addEventListener('DOMContentLoaded', injectBar);
    document.dispatchEvent(new CustomEvent('gm-auth-ready', { detail: window.gmAuth }));
  }

  async function boot(){
    var s = getSess();
    if(s && s.access_token && s.expires_at && s.expires_at > Date.now() + 15000){ reveal(); return; }
    if(s && s.refresh_token){
      var estado = await refreshEstado();
      if(estado === 'ok'){ reveal(); return; }
      // 'rede' no boot: NÃO pedir senha por causa de rede. A sessão guardada continua valendo
      // (o servidor não disse o contrário) e a 2ª chance do fetch renova sozinha quando voltar.
      // Pedir login aqui é o pior momento possível: o operador digita senha achando que foi
      // deslogado, quando na verdade o Wi-Fi piscou.
      if(estado === 'rede' && s.access_token){ reveal(); return; }
    }
    showLogin();
  }
  boot();
})();
