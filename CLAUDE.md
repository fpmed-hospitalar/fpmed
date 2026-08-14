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
