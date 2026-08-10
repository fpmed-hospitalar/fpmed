-- ============================================================
-- FPMED — `leituras_edital`: o CONTADOR DE LEITURAS do leitor de edital com IA (10/08/2026)
--
-- POR QUE ESTA TABELA EXISTE: o leitor de edital e o unico recurso do sistema que custa dinheiro
-- por uso, e o Lemuel decidiu REPASSAR o custo. Repasse exige registro — e registro de
-- faturamento tem regras diferentes de dado operacional.
--
-- >>> QUEM GRAVA E O SERVIDOR, NAO A TELA. Nao ha policy de INSERT para `authenticated`: quem
--     escreve aqui e a edge function `ler-edital`, com a service_role, DEPOIS de a leitura ter
--     acontecido. Contador que o proprio pagante pode escrever nao e contador de cobranca — e
--     um campo de texto com nome bonito.
--
-- >>> SEM DELETE E SEM UPDATE, e isso e a regra e nao um esquecimento. Nao existe policy de
--     DELETE nem de UPDATE para ninguem. Leitura registrada e registro de faturamento: se der
--     pra apagar, a conta do mes vira opiniao. Se um dia precisar estornar uma leitura, o
--     caminho e uma linha de ESTORNO (valor negativo, com motivo), nunca apagar a original.
--
-- >>> QUEM VE O QUE: cada um ve as SUAS leituras; quem fecha a cobranca ve todas. Nao usei
--     `cargo_gestor()` de proposito — os tres usuarios da FPMED sao gestor_geral, entao
--     `cargo_gestor()` deixaria todo mundo ver o consumo de todo mundo. Numa conta que vai ser
--     cobrada, isso e informacao de terceiro.
--
-- >>> O CUSTO E GRAVADO EM DOLAR **E** EM REAL, com o CAMBIO DO DIA junto. Guardar so o real
--     faria a conta de amanha nao bater com a de hoje sem ninguem saber por que; guardar so o
--     dolar obrigaria a refazer cambio velho. Os tres campos juntos sao auditaveis.
--
-- ADITIVA: cria tabela nova. Zero DELETE, UPDATE ou DROP de dado existente. Seguro re-rodar.
-- ============================================================

create table if not exists public.leituras_edital (
  id              bigint generated always as identity primary key,
  usuario         uuid not null references auth.users(id),
  email           text not null,            -- copia no ato: quem leu, com o e-mail daquele dia
  quando          timestamptz not null default now(),

  edital_titulo   text,
  edital_url      text,
  edital_mb       numeric,

  -- 'texto' (extraido no navegador pelo pdf.js) | 'pdf-nativo' (a API converte pagina em imagem)
  modo            text not null check (modo in ('texto','pdf-nativo')),
  -- por que caiu no PDF nativo, quando caiu: 'extracao-pobre', 'sem-texto', null se foi direto
  modo_motivo     text,
  paginas         int,
  chars           int,

  modelo          text not null,
  tokens_entrada  int not null default 0,
  tokens_saida    int not null default 0,
  segundos        int,

  usd             numeric not null default 0,   -- custo real, tabela publica da Anthropic
  cambio          numeric,                      -- USD->BRL do momento; null = nao consegui buscar
  brl             numeric,                      -- usd * cambio; null quando nao houve cambio

  ok              boolean not null default true, -- false = a chamada falhou (fica registrado)
  erro            text
);

create index if not exists leituras_edital_usuario_idx on public.leituras_edital (usuario);
create index if not exists leituras_edital_quando_idx  on public.leituras_edital (quando desc);

-- ── QUEM FECHA A COBRANCA ──────────────────────────────────────────────────────────────────
-- Lista EXPLICITA, e nao um cargo: o cargo diz o que a pessoa faz no negocio, nao quem paga a
-- conta. Acrescentar alguem e uma linha aqui, e fica no historico do git quem foi acrescentado.
create or replace function public.pode_ver_todas_leituras()
returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() ->> 'email') in ('lemuelempresas7@outlook.com'),
    false)
$$;

alter table public.leituras_edital enable row level security;

drop policy if exists leit_sel on public.leituras_edital;
-- SELECT: as minhas, sempre; todas, so quem fecha a cobranca.
create policy leit_sel on public.leituras_edital for select to authenticated
  using (usuario = auth.uid() or public.pode_ver_todas_leituras());

-- NAO HA policy de INSERT/UPDATE/DELETE, de proposito (ver o cabecalho).
revoke all on public.leituras_edital from anon;
grant select on public.leituras_edital to authenticated;

comment on table public.leituras_edital is
  'Registro de faturamento das leituras de edital com IA. Gravado pela edge function ler-edital '
  '(service_role), nunca pela tela. Sem DELETE e sem UPDATE: estorno e linha nova, nao apagar.';

notify pgrst, 'reload schema';
