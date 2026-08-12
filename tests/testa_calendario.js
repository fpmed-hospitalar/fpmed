// SUITE testa_calendario — o calendário mensal do Negócios (item 6 da reforma, 12/08/2026).
//
// == O QUE ESTA SUITE GUARDA ==================================================================
// Ela EXECUTA as funções reais extraídas do fpmed_negocios.html contra datas de verdade — não
// procura texto no arquivo. Assert que lê código prova que o código está escrito; assert que
// roda o código prova que ele funciona.
//
// As quatro promessas que ela trava, e o motivo de cada uma:
//
//  1. A GRADE TEM 42 CÉLULAS, SEMPRE. Seis linhas fixas é a decisão que veio do Google Calendar:
//     com linhas variáveis a grade muda de altura ao trocar de mês e tudo que está embaixo pula.
//     É um assert de LAYOUT que só um teste de data consegue fazer — o olho não percebe que
//     fevereiro tem uma linha a menos até o dia em que percebe.
//
//  2. O NOME DA ETAPA VIAJA COM A COR. Este é o assert que o testa_tema EXIGE: lá a medição
//     mostrou que a cor cheia da etapa não alcança 3:1 sobre o cartão (2,67 na 1, 2,94 na 2).
//     Cor sozinha, ali, seria informação que parte das pessoas não recebe. Enquanto aquela
//     medição estiver abaixo de 3:1, esta suíte é obrigada a provar o nome junto.
//
//  3. O QUE NÃO CABE NO CALENDÁRIO É DITO, NÃO SUMIDO. Negócio sem data de abertura não tem
//     dia, logo não tem célula. Sumir calado faria quem olha a grade concluir "é isto que
//     existe" — que é exatamente como um número errado vira fato consumado neste projeto.
//
//  4. O CELULAR TEM ESTRATÉGIA PRÓPRIA, decidida antes de construir. Sete colunas em 390px dão
//     ~50px cada: nem a hora caberia. A referência nomeia isso ("desktop-only density model")
//     e é o defeito que a suíte impede de voltar.
//
//   node tests/testa_calendario.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(raiz, 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');

function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora nao encontrada: ' + ini);
  return src.slice(s, e);
}

/* ── A JANELA DE MENTIRA ──────────────────────────────────────────────────────────────────────
   O bloco do calendário termina registrando um ouvinte de `resize`, porque grade e lista são
   conteúdos diferentes e quem troca um pelo outro é o JavaScript. Aqui a janela é um objeto que
   eu controlo: dá pra mudar a largura e disparar o evento na mão, que é a única forma de provar
   a travessia dos 700px sem um navegador. */
function janelaFalsa(largura) {
  const ouvintes = {};
  return {
    innerWidth: largura,
    addEventListener(ev, fn) { (ouvintes[ev] = ouvintes[ev] || []).push(fn); },
    disparar(ev) { (ouvintes[ev] || []).forEach(fn => fn()); },
    _ouvintes: ouvintes,
  };
}

/* Monta um contexto novo a cada teste que precisa de estado limpo. `pinta` é um contador: o que
   interessa provar não é o que ele desenha (isso é o `calendario()`), e sim QUANTAS VEZES a tela
   é mandada repintar — repintar demais é desperdício, repintar de menos é tela mentindo. */
function contexto(largura, visao) {
  const win = janelaFalsa(largura === undefined ? 1366 : largura);
  const conta = { pinta: 0 };
  const fn = new Function('window', 'CONTA',
    'let VIS = ' + JSON.stringify(visao || 'calendario') + ';' +
    'const pinta = () => { CONTA.pinta++; };' +
    // o cartão vira um selo com o id: o calendário é provado pelo que ele ORGANIZA, e o HTML do
    // cartão já é provado pelo testa_funil_negocios. Provar duas vezes é manter duas cópias.
    'const card = n => "[card:" + n.id + "]";' +
    'const rotuloSituacao = k => ({cancelado:"cancelado",suspenso:"suspenso",adiado:"adiado"}[k] || k);' +
    'const paradoDeVez = k => k === "cancelado" || k === "suspenso";' +
    bloco('const esc = s =>', '// ── datas:') +
    bloco('const hojeYMD =', '// ══ NOTIFICAÇÕES') +
    bloco('const FASES = [', '// AS 15 TAREFAS-MODELO') +
    bloco('// ══ [ANCORA] daqui pra baixo e o CALENDARIO MENSAL', '// ── drag-and-drop') +
    'return { calendario, gradeDoMes, porDiaDeAbertura, pilula, mesVizinhoComSessao,' +
    ' calNav, calHoje, calAbrirDia, calFecharDia, calIrPara, calEstreito, hojeYMD, calNomeMes, nSessoes,' +
    ' mes: () => [CAL_A, CAL_M], dia: () => CAL_DIA, irPara: (a,m) => { CAL_A=a; CAL_M=m; },' +
    ' MAX_PIL, CAL_ESTREITO };');
  const api = fn(win, conta);
  return { api, win, conta };
}

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? '  [' + JSON.stringify(got) + ']' : '')); } };
console.log('SUITE testa_calendario — a grade do mês, as pílulas e o que não cabe nela\n');

