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
| 4 | O painel na **Agenda** (e os dois cortes calados dela) | a fazer |
| 5 | **Quadros/Kanban e Calendário** — caso à parte, decisão declarada | a fazer |

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

## O QUE ESTA FATIA **NÃO** TOCOU, E POR QUÊ

- **`sw.js`** — o Trabalhador A está com ele em voo (bump para `-39` mais a entrada do
  `fpmed_icones.js`, que ainda é arquivo não versionado). Commitar o `sw.js` daqui levaria junto
  uma linha da casca apontando para um arquivo que não está no repo, e a instalação do service
  worker falharia para quem pegasse este commit antes do dele. A casca é network-first, então uma
  versão velha só pesa offline. **O bump entra com o commit dele.**
- **`fpmed_licitacoes.html`** — território do A (ver o aviso do `:last-child` acima).
- **`CONTINUAR_AQUI.txt`** — só o A escreve nele. O que seria registrado lá está aqui.
