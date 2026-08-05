// ═══════════════════════════════════════════════════════════════════════════════
// DERIVA A cmed_dicionario (marca -> principio ativo) A PARTIR DA cmed_pf
//
// Uso:  node tools/deriva_cmed_dicionario.js            -> PREVIEW (nada gravado)
//       node tools/deriva_cmed_dicionario.js --apply    -> INSERT (so em tabela vazia)
//
// POR QUE: a cmed_dicionario esta VAZIA desde sempre — e por isso o resolvePA das telas
// (sistema_final, giovana, viabilidade) devolve string vazia em 100% das chamadas. Nao e
// bug de codigo: e uma tabela que nunca foi carregada. O efeito medido em 04/08: 937 das
// 1.381 linhas do estoque proprio ficaram sem principio_ativo, e 302 delas sao medicamento
// de verdade — some da Competitividade e enfraquece o cruzamento do Licitacoes.
//
// A FONTE ESTAVA NA CASA: a cmed_pf ja tem 25.702 pares SUBSTANCIA x PRODUTO da lista
// oficial da ANVISA. O dicionario e uma projecao dela, nao um dado novo.
//
// O QUE NAO FAZ: nao inventa. Dose so entra quando a marca tem UMA dose so na lista
// inteira; com mais de uma, fica NULL e o resolvePA usa a dose lida do proprio nome.
// Marca que aponta pra duas substancias entra nas duas linhas — quem descarta o ambiguo
// e o app na leitura (carregarCmed da giovana), que e onde a regra ja mora.
//
// NAO E DESTRUTIVO: INSERT em tabela vazia. Recusa gravar se ja houver linha.
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const REF = 'xzdowrksuswekwffoluk';
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const mp = seg.match(/DB_PASSWORD\s*[:=]\s*(\S+)/i);
if (!mp) { console.error('DB_PASSWORD nao encontrada no segredos.local.txt'); process.exit(1); }
const PW = mp[1];

const ALVOS = [
  { nome: 'direta', host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
  { nome: 'pooler', host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
  { nome: 'pooler-tx', host: 'aws-0-sa-east-1.pooler.supabase.com', port: 6543, user: `postgres.${REF}` },
];
async function conecta() {
  let ultimo;
  for (const a of ALVOS) {
    const c = new Client({ host: a.host, port: a.port, user: a.user, password: PW, database: 'postgres',
                           ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    try { await c.connect(); console.log(`[conexao: ${a.nome}]`); return c; } catch (e) { ultimo = e; try { await c.end(); } catch (_) {} }
  }
  throw ultimo;
}

// A projecao. Uma linha por par (marca, substancia).
//   is_combo  -> a substancia tem '+' (o loader da cmed_pf converte o ';' da CMED em ' + ')
//   dose_norm -> so quando o par tem UMA dose distinta; senao NULL (nao escolhe por nos)
const SELECT_DERIVA = `
  with base as (
    select marca_norm, subst_norm, nullif(dose_key,'') as dose_key
      from public.cmed_pf
     where coalesce(marca_norm,'') <> '' and coalesce(subst_norm,'') <> ''
  ), pares as (
    select marca_norm, subst_norm,
           count(distinct dose_key)                          as doses,
           min(dose_key)                                     as dose_unica,
           count(*)                                          as apresentacoes
      from base group by marca_norm, subst_norm
  )
  select marca_norm,
         subst_norm                             as substancia,
         (subst_norm like '%+%')                as is_combo,
         case when doses = 1 then dose_unica end as dose_norm,
         apresentacoes
    from pares`;

(async () => {
  const c = await conecta();
  try {
    console.log(APPLY ? '[APPLY]' : '[PREVIEW — nada e gravado]');
    const { rows } = await c.query(`select count(*) n from (${SELECT_DERIVA}) x`);
    const { rows: st } = await c.query(`
      select count(*) pares,
             count(*) filter (where is_combo)                as combo,
             count(*) filter (where dose_norm is not null)   as com_dose,
             count(distinct marca_norm)                      as marcas,
             count(distinct substancia)                      as substancias
        from (${SELECT_DERIVA}) x`);
    const s = st[0];
    console.log('\n── PREVIEW ────────────────────────────────────────────');
    console.log(`pares marca x substancia .... ${s.pares}`);
    console.log(`  marcas distintas .......... ${s.marcas}`);
    console.log(`  substancias distintas ..... ${s.substancias}`);
    console.log(`  combos (nao resolvem PA) .. ${s.combo}`);
    console.log(`  com dose unica ............ ${s.com_dose}`);
    const { rows: amb } = await c.query(`
      select marca_norm, count(*) n from (${SELECT_DERIVA}) x
       group by marca_norm having count(*) > 1 order by n desc limit 5`);
    console.log(`  marcas ambiguas (o app descarta na leitura): ${amb.length ? amb.map(a => a.marca_norm + ' x' + a.n).join(' · ') : 'nenhuma'}`);
    const { rows: am } = await c.query(`select * from (${SELECT_DERIVA}) x where not is_combo and dose_norm is not null limit 3`);
    console.log('\namostra: ' + JSON.stringify(am, null, 1));

    const { rows: jt } = await c.query('select count(*) n from public.cmed_dicionario');
    console.log(`\nlinhas ja na cmed_dicionario: ${jt[0].n}`);
    if (!APPLY) { console.log('\nPreview OK. Gravar com --apply.'); return; }
    if (+jt[0].n > 0) {
      console.error('\nRECUSADO: a tabela ja tem linha. Regravar por cima apagaria dado — exige OK do Lemuel.');
      process.exit(1);
    }
    const r = await c.query(`
      insert into public.cmed_dicionario (marca_norm, substancia, dose_norm, is_combo)
      select marca_norm, substancia, dose_norm, is_combo from (${SELECT_DERIVA}) x`);
    console.log(`gravadas: ${r.rowCount}`);
    const { rows: fim } = await c.query('select count(*) n from public.cmed_dicionario');
    console.log(`total na tabela agora: ${fim[0].n}`);
  } finally { await c.end(); }
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
