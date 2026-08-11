-- ============================================================================================
-- ddl/negocio_itens_ganhos.sql — 11/08/2026 · O RESULTADO GRAVADO NO NEGOCIO.
--
-- ══ O QUE ISTO RESOLVE ══════════════════════════════════════════════════════════════════════
-- O relatorio de itens ganhos lia o documento e mostrava a tabela na tela — e ia embora quando a
-- ficha fechava. Na proxima vez que alguem perguntasse "o que a gente ganhou naquele pregao?", o
-- caminho era reabrir o documento e pagar outra leitura de IA.
-- O pedido do Lemuel: "clicou no processo ganho, ja ta la o que ganhou, precos, marcas e o geral".
-- Entao a CONFIRMACAO (o clique de gente que ja existia pro valor) passa a gravar tambem os ITENS.
--
-- ══ SEM DELETE, E POR QUE ═══════════════════════════════════════════════════════════════════
-- Resultado de pregao e historico. Corrigir nao e apagar: e uma CONFIRMACAO NOVA, que entra com
-- `confirmacao` maior e deixa a anterior visivel. Assim "o valor mudou de X pra Y" tem data, tem
-- autor e tem o antes — que e a unica coisa que responde "por que este negocio vale isso?".
--
-- ══ A MARCA NUNCA E INVENTADA ═══════════════════════════════════════════════════════════════
-- Ela vem da ata quando o documento trouxer; do casamento com o estoque quando nao trouxer; e
-- fica VAZIA com etiqueta quando nenhum dos dois soube. `marca_origem` diz qual dos tres foi —
-- sem essa coluna, uma marca vinda de casamento aproximado ficaria indistinguivel de uma marca
-- lida do documento assinado, e as duas nao valem a mesma coisa numa discussao com o orgao.
--
-- ADITIVO. Roda 2x.
-- ============================================================================================

create table if not exists public.negocio_itens_ganhos (
  id           bigserial primary key,
  negocio_id   bigint not null references public.negocios(id) on delete cascade,
  -- QUAL CONFIRMACAO gravou esta linha. Correcao = confirmacao nova, com numero maior. A tela
  -- mostra a mais alta; as anteriores ficam, e e assim que o rastro existe.
  confirmacao  int    not null default 1,
  item_n       text,
  descricao    text   not null,
  marca        text,
  -- 'ata'     = veio do documento assinado (a mais forte)
  -- 'estoque' = veio do casamento com o nosso produto (aproximada, mas rastreavel)
  -- null      = ninguem soube, e a tela mostra etiqueta em vez de campo vazio silencioso
  marca_origem text check (marca_origem in ('ata','estoque')),
  quantidade   numeric,
  valor_unitario numeric,
  total        numeric,
  -- COMO ESTA LINHA NASCEU. 'ia' = lida por IA e confirmada; 'digitado' = alguem escreveu.
  -- Precisa ser separavel: numero lido e numero digitado erram de jeitos diferentes.
  origem       text not null default 'ia' check (origem in ('ia','digitado')),
  confirmado_por text,
  confirmado_em  timestamptz not null default now()
);

create index if not exists nig_por_negocio
  on public.negocio_itens_ganhos (negocio_id, confirmacao desc, item_n);

comment on table public.negocio_itens_ganhos is
  'Itens que a empresa ganhou num pregao, gravados quando alguem CONFIRMA o resultado. Sem '
  'DELETE: correcao e confirmacao nova (numero maior), e a anterior fica como rastro.';

-- A confirmacao e por NEGOCIO, e o numero e calculado no banco pelo mesmo motivo da versao do
-- anexo: duas abas abertas mandariam o mesmo numero e uma correcao viraria a outra.
create or replace function public.nig_confirmacao() returns trigger
language plpgsql as $$
begin
  if new.confirmacao is null or new.confirmacao <= 0 then
    select coalesce(max(x.confirmacao), 0) + 1 into new.confirmacao
      from public.negocio_itens_ganhos x where x.negocio_id = new.negocio_id;
  end if;
  return new;
end $$;
drop trigger if exists nig_confirmacao_t on public.negocio_itens_ganhos;
create trigger nig_confirmacao_t before insert on public.negocio_itens_ganhos
  for each row execute function public.nig_confirmacao();

/* ── A VIEW QUE A TELA LE ────────────────────────────────────────────────────────────────────
   So a confirmacao MAIS NOVA de cada negocio. As anteriores continuam na tabela — quem quer o
   rastro consulta a tabela; quem quer saber o que valeu consulta a view.
   >>> ELA TAMBEM ENTREGA A CONFERENCIA: `soma_itens` ao lado de `valor_ganho`. O pedido foi
       explicito — se divergirem, a tela MOSTRA a diferenca em vez de esconder, porque negocio
       antigo do calendario tem valor sem itens detalhados e isso e NORMAL, nao erro. */
create or replace view public.v_negocio_itens_ganhos
  with (security_invoker = true) as
with ultima as (
  select negocio_id, max(confirmacao) as confirmacao
    from public.negocio_itens_ganhos group by negocio_id
)
select i.*
  from public.negocio_itens_ganhos i
  join ultima u on u.negocio_id = i.negocio_id and u.confirmacao = i.confirmacao;

create or replace view public.v_negocios_ganhos
  with (security_invoker = true) as
select
  n.id, n.empresa_id, n.orgao, n.numero, n.municipio, n.uf, n.portal, n.modalidade,
  n.objeto, n.abertura, n.estagio, n.arquivado, n.valor_ganho,
  coalesce(g.itens, 0)  as itens_confirmados,
  g.soma_itens,
  -- A DIFERENCA E UM FATO CALCULADO, e nao um alerta: null quando nao ha itens (o normal do
  -- historico importado) e um numero quando ha itens e ele nao bate com o valor da ficha.
  case when g.soma_itens is null then null
       else round((coalesce(n.valor_ganho,0) - g.soma_itens)::numeric, 2) end as diferenca
from public.negocios n
left join (
  select negocio_id, count(*) as itens, sum(total) as soma_itens
    from public.v_negocio_itens_ganhos group by negocio_id
) g on g.negocio_id = n.id
where coalesce(n.valor_ganho, 0) > 0;

comment on view public.v_negocios_ganhos is
  'Os negocios GANHOS (valor_ganho > 0) com a soma dos itens confirmados ao lado e a diferenca '
  'entre os dois. Diferenca null = nao ha itens detalhados, o que e o normal do historico '
  'importado do calendario — e nao um erro.';

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
alter table public.negocio_itens_ganhos enable row level security;
drop policy if exists nig_sel on public.negocio_itens_ganhos;
drop policy if exists nig_ins on public.negocio_itens_ganhos;
create policy nig_sel on public.negocio_itens_ganhos for select to authenticated using (true);
create policy nig_ins on public.negocio_itens_ganhos for insert to authenticated with check (true);
-- SEM update e SEM delete: resultado de pregao corrigido por cima nao deixa rastro, e o rastro
-- e a razao de esta tabela existir.

revoke all on public.negocio_itens_ganhos from anon;
revoke all on public.v_negocio_itens_ganhos from anon;
revoke all on public.v_negocios_ganhos from anon;
grant select, insert on public.negocio_itens_ganhos to authenticated;
grant select on public.v_negocio_itens_ganhos to authenticated;
grant select on public.v_negocios_ganhos to authenticated;
grant usage, select on sequence public.negocio_itens_ganhos_id_seq to authenticated;

notify pgrst, 'reload schema';
