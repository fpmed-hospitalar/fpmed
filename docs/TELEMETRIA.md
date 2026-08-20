# TELEMETRIA — como o LIMEDTEC passa a enxergar o que acontece em produção

> Escrito pelo arquiteto em 15/08/2026. O dono criou a organização **LIMEDTEC** no
> PostHog e o arquiteto concluiu a configuração no navegador, a pedido dele.
> **NÃO instrumente nada antes de ler a seção "REGRA DE PRIVACIDADE".**

---

## 1. POSTHOG — PRONTO PARA USAR

**Projeto:** 558913 · organização LIMEDTEC · região EUA
**Produtos ligados:** Product Analytics · Session Replay · Web Analytics

**Chave do projeto (pública, feita para viver dentro da página):**
```
phc_ovoRYDgQYQL8BwDKL9c2eqhSAsMHmUtFy7WeikLACvxz
```
**Host da API:** `https://us.i.posthog.com`

> Esta chave **pode** ficar no repositório público. Ela é a chave de ESCRITA de eventos,
> não dá acesso de leitura ao painel. Não confundir com a chave pessoal de API do
> PostHog (essa é secreta e não entra em lugar nenhum do código).

**O trecho oficial, para o `<head>` de cada página:**
```html
<script>
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){
  /* ... trecho completo copiado do painel do PostHog, sem edição ... */ }}
  posthog.init('phc_ovoRYDgQYQL8BwDKL9c2eqhSAsMHmUtFy7WeikLACvxz', {
      api_host: 'https://us.i.posthog.com',
      defaults: '2026-05-30',
      person_profiles: 'identified_only'
  })
</script>
```

**COMO INSTALAR NESTA CASA — e não é copiando o trecho sete vezes:**
Crie **um** arquivo `fpmed_telemetria.js` e chame ele nas páginas. Trecho repetido em
sete telas é sete lugares para esquecer de atualizar — é exatamente a denúncia nº 3 de
"feito por IA" da BASE_ENGENHARIA. Uma fonte de verdade, sempre.

---

## 2. REGRA DE PRIVACIDADE — LEIA ANTES DE LIGAR O SESSION REPLAY

O Session Replay **grava a tela do usuário**. O Natanael trabalha com dados da empresa
dele e de órgãos públicos. Antes de a primeira gravação existir:

1. **Mascare por padrão.** Ligue o mascaramento de todo campo de entrada e de todo texto,
   e libere só o que precisar ser visto. O contrário — liberar tudo e esconder depois —
   já vazou por descuido em toda empresa que tentou.
2. **Nunca envie para o PostHog:** CNPJ do cliente, dado de certidão, senha, token,
   conteúdo de documento anexado, e o corpo de qualquer proposta comercial.
3. **Evento é sobre COMPORTAMENTO, não sobre CONTEÚDO.** "filtrou por UF" é evento bom.
   "filtrou por UF=GO, produto=dipirona, empresa=X" é vazamento com nome de métrica.
4. **`person_profiles: 'identified_only'`** fica como está: não cria perfil para visitante
   anônimo.
5. Se ficar em dúvida se um campo pode ir, **ele não vai** — e você escreve a dúvida no
   relatório para o arquiteto decidir.

---

## 3. SENTRY — PRONTO PARA USAR

**Organizacao:** limedtec · **Projeto:** `fpmed` · **Regiao:** Europa (de)
**Plataforma:** Browser JavaScript, sem framework ("Nope, Vanilla") — que e o que a
FPMED e: HTML, CSS e JS puro.

**A instalacao mais simples, e e a que devemos usar — o LOADER SCRIPT.**
Uma linha no `<head>`, sem DSN, sem npm, sem build:
```html
<script src="https://js-de.sentry-cdn.com/797bc66e72aad46ad75098bf1efcf3db.min.js" crossorigin="anonymous"></script>
```

**DSN** (so necessario se um dia usarmos o SDK por npm em vez do loader):
```
https://797bc66e72aad46ad75098bf1efcf3db@o4511912406614016.ingest.de.sentry.io/4511937949073488
```

**Configuracao que ja veio ligada:** Error Monitoring · Logs · Metricas · Session Replay
(10% das sessoes normais, 100% das sessoes com erro) · Tracing. Alerta em "high priority
issues", com aviso por e-mail.

> AVISO 1 — **O Session Replay do Sentry grava tela igual ao do PostHog.** A REGRA DE
> PRIVACIDADE da secao 2 vale para os dois, sem excecao. Antes da primeira gravacao
> existir, mascare tudo por padrao.

> AVISO 2 — **`tracesSampleRate: 1` captura TODAS as transacoes.** No plano gratis isso
> queima a cota depressa. Baixe para 0,1 na primeira fatia e escreva o numero medido no
> relatorio.

**Como verificar que funcionou:** o Sentry oferece um erro de teste —
`myUndefinedFunction();`. Dispare uma vez numa pagina de teste (NUNCA em producao com o
usuario olhando) e confira que ele aparece em Issues.

## 4. O QUE MEDIR PRIMEIRO — e o que NÃO medir

A BASE_VISUAL diz que a cabeça do gestor faz cinco perguntas, nesta ordem: *ainda dá
tempo · vale meu dinheiro · é do meu ramo · até onde posso baixar · o que faço agora*.
A telemetria existe para descobrir **em qual dessas cinco ele trava**.

**Eventos da primeira leva (poucos, e cada um com uma pergunta atrás):**
- `busca_executada` (termo genérico ou específico? quantos resultados voltaram? zero?)
- `resultado_zero` — a pergunta mais valiosa do sistema: **quantas buscas terminam em
  nada, e com quais palavras.** É o que revela sinônimo faltando no dicionário.
- `licitacao_aberta` (de onde: busca, meus negócios, link direto)
- `item_comparado_com_cmed`
- `adicionado_aos_negocios` — a conversão que importa
- `erro_visto_pelo_usuario` (com a causa, nunca com o dado)

**NÃO meça** o que você não vai usar para decidir nada. Painel cheio de métrica que
ninguém lê é o mesmo defeito de teste vermelho permanente: ensina todo mundo a ignorar.

---

## 5. A PROVA DE QUE FUNCIONOU

Instrumentar não é ter escrito o `<script>`. É:
1. Abrir a tela no navegador (Playwright serve) e confirmar que o evento **saiu**
   (aba de rede, requisição para `us.i.posthog.com` com resposta 200).
2. Confirmar que ele **chegou** — a tela "Waiting for events" do PostHog vira "Connected".
3. Um teste que quebra se a chamada de `init` sumir da página.
Sem os três, a fatia não está pronta. Prova que só lê o próprio código-fonte não vale
quando há servidor no caminho.
