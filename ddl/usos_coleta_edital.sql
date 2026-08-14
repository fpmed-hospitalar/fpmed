-- ============================================================================================
-- FPMED — TABELA usos_coleta_edital (registro de uso e freio do "buscar edital agora")
-- Fatia A14, item 3. 14/08/2026. 100% ADITIVA.
--
-- O QUE É: cada vez que alguém aperta "buscar edital agora" na ficha do negócio, a edge
-- function `buscar-edital` grava uma linha aqui — quem pediu, para qual licitação, o que veio,
-- e se deu certo.
--
-- ══ POR QUE NÃO REUSAR `usos_ia` ═════════════════════════════════════════════════════════════
-- Porque esta chamada NÃO GASTA IA. Ela baixa e extrai um PDF público do PNCP; o custo é banda
-- e CPU, não token. Enfiar linhas de custo ZERO em `usos_ia` faria o número que responde "quanto
-- a FPMED gastou de inteligência artificial este mês?" passar a contar coisas que não são IA —
-- e esse número vira fatura e vira decisão. Registro no lugar errado é pior que registro
-- nenhum: ele parece certo.
--
-- ══ E POR QUE A MESMA TABELA SERVE DE FREIO ═════════════════════════════════════════════════
-- O rate-limit é `count(*) desta hora, deste usuário`. Uma tabela separada só pro freio criaria
-- uma SEGUNDA resposta pra "quantas vezes você chamou hoje?" — e duas contagens da mesma coisa
-- um dia discordam, justamente no dia em que alguém for auditar um abuso.
-- >>> A LINHA É GRAVADA MESMO QUANDO A COLETA FALHA (`ok = false`, com o motivo). Registrar só
--     o sucesso faria a tentativa que derruba o PNCP ser a única invisível — e o freio contaria
--     zero para quem está batendo mais.
-- ============================================================================================

create table if not exists public.usos_coleta_edital (
  id               bigserial primary key,
  usuario_id       uuid,
  email            text,
  numero_controle  text,
  negocio_id       bigint,

  arquivos         integer,        -- quantos o PNCP listou
  extraidos        integer,        -- de quantos saiu texto
  chars            integer,        -- soma dos caracteres extraídos
  ms               integer,        -- quanto demorou (pra saber se o freio está no lugar certo)

  ok               boolean not null default false,
  erro             text,           -- por que não deu; "não sei" tem causa

  criado_em        timestamptz not null default now()
);

-- O índice é do FREIO: a pergunta que a função faz a cada chamada é "quantas linhas deste
-- usuário na última hora?". Sem ele, o freio varre a tabela inteira — e ela só cresce.
create index if not exists usos_coleta_edital_user_tempo
  on public.usos_coleta_edital (usuario_id, criado_em desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
-- Quem escreve é a edge function, com a service_role. Ausência de policy de escrita = negado.
-- Todo logado LÊ: o registro de uso existe pra ser olhado, e esconder do time o que o time fez
-- transformaria a auditoria num favor do administrador.
alter table public.usos_coleta_edital enable row level security;

drop policy if exists usos_coleta_edital_sel on public.usos_coleta_edital;
create policy usos_coleta_edital_sel on public.usos_coleta_edital
  for select to authenticated using (true);

revoke all on public.usos_coleta_edital from anon;
grant select on public.usos_coleta_edital to authenticated;

notify pgrst, 'reload schema';
