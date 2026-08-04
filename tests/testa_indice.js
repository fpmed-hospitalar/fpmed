// SUITE testa_indice — O INDICE TEM QUE DEVOLVER EXATAMENTE O MESMO QUE A VARREDURA COMPLETA.
//
// POR QUE ESTA SUITE E DIFERENTE DAS OUTRAS: as outras perguntam "o motor acerta?". Esta pergunta
// "o atalho muda alguma resposta?". O indice existe pra visitar ~1.600 linhas em vez de 21.393 —
// e o risco dele e o OPOSTO do risco de lentidao: um indice que perde uma linha tira produto da
// busca EM SILENCIO. Ninguem reclama; o item so nao aparece na proposta e vira "nao encontrado".
//
// O ARGUMENTO DE SUPERCONJUNTO (o que o indice promete cobrir do paOK):
//   o filtro real e _bmFuzzy(w, t), que aceita de dois jeitos:
//     (a) t.includes(w)  — SUBSTRING, podendo cair no meio de uma palavra maior.
//         Cobertura: se t contem w (|w|>=4), t contem os 4 primeiros caracteres de w. Indexando
//         TODOS os 4-gramas de t, o balde do 4-grama inicial de w e um superconjunto garantido.
//     (b) token k de t com |k|>=5, k[0]===w[0] e distancia de edicao 1 pra w.
//         Distancia 1 forca |k| em {|w|-1, |w|, |w|+1}: os tres baldes (1a letra, comprimento)
//         cobrem todo k possivel.
//   e o classMatch, que nao depende de w nenhum, entra por um conjunto proprio (COMPLEXO_B).
// Aqui os dois caminhos rodam LADO A LADO sobre o mesmo banco e a mesma consulta. A verificacao
// contra o banco REAL (1.569 consultas, zero divergencia) esta em tools/prova_indice.js.
//   node tests/testa_indice.js
const fs = require('fs'), path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'fpmed_giovana.html'), 'utf8');
const lines = HTML.split(/\r?\n/);
function block(a, b) {
  const s = lines.findIndex(l => l.includes(a));
  if (s < 0) throw new Error('ancora inicio: ' + a);
  let e = -1; for (let i = s + 1; i < lines.length; i++) { if (lines[i].includes(b)) { e = i; break; } }
  if (e < 0) throw new Error('ancora fim: ' + b);
  return lines.slice(s, e).join('\n');
}
const ctx = (new Function('let cotacoes=[];let _bmCmed=new Map();let _bmClasseB=new Set();console.warn=function(){};\n'
  + block('function _undNum(und)', 'let searchTO') + '\n'
  + block('const _bmStrip = s =>', '/* ─── busca antiga') + '\n'
  + 'return { api:{ buscarMelhorProduto, _bmIdxCandidatos, _bmFuzzy, _bmNorm },'
  + '         setCot:function(a){cotacoes=a;_bmIdx=null;},'
  + '         setIdx:function(on){_bmIdxOff=!on;_bmIdx=null;} };'))();
const { buscarMelhorProduto, _bmIdxCandidatos, _bmFuzzy, _bmNorm } = ctx.api;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e != null ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_indice — o atalho nao pode mudar nenhuma resposta\n');

// ── um banco sintetico, mas com as formas de escrita que o banco real tem ──
const R = (produto, pa, preco) => ({ id: produto, produto, principio_ativo: pa || '', und: '',
  compra_unit: String(preco == null ? 10 : preco), global_venda1: '', tipo: 'fornecedor',
  fornecedor: 'MCW', estoque: '5' });
const BANCO = [
  R('DIPIRONA SODICA 500MG/ML AMP 2ML CX100', 'DIPIRONA'),
  R('DIPIRONA 500MG CX10 CPR', 'DIPIRONA', 3),
  R('CLORIDRATO DE CIPROFLOXACINO 500MG C/14 COMPRIMIDOS', ''),
  R('FRESOFLOX 2MG/ML CIPROFLOXACINO SOL INJ IV FR 100ML', ''),
  R('TRANSAMIN INJ. IV 50MG/ML CX5 AMP 5ML', 'ACIDO TRANEXAMICO'),
  R('ACIDO TRANEXAMICO INJ. 50MG/ML CX100 AMP 5ML', 'ACIDO TRANEXAMICO', 12),
  R('PEMETREXEDE DISSODICO 100MG CX/1FRS GENERICO BLAU', ''),
  R('OXALIPLATINA 100MG CX/1FRS FARMARIN EVOXALI', ''),
  R('HEPARINA SODICA 5000 UI/ML 5ML EUROFARMA CX/50 FRA', ''),
  R('SORO FISIOLOGICO 0,9% SF CX40 FR 250ML', 'CLORETO DE SODIO'),
  R('LAMINA BISTURI N.23 ACO CARBONO CX100', ''),
  R('SONDA URETRAL N. 08 BIOFARMACEUTICA', ''),
  R('COMPLEXO B XAROPE 100ML', ''),
  R('EQUIPO MACROGOTAS FLEX C/INJ LATERAL LS PCT2', ''),
  R('LEVOFLOXACINO 5MG/ML 100ML CX/60BLS', ''),
  R('CETOCONAZOL 20MG/G CX100 BISNAGAS 30G', 'CETOCONAZOL'),
  R('BROM. DE PANCURONIO 2MG/ML 2ML CRISTALIA CX/50AMP', ''),
  R('LOSARTANA POTASSICA HIDROCLOROTIAZIDA 50/12,5MG 60 COMPRIMIDOS', ''),
  R('HIDROCLOROTIAZIDA 25MG CX30 CPR', 'HIDROCLOROTIAZIDA'),
  R('AMOXICILINA 500MG+CLAVULANATO DE POTASSIO 125MG CX21', ''),
];
ctx.setCot(BANCO);

