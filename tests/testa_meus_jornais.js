// SUITE testa_meus_jornais — UMA BUSCA SALVA NAO PODE ENVELHECER, E "NADA NOVO" NAO PODE
// SIGNIFICAR "NAO CONSEGUI PERGUNTAR".
//
// Item 9, 3o pedaco (06/08/2026). Extrai as funcoes REAIS do fpmed_licitacoes.html — nao
// recopia nenhuma delas.
//
// O QUE ESTA SUITE PROTEGE, e o motivo de cada coisa:
//   1. JANELA DE DATA. O padrao da tela e "o ultimo dia util". Um jornal que guardasse essa data
//      como numero reabriria amanha pesquisando ONTEM, em silencio — a busca salva envelheceria
//      sozinha e ninguem perceberia. Por isso a janela padrao e guardada como TIPO ('movel') e
//      recalculada na abertura; a janela escolhida a mao e guardada como data e ANUNCIADA como
//      fixa. As duas direcoes estao travadas aqui.
//   2. O DELTA. "N novas desde a ultima leitura" so vale se `vistos` for respeitado. Um jornal
//      recem-salvo teria TUDO como novo — verdade formal, mentira pratica (ele acabou de ver
//      aquilo na tela). A 1a leitura nao marca nada.
//   3. LEITURA VAZIA NAO CARIMBA. Se o PNCP esta fora e a busca volta vazia, gravar "li tudo"
//      faria as licitacoes de HOJE nascerem velhas AMANHA. Este e o pior defeito possivel neste
//      modulo, porque some com oportunidade sem deixar rastro.
//   4. ERRO != ZERO. Com o banco fora, o jornal diz "nao sei", nunca "nada novo".
//   5. UM SO LUGAR LE O FORMULARIO. `filtrosDaTela()` alimenta o refino DA TELA e o filtro DO
//      JORNAL. Se fossem duas leituras, o primeiro filtro novo entraria so numa delas.
//
//   node tests/testa_meus_jornais.js
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const ddl = fs.readFileSync(path.join(__dirname, '..', 'ddl', 'jornais.sql'), 'utf8');
// >>> as regras do banco sao conferidas no SQL SEM COMENTARIO: um comentario que MENCIONA a
//     regra nao a aplica, e um teste que le comentario passa com a tabela errada.
const sql = ddl.replace(/--[^\n]*/g, '');

function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora: ' + ini);
  return src.slice(s, e);
}

// ── DOM de mentira: so o que as funcoes tocam. Assim o jornal roda fora do navegador sem virar
//    uma segunda copia do codigo dentro do teste.
const CAMPOS = {};
function campo(id) {
  if (CAMPOS[id] === undefined) CAMPOS[id] = { value: '', innerHTML: '', textContent: '',
    classList: { add(c) { this._c = c; }, remove() { this._c = null; } } };
  return CAMPOS[id];
}
const doc = { getElementById: id => (CAMPOS[id] === undefined ? null : CAMPOS[id]) };
// Desde 10/08 o bloco de constantes da tela abre com `const { semAcento, ... } =
// window.LimedtecTetoCMED` -- a tela carrega o motor em vez de escrever as funcoes de dose de
// novo. O `window` de mentira entrega o motor DE VERDADE, como no navegador.
const win = { LimedtecTetoCMED: require(path.join(__dirname, '..', 'fpmed_teto_cmed.js')) };
for (const id of ['f-kw', 'f-excluir', 'f-uf', 'f-mod', 'f-de', 'f-ate', 'f-portal', 'f-modo',
                  'f-sit', 'f-orgao', 'f-srp', 'f-vmin', 'f-vmax', 'jornais', 'jor-lista',
                  'jor-resumo', 'lk-jornais']) campo(id);

