-- ============================================================
-- FPMED — TABELA licitacoes (o índice próprio de oportunidades)
-- Item 10, 05/08/2026. Decisão do Lemuel.
--
-- POR QUE ELA EXISTE: o PNCP caiu 4 VEZES em dois dias (04/08, 05/08 manhã, 05/08 ~21h e
-- 05/08 ~23h — as duas últimas medidas por mim, com timeout confirmado). A tela não trava
-- (AbortController + cache), mas fica INÚTIL enquanto a fonte estiver fora. Com índice próprio
-- ela passa a ter dado sempre, e o PNCP vira o que ele deve ser: uma fonte de atualização,
-- não uma dependência de tempo real.
--
-- >>> NOME `licitacoes` E NÃO `licitacoes_pncp`, e isso veio de um achado do Lemuel (05/08):
--     ele interceptou o tráfego do SIGA e viu que TODOS os ~19 portais são atendidos por um
--     endpoint só, com o portal virando FILTRO. Ou seja: a base deles é normalizada com coluna
--     de origem, não uma tabela por portal. Nascer `licitacoes_pncp` nos obrigaria a migrar no
--     dia em que entrar Comprasnet Goiás ou Licitanet (V2). Custa nada acertar agora.
--
-- CHAVE NATURAL (cnpj, ano, sequencial): é o que o PNCP usa pra identificar uma contratação, e
-- é por ela que o coletor faz UPSERT. Sem chave natural, cada rodada duplicaria tudo.
--
-- ⚠️ COMPLIANCE: dado do PNCP é PÚBLICO. Não é dado comercial de ninguém e não cruza
--    Global↔FPMED — pode ficar no banco da FPMED sem restrição (registrado no item 10).
--
-- Coletor: tools/coleta_pncp.js
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.licitacoes (
  id                  bigint generated always as identity primary key,
  portal              text not null default 'PNCP',   -- filtro, não rota (ver acima)
  cnpj                text not null,
  ano                 integer not null,
  sequencial          integer not null,

  numero_controle     text,          -- numeroControlePNCP
  numero_compra       text,
  modalidade          text,
  modalidade_cod      integer,
  modo_disputa        text,
  situacao            text,

  orgao               text,
  unidade             text,
  municipio           text,
  uf                  text,

  objeto              text,
  valor_estimado      numeric,

  data_publicacao     date,
  data_abertura       timestamptz,
  data_encerramento   timestamptz,

  link_sistema        text,
  itens_qtd           integer,       -- preenchido quando os itens já foram lidos
  itens_lidos_em      timestamptz,

  bruto               jsonb,         -- a resposta como veio: o dia em que faltar um campo, ele está aqui
  coletado_em         timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- a chave natural do PNCP. É por ela que o coletor faz upsert.
create unique index if not exists licitacoes_natural_uk on public.licitacoes (portal, cnpj, ano, sequencial);
create index if not exists licitacoes_pub_idx     on public.licitacoes (data_publicacao desc);
create index if not exists licitacoes_uf_idx      on public.licitacoes (uf);
create index if not exists licitacoes_abertura_idx on public.licitacoes (data_abertura);
-- busca textual no objeto: é como o operador procura ("dipirona", "material médico").
-- Português com acento é o caso normal aqui, então `portuguese` e não `simple`.
create index if not exists licitacoes_objeto_fts on public.licitacoes
  using gin (to_tsvector('portuguese', coalesce(objeto,'') || ' ' || coalesce(orgao,'')));

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Dado PÚBLICO do PNCP: qualquer logado LÊ (é o que a tela consome). ESCRITA só service_role
-- — e a service_role NUNCA vai pro CI: quem grava em produção é a edge function com segredo
-- dedicado (decisão do Lemuel, 05/08). Nem `authenticated` escreve aqui: a tela não coleta.
alter table public.licitacoes enable row level security;

drop policy if exists lic_sel on public.licitacoes;
drop policy if exists lic_ins on public.licitacoes;
drop policy if exists lic_upd on public.licitacoes;
drop policy if exists lic_del on public.licitacoes;

create policy lic_sel on public.licitacoes for select to authenticated using (true);
-- sem policy de insert/update/delete para `authenticated`: só a service_role (que ignora RLS)
-- e a edge function escrevem. Ausência de policy = negado, que é o padrão desejado aqui.

revoke all on public.licitacoes from anon;
grant select on public.licitacoes to authenticated;

-- ── CARIMBO DE FRESCOR ────────────────────────────────────────────────────────
-- A tela mostra "dados coletados às HH:MM". Sem um lugar único pra isso, cada tela inventaria
-- o seu — e uma delas mostraria a hora errada no dia em que a coleta falhasse no meio.
create table if not exists public.coleta_status (
  fonte         text primary key,          -- 'PNCP'
  ultima_ok     timestamptz,               -- última coleta que TERMINOU bem
  ultima_tentativa timestamptz,
  ultimo_erro   text,
  registros     integer,
  atualizado_em timestamptz not null default now()
);
alter table public.coleta_status enable row level security;
drop policy if exists cst_sel on public.coleta_status;
create policy cst_sel on public.coleta_status for select to authenticated using (true);
revoke all on public.coleta_status from anon;
grant select on public.coleta_status to authenticated;

notify pgrst, 'reload schema';
