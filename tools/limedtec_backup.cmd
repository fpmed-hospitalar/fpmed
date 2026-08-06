@echo off
REM ============================================================================
REM LIMEDTEC - BACKUP AGENDADO DA FPMED (cliente 002)
REM
REM Chamado pela tarefa do Windows "LIMEDTEC-backup-002", 03:30.
REM
REM >>> O NOME DA TAREFA TEM O NUMERO DO CLIENTE DE PROPOSITO. Nesta maquina ja existe a
REM     "LIMEDTEC-backup-001", que e da instalacao de origem e aponta pra outra pasta. Duas
REM     instalacoes com tarefas de mesmo nome viram uma tarefa so, e o backup de um cliente
REM     passa a ser o do outro sem ninguem perceber. (O verificador cai nessa: ele procura
REM     "limedtec" no schtasks e da VERDE com a tarefa da OUTRA empresa.)
REM
REM O hook e o mesmo do ABRIR_FILA.bat: SO LEITURA, service_role lida do segredos.local.txt
REM em tempo de execucao, grava JSON em backups\ (gitignored).
REM ============================================================================
cd /d "C:\fpmed"
if not exist "C:\fpmed\backups" mkdir "C:\fpmed\backups"
echo ---- %DATE% %TIME% ---- >> "C:\fpmed\backups\_backup_agendado.log"
"C:\Program Files\nodejs\node.exe" "C:\fpmed\.claude\hooks\backup_tabelas.js" >> "C:\fpmed\backups\_backup_agendado.log" 2>&1
echo saida=%ERRORLEVEL% >> "C:\fpmed\backups\_backup_agendado.log"
