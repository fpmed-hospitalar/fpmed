// SUITE testa_lista_cotar — A PERGUNTA QUE EVITA O ERRO E FEITA NA ENTRADA, NAO NA SAIDA.
//
// A LISTA ANTIGA dizia "podem me passar preco?". O fornecedor respondia na granularidade DELE
// — as vezes por unidade, as vezes pela caixa — e ninguem registrava qual era.
//
// >>> E AQUI QUE NASCE O PACK AMBIGUO. Todo o trabalho de 05/08 no Comparativo ("conferir emb.",
//     "parece caixa", o resgate por mediana do preco de caixa gravado como unitario) e conserto
//     A JUSANTE de uma pergunta mal feita A MONTANTE. 112 linhas do banco nao tem pack conhecido
//     e 85 continuam sem depois do item 6. Pedir "preco da EMBALAGEM FECHADA + quantas unidades
//     vem nela" mata a ambiguidade na ENTRADA, que e o unico lugar onde ela morre de graca.
//
//   node tests/testa_lista_cotar.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');
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
const ctx = (new Function(`
  ${konst('_S_MATKW')} ${konst('_S_GAUGE')} ${fn('_semGauge')} ${fn('_sTemDose')} ${fn('_sMaterial')} ${fn('iacTextoLista')}
  return { iacTextoLista, _sMaterial, _sTemDose };`))();
const { iacTextoLista, _sMaterial, _sTemDose } = ctx;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_lista_cotar — a lista que vai pro fornecedor\n');

const ITENS = [
  { descricao: 'DIPIRONA 500MG/ML SOL INJ 2ML', pa: 'DIPIRONA', vezes: 3 },
  { descricao: 'OMEPRAZOL 40MG PO LIOF IV',     pa: 'OMEPRAZOL', vezes: 1 },
  { descricao: 'LUVA DE PROCEDIMENTO LATEX M',  pa: null, vezes: 2 },
  { descricao: 'SERINGA DESCARTAVEL 3ML C/AG',  pa: null, vezes: 1 },
  { descricao: 'ATENSINA 0,150MG COMPRIMIDO',   pa: 'CLONIDINA', vezes: 1 },
];
const T = iacTextoLista(ITENS);

// ══════════ 1. O PEDIDO QUE MATA O PACK AMBIGUO ══════════
ok('1. *** pede o preco da EMBALAGEM FECHADA, nao o unitario ***', /EMBALAGEM FECHADA/.test(T), T.slice(0,0));
ok('2. *** pede QUANTAS UNIDADES vem na embalagem ***', /quantas unidades v[êe]m na embalagem/i.test(T));
ok('3. da um exemplo concreto do formato esperado', /CX c\/ 100 AMP/i.test(T));
ok('4. e abre a porta pro fornecedor que so tem unitario dizer isso',
  /se s[óo] tiver o pre[çc]o por unidade, me diga/i.test(T));
ok('5. a lista ANTIGA nao pedia nada disso (o texto generico saiu)', !/Voc[êe]s t[êe]m esses itens\?/.test(T));
ok('6. pede marca/fabricante (sem marca a cotacao nao vira linha de banco)', /marca\/fabricante/i.test(T));
ok('7. pede validade e prazo', /validade e prazo/i.test(T));

// ══════════ 2. SEPARACAO MEDICAMENTO x MATERIAL ══════════
// Quem cota do outro lado costuma ser gente diferente, e a pergunta do principio ativo so faz
// sentido num dos dois blocos.
ok('8. tem bloco de MEDICAMENTOS', /MEDICAMENTOS \(3\)/.test(T), T.match(/MEDICAMENTOS \(\d+\)/));
ok('9. tem bloco de MATERIAL', /MATERIAL \/ CORRELATOS \(2\)/.test(T), T.match(/MATERIAL[^\n]*/));
ok('10. luva caiu em MATERIAL', T.indexOf('LUVA') > T.indexOf('MATERIAL / CORRELATOS'));
ok('11. seringa caiu em MATERIAL', T.indexOf('SERINGA') > T.indexOf('MATERIAL / CORRELATOS'));
ok('12. dipirona caiu em MEDICAMENTOS', T.indexOf('DIPIRONA') < T.indexOf('MATERIAL / CORRELATOS'));
ok('13. e a numeracao reinicia em cada bloco', /MATERIAL \/ CORRELATOS \(2\)\n1\. LUVA/.test(T), T.split('MATERIAL / CORRELATOS (2)\n')[1]);

