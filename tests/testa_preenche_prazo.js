/* ════════════════════════════════════════════════════════════════════════════════════════════
   testa_preenche_prazo — AS TRÊS DECISÕES DO CONDUTOR DO PRAZO (fatia A33, 19/08/2026)

   ══ POR QUE ESTAS TRÊS, E SÓ ELAS ═══════════════════════════════════════════════════════════
   O `tools/preenche_prazo.js` é quase todo requisição, e requisição não se testa sem o portal
   na frente. O que ele tem de PRÓPRIO são três decisões, e as três erram calado:

     1. DE QUEM SE TIRA A TAXA. O condutor decide onde vale a pena perguntar a partir da taxa
        "quantas linhas desta modalidade voltaram COM janela quando perguntamos à porta certa".
        Se essa conta incluísse as linhas que entraram pela BUSCA — que nunca têm o campo, por
        construção — a taxa desabaria justamente nas modalidades que mais precisam de coleta, e
        o condutor deixaria de pedir exatamente o que dá para preencher. É um zero que se
        alimenta de si mesmo, e o número sairia com cara de medição.

     2. QUEM ENTRA NO ALVO. Linha que veio pela CONSULTA e mesmo assim está sem janela já
        recebeu a resposta do PNCP: "não tenho". Repetir a pergunta gasta requisição contra
        portal público e não muda um campo. Medido em 19/08: são 2.882 linhas — 33% do buraco.

     3. O QUE SEPARA "PORTAL FORA" DE "PERGUNTEI ERRADO". É a lei da A30, e ela nasceu de um
        defeito real: o watchdog tratava 4xx igual a timeout e dizia "o portal está fora"
        quando a verdade era que a pergunta estava errada. Aqui a consequência é maior — um 4xx
        lido como "fora" faria o condutor esperar para sempre por uma porta que está aberta.

   ══ E A AMOSTRA CURTA NÃO VIRA TAXA ═════════════════════════════════════════════════════════
   Modalidade que nunca foi pedida à porta certa (a 12, Credenciamento: 2.068 linhas no índice,
   zero perguntas) não recebe taxa por analogia. "Credenciamento é chamamento permanentemente
   aberto, logo não tem prazo" é plausível — e plausível não é medido. Ela entra no fim da fila
   com a taxa DESCONHECIDA declarada, e a primeira rodada mede a dela.

     node tests/testa_preenche_prazo.js
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const P = require('../tools/preenche_prazo.js');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_preenche_prazo — as tres decisoes que erram calado\n');

// Uma linha do índice, na forma exata que o `leIndice` devolve.
const lin = (mod, coleta, temPrazo, dia, uf) => ({
  id: Math.random(), uf: uf || 'GO', modalidade_cod: mod, data_publicacao: dia || '2026-08-10',
  data_encerramento: temPrazo ? '2026-08-20T09:00:00' : null, _coleta: coleta,
});
const muitas = (n, ...a) => Array.from({ length: n }, () => lin(...a));

// ══════════ 1. A TAXA SÓ OLHA A PORTA CERTA ══════════
{
  /* 40 pregões pela consulta, todos COM janela; 500 pela busca, todos sem (por construção).
     A taxa da modalidade 6 tem de ser 100%, e não 40/540 = 7,4%. */
  const linhas = [...muitas(40, 6, null, true), ...muitas(500, 6, 'busca', false)];
  const t = P.taxaPorModalidade(linhas);
  ok('1. *** a taxa ignora quem entrou pela BUSCA (a porta que nao tem o campo) ***',
    t.get(6).com === 40 && t.get(6).sem === 0, t.get(6));
  ok('2. ...e por isso ela da 100%, e nao os 7,4% do zero que se alimenta de si mesmo',
    t.get(6).com / (t.get(6).com + t.get(6).sem) === 1);
}
{
  // E ela NÃO afrouxa: vazio vindo da porta certa conta como vazio.
  const linhas = [...muitas(30, 9, null, false), ...muitas(2, 9, null, true)];
  const t = P.taxaPorModalidade(linhas);
  ok('3. vazio que veio da porta CERTA conta como vazio (a inexigibilidade real: 2 em 32)',
    t.get(9).com === 2 && t.get(9).sem === 30, t.get(9));
}

