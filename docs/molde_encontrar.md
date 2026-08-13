# O MOLDE DO SISTEMA — medido antes de aplicar

> ## ⚖ ORDEM PERMANENTE DO DONO — 13/08/2026
> **A Encontrar não é exceção: ela é o PADRÃO.** Este documento deixou de ser "o molde de uma
> tela" e passou a ser **a linguagem visual de TODAS as telas** do sistema.
>
> 1. **O molde manda em toda tela**, não só na Encontrar: lateral navy, tokens do
>    `fpmed_tema.css`, painel com linhas, cartões, selos, a anatomia de linha do molde.
> 2. **Regra do escoteiro:** toda tela que for **tocada** daqui pra frente sai molde-ficada.
>    Nada volta pro estilo antigo, e **nada novo nasce fora do molde**.
> 3. **Tela por tela, sem apagão:** uma de cada vez — publica, prova com print lado a lado com o
>    molde, só então a próxima. O sistema nunca sai do ar.
> 4. **Onde a tela tiver dado ou função que o molde não previu**, vale o mesmo princípio que a
>    Encontrar já seguiu: adota a **roupa** do molde, **mantém a função**, e onde não há dado
>    fica **em branco honesto** — nunca chuta.
>
> As seções abaixo continuam valendo palavra por palavra; o que mudou é o **alcance**. E as
> decisões já tomadas na Encontrar (as fugas medidas, o que do molde **não** entrou e por quê)
> passam a ser jurisprudência para as próximas telas, e não caso isolado.

---

## A MEDIÇÃO ORIGINAL — o molde da Encontrar

**Fonte da verdade visual:** `Tela Encontrar FPMED.zip` (Downloads do dono), exportado do
Claude Design em 13/08/2026. Dentro:

- `design_handoff_encontrar_fpmed/README.md` — a especificação, com a seção **Design Tokens**
  que manda;
- `design_handoff_encontrar_fpmed/Encontrar.dc.html` — o código-fonte do protótipo;
- `Encontrar.html` — o protótipo completo (477 KB), abre no navegador.

**Regra do dono: "O MOLDE MANDA".** Copiar os valores exatos, não reconstruir de memória nem
aproximar no olho. *"A única fuga permitida é o que a legibilidade AA obrigar, medida e provada."*

> **O zip fica FORA do repo** (`.gitignore`), como a amostra anterior: é referência, não produto.
> O que entra aqui é o resultado — token e tela — e esta medição.

---

## 1 · A MEDIÇÃO, QUE É A PRIMEIRA COISA QUE SE FAZ COM UM MOLDE

Rodei a fórmula da WCAG em **41 pares de texto que o molde usa de verdade** — não numa amostra
bonita: cada linha da seção "Design Tokens" e das descrições de tela.

**38 passam. Três reprovam.** E o molde sai muito bem nessa conta: a paleta dele é sólida, e as
três exceções são as de sempre — texto pequeno em cinza claro, e uma cor de marca virando fundo
de botão.

| medido | mínimo | onde | par |
|---|---|---|---|
| **2,67:1** | 4,5 | **botão primário "Buscar"** | `#FFFFFF` sobre `#2CA9E0` |
| 2,90:1 | 4,5 | sufixo "· visto" (11px) | `#8C99A9` sobre `#FFFFFF` |
| 2,85:1 | 4,5 | dica de atalhos do rodapé (11,5px) | `#8C99A9` sobre `#FCFDFE` |

### O botão primário é o achado sério, e este projeto já pagou por ele

`#2CA9E0` é o azul da marca FPMED, e o molde o usa como **fundo do botão "Buscar", com texto
branco**. Isso dá **2,67:1** — pouco mais da metade do mínimo. O rótulo do botão mais clicado da
tela ficaria difícil de ler para quem enxerga menos.

> **É a lição S12 inteira, de novo.** Ela nasceu exatamente assim: um azul de ação que "parecia
> bonito" e nunca tinha sido medido (`#1b8dc4`, 3,71:1). O tema já resolveu isso uma vez — e é
> por isso que existe uma rampa de azul com **ofícios separados**, escrita no `fpmed_tema.css`:
>
> ```
> --azul-500  #2CA9E0   a MARCA — preenchimento, barra, acento. NÃO carrega texto branco.
> --azul-600  #1576A5   A COR DA AÇÃO — fundo de botão, com branco por cima: 5,04:1
> --azul-700  #115D84   link, texto azul, e o hover do botão primário
> ```

### As duas fugas — e elas são as menores possíveis

**Nenhuma das duas inventa cor: as duas usam tons que já estão no próprio molde.**

| onde | o molde diz | vai ficar | por quê |
|---|---|---|---|
| fundo do botão primário | `#2CA9E0` (2,67:1) | `#1576A5` (5,04:1), hover `#115D84` | o `#2CA9E0` continua sendo a marca em **tudo** que não carrega texto: barra de urgência, ícone ativo da sidebar, quadrado do logo, foco, ponto do calendário, borda do chip. Só o **fundo com letra branca em cima** troca de degrau |
| `#8C99A9` como texto | `#8C99A9` (2,85–2,90:1) | `#6B7787` (4,55:1) | é o **tom imediatamente ao lado, do próprio molde** — ele já o usa na referência "nº 214/2026 · Compras.gov.br". A diferença é quase invisível lado a lado; a legibilidade não é |

