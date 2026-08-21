# BASE DO RITMO — quanto a fábrica gasta, e onde
### Ordem do Lemuel, 20/08/2026: *"pode gastar enquanto for necessário e tiver trabalho,
### mas não quero é que fique fazendo ronda à toa e gastando à toa."*

Esta base responde uma pergunta só: **como não gastar à toa sem nunca atrasar a produção.**
A resposta não é "gastar menos". É **gastar onde há trabalho e não gastar onde não há** — e as
duas metades valem igual. Ronda cara numa fábrica parada é desperdício; ronda barata numa
fábrica parada **por falta de ordem** é pior, porque esconde produção perdida.

---

## 1. OS QUATRO ESTADOS DA FÁBRICA, E O QUE CADA UM CUSTA

O arquiteto abre toda ronda pelo **portão**: mtime dos dois relatórios + **uma** consulta ao
banco. Duas chamadas. Com elas ele já sabe em qual dos quatro estados está:

| estado | como se reconhece | o que a ronda faz | custo |
|---|---|---|---|
| **A · PRODUZINDO** | nenhum relatório novo, e pelo menos uma caixa em `TRABALHE` | encerra em uma linha | 2 chamadas |
| **B · ENTREGOU** | mtime de relatório mudou | **trabalha fundo, sem teto**: lê, audita cada número contra o banco, escreve a caixa seguinte | o que precisar |
| **C · ESTOQUE SECO** | nenhum relatório novo **e as duas caixas em `AGUARDE`** | encerra em uma linha e **conta**. Na terceira seguida, avisa o dono: a fábrica está sem ordem | 2 chamadas |
| **D · CAÍDA** | banco sem andar **e** motor com código 1 | lê o log do ciclo, diagnostica, avisa **uma vez** | médio, e vale |

**O estado C é o único que merece aviso mesmo sem novidade.** Fábrica parada porque acabou a
ordem é dinheiro parado — e o dono precisa saber para mandar mais trabalho ou desligar.

---

## 2. ONDE O DESPERDÍCIO REALMENTE MORA (medido)

O gasto do arquiteto é o menor dos três. Em ordem de tamanho:

**1º — O MOTOR RELIGANDO A CADA 10 MINUTOS COM A CAIXA EM `AGUARDE`.**
Cada religada acorda um Claude Code inteiro só para ler uma linha e sair. São **6 por hora, por
trabalhador** — **288 por dia** entre os dois, todas produzindo a mesma frase.
**Conserto: quando a caixa está em `AGUARDE`, o motor espera 30 minutos, não 10.** Não atrasa
nada: trabalhador em AGUARDE não tem serviço, e o arquiteto recarrega dentro de meia hora.
Quando a caixa está em `TRABALHE`, o ritmo de 10 minutos continua igual.

**2º — LISTAR PASTA GRANDE.** `C:\fpmed\logs` tem mais de 300 arquivos. Uma listagem dessas
custa mais que uma ronda inteira, e nunca foi necessária: o nome do log se calcula, não se
procura. **Nunca liste `logs`.** Estageie `motor_A.log` / `motor_B.log` direto, e só com motivo.

**3º — RELER O QUE NÃO MUDOU.** Relatório com mtime igual ao baseline **não se abre**. É a
regra mais barata desta base e a mais fácil de esquecer.

---

## 3. AS TRÊS REGRAS DE OURO

1. **MEDIR É BARATO, NARRAR É CARO.** Meça sempre. Só escreva ao dono quando **mudar de
   estado** — fábrica caiu, fábrica voltou, relatório novo auditado, número que não bate,
   defeito com número, estoque seco.
2. **TRABALHO NÃO TEM TETO.** Quando um relatório cai, audite tudo, sem cortar profundidade.
   Economizar em cima de auditoria é o que deixa defeito passar — e defeito que passa custa
   rodada inteira. A busca ficou três dias quebrada por um número que ninguém conferiu.
3. **A RONDA SEGUE O RITMO DA ENTREGA, NÃO O RELÓGIO.** Medido em 20/08, os relatórios caíram
   às 09:08, 11:28, 13:24, 13:49, 14:08 e 14:52 — de 30 a 60 minutos. Por isso a ronda é de
   **meia em meia hora quando há rodada em curso** e de **uma em uma hora quando assenta**.
   Rondar mais rápido do que a fábrica entrega é olhar duas vezes para a mesma coisa.

---

## 4. A TRAVA DAS DUAS RONDAS

São duas tarefas agendadas, às **:05** e às **:35** (o agendador não desce de uma hora por
tarefa; duas defasadas dão meia hora). Elas não se conhecem, então **o `SINAL` da caixa é a
trava**: quem chega e encontra `TRABALHE` **não toca**. Só se recarrega caixa em `AGUARDE`.

Cada ronda que age **atualiza o próprio prompt** com os números e baselines novos. É assim que
a memória atravessa sessões que nascem sem memória nenhuma.

---

## 5. QUANDO DESLIGAR

Fábrica parada de propósito não precisa de vigia. Se o dono encerrar os serviços, **desligue as
duas tarefas** — e a regra do estoque seco (item 1, estado C) existe para avisar quando isso
deixa de ser propósito e vira esquecimento.
