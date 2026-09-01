# FPMED — instruções permanentes

Este arquivo é lido no começo de toda sessão. O contexto completo do projeto (o que já foi
feito, a fila, as decisões do dono) mora em `CONTINUAR_AQUI.txt` — **leia ele primeiro**.

## REGIME DE EXECUÇÃO PADRÃO — NÃO PARAR

- Caixas do arquiteto executam em sequência SEM parar entre fatias; a caixa já chega
  aprovada pelo dono.
- Decisão pequena no meio: escolher o caminho mais simples e reversível, anotar, seguir.
- Precisa do dono (senha, escolha, teste visual)? NÃO travar: anotar em
  "PENDÊNCIAS DO DONO", pular e continuar o que não depende.
- Fatia bloqueada inteira: pular, anotar o porquê, seguir a próxima.
- Só parar quando não houver mais nada executável; aí entregar relatório final:
  feito (com provas medidas) + decisões tomadas + PENDÊNCIAS DO DONO numeradas,
  em linguagem simples.
- Segurança intocável mesmo neste regime: nada de DELETE/DROP/TRUNCATE/UPDATE
  destrutivo (pula e anota), esquema só aditivo, commit+push por fatia,
  prova medida antes de declarar pronto.

## ATALHOS DO DONO

Se a PRIMEIRA mensagem do dono for só uma destas palavras, ela vale por toda a ordem:

- **`A`** — você é o Trabalhador A (janela `fpmed`): leia `C:\fpmed\caixas\CAIXA_A.md`
  e execute no regime não-parar.
- **`B`** — você é o Trabalhador B (janela `fpmed2`): leia `C:\fpmed\caixas\CAIXA_B.md`
  e execute no regime não-parar.
- **`relatorio`** — grave o relatório do que fez até aqui em `C:\fpmed\relatorios\`
  (`RELATORIO_A.md` ou `RELATORIO_B.md`, conforme a sua identidade), acrescentando no
  topo com data/hora, sem apagar relatório antigo.

O SINAL no topo da caixa manda: `TRABALHE` = executar a caixa inteira; `AGUARDE` = nada
novo, responder em uma linha. Quem devolve o sinal para `AGUARDE` é o trabalhador, como
último ato, depois de gravar o relatório.

## CANAL ENTRE OS CHATS — LEIA A SUA CAIXA AO ABRIR

As sessões **não se enxergam**: o único chão comum é este disco. Quando precisar falar com outro
chat do FPMED (arquiteto ↔ trabalhador A ↔ trabalhador B), é por aqui:

```
node tools/recado.js caixa <quem>                  o que chegou e você não leu
node tools/recado.js manda <de> <para> "texto"     deixa um recado
node tools/recado.js li <quem>                     marca como lido
node tools/recado.js tudo                          o histórico
```
`<quem>` é `A`, `B`, `arquiteto`, `dono` ou `todos`.

**Rode `caixa` no começo da sua sessão e ao fechar cada fatia.** Ele sai com código 2 quando há
recado esperando, então dá para pendurar em script sem ler a tela.

**Por que ele existe e por que é `.jsonl`:** mensagem direta não existe; o relatório passou de
200 KB e recado curto lá dentro se perde (foi assim que a fábrica ficou **11 dias parada** com
`FILA VAZIA` escrito); e arquivo `.md` compartilhado **duas janelas sobrescrevem**. Este é
**append-only, uma linha por recado** — a única operação que duas janelas fazem ao mesmo tempo
sem uma apagar a outra. **Nunca edite `caixas/RECADOS.jsonl` à mão**: use a ferramenta.

Isto **não substitui a caixa**. Caixa é ordem (o arquiteto manda, o trabalhador executa); recado é
conversa curta — um bloqueio, um achado que muda a próxima fila, uma pergunta de território.

## COMMIT SEMPRE POR CAMINHO

`git add <arquivo>` — **nunca** `git add .` / `git add -A`. As duas janelas dividem este
diretório; o commit `0fd4978` levou 30 linhas da outra janela junto.
