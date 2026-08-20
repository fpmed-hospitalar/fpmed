-- ============================================================================================
-- FPMED — A BUSCA DA TELA "ENCONTRAR" PASSA A FILTRAR NO BANCO
-- Fatia A34, 19/08/2026. 100% ADITIVO (uma função, uma coluna gerada, dois índices, uma RPC,
-- uma coluna em coleta_status). Zero DELETE, zero DROP de tabela, zero UPDATE de acervo.
--
-- ══ O NÚMERO QUE MANDOU FAZER ISTO ══════════════════════════════════════════════════════════
-- O dono escreveu: *"sobre o PNCP a busca tá muito ruim ainda, não tá profissional"* e *"talvez
-- pra não ficar travando"*. Medido em 19/08 com `tools/mede_encontrar.js`, antes de qualquer
-- conserto:
--
--     o que a tela BAIXA antes de filtrar uma única palavra
--       janela de 30 dias .....  18.946 KB   2.761 ms   9.663 linhas em 10 páginas
--       índice INTEIRO ........  23.281 KB   2.686 ms  11.843 linhas em 12 páginas
--
-- >>> DEZOITO MEGABYTES PARA RESPONDER "dipirona". A tela pede `select=bruto` — a resposta
--     inteira do PNCP, ~2 KB por linha — de TODAS as licitações do período, e só então filtra a
--     palavra em JavaScript. O "travando" do dono não é impressão: é o navegador baixando,
--     parseando e guardando 18 MB de JSON para mostrar três cartões.
-- >>> E QUANDO A JANELA VEM VAZIA E HÁ TERMO DIGITADO, ela ainda pede o índice INTEIRO: mais
--     23 MB. Era o caminho mais comum, porque a janela padrão é o último dia útil.
--
-- Medido no mesmo minuto, do outro lado: contar as que casam com "dipirona" custa 72 ms e
-- ZERO KB de acervo. O banco sabe responder. Faltava perguntar a ele.
--
-- ══ POR QUE `ilike` SOBRE COLUNA SEM ACENTO, E NÃO O tsvector QUE JÁ EXISTE ══════════════════
-- O tsvector (`licitacoes.busca`, fatia A8) casa por RADICAL: "medicamentos" acha "medicamento".
-- É ótimo, e continua existindo — mas ele NÃO é a regra que esta tela usa hoje. A tela usa
-- `semAcento(objeto).includes(termo)`, que é SUBSTRING: o campo nasce com "farmac" justamente
-- para pegar "farmacêutico" e "farmácia", e nenhum stemmer faz isso.
-- >>> TROCAR A REGRA DE CASAMENTO JUNTO COM O LUGAR ONDE ELA RODA SERIA DUAS MUDANÇAS NUMA, e a
--     que some com resultado é invisível: ninguém reclama do que não apareceu. Então aqui a
--     regra é a MESMA, letra por letra — só muda quem a executa. O tsvector segue servindo a
--     `buscar_licitacoes`, o boletim e os jornais.
--
-- ══ POR QUE COLUNA GERADA, E NÃO `unaccent(objeto) ilike ...` NA CONSULTA ════════════════════
-- Porque função na coluna do WHERE não usa índice: seria varredura completa das 11.843 linhas a
-- cada tecla. Coluna gerada + índice trigram é o que faz o `ilike '%dipirona%'` custar 72 ms.
-- E gerada, não preenchida por gatilho: coluna que alguém precisa lembrar de atualizar é coluna
-- que um dia fica velha — e busca sobre texto velho não acha o que chegou ontem, sem nenhum
-- sintoma além de "não achei".
-- ============================================================================================

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ── 1. O `semAcento` DO NAVEGADOR, DO LADO DE CÁ ────────────────────────────────────────────
-- O `unaccent(text)` de um argumento é STABLE (depende do dicionário carregado), e o Postgres
-- recusa STABLE em coluna gerada — com razão. A forma de DOIS argumentos, com o dicionário
-- nomeado, é IMMUTABLE, e é ela que se usa aqui.
-- >>> O ESPELHO É PROPOSITAL: o JS faz `NFD → tira combinantes → toLowerCase`. Este faz
--     `unaccent → lower`. As duas descem "FARMACÊUTICO" para "farmaceutico". Se um dia
--     divergirem, o teste `testa_busca_local` fica vermelho — porque ele compara os dois lados
--     sobre o índice de verdade, e não sobre um exemplo escolhido a dedo.
create or replace function public.sem_acento(t text)
  returns text language sql immutable strict parallel safe as
