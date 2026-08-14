// SUITE testa_kit_prazos — o kit de tarefas com prazo ancorado na abertura (fatia B4) e o
// recalculo ao remarcar (fatia B2). Uso: node tests/testa_kit_prazos.js
//
// ══ POR QUE ESTA SUITE EXISTE ══════════════════════════════════════════════════════════════
// O kit de 15 tarefas ja tinha sido tirado da tela uma vez (11/08) porque nao servia pra nada:
// checklist sem data. Ele voltou em 14/08 com TRES datas contadas da abertura, e e exatamente
// essa conta que precisa de guarda — ela e a diferenca entre o kit que o dono pediu e o
// checklist que ele mandou tirar. Se `diasUteisDe` cair num sabado, o prazo do art. 164 vira
// uma data que o pregoeiro nao aceita, e ninguem descobre olhando a tela.
//
// ══ COMO ELA LE O CODIGO ═══════════════════════════════════════════════════════════════════
// Extraindo as funcoes REAIS do fpmed_negocios.html (nao recopia), pelas mesmas ancoras que a
// testa_funil_negocios usa. Recopiar a conta aqui provaria que a copia funciona.
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');

// CRLF -> LF: mesma razao explicada no testa_cruzamento_licitacoes.js.
const src = fs.readFileSync(path.join(raiz, 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');

function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora: ' + ini);
  return src.slice(s, e);
}
const ctx = (new Function(
  bloco('const esc = s =>', 'const brl =') +
  /* O MODELO DE TAREFAS DA TELA, e nao o do semeador — eles SAO diferentes, e essa e uma das
     coisas que esta suite existe pra registrar (ver o bloco 2b). Extrair o do semeador aqui
     provaria uma lista que nao e a que nasce quando alguem cria um negocio nesta tela. */
  bloco('const TAREFAS_MODELO =', '/* ══ O KANBAN VIROU A VISÃO DE ABERTURA') +
  bloco('const hojeYMD =', 'async function carregar') +
  /* `KIT_TOTAL` mora JUNTO do modelo (linha de cima), e nao no bloco dos prazos: posto la, ele
     virava `ReferenceError` nas duas suites que extraem so o bloco dos prazos — foi exatamente
     o que aconteceu na primeira versao desta fatia. Constante mora onde esta o dado que ela
     conta. */
  'return { diasUteisDe, KIT_ANCORAS, KIT_TOTAL, prazoDaTarefa, prazosDoKit, contaKit,' +
  '         linhaDePrazo, diaDe, hojeYMD, TAREFAS_MODELO, novasTarefas };'))();
const { diasUteisDe, KIT_ANCORAS, KIT_TOTAL, prazoDaTarefa, prazosDoKit, contaKit, linhaDePrazo,
        diaDe, TAREFAS_MODELO, novasTarefas } = ctx;

const semeia = require(path.join(raiz, 'tools', 'semeia_negocios.js'));

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? ' [' + JSON.stringify(got) + ']' : '')); } };
console.log('SUITE testa_kit_prazos — as tres datas do kit, contadas da abertura\n');

// ══════════════════════════════════════════════════════════════════════════════════════════
// 1. A CONTA DE DIAS UTEIS
// A abertura de referencia e a do pregao que o dono citou por escrito: BLL 31/2026, quarta
// 12/08/2026 as 08:00 (horario local). Toda data abaixo foi conferida no calendario de 2026:
// agosto comeca num SABADO, entao 07 e sexta, 12 e quarta e 17 e segunda.
// ══════════════════════════════════════════════════════════════════════════════════════════
const AB = new Date(2026, 7, 12, 8, 0).toISOString();   // 12/08/2026 08:00 LOCAL

ok('1. 3 dias uteis ANTES de qua 12/08 caem na sex 07/08 (pula sab e dom)',
  diaDe(diasUteisDe(AB, -3)) === '2026-08-07', diaDe(diasUteisDe(AB, -3)));
ok('2. 3 dias uteis DEPOIS de qua 12/08 caem na seg 17/08 (pula sab e dom)',
  diaDe(diasUteisDe(AB, 3)) === '2026-08-17', diaDe(diasUteisDe(AB, 3)));
