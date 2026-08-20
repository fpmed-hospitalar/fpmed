-- ============================================================
-- FPMED — O COFRE APRENDE A TIRAR DOCUMENTO (fatia B27, 20/08/2026)
--
-- ══ O QUE ESTAVA FALTANDO, E POR QUE ERA PRODUTO E NÃO CONVENIÊNCIA ═════════════════════════
-- A B25 ensinou o cofre a SUBSTITUIR (a via nova nasce, a velha vai para o histórico). Ele
-- continuou sem saber TIRAR: um documento cadastrado por engano, uma certidão que a empresa
-- deixou de precisar, ou os registros de prova que as minhas próprias fatias deixaram no cofre
-- do dono — nada disso tinha saída pela tela. A única saída era `delete` no SQL, ou seja: o dono
-- digitando comando, ou o assistente apagando linha. As duas erradas.
--
-- >>> E NÃO É DELETE. Um cofre de certidões existe para PROVAR: quem tirou uma CND de lá um dia
--     vai precisar mostrar que ela existiu, e em que dia. `ativo = false` com CARIMBO e MOTIVO
--     tira o documento da frente sem apagar o fato de ele ter existido. É a mesma lei da B25
--     ("sobrescrever o arquivo antigo é apagar prova de habilitação"), aplicada à outra ponta.
--
-- ══ ARQUIVADO E SUBSTITUÍDO SÃO DOIS FATOS DIFERENTES, E O BANCO TEM QUE SABER DISSO ════════
-- Os dois deixam a linha com `ativo = false`, e essa coincidência é uma armadilha: sem coluna
-- própria, a gaveta "ver 5 arquivados" mostraria TAMBÉM as vias antigas de todo documento que
-- alguém já substituiu — e a via antiga de uma CND não foi arquivada, ela foi SUCEDIDA. O
-- passado dela pertence ao histórico do documento dela, não a uma gaveta de descarte.
--   · substituído  -> `substituido_em` preenchido; existe uma via NOVA apontando para ele
--   · arquivado    -> `arquivado_em` preenchido; não existe sucessor, alguém decidiu tirar
-- São excludentes na prática e a gaveta filtra por `arquivado_em is not null`.
--
-- ══ DESARQUIVAR EXISTE, E NÃO APAGA O CARIMBO ═══════════════════════════════════════════════
-- Arquivar por engano tem que ter volta — botão sem volta é botão que ninguém clica, e aí o
-- recurso não existe na prática. Mas voltar NÃO apaga `arquivado_em`/`arquivado_motivo`: quem
-- desfaz um ato não desfaz o fato de ter feito. `desarquivado_em` é a terceira data, e a linha
-- passa a contar a história inteira ("saiu em 20/08 porque X, voltou em 21/08").
-- >>> É por isso que a gaveta filtra por `ativo = false AND arquivado_em is not null`, e não só
--     pelo carimbo: um documento que voltou tem carimbo e está ativo — ele pertence à lista.
--
-- ══ O DESTINATÁRIO DO AVISO VIRA COLUNA (a outra metade da B27) ═════════════════════════════
-- `dias_aviso` já existe desde a `documentos.sql` (e vale 30 nos 9 registros que há hoje —
-- medido, não chutado). Faltava PARA QUEM avisar. Ele é POR DOCUMENTO pela mesma razão que a
-- antecedência é: o alvará da vigilância interessa a quem cuida da licença sanitária, e a CND
-- federal interessa a quem monta habilitação. Um endereço único no sistema mandaria os dois
-- para a mesma caixa e um dos dois seria ignorado.
-- >>> NULL = "usa o e-mail da empresa cadastrada" (`cliente.config.js`), e não "não avisa".
--     Ausência de endereço não pode significar silêncio: silêncio por omissão é como a certidão
--     vence sem ninguém saber, que é o defeito que este módulo inteiro existe para matar.
--
-- TUDO ADITIVO: cinco `add column if not exists`, a view da tela recriada com as colunas novas
-- NO FIM (é o que `create or replace view` aceita sem `drop` — e `drop view` é o que a regra da
-- casa proíbe), e duas views novas.
--
-- Seguro re-rodar.
-- ============================================================

