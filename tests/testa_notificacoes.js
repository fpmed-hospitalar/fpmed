// SUITE testa_notificacoes — O SINO NAO PODE DEIXAR PASSAR, NEM GRITAR A TOA.
//
// Item 9, 2o pedaco (Agenda + Notificacoes): a agenda ja entrou na 1a etapa; aqui entra o sino.
// Extrai as funcoes REAIS do fpmed_negocios.html (nao recopia).
//
// AS TRES COISAS QUE ESTA SUITE PROTEGE:
//   1. FUSO. `new Date('2026-08-06') < hoje` da TRUE em Goias (a string vira meia-noite UTC =
//      21h do dia ANTERIOR no -03). Esse defeito ja arquivou uma licitacao real na semeadura
//      de 06/08 -- e no sino ele faria a sessao de HOJE AS 8H nao ser avisada.
//   2. O BADGE NAO PODE FICAR ACESO PRA SEMPRE. Se o numero somasse as atrasadas, ele nunca
//      zeraria -- e badge que nunca zera e badge que ninguem mais olha.
//   3. "NENHUM AVISO" E "NAO SEI" NAO SAO A MESMA TELA. Com a leitura do banco falhando, a
//      lista vem vazia; dizer "nada abre hoje" ali seria mentir com cara de calmaria.
//
//   node tests/testa_notificacoes.js
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');

function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora: ' + ini);
  return src.slice(s, e);
}
const ctx = (new Function(
  bloco('const hojeYMD =', 'async function carregar') +
  'return { notificacoes, emDias, diaDe, hojeYMD };'))();
const { notificacoes, emDias, diaDe, hojeYMD } = ctx;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_notificacoes — o sino do funil\n');

// helper: monta uma abertura no dia D+k, na hora pedida, no fuso LOCAL (que e o de Goias na
// maquina do Lemuel). E o mesmo timestamptz que o banco devolve.
function abertura(k, hora, min) {
  const d = new Date(); d.setDate(d.getDate() + k); d.setHours(hora, min || 0, 0, 0);
  return d.toISOString();
}
const neg = (o) => ({ id: o.id || 1, orgao: 'MUNICIPIO DE URUACU', estagio: 'oportunidade',
                      arquivado: false, portal: 'BNC', numero: '32/2026', municipio: 'Uruaçu', ...o });

// ══════════ 1. A JANELA: HOJE E AMANHA ══════════
{
  const l = [
    neg({ id: 1, abertura: abertura(0, 8) }),        // abre hoje 08:00
    neg({ id: 2, abertura: abertura(1, 14) }),       // amanha
    neg({ id: 3, abertura: abertura(2, 9) }),        // depois de amanha: fora
    neg({ id: 4, abertura: abertura(-3, 9), estagio: 'oportunidade' }),  // passou
  ];
  const n = notificacoes(l);
  ok('1. *** o que abre HOJE entra ***', n.hoje.length === 1 && n.hoje[0].id === 1, n.hoje.map(x=>x.id));
  ok('2. o que abre AMANHA entra', n.amanha.length === 1 && n.amanha[0].id === 2);
  ok('3. depois de amanha NAO entra (sino e do dia, a Agenda e do mes)',
    !n.hoje.concat(n.amanha).some(x => x.id === 3));
  ok('4. *** o badge conta so hoje + amanha ***', n.urgentes === 2, n.urgentes);
  ok('5. ...e NAO soma as atrasadas (badge que nunca zera ninguem mais olha)',
    n.passou.length === 1 && n.urgentes === 2, [n.passou.length, n.urgentes]);
}

// ══════════ 2. FUSO — o defeito que ja mordeu este projeto ══════════
{
  // sessao HOJE as 08:00 e sessao HOJE as 22:00: as duas sao HOJE no calendario de quem usa.
  const l = [neg({ id: 1, abertura: abertura(0, 8) }), neg({ id: 2, abertura: abertura(0, 22) })];
  const n = notificacoes(l);
  ok('6. *** a sessao das 8h de HOJE e avisada como hoje ***', n.hoje.some(x=>x.id===1), n.hoje.map(x=>x.id));
  ok('7. *** e a das 22h de HOJE tambem (fatiar o ISO jogaria ela pro dia seguinte em UTC) ***',
    n.hoje.some(x=>x.id===2), n.hoje.map(x=>x.id));
  ok('8. nenhuma das duas cai em "passou"', n.passou.length === 0, n.passou.length);
}
ok('9. emDias(0) e o dia LOCAL de hoje', emDias(0) === hojeYMD(), [emDias(0), hojeYMD()]);
ok('10. emDias anda um dia de cada vez', (() => {
  const a = new Date(emDias(0) + 'T12:00:00'), b = new Date(emDias(1) + 'T12:00:00');
  return Math.round((b - a) / 86400000) === 1;
})());
ok('11. emDias atravessa a virada de mes sem inventar dia 32', /setDate\(d\.getDate\(\) \+ k\)/.test(src));

// ══════════ 3. O QUE **NAO** PODE APARECER ══════════
{
  const l = [
    neg({ id: 1, abertura: abertura(0, 9), arquivado: true }),
    neg({ id: 2, abertura: null }),
    neg({ id: 3 }),
  ];
  const n = notificacoes(l);
  ok('12. *** negocio ARQUIVADO nao avisa (senao o historico de 2.544 linhas gritaria todo dia) ***',
    n.urgentes === 0 && n.hoje.length === 0, n.hoje.length);
  ok('13. negocio sem data de abertura nao vira aviso', n.amanha.length === 0 && n.passou.length === 0);
  ok('14. lista vazia nao quebra', notificacoes([]).urgentes === 0);
  ok('15. lista indefinida nao quebra (a tela chama antes do carregar terminar)',
    notificacoes(undefined).urgentes === 0 && notificacoes(null).hoje.length === 0);
}

