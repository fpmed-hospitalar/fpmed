# ITEM 7 — SPRINT DE ACABAMENTO ESTÉTICO · o plano, com as medições feitas antes

**Alvo:** `C:\Users\lemue\Downloads\fpmed_encontrar_amostra.html` — amostra **aprovada
pelo dono**, feita pelo arquiteto, identidade FPMED. É ela o alvo do teste do bater o
olho, e não referência de concorrente.

**Ordem dele, e ela manda:** publica **Encontrar**, prova com print, **só então**
Negócios. Sem apagão.

**Escopo:** 100% acabamento. Nenhuma feature nova, nenhuma mudança de lógica, dado ou
fluxo. Tudo por token do `fpmed_tema.css`.

Escrito em 12/08/2026, logo depois de fechar o item 6, para que a próxima sessão
comece **construindo** e não redescobrindo.

---

## 1 · O ACHADO QUE DECIDE O ITEM (medido, não suposto)

A amostra **não usa a nossa paleta.** Ela usa a família *slate*; o `fpmed_tema.css`
usa a família *blue-gray*. Os nove cinzas mudam — todos, nenhum coincide:

| token | hoje | amostra |
|---|---|---|
| `--cinza-50` (fundo da página) | `#f7fafc` | `#F1F5F9` |
| `--cinza-100` | `#edf2f7` | `#EEF2F7` |
| `--cinza-200` | `#e2e8f0` | `#E4EAF1` |
| `--cinza-300` | `#cbd5e0` | `#CFD8E3` |
| `--cinza-400` | `#a0aec0` | `#9AA7B8` |
| `--cinza-500` | `#667286` | `#64748B` |
| `--cinza-600` | `#4a5568` | `#475569` |
| `--cinza-700` | `#2d3748` | `#334155` |
| `--cinza-800` | `#1a202c` | `#1E293B` |

O pedido diz duas coisas que, juntas, só têm uma saída: *"deixar a tela igual à
amostra"* **e** *"tudo por tokens, proibido cor chumbada"*. Então **quem muda são os
tokens** — a amostra vira a paleta, e as duas telas herdam. Chumbar as cores da
amostra dentro da tela seria a segunda paleta do sistema, que é a coisa que o
`fpmed_tema.css` existe pra impedir.

### E aí a medição mostrou o problema

Rodei a fórmula da WCAG em cada par que a amostra **usa de verdade**. Quinze passam
com folga. **Quatro reprovam, e é sempre o mesmo culpado:** o `#9AA7B8` usado como
**texto**.

| medido | par | onde aparece na amostra |
|---|---|---|
| **2,44:1** | `#9AA7B8` sobre branco | os rótulos minúsculos do cartão rico — `VALOR ESTIMADO`, `ITENS`, `MUNICÍPIO` |
| **2,44:1** | `#9AA7B8` sobre branco | os rótulos de grupo do menu — `OPORTUNIDADES`, `GESTÃO`, `FERRAMENTAS` |
| **2,44:1** | `#9AA7B8` sobre branco | o placeholder do campo de busca |
| **2,23:1** | `#9AA7B8` sobre o fundo suave | o contador da faceta (`1.624`) |

