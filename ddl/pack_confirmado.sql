-- ============================================================
-- FPMED — TABELA pack_confirmado (quantas unidades vêm na embalagem, por produto)
-- Item 6 da fila, 05/08/2026.
--
-- O PROBLEMA QUE ELA RESOLVE: 137 linhas do estoque próprio não dizem, no nome, quantas
-- unidades vêm na caixa. Sem isso o sistema não consegue unitarizar o preço, e a regra da
-- casa (medida em 05/08) manda mostrar "⚠ conferir emb." em vez de chutar um divisor. É a
-- resposta certa, mas é uma resposta que não avança: o item continua fora da comparação.
--
-- A FONTE: a `cmed_pf` tem a APRESENTAÇÃO OFICIAL da ANVISA de 25.702 medicamentos, já com
-- `qtd_apres` extraído ("CX 25 FA VD TRANS X 5 ML" -> 25). Se o nosso item casa com uma
-- apresentação de lá por princípio ativo + dose, o pack dela é o nosso.
--
-- >>> ELA NÃO ALTERA PREÇO. Nenhum valor de `cotacoes` é tocado. A tela lê o pack daqui e
--     divide SÓ NA EXIBIÇÃO — a mesma regra de 04/08. O banco continua guardando o preço
--     como veio do fornecedor, que é o único jeito de poder revisar a decisão depois.
--
-- `fonte` diz de onde veio o pack, e existe pra que uma revisão futura possa desfazer só o
-- que veio de uma origem específica sem tocar no resto:
--     'cmed'   — apresentação oficial da ANVISA (camada 1, esta carga)
--     'web'    — busca na internet (camada 2, ainda não construída)
--     'manual' — alguém da FPMED conferiu a caixa e digitou
-- `evidencia` guarda o texto que sustentou a decisão (a apresentação da CMED, o GGREM).
-- Sem isso, daqui a três meses ninguém sabe se o 100 veio de um dado oficial ou de um chute.
--
-- Loader: tools/resolve_pack_cmed.js   (preview por padrão; grava com --apply)
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.pack_confirmado (
  produto_norm  text primary key,     -- nome do produto normalizado (a chave que a tela usa)
  produto       text not null,        -- o nome como está no cadastro, pra leitura humana
  pack          integer not null check (pack > 1),   -- pack 1 não precisa de tabela
  fonte         text not null check (fonte in ('cmed','web','manual')),
  ggrem         text,                 -- quando fonte='cmed': a apresentação que sustentou
  evidencia     text,                 -- o texto da apresentação oficial
  confianca     text not null default 'alta' check (confianca in ('alta','media')),
  criado_em     timestamptz not null default now(),
  criado_por    text
);

create index if not exists pack_confirmado_fonte_idx on public.pack_confirmado (fonte);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Não é dado comercial: é "quantas ampolas vêm na caixa". Todo logado LÊ (as telas de
-- proposta e comparação precisam); escrever é só gestor, como em toda tabela de referência.
alter table public.pack_confirmado enable row level security;

drop policy if exists pkc_sel on public.pack_confirmado;
drop policy if exists pkc_ins on public.pack_confirmado;
drop policy if exists pkc_upd on public.pack_confirmado;
drop policy if exists pkc_del on public.pack_confirmado;

create policy pkc_sel on public.pack_confirmado for select to authenticated using (true);
create policy pkc_ins on public.pack_confirmado for insert to authenticated with check (public.cargo_gestor());
create policy pkc_upd on public.pack_confirmado for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy pkc_del on public.pack_confirmado for delete to authenticated using (public.cargo_gestor());

revoke all on public.pack_confirmado from anon;
grant select on public.pack_confirmado to authenticated;
grant insert, update, delete on public.pack_confirmado to authenticated;

notify pgrst, 'reload schema';
