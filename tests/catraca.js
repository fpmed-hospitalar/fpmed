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

  /* ══ O PAPEL CONGELADO SAI NUMA LINHA PRÓPRIA (fatia A37, 20/08/2026) ══════════════════════
     Achado que cai dentro de região congelada por ordem do dono NÃO é reprovação — ele está
     fora da alçada desta régua. Mas ele NÃO SOME: sai aqui embaixo, com número, arquivo, linha
     e o nome da região do papel em que caiu. Não é abrir exceção para esconder dívida; é pôr
     cada achado na coluna certa. Vermelho que mistura verdadeiro com falso ensina todo mundo a
     ignorar vermelho — e essa frase é do próprio trabalhador B, que já pagou por ela. */
  const congelados = [];
  for (const arquivo of lista.adotadas) {
    let r;
    try { r = R.mede(arquivo); }
    catch (e) { f++; console.log('  FALHA nao consegui medir ' + arquivo + ': ' + e.message); continue; }
    /* ══ E A ISENÇÃO É ANCORADA NO HASH: se ele não bater, A CATRACA PARA E GRITA ═════════════
       Sem esta linha a isenção viraria a porta dos fundos por onde se muda o papel que o
       hospital assina sem ninguém ver. É o que separa esta decisão de um `// ignore`. */
    if (r.congelado && r.congelado.divergentes.length) {
      for (const d of r.congelado.divergentes) {
        f++;
        console.log('  FALHA *** O PAPEL CONGELADO MUDOU — a isencao esta SUSPENSA ***'
          + '\n         ' + arquivo + '  regiao: ' + d.nome
          + '\n         ' + d.porque
          + '\n         Se foi ordem do dono: node tools/prova_papel_congelado.js --impressao');
      }
    }
    if (r.congelado && r.congelado.achados.length)
      congelados.push({ arquivo, achados: r.congelado.achados });
    regra({ arquivo, r, ok, lista });
  }

  if (congelados.length) {
    const total = congelados.reduce((s, c) => s + c.achados.length, 0);
    console.log('\n  >>> ' + total + ' achado(s) dentro do papel congelado por ordem do dono — fora da');
    console.log('      alcada da regua (ver tools/prova_papel_congelado.js):');
    for (const c of congelados) for (const a of c.achados)
      console.log('        ' + c.arquivo + ':' + a.linha + '  ' + a.oQue + '  [' + a.regiao + ']');
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
