/* CATRACA 6/8 — testa_contraste (fatia A28, 15/08/2026)
   REPROVA: par de cor USADO pela tela abaixo de 4,5:1 (texto), 3:1 (texto grande e elemento
   não-textual).

   ══ ELA NÃO É A `testa_tema`, E A DIFERENÇA É O PONTO ═══════════════════════════════════════
   A `testa_tema` mede a PALETA: os 41 pares de token que o sistema publica passam em AA. Esta
   aqui mede o USO: o que a regra da TELA faz com esses tokens. Um sistema pode ter paleta
   impecável e uma tela que põe `--cinza-400` sobre `--cinza-100`, porque nada obriga o autor a
   usar o par que foi medido. Foi assim que o `--cinza-500` chegou à linha selecionada: ele
   passa por 0,05 sobre o BRANCO, e a linha selecionada não é branca (4,14:1 — reprovava).

   ══ AS TRÊS RÉGUAS, E AS DUAS ISENÇÕES, TODAS DECLARADAS ════════════════════════════════════
   · texto normal ......... 4,5:1   (WCAG 1.4.3)
   · texto grande ......... 3:1     (≥24px, ou ≥18,5px em negrito)
   · elemento NÃO-TEXTUAL . 3:1     (WCAG 1.4.11 — ícone que informa, trilho, fio)
   · COMPONENTE DESLIGADO . isento  (1.4.3 isenta componente inativo — e a razão é de produto,
     não de norma: botão desligado precisa PARECER desligado. "Consertar" isso escurecendo o
     texto apagaria a única pista de que ele não funciona, que é fabricar o "botão que não faz
     nada" da lista de denúncias.)
   · par NÃO RESOLVÍVEL ... declarado, nunca aprovado. Fundo herdado do pai ou montado em JS não
     dá para medir sem a tela pintada — e eu não logo. Contar como aprovado seria a mentira por
     omissão que a BASE proíbe; por isso ele sai NOMEADO no relatório da catraca.

   ══ O DEFEITO QUE ESTA CATRACA NASCEU CORRIGINDO EM SI MESMA ════════════════════════════════
   A primeira versão da régua acusou 6 reprovações; QUATRO eram ela cobrando o número errado
   (ícone medido por 4,5 e três componentes desligados). Régua antes do número, e a régua estava
   errada — o registro inteiro está em tools/regua_visual.js.

     node tests/testa_contraste.js
   ──────────────────────────────────────────────────────────────────────────────────────────── */
'use strict';
const { catraca, onde } = require('./catraca.js');

const regra = ({ arquivo, r, ok }) => {
  const c = r.contraste;
  ok('todo par de cor usado por ' + arquivo + ' passa na régua dele ('
    + (c.pares.length + c.naoTexto.length) + ' medidos, ' + c.reprovados.length + ' reprovados)',
    c.reprovados.length === 0,
    c.reprovados.length
      ? onde(arquivo, c.reprovados, a => a.razao + ':1 (mínimo ' + a.minimo + ') — '
          + a.cor + ' sobre ' + a.fundo + '  em `' + a.seletor.replace(/^['",\s]+/, '') + '`') : '');

  if (c.naoTexto.length) {
    ok(arquivo + ': ' + c.naoTexto.length + ' par(es) NÃO-TEXTUAL(is) medidos por 3:1 (WCAG '
      + '1.4.11) — ' + c.naoTexto.map(x => x.razao).join(' · '), true);
  }
  if (c.desligados.length) {
    ok(arquivo + ': ' + c.desligados.length + ' par(es) de componente DESLIGADO — isentos por '
      + 'WCAG 1.4.3, e de propósito: desligado precisa parecer desligado', true);
  }
  /* O NÃO MEDIDO SAI COM NOME E LINHA. Ele não reprova (não dá para reprovar o que não se
     mediu) e não passa (não dá para aprovar o que não se mediu): ele fica visível, que é a
     terceira resposta honesta e a única correta aqui. */
  if (c.naoMedidos.length) {
    ok(arquivo + ': ' + c.naoMedidos.length + ' par(es) que só a tela pintada responderia '
      + '(fundo herdado ou montado em JS) — ' + c.naoMedidos.slice(0, 6)
        .map(x => 'L' + x.linha + ' `' + String(x.seletor).replace(/^['",\s]+/, '') + '`').join(' · '),
      true);
  }
};
regra.conta = r => r.contraste.reprovados.length + ' reprovado(s) de '
  + (r.contraste.pares.length + r.contraste.naoTexto.length) + ' medidos';

catraca('testa_contraste', 'AA medido no USO, e não só na paleta', regra);
