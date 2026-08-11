-- ============================================================================================
-- ddl/cmed_vigencia.sql — 11/08/2026 · QUAL REGUA ESTA VALENDO, e desde quando.
--
-- ══ POR QUE UMA VIEW, E NAO UMA TABELA DE CONFIGURACAO ══════════════════════════════════════
-- A tentacao obvia era uma tabela `cmed_config` com uma linha dizendo "edicao vigente: 21/07".
-- Isso e uma INTENCAO GUARDADA: alguem escreve a data na hora da carga e ela passa a viver por
-- conta propria. No dia em que a carga falhar no meio, ou em que alguem rodar a carga e esquecer
-- de atualizar a linha, a tela vai afirmar com toda a confianca uma vigencia que o dado nao tem.
-- E o pior tipo de erro deste sistema: uma resposta segura e errada.
--
-- Aqui a vigencia e DERIVADA do proprio dado — e a data que esta gravada nas 25.702 linhas.
-- Ela nao tem como discordar da base porque ela E a base. Se a carga entrar pela metade, a view
-- mostra duas datas e a contagem de cada uma, que e exatamente o que quem le precisa saber.
--
-- >>> `edicoes` E O CAMPO QUE DENUNCIA CARGA PELA METADE. Em condicao normal ele e 1. Qualquer
--     numero maior quer dizer que a tabela tem linhas de edicoes diferentes convivendo — e ai a
--     tela precisa dizer isso, e nao escolher uma e seguir em frente.
--
-- ADITIVO: so cria view. Nenhum DROP de tabela, nenhum UPDATE de dado. Roda 2x.
-- ============================================================================================

create or replace view public.v_cmed_vigencia
  with (security_invoker = true) as
select
  max(p.publicada_site)                       as publicada_site,
  max(p.publicada_gov)                        as publicada_gov,
  -- A REGUA E A DATA MAIS ANTIGA DAS DUAS, e nao a mais nova. As duas listas da CMED (site e
  -- gov) podem sair com dias de diferenca; o teto para o governo depende do PMVG, que vem da
  -- lista gov. Anunciar a data mais nova quando metade da regua e mais velha e prometer um
  -- frescor que a base nao tem.
  least(max(p.publicada_site), max(p.publicada_gov)) as vigente_desde,
  (current_date - least(max(p.publicada_site), max(p.publicada_gov)))::int as dias_desde,
  count(*)                                    as apresentacoes,
  count(distinct p.publicada_gov)             as edicoes,
  count(*) filter (where p.cap)               as com_cap
from public.cmed_precos p;

comment on view public.v_cmed_vigencia is
  'Qual edicao da CMED esta valendo, DERIVADA das linhas gravadas (nao de uma configuracao '
  'escrita a mao). `edicoes` > 1 denuncia carga pela metade: linhas de edicoes diferentes '
  'convivendo. `vigente_desde` e a MAIS ANTIGA das duas listas — anunciar a mais nova prometeria '
  'um frescor que metade da regua nao tem.';

revoke all on public.v_cmed_vigencia from anon;
grant select on public.v_cmed_vigencia to authenticated;

notify pgrst, 'reload schema';
