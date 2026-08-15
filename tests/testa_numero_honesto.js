/* CATRACA 8/8 — testa_numero_honesto (fatia A28, 15/08/2026)
   REPROVA: `R$ 0,00` exibido como preço quando o dado é ausente — nas três formas em que essa
   mentira entra num arquivo.

   ══ POR QUE ESTA É A CATRACA MAIS IMPORTANTE DAS OITO ═══════════════════════════════════════
   As outras sete guardam a aparência. Esta guarda a VERDADE, e o defeito que ela persegue já
   aconteceu aqui: 7.456 itens exibiam R$ 0,00 na tela onde se decide preço. Zero não é preço;
   ausência não é zero; "não sei" nunca vira 0,00. Um edital sem valor de referência publicado e
   um edital com valor de referência zero são fatos DIFERENTES, e a tela que os desenha iguais
   faz alguém baixar o preço até um chão que não existe.
   >>> E MEDIDO NO BANCO, os dois casos são comuns: de 96.163 itens, 16.822 são de orçamento
       sigiloso e 18.865 vêm com valor ZERO gravado (a coleta grava 0 quando o PNCP não publica
       preço — é `= 0`, não `IS NULL`, e a consulta por `is.null` devolve zero linha).

   ══ AS TRÊS FORMAS, E POR QUE AS TRÊS ═══════════════════════════════════════════════════════
   a) O LITERAL `R$ 0,00` escrito na tela. O caso óbvio, e o mais raro.
   b) `|| 0` ou `?? 0` COSTURADO DENTRO da chamada que formata dinheiro. É aqui que "não sei"
      vira zero sem ninguém decidir: `brl(x || 0)` parece defensivo e é uma afirmação.
   c) `(x || 0).toFixed(2)` — o mesmo, um passo antes da formatação.

   ══ E ELA COBRA O CONTRÁRIO TAMBÉM ══════════════════════════════════════════════════════════
   Catraca que só PROÍBE ensina a esconder: some o zero, e no lugar dele fica um traço mudo ou
   uma célula vazia, que mente igual. Toda tela que exibe dinheiro precisa TER escrita a frase
   de ausência — "não informado", "sem referência", "sigiloso". A alternativa honesta tem de
   existir no arquivo, senão a proibição não tem para onde mandar o autor.

   ══ O DEFEITO QUE A PRÓPRIA RÉGUA TINHA ═════════════════════════════════════════════════════
   A primeira versão acusou duas mentiras na Encontrar. As duas eram COMENTÁRIOS explicando o
   bug do calibre French ("virava R$ 0,03 por sonda") — e ela as pegou porque aceitava `R$ 0,0`
   seguido de qualquer coisa. Zero seguido de centavo é um PREÇO, e um preço de oito décimos de
   centavo é exatamente o que a unitarização produz. A régua estava chamando de mentira o número
   mais honesto do arquivo.

     node tests/testa_numero_honesto.js
   ──────────────────────────────────────────────────────────────────────────────────────────── */
'use strict';
const { catraca, onde } = require('./catraca.js');

const regra = ({ arquivo, r, ok }) => {
  ok('zero "R$ 0,00" como preço em ' + arquivo + ' (' + r.numero.mentiras.length + ')',
    r.numero.mentiras.length === 0,
    r.numero.mentiras.length
      ? onde(arquivo, r.numero.mentiras, a => '[' + a.forma + '] ' + a.trecho) : '');

  if (r.numero.exibeDinheiro) {
    ok(arquivo + ' exibe dinheiro E tem a frase de ausência escrita (a alternativa honesta '
      + 'precisa existir, senão a proibição não tem para onde mandar o autor)',
      r.numero.temFraseHonesta,
      arquivo + ': nenhuma de "não informado / sem referência / sigiloso / não publicado" '
      + 'aparece no arquivo — a tela sabe proibir o zero e não sabe dizer o que houve');
  } else {
    ok(arquivo + ': não exibe dinheiro — a regra do preço não se aplica', true);
  }
};
regra.conta = r => r.numero.mentiras.length + ' mentira(s)'
  + (r.numero.exibeDinheiro ? (r.numero.temFraseHonesta ? '' : ' · SEM frase de ausência') : ' · sem dinheiro');

catraca('testa_numero_honesto', 'zero não é preço, e ausência não é zero', regra);