// ── rede de mentira: cada teste diz o que a proxima chamada devolve, e a suite le o que foi
//    enviado. E assim que da pra provar "nao gravou" sem banco nenhum.
const REDE = { chamadas: [], resposta: null };
async function fetchFalso(url, opt) {
  REDE.chamadas.push({ url, opt: opt || {} });
  return REDE.resposta || { ok: true, json: async () => ([]), text: async () => '' };
}
const PRELUDIO = `
  const SB_URL = 'http://banco.local';
  const SB_H = { apikey: 'x' };
  async function buscarNoBanco(uf, mod, de, ate){ window._ultimaJanela = {uf, mod, de, ate}; return window._BANCO; }
  function marcaDesertas(){}
  async function buscar(){ window._buscou = (window._buscou||0)+1; }
  function alert(m){ window._alerta = m; }
  function confirm(){ return window._confirma !== false; }
  function prompt(){ return window._prompt; }
`;

const ctx = (new Function('document', 'window', 'fetch',
  bloco('const brl =', '(function(){ const d=ultimoDiaUtil()') +
  bloco('const CRUZ = new Map()', 'function aderencia') +
  bloco('const _CAMPOS_REFINO', '// ══ ÓRGÃOS') +
  PRELUDIO +
  bloco('// ══ MEUS JORNAIS', '// Refino não vai à rede') +
  'return { filtrosDaTela, refinoDe, refino, janelaDe, resumoFiltros, aplicaFiltros, aplicaJornal,' +
  '         carregarJornais, pintaJornais, salvarJornal, excluirJornal, abrirJornal, registrarLeitura,' +
  '         conferirJornais, TETO_VISTOS, _numCtrl, casaRefino, iso, ultimoDiaUtil };'))(doc, win, fetchFalso);
const { filtrosDaTela, refinoDe, refino, janelaDe, resumoFiltros, aplicaFiltros, aplicaJornal,
        carregarJornais, pintaJornais, salvarJornal, excluirJornal, abrirJornal, registrarLeitura,
        conferirJornais, TETO_VISTOS, _numCtrl, iso, ultimoDiaUtil } = ctx;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_meus_jornais — busca salva, janela de data e o delta\n');

const HOJE = iso(ultimoDiaUtil());
function preenche(o) {
  for (const id of ['f-kw', 'f-excluir', 'f-portal', 'f-modo', 'f-sit', 'f-orgao', 'f-srp', 'f-vmin', 'f-vmax']) campo(id).value = '';
  campo('f-uf').value = 'GO'; campo('f-mod').value = '6';
  campo('f-de').value = HOJE; campo('f-ate').value = HOJE;
  for (const k in o) campo('f-' + k).value = o[k];
  win._soDesertas = !!(o && o._desertas);
  return filtrosDaTela();
}
const LIC = (o) => Object.assign({
  numeroControlePNCP: '01/2026', orgaoEntidade: { cnpj: '111', razaoSocial: 'MUNICIPIO DE URUACU' },
  unidadeOrgao: { nomeUnidade: 'SEC SAUDE', municipioNome: 'Uruaçu', ufSigla: 'GO' },
  anoCompra: 2026, sequencialCompra: 1, usuarioNome: 'BNC', modoDisputaNome: 'Aberto',
  situacaoCompraNome: 'Divulgada no PNCP', srp: true, valorTotalEstimado: 250000,
  objetoCompra: 'AQUISICAO DE MEDICAMENTOS',
}, o);

