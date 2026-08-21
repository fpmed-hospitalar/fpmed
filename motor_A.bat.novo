@echo off
rem ==========================================================================================
rem  motor_A.bat.novo - DUAS MELHORIAS ESPERANDO A MESMA TROCA
rem      A36 (20/08/2026): o motor respeita o LIMITE DO PLANO.
rem      A42 (21/08/2026): o motor NAO ACORDA O CLAUDE quando a caixa esta em AGUARDE.
rem
rem  >>> ATENCAO, ARQUITETO: quando comecei a A42 este arquivo JA EXISTIA, com a A36 dentro,
rem      e continuava esperando a troca do dono desde 20/08. As duas melhorias estao agora no
rem      MESMO arquivo, entao UMA troca entrega as duas. Se voce so quer a A36, ela esta
rem      inteira no commit e14f8be.
rem
rem  ASCII PURO DE PROPOSITO: o cmd.exe le .bat na pagina de codigo do console, nao em UTF-8.
rem  Acento e risco longo neste cabecalho sairiam embaralhados justo no texto que o DONO le
rem  para trocar o arquivo. O motor_A.bat de hoje tambem e ASCII puro - segui a casa.
rem
rem  == COMO O DONO TROCA (30 SEGUNDOS, E SO ELE PODE FAZER) =================================
rem  NAO troquei sozinho DE PROPOSITO: o cmd.exe RELE o .bat de dentro do laco, linha por
rem  linha, enquanto ele roda. Trocar o arquivo com a janela aberta faz o cmd continuar lendo
rem  do OFFSET antigo dentro de um arquivo novo - ele cai no meio de uma linha e executa lixo.
rem  (O arquiteto ja cometeu esse erro uma vez; e a razao de este arquivo se chamar `.novo`.)
rem
rem    1. FECHE as duas janelas pretas (a "fpmed" e a "fpmed 2"). As duas.
rem    2. Abra a pasta C:\fpmed.
rem    3. Renomeie  motor_A.bat       ->  motor_A.bat.velho
rem       Renomeie  motor_A.bat.novo  ->  motor_A.bat
rem       Renomeie  motor_B.bat       ->  motor_B.bat.velho
rem       Renomeie  motor_B.bat.novo  ->  motor_B.bat
rem    4. Abra de novo pelos atalhos de sempre ("fpmed A.bat" e "fpmed B.bat").
rem    DEU ERRADO? Apague os dois .bat e renomeie os .velho de volta. Nada mais muda.
rem
rem  == A36: O LIMITE DO PLANO, LIDO DO LOG DO PROPRIO CICLO =================================
rem  Entre 15 e 18/08 a fabrica ficou parada por limite semanal do plano. Os dois motores
rem  continuaram batendo na porta de 10 em 10 minutos: 82 ciclos do A e 86 do B, tres dias
rem  seguidos, TODOS gravando a mesma linha - "You've hit your weekly limit - resets Aug 18".
rem  168 ciclos que nao podiam dar em nada, porque a data em que o limite voltava ESTAVA
rem  ESCRITA na propria resposta. O motor tinha a informacao na mao e nao a lia.
rem  Agora, ao fim de cada ciclo, ele le o log DAQUELE ciclo: se a frase estiver la, espera
rem  UMA HORA em vez de dez minutos.
rem  >>> POR QUE UMA HORA E NAO ATE A DATA QUE A MENSAGEM DIZ: ler a data exigiria interpretar
rem      texto em ingles dentro de um .bat, e um erro nessa leitura deixaria a fabrica dormindo
rem      ate uma data errada - o defeito oposto, e pior. Uma hora e curta o bastante para nao
rem      perder a volta e longa o bastante para 72 horas de limite custarem 72 ciclos, nao 432.
rem  >>> E ELE NAO DESISTE: o limite volta sozinho e ninguem esta olhando as 3 da manha de um
rem      domingo. O que estava errado era a FREQUENCIA, nao a insistencia.
rem
rem  == A42: O AGUARDE DEIXA DE CUSTAR UM CLAUDE CODE ========================================
rem  Antes: o motor ligava um Claude Code INTEIRO a cada 10 minutos, mesmo com a caixa em
rem  AGUARDE, so para ler uma linha e escrever "aguardando".
rem  Agora: quem le essa linha e o PROPRIO .bat, com um findstr que nao custa nada. O Claude
rem  so e acordado quando a caixa diz TRABALHE.
rem  MEDIDO NO DISCO (logs\A_*_ciclo_*.log e logs\B_*, de 14/08 a 21/08/2026): 317 ciclos,
rem  dos quais 87 (27 por cento) foram um Claude Code inteiro so para imprimir "aguardando" -
rem  36 do A e 51 do B. Esses 87 passam a custar ZERO. Nao e "3x menos", como a caixa A42
rem  pediu: e nenhum.
rem
rem  == POR QUE 10 MIN NO AGUARDE, E NAO OS 30 QUE A CAIXA PEDIU =============================
rem  A caixa A42 pediu "AGUARDE -> espera 30 min" para ligar o Claude 3x menos. Esperar 30 min
rem  so compensa se ACORDAR CUSTAR. Aqui acordar deixou de custar: a espera longa passaria a
rem  cobrar o unico preco que sobrou - ate 30 minutos de fabrica parada depois de o arquiteto
rem  recarregar a caixa - sem comprar nada em troca. Ficou em 10 min, que e a cadencia que o
rem  dono ja conhece.
rem  QUEM DISCORDAR TROCA UM NUMERO SO: o "set ESPERA=600" que esta logo abaixo do rotulo
rem  :dormir, la no fim do arquivo (1800 = 30 min). E so a espera do AGUARDE que muda.
rem
rem  == O QUE SE PERDE =======================================================================
rem  O log do ciclo em AGUARDE. Antes sobrava um C:\fpmed\logs\A_*_ciclo_N.log de 11 bytes
rem  escrito "aguardando"; agora nao ha ciclo, entao nao ha arquivo. Em troca a linha entra no
rem  indice (logs\motor_A.log) como "AGUARDE - ciclo economizado (N)", que e a mesma prova de
rem  que o motor esta vivo, sem o Claude no meio.
rem
rem  rem GERADO PELO ARQUITETO - NAO EDITE A MAO. O texto do prompt e
rem  rem contrato da fabrica; mudar aqui muda o que o trabalhador le.
rem  >>> O PROMPT DA LINHA `call claude` ABAIXO ESTA BYTE A BYTE IGUAL AO DO motor_A.bat.
rem      A36 e A42 mexem em QUANDO chamar, nunca no QUE e dito. A catraca
rem      tests/testa_motor_respira.js compara os dois textos e falha se divergirem.
rem ==========================================================================================
title fpmed (Trabalhador A - automatico)
cd /d C:\fpmed
if not exist C:\fpmed\logs mkdir C:\fpmed\logs
set INDICE=C:\fpmed\logs\motor_A.log
set CAIXA=C:\fpmed\caixas\CAIXA_A.md
set SESSAO=%RANDOM%
set /a N=0
set /a POUPADOS=0
echo ============================================================
echo   TRABALHADOR A - motor automatico
echo   caixa que manda    : %CAIXA%
echo   indice dos ciclos  : %INDICE%
echo   detalhe de cada um : C:\fpmed\logs\A_%SESSAO%_ciclo_N.log
echo   AGUARDE nao acorda o Claude - so releio a caixa a cada 10 min.
echo   LIMITE DO PLANO no log - espero 1 hora em vez de 10 min.
echo   NAO FECHE esta janela. Para parar, feche-a de proposito.
echo ============================================================
echo. >> "%INDICE%" 2>nul
echo ===== MOTOR A INICIADO em %date% %time% (sessao %SESSAO%, respira no AGUARDE) ===== >> "%INDICE%" 2>nul

