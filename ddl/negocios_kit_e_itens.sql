-- ============================================================================================
-- FPMED — O NEGÓCIO SABE DE QUAL EDITAL VEIO E DE QUAIS ITENS EU PARTICIPO
-- Fatia B4 da caixa do Trabalhador B, 14/08/2026.
--
-- ══ 100% ADITIVO ═══════════════════════════════════════════════════════════════════════════
-- Zero DELETE, zero DROP, zero ALTER destrutivo. Só `add column if not exists` e um índice.
-- Nenhuma coluna existente muda de tipo, de nome ou de regra; nenhuma linha é tocada. Quem
-- estiver com a tela antiga aberta continua funcionando: `select=*` passa a trazer duas
-- colunas nulas que ela ignora.
--
-- ══ POR QUE `numero_controle` PRECISA MORAR NO NEGÓCIO ══════════════════════════════════════
-- `negocios.licitacao_id` já existia, e ele resolve o caso fácil: a licitação está no nosso
-- índice, tem `id`, e o negócio aponta pra ela.
-- >>> ELE NÃO RESOLVE O CASO QUE A PONTE NOVA CRIA. O contrato (docs/contrato_itens_editais.md,
--     seção 0) diz com todas as letras que a Encontrar manda `?adicionar=<numero_controle>` —
--     e que a licitação pode ter vindo do PNCP AO VIVO, sem linha nenhuma em `licitacoes`.
--     Nesse caso `licitacao_id` fica NULL e, sem esta coluna, o negócio criado perderia para
--     sempre o vínculo com o edital: a aba Itens não teria por onde procurar em
--     `licitacao_itens`, e "conversar com o edital" não saberia qual edital é.
-- >>> E ELA É A CHAVE QUE AS DUAS PONTAS JÁ USAM. `licitacao_itens.numero_controle` e
--     `licitacao_arquivos.numero_controle` são text; guardar aqui o mesmo text é o que permite
--     juntar sem inventar tradução. Uma segunda chave (cnpj/ano/sequencial) chegaria do outro
--     lado como "não encontrei esta licitação" — sem erro e sem aviso.
--
-- ══ POR QUE `itens_participo` É JSONB E NÃO UMA TABELA ══════════════════════════════════════
-- O que se guarda aqui é uma LISTA DE `numero_item` (texto: o PNCP manda "1", "01" e "1.1", e
-- os três existem — está medido no contrato). Não há atributo nenhum por item deste lado: a
-- descrição, a quantidade, a unidade e o valor de referência já moram em `licitacao_itens`, e
-- o que NÓS confirmamos ter ganho já mora em `negocio_itens_ganhos`.
-- >>> UMA TERCEIRA TABELA SÓ PRA GUARDAR UM PONTEIRO seria uma junção a mais para responder a
--     pergunta mais comum da aba Itens ("este item eu marquei?"), e um lugar a mais para os
--     três desencontrarem. A lista é curta, é lida junto com o negócio (que já vem inteiro no
--     `select=*`) e muda no assistente, de uma vez.
-- >>> LISTA VAZIA E NULL SÃO COISAS DIFERENTES, e a tela trata as duas: `NULL` = ninguém
--     marcou item nenhum, e o contrato diz que isso quer dizer O PREGÃO INTEIRO (seção 2);
--     `[]` = alguém abriu o assistente, viu a lista e desmarcou tudo. Tratar ausência como
--     zero criaria negócio sem item nenhum e ninguém entenderia por quê.
--
-- ══ O KIT DE TAREFAS NÃO PRECISOU DE COLUNA NENHUMA ═════════════════════════════════════════
-- As 15 tarefas com prazo continuam em `negocios.tarefas` (jsonb), que já existe e já guarda
-- exatamente estas 15 em 2.555 registros. Os elementos ganharam três chaves OPCIONAIS
-- (`ancora`, `dias`, `prazo`) nos 3 itens que a lei ancora na abertura. Quem foi gravado antes
-- não tem essas chaves e continua válido — a tela lê como "tarefa sem prazo", que é a verdade.
-- >>> POR QUE NÃO LINHAS EM `lembretes`: o prazo do kit é DERIVADO da abertura. Gravar linha
--     separada faria a data velha sobreviver ao adiamento — o defeito que este projeto já
--     documentou no lembrete da sessão e resolveu derivando. Aqui a derivação é recalculada no
--     mesmo PATCH que muda a abertura (uma escrita, um rastro).
-- ============================================================================================

alter table public.negocios add column if not exists numero_controle text;
alter table public.negocios add column if not exists itens_participo jsonb;

comment on column public.negocios.numero_controle is
  'numero de controle do PNCP do edital de origem (contrato A5, secao 0). NULL quando o negocio nao veio de edital do PNCP.';
comment on column public.negocios.itens_participo is
  'lista de numero_item (texto) em que a empresa participa. NULL = pregao inteiro; [] = nenhum item marcado.';

-- O índice existe para a busca de duplicata do assistente: antes de criar, ele procura negócio
-- com o mesmo `numero_controle`. Sem índice isso vira varredura da tabela inteira a cada
-- chegada da Encontrar — e a duplicata é justamente o erro caro aqui.
create index if not exists negocios_numero_controle_idx
  on public.negocios (numero_controle) where numero_controle is not null;
