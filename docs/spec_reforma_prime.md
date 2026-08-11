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

## 3. Esperando decisão do Lemuel — NÃO iniciar

Três coisas foram anotadas e **não** entram na fila até ele decidir:

### a. Link público de acompanhamento por CNPJ
O Prime deixa o órgão/parceiro acompanhar o andamento por um link aberto, identificado por CNPJ.

**O que precisa ser decidido antes de existir:** um link público é uma superfície de dado
comercial exposta sem login. Hoje **toda** tabela deste sistema é `authenticated` com RLS, e o
`anon` está revogado em todas. Abrir um caminho público exige dizer, por escrito, **exatamente
quais campos** saem (e quais nunca saem: valor estimado? preço? margem?), e se o CNPJ sozinho é
autenticação suficiente — CNPJ é dado público, qualquer um digita o de outra empresa.

### b. Chat do edital (perguntar ao documento)
O Prime tem chat sobre o edital lido.

**O que precisa ser decidido:** é **cobrança por mensagem**. Uma leitura de edital custa hoje
~R$ 0,30–0,80 e é registrada com o custo real. Um chat multiplica isso por quantas perguntas a
pessoa fizer, e o fechamento de agosto já mostrou que o repasse (R$ 4,90) não cobre a
infraestrutura (R$ 180,82). Antes de existir chat, tem que existir o modelo de cobrança dele.

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
| 9 | **Proposta em PDF timbrado** — logo e dados do `cliente.config.js`, pronto para assinatura | ⚠️ **o PDF timbrado JÁ EXISTE** (`gerarPDF()`, pela impressão do navegador, com logo e dados do config). O que **falta de verdade** é o **Excel** — o inverso do que o pedido supunha. Confirmar com o Lemuel se o que ele quer é (a) o Excel, (b) um PDF gerado por biblioteca em vez de impressão, ou (c) os dois |
| 10 | **Gerador de declarações** — modelos editáveis, dados do config e do negócio | buracos «marcados», como na carta de credenciamento. **Textos redigidos do zero** a partir da Lei 14.133 |
| 11 | **Gestor de documentos** — categorias, vencimento, alerta vermelho, "baixar tudo em ZIP" | o alerta e o sino já existem |
| 12 | **Etapas renomeáveis por config** | **CHAVES do banco intactas** — mesmo padrão de Classificação→Habilitação e Contrato→Ata |
| 13 | **Tarefas com prioridade nos cards** (alta/média/baixa + data) | alimentando o sino |
| 14 | **Radar por raio** — "até X km de \<cidade\>" com lat/long do IBGE | **sem serviço pago**. Prova com municípios de GO |

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
