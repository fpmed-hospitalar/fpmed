// SUITE testa_pdf_proposta — O QUE SAI IMPRESSO PRO CLIENTE.
//
// Este PDF sai da empresa. Erro aqui nao aparece como bug — aparece como o cliente lendo um
// preco que a FPMED nao pratica, ou como uma proposta sem a ressalva de que ela foi montada
// com IA e com estoque rotativo.
//
// DOIS ASSUNTOS:
//   1. a coluna PRECO UNIT saia CRUA ("0.2556") em vez de "R$ 0,26";
//   2. o quadro "⚠ OBSERVACOES" (IA + estoque rotativo) nao existia no documento da FPMED.
//
//   node tests/testa_pdf_proposta.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_giovana.html'), 'utf8');
function fn(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + nome + '\\s*\\(').exec(src);
  if (!m) throw new Error('nao achei function ' + nome);
  let i = src.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < src.length; j++) { if (src[j] === '{') n++; else if (src[j] === '}') { n--; if (!n) return src.slice(m.index, j + 1); } }
  throw new Error('chave nao fechou: ' + nome);
}
function konst(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:var|const|let)\\s+' + nome + '\\s*=[\\s\\S]*?;').exec(src);
  if (!m) throw new Error('nao achei const ' + nome);
  return m[0];
}
const ctx = (new Function(`
  ${fn('fmtBRL')} ${fn('fmtBRLUnit')} ${konst('OBS_PADRAO')} ${fn('_obsPedidoBlocos')}
  return { fmtBRL, fmtBRLUnit, OBS_PADRAO, _obsPedidoBlocos };`))();
const { fmtBRL, fmtBRLUnit, OBS_PADRAO, _obsPedidoBlocos } = ctx;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_pdf_proposta — o que sai impresso pro cliente\n');
const NB = s => String(s).replace(/ /g, ' ');   // o fmtBRL usa espaco DURO depois do R$

// ══════════ 1. O BUG QUE O LEMUEL REPORTOU ══════════
ok('1. *** 0,2556 sai como "R$ 0,26", nao como "0.2556" ***', NB(fmtBRLUnit(0.2556)) === 'R$ 0,26', fmtBRLUnit(0.2556));
ok('2. arredonda pra cima corretamente', NB(fmtBRLUnit(0.2650)) === 'R$ 0,27', fmtBRLUnit(0.265));
ok('3. valor inteiro', NB(fmtBRLUnit(12)) === 'R$ 12,00', fmtBRLUnit(12));
ok('4. milhar com ponto', NB(fmtBRLUnit(3143.5)) === 'R$ 3.143,50', fmtBRLUnit(3143.5));
ok('5. nao sobrou ponto decimal em lugar nenhum', !/\d\.\d\d$/.test(NB(fmtBRLUnit(0.2556))));

// ══════════ 2. CENTAVOS — por que fmtBRLUnit existe separado do fmtBRL ══════════
// NAO e estetica, e CONFERENCIA. Item que vem em caixa grande tem unitario de centavos
// (agulha a R$ 0,0056). Arredondado pra 2 casas ele vira "R$ 0,01" — e a linha PARA DE FECHAR
// na frente do cliente: 0,01 x 100 = R$ 1,00, mas o Preco CAIXA impresso na mesma linha diz
// R$ 0,56. Quem ve a inconsistencia nao somos nos, e ele.
ok('6. *** R$ 0,0056 NAO vira "R$ 0,01" (a linha tem que fechar) ***', NB(fmtBRLUnit(0.0056)) === 'R$ 0,0056', fmtBRLUnit(0.0056));
ok('7. R$ 0,004 idem, com o zero a direita cortado', NB(fmtBRLUnit(0.004)) === 'R$ 0,004', fmtBRLUnit(0.004));
ok('8. R$ 0,082 (a agulha do cruzamento de licitacoes) mantem a precisao', NB(fmtBRLUnit(0.082)) === 'R$ 0,082', fmtBRLUnit(0.082));
ok('9. zero a direita e cortado: 0,05 nao vira "0,0500"', NB(fmtBRLUnit(0.05)) === 'R$ 0,05', fmtBRLUnit(0.05));
ok('10. nunca uma casa so: 0,1 e o limite e ja usa o formato normal', NB(fmtBRLUnit(0.1)) === 'R$ 0,10', fmtBRLUnit(0.1));
ok('11. logo abaixo do limite ainda corta o zero', NB(fmtBRLUnit(0.099)) === 'R$ 0,099', fmtBRLUnit(0.099));
ok('12. e o fmtBRL comum continua sempre com 2 casas (o Preco CAIXA e o Total)',
  NB(fmtBRL(0.0056)) === 'R$ 0,01', fmtBRL(0.0056));

