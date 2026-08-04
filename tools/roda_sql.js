// Executa SQL no Postgres da FPMED. Credencial lida do segredos.local.txt (gitignored).
//   node tools/roda_sql.js --arquivo db_rls_estoque_backup.sql
//   node tools/roda_sql.js --query "select 1"
// Tenta a conexao direta e cai no pooler (IPv4) se a direta nao resolver.
// AVISO: isto roda o SQL que voce mandar. DDL/DML destrutivo exige OK do Lemuel (regra de ouro).
const fs = require('fs');
const { Client } = require('pg');

const REF = 'xzdowrksuswekwffoluk';
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const mp = seg.match(/DB_PASSWORD\s*[:=]\s*(\S+)/i);
if (!mp) { console.error('DB_PASSWORD nao encontrada no segredos.local.txt — abortando.'); process.exit(1); }
const PW = mp[1];

const ALVOS = [
  { nome: 'direta',  host: `db.${REF}.supabase.co`,            port: 5432, user: 'postgres' },
  { nome: 'pooler',  host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
  { nome: 'pooler-tx', host: 'aws-0-sa-east-1.pooler.supabase.com', port: 6543, user: `postgres.${REF}` },
];

async function conecta() {
  let ultimo;
  for (const a of ALVOS) {
    const c = new Client({ host: a.host, port: a.port, user: a.user, password: PW,
                           database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    try { await c.connect(); console.error(`[conexao: ${a.nome} ${a.host}:${a.port}]`); return c; }
    catch (e) { ultimo = e; try { await c.end(); } catch (_) {} }
  }
  throw ultimo;
}

(async () => {
  const i = process.argv.indexOf('--arquivo'), q = process.argv.indexOf('--query');
  let sql;
  if (i > -1) sql = fs.readFileSync(process.argv[i + 1], 'utf8');
  else if (q > -1) sql = process.argv[q + 1];
  else { console.error('uso: --arquivo <path.sql> | --query "<sql>"'); process.exit(1); }

  const c = await conecta();
  try {
    const r = await c.query(sql);
    const saidas = Array.isArray(r) ? r : [r];
    for (const s of saidas) {
      if (s.rows && s.rows.length) console.log(JSON.stringify(s.rows, null, 2));
      else console.log(`${s.command || 'OK'}${s.rowCount != null ? ' — ' + s.rowCount + ' linha(s)' : ''}`);
    }
  } finally { await c.end(); }
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
