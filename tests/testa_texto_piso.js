/* CATRACA 3/8 — testa_texto_piso (fatia A28, 15/08/2026)
   REPROVA: `font-size` abaixo de 12px em tela — escrito em pixel OU vindo de um token que vale
   menos que o piso.

   ══ O PISO FURADO POR TOKEN É O QUE NINGUÉM VÊ ══════════════════════════════════════════════
   Esta é a lição que o trabalhador B pagou na régua dele: uma primeira versão contava só
   `font-size:<n>px` e devolveu "0 abaixo do piso" na Ajuda — atestado de saúde falso. A Ajuda
   usa `font-size:var(--txt-0)`, e `--txt-0` vale 10px. Quem procura número nunca acha.

   ══ A RAZÃO DO PISO É MEDIDA, NÃO ESTÉTICA ══════════════════════════════════════════════════
   Abaixo de 12px o dado deixa de ser legível para parte da equipe, e este sistema imprime preço
   de medicamento. Cor errada se percebe; número lido errado, não. Por isso a catraca é mais
   dura justamente onde há NÚMERO: contador de filtro, pastilha de prazo, porcentagem de
   aderência e cabeçalho de tabela estavam todos a 10px nesta casa até a fatia A28.

   ══ AS DUAS EXCEÇÕES, E POR QUE SÓ ELAS ═════════════════════════════════════════════════════
   1. `@media print` — no papel o piso de tela não vale. Vai para coluna própria, não some.
   2. `--txt-0` (10px) ACOMPANHADO de letra espaçada ≥ 0,1em. É o ofício declarado pelo tema:
      "rótulo de GRUPO, caixa alta e espaçado — nada mais". A condição cobrada é o ESPAÇAMENTO e
      não o `text-transform`, porque a caixa alta pode vir do conteúdo ("HOSPITALAR" escrito
      assim no HTML) — cobrar a propriedade em vez do fato manda consertar quem já obedece.

     node tests/testa_texto_piso.js
   ──────────────────────────────────────────────────────────────────────────────────────────── */
'use strict';
const { catraca, onde, R } = require('./catraca.js');

const regra = ({ arquivo, r, ok }) => {
  ok('nada abaixo de ' + R.PISO_TEXTO + 'px em tela, em ' + arquivo
    + ' (' + r.texto.tela.length + ' abaixo)',
    r.texto.tela.length === 0,
    r.texto.tela.length
      ? onde(arquivo, r.texto.tela, a => a.valor + 'px'
          + (a.viaToken ? ' POR TOKEN (invisível para quem procura número)' : '')
          + '  em `' + a.seletor + '`')
      : '');
  /* A exceção sai NOMEADA, com o espaçamento medido de cada uso. Exceção contada em voz alta é
     decisão; exceção silenciosa é o furo de amanhã. */
  if (r.texto.rotuloGrupo.length) {
    ok(arquivo + ': ' + r.texto.rotuloGrupo.length + ' uso(s) legítimo(s) do --txt-0 — '
      + r.texto.rotuloGrupo.map(x => x.seletor.replace(/^['",\s]+/, '') + ' (' + x.espacamento + 'em)').join(' · '),
      true);
  }
  if (r.texto.papel.length) {
    ok(arquivo + ': ' + r.texto.papel.length + ' tamanho(s) pequeno(s) no PAPEL (@media print — '
      + 'outra mídia, e o piso de tela não vale lá)', true);
  }
};
regra.conta = r => r.texto.tela.length + ' abaixo do piso ('
  + r.texto.tela.filter(x => x.viaToken).length + ' por token)';

catraca('testa_texto_piso', 'piso de 12px, e o furo por token também conta', regra);