O `#8C99A9` **não sai do tema**: ele fica no ofício em que é legítimo — ponto separador, trilho
de barra, ícone desligado, borda. Ele para de carregar texto, que é a mesma correção já feita
no `--cinza-400` em 13/08.

---

## 2 · O QUE MAIS A MEDIÇÃO MOSTROU (e é bom)

- A **sidebar navy** é confortável: item em repouso 10,77:1, rótulo de grupo 5,28:1, o
  "HOSPITALAR" em `#8FD3F2` dá 10,44:1. Nada a mexer.
- O **cartão de destaque navy** passa inteiro (rótulo 10,77:1, legenda 6,77:1).
- Os **selos** todos passam com folga (info 5,92 · sucesso 6,27 · aviso 5,51 · perigo 5,92 ·
  neutro 11,45).
- O **grifo do termo** (`#0A1526` sobre `#FEF3C7`) dá 16,43:1 — e é o mesmo amarelo que a fatia
  3b já usa.
- O **botão verde "Ao funil"** (`#12300A` sobre `#8DC63F`) dá 7,08:1. O molde acertou onde este
  projeto já tinha medido que o verde da marca não serve para texto branco.

---

## 3 · O QUE MUDA NOS NOSSOS TOKENS

O molde troca a família de cinza **outra vez** (o fundo sai de `#F1F5F9` para `#FAFBFC`, e os
textos ganham o navy `#0A1526`). Isso é esperado: a fatia 1 do item 7 adotou a *amostra*, e o
molde é a versão final e mais detalhada da mesma direção.

Principais deltas a aplicar em `fpmed_tema.css`:

```
fundo da página   #F1F5F9  ->  #FAFBFC
texto principal   #1E293B  ->  #0A1526
superfície sutil  (não existia) -> #FCFDFE
bordas            uma só   ->  três: #E9EDF3 cartão · #E4E9F0 controle · #EEF1F6 divisor
navy da marca     (não existia) -> #0E1B33   (sidebar, cartão de destaque, barra flutuante)
sombra de cartão  0 1px 2px rgba(30,41,59,.04)... -> 0 1px 2px rgba(16,26,43,.04)
raios             16/12/999 -> a escala do molde: 4·5·6·7·9·10·11·12
tipografia base   14px     ->  13px, line-height 1.45
```

> **ATENÇÃO NA TIPOGRAFIA:** o molde é uma tela **mais densa** que a nossa (base 13px contra
> 14px). Isso é decisão de produto, não só de token — e ela vale porque a Encontrar é uma lista
> longa. Mas ela reduz o corpo de **todas** as telas que carregam o tema. A fatia dos tokens
> tem que conferir a Encontrar **e** o Negócios depois de mexer no `--txt-2`.

---

## 4 · A PARTE B — ITENS NOVOS DA FILA (ordem do dono: anotar, **não construir agora**)

O dono separou o pedido em duas partes. A **Parte A** é só o visual do que já existe. Estes
cinco viram **itens numerados da fila**, um por rodada — e o desenho e o comportamento de cada
um **já estão prontos no README do molde**, então quando chegar a vez não há nada a inventar:

| nº | item | por que não entra agora |
|---|---|---|
| 9 | **Nota de aderência** ao portfólio ("92% aderente" + barra) | precisa de **backend**: cruzamento do edital × catálogo/mix do cliente. Não é tela |
| 10 | **Paleta de comandos ⌘K** funcional | na Parte A entra **só o visual do gatilho** |
| 11 | **Drawer de detalhe** do processo (métricas 2×2, aderência, histórico no órgão, ações) | é tela nova inteira |
| 12 | **Navegação por teclado** (J/K/↑/↓, Enter, F, X, /, Esc) | comportamento, não acabamento |
| 13 | **Barra de seleção em massa** flutuante (Ao funil · Marcar visto · Exportar) | depende de seleção múltipla, que também não existe |

### E os prints de referência

O segundo zip trouxe `screenshots/` — **01-visao-geral · 02-selecao-e-paleta · 03-calendario**.
São eles o alvo do *teste do bater o olho*: print da tela real ao lado do print do molde.

> **Eles foram tirados em janela estreita** (o dono avisou), e o layout real vai até **1440px**.
> Então a comparação é de **acabamento** — cor, peso, espaçamento, hierarquia — e não de
> quantas colunas cabem. Comparar largura contra largura acusaria diferença onde não há.

E duas coisas do molde que são **dado fictício** e não podem virar número na tela:
"945.699 licitações na base", "9.050 novas", "2.312 resultados", "71 no funil". Os quatro KPIs
ligam nos números **reais do banco** — ordem expressa. Um número bonito de demonstração virando
número de produto é a lição S6 esperando acontecer.

E o **logo do molde é placeholder** (escudo com pulso). Vale o logotipo oficial da FPMED —
nunca, em hipótese alguma, marca da GlobalMed.

---

## 5 · A ORDEM DE ATAQUE

1. **Tokens** (`fpmed_tema.css`) com os valores exatos + as duas fugas medidas. O `testa_tema`
   remede os pares sozinho; é ele que prova que a troca não afundou nada.
   **[FEITO — 13/08]** ver a seção 6 abaixo: o que entrou, o que divergiu e o que a medição
   corrigiu no plano.
