# O MOLDE NA PROPOSTA — item 8b, tela 1 (`fpmed_giovana.html`)

> Companheiro do `docs/molde_encontrar.md` (o molde do sistema) e do `docs/molde_negocios.md`.
> Aqui fica só o que é **desta tela**: o que entrou, o que **não** entrou e por quê, e o que a
> medição achou.
>
> A receita é a mesma do Negócios: **tokens do tema, moldura do molde, sprite único, AA medido,
> sem apagão, tudo por token.** Onde a tela tem função que o molde não previu, ela mantém a
> **função** e veste a **roupa**; onde a dúvida é de **negócio**, vai para o checkpoint em vez de
> eu decidir sozinho.

---

## ⚠ UMA PREMISSA QUE A MEDIÇÃO CORRIGIU, ANTES DE QUALQUER CÓDIGO

O item 8b está escrito como *"as telas que ainda estão no tema escuro (8 ainda escuras)"*. **Medi
as onze telas restantes, pelo `--bg` de cada uma**, e o quadro é outro:

| | telas |
|---|---|
| **escuras** (`--bg:#0B1622`) — 5 | `conferidor` · `declaracoes` · `documentos` · `pecas` · `edital_ia` |
| **claras com paleta própria** (`--bg:#F4F7FA`) — 6 | **`giovana` (a Proposta)** · `competitividade` · `vendas` · `viabilidade` · `painel` · `dashboard_clientes` |

**A Proposta não é uma tela escura** — ela é clara, com paleta própria. O próprio projeto já a
classificava assim: a `testa_tema_tela_propria` (assert 16) lista `fpmed_giovana.html` entre as
**telas claras** desde antes desta rodada. A linha do "8 ainda escuras" no `CONTINUAR_AQUI` é o
que está velho.

> Isso **não muda o trabalho** — clara-fora-do-sistema e escura-fora-do-sistema pedem a mesma
> migração para os tokens. Muda o **plano**: são 5 telas que trocam de tom e 6 que só trocam de
> fonte de cor, e as segundas são muito mais baratas. Registrado aqui porque a fila é do dono.

---

## FATIA 1 — A PALETA

`fpmed_giovana.html`. Suíte nova **`testa_molde_proposta`** — 22 asserts, **mutação 14 de 14
barradas**.

### O que a medição achou antes de eu mexer (L1: medir, nunca achar)

Rodei a fórmula da WCAG nos **17 pares que esta tela usa de verdade**, lidos do CSS dela.
**12 dos 17 reprovavam em AA** — e esta é a tela em que o preço é decidido e a proposta sai para o
hospital.

| medido | mínimo | onde |
|---|---|---|
| **2,07:1** | 4,5 | **o placeholder de todo campo** |
| **2,67:1** | 4,5 | **o botão primário** — branco sobre o azul da marca |
| 2,77:1 | 4,5 | o selo do teto CMED "ok" |
| 2,83:1 | 4,5 | texto de apoio sobre a página |
| **3,05:1** | 4,5 | **o rótulo de TODO o formulário**, e o detalhe de cada item |
| 3,21:1 | 4,5 | o selo do teto CMED **"acima"** — o alerta mais importante da tela |
| 3,25:1 | 4,5 | o selo amarelo |
| 3,38:1 | 4,5 | o selo azul (texto sobre o azul pálido) |
| 3,59:1 | 4,5 | o vermelho de erro sobre o cartão |
| **3,71:1** | 4,5 | **o hover do botão primário** |

> **O 3,71:1 é a lição S12 literal, ainda viva.** `#1B8DC4` é exatamente o azul que este projeto
> nomeou em 13/08 como *"o azul de ação que parecia bonito e nunca tinha sido medido"*. O tema o
> aposentou uma vez — aqui ele sobreviveu **porque esta tela tinha paleta própria**. É o argumento
> inteiro do design system numa cor só.
>
> E o **selo "acima" do teto CMED a 3,21:1** é o pior de todos em consequência: o alerta que diz
> *"este preço está acima do teto legal"* era o texto menos legível da tela.

### Os apelidos apontam para os tokens, e nenhum tem valor próprio

Mesma técnica do Negócios, e pela mesma razão **medida**: **133 usos** de `var(--muted)`,
`var(--borda)`, `var(--verde)` etc. vivem **fora da folha de estilo**, dentro de HTML gerado pelo
script — e nenhuma varredura de CSS os enxerga. Apagar os nomes deixaria esses pedaços sem cor, e
o defeito só apareceria no dia em que alguém abrisse aquele trecho. Há assert sobre a contagem.

