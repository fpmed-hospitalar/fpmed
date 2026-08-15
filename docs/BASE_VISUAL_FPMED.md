# BASE VISUAL FPMED — a fundação

> Escrita pelo ARQUITETO em 14/08/2026, por ordem do dono: *"busquei na web referência global de
> design de sistemas, padrões e tal, para montar a base — pode demorar o tempo que for, mas bem
> feito"* e *"pense como a cabeça de um gestor de licitação trabalhando dentro do programa"*.
>
> Este arquivo é **lei de fundação**. Ele NÃO substitui:
> - `docs/MOLDE_VISUAL.md` — o método (tokens, catracas, disciplina de medição), trazido do outro projeto;
> - o molde do Claude Design ("Tela Encontrar FPMED2") — a linguagem visual da casa;
> - `docs/molde_detalhe.html` — o alvo desenhado do painel de detalhe.
>
> Ele **explica o porquê** e fecha os números, para ninguém precisar chutar.
> Onde este arquivo e o molde da casa discordarem, **o molde da casa manda** — e a divergência
> vira linha escrita aqui, com a razão medida.

---

## PARTE 1 — A CABEÇA DO GESTOR DE LICITAÇÃO (isto vem antes do pixel)

Todo pixel desta base existe para servir a uma pessoa que trabalha **contra o relógio e contra o
prejuízo**. Ela não "navega": ela decide. As cinco perguntas que ela faz, nesta ordem, são a
hierarquia visual do sistema inteiro.

| # | a pergunta dela | o que a tela precisa responder ANTES de tudo |
|---|---|---|
| 1 | **Ainda dá tempo?** | prazo e hora, com urgência por cor **e** por palavra |
| 2 | **Vale meu dinheiro?** | valor estimado, quantidade, se é registro de preço |
| 3 | **É do meu ramo?** | aderência ao meu estoque, itens que casaram, categoria |
| 4 | **Até onde posso baixar?** | **teto CMED por item** — a régua legal, o nosso diferencial |
| 5 | **O que eu faço agora?** | uma ação primária óbvia, coerente com o estado do certame |

**Consequências duras disso, que valem como regra:**

1. **Nada de número que mente.** Zero não é preço; ausência não é zero; "não sei" nunca vira 0,00.
   Onde o edital não publicou referência, escreve-se *"sem referência"* e o teto CMED assume como
   única régua. (Foi o defeito real dos 7.456 itens com R$ 0,00 na tela onde se decide preço.)
2. **Verde é promessa.** Só pinta de verde o que a régua confirmou. Barra de aderência verde em
   22% é uma afirmação errada, não uma feiura.
3. **Estado governa ação.** Pregão encerrado não mostra botão de participar. Botão que não pode
   dar certo é porta pintada — pior que parede, porque convida.
4. **A dúvida se escreve.** "Itens ainda não lidos", "conferido em 14/08, sem arquivo no PNCP",
   "faltam 142 itens": o gestor aceita informação incompleta, não aceita ser enganado por ela.
5. **Densidade é respeito.** Ele compara 500 itens. Tela arejada demais vira rolagem infinita;
   tela apertada demais vira erro de leitura. Por isso existem duas densidades — e não três.

---

## PARTE 2 — OS NÚMEROS FECHADOS (fundamentados, não escolhidos por gosto)

### 2.1 Texto

| papel | tamanho | peso | uso |
|---|---|---|---|
| rótulo / meta | **12px** (PISO ABSOLUTO) | 600, maiúsculo, letra espaçada | rótulo de campo, cabeçalho de tabela |
| apoio | 13px | 400/500 | texto secundário, ajuda |
| corpo | **14px** | 400/500 | padrão do sistema, célula de tabela |
| valor | 14–16px | 600/700 | dado que decide (preço, data, órgão) |
| título de bloco | 18px | 700 | cabeçalho de painel |
| título de tela | 22–24px | 700 | uma por tela |

- **Piso de 12px, sem exceção em tela.** Única exceção declarada: `@media print`.
  *Razão medida, não gosto:* abaixo disso o dado deixa de ser legível para parte da equipe, e este
  sistema imprime preço de medicamento. Cor errada se percebe; número lido errado, não.
- **Hierarquia com peso e cor, não só com tamanho.** Regra do Refactoring UI, e é o que conserta o
  "tá tudo igual": rótulo apagado + valor forte na MESMA linha resolve mais que aumentar fonte.
- **Números com `font-variant-numeric: tabular-nums`.** Coluna de dinheiro sem dígito alinhado é
  coluna que não dá para comparar.
