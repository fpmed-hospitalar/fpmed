-- ==============================================================================================
-- LIMEDTEC - INSTALACAO DE CLIENTE - 02 - AS TABELAS DA OPERACAO (vazias)
--
-- GERADO por tools/gera_ddl_instalacao.js a partir do schema REAL de um banco em producao.
-- NAO EDITE A MAO: regenere. Um DDL editado a mao deixa de descrever o banco no primeiro ALTER.
--
-- IDEMPOTENTE: rodar duas vezes nao quebra e nao apaga nada. Todo create e "if not exists" e todo
-- policy/trigger e precedido de "drop ... if exists" - que e o unico jeito de reaplicar sem erro.
-- NENHUM comando deste arquivo apaga tabela, coluna ou linha.
--
-- ESTRUTURA, ZERO LINHA. Nenhum select de dado gerou este arquivo.
--
-- >>> UMA DIVIDA CONHECIDA VIAJA JUNTO: a tabela comissoes_isadora tem o nome de uma pessoa da
--     GlobalMed. Um cliente novo nao deveria receber isso, e a unica saida honesta e renomear -
--     que e DDL + mexer na tela que a le. Esta registrado no CONTINUAR como decisao pendente.
--     Enquanto nao for decidido, o arquivo a cria com o nome que a tela procura: instalar com
--     outro nome faria a tela de comissao abrir vazia sem dizer por que.
--
-- >>> OS INDICES UNICOS NAO SAO ENFEITE. ux_cotacao_unica (fornecedor + nome normalizado) e o que
--     impede o mesmo produto do mesmo fornecedor entrar duas vezes com grafia diferente; sem ele
--     a duplicata so aparece meses depois, no primeiro import grande, ja espalhada.
-- ==============================================================================================

create table if not exists clientes (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  cnpj text,
  contato text,
  whatsapp text,
  cidade text,
  uf text,
  vendedora text,
  obs text,
  criado_em timestamp with time zone default now(),
  codigo integer default nextval('clientes_codigo_seq'::regclass) not null,
  cod_cliente_erp text,
  email text,
  prospect_id uuid,
  atualizado_em timestamp with time zone default now(),
  cnpj_normalizado text,
  primary key (id)
);
create unique index if not exists clientes_cnpj_uidx ON public.clientes USING btree (cnpj_normalizado) WHERE (cnpj_normalizado <> ''::text);
create unique index if not exists clientes_cod_erp_uidx ON public.clientes USING btree (cod_cliente_erp) WHERE (cod_cliente_erp IS NOT NULL);
create unique index if not exists clientes_codigo_uidx ON public.clientes USING btree (codigo);

create table if not exists comissoes_externas (
  id uuid default gen_random_uuid() not null,
  empresa_parceira text,
  cliente text,
  valor_venda numeric,
  pct numeric,
  comissao numeric,
  condicao text,
  data_venda date,
  data_recebimento date,
  recebido boolean default false,
  obs text,
  criado_em timestamp with time zone default now(),
  primary key (id)
);

create table if not exists comissoes_isadora (
  id bigint default nextval('comissoes_isadora_id_seq'::regclass) not null,
  pedido text,
  cliente text not null,
  val numeric(12,2) not null,
  tipo text not null,
  condicao text not null,
  prazo integer default 0,
  pct numeric(4,2),
  comissao numeric(12,2),
  data_venda date,
  rec_data date,
  recebido boolean default false,
  primary key (id)
);

