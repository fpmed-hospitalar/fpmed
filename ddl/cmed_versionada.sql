-- ============================================================================================
-- FPMED — A CMED PASSA A GUARDAR TODAS AS EDIÇÕES (item 10, 13/08/2026)
--
-- Decisão do dono: "VERSIONAR POR EDIÇÃO — nada de apagar a tabela anterior. 21/07 fica, 11/08
-- entra por cima como vigente, com a v_cmed_vigencia/motor apontando sempre pra edição mais
-- nova. Migração aditiva, zero DELETE. Assim o teto de qualquer proposta antiga continua
-- auditável (calculado com a CMED de quando?)."
--
-- ══ O QUE PRENDIA O SISTEMA A UMA EDIÇÃO SÓ ═════════════════════════════════════════════════
-- Não era falta de coluna: `cmed_pf.publicada` e `cmed_precos.publicada_gov` SEMPRE existiram e
-- estão preenchidas em 100% das 25.702 linhas. Eram duas coisas, e só duas:
--   1. o loader APAGAVA a edição anterior depois de inserir a nova (carrega_cmed_pf.js);
--   2. a `cmed_precos` tem PRIMARY KEY em `ggrem` — a segunda edição do mesmo GGREM seria
--      recusada pelo banco antes mesmo de chegar ao delete.
--
-- ══ E O PERIGO QUE NINGUÉM VÊ ANTES DE ACONTECER ════════════════════════════════════════════
-- As views juntam `cmed_pf` e `cmed_precos` POR GGREM E SÓ. Com duas edições isso deixa de ser
-- junção 1:1 e vira PRODUTO CARTESIANO: 2 linhas de um lado × 2 do outro = 4 por GGREM. O teto
-- não ficaria "errado" de um jeito visível — a `cmed_teto` agrega com min()/max(), então a faixa
-- passaria a misturar edições, e `apresentacoes` contaria o dobro. Régua errada sem nada na tela
-- parecer errado é exatamente o que este projeto chama de defeito caro.
-- >>> POR ISSO A MIGRAÇÃO NÃO É "SÓ PARAR DE APAGAR". As três views passam a se PRENDER na
--     edição vigente, e é isso que faz o resto do sistema continuar vendo uma régua só.
--
-- ══ CONFERIDO ANTES DE ESCREVER (não suposto) ═══════════════════════════════════════════════
--   cmed_pf     PRIMARY KEY (id)      -> ggrem NÃO é único: versionar aqui é de graça
--   cmed_precos PRIMARY KEY (ggrem)   -> é este o bloqueio
--   FKs apontando pra qualquer uma das duas ......... NENHUMA
--   cmed_pf.publicada nulos ......................... 0 de 25.702
--   cmed_precos.publicada_gov nulos ................. 0 de 25.702
--   edições hoje .................................... 1 (2026-07-21) nas duas
--
-- ZERO DELETE, ZERO TRUNCATE, ZERO UPDATE de dado. A única mudança estrutural é a PK composta,
-- que não apaga linha nenhuma e é reversível.
-- Seguro re-rodar (if exists / or replace).
-- ============================================================================================

-- ── 1. A PK DA cmed_precos PASSA A INCLUIR A EDIÇÃO ─────────────────────────────────────────
-- Sem isto o INSERT da 2ª edição morre em "duplicate key". `publicada_gov` pode entrar na PK
-- porque tem zero nulos (medido acima) — PK não aceita coluna nula.
-- >>> Em UMA instrução: o drop e o add no mesmo ALTER. Em duas, existiria uma janela em que a
--     tabela não tem chave nenhuma, e é nessa janela que uma carga concorrente duplica tudo.
alter table public.cmed_precos
  drop constraint if exists cmed_precos_pkey,
  add constraint cmed_precos_pkey primary key (ggrem, publicada_gov);

