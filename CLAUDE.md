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

## COMMIT SEMPRE POR CAMINHO

`git add <arquivo>` — **nunca** `git add .` / `git add -A`. As duas janelas dividem este
diretório; o commit `0fd4978` levou 30 linhas da outra janela junto.