:loop
rem == INICIO DO BLOCO DA RESPIRACAO =======================================================
rem  A catraca (tests/testa_motor_respira.js) RECORTA daqui ate o FIM e roda no cmd.exe DE
rem  VERDADE, contra caixas de mentira, em vez de ler o meu codigo e concordar comigo.
rem  /b = so casa no COMECO da linha. Sem isso, a linha de ajuda do cabecalho da caixa
rem  ("> SINAL: TRABALHE = executar a caixa inteira; AGUARDE = nada novo ...") poria o motor
rem  para dormir de caixa CHEIA - a palavra AGUARDE aparece dentro dela. Medido: sem o /b, o
rem  cmd responde DORME contra a CAIXA_A.md de verdade, que diz TRABALHE.
rem  E SE O findstr NAO CONSEGUIR LER A CAIXA (apagada, renomeada, disco ocupado) ele devolve
rem  codigo 2, e o motor CAI PARA O LADO DE TRABALHAR. "Nao consegui perguntar" nunca vira
rem  "esta em AGUARDE" - senao um arquivo sumido desligaria a fabrica em silencio.
findstr /b /i /c:"SINAL: AGUARDE" "%CAIXA%" >nul 2>&1
if not errorlevel 1 goto dormir
rem == FIM DO BLOCO DA RESPIRACAO ==========================================================

