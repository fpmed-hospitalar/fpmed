# Plano de fontes — de onde vêm as licitações

**Fatia A8, 14/08/2026.** A fase 1 foi **executada**; as fases 2 e 3 são **registro**, por ordem
do dono: anotar agora, não construir.

---

## Fase 1 — PNCP, nacional · **EXECUTADA**

### O que entrou

| peça | estado |
|---|---|
| coleta das **27 UFs** (era 7) | ✅ `tools/coleta_pncp.js` |
| busca `tsvector` + `unaccent` + radical português | ✅ `ddl/busca_licitacoes.sql` |
| busca **também pelos itens do edital** | ✅ `ddl/busca_itens.sql` |
| sinônimos do ramo, em tabela editável | ✅ `busca_sinonimos` |
| seletor de portais com contagem real | ✅ view `v_portais` |

### A medição que mudou o desenho desta fase

Com o `tsvector` no `objeto` funcionando — 3.201 de 3.201 vetorizados, acento e radical
provados — busquei o termo que o dono usa, **“albumina”**, e deu **zero**.

Não era defeito da busca. Medido com `ILIKE` cru nas 3.201 licitações do índice:

```
albumina .. 0     soro .. 0     dipirona .. 0     seringa .. 4     caneta .. 0
```

> **O `objeto` do PNCP é genérico.** Ele diz *“Aquisição de material médico-hospitalar para as
> unidades de saúde”* — 226 caracteres em média. O nome do produto **não está ali**: está na
> descrição de cada **item**.

O contraste, medido: **“caneta” aparece 0 vezes em 3.201 objetos, e 5 vezes nos 195 itens de uma
única licitação.**

**Consequência direta, e ela é o achado mais importante da fatia:** coletar as 27 UFs **não
resolveria sozinho**. A busca por produto continuaria dando zero, só que sobre uma base quatro
vezes maior — e *zero* numa base grande é ainda mais convincente e ainda mais falso. **O que
faltava não era abrangência, era profundidade.**

Por isso a busca passou a olhar os dois, e a **dizer onde casou**:

- `casou_em = 'objeto'` → a compra inteira é daquilo;
- `casou_em = 'itens'` → há um item no meio de outros duzentos;
- `itens_casados` → 1 item em 500 e 180 em 195 são oportunidades de tamanhos opostos.

### O que está bloqueado por fora, medido em 14/08

```
/api/consulta/v1/contratacoes/publicacao  ->  TimeoutError em 30.022 ms
/api/pncp/v1/orgaos/.../itens             ->  HTTP 200 em 179 ms
```

A **API de consulta** do PNCP (a que alimenta a varredura diária) estava fora; a **API de
detalhe** (itens, arquivos, resultados) respondia normalmente. As 27 UFs estão configuradas e o
mecanismo tem backoff, circuit breaker e retomada por dia — **falta a janela em que o PNCP
responda** para a carga histórica rodar.

> Isto não é conclusão nova: o PNCP caiu quatro vezes em dois dias na semana anterior, e foi
> exatamente esse histórico que motivou o índice próprio.

### O seletor de portais tem **um** portal, e isso é fato

`v_portais` hoje: **PNCP · 3.201 · 1.292 abertas**. Só um.

A coluna `portal` é constante na base — o que confirma a medição do item 12 do dono. O seletor
existe e lê o número real; ele vai crescer quando entrar a primeira fonte da fase 2, e não
antes. **Seletor com uma opção não é enfeite aqui: é o lugar onde a segunda fonte aparece no dia
em que existir.**

---

## Fase 2 — fontes fora do PNCP · **só registro**

Cada fonte futura é um **coletor separado despejando na MESMA tabela `licitacoes`**, com selo de
origem na coluna `portal` — exatamente como o Calendário 2025 entrou. Nada de tabela nova por
fonte: duas tabelas de licitação seriam duas respostas para “o que existe?”.

| fonte | o que é | o que ela exige que o PNCP não exige |
|---|---|---|
| **licitacoes-e** (Banco do Brasil) | portal de licitações de municípios e autarquias | não há API pública documentada; acesso costuma ser por sessão autenticada |
| **EBSERH / Petronect** | estatais de saúde (Lei 13.303/2016) | portais próprios, cadastro de fornecedor por portal |
| **Sistema S** (SESI, SENAI, SESC, SENAC) | regulamento próprio, não segue a 14.133 | publicação dispersa por regional |

> **O ponto que decide, e ele não é técnico:** a garantia que sustenta o índice de hoje é que o
> PNCP tem **API pública** — é um serviço feito para ser consultado por máquina. Raspar um portal
> que não oferece isso troca essa garantia por um acordo tácito, e a decisão de fazê-lo é do
> dono, não minha. Está registrado como decisão pendente, não como tarefa.

---

## Fase 3 — o que só faz sentido depois da fase 2

- **Dedupe entre fontes.** O mesmo pregão pode aparecer no PNCP e no portal de origem. A chave
  hoje é `numero_controle`, que é do PNCP — uma licitação que venha só do licitacoes-e não tem
  esse número, e a chave precisará de um segundo formato.