$$ select lower(public.unaccent('public.unaccent', t)) $$;

-- ── 2. A COLUNA QUE A BUSCA OLHA ────────────────────────────────────────────────────────────
-- SÓ O OBJETO, e isso é medida e não economia: a tela filtra `semAcento(l.objetoCompra)` e mais
-- nada (linha do `casa()` no render). Pôr órgão e município aqui faria o banco devolver linhas
-- que o JavaScript jogaria fora em seguida — e o KPI "N publicadas no período" passaria a contar
-- gente que não entra na lista. Órgão tem filtro próprio, no refino.
alter table public.licitacoes
  add column if not exists texto_busca text
  generated always as (public.sem_acento(coalesce(objeto, ''))) stored;

create index if not exists licitacoes_texto_busca_trgm
  on public.licitacoes using gin (texto_busca gin_trgm_ops);

-- ── 3. OS ITENS, AGREGADOS NO BANCO — É AQUI QUE O TETO DE 400 MORRE ────────────────────────
-- Hoje a tela pede `licitacao_itens` com `Range: 0-399` e monta o mapa `numero_controle -> n` em
-- JavaScript. Medido em 19/08: "seringa" tem 2.585 itens e a tela lia 400; "dipirona" tem 556 e
-- lia 400. Ou seja, a busca por produto respondia sobre 15% dos itens que casaram — e o número
-- na tela ("2.585") era do `content-range`, então ela dizia a verdade sobre o total e mentia
-- sobre o conjunto.
-- >>> O TETO EXISTIA PORQUE A AGREGAÇÃO ERA NO NAVEGADOR. Feita aqui, a resposta tem UMA LINHA
--     POR LICITAÇÃO em vez de uma por item: "seringa" sai de 2.585 linhas para as poucas
--     centenas de licitações que as contêm. O teto deixa de ser necessário em vez de ser
--     aumentado — aumentar teto é adiar o mesmo defeito para uma base maior.
-- >>> A AMOSTRA VEM JUNTO porque é ela que o cartão mostra: "casou em ALBUMINA HUMANA 20%" prova
--     a quem lê que o casamento foi real e não acaso de radical. `min(descricao)` e não a
--     "primeira": primeira exige ordem, e ordem exige critério que ninguém pediu.
create or replace function public.itens_por_licitacao(p_termo text)
returns table (numero_controle text, itens_casados bigint, amostra text)
language sql stable as $$
  select i.numero_controle,
         count(*) as itens_casados,
         min(i.descricao) as amostra
    from public.licitacao_itens i
   where coalesce(btrim(p_termo), '') <> ''
     and i.busca @@ websearch_to_tsquery('public.pt_sem_acento',
                      public.sem_acento(btrim(p_termo)))
     and i.numero_controle is not null
   group by i.numero_controle;
$$;

grant execute on function public.itens_por_licitacao(text) to authenticated;
revoke execute on function public.itens_por_licitacao(text) from anon;

-- ── 4. O CARIMBO DA CARGA DIÁRIA ────────────────────────────────────────────────────────────
-- A `coleta_status` tem colunas para a coleta de licitações e nada para a RODADA INTEIRA
-- (licitações + itens + prazos). Acrescentar cinco colunas fixas seria adivinhar hoje o formato
-- de amanhã; um `jsonb` guarda o carimbo do condutor e cresce sem migração.
-- >>> A LINHA DELE É `fonte = 'CARGA'`, ao lado da 'PNCP'. Duas fontes, dois carimbos, nenhuma
--     disputa: o selo da base continua lendo 'PNCP' e a faixa de frescor lê 'CARGA'.
alter table public.coleta_status
  add column if not exists detalhe jsonb;

comment on column public.coleta_status.detalhe is
  'Carimbo livre da rodada (tools/carga_diaria.js): inicio, fim, etapas, quantas entraram, '
  'quantas ficaram e por que. jsonb para nao exigir migracao a cada numero novo.';

notify pgrst, 'reload schema';