- **Linha de texto corrido entre 45 e 75 caracteres.** Vale para o objeto do edital e a Ajuda.

### 2.2 Espaço — grade de 8

`4 · 8 · 12 · 16 · 20 · 24 · 40 · 64` — **só esses degraus existem.**
- Espaço **entre** grupos maior que espaço **dentro** do grupo. Ambiguidade de espaço é o que faz o
  olho não achar o começo do bloco.
- Comece com espaço demais e vá tirando — nunca o contrário.

### 2.3 Cor

- **Nunca `#hex` na tela.** Só token semântico (`--x-superficie`, `--x-borda`, `--x-txt-forte`,
  `--x-ok`, `--x-atencao`, `--x-erro`). Cor em JavaScript não aparece em varredura de folha de
  estilo — é assim que hex à mão sobrevive a auditoria. **Proibido.**
- **8 a 10 tons de cinza**, e **nada de preto puro** — o preto da casa é `#0A1526`, um cinza muito
  escuro azulado. Preto puro vibra na tela e cansa em jornada de 8 horas.
- **Pares fechados de sinal** (fundo claro + tinta escura da mesma família): é o que faz selo de
  "estoura o teto" ser legível, em vez de vermelho vibrante sobre branco.
- **Contraste é medido, não presumido:**
  - texto normal **4,5:1**;
  - texto grande (≥24px, ou ≥18,5px em negrito) **3:1**;
  - **elemento não-textual** (borda de campo, trilho de barra, ícone que informa) **3:1**.
  - Fuga só existe medida e declarada, e desce um degrau na própria rampa — nunca inventa cor nova.

### 2.4 Raio e profundidade

- **Três raios só**: 4px (selo/campo), 8px (botão/cartão), 12px (painel). Mais que três vira bagunça.
- **Sombra é escada curta**: repouso `0 1px 2px rgba(16,26,43,.04)`; flutuante (menu/tooltip)
  `0 4px 12px rgba(16,26,43,.10)`; painel sobre véu `0 12px 40px rgba(16,26,43,.18)`.
- **Menos borda.** Separe com espaço, fundo ou sombra antes de desenhar um traço. Onde a borda for
  necessária (tabela densa), ela é **1px** e do token de borda — nunca duas espessuras na mesma tela.

### 2.5 Tabela densa — o coração deste produto

| regra | valor |
|---|---|
| altura de linha | **40px compacta** · **48px confortável** (só duas opções) |
| cabeçalho | **fixo** ao rolar |
| alinhamento | texto à **esquerda**; número **sempre à direita**, com dígito tabular |
| divisão | **fio de 1px**, nunca zebra (zebra briga com hover e seleção) |
| altura x conteúdo | célula de até 3 linhas centraliza; acima disso alinha no topo |
| ações e seleção | aparecem no **hover** da linha, para não poluir |
| ação em massa | rodapé de seleção **só existe** quando há item marcado |
| busca | destaca o termo **dentro** da linha e **puxa para o topo** — nunca filtra escondendo o resto |
| vazio | estado escrito ("nenhum item lido ainda"), nunca tabela em branco |

### 2.6 Toque e teclado

- **Alvo de 44×44** (largura **e** altura) apenas em `@media (max-width:480px)`. No monitor o alvo é
  o ponteiro; engordar tudo lá estraga a densidade. O mínimo absoluto do WCAG 2.2 é 24px — ficamos
  no 44 porque a mão que usa isto está segurando outra coisa.
  - **Botão só de ícone** é o caso perigoso: sem largura, vira tira estreita.
  - **Caixinha de marcar não engorda**: alvo transparente 44×44 e o quadradinho de ~18px redesenhado
    no miolo com `::before`. O dedo ganha área, o olho vê o que via.
- **Foco visível sempre** (anel de 2px do token de ação), Esc fecha painel, Enter confirma o que a
  tela promete. Teclado é ferramenta de gente que usa o sistema o dia inteiro.

### 2.7 Movimento e resposta

- **Reação visível em ≤100ms** a todo clique. Transição de 120ms para estado; nada acima de 200ms.
- **Espera com número**: "lendo 44 de 337" em vez de rodinha muda. A pessoa aceita esperar; não
  aceita não saber.
- **Afordância honesta**: `cursor:pointer` só onde há ação. E lembre que `cursor` é **herdado** —
  marcá-lo no pai pinta os filhos e mente a auditoria.

### 2.8 Ícones

- **Um sprite SVG só** (`fpmed_icones.js`), usado por referência. **Zero emoji, zero PNG.** Emoji
  muda de desenho por sistema operacional e não aceita a cor da marca.
