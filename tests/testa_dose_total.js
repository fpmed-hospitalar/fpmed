// SUITE testa_dose_total — DOSE TOTAL == CONCENTRACAO x VOLUME (aprovado pelo Lemuel 29/07).
// O caso dos oncologicos (pedido 63622): o cliente escreve a dose TOTAL do frasco e o banco
// cadastra CONCENTRACAO x VOLUME. Sao o MESMO produto — 1200MG em 20ML == 60MG/ML em 20ML.
// A REGRA, sem folga: so vale quando os DOIS lados declaram volume, o volume e o MESMO e a conta
// fecha EXATA. Nada de tolerancia — esta e a barreira mais critica do sistema.
// Extrai as funcoes REAIS da fpmed_giovana.html e roda tambem o caminho COMPLETO da busca.
//   node tests/testa_dose_total.js
const fs = require('fs'), path = require('path');
const HTML = path.join(__dirname, '..', 'fpmed_giovana.html');
const lines = fs.readFileSync(HTML, 'utf8').split(/\r?\n/);
function block(a, b) {
  const s = lines.findIndex(l => l.includes(a));
  if (s < 0) throw new Error('ancora inicio nao achada: ' + a);
  let e = -1; for (let i = s + 1; i < lines.length; i++) { if (lines[i].includes(b)) { e = i; break; } }
  if (e < 0) throw new Error('ancora fim nao achada: ' + b);
  return lines.slice(s, e).join('\n');
}
const factory =
  'let cotacoes = [];\nlet _bmCmed = new Map();\nlet _bmClasseB = new Set();\nconsole.warn=function(){};\n' +
  block('function _undNum(und)', 'let searchTO') + '\n' +
  block('const _bmStrip = s =>', '/* ─── busca antiga') + '\n' +
  'return { api:{ buscarMelhorProduto, _bmDoses, _bmMl, _bmDoseTotalEq }, setCot:function(a){cotacoes=a;} };';
const ctx = (new Function(factory))();
const { buscarMelhorProduto, _bmDoses, _bmMl, _bmDoseTotalEq } = ctx.api;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e != null ? '  [' + e + ']' : '')); } };
console.log('SUITE testa_dose_total — dose total x concentracao x volume\n');

const R = (produto, o) => Object.assign({ produto, principio_ativo: '', und: '', compra_unit: '10.00', global_venda1: '', tipo: 'fornecedor', fornecedor: 'FORN_A', estoque: '0' }, o || {});
const busca = (cot, q) => { ctx.setCot(cot); return buscarMelhorProduto(q); };
const nome = r => r ? r.produto : null;
// helper igual ao uso real: doses e volume dos dois textos
const eq = (a, b) => _bmDoseTotalEq(_bmDoses(a), _bmMl(a), _bmDoses(b), _bmMl(b));

// ── O RED-TEST QUE O LEMUEL ESCREVEU ──
{
  const PED = 'ATEZOLIZUMABE 1200MG FA C/ 20ML';
  const CAND = 'ATEZOLIZUMABE 60MG/ML SOL DIL 20ML';
  ok('1. 1200MG/20ML == 60MG/ML x 20ML (a conta fecha)', eq(PED, CAND) === true, 'got ' + eq(PED, CAND));
  ok('2. simetrico (tanto faz quem tem a massa)', eq(CAND, PED) === true);
  // A GUARDA: conta que NAO fecha continua barrando
  ok('3. 1200MG NAO casa 30MG/ML x 20ML (=600MG)', eq(PED, 'ATEZOLIZUMABE 30MG/ML SOL DIL 20ML') === false);
  ok('4. nem 90MG/ML x 20ML (=1800MG)', eq(PED, 'ATEZOLIZUMABE 90MG/ML SOL DIL 20ML') === false);

  // caminho COMPLETO da busca (nao so o helper)
  const cot = [R('ATEZOLIZUMABE 60MG/ML SOL DIL 20ML', { compra_unit: '4000.00' })];
  ok('5. a busca inteira casa o pedido do cliente', nome(busca(cot, PED)) === 'ATEZOLIZUMABE 60MG/ML SOL DIL 20ML', 'veio: ' + nome(busca(cot, PED)));
  const cotErr = [R('ATEZOLIZUMABE 30MG/ML SOL DIL 20ML', { compra_unit: '2000.00' })];
  ok('6. a busca inteira NAO casa a dose que nao fecha', busca(cotErr, PED) === null, 'veio: ' + nome(busca(cotErr, PED)));
}

