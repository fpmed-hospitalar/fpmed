# O MOLDE NO NEGÓCIOS — item 7b

> Companheiro do `docs/molde_encontrar.md`, que é **o molde do sistema**. Aqui fica só o que é
> **desta tela**: o que do molde entrou, o que **não** entrou e por quê, e o que a medição achou.
>
> A ordem permanente vale palavra por palavra: **o molde manda**, tokens do `fpmed_tema.css`,
> AA medido, sem apagão, e onde a tela tem dado ou função que o molde não previu ela adota a
> **roupa** do molde, mantém a **função**, e onde não há dado fica em **branco honesto**.
>
> As decisões já tomadas na Encontrar são **jurisprudência** aqui. Redecidir cada uma em cada
> tela é como nascem duas respostas para a mesma pergunta. Onde eu divirjo dela, o motivo está
> escrito — e é sempre um motivo **desta tela**, nunca "achei melhor".

---

## Onde a tela estava, e onde está

| fatia | o que é | estado |
|---|---|---|
| 1 | **A moldura** — header sticky, trilha, `.pagina-topo`, as 4 visões como alternador, o sino | **feita** (`f66aa8d`) |
| 2 | **Os indicadores** — 5 cartões com a anatomia da fila da Encontrar, destaque navy | **feita** (`7b68042`) |
| 3 | **O painel em volta da lista** | **feita** — esta seção |
| 4 | O painel na **Agenda** (e os dois cortes calados dela) | **feita** — seção 4 |
| 5 | **Quadros/Kanban** — caso à parte, decisão declarada | **feita** — seção 5 |

---

## 3 · O PAINEL EM VOLTA DA LISTA

`fpmed_negocios.html`. Suíte nova **`testa_painel_negocios`** — 30 asserts, **mutação 16 de 16
barradas**.

A visão Lista era uma **pilha de cartões soltos**: cada um com borda, sombra e 12px de buraco
entre eles. Agora são **linhas dentro de um painel**, com cabeçalho e rodapé — a mesma peça que a
Encontrar recebeu no passo 6, com os **mesmos nomes de classe** (`.painel-res`, `.cabecalho`,
`.rodape-painel`) e os **mesmos valores** (cabeçalho 42px, rodapé 44px, superfície sutil,
`--borda-divisor`). Há assert cobrando os dois lados de cada valor: se um dia a Encontrar mudar o
seu 42px, esta suíte fica vermelha aqui.

> **Por que não é gosto.** Duzentos cartões flutuando são duzentas fronteiras desenhadas e cento
> e noventa e nove buracos, e o olho reprocessa "onde começa o próximo" a cada rolagem. Num painel
> a fronteira é desenhada **uma** vez, e o que separa as linhas é o fio mais leve do sistema.

### O cartão não morreu — e isso é o "sem apagão" dentro de uma regra de CSS

O `.card` é a **mesma peça em três lugares**: linha da lista, cartão arrastável do kanban e cartão
ao lado da hora na agenda. Achatar a **regra base** para deixar a lista bonita apagaria o quadro
inteiro, que é a **visão de abertura** desta tela. Quem vira linha é o `.card` **dentro** do
painel, e só ele.

Provado no navegador, trocando de visão com o mesmo dado na memória:

| visão | painel | borda do cartão | raio | sombra |
|---|---|---|---|---|
| Quadros | não | 0,8px | 13px | sim |
| Agenda | não | 0,8px | 13px | sim |
| **Lista** | **sim** | **0** | **0** | **não** |

### *** O QUE ESTA FATIA REALMENTE CONSERTOU: a lista cortava em 200 e nunca disse ***

O `l.slice(0,200)` está nesta tela desde que a visão Lista existe. Com 300 negócios no escopo,
**cem sumiam sem uma palavra** — e quem procurasse um deles concluiria que **o negócio não está no
sistema**, que é a conclusão mais cara que esta tela pode induzir. É a lição S6 na forma mais
direta: *"não sei"* virando *"não há"*.

O teto continua existindo; o que mudou é que ele passou a ser **dito**, e com o número na frente:

> Mostrando os **200** primeiros — **50** ficaram de fora desta tela. Filtre por fase, empresa ou
> busca para chegar neles; esta lista não pagina.

