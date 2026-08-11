-- ============================================================================================
-- ddl/negocio_anexos.sql — 11/08/2026 · ANEXO TIPADO E VERSIONADO no negocio.
--
-- ══ ESTA E A FUNDACAO DE DOIS PEDIDOS, E POR ISSO ELA NASCE INTEIRA ═════════════════════════
-- Dois itens da fila precisam da mesma coisa: guardar arquivo no negocio, com CATEGORIA, com
-- QUEM subiu e QUANDO, e EMPILHANDO versoes em vez de sobrescrever.
--   · "Proposta anexada + comparativo PMVG"  usa a categoria `proposta`;
--   · "Gerenciamento de Ata"                 usa as outras seis.
-- Construir isso dentro do primeiro e "estender" no segundo e como nascem dois jeitos de anexar
-- no mesmo sistema — e ai um deles esquece de gravar quem subiu, ou sobrescreve. Entao as SETE
-- categorias entram agora, de uma vez, mesmo que so uma seja usada hoje.
--
-- ══ VERSAO SAI DE TRIGGER, NAO DA TELA ══════════════════════════════════════════════════════
-- "Nunca sobrescrever" nao e uma promessa que a tela cumpre: e um numero que o banco calcula.
-- Se a tela mandasse `versao`, duas abas abertas mandariam `2` ao mesmo tempo e uma das duas
-- versoes viraria a outra. Aqui a trigger le o maior que existe pra aquele (negocio, categoria)
-- e soma 1, dentro da mesma transacao do insert.
--
-- ══ E NAO HA DELETE ═════════════════════════════════════════════════════════════════════════
-- Sem policy, a RLS nega. Mandou o arquivo errado? Manda o certo — ele vira a versao mais nova,
-- e a errada continua la, visivelmente mais velha. Isso e o que "empilha" quer dizer. Apagar o
-- anexo de uma ata assinada seria apagar a prova de um contrato.
--
-- O BUCKET E O `documentos`, QUE JA EXISTE (privado, com policies proprias). Bucket novo exigiria
-- um segundo conjunto de policies de storage dizendo a mesma coisa — e dois lugares pra errar
-- quem pode subir arquivo.
--
-- ADITIVO. Roda 2x.
-- ============================================================================================

create table if not exists public.negocio_anexos (
  id            bigserial primary key,
  negocio_id    bigint not null references public.negocios(id) on delete cascade,
  -- AS SETE CATEGORIAS. `proposta` e a do comparativo PMVG; as outras seis sao as que o Lemuel
  -- nomeou pro Gerenciamento de Ata. Categoria livre viraria "ata", "Ata", "ATA da sessao" e
  -- "ata sessão" na mesma lista, e o agrupamento por tipo — que e o pedido — deixaria de existir.
  categoria     text not null check (categoria in (
                  'proposta',        -- proposta enviada/ajustada (a que se confere contra o PMVG)
                  'ata',             -- ata de registro de precos
                  'contrato',
                  'proposta_final',
                  'ata_sessao',      -- a ata da sessao do pregao
                  'itens_ganhos',
                  'retorno_precos')),
  arquivo_path  text not null,       -- caminho no bucket `documentos`
  arquivo_nome  text not null,       -- o nome que a pessoa viu no computador dela
  bytes         bigint,
  -- VERSAO por (negocio, categoria). Calculada por trigger — ver o porque no topo.
  versao        int not null default 1,
  obs           text,
  enviado_por   text,
  enviado_em    timestamptz not null default now()
);

create index if not exists negocio_anexos_por_negocio
  on public.negocio_anexos (negocio_id, categoria, versao desc);

comment on table public.negocio_anexos is
  'Arquivos anexados a um negocio, por CATEGORIA e com VERSAO. Versoes empilham: nunca se '
  'sobrescreve e nao ha DELETE. O arquivo em si vive no bucket privado `documentos`.';

