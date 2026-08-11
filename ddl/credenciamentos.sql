-- ============================================================================================
-- ddl/credenciamentos.sql — 11/08/2026 · CREDENCIAMENTO JUNTO A INDUSTRIA (pedido do Lemuel).
--
-- ══ A PERGUNTA DE MODELAGEM, E A RESPOSTA ═══════════════════════════════════════════════════
-- O pedido veio como "secao na ficha do NEGOCIO". A secao fica la mesmo — mas o credenciamento
-- NAO e do negocio: e da EMPRESA com a INDUSTRIA. Uma distribuidora se credencia junto a EMS
-- uma vez, e aquele credenciamento serve a todos os pregoes daquela marca dali em diante.
-- >>> SE FOSSE POR NEGOCIO, cada pregao criaria um pedido novo pra mesma industria. Em tres
--     meses haveria oito linhas "EMS - solicitado" e ninguem saberia qual e a de verdade — e a
--     pergunta que o operador faz ("eu ja sou credenciado na EMS?") passaria a ter oito
--     respostas. Por isso a chave unica e (empresa, industria), e o negocio entra como a ORIGEM:
--     qual pregao motivou o pedido. A ficha de cada negocio mostra os credenciamentos das marcas
--     que ele precisa, sejam eles nascidos ali ou nao.
--
-- ══ O HISTORICO SAI DE TRIGGER, E ISSO E O PONTO ════════════════════════════════════════════
-- "O historico NUNCA se apaga" foi o pedido. Historico que a TELA escreve e historico que a tela
-- pode esquecer de escrever — basta um caminho novo de atualizacao (um script, o painel do
-- Supabase, outra tela) pra mudanca de status acontecer sem rastro, e o buraco so aparece meses
-- depois, quando alguem pergunta "desde quando isso esta em analise?".
-- Aqui quem grava e o BANCO, em `after update`. Nao ha caminho que mude o status sem registrar.
--
-- >>> E NAO HA POLICY DE DELETE. Nem em `credenciamentos`, nem no historico. Sem policy, a RLS
--     nega — o DELETE nao e "difícil", e impossivel pra quem entra pelo PostgREST.
--
-- ADITIVO: so cria. Nao toca em `contatos_industria` (que responde outra pergunta: QUEM e o
-- contato de cada marca). Roda 2x sem estragar.
-- ============================================================================================

