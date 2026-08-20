/* ══════════════════════════════════════════════════════════════════════════════════════════════
   prova_piso.js — A CALCULADORA DE PISO, MEDIDA CONTRA O BANCO (fatia B29, 20/08/2026)

   ══ POR QUE ESTA PROVA NÃO USA FIXTURE MINHA PARA O QUE IMPORTA ═════════════════════════════
   A lição da B26, repetida na B28: *"um detector provado só contra exemplos que eu mesmo escrevi
   herda o meu engano inteiro, e herda em silêncio, com relatório verde"*. Se eu escrevesse a
   fixture e a função na mesma hora, as duas concordariam **mesmo erradas**.
   Então esta prova tem TRÊS oráculos, e nenhum dos três é um exemplo meu:

     1. **O POSTGRES.** Os 7.416 custos de compra REAIS da tabela `cotacoes` entram na função do
        motor, e o MESMO piso é calculado do outro lado, em `numeric` do Postgres. O banco não
        erra do mesmo jeito que o JavaScript — e a aritmética dele é decimal exata, não binária.

     2. **UMA IDENTIDADE.** No piso, o que sobra depois do imposto tem de ser EXATAMENTE o custo:
        `piso × (1 − alíq) − (custo + frete + rateio) = 0`. Identidade não concorda comigo por
        engano; ou fecha, ou não fecha.

     3. **O PRÓPRIO BANCO, sobre o que existe.** Quantos itens têm custo, quantos não têm, e qual
        é o custo mais alto e o mais baixo — nada estimado, nada arredondado.

   ══ O QUE ESTA PROVA NÃO FAZ, E É A DECISÃO MAIS IMPORTANTE DELA ════════════════════════════
   Ela **não grava parâmetro nenhum** na `operacao_parametros`. A tabela nasceu e continua vazia,
   e é isso que ela mede primeiro. Gravar uma alíquota de ensaio para "provar a tela funcionando"
   deixaria a Proposta mostrando piso calculado sobre um regime tributário que eu inventei — que é
   **exatamente** o que a lei desta fatia proíbe. Piso chutado é pior que piso ausente.
   Os parâmetros usados na aritmética são passados EM MEMÓRIA e vão impressos como o que são:
   valores de ensaio, declarados na saída, que não tocam o banco.

     node tools/prova_piso.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const { Client } = require('pg');
const P = require('../fpmed_piso.js');

const REF = 'xzdowrksuswekwffoluk';
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const mp = seg.match(/DB_PASSWORD\s*[:=]\s*(\S+)/i);
if (!mp) { console.error('DB_PASSWORD nao encontrada — abortando.'); process.exit(1); }
const PW = mp[1];
const ALVOS = [
  { nome: 'direta', host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
  { nome: 'pooler', host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
];
async function conecta() {
  let ultimo;
  for (const a of ALVOS) {
    const c = new Client({ host: a.host, port: a.port, user: a.user, password: PW, database: 'postgres',
      ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    try { await c.connect(); return c; } catch (e) { ultimo = e; try { await c.end(); } catch (_) {} }
  }
  throw ultimo;
}

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) { p++; console.log('  ok   ' + n + '. ' + t); }
  else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 400) + ']' : '')); } n++; };
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 });

/* ── OS PARÂMETROS DE ENSAIO ─────────────────────────────────────────────────────────────────
   ELES NÃO SÃO OS DA FPMED e não vão para o banco. Servem para exercer a aritmética contra os
   custos REAIS; o regime tributário verdadeiro é fato da contabilidade da empresa e está na lista
   de pendências do dono. Os números são redondos de propósito, para que qualquer um refaça a
   conta na calculadora e discorde de mim se eu estiver errado. */
const ENSAIO = {
  tributos: { componente: 'tributos', vigencia_inicio: '2026-01-01', regime: 'simples', aliquota_pct: 10 },
  frete:    { componente: 'frete',    vigencia_inicio: '2026-01-01', frete_tipo: 'pct', frete_valor: 5 },
  rateio:   { componente: 'rateio',   vigencia_inicio: '2026-01-01', custo_fixo_mensal: 20000, volume_mensal: 100000 },
};