// ── um fabricante de negócio, com só o que o calendário lê ────────────────────────────────────
let _id = 0;
const neg = (abertura, extra) => Object.assign(
  { id: ++_id, estagio: 'oportunidade', orgao: 'PREFEITURA DE APARECIDA DE GOIANIA',
    municipio: 'Aparecida de Goiânia', portal: 'Compras.gov.br', situacao: 'normal', abertura },
  extra || {});
// 'YYYY-MM-DDTHH:MM' SEM Z: horário LOCAL, que é como o banco entrega convertido pelo navegador.
const em = (ymd, hora) => ymd + 'T' + (hora || '09:00') + ':00';

const C = contexto();
let n = 1;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. A GRADE — seis linhas fixas, sem buraco e sem invenção
// ══════════════════════════════════════════════════════════════════════════════════════════════
const MESES_PROVA = [
  [2026, 1, 'fevereiro/2026 (28 dias, o mais curto)', 28],
  [2026, 7, 'agosto/2026 (31 dias, começa no sábado — exige 6 linhas)', 31],
  [2026, 10, 'novembro/2026 (30 dias, começa no domingo)', 30],
  [2028, 1, 'fevereiro/2028 (29 dias, bissexto)', 29],
];
for (const [a, m, nome, dias] of MESES_PROVA) {
  const g = C.api.gradeDoMes(a, m);
  ok(n + '. ' + nome + ': 42 células, sempre as mesmas 6 linhas', g.length === 42, g.length); n++;
  ok(n + '. ' + nome + ': o mês tem os ' + dias + ' dias, nem um a mais',
    g.filter(c => c.doMes).length === dias, g.filter(c => c.doMes).length); n++;
  // A grade começa no domingo e termina no sábado, senão o cabeçalho dom..sáb mente sobre a coluna
  ok(n + '. ' + nome + ': começa num domingo e acaba num sábado',
    new Date(a, m, 1 - new Date(a, m, 1).getDay()).getDay() === 0
    && new Date(g[41].ymd.split('-')[0], g[41].ymd.split('-')[1] - 1, g[41].ymd.split('-')[2]).getDay() === 6); n++;
  // Sem buraco: 42 datas consecutivas. Um erro de fuso aqui produziria um dia repetido ou pulado,
  // e é o defeito mais silencioso que um calendário pode ter — ninguém confere 42 datas na mão.
  let seguidas = true;
  for (let i = 1; i < 42; i++) {
    const [aa, mm, dd] = g[i - 1].ymd.split('-').map(Number);
    const prox = new Date(aa, mm - 1, dd + 1);
    const esperado = prox.getFullYear() + '-' + String(prox.getMonth() + 1).padStart(2, '0') + '-' + String(prox.getDate()).padStart(2, '0');
    if (g[i].ymd !== esperado) seguidas = false;
  }
  ok(n + '. ' + nome + ': as 42 datas são consecutivas (nenhum dia pulado nem repetido)', seguidas); n++;
  // O primeiro dia do mês é o dia 1 — o assert que pega `new Date('YYYY-MM-DD')`, que vira
  // meia-noite UTC = 21h do dia ANTERIOR em Goiás. Foi assim que uma licitação nasceu arquivada.
  const primeira = g.find(c => c.doMes);
  ok(n + '. ' + nome + ': o primeiro dia do mês é o dia 1 (fuso local, não UTC)',
    primeira.dia === 1 && primeira.ymd === a + '-' + String(m + 1).padStart(2, '0') + '-01',
    primeira.ymd); n++;
}
// HOJE aparece uma vez só, e não aparece em mês que não é o dele
const hoje = C.api.hojeYMD(), [ha, hm] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1];
ok(n + '. hoje é marcado em exatamente uma célula do mês corrente',
  C.api.gradeDoMes(ha, hm).filter(c => c.hoje && c.doMes).length === 1); n++;
