// SUITE testa_funil_negocios — o funil de Negócios (item 9, 06/08/2026).
//
// A REGRA DE OURO QUE ESTA SUITE PROTEGE (Lemuel, 06/08): "a planilha Calendário 2025 é COMO A
// FPMED TRABALHA — o funil espelha o processo deles, não inventa um novo". Traduzido em teste:
//   1. os 9 status que existem de verdade nas 2.555 linhas TÊM destino declarado, e status novo
//      PARA a semeadura em vez de cair num default silencioso;
//   2. a agenda é cronológica por DATA e por HORA, que é como eles leem a planilha hoje;
//   3. os campos que eles já usam (portal, órgão, número, data/hora, valor ganho) estão no card
//      e na ficha, e o valor ganho é de gestor;
//   4. o que era anotado à mão tem onde ser anotado — e a observação velha não é sobrescrita.
//
// Extrai as funções REAIS do tools/semeia_negocios.js e do fpmed_negocios.html — não recopia.
//   node tests/testa_funil_negocios.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');

/* ── ALCANCE (12/08, navegação única) ──────────────────────────────────────────────────────
   A barra do portal morreu: as sete entradas dela agora saem só do menu lateral. Estes asserts
   sempre protegeram "há caminho daqui pra tela X", e não "existe uma <nav class=portal>" — a
   barra era o MEIO, o alcance é o FIM. O predicado abaixo aceita os dois meios e não afrouxa
   nenhum: pelo menu, exige que a tela MONTE o menu, CARREGUE o script, e que o destino esteja
   declarado lá. Três condições, não uma. */
const _MENU_SRC = require('fs').readFileSync(require('path').join(raiz, 'limedtec-menu.js'), 'utf8');
const alcanca = (src, destino) => {
  const d = destino.replace(/\./g, '\\.');
  if (new RegExp('href="' + d + '"').test(src)) return true;             // caminho direto na tela
  return /limedtec-menu\.js/.test(src)                                   // a tela carrega o menu
      && /data-limedtec-menu/.test(src)                                  // ...e o monta
      && new RegExp("href: '" + d + "'").test(_MENU_SRC);                // ...e o menu leva lá
};

// CRLF -> LF: mesma razao explicada no testa_cruzamento_licitacoes.js.
const src = fs.readFileSync(path.join(raiz, 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');
const semeia = require(path.join(raiz, 'tools', 'semeia_negocios.js'));
const { MAPA_STATUS, faseDe, arquivar, ymd, novasTarefas, TAREFAS_MODELO, FASES } = semeia;

function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora: ' + ini);
  return src.slice(s, e);
}
// `card` vira um selo com o id: a agenda é testada pela ORDEM que produz, não pelo HTML do card.
const ctx = (new Function(
  'const card = n => "[" + n.id + "]";' +
  /* `esc` mora ACIMA da âncora `const hojeYMD =`, e a agenda passou a precisar dele em 14/08:
     a linha de prazo do kit escreve texto de tarefa e nome de órgão dentro do HTML. Extraí-lo
     junto (em vez de recopiar um escape aqui) é a mesma regra do resto desta suíte — o que se
     testa é o código que está no ar, e um segundo escape aqui poderia divergir do de lá. */
  bloco('const esc = s =>', 'const brl =') +
  bloco('const hojeYMD =', 'async function carregar') +
  /* A ÂNCORA DE FIM ERA `// ── drag-and-drop`, e o calendário mensal (item 6) nasceu ENTRE os
     dois — então esta extração passou a arrastar junto um bloco que não é dela, inclusive um
     `window.addEventListener` que não existe aqui dentro. Ela agora para na porta do
     calendário, que tem suíte própria (testa_calendario). Extração por âncora é assim: quem
     escreve código no meio precisa saber que a âncora existe, e por isso ela é uma linha
     inteira e não um pedaço de palavra. */
  bloco('function agenda(', '// ══ [ANCORA] daqui pra baixo e o CALENDARIO MENSAL') +
  'return { agenda, hojeYMD, diaDe, horaDe, rotuloDia, fmtDtH };'))();
const { agenda, hojeYMD, diaDe, horaDe, rotuloDia } = ctx;

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? ' [' + JSON.stringify(got) + ']' : '')); } };
console.log('SUITE testa_funil_negocios — mapa de status, agenda e ficha do negócio\n');

