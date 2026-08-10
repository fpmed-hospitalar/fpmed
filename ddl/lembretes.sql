-- ============================================================
-- FPMED — TABELA lembretes (o que alguém precisa fazer, e quando)
-- Item 7 da fila / seção 8.2 do LICITACOES_SPEC.md, 08/08/2026.
--
-- O QUE É: título + data/hora + prioridade, preso a um negócio do funil. Aparece na ficha, na
-- agenda e no sino.
--
-- >>> POR QUE PRECISA DE TABELA, e não sai derivado como o resto do sino: tudo que o sino avisa
--     hoje é FATO — a sessão abre amanhã, a certidão vence em 5 dias. Fato não precisa ser
--     guardado, é lido de onde já está. Lembrete é o contrário: é uma INTENÇÃO que alguém teve
--     ("ligar pro fornecedor antes da sessão"), e intenção não está escrita em lugar nenhum.
--     Sem tabela, ela mora na cabeça de quem pensou — que é exatamente o problema.
--
-- >>> `prioridade` COM TRÊS NÍVEIS E NÃO CINCO. Cinco níveis viram "todo mundo marca alta" em
--     duas semanas, e aí a prioridade deixa de separar qualquer coisa. Três força a escolha.
--
-- >>> `feito` E NÃO delete: lembrete cumprido vira histórico do negócio ("avisamos o fornecedor
--     dia 10"). Apagar perderia a prova de que a coisa foi feita.
--
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.lembretes (
  id           bigint generated always as identity primary key,
  negocio_id   bigint not null references public.negocios(id) on delete cascade,
  empresa_id   bigint references public.empresas(id),

  titulo       text not null,
  quando       timestamptz not null,
  prioridade   text not null default 'media' check (prioridade in ('alta','media','baixa')),

  feito        boolean not null default false,
  feito_em     timestamptz,
  feito_por    uuid,

  criado_em    timestamptz not null default now(),
  criado_por   uuid,
  atualizado_em timestamptz not null default now()
);

-- o caminho quente é "o que está aberto e vence logo" — é o que o sino pergunta
create index if not exists lembretes_abertos_idx on public.lembretes (quando) where not feito;
create index if not exists lembretes_negocio_idx on public.lembretes (negocio_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Mesma régua do funil: ele é tela de gestor (a `negocios` inteira é), e o lembrete vive preso
-- a um negócio. Deixar o lembrete mais aberto que o negócio a que ele pertence vazaria pelo
-- título ("ligar pro fornecedor X sobre o pregão Y") o que a tabela de cima protege.
alter table public.lembretes enable row level security;

drop policy if exists lem_sel on public.lembretes;
drop policy if exists lem_ins on public.lembretes;
drop policy if exists lem_upd on public.lembretes;
drop policy if exists lem_del on public.lembretes;

create policy lem_sel on public.lembretes for select to authenticated using (public.cargo_gestor());
create policy lem_ins on public.lembretes for insert to authenticated with check (public.cargo_gestor());
create policy lem_upd on public.lembretes for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy lem_del on public.lembretes for delete to authenticated using (public.cargo_gestor());

revoke all on public.lembretes from anon;
grant select, insert, update, delete on public.lembretes to authenticated;

notify pgrst, 'reload schema';
