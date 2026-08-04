# 📋 Módulo LICITAÇÕES — estudo de referência + spec da v1

> Estudo de **funcionamento/UX** do SIGA Pregão (conta do Lemuel, navegação **somente leitura**,
> 04/08/2026). Nenhum dado deles foi copiado pro nosso banco — **nossa fonte é o PNCP**.
> Nada foi criado, alterado ou excluído na conta durante o estudo.

---

## 1. O que o SIGA Pregão faz

### 1.1 Home / Dashboard
KPIs do topo: **Negócios ativos** (6) · **Empresas cadastradas** (1) · **Licitações publicadas
hoje** (972) · **Eventos na agenda** (1). Abaixo, dois painéis: "Licitações publicadas hoje"
(com **itens publicados hoje: 23.610**) e "Agenda da semana". Dois CTAs grandes:
*Pesquisar oportunidades* e *Abrir meus negócios*.

**Leitura:** o número que eles vendem é **volume do dia** (licitações + itens). É o mesmo par de
KPIs que faz sentido pra gente — com a diferença de que nós podemos cruzar com estoque.

### 1.2 Menu principal
`Oportunidades` · `Negócios` · `Análise` · `Disputa` · `Jurídico`

Fluxo implícito: **achar** (Oportunidades) → **qualificar/analisar** (Análise) → **virar negócio**
(Negócios) → **agenda/disputa** (Disputa) → **pós** (Jurídico).

### 1.3 Busca de Oportunidades — filtros (o mais relevante pra nós)
Barra de busca livre + três atalhos: **Pesquisa avançada**, **Meus jornais**, **Encontrar por Nº**.

Painel de **Pesquisa avançada**:

| Filtro | Como funciona |
|---|---|
| Palavras-chave | Livres, **separadas por `;`** — múltiplos termos numa busca só |
| **Excluir** / **Limitar** | Refino do texto: termos que *não* podem aparecer e termos que *restringem*. É o que separa "material hospitalar" de ruído |
| Período | Dropdown do **tipo de data**: `Data de abertura` (e outras opções, ex. publicação) |
| Intervalo | Faixa de datas (default 2 semanas à frente: 04/08 – 18/08) |
| Tipo de item | `material` / `serviço` / Todos |
| Modo de disputa | Dropdown (aberto, fechado, dispensa com disputa…) |
| **Estados** | **Multisseleção das 27 UFs** em grade |

Ações do painel: **Buscar** e **Criar jornal**.

> **"Jornal" = busca salva que vira alerta recorrente.** É a feature de retenção deles: você
> monta o filtro uma vez e recebe o resultado todo dia. Vale copiar o conceito na v2.

### 1.4 O card de cada licitação
Campos observados:
- **Título**: `MODALIDADE Nº <número>/<ano> - <ÓRGÃO> / <UF>`
- **Objeto** (texto do edital)
- **Tags de categoria** do objeto (ex.: `Material esportivo`, `Equipamentos para atividades
  físicas`, `Acessórios esportivos`) — classificação automática do objeto
- **Abertura em DD/MM/AAAA às HH:MM**
- **Modo de disputa** (ex.: "Dispensa Com Disputa")
- **`Fonte:`** o **portal de origem** (ex.: *Secretaria do Planejamento e Gestão do Ceará*)
- **Badge de modalidade** (ex.: `Dispensa eletrônica`)
- Contador numérico à direita (aparenta ser **nº de itens**)

### 1.5 De quais portais eles puxam
O campo **`Fonte:`** no card mostra o portal originador. No exemplo capturado veio de uma
**secretaria estadual (CE)** — ou seja, eles agregam **múltiplos portais** (PNCP, ComprasNet,
BLL, BNC, Licitações-e, portais estaduais/municipais), não só o PNCP.
**Essa é a vantagem real deles sobre nós na v1** — cobertura de fonte.

### 1.6 Pago vs básico
⚠️ **Não verificado.** Não abri tela de planos/pagamento (a instrução era não tocar em botões de
ação/pagamento). Fica como lacuna declarada — dá pra levantar pela página pública de preços.

---

## 2. ⚠️ Cobertura honesta deste estudo

Percorri em profundidade: **Home/Dashboard** e **Oportunidades (busca + pesquisa avançada + card)**.

**NÃO percorri**: `Negócios`, `Análise`, `Disputa`, `Agenda` e `Jurídico`. O detalhamento do fluxo
pós-busca (itens do edital, planilha de proposta, sala de disputa, agenda) está descrito acima
apenas como **inferência a partir da estrutura do menu**, não como observação.
→ **Pendente:** segunda passada cobrindo essas 5 telas antes de fechar a v2.

