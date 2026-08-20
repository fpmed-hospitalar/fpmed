-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- resultado_perguntado.sql — "NÃO PERGUNTEI" NÃO É "NÃO EXISTE" (fatia A40, 20/08/2026)
--
-- ══ O QUE ESTAVA FALTANDO, E ELE É UMA ESTEIRA ══════════════════════════════════════════════
-- `resultado_lido_em` só é escrito quando HÁ resultado. Quem lê a tabela consegue distinguir
-- "tem resultado" de "não tem resultado" — e NÃO consegue distinguir, dentro do "não tem":
--     · o item que eu NUNCA perguntei ao PNCP;
--     · o item que eu PERGUNTEI e o PNCP respondeu "ainda não foi julgado" (204/lista vazia).
--
-- >>> E ESSA CONFUSÃO É UMA ESTEIRA, NÃO UM DETALHE. Medido em 20/08: são 39.976 itens de
--     licitações já encerradas sem resultado lido, e a medição de carência mostra que a maioria
--     volta vazia. Sem esta coluna, TODOS eles voltam para a fila em TODA rodada, para sempre —
--     a ferramenta perguntaria a mesma coisa ao mesmo serviço público, todo dia, e a fila nunca
--     encolheria. Um teto que nunca alcança a chegada é dívida perpétua disfarçada de sucesso, e
--     esta seria a mesma coisa com outra roupa: uma fila que nunca esvazia porque ela se
--     reenche sozinha com as respostas que já obteve.
--
-- >>> É A LEI DA A19 NO ESQUEMA. Lá: *"não consegui perguntar" NUNCA vira "não existe"*. Aqui:
--     "não perguntei" também não vira "não existe" — e as três respostas passam a ter cada uma
--     o seu lugar:
--         resultado_lido_em IS NOT NULL ........ tem resultado, e foi lido nesta data
--         resultado_perguntado_em IS NOT NULL ... perguntei; se o lido_em é nulo, não havia
--         os dois nulos ......................... nunca perguntei
--
-- ══ ADITIVO, E SÓ ═══════════════════════════════════════════════════════════════════════════
-- Uma coluna nova, `NULL` para todas as linhas existentes — nenhuma linha é reescrita, nenhum
-- dado sai. `IF NOT EXISTS` para poder rodar duas vezes sem estrago.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

alter table public.licitacao_itens
  add column if not exists resultado_perguntado_em timestamptz;

comment on column public.licitacao_itens.resultado_perguntado_em is
  'Quando o PNCP foi perguntado sobre o resultado deste item, TENHA ELE RESPONDIDO OU NÃO. '
  '`resultado_lido_em` diz "tem resultado"; esta coluna diz "já perguntei". Sem as duas, o item '
  'sem resultado volta para a fila em toda rodada e a fila nunca esvazia (fatia A40).';

-- ══ E O MESMO CARIMBO NA LICITAÇÃO, PELA MESMA RAZÃO UM ANDAR ACIMA ═════════════════════════
-- A `licitacoes` já tem `itens_lidos_em`, que é o que faz a coleta de itens não reler a mesma
-- licitação todo dia. O resultado precisa do irmão dele: sem um carimbo por LICITAÇÃO, o coletor
-- teria de perguntar a cada uma "sobrou item pendente aqui?" — uma requisição ao nosso banco por
-- licitação, em 1.817 licitações, só para descobrir que não há nada a fazer em quase todas.
-- >>> É EXATAMENTE O DESENHO QUE JÁ EXISTE E JÁ FOI PAGO: o carimbo mora em quem se percorre.
alter table public.licitacoes
  add column if not exists resultado_perguntado_em timestamptz;

comment on column public.licitacoes.resultado_perguntado_em is
  'Quando o resultado dos itens desta licitação foi perguntado ao PNCP. Irmão do `itens_lidos_em`: '
  'sem ele, a coleta de resultado varre as mesmas licitações em toda rodada (fatia A40). Fica NULO '
  'quando a leitura foi truncada pelo teto — assim ela volta na próxima rodada.';

create index if not exists licitacoes_resultado_pendente
  on public.licitacoes (data_encerramento desc)
  where resultado_perguntado_em is null and itens_lidos_em is not null;

-- O ÍNDICE É A FILA DA FATIA: "itens de licitação encerrada que eu ainda não perguntei".
-- Parcial de propósito — indexar as 358.710 linhas para responder sobre um punhado seria pagar
-- escrita em toda coleta de item para acelerar uma consulta que só o coletor de resultado faz.
create index if not exists licitacao_itens_resultado_pendente
  on public.licitacao_itens (licitacao_id)
  where resultado_perguntado_em is null and resultado_valor_unit is null;
