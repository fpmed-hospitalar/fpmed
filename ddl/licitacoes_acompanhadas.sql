-- ============================================================
-- FPMED — TABELA licitacoes_acompanhadas (o histórico próprio de participação)
-- Item 8 FASE 2, 05/08/2026. Liberada pelo Lemuel.
--
-- O QUE É: as 2.578 linhas da aba AGENDA do `Calendario 2025.xlsm` — o que a FPMED acompanhou,
-- o que disputou, em que portal, por qual órgão e **quanto ganhou**. É o único dado do módulo
-- de Licitações que não vem do PNCP: é a memória da própria empresa.
--
-- >>> POR QUE ELE VALE MAIS QUE O DADO DO PNCP: o PNCP diz o que EXISTE; isto diz o que a FPMED
--     FEZ. Taxa de participação e de vitória por órgão, por portal e por modalidade só sai
--     daqui. É o embrião do "Análise de Empresas" do SIGA — com a vantagem de ser sobre nós,
--     que é justamente o que o SIGA não tem.
--
-- `origem` separa o que veio da planilha do que a tela gravar depois. Sem isso, no dia de
-- corrigir uma carga não há como desfazer só ela.
--
-- ⚠️ `valor_ganho` é DADO COMERCIAL. A RLS abaixo é de GESTOR para leitura — e o `.xlsm` de
--    origem está no `.gitignore` desde 05/08 justamente por causa desta coluna, num repo público.
--
-- Loader: tools/carrega_calendario.js   (preview por padrão; grava com --apply)
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.licitacoes_acompanhadas (
  id             bigint generated always as identity primary key,
  origem         text not null default 'calendario_2025',
  status         text,                    -- EM ANALISE / PARTICIPAR / ... (vocabulário da planilha)
  abertura       date,
  hora           text,                    -- HH:MM (texto: é hora de sessão, não instante com fuso)
  modalidade     text,                    -- P.E. / D.L.
  numero_compra  text,
  numero         text,                    -- nn/aaaa, normalizado pelo mesmo numCompra() do Licitações
  portal         text,                    -- BLL / COMPRAS PUBLICAS / PROPRIO ...
  cidade         text,
  uf             text,
  orgao          text,
  objeto         text,
  valor_ganho    numeric,
  observacao     text,
  linha_planilha integer,                 -- de onde veio, pra auditoria conseguir voltar na origem
  criado_em      timestamptz not null default now()
);

create index if not exists lic_ac_abertura_idx on public.licitacoes_acompanhadas (abertura);
create index if not exists lic_ac_orgao_idx    on public.licitacoes_acompanhadas (orgao);
create index if not exists lic_ac_portal_idx   on public.licitacoes_acompanhadas (portal);
create index if not exists lic_ac_origem_idx   on public.licitacoes_acompanhadas (origem);
-- ganhas: o caminho quente do KPI de taxa de vitória
create index if not exists lic_ac_ganho_idx    on public.licitacoes_acompanhadas (valor_ganho) where valor_ganho > 0;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Spec do módulo (04/08): **gestor grava, logado lê**. Mas `valor_ganho` mudou o cálculo:
-- quanto a empresa ganhou em cada disputa é informação de resultado, não de operação. Leitura
-- de GESTOR, igual à Competitividade e à Compra Direta. Se um dia o vendedor precisar do
-- histórico sem o valor, o caminho é uma VIEW sem a coluna — não afrouxar isto aqui.
alter table public.licitacoes_acompanhadas enable row level security;

drop policy if exists lac_sel on public.licitacoes_acompanhadas;
drop policy if exists lac_ins on public.licitacoes_acompanhadas;
drop policy if exists lac_upd on public.licitacoes_acompanhadas;
drop policy if exists lac_del on public.licitacoes_acompanhadas;

create policy lac_sel on public.licitacoes_acompanhadas for select to authenticated using (public.cargo_gestor());
create policy lac_ins on public.licitacoes_acompanhadas for insert to authenticated with check (public.cargo_gestor());
create policy lac_upd on public.licitacoes_acompanhadas for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy lac_del on public.licitacoes_acompanhadas for delete to authenticated using (public.cargo_gestor());

revoke all on public.licitacoes_acompanhadas from anon;
grant select, insert, update, delete on public.licitacoes_acompanhadas to authenticated;

notify pgrst, 'reload schema';