---

## 3. Proposta do NOSSO módulo — v1

### 3.1 Fonte de dados
**API pública do PNCP** — `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao`
Parâmetros: `dataInicial` / `dataFinal` (yyyyMMdd) · `codigoModalidadeContratacao` ·
`uf` · `pagina` · `tamanhoPagina` (até 500). Sem chave, sem custo.

> ⚠️ **Status em 04/08/2026 14h: a API estava FORA DO AR** — `504 Gateway Time-out` sem filtro de
> UF e `503 Service Unavailable` com `uf=GO`. Não é erro de parâmetro: o host não respondeu.
> Isso já define um requisito: **o módulo tem que degradar com elegância** (cache + aviso
> "PNCP indisponível, mostrando a última busca de HH:MM"), nunca tela branca.

### 3.2 Escopo v1 (o que replicamos)
- **Busca do dia** com: UF (multisseleção, default **GO**), palavras-chave do objeto
  (default: `medicamento; hospitalar; material médico; farmac; soro; correlatos`),
  modalidade, período.
- **Excluir / Limitar** copiado do SIGA — sem isso o ruído inviabiliza a triagem.
- **Lista**: órgão, objeto, valor estimado, data/hora da disputa, prazo de proposta, link do
  edital/portal, badge de modalidade.
- **KPIs**: publicadas hoje (com os filtros) · itens somados · quantas com aderência ao estoque.
- **Agenda**: botão *acompanhar* → tabela `licitacoes_acompanhadas` (RLS: gestor grava, todo
  logado lê) + card **"próximas disputas"** no Dashboard.
- **Acesso**: menu em FERRAMENTAS, liberado pra **gestor + vendedor**.
- **Tema claro** padrão do sistema.

### 3.3 🎯 O diferencial (o que eles NÃO têm)
**Cruzamento com o nosso estoque e os nossos preços.** O SIGA classifica o objeto por categoria
genérica (`Material esportivo`…); nós casamos **item a item** com o motor que já existe aqui
(PA + dose — `_cpzKey`, `doseKey`, as barreiras do Bloco 1) e respondemos duas perguntas que
nenhum agregador responde:

1. **"X itens desta licitação estão no nosso estoque"**
2. **"Y itens onde o nosso preço ≤ o valor de referência do edital"** ← decide se vale disputar

E ordenamos a lista **por aderência**, não por data. Isso só é possível porque o estoque próprio
(1.381 linhas) e as 7.451 cotações de distribuidor já estão no banco, com PA preenchido e a
régua da CMED (25.702 apresentações) pra validar o preço de referência.

### 3.4 Fica pra v2
- **Outras fontes** além do PNCP (ComprasNet, BLL, BNC, portais estaduais) — é a cobertura que o
  SIGA tem e nós não.
- **"Jornais"** (busca salva recorrente + alerta diário no WhatsApp, reaproveitando o disparo da
  tela Vendas Ativas).
- Fluxo pós-busca: análise de itens → proposta → sala de disputa → jurídico.
- Classificação automática do objeto por categoria (as tags coloridas deles).

### 3.5 Privacidade (regra fixa)
A API do PNCP **só recebe filtros públicos** (UF, datas, modalidade, palavras-chave genéricas).
**Nenhum dado nosso sai** — produto, preço, custo, cliente e estoque ficam no navegador/banco.
O cruzamento acontece **do nosso lado**, sobre o retorno público.

### 3.6 CORS
Se o browser barrar a chamada direta, entra **edge function proxy leve** no Supabase da FPMED,
com **cache de 15 min** por combinação de filtros (não abusar da API pública) e a mesma trava de
origem já usada na `ler-pedido`.

---

## 4. Plano de execução

| Etapa | Entrega | Estado |
|---|---|---|
| 0 | Estudo do SIGA + esta spec | ✅ (com a lacuna da §2) |
| 1 | **Protótipo busca + lista** com 1 dia real do PNCP + screenshot | ⏸ **bloqueado: API do PNCP fora do ar** |
| 2 | Cruzamento com estoque/preços (o diferencial) | — |
| 3 | Agenda + `licitacoes_acompanhadas` + card no Dashboard | — |
| 4 | KPIs + ordenação por aderência | — |

Testes por etapa: **parser do retorno da API** (fixture de um dia real, versionada) e
**matching item × nosso produto** (reaproveita as suítes do motor).
