// ══════════════════════════════════════════════════════════════════════════════
// SUITE DE OURO — regressao permanente dos erros historicos reais da cotacao.
// SO LEITURA. Extrai as funcoes REAIS do fpmed_giovana.html (nao recopia) e
// roda cada bug ja corrigido como assert. Se algum voltar a falhar, aparece aqui.
//
//   node tests/testa_ouro.js
//
// >>> REPO PUBLICO: fixtures usam PRECOS FICTICIOS e rotulos genericos de fornecedor
//     (FORN_A/B...). Os nomes de PRODUTO sao descricoes genericas de item medico
//     (necessarias pro teste), nao segredo. Nenhum preco de atacado real, nenhum
//     nome de concorrente. NUNCA colocar preco real / nome de fornecedor aqui.
// ══════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, '..', 'fpmed_giovana.html');
const src = fs.readFileSync(HTML, 'utf8');
const lines = src.split(/\r?\n/);

function block(startNeedle, endNeedle, inclusiveEnd) {
  const s = lines.findIndex(l => l.includes(startNeedle));
  if (s < 0) throw new Error('ancora inicio nao achada: ' + startNeedle);
  let e = -1;
  for (let i = s + 1; i < lines.length; i++) { if (lines[i].includes(endNeedle)) { e = i; break; } }
  if (e < 0) throw new Error('ancora fim nao achada: ' + endNeedle);
  return lines.slice(s, inclusiveEnd ? e + 1 : e).join('\n');
}

// Bloco A: _undNum -> qtdEmbalagem -> pareceCaixa* -> pv -> ehGlobalComEstoque -> incluiNaBusca (util preco/qtd/filtro de carga)
const rangeA = block('function _undNum(und)', 'let searchTO', false);
// Bloco B: cluster _bm* (norma/forma/dose/discriminadores/material) + buscarMelhorProduto
const rangeB = block('const _bmStrip = s =>', '/* ─── busca antiga', false);

const factorySrc =
  'let cotacoes = [];\n' +
  'let _bmCmed = new Map();\n' +
  'console.warn = function(){};\n' +
  rangeA + '\n' + rangeB + '\n' +
  'return {\n' +
  '  api: { buscarMelhorProduto, _bmMatchMat, _bmForma, _bmDoses, qtdEmbalagem, pareceCaixaPeer, _bmMaterial, _bmFormaCand, incluiNaBusca },\n' +
  '  setCot: function(a){ cotacoes = a; },\n' +
  '  setCmed: function(m){ _bmCmed = m; }\n' +
  '};';
const ctx = (new Function(factorySrc))();
const { buscarMelhorProduto, _bmMatchMat, _bmForma, qtdEmbalagem, pareceCaixaPeer } = ctx.api;

let pass = 0, fail = 0; const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; fails.push(name + (extra ? '  ['+extra+']' : '')); console.log('  FALHA  ' + name + (extra ? '  ['+extra+']' : '')); }
}
const R = (produto, o) => Object.assign({ produto, principio_ativo:'', und:'', compra_unit:'', global_venda1:'', tipo:'fornecedor', fornecedor:'FORN_A', estoque:'0' }, o||{});
function busca(cot, q) { ctx.setCot(cot); return buscarMelhorProduto(q); }
const nome = r => r ? r.produto : null;

console.log('SUITE DE OURO — erros historicos reais (regressao)\n');

// 1) SALONPAS -> ByeByeFever  (adesivo generico exige palavra distintiva)
{
  const cot = [ R('ADESIVO FEBRE BYE BYE FEVER BEBE PCT C/2UN', {compra_unit:'4.00', fornecedor:'FORN_A'}) ];
  ok('1. SALONPAS nao casa ByeByeFever (retorna null)', busca(cot,'ADESIVO SALONPAS') === null, 'veio: '+nome(busca(cot,'ADESIVO SALONPAS')));
}

// 2) ALMOTOLIA -> agua oxigenada  (recipiente generico sozinho nao vira o conteudo)
{
  const cot = [ R('AGUA OXIGENADA 10VL 100ML ALMOTOLIA', {compra_unit:'2.50', fornecedor:'FORN_B'}) ];
  ok('2. ALMOTOLIA nao casa agua oxigenada (retorna null)', busca(cot,'ALMOTOLIA 100ML') === null, 'veio: '+nome(busca(cot,'ALMOTOLIA 100ML')));
}

