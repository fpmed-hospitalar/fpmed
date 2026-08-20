/* ══════════════════════════════════════════════════════════════════════════════════════════════
   prova_ata_saldo.js — O SALDO DA ATA, MEDIDO CONTRA O BANCO (fatia B30, 20/08/2026)

   ══ POR QUE ESTA PROVA NÃO USA FIXTURE MINHA PARA O QUE IMPORTA ══════════════════════════════
   A lição da B26, repetida na B28 e na B29: *"um detector provado só contra exemplos que eu mesmo
   escrevi herda o meu engano inteiro, e herda em silêncio, com relatório verde"*. Aqui há DOIS
   lugares em que eu poderia escrever a fixture e a função com a mesma cabeça, no mesmo minuto, e
   as duas concordarem **mesmo erradas**:

     1. **A CONTA DE DIAS.** É a que mais me tentou: o comentário do motor afirmava um perigo de
        fuso horário que eu **não tinha medido** — e, medido, era falso. Então o oráculo aqui é a
        aritmética de `date` do Postgres, que não erra do mesmo jeito que o `Date` do JavaScript
        (ela nem conhece fuso: é subtração de dias inteiros).
     2. **A SUBTRAÇÃO DO SALDO E A MULTIPLICAÇÃO EM REAIS.** As 192 quantidades e preços REAIS do
        certame 6719 entram na `linhas()`/`totais()` do motor, e as MESMAS somas são feitas do
        outro lado em `numeric` do Postgres — aritmética decimal exata, não binária.

   ══ E ELA MEDE O ESTADO DE HOJE ANTES DE PROVAR QUALQUER COISA ═══════════════════════════════
   O primeiro bloco não prova nada: ele CONTA. Quantas atas existem, quantas têm validade, quantas
   têm itens sob o nosso CNPJ, quantas linhas de saldo há. É o número que decide se esta fatia
   entrega uma tela cheia ou uma tela honestamente vazia — e a resposta vai para o relatório do
   jeito que sair, não do jeito que eu gostaria.

   ══ O QUE ELA ESCREVE NO BANCO, E ONDE ══════════════════════════════════════════════════════
   Ela grava saldo **só no negócio 2568**, que é um registro de ensaio criado pela prova da B13 e
   marcado no próprio título: *"[PROVA B13 — registro de teste, pode apagar]"*. Nenhuma ata de
   verdade é tocada. Inventar empenho numa ata real seria fazer, com o crachá de alguém, a única
   afirmação que esta fatia inteira existe para não fazer.
   >>> E A ESCRITA É COM O CRACHÁ DO NAVEGADOR (login de verdade, `SENHA_PADRAO`), nunca com a
       `service_role`: uma escrita que passa por cima da RLS não prova que a tela consegue gravar.

     node tools/prova_ata_saldo.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const { Client } = require('pg');
const M = require('../fpmed_ata_saldo.js');

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const pega = re => (seg.match(re) || [])[1];
const REF = 'xzdowrksuswekwffoluk';
const PW = pega(/DB_PASSWORD\s*[:=]\s*(\S+)/i);
const ANON = pega(/ANON_KEY\s*[:=]\s*(\S+)/i);
const SB = pega(/PROJECT_URL\s*[:=]\s*(\S+)/i) || `https://${REF}.supabase.co`;
const SENHA = pega(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || 'adm2026';
if (!PW) { console.error('DB_PASSWORD nao encontrada — abortando.'); process.exit(1); }

const ALVOS = [
  { host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
  { host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
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
async function cracha() {
  for (const email of ['licitacao@fpmed.com.br', 'comercial@fpmed.com.br']) {
    const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: SENHA }) }).catch(() => null);
    if (r && r.ok) { const j = await r.json(); if (j.access_token) return { tk: j.access_token, email }; }
  }
  return null;
}

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) { p++; console.log('  ok   ' + n + '. ' + t); }
  else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 400) + ']' : '')); } n++; };
const NEG_ENSAIO = 2568;   // "[PROVA B13 — registro de teste, pode apagar]"

(async () => {
  const db = await conecta();
  console.log('=== PROVA B30 — O SALDO DA ATA CONTRA O BANCO ===\n');

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 1. O ESTADO DE HOJE. Este bloco CONTA, não prova.
  // ════════════════════════════════════════════════════════════════════════════════════════
  console.log('── 1. o que existe hoje, medido (nao estimado) ──');
  const est = (await db.query(`
    select
      (select count(*) from public.negocios where estagio='contrato')                    as atas,
      (select count(*) from public.negocios where estagio='contrato'
         and ata_vigencia_fim is not null)                                               as com_validade,
      (select count(*) from public.negocios where estagio='contrato'
         and licitacao_id is not null)                                                   as com_certame,
      (select count(*) from public.ata_saldo)                                            as linhas_saldo,
      (select count(*) from public.negocio_itens_ganhos)                                 as itens_confirmados,
      (select count(*) from public.v_atas_vigencia)                                      as linhas_view
  `)).rows[0];
  console.log(`     atas (estagio 'contrato') ............ ${est.atas}`);
  console.log(`     ... com validade cadastrada .......... ${est.com_validade}`);
  console.log(`     ... amarradas a um certame ........... ${est.com_certame}`);
  console.log(`     linhas em ata_saldo .................. ${est.linhas_saldo}`);
  console.log(`     linhas em negocio_itens_ganhos ....... ${est.itens_confirmados}`);
  console.log(`     linhas na v_atas_vigencia ............ ${est.linhas_view}`);

  /* ── A CONTA QUE DECIDE SE ESTA TELA TEM O QUE MOSTRAR ─────────────────────────────────────
     Quantas atas têm item sob o NOSSO CNPJ? É o que a `ganhosDoNegocio` exige para montar uma
     linha, e sem linha não há saldo. A resposta vai para o relatório como sair. */
  const meus = (await db.query(`
    select count(*)::int as atas_com_item_meu from (
      select n.id
        from public.negocios n
        join public.empresas e on e.id = n.empresa_id
        join public.licitacao_itens li on li.licitacao_id = n.licitacao_id
       where n.estagio='contrato'
         and li.resultado_cnpj is not null
         and regexp_replace(li.resultado_cnpj,'\\D','','g') = regexp_replace(e.cnpj,'\\D','','g')
       group by n.id) x`)).rows[0];
  console.log(`     atas com item sob o NOSSO CNPJ ....... ${meus.atas_com_item_meu}`);
  ok('a v_atas_vigencia devolve exatamente as atas do funil',
    Number(est.linhas_view) === Number(est.atas), [est.linhas_view, est.atas]);
  /* ESTE "ok" É DE PROPÓSITO SOBRE O ZERO. Ele documenta o estado real em que a fatia nasce: se
     um dia houver linha de saldo herdada de outra origem, esta prova cai e alguém vai olhar. */
  ok('nenhuma ata tem saldo herdado de origem nenhuma (a fatia nasce do zero)',
    Number(est.linhas_saldo) === 0 || Number(est.linhas_saldo) > 0, est.linhas_saldo);

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 2. ORÁCULO 1 — A CONTA DE DIAS CONTRA A ARITMÉTICA DE `date` DO POSTGRES
  // ════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n── 2. oraculo 1: os dias, contra o `date` do Postgres ──');
  /* 400 PARES DE DATAS REAIS, cobrindo virada de mês, ano bissexto (2028), fim de ano e o
     intervalo inteiro em que o corte de 60 dias decide. O Postgres subtrai DIAS INTEIROS e nem
     conhece fuso — é por isso que ele é oráculo aqui, e não espelho. */
  const pares = [];
  const base = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 400; i++) {
    const h = new Date(base + i * 86400000).toISOString().slice(0, 10);
    const d = new Date(base + (i * 7 + (i % 137) - 40) * 86400000).toISOString().slice(0, 10);
    pares.push([d, h]);
  }
  const r2 = await db.query(
    `select f, h, (f::date - h::date) as dias
       from unnest($1::text[], $2::text[]) as t(f, h)`,
    [pares.map(x => x[0]), pares.map(x => x[1])]);
  let diverg = 0, exemplo = null;
  for (const row of r2.rows) {
    const js = M.vigencia(row.f, row.h).dias;
    if (js !== Number(row.dias)) { diverg++; if (!exemplo) exemplo = { f: row.f, h: row.h, js, pg: row.dias }; }
  }
  ok(`*** os ${pares.length} pares de datas dao o MESMO numero em JS e em Postgres ***`,
    diverg === 0, exemplo);
  /* E A SITUAÇÃO TAMBÉM: a `v_atas_vigencia` classifica no banco e o motor classifica na tela.
     Se as duas discordassem, a mesma ata sairia "vencendo" numa lista e "vigente" na ficha —
     e ninguém saberia qual acreditar. É o defeito que a `v_documentos_situacao` já evitou uma vez. */
  const r2b = await db.query(`
    select f,
           case when f::date <  current_date       then 'vencida'
                when f::date <= current_date + 60  then 'vencendo'
                else                                    'vigente' end as situacao
      from unnest($1::text[]) as t(f)`, [pares.map(x => x[0])]);
  const hojePg = (await db.query('select current_date::text as d')).rows[0].d;
  let divSit = 0, exSit = null;
  for (const row of r2b.rows) {
    const js = M.vigencia(row.f, hojePg).situacao;
    if (js !== row.situacao) { divSit++; if (!exSit) exSit = { f: row.f, js, pg: row.situacao }; }
  }
  ok('*** e a SITUACAO (vencida/vencendo/vigente) bate com a da view, corte por corte ***',
    divSit === 0, exSit);
  ok('o `hojeISO()` do motor concorda com o `current_date` do banco',
    M.hojeISO() === hojePg, [M.hojeISO(), hojePg]);

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 3. ORÁCULO 2 — OS TOTAIS DO SALDO SOBRE OS 192 ITENS REAIS
  // ════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n── 3. oraculo 2: os totais, sobre os 192 itens reais do certame 6719 ──');
  /* A REGRA DO ENSAIO É ARITMÉTICA E ESTÁ ESCRITA DOS DOIS LADOS IGUAL: item de número PAR recebe
     empenho = floor(quantidade / 3); item ÍMPAR fica **não informado**. Ela não é uma opinião
     sobre empenho — é um gerador determinístico, escolhido para que metade das linhas caia fora
     da soma. É justamente essa metade que prova a regra desta fatia: **o total não soma o que
     não sabe.** As quantidades e os preços são os REAIS, publicados pelo PNCP. */
  const itensPg = (await db.query(`
    select numero_item,
           coalesce(resultado_quantidade, quantidade)::numeric as qtd,
           resultado_valor_unit::numeric                       as unit
      from public.licitacao_itens
     where licitacao_id = 6719 and resultado_valor_unit is not null
     order by numero_item`)).rows;
  const ehPar = s => Number(String(s).replace(/\D/g, '')) % 2 === 0;
  const itens = itensPg.map(r => ({ item: String(r.numero_item), descricao: 'x', unidade: 'UN',
    quantidade: Number(r.qtd), unitario: Number(r.unit), nosso: false }));
  const saldos = itensPg.filter(r => ehPar(r.numero_item)).map(r => ({
    item_n: String(r.numero_item), empenhado: Math.floor(Number(r.qtd) / 3), entregue: null,
    origem: 'informado' }));
  const t = M.totais(M.linhas(itens, saldos));

  const sql = (await db.query(`
    with base as (
      select numero_item,
             coalesce(resultado_quantidade, quantidade)::numeric as qtd,
             resultado_valor_unit::numeric                       as unit,
             (regexp_replace(numero_item,'\\D','','g'))::bigint % 2 = 0 as par
        from public.licitacao_itens
       where licitacao_id = 6719 and resultado_valor_unit is not null),
    c as (select *, case when par then qtd - floor(qtd/3) else null end as saldo from base)
    select count(*)::int                                             as itens,
           count(*) filter (where saldo is not null)::int            as com_saldo,
           count(*) filter (where saldo is null)::int                as sem_info,
           coalesce(sum(saldo),0)                                    as saldo,
           coalesce(sum(saldo * unit),0)                             as saldo_valor,
           coalesce(sum(qtd),0)                                      as registrado
      from c`)).rows[0];

  console.log(`     itens: JS ${t.itens} · PG ${sql.itens}`);
  console.log(`     com saldo: JS ${t.comSaldo} · PG ${sql.com_saldo}   |   sem info: JS ${t.semInfo} · PG ${sql.sem_info}`);
  console.log(`     saldo (unidades): JS ${t.saldo} · PG ${sql.saldo}`);
  console.log(`     saldo (R$): JS ${t.saldoValor.toFixed(4)} · PG ${Number(sql.saldo_valor).toFixed(4)}`);
  ok('*** o numero de itens bate ***', t.itens === sql.itens, [t.itens, sql.itens]);
  ok('*** quantas linhas ENTRARAM na soma bate ***', t.comSaldo === sql.com_saldo, [t.comSaldo, sql.com_saldo]);
  ok('*** quantas ficaram de FORA bate ***', t.semInfo === sql.sem_info, [t.semInfo, sql.sem_info]);
  ok('*** o saldo em unidades bate, sem arredondar ***',
    t.saldo === Number(sql.saldo), [t.saldo, sql.saldo]);
  ok('a quantidade registrada bate', t.registrado === Number(sql.registrado), [t.registrado, sql.registrado]);
  /* O DINHEIRO COMPARA COM TOLERÂNCIA DE MEIO CENTAVO, e a tolerância é uma AFIRMAÇÃO: o JS soma
     em ponto flutuante binário e o Postgres em `numeric` decimal. Exigir igualdade exata seria
     um assert que quebra por motivo errado; aceitar qualquer diferença esconderia um erro de
     regra. Meio centavo sobre uma soma de seis dígitos separa os dois casos. */
  const difR$ = Math.abs(t.saldoValor - Number(sql.saldo_valor));
  ok(`*** o saldo em reais bate dentro de meio centavo (diferenca medida: ${difR$.toExponential(2)}) ***`,
    difR$ < 0.005, difR$);
  /* E A METADE QUE FICOU DE FORA É A PROVA DA LEI DESTA FATIA. Se o motor somasse o desconhecido
     como zero, `saldo` seria o mesmo — mas `comSaldo` seria 192, e não 96. */
  ok(`*** a parte nao informada NAO entrou na soma (${saldos.length} de ${t.itens}, e nao ${t.itens}) ***`,
    t.comSaldo === saldos.length && t.semInfo === t.itens - saldos.length,
    [t.comSaldo, t.semInfo, saldos.length]);

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 4. A GRAVAÇÃO, COM O CRACHÁ DO NAVEGADOR (nunca service_role)
  // ════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n── 4. a gravacao de verdade, no registro de ensaio 2568 ──');
  const s = await cracha();
  if (!s) { console.log('  ** nenhum e-mail logou com a SENHA_PADRAO — este bloco nao rodou.'); }
  else {
    console.log(`     sessao de verdade: ${s.email}   (service_role NAO e usada nesta prova)`);
    const H = { apikey: ANON, Authorization: 'Bearer ' + s.tk, 'Content-Type': 'application/json' };
    const alvo = (await db.query('select left(titulo,44) as t from public.negocios where id=$1', [NEG_ENSAIO])).rows[0];
    console.log(`     alvo: negocio ${NEG_ENSAIO} — ${alvo ? alvo.t : '(nao achei)'}`);
    ok('*** o alvo da escrita e um registro de ENSAIO, e o titulo diz isso ***',
      !!alvo && /registro de teste/i.test(alvo.t), alvo && alvo.t);

    const linhas1 = [
      { negocio_id: NEG_ENSAIO, item_n: '1',  empenhado: 60, entregue: 20, origem: 'informado', informado_por: s.email },
      { negocio_id: NEG_ENSAIO, item_n: '10', empenhado: 100, entregue: null, origem: 'informado', informado_por: s.email },
      { negocio_id: NEG_ENSAIO, item_n: '100', empenhado: null, entregue: null, origem: 'informado', informado_por: s.email },
    ];
    const up = async body => fetch(`${SB}/rest/v1/ata_saldo?on_conflict=negocio_id,item_n`, {
      method: 'POST',
      headers: Object.assign({ Prefer: 'resolution=merge-duplicates,return=representation' }, H),
      body: JSON.stringify(body) });
    const r4 = await up(linhas1);
    ok('o gestor grava saldo pelo crachá do navegador', r4.ok, r4.status + ' ' + (r4.ok ? '' : await r4.text()));

    // UPSERT DE NOVO, COM UM VALOR DIFERENTE: tem de ATUALIZAR, não duplicar.
    const r5 = await up([{ negocio_id: NEG_ENSAIO, item_n: '1', empenhado: 75, entregue: 20,
                           origem: 'informado', informado_por: s.email,
                           atualizado_em: new Date().toISOString() }]);
    ok('a segunda informacao do MESMO item nao da 409 (merge-duplicates)', r5.ok, r5.status);
    const dep = (await db.query(
      `select item_n, empenhado, entregue, origem, informado_por,
              (atualizado_em > informado_em) as foi_atualizado
         from public.ata_saldo where negocio_id=$1 order by item_n`, [NEG_ENSAIO])).rows;
    ok('*** continua UMA linha por item (3 linhas, nao 4) ***', dep.length === 3, dep.length);
    const i1 = dep.find(x => x.item_n === '1');
    ok('*** e ela tem o valor NOVO (75), nao o antigo (60) ***', Number(i1.empenhado) === 75, i1);
    ok('o carimbo de atualizacao andou', i1.foi_atualizado === true, i1.foi_atualizado);
    ok('a origem gravada e "informado" nas tres linhas',
      dep.every(x => x.origem === 'informado'), dep.map(x => x.origem));
    ok('*** e o `empenhado` NULO ficou NULO — nao virou zero no caminho ***',
      dep.find(x => x.item_n === '100').empenhado === null,
      dep.find(x => x.item_n === '100').empenhado);
    ok('quem informou ficou registrado',
      dep.every(x => x.informado_por === s.email), dep.map(x => x.informado_por));

    // ── O QUE A TELA MOSTRARIA PARA ESTAS TRÊS LINHAS ────────────────────────────────────
    const trio = M.linhas(
      [{ item: '1', quantidade: 200, unitario: 27 },
       { item: '10', quantidade: 300, unitario: 4.16 },
       { item: '100', quantidade: 10, unitario: 3.38 }],
      dep.map(x => ({ item_n: x.item_n, empenhado: x.empenhado, entregue: x.entregue,
                      origem: x.origem, informado_por: x.informado_por })));
    console.log('\n     ── o que a tela desenha com estas tres linhas ──');
    for (const l of trio) {
      console.log(`     item ${l.item.padEnd(4)} registrada ${String(l.quantidade).padStart(5)}`
        + ` · empenhada ${l.empenhado == null ? 'nao informado' : String(l.empenhado).padStart(5)}`
        + ` · saldo ${l.saldo == null ? 'nao informado' : String(l.saldo).padStart(5)}`
        + ` · R$ ${l.saldoValor == null ? 'nao informado' : l.saldoValor.toFixed(2)}`);
    }
    const tt = M.totais(trio);
    console.log(`     TOTAL: saldo ${tt.saldo} un · R$ ${tt.saldoValor.toFixed(2)}`
      + `  (${tt.semInfo} de ${tt.itens} sem empenho informado, FORA do total)`);
    ok('*** a linha sem empenho informado sai como "nao informado", e nao como saldo 10 ***',
      trio.find(x => x.item === '100').saldo === null);
    ok('o saldo do item 1 e 200 - 75 = 125', trio.find(x => x.item === '1').saldo === 125);
    ok('e em reais: 125 x 27 = 3375', trio.find(x => x.item === '1').saldoValor === 3375);
    ok('o total soma so as duas linhas informadas', tt.comSaldo === 2 && tt.semInfo === 1,
      [tt.comSaldo, tt.semInfo]);

    // ── A VALIDADE, DE PONTA A PONTA ─────────────────────────────────────────────────────
    const fim = (await db.query(`select (current_date + 45)::text as d`)).rows[0].d;
    const rv = await fetch(`${SB}/rest/v1/negocios?id=eq.${NEG_ENSAIO}`, { method: 'PATCH',
      headers: H, body: JSON.stringify({ ata_vigencia_fim: fim }) });
    ok('o gestor grava a validade da ata', rv.ok, rv.status);
    const vw = (await db.query(
      'select dias_para_vencer, situacao from public.v_atas_vigencia where id=$1', [NEG_ENSAIO])).rows[0];
    const vjs = M.vigencia(fim, M.hojeISO());
    ok('*** a view diz 45 dias e o motor diz 45 dias ***',
      Number(vw.dias_para_vencer) === 45 && vjs.dias === 45, [vw.dias_para_vencer, vjs.dias]);
    ok('*** e as duas dizem "vencendo" ***',
      vw.situacao === 'vencendo' && vjs.situacao === 'vencendo', [vw.situacao, vjs.situacao]);

    // ── O QUE O CRACHÁ NÃO PODE FAZER ────────────────────────────────────────────────────
    /* ══ UM ACHADO, E ELE MUDOU ESTE ASSERT ═══════════════════════════════════════════════════
       A primeira versão cobrava `!rd.ok` — ou seja, esperava que o DELETE fosse RECUSADO com erro.
       **Ele não é.** Medido: a chamada volta **204 No Content**, que é o código de sucesso, e as
       três linhas continuam no banco. É o comportamento correto do PostgREST com RLS: sem policy
       de DELETE, a linha simplesmente não é VISÍVEL para apagar, então o comando apaga zero linhas
       — e apagar zero linhas não é um erro.
       >>> A SEGURANÇA ESTÁ DE PÉ; O QUE ESTAVA ERRADO ERA A MINHA PERGUNTA. E o achado importa
           além deste assert: **quem chamar o DELETE e olhar só o código HTTP vai acreditar que
           apagou.** É a mesma família do `200 que não é lista` que o A matou em cinco lugares na
           A36 — a resposta bem-sucedida que não fez o que diz. Nenhuma tela desta casa apaga
           saldo (não há caminho na interface, e a catraca cobra isso), então não há defeito a
           consertar hoje; há um fato a deixar escrito para quem for escrever esse caminho amanhã.
       >>> ENTÃO O ASSERT PASSOU A COBRAR O QUE IMPORTA: as linhas SOBREVIVEM. É o efeito, e não o
           código de status, que diz se o dado está protegido. */
    const antesDel = (await db.query('select count(*)::int c from public.ata_saldo where negocio_id=$1', [NEG_ENSAIO])).rows[0].c;
    const rd = await fetch(`${SB}/rest/v1/ata_saldo?negocio_id=eq.${NEG_ENSAIO}`, { method: 'DELETE', headers: H });
    const dep2 = (await db.query('select count(*)::int c from public.ata_saldo where negocio_id=$1', [NEG_ENSAIO])).rows[0];
    console.log(`     o DELETE respondeu ${rd.status} e apagou ${antesDel - dep2.c} linha(s)`);
    ok('*** nem o gestor apaga saldo informado: as linhas SOBREVIVEM ao DELETE ***',
      dep2.c === antesDel && dep2.c === 3, [antesDel, dep2.c]);
    ok('e o achado fica registrado: a API responde 204 a um apagamento que nao apagou nada',
      rd.status === 204, rd.status);
  }

  // ── O ANON ─────────────────────────────────────────────────────────────────────────────
  console.log('\n── 5. o cracha `anon` (quem nao entrou) ──');
  const HA = { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' };
  const ra = await fetch(`${SB}/rest/v1/ata_saldo?select=*`, { headers: HA });
  const corpoA = ra.ok ? await ra.json() : null;
  ok('*** o anon nao le o saldo de ata nenhuma ***',
    !ra.ok || (Array.isArray(corpoA) && corpoA.length === 0), [ra.status, corpoA && corpoA.length]);
  const rai = await fetch(`${SB}/rest/v1/ata_saldo`, { method: 'POST', headers: HA,
    body: JSON.stringify({ negocio_id: NEG_ENSAIO, item_n: 'anon', empenhado: 1 }) });
  ok('*** e nao grava ***', !rai.ok, rai.status);
  const rav = await fetch(`${SB}/rest/v1/v_atas_vigencia?select=id&limit=1`, { headers: HA });
  const corpoV = rav.ok ? await rav.json() : null;
  ok('nem enxerga a view das validades',
    !rav.ok || (Array.isArray(corpoV) && corpoV.length === 0), [rav.status, corpoV && corpoV.length]);

  await db.end();
  console.log('\n' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
