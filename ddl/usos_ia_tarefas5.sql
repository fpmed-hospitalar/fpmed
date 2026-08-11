-- ============================================================================================
-- ddl/usos_ia_tarefas5.sql — 11/08/2026 · as CINCO tarefas de IA no contador.
--
-- ══ ISTO NASCE DE UM DEFEITO MEDIDO, E VALE REGISTRAR COMO ═════════════════════════════════
-- Hoje de manha a coluna `tarefa` nasceu com `check (tarefa in ('resumo','itens'))`. A tarde, a
-- leitura em partes acrescentou a `juntar` (a passada final do resumo) — e ninguem lembrou do
-- check. O que aconteceu foi o pior desfecho possivel para um contador de cobranca:
--   · a chamada a IA ACONTECEU e consumiu token;
--   · o `registra_uso_ia` levantou erro de check constraint;
--   · e o `catch {}` da edge function — escrito com boa intencao, pra "o registro falhar nao
--     engolir a leitura que a pessoa ja pagou" — engoliu o erro em SILENCIO.
-- Resultado: custo consumido e NAO cobrado. Provado: `select tarefa, count(*)` nao tinha nenhuma
-- linha 'juntar', mesmo depois de duas provas que rodaram a juncao.
--
-- >>> A LICAO NAO E "lembrar do check". E que um contador de faturamento nao pode falhar calado.
--     Junto com este DDL, a funcao passou a DEVOLVER `registrado: false` quando o registro nao
--     entra, e a tela passou a dizer isso na cara.
--
-- ADITIVO: troca o CHECK por um mais largo. Nao apaga linha nenhuma — as 7 que existem sao
-- 'resumo' e 'itens', que continuam validas. Roda 2x.
-- ============================================================================================

-- Derrubar e recriar um CHECK nao e apagar dado: e trocar a regra que valida o dado. As linhas
-- ficam onde estao, e a regra nova aceita tudo que a antiga aceitava.
alter table public.usos_ia drop constraint if exists usos_ia_tarefa_check;
alter table public.usos_ia add constraint usos_ia_tarefa_check
  check (tarefa in ('resumo','itens','juntar','itens-ganhos','mapa-precos'));

comment on column public.usos_ia.tarefa is
  'O que se pediu a IA. resumo = os dados do edital · itens = a tabela do anexo · juntar = a '
  'passada final que junta os resumos parciais de uma leitura em partes · itens-ganhos = o que '
  'a empresa ganhou, lido do resultado · mapa-precos = o mapa da disputa item a item. '
  'Cada uma tem preco e risco diferentes, entao precisam ser separaveis na conta do mes.';

notify pgrst, 'reload schema';
