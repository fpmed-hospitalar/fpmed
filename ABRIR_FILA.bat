@echo off
chcp 65001 >nul
cd /d C:\fpmed
title FPMED - continua a fila
echo ============================================
echo   FPMED - MODO AUTOMATICO (continua a fila)
echo ============================================
echo.

REM ============================================================================
REM  1. O COMANDO DA RODADA VIVE NUM ARQUIVO SO (.claude\prompt_fila.txt)
REM
REM  Ate 06/08 os dois .bat mandavam prompts DIFERENTES: este aqui mandava so
REM  "continua a fila", SEM as regras da rodada (nada de DELETE/UPDATE sem OK,
REM  commit + CONTINUAR + push a cada task, relatorio unico no fim).
REM  Dois cliques tem que comecar a rodada DO JEITO COMBINADO -- nao uma versao
REM  mais fraca dela. Com o texto num arquivo so, os dois nao tem como divergir
REM  de novo, e mudar a regra e editar um lugar.
REM ============================================================================

REM  O "claude" primeiro, que e barato: sem ele, nao ha por que gastar o backup.
where claude >nul 2>nul
if errorlevel 1 (
  echo ATENCAO: o comando "claude" nao esta disponivel nesta janela.
  echo Instale/atualize o Claude Code ^(npm i -g @anthropic-ai/claude-code^) e tente de novo.
  echo.
  pause
  exit /b 1
)

set "FILA="
if exist ".claude\prompt_fila.txt" (
  for /f "usebackq delims=" %%p in (".claude\prompt_fila.txt") do set "FILA=%%p"
)
if not defined FILA (
  echo ATENCAO: .claude\prompt_fila.txt sumiu ou esta vazio - abortando.
  echo E esse arquivo que guarda as REGRAS da rodada. Sem ele eu abriria uma
  echo rodada automatica sem contrato, que e pior que nao abrir.
  echo.
  pause
  exit /b 1
)

echo === Backup pre-rodada (obrigatorio) ===
if exist ".claude\hooks\backup_tabelas.js" (
  node .claude\hooks\backup_tabelas.js
  if errorlevel 1 goto backupfail
  echo === Backup OK ===
) else (
  echo ATENCAO: hook de backup sumiu de .claude\hooks - abortando por seguranca.
  pause
  exit /b 1
)
echo.
echo === Abrindo Claude e mandando continuar a fila ===
claude --dangerously-skip-permissions "%FILA%"
goto fim
:backupfail
echo.
echo BACKUP FALHOU - NAO vou abrir em modo automatico. Abra normal e investigue.
pause
exit /b 1
:fim