(async () => {
  const c = await conecta();
  console.log('PROVA prova_piso — a calculadora de piso, contra o banco\n');

  // ══ 1. O QUE EXISTE HOJE, MEDIDO ═══════════════════════════════════════════════════════════
  console.log('── 1. a base de custo, medida (nada estimado) ──');
  const base = (await c.query(`
    select count(*)                                              as total,
           count(*) filter (where compra_unit is not null)       as nao_nulo,
           count(*) filter (where compra_unit > 0)               as usavel,
           count(*) filter (where compra_unit is not null and not (compra_unit > 0)) as zero_gravado,
           count(*) filter (where markup is not null)            as com_markup,
           count(*) filter (where regra  is not null)            as com_regra
      from cotacoes`)).rows[0];
  console.log('     cotações .................. ' + base.total);
  console.log('     com compra_unit NÃO NULO .. ' + base.nao_nulo);
  console.log('     com compra_unit > 0 ....... ' + base.usavel + '   <- a base de custo de verdade');
  console.log('     com ZERO gravado .......... ' + base.zero_gravado + '   <- zero é um número, e número se acredita');
  console.log('     com markup ................ ' + base.com_markup);
  console.log('     com regra ................. ' + base.com_regra);
  /* ══ A CORREÇÃO QUE A MEDIÇÃO IMPÔS ═════════════════════════════════════════════════════════
     A caixa diz "7.417 de 8.832 (84%) — a base de custo existe". O banco diz 7.417 com o campo
     PREENCHIDO e **7.416 com custo de verdade**: uma linha tem `compra_unit = 0` (id 3098, SAIS
     P/REIDRATACAO ORAL 27,9GR, DISMASTER, com `compra_caixa` zero também).
     >>> E ESSA UMA LINHA É EXATAMENTE O DEFEITO QUE A FATIA EXISTE PARA NÃO COMETER. Se o motor
         aceitasse zero como custo, o piso daquele item sairia `(0 + frete + rateio) ÷ (1 − alíq)`
         — o MENOR piso do sistema inteiro, num item de reidratação oral, com cara de conta feita.
         É a mesma lição do `valor_unitario_ref` (7.456 itens com zero escritos como se fossem
         preço) e do `resultado_valor_unit` da B28. Terceira vez no mesmo banco. */
  ok('a base de custo usável são ' + base.usavel + ' de ' + base.total + ' (e não ' + base.nao_nulo + ')',
    Number(base.usavel) === Number(base.nao_nulo) - Number(base.zero_gravado));
  ok('*** o motor RECUSA o custo zero (senão ele viraria o menor piso do sistema) ***',
    P.calcular({ custoUnit: 0, params: ENSAIO }).ok === false
    && P.calcular({ custoUnit: 0, params: ENSAIO }).motivo === 'sem_custo');
  ok('...e recusa custo nulo do mesmo jeito',
    P.calcular({ custoUnit: null, params: ENSAIO }).motivo === 'sem_custo');

  // ══ 2. A TABELA NASCEU VAZIA, E A TELA TEM DE DIZER ISSO ═══════════════════════════════════
  console.log('\n── 2. sem parâmetro não há piso (a lei da fatia) ──');
  const par = (await c.query('select componente, count(*) as n from operacao_parametros where ativo group by 1')).rows;
  console.log('     linhas em operacao_parametros: ' + (par.length ? JSON.stringify(par) : 'NENHUMA'));
  const vazio = P.vigentes(par.length ? [] : [], P.hojeISO());
  const faltam = P.faltas(vazio);
  ok('*** com a tabela vazia, faltam os TRÊS componentes, com nome ***',
    faltam.length === 3 && faltam.every(x => x.falta && x.falta.length > 8), faltam.map(x => x.rotulo));
  const semPar = P.avaliar({ custoUnit: 10, precoUnit: 20, params: vazio });
  ok('*** e `avaliar` devolve `sem_parametro` com piso NULL — nunca R$ 0,00 ***',
    semPar.estado === 'sem_parametro' && semPar.piso === null, semPar);
  /* MEIO PARÂMETRO NÃO É MEIO PISO. O rateio sem volume é uma divisão por nada; a alíquota de 100%
     é um divisor zero. Os dois têm de contar como "falta", e não sair como número absurdo. */
  ok('*** rateio com volume ZERO conta como parâmetro que FALTA (não vira piso infinito) ***',
    P.faltas({ tributos: ENSAIO.tributos, frete: ENSAIO.frete,
      rateio: { custo_fixo_mensal: 1, volume_mensal: 0 } }).length === 1);
  ok('*** alíquota de 100% conta como parâmetro que FALTA (o divisor seria zero) ***',
    P.faltas({ tributos: { regime: 'real', aliquota_pct: 100 }, frete: ENSAIO.frete, rateio: ENSAIO.rateio }).length === 1);

  // ══ 3. A CONTA CERTA CONTRA A CONTA INTUITIVA ══════════════════════════════════════════════
  console.log('\n── 3. o imposto DIVIDE, não multiplica ──');
  const cem = P.calcular({ custoUnit: 100, params: { tributos: { regime: 'simples', aliquota_pct: 10 },
    frete: { frete_tipo: 'valor', frete_valor: 0 }, rateio: { custo_fixo_mensal: 0, volume_mensal: 1 } } });
  console.log('     custo 100, alíquota 10%  ->  piso ' + brl(cem.piso));
  console.log('     a conta intuitiva (×1,10) daria ' + brl(110) + ', e a 110 o imposto é '
    + brl(11) + ': sobram ' + brl(99) + ' para pagar 100. Prejuízo de ' + brl(1) + '.');
  ok('*** o piso é 111,111… e não 110 ***', Math.abs(cem.piso - 1000 / 9) < 1e-9, cem.piso);
  ok('*** e a 111,111… sobra EXATAMENTE 100 depois do imposto ***',
    Math.abs(cem.piso * 0.9 - 100) < 1e-9, cem.piso * 0.9);
  const real25 = P.calcular({ custoUnit: 100, params: { tributos: { regime: 'real', aliquota_pct: 25 },
    frete: { frete_tipo: 'valor', frete_valor: 0 }, rateio: { custo_fixo_mensal: 0, volume_mensal: 1 } } });
  const erroPct = (1 - 125 / real25.piso) * 100;
  console.log('     no Lucro Real a 25%: certo ' + brl(real25.piso) + ' · intuitivo ' + brl(125)
    // vírgula, como todo número desta casa — inclusive nos relatórios de prova (lição da B28)
    + '  ->  o intuitivo fica ' + erroPct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    + '% ABAIXO do piso');
  ok('*** com 25% o erro intuitivo é 6,25% abaixo do piso (e isso é a margem inteira) ***',
    Math.abs(erroPct - 6.25) < 0.001, erroPct);

  // ══ 4. TRÊS ITENS REAIS, A CONTA CONFERIDA CONTRA O SQL ════════════════════════════════════
  console.log('\n── 4. três itens reais, conferidos contra o SQL ──');
  const tres = (await c.query(`
    select id, produto, compra_unit from cotacoes where id in (1, 3, 775) order by id`)).rows;
  const a = Number(ENSAIO.tributos.aliquota_pct) / 100;
  const fr = Number(ENSAIO.frete.frete_valor) / 100;
  const rt = Number(ENSAIO.rateio.custo_fixo_mensal) / Number(ENSAIO.rateio.volume_mensal);
  for (const it of tres) {
    const meu = P.calcular({ custoUnit: it.compra_unit, params: ENSAIO });
    // O ORÁCULO: a MESMA conta, escrita em SQL, em `numeric` (decimal exato), do outro lado.
    const sql = (await c.query(
      `select ( $1::numeric * (1 + $2::numeric) + $3::numeric ) / (1 - $4::numeric) as piso,
              $1::numeric * $2::numeric as frete, $3::numeric as rateio`,
      [it.compra_unit, fr, rt, a])).rows[0];
    const dif = Math.abs(meu.piso - Number(sql.piso));
    console.log('     #' + it.id + ' ' + String(it.produto).slice(0, 38).padEnd(38)
      + ' custo ' + brl(it.compra_unit).padStart(18)
      + '  motor ' + brl(meu.piso).padStart(18) + '  banco ' + brl(sql.piso).padStart(18));
    ok('#' + it.id + ': o motor e o Postgres dão o mesmo piso', dif < 1e-9 * Math.max(1, meu.piso), { meu: meu.piso, banco: sql.piso, dif });
    ok('#' + it.id + ': as parcelas SOMAM o piso (a conta que a tela mostra fecha)',
      Math.abs(meu.parcelas.compra + meu.parcelas.frete + meu.parcelas.rateio + meu.parcelas.impostos - meu.piso) < 1e-9,
      meu.parcelas);
    ok('#' + it.id + ': *** no piso, o que sobra depois do imposto é o custo (identidade) ***',
      Math.abs(meu.piso * (1 - a) - meu.parcelas.custoTotal) < 1e-9);
    ok('#' + it.id + ': o piso EXIBIDO nunca é menor que o calculado (arredonda para cima)',
      meu.pisoCentavos >= meu.piso - 1e-12 && meu.pisoCentavos - meu.piso < 0.01,
      { piso: meu.piso, exibido: meu.pisoCentavos });
  }

  // ══ 5. A IDENTIDADE SOBRE OS 7.416 CUSTOS REAIS ════════════════════════════════════════════
  console.log('\n── 5. a identidade sobre TODOS os custos reais ──');
  const todos = (await c.query('select id, compra_unit from cotacoes where compra_unit > 0 order by id')).rows;
  let piorId = null, pior = 0, piorSql = 0, piorSqlId = null;
  // O oráculo do Postgres para os 7.416 de uma vez: ele devolve o piso de cada linha em `numeric`.
  const sqlTodos = (await c.query(
    `select id, ( compra_unit * (1 + $1::numeric) + $2::numeric ) / (1 - $3::numeric) as piso
       from cotacoes where compra_unit > 0 order by id`, [fr, rt, a])).rows;
  const mapaSql = new Map(sqlTodos.map(r => [String(r.id), Number(r.piso)]));
  for (const l of todos) {
    const r = P.calcular({ custoUnit: l.compra_unit, params: ENSAIO });
    if (!r.ok) { piorId = l.id; pior = Infinity; break; }
    const d = Math.abs(r.piso * (1 - a) - r.parcelas.custoTotal) / Math.max(1, r.parcelas.custoTotal);
    if (d > pior) { pior = d; piorId = l.id; }
    const ds = Math.abs(r.piso - mapaSql.get(String(l.id))) / Math.max(1, r.piso);
    if (ds > piorSql) { piorSql = ds; piorSqlId = l.id; }
  }
  console.log('     linhas exercidas ................ ' + todos.length);
  console.log('     pior desvio da identidade ....... ' + pior.toExponential(3) + ' (cotação ' + piorId + ')');
  console.log('     pior desvio contra o Postgres ... ' + piorSql.toExponential(3) + ' (cotação ' + piorSqlId + ')');
  ok('*** a identidade fecha nas ' + todos.length + ' linhas reais (desvio < 1e-12) ***', pior < 1e-12, { pior, piorId });
  ok('*** o motor bate com o Postgres nas ' + todos.length + ' linhas reais (desvio < 1e-12) ***',
    piorSql < 1e-12, { piorSql, piorSqlId });

  // ══ 6. O ITEM SEM CUSTO, E O ITEM ABAIXO DO PISO ═══════════════════════════════════════════
  console.log('\n── 6. o estado honesto e o sinal de perigo ──');
  const semCusto = (await c.query(
    `select id, produto, compra_unit from cotacoes where compra_unit is not null and not (compra_unit > 0)`)).rows;
  for (const s of semCusto) {
    const r = P.avaliar({ custoUnit: s.compra_unit, precoUnit: 5, params: ENSAIO });
    console.log('     #' + s.id + ' ' + String(s.produto).slice(0, 40) + '  compra_unit=' + s.compra_unit
      + '  ->  estado "' + r.estado + '", piso ' + r.piso);
    ok('#' + s.id + ': *** item com custo zero sai "sem_custo", com piso NULL ***',
      r.estado === 'sem_custo' && r.piso === null, r);
    ok('#' + s.id + ': e ele fica FORA de qualquer soma de margem (folga null, não 0%)',
      r.folgaPct === null || r.folgaPct === undefined);
  }
  const est = P.avaliar({ custoUnit: null, custoEstimado: true, precoUnit: 30, params: ENSAIO });
  ok('*** custo ESTIMADO (venda ÷ 1,25 do GLOBAL) também não vira piso ***',
    est.estado === 'custo_estimado' && est.piso === null, est);

  const alvo = (await c.query('select id, produto, compra_unit from cotacoes where id = 3')).rows[0];
  const piso3 = P.calcular({ custoUnit: alvo.compra_unit, params: ENSAIO }).piso;
  const abaixo = P.avaliar({ custoUnit: alvo.compra_unit, precoUnit: piso3 * 0.9, unidades: 40000, params: ENSAIO });
  console.log('     #' + alvo.id + ' ' + String(alvo.produto).slice(0, 40));
  console.log('       piso ' + brl(piso3) + ' · proposto ' + brl(piso3 * 0.9)
    + '  ->  perde ' + brl(abaixo.prejuizoUnit) + '/un · ' + brl(abaixo.prejuizoTotal) + ' em 40.000 un');
  ok('*** abaixo do piso, o motor devolve o prejuízo POR UNIDADE, com número ***',
    abaixo.abaixo === true && Math.abs(abaixo.prejuizoUnit - piso3 * 0.1) < 1e-9, abaixo.prejuizoUnit);
  ok('*** e o prejuízo TOTAL do item, que é o número do tamanho da decisão ***',
    Math.abs(abaixo.prejuizoTotal - abaixo.prejuizoUnit * 40000) < 1e-6, abaixo.prejuizoTotal);
  ok('sem saber a quantidade, o prejuízo total é null — e nunca zero',
    P.avaliar({ custoUnit: alvo.compra_unit, precoUnit: piso3 * 0.9, params: ENSAIO }).prejuizoTotal === null);
  ok('exatamente NO piso não é "abaixo" (a fronteira não escorrega)',
    P.avaliar({ custoUnit: alvo.compra_unit, precoUnit: piso3, params: ENSAIO }).abaixo === false);

  // ══ 7. A VIGÊNCIA: O MOTOR E O BANCO ESCOLHEM A MESMA LINHA ════════════════════════════════
  console.log('\n── 7. qual parâmetro vale numa data: motor x Postgres ──');
  /* DUAS IMPLEMENTAÇÕES DA MESMA PERGUNTA, e por isso elas têm de ser conferidas uma contra a
     outra: a `v_operacao_parametros_vigentes` usa `distinct on ... order by desc` e o motor usa um
     laço com comparação de texto ISO. São estruturas diferentes, escritas em linguagens
     diferentes — o tipo de par em que um erro de fronteira (`<` no lugar de `<=`) aparece.
     >>> A LINHA QUE COMEÇA HOJE TEM DE VALER HOJE. É o caso que o `<` erraria, e ele custaria um
         dia inteiro de piso ausente sem sintoma nenhum. */
  const hoje = P.hojeISO();
  const linhas = [
    { componente: 'tributos', vigencia_inicio: '2026-01-01', regime: 'simples', aliquota_pct: 6, ativo: true },
    { componente: 'tributos', vigencia_inicio: hoje,         regime: 'presumido', aliquota_pct: 11, ativo: true },
    { componente: 'tributos', vigencia_inicio: '2099-01-01', regime: 'real', aliquota_pct: 25, ativo: true },
  ];
  const escolhaMotor = P.vigentes(linhas, hoje).tributos;
  const escolhaBanco = (await c.query(`
    select distinct on (componente) componente, vigencia_inicio, regime, aliquota_pct
      from (values ('tributos','2026-01-01'::date,'simples',6::numeric),
                   ('tributos',$1::date,'presumido',11::numeric),
                   ('tributos','2099-01-01'::date,'real',25::numeric))
             as t(componente, vigencia_inicio, regime, aliquota_pct)
     where vigencia_inicio <= current_date
     order by componente, vigencia_inicio desc`, [hoje])).rows[0];
  console.log('     motor -> ' + escolhaMotor.regime + ' ' + escolhaMotor.aliquota_pct + '% (desde ' + escolhaMotor.vigencia_inicio + ')');
  console.log('     banco -> ' + escolhaBanco.regime + ' ' + escolhaBanco.aliquota_pct + '%');
  ok('*** os dois escolhem a MESMA linha, e é a que começa HOJE ***',
    escolhaMotor.regime === escolhaBanco.regime && Number(escolhaMotor.aliquota_pct) === Number(escolhaBanco.aliquota_pct)
    && escolhaMotor.regime === 'presumido', { motor: escolhaMotor.regime, banco: escolhaBanco.regime });
  ok('...e a vigência FUTURA não vale hoje (senão a alíquota de 2099 já estaria no preço)',
    escolhaMotor.aliquota_pct !== 25);
  const ontem = P.vigentes(linhas, '2026-06-15').tributos;
  ok('*** e uma proposta de 15/06 continua explicável: ela pega a alíquota de junho ***',
    ontem.aliquota_pct === 6, ontem);

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  console.log('\n>>> TERMÔMETRO: `operacao_parametros` tem ' + (par.length ? par.map(x => x.componente + '=' + x.n).join(' · ') : 'ZERO linha')
    + '. Enquanto for zero, a Proposta NÃO mostra piso — e isso é a fatia funcionando, não falhando.');
  console.log('>>> Os parâmetros usados na aritmética acima são DE ENSAIO (Simples 10% · frete 5% '
    + '· R$ 20.000 ÷ 100.000 un) e NÃO foram gravados. O regime real é da contabilidade da FPMED.');
  await c.end();
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
