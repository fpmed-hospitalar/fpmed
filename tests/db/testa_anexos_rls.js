// tests/db/testa_anexos_rls.js — PROVA, no banco real, que a VERSAO empilha sozinha e que anexo
// NAO SE APAGA nem SE EDITA.
//
// ══ AS DUAS PERGUNTAS ═══════════════════════════════════════════════════════════════════════
// 1. "Versoes empilham, nunca sobrescreve" e uma promessa que precisa de um NUMERO atras. Se a
//    tela mandasse a versao, duas abas abertas mandariam `2` ao mesmo tempo e uma sobrescreveria
//    a outra sem erro nenhum. Aqui a trigger calcula, e e isso que se testa: tres uploads na
//    mesma categoria tem que virar 1, 2, 3 — e o de OUTRA categoria volta pra 1.
// 2. "Nao se apaga" so vale se o DELETE realmente nao passar. E, como em 10/08 este projeto
//    aprendeu, o que se olha e a LINHA — nao o status da resposta.
//
// Tudo dentro de uma transacao que termina em ROLLBACK. `set local role authenticated` faz a RLS
// valer de verdade no meio dela; sem isso a conexao seria dona da tabela e mediria nada.
//
//   node tests/db/testa_anexos_rls.js
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const TMP = path.join(RAIZ, 'backups', '_anexos_rls.sql');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

const SQL = `
begin;
-- tres uploads na MESMA categoria + um em outra, todos no mesmo negocio
insert into public.negocio_anexos (negocio_id, categoria, arquivo_path, arquivo_nome, enviado_por)
  select id, 'proposta', 'x/1.pdf', 'proposta-v1.pdf', 'suite@fpmed' from public.negocios order by id limit 1;
insert into public.negocio_anexos (negocio_id, categoria, arquivo_path, arquivo_nome, enviado_por)
  select id, 'proposta', 'x/2.pdf', 'proposta-v2.pdf', 'suite@fpmed' from public.negocios order by id limit 1;
insert into public.negocio_anexos (negocio_id, categoria, arquivo_path, arquivo_nome, enviado_por)
  select id, 'proposta', 'x/3.pdf', 'proposta-v3.pdf', 'suite@fpmed' from public.negocios order by id limit 1;
insert into public.negocio_anexos (negocio_id, categoria, arquivo_path, arquivo_nome, enviado_por)
  select id, 'ata', 'x/a.pdf', 'ata-v1.pdf', 'suite@fpmed' from public.negocios order by id limit 1;

select 'VERSOES_PROPOSTA=' || string_agg(versao::text, ',' order by versao) as r
  from public.negocio_anexos where enviado_por='suite@fpmed' and categoria='proposta';
select 'VERSAO_ATA=' || string_agg(versao::text, ',') as r
  from public.negocio_anexos where enviado_por='suite@fpmed' and categoria='ata';

set local role authenticated;
delete from public.negocio_anexos where enviado_por='suite@fpmed';
update public.negocio_anexos set versao=99 where enviado_por='suite@fpmed';
reset role;

select 'SOBROU=' || count(*)::text as r from public.negocio_anexos where enviado_por='suite@fpmed';
select 'MAIOR_VERSAO=' || max(versao)::text as r from public.negocio_anexos where enviado_por='suite@fpmed';
rollback;
`;

console.log('SUITE db/testa_anexos_rls — a versao que o banco calcula, e o anexo que nao se apaga\n');

fs.mkdirSync(path.dirname(TMP), { recursive: true });
fs.writeFileSync(TMP, SQL, 'utf8');
let saida = '';
try {
  saida = execFileSync(process.execPath, [path.join(RAIZ, 'tools', 'roda_sql.js'), '--arquivo', TMP],
    { encoding: 'utf8', maxBuffer: 8 << 20 });
} catch (e) {
  // Postgres recusar o DELETE/UPDATE aborta a transacao — desfecho BOM, e nao a suite falhando.
  saida = String((e.stdout || '') + (e.stderr || ''));
}

const achou = re => (saida.match(re) || [])[1];
const versoes = achou(/VERSOES_PROPOSTA=([\d,]+)/);
const vAta = achou(/VERSAO_ATA=(\d+)/);
const sobrou = achou(/SOBROU=(\d+)/);
const maior = achou(/MAIOR_VERSAO=(\d+)/);
const recusou = /permission denied|violates row-level security|RLS/i.test(saida);

console.log('  o banco respondeu: versoes da proposta=' + versoes + ' · versao da ata=' + vAta
  + ' · sobrou=' + sobrou + ' · maior versao depois do update=' + maior
  + ' · postgres recusou=' + (recusou ? 'SIM' : 'nao'));

ok('1. *** tres uploads na mesma categoria viram versao 1, 2 e 3 (a trigger conta) ***',
  versoes === '1,2,3', { versoes });
ok('2. *** e a primeira de OUTRA categoria volta pra 1 (a contagem e por categoria) ***',
  vAta === '1', { vAta });
ok('3. *** o DELETE nao apagou nenhuma ***', recusou || sobrou === '4', { sobrou, recusou });
ok('4. *** e o UPDATE nao mudou a versao (versao que se edita nao e versao) ***',
  recusou || maior === '3', { maior, recusou });
ok('5. a prova terminou em ROLLBACK (nao sujou o banco)', /ROLLBACK/.test(saida));

try { fs.unlinkSync(TMP); } catch (e) { /* o temporario e conforto */ }
console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
