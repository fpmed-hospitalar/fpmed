# DOSSIÊ PRO ARQUITETO — FPMED

Tudo que o arquiteto precisa saber de cor pra nunca haver confusão entre nós dois.
Escrito em **11/08/2026**. Mantido por mim (Claude Code) quando algo estrutural mudar.

> **Nenhum segredo aqui.** Chave, token e senha se mencionam pelo **nome do secret**,
> nunca pelo valor. Este documento viaja por chat.

> **Todo número deste dossiê foi levantado na fonte hoje**, não de memória — e a
> checagem já pagou: eu tinha três nomes de tabela errados na cabeça e um deles nem
> é tabela. Estão corrigidos abaixo, com o erro anotado.

---

## 1 · GLOSSÁRIO — os nomes internos

### 1.1 Tabelas (contagem real de 11/08)

| tabela | linhas | o que é |
|---|---:|---|
| `negocios` | **2.558** | o funil. Cada linha é um certame acompanhado. **É a tabela mais importante do sistema.** |
| `licitacoes_acompanhadas` | 2.555 | o índice de licitações coletadas do PNCP (a matéria-prima da busca) |
| `municipios` | 5.571 | IBGE, com lat/long — base do radar por raio |
| `cotacoes` | 8.832 | os itens/produtos, com preço e saldo. **A coluna `estoque_em` diz QUANDO aquele saldo foi visto** |
| `cmed_precos` | **25.702** | a tabela CMED de preços (PF/PMVG) |
| `cmed_teto` | 4.875 | o teto derivado, que é o que a trava consulta |
| `usos_ia` | 8 | o contador de uso de IA. **Cada leitura/chat vira uma linha aqui, com custo** |
| `v_leituras_cobranca` | 8 | a visão de cobrança (o que vira fatura) |
| `negocio_alteracoes` | 4 | trilha de alteração da ficha, **gravada por trigger** |
| `credenciamentos` | 2 | credenciamento por órgão, com trilha por trigger |
| `perfis` | 3 | usuários e papéis |
| `empresas` | 1 | a empresa dona do negócio |
| `jornais` | 1 | os "meus jornais" (filtros salvos que viram boletim) |
| `cobranca_config` | 1 | margem de repasse, preços por token, **e o futuro teto de perguntas do chat** |
| `coleta_status` | 1 | estado da coleta entre execuções (rodízio de UF) |
| `negocio_anexos` · `negocio_itens_ganhos` · `lembretes` · `documentos` · `declaracoes` · `pecas_juridicas` · `clientes` · `fornecedores` | 0 | existem e estão vazias — funcionalidade construída, ainda não usada com dado real |

**Três correções que a conferência de hoje impôs** — se o arquiteto me vir usando o
nome antigo, é erro meu:

- **`anexos_edital` NÃO é tabela.** É um `ALTER` que troca o *check* de categoria da
  `negocio_anexos` (acrescenta `edital` e `anexo_edital` às 7 categorias que já existiam).
- **`estoque` NÃO é tabela.** Estoque é a coluna `estoque` da `cotacoes`, com
  `estoque_em` marcando a idade do saldo.
- **`leituras_edital` existe em `ddl/` e NÃO existe no banco** (404), e não é
  referenciada por nenhuma tela. É desenho antigo, superado pela `usos_ia`.
  **Ponta solta conhecida** — não confiar nesse nome.

### 1.2 Edge functions (Supabase, Deno)

| função | versão | o que faz |
|---|---|---|
| `coletar-licitacoes` | v10 | puxa do PNCP e alimenta `licitacoes_acompanhadas`. Roda por cron, com rodízio de UF |
| `enviar-boletim` | **v12** | monta e envia o boletim dos jornais. Carrega a **trava de compliance de remetente** e a **sonda** `{"conferir":true}` |
| `ler-edital` | v5 | leitura de edital por IA, **em partes**. 5 tarefas: `resumo`, `itens`, `juntar`, `itens-ganhos`, `mapa-precos` |
| `ler-pedido` | v8 | leitura de pedido/cotação |

