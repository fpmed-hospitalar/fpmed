-- ============================================================================================
-- FPMED — A BUSCA NACIONAL: tsvector + unaccent + sinônimos
-- Fatia A8, fase 1. 14/08/2026. 100% ADITIVO (extensões, uma coluna nova, índices, uma função).
--
-- ══ POR QUE ISTO PRECISA EXISTIR AGORA ══════════════════════════════════════════════════════
-- Até hoje a busca do índice funcionava assim: a tela BAIXA as licitações do período e filtra
-- em JavaScript com `semAcento`. Isso é honesto e funciona com 3.201 linhas em 7 UFs.
-- >>> COM 27 UFs ELE PARA DE FUNCIONAR, e não por lentidão: o PostgREST corta a leitura, e uma
--     busca que lê metade da base responde "não achei" sobre o que existe. É a mesma lição do
--     `limit=1000` que já mordeu esta obra duas vezes — só que agora com a base multiplicada.
--     Quem filtra passa a ser o BANCO, que enxerga tudo.
--
-- ══ AS TRÊS COISAS QUE A BUSCA PRECISA ACERTAR ══════════════════════════════════════════════
-- 1. ACENTO — "farmaceutico" tem que achar "FARMACÊUTICO". `unaccent` resolve, e ele entra no
--    índice E na consulta: só num lado, o índice não é usado e a busca varre a tabela inteira.
-- 2. RADICAL — "medicamentos" tem que achar "medicamento". O dicionário `portuguese` do
--    Postgres faz isso (stemming), e é por isso que a configuração NÃO é `simple`.
-- 3. SINÔNIMO — quem procura "soro" quer "solução fisiológica"; quem procura "esparadrapo"
--    quer "fita adesiva hospitalar". Isso NÃO é stemming e nenhum dicionário resolve: é
--    vocabulário do ramo, e ele mora numa tabela que dá pra editar sem migração.
-- ============================================================================================

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ── 1. A CONFIGURAÇÃO DE BUSCA: português SEM acento ────────────────────────────────────────
-- `unaccent` como filtro ANTES do stemmer português. A ordem importa: acentuar depois de
-- radicalizar não desfaz o acento que já quebrou o casamento.
do $$
begin
  if not exists (select 1 from pg_ts_config where cfgname = 'pt_sem_acento') then
    create text search configuration public.pt_sem_acento (copy = portuguese);
    alter text search configuration public.pt_sem_acento
      alter mapping for hword, hword_part, word with unaccent, portuguese_stem;
  end if;
end $$;

-- ── 2. A COLUNA DE BUSCA ────────────────────────────────────────────────────────────────────
-- GERADA, e não preenchida por gatilho ou pelo coletor: coluna que alguém precisa lembrar de
-- atualizar é coluna que um dia fica velha, e busca sobre índice velho não acha o que chegou
-- ontem — sem nenhum sintoma além de "não achei".
-- >>> O OBJETO PESA MAIS QUE O RESTO (setweight A) porque é nele que a pessoa procura. Órgão e
--     município entram com peso menor: quem digita "Goiânia" quer as de Goiânia, mas quem
--     digita "albumina" não pode receber um edital de merenda de uma rua chamada Albumina.
alter table public.licitacoes
  add column if not exists busca tsvector
  generated always as (
    setweight(to_tsvector('public.pt_sem_acento', coalesce(objeto, '')), 'A') ||
    setweight(to_tsvector('public.pt_sem_acento', coalesce(orgao, '')), 'C') ||
    setweight(to_tsvector('public.pt_sem_acento', coalesce(municipio, '')), 'D')
  ) stored;

create index if not exists licitacoes_busca_gin on public.licitacoes using gin (busca);
-- O trigram serve o caso que o tsvector não serve: erro de digitação e busca por pedaço de
-- palavra ("albumin"). Ele NÃO substitui o tsvector — é o plano B, e custa mais.
create index if not exists licitacoes_objeto_trgm on public.licitacoes using gin (objeto gin_trgm_ops);

