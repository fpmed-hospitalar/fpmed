-- ══════════════════════════════════════════════════════════════════════════════════════
--  RODE ISTO NO SQL EDITOR DO SUPABASE   ·   gerado pela A49 em 01/09/2026
--  Projeto: xzdowrksuswekwffoluk   ·   https://supabase.com/dashboard  >  SQL Editor
--
--  POR QUE VOCÊ ESTÁ RODANDO NA MÃO: eu tentei aplicar e fui barrado — mudança de
--  esquema em produção precisa da sua mão. O comando está pronto e conferido.
--
--  O QUE ELE CONSERTA, em uma frase: a view `v_portais` era a única das sete com acesso
--  do `anon` que rodava com os poderes do DONO do banco em vez dos poderes de quem chama.
--  VIEW NÃO TEM RLS. Então, na prática, qualquer pessoa com a chave pública (que está no
--  HTML publicado, num repositório público) lia essa view sem login.
--
--  O TAMANHO HONESTO: a view é um RESUMO — portal, quantas licitações, quantas abertas,
--  data da mais recente. Devolve UMA linha. Não sai nome de cliente, nem preço, nem item.
--  O que vazava era o PORTE da operação. Exposição real, gravidade baixa.
--
--  É SEGURO? Sim, medido antes: NENHUMA tela usa esta view. O seletor de portais do
--  fpmed_licitacoes.html é montado a partir do resultado da busca (função populaPortais),
--  não daqui. Depois de rodar, nada muda na tela.
--
--  E SE DER ERRADO? É reversível, o desfazer está no rodapé deste arquivo.
-- ══════════════════════════════════════════════════════════════════════════════════════

-- 1) O conserto de verdade: a view passa a rodar com os direitos de QUEM CHAMA,
--    e aí o RLS da tabela `licitacoes` volta a valer para ela.
alter view public.v_portais set (security_invoker = on);

-- 2) Tira do `anon` os sete privilégios que o banco deu e que NUNCA estiveram no arquivo
--    versionado (ddl/busca_licitacoes.sql sempre disse apenas `to authenticated`).
--    A escrita já era inerte porque a view não é atualizável — mas privilégio inerte que
--    ninguém revoga volta a morder no dia em que a view muda de forma.
revoke all on public.v_portais from anon;

-- 3) Confirma o que deve continuar existindo: quem está logado lê normalmente.
grant select on public.v_portais to authenticated;


-- ── CONFIRA QUE FUNCIONOU (rode junto, é só leitura) ──────────────────────────────────
-- Esperado: opcoes = 'security_invoker=on'  e  privilegios_do_anon = 0
select coalesce(array_to_string(c.reloptions, ','), '(NENHUMA - ainda aberto!)') as opcoes,
       (select count(*)
          from information_schema.role_table_grants
         where table_schema = 'public'
           and table_name   = 'v_portais'
           and grantee      = 'anon')::int as privilegios_do_anon
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'v_portais';


-- ── DESFAZER (só se algo quebrar) ─────────────────────────────────────────────────────
-- alter view public.v_portais set (security_invoker = off);
-- grant select on public.v_portais to anon;