2. **Sidebar navy 228px** — grupos, contadores à direita, item ativo, badge "IA".
   **[FEITO — 13/08]** ver a seção 7.
3. **Header sticky** — breadcrumb, gatilho ⌘K (visual), selo "Base sincronizada", sino.
   **[FEITO — 13/08]** ver a seção 8.
4. **Fila de 4 KPIs**, com os números reais do banco. **[FEITO — 13/08]** ver a seção 9.
5. **Barra de busca** com chips, "+ Filtro" tracejado e o botão azul.
   **[FEITO — 13/08]** ver a seção 10.
6. **Painel de resultados** — linha rica, barra de urgência, selos, `<mark>`, alternador
   Confortável/Compacta. **[FEITO — 13/08]** ver a seção 11.

Publica, prova com print, e só então o Negócios.

---

## 6 · PASSO 1 FEITO — O QUE ENTROU, E AS TRÊS COISAS QUE A MEDIÇÃO MUDOU NO PLANO

`fpmed_tema.css`, 13/08. A suíte `testa_tema` saiu de **84 para 102 asserts**, e o total do
projeto de 3.356 para 3.374 — **0 falhas em 91 suítes**.

**Entrou tudo que a seção 3 listou**, mais o que a tela vai precisar e o tema não tinha:

- os **dez cinzas** trocados pelos do molde (fundo `#FAFBFC`, texto `#0A1526`);
- as **três bordas** com ofício declarado (divisor `#EEF1F6` · cartão `#E9EDF3` · controle
  `#E4E9F0`), e um assert que guarda a **ordem** entre elas, não os valores;
- **superfície sutil** e os **dois estados de linha** (hover ≠ ativa, com assert — um valor só
  para os dois faz a navegação por teclado sumir no instante em que alguém encosta o mouse);
- o **navy da marca** com as suas quatro tintas, todas medidas contra ele (10,78 · 6,77 · 5,28 ·
  10,45 — a sidebar do molde não precisou de fuga nenhuma);
- os **sete pares fechados de sinal** (info, bom, atenção, perigo, neutro, normal, grifo), cada
  um com tinta **e** fundo, todos no bloco de contraste da suíte;
- a **escala de raios** de seis degraus, com assert de monotonia.

### As três coisas que a medição mudou

**1 · A tipografia NÃO baixou para 13px, e o aviso da seção 3 estava exagerado.**
Medindo elemento a elemento em vez de olhar só a linha "base 13px" do molde: título de linha
14px = nosso `--txt-2` (14) · meta 12px = `--txt-1` (12) · número de KPI 24px = `--txt-5` (24).
Ou seja, **a nossa escala já casa com o molde nos elementos que a tela desenha**; o 13px do molde
é o tamanho *herdado* pelo `<html>`, que quase nada usa diretamente. Baixar o `--txt-2` para 13
teria afastado o título da linha do valor do molde, não aproximado — e de quebra encolheria o
Negócios sem motivo. **Nada mudou na tipografia.** A `line-height` segue 1.5 e não 1.45, por D4,
pelo mesmo precedente da fatia 2 ("token vence, por ordem da constituição").

**2 · A tinta da sombra do cartão de destaque diverge do molde, de propósito.**
O molde usa `rgba(16,26,43)` no cartão e `rgba(14,27,51)` — o próprio navy — no destaque. A
segunda tem 37 pontos de distância entre canais e reprova no assert de *sombra neutra* (teto 35),
que existe para barrar brilho colorido de marca. A 50% de opacidade, atrás de um cartão navy, a
diferença entre as duas está abaixo do que o olho separa; **duas tintas de sombra no sistema,
não**. Ficou a tinta de sobreposição do próprio molde, `rgba(10,21,38)`.

**3 · Dois asserts meus, escritos hoje de manhã, mediam o meio — e o molde os expôs.**
Os dois nasceram com a *amostra* e viraram lei sem ter sido regra:

| assert | o que cobrava | por que caiu | o que cobra agora |
|---|---|---|---|
| 25b | desfoque de repouso ≥ 12px ("sombra macia") | era a **receita** da amostra, não a regra; o molde resolve pelo caminho oposto (sombra de 2px + borda de 1px) | a **escada** de elevação: repouso < elevado < o que paira, e repouso discreto (alfa ≤ .12) |
| 29b | degrau de luminância ≥ 0,05 entre página e cartão | o molde põe a página a **3,7 pontos** do branco e separa o cartão pela **borda** | o cartão tem fronteira: **ou** o degrau do fundo, **ou** uma borda que o desenhe |

> É a lição S8 duas vezes, no mesmo arquivo, no mesmo dia. E o padrão dela ficou claro: assert
> que nasce logo depois de eu **gostar** de uma solução tende a guardar a solução, não a promessa.

### O que ficou fora, e por quê

Os raios de **11px** (barra flutuante de seleção) e **12px** (paleta ⌘K): as duas peças são da
Parte B, que o dono mandou anotar e não construir. Token sem dono envelhece antes de nascer.

---

## 7 · PASSO 2 FEITO — A SIDEBAR NAVY