// ══════════════════════════════════════════════════════════════════════════════════════════
// 1. NENHUM STATUS DA PLANILHA FICA SEM DESTINO
// Os 9 abaixo foram levantados do banco em 06/08 (2.555 linhas). A lista é o CONTRATO: se a
// planilha trouxer um décimo, esta suite fica vermelha antes de alguém descobrir na tela.
// ══════════════════════════════════════════════════════════════════════════════════════════
const STATUS_REAIS = {
  'DESCARTADO': 1779, 'PARTICIPOU': 693, 'SUSPENSO': 27, 'PARTICIPAR': 22,
  'NAO PARTICIPOU': 13, 'EM ANALISE': 11, 'REVOGADO': 4, 'ADIADO': 4, 'CANCELADO': 2,
};
ok('os 9 status reais somam as 2.555 linhas', Object.values(STATUS_REAIS).reduce((a, b) => a + b, 0) === 2555,
  Object.values(STATUS_REAIS).reduce((a, b) => a + b, 0));
Object.keys(STATUS_REAIS).forEach(s =>
  ok('status "' + s + '" tem destino declarado no MAPA_STATUS', !!MAPA_STATUS[s]));
ok('o mapa não tem status inventado além dos 9 reais',
  Object.keys(MAPA_STATUS).every(s => s in STATUS_REAIS), Object.keys(MAPA_STATUS).filter(s => !(s in STATUS_REAIS)));
ok('toda entrada do mapa aponta pra uma das 5 fases',
  Object.values(MAPA_STATUS).every(m => FASES.includes(m.fase)));

// *** O default silencioso é o defeito que esta suite existe pra impedir ***
// Antes de 06/08 um status desconhecido virava 'oportunidade' sem avisar: a licitação entrava
// no funil na fase errada e ninguém tinha como perceber.
let lancou = false;
try { faseDe('STATUS QUE NAO EXISTE', 0); } catch (e) { lancou = /SEM DESTINO/.test(e.message); }
ok('*** status desconhecido PARA a semeadura, não cai em default ***', lancou);
lancou = false;
try { arquivar('OUTRO INVENTADO', '2026-08-20', new Date()); } catch (e) { lancou = /SEM DESTINO/.test(e.message); }
ok('...e o arquivar também recusa status fora do mapa', lancou);

// ── as traduções, uma a uma (é o mapeamento que o Lemuel pediu por escrito) ──
ok('EM ANALISE -> oportunidade', faseDe('EM ANALISE', null) === 'oportunidade', faseDe('EM ANALISE', null));
ok('PARTICIPAR -> qualificacao', faseDe('PARTICIPAR', null) === 'qualificacao', faseDe('PARTICIPAR', null));
ok('SUSPENSO -> qualificacao (parado, mas vivo)', faseDe('SUSPENSO', null) === 'qualificacao');
ok('ADIADO -> qualificacao (remarcado, mas vivo)', faseDe('ADIADO', null) === 'qualificacao');
ok('PARTICIPOU sem valor -> classificacao', faseDe('PARTICIPOU', null) === 'classificacao');
ok('DESCARTADO -> oportunidade (morreu na análise)', faseDe('DESCARTADO', null) === 'oportunidade');
ok('NAO PARTICIPOU -> oportunidade', faseDe('NAO PARTICIPOU', null) === 'oportunidade');
ok('REVOGADO -> oportunidade', faseDe('REVOGADO', null) === 'oportunidade');
ok('CANCELADO -> oportunidade', faseDe('CANCELADO', null) === 'oportunidade');

