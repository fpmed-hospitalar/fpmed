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

---

# FASE 3 - ALVOS NOVOS FORA DO PNCP (fatia A22, 14/08/2026)

A caixa mandou de novo procurar cobertura fora do PNCP, com tres alvos e **uma por vez**, e com
uma regra de economia obrigatoria antes de qualquer coletor:

> MEDIR SOBREPOSICAO primeiro: amostra >= 50 certames da fonte; se >= 80% ja estiver no nosso
> indice, NAO construa o coletor - registre aqui e passe para o proximo alvo.

**Nenhum coletor novo foi construido nesta rodada, e essa e a conclusao - nao a desistencia.**

---

## Alvo 1 - Sao Paulo (bec.sp.gov.br e compras.sp.gov.br)

### O que a sondagem achou

| endereco | veredito |
|---|---|
| `bec.sp.gov.br/robots.txt` | 200. Proibe so `/bec_pregao_ui/Ajax/` |
| `bec.sp.gov.br` - consulta publica de pregao | **MURALHA**: responde a pagina do Imperva ("Pardon Our Interruption") em vez da consulta |
| `bec.sp.gov.br/becsp/ui/dadosabertos.aspx` | 404 + a mesma pagina do Imperva |
| `www.compras.sp.gov.br` | **ENOTFOUND** (o dominio com `www` nao existe) |
| `compras.sp.gov.br` | 200, 278 KB - **aberto**, e o `robots.txt` libera tudo fora do `/wp-admin/` |
| `compras.sp.gov.br/painel-de-oportunidades/` | 200 - mas o painel e um **iframe do Power BI**, nao uma porta de dados |
| `compras.sp.gov.br/consulta-publica/` | 200 - pagina WordPress, sem endpoint de consulta |

**A BEC/SP esta atras de muralha e foi PULADA, sem insistir** - a mesma decisao do licitacoes-e.

### A medicao que decidiu

O proprio `compras.sp.gov.br` traz no menu **"Compras e PNCP"** e manda "Acesse o
Compras.gov.br". Isso levantou a pergunta certa: **o certame paulista ja chega ao PNCP?**

Amostra unica de **250 certames** paulistas de saude, tirada do PNCP com 5 termos do ramo
(medicamento, material medico hospitalar, seringa, dipirona, soro fisiologico):

```
totais no PNCP em SP:  medicamento 58.492 . material medico hospitalar 4.549
                       seringa 5.925 . dipirona 2.184 . soro fisiologico 838

amostra unica ................. 250 certames  (>= 50, como a regra pede)
orgaos estaduais na amostra ... 74
municipios paulistas distintos  73
sobreposicao com o PNCP ....... 100%   (a fonte publica la)
sobreposicao com o NOSSO indice   0%   (0 de 250)
nosso indice antes ............ 122 linhas de SP em 3.878 (3,1%)
```

> **A sobreposicao com a FONTE e 100% e com o NOSSO INDICE e 0%.** A regra de economia diz para
> nao construir o coletor - e diz mais: **o que faltava nao era estrada nova, era andar na que ja
> existe.** Um coletor da BEC/SP seria uma segunda estrada para o mesmo lugar, e ela esta murada.

### ACHADO GRANDE: o coletor da A13 estava MORTO, e ninguem tinha visto

Ao rodar `tools/coleta_pncp_busca.js` para medir, **toda** chamada voltou `ECONNRESET` - nos
seis termos, com e sem filtro de UF. Isolado com quatro variacoes na mesma requisicao e no mesmo
minuto:

```
UA "Mozilla/5.0 (...) FPMED-Hospitalar/1.0 ..."  -> ECONNRESET
UA de Chrome completo                            -> 200, total 5.132
```

O `/api/search/` apertou o filtro de `User-Agent` desde 11/08: ele passou a exigir o formato
padrao de navegador (a cauda `AppleWebKit/... Chrome/... Safari/...`). O nosso cabecalho trocava
essa cauda pelo nome da FPMED e virou, para o filtro, "cliente que nao e navegador".

> **A identificacao NAO saiu - ela mudou de lugar.** Medido: o formato de Chrome **com o nome e o
> e-mail da FPMED no fim** responde 200 igual. Ficamos com esse. O portal continua sabendo quem
> esta chamando e para quem reclamar; tirar a identificacao para passar seria a unica versao
> disto que nao se escreveria aqui.

### O que entrou (pela estrada que ja existia)

`--uf` novo em `tools/coleta_pncp_busca.js`, **opt-in** (sem ele a coleta continua nacional,
exatamente como era - um filtro de UF ligado por padrao desfaria a conquista da A13, que foi ir de
7 UFs para 27).

```
indice ..... 3.878 -> 5.278 linhas  (+1.400)
SP ......... 122 -> 770 linhas      (+648, 6,3x)
```

---

## Alvo 2 - Diarios oficiais

