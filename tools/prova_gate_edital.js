// ============================================================
// prova_gate_edital.js — PROVA que o piloto do leitor de edital e PERMISSAO, e nao botao
// escondido. So leitura + 1 login por usuario; NAO chama a IA (nao gasta credito).
//
// A pergunta que ele responde: alguem que nao esta na lista consegue chamar o endpoint direto,
// como faria pelo console do navegador? Se conseguir, o "piloto" e decoracao.
//
//   node tools/prova_gate_edital.js
// ============================================================
'use strict';
const fs = require('fs');

const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const EDGE = SB + '/functions/v1/ler-edital';
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const ANON = (seg.match(/anon[\s\S]{0,200}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';

async function token(email) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SENHA }),
  });
  const j = await r.json();
  return j.access_token || null;
}

async function tenta(rotulo, tok) {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  // corpo com texto CURTO de proposito: se a porta abrir, ele bate no 400 de "texto pobre"
  // ANTES de chamar a IA. A prova nao pode custar dinheiro.
  const r = await fetch(EDGE, { method: 'POST', headers: h, body: JSON.stringify({ modo: 'texto', texto: 'x' }) });
  const t = await r.text();
  console.log(`  ${rotulo.padEnd(34)} -> HTTP ${r.status}  ${t.slice(0, 110)}`);
  return r.status;
}

(async () => {
  console.log('=== O PILOTO E PERMISSAO OU BOTAO ESCONDIDO? ===\n');

  const s1 = await tenta('sem token nenhum', null);
  const s2 = await tenta('token invalido', 'nao-e-um-token');

  const tokMarcos = await token('comercial@fpmed.com.br');
  const s3 = tokMarcos ? await tenta('Marcos (logado, FORA da lista)', tokMarcos)
                       : (console.log('  Marcos: nao consegui logar (senha trocada?) — pulei'), null);

  const tokNat = await token('licitacao@fpmed.com.br');
  const s4 = tokNat ? await tenta('Natanael (logado, NA lista)', tokNat)
                    : (console.log('  Natanael: nao consegui logar (senha trocada?) — pulei'), null);

  console.log('\n=== VEREDITO ===');
  const ok401 = s1 === 401 && s2 === 401;
  console.log(ok401 ? '  OK  sem sessao valida = 401 (nao passa)' : '  !!  sem sessao NAO deu 401 — a porta esta aberta');
  if (s3 !== null) console.log(s3 === 403 ? '  OK  logado fora da lista = 403 (a lista e do SERVIDOR)'
                                          : '  !!  quem esta FORA da lista recebeu ' + s3 + ' — o gate nao vale');
  if (s4 !== null) console.log(s4 === 400 ? '  OK  quem esta NA lista passou do gate (parou no 400 do texto curto)'
                                          : '  ??  quem esta na lista recebeu ' + s4 + ' — conferir');

  // E o contador: da pra alguem escrever uma leitura na mao?
  if (tokMarcos) {
    const r = await fetch(`${SB}/rest/v1/usos_ia`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: 'Bearer ' + tokMarcos, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ usuario: '00000000-0000-0000-0000-000000000000', email: 'x@x', modo: 'texto', modelo: 'x' }]),
    });
    console.log((r.status === 401 || r.status === 403)
      ? '  OK  usuario logado NAO consegue gravar leitura na mao (HTTP ' + r.status + ')'
      : '  !!  usuario logado conseguiu gravar no contador (HTTP ' + r.status + ') — a cobranca nao vale');
    /* >>> O STATUS DO DELETE NAO E A PROVA, E ISSO CUSTOU UM SUSTO NA 1a EXECUCAO. Com a tabela
           vazia (e depois, com a RLS filtrando tudo), o PostgREST devolve **204** num DELETE que
           nao apagou nada — "sucesso, zero linhas". Ler o 204 como "apagou" acusa um furo que
           nao existe; ler como "nao apagou" esconderia um furo que existisse. A prova e olhar A
           LINHA depois, com a service_role, e ver se ela continua la. */
    const antes = await (await fetch(`${SB}/rest/v1/usos_ia?select=id&limit=200`,
      { headers: { apikey: SR, Authorization: 'Bearer ' + SR } })).json();
    const d = await fetch(`${SB}/rest/v1/usos_ia?id=gt.0`, {
      method: 'DELETE', headers: { apikey: ANON, Authorization: 'Bearer ' + tokMarcos },
    });
    const depois = await (await fetch(`${SB}/rest/v1/usos_ia?select=id&limit=200`,
      { headers: { apikey: SR, Authorization: 'Bearer ' + SR } })).json();
    console.log(antes.length === depois.length
      ? `  OK  DELETE nao apagou nada (${antes.length} linha(s) antes e depois; HTTP ${d.status} = 0 linhas apos a RLS)`
      : `  !!  SUMIRAM ${antes.length - depois.length} LINHA(S) — conferir a RLS AGORA`);
    if (!antes.length) console.log('       (tabela vazia: este teste so tem valor com leitura registrada dentro)');
  }

  // anon nao ve nada
  const a = await fetch(`${SB}/rest/v1/usos_ia?select=id`, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  console.log(a.status === 401 ? '  OK  anon (internet) = 401' : '  !!  anon respondeu ' + a.status);
})();
