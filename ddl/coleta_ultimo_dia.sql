-- ============================================================
-- FPMED — `coleta_status.ultimo_dia_ok` (10/08/2026)
--
-- POR QUE ESTA COLUNA EXISTE, se `ultima_ok` já existe: elas respondem perguntas diferentes.
--   ultima_ok      -> "a última RODADA terminou inteira, sem falha?"     (fato sobre a EXECUÇÃO)
--   ultimo_dia_ok  -> "até que DIA o índice está completo?"              (fato sobre o DADO)
--
-- MEDIDO em 10/08, com o coletor enchendo o índice pela primeira vez: três rodadas gravaram 190,
-- 213 e 272 linhas — e NENHUMA fechou a janela, porque a janela não cabe no orçamento de 100 s da
-- edge function. Resultado: `ultima_ok` seguia NULL e a tela dizia "a última coleta falhou"
-- enquanto o índice ia de 70 para 651 licitações. Erro pro lado seguro, mas erro — e um aviso que
-- está sempre aceso é um aviso que ninguém lê no dia em que a coleta falhar de verdade.
--
-- >>> `date` e não `timestamptz` de propósito: a pergunta é sobre o dia de PUBLICAÇÃO do edital,
--     que é uma data no calendário do órgão, não um instante. Guardar hora convidaria a comparar
--     com `now()` e a inventar fuso onde não há.
--
-- ADITIVA: só acrescenta coluna. Zero DELETE, zero UPDATE, zero DROP. Seguro re-rodar.
-- ============================================================

alter table public.coleta_status
  add column if not exists ultimo_dia_ok date;

-- ── O PROGRESSO DA VOLTA ────────────────────────────────────────────────────────────────────
-- MEDIDO em 10/08, sondando o PNCP direto a uma requisição por 700 ms: as 7 primeiras deram 200
-- e da 8ª em diante vieram 14 × HTTP 429 seguidos. A cota dele é DURA — e um dia inteiro são 21
-- combinações (7 UFs × 3 modalidades). Nenhuma rodada de 100 s cobre isso.
-- Sem memória, toda rodada recomeçava em GO e morria antes de MT/MS/TO/BA. O banco provava:
-- 689 licitações, TODAS de GO, DF e MG — as outras quatro UFs nunca foram coletadas uma vez.
-- Agora cada rodada continua de onde a anterior parou; quando a volta fecha, `ultimo_dia_ok`
-- avança e `ufs_feitas` ZERA, pra próxima varrer o dia de novo e pegar o que saiu depois.
alter table public.coleta_status
  add column if not exists dia_em_curso date,
  add column if not exists ufs_feitas   text[] not null default '{}';

comment on column public.coleta_status.dia_em_curso is
  'Dia cuja varredura esta em andamento. Quando o dia mais novo muda, o progresso zera.';
comment on column public.coleta_status.ufs_feitas is
  'UFs ja varridas (as 3 modalidades) no dia_em_curso, somando rodadas. Zera quando a volta fecha.';

comment on column public.coleta_status.ultimo_dia_ok is
  'Dia de publicacao mais NOVO que ja foi coletado por inteiro (todas as UFs e modalidades, sem '
  'bater no teto de paginas). So anda pra frente: rodada que alcancou apenas dias velhos nao '
  'regride o carimbo, porque o dia novo continua coberto.';

notify pgrst, 'reload schema';