E os **dois casos têm frases diferentes** de propósito: *"todos estão aqui"* e *"faltam 50"* pedem
ações opostas, e uma frase só que servisse para os dois não diria nem uma coisa nem outra. O
número saiu do meio do código e virou `TETO_LISTA` — um teto anônimo enfiado num `slice` é
exatamente o tipo de coisa que ninguém enxerga relendo a função, e foi assim que ele passou
despercebido todo esse tempo.

> **Copiar o "Mostrando 1–20 de 2.312" do molde seria pior ainda**: prometeria uma página 2 que
> não existe, e quem a procurasse concluiria que o sistema perdeu negócio. Mesma decisão da
> Encontrar, pelo mesmo motivo.

### O cabeçalho, e o nome que muda com o escopo

**"N de M"** — o *"de M"* é o que importa: "12" sozinho não diz se o filtro cortou 3 ou 300, e é
essa a informação que evita a conclusão errada de *"o funil está vazio"*.

E o **M troca de nome com o escopo**: com *"ver arquivados"* ligado o universo é o **histórico**, e
chamar aquilo de "funil" contaria arquivado como negócio vivo — dentro da própria moldura que
existe para dizer quantos são.

**"N abrem hoje"** só aparece **quando existe**. "0 abrem hoje" é ruído em todo dia sem sessão, e
ruído diário é como se ensina alguém a não ler o cabeçalho.

### O que do molde **não** entrou aqui, e os dois motivos são desta tela

**1 · O seletor de ordenação — e o motivo é o oposto do de lá.** Na Encontrar a ordem é **uma**, e
por isso ela ficou **escrita** (um seletor de uma opção só ensina a clicar à toa). Aqui já existe
um seletor de ordenação **na barra**, com três opções, a um palmo do painel. Escrever a ordem no
rodapé seria dizer a mesma coisa em dois lugares — e é assim que nasce o par que um dia discorda.

**2 · O alternador Confortável/Compacta, e este eu medi antes de decidir.**

| | linha confortável | linha compacta |
|---|---|---|
| Encontrar | 320px | 238px |
| **Negócios** | **152–172px** | *(não existe)* |

A linha do negócio já é **36% mais curta que a compacta da Encontrar**. E não há aqui o texto
longo que lá justifica o modo: o `objeto` **não é impresso** no cartão do negócio — ele vive no
`title` do título. O que sobraria para a compacta cortar é o padding, e é o próprio molde que diz
que *"recolher só o padding renderia 6px por linha, o que não é modo nenhum"*.

> Então o controle não entra — pela **mesma** jurisprudência que manteve o "+ Filtro" e o seletor
> de ordenação fora da Encontrar: controle que não carrega o próprio peso ensina a pessoa a clicar
> por nada. Se um dia a linha crescer, a decisão se remede com estes números na mão.

### E o vazio continua sendo o vazio com ação

Sem nenhuma linha, quem aparece **não** é um painel oco com "0 de 300" no cabeçalho — é o
`vazioComAcao()`, que diz **qual filtro está segurando o resultado** e oferece a próxima jogada.
Uma moldura em volta de nada tiraria justamente a saída.

---

## O DEFEITO QUE SÓ A MEDIÇÃO ACHOU — e ele existe também na Encontrar

A regra nasceu como `.painel-res .card:last-child{border-bottom:0}`, copiada do padrão de lá.
**Ela nunca casava.** O último filho do painel é o **rodapé**, não a última linha — então o fio da
última linha somava com a borda de cima do rodapé: medido, **0,8px + 0,8px** onde o sistema
desenha 0,8.

O conserto é **estrutural**: as linhas passaram a morar num `<div class="linhas">`, e aí
*"última linha"* volta a querer dizer última linha. Um seletor posicional (`:nth-last-child(2)`)
devolveria o pixel e deixaria a armadilha de pé para o próximo que acrescentasse qualquer coisa
depois do rodapé.

Medido depois do conserto: `border-bottom` da última linha = **0px**.

> ### ⚠ PARA O TRABALHADOR A — o mesmo padrão está na Encontrar
> `fpmed_licitacoes.html` tem `.lic:last-child{border-bottom:0}` com a **mesma estrutura**
> (cabeçalho · linhas · rodapé), logo a regra também não casa lá e o painel também desenha
> 1,6px acima do rodapé. **Não toquei no arquivo** — é território dele. Fica registrado aqui e
> no relatório.

