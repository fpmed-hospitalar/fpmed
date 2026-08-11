-- ============================================================
-- FPMED — `lembretes.tipo`: tarefa personalizada e lembrete na MESMA tabela (11/08/2026)
--
-- O pedido foi "tarefas personalizadas com alerta: texto livre + data/hora + prioridade, e a que
-- tem data entra no sino". Isso e, campo a campo, o que a `lembretes` ja e — titulo, `quando`,
-- prioridade, `feito`, RLS de gestor, e ja lida pelo sino.
--
-- >>> POR QUE NAO UMA TABELA NOVA: seriam duas tabelas com as mesmas colunas, dois caminhos ate
--     o sino e dois lugares pra corrigir quando a regra do alerta mudar. A diferenca entre uma
--     "tarefa" e um "lembrete" aqui e de QUAL ABA a pessoa criou — e diferenca de aba se resolve
--     com uma coluna, nao com um esquema paralelo.
--
-- >>> E POR QUE ENTAO SEPARAR: porque as duas abas respondem perguntas diferentes sobre o mesmo
--     negocio (a regra das 4 abas, registrada em 08/08). Sem `tipo`, a aba Tarefas e a aba
--     Lembretes mostrariam as mesmas linhas e as duas perderiam o sentido.
--
-- O DEFAULT E 'lembrete': tudo que ja esta gravado foi criado na aba Lembretes.
--
-- ADITIVA: uma coluna com default. Zero DELETE/UPDATE/DROP. Seguro re-rodar.
-- ============================================================

alter table public.lembretes
  add column if not exists tipo text not null default 'lembrete'
    check (tipo in ('lembrete','tarefa'));

comment on column public.lembretes.tipo is
  'De qual aba da ficha a linha nasceu: `lembrete` (aba Lembretes) ou `tarefa` (aba Tarefas). '
  'As duas vivem aqui porque tem exatamente os mesmos campos e o mesmo caminho ate o sino; '
  'tabela separada seria duas verdades sobre "coisa com data e prioridade".';

notify pgrst, 'reload schema';