// O RESULTADO manda no estágio: 105 linhas têm VALOR GANHO, e 1 delas ficou em 'PARTICIPAR' na
// planilha (o status parou antes do resultado sair). O dinheiro é o fato mais forte.
ok('*** valor ganho > 0 -> contrato, seja qual for o status ***', faseDe('PARTICIPOU', 12345) === 'contrato');
ok('...inclusive quando a planilha ficou em PARTICIPAR', faseDe('PARTICIPAR', 291013.5) === 'contrato');
ok('valor ganho 0 não promove pra contrato', faseDe('PARTICIPOU', 0) === 'classificacao');
ok('valor ganho null não promove pra contrato', faseDe('PARTICIPOU', null) === 'classificacao');

// ══════════════════════════════════════════════════════════════════════════════════════════
// 2. O DEFEITO DE FUSO — a licitação que abre HOJE não pode nascer arquivada
// `new Date('2026-08-06') < hoje` dá TRUE em GO: a string vira meia-noite UTC = 21h do dia
// anterior no fuso -03. Na semeadura de 06/08 isso arquivou a sessão das 08:00 no BLL — a mais
// urgente do funil inteiro. Comparação por TEXTO 'YYYY-MM-DD' não tem fuso.
// ══════════════════════════════════════════════════════════════════════════════════════════
const HOJE = new Date(2026, 7, 6, 14, 30);        // 06/08/2026, horário local
ok('*** abertura HOJE fica ATIVA (o defeito de 06/08) ***', arquivar('EM ANALISE', '2026-08-06', HOJE) === false);
ok('...também às 23h do dia, quando o UTC já virou', arquivar('EM ANALISE', '2026-08-06', new Date(2026, 7, 6, 23, 59)) === false);
ok('abertura amanhã fica ativa', arquivar('EM ANALISE', '2026-08-07', HOJE) === false);
ok('abertura ontem é arquivada', arquivar('EM ANALISE', '2026-08-05', HOJE) === true);
ok('virada de ano não confunde a comparação', arquivar('EM ANALISE', '2027-01-01', new Date(2026, 11, 31, 10)) === false);
ok('status morto arquiva mesmo com abertura no futuro', arquivar('DESCARTADO', '2026-12-31', HOJE) === true);
ok('PARTICIPOU arquiva (a sessão já aconteceu, por definição)', arquivar('PARTICIPOU', '2026-12-31', HOJE) === true);
ok('sem data de abertura, arquiva', arquivar('EM ANALISE', null, HOJE) === true);
ok('ymd() de string ISO longa pega só a data', ymd('2026-08-06T09:00:00-03:00') === '2026-08-06', ymd('2026-08-06T09:00:00-03:00'));
ok('ymd() de Date usa o dia LOCAL', ymd(new Date(2026, 7, 6, 23, 30)) === '2026-08-06', ymd(new Date(2026, 7, 6, 23, 30)));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 3. O KIT DE TAREFAS-MODELO (spec 6.2) — nasce com o negócio
// >>> ERAM 15 ATÉ 14/08, E VIRARAM 14 (fatia A14). "Enviar proposta atualizada" saiu do kit em
//     11/08 porque virou BOTÃO de verdade na fase Habilitação — checkbox que duplica ação real
//     pode ficar marcado enquanto a proposta ajustada não foi anexada, e aí o checklist afirma
//     o que não aconteceu. A tela do Negócios já tinha tirado; o semeador foi alinhado agora.
//     Os 2.555 registros já gravados continuam com 15 e NÃO foram tocados.
// ══════════════════════════════════════════════════════════════════════════════════════════
const t = novasTarefas();
ok('são 14 tarefas', t.length === 14, t.length);
ok('todas nascem por fazer', t.every(x => x.feita === false));
ok('toda tarefa tem seção válida', t.every(x => FASES.includes(x.secao)));
const porSecao = {}; t.forEach(x => porSecao[x.secao] = (porSecao[x.secao] || 0) + 1);
ok('3 na Oportunidade', porSecao.oportunidade === 3, porSecao.oportunidade);
ok('3 na Qualificação', porSecao.qualificacao === 3, porSecao.qualificacao);
ok('4 na Disputa', porSecao.disputa === 4, porSecao.disputa);
// 3, e não 4: a quarta era "Enviar proposta atualizada", que virou botão em 11/08.
ok('3 na Classificação', porSecao.classificacao === 3, porSecao.classificacao);
ok('1 no Contrato', porSecao.contrato === 1, porSecao.contrato);
ok('as 5 fases têm ao menos uma tarefa', FASES.every(k => porSecao[k] > 0));
ok('novasTarefas() devolve objeto novo a cada chamada (senão 2 negócios dividem o checklist)',
  novasTarefas()[0] !== novasTarefas()[0]);
