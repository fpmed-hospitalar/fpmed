# MOLDE VISUAL — a receita que fez o sistema ficar bonito

> **Para entregar ao arquiteto de outro projeto.** É **método**, não conteúdo: nenhum dado, preço,
> cliente ou identidade da GlobalMed atravessa. As **cores da marca e o logo são do projeto de
> destino** — só a estrutura é a mesma.
>
> Como usar: entregue este arquivo e diga *"adote este molde à risca; a referência é ordem, não
> sugestão. Onde não couber, pare e relate — não invente variante."*

---

## 1 · A IDEIA CENTRAL, EM UMA FRASE

**Nada de número solto no CSS.** Toda cor, todo espaço, todo tamanho de letra e todo raio vem de uma
**variável** definida num arquivo só. É isso — e só isso — que faz doze telas parecerem **um
sistema** em vez de doze páginas feitas em dias diferentes.

Um arquivo de tokens (`tokens.css`) com quatro famílias:

| família | prefixo | regra |
|---|---|---|
| **cor** | `--x-superficie`, `--x-borda`, `--x-txt-forte/fraco`, `--x-ok`, `--x-atencao`, `--x-erro`, `--x-cat-1..N` | cor **semântica**, nunca `#hex` na tela |
| **espaço** | `--x-e-4 · -8 · -12 · -16 · -20 · -24 · -40 · -64` | **grade de 8**: só esses degraus existem |
| **texto** | `--x-txt-1 … --x-txt-N` | escala fechada, **piso de 12px** |
| **raio** | 3 raios só (pequeno / médio / grande) | mais que 3 vira bagunça |

**Regra de ouro:** a tela **usa** o token, não **reescreve** o valor. `font-size:var(--x-txt-1)` está
certo; `font-size:12px` está errado mesmo que dê o mesmo pixel — porque no dia em que o piso mudar,
um sobe e o outro não.

**Reserva só em `.js`:** componente que roda **antes** do arquivo de tokens escreve
`var(--x-txt-1, 12px)`. Em `.html`, sem reserva. Misturar os dois esconde erro.

---

## 2 · AS QUATRO REGRAS DURAS (as que fazem parecer profissional)

1. **Piso de texto: 12px.** Nada menor, em lugar nenhum da tela. *(Motivo real, não gosto: abaixo
   disso o dado deixa de ser legível para parte da equipe — e num sistema que imprime preço de
   medicamento isso é risco. Cor errada se percebe; número lido errado, não.)*
   **Exceção declarada:** o **documento impresso** (`@media print`) — no papel o piso de tela não vale.
2. **Alvo de toque: 44px** — largura **e** altura — e **só dentro de `@media (max-width:480px)`**.
   No monitor o alvo é o ponteiro; engordar tudo lá estraga a tela densa. *(44 vem de Apple HIG;
   Material usa 48dp. O mínimo absoluto do WCAG 2.2 é 24px — fica no 44: a mão que usa isto está
   segurando outra coisa.)*
   - **Botão só de ícone é o caso perigoso:** com só `min-height` ele vira uma tira alta e estreita.
     Texto dá largura de graça; ícone não.
   - **Caixinha de marcar (`checkbox`) não engorda** — vira um bloco e deixa de parecer caixinha.
     **Receita:** o alvo vira 44×44 transparente e o quadradinho de ~18px é redesenhado no miolo com
     `::before`. **O dedo ganha a área; o olho vê o que via.**
3. **Zero vazamento horizontal em 390px.** A causa quase nunca é largura de texto — é **peça de
   largura fixa**: tabela com `min-width`, coluna cravada, `padding` chutado, linha `flex` que não
   pode quebrar, grade `1fr 1fr 1fr` (item de grade nasce com `min-width:auto` e **não encolhe abaixo
   do conteúdo** — três campos de data estouram sempre, por mais `fr` que se escreva).
   **Consertos que funcionam:** `flex-wrap:wrap` + `min-width:0` no filho que não quebra; no celular
   a grade vira **uma coluna**; fita de abas **rola** (`overflow-x:auto`) em vez de empilhar.
4. **Ícones: um sprite SVG só**, usado por `<use href="#i-nome">`. Nada de emoji e nada de PNG.
   Emoji muda de desenho por sistema operacional e não aceita cor da marca.

---