### O mapa é por **ofício**, não por nome — e essa é a decisão da fatia

`--verde` (que apesar do nome sempre foi o **azul** da marca) é usado nos **três** ofícios que a
rampa do tema separa:

| ofício | onde | o que exige |
|---|---|---|
| fundo que carrega texto branco | `.btn-primary`, `.topfaixa`, `.toast.success`, botão Salvar | branco por cima ≥ 4,5 |
| borda e acento | foco do campo, spinner, tracejado do upload | nada (não carrega texto) |
| **texto azul** | aba ativa, link, status, "Clique ou arraste" | ele sobre branco ≥ 4,5 |

Um apelido só não pode virar três tokens. Então ele vira **o degrau que passa nos três**:
**`--azul-600`** (branco por cima 5,04:1 · ele sobre branco 5,04:1 · e continua azul de marca como
borda). O `--azul-500` puro segue disponível para regra nova que não carregue texto.

> Há assert barrando a troca do 600 pelo 500 — que é a coisa mais natural do mundo para quem está
> comparando dois prints e não mediu. Mesmo assert que a Encontrar tem, pela mesma razão.

O mapa completo:

```
--verde        -> --azul-600      --texto    -> --cinza-800     --navy   -> --azul-900
--verde-escuro -> --azul-700      --muted    -> --cinza-600     --fverde -> --verde-500
--verde-claro  -> --azul-50       --borda    -> --cinza-200     --card   -> --branco
--bg           -> --cinza-50      --vermelho -> --vermelho-700  --sombra -> --sombra-1
```

### Medido depois: **os 17 pares passam**

E os 2 pares novos que o mapa cria (texto azul sobre cartão e sobre a página) também passam. O
único par que reprova na tabela do tema — branco sobre o verde da marca, **2,04:1** — **esta tela
não usa**: aqui o verde é ponto de status e borda, nunca fundo de texto. Há assert pelo avesso,
barrando o dia em que alguém pintar um botão de verde com letra branca "porque o verde é da marca".

---

## *** O ACHADO DO NAVEGADOR: `--bg` e `--borda` não são só nossos ***

A suíte estática dizia que o mapa estava de pé. **O navegador disse outra coisa**, e essa é a
diferença entre medir o arquivo e medir a tela:

```
--bg     resolveu para  #F5F9FC              (e não o --cinza-50, #FAFBFC)
--borda  resolveu para  rgba(23,58,94,.16)   (e não o --cinza-200, #E9EDF3)
```

A causa é o **tema white-label**. O `aplicaTema` (no `limedtec-config.js`) escreve os nomes
**crus** `--bg`, `--panel`, `--panel2`, `--ciano`, `--ciano2`, `--txt` e `--borda` direto no
`documentElement.style` — **estilo em linha, que ganha de qualquer `:root`**. E a paleta privada
desta tela usava dois desses nomes.

> **Isso é o white-label funcionando, não um defeito.** O `aplicaTema` só escreve `if (c[k])`:
> o token é o **padrão** e a cor do cliente **sobrepõe**. Numa tela de produto branco, é assim que
> tem de ser.
>
> **E a colisão é anterior a esta fatia**: o `#F4F7FA` da paleta antiga também nunca chegou à tela.
> O que mudou é que agora está **escrito**, com assert.

O que isso obriga: **medir os dois caminhos**. Medir só o token seria medir a metade que não
aparece.

| par sobre o fundo da página | com o token | com a cor que o cliente configurou |
|---|---|---|
| texto principal | 17,65:1 | **17,28:1** |
| texto de apoio | 5,91:1 | **5,79:1** |
| texto azul (link, aba ativa) | 4,86:1 | **4,76:1** |

Os dois caminhos passam. A suíte agora mede os dois, e há mutação que **escurece o `bg` do
cliente** (sem tocar em token nenhum) para provar que o vermelho acende.

---

## O QUE ESTA FATIA **NÃO** TOCOU, E É DECISÃO DECLARADA

### O documento impresso — e isto vai para o checkpoint

O bloco `.print-doc` continua com as **cores escritas à mão** (`#173A5E` no cabeçalho e nas
tarjas, `#1E2A36` no corpo, `#4A5B6B` nos rótulos). Ele **não é tela: é papel** — outra restrição
(tinta, contraste no impresso) e **valor comercial**: trocar o navy do cabeçalho muda o documento
que o hospital recebe assinado.