// 3) GUIA nao casa dentro de GUIAT  (palavra inteira no _bmMatchMat)
{
  ok('3a. GUIA != C/GUIAT (palavra inteira)', _bmMatchMat('GUIA', 'SONDA ALIMENTACAO ENTERAL NUT P N.12FR C/GUIAT') === false);
  ok('3b. GUIA casa C/ GUIA (controle positivo)', _bmMatchMat('GUIA', 'CATETER C/ GUIA METALICA') === true);
}

// 4) ASPIRACAO != ENDOTRAQUEAL  (familia de subtipo de sonda)
{
  ok('4a. SONDA ASPIRACAO != ENDOTRAQUEAL', _bmMatchMat('SONDA ASPIRACAO TRAQUEAL N.14', 'SONDA ENDOTRAQUEAL DESC. N.14 C/BL') === false);
  ok('4b. SONDA ENDOTRAQUEAL != ASPIRACAO (simetrico)', _bmMatchMat('SONDA ENDOTRAQUEAL N.8', 'SONDA ASPIRA. TRAQ. S/VALV. N.8 CX300') === false);
}

// 5) AZITROMICINA DIHIDRATADA (dicionario) casa AZITROMICINA (fornecedor)
{
  const cot = [ R('AZITROMICINA 500MG C/3 COMP', {principio_ativo:'AZITROMICINA', compra_unit:'1.00', fornecedor:'FORN_A'}) ];
  const r = busca(cot, 'AZITROMICINA DIHIDRATADA 500MG COMPRIMIDO');
  ok('5. AZITROMICINA DIHIDRATADA casa AZITROMICINA 500MG cpr', !!r && /AZITROMICINA 500/.test(nome(r)), 'veio: '+nome(r));
}

// 6) CLORETO DE SUXAMETONIO (dicionario) casa SUXAMETONIO (fornecedor)
{
  const cot = [ R('SUXAMETONIO 100MG/ML INJ', {principio_ativo:'SUXAMETONIO', compra_unit:'5.00', fornecedor:'FORN_A'}) ];
  const r = busca(cot, 'CLORETO DE SUXAMETONIO 100MG/ML INJETAVEL');
  ok('6. CLORETO DE SUXAMETONIO casa SUXAMETONIO', !!r && /SUXAMETONIO/.test(nome(r)), 'veio: '+nome(r));
}

// 7) ARTRINID IV (injetavel) nao casa ARTRINID cpr (oral)  — IM/IV x oral
{
  const cot = [
    R('ARTRINID IV NJ.100MG IV CX50 FR PÓ', {principio_ativo:'CETOPROFENO', compra_unit:'3.00', fornecedor:'FORN_A'}),
    R('ARTRINID 50MG C/24 CPR',            {principio_ativo:'', compra_unit:'0.40', fornecedor:'FORN_B'}),
  ];
  const r = busca(cot, 'ARTRINID IV 100MG');
  ok('7. ARTRINID IV 100MG casa o INJETAVEL, nao o cpr oral', !!r && /IV/.test(nome(r)) && !/C\/24 CPR/.test(nome(r)), 'veio: '+nome(r));
}

// 8) injetavel x oral (forma como barreira) — pantoprazol ; IM/IV = INJETAVEL
{
  ok('8a. _bmForma INJETAVEL', _bmForma('PANTOPRAZOL 40MG INJETAVEL') === 'INJETAVEL');
  ok('8b. _bmForma SOLIDO_ORAL', _bmForma('PANTOPRAZOL 40MG COMPRIMIDO') === 'SOLIDO_ORAL');
  ok('8c. IM e IV ambos INJETAVEL', _bmForma('DRUG 10MG IM') === 'INJETAVEL' && _bmForma('DRUG 10MG IV') === 'INJETAVEL');
  const cot = [
    R('PANTOPRAZOL 40MG COMPRIMIDO REV', {principio_ativo:'PANTOPRAZOL', compra_unit:'0.35', fornecedor:'FORN_B'}),
    R('PANTOPRAZOL 40MG PO LIOF INJ FA', {principio_ativo:'PANTOPRAZOL', compra_unit:'2.00', fornecedor:'FORN_A'}),
  ];
  const r = busca(cot, 'PANTOPRAZOL 40MG INJETAVEL');
  ok('8d. pedido injetavel nao pega o comprimido', !!r && /INJ/.test(nome(r)) && !/COMPRIMIDO/.test(nome(r)), 'veio: '+nome(r));
}

