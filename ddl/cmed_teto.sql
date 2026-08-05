-- ============================================================
-- FPMED — VIEW cmed_teto: o teto legal AGREGADO por princípio ativo + dose
-- Item 1B, integração com o módulo Licitações (05/08/2026).
--
-- POR QUE AGREGAR: a `cmed_regua` tem 25.702 apresentações. A tela de Licitações precisa,
-- para cada produto NOSSO que casou com um item do edital, de uma pergunta só: "qual é o
-- teto legal por unidade deste princípio ativo nesta dose?". Baixar 25.702 linhas pro
-- browser pra responder isso seria 26 páginas de PostgREST a cada abertura de tela.
-- Agregado dá 4.875 linhas — 5 páginas, carregadas uma vez e guardadas em memória.
--
-- O QUE ENTREGA, e por que MIN e MAX e não um número só:
--   o teto é da APRESENTAÇÃO, não do princípio ativo. "DIPIRONA 500MG" tem dezenas de
--   apresentações, cada uma com seu PF. Um número único seria uma invenção. Então a view
--   entrega a FAIXA e a contagem, e a tela usa o MENOR — o conservador: se o nosso preço
--   passa do menor teto da família, é sinal de conferir a apresentação exata antes de
--   propor. Dizer "está dentro" usando o maior teto seria o erro caro.
--
-- teto = a regra da própria CMED: com CAP o teto é o PMVG, sem CAP é o PF. Sempre UNITÁRIO
-- (dividido por qtd_apres) — a régua com que o resto do sistema compara.
--
-- Seguro re-rodar. security_invoker: quem consulta usa as permissões dele.
-- ============================================================

create or replace view public.cmed_teto
  with (security_invoker = on) as
select
  p.subst_norm,
  p.dose_key,
  count(*)                                                     as apresentacoes,
  min(r.teto_gov_unit)                                         as teto_min,
  max(r.teto_gov_unit)                                         as teto_max,
  min(r.pmc_unit)                                              as pmc_min,
  bool_or(r.cap)                                               as tem_cap,
  bool_or(r.restricao_hosp)                                    as tem_restricao_hosp
from public.cmed_pf p
join public.cmed_regua r on r.ggrem = p.ggrem
where p.dose_key is not null and p.subst_norm is not null
  and r.teto_gov_unit is not null
group by p.subst_norm, p.dose_key;

grant select on public.cmed_teto to authenticated;

notify pgrst, 'reload schema';
