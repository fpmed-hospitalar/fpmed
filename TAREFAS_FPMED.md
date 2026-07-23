# 🏥 PLACAR FPMED — task list permanente do projeto

> Padrão do projeto: TODA rodada da FPMED acompanha este placar. Marca ✓ na hora que
> concluir. Commit por etapa. (clone white-label #2 · pasta C:\fpmed · git próprio, sem remote)
>
> **Escopo do pacote FPMED = sistema completo SEM Prospecção e SEM Loja Pública**
> (decisões de escopo do Lemuel).

Última atualização: 2026-07-23

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

## ⬜ PENDENTES (na ordem)
- [ ] **Sync de dados**: preview rodado 22/07 → 0 novos / 0 atualizados / 7.451 pulados (seed
      já cobriu tudo). Próxima rodada quando a Global tiver cotações novas; gravar SÓ com OK.
- [ ] **Porte manual da Competitividade** (Global 005cb75/7cc5b87/e7501e0, parte cpz): a Global
      evoluiu a tela em cima do tema ESCURO; FPMED já está no claro — portar a ideia manualmente
      quando o Lemuel pedir (registrado no SYNC_GLOBAL.md).
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
3. **URL + ANON do Supabase** trocados pela instância da FPMED (não subir apontando p/ o banco do GlobalMed).
4. ✅ FEITO (22/07): `dashboard_clientes.html` ERA dado real do GlobalMed (33 clientes/CNPJs).
   Substituído por 10 clientes 100% fictícios (CNPJs prefixo 00., inválidos; marcas fictícias).
   Varredura: zero dos 33 nomes/CNPJs reais remanescente.
5. **Pix/WhatsApp**: dados de pagamento antigos existiam só na loja (removida). Conferir que
   nenhum Pix/WhatsApp da GlobalMed sobrou.
6. **Segurança do banco (RLS)** — ✅ FEITO: RLS ligada em todas as tabelas + policy `authenticated`,
   views com `security_invoker` (`db_rls.sql`). Testado: anon bloqueada (INSERT 401 / SELECT vazio),
   `authenticated` funciona. Como o repo vai público com a anon dentro, isso era essencial.

## 📌 Decisões/observações
- **Porta de entrada (22/07)**: link/splash abre DIRETO o `fpmed_sistema_final.html` (menu lateral
  completo). Painel virou acesso secundário via seção "Sistemas" do menu (com Giovana, Vendas,
  Viabilidade). Standalones têm pill "← Sistema" na topfaixa (à esquerda, p/ não colidir com o
  badge do gm-auth). `vendas.html` tolera ausência da tabela `prospects` (Prospecção fora do pacote).
- **gm-auth.js**: nome de arquivo mantido (include interno, sem prefixo `globalmed_`). Decidir
  se renomeia p/ `fp-auth.js`.
- **competitividade_dark**: REMOVIDA em 22/07 (decisão do Lemuel) — redundante com a Competitividade
  clara do sistema_final. A Competitividade interna foi convertida pro tema claro na mesma data.
- **PDFs via `window.open` no sistema_final**: ✅ RESOLVIDO 23/07 — logo agora entra com URL
  absoluta (`new URL('logo_fpmed.png', location.href)`), resolve em qualquer janela `about:blank`.

Legenda: [x] concluída · [ ] pendente · ⛔ bloqueada
