# O MOLDE OFICIAL DA ENCONTRAR — medido antes de aplicar

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
2. **Sidebar navy 228px** — grupos, contadores à direita, item ativo, badge "IA".
3. **Header sticky** — breadcrumb, gatilho ⌘K (visual), selo "Base sincronizada", sino.
4. **Fila de 4 KPIs**, com os números reais do banco.
5. **Barra de busca** com chips, "+ Filtro" tracejado e o botão azul.
6. **Painel de resultados** — linha rica, barra de urgência, selos, `<mark>`, alternador
   Confortável/Compacta.

Publica, prova com print, e só então o Negócios.
