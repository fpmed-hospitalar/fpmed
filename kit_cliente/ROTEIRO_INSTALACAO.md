# ROTEIRO DE INSTALACAO — LIMEDTEC, CLIENTE NOVO

Passo a passo na ordem certa, com o **comando exato**, **de qual pasta ele roda** e o
**criterio de verde** de cada passo. Feito pro cliente **002 (FPMED)**, mas serve pra qualquer um:
o que muda entre clientes e o `cliente.config.js` e o banco.

> **DE QUAL PASTA CADA COMANDO RODA — leia isto antes de tudo.**
> Existem **duas pastas** nesta historia e confundi-las e o erro mais caro do roteiro:
>
> | | o que e | exemplo |
> |---|---|---|
> | **FABRICA** | o repositorio de origem, onde moram `tools/`, `tests/` e o `kit_cliente/` | `C:\globalmed` |
> | **CLIENTE** | a pasta nova, que recebe so os arquivos do `MOLDE.txt` | `C:\limedtec-002` |
>
> A pasta do cliente **nao recebe** `tests/` nem a maior parte de `tools/`. Entao os comandos de
> verificacao rodam **da fabrica, apontando pro cliente** — e o jeito de apontar e a variavel
> `LIMEDTEC_RAIZ` (ou o argumento, quando o comando tem um). Cada passo abaixo diz qual e qual.
>
> **Windows:** `set LIMEDTEC_RAIZ=C:/limedtec-002` (use barra normal; `set` vale so naquele
> terminal). **Nao esqueca de conferir a linha que o proprio comando imprime** dizendo em que
> pasta/banco ele esta mexendo — todos os que escrevem imprimem.

> **UM ESCRITOR POR PASTA.** Quem instala escreve **so** na pasta do cliente. A fabrica e mexida
> por quem cuida do produto. A regra nasceu do dia em que duas sessoes commitaram uma por cima da
> outra.

> **A ORDEM NAO E SUGESTAO.** O passo 3 (DDL) depende do 2 (config, que diz QUAL banco), o 6
> (suites) depende do 3, e o 7 (provas com gente de verdade) depende de tudo. Pular a ordem produz
> o pior modo de falha deste sistema: o que parece que funcionou.

Travou em algum passo? **`PERGUNTAS_FREQUENTES.md`**, ao lado deste arquivo, tem os tropecos ja
vistos numa instalacao de verdade, cada um com o **sintoma** e o **conserto**.

---

## 0. ANTES DE COMECAR — o que precisa existir

| item | onde consegue |
|---|---|
| **Node.js 18+** na maquina que instala | `node -v` tem que responder. As ferramentas usam `fetch` nativo, que so existe do 18 pra cima |
| projeto Supabase proprio do cliente | painel do Supabase, projeto novo |
| a URL e a chave **anon** dele | Settings > API |
| um **token de management** (`sbp_...`) | Account > Access Tokens — temporario, revogar depois |
| a **service_role** do projeto do cliente | Settings > API — vai **so** no `segredos.local.txt` da pasta dele |
| o e-mail do **primeiro gestor** | quem vai administrar o sistema no cliente |
| razao social, CNPJ, endereco, telefone, PIX | do cliente — e o cabecalho de todo documento |
| a equipe (e-mail -> nome) | sem ela os campos de vendedora nascem sem opcao |

> **A `service_role` NAO entra no `cliente.config.js`.** Ela ignora a RLS: uma chave dessas no
> config vai inteira pro navegador de todo mundo que abrir o sistema. O lugar dela e
> `<pasta do cliente>/segredos.local.txt`, que e gitignore — e e de la que o backup e a carga da
> CMED a leem.

---

## 1. COPIAR O MOLDE   *(roda na FABRICA)*

```
node tools/cria_cliente.js --destino C:/limedtec-002 --id 002 --nome FPMED
```

Sem `--destino` ele so imprime a previa e **nao escreve nada** — use pra conferir primeiro.

**Verde:** a pasta do cliente tem **todos** os arquivos listados em `kit_cliente/MOLDE.txt` (o
proprio arquivo diz quantos sao; o numero muda quando o produto cresce, e por isso nao esta
escrito aqui). Nenhum arquivo de dado (`.json` de import, `.csv`, `.xlsx`) foi junto — a lista e
**explicita** justamente pra isso.

---

## 2. O CONFIG DO CLIENTE   *(pasta do CLIENTE)*

Copie `kit_cliente/cliente.config.EXEMPLO.js` para a pasta do cliente como `cliente.config.js` e
preencha **tudo** que estiver marcado `>>> PREENCHER`. O arquivo esta comentado campo a campo.