ok('3. zero dia util devolve o PROPRIO instante — a disputa E a sessao',
  diasUteisDe(AB, 0) === AB, diasUteisDe(AB, 0));

// *** O DEFEITO QUE ESTA SUITE EXISTE PRA IMPEDIR ***
// Contar dia CORRIDO daria 09/08 (um domingo) pro prazo do art. 164. Peca protocolada no
// domingo nao e peca fraca — e peca que nao existe, porque nao ha protocolo aberto.
const corridoErrado = new Date(new Date(AB).getTime() - 3 * 86400000);
ok('4. *** a conta corrida cairia num DOMINGO, e a util nao ***',
  corridoErrado.getDay() === 0 && [0, 6].indexOf(new Date(diasUteisDe(AB, -3)).getDay()) < 0);

// A hora do dia e PRESERVADA: zerar poria o prazo a meia-noite, que no fuso -03 e o dia
// anterior quando o navegador converte de volta — o defeito que ja arquivou uma licitacao aqui.
ok('5. a hora local da abertura sobrevive a conta (08:00 continua 08:00)',
  new Date(diasUteisDe(AB, -3)).getHours() === 8 && new Date(diasUteisDe(AB, 3)).getHours() === 8,
  [new Date(diasUteisDe(AB, -3)).getHours(), new Date(diasUteisDe(AB, 3)).getHours()]);

// Contar a partir de uma SEGUNDA pra tras tem que atravessar o fim de semana inteiro.
const SEG = new Date(2026, 7, 17, 9, 0).toISOString();  // segunda 17/08
ok('6. 1 dia util antes de uma SEGUNDA e a sexta anterior (14/08)',
  diaDe(diasUteisDe(SEG, -1)) === '2026-08-14', diaDe(diasUteisDe(SEG, -1)));
ok('7. 1 dia util depois de uma SEXTA e a segunda seguinte',
  diaDe(diasUteisDe(new Date(2026, 7, 14, 9, 0).toISOString(), 1)) === '2026-08-17');
// Virada de mes e de ano nao podem confundir a conta — sao os dois lugares onde soma de data erra.
ok('8. a conta atravessa a virada de mes',
  diaDe(diasUteisDe(new Date(2026, 8, 2, 9, 0).toISOString(), -3)) === '2026-08-28',
  diaDe(diasUteisDe(new Date(2026, 8, 2, 9, 0).toISOString(), -3)));
ok('9. sem abertura, nao ha data — e nao "hoje"', diasUteisDe(null, -3) === null);
ok('10. data invalida devolve null em vez de "Invalid Date"', diasUteisDe('nao e data', -3) === null);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 2. SAO EXATAMENTE TRES ANCORAS, E AS TRES SAO TAREFAS QUE EXISTEM
// O dono pediu "o kit com 3 datas". Uma quarta ancora inventada encheria a Agenda de prazo que
// a lei nao pede — e a primeira data inventada que alguem desmentisse levaria as tres
// verdadeiras junto, porque ninguem separa.
// ══════════════════════════════════════════════════════════════════════════════════════════
const chaves = Object.keys(KIT_ANCORAS);
ok('11. sao exatamente 3 ancoras', chaves.length === 3, chaves.length);
const textosDoModelo = TAREFAS_MODELO.map(([, t]) => t);
chaves.forEach(k => ok('12. a ancora "' + k.slice(0, 30) + '..." e uma tarefa que existe no modelo',
  textosDoModelo.indexOf(k) >= 0, k));
ok('13. uma ancora ANTES (negativa), uma NA hora (zero) e uma DEPOIS (positiva)',
  chaves.filter(k => KIT_ANCORAS[k].dias < 0).length === 1
  && chaves.filter(k => KIT_ANCORAS[k].dias === 0).length === 1
  && chaves.filter(k => KIT_ANCORAS[k].dias > 0).length === 1,
  chaves.map(k => KIT_ANCORAS[k].dias));
ok('14. a de ANTES e a de esclarecimento/impugnacao, a 3 dias uteis (art. 164)',
  KIT_ANCORAS['Solicitar esclarecimentos / Impugnar edital'].dias === -3);