create table if not exists compra_itens (
  id uuid default gen_random_uuid() not null,
  compra_id uuid,
  codigo_erp text,
  produto text,
  produto_norm text,
  marca text,
  und text,
  quantidade numeric,
  preco_unit numeric,
  preco_caixa numeric,
  total_item numeric,
  principio_ativo text,
  primary key (id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'compra_itens_compra_id_fkey') then
    alter table compra_itens add constraint compra_itens_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE;
  end if;
end $$;

create table if not exists compras (
  id uuid default gen_random_uuid() not null,
  cliente_codigo integer,
  cliente_id uuid,
  cod_cliente_erp text,
  cliente_nome text,
  data_compra date not null,
  valor_total numeric,
  origem text,
  numero_pedido text,
  espelho_url text,
  obs text,
  criado_em timestamp with time zone default now(),
  vendedor_codigo text,
  vendedor_nome text,
  primary key (id)
);

create table if not exists contatos_industria (
  id uuid default gen_random_uuid() not null,
  fabricante text not null,
  razao_social text,
  telefone text,
  whatsapp text,
  email text,
  site text,
  endereco text,
  canal_cadastro text,
  observacao text,
  status text default 'a_contatar'::text not null,
  atualizado_em timestamp with time zone default now() not null,
  abordagem text,
  abordagem_rascunho boolean,
  primary key (id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contatos_industria_fab') then
    alter table contatos_industria add constraint contatos_industria_fab UNIQUE (fabricante);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contatos_industria_status') then
    alter table contatos_industria add constraint contatos_industria_status CHECK ((status = ANY (ARRAY['a_contatar'::text, 'em_cadastro'::text, 'ativo'::text, 'descartado'::text])));
  end if;
end $$;
create unique index if not exists contatos_industria_fab ON public.contatos_industria USING btree (fabricante);

create table if not exists cotacoes (
  id uuid default gen_random_uuid() not null,
  fornecedor text,
  tipo text,
  pedido text,
  data text,
  codigo double precision,
  produto text,
  principio_ativo text,
  und text,
  vencimento text,
  marca text,
  compra_unit double precision,
  compra_caixa double precision,
  qtd_orcamento double precision,
  total_compra double precision,
  estoque double precision,
  global_venda1 double precision,
  global_venda2 double precision,
  markup double precision,
  regra text,
  venda_unit_calculada double precision,
  venda_caixa_calculada double precision,
  total_venda_calculado double precision,
  created_at timestamp with time zone default now(),
  venda_loja numeric,
  ean text,
  principio_ativo_forn text,
  fabricante text,
  estoque_forn integer,
  cx_embarque integer,
  estoque_em timestamp with time zone,
  preco_nf numeric,
  desconto_forn numeric,
  oferta_desc text,
  oferta_fim date,
  categoria_forn text,
  st_forn numeric,
  observacao text,
  origem_texto text,
  unidade_declarada text,
  unidade_inferida boolean,
  markup_venda double precision default 1.32 not null,
  primary key (id)
);
create unique index if not exists ux_cotacao_unica ON public.cotacoes USING btree (fornecedor, lower(regexp_replace(produto, '^[\s+>*#]+'::text, ''::text)));

create table if not exists fornecedores (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  cnpj text,
  telefone text,
  contato text,
  criado_em timestamp with time zone default now(),
  tipo text,
  codigo_fornecedor text,
  primary key (id)
);

create table if not exists historico_precos (
  id uuid default gen_random_uuid() not null,
  fornecedor text,
  produto text,
  produto_norm text,
  marca text,
  compra_unit numeric,
  compra_caixa numeric,
  origem text,
  capturado_em timestamp with time zone default now() not null,
  primary key (id)
);

create table if not exists itens_a_cotar (
  id uuid default gen_random_uuid() not null,
  descricao text not null,
  descricao_norm text not null,
  chave_grupo text not null,
  pa text,
  origem text default 'busca_nao_encontrado'::text not null,
  cliente text,
  status text default 'pendente'::text not null,
  vezes integer default 1 not null,
  fornecedor_resposta text,
  preco_recebido numeric,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone,
  resolvido_em timestamp with time zone,
  obs text,
  primary key (id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'itens_a_cotar_origem_check') then
    alter table itens_a_cotar add constraint itens_a_cotar_origem_check CHECK ((origem = ANY (ARRAY['busca_nao_encontrado'::text, 'manual'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'itens_a_cotar_status_check') then
    alter table itens_a_cotar add constraint itens_a_cotar_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'cotando'::text, 'resolvido'::text])));
  end if;
end $$;
create unique index if not exists ux_itens_a_cotar_aberto ON public.itens_a_cotar USING btree (chave_grupo) WHERE (status <> 'resolvido'::text);

create table if not exists notas (
  id uuid default gen_random_uuid() not null,
  texto text not null,
  feito boolean default false not null,
  created_at timestamp with time zone default now() not null,
  primary key (id)
);

create table if not exists orcamentos (
  id bigint default nextval('orcamentos_id_seq'::regclass) not null,
  numero text not null,
  cliente text,
  cnpj_cliente text,
  condicao text default 'À VISTA'::text,
  vendedora text default 'Geovana'::text,
  validade text,
  desconto_geral numeric default 0,
  itens jsonb default '[]'::jsonb,
  status text default 'rascunho'::text,
  total_geral numeric default 0,
  criado_em timestamp with time zone default now(),
  atualizado_em timestamp with time zone default now(),
  cliente_codigo integer,
  cliente_id uuid,
  cod_cliente_erp text,
  obs_pedido text,
  primary key (id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orcamentos_numero_key') then
    alter table orcamentos add constraint orcamentos_numero_key UNIQUE (numero);
  end if;
end $$;
create unique index if not exists orcamentos_numero_key ON public.orcamentos USING btree (numero);

create table if not exists pedidos_compra (
  id uuid default gen_random_uuid() not null,
  numero_orcamento text,
  cliente text,
  vendedora text,
  status text default 'pendente'::text,
  itens jsonb,
  total_compra numeric,
  observacao text,
  created_at timestamp without time zone default now(),
  mkp_medio numeric,
  cliente_codigo integer,
  cliente_id uuid,
  cod_cliente_erp text,
  primary key (id)
);

create table if not exists precos_relatados (
  id uuid default gen_random_uuid() not null,
  produto text not null,
  produto_norm text,
  pa_norm text,
  dose_key text,
  preco_pago numeric not null,
  cliente text,
  data date default CURRENT_DATE not null,
  origem text default 'relato_cliente'::text not null,
  obs text,
  criado_em timestamp with time zone default now() not null,
  primary key (id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'precos_relatados_preco_pago_check') then
    alter table precos_relatados add constraint precos_relatados_preco_pago_check CHECK ((preco_pago > (0)::numeric));
  end if;
end $$;

create table if not exists prospeccoes (
  id uuid default gen_random_uuid() not null,
  produto text not null,
  preco_venda numeric(12,2),
  preco_compra numeric(12,2),
  qtd text,
  validade date,
  motivo text,
  obs text,
  status text default 'buscando'::text,
  criado_em timestamp with time zone default now(),
  primary key (id)
);

create table if not exists prospects (
  id uuid default gen_random_uuid() not null,
  razao_social text not null,
  cnpj text,
  segmento text,
  status text default 'Novo'::text,
  contato text,
  whatsapp text,
  email text,
  cidade text,
  uf text,
  followup date,
  obs text,
  criado_em timestamp with time zone default now(),
  atualizado_em timestamp with time zone default now(),
  obs_historico text default '[]'::text,
  vendedora text default ''::text,
  cnpj_normalizado text,
  is_celular boolean,
  prioridade integer default 0 not null,
  primary key (id)
);

create table if not exists saidas_siad (
  id uuid default gen_random_uuid() not null,
  data_import date not null,
  codigo text not null,
  produto text,
  marca text,
  qtd integer,
  preco_tabela numeric,
  valor numeric,
  origem text default 'import'::text not null,
  criado_em timestamp with time zone default now() not null,
  primary key (id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'saidas_siad_unica') then
    alter table saidas_siad add constraint saidas_siad_unica UNIQUE (data_import, codigo);
  end if;
end $$;
create unique index if not exists saidas_siad_unica ON public.saidas_siad USING btree (data_import, codigo);