-- ── 1. AS COLUNAS ────────────────────────────────────────────────────────────
-- QUANDO saiu de cena por decisão de alguém. É a data que separa "arquivado" de "substituído".
alter table public.documentos
  add column if not exists arquivado_em timestamptz;

-- POR QUÊ. Sem motivo, a gaveta vira um cemitério anônimo: daqui a seis meses ninguém sabe se a
-- CND foi tirada porque estava errada, porque a empresa parou de precisar, ou por engano — e a
-- diferença entre as três decide se ela volta.
-- >>> A TELA OBRIGA A ESCOLHER UM (lista curta + "outro" com texto). Aqui não há `not null`
--     porque a coluna nasce nula em 9 linhas que já existem, e `not null` numa coluna nova de
--     tabela povoada é migração destrutiva disfarçada.
alter table public.documentos
  add column if not exists arquivado_motivo text;

alter table public.documentos
  add column if not exists arquivado_por uuid;

-- A VOLTA. Não apaga o carimbo de saída — ver o cabeçalho.
alter table public.documentos
  add column if not exists desarquivado_em timestamptz;

-- PARA QUEM avisar. NULL = o e-mail da empresa cadastrada (ver o cabeçalho).
alter table public.documentos
  add column if not exists email_aviso text;

-- A gaveta é lida por `arquivado_em is not null`, e ela é a minoria das linhas: índice parcial,
-- que é o que não cobra espaço pelas linhas que nunca vão aparecer nessa consulta.
create index if not exists documentos_arquivado_idx
  on public.documentos (arquivado_em desc) where arquivado_em is not null;