ok('15. a de DEPOIS e a de recurso/contrarrazao, a 3 dias uteis (art. 165)',
  KIT_ANCORAS['Enviar recurso / contrarrazão'].dias === 3);
ok('16. a NA HORA e participar da disputa', KIT_ANCORAS['Participar da disputa'].dias === 0);
// *** O ARTIGO VAI JUNTO DO NUMERO ***: um "3" solto no codigo nao diz de onde veio, e a
// proxima pessoa a mexer nele nao tem como saber se pode.
chaves.forEach(k => ok('17. a ancora "' + k.slice(0, 24) + '..." diz em que lei ela se apoia',
  /14\.133|sess/.test(String(KIT_ANCORAS[k].lei || '')), KIT_ANCORAS[k].lei));
// E O NUMERO DE DIAS BATE COM A TELA DE PECAS, que conta os mesmos prazos com os mesmos artigos.
const pecas = fs.readFileSync(path.join(raiz, 'fpmed_pecas.html'), 'utf8');
ok('18. *** os 3 dias uteis sao os MESMOS que a tela de Pecas ja conta ***',
  /id:'impugnacao'[\s\S]{0,120}prazoDias:\s*3/.test(pecas)
  && /id:'esclarecimento'[\s\S]{0,120}prazoDias:\s*3/.test(pecas));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 3. O PRAZO E DERIVADO — ELE NAO E GRAVADO JUNTO DA TAREFA
// E esta a decisao que faz a fatia B2 (recalcular ao remarcar) nunca falhar: nao ha recalculo,
// ha uma conta. Se um dia alguem gravar `prazo` dentro do `tarefas`, a data velha sobrevive ao
// adiamento — que e o defeito que este projeto ja documentou duas vezes.
// ══════════════════════════════════════════════════════════════════════════════════════════
const kit = novasTarefas();
ok('19. o kit gravado tem ' + KIT_TOTAL + ' tarefas', kit.length === KIT_TOTAL, kit.length);
// ══ 2b. AS DUAS LISTAS DO KIT, E O NUMERO QUE NAO PODE SER ESCRITO NA TELA ══════════════════
// *** MEDIDO EM 14/08 e RESOLVIDO EM 14/08 (fatia A14). *** "Enviar proposta atualizada" saiu do
// modelo da TELA em 11/08 (virou botao de verdade na Habilitacao) e tinha ficado no SEMEADOR:
// a tela nascia com 14 e o semeador com 15. A pendencia foi registrada aqui e fechada na A14.
// >>> O ASSERT MUDOU DE LADO DE PROPOSITO, e isto e o que ele guarda agora: duas listas com o
//     MESMO nome e conteudo diferente e como um negocio nasce diferente conforme quem o criou.
//     Enquanto divergiam, o assert cobrava que a divergencia fosse CONHECIDA; agora que foram
//     alinhadas, ele cobra que continuem alinhadas — que e a promessa mais forte das duas.
// >>> E OS 2.555 REGISTROS ANTIGOS CONTINUAM COM 15 GRAVADOS. Nada foi reescrito no banco:
//     apagar item de checklist de negocio fechado seria reescrever o que a pessoa marcou. Por
//     isso o assert 32b abaixo existe — e por isso a TELA nunca pode carimbar nenhum dos dois.
ok('19b. *** a tela e o semeador tem O MESMO kit (14 x 14) ***',
  TAREFAS_MODELO.length === 14 && semeia.TAREFAS_MODELO.length === 14,
  { tela: TAREFAS_MODELO.length, semeador: semeia.TAREFAS_MODELO.length });
ok('19c. *** e nenhum texto da tela escreve o numero de tarefas a mao ***',
  !/\d+ tarefas, \d+ (delas )?com prazo/.test(src) && !/kit padrão \(1[45] tarefas\)/i.test(src));
ok('19d. ...e o contador do card usa o total GRAVADO, nunca a constante',
  /const t = \(n && Array\.isArray\(n\.tarefas\)\) \? n\.tarefas : \[\];[\s\S]{0,120}total: t\.length/.test(src.replace(/\r/g, '')));