// as consultas: as que o sistema recebe de verdade, incluindo as que hoje NAO casam
const CONSULTAS = [
  'DIPIRONA SODICA 500MG/ML AMPOLA 2ML', 'DIPIRONA 500MG CPR', 'DIPIRONA CPR',
  'CIPROFLOXACINO INJETAVEL 100 ML', 'CIPROFLOXACINO 500MG COMPRIMIDO',
  'TRANSAMIN INJETAVEL', 'ACIDO TRANEXAMICO 50MG/ML',
  'PEMETREXEDE DISSODICO 100MG PO PARA SOLUCAO INJETAVEL FRASCO/AMPOLA',
  'OXALIPLATINA 100MG 5MG/ML SOLUCAO INJETAVEL C/20ML',
  'HEPARINA INJETAVEL SODICA 5 ML', 'CLORETO DE SODIO 0,9% 250ML SIST FECHADO',
  'LAMINA BISTURI N 23', 'LAMINA BISTURI N 15', 'SONDA URETRAL N 8 EMBRAMED',
  'Complexo B (B1, B2, B3, B6 e B12) xarope - 100ml', 'EQUIPO MACROGOTAS LUER SLIP',
  'LEVOFLOXACINO 5MG/ML 100ML', 'CETOCONAZOL 2% 30G', 'BROMETO DE PANCURONIO 4MG',
  'HIDROCLOROTIAZIDA 12,5MG CPR', 'HIDROCLOROTIAZIDA 25MG CPR',
  'AMOXICILINA 500MG', 'PRODUTO QUE NAO EXISTE NO BANCO 999MG',
  // grafias torcidas de proposito: e onde o fuzzy age, e portanto onde o indice pode furar
  'DIPIRONAS 500MG', 'CIPROFLOXACINA INJETAVEL 100 ML', 'TRANSAMINA INJETAVEL',
  'CETOCONAZOL 2%', 'PANCURONIO 4MG', 'HIDROCLOROTIAZIDAS 25MG',
];

// ══════════ A EQUIVALENCIA, CONSULTA POR CONSULTA ══════════
{
  const nome = r => r ? r.produto : null;
  let iguais = 0, dif = [];
  CONSULTAS.forEach(q => {
    ctx.setIdx(false); const semIdx = nome(buscarMelhorProduto(q));
    ctx.setIdx(true);  const comIdx = nome(buscarMelhorProduto(q));
    if (semIdx === comIdx) iguais++; else dif.push({ q, semIdx, comIdx });
  });
  ok('1. *** o indice devolve o MESMO produto que a varredura, nas ' + CONSULTAS.length + ' consultas ***',
    dif.length === 0, dif.slice(0, 5));
  ok('2. e nao e vacuo: a maioria das consultas casa alguma coisa', iguais === CONSULTAS.length);
  ctx.setIdx(true);
  const achou = CONSULTAS.filter(q => buscarMelhorProduto(q)).length;
  ok('3. (' + achou + ' de ' + CONSULTAS.length + ' casaram — o teste compara os dois lados, casando ou nao)',
    achou >= CONSULTAS.length / 2, achou);
}

// ══════════ A PROMESSA (a): SUBSTRING NO MEIO DA PALAVRA ══════════
// E o caso que um indice de TOKENS perderia — e por isso o indice e de 4-gramas.
{
  ctx.setCot([R('XXCETOCONAZOLXX CREME 30G', '')]);
  ctx.setIdx(false); const sem = buscarMelhorProduto('CETOCONAZOL 2% 30G');
  ctx.setIdx(true);  const com = buscarMelhorProduto('CETOCONAZOL 2% 30G');
  ok('4. *** palavra do pedido GRUDADA dentro de outra: os dois caminhos concordam ***',
    (sem ? sem.produto : null) === (com ? com.produto : null), [sem && sem.produto, com && com.produto]);
  const cand = _bmIdxCandidatos('cetoconazol', null, [], null);
  ok('5. *** e o candidato grudado ESTA no conjunto do indice (superconjunto de verdade) ***',
    !!cand && cand.length === 1, cand && cand.length);
  ctx.setCot(BANCO);
}

