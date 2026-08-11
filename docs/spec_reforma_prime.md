# Spec da reforma visual — referência Licitante Prime

**11/08/2026** · mapa do vídeo enviado pelo cliente da FPMED, gravado como spec da reforma.

---

## ⚠️ COMPLIANCE — leia antes de qualquer linha de código

Este documento é um mapa de **layout e comportamento**, e nada mais.

**NUNCA copiar do Licitante Prime:** código, asset, ícone, logo, cor-identidade, texto de
interface, texto de modelo de documento, ou endpoint.

**A identidade visual continua FPMED/LIMEDTEC** (azul/verde da marca). O que se toma emprestado
é a ESTRUTURA — onde as coisas ficam, em que ordem aparecem, o que o clique faz.

> Um exemplo de onde isso morde: o item (d) da fila pede um gerador de declarações. Os textos
> dos modelos serão **redigidos do zero a partir das declarações padrão da Lei 14.133** — nunca
> copiados do modelo deles. Modelo de declaração é texto autoral de alguém.

---

## 1. Os módulos do Prime, e o que a FPMED já tem

A coluna do meio é o que o vídeo mostra. A da direita é o estado real da FPMED **conferido no
código**, e não suposto — inclusive onde nós estamos **à frente**.

| Módulo do Prime | O que ele faz lá | Na FPMED |
|---|---|---|
| **Empresas / CRM multi-empresa** | várias empresas, dados timbrados automáticos nos documentos | ✅ **TEM** — `empresas` + seletor "Todas as empresas" + badge no card; os dados saem do `cliente.config.js`, fonte única (CNPJ derivado, PIX derivado) |
| **Buscador** | palavra-chave, UF, cidade, região, datas, modalidade | ✅ **TEM E MAIS** — além do índice próprio (7 UFs, coleta 3×/dia), há **busca nacional ao vivo no PNCP** com procedência separada. Falta: filtro por cidade e por região |
| **Kanban** | etapas editáveis, arrasta-solta, link público por CNPJ | ⚠️ **PARCIAL** — kanban com arrasta-solta existe; **etapas editáveis** é o item 12 da fila; **link público** está em (4) abaixo, esperando decisão |
| **Radar por raio de km** | cidades num raio, com licitação aberta | ⚠️ **PARCIAL** — a tela existe; o raio real por lat/long é o item 14 da fila |
| **Documentos na nuvem** | alerta de vencimento em vermelho, download ZIP | ⚠️ **PARCIAL** — `v_documentos_situacao` com vencido/vencendo e o **sino** já avisam; falta o ZIP e a tela de categorias (item 11) |
| **Gerador de proposta** | puxa itens pelo ID da compra, desconto em lote, PDF timbrado, Excel | ⚠️ **PARCIAL** — a proposta existe com a **ponte edital→proposta** (casamento contra o estoque + trava CMED) e sai em PDF **pela impressão do navegador** (`gerarPDF()` → `window.print()`), com logo e dados do config. Faltam: puxador por ID (item 7), desconto em lote (item 8), **e o Excel** — que eu havia escrito aqui como existente e não existe (conferido no código: não há XLSX em `fpmed_giovana.html`) |
| **Leitor de edital IA** | resumo + chat + anexa o resumo ao kanban | ✅ **TEM E MAIS** — leitura **em partes** (edital de qualquer tamanho, com costura e relato de buracos), **extração da tabela de itens** que vira proposta, contador de custo por leitura e permissão no servidor. O **chat** está em (4), esperando decisão |
| **Gerador de declarações** | modelos editáveis | ⚠️ **PARCIAL** — `fpmed_declaracoes.html` existe; modelos editáveis em tela é o item 10 |
| **Lembretes** | prioridade + Google Agenda | ⚠️ **PARCIAL** — lembretes e tarefas com prioridade e data já alimentam o sino; **Google Agenda** está em (4) |

### O que a FPMED tem e o Prime não mostrou ter

Vale registrar, porque numa conversa com o cliente isso é o argumento:

