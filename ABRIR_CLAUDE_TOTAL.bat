@echo off
chcp 65001 >nul
cd /d C:\fpmed
REM Backup pre-rodada: hook proprio da FPMED (04/08/2026) - le o banco xzdowrksuswekwffoluk
REM e grava JSON em C:\fpmed\backups\ (gitignored). SO LEITURA. Se o hook sumir, segue sem backup.
REM
REM O PROMPT DA RODADA sai do MESMO arquivo que o ABRIR_FILA.bat (.claude\prompt_fila.txt):
REM ate 06/08 os dois carregavam textos diferentes, e o outro abria a rodada sem as regras.
where claude >nul 2>nul
if errorlevel 1 (
  echo ATENCAO: o comando "claude" nao esta disponivel nesta janela.
  echo Instale/atualize o Claude Code ^(npm i -g @anthropic-ai/claude-code^) e tente de novo.
  pause
  exit /b 1
)

set "FILA="
if exist ".claude\prompt_fila.txt" (
  for /f "usebackq delims=" %%p in (".claude\prompt_fila.txt") do set "FILA=%%p"
)
if not defined FILA (
  echo ATENCAO: .claude\prompt_fila.txt sumiu ou esta vazio - abortando.
  echo E esse arquivo que guarda as REGRAS da rodada; sem ele a rodada abriria sem contrato.
  pause
  exit /b 1
)

if exist ".claude\hooks\backup_tabelas.js" (
  echo === Backup pre-rodada ^(obrigatorio^) ===
  node .claude\hooks\backup_tabelas.js
  if errorlevel 1 goto backupfail
  echo === Backup OK ===
) else (
  echo === ATENCAO: hook de backup sumiu de .claude\hooks - seguindo SEM backup ===
)
echo === Abrindo Claude em modo total ===
claude --dangerously-skip-permissions "%FILA%"
goto fim
:backupfail
echo BACKUP FALHOU - NAO abrindo em modo total. Abra normal e investigue.
pause
exit /b 1
:fim
