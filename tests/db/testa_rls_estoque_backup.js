// Teste de RLS da estoque_backup com JWT REAL, pela REST (o caminho que o browser usa).
// Cria usuarios TEMPORARIOS (diretor + vendedor), prova as 4 operacoes do gestor e o 403 do
// vendedor, e LIMPA TUDO (linha de teste + usuarios), provando com contagem antes/depois.
// Regra permanente de teste da FPMED (22/07): dado de teste some no fim, com prova.
//   node tests/testa_rls_estoque_backup.js
const fs = require('fs');

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const pick = re => { const m = seg.match(re); if (!m) throw new Error('faltou no segredos.local.txt: ' + re); return m[1]; };
const SR   = pick(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i);
const ANON = pick(/ANON_KEY\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i);

const adm = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };
let ok = 0, fail = 0;
const t = (nome, cond, extra = '') => { if (cond) { ok++; console.log(`  ok   ${nome}`); }
                                        else { fail++; console.log(`  FALHA ${nome} ${extra}`); } };

const jwtPayload = tk => JSON.parse(Buffer.from(tk.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'));

async function criaUsuario(email, senha, role) {
  const r = await fetch(`${SB}/auth/v1/admin/users`, { method: 'POST', headers: adm,
    body: JSON.stringify({ email, password: senha, email_confirm: true, app_metadata: { role } }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`criar ${role}: ${r.status} ${JSON.stringify(j).slice(0,200)}`);
  return j.id;
}
async function login(email, senha) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: senha }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`login: ${r.status} ${JSON.stringify(j).slice(0,200)}`);
  return j.access_token;
}
const comoUsuario = tk => ({ apikey: ANON, Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' });

async function contaBackups() {
  const r = await fetch(`${SB}/rest/v1/estoque_backup?select=id`, { headers: { ...adm, Prefer: 'count=exact', Range: '0-0' } });
  return Number((r.headers.get('content-range') || '/0').split('/')[1]);
}

(async () => {
  console.log('\n=== RLS estoque_backup — JWT real via PostgREST ===\n');
  const marca = 'rlstest-' + Math.random().toString(36).slice(2, 8);
  const senha = 'Tmp!' + Math.random().toString(36).slice(2, 12) + 'A9';
  const emailD = `${marca}-diretor@fpmed.com.br`, emailV = `${marca}-vendedor@fpmed.com.br`;
  const antes = await contaBackups();
  console.log(`  estoque_backup ANTES: ${antes} linha(s)\n`);

  let idD, idV, linhaId = null, tkD = null;
  try {
    idD = await criaUsuario(emailD, senha, 'diretor');
    idV = await criaUsuario(emailV, senha, 'vendedor');

    tkD = await login(emailD, senha);
    const tkV = await login(emailV, senha);
    t('JWT do diretor traz app_metadata.role=diretor', jwtPayload(tkD).app_metadata?.role === 'diretor', JSON.stringify(jwtPayload(tkD).app_metadata));
    t('JWT do vendedor traz app_metadata.role=vendedor', jwtPayload(tkV).app_metadata?.role === 'vendedor');

    // ---- GESTOR: as 4 operacoes que a tela de Atualizar Estoque usa ----
    const corpo = { resumo: `[TESTE RLS ${marca}] descartavel`, snapshot: [{ teste: true }], inseridos: [] };
    let r = await fetch(`${SB}/rest/v1/estoque_backup`, { method: 'POST',
      headers: { ...comoUsuario(tkD), Prefer: 'return=representation' }, body: JSON.stringify(corpo) });
    const criado = r.ok ? await r.json() : await r.text();
    t('diretor INSERT (era o bug reportado)', r.status === 201, `HTTP ${r.status} ${String(criado).slice(0,140)}`);
    if (r.status === 201) linhaId = criado[0].id;

    if (linhaId) {
      r = await fetch(`${SB}/rest/v1/estoque_backup?id=eq.${linhaId}&select=*`, { headers: comoUsuario(tkD) });
      const lidas = await r.json();
      t('diretor SELECT (desfazer le o snapshot)', r.ok && Array.isArray(lidas) && lidas.length === 1, `HTTP ${r.status}`);

      r = await fetch(`${SB}/rest/v1/estoque_backup?id=eq.${linhaId}`, { method: 'PATCH',
        headers: comoUsuario(tkD), body: JSON.stringify({ restaurado: true }) });
      t('diretor UPDATE (marcar restaurado)', r.status === 204, `HTTP ${r.status}`);

      // contraprova do vendedor ANTES de apagar a linha
      r = await fetch(`${SB}/rest/v1/estoque_backup?select=*`, { headers: comoUsuario(tkV) });
      const vLe = r.ok ? await r.json() : null;
      t('vendedor SELECT bloqueado (snapshot tem custo)', r.ok && Array.isArray(vLe) && vLe.length === 0, `HTTP ${r.status} ${JSON.stringify(vLe).slice(0,80)}`);

      r = await fetch(`${SB}/rest/v1/estoque_backup`, { method: 'POST',
        headers: comoUsuario(tkV), body: JSON.stringify({ resumo: `[TESTE RLS ${marca}] vendedor nao pode`, snapshot: [] }) });
      const vTxt = await r.text();
      t('vendedor INSERT 403 (RLS barra)', r.status === 403 && /row-level security/i.test(vTxt), `HTTP ${r.status} ${vTxt.slice(0,120)}`);
    }

    // ---- COTACOES: a outra gravacao do import de estoque (a linha em si) ----
    // O backup e so metade do caminho: se a cotacoes barrar, o import tambem morre.
    const prod = `[TESTE RLS ${marca}] produto descartavel`;
    let rc = await fetch(`${SB}/rest/v1/cotacoes`, { method: 'POST',
      headers: { ...comoUsuario(tkD), Prefer: 'return=representation' },
      body: JSON.stringify({ fornecedor: '1', tipo: 'global', produto: prod, estoque: 1, global_venda1: 1.23 }) });
    const cCriado = rc.ok ? await rc.json() : await rc.text();
    t('diretor INSERT em cotacoes (gravacao do estoque)', rc.status === 201, `HTTP ${rc.status} ${String(cCriado).slice(0,140)}`);
    const cotId = rc.status === 201 ? cCriado[0].id : null;

    rc = await fetch(`${SB}/rest/v1/cotacoes`, { method: 'POST', headers: comoUsuario(tkV),
      body: JSON.stringify({ fornecedor: '1', tipo: 'global', produto: prod + ' (vendedor)', estoque: 1 }) });
    const cvTxt = await rc.text();
    t('vendedor INSERT em cotacoes 403', rc.status === 403 && /row-level security/i.test(cvTxt), `HTTP ${rc.status} ${cvTxt.slice(0,120)}`);

    if (cotId) {
      rc = await fetch(`${SB}/rest/v1/cotacoes?id=eq.${cotId}`, { method: 'DELETE', headers: comoUsuario(tkD) });
      t('diretor DELETE em cotacoes + limpeza da linha', rc.status === 204, `HTTP ${rc.status}`);
      if (rc.status !== 204) await fetch(`${SB}/rest/v1/cotacoes?id=eq.${cotId}`, { method: 'DELETE', headers: adm });
    }
  } catch (e) {
    fail++; console.log('  FALHA (excecao): ' + e.message);
  } finally {
    // ---- limpeza: linha de teste + usuarios temporarios ----
    // O DELETE vai com o JWT do DIRETOR de proposito: e a poda dos 5 snapshots da tela,
    // entao a limpeza e tambem a prova da 4a policy. Cai pro service_role so se falhar.
    if (linhaId && tkD) {
      let r = await fetch(`${SB}/rest/v1/estoque_backup?id=eq.${linhaId}`, { method: 'DELETE', headers: comoUsuario(tkD) });
      t('diretor DELETE (poda dos 5 snapshots) + limpeza da linha', r.status === 204, `HTTP ${r.status}`);
      if (r.status !== 204) await fetch(`${SB}/rest/v1/estoque_backup?id=eq.${linhaId}`, { method: 'DELETE', headers: adm });
    }
    for (const id of [idD, idV]) if (id) await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adm });
    console.log('  limpeza: usuarios temporarios removidos');
  }

  const depois = await contaBackups();
  t(`estoque_backup volta ao original (${antes})`, depois === antes, `depois=${depois}`);
  const sobrou = await fetch(`${SB}/rest/v1/cotacoes?select=id&produto=like.*TESTE%20RLS*`, { headers: adm });
  const restos = await sobrou.json();
  t('nenhuma cotacao de teste sobrou no banco', Array.isArray(restos) && restos.length === 0, JSON.stringify(restos).slice(0,120));
  console.log(`\n───────────────────────────────\n${ok} ok, ${fail} falha(s)`);
  console.log(fail ? '>>> VERMELHO' : '>>> TUDO VERDE');
  process.exit(fail ? 1 : 0);
})();