// ══════════ 2. O ALVO ══════════
{
  const linhas = [
    ...muitas(40, 6, null, true),              // amostra da porta certa: 100%
    ...muitas(10, 6, 'busca', false, '2026-08-10', 'SP'),
    ...muitas(5, 6, 'busca', false, '2026-08-11', 'SP'),
    ...muitas(7, 6, null, false),              // JA perguntamos: o PNCP nao tem
    ...muitas(3, 6, 'busca', true),            // ja tem prazo: nao e buraco
  ];
  const t = P.taxaPorModalidade(linhas);
  const a = P.montaAlvo(linhas, t);
  ok('4. *** linha que ja veio da porta certa SEM janela nao volta para a fila ***',
    a.jaPerguntamos === 7, a.jaPerguntamos);
  ok('5. ...e ela nao entra no alvo por outra porta', a.lista.reduce((s, c) => s + c.linhas, 0) === 15,
    a.lista.map(c => c.dia + '/' + c.linhas));
  ok('6. o alvo agrupa por dia x modalidade x uf (2 combinacoes, 10 + 5)',
    a.lista.length === 2 && a.lista[0].linhas === 10 && a.lista[1].linhas === 5,
    a.lista.map(c => c.dia + ':' + c.linhas));
  ok('7. linha que JA TEM prazo nunca entra no alvo',
    !a.lista.some(c => c.linhas > 10));
}
{
  /* A ORDEM É POR RENDIMENTO, e é ela que decide o que sobrevive a uma rodada cortada.
     20 linhas de uma modalidade com 0% valem menos que 5 de uma com 100%. */
  const linhas = [
    ...muitas(40, 6, null, true),                              // mod 6: 100%
    ...muitas(40, 9, null, false),                             // mod 9: 0%
    ...muitas(20, 9, 'busca', false, '2026-08-10', 'BA'),
    ...muitas(5, 6, 'busca', false, '2026-08-10', 'GO'),
  ];
  const a = P.montaAlvo(linhas, P.taxaPorModalidade(linhas));
  ok('8. *** a fila e por RENDIMENTO medido, nao por quantidade ***',
    a.lista[0].mod === 6 && a.lista[0].linhas === 5,
    a.lista.map(c => 'mod' + c.mod + ':' + c.linhas + ':' + c.rende));
  ok('9. ...e as 20 linhas de rendimento ~zero continuam na fila, no fim (nao somem)',
    a.lista.length === 2 && a.lista[1].mod === 9 && a.lista[1].linhas === 20);
}
{
  /* AMOSTRA CURTA NÃO VIRA TAXA. A modalidade 12 nunca foi pedida à porta certa. */
  const linhas = [
    ...muitas(40, 6, null, true),
    ...muitas(5, 6, 'busca', false, '2026-08-10', 'GO'),
    ...muitas(2000, 12, 'busca', false, '2026-08-10', 'MG'),
  ];
  const a = P.montaAlvo(linhas, P.taxaPorModalidade(linhas));
  const c12 = a.lista.find(c => c.mod === 12);
  ok('10. *** modalidade nunca pedida a porta certa tem taxa DESCONHECIDA, nao inventada ***',
    c12 && c12.taxa === null, c12 && c12.taxa);
  ok('11. ...e mesmo com 2.000 linhas ela fica ATRAS de 5 linhas de taxa medida — plausivel '
    + 'nao e medido, e a rodada cortada tem de deixar pronto o que responde de verdade',
    a.lista[0].mod === 6, a.lista.map(c => 'mod' + c.mod));
  ok('12. ...e ela NAO some da fila: divida contada em voz alta e fila', !!c12 && c12.linhas === 2000);
}
{
  // Sem data de publicação não dá para montar a pergunta — e isso sai contado, não descartado.
  const linhas = [lin(6, 'busca', false), { ...lin(6, 'busca', false), data_publicacao: null }];
  const a = P.montaAlvo(linhas, P.taxaPorModalidade(linhas));
  ok('13. linha sem data de publicacao sai na conta `semData`, e nao no alvo',
    a.semData === 1 && a.lista.length === 1, { semData: a.semData, alvo: a.lista.length });
}

// ══════════ 3. A LEI DA A30: 4xx NAO E QUEDA ══════════
{
  ok('14. *** 4xx e PERGUNTA ERRADA, nunca "portal fora" (a lei da A30) ***',
    P.classificaSonda(400, null) === 'pergunta-errada'
    && P.classificaSonda(422, null) === 'pergunta-errada'
    && P.classificaSonda(404, null) === 'pergunta-errada',
    [P.classificaSonda(400, null), P.classificaSonda(422, null), P.classificaSonda(404, null)]);
  ok('15. 5xx e o portal fora — inclusive o 504 do gateway, que foi o de 19/08',
    P.classificaSonda(500, null) === 'fora' && P.classificaSonda(504, null) === 'fora');
  ok('16. timeout/queda tambem e o portal fora (nao houve resposta para julgar)',
    P.classificaSonda(null, new Error('AbortError')) === 'fora');
  ok('17. 2xx e a porta aberta', P.classificaSonda(200, null) === 'aberta'
    && P.classificaSonda(206, null) === 'aberta');
  /* >>> A METADE INDISPENSAVEL: um classificador que devolvesse 'fora' para tudo passaria nos
         asserts 15 e 16 e quebraria o 14 e o 17. Os quatro juntos e que fecham a porta. */
  ok('18. e ele NAO devolve o mesmo para tudo (senao os asserts de cima nao provam nada)',
    new Set([P.classificaSonda(200, null), P.classificaSonda(404, null),
             P.classificaSonda(504, null)]).size === 3);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
