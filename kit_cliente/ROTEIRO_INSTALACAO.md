# ROTEIRO DE INSTALACAO — LIMEDTEC, CLIENTE NOVO

Passo a passo na ordem certa, com o **comando exato** e o **criterio de verde** de cada passo.
Feito pro cliente **002 (FPMED)**, mas serve pra qualquer um: o que muda entre clientes e o
`cliente.config.js` e o banco.

> **QUEM RODA CADA COISA.** Os comandos de arquivo rodam **na pasta do cliente**. Os `.sql` rodam
> **no banco do cliente**, por quem tem o token dele. Nada aqui escreve na pasta de outro cliente:
> a regra da casa e **um escritor por pasta**, e ela nasceu do dia em que duas sessoes commitaram
> uma por cima da outra.

> **A ORDEM NAO E SUGESTAO.** O passo 3 (DDL) depende do 2 (config, que diz QUAL banco), o 5
> (suites) depende do 3, e o 7 (provas com gente de verdade) depende de tudo. Pular a ordem
> produz o pior modo de falha deste sistema: o que parece que funcionou.

---

## 0. ANTES DE COMECAR — o que precisa existir

| item | onde consegue |
|---|---|
| projeto Supabase proprio do cliente | painel do Supabase, projeto novo |
| a URL e a chave **anon** dele | Settings > API |
| um **token de management** (`sbp_...`) | Account > Access Tokens — temporario, revogar depois |
| o e-mail do **primeiro gestor** | quem vai administrar o sistema no cliente |

> **A `service_role` NAO entra em lugar nenhum deste roteiro** a nao ser em `segredos.local.txt`,
> que e gitignore. Ela ignora a RLS: uma chave dessas dentro do `cliente.config.js` vai inteira
> pro navegador de todo mundo que abrir o sistema.

---

## 1. COPIAR O MOLDE

```
node tools/cria_cliente.js --destino <pasta do cliente> --id 002 --nome FPMED
```

Sem `--destino` ele so imprime a previa e **nao escreve nada** — use pra conferir primeiro.

**Verde:** a pasta do cliente tem os arquivos listados em `kit_cliente/MOLDE.txt` (hoje 33).
Nenhum arquivo de dado (`.json` de import, `.csv`, `.xlsx`) foi junto — a lista e **explicita**
justamente pra isso.

---

## 2. O CONFIG DO CLIENTE

Copie `kit_cliente/cliente.config.EXEMPLO.js` para a pasta do cliente como `cliente.config.js` e
preencha **tudo** que estiver marcado `>>> PREENCHER`. O arquivo esta comentado campo a campo.

**Verde:**
```
node --check cliente.config.js
```
e, principalmente: **nenhum `PREENCHER` sobrou**. O passo 8 cobra isso item a item.

> **O erro desta etapa que nao da erro nenhum:** deixar a URL do banco de OUTRO cliente. O sistema
> abre, funciona, e mostra o dado da outra empresa. Nao ha mensagem de falha — por isso o
> verificador tem um item so pra isso, e ele e um dos marcados com `***`.

---

## 3. O DDL, NA ORDEM NUMERADA

Rodar **em ordem**, no SQL Editor do banco do cliente (ou pela API de management com o token).
Todos sao **idempotentes**: rodar de novo nao quebra e nao apaga nada.

| arquivo | o que faz | por que nesta posicao |
|---|---|---|
| `ddl/01_conhecimento_do_produto.sql` | dicionario marca↔PA + estrutura da CMED | e conhecimento do produto, nao dado de cliente — pode viajar |
| `ddl/02_operacao.sql` | as 17 tabelas da operacao, **vazias**, com indices e constraints | tudo depende delas |
| `ddl/03_perfis_e_papeis.sql` | `perfis`, `limedtec_pode()`, `limedtec_papel()`, trava do ultimo gestor | as policies do 05 chamam estas funcoes |
| `ddl/04_markup_e_view_vendedor.sql` | coluna `markup_venda` + view `cotacoes_vendedor` | precisa da tabela `cotacoes` do 02 |
| `ddl/05_rls_e_policies.sql` | liga a RLS e cria as policies | **por ultimo**: ligar RLS sem policy tranca todo mundo |
| `ddl/06_central_saude.sql` | a view agregada que o cliente publica pra LIMEDTEC Central | opcional, e decisao do cliente |

**Verde:** os seis rodam sem erro. E, rodando **de novo**, continuam rodando sem erro — e assim
que se prova idempotencia, nao lendo o codigo.

> **NAO RODE O 05 PELA METADE.** Ele e uma transacao so de proposito. Ligar RLS sem as policies
> tranca **todo mundo**, inclusive o gestor, e a saida e acesso direto ao banco.

> **RESTRICTIVE e "E", PERMISSIVE e "OU".** A policy que impede o vendedor de ler custo **tem** que
> ser RESTRICTIVE. Como PERMISSIVA ela se somaria com a `auth_all` existente (`true OR pode` =
> sempre true) e viraria decoracao: DDL aplicado, seguranca zero, com aparencia de protecao.

### 3.1 A CARGA DA CMED (opcional, mas e o que faz a busca acertar)

