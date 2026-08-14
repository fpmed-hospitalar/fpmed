@echo off
chcp 65001 >nul
cd /d C:\fpmed
title FPMED - agendar o watchdog do PNCP

REM ============================================================================
REM  UM CLIQUE LIGA, OUTRO DESLIGA.
REM
REM  O watchdog so serve se rodar sozinho: a API do PNCP pode voltar as 3 da
REM  manha de um domingo e a janela pode durar minutos. Mas registrar uma tarefa
REM  que roda de 20 em 20 minutos PARA SEMPRE nesta maquina e uma decisao do
REM  dono, nao do trabalhador -- entao ela mora aqui, num clique, em vez de ser
REM  ligada por baixo do pano.
REM
REM  REVERSIVEL: rode de novo e escolha 2 para remover. Nada mais fica.
REM ============================================================================

echo ============================================
echo   WATCHDOG DO PNCP - agendamento
echo ============================================
echo.
echo   Ele sonda a API de consulta do PNCP (que esta fora desde 14/08) e,
echo   quando ela voltar, dispara SOZINHO a varredura que completa as datas
echo   de abertura das 1.955 licitacoes que estao com a janela em branco.
echo.
echo   Uma sondagem = 1 requisicao de 1 registro. A cada 20 min, sao 72 por
echo   dia contra um portal publico -- menos que abrir a tela duas vezes.
echo.
echo   [1] LIGAR   (cria a tarefa "FPMED_WATCHDOG_PNCP", a cada 20 minutos)
echo   [2] DESLIGAR (remove a tarefa)
echo   [3] VER      (mostra o estado da tarefa)
echo   [0] sair
echo.
set /p OP=escolha:

if "%OP%"=="1" goto liga
if "%OP%"=="2" goto desliga
if "%OP%"=="3" goto ve
goto fim

:liga
schtasks /create /tn "FPMED_WATCHDOG_PNCP" /tr "\"C:\fpmed\WATCHDOG_PNCP.bat\"" /sc minute /mo 20 /f
if errorlevel 1 (
  echo.
  echo NAO CONSEGUI CRIAR A TAREFA. Abra este .bat como Administrador e tente de novo.
) else (
  echo.
  echo TAREFA CRIADA. Ela roda a cada 20 minutos, mesmo com esta janela fechada.
  echo Para conferir o que ela viu:  node tools\prova_cobertura_itens.js
)
goto fim

:desliga
schtasks /delete /tn "FPMED_WATCHDOG_PNCP" /f
echo.
echo TAREFA REMOVIDA (o codigo continua aqui; so parou de rodar sozinho).
goto fim

:ve
schtasks /query /tn "FPMED_WATCHDOG_PNCP" /v /fo list 2>nul
if errorlevel 1 echo A tarefa NAO esta agendada nesta maquina.
goto fim

:fim
echo.
pause