// ── OS CASOS REAIS DO 63622 (numeros do proprio pedido) ──
{
  ok('7. CETUXIMABE 100MG/20ML == 5MG/ML 20ML', eq('CETUXIMABE 100MG FA C/ 20ML', 'ERBITUX 5MG/ML F/A 20ML') === true);
  ok('8. DOCETAXEL 20MG/1ML == 20MG/ML 1ML', eq('DOCETAXEL 20MG FA C/ 1ML', 'DOCELIBBS 20MG/ML F/A 1ML') === true);
  ok('9. RITUXIMABE 100MG/10ML == 10MG/ML 10ML', eq('RITUXIMABE 100MG FA C/ 10ML', 'TRUXIMA 10MG/ML F/A 10ML') === true);
  ok('10. FULVESTRANTO 250MG/5ML == 50MG/ML 5ML', eq('FULVESTRANTO 250MG SER C/ 5ML', 'FASLODEX 50MG/ML 5ML') === true);
  ok('11. DENOSUMABE 60MG/1ML == 60MG/ML 1ML', eq('DENOSUMABE 60MG SER C/ 1ML', 'PROLIA 60MG/ML 1ML') === true);
}

// ── AS GUARDAS (o que NAO pode passar) ──
{
  ok('12. volume so num lado nao vale', eq('ATEZOLIZUMABE 1200MG FA', 'ATEZOLIZUMABE 60MG/ML SOL DIL 20ML') === false);
  ok('13. nenhum lado com volume nao vale', eq('ATEZOLIZUMABE 1200MG', 'ATEZOLIZUMABE 60MG/ML') === false);
  ok('14. volumes DIFERENTES nao vale (apresentacao diferente, mesmo fechando a conta em outro frasco)',
    eq('BEVACIZUMABE 400MG FA C/ 4ML', 'ABEVMY 25MG/ML F/A 16ML') === false);
  ok('15. massa x massa continua na regra antiga (nao entra aqui)', eq('X 100MG FA 10ML', 'X 200MG FA 10ML') === false);
  ok('16. conc x conc continua na regra antiga', eq('X 10MG/ML FA 10ML', 'X 20MG/ML FA 10ML') === false);
  ok('17. dose composta (2 componentes) nao entra — so dose unica', eq('X 4MG+500MG FA 10ML', 'X 50MG/ML FA 10ML') === false);
  ok('18. conjunto vazio de um lado nao vale', eq('X FA 20ML', 'X 60MG/ML FA 20ML') === false);
  // OXALIPLATINA 50 x 100 e DOXORRUBICINA 10 x 50: dose REALMENTE diferente, barreira CERTA
  const cotOx = [R('OXALIPLATINA 5MG/ML SOL INJ FA 20ML', { compra_unit: '80.00' })];
  ok('19. OXALIPLATINA 50MG/10ML nao casa o frasco de 100MG (5MG/ML x 20ML)',
    busca(cotOx, 'OXALIPLATINA 50MG FA C/ 10ML') === null, 'veio: ' + nome(busca(cotOx, 'OXALIPLATINA 50MG FA C/ 10ML')));
}

