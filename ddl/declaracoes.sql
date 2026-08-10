-- ============================================================
-- FPMED — TABELA declaracoes (o gerador de declarações de habilitação)
-- Módulo 2.10 da spec, 08/08/2026. Segundo dos 14.
--
-- O QUE É: todo edital exige um maço de declarações assinadas — não emprega menor, ME/EPP,
-- inexistência de fato impeditivo, proposta independente, etc. São sempre as MESMAS, mudando
-- só a empresa, o órgão e o número do processo. Hoje isso é copiar de um edital anterior no
-- Word e trocar o cabeçalho na mão — que é como o número do processo do concorrente aparece
-- na declaração da FPMED.
--
-- >>> POR QUE O TEXTO GERADO É GUARDADO, e não só os campos: declaração é documento com valor
--     legal e ASSINADO. Guardar só "tipo + órgão + número" e re-gerar depois significa que, se
--     o modelo mudar (a lei muda, a redação melhora), o que se imprime hoje deixa de ser o que
--     foi assinado ontem — e não há como provar o que a empresa declarou. O texto fica
--     congelado no ato, junto com a VERSÃO do modelo que o gerou.
--
-- >>> `revisado_por` EXISTE E COMEÇA NULO DE PROPÓSITO. A própria spec diz que peça com valor
--     legal precisa de revisão humana. O sistema não pode fingir que gerar é o mesmo que
--     conferir: a coluna existe para que "quem assinou isto leu isto" seja uma informação do
--     banco, e não uma suposição.
--
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.declaracoes (
  id             bigint generated always as identity primary key,
  empresa_id     bigint references public.empresas(id),
  negocio_id     bigint references public.negocios(id) on delete set null,  -- quando nasce de um negócio do funil

  tipo           text not null,        -- a chave do modelo ('menor', 'me_epp', 'fato_impeditivo'…)
  titulo         text not null,        -- o título como sai impresso
  modelo_versao  text not null,        -- qual redação gerou este texto (ver acima)

  orgao          text,
  numero_compra  text,
  numero_processo text,
  representante  text,                 -- quem assina
  representante_cargo text,
  representante_cpf   text,

  conteudo       text not null,        -- o TEXTO FINAL, congelado no ato
  revisado_por   uuid,                 -- NULL = gerado e não conferido por ninguém
  revisado_em    timestamptz,

  criado_em      timestamptz not null default now(),
  criado_por     uuid,
  atualizado_em  timestamptz not null default now()
);

create index if not exists declaracoes_negocio_idx on public.declaracoes (negocio_id);
create index if not exists declaracoes_criado_idx  on public.declaracoes (criado_em desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Declaração é documento da empresa, do mesmo naipe da habilitação: todo logado LÊ (quem monta
-- a proposta precisa saber o que já foi declarado), e só gestor GERA — a declaração é assinada
-- por quem responde pela empresa, e emiti-la é ato dele.
alter table public.declaracoes enable row level security;

drop policy if exists dec_sel on public.declaracoes;
drop policy if exists dec_ins on public.declaracoes;
drop policy if exists dec_upd on public.declaracoes;
drop policy if exists dec_del on public.declaracoes;

create policy dec_sel on public.declaracoes for select to authenticated using (true);
create policy dec_ins on public.declaracoes for insert to authenticated with check (public.cargo_gestor());
create policy dec_upd on public.declaracoes for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy dec_del on public.declaracoes for delete to authenticated using (public.cargo_gestor());

revoke all on public.declaracoes from anon;
grant select on public.declaracoes to authenticated;
grant insert, update, delete on public.declaracoes to authenticated;

notify pgrst, 'reload schema';
