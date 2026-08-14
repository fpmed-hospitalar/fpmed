/* ══════════════════════════════════════════════════════════════════════════════════════════
   fpmed_leitor_motor.js — A PORTA INTERNA DO LEITOR DE EDITAL (fatia A2, 14/08/2026)

   O "Leitor de edital" deixou de ser destino do menu por decisão do dono. Ele NÃO foi
   desligado: virou motor chamável de dentro de outras telas — a primeira será o detalhe do
   pregão na Encontrar (fatia A4), depois o Negócios (via o contrato da fatia A5).

   ══ O QUE ESTE ARQUIVO É, E O QUE ELE DELIBERADAMENTE NÃO É ═══════════════════════════════
   Ele é UMA PORTA, não uma segunda implementação. O motor de verdade é a edge function
   `ler-edital`, e é lá — no servidor — que vivem as três coisas que a fatia manda preservar:

     · A PERMISSÃO ....... lista explícita de e-mail conferida contra o JWT; sem token válido
                           e sem estar na lista, responde 403 e não há leitura.
     · O CUSTO ........... contado a partir do `usage` real da resposta do modelo, incluindo
                           leitura que falhou DEPOIS de consumir token.
     · O REGISTRO ........ gravação em `usos_ia`, com o cuidado já escrito lá de não deixar
                           custo consumido e não cobrado.

   >>> POR ISSO ESTE MÓDULO NÃO REPETE NADA DISSO. Se ele tivesse a sua própria checagem de
       permissão ou o seu próprio cálculo de custo, existiriam DUAS respostas para "quem pode
       ler?" e "quanto custou?" — e um dia elas discordariam, num número que vira fatura.
       Chamar a mesma porta é o que garante que o regime continua "exatamente como está".

   >>> E ELE NÃO REIMPLEMENTA A PARTIÇÃO DE PDF. Quebrar um edital de 80 páginas em partes,
       costurar as respostas e juntar os resumos é trabalho pesado que vive na tela do Leitor
       e está testado lá. Quem chama daqui manda TEXTO JÁ EXTRAÍDO — que é exatamente o que a
       fatia A6 vai guardar por licitação. Duplicar a partição seria duplicar o gasto.

   ══ CONTRATO (o mesmo corpo que a tela do Leitor monta, sem dialeto novo) ═════════════════
     LeitorEdital.perguntar({ texto, tarefa, pergunta, lote, parte, partes, paginas })
       texto   (obrigatório) o texto extraído do edital
       tarefa  'resumo' (padrão) | 'itens'
       pergunta (opcional) a pergunta de quem está conversando com o edital
     devolve a resposta JSON da edge function.
     Erros que o chamador PRECISA distinguir, e por isso vêm marcados no objeto de erro:
       e.semPermissao ..... 403: não é falha, é "você não está na lista" — a tela deve dizer
                            isso com todas as letras, nunca "deu erro".
       e.semSessao ........ não há token: entrar de novo resolve.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';

  /* A URL SAI DA CONFIG, e não é escrita aqui: uma segunda cópia do endereço do banco é a
     mesma doença que este arquivo inteiro existe pra evitar.

     ══ `banco`, E NÃO `supabase` — O CAMINHO PRINCIPAL NUNCA CASOU (conserto de 14/08, A14) ══
     Este arquivo nasceu procurando `LIMEDTEC_CLIENTE.supabase.url`, e a chave do
     `cliente.config.js` sempre se chamou `banco`:
         banco: { url: '…', anonKey: '…' }
     >>> E O DEFEITO NÃO GRITOU, QUE É O PIOR JEITO DE ERRAR: um caminho de configuração que
         nomeia uma chave inexistente não estoura — ele cai calado pro próximo `||`. Então o
         motor passou a depender do `window.SB_URL`, que só existe na tela que se lembrar de
         escrever a linha. Duas telas esqueceram (Negócios e Encontrar), e nas duas a conversa
         com o edital morria em "não sei o endereço" — um sintoma que não aponta pra cá.
     O `supabase.url` FICA na lista, atrás do certo: se algum cliente já tiver a config no
     formato antigo, tirá-lo quebraria a instalação dele pra consertar um nome. */
  function urlDaEdge() {
    var c = glob.LIMEDTEC_CLIENTE || {};
    var base = (c.banco && c.banco.url)
      || (c.supabase && c.supabase.url)
      || glob.SB_URL || (glob.gmAuth && glob.gmAuth.SB) || '';
    if (!base) return null;
    return String(base).replace(/\/$/, '') + '/functions/v1/ler-edital';
  }

  /* O TOKEN É O DA SESSÃO VIVA, lido do gm-auth. Ele é o que carrega a identidade que a edge
     function confere contra a lista — então "quem pode ler" continua sendo decidido lá. */
  function tokenDaSessao() {
    try {
      if (glob.gmAuth && glob.gmAuth.session && glob.gmAuth.session.access_token) return glob.gmAuth.session.access_token;
      if (glob.gmAuth && typeof glob.gmAuth.token === 'function') return glob.gmAuth.token();
      if (glob.gmAuth && glob.gmAuth.token) return glob.gmAuth.token;
    } catch (_) {}
    return null;
  }

  /* 10 MINUTOS, o mesmo teto da tela do Leitor. Edital longo demora, e cortar antes da hora
     joga fora uma leitura que JÁ FOI COBRADA — o pior dos dois mundos. */
  var TETO_MS = 600000;

  /* ══ O CUSTO ÀS CLARAS — DECISÃO DO DONO EM 14/08 (fatia A12) ══════════════════════════════
     "A conversa com o edital FICA, com os clientes cientes do custo." Ou seja: antes de CADA
     leitura, a pessoa vê quanto vai custar e diz sim.

     >>> O ORÇAMENTO NÃO É CALCULADO AQUI. Ele é PEDIDO ao servidor, que é quem tem a tabela de
         preço, o modelo e o teto de saída. O contrato deste motor é literal — *não escreva uma
         segunda conta de custo do seu lado* — e uma estimativa feita no navegador seria
         exatamente isso: um número que aparece na pergunta e outro que vira fatura. No dia em
         que o preço da Anthropic mudasse, só um dos dois seria corrigido, e o anúncio ficaria
         mais barato que a cobrança sem ninguém notar até o fechamento do mês.
     >>> E O PEDIDO DE ORÇAMENTO NÃO GASTA NADA: ele sai da edge function antes da chamada à IA,
         e não escreve em `usos_ia`. Cancelar custa zero, e o zero é estrutural. */
  async function orcar(opcoes) {
    var o = opcoes || {};
    var url = urlDaEdge();
    if (!url) throw new Error('não sei o endereço do serviço de leitura (config não carregada)');
    var tok = tokenDaSessao();
    if (!tok) { var es = new Error('sua sessão expirou — entre de novo e tente outra vez'); es.semSessao = true; throw es; }
    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify({
        orcar: true,
        chars: o.chars != null ? Number(o.chars) : String(o.texto || '').length,
        tarefa: o.tarefa === 'itens' ? 'itens' : (o.tarefa || 'resumo'),
        partes: o.partes || 1,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (r.status === 403) { var e4 = new Error('leitura de edital não liberada para este usuário'); e4.semPermissao = true; throw e4; }
    if (!r.ok) throw new Error('não consegui orçar a leitura (' + r.status + ')');
    var j = JSON.parse(await r.text());
    return j.orcamento || null;
  }

  /* A FRASE, montada num lugar só. Ela diz "ATÉ", e o "até" é a verdade: o número é o teto, não
     a média — a saída da IA varia muito (medido: 213 a 8.878 tokens na mesma tarefa) e anunciar
     a média faria a cobrança passar do anunciado em metade das vezes. */
  function frasePreco(orc) {
    if (!orc) return 'não consegui calcular o custo desta leitura';
    /* VÍRGULA DECIMAL, e isso não é preciosismo de idioma: "R$ 0.26" lido por quem escreve
       "0,26" a vida inteira passa por vinte e seis, e o aviso de custo é o último lugar do
       sistema onde alguém pode ler um número errado. */
    var valor = orc.brl != null
      ? 'R$ ' + Number(orc.brl).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : 'US$ ' + Number(orc.usd).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        + ' (não consegui a cotação do dólar agora)';
    return 'Esta leitura custa até ' + valor + '.\n\n'
      + 'São ' + Number(orc.chars).toLocaleString('pt-BR') + ' caracteres de edital'
      + (orc.partes > 1 ? ', lidos em ' + orc.partes + ' partes' : '')
      + ' — cerca de ' + Number(orc.tokensEntrada).toLocaleString('pt-BR') + ' tokens de entrada.\n'
      + 'O valor é o TETO: o que for cobrado sai do consumo real e fica registrado.\n\n'
      + 'Confirmar a leitura?';
  }

  /* QUEM PERGUNTA. É trocável de propósito: a tela que tiver um diálogo bonito põe o dela aqui,
     e o PORTÃO continua sendo deste motor. O padrão é o `confirm` do navegador — feio, porém
     bloqueante e impossível de não ver, que é exatamente o que um aviso de gasto precisa ser.
     >>> SEM `confirm` DISPONÍVEL (node, worker), a resposta é NÃO. Um portão que se abre sozinho
         quando não sabe perguntar não é portão. */
  var confirmador = function (texto) {
    return (typeof glob.confirm === 'function') ? !!glob.confirm(texto) : false;
  };

  async function perguntar(opcoes) {
    var o = opcoes || {};
    if (!o.texto || !String(o.texto).trim()) {
      var ev = new Error('não há texto de edital para ler');
      ev.semTexto = true;
      throw ev;
    }
    var url = urlDaEdge();
    if (!url) throw new Error('não sei o endereço do serviço de leitura (config não carregada)');

    var tok = tokenDaSessao();
    if (!tok) { var es = new Error('sua sessão expirou — entre de novo e tente outra vez'); es.semSessao = true; throw es; }

    /* ══ O PORTÃO DO GASTO ═════════════════════════════════════════════════════════════════════
       Ele é LIGADO POR PADRÃO, e essa é a decisão que importa: quem chamar sem passar por aqui
       não gasta calado — precisa DIZER `confirmado: true`, o que aparece na revisão de código.
       O contrário (portão que a tela liga se lembrar) é o desenho em que a primeira tela nova
       gasta sem avisar e ninguém descobre até a fatura. */
    if (o.confirmado !== true) {
      var orc = null;
      try {
        orc = await orcar({ texto: o.texto, chars: String(o.texto).length, tarefa: o.tarefa, partes: o.partes });
      } catch (eo) {
        if (eo && (eo.semPermissao || eo.semSessao)) throw eo;
        /* NÃO SEI QUANTO CUSTA -> NÃO GASTO. A saída fácil seria seguir sem o aviso "pra não
           travar o usuário", e ela é a errada: o que estaria sendo pulado é justamente a parte
           que o dono mandou existir. */
        var ec = new Error('não consegui calcular o custo desta leitura — não vou gastar sem te dizer quanto custa');
        ec.semOrcamento = true;
        throw ec;
      }
      if (!confirmador(frasePreco(orc))) {
        var ex = new Error('leitura cancelada por você — nada foi cobrado');
        ex.cancelado = true;
        throw ex;
      }
    }

    var corpo = {
      modo: 'texto',
      texto: String(o.texto),
      tarefa: o.tarefa === 'itens' ? 'itens' : 'resumo',
      lote: o.lote || null,
      parte: o.parte || 1,
      partes: o.partes || 1,
      paginas: o.paginas || null,
      chars: String(o.texto).length,
    };
    if (o.pergunta) corpo.pergunta = String(o.pergunta);

    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TETO_MS),
    });
    var txt = await r.text();
    /* O 403 É TRATADO À PARTE PORQUE ELE NÃO É FALHA. "Você não está na lista de quem pode
       gastar isto" é uma resposta legítima do produto, e mostrá-la como "erro no serviço"
       faria a pessoa reportar defeito e alguém procurar bug que não existe. */
    if (r.status === 403) { var e4 = new Error('leitura de edital não liberada para este usuário'); e4.semPermissao = true; throw e4; }
    if (!r.ok) throw new Error('o serviço de leitura respondeu ' + r.status + ' — ' + txt.slice(0, 160));
    return JSON.parse(txt);
  }

  glob.LeitorEdital = {
    perguntar: perguntar,
    orcar: orcar,                 // "quanto vai custar?" — sem gastar nada
    frasePreco: frasePreco,       // a frase do aviso, montada num lugar só
    urlDaEdge: urlDaEdge,
    TETO_MS: TETO_MS,
    // a tela que tiver um diálogo próprio troca ESTE campo; o portão continua sendo do motor
    get confirmador() { return confirmador; },
    set confirmador(fn) { if (typeof fn === 'function') confirmador = fn; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