// ── UNIDADES: a conta roda em MG canonico (G e MCG ja convertidos pelo _bmDoses) ──
{
  ok('20. 1G total == 50MG/ML x 20ML (G vira MG antes da conta)', eq('X 1G FA C/ 20ML', 'X 50MG/ML SOL 20ML') === true);
  ok('21. 500MCG total == 0,05MG/ML x 10ML', eq('X 500MCG FA C/ 10ML', 'X 0,05MG/ML SOL 10ML') === true);
  ok('22. UI nao entra na conta (nao e massa)', eq('X 1200UI FA C/ 20ML', 'X 60MG/ML SOL 20ML') === false);
  // >>> ASSERT 23 INVERTIDO EM 03/08 — DECISAO ANTERIOR SUBSTITUIDA, DE PROPOSITO.
  //     Ate 29/07 a regra era "UI e % ficam de fora da conta", porque o % era um token opaco: o
  //     motor nao sabia converter. No bug #5 da 68036 o Lemuel pediu o oposto, com estas palavras:
  //     "porcentagem <-> mg/g|mg/ml (2% = 20mg/g, ARITMETICA E NAO DICIONARIO)". Sem isso, o
  //     SULFATO DE MAGNESIO 50%, o CETOCONAZOL 2% e a HYPOCAINA 2% continuam sem casar.
  //     Entao 6% passou a valer 60MG/ML, e 60 x 20ML = 1200MG fecha — porque E o mesmo produto.
  //     O UI continua fora (assert 22): UI nao converte pra massa, nao ha conta possivel.
  ok('23. *** % AGORA entra na conta: 6% = 60MG/ML, e 60 x 20ML = 1200MG ***',
    eq('X 1200MG FA C/ 20ML', 'X 6% SOL 20ML') === true);
  ok('23b. e a conta com % continua EXATA: 5% (=50MG/ML) x 20ML = 1000MG, nao 1200MG',
    eq('X 1200MG FA C/ 20ML', 'X 5% SOL 20ML') === false);
  ok('24. decimal com virgula fecha exato (37,5MG = 7,5MG/ML x 5ML)', eq('X 37,5MG FA C/ 5ML', 'X 7,5MG/ML SOL 5ML') === true);
  ok('25. quase-fechando NAO passa (sem tolerancia): 1201MG x 60MG/ML 20ML', eq('X 1201MG FA C/ 20ML', 'X 60MG/ML SOL 20ML') === false);
}

// ── "SOL DIL" E INJETAVEL (barreira de FORMA, nao de dose) ──
// O red-test do Lemuel so fecha com isso: "SOL DIL" (solucao para diluicao) estava caindo em
// LIQUIDO_ORAL por causa do "SOL", e a barreira de FORMA matava o par ANTES da conta de dose.
// Medido no banco: 0 linhas tem "SOL DIL" hoje — mudanca de risco zero pro dado existente.
{
  const factory2 = 'let cotacoes=[];let _bmCmed=new Map();let _bmClasseB=new Set();console.warn=function(){};' +
    block('function _undNum(und)', 'let searchTO') + '\n' + block('const _bmStrip = s =>', '/* ─── busca antiga') +
    '\nreturn {_bmForma,_bmFormaCand};';
  const { _bmForma, _bmFormaCand } = (new Function(factory2))();
  ok('28. SOL DIL e INJETAVEL, nao liquido oral', _bmFormaCand('ATEZOLIZUMABE 60MG/ML SOL DIL 20ML') === 'INJETAVEL', _bmFormaCand('ATEZOLIZUMABE 60MG/ML SOL DIL 20ML'));
  ok('29. SOL sozinho continua liquido oral (nao virou regra geral)', _bmForma('DIPIRONA SOL 500MG/ML FR 20ML') === 'LIQUIDO_ORAL', _bmForma('DIPIRONA SOL 500MG/ML FR 20ML'));
  ok('30. SOL ORAL continua oral', _bmForma('PARACETAMOL SOL ORAL 200MG/ML FR 15ML') === 'LIQUIDO_ORAL', _bmForma('PARACETAMOL SOL ORAL 200MG/ML FR 15ML'));
  ok('31. S/DIL e C/DIL seguem injetaveis (ja eram)', _bmFormaCand('CEFTRIAXONA 1G IV C/50 F/A S/DIL') === 'INJETAVEL');
  ok('32. SOL INJ segue injetavel', _bmForma('X SOL INJ 10MG/ML') === 'INJETAVEL');
}

// ── entradas degeneradas nao podem quebrar a busca ──
{
  ok('26. sets vazios / volume nulo devolvem false', _bmDoseTotalEq(new Set(), new Set(), new Set(), new Set()) === false);
  ok('27. volume 0 nao vale', eq('X 0MG FA C/ 0ML', 'X 0MG/ML SOL 0ML') === false);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
