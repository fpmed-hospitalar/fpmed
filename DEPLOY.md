# FPMED — Guia de Deploy (fazer com o Lemuel quando os dados chegarem, ~23/07)

Tudo pronto até aqui: rebrand, Supabase (tabelas + RLS), org/repo GitHub, código apontando pro
banco novo. Faltam os passos abaixo — vários dependem de dados/decisões do Lemuel.

## 0) PRÉ-CONDIÇÕES (não pular)
- [ ] **Dados de registro reais** substituindo os placeholders `[RAZÃO SOCIAL FPMED]` / `[CNPJ]` /
      `[ENDEREÇO]` (giovana + sistema_final). Conferir: `grep -R "\[RAZÃO SOCIAL FPMED\]\|\[CNPJ\]\|\[ENDEREÇO\]" *.html` → zero.
- [ ] **Zero dado da GlobalMed**: `grep -Ri "globalmed\|54.379.172\|20.131.542\|conde francisco" *.html *.js` → só sobra URL do github antigo (trocada no passo 3).
- [ ] `dashboard_clientes.html`: revisar a lista de clientes/CNPJs embutida (ex.: ELLO DISTRIBUICAO) —
      é demo? Se for dado real do GlobalMed, limpar antes de publicar.

## 1) 1º PUSH (repo é privado; precisa de credencial git) — passo a passo do PAT
O git local ainda não tem credencial pro `fpmed-hospitalar/fpmed`. Duas opções:

### Opção A — Personal Access Token (fine-grained)
1. GitHub (logado como lemuelbarros-dot) → Settings → Developer settings → **Fine-grained tokens** →
   **Generate new token**.
2. **Resource owner**: `fpmed-hospitalar` (a organização). Expiration: 90 dias (ou o que preferir).
3. **Repository access**: Only select repositories → `fpmed-hospitalar/fpmed`.
4. **Permissions** → Repository → **Contents: Read and write**. Gerar e COPIAR o token (`github_pat_...`).
5. No PC (uma vez), fazer o push com o token embutido na URL (o Claude Code roda isto):
   ```
   git -C C:\fpmed push https://<TOKEN>@github.com/fpmed-hospitalar/fpmed.git master
   ```
   (ou colar o token quando o `git push` pedir "Password"). Salvar o token no `segredos.local.txt`.

### Opção B — GitHub CLI
```
gh auth login          # escolher GitHub.com > HTTPS > browser
git -C C:\fpmed push -u origin master
```

## 2) TORNAR PÚBLICO + GitHub Pages
1. Repo `fpmed-hospitalar/fpmed` → Settings → **Change visibility → Public** (Pages Free precisa público).
2. Settings → **Pages** → Source: Deploy from a branch → Branch: `master` / root → Save.
3. URL final: `https://fpmed-hospitalar.github.io/fpmed/` (páginas: `.../fpmed_painel.html`, etc.).
4. **Página inicial**: como não há `index.html`, criar um (redirect pro `fpmed_painel.html`) OU renomear
   a porta de entrada. Decidir com o Lemuel qual é a home.

## 3) Trocar as URLs do GitHub antigo (agora que a URL nova existe)
- `gm-auth.js` (recover redirect) e `fpmed_painel.html` (raw/zip do repo) apontam pro repo antigo
  `lemuelbarros-dot/globalmed`. Trocar para `fpmed-hospitalar/fpmed` (ou a URL do Pages).
- **Supabase Auth**: Dashboard → Authentication → URL Configuration → adicionar
  `https://fpmed-hospitalar.github.io/fpmed/reset-senha.html` em **Redirect URLs** (senão o "esqueci a senha" falha).

## 4) Edge function `ler-pedido` (IA)
Ver `supabase/functions/ler-pedido/README.md`. Precisa da **ANTHROPIC_API_KEY da FPMED** (bloqueado).

## 5) ⚠️ CRIAR OS USUÁRIOS DE LOGIN (o app não funciona sem isso!)
O Supabase da FPMED está com `auth.users` **VAZIO**. O `gm-auth.js` exige login — sem usuários,
ninguém entra. Criar (Supabase → Authentication → Users → Add user) os acessos: admin (Lemuel) e
as vendedoras, com `user_metadata.role` (`admin`, `vendedora`, ou `giovana_only`). Definir senhas
com o Lemuel (senha é responsabilidade dele — o Claude não digita/grava senha).

## 6) (Opcional, futuro) domínio próprio `sistema.fpmed.com.br` via CNAME no GitHub Pages.
