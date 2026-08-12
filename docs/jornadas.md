# JORNADAS ESSENCIAIS DO FPMED — nota honesta

Regra A3 do `manual_excelencia.md`: a cada fatia publicada, a jornada afetada
recebe nota **🔴 vermelho / 🟡 amarelo / 🟢 verde**, com o porquê escrito.

**A nota é honesta por ordem expressa do dono: "o vermelho de hoje é o mapa do
trabalho".** Nota inflada aqui não melhora o produto — só apaga o mapa.

## O que cada cor significa (pra nota não virar opinião)

| Cor | Significa |
|---|---|
| 🟢 verde | A jornada inteira foi **percorrida com dado real**, do começo ao fim, sem atrito registrado em aberto. Estados desenhados, suíte cobrindo, e o cliente conseguiria usar sozinho. |
| 🟡 amarelo | **Funciona e tem prova**, mas falta pelo menos uma das três: visual no padrão, "andar pela loja" com dado real de ponta a ponta, ou uma peça da jornada ainda fora do ar. |
| 🔴 vermelho | Tem **buraco que muda a decisão do usuário** — uma etapa que não existe, um número em que ele não pode confiar, ou dependência de mim pra rodar. |

---

## Nota de hoje — 11/08/2026

| # | Jornada | Nota | Por quê |
|---|---|---|---|
| 1 | Achar licitação → funil | 🔴 | **Caiu de 🟡 para 🔴 em 12/08.** O motor está de pé e provado — banco primeiro com paginação, busca nacional no PNCP, inclusão manual. **Mas a matéria-prima parou de chegar:** a coleta do PNCP falha com "esgotou as tentativas" e a licitação mais nova no índice é de 06/08 — 142h atrás. O PNCP está no ar (medido: HTTP 200, 1.773 registros no período), então o defeito é nosso. Buscar num índice de 6 dias atrás dá resposta errada com cara de certa, e é isso que faz o vermelho: **o usuário não tem como saber que está vendo um retrato velho.** Some-se o visual reprovado pelo dono, que já segurava o verde. |
| 2 | Edital → proposta com PMVG | 🔴 | Ler edital de qualquer tamanho funciona (leitura em partes, com relato de buracos), a extração de itens foi medida, e a trava do teto CMED roda no lugar onde o preço é decidido. **O buraco: só 6 de 14 itens casaram com a base CMED na última medição.** Pela nossa doutrina "não encontrado ≠ dentro do teto", os outros 8 aparecem honestamente como não conferidos — mas metade de uma proposta sem conferência de teto é buraco que muda a decisão do usuário. Melhorar o casamento é trabalho, não conserto. |
| 3 | Disputa → lembrete | 🟡 | Lembretes existem como aba da ficha, com suíte. **Falta o calendário mensal** (item 6 da fila) e a integração com Google Agenda (que é contrato e OAuth, não código). Hoje o lembrete só aparece pra quem abre a ficha. |
| 4 | Ata → itens ganhos | 🟡 | Fase de gerenciamento de ata construída: 6 categorias de anexo tipadas, itens ganhos, mapa de preços, tudo com suíte verde. **Nunca foi percorrida de ponta a ponta com uma ata real pelo cliente** — a prova é de código, não de loja. Amarelo até alguém andar por ela. |
| 5 | Credenciamento | 🟡 | Vive dentro do Negócios, com trilha gravada por trigger (a tela não consegue errar o histórico) e teste de RLS. Mesmo caso do 4: provado, não percorrido. |
| 6 | Fechamento mensal | 🔴 | A ferramenta existe e o número de agosto saiu — mas com **dois problemas em aberto que são do dono decidir**: agosto fechou negativo (−R$ 179,16) e a fatura ainda cobra duas leituras que foram **teste meu** (ids 3 e 26). Além disso, **não é tela: é script que só eu rodo.** Enquanto o fechamento depender de mim, a jornada é vermelha por definição. |

---

## Como esta página muda

Cada fatia publicada atualiza a linha da jornada que ela toca — **na mesma
entrega, não depois.** Nota que sobe sem motivo escrito não vale.

Quando uma jornada vira 🟢, o motivo fica registrado: quem andou por ela, com
qual dado, e o que foi conferido.
