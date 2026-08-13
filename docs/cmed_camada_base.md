# A CMED COMO CAMADA DE BASE — item 8

**Ordem do dono, 13/08/2026:** *"a CMED deixa de ser aba e vira base por baixo de todo preço —
ingestão da tabela oficial com PMVG por alíquota de ICMS, casamento por registro/EAN e
substância+apresentação com grau de confiança (não casou = silêncio, nunca teto chutado), PMVG
encostado no preço no detalhe do item e na Proposta, busca crua discreta no rodapé,
'Conferir CMED' sai do menu."*

Esta rodada entregou **a fundação**: dados + casamento + motor. A costura nas telas está
listada no fim, e a da Proposta está **congelada de propósito** — o `fpmed_giovana.html` está
com outra frente.

---

## 1 · O QUE JÁ EXISTIA, CONFERIDO NO BANCO (não na memória)

A ingestão **já estava pronta** desde o item 1B. Medido:

| | |
|---|---|
| `cmed_pf` | 25.702 linhas · `registro` 100% · `ean1` 25.701 · `dose_key` 25.592 |
| `cmed_precos` | 25.702 linhas · `pmvg_go19` **100%** · `cap=true` 2.722 |
| grade de alíquotas | as 26 em JSONB (`pf_aliq`, `pmc_aliq`, `pmvg_aliq`) |
| `cmed_dicionario` | 6.283 pares marca→PA |
| view `cmed_regua` | já entrega `pf_unit`, `pmvg_unit` e **`teto_gov_unit`** (PMVG com CAP, PF sem) |

> **"Ingestão da tabela oficial com PMVG por alíquota de ICMS" já estava feita.** Reconstruir
> teria sido trabalho sobre trabalho — e a Regra Zero manda conferir no arquivo, não na memória
> do arquivo.

---

## 2 · A DESCOBERTA QUE MUDA O ALCANCE DO ITEM

O pedido diz "casamento por **registro/EAN**". Medi os dois lados:

| lado | tem registro? | tem EAN? |
|---|---|---|
| CMED | **100%** (25.702) | **99,996%** (25.701) |
| **o nosso estoque** (`cotacoes`) | **não existe a coluna** | **não existe a coluna** |

O campo `codigo` da `cotacoes` é **código ERP interno** — amostra de 1.000 linhas: **zero** com
13 dígitos, todos no formato `0020009`. E `principio_ativo` vem preenchido em **349 de 1.000**.

