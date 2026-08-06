-- ============================================================
-- FPMED — TABELA jornais (buscas salvas da tela Licitações)
-- Item 9, 3º pedaço · 06/08/2026.
--
-- O QUE É: um "jornal" é uma pesquisa avançada SALVA COM NOME. O operador monta a busca que
-- interessa (palavras-chave, UF, modalidade, portal, faixa de valor…), salva, e passa a abrir
-- aquilo com um clique — vendo o que CHEGOU DEPOIS da última leitura dele.
--
-- >>> POR QUE `vistos` EXISTE, e por que ele é a peça central e não um detalhe:
--     "busca salva" sozinha é um atalho. O que o SIGA vende como retenção é o DELTA — "8 novas
--     desde ontem". Sem guardar o que já foi visto, toda abertura mostraria as mesmas 70 e o
--     operador reler-ia tudo de novo pra achar as 3 que mudaram. `vistos` guarda o
--     `numeroControlePNCP` de cada licitação que já apareceu pra ele naquele jornal.
--     Fica no BANCO (e não no localStorage) porque o mesmo usuário abre em máquinas diferentes:
--     no navegador, trocar de computador reapresentaria tudo como novidade.
--
-- >>> POR QUE A JANELA DE DATA É GUARDADA COM UM TIPO ('movel' | 'fixa'):
--     um jornal salvo hoje com "05/08 a 05/08" reabriria amanhã pesquisando ONTEM, em silêncio —
--     uma busca salva que envelhece sozinha é pior que nenhuma. Quando a janela é a padrão da
--     tela (o último dia útil), o jornal guarda o TIPO e recalcula a data na hora de abrir.
--     Quando o operador escolheu um intervalo específico, guarda as datas e a tela DIZ que
--     aquela janela é fixa. O que não pode é adivinhar qual dos dois ele quis.
--
-- >>> NÃO HÁ e-mail/WhatsApp aqui, de propósito: provedor de envio tem custo e é decisão do
--     Lemuel (registrado na 6.1 do LICITACOES_SPEC.md). O aviso é IN-APP e sai do NOSSO banco
--     (`licitacoes`, que a coleta agendada abastece 3x/dia) — não do PNCP ao vivo, que caiu ~6x
--     em 3 dias. Quando o e-mail for liberado, o delta já está pronto: é este `vistos`.
--
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.jornais (
  id              bigint generated always as identity primary key,
  -- dono. `default auth.uid()` pra que a tela não precise mandar o campo (e não possa errar).
  usuario         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome            text not null,
  -- a pesquisa inteira, do jeito que a tela monta: {kw, excluir, uf, mod, janela:{tipo,de,ate},
  -- portal, modo, sit, orgao, srp, vmin, vmax, desertas}. JSONB e não 12 colunas porque o
  -- conjunto de filtros do refino JÁ mudou uma vez (item 9, 4º pedaço) e vai mudar de novo —
  -- cada filtro novo viraria uma migração de coluna pra um dado que só a tela interpreta.
  filtros         jsonb not null,
  -- numeroControlePNCP já mostrados a ele NESTE jornal. É o que faz "novas desde a última vez"
  -- significar alguma coisa. Limitado no cliente (últimos 800) pra não crescer sem fim.
  vistos          jsonb not null default '[]'::jsonb,
  ultima_leitura  timestamptz,          -- NULL = nunca abriu: a 1ª leitura não inventa "novidade"
  ultimo_total    int,                  -- quantas bateram na última leitura (só pra informar)
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create index if not exists jornais_usuario_idx on public.jornais (usuario);
-- dois jornais com o mesmo nome pro mesmo usuário viram "qual desses é o meu?" na lista
create unique index if not exists jornais_usuario_nome_uk on public.jornais (usuario, lower(nome));

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- DONO, e só. Note que aqui NÃO entra `cargo_gestor()`: o gate de quem entra na tela de
-- Licitações é do gm-auth (Licitações é tela de inteligência, gestor). Amarrar o jornal ao
-- cargo faria os jornais de alguém SUMIREM no dia em que o cargo dele mudasse — perda
-- silenciosa de trabalho salvo, por uma regra que já é aplicada uma camada acima.
alter table public.jornais enable row level security;

drop policy if exists jor_sel on public.jornais;
drop policy if exists jor_ins on public.jornais;
drop policy if exists jor_upd on public.jornais;
drop policy if exists jor_del on public.jornais;

create policy jor_sel on public.jornais for select to authenticated using (usuario = auth.uid());
create policy jor_ins on public.jornais for insert to authenticated with check (usuario = auth.uid());
create policy jor_upd on public.jornais for update to authenticated using (usuario = auth.uid()) with check (usuario = auth.uid());
create policy jor_del on public.jornais for delete to authenticated using (usuario = auth.uid());

revoke all on public.jornais from anon;
grant select, insert, update, delete on public.jornais to authenticated;

notify pgrst, 'reload schema';
