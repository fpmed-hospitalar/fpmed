-- ============================================================
-- FPMED — COLUNA estoque_em (quando aquele saldo foi visto pela última vez)
-- Bloco 2 do sync de código, 05/08/2026.
--
-- O QUE RESOLVE: hoje a tela mostra "1.381 no estoque FPMED" e o operador não tem como saber
-- se aquele saldo é de ontem ou de julho. O último relatório entrou em 04/08 — mas isso está
-- registrado no CONTINUAR_AQUI, não no sistema. Quem abre a tela vê um número sem idade.
--
-- POR QUE ISSO É CARO e não cosmético: saldo velho é pior que saldo ausente. Com "sem estoque"
-- o vendedor vai atrás do fornecedor; com "12 un" de três semanas atrás ele PROMETE ao cliente
-- e descobre na separação que não tem. O número velho não parece velho.
--
-- ADITIVA e NULLABLE de propósito: as 1.381 linhas que já existem ficam com NULL, que é a
-- verdade — ninguém sabe quando aquele saldo foi conferido. Preencher com a data de hoje seria
-- inventar uma frescura que o dado não tem, e é justamente a mentira que a coluna existe pra
-- evitar. A tela trata NULL como "idade desconhecida", não como "hoje".
--
-- Quem passa a gravar: a tela Atualizar Estoque, a cada import (é ela que sabe a data do
-- relatório). Nenhum backfill — ver acima.
-- Seguro re-rodar.
-- ============================================================

alter table public.cotacoes add column if not exists estoque_em date;

comment on column public.cotacoes.estoque_em is
  'Data em que este saldo foi visto no relatório de estoque. NULL = idade desconhecida (linha anterior a 05/08/2026). Nunca preencher com a data de hoje em backfill: inventaria frescura.';

-- Caminho de consulta: "o que está velho?" — parcial, porque só interessa quem TEM data.
create index if not exists cotacoes_estoque_em_idx on public.cotacoes (estoque_em) where estoque_em is not null;

notify pgrst, 'reload schema';
