-- ============================================================
-- FPMED — HARDENING RLS (banco vazio, momento ideal)
-- Liga RLS em todas as tabelas + policy 'authenticated' (o app manda o JWT do usuario).
-- anon fica sem policy => nao le linha nenhuma e nao grava. Views passam a respeitar a RLS do chamador.
-- ============================================================

-- 1) RLS ON + policy authenticated (todas as operacoes) por tabela
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=t.tablename and policyname='authenticated_all'
    ) then
      execute format(
        'create policy authenticated_all on public.%I as permissive for all to authenticated using (true) with check (true)',
        t.tablename);
    end if;
  end loop;
end $$;

-- 2) Views respeitam a RLS de quem chama (security_invoker) => nao vazam dado pro anon
do $$
declare v record;
begin
  for v in select table_name from information_schema.views where table_schema='public' loop
    begin
      execute format('alter view public.%I set (security_invoker=on)', v.table_name);
    exception when others then null; end;
  end loop;
end $$;

-- 3) Recarrega o cache do PostgREST
notify pgrst, 'reload schema';

-- 4) VERIFICACAO (aparece no painel): rls_on deve ser true e policies=1 em cada tabela
select t.tablename,
       t.rowsecurity as rls_on,
       (select count(*) from pg_policies p
          where p.schemaname='public' and p.tablename=t.tablename) as policies
from pg_tables t
where t.schemaname='public'
order by t.tablename;
