-- ============================================================
-- FPMED — TABELA operacao_parametros (os parâmetros da operação, para o PISO)
-- Fatia B29, 20/08/2026. Módulo 1.3 da BASE_FUNCOES_PROFISSIONAIS ("calculadora de piso").
--
-- O QUE É: os três componentes que faltam para saber ABAIXO DE QUANTO NÃO SE PODE VENDER —
-- regime tributário com a alíquota efetiva, frete padrão, e custo fixo mensal com o volume
-- mensal para o rateio. O custo de compra já existe (`cotacoes.compra_unit`); estes três não
-- existiam em lugar nenhum deste banco, e é por isso que o piso nunca foi calculado.
--
-- >>> POR QUE NÃO SERVE A `custos_fixos` QUE JÁ EXISTE. MEDIDO em 20/08: ela tem 2 linhas, e as
--     duas são custo do SISTEMA — "Supabase — plano Pro" (US$ 25) e "Supabase — compute Micro"
--     (US$ 10). É o que a FPMED paga para o LIMEDTEC rodar, não o que a operação dela gasta para
--     existir (aluguel, folha, frota, licença sanitária). Ratear a conta do banco de dados no
--     preço da dipirona daria um número exato com o nome errado, e nome de dado que mente é pior
--     que dado que falta.
--
-- ── UMA LINHA POR COMPONENTE, E CADA COMPONENTE TEM A SUA VIGÊNCIA ──────────────────────────
-- A caixa pediu "cada campo com data de vigência", e o motivo é real: alíquota muda em janeiro,
-- frete muda quando troca a transportadora. Um snapshot único dos três obrigaria a redigitar o
-- frete que não mudou só para registrar a alíquota que mudou — e o que se redigita à mão é o que
-- entra errado.
-- >>> O QUE NÃO SE FAZ É DATA POR COLUNA. "custo fixo mensal" e "volume mensal" com vigências
--     diferentes montariam um rateio que nunca existiu: o custo de março dividido pelo volume de
--     agosto. O COMPONENTE é a menor unidade que faz sentido sozinha, e é ela que tem data.
--
-- ── O CHECK É A LEI DA FATIA ESCRITA NO BANCO ───────────────────────────────────────────────
-- "Enquanto faltar componente, a tela NÃO mostra piso." Uma tela pode esquecer de conferir; o
-- banco não. O `op_par_coerente` torna IMPOSSÍVEL gravar meio componente — regime sem alíquota,
-- rateio sem volume, frete sem tipo. Meio parâmetro não é meio piso: é um piso errado, e piso
-- errado é o que faz alguém dar lance abaixo do custo achando que tem folga.
--
-- >>> `volume_mensal > 0` E NÃO `>= 0`. Volume zero não é "operação parada", é uma divisão por
--     nada: o rateio sairia infinito e o piso junto. O banco recusa na entrada, que é o único
--     lugar onde recusar não custa uma decisão errada lá na frente.
-- >>> `aliquota_pct < 100` PELO MESMO MOTIVO. O piso é `custo ÷ (1 − alíquota)`; com 100% o
--     divisor é zero e acima dele é NEGATIVO — um piso negativo é um número absurdo com cara de
--     resultado calculado.
--
-- ── NADA SE APAGA ───────────────────────────────────────────────────────────────────────────
-- Trocar a alíquota é INSERIR uma linha nova com a vigência nova, nunca editar a antiga. Uma
-- proposta de junho tem de continuar explicável em dezembro, e ela só continua se a alíquota de
-- junho ainda estiver escrita em algum lugar. `ativo=false` é para o que entrou errado, e ele
-- guarda o registro de que entrou.
--
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.operacao_parametros (
  id                bigint generated always as identity primary key,
  empresa_id        bigint references public.empresas(id),

  componente        text not null check (componente in ('tributos','frete','rateio')),
  vigencia_inicio   date not null,

  -- componente 'tributos'
  regime            text    check (regime in ('simples','presumido','real')),
  aliquota_pct      numeric check (aliquota_pct >= 0 and aliquota_pct < 100),

  -- componente 'frete'  ('pct' = % sobre o custo de compra · 'valor' = R$ por unidade)
  frete_tipo        text    check (frete_tipo in ('pct','valor')),
  frete_valor       numeric check (frete_valor >= 0),

  -- componente 'rateio'
  custo_fixo_mensal numeric check (custo_fixo_mensal >= 0),
  volume_mensal     numeric check (volume_mensal > 0),

  observacao        text,
  ativo             boolean not null default true,

  criado_em         timestamptz not null default now(),
  criado_por        uuid,

  -- ── A COERÊNCIA POR COMPONENTE ────────────────────────────────────────────────────────────
  -- Cada linha preenche EXATAMENTE os campos do seu componente e deixa os outros nulos. Sem
  -- isto, uma linha 'frete' com alíquota preenchida seria lida por uma tela e ignorada por
  -- outra — e duas telas com respostas diferentes para "qual é a alíquota" é a família de
  -- defeito mais cara deste projeto.
  constraint op_par_coerente check (
       (componente = 'tributos'
          and regime is not null and aliquota_pct is not null
          and frete_tipo is null and frete_valor is null
          and custo_fixo_mensal is null and volume_mensal is null)
    or (componente = 'frete'
          and frete_tipo is not null and frete_valor is not null
          and regime is null and aliquota_pct is null
          and custo_fixo_mensal is null and volume_mensal is null)
    or (componente = 'rateio'
          and custo_fixo_mensal is not null and volume_mensal is not null
          and regime is null and aliquota_pct is null
          and frete_tipo is null and frete_valor is null)
  )
);