São exatamente os elementos que o dono elogiou por nome ("letras afastadas", "rótulo
pequeno e cor fraca"). O visual está certo; **a cor está clara demais pra carregar
texto** — e 2,44:1 não é "quase": é metade do mínimo.

> **É a lição S12 outra vez, e agora no sistema inteiro em vez de um botão.** O
> `#1b8dc4` também "parecia bonito" e dava 3,71:1.

### A saída, e por que ela preserva o que ele aprovou

**O efeito de "rótulo fraco" não vem da cor — vem do tamanho, da CAIXA ALTA e do
espaçamento entre letras.** Escurecer só a cor mantém os três e devolve a legibilidade:

- `#9AA7B8` → o tom que passa: **`#64748B` (4,76:1)**, que é o `--cinza-500` da própria
  amostra. Ele continua sendo o cinza mais claro que passa em AA;
- o `#9AA7B8` **fica no tema** como `--cinza-400`, no ofício em que é legítimo: borda,
  ícone desligado, divisória. Ele não some, para de carregar texto.

**Isso não é desobedecer a amostra: é a amostra passando na régua que o próprio tripé
manda aplicar.** A diferença é praticamente invisível lado a lado, e o dono decide —
está listado em "preciso do Lemuel".

### Um par que eu mesmo especifiquei errado

Medi também "branco do cartão contra o fundo da página" e deu **1,10:1**. Isso **não é
defeito**: é separação de SUPERFÍCIE, não texto, e é justamente por ser baixa que a
sombra macia existe. Fica registrado porque um número desses numa tabela de contraste,
lido rápido, vira "achado" — e achado falso encerra investigação (S16).

---

## 2 · AS OUTRAS DECISÕES DE ACABAMENTO, LIDAS DA AMOSTRA

| o que | amostra | hoje | decisão |
|---|---|---|---|
| raio do cartão | `16px` | `--raio-cartao: 8px` | token vira 16; campo/botão ganham `12px`; pill continua `999px` |
| sombra | `0 1px 2px rgba(30,41,59,.04), 0 4px 16px rgba(30,41,59,.06)` | `--sombra-1` mais dura e curta | as três sombras do tema adotam a família da amostra |
| separação | sombra macia **sem** borda dura | borda cinza + sombra | a borda sai de onde a sombra já separa (D6: os dois juntos é cara de template) |
| padding do cartão | `22px 24px` | `--esp-4` (16px) | `--esp-5: 20px` e `--esp-6: 24px` já existem — usar 24 |
| largura do menu | `236px` | `224px` | 236, e o `margin-left` das telas acompanha |
| item aceso do menu | fundo `--azul-50` + **barra de 3px** à esquerda | fundo azul translúcido | adotar barra + fundo |
| rótulo de grupo | `9,5px`, `letter-spacing:1.4px`, caixa alta | já existe no menu | manter, só corrigir a cor (acima) |

---

## 3 · O QUE PRECISA SER CONSERTADO JUNTO (achado medido em 12/08)

**`gm-auth.js`, linhas 284–286.** A etiqueta do usuário logado é um **widget de tema
escuro** com cores chumbadas (`#111a2e`, `#a9bbdb`, `#22314f`, `#7fd0ff`, `#1f2b45`,
`#7f1d1d`) e carrega **os 2 últimos emoji-ícone do sistema** (👤 e 🔑) — D11 proíbe
emoji como ícone. Ela aparece em **todas as 10 telas**: nas duas claras, é uma pastilha
escura boiando.

> **Por que não foi consertado no item 6:** o `gm-auth.js` é carregado pelas 10 telas e
> **8 ainda são escuras**. Trocar por tokens claros conserta duas e quebra oito. O
> conserto certo é aqui, junto da decisão de como a etiqueta se comporta enquanto
> houver telas dos dois tons — e a saída provável é ela usar os tokens e as escuras
> receberem o tema claro na sequência (item 8b).

---

## 4 · O CONFLITO DA AMOSTRA COM O QUE JÁ ESTÁ NO AR

A amostra desenha **"Calendário — em breve"** no grupo GESTÃO. Ela foi feita **antes**
do item 6: o calendário existe, está publicado e está no menu desde 12/08.

**Decisão tomada, e ela não é minha preferência — é o texto do próprio pedido:**
*"nenhuma feature nova, nenhuma mudança de lógica/fluxo"*. Copiar o **estado** do item
seria **regredir uma tela publicada pra imitar um rascunho**. Copia-se o acabamento; o
calendário fica aceso. Registrado pro dono discordar se quiser.

---

## 5 · A ORDEM DE ATAQUE

1. **Os tokens** (`fpmed_tema.css`): paleta, raios, sombras, largura do menu. Uma
   fatia sozinha, com o `testa_tema` remedindo os 27 pares — é ele que prova que a
   troca não afundou nenhum contraste.
2. **O menu** (`limedtec-menu.js`): grupos com respiro, barra no item aceso. Ele já
   nasce em 3 grupos; falta o acabamento. Vale pras duas telas de uma vez.
3. **Encontrar**: cartão de busca, filtros em cartão com contador na faceta, grifo do
   termo, cartão de resultado rico. **Publica e prova com print.**
4. **Negócios**: as mesmas alavancas no cartão do funil e no do calendário.

O **contador na faceta** e o **grifo do termo** são os dois únicos pontos que tocam
código de dado, e mesmo assim de leitura: contar o que já está em memória e marcar o
que já casou. Nada de consulta nova.

---

## 6 · O QUE O RITUAL VAI EXIGIR

`tools/laco_visual_encontrar.html` (irmão dos dois que já existem), pior dado real de
cada tela, diário de fricção, console limpo, `sw.js` com sufixo novo, e o bater o olho
**contra a amostra**, lado a lado — que é o critério que ele deu.
