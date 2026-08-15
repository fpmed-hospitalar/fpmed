@echo off
chcp 65001 >nul
cd /d C:\fpmed
title FPMED - agendar os trabalhadores A e B

REM ============================================================================
REM  A FABRICA SOBREVIVER A REINICIO (fatia A26)
REM
REM  O PROBLEMA MEDIDO: em 14/08 as duas janelas foram fechadas sem querer e a
REM  producao parou 2 horas, porque o motor MORA na janela. Janela fechada,
REM  reinicio, queda de energia -- tudo isso hoje para a fabrica em silencio,
REM  e so se descobre olhando.
REM
REM  O QUE ISTO FAZ: registra duas tarefas no Agendador do Windows que sobem
REM  motor_A.bat e motor_B.bat NO LOGON do usuario. Depois de um reinicio, a
REM  fabrica volta sozinha assim que alguem entra na maquina.
REM
REM  POR QUE UM CLIQUE, E NAO LIGADO POR BAIXO DO PANO: instalar tarefa
REM  permanente na maquina do dono e decisao do dono. O trabalhador constroi a
REM  ferramenta e escreve a linha; quem clica e ele. Mesmo padrao do
REM  AGENDAR_WATCHDOG.bat.
REM
REM  REVERSIVEL: rode de novo e escolha 2. Nada mais fica.
REM ============================================================================

:menu
cls
echo ============================================================
echo   TRABALHADORES A e B - subir sozinhos no logon
echo ============================================================
echo.
echo   Hoje o motor mora na janela: fechou a janela, parou a fabrica.
echo   Com as tarefas instaladas, depois de reiniciar a maquina os dois
echo   motores voltam sozinhos quando voce entrar no Windows.
echo.
echo   As tarefas sao estas, e nada alem disto:
echo     FPMED_MOTOR_A  -^>  C:\fpmed\motor_A.bat   (no logon, apos 30 s)
echo     FPMED_MOTOR_B  -^>  C:\fpmed\motor_B.bat   (no logon, apos 30 s)
echo.
echo   ATENCAO - LEIA ANTES DE ESCOLHER 1:
echo   se as tarefas subirem no logon E voce ja tiver as janelas do A e do B
echo   abertas, ficam DUAS copias de cada motor rodando ao mesmo tempo. Duas
echo   copias leem a MESMA caixa e escrevem os MESMOS arquivos -- e uma pode
echo   desfazer o trabalho da outra sem ninguem ver.
echo   REGRA SIMPLES: depois de instalar, FECHE as janelas fpmed e fpmed2 que
echo   estiverem abertas, ou reinicie a maquina. Uma copia de cada, so.
echo.
echo   [1] LIGAR    (cria as duas tarefas)
echo   [2] DESLIGAR (remove as duas tarefas)
echo   [3] VER      (mostra o estado das duas)
echo   [0] sair
echo.
set /p OP=escolha:

if "%OP%"=="1" goto liga
if "%OP%"=="2" goto desliga
if "%OP%"=="3" goto ve
goto fim

:liga
REM  MEDIDO EM 14/08 NESTA MAQUINA: sem elevacao, o schtasks /create responde
REM  "Acesso negado". Descobrir isso DEPOIS de digitar SIM e fazer o dono
REM  perder o clique -- entao a checagem vem primeiro.
net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo ESTA JANELA NAO ESTA COMO ADMINISTRADOR.
  echo O Windows so deixa registrar tarefa no Agendador com elevacao, e ja
  echo medimos que aqui ele responde "Acesso negado".
  echo.
  echo O QUE FAZER: feche esta janela, clique com o BOTAO DIREITO neste
  echo arquivo ^(AGENDAR_TRABALHADORES.bat^) e escolha
  echo "Executar como administrador". Depois escolha 1 de novo.
  echo.
  echo Nada foi instalado.
  goto fim
)
echo.
echo Confirme que leu o aviso das DUAS COPIAS acima.
set /p CF=digite SIM para instalar (qualquer outra coisa cancela):
if /i not "%CF%"=="SIM" (
  echo.
  echo Cancelado. Nada foi instalado.
  goto fim
)
echo.
REM  /delay 30 s: no logon a maquina ainda esta subindo rede e disco. Um motor
REM  que nasce antes da rede falha na primeira leitura da caixa e so tenta de
REM  novo 10 minutos depois -- meia hora de fabrica perdida por 30 segundos.
schtasks /create /tn "FPMED_MOTOR_A" /tr "\"C:\fpmed\motor_A.bat\"" /sc onlogon /delay 0000:30 /f
if errorlevel 1 goto erro_criar
schtasks /create /tn "FPMED_MOTOR_B" /tr "\"C:\fpmed\motor_B.bat\"" /sc onlogon /delay 0000:30 /f
if errorlevel 1 goto erro_criar
echo.
echo AS DUAS TAREFAS FORAM CRIADAS.
echo Elas sobem no seu proximo logon (nao agora -- nada foi iniciado ainda).
echo.
echo AGORA FECHE as janelas fpmed e fpmed2 que estiverem abertas, ou reinicie
echo a maquina. Assim fica UMA copia de cada motor.
goto fim

:erro_criar
echo.
echo NAO CONSEGUI CRIAR AS TAREFAS. Abra este .bat como Administrador e tente
echo de novo. Se uma das duas foi criada e a outra nao, escolha 2 para limpar
echo e comece de novo -- meia instalacao e pior que nenhuma.
goto fim

:desliga
echo.
schtasks /delete /tn "FPMED_MOTOR_A" /f
schtasks /delete /tn "FPMED_MOTOR_B" /f
echo.
echo TAREFAS REMOVIDAS (os .bat continuam aqui; so pararam de subir sozinhos).
echo As janelas que ja estiverem abertas continuam rodando -- feche-as se
echo quiser parar a fabrica de verdade.
goto fim

:ve
echo.
echo --- FPMED_MOTOR_A ---
schtasks /query /tn "FPMED_MOTOR_A" /v /fo list 2>nul | findstr /i "TaskName Status Tarefa Executar Task Run Agendar Schedule"
if errorlevel 1 echo A tarefa FPMED_MOTOR_A NAO esta agendada nesta maquina.
echo.
echo --- FPMED_MOTOR_B ---
schtasks /query /tn "FPMED_MOTOR_B" /v /fo list 2>nul | findstr /i "TaskName Status Tarefa Executar Task Run Agendar Schedule"
if errorlevel 1 echo A tarefa FPMED_MOTOR_B NAO esta agendada nesta maquina.
goto fim

:fim
echo.
pause