// 9) teste DENGUE NS1 != teste COVID AG  (familia de analito)
{
  ok('9a. DENGUE NS1 != COVID ANTIGENO', _bmMatchMat('TESTE RAPIDO DENGUE NS1', 'KIT TESTE COVID-19 ANTIGENO PCT20') === false);
  ok('9b. DENGUE NS1 casa DENGUE NS1 (controle)', _bmMatchMat('TESTE RAPIDO DENGUE NS1', 'TESTE RAPIDO DENGUE NS1 AG CX25') === true);
}

// 10) VENVANSE granularidade — qtd da caixa lida do nome (CX28 / C/30)
{
  ok('10a. VENVANSE CX28 -> 28', qtdEmbalagem('', '*VENVANSE 50MG CX28 CAPS (A3)') === 28, 'veio: '+qtdEmbalagem('', '*VENVANSE 50MG CX28 CAPS (A3)'));
  ok('10b. LISDEXANFETAMINA C/30 -> 30', qtdEmbalagem('', 'LISDEXANFETAMINA 30MG C/30 CPS (A3) (GEN)') === 30, 'veio: '+qtdEmbalagem('', 'LISDEXANFETAMINA 30MG C/30 CPS (A3) (GEN)'));
}

// 11) divisao dupla — unit que e' preco de CAIXA e' flagrado pelo peer (precos ficticios)
{
  const cot = [
    R('GEN AZITROMICINA 500MG CX 30COMP', {principio_ativo:'AZITROMICINA', compra_unit:'40', fornecedor:'FORN_G'}),   // unit = caixa (bug)
    R('AZITROMICINA 500MG C/3 COMP',      {principio_ativo:'AZITROMICINA', compra_unit:'1.00', fornecedor:'FORN_A'}),
    R('AZITROMICINA 500MG C/5 COMP',      {principio_ativo:'AZITROMICINA', compra_unit:'1.20', fornecedor:'FORN_B'}),
    R('AZITROMICINA 500MG CPR',           {principio_ativo:'AZITROMICINA', compra_unit:'1.50', fornecedor:'FORN_C'}),
  ];
  ctx.setCot(cot);
  const flag = pareceCaixaPeer('GEN AZITROMICINA 500MG CX 30COMP', '', 'AZITROMICINA', 40);
  ok('11. unit=caixa (40/30comp) flagrado como caixa pelo peer', !!flag && flag.qtd === 30, 'veio: '+JSON.stringify(flag));
}

// 12) AGUA grau INJETAVEL (esteril/apirogenica/injecao = paciente) != AGUA de EQUIPAMENTO (autoclave)
//     Seguranca do paciente. Na duvida entre aguas de uso diferente -> null. (FASE 2, veredito Lemuel)
{
  const cot = [ R('AGUA P/ AUTOCLAVE 5L', {compra_unit:'8.00', fornecedor:'FORN_A'}) ];
  const r = busca(cot, 'AGUA DESTILADA ESTERIL APIROGÊNICA 5L FRA');
  ok('12a. AGUA esteril apirogenica NAO casa AGUA autoclave (null)', r === null, 'veio: '+nome(r));
  // controle positivo: agua injetavel (esteril/apiro) casa agua p/ injecao (mesmo grau INJ)
  const cot2 = [ R('AGUA PARA INJECAO 5L SISTEMA FECHADO', {compra_unit:'9.00', fornecedor:'FORN_B'}) ];
  const r2 = busca(cot2, 'AGUA DESTILADA ESTERIL APIROGENICA 5L');
  ok('12b. AGUA esteril apirogenica casa AGUA p/ injecao (controle, mesmo grau)', !!r2 && /INJECAO/.test(nome(r2)), 'veio: '+nome(r2));
}

// 13) REGRA data-de-hoje: NUNCA new Date().toISOString().split/slice (UTC vira o dia de madrugada
//     em UTC-3). Sempre hojeLocalISO(). Guard de fonte — quebra se alguem reintroduzir o bug.
{
  const bug = /new Date\(\)\.toISOString\(\)\.(split|slice)/.test(src);
  ok('13. sem toISOString().split/slice p/ data-de-hoje (usar hojeLocalISO)', !bug, bug?'reintroduzido':'');
}

