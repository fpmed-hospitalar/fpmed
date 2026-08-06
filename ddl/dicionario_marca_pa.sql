-- ============================================================
-- FPMED — TABELA dicionario_marca_pa (de-para de vocabulário do motor de busca)
-- 07/08/2026, MODO ENTREGA. Equivale ao `ddl/01` do kit, com dois defeitos dele corrigidos.
--
-- O QUE É: "PRECEDEX é DEXMEDETOMIDINA", "PERIDURAL é EPIDURAL". Sem estas linhas a busca
-- deixa de casar coisas que ela sabe casar — o pedido chega com a MARCA e o nosso cadastro
-- tem o PRINCÍPIO ATIVO, e ninguém acha nada.
--
-- >>> POR QUE ISTO PODE VIR DO MOLDE (e o COMPLIANCE não é violado): é CONHECIMENTO DO
--     PRODUTO, não dado comercial. "DIPIRONA é o princípio ativo do NOVALGINA" é verdade em
--     qualquer distribuidora do país. Não há preço, cliente, fornecedor nem margem de ninguém
--     nestas 20 linhas — é por isso que elas atravessam, e o resto do banco não.
--
-- >>> 2 DEFEITOS DO `ddl/01` DO KIT, corrigidos aqui (voltam pro produto):
--     1. Ele usa `nextval('dicionario_marca_pa_id_seq'::regclass)` e **não cria a sequence**.
--        Rodado num banco limpo, estoura na primeira linha. (Foi gerado a partir de um banco
--        que já tinha a sequence — o gerador leu o default da coluna e não a dependência.)
--        Aqui: `generated always as identity`, que não depende de objeto solto nenhum.
--     2. Ele **não liga RLS e não revoga o `anon`** — o mesmo defeito do `ddl/03`, que hoje
--        deixou a tabela `perfis` legível pela internet. Num repo público com a chave anon no
--        HTML, tabela nova sem RLS nasce aberta.
--
-- Seguro re-rodar: os inserts são guardados por `where not exists`.
-- ============================================================

create table if not exists public.dicionario_marca_pa (
  id         bigint generated always as identity primary key,
  tipo       text not null default 'marca',      -- 'marca' | 'palavra'
  de         text not null,
  para       text not null,
  aviso      text,                               -- texto que a tela mostra junto do casamento
  origem     text,
  criado_em  timestamptz not null default now()
);
create unique index if not exists ux_dic_marca_pa on public.dicionario_marca_pa (tipo, de, para);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Vocabulário do motor: todo logado LÊ (a busca do vendedor depende dele); escrever é gestor,
-- como em toda tabela de referência do projeto.
alter table public.dicionario_marca_pa enable row level security;

drop policy if exists dmp_sel on public.dicionario_marca_pa;
drop policy if exists dmp_ins on public.dicionario_marca_pa;
drop policy if exists dmp_upd on public.dicionario_marca_pa;
drop policy if exists dmp_del on public.dicionario_marca_pa;

create policy dmp_sel on public.dicionario_marca_pa for select to authenticated using (true);
create policy dmp_ins on public.dicionario_marca_pa for insert to authenticated with check (public.cargo_gestor());
create policy dmp_upd on public.dicionario_marca_pa for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy dmp_del on public.dicionario_marca_pa for delete to authenticated using (public.cargo_gestor());

revoke all on public.dicionario_marca_pa from anon;
grant select on public.dicionario_marca_pa to authenticated;
grant insert, update, delete on public.dicionario_marca_pa to authenticated;

-- ── O VOCABULÁRIO (as 20 linhas do molde) ────────────────────────────────────
insert into public.dicionario_marca_pa (tipo, de, para, aviso, origem)
select v.tipo, v.de, v.para, v.aviso, v.origem
  from (values
    ('marca','PRECEDEX','DEXMEDETOMIDINA',null,'lote cirurgico 03/08'),
    ('marca','DIMORF','MORFINA',null,'lote cirurgico 03/08'),
    ('marca','TRANSAMIN','ACIDO TRANEXAMICO',null,'lote cirurgico 03/08'),
    ('marca','NOVABUPI','BUPIVACAINA',null,'lote cirurgico 03/08'),
    ('marca','FRESOFLOX','CIPROFLOXACINO',null,'lote cirurgico 03/08'),
    ('marca','PARINEX','HEPARINA SODICA',null,'lote cirurgico 03/08'),
    ('marca','HEMOFOL','HEPARINA SODICA',null,'lote cirurgico 03/08'),
    ('marca','C-PLATIN','CISPLATINA',null,'lote onco 03/08'),
    ('marca','CITOPLAX','CISPLATINA',null,'lote onco 03/08'),
    ('marca','FAULDCISPLA','CISPLATINA',null,'lote onco 03/08'),
    ('marca','DOCELIBBS','DOCETAXEL',null,'lote onco 03/08'),
    ('marca','EVOXALI','OXALIPLATINA',null,'lote onco 03/08'),
    ('marca','EVOTAXEL','PACLITAXEL',null,'lote onco 03/08'),
    ('marca','TAXILAN','PACLITAXEL',null,'lote onco 03/08'),
    ('marca','MESO','PEMETREXEDE',null,'lote onco 03/08'),
    ('marca','LUMAZENIL','FLUMAZENIL','grafia diferente da do pedido (LUMAZENIL x FLUMAZENIL) — confira antes de fechar','lote cirurgico 03/08'),
    ('palavra','SUCTOR','SUCCAO',null,'lote D 03/08 — dreno suctor x dreno succao'),
    ('palavra','PERIDURAL','EPIDURAL',null,'lote D 03/08 — cateter/agulha peridural'),
    ('palavra','PERIDURAL','TUOHY','agulha Tuohy é a agulha peridural — confira o calibre','lote D 03/08')
  ) as v(tipo, de, para, aviso, origem)
 where not exists (
   select 1 from public.dicionario_marca_pa d
    where d.tipo = v.tipo and d.de = v.de and d.para = v.para);

notify pgrst, 'reload schema';