// a lista da TELA precisa ser a mesma da SEMEADURA — dois checklists diferentes num sistema só
// é o tipo de divergência que ninguém nota até o card mostrar 0/15 e o drawer 0/12.
const modeloHtml = bloco('const TAREFAS_MODELO = [', '];');
TAREFAS_MODELO.forEach(([, texto]) =>
  ok('a tela tem a tarefa "' + texto.slice(0, 34) + '…"', modeloHtml.includes(texto)));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 4. AGENDA — por DATA e por HORA, como eles acompanham hoje
// ══════════════════════════════════════════════════════════════════════════════════════════
const H = hojeYMD();
const [ha, hm, hd] = H.split('-').map(Number);
const iso = (dias, hora, min) => {
  const d = new Date(ha, hm - 1, hd + dias, hora, min || 0);
  return d.toISOString();
};
const LOTE = [
  { id: 1, abertura: iso(2, 14, 0), portal: 'BLL' },
  { id: 2, abertura: iso(2, 8, 0),  portal: 'BNC' },
  { id: 3, abertura: iso(1, 9, 30), portal: 'GOV.BR' },
  { id: 4, abertura: iso(0, 16, 0), portal: 'BLL' },   // hoje, mais tarde
  { id: 5, abertura: iso(0, 7, 0),  portal: 'GOV.BR' },// hoje, cedo
  { id: 6, abertura: iso(-3, 10, 0), portal: 'BLL' },  // passado
  { id: 7, abertura: iso(-1, 11, 0), portal: 'BNC' },  // passado, mais recente
  { id: 8, abertura: null, portal: 'PROPRIO' },        // sem data: não entra na agenda
];
const html = agenda(LOTE);
const ordem = (html.match(/\[(\d+)\]/g) || []).map(s => s.replace(/\D/g, '')).map(Number);
ok('*** dentro do dia, ordena por HORA crescente (07:00 antes de 16:00) ***',
  ordem.indexOf(5) < ordem.indexOf(4), ordem);
ok('*** os dias futuros vêm em ordem cronológica ***',
  ordem.indexOf(4) < ordem.indexOf(3) && ordem.indexOf(3) < ordem.indexOf(2), ordem);
ok('...e dentro do dia +2 a hora manda de novo (08:00 antes de 14:00)',
  ordem.indexOf(2) < ordem.indexOf(1), ordem);
ok('o que já passou vai pra seção própria, depois do futuro',
  ordem.indexOf(7) > ordem.indexOf(1) && ordem.indexOf(6) > ordem.indexOf(1), ordem);