/* O assert de identidade compara TEXTO A TEXTO, e nao so o tamanho: duas listas de 14 com um
   item trocado dariam o mesmo comprimento e negocios diferentes. */
ok('19e. *** e as duas listas sao identicas, item a item, na mesma ordem ***',
  semeia.TAREFAS_MODELO.map(([s, t]) => s + '|' + t).join('\n')
    === TAREFAS_MODELO.map(([s, t]) => s + '|' + t).join('\n'),
  semeia.TAREFAS_MODELO.map(([, t]) => t).filter(t => TAREFAS_MODELO.map(([, x]) => x).indexOf(t) < 0));
ok('19f. ...e a tarefa que virou botao em 11/08 nao esta em nenhuma das duas',
  !semeia.TAREFAS_MODELO.some(([, t]) => t === 'Enviar proposta atualizada')
  && !TAREFAS_MODELO.some(([, t]) => t === 'Enviar proposta atualizada'));
ok('20. *** e NENHUMA delas carrega `prazo` gravado ***',
  kit.every(t => !('prazo' in t)), kit.filter(t => 'prazo' in t));
ok('21. o que se grava por tarefa continua sendo secao/texto/feita',
  kit.every(t => Object.keys(t).sort().join(',') === 'feita,secao,texto'), Object.keys(kit[0]));

const neg = { id: 5, abertura: AB, arquivado: false, tarefas: novasTarefas() };
ok('22. o negocio com abertura produz 3 prazos', prazosDoKit(neg).length === 3, prazosDoKit(neg).length);
const semData = { id: 6, abertura: null, arquivado: false, tarefas: novasTarefas() };
ok('23. sem abertura nao ha prazo nenhum — e nao 3 prazos hoje', prazosDoKit(semData).length === 0);

// *** REMARCAR: A PROVA DA FATIA B2, SEM ESCRITA NENHUMA ***
const antes = prazosDoKit(neg).map(x => diaDe(x.prazo)).sort();
neg.abertura = new Date(2026, 7, 25, 8, 0).toISOString();   // remarcado 12/08 -> 25/08 (terca)
const depois = prazosDoKit(neg).map(x => diaDe(x.prazo)).sort();
ok('24. *** remarcar a abertura move os TRES prazos, sem tocar em `tarefas` ***',
  antes.join('|') !== depois.join('|') && antes.length === 3 && depois.length === 3, { antes, depois });
ok('25. ...e os novos batem com a conta a partir da data nova (20/08, 25/08 e 28/08)',
  depois.join('|') === ['2026-08-20', '2026-08-25', '2026-08-28'].sort().join('|'), depois);
ok('26. ...e o `tarefas` gravado continua sem `prazo` nenhum',
  neg.tarefas.every(t => !('prazo' in t)));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 4. O QUE NAO ENTRA NA AGENDA
// ══════════════════════════════════════════════════════════════════════════════════════════
const feito = { id: 7, abertura: AB, arquivado: false, tarefas: novasTarefas() };
feito.tarefas.forEach(t => { if (t.texto === 'Participar da disputa') t.feita = true; });
ok('27. tarefa FEITA some da agenda — prazo cumprido nao cobra mais nada',
  prazosDoKit(feito).length === 2, prazosDoKit(feito).length);
ok('28. negocio ARQUIVADO nao leva prazo pra agenda',
  prazosDoKit({ id: 8, abertura: AB, arquivado: true, tarefas: novasTarefas() }).length === 0);
ok('29. negocio sem `tarefas` nao quebra nem inventa kit',
  prazosDoKit({ id: 9, abertura: AB, arquivado: false }).length === 0);
ok('30. e `prazosDoKit(null)` devolve lista vazia em vez de estourar', prazosDoKit(null).length === 0);
// Tarefa que nao esta no mapa nao ganha data — "Analisar mercado" nao tem prazo legal nenhum.
ok('31. tarefa fora do mapa nao ganha prazo inventado',
  prazoDaTarefa(neg, { texto: 'Analisar mercado' }) === null);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 5. O MEDIDOR 0/15