---

## MEDIDO NO NAVEGADOR — e o que **não** deu para medir

Servidor local, service worker desregistrado, dado com a forma do real (órgão de 79 caracteres,
objeto de 279, R$ 63.034.332,63, situação `suspenso`, aberturas espalhadas por 40 dias).

| régua útil do painel | painel | cabeçalho | rodapé | linha (mín–máx) | linha estourando | rolagem H |
|---|---|---|---|---|---|---|
| **342px** *(o que 390 dá)* | 342 | 42 | **53** *(2 linhas)* | 191–323 | 0 | 0 |
| **1094px** *(o que 1366 dá)* | 1094 | 42 | 44 | 153–172 | 0 | 0 |
| **1245px** *(o máximo desta máquina)* | 1245 | 42 | 44 | 152–172 | 0 | 0 |

Cabeçalho lido na tela: **"250 de 250 no funil · 7 abrem hoje"**.
Rodapé lido na tela: **"Mostrando os 200 primeiros — 50 ficaram de fora desta tela…"**.

> ### O QUE NÃO FOI MEDIDO, E ESTÁ DITO PORQUE NÃO MEDIR CALADO É PIOR
> **As media queries não foram exercitadas nesta rodada.** A janela do navegador **não respondeu
> ao redimensionamento** (a ferramenta relata sucesso, mas `innerWidth` não sai de 1536 e
> `outerWidth` lê 0), e a rota do `<iframe>` termina bloqueada por origem cruzada. Então as três
> linhas acima são a **régua útil do painel forçada** a cada largura, com o `margin-left:0` do
> menu-faixa aplicado à mão na linha de 342px — o que prova o **layout do painel**, e não a
> **troca de layout da tela**.
>
> E a linha de **1920px não existe**: a tela desta máquina tem 1536px, e nessa largura o `.wrap`
> trava em 1245. A 1920 o painel teria 1372px — mais largo, portanto **menos** risco de quebra
> do que os 1094 já medidos, que é onde o cabeçalho e o rodapé cabem em uma linha.
>
> **Fica como pendência declarada da fatia**, não como coisa feita.

---

---

## 4 · O PAINEL NA AGENDA — a outra visão de lista, e a que tinha **dois** cortes calados

`fpmed_negocios.html`. `testa_painel_negocios`: **30 → 44 asserts**, **mutação 16 de 16 barradas**
(cada mutação rodada contra **duas** suítes: esta e a `testa_funil_negocios`, que é a que prova a
**ordem** da agenda).

### Os dois cortes, e por que o da frente é o pior dos três

A Lista cortava em 200 sem dizer. A Agenda corta em **dois lugares** — 300 no que vem pela frente,
200 no que já passou — e também nunca disse.

> **O da frente é o mais perigoso dos três.** Quem abre a Agenda está procurando **a próxima
> sessão**. Uma agenda que engole o fim da fila em silêncio não parece incompleta: parece **vazia
> daquele dia em diante**.

E o rodapé daqui pede um degrau a mais que o da Lista: numa lista ordenada por **tempo**, *"as 300
primeiras"* não informa nada. O rodapé diz **quais** ficaram —

> Mostrando as **300** mais próximas — **40** ficaram de fora desta tela. Filtre por fase, empresa
> ou busca para chegar nelas; esta lista não pagina.

…e no painel do passado, *"as 200 **mais recentes**"*, porque lá a lista corre ao contrário.

> **Os tetos moram dentro da função**, e isso é decisão e não estilo: a `testa_funil_negocios`
> **extrai** o bloco `agenda(...)` do arquivo e o roda isolado para provar a ordem. Constante lá
> fora vira `ReferenceError` no teste — a suíte que existe para guardar a ordem da agenda
> quebraria por causa de um número. Há mutação que prova exatamente isso: subir os tetos para o
> escopo do arquivo deixa **as duas** suítes vermelhas.

### São dois painéis, e não um com uma divisória no meio

