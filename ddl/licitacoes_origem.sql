-- ============================================================================================
-- FPMED — DE ONDE ESTA LINHA DO ÍNDICE VEIO   (fatia A21, 14/08/2026)
--
-- ══ 100% ADITIVO ═══════════════════════════════════════════════════════════════════════════
-- Um `add column if not exists`. Zero DROP, zero DELETE, zero ALTER destrutivo, e a coluna
-- nasce NULA — nenhuma linha existente muda de valor.
--
-- ══ POR QUE ELA PRECISA EXISTIR ════════════════════════════════════════════════════════════
-- O painel "ao vivo · PNCP" mostra certame que NÃO está no nosso índice, e a caixa manda gravá-lo
-- no índice antes de qualquer ação — para que um negócio criado a partir dele nunca nasça sem
-- vínculo (a lição do `numero_controle`, que a fatia A9 pagou pra aprender em 2.561 linhas).
--
-- >>> POR QUE NÃO USAR A COLUNA `portal`, QUE JÁ EXISTE: ela faz parte da CHAVE NATURAL
--     (portal, cnpj, ano, sequencial), que é por onde o coletor faz UPSERT. Escrever
--     'PNCP · ao vivo' ali criaria uma chave DIFERENTE da que a varredura normal usa — e no dia
--     em que o coletor passasse pelo mesmo certame, ele nasceria uma SEGUNDA vez no índice, com
--     os mesmos dados e outro id. Duplicata silenciosa é pior que coluna nova.
--     A `portal` continua sendo 'PNCP' porque a FONTE é o PNCP; o que muda é a PORTA por onde
--     esta linha entrou, e é isso que a coluna nova diz.
--
-- >>> E ELA IMPORTA PRA LEITURA, não só pro histórico: a resposta da API de BUSCA não traz janela
--     de proposta nem valor estimado (medido campo a campo em 14/08). Uma linha que entrou por
--     ali sabe menos que uma que entrou pela varredura — e a tela precisa poder DIZER isso, em
--     vez de deixar "abertura não informada" parecer defeito nosso.
--
-- Valores em uso: 'busca_ao_vivo' (a tela, pela edge `indexar-licitacao`).
-- NULL = entrou pela varredura normal, que é o caso de todas as linhas anteriores a esta fatia.
--
-- Seguro re-rodar.
-- ============================================================================================

alter table public.licitacoes
  add column if not exists origem_registro text;

comment on column public.licitacoes.origem_registro is
  'Porta por onde a linha entrou no índice. NULL = varredura normal (coleta_pncp / '
  'coletar-licitacoes). ''busca_ao_vivo'' = gravada pela edge indexar-licitacao quando alguém '
  'agiu sobre um certame do painel ao vivo. NÃO faz parte da chave natural, de propósito.';

-- Índice parcial: as linhas de origem declarada são a minoria e é por elas que se pergunta
-- ("o que entrou pela busca?"). Um índice na coluna inteira gastaria espaço com o NULL, que é
-- justamente o caso que ninguém consulta.
create index if not exists licitacoes_origem_idx
  on public.licitacoes (origem_registro) where origem_registro is not null;

notify pgrst, 'reload schema';