// ══════════════════════════════════════════════════════════════════════════════════════════
ok('32. kit novo conta 0 de ' + KIT_TOTAL, contaKit(neg).feitas === 0 && contaKit(neg).total === KIT_TOTAL,
  contaKit(neg));
/* E o negocio ANTIGO, semeado com 15, continua contando /15 — porque `contaKit` le o GRAVADO.
   >>> A LISTA DE 15 E MONTADA AQUI, E NAO TIRADA DO SEMEADOR (14/08, fatia A14). Antes ela vinha
       de `semeia.novasTarefas()`, e no dia em que o semeador foi alinhado em 14 este assert
       passou a afirmar "15" sobre uma lista de 14 e ficou vermelho — sem que nada no produto
       tivesse piorado. O assert media o SEMEADOR quando o assunto dele e o BANCO: os 2.555
       registros gravados com 15 nao mudam porque uma constante mudou. Fixture proprio, entao. */
const KIT_ANTIGO = semeia.TAREFAS_MODELO
  .map(([secao, texto]) => ({ secao, texto, feita: false }))
  .concat([{ secao: 'classificacao', texto: 'Enviar proposta atualizada', feita: false }]);
ok('32b. *** negocio antigo (15 gravadas) continua marcando /15, e nao /14 ***',
  KIT_ANTIGO.length === 15 && contaKit({ tarefas: KIT_ANTIGO }).total === 15,
  contaKit({ tarefas: KIT_ANTIGO }).total);
ok('33. o total e o do que esta GRAVADO, e nao a constante',
  contaKit({ tarefas: [{ feita: true }, { feita: false }] }).total === 2);
ok('34. negocio sem tarefas conta 0 de 0 (e o card nao mostra medidor)',
  contaKit({}).total === 0 && contaKit(null).total === 0);
