-- ============================================================================================
-- ddl/anexos_edital.sql — 11/08/2026 · O EDITAL E OS ANEXOS DELE entram no negocio.
--
-- ══ POR QUE ESTAS DUAS CATEGORIAS, E NAO UMA ════════════════════════════════════════════════
--   · `edital`        = O documento. E UM por certame, e e ele que o leitor de IA le.
--   · `anexo_edital`  = termo de referencia, relacao de itens, planilha do orgao. Sao VARIOS,
--                       e nenhum deles e "o edital".
-- Uma categoria so pareceria mais simples e custaria caro no unico lugar que importa: o botao
-- "Ler edital (IA)" precisa saber QUAL arquivo mandar. Com tudo junto ele teria que adivinhar —
-- e adivinhar errado quer dizer pagar uma leitura pra resumir uma planilha de itens.
--
-- As sete categorias que ja existiam continuam iguais. Estas duas entram no fim, e a ORDEM da
-- lista nao significa nada: quem agrupa e a tela, por nome.
--
-- ══ SOBRE DERRUBAR O CHECK ══════════════════════════════════════════════════════════════════
-- Trocar um CHECK nao e apagar dado: e trocar a regra que valida o dado. As linhas ficam onde
-- estao, e a regra nova aceita tudo que a antiga aceitava — mais duas. Mesmo caminho do
-- ddl/usos_ia_tarefas5.sql, e pelo mesmo motivo.
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
    'anexo_edital'));  -- termo de referencia, relacao de itens, planilhas do orgao

comment on column public.negocio_anexos.categoria is
  'O que este arquivo e. `edital` e o documento do certame (o que o leitor de IA le); '
  '`anexo_edital` sao os que vem junto (TR, relacao de itens, planilhas). Separados porque o '
  'botao de ler precisa saber QUAL mandar — adivinhar errado e pagar uma leitura pra resumir '
  'uma planilha.';

notify pgrst, 'reload schema';
