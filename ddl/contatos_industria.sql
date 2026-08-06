-- ============================================================
-- FPMED — TABELA contatos_industria (com quem falar em cada fabricante)
-- Bloco 4 do sync de código, 05/08/2026.
--
-- O QUE É: a tela "Alvos de Compra Direta" ranqueia fabricantes por onde vale tentar comprar
-- DIRETO em vez de pelo distribuidor. O ranking é calculado do dado que já temos; esta tabela
-- guarda a parte que só existe fora do sistema — o contato e o andamento da conversa.
--
-- >>> POR QUE ELA É SEPARADA DA `fornecedores`: fabricante alvo NÃO é fornecedor. Ele vira
--     fornecedor no dia em que a compra direta acontecer, e aí entra lá com código de ERP.
--     Misturar os dois encheria a tabela de fornecedores de gente que nunca vendeu nada, e o
--     dropdown de cotação (que lê dali) passaria a oferecer quem não fatura.
--
-- `status` é o funil da conversa, curto de propósito. Funil de 8 estágios num processo que a
-- FPMED faz algumas vezes por ano vira campo que ninguém atualiza.
--
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.contatos_industria (
  id            bigint generated always as identity primary key,
  marca         text not null,          -- casa com cotacoes.marca (é o que o ranking agrupa)
  marca_norm    text generated always as (upper(btrim(marca))) stored,
  empresa       text,                   -- razão social do fabricante, quando souber
  contato       text,                   -- nome da pessoa
  telefone      text,
  email         text,
  status        text not null default 'nao_contatado'
                check (status in ('nao_contatado','contatado','negociando','comprando','descartado')),
  obs           text,
  atualizado_em timestamptz not null default now()
);

-- um registro por marca: dois cadastros da mesma marca é o começo de duas conversas paralelas
-- com o mesmo fabricante, que é constrangedor e faz perder desconto.
create unique index if not exists contatos_industria_marca_uk on public.contatos_industria (marca_norm);
create index if not exists contatos_industria_status_idx on public.contatos_industria (status);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- É inteligência comercial: com quem estamos negociando e em que pé. Leitura só de GESTOR —
-- ao contrário das tabelas de referência (CMED, empresas), esta não é dado público nem
-- identidade própria. Vendedor não precisa saber que a FPMED está negociando com a EMS.
alter table public.contatos_industria enable row level security;

drop policy if exists cti_sel on public.contatos_industria;
drop policy if exists cti_ins on public.contatos_industria;
drop policy if exists cti_upd on public.contatos_industria;
drop policy if exists cti_del on public.contatos_industria;

create policy cti_sel on public.contatos_industria for select to authenticated using (public.cargo_gestor());
create policy cti_ins on public.contatos_industria for insert to authenticated with check (public.cargo_gestor());
create policy cti_upd on public.contatos_industria for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy cti_del on public.contatos_industria for delete to authenticated using (public.cargo_gestor());

revoke all on public.contatos_industria from anon;
grant select, insert, update, delete on public.contatos_industria to authenticated;

notify pgrst, 'reload schema';