`limedtec-menu.js`, 13/08. Suíte `testa_menu_lateral`: **44 → 52 asserts, mutação 13 de 13
barradas**. Total do projeto **3.382 / 0 falhas / 91 suítes**.

O menu era **branco com borda à direita**; virou a superfície escura do molde: 228px, `#0E1B33`,
item de 30px com raio 6, ícone de 14px, rótulo de grupo em `--navy-rotulo`.

> **Por que isso não é "trocar de cor".** Com a sidebar branca, ela e a área de conteúdo eram a
> **mesma superfície** separada por uma linha de 1px — o olho tinha que procurar onde acabava a
> navegação e começava o trabalho. O navy resolve isso sem gastar uma borda: moldura escura,
> palco claro, e a fronteira é a diferença de matéria. E ele **não rouba a atenção**, porque a
> tinta dos itens em repouso é discreta e só o item aceso ganha fundo, peso e ícone azul.

### O contador existe, e nasce vazio

O molde põe número em quatro itens (Buscar 9.050 · Radar 12 · Desertas 38 · Negócios 71). **Os
quatro são dado fictício de demonstração** — está escrito no README dele. Então entrou o **slot**,
e quem o preenche é a tela, via `LimedtecMenu.contador(id, n, destaque)`. Sem chamada, nada
aparece.

> `contador(id, null)` **esconde** em vez de escrever "0". Se a leitura do banco falhou, a tela
> não sabe quantos são — e um "0" aceso ali afirma "não há nenhum", que é outra coisa e pode ser
> falsa. É a lição S6 dentro do menu, e tem assert.

Os números reais entram no **passo 4**, junto com os KPIs, das mesmas leituras.

### Duas revisões de decisão, as duas declaradas

**1 · O texto do item desceu de `--txt-2` (14px) para `--txt-1` (12px)** — e isso corrige a
divergência nº 1 que este projeto tinha declarado de manhã. O texto anterior dizia *"o protótipo
usa 12,5px, que não existe na nossa escala; fica o `--txt-2`, o menu fica um fio maior e ganha
legibilidade"*. Aquilo valia para o menu **branco e espaçado**. Na linha de 30px do molde, 14px
não é um fio maior: é texto fora da régua onde foi desenhado. E o `--txt-1` **sempre foi** o
degrau mais próximo dos 12,5px — a escolha da manhã tinha ido para o lado errado.

> E a legibilidade **não caiu, foi medida**: o item em repouso saiu de `--cinza-600` sobre branco
> (6,17:1) para `--navy-tinta` sobre navy (**10,78:1**).

**2 · A barra da esquerda do item aceso saiu.** É a única peça do desenho anterior que não trocou
por equivalente: com o item virando uma pílula arredondada de 30px *dentro* da sidebar, uma barra
colada na borda esquerda ficaria **fora** da pílula — marcando o menu, não o item. O fundo faz o
mesmo trabalho, e é o que o molde usa. Os três sinais do item aceso continuam três: fundo, peso e
cor do ícone.

### O rodapé é o nosso, e isso é decisão, não esquecimento

O molde põe aqui um **bloco de usuário** (avatar, nome, "Plano Empresarial", chevron). Não entrou:
essa informação já é impressa pelo `gm-auth.js` na etiqueta fixa do canto superior direito, em
**todas as dez telas**. Identidade em dois lugares é pior que em um — no dia em que uma
desatualizasse, ninguém saberia qual acreditar. Ele entra junto com o conserto do `gm-auth.js`,
que está registrado como dívida e bloqueado pelas 8 telas ainda escuras.

### A mutação, e o instrumento torto que ela pegou

13 mutações, **13 barradas** — mas a primeira rodada foi 11 de 13, e as duas que passaram verdes
ensinaram coisas diferentes:

- **buraco de assert real:** tirei o `tabular-nums` do contador e a suíte continuou verde. O
  comentário do CSS explicava por que ele existe; explicação não é guarda. Virou assert.
- **instrumento torto (S9/S10 de novo):** a mutação *"o menu passa a se montar sozinho"* trocava
  a primeira ocorrência de `[data-limedtec-menu]` — que está no **comentário de cabeçalho**, não
  na chamada. Ela nunca chegou a mutar o código. Corrigida para mutar a chamada; a suíte barrou.

### Medido no navegador (SW desregistrado, servidor local)

| largura | rolagem horizontal | menu |
|---|---|---|
| 390 | 0 | faixa horizontal navy (`flex-direction: row`) |
| 1366 | 0 | coluna de 228px |
| 1920 | 0 | coluna de 228px |

Nas **duas** telas que carregam o menu (Encontrar e Negócios). Item aceso confirmado em cada uma
(Buscar e Negócios), com fundo `#243045` e ícone `#2CA9E0`.

---

## 8 · PASSO 3 FEITO — O HEADER STICKY, E O SELO QUE DEIXOU DE SER ENFEITE

`fpmed_licitacoes.html`, 13/08. Suíte nova `testa_header_encontrar` (**34 asserts, mutação 18 de
18 barradas**). Total do projeto **3.416 / 0 falhas / 92 suítes**.

O header substituiu **duas** faixas de altura cheia — a `topfaixa` cinza (← Sistema · telefone ·
slogan) e o cabeçalho branco com o H1 solto — por **uma linha de 52px, sticky**. Ganhou trilha,
gatilho de busca e o selo da base; o H1 desceu para o conteúdo, com subtítulo e a ação da tela.