ok(n + '. e não é marcado num mês distante (o "hoje" não vaza de mês)',
  C.api.gradeDoMes(ha + 3, hm).filter(c => c.hoje).length === 0); n++;
// Fim de semana: exatamente 12 das 42 (6 domingos + 6 sábados), em qualquer mês
ok(n + '. as 42 células trazem 12 de fim de semana (6 sábados + 6 domingos)',
  MESES_PROVA.every(([a, m]) => C.api.gradeDoMes(a, m).filter(c => c.fds).length === 12)); n++;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. A PÍLULA — a cor NUNCA anda sozinha
// Este bloco é o que o testa_tema exige existir enquanto a cor cheia da etapa estiver abaixo
// de 3:1 sobre o cartão. Ele não mede contraste (isso é lá); ele prova que a informação chega
// por outro caminho além da cor.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const ETAPAS = [['oportunidade', 'Oportunidade', 1], ['qualificacao', 'Qualificação', 2],
  ['disputa', 'Disputa', 3], ['classificacao', 'Habilitação', 4], ['contrato', 'Ata', 5]];
for (const [chave, rotulo, i] of ETAPAS) {
  const h = C.api.pilula(neg(em('2026-08-12', '14:30'), { estagio: chave }));
  ok(n + '. pílula de ' + rotulo + ': fundo na tênue e barra na cor cheia da etapa ' + i,
    h.includes('background:var(--etapa-' + i + '-tenue)') && h.includes('border-left-color:var(--etapa-' + i + ')'), h.slice(0, 160)); n++;
  ok(n + '. pílula de ' + rotulo + ': o nome da etapa viaja junto da cor (aria-label E title)',
    (h.match(new RegExp(rotulo, 'g')) || []).length >= 2, h.slice(0, 260)); n++;
}
// Estágio desconhecido não pode virar `--etapa-0-tenue` (token que não existe = pílula sem cor
// nenhuma, e o defeito só aparece no dia em que o banco ganhar uma fase nova).
const desconhecida = C.api.pilula(neg(em('2026-08-12'), { estagio: 'fase_que_nao_existe' }));
ok(n + '. fase desconhecida cai no cinza neutro, e NÃO num token inexistente',
  !desconhecida.includes('etapa-0') && desconhecida.includes('var(--cinza-100)'), desconhecida.slice(0, 160)); n++;
ok(n + '. e mesmo assim ela diz qual é a fase, em vez de calar',
  desconhecida.includes('fase_que_nao_existe')); n++;
// A HORA vem primeiro: a pergunta de quem olha um dia é "que horas?", nunca "de quem?"
const pil = C.api.pilula(neg(em('2026-08-12', '08:45')));
ok(n + '. a hora vem antes do órgão, e em negrito próprio', pil.indexOf('08:45') < pil.indexOf('PREFEITURA')
  && /class="h"[^>]*>08:45/.test(pil.replace(/<span class="h">/, 'class="h">')), pil.slice(0, 200)); n++;
ok(n + '. o texto ao lado da hora pode ser cortado por largura, a hora não (a hora não encolhe)',
  /class="q"/.test(pil)); n++;
/* ══ OUTRO ACHADO DO LAÇO VISUAL ═════════════════════════════════════════════════════════════
   A pílula escrevia o ÓRGÃO, e na largura da célula ele saía "SECRETARI…" — que não distingue
   nada, porque metade dos certames do estado começa assim. Passou a escrever o MUNICÍPIO, que
   cabe inteiro; o órgão continua na legenda, onde há largura. */
ok(n + '. a pílula escreve o MUNICÍPIO (que cabe), não o órgão truncado',
  pil.includes('>Aparecida de Goiânia<') && !/>PREFEITURA[^<]*</.test(pil), pil.slice(-140)); n++;
ok(n + '. mas o órgão NÃO sumiu: ele continua na legenda que o mouse e o leitor de tela recebem',
  (pil.match(/PREFEITURA DE APARECIDA DE GOIANIA/g) || []).length >= 2); n++;
