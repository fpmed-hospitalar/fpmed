# 🏥 PLACAR FPMED — task list permanente do projeto

> Padrão do projeto: TODA rodada da FPMED acompanha este placar. Marca ✓ na hora que
> concluir. Commit por etapa. (clone white-label #2 · pasta C:\fpmed · git próprio, sem remote)
>
> **Escopo do pacote FPMED = sistema completo SEM Prospecção e SEM Loja Pública**
> (decisões de escopo do Lemuel).

Última atualização: 2026-07-21

## ⚠️ LEMBRETE DE INÍCIO DE SESSÃO
Enquanto a tarefa BLOQUEADA abaixo (dados de registro) não fechar, TODA sessão da FPMED
deve começar perguntando: **"⚠️ Aguardando dados de registro da FPMED — já chegaram?"**

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
- [ ] **Recriar edge functions** no projeto novo: `/functions/v1/ler-pedido` (sistema_final) e
      `/functions/v1/api` (giovana) — usadas por Importar Cotação/Espelho e leitura de pedido por IA.
- [x] **Tabelas criadas** no banco novo (12 tabelas/views, `db_schema.sql`). Todas retornam HTTP 200
      via REST com a anon key.
- [x] **RLS LIGADA + testada** (`db_rls.sql`): RLS on + policy `authenticated` em todas as tabelas,
      views com `security_invoker`. Testado: anon INSERT→401 e SELECT→`[]` (bloqueada); `authenticated`
      insere/lê (policy ok). Pré-condição de deploy #6 ✅ SATISFEITA.
- [ ] **Deploy** (#11): 1º push (precisa auth git/PAT p/ o repo privado) → depois tornar PÚBLICO +
      GitHub Pages (`fpmed-hospitalar.github.io/fpmed`). **Trava:** só vai ao ar sem placeholders e
      sem dado da GlobalMed (aguarda dados de registro) e apontando pro Supabase da FPMED.

## ⛔ BLOQUEADA — AGUARDANDO LEMUEL (previsão: 23/07/2026)
- [ ] **Dados de registro da FPMED** — o cliente vai enviar: razão social, CNPJ, Inscrição
      Estadual, endereço, WhatsApp comercial e e-mail. Quando o Lemuel colar os dados: trocar
      os placeholders `[RAZÃO SOCIAL FPMED]`/`[CNPJ]`/`[ENDEREÇO]`/`[WHATSAPP]` em TODOS os
      arquivos (PDFs, rodapés), conferir que não sobrou placeholder nem nada da GlobalMed,
      commit + push.

## 🔒 PRÉ-CONDIÇÕES DE DEPLOY (tarefa #11 — travar o push público até resolver)
1. **Nenhum placeholder** `[...]` e **nenhum dado da GlobalMed** (CNPJ 54.379.172/0001-47,
   IE, endereço) pode ir ao ar. Já aplicamos placeholders; o deploy só libera com os dados
   REAIS da FPMED no lugar.
2. **URLs do GitHub** (painel/gm-auth): trocar do repo antigo p/ o da org `fpmed-hospitalar`.
3. **URL + ANON do Supabase** trocados pela instância da FPMED (não subir apontando p/ o banco do GlobalMed).
4. **`dashboard_clientes.html`**: contém uma lista de clientes/CNPJs embutida (ex.: "ELLO
   DISTRIBUICAO LTDA", CNPJ 00000000000000) — REVISAR se é demo ou dado real do GlobalMed
   (regra master: nunca importar clientes do GlobalMed). Limpar/substituir por demo antes do deploy.
5. **Pix/WhatsApp**: dados de pagamento antigos existiam só na loja (removida). Conferir que
   nenhum Pix/WhatsApp da GlobalMed sobrou.
6. **Segurança do banco (RLS)** — ✅ FEITO: RLS ligada em todas as tabelas + policy `authenticated`,
   views com `security_invoker` (`db_rls.sql`). Testado: anon bloqueada (INSERT 401 / SELECT vazio),
   `authenticated` funciona. Como o repo vai público com a anon dentro, isso era essencial.

## 📌 Decisões/observações
- **gm-auth.js**: nome de arquivo mantido (include interno, sem prefixo `globalmed_`). Decidir
  se renomeia p/ `fp-auth.js`.
- **competitividade_dark**: mantido tema ESCURO (variante do catálogo), recolorido p/ navy+azul FPMED.
- **PDFs via `window.open` no sistema_final**: logo por caminho relativo pode não resolver em
  janela `about:blank` — se o logo não aparecer no PDF, embutir como base64.

Legenda: [x] concluída · [ ] pendente · ⛔ bloqueada
