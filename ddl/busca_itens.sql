-- ============================================================================================
-- FPMED — A BUSCA TAMBÉM PELOS ITENS DO EDITAL
-- Fatia A8, fase 1 (2ª parte). 14/08/2026. 100% ADITIVO.
--
-- ══ A MEDIÇÃO QUE MUDOU O DESENHO DESTA FATIA ═══════════════════════════════════════════════
-- Com o tsvector no `objeto` funcionando (3.201 de 3.201 vetorizados, acento e radical
-- provados), eu fui buscar o termo que o dono usa — "albumina" — e deu **ZERO**.
-- Não era defeito da busca. Medido com ILIKE cru nas 3.201 licitações:
--     albumina .. 0     soro .. 0     dipirona .. 0     seringa .. 4     caneta .. 0
-- >>> O `objeto` DO PNCP É GENÉRICO. Ele diz "Aquisição de material médico-hospitalar para as
--     unidades de saúde" — 226 caracteres em média. O nome do produto NÃO ESTÁ ALI: ele está
--     na descrição de cada ITEM.
--     Prova do contraste: "caneta" aparece 0 vezes em 3.201 objetos, e 5 vezes nos 195 itens de
--     UMA licitação.
-- >>> ENTÃO COLETAR AS 27 UFs NÃO RESOLVERIA. A busca por produto continuaria dando zero, só
--     que sobre uma base 4x maior — e "zero" numa base grande é ainda mais convincente e ainda
--     mais falso. O que faltava não era ABRANGÊNCIA, era PROFUNDIDADE.
--
-- Por isso a busca passa a olhar os DOIS: o objeto (que responde "que tipo de compra é essa?")
-- e os itens (que respondem "eles compram o que eu vendo?").
-- ============================================================================================

-- ── 1. O VETOR DA DESCRIÇÃO DO ITEM ─────────────────────────────────────────────────────────
alter table public.licitacao_itens
  add column if not exists busca tsvector
  generated always as (to_tsvector('public.pt_sem_acento', coalesce(descricao, ''))) stored;

create index if not exists licitacao_itens_busca_gin on public.licitacao_itens using gin (busca);

-- ── 2. A BUSCA, AGORA NOS DOIS ──────────────────────────────────────────────────────────────
-- >>> ELA DIZ ONDE CASOU, e isso não é detalhe de interface: "casou no objeto" quer dizer que a
--     compra INTEIRA é daquilo; "casou num item" quer dizer que há um item no meio de outros
--     duzentos. As duas coisas valem, e valem DIFERENTE — quem lê precisa saber qual das duas
--     está olhando antes de decidir montar uma proposta.
-- >>> E O `itens_casados` VEM JUNTO pelo mesmo motivo: 1 item casado em 500 e 180 em 195 são
--     oportunidades de tamanhos opostos.
/* `create or replace` NÃO consegue mudar o tipo de retorno de uma função existente, e esta
   ganhou duas colunas (`casou_em`, `itens_casados`). O drop abaixo derruba a função que ESTE
   MESMO conjunto de scripts criou minutos antes, e a nova entra logo em seguida.
   >>> ISTO NÃO É "DROP" NO SENTIDO QUE A REGRA DE SEGURANÇA PROÍBE: nenhum dado é tocado —
       função é código, não acervo. A regra protege `licitacoes`, `cotacoes`, `cmed_*`; e
       nenhuma delas encosta aqui. Dito em voz alta porque a palavra é a mesma. */
drop function if exists public.buscar_licitacoes(text, text, text, date, date, integer, integer);

create or replace function public.buscar_licitacoes(
  p_termo   text,
  p_uf      text default null,
  p_portal  text default null,
  p_de      date default null,
  p_ate     date default null,
  p_limite  integer default 100,
  p_offset  integer default 0
)
returns table (
  id bigint, numero_controle text, objeto text, orgao text, municipio text, uf text,
  portal text, modalidade text, valor_estimado numeric,
  data_publicacao date, data_abertura timestamptz, data_encerramento timestamptz,
  link_sistema text, relevancia real, casou_em text, itens_casados bigint, total bigint
)
language sql stable as $$
  with termos as (
    select string_agg(t, ' or ') as q
    from (
      select public.unaccent(lower(coalesce(p_termo, ''))) as t
      union
      select public.unaccent(lower(s.equivale))
        from public.busca_sinonimos s
       where s.termo = public.unaccent(lower(coalesce(p_termo, '')))
    ) x
    where t <> ''
  ),
  q as (select case when (select q from termos) is null then null
                    else websearch_to_tsquery('public.pt_sem_acento', (select q from termos)) end as tq),
  -- as licitações cujos ITENS casam, com quantos casaram
  por_item as (
    select i.numero_controle, count(*) as n
      from public.licitacao_itens i
     where (select tq from q) is not null and i.busca @@ (select tq from q)
     group by i.numero_controle
  ),
  filtrado as (
    select l.*,
           coalesce(pi.n, 0) as n_itens,
           case when (select tq from q) is null then 0::real
                else ts_rank(l.busca, (select tq from q)) end as rel_obj,
           ((select tq from q) is not null and l.busca @@ (select tq from q)) as bate_obj
      from public.licitacoes l
      left join por_item pi on pi.numero_controle = l.numero_controle
     where ((select tq from q) is null
            or l.busca @@ (select tq from q)
            or pi.n is not null)
       and (p_uf     is null or l.uf = p_uf)
       and (p_portal is null or l.portal = p_portal)
       and (p_de     is null or l.data_publicacao >= p_de)
       and (p_ate    is null or l.data_publicacao <= p_ate)
  )
  select f.id, f.numero_controle, f.objeto, f.orgao, f.municipio, f.uf,
         f.portal, f.modalidade, f.valor_estimado,
         f.data_publicacao, f.data_abertura, f.data_encerramento,
         f.link_sistema,
         -- item casado pesa: ele é a resposta mais direta a "eles compram o que eu vendo?"
         (f.rel_obj + least(f.n_itens, 20) * 0.05)::real as relevancia,
         case when f.bate_obj and f.n_itens > 0 then 'objeto e itens'
              when f.bate_obj then 'objeto'
              else 'itens' end as casou_em,
         f.n_itens as itens_casados,
         count(*) over () as total
    from filtrado f
   order by relevancia desc, f.data_abertura asc nulls last
   limit greatest(1, least(coalesce(p_limite, 100), 500))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.buscar_licitacoes(text, text, text, date, date, integer, integer) to authenticated;
revoke execute on function public.buscar_licitacoes(text, text, text, date, date, integer, integer) from anon;

notify pgrst, 'reload schema';
