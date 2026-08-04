@echo off
chcp 65001 >nul
cd /d C:\fpmed
REM Backup pre-rodada: hook proprio da FPMED (04/08/2026) - le o banco xzdowrksuswekwffoluk
REM e grava JSON em C:\fpmed\backups\ (gitignored). SO LEITURA. Se o hook sumir, segue sem backup.
if exist ".claude\hooks\backup_tabelas.js" (
  echo === Backup pre-rodada ^(obrigatorio^) ===
  node .claude\hooks\backup_tabelas.js
  if errorlevel 1 goto backupfail
  echo === Backup OK ===
) else (
  echo === ATENCAO: hook de backup sumiu de .claude\hooks - seguindo SEM backup ===
)
echo === Abrindo Claude em modo total ===
claude --dangerously-skip-permissions "Le o CONTINUAR_AQUI e continua a fila de tarefas na ordem, trabalhando sozinho. Nunca executa DELETE/DROP/TRUNCATE/UPDATE de dados sem OK - se precisar, pula e anota. Decisao de negocio acumula pro checkpoint. Commit + CONTINUAR + push a cada task. No final, relatorio unico."
goto fim
:backupfail
echo BACKUP FALHOU - NAO abrindo em modo total. Abra normal e investigue.
pause
exit /b 1
:fim