- Ícone que informa entra na conta de contraste (3:1). Ícone decorativo não recebe cor de sinal.

---

## PARTE 3 — AS CATRACAS (a base só existe se reprovar)

| catraca | reprova |
|---|---|
| `testa_cor_token` | `#hex` ou `rgb()` escrito na tela, inclusive vindo de JS |
| `testa_espaco_token` | espaço fora da grade de 8 |
| `testa_texto_piso` | `font-size` abaixo de 12px fora do `@media print` |
| `testa_icones` | emoji ou ícone fora do sprite |
| `testa_toque_celular` | alvo < 44px no `@media` do celular; `min-height` em elemento inline |
| `testa_contraste` | par de cor abaixo de 4,5:1 (texto) ou 3:1 (grande / não-texto) |
| `testa_tabela_densa` | número alinhado à esquerda, cabeçalho não fixo, zebra em tabela interativa |
| `testa_numero_honesto` | R$ 0,00 exibido como preço quando o dado é ausente |

**A lei que vale mais que as oito:** *catraca que nunca ficou vermelha não é catraca.* Toda regra
nasce com **mutação** — quebra-se de propósito, confere-se que fica vermelha nomeando arquivo e
linha, restaura-se — **e confere-se que a mutação alterou o arquivo**. Mutação que não muda nada
não prova nada.

---

## PARTE 4 — COMO MEDIR SEM SE ENGANAR

1. **Régua antes do número.** Antes de contar, conferir o que a conta está contando.
2. **Tela com portão de login medida sem sessão mede a MOLDURA.** Nossos trabalhadores não logam:
   então medem o **arquivo** (contagem estática, repetível) e **declaram** o que só a medição logada
   responderia. Nunca publicar número bonito colhido em tela vazia.
3. **Em emulação de celular use `document.documentElement.clientWidth`** — `innerWidth` cresce junto
   com o vazamento e a conta dá zero sempre.
4. **Não se exclui, separa-se.** Texto de `@media print` e de modal vão para coluna própria do
   relatório; somar era o erro de origem, excluir seria o erro simétrico.
5. **Retrato ANTES → conserto na causa → retrato DEPOIS**, e o número publicado é o estático.

---

## PARTE 5 — ORDEM DE EXECUÇÃO

`cor → espaço → ícones → piso de texto → celular (vazamento + toque) → números chutados que
compensam peça de outro arquivo → arrumação (tamanhos fora da escala, raios, traços)`

Uma tela por vez. Cada fatia: retrato antes · conserto na causa · suíte verde a cada passo · commit
próprio · retrato depois · catraca nova com mutação · publica.

**Tela nova nasce obedecendo** — tela que nasce no molde não gera fatia depois.

---

---

## PARTE 6 — AS DIVERGÊNCIAS DECLARADAS (fatia A28, 15/08/2026)

> Esta parte cumpre a instrução do cabeçalho: *"onde este arquivo e o molde da casa discordarem,
> o molde da casa manda — e a divergência vira linha escrita aqui, com a razão medida"*.
> Cada linha abaixo é uma vez em que a BASE e o `fpmed_tema.css` (o molde) não diziam a mesma
> coisa, e a decisão que ficou. Elas são as regras que as 8 catracas realmente aplicam.