### As quatro decisões que não são "copiar o molde"

**1 · O "← Sistema" virou a raiz da trilha.** Há ordem expressa do dono — *"tela sem porta de
saída é beco"* — e duas suítes já pegaram isso antes. Como link solto ele era mais um botão; como
raiz da trilha é o mesmo caminho de volta dentro da peça que já existe para dizer onde se está. O
molde tem duas migalhas; aqui são três, e a primeira é a saída.

**2 · O gatilho diz o que faz.** No molde ele abre a **paleta ⌘K** e escreve "Buscar em todo o
sistema". A paleta é Parte B. O desenho é o do molde; o texto é **"Buscar nesta tela"**, que é o
que ele faz — e a tecla `⌘K` em pílula ficou de fora pela mesma razão. Um controle escrito "todo
o sistema" que busca só nesta tela não é acabamento, é uma mentira com a roupa certa. Os dois
voltam juntos, no dia da paleta.

**3 · O selo verde fixo do molde virou instrumento.** Este é o ponto do passo.

> Um selo que diz sempre a mesma coisa não informa — ele só **afirma**. E este projeto já viu a
> coleta parar **duas vezes** sem ninguém notar; nas duas, um verde fixo teria mentido com
> confiança durante dias.

Ele lê o estado de verdade pelo **mesmo motor do sino e do e-mail de alarme**
(`fpmed_alarme_coleta.js`) — uma régua só de "isto é alarme?", três canais dizendo a mesma coisa
sobre o mesmo banco. Quatro estados, e o verde é um deles:

| estado do banco | o selo |
|---|---|
| em dia | 🟢 "Base sincronizada" *(o do molde)*, com o último dia fechado no `title` |
| nenhum dia fechado | 🟡 "O índice ainda não fechou um dia inteiro" |
| índice atrasado · agendador parado | 🔴 o título do alarme |
| a leitura falhou | ⚪ "Base: não sei" — **cor própria**, nem verde nem vermelha |

E se o motor não carregar, **o selo some**. A única coisa pior que não ter o selo é ter um verde
que ninguém alimentou.

**4 · "Salvar busca" mudou de lugar, e não é botão novo.** É o `salvarJornal()` que já existia,
e ele morava **dentro** do painel "Meus Jornais" — que nasce fechado. Ou seja: para salvar a
busca da tela era preciso abrir o painel das buscas **já salvas**. Agora ele fica ao lado da
busca que salva (D7), e o painel volta a ser só o lugar de gerenciar. A cópia antiga saiu — dois
botões para a mesma ação é como nascem dois comportamentos.

### Três defeitos que só o navegador mostrou

1. **A etiqueta do `gm-auth` cobria o gatilho e o selo.** Ela é `position:fixed` no canto superior
   direito com `z-index: 2147483000`; com a `topfaixa` antiga isso não incomodava, porque aquela
   faixa tinha o lado direito vazio. Entrou uma **reserva medida** (`reservaAuth()` lê a largura
   real da etiqueta — ela muda com o tamanho do e-mail; um valor fixo em px estaria certo hoje e
   errado no próximo endereço, e erraria em silêncio).
2. **E a reserva criou o defeito seguinte, que é pior:** aplicada em toda largura, ela come a
   faixa inteira em 390px — 309px de reserva num strip de 390 deixa 33px, e **a trilha encolhia
   para zero**. A porta de saída desaparecia no celular: o "beco" que a ordem do dono proíbe,
   criado por um conserto de outra coisa. Só apareceu na medição das 3 larguras. A reserva passou
   a valer só acima de 900px — e ali ela não faz falta, porque abaixo disso o menu vira faixa
   horizontal e quem fica sob a etiqueta é ele, não o header.
3. **O botão "Instalar aplicativo" caía fora da régua.** O `limedtec-pwa.js` pendura o botão como
   último filho do elemento marcado com `data-limedtec-instalar`; no `.topo` (largura total) ele
   nascia a 235px, contra os 315px de todo o resto. O gancho passou para a faixa interna. O
   `limedtec-pwa.js` **não foi tocado**: é arquivo de molde, e o que vale para qualquer cliente
   conserta-se na fábrica.

### E uma consequência do passo 1 que este passo pagou

`.cartao-busca` e `.lic` foram desenhados **sem borda**, com o comentário *"a sombra macia já
desenha a fronteira, e os dois juntos são cara de template (D6)"*. Era verdade com a sombra de
16px da amostra. Com a do molde (2px a 4%) não sobrou fronteira nenhuma sobre um fundo a 3,7
pontos do branco — medido no navegador: `border-top-width: 0px`. A borda voltou nos dois. O molde
não se contradiz: ele usa borda de 1px **e** sombra fraca em todos os cartões; o que D13 proíbe é
sombra **pesada** com borda grossa.

### Dois asserts alheios reapontados (lição S8, oitava vez nesta obra)

| suíte | cobrava | por que caiu | cobra agora |
|---|---|---|---|
| `testa_itens_edital` 82 | a **linha inteira** do `_aoAutenticar`, letra por letra | quebrou em 11/08 (Negócios ganhou um passo) e de novo hoje (Encontrar ganhou dois) — nas duas, nada tinha piorado | que `abreLeitorNaBarra()` seja chamada **dentro** do boot único, e que haja **um** ponto de chamada |
| — | — | e o extrator do corpo era um regex não-guloso que parava na primeira chave interna, entregando meio corpo | contagem de chaves balanceadas |

