-- ============================================================
-- FPMED — SALDO DA ATA (fatia B30, 20/08/2026)
-- Módulo 1.5 da BASE_FUNCOES_PROFISSIONAIS ("gestão de ata: saldo, empenho, entrega").
--
-- A PERGUNTA QUE O GESTOR FAZ TODA SEMANA: *"dessa ata que eu ganhei, quanto ainda posso
-- entregar?"* Até aqui o produto acompanhava até a vitória e abandonava o cliente exatamente onde
-- o dinheiro entra. Ata sem saldo é papel; ata com saldo é agenda de faturamento.
--
-- ── DUAS COISAS NASCEM AQUI, E ELAS SÃO DE NATUREZAS DIFERENTES ─────────────────────────────
-- 1. A VIGÊNCIA DA ATA, em `negocios` (duas colunas). Ela é atributo do próprio negócio — a ata
--    É o negócio na fase final — e por isso não vira tabela.
-- 2. O SALDO POR ITEM, em `ata_saldo`. Ele é dado que ALGUÉM DIGITA, e por isso mora separado.
--
-- >>> POR QUE O SALDO NÃO É COLUNA EM `negocio_itens_ganhos`. Aquela tabela guarda o que se
--     GANHOU — um fato do certame, confirmado uma vez. O empenho é um fato POSTERIOR e que muda
--     toda semana. Misturar os dois faria cada atualização de empenho parecer uma reconfirmação
--     do resultado. E há um motivo mais duro: os itens de uma ata podem vir do resultado publicado
--     pelo PNCP, que **não tem linha** em `negocio_itens_ganhos` (medido: ela tem ZERO linhas hoje,
--     e os 195 itens do único certame com resultado vieram todos do PNCP). Uma coluna lá deixaria
--     sem lugar para gravar o saldo justamente dos itens que existem.
--
-- ── `origem` E A LIÇÃO DO `valor_ganho` ─────────────────────────────────────────────────────
-- Dado digitado NUNCA se confunde com dado publicado. O `valor_ganho` é um campo que alguém digita
-- e foi usado como porteiro do que a tela mostrava — a B23 achou uma aba Ata em branco com 192
-- resultados publicados dentro do banco. Aqui a coluna existe desde o primeiro dia, e a tela
-- escreve "informado por você" em cada linha que veio de gente.
-- >>> HOJE SÓ EXISTE 'informado'. O PNCP publica `/v1/atas` e `/v1/contratos`, mas **empenho por
--     item não está no nosso dado** — está medido e escrito: nenhuma tabela desta casa tem
--     empenho. O valor 'pncp' está no CHECK esperando a fonte existir, e o dia em que ela existir
--     as duas origens vão poder discordar sem se misturar. Um CHECK com um valor só obrigaria a
--     alterar o esquema no dia da fonte nova, e alteração de esquema com pressa é como as duas
--     origens acabam na mesma coluna.
--
-- ── NULL É "NÃO INFORMADO", E ZERO É UMA AFIRMAÇÃO ──────────────────────────────────────────
-- `empenhado` e `entregue` nascem NULL e as colunas são anuláveis de propósito. Zero significa
-- "o órgão não empenhou nada", que é uma afirmação sobre o comportamento do cliente. Ata nova com
-- zero em toda linha diria "ninguém empenhou" quando a verdade é "ninguém olhou".
--
-- Seguro re-rodar. Só ADITIVO: nenhuma coluna sai, nenhuma linha é tocada.
-- ============================================================

-- ── 1. A VIGÊNCIA DA ATA ────────────────────────────────────────────────────────────────────
alter table public.negocios add column if not exists ata_vigencia_inicio date;
alter table public.negocios add column if not exists ata_vigencia_fim    date;

-- ── 2. O SALDO POR ITEM ─────────────────────────────────────────────────────────────────────
create table if not exists public.ata_saldo (
  id            bigint generated always as identity primary key,
  negocio_id    bigint not null references public.negocios(id),

  -- A CHAVE É O NÚMERO DO ITEM COMO TEXTO, e é a mesma que a tela usa para juntar as duas fontes
  -- (`ganhosDoNegocio`). Número aqui e texto lá fariam "07" e "7" serem itens diferentes na ata do
  -- mesmo pregão — e o saldo do item 7 apareceria em branco com o dado gravado ao lado.
  item_n        text not null,

  empenhado     numeric check (empenhado >= 0),   -- NULL = não informado. NUNCA 0 por omissão.
  entregue      numeric check (entregue  >= 0),

  origem        text not null default 'informado' check (origem in ('informado','pncp')),
  observacao    text,
  informado_por text,
  informado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- UMA LINHA POR ITEM. Duas seriam dois saldos para o mesmo item, e a escolha entre elas cairia
  -- na ordem em que o banco devolveu as linhas — que é sorteio, não regra.
  constraint ata_saldo_item_unico unique (negocio_id, item_n)
);

