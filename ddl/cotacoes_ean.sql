-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- ITEM 9 — EAN NO CADASTRO · migração 100% ADITIVA        (13/08/2026, Trabalhador B)
--
-- AUTORIZADA PELO DONO COM A CONDIÇÃO ESCRITA: "aprovada apenas se for 100% ADITIVA —
-- ALTER TABLE ... ADD COLUMN (ean, registro_anvisa) + CREATE INDEX, e NADA além disso.
-- Nenhum UPDATE, DELETE, DROP ou alteração de coluna existente."
-- Este arquivo é exatamente isso: 2 ADD COLUMN + 2 CREATE INDEX. Nada mais.
--
-- ── POR QUE ESTA MIGRAÇÃO EXISTE ────────────────────────────────────────────────────────────
-- A tela de Proposta filtrava `cotacoes` por `c.ean` desde 29/07, e a coluna NUNCA EXISTIU: o
-- banco respondia HTTP 400 ("column cotacoes.ean does not exist"). O ramo foi removido em
-- 13/08 com o porquê escrito — e o comentário que o acompanhava era a parte perigosa, porque
-- afirmava "63,1% de batida contra a CMED" para um caminho que nunca rodou.
-- >>> Agora a coluna passa a EXISTIR, e o casamento por código deixa de ser promessa.
--
-- ── AS DUAS DECISÕES DE TIPO, E ELAS NÃO SÃO ÓBVIAS ─────────────────────────────────────────
-- `text` e não `bigint`: o EAN-13 tem ZEROS À ESQUERDA que um tipo numérico comeria, e ele
--   nunca entra em conta — só em comparação exata. Número aqui perderia dado em silêncio, que
--   é a pior forma de perder.
-- NULÁVEL, e nunca obrigatório (ordem do dono): as 8.832 linhas existentes nascem com NULL, e
--   NULL aqui é o estado honesto — "não sabemos", que é diferente de "não tem". É a lição S6
--   aplicada a uma coluna: campo obrigatório forçaria alguém a inventar um código para salvar,
--   e EAN inventado é pior que EAN ausente (ele CASA com o produto errado).
--
-- ── OS ÍNDICES SÃO PARCIAIS, DE PROPÓSITO ───────────────────────────────────────────────────
-- A coluna nasce 100% nula. Um índice cheio carregaria 8.832 nulos que ninguém consulta; o
-- parcial nasce vazio e cresce junto com o preenchimento.
--
-- ── RLS: NADA A FAZER, E ISSO É PROPOSITAL ──────────────────────────────────────────────────
-- Coluna nova herda a RLS da tabela. Nenhuma policy foi criada, alterada ou tocada — quem lê
-- `cotacoes` hoje passa a ler as duas colunas novas sob exatamente as mesmas regras de antes.
--
-- ── CONFERIDO DEPOIS DE APLICAR ─────────────────────────────────────────────────────────────
--   linhas ............... 8.832   (todas com `produto` intacto)
--   colunas .............. 28 -> 30
--   ean / registro ....... 0 / 0 preenchidos — nascem nulas
--   índices .............. cotacoes_ean_idx, cotacoes_registro_anvisa_idx
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.cotacoes ADD COLUMN IF NOT EXISTS ean             text;
ALTER TABLE public.cotacoes ADD COLUMN IF NOT EXISTS registro_anvisa text;

CREATE INDEX IF NOT EXISTS cotacoes_ean_idx
  ON public.cotacoes (ean) WHERE ean IS NOT NULL;
CREATE INDEX IF NOT EXISTS cotacoes_registro_anvisa_idx
  ON public.cotacoes (registro_anvisa) WHERE registro_anvisa IS NOT NULL;