- **Trava CMED de verdade** — teto legal (PMVG com desconto CAP) conferido item a item, com a
  **vigência da edição** dita na tela e carimbada no relatório e no Excel.
- **Leitura de edital em partes** — o Prime lê o edital; nós lemos edital de **qualquer tamanho**,
  costurando as partes e **relatando buracos na numeração** em vez de entregar lista incompleta.
- **Busca nacional no PNCP** — 3.639 resultados para "albumina" no Brasil inteiro, separada do
  nosso índice, com a procedência dita.
- **Credenciamento junto à indústria** — trilha escrita por trigger no banco, pedido parado
  tocando o sino.
- **Histórico real** — 2.558 negócios do Calendário 2025 importados, com taxa de vitória
  calculada sobre o que de fato foi decidido.
- **Honestidade de procedência** — "não encontrado ≠ dentro do teto", "não sei ≠ zero", carimbo
  de até que dia o índice está completo, faixa de PNCP fora.

---

## 2. A ordem da reforma visual

Declarada pelo Lemuel, e é esta:

1. **Menu lateral de módulos** — Buscar · Radar · Favoritas · Calendário · Negócios · Documentos ·
   Proposta · Leitor IA · Declarações.
   *Radar e Declarações entram como "em breve" até a fila chegar neles.*
2. **Kanban protagonista** no Negócios — colunas coloridas, arrastar entre etapas.
3. **Buscador estilo Prime** — cards de resultado com botões claros (Baixar edital · Ver itens ·
   Site oficial) e contador do índice. *(Os filtros já saíram da gaveta em 11/08.)*
4. **Calendário mensal** com pílulas coloridas por etapa.

**Publicando tela a tela**, sem apagão — o Natanael trabalha durante a obra. Suítes verdes a cada
publicação, e print pro cliente a cada tela.

### O que a reforma NÃO pode regredir

Decisões do Lemuel que sobrevivem, e que a suíte trava:

- badge de empresa visível no card;
- seletor "Todas as empresas";
- honestidade de procedência (carimbo do índice, faixa de PNCP fora, origem do negócio);
- **preço sempre unitário**;
- avisos de custo de IA antes do clique.

---

## 2b. ADENDO DE EXCELÊNCIA (11/08, ordem do Lemuel) — vale de agora em diante

> "O resultado não pode parecer feito por IA — tem que parecer feito pelo melhor programador de
> produto do mercado. **Sem pressa: qualidade manda no prazo.**"

Isso **muda a ordem de trabalho**: o design system vem ANTES de qualquer tela.

### O que precisa existir primeiro: `fpmed_tema.css`

Tokens em variáveis CSS, e nada fora deles:

| grupo | regra |
|---|---|
| cores | azul FPMED, verde FPMED, **8 tons de cinza**, vermelho e âmbar de aviso |
| espaçamento | grade de 8px — 4 / 8 / 12 / 16 / 24 / 32 / 48 |
| raios | 8px cartão · 6px botão · 999px pílula |
| sombras | 3 níveis, suaves |
| tipografia | **uma** família (`Inter, system-ui, -apple-system, Segoe UI, sans-serif`); escala 12/13/14/16/18/22/28; pesos 400/500/600/700 |

**PROIBIDO daqui pra frente:** cor chumbada fora dos tokens · espaçamento fora da grade ·
**emoji como ícone** · mais de 2 pesos de fonte no mesmo bloco.

**Ícones:** conjunto único open-source (**Lucide, MIT**), SVG inline **copiado pro nosso repo** —
sem CDN em runtime. Tamanho 16/20px, stroke igual em todos. Nunca ícone do Prime.

### Todo estado desenhado

É isso que separa profissional de protótipo — e cada um tem que existir no HTML:

- **carregando** → skeleton (blocos cinza pulsando no formato dos cartões). Nunca tela branca,
  nunca spinner solto.
