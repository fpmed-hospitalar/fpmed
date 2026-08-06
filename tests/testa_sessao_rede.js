// SUITE testa_sessao_rede — PISCADA DE REDE NAO PODE DERRUBAR A SESSAO.
//
// URGENCIA de 06/08/2026. O sintoma que ele relatou: "o sistema perde o banco de vez em quando,
// aparece uma mensagem vermelha dizendo que as tabelas nao estao la".
//
// O QUE ERA (medido, nao suposto):
//   - as 20 tabelas/views respondiam 200 LOGADO, e as MESMAS respondiam 401 SEM sessao, com o
//     corpo "42501 ... GRANT SELECT ON public.X TO anon". Na tela isso vira uma caixa vermelha
//     com cara de "o banco caiu". O banco nunca esteve fora.
//   - o `refresh()` do gm-auth devolvia `false` para DUAS coisas diferentes: o servidor RECUSAR
//     o refresh_token (sessao morta) e NAO CONSEGUIR FALAR com o servidor (rede). Quem chamava
//     tratava as duas como sessao morta -> uma oscilacao de Wi-Fi de 2s no instante do refresh
//     (que roda a cada ~1h, em CADA aba aberta) derrubava a sessao.
//   - e o refresh nao tinha TIMEOUT. Como ele e aguardado ANTES de cada consulta, um refresh
//     pendurado travava a tela inteira -- o "ora carrega, ora fica girando".
//
// Esta suite roda o gm-auth.js DE VERDADE num window de mentira, com o fetch controlado --
// porque assercao de texto no codigo nao provaria que a sessao sobrevive a queda.
//   node tests/testa_sessao_rede.js
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gm-auth.js'), 'utf8');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_sessao_rede — o gm-auth sob rede instavel\n');

// ── um navegador de mentira, so com o que o gm-auth toca ──────────────────────────────────
const nodo = (registro) => { const n = { style:{}, dataset:{}, children:[] };
  n.querySelector = () => nodo(registro); n.querySelectorAll = () => []; n.appendChild = () => {};
  n.addEventListener = () => {}; n.removeChild = () => {}; n.setAttribute = () => {};
  n.focus = () => {}; n.remove = () => {};
  if (registro) registro.push(n);
  return n; };

function ambiente(opcoes) {
  const guarda = opcoes.sessao ? { gm_session: opcoes.sessao } : {};
  const chamadas = [];
  const win = {
    location: { pathname: '/fpmed_negocios.html', href: 'https://x/fpmed_negocios.html', reload(){} },
    localStorage: {
      getItem: k => (k in guarda ? guarda[k] : null),
      setItem: (k, v) => { guarda[k] = String(v); },
      removeItem: k => { delete guarda[k]; },
    },
    addEventListener(){}, dispatchEvent(){},
    AbortController: class { constructor(){ this.signal = {}; } abort(){ this.aborted = true; } },
    Headers: class { constructor(i){ this.m = new Map(i && i.m ? i.m : Object.entries(i || {})); }
      set(k, v){ this.m.set(k, v); } has(k){ return this.m.has(k); } get(k){ return this.m.get(k) || null; } },
    Response: class { constructor(b, o){ this.body = b; this.status = (o && o.status) || 200; this.ok = this.status < 400; }
      text(){ return Promise.resolve(this.body); } clone(){ return this; } json(){ return Promise.resolve(JSON.parse(this.body)); } },
    CustomEvent: class { constructor(n, d){ this.type = n; Object.assign(this, d); } },
  };
  win.window = win;
  // A PROVA VIVA DO DEFEITO ANTIGO: com a rede fora, o gm-auth de antes jogava o operador na
  // tela de SENHA. Nao adianta contar appendChild -- a cortina "Carregando…" tambem e injetada
  // no load, e ela e correta. O que denuncia o pedido de senha e o campo `gm-pass` no innerHTML.
  const criados = [];
  const doc = { addEventListener(){}, dispatchEvent(){}, createElement: () => nodo(criados),
                documentElement: nodo(), body: null, head: nodo() };
  doc.pediuLogin = () => criados.filter(n => /id="gm-pass"/.test(String(n.innerHTML || ''))).length;
  win.document = doc;
  opcoes.R = win.Response;          // ANTES de rodar o gm-auth: o boot ja dispara o fetch
  win.fetch = async function (url, init) {
    chamadas.push({ url: String(url), init });
    return opcoes.responder(String(url), init, chamadas.length);
  };
  const fn = new Function('window', 'document', 'localStorage', 'fetch', 'Headers', 'Response',
    'AbortController', 'CustomEvent', 'setTimeout', 'clearTimeout',
    src + '\nreturn { fetch: window.fetch };');
  fn(win, doc, win.localStorage, win.fetch, win.Headers, win.Response,
     win.AbortController, win.CustomEvent, setTimeout, clearTimeout);
  return { win, guarda, chamadas, opcoes, pediuLogin: () => doc.pediuLogin() };
}
const SESS = (faltaMs) => JSON.stringify({
  access_token: 'jwt-antigo', refresh_token: 'rt-valido',
  expires_at: Date.now() + faltaMs, user: { id: 'u1', role: 'diretor' },
});
const NEGADO_ANON = JSON.stringify({ code: '42501',
  hint: 'Grant the required privileges to the current role with: GRANT SELECT ON public.negocios TO anon;',
  message: 'permission denied for table negocios' });