Sao ~25 mil linhas — por isso vai por script e nao por SQL.

```
node tools/carrega_cmed_pf.js
```

**Verde:** `select count(*) from cmed_pf` devolve dezenas de milhares. Sem ela o sistema funciona,
mas o motor perde o de-para de marca↔principio ativo da CMED.

---

## 4. O PRIMEIRO GESTOR

1. criar o usuario no painel do Supabase (**Authentication > Users**), com e-mail confirmado;
2. copiar o `uuid` dele;
3. rodar o `insert` comentado no fim de `ddl/03_perfis_e_papeis.sql`, com o uuid e o e-mail.

**Verde:** `select papel from perfis where email='...'` devolve `gestor_geral`.

> **SEM ESTE PASSO NINGUEM CONSEGUE CADASTRAR NINGUEM.** A policy de escrita em `perfis` exige
> `gerir_usuarios`, e so o gestor tem. O primeiro tem que entrar a mao — e a partir dai a tela
> `limedtec-usuarios.html` resolve o resto.

---

## 5. O MANIFEST DO APLICATIVO

```
node tools/gera_manifest.js
```

Ele **deriva** o `manifest.webmanifest` do `cliente.config.js`.

**Verde:** o `short_name` do manifest e o `nome` do config. Isso nao e detalhe: e o texto embaixo
do icone na area de trabalho, e dois clientes na mesma maquina com o mesmo `short_name` ficam
indistinguiveis.

---

## 6. AS SUITES

```
node tests/run_all.js
```

**Verde:** `>>> TUDO VERDE`, zero falha.

As que mais importam nesta etapa:
- `testa_produtizacao` — a catraca: **nenhuma tela com a URL ou a chave do banco escrita na mao**;
- `testa_compliance` — **so um projeto Supabase referenciado** na pasta;
- `testa_papeis` — a matriz papel × permissao, e **o que cada papel ve no portal**;
- `testa_pwa` — toda tela do portal na casca do service worker (senao nao abre offline);
- `testa_endereco_unico` — os 4 documentos imprimem o **mesmo** endereco.

---

## 7. AS PROVAS COM GENTE DE VERDADE

A suite prova que a **tela** decide certo. O que separa "o vendedor nao ve o botao" de "o vendedor
**nao consegue**" e a RLS — e isso so se testa contra o banco, com login de verdade.

```
set SBP=sbp_...
node tools/red_test_papeis.js
```

Ele cria 3 usuarios de teste (um por papel), roda a matriz por REST com o **token de cada um** e
**apaga os 3 no fim**.

**Verde:** todos os asserts ok. Os que valem por todos:
- vendedor **nao le** `compra_unit` por REST direto;
- **mas le** `cotacoes_vendedor` — o sistema dele funciona;
- e a view **nao tem** a coluna de custo pra pedir;
- usuario **sem perfil** nao le nada (nunca acesso total por omissao);
- **desativado** nao le nada, nem sendo gestor.

> **ATENCAO ao rodar num banco recem-instalado:** tabela vazia devolve "0 linhas" pra todo mundo, e
> isso **nao prova nada**. A prova de que a RLS separa so vem depois da primeira carga de dado.

E no navegador, uma vez com cada papel:
- o portal mostra **so** os cards que o papel alcanca (vendedor: so a Cotacao);
- a Cotacao abre, a **busca** devolve resultado, e o **PDF** sai;
- pro vendedor, nenhuma linha carregada tem `compra_unit` (confira no console: `'compra_unit' in cotacoes[0]`).

---

## 8. O BACKUP AGENDADO

Copie `tools/limedtec_backup.cmd` e agende no Agendador de Tarefas do Windows (03:30).

**Verde:** `schtasks /query /fo LIST | findstr /i limedtec` acha a tarefa, e ela **dispara** quando
executada a mao. Backup agendado que ninguem viu disparar e um backup que nao existe.

---

## 9. O VEREDITO — a prova objetiva de "terminou"

```
set SBP=sbp_...
node tools/verifica_instalacao.js <pasta do cliente>
```

Ele responde o checklist inteiro, **item a item**, com o conserto na linha de baixo de cada `X`.

**Verde:** `>>> PRONTO. Todos os itens verdes.`

> **"NAO CONFERIDO" NAO E VERDE.** Sem o token, os itens de banco saem como `?` e o placar diz
> isso na cara. Verificador que chuta verde e pior que verificador nenhum: ele transforma "nao
> sei" em "pode entregar".

---

## O QUE ESTE ROTEIRO **NAO** RESOLVE, e e honesto dizer

1. **A carga inicial de dado do cliente** (tabela de fornecedor, catalogo, clientes). Isso e
   trabalho de import, com os scripts de `tools/importa_*.js`, e cada fornecedor tem o seu formato.
2. **A tabela `comissoes_isadora`** viaja com o nome de uma pessoa da GlobalMed. Renomear e DDL +
   mexer na tela que a le. Esta registrado como decisao pendente — nao e esquecimento.
3. **A `limedtec-central.html`** nao entra no molde de proposito: e o painel do **dono do produto**,
   nao do cliente. Cliente nenhum recebe.