set /a N+=1
set CICLO=C:\fpmed\logs\A_%SESSAO%_ciclo_%N%.log
echo.
echo [%time%] ciclo %N% iniciado - trabalhando... (detalhe em %CICLO%)
echo [%date% %time%] ciclo %N% iniciado >> "%INDICE%" 2>nul
call claude -p --verbose --dangerously-skip-permissions "Voce e o Trabalhador A (janela fpmed). Leia C:\fpmed\caixas\CAIXA_A.md. Se o SINAL no topo for AGUARDE, responda apenas 'aguardando' e encerre. Se for TRABALHE: execute a caixa inteira no regime nao-parar do CLAUDE.md, grave o relatorio em C:\fpmed\relatorios\RELATORIO_A.md (acrescentando no topo) e, como ULTIMO ato, troque o SINAL da caixa para AGUARDE." > "%CICLO%" 2>&1
set CODIGO=%ERRORLEVEL%
echo [%date% %time%] ciclo %N% terminou codigo %CODIGO% (detalhe: %CICLO%) >> "%INDICE%" 2>nul

rem == INICIO DO BLOCO DO LIMITE DO PLANO ==================================================
rem  `findstr` devolve 0 quando ACHOU. As duas frases porque o texto ja apareceu nas duas
rem  formas ("weekly limit" e "usage limit"), e cobrar so uma seria a regra que cobre o que
rem  alguem lembrou de listar - a licao que o .gitignore desta casa ja conta quatro vezes.
rem  O `if exist` existe porque um ciclo que morreu antes de escrever nao pode virar um erro
rem  de findstr no meio do laco.
set ESPERA=600
set MOTIVO=nova leitura da caixa em 10 min
if exist "%CICLO%" (
  findstr /i /c:"weekly limit" /c:"usage limit" "%CICLO%" >nul 2>nul
  if not errorlevel 1 (
    set ESPERA=3600
    set MOTIVO=LIMITE DO PLANO detectado no log - esperando 1 hora em vez de 10 min
    echo [%date% %time%] ciclo %N%: LIMITE DO PLANO - esperando 3600s >> "%INDICE%" 2>nul
  )
)
rem == FIM DO BLOCO DO LIMITE DO PLANO =====================================================
echo [%time%] ciclo %N% terminado (codigo %CODIGO%) - %MOTIVO%
goto espera

:dormir
set ESPERA=600
set /a POUPADOS+=1
echo [%time%] caixa em AGUARDE - nao acordei o Claude (%POUPADOS% poupados nesta sessao) - releio em 10 min
echo [%date% %time%] AGUARDE - ciclo economizado (%POUPADOS%) >> "%INDICE%" 2>nul

:espera
timeout /t %ESPERA% /nobreak
goto loop
