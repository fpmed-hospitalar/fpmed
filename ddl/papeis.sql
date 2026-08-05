-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- LIMEDTEC — PAPEIS DE ACESSO.  RASCUNHO: conferir e rodar com o token, nao aplicado por script.
--
-- ORDEM DE CONFIANCA (e a razao deste arquivo existir antes da tela):
--   a RLS e a seguranca; a tela e cortesia.
-- Esconder o campo de custo no HTML nao impede ninguem de abrir o F12 e chamar
--   GET /rest/v1/cotacoes?select=compra_unit
-- com o proprio token de sessao. Enquanto isto aqui nao estiver no ar, "o vendedor nao ve custo"
-- e uma frase sobre a interface, nao sobre o sistema.
--
-- >>> NAO RODE PELA METADE. Ligar RLS sem as policies tranca TODO MUNDO — inclusive o gestor.
--     Rodar tudo de uma vez, numa transacao, e conferir com os 3 usuarios de teste depois.
-- ══════════════════════════════════════════════════════════════════════════════════════════════
begin;

-- ── 1. O PERFIL: quem e quem, dentro deste cliente ────────────────────────────────────────────
-- Ligado ao usuario do Supabase Auth (o mesmo que o gm-auth usa). Um perfil por usuario.
create table if not exists perfis (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  papel        text not null check (papel in ('vendedor','gerente','gestor_geral','dono_produto')),
  -- DESATIVAR, NUNCA APAGAR: o historico de quem fez cada cotacao tem que continuar de pe.
  -- Apagar usuario apaga a autoria de meses de proposta.
  ativo        boolean not null default true,
  -- toggles do gerente: {"ver_custo": false}. So o gerente e ajustavel; as chaves de gestor
  -- (gerir_usuarios, configurar, importar) sao ignoradas aqui de proposito — ver limedtec-papeis.js.
  -- Toggle nao promove: promover e trocar o papel, e trocar papel aparece na lista de gestores.
  permissoes   jsonb not null default '{}'::jsonb,
  criado_em    timestamptz not null default now(),
  criado_por   uuid references auth.users(id),
  atualizado_em timestamptz not null default now()
);
create index if not exists perfis_papel_idx on perfis(papel) where ativo;

-- ── 2. AS FUNCOES QUE AS POLICIES USAM ────────────────────────────────────────────────────────
-- security definer: a policy precisa LER a tabela perfis pra decidir, e o proprio usuario nao
-- tem permissao de ler perfis de outros. Sem isto, a policy se morde.
create or replace function limedtec_papel() returns text
  language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid() and ativo
$$;

create or replace function limedtec_pode(chave text) returns boolean
  language plpgsql stable security definer set search_path = public as $$
declare pf record; padrao boolean;
begin
  select papel, permissoes into pf from perfis where id = auth.uid() and ativo;
  -- SEM PAPEL = NEGADO. Nunca "true por omissao" — mesmo principio do banco() sem valor-padrao.
  if pf is null then return false; end if;
  padrao := case
    when pf.papel = 'gestor_geral' then true
    when pf.papel = 'gerente' then chave in ('cotar','gerar_documento','ver_custo','ver_paineis','cadastrar')
    when pf.papel = 'vendedor' then chave in ('cotar','gerar_documento')
    when pf.papel = 'dono_produto' then chave in ('ver_paineis')
    else false end;
  -- toggle so desce/sobe dentro do que o papel gerente ja alcanca; nunca promove
  if pf.papel = 'gerente'
     and chave not in ('gerir_usuarios','configurar','importar')
     and pf.permissoes ? chave then
    return (pf.permissoes ->> chave)::boolean;
  end if;
  return padrao;
end $$;

-- ── 3. A VIEW DO VENDEDOR — o padrao que a FPMED ja usa ───────────────────────────────────────
-- O vendedor NAO consulta `cotacoes`: consulta esta view, que simplesmente NAO TEM as colunas de
-- custo. Nao ha filtro pra contornar nem coluna pra pedir: ela nao existe no resultado.
create or replace view cotacoes_vendedor as
  select id, fornecedor, tipo, codigo, produto, principio_ativo, und, marca, fabricante,
         estoque, estoque_em, global_venda1, global_venda2, venda_unit_calculada,
         venda_caixa_calculada, ean, categoria_forn
  from cotacoes;
