-- ==============================================================================================
-- LIMEDTEC - INSTALACAO DE CLIENTE - 03 - PERFIS, PAPEIS E A TRAVA DO ULTIMO GESTOR
--
-- GERADO por tools/gera_ddl_instalacao.js a partir do schema REAL de um banco em producao.
-- NAO EDITE A MAO: regenere. Um DDL editado a mao deixa de descrever o banco no primeiro ALTER.
--
-- IDEMPOTENTE: rodar duas vezes nao quebra e nao apaga nada. Todo create e "if not exists" e todo
-- policy/trigger e precedido de "drop ... if exists" - que e o unico jeito de reaplicar sem erro.
-- NENHUM comando deste arquivo apaga tabela, coluna ou linha.
--
-- ORDEM DE CONFIANCA: a RLS e a seguranca; a tela e cortesia. Esconder o campo de custo no HTML
-- nao impede ninguem de abrir o F12 e chamar GET /rest/v1/cotacoes?select=compra_unit com o
-- proprio token. Enquanto este arquivo nao estiver no ar, "o vendedor nao ve custo" e uma frase
-- sobre a interface, nao sobre o sistema.
--
-- >>> A TRAVA DO ULTIMO GESTOR e constraint trigger DEFERIDA (checa no commit): uma troca legitima
--     pode passar por um estado invalido DENTRO da transacao, e o que importa e o estado final.
--     Sem ela, o ultimo gestor que se rebaixasse trancaria todo mundo pra sempre, e nao existe
--     tela que desfaca - so acesso direto ao banco.
-- >>> E O PRIMEIRO GESTOR TEM QUE ENTRAR A MAO: a policy de escrita em perfis exige
--     gerir_usuarios, que so o gestor tem. Sem a linha do fim deste arquivo, ninguem cria ninguem.
-- ==============================================================================================

create table if not exists perfis (
  id uuid not null,
  email text not null,
  papel text not null,
  ativo boolean default true not null,
  permissoes jsonb default '{}'::jsonb not null,
  criado_em timestamp with time zone default now() not null,
  criado_por uuid,
  atualizado_em timestamp with time zone default now() not null,
  primary key (id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_criado_por_fkey') then
    alter table perfis add constraint perfis_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_id_fkey') then
    alter table perfis add constraint perfis_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_papel_check') then
    alter table perfis add constraint perfis_papel_check CHECK ((papel = ANY (ARRAY['vendedor'::text, 'gerente'::text, 'gestor_geral'::text, 'dono_produto'::text])));
  end if;
end $$;
create index if not exists perfis_papel_idx on perfis(papel) where ativo;

create or replace FUNCTION public.limedtec_exige_gestor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (select count(*) from perfis where papel = 'gestor_geral' and ativo) = 0 then
    raise exception 'LIMEDTEC: esta mudanca deixaria o sistema sem nenhum gestor_geral ativo, e so o gestor consegue mexer em perfis. Promova outra pessoa antes.';
  end if;
  return null;
end $function$
;

create or replace FUNCTION public.limedtec_papel()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select papel from perfis where id = auth.uid() and ativo
$function$
;

create or replace FUNCTION public.limedtec_pode(chave text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pf record; padrao boolean;
begin
  select papel, permissoes into pf from perfis where id = auth.uid() and ativo;
  if pf is null then return false; end if;
  padrao := case
    when pf.papel = 'gestor_geral' then true
    when pf.papel = 'gerente' then chave in ('cotar','gerar_documento','ver_custo','ver_paineis','cadastrar')
    when pf.papel = 'vendedor' then chave in ('cotar','gerar_documento')
    when pf.papel = 'dono_produto' then chave in ('ver_paineis')
    else false end;
  if pf.papel = 'gerente'
     and chave not in ('gerir_usuarios','configurar','importar')
     and pf.permissoes ? chave then
    return (pf.permissoes ->> chave)::boolean;
  end if;
  return padrao;
end $function$
;

drop trigger if exists perfis_exige_gestor on perfis;
CREATE CONSTRAINT TRIGGER perfis_exige_gestor AFTER DELETE OR UPDATE ON public.perfis DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION limedtec_exige_gestor();

-- ── O PRIMEIRO GESTOR (rodar DEPOIS de criar o usuario no Auth) ────────────────────────────────
-- >>> PREENCHER: o uuid sai de auth.users depois que a pessoa for criada no painel do Supabase.
-- insert into perfis (id, email, papel)
--   values ('<uuid do auth.users>', '<email do gestor>', 'gestor_geral')
--   on conflict (id) do update set papel='gestor_geral', ativo=true;
