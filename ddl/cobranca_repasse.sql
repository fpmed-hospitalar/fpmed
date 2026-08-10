-- ============================================================
-- FPMED — REPASSE DAS LEITURAS DE EDITAL (decisao do Lemuel, 10/08/2026)
--
-- Preco de repasse = custo real x (1 + margem/100). Margem padrao: 50%.
--
-- ══ POR QUE A MARGEM MORA NO BANCO, E NAO NO cliente.config.js ═══════════════════════════════
-- Foi a primeira coisa que pensei em fazer, e esta errado: o `cliente.config.js` e baixado pelo
-- NAVEGADOR DA FPMED e esta num repositorio PUBLICO. A margem e quanto o Lemuel cobra POR CIMA
-- do custo — e informacao comercial DELE, nao da FPMED. Deixar no config seria publicar o
-- proprio markup para o cliente e para a internet.
-- Aqui ela fica atras da RLS, visivel so para quem fecha a cobranca.
--
-- ══ O CALCULO SAI DE UM LUGAR SO ════════════════════════════════════════════════════════════
-- A view `v_leituras_cobranca` e esse lugar. Se a tela calculasse, haveria duas formulas — e
-- margem escrita em dois lugares e margem que diverge no dia em que uma das duas for ajustada.
-- >>> O ARREDONDAMENTO TAMBEM: `ceil(x*100)/100`, PRA CIMA no centavo, aqui dentro. Meio centavo
--     por leitura nao muda nada; duas regras de arredondamento diferentes fazem o total da tela
--     nao bater com o total do relatorio, e ai ninguem confia em nenhum dos dois.
--
-- ══ O HISTORICO NAO E REESCRITO ═════════════════════════════════════════════════════════════
-- A `leituras_edital` guarda o CUSTO da epoca e mais nada. O repasse e calculado NA HORA DE
-- MOSTRAR, com a margem vigente. Mudar a margem amanha muda o que se cobra daqui pra frente e
-- NAO mexe no que ja aconteceu — que e o oposto de gravar o preco na linha.
--
-- ADITIVA: tabela nova + view nova. Zero DELETE/UPDATE/DROP de dado. Seguro re-rodar.
-- ============================================================

-- ══ RENOMEIA leituras_edital -> usos_ia (10/08, mesma rodada) ═══════════════════════════════
-- A decisao de registrar TODO gasto de IA (o ler-pedido da proposta tambem) chegou horas depois
-- de a tabela nascer. `leituras_edital` passou a ser um nome mais estreito que o conteudo — e
-- nome errado numa tabela de faturamento e o tipo de coisa que se paga por anos.
-- Renomeio AGORA porque ela ainda nao tem dado real (so uma linha marcada como teste da RLS).
-- >>> RENOMEAR NAO E APAGAR: as linhas, os indices e a RLS vao junto. A regra "registro nao se
--     apaga" continua inteira.
do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='leituras_edital')
     and not exists (select 1 from pg_tables where schemaname='public' and tablename='usos_ia') then
    execute 'alter table public.leituras_edital rename to usos_ia';
  end if;
end $$;

-- O QUE foi lido. Nasce 'edital' porque tudo que ja esta gravado veio de la.
alter table public.usos_ia
  add column if not exists tipo text not null default 'edital'
    check (tipo in ('edital','pedido-proposta','pedido-foto'));
comment on column public.usos_ia.tipo is
  'Que uso de IA gerou o custo. edital = leitor de edital; pedido-* = leitura de pedido da tela '
  'de Propostas. A coluna existe porque a conta do mes soma TODOS os usos, nao so o leitor.';

-- ── CUSTOS FIXOS DO MES (lista editavel pelo admin) ─────────────────────────────────────────
-- Supabase Pro, compute Micro, dominio... O fechamento soma isto ao custo de IA.
-- >>> VALOR EM REAL **E** A ORIGEM EM DOLAR, quando houver: o compute Micro e cobrado em USD, e
--     guardar so o convertido faz a conta de janeiro nao explicar a de julho quando o cambio
--     andar. Guardando os dois, da pra auditar sem adivinhar.
create table if not exists public.custos_fixos (
  id            bigint generated always as identity primary key,
  descricao     text not null,
  valor_brl     numeric,             -- o que entra na conta do mes
  valor_usd     numeric,             -- quando a origem e em dolar
  cambio        numeric,             -- o cambio usado pra chegar no valor_brl
  vigente_de    date not null default current_date,
  vigente_ate   date,                -- null = ainda vale
  observacao    text,
  criado_em     timestamptz not null default now()
);
comment on table public.custos_fixos is
  'Custos fixos mensais da operacao (Supabase Pro, compute, dominio...). Entram no fechamento '
  'do mes junto com o custo de IA. `vigente_de/ate` em vez de apagar: a conta de um mes passado '
  'tem que continuar batendo depois de o custo mudar.';