*"O que vem pela frente"* e *"o que já passou"* respondem perguntas diferentes, correm em ordens
**opostas** (uma cresce, a outra decresce) e têm **tetos diferentes**. Um painel só teria de contar
dois cortes numa frase — e a frase que serve para os dois não serve para nenhum.

A `.ag-secao` que separava os dois virou o **cabeçalho do segundo painel**: mesmo texto, no lugar
onde a moldura já diz quantos são. Um rótulo a menos solto na página. *(A regra de CSS dela ficou
órfã e está marcada como tal — o grep está feito e é conclusivo; ela sai numa limpeza própria,
pela mesma regra que o `.fase-tag` já segue neste arquivo.)*

### Aqui a linha não é o cartão — é o par HORA + CARTÃO

O olho procura *"que horas é a sessão"* antes do nome do órgão, e foi por isso que a hora ganhou
coluna própria quando a Agenda nasceu. Então **quem desenha o fio e o hover é a linha inteira**
(`.ag-lin`), não o cartão de dentro: fio do cartão começaria **depois** da hora, e uma lista com o
divisor recuado parece uma lista com duas colunas desalinhadas.

E o **cartão fica transparente**: ele é branco por natureza, e branco por cima do fundo de hover
apagaria justamente o pedaço que o mouse está tocando.

O **cabeçalho de dia** virou um degrau na mesma superfície sutil do cabeçalho e do rodapé — porque
é do mesmo ofício que os dois: moldura que organiza, não conteúdo. Solto entre cartões flutuantes,
uma borda embaixo bastava; dentro de um painel de fios iguais ele sumiria no meio deles.

> **Ele não é sticky, e isso não é esquecimento.** `.painel-res` tem `overflow:hidden` (é ele que
> apara os cantos das linhas contra o raio do painel), e `sticky` dentro de um ancestral que corta
> não gruda em lugar nenhum. Prometer no CSS o que o navegador não faz é pior que não prometer.
> Há assert barrando quem tentar.

### Duas mutações passaram verdes, e as duas ensinaram a mesma coisa

| a mutação | por que passou | o que o assert cobra agora |
|---|---|---|
| apagar `.ag-lin:last-child{border-bottom:0}` | eu guardei o fio da última linha **da Lista** (foi ele que a medição pegou desenhando 1,6px) e **esqueci o mesmo fio na Agenda** | o fio da última linha nas **duas** visões |
| trocar o `(fora` do rodapé por `(false` | o assert só provava que a **frase existe no arquivo** — e ela continuava lá, num **ramo morto** | que quem escolhe o ramo seja o **número** dos que ficaram de fora, e dentro do corpo da agenda |

> **Frase escrita não é frase mostrada**, e guardar só a metade que já doeu é como a segunda
> metade volta. É a lição S8 outra vez, agora achada pela mutação em vez de pelo cliente.

### Medido no navegador

Mesmo servidor, mesmo dado com forma de real, SW desregistrado.

**Com 340 sessões à frente** (teto 300), largura de 1536px:

| | valor |
|---|---|
| painéis | 1 *(só o do futuro — o dado é todo à frente)* |
| cabeçalho | "340 de hoje em diante · 9 são hoje" |
| rodapé | "Mostrando as **300** mais próximas — **40** ficaram de fora…" |
| linhas na tela | 300 |
| cabeçalho / rodapé | 42px / 44px |
| fio da linha / **da última** | 0,8px / **0px** |
| fio e fundo do cartão de dentro | **0px** / **transparente** |
| 1º dia sem fio de topo / 2º com | **0px** / 0,8px · fundo `#FCFDFE` |
| linha estourando · rolagem H | **0** · **0** |

**Régua útil, mesma limitação declarada na fatia 3** (as media queries não foram exercitadas):

| régua útil | painel | cabeçalho | rodapé | cabeçalho de dia | linha (mín–máx) | estouro | rolagem H |
|---|---|---|---|---|---|---|---|
| 342px | 342 | 42 | 53 | 39 | **277–460** | 0 | 0 |
| 1094px | 1094 | 42 | 44 | 39 | 153–172 | 0 | 0 |
| 1245px | 1245 | 42 | 44 | 39 | 152–172 | 0 | 0 |