create or replace function public.anexo_versao() returns trigger
language plpgsql as $$
begin
  select coalesce(max(a.versao), 0) + 1 into new.versao
    from public.negocio_anexos a
   where a.negocio_id = new.negocio_id and a.categoria = new.categoria;
  return new;
end $$;

drop trigger if exists anexo_versao_t on public.negocio_anexos;
create trigger anexo_versao_t before insert on public.negocio_anexos
  for each row execute function public.anexo_versao();

-- ============================================================================================
-- A CONFERENCIA DA PROPOSTA CONTRA O TETO — o resultado, registrado.
--
-- ══ POR QUE UMA TABELA, E NAO UMA COLUNA EM `negocios` ══════════════════════════════════════
-- O pedido foi "o resultado da ULTIMA conferencia fica registrado no negocio". Uma coluna
-- guardaria a ultima e apagaria a anterior a cada nova conferencia — e a pergunta que aparece
-- depois ("a gente ja tinha conferido antes de mandar?") ficaria sem resposta. Numa tabela, a
-- ultima e so a mais nova, e as anteriores continuam la. Custa uma linha por conferencia.
--
-- ══ A VIGENCIA DA CMED E GRAVADA JUNTO, E ISSO NAO E REDUNDANTE ═════════════════════════════
-- A regua muda todo mes. Um resultado guardado sem a data da regua que o produziu e um numero
-- sem prazo de validade: daqui a dois meses ele continua parecendo verdadeiro, e o teto ja mudou.
-- Guardar a data da epoca e o que permite dizer "isto foi conferido contra a CMED de 21/07".
-- ============================================================================================

create table if not exists public.negocio_conferencias (
  id             bigserial primary key,
  negocio_id     bigint not null references public.negocios(id) on delete cascade,
  -- Qual anexo foi conferido. Pode ser null quando a conferencia veio de texto colado.
  anexo_id       bigint references public.negocio_anexos(id) on delete set null,
  itens          int not null default 0,
  dentro         int not null default 0,
  acima          int not null default 0,
  nao_encontrados int not null default 0,
  sem_preco      int not null default 0,
  -- O PIOR CASO, e nao a media. Media de "quanto acima do teto" esconde o item que estoura em
  -- 300% no meio de 40 que estao dentro — e e esse item que desclassifica a proposta inteira.
  pior_pct       numeric,
  cmed_vigente_desde date,
  detalhe        jsonb,
  quem           text,
  quando         timestamptz not null default now()
);

create index if not exists negocio_conferencias_por_negocio
  on public.negocio_conferencias (negocio_id, quando desc);

comment on table public.negocio_conferencias is
  'Resultado de cada conferencia de proposta contra o teto CMED. A ULTIMA e a mais nova; as '
  'anteriores nao se apagam. `cmed_vigente_desde` guarda QUAL regua produziu aquele resultado.';

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
alter table public.negocio_anexos enable row level security;
alter table public.negocio_conferencias enable row level security;

drop policy if exists anex_sel on public.negocio_anexos;
drop policy if exists anex_ins on public.negocio_anexos;
create policy anex_sel on public.negocio_anexos for select to authenticated using (true);
create policy anex_ins on public.negocio_anexos for insert to authenticated with check (true);
-- SEM update e SEM delete: versao que se edita nao e versao, e anexo que se apaga nao e prova.

drop policy if exists conf_sel on public.negocio_conferencias;
drop policy if exists conf_ins on public.negocio_conferencias;
create policy conf_sel on public.negocio_conferencias for select to authenticated using (true);
create policy conf_ins on public.negocio_conferencias for insert to authenticated with check (true);

revoke all on public.negocio_anexos from anon;
revoke all on public.negocio_conferencias from anon;
grant select, insert on public.negocio_anexos to authenticated;
grant select, insert on public.negocio_conferencias to authenticated;
grant usage, select on sequence public.negocio_anexos_id_seq to authenticated;
grant usage, select on sequence public.negocio_conferencias_id_seq to authenticated;

notify pgrst, 'reload schema';
