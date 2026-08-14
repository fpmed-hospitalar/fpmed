-- ============================================================================================
-- FPMED — TABELA pncp_sondagens (o log próprio do WATCHDOG do PNCP)
-- Fatia A18. 14/08/2026. 100% ADITIVA.
--
-- ══ O PROBLEMA QUE ELA EXISTE PRA RESOLVER ══════════════════════════════════════════════════
-- Medido em 14/08 (fatia A13): a API de CONSULTA do PNCP — a que alimenta a varredura diária —
-- responde com TimeoutError em 30 s, enquanto a de DETALHE (itens, arquivos, resultados) volta
-- em 179 ms. Não é defeito nosso e não há nada a consertar do nosso lado: falta a janela em que
-- o PNCP responda.
--
-- Enquanto ela está fora, o `tools/coleta_pncp_busca.js` (a porta que ficou aberta) traz a
-- licitação SEM as datas de abertura e encerramento da proposta — e as deixa NULL de propósito,
-- porque data inventada num sistema de prazo é pior que data ausente. Hoje são 1.955 linhas
-- assim, e elas só se completam quando a consulta voltar.
--
-- >>> O QUE NÃO DÁ PRA FAZER É FICAR OLHANDO. A volta pode ser às 3 da manhã de um domingo, e
--     a janela pode durar minutos. Quem tem que perceber é uma rotina, não uma pessoa.
--
-- ══ POR QUE UMA TABELA PRÓPRIA, E NÃO MAIS UMA COLUNA EM `coleta_status` ════════════════════
-- A `coleta_status` guarda ESTADO: uma linha por fonte, sobrescrita a cada rodada. Ela responde
-- "como está agora". O watchdog precisa responder outra pergunta — *"quando voltou, e quanto
-- tempo ficou fora"* —, e essa é HISTÓRIA. Guardar história numa tabela de estado significa
-- perder cada resposta ao gravar a seguinte, que é exatamente o dado que interessa aqui.
--
-- ══ POR QUE TODA SONDAGEM ENTRA, E NÃO SÓ AS VIRADAS ════════════════════════════════════════
-- Porque a duração da queda é a informação que decide se vale insistir — e ela só existe se as
-- tentativas que FALHARAM também estiverem registradas. Um log só de sucessos diria "voltou às
-- 04h12" sem dizer que estava fora desde ontem. É a mesma lição da `usos_coleta_edital`: gravar
-- só o que deu certo faz a falha ser a única coisa invisível.
-- Uma sondagem é uma requisição de 1 registro; a 15 minutos, são ~96 linhas por dia. Nada.
-- ============================================================================================

create table if not exists public.pncp_sondagens (
  id            bigserial primary key,

  -- QUAL PORTA foi sondada. Existem duas, e elas caem separado (medido em 14/08) — registrar
  -- "o PNCP" sem dizer qual delas faria o log afirmar que o portal inteiro caiu quando só a
  -- consulta estava fora, e a de detalhe respondendo em 179 ms.
  api           text not null default 'consulta',   -- 'consulta' | 'detalhe'

  no_ar         boolean not null,
  http          integer,          -- o status, quando houve um
  ms            integer,          -- quanto demorou (timeout também é informação)
  erro          text,             -- por que não; "não sei" tem causa

  -- A VIRADA. `true` só quando o estado MUDOU em relação à sondagem anterior — é por este campo
  -- que se responde "quando voltou" sem ler o log inteiro.
  virada        boolean not null default false,
  fora_desde    timestamptz,      -- preenchido na virada de volta: desde quando estava fora
  fora_minutos  integer,          -- a duração da queda, já calculada (a conta é do watchdog)

  -- O QUE A VOLTA DISPAROU. Sem isto, o log diria que a API voltou e não diria se a varredura
  -- que depende dela chegou a rodar — e "voltou" sem "recolhi" não serve pra nada.
  disparou      boolean not null default false,
  disparo_erro  text,
  datas_antes   integer,          -- quantas licitações estavam com data_abertura NULL
  datas_depois  integer,          -- quantas ficaram (a prova de que a varredura serviu)

  criado_em     timestamptz not null default now()
);

-- A pergunta que o watchdog faz a cada rodada é "como foi a ÚLTIMA sondagem desta API?".
create index if not exists pncp_sondagens_api_tempo
  on public.pncp_sondagens (api, criado_em desc);
-- E a que a tela faria: "quando foi a última virada?".
create index if not exists pncp_sondagens_virada
  on public.pncp_sondagens (criado_em desc) where virada;

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
-- Quem escreve é o watchdog, com a service_role. Ausência de policy de escrita = negado.
-- Todo logado LÊ: é o registro que explica por que a janela de proposta de 1.955 licitações
-- está vazia, e esconder isso do time transformaria a explicação num favor do administrador.
alter table public.pncp_sondagens enable row level security;

drop policy if exists pncp_sondagens_sel on public.pncp_sondagens;
create policy pncp_sondagens_sel on public.pncp_sondagens
  for select to authenticated using (true);

revoke all on public.pncp_sondagens from anon;
grant select on public.pncp_sondagens to authenticated;

notify pgrst, 'reload schema';
