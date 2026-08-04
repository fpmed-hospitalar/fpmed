// GUARD permanente contra o bug de 04/08/2026: tabela com RLS LIGADA e ZERO policies
// nega tudo pra TODO MUNDO (inclusive diretor) e o app quebra em producao com
// "new row violates row-level security policy". Foi o que aconteceu com a estoque_backup:
// ela nasceu fora do SQL versionado, e o `drop policy` em massa do db_rls_cargos.sql
// apagou a policy que ela tinha sem recriar nenhuma.
//
// Este teste falha se QUALQUER tabela do schema public cair nesse estado, e tambem se
// alguma tabela nova ficar SEM RLS (o outro extremo: dado exposto pra anon).
//   node tests/db/testa_rls_cobertura.js
const fs = require('fs');
const { Client } = require('pg');

const REF = 'xzdowrksuswekwffoluk';
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const m = seg.match(/DB_PASSWORD\s*[:=]\s*(\S+)/i);
if (!m) { console.error('DB_PASSWORD nao encontrada — abortando.'); process.exit(1); }

const ALVOS = [
  { host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
  { host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
];

let ok = 0, fail = 0;
const t = (nome, cond, extra = '') => { if (cond) { ok++; console.log(`  ok   ${nome}`); }
                                        else { fail++; console.log(`  FALHA ${nome} ${extra}`); } };

(async () => {
  let c = null, ultimo;
  for (const a of ALVOS) {
    const cli = new Client({ ...a, password: m[1], database: 'postgres',
                             ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    try { await cli.connect(); c = cli; break; } catch (e) { ultimo = e; try { await cli.end(); } catch (_) {} }
  }
  if (!c) { console.error('ERRO de conexao: ' + ultimo.message); process.exit(1); }

  console.log('\n=== GUARD de cobertura de RLS (schema public) ===\n');
  const { rows } = await c.query(`
    select c.relname as tabela,
           c.relrowsecurity as rls,
           (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname)::int as policies
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname='public' and c.relkind='r'
     order by c.relname`);
  await c.end();

  const orfas   = rows.filter(r => r.rls && r.policies === 0);
  const abertas = rows.filter(r => !r.rls);

  for (const r of rows) console.log(`     ${r.tabela.padEnd(18)} rls=${r.rls ? 'on ' : 'OFF'} policies=${r.policies}`);
  console.log('');
  t(`nenhuma tabela com RLS ligada e ZERO policies (${rows.length} tabelas)`,
    orfas.length === 0, '-> ' + orfas.map(r => r.tabela).join(', '));
  t('nenhuma tabela sem RLS (dado nao pode ficar aberto pro anon)',
    abertas.length === 0, '-> ' + abertas.map(r => r.tabela).join(', '));

  console.log(`\n───────────────────────────────\n${ok} ok, ${fail} falha(s)`);
  console.log(fail ? '>>> VERMELHO' : '>>> TUDO VERDE');
  process.exit(fail ? 1 : 0);
})();
