-- ============================================================
-- FPMED — TABELA empresas (as razões sociais que disputam licitação)
-- Item 9 (funil de Negócios), 05/08/2026. Decisão do Lemuel.
--
-- O QUE É: o SIGA tem uma tela "Minhas Empresas" onde o cliente cadastra razão social + CNPJ,
-- e o badge da empresa aparece em cada card do funil. Aqui a decisão foi outra: **a empresa do
-- cliente já nasce cadastrada**. Ele não abre o sistema numa tela vazia pedindo pra "adicionar
-- sua empresa" — esse é trabalho que o fornecedor do software já tem como fazer, porque o dado
-- veio no cadastro dele.
--
-- >>> A FONTE DA VERDADE É O `cliente.config.js`, não esta tabela. O seeder
--     (tools/semeia_empresa.js) lê de lá e grava aqui. Por quê: o config é o único arquivo que
--     o cria_cliente escreve, então cliente novo do LIMEDTEC nasce com a empresa dele sem
--     ninguém lembrar de rodar nada. Se a verdade morasse só no banco, cada instalação nova
--     dependeria de alguém executar um insert à mão — e a que esquecesse abriria com o funil
--     mostrando card sem dono.
--
-- LISTA e não linha única de propósito: o molde pode ter cliente com 2 CNPJs (matriz e filial,
-- ou duas razões sociais disputando a mesma licitação). `principal` marca a que o funil mostra
-- por padrão. **Não há tela de gestão por enquanto** — é registro semeado, e só.
--
-- `cnpj_norm` é coluna GERADA (só dígitos) porque CNPJ chega escrito de N jeitos e a unicidade
-- tem que valer sobre o número, não sobre a pontuação. Sem ela, "47.110.418/0001-15" e
-- "47110418000115" entrariam como duas empresas diferentes.
--
-- Loader: tools/semeia_empresa.js   (preview por padrão; grava com --apply)
-- Seguro re-rodar.
-- ============================================================

create table if not exists public.empresas (
  id            bigint generated always as identity primary key,
  razao_social  text not null,
  cnpj          text not null,
  cnpj_norm     text generated always as (regexp_replace(coalesce(cnpj,''), '[^0-9]', '', 'g')) stored,
  ie            text,
  cidade        text,
  uf            text,
  principal     boolean not null default false,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

-- unicidade pelo NÚMERO do CNPJ, não pelo texto com pontuação
create unique index if not exists empresas_cnpj_uk on public.empresas (cnpj_norm);
-- no máximo UMA principal: sem isto, dois seeds distraídos deixariam o funil sem saber qual
-- empresa mostrar no badge, e a escolha viraria "a que o banco devolver primeiro".
create unique index if not exists empresas_uma_principal on public.empresas ((principal)) where principal;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- É a identidade da própria empresa do cliente: todo logado LÊ (o badge do funil precisa em
-- toda tela). Escrever é só gestor — trocar razão social ou CNPJ não é operação de rotina.
alter table public.empresas enable row level security;

drop policy if exists emp_sel on public.empresas;
drop policy if exists emp_ins on public.empresas;
drop policy if exists emp_upd on public.empresas;
drop policy if exists emp_del on public.empresas;

create policy emp_sel on public.empresas for select to authenticated using (true);
create policy emp_ins on public.empresas for insert to authenticated with check (public.cargo_gestor());
create policy emp_upd on public.empresas for update to authenticated using (public.cargo_gestor()) with check (public.cargo_gestor());
create policy emp_del on public.empresas for delete to authenticated using (public.cargo_gestor());

revoke all on public.empresas from anon;
grant select on public.empresas to authenticated;
grant insert, update, delete on public.empresas to authenticated;

notify pgrst, 'reload schema';
