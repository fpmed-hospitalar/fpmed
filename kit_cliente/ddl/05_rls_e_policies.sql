-- ==============================================================================================
-- LIMEDTEC - INSTALACAO DE CLIENTE - 05 - RLS E POLICIES
--
-- GERADO por tools/gera_ddl_instalacao.js a partir do schema REAL de um banco em producao.
-- NAO EDITE A MAO: regenere. Um DDL editado a mao deixa de descrever o banco no primeiro ALTER.
--
-- IDEMPOTENTE: rodar duas vezes nao quebra e nao apaga nada. Todo create e "if not exists" e todo
-- policy/trigger e precedido de "drop ... if exists" - que e o unico jeito de reaplicar sem erro.
-- NENHUM comando deste arquivo apaga tabela, coluna ou linha.
--
-- >>> RESTRICTIVE E "E", PERMISSIVE E "OU". Esta e a linha que faz a promessa virar sistema.
--     O banco tem a policy auth_all com using(true) - dela todo o resto do sistema depende.
--     Acrescentar "pode_ver_custo" como PERMISSIVA daria  true OR pode_ver_custo = sempre true,
--     e a policy nova seria decoracao: DDL aplicado, seguranca zero, com aparencia de protecao.
--     RESTRICTIVE e AND: true AND pode_ver_custo. Nao mexer nisto sem entender.
--
-- >>> NAO RODE PELA METADE. Ligar RLS sem as policies tranca TODO MUNDO, inclusive o gestor.
--     Este arquivo inteiro e uma transacao so, e por isso.
--
-- >>> O TESTE DIZ QUANDO NAO CONSEGUE TESTAR: tabela vazia devolve "0 linhas" pra todo mundo, e
--     isso nao prova nada. Num cliente recem-instalado quase tudo esta vazio - a prova de que a
--     RLS funciona so vem depois da primeira carga, com o tools/red_test_papeis.js.
-- ==============================================================================================

begin;

alter table clientes enable row level security;
alter table cmed_pf enable row level security;
alter table comissoes_externas enable row level security;
alter table comissoes_isadora enable row level security;
alter table compra_itens enable row level security;
alter table compras enable row level security;
alter table contatos_industria enable row level security;
alter table cotacoes enable row level security;
alter table fornecedores enable row level security;
alter table historico_precos enable row level security;
alter table itens_a_cotar enable row level security;
alter table notas enable row level security;
alter table orcamentos enable row level security;
alter table pedidos_compra enable row level security;
alter table perfis enable row level security;
alter table precos_relatados enable row level security;
alter table prospeccoes enable row level security;
alter table prospects enable row level security;
alter table saidas_siad enable row level security;

