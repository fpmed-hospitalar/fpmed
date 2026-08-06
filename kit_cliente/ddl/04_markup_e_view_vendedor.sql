-- ==============================================================================================
-- LIMEDTEC - INSTALACAO DE CLIENTE - 04 - MARKUP POR LINHA E A VIEW DO VENDEDOR
--
-- GERADO por tools/gera_ddl_instalacao.js a partir do schema REAL de um banco em producao.
-- NAO EDITE A MAO: regenere. Um DDL editado a mao deixa de descrever o banco no primeiro ALTER.
--
-- IDEMPOTENTE: rodar duas vezes nao quebra e nao apaga nada. Todo create e "if not exists" e todo
-- policy/trigger e precedido de "drop ... if exists" - que e o unico jeito de reaplicar sem erro.
-- NENHUM comando deste arquivo apaga tabela, coluna ou linha.
--
-- O VENDEDOR NAO CONSULTA cotacoes: consulta esta view, que simplesmente NAO TEM as colunas de
-- custo. Nao ha filtro pra contornar nem coluna pra pedir - ela nao existe no resultado.
--
-- >>> O MARKUP E COLUNA, NAO CONSTANTE, e a razao e aritmetica: com um markup fixo e publico
--     (ele esta no JavaScript da tela), quem recebesse a VENDA dividiria e chegaria no CUSTO.
--     Isso nao era vazamento de dado - nenhuma coluna de custo saia do banco - mas tambem nao era
--     proteccao, e chamar de proteccao era o pior dos mundos. Com a coluna, a view multiplica por
--     um numero que ela NAO publica.
-- >>> double precision e nao numeric, de proposito: a conta tem que ser a MESMA que o JavaScript
--     faz. Com numeric o Postgres arredonda diferente e a venda do vendedor passa a divergir da do
--     gestor em centavos - divergencia que este produto trata como bug grave.
-- >>> SE ALGUEM MARCAR A VIEW COMO security_invoker, o vendedor perde o sistema inteiro: a view
--     atravessa a RLS justamente por rodar com os direitos do dono.
-- ==============================================================================================

alter table cotacoes add column if not exists markup_venda double precision not null default 1.32;

create or replace view cotacoes_vendedor as
SELECT id,
    fornecedor,
    tipo,
    codigo,
    produto,
    principio_ativo,
    und,
    marca,
    fabricante,
    estoque,
    estoque_em,
    global_venda1,
    global_venda2,
    venda_unit_calculada,
    venda_caixa_calculada,
    ean,
    categoria_forn,
    vencimento,
    data,
    (compra_unit * markup_venda) AS venda_unit_forn,
    (compra_caixa * markup_venda) AS venda_caixa_forn
   FROM cotacoes;

grant select on cotacoes_vendedor to authenticated;
