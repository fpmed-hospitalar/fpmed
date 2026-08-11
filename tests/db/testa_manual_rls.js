// tests/db/testa_manual_rls.js — PROVA, no banco real, que o negocio incluido a mao nasce
// COMPLETO e nao se apaga.
//
// ══ O QUE SO O BANCO RESPONDE ═══════════════════════════════════════════════════════════════
// A suite de texto confere que a tela manda os campos certos. Nao confere que o BANCO aceita —
// e o `estagio` e a `situacao` tem CHECK CONSTRAINT. Uma fase que a tela oferece e o banco recusa
// seria um formulario que da erro so no botao de salvar, depois de a pessoa digitar tudo.
// Entao aqui: cria com CADA uma das 5 fases e CADA uma das 5 situacoes, e confere que passou.
//
// E confere que DELETE nao apaga (arquivar e o caminho, como nos demais).
//
// Tudo em transacao com ROLLBACK. `set local role authenticated` faz a RLS valer de verdade.
//
//   node tests/db/testa_manual_rls.js
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const TMP = path.join(RAIZ, 'backups', '_manual_rls.sql');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

// AS MESMAS 5 FASES E 5 SITUACOES que a tela oferece. Se a tela ganhar uma sexta e o banco nao,
// esta prova fica vermelha — que e o ponto.
const FASES = ['oportunidade', 'qualificacao', 'disputa', 'classificacao', 'contrato'];
const SITS = ['normal', 'adiado', 'suspenso', 'cancelado', 'remarcado'];

const SQL = `
begin;
${FASES.map((e, i) => `insert into public.negocios (estagio, situacao, origem, criado_por, orgao, numero, arquivado)
  values ('${e}', '${SITS[i]}', 'manual', 'suite@fpmed', 'ORGAO PROVA ${i}', 'PE ${i}/2026', false);`).join('\n')}

select 'CRIADOS=' || count(*)::text as r from public.negocios where criado_por='suite@fpmed';
select 'FASES=' || string_agg(distinct estagio, ',' order by estagio) as r from public.negocios where criado_por='suite@fpmed';
select 'SITS=' || string_agg(distinct situacao, ',' order by situacao) as r from public.negocios where criado_por='suite@fpmed';
select 'ORIGEM=' || string_agg(distinct origem, ',') as r from public.negocios where criado_por='suite@fpmed';

set local role authenticated;
delete from public.negocios where criado_por='suite@fpmed';
reset role;
select 'SOBROU=' || count(*)::text as r from public.negocios where criado_por='suite@fpmed';
rollback;
`;

console.log('SUITE db/testa_manual_rls — o negocio incluido a mao nasce completo\n');

fs.mkdirSync(path.dirname(TMP), { recursive: true });
fs.writeFileSync(TMP, SQL, 'utf8');
let saida = '';
try {
  saida = execFileSync(process.execPath, [path.join(RAIZ, 'tools', 'roda_sql.js'), '--arquivo', TMP],
    { encoding: 'utf8', maxBuffer: 8 << 20 });
} catch (e) { saida = String((e.stdout || '') + (e.stderr || '')); }

const achou = re => (saida.match(re) || [])[1];
const criados = achou(/CRIADOS=(\d+)/);
const fases = achou(/FASES=([\w,]+)/);
const sits = achou(/SITS=([\w,]+)/);
const origem = achou(/ORIGEM=([\w_,]+)/);
const sobrou = achou(/SOBROU=(\d+)/);
const recusou = /permission denied|violates row-level security|RLS/i.test(saida);

console.log('  o banco respondeu: criados=' + criados + ' · fases=' + fases + ' · situacoes=' + sits
  + ' · origem=' + origem + ' · sobrou apos delete=' + sobrou + ' · postgres recusou=' + (recusou ? 'SIM' : 'nao'));

ok('1. *** as 5 fases que a tela oferece sao aceitas pelo banco ***', criados === '5', { criados, saida: saida.slice(-300) });
ok('2. ...e sao exatamente as 5', fases === FASES.slice().sort().join(','), { fases });
ok('3. *** as 5 situacoes tambem ***', sits === SITS.slice().sort().join(','), { sits });
ok('4. *** a origem grava como `manual` ***', origem === 'manual', { origem });
ok('5. *** e o DELETE nao apaga (arquivar e o caminho) ***', recusou || sobrou === '5', { sobrou, recusou });
ok('6. a prova terminou em ROLLBACK (nao sujou o banco)', /ROLLBACK/.test(saida));

try { fs.unlinkSync(TMP); } catch (e) { /* o temporario e conforto */ }
console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
