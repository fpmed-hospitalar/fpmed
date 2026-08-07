-- ============================================================
-- FPMED — TABELA documentos (o gestor de documentos da empresa)
-- Módulo 2.6 da spec, 08/08/2026. Primeiro pedaço da plataforma de licitações.
--
-- O QUE É: certidões, atestados, contrato social, balanço — o que o edital exige na
-- HABILITAÇÃO. Cada um tem VALIDADE, e é a validade que decide se a empresa pode disputar.
--
-- >>> POR QUE ESTE FOI O PRIMEIRO DOS 14 MÓDULOS: certidão vencida é o jeito mais bobo de
--     perder licitação. A empresa fez tudo — achou o edital, montou o preço, foi à sessão — e
--     é desclassificada porque uma CND venceu há três dias. Não é falta de sistema, é falta de
--     alguém olhando um prazo. É exatamente o que software resolve bem.
--     E ele DESTRAVA outra coisa: o sino do funil já tinha o bloco "validade de documento"
--     registrado como impossível, "depende de Meus Documentos, que não existe". Agora existe.
--
-- >>> `dias_aviso` POR DOCUMENTO, e não um número fixo no sistema: certidão federal sai em
--     minutos, um alvará da vigilância pode levar semanas. Avisar os dois com a mesma
--     antecedência trata como iguais coisas que não são — e o aviso que chega tarde demais
--     para o alvará é o mesmo que chega cedo demais para a federal e vira ruído.
--
-- >>> O ARQUIVO fica no Storage do Supabase (bucket privado `documentos`), e aqui guarda-se só
--     o CAMINHO. Binário em coluna de tabela incha o backup diário e o PostgREST tem que
--     serializar em base64 a cada leitura — a lista de documentos ficaria lenta por causa de um
--     PDF que ninguém abriu.
--
-- >>> `empresa_id` desde o começo, mesmo com uma empresa só: a spec é multi-empresa e o modelo
--     daqui já é (o funil tem `empresa_id`). Acrescentar a coluna depois obrigaria a migrar
--     linhas já existentes e a adivinhar de quem era cada documento.
--
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.documentos (
  id            bigint generated always as identity primary key,
  empresa_id    bigint references public.empresas(id),

  nome          text not null,               -- "CND Federal", "Certidão FGTS", "Contrato Social"
  tipo          text,                        -- agrupador livre: fiscal | trabalhista | jurídico | técnico
  orgao_emissor text,
  numero        text,

  emissao       date,
  validade      date,                        -- NULL = não vence (contrato social, por exemplo)
  dias_aviso    integer not null default 30 check (dias_aviso >= 0 and dias_aviso <= 365),

  arquivo_path  text,                        -- caminho no bucket `documentos` (não o binário)
  arquivo_nome  text,                        -- o nome original, para o download sair legível
  arquivo_bytes bigint,

  observacoes   text,
  ativo         boolean not null default true,   -- documento substituído fica no histórico

  criado_em     timestamptz not null default now(),
  criado_por    uuid,
  atualizado_em timestamptz not null default now()
);

create index if not exists documentos_validade_idx on public.documentos (validade) where ativo;
create index if not exists documentos_empresa_idx  on public.documentos (empresa_id) where ativo;

-- ── A VISÃO QUE A TELA E O SINO CONSOMEM ─────────────────────────────────────
-- A conta de "quantos dias faltam" fica NO BANCO, num lugar só. Se cada tela calculasse por
-- conta própria, uma diria "vence em 5 dias" e a outra "vencido" no mesmo dia — e foi
-- exatamente esse tipo de divergência que custou caro neste projeto (o pack do preço unitário).
-- `security_invoker`: quem consulta usa as permissões dele, a view não vira porta lateral.
create or replace view public.v_documentos_situacao
  with (security_invoker = on) as
select d.*,
       (d.validade - current_date)                                   as dias_para_vencer,
       case
         when d.validade is null                                     then 'sem_validade'
         when d.validade <  current_date                             then 'vencido'
         when d.validade <= current_date + d.dias_aviso              then 'vencendo'
         else                                                             'ok'
       end                                                           as situacao
  from public.documentos d
 where d.ativo;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Documento de habilitação é documento da EMPRESA, não intel comercial: todo logado LÊ (o
-- vendedor precisa saber se a certidão está válida antes de montar a proposta). Escrever é
-- gestor — trocar uma certidão é ato de quem responde pela empresa.
alter table public.documentos enable row level security;

drop policy if exists doc_sel on public.documentos;
drop policy if exists doc_ins on public.documentos;
drop policy if exists doc_upd on public.documentos;
drop policy if exists doc_del on public.documentos;

create policy doc_sel on public.documentos for select to authenticated using (true);
create policy doc_ins on public.documentos for insert to authenticated with check (public.cargo_gestor());
create policy doc_upd on public.documentos for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy doc_del on public.documentos for delete to authenticated using (public.cargo_gestor());

revoke all on public.documentos from anon;
grant select on public.documentos to authenticated;
grant insert, update, delete on public.documentos to authenticated;
grant select on public.v_documentos_situacao to authenticated;
revoke all on public.v_documentos_situacao from anon;

notify pgrst, 'reload schema';
