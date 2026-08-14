-- ============================================================================================
-- ddl/anexos_habilitacao_recurso.sql — 14/08/2026 · fatia B15 ("Meus arquivos" do negocio).
--
-- ══ AS TRES CATEGORIAS QUE FALTAVAM PRA LISTA QUE O DONO NOMEOU ═════════════════════════════
-- O pedido antigo dele (pilha do SigaPregao) nomeia SEIS gavetas:
--   edital e anexos · proposta · habilitacao · ata · recurso · outros
-- Nove categorias ja existiam e cobrem quatro delas. Faltavam `habilitacao`, `recurso` e
-- `outro` — e sem elas duas gavetas do pedido seriam gavetas que ninguem pode encher: a tela
-- mostraria o titulo e nao teria como aceitar um arquivo ali.
--
-- ══ POR QUE NAO ENFIAR TUDO EM `outro` ══════════════════════════════════════════════════════
-- Porque a categoria e o que faz o agrupamento existir, e o agrupamento e o pedido. Recurso
-- guardado como "outro" some no meio de sete arquivos soltos justamente no dia em que ele
-- importa — o do prazo do recurso, que corre em 3 dias uteis.
--
-- ══ POR QUE `outro` MESMO ASSIM ═════════════════════════════════════════════════════════════
-- Porque o mundo tem documento que nao e nenhum dos cinco (declaracao avulsa, oficio, print de
-- chat do pregoeiro). Sem uma gaveta pra ele, a pessoa o classifica errado de proposito — e ai
-- a categoria passa a mentir sobre TODOS os arquivos, nao so sobre aquele.
--
-- ══ SOBRE DERRUBAR O CHECK ══════════════════════════════════════════════════════════════════
-- Trocar um CHECK nao e apagar dado: e trocar a regra que valida o dado. As linhas ficam onde
-- estao, e a regra nova aceita tudo que a antiga aceitava — mais tres. Mesmo caminho do
-- ddl/anexos_edital.sql (11/08), e pelo mesmo motivo.
--
-- NADA MAIS MUDA. A trigger de versao, as policies (sem update, sem delete) e o bucket
-- continuam iguais: "Meus arquivos" e uma VISAO nova sobre o que ja existe, e nao um segundo
-- lugar de guardar arquivo.
--
-- ADITIVO. Roda 2x.
-- ============================================================================================

alter table public.negocio_anexos drop constraint if exists negocio_anexos_categoria_check;
alter table public.negocio_anexos add constraint negocio_anexos_categoria_check
  check (categoria in (
    'proposta',        -- proposta enviada/ajustada (a que se confere contra o PMVG)
    'ata',             -- ata de registro de precos
    'contrato',
    'proposta_final',
    'ata_sessao',      -- a ata da sessao do pregao
    'itens_ganhos',
    'retorno_precos',
    'edital',          -- O documento do certame. E ele que o leitor de IA le.
    'anexo_edital',    -- termo de referencia, relacao de itens, planilhas do orgao
    'habilitacao',     -- o que foi mandado pra habilitacao NESTE certame
    'recurso',         -- recurso, contrarrazao, impugnacao, resposta do pregoeiro
    'outro'));         -- o que nao e nenhum dos outros — e existir evita que mintam nos outros

comment on column public.negocio_anexos.categoria is
  'O que este arquivo e. As nove primeiras vieram das fatias de Proposta, Ata e Edital; '
  '`habilitacao`, `recurso` e `outro` entraram com "Meus arquivos" (B15), que agrupa TODOS os '
  'documentos do certame num lugar so. A categoria e o que faz o agrupamento existir.';

notify pgrst, 'reload schema';
