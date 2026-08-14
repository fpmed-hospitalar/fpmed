-- ============================================================================================
-- FPMED — ITENS DO EDITAL, ARQUIVOS DO EDITAL E RESULTADO POR ITEM
-- Fatias A5/A6/A7 da caixa do arquiteto, 14/08/2026.
--
-- ══ 100% ADITIVO ═══════════════════════════════════════════════════════════════════════════
-- Zero DELETE, zero DROP, zero ALTER destrutivo. Só `create table if not exists` e índices.
-- Nada aqui toca em tabela existente.
--
-- ══ POR QUE ESTAS TABELAS PRECISAM EXISTIR ═════════════════════════════════════════════════
-- Até hoje os itens de um edital eram lidos AO VIVO do PNCP e guardados só na memória da aba
-- (cache de 15 minutos). Isso serve pra olhar, e não serve pra três coisas que a caixa pede:
--   · o Negócios (outra janela) precisa receber QUAIS ITENS foram escolhidos, e não pode
--     depender de a outra aba estar aberta;
--   · "conversar com o edital" precisa do TEXTO do edital, que não cabe em memória e não pode
--     ser re-extraído a cada pergunta (cada extração custa);
--   · o resultado por item (quem ganhou, por quanto) é HISTÓRICO — ele existe depois que a
--     sessão acabou, e memória de aba não guarda isso.
--
-- ══ A CHAVE É `numero_controle`, E NÃO O `id` ═══════════════════════════════════════════════
-- Medido em 14/08: `licitacoes` tem 3.201 linhas, 3.201 com `numero_controle` preenchido e
-- 3.201 distintos — 100%, sem um único vazio ou repetido.
-- >>> ELA É A ÚNICA CHAVE QUE SERVE AOS DOIS LADOS. A tela Encontrar mostra licitações que
--     vieram do NOSSO índice (têm `licitacoes.id`) e licitações que vieram do PNCP AO VIVO
--     (não têm id nenhum aqui). Usar o `id` obrigaria a inserir a licitação antes de guardar
--     qualquer item dela, e uma tela de BUSCA não pode gravar no índice só porque alguém
--     clicou pra olhar.
-- >>> `licitacao_id` FICA JUNTO, e é opcional: quando a licitação está no índice, ele encurta
--     a junção. Quando não está, fica NULL — e a linha continua válida.
-- ============================================================================================

-- ── 1. OS ITENS DO EDITAL ────────────────────────────────────────────────────────────────────
create table if not exists public.licitacao_itens (
  id                  bigserial primary key,
  numero_controle     text    not null,          -- a chave universal (ver acima)
  licitacao_id        bigint,                    -- atalho quando a licitação está no índice
  numero_item         text    not null,          -- o nº do item COMO O PNCP MANDA (texto: há "1", "1.1", "01")
  descricao           text    not null,
  quantidade          numeric,
  unidade             text,
  valor_unitario_ref  numeric,                   -- valor de referência do EDITAL (não é nosso preço)
  situacao            text,                      -- situacaoCompraItemNome do PNCP (deserto/fracassado…)
  bruto               jsonb,                     -- o item cru, pra não perder campo que ainda não usamos

  -- ── RESULTADO POR ITEM (fatia A7) ────────────────────────────────────────────────────────
  -- Moram AQUI, e não numa tabela separada, porque são atributos DO MESMO ITEM em outro
  -- momento da vida dele. Tabela separada obrigaria uma junção para responder "este item eu
  -- ganhei?" — que é a pergunta mais natural que se faz sobre um item de edital.
  -- >>> NULL É "AINDA NÃO SEI", E NÃO "NÃO GANHEI". A diferença é a mesma de sempre: sessão
  --     que ainda não foi homologada e sessão que perdemos são estados diferentes, e a tela
  --     que os tratar igual vai dizer que perdemos o que ainda nem foi julgado.
  resultado_vencedor      text,
  resultado_cnpj          text,
  resultado_valor_unit    numeric,
  resultado_quantidade    numeric,
  resultado_situacao      text,                  -- homologado / deserto / fracassado / revogado
  resultado_lido_em       timestamptz,

  coletado_em         timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- UM item por (licitação, número do item). Sem isto, cada re-leitura do edital duplicaria a
-- lista inteira e a contagem de itens dobraria a cada visita.
create unique index if not exists licitacao_itens_chave
  on public.licitacao_itens (numero_controle, numero_item);
create index if not exists licitacao_itens_lic on public.licitacao_itens (licitacao_id);
create index if not exists licitacao_itens_ctrl on public.licitacao_itens (numero_controle);

-- ── 2. OS ARQUIVOS DO EDITAL (fatia A6) ──────────────────────────────────────────────────────
create table if not exists public.licitacao_arquivos (
  id                bigserial primary key,
  numero_controle   text    not null,
  licitacao_id      bigint,
  sequencial        integer,                     -- o sequencialDocumento do PNCP
  titulo            text,
  tipo              text,                        -- "Edital", "Anexo", "Termo de Referência"…
  url_pncp          text    not null,            -- o link ORIGINAL no PNCP; nunca reescrito
  bytes             bigint,

  -- ══ O TEXTO EXTRAÍDO É O QUE A IA LÊ, e é por isso que ele mora no banco ═════════════════
  -- Guardar o texto (e não só o link) é o que permite perguntar dez vezes sobre o mesmo edital
  -- pagando UMA extração. Sem ele, cada pergunta re-baixaria e re-extrairia 80 páginas.
  -- >>> O PDF INTEIRO **NÃO** ENTRA AQUI, e isso é regra da caixa: só para licitações que estão
  --     nos meus negócios, e no bucket de anexos — não nesta tabela. Um PDF de 12 MB por
  --     licitação, para o Brasil inteiro, é uma conta que ninguém autorizou.
  texto_extraido    text,
  texto_chars       integer,
  texto_paginas     integer,
  extraido_em       timestamptz,
  extracao_erro     text,                        -- por que falhou, quando falhar. "não sei" tem causa.

  coletado_em       timestamptz not null default now()
);
create unique index if not exists licitacao_arquivos_chave
  on public.licitacao_arquivos (numero_controle, url_pncp);
create index if not exists licitacao_arquivos_ctrl on public.licitacao_arquivos (numero_controle);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────────────────────
-- Dado PÚBLICO (edital e resultado são publicados por obrigação legal no PNCP). Todo logado lê;
-- quem escreve é o coletor com a service_role. Ausência de policy de escrita = negado.
alter table public.licitacao_itens     enable row level security;
alter table public.licitacao_arquivos  enable row level security;

drop policy if exists lic_itens_sel on public.licitacao_itens;
create policy lic_itens_sel on public.licitacao_itens for select to authenticated using (true);

drop policy if exists lic_arq_sel on public.licitacao_arquivos;
create policy lic_arq_sel on public.licitacao_arquivos for select to authenticated using (true);

revoke all on public.licitacao_itens    from anon;
revoke all on public.licitacao_arquivos from anon;
grant select on public.licitacao_itens    to authenticated;
grant select on public.licitacao_arquivos to authenticated;

notify pgrst, 'reload schema';
