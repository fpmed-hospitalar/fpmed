-- ============================================================
-- FPMED — TIRA O `anon` DAS 10 TABELAS DA PRIMEIRA GERAÇÃO (06/08/2026)
--
-- >>> ISTO NÃO FECHA UM VAZAMENTO — a RLS já segurava. Medido antes de mexer:
--       GET /rest/v1/cotacoes?select=id,produto,compra_unit&limit=3  (chave anon)
--       -> HTTP 200, corpo `[]`.  Nenhuma linha sai. A RLS estava certa.
--
-- >>> O QUE ISTO CORRIGE É O SINAL, e ele custou um dia de diagnóstico.
--     As tabelas da FPMED estão em duas gerações:
--       - 12 NOVAS (04/08 em diante): nasceram com `revoke all from anon`  -> sessão caída = 401
--       - 10 ANTIGAS (do rebrand de 22/07): mantiveram o GRANT padrão       -> sessão caída = 200 []
--     Quando a sessão cai, as telas que leem as ANTIGAS mostram LISTA VAZIA em silêncio, e as
--     que leem as NOVAS mostram a mensagem vermelha "permission denied ... GRANT SELECT ON
--     public.X TO anon". Era esse par que fazia o mesmo defeito parecer dois problemas — e é
--     por isso que o sistema da GlobalMed "não cai": lá NENHUMA tabela revoga o `anon`
--     (medido: 0 ocorrências de `revoke ... from anon` nos .sql de lá, contra 14 aqui), então
--     lá a sessão perdida vira tela vazia e ninguém percebe.
--
--     >>> TELA VAZIA EM SILÊNCIO É PIOR QUE ERRO VERMELHO. "0 produtos" numa busca de cotação
--         é uma frase que alguém acredita, e decide comprar em cima dela. O 401 é feio e é
--         honesto: diz que não deu pra perguntar, em vez de responder "não tem".
--
-- Nenhum SELECT/UPDATE/DELETE de dado aqui: só GRANT. E nenhuma policy serve o `anon` de
-- propósito (conferido em pg_policies antes de rodar). Seguro re-rodar.
-- ============================================================

revoke all on public.cotacoes        from anon;
revoke all on public.clientes        from anon;
revoke all on public.fornecedores    from anon;
revoke all on public.orcamentos      from anon;
revoke all on public.compras         from anon;
revoke all on public.compra_itens    from anon;
revoke all on public.itens_a_cotar   from anon;
revoke all on public.notas           from anon;
revoke all on public.pedidos_compra  from anon;
revoke all on public.cmed_dicionario from anon;

notify pgrst, 'reload schema';
