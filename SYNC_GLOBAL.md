# 🔄 SYNC GlobalMed → FPMED (código + dados)

> Comando do Lemuel: **"sincroniza as melhorias da Global"** → rodar o fluxo abaixo.
> C:\globalmed é **SÓ LEITURA** (regra master). Nunca portar às cegas: preview → OK → porta → testa → commit.

ultimo_sync: e7501e0

(`ultimo_sync` = último commit da GlobalMed já considerado. `490e856` = estado da Global
no momento do clone da FPMED, 21/07/2026 20:29 — 4 min antes do 1º commit da FPMED.)

> ⚠️ **`ultimo_sync` NÃO foi avançado em 04/08, de propósito.** O porte do motor (abaixo) pegou
> o MOTOR do head `49f0189`, mas **não** os Blocos 2, 3 e 4 da curadoria. Marcar `49f0189` faria
> esses blocos sumirem do preview do `sync_da_global.js` — eles seriam dados como "já
> considerados" sem nunca terem sido portados. O marcador só avança quando o bloco inteiro entrar.

## Fluxo de SYNC DE CÓDIGO
1. `node tools/sync_da_global.js` → relatório dos commits pendentes da Global, mapeados
   pros arquivos da FPMED, com aviso de divergência local.
2. Mostrar a lista de melhorias pro Lemuel → ele escolhe o que entra.
3. Portar cada melhoria REAPLICANDO O REBRAND (checklist abaixo) — via `git -C C:\globalmed show <hash> -- <arquivo>` (diff) aplicado no equivalente fpmed_*.
4. Testar na FPMED (abrir a tela no ar, console limpo, fluxo funciona).
5. Commit na FPMED + `node tools/sync_da_global.js --marcar <hash-da-global>` + commitar este arquivo.