ok(n + '. sem município, ela cai no órgão em vez de ficar só com a hora',
  C.api.pilula(neg(em('2026-08-12'), { municipio: null })).includes('PREFEITURA')); n++;
ok(n + '. e sem nenhum dos dois ela DIZ que não sabe, em vez de deixar em branco',
  C.api.pilula(neg(em('2026-08-12'), { municipio: null, orgao: null, portal: null })).includes('sem município')); n++;
// Situação parada: esmaecida e DITA. O card já faz assim; o calendário não pode discordar dele.
const parada = C.api.pilula(neg(em('2026-08-12'), { situacao: 'suspenso' }));
ok(n + '. suspenso/cancelado fica esmaecido no calendário, como no cartão', /cal-pil parado/.test(parada)); n++;
ok(n + '. e a situação é dita no rótulo, não só insinuada pela opacidade', parada.includes('suspenso')); n++;
// Negócio sem hora não vira "00:00": hora que não se sabe não se inventa.
const semHora = C.api.pilula(neg(null));
ok(n + '. abertura ilegível vira "--:--", e não uma hora inventada',
  semHora.includes('--:--') && !semHora.includes('00:00')); n++;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. O QUE NÃO CABE NA CÉLULA — "+N mais"
// ══════════════════════════════════════════════════════════════════════════════════════════════
const conta = (h, re) => (h.match(re) || []).length;
const noMes = qtd => { const l = []; for (let i = 0; i < qtd; i++) l.push(neg(em('2026-08-12', '0' + (8 + i % 2) + ':00'))); return l; };
const C2 = contexto(); C2.api.irPara(2026, 7);
const tres = C2.api.calendario(noMes(3));
ok(n + '. dia com 3 sessões mostra as 3, sem "+N mais"',
  conta(tres, /class="cal-pil/g) === 3 && !/cal-mais/.test(tres), conta(tres, /class="cal-pil/g)); n++;
const sete = C2.api.calendario(noMes(7));
ok(n + '. dia com 7 sessões mostra 3 pílulas e o resto atrás do "+N mais"',
  conta(sete, /class="cal-pil/g) === 3, conta(sete, /class="cal-pil/g)); n++;
ok(n + '. e o N é o que SOBROU (4), não o total (7) — senão o número mente sobre o que está escondido',
  /\+4 mais/.test(sete) && !/\+7 mais/.test(sete)); n++;
/* ══ O DEFEITO QUE ESTA SUÍTE ACHOU NO CÓDIGO QUE JÁ ESTAVA NO AR (12/08) ═══════════════════
   O plural saía "sessãoões" — `sessão${q>1?'ões':''}`, com o "ão" fora do trecho que trocava.
   Vivia na AGENDA desde 06/08, num cabeçalho de dia que ninguém lê palavra por palavra, e eu ia
   copiá-lo pro calendário. Virou uma função só (`nSessoes`) e estes três asserts, que cobrem os
   três números onde o plural muda: 0, 1 e muitos. */
// As DUAS versões erradas que existiram de verdade: "sessãoões" (a original, no ar desde 06/08)
// e "sessãões" (a minha primeira correção, que trocou o sufixo sem trocar o "ã").
const semPluralQuebrado = h => !/sessãoões|sessãões|sessãoão|sessõesões/.test(h);
ok(n + '. o plural de "sessão" sai certo com 7 (e não "sessãoões")',
  /<b>7<\/b> sessões neste mês/.test(sete) && semPluralQuebrado(sete),
  (sete.match(/<b>\d+<\/b> sess\S+/) || [])[0]); n++;
ok(n + '. com 1, sai no singular', (() => { const h = C2.api.calendario(noMes(1));
  return /<b>1<\/b> sessão neste mês/.test(h) && semPluralQuebrado(h); })()); n++;
ok(n + '. e o mesmo vale no cabeçalho de dia da lista de celular (era lá que o defeito morava)',
  (() => { const cel = contexto(390); cel.api.irPara(2026, 7);
    const h = cel.api.calendario(noMes(3)); return /3 sessões/.test(h) && semPluralQuebrado(h); })()); n++;
ok(n + '. a contagem do topo conta as 7, mesmo com 3 na tela',
  /<b>7<\/b> sessões neste mês/.test(sete), (sete.match(/<b>\d+<\/b> sess\w+/) || [])[0]); n++;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4. HONESTIDADE — o que o calendário não consegue mostrar, ele DIZ
