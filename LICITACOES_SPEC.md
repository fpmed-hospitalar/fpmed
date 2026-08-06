# 📋 Módulo LICITAÇÕES — estudo de referência + plano

> Estudo de **funcionamento/UX** do SIGA Pregão (conta do Lemuel). Nenhum dado deles foi copiado
> pro nosso banco — **nossa fonte é o PNCP**. Nada foi criado/alterado/excluído na conta.

---

## 1. ESTUDO — SIGA Pregão

**Conceito:** agregador/monitor de licitações públicas (pregões, dispensas) + CRM de negócios em volta.

### 1.1 Fontes que eles integram
Comprasnet · Portal de Compras Públicas · Licitações-e (BB) · Licitações Caixa · Banrisul ·
Compras RS / Bahia / Amazonas / RJ / Recife / MG · **Comprasnet Goiás** · **Licitanet** ·
BLL Compras · e-LIC SC · Procergs · Banpará · PE Integrado · BNC · e **"Outros/PNCP"**
(a API pública oficial).

> 🔑 **A vantagem real deles sobre nós:** são ~18 portais. Nós começamos com **1** (PNCP).
> O PNCP é obrigatório por lei para todo ente público, então a cobertura é boa — mas a
> publicação lá pode atrasar em relação ao portal de origem. Os dois que mais importam pra GO
> (**Comprasnet Goiás** e **Licitanet**) estão na V2.

### 1.2 Filtros da busca
Período / data de abertura · intervalo · tipo de item (material/serviço) · modo de disputa ·
estados (multisseleção das 27 UFs) · **portais de origem** · modalidade (pregão eletrônico,
dispensa). Palavras-chave separadas por `;`, com refino **Excluir** / **Limitar**.

**"Jornais" = buscas salvas com alerta recorrente.** É a feature de retenção deles.

### 1.3 Anatomia do card (observado na tela)
`MODALIDADE Nº <número>/<ano> - <ÓRGÃO> / <UF>` · objeto · **tags de categoria** automáticas
do objeto · `Abertura em DD/MM/AAAA às HH:MM` · modo de disputa · **`Fonte:`** = portal de
origem · badge de modalidade · contador de itens.

### 1.4 Módulos
| Módulo | O que faz |
|---|---|
| **Oportunidades** | Busca + filtros + jornais |
| **Negócios** | Funil / kanban / agenda |
| **Análise** | Mercado, histórico de compras, concorrentes |
| **Disputa** | Acompanhar Comprasnet ao vivo |
| **Jurídico** | Templates de impugnação, recurso etc. |

### 1.5 Volume (referência de escala)
Dashboard deles em 04/08/2026: **972 licitações** e **23.610 itens** publicados no dia.

---

## 1B. ESTUDO PARTE 2 — Análise e Jurídico

### 1B.1 Histórico de compras
Itens **encerrados** com órgão / processo / UF, **situação** (Aceito e Habilitado, Encerrado,
Cancelado, Fracassado/Deserto, Anulado), **preço estimado vs homologado**, e o **ranking de
licitantes** com CNPJ, razão social e último lance — vencedor marcado.

Filtros: termos / marca / fabricante · período · estados · portais · modalidades · situações ·
órgãos · **empresa específica** · classificação (vencedora / desclassificada / inabilitada) ·
**baixa participação** (deserto, 1–3 licitantes).

> 🔑 O filtro de **baixa participação** é ouro comercial: aponta onde há pouca disputa.

### 1B.2 Análise de mercado (por termo)
Mapa do Brasil por volume · barras mensais · valor total contratado · cartões de
correspondências, catálogo, estados, órgãos, **empresas** (tabela vencedores × concorrentes com
vitórias e valor vendido), marcas e contratação futura.

### 1B.3 Análise de empresas (por CNPJ)
Cartão cadastral · painel de participação (disputas / vencidas / valores, vitórias por
modalidade, desclassificações e inabilitações **com motivo**) · gráficos de principais itens
vencidos, valor por objeto, sazonalidade e marcas.

### 1B.4 Jurídico — não é o que parece
**NÃO é gerador de peças.** É **busca sobre acervo de peças REAIS protocoladas nos portais**
(impugnação, esclarecimento, recurso, contrarrazões), com filtro "somente nova lei" e o texto
integral servindo de **precedente**.

A **única IA** deles é o *"Converse com o edital"* (chat limitado).

> 🔑 **Aqui está a brecha.** Eles têm acervo, não têm geração. Ver V2-DIFERENCIAL.

---

## 1C. ESTUDO PARTE 3 — exploração a fundo (Lemuel, 04/08/2026)

> Navegação só de leitura. **Duas marcas deixadas na conta dele**, a limpar: um jornal de teste
> "TESTE Documentação Medicamentos" (consumiu a cota de 1/1 do plano) e 1 das 12 perguntas
> diárias do chat de edital.

### 1C.1 FICHA DA LICITAÇÃO (painel lateral expansível, `/oportunidade/{id}`)
Blocos: **fonte** (portal de origem) → modalidade+número → órgão+UASG → **objeto** →
**tags automáticas por categoria** (Medicamentos Orais, Injetáveis, Controle Especial,
Produtos Farmacêuticos, Curativos…) → badges de valor e "Registro de preço" → abertura (verde)
e modo de disputa.