-- DUAS VIGÊNCIAS IGUAIS NO MESMO COMPONENTE seriam duas respostas para "o que valia em 12/06?", e
-- a escolha entre elas cairia na ordem em que o banco devolveu as linhas — que é sorteio, não
-- regra. O índice parcial deixa a linha desativada fora da disputa, que é o que ela deve ficar.
create unique index if not exists operacao_parametros_vigencia_idx
  on public.operacao_parametros (empresa_id, componente, vigencia_inicio)
  where ativo;

create index if not exists operacao_parametros_comp_idx
  on public.operacao_parametros (componente, vigencia_inicio desc) where ativo;

-- ── A VISÃO DO QUE VALE HOJE ────────────────────────────────────────────────────────────────
-- A conta de "qual linha vale agora" fica NO BANCO também, num lugar só — a mesma decisão da
-- `v_documentos_situacao`. A tela tem a dela (`FPMED_PISO.vigentes`, que precisa perguntar por
-- uma data QUALQUER, não só hoje, para explicar proposta velha), e esta serve o relatório e a
-- conferência. Quando as duas discordarem, é defeito, e há prova comparando as duas.
-- `security_invoker`: quem consulta usa as permissões dele; a view não vira porta lateral.
create or replace view public.v_operacao_parametros_vigentes
  with (security_invoker = on) as
select distinct on (p.empresa_id, p.componente)
       p.*
  from public.operacao_parametros p
 where p.ativo
   and p.vigencia_inicio <= current_date
 order by p.empresa_id, p.componente, p.vigencia_inicio desc;

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
-- LÊ quem está logado: o vendedor precisa do piso para montar a proposta, e um piso que só o
-- gestor enxerga é um piso que não protege ninguém na hora da disputa.
-- ESCREVE só gestor: alíquota efetiva e custo fixo são fato da contabilidade da empresa, e quem
-- responde por eles é quem responde pela empresa.
alter table public.operacao_parametros enable row level security;

drop policy if exists op_par_sel on public.operacao_parametros;
drop policy if exists op_par_ins on public.operacao_parametros;
drop policy if exists op_par_upd on public.operacao_parametros;
drop policy if exists op_par_del on public.operacao_parametros;

create policy op_par_sel on public.operacao_parametros for select to authenticated using (true);
create policy op_par_ins on public.operacao_parametros for insert to authenticated with check (public.cargo_gestor());
create policy op_par_upd on public.operacao_parametros for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
-- SEM policy de DELETE, e é decisão: parâmetro apagado é proposta velha que deixa de ter
-- explicação. O caminho de errar e consertar é `ativo=false` mais uma linha nova.

revoke all on public.operacao_parametros from anon;
grant select on public.operacao_parametros to authenticated;
grant insert, update on public.operacao_parametros to authenticated;
grant select on public.v_operacao_parametros_vigentes to authenticated;
revoke all on public.v_operacao_parametros_vigentes from anon;

notify pgrst, 'reload schema';
