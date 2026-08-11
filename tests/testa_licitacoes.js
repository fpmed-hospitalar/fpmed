// SUITE testa_licitacoes — funções puras da tela de Licitações (categorias e último dia útil).
// Extrai do fpmed_licitacoes.html, não recopia.
//   node tests/testa_licitacoes.js
'use strict';
const fs = require('fs'), path = require('path');
// CRLF -> LF: mesma razao explicada no testa_cruzamento_licitacoes.js.
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');

// A ancora de FIM da extracao da janela: o IIFE que aplica o padrao no DOM. Ele NAO entra na
// extracao (a suite nao tem DOM) e precisa ser unico no arquivo.
const FIM_JANELA = "(function(){\n  const j = janelaPadrao();";
function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora: ' + ini);
  return src.slice(s, e);
}
// `window` de mentira com o motor DE VERDADE: desde 10/08 a tela nao escreve mais `semAcento`,
// ela pega do fpmed_teto_cmed.js carregado no <head>.
const win = { LimedtecTetoCMED: require(path.join(__dirname, '..', 'fpmed_teto_cmed.js')) };
const ctx = (new Function('window',
  bloco('const { semAcento', 'const ymd =') +
  bloco('const CATEGORIAS =', 'function categorias') +
  bloco('function categorias', '// ══ PACK') +      // âncora movida: o bloco da ADERÊNCIA virou o cruzamento por item
  bloco('const ymd =', FIM_JANELA) +
  'return { categorias, janelaPadrao, semAcento };'))(win);
const { categorias, janelaPadrao } = ctx;

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? ' [' + JSON.stringify(got) + ']' : '')); } };
console.log('SUITE testa_licitacoes — categorias e data padrao\n');

// ── ETIQUETAS DE CATEGORIA ──
const objReal = 'FORNECIMENTO PARCELADO DE MEDICAMENTOS, MATERIAIS MÉDICO HOSPITALARES, INSUMOS LABORATORIAIS, MATERIAIS ODONTOLÓGICOS E DEMAIS ITENS CORRELATOS';
const c1 = categorias(objReal);
ok('objeto real de GO -> Medicamentos', c1.includes('Medicamentos'), c1);
ok('objeto real de GO -> Material hospitalar', c1.includes('Material hospitalar'), c1);
ok('objeto real de GO -> Insumos laboratoriais', c1.includes('Insumos laboratoriais'), c1);
ok('objeto real de GO -> Odontológico', c1.includes('Odontológico'), c1);

ok('acento não atrapalha (MÉDICO)', categorias('MATERIAL MÉDICO').includes('Material hospitalar'));
ok('minúscula funciona', categorias('aquisição de medicamentos').includes('Medicamentos'));
ok('soro -> Soros e soluções', categorias('SORO FISIOLOGICO 0,9%').includes('Soros e soluções'));
ok('psicotrópico -> Controle especial', categorias('MEDICAMENTOS PSICOTROPICOS').includes('Controle especial'));
ok('seringa -> Material hospitalar', categorias('SERINGAS E AGULHAS DESCARTAVEIS').includes('Material hospitalar'));

// ── CONTROLES: objeto fora do ramo não pode gerar etiqueta ──
ok('veículos -> nenhuma etiqueta', categorias('AQUISICAO DE VEICULOS ZERO KM').length === 0, categorias('AQUISICAO DE VEICULOS ZERO KM'));
ok('obra -> nenhuma etiqueta', categorias('REFORMA DE PRACA PUBLICA').length === 0, categorias('REFORMA DE PRACA PUBLICA'));
ok('objeto vazio -> nenhuma etiqueta', categorias('').length === 0);
ok('null nao quebra', categorias(null).length === 0);

/* ── A JANELA PADRÃO ──────────────────────────────────────────────────────────────────────
   Em 11/08 a regra deixou de ser "último dia útil" e passou a ser HOJE (com sexta→hoje no fim
   de semana). Os asserts antigos travavam a regra ANTIGA — "nunca é sábado", "é no passado" —
   e ela deixou de valer de propósito. O comportamento novo é testado NOS 7 DIAS DA SEMANA em
   tests/testa_janela_hoje.js, que é o lugar dele; aqui fica só o que esta suíte já cobria: que
   a função existe, devolve as duas pontas e não olha o relógio errado. */
const j = janelaPadrao();
ok('a janela padrão devolve as duas pontas', !!j.de && !!j.ate, j);
ok('as duas pontas são datas ISO', /^\d{4}-\d{2}-\d{2}$/.test(j.de) && /^\d{4}-\d{2}-\d{2}$/.test(j.ate), j);
ok('a ponta final é HOJE (nunca o passado, como era antes)',
  j.ate === new Date(new Date().setHours(12, 0, 0, 0)).toISOString().slice(0, 10), j);
ok('e o início nunca é depois do fim', j.de <= j.ate, j);

// ══════════ A TELA PRECISA SER ALCANCAVEL ══════════
// Achado de 05/08: o modulo estava COMPLETO e NO AR desde a rodada anterior, mas nao tinha
// link nenhum a partir do sistema_final. Estava no service worker e nos atalhos do manifest,
// e so — quem nao soubesse a URL de cor nao chegava nele. Funcionalidade pronta e invisivel
// nao existe pra quem usa, e e uma falha que nenhum teste de logica pega: tudo passa verde.
{
  const sf = require('fs').readFileSync(require('path').join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');
  ok('*** existe item de menu apontando pro fpmed_licitacoes.html ***',
    /nav-item[^>]*onclick="location\.href='fpmed_licitacoes\.html'"/.test(sf));
  ok('...na secao Sistemas, junto das outras telas standalone',
    sf.indexOf("nav-section\">Sistemas") < sf.indexOf("fpmed_licitacoes.html'\"") &&
    sf.indexOf("fpmed_licitacoes.html'\"") < sf.indexOf("fpmed_painel.html"));
  // a tela le a tabela cotacoes (RLS) — vendedor/propostas cairiam no "Sem permissao" do
  // gm-auth. Link que rejeita e pior que link ausente: some junto com os outros restritos.
  ok('...e some pra quem nao pode ver (mesmo gate da Competitividade)',
    /'competitividade','licitacoes'/.test(sf) || /'licitacoes'/.test(sf.slice(sf.indexOf('function espAplicaPermissao'), sf.indexOf('function espAplicaPermissao') + 600)));
  // continua na casca do PWA e nos atalhos do app instalado
  const sw = require('fs').readFileSync(require('path').join(__dirname, '..', 'sw.js'), 'utf8');
  ok('...e continua na casca do service worker (abre offline)', sw.includes("'./fpmed_licitacoes.html'"));
  // >>> O ATALHO DO MANIFEST SAIU EM 07/08, e o teste mudou junto porque a DECISAO mudou:
  //     atalho de app abre JANELA NOVA por padrao do sistema operacional, e o Lemuel relatou
  //     exatamente isso ("abre em outra janela independente"). A entrada da tela e o MENU, na
  //     mesma janela. Guardado pelo tests/testa_navegacao_janela.js.
  const menu = require('fs').readFileSync(require('path').join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');
  ok('...e tem entrada no MENU, abrindo na mesma janela',
    menu.includes("onclick=\"location.href='fpmed_licitacoes.html'\""));
  // e o caminho de volta, pra nao virar beco sem saida
  ok('a tela de Licitacoes tem o pill "← Sistema" de volta',
    /<a href="fpmed_sistema_final\.html">/.test(src));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