-- Caminho quente novo: "as linhas da edição X". Sem ele, prender as views na edição vigente
-- viraria varredura da tabela inteira a cada consulta.
create index if not exists cmed_precos_edicao_idx on public.cmed_precos (publicada_gov);
create index if not exists cmed_pf_edicao_idx     on public.cmed_pf (publicada);

-- ── 2. QUAL É A EDIÇÃO VIGENTE — a resposta mora em UM lugar ────────────────────────────────
-- Cada view precisa saber "qual é a mais nova". Se cada uma decidir por conta própria, um dia
-- uma delas decide diferente — e o sistema passa a ter duas réguas ao mesmo tempo, sem aviso.
-- >>> AS DUAS LISTAS TÊM DATAS PRÓPRIAS, e isso não é detalhe: a lista do SITE (PF/PMC) e a do
--     GOVERNO (PF/PMVG) são publicações separadas da ANVISA e podem chegar em dias diferentes.
--     Então cada lado se prende na SUA edição mais nova, e não numa data comum que teria que
--     ser inventada.
create or replace view public.cmed_edicao_vigente
  with (security_invoker = on) as
select
  (select max(publicada)     from public.cmed_pf)     as pf_vigente,
  (select max(publicada_gov) from public.cmed_precos) as gov_vigente;

grant select on public.cmed_edicao_vigente to authenticated;

-- ── 3. A RÉGUA SE PRENDE NA EDIÇÃO VIGENTE ──────────────────────────────────────────────────
-- Mesma definição de antes, com UMA diferença: os dois lados filtrados pela edição vigente.
-- Quem consome a `cmed_regua` (o motor, o Conferidor, o Licitações) não muda nada e continua
-- vendo exatamente uma linha por GGREM.
create or replace view public.cmed_regua
  with (security_invoker = on) as
select
  p.ggrem, p.subst_norm, p.marca_norm, p.apresentacao, p.dose_key,
  coalesce(nullif(p.qtd_apres, 0), 1)                              as qtd_apres,
  p.laboratorio, p.tipo_produto, p.tarja, p.classe_terapeutica,
  p.ean1, p.registro, p.publicada,
  c.cnpj, c.regime_preco,
  c.pf_go19, c.pmc_go19, c.pmvg_go19, c.pf_0, c.pmc_0, c.pmvg_0,
  c.pf_aliq, c.pmc_aliq, c.pmvg_aliq,
  c.cap, c.confaz87, c.icms0, c.restricao_hosp,
  c.analise_recursal, c.lista_pis_cofins, c.destinacao,
  round(c.pf_go19   / coalesce(nullif(p.qtd_apres, 0), 1), 4)      as pf_unit,
  round(c.pmc_go19  / coalesce(nullif(p.qtd_apres, 0), 1), 4)      as pmc_unit,
  round(c.pmvg_go19 / coalesce(nullif(p.qtd_apres, 0), 1), 4)      as pmvg_unit,
  round(coalesce(case when c.cap then c.pmvg_go19 end, c.pf_go19)
        / coalesce(nullif(p.qtd_apres, 0), 1), 4)                  as teto_gov_unit,
  -- >>> `publicada_gov` ENTRA NO FIM, e nao no meio junto das outras colunas de `c`. Foi assim
  --     que a 1a tentativa MORREU: `create or replace view` nao deixa mudar a posicao das
  --     colunas que ja existem ("cannot change name of view column pf_unit to publicada_gov").
  --     Inserir no meio exigiria DROP CASCADE, que levaria a `cmed_teto` junto — trocar um DROP
  --     evitavel por conveniencia de ordem de coluna, num item cujo ponto e nao apagar nada.
  c.publicada_gov
from public.cmed_pf p
left join public.cmed_precos c
       on c.ggrem = p.ggrem
      and c.publicada_gov = (select gov_vigente from public.cmed_edicao_vigente)
where p.publicada = (select pf_vigente from public.cmed_edicao_vigente);

grant select on public.cmed_regua to authenticated;

