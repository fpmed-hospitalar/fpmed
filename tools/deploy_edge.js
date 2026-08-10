// ============================================================
// deploy_edge.js — publica uma edge function da FPMED pela Management API do Supabase.
//
// POR QUE ESTE ARQUIVO EXISTE: a CLI do Supabase nao esta instalada nesta maquina e instalar
// uma CLI so pra subir um arquivo e dependencia nova pra manter. A Management API faz o mesmo
// com o token que ja esta no segredos.local.txt (gitignored) — e o token NUNCA passa pela
// linha de comando (historico do shell), so e lido do arquivo.
//
// USO:
//   node tools/deploy_edge.js --funcao coletar-licitacoes            (deploy)
//   node tools/deploy_edge.js --funcao coletar-licitacoes --so-ver   (nao publica; so lista)
//   node tools/deploy_edge.js --segredo COLETA_TOKEN                 (le do segredos.local.txt
//                                                                     e seta no projeto)
//   node tools/deploy_edge.js --gera-token                           (gera COLETA_TOKEN novo e
//                                                                     GRAVA no segredos.local.txt)
//   node tools/deploy_edge.js --chamar coletar-licitacoes [--dias 7] (smoke test / coleta manual)
//
// >>> NAO IMPRIME SEGREDO NENHUM. Valor de secret so aparece como "(len N)".
// >>> So mexe na funcao que voce nomear. Nao apaga funcao, nunca.
// ============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SEGREDOS = 'C:/fpmed/segredos.local.txt';
const API = 'https://api.supabase.com';

function leSegredo(chave) {
  const txt = fs.readFileSync(SEGREDOS, 'utf8');
  const m = txt.match(new RegExp('^\\s*' + chave + '\\s*[:=]\\s*(\\S+)\\s*$', 'im'));
  return m ? m[1] : null;
}

const TOKEN = leSegredo('SUPABASE_ACCESS_TOKEN');
const REF = leSegredo('PROJECT_REF') || 'xzdowrksuswekwffoluk';
if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN nao encontrado no segredos.local.txt — abortando.');
  process.exit(1);
}
const H = { Authorization: 'Bearer ' + TOKEN };

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = (n) => process.argv.includes(n);

async function chama(metodo, rota, opts = {}) {
  const r = await fetch(API + rota, { method: metodo, headers: { ...H, ...(opts.headers || {}) }, body: opts.body });
  const txt = await r.text();
  let json = null; try { json = JSON.parse(txt); } catch (_) {}
  return { status: r.status, ok: r.ok, json, txt };
}

async function lista() {
  const r = await chama('GET', `/v1/projects/${REF}/functions`);
  if (!r.ok) { console.error(`ERRO ao listar (HTTP ${r.status}): ${r.txt.slice(0, 300)}`); process.exit(1); }
  return r.json || [];
}

// A plataforma injeta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sozinha; esses NAO se setam aqui.
async function setaSegredo(nome) {
  const valor = leSegredo(nome);
  if (!valor) { console.error(`${nome} nao encontrado no segredos.local.txt.`); process.exit(1); }
  const r = await chama('POST', `/v1/projects/${REF}/secrets`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ name: nome, value: valor }]),
  });
  if (!r.ok) { console.error(`ERRO ao setar ${nome} (HTTP ${r.status}): ${r.txt.slice(0, 300)}`); process.exit(1); }
  console.log(`secret ${nome} setado no projeto ${REF}  (len ${valor.length})`);
}

// Token dedicado e DESCARTAVEL: se vazar, o estrago e o que a funcao sabe fazer (gravar
// licitacao publica). Nao e a service_role. 32 bytes de aleatoriedade criptografica.
// `--nome` entrou em 10/08 com a 2a funcao agendada (enviar-boletim). CADA AGENDADOR TEM O SEU
// TOKEN de proposito: token compartilhado faz a rotacao de um derrubar o outro, e o dia em que
// um vazar obriga a trocar os dois.
function geraToken() {
  const nome = arg('--nome') || 'COLETA_TOKEN';
  if (!/^[A-Z][A-Z0-9_]{2,40}$/.test(nome)) { console.error('nome de segredo invalido: ' + nome); process.exit(1); }
  const txt = fs.readFileSync(SEGREDOS, 'utf8');
  if (new RegExp('^\\s*' + nome + '\\s*[:=]', 'im').test(txt)) {
    console.log(`${nome} JA EXISTE no segredos.local.txt — nao vou sobrescrever.`);
    console.log('(rotacionar de proposito: apague a linha na mao e rode de novo)');
    return;
  }
  const t = crypto.randomBytes(32).toString('base64url');
  const bloco = `\n[${nome}]\n`
    + `# Segredo DEDICADO do agendador. NAO e a service_role. Gerado em ${new Date().toISOString().slice(0, 10)}.\n`
    + `# Usado por: tools/deploy_edge.js (seta no Supabase) e pelo GitHub Actions (secret ${nome}).\n`
    + `${nome} = ${t}\n`;
  fs.appendFileSync(SEGREDOS, bloco, 'utf8');
  console.log(`${nome} gerado e gravado no segredos.local.txt  (len ${t.length})`);
}

