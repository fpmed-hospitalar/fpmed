-- ============================================================================================
-- FPMED — O RASTRO DO ARQUIVAMENTO (fatia B34, 21/08/2026)
--
-- ══ A PERGUNTA DA CAIXA, E O QUE A MEDIÇÃO RESPONDEU ════════════════════════════════════════
-- A caixa da rodada 12 diz: "108 atas com a bandeira ligada e ZERO com `arquivado_em` — ou seja,
-- ninguém arquivou nada". A primeira metade está certa e a segunda está errada, e a diferença
-- entre as duas é esta fatia inteira.
--
-- MEDIDO EM 21/08/2026, e o número é MAIOR do que o da caixa: não são 108 linhas com a bandeira
-- ligada sem carimbo — são **2.559**, de 2.566 negócios. As 108 são só as de estágio `contrato`.
--
-- E NINGUÉM LIGOU AQUELA BANDEIRA POR DESCUIDO. Quem ligou foi o `tools/semeia_negocios.js`, em
-- 06/08, DE PROPÓSITO, com a razão escrita no código dele (linhas 97-100) e duas condições
-- independentes: o status da planilha diz que a linha saiu do jogo, ou a data de abertura já
-- passou. A frase dele é "kanban com 2.555 cartões não é funil — é a lista de tudo que já
-- aconteceu, e ninguém arrasta nada nela". Ele até RECUSA semear status que não esteja no mapa.
-- >>> ENTÃO O `arquivado` NÃO ESTÁ ERRADO E NÃO É PARA SER DESLIGADO. O que falta não é conserto
--     de bandeira: é o RASTRO. O porquê e o quando existem — em código e em comentário, não no
--     dado. Daqui a três meses ninguém vai abrir o semeador para descobrir isso, e a linha não
--     tem como se explicar sozinha. É exatamente o risco que a caixa nomeou, na outra ponta:
--     não "quem desligou em massa", mas **quem LIGOU em massa**.
--
-- ══ AS DUAS OPÇÕES QUE EU MEDI E NÃO EXECUTEI (a caixa pediu duas medidas, e aqui estão) ═════
-- OPÇÃO A — carimbar `arquivado_em` nas 107 atas sem carimbo.
--   MEDIDO: a `v_atas_vigencia` filtra `arquivado_em is null`. Hoje ela tem **107** linhas; com o
--   carimbo teria **ZERO**, e a aba Ata inteira ficaria em branco. A gaveta iria de 1 para 108, e
--   o botão "ver N arquivadas" passaria a dizer 108 sobre atas que ninguém arquivou.
--   É PALAVRA POR PALAVRA O DESASTRE QUE O `entrada_da_ata.sql` (B31) foi escrito para evitar,
--   e está escrito lá: "`not arquivado` deixaria esta view com ZERO linhas hoje". RECUSADA.
--
-- OPÇÃO B — desligar `arquivado` nas 2.551 linhas do Calendário.
--   MEDIDO: o kanban iria de **6** para **2.566** cartões, e os três coletores que perguntam
--   `negocios?arquivado=is.false` (coleta_itens_lote, coleta_editais, coleta_resultados) iriam de
--   0 para 3 licitações do índice hoje — e passariam a mirar a base inteira conforme ela cresce.
--   É desfazer, sem medir, uma decisão que foi medida e escrita há quinze dias. RECUSADA.
--
-- OPÇÃO C — a desta fatia: NÃO TOCAR em `arquivado` nem em `arquivado_em`, e gravar a ORIGEM do
--   arquivamento numa coluna nova que NENHUMA view filtra. MEDIDO: zero linha muda de
--   comportamento em tela nenhuma. É a única das três que responde à pergunta sem mudar a
--   resposta de outra.
--
-- TUDO ADITIVO: nenhuma coluna sai, nenhuma view é derrubada, nenhuma linha perde valor —
-- o único UPDATE escreve em coluna que nasceu NULA neste mesmo arquivo. Roda 2x sem efeito novo.
-- ============================================================================================


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 1. A COLUNA QUE FALTAVA: POR QUE ESTA LINHA ESTÁ ARQUIVADA
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- Três colunas já respondiam QUANDO (`arquivado_em`), POR QUE (`arquivado_motivo`) e QUEM
-- (`arquivado_por`) — e as três só existem para quem foi arquivado por DECISÃO. Para as 2.559
-- linhas que nasceram arquivadas, as três são nulas, e nulo aqui não é "não informado": é a
-- ausência que faz a linha parecer idêntica a um clique que ninguém registrou.
--
-- >>> POR QUE UMA COLUNA E NÃO UM COMENTÁRIO. Um comentário responde "por que existem linhas
--     assim"; ele não responde "QUAIS destas 2.560 foram decisão de gente?". Essa segunda é a
--     pergunta que alguém vai fazer daqui a três meses, e ela só tem resposta linha a linha.
-- >>> E POR QUE NÃO REAPROVEITAR `arquivado_motivo`: ele é lido pela `v_atas_arquivadas` e
--     pintado na ficha da ata. Ele quer dizer "o motivo que a pessoa escolheu", e enchê-lo com
--     "importação" faria a coluna significar duas coisas — que é como um campo começa a mentir.
alter table public.negocios add column if not exists arquivado_origem text;

comment on column public.negocios.arquivado_origem is
  'DE ONDE veio o arquivamento desta linha, e existe porque `arquivado` sozinho nao distingue '
  'decisao de importacao. Tres valores: `importacao_calendario_2025` (nasceu arquivada na '
  'semeadura de 06/08, ver tools/semeia_negocios.js linhas 97-100); `decisao` (alguem clicou, e '
  'ai `arquivado_em` diz quando); `decisao_sem_carimbo` (alguem clicou ANTES de 21/08/2026, '
  'quando o botao do kanban ainda nao gravava o carimbo — a data desse clique esta perdida e '
  'inventar uma seria pior que admitir). NULO = a linha nao esta arquivada.';