const auth = u => u.includes('/auth/v1/token');

// ══════════ 1. O CENARIO DA URGENCIA, RODANDO DE VERDADE ══════════
async function comportamento() {
  // (a) token vencido + REDE FORA no refresh: nao pode deslogar nem travar
  {
    let refreshes = 0;
    const amb = ambiente({ sessao: SESS(-1000), responder: async function (url) {
      if (auth(url)) { refreshes++; throw new TypeError('Failed to fetch'); }
      return new this.R('[{"id":1}]', { status: 200 });
    }});
    const r = await amb.win.fetch('https://x/rest/v1/negocios?select=*');
    ok('1. *** rede fora no refresh: a consulta de dados AINDA acontece ***', r && r.status === 200, r && r.status);
    ok('2. *** e a sessao CONTINUA guardada (nao deslogou por causa de Wi-Fi) ***', !!amb.guarda.gm_session);
    ok('3. tentou renovar, e uma vez so por rodada', refreshes >= 1 && refreshes <= 2, refreshes);
    // >>> ESTA E A ASSERCAO QUE MEDE O DEFEITO: o gm-auth ANTIGO caía aqui, porque tratava
    //     "nao consegui falar com o servidor" como "sessao morta".
    ok('3b. *** NAO joga o operador na tela de login por causa de rede ***', amb.pediuLogin() === 0, amb.pediuLogin());
  }
  // (b) token vencido + refresh RECUSADO pelo servidor: ai sim e sessao morta
  {
    const amb = ambiente({ sessao: SESS(-1000), responder: async function (url) {
      if (auth(url)) return new this.R('{"error":"invalid_grant"}', { status: 400 });
      return new this.R('[]', { status: 200 });
    }});
    await amb.win.fetch('https://x/rest/v1/negocios?select=*');
    const comToken = amb.chamadas.filter(c => c.url.includes('/rest/v1/'))
      .filter(c => c.init && c.init.headers && c.init.headers.get && c.init.headers.get('Authorization'));
    ok('4. *** refresh recusado: a consulta NAO vai com o token velho ***', comToken.length === 0, comToken.length);
    ok('4b. *** e AI SIM pede login (sessao morta de verdade tem que pedir) ***', amb.pediuLogin() > 0, amb.pediuLogin());
  }
  // (c) o 401 "42501" do PostgREST: renova UMA vez e REPETE com o token novo
  {
    let dados = 0;
    const amb = ambiente({ sessao: SESS(3600000), responder: async function (url) {
      if (auth(url)) return new this.R(JSON.stringify({ access_token: 'jwt-NOVO', refresh_token: 'rt2', expires_in: 3600 }), { status: 200 });
      dados++;
      if (dados === 1) return new this.R(NEGADO_ANON, { status: 401 });   // token recusado pelo servidor
      return new this.R('[{"id":9}]', { status: 200 });
    }});
    const r = await amb.win.fetch('https://x/rest/v1/negocios?select=*');
    ok('5. *** 401 de sessao vira 200 depois da renovacao (a tela nem ve o erro) ***', r && r.status === 200, r && r.status);
    ok('6. ...e foram exatamente 2 idas aos dados: a que falhou e a repetida', dados === 2, dados);
    const ultima = amb.chamadas.filter(c => c.url.includes('/rest/v1/')).pop();
    ok('7. *** a repetida leva o token NOVO ***',
      ultima.init.headers.get('Authorization') === 'Bearer jwt-NOVO', ultima.init.headers.get('Authorization'));
  }
  // (d) 401 de sessao + rede fora na renovacao: devolve o 401 e NAO desloga
  {
    const amb = ambiente({ sessao: SESS(3600000), responder: async function (url) {
      if (auth(url)) throw new TypeError('Failed to fetch');
      return new this.R(NEGADO_ANON, { status: 401 });
    }});
    const r = await amb.win.fetch('https://x/rest/v1/negocios?select=*');
    ok('8. 401 + rede fora: devolve o 401 pra tela tratar', r && r.status === 401, r && r.status);
    ok('9. *** e a sessao segue de pe: quando a rede voltar, funciona sozinho ***', !!amb.guarda.gm_session);
  }
  // (e) 403 de CARGO nao pode virar tentativa de renovacao
  {
    let refreshes = 0;
    const amb = ambiente({ sessao: SESS(3600000), responder: async function (url) {
      if (auth(url)) { refreshes++; return new this.R('{}', { status: 200 }); }
      return new this.R('{"message":"nao autorizado"}', { status: 403 });
    }});
    await amb.win.fetch('https://x/rest/v1/cotacoes?select=*');
    ok('10. *** 403 que nao fala de sessao NAO dispara renovacao (seria ida a toa) ***', refreshes === 0, refreshes);
  }
  // (f) consulta que dá certo de primeira nao pode ganhar ida extra
  {
    let dados = 0, refreshes = 0;
    const amb = ambiente({ sessao: SESS(3600000), responder: async function (url) {
      if (auth(url)) { refreshes++; return new this.R('{}', { status: 200 }); }
      dados++; return new this.R('[{"id":1}]', { status: 200 });
    }});
    const r = await amb.win.fetch('https://x/rest/v1/cotacoes?select=*');
    ok('11. caminho feliz: 1 ida, 0 renovacao, 200', dados === 1 && refreshes === 0 && r.status === 200, [dados, refreshes]);
  }
}

