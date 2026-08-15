# BASE DE ENGENHARIA LIMEDTEC — como pensa uma equipe de alto nível

> Escrita pelo ARQUITETO em 14/08/2026, por ordem do dono:
> *"o LIMEDTEC tem que ser extremamente profissional e bonito, nada que pareça construído por IA,
> mas por 100 programadores de alto nível. Mapeie como um programador pensa, como eles criam, como
> entregam um grande sistema — e transforme isso na sua base."*
>
> Par deste arquivo: `docs/BASE_VISUAL_FPMED.md` (a fundação do que se vê).
> Este aqui é a fundação do **como se constrói**.

---

## 0 · O QUE DENUNCIA UM SISTEMA "FEITO POR IA" — e como cada denúncia se mata

Antes de falar de método, o teste do dono. Quem olha um sistema amador percebe **oito coisas**, e
nenhuma delas é falta de talento: são falta de **regra**.

| a denúncia | por que aparece | como esta casa mata |
|---|---|---|
| doze telas com doze estilos | cada tela decidiu sozinha | **token obrigatório**, catraca reprovando hex |
| textos genéricos ("Erro", "OK") | ninguém escreveu como gente | **texto é interface**: erro diz causa + saída |
| tela que mente (0,00 como preço) | dado ausente tratado como zero | catraca `testa_numero_honesto` |
| botão que não faz nada | afordância copiada sem função | **click-assert**: promete = cumpre |
| tudo pronto "instantâneo" | nenhum estado de espera/erro/vazio | **os 4 estados obrigatórios** (§4) |
| funciona só no caminho feliz | nunca mediram o caminho torto | prova no servidor, com o crachá certo |
| some no celular | largura fixa nunca testada | vazamento medido a 390px |
| envelhece em uma semana | sem catraca, sem dono, sem registro | tudo abaixo |

**A regra-mãe:** *sistema profissional não é o que foi feito com capricho uma vez — é o que
NÃO CONSEGUE mais ficar feio, porque a régua reprova.*

---

## 1 · COMO UM BOM PROGRAMADOR PENSA (a sequência mental, na ordem)

1. **Ele desconfia do enunciado.** Antes de escrever, pergunta *"o que é verdade aqui?"* e vai
   medir. (Foi o que salvou a fatia do EAN: a hipótese "casar por marca" acertava **10 em 8.832** —
   e isso só apareceu porque alguém mediu antes de escrever.)
2. **Ele procura a CAUSA, não o sintoma.** Cartão feio na tela era **400 linhas gravadas noutro
   formato**. Consertar o cartão teria dado trabalho e mentira.
3. **Ele pergunta a quem sabe.** Se há servidor no caminho, pergunta **ao servidor** — e com o
   crachá que o navegador carrega. Ler o próprio código-fonte só prova que a frase foi escrita.
4. **Ele pensa no dia seguinte.** "Isso quebra o que?" vem antes de "isso funciona?". Coluna nova
   é aditiva; carga é versionada; nada de DELETE por conveniência.
5. **Ele escreve o porquê.** Decisão sem registro vira, dois meses depois, "alguém esqueceu de
   copiar o molde" — e o próximo apaga sem saber que existiu.
6. **Ele desconfia do próprio verde.** Teste que nunca ficou vermelho não protege nada. Por isso
   **mutação**: quebra de propósito, confere o vermelho, restaura.
7. **Ele entrega em fatias.** Grande sistema não nasce grande: nasce em pedaços que **sempre
   funcionam**, um commit por pedaço.

---

## 2 · COMO ELES CRIAM (o método de fábrica, adaptado à nossa)

### 2.1 Fatia fina, tronco sempre verde
- Trabalho em **fatias verticais** (uma capacidade ponta a ponta), nunca em camadas soltas.
- **Commit por fatia**, com mensagem que explica a decisão, não o diff.
- O tronco (`master`) **nunca fica quebrado**: suíte verde é condição de publicar, não meta.
- **Commit por caminho** (`git add <arquivo>`) — duas janelas dividem o mesmo diretório.

### 2.2 Contrato antes de integração
Quando duas pessoas (ou duas janelas) precisam se encontrar, **escreve-se o contrato primeiro**:
onde vive o dado, qual chave liga, o que a função responde em cada caso.
Sem contrato, cada lado inventa o seu — e o sistema passa a ter duas verdades.

### 2.3 Uma fonte de verdade por fato
- Um cálculo, um lugar. Duas contas de custo = no dia em que o preço mudar, só uma é corrigida, e
  o anúncio fica mais barato que a cobrança **sem sintoma nenhum**.
- Prazo é **conta**, não campo gravado: assim adiamento não deixa data velha em canto nenhum.
- Cor vem do token; endereço vem da configuração; nome de coluna vem do contrato.

### 2.4 Registro de decisão (ADR curto)
Toda escolha que alguém poderia "consertar" no futuro vira **três linhas** no doc da área:
o que foi decidido · a razão medida · o que se perde. Divergência declarada é decisão; divergência
silenciosa é defeito esperando.

