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

  glob.LeitorEdital = { perguntar: perguntar, urlDaEdge: urlDaEdge, TETO_MS: TETO_MS };
})(typeof window !== 'undefined' ? window : globalThis);
