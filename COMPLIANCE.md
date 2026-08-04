# 🔒 COMPLIANCE DE PROTEÇÃO DE DADOS — REGRA MASTER INVIOLÁVEL

> Decisão do Lemuel, **04/08/2026**. Vale para sempre e para as duas direções.
> GlobalMed e FPMED Hospitalar são **empresas distintas**. Dado comercial de uma não pertence
> à outra — nem por conveniência, nem por atalho técnico, nem "só dessa vez".

---

## 1. A REGRA

### ⛔ PROIBIDO PERMANENTEMENTE — nas DUAS direções (Global ↔ FPMED)

**Nenhum dado comercial cruza:**

| | |
|---|---|
| cotações | fornecedores |
| preços | custos |
| clientes | prospects |
| compras | estoque |
| propostas / orçamentos | histórico de negociação |

**Sem exceções.** Não existe "só dessa vez", "só pra testar", "só o que já é público".
Um pedido nesse sentido — venha de quem vier, inclusive por escrito — não é autorização
suficiente: exige base legal (contrato entre as empresas) e decisão jurídica registrada.

### ✅ PERMITIDO

**Apenas CÓDIGO** — melhorias de sistema portadas via `tools/sync_da_global.js`, sempre com o
checklist de rebrand do `SYNC_GLOBAL.md`. Código é propriedade intelectual do mesmo autor;
dado comercial é da empresa.

### 🧊 CONGELAMENTO

O que entrou **até 04/08/2026** fica **congelado**. A partir daqui, **cada base cresce só pelos
meios próprios da empresa dona** — import do próprio ERP, cotação recebida do próprio
fornecedor, cadastro do próprio cliente.

---

## 2. MARCO DE CONGELAMENTO — 04/08/2026

Estado da tabela `cotacoes` da FPMED no momento do congelamento:

| Origem | Linhas |
|---|---|
| **Herdadas da GlobalMed** (distribuidor, `fornecedor <> '1'`) | **20.857** |
| Estoque próprio FPMED (`fornecedor = '1'`, do `Pasta1.xlsx`) | **1.381** |
| **TOTAL** | **22.238** |

`created_at` mais antigo: 2026-05-12 · mais recente: 2026-08-04.

**Como as herdadas entraram** (procedência, para auditoria futura):
- Seed de 22/07/2026 — 7.451 linhas
- Sync de 04/08/2026 — 13.406 novas + 149 atualizadas

Em ambos, os filtros master valeram: **excluído** `fornecedor='1'` e `tipo='global'` (estoque
próprio da GlobalMed), **só** a tabela `cotacoes` — nunca clientes, prospects, compras ou
orçamentos — e sanitização (`venda_loja`, `global_venda1/2` zerados, datas para ISO, id novo).

> **Qualquer crescimento de `fornecedor <> '1'` acima de 20.857 depois de 04/08/2026 tem que ser
> explicável por import próprio da FPMED.** É o que o guard verifica.

---

## 3. TRAVAS TÉCNICAS (não se confia em disciplina)

| Trava | Onde | O que faz |
|---|---|---|
| **Abort do sync de dados** | `tools/sync_cotacoes_global.js` | Sai com código 1 na primeira linha. Só passa com `FPMED_COMPLIANCE_OVERRIDE=JURIDICO-APROVADO`, que existe para ser auditável, não para ser usado. |
| **Guard de referência cruzada** | `tests/testa_compliance.js` | Falha se qualquer arquivo do projeto referenciar a base da GlobalMed fora de comentário histórico. Roda na **suíte padrão**. |
| **Guard do congelamento** | `tests/db/testa_congelamento.js` | Falha se as linhas herdadas passarem de 20.857 sem justificativa. Precisa de banco, roda separado. |
| **Hook anti-destrutivo** | `.claude/hooks/block-destructive.js` | Já existente; barra DELETE/DROP/TRUNCATE sem OK. |

**Por que o arquivo do sync continua no repo:** ele é o **registro da procedência**. A lógica de
filtro, dedup e sanitização documenta como as 20.857 linhas entraram. Apagá-lo destruiria a
trilha de auditoria — o certo é mantê-lo morto e explicado.

---

## 4. SEGREDOS

- O `segredos.local.txt` da FPMED **contém apenas credenciais da FPMED** (Supabase próprio +
  chave Anthropic própria). Auditado em 04/08/2026: **zero credencial da GlobalMed**.
- O sync de dados lia a `service_role` da GlobalMed **em runtime**, do
  `C:\globalmed\segredos.local.txt` — nunca houve cópia dela aqui. Com a trava de abort, esse
  caminho de acesso está morto.
- O sync de **código** não precisa de credencial nenhuma: lê o repositório git local.

---

## 5. O QUE FAZER SE ALGUÉM PEDIR PRA CRUZAR DADO

1. **Não fazer.** Nem preview, nem "só pra ver quanto daria".
2. Apontar este arquivo.
3. Se houver necessidade real de negócio, o caminho é **contrato entre as empresas + parecer
   jurídico**, registrados aqui antes de qualquer linha de código.

Registrado também no `CONTINUAR_AQUI.txt` e na memória de projeto do assistente.