- **vazio** → ilustração SVG própria + frase útil + ação ("limpar filtros" / "buscar no Brasil").
- **erro** → cartão de aviso com o que houve e o que fazer. Nunca vermelho gritando.
- **hover** → cartão levanta 1px com sombra; botão escurece 8%; 150ms ease.
- **focus** → anel visível pra teclado em **todo** elemento clicável.
- **desabilitado**, **campo com erro**, **badge de cada fonte** → todos com estilo definido.

### Acabamento fino

Grade de colunas (nada "quase alinhado") · `font-variant-numeric: tabular-nums` nos valores ·
datas por extenso curto ("abre 14/08 às 09h") · R$ com separador de milhar · **contraste AA
(4.5:1) medido, não estimado** · cartão de resultado com largura máxima ~880px · scrollbar
discreta, sem barra dupla, sem pulo de layout no carregamento.

### Laço de revisão visual — OBRIGATÓRIO antes de publicar

1. Renderizar em **3 larguras** (1366, 1920, 390 mobile) com **dados reais do banco**.
2. Conferir contra um **checklist de 20 pontos** e listar nota item a item no relatório.
3. Comparar lado a lado com os GIFs do Prime: *"a nossa parece tão profissional quanto?"* —
   se não, **mais uma rodada**. Repetir até sim.
4. Só então publicar + print final pro cliente.

### Suíte de regressão visual

Asserts de que: os tokens estão sendo usados (nenhuma cor fora do `fpmed_tema.css` nas telas
reformadas) · os estados existem no HTML (skeleton, vazio, erro) · **emoji-ícone morreu** nas
telas novas.

> ⚠️ **O RASCUNHO DE MENU QUE EU JÁ ESCREVI NÃO SERVE.** `limedtec-menu.js` foi escrito antes
> deste adendo e viola duas regras dele: usa **emoji como ícone** e tem **cores chumbadas** no
> CSS em vez de tokens. Ele fica no repo como rascunho e **não é carregado por tela nenhuma** —
> refazer sobre o `fpmed_tema.css` é parte do item, e não um retrabalho a lamentar.

---

## 3. Esperando decisão do Lemuel — NÃO iniciar

Três coisas foram anotadas e **não** entram na fila até ele decidir:

### ~~a. Link público por CNPJ~~ → **DECIDIDO em 11/08, virou item 15 da fila**
O Lemuel respondeu o que faltava: **só visualização**, só os negócios da empresa daquele CNPJ,
**link com código não-adivinhável**, sem login, e **nada de valores internos sensíveis** — é um
espelho do kanban, read-only.
> Com isso o risco que travava o item some: o CNPJ deixa de ser a chave (ele é público, qualquer
> um digita o de outra empresa) e vira só o *rótulo*; quem autentica é o código do link.

### ~~b. Chat do edital~~ → **DECIDIDO em 11/08, virou item 16 da fila — REGRA COMPLETA**
Perguntas sobre o edital já lido, **cada resposta registrada no contador** (`registra_uso_ia`,
tarefa nova `'chat'`). O pedido tinha chegado cortado; o Lemuel completou em 11/08:

| regra | decisão dele |
|---|---|
| aviso de custo | **uma vez só, ao abrir o chat**, com o preço estimado **por pergunta** |
| durante a conversa | **contador discreto** acumulando o custo da conversa a cada resposta |
| teto | **20 perguntas por edital**, configurável em `cobranca_config` |
| margem de repasse | **a mesma das leituras** |
| registro | cada resposta = `registra_uso_ia` com tarefa `'chat'` |

> ⚠️ **O CHECK CONSTRAINT ENTRA ANTES DO CÓDIGO — ordem expressa dele, e é a lição S5.**
> Na tarefa `juntar` a sequência foi invertida: o código passou a mandar uma tarefa que o
> constraint não conhecia, o insert falhou, o `catch {}` engoliu, e a leitura consumiu crédito
> **sem cobrança**. Aqui o `'chat'` entra na lista permitida **primeiro**; só depois o botão
> existe. E o `catch` vazio não volta: falha de registro aparece na tela.