// ══════════ 3. ZERO E LIXO ══════════
ok('13. zero sai como R$ 0,00 (e nao "R$ 0,0000")', NB(fmtBRLUnit(0)) === 'R$ 0,00', fmtBRLUnit(0));
ok('14. null nao quebra', NB(fmtBRLUnit(null)) === 'R$ 0,00', fmtBRLUnit(null));
ok('15. undefined nao quebra', NB(fmtBRLUnit(undefined)) === 'R$ 0,00', fmtBRLUnit(undefined));
ok('16. NaN nao quebra', NB(fmtBRLUnit(NaN)) === 'R$ 0,00', fmtBRLUnit(NaN));

// ══════════ 4. O QUADRO DE OBSERVAÇÕES ══════════
// O aviso vive no CODIGO, nao no banco: se dependesse de um registro, uma proposta nova sairia
// sem ele — justamente o caso em que o aviso mais importa.
ok('15. o aviso menciona a inteligencia artificial', /intelig[êe]ncia artificial/i.test(OBS_PADRAO));
ok('16. ...e que esta sujeita a erros', /sujeita a erros/i.test(OBS_PADRAO));
ok('17. ...e o estoque rotativo', /estoque rotativo/i.test(OBS_PADRAO));
ok('18. ...e que o preco nao esta garantido ate a confirmacao', /n[ãa]o garantidos at[ée] a confirma/i.test(OBS_PADRAO));
{
  const b = _obsPedidoBlocos('');
  ok('19. sem texto do vendedor, o padrao sai mesmo assim', b.padrao === OBS_PADRAO && b.temExtra === false, b);
  const c = _obsPedidoBlocos('  Entrega em 2 lotes.  ');
  ok('20. texto adicional entra aparado', c.extra === 'Entrega em 2 lotes.' && c.temExtra === true, c);
  const d = _obsPedidoBlocos('   ');
  ok('21. so espaco nao conta como texto adicional', d.temExtra === false, d);
  const e = _obsPedidoBlocos(null);
  ok('22. null nao quebra', e.temExtra === false && e.padrao === OBS_PADRAO);
}

// ══════════ 5. O QUADRO ESTÁ NO DOCUMENTO, E NO LUGAR CERTO ══════════
{
  ok('23. o quadro existe no HTML do documento', src.includes('id="print-obs-pedido"'));
  const iObs   = src.indexOf('id="print-obs-pedido"');
  const iPrazo = src.indexOf('Prazo para entrega a combinar');
  const iNota  = src.indexOf('* Preço Unit = valor por unidade');
  ok('24. *** o quadro vem ANTES do "Prazo para entrega a combinar" ***', iObs > 0 && iPrazo > iObs, { iObs, iPrazo });
  ok('25. ...e DEPOIS da nota "* Preço Unit"', iNota > 0 && iObs > iNota, { iNota, iObs });
  ok('26. o gerarPDF pinta o quadro (senao ele sai vazio no papel)', /_pintaObsPedido\(\);\s*\/\/ o quadro de observa/.test(src));
  ok('27. o texto do vendedor entra por textContent, nunca innerHTML (nao vira HTML no PDF)',
    /x\.textContent = b\.extra/.test(src) && !/print-obs-extra'\)\.innerHTML/.test(src));
  ok('28. a coluna PRECO UNIT do documento usa o formatador, nao o toFixed cru',
    /fmtBRLUnit\(precoUnit\)/.test(src) && !/\$\{precoUnit\.toFixed\(4\)\}<\/td>/.test(src));
}

// ══════════ 6. REGRA DE OURO: o PDF do CLIENTE não mostra fornecedor ══════════
// Guarda permanente do projeto, e o quadro novo nao pode ter aberto brecha.
{
  const iDoc = src.indexOf('<div class="doc-itens"') >= 0 ? src.indexOf('<div class="doc-itens"') : src.indexOf('<table class="doc-itens">');
  const iFim = src.indexOf('</div>', src.indexOf('doc-emissao'));
  const doc = src.slice(iDoc, iFim > iDoc ? iFim : iDoc + 4000);
  ok('29. o documento nao tem coluna de fornecedor', !/>\s*Fornecedor\s*</i.test(doc));
  ok('30. e nao imprime custo', !/compra_unit|custo/i.test(doc));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