**Botões:** `Acessar` (portal oficial) · `Arquivos do edital` (lista os anexos do .zip com nome
amigável: edital, TR, estudo técnico, relação de itens, modelos de proposta/ARP) ·
`Converse com o edital` (RAG — baixa e processa o PDF antes de liberar, mostra "X de 12 perguntas
diárias", 4 perguntas sugeridas) · `Adicionar aos meus negócios`.

**Itens do edital** em accordion com busca. Campos por item: descrição completa · tipo
(material/serviço) · unidade · quantidade · valor de referência unitário · total.
**4 sub-abas de inteligência por item:** Histórico · Concorrência Potencial (vencedores ×
concorrentes, razão social+CNPJ, vitórias, valor) · Marcas Relevantes · **Preços Praticados**
(histograma de valores já pagos, com slider de faixa). Mais um `Encontrar fornecedor` com IA.

### 1C.2 NEGÓCIOS — funil, quadros, agenda
**5 estágios:** Oportunidade → Qualificação → Disputa → Classificação → Contrato.
Duas visões da mesma coleção: **lista** (abas por estágio) e **kanban** (drag-and-drop).
Negócio é entidade separada do edital, vinculada a **1 CNPJ** da conta.

**Checklist padrão de 15 tarefas** pré-criado por estágio (editável) — Oportunidade 3,
Qualificação 3, Disputa 4, Classificação 4, Contrato 1. O card mostra o progresso ("0/15").
Mais: anotações livres, repositório de documentos **do negócio**, arquivar (soft-delete
reversível, em "Meus arquivos").

**Agenda** = dois tipos de evento: 🔵 abertura de sessão dos negócios acompanhados ·
🔴 vencimento de documento da empresa. Exporta pro Google Calendar.

### 1C.3 DISPUTA — não é web
`Disputa > Comprasnet` **não** é painel ao vivo: é o download de um **app desktop Windows**
("Máquina de Lances" / SIGA Client) — a ajuda deles chama de **robô de lances**. Só Windows 10
64-bit, i5 4 núcleos, 8 GB. Só modos Aberto e Aberto/Fechado; **não automatiza grupos/lotes**.

### 1C.4 PESQUISA AVANÇADA — o formulário completo
Palavras-chave (`;`) com **Excluir** e **Limitar** · Período (abertura/publicação) · Intervalo ·
Tipo de item · Modo de disputa (Aberto/Fechado/Aberto-Fechado/Fechado-Aberto/Dispensa com
disputa) · **27 UFs** · **20 portais** · modalidades · órgão (exige 1 portal selecionado) ·
**faixas de valor** (compra e item) + "valores sigilosos" · **ME/EPP** · "excluir registro de
preços". Ordenação padrão: mais recentes.

**Jornal = pesquisa avançada salva com nome.** Frequência **fixa diária**, sem seletor.
WhatsApp obrigatório no cadastro + e-mail adicional. **Limite: 1 jornal** no plano testado.

### 1C.5 DEMAIS
**Notificações**: sessão em D-1/D-0 + vencimento de documento. **Meus documentos**: mini-Drive
com **validade por arquivo** — é ela que alimenta agenda e notificações. **Planos** com limites
por recurso (empresas, jornais, negócios, perguntas de IA/dia) via Hotmart.
**Análise de Mercado**: heatmap por UF, série mensal, valor contratado, 6 ângulos
(correspondências, catálogo, estados, órgãos, empresas, marcas). **Análise de Empresas** por
CNPJ: cadastral + participação + gráficos. **Jurídico**: biblioteca de peças reais, não gerador.

### 1C.6 DELTA da parte 4 (só o que as partes 1B/1C ainda não cobriam)

**Converter oportunidade → negócio: modal de 3 passos.**
Passo 1 confirma a oportunidade · Passo 2 **seleciona os itens de interesse** · Passo 3 dá nome
ao negócio e associa a uma empresa (CNPJ) do usuário.
→ O passo 2 é o encaixe natural do **nosso cruzamento**: os itens que casam com o estoque já
vêm pré-marcados.

**Os 20 portais, lista fechada:** Comprasnet · Portal de Compras Públicas · Licitações-e ·
Licitações Caixa · Banrisul · COMPRAS RS · COMPRAS BAHIA · COMPRAS AMAZONAS ·
**COMPRASNET GOIÁS** · COMPRAS RJ · COMPRAS RECIFE · **Licitanet** · BLL COMPRAS ·
PORTAL e-LIC SANTA CATARINA · PROCERGS · COMPRAS MINAS GERAIS · BANPARÁ · PE Integrado ·
BNC · **Outros/PNCP**.
> ⚠️ **O calcanhar de Aquiles deles é técnico**: cada portal tem estrutura própria, então são
> ~19 conectores/scrapers a manter. Nós começamos com **1 API oficial e estável** — cobertura
> menor, manutenção quase zero. É um trade-off a favor da gente no curto prazo.

**Filtros da busca avançada que ainda faltam no nosso:** faixa de **valor da compra** (mín/máx) ·
**valor do item** (mín/máx) · qtd máxima de itens · toggle "compras com valores sigilosos" ·
toggle **participação exclusiva ME/EPP** · toggle **excluir registros de preço**.

**Jurídico — submenu real:** Impugnação · Esclarecimento · **Intenção de recurso** · Recurso ·
Contrarrazões. Cada um é uma busca de modelos, filtrável por órgão, com "somente nova lei"
(Lei 14.133/2021). Confirma de novo: **é biblioteca, não gerador** → nosso V2-diferencial segue de pé.

**Tarefas do funil:** o checklist de 15 é fullscreen, mostra **percentual** e permite
**criar seções customizadas** (+Seção), não só marcar as fixas.

---

## 2. NOSSO MÓDULO — V1 (a construir)

### 2.0 ⭐ COMO O SIGA REALMENTE BUSCA (Lemuel, 05/08/2026 — interceptação de rede)

O Lemuel abriu o DevTools e olhou o tráfego enquanto trocava o filtro de portal
(Comprasnet, PNCP, Licitanet…) e clicava em Buscar. **Resultado: ZERO requisições para
`pncp.gov.br` ou para qualquer domínio de portal.** Não importa qual portal esteja
selecionado, a única chamada é sempre a mesma:

```
POST https://app.sigapregao.com.br/app/api/oportunidades
```

**O que a interceptação sozinha prova:** que o navegador nunca fala com os portais — quem
fala é o backend deles. Sozinha, ela **não distingue** entre (a) índice próprio já coletado
e (b) proxy ao vivo pro portal a cada requisição; de fora os dois se parecem.

**O que fecha a questão a favor do (a) — dois indícios independentes:**

1. **Os nomes dos bundles JS** que a aplicação carrega: `useSuperCrawlRotinas` e
   `useSuperCrawlRealtime`. "Crawl" + "Rotinas" (= jobs agendados) é serviço de coleta
   programada; o "Realtime" separado é outra coisa (ver abaixo). São nomes de arquivo, não
   documentação — mas nomear um módulo de *crawl* com *rotinas* quando não existe crawl
   agendado seria coincidência muito específica.
2. **O produto entrega histórico**: licitações encerradas, desertas, análise de empresas por
   CNPJ, histórico de compras (seções 1B e 5). Nada disso sai de consulta ao vivo — exige
   base guardada. Este é o indício mais forte, porque é sobre o que o produto FAZ, não sobre
   como ele parece ser feito.

> 🔬 **Teste que encerraria de vez:** abrir o SIGA num momento em que o PNCP esteja fora do ar.
> Continuou respondendo = índice próprio. Caiu junto = proxy ao vivo.
>
> **TENTADO em 05/08 ~21h — INCONCLUSIVO, e o registro fica aqui pra não ser refeito às cegas.**
> A janela era perfeita: o PNCP caiu pela **terceira vez em dois dias** e a nossa tela mostrou
> "não consegui falar com o PNCP · não respondeu em 20s". Abri o SIGA na mesma hora, com a
> autorização de consulta (6.2.0-Z), e a tela veio **em branco** — 146 elementos, zero texto.
> **Isso não diz nada sobre a arquitetura deles**: a sessão logada do Lemuel está numa aba que
> ele deixou aberta, e essa aba não pertence ao grupo que a automação enxerga. Aba nova = app
> sem sessão. Não tentei login — inserir credencial não é coisa que eu faça.
> **Como refazer:** ele precisa mover a aba já logada do SIGA para a sessão da automação (ou
> avisar que ela está lá), e a tentativa tem que cair de novo numa janela de PNCP fora do ar.
> Enquanto isso, a conclusão do índice próprio continua **sustentada pelos outros dois indícios**
> (bundles `useSuperCrawl*` e o produto entregar histórico) — que já bastam pra decisão do
> item 10, e é por isso que ela não ficou esperando este teste.

**Sobre o `useSuperCrawlRealtime`:** é quase certamente a tela de **DISPUTA**, acompanhando a
sessão ao vivo no Comprasnet. Isso **não entra no nosso escopo** e a decisão já está tomada
(seção 1C.3 e item 9 da fila): robô de lance é app desktop Windows, não web, e antes de
qualquer investimento é preciso checar os termos de uso do Comprasnet sobre automação.
Ou seja: dos dois serviços, **só o de rotinas nos interessa.**

**O que muda pra nós — e é convergência, não novidade:** o item 10 da fila já decidiu
exatamente isso (tabela própria + coletor + a tela lendo do banco). Este achado confirma
que é assim que um produto maduro do ramo resolve o problema, e que a fragilidade que a
gente sente hoje (tela inútil quando o PNCP cai) é justamente a que eles já eliminaram.

**Dois detalhes de desenho que o endpoint entrega de graça:**

1. **O portal é CAMPO, não rota.** Um endpoint só (`/oportunidades`) atende todos os portais,
   com o portal virando filtro. Ou seja: a base deles é uma tabela normalizada com coluna de
   origem, não uma tabela por portal. **Consequência prática:** a nossa tabela do item 10 não
   deve nascer `licitacoes_pncp`, e sim `licitacoes` com uma coluna `portal`/`origem`. Custa
   nada agora e evita a migração no dia em que entrar Comprasnet Goiás ou Licitanet (V2).
2. **O filtro roda no servidor deles.** O nosso coletor precisa, então, GRAVAR o portal de
   origem em cada linha — senão o filtro equivalente não existe do nosso lado.

> ⚖️ **Limite que fica registrado:** o `app.sigapregao.com.br/app/api/oportunidades` é o
> backend de um produto pago de terceiro. Ele serve como **referência de arquitetura** —
> é pra isso que está aqui. Consumir aquele endpoint a partir do sistema da FPMED seria uso
> não autorizado de serviço comercial alheio, e não é caminho. A nossa fonte é e continua
> sendo a **API pública do PNCP**, que é aberta, sem chave e sem custo (2.1 abaixo).

### 2.0B ARQUITETURA DERIVADA — as duas metades que não podem se tocar

O padrão é o clássico **ETL + índice de busca**, e o que o faz funcionar é a separação: a
metade que o usuário usa **nunca** entra no ciclo de vida da fonte externa.

**METADE 1 — ingestão (worker/cron, FORA do ciclo de requisição do usuário)**
- consulta a API pública do PNCP periodicamente;
- normaliza os campos (órgão, UASG, objeto, itens, datas, valores) pro formato interno;
- grava no banco próprio, já tratado e indexado;
- **retry com backoff exponencial** — insistir de imediato numa API que caiu só piora;
- **circuit breaker**: se o PNCP cair, o worker PARA de insistir e volta depois, em vez de
  ficar batendo. Sem isso, uma queda longa vira um worker em loop e uma conta de execução;
- **sincronização incremental**: buscar só o que mudou desde a última rodada, usando os
  filtros de data que a própria API do PNCP oferece. Reprocessar tudo toda vez é o jeito
  garantido de bater em rate limit e de a coleta ficar mais lenta a cada mês que passa.

**METADE 2 — a API que a tela consome**
- lê **exclusivamente** do banco próprio. **Nunca** chama o PNCP de forma síncrona durante a
  busca do usuário. É esta linha que compra a estabilidade inteira: PNCP lento, fora do ar,
  instável ou com rate limit deixa de ser problema de quem está usando a tela;
- mostra **timestamp de última atualização** — "dados coletados às HH:MM". O usuário aceita
  dado de 3 horas atrás; o que ele não aceita é erro sem explicação;
- o botão "Atualizar agora" tenta o PNCP ao vivo e, se falhar, **avisa sem travar** — a tela
  continua servindo o que está no banco.

**Como isso encaixa no que a FPMED já tem** (não é do zero):
- a **edge function** que grava já está decidida no item 10, com segredo dedicado — a
  `service_role` nunca vai pro CI. Precedente pronto: a `ler-pedido`, no ar desde 22/07 com
  trava de origem;
- o **AbortController de 20 s** e o **cache de 15 min** já existem na tela e continuam
  valendo pro botão "Atualizar agora";
- busca textual: **Postgres com full-text search** resolve na nossa escala. Elasticsearch ou
  Meilisearch são a resposta certa pro volume do SIGA (~20 fontes, Brasil inteiro); pra GO +
  UFs vizinhas seria infra a mais pra manter, com custo mensal, resolvendo problema que a
  gente não tem. **Se um dia a busca ficar lenta, o índice GIN do Postgres é o primeiro
  degrau, não a troca de motor.**

### 2.1 Fonte de dados
API pública do PNCP — sem chave, sem custo:

```
https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao
  ?dataInicial=yyyyMMdd&dataFinal=yyyyMMdd
  &codigoModalidadeContratacao=<cod>&uf=GO
  &pagina=1&tamanhoPagina=<até 500>
```

> ⚠️ **Status verificado em 04/08/2026 ~14h: API FORA DO AR.** `504 Gateway Time-out` sem filtro
> de UF e `503 Service Unavailable` com `uf=GO`. Não é erro de parâmetro — o host não respondeu.
> **Requisito que isso cria:** o módulo degrada com elegância (cache + aviso *"PNCP indisponível,
> mostrando a última busca de HH:MM"*), nunca tela branca.

### 2.2 Escopo V1
1. **Busca**: UF (default **GO**), palavra-chave do objeto (default: `medicamento, hospitalar,
   material médico, farmac, soro, correlatos`), modalidade, período.
   **Proxy via edge function se der CORS, com cache de 15 min.**
2. **Lista**: órgão, objeto, valor estimado, modalidade, data da disputa, prazo de proposta,
   link pro edital / portal de origem.
3. **🎯 DIFERENCIAL — cruzamento com o nosso banco**: casar os itens do edital com nossos
   produtos pelo **matching PA + dose que já existe** (`_cpzKey`, `doseKey`, barreiras do
   Bloco 1) → **"X itens no nosso estoque / Y com preço competitivo"**, e **ordenar a lista
   por aderência** (não por data).
4. **"Jornal" simples**: busca salva + card **"Próximas disputas"** no Dashboard.
   Tabela `licitacoes_acompanhadas` — RLS: **gestor grava, todo logado lê**.

### 2.3 Por que o cruzamento é nosso e não deles
Eles classificam o objeto por categoria genérica. Nós respondemos **item a item** as duas
perguntas que decidem se vale disputar — *"tenho isso em estoque?"* e *"meu preço ganha do
valor de referência?"*. Só é possível porque já temos no banco: estoque próprio (1.381 linhas,
com PA preenchido), 7.451 cotações de distribuidor e a régua da CMED (25.702 apresentações).

### 2.4 Regras fixas
- Tema **claro** padrão do sistema.
- **Dados nossos nunca saem**: a API só recebe filtros públicos (UF, datas, modalidade,
  palavras-chave genéricas). Produto, preço, custo, cliente e estoque ficam do nosso lado —
  o cruzamento acontece **aqui**, sobre o retorno público.
- Acesso: menu em **FERRAMENTAS**, liberado pra **gestor + vendedor**.
- **Testes + commit por etapa** (parser da API com fixture de um dia real, versionada;
  matching item × produto reaproveitando as suítes do motor).

---

## 2B. V1.5 — HISTÓRICO DE RESULTADOS (a funcionalidade mais valiosa do SIGA)
**Quem venceu e por quanto** — de graça, a partir dos **resultados/atas do PNCP**.
Busca por **produto** e por **CNPJ de concorrente**.

Por que é a prioridade logo depois da V1: saber o **preço homologado** de um item que a FPMED
vende responde a pergunta que nenhuma outra tela responde — *"por quanto dá pra ganhar isto?"*.
Hoje a Competitividade compara com cotação de distribuidor; o histórico compara com **o preço
que o governo efetivamente pagou**.

Replicar do que o PNCP publica: órgão, processo, UF, situação, preço estimado × homologado,
licitantes com CNPJ e último lance. O filtro de **baixa participação** (deserto, 1–3 licitantes)
entra junto — é o que aponta onde há pouca disputa.

---

## 3. V2 — registrado, NÃO construir agora
- **Análise de mercado por termo**: mapa do Brasil por volume + série mensal + valor contratado.
- **Análise de empresa completa** (por CNPJ): participação, vitórias, desclassificações com motivo.
- **Comprasnet Goiás** e **Licitanet** (os dois portais mais relevantes pra GO).
- **Funil kanban** de negócios.
- Jornais com alerta recorrente por WhatsApp (reaproveitando o disparo da tela Vendas Ativas).

## 3B. 🎯 V2-DIFERENCIAL — gerador de minuta jurídica com IA (o SIGA NÃO tem)
O Jurídico deles é **acervo de busca**: peças reais já protocoladas, servindo de precedente.
Útil, mas o trabalho de escrever continua com você.

**Nosso:** a partir do **edital + os dados da FPMED**, gerar rascunho de **esclarecimento** ou
**impugnação** via edge function (**claude-haiku-4-5**, o modelo de custo já adotado no
`ler-pedido`), com aviso fixo e não removível: **"rascunho — revisar com advogado"**.

Encaixa no que já existe: a edge function, a trava de origem e o modelo já estão no ar desde
22/07. O que entra é o prompt e a tela.

⚠️ Regra: a minuta é **rascunho assistido**, nunca peça final. O aviso não é decorativo — peça
protocolada errada tem custo processual real.

---

## 4. Plano de execução (entra DEPOIS da fila atual)

Ordem definida pelo Lemuel: **normalização por unidade → sync de dados → Blocos 2/4 → Licitações**.

| Etapa | Entrega | Estado |
|---|---|---|
| 0 | Estudo (partes 1 e 2) + esta spec | ✅ |
| 1 | **Protótipo busca + lista** com dados reais do PNCP + **screenshot pro Lemuel** | ⏸ aguarda a fila · **e a API voltar** |
| 2 | Cruzamento com estoque/preços (o diferencial) | — |
| 3 | `licitacoes_acompanhadas` + jornal + card "Próximas disputas" | — |
| 4 | KPIs + ordenação por aderência | — |
| 5 | **V1.5 — histórico de resultados** (quem venceu, por quanto, por CNPJ) | — |
| 6 | V2 — análise de mercado / de empresa | — |
| 7 | V2-DIFERENCIAL — gerador de minuta jurídica com IA | — |

> Regra do Lemuel: **mostrar o screenshot do protótipo busca+lista ANTES** de construir o cruzamento.

---

## 5. ADENDO — MÓDULO "ANÁLISE" do SIGA (estudo do Lemuel, 05/08/2026)

> Menu "Análise" (só aparece em algumas páginas do SIGA). 4 itens, todos testados por ele com o
> termo "medicamentos". **Entrou como item 9 da fila** — ler isto antes de estimar.

### 5.1 Análise de Mercado (`/analise-mercado`)
Filtro de **Período** + barra de busca (mesma lógica de Oportunidades/Histórico). Ao buscar:
**mapa do Brasil (heatmap por UF)** + gráfico de barras mensal + **valor total contratado**, tudo
já filtrado pelo termo. Abaixo, **7 "Ângulos de Análise"**, cada um um card com contador e botão
"Analisar" que abre uma tela cheia/drawer:

| ângulo | o que mostra |
|---|---|
| **Correspondências** | tabela dos itens de licitações ENCERRADAS que casam com o termo (Portal, Órgão, Número, Nº do item, UF, Modalidade), paginada; a linha abre a **ficha da licitação** (tag nova observada: "Orçamento sigiloso") |
| **Catálogo** | termos/categorias de catálogo relacionados, com contagem de "itens disputados" por sugestão + link p/ o Histórico filtrado por ela |
| **Estados** | ranking de UF por nº de disputas e valor homologado (tabela ordenável) |
| **Órgãos** | ranking de órgãos por disputas e valor gasto, alternância Tabela/Gráfico |
| **Empresas** | ranking por CNPJ+razão social, vitórias e valor, abas **Vencedores/Concorrentes**, Tabela/Gráfico |
| **Marcas** | ranking de marcas, mesmas abas e alternância |
| **Contratação Futura** | painel DIFERENTE: **Consulta PCA** (Plano de Contratações Anual), 3 sub-abas — Produtos/Serviços (valor previsto no ano, qtd de itens, unidades compradoras, gráfico de gastos previstos, ranking de "Principais Unidades"), Órgãos (por nome) e Contratação Anual (por CNPJ do órgão) |

⚠️ Os 6 primeiros ângulos usam **disputas encerradas**; o 7º usa **planejamento futuro** (PCA) —
é outra fonte de dados.

### 5.2 Histórico de Compras (`/historico-compras`)
Feed pesquisável (termos separados por `;` + "Pesquisa avançada") com todos os itens de licitações
encerradas, cartão a cartão: portal+órgão+nº do processo, tag de UF, nº/título do item, **tag de
situação colorida** (FRACASSADO/DESERTO/REVOGADO em vermelho, ACEITO E HABILITADO em verde),
descrição, abertura/quantidade/unidade e — quando houve vencedor — **CNPJ+razão social do
vencedor, valor unitário homologado e valor total homologado**. É a mesma base que alimenta
"Histórico" e "Preços Praticados" dentro da ficha do item, exposta como feed geral.

### 5.3 Análise de Empresas (`/analise-empresa`)
Busca por **CNPJ ou nome fantasia** (autocomplete) + Período. Painel com 3 abas:
- **Visão geral / Participação**: participações (total, vencidas, não vencidas), valores (total
  disputado / vencido / não vencido), vitórias por modalidade (P.E. × Dispensa), **penalidades**
  (desclassificações, inabilitações).
- **Gráficos**: vitórias × derrotas (% vencido), valor homologado × disputado, desclassificações ×
  inabilitações, com **lista de motivos**.
- Link "Histórico de compras" filtrado pela empresa.

É um **dossiê de reputação/performance de qualquer concorrente (ou da própria FPMED)**.

### 5.4 Encontrar fornecedor com IA
Painel "Prospecção de fornecedores": texto livre ("descrição do produto...") → cards por empresa
sugerida com **nome, Aderência (% de match), Contato (tel/e-mail), Site, Localização** e um
parágrafo de "Análise" justificando. **Consome a MESMA cota diária** do "Converse com o edital"
(contador único "X de 12 perguntas diárias" compartilhado).

### 5.5 Extras confirmados
- **Minhas Empresas** (`/minhas-empresas`): lista simples nome/CNPJ + "Adicionar empresa". Sem
  tela de detalhe (o link do nome não abre nada visível).
- **Peças Jurídicas** (`/pecas-juridicas`): base de pesquisa de **documentos jurídicos REAIS**
  extraídos de licitações públicas (impugnações, esclarecimentos, intenções de recurso, recursos,
  contrarrazões já protocolados). Busca por termo, toggle "Limitar por órgão", toggle "Somente
  nova lei" (Lei 14.133/2021), abas por tipo de peça com marcar/desmarcar todos. Cada resultado
  mostra o pregão de origem, um trecho do documento e "Abrir no portal". É um **banco de modelos
  reais** pra inspirar a redação de novas peças.

### 5.6 PARA REPLICAR — o que isso exige de nós
1. **Um motor de busca textual único** sobre itens de licitação (encerradas E futuras),
   reaproveitado em Oportunidades, Análise de Mercado e Histórico de Compras.
2. **Agregações pré-calculadas** sobre esse índice em 6 dimensões: item, categoria de catálogo,
   UF, órgão, empresa (vencedora/concorrente) e marca — cada uma com ranking, Tabela/Gráfico e
   período.
3. **Fonte separada para o PCA** (planejamento anual), pesquisável por objeto, órgão ou CNPJ —
   provavelmente outro dataset público (PCA/PNCP), distinto do de disputas encerradas.
4. **Perfil agregado por CNPJ**: taxa de vitória, valores movimentados, penalidades e motivos.
5. **Assistente de IA de prospecção** que recebe descrição em linguagem natural e devolve
   candidatos com score, contato e link — mesmo motor de busca + LLM pro texto. Cota compartilhada
   com o chat de edital.

### 5.7 ⚠️ O QUE FALTA NA NOSSA BASE (ler antes de estimar)
Tudo em 5.1–5.3 depende de uma coisa que **ainda não temos**: o **histórico de RESULTADOS** das
disputas — quem venceu, por quanto, com que CNPJ, e a situação de cada item. A busca que já está
no ar (`/contratacoes/publicacao`) traz o EDITAL, não o RESULTADO. Antes de qualquer tela deste
módulo é preciso achar e validar o endpoint de **resultados/atas do PNCP** (é a etapa 5 do plano,
"V1.5 — histórico de resultados"), do mesmo jeito que o endpoint de ITENS foi confirmado.
🟢 **Boa notícia**: o `Calendario 2025.xlsm` (item 8) traz **2.578 linhas do nosso próprio
histórico de participação, com VALOR GANHO** — dá pra fazer o "Análise de Empresas" da PRÓPRIA
FPMED antes e independente do PNCP.

---

## 6. ESPECIFICAÇÃO FUNCIONAL COMPLETA DO SIGA (estudo do Lemuel, 05/08/2026)

> Levantamento aba por aba do produto inteiro, na ordem do menu: **Oportunidades → Negócios →
> Análise → Disputa → Jurídico**. A seção 5 acima detalha o módulo Análise; aqui ele aparece
> resumido para o mapa ficar completo. **Entrou como item 9 da fila.**

### 6.0 ⭐ O QUE JÁ TEMOS — ler ANTES de estimar qualquer coisa

Boa parte da aba 1 já está no ar em `fpmed_licitacoes.html`. Não reconstruir:

| recurso do SIGA | nosso estado |
|---|---|
| Busca por texto livre, termos separados por `;` | ✅ pronto |
| Campo "Excluir" (termos que não podem aparecer) | ✅ pronto |
| Período (publicação/abertura/encerramento) + intervalo de datas | ✅ pronto |
| Tags de categoria automáticas a partir do objeto | ✅ pronto (`CATEGORIAS`/`categorias()`, 7 categorias do ramo) |
| Cards com título, objeto, abertura, modo de disputa, badge de modalidade, portal | ✅ pronto |
| Pesquisa avançada (modal) | 🟡 parcial — temos UF, modalidade e excluir |
| Encontrar por Nº | 🟡 temos por nº de controle PNCP; o SIGA usa wizard de 4 passos |
| Lista de itens do processo | ✅ pronto (endpoint de itens, paginado, cache 15 min) |
| **Cruzamento item × nosso estoque, com preço unitário dos dois lados** | ✅ **pronto — e o SIGA NÃO TEM ISSO** |
| Meus Jornais | ⬜ hoje é só um aviso na tela |
| Órgãos, Oportunidades Desertas, Funil, Análise, Jurídico | ⬜ nada feito |

**Falta na Pesquisa avançada** (o resto do modal do SIGA): tipo de item, modo de disputa, ~19
portais, órgão, faixa de valores, participação exclusiva ME/EPP, excluir registro de preços.

---

### 6.1 ABA 1 — OPORTUNIDADES
Submenu: *Encontrar · Meus Jornais · Órgãos · Pesquisa rápida (Encontrar por Nº · Desertas no PCP)*

**Encontrar** (`/oportunidades`) — é a nossa tela atual. O que falta é o modal completo de
pesquisa avançada e o badge laranja **"OPORTUNIDADE DESERTA"**.

**Meus Jornais** (`/meus-jornais`) — buscas salvas. Cada jornal é editável (reabre a pesquisa
avançada com os filtros salvos) ou excluível, roda **automaticamente todo dia** e notifica com as
oportunidades novas. O toggle "receber por e-mail" fica em *Meus Dados*, não no jornal. Quota por
plano (1 jornal simultâneo no plano testado).
> **Como fazer aqui**: `jornais { id, usuario, empresa, filtros jsonb, ultima_execucao }` + job
> diário. Temos Supabase — dá pra usar **pg_cron + edge function** (a `ler-pedido` já é o
> precedente de edge function no ar). O e-mail exige um provedor (Resend/SES) — **decisão do
> Lemuel**, tem custo. O delta é `resultados_novos = busca_hoje − vistos_até_ontem`.

**Órgãos** (`/orgaos`) — diretório de órgãos compradores, busca por nome ou UASG, paginado,
mostrando UASG + nome + ícone do portal. Serve de atalho pra achar o código certo pra usar nos
outros filtros. → `orgaos { codigo_uasg, nome, portal, uf }`.
> No PNCP o órgão já vem em cada licitação (`orgaoEntidade.cnpj/razaoSocial` + `unidadeOrgao`).
> Dá pra **derivar a tabela do que já buscamos**, sem crawler novo.

**Encontrar por Nº** — wizard de 4 passos num modal: portal → tipo (pregão/dispensa) → órgão/UASG
→ número da licitação (o combobox do número provavelmente carrega depois do órgão).

**Oportunidades Desertas no PCP** — não é tela nova: é um **filtro pré-configurado** da tela
Encontrar (`?so=1`), mostrando só processos marcados como desertos/fracassados (que podem ser
republicados e têm chance maior). → basta um campo `situacao_anterior: deserta|fracassada|normal`
e um atalho de um clique.

---

### 6.2 ABA 2 — NEGÓCIOS ⭐ (o funil)
Submenu: *Funil de Licitações · Quadros · Agenda*

#### 6.2.0-Z 🔓 AUTORIZAÇÃO PERMANENTE DE CONSULTA AO SIGA (Lemuel, 05/08)

O SIGA fica **aberto e logado numa aba do Chrome**. Durante a construção do funil e do resto do
módulo, **posso ir lá sozinho quando faltar detalhe** — navegar, abrir telas, passar o mouse,
inspecionar layout e comportamento, tirar screenshot e registrar aqui. Sem pedir.

**Regras da visita — invioláveis:**
1. **SÓ OLHAR, modo leitura.** Nunca criar, editar, excluir ou salvar nada na conta dele
   (jornal, negócio, empresa, alerta, arquivo). Navegação e hover são livres; **clique que
   GRAVA, não.**
2. **JAMAIS tocar na aba DISPUTA** em sessão de pregão ao vivo — nada de lance, nem por engano.
   É dinheiro real e processo público em andamento.
3. **Referência de comportamento e layout apenas**: nunca copiar código, assets ou textos, nem
   consumir endpoint deles no nosso sistema. (Mesmo limite já registrado na seção 2.0.)
4. **O que descobrir, registrar na seção certa DESTE arquivo antes de implementar.**

> Isso resolve a lacuna que existia: até aqui a spec vinha só de prints e descrições, e detalhe
> de interação (o que acontece no hover, como o drag responde, o que a coluna vazia mostra)
> não se transmite por texto sem perder precisão.

#### 6.2.0 🎨 REFERÊNCIA VISUAL — nível de acabamento cobrado (prints do Lemuel, 05/08)
> Isto **não é sugestão de layout**: é o padrão de acabamento que ele quer ver entregue.
> Tema **escuro**, mesmo padrão da tela de Licitações (`data-tema="dark"`, ver seção 2.0).

**Barra de fases (visão Lista)** — chips lado a lado, cada um com a contagem:
`Oportunidade (3) · Qualificação (0) · Disputa (2) · Classificação (1) · Contrato (0)`.
Chip ativo em **verde cheio**. Logo abaixo, os links *Quadros · Agenda · Meus arquivos*.

**3 visualizações do MESMO dado**, trocadas por um botão "Visualização":
`LISTA` (cards grandes) · `QUADROS` (kanban) · `AGENDA`.
Menu NEGÓCIOS no topo com: *Funil de Licitações / Quadros / Agenda*.

**Kanban (Quadros)** — uma coluna por fase, cada uma com **bolinha colorida** no topo
(verde/azul/laranja/roxo) + contagem. Coluna vazia mostra **caixa tracejada** "Arraste
negócios para cá". **Drag-and-drop** entre fases. Scroll horizontal.

**Card do negócio:**
- título como **link azul-claro**: portal + modalidade + nº + órgão
- **badge da EMPRESA** no canto, pill azul-arroxeada
- órgão + UF
- `Abertura em DD/MM/AAAA às HH:MM`
- etiquetas: **fonte** (pill cinza) e **modalidade** (pill verde)
- progresso de tarefas `☑ 0/15`
- **no hover** aparecem as ações (remover / arquivar)
- etiqueta da fase no canto superior (`OPORTUNIDADE`, verde)

**Topo da tela:** seletor *"Todas as empresas"* · *"Ordenar por: Mais recentes"* · link *"Filtrar"*.

**Hover em tudo** — ele citou explicitamente: cards levantam, itens de menu destacam.
A tela de Licitações já tem esse vocabulário pronto (`.lic:hover` levanta 2px com sombra
dupla; `.topfaixa a:hover` levanta 1px) — **reaproveitar, não reinventar**.

#### 6.2.0-A ✅ DECIDIDO — empresa pré-cadastrada, e o badge FICA VISÍVEL

**Eu levantei a dúvida e ele decidiu o contrário da minha recomendação. Vale a dele.**
Registro os dois lados para que ninguém reabra isto por engano:

- **Minha recomendação (05/08)**: esconder o seletor *"Todas as empresas"* e o badge da empresa
  enquanto houver uma CNPJ só — um filtro que nunca filtra e um badge que repete a mesma
  palavra em todo card.
- **DECISÃO DO LEMUEL (05/08, corrigindo)**: **MOSTRAR, igual ao SIGA.** O seletor e o badge
  ficam **visíveis mesmo com uma empresa só**. Visual idêntico ao dos prints.

**Como a empresa entra** (decisão dele, mesma data): ela **já nasce cadastrada**. O cliente não
abre o sistema numa tela vazia pedindo "adicione sua empresa" — esse dado veio no cadastro dele
e quem instala já tem como preencher.
- fonte da verdade: **`cliente.config.js` → `empresas: []`** (lista, não objeto: o molde pode ter
  cliente com 2 CNPJs — matriz e filial, ou duas razões sociais disputando a mesma licitação);
- tabela `empresas` (`ddl/empresas.sql`), semeada por `tools/semeia_empresa.js`, que lê do config;
- API do molde: `LIMEDTEC.empresas()` e `LIMEDTEC.empresaPrincipal()`;
- **sem tela de gestão por enquanto** — é registro semeado, e só;
- 📌 **vale pro molde**: cliente novo do LIMEDTEC nasce com a empresa dele cadastrada porque o
  `cria_cliente` escreve o `cliente.config.js`, e o seeder lê de lá. Não depende de ninguém
  lembrar de rodar um insert à mão.

**Modelo de dados central:**
```
Negocio {
  oportunidade_origem   -> a licitação encontrada em Oportunidades
  empresa_vinculada     -> uma das empresas de "Minhas Empresas"
  estagio               -> Oportunidade | Qualificação | Disputa | Classificação | Contrato
  itens_selecionados    []
  anotacoes             texto/checklist livre
  tarefas               checklist com seções
  documentos_anexos     []
  arquivado             boolean
}
```

**Funil** (`/meus-negocios`) — duas visualizações trocáveis pelo botão "Visualização":
- **Lista**: abas com contador por estágio.
- **Kanban**: as 5 colunas lado a lado, **cards arrastáveis** entre estágios.

Card do Kanban: empresa vinculada, título, órgão, data de abertura, badges, **contador de
checklist ("0/15")**. Clicar abre um **drawer de detalhe** com: seletor de estágio, ações
"remover dos negócios"/"arquivar", a ficha da licitação (fonte, modalidade/número, órgão, objeto,
valor, data, modo de disputa) com botões Acessar/Tarefas/Documentação/Arquivos do edital/Converse
com o edital, **Anotações** (bloco com checkbox) e **Itens** (busca + lista, com opção de
adicionar item manualmente).

**Tarefas** — modal fullscreen "Tarefas X% / X de 15 concluídas". Ao criar um negócio, **15
tarefas-modelo são criadas automaticamente**, uma seção por estágio:
| estágio | tarefas |
|---|---|
| Oportunidade | Analisar o edital · Providenciar documentação de habilitação/qualificação · Solicitar esclarecimentos/Impugnar edital |
| Qualificação | Analisar mercado · Analisar concorrentes · Definir o melhor produto/serviço para a disputa |
| Disputa | Cadastrar proposta no portal · Fazer composição de preços · Definir a estratégia de preços · Participar da disputa |
| Classificação | Analisar documentação dos concorrentes · Analisar produto dos concorrentes · Enviar recurso/contrarrazão · Enviar proposta atualizada |
| Contrato | Assinar contrato |
Permite adicionar seções/tarefas customizadas. Progresso calculado.

**Quadros** (`/quadros`) — é a MESMA tela do Kanban, só um atalho direto.

**Agenda** (`/minha-agenda`) — mini-calendário + Dia/Semana/Mês. Eventos coloridos:
🔴 vencimento de documento da empresa · 🔵 abertura de sessão de disputa de um negócio.
Clicar mostra popup com início/fim/duração, descrição, "Adicionar ao Google Calendar" e "Abrir".
> **A Agenda não tem dados próprios**: é um **motor de eventos derivados** de (1) datas de
> abertura dos negócios ativos e (2) validade dos documentos em "Meus Documentos". Não criar
> tabela de evento manual.

**Meus arquivos** (`/meus-arquivos`) — lista de negócios arquivados. É só `Negocio.arquivado = true`.

---

### 6.3 ABA 3 — ANÁLISE
Detalhada na **seção 5** deste documento. Resumo: Análise de Mercado (mapa de calor por UF +
gráfico mensal + 7 ângulos: Correspondências, Catálogo, Estados, Órgãos, Empresas, Marcas,
Contratação Futura/PCA) · Histórico de Compras · Análise de Empresas (dossiê por CNPJ) ·
Encontrar fornecedor com IA (cota de 12/dia compartilhada com o "Converse com o edital").

> **Dependência dura, repetida aqui porque é o que trava o módulo**: tudo isso vive de uma base
> histórica de **resultados** de licitações encerradas (item, vencedor, CNPJ, valores homologados,
> situação), cruzada por UF/órgão/empresa/marca. É o "big data" do SIGA, montado com anos de
> coleta. A nossa busca atual traz o **edital**, não o resultado.

---

### 6.4 ABA 4 — DISPUTA (robô de lances)
Submenu: Comprasnet (única integração hoje). **Não é tela web**: é o download de um app desktop
Windows ("SIGA Client") que conecta na sessão do Comprasnet e **envia lances automáticos**.
Detecta sozinho as licitações que o usuário já cadastrou no Compras.gov. Só funciona em modo
Aberto e Aberto/Fechado **por item** (não por grupo). Requer Windows 10 64-bit, i5 4+ núcleos, 8GB.

> 🔴 **Recomendação: FORA do escopo** — e o Lemuel já chegou à mesma conclusão. É um cliente
> desktop que automatiza um portal de governo; não tem como sair de uma aplicação web. Além do
> custo, vale checar os **termos de uso do Comprasnet** sobre automação de lances antes de
> investir: é o tipo de coisa que, se for vedada, invalida o esforço inteiro. **Decisão de
> negócio do Lemuel**, não técnica.

---

### 6.5 ABA 5 — JURÍDICO
Submenu: *Impugnação · Esclarecimento · Intenção de recurso · Recurso · Contrarrazões* — todos
abrem a MESMA tela (`/pecas-juridicas?t=X`) filtrada por tipo. Busca por termo, toggle "Limitar
por órgão", toggle "Somente nova lei" (Lei 14.133/2021), abas pra trocar de tipo.

Os resultados são **peças jurídicas REAIS já protocoladas** por empresas em licitações passadas,
cada uma com o pregão de origem, um trecho do texto e "Abrir no portal". É um banco de modelos
reais pra inspirar a redação de peças novas.

> **Como isso existe**: esses documentos são anexados aos autos, que são públicos — o SIGA
> provavelmente faz scraping dos portais. Para nós é um **projeto de coleta de dados**, não uma
> tela: sem o acervo, a tela não tem o que mostrar. Combina com o gerador de minuta com IA que já
> está na seção 3 desta spec (o acervo vira o repertório do prompt).

---

### 6.6 TELAS TRANSVERSAIS
- **Ficha da licitação** (drawer usado em Oportunidades, Negócios e Análise): cabeçalho + botões
  Acessar/Arquivos do edital/Converse com o edital + lista de itens, cada item com sublinks
  **Histórico · Concorrência Potencial · Marcas Relevantes · Preços Praticados · Encontrar
  fornecedor**. *(Os 4 primeiros sublinks dependem da base de resultados — ver 6.3.)*
- **Notificações** (sininho): abertura de sessão (D-1/D-0) e vencimento de documentos.
- **Meus Dados**: dados pessoais, toggle do jornal diário, plano, quotas (empresas/jornais/negócios).
- **Minhas Empresas**: cadastro simples CNPJ/razão social, usado pra vincular negócios.
- **Meus Documentos**: repositório de arquivos da empresa **com data de validade** — alimenta as
  Notificações E a Agenda.

---

### 6.7 ORDEM RECOMENDADA (proposta técnica — o Lemuel decide)

Ordenado por **valor entregue ÷ dependência externa**, não pela ordem do menu:

| # | bloco | por quê |
|---|---|---|
| **1º** | **NEGÓCIOS / Funil + Tarefas** (6.2) | 🟢 **zero dependência externa**. Usa a busca que já está no ar + o nosso banco. É o que o Lemuel elogiou, é onde o trabalho do dia acontece, e o `Calendario 2025.xlsm` (item 8) já traz **2.578 linhas** pra semear com histórico de verdade em vez de tela vazia. |
| **2º** | **Agenda + Notificações** (6.2) | 🟢 derivadas do funil, quase de graça depois dele. Um alerta de "abre amanhã" tem valor imediato. |
| **3º** | **Meus Jornais** (6.1) | 🟡 precisa de cron + provedor de e-mail (custo — decisão do Lemuel). A busca salva em si é trivial. |
| **4º** | **Pesquisa avançada completa + Órgãos + Desertas** (6.1) | 🟡 incremento na tela que já existe; `orgaos` dá pra derivar do que já buscamos. |
| **5º** | **ANÁLISE** (6.3) | 🔴 **bloqueado** até achar e validar o endpoint de **resultados/atas do PNCP**. Esse é o próximo endpoint a caçar, do mesmo jeito que fizemos com o de itens. Sem ele, nada dessa aba existe. |
| **6º** | **JURÍDICO** (6.5) | 🔴 projeto de coleta de acervo, não tela. |
| **—** | **DISPUTA** (6.4) | ⛔ fora do escopo web. |

> ⚠️ **Nota de escopo honesta**: as abas 3 e 5 são, juntas, **anos de coleta de dados** do SIGA —
> não são "telas a implementar". O que nos diferencia hoje não é copiar isso, é o que o SIGA não
> tem: **o cruzamento do edital com o nosso estoque e o nosso preço unitário**, que já está no ar.
> O funil (6.2) é o que falta pra fechar o ciclo de trabalho em cima disso.