> **Aviso "uma vez só" não pode virar aviso que ninguém vê.** Uma vez **por abertura do chat**,
> não uma vez na vida — senão quem abre amanhã não foi avisado de nada. E o contador discreto é
> o que sustenta isso: o aviso informa o preço, o contador mostra a conta correndo.

### c. Integração com Google Agenda
Os lembretes já entram no sino. Levá-los ao Google Agenda exige OAuth do Google, consentimento
por usuário e um token guardado — **é conta de terceiro e contrato novo**, não é código.

---

## 4. A fila que saiu deste mapa

Acrescentada no fim da fila numerada, nesta ordem:

| nº | item | nota |
|---|---|---|
| 7 | **Puxador de itens por ID da compra** — campo "ID da compra PNCP" na proposta, baixando os itens da API pública | **sem custo de IA** — é a mesma API que a coleta já usa. Prova com compra real |
| 8 | **Desconto em lote** — "margem de desconto %" recalculando todos os lances | **a trava PMVG continua valendo**: nunca recalcular para cima do teto |
| 9 | **Export Excel da proposta** | **DECIDIDO em 11/08 — opção (a).** O PDF pela impressão do navegador **fica como está**; PDF por biblioteca só entra se o cliente pedir um dia. O item deixou de ser "PDF timbrado" (que já existia) e passou a ser o **Excel**, que é o que faltava |
| 10 | **Gerador de declarações** — modelos editáveis, dados do config e do negócio | buracos «marcados», como na carta de credenciamento. **Textos redigidos do zero** a partir da Lei 14.133 |
| 11 | **Gestor de documentos** — categorias, vencimento, alerta vermelho, "baixar tudo em ZIP" | o alerta e o sino já existem |
| 12 | **Etapas renomeáveis por config** | **CHAVES do banco intactas** — mesmo padrão de Classificação→Habilitação e Contrato→Ata |
| 13 | **Tarefas com prioridade nos cards** (alta/média/baixa + data) | alimentando o sino |
| 14 | **Radar por raio** — "até X km de \<cidade\>" com lat/long do IBGE | **sem serviço pago**. Prova com municípios de GO |
| 15 | **Link público de acompanhamento por CNPJ** | read-only, código não-adivinhável, sem valores internos. Ver a decisão na seção 3 |
| 16 | **Chat do edital** | **regra completa em 11/08**: aviso de custo **uma vez ao abrir**, contador discreto acumulando, **teto de 20 perguntas** por edital em `cobranca_config`, margem igual à das leituras, cada resposta em `registra_uso_ia` tarefa `'chat'`. **Check constraint ANTES do código** (lição S5) |

---

## 4b. Como a tabela da seção 1 foi conferida

Nenhuma linha dela foi escrita de memória. Cada afirmação de "a FPMED tem" foi rodada contra o
código com `tools/confere_spec.js`, e **uma delas estava errada na minha primeira versão**: eu
escrevi que a proposta exporta Excel. Não exporta — ela gera **PDF por impressão do navegador**.

Isso muda o item 9 da fila: o PDF timbrado que ele pede **já existe**; o que falta é o Excel. Está
corrigido nas duas tabelas, e a pergunta foi devolvida ao Lemuel em vez de eu escolher por ele.

> Spec que afirma o que o produto não tem é pior que spec nenhum: ele vira a base de uma promessa
> comercial. Por isso a conferência é uma ferramenta, e não uma leitura — dá pra rodar de novo.

---

## 5. Como este documento deve envelhecer

Ele é um **mapa de referência**, não um contrato. Quando um item sair da fila e entrar no ar, a
linha dele na tabela da seção 1 muda de ⚠️ para ✅ — e o motivo de a nossa versão ser diferente
da deles, quando for, fica escrito aqui.

O que **não** pode acontecer é este arquivo virar a descrição de um produto que nós não temos.
Se algo aqui deixar de ser verdade, corrigir aqui é parte do trabalho.
