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
| 1 | Achar licitação → funil | 🔴 → **🟡 em 13/08** | **AS DUAS METADES DO VERMELHO CAÍRAM, e a nota subiu um degrau — não dois.** A primeira caiu em 12/08: a nota dizia "a coleta parou, licitação mais nova de 06/08, 142h atrás", e aquilo saiu de uma prova que media a tabela ERRADA (`licitacoes_acompanhadas`, histórico de participação, no lugar de `licitacoes`, o índice). Remedido: **3.197 linhas, última coleta 12,5h atrás**, e o motor do alarme diz "sem alarme". A segunda era o visual reprovado pelo dono ("ainda um pouco amador") — e **os 6 passos do molde fecharam na Encontrar em 13/08** (tokens · sidebar navy · header sticky · 4 indicadores ligados no banco · barra de busca com chips · painel de resultados), com os números provados contra o banco (`tools/prova_indicadores.js`) e o layout medido nas 4 larguras. **Por que não é verde, e são três coisas concretas:** (a) a tela nunca foi percorrida com **sessão real** — o laço injeta dado e remove o portão de login, o que prova layout e lógica, não a jornada; (b) a **outra metade da jornada é o Negócios**, que herdou os tokens e a sidebar mas ainda está na moldura antiga; (c) sobram **51 emoji-ícone** na Encontrar, que D11 proíbe, e isso é item próprio da fila. |
| 2 | Edital → proposta com PMVG | 🔴 | Ler edital de qualquer tamanho funciona (leitura em partes, com relato de buracos), a extração de itens foi medida, e a trava do teto CMED roda no lugar onde o preço é decidido. **O buraco: só 6 de 14 itens casaram com a base CMED na última medição.** Pela nossa doutrina "não encontrado ≠ dentro do teto", os outros 8 aparecem honestamente como não conferidos — mas metade de uma proposta sem conferência de teto é buraco que muda a decisão do usuário. Melhorar o casamento é trabalho, não conserto. |
| 3 | Disputa → lembrete | 🟡 | **O CALENDÁRIO MENSAL ENTROU EM 12/08** (item 6): grade do mês com pílula colorida por etapa, dia clicável abrindo os cartões de verdade, e o menu lateral levando até ele. Provado com suíte de 102 asserts (mutação 14/14) e laço visual nas 3 larguras — zero rolagem horizontal, e a grade não pula ao trocar de mês. **Continua amarela, e por dois motivos escritos:** (a) a integração com Google Agenda não existe e não é código, é contrato e OAuth — quem trabalha fora do sistema segue sem ver a sessão; (b) **eu não percorri esta jornada logado**: o laço visual roda com dado injetado e o portão de login removido do iframe, o que prova LAYOUT e não prova a tela com dado do banco vindo por sessão real. Verde exige alguém andar por ela logado. |
| 4 | Ata → itens ganhos | 🟡 | Fase de gerenciamento de ata construída: 6 categorias de anexo tipadas, itens ganhos, mapa de preços, tudo com suíte verde. **Nunca foi percorrida de ponta a ponta com uma ata real pelo cliente** — a prova é de código, não de loja. Amarelo até alguém andar por ela. |
| 5 | Credenciamento | 🟡 | Vive dentro do Negócios, com trilha gravada por trigger (a tela não consegue errar o histórico) e teste de RLS. Mesmo caso do 4: provado, não percorrido. |
| 6 | Fechamento mensal | 🔴 | A ferramenta existe e o número de agosto saiu — mas com **dois problemas em aberto que são do dono decidir**: agosto fechou negativo (−R$ 179,16) e a fatura ainda cobra duas leituras que foram **teste meu** (ids 3 e 26). Além disso, **não é tela: é script que só eu rodo.** Enquanto o fechamento depender de mim, a jornada é vermelha por definição. |

---

## Como esta página muda

Cada fatia publicada atualiza a linha da jornada que ela toca — **na mesma
entrega, não depois.** Nota que sobe sem motivo escrito não vale.

Quando uma jornada vira 🟢, o motivo fica registrado: quem andou por ela, com
qual dado, e o que foi conferido.
