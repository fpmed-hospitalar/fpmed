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
     LeitorEdital.perguntar({ texto, tarefa, pergunta, lote, parte, partes, paginas, documento })
       texto   (obrigatório) o texto extraído do edital
       tarefa  'resumo' (padrão) | 'itens'
       pergunta (opcional) a pergunta de quem está conversando com o edital
       documento (opcional, fatia A16) o que a janela de custo mostra como "o que vai ser lido":
                 uma string com o nome, ou { nome, tipo, chars, paginas }. Sem ele a janela diz
                 "o documento deste certame" e o tamanho sai do orçamento — nunca inventa nome.
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

  /* ══ A JANELA DE CUSTO, NO PADRÃO DO MOLDE (fatia A16, 14/08/2026 — aprovada pelo dono) ═══════
     Até aqui quem perguntava era o `confirm()` do navegador. Ele cumpria a função — bloqueante e
     impossível de não ver — e falhava na única coisa que um aviso de gasto não pode falhar: ele
     é uma caixa cinza do sistema operacional, com o endereço do site no topo, tipografia que não
     é a nossa e um "OK / Cancelar" que não diz o que vai acontecer. Do lado de quem paga, um
     aviso que parece do navegador parece do navegador — não do produto que vai cobrar.

     >>> ELA MORA NO MOTOR, E ISSO É A FATIA. A tentação era desenhar a janela na Encontrar, que
         é a tela que a pediu. Aí o Negócios precisaria da dele, e existiriam DUAS janelas de
         custo — que é o mesmo defeito da segunda conta de custo, um degrau acima: dois textos
         para o mesmo gasto, e um dia só um deles é corrigido. Estando aqui, a tela do B herda
         sem escrever uma linha, exatamente como herdou o portão.

     >>> O QUE ELA MOSTRA, E POR QUE CADA PEDAÇO:
         · o TÍTULO diz que é leitura com IA e que ela custa — nunca só "Confirmar?";
         · O QUE VAI SER LIDO (nome do documento e tamanho), porque "custa R$ 0,26" sem dizer
           sobre o quê não dá pra conferir: quem vê 173.557 caracteres entende o preço;
         · o VALOR EM DESTAQUE, que é a informação pela qual a janela existe;
         · a FRASE HONESTA: o número é TETO, e o cobrado é o medido. Sem ela o valor viraria
           promessa de preço, e a fatura menor (o caso comum) faria a pessoa desconfiar do aviso.
         · dois botões com o VERBO da ação — "Confirmar leitura" e "Cancelar", nunca "OK".

     >>> A COR NÃO NASCE AQUI. Toda declaração abaixo é `var(--token)` do `fpmed_tema.css`; não há
         um hex escrito à mão nesta janela, e há assert cobrando isso (testa_janela_custo). Uma
         janela nova é justamente onde uma segunda paleta costuma entrar no sistema. */

  var ID_ESTILO = 'fp-custo-estilo';

  /* z-index ACIMA DA ETIQUETA DO gm-auth (2147483000), que é `position:fixed` no canto superior
     direito. Sem isto o véu escureceria a tela inteira MENOS o e-mail de quem entrou — e a
     etiqueta ficaria clicável por cima de um diálogo modal, que é pior que feio. */
  var CSS_JANELA = [
    '.fp-custo-veu{position:fixed;inset:0;background:var(--veu);display:flex;align-items:center;',
    '  justify-content:center;padding:var(--esp-4);z-index:2147483100}',
    '.fp-custo-cx{width:100%;max-width:440px;padding:var(--esp-5);font-family:var(--fonte);',
    '  color:var(--cinza-800);background:var(--branco);border:1px solid var(--cinza-200);',
    '  border-radius:var(--raio-cartao);box-shadow:var(--sombra-3)}',
    '.fp-custo-tit{margin:0 0 var(--esp-2);font-size:var(--txt-4);font-weight:var(--peso-semi);',
    '  line-height:var(--altura-titulo);color:var(--cinza-800)}',
    '.fp-custo-doc{margin:0 0 var(--esp-4);font-size:var(--txt-2);line-height:var(--altura-texto);',
    '  color:var(--cinza-600)}',
    '.fp-custo-doc b{color:var(--cinza-800);font-weight:var(--peso-semi)}',
    '.fp-custo-preco{display:flex;align-items:baseline;gap:var(--esp-2);flex-wrap:wrap;',
    '  padding:var(--esp-3) var(--esp-4);background:var(--azul-50);',
    '  border:1px solid var(--azul-100);border-radius:var(--raio-campo);margin:0 0 var(--esp-3)}',
    '.fp-custo-preco-rot{font-size:var(--txt-1);font-weight:var(--peso-semi);letter-spacing:.04em;',
    '  text-transform:uppercase;color:var(--azul-800)}',
    '.fp-custo-preco-val{font-size:var(--txt-5);font-weight:var(--peso-forte);color:var(--azul-800);',
    '  font-variant-numeric:tabular-nums;line-height:var(--altura-titulo)}',
    '.fp-custo-nota{margin:0 0 var(--esp-5);font-size:var(--txt-1);line-height:var(--altura-texto);',
    '  color:var(--cinza-600)}',
    '.fp-custo-bts{display:flex;gap:var(--esp-2);justify-content:flex-end;flex-wrap:wrap}',
  ].join('\n');

  function garanteEstilo(doc) {
    if (doc.getElementById(ID_ESTILO)) return;
    var s = doc.createElement('style');
    s.id = ID_ESTILO;
    s.textContent = CSS_JANELA;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function nBR(v) { return Number(v).toLocaleString('pt-BR'); }

  /* O VALOR EM DESTAQUE sai do MESMO orçamento do servidor que a frase usa — não há um segundo
     lugar onde o número possa ficar diferente. Sem real, sai em dólar E DIZ que é dólar; o que
     nunca acontece é inventar uma cotação para poder escrever "R$". */
  function valorDoOrcamento(orc) {
    if (!orc) return null;
    if (orc.brl != null) {
      return 'R$ ' + Number(orc.brl).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (orc.usd != null) {
      return 'US$ ' + Number(orc.usd).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return null;
  }

  /* O TAMANHO É DO DOCUMENTO QUANDO A TELA O INFORMA, e do ORÇAMENTO quando ela não informa —
     nunca de uma terceira contagem. O `chars` do orçamento é o mesmo que foi mandado pro
     servidor, então os dois caminhos falam do mesmo texto. */
  function descreveDocumento(documento, orc) {
    var d = (typeof documento === 'string') ? { nome: documento } : (documento || {});
    var nome = (d.nome || d.titulo || '').toString().trim();
    var partes = [];
    var chars = d.chars != null ? d.chars : (orc && orc.chars != null ? orc.chars : null);
    if (chars != null) partes.push(nBR(chars) + ' caracteres');
    if (d.paginas) partes.push(nBR(d.paginas) + (Number(d.paginas) === 1 ? ' página' : ' páginas'));
    if (orc && orc.partes > 1) partes.push('lidos em ' + nBR(orc.partes) + ' partes');
    return { nome: nome || 'o documento deste certame', semNome: !nome, medida: partes.join(' · ') };
  }

  /* ══ O DIÁLOGO ═════════════════════════════════════════════════════════════════════════════
     A moldura nasce como MARKUP (nenhum dado dentro dela) e o dado entra por `textContent` —
     é a lição da fatia A10, e aqui ela vale em dobro: o nome do documento vem do PNCP, ou seja,
     de fora. Concatenar isso em `innerHTML` seria abrir um buraco no diálogo que existe pra
     proteger o dinheiro de quem clica. */
  function janelaDeCusto(texto, dados) {
    var doc = glob.document;
    /* SEM DOM (node, worker, teste) A RESPOSTA É NÃO — a mesma regra do `confirm` ausente que
       este bloco substituiu. Um portão que se abre sozinho quando não sabe perguntar não é
       portão, e o modo mais provável de não saber perguntar é justamente rodar fora da tela. */
    if (!doc || typeof doc.createElement !== 'function' || !(doc.body || doc.documentElement)) {
      return Promise.resolve(false);
    }
    var d = dados || {};
    var orc = d.orcamento || null;
    var valor = valorDoOrcamento(orc);
    var docInfo = descreveDocumento(d.documento, orc);

    garanteEstilo(doc);

    return new Promise(function (resolve) {
      var antes = doc.activeElement;
      var veu = doc.createElement('div');
      veu.className = 'fp-custo-veu';
      veu.setAttribute('role', 'dialog');
      veu.setAttribute('aria-modal', 'true');
      veu.setAttribute('aria-labelledby', 'fp-custo-tit');
      veu.innerHTML =
        '<div class="fp-custo-cx fp-sobreposto">'
        + '<h2 class="fp-custo-tit" id="fp-custo-tit">Confirmar leitura com IA</h2>'
        + '<p class="fp-custo-doc">Vou ler <b data-fp="nome"></b><span data-fp="medida"></span>.</p>'
        + '<div class="fp-custo-preco">'
        + '<span class="fp-custo-preco-rot">custa até</span>'
        + '<span class="fp-custo-preco-val" data-fp="valor"></span>'
        + '</div>'
        + '<p class="fp-custo-nota" data-fp="nota"></p>'
        + '<div class="fp-custo-bts">'
        + '<button type="button" class="fp-btn" data-fp="nao">Cancelar</button>'
        + '<button type="button" class="fp-btn fp-btn--principal" data-fp="sim">Confirmar leitura</button>'
        + '</div></div>';

      var q = function (n) { return veu.querySelector('[data-fp="' + n + '"]'); };
      q('nome').textContent = docInfo.nome;
      q('medida').textContent = docInfo.medida ? ' — ' + docInfo.medida : '';

      /* SEM PREÇO NÃO HÁ JANELA DE CONFIRMAÇÃO — o motor já barra antes (semOrcamento), então
         este caminho só existe pra quem trocar o confirmador e chamar a janela na mão. Ele diz
         a verdade em vez de mostrar um destaque vazio, e o botão de confirmar sai de cena. */
      if (valor) {
        q('valor').textContent = valor
          + (orc && orc.brl == null && orc.usd != null ? ' (sem cotação do dólar agora)' : '');
        q('nota').textContent = 'Esse valor é o TETO estimado desta leitura. O que for cobrado sai '
          + 'do consumo real medido na hora e fica registrado no seu histórico de uso.';
      } else {
        veu.querySelector('.fp-custo-preco').remove();
        q('nota').textContent = String(texto || 'não consegui calcular o custo desta leitura');
        q('sim').remove();
      }

      var vivo = true;
      function fecha(resposta) {
        if (!vivo) return;
        vivo = false;
        doc.removeEventListener('keydown', naTecla, true);
        if (veu.parentNode) veu.parentNode.removeChild(veu);
        try { if (antes && typeof antes.focus === 'function') antes.focus(); } catch (_) {}
        resolve(resposta);
      }
      function naTecla(ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); fecha(false); return; }
        /* PRENDE O TAB DENTRO DA JANELA. Sem isto o Tab sai pro resto da página, e a pessoa
           passa a operar uma tela que está atrás de um véu e não responde — parece travada. */
        if (ev.key !== 'Tab') return;
        var focaveis = veu.querySelectorAll('button');
        if (!focaveis.length) return;
        var pri = focaveis[0], ult = focaveis[focaveis.length - 1];
        if (ev.shiftKey && doc.activeElement === pri) { ev.preventDefault(); ult.focus(); }
        else if (!ev.shiftKey && doc.activeElement === ult) { ev.preventDefault(); pri.focus(); }
      }
      doc.addEventListener('keydown', naTecla, true);
      if (q('sim')) q('sim').addEventListener('click', function () { fecha(true); });
      q('nao').addEventListener('click', function () { fecha(false); });
      /* CLICAR NO VÉU CANCELA, e nunca confirma: a saída acidental de um diálogo de gasto tem
         que cair sempre do lado que não cobra. */
      veu.addEventListener('mousedown', function (ev) { if (ev.target === veu) fecha(false); });

      (doc.body || doc.documentElement).appendChild(veu);
      /* O FOCO VAI PRO "CANCELAR", DE PROPÓSITO — e é a única escolha desta janela que contraria
         o hábito (o costume é focar a ação primária). O motivo: aqui o Enter gasta dinheiro. Um
         Enter de sobra vindo de um campo de busca, ou a tecla ainda pressionada de um atalho,
         confirmaria um gasto que ninguém leu. Com o foco no "Cancelar", o pior acidente possível
         é não ler o edital; do outro lado, é pagar por uma leitura que ninguém pediu. */
      try { q('nao').focus(); } catch (_) {}
    });
  }

  /* QUEM PERGUNTA. É trocável de propósito: a tela que quiser um diálogo próprio põe o dela aqui,
     e o PORTÃO continua sendo deste motor. O padrão passou a ser a janela acima (fatia A16).
     >>> O CONFIRMADOR PODE DEVOLVER PROMESSA, e quem chama dá `await`. Foi o que a janela
         desenhada exigiu: o `confirm()` do navegador parava o mundo até a resposta, e um diálogo
         em DOM não para — ele responde depois. Um `await` num booleano continua valendo booleano,
         então um confirmador síncrono antigo segue funcionando sem mudar nada. */
  var confirmador = janelaDeCusto;

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
      /* O `await` É O QUE PERMITE A JANELA DESENHADA (A16). O primeiro argumento continua sendo a
         FRASE — quem trocou o confirmador por um diálogo próprio não quebra —, e o segundo leva
         o orçamento inteiro e o documento, que é do que a janela precisa pra mostrar o valor em
         destaque e dizer o que vai ser lido. */
      if (!(await confirmador(frasePreco(orc), { orcamento: orc, documento: o.documento || null }))) {
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
    janelaDeCusto: janelaDeCusto, // A JANELA DO MOLDE — uma só, herdada por toda tela (A16)
    urlDaEdge: urlDaEdge,
    TETO_MS: TETO_MS,
    // a tela que tiver um diálogo próprio troca ESTE campo; o portão continua sendo do motor
    get confirmador() { return confirmador; },
    set confirmador(fn) { if (typeof fn === 'function') confirmador = fn; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