### Medido no navegador (SW desregistrado, servidor local)

| largura | rolagem horizontal | header | trilha visível | trilha e H1 na mesma régua |
|---|---|---|---|---|
| 390 | 0 | sticky, 53px | sim | sim |
| 700 | 0 | sticky, 53px | sim | sim |
| 1366 | 0 | sticky, 53px | sim | sim |
| 1920 | 0 | sticky, 53px | sim | sim |

Os **cinco** estados do selo foram exercitados na tela, com o motor de verdade, e cada um caiu na
cor certa — incluindo o "motor ausente", que esconde o selo.

---

## 9 · PASSO 4 FEITO — OS QUATRO INDICADORES, LIGADOS NO BANCO

`fpmed_licitacoes.html`, 13/08. `testa_header_encontrar`: **34 → 46 asserts, mutação 29 de 29
barradas**. Total do projeto **3.428 / 0 falhas / 92 suítes**. Prova nova contra o banco:
`tools/prova_indicadores.js`.

### Os números, medidos no banco de verdade

| cartão | número real | o do molde |
|---|---|---|
| Licitações **no índice** | **3.201** | 945.699 |
| Novas em 24 h | **4** | 9.050 |
| Em acompanhamento *(destaque navy)* | **9** | 71 |
| Abrem hoje | **28** | 11 |

### O rótulo do primeiro cartão não é o do molde, e essa é a decisão do passo

O molde escreve **"Na plataforma"** embaixo de 945.699. O nosso índice tem 3.201 e cobre 7 UFs.

> **"Na plataforma" ao lado de 3.201 faria alguém concluir que há 3.201 licitações no Brasil.**
> É a mesma armadilha que o Radar já carrega por escrito desde 08/08 — *a contagem é do NOSSO
> índice, e um número baixo pode significar "ainda não coletamos", nunca "não tem"*.

O rótulo virou **"Licitações no índice"** e a legenda diz **"o que nós já coletamos do PNCP — não
é o Brasil inteiro"**. Há assert proibindo o rótulo do molde voltar.

### Duas filas de KPI na mesma tela, e isso é de propósito

A tela **já tinha** uma fila de indicadores (`#kpis`). Elas respondem perguntas diferentes, e isso
precisa estar dito para a próxima pessoa não apagar uma achando que é cópia da outra:

- **os novos, no topo** falam da **base** — quanto índice temos, o que entrou, o que abre hoje,
  quanto está no funil. Existem **antes** de qualquer busca, e são o que se olha para decidir se
  vale procurar hoje;
- **os antigos, sobre a lista** falam da **busca** — quantas bateram, quanto somam, quantas têm
  aderência. Só existem **depois** de buscar.

### O que falha vira traço, nunca zero

As quatro contagens são **leituras independentes**, de propósito: a do funil lê `negocios`, que é
tabela de **gestor** — um vendedor recebe 403 ali e 200 nas outras três. Com uma leitura só, o 403
de uma derrubaria as quatro, e a tela ficaria muda sobre o índice por causa de uma permissão que
não tem nada a ver com ele.

> E o que falha vira **"—"** com o motivo no `title`. *"0 licitações no índice"* e *"não consegui
> contar"* são afirmações diferentes, e a primeira faz alguém concluir que o sistema está vazio.
> Lição S6 — a mesma que já custou um fechamento mensal invertido nesta casa.

Provado no navegador **sem sessão**: as quatro leituras respondem 401 e os quatro cartões mostram
"—" com *"não consegui contar: HTTP 401 — sem permissão de leitura"*.

### A contagem é barata, e ela desconfia do servidor

`select=id&limit=1` com `Prefer: count=exact`; o total sai do `content-range`. A tela não baixa
3.201 linhas para escrever "3.201". E se o `content-range` vier **sem** o total, a contagem
**falha** em vez de virar zero — o PostgREST manda `*` quando não conta, e ler isso como 0 seria a
lição S1 outra vez (o servidor respondendo outra coisa, calado).

A `prova_indicadores.js` conta **duas vezes por caminhos diferentes** — pelo `content-range`
(o caminho da tela) e baixando as linhas paginado (o caminho lento) — e compara. Os quatro
bateram. Ela também trava, pelo avesso, que **nenhum** dos quatro números seja um dos fictícios do
molde, e que o índice não esteja vazio (quatro zeros passariam em todos os outros asserts).

> **O que a prova não prova, e está dito nela:** ela usa a `service_role`, que ignora a RLS. Ela
> prova a **consulta** e o **número**, não a permissão.

### E os contadores do menu acenderam, da mesma leitura

O slot nasceu no passo 2 esperando quem tivesse o número; quem tem é esta função. **Buscar 4**
(verde, porque quer dizer novidade) e **Negócios 9** (neutro). Duas leituras para o mesmo número —
uma para o cartão, outra para o menu — é como nascem dois números que um dia discordam na mesma
tela.

