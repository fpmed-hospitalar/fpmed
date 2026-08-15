/* CATRACA 2/8 — testa_espaco_token (fatia A28, 15/08/2026)
   REPROVA: espaço (`padding`/`margin`/`gap`) fora da grade que o tema publica.

   ══ A GRADE É LIDA DO TEMA, NÃO ESCRITA AQUI ════════════════════════════════════════════════
   `fpmed_tema.css` publica `--esp-1..6` (4·8·12·16·20·24) mais 32, 48 e 64. Escrever a lista
   nesta catraca criaria a SEGUNDA grade do sistema, e no dia em que o tema ganhasse um degrau a
   catraca reprovaria o uso legítimo dele. Quem guarda a integridade do tema é a `testa_tema`
   (assert 16: todo `--esp-*` é múltiplo de 4; assert 17: `--esp-N` vale N×4).

   ══ POR QUE SÓ ESPAÇO, E NÃO LARGURA/ALTURA ═════════════════════════════════════════════════
   Porque a régua tem de contar o que diz que conta. Largura de coluna, altura de linha e
   posição não são espaçamento: se entrassem, o número inflaria com peças que a regra da grade
   nunca quis governar, e o defeito real ficaria escondido no meio.

   ══ E POR QUE "QUASE ALINHADO É PIOR QUE DESALINHADO" ═══════════════════════════════════════
   Um `margin-top:9px` ao lado de um `--esp-2` (8px) não parece errado em lugar nenhum — parece
   errado em TODO lugar, um pixel de cada vez, e ninguém sabe nomear o que está incomodando.

     node tests/testa_espaco_token.js
   ──────────────────────────────────────────────────────────────────────────────────────────── */
'use strict';
const { catraca, onde, R } = require('./catraca.js');

const regra = ({ arquivo, r, ok }) => {
  ok('todo espaço de ' + arquivo + ' está na grade ' + R.GRADE.join('·')
    + ' (' + r.espaco.tela.length + ' fora)',
    r.espaco.tela.length === 0,
    r.espaco.tela.length ? onde(arquivo, r.espaco.tela, a => a.prop + ':' + a.valor + 'px') : '');
  /* O PAPEL TEM COLUNA PRÓPRIA e não some: `@media print` é outro meio, com outra régua de
     espaço (milímetro, não pixel de tela). Somar era o erro de origem desta casa; excluir em
     silêncio seria o erro simétrico. */
  if (r.espaco.papel.length) {
    ok(arquivo + ': o espaço do PAPEL está declarado à parte (' + r.espaco.papel.length
      + ' valor(es) em @media print — outra mídia, outra régua)', true);
  }
};
regra.conta = r => r.espaco.tela.length + ' fora da grade';

catraca('testa_espaco_token', 'a grade de 8, e só os degraus que o tema publica', regra);