> **Isso é decisão de negócio, não de design system.** Há assert **pelo avesso**, guardando que o
> bloco continua intocado — sem ele, a próxima passagem "terminaria o trabalho" tokenizando o
> papel junto, sem ninguém decidir.
>
> **PARA O CHECKPOINT:** o dono decide se o documento impresso deve seguir os tokens do tema (e
> então mudar de cor no papel) ou permanecer congelado na identidade atual da proposta.

### Os `#fff` que sobraram no corpo

Restam **11** cores escritas à mão em atributos `style=` dentro do HTML e do JavaScript. Elas não
são da fatia da paleta — são da fatia da **marcação**, junto com os 155 emoji e a moldura. Ficam
declaradas aqui para não passarem por esquecimento.

### `sw.js`

Não toquei: o Trabalhador A está com ele em voo (bump `-42`, com nota sobre o meu `-41`). A casca
é network-first, então versão velha só pesa offline. O bump desta fatia entra com a próxima
publicação — anotado para não se perder.

---

---

## FATIA 2 — A MOLDURA

`fpmed_giovana.html`. `testa_molde_proposta`: **22 → 46 asserts**, **mutação 27 de 27 barradas**.

Duas faixas de altura cheia morreram — a `.topfaixa` azul (← Sistema · telefone · slogan) e a
`.top-bar` branca (logo · nº do orçamento · status do banco) — e no lugar entrou **uma linha de
52px, sticky**, com as **mesmas classes** da Encontrar e do Negócios (`.topo`, `.trilha`,
`.pagina-topo`, `.faixa-int`). Três telas do mesmo sistema com três vocabulários é como se produz
o "quase igual" que o olho percebe e ninguém consegue nomear. Há assert cobrando as **quatro**
pontas de cada classe: a regra existe aqui, existe nas outras **duas**, e a marcação usa o nome.

### Onde cada peça foi parar

| a peça | virou |
|---|---|
| "← Sistema" | a **raiz da trilha** — ordem expressa: tela sem porta de saída é beco |
| telefone e slogan | **saíram** — vivem no rodapé do menu, em toda tela |
| o logo | **saiu** — o menu lateral já o carrega; dois logotipos na mesma dobra é desalinhamento |
| nº do orçamento + Abrir/Salvar | **ficou no header** — é o que responde *"em qual proposta eu estou"* |
| status do banco | virou **selo**, ao lado deles |
| "Proposta Comercial · vendedora" | virou o **H1 + subtítulo**, no começo do conteúdo |

A trilha diz **`Sistema › Ferramentas › Proposta`** — "Ferramentas" é o grupo em que este módulo
vive no menu lateral. Há assert conferindo o grupo **no `limedtec-menu.js`**: trilha que discorda
do menu vira uma segunda taxonomia, e é ela que ensina onde as coisas ficam.

> **A função que o molde não previu ficou, vestindo a roupa.** A Encontrar não abre documento
> nenhum, então o molde não tem lugar para "qual orçamento está aberto". A peça continua no
> header — que é onde ela pertence — só que agora com os controles do sistema.

### A régua é a do conteúdo (800px), e não a de 1420 das outras duas

Aqui o conteúdo é um **formulário**, e a coluna estreita é decisão antiga e certa. Header mais
largo que o conteúdo deixaria a trilha fora do prumo do H1 — o "quase alinhado" que D3 chama de
pior que o desalinhado. **Medido: trilha e H1 na mesma régua (490 = 490) em todas as larguras.**

---

### *** O DEFEITO QUE A MEDIÇÃO PEGOU: a trilha era espremida a zero ***

As outras duas telas usam `flex-wrap:nowrap` no header acima de 900px. Copiei junto — e **medi**:

```
com nowrap, régua de 800px  ->  trilha = 0px de largura
```

Lá sobra espaço: a régua é de 1420px e a faixa carrega só a trilha e o sino. **Aqui não sobra** —
a faixa carrega também o nº do orçamento, dois botões e o selo do banco, e com `nowrap` quem é
espremido primeiro é a trilha, porque é a única peça com `min-width:0`.

> **A porta de saída desaparecendo é o "beco" que a ordem do dono proíbe** — o mesmo defeito que a
> Encontrar teve em 390px, por outro caminho. Então esta moldura **diverge de propósito**: a faixa
> quebra em duas linhas quando falta espaço, e a trilha ganha `flex:0 0 auto`. Há assert para as
> duas coisas, e um terceiro barrando o retorno do `nowrap`.

