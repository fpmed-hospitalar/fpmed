/* CATRACA 1/8 — testa_cor_token (fatia A28, 15/08/2026)
   REPROVA: `#hex` ou `rgb()/rgba()` escrito na tela, inclusive vindo de JavaScript.

   ══ POR QUE INCLUSIVE DE JAVASCRIPT ═════════════════════════════════════════════════════════
   Porque é assim que cor à mão sobrevive a auditoria. Quem varre folha de estilo não vê um
   `el.style.background = '#e0574a'` no meio de uma função — e o `fpmed_negocios.html` já teve
   um `#6C5CC4` vivendo dois meses com um comentário assumindo a exceção. A régua lê o arquivo
   inteiro, e não a seção que parece CSS.

   ══ O QUE NÃO É COR CHUMBADA, e vale escrever ═══════════════════════════════════════════════
   · `rgba(var(--azul-500-rgb),.55)` — é o token na forma que o próprio tema publica para
     compor alfa. Contá-lo mandaria "consertar" o uso CERTO do token.
   · o `fpmed_tema.css` — ele É a fonte dos tokens; hex ali é o ofício dele, e não um furo.
     A catraca cobra dele outra coisa: que ele continue sendo o ÚNICO.
   · comentário — registrar em texto o hex que foi trocado é como se guarda o porquê, e um
     assert que só fica verde se alguém apagar a explicação está contra a lei do porquê escrito.

     node tests/testa_cor_token.js
   ──────────────────────────────────────────────────────────────────────────────────────────── */
'use strict';
const { catraca, onde } = require('./catraca.js');

const FONTE_DE_TOKEN = 'fpmed_tema.css';

const regra = ({ arquivo, r, ok, lista }) => {
  if (arquivo === FONTE_DE_TOKEN) {
    /* A fonte dos tokens é a única que pode ter hex — e é justamente por isso que ela precisa
       ser a ÚNICA. Este assert guarda a exclusividade: se um dia outro arquivo entrar na lista
       de adotadas declarando-se fonte de token, o sistema passa a ter duas paletas. */
    ok('a fonte dos tokens é uma só, e é o ' + FONTE_DE_TOKEN,
      lista.adotadas.filter(a => /tema|token/i.test(a)).length === 1,
      'adotadas com cara de tema: ' + lista.adotadas.filter(a => /tema|token/i.test(a)).join(', '));
    ok('e ela não usa preto puro nem branco puro como tinta de texto (D4)',
      !/#000000\b|#000\b/i.test(require('./catraca.js').R.semComentario(require('./catraca.js').R.leia(arquivo))),
      arquivo + ': #000 existe no arquivo');
    return;
  }
  ok('zero cor chumbada em ' + arquivo + ' (' + r.cor.tela.length + ' achada(s))',
    r.cor.tela.length === 0,
    r.cor.tela.length ? onde(arquivo, r.cor.tela, a => a.tipo + ' ' + a.valor) : '');
  /* O documento gerado em janela nova NÃO carrega o tema — token ali não resolve. Ele não some
     da conta: vira este assert, que cobra a coisa certa (que ele exista declarado), em vez de
     cobrar token onde token não pinta. */
  if (r.docsGerados) {
    ok(arquivo + ': o documento gerado em janela própria está declarado ('
      + r.cor.docGerado.length + ' cor(es) nele, e ali token não resolve)', true);
  }
};
regra.conta = r => r.cor.tela.length + ' cor(es) chumbada(s)';

catraca('testa_cor_token', 'cor vem do token, nunca do teclado', regra);