- **Contadores por portal na tela**, que só têm razão de existir com mais de um portal.
- **Qualidade por fonte:** quanto cada portal preenche de valor estimado, data de abertura e
  itens. O PNCP já mostra que campo existir não é campo vir preenchido — `valor_global` veio
  vazio em 30 de 30 na busca nacional.

---

## Como rodar o que existe

```bash
node tools/coleta_pncp.js                      # as 27 UFs, dia a dia, com retomada
node tools/coleta_pncp.js --uf GO,DF --dias 1  # janela forçada, para conferir
node tools/coleta_editais.js --meus-negocios   # editais, SÓ sob demanda
node tools/coleta_resultados.js --meus-negocios
```

E a busca, do banco:

```sql
select * from buscar_licitacoes('albumina', null, null, null, null, 50, 0);
select * from v_portais;
```


---

# FASE 2 — EXECUTADA E MEDIDA EM 14/08/2026 (fatia A13)

> **O dono aprovou agregar fontes.** As muralhas da caixa: só página pública de consulta, sem
> login, sem burlar captcha ou qualquer barreira; ritmo educado; identificação honesta; cada
> fonte = coletor separado na MESMA tabela com selo de origem; zero cópia de código ou asset de
> terceiro. **Se o portal bloquear ou exigir desafio: pula e anota.**

## O que cada fonte respondeu, na ordem de valor da caixa

| fonte | medido em 14/08 | veredito |
|---|---|---|
| **licitacoes-e** (Banco do Brasil) | **HTTP 403 em tudo**, inclusive no `/robots.txt` — resposta de 116 KB com desafio anti-robô. Não dá nem para ler o arquivo que diria o que é permitido. | **MURALHA — pulei.** Passar disso é exatamente o que a caixa proíbe. |
| **Petronect** (Petrobras) | portal SAP com sessão; `/robots.txt` devolve página de erro do runtime Java. E é compra da Petrobras — **não é saúde**. | **pulei**, por barreira e por escopo. |
| **EBSERH** | **17.981 editais dela JÁ ESTÃO NO PNCP**, publicados por ela mesma. Achada até na busca por "albumina" (Pelotas/RS, Aquisição de Albumina Humana). | **não é fonte nova** — é conteúdo da fonte que já temos. |
| **Sistema S** | SENAC publica no PNCP (1.351). SESI (1.182), SESC (2.726) e SENAI (987) aparecem em maioria como **contratados por municípios**, não como publicadores. Portais próprios são por regional. | parcialmente coberto pelo PNCP; o resto não compensa o risco. |

> **Então a fase 2 não entregou fonte nova — e a medição diz por quê.** O que ela entregou foi
> mais útil: a descoberta de que o valor que se procurava fora **já está dentro**, e de que a
> porta pela qual íamos buscá-lo **estava fechada**.

## A porta fechada, e a que está aberta

A API de **consulta** do PNCP (`/api/consulta/v1/...`), que alimenta a varredura diária, continua
fora — `TimeoutError` em 30.034 ms, medido de novo agora. E o detalhe da compra **mudou de casa
para dentro dela**:

```
/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}
  -> HTTP 301 "Este endpoint foi movido para: /api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{seq}"
     -> TimeoutError em 30.034 ms
```

O que **está no ar**: o `/api/search/` (o mesmo que a tela já usa na busca nacional) e o
`/api/pncp/v1/.../itens` (milissegundos). Daí nasceu `tools/coleta_pncp_busca.js`: **não é fonte
nova nem raspagem** — é a API pública do próprio PNCP, com ritmo educado e identificação honesta.

**Resultado medido da primeira rodada:** 741 achados · 21 já no índice · **400 licitações novas
gravadas, das 27 UFs** (SP 122 · CE 73 · MG 27 · RS 23 · PE 16 · BA 16 · … · AC 1), inclusive a
EBSERH. O índice cobria 7 UFs; passou a cobrir 27 — pela porta que estava aberta.

**O que ela NÃO traz, dito antes de alguém procurar:** a janela de proposta
(`data_abertura`/`data_encerramento`). O `/api/search/` não a publica e o detalhe da compra está
fora. As linhas entram com esses campos em `NULL` — que é "não sei", nunca uma data inventada — e
o `bruto` leva `_coleta: 'busca'`. **O buraco se fecha sozinho** quando o PNCP voltar: a varredura
normal grava pela MESMA chave natural `(portal, cnpj, ano, sequencial)` e vai *preencher* essas
linhas em vez de duplicá-las.

**E só o que está recebendo proposta entra.** Medido: "albumina" com `status=todos` dá 3.658
editais e os primeiros são de 2023–2024 (a busca ordena por relevância, não por data); com
`status=recebendo_proposta` dá 169, de julho e agosto de 2026. Índice grande não é índice bom:
despejar edital encerrado há dois anos é ruído com aparência de cobertura.
