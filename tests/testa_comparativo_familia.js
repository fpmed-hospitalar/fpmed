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
  ${konstLinha('_bmStrip')} ${konstLinha('_bmNormF')} ${konstLinha('_bmSemGelatina')} ${konstLinha('_bmForma')}
  return { _cpzPaNorm, _bmForma };`))();
const { _cpzPaNorm, _bmForma } = ctx;

// replica do _familiaDe da tela
const familiaDe = g => {
  const pa = _cpzPaNorm(g.principioAtivo || '');
  if (!pa || pa.length < 3) return null;
  const fm = _bmForma(g.produtoOriginal || '') || 'SEM FORMA';
  return pa + ' · ' + fm;
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

// ══════════ 4. SEM PA NAO GERA FAMILIA ══════════
// Duas armadilhas medidas no ar em 05/08, as duas do mesmo desenho ingenuo:
//  1. cair no NOME DO PRODUTO quando falta PA fazia CADA LINHA virar a propria familia. Uma
//     busca por DIPIRONA rendeu 34 cabecalhos de "1 dose(s)" com nomes como "BROM N
//     BUTILESCOPOLAMINA DIPIRONA 5ML CX 50AMP BLAU". Divisoria por linha nao divide nada.
//  2. jogar tudo num "SEM PA" so seria o erro oposto: 635 linhas de material (medido em 04/08)
//     debaixo de um cabecalho que nao informa nada.
// Agrupar coisas que nao se sabe o que sao nao e agrupar. Sem PA, a linha fica solta.
{
  const luva = G(null, 'LUVA DE PROCEDIMENTO LATEX M');
  ok('8. *** item sem PA NAO gera familia (fica solto, sem cabecalho) ***', familiaDe(luva) === null, familiaDe(luva));
  ok('9. *** e o nome do PRODUTO nunca vira nome de familia ***',
    familiaDe({ principioAtivo: '', principio: 'LUVA DE PROCEDIMENTO', produtoOriginal: 'LUVA DE PROCEDIMENTO' }) === null);
  ok('9b. PA curto demais tambem nao vira familia (ruido de normalizacao)',
    familiaDe(G('DE', 'X SOL INJ')) === null, familiaDe(G('DE', 'X SOL INJ')));
  const semForma = G('DIPIRONA', 'DIPIRONA');
  ok('10. com PA mas sem forma detectavel, a familia existe e diz "SEM FORMA"', /SEM FORMA/.test(familiaDe(semForma)), familiaDe(semForma));
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

// ══════════ 5B. "CAPS GEL DURA" E CAPSULA, NAO POMADA ══════════
// Achado no ar em 05/08: "Omeprazol 40MG CX 56CAPS GEL DURAS" era classificado como TOPICO,
// porque 'gel' esta na lista de palavras de pomada. GEL DURA = GELATINOSA dura.
// NAO E SO ROTULO: o _bmForma decide quem e PEER na blindagem de preco de caixa ("formas
// diferentes nunca sao peer") e o casamento de forma no cruzamento do Licitacoes. Um omeprazol
// classificado como pomada perde os peers dele e deixa de casar com "capsula" no edital.
ok('16b. *** "CX 56CAPS GEL DURAS" e SOLIDO_ORAL, nao TOPICO ***',
  _bmForma('Omeprazol 40MG CX 56CAPS GEL DURAS - (OMOPREL)') === 'SOLIDO_ORAL',
  _bmForma('Omeprazol 40MG CX 56CAPS GEL DURAS - (OMOPREL)'));
ok('16c. "CT C/ 490 CAPS GEL DURA" idem',
  _bmForma('OMEPRAZOL 20MG (GEN) CT C/ 490 CAPS GEL DURA/GEOLAB') === 'SOLIDO_ORAL',
  _bmForma('OMEPRAZOL 20MG (GEN) CT C/ 490 CAPS GEL DURA/GEOLAB'));
ok('16d. "CAPS GEL MOLE" tambem', _bmForma('VITAMINA E 400UI 30 CAPS GEL MOLES') === 'SOLIDO_ORAL',
  _bmForma('VITAMINA E 400UI 30 CAPS GEL MOLES'));
// e o que o conserto NAO pode comer: gel de verdade continua topico
ok('16e. *** GEL de verdade continua TOPICO ***', _bmForma('DICLOFENACO GEL 60G') === 'TOPICO', _bmForma('DICLOFENACO GEL 60G'));
ok('16f. gel dermatologico idem', _bmForma('CLINDAMICINA GEL DERMATOLOGICO 30G') === 'TOPICO');
ok('16g. e as duas capsulas agora sao a MESMA familia (era o efeito visivel do defeito)',
  familiaDe(G('OMEPRAZOL','Omeprazol 40MG CX 56CAPS GEL DURAS'))
  === familiaDe(G('OMEPRAZOL','OMEPRAZOL 20MG CT C/ 490 CAPS GEL DURA')),
  [familiaDe(G('OMEPRAZOL','Omeprazol 40MG CX 56CAPS GEL DURAS'))]);

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
  // ── e os dois consertos que vieram de rodar no ar ──
  ok('23. *** familia de UMA dose so NAO vira cabecalho (divisoria que separa 1 item e ruido) ***',
    /if \(fam && nDosesFam > 1 && fam !== _famAtual\)/.test(src));
  ok('24. e o que nao tem familia vai pro FIM, sem picotar os grupos que agrupam',
    /if \(!fa\) return 1;\s*\n\s*if \(!fb\) return -1;/.test(src));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
