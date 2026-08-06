// SUITE testa_comparativo_familia — A LINHA-MAE NAO PODE TER PRECO.
//
// A VISAO POR FAMILIA (Bloco 2 do sync, 05/08) junta o que e o MESMO principio ativo na MESMA
// forma farmaceutica sob uma linha-mae. Com 5.759 grupos, procurar "as dipironas" era rolar a
// tela ate achar.
//
// >>> A REGRA QUE ESTA SUITE PROTEGE: a mae e uma DIVISORIA, nao uma comparacao. DIPIRONA
//     500MG/ML e DIPIRONA 1G sao o mesmo PA e a mesma forma, e um "preco da familia" seria a
//     media de coisas que ninguem compra juntas. Quem compara continua sendo a linha da DOSE.
//     Este e o tipo de coisa que alguem "melhora" depois, achando que faltou o total.
//
//   node tests/testa_comparativo_familia.js
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(raiz, 'fpmed_sistema_final.html'), 'utf8');
function fn(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + nome + '\\s*\\(').exec(src);
  if (!m) throw new Error('nao achei function ' + nome);
  let i = src.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < src.length; j++) { if (src[j] === '{') n++; else if (src[j] === '}') { n--; if (!n) return src.slice(m.index, j + 1); } }
  throw new Error('chave nao fechou: ' + nome);
}
function konst(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:var|const|let)\\s+' + nome + '\\s*=[^;]*;').exec(src);
  if (!m) throw new Error('nao achei const ' + nome);
  return m[0];
}
// `konst` para quando a declaracao tem ';' DENTRO (arrow de uma linha): pega a LINHA inteira.
// Sem isso o _bmForma sai cortado no primeiro ponto-e-virgula do corpo.
function konstLinha(nome) {
  const re = new RegExp('^\\s*(?:var|const|let)\\s+' + nome + '\\s*=.*$', 'm');
  const m = re.exec(src);
  if (!m) throw new Error('nao achei a linha de ' + nome);
  return m[0];
}
const ctx = (new Function(`
  ${konst('CPZ_SALT')} ${konst('_GM_SAL_RE')} ${konst('_BM_CATS')}
  ${fn('_gmNorm')} ${fn('normPA')} ${fn('_cpzPaNorm')}
  ${konstLinha('_bmStrip')} ${konstLinha('_bmNormF')} ${konstLinha('_bmForma')}
  return { _cpzPaNorm, _bmForma };`))();
const { _cpzPaNorm, _bmForma } = ctx;

// replica do _familiaDe da tela
const familiaDe = g => {
  const pa = _cpzPaNorm(g.principioAtivo || g.principio || '');
  const fm = _bmForma(g.produtoOriginal || '') || 'SEM FORMA';
  return (pa || 'SEM PA') + ' · ' + fm;
};

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_comparativo_familia — a visao por familia\n');

const G = (pa, prod) => ({ principioAtivo: pa, principio: pa, produtoOriginal: prod });

// ══════════ 1. MESMA FAMILIA ══════════
{
  const a = G('DIPIRONA', 'DIPIRONA 500MG/ML SOL INJ 2ML');
  const b = G('DIPIRONA', 'DIPIRONA 1G SOL INJ 2ML');
  ok('1. *** doses diferentes do mesmo PA e mesma forma caem na MESMA familia ***',
    familiaDe(a) === familiaDe(b), [familiaDe(a), familiaDe(b)]);
  ok('2. a familia nomeia o PA', /DIPIRONA/.test(familiaDe(a)), familiaDe(a));
  ok('3. e nomeia a forma', /INJETAVEL/.test(familiaDe(a)), familiaDe(a));
}

// ══════════ 2. FORMA SEPARA — comprimido nao disputa cotacao com injetavel ══════════
{
  const inj = G('DIPIRONA', 'DIPIRONA 500MG/ML SOL INJ');
  const cpr = G('DIPIRONA', 'DIPIRONA 500MG COMPRIMIDO');
  ok('4. *** mesmo PA em formas diferentes = familias DIFERENTES ***',
    familiaDe(inj) !== familiaDe(cpr), [familiaDe(inj), familiaDe(cpr)]);
}
{
  const oral = G('AMOXICILINA', 'AMOXICILINA 500MG CAPSULA');
  const susp = G('AMOXICILINA', 'AMOXICILINA 250MG/5ML SUSPENSAO ORAL');
  ok('5. capsula e suspensao oral tambem se separam', familiaDe(oral) !== familiaDe(susp), [familiaDe(oral), familiaDe(susp)]);
}

