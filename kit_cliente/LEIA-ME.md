# KIT DE INSTALACAO LIMEDTEC

Tudo que uma instalacao nova precisa, num lugar so. Feito na pasta da **GlobalMed** (a fabrica) e
lido pela sessao do **cliente** (quem instala).

> **ESTA PASTA E DE LEITURA PRA QUEM INSTALA.** Nada aqui escreve na pasta de cliente nenhum. A
> regra da casa e **um escritor por pasta**, e ela nasceu do dia em que duas sessoes commitaram
> uma por cima da outra no mesmo repositorio. Quem instala roda os comandos; a fabrica so entrega.

## O QUE TEM AQUI

| arquivo | o que e |
|---|---|
| `ROTEIRO_INSTALACAO.md` | **comece por aqui.** Passo a passo na ordem certa, comando exato, **de qual pasta ele roda** e criterio de verde |
| `PERGUNTAS_FREQUENTES.md` | **travou? venha pra ca.** Os tropecos que ja aconteceram de verdade, cada um com sintoma e conserto |
| `cliente.config.EXEMPLO.js` | o config comentado campo a campo, com `>>> PREENCHER` no que falta |
| `MOLDE.txt` | a lista dos arquivos que um cliente novo recebe (gerada da lista viva) |
| `ddl/01..06_*.sql` | o banco inteiro, em ordem, idempotente |

E dois comandos que vivem em `tools/`:

| comando | o que faz |
|---|---|
| `node tools/verifica_instalacao.js <pasta>` | o **checklist de PRONTO**, item a item, com o conserto de cada `X` |
| `node tools/gera_ddl_instalacao.js` | **regera** o `ddl/` a partir do schema real (rode depois de qualquer mudanca de banco) |

> **DUAS PASTAS, E CONFUNDI-LAS E O ERRO MAIS CARO.** A **fabrica** e o repositorio de origem
> (`tools/`, `tests/`, este kit). O **cliente** e a pasta nova, que recebe so o `MOLDE.txt`. Ela
> **nao** recebe `tests/` nem a maior parte de `tools/` — entao os comandos de verificacao rodam
> **da fabrica, apontando pro cliente** com `LIMEDTEC_RAIZ`. O roteiro marca isso passo a passo, e
> todo comando que escreve imprime, na primeira linha, **em que pasta e em que banco** vai mexer.

## O QUE **NAO** TEM AQUI, E ISSO E O PONTO

Nenhum dado comercial. Nem um preco, nem um cliente, nem um fornecedor, nem uma cotacao, nem um
estoque. O `ddl/` foi **gerado do `information_schema`** — estrutura, nao conteudo.

A **unica** excecao e declarada e cabe em duas linhas: as 20 linhas do `dicionario_marca_pa`
(marca ↔ principio ativo) e a estrutura da CMED. "DIPIRONA e o principio ativo do NOVALGINA" e
verdade em qualquer distribuidora do pais, e a CMED e tabela publica do governo. Isso e
**conhecimento do produto**, nao dado de empresa.

Quem cobra isso nao e este paragrafo: e o `tests/testa_kit.js`, que roda a cada `run_all` e
procura preco, CNPJ, e-mail e nome de fornecedor dentro do kit. Documento nao roda.

## POR QUE O DDL E GERADO E NAO ESCRITO A MAO

O `tools/cria_cliente.js` rascunhava cada tabela como `id uuid + -- as colunas: ver --schema`.
Isso e um lembrete, nao um DDL: quem instalava tinha que descobrir 300 colunas na mao.

E um DDL escrito a mao envelhece no primeiro `ALTER TABLE` — o arquivo passa a descrever um banco
que nao existe mais, o que e **pior** que nao ter arquivo, porque parece confiavel. Aqui a fonte e
o banco que esta rodando: regerou hoje, e o de hoje.