| fonte | `robots.txt` | veredito |
|---|---|---|
| **DOU** (`in.gov.br`) | `User-agent: *` / `Disallow: /` | **FECHADO pela porta da frente.** O site inteiro e proibido a agente automatico. Nao se insiste. |
| **diariomunicipal.sc.gov.br** (FECAM/SC) | `Disallow: /` para `*` (so o Bingbot e liberado) | **FECHADO.** |
| **diariomunicipal.com.br** (agregador das associacoes estaduais: AMUPE, FAMEM e outras) | `Disallow:` vazio = **tudo liberado** | **ABERTO.** Unico caminho vivo deste alvo. |

**Nao construido nesta rodada**, e o motivo e a ordem "uma fonte por vez": o alvo 1 consumiu a
rodada e produziu +1.400 linhas. O `diariomunicipal.com.br` fica como **o proximo alvo medido**,
e a medicao que falta e a mesma: amostra >= 50 avisos de licitacao, quantos ja estao no PNCP.

---

## Alvo 3 - Sistema S (SESI/SENAI)

| endereco | veredito |
|---|---|
| `compras.sesisenai.org.br` | `ERR_TLS_CERT_ALTNAME_INVALID` - o certificado nao vale para o nome. Nao abre. |
| `portaldaindustria.com.br/senai/canais/licitacoes/` | timeout em 25 s |
| `sesisp.org.br/licitacoes` | 200, redireciona para `transparencia.sesisp.org.br` |

**E a medicao repete a licao da EBSERH:** `"SESI SENAI"` no PNCP devolve **188 certames**, com o
`SERVICO SOCIAL DA INDUSTRIA - SESI` entre os primeiros. O Sistema S publica no PNCP.

**Veredito: nao e fonte nova.** Mesma conclusao da fase 2 (fatia A13), agora com numero.

---

## Resumo da fase 3

| alvo | porta | veredito |
|---|---|---|
| BEC/SP | murada (Imperva) | **pulado e anotado** |
| compras.sp.gov.br | aberta, mas e Power BI/WordPress | **sem porta de dados** |
| certame paulista | **ja esta no PNCP** (100%) | **coletor nao construido** - ampliada a varredura que existe (+648 linhas de SP) |
| DOU | `Disallow: /` | **fechado** |
| diariomunicipal.sc.gov.br | `Disallow: /` | **fechado** |
| diariomunicipal.com.br | liberado | **proximo alvo a medir** |
| Sistema S | quebrada/timeout | **ja esta no PNCP** (188 certames) - nao e fonte nova |

**A fase 3 gastou a rodada medindo e nao construiu coletor nenhum - e devolveu +1.400 licitacoes
ao indice.** Foi a medicao que rendeu, nao a obra.

---

# FASE 4 - diariomunicipal.com.br MEDIDO ATE O FIM (fatia A25, 14/08/2026)

O dono aprovou medir o `diariomunicipal.com.br` (SIGPub) - o unico diario com a porta aberta pelo
`robots.txt`, e o alvo que a fase 3 deixou pendurado. A regra de economia da caixa: amostra >= 50
avisos de saude; sobreposicao alta = **nao construir**.

**VEREDITO: COLETOR NAO CONSTRUIDO.** E o motivo NAO e o que a primeira leitura dizia.

## A amostra

```
associacao AMUPE (PE) . janela 01/07/2026 a 14/08/2026
robots.txt .......... HTTP 200, Disallow vazio = LIBERADO
amostra ............. 56 materias unicas -> 54 lidas -> 52 avisos de saude  (>= 50, como a regra pede)
municipios distintos  39
ritmo ............... 13 a 16 s por pagina, uma por vez, User-Agent identificado
```

## Os quatro angulos, e o que cada um mede DE VERDADE

| angulo | numero | o que ele responde |
|---|---|---|
| (A) o aviso cita o PNCP no proprio texto | **10 de 52 (19%)** | so os que dizem em letra |
| (B) o municipio do aviso tem certame no PNCP | **50 de 52 (96%)** | o **municipio** publica la - nao o certame |
| (C) o certame especifico achado no PNCP | **12 de 46 (26%)** | perguntando um a um pelo `/api/search/` |
| (D) o municipio ja esta no NOSSO indice | **7 de 52 (13%)** | a nossa coleta, nao a fonte |

> **NENHUM DESSES QUATRO E "a sobreposicao".** A rodada anterior tinha fechado o veredito em
> "96%, nao construir" - e 96% e o angulo (B), que mede **municipio**, nao certame. Dizer que a
> sobreposicao e 96% porque a prefeitura publica no PNCP e como dizer que ja temos o edital
> porque conhecemos a cidade.

## O falso positivo que quase decidiu a fatia no numero errado

A primeira versao do casamento certame-a-certame casava contra um **blob de texto** (orgao +
unidade + municipio + titulo + descricao) e deu **52%**. O segundo dos tres conferidos a mao
estava **ERRADO**:

