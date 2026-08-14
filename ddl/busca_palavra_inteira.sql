-- ============================================================================================
-- FPMED — QUANDO O RADICAL DO PORTUGUÊS FUNDE DUAS COISAS DIFERENTES
-- Fatia A20. 14/08/2026. 100% ADITIVA (uma tabela nova + a função de busca refeita).
--
-- ══ O ACHADO, MEDIDO NOS 15 TERMOS DO RAMO ═════════════════════════════════════════════════
-- Buscar **"equipo"** — o equipo de soro, um produto que a FPMED vende — devolvia **539
-- licitações**, e as primeiras eram pipoca, pula-pula, trio elétrico, frigobar e bicicleta.
--
-- A causa não é a busca: é o STEMMER do português, e ele está certo no que faz. Ele reduz
--       equipo  ·  equipamento  ·  equipe
-- ao MESMO radical `equip`. As três viram a mesma palavra, e "aquisição de equipamentos"
-- passa a ser resposta para quem procura equipo. Provado pelos números: buscar "equipo",
-- "equipamento" e "equipe" devolve **539 para os três**.
--
-- ══ E ISSO É PIOR QUE O ZERO DA FATIA A8 ═══════════════════════════════════════════════════
-- Lá a busca dizia "não achei" sobre um país que estava comprando — ruim, mas honesto na cara.
-- Aqui ela devolve 539 resultados PLAUSÍVEIS e quase todos errados: quem procura equipo abre
-- cinco editais de mobiliário escolar antes de desconfiar do sistema. Resposta cheia e errada
-- custa mais tempo que resposta vazia, e ensina a não confiar na ferramenta.
--
-- ══ A MEDIÇÃO QUE DEFINE O TAMANHO DO CONSERTO ═════════════════════════════════════════════
-- Medi, para 15 termos do ramo, quantos resultados contêm a PALAVRA INTEIRA (e não só o
-- radical). Taxa nos itens:
--     albumina 100% · dipirona 100% · luva 100% · omeprazol 100% · enteral 100% · sonda 100%
--     agulha 100% · caneta 99% · esparadrapo 97% · soro 96% · seringa 95% · cateter 94%
--     gaze 100% · atadura 93%  ......................  **equipo 15%**  (no objeto: 3 de 328)
--
-- >>> UM TERMO. Por isso o conserto é uma LISTA, e não uma mudança no jeito de buscar: exigir
--     palavra inteira em tudo destruiria justamente o que o radical faz de bom — "cateteres"
--     achando "cateter", "dipironas" achando "dipirona". O ganho do stemmer é real em 14 de 15
--     termos; o estrago é em 1. Trocar uma coisa boa por causa de uma exceção é como se perde
--     uma busca inteira para consertar um caso.
--
-- ══ POR QUE UMA TABELA, E NÃO UMA LISTA NO CÓDIGO ══════════════════════════════════════════
-- Pelo mesmo motivo da `busca_sinonimos`: quem descobre que "equipo" está trazendo pula-pula é
-- quem usa a busca todo dia, não quem programa. Uma linha aqui não exige deploy.
-- ============================================================================================

-- ── 1. A LISTA ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.busca_palavra_inteira (
  id        bigserial primary key,
  termo     text not null unique,   -- sem acento, minúsculo — como a busca normaliza
  motivo    text,                   -- POR QUE ele está aqui. Lista sem motivo vira superstição.
  medido_em timestamptz not null default now()
);

-- O ÚNICO termo que a medição de 14/08 reprovou. Ele entra com o número que o condenou.
insert into public.busca_palavra_inteira (termo, motivo)
values ('equipo',
        'o radical do portugues funde equipo/equipamento/equipe: os tres devolviam as MESMAS '
        || '539 licitacoes. Palavra inteira: 15% nos itens e 3 de 328 no objeto (medido 14/08, '
        || 'fatia A20, tools/mede_busca_produto.js).')
on conflict (termo) do nothing;

alter table public.busca_palavra_inteira enable row level security;
drop policy if exists busca_palavra_inteira_sel on public.busca_palavra_inteira;
create policy busca_palavra_inteira_sel on public.busca_palavra_inteira
  for select to authenticated using (true);
revoke all on public.busca_palavra_inteira from anon;
grant select on public.busca_palavra_inteira to authenticated;