// ══════════ 1. A JANELA DE DATA — o defeito que envelheceria a busca em silencio ══════════
{
  const f1 = preenche({});
  ok('1. janela padrao (ultimo dia util) e guardada como MOVEL, nao como data',
    f1.janela.tipo === 'movel' && f1.janela.de === undefined, f1.janela);
  ok('2. *** jornal movel recalcula a data na abertura ***', janelaDe(f1).de === HOJE);
  // simula a virada do dia: o jornal guardado ontem tem que abrir com a data de HOJE
  ok('3. *** e continua recalculando: a janela movel nunca aponta pro passado ***',
    janelaDe({ janela: { tipo: 'movel' } }).de === HOJE && janelaDe({ janela: { tipo: 'movel' } }).ate === HOJE);
  const f2 = preenche({ de: '2026-08-01', ate: '2026-08-03' });
  ok('4. intervalo escolhido a mao e guardado como FIXO, com as duas datas',
    f2.janela.tipo === 'fixa' && f2.janela.de === '2026-08-01' && f2.janela.ate === '2026-08-03');
  ok('5. ...e a janela fixa e devolvida como foi salva', janelaDe(f2).de === '2026-08-01' && janelaDe(f2).ate === '2026-08-03');
  ok('6. jornal sem janela nenhuma cai no movel (nunca em data vazia)', janelaDe({}).de === HOJE);
  ok('7. *** o resumo AVISA que a janela e fixa — senao ninguem sabe que ela nao anda ***',
    resumoFiltros(f2).some(s => /FIXA/.test(s)) && !resumoFiltros(f1).some(s => /FIXA/.test(s)));
  ok('8. ...e o resumo da movel diz que ela se move', resumoFiltros(f1).some(s => /move sozinho/.test(s)));
}

// ══════════ 2. UM SO LUGAR LE O FORMULARIO ══════════
{
  const f = preenche({ kw: 'soro; luva', excluir: 'veiculo', portal: 'BNC', modo: 'Aberto',
                       sit: 'Anulada', orgao: 'uruacu', srp: 'so', vmin: '1000', vmax: '9000' });
  ok('9. filtrosDaTela captura os campos da busca (kw/excluir/uf/mod)',
    f.kw === 'soro; luva' && f.excluir === 'veiculo' && f.uf === 'GO' && f.mod === '6');
  ok('10. ...e TODOS os do refino, no mesmo objeto',
    f.portal === 'BNC' && f.modo === 'Aberto' && f.sit === 'Anulada' && f.orgao === 'uruacu' &&
    f.srp === 'so' && f.vmin === 1000 && f.vmax === 9000);
  const r = refino(), r2 = refinoDe(f);
  ok('11. *** o refino DA TELA e o refino DO JORNAL sao o mesmo objeto ***',
    JSON.stringify(r) === JSON.stringify(r2), { r, r2 });
  ok('12. o refino puro nao le o formulario (roda em segundo plano sem mexer na tela)',
    refinoDe({ portal: 'X' }).portal === 'X' && refinoDe({}).portal === '');
  ok('13. `;` continua sendo OU no campo de orgao', refinoDe({ orgao: 'uruacu; goiania' }).orgao.length === 2);
  ok('14. campo numerico vazio vira null (e nao 0, que cortaria licitacao)',
    refinoDe({ vmin: '', vmax: null }).vmin === null && refinoDe({ vmin: '', vmax: null }).vmax === null);
  ok('15. "so desertas" entra no jornal salvo', preenche({ _desertas: true }).desertas === true);
}

// ══════════ 3. IDA E VOLTA — salvar e reabrir tem que dar a MESMA busca ══════════
{
  const antes = preenche({ kw: 'medicamento', excluir: 'combustivel', modo: 'Fechado',
                           sit: 'Suspensa', orgao: 'goiania', srp: 'nao', vmin: '500', vmax: '4000' });
  preenche({});                       // limpa a tela, como se fosse outro dia
  aplicaFiltros(antes);
  const depois = filtrosDaTela();
  ok('16. *** reabrir o jornal devolve exatamente a busca salva ***',
    JSON.stringify(depois) === JSON.stringify(antes), { antes, depois });
  ok('17. o portal salvo NAO e escrito no campo (a opcao ainda nao existe): fica como desejo',
    (() => { win._portalDesejado = null; aplicaFiltros({ portal: 'BNC' }); return win._portalDesejado === 'BNC' && campo('f-portal').value === ''; })());
  ok('18. o "so desertas" volta ligado', (() => { win._soDesertas = false; aplicaFiltros({ desertas: true }); return win._soDesertas === true; })());
}

