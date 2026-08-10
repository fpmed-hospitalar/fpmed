-- ============================================================
-- FPMED — TABELA pecas_juridicas (impugnação, esclarecimento, recurso, contrarrazões)
-- Módulo 2.9 da spec, 08/08/2026. Terceiro dos 14.
--
-- O QUE É: as peças que a empresa protocola no certame. Diferente da declaração — que é um
-- formulário com o nome trocado — a peça tem TESE: ela argumenta, cita dispositivo e pede algo.
--
-- >>> O QUE MAIS IMPORTA AQUI É O PRAZO, e é por isso que ele é coluna e não observação.
--     Impugnação e esclarecimento têm prazo em DIAS ÚTEIS antes da abertura (Lei 14.133/2021
--     art. 164: até 3 dias úteis antes). Intenção de recurso é manifestada na SESSÃO, e o
--     recurso em si tem 3 dias úteis (art. 165). Peça fora do prazo não é peça fraca — é peça
--     que não existe: o pregoeiro nem lê. Um sistema que gera o texto lindo e deixa passar a
--     data não ajudou em nada.
--
-- >>> `revisado_por` COMEÇA NULO, como na declaração, e aqui pesa mais: peça jurídica protocolada
--     vincula a empresa. A spec exige revisão humana e o sistema não pode fingir que gerar é
--     conferir. Quem assina responde.
--
-- >>> A IA NÃO ESCREVE ESTA PEÇA HOJE. O modelo é guiado por formulário (fatos + fundamento +
--     pedido). Quando o leitor de edital com IA entrar (depende de decisão de custo), ele
--     preenche os FATOS; a tese continua sendo de gente. Registrado pra ninguém achar que a
--     ausência de IA aqui foi esquecimento.
--
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.pecas_juridicas (
  id             bigint generated always as identity primary key,
  empresa_id     bigint references public.empresas(id),
  negocio_id     bigint references public.negocios(id) on delete set null,

  tipo           text not null
                 check (tipo in ('impugnacao','esclarecimento','intencao_recurso','recurso','contrarrazoes')),
  titulo         text not null,
  modelo_versao  text not null,

  orgao          text,
  numero_compra  text,
  numero_processo text,

  -- o PRAZO: o que decide se a peça vale alguma coisa
  prazo_final    date,
  protocolada_em date,

  -- o que o formulário guiado coletou, guardado separado do texto final para permitir reeditar
  fatos          text,
  fundamento     text,
  pedido         text,

  conteudo       text not null,     -- o texto final, congelado no ato (mesma regra da declaração)
  revisado_por   uuid,
  revisado_em    timestamptz,

  criado_em      timestamptz not null default now(),
  criado_por     uuid,
  atualizado_em  timestamptz not null default now()
);

create index if not exists pecas_prazo_idx   on public.pecas_juridicas (prazo_final) where protocolada_em is null;
create index if not exists pecas_negocio_idx on public.pecas_juridicas (negocio_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Mesma régua da declaração: todo logado LÊ, só gestor EMITE. Peça protocolada vincula a
-- empresa — emitir é ato de quem responde por ela.
alter table public.pecas_juridicas enable row level security;

drop policy if exists pj_sel on public.pecas_juridicas;
drop policy if exists pj_ins on public.pecas_juridicas;
drop policy if exists pj_upd on public.pecas_juridicas;
drop policy if exists pj_del on public.pecas_juridicas;

create policy pj_sel on public.pecas_juridicas for select to authenticated using (true);
create policy pj_ins on public.pecas_juridicas for insert to authenticated with check (public.cargo_gestor());
create policy pj_upd on public.pecas_juridicas for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy pj_del on public.pecas_juridicas for delete to authenticated using (public.cargo_gestor());

revoke all on public.pecas_juridicas from anon;
grant select on public.pecas_juridicas to authenticated;
grant insert, update, delete on public.pecas_juridicas to authenticated;

notify pgrst, 'reload schema';