// ══════════ 2. AS DECISOES, NA FONTE (o que nao pode voltar atras) ══════════
ok('12. *** o refresh distingue os 3 estados: ok / morta / rede ***',
  /return 'ok';/.test(src) && /return 'morta';/.test(src) && /return 'rede';/.test(src));
ok('13. *** falha de REDE devolve "rede", nunca "morta" ***', /return 'rede';\s*\/\/ abort\/offline/.test(src));
ok('14. 5xx do servidor de auth tambem e "rede" (servidor com problema != credencial errada)',
  /if\(r\.status >= 500\) return 'rede';/.test(src));
ok('15. *** so 400/401 do GoTrue derruba (o servidor RECUSOU o refresh_token) ***',
  /return 'morta';\s*\/\/ 400\/401 do GoTrue/.test(src));
ok('16. *** o refresh tem TIMEOUT (refresh pendurado travava a tela inteira) ***',
  /REFRESH_TIMEOUT_MS = \d+/.test(src) && /ctrl\.abort\(\); \}, REFRESH_TIMEOUT_MS\)/.test(src));
ok('17. ...e o motivo esta escrito (o _tokenFresco e aguardado ANTES de cada consulta)',
  /travava a TELA INTEIRA/.test(src));
ok('18. *** so o estado "morta" manda pro login ***', /if\(estado === 'morta'\)\{/.test(src));
ok('19. no estado "rede" a sessao segue de pe', /a sessão CONTINUA VÁLIDA/.test(src));
ok('20. o defeito e o sintoma dele estao registrados no codigo, pra ninguem "simplificar" de volta',
  /GRANT SELECT ON public\.X TO anon/.test(src) && /O banco nunca esteve fora/.test(src));

// ══════════ 3. A 2a CHANCE NO 401 ══════════
ok('21. *** 401\/403 com cara de sessao dispara UMA renovacao e repete a chamada ***',
  /_pareceSessao\(resp\.status, corpo\)/.test(src) && /repete UMA vez só — sem laço/.test(src));
ok('22. reconhece os codigos que o PostgREST usa', /42501\|PGRST301\|JWT\|permission denied\|expired/.test(src));
ok('23. sessao morta de verdade mostra "sua sessao expirou", nao erro de banco',
  (src.match(/showLogin\('Sua sessão expirou — entre novamente\.'\)/g) || []).length === 2);
ok('24. o corpo e lido de um CLONE (senao a tela receberia a resposta ja consumida)',
  /resp\.clone\(\)\.text\(\)/.test(src));
ok('25. erro dentro do patch nunca derruba a chamada do app',
  /nunca deixar o patch derrubar a chamada/.test(src));

// ══════════ 4. O BOOT — a pior hora pra pedir senha ══════════
ok('26. *** rede fora no boot NAO pede senha: revela com a sessao guardada ***',
  /if\(estado === 'rede' && s\.access_token\)\{ reveal\(\); return; \}/.test(src));
ok('27. ...e o motivo esta escrito', /o Wi-Fi piscou/.test(src));
ok('28. sem sessao nenhuma, continua pedindo login (isso NAO pode ter afrouxado)',
  /\}\s*\n\s*showLogin\(\);\s*\n\s*\}\s*\n\s*boot\(\);/.test(src));

// ══════════ 5. O QUE NAO PODE TER SIDO QUEBRADO ══════════
ok('29. o JWT continua sendo injetado so em /rest/v1/', /input\.indexOf\('\/rest\/v1\/'\) >= 0/.test(src));
ok('30. /auth/v1/ e /functions/v1/ continuam intocados', /NÃO mexe em \/auth\/v1\//.test(src));
ok('31. o bloqueio por cargo continua ANTES de qualquer dado', /if\(_blocked\)\{ return new Response/.test(src));
ok('32. o refresh continua single-flight (nao dispara N renovacoes juntas)',
  (src.match(/if\(!_refreshing\) _refreshing = refreshEstado\(\)/g) || []).length === 2);
ok('33. quem chamava refresh() booleano continua funcionando',
  /async function refresh\(\)\{ return \(await refreshEstado\(\)\) === 'ok'; \}/.test(src));

comportamento().then(() => {
  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
}).catch(e => {
  console.log('  FALHA no ambiente de teste: ' + e.message + '\n' + e.stack);
  console.log('\nRESULTADO: ' + p + ' ok, ' + (f + 1) + ' falha(s)');
  process.exitCode = 1;
});