// ══════════ 3. O PRINCIPIO ATIVO SO APARECE QUANDO ACRESCENTA ══════════
// ATENSINA e marca; sem o PA ao lado, o fornecedor pode nao saber o que e. Mas repetir
// "DIPIRONA [PA: DIPIRONA]" e ruido que faz a lista parecer gerada por robo — e lista com cara
// de robo o fornecedor le com menos atencao.
ok('14. *** ATENSINA ganha [PA: CLONIDINA] (marca sem o generico nao se cota) ***', /ATENSINA[^\n]*\[PA: CLONIDINA\]/.test(T), T.match(/ATENSINA[^\n]*/));
ok('15. *** DIPIRONA NAO repete o PA (ja esta no nome) ***', !/DIPIRONA[^\n]*\[PA: DIPIRONA\]/.test(T), T.match(/DIPIRONA[^\n]*/));
ok('16. item sem PA nao ganha colchete vazio', !/\[PA: \]/.test(T) && !/\[PA: null\]/.test(T));

// ══════════ 4. A FREQUENCIA DO PEDIDO ══════════
// "pedido 3x" diz ao fornecedor que ha demanda recorrente — e argumento de negociacao.
ok('17. item pedido 3x mostra a frequencia', /\(pedido 3x\)/.test(T));
ok('18. item pedido 1x NAO polui com "(pedido 1x)"', !/\(pedido 1x\)/.test(T));

// ══════════ 5. CASOS DEGENERADOS ══════════
{
  const so = iacTextoLista([{ descricao: 'LUVA DE PROCEDIMENTO', vezes: 1 }]);
  ok('19. lista so de material nao cria bloco de medicamento vazio', !/MEDICAMENTOS \(0\)/.test(so) && !/MEDICAMENTOS/.test(so), so.slice(0,60));
  const som = iacTextoLista([{ descricao: 'DIPIRONA 500MG', vezes: 1 }]);
  ok('20. lista so de medicamento nao cria bloco de material vazio', !/MATERIAL/.test(som));
  const vazia = iacTextoLista([]);
  ok('21. lista vazia nao quebra e ainda traz as instrucoes', /EMBALAGEM FECHADA/.test(vazia));
  ok('22. null nao quebra', typeof iacTextoLista(null) === 'string');
}

// ══════════ 6. O CLASSIFICADOR NAO PODE ERRAR O OBVIO ══════════
// _sMaterial e o mesmo ja usado pela blindagem de sanidade de preco — reaproveitado de
// proposito, pra nao existirem duas nocoes de "isto e material" divergindo com o tempo.
ok('23. gaze e material', _sMaterial('COMPRESSA DE GAZE 7,5X7,5') === true);
ok('24. cateter e material', _sMaterial('CATETER INTRAVENOSO 20G') === true);
ok('25. *** medicamento COM DOSE nao vira material, mesmo citando seringa ***',
  _sMaterial('ENOXAPARINA 40MG/0,4ML SERINGA PREENCHIDA') === false, _sMaterial('ENOXAPARINA 40MG/0,4ML SERINGA PREENCHIDA'));
ok('26. dipirona nao e material', _sMaterial('DIPIRONA 500MG/ML') === false);

// ── CALIBRE GAUGE ≠ DOSE (defeito achado por esta suite em 05/08) ─────────────────────────
// O `\d+\s*g\b` do _sTemDose lia o "20G" de "CATETER INTRAVENOSO 20G" como 20 GRAMAS de dose,
// concluia "tem dose logo e medicamento" e o cateter deixava de ser material. Efeito real: a
// blindagem de sanidade de preco usa limiares proprios pra material, e o cateter escapava deles.
// Mesma familia do calibre French corrigido hoje no pack.
ok('26b. *** "CATETER INTRAVENOSO 20G" nao tem dose (20G e calibre) ***', _sTemDose('CATETER INTRAVENOSO 20G') === false, _sTemDose('CATETER INTRAVENOSO 20G'));
ok('26c. agulha 25x7 30G idem', _sTemDose('AGULHA DESCARTAVEL 30G') === false);
ok('26d. scalp 21G idem', _sMaterial('SCALP 21G') === true, _sMaterial('SCALP 21G'));
// e o que o apagamento NAO pode comer:
ok('26e. *** "ALGODAO 500G" continua com dose/peso (3 digitos, nao e gauge) ***', _sTemDose('ALGODAO HIDROFILO 500G') === true);
ok('26f. *** "CEFALOTINA 1G" continua sendo dose (nao e produto de gauge) ***', _sTemDose('CEFALOTINA 1G PO INJ') === true);
ok('26g. "AGULHA" com dose de verdade em mg ainda tem dose', _sTemDose('AGULHA COM LIDOCAINA 20MG') === true);

// ══════════ 7. A TELA USA ISTO ══════════
ok('27. o botao Copiar lista chama o texto novo', /function iacCopiar\(\)[\s\S]{0,400}iacTextoLista\(l\)/.test(src));
ok('28. e o fallback do prompt continua (clipboard bloqueia sem HTTPS/gesto)', /window\.prompt\('Copie a lista/.test(src));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
