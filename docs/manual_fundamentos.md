# MANUAL DE FUNDAMENTOS — a faculdade destilada

**Status: PERMANENTE.** Terceiro pilar, junto de `manual_excelencia.md` (o método)
e `manual_design.md` (o visual). Ordem do Lemuel em 11/08/2026.

Base: o currículo clássico de ciência da computação (as nove matérias de
MIT/Berkeley/Stanford, na trilha do *teachyourselfcs*) traduzido em leis práticas
pro FPMED.

**Extensão da Regra Zero:** quando um problema novo e difícil aparecer numa dessas
áreas, **pesquisar o material clássico da área antes de improvisar.**

---

## F1. Algoritmos e complexidade (Big-O)

Todo laço tem custo que **cresce com o dado**. A pergunta obrigatória antes de
escrever: *"e quando forem 10× mais registros?"*

- laço dentro de laço sobre listas grandes = bomba armada;
- procura repetida dentro de lista → `Map`/`Set` (busca instantânea);
- **paginação sempre.** A lição do teto de 1.000 linhas, agora com a ciência
  por trás: **o servidor SEMPRE limita — quem pagina é o cliente.** Pedir
  `limit=3000` e acreditar na resposta é confiar num limite que não é seu;
- otimizar **só** o que a medição apontar (L4).

> Os 2.558 negócios de hoje viram 25.000 um dia. O código de hoje tem que
> aguentar o dado de amanhã.

## F2. Estruturas de dados antes do código

A lei L2 (Torvalds) com o fundamento embaixo: **escolher a estrutura certa elimina
o algoritmo errado.**

| Preciso de… | Estrutura |
|---|---|
| ordem | lista |
| buscar por chave | `Map` |
| "já vi este?" | `Set` |
| processar na ordem de chegada | fila |

No banco: **a tabela desenhada certa faz a consulta sair simples.** Se a consulta
está complicada, o erro não está nela — está no desenho da tabela.

## F3. Banco de dados — *a matéria mais valiosa pro FPMED*

- **Índice.** Toda coluna usada em `WHERE`/`ORDER BY` de consulta frequente tem
  índice. Consulta lenta → rodar `EXPLAIN` e **ver** o plano, nunca adivinhar.
- **Transação / atomicidade.** Operações que andam juntas acontecem **todas ou
  nenhuma**. É a ciência por trás do `registra_uso_ia` com `on conflict`: N partes
  lidas, 1 cobrança, e nenhum estado quebrado no meio do caminho.
- **Constraint é guardião, não enfeite.** `check`, `unique`, `foreign key` e
  trigger guardam a verdade **dentro** do banco, onde tela nenhuma burla.
  > Lição da tarefa `juntar`: o constraint **acertou** ao barrar o registro fora
  > da lista. O defeito era o `catch {}` que engoliu o erro e deixou a leitura
  > consumir crédito sem cobrança. O guardião estava certo; quem estava errado
  > era quem tapava o ouvido.
- **Nunca confiar no cliente.** RLS e validação no servidor sempre.
  **A tela é conveniência; o banco é a lei.**
- **Histórico imutável.** O que aconteceu não se reescreve — versões por trigger,
  custo histórico preservado. Em licitação, auditoria vale ouro.

## F4. Redes — por que a internet falha e como conviver

- Toda chamada remota **pode** falhar, demorar ou responder pela metade: timeout
  definido, **retry com espera crescente** (nunca martelar — a ciência do 429 do
  PNCP), e desistência limpa com mensagem útil.
- **Idempotência.** Toda operação que pode ser repetida — retry, clique duplo —
  tem que dar no mesmo resultado: chave única + `on conflict`.
- **Menos idas ao servidor.** Agrupar o que dá, cachear o que não muda
  (banco-primeiro é exatamente isso), e **nunca travar a tela esperando rede.**

## F5. Sistemas distribuídos — nosso dia a dia sem saber o nome

- **Falha parcial é normal, não exceção.** Rodada que gravou metade não é erro —
  é o campo `parcial`. Isso é literalmente o capítulo 1 da matéria.
- **Estado compartilhado entre execuções mora no banco**, nunca na memória do
  processo (o `coleta_status` com rodízio de UF).
- **Separar o carimbo da EXECUÇÃO do carimbo do DADO** (`ultima_ok` vs
  `ultimo_dia_ok`): relógio de máquina mente, dado não.
- **Dois processos podem rodar ao mesmo tempo.** Toda escrita concorrente precisa
  de proteção: `unique`, `on conflict`, um escritor por pasta.

## F6. Matemática do programador

- **Dinheiro nunca em ponto flutuante puro.** `0.1 + 0.2 ≠ 0.3` em JS. Conta de
  cobrança em **centavos inteiros**, arredondamento explícito e documentado — o
  `ceil` da margem fica, e fica protegido por teste.
- **Condições de fronteira.** Todo intervalo testado no primeiro, no último, no
  vazio e no estourado. *Off-by-one é o defeito mais velho do mundo.*
- **Invariantes.** Pra cada tela/tabela, escrever a frase que **nunca** pode ser
  falsa — "todo uso de IA registrado tem custo > 0" — e transformar em assert.

## F7. Segurança — mentalidade, não paranoia

- Toda entrada é hostil até ser validada: campo de busca, upload, URL.
- **Menor privilégio:** cada chave/papel só faz o que precisa (anon vs service).
- **Segredo nunca em código, log ou print.** (Lição da chave Resend exposta.)
- URL assinada com vida curta — o padrão de 60-120s fica.

## F8. Conheça sua linguagem e sua máquina

- **JS é uma fila só.** Trabalho pesado trava a tela inteira: quebrar em pedaços
  async. A leitura de edital em partes é essa lei aplicada.
- **Encoding é traiçoeiro** (lição dos acentos no PowerShell): UTF-8 explícito em
  toda ponta.
- **Entender o que a abstração esconde.** O `limit=` que não vencia o teto do
  servidor é o exemplo canônico: **quando a ferramenta desobedece, a resposta está
  uma camada abaixo.**

## F9. Engenharia de software — a matéria que amarra tudo

- **Alta coesão, baixo acoplamento.** Cada arquivo/função cuida de UM assunto;
  motor separado de tela. O `fpmed_teto_cmed.js` é o padrão — replicar.
- **A mudança é a única constante.** Código bom é o **fácil de mudar**, não o
  esperto. *Se pra mexer numa regra precisa tocar 5 arquivos, o desenho errou.*
- **Fronteiras explícitas.** O que entra e o que sai de cada módulo, documentado
  no topo do arquivo em 3 linhas.

---

## RITUAL

No relatório de cada entrega, quando um destes fundamentos **decidiu** algo,
**citar a lei** — "paginação por F1/F3", "retry crescente por F4", "centavos
inteiros por F6".

Isso não é enfeite de relatório: é a prova de que a decisão veio de ciência e não
de chute, e é o que permite **contestar** a decisão depois olhando a lei, em vez
de discutir gosto.
