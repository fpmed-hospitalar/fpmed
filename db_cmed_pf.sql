-- ============================================================
-- FPMED — TABELA cmed_pf (referência de preço da ANVISA/CMED)
-- Bloco 3 do sync com a Global, portado em 04/08/2026.
--
-- O QUE É: a lista oficial de preços máximos da CMED (planilha "xls_conformidade_site_*.xlsx",
-- publicada mensalmente em gov.br/anvisa → medicamentos → cmed → preços). Serve de RÉGUA
-- independente: dá pra saber se um preço está caro sem depender de ter concorrente cotando.
--
-- PF = Preço Fábrica. Guardamos PF 0% e PF 19% (alíquota modal de GOIÁS desde 01/04/2024,
-- Lei 22.460/2023). PMC entra como informação; a régua do B2B é o PF.
-- ⚠️ O PF da CMED é por EMBALAGEM — `qtd_apres` existe pra dividir e chegar no preço unitário.
--
-- A tabela guarda SÓ A EDIÇÃO VIGENTE (`publicada`). Carga nova remove a anterior —
-- reverter = rodar o loader com a planilha antiga. Loader: tools/carrega_cmed_pf.js
--
-- Seguro re-rodar (create if not exists / drop policy if exists).
-- ============================================================

create table if not exists public.cmed_pf (
  id                 bigint generated always as identity primary key,
  subst_norm         text,          -- SUBSTÂNCIA normalizada (';' da CMED vira ' + ' p/ marcar combo)
  marca_norm         text,          -- PRODUTO (nome comercial) normalizado
  apresentacao       text,
  dose_key           text,          -- doseKey REAL da tela aplicado na APRESENTAÇÃO
  qtd_apres          integer,       -- unidades na embalagem (PF é por embalagem — dividir por isto)
  pf_go19            numeric,       -- PF 19% (alíquota de GO)
  pf_0               numeric,       -- PF 0% (isenção)
  pmc                numeric,       -- PMC 19% (consumidor; informativo)
  pmvg               numeric,       -- lista CAP/PMVG é outro arquivo da ANVISA — fica NULL até baixarem
  restricao_hosp     text,
  laboratorio        text,
  tipo_produto       text,          -- GENÉRICO / SIMILAR / NOVO ...
  tarja              text,
  ean1               text,
  ean2               text,
  ean3               text,
  ggrem              text,
  registro           text,
  classe_terapeutica text,
  cap                text,
  confaz87           text,
  comercializacao    text,
  publicada          date not null, -- data da edição ("Publicada em dd/mm/aaaa" no topo da planilha)
  created_at         timestamptz default now()
);

-- Índices dos caminhos de consulta reais (busca por substância, marca, dose e código de barras).
create index if not exists cmed_pf_subst_idx  on public.cmed_pf (subst_norm);
create index if not exists cmed_pf_marca_idx  on public.cmed_pf (marca_norm);
create index if not exists cmed_pf_dose_idx   on public.cmed_pf (dose_key);
create index if not exists cmed_pf_ean1_idx   on public.cmed_pf (ean1);
create index if not exists cmed_pf_edicao_idx on public.cmed_pf (publicada);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- É dado PÚBLICO da ANVISA: não tem custo nosso nem identidade de fornecedor dentro.
-- Todo logado LÊ (o vendedor precisa da régua pra montar proposta); escrever é só gestor.
-- Mesmo tratamento do cmed_dicionario no db_rls_cargos.sql.
alter table public.cmed_pf enable row level security;

drop policy if exists cpf_sel on public.cmed_pf;
drop policy if exists cpf_ins on public.cmed_pf;
drop policy if exists cpf_upd on public.cmed_pf;
drop policy if exists cpf_del on public.cmed_pf;

create policy cpf_sel on public.cmed_pf for select to authenticated using (true);
create policy cpf_ins on public.cmed_pf for insert to authenticated with check (public.cargo_gestor());
create policy cpf_upd on public.cmed_pf for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy cpf_del on public.cmed_pf for delete to authenticated using (public.cargo_gestor());

revoke all on public.cmed_pf from anon;
grant select on public.cmed_pf to authenticated;
grant insert, update, delete on public.cmed_pf to authenticated;

-- PostgREST: recarrega o cache de schema (tabela nova não aparece sem isto).
notify pgrst, 'reload schema';