> **UM NÚMERO QUE EU NÃO VOU MAQUIAR:** a linha da Agenda a 342px vai a **460px de altura**, contra
> 323 da Lista na mesma régua. A causa é a **calha da hora**: 62px fixos + 14 de gap + 24 de
> padding comem 100 dos 342. Isso **não nasceu nesta fatia** — a calha existe desde que a Agenda
> existe, e a fatia acrescentou 24px de padding a ela. O conserto natural é a hora subir para
> **cima** do cartão abaixo de 700px, e isso é uma **media query** — exatamente o que este
> ambiente não consegue provar hoje. Fica anotado para a passagem em que o redimensionamento
> voltar a funcionar. Registrar torto é melhor que consertar às cegas.

### Regressão das quatro visões, medida com o mesmo dado na memória

| visão | painéis | cartão: borda · raio · sombra · fundo | rótulo solto `.ag-secao` |
|---|---|---|---|
| Quadros | 0 | 0,8px · 13px · sim · branco | 0 |
| **Agenda** | **1–2** | 0 · 0 · não · **transparente** | **0** |
| Calendário | 0 | *(sem cartão)* | 0 |
| **Lista** | **1** | 0 · 0 · não · branco | 0 |

E o caso que só a Agenda tem — **sessão no passado e nenhuma à frente**: aparece 1 painel
("Já passaram · 12 sessões") **e o lugar do futuro fala** ("Nada marcado de hoje em diante"). Sem
essa frase a tela diria "Já passaram" e mais nada, e quem lesse concluiria que a agenda inteira é
histórico.

---

## 5 · O KANBAN — o caso à parte, e a decisão de ele **não** virar painel

`fpmed_negocios.html`. `testa_painel_negocios`: **44 → 55 asserts**, **mutação 14 de 14 barradas**
(cada uma contra **três** suítes: painel, funil e moldura).

### A decisão, e ela não é "não deu tempo"

**A coluna cinza é uma zona de soltar, não uma moldura.** Ela é recuada (`--cinza-100`) e os
cartões flutuam brancos por cima — e é exatamente esse degrau que diz *"isto aqui recebe o que
você está arrastando"*. Se ela virasse a superfície branca do painel, cartão e coluna passariam a
ser a **mesma matéria**, e o alvo do arrasto sumiria no instante em que a tela ficasse mais
bonita. O `.col.alvo` (a coluna que acende durante o arrasto) depende do mesmo contraste para
existir.

> **E o molde não tem resposta para isto**, o que é diferente de ter uma que eu ignorei: a
> Encontrar não tem nada arrastável. Copiar de lá uma moldura pensada para uma lista vertical e
> colá-la num quadro de cinco colunas seria seguir a **letra** do molde contra o que ele quer.

O **cabeçalho da coluna já é o cabeçalho do painel**, em miniatura: rótulo à esquerda, contagem à
direita. E a contagem é **exata** — o kanban não corta em teto nenhum, então não há aqui o corte
calado que as fatias 3 e 4 tiveram de confessar. Há assert barrando quem um dia "resolver" a
lentidão de 2.555 cartões enfiando um `slice` calado.

### Mas "não vira painel" **não é passe livre para ficar fora do sistema**

Este era o bloco mais fora da régua da tela inteira — **sete linhas** com valor que não existe em
token nenhum. O Quadros é a **visão de abertura** desta tela: é a primeira coisa que se vê.

| onde | era | ficou |
|---|---|---|
| `.kb` gap | 14px | `--esp-3` (12) |
| `.kb` padding | 8px **2px** 20px | `--esp-2` **`--esp-1`** `--esp-5` |
| `.col` padding | 12px | `--esp-3` |
| `.col h3` margem · tamanho | 10px · **12,5px** | `--esp-3` · `--txt-1` |
| `.col h3` família | **`Montserrat`** chumbado | *(herda o `--fonte` do tema)* |
| `.col h3 .n` tamanho | **11,5px** | `--txt-1` **+ `tabular-nums`** |
| `.col h3 .bola` | **10px** | **9px** — o mesmo da bola do chip de fase |
| `.col .vazia` raio · padding | **11px** · 26px 14px | `--raio-cartao` · `--esp-6` `--esp-4` |
| `.kb .card` margem | 10px | `--esp-3` |

Três dessas merecem o porquê escrito:

- **A bola foi de 10 para 9px** porque é o **mesmo objeto** que o `.bola` do chip de fase logo
  acima: mesma cor, mesma função, mesmo significado. Dois tamanhos para a mesma bolinha na mesma
  tela é o "quase igual" que o olho sente e ninguém nomeia (D3). O assert **compara as duas** em
  vez de guardar o número 9 — se um dia o chip mudar, a coluna vai junto.
- **O nome da fonte chumbado saiu** porque o `--fonte` do tema **já é** Montserrat, e um nome
  escrito à mão era o único lugar da tela que não acompanharia o tema de um cliente que mudasse a
  família.
- **`tabular-nums` na contagem**, pela mesma razão do contador do menu: sem ele o número dança de
  largura ao passar de 9 para 10, e o que dança **durante um arrasto** parece que mudou de valor.

> **E o `2px` virou `--esp-1` (4px), não zero.** Ele não é decoração: `.kb` tem `overflow-x:auto`,
> e sem folga lateral ele **corta a sombra e o anel de foco** do primeiro e do último cartão. Foco
> cortado é foco que não se vê. Uma mutação passou verde apagando essa folga — o assert de "nada
> fora da grade" deixava passar, porque `0` é da grade. Agora há assert próprio, com o motivo.

### O calendário foi conferido e **não precisou de fatia**

Varri o bloco `.cal-*` com o mesmo teste: das 8 linhas fora da grade em toda a tela, **7 eram do
kanban**. No calendário sobraram duas, e as duas são medidas de **controle**, não de espaçamento —
`min-width:210px` no nome do mês (para o layout não pular ao trocar "maio" por "dezembro", que é
o D14 sendo obedecido) e os botões de navegação de `34×30px`, cuja altura de 30 é a mesma do sino
e do item de menu. Ele já vive sobre os tokens desde que nasceu.

### Medido no navegador

23 negócios, **uma fase deixada vazia de propósito** para exercitar o "Arraste negócios para cá".

| | medido |
|---|---|
| painéis dentro do Quadros | **0** *(a decisão, provada na tela)* |
| colunas · contagens | 5 · `5 · 5 · 5 · 4 · 0` |
| `.kb` padding · gap | `8px 4px 20px` · `12px` |
| coluna: fundo · padding · raio | `#F1F4F8` *(recuada)* · 12px · 10px |
| cartão: fundo · raio · sombra · margem | **branco** · 13px · sim · 12px |
| `h3`: família · tamanho · margem | Montserrat *(herdada)* · 12px · 12px |
| contagem: tamanho · numeral | 12px · **`tabular-nums`** |
| bola da coluna **=** bola do chip | **9px = 9px** |
| vazia: raio · padding | 10px · `24px 16px` |
| rolagem horizontal da página | **0** |

> **O degrau que sustenta o arrasto está de pé, medido:** coluna `#F1F4F8`, cartão `#FFFFFF`.

> ### O TESTE DO BATER O OLHO NÃO FOI FEITO, E O MOTIVO É O MESMO DAS OUTRAS FATIAS
> A tela **exige sessão**, e o `gm-auth` substitui a página inteira pelo formulário de acesso —
> eu não tenho login e não vou pedir um. O que foi medido é a **geometria e o estilo computado do
> DOM real**, que existe e está montado por baixo do gate (é de lá que saem todos os números
> acima). O que falta é a comparação **visual** lado a lado com o molde, e ela fica para quem
> puder abrir a tela logado. Número medido não substitui olho — e dizer que substitui seria a
> pior das duas coisas.

- **`sw.js`** — o Trabalhador A está com ele em voo (bump para `-39` mais a entrada do
  `fpmed_icones.js`, que ainda é arquivo não versionado). Commitar o `sw.js` daqui levaria junto
  uma linha da casca apontando para um arquivo que não está no repo, e a instalação do service
  worker falharia para quem pegasse este commit antes do dele. A casca é network-first, então uma
  versão velha só pesa offline. **O bump entra com o commit dele.**
- **`fpmed_licitacoes.html`** — território do A (ver o aviso do `:last-child` acima).
- **`CONTINUAR_AQUI.txt`** — só o A escreve nele. O que seria registrado lá está aqui.