// ══════════════════════════════════════════════════════════════════════════════════════════════
const C3 = contexto(); C3.api.irPara(2026, 7);
const comOrfaos = C3.api.calendario([neg(em('2026-08-12')), neg(null), neg(null), neg(null)]);
ok(n + '. negócio sem data de abertura é CONTADO e dito na tela', /3 negócios sem data de abertura/.test(comOrfaos)); n++;
ok(n + '. e a tela oferece onde vê-los, em vez de só avisar que existem', /setVis\('lista'\)/.test(comOrfaos)); n++;
ok(n + '. eles NÃO entram na contagem de sessões do mês (1, e não 4)',
  /<b>1<\/b> sessão neste mês/.test(comOrfaos), (comOrfaos.match(/<b>\d+<\/b> sess\w+/) || [])[0]); n++;
const semOrfaos = C3.api.calendario([neg(em('2026-08-12'))]);
ok(n + '. sem órfãos, a nota não aparece (aviso permanente é aviso ignorado)', !/sem data de abertura/.test(semOrfaos)); n++;
// A contagem é do MÊS EXIBIDO. Contar a lista inteira faria o número do topo discordar da grade
// logo abaixo dele — e o topo é o que a pessoa lê primeiro.
const doisMeses = C3.api.calendario([neg(em('2026-08-12')), neg(em('2026-09-12')), neg(em('2026-09-13'))]);
ok(n + '. a contagem do topo é do mês EXIBIDO, não da lista inteira',
  /<b>1<\/b> sessão neste mês/.test(doisMeses)); n++;
// Sessão em dia de mês vizinho aparece na célula esmaecida — ela importa pra quem olha a semana.
/* A célula de mês vizinho só existe quando a GRADE existe — e a grade dá lugar ao estado vazio
   quando o mês não tem nenhuma sessão própria. Por isso agosto entra aqui com uma sessão sua:
   testar o dia vizinho num mês vazio mediria o estado vazio, não a célula esmaecida.
   (A primeira versão deste assert fazia exatamente isso e ficou vermelha por motivo errado.) */
const C4 = contexto(); C4.api.irPara(2026, 7);          // agosto começa no sábado: 31/07 está na grade
const vizinha = C4.api.calendario([neg(em('2026-07-31', '10:00')), neg(em('2026-08-19', '16:00'))]);
// A célula é achada pelo conteúdo e conferida pela classe — regex de distância fixa mediria o
// tamanho do aria-label, não a promessa.
const celDa10 = vizinha.split('<div class="cal-cel').find(c => c.includes('10:00'));
ok(n + '. sessão de mês vizinho aparece na célula esmaecida, em vez de sumir da semana',
  !!celDa10 && / fora/.test(celDa10.slice(0, 60)), (celDa10 || '').slice(0, 60)); n++;