**Segredos usados (pelos nomes):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY`, `COLETA_TOKEN`, `BOLETIM_TOKEN`, `RESEND_API_KEY`.
**`BOLETIM_REMETENTE` não está configurado** — é de propósito, ver a seção 5.

### 1.3 Telas

| arquivo | o que é |
|---|---|
| `fpmed_licitacoes.html` | **Encontrar** — busca de licitações. Banco primeiro, PNCP nacional depois, em bloco separado |
| `fpmed_negocios.html` | **Negócios** — o funil/kanban, a ficha com abas, o stepper de etapas, credenciamento |
| `fpmed_sistema_final.html` | o sistema comercial (cotação, estoque, pedidos) |
| `fpmed_giovana.html` | a proposta — casamento edital↔estoque, trava CMED, geração do PDF |
| `fpmed_edital_ia.html` | **Leitor IA** — leitura de edital em partes, com custo antes do clique |
| `fpmed_conferidor.html` | confere proposta contra o teto CMED |
| `fpmed_documentos.html` · `fpmed_declaracoes.html` · `fpmed_pecas.html` | documentos, declarações, peças jurídicas |
| `fpmed_painel.html` · `fpmed_vendas.html` · `fpmed_competitividade.html` · `fpmed_viabilidade.html` | painéis |
| `fpmed_tema.css` | **o design system** — daqui sai toda cor e todo espaçamento |
| `limedtec-menu.js` | rascunho do menu lateral, **inerte, não carregado por tela nenhuma** (viola o adendo: emoji e cor chumbada) |

### 1.4 Suítes-chave (de 85 em `tests/` + 8 em `tests/db/`)

| suíte | o que guarda |
|---|---|
| `testa_padrao.js` | **a auto-fiscalização do padrão** — documentos, lições, tokens, estados |
| `testa_tema.js` | o design system, **incluindo 22 pares de contraste medidos pela WCAG** |
| `testa_remetente_compliance.js` | nenhum e-mail FPMED sai por domínio da GlobalMed |
| `testa_edge_sanidade.js` | "deploy OK" não é "função de pé" — lê cada edge function com pilha de escopos |
| `testa_teto_cmed.js` · `testa_teto_na_proposta.js` · `testa_proposta_pmvg.js` | a trava do teto onde o preço é decidido |
| `testa_leitura_partes.js` · `testa_itens_edital.js` | leitura de edital de qualquer tamanho e extração de itens |
| `testa_busca_nacional.js` · `testa_pncp_fora.js` | busca nacional e o que fazer quando o PNCP não responde |
| `testa_kpis_clicaveis.js` · `testa_funil_negocios.js` | os números do topo do Negócios |
| `testa_compliance.js` | a regra master GlobalMed ↔ FPMED |

**`tools/`** guarda as provas manuais (`prova_*.js`) e os utilitários (`deploy_edge.js`,
`fechamento_mes.js`, `atualiza_cmed.js`, `roda_sql.js`).

---

## 2 · A FILA NUMERADA — estado de hoje

| nº | item | estado |
|---|---|---|
| 1 | Spec da reforma (`docs/spec_reforma_prime.md`) | ✅ `4485c30` |
| 2 | **`fpmed_tema.css` — o design system** | ✅ `c0b12e1` |
| 3 | **Menu lateral refeito sobre os tokens** | ✅ `8082d77` · ganhou **portão de permissão** em `bd35ff1` |
| 4 | **Encontrar no tema claro + navegação única** | ✅ `bd35ff1` — publicado, laço visual nas 3 larguras |
| 4b | **Segurança: CVE-2024-4367 no PDF.js** | ✅ `a220dee` — `isEvalSupported:false` nas 5 chamadas |
| 4c | **Alarme de coleta** | ⬅️ **PRÓXIMO** — decidido, ver §2b |
| 5 | Kanban protagonista | |
| — | *(ver §2b: fila de fundação e itens que param pra decisão)* | |
| 6 | Calendário mensal | |
| 7 | Demais telas ganhando o tema, uma a uma | |
| 8 | **Conferir o boletim** | dado do arquiteto guardado: atraso de ~4h30 em 11/08. Entrega OK (3/3 `delivered`); **o errado é a hora — investigar o agendador, não o Resend** |
| 9 | **Saída da proposta** — **9a Excel**, depois **9b PDF por biblioteca** | decidido opção (c). A impressão atual continua até o substituto passar nas suítes |
| 10 | Puxador de itens por ID da compra PNCP | |
| 11 | Desconto em lote com trava PMVG | |
| 12 | Gerador de declarações (textos do zero, Lei 14.133) | |
| 13 | Gestor de documentos + ZIP | |

---

## 2b · O QUE FOI DECIDIDO E AINDA NÃO FOI CONSTRUÍDO — 12/08/2026

> Escrito aqui porque **decisão que só existe numa conversa não sobrevive à conversa**.
> Quem retomar começa por este bloco, na ordem.

### 4c. ALARME DE COLETA — decidido pelo Lemuel: **AS DUAS**

A cicatriz: a *Coleta PNCP* falhou **12 vezes seguidas entre 07 e 10/08** e voltou sozinha ao
verde. Ninguém soube. *"Falha que se conserta sozinha some do olhar."*

| | o que vigia | o que só ela pega |
|---|---|---|
| **(A)** | 2 falhas **consecutivas** do workflow | *"rodou e falhou"* — 429, token errado, função fora |
| **(B)** | frescor de `coleta_status.ultima_ok` | *"nem rodou"* — apagão, agendador desligado, projeto pausado |

**Aviso por sino + e-mail pro dono.**

> ⚠️ **A TRAVA DE COMPLIANCE VALE AQUI TAMBÉM, e é fácil esquecer:** o e-mail sai por
> `enviar-boletim`, que **recusa a rodada inteira** se o remetente estiver em domínio da
> GlobalMed. Enquanto `fpmed.com.br` não estiver verificado no Resend, **destinatário = só o
> dono**. Alarme não é motivo pra furar a regra do remetente.

> **E o alarme não pode virar o barulho que ele existe pra evitar:** o próprio
> `coleta-pncp.yml` já decidiu, por escrito, NÃO pintar o job de vermelho quando o PNCP cai —
> *"um X vermelho diário treina qualquer um a ignorar o CI"*. O alarme novo tem que respeitar
> isso: **fonte fora ≠ nós quebrados**. O (A) conta falha NOSSA (HTTP ≠ 200), não coleta parcial.

### Fila de fundação, na ordem (constrói direto — é técnico)

1. Manuais de arquitetura → `docs/arquitetura_referencia.md`, marcando **item a item** o que a
   FPMED já tem vs. evolução futura
2. Busca exata entre aspas no Encontrar (*phrase match*) + auditar se a busca usa
   `tsvector`+`unaccent` com índice — **medir o ganho e relatar antes de migrar**
3. Consolidar a navegação **no Negócios** (a barra do portal ainda existe lá; o Encontrar já saiu)
4. Diagnóstico do PNCP: cota/429, `TAM_PAGINA`, rodízio de UF, buracos de dia — **medido no banco**

### PARA e relata — risco ou dinheiro, o Lemuel decide

- **pgvector** para o leitor de edital — relatar ganho **medido** contra o chunking atual
- **Gateway de pagamento** (Asaas/Iugu/Stripe) + webhook — só a planta, só quando ele decidir cobrar
- **Cobertura de fontes novas** (AGM, Portal de Compras Públicas, BLL, Licitanet…) — tabela
  cobertura × custo em GO; ele escolhe quais conectar
- **Envio direto ao portal** — só caminho **oficial**. Se o único caminho for **guardar senha de
  portal**, **não construir** e trazer pra ele decidir

### Segurança — declarados, sem urgência (o eval já está desligado)

- Subir o **PDF.js para 4.2.67+**, com prova de que a extração de texto não regrediu (a 4.x é
  ESM e mudou a API de worker — mexe em 4 telas)
- Destino do **`xlsx`**: o conserto **não existe no npm**; a SheetJS publica só no CDN próprio
| 14 | Etapas renomeáveis por config (chaves do banco intactas) | |
| 15 | Tarefas com prioridade nos cards | |
| 16 | Radar por raio (lat/long do IBGE) | |
| 17 | Link público por CNPJ | read-only, código não-adivinhável |
| 18 | **Chat do edital** | regra completa: aviso 1× ao abrir, contador discreto, **teto de 20/edital** em `cobranca_config`, margem igual à das leituras, `registra_uso_ia` tarefa `'chat'`, **check constraint ANTES do código** |

**Fora da fila, esperando o dono:** fechamento de agosto negativo (−R$ 179,16);
duas leituras de **teste minhas** ainda na fatura (ids 3 e 26); a taxa de
casamento CMED de 6/14; Google Agenda (é contrato e OAuth, não código);
sync da Global (5 blocos); a policy RESTRICTIVE do `ddl/05`.

---

## 3 · AS CONVENÇÕES QUE EU SIGO

**Onde moram as leis** — `docs/constituicao.md` (a ordem do dono e o triângulo) ·
`docs/PADRAO_EXCELENCIA.md` (**o documento-mestre, aceito em 11/08**) ·
`manual_fundamentos.md` (F1–F9) · `manual_excelencia.md` (L, P, A) ·
`manual_design.md` (Regra Zero, D1–D14) · `jornadas.md` (as 6 jornadas com nota).

**Estado e retomada** — `CONTINUAR_AQUI.txt` é o arquivo que eu leio no início de
cada sessão e atualizo a cada entrega. **É lá que está o ponto exato de retomada.**

**Commit** — mensagem em português, primeira linha dizendo o que mudou pro usuário
(não "fix" nem "update"), corpo explicando **por que** e o que foi medido. Um commit
por item da fila, com `CONTINUAR_AQUI` atualizado no mesmo commit.

**Suíte** — `tests/testa_<assunto>.js`, roda no `tests/run_all.js`. Cabeçalho longo
explicando **de onde veio o defeito** que ela guarda. Prova manual = `tools/prova_*.js`.
**Suíte nova passa por teste de mutação antes de eu confiar nela** — a de hoje achou
3 asserts frouxos meus.

**DDL** — `ddl/*.sql`, sempre **aditivo** e **rodável 2×**. Valor histórico sai por
**trigger**, pra tela não conseguir errar. **Nunca DELETE/DROP/TRUNCATE/UPDATE de
dado sem OK expresso do dono.**

**Publicação** — a `VERSAO` do service worker (`sw.js`) sobe **no mesmo commit** que
muda tela; senão o PWA serve a tela velha e o cliente lê isso como "não funcionou".
Hoje: `limedtec-fpmed-2026-08-11-24`.

---

## 4 · NÚMEROS-REFERÊNCIA — pra detectar desvio

| medida | valor em 11/08 |
|---|---|
| suítes / asserts | **85 suítes · 3.10x asserts · 0 falhas** (o número exato sai no relatório de cada entrega) |
| `negocios` | **2.558** |
| `licitacoes_acompanhadas` | 2.555 |
| `cotacoes` | 8.832 |
| `cmed_precos` / `cmed_teto` | 25.702 / 4.875 |
| `usos_ia` | 8 registros |
| service worker | `limedtec-fpmed-2026-08-11-24` |
| edge functions | coletar v10 · boletim **v12** · ler-edital v5 · ler-pedido v8 |
| contraste do botão principal | **5,04:1** (era 3,71:1 — reprovava em AA) |
| casamento CMED na última medição | **6 de 14** itens |
| fechamento de agosto até 11/08 | **−R$ 179,16** |

### Duas armadilhas de medição que vão nos separar se não estiverem escritas

1. **O PostgREST devolve no máximo 1.000 linhas.** `limit=3000` **não funciona** — ele
   responde 1.000 calado. Contagem certa se faz com `Prefer: count=exact` + `Range`.
   Isso já produziu KPI errado na tela (lição S1). **Se o arquiteto contar 2.558 e eu
   relatar 1.000, o defeito é meu e é esse.**
2. **`estagio` é minúsculo e sem acento** — `oportunidade`, `qualificacao`,
   `classificacao`, `disputa`, `contrato`. Filtrar por `Ganho` devolve zero, e zero
   aqui quer dizer "filtro errado", não "nenhum negócio ganho".

---

## 5 · COMPLIANCE — os dois pontos que não se negociam

**Regra master:** nenhum dado comercial cruza entre GlobalMed e FPMED, **nas duas
direções**. Só código cruza, dado nunca. `C:\globalmed` fica intocado.

**Remetente de e-mail** *(auditado por ele em 11/08)*: o único domínio verificado no
Resend é `globalmedgo.com.br`, e ele é **proibido** como remetente de e-mail FPMED.
Estado medido: **`BOLETIM_REMETENTE` não está configurado**, o remetente cai no
`onboarding@resend.dev`, **não há violação hoje**. O perigo é o de amanhã — o Resend
só entrega pra fora com domínio verificado, então a solução que funciona de primeira
é exatamente a proibida. Virou **trava no código**: `enviar-boletim` v12 recusa a
rodada inteira. **Provado ao vivo em 11/08, autorizado pelo dono: trava segurou,
zero e-mail enviado, secret removido.**

**Referência de terceiro** (Licitante Prime, protótipo, GIFs): serve pra aprender
**layout e comportamento**. Nenhum código, asset, ícone, texto ou endpoint deles.

---

## 6 · O QUE EU PRECISO DAS CAIXAS

**O formato que funciona melhor pra mim** — e a razão de cada campo:

```
TÍTULO curto (URGÊNCIA / PEDIDO / DECISÃO / DADO MEDIDO)

O QUE O CLIENTE VÊ HOJE E O QUE ELE DEVERIA VER
  A frase que me diz se eu acertei o alvo. Sem ela eu construo o que
  entendi, e o que eu entendi pode não ser o que ele quis.

O QUE NÃO PODE REGREDIR
  O que já funciona e tem que continuar funcionando igual. É a diferença
  entre reforma e recomeço.

A DECISÃO DE NEGÓCIO, SE HOUVER
  Preço, teto, margem, quem vê o quê. Eu não invento essas — se faltar,
  eu paro e devolvo a pergunta.

COMO SABEREMOS QUE FICOU CERTO
  A medida. Se você me der a medida, eu provo; se não der, eu invento uma
  e a gente pode estar medindo coisas diferentes.
```

**O que costuma chegar ambíguo — os quatro de verdade:**

1. **Pedido que descreve algo que já existe.** Aconteceu com "PDF timbrado da
   proposta": já existia, o que faltava era o Excel. **Custa uma rodada inteira** —
   eu conferi no código e devolvi a pergunta em vez de construir de novo.
   *Se a caixa citar o nome do arquivo ou da função, isso some.*
2. **Pedido cortado no meio.** Aconteceu duas vezes em 11/08 (o chat do edital e o
   manual de design pararam na metade da frase). **Eu não completo a parte que
   faltou** — registro o item e devolvo o pedaço que falta. Se chegar cortado, o
   melhor é reenviar a caixa inteira, não a continuação solta.
3. **"Melhorar", "organizar", "deixar profissional" sem o alvo.** Hoje isso está
   resolvido — o alvo é o protótipo. Antes disso, virava chute meu.
4. **Número sem a fonte.** "342 no índice" me faz medir 342 de onde? Índice do banco,
   resultado da tela, ou retorno do PNCP? **São três números diferentes** — e a
   diferença entre eles já foi defeito de verdade aqui (lição S2).

**O que eu garanto do meu lado:** todo número do meu relatório vem com de onde saiu;
item do ritual que eu não cumpri aparece em branco **com o motivo**; e erro meu
aparece com o mesmo destaque do acerto — é assim que as 16 lições de sangue foram
escritas.
