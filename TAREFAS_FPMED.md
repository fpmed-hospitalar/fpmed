# 🏥 PLACAR FPMED — task list permanente do projeto

> Padrão do projeto: TODA rodada da FPMED acompanha este placar. Marca ✓ na hora que
> concluir. Commit por etapa. (clone white-label #2 · pasta C:\fpmed · git próprio, sem remote)
>
> **Escopo do pacote FPMED = sistema completo SEM Prospecção e SEM Loja Pública**
> (decisões de escopo do Lemuel).

Última atualização: 2026-08-04

## 🔐 CONTROLE DE ACESSO POR CARGO (24/07) — RLS no banco, não só no front
> Decisão do Lemuel: gate de tela não basta (F12 burla a REST). O controle real é **RLS por
> cargo lido do JWT** (`app_metadata.role` — NÃO editável pelo usuário). Arquivo: `db_rls_cargos.sql`.

**Cargos** (em `app_metadata.role`): `diretor`, `gerente`, `vendedor`, `propostas`.
Legado: `admin`=diretor, `vendedora`=vendedor, `giovana_only`=propostas.
**GESTOR** = diretor|gerente (função `cargo_gestor()` no banco).

**Matriz (tela × cargo × API):**

| Recurso | Diretor | Gerente | Vendedor | Propostas |
|---|---|---|---|---|
| Entra no back-office (sistema_final, Vendas, Viabilidade, Painel) | ✅ | ✅ | ❌ (só Propostas) | ❌ (só Propostas) |
| Tela **Propostas** (giovana) | ✅ | ✅ | ✅ | ✅ |
| Ver **custo de fornecedor / margem / quem fornece** | ✅ | ✅ | ❌ | ❌ |
| **Cotações** (tabela com custo) via API | ✅ lê base | ✅ lê base | ❌ RLS bloqueia (lê view `cotacoes_vendedor` sem custo) | idem vendedor |
| Telas de inteligência (Competitividade, Compras/Cliente, Clientes&Op, Itens a Cotar) | ✅ | ✅ | ❌ | ❌ |
| **Gravar** na base (Importar Cotação/Espelho, Atualizar Estoque, Pedido Fechado) | ✅ | ✅ | ❌ 403 | ❌ 403 |
| **Apagar** cotação / desfazer | ✅ | ✅ | ❌ | ❌ |
| **IA Ler Pedido** + Importar lista (montar proposta) | ✅ | ✅ | ✅ | ❌ |
| Salvar **orçamento** / cadastrar cliente | ✅ | ✅ | ✅ | ✅ |
| Enviar proposta **para compras** (pedido) | ✅ | ✅ | ❌ | ❌ |

Obs.: diretor e gerente têm as MESMAS permissões (decisão do Lemuel: escrita/apagar = diretor+gerente).
A distinção é organizacional; `cargo_destrutivo()`=diretor fica reservada p/ dar poderes só-diretor no futuro.

**Como criar um usuário de cada cargo** (via Admin API, com `service_role` do segredos.local.txt; o
Claude NÃO digita senha — o usuário troca no 1º login). O papel VAI EM `app_metadata`, nunca em user_metadata:
```
# criar:  POST {SB}/auth/v1/admin/users
{ "email":"fulano@fpmed.com.br", "password":"<temporaria>", "email_confirm":true,
  "app_metadata": { "role":"gerente" } }        # role = diretor|gerente|vendedor|propostas
# mudar cargo de quem já existe:  PUT {SB}/auth/v1/admin/users/{id}
{ "app_metadata": { "role":"vendedor" } }
```
⚠️ Corpo JSON via ARQUIVO (`--data-binary @arq.json`): o PowerShell come as aspas em `-d '...'`.
⚠️ Depois de mudar o cargo, o usuário precisa **sair e entrar** (ou o token renova sozinho em ≤1h)
   pro JWT novo carregar o `app_metadata`. Sessão com token velho cai no default `vendedor`.

**Teste de burla executado (24/07, JWT real de vendedor via API direta):**
1. ler custo na tabela base → `[]` (RLS bloqueia) ✅
2. ler coluna `compra_unit` na view → 400 "column does not exist" ✅
3. ler `venda_unit_forn` na view → OK (preço de venda, sem custo) ✅
4. ler `compras` / `fornecedores` → `[]` ✅
5. INSERT em cotacoes → **403 "violates row-level security policy"** ✅
6. contraprova gestor (gerente): lê custo/fornecedor e faz INSERT → OK ✅
Validado também no browser real: vendedor entra só em Propostas (7.416 produtos, preço sem custo),
é barrado do sistema_final ("sem permissão"); diretor vê o menu completo.

**⚠️ LIMITAÇÃO HONESTA (markup fixo):** como o markup é 32% conhecido, o preço de venda de item de
distribuidor permite deduzir o custo (venda ÷ 1,32). O que fica realmente protegido é a IDENTIDADE do
fornecedor, o número de custo rotulado, o histórico de compras e a ESCRITA. Custo 100% opaco exigiria
markup variável/oculto (mudança de regra de negócio) — avisar o Lemuel se ele quiser isso.

## 🧪 REGRA PERMANENTE DE TESTE (22/07)
Todo teste de tela que GRAVA no banco: usar a prévia SEM clicar em gravar, OU apagar os
dados de teste imediatamente depois (e provar a limpeza com contagem antes/depois).
Auditoria de 22/07: banco confirmado limpo após teste do upload de PDF (preview-only).

## ✅ CONCLUÍDAS
- [x] Pasta base `C:\fpmed` + cópia limpa (sem segredos, sem Prospecção `vendedora.html`)
- [x] Git próprio inicializado (commit `bfe2f0d`)
- [x] Hook "modo total" anti-destrutivo testado (commit `9267c76`)
- [x] Logo oficial baixado do site → `logo_fpmed.png` + `fpmed_template.html` na pasta
- [x] Remoção da Prospecção embutida no `sistema_final` (1294 linhas · commit `6ec8180`)
- [x] Renomeação `globalmed_*` → `fpmed_*` + refs internas (commit `7ac2cda`)
- [x] Varredura de marca GlobalMed→FPMED (61 trocas / 17 protegidas · commit `af6f347`)
- [x] Exceção `!logo_fpmed.png` no `.gitignore`
- [x] **Rebrand visual completo** (tema claro do template, logo real, cores
      #2CA9E0/#173A5E/#8DC63F, Montserrat+Inter, faixa (62) 3290-4241 + slogan) — 10 arquivos
- [x] **Loja pública removida** do pacote (arquivo + agente descartado; nenhum outro arquivo referenciava)
- [x] **Placeholders jurídicos** aplicados: `[RAZÃO SOCIAL FPMED]`/`[CNPJ]`/`[ENDEREÇO]` no lugar
      do CNPJ/endereço/razão social da GlobalMed (giovana 7 + sistema_final 28 substituições)
- [x] **Supabase FPMED criado** (org nova FREE `FPMED Hospitalar`, projeto `fpmed`, região São
      Paulo, ref `xzdowrksuswekwffoluk`). URL+anon+service_role+DB pw no `segredos.local.txt`.

- [x] **ORG `fpmed-hospitalar` + repo `fpmed`** criados no GitHub (Free, repo PRIVADO por ora).
      Remote local `origin` → `https://github.com/fpmed-hospitalar/fpmed.git` (sem push ainda).

- [x] **URL + ANON trocados** em todos os arquivos → Supabase da FPMED (12 anon + 16 URL, 0 resquício
      do banco antigo, sintaxe JS validada). URL `https://xzdowrksuswekwffoluk.supabase.co`.

## 📋 FILA ATUAL (ordem definida pelo Lemuel em 04/08/2026, fim do dia)
> Regra: pedido novo entra no FIM da fila. Só "URGÊNCIA" fura. Ver `CONTINUAR_AQUI.txt`.

1. ⬜ **LICITAÇÕES V1** — prioridade 1. Spec pronta em `LICITACOES_SPEC.md`.
   Começar pelo protótipo busca+lista com dia real do PNCP e **mostrar screenshot ANTES**
   de construir o cruzamento. ⚠️ A API do PNCP estava **fora do ar** em 04/08 (504/503) —
   se ainda estiver, o módulo tem que degradar com cache + aviso, nunca tela branca.
2. ✅ ~~Investigação do "Carregando…"~~ — **JÁ FEITO** (commit `aa6177d`): eram 2 cargas
   concorrentes de `cotacoes` (18 requests p/ 9 páginas) + `recarregarCotacoes` que não
   re-renderizava. Promise em voo compartilhada + erro visível + timeout de 25s.
   Sobrou 1 ponto: `autoRefreshEstoque` manda `force=true` e ignora o cache de 60s — cortar
   isso elimina as 9 requests extras, mas é decisão de negócio (a Competitividade quer fresco).
3. ⬜ **Comparativo SIMPLIFICADO** — spec do Lemuel (04/08):
   - **A tela vira só comparativo de preço**: `PRODUTO/PA | NOSSO (estoque FPMED) | preço de
     cada FORNECEDOR | menor preço em verde`. Recolher para uma expansão opcional
     **"ver análise"**: "Seu preço sugerido", "Melhor fonte", "Δ vs melhor", "Vale comprar"
     e o scorecard. (Não apagar — o bug da Melhor Fonte acabou de ser corrigido em `091ece8`
     e a lógica continua valendo dentro da expansão.)
   - **TUDO SEMPRE UNITÁRIO**, nunca preço de caixa em célula nenhuma. Badge discreto do pack
     quando dividir: `un · cx100`. Valor com cara de caixa **sem pack identificável** →
     `⚠ conferir emb.` no lugar do número cru.
   - **Destaque do estoque**: célula do estoque FPMED com fundo azul-claro forte quando há
     saldo, + selos "Em estoque"/"PROMO" no nome.
     ✅ **JÁ EXISTE NA FPMED, nada a portar** — conferido 04/08: os selos PROMO e "Em estoque"
     são idênticos aos da Global (FPMED L1733/1734 e L2645 × Global L3612/3613 e L4885).
     **Falta só o fundo azul-claro da célula**, que é coisa nova, não porte.
   - Manter busca, filtro "Só Estoque FPMED" e seleção/exportação.
   - **Teste obrigatório**: CEFALOTINA 475,25 → **4,75 un · cx100**. Screenshot antes/depois.
4. ⬜ **Blocos 2 e 4** do sync de código. Bloco 2 peça 1/N já entrou (`091ece8`, bug da Melhor
   Fonte). Faltam: filtro "Só Estoque GLOBAL", `estoque_em` (tem DDL), dropdown/filtro de
   fornecedor em Cotações, Comparativo por família, Itens a Cotar, vacina de cache.
5. ⬜ **Estoque 0 → 1 no FLUXO** — a regra já vale no dado (781 linhas no seed); falta gravar
   na tela Atualizar Estoque + `tools/le_estoque_fpmed.js` + teste.
6. ⬜ **Pack via CMED/web** — resolver o pack dos itens sem contagem no nome casando com a
   apresentação oficial da `cmed_pf` (camada 1) e busca web (camada 2). Tabela
   `pack_confirmado` (produto → pack, fonte, data). **Não alterar preço no banco** — a tela
   usa o pack e divide só na exibição. Preview antes de ativar.
7. ⬜ **PDF de proposta** — portar da Global: caixa "⚠ OBSERVAÇÕES" (IA + estoque rotativo)
   antes do "Prazo para entrega a combinar", conferir rodapés e a nota "* Preço Unit".
   **Bug conhecido**: a coluna PREÇO UNIT sai crua (`0.2556`) em vez de `R$ 0,26` — formatar
   em pt-BR como na Global. Testar com 1 item e com vários.

## ⬜ PENDENTES (na ordem)
- [x] **Sync de dados EXECUTADO (04/08, com OK do Lemuel)**: **13.406 novos + 149 atualizados +
      7.267 pulados**. Backup completo antes (`backups/backup_2026-08-04_1528`). Filtros master
      íntegros: **0 linhas GLOBAL no lote**, só a tabela `cotacoes`, zero cliente/prospect.
      Banco: 8.832 → **22.238 cotações** (1.381 estoque próprio + 20.857 distribuidor, 50
      fornecedores). Auditoria pós-sync: `tipo='global'` indevido em linha de distribuidor = **0**.
      Suíte 371 verde. Novos por fornecedor: SANTA CRUZ 8.743 · MCW 2.501 · EB 1.885 · SUPERMEDICA
      161 · resto ~116.
- [ ] ⏸ **Sync de CÓDIGO — 169 commits pendentes da Global** (base `e7501e0` → head `5547d61`,
      22/07→03/08). Preview + **curadoria em 5 blocos FEITA 04/08** (`SYNC_GLOBAL.md`), esperando
      o Lemuel escolher os blocos. Resumo: 🟢1 motor/Propostas (~55 commits, tem bug de faturamento)
      · 🟢2 telas de análise (~25) · 🟡3 CMED (~10, decisão) · 🟡4 Alvos de Compra Direta (~6,
      decisão de negócio) · 🔴5 não portar (rebrand DARK da Global + dado do banco deles).
      Divergência medida: giovana +2.007 linhas, sistema_final +3.580.
- [x] **Porte manual da Competitividade + Comparativo** (24/07, commit `7af9021`): upgrades da
      Global (005cb75/7cc5b87/e7501e0) portados com tema claro reaplicado — giro/impacto R$/mês,
      botão "fila de cotação", curadoria+regra revisar; Comparativo com heatmap/scorecard win-rate/
      Δ vs melhor/drill-down; rolagem 70vh + sticky + barra espelho. Drill-down blindado (histórico
      não capturado ainda → "sem histórico"). Testado no ar (console limpo). Competitividade fica
      VAZIA até carregarem o estoque próprio FPMED (é a base da tela).
- [ ] **Vendedoras** (`role: vendedora`/`giovana_only`): criar quando o Lemuel definir a equipe.
- [ ] **Domínio próprio** `sistema.fpmed.com.br` (CNAME no Pages) — pós-venda.
- [x] **Clientes & Oportunidades — bug + tema** (22/07): forEach corrigido na raiz (cdArr()
      valida Array.isArray + erro amigável + estado vazio), tema claro aplicado. Console limpo.
- [x] **1º SYNC de código da Global** (22/07, commits `3473800`+`8381ca9`): 11 commits na giovana
      (score de confiança FASE 3 com "Confirmar match", datas UTC, fuzzy, qtd/PA), FORMA na vendas,
      `_cmpQuando` no sistema_final, **MKP 32%** (exceção: custo-ref GLOBAL segue ÷1,25),
      suíte tests/ portada (6 suítes, 110 asserts verdes). Marcador `ultimo_sync: e7501e0`.
      Fora em definitivo: portal de cards (entrada direta) e importador PDF CLI (upload no browser).
- [x] **Varredura de marca** (22/07, commit `3fb4782`): favicon FPMED (cruz SVG data-URI) nas
      10 páginas; coração da Global substituído pela cruz oficial na Competitividade (tela + PDF);
      zero referência ao Supabase/GitHub da GlobalMed em *.html/*.js.
- [x] **Atualizar Estoque FPMED — segurança** (22/07): modal "digite ATUALIZAR", backup
      automático + desfazer (5 snapshots, tabela `estoque_backup`), trava de relatório parcial
      (<30%), upload de PDF direto (pdf.js local + fallback IA). Testado ponta a ponta, banco limpo.
- [x] **Menu limpo** (22/07): sem Comissões Isa / Vendas Externas / Cotação p/ Cliente /
      Oportunidades antiga; "Giovana"→"Propostas"; Global→FPMED em todo texto visível.
- [x] **dashboard_clientes**: demo 100% fictício + HISTÓRICO DO GIT REESCRITO (filter-branch +
      force push, 22/07) — clone limpo verificado, zero CNPJ real em qualquer commit.
- [x] **SEED de cotações** (22/07, autorizado): 7.451 cotações de distribuidor do GlobalMed →
      `cotacoes` FPMED. Zero GLOBAL (517 excluídas), zero cliente/prospect, `venda_loja` zerada,
      45 fornecedores, `fornecedor_nome` backfilled + normalização no app. Dashboard/Competitividade
      populados.
- [x] **Edge function `ler-pedido` — ✅ 100% NO AR** (22/07): deployada (Verify JWT OFF), trava de
      origem ativa (só `fpmed-hospitalar.github.io` / `sistema.fpmed.com.br`; resto 403 sem gastar
      crédito), secret `ANTHROPIC_API_KEY` colado pelo Lemuel, **teste ponta a ponta OK** (Claude
      respondeu). v4 (22/07, decisão de custo): modelo padrão e chamadas dos HTML em
      `claude-haiku-4-5` (fallback `claude-haiku-4-5-20251001`) — o sonnet-4 antigo foi
      APOSENTADO 15/06/26. ⚠️ curl de teste precisa de header Origin; `file://` não funciona (usar Pages).
- [x] **Usuários de login criados** (22/07, via Admin API): `lemuelempresas7@outlook.com` e
      `comercial@fpmed.com.br`, ambos `role: admin`, e-mail confirmado, senha inicial definida
      pelo Lemuel (NÃO gravada no repo) com `user_metadata.senha_temporaria: true` (marcador —
      o Supabase não tem flag nativa de troca obrigatória; trocar no 1º login via "trocar senha"
      do app). Login por senha testado OK (token emitido, role admin). Vendedoras: criar depois,
      quando o Lemuel definir a equipe.
- [x] **Tabelas criadas** no banco novo (12 tabelas/views, `db_schema.sql`). Todas retornam HTTP 200
      via REST com a anon key.
- [x] **RLS LIGADA + testada** (`db_rls.sql`): RLS on + policy `authenticated` em todas as tabelas,
      views com `security_invoker`. Testado: anon INSERT→401 e SELECT→`[]` (bloqueada); `authenticated`
      insere/lê (policy ok). Pré-condição de deploy #6 ✅ SATISFEITA.
- [x] **Deploy (#11) — ✅ SISTEMA NO AR** (22/07/2026): repo PÚBLICO, GitHub Pages ativo em
      `https://fpmed-hospitalar.github.io/fpmed/`. Supabase Auth configurado: Site URL =
      URL do Pages; Redirect URL do `reset-senha.html` adicionada. **Smoke test OK**: 10 páginas
      HTTP 200, gm-auth apontando pro banco FPMED (zero banco antigo), razão social real servida,
      zero placeholder/GlobalMed no ar, login renderizando, zero erro de console, splash→painel
      redirecionando. Pendente pós-venda: domínio `sistema.fpmed.com.br` (CNAME).

- [x] **Backup próprio da FPMED** (04/08): `.claude/hooks/backup_tabelas.js` criado (era a pendência
      aberta desde 21/07 — "criar o próprio quando o Supabase existir"). Só GET, service_role lida
      do `segredos.local.txt`, pagina em **1000** (limite do PostgREST da FPMED), grava JSON em
      `backups/` (gitignored). 11 tabelas cobertas. Testado: cotacoes 7.451 + 10 tabelas vazias,
      zero erro. `ABRIR_CLAUDE_TOTAL.bat` passa a rodar o backup sozinho antes de cada rodada total.

## ✅ DESBLOQUEADA (22/07/2026)
- [x] **Dados de registro da FPMED aplicados**: FPMED DISTRIBUIDORA DE PRODUTOS HOSPITALARES
      LTDA · CNPJ 47.110.418/0001-15 · IE 10.947.387-9 · RUA 09, S/N, QUADRA 55 A, LOTE 0002,
      VILA BRASILIA, APARECIDA DE GOIANIA/GO, CEP 74.911-080 · WhatsApp comercial
      (62) 98147-9532 · fixo (62) 3290-4241 · comercial@fpmed.com.br. Placeholders trocados
      (giovana 3 blocos + sistema_final 11 pontos), URLs do GitHub antigo trocadas
      (painel raw/zip + gm-auth recover → `fpmed-hospitalar/fpmed`). Varredura final:
      **zero placeholder `[...]` / zero dado da GlobalMed** nos *.html/*.js.

## 🔒 PRÉ-CONDIÇÕES DE DEPLOY (tarefa #11 — travar o push público até resolver)
1. ✅ FEITO (22/07): dados REAIS da FPMED no lugar; **zero placeholder / zero GlobalMed**
   confirmado por varredura (globalmed, 54.379.172, 20.131.542, conde francisco, 99612).
2. ✅ FEITO (22/07): URLs do GitHub (painel raw/zip + gm-auth recover) → `fpmed-hospitalar/fpmed`.
3. ✅ FEITO: **URL + ANON do Supabase** = instância da FPMED. Reconferido 04/08: 14 ocorrências de
   `supabase.co` nos *.html/*.js, **um único host** (`xzdowrksuswekwffoluk`) e **uma única anon key**
   (JWT decodificado: `ref=xzdowrksuswekwffoluk`, `role=anon`). Zero resquício do banco do GlobalMed.
4. ✅ FEITO (22/07): `dashboard_clientes.html` ERA dado real do GlobalMed (33 clientes/CNPJs).
   Substituído por 10 clientes 100% fictícios (CNPJs prefixo 00., inválidos; marcas fictícias).
   Varredura: zero dos 33 nomes/CNPJs reais remanescente.
5. ✅ FEITO (varredura 04/08): **zero Pix / chave / agência / banco** em qualquer *.html/*.js
   (os dados de pagamento só existiam na loja, removida) e **zero** ocorrência de
   `99612`/`globalmed`/`vikewlbhkrikcalzsbeb`/CNPJ-endereço da Global. Único WhatsApp no sistema
   é o comercial da FPMED `(62) 98147-9532`.
6. **Segurança do banco (RLS)** — ✅ FEITO: RLS ligada em todas as tabelas + policy `authenticated`,
   views com `security_invoker` (`db_rls.sql`). Testado: anon bloqueada (INSERT 401 / SELECT vazio),
   `authenticated` funciona. Como o repo vai público com a anon dentro, isso era essencial.

## 📦 ESTOQUE PRÓPRIO FPMED IMPORTADO (04/08/2026) — 1.381 linhas, com 2 pendências
Origem: `Pasta1.xlsx` (CODIGO, NOME_PRODUTO, UNIDADE, MARCA, ESTOQUE, PRECO_MINIMO1).
Gravado como `fornecedor='1'` / `tipo='global'` / `global_venda1=PRECO_MINIMO1`. Total do banco
7.451 → **8.832**. Regra do Lemuel aplicada: **estoque 0 → 1** (750 zeradas + 31 que já eram 1 = 781).

**Auditoria do que ficou gravado:**
- ✅ 1.381 linhas, 0 sem preço, 0 sem marca, 0 com custo (é venda, correto).
- ✅ 474 linhas "duplicadas" **vêm da própria planilha** (469 chaves código+produto repetidas) — não
  foi insert duplo. Decidir se deduplica (a Competitividade soma saldo de linhas irmãs).
- ⚠️ `und` NULL em 1.381/1.381. **Medido: não muda o pack em nenhuma linha** (CX/UND/PCT não
  carregam número; `qtdEmbalagem` cai no nome). É perda de informação de tela, não de preço.
- ⚠️ `codigo` perdeu o zero à esquerda (`0000010` → `10`) em 1.381/1.381. Risco no PRÓXIMO import:
  se o relatório vier com 7 dígitos, a chave não casa e duplica. Corrigir = UPDATE → **espera OK**.
- ⚠️ `principio_ativo` NULL em 1.381/1.381 → **é o que deixa a Competitividade vazia** (abaixo).

**Telas conferidas no ar (04/08):**
- ✅ **Vendas Ativas popula**: 200 produtos, itens com badge FPMED e estoque 1.
- ✅ Dashboard: "1381 no estoque FPMED", 8.832 cotações.
- ✅ **Competitividade AGORA POPULA** (04/08, com OK do Lemuel). Estava zerada porque `_cpzKey` exige
  PA com ≥3 chars **e** dose, e `principio_ativo` estava vazio: **1.381 de 1.381** morriam no 1º portão.
  Não era bug de tela, era dado faltando.

### 🧬 Preenchimento do `principio_ativo` (04/08) — `tools/preenche_pa_global.js`
A FPMED **não tem a `cmed_pf`** (Bloco 3 do sync, não portado) e a `cmed_dicionario` está **vazia** —
por isso o `resolvePA` do app devolvia nada e o import deixou o campo NULL. Fonte usada: o próprio
banco, onde 4.350 linhas de distribuidor já têm PA (938 PAs distintos). **Não inventa PA** — só grava
o que casa contra esse vocabulário, em 2 camadas:
- **A)** mesmo produto já cotado por distribuidor com PA → 7
- **B)** token(s) do nome batem num PA conhecido → 437
- **não resolvido (fica NULL)** → 937

Dos 937 que ficaram vazios, **635 são material** (luva, gaze, seringa, cateter, sonda…) que não tem PA
por natureza — correto ficar vazio. Os **302 restantes são medicamento de verdade** (SORO FISIOLÓGICO,
PENICILINA, BICARBONATO, MORFINA, HEPARINA, HIDROCORTISONA, FITOMENADIONA…) cujo PA simplesmente não
existe no nosso vocabulário de 938. **Esses só resolvem com o Bloco 3 (CMED)** — é o limite honesto
desta abordagem.

Backup completo das 1.381 linhas antes de escrever (`backups/backup_pa_global_*.json`), PATCH por id,
444 gravadas, 0 erro.

**Resultado medido:** funil de 0 → **441 formam chave**, 344 com concorrente. Tela no ar: **241 itens
no pool confiável**, 98 acima da média, MKP mediano **+34%**, 14 "ganho fácil", 22 "prejuízo".

⚠️ **Achado novo pra próxima rodada:** os **59 itens "em revisão"** (fora dos KPIs, a tela já os isola
sozinha) são todos do mesmo formato `pack N vs 1` — nosso preço é da CAIXA e o do concorrente é por
UNIDADE (ex.: IPRATROPIO nosso R$ 596,41 vs R$ 1,31 · +45602%). É granularidade do lado concorrente,
não erro do nosso preço. Vale uma conferência item a item.

## 🏛️ MÓDULO LICITAÇÕES (04/08/2026) — spec pronta, construção na fila
Spec completa em **`LICITACOES_SPEC.md`** (estudo do SIGA Pregão + plano V1/V2).
- **V1**: busca no PNCP (UF default GO, palavras-chave de saúde, modalidade, período) → lista
  (órgão, objeto, valor, disputa, prazo, link) → **cruzamento dos itens do edital com o nosso
  banco** (matching PA+dose que já existe) → jornal salvo + card "Próximas disputas".
  Tabela nova `licitacoes_acompanhadas` (RLS: gestor grava, logado lê). Tema claro.
- **V2 (não fazer agora)**: portais **Comprasnet Goiás** e **Licitanet** (os mais relevantes
  pra GO), funil kanban, templates jurídicos.
- ⚠️ **API do PNCP estava FORA DO AR em 04/08 ~14h** (504 sem UF / 503 com `uf=GO`). O módulo
  precisa degradar com cache + aviso, nunca tela branca.
- **Ordem**: entra DEPOIS de normalização por unidade → sync de dados → Blocos 2/4.
  Mostrar screenshot do protótipo busca+lista ANTES de construir o cruzamento.

## 📦 REGRA PERMANENTE — ESTOQUE 0 VIRA 1 (decisão do Lemuel, 04/08/2026)
Item que vier com **estoque 0** no relatório entra/atualiza com **estoque = 1**.
**Por quê:** com estoque 0 o item some da Competitividade e das Vendas Ativas, e junto some o
**histórico de preço** dele — que é o que permite comparar depois. Com 1 ele fica visível na
comparação sem fingir que há saldo relevante.
- Aplicada no seed de 04/08: **781 linhas** (750 zeradas + 31 que já eram 1).
- ⬜ **PENDENTE gravar no FLUXO**: tela Atualizar Estoque + `tools/le_estoque_fpmed.js` + teste.
  (Item 4 da fila.)

## 🩺 SAÚDE DO SISTEMA (rodada 04/08/2026)
- Suíte: **110 asserts verdes / 0 falhas** em 6 suítes (`node tests/run_all.js`).
- Smoke test no ar: **10/10 páginas HTTP 200** em `fpmed-hospitalar.github.io/fpmed/`, todas
  limpas (zero GlobalMed, zero banco antigo, zero placeholder, zero telefone antigo).
- Banco: 11 tabelas respondendo; `cotacoes` 7.451 linhas, as outras 10 vazias (esperado — a FPMED
  ainda não carregou estoque próprio, clientes nem compras).

## 📌 Decisões/observações
- **Porta de entrada (22/07)**: link/splash abre DIRETO o `fpmed_sistema_final.html` (menu lateral
  completo). Painel virou acesso secundário via seção "Sistemas" do menu (com Giovana, Vendas,
  Viabilidade). Standalones têm pill "← Sistema" na topfaixa (à esquerda, p/ não colidir com o
  badge do gm-auth). `vendas.html` tolera ausência da tabela `prospects` (Prospecção fora do pacote).
- **gm-auth.js**: nome de arquivo mantido (include interno, sem prefixo `globalmed_`). Decidir
  se renomeia p/ `fp-auth.js`. **Recomendação (04/08): NÃO renomear** — "gm" não aparece em nada
  visível pro cliente, e o rename mexe no `<script src>` das 10 páginas + no versionamento `?v=`
  que já causou skew de cache uma vez. Risco real, ganho zero. Fechar como "fica assim".
- **competitividade_dark**: REMOVIDA em 22/07 (decisão do Lemuel) — redundante com a Competitividade
  clara do sistema_final. A Competitividade interna foi convertida pro tema claro na mesma data.
- **PDFs via `window.open` no sistema_final**: ✅ RESOLVIDO 23/07 — logo agora entra com URL
  absoluta (`new URL('logo_fpmed.png', location.href)`), resolve em qualquer janela `about:blank`.

Legenda: [x] concluída · [ ] pendente · ⛔ bloqueada