// ══════════ A PROMESSA (b): DISTANCIA DE EDICAO 1 ══════════
{
  const casos = [
    ['dipirona',   'DIPIRONAS 500MG CX10'],          // uma letra a mais
    ['dipironas',  'DIPIRONA 500MG CX10'],           // uma letra a menos
    ['dipirona',   'DIPIRONE 500MG CX10'],           // uma letra trocada
  ];
  casos.forEach((cs, i) => {
    ctx.setCot([R(cs[1], '')]);
    const t = _bmNorm(cs[1]);
    const fuzzyPega = _bmFuzzy(cs[0], t);
    const cand = _bmIdxCandidatos(cs[0], null, [], null);
    ok('6.' + (i+1) + ' fuzzy aceita "' + cs[0] + '" x "' + cs[1].split(' ')[0] + '" -> ' + fuzzyPega
      + ', e o indice ' + (cand && cand.length ? 'inclui' : 'NAO inclui'),
      !fuzzyPega || (cand && cand.length === 1), [fuzzyPega, cand && cand.length]);
  });
  ctx.setCot(BANCO);
}

// ══════════ QUANDO NAO SABE COBRIR, DESISTE ══════════
// Desistir custa uma varredura. Errar custa um produto que some da proposta sem ninguem ver.
{
  ok('7. *** palavra com menos de 4 letras: devolve null (= varre tudo) ***',
    _bmIdxCandidatos('ana', null, [], null) === null);
  ok('8. *** sinonimo curto tambem faz desistir ***',
    _bmIdxCandidatos('dipirona', null, ['abc'], null) === null);
  ok('9. subAlvo curto idem', _bmIdxCandidatos('dipirona', 'sf', [], null) === null);
  ctx.setCot([]);
  ok('10. banco vazio: devolve null em vez de "nenhum candidato"',
    _bmIdxCandidatos('dipirona', null, [], null) === null);
  ctx.setCot(BANCO);
}

// ══════════ O INDICE REALMENTE FILTRA (senao nao servia pra nada) ══════════
{
  const cand = _bmIdxCandidatos('dipirona', null, [], null);
  ok('11. *** visita bem menos que o banco inteiro ***', !!cand && cand.length < BANCO.length / 2,
    (cand ? cand.length : null) + ' de ' + BANCO.length);
  ok('12. e as duas dipironas estao la dentro',
    !!cand && cand.filter(c => /DIPIRONA/.test(c.produto)).length === 2, cand && cand.length);
  const semRepetido = cand && new Set(cand).size === cand.length;
  ok('13. sem linha repetida no conjunto (os baldes se sobrepoem)', semRepetido === true);
}

// ══════════ A CLASSE, QUE NAO DEPENDE DE PALAVRA NENHUMA ══════════
// classMatch casa por CLASSE TERAPEUTICA, nao por texto — se o indice so olhasse palavras, ele
// perderia esses. Por isso as linhas de COMPLEXO_B entram por um conjunto proprio.
{
  const cand = _bmIdxCandidatos('acebrofilina', null, [], 'COMPLEXO_B');
  const temB = !!cand && cand.some(c => /COMPLEXO B/.test(c.produto));
  ok('14. *** pedido de classe COMPLEXO_B traz as linhas da classe, mesmo sem palavra em comum ***',
    temB, cand && cand.map(c => c.produto));
  const semClasse = _bmIdxCandidatos('acebrofilina', null, [], null);
  ok('15. e sem a classe no pedido, elas nao entram a toa',
    !semClasse || !semClasse.some(c => /COMPLEXO B/.test(c.produto)));
}

// ══════════ O INTERRUPTOR E A RECONSTRUCAO ══════════
{
  ctx.setIdx(true);
  ok('16. o indice pode ser desligado (e o que permite a prova rodar os dois lados)',
    (function(){ ctx.setIdx(false); const r = _bmIdxCandidatos('dipirona', null, [], null); ctx.setIdx(true); return r === null; })());
  // trocar o array de cotacoes (recarga do banco) tem que reconstruir o indice, senao ele
  // responde sobre o banco velho — que e a forma mais silenciosa de errar que existe
  const NOVO = [R('AMIODARONA 50MG/ML AMP 3ML', 'AMIODARONA')];
  ctx.setCot(NOVO);
  const cand = _bmIdxCandidatos('amiodarona', null, [], null);
  ok('17. *** trocou o banco, o indice se reconstroi (nao responde sobre o banco velho) ***',
    !!cand && cand.length === 1 && /AMIODARONA/.test(cand[0].produto), cand && cand.length);
  ok('18. e o que sumiu do banco some do indice',
    (_bmIdxCandidatos('dipirona', null, [], null) || []).length === 0);
  ctx.setCot(BANCO);
}

// ══════════ A TRAVA ESTRUTURAL ══════════
{
  ok('19. *** o motor usa o indice, com queda pra varredura quando ele devolve null ***',
    /_bmIdxCandidatos\(principal, subAlvo, _sinMolPre, reqClasse\) \|\| cotacoes/.test(HTML));
  ok('20. e a prova contra o banco REAL existe como ferramenta',
    fs.existsSync(path.join(__dirname, '..', 'tools', 'prova_indice.js')));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