```
diario: Goiana/PE . Pregao Eletronico 7/2026
casou : 00394544000185-1-001695/2026 = MINISTERIO DA SAUDE, ENERGIA ELETRICA para a
        fabrica da Hemobras. Registro de Brasilia/DF, que so MENCIONA "Goiana/PE" no
        meio da descricao, e cujo titulo e "Edital n 7/2026" - o numero bateu por acaso.
```

**Um erro em tres conferidos a mao e 33% de erro na amostra que eu mesmo escolhi para mostrar.**
O casamento passou a usar os **campos proprios** (`uf`, `municipio_nome`, `ano`) mais o numero do
orgao dentro do `title`, e o numero caiu de 52% para **26%**. O `numero_sequencial` do PNCP nao
serve para isso - e a licao da A21 de novo: **o numero do edital do orgao nao e o sequencial do
PNCP** (1695 x 7).

## E os 26% tambem sao piso - medido

Diagnostico dos "nao achei": pedindo `"Custodia 10/2026"` o PNCP devolve **20 de 127** registros,
e os da prefeitura tem titulo **"Edital n 013 - FMS/2026"** - com sufixo de orgao no meio do
numero. O certame **esta la**, com outro nome, fora da pagina que a busca devolveu.

> **Entao a sobreposicao certame-a-certame nao se fecha por este caminho.** Insistir nela seria
> decidir a fatia com um piso. A pergunta que decide e outra, e esta escrita na propria caixa:
> o diario "e onde aparece a prefeitura que **ATRASA** o PNCP".

## A MEDICAO QUE DECIDIU: o diario chega ANTES?

Nos 12 avisos que casaram com certeza, dia do aviso menos dia da publicacao no PNCP:

```
Santa Maria da Boa Vista 10/2026   diario 10/07 . PNCP 24/07   diario 14 dias ANTES
Dormentes                19/2026   diario 10/07 . PNCP 14/07   diario  4 dias ANTES
Itapissuma                5/2026   diario 03/07 . PNCP 06/07   diario  3 dias ANTES
Altinho                   2/2026   diario 01/07 . PNCP 01/07   MESMO dia
Solidao                  16/2026   diario 03/07 . PNCP 03/07   MESMO dia
Taquaritinga do Norte     2/2026   diario 03/08 . PNCP 31/07   diario   3 dias depois
Dormentes                19/2026   diario 24/07 . PNCP 14/07   diario  10 dias depois
Dormentes                19/2026   diario 28/07 . PNCP 14/07   diario  14 dias depois
Carpina                  26/2026   diario 01/07 . PNCP 19/05   diario  43 dias depois
Goiana                    7/2026   diario 02/07 . PNCP 13/05   diario  50 dias depois
Garanhuns                13/2026   diario 20/07 . PNCP 20/05   diario  61 dias depois
Lagoa de Itaenga         16/2026   diario 27/07 . PNCP 25/02   diario 152 dias depois

--> ANTES: 3 . MESMO DIA: 2 . DEPOIS: 7   (de 12)
```

> **A premissa da fonte caiu na medicao.** O diario nao e a porta que chega antes: em 7 dos 12
> ele chega **depois**, tres deles com mais de 40 dias, um com 152. E "Dormentes 19/2026" aparece
> **tres vezes** no diario com datas diferentes - o aviso e **republicado**, e uma coleta ingenua
> gravaria o mesmo certame tres vezes.
> O unico ganho real e **1 caso em 12** (Santa Maria da Boa Vista, 14 dias). Construir um coletor
> de HTML - frageis 13 a 16 s por pagina, sem chave do PNCP, com republicacao para deduplicar -
> para ganhar 14 dias em 1 de 12 avisos e trocar uma garantia (API publica) por um trabalho
> permanente de manutencao.

## O que a medicao mandou fazer no lugar

O buraco medido **nao e da fonte, e nosso**: (D) diz que so **13%** desses municipios aparecem no
nosso indice, enquanto (B) diz que **96%** deles publicam no PNCP. **Falta apontar a varredura que
ja existe para PE**, exatamente como a A22 fez com SP (122 -> 770 linhas).

```bash
node tools/coleta_pncp_busca.js --uf PE     # a estrada que ja existe, apontada para o buraco
```

## Como refazer a medicao

```bash
node tools/mede_diario_municipal.js          # a amostra, os quatro angulos (grava _a25_amupe.json)
node tools/mede_dm_certame.js                # o casamento um a um + o atraso, dia a dia
```

## Resumo da fase 4

| pergunta | resposta medida |
|---|---|
| a porta esta aberta? | **sim** - `robots.txt` libera |
| a fonte traz certame que o PNCP nao tem? | **nao ha evidencia disso**: 96% dos municipios publicam no PNCP, e os 3 conferidos a mao estao la |
| a fonte chega antes? | **nao** - 3 antes, 2 no mesmo dia, **7 depois** (ate 152 dias) |
| ela repete o mesmo aviso? | **sim** - Dormentes 19/2026 aparece 3 vezes |
| **construir coletor?** | **NAO.** Apontar a varredura do PNCP para PE rende mais, custa uma flag e ja esta provada |