> ### O que isso significa, sem contornar
> O casamento por registro/EAN **não tem com o que casar do nosso lado hoje**. Ele vale — e vale
> muito — para **planilha colada no Conferidor** (proposta de fornecedor costuma trazer EAN) e
> para **item de edital que declare o código**. Para o estoque próprio, o caminho continua sendo
> substância+dose, agora com o grau de confiança dizendo o quanto se pode acreditar.
>
> **Decisão do dono, se ele quiser fechar esse buraco:** capturar EAN/registro no cadastro do
> estoque. Já estava anotado como pendência desde 05/08 ("ou capturar EAN/GGREM no cadastro, que
> resolve de vez, ou conferir as 85 na mão"). Não fiz: é coluna nova em tabela viva e mudança de
> fluxo de cadastro — decisão dele, não minha.

---

## 3 · A ORDEM DAS CHAVES É MEDIDA, E É CONTRA-INTUITIVA

O senso comum diz que o código de barras identifica a embalagem (mais específico) e o registro
identifica o produto (mais amplo). **Nesta base é o contrário:**

| chave | distintos | chaves repetidas | maior grupo |
|---|---|---|---|
| GGREM | 25.702 | 0 *(chave primária)* | 1 |
| **REGISTRO** | 25.700 | **2** | 2 |
| EAN1 | 25.543 | **156** | 3 |

Então a ordem é **ggrem → registro → ean**. Quem é mais único vai primeiro.

### E o `porEan` escolhia por sorte

Ele era um `Map` de **linha única**. Nos 156 casos de colisão, a **última linha lida vencia em
silêncio** — o motor devolvia um teto exato, com cara de certeza, escolhido por ordem de
leitura. Agora as duas portas guardam **grupo**, e grupo com tetos diferentes cai na regra 3 do
próprio motor: usa-se o **menor** e a faixa viaja junto.

> Escolher por sorte é pior que mandar conferir: o erro sai com a mesma aparência do acerto.

Grupo cujos tetos são **iguais** não vira faixa — faixa de um número só é ruído que manda
conferir onde não há o que conferir.

---

## 4 · O GRAU DE CONFIANÇA

| grau | como casou | o que significa |
|---|---|---|
| `exata` | ggrem, registro ou EAN | a própria CMED diz quem é |
| `alta` | substância + dose, substância vinda do **dicionário** | a marca do nome foi reconhecida |
| `media` | substância + dose, substância **chutada da primeira palavra** | casou, mas ninguém confirmou que aquela palavra é um princípio ativo |
| `null` | não casou | silêncio — `nao_encontrado`, teto nulo |

> **Por que `media` precisa existir separada.** Antes do item 8 os dois caminhos por nome
> devolviam resultado com a **mesma cara**, e quem lê a tela não tinha como saber que um deles
> saiu de um palpite sobre a primeira palavra do texto. Encostar um teto **legal** no preço com
> base num palpite é a forma educada de chutar.

Medido na base real, numa amostra espalhada de 40 nomes: **19 alta · 3 media · 18 não casou**.

### A trava do grau mínimo

Quem chama declara o grau que aquele lugar exige (`{ confiancaMinima: 'exata' }`). Encostar o
PMVG no campo de preço, no instante em que o preço é decidido, é diferente de listar tetos num
conferidor: o primeiro precisa de certeza, o segundo pode oferecer "confira este".

**O rebaixamento não apaga a pista.** A situação vira `nao_encontrado` — o silêncio que a ordem
pede —, mas `via`, `confianca`, `evidencia` e um `motivo` continuam no objeto. Uma tela que
queira oferecer *"achei algo parecido, quer conferir?"* tem com o que fazer isso; o que ela não
pode é **afirmar** um teto legal apoiada num palpite.

---

## 5 · PROVAS

- `tests/testa_cmed_base.js` — **27 asserts, mutação 14 de 14 barradas.** Ela **executa** o motor
  contra um índice de mentira: prova a lógica.
- `tests/db/testa_cmed_chaves_reais.js` — **9 asserts contra a CMED de verdade** (25.702 linhas).
  Prova outra coisa: que a regra **acha o que existe**, e que a **cardinalidade que a ordem das
  chaves pressupõe continua verdadeira**. Ele não crava "1 e 156" — uma edição nova da CMED muda
  os dois legitimamente. Ele cobra a **relação**: o registro tem que continuar mais único que o
  EAN, senão a ordem vira preferência sem base.
  - Medido: amostra espalhada de 40 → **40 casaram por registro, 40 por EAN**.
  - E **material e correlato continuam sem teto** (parafuso, cadeira de rodas, papel A4, luva,
    cateter): inventar teto para material é o pior erro que esta camada pode cometer.

> **Dois achados do próprio teste de mutação:**
> 1. Duas mutações ficaram "vermelhas" por **TypeError**, não por assert — a suíte explodia ao
>    indexar uma faixa nula. Suíte que explode **para de avaliar o resto**, então uma regressão
>    posterior ficaria escondida atrás do crash. Corrigido.
> 2. Um assert meu tinha um `||` de reserva, porque eu não tinha certeza do número. Assert com
>    saída de emergência passa em qualquer caso e não guarda nada. O valor foi cravado.

---

## 6 · O QUE FALTA DO ITEM 8 (e o que está congelado)

| parte | estado |
|---|---|
| ingestão com PMVG por alíquota | **já existia** (item 1B), conferido |
| casamento registro/EAN + grau de confiança | **feito nesta rodada** |
| motor com silêncio no lugar de chute | **feito nesta rodada** |
| PMVG encostado no **detalhe do item** (Licitações) | **falta** — território meu, próxima fatia |
| busca crua discreta no rodapé | **falta** |
| "Conferir CMED" sai do menu | **falta** — `limedtec-menu.js` |
| PMVG encostado na **Proposta** | **CONGELADO** — ver abaixo |

### A costura na Proposta, para quando a outra frente entregar

O `fpmed_giovana.html` está com outra frente (item 7b/Proposta) e **não foi tocado**. Quando ele
voltar, a costura é curta, porque o motor já entrega tudo pronto:

1. carregar `cmed_regua`, `cmed_teto` e `cmed_dicionario` **paginados** (o PostgREST corta em
   1000 — a giovana já teve esse defeito uma vez, lendo 1.000 de 6.283 do dicionário);
2. `LimedtecTetoCMED.indexar({regua, teto, dicionario})` uma vez;
3. por item: `avaliar({descricao, ean, registro, precoUnit, unitario:true, paraGoverno}, idx,
   {confiancaMinima:'alta'})`;
4. o selo já existente (item 5) passa a mostrar **de onde veio o teto** (`via`) e o **grau**.

> **O `confiancaMinima:'alta'` na Proposta é recomendação, não decisão tomada:** ali o preço está
> sendo **decidido**, e um teto vindo de palpite muda uma decisão comercial. Mas quem manda no
> rigor dessa tela é o dono dela.

### Um achado no território da outra frente, que eu não toquei

O `fpmed_giovana.html` filtra `cotacoes` por `c.ean` (por volta da linha 2175). **A coluna `ean`
não existe na `cotacoes`** — medido nas 28 colunas da tabela. O filtro devolve sempre vazio, então
esse caminho é um **ramo morto** que nunca dispara. Não é defeito visível: ele apenas cai no
motor de sempre, que é o comportamento antigo. Fica registrado para a frente que é dona do
arquivo.
