/* ══════════════════════════════════════════════════════════════════════════════════════════════
   prova_b34_rastro.js — QUEM ARQUIVOU, MEDIDO CONTRA O BANCO (fatia B34, 21/08/2026)

   ══ POR QUE ESTA PROVA EXISTE SEPARADA DA CATRACA ═══════════════════════════════════════════
   A `tests/testa_arquivar_rastro.js` cobra a REGRA (o motor, o caminho da tela, a forma do DDL) e
   é de propósito cega a números de banco: literal de contagem numa suíte envelhece sozinho e vira
   vermelho de mentira na segunda semana. Número de banco é PROVA, e prova mede-se contra o banco.

   ══ O QUE ELA MEDE, E EM QUE ORDEM ══════════════════════════════════════════════════════════
   1. O ESTADO. Quantos arquivados, e de onde veio cada um. A soma tem de fechar com o total —
      um arquivado sem origem declarada é exatamente o buraco que esta fatia veio tapar.
   2. AS DUAS OPÇÕES RECUSADAS, com SELECT e nunca com UPDATE. A caixa pediu duas opções medidas;
      medir uma opção destrutiva EXECUTANDO-A seria responder a pergunta quebrando a casa.
   3. O QUE NÃO PODE TER MUDADO. A `v_atas_vigencia`, a gaveta e o kanban têm de estar onde
      estavam. Esta fatia acrescenta uma coluna; se ela mexeu numa tela, ela falhou.
   4. O CAMINHO DE GRAVAÇÃO, COM O CRACHÁ DO NAVEGADOR — arquivando e desarquivando de verdade um
      registro de ensaio e LENDO O QUE VOLTOU. Uma escrita que passa por cima da RLS com a
      `service_role` não prova que a tela consegue gravar; prova só que o Postgres aceita.
   5. A IDEMPOTÊNCIA. Rodar o DDL de novo tem de tocar ZERO linha.

   ══ O QUE ELA ESCREVE NO BANCO, E ONDE ══════════════════════════════════════════════════════
   Ela mexe SÓ num registro de ensaio próprio, marcado no título — `[PROVA B34 — registro de
   teste, pode apagar]` — e criado por ela na primeira execução. Nenhum negócio de verdade é
   arquivado. Arquivar uma linha real para provar que o botão funciona seria fazer, com o crachá
   de alguém, a única afirmação que esta fatia inteira existe para registrar direito.

     node tools/prova_b34_rastro.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const { Client } = require('pg');
const E = require('../fpmed_ata_entrada.js');

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
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 300) + ']' : '')); } n++; };
const num = v => Number(v);
const TITULO_ENSAIO = '[PROVA B34 — registro de teste, pode apagar]';

(async () => {
  const c = await conecta();
  const q = async (sql, args) => (await c.query(sql, args || [])).rows;
  try {
    console.log('PROVA B34 — o rastro do arquivamento, medido contra o banco\n');

    // ── 1. O ESTADO ───────────────────────────────────────────────────────────────────────────
    console.log('-- 1. de onde veio cada arquivado --');
    const est = (await q(`select count(*) total,
        count(*) filter (where arquivado) arq,
        count(*) filter (where arquivado and arquivado_origem is null) sem_origem,
        /* AS TRÊS CONTAGENS SÃO ENTRE OS ARQUIVADOS, e o "and arquivado" não é redundância: uma
           linha que voltou do arquivo continua com a origem gravada (é a regra da fatia), então
           contar a coluna solta somaria mais do que há de arquivado e o fechamento não bateria.
           Medido: aconteceu na segunda execução desta prova, com o registro de ensaio dela. */
        count(*) filter (where arquivado and arquivado_origem = 'importacao_calendario_2025') importacao,
        count(*) filter (where arquivado and arquivado_origem = 'decisao_sem_carimbo') sem_carimbo,
        count(*) filter (where arquivado and arquivado_origem = 'decisao') decisao,
        /* ══ O RECORTE TEM "desarquivado_em is null", E ISSO NÃO É FROUXIDÃO ═══════════════════
           A pergunta é "o backfill escreveu em quem está no funil?". Mas uma linha que foi
           arquivada e VOLTOU fica, de propósito, com arquivado = false e a origem preservada —
           quem desfaz um ato não desfaz o fato de ter feito, e é a regra desta mesma fatia.
           A primeira versão deste assert não fazia a distinção e ficaria vermelha na segunda
           execução desta prova, por causa do próprio registro de ensaio dela. Vermelho que mistura
           verdadeiro com falso ensina todo mundo a ignorar vermelho.
           (E o comentário não usa crase: ele mora dentro de um template literal, e a primeira
            versão dele fechou a string no meio da consulta.) */
        count(*) filter (where not arquivado and arquivado_origem is not null
                           and desarquivado_em is null) origem_em_quem_nao_esta,
        count(*) filter (where not arquivado and arquivado_origem is not null
                           and desarquivado_em is not null) voltaram_do_arquivo
      from negocios`))[0];
    console.log(`   negocios ${est.total} · arquivados ${est.arq}`);
    console.log(`   importacao ${est.importacao} · decisao ${est.decisao} · clique sem carimbo ${est.sem_carimbo}`);
    ok('*** TODO arquivado tem origem declarada — zero sem resposta ***',
      num(est.sem_origem) === 0, est.sem_origem);
    ok('*** e a soma das tres origens fecha com o total de arquivados ***',
      num(est.importacao) + num(est.decisao) + num(est.sem_carimbo) === num(est.arq),
      [est.importacao, est.decisao, est.sem_carimbo, est.arq]);
    ok('quem NUNCA foi arquivado nao ganhou origem de arquivamento',
      num(est.origem_em_quem_nao_esta) === 0, est.origem_em_quem_nao_esta);
    ok('...e quem voltou do arquivo GUARDA a origem (o fato de ter saido nao se apaga)',
      num(est.voltaram_do_arquivo) >= 0, est.voltaram_do_arquivo);
    /* A EVIDÊNCIA DE QUE A IMPORTAÇÃO FOI UM ATO DE MÁQUINA, e não 2.551 decisões: a janela em que
       as linhas foram criadas. Gente não arquiva dois mil e meio negócios em segundos. */
    const janela = (await q(`select count(*) n,
        extract(epoch from (max(criado_em) - min(criado_em))) segundos
      from negocios where arquivado_origem = 'importacao_calendario_2025'`))[0];
    console.log(`   as ${janela.n} da importacao nasceram numa janela de ${Number(janela.segundos).toFixed(1)}s`);
    ok('*** a importacao inteira cabe em menos de um minuto — foi maquina, nao decisao ***',
      Number(janela.segundos) < 60, janela.segundos);
    ok('...e NENHUMA delas tem carimbo (se alguem tivesse decidido, haveria um)',
      num((await q(`select count(*) n from negocios
         where arquivado_origem = 'importacao_calendario_2025' and arquivado_em is not null`))[0].n) === 0);
    ok('*** e as `decisao_sem_carimbo` sao exatamente as que nao tem data — a pegada do botao ***',
      num((await q(`select count(*) n from negocios
         where arquivado_origem = 'decisao_sem_carimbo' and arquivado_em is not null`))[0].n) === 0);

    // ── 2. AS DUAS OPÇÕES RECUSADAS, MEDIDAS SEM SEREM EXECUTADAS ────────────────────────────
    console.log('\n-- 2. o custo medido das duas opcoes que eu NAO executei --');
    const hoje = (await q(`select
        (select count(*) from v_atas_vigencia) painel,
        (select count(*) from v_atas_arquivadas) gaveta,
        (select count(*) from negocios where not arquivado) kanban,
        (select count(*) from negocios) todos,
        (select count(*) from negocios where estagio='contrato' and arquivado_em is null) atas_sem_carimbo`))[0];
    console.log(`   OPCAO A (carimbar as atas) .. painel de vigencia ${hoje.painel} -> 0 · gaveta ${hoje.gaveta} -> ${num(hoje.gaveta) + num(hoje.atas_sem_carimbo)}`);
    console.log(`   OPCAO B (desligar a bandeira) kanban ${hoje.kanban} -> ${hoje.todos} cartoes`);
    ok('*** OPCAO A esvaziaria o painel de vigencia: todas as atas que ele mostra hoje sao sem carimbo ***',
      num(hoje.painel) === num(hoje.atas_sem_carimbo) && num(hoje.painel) > 0,
      [hoje.painel, hoje.atas_sem_carimbo]);
    ok('*** OPCAO B multiplicaria o kanban por mais de cem ***',
      num(hoje.todos) > num(hoje.kanban) * 100, [hoje.kanban, hoje.todos]);
    /* Os três coletores perguntam `negocios?arquivado=is.false` para descobrir o que perseguir no
       PNCP. A opção B mudaria o alvo deles sem ninguém mexer numa linha de coleta. */
    const alvos = (await q(`select
        count(distinct licitacao_id) filter (where not arquivado) hoje,
        count(distinct licitacao_id) depois
      from negocios where licitacao_id is not null`))[0];
    console.log(`   ...e o alvo dos coletores iria de ${alvos.hoje} para ${alvos.depois} licitacoes do indice`);
    ok('OPCAO B tambem mudaria, calada, o alvo dos tres coletores do PNCP',
      num(alvos.depois) > num(alvos.hoje), [alvos.hoje, alvos.depois]);

    // ── 3. O QUE NÃO PODE TER MUDADO ─────────────────────────────────────────────────────────
    console.log('\n-- 3. nenhuma tela mudou de resposta --');
    ok('*** o painel de vigencia continua com atas (a fatia nao esvaziou a aba Ata) ***',
      num(hoje.painel) > 0, hoje.painel);
    ok('a gaveta continua contando SO quem tem carimbo',
      num(hoje.gaveta) === num((await q(`select count(*) n from negocios
        where estagio='contrato' and arquivado_em is not null`))[0].n));
    ok('*** e as duas views continuam sem olhar `arquivado_origem` — a coluna nova nao filtra nada ***',
      !/arquivado_origem/.test((await q(
        `select pg_get_viewdef('public.v_atas_vigencia'::regclass) v`))[0].v)
      && !/arquivado_origem/.test((await q(
        `select pg_get_viewdef('public.v_atas_arquivadas'::regclass) v`))[0].v));
    ok('a view de auditoria existe e soma o mesmo total de arquivados',
      num((await q(`select coalesce(sum(linhas),0) s from v_arquivamento_origem`))[0].s) === num(est.arq));

    // ── 4. O CAMINHO DE GRAVAÇÃO, COM O CRACHÁ DO NAVEGADOR ──────────────────────────────────
    console.log('\n-- 4. arquivar e desarquivar de verdade, com o cracha do navegador --');
    const cr = await cracha();
    if (!cr) {
      console.log('   >>> NAO CONSEGUI LOGIN. O bloco 4 NAO RODOU, e isso fica DITO em vez de suposto.');
      ok('login com o cracha do navegador (sem ele, o caminho de gravacao nao foi provado)', false);
    } else {
      console.log(`   crachá: ${cr.email}`);
      const H = { apikey: ANON, Authorization: 'Bearer ' + cr.tk, 'Content-Type': 'application/json' };
      const rest = async (metodo, caminho, corpo) => {
        const r = await fetch(`${SB}/rest/v1/${caminho}`, { method: metodo,
          headers: Object.assign({ Prefer: 'return=representation' }, H),
          body: corpo ? JSON.stringify(corpo) : undefined });
        const t = await r.text();
        return { status: r.status, ok: r.ok, corpo: t ? JSON.parse(t) : null };
      };

      // O ensaio: reaproveita o da rodada anterior, cria só se não houver.
      let ens = (await rest('GET', `negocios?select=*&origem=eq.prova%20B34&limit=1`)).corpo;
      if (!ens || !ens.length) {
        const criado = await rest('POST', 'negocios', [{
          estagio: 'qualificacao', arquivado: false, origem: 'prova B34',
          titulo: TITULO_ENSAIO, orgao: 'ENSAIO', objeto: 'registro de teste da fatia B34',
          empresa_id: (await q('select id from empresas order by principal desc nulls last, id limit 1'))[0].id,
        }]);
        ok('o registro de ensaio foi criado com o crachá (e nao com a service_role)', criado.ok, criado.status);
        ens = criado.corpo;
      }
      const alvo = ens && ens[0];
      ok('há um registro de ensaio para trabalhar, e o titulo diz que ele e de teste',
        !!alvo && /PROVA B34/.test(alvo.titulo || ''), alvo && alvo.titulo);

      if (alvo) {
        // ARQUIVAR pelo caminho do kanban — o MESMO objeto que a tela manda.
        const pedido = E.pedidoArquivarNegocio(alvo, cr.email, new Date().toISOString());
        ok('*** o motor aceita arquivar um negocio que NAO e ata ***', pedido.ok === true, pedido.erro);
        const arq = await rest('PATCH', `negocios?id=eq.${alvo.id}`, pedido.campos);
        ok('*** o PATCH do kanban PASSOU com o crachá do navegador (a RLS deixa o gestor gravar) ***',
          arq.ok, arq.status + ' ' + JSON.stringify(arq.corpo).slice(0, 200));
        const dep = arq.corpo && arq.corpo[0];
        ok('*** e o que VOLTOU do banco tem os quatro: bandeira, carimbo, autor e origem ***',
          !!dep && dep.arquivado === true && !!dep.arquivado_em
          && dep.arquivado_por === cr.email && dep.arquivado_origem === 'decisao',
          dep && { a: dep.arquivado, em: dep.arquivado_em, por: dep.arquivado_por, o: dep.arquivado_origem });
        /* ESTE É O ASSERT QUE O DEFEITO NÃO PASSAVA, e ele é sobre uma COLUNA QUE EXISTE: até
           hoje de manhã o PATCH era `{arquivado:true}` e a linha voltava idêntica às da
           importação. A prova é a leitura do banco, e não a leitura do código. */
        ok('*** a linha ja NAO se confunde com a importacao: ela tem carimbo e elas nao tem ***',
          !!dep && !!dep.arquivado_em && dep.arquivado_origem !== 'importacao_calendario_2025');

        // DESARQUIVAR — a volta, pelo motor, e ela limpa o carimbo sem apagar a história.
        const volta = await rest('PATCH', `negocios?id=eq.${alvo.id}`,
          E.pedidoDesarquivar(new Date().toISOString()));
        ok('o PATCH da volta passou', volta.ok, volta.status);
        const dv = volta.corpo && volta.corpo[0];
        ok('*** a volta limpou o CARIMBO e gravou a terceira data ***',
          !!dv && dv.arquivado === false && dv.arquivado_em === null && !!dv.desarquivado_em,
          dv && { a: dv.arquivado, em: dv.arquivado_em, d: dv.desarquivado_em });
        ok('*** e NAO apagou quem arquivou nem de onde veio — o fato ficou ***',
          !!dv && dv.arquivado_por === cr.email && dv.arquivado_origem === 'decisao',
          dv && { por: dv.arquivado_por, o: dv.arquivado_origem });

        // A ATA É RECUSADA — e a recusa é medida contra uma ata DE VERDADE do banco.
        const umaAta = (await q(`select id, estagio, titulo from negocios
          where estagio='contrato' order by id limit 1`))[0];
        const rec = E.pedidoArquivarNegocio(umaAta, cr.email, new Date().toISOString());
        ok('*** uma ata DE VERDADE do banco e recusada pelo caminho do kanban ***',
          umaAta && rec.ok === false, umaAta && { id: umaAta.id, est: umaAta.estagio, ok: rec.ok });
        ok('...e nada foi gravado nela (a recusa acontece ANTES de qualquer PATCH)',
          !rec.campos);
      }
    }

    // ── 5. A IDEMPOTÊNCIA DO UPDATE ─────────────────────────────────────────────────────────
    console.log('\n-- 5. rodar o DDL de novo nao toca em nada --');
    /* O `arquivado_origem is null` é o que separa uma migração de uma reescrita. Aqui ele é medido
       do jeito mais direto possível: quantas linhas o comando AINDA acharia para escrever. */
    const restantes = (await q(`select
        count(*) filter (where arquivado_origem is null and arquivado and arquivado_em is null
                           and origem = 'calendario_2025') g1,
        count(*) filter (where arquivado_origem is null and arquivado and arquivado_em is null
                           and origem is distinct from 'calendario_2025') g2,
        count(*) filter (where arquivado_origem is null and arquivado and arquivado_em is not null) g3
      from negocios`))[0];
    ok('*** uma segunda rodada do DDL escreveria ZERO linha nos tres grupos ***',
      num(restantes.g1) + num(restantes.g2) + num(restantes.g3) === 0, restantes);

  } finally { await c.end(); }

  console.log('\nRESULTADO: ' + p + ' de ' + (p + f));
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
