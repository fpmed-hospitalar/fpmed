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

**Quem preenche:** `tools/coleta_resultados.js`, **sob demanda** — `--controle <numero_controle>`
ou `--meus-negocios`. **Não existe modo “varre tudo”**: resultado é uma requisição *por item*, e
um edital de 500 itens são 500 chamadas ao PNCP.

**Estado em 14/08:** a tabela já tem dado real — 195 itens da licitação
`01640429000106-1-000117/2026` (Pedra Bonita/MG), 192 deles com resultado publicado. A Encontrar
continua lendo os itens ao vivo do PNCP para exibir na hora; esta tabela é o que **fica**.

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

**Quem preenche:** `tools/coleta_resultados.js` (o mesmo que traz os itens — o resultado é um
atributo do item, e o PNCP só o entrega se você souber o `numeroItem`).

**Conferido em 14/08** (`tools/prova_resultado_item.js`, 8 de 8): três itens com resultado
batendo com o PNCP em vencedor, CNPJ, valor unitário e quantidade; três itens sem resultado
confirmados como `null` **dos dois lados**; e nenhum item com resultado pela metade.

> **Quando o PNCP publica mais de um resultado para o mesmo item** (remanescente, cancelamento,
> reclassificação), fica o de menor `ordemClassificacaoSrp` **entre os não cancelados**. Pegar o
> último inserido entregaria um cancelamento como se fosse o vencedor.

---

## 6 · Resumo do que já dá para usar hoje

| item | estado |
|---|---|
| `?adicionar=<numero_controle>&itens=<ids>` | ✅ **a Encontrar já envia** |
| `LeitorEdital.perguntar(...)` | ✅ existe e funciona; motor intacto |
| `licitacao_arquivos` | ✅ existe **com dado**: 4 editais/TR extraídos (69k a 173k chars) + 1 caso “sem arquivo” |
| `licitacao_itens` | ✅ existe **com dado**: 195 itens de uma licitação real |
| resultado por item | ✅ **192 resultados gravados e conferidos** contra o PNCP |

As duas tabelas são abastecidas **sob demanda**, nunca em massa — então elas vão ter as
licitações que alguém abriu ou que entraram no funil, e não o Brasil inteiro. Se você precisar
de uma que ainda não está lá, o comando é
`node tools/coleta_editais.js --controle <n>` / `node tools/coleta_resultados.js --controle <n>`.

Nada aqui exige que você espere por nada: as tabelas, o formato da URL e o motor do leitor estão
de pé, com dado real dentro.

---

## 7 · O NÚMERO DO PNCP INFORMADO À MÃO — `valida-controle` (fatia A19, 14/08/2026)

**O campo na ficha é seu. A conferência é minha, e ela já está no ar.**

### O problema, medido

Das **2.561** linhas de `negocios`, **zero** têm `numero_controle` e **zero** têm `licitacao_id`.
As 105 Atas vieram do "Calendário 2025" — uma planilha — que nunca teve a chave do PNCP. Sem
chave não há o que pedir ao portal: o PNCP responde por número de controle.

E **casar na marra não funciona, e isso foi medido duas vezes**: em 14/08, juntar por
UF + ano + número deu 2 correspondências "únicas" e as **duas eram de cidade errada** (Palmeiras
de Goiás casando com a Câmara de Jataí). Refeito hoje com o índice já em 3.876 linhas, as 4
correspondências ambíguas continuam **todas** de município errado. O número de pregão se repete
entre municípios: "P.E. 4/2026" existe em centenas de prefeituras no mesmo ano.

> Por isso a decisão do dono foi: **quem quiser recuperar informa o número**. A máquina não
> adivinha — ela **confere**.

### Como chamar

```
POST  {SUPABASE_URL}/functions/v1/valida-controle
Authorization: Bearer <access_token da sessão>     ← obrigatório (401 sem ele)
Content-Type: application/json

{
  "numero_controle": "01640429000106-1-000117/2026",   // obrigatório, o que a pessoa digitou
  "negocio_id": 2567,                                  // opcional p/ conferir, OBRIGATÓRIO p/ gravar
  "gravar": true,                                      // opcional — sem ele, só confere
  "confirmado": true                                   // só quando houver divergência que avisa
}
```

**Conferir NÃO grava.** Pode chamar enquanto a pessoa digita, sem medo — a gravação exige
`gravar: true`. Isso é de propósito: gravar por tabela mudaria o dado de um negócio ganho só
porque alguém colou um número pra ver o que dava.

### O que ela responde