-- ── 3. OS SINÔNIMOS DO RAMO ─────────────────────────────────────────────────────────────────
-- Tabela, e não lista no código: o vocabulário de material hospitalar muda com o mercado, e
-- quem sabe que "equipo macrogotas" e "equipo de soro" são a mesma coisa é quem vende — não
-- quem programa. Editar uma linha aqui não exige deploy.
create table if not exists public.busca_sinonimos (
  id        bigserial primary key,
  termo     text not null,          -- o que a pessoa digita (sem acento, minúsculo)
  equivale  text not null,          -- o que também deve ser procurado
  fonte     text,                   -- quem disse que são equivalentes
  criado_em timestamptz not null default now()
);
create unique index if not exists busca_sinonimos_chave on public.busca_sinonimos (termo, equivale);

-- ── 4. A FUNÇÃO DE BUSCA ────────────────────────────────────────────────────────────────────
-- Uma função, e não um filtro montado na tela: a regra de busca precisa ser a MESMA para a
-- tela, o boletim e os jornais. Três montagens do mesmo filtro é como três telas passam a
-- discordar sobre o que existe.
-- >>> ELA DEVOLVE `total` JUNTO, e isso não é conveniência: sem o total, a tela mostra "30
--     resultados" quando há 3.000, e quem lê conclui que o assunto é pequeno.
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
  link_sistema text, relevancia real, total bigint
)
language sql stable as $$
  with termos as (
    -- o termo digitado MAIS os sinônimos dele. `websearch_to_tsquery` entende aspas e `-palavra`,
    -- que é o que uma pessoa espera de um campo de busca hoje.
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
  filtrado as (
    select l.*,
           case when (select q from termos) is null then 0::real
                else ts_rank(l.busca, websearch_to_tsquery('public.pt_sem_acento', (select q from termos))) end as rel
      from public.licitacoes l
     where ((select q from termos) is null
            or l.busca @@ websearch_to_tsquery('public.pt_sem_acento', (select q from termos)))
       and (p_uf     is null or l.uf = p_uf)
       and (p_portal is null or l.portal = p_portal)
       and (p_de     is null or l.data_publicacao >= p_de)
       and (p_ate    is null or l.data_publicacao <= p_ate)
  )
  select f.id, f.numero_controle, f.objeto, f.orgao, f.municipio, f.uf,
         f.portal, f.modalidade, f.valor_estimado,
         f.data_publicacao, f.data_abertura, f.data_encerramento,
         f.link_sistema, f.rel, count(*) over () as total
    from filtrado f
   order by f.rel desc, f.data_abertura asc nulls last
   limit greatest(1, least(coalesce(p_limite, 100), 500))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.buscar_licitacoes(text, text, text, date, date, integer, integer) to authenticated;
revoke execute on function public.buscar_licitacoes(text, text, text, date, date, integer, integer) from anon;

-- ── 5. OS PORTAIS COM CONTAGEM REAL ─────────────────────────────────────────────────────────
-- O seletor de portais do molde precisa de números que existem. Esta view responde "quantas
-- licitações cada portal tem no NOSSO índice" — e não uma lista de portais que alguém supôs.
create or replace view public.v_portais as
  select coalesce(nullif(btrim(portal), ''), '(não informado)') as portal,
         count(*) as total,
         count(*) filter (where data_encerramento >= now()) as abertas,
         max(data_publicacao) as mais_recente
    from public.licitacoes
   group by 1
   order by 2 desc;
grant select on public.v_portais to authenticated;

-- ── 6. RLS dos sinônimos ────────────────────────────────────────────────────────────────────
alter table public.busca_sinonimos enable row level security;
drop policy if exists sinonimos_sel on public.busca_sinonimos;
create policy sinonimos_sel on public.busca_sinonimos for select to authenticated using (true);
revoke all on public.busca_sinonimos from anon;
grant select on public.busca_sinonimos to authenticated;

notify pgrst, 'reload schema';