-- E a bandeira velha passa a dizer, nela mesma, que sozinha ela não responde nada.
comment on column public.negocios.arquivado is
  'A linha esta fora do funil. NAO diz por que: 2.551 das 2.560 ligadas vieram da importacao do '
  'Calendario 2025, nao de decisao de ninguem. Quem precisa saber POR QUE le `arquivado_origem`; '
  'quem precisa saber QUANDO ALGUEM DECIDIU le `arquivado_em`. Painel e gaveta filtram por essas '
  'duas, nunca por esta (medido em 21/08: filtrar por esta deixaria a aba Ata com ZERO linhas).';

-- O índice é PARCIAL e só cobre o que se pergunta: "quais foram decisão de gente?". Um índice
-- sobre a coluna inteira gastaria página para os 2.551 que são a resposta óbvia.
create index if not exists negocios_arquivado_origem_decisao_idx
  on public.negocios (arquivado_origem)
  where arquivado_origem in ('decisao', 'decisao_sem_carimbo');


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 2. O ÚNICO UPDATE DESTA FATIA — E ELE SÓ ESCREVE ONDE ESTÁ NULO
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- A caixa manda: "não é DELETE, mas é UPDATE, então trate com o mesmo cuidado; só toque no que a
-- evidência sustenta". As três condições abaixo são a evidência, e cada grupo tem a sua:
--
--   `arquivado_origem is null` .... torna o comando IDEMPOTENTE e impede que uma segunda rodada
--                                   sobrescreva um valor que a tela já gravou. Nenhuma linha
--                                   perde informação: o valor anterior é NULO por construção,
--                                   porque a coluna nasceu no bloco 1 deste mesmo arquivo.
--   `arquivado` .................... quem não está arquivado não tem origem de arquivamento.
--   e a terceira, que separa os três grupos, está em cada UPDATE.
--
-- >>> POR QUE ISTO NÃO É "DECIDIR PELO DONO". Nenhuma das 2.560 linhas muda de estado: o que era
--     arquivado continua arquivado, o que aparecia continua aparecendo. O UPDATE só escreve o que
--     já era verdade e estava fora do dado. Se estiver errado, corrigir é outro UPDATE nesta
--     coluna — nada foi perdido para poder ser corrigido.

-- GRUPO 1 — nasceu arquivada na semeadura. 2.551 linhas medidas em 21/08.
-- A evidência é dupla e as duas vêm do próprio dado: `origem` gravada pelo semeador, e a
-- AUSÊNCIA de carimbo (se alguém tivesse decidido, a coluna `arquivado_em` diria quando).
update public.negocios
   set arquivado_origem = 'importacao_calendario_2025'
 where arquivado_origem is null
   and arquivado
   and arquivado_em is null
   and origem = 'calendario_2025';

-- GRUPO 2 — alguém clicou, e o botão da época não anotou nada. 8 linhas medidas em 21/08.
-- Estas são o rastro do defeito que esta fatia conserta no código: até hoje o `arquivar()` do
-- kanban gravava só `{ arquivado: true }`. Elas ficam com um valor PRÓPRIO, e não com 'decisao',
-- porque de 'decisao' se espera um `arquivado_em` do lado — e o delas não existe.
-- >>> NÃO INVENTAMOS A DATA. Carimbar `arquivado_em = now()` aqui seria afirmar que alguém
--     arquivou HOJE o que arquivou em algum dia de agosto, e ainda mandaria a linha para a gaveta
--     com data falsa. Data que não se sabe se escreve como não sabida, não como hoje.
update public.negocios
   set arquivado_origem = 'decisao_sem_carimbo'
 where arquivado_origem is null
   and arquivado
   and arquivado_em is null
   and origem is distinct from 'calendario_2025';

-- GRUPO 3 — tem carimbo, logo foi decisão, e o quando já está gravado. 1 linha em 21/08.
update public.negocios
   set arquivado_origem = 'decisao'
 where arquivado_origem is null
   and arquivado
   and arquivado_em is not null;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 3. A VISÃO QUE RESPONDE A PERGUNTA DE DAQUI A TRÊS MESES
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- "Quantos destes arquivados foram decisão de alguém, e quantos vieram de fábrica?" — uma linha
-- de leitura, sem ninguém precisar lembrar dos nomes das três colunas nem abrir o semeador.
-- Ela NÃO filtra nada e NÃO alimenta tela nenhuma: é instrumento de auditoria, e está declarado.
create or replace view public.v_arquivamento_origem
  with (security_invoker = on) as
select coalesce(n.arquivado_origem, 'sem_origem_declarada') as origem_do_arquivamento,
       count(*)                                             as linhas,
       count(*) filter (where n.arquivado_em is not null)    as com_carimbo,
       count(*) filter (where n.estagio = 'contrato')        as atas,
       min(n.criado_em)                                      as mais_antiga,
       max(n.criado_em)                                      as mais_nova
  from public.negocios n
 where n.arquivado
 group by 1
 order by 2 desc;

comment on view public.v_arquivamento_origem is
  'AUDITORIA, nao tela: quantos arquivados vieram de decisao e quantos vieram da importacao. '
  'Existe porque `arquivado = true` sozinho nao distingue as duas coisas, e a distincao so vale '
  'se alguem conseguir conferi-la sem ler codigo.';

grant select on public.v_arquivamento_origem to authenticated;
revoke all  on public.v_arquivamento_origem from anon;

notify pgrst, 'reload schema';