create table if not exists public.credenciamentos (
  id           bigserial primary key,
  empresa_id   bigint      not null references public.empresas(id),
  industria    text        not null,
  -- A CHAVE DE COMPARACAO. "EMS", "ems", "E.M.S." e "EMS S/A" sao a mesma industria pra quem
  -- trabalha, e seriam quatro credenciamentos pro banco. Normalizada por trigger, nunca a mao.
  industria_norm text      not null,
  -- QUAL PREGAO MOTIVOU. Fica como origem, e nao como dono: apagar o negocio nao apaga o
  -- credenciamento, que continua valendo pros proximos.
  negocio_id   bigint      references public.negocios(id) on delete set null,
  status       text        not null default 'solicitado'
               check (status in ('solicitado','em_analise','aprovado','negado')),
  canal        text        check (canal in ('email','portal','representante','telefone','outro')),
  protocolo    text,
  contato_nome text,
  contato_email text,
  contato_telefone text,
  obs          text,
  -- DUAS DATAS, e elas nao sao a mesma coisa: `solicitado_em` e quando o pedido saiu (e a que
  -- conta os dias parados) e `respondido_em` e quando a industria respondeu. Usar `criado_em`
  -- pra contar atraso erraria em todo pedido cadastrado depois de enviado.
  solicitado_em timestamptz not null default now(),
  respondido_em timestamptz,
  criado_por   text,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- UMA industria, UM credenciamento por empresa. Pedido negado que se refaz volta pra
-- 'solicitado' na MESMA linha — e o historico guarda que ja foi negado antes, que e exatamente
-- a informacao que uma segunda linha destruiria.
create unique index if not exists credenciamentos_empresa_industria
  on public.credenciamentos (empresa_id, industria_norm);
create index if not exists credenciamentos_negocio on public.credenciamentos (negocio_id);
create index if not exists credenciamentos_status on public.credenciamentos (status);

comment on table public.credenciamentos is
  'Credenciamento da empresa junto a uma industria/laboratorio. UM por (empresa, industria) — o '
  'negocio entra como origem (qual pregao motivou), nao como dono.';

-- ── O HISTORICO ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.credenciamento_historico (
  id                bigserial primary key,
  credenciamento_id bigint not null references public.credenciamentos(id) on delete cascade,
  de_status         text,
  para_status       text not null,
  quem              text,
  nota              text,
  quando            timestamptz not null default now()
);
create index if not exists cred_hist_por_cred
  on public.credenciamento_historico (credenciamento_id, quando desc);

comment on table public.credenciamento_historico is
  'Toda mudanca de status de um credenciamento. Escrito por TRIGGER, nunca pela tela: historico '
  'que a tela escreve e historico que a tela pode esquecer de escrever.';

-- ── AS TRIGGERS ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cred_normaliza() returns trigger
language plpgsql as $$
begin
  -- Tira acento, pontuacao e espaco, e sobe pra maiuscula. "E.M.S. S/A" e "ems" viram "EMSSA" e
  -- "EMS" — ainda diferentes, e isso e proposital: adivinhar que sao a mesma empresa e o tipo de
  -- esperteza que um dia funde duas industrias distintas. O que se resolve aqui e so grafia.
  new.industria_norm := upper(regexp_replace(
    translate(coalesce(new.industria,''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                                          'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
    '[^A-Za-z0-9]', '', 'g'));
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists cred_normaliza_t on public.credenciamentos;
create trigger cred_normaliza_t before insert or update on public.credenciamentos
  for each row execute function public.cred_normaliza();

create or replace function public.cred_historia() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.credenciamento_historico (credenciamento_id, de_status, para_status, quem, nota)
      values (new.id, null, new.status, new.criado_por, 'pedido registrado');
    return new;
  end if;
  -- Só o STATUS faz história. Corrigir um telefone não é um passo do processo, e um histórico
  -- que registra tudo vira um histórico que ninguém lê — que é o mesmo que não ter.
  if (new.status is distinct from old.status) then
    insert into public.credenciamento_historico (credenciamento_id, de_status, para_status, quem)
      values (new.id, old.status, new.status, new.criado_por);
  end if;
  return new;
end $$;

drop trigger if exists cred_historia_t on public.credenciamentos;
create trigger cred_historia_t after insert or update on public.credenciamentos
  for each row execute function public.cred_historia();

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
alter table public.credenciamentos enable row level security;
alter table public.credenciamento_historico enable row level security;

drop policy if exists cred_sel on public.credenciamentos;
drop policy if exists cred_ins on public.credenciamentos;
drop policy if exists cred_upd on public.credenciamentos;
create policy cred_sel on public.credenciamentos for select to authenticated using (true);
create policy cred_ins on public.credenciamentos for insert to authenticated with check (true);
create policy cred_upd on public.credenciamentos for update to authenticated using (true) with check (true);
-- >>> SEM policy de DELETE, de proposito. Sem ela a RLS nega, e credenciamento apagado seria
--     perder a prova de que o pedido foi feito — que e o unico documento que a empresa tem
--     quando a industria diz "voces nunca solicitaram".

drop policy if exists cred_hist_sel on public.credenciamento_historico;
drop policy if exists cred_hist_ins on public.credenciamento_historico;
create policy cred_hist_sel on public.credenciamento_historico for select to authenticated using (true);
-- INSERT liberado porque a trigger roda com os direitos de quem faz o UPDATE. Sem UPDATE nem
-- DELETE: linha de historico que se edita nao e historico.
create policy cred_hist_ins on public.credenciamento_historico for insert to authenticated with check (true);

revoke all on public.credenciamentos from anon;
revoke all on public.credenciamento_historico from anon;
grant select, insert, update on public.credenciamentos to authenticated;
grant select, insert on public.credenciamento_historico to authenticated;
grant usage, select on sequence public.credenciamentos_id_seq to authenticated;
grant usage, select on sequence public.credenciamento_historico_id_seq to authenticated;

notify pgrst, 'reload schema';
