# Contrato: itens de edital, leitor de edital e a ponte Encontrar → Negócios

**Escrito pelo Trabalhador A em 14/08/2026 (fatia A5).**
Este documento é a **única** coisa que a janela do Negócios precisa ler para se ligar ao que a
Encontrar produz. Ele descreve o banco **como ele está**, e não como eu gostaria que estivesse:
tudo que está aqui foi medido ou aplicado, e o que ainda não existe está marcado como tal.

> **Se algo aqui divergir do banco, o banco vence e este arquivo está errado — me avise.**

---

## 0 · A chave: `numero_controle`, nunca o `id`

Toda ligação entre licitação, itens, arquivos e negócio usa **`numero_controle`** — o número de
controle do PNCP.

**Medido em 14/08:** `licitacoes` tem 3.201 linhas, **3.201 com `numero_controle` preenchido e
3.201 distintos**. Cem por cento, sem um vazio e sem uma repetição.

**Por que não o `licitacoes.id`:** a tela Encontrar mostra licitações vindas de **duas** fontes —
o nosso índice (que têm `id`) e o PNCP **ao vivo** (que não têm linha nenhuma aqui). Usar o `id`
obrigaria a gravar no índice toda licitação que alguém clicou para olhar. Uma tela de busca não
pode escrever no índice porque alguém passou o olho.

> `licitacao_id` existe nas tabelas novas como **atalho opcional**: preenchido quando a
> licitação está no índice, `NULL` quando ela veio ao vivo. A linha vale nos dois casos.

E `negocios.licitacao_id` **já existia** antes desta fatia — é por ele que o Negócios amarra o
negócio à licitação depois de resolver o `numero_controle`.

---

## 1 · Onde vivem os itens de cada licitação

**Tabela `licitacao_itens`** — criada em 14/08, 100% aditiva (`ddl/licitacao_itens.sql`).

| coluna | tipo | o que é |
|---|---|---|
| `id` | bigserial | PK |
| `numero_controle` | text **not null** | **a chave** — liga com `licitacoes.numero_controle` |
| `licitacao_id` | bigint | atalho opcional para `licitacoes.id` |
| `numero_item` | text **not null** | o nº do item **como o PNCP manda** |
| `descricao` | text **not null** | é ela que casa com a CMED |
| `quantidade` | numeric | |
| `unidade` | text | |
| `valor_unitario_ref` | numeric | valor de referência **do edital** — não é preço nosso |
| `situacao` | text | `situacaoCompraItemNome` do PNCP |
| `bruto` | jsonb | o item cru |

**Chave única: `(numero_controle, numero_item)`.** Sem ela, cada releitura do edital duplicaria a
lista inteira e a contagem de itens dobraria a cada visita.

> **`numero_item` é TEXTO, e isso não é descuido.** O PNCP manda `"1"`, `"01"` e `"1.1"` — os três
> existem. Guardar como inteiro perderia o `"1.1"` e transformaria `"01"` e `"1"` no mesmo item,
> que é justamente a colisão que a chave única existe para impedir.

**Estado hoje:** a tabela existe e está **vazia**. Quem a preenche é a fatia A6 (abastecimento),
sob demanda. Até lá, a Encontrar lê os itens ao vivo do PNCP e guarda só em memória.

---

## 2 · A ponte Encontrar → Negócios: `?adicionar=…&itens=…`

Quando alguém clica **“Adicionar aos meus negócios”** no detalhe do pregão, a Encontrar navega
para:

```
fpmed_negocios.html?adicionar=<numero_controle>&itens=<numero_item>,<numero_item>,…
```

| parâmetro | obrigatório | conteúdo |
|---|---|---|
| `adicionar` | **sim** | o `numero_controle` do PNCP, URL-encoded |
| `itens` | não | os `numero_item` marcados, separados por vírgula, URL-encoded |

**Sem `itens`** = ninguém marcou item nenhum. Isso quer dizer **“o pregão inteiro”**, e não
“nenhum item” — quem manda um edital pro funil sem marcar nada está mandando o edital, não uma
lista vazia. *Tratar ausência como zero aqui criaria negócio sem item nenhum e ninguém entenderia
por quê.*

**O que a Encontrar faz e o que ela NÃO faz:**

- ✅ ela navega com os parâmetros;
- ❌ ela **não cria** o negócio, não grava em `negocios`, não decide estágio.

> Isso é decisão, não divisão de tarefa. Dois criadores de negócio com regras diferentes é como o
> mesmo pregão entra duas vezes no funil e duas pessoas trabalham a mesma coisa sem saber. O
> assistente é **seu**; a Encontrar só entrega o pedido.

**O que eu recomendo (não impõe) do lado do Negócios:** resolver `numero_controle` →
`licitacoes.id` e gravar em `negocios.licitacao_id`; e **procurar negócio existente pelo mesmo
número antes de criar** — a ponte antiga (`mandarProFunil`) já faz isso e a duplicata é o erro
caro aqui.

**Já existe hoje:** a Encontrar tem um botão antigo “＋ Mandar pro funil” que **cria** o negócio
direto (sem itens). Ele continua funcionando e não foi tocado. O caminho novo, com itens, é o do
detalhe.

---

## 3 · Como chamar o leitor de edital por dentro

