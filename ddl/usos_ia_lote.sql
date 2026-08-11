-- ============================================================================================
-- ddl/usos_ia_lote.sql — 11/08/2026 · LEITURA EM PARTES = UM registro de cobranca, nao N.
--
-- ══ O PROBLEMA QUE ISTO RESOLVE ═════════════════════════════════════════════════════════════
-- Edital grande passou a ser lido em partes. Se cada parte virasse uma linha em `usos_ia`, a
-- conta do mes mostraria "23 leituras" para UM edital lido — e o cliente, que paga por leitura,
-- veria 23 cobrancas de um servico que ele usou uma vez. A fatura estaria tecnicamente correta e
-- comercialmente indefensavel.
-- Entao: as N partes acumulam numa linha SO, identificada por `lote`.
--
-- ══ POR QUE UMA FUNCAO, E NAO UM UPDATE PELA TELA ═══════════════════════════════════════════
-- Acumular e ler-somar-gravar. Feito pela tela (ou por N chamadas concorrentes da edge function),
-- duas partes que voltam juntas leem o mesmo total e uma sobrescreve a soma da outra — e a
-- cobranca sai MENOR que o custo, silenciosamente. `insert ... on conflict do update` faz a soma
-- DENTRO do banco, numa operacao atomica, e nao depende de as partes chegarem em ordem.
--
-- ADITIVO: colunas novas com default, indice novo, funcao nova. Nenhum DROP de dado, nenhum
-- UPDATE das linhas existentes (as 3 que ha continuam sendo leituras de 1 parte, que e o que
-- `partes` default 1 diz). Roda 2x.
-- ============================================================================================

alter table public.usos_ia
  add column if not exists lote      text,
  add column if not exists partes    int  not null default 1,
  add column if not exists partes_ok int  not null default 1;

comment on column public.usos_ia.lote is
  'Identificador da leitura em partes. Todas as partes de um mesmo edital acumulam nesta UMA '
  'linha. Null = leitura de parte unica (o caso antigo).';
comment on column public.usos_ia.partes is
  'Em quantas partes o documento foi dividido. 1 = leitura direta.';
comment on column public.usos_ia.partes_ok is
  'Quantas partes voltaram bem. partes_ok < partes = leitura INCOMPLETA — e a tela precisa dizer '
  'quais faltaram, porque uma lista de itens com buraco nao se parece com erro nenhum.';

-- UMA linha por lote. Sem isso, duas partes que cheguem no mesmo instante criariam duas linhas e
-- a soma se partiria em duas cobrancas — exatamente o que este arquivo existe pra impedir.
create unique index if not exists usos_ia_lote_unico on public.usos_ia (lote) where lote is not null;

-- ── A ACUMULACAO ────────────────────────────────────────────────────────────────────────────
-- Recebe UMA parte e devolve o id da linha do lote. A primeira cria; as seguintes somam.
create or replace function public.registra_uso_ia(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  insert into public.usos_ia (
    usuario, email, edital_titulo, edital_url, edital_mb, modo, modo_motivo,
    paginas, chars, modelo, tokens_entrada, tokens_saida, segundos,
    usd, cambio, brl, ok, erro, tipo, tarefa, lote, partes, partes_ok)
  values (
    (p->>'usuario')::uuid, p->>'email', p->>'edital_titulo', p->>'edital_url',
    (p->>'edital_mb')::numeric, p->>'modo', p->>'modo_motivo',
    (p->>'paginas')::int, (p->>'chars')::int, p->>'modelo',
    coalesce((p->>'tokens_entrada')::int, 0), coalesce((p->>'tokens_saida')::int, 0),
    coalesce((p->>'segundos')::int, 0),
    coalesce((p->>'usd')::numeric, 0), (p->>'cambio')::numeric, (p->>'brl')::numeric,
    coalesce((p->>'ok')::boolean, true), p->>'erro',
    coalesce(p->>'tipo', 'edital'), coalesce(p->>'tarefa', 'resumo'),
    p->>'lote', coalesce((p->>'partes')::int, 1),
    case when coalesce((p->>'ok')::boolean, true) then 1 else 0 end)
  on conflict (lote) where lote is not null do update set
    -- SOMA o que custou. O tempo tambem soma: sao leituras em sequencia, e o que interessa a
    -- quem le a conta e quanto tempo o edital inteiro levou.
    tokens_entrada = usos_ia.tokens_entrada + excluded.tokens_entrada,
    tokens_saida   = usos_ia.tokens_saida   + excluded.tokens_saida,
    segundos       = usos_ia.segundos       + excluded.segundos,
    usd            = usos_ia.usd            + excluded.usd,
    brl            = coalesce(usos_ia.brl, 0) + coalesce(excluded.brl, 0),
    partes_ok      = usos_ia.partes_ok      + excluded.partes_ok,
    -- >>> UMA PARTE QUE FALHA DERRUBA O `ok` DA LEITURA INTEIRA, e nao ha volta pra true. Uma
    --     leitura marcada "ok" com uma parte faltando e a mentira mais cara possivel aqui: ela
    --     diz que a lista de itens esta completa quando falta um pedaco.
    ok             = usos_ia.ok and excluded.ok,
    -- O primeiro erro fica; os seguintes se acumulam separados por " · " ate caber.
    -- >>> `concat_ws` + `nullif` de proposito: a 1a versao usava `coalesce(erro || ' · ', '')` e
    --     a coluna virava STRING VAZIA na parte que dava certo — dai a parte seguinte, que
    --     falhava, gravava " · a tabela nao coube", com o separador solto na frente. Erro que
    --     comeca com separador parece mensagem cortada, e mensagem cortada faz quem le procurar
    --     um pedaco que nunca existiu.
    erro           = nullif(left(concat_ws(' · ', nullif(usos_ia.erro, ''), nullif(excluded.erro, '')), 300), ''),
    chars          = coalesce(usos_ia.chars, 0) + coalesce(excluded.chars, 0)
  returning id into v_id;
  return v_id;
end $$;

comment on function public.registra_uso_ia(jsonb) is
  'Registra UMA parte de uma leitura de IA, acumulando no lote. security definer porque quem '
  'chama e a edge function com service_role; a soma acontece no banco pra duas partes '
  'simultaneas nao sobrescreverem uma a outra.';

revoke all on function public.registra_uso_ia(jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
