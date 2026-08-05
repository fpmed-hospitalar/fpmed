-- ============================================================
-- FPMED — TABELA cmed_precos (grade completa de preços da CMED, por GGREM)
-- Item 1B da fila, 05/08/2026. Complementa a `cmed_pf` — NÃO a substitui.
--
-- POR QUE UMA TABELA SEPARADA, e não colunas novas na cmed_pf:
--   1. O PMVG vem de OUTRA publicação da ANVISA (lista "conformidade_gov"), com cadência
--      própria. A `cmed_pf` é carregada da lista "conformidade_site".
--   2. A carga da `cmed_pf` é DESTRUTIVA por desenho (insere a edição nova e APAGA a
--      anterior). Se o PMVG morasse lá dentro, toda recarga de PF apagaria o PMVG em
--      silêncio até alguém lembrar de recarregar o arquivo do governo também.
--   3. `ggrem` é 100% preenchido e ÚNICO nas 25.702 linhas da cmed_pf (medido em 05/08) —
--      é chave de junção 1:1 confiável, não um "quase".
--   4. Carga aditiva: tabela nova + INSERT. Nenhum DELETE/UPDATE em dado existente.
--
-- O QUE GUARDA: a grade de alíquotas inteira das duas listas, para o mesmo GGREM.
--   PF   (Preço Fábrica)              — teto de venda no mercado, vem nas duas listas
--   PMC  (Preço Máximo ao Consumidor) — lista do site
--   PMVG (Preço Máx. de Venda ao Governo) = PF × (1 − CAP) — lista do governo
--        >>> É O TETO LEGAL NAS LICITAÇÕES. É o número que faltava no sistema.
--
-- As 26 alíquotas de cada régua ficam em JSONB (`pf_aliq`, `pmc_aliq`, `pmvg_aliq`) em vez
-- de 78 colunas numéricas: a tela precisa mostrar "a alíquota do estado de destino", e uma
-- coluna por alíquota vira migração toda vez que um estado mexe no ICMS. As três de GOIÁS
-- (19%) ficam materializadas em coluna própria porque são o caminho quente de consulta.
--
-- ⚠️ Preço da CMED é POR EMBALAGEM. Para régua unitária, dividir por `cmed_pf.qtd_apres`.
--
-- Loader: tools/carrega_cmed_precos.js   (preview por padrão; grava com --apply)
-- Seguro re-rodar (create if not exists / drop policy if exists).
-- ============================================================

create table if not exists public.cmed_precos (
  ggrem              text primary key,   -- CÓDIGO GGREM — junta 1:1 com cmed_pf.ggrem
  cnpj               text,               -- CNPJ do detentor do registro
  regime_preco       text,               -- Regulado | Liberado (Res. CMED 02/2019)

  -- caminho quente: alíquota modal de GOIÁS (19% desde 01/04/2024, Lei 22.460/2023)
  pf_go19            numeric,
  pmc_go19           numeric,
  pmvg_go19          numeric,            -- ← o teto legal de venda ao governo em GO

  -- isenção e base sem imposto (usadas quando o edital pede preço desonerado)
  pf_0               numeric,
  pmc_0              numeric,
  pmvg_0             numeric,
  pf_sem_imposto     numeric,
  pmc_sem_imposto    numeric,
  pmvg_sem_imposto   numeric,

  -- grade completa: {"0":30.73,"12":34.92,"12 ALC":31.18,...,"23 ALC":35.63}
  pf_aliq            jsonb,
  pmc_aliq           jsonb,
  pmvg_aliq          jsonb,

  -- marcadores regulatórios (booleanos do "Sim"/"Não" da planilha)
  cap                boolean,            -- Sim = desconto obrigatório pro governo → USAR PMVG
  confaz87           boolean,
  icms0              boolean,            -- Sim = isento de ICMS (preços marcados com * na lista)
  restricao_hosp     boolean,            -- uso restrito a hospital/clínica: não vende pelo PMC

  -- texto informativo
  analise_recursal   text,               -- preço sob recurso na CMED — o teto pode mudar
  lista_pis_cofins   text,               -- Positiva | Negativa | Neutra
  comercializacao    text,               -- COMERCIALIZAÇÃO 2025 (Sim/Não)
  tarja              text,
  destinacao         text,               -- DESTINAÇÃO COMERCIAL

  publicada_site     date,               -- edição da lista do site  (PF/PMC)
  publicada_gov      date,               -- edição da lista do governo (PF/PMVG)
  created_at         timestamptz default now()
);

