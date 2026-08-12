/* ══════════════════════════════════════════════════════════════════════════════
   FPMED · ALARME DA COLETA — "o índice está em dia?"

   ── A CICATRIZ QUE ESCREVEU ISTO (12/08/2026) ─────────────────────────────────
   A *Coleta PNCP* falhou 12 vezes seguidas entre 07 e 10/08 e voltou sozinha ao
   verde. Ninguém soube — nem quem depende do índice pra achar licitação.
   >>> "Falha que se conserta sozinha some do olhar." Ela não deixa rastro que
       alguém vá procurar, porque quando alguém olha, já está verde.

   ── FRONTEIRA (F9: o que entra e o que sai, em 3 linhas) ──────────────────────
   ENTRA:  a linha de `coleta_status` da fonte, e o instante de agora.
   SAI:    um veredito {nivel, titulo, detalhe} ou `null` quando está tudo em dia.
   NÃO FAZ: não busca dado, não lê banco, não pinta tela, não manda e-mail.

   ── POR QUE ARQUIVO PRÓPRIO, E NÃO DENTRO DA TELA ─────────────────────────────
   Porque a decisão "isto é alarme?" precisa ser TESTÁVEL sem navegador, e porque
   o mesmo veredito vai ser lido em dois lugares (o sino e o e-mail do dono).
   Duas cópias da regra divergiriam — e aí o sino diria uma coisa e o e-mail outra
   sobre o mesmo banco. É a mesma lição da barra do portal copiada em seis telas.

   ══════════════════════════════════════════════════════════════════════════════
   ── O QUE **NÃO** SERVE DE SINAL, E ISSO FOI MEDIDO, NÃO SUPOSTO ──────────────

   Estado REAL do banco em 12/08/2026, com o sistema SAUDÁVEL:

       ultima_ok      : NULL
       ultimo_erro    : "esgotou as tentativas"
       ultimo_dia_ok  : 2026-08-12  (hoje)
       licitações     : 962 publicadas em 11/08, 38 em 12/08

   Ou seja: um alarme preso em `ultima_ok` ou em `ultimo_erro` estaria **aceso
   agora**, com o índice em dia. E o próprio DDL do `ultimo_dia_ok` já tinha
   escrito o porquê: a janela não cabe no orçamento de 100 s da edge function,
   então rodada boa termina PARCIAL e `ultima_ok` segue NULL.

   >>> "Um aviso que está sempre aceso é um aviso que ninguém lê no dia em que a
       coleta falhar de verdade." O alarme que grita todo dia não é um alarme
       sensível: é um alarme quebrado que ainda não descobriram.

   ── ENTÃO O SINAL É O DADO, E NÃO A EXECUÇÃO ─────────────────────────────────
   Duas perguntas, e cada uma pega um apagão que a outra não pega:

     1. O ÍNDICE ESTÁ VELHO?   `ultimo_dia_ok` atrás de hoje por 2+ dias.
        Pega: coletor rodando e não fechando volta, cota derrubando tudo, fonte
        mudando de contrato. O dia de HOJE em curso não conta — ele está sendo
        varrido agora, e cobrar dia incompleto acenderia o alarme toda manhã.

     2. NEM TENTOU?            `ultima_tentativa` há mais de 12 h.
        Pega o que a (1) NÃO pega e é o pior caso: agendador desligado, projeto
        pausado, workflow removido, segredo expirado. Nesses o `ultimo_dia_ok`
        fica congelado num valor BOM por horas — o índice parece em dia porque
        ninguém está olhando pra ele.
        >>> 12 h e não 6 h: o cron roda 3× ao dia (09/15/21 UTC), então 6 h é o
            intervalo NORMAL e alarmaria em toda janela. 12 h significa que DUAS
            rodadas seguidas não aconteceram — o mesmo espírito do "2 falhas
            consecutivas" do lado do workflow.

   ── E O QUE **NUNCA** ALARMA, POR DECISÃO ────────────────────────────────────
   Fonte fora do ar. O `coleta-pncp.yml` já decidiu isso por escrito — *"um X
   vermelho diário treina qualquer um a ignorar o CI"* — e aqui vale igual: o
   PNCP cair é problema DELE, e enquanto o índice continuar novo, não há nada
   pra alguém fazer. Alarme só acende quando há AÇÃO possível de quem lê.
   ══════════════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  /* Os dois limites, num lugar só e com nome — número solto no meio do código é
     a coisa que ninguém sabe se pode mudar. */
  var DIAS_INDICE_VELHO = 2;    // ver (1) acima
  var HORAS_SEM_TENTAR  = 12;   // ver (2) acima

  /* Recebe a LINHA e o AGORA. O `agora` entra por parâmetro, e não por `new Date()`
     lá dentro, porque senão o teste não consegue perguntar "e daqui a 3 dias?" —
     e um alarme que só dá pra testar esperando 3 dias não é testado. */
  function avaliar(linha, agora) {
    if (!linha) {
      /* Sem linha nenhuma é "não sei", e não "está tudo bem". A tela que trata
         ausência como sucesso é a que fica muda no dia do apagão. */
      return { nivel: 'nao_sei', titulo: 'Não consegui ler o estado da coleta',
               detalhe: 'Sem essa leitura eu não sei se o índice está em dia.' };
    }
    var hoje = agora instanceof Date ? agora : new Date(agora);

    // ── (2) NEM TENTOU — vem primeiro porque é o mais grave: com o agendador
    //    parado, o carimbo de dia fica congelado num valor BOM e mente.
    var t = linha.ultima_tentativa ? new Date(linha.ultima_tentativa) : null;
    if (!t || isNaN(t)) {
      return { nivel: 'grave', titulo: 'A coleta nunca registrou tentativa',
               detalhe: 'Não há carimbo de última tentativa. O agendador provavelmente nunca rodou.' };
    }
    var horas = (hoje - t) / 36e5;
    if (horas >= HORAS_SEM_TENTAR) {
      return { nivel: 'grave', titulo: 'A coleta parou de rodar',
               detalhe: 'A última tentativa foi há ' + Math.floor(horas) + ' h. O agendador roda de 6 em 6 h — '
                      + 'duas janelas seguidas sem tentativa significa que ele não está rodando.',
               horas: Math.floor(horas) };
    }

    // ── (1) ÍNDICE VELHO
    if (!linha.ultimo_dia_ok) {
      return { nivel: 'atencao', titulo: 'O índice ainda não fechou um dia inteiro',
               detalhe: 'Nenhum dia foi coletado por completo até agora.' };
    }
    var dia = new Date(String(linha.ultimo_dia_ok) + 'T00:00:00Z');
    /* A conta é em DIAS DE CALENDÁRIO, em UTC dos dois lados — `ultimo_dia_ok` é
       `date` de propósito (o dia de publicação do edital), e comparar data com
       instante local é como se inventa fuso onde não há. */
    var hojeUTC = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
    var atraso = Math.floor((hojeUTC - dia.getTime()) / 864e5);
    if (atraso >= DIAS_INDICE_VELHO) {
      return { nivel: 'grave', titulo: 'O índice está atrasado',
               detalhe: 'O último dia coletado por inteiro foi ' + linha.ultimo_dia_ok
                      + ' — há ' + atraso + ' dias. Licitação publicada depois disso pode não estar na busca.',
               atraso: atraso };
    }
    return null;   // em dia
  }

  /* Uma linha curta pro e-mail e pro título do sino. Existe pra que os dois digam
     a MESMA frase — e não duas versões da mesma notícia. */
  function resumo(v) {
    return v ? (v.nivel === 'grave' ? '[COLETA] ' : '[coleta] ') + v.titulo : 'Coleta em dia';
  }

  var api = { avaliar: avaliar, resumo: resumo,
              DIAS_INDICE_VELHO: DIAS_INDICE_VELHO, HORAS_SEM_TENTAR: HORAS_SEM_TENTAR };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // suíte
  if (raiz) raiz.AlarmeColeta = api;                                           // telas
})(typeof window !== 'undefined' ? window : null);
