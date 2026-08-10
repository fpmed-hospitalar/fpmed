-- ============================================================
-- FPMED — FICHA DO NEGÓCIO EDITÁVEL + RASTRO DE ALTERAÇÃO (08/08/2026, URGÊNCIA do Lemuel)
--
-- POR QUE VIROU URGÊNCIA: o sistema já está em uso real. Pregão é ADIADO, SUSPENSO, CANCELADO
-- e REMARCADO o tempo todo — e os campos vindos da carga do Calendário eram somente leitura.
-- Resultado: pregão adiado ficava com a data velha, e o sino avisava pelo DIA ERRADO. Um aviso
-- que aponta o dia errado é pior que aviso nenhum: quem confia nele perde a sessão.
--
-- ══ AS DUAS PEÇAS ═══════════════════════════════════════════════════════════════════════════
-- 1. `situacao` do certame — ADIADO/SUSPENSO/CANCELADO/REMARCADO é FATO DO MUNDO, e não fase do
--    funil. Por isso é coluna própria e não um `estagio` novo: um pregão suspenso continua na
--    fase em que estava (qualificação, disputa), e misturar as duas coisas faria a empresa
--    perder a informação de onde parou quando ele voltar.
--
-- 2. O RASTRO POR TRIGGER, e não pelo front-end. Esta é a decisão que importa:
--    >>> se o registro dependesse da tela, bastaria alguém alterar por outra via — um script,
--        o painel do Supabase, uma tela futura — para a mudança acontecer SEM rastro. E o rastro
--        que falha justamente na alteração que ninguém quis assumir é o rastro que não serve.
--        No gatilho, o banco registra sempre, e a tela não tem como esquecer.
--    `auth.uid()` é lido dentro do gatilho: quem mudou é quem estava logado, não quem a tela diz.
--
-- >>> `anotacoes` NÃO É TOCADA. É a observação histórica que veio da planilha Calendário 2025 —
--     memória da operação, não campo de log. Escrever rastro ali misturaria o que a empresa
--     escreveu com o que o sistema anotou, e depois não haveria como separar.
--     (Medido em 08/08: 0 das 2.555 linhas têm anotação preenchida. Ainda assim fica de fora —
--      o campo é DELES; o dia em que alguém escrever, o sistema não pode estar usando o espaço.)
--
-- Seguro re-rodar.
-- ============================================================

-- ── 1. A SITUAÇÃO DO CERTAME ─────────────────────────────────────────────────
alter table public.negocios add column if not exists situacao text not null default 'normal';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'negocios_situacao_check') then
    alter table public.negocios add constraint negocios_situacao_check
      check (situacao in ('normal','adiado','suspenso','cancelado','remarcado'));
  end if;
end $$;

-- os cancelados/suspensos continuam no funil (não somem sozinhos) — o índice é pra tela filtrar
create index if not exists negocios_situacao_idx on public.negocios (situacao) where situacao <> 'normal';

-- ── 2. O RASTRO ──────────────────────────────────────────────────────────────
create table if not exists public.negocio_alteracoes (
  id         bigint generated always as identity primary key,
  negocio_id bigint not null references public.negocios(id) on delete cascade,
  campo      text not null,
  de         text,                    -- valor anterior, como texto: o histórico é pra LER
  para       text,
  quem       uuid,                    -- auth.uid() no instante da mudança
  quem_email text,                    -- desnormalizado de propósito: perfil apagado não apaga o histórico
  quando     timestamptz not null default now()
);
create index if not exists negocio_alt_neg_idx on public.negocio_alteracoes (negocio_id, quando desc);

-- ── 3. O GATILHO ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER pra conseguir gravar no histórico mesmo quando a policy de INSERT da tabela
-- de log não valeria pro usuário: o rastro não é opcional, e não pode depender de permissão de
-- escrita que alguém possa não ter.
create or replace function public.negocios_registra_alteracao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  u uuid := auth.uid();
  em text;