// ══════════ 4. "A SESSAO PASSOU E O NEGOCIO NAO ANDOU" ══════════
// Nao e enfeite: e o aviso de que alguem esqueceu de mover o cartao -- ou de participar.
{
  const l = [
    neg({ id: 1, abertura: abertura(-2, 9), estagio: 'oportunidade' }),
    neg({ id: 2, abertura: abertura(-2, 9), estagio: 'qualificacao' }),
    neg({ id: 3, abertura: abertura(-2, 9), estagio: 'disputa' }),
    neg({ id: 4, abertura: abertura(-2, 9), estagio: 'classificacao' }),
    neg({ id: 5, abertura: abertura(-2, 9), estagio: 'contrato' }),
  ];
  const n = notificacoes(l);
  ok('16. *** so avisa quem ficou nas fases ANTERIORES a disputa ***',
    n.passou.map(x=>x.id).join(',') === '1,2', n.passou.map(x=>x.id));
  ok('17. quem ja esta em Disputa/Classificacao/Contrato nao e atraso (o processo andou)',
    !n.passou.some(x => [3,4,5].includes(x.id)));
}

// ══════════ 5. ORDEM — o dia se le de cima pra baixo pela HORA ══════════
{
  const l = [neg({ id: 1, abertura: abertura(0, 15) }), neg({ id: 2, abertura: abertura(0, 8) }),
             neg({ id: 3, abertura: abertura(0, 11) })];
  ok('18. *** o que abre primeiro aparece primeiro ***',
    notificacoes(l).hoje.map(x=>x.id).join(',') === '2,3,1', notificacoes(l).hoje.map(x=>x.id));
}
{
  const l = [neg({ id: 1, abertura: abertura(-9, 9) }), neg({ id: 2, abertura: abertura(-2, 9) })];
  ok('19. nas atrasadas, a mais recente primeiro (a que ainda da pra salvar)',
    notificacoes(l).passou.map(x=>x.id).join(',') === '2,1', notificacoes(l).passou.map(x=>x.id));
}

// ══════════ 6. AS DECISOES, NA FONTE ══════════
ok('20. *** a notificacao e DERIVADA do fato: nao existe tabela de notificacao ***',
  /NÃO TEM TABELA/.test(src) && !/rest\/v1\/notificacoes/.test(src));
ok('21. ...e o motivo esta escrito (fila guardada avisaria de sessao que ja aconteceu)',
  /avisaria de sessão que já\s*(\n\/\/\s*)?aconteceu/.test(src));
ok('22. *** nao existe "marcar como lida" ***', !/marcar como lida|marcarLida|lida\s*=\s*true/i.test(src)
  || /NÃO EXISTE "MARCAR COMO LIDA"/.test(src));
ok('23. ...porque dispensar esconderia a sessao que abre hoje as 8h', /esconder a sessão que abre\s*\n?\/\/\s*hoje|abre\s*\n\/\/\s*hoje às 8h|hoje às 8h/.test(src));
ok('24. o sino conta o funil inteiro, nao o que os filtros deixaram na tela',
  /pintaNotif\(\);\s+\/\/ o sino conta o funil inteiro/.test(src));
ok('25. *** com erro de leitura o sino diz "NAO SEI", nao "nada abre hoje" ***',
  /não sei<\/b> o que abre hoje/.test(src) && /não são a mesma coisa/.test(src));
ok('26. o painel avisa que so mostra negocio ATIVO', /arquivado não avisa/.test(src));
// >>> ESTE ASSERT MUDOU DE LADO EM 08/08, e e a melhor razao possivel pra um teste mudar: ele
//     exigia que o sino DISSESSE que nao sabia avisar sobre vencimento de documento, porque
//     "Meus Documentos" nao existia. O modulo entrou (ddl/documentos.sql + fpmed_documentos.html)
//     e a ausencia deixou de existir. Agora ele exige o AVISO DE VERDADE no lugar do bilhete.
//     A regra por tras e a mesma dos dois lados: o sino nao pode ficar calado sobre um risco.
ok('27. *** o vencimento de documento agora AVISA de verdade (era so um bilhete de ausencia) ***',
  !/Vencimento de documento da empresa ainda não entra aqui/.test(src)
  && /d\.situacao === 'vencido' \|\| d\.situacao === 'vencendo'/.test(src)
  && /habilitação — resolver antes da próxima sessão/.test(src));
ok('27b. ...e falha ao ler documento vira "nao sei", como o resto do sino',
  /não sei<\/b> se há certidão vencendo/.test(src));
ok('28. clicar no aviso abre o negocio', /function irPara\(id\)/.test(src) && /abrirDrawer\(id\)/.test(src));
ok('29. clicar fora fecha o painel', /!e\.target\.closest\('\.sino-cx'\)/.test(src));
ok('30. o badge some quando nao ha nada urgente', /cnt\.style\.display = total \? '' : 'none'/.test(src));
// O badge passou a somar documento vencido/vencendo (08/08). A distincao esta no proprio codigo:
// sessao ATRASADA nao entra porque nao tem mais conserto -- o numero ficaria aceso pra sempre;
// certidao vencida entra porque fica acesa ate alguem RESOLVER, e resolver e possivel hoje.
ok('31. *** documento entra no badge; sessao atrasada continua fora ***',
  /const total = n\.urgentes \+ docsRuins;/.test(src) && /urgentes: hojeL\.length \+ amanhaL\.length/.test(src));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
