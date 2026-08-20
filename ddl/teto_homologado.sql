-- ============================================================
-- FPMED — O ORÁCULO DA MEDIANA (fatia B28, 20/08/2026)
--
-- ══ POR QUE UMA FUNÇÃO NO BANCO SÓ PARA ISTO ════════════════════════════════════════════════
-- O `fpmed_teto_homologado.js` calcula a mediana dos preços já homologados, e é ela que decide o
-- "teto competitivo" que a tela mostra. Medido em 20/08: os 192 resultados que existem hoje dão
-- **192 chaves distintas** — nenhum produto se repete. Ou seja, o caminho da faixa e da mediana
-- **não roda com o dado de hoje**, e provar a mediana com uma lista que eu mesmo escrevesse seria
-- repetir o detector cego da B26: eu escreveria a fixture e a função com a mesma cabeça, no mesmo
-- minuto, e as duas concordariam mesmo erradas.
--
-- >>> ENTÃO O ORÁCULO É O POSTGRES. Esta função responde a mediana dos MESMOS valores reais pelo
--     `percentile_cont(0.5)`, que é a definição da mediana escrita por outra gente, em outra
--     linguagem, com outra implementação. Se o motor da tela discordar dela, um dos dois está
--     errado — e não é o Postgres. É a única forma honesta de provar aritmética que o dado de
--     produção ainda não exercita.
--
-- >>> `percentile_cont` E NÃO `percentile_disc`, de propósito: com lista PAR, `_cont` interpola os
--     dois do meio (a média deles) e `_disc` escolhe um. A definição de mediana é a primeira, e é
--     a que o motor implementa. Escolher `_disc` aqui faria o oráculo discordar do motor por uma
--     diferença que não é defeito de nenhum dos dois — e um vermelho que não é defeito ensina a
--     ignorar vermelho.
--
-- SÓ LEITURA, e `stable`: ela não escreve nada e não é `security definer`, então quem consulta usa
-- as permissões dele. Uma função de leitura com `security definer` seria uma porta lateral por
-- cima da RLS aberta em nome de um teste — exatamente o oposto do que ela existe para provar.
--
-- Seguro re-rodar.
-- ============================================================

create or replace function public.mediana_resultado_homologado()
  returns table (mediana numeric, minimo numeric, maximo numeric, n bigint)
  language sql
  stable
as $$
  -- `> 0` e não `is not null`: zero não é preço homologado, é a mesma lição do
  -- `valor_unitario_ref` (7.456 itens com zero escritos como se fossem preço). O motor da tela
  -- descarta zero pelo mesmo critério — se os dois não descartassem o mesmo conjunto, a
  -- comparação não estaria comparando nada.
  select percentile_cont(0.5) within group (order by resultado_valor_unit)::numeric,
         min(resultado_valor_unit)::numeric,
         max(resultado_valor_unit)::numeric,
         count(*)
    from public.licitacao_itens
   where resultado_valor_unit > 0;
$$;

revoke all on function public.mediana_resultado_homologado() from anon;
grant execute on function public.mediana_resultado_homologado() to authenticated;

notify pgrst, 'reload schema';