ok(n + '. mas ela não é contada como sessão DESTE mês (a grade mostra 2, o número diz 1)',
  /<b>1<\/b> sessão neste mês/.test(vizinha) && (vizinha.match(/class="cal-pil/g) || []).length === 2,
  (vizinha.match(/<b>\d+<\/b> sess\S+/) || [])[0]); n++;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 5. O MÊS VAZIO NÃO É BECO
// ══════════════════════════════════════════════════════════════════════════════════════════════
const C5 = contexto(); C5.api.irPara(2026, 8);          // setembro, sem nada
const vazio = C5.api.calendario([neg(em('2026-11-10')), neg(em('2026-08-03'))]);
ok(n + '. mês sem sessão diz que está vazio, com o nome do mês', /Nenhuma sessão em Setembro de 2026/.test(vazio)); n++;
ok(n + '. e oferece o mês com sessão MAIS PRÓXIMO, dizendo qual é (agosto, a 1 mês)',
  /Ir para Agosto de 2026/.test(vazio), (vazio.match(/Ir para [^<]+/) || [])[0]); n++;
/* O DEFEITO QUE O LAÇO VISUAL ACHOU E NENHUMA SUÍTE VERIA: o título saía **"Agosto De 2026"**,
   com D maiúsculo, porque a capitalização era `text-transform:capitalize` no CSS — e o CSS
   capitaliza toda palavra, inclusive a preposição. Só a primeira letra sobe. */
ok(n + '. o mês sobe SÓ a primeira letra ("Agosto de 2026", nunca "Agosto De 2026")',
  C5.api.calNomeMes(2026, 7) === 'Agosto de 2026', C5.api.calNomeMes(2026, 7)); n++;
ok(n + '. e a capitalização não voltou pro CSS, onde ela não sabe o que é preposição',
  !/\.cal-mes\{[^}]*text-transform:\s*capitalize/.test(src)); n++;
ok(n + '. sem NENHUM negócio com data, ele não inventa um mês vizinho',
  !/Ir para/.test(C5.api.calendario([neg(null)]))
  && /Nenhum negócio dos filtros atuais tem data de abertura/.test(C5.api.calendario([neg(null)]))); n++;
// O empate é resolvido, e não deixado ao acaso da ordem das chaves
ok(n + '. o vizinho é escolhido por DISTÂNCIA em meses, não pela ordem em que as datas apareceram',
  (() => { const m = C5.api.mesVizinhoComSessao({ '2026-01-05': [1], '2026-10-05': [1] }, 2026, 8); return m.m === 9; })()); n++;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 6. O DIA ABERTO
// ══════════════════════════════════════════════════════════════════════════════════════════════
const C6 = contexto(); C6.api.irPara(2026, 7);
const lista6 = [neg(em('2026-08-12', '09:00')), neg(em('2026-08-12', '15:30'))];
ok(n + '. sem dia escolhido, nenhum painel de dia é desenhado', !/cal-dia-painel/.test(C6.api.calendario(lista6))); n++;
C6.api.calAbrirDia('2026-08-12');
ok(n + '. abrir um dia manda repintar (a tela responde ao clique)', C6.conta.pinta === 1, C6.conta.pinta); n++;
const aberto = C6.api.calendario(lista6);
ok(n + '. o dia aberto mostra os cartões DE VERDADE, os mesmos da lista',
  /cal-dia-painel/.test(aberto) && conta(aberto, /\[card:/g) === 2, conta(aberto, /\[card:/g)); n++;
ok(n + '. e a célula do dia aberto fica marcada na grade', /cal-cel[^"]*\bsel\b/.test(aberto)); n++;
// O mesmo gesto que abre, fecha. Sem isso a pessoa caça um botão pra desfazer o próprio clique.
C6.api.calAbrirDia('2026-08-12');
ok(n + '. clicar de novo no mesmo dia fecha', C6.api.dia() === null); n++;
// Dia sem sessão diz que não tem, em vez de abrir um painel mudo
C6.api.calAbrirDia('2026-08-20');
ok(n + '. dia sem sessão abre dizendo que não há, e lembra que a grade continua ali',
  /Nenhuma sessão neste dia/.test(C6.api.calendario(lista6))); n++;
// Trocar de mês fecha o dia: ele era do mês anterior, e mantê-lo aberto seria a tela mostrando
// um dia que não está mais na grade.
C6.api.calAbrirDia('2026-08-12'); C6.api.calNav(1);
ok(n + '. trocar de mês fecha o dia aberto (ele não está mais na grade)', C6.api.dia() === null); n++;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 7. NAVEGAÇÃO DE MÊS — a virada de ano é onde calendário caseiro erra
// ══════════════════════════════════════════════════════════════════════════════════════════════
const C7 = contexto();
C7.api.irPara(2026, 11); C7.api.calNav(1);
ok(n + '. dezembro + 1 vira janeiro do ano seguinte', C7.api.mes()[0] === 2027 && C7.api.mes()[1] === 0, C7.api.mes()); n++;
C7.api.irPara(2027, 0); C7.api.calNav(-1);
ok(n + '. janeiro − 1 volta pra dezembro do ano anterior', C7.api.mes()[0] === 2026 && C7.api.mes()[1] === 11, C7.api.mes()); n++;
C7.api.irPara(2020, 0); C7.api.calHoje();
ok(n + '. "Hoje" volta pro mês de hoje E acende o dia de hoje',
  C7.api.mes()[0] === ha && C7.api.mes()[1] === hm && C7.api.dia() === hoje, [C7.api.mes(), C7.api.dia()]); n++;
// 31 de março − 1 mês não pode virar 3 de março (o clássico do `setMonth` em dia 31)
C7.api.irPara(2026, 2); C7.api.calNav(-1);
ok(n + '. andar de mês não escorrega de dia (março → fevereiro, e não "3 de março")',
  C7.api.mes()[0] === 2026 && C7.api.mes()[1] === 1, C7.api.mes()); n++;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8. O CELULAR — a estratégia decidida ANTES de construir
// ══════════════════════════════════════════════════════════════════════════════════════════════
const CEL = contexto(390); CEL.api.irPara(2026, 7);
const listaCel = [neg(em('2026-08-12', '09:00')), neg(em('2026-08-25', '14:00'))];
const hCel = CEL.api.calendario(listaCel);
ok(n + '. em 390px a grade de 7 colunas NÃO é desenhada', !/cal-grade/.test(hCel)); n++;
ok(n + '. no lugar dela vem a lista dos dias com sessão, com os cartões de verdade',
  /cal-lista/.test(hCel) && conta(hCel, /\[card:/g) === 2, conta(hCel, /\[card:/g)); n++;
ok(n + '. e só os dias COM sessão (não 30 linhas de nada pra rolar)',
  conta(hCel, /class="ag-dia/g) === 2, conta(hCel, /class="ag-dia/g)); n++;
ok(n + '. a navegação de mês continua igual nos dois formatos', /cal-topo/.test(hCel) && /calNav\(1\)/.test(hCel)); n++;
const LARGO = contexto(1366); LARGO.api.irPara(2026, 7);
ok(n + '. em 1366px vem a grade, e não a lista', /cal-grade/.test(LARGO.api.calendario(listaCel))); n++;
ok(n + '. o limite é 700px, e ele é o mesmo número da media query do CSS',
  LARGO.api.CAL_ESTREITO === 700 && /max-width:700px/.test(src), LARGO.api.CAL_ESTREITO); n++;
// A travessia: repintar a cada pixel de arrasto é desperdício; repintar só ao mudar de faixa é
// uma vez por mudança. E arrastar dentro da mesma faixa não pode custar nada.
const TR = contexto(1366);
TR.win.innerWidth = 1200; TR.win.disparar('resize');
ok(n + '. mexer na janela sem atravessar os 700px não repinta nada', TR.conta.pinta === 0, TR.conta.pinta); n++;
TR.win.innerWidth = 400; TR.win.disparar('resize');
ok(n + '. atravessar pra baixo dos 700px repinta uma vez', TR.conta.pinta === 1, TR.conta.pinta); n++;
TR.win.innerWidth = 380; TR.win.disparar('resize');
ok(n + '. e continuar estreitando não repinta de novo', TR.conta.pinta === 1, TR.conta.pinta); n++;
TR.win.innerWidth = 1000; TR.win.disparar('resize');
ok(n + '. voltar pra cima dos 700px repinta (a grade precisa voltar)', TR.conta.pinta === 2, TR.conta.pinta); n++;
// E o resize não pode repintar quem não está olhando o calendário: repintar o kanban por causa
// de um resize é trabalho que ninguém pediu — e mataria um arraste em andamento.
const OUTRA = contexto(1366, 'quadros');
OUTRA.win.innerWidth = 400; OUTRA.win.disparar('resize');
ok(n + '. com outra visão na tela, o resize NÃO repinta (arraste em andamento não morre)',
  OUTRA.conta.pinta === 0, OUTRA.conta.pinta); n++;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 9. A LIGAÇÃO COM O RESTO DA TELA
// A visão nova só existe se der pra chegar nela. Aqui o assert roda o MESMO seletor de visão do
// boot, com um `location` e um `localStorage` de mentira.
// ══════════════════════════════════════════════════════════════════════════════════════════════
function visaoDeBoot(hash, guardada) {
  const fn = new Function('location', 'localStorage',
    bloco("const VIS_PADRAO = 'quadros';", 'FASE_SEL = null') + 'FASE_SEL = null; return VIS;');
  return fn({ hash: hash || '' }, { getItem: () => guardada || null, setItem() {} });
}
ok(n + '. sem hash e sem preferência, a tela abre nos Quadros', visaoDeBoot('', null) === 'quadros'); n++;
ok(n + '. a preferência guardada vence o padrão', visaoDeBoot('', 'agenda') === 'agenda'); n++;
ok(n + '. mas o #calendario do menu vence a preferência guardada',
  visaoDeBoot('#calendario', 'quadros') === 'calendario', visaoDeBoot('#calendario', 'quadros')); n++;
ok(n + '. hash inventado não vira visão (cai na preferência, não numa tela em branco)',
  visaoDeBoot('#visao_que_nao_existe', 'lista') === 'lista'); n++;
// Os quatro links do cabeçalho carregam a própria visão — a dívida do mapa por índice, paga.
const links = [...src.matchAll(/<a data-vis="([a-z]+)"/g)].map(x => x[1]);
ok(n + '. os quatro links do cabeçalho declaram a visão que representam (data-vis)',
  links.length === 4 && ['quadros', 'lista', 'calendario', 'agenda'].every(v => links.includes(v)), links); n++;
ok(n + '. e NENHUM lugar decide o link aceso por índice (era a dívida declarada em 12/08)',
  !/i===0&&VIS==='quadros'/.test(src) && !/i===0&&v==='quadros'/.test(src)); n++;
ok(n + '. o calendário está na lista de visões válidas da tela', /VISOES = \[[^\]]*'calendario'/.test(src)); n++;
// O menu leva até aqui — sem isso, a visão existe e ninguém acha.
const MENU = fs.readFileSync(path.join(raiz, 'limedtec-menu.js'), 'utf8');
ok(n + '. o menu lateral leva ao calendário, e não diz mais "em breve" pra ele',
  /href: 'fpmed_negocios\.html#calendario'/.test(MENU)
  && !/id: 'calendario'[^}]*emBreve/.test(MENU)); n++;
// O tema tem as cinco tênues. Sem elas a pílula fica sem fundo e a cor da etapa some.
const TEMA = fs.readFileSync(path.join(raiz, 'fpmed_tema.css'), 'utf8');
ok(n + '. as cinco tênues existem no tema (a pílula não inventa cor própria)',
  [1, 2, 3, 4, 5].every(i => new RegExp('--etapa-' + i + '-tenue:').test(TEMA))); n++;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 10. AS TRÊS PERGUNTAS OBRIGATÓRIAS (P4): vazio · 10× mais · clicar duas vezes
// ══════════════════════════════════════════════════════════════════════════════════════════════
const C10 = contexto(); C10.api.irPara(2026, 7);
ok(n + '. lista VAZIA não quebra: sai o mês vazio, não uma exceção',
  /Nenhuma sessão em Agosto de 2026/.test(C10.api.calendario([]))); n++;
ok(n + '. lista nula também não quebra', (() => { try { return /Nenhuma sessão/.test(C10.api.calendario(null)); } catch (e) { return false; } })()); n++;
// 10x mais: 2.558 é o tamanho real da tabela hoje. O que não pode acontecer é a célula crescer
// sem limite e empurrar a grade — o "+N mais" existe exatamente pra isso.
const muitos = [];
for (let i = 0; i < 2558; i++) muitos.push(neg(em('2026-08-' + String((i % 28) + 1).padStart(2, '0'), '09:00')));
const hMuitos = C10.api.calendario(muitos);
ok(n + '. com 2.558 negócios, nenhuma célula passa de 3 pílulas',
  conta(hMuitos, /class="cal-pil/g) <= 3 * 42, conta(hMuitos, /class="cal-pil/g)); n++;
ok(n + '. e a grade continua sendo 42 células (o dado não muda o esqueleto)',
  conta(hMuitos, /class="cal-cel/g) === 42, conta(hMuitos, /class="cal-cel/g)); n++;
ok(n + '. a contagem do topo diz as 2.558, mesmo mostrando poucas',
  /<b>2\.558<\/b> sessões neste mês/.test(hMuitos), (hMuitos.match(/<b>[\d.]+<\/b> sess\w+/) || [])[0]); n++;
// Clicar duas vezes (F4): navegar duas vezes seguidas é o mesmo que navegar dois meses, e
// fechar o dia duas vezes não pode virar erro.
const C11 = contexto(); C11.api.irPara(2026, 7);
C11.api.calNav(1); C11.api.calNav(1);
ok(n + '. dois cliques em "próximo" andam dois meses (e não repetem um)',
  C11.api.mes()[1] === 9, C11.api.mes()); n++;
C11.api.calFecharDia(); C11.api.calFecharDia();
ok(n + '. fechar o dia duas vezes é inofensivo', C11.api.dia() === null); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