Crie tambem `<pasta do cliente>/segredos.local.txt` com a `service_role` do projeto **dele**, no
mesmo formato do arquivo da fabrica (a linha precisa conter a palavra `service_role` antes da
chave — e assim que os scripts a acham).

**Verde:**
```
node --check cliente.config.js
```
e, principalmente: **nenhum `PREENCHER` sobrou**. O passo 9 cobra isso item a item.

> **O erro desta etapa que nao da erro nenhum:** deixar a URL do banco de OUTRO cliente. O sistema
> abre, funciona, e mostra o dado da outra empresa. Nao ha mensagem de falha — por isso o
> verificador tem um item so pra isso, e ele e um dos marcados com `***`.

---

## 3. O DDL, NA ORDEM NUMERADA   *(no banco do CLIENTE)*

Rodar **em ordem**, no SQL Editor do banco do cliente (ou pela API de management com o token).
Todos sao **idempotentes**: rodar de novo nao quebra e nao apaga nada.

| arquivo | o que faz | por que nesta posicao |
|---|---|---|
| `ddl/01_conhecimento_do_produto.sql` | dicionario marca↔PA + estrutura da CMED | e conhecimento do produto, nao dado de cliente — pode viajar |
| `ddl/02_operacao.sql` | as tabelas da operacao, **vazias**, com indices e constraints | tudo depende delas |
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

### 3.1 A CARGA DA CMED (opcional, mas e o que faz a busca acertar)   *(FABRICA, apontando pro cliente)*

Sao ~25 mil linhas — por isso vai por script e nao por SQL. Voce precisa da planilha da CMED
(`.xlsx` publicada pelo governo); ela **nao** vem no kit.

```
set LIMEDTEC_RAIZ=C:/limedtec-002
node tools/carrega_cmed_pf.js <caminho da planilha .xlsx> --apply
```

**Verde:** a **primeira linha da saida** diz `destino da carga: https://<o projeto do cliente>` —
confira **antes** de deixar rodar. Depois, `select count(*) from cmed_pf` no banco do cliente
devolve dezenas de milhares.

> Sem `LIMEDTEC_RAIZ` ele carrega na pasta padrao (a fabrica) e voce termina com o banco do cliente
> vazio e a impressao de que deu certo. Por isso a linha de destino e impressa.

---

## 4. O PRIMEIRO GESTOR   *(painel do Supabase + banco do CLIENTE)*

1. criar o usuario no painel do Supabase (**Authentication > Users**), com **e-mail confirmado**;
2. copiar o `uuid` dele;
3. rodar o `insert` comentado no fim de `ddl/03_perfis_e_papeis.sql`, com o uuid e o e-mail.

**Verde:** `select papel from perfis where email='...'` devolve `gestor_geral`.

> **SEM ESTE PASSO NINGUEM CONSEGUE CADASTRAR NINGUEM.** A policy de escrita em `perfis` exige
> `gerir_usuarios`, e so o gestor tem. O primeiro tem que entrar a mao — e a partir dai a tela
> `limedtec-usuarios.html` resolve o resto.

---

## 5. O MANIFEST DO APLICATIVO   *(FABRICA, apontando pro cliente)*

```
set LIMEDTEC_RAIZ=C:/limedtec-002
node tools/gera_manifest.js
```

Ele **deriva** o `manifest.webmanifest` do `cliente.config.js` daquela pasta.

**Verde:** o `short_name` do manifest e o `nome` do config **do cliente**. Isso nao e detalhe: e o
texto embaixo do icone na area de trabalho, e dois clientes na mesma maquina com o mesmo
`short_name` ficam indistinguiveis.

Troque tambem os 3 PNG de `icones/` pela logo do cliente (`tools/gera_icones.js` gera o
placeholder). O icone que sobra e o da empresa anterior.

---

## 6. AS SUITES   *(FABRICA)*

```
node tests/run_all.js
```

**Verde:** `>>> TUDO VERDE`, zero falha.

> **O QUE ELAS PROVAM E O QUE NAO PROVAM.** As suites vivem na fabrica e testam **o produto** — o
> codigo que acabou de ser copiado. Elas **nao** olham a pasta do cliente nem o banco dele: quem
> faz isso e o passo 7 (banco) e o passo 9 (pasta). Rodar as suites e a garantia de que voce
> copiou um produto sao, nao de que a instalacao ficou certa.

