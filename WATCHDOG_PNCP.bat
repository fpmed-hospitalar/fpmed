@echo off
chcp 65001 >nul
cd /d C:\fpmed
title FPMED - watchdog do PNCP

REM ============================================================================
REM  UMA SONDAGEM. NAO E UM LACO.
REM
REM  Este .bat roda o watchdog UMA VEZ e sai. Quem repete e o agendador do
REM  Windows (ver AGENDAR_WATCHDOG.bat) -- e essa divisao e de proposito:
REM  um laco aqui dentro viraria um processo eterno batendo num portal publico,
REM  que e exatamente o que o circuit breaker do coletor existe pra impedir.
REM
REM  O que ele faz: sonda a API de CONSULTA do PNCP (a que esta fora desde
REM  14/08), grava a sondagem em `pncp_sondagens` -- inclusive quando ela falha,
REM  porque e a falha que da a duracao da queda -- e, NA VIRADA de fora para no
REM  ar, dispara sozinho a varredura normal (tools/coleta_pncp.js), que e quem
REM  preenche as datas de abertura que ficaram NULL.
REM
REM  Sondagem que falha NAO e erro deste .bat: e a noticia dele. Por isso ele
REM  sai com 0 mesmo com o PNCP fora -- sair com erro faria o agendador alarmar
REM  "watchdog quebrado" quando o quebrado e o PNCP.
REM ============================================================================

node tools\watchdog_pncp.js
exit /b 0