-- (de fora, de proposito: compra_unit, compra_caixa, preco_nf, desconto_forn, total_compra, markup)

-- ── 4. RLS ────────────────────────────────────────────────────────────────────────────────────
alter table perfis   enable row level security;
alter table cotacoes enable row level security;

-- perfis: cada um le o proprio; gestor le e escreve todos.
drop policy if exists perfis_le_o_proprio on perfis;
create policy perfis_le_o_proprio on perfis for select using (id = auth.uid());
drop policy if exists perfis_gestor_le on perfis;
create policy perfis_gestor_le on perfis for select using (limedtec_pode('gerir_usuarios'));
drop policy if exists perfis_gestor_escreve on perfis;
create policy perfis_gestor_escreve on perfis for all
  using (limedtec_pode('gerir_usuarios')) with check (limedtec_pode('gerir_usuarios'));

-- cotacoes: SO QUEM PODE VER CUSTO le a tabela crua. O vendedor usa a view.
-- >>> ESTA E A LINHA QUE FAZ A PROMESSA VIRAR SISTEMA — E ELA PRECISA SER **RESTRICTIVE**.
--
--     O banco JA TEM, hoje, a policy `auth_all` em cotacoes: cmd=ALL, PERMISSIVE, using(true).
--     Ou seja: qualquer usuario autenticado faz tudo. Policies permissivas se SOMAM com OR, entao
--     acrescentar `using (limedtec_pode('ver_custo'))` como permissiva daria
--         true  OR  pode_ver_custo   =   sempre true
--     e o vendedor continuaria lendo custo — com a policy nova instalada, o DDL "aplicado" e a
--     seguranca inexistente. Seria o pior resultado possivel: a aparencia de protecao.
--
--     RESTRICTIVE e AND: `true AND pode_ver_custo`. Sem precisar remover a auth_all, de que todo
--     o resto do sistema depende hoje.
drop policy if exists cotacoes_custo on cotacoes;
create policy cotacoes_custo on cotacoes as restrictive for select using (limedtec_pode('ver_custo'));
drop policy if exists cotacoes_escrita on cotacoes;
create policy cotacoes_escrita on cotacoes as restrictive for insert with check (limedtec_pode('cadastrar'));
drop policy if exists cotacoes_edicao on cotacoes;
create policy cotacoes_edicao on cotacoes as restrictive for update using (limedtec_pode('cadastrar'));

-- E POR ISSO A VIEW E OBRIGATORIA, nao um conforto: com a restrictive acima, o vendedor nao le
-- NADA de cotacoes — nem o nome do produto. Ele le `cotacoes_vendedor`, que por ser view roda com
-- os direitos do DONO (nao e security_invoker), logo atravessa a RLS da tabela — e simplesmente
-- nao tem as colunas de custo pra devolver.
-- >>> SE ALGUEM UM DIA MARCAR A VIEW COMO security_invoker, o vendedor perde o sistema inteiro.

grant select on cotacoes_vendedor to authenticated;

commit;

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- DEPOIS DE RODAR, CONFERIR COM OS 3 USUARIOS DE TESTE (tools/red_test_papeis.js):
--   vendedor  -> GET /rest/v1/cotacoes?select=compra_unit  deve vir VAZIO ou negado
--   vendedor  -> GET /rest/v1/cotacoes_vendedor            deve funcionar, sem coluna de custo
--   gerente   -> le custo; com toggle ver_custo=false, para de ler
--   gestor    -> le tudo e escreve em perfis
--   sem papel -> nao le nada
--   desativado-> nao le nada
-- E o PRIMEIRO usuario tem que ser criado a mao (gestor_geral), senao ninguem consegue criar
-- ninguem: a policy de escrita em perfis exige gerir_usuarios, que so o gestor tem.
--   insert into perfis (id, email, papel) values ('<uuid do auth.users>', '<email>', 'gestor_geral');
-- ══════════════════════════════════════════════════════════════════════════════════════════════