drop policy if exists auth_all on clientes;
create policy auth_all on clientes for all using (true) with check (true);
drop policy if exists cotar_clientes on clientes;
create policy cotar_clientes on clientes as restrictive for select using (limedtec_pode('cotar'::text));
drop policy if exists auth_all on cmed_dicionario;
create policy auth_all on cmed_dicionario for all using (true) with check (true);
drop policy if exists cmed_pf_read on cmed_pf;
create policy cmed_pf_read on cmed_pf for select using (true);
drop policy if exists cotar_cmed_pf on cmed_pf;
create policy cotar_cmed_pf on cmed_pf as restrictive for select using (limedtec_pode('cotar'::text));
drop policy if exists auth_all on comissoes_externas;
create policy auth_all on comissoes_externas for all using (true) with check (true);
drop policy if exists paineis_comissoes_ext on comissoes_externas;
create policy paineis_comissoes_ext on comissoes_externas as restrictive for select using (limedtec_pode('ver_paineis'::text));
drop policy if exists auth_all on comissoes_isadora;
create policy auth_all on comissoes_isadora for all using (true) with check (true);
drop policy if exists paineis_comissoes_isadora on comissoes_isadora;
create policy paineis_comissoes_isadora on comissoes_isadora as restrictive for select using (limedtec_pode('ver_paineis'::text));
drop policy if exists auth_all on compra_itens;
create policy auth_all on compra_itens for all using (true) with check (true);
drop policy if exists paineis_compra_itens on compra_itens;
create policy paineis_compra_itens on compra_itens as restrictive for select using (limedtec_pode('ver_paineis'::text));
drop policy if exists auth_all on compras;
create policy auth_all on compras for all using (true) with check (true);
drop policy if exists paineis_compras on compras;
create policy paineis_compras on compras as restrictive for select using (limedtec_pode('ver_paineis'::text));
drop policy if exists cad_contatos_industria on contatos_industria;
create policy cad_contatos_industria on contatos_industria as restrictive for select using (limedtec_pode('cadastrar'::text));
drop policy if exists ci_insercao on contatos_industria;
create policy ci_insercao on contatos_industria for insert with check (true);
drop policy if exists ci_leitura on contatos_industria;
create policy ci_leitura on contatos_industria for select using (true);
drop policy if exists ci_update on contatos_industria;
create policy ci_update on contatos_industria for update using (true);
drop policy if exists auth_all on cotacoes;
create policy auth_all on cotacoes for all using (true) with check (true);
drop policy if exists cotacoes_custo on cotacoes;
create policy cotacoes_custo on cotacoes as restrictive for select using (limedtec_pode('ver_custo'::text));
drop policy if exists cotacoes_edicao on cotacoes;
create policy cotacoes_edicao on cotacoes as restrictive for update using (limedtec_pode('cadastrar'::text));
drop policy if exists cotacoes_escrita on cotacoes;
create policy cotacoes_escrita on cotacoes as restrictive for insert with check (limedtec_pode('cadastrar'::text));
drop policy if exists auth_all on fornecedores;
create policy auth_all on fornecedores for all using (true) with check (true);
drop policy if exists cad_fornecedores on fornecedores;
create policy cad_fornecedores on fornecedores as restrictive for select using (limedtec_pode('cadastrar'::text));
drop policy if exists hp_auth_all on historico_precos;
create policy hp_auth_all on historico_precos for all using (true) with check (true);
drop policy if exists paineis_historico_precos on historico_precos;
create policy paineis_historico_precos on historico_precos as restrictive for select using (limedtec_pode('ver_paineis'::text));
drop policy if exists cotar_itens_a_cotar on itens_a_cotar;
create policy cotar_itens_a_cotar on itens_a_cotar as restrictive for select using (limedtec_pode('cotar'::text));
drop policy if exists p_itens_a_cotar_auth on itens_a_cotar;
create policy p_itens_a_cotar_auth on itens_a_cotar for all using (true) with check (true);
drop policy if exists auth_all on notas;
create policy auth_all on notas for all using (true) with check (true);
drop policy if exists paineis_notas on notas;
create policy paineis_notas on notas as restrictive for select using (limedtec_pode('ver_paineis'::text));
drop policy if exists auth_all on orcamentos;
create policy auth_all on orcamentos for all using (true) with check (true);
drop policy if exists cotar_orcamentos on orcamentos;
create policy cotar_orcamentos on orcamentos as restrictive for select using (limedtec_pode('cotar'::text));
drop policy if exists auth_all on pedidos_compra;
create policy auth_all on pedidos_compra for all using (true) with check (true);
drop policy if exists paineis_pedidos_compra on pedidos_compra;
create policy paineis_pedidos_compra on pedidos_compra as restrictive for select using (limedtec_pode('ver_paineis'::text));
drop policy if exists perfis_gestor_escreve on perfis;
create policy perfis_gestor_escreve on perfis for all using (limedtec_pode('gerir_usuarios'::text)) with check (limedtec_pode('gerir_usuarios'::text));
drop policy if exists perfis_gestor_le on perfis;
create policy perfis_gestor_le on perfis for select using (limedtec_pode('gerir_usuarios'::text));
drop policy if exists perfis_le_o_proprio on perfis;
create policy perfis_le_o_proprio on perfis for select using ((id = auth.uid()));
drop policy if exists paineis_precos_relatados on precos_relatados;
create policy paineis_precos_relatados on precos_relatados as restrictive for select using (limedtec_pode('ver_paineis'::text));
drop policy if exists prel_ins on precos_relatados;
create policy prel_ins on precos_relatados for insert with check (true);
drop policy if exists prel_read on precos_relatados;
create policy prel_read on precos_relatados for select using (true);
drop policy if exists auth_all on prospeccoes;
create policy auth_all on prospeccoes for all using (true) with check (true);
drop policy if exists cotar_prospeccoes on prospeccoes;
create policy cotar_prospeccoes on prospeccoes as restrictive for select using (limedtec_pode('cotar'::text));
drop policy if exists auth_all on prospects;
create policy auth_all on prospects for all using (true) with check (true);
drop policy if exists cotar_prospects on prospects;
create policy cotar_prospects on prospects as restrictive for select using (limedtec_pode('cotar'::text));
drop policy if exists paineis_saidas_siad on saidas_siad;
create policy paineis_saidas_siad on saidas_siad as restrictive for select using (limedtec_pode('ver_paineis'::text));
drop policy if exists saidas_siad_insercao on saidas_siad;
create policy saidas_siad_insercao on saidas_siad for insert with check (true);
drop policy if exists saidas_siad_leitura on saidas_siad;
create policy saidas_siad_leitura on saidas_siad for select using (true);

commit;
