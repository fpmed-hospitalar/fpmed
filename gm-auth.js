/* ══════════════════════════════════════════════════════════════════════════
   FPMED — Portão de login (Supabase Auth · Nível 1)
   Uso: incluir <script src="gm-auth.js"></script> no <head> de cada sistema.
   - Mostra um overlay de login até haver sessão válida (email + senha).
   - Guarda a sessão no localStorage e renova pelo refresh_token.
   - Expõe window.gmAuth = { user, isAdmin(), logout(), trocarSenha() }.
   - Nível 1: é PORTÃO DE ACESSO (não é RLS). Dados seguem via anon key.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  var SB   = 'https://vikewlbhkrikcalzsbeb.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpa2V3bGJoa3Jpa2NhbHpzYmViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTEzMDcsImV4cCI6MjA5MzY2NzMwN30.elMw6mbCoCbFVCnzck-aHQrXGYaZhX-m0RRb1VGYP64';
  var K = 'gm_session';

  // ── Controle de acesso por sistema ───────────────────────────────────────────
  // role 'giovana_only' só entra na fpmed_giovana.html; nos outros sistemas é bloqueado.
  // admin (Lemuel), vendedora (Isadora) e demais = acesso total.
  var _blocked = false;
  function _paginaGiovana(){ return /giovana/i.test(location.pathname || location.href || ''); }
  function _pagPermitida(role){
    if(role === 'giovana_only') return _paginaGiovana();
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
      if(!_refreshing) _refreshing = refresh().finally(function(){ _refreshing = null; });
      var ok = await _refreshing;
      if(!ok){                                                // refresh falhou = sessão morta -> re-login (sem loop)
        try{ if(ov && !ov.parentNode) (document.documentElement||document.body).appendChild(ov); showLogin('Sua sessão expirou — entre novamente.'); }catch(e){}
        return null;
      }
      s = getSess();
    }
    return s;
  }
  window.fetch = async function(input, init){
    try{
      if(typeof input === 'string' && input.indexOf('/rest/v1/') >= 0){
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
    return _origFetch(input, init);
  };

  function saveFromToken(d){
    var s = {
      access_token:  d.access_token,
      refresh_token: d.refresh_token,
      expires_at:    Date.now() + (d.expires_in || 3600) * 1000,
      user: { id: d.user && d.user.id, email: d.user && d.user.email,
              role: (d.user && d.user.user_metadata && d.user.user_metadata.role) || 'vendedora' }
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
  async function refresh(){
    var s = getSess(); if(!s || !s.refresh_token) return false;
    try{
      var r = await fetch(SB + '/auth/v1/token?grant_type=refresh_token', {
        method:'POST', headers:{ apikey:ANON, 'Content-Type':'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      var d = await r.json();
      if(!r.ok || !d.access_token){ return false; }
      saveFromToken(d); return true;
    }catch(e){ return false; }
  }
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
    var r = await fetch(SB + '/auth/v1/recover?redirect_to=' + encodeURIComponent('https://lemuelbarros-dot.github.io/globalmed/reset-senha.html'), {
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
    var bar = document.createElement('div');
    bar.id = 'gm-auth-bar';
    bar.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483000;display:flex;gap:6px;align-items:center;font-family:system-ui,\'Segoe UI\',Arial,sans-serif;font-size:11px;';
    bar.innerHTML =
      '<span style="background:#111a2e;color:#a9bbdb;border:1px solid #22314f;border-radius:20px;padding:3px 9px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">👤 '+esc(email)+'</span>' +
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
        '<div style="color:#a9bbdb;font-size:13px;line-height:1.5;margin-bottom:18px">Sua conta ('+esc(email)+') tem acesso apenas ao sistema <b>Giovana</b>. Este sistema não está liberado para você.</div>' +
        '<button id="gm-ir-giovana" style="width:100%;padding:11px;border:none;border-radius:9px;background:#2563eb;color:#fff;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:9px">Ir para o Giovana</button>' +
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
    window.gmAuth = {
      user: s.user || null,
      isAdmin: function(){ return !!(s.user && s.user.role === 'admin'); },
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
    if(s && s.refresh_token){ if(await refresh()){ reveal(); return; } }
    showLogin();
  }
  boot();
})();
