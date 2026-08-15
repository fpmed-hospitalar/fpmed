/* CATRACA 7/8 — testa_tabela_densa (fatia A28, 15/08/2026)
   REPROVA: cabeçalho que não fica fixo ao rolar · coluna alinhada à direita sem dígito tabular ·
   zebra em tabela interativa · altura de linha fora das duas densidades da casa (40 e 48).

   ══ A TABELA DENSA É O CORAÇÃO DESTE PRODUTO ════════════════════════════════════════════════
   O gestor compara 500 itens. Cada uma das quatro regras abaixo existe porque a falta dela
   custa TEMPO DELE, e não porque fica bonito:

   · CABEÇALHO FIXO — rolou trinta linhas, perdeu a legenda. Sem ele o operador rola de volta
     para lembrar qual coluna é "valor unitário" e qual é "teto CMED". Numa tela onde se decide
     preço, ler a coluna errada é o erro caro.
   · DÍGITO TABULAR — sem `tabular-nums` os algarismos têm larguras diferentes e a coluna de R$
     dança a cada linha. Comparar preço coluna a coluna deixa de funcionar; é o único jeito de
     uma coluna de dinheiro ficar inútil sem parecer quebrada.
   · ZEBRA NÃO — listra briga com o hover e com a seleção. Numa tabela onde a linha ativa e a
     linha sob o mouse têm cor própria (e elas têm: `--linha-hover` e `--linha-ativa`), a zebra
     ganha da seleção em metade das linhas e some na outra metade.
   · DUAS DENSIDADES, E SÓ DUAS — 40px compacta, 48px confortável. Três alturas não é escolha, é
     falta de decisão: quem abre a tela não sabe qual das três é a "certa".

   ══ E ELA SÓ JULGA ARQUIVO QUE TEM TABELA ═══════════════════════════════════════════════════
   Cobrar cabeçalho fixo de uma tela sem `<table>` é a catraca inventando defeito para ter o que
   dizer. Arquivo sem tabela sai declarado como "sem tabela", que é a verdade.

     node tests/testa_tabela_densa.js
   ──────────────────────────────────────────────────────────────────────────────────────────── */
'use strict';
const { catraca, R } = require('./catraca.js');

const regra = ({ arquivo, r, ok }) => {
  if (!r.tabela.temTabela) {
    ok(arquivo + ': sem tabela — as quatro regras da tabela densa não se aplicam', true);
    return;
  }
  ok('a tabela de ' + arquivo + ' obedece às ' + 4 + ' regras da tabela densa ('
    + r.tabela.defeitos.length + ' defeito(s))',
    r.tabela.defeitos.length === 0,
    r.tabela.defeitos.length
      ? r.tabela.defeitos.map(d => arquivo + ':' + d.linha + '  [' + d.regra + '] ' + d.detalhe)
          .join('\n         ')
      : '');
  ok(arquivo + ': as alturas de linha declaradas são as duas densidades da casa ('
    + (r.tabela.alturas.length ? r.tabela.alturas.join(' e ') + 'px' : 'nenhuma fixa — a linha '
      + 'cresce com o conteúdo, que também é uma resposta') + ')',
    r.tabela.alturas.every(h => R.ALTURAS_LINHA.includes(h)),
    'alturas fora de ' + R.ALTURAS_LINHA.join('/') + ': '
      + r.tabela.alturas.filter(h => !R.ALTURAS_LINHA.includes(h)).join(', '));
};
regra.conta = r => r.tabela.temTabela ? r.tabela.defeitos.length + ' defeito(s) de tabela' : 'sem tabela';

catraca('testa_tabela_densa', 'cabeçalho fixo, número à direita, fio em vez de zebra', regra);