Medido depois, em quatro réguas (342 · 640 · 768 · 800): **trilha viva (232px) em todas**, sempre
no prumo do H1, zero estouro, zero rolagem horizontal.

### *** E O OUTRO: eu portei metade da reserva do gm-auth ***

O CSS da reserva veio; **a função que a preenche, não**. O `var(--reserva-auth, 0px)` caía sempre
no valor de emergência, e a regra **parecia de pé enquanto não reservava nada**.

Só apareceu no navegador. Com a função no lugar, medido:

| | valor |
|---|---|
| `--reserva-auth` com a etiqueta presente | **321px** (309 medidos + 12 de folga) |
| `padding-right` da faixa | 337px → volta a 16px quando a etiqueta some |
| a etiqueta ainda cobre o Salvar? | **não** |
| **a borda esquerda se mexeu?** | **não — trilha 490 = H1 490** |

> A reserva entra como **padding de dentro** da faixa justamente para a borda **esquerda** não se
> mexer: é ela que tem de continuar no prumo do H1. Padding no `.topo` (que é largura total)
> deslocaria a coluna centrada e quebraria o alinhamento que a fatia inteira existe para garantir.

### A altura do header, medida

| | altura |
|---|---|
| sem o botão "Instalar aplicativo" | **53px** — a altura do molde |
| com ele (soma das peças = 861 > 800) | **65px**, quebrando em duas linhas |

Isso é degradação graciosa e não defeito: o botão só existe em navegador onde o app é instalável,
e quando ele entra o header cresce 12px em vez de comer alguma peça.

---

### *** A REGRA MAIS PERIGOSA DESTA FATIA É POR OMISSÃO: a impressão ***

**É por esta impressão que sai o PDF da proposta que vai para o hospital.** O `@media print` é uma
lista branca às avessas: ela **nomeia o que some**. Toda peça de moldura que entra na tela tem de
entrar ali junto, no mesmo commit.

> **E o menu não se esconde sozinho.** Conferi no arquivo antes de escrever, não supus: o
> `limedtec-menu.js` não tem `@media print` nenhum — só o de 900px. Ele é `position:fixed`, então
> **sem essa linha a barra lateral inteira sairia impressa em cima da proposta**. Há assert para a
> linha **e** para a premissa (que o menu de fato não tem regra própria) — se um dia ele ganhar
> uma, o assert avisa que a responsabilidade mudou de lugar.

E `body{margin-left:0!important}` pelo mesmo motivo: a margem que abre espaço para o menu na tela
empurraria o documento inteiro para a direita no papel.

### Duas coisas que a minha própria suíte errou, e as duas eram instrumento torto

| o assert | por que passava/reprovava errado |
|---|---|
| "o tema vem antes do `<style>`" | media a posição do primeiro `<style>` do arquivo — e o primeiro estava **dentro do comentário que explica essa mesma regra** |
| o bloco `@media print` | a regex casava com o **primeiro** `@media print` (o de uma linha, do selo do teto) e corria até a chave errada, **engolindo ~200 linhas**. Os asserts passavam **por acidente**, porque o texto engolido continha o bloco certo mais adiante |

> Assert que passa por acidente é pior que assert que falta: ele compra confiança sem entregar
> nada. O segundo passou a ler com **chaves balanceadas**, escolhendo o bloco pelo que ele
> **contém** (`.print-doc`) e não pela ordem em que aparece.

---

## O QUE VEM NAS PRÓXIMAS FATIAS

| fatia | o que | por que nesta ordem |
|---|---|---|
| 3 | **O sprite único** (`fpmed_icones.js`) — 155 emoji, 32 distintos | D11: emoji é fonte, não desenho |
| 4 | **Cartões e listas** com a anatomia do molde + as 11 cores dos `style=` inline | depende da moldura estar de pé |

### Medições que ficaram pendentes, e o motivo é o mesmo do Negócios

**O teste do bater o olho não foi feito.** A tela exige sessão e o `gm-auth` substitui a página
inteira pelo formulário de acesso. O que foi medido no navegador é a **resolução real dos tokens**
no `documentElement` (é de lá que veio o achado da colisão) — mas a comparação **visual** lado a
lado com o molde fica para quem puder abrir a tela logado.