**Radar e Desertas continuam vazios.** O molde numera os dois (12 e 38) e os dois são fictícios;
eu não tenho a contagem deles sem inventar uma consulta nova para cada um. Slot vazio é honesto;
número chutado, não.

### Medido no navegador

| largura | colunas | rolagem horizontal | cartão estourando |
|---|---|---|---|
| 390 | 1 | 0 | não |
| 900 | 2 | 0 | não |
| 1366 | 4 | 0 | não |
| 1920 | 4 | 0 | não |

---

## 10 · PASSO 5 FEITO — A BARRA DE BUSCA, E OS CRITÉRIOS QUE MUDARAM DE LUGAR

`fpmed_licitacoes.html`, 13/08. `testa_pesquisa_avancada`: **71 → 82 asserts, mutação 11 de 11
barradas**. Total do projeto **3.439 / 0 falhas / 92 suítes**.

A busca era **um campo com uma lupa colada por dentro e um quadradinho azul à direita**. Agora é
**uma caixa** que contém tudo o que a busca é: a lupa, os critérios ativos em chip, o que se
digita e o botão.

### A mudança que vale: os critérios entraram na barra

Os critérios ativos (portal, disputa, situação, órgão, faixa de valor, SRP, desertas) **já
apareciam** — mas numa fila de pílulas de **só leitura** acima da lista, longe de onde a busca se
faz. Quem quisesse desligar um tinha de achar o campo dele na coluna da esquerda.

Agora são **chips dentro da barra**, cada um com um `×`. O critério fica onde a busca está, e sai
com um clique.

> **E eles não são um segundo filtro.** O rótulo de cada chip sai do **mesmo `refinoDe()`** que a
> lista usa para filtrar. Se o refino ganhar um critério, o chip nasce junto.

Para isso a lista de critérios passou a ser de **objetos** (`criteriosRefino`), e a `pillsRefino`
virou uma **vista** dela — porque o chip precisa saber de que **campo** veio, e a frase corrida do
resumo do jornal continua precisando ser frase:

| critério | chip (rótulo fraco + valor forte) | frase (resumo do jornal) |
|---|---|---|
| SRP excluído | `registro de preços` **sem SRP** | "sem registro de preços" |
| valor mínimo | `a partir de` **R$ 1.000** | "≥ R$ 1.000" |
| só desertas | `só` **desertas/republicáveis** | "só desertas/republicáveis" |

> Duas listas — uma para os chips, outra para as frases — seriam a garantia de que uma esqueceria
> o critério novo. E seria a de leitura, que é justamente a que o operador usa para entender por
> que a busca devolveu pouco.

O `só desertas` tem **caminho próprio**: ele não é campo de formulário, é estado da tela. Se o `×`
tentasse limpar um campo inexistente, o chip sumiria e o filtro continuaria ligado — a tela
passaria a filtrar sem dizer que filtra. Há assert.

### A fuga medida entrou no botão

