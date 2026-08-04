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

## 2. NOSSO MÓDULO — V1 (a construir)

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
