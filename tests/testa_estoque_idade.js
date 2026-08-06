// SUITE testa_estoque_idade — SALDO VELHO E PIOR QUE SALDO AUSENTE.
//
// O QUE ESTAVA FALTANDO (Bloco 2 do sync, 05/08): a tela mostrava "1.381 no estoque FPMED" e o
// operador nao tinha como saber se aquele saldo era de ontem ou de julho. A data do ultimo
// relatorio existia — no CONTINUAR_AQUI, nao no sistema.
//
// POR QUE E CARO e nao cosmetico: com "sem estoque" o vendedor vai atras do fornecedor; com
// "12 un" de tres semanas atras ele PROMETE ao cliente e descobre na separacao que nao tem.
// O numero velho nao parece velho.
//
// A DECISAO QUE ESTA SUITE PROTEGE: NULL e "idade desconhecida", NUNCA "hoje". As 1.381 linhas
// que ja estavam no banco ficaram com NULL de proposito — ninguem sabe quando aquele saldo foi
// conferido, e backfill com a data de hoje inventaria uma frescura que o dado nao tem. Seria
// exatamente a mentira que a coluna existe pra evitar.
//
//   node tests/testa_estoque_idade.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');
function fn(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + nome + '\\s*\\(').exec(src);
  if (!m) throw new Error('nao achei function ' + nome);
  let i = src.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < src.length; j++) { if (src[j] === '{') n++; else if (src[j] === '}') { n--; if (!n) return src.slice(m.index, j + 1); } }
  throw new Error('chave nao fechou: ' + nome);
}
function konst(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:var|const|let)\\s+' + nome + '\\s*=[^;]*;').exec(src);
  if (!m) throw new Error('nao achei const ' + nome);
  return m[0];
}
const ctx = (new Function(`var document = { getElementById: function(){ return null; } };
  ${konst('EG_DIAS_VELHO')}
  ${fn('_egDataRelatorio')} ${fn('egIdade')} ${fn('egIdadeTxt')} ${fn('egEstoqueVelho')}
  return { _egDataRelatorio, egIdade, egIdadeTxt, egEstoqueVelho, EG_DIAS_VELHO };`))();
const { _egDataRelatorio, egIdade, egIdadeTxt, egEstoqueVelho, EG_DIAS_VELHO } = ctx;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_estoque_idade — a idade do saldo\n');

const iso = d => { const x = new Date(); x.setHours(12,0,0,0); x.setDate(x.getDate() - d);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };

// ══════════ 1. NULL É "NÃO SEI", NUNCA "HOJE" ══════════
ok('1. *** sem data -> idade null, nao zero ***', egIdade(null) === null, egIdade(null));
ok('2. sem data -> texto "sem data", nao "hoje"', egIdadeTxt(null) === 'sem data', egIdadeTxt(null));
ok('3. string vazia idem', egIdadeTxt('') === 'sem data', egIdadeTxt(''));
ok('4. *** sem data NAO conta como velho (nao da alarme falso nas 1.381 linhas antigas) ***',
  egEstoqueVelho(null) === false, egEstoqueVelho(null));
ok('5. ...e tambem nao conta como fresco — quem le "sem data" sabe que nao sabe', egIdadeTxt(null) !== 'hoje');
ok('6. data invalida vira "sem data" em vez de NaN na tela', egIdadeTxt('nao-e-data') === 'sem data', egIdadeTxt('nao-e-data'));

// ══════════ 2. A CONTAGEM ══════════
ok('7. hoje', egIdadeTxt(iso(0)) === 'hoje', egIdadeTxt(iso(0)));
ok('8. ontem (singular, nao "há 1 dias")', egIdadeTxt(iso(1)) === 'ontem', egIdadeTxt(iso(1)));
ok('9. anteontem', egIdadeTxt(iso(2)) === 'há 2 dias', egIdadeTxt(iso(2)));
ok('10. 30 dias', egIdadeTxt(iso(30)) === 'há 30 dias', egIdadeTxt(iso(30)));
ok('11. data no futuro nao vira "há -2 dias"', egIdadeTxt(iso(-2)) === 'hoje', egIdadeTxt(iso(-2)));

// ══════════ 3. O LIMIAR DE "VELHO" ══════════
ok('12. o limiar e 3 dias (Bloco 2)', EG_DIAS_VELHO === 3, EG_DIAS_VELHO);
ok('13. 3 dias ainda NAO e velho', egEstoqueVelho(iso(3)) === false, egEstoqueVelho(iso(3)));
ok('14. *** 4 dias JA e velho ***', egEstoqueVelho(iso(4)) === true, egEstoqueVelho(iso(4)));
ok('15. hoje nao e velho', egEstoqueVelho(iso(0)) === false);
ok('16. um mes e velho', egEstoqueVelho(iso(30)) === true);

// ══════════ 4. A DATA QUE VAI PRO BANCO É A DO RELATÓRIO ══════════
// Relatorio impresso na sexta e importado na segunda tem 3 dias de idade, e e essa idade que
// interessa. Carimbar "hoje" seria inventar frescura — o oposto do que a coluna existe pra fazer.
{
  const hoje = _egDataRelatorio();   // sem campo no DOM (o fake devolve null) -> cai em hoje
  ok('17. sem campo preenchido, usa hoje (o caso comum)', /^\d{4}-\d{2}-\d{2}$/.test(hoje), hoje);
  const h = new Date();
  const esperado = `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-${String(h.getDate()).padStart(2,'0')}`;
  ok('18. ...e e a data LOCAL, nao a UTC (em UTC-3 de madrugada o UTC ja virou o dia)', hoje === esperado, { hoje, esperado });
}

// ══════════ 5. A TELA ESTÁ MESMO USANDO ISTO ══════════
{
  ok('19. o import GRAVA estoque_em no update', /sbPatch\('cotacoes'[\s\S]{0,200}estoque_em: _egDataRelatorio\(\)/.test(src));
  ok('20. ...e no insert', /sbPost\('cotacoes'[\s\S]{0,300}estoque_em: _egDataRelatorio\(\)/.test(src));
  ok('21. existe o campo de data do relatorio na tela', /id="eg-data-relatorio"/.test(src));
  ok('22. o Comparativo carrega o estoque_em pra celula', /estoqueEm: c\.estoque_em \|\| null/.test(src));
  ok('23. a celula do estoque mostra a idade', /egIdadeTxt\(opG\.estoqueEm\)/.test(src));
  ok('24. e destaca em vermelho quando esta velho', /egEstoqueVelho\(opG\.estoqueEm\)\?'#B02A2A'/.test(src));
  ok('25. existe o aviso de espelho velho no topo da tela de estoque', /id="eg-aviso-idade"/.test(src));
  ok('26. o aviso e recalculado ao abrir a tela', /egAvisoEstoqueVelho\(\)/.test(src));
}

// ══════════ 6. O DDL NÃO FAZ BACKFILL ══════════
// Se alguem "melhorar" isto com um UPDATE carimbando hoje, as 1.381 linhas passam a mentir que
// foram conferidas na data da migracao. O teste guarda a AUSENCIA do backfill.
{
  const ddl = fs.readFileSync(path.join(__dirname, '..', 'ddl', 'estoque_em.sql'), 'utf8');
  ok('27. a coluna e aditiva e nullable', /add column if not exists estoque_em date/i.test(ddl));
  ok('28. *** o DDL NAO faz backfill (NULL e a verdade das linhas antigas) ***',
    !/update\s+public\.cotacoes\s+set\s+estoque_em/i.test(ddl));
  ok('29. e o motivo esta escrito no proprio arquivo', /inventar|frescura/i.test(ddl));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
