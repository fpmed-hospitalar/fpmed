# FPMED — Guia de Deploy (fazer com o Lemuel quando os dados chegarem, ~23/07)

Tudo pronto até aqui: rebrand, Supabase (tabelas + RLS), org/repo GitHub, código apontando pro
banco novo. Faltam os passos abaixo — vários dependem de dados/decisões do Lemuel.

## 0) PRÉ-CONDIÇÕES (não pular)
- [x] **Dados de registro reais** aplicados (22/07/2026): FPMED DISTRIBUIDORA DE PRODUTOS
      HOSPITALARES LTDA · CNPJ 47.110.418/0001-15 · IE 10.947.387-9 · Vila Brasília, Ap. de
      Goiânia/GO · WhatsApp (62) 98147-9532 · fixo (62) 3290-4241 · comercial@fpmed.com.br.
      Conferido: zero placeholder `[...]` nos *.html/*.js.
- [x] **Zero dado da GlobalMed** (22/07/2026): grep em *.html/*.js → zero ocorrência de
      globalmed / 54.379.172 / 20.131.542 / conde francisco / 99612 / banco antigo.
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
4. **Página inicial**: ✅ já existe `index.html` (splash com a marca FPMED que redireciona pro
   `fpmed_painel.html`). Se o Lemuel preferir outra home (ex.: abrir direto no `fpmed_sistema_final.html`),
   é só trocar o alvo do redirect no `index.html`.

## 3) Trocar as URLs do GitHub antigo — ✅ FEITO (22/07/2026)
- `gm-auth.js` (recover redirect) e `fpmed_painel.html` (raw/zip) agora apontam pro
  `fpmed-hospitalar/fpmed` (branch `main` nas URLs raw/zip — conferir o branch publicado no 1º push).
- **Supabase Auth**: Dashboard → Authentication → URL Configuration → adicionar
  `https://fpmed-hospitalar.github.io/fpmed/reset-senha.html` em **Redirect URLs** (senão o "esqueci a senha" falha).

## 4) Edge function `ler-pedido` (IA) — deployada 22/07/2026
Deployada via dashboard (editor), **Verify JWT desligado**, testada no ar (responde o erro
controlado sem secret). Falta só o Lemuel colar o secret `ANTHROPIC_API_KEY` em
Edge Functions → Secrets (a chave está no `segredos.local.txt`; Claude não digita API key).
Ver `supabase/functions/ler-pedido/README.md`.

## 5) ⚠️ CRIAR OS USUÁRIOS DE LOGIN (o app não funciona sem isso!)
O Supabase da FPMED está com `auth.users` **VAZIO**. O `gm-auth.js` exige login — sem usuários,
ninguém entra. Criar (Supabase → Authentication → Users → Add user) os acessos: admin (Lemuel) e
as vendedoras, com `user_metadata.role` (`admin`, `vendedora`, ou `giovana_only`). Definir senhas
com o Lemuel (senha é responsabilidade dele — o Claude não digita/grava senha).

## 6) (Opcional, futuro) domínio próprio `sistema.fpmed.com.br` via CNAME no GitHub Pages.