alter table public.custos_fixos enable row level security;
drop policy if exists cfix_sel on public.custos_fixos;
drop policy if exists cfix_ins on public.custos_fixos;
drop policy if exists cfix_upd on public.custos_fixos;
create policy cfix_sel on public.custos_fixos for select to authenticated
  using (public.pode_ver_todas_leituras());
create policy cfix_ins on public.custos_fixos for insert to authenticated
  with check (public.pode_ver_todas_leituras());
create policy cfix_upd on public.custos_fixos for update to authenticated
  using (public.pode_ver_todas_leituras()) with check (public.pode_ver_todas_leituras());
-- sem DELETE: custo que existiu no mes passado nao deixa de ter existido. Encerrar = vigente_ate.
revoke all on public.custos_fixos from anon;
grant select, insert, update on public.custos_fixos to authenticated;

-- as duas linhas que o Lemuel citou; `on conflict` nao serve aqui (sem chave natural), entao
-- so insere se ainda nao houver nada — re-rodar nao duplica.
insert into public.custos_fixos (descricao, valor_usd, observacao)
  select 'Supabase — plano Pro', 25, 'assinatura mensal do banco'
  where not exists (select 1 from public.custos_fixos);
insert into public.custos_fixos (descricao, valor_usd, observacao)
  select 'Supabase — compute Micro', 10, 'addon de compute (~US$ 0,01344/h); ligado em 11/08'
  where not exists (select 1 from public.custos_fixos where descricao like '%compute%');

create table if not exists public.cobranca_config (
  id              int primary key default 1 check (id = 1),   -- linha unica, por construcao
  margem_repasse  numeric not null default 50 check (margem_repasse >= 0),
  atualizado_em   timestamptz not null default now()
);
insert into public.cobranca_config (id, margem_repasse)
  values (1, 50) on conflict (id) do nothing;

comment on table public.cobranca_config is
  'Margem de repasse (%) sobre o custo real das leituras de edital. Fica no BANCO e nao no '
  'cliente.config.js porque o config e servido ao navegador do cliente e o repo e publico — a '
  'margem e informacao comercial de quem cobra.';

alter table public.cobranca_config enable row level security;
drop policy if exists cob_sel on public.cobranca_config;
drop policy if exists cob_upd on public.cobranca_config;
-- So quem fecha a cobranca le e ajusta. Sem policy de INSERT/DELETE: a linha e unica e nasce
-- com a migracao.
create policy cob_sel on public.cobranca_config for select to authenticated
  using (public.pode_ver_todas_leituras());
create policy cob_upd on public.cobranca_config for update to authenticated
  using (public.pode_ver_todas_leituras()) with check (public.pode_ver_todas_leituras());
revoke all on public.cobranca_config from anon;
grant select, update on public.cobranca_config to authenticated;

-- ── A VIEW: o unico lugar onde o repasse e calculado ────────────────────────────────────────
-- `security_invoker = true` E A PECA QUE FAZ A REGRA VALER: a view roda com os direitos de quem
-- consulta, entao a RLS da `leituras_edital` (cada um ve as suas) e a da `cobranca_config` (so
-- o admin) sao aplicadas DE VERDADE. Com `security_invoker = false` (o padrao antigo) a view
-- rodaria como dona e entregaria a margem — e o consumo dos outros — pra qualquer logado.
-- >>> CONSEQUENCIA DESENHADA, e nao efeito colateral: pra quem NAO fecha a cobranca, a margem
--     nao existe e `repasse_brl` volta NULL. O operador ve o custo da leitura dele e nao ve
--     quanto e cobrado por cima. Era exatamente o pedido.
drop view if exists public.v_leituras_cobranca;
create view public.v_leituras_cobranca
  with (security_invoker = true) as
select
  l.id, l.quando, l.email, l.usuario,
  l.edital_titulo, l.edital_url, l.edital_mb,
  l.modo, l.modo_motivo, l.paginas, l.chars,
  l.modelo, l.tokens_entrada, l.tokens_saida, l.segundos,
  l.tipo, l.usd, l.cambio, l.brl, l.ok, l.erro,
  (select c.margem_repasse from public.cobranca_config c where c.id = 1) as margem_repasse,
  -- pra cima no centavo, e so quando ha custo em real (sem cambio do dia, nao ha repasse em R$)
  case when l.brl is null then null
       else ceil(l.brl * (1 + (select c.margem_repasse from public.cobranca_config c where c.id = 1) / 100.0) * 100) / 100.0
  end as repasse_brl
from public.usos_ia l;

comment on view public.v_leituras_cobranca is
  'Leituras com o preco de REPASSE calculado (custo x (1+margem)). security_invoker=true: a RLS '
  'de quem consulta vale, entao quem nao fecha a cobranca recebe repasse_brl NULL.';

revoke all on public.v_leituras_cobranca from anon;
grant select on public.v_leituras_cobranca to authenticated;

notify pgrst, 'reload schema';
