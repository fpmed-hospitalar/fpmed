-- ============================================================
-- FPMED — FECHA A TABELA `perfis` (correção de SEGURANÇA, 06/08/2026)
--
-- >>> O QUE ESTAVA ABERTO, e como foi medido:
--     o `ddl/03_perfis_e_papeis.sql` do kit CRIA a tabela `perfis` e **não liga RLS, não cria
--     policy e não tira o `anon`**. No Supabase, tabela nova em `public` já nasce com
--     `GRANT ALL ... TO anon` por privilégio padrão — então, sem RLS, a tabela fica legível e
--     GRAVÁVEL por qualquer um que tenha a chave anon. A chave anon da FPMED está no HTML de um
--     repositório **público**.
--     MEDIDO em 06/08, com a anon real, pela internet:
--       GET /rest/v1/perfis?select=email,papel,ativo  ->  HTTP 200 + os 2 e-mails da equipe.
--     Os GRANTs mostram que `anon` também tem INSERT/UPDATE/DELETE. NÃO testei escrita — provar
--     um buraco escrevendo em produção é abri-lo de novo.
--
-- >>> POR QUE ISSO É PIOR DO QUE PARECE HOJE. Agora `perfis` ainda não é o portão do sistema
--     (quem manda é o `cargo_gestor()` do app_metadata, de 24/07). Mas o `05_rls_e_policies.sql`
--     do kit — que está PARADO esperando OK — transforma `perfis` no portão. Se ele subisse com
--     a tabela aberta, "quem manda no sistema" seria uma tabela que a internet inteira escreve.
--
-- >>> POR QUE ESTE ARQUIVO EXISTE EM VEZ DE "RODA O 05". O 05 faz duas coisas muito diferentes:
--     (a) fecha `perfis`, que é urgente e não tem risco; (b) liga RLS **restritiva** em
--     `cotacoes` com a trava "ninguém sem perfil", que é a migração parada — se ela subir e os
--     perfis não gravarem, NINGUÉM entra no sistema. Este arquivo é a metade (a), palavra por
--     palavra do 05, **com os mesmos nomes de policy** — de modo que rodar o 05 depois
--     substitui estas policies em vez de duplicá-las.
--
-- >>> NÃO HÁ RECURSÃO: `limedtec_pode()` é SECURITY DEFINER (dona: a role do banco), e a dona da
--     tabela não passa pela RLS dela — é exatamente por isso que o kit a criou assim. Uma policy
--     que consultasse `perfis` direto entraria em laço infinito.
--
-- Nada aqui apaga dado. Seguro re-rodar.
-- ============================================================

alter table public.perfis enable row level security;

drop policy if exists perfis_gestor_escreve on public.perfis;
create policy perfis_gestor_escreve on public.perfis for all
  using (limedtec_pode('gerir_usuarios'::text)) with check (limedtec_pode('gerir_usuarios'::text));

drop policy if exists perfis_gestor_le on public.perfis;
create policy perfis_gestor_le on public.perfis for select
  using (limedtec_pode('gerir_usuarios'::text));

-- cada um lê o PRÓPRIO perfil: é disto que o `limedtec-sessao.js` precisa pra saber o papel de
-- quem entrou. Sem esta, só gestor descobriria o próprio papel e o vendedor cairia em "não
-- consegui confirmar seu perfil" — bloqueio total, com o banco funcionando perfeitamente.
drop policy if exists perfis_le_o_proprio on public.perfis;
create policy perfis_le_o_proprio on public.perfis for select using ((id = auth.uid()));

-- e o `anon` sai de vez. Com RLS ligada ele já não passaria (RLS nega por omissão), mas o GRANT
-- continuar de pé é uma porta destrancada esperando alguém desligar a RLS por engano num
-- `alter table` futuro. Todo DDL deste projeto revoga; o do kit não revogava.
revoke all on public.perfis from anon;

notify pgrst, 'reload schema';