-- ── 4. O TETO POR PA+DOSE, também preso na edição vigente ───────────────────────────────────
-- A `cmed_regua` acima já está presa, mas esta view junta a `cmed_pf` DE NOVO — e aquele lado
-- ficaria solto, trazendo as duas edições e dobrando `apresentacoes`.
create or replace view public.cmed_teto
  with (security_invoker = on) as
select
  p.subst_norm,
  p.dose_key,
  count(*)                    as apresentacoes,
  min(r.teto_gov_unit)        as teto_min,
  max(r.teto_gov_unit)        as teto_max,
  min(r.pmc_unit)             as pmc_min,
  bool_or(r.cap)              as tem_cap,
  bool_or(r.restricao_hosp)   as tem_restricao_hosp
from public.cmed_pf p
join public.cmed_regua r on r.ggrem = p.ggrem
where p.dose_key is not null
  and p.subst_norm is not null
  and r.teto_gov_unit is not null
  and p.publicada = (select pf_vigente from public.cmed_edicao_vigente)
group by p.subst_norm, p.dose_key;

grant select on public.cmed_teto to authenticated;

-- ── 5. A VIGÊNCIA: conta a edição VIGENTE, e diz quantas estão guardadas ────────────────────
-- >>> `edicoes` MUDOU DE SIGNIFICADO, e isso precisa estar escrito: antes ela contava
--     "quantas edições convivem", e conviver era SINTOMA DE CARGA PELA METADE — o
--     `atualiza_cmed.js` parava quando ela passava de 1. Agora conviver é o DESENHO, e o que
--     seria um alarme viraria uma parada em toda carga a partir da segunda.
--     Então: `apresentacoes` e `com_cap` passam a contar SÓ a vigente, e `edicoes` vira
--     informação de acervo, não alarme.
-- >>> O NOME `edicoes` FICOU, e não virou `edicoes_guardadas`: `create or replace view` não
--     renomeia coluna, e trocar por DROP só pra rebatizar seria pagar um DROP por uma palavra.
--     O nome é o de ontem; o que mudou é o significado, e é isso que este comentário existe
--     pra registrar — senão alguém lê `edicoes > 1` daqui a um mês e reinstala o alarme velho.
create or replace view public.v_cmed_vigencia
  with (security_invoker = on) as
select
  (select pf_vigente  from public.cmed_edicao_vigente)                    as publicada_site,
  (select gov_vigente from public.cmed_edicao_vigente)                    as publicada_gov,
  least((select pf_vigente from public.cmed_edicao_vigente),
        (select gov_vigente from public.cmed_edicao_vigente))             as vigente_desde,
  current_date - least((select pf_vigente from public.cmed_edicao_vigente),
                       (select gov_vigente from public.cmed_edicao_vigente)) as dias_desde,
  count(*) filter (where p.publicada_gov = (select gov_vigente from public.cmed_edicao_vigente))
                                                                          as apresentacoes,
  count(distinct p.publicada_gov)                                         as edicoes,
  count(*) filter (where p.cap
                     and p.publicada_gov = (select gov_vigente from public.cmed_edicao_vigente))
                                                                          as com_cap
from public.cmed_precos p;

grant select on public.v_cmed_vigencia to authenticated;

-- ── 6. O ACERVO, pra auditoria responder "a CMED de QUANDO?" ────────────────────────────────
-- É o ponto do item: uma proposta de julho conferida contra o teto de julho continua auditável
-- depois que agosto entrar. Sem esta view a informação existe mas ninguém acha.
create or replace view public.cmed_edicoes
  with (security_invoker = on) as
select
  p.publicada_gov                                     as edicao,
  count(*)                                            as apresentacoes,
  count(*) filter (where p.cap)                       as com_cap,
  min(p.created_at)                                   as carregada_em,
  p.publicada_gov = (select gov_vigente from public.cmed_edicao_vigente) as vigente
from public.cmed_precos p
group by p.publicada_gov
order by p.publicada_gov desc;

grant select on public.cmed_edicoes to authenticated;

notify pgrst, 'reload schema';
