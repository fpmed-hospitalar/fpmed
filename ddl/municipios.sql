-- ============================================================
-- FPMED — TABELA municipios (a base geográfica do Radar)
-- Módulo 2.5 da spec, 08/08/2026. Quarto dos 14.
--
-- O QUE É: os 5.570 municípios do Brasil com UM PONTO cada, para responder
-- "quais cidades num raio de N km daqui têm licitação aberta com este termo?".
--
-- >>> A FONTE É O IBGE, e isso importa: o nome do município vem da API de localidades e o ponto
--     vem da MALHA oficial (`/api/v3/malhas`), de onde o loader calcula o centroide. Não há
--     lista de coordenadas de terceiro no meio — cidade com coordenada errada mandaria o
--     vendedor para o lado errado do estado.
--
-- >>> `lat`/`lon` SÃO O CENTROIDE DA ÁREA, NÃO A SEDE. A diferença é real em município grande e
--     comprido, e a tela DIZ isso: para um raio de 100 km ela não muda nada; para um raio de
--     15 km em município extenso, muda. Chamar de "sede" o que é centroide seria vender uma
--     precisão que o dado não tem.
--
-- >>> `codigo_ibge` É A CHAVE, não o nome. "Bom Jesus" existe em 5 estados e há dezenas de
--     "Santa Luzia" — casar radar por nome faria a busca somar cidades de outro canto do país.
--
-- Loader: tools/carrega_municipios.js   (preview por padrão; grava com --apply)
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.municipios (
  codigo_ibge  integer primary key,
  nome         text not null,
  nome_norm    text not null,          -- sem acento e em minúsculas, para a busca casar "uruacu"
  uf           text not null,
  regiao       text,                   -- N / NE / CO / SE / S — o boletim agrupa por região
  lat          double precision,
  lon          double precision,
  atualizado_em timestamptz not null default now()
);

create index if not exists municipios_uf_idx   on public.municipios (uf);
create index if not exists municipios_norm_idx on public.municipios (nome_norm);
-- o radar filtra por caixa de latitude/longitude ANTES de calcular distância (ver o loader):
-- varrer 5.570 pontos com trigonometria a cada busca é caro à toa.
create index if not exists municipios_geo_idx  on public.municipios (lat, lon);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Dado PÚBLICO do IBGE: nenhuma informação da empresa. Todo logado lê; ninguém escreve pela API
-- (quem carrega é o loader com a service_role). Ausência de policy de escrita = negado.
alter table public.municipios enable row level security;

drop policy if exists mun_sel on public.municipios;
create policy mun_sel on public.municipios for select to authenticated using (true);

revoke all on public.municipios from anon;
grant select on public.municipios to authenticated;

notify pgrst, 'reload schema';