// ══════════ 4. O FILTRO DO JORNAL E O DA TELA ══════════
{
  const lista = [
    LIC({ numeroControlePNCP: 'A', objetoCompra: 'AQUISICAO DE MEDICAMENTOS' }),
    LIC({ numeroControlePNCP: 'B', objetoCompra: 'LOCACAO DE VEICULO' }),
    LIC({ numeroControlePNCP: 'C', objetoCompra: 'MATERIAL MEDICO HOSPITALAR', usuarioNome: 'BLL' }),
    LIC({ numeroControlePNCP: 'D', objetoCompra: 'MEDICAMENTOS E CORRELATOS', valorTotalEstimado: 0 }),
  ];
  const so = f => aplicaJornal(lista, f).map(_numCtrl);
  ok('19. jornal sem palavra-chave nao filtra por texto', so({}).length === 4);
  ok('20. palavra-chave e OU, com `;`', JSON.stringify(so({ kw: 'medicamento; hospitalar' })) === '["A","C","D"]', so({ kw: 'medicamento; hospitalar' }));
  ok('21. "excluir" tira quem tem o termo', so({ excluir: 'veiculo' }).indexOf('B') < 0);
  ok('22. o refino do jornal vale (portal)', JSON.stringify(so({ portal: 'BLL' })) === '["C"]');
  ok('23. *** licitacao SEM valor estimado nao some na faixa (a garantia do 4o pedaco) ***',
    so({ kw: 'medicamento', vmin: '1000000' }).indexOf('D') >= 0, so({ kw: 'medicamento', vmin: '1000000' }));
  ok('24. acento nao decide nada (URUACU x Uruaçu)', so({ orgao: 'uruaçu' }).length === 4);
}

// ══════════ 5. DDL — o que o banco tem que garantir ══════════
// (o delta em si e assincrono: esta no bloco 7, contra a rede de mentira)
ok('25. tabela jornais criada com `if not exists` (seguro re-rodar)', /create table if not exists public\.jornais/.test(sql));
ok('26. o dono e default auth.uid()', /usuario\s+uuid not null default auth\.uid\(\)/.test(sql));
ok('27. *** RLS ligada ***', /alter table public\.jornais enable row level security/.test(sql));
ok('28. *** as 4 policies sao de DONO — usuario = auth.uid() ***',
  (sql.match(/usuario = auth\.uid\(\)/g) || []).length >= 4);
ok('29. *** o jornal NAO e amarrado ao cargo: mudar de cargo nao pode sumir com trabalho salvo ***',
  !/cargo_gestor\(\)/.test(sql));
ok('30. anon nao le jornal de ninguem', /revoke all on public\.jornais from anon/.test(sql));
ok('31. nome unico por usuario (dois "Medicamentos GO" viram "qual e o meu?")',
  /create unique index if not exists jornais_usuario_nome_uk[\s\S]*lower\(nome\)/.test(sql));
ok('32. `vistos` nasce lista vazia e nao NULL (NULL viraria "tudo novo" na 1a conta)',
  /vistos\s+jsonb not null default '\[\]'::jsonb/.test(sql));
ok('33. o cache do PostgREST e recarregado (a pegadinha registrada no projeto)', /notify pgrst, 'reload schema'/.test(sql));
ok('34. on delete cascade: usuario apagado nao deixa jornal orfao', /references auth\.users\(id\) on delete cascade/.test(sql));