O “Leitor de edital” **saiu do menu em 14/08** (fatia A2) e virou **motor chamável**. A tela
avulsa `fpmed_edital_ia.html` continua existindo — só deixou de ser destino navegável.

**Arquivo:** `fpmed_leitor_motor.js` (carregue com `<script src="fpmed_leitor_motor.js">`; ele já
está na casca do service worker).

```js
const r = await LeitorEdital.perguntar({
  texto,            // obrigatório — o texto JÁ EXTRAÍDO do edital
  tarefa,           // 'resumo' (padrão) | 'itens'
  pergunta,         // opcional
});
```

**Erros que você PRECISA distinguir** (vêm marcados no objeto de erro):

| marca | significa | o que a tela deve dizer |
|---|---|---|
| `e.semPermissao` | HTTP 403 | “não está liberado para o seu usuário” — **nunca “deu erro”** |
| `e.semSessao` | sem token | “sua sessão expirou, entre de novo” |
| `e.semTexto` | chamou sem edital | não gastou nada |

### Custo, permissão e registro: onde eles moram (e por que não mudaram)

Os três vivem na **edge function `ler-edital`**, no servidor — **nunca estiveram no menu nem na
tela**:

- **permissão** — lista explícita de e-mail conferida contra o JWT; fora da lista, `403`;
- **custo** — contado do `usage` real da resposta, **inclusive leitura que falhou depois de
  consumir token**;
- **registro** — gravação em `usos_ia` (26 colunas; `brl`, `tokens_entrada/saida`, `ok`, `erro`).

**Medido em 14/08:** a edge function responde `401 {"error":"sessao invalida — entre de novo"}`
sem token, e `usos_ia` tem 10 registros somando R$ 3,54, 10 ok / 0 erro.

> **Não escreva uma segunda checagem de permissão nem uma segunda conta de custo do seu lado.**
> Duas respostas para “quem pode gastar?” e “quanto custou?” um dia discordam — num número que
> vira fatura. Há assert proibindo isso dentro do próprio motor.

**Cada chamada custa dinheiro real.** O selo “IA” existe para que ninguém clique sem saber; ele
saiu do menu e foi para o botão que dispara o gasto. Se você puser o botão aí, leve o selo junto.

---

## 4 · Texto extraído do edital e link do PDF

**Tabela `licitacao_arquivos`** — criada em 14/08, aditiva, **vazia por enquanto** (a fatia A6 a
preenche).

| coluna | o que é |
|---|---|
| `numero_controle` | a chave |
| `sequencial`, `titulo`, `tipo` | do PNCP (“Edital”, “Anexo”, “Termo de Referência”) |
| `url_pncp` | **o link original no PNCP**, nunca reescrito |
| `texto_extraido` | **o que a IA lê** |
| `texto_chars`, `texto_paginas`, `extraido_em` | |
| `extracao_erro` | por que falhou, quando falhar |

Chave única: `(numero_controle, url_pncp)`.

**O PDF inteiro não entra nesta tabela.** Regra da caixa: PDF completo só para licitações que
estão nos meus negócios, e no **bucket de anexos** (`negocio_anexos`), não aqui. Um PDF de 12 MB
por licitação, para o Brasil inteiro, é uma conta que ninguém autorizou.

**Estado honesto quando não há arquivo:** o PNCP nem sempre publica o edital. Nesse caso a
resposta é **“edital não publicado no PNCP — anexe manualmente”**, e a tela de anexar é sua.
`texto_extraido IS NULL` + `extracao_erro IS NULL` = ainda não tentei. `extracao_erro` preenchido
= tentei e falhou, e o motivo está lá.

---

## 5 · Resultado por item

Fica **na própria `licitacao_itens`**, em colunas prefixadas — e não em tabela separada:

`resultado_vencedor` · `resultado_cnpj` · `resultado_valor_unit` · `resultado_quantidade` ·
`resultado_situacao` · `resultado_lido_em`

**Por que junto:** são atributos do **mesmo item** em outro momento da vida dele. Tabela separada
obrigaria uma junção para responder *“este item eu ganhei?”* — que é a pergunta mais natural que
se faz sobre um item de edital.

> **`NULL` é “ainda não sei”, e não “não ganhei”.** Sessão não homologada e sessão perdida são
> estados diferentes; a tela que os tratar igual vai dizer que perdemos o que ainda nem foi
> julgado.

Isso **complementa** `negocio_itens_ganhos`, que já existe e é outra coisa: lá é o que **nós**
confirmamos ter ganho (com marca, origem, quem confirmou); aqui é o que o **PNCP publicou**.
Quando os dois discordarem, quem manda no comercial é o seu, e este serve de conferência.

**Estado hoje:** as colunas existem e estão vazias. Quem preenche é a fatia A7.

---

## 6 · Resumo do que já dá para usar hoje

| item | estado |
|---|---|
| `?adicionar=<numero_controle>&itens=<ids>` | ✅ **a Encontrar já envia** |
| `LeitorEdital.perguntar(...)` | ✅ existe e funciona; motor intacto |
| `licitacao_itens` / `licitacao_arquivos` | ✅ **existem no banco**, vazias — A6/A7 preenchem |
| resultado por item | ✅ colunas existem, vazias |

Nada aqui exige que você espere pela A6 ou A7 para começar: as tabelas e o formato da URL já
estão de pé, então o código do seu lado pode ser escrito contra eles agora.