O molde pinta o **"Buscar"** com o `#2CA9E0` da marca e texto branco por cima: **2,67:1**, pouco
mais da metade do mínimo. É a lição S12 inteira, de novo — e o tema já tinha a saída pronta, com
ofícios separados na rampa: **`--azul-600` (#1576A5), "a cor da ação", 5,04:1**. O `#2CA9E0` segue
sendo a marca em tudo que não carrega texto — inclusive na lupa ali ao lado, que é dele.

> O assert existe para que *"aproximar mais do molde"* não signifique um dia trocar o 600 pelo 500
> aqui — que é a coisa mais natural do mundo para quem está comparando dois prints e não mediu.

E o botão **voltou a ter texto**: era um quadrado com uma lupa dentro, **dentro de um campo que já
tinha outra lupa** — dois ícones iguais na mesma peça, um decorativo e outro clicável.

### O "+ Filtro" do molde não entrou, e o motivo é do próprio arquivo

No molde ele abre um popover com os campos disponíveis — **porque lá não há coluna de filtros**; a
tela dele é só a lista. Aqui a coluna existe e está **sempre aberta** à esquerda. Um botão para
abrir o que já está aberto é exatamente o *"link que não faz nada"* que este arquivo **já removeu
uma vez** (a "Pesquisa avançada", quando os filtros viraram coluna fixa).

### Um assert alheio reapontado, e ele merecia

`testa_tema_tela_propria` 15 — *"não sobrou uma única cor chumbada na tela"* — varria o **arquivo
inteiro, comentário incluído**. Ficou vermelho quando o comentário do botão registrou a medição
que **justifica a fuga** (*"o molde usa #2CA9E0 e dá 2,67:1; o token da ação é #1576A5, 5,04:1"*).

> Ou seja: o assert reprovava justamente a **anotação de por que não há cor chumbada ali**. Um
> assert que só fica verde se eu apagar a explicação está contra a lei L6, não a favor dela.
> Passou a ler o arquivo sem comentário; cor chumbada em CSS continua reprovando igual.

### Medido no navegador (com 3 critérios ligados)

| largura | altura da barra | chips | barra estourando | rolagem horizontal |
|---|---|---|---|---|
| 390 | 234px *(um chip por linha)* | 3 | não | 0 |
| 900 | 74px | 3 | não | 0 |
| 1366 | 42px | 3 | não | 0 |
| 1920 | 42px | 3 | não | 0 |

O `×` foi exercitado na tela: tirar o chip de situação **limpou o campo** `f-sit`; tirar o de
desertas **desligou o estado** `_soDesertas`. Nos dois casos a lista repintou.

---

## 11 · PASSO 6 FEITO — O PAINEL DE RESULTADOS. **A ENCONTRAR ESTÁ COMPLETA.**

`fpmed_licitacoes.html`, 13/08. Suíte nova **`testa_painel_resultados`** (20 asserts, **mutação
15 de 15 barradas**). Total do projeto **3.459 / 0 falhas / 93 suítes**.

Os resultados eram uma **pilha de cartões soltos** — cada um com borda, sombra e 16px de respiro
entre eles. Agora são **linhas dentro de um painel**, com cabeçalho e rodapé.

> **Por que isso não é gosto.** Trinta cartões flutuando são trinta fronteiras desenhadas, trinta
> sombras e vinte e nove buracos — e o olho reprocessa "onde começa o próximo" a cada rolagem. Num
> painel a fronteira é desenhada **uma** vez, e o que separa as linhas é o fio mais leve do
> sistema. A lista fica mais densa sem ficar apertada.

**A anatomia de dentro da linha não mudou.** O selo do órgão, o título, o objeto com o grifo, as
etiquetas, os quatro dados no padrão rótulo-fraco/valor-forte e os botões continuam iguais — eles
vieram da fatia 3b com razões medidas, e o molde não desmente nenhuma. Mudou a **moldura**, não o
conteúdo.

### O alternador de densidade — o único controle novo, e ele é do molde

Confortável e Compacta, com a escolha guardada no navegador. Ele muda **só o respiro**: nenhum
dado aparece ou some. Medido: a linha vai de **320px para 238px**.

> **A compacta recolhe o objeto, e não só o padding.** Num modo de varredura o que ocupa altura é
> o texto do objeto (3 linhas → 1). Recolher só o padding renderia 6px por linha — o que não é
> modo nenhum.
>
> E `localStorage` **estoura em navegação privada** em alguns navegadores. Uma preferência de
> layout não pode levar junto o resultado da busca — a `densidade()` é chamada montando o
> cabeçalho, então sem `try/catch` a `render` inteira morre no meio. Há assert que exercita
> exatamente esse caso.

### O cabeçalho não pode mentir, e o rodapé não pode fingir

- **"N de M publicadas no período"** — o *"de M"* importa: "12" sozinho não diz se o filtro cortou
  3 ou 300, e é essa a informação que evita a conclusão errada de *"não tem nada publicado hoje"*.
- **"N abrem hoje"** só aparece **quando existe**. "0 abrem hoje" é ruído todo dia sem abertura, e
  ruído diário é como se ensina alguém a não ler o cabeçalho. A contagem é do **dia local**, pelo
  mesmo motivo do indicador do topo.
- **O rodapé diz "todas de uma vez, esta lista não pagina"**, em vez de copiar o *"Mostrando 1–20
  de 2.312"* do molde. Aqui **não há paginação**. Copiar aquela frase seria prometer uma página 2
  que não existe, e quem a procurasse concluiria que o sistema perdeu resultado.

**O seletor de ordenação do molde não entrou.** Lá são três opções (abertura, aderência, valor);
aqui a ordem é **uma** — e das outras duas, a aderência é Parte B e a de valor seria função nova.
Seletor com uma opção só é um controle que ensina a pessoa a clicar à toa. A ordem continua
**escrita**, que é o que ela sempre foi: informação, não controle.

### Dois ajustes que só a medição pediu

1. **O cabeçalho quebrava em duas linhas — até em 1920px.** Não era falta de tela: o painel tem
   **852px** de largura útil (divide a linha com a coluna de filtros), e *"ordenadas por quem
   encerra primeiro"* sozinha ocupa 250 deles. Encurtar o botão não bastou. A frase **desceu para
   o rodapé** — que é onde se diz *como* a lista está sendo mostrada, a mesma família de "quantas
   estão na tela". Resultado medido: **80px → 44px**.
2. **O hover da linha não levanta.** Linha que sobe dentro de um painel arrasta a de baixo e a
   lista inteira treme. Quem diz "dá para interagir" é o fundo, como no molde.

### Um assert do passo 3 mudou de alvo junto

`testa_header_encontrar` cobrava `border:1px solid` no `.lic` — que na época era um **cartão**. A
promessa (*a superfície tem fronteira desenhada*) é a mesma; o que mudou é **quem** a desenha.
Passou a cobrar o par certo: o painel tem a borda, a linha tem o divisor, e a última linha não
desenha o fio (senão ele encosta na borda do painel).

### Medido no navegador

| largura | cabeçalho | rodapé | linha confortável | linha compacta | rolagem horizontal |
|---|---|---|---|---|---|
| 390 | 110px *(controles empilham)* | 71px | 689px | 606px | 0 |
| 900 | **44px** | 44px | 320px | 238px | 0 |
| 1366 | **44px** | 44px | 320px | 238px | 0 |
| 1920 | **44px** | 44px | 320px | 238px | 0 |

Com dado da forma do real: órgão de 76 caracteres, objeto de 340, **R$ 63.034.332,63**, e os três
estados de prazo (encerrada · encerra em 1d · aberta) exercitando a barra de urgência.