ok('35. o card so mostra o medidor quando ha kit',
  /function medidorKit\(n\)\{[\s\S]{0,220}if\(!c\.total\) return ''/.test(src.replace(/\r/g, '')));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 6. A LINHA DE PRAZO NA AGENDA
// ══════════════════════════════════════════════════════════════════════════════════════════
const umPrazo = prazosDoKit(neg).filter(x => x.dias === -3)[0];
const linha = linhaDePrazo({ p: umPrazo, n: { id: 5, portal: 'BLL', numero: '31/2026', orgao: 'PREFEITURA' }, d: diaDe(umPrazo.prazo) }, false);
ok('36. a linha traz o texto da tarefa', /Impugnar edital/.test(linha));
ok('37. a linha diz de que negocio ela e', /BLL/.test(linha) && /31\/2026/.test(linha) && /PREFEITURA/.test(linha));
ok('38. a linha cita a lei que dá o prazo', /14\.133/.test(linha));
ok('39. a linha tem a CAIXINHA — da pra marcar feito na propria agenda',
  /type="checkbox"/.test(linha) && /marcaTarefa\(5,/.test(linha));
ok('40. clicar na linha abre o negocio', /abrirDrawer\(5\)/.test(linha));
ok('41. o prazo de DIA nao inventa hora — escreve "até"', />até</.test(linha), linha.slice(0, 200));
const naSessao = prazosDoKit(neg).filter(x => x.dias === 0)[0];
ok('42. ...mas o da DISPUTA traz a hora, porque ele E a sessao',
  /\d\d:\d\d/.test(linhaDePrazo({ p: naSessao, n: { id: 5 }, d: diaDe(naSessao.prazo) }, false)));
const vencido = linhaDePrazo({ p: umPrazo, n: { id: 5 }, d: '2000-01-01' }, false);
ok('43. prazo que passou aparece marcado como VENCIDO', /venceu/.test(vencido));
// Texto de tarefa e nome de orgao entram no HTML — sem escape, um "<" do banco quebra a agenda.
const perigo = linhaDePrazo({ p: umPrazo, n: { id: 5, orgao: '<img src=x>' }, d: '2030-01-01' }, false);
ok('44. *** o que vem do banco e escapado antes de virar HTML ***',
  perigo.indexOf('<img src=x>') < 0 && /&lt;img/.test(perigo));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 7. A AGENDA REALMENTE RECEBE OS PRAZOS (leitura do codigo que esta no ar)
// ══════════════════════════════════════════════════════════════════════════════════════════
const LIMPO = src.replace(/\r/g, '');
const AGENDA = LIMPO.slice(LIMPO.indexOf('function agenda('), LIMPO.indexOf('// ══ [ANCORA] daqui pra baixo'));
ok('45. a agenda monta a lista de prazos a partir de `prazosDoKit`', /prazosDoKit\(n\)/.test(AGENDA));
ok('46. o dia da agenda e a UNIAO dos dias com sessao e dos dias com prazo',
  /Object\.keys\(porDia\)\.concat\(Object\.keys\(prazoDia\)\)/.test(AGENDA));
// *** O PRAZO NAO PODE INFLAR A CONTAGEM DE SESSOES ***: "3 sessoes" tem que continuar querendo
// dizer tres pregoes abrindo, senao o numero que a pessoa usa pra medir o dia deixa de servir.
ok('47. *** o cabecalho do dia conta SESSOES, e so cai pra "N prazos" quando nao ha sessao ***',
  /doDia\.length \? nSessoes\(doDia\.length\)/.test(AGENDA) && /' prazos'/.test(AGENDA));
ok('48. o painel da frente abre mesmo so com prazo (nao diz "nada marcado" com prazo correndo)',
  /\(futuro\.length \|\| prazoFut\.length\)/.test(AGENDA));
ok('49. o prazo e separado por DIA DELE, e nao pelo dia do pregao',
  /prazos\.filter\(x => x\.d >= hoje\)/.test(AGENDA) && /prazos\.filter\(x => x\.d < hoje\)/.test(AGENDA));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 8. O ASSISTENTE (fatia B4) — o contrato da ponte e a duplicata
// ══════════════════════════════════════════════════════════════════════════════════════════
ok('50. a tela le `?adicionar=` do endereco', /p\.get\('adicionar'\)/.test(LIMPO));
ok('51. ...e `?itens=` separado por virgula, como o contrato manda',
  /p\.get\('itens'\)[\s\S]{0,60}split\(','\)/.test(LIMPO));
// *** O CONTRATO DIZ numero_controle; A CAIXA DIZIA id. A tela aceita os dois, e a suite
//     protege isso: cair so num formato faz a ponte abrir vazia sem erro nenhum. ***
ok('52. *** a chave e resolvida por numero_controle, com o id como caso a parte ***',
  /numero_controle=eq\./.test(LIMPO) && /\^\\d\+\$/.test(LIMPO));
ok('53. o endereco e consumido de uma vez (F5 nao recria o negocio)',
  /history\.replaceState/.test(LIMPO));
ok('54. os itens sao lidos de `licitacao_itens` pela chave do contrato',
  /licitacao_itens\?numero_controle=eq\./.test(LIMPO));
// *** SEM ITEM MARCADO = O PREGAO INTEIRO, e nao "nenhum item" (contrato A5, secao 2) ***
ok('55. *** lista vazia de itens vira NULL (o pregao inteiro), e nao [] ***',
  /itens_participo: ASS\.marcados\.length \? ASS\.marcados\.slice\(\) : null/.test(LIMPO));
ok('56. o assistente procura duplicata ANTES de deixar criar',
  /function assistDuplicata\(\)/.test(LIMPO) && /assistDuplicata\(\)/.test(LIMPO.slice(LIMPO.indexOf('function assistPasso1'))));
ok('57. o negocio guarda o numero de controle do edital de origem',
  /numero_controle: ASS\.nc \|\| null/.test(LIMPO));
ok('58. a saida e DUPLA: voltar as oportunidades e ver meus negocios',
  /voltar às oportunidades/.test(LIMPO) && /ver meus negócios/.test(LIMPO));
ok('59. o kit "Padrao" nasce no assistente, marcado',
  /id="a-kit"/.test(LIMPO) && /tarefas: f\['a-kit'\] !== false \? novasTarefas\(\) : null/.test(LIMPO));
ok('60. os 3 prazos aparecem JA no passo 2, antes de gravar qualquer coisa',
  /function assistPrevePrazos\(\)/.test(LIMPO) && /oninput="assistPrevePrazos\(\)"/.test(LIMPO));
// *** UM CRIADOR SO ***: o contrato do A adverte que dois criadores com regras diferentes e como
// o mesmo pregao entra duas vezes no funil. As duas entradas passam pela mesma funcao.
const posts = (LIMPO.match(/\/rest\/v1\/negocios`, \{method:'POST'/g) || []).length;
ok('61. *** existe UM unico POST em `negocios` na tela inteira ***', posts === 1, posts);
ok('62. ...e ele mora em `criarNegocio`, que as duas entradas chamam',
  /async function criarNegocio\(corpo\)\{/.test(LIMPO.replace(/\n/g, ''))
  || /async function criarNegocio\(corpo\)\s*\{/.test(LIMPO));
/* *** NADA E GRAVADO ANTES DO PASSO 3 *** — nem "pra nao perder o preenchimento". Meio-negocio
   criado por precaucao e o registro que aparece no funil sem ninguem saber de onde veio.
   A prova e por RECORTE: dentro do bloco inteiro do assistente, a unica escrita e a de
   `enviarDoAssistente`. Procurar no arquivo todo acharia a do formulario manual, que e outra. */
const ASSIST = LIMPO.slice(LIMPO.indexOf('let ASS = null;'), LIMPO.indexOf('function numerosDoTopo'));
const escritas = (ASSIST.match(/criarNegocio\(|method:'POST'|method:'PATCH'/g) || []);
ok('63. o assistente escreve UMA vez so, e dentro de `enviarDoAssistente`',
  escritas.length === 1 && ASSIST.indexOf('criarNegocio(corpo)') > ASSIST.indexOf('async function enviarDoAssistente'),
  escritas);
ok('63b. ...e os passos 1 e 2 nao escrevem nada',
  ASSIST.slice(0, ASSIST.indexOf('async function enviarDoAssistente')).indexOf('criarNegocio(') < 0);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 9. O HISTORICO DA REMARCACAO (fatia B2) — ele e ADITIVO e se le como data
// ══════════════════════════════════════════════════════════════════════════════════════════
ok('64. o rastro continua vindo do gatilho do banco, e nao desta tela',
  /negocio_alteracoes\?negocio_id=eq\./.test(LIMPO));
ok('65. *** a abertura remarcada e MOSTRADA como data e hora locais, nao como carimbo cru ***',
  /if\(campo !== 'abertura'\) return String\(v\)/.test(LIMPO));
ok('66. ...e o que esta GRAVADO nao e reescrito (so a exibicao muda)',
  /SÓ A EXIBIÇÃO MUDA/.test(src));
ok('67. a ficha mostra os 3 prazos grudados na linha da abertura',
  /\$\{prazosAncorados\(n\)\}/.test(LIMPO));
ok('68. remarcar continua sendo a acao SUGERIDA de quem esta suspenso (fatia B2, 13/08)',
  /const sugereRemarcar = editavel && sit/.test(LIMPO));
// A confissao do feriado tem que estar escrita onde a data aparece — em Pecas ja esta, e aqui
// tambem precisa: numero que parece exato e nao e vale menos que numero com a ressalva ao lado.
ok('69. *** a tela confessa que FERIADO nao entra na conta, onde a data aparece ***',
  /Feriado do órgão não entra/.test(src) && /Feriado não entra nesta conta/.test(src));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 10. A FICHA MONTA DE VERDADE — o guarda que faltava
//
// *** ESTE BLOCO NASCEU DE UM DEFEITO QUE ESTEVE NO AR ***
// A fatia B2 de 13/08 escreveu `sit` dentro de `corpoDrawer`, onde `sit` nunca existiu (ele so
// era declarado no `card`). A funcao estourava ReferenceError na primeira linha do template e o
// `dw-body` ficava com ZERO caractere: clicar em qualquer negocio abria a gaveta em branco.
// Ficou assim ate 14/08, quando o navegador contou.
//
// >>> POR QUE NENHUMA SUITE PEGOU: `corpoDrawer` monta uma string gigante, e as suites conferem
//     o CODIGO-FONTE dela por expressao regular. Texto que existe no arquivo passa no teste
//     mesmo quando a funcao nunca chega a rodar. Ler o fonte prova que a frase foi escrita;
//     nao prova que ela chega na tela.
// >>> ENTAO AQUI ELA E EXECUTADA. Num escopo onde todo nome NAO declarado estoura — que e
//     exatamente o sintoma que passou batido. Se uma fatia futura usar uma variavel que nao
//     existe, esta suite fica vermelha antes de a gaveta abrir vazia pra alguem.
const vm = require('vm');
const corpoFonte = bloco('function corpoDrawer(n, obs, carregando){', '\nfunction abaFicha(');

// Os nomes que a ficha PODE usar. A lista e o contrato: nome que nao esta aqui e nao esta
// declarado dentro da funcao estoura, e e assim que o defeito aparece.
const NADA = () => '';
const daPagina = {
  esc: s => String(s == null ? '' : s), brl: () => 'R$ 0,00',
  fmtDtH: iso => (iso ? new Date(iso).toLocaleString('pt-BR') : null),
  diaDe, hojeYMD: ctx.hojeYMD, horaDe: () => '08:00',
  ehGestor: () => true, prazosAncorados: NADA,
  rotuloSituacao: s => String(s), corSituacao: () => 'var(--cinza-500)',
  nomeFase: k => String(k), corFase: () => 'var(--cinza-500)',
  FASES: [{ k: 'oportunidade', n: 'Oportunidade', c: 'var(--etapa-1)' }],
  SITUACOES: [{ k: 'normal', n: 'normal' }, { k: 'suspenso', n: 'suspenso' }],
  CAMPOS_FICHA: {}, EMPRESAS: [], PRIO_COR: {},
  focoDa: () => ({ aba: 'info', faz: '' }), pnl: () => 'dw-painel',
  stepper: NADA, acoesDaFicha: NADA, rodapeFicha: NADA, selaOrigem: NADA,
  seloConferencia: NADA, medidorKit: NADA, progressoCard: NADA,
};
// Os embutidos do JavaScript (Date, Math, Array, Boolean...) passam sem estar na lista: eles nao
// sao "nomes da pagina", e enumera-los seria manter uma copia da linguagem aqui dentro.
const ehEmbutido = k => Object.prototype.hasOwnProperty.call(globalThis, k);
let estourou = null, montado = '';
try {
  const sandbox = vm.createContext(new Proxy(daPagina, {
    has: () => true,
    get(alvo, k) {
      if (typeof k === 'symbol') return undefined;
      if (k in alvo) return alvo[k];
      if (ehEmbutido(k)) return globalThis[k];
      throw new ReferenceError(k + ' — nome usado na ficha que nao existe no escopo dela');
    },
  }));
  const neg5 = { id: 5, portal: 'BLL', numero: '31/2026', orgao: 'PREFEITURA', modalidade: 'P.E.',
    situacao: 'suspenso', abertura: AB, estagio: 'oportunidade', empresa_id: 1, arquivado: false,
    origem: 'calendario_2025', tarefas: novasTarefas() };
  // A quebra de linha antes do `)` NAO e enfeite: a extracao termina num comentario `//`, e sem
  // ela o proprio `)` de fechamento entraria no comentario ("Unexpected end of input").
  montado = vm.runInContext('(' + corpoFonte + '\n)(' + JSON.stringify(neg5) + ', null, false)', sandbox);
} catch (e) { estourou = e.message; }

ok('70. *** a ficha do negocio SUSPENSO monta sem estourar (o defeito de 13/08) ***',
  estourou === null, estourou);
ok('71. ...e ela produz HTML de verdade, e nao string vazia', montado.length > 500, montado.length);
ok('72. a faixa que SUGERE remarcar aparece no pregao suspenso',
  /remarcar-aviso/.test(montado) && /Remarcar abertura/.test(montado), montado.length);
ok('73. e `sit` e declarado DENTRO da ficha, do mesmo jeito que no card',
  /function corpoDrawer[\s\S]{0,2000}?const sit = n\.situacao && n\.situacao !== 'normal'/.test(LIMPO));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
