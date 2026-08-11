// SUITE testa_stepper_etapas — "minha etapa, segunda etapa, terceira etapa, finalizar o processo".
//
// ══ DE ONDE VEIO ════════════════════════════════════════════════════════════════════════════
// Feedback do cliente da FPMED, por audio, olhando o Licitante Prime: "esta faltando alguma
// coisa, reorganizar melhor... a questao das etapas".
// O que havia era uma fileira de CINCO BOTOES IGUAIS, e o unico sinal de onde o negocio estava
// era um deles ficar verde. Isso responde "qual e a fase?" e nao responde a pergunta que a
// pessoa faz ao abrir a ficha: **onde eu estou no processo, e quanto falta?**
//
// ══ AS TRES DIFERENCAS QUE FAZEM O STEPPER FUNCIONAR ════════════════════════════════════════
//   1. PASSADO x PRESENTE x FUTURO com pesos visuais diferentes. Com cinco botoes iguais, o olho
//      tem que LER os cinco pra achar o verde.
//   2. A LINHA CONECTA — e o que transforma cinco caixinhas num caminho. Caminho tem direcao, e
//      direcao e o que "quanto falta" quer dizer.
//   3. O NUMERO ESTA ESCRITO ("etapa 3 de 5"). Bolinha colorida e bonita e ambigua.
//
// >>> E O COMPORTAMENTO NAO MUDOU: clicar continua chamando `mudaFase`, com o mesmo rastro.
//     Roupa nova numa funcao que ja funcionava — trocar as duas ao mesmo tempo seria nao saber
//     qual delas quebrou.
//
//   node tests/testa_stepper_etapas.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const N = R('fpmed_negocios.html');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_stepper_etapas — a linha do tempo do processo\n');

// ── A FUNCAO REAL, extraida do arquivo (nao recopiada) ─────────────────────────────────────
const bloco = (ini, fim) => {
  const s = N.indexOf(ini); const e = N.indexOf(fim, s);
  return (s < 0 || e < 0) ? '' : N.slice(s, e);
};
// `ETAPA_FOCO`/`focoDa` entram porque o stepper passou a imprimir a frase do "o que fazer agora".
// Extrair menos que isso quebraria a suite por falta de dependencia, e nao por defeito.
const ctx = (new Function('esc',
  bloco('const FASES = [', 'const nomeFase') +
  'const nomeFase = k => (FASES.find(f=>f.k===k)||{}).n || k;'
  + 'const corFase  = k => (FASES.find(f=>f.k===k)||{}).c || "#8fa3b8";' +
  bloco('const ETAPA_FOCO = {', '/* AS AÇÕES DO RODAPÉ') +
  bloco('function stepper(n){', '/* O MINI-PROGRESSO DO CARD') +
  bloco('function progressoCard(n){', '/* ══ EDITAL E ANEXOS') +
  'return { stepper, progressoCard, FASES, ETAPA_FOCO, focoDa };'))(s => String(s == null ? '' : s));
const { stepper, progressoCard, FASES } = ctx;