// 14) COMPLEXO nao fuzzy-casa COMPLETO (caso real 22/07: busca "complexo b" devolvia o EQUIPO
//     MACROGOTAS COMPLETO em vez do polivitaminico injetavel cujo PA e "VITAMINAS DO COMPLEXO B").
//     _bmFuzzy tolera distancia-1 p/ typo; COMPLEXO x COMPLETO sao palavras REAIS distintas.
{
  const cot = [
    R('EQUIPO MACROGOTAS COMPLETO C/INJ LATERAL PCT25', {tipo:'global', fornecedor:'1', estoque:'170', global_venda1:'5.00', compra_unit:''}),   // 0,20/un (mais barato — e o que ganhava no bug)
    R('SANTIPLEX B SOL INJ CX100 AMP 2ML',              {tipo:'global', fornecedor:'1', estoque:'223', global_venda1:'90.00', compra_unit:'', principio_ativo:'VITAMINAS DO COMPLEXO B'}),  // 0,90/un
  ];
  const r = busca(cot, 'complexo b');
  ok('14a. "complexo b" acha o item com PA COMPLEXO B (nao o EQUIPO COMPLETO)', !!r && /SANTIPLEX/.test(nome(r)), 'veio: '+nome(r));
  const r2 = busca(cot, 'equipo macrogotas completo');
  ok('14b. "equipo macrogotas completo" segue achando o EQUIPO (controle)', !!r2 && /EQUIPO/.test(nome(r2)), 'veio: '+nome(r2));
  // controle: fuzzy dist-1 continua valendo p/ TYPO real (ivermeqtina -> ivermectina)
  const cot3 = [ R('IVERMECTINA 6MG CX4 CPR', {principio_ativo:'IVERMECTINA', compra_unit:'1.00', fornecedor:'FORN_A'}) ];
  const r3 = busca(cot3, 'IVERMEQTINA 6MG COMPRIMIDO');
  ok('14c. typo dist-1 (ivermeqtina) ainda casa ivermectina (controle do fuzzy)', !!r3 && /IVERMECTINA/.test(nome(r3)), 'veio: '+nome(r3));
}

// 15) ESGOTADO NO FORNECEDOR (botão 🚫 da giovana, 22/07): distribuidor com estoque=0 EXPLÍCITO
//     sai da carga da busca (incluiNaBusca). null/'' = estoque não informado -> continua entrando.
//     GLOBAL com estoque 0 já saía (não muda).
{
  const inc = ctx.api.incluiNaBusca;
  ok('15a. fornecedor estoque=0 explicito FORA da busca', inc({tipo:'fornecedor', fornecedor:'FORN_A', estoque:0, compra_unit:'2.00', produto:'X 10MG CX10', und:''}) === false);
  ok('15b. fornecedor estoque="0" (string) FORA', inc({tipo:'fornecedor', fornecedor:'FORN_A', estoque:'0', compra_unit:'2.00', produto:'X 10MG CX10', und:''}) === false);
  ok('15c. fornecedor estoque null ENTRA (nao informado, como sempre)', inc({tipo:'fornecedor', fornecedor:'FORN_A', estoque:null, compra_unit:'2.00', produto:'X 10MG CX10', und:''}) === true);
  ok('15d. fornecedor estoque 5 ENTRA', inc({tipo:'fornecedor', fornecedor:'FORN_A', estoque:5, compra_unit:'2.00', produto:'X 10MG CX10', und:''}) === true);
  ok('15e. GLOBAL estoque 0 segue FORA (controle)', inc({tipo:'global', fornecedor:'1', estoque:0, global_venda1:'10', produto:'X 10MG CX10', und:''}) === false);
  // E2E: mesmo produto em 2 fornecedores; o mais barato ESGOTADO some na carga -> busca da o outro
  const todos = [
    R('TRIANCINOLONA 20MG CX10 AMP', {principio_ativo:'TRIANCINOLONA', compra_unit:'1.00', fornecedor:'FORN_ESGOTADO', estoque:0}),
    R('TRIANCINOLONA 20MG CX10 AMP FR', {principio_ativo:'TRIANCINOLONA', compra_unit:'2.00', fornecedor:'FORN_B', estoque:null}),
  ];
  const carregados = todos.filter(inc);
  const r15 = busca(carregados, 'TRIANCINOLONA 20MG INJETAVEL');
  ok('15f. busca pula o esgotado e da o substituto de OUTRO fornecedor', !!r15 && r15.fornecedor === 'FORN_B', r15 ? r15.fornecedor : 'null');
}

console.log('\n──────────────────────────────');
console.log('RESULTADO: ' + pass + ' ok, ' + fail + ' falha(s)');
if (fail) { console.log('\nFALHAS:'); fails.forEach(f => console.log('  - ' + f)); process.exitCode = 1; }
else console.log('TODOS OS ERROS HISTORICOS SEGUEM CORRIGIDOS.');