-- ── 2. A VIEW DA TELA — AS NOVAS NO FIM, DE NOVO ─────────────────────────────
-- >>> A ORDEM AQUI NÃO É ESTILO, É O QUE TORNA A MIGRAÇÃO ADITIVA. `create or replace view`
--     recusa mudança de nome ou de POSIÇÃO das colunas que já existiam ("cannot change name of
--     view column"). A lista abaixo repete, na ordem exata, tudo o que a B25 deixou — inclusive
--     `versoes_anteriores` no fim — e só então acrescenta as cinco. Foi a lição da B25 e ela
--     continua valendo: quem acrescenta no meio troca uma migração aditiva por um `drop view`.
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
       (with recursive tras(id) as (
          select d.substitui_id
          union all
          select a.substitui_id from public.documentos a join tras t on a.id = t.id
        ) select count(*) from tras where id is not null)             as versoes_anteriores,
       d.arquivado_em, d.arquivado_motivo, d.arquivado_por, d.desarquivado_em, d.email_aviso
  from public.documentos d
 where d.ativo;

-- ── 3. A GAVETA ──────────────────────────────────────────────────────────────
-- >>> ELA NÃO É "a v_documentos_historico com um filtro". O histórico enxerga TUDO que saiu de
--     cena, inclusive as vias antigas de quem foi substituído — e via antiga não é descarte, é
--     passado de um documento vivo. A gaveta mostra só o que alguém DECIDIU tirar e que não tem
--     sucessor. Misturar as duas encheria a gaveta de linha que ninguém arquivou, e aí o número
--     do botão ("ver 5 arquivados") passaria a mentir.
-- >>> E O QUE VOLTOU NÃO ESTÁ AQUI: `where not ativo` cuida disso sozinho. Documento restaurado
--     tem carimbo de arquivamento e está na lista principal — é lá que ele pertence.
create or replace view public.v_documentos_arquivados
  with (security_invoker = on) as
select d.id, d.empresa_id, d.nome, d.tipo, d.orgao_emissor, d.numero,
       d.emissao, d.validade, d.dias_aviso,
       d.arquivo_path, d.arquivo_nome, d.arquivo_bytes,
       d.versao, d.substitui_id,
       d.arquivado_em, d.arquivado_motivo, d.arquivado_por, d.desarquivado_em,
       d.criado_em, d.atualizado_em
  from public.documentos d
 where not d.ativo
   and d.arquivado_em is not null;

-- ── 3b. O HISTÓRICO PRECISA ENXERGAR O ARQUIVAMENTO TAMBÉM ───────────────────
-- >>> ACHADO RODANDO A PROVA, e não lendo o código: a `v_documentos_historico` da B25 é a única
--     view que enxerga quem saiu de cena — e ela saiu desta fatia **cega para o motivo novo de
--     sair**. Perguntar a ela "este documento foi substituído ou arquivado?" devolvia
--     `column ... does not exist`. Ou seja: a view que existe para contar o passado inteiro
--     passaria a contar só metade dele, e a metade que ela conta é a antiga.
-- Aditivo de novo: a MESMA lista de colunas da B25, na MESMA ordem, com as quatro no fim.
create or replace view public.v_documentos_historico
  with (security_invoker = on) as
select d.id, d.nome, d.tipo, d.orgao_emissor, d.numero,
       d.emissao, d.validade, d.dias_aviso,
       d.arquivo_path, d.arquivo_nome, d.arquivo_bytes,
       d.ativo, d.versao, d.substitui_id, d.substituido_em,
       d.criado_em, d.atualizado_em,
       d.arquivado_em, d.arquivado_motivo, d.desarquivado_em, d.email_aviso
  from public.documentos d;

grant select on public.v_documentos_historico to authenticated;
revoke all  on public.v_documentos_historico from anon;

-- ── 4. QUEM O AVISO ESCOLHERIA — A MESMA PERGUNTA, UM LUGAR SÓ ───────────────
-- O e-mail de vencimento e a tela têm de concordar sobre QUAIS documentos estão vencendo. Se a
-- edge function montasse a própria consulta, existiriam duas definições de "vencendo" — e no dia
-- em que uma mudasse, a tela diria uma coisa e o e-mail diria outra sobre o MESMO cofre. Foi
-- exatamente o defeito que a `v_documentos_situacao` já existe para evitar ("a conta de quantos
-- dias faltam fica NO BANCO, num lugar só"), e ele voltaria pela porta do e-mail.
--
-- >>> DOCUMENTO SEM VALIDADE NÃO ENTRA AQUI, E ISSO É A REGRA DA CAIXA ESCRITA EM SQL: ele não
--     está vencendo, ele está SEM DATA, e são coisas diferentes. Avisar sobre ele seria dizer
--     "sua certidão está para vencer" sobre um contrato social que não vence — e quem recebe um
--     aviso falso passa a ignorar os verdadeiros. O painel diz isso; o e-mail cala.
-- >>> VENCIDO ENTRA. Ele já passou do prazo, e é o caso mais urgente que existe neste módulo:
--     certidão vencida é desclassificação no dia da sessão. Um aviso que só cobre "vai vencer" e
--     se cala sobre "já venceu" chega tarde justamente quando mais importa.
create or replace view public.v_documentos_avisar
  with (security_invoker = on) as
select s.id, s.nome, s.tipo, s.orgao_emissor, s.numero,
       s.validade, s.dias_aviso, s.dias_para_vencer, s.situacao, s.email_aviso,
       s.versao, s.arquivo_nome
  from public.v_documentos_situacao s
 where s.situacao in ('vencido', 'vencendo');

-- ── 5. PERMISSÃO ─────────────────────────────────────────────────────────────
-- Mesma simetria de sempre: todo logado LÊ (o vendedor precisa saber qual certidão vale antes de
-- montar proposta); escrever continua sendo da policy da TABELA, que exige `cargo_gestor()`. A
-- view não inventa permissão nenhuma, e `anon` não entra em lugar nenhum.
grant select on public.v_documentos_arquivados to authenticated;
revoke all  on public.v_documentos_arquivados from anon;
grant select on public.v_documentos_avisar     to authenticated;
revoke all  on public.v_documentos_avisar      from anon;
revoke all  on public.v_documentos_situacao    from anon;
grant select on public.v_documentos_situacao   to authenticated;

notify pgrst, 'reload schema';
