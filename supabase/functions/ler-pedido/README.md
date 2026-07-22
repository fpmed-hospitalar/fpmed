# Edge function `ler-pedido` (FPMED) — como colocar no ar

Proxy público do Claude usado por `fpmed_giovana.html` e `fpmed_sistema_final.html`
(Importar Cotação / Espelho — ler pedido por IA). Código: `index.ts`.

> **STATUS (22/07/2026): 100% NO AR** — deployada com trava de origem, Verify JWT OFF,
> secret `ANTHROPIC_API_KEY` configurado, teste ponta a ponta OK (Claude respondendo).
> Modelo default: `claude-opus-4-8` (o antigo `claude-sonnet-4-20250514` foi aposentado
> em 15/06/2026 — se um dia der `not_found_error` de modelo, checar aposentadorias).

## 🔒 Trava de origem (anti-abuso de crédito)
A função só aceita requisições cujo header `Origin` seja um dos `ALLOWED_ORIGINS` do
`index.ts` (`https://fpmed-hospitalar.github.io` e o futuro `https://sistema.fpmed.com.br`).
Qualquer outra origem (ou sem Origin — ex.: curl) recebe **403** sem gastar crédito.
Testado no ar: sem Origin → 403 · origem estranha → 403 · origens FPMED → passam.
⚠️ Consequências práticas:
- `curl` de teste precisa de `-H "Origin: https://fpmed-hospitalar.github.io"`.
- Abrir os HTML por `file://` NÃO funciona pro Importar Cotação (Origin `null` é barrado) —
  testar pelo GitHub Pages. Se um dia mudar o domínio, atualizar `ALLOWED_ORIGINS` e redeployar.
- É trava de abuso casual (navegador não forja Origin), não autenticação forte.

> A antiga edge function `/functions/v1/api` era vestigial (só sobrava definida na giovana,
> nunca chamada) — **não** precisa recriar. Só a `ler-pedido`.

## Pré-requisito: chave da FPMED (BLOQUEADO — aguardando Lemuel)
A função precisa de **`ANTHROPIC_API_KEY`** própria da FPMED (a do GlobalMed **não** foi copiada,
por regra). Guardar no `segredos.local.txt` e setar como secret do projeto.

## Opção A — Dashboard (sem instalar nada)
1. Supabase → projeto `fpmed` → **Edge Functions** → **Deploy a new function** (ou "Via editor").
2. Nome: `ler-pedido`. Colar o conteúdo de `index.ts`. Deploy.
3. Em **Edge Functions → Secrets**: adicionar `ANTHROPIC_API_KEY = sk-ant-...` (chave da FPMED).
4. Em **Function settings**: desligar **Verify JWT** (a função é pública; o app chama sem Authorization).

## Opção B — Supabase CLI
```bash
supabase login
supabase link --project-ref xzdowrksuswekwffoluk
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # chave da FPMED
supabase functions deploy ler-pedido                 # verify_jwt=false vem do config.toml
```

## Teste rápido (depois do deploy + secret)
```bash
curl -s -X POST https://xzdowrksuswekwffoluk.supabase.co/functions/v1/ler-pedido \
  -H "content-type: application/json" \
  -H "Origin: https://fpmed-hospitalar.github.io" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":50,"messages":[{"role":"user","content":"responda: ok"}]}'
```
Deve voltar um JSON com `content[].text`. Se vier `ANTHROPIC_API_KEY nao configurada`, faltou o secret.
