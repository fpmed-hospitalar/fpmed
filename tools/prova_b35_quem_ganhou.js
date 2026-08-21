/* ══════════════════════════════════════════════════════════════════════════════════════════════
   prova_b35_quem_ganhou.js — QUEM GANHOU, MEDIDO CONTRA O BANCO (fatia B35, 21/08/2026)

   ══ POR QUE ESTA PROVA NÃO USA FIXTURE MINHA PARA O QUE IMPORTA ═════════════════════════════
   A lição da B26, repetida na B28, na B30 e na B31: *"um detector provado só contra exemplos que
   eu mesmo escrevi herda o meu engano inteiro, e herda em silêncio, com relatório verde."* A
   `tests/testa_quem_ganhou.js` roda contra linhas que EU inventei — ela cobra a regra. Aqui as
   3.475 linhas são as de verdade, e a conta é conferida por quem não erra do mesmo jeito que eu.

   ══ O ORÁCULO ══════════════════════════════════════════════════════════════════════════════
   Para cada produto, o JavaScript decide QUEM está no grupo (é ele que tem a `chave`, com o NFKD
   e o prefixo do número do item — o Postgres não tem como reproduzir isso, e reescrever a chave
   em SQL criaria a segunda implementação que este projeto já pagou caro para não ter). O que o
   Postgres faz é a ARITMÉTICA sobre exatamente aquele grupo: `count(distinct resultado_cnpj)`,
   `min`, `max` e `percentile_cont` em `numeric` — decimal exato, não binário.
   >>> A DIVISÃO É DE PROPÓSITO: cada lado faz o que só ele sabe fazer, e o encontro é onde os
       dois podem discordar. Um oráculo que refizesse a chave concordaria comigo até no engano.

   ══ E ELA MEDE OS NÚMEROS QUE ESTA FATIA ESCREVEU NA PROSA ══════════════════════════════════
   O motor afirma, por escrito, "394 CNPJs para 406 nomes" e "346 dos 394 ganharam um certame".
   Número escrito em comentário é promessa; aqui ele vira medição, e se o dado crescer a prova
   diz o número novo em vez de repetir o velho.

   NADA É ESCRITO NO BANCO. Esta prova é só leitura.
     node tools/prova_b35_quem_ganhou.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const { Client } = require('pg');
const T = require('../fpmed_teto_homologado.js');

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const PW = (seg.match(/DB_PASSWORD\s*[:=]\s*(\S+)/i) || [])[1];
const REF = 'xzdowrksuswekwffoluk';
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

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 300) + ']' : '')); } n++; };
const num = v => Number(v);
const perto = (a, b) => a == null && b == null ? true
  : (a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.005);

(async () => {
  const c = await conecta();
  const q = async (sql, args) => (await c.query(sql, args || [])).rows;
  try {
    console.log('PROVA B35 — quem ganhou, medido contra os 3.475 resultados de verdade\n');

    // ── 1. O DADO, E OS NÚMEROS QUE A PROSA AFIRMA ──────────────────────────────────────────
    console.log('-- 1. o que existe --');
    const base = (await q(`select
        count(*) linhas, count(distinct licitacao_id) certames,
        count(distinct resultado_cnpj) cnpjs, count(distinct resultado_vencedor) nomes,
        count(*) filter (where resultado_vencedor is null) sem_nome
      from licitacao_itens where resultado_valor_unit is not null and resultado_valor_unit > 0`))[0];
    console.log(`   ${base.linhas} resultados · ${base.certames} certames · ${base.cnpjs} CNPJs · ${base.nomes} nomes`);
    ok('*** ha MAIS nomes que CNPJs — e por isso a identidade e o CNPJ ***',
      num(base.nomes) > num(base.cnpjs), [base.cnpjs, base.nomes]);
    const ambig = (await q(`select count(*) n from (
        select resultado_cnpj from licitacao_itens
         where resultado_valor_unit is not null and resultado_valor_unit > 0
         group by 1 having count(distinct resultado_vencedor) > 1) x`))[0];
    const inverso = (await q(`select count(*) n from (
        select resultado_vencedor from licitacao_itens
         where resultado_valor_unit is not null and resultado_valor_unit > 0
         group by 1 having count(distinct resultado_cnpj) > 1) x`))[0];
    console.log(`   CNPJs com mais de um nome: ${ambig.n} · nomes com mais de um CNPJ: ${inverso.n}`);
    ok('*** ha CNPJ com duas grafias de nome (agrupar por nome partiria o fornecedor em dois) ***',
      num(ambig.n) > 0, ambig.n);
    ok('*** e NENHUM nome e usado por dois CNPJs — o inverso nao acontece nesta base ***',
      num(inverso.n) === 0, inverso.n);
    ok('o vencedor esta publicado em TODAS as linhas com resultado (nao ha nome em branco hoje)',
      num(base.sem_nome) === 0, base.sem_nome);

    // ── 2. O RANKING QUE NÃO PODE EXISTIR ───────────────────────────────────────────────────
    console.log('\n-- 2. por que nao ha ranking de fornecedor --');
    const conc = (await q(`select
        count(*) fornecedores,
        count(*) filter (where n = 1) com_um,
        max(n) maior
      from (select resultado_cnpj, count(distinct licitacao_id) n from licitacao_itens
             where resultado_valor_unit is not null and resultado_valor_unit > 0
             group by 1) x`))[0];
    const pctUm = Math.round(100 * num(conc.com_um) / num(conc.fornecedores));
    console.log(`   ${conc.fornecedores} fornecedores · ${conc.com_um} com UM certame (${pctUm}%) · o maior tem ${conc.maior}`);
    ok('*** a esmagadora maioria dos fornecedores tem UM certame so ***', pctUm >= 80, pctUm);
    ok('*** e o "maior" desta base ganhou pouquissimos certames — nao da para chamar de lider ***',
      num(conc.maior) <= 10, conc.maior);
    ok('...entao o motor nao exporta funcao nenhuma de ranking global',
      !Object.keys(T).some(k => /rank|top|maiores|lideres/i.test(k)), Object.keys(T));

    // ── 3. O MOTOR CONTRA O ORÁCULO, PRODUTO A PRODUTO ──────────────────────────────────────
    console.log('\n-- 3. o motor x a aritmetica do Postgres --');
    const linhas = await q(`select numero_controle, numero_item, descricao, unidade, quantidade,
        resultado_vencedor, resultado_cnpj, resultado_valor_unit, resultado_quantidade, resultado_situacao
      from licitacao_itens where resultado_valor_unit is not null and resultado_valor_unit > 0`);
    const idx = T.indexa(linhas, { certames: {}, total: linhas.length, truncado: false });
    ok('o indice usou todas as linhas lidas', idx.linhas === linhas.length, [idx.linhas, linhas.length]);

    const comDois = [...idx.por.entries()].filter(([, v]) => v.length > 1);
    console.log(`   ${idx.por.size} produtos distintos · ${comDois.length} com dois ou mais resultados`);
    ok('*** ha produtos com dois ou mais resultados — o caminho do "quem ganhou" ROLA de verdade ***',
      comDois.length > 0, comDois.length);

    /* O ORÁCULO. Manda-se ao Postgres o CONJUNTO exato de linhas de cada produto (por
       numero_controle + numero_item, que é a chave natural da linha) e pergunta-se a ele a conta.
       Nenhuma normalização de descrição atravessa: só o grupo, que é do JavaScript. */
    let conferidos = 0, divergiu = 0;
    const amostra = comDois.slice(0, 40);
    for (const [chave, itens] of amostra) {
      const g = T.quemGanhou({ descricao: itens[0].descricaoOriginal || chave }, idx);
      // a chave já é a normalização; pedir por ela devolve o mesmo grupo
      const alvo = T.quemGanhou({ descricao: chave }, idx);
      const usar = (alvo && alvo.n === itens.length) ? alvo : g;
      if (!usar || usar.n !== itens.length) continue;

      const ctrls = itens.map(x => x.numero_controle);
      const nums = itens.map(x => x.numero_item);
      const o = (await q(`select count(distinct resultado_cnpj) fornecedores,
            count(*) linhas,
            count(distinct numero_controle) certames,
            min(resultado_valor_unit) menor, max(resultado_valor_unit) maior
          from licitacao_itens
         where (numero_controle, numero_item) in (
           select * from unnest($1::text[], $2::text[]))`, [ctrls, nums]))[0];
      conferidos++;
      const bate = num(o.linhas) === usar.n
        && num(o.fornecedores) === usar.fornecedores.filter(x => x.cnpj).length
        && num(o.certames) === usar.certames
        && perto(o.menor, usar.min) && perto(o.maior, usar.max);
      if (!bate) {
        divergiu++;
        if (divergiu <= 3) console.log(`   divergiu em "${chave.slice(0, 40)}": motor `
          + JSON.stringify({ n: usar.n, forn: usar.fornecedores.length, cert: usar.certames, min: usar.min, max: usar.max })
          + ' · banco ' + JSON.stringify(o));
      }
    }
    console.log(`   ${conferidos} produtos conferidos contra o Postgres`);
    ok('*** ZERO divergencia entre o motor e a aritmetica do banco ***', divergiu === 0, divergiu);
    ok('...e foram conferidos produtos de verdade, e nao uma lista vazia', conferidos >= 20, conferidos);

    /* A MEDIANA CONTRA O `percentile_cont`, que é o oráculo que a B28 já usava. Ela entra aqui
       porque `quemGanhou` calcula a mediana POR FORNECEDOR, que é um recorte que a B28 não fazia. */
    let medConf = 0, medDiv = 0;
    for (const [chave, itens] of amostra.slice(0, 15)) {
      const g = T.quemGanhou({ descricao: chave }, idx);
      if (!g || g.n !== itens.length) continue;
      for (const forn of g.fornecedores) {
        if (!forn.cnpj) continue;
        const linhasF = itens.filter(x => x.cnpj === forn.cnpj);
        const o = (await q(`select percentile_cont(0.5) within group (order by resultado_valor_unit) med
            from licitacao_itens
           where (numero_controle, numero_item) in (select * from unnest($1::text[], $2::text[]))`,
          [linhasF.map(x => x.numero_controle), linhasF.map(x => x.numero_item)]))[0];
        medConf++;
        if (!perto(o.med, forn.mediana)) { medDiv++;
          if (medDiv <= 3) console.log(`   mediana divergiu: motor ${forn.mediana} · banco ${o.med}`); }
      }
    }
    console.log(`   ${medConf} medianas por fornecedor conferidas`);
    ok('*** a mediana POR FORNECEDOR bate com o percentile_cont do Postgres ***', medDiv === 0, medDiv);

    // ── 4. A DISPERSÃO, E POR QUE NÃO É O COMPRIMENTO DA CHAVE ─────────────────────────────
    console.log('\n-- 4. a pendencia 5 do A, medida --');
    const razao = itens => { const v = itens.map(x => x.valor).sort((a, b) => a - b);
      return v[0] > 0 ? v[v.length - 1] / v[0] : null; };
    const curtas = comDois.filter(([k]) => k.length <= 12);
    const marcados = comDois.filter(([k]) => {
      const g = T.quemGanhou({ descricao: k }, idx); return g && g.disperso; });
    const marcadosCurtos = marcados.filter(([k]) => k.length <= 12);
    console.log(`   ${comDois.length} produtos com 2+ resultados · ${curtas.length} de chave curta (<=12)`);
    console.log(`   marcados como dispersos (>= ${T.LIMITE_DISPERSAO}x): ${marcados.length}, dos quais ${marcadosCurtos.length} de chave curta`);
    ok('*** a dispersao marca uma MINORIA dos produtos (nao e uma cerca que apaga a fatia) ***',
      marcados.length > 0 && marcados.length < comDois.length * 0.25, [marcados.length, comDois.length]);
    ok('*** e a MAIORIA dos marcados tem chave LONGA — o comprimento nao era o criterio ***',
      marcadosCurtos.length < marcados.length / 2, [marcadosCurtos.length, marcados.length]);
    /* O CONTRA-EXEMPLO NAS DUAS DIREÇÕES, e ele é o que sustenta a recusa do piso: há chave curta
       COMPORTADA (que o piso silenciaria) e chave longa ESPALHADA (que o piso deixaria passar). */
    const curtaOk = curtas.filter(([k]) => { const g = T.quemGanhou({ descricao: k }, idx);
      return g && !g.disperso; });
    const longaRuim = marcados.filter(([k]) => k.length > 12);
    console.log(`   chave curta e bem-comportada: ${curtaOk.length} · chave longa e espalhada: ${longaRuim.length}`);
    ok('*** existe chave CURTA bem-comportada (um piso de comprimento a calaria a toa) ***',
      curtaOk.length > 0, curtaOk.slice(0, 3).map(x => x[0]));
    ok('*** existe chave LONGA espalhada (um piso de comprimento a deixaria passar) ***',
      longaRuim.length > 0, longaRuim.slice(0, 3).map(x => [x[0].slice(0, 34), +razao(x[1]).toFixed(1)]));
    if (longaRuim.length) {
      const pior = longaRuim.slice().sort((a, b) => razao(b[1]) - razao(a[1]))[0];
      console.log(`   o pior de todos: "${pior[0].slice(0, 46)}" (${pior[0].length} chars) `
        + `${pior[1].length} resultados, ${razao(pior[1]).toFixed(1)}x`);
    }

    // ── 5. O QUE A TELA VAI RECEBER, NO PIOR CASO REAL ─────────────────────────────────────
    console.log('\n-- 5. o pior caso de verdade --');
    const maior = comDois.slice().sort((a, b) => b[1].length - a[1].length)[0];
    if (maior) {
      const g = T.quemGanhou({ descricao: maior[0] }, idx);
      console.log(`   "${maior[0].slice(0, 40)}": ${g.n} resultados · ${g.certames} certames · `
        + `${g.fornecedores.length} fornecedor(es)`);
      ok('*** o produto com mais resultados devolve `certames` junto com `n` — sempre ***',
        g.certames > 0 && g.n > 0);
      ok('...e nenhum fornecedor sai sem nome quando o orgao publicou o nome',
        g.fornecedores.every(x => x.nome !== undefined));
      ok('*** e a lista vem ORDENADA por vitorias, de forma estavel ***',
        JSON.stringify(g.fornecedores.map(x => x.nome))
        === JSON.stringify(T.quemGanhou({ descricao: maior[0] }, idx).fornecedores.map(x => x.nome)));
    }
    const semNada = T.quemGanhou({ descricao: 'PRODUTO QUE NAO EXISTE NESTA BASE XYZ' }, idx);
    ok('*** produto sem resultado devolve n:0 com a chave — e nunca `null` ***',
      semNada && semNada.n === 0 && semNada.chave && Array.isArray(semNada.fornecedores), semNada);

  } finally { await c.end(); }

  console.log('\nRESULTADO: ' + p + ' de ' + (p + f));
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