ok('...e o passado vem do mais recente pro mais antigo', ordem.indexOf(7) < ordem.indexOf(6), ordem);
ok('negócio sem data de abertura não entra na agenda', !ordem.includes(8), ordem);
ok('a agenda tem cabeçalho de dia', /class="ag-dia/.test(html));
ok('*** a HORA aparece em coluna própria, não escondida no texto ***', /class="ag-hora">\d\d:\d\d</.test(html));
ok('o dia de hoje é destacado', /class="ag-dia hoje"/.test(html));
/* A INICIAL SUBIU EM 12/08, e o motivo importa: o dia da semana era capitalizado por
   `text-transform:capitalize` no CSS, que sobe TODA palavra — a Agenda imprimia
   "Quarta-Feira" desde 06/08. Quem capitaliza agora é o `M1`, que sobe só a primeira letra.
   O assert continua cobrando a MESMA promessa (o cabeçalho diz que dia da semana é), com a
   inicial maiúscula porque agora ela vem do JavaScript e não da folha de estilo. */
ok('o cabeçalho do dia traz o dia da semana', /class="sem">(Domingo|Segunda-feira|Terça-feira|Quarta-feira|Quinta-feira|Sexta-feira|Sábado)</.test(html));
ok('e ele não é mais capitalizado pelo CSS, que subia as duas palavras ("Quarta-Feira")',
  !/class="sem">[^<]*-[A-Z]/.test(html), (html.match(/class="sem">[^<]*/) || [])[0]);
ok('agenda vazia não quebra', /Nenhum negócio com data/.test(agenda([{ id: 9, abertura: null }])));
ok('agenda só com passado ainda mostra o histórico', /Já passaram/.test(agenda([LOTE[5]])));

// ── helpers de data da tela ──
ok('diaDe usa o dia LOCAL (sessão das 22h não escorrega pro dia seguinte)',
  diaDe(new Date(ha, hm - 1, hd, 22, 0).toISOString()) === H, diaDe(new Date(ha, hm - 1, hd, 22, 0).toISOString()));
ok('diaDe(null) = null', diaDe(null) === null);
ok('horaDe devolve HH:MM', /^\d\d:\d\d$/.test(horaDe(iso(0, 9, 30))), horaDe(iso(0, 9, 30)));
ok('horaDe respeita o minuto', horaDe(iso(0, 9, 30)).endsWith(':30'), horaDe(iso(0, 9, 30)));
ok('rotuloDia formata DD/MM/AAAA', rotuloDia('2026-08-06').data === '06/08/2026', rotuloDia('2026-08-06').data);
ok('rotuloDia acerta o dia da semana (06/08/2026 = quinta)', rotuloDia('2026-08-06').semana === 'quinta-feira', rotuloDia('2026-08-06').semana);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 5. OS CAMPOS QUE ELES JÁ USAM ESTÃO NO CARD E NA FICHA
// ══════════════════════════════════════════════════════════════════════════════════════════
const fnCard  = bloco('function card(n, noKanban)', 'function kanban(');
// >>> A ANCORA MUDOU DUAS VEZES EM UM DIA, as duas por DECISAO de produto: de manha a ficha
//     virou `editavel ? <form> : <dl>`, e a tarde a de leitura foi REMOVIDA — a de campo a
//     campo serve os dois casos (quem nao grava so nao recebe o botao "Alterar"). O bloco agora
//     vai do `const ficha` ate o fechamento dele. O que o teste protege segue igual: os campos
//     que a FPMED usa na planilha tem que estar no card E na ficha.
const fnFicha = bloco('const ficha = `<div class="ficha-fc">', '</div>`;');
['portal', 'orgao', 'numero', 'abertura'].forEach(c =>
  ok('o card mostra ' + c, fnCard.includes('n.' + c)));
[['Abertura', 'abertura'], ['Situação', 'situacao'], ['Portal', 'portal'], ['Número', 'numero'],
 ['Órgão', 'orgao'], ['Objeto', 'objeto'], ['Valor estimado', 'valor_estimado']].forEach(([rot, k]) => {
  ok('a ficha do drawer traz ' + rot,
    fnFicha.includes("campo('" + k + "'") && fnFicha.includes("'" + rot + "'"));
});
ok('a ficha traz o municipio (nao editavel: veio da fonte)', fnFicha.includes('Município'));
ok('*** e o valor ganho, so pra gestor ***', /\$\{gestor \? campo\('valor_ganho'/.test(fnFicha));
ok('a abertura do card sai com data E hora', /fmtDtH\(n\.abertura\)/.test(fnCard));
ok('fmtDtH escreve "DD/MM/AAAA às HH:MM"', / às /.test(bloco('function fmtDtH(iso){', '\nconst DIA_SEM')));

// *** VALOR GANHO É DE GESTOR *** — a RLS já restringe a tabela inteira, mas a tela não pode
// depender só disso: um dia a leitura afrouxa pra vendedor por uma view e o número vazaria junto.
ok('*** o card só mostra o valor ganho pra gestor ***', /n\.valor_ganho>0 && ehGestor\(\)/.test(fnCard));
// a forma mudou (a ficha virou campo a campo em 08/08), o GATE nao: valor ganho e resultado
// comercial e continua so pra gestor.
ok('*** a ficha só mostra o valor ganho pra gestor ***',
  /\$\{gestor \? campo\('valor_ganho'/.test(src));
// 11/08: as caixinhas viraram BOTÕES (`class="kpi bt"` + onclick). O que este assert protege é o
// mesmo — o total ganho é valor comercial e só aparece pra gestor.
/* A FORMA mudou de novo em 13/08 (as caixinhas ganharam a anatomia do molde e passaram a ser
   montadas por uma função), o GATE não: total ganho é valor comercial e continua só pra gestor.
   O assert cobrava a marcação inteira escrita à mão; agora cobra o gate em volta da chamada. */
ok('o KPI de total ganho também é de gestor',
  /\(gestor \? _ind\('total'[\s\S]{0,200}?brl\(k\.total\)/.test(src));
ok('ehGestor() assume o mais restrito quando o gm-auth ainda não subiu',
  /const ehGestor = \(\) => !!\(window\.gmAuth && window\.gmAuth\.isGestor/.test(src));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 6. O QUE ERA ANOTADO À MÃO TEM ONDE SER ANOTADO
// A observação da planilha (954 das 2.555 linhas têm uma) é HISTÓRICO: entra só leitura, num
// bloco separado. Se ela caísse dentro do campo editável, a primeira digitação apagaria a
// memória que a empresa levou um ano pra escrever.
// ══════════════════════════════════════════════════════════════════════════════════════════
ok('o drawer tem campo de anotações editável', /<textarea class="anot" id="dw-anot"/.test(src));
ok('a anotação é gravada na coluna `anotacoes` do negócio', /gravar\(id, \{ anotacoes:/.test(src));
ok('a anotação salva ao sair do campo', /onblur="salvaAnot\(/.test(src));
ok('*** a observação da planilha entra em bloco PRÓPRIO, só leitura ***',
  /Observação do Calendário 2025/.test(src) && /class="dw-obs"/.test(src));
ok('...e o texto avisa que é histórico não editável', /histórico, não editável aqui/.test(src));
ok('...e vem da licitacoes_acompanhadas, não da coluna de anotação',
  /licitacoes_acompanhadas\?id=eq\.\$\{n\.acompanhada_id\}&select=observacao/.test(src));
ok('a observação é buscada sob demanda, não no load da tela',
  src.indexOf('async function abrirDrawer') < src.indexOf('licitacoes_acompanhadas?id=eq.'));
ok('falha ao buscar a observação não derruba o drawer', /catch\(e\)\{ \/\* observação é enfeite útil/.test(src));
ok('anotação que não salvou avisa pra copiar o texto antes de sair', /copie o texto antes de sair/.test(src));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 7. O QUE A TELA GRAVA, GRAVA MESMO (e desfaz quando não grava)
// ══════════════════════════════════════════════════════════════════════════════════════════
ok('mover no kanban grava', /await gravar\(id, \{ estagio: fase \}\)/.test(src));
ok('...e volta o card pro lugar se a gravação falhar', /n\.estagio = antes; pinta\(\)/.test(src));
ok('mudar o estágio pelo drawer também desfaz na falha', /n\.estagio = antes; abrirDrawer\(id\)/.test(src));
// 11/08: o CHECKLIST FIXO das 15 tarefas saiu da tela (decisao do Lemuel — a equipe nao usa),
// e com ele a `marcaTarefa`. Nao ha mais o que desfazer porque nao ha mais o que marcar.
// O que o assert protege agora e o que ficou no lugar: o DADO nao foi apagado.
ok('o checklist fixo saiu da TELA, nao do BANCO', /Some da tela, não do banco/.test(src));
/* ESTE ASSERT COBRAVA O LITERAL `gravar(id, { arquivado:true })` ATE 21/08 — e cobrar o literal
   era cobrar o defeito. Aquele objeto era TUDO o que o botao gravava: sem carimbo, sem autor, sem
   origem, ou seja, a decisao de uma pessoa entrando no banco identica as 2.551 linhas que a
   importacao arquivou sozinha. A fatia B34 tirou a regra da tela e a pos no motor; o assert
   passou a cobrar o CAMINHO, e o conteudo dos campos e cobrado no testa_arquivar_rastro.js. */
ok('arquivar grava o que o MOTOR mandou (e nao um objeto escrito na tela)',
  /gravar\(id, p\.campos\)/.test(src) && /E\.pedidoArquivarNegocio\(/.test(src));
ok('*** existe DESARQUIVAR — é como a linha arquivada por engano volta ***',
  /async function desarquivar\(id\)/.test(src) && /E\.pedidoDesarquivar\(/.test(src));
// E desarquivar NAO cria mais as 15: com o checklist fora da tela, isso gravaria dado que
// ninguem ve — e dado invisivel e o que um dia alguem acha e nao sabe se vale.
ok('...e quem volta pro funil NAO ganha checklist invisivel',
  !/campos\.tarefas = novasTarefas\(\)/.test(src) && /novo não se cria/.test(src));
ok('o PATCH carimba atualizado_em', /atualizado_em: new Date\(\)\.toISOString\(\)/.test(src));
ok('403 no PATCH explica que só gestor grava', /só gestor grava no funil/.test(src));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 8. A TELA PRECISA SER ALCANÇÁVEL (mesma lição do testa_licitacoes: pronta e invisível não existe)
// ══════════════════════════════════════════════════════════════════════════════════════════
{
  const sf = fs.readFileSync(path.join(raiz, 'fpmed_sistema_final.html'), 'utf8');
  // >>> A ROTA MUDOU EM 08/08 (decisao do Lemuel), e o teste muda junto porque quem mudou foi a
  //     DECISAO: o menu lateral tem UMA entrada -- "Licitacoes" -- e Negocios e uma ABA dentro
  //     dela. Duas entradas pro mesmo modulo faziam o operador escolher a porta antes de saber o
  //     que ia fazer, e voltar ao menu toda vez que quisesse ir da busca pro funil.
  //     A tela continua tendo que ser ALCANCAVEL (a licao de "pronta e invisivel nao existe") --
  //     o que mudou e POR ONDE.
  ok('*** Negocios NAO tem entrada propria no menu lateral (uma porta so pro modulo) ***',
    !/nav-item[^>]*onclick="location\.href='fpmed_negocios\.html'"/.test(sf));
  const lic = fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8');
  ok('*** ...e e alcancavel de dentro de Licitacoes (menu lateral, desde 12/08) ***',
    alcanca(lic, 'fpmed_negocios.html'));
  // >>> REAPONTADO EM 12/08: a barra do portal morreu no Negocios (navegacao unica). A promessa
  //     e "o caminho de volta existe", nao "existe uma <nav class=portal>".
  ok('*** e o caminho de volta existe: do Negocios se chega ao Encontrar ***',
    alcanca(fs.readFileSync(path.join(raiz, 'fpmed_negocios.html'), 'utf8'), 'fpmed_licitacoes.html'));
  ok('link antigo nao morre: ?aba=negocios cai na aba certa',
    /aba === 'negocios'[\s\S]{0,80}location\.replace\('fpmed_negocios\.html'\)/.test(lic));
  ok('...e some pra quem não pode ver (mesmo gate da Competitividade e do Licitações)',
    /'licitacoes','compra-direta','negocios'/.test(sf) || /'negocios'/.test(sf.slice(sf.indexOf('function espAplicaPermissao'), sf.indexOf('function espAplicaPermissao') + 800)));
  const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
  ok('...e está na casca do service worker (abre offline)', sw.includes("'./fpmed_negocios.html'"));
  // >>> O ATALHO DO MANIFEST SAIU EM 07/08, e o teste mudou junto porque a DECISAO mudou:
  //     atalho de app abre JANELA NOVA por padrao do sistema operacional, e o Lemuel relatou
  //     exatamente isso ("abre em outra janela independente"). A entrada da tela e o MENU, na
  //     mesma janela. Guardado pelo tests/testa_navegacao_janela.js.
  // (esta linha ja mudou DUAS vezes em 2 dias, e as duas por decisao de produto, nao por
  //  defeito: 07/08 o atalho do manifest saiu; 08/08 a entrada de menu virou aba do portal.
  //  O que ela protege desde sempre e o mesmo: a tela tem que ser ALCANCAVEL de algum lugar.)
  ok('...e e alcancavel de Licitacoes, na mesma janela',
    alcanca(fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8'), 'fpmed_negocios.html'));
  ok('a tela de Negócios tem o pill "← Sistema" de volta', /<a href="fpmed_sistema_final\.html">/.test(src));
  ok('...e o caminho pro Licitações, que é o irmão dela no módulo', alcanca(src, 'fpmed_licitacoes.html'));
}

/* ── TEMA ── REAPONTADO EM 12/08, e aqui a promessa VIROU DE LADO, não foi só o meio que mudou.
   O assert antigo era `o <html> declara data-tema="dark"`, e ele guardava uma regressão real de
   05/08: o tema do cliente entrava como style inline no <html> e vencia o :root desta tela,
   porque ela tinha PALETA PRÓPRIA. O `data-tema` era a declaração "não escreva cor aqui".
   >>> A CONDIÇÃO QUE O JUSTIFICAVA ACABOU. A tela não tem mais paleta própria: ela vive sobre o
       fpmed_tema.css, como as outras. Manter o `data-tema` agora seria blindar contra o tema do
       cliente uma tela que DEVE seguir o tema do cliente — ou seja, o assert estaria guardando o
       contrário do que a casa decidiu.
   O que fica cobrado é o que importa hoje: ela carrega o design system e não voltou a ter uma
   paleta paralela com valor próprio. */
// a cobranca e na ETIQUETA <html>, e nao na palavra solta: o comentario que EXPLICA a mudanca
// cita `data-tema="dark"` pra contar o que saiu — e assert que proibe falar do que saiu apaga a
// explicacao junto com o codigo. (Mesma armadilha que ja mordeu no testa_alarme_email hoje.)
ok('a tela carrega o design system (e nao tem mais paleta propria)',
  /<link rel="stylesheet" href="fpmed_tema\.css">/.test(src) && !/<html[^>]*data-tema/.test(src));
ok('...e os apelidos do legado APONTAM pra token, sem valor proprio',
  /--painel:\s*var\(--branco\)/.test(src) && /--texto:\s*var\(--cinza-800\)/.test(src));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