async function deploy(slug) {
  const dir = path.join('C:/fpmed/supabase/functions', slug);
  const entry = path.join(dir, 'index.ts');
  if (!fs.existsSync(entry)) { console.error(`nao achei ${entry}`); process.exit(1); }
  const src = fs.readFileSync(entry, 'utf8');

  // verify_jwt=false: quem autentica e o x-coleta-token. Exigir JWT junto obrigaria o agendador
  // a carregar TAMBEM uma chave do Supabase — dois segredos pra uma porta so. Mesmo desenho da
  // ler-pedido, que ja esta no ar desde 22/07.
  const meta = { entrypoint_path: 'index.ts', name: slug, verify_jwt: false };

  const fd = new FormData();
  fd.append('metadata', JSON.stringify(meta));
  fd.append('file', new Blob([src], { type: 'application/typescript' }), 'index.ts');

  let r = await chama('POST', `/v1/projects/${REF}/functions/deploy?slug=${encodeURIComponent(slug)}`, { body: fd });

  // Caminho antigo da API (POST cria / PATCH atualiza, corpo = o proprio .ts). Fica como reserva
  // pra nao depender de uma unica forma da API continuar existindo.
  if (!r.ok) {
    console.log(`(deploy multipart devolveu HTTP ${r.status} — tentando o caminho legado)`);
    const existe = (await lista()).some((f) => f.slug === slug);
    const rota = existe
      ? `/v1/projects/${REF}/functions/${slug}?verify_jwt=false`
      : `/v1/projects/${REF}/functions?slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(slug)}&verify_jwt=false`;
    r = await chama(existe ? 'PATCH' : 'POST', rota, {
      headers: { 'Content-Type': 'application/typescript' }, body: src,
    });
  }

  if (!r.ok) { console.error(`ERRO no deploy (HTTP ${r.status}): ${r.txt.slice(0, 500)}`); process.exit(1); }
  console.log(`deploy OK: ${slug} -> projeto ${REF}  (versao ${r.json?.version ?? '?'}, status ${r.json?.status ?? '?'}, verify_jwt=${r.json?.verify_jwt})`);
}

// Smoke test da porta + coleta manual. As DUAS metades importam: sem token tem que dar 401
// (funcao de escrita que responde a qualquer um e a falha que ninguem ve ate o dia do estrago).
async function chamaFuncao(slug) {
  const tok = leSegredo('COLETA_TOKEN');
  if (!tok) { console.error('COLETA_TOKEN nao esta no segredos.local.txt — rode --gera-token.'); process.exit(1); }
  const url = `https://${REF}.supabase.co/functions/v1/${slug}`;
  const corpo = {};
  if (arg('--dias')) corpo.dias = parseInt(arg('--dias'));
  if (arg('--ufs')) corpo.ufs = arg('--ufs');

  const semToken = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  console.log(`sem token   -> HTTP ${semToken.status}  ${semToken.status === 401 ? '(esperado 401 OK)' : '*** ESPERAVA 401 ***'}`);

  console.log(`chamando ${slug}...`);
  const t0 = Date.now();
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-coleta-token': tok },
    body: JSON.stringify(corpo),
  });
  const txt = await r.text();
  console.log(`com token   -> HTTP ${r.status}  em ${Math.round((Date.now() - t0) / 1000)}s`);
  console.log(txt.slice(0, 800));
}

(async () => {
  if (tem('--gera-token')) { geraToken(); return; }
  const chamar = arg('--chamar');
  if (chamar) { await chamaFuncao(chamar); return; }
  const seg = arg('--segredo');
  if (seg) { await setaSegredo(seg); return; }

  const slug = arg('--funcao');
  const fns = await lista();
  console.log(`projeto ${REF} — ${fns.length} funcao(oes) no ar:`);
  for (const f of fns) console.log(`  ${f.slug.padEnd(24)} v${f.version}  ${f.status}  verify_jwt=${f.verify_jwt}`);
  if (!slug || tem('--so-ver')) return;
  console.log('');
  await deploy(slug);
})().catch((e) => { console.error('ERRO: ' + e.message); process.exit(1); });
