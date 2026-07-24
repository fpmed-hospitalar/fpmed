-- ============================================================
-- FPMED — CONTROLE DE ACESSO POR CARGO (RLS no banco + view do vendedor)
-- Objetivo: o gate NÃO pode ser só no front (F12 burla). Aqui o Postgres/PostgREST
-- decide por CARGO lido do JWT (app_metadata.role — NÃO editável pelo usuário).
--
-- Cargos: diretor, gerente, vendedor, propostas   (legado 'admin' = diretor)
--   diretor / gerente = GESTOR (vê custo/fornecedor, telas de inteligência, grava e apaga)
--   vendedor / propostas = restrito (só preço de VENDA via view; não grava base; sem intel)
--
-- Seguro re-rodar: create or replace / drop if exists.
-- ============================================================

-- ── 1) CARGO do JWT ──────────────────────────────────────────────────────────
-- Lê app_metadata.role do JWT. Ausente/desconhecido => 'vendedor' (menor privilégio).
create or replace function public.jwt_cargo() returns text
language sql stable as $$
  select coalesce(
    nullif(lower(
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'
    ), ''),
    'vendedor'
  );
$$;

-- GESTOR = diretor ou gerente (admin legado conta como diretor).
create or replace function public.cargo_gestor() returns boolean
language sql stable as $$
  select public.jwt_cargo() in ('diretor','gerente','admin');
$$;

-- ── 2) VIEW DO VENDEDOR (cotacoes sem custo/fornecedor) ──────────────────────
-- Expõe só o lado de VENDA. venda_unit_forn = preço de venda já calculado no banco
-- (custo × 1,32) — o número de CUSTO nunca sai. security_invoker=false: a view roda
-- como dona (ignora a RLS da tabela base), então o vendedor lê a view mesmo sem poder
-- ler a tabela cotacoes direto.
drop view if exists public.cotacoes_vendedor;
create view public.cotacoes_vendedor with (security_invoker = false) as
  select
    id, tipo, codigo, produto, principio_ativo, und, vencimento, marca, estoque,
    global_venda1, global_venda2, venda_unit_calculada, venda_caixa_calculada,
    round((compra_unit * 1.32)::numeric, 6) as venda_unit_forn
  from public.cotacoes;
revoke all on public.cotacoes_vendedor from anon;
grant select on public.cotacoes_vendedor to authenticated;

-- ── 3) RLS por tabela ────────────────────────────────────────────────────────
-- Limpa TODAS as policies antigas do schema public (recomeça do zero).
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname='public'
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

-- Liga RLS em tudo (idempotente).
do $$
declare t text;
begin
  foreach t in array array[
    'fornecedores','cotacoes','clientes','compras','compra_itens',
    'orcamentos','itens_a_cotar','pedidos_compra','notas','cmed_dicionario'
  ] loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- === COTACOES: base só GESTOR lê (custo dentro); vendedor lê pela view. Grava/apaga = gestor.
create policy cot_sel on public.cotacoes for select to authenticated using (public.cargo_gestor());
create policy cot_ins on public.cotacoes for insert to authenticated with check (public.cargo_gestor());
create policy cot_upd on public.cotacoes for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy cot_del on public.cotacoes for delete to authenticated using (public.cargo_gestor());

-- === FORNECEDORES: inteligência — tudo gestor.
create policy for_sel on public.fornecedores for select to authenticated using (public.cargo_gestor());
create policy for_ins on public.fornecedores for insert to authenticated with check (public.cargo_gestor());
create policy for_upd on public.fornecedores for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy for_del on public.fornecedores for delete to authenticated using (public.cargo_gestor());

-- === COMPRAS / COMPRA_ITENS: histórico de cliente = inteligência — tudo gestor.
create policy cmp_sel on public.compras for select to authenticated using (public.cargo_gestor());
create policy cmp_ins on public.compras for insert to authenticated with check (public.cargo_gestor());
create policy cmp_upd on public.compras for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy cmp_del on public.compras for delete to authenticated using (public.cargo_gestor());
create policy cit_sel on public.compra_itens for select to authenticated using (public.cargo_gestor());
create policy cit_ins on public.compra_itens for insert to authenticated with check (public.cargo_gestor());
create policy cit_upd on public.compra_itens for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy cit_del on public.compra_itens for delete to authenticated using (public.cargo_gestor());

-- === ITENS_A_COTAR / PEDIDOS_COMPRA: inteligência/compras — tudo gestor.
create policy iac_sel on public.itens_a_cotar for select to authenticated using (public.cargo_gestor());
create policy iac_ins on public.itens_a_cotar for insert to authenticated with check (public.cargo_gestor());
create policy iac_upd on public.itens_a_cotar for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy iac_del on public.itens_a_cotar for delete to authenticated using (public.cargo_gestor());
create policy pdc_sel on public.pedidos_compra for select to authenticated using (public.cargo_gestor());
create policy pdc_ins on public.pedidos_compra for insert to authenticated with check (public.cargo_gestor());
create policy pdc_upd on public.pedidos_compra for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy pdc_del on public.pedidos_compra for delete to authenticated using (public.cargo_gestor());

-- === CLIENTES: todos logados leem e cadastram (o vendedor precisa p/ montar proposta);
--     editar/apagar só gestor.
create policy cli_sel on public.clientes for select to authenticated using (true);
create policy cli_ins on public.clientes for insert to authenticated with check (true);
create policy cli_upd on public.clientes for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy cli_del on public.clientes for delete to authenticated using (public.cargo_gestor());

-- === ORCAMENTOS: é o trabalho do vendedor — todos logados leem/criam/editam; apagar só gestor.
create policy orc_sel on public.orcamentos for select to authenticated using (true);
create policy orc_ins on public.orcamentos for insert to authenticated with check (true);
create policy orc_upd on public.orcamentos for update to authenticated using (true) with check (true);
create policy orc_del on public.orcamentos for delete to authenticated using (public.cargo_gestor());

-- === NOTAS: recado compartilhado — todos leem/criam/editam; apagar só gestor.
create policy not_sel on public.notas for select to authenticated using (true);
create policy not_ins on public.notas for insert to authenticated with check (true);
create policy not_upd on public.notas for update to authenticated using (true) with check (true);
create policy not_del on public.notas for delete to authenticated using (public.cargo_gestor());

-- === CMED_DICIONARIO: referência de match (giovana usa) — todos leem; escrever só gestor.
create policy cme_sel on public.cmed_dicionario for select to authenticated using (true);
create policy cme_ins on public.cmed_dicionario for insert to authenticated with check (public.cargo_gestor());
create policy cme_upd on public.cmed_dicionario for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy cme_del on public.cmed_dicionario for delete to authenticated using (public.cargo_gestor());

-- PostgREST: recarrega o cache de schema (pega a view nova).
notify pgrst, 'reload schema';