## Checklist de REBRAND ao portar (obrigatório)
- [ ] Nome: GlobalMed/GLOBALMED/Global → FPMED (só TEXTO VISÍVEL; valores de dado 'GLOBAL'/tipo='global'/código '1' ficam)
- [ ] Supabase: URL/anon SEMPRE os da FPMED (xzdowrksuswekwffoluk) — NUNCA aceitar vikewlbhkrikcalzsbeb num porte
- [ ] Cores: tema claro FPMED (--azul #2CA9E0, --navy #173A5E, --verde #8DC63F) no lugar do verde GlobalMed (#00c27a)
- [ ] Telefone: (62) 3290-4241 fixo · WhatsApp comercial (62) 98147-9532 (nunca 99612-7968)
- [ ] Permissões: FPMED usa gates por ROLE (admin) — nunca portar e-mails hardcoded (isadora...)
- [ ] Arquivos: nomes fpmed_* (mapa no tools/sync_da_global.js)
- [ ] Dados jurídicos: razão social/CNPJ/IE/endereço da FPMED
- [ ] Modelo IA: FPMED usa claude-haiku-4-5 no ler-pedido (decisão de custo 22/07)

## ⚠️ LIMITAÇÃO HONESTA — arquivos que exigem PORTE MANUAL
Divergiram muito entre os projetos; diff automático NÃO aplica limpo — portar a ideia, não o patch:
- **fpmed_sistema_final.html**: FPMED removeu 4 páginas do menu (Comissões Isa, Vendas Externas,
  Cotação p/ Cliente, Oportunidades antiga), trocou Global→FPMED nos textos, adicionou upload de
  PDF próprio no estoque e seção "Sistemas" no menu. A Global escondeu páginas com display:none;
  a FPMED APAGOU o código — o mesmo diff não encaixa.
- **gm-auth.js**: constantes (URL/anon/redirects) são da FPMED; portar só lógica.
- **index.html**: entradas diferentes de propósito (Global = portal de cards; FPMED = direto no sistema).
- **dashboard_clientes.html**: FPMED usa dados fictícios — nunca sobrescrever com a lista da Global.
O `tools/sync_da_global.js` marca esses como [PORTE MANUAL] e avisa (⚠️ N commits locais) qualquer
outro arquivo que acumular divergência local.

## ⚠️ DECISÕES DE NEGÓCIO (decididas pelo Lemuel no 1º sync, 22/07/2026)
- **MKP 32%** (Global 3236d65): ✅ PORTADO — markup de fornecedor ×1,32 em giovana/vendas/sistema.
  EXCEÇÃO mantida: custo-ref do estoque GLOBAL segue **venda ÷ 1,25** (não muda com o MKP).
- **Portal de entrada** (5ff0dbf/fa973c6/71595b7): ❌ FORA em definitivo — FPMED entra direto no sistema.
- **Importador PDF CLI** (tools/importa_estoque_pdf.js + testa_pdf_estoque.js): ❌ FORA — FPMED
  tem upload de PDF direto no browser (Atualizar Estoque).

## ✅ Competitividade + Comparativo (Global 005cb75/7cc5b87/e7501e0) — PORTADO 24/07
Feito via git apply --reject (contexto casou, só 3 hunks de TEMA rejeitaram e foram reaplicados
no claro). Entrou: giro/impacto R$/mês (coluna+KPI, inerte enquanto compra_itens vazio → "sem
giro"), botão "fila de cotação", indústria destaque, curadoria VENVANSE 30/70+DIAD, regra
CONFIRMADO vence mistura; Comparativo com heatmap, scorecard win-rate, Δ vs melhor, drill-down;
rolagem 70vh + cabeçalho sticky + coluna fixa + barra espelho (scrollbar adaptada ao claro).
Drill-down blindado (FPMED não captura histórico ainda → degrada p/ "sem histórico"; tabela
historico_precos não existe, tudo tolerante a falha). Testado no ar: Comparativo 100 linhas c/
features, Competitividade renderiza vazia (0 estoque próprio GLOBAL — matéria-prima da tela),
console limpo. Commit 7af9021.

## 📋 CURADORIA DO 2º SYNC DE CÓDIGO (04/08/2026) — 169 commits, AGUARDANDO OK
> Preview: `node tools/sync_da_global.js` · base `e7501e0` → head `5547d61` (22/07 a 03/08).
> **Nada foi portado.** Esta é a lista do passo 2 do fluxo — o Lemuel escolhe os blocos.
> Divergência acumulada hoje: giovana **+2.007** linhas na Global · sistema_final **+3.580** ·
> viabilidade +100 · vendas +34 · painel +25. A Global também criou `motor_busca.js` (não existe aqui).

## ✅ BLOCO 1 (parte MOTOR) — PORTADO 04/08. Suíte da FPMED: 110 → **339 asserts**.

**A Opção B abaixo estava errada na conta, e o porte foi feito de outro jeito.** Medi antes:
a `giovana` da Global é **tema ESCURO**, com 146+ cores escuras cravadas no CSS (`#0d1b2a` 16×,
`#1e3048` 30×, `#29b8ff` 40×) contra 89 cores no arquivo inteiro da FPMED. Adotá-la inteira
escureceria a tela de Propostas — exatamente o que o **Bloco 5 proíbe**. Os "49 marcadores"
contavam os valores FPMED presentes no arquivo da FPMED, não as cores escuras presentes no
arquivo da Global; são coisas diferentes.

**O que foi feito:** portadas só as **duas fatias do motor** — as mesmas que o
`gera_motor_busca.js` da Global extrai. Medido: essas 1.456 linhas têm **ZERO** cor hex, ZERO
"GlobalMed", ZERO URL do Supabase deles, ZERO e-mail hardcoded, ZERO telefone e ZERO nome de
modelo de IA. É lógica pura — o risco de rebrand é nulo **por construção**, não por revisão.
- `tools/porta_motor_da_global.js` — faz o porte, confere rebrand nos dois sentidos (nada da
  Global entrou / nada da FPMED sumiu) e **se recusa a aplicar** se algo estiver errado.
- `tools/confere_previa_motor.js` — valida a prévia ANTES de gravar: sintaxe dos blocos, as
  fatias carregando com ambiente mínimo, e 10 verificações funcionais das melhorias portadas.
- `tools/confere_refs.js` — todo símbolo usado no boot existe. Nasceu de um susto real: as
  chamadas de `_fpOpcional` entraram antes da função, e o boot teria estourado na 1ª abertura
  sem nenhum teste acusar (as suítes fatiam o motor, não passam pelo boot).
- **Preservado**: o fallback `venda_unit_forn` no `pv()` (view `cotacoes_vendedor` — vendedor não
  recebe custo). É a ÚNICA lógica própria da FPMED no motor; o resto da fatia dela era só a
  versão antiga da Global. O porte reinjeta esse trecho a cada sync.
- **Suítes portadas** (8, via `tools/porta_suites_da_global.js`, que só grava as que passam):
  bug5_concentracao, mono_x_combo, num_discriminador, tripla_onco, pedido_sem_dose,
  caixa_sem_pack, dose_total, indice. Ficaram de fora as que testam a CASCA da Global
  (cabeçalho, abas, gerarPDF) e as que dependem de `_parseLinhaQtd`/`_addLinhaAoOrcamento`, que
  vivem numa 3ª região do arquivo e **não** foram portados.
- Testado: 339/339 verde, tela abre com título FPMED, console limpo, `:root` claro intacto,
  0 cores escuras da Global, 0 "GlobalMed", 0 URL do Supabase deles.

**O que do Bloco 1 NÃO veio** (fica pra próxima rodada, é camada de tela, não motor):
o portão de qualidade, o canal de alternativa com aviso (botões [Aceitar]/[Recusar]), o rótulo de
progresso da carga + retry no cabeçalho, a caixa OBS DO PEDIDO e o painel de conferência.
E o **de-para marca↔PA**: a função `carregarDicMarcaPa` veio e já está ligada no boot, mas a
tabela `dicionario_marca_pa` **não existe no banco da FPMED** e não há token `sbp_` no
`segredos.local.txt` daqui pra criar. Hoje ela falha em silêncio e a busca segue sem o de-para;
no dia em que a tabela for criada, passa a funcionar sozinha.

### 🟢 BLOCO 1 — Motor de busca / tela Propostas (~55 commits) — **RECOMENDO ENTRAR**
É a tela que a equipe inteira usa, e o bloco tem **bug de faturamento**, não só melhoria:
- **5 bugs de preço/quantidade**: unidade→caixa invertida (1.000 comprimidos viravam 1.000 CAIXAS,
  total inflado pelo pack); preço de CAIXA gravado como unitário (574 linhas, a pior 1.144×);
  calibre virava quantidade (`N 23` → qtd 23); dose em UI virava nº de ampolas; vírgula decimal
  sumia da chave de dose (593 linhas — 0,5MG virava 5MG).
- **IA Ler Pedido**: a IA cortava o pedido em 2.000 tokens e o código não olhava o `stop_reason`
  (pedido grande chegava truncado, calado); o prompt apagava a quantidade; a aba IA não lia qtd
  nem convertia unidade→caixa e descartava item repetido em vez de somar.
- **Performance**: busca em lote travava a aba 9,6 s sem ceder a thread (agora pausa + progresso +
  cancelar); pré-cálculo levou a busca de 169 ms → 79 ms por item (15,4 s → 7,2 s em 91 itens).
- **~20 barreiras de casamento**: calibre G/Fr, cm↔metro, ml, cápsula gelatinosa, sub-forma oral,
  composto x simples, mono x combo, proporção de associação, EAN como camada 1, dose total =
  concentração × volume, água bacteriostática ≠ destilada, tubo↔sonda endotraqueal, nº discriminador.
- **PDF**: trava que bloqueava a proposta virou aviso com os nomes; painel de conferência fixo;
  rodapé de proposta parcial; badge CONFERIR MATCH só na cópia interna (documento do cliente sai
  limpo); item sem marca avisa em vez de bloquear; caixa OBS DO PEDIDO; portão de qualidade.
- **Suíte**: a Global foi de 110 → **1.286 asserts** com fixtures de pedidos reais.

**Como portar (decisão do Lemuel):**
- **Opção A** — 73 commits um a um: fiel, mas caro e com risco de conflito a cada hunk.
- **Opção B (recomendo)** — adotar a `giovana` da Global inteira e **reaplicar o rebrand**: medi,
  são só **49 marcadores** no `fpmed_giovana.html` (11 FPMED, 8 Montserrat, 8 navy, 5 Supabase,
  3 haiku, 3 telefone, 2 CNPJ, 2 logo…) + tirar e-mail hardcoded (isadora) e gates por role.
  Sai mais barato e chega no mesmo lugar. Traz junto o `motor_busca.js` + suíte.

### 🟢 BLOCO 2 — Telas de análise do sistema_final (~25 commits) — **ENTRAR SELETIVO**
- **Comparativo**: visão por família (mesmo PA+forma numa linha-mãe, dose nunca se mistura);
  média blindada contra preço fora de escala; **bug da Melhor Fonte** (indústria ganhava SEMPRE,
  recomendava a mais cara tendo distribuidor mais barato) + alerta de margem negativa.
- **Competitividade**: recarrega sempre fresca ao abrir (fora do cache de 60 s).
- **Filtro "Só Estoque GLOBAL"**: o dedupe jogava fora o saldo das outras apresentações — item
  sumia do filtro com unidade na prateleira. Agora o preço é o menor e o **saldo soma**.
- **Estoque com data** (coluna `estoque_em`, DDL aditivo) + "há N dias" na Vendas + aviso de
  espelho velho (>3 dias) + marcar esgotado no item próprio com confirmação dupla.
- **Cotações**: dropdown de fornecedor nascendo do banco (deixava 9 fornecedores de fora), filtro
  casando por nome em vez de UUID (**estava morto para 44 dos 48 valores**), `tipo` normalizado.
- **Itens a Cotar**: botão "copiar lista profissional" (blocos med/material, qtd em caixas, pede
  preço da EMBALAGEM — mata o pack ambíguo na entrada); auto-conferência da fila pelo motor;
  reaper retroativo (pendente cuja cotação já existia baixa sozinha).
- **"Vacina de cache"**: metas no-cache + selo de versão + guarda que avisa a aba velha antes de
  ela gravar errado. ⚠️ Relevante aqui: a FPMED já teve skew de cache (o `?v=cargos` do gm-auth).
- Regra permanente da Global: banco = fonte única, toda tela atualiza sozinha, defasagem ≤60 s.

### 🟡 BLOCO 3 — Subsistema CMED (~10 commits) — **DECISÃO** (recomendo entrar)
Tabela `cmed_pf` com 25.702 apresentações da ANVISA (PF por unidade, PF 19% GO, EAN, GGREM,
registro, classe, tarja, CAP/CONFAZ, PMC), loader mensal `tools/carrega_cmed_pf.js`, tela
**Catálogo por PA**, PF como régua na Competitividade e em Itens a Cotar, e a view
`cmed_marca_substancia` (de-para marca↔substância que resolve Santiplex↔Complexo B sem lista manual).
**Por que importa aqui:** é a única régua de preço que **não depende de estoque próprio** — a
Competitividade da FPMED hoje renderiza vazia por falta de estoque GLOBAL, e a CMED dá conteúdo à
tela antes disso. Custo: DDL + carga do xlsx da ANVISA (mensal).

### 🟡 BLOCO 4 — Alvos de Compra Direta / `contatos_industria` (~6 commits) — **DECISÃO DE NEGÓCIO**
Tela nova: ranking de fabricantes por valor com 3 sinais, badge de fabricante sem contato, contato
clicável, status editável, textos de abordagem. Objetivo: **comprar direto da indústria** em vez do
distribuidor. Dois pontos pro Lemuel: (1) o escopo da FPMED excluiu Prospecção — isto é prospecção
de FORNECEDOR, não de cliente, então é escopo diferente, mas a chamada é sua; (2) o **dado** não
vem junto — o ranking nasce do histórico de compra da Global; a FPMED começaria a tela vazia.

### 🔴 BLOCO 5 — **NÃO PORTAR** (recomendação firme)
- **Rebranding DARK da Global** (fases 1, 2a, 2b, F2c — sidebar navy #0A141C, dashboard, Comparativo
  e Cotações escuros): a Global foi pro **tema escuro**; a FPMED é **tema claro** por decisão de
  marca. Conflito direto — descartar, não adaptar.
- **Trabalho de dado no banco da Global**: imports SANTA CRUZ / EB / MCW, correções S3MED,
  duplicatas, cetamina, saídas SIAD, fantasmas de estoque, contatos pesquisados. É operação no banco
  deles, não código. (Os **parsers** desses fornecedores — `le_eb.js`, `le_santacruz.js`,
  `importa_santacruz.js` — só valem se a FPMED receber planilha dos mesmos fornecedores; nesse dia,
  entram junto com o sync de dados.)
- `CONTINUAR_AQUI (2).txt`, `tools/anota_continuar.js`, `globalmed_vendedora.html` — fora do pacote.
- Portal de cards — já decidido FORA em definitivo.

### ⚖️ Custo honesto
O Bloco 1 pela Opção B é 1 rodada. Blocos 2 e 3 são **porte manual bloco a bloco** no
`fpmed_sistema_final.html` (+3.580 linhas de divergência, 157 marcadores de marca, 4 páginas que a
FPMED apagou e a Global só escondeu) — conte 2 a 3 rodadas. Bloco 4 é 1 rodada. Nada disso deve
ser feito com `git apply` cego.

## Fluxo de SYNC DE DADOS (cotações de distribuidor) — SÓ com OK por rodada
1. `node tools/sync_cotacoes_global.js` → PREVIEW: N novos / N atualizados / N pulados (nada gravado).
2. Lemuel dá OK (tudo ou subconjunto) → `node tools/sync_cotacoes_global.js --gravar`.
Filtros fixos no script: exclui fornecedor='1'/tipo='global' (estoque próprio da Global); só a tabela
cotacoes (nunca clientes/prospects/compras); dedup por (fornecedor, produto) — lado Global vale a
linha mais recente; sanitização venda_loja/global_venda1/2 = NULL, datas ISO.
Segredos: lidos em runtime dos segredos.local.txt dos dois projetos — NUNCA commitados.