### 2.5 Revisão adversarial
Quem revisa não procura confirmar: procura **derrubar**. A pergunta é *"em que caso isto mente?"*
— e o caso mais caro nunca é o erro na cara: é o **resultado plausível e errado**.

---

## 3 · COMO ELES GARANTEM QUE NÃO APODRECE

| pilar | o que é, aqui |
|---|---|
| **catraca** | teste que reprova a regra (cor, espaço, piso, ícone, toque, contraste, tabela, número honesto) |
| **mutação** | toda catraca nasce quebrando de propósito e ficando vermelha nomeando arquivo e linha |
| **prova medida** | número contra o banco/servidor real, com retrato antes e depois |
| **suíte por território** | cada dono roda a sua; vermelho de outro território se prova em cópia, nunca mexendo no arquivo alheio |
| **versão da casca** | mudou arquivo servido? bumpa a versão — senão o usuário continua com o de ontem e o sintoma some |
| **nada destrutivo** | DELETE/DROP/TRUNCATE só com OK do dono; migração aditiva |

**Os quatro sinais que a indústria usa para saber se uma equipe é boa** (DORA) traduzidos para nós:
com que frequência publicamos · quanto tempo da ideia ao ar · quantas publicações voltam atrás ·
quanto tempo para consertar quando volta. Fatia fina + catraca + tronco verde melhora os quatro ao
mesmo tempo — é por isso que esse método é o padrão, e não por moda.

---

## 4 · O QUE FAZ PARECER FEITO POR GENTE (o acabamento que a IA esquece)

**Os quatro estados obrigatórios de toda tela que busca dado:**
1. **vazio** — "nenhuma licitação com esses filtros" + o que fazer;
2. **carregando** — com número ("lendo 44 de 337"), nunca rodinha muda;
3. **erro** — causa em português + saída ("o portal não respondeu; tentar de novo");
4. **cheio** — o caso normal.
Tela que só tem o quarto é protótipo, não produto.

**Texto é interface.** Erro nomeia a causa e oferece a saída. Botão diz o verbo do que faz
("Enviar para meus negócios"), nunca "OK". Confirmação de gasto mostra o valor **antes**.

**Respeito ao trabalho do outro:** nada se sobrescreve (versões empilham), nada se apaga em
silêncio, e desfazer avisa que desfez.

**Acabamento invisível:** foco visível, Esc fecha, Enter confirma, ordem de tabulação certa,
`aria-label` no botão só de ícone, nada de `div` fingindo botão.

---

## 5 · COMO ELES ENTREGAM UM GRANDE SISTEMA (a ordem que funciona)

1. **Fundação primeiro** — tokens, catracas, contrato. (É o que estamos fazendo agora.)
2. **A jornada, não o módulo** — entrega-se o caminho inteiro de uma pessoa (achar → decidir →
   participar → propor → ganhar), fino, e só depois se engorda cada estação.
3. **Uma tela por vez**, com retrato antes/depois.
4. **O caso torto entra junto** — sem prazo, sem preço, sem arquivo, portal fora do ar. É o caso
   torto que decide se o sistema é profissional.
5. **Documentação viva** — guia do usuário que **envelhece em voz alta** (assert que reprova o
   guia quando a tela muda).
6. **Nada de big bang**: sem apagão, sem "reescreve tudo". Fatia, prova, publica.

---

## 6 · O CONTRATO DE QUALIDADE DO LIMEDTEC (o que eu, arquiteto, passo a exigir)

Toda fatia entregue responde, no relatório, a estas seis perguntas — e fatia que não responde
volta para a fila:

1. **O que você MEDIU antes de escrever?** (número, não impressão)
2. **Qual era a CAUSA?** (não o sintoma que apareceu)
3. **Onde está a PROVA?** (contra banco/servidor real, com o crachá certo)
4. **Qual catraca protege isso, e ela já ficou VERMELHA?** (mutação)
5. **O que você DECIDIU sozinho, e o que se perde nessa escolha?**
6. **O que ficou faltando, e de quem depende?** (pendência nomeada, nunca "acho que está ok")

E as três leis que não se negociam:
- **A régua vem antes do número.**
- **Nunca mentir na tela** — nem por omissão, nem por zero, nem por verde.
- **Fidelidade ao molde**: reproduzir o desenho aprovado; divergência só com razão medida.

---

## FONTES CONSULTADAS (14/08/2026)
- DORA / DevEx — os quatro sinais de desempenho de equipe e o papel dos ciclos curtos de retorno
- Práticas modernas de engenharia em escala (trunk-based, fatia fina, revisão adversarial, ADR)
- Refactoring UI e os sistemas de design de referência (Material 3, Apple HIG, Carbon, Polaris)
- W3C WCAG 2.2 — contraste, alvo, foco
- E o que esta casa mediu na prática, que vale mais que os quatro acima juntos: cada defeito
  achado nas rodadas de 13 e 14/08 virou uma linha deste documento.
