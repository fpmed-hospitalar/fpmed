# Edge function `coletar-licitacoes` (FPMED) — item 10

Alimenta a tabela `licitacoes` com a API pública do PNCP, sozinha, 3x por dia. É a **metade 1**
da arquitetura da seção 2.0B do `LICITACOES_SPEC.md`: a ingestão vive fora do ciclo de
requisição do usuário, e a tela lê **só do nosso banco**.

> **STATUS (06/08/2026): NO AR.** Deployada (`verify_jwt=false`), secret `COLETA_TOKEN`
> configurado, testada ponta a ponta contra o PNCP real. Falta **um passo que é do Lemuel**:
> cadastrar o secret `COLETA_TOKEN` no GitHub pro agendamento rodar (instruções abaixo).

## 🔒 Por que ela existe em vez de o CI gravar direto

O repositório é **público** e a `service_role` **ignora toda a RLS**. Pôr a `service_role` nos
Secrets do Actions é pôr a chave-mestra do banco num pipeline. Aqui:

- a `service_role` fica **dentro do Supabase** (a plataforma injeta `SUPABASE_SERVICE_ROLE_KEY`
  no runtime — o CI nunca a vê);
- o CI conhece só o **`COLETA_TOKEN`**, dedicado e descartável. Se vazar, o estrago é o que
  **esta** função sabe fazer: gravar licitação pública. Não o banco inteiro.

A porta é fechada por padrão: **sem `COLETA_TOKEN` configurado a função responde 500 e não
coleta nada**. O contrário — "sem segredo, libera" — é como endpoint de escrita acaba público
por esquecimento de configuração.

## Contrato

```
POST /functions/v1/coletar-licitacoes
header: x-coleta-token: <COLETA_TOKEN>
body (opcional): { "dias": 7, "ufs": "GO,DF", "modalidades": "6,8,9" }
→ { ok, coletadas, gravadas, janela, truncou, breakerAberto, rateLimits, pausaFinalMs,
    estourouTempo, erro, segundos }
```

`ok` é a verdade da rodada, não o HTTP. **A função responde 200 mesmo em rodada parcial**: o
agendador não deve tratar "o PNCP estava fora" como falha do nosso lado e ficar reexecutando.

## Garantias (as mesmas do `tools/coleta_pncp.js`, e têm que continuar iguais)

| garantia | por quê |
|---|---|
| **nunca apaga** | coleta que falha deixa a tela **igual**, nunca vazia |
| **carimbo só avança em rodada inteira** | `coleta_status.ultima_ok` é o "coletados às HH:MM" da tela; avançar numa rodada que falhou faria a tela **mentir sobre a idade do dado** |
| **backoff exponencial (teto 30s)** | insistir de imediato numa API caída só piora |
| **circuit breaker (5 falhas seguidas)** | queda longa vira laço batendo na porta e conta de execução |
| **incremental (2 dias de sobreposição)** | publicação pode ser corrigida depois; reler 2 dias é barato perto de perder a alteração |
| **ritmo anti-429** | ver abaixo |
| **orçamento de tempo (100s)** | edge function não roda pra sempre; melhor rodar curto e voltar |

### ⏱️ O 429 — medido em 06/08/2026, na primeira coleta que de fato conversou com o PNCP

A função gravou **70 licitações** e então levou **HTTP 429**. A fonte estava **saudável**: só
disse *"você está indo rápido demais"*. Na 1ª versão isso contava como falha e **o circuit
breaker matou a rodada com a API no ar**.

> **429 não é queda.** Ele não passa pelo breaker. O que muda é o **ritmo**: a pausa entre
> chamadas **dobra a cada 429** (300ms → teto de 8s) e **não volta a acelerar** dentro da
> rodada — voltar a acelerar só provoca o próximo 429. Quando o servidor manda `Retry-After`,
> ele manda; sem ele, a espera começa em 5s (não em 1s como a queda). Teto de 20 rate limits
> por rodada, senão cota esgotada vira laço.
>
> A correção de verdade não é *retentar melhor*, é **andar mais devagar**.

## Deploy (sem instalar a CLI do Supabase)

```bash
node tools/deploy_edge.js --gera-token                # 1x — gera e grava no segredos.local.txt
node tools/deploy_edge.js --segredo COLETA_TOKEN      # seta o secret no projeto
node tools/deploy_edge.js --funcao coletar-licitacoes # publica
node tools/deploy_edge.js --chamar coletar-licitacoes # smoke test (confere o 401 sem token)
```

O `deploy_edge.js` usa a Management API com o `SUPABASE_ACCESS_TOKEN` do `segredos.local.txt`
(expira ~04/09/2026 — renovar lá). Nenhum segredo passa pela linha de comando.

## Agendamento

`.github/workflows/coleta-pncp.yml` — cron `0 9,15,21 * * *` (UTC) = **06h, 12h e 18h em
Goiás**, mais `workflow_dispatch` pra rodar na mão.

**⚠️ Passo do Lemuel, uma vez:** GitHub → repo `fpmed-hospitalar/fpmed` → *Settings → Secrets
and variables → Actions → New repository secret* → nome **`COLETA_TOKEN`**, valor = a linha
`COLETA_TOKEN` do `segredos.local.txt`. Sem isso o job para na 1ª linha com mensagem clara.

O job **só fica vermelho quando a falha é nossa** (HTTP ≠ 200: função fora, token errado,
projeto pausado). "O PNCP estava fora" vira **aviso amarelo** — esta fonte caiu 4 vezes em dois
dias, e um X vermelho diário treina qualquer um a ignorar o CI.

> **Alternativa sem CI**, se um dia o Actions incomodar: `pg_cron` + `pg_net` chamando a mesma
> função de dentro do Supabase, com o token no Vault. Tira o GitHub do caminho; em compensação
> some o histórico de execução visível. Não foi feito porque o agendamento por Actions já
> estava decidido no item 10 e não exige extensão nova no banco de produção.

## Rodar na mão (sem esperar o cron)

```bash
node tools/deploy_edge.js --chamar coletar-licitacoes --dias 7 --ufs GO
node tools/coleta_pncp.js            # ou o coletor local, que usa a service_role da máquina
```
