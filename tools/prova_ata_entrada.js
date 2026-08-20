/* ══════════════════════════════════════════════════════════════════════════════════════════════
   prova_ata_entrada.js — UMA ATA PERCORRIDA DO COMEÇO AO FIM PELO CAMINHO NOVO (fatia B31)

   ══ O QUE A CAIXA PEDIU, E É EXATAMENTE O QUE ESTA PROVA FAZ ════════════════════════════════
   *"Uma ata percorrida do começo ao fim por esse caminho novo — validade informada, dois itens
   marcados como ganhos, saldo aparecendo na tela — com as contagens conferidas contra o SQL, mais
   o caso arquivado."* Sete passos, na ordem em que um gestor os faria, cada um conferido do outro
   lado por uma consulta que não passa pelo mesmo código.

   ══ O CRACHÁ É O DO NAVEGADOR, E ISSO NÃO É DETALHE ═════════════════════════════════════════
   Toda escrita aqui sai por `PostgREST` com o token de um login de verdade (`SENHA_PADRAO`), e
   nunca com a `service_role`. Uma escrita que passa por cima da RLS não prova que a TELA consegue
   gravar — prova só que o banco aceita, o que ninguém duvidava. A leitura de conferência é a
   única coisa que entra por `pg`, e ela é `select`.

   ══ ONDE ELA ESCREVE, E POR QUE SÓ ALI ══════════════════════════════════════════════════════
   Só no negócio **2569**, cujo título diz `[PROVA B13 — registro de teste, pode apagar]` e que
   está amarrado ao certame 6719 (o único desta base com itens). Nenhuma ata de verdade é tocada.
   >>> E ELA NÃO APAGA NADA AO SAIR — arquiva, que é a lei da casa e é justamente o passo 7. O
       registro fica no banco com o carimbo de arquivamento e o motivo "registro de teste", que é
       verdade e é o que a gaveta existe para guardar.

   ══ O CRITÉRIO DE TODO RECORTE VAI ESCRITO AO LADO DO NÚMERO ════════════════════════════════
   Regra nova da rodada 11, e ela nasceu de uma dívida minha: na B30 publiquei "94 entraram / 98
   ficaram de fora" sem dizer o que separava os dois grupos. Aqui, todo número com recorte diz em
   uma linha qual é o recorte.

     node tools/prova_ata_entrada.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const { Client } = require('pg');
const E = require('../fpmed_ata_entrada.js');
const S = require('../fpmed_ata_saldo.js');

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const pega = re => (seg.match(re) || [])[1];
const REF = 'xzdowrksuswekwffoluk';
const PW = pega(/DB_PASSWORD\s*[:=]\s*(\S+)/i);
const ANON = pega(/ANON_KEY\s*[:=]\s*(\S+)/i);
const SB = pega(/PROJECT_URL\s*[:=]\s*(\S+)/i) || `https://${REF}.supabase.co`;
const SENHA = pega(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || 'adm2026';
if (!PW) { console.error('DB_PASSWORD nao encontrada — abortando.'); process.exit(1); }

const NEG = 2569;                 // [PROVA B13 — registro de teste, pode apagar] · certame 6719
const CERTAME = 6719;

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

let p = 0, f = 0;
const ok = (t, c, e) => { if (c) { p++; console.log('  ok    ' + t); }
  else { f++; console.log('  FALHA ' + t + (e !== undefined ? '\n        [' + JSON.stringify(e).slice(0, 400) + ']' : '')); } };
const n0 = v => (v == null ? null : Number(v));

(async () => {
  const db = await conecta();
  const cr = await cracha();
  if (!cr) { console.error('nao consegui o cracha do navegador — abortando (nao vou usar service_role).'); process.exit(1); }
  const H = { apikey: ANON, Authorization: 'Bearer ' + cr.tk, 'Content-Type': 'application/json' };
  const REST = (u, o) => fetch(`${SB}/rest/v1/${u}`, Object.assign({ headers: H }, o || {}));

  console.log('=== A ATA PERCORRIDA DO COMECO AO FIM PELO CAMINHO NOVO (B31) ===');
  console.log('    cracha do navegador: ' + cr.email + '  ·  ata de ensaio: negocio ' + NEG + '\n');

  // ══ 0. O ESTADO DE HOJE. Não prova nada: CONTA. É o número que diz se a fatia entrega uma tela
  //       cheia ou uma tela honestamente vazia, e ele vai para o relatório do jeito que sair.
  console.log('-- 0. o estado antes de qualquer escrita (so leitura) --');
  const antes = (await db.query(`
    select (select count(*) from public.negocios where estagio='contrato')                              as atas,
           (select count(*) from public.negocios where estagio='contrato' and ata_vigencia_fim is not null) as com_validade,
           (select count(*) from public.negocios where estagio='contrato' and arquivado_em is not null) as arquivadas_por_alguem,
           (select count(*) from public.negocios where estagio='contrato' and arquivado)                as com_a_bandeira,
           (select count(*) from public.negocio_itens_ganhos)                                           as nig_linhas,
           (select count(*) from public.v_negocio_itens_ganhos where negocio_id=$1)                     as nig_desta_ata,
           (select count(*) from public.ata_saldo where negocio_id=$1)                                  as saldo_desta_ata,
           (select count(*) from public.licitacao_itens li join public.licitacoes l on l.numero_controle=li.numero_controle
             where l.id=$2)                                                                             as itens_do_certame
  `, [NEG, CERTAME])).rows[0];
  console.table([antes]);
  /* ══ O NÚMERO QUE MANDA NESTA FATIA, COM O CRITÉRIO DO RECORTE PUBLICADO ══════════════════════
     `com_a_bandeira` e `arquivadas_por_alguem` medem coisas DIFERENTES sobre as mesmas linhas:
       · com_a_bandeira ......... `negocios.arquivado = true` — as 108 atas nasceram assim, na
                                  importação do Calendário 2025. Ninguém decidiu nada.
       · arquivadas_por_alguem .. `arquivado_em is not null` — alguém CLICOU, com motivo e carimbo.
     A gaveta e a `v_atas_vigencia` filtram pela SEGUNDA. Se filtrassem pela primeira, a gaveta
     nasceria dizendo "108 arquivadas" e a aba Ata nasceria em branco. */
  ok('as 108 atas trazem a BANDEIRA da importacao, e nenhuma foi arquivada por alguem',
    Number(antes.com_a_bandeira) > 0, [antes.com_a_bandeira, antes.arquivadas_por_alguem]);
  ok('o certame ' + CERTAME + ' tem itens de edital para marcar', Number(antes.itens_do_certame) > 0,
    antes.itens_do_certame);

  /* ══ ELA RODA DUAS VEZES, E A PRIMEIRA VEZ QUASE MENTIU SOBRE ISSO ══════════════════════════
     Esta prova TERMINA arquivando a ata de ensaio — que é o estado verdadeiro dela. Na segunda
     execução, portanto, o negócio 2569 já não está na `v_atas_vigencia`, e o passo 1 quebrava com
     "a view devolve a data que subiu: null". **A view estava certa e a prova é que não sabia
     desfazer o próprio rastro.** Prova que só passa uma vez é prova que ninguém pode repetir — e
     resultado que ninguém pode repetir não é medição, é anedota.
     >>> O RESET É O PRÓPRIO CAMINHO DE VOLTA DA FATIA (`pedidoDesarquivar`), e não um UPDATE à
         mão: se o desarquivar estiver quebrado, esta prova falha no primeiro passo, que é onde
         ela tem de falhar. */
  await REST(`negocios?id=eq.${NEG}`, { method: 'PATCH', headers: H,
    body: JSON.stringify(E.pedidoDesarquivar(new Date().toISOString())) });

  // ══ 1. A VALIDADE, no lugar onde o gestor já está ─────────────────────────────────────────
  console.log('\n-- 1. a validade da ata, informada pelo cracha do navegador --');
  const hoje = new Date().toISOString().slice(0, 10);
  const fim = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
  {
    const r = await REST(`negocios?id=eq.${NEG}`, { method: 'PATCH',
      headers: Object.assign({ Prefer: 'return=representation' }, H),
      body: JSON.stringify({ ata_vigencia_inicio: hoje, ata_vigencia_fim: fim }) });
    ok('o gestor consegue gravar a validade pela RLS (sem service_role)', r.ok, r.status);
    const v = (await db.query(
      'select ata_vigencia_fim::text as f, dias_para_vencer, situacao from public.v_atas_vigencia where id=$1', [NEG])).rows[0];
    ok('e a view devolve a data que subiu', v && v.f === fim, [v && v.f, fim]);
    /* O ORÁCULO DA CONTA DE DIAS É O POSTGRES, e não uma fixture minha: a aritmética de `date` de
       lá não conhece fuso (é subtração de dias inteiros) e por isso não erra do mesmo jeito que o
       `Date` do JavaScript. É a lição da B26 aplicada de novo. */
    const jsD = S.vigencia(fim, hoje);
    ok('*** os dias que o motor conta batem com os do Postgres (' + jsD.dias + ') ***',
      Number(v.dias_para_vencer) === jsD.dias, [v.dias_para_vencer, jsD.dias]);
    ok('e a SITUACAO tambem bate — se discordassem, a ata sairia "vencendo" na lista e "vigente" na ficha',
      v.situacao === jsD.situacao, [v.situacao, jsD.situacao]);
  }

  // ══ 2. OS CANDIDATOS SAEM DO EDITAL ───────────────────────────────────────────────────────
  console.log('\n-- 2. a lista de marcar, feita dos itens do EDITAL --');
  const ctrl = (await db.query('select numero_controle from public.licitacoes where id=$1', [CERTAME])).rows[0].numero_controle;
  const itensEdital = await (await REST('licitacao_itens?numero_controle=eq.' + encodeURIComponent(ctrl)
    + '&select=numero_item,descricao,quantidade,unidade,valor_unitario_ref,resultado_vencedor,'
    + 'resultado_cnpj,resultado_valor_unit,resultado_quantidade&order=id&limit=2000')).json();
  const emp = (await db.query(
    'select e.cnpj from public.empresas e join public.negocios n on n.empresa_id=e.id where n.id=$1', [NEG])).rows[0];
  const meuCnpj = emp ? emp.cnpj : null;
  const jaGanhos = await (await REST(`v_negocio_itens_ganhos?negocio_id=eq.${NEG}&select=*`)).json();
  const cands = E.candidatos(itensEdital, jaGanhos, meuCnpj);

  const porEstado = {};
  cands.forEach(c => { porEstado[c.estado] = (porEstado[c.estado] || 0) + 1; });
  console.log('    estados dos ' + cands.length + ' candidatos: ' + JSON.stringify(porEstado));
  /* ══ O RECORTE, PUBLICADO ═════════════════════════════════════════════════════════════════════
     `de_outro`   = o PNCP publicou este item sob um CNPJ que NÃO é o da empresa deste negócio
                    (comparação só pelos dígitos, dos dois lados).
     `sem_resultado` = o portal não publicou vencedor nem valor unitário para o item.
     `meu_publicado` = publicou, e o CNPJ bate com o nosso.
     Nenhum dos três impede marcar. O estado só decide o que a linha AVISA. */
  ok('*** a lista tem os ' + cands.length + ' itens do edital, e nao so os que tem resultado ***',
    cands.length === Number(antes.itens_do_certame), [cands.length, antes.itens_do_certame]);
  ok('e o item SEM resultado nao e tratado como "nao ganhei" — ele e "ainda nao sei"',
    !Object.keys(porEstado).includes('nao_ganhei'), Object.keys(porEstado));
  {
    const sql = (await db.query(`
      select count(*) filter (where li.resultado_valor_unit is not null or li.resultado_vencedor is not null) as com_resultado,
             count(*) filter (where li.resultado_valor_unit is null and li.resultado_vencedor is null)        as sem_resultado
        from public.licitacao_itens li join public.licitacoes l on l.numero_controle = li.numero_controle
       where l.id = $1`, [CERTAME])).rows[0];
    const semRes = (porEstado.sem_resultado || 0);
    ok('*** o "sem resultado" do motor bate com o do SQL: ' + semRes + ' ***',
      semRes === Number(sql.sem_resultado), [semRes, sql.sem_resultado]);
  }

  // ══ 3. MARCAR DOIS ITENS ──────────────────────────────────────────────────────────────────
  console.log('\n-- 3. marcar DOIS itens como ganhos, e gravar --');
  const dois = cands.slice(0, 2);
  const marcas = [
    { item: dois[0].item, marcado: true, quantidade: 120, unitario: 4.37 },
    // O SEGUNDO ENTRA SEM PREÇO DE PROPÓSITO: é a lei da casa sendo exercida no caminho real —
    // ele tem de gravar com `valor_unitario` e `total` NULOS, e nunca com R$ 0,00.
    { item: dois[1].item, marcado: true, quantidade: 30, unitario: null },
  ];
  /* ══ O ESPERADO É DERIVADO, E NÃO ESCRITO À MÃO — E ISSO É A FATIA, NÃO CONVENIÊNCIA ═════════
     A primeira versão desta prova cobrava "2 linhas". Ela passou na primeira execução e falhou na
     segunda, porque na segunda a ata JÁ TINHA itens marcados e a gravação subiu a lista COMPLETA —
     que é exatamente o comportamento que esta fatia existe para garantir (a view mostra só a
     confirmação mais alta; subir só o que mudou apagaria da vista o resto).
     >>> Ou seja: o número fixo estava cobrando o CONTRÁRIO da promessa. O esperado passou a ser a
         UNIÃO — o que já estava marcado mais o que acabei de marcar — e é isso que a promessa diz. */
  const jaMarcados = new Set(cands.filter(c => c.marcado).map(c => c.item));
  marcas.forEach(m => jaMarcados.add(m.item));
  const esperado3 = jaMarcados.size;
  const r3 = E.linhasParaGravar(cands, marcas, cr.email);
  ok('*** o motor monta a lista COMPLETA: ' + r3.linhas.length + ' linhas (o que ja estava + o que marquei) ***',
    r3.linhas.length === esperado3, [r3.linhas.length, esperado3]);
  ok('*** todas levam `confirmacao: 0` ("banco, escolha") ***', r3.linhas.every(l => l.confirmacao === 0));
  {
    const semPreco = r3.linhas.find(l => l.item_n === String(dois[1].item));
    ok('*** e a que nao tem preco vai com valor_unitario e total NULOS, nunca R$ 0,00 ***',
      semPreco && semPreco.valor_unitario === null && semPreco.total === null, semPreco);
  }

  const g1 = await REST('negocio_itens_ganhos', { method: 'POST',
    headers: Object.assign({ Prefer: 'return=representation' }, H),
    body: JSON.stringify(r3.linhas.map(l => Object.assign({ negocio_id: NEG }, l))) });
  const v1 = g1.ok ? await g1.json() : [];
  ok('o gestor consegue gravar os itens ganhos pela RLS', g1.ok, g1.status);
  ok('*** e voltaram ' + v1.length + ' linhas para as ' + r3.linhas.length
    + ' que subiram (o efeito, e nao o codigo HTTP) ***', v1.length === r3.linhas.length, v1.length);
  /* ══ O DEFEITO QUE FOI MEDIDO NO BANCO, AGORA CONFERIDO DEPOIS DO CONSERTO ═══════════════════
     Antes da B31, um lote de 3 saía com confirmações 2, 3 e 4 — a trigger disparava linha a linha
     — e a view, que mostra só o `max`, devolvia UMA das três. *Marcar três itens e a tela mostrar
     um*, sem erro nenhum. O conserto pôs a decisão num parâmetro LOCAL da transação. */
  const confs = [...new Set(v1.map(l => Number(l.confirmacao)))];
  ok('*** UM insert de 2 linhas e UMA confirmacao so (confirmacao ' + confs.join(',') + ') ***',
    confs.length === 1, confs);
  {
    const view = (await db.query(
      'select count(*)::int as n, max(confirmacao)::int as c from public.v_negocio_itens_ganhos where negocio_id=$1', [NEG])).rows[0];
    /* ESTE É O ASSERT QUE O DEFEITO MEDIDO NO BANCO QUEBRAVA. Com a trigger antiga, um lote de N
       saía com N confirmações diferentes e a view — que mostra só o `max` — devolvia UMA linha:
       marcar vários itens e a tela mostrar um, sem erro nenhum. */
    ok('*** e a view devolve as ' + r3.linhas.length + ', e nao 1 ***', view.n === r3.linhas.length, view);
    const z = (await db.query(
      'select count(*)::int as n from public.v_negocio_itens_ganhos where negocio_id=$1 and (valor_unitario = 0 or total = 0)', [NEG])).rows[0];
    ok('*** nenhuma linha desta ata tem preco ou total ZERO no banco ***', z.n === 0, z);
  }

  // ══ 4. A SEGUNDA CONFIRMAÇÃO SUBSTITUI A VISTA, E O RASTRO FICA ───────────────────────────
  console.log('\n-- 4. corrigir a lista: a confirmacao nova sucede, e a velha fica no rastro --');
  {
    const ja = await (await REST(`v_negocio_itens_ganhos?negocio_id=eq.${NEG}&select=*`)).json();
    const c2 = E.candidatos(itensEdital, ja, meuCnpj);
    const m2 = [
      { item: dois[0].item, marcado: true, quantidade: 120, unitario: 4.37 },
      { item: dois[1].item, marcado: true, quantidade: 30, unitario: 9.9 },   // o preço que faltava
      { item: cands[2].item, marcado: true, quantidade: 7, unitario: 1.5 },   // um item novo
    ];
    const r4 = E.linhasParaGravar(c2, m2, cr.email);
    /* A LISTA SOBE COMPLETA, E É ISSO QUE ESTE PASSO PROVA. Se subisse só o que mudou, os itens
       intocados sumiriam da VISTA — sem erro, sem aviso, com o rastro intacto no banco para
       provar que eles existiam. O esperado é derivado do estado, pelo motivo do passo 3. */
    const esperado4 = new Set(c2.filter(c => c.marcado).map(c => c.item));
    m2.forEach(m => esperado4.add(m.item));
    ok('*** marcar 1 item novo faz subir as ' + r4.linhas.length + ' linhas, e nao 1 ***',
      r4.linhas.length === esperado4.size, [r4.linhas.length, esperado4.size]);
    ok('e o item novo esta entre elas', r4.linhas.some(l => l.item_n === String(cands[2].item)));
    const g2 = await REST('negocio_itens_ganhos', { method: 'POST',
      headers: Object.assign({ Prefer: 'return=representation' }, H),
      body: JSON.stringify(r4.linhas.map(l => Object.assign({ negocio_id: NEG }, l))) });
    const v2 = g2.ok ? await g2.json() : [];
    ok('a segunda gravacao passa pela RLS', g2.ok, g2.status);
    const c2s = [...new Set(v2.map(l => Number(l.confirmacao)))];
    ok('*** e ela e UMA confirmacao so, maior que a primeira (' + confs[0] + ' -> ' + c2s[0] + ') ***',
      c2s.length === 1 && c2s[0] > confs[0], [confs, c2s]);
    const d = (await db.query(`
      select (select count(*)::int from public.v_negocio_itens_ganhos where negocio_id=$1)               as na_vista,
             (select count(*)::int from public.negocio_itens_ganhos   where negocio_id=$1)               as no_rastro,
             (select count(distinct confirmacao)::int from public.negocio_itens_ganhos where negocio_id=$1) as confirmacoes
    `, [NEG])).rows[0];
    ok('*** a vista mostra as ' + r4.linhas.length + ' ***', d.na_vista === r4.linhas.length, d);
    ok('*** e o rastro guarda as linhas das DUAS confirmacoes — nada foi apagado ***',
      d.no_rastro >= r3.linhas.length + r4.linhas.length && d.confirmacoes >= 2, d);
  }

  // ══ 5. O SALDO APARECENDO NA TELA ─────────────────────────────────────────────────────────
  console.log('\n-- 5. o saldo, que so existe porque os itens passaram a existir --');
  {
    const itens = await (await REST(`v_negocio_itens_ganhos?negocio_id=eq.${NEG}&select=*`)).json();
    // O EMPENHO É INFORMADO À MÃO E SAI MARCADO COMO TAL (decisão do arquiteto na rodada 11: o
    // PNCP não publica empenho por item, e derivar viraria dado publicado na cabeça de quem lê).
    /* O ITEM É ESCOLHIDO PELO NÚMERO, E NÃO PELA POSIÇÃO. Primeira versão desta prova usava
       `itens[0]` — e a `v_negocio_itens_ganhos` não promete ordem nenhuma. Ela devolveu o item que
       entrou na CORREÇÃO (quantidade 7), o empenho de 40 caiu sobre ele, e o saldo saiu −33. O
       número estava certo (a conta do motor conferiu com o Postgres nas duas linhas seguintes); o
       ERRADO era a prova, que afirmava saber qual linha estava lendo. É a mesma família do
       `sort()` sem comparador da B28: ordem que ninguém prometeu, usada como se fosse promessa. */
    const alvo = itens.find(g => String(g.item_n) === String(dois[0].item));
    ok('o item do empenho e escolhido pelo NUMERO, e nao pela posicao na view', !!alvo, dois[0].item);
    const sub = [{ negocio_id: NEG, item_n: alvo.item_n, empenhado: 40, entregue: 10,
                   origem: 'informado', informado_por: cr.email, atualizado_em: new Date().toISOString() }];
    const rs = await REST('ata_saldo?on_conflict=negocio_id,item_n', { method: 'POST',
      headers: Object.assign({ Prefer: 'resolution=merge-duplicates,return=representation' }, H),
      body: JSON.stringify(sub) });
    ok('o empenho informado a mao passa pela RLS', rs.ok, rs.status);

    const saldos = await (await REST(`ata_saldo?negocio_id=eq.${NEG}&select=*`)).json();
    const itensParaSaldo = itens.map(g => ({ item: String(g.item_n), descricao: g.descricao,
      quantidade: n0(g.quantidade), unitario: n0(g.valor_unitario) }));
    const ls = S.linhas(itensParaSaldo, saldos);
    const t = S.totais(ls);
    const linhaComEmp = ls.find(l => l.item === String(alvo.item_n));
    console.log('    itens: ' + t.itens + ' · linhas com saldo calculado: ' + t.comSaldo
      + ' · saldo: ' + t.saldo + ' un · R$ ' + t.saldoValor.toFixed(2));
    /* ══ O CRITÉRIO DO RECORTE, PUBLICADO — a dívida da B30 paga ═════════════════════════════════
       `comSaldo` = linhas em que a QUANTIDADE e o EMPENHO são ambos conhecidos. Só essas entram
       na soma. As demais ficam de fora não porque valem zero, mas porque **ninguém informou o
       empenho** — e somá-las como zero daria exatamente o mesmo total, com o contador mentindo. */
    ok('*** o saldo aparece: ' + linhaComEmp.saldo + ' unidades no item informado ***',
      linhaComEmp.saldo === 80, linhaComEmp);
    ok('e em dinheiro tambem, porque este item tem preco',
      Math.abs(linhaComEmp.saldoValor - 80 * 4.37) < 1e-9, linhaComEmp.saldoValor);
    /* AS LINHAS DE FORA SÃO AS QUE NÃO TÊM LINHA EM `ata_saldo` — derivado do banco, e não da
       posição. Saldo `null` nelas é a lei da fatia: "ainda posso entregar tudo" seria uma
       AFIRMAÇÃO sobre o comportamento do órgão que ninguém verificou. */
    const comSaldoNoBanco = new Set(saldos.filter(s => s.empenhado != null).map(s => String(s.item_n)));
    ok('*** as linhas SEM empenho informado ficam com saldo `null`, e nao com a quantidade inteira ***',
      ls.filter(l => !comSaldoNoBanco.has(l.item)).every(l => l.saldo === null),
      ls.map(l => [l.item, l.saldo]));
    ok('a linha coerente nao levanta alerta nenhum', linhaComEmp.alertas.length === 0, linhaComEmp.alertas);
    /* ══ O CRITÉRIO DO RECORTE, DE NOVO E COM NÚMERO ═══════════════════════════════════════════
       `comSaldo` conta as linhas em que quantidade E empenho são conhecidos. As de fora não valem
       zero: ninguém informou o empenho delas. Somá-las como zero daria **exatamente o mesmo
       total** e só o contador denunciaria — é a lição inteira da B30, medida aqui outra vez. */
    ok('*** o contador denuncia o recorte: ' + t.comSaldo + ' de ' + t.itens + ' entraram na soma ***',
      t.comSaldo === comSaldoNoBanco.size && t.comSaldo < t.itens, [t.comSaldo, comSaldoNoBanco.size, t.itens]);
    /* E A INCOERÊNCIA É MOSTRADA, NÃO RECUSADA. Empenho maior que a quantidade registrada acontece
       de verdade (o órgão empenhou sobre um aditivo, ou a quantidade da ata está errada) — a tela
       levanta ALERTA e mostra o número. Recusar seria a tela decidindo por quem tem a ata na mão. */
    const incoerentes = ls.filter(l => l.alertas.length);
    ok('linha incoerente (se houver) e MOSTRADA com alerta, e nunca some da tabela',
      incoerentes.every(l => l.saldo !== undefined), incoerentes.map(l => [l.item, l.saldo, l.alertas]));
    // O ORÁCULO OUTRA VEZ: a mesma subtração em `numeric` do Postgres — decimal exato contra o
    // binário do JavaScript.
    const sq = (await db.query(`
      select coalesce(sum(g.quantidade - s.empenhado), 0)                          as saldo,
             coalesce(sum((g.quantidade - s.empenhado) * g.valor_unitario), 0)     as valor,
             count(*)::int                                                          as com_saldo
        from public.v_negocio_itens_ganhos g
        join public.ata_saldo s on s.negocio_id = g.negocio_id and s.item_n = g.item_n
       where g.negocio_id = $1 and g.quantidade is not null and s.empenhado is not null`, [NEG])).rows[0];
    ok('*** o saldo em unidades bate com o `numeric` do Postgres ***',
      Number(sq.saldo) === t.saldo, [sq.saldo, t.saldo]);
    ok('*** o saldo em reais tambem (diferenca abaixo de 1e-9 e binario x decimal, nao erro) ***',
      Math.abs(Number(sq.valor) - t.saldoValor) < 1e-9, [sq.valor, t.saldoValor]);
    ok('e o contador tambem', Number(sq.com_saldo) === t.comSaldo, [sq.com_saldo, t.comSaldo]);
  }

  // ══ 6. A ATA ENTRA NA LISTA DA MANHÃ ──────────────────────────────────────────────────────
  console.log('\n-- 6. e agora ela tem relogio: entra em "o que esta indo embora" --');
  const V = require('../fpmed_vai_embora.js');
  {
    const atas = await (await REST('v_atas_vigencia?select=*')).json();
    const r = V.juntar({ certidoes: [], atas: atas, licitacoes: [] }, V.hojeISO());
    const minha = r.linhas.find(l => l.id === NEG);
    ok('*** a ata com validade de 45 dias aparece na lista da manha ***', !!minha, r.contagem);
    ok('e o verbo dela e EMPENHAR', minha && minha.verbo === 'empenhar', minha && minha.verbo);
    const q = (await db.query('select count(*)::int as n from public.ata_saldo where negocio_id=$1', [NEG])).rows[0];
    ok('*** e ela diz quantos itens tem saldo informado (' + q.n + '), e nao "0" ***',
      minha && minha.unidades === q.n, [minha && minha.unidades, q.n]);
  }

  // ══ 7. ARQUIVAR, E NÃO APAGAR ─────────────────────────────────────────────────────────────
  console.log('\n-- 7. arquivar (com motivo e carimbo), e a volta --');
  {
    const semMotivo = E.pedidoArquivar('', '', cr.email, new Date().toISOString());
    ok('*** sem motivo, o motor RECUSA antes de tocar no banco ***', semMotivo.ok === false, semMotivo);

    const pa = E.pedidoArquivar('registro de teste', '', cr.email, new Date().toISOString());
    const ra = await REST(`negocios?id=eq.${NEG}`, { method: 'PATCH',
      headers: Object.assign({ Prefer: 'return=representation' }, H), body: JSON.stringify(pa.campos) });
    ok('o gestor consegue arquivar pela RLS', ra.ok, ra.status);
    const d1 = (await db.query(`
      select (select count(*)::int from public.v_atas_vigencia   where id=$1) as na_lista,
             (select count(*)::int from public.v_atas_arquivadas where id=$1) as na_gaveta,
             (select count(*)::int from public.v_negocio_itens_ganhos where negocio_id=$1) as itens_ainda_la,
             (select count(*)::int from public.ata_saldo where negocio_id=$1)              as saldo_ainda_la,
             (select arquivado_motivo from public.negocios where id=$1)                    as motivo,
             (select arquivado_por from public.negocios where id=$1)                       as autor
    `, [NEG])).rows[0];
    ok('*** a ata sai da lista de prazos ***', d1.na_lista === 0, d1);
    ok('*** e entra na gaveta, com motivo e autor ***',
      d1.na_gaveta === 1 && d1.motivo === 'registro de teste' && !!d1.autor, d1);
    ok('*** e NADA foi apagado: os itens e o saldo continuam no banco ***',
      d1.itens_ainda_la >= 3 && d1.saldo_ainda_la >= 1, d1);
    {
      const atas = await (await REST('v_atas_vigencia?select=*')).json();
      const arq = await (await REST('v_atas_arquivadas?select=id,arquivado_em')).json();
      const r = V.juntar({ certidoes: [], licitacoes: [],
        atas: atas.concat(arq.map(a => Object.assign({ situacao: 'sem_vigencia' }, a))) }, V.hojeISO());
      ok('*** e a lista da manha nao a ressuscita — ela conta e descarta ***',
        !r.linhas.some(l => l.id === NEG) && r.divida.ataArquivada >= 1, r.divida);
    }

    const pd = E.pedidoDesarquivar(new Date().toISOString());
    const rd = await REST(`negocios?id=eq.${NEG}`, { method: 'PATCH',
      headers: Object.assign({ Prefer: 'return=representation' }, H), body: JSON.stringify(pd) });
    ok('a volta existe, e passa pela RLS', rd.ok, rd.status);
    const d2 = (await db.query(`
      select (select count(*)::int from public.v_atas_vigencia   where id=$1) as na_lista,
             (select count(*)::int from public.v_atas_arquivadas where id=$1) as na_gaveta,
             (select arquivado_motivo from public.negocios where id=$1)       as motivo_ainda_la,
             (select desarquivado_em is not null from public.negocios where id=$1) as tem_terceira_data
    `, [NEG])).rows[0];
    ok('*** desarquivada, ela volta para a lista de prazos ***', d2.na_lista === 1, d2);
    ok('e sai da gaveta', d2.na_gaveta === 0, d2);
    ok('*** e o motivo do arquivamento CONTINUA la: quem desfaz um ato nao desfaz o fato ***',
      d2.motivo_ainda_la === 'registro de teste', d2);
    ok('*** e a terceira data guarda que ela ja saiu uma vez ***', d2.tem_terceira_data === true, d2);

    /* ══ E ELA SAI ARQUIVADA, QUE É O ESTADO VERDADEIRO ══════════════════════════════════════════
       Este registro É de teste — o título dele diz isso desde a B13. Deixá-lo na lista de prazos
       de amanhã seria esta prova sujando a tela do dono com o próprio rastro; apagá-lo seria DELETE
       numa casa cuja lei é arquivar. Então ele sai como a caixa manda: arquivado, com motivo. */
    const pf = E.pedidoArquivar('registro de teste', '', cr.email, new Date().toISOString());
    await REST(`negocios?id=eq.${NEG}`, { method: 'PATCH', headers: H, body: JSON.stringify(pf.campos) });
    const d3 = (await db.query(
      'select arquivado_em is not null as arq, desarquivado_em is not null as voltou from public.negocios where id=$1', [NEG])).rows[0];
    ok('a ata de ensaio fica ARQUIVADA ao fim (nao apagada), e a historia inteira fica na linha',
      d3.arq === true && d3.voltou === true, d3);
  }

  await db.end();
  console.log('\n== PLACAR ==');
  console.log('  ' + p + ' ok, ' + f + ' falha(s)');
  console.log('\n  >>> O CAMINHO EXISTE E FOI PERCORRIDO INTEIRO, no banco de verdade, com o cracha');
  console.log('      de ' + cr.email + ' — validade, dois itens marcados, um terceiro na correcao,');
  console.log('      saldo calculado, entrada na lista da manha, arquivamento e volta.');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
