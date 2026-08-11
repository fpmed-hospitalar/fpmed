-- ============================================================================================
-- ddl/usos_ia_tarefa.sql — 11/08/2026 · a coluna que separa "resumiu o edital" de "extraiu a
-- tabela de itens" no contador de gastos de IA.
--
-- POR QUE NAO REUSAR `tipo`:
--   `tipo` ja existe e ja responde OUTRA pergunta — QUAL FERRAMENTA gastou ('edital',
--   'pedido-proposta', 'pedido-foto'). As duas leituras daqui sao a MESMA ferramenta (o leitor
--   de edital, mesma permissao, mesma tela, mesma linha da fatura). Enfiar 'edital-itens' em
--   `tipo` exigiria derrubar e recriar o check constraint, e — pior — quebraria toda soma que
--   hoje agrupa por tipo='edital': a conta do mes passaria a mostrar duas ferramentas onde ha
--   uma. Coluna nova responde a pergunta nova sem mexer na resposta antiga.
--
-- ADITIVO: cria coluna com default. Nenhum DROP, nenhum UPDATE de dado. As 100% das linhas que
-- ja existem sao resumo (a extracao de itens nasce hoje), entao o default 'resumo' as descreve
-- corretamente — nao e chute preenchendo buraco.
-- Roda 2x sem estragar.
-- ============================================================================================

alter table public.usos_ia
  add column if not exists tarefa text not null default 'resumo'
    check (tarefa in ('resumo','itens'));

comment on column public.usos_ia.tarefa is
  'O que se pediu à IA nesta leitura. resumo = os dados do edital; itens = a tabela do anexo de '
  'itens, que vira proposta. Muda o preço (a tabela gasta muito mais saída) e muda o risco, '
  'então precisa ser separável na conta do mês.';

-- ── A VIEW LEVA A COLUNA ADIANTE ────────────────────────────────────────────────────────────
-- `create or replace` (e NAO drop+create) de proposito: replace preserva os grants e as policies
-- que ja apontam pra ela. O preco de usar replace e que a coluna nova tem que entrar NO FIM da
-- lista — o Postgres nao deixa reordenar. Dai `tarefa` aparecer no final, e nao ao lado de
-- `tipo`, que seria o lugar bonito. Ordem de coluna e cosmetica; grant perdido e chamado.
create or replace view public.v_leituras_cobranca
  with (security_invoker = true) as
select
  l.id, l.quando, l.email, l.usuario,
  l.edital_titulo, l.edital_url, l.edital_mb,
  l.modo, l.modo_motivo, l.paginas, l.chars,
  l.modelo, l.tokens_entrada, l.tokens_saida, l.segundos,
  l.tipo, l.usd, l.cambio, l.brl, l.ok, l.erro,
  (select c.margem_repasse from public.cobranca_config c where c.id = 1) as margem_repasse,
  -- pra cima no centavo, e so quando ha custo em real (sem cambio do dia, nao ha repasse em R$)
  case when l.brl is null then null
       else ceil(l.brl * (1 + (select c.margem_repasse from public.cobranca_config c where c.id = 1) / 100.0) * 100) / 100.0
  end as repasse_brl,
  l.tarefa
from public.usos_ia l;