As que mais importam nesta etapa:
- `testa_kit` — o kit nao carrega dado comercial, e o `MOLDE.txt` bate com a lista viva;
- `testa_produtizacao` — a catraca: **nenhuma tela com a URL ou a chave do banco escrita na mao**;
- `testa_compliance` — **so um projeto Supabase referenciado** na pasta;
- `testa_papeis` — a matriz papel × permissao, e **o que cada papel ve no portal**;
- `testa_pwa` — toda tela do portal na casca do service worker (senao nao abre offline);
- `testa_endereco_unico` — os 4 documentos imprimem o **mesmo** endereco.

---

## 7. AS PROVAS COM GENTE DE VERDADE   *(FABRICA, apontando pro banco do CLIENTE)*

A suite prova que a **tela** decide certo. O que separa "o vendedor nao ve o botao" de "o vendedor
**nao consegue**" e a RLS — e isso so se testa contra o banco, com login de verdade.

```
set LIMEDTEC_RAIZ=C:/limedtec-002
set SBP=sbp_...
node tools/red_test_papeis.js
```

Ele cria 3 usuarios de teste (um por papel), roda a matriz por REST com o **token de cada um** e
**apaga os 3 no fim**.

> **CONFIRA A PRIMEIRA LINHA DA SAIDA.** Ela diz `instalacao sob teste: <pasta> · projeto: <ref>`.
> Este comando **cria e apaga usuarios** — no banco errado, ele mexe na base de producao de outra
> empresa e ainda passa, porque aquele banco esta certo. Ler essa linha e o passo, nao um detalhe.

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

## 8. O BACKUP AGENDADO   *(pasta do CLIENTE)*

O backup **vem no molde** e se localiza sozinho: `tools/limedtec_backup.cmd` descobre a raiz a
partir da propria pasta, entao a copia que esta no cliente faz backup **do cliente**. Nao ha
caminho pra editar.

1. rodar **uma vez a mao**, da pasta do cliente:
   ```
   tools\limedtec_backup.cmd
   ```
2. agendar no Agendador de Tarefas do Windows (03:30), apontando pro **mesmo caminho**.

**Verde:** o arquivo `backups\_backup_agendado.log` termina com `>>> completo: N tabelas.` e
`saida=0`, e existe uma pasta `backups\backup_<data>_<hora>\` com os `.json` e o `_resumo.json`
dizendo `"completo": true`. Depois: `schtasks /query /fo LIST | findstr /i limedtec` acha a tarefa,
e ela **dispara** quando executada a mao.

> **BACKUP QUE NINGUEM VIU DISPARAR E UM BACKUP QUE NAO EXISTE.** O script sai com codigo 1 quando
> falta tabela justamente pra o Agendador registrar a falha — backup que morre calado aparece verde
> na lista de tarefas ate o dia em que alguem precisa restaurar.

---

## 9. O VEREDITO — a prova objetiva de "terminou"   *(FABRICA, apontando pro cliente)*

```
set SBP=sbp_...
node tools/verifica_instalacao.js C:/limedtec-002
```

Ele responde o checklist inteiro, **item a item**, com o conserto na linha de baixo de cada `X`.

**Verde:** `>>> PRONTO. Todos os itens verdes.`

> **"NAO CONFERIDO" NAO E VERDE.** Sem o token, os itens de banco saem como `?` e o placar diz
> isso na cara. Verificador que chuta verde e pior que verificador nenhum: ele transforma "nao
> sei" em "pode entregar".

---

## 10. DEPOIS DE ENTREGAR

- **revogue o token `sbp_`** (Account > Access Tokens). Ele roda DDL e le qualquer tabela;
- confirme que `segredos.local.txt` **nao** foi commitado (ele esta no `.gitignore` do molde);
- publique a pasta (GitHub Pages ou o hosting escolhido) e abra o endereco **numa aba anonima**,
  pra ver o que o usuario ve.

---

## O QUE ESTE ROTEIRO **NAO** RESOLVE, e e honesto dizer

1. **A carga inicial de dado do cliente** (tabela de fornecedor, catalogo, clientes). Isso e
   trabalho de import, com os scripts de `tools/importa_*.js` da fabrica, e cada fornecedor tem o
   seu formato. Esses scripts **nao** viajam no molde: cada um conhece o layout de um fornecedor
   especifico, e layout de fornecedor e informacao comercial.
2. **A `limedtec-central.html`** nao entra no molde de proposito: e o painel do **dono do produto**,
   nao do cliente. Cliente nenhum recebe.
3. **A hospedagem.** O molde e um site estatico; onde ele mora e decisao de quem instala.