-- Caminhos de consulta reais da tela: "só quem tem PMVG", "só CAP", "só restrição hospitalar".
create index if not exists cmed_precos_pmvg_idx  on public.cmed_precos (pmvg_go19) where pmvg_go19 is not null;
create index if not exists cmed_precos_cap_idx   on public.cmed_precos (cap)   where cap;
create index if not exists cmed_precos_rh_idx    on public.cmed_precos (restricao_hosp) where restricao_hosp;
create index if not exists cmed_precos_cnpj_idx  on public.cmed_precos (cnpj);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Dado PÚBLICO da ANVISA: nenhum custo nosso, nenhuma identidade de fornecedor.
-- Todo logado LÊ (o vendedor precisa da régua e do teto legal); escrever é só gestor.
-- Mesmo tratamento da cmed_pf (db_cmed_pf.sql).
alter table public.cmed_precos enable row level security;

drop policy if exists cpr_sel on public.cmed_precos;
drop policy if exists cpr_ins on public.cmed_precos;
drop policy if exists cpr_upd on public.cmed_precos;
drop policy if exists cpr_del on public.cmed_precos;

create policy cpr_sel on public.cmed_precos for select to authenticated using (true);
create policy cpr_ins on public.cmed_precos for insert to authenticated with check (public.cargo_gestor());
create policy cpr_upd on public.cmed_precos for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy cpr_del on public.cmed_precos for delete to authenticated using (public.cargo_gestor());

revoke all on public.cmed_precos from anon;
grant select on public.cmed_precos to authenticated;
grant insert, update, delete on public.cmed_precos to authenticated;

-- ── A VISÃO QUE A TELA CONSOME ───────────────────────────────────────────────
-- Junta a identificação (cmed_pf) com a grade de preços (cmed_precos) e já entrega o
-- UNITÁRIO, que é a régua com que o resto do sistema compara. security_invoker: a view
-- não pode virar porta dos fundos — quem consulta usa as permissões dele, e as duas
-- tabelas liberam SELECT pra qualquer logado de propósito.
create or replace view public.cmed_regua
  with (security_invoker = on) as
select
  p.ggrem, p.subst_norm, p.marca_norm, p.apresentacao, p.dose_key,
  coalesce(nullif(p.qtd_apres, 0), 1)                              as qtd_apres,
  p.laboratorio, p.tipo_produto, p.tarja, p.classe_terapeutica,
  p.ean1, p.registro, p.publicada,
  c.cnpj, c.regime_preco,
  c.pf_go19, c.pmc_go19, c.pmvg_go19, c.pf_0, c.pmc_0, c.pmvg_0,
  c.pf_aliq, c.pmc_aliq, c.pmvg_aliq,
  c.cap, c.confaz87, c.icms0, c.restricao_hosp,
  c.analise_recursal, c.lista_pis_cofins, c.destinacao,
  -- unitários: teto por UNIDADE, que é como a Competitividade e o Licitações comparam
  round(c.pf_go19   / coalesce(nullif(p.qtd_apres, 0), 1), 4)      as pf_unit,
  round(c.pmc_go19  / coalesce(nullif(p.qtd_apres, 0), 1), 4)      as pmc_unit,
  round(c.pmvg_go19 / coalesce(nullif(p.qtd_apres, 0), 1), 4)      as pmvg_unit,
  -- teto que VALE numa compra pública: com CAP, o teto é o PMVG; sem CAP, é o PF.
  round(coalesce(case when c.cap then c.pmvg_go19 end, c.pf_go19)
        / coalesce(nullif(p.qtd_apres, 0), 1), 4)                  as teto_gov_unit
from public.cmed_pf p
left join public.cmed_precos c on c.ggrem = p.ggrem;

grant select on public.cmed_regua to authenticated;

-- PostgREST: recarrega o cache de schema (tabela nova não aparece sem isto).
notify pgrst, 'reload schema';