```jsonc
{
  "ok": true,                    // atalho: true só quando veredito === "confere"
  "veredito": "confere",         // formato | nao_existe | nao_sei | diverge | confere
  "podeGravar": true,            // FALSE = nem com confirmação
  "divergencias": [              // vazio quando confere
    { "campo": "órgão", "informado": "CAMARA MUNICIPAL DE JATAI",
      "negocio": "MUNICIPIO DE PALMEIRAS DE GOIAS", "bloqueia": false }
  ],
  "mensagem": "…",               // JÁ PRONTA PRA TELA, em português, dizendo o que fazer
  "numero_controle": "01640429000106-1-000117/2026",
  "partes":   { "cnpj": "…", "ordem": "1", "sequencial": "117", "ano": "2026" },
  "orgao_pncp": "MUNICIPIO DE PEDRA BONITA",       // a razão social do CNPJ, direto do PNCP
  "no_indice": { "id": 6719, "orgao": "…", "municipio": "Pedra Bonita", "uf": "MG" },  // ou null
  "gravou": true,
  "licitacao_id": 6719
}
```

### Os cinco vereditos, e o que a tela deve fazer com cada um

| veredito | HTTP | `podeGravar` | o que mostrar |
|---|---|---|---|
| `formato` | 200 (409 se pediu gravar) | ❌ | a `mensagem` já ensina o formato, com exemplo |
| `nao_existe` | 200 / 409 | ❌ | a `mensagem` nomeia o engano mais provável (trocar o sequencial pelo nº do edital) |
| `nao_sei` | 200 / 409 | ❌ | **não diga que o número está errado.** O PNCP não respondeu — "tente de novo daqui a pouco" |
| `diverge` | 200 / 409 | depende | se `podeGravar`, mostre os dois nomes e um botão "gravar assim mesmo" que reenvia com `confirmado: true`. Se não, **não ofereça o botão** |
| `confere` | 200 | ✅ | pode gravar direto |

> **`nao_sei` ≠ `nao_existe`, e essa é a distinção mais importante deste endpoint.** A API de
> consulta do PNCP está fora desde 14/08. Se a tela tratar "não consegui perguntar" como "seu
> número está errado", a pessoa apaga um número **certo**.

> **Por que órgão e município só AVISAM, e ano BLOQUEIA.** Comparar nome de órgão é comparar
> texto escrito por gente: "MUNICIPIO DE X", "PREFEITURA MUNICIPAL DE X" e "P. M. X" são a mesma
> entidade. Qualquer regra apertada o bastante pra pegar a divergência real também recusaria
> essas três — e recusar o número certo de quem digitou certo ensina a pessoa a ignorar o aviso.
> Já o ano é identidade pura: ou é 2025 ou é 2026.

### O que acontece depois de gravar

A edge grava **os dois campos** — `numero_controle` (a chave que o PNCP entende) e
`licitacao_id` (a que amarra ao nosso índice, quando ele conhece a licitação). Gravar só um
deixaria metade da ponte de pé; foi o defeito da A9.

A partir daí **o coletor enxerga o negócio sozinho**: `tools/fila_resultado_atas.js` lê esse
campo e manda o `coleta_resultados.js` buscar itens e resultado por item. Você não precisa
chamar mais nada.

### O que você NÃO precisa (nem deve) fazer

* **não reimplemente a conferência na tela.** Ela já existe em dois lugares por necessidade
  (node, para o operador; Deno, para você) e há uma suíte comparando os dois — uma terceira
  cópia no navegador seria a que discorda no dia em que alguém amarrar um resultado no edital
  errado;
* **não monte a mensagem de erro.** A `mensagem` vem pronta, em português, dizendo o que fazer;
* **não tente adivinhar o número** a partir de UF + ano + número da compra. Está medido: erra.

### Provado em 14/08 — `node tools/prova_controle_informado.js` (14 de 14)

Um negócio sem chave (como as 105 Atas) recebendo o número à mão:
`01640429000106-1-999999/2026` **recusado** com `nao_existe` (na CLI e na edge, HTTP 409, sem
gravar); ano trocado **bloqueado**; `01640429000106-1-000117/2026` **conferido** contra o PNCP
("MUNICIPIO DE PEDRA BONITA") e gravado com `licitacao_id`; o negócio passou a aparecer na fila
do resultado por item e enxerga os **192 itens com vencedor e valor** que a fatia A7 já havia
conferido campo a campo contra o PNCP.

Suíte: `tests/testa_controle_informado.js`.