## 3 · O QUE DÁ O "AR CARO" (detalhes que ninguém nota, e por isso funcionam)

- **Contraste AA** conferido, não presumido.
- **Estado sempre visível:** "Processando 44 de 337" em vez de um spinner mudo. A pessoa aceita
  esperar; não aceita não saber.
- **Aviso antes da ação destrutiva**, dizendo exatamente o que vai acontecer (*"zera só os ausentes
  marcados e atualiza/insere os do relatório"*).
- **Ilha de tema:** uma tela pode ter tema próprio (ex.: um painel escuro dentro de um sistema
  claro) — desde que seja **declarada como ilha**, com as cores vindo dos mesmos tokens.
- **Quem tem a peça publica a medida.** Se um componente flutuante ocupa um canto, é **ele** que mede
  a si mesmo e publica `--peça-largura`; a tela **pede** (`padding-right:var(--peça-largura, 310px)`).
  Número chutado à mão envelhece calado: aqui um `310px` escrito numa tela virou **reserva curta** no
  dia em que o botão do componente cresceu — e ninguém viu.
- **Modal com `max-width:95vw`** — largura grande só é defeito quando não tem teto do lado.

---

## 4 · COMO ISSO NÃO APODRECE (a parte que a maioria pula)

Beleza sem catraca dura duas semanas. Uma catraca (teste) por regra, varrendo os arquivos:

| catraca | o que reprova |
|---|---|
| `testa_cor_token` | `#hex` ou `rgb()` escrito na tela |
| `testa_espaco_token` | espaço fora da grade de 8 |
| `testa_texto_piso` | `font-size` abaixo do piso (fora do `@media print`) |
| `testa_icones` | emoji ou ícone fora do sprite |
| `testa_toque_celular` | alvo < 44px no `@media` do celular; `min-height` em elemento **inline** (não faz nada — `<a>` precisa de `inline-flex`) |

**E a lei que vale mais que as cinco:** *catraca que nunca ficou vermelha não é catraca.* Toda regra
nasce com uma **mutação**: quebra-se de propósito, confere-se que o teste **fica vermelho nomeando
arquivo e linha**, restaura-se. **E confere se a mutação pegou** — mutação que não alterou o arquivo
não prova nada (isso já enganou gente aqui).

---

## 5 · MEDIR ANTES DE DIZER QUE ESTÁ PRONTO

- **Régua antes do número.** Antes de contar, conferir **o que a conta está contando**. Esta reforma
  teve **cinco manchetes erradas por régua ruim** — inclusive uma régua que contava o documento
  impresso como texto de tela, e outra que contava cinco alvos onde o dedo encontra um só (porque
  `cursor:pointer` **é herdado** pelos filhos).
- **Medir com a tela pintada, com dado dentro.** Tela com portão de login medida sem sessão mede
  **a moldura**: um lote inteiro reportou *"0px de vazamento"* e tinha **1.096px** quando os dados
  apareceram.
- **Cuidado com o `innerWidth` em emulação de celular:** ele **cresce junto com o vazamento**, e a
  conta dá zero sempre. A referência certa é `document.documentElement.clientWidth`.
- **Não se exclui, separa-se.** Texto dentro de modal e texto do papel não somem da conta — vão para
  **coluna própria**. Somar era o erro de origem; excluir seria o erro simétrico.
- **Retrato ANTES → conserto → retrato DEPOIS**, e o número que se publica é o **estático e
  repetível** (quantos `font-size` abaixo do piso existem no arquivo), não o que oscila entre rodadas.

---

## 6 · A ORDEM DE EXECUÇÃO QUE FUNCIONOU (fatia por fatia, sem apagão)

1. **tokens de cor** → 2. **espaço (grade de 8)** → 3. **ícones (sprite)** → 4. **piso de texto** →
5. **celular: vazamento + alvo de toque** → 6. **a faixa cortada** (números chutados que compensam
peça de outro arquivo) → 7. **arrumação** (tamanhos fora da escala, raios, traços de borda).

Cada fatia: **retrato antes → conserto na causa → suíte verde a cada passo → commit próprio →
retrato depois → catraca nova com mutação → publica**. Uma tela por vez. Nunca as doze juntas.

> **Ordem inversa também funciona uma vez só:** tela nova **nasce** obedecendo as catracas desde o
> primeiro commit. Tela que nasce no molde não gera fatia depois.
