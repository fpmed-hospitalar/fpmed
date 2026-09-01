@echo off
rem GERADO PELO ARQUITETO - NAO EDITE A MAO. O texto do prompt e
rem contrato da fabrica; mudar aqui muda o que o trabalhador le.
title fpmed (Trabalhador A - automatico)
cd /d C:\fpmed
if not exist C:\fpmed\logs mkdir C:\fpmed\logs
set INDICE=C:\fpmed\logs\motor_A.log
set SESSAO=%RANDOM%
set /a N=0
echo ============================================================
echo   TRABALHADOR A - motor automatico
echo   indice dos ciclos : %INDICE%
echo   detalhe de cada um: C:\fpmed\logs\A_%SESSAO%_ciclo_N.log
echo   NAO FECHE esta janela. Para parar, feche-a de proposito.
echo ============================================================
echo. >> "%INDICE%" 2>nul
echo ===== MOTOR A INICIADO em %date% %time% (sessao %SESSAO%) ===== >> "%INDICE%" 2>nul

:loop
set /a N+=1
set CICLO=C:\fpmed\logs\A_%SESSAO%_ciclo_%N%.log
echo.
echo [%time%] ciclo %N% iniciado - trabalhando... (detalhe em %CICLO%)
echo [%date% %time%] ciclo %N% iniciado >> "%INDICE%" 2>nul
call claude -p --verbose --dangerously-skip-permissions "Voce e o Trabalhador A (janela fpmed). Leia C:\fpmed\caixas\CAIXA_A.md. Se o SINAL no topo for AGUARDE, responda apenas 'aguardando' e encerre. Se for TRABALHE: execute a caixa inteira no regime nao-parar do CLAUDE.md, grave o relatorio em C:\fpmed\relatorios\RELATORIO_A.md (acrescentando no topo) e, como ULTIMO ato, troque o SINAL da caixa para AGUARDE." > "%CICLO%" 2>&1
set CODIGO=%ERRORLEVEL%
echo [%date% %time%] ciclo %N% terminou codigo %CODIGO% (detalhe: %CICLO%) >> "%INDICE%" 2>nul
echo [%time%] ciclo %N% terminado (codigo %CODIGO%) - nova checagem em 10 min
timeout /t 600 /nobreak
goto loop
