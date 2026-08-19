-- ============================================================
-- FPMED — O COFRE DE CERTIDÕES GANHA VERSÃO (fatia B25, 19/08/2026)
--
-- A `ddl/documentos.sql` já nasceu com a coluna `ativo` e o comentário "documento substituído
-- fica no histórico". A coluna existia; o histórico, não — nada escrevia `ativo=false`, nada
-- ligava a certidão nova à velha, e a `v_documentos_situacao` filtra `where d.ativo`, ou seja
-- a versão anterior simplesmente DESAPARECERIA da vista de todo mundo no dia em que alguém
-- desligasse a primeira. Meia funcionalidade documentada como inteira.
--
-- >>> POR QUE O HISTÓRICO NÃO É LUXO: a CND que valia no DIA DA SESSÃO é a que habilita. Se em
--     outubro o órgão pedir a certidão que estava válida em agosto, e o cofre só guardar a mais
--     recente, a empresa perde um recurso que ela GANHARIA. Sobrescrever o arquivo antigo é
--     apagar prova de habilitação.
--
-- >>> E POR QUE SUBSTITUIR NÃO É EDITAR: editar diz "eu errei o que estava escrito". Substituir
--     diz "aquele documento valeu até aqui, este vale daqui". São fatos diferentes sobre o
--     mundo, e guardar os dois como um só é a tela mentindo sobre o passado.
--
-- TUDO ADITIVO: três `add column if not exists`, uma view nova, e a view antiga recriada com a
-- MESMA ordem de colunas mais as três no fim (é o que `create or replace view` aceita sem
-- `drop` — e `drop view` é justamente o que a regra da casa proíbe).
--
-- Seguro re-rodar.
-- ============================================================

-- ── 1. AS TRÊS COLUNAS ───────────────────────────────────────────────────────
-- `substitui_id` aponta para TRÁS (a versão nova conhece a velha), e não para frente. Um
-- ponteiro para frente teria de ser reescrito na linha ANTIGA a cada substituição — ou seja, um
-- UPDATE numa linha que já é histórico. Histórico que muda não é histórico.
alter table public.documentos
  add column if not exists substitui_id bigint references public.documentos(id);

-- A versão é um número que a pessoa lê no cartão ("versão 3"), não um detalhe interno. Default 1
-- porque toda linha que já existe é, de fato, a primeira versão dela mesma.
alter table public.documentos
  add column if not exists versao integer not null default 1 check (versao >= 1);

-- QUANDO deixou de valer. `ativo=false` diz que saiu de cena; só a data diz QUANDO — e é a data
-- que responde "qual certidão estava valendo no dia da sessão", que é a pergunta que importa.
alter table public.documentos
  add column if not exists substituido_em timestamptz;

create index if not exists documentos_substitui_idx on public.documentos (substitui_id);
-- O histórico é lido por documento e em ordem de versão; sem este índice a leitura vira varredura.
create index if not exists documentos_versao_idx on public.documentos (id, versao);

-- ── 2. A VIEW DA TELA, COM AS TRÊS NO FIM ────────────────────────────────────
-- >>> A ORDEM DAS COLUNAS AQUI NÃO É ESTILO: `create or replace view` recusa qualquer mudança
--     de nome ou de posição nas colunas que já existiam. O `select d.*` de antes passaria a
--     cuspir `substitui_id, versao, substituido_em` ANTES de `dias_para_vencer` — e o comando
--     falharia com "cannot change name of view column". Escrever a lista à mão, na ordem
--     original, e acrescentar no fim é o que torna esta migração aditiva de verdade.
create or replace view public.v_documentos_situacao
  with (security_invoker = on) as
select d.id, d.empresa_id, d.nome, d.tipo, d.orgao_emissor, d.numero,
       d.emissao, d.validade, d.dias_aviso,
       d.arquivo_path, d.arquivo_nome, d.arquivo_bytes,
       d.observacoes, d.ativo, d.criado_em, d.criado_por, d.atualizado_em,
       (d.validade - current_date)                                   as dias_para_vencer,
       case
         when d.validade is null                                     then 'sem_validade'
         when d.validade <  current_date                             then 'vencido'
         when d.validade <= current_date + d.dias_aviso              then 'vencendo'
         else                                                             'ok'
       end                                                           as situacao,
       d.substitui_id, d.versao, d.substituido_em,
       -- quantas versões ANTERIORES este documento tem: é o número que o cartão mostra para
       -- avisar que existe passado, sem obrigar a tela a uma segunda consulta por cartão.
       (with recursive tras(id) as (
          select d.substitui_id
          union all
          select a.substitui_id from public.documentos a join tras t on a.id = t.id
        ) select count(*) from tras where id is not null)             as versoes_anteriores
  from public.documentos d
 where d.ativo;

-- ── 3. A VIEW DO HISTÓRICO — a única que enxerga quem já saiu de cena ────────
-- Ela NÃO filtra por `ativo`: é o oposto da de cima, e é por isso que ela é uma view separada
-- em vez de um parâmetro. A da tela responde "o que vale hoje"; esta responde "o que valeu".
-- Sem o `ativo` no filtro e COM o `security_invoker`, quem lê continua sendo quem consulta.
create or replace view public.v_documentos_historico
  with (security_invoker = on) as
select d.id, d.nome, d.tipo, d.orgao_emissor, d.numero,
       d.emissao, d.validade, d.dias_aviso,
       d.arquivo_path, d.arquivo_nome, d.arquivo_bytes,
       d.ativo, d.versao, d.substitui_id, d.substituido_em,
       d.criado_em, d.atualizado_em
  from public.documentos d;

-- ── 4. PERMISSÃO ─────────────────────────────────────────────────────────────
-- Mesma simetria da tabela: todo logado LÊ (o vendedor precisa saber qual certidão valia), e
-- `anon` não entra em lugar nenhum. Escrever continua sendo da policy da tabela — a view não
-- inventa permissão nenhuma.
grant select on public.v_documentos_historico to authenticated;
revoke all on public.v_documentos_historico from anon;
revoke all on public.v_documentos_situacao   from anon;
grant select on public.v_documentos_situacao to authenticated;

notify pgrst, 'reload schema';
