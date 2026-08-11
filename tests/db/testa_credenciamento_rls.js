// tests/db/testa_credenciamento_rls.js — PROVA, no banco real, que credenciamento NAO SE APAGA
// e que o historico e escrito pelo BANCO, nao pela tela.
//
// ══ POR QUE ISTO NAO E UMA SUITE DE TEXTO ═══════════════════════════════════════════════════
// Ler o DDL e conferir que nao ha `create policy ... for delete` prova que o arquivo esta certo.
// Nao prova que o BANCO esta como o arquivo diz — em 10/08 este projeto ja leu um HTTP 204 num
// DELETE e concluiu que havia buraco na RLS, quando a tabela so estava vazia. A licao ficou:
// **olhar a LINHA, e nao o status da resposta**.
//
// ══ E POR QUE ELA NAO SUJA O BANCO ══════════════════════════════════════════════════════════
// Tudo roda dentro de UMA transacao que termina em ROLLBACK. A linha de teste existe durante a
// prova e nao existe depois. `set local role authenticated` faz a RLS valer de verdade no meio
// dela — sem isso a conexao seria dona da tabela e passaria por cima de toda policy, medindo
// exatamente nada.
//
//   node tests/db/testa_credenciamento_rls.js
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const TMP = path.join(RAIZ, 'backups', '_cred_rls.sql');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

function roda(sql) {
  fs.mkdirSync(path.dirname(TMP), { recursive: true });
  fs.writeFileSync(TMP, sql, 'utf8');
  return execFileSync(process.execPath, [path.join(RAIZ, 'tools', 'roda_sql.js'), '--arquivo', TMP],
    { encoding: 'utf8', maxBuffer: 8 << 20 });
}

console.log('SUITE db/testa_credenciamento_rls — o registro que nao se apaga\n');

// A linha nasce, muda de status quatro vezes, alguem tenta apagar como `authenticated`, e no fim
// perguntamos pela LINHA. Se ela responder, o DELETE nao passou — independente do que o DELETE
// tenha devolvido.
const SQL = `
begin;
insert into public.credenciamentos (empresa_id, industria, status, criado_por)
  select id, 'PROVA RLS LTDA', 'solicitado', 'suite@fpmed' from public.empresas order by id limit 1;

update public.credenciamentos set status='em_analise' where criado_por='suite@fpmed';
update public.credenciamentos set contato_nome='nao e status' where criado_por='suite@fpmed';
update public.credenciamentos set status='aprovado' where criado_por='suite@fpmed';

select 'HIST=' || count(*)::text as r from public.credenciamento_historico
  where credenciamento_id in (select id from public.credenciamentos where criado_por='suite@fpmed');

set local role authenticated;
delete from public.credenciamentos where criado_por='suite@fpmed';
delete from public.credenciamento_historico
  where credenciamento_id in (select id from public.credenciamentos where criado_por='suite@fpmed');
reset role;

select 'SOBROU=' || count(*)::text as r from public.credenciamentos where criado_por='suite@fpmed';
select 'HIST_SOBROU=' || count(*)::text as r from public.credenciamento_historico
  where credenciamento_id in (select id from public.credenciamentos where criado_por='suite@fpmed');
select 'STATUS=' || status as r from public.credenciamentos where criado_por='suite@fpmed';
rollback;
`;

let saida = '';
let deletePassou = false;
try {
  saida = roda(SQL);
} catch (e) {
  // >>> ERRO NO DELETE E O DESFECHO BOM. Quando o Postgres recusa por RLS ele levanta erro, e a
  //     transacao inteira aborta — entao nao ha "SOBROU=1" pra ler. Isso NAO e a suite falhando:
  //     e a prova acontecendo pelo caminho mais forte dos dois.
  saida = String((e.stdout || '') + (e.stderr || ''));
  deletePassou = false;
}

const achou = re => (saida.match(re) || [])[1];
const hist = achou(/HIST=(\d+)/);
const sobrou = achou(/SOBROU=(\d+)/);
const histSobrou = achou(/HIST_SOBROU=(\d+)/);
const recusou = /permission denied|violates row-level security|new row violates|RLS/i.test(saida);

// O QUE O BANCO RESPONDEU, IMPRESSO. Uma suite de RLS que so diz "5 ok" pede pra ser acreditada;
// quem le precisa ver o numero que a decisao usou. Verde sem numero e o verde mais caro que ha.
console.log('  o banco respondeu: historico=' + hist + ' · credenciamento sobrou=' + sobrou
  + ' · historico sobrou=' + histSobrou + ' · postgres recusou o delete=' + (recusou ? 'SIM' : 'nao'));

ok('1. *** a trigger escreveu o historico sozinha (3 mudancas de status = 3 linhas) ***',
  hist === '3', { hist, dica: 'o update de contato_nome NAO pode virar historia' });
ok('2. *** o DELETE do credenciamento NAO apagou a linha ***',
  recusou || sobrou === '1', { sobrou, recusou });
ok('3. *** o DELETE do historico NAO apagou a trilha ***',
  recusou || histSobrou === '3', { histSobrou, recusou });
ok('4. ...e o status continua o que era antes da tentativa',
  recusou || /STATUS=aprovado/.test(saida), { saida: saida.slice(-300) });
ok('5. a prova terminou em ROLLBACK (nao sujou o banco)', /ROLLBACK/.test(saida));

if (recusou) console.log('  (o Postgres RECUSOU o delete e abortou a transacao — o desfecho mais forte)');
try { fs.unlinkSync(TMP); } catch (e) { /* o arquivo temporario e conforto */ }

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