| # | a BASE diz | o que vale, e por quê |
|---|---|---|
| **V1** | grade `4 · 8 · 12 · 16 · 20 · 24 · **40** · 64` | a do tema: `4 · 8 · 12 · 16 · 20 · 24 · **32 · 48** · 64`. O tema não publica 40 e publica 32 e 48. E a catraca **lê a grade do tema**, em vez de escrevê-la: duas listas do mesmo fato é como uma envelhece calada. Quem guarda a integridade da lista é a `testa_tema` (assert 16: todo `--esp-*` é múltiplo de 4; assert 17: `--esp-N` vale N×4). |
| **V2** | piso de 12px "sem exceção em tela"; única exceção `@media print` | há uma **segunda** exceção, e ela é do molde: `--txt-0` (10px), cujo ofício o tema escreve — *"rótulo de GRUPO, caixa alta e espaçado — nada mais"*. **A catraca cobra a condição, não a palavra**: só vale acompanhada de `letter-spacing ≥ 0,1em`. Medido: rótulo de grupo do menu 0,14em · wordmark "HOSPITALAR" 0,22em · nenhuma frase corrida do sistema passa de 0,08em. Os 13 usos de 10px que a Encontrar e o menu tinham em **contador, pastilha de prazo, porcentagem, cabeçalho de tabela e seletor de ordenação** não são rótulo de grupo, e subiram para 12px. |
| **V3** | a condição da exceção seria "caixa alta" (`text-transform`) | é o **espaçamento**, e não a propriedade. A caixa alta pode vir do CONTEÚDO — o "HOSPITALAR" da marca está escrito assim no HTML, sem `text-transform` nenhum. Cobrar a propriedade em vez do fato manda consertar quem já obedece. |
| **V4** | contraste de texto 4,5:1, texto grande e não-texto 3:1 | falta a terceira resposta, e ela é a mais importante: **componente DESLIGADO não tem mínimo** (WCAG 1.4.3 isenta componente inativo). E a razão é de produto, não de norma: botão desligado precisa PARECER desligado. Escurecer o texto dele apagaria a única pista de que ele não funciona — seria fabricar o "botão que não faz nada" que a BASE_ENGENHARIA lista entre as oito denúncias. |
| **V5** | — (a BASE não previa) | **par de cor que NÃO se consegue medir não passa e não reprova: aparece.** Fundo herdado do pai ou montado em JS só a tela pintada responde, e nós não logamos. Contar como aprovado seria mentira por omissão; contar como reprovado mandaria consertar o que não se sabe estar errado. São 7 na Encontrar hoje, e eles saem nomeados a cada rodada. |
| **V6** | tabela densa: "cabeçalho fixo" | **por tabela, e não "alguma tabela"**. A catraca nasceu perguntando "existe algum `th` com `position:sticky`?" e ficava verde — a Encontrar tem TRÊS tabelas e só uma obedecia; as outras duas passavam de carona. Foi a **mutação** que expôs isso. Regra que se satisfaz com um exemplo não é regra, é amostra. |
| **V7** | alvo de 44×44 no `@media (max-width:480px)` | e a **ausência de alvo não é aprovação**. Antes desta fatia a Encontrar tinha uma linha de `@media(max-width:480px)` e nenhum alvo; a régua devolveu "0 alvos curtos", que estava certo e era inútil. A catraca passou a EXIGIR que o bloco exista e declare alvos de verdade quando a tela tem elemento clicável. |
| **V8** | "carregando — com número (`lendo 44 de 337`)" | o número é **o que se sabe**, e aqui não se sabe o denominador: o PNCP diz que há mais página, nunca **quantas**. A frase da casa é *"li 100 itens · página 2 de até 5"* — itens lidos (fato) e o teto que NÓS impomos (fato nosso). É a mesma recusa da divergência D11 da fatia A27, agora aplicada à espera: barra de progresso com denominador inventado mente enquanto a pessoa olha. |
| **V9** | "8 a 10 tons de cinza, nada de preto puro" | mantido, e com um acréscimo do molde: as **três bordas** (`--borda-divisor`, `--borda-controle`, `--borda-busca`) não moram na rampa de cinza. São ofícios que a rampa não teria onde guardar sem inventar meio-degrau, e `--cinza-250` seria a morte da regra "um número por passo". |

**E a divergência que NÃO ficou decidida** — ela é escolha de marca, não de engenharia, e está na
lista de pendências do dono: o quadrado da marca no menu (`.lm-cruz`) tinha **branco sobre
`--azul-500` = 2,67:1**, a cruz mais difícil de ler do sistema. As duas saídas foram medidas:
fundo `--azul-600` com a cruz branca (**5,04:1** — o que entrou, porque o próprio tema já
escreve que o azul-500 "NÃO carrega texto branco") ou manter o #2CA9E0 e escurecer a cruz para
`--cinza-800` (**6,41:1**). A primeira preserva o desenho branco-sobre-azul; a segunda preserva o
hex exato da marca. O código ficou na primeira enquanto o dono não decide.

---

## FONTES CONSULTADAS (14/08/2026)

- W3C · WCAG 2.2, Contraste Mínimo (1.4.3), Contraste de Não-Texto (1.4.11), Tamanho de Alvo (2.5.8)
- Apple Human Interface Guidelines — alvo de toque 44pt
- Material Design 3 — densidade e escala
- Refactoring UI — hierarquia por peso e cor, tons de cinza, escada de sombra, menos borda
- Pencil & Paper / Setproduct / Denovers — padrões de tabela de dados corporativa
- E a experiência medida deste projeto: os defeitos reais que a equipe caçou (R$ 0,00 como preço,
  verde em 22% de aderência, contraste que só reprovava na linha selecionada, `cursor` herdado
  inflando a conta de alvos, prova que lia o código-fonte em vez de perguntar ao servidor).
