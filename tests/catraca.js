/* ════════════════════════════════════════════════════════════════════════════════════════════
   catraca.js — O ESQUELETO DAS 8 CATRACAS (fatia A28, 15/08/2026)

   ══ POR QUE ELE EXISTE ══════════════════════════════════════════════════════════════════════
   Porque as oito catracas fazem a MESMA coisa em volta da regra: ler a lista de telas adotadas,
   medir cada uma com a mesma régua, imprimir o defeito COM ARQUIVO E LINHA, imprimir a dívida
   pendente e sair com código diferente de zero. Oito cópias disso são oito chances de uma
   catraca esquecer de imprimir a linha — e catraca que diz "reprovou" sem dizer ONDE ensina a
   equipe a ignorar vermelho tão rápido quanto catraca que nunca fica vermelha.

   ══ AS DUAS PROMESSAS QUE ESTE ARQUIVO GUARDA ═══════════════════════════════════════════════
   1. TODA FALHA NOMEIA ARQUIVO E LINHA. É a exigência literal da BASE_VISUAL PARTE 3.
   2. A DÍVIDA PENDENTE SAI SEMPRE, com o número medido de cada tela que ainda não adotou.
      Verde aqui quer dizer "as telas que passaram pela fatia obedecem" — nunca "o sistema
      inteiro obedece". Confundir os dois seria a tela mentindo sobre si mesma, um nível acima.

   ══ E O FORMATO DA ÚLTIMA LINHA NÃO É ESTILO ════════════════════════════════════════════════
   `RESULTADO: N ok, M falha(s)` é o que o `tests/run_all.js` lê com expressão regular para
   somar o placar. Suíte que imprime diferente é contada como zero e o total fica bonito.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const path = require('path');
const R = require(path.join(__dirname, '..', 'tools', 'regua_visual.js'));

function catraca(nome, titulo, regra) {
  const lista = R.adotadas();
  let p = 0, f = 0;
  console.log('CATRACA ' + nome + ' — ' + titulo + '\n');

  const ok = (t, cond, onde) => {
    if (cond) { p++; return; }
    f++;
    console.log('  FALHA ' + t + (onde ? '\n         ' + onde : ''));
  };

  for (const arquivo of lista.adotadas) {
    let r;
    try { r = R.mede(arquivo); }
    catch (e) { f++; console.log('  FALHA nao consegui medir ' + arquivo + ': ' + e.message); continue; }
    regra({ arquivo, r, ok, lista });
  }

  /* A DÍVIDA, EM VOZ ALTA. Ela não conta como falha (a tela ainda não passou pela fatia dela),
     mas ela SAI — e sai com o número, não com "há pendências". */
  const pend = [];
  for (const arquivo of lista.pendentes) {
    let r;
    try { r = R.mede(arquivo); } catch (e) { pend.push('    ' + arquivo + ': nao consegui medir (' + e.message + ')'); continue; }
    const conta = regra.conta ? regra.conta(r) : null;
    if (conta !== null && conta !== undefined) pend.push('    ' + arquivo.padEnd(26) + conta);
  }
  if (pend.length) {
    console.log('\n  >>> DIVIDA (telas que ainda nao adotaram — nao reprova, mas nao some):');
    pend.forEach(l => console.log(l));
  }

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exit(f ? 1 : 0);
}

// Um endereço de defeito, no formato que o editor abre com um clique.
const onde = (arquivo, achados, comoDescreve) =>
  achados.slice(0, 12).map(a => arquivo + ':' + a.linha + '  ' + comoDescreve(a)).join('\n         ')
  + (achados.length > 12 ? '\n         … e mais ' + (achados.length - 12) : '');

module.exports = { catraca, onde, R };
