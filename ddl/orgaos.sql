-- ============================================================
-- FPMED — v_orgaos_licitantes: o diretório de ÓRGÃOS COMPRADORES
-- Item 9, 4º pedaço (Pesquisa avançada + Órgãos + Desertas), 06/08/2026.
--
-- POR QUE É UMA VIEW E NÃO UMA TABELA: a spec (6.1) pediu pra **derivar do que já buscamos,
-- sem crawler novo** — no PNCP o órgão já vem dentro de cada licitação (`orgaoEntidade` +
-- `unidadeOrgao`). Tabela materializada exigiria um segundo processo pra manter sincronizada
-- com a `licitacoes`, e no dia em que ele falhasse o diretório mentiria em silêncio. View
-- não tem esse dia: ela é sempre exatamente o que está coletado.
--
-- >>> É ESSA A HONESTIDADE QUE A TELA PRECISA MOSTRAR: este diretório conhece os órgãos das
--     licitações que NÓS coletamos, não o Brasil inteiro. Por isso a tela imprime de quantas
--     licitações ele saiu — senão alguém conclui "esse órgão não compra isso" quando a
--     verdade é "ainda não coletamos".
--
-- security_invoker = on: a view herda a RLS da `licitacoes` (só `authenticated` lê). Sem isso
-- ela rodaria como DONA e viraria uma porta lateral pra ler a tabela sem a política — que é
-- exatamente o defeito que se procura numa auditoria de RLS.
--
-- Seguro re-rodar (create or replace; nenhum DROP, nenhum dado tocado).
-- ============================================================

create or replace view public.v_orgaos_licitantes
with (security_invoker = on) as
select
  l.cnpj,
  -- a razão social MAIS RECENTE, não a alfabética: órgão muda de nome (secretaria vira
  -- superintendência) e o operador procura pelo nome de hoje.
  (array_agg(l.orgao order by l.data_publicacao desc nulls last))[1]     as orgao,
  (array_agg(l.uf    order by l.data_publicacao desc nulls last))[1]     as uf,
  (array_agg(l.municipio order by l.data_publicacao desc nulls last))[1] as municipio,
  count(*)::int                                                          as licitacoes,
  count(distinct l.unidade)::int                                         as unidades,
  max(l.data_publicacao)                                                 as ultima_publicacao,
  coalesce(sum(l.valor_estimado), 0)::numeric                            as valor_estimado
from public.licitacoes l
where l.cnpj is not null and l.cnpj <> ''
group by l.cnpj;

comment on view public.v_orgaos_licitantes is
  'Diretório de órgãos derivado da tabela licitacoes (item 9/4º). Não é cadastro: só conhece o que foi coletado.';

grant select on public.v_orgaos_licitantes to authenticated;
-- `anon` fica de fora de propósito: Licitações é tela de inteligência e exige login (a mesma
-- regra da tabela licitacoes). Com security_invoker, anon leria 0 linhas de qualquer forma —
-- o revoke evita a dúvida de "por que veio vazio?" virar investigação.
revoke all on public.v_orgaos_licitantes from anon;

notify pgrst, 'reload schema';
