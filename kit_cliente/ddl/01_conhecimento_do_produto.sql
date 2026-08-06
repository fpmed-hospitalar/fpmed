-- ==============================================================================================
-- LIMEDTEC - INSTALACAO DE CLIENTE - 01 - CONHECIMENTO DO PRODUTO (nao e dado de cliente)
--
-- GERADO por tools/gera_ddl_instalacao.js a partir do schema REAL de um banco em producao.
-- NAO EDITE A MAO: regenere. Um DDL editado a mao deixa de descrever o banco no primeiro ALTER.
--
-- IDEMPOTENTE: rodar duas vezes nao quebra e nao apaga nada. Todo create e "if not exists" e todo
-- policy/trigger e precedido de "drop ... if exists" - que e o unico jeito de reaplicar sem erro.
-- NENHUM comando deste arquivo apaga tabela, coluna ou linha.
--
-- O QUE ESTA AQUI E POR QUE PODE VIAJAR: marca <-> principio ativo e a tabela CMED sao
-- CONHECIMENTO DO PRODUTO. "DIPIRONA e o principio ativo do NOVALGINA" e verdade em qualquer
-- distribuidora do pais, e a CMED e tabela publica do governo. Nao ha preco de compra, cliente,
-- fornecedor nem margem de ninguem aqui dentro - e e por isso que esta linha nao cruza a
-- fronteira do COMPLIANCE.md: ela nao carrega dado comercial.
--
-- >>> A CMED VAI POR SCRIPT, NAO POR SQL. Sao ~25 mil linhas: como INSERT viraria um arquivo
--     gigante que ninguem revisa. A carga e o tools/carrega_cmed_pf.js, a partir do CSV oficial.
--     O passo esta no ROTEIRO_INSTALACAO.md.
-- ==============================================================================================

create table if not exists dicionario_marca_pa (
  id bigint default nextval('dicionario_marca_pa_id_seq'::regclass) not null,
  tipo text default 'marca'::text not null,
  de text not null,
  para text not null,
  aviso text,
  origem text,
  criado_em timestamp with time zone default now() not null,
  primary key (id)
);
create unique index if not exists ux_dic_marca_pa ON public.dicionario_marca_pa USING btree (tipo, de, para);

create table if not exists cmed_dicionario (
  id bigint default nextval('cmed_dicionario_id_seq'::regclass) not null,
  marca_norm text not null,
  substancia text,
  substancia_raw text,
  dose_norm text,
  apresentacao_raw text,
  is_combo boolean default false,
  fonte text default 'CMED'::text,
  primary key (id)
);

create table if not exists cmed_pf (
  id bigint not null,
  subst_norm text not null,
  marca_norm text not null,
  apresentacao text,
  dose_key text,
  pf_go19 numeric,
  pf_0 numeric,
  restricao_hosp text,
  publicada date not null,
  qtd_apres numeric,
  laboratorio text,
  tipo_produto text,
  tarja text,
  ean1 text,
  ean2 text,
  ean3 text,
  ggrem text,
  registro text,
  pmvg numeric,
  pmc numeric,
  cap text,
  confaz87 text,
  classe_terapeutica text,
  comercializacao text,
  primary key (id)
);

-- o de-para de vocabulario (marca, palavra, aviso). Poucas linhas, e sao regra do motor
-- de busca: sem elas a busca deixa de casar coisas que ela sabe casar.
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'PRECEDEX', 'DEXMEDETOMIDINA', null, 'lote cirurgico 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='PRECEDEX' and para='DEXMEDETOMIDINA');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'DIMORF', 'MORFINA', null, 'lote cirurgico 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='DIMORF' and para='MORFINA');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'TRANSAMIN', 'ACIDO TRANEXAMICO', null, 'lote cirurgico 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='TRANSAMIN' and para='ACIDO TRANEXAMICO');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'NOVABUPI', 'BUPIVACAINA', null, 'lote cirurgico 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='NOVABUPI' and para='BUPIVACAINA');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'FRESOFLOX', 'CIPROFLOXACINO', null, 'lote cirurgico 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='FRESOFLOX' and para='CIPROFLOXACINO');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'PARINEX', 'HEPARINA SODICA', null, 'lote cirurgico 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='PARINEX' and para='HEPARINA SODICA');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'HEMOFOL', 'HEPARINA SODICA', null, 'lote cirurgico 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='HEMOFOL' and para='HEPARINA SODICA');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'C-PLATIN', 'CISPLATINA', null, 'lote onco 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='C-PLATIN' and para='CISPLATINA');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'CITOPLAX', 'CISPLATINA', null, 'lote onco 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='CITOPLAX' and para='CISPLATINA');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'FAULDCISPLA', 'CISPLATINA', null, 'lote onco 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='FAULDCISPLA' and para='CISPLATINA');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'DOCELIBBS', 'DOCETAXEL', null, 'lote onco 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='DOCELIBBS' and para='DOCETAXEL');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'EVOXALI', 'OXALIPLATINA', null, 'lote onco 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='EVOXALI' and para='OXALIPLATINA');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'EVOTAXEL', 'PACLITAXEL', null, 'lote onco 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='EVOTAXEL' and para='PACLITAXEL');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'TAXILAN', 'PACLITAXEL', null, 'lote onco 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='TAXILAN' and para='PACLITAXEL');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'MESO', 'PEMETREXEDE', null, 'lote onco 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='MESO' and para='PEMETREXEDE');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'LUMAZENIL', 'FLUMAZENIL', 'grafia diferente da do pedido (LUMAZENIL x FLUMAZENIL) — confira antes de fechar', 'lote cirurgico 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='LUMAZENIL' and para='FLUMAZENIL');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'palavra', 'SUCTOR', 'SUCCAO', null, 'lote D 03/08 — dreno suctor x dreno succao'
  where not exists (select 1 from dicionario_marca_pa where tipo='palavra' and de='SUCTOR' and para='SUCCAO');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'palavra', 'PERIDURAL', 'EPIDURAL', null, 'lote D 03/08 — cateter/agulha peridural'
  where not exists (select 1 from dicionario_marca_pa where tipo='palavra' and de='PERIDURAL' and para='EPIDURAL');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'palavra', 'PERIDURAL', 'TUOHY', 'agulha Tuohy é a agulha peridural — confira o calibre', 'lote D 03/08'
  where not exists (select 1 from dicionario_marca_pa where tipo='palavra' and de='PERIDURAL' and para='TUOHY');
insert into dicionario_marca_pa (tipo, de, para, aviso, origem) select 'marca', 'SALBUTAMOL 2MG/5ML (0,4MG/ML) XPE 100ML', 'NEUTOSS 0,48MG XPE 100ML', null, 'aceite do vendedor na tela'
  where not exists (select 1 from dicionario_marca_pa where tipo='marca' and de='SALBUTAMOL 2MG/5ML (0,4MG/ML) XPE 100ML' and para='NEUTOSS 0,48MG XPE 100ML');