// ══════════ 1. O STEPPER, NAS 5 ETAPAS ══════════
ok('1. *** a funcao existe e foi extraida do arquivo ***', typeof stepper === 'function');
console.log('  o que o stepper diz em cada etapa:');
FASES.forEach((fase, i) => {
  const h = stepper({ id: 1, estagio: fase.k });
  const feitos = (h.match(/class="pas feito"/g) || []).length;
  const agora = (h.match(/class="pas agora"/g) || []).length;
  const futuros = (h.match(/class="pas futuro"/g) || []).length;
  console.log(`    ${String(fase.n).padEnd(14)} -> ${feitos} feito(s) · ${agora} atual · ${futuros} futuro(s)`
    + `  · "Etapa ${i + 1} de ${FASES.length}"`);
  ok(`2.${i} · ${fase.n}: ${i} etapa(s) marcada(s) como feita`, feitos === i, { feitos, esperado: i });
  ok(`3.${i} · ${fase.n}: exatamente UMA etapa atual`, agora === 1, { agora });
  ok(`4.${i} · ${fase.n}: ${FASES.length - i - 1} futura(s)`, futuros === FASES.length - i - 1, { futuros });
  ok(`5.${i} · ${fase.n}: diz "Etapa ${i + 1} de ${FASES.length}"`,
    h.includes(`Etapa ${i + 1} de ${FASES.length}`), { trecho: (h.match(/Etapa \d+ de \d+/) || [])[0] });
  // O CLIQUE CONTINUA MOVENDO — em TODAS as etapas, inclusive nas ja vencidas (voltar atras e
  // uma coisa que acontece: pregao adiado, negocio que volta pra qualificacao).
  ok(`6.${i} · ${fase.n}: todas as 5 chamam mudaFase`,
    (h.match(/onclick="mudaFase\(1,'/g) || []).length === FASES.length);
});
ok('7. *** a etapa vencida vira ✓ ***', stepper({ id: 1, estagio: 'contrato' }).includes('>✓<'));
ok('8. *** e a atual mostra o NUMERO dela, e nao ✓ ***',
  /class="bola"[^>]*>1</.test(stepper({ id: 1, estagio: 'oportunidade' })));
ok('9. *** a ultima etapa diz que e a ultima, e nao "falta 0" ***',
  stepper({ id: 1, estagio: 'contrato' }).includes('última etapa'));
ok('10. *** e as outras dizem quantas faltam ***',
  stepper({ id: 1, estagio: 'oportunidade' }).includes('falta(m) 4 até'));
ok('11. estagio desconhecido nao quebra (cai na primeira)',
  stepper({ id: 1, estagio: 'inventado' }).includes('Etapa 1 de 5'));
ok('12. a tela DIZ que clicar move e fica no historico',
  stepper({ id: 1, estagio: 'disputa' }).includes('fica no histórico'));

// ══════════ 2. O MINI-PROGRESSO DO CARD ══════════
ok('13. *** existe, e diz "etapa X de 5" por extenso ***',
  progressoCard({ estagio: 'disputa' }).includes('etapa 3 de 5'));
ok('14. *** com bolinhas: as vencidas e a atual preenchidas ***', (() => {
  const h = progressoCard({ estagio: 'disputa' });
  const cheias = (h.match(/background:#[0-9A-Fa-f]{6}/g) || []).length;
  return cheias === 3;   // oportunidade, qualificacao, disputa
})(), progressoCard({ estagio: 'disputa' }));
ok('15. ...e as futuras vazias', progressoCard({ estagio: 'disputa' }).includes('background:transparent'));
ok('16. *** e o nome da fase junto (bolinha sozinha e ambigua) ***',
  progressoCard({ estagio: 'disputa' }).includes('Disputa'));
ok('17. ...com o motivo escrito', /as bolinhas dão o relance e o\s*texto dá a certeza/.test(uc(N)));

// ══════════ 3. ONDE CADA UM APARECE ══════════
ok('18. *** o stepper e a PRIMEIRA coisa da ficha ***',
  N.indexOf('${stepper(n)}') < N.indexOf('<div class="dw-abas">'));
ok('19. ...com o motivo (e o que o cliente quer ver ao abrir)',
  /a questão das etapas/.test(uc(N)));
ok('20. *** o progresso vai no card da LISTA, e nao no do kanban ***',
  /\$\{noKanban \? '' : progressoCard\(n\)\}/.test(N));
ok('21. ...com o motivo (no kanban a coluna ja diz a fase)',
  /card com informação repetida é card\s*que se lê pela metade/.test(uc(N)));
ok('22. *** a fileira de botoes iguais foi embora ***', !/class="dw-fases"/.test(N));

// ══════════ 4. O COMPORTAMENTO NAO MUDOU ══════════
ok('23. *** `mudaFase` continua sendo quem move ***', /async function mudaFase\(/.test(N) || /function mudaFase\(/.test(N));
ok('24. *** e ela continua gravando ***', /mudaFase[\s\S]{0,700}gravar\(/.test(N));
ok('25. ...e o rastro do banco continua no caminho (o gatilho registra a alteracao)',
  /negocio_alteracoes/.test(N));
ok('26. o codigo DIZ que trocou a roupa, e nao a funcao',
  /Roupa nova numa\s*função que já funcionava/.test(uc(N)) || /uma roupa nova numa função que já funcionava/.test(uc(N)));

// ══════════ 5. A ARRUMACAO VISUAL ══════════
ok('27. *** a barra de filtros virou um painel agrupado ***',
  /\.barra\{[\s\S]{0,220}background:var\(--painel\);border:1px solid var\(--linha\);border-radius:12px/.test(N));
ok('28. ...com o motivo (tres niveis diferentes com o mesmo peso visual)',
  /nenhuma delas parecendo dona de nada/.test(uc(N)));
ok('29. *** e o comentario deixa claro que NADA muda de comportamento ***',
  /NADA MUDA DE COMPORTAMENTO/.test(N));
ok('30. *** a hierarquia do KPI: valor grande, rotulo pequeno em cima ***',
  /\.kpi span\{font-size:10\.5px;color:var\(--muted\);text-transform:uppercase/.test(N));
ok('31. ...com o motivo ("quanto?" antes de "quanto do que?")',
  /que é a ordem em que a pergunta é feita/.test(uc(N)));
ok('32. *** o CSS orfao foi MARCADO, e nao apagado no mesmo commit ***',
  /`\.fase-tag` FICOU SEM USO em 11\/08/.test(N));
ok('33. ...com o motivo (apagar seletor junto com o HTML e como se descobre depois que era usado)',
  /era usado num terceiro lugar/.test(uc(N)));

// ══════════ 6. A FAXINA DE INFORMACAO ══════════
// O cliente achou o sistema "muito cheio de coisa". Sao 7 abas e 6 botoes, TODOS aparecendo
// sempre — inclusive os que nao tem nada a ver com o momento do processo.
ok('34. *** existe o mapa de foco por etapa, com as 5 ***',
  Object.keys(ctx.ETAPA_FOCO).length === 5
  && FASES.every(f => ctx.ETAPA_FOCO[f.k]), Object.keys(ctx.ETAPA_FOCO));
ok('35. *** cada etapa diz qual aba abre, o que se faz e quais acoes ficam a vista ***',
  FASES.every(f => { const x = ctx.ETAPA_FOCO[f.k]; return x.aba && x.faz && Array.isArray(x.acoes); }));
ok('36. *** a ficha ABRE na aba da etapa (o `on` deixou de ser chumbado no info) ***',
  /const pnl = \(n, k\) => 'dw-painel' \+ \(k === focoDa\(n\.estagio\)\.aba \? ' on' : ''\);/.test(N)
  && !/<div class="dw-painel on" id="aba-info">/.test(N));
console.log('  qual aba abre em cada etapa:');
FASES.forEach(f => console.log(`    ${String(f.n).padEnd(14)} -> aba "${ctx.ETAPA_FOCO[f.k].aba}"`
  + `  · acoes a vista: ${ctx.ETAPA_FOCO[f.k].acoes.join(', ')}`));
ok('37. *** as etapas NAO abrem todas na mesma aba (senao o mapa nao serve pra nada) ***',
  new Set(FASES.map(f => ctx.ETAPA_FOCO[f.k].aba)).size >= 3);
ok('38. *** a aba da etapa ganha o ponto "voce esta aqui" ***',
  /\.dw-abas button\.foco::after/.test(N) && /const doFoco = k === focoDa\(n\.estagio\)\.aba;/.test(N));
ok('39. ...com o motivo (a pessoa PODE ter navegado pra outra e voltado)',
  /porque a pessoa PODE ter navegado pra outra e voltado/.test(uc(N)));
ok('40. *** a frase do "o que fazer agora" aparece no stepper ***',
  stepper({ id: 1, estagio: 'disputa' }).includes('A sessão é o que manda agora'));
ok('41. ...e e UMA FRASE, e nao um checklist',
  /uma frase, e não uma lista de tarefas/.test(uc(N)) && /Uma frase se lê/.test(uc(N)));
ok('42. *** o rodape mostra 2-3 acoes e joga o resto no menu ***',
  /const visiveis = foco\.acoes\.filter\(k => A\[k\] && A\[k\]\.pode\);/.test(N)
  && /⋯ mais ações/.test(N));
ok('43. *** NADA e removido — o resto continua a um clique ***',
  /NADA É REMOVIDO/.test(N) && /const noMenu = Object\.keys\(A\)\.filter\(/.test(N));
ok('44. ...com o motivo (tirar seria trocar "cheio demais" por "cadê aquilo")',
  /Tirar seria trocar "cheio demais" por "cadê aquilo"/.test(uc(N)));
ok('45. *** `arquivar` e `fechar` NUNCA vao pro menu ***',
  /k !== 'arquivar'/.test(N) && /as duas têm que estar sempre à vista/.test(uc(N)));
ok('46. *** as acoes viraram DADO, e nao HTML solto ***', /function acoesDaFicha\(n\)/.test(N));
ok('47. ...e por isso da pra escolher quais mostrar sem duplicar a lista',
  /não dava pra escolher\s*quais mostrar sem duplicar a lista/.test(uc(N)));
ok('48. *** cada acao carrega o motivo dela (nao se perderam na mudanca) ***',
  /o que diverge, nelas, é prazo legal/.test(uc(N))
  && /a hora do preço é aqui/.test(uc(N))
  && /Esconder botão\s*NÃO é a permissão/.test(uc(N)));
ok('49. *** cada secao ganhou UMA LINHA de explicacao ***',
  (N.match(/class="sec-dica"/g) || []).length >= 7);
ok('50. ...com o motivo (o que enchia era ter que ADIVINHAR o que cada uma faz)',
  /era ter que\s*ADIVINHAR o que cada uma faz/.test(uc(N)));
ok('51. o leitor de IA continua so pra quem tem o piloto', /pode: podeLerEdital\(\)/.test(N));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