begin
  select email into em from public.perfis where id = u;

  -- só os campos que a ficha deixa editar. Mudança de `estagio` já é visível no kanban e teria
  -- ruído demais no histórico (arrastar card é a operação mais comum do funil).
  if new.abertura is distinct from old.abertura then
    insert into public.negocio_alteracoes (negocio_id, campo, de, para, quem, quem_email)
    values (new.id, 'abertura',
            to_char(old.abertura at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
            to_char(new.abertura at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), u, em);
  end if;
  if new.situacao is distinct from old.situacao then
    insert into public.negocio_alteracoes (negocio_id, campo, de, para, quem, quem_email)
    values (new.id, 'situacao', old.situacao, new.situacao, u, em);
  end if;
  if new.portal is distinct from old.portal then
    insert into public.negocio_alteracoes (negocio_id, campo, de, para, quem, quem_email)
    values (new.id, 'portal', old.portal, new.portal, u, em);
  end if;
  if new.numero is distinct from old.numero then
    insert into public.negocio_alteracoes (negocio_id, campo, de, para, quem, quem_email)
    values (new.id, 'numero', old.numero, new.numero, u, em);
  end if;
  if new.orgao is distinct from old.orgao then
    insert into public.negocio_alteracoes (negocio_id, campo, de, para, quem, quem_email)
    values (new.id, 'orgao', old.orgao, new.orgao, u, em);
  end if;
  if new.objeto is distinct from old.objeto then
    -- objeto é texto longo: guardar inteiro duas vezes por correção de vírgula incharia a tabela
    insert into public.negocio_alteracoes (negocio_id, campo, de, para, quem, quem_email)
    values (new.id, 'objeto', left(coalesce(old.objeto,''), 300), left(coalesce(new.objeto,''), 300), u, em);
  end if;
  -- ── OS DOIS VALORES (08/08, quando viraram editáveis na ficha) ────────────────────────────
  -- >>> `valor_ganho` É O QUE ALIMENTA A TAXA DE VITÓRIA. Enquanto ele só entrava por carga da
  --     planilha, o número era auditável pela origem. Editável na tela, sem rastro, ele viraria
  --     um indicador que qualquer um muda e ninguém sabe quem mudou — e indicador assim não
  --     serve para decidir nada. Por isso ele entra no gatilho no MESMO dia em que fica editável.
  if new.valor_estimado is distinct from old.valor_estimado then
    insert into public.negocio_alteracoes (negocio_id, campo, de, para, quem, quem_email)
    values (new.id, 'valor_estimado', old.valor_estimado::text, new.valor_estimado::text, u, em);
  end if;
  if new.valor_ganho is distinct from old.valor_ganho then
    insert into public.negocio_alteracoes (negocio_id, campo, de, para, quem, quem_email)
    values (new.id, 'valor_ganho', old.valor_ganho::text, new.valor_ganho::text, u, em);
  end if;
  return new;
end $function$;

drop trigger if exists negocios_rastro on public.negocios;
create trigger negocios_rastro after update on public.negocios
  for each row execute function public.negocios_registra_alteracao();

-- ── 4. RLS do histórico ──────────────────────────────────────────────────────
-- Lê quem lê o funil (é gestor, pela policy da `negocios`). NINGUÉM escreve pela API: quem
-- escreve é o gatilho. Histórico que o usuário pode editar não é histórico.
alter table public.negocio_alteracoes enable row level security;

drop policy if exists nalt_sel on public.negocio_alteracoes;
create policy nalt_sel on public.negocio_alteracoes for select to authenticated using (public.cargo_gestor());
-- sem policy de insert/update/delete: ausência = negado, que é exatamente o desejado aqui.

revoke all on public.negocio_alteracoes from anon;
grant select on public.negocio_alteracoes to authenticated;

notify pgrst, 'reload schema';