// ══════════ 6. A TELA — o que o operador ve ══════════
{
  ok('35. o link "Meus alertas" (aviso falso de V1.5) saiu da tela', !/Meus alertas entra na V1\.5/.test(src));
  ok('36. ...e virou "Meus Jornais", abrindo o painel', /onclick="abrirJornais\(\)" id="lk-jornais"/.test(src));
  ok('37. *** o painel diz de onde sai a leitura (nosso banco, 3x/dia) ***',
    /nosso banco<\/b>, que a coleta abastece 3× por dia/.test(src));
  // 10/08: o envio SAIU do "fora ate ele decidir" e virou boletim de verdade (modulo 2.14,
  // suite testa_boletim). O que a tela tem que dizer agora e outra coisa, e mais importante:
  // que o boletim e do dia FECHADO -- boletim disparado durante o dia perde, em silencio, o que
  // sai depois do corte. O texto velho nao pode voltar: ele desmentiria o botao ao lado.
  ok('38. *** o painel diz que o boletim e do dia anterior FECHADO ***',
    /anterior <b>fechado<\/b>/.test(src) && !/está fora até o Lemuel decidir/.test(src));
  ok('39. a marca NOVA existe no card', /class="bdg nova"/.test(src));
  ok('40. ...e ela carrega o motivo no title, como todo selo desta tela',
    /class="bdg nova" title="não estava no resultado da última vez/.test(src));
  ok('41. a 1a leitura anuncia que nao vai marcar nada', /primeira leitura deste jornal/.test(src));
  ok('42. *** "Atualizar agora" e o refino NAO desligam o jornal (perder as marcas no meio da leitura) ***',
    /function buscaNova\(\)\{ window\._jornalAtivo = null; buscar\(\); \}/.test(src) &&
    /function atualizarAgora\(\)\{ buscar\(true\); \}/.test(src));
  ok('43. a lupa e o "Aplicar e buscar" passam por buscaNova()',
    (src.match(/onclick="buscaNova\(\)"/g) || []).length >= 2);
  ok('44. o contador do link so aparece quando ha novidade (nunca "Meus Jornais (0)")',
    /total \? 'Meus Jornais \(' \+ total \+ ' novas\)' : 'Meus Jornais'/.test(src));
  ok('45. o painel dos jornais entra na mesma caixa dos outros dois', /#jornais\{display:none;background:var\(--painel\)/.test(src));
}

// ══════════ 7. ASSINCRONO — gravacao, delta e erro ══════════
(async () => {
  const lista = [LIC({ numeroControlePNCP: 'A' }), LIC({ numeroControlePNCP: 'B' }), LIC({ numeroControlePNCP: 'C' })];

  // ── 7a. LEITURA VAZIA NAO CARIMBA ──────────────────────────────────────────────────────
  REDE.chamadas = [];
  win._hits = [];
  await registrarLeitura({ id: 7, vistos: [] });
  ok('46. *** busca vazia (PNCP fora) NAO grava leitura — senao o de hoje nasce velho amanha ***',
    REDE.chamadas.length === 0, REDE.chamadas.map(c => c.url));
  win._hits = undefined;
  await registrarLeitura({ id: 7, vistos: [] });
  ok('47. ...e sem resultado nenhum na tela idem', REDE.chamadas.length === 0);

  // ── 7b. LEITURA COM RESULTADO GRAVA vistos + carimbo ────────────────────────────────────
  REDE.chamadas = []; REDE.resposta = { ok: true, json: async () => ([]), text: async () => '' };
  const j = { id: 7, vistos: ['A'] };
  win._hits = lista;
  await registrarLeitura(j);
  ok('48. leitura com resultado grava (1 PATCH)', REDE.chamadas.length === 1 && REDE.chamadas[0].opt.method === 'PATCH');
  const corpo = JSON.parse(REDE.chamadas[0].opt.body || '{}');
  ok('49. *** `vistos` acumula: o que ja era visto + o que apareceu agora ***',
    JSON.stringify(corpo.vistos.slice().sort()) === '["A","B","C"]', corpo.vistos);
  ok('50. ...sem repetir o que ja estava la', corpo.vistos.filter(x => x === 'A').length === 1);
  ok('51. carimba a hora da leitura e quantas bateram', !!corpo.ultima_leitura && corpo.ultimo_total === 3);
  ok('52. o objeto em memoria e atualizado junto (a lista nao mente ate o proximo F5)',
    j.ultimo_total === 3 && j.vistos.length === 3);

  // ── 7c. TETO DE `vistos` ────────────────────────────────────────────────────────────────
  REDE.chamadas = [];
  const muitos = Array.from({ length: TETO_VISTOS + 50 }, (_, i) => 'V' + i);
  win._hits = lista;
  await registrarLeitura({ id: 9, vistos: muitos });
  const c2 = JSON.parse(REDE.chamadas[0].opt.body);
  ok('53. `vistos` tem teto (nao cresce sem fim)', c2.vistos.length === TETO_VISTOS, c2.vistos.length);
  ok('54. ...e o teto guarda o MAIS RECENTE (o que acabou de ser visto nao pode ser cortado)',
    c2.vistos.indexOf('A') >= 0 && c2.vistos.indexOf('C') >= 0);

  // ── 7d. O CONTADOR EM SEGUNDO PLANO ─────────────────────────────────────────────────────
  REDE.resposta = { ok: true, text: async () => '', json: async () => ([
    { id: 1, nome: 'Nunca aberto', filtros: {}, vistos: [], ultima_leitura: null },
    { id: 2, nome: 'Ja aberto', filtros: {}, vistos: ['A'], ultima_leitura: '2026-08-05T10:00:00Z', ultimo_total: 1 },
  ]) };
  await carregarJornais();
  win._BANCO = lista;
  win._novasPorJornal = {};
  await conferirJornais();
  ok('55. *** jornal NUNCA ABERTO nao entra no contador (tudo seria novo e nada seria) ***',
    win._novasPorJornal[1] === undefined, win._novasPorJornal);
  ok('56. *** jornal ja aberto conta so o que nao estava em `vistos` ***',
    win._novasPorJornal[2] && win._novasPorJornal[2].novas === 2, win._novasPorJornal[2]);
  ok('57. o link do topo ganha o total', campo('lk-jornais').textContent === 'Meus Jornais (2 novas)', campo('lk-jornais').textContent);
  ok('58. a conta le a janela do jornal, sem data escrita a mao no codigo',
    win._ultimaJanela && win._ultimaJanela.de === HOJE.replace(/-/g, ''), win._ultimaJanela);

  // nada novo -> o link volta ao normal
  REDE.resposta = { ok: true, text: async () => '', json: async () => ([
    { id: 2, nome: 'Ja aberto', filtros: {}, vistos: ['A', 'B', 'C'], ultima_leitura: '2026-08-05T10:00:00Z' }]) };
  await carregarJornais(); win._novasPorJornal = {}; await conferirJornais();
  ok('59. sem novidade, o link nao mostra "(0 novas)"', campo('lk-jornais').textContent === 'Meus Jornais');
  ok('60. ...e a linha do jornal diz "nada novo"', /nada novo/.test(campo('jor-lista').innerHTML));

  // ── 7e. ERRO NAO E ZERO ────────────────────────────────────────────────────────────────
  win._BANCO = null;                       // banco fora
  win._novasPorJornal = {};
  await conferirJornais();
  ok('61. *** banco fora: o jornal diz NAO SEI, nunca "nada novo" ***',
    win._novasPorJornal[2] && win._novasPorJornal[2].erro && win._novasPorJornal[2].novas === undefined,
    win._novasPorJornal[2]);
  ok('62. ...e a tela imprime isso', /não sei dizer agora/.test(campo('jor-lista').innerHTML));
  ok('63. ...e o link nao inventa numero', campo('lk-jornais').textContent === 'Meus Jornais');
  win._BANCO = lista;

  // lista de jornais nao lida (sessao caida): a tela avisa, nao finge lista vazia
  REDE.resposta = { ok: false, status: 401, text: async () => '', json: async () => ({}) };
  await carregarJornais(); pintaJornais();
  ok('64. *** nao consegui LER os jornais: avisa, nao mostra "nenhum ainda" ***',
    /não consegui ler os seus jornais/.test(campo('jor-resumo').textContent), campo('jor-resumo').textContent);

  // ── 7f. SALVAR ─────────────────────────────────────────────────────────────────────────
  REDE.chamadas = []; REDE.resposta = { ok: true, text: async () => '', json: async () => ([{ id: 3, nome: 'X', filtros: {}, vistos: [] }]) };
  preenche({ kw: 'soro' });
  win._prompt = '  Soros GO  ';
  await salvarJornal();
  const post = REDE.chamadas.find(c => c.opt.method === 'POST');
  ok('65. salvar manda POST com o nome aparado', post && JSON.parse(post.opt.body).nome === 'Soros GO');
  ok('66. *** e salva a BUSCA INTEIRA, nao so as palavras-chave ***',
    post && JSON.parse(post.opt.body).filtros.kw === 'soro' && JSON.parse(post.opt.body).filtros.janela.tipo === 'movel');
  REDE.chamadas = []; win._prompt = '';
  await salvarJornal();
  ok('67. nome vazio nao salva nada', REDE.chamadas.length === 0);
  REDE.chamadas = []; win._prompt = 'Repetido';
  REDE.resposta = { ok: false, status: 409, text: async () => 'duplicate key value violates unique constraint ... 23505', json: async () => ({}) };
  await salvarJornal();
  ok('68. *** nome repetido vira frase em portugues, nao codigo do Postgres ***',
    /já tem um jornal com esse nome/.test(win._alerta || ''), win._alerta);

  // ── 7g. EXCLUIR — so com confirmacao, e so o dele ──────────────────────────────────────
  REDE.resposta = { ok: true, text: async () => '', json: async () => ([{ id: 5, nome: 'Pra apagar', filtros: {}, vistos: [] }]) };
  await carregarJornais();
  REDE.chamadas = []; win._confirma = false;
  await excluirJornal(5);
  ok('69. *** cancelar a confirmacao nao apaga nada ***', REDE.chamadas.length === 0);
  win._confirma = true;
  await excluirJornal(5);
  const del = REDE.chamadas.find(c => c.opt.method === 'DELETE');
  ok('70. confirmar apaga por id', del && /jornais\?id=eq\.5/.test(del.url));

  // ── 7h. ABRIR ──────────────────────────────────────────────────────────────────────────
  REDE.resposta = { ok: true, text: async () => '', json: async () => ([
    { id: 8, nome: 'Meu', filtros: { kw: 'luva', janela: { tipo: 'movel' } }, vistos: ['A'], ultima_leitura: '2026-08-05T10:00:00Z' }]) };
  await carregarJornais();
  win._buscou = 0; win._hits = lista;
  await abrirJornal(8);
  ok('71. abrir preenche a tela com o jornal', campo('f-kw').value === 'luva' && campo('f-de').value === HOJE);
  ok('72. ...e busca pelo caminho normal da tela (o jornal nao tem consulta propria)', win._buscou === 1);
  ok('73. *** o contexto do jornal fica ligado, com os vistos dele ***',
    win._jornalAtivo && win._jornalAtivo.id === 8 && win._jornalAtivo.vistos.has('A') && win._jornalAtivo.primeira === false);

  REDE.resposta = { ok: true, text: async () => '', json: async () => ([
    { id: 9, nome: 'Novo', filtros: {}, vistos: [], ultima_leitura: null }]) };
  await carregarJornais();
  win._hits = lista;
  await abrirJornal(9);
  ok('74. *** jornal nunca aberto abre marcado como PRIMEIRA leitura ***',
    win._jornalAtivo && win._jornalAtivo.primeira === true);

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  if (f) process.exit(1);
})();