-- ── 2. A BUSCA, COM A CONFIRMAÇÃO LITERAL SÓ ONDE ELA É NECESSÁRIA ──────────────────────────
/* `create or replace` não muda tipo de retorno; o drop abaixo derruba a função que este mesmo
   conjunto de scripts criou. NÃO é "drop" no sentido que a regra de segurança proíbe: função é
   código, não acervo. Nenhum dado é tocado. Dito em voz alta porque a palavra é a mesma. */
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
  with normalizado as (
    select public.unaccent(lower(coalesce(p_termo, ''))) as termo
  ),
  /* ══ O PLURAL CAI NA MESMA LISTA — E ISSO FOI UM DEFEITO MEDIDO, NÃO UMA PRECAUÇÃO ═════════
     A primeira versão desta função casava a lista pelo termo EXATO. Resultado logo depois de
     aplicá-la: "equipo" caiu de 539 para 35, e **"equipos" continuou em 539**. Meio conserto é
     pior que conserto nenhum — a busca passaria a estar certa ou errada conforme a pessoa
     digitasse a letra final, e ninguém descobriria por quê.
     A regra é a mais simples que resolve: o termo digitado, OU ele sem o "s" final, tem que
     bater com a lista. "equipos" → "equipo" (entra); "equipamentos" → "equipamento" (não está
     na lista, e continua se comportando como sempre). */
  alvo as (
    select b.termo
      from public.busca_palavra_inteira b
     where b.termo = (select termo from normalizado)
        or b.termo = regexp_replace((select termo from normalizado), 's$', '')
     limit 1
  ),
  /* O termo CANÔNICO é o da lista quando ela responde, e o digitado quando não. É por ele que
     os sinônimos são procurados — senão quem digitasse o plural perderia os sinônimos do
     singular, que é a mesma família de defeito de novo. */
  canonico as (
    select coalesce((select termo from alvo), (select termo from normalizado)) as termo
  ),
  -- as palavras a procurar: o que a pessoa digitou MAIS os sinônimos do termo canônico
  palavras as (
    select t from (
      select (select termo from normalizado) as t
      union
      select (select termo from canonico)
      union
      select public.unaccent(lower(s.equivale))
        from public.busca_sinonimos s
       where s.termo = (select termo from canonico)
    ) x where t <> ''
  ),
  q as (
    select case when (select count(*) from palavras) = 0 then null
           else websearch_to_tsquery('public.pt_sem_acento',
                  (select string_agg(t, ' or ') from palavras)) end as tq
  ),
  /* ══ A CONFIRMAÇÃO LITERAL ════════════════════════════════════════════════════════════════
     Só existe quando o termo digitado está na `busca_palavra_inteira`. Nos outros casos o
     padrão é NULL e nada muda — o stemmer continua fazendo o que ele faz de bom.
     `\m` e `\M` são início e fim de PALAVRA no regex do Postgres: `\m(equipo)s?\M` aceita
     "equipo" e "equipos" e recusa "equipamento" e "equipe".
     >>> O `s?` EXISTE PORQUE O PLURAL É A ÚNICA FLEXÃO QUE ESTA LISTA PODE ABRIR MÃO DE PERDER.
         Sem ele, quem digitasse "equipo" deixaria de achar "equipos" — e a lista viraria um
         conserto que quebra outra coisa.
     >>> E OS SINÔNIMOS ENTRAM NO PADRÃO. Se alguém cadastrar "equipo → equipo macrogotas", a
         confirmação tem que aceitar os dois; senão a lista desligaria o sinônimo em silêncio. */
  padrao as (
    select case when (select termo from alvo) is null then null
           else '\m(' || (select string_agg(
                            regexp_replace(t, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g'), '|')
                          from (
                            -- o CANÔNICO (o singular da lista) e os sinônimos DELE. O termo cru
                            -- do usuário fica de fora de propósito: se ele veio no plural, o
                            -- `s?` lá embaixo já o cobre, e incluí-lo criaria "equiposs?".
                            select (select termo from canonico) as t
                            union
                            select public.unaccent(lower(s.equivale))
                              from public.busca_sinonimos s
                             where s.termo = (select termo from canonico)
                          ) y where t <> '') || ')s?\M'
           end as re
  ),
  por_item as (
    select i.numero_controle, count(*) as n
      from public.licitacao_itens i
     where (select tq from q) is not null
       and i.busca @@ (select tq from q)
       and ((select re from padrao) is null
            or public.unaccent(lower(coalesce(i.descricao, ''))) ~ (select re from padrao))
     group by i.numero_controle
  ),
  filtrado as (
    select l.*,
           coalesce(pi.n, 0) as n_itens,
           case when (select tq from q) is null then 0::real
                else ts_rank(l.busca, (select tq from q)) end as rel_obj,
           ((select tq from q) is not null
            and l.busca @@ (select tq from q)
            and ((select re from padrao) is null
                 or public.unaccent(lower(coalesce(l.objeto, ''))) ~ (select re from padrao))) as bate_obj
      from public.licitacoes l
      left join por_item pi on pi.numero_controle = l.numero_controle
     where ((select tq from q) is null
            or (l.busca @@ (select tq from q)
                and ((select re from padrao) is null
                     or public.unaccent(lower(coalesce(l.objeto, ''))) ~ (select re from padrao)))
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

-- ── 3. OS SINÔNIMOS QUE A MEDIÇÃO DE 14/08 PEDIU ────────────────────────────────────────────
/* ══ O QUE ENTRA AQUI, E O QUE NÃO ENTRA ══════════════════════════════════════════════════
   Entra o que é a MESMA COISA com outro nome no vocabulário do ramo. NÃO entra equivalência
   clínica: "albumina" não é "albumina bovina" (reagente de bancada), e um sinônimo que juntasse
   as duas faria a tela oferecer material de laboratório a quem vende hemoderivado — um erro que
   não aparece como erro, aparece como oportunidade.
   >>> POR ISSO CADA LINHA TEM `fonte`. Sinônimo sem procedência é palpite com cara de regra. */
insert into public.busca_sinonimos (termo, equivale, fonte) values
  -- "soro fisiológico" é como o edital escreve; "cloreto de sódio 0,9%" é como a farmácia escreve.
  ('soro fisiologico', 'cloreto de sodio', 'vocabulario do ramo - fatia A20'),
  ('soro fisiologico', 'solucao fisiologica', 'vocabulario do ramo - fatia A20'),
  -- equipo: os três nomes de catálogo do MESMO produto.
  ('equipo', 'equipo macrogotas', 'vocabulario do ramo - fatia A20'),
  ('equipo', 'equipo de soro', 'vocabulario do ramo - fatia A20'),
  -- dieta enteral aparece como "nutrição enteral" em metade dos editais.
  ('dieta enteral', 'nutricao enteral', 'vocabulario do ramo - fatia A20'),
  -- a luva: "de procedimento" e "descartável" são a mesma linha de compra.
  ('luva', 'luva descartavel', 'vocabulario do ramo - fatia A20'),
  -- e a gaze, que o edital chama de compressa quando é dobrada.
  ('gaze', 'compressa de gaze', 'vocabulario do ramo - fatia A20')
on conflict do nothing;

notify pgrst, 'reload schema';