// ══════════ 3. PA DIFERENTE NUNCA JUNTA ══════════
{
  ok('6. PAs diferentes na mesma forma = familias diferentes',
    familiaDe(G('DIPIRONA','X SOL INJ')) !== familiaDe(G('OMEPRAZOL','Y SOL INJ')));
  ok('7. sal do mesmo PA junta (o _cpzPaNorm tira o sal)',
    familiaDe(G('CLORIDRATO DE CLONIDINA','A COMPRIMIDO')) === familiaDe(G('CLONIDINA','B COMPRIMIDO')),
    [familiaDe(G('CLORIDRATO DE CLONIDINA','A COMPRIMIDO')), familiaDe(G('CLONIDINA','B COMPRIMIDO'))]);
}

// ══════════ 4. SEM PA / SEM FORMA NAO VIRAM UM BALAIO SO... ══════════
// ...mas tambem nao podem sumir. Item de material nao tem PA por natureza (635 linhas do
// estoque estao nessa situacao, medido em 04/08) e ainda precisa aparecer na tela.
{
  const luva = G(null, 'LUVA DE PROCEDIMENTO LATEX M');
  ok('8. item sem PA ganha familia mesmo assim (nao desaparece)', typeof familiaDe(luva) === 'string' && familiaDe(luva).length > 0, familiaDe(luva));
  ok('9. e a familia diz que nao tem PA, em vez de fingir um', /SEM PA/.test(familiaDe(luva)), familiaDe(luva));
  const semForma = G('DIPIRONA', 'DIPIRONA');
  ok('10. sem forma detectavel idem', /SEM FORMA/.test(familiaDe(semForma)), familiaDe(semForma));
}

// ══════════ 5. A MAE NAO TEM PREÇO — a regra central ══════════
{
  const bloco = src.slice(src.indexOf('const _familiaDe'), src.indexOf('function _linhaComparativo'));
  ok('11. *** o cabecalho de familia NAO imprime fmtBRL (nenhum preco na linha-mae) ***',
    !/fmtBRL/.test(bloco), bloco.match(/fmtBRL[^\n]*/));
  ok('12. ...nem media, nem menor, nem total', !/media|menor|total/i.test(bloco.replace(/\/\/[^\n]*/g,'')));
  ok('13. a mae mostra a CONTAGEM de doses', /dose\(s\)/.test(bloco));
  ok('14. ...e quantas tem saldo (isso e navegacao, nao comparacao)', /com saldo/.test(bloco));
  ok('15. e diz na propria tela que a comparacao e por dose', /a comparação é por dose/.test(bloco));
  ok('16. o motivo esta escrito no codigo, nao so aqui', /dose nunca se mistura/i.test(src));
}

// ══════════ 6. O COLSPAN ACOMPANHA AS COLUNAS ══════════
// Errar isso desalinha a tabela inteira, e o numero de colunas MUDA com o toggle de analise
// e com quantos fornecedores estao visiveis.
{
  ok('17. o colspan e calculado, nao cravado', /const _nCols = 3 \+ \(compAnalise \? 5 : 0\) \+ distribuidores\.length \+ industrias\.length/.test(src));
  ok('18. e o cabecalho usa ele', /colspan="\$\{_nCols\}"/.test(src));
}

// ══════════ 7. O TOGGLE ══════════
{
  ok('19. existe o botao por familia', /id="comp-btn-familia"/.test(src));
  ok('20. e a funcao que alterna', /function compToggleFamilia\(\)/.test(src));
  ok('21. desligado por padrao (a tela abre na visao simples que o Lemuel pediu)', /var compFamilia = false;/.test(src));
  ok('22. o agrupamento so acontece com o toggle ligado', /compFamilia\s*\?\s*_visiveis\.slice\(\)\.sort/.test(src));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