create index if not exists ata_saldo_negocio_idx on public.ata_saldo (negocio_id);

-- >>> NÃO HÁ CHECK DE `entregue <= empenhado` NEM DE `empenhado <= quantidade`, E É DECISÃO.
--     A quantidade registrada não mora aqui (ela vem do item do edital ou da confirmação), então o
--     banco não teria como conferir a segunda. E a primeira o banco PODERIA conferir — mas
--     recusaria a digitação de quem está registrando uma entrega que o órgão realmente pediu além
--     do empenho lançado, que acontece. A tela MOSTRA a incoerência com todas as letras em vez de
--     recusar a linha: número estranho visível se conserta; digitação recusada vira anotação no
--     caderno de alguém, fora do sistema.

-- ── 3. A VISÃO DAS ATAS POR VENCIMENTO ──────────────────────────────────────────────────────
-- A conta de "quantos dias faltam" fica NO BANCO, num lugar só — a mesma decisão da
-- `v_documentos_situacao`, e pelo mesmo motivo escrito lá: se cada tela calculasse por conta
-- própria, uma diria "vence em 5 dias" e a outra "vencida" no mesmo dia.
-- >>> ORDENADA POR QUEM VENCE PRIMEIRO, que é a ordem que a caixa pediu — e ela é a ordem do
--     dinheiro indo embora. Ata vencendo com saldo grande é faturamento perdido em silêncio.
-- >>> AS SEM VIGÊNCIA FICAM NO FIM, nunca no topo: "sem data" no lugar de destaque parece a mais
--     urgente, e é o contrário — é a que ninguém sabe.
create or replace view public.v_atas_vigencia
  with (security_invoker = on) as
select n.id, n.titulo, n.orgao, n.municipio, n.uf, n.numero, n.valor_ganho,
       n.ata_vigencia_inicio, n.ata_vigencia_fim,
       (n.ata_vigencia_fim - current_date) as dias_para_vencer,
       case
         when n.ata_vigencia_fim is null                          then 'sem_vigencia'
         when n.ata_vigencia_fim <  current_date                  then 'vencida'
         when n.ata_vigencia_fim <= current_date + 60             then 'vencendo'
         else                                                          'vigente'
       end as situacao,
       (select count(*) from public.ata_saldo s where s.negocio_id = n.id) as itens_com_saldo
  from public.negocios n
 where n.estagio = 'contrato'
 order by n.ata_vigencia_fim asc nulls last, n.id asc;

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
-- LÊ quem está logado: saldo de ata é agenda de faturamento, e quem fatura precisa ver.
-- ESCREVE quem grava no funil — o mesmo desenho de `negocio_itens_ganhos`, porque é a mesma
-- natureza de dado (registro comercial deste negócio).
alter table public.ata_saldo enable row level security;

drop policy if exists ata_saldo_sel on public.ata_saldo;
drop policy if exists ata_saldo_ins on public.ata_saldo;
drop policy if exists ata_saldo_upd on public.ata_saldo;
drop policy if exists ata_saldo_del on public.ata_saldo;

create policy ata_saldo_sel on public.ata_saldo for select to authenticated using (true);
create policy ata_saldo_ins on public.ata_saldo for insert to authenticated with check (public.cargo_gestor());
create policy ata_saldo_upd on public.ata_saldo for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
-- SEM DELETE: apagar um saldo informado é apagar a resposta de "quanto sobrou em agosto". O
-- caminho de errar e consertar é gravar por cima com o valor certo, e o `atualizado_em` registra.

revoke all on public.ata_saldo from anon;
grant select on public.ata_saldo to authenticated;
grant insert, update on public.ata_saldo to authenticated;
grant select on public.v_atas_vigencia to authenticated;
revoke all on public.v_atas_vigencia from anon;

notify pgrst, 'reload schema';
