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

## 3. V2 — registrado, NÃO construir agora
- **Comprasnet Goiás** e **Licitanet** (os dois portais mais relevantes pra GO).
- **Funil kanban** de negócios.
- **Templates jurídicos** (impugnação, recurso).
- Jornais com alerta recorrente por WhatsApp (reaproveitando o disparo da tela Vendas Ativas).

---

## 4. Plano de execução (entra DEPOIS da fila atual)

Ordem definida pelo Lemuel: **normalização por unidade → sync de dados → Blocos 2/4 → Licitações**.

| Etapa | Entrega | Estado |
|---|---|---|
| 0 | Estudo + esta spec | ✅ |
| 1 | **Protótipo busca + lista** com dados reais do PNCP + **screenshot pro Lemuel** | ⏸ aguarda a fila · **e a API voltar** |
| 2 | Cruzamento com estoque/preços (o diferencial) | — |
| 3 | `licitacoes_acompanhadas` + jornal + card "Próximas disputas" | — |
| 4 | KPIs + ordenação por aderência | — |

> Regra do Lemuel: **mostrar o screenshot do protótipo busca+lista ANTES** de construir o cruzamento.
