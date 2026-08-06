-- ============================================================
-- FPMED — TABELA negocios (o funil de licitações)
-- Item 9, 06/08/2026. Aba NEGÓCIOS do módulo, espelhando o SIGA.
--
-- O QUE É: cada licitação que a FPMED decide acompanhar vira um NEGÓCIO, que caminha por 5
-- fases — Oportunidade → Qualificação → Disputa → Classificação → Contrato.
--
-- >>> POR QUE ELE NASCE CHEIO: as 2.555 linhas do `licitacoes_acompanhadas` (o Calendário 2025)
--     são o histórico real de participação da FPMED. Um funil vazio não se avalia; um funil com
--     dado real mostra na primeira abertura onde a empresa está.
--     Mas só 12 delas estão ABERTAS (abertura >= hoje). As outras 2.543 entram ARQUIVADAS —
--     elas alimentam o KPI de taxa de vitória, não o kanban. Kanban com 2.555 cartões não é
--     funil, é lista de tudo que já aconteceu, e ninguém arrasta nada nele.
--
-- `tarefas` é JSONB e não tabela própria: são 15 itens fixos por negócio, sempre lidos juntos,
-- e nunca consultados isoladamente. Tabela daria 38 mil linhas pra responder uma pergunta que
-- o card faz uma vez ("☑ n/15"). Se um dia houver relatório POR tarefa, aí sim vira tabela.
--
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.negocios (
  id             bigint generated always as identity primary key,
  empresa_id     bigint references public.empresas(id),
  -- de onde veio: a licitação acompanhada (histórico) ou a busca do PNCP (ponte Encontrar→Funil)
  acompanhada_id bigint references public.licitacoes_acompanhadas(id) on delete set null,
  licitacao_id   bigint references public.licitacoes(id) on delete set null,

  estagio        text not null default 'oportunidade'
                 check (estagio in ('oportunidade','qualificacao','disputa','classificacao','contrato')),
  arquivado      boolean not null default false,

  -- espelho do que a tela mostra no card (evita join em toda renderização do kanban)
  titulo         text,
  orgao          text,
  municipio      text,
  uf             text,
  portal         text,
  modalidade     text,
  numero         text,
  objeto         text,
  abertura       timestamptz,
  valor_estimado numeric,
  valor_ganho    numeric,

  tarefas        jsonb,          -- [{secao, texto, feita}] — 15 itens; NULL em arquivado
  anotacoes      text,
  origem         text not null default 'manual',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- um negócio por licitação acompanhada: sem isto, rodar o seed duas vezes duplica o funil
create unique index if not exists negocios_acompanhada_uk on public.negocios (acompanhada_id) where acompanhada_id is not null;
create index if not exists negocios_estagio_idx  on public.negocios (estagio) where not arquivado;
create index if not exists negocios_abertura_idx on public.negocios (abertura);
create index if not exists negocios_arq_idx      on public.negocios (arquivado);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- O funil carrega `valor_ganho` e a estratégia da empresa: é inteligência comercial, como a
-- Competitividade e a Compra Direta. Leitura de GESTOR.
alter table public.negocios enable row level security;

drop policy if exists neg_sel on public.negocios;
drop policy if exists neg_ins on public.negocios;
drop policy if exists neg_upd on public.negocios;
drop policy if exists neg_del on public.negocios;

create policy neg_sel on public.negocios for select to authenticated using (public.cargo_gestor());
create policy neg_ins on public.negocios for insert to authenticated with check (public.cargo_gestor());
create policy neg_upd on public.negocios for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy neg_del on public.negocios for delete to authenticated using (public.cargo_gestor());

revoke all on public.negocios from anon;
grant select, insert, update, delete on public.negocios to authenticated;

notify pgrst, 'reload schema';
