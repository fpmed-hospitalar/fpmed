-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LIMEDTEC CENTRAL — A VIEW QUE O CLIENTE PUBLICA.  **NÃO APLICADO.**
--
-- ESTE ARQUIVO RODA NO BANCO DE CADA CLIENTE, e é o cliente quem decide aplicá-lo. Enquanto ele
-- não aplicar, o cartão dele na Central diz "uso não publicado" — que é a verdade, e é melhor que
-- um número inventado.
--
-- ═══ POR QUE UMA VIEW, E NÃO A CENTRAL CONTANDO POR FORA ═══════════════════════════════════
-- A tentação era a Central fazer `select count(*) from cotacoes` com a chave anon e pronto. Duas
-- razões pra isso estar errado, e a segunda é a que importa:
--   1. NÃO FUNCIONA: a RLS de cada cliente barra a anon. Medido em 06/08 — `cotacoes` com a chave
--      pública devolve 0 linhas, não 21.327. Um "0" ali seria um painel mentindo em silêncio.
--   2. NÃO DEVE FUNCIONAR: se a Central conseguisse contar linhas por fora, ela teria acesso de
--      leitura à tabela — e "eu só conto, não leio" viraria promessa, não estrutura. A pergunta
--      que todo cliente novo faz ("o dono do software vê meus preços?") só tem resposta forte
--      enquanto a Central for tecnicamente incapaz de ver.
-- Então a direção se inverte: o cliente PUBLICA um número. A Central lê o que foi publicado e
-- nada mais. Quem decide o que sai do banco é o dono do banco.
--
-- ═══ O QUE ESTA VIEW DEVOLVE, E O QUE ELA NÃO PODE DEVOLVER ════════════════════════════════
-- DEVOLVE: três números e um carimbo de tempo. Uma linha só.
-- NÃO DEVOLVE: id, código, nome de produto, preço, fornecedor, cliente final, data de cotação.
-- A regra pra quem for editar isto um dia: se um campo novo permitir RECONSTRUIR uma linha, ele
-- não entra. Contagem não reconstrói proposta; `min(preco)` reconstrói — e por isso não está aqui.
--
--   psql / SQL editor do cliente:  \i ddl/central_saude.sql
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. A VIEW ────────────────────────────────────────────────────────────────────────────────
-- security_invoker = OFF (o padrão): a view roda com os direitos de quem a criou, e é isso que
-- permite ela contar linhas que o anon não pode ler. É o mecanismo inteiro: a contagem atravessa,
-- as linhas não.
create or replace view public.limedtec_saude as
select
  (select count(*) from public.perfis where ativo)                          as usuarios_ativos,
  (select count(*) from public.cotacoes
     where atualizado_em >= date_trunc('month', now()))                     as cotacoes_no_mes,
  now()                                                                     as atualizado_em;

comment on view public.limedtec_saude is
  'LIMEDTEC Central: contagens agregadas para o painel do dono do produto. NUNCA acrescentar '
  'campo que permita reconstruir uma linha (preço, nome de produto, cliente, fornecedor). '
  'Ver ddl/central_saude.sql e COMPLIANCE.md.';

-- ── 2. QUEM PODE LER ─────────────────────────────────────────────────────────────────────────
-- anon LÊ ESTA VIEW e mais nada. A chave anon é pública por desenho (está no cliente.config.js
-- publicado), então isto é o mesmo que dizer: qualquer um pode ver quantos usuários e quantas
-- cotações — e ninguém pode ver o quê.
grant select on public.limedtec_saude to anon, authenticated;

-- ── 3. A PROVA DE QUE A FRONTEIRA VALE (rodar depois de aplicar) ─────────────────────────────
-- Não basta criar a view: tem que continuar sendo verdade que a anon não alcança as tabelas.
-- Estas três consultas são o red test do lado do banco.
--
--   set role anon;
--   select * from public.limedtec_saude;   -- 1 linha, três números  -> TEM que funcionar
--   select * from public.cotacoes limit 1; -- 0 linhas               -> TEM que vir vazio
--   select * from public.perfis   limit 1; -- 0 linhas               -> TEM que vir vazio
--   reset role;
--
-- Se a segunda ou a terceira devolverem linha, a view não é o problema — a RLS daquela tabela
-- está aberta, e isso é mais grave que a Central.
