@echo off
chcp 65001 >nul
cd /d C:\fpmed
title FPMED - continua a fila
echo ============================================
echo   FPMED - MODO AUTOMATICO (continua a fila)
echo ============================================
echo.
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
claude --dangerously-skip-permissions "continua a fila"
goto fim
:backupfail
echo.
echo BACKUP FALHOU - NAO vou abrir em modo automatico. Abra normal e investigue.
pause
exit /b 1
:fim
