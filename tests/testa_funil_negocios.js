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
  bloco('const hojeYMD =', 'async function carregar') +
  bloco('function agenda(', '// ── drag-and-drop') +
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
// 3. AS 15 TAREFAS-MODELO (spec 6.2) — nascem com o negócio
// ══════════════════════════════════════════════════════════════════════════════════════════
const t = novasTarefas();
ok('são 15 tarefas', t.length === 15, t.length);
ok('todas nascem por fazer', t.every(x => x.feita === false));
ok('toda tarefa tem seção válida', t.every(x => FASES.includes(x.secao)));
const porSecao = {}; t.forEach(x => porSecao[x.secao] = (porSecao[x.secao] || 0) + 1);
ok('3 na Oportunidade', porSecao.oportunidade === 3, porSecao.oportunidade);
ok('3 na Qualificação', porSecao.qualificacao === 3, porSecao.qualificacao);
ok('4 na Disputa', porSecao.disputa === 4, porSecao.disputa);
ok('4 na Classificação', porSecao.classificacao === 4, porSecao.classificacao);
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
ok('o cabeçalho do dia traz o dia da semana', /class="sem">(domingo|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado)</.test(html));
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
const fnFicha = bloco('const ficha = `<dl class="ficha">', '</dl>`;');
['portal', 'orgao', 'numero', 'abertura'].forEach(c =>
  ok('o card mostra ' + c, fnCard.includes('n.' + c)));
[['Portal', 'n.portal'], ['Modalidade', 'n.modalidade'], ['Número', 'n.numero'], ['Órgão', 'n.orgao'],
 ['Abertura', 'n.abertura'], ['Objeto', 'n.objeto']].forEach(([rot, campo]) => {
  ok('a ficha do drawer traz ' + rot, fnFicha.includes("'" + rot + "'") && fnFicha.includes(campo));
});
ok('a abertura do card sai com data E hora', /fmtDtH\(n\.abertura\)/.test(fnCard));
ok('fmtDtH escreve "DD/MM/AAAA às HH:MM"', / às /.test(bloco('function fmtDtH(iso){', '\nconst DIA_SEM')));

// *** VALOR GANHO É DE GESTOR *** — a RLS já restringe a tabela inteira, mas a tela não pode
// depender só disso: um dia a leitura afrouxa pra vendedor por uma view e o número vazaria junto.
ok('*** o card só mostra o valor ganho pra gestor ***', /n\.valor_ganho>0 && ehGestor\(\)/.test(fnCard));
ok('*** a ficha só mostra o valor ganho pra gestor ***',
  /gestor && n\.valor_ganho > 0 \? linha\('Valor ganho'/.test(src));
ok('o KPI de total ganho também é de gestor', /\$\{gestor \? `<div class="kpi"><b[^`]*brl\(total\)/.test(src));
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
ok('marcar tarefa desfaz na falha', /n\.tarefas\[i\]\.feita = antes/.test(src));
ok('arquivar grava', /gravar\(id, \{ arquivado:true \}\)/.test(src));
ok('*** existe DESARQUIVAR — é como a linha arquivada por engano volta ***',
  /async function desarquivar\(id\)/.test(src) && /arquivado:false/.test(src));
ok('...e quem volta pro funil volta com o checklist', /campos\.tarefas = novasTarefas\(\)/.test(src));
ok('o PATCH carimba atualizado_em', /atualizado_em: new Date\(\)\.toISOString\(\)/.test(src));
ok('403 no PATCH explica que só gestor grava', /só gestor grava no funil/.test(src));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 8. A TELA PRECISA SER ALCANÇÁVEL (mesma lição do testa_licitacoes: pronta e invisível não existe)
// ══════════════════════════════════════════════════════════════════════════════════════════
{
  const sf = fs.readFileSync(path.join(raiz, 'fpmed_sistema_final.html'), 'utf8');
  ok('*** existe item de menu apontando pro fpmed_negocios.html ***',
    /nav-item[^>]*onclick="location\.href='fpmed_negocios\.html'"/.test(sf));
  ok('...e some pra quem não pode ver (mesmo gate da Competitividade e do Licitações)',
    /'licitacoes','compra-direta','negocios'/.test(sf) || /'negocios'/.test(sf.slice(sf.indexOf('function espAplicaPermissao'), sf.indexOf('function espAplicaPermissao') + 800)));
  const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
  ok('...e está na casca do service worker (abre offline)', sw.includes("'./fpmed_negocios.html'"));
  const mf = fs.readFileSync(path.join(raiz, 'manifest.webmanifest'), 'utf8');
  ok('...e no atalho do aplicativo instalado', mf.includes('fpmed_negocios.html'));
  ok('a tela de Negócios tem o pill "← Sistema" de volta', /<a href="fpmed_sistema_final\.html">/.test(src));
  ok('...e o caminho pro Licitações, que é o irmão dela no módulo', /<a href="fpmed_licitacoes\.html">/.test(src));
}

// ── tema: esta tela é dona da própria paleta (regressão de 05/08) ──
ok('o <html> declara data-tema="dark"', /<html lang="pt-BR" data-tema="dark">/.test(src));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
