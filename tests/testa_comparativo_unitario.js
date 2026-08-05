// SUITE testa_comparativo_unitario — O COMPARATIVO NÃO PODE MOSTRAR PREÇO DE CAIXA COMO UNITÁRIO.
//
// O CASO QUE O LEMUEL MANDOU TESTAR: CEFALOTINA 1000MG (CEFARISTON) 100FRS/AMP, und "CX",
// global_venda1 = 475,25. A célula tem que mostrar **4,75 un · cx100**, não 475,25.
//
// E O CASO INVERSO, que é o perigoso: quando o pack NÃO está no nome, o `qtdEmbalagem` devolve 1
// — mas esse 1 não quer dizer "a caixa tem uma unidade", quer dizer "não achei o pack". O
// precoUnitario() dividia por ele assim mesmo, e o preço da CAIXA ia parar na célula do unitário
// sem nenhum sinal. Duas cotações lado a lado, "R$ 475,25" e "R$ 4,75", pareciam concorrentes
// quando eram o mesmo preço em granularidades diferentes.
//
// A REGRA (mesma já no ar no Licitações e na giovana): pack sabido -> divide; und unitária
// (AMP/FR/UND) -> o preço já é de unidade; und agregadora (CX/PCT) ou em branco -> NÃO INVENTA,
// devolve status 'conferir' e a opção fica FORA de mínimo, média, win rate, PDF e análise.
//
//   node tests/testa_comparativo_unitario.js
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
const ctx = (new Function(`console.warn=function(){};
  ${konst('_CMP_CALIBRE')} ${konst('_CMP_UND_UNITARIA')} ${konst('_CMP_UND_AGREGADORA')}
  ${fn('_undNum')} ${fn('_qtdDoNome')} ${fn('_semCalibre')} ${fn('qtdEmbalagem')} ${fn('cmpUnitario')}
  return { qtdEmbalagem, cmpUnitario, _semCalibre, _qtdDoNome };`))();
const { qtdEmbalagem, cmpUnitario, _qtdDoNome } = ctx;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_comparativo_unitario — unitario, pack e "nao sei"\n');

const L = o => Object.assign({ produto:'', und:null, compra_unit:null, compra_caixa:null,
  global_venda1:null, global_venda2:null, venda_unit_calculada:null }, o);

// ══════════ 1. O CASO DO LEMUEL ══════════
{
  const c = L({ produto:'CEFALOTINA 1000MG PO IV IM (CEFARISTON) 100FRS/AMP', und:'CX', global_venda1:475.25 });
  const u = cmpUnitario(c);
  ok('1. *** CEFALOTINA 475,25 -> 4,75 por frasco ***', Math.abs(u.valor - 4.7525) < 0.0001, u);
  ok('2. o pack fica registrado (vira o badge "un · cx100")', u.pack === 100, u.pack);
  ok('3. status ok — o pack veio do nome, nao foi chutado', u.status === 'ok', u.status);
  ok('4. o bruto e preservado (o badge mostra de onde veio a divisao)', u.bruto === 475.25, u.bruto);
}

// ══════════ 2. "NÃO SEI" NÃO PODE VIRAR NÚMERO ══════════
// Sem contagem no nome e com und agregadora, dividir por 1 seria afirmar que a caixa tem
// uma unidade. A tela precisa dizer "conferir emb." — que e a verdade.
{
  const c = L({ produto:'LUVA DE PROCEDIMENTO LATEX TAM M', und:'CX', global_venda1:38.90 });
  const u = cmpUnitario(c);
  ok('5. caixa sem contagem no nome -> "conferir", nao 38,90 por luva', u.status === 'conferir', u);
  ok('6. ...e o valor bruto vai junto, pra tela mostrar "R$ 38,90 / emb."', u.bruto === 38.9, u.bruto);
  ok('7. ...e NAO devolve `valor` — quem consome nao tem como usar sem querer', u.valor === undefined, u.valor);
}
{
  const c = L({ produto:'SERINGA DESCARTAVEL 3ML', und:null, global_venda1:120 });
  ok('8. und em BRANCO tambem e "nao sei" (silencio nunca vira 1 por otimismo)',
    cmpUnitario(c).status === 'conferir', cmpUnitario(c));
}
{
  const c = L({ produto:'PACOTE COMPRESSA CIRURGICA', und:'PCT', compra_caixa:26.93 });
  ok('9. PCT sem contagem -> "conferir"', cmpUnitario(c).status === 'conferir', cmpUnitario(c));
}

// ══════════ 3. UND UNITÁRIA: o preço JÁ é de unidade ══════════
// "AMP", "FR", "UND" nao sao agregadores. Aqui pack=1 significa mesmo 1, e marcar "conferir"
// esconderia preco bom sem motivo — o erro oposto, igualmente caro.
{
  ok('10. und AMP: 2,40 e o preco da ampola', cmpUnitario(L({produto:'DIPIRONA 500MG/ML 2ML', und:'AMP', global_venda1:2.40})).valor === 2.40);
  ok('11. und FR: preco do frasco', cmpUnitario(L({produto:'SORO FISIOLOGICO 500ML', und:'FR', global_venda1:5.10})).valor === 5.10);
  ok('12. und UND', cmpUnitario(L({produto:'SONDA FOLEY 3 VIAS N24', und:'UND', global_venda1:3.12})).valor === 3.12);
  ok('13. und UNIDADE por extenso', cmpUnitario(L({produto:'X', und:'Unidade', global_venda1:9})).valor === 9);
}

// ══════════ 4. compra_unit é DADO, não cálculo ══════════
// O importador ja decidiu que aquilo e unitario. Passar por divisao de novo seria dividir duas
// vezes o mesmo preco.
{
  const c = L({ produto:'AMOXICILINA 500MG C/500 CPR', und:'CX', compra_unit:0.3298, compra_caixa:164.90 });
  const u = cmpUnitario(c);
  ok('14. compra_unit manda e NAO e dividido pelo pack de 500', u.valor === 0.3298, u.valor);
  ok('15. ...e o pack reportado e 1 (nao houve divisao)', u.pack === 1, u.pack);
}

// ══════════ 5. CALIBRE FRENCH ≠ PACK (porte do Licitações) ══════════
// "SONDA URETRAL 22FR" tem 22 de calibre. O _qtdDoNome lista FR entre as unidades contaveis
// (por causa de "50FR" = 50 frascos) e dividia o preco por 22 — R$ 0,03 por sonda.
{
  ok('16. SONDA URETRAL 22FR nao tem pack 22', qtdEmbalagem(null, 'SONDA URETRAL DESC 22FR') === 1, qtdEmbalagem(null,'SONDA URETRAL DESC 22FR'));
  ok('17. CATETER 20FR idem', qtdEmbalagem(null, 'CATETER INTRAVENOSO 20FR') === 1);
  ok('18. e a sonda com und CX vira "conferir", que e a verdade',
    cmpUnitario(L({produto:'SONDA URETRAL DESC 22FR', und:'CX', global_venda1:66})).status === 'conferir');
  // o soro NAO e produto de calibre — 16FR continua sendo 16 frascos
  ok('19. *** SORO 500ML S/F 16FR continua lendo 16 frascos ***', _qtdDoNome('SORO FISIOLOGICO 500ML S/F 16FR') === 16, _qtdDoNome('SORO FISIOLOGICO 500ML S/F 16FR'));
  ok('20. e o unitario do soro sai dividido por 16', Math.abs(cmpUnitario(L({produto:'SORO FISIOLOGICO 500ML S/F 16FR', und:'CX', global_venda1:80})).valor - 5) < 1e-9);
}

// ══════════ 6. OUTROS PACKS REAIS DO BANCO ══════════
{
  ok('21. "C/500 CPR" -> 500', _qtdDoNome('AMOXICILINA 500MG C/500 CPR') === 500, _qtdDoNome('AMOXICILINA 500MG C/500 CPR'));
  ok('22. "100AMP" -> 100', _qtdDoNome('COMPLEXO B 2ML 100AMP (SANTIPLEX B)') === 100, _qtdDoNome('COMPLEXO B 2ML 100AMP (SANTIPLEX B)'));
  ok('23. "60UND" -> 60', _qtdDoNome('METRONIDAZOL 5MG/ML 100ML 60UND (GEN)') === 60, _qtdDoNome('METRONIDAZOL 5MG/ML 100ML 60UND (GEN)'));
  ok('24. "50FRS" -> 50', _qtdDoNome('ACICLOVIR 250MG PO IV C/50FR') === 50, _qtdDoNome('ACICLOVIR 250MG PO IV C/50FR'));
  // MEDIDA nao e contagem
  ok('25. "FR C/240ML" e 1 frasco de 240ml, nao 240 unidades', _qtdDoNome('AMOXICILINA SUSP FR C/240ML') === 1, _qtdDoNome('AMOXICILINA SUSP FR C/240ML'));
  ok('26. "PCT 50G" e 1 pacote de 50 gramas', _qtdDoNome('ALGODAO PCT 50G') === 1, _qtdDoNome('ALGODAO PCT 50G'));
}

// ══════════ 7. und NUMÉRICA vinda do import manda ══════════
{
  ok('27. und "100" -> pack 100 mesmo sem nada no nome', qtdEmbalagem('100', 'PRODUTO QUALQUER') === 100);
  ok('28. e o unitario sai dividido', cmpUnitario(L({produto:'PRODUTO QUALQUER', und:'100', global_venda1:250})).valor === 2.5);
}

// ══════════ 8. SEM PREÇO ══════════
{
  ok('29. sem nenhum preco -> sem-preco (a linha nem entra na tela)', cmpUnitario(L({produto:'X', und:'CX'})).status === 'sem-preco');
  ok('30. preco zero tambem e sem-preco', cmpUnitario(L({produto:'X', und:'AMP', global_venda1:0})).status === 'sem-preco');
}

// ══════════ 9. O QUE A REGRA IMPEDE, EM NÚMERO ══════════
// Prova de que o "conferir" nao e preciosismo: sem ele, a caixa de 100 entraria numa media
// com o unitario e a puxaria pra 100x o valor real.
{
  const caixa = cmpUnitario(L({ produto:'DIPIRONA 500MG COMPRIMIDO', und:'CX', global_venda1:47.50 }));
  const unid  = cmpUnitario(L({ produto:'DIPIRONA 500MG COMPRIMIDO', und:'UND', global_venda1:0.48 }));
  ok('31. a caixa nao vira 47,50 por comprimido', caixa.status === 'conferir', caixa);
  ok('32. a unidade continua valendo', unid.valor === 0.48);
  const certas = [caixa, unid].filter(u => u.status === 'ok');
  const media = certas.reduce((a,u)=>a+u.valor,0) / certas.length;
  ok('33. media so das certas = 0,48 (com a caixa dentro daria 23,99)', Math.abs(media - 0.48) < 1e-9, media);
}

// ══════════ 10. RESGATE DO PREÇO DE CAIXA GRAVADO EM compra_unit ══════════
// CASO REAL medido no ar em 05/08: ELLO "CEFARISTON 1GR CX C/100" com compra_unit = 493,75
// contra STOCK MED a 4,4989 pelo mesmo item. A media de mercado do grupo ia a R$ 328,84.
// A regra exige EVIDENCIA DUPLA: o nome declara o pack E o preco dividido por ele cai em
// cima do mercado. Aqui esta ela isolada, na mesma forma que roda dentro do buildGrupos.
function resgata(opcoes){
  const foto = opcoes.filter(o => !o.incerto && o.compra > 0).map(o => ({ o, v: o.compra }));
  if (foto.length < 2) return opcoes;
  const mediana = arr => { const s = arr.slice().sort((a,b)=>a-b); const m = s.length>>1;
                           return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
  for (const { o } of foto) {
    if (o.pack > 1) continue;
    const packNome = qtdEmbalagem(o.und, o.produto);
    if (!(packNome > 1)) continue;
    const ref = foto.filter(x => x.o !== o).map(x => x.v);
    if (!ref.length) continue;
    const pref = mediana(ref);
    if (!(pref > 0) || !(o.compra / pref >= 3)) continue;
    const corr = o.compra / packNome;
    if (corr < pref * 0.4 || corr > pref * 2.5) continue;
    o.bruto = o.compra; o.incerto = true; o.pareceCaixa = { pack: packNome, corr };
  }
  return opcoes;
}
const O = (forn, produto, compra, und) => ({ forn, produto, compra, und: und||null, pack:1, incerto:false });

// >>> A REGRA SINALIZA, NAO CORRIGE. Trocar o numero em silencio e tentador e e o erro caro:
//     num falso positivo, um preco legitimo passaria a parecer 100x mais barato e viraria "o
//     menor da linha", mandando comprar no fornecedor errado. Marcado como incerto ele sai de
//     minimo/media/ranking — some a distorcao, que era o problema — e a divisao aparece como
//     HIPOTESE na tela. A tela nao tem autoridade pra reescrever preco; o operador tem.
{
  const g = resgata([
    O('STOCK MED', 'CEFALOTINA 1GR IV/IM 100 F/A', 4.4989, 'FA'),
    O('ELLO',      'CEFARISTON 1GR CX C/100',      493.75, null),
  ]);
  const ello = g.find(o=>o.forn==='ELLO');
  ok('34. *** ELLO 493,75 e marcada como "parece caixa" (o caso real do ar) ***', ello.incerto === true, ello);
  ok('35. ...com a divisao sugerida como hipotese: ÷100 = 4,9375', ello.pareceCaixa && Math.abs(ello.pareceCaixa.corr - 4.9375) < 1e-9, ello.pareceCaixa);
  ok('36. ...e o preco NAO foi reescrito (o banco continua mandando)', ello.compra === 493.75, ello.compra);
  ok('37. ...com o bruto guardado pra exibicao', ello.bruto === 493.75);
  ok('38. o preco certo do STOCK MED nao foi tocado', g.find(o=>o.forn==='STOCK MED').compra === 4.4989);
  // e o efeito que importava: a media do grupo deixa de ser envenenada
  const certas = g.filter(o=>!o.incerto);
  const media = certas.reduce((a,o)=>a+o.compra,0)/certas.length;
  ok('39. media so das certas = 4,4989 (com a ELLO dentro daria 249,12)', Math.abs(media - 4.4989) < 1e-9, media);
}
{
  // "1AMP 3,5ML": o "3" e MEDIDA, nao contagem. Sem o lookahead de decimal, o _qtdDoNome
  // devolvia 3 e a CEFTRIAXONA de R$ 13,26 aparecia como "parece caixa, ÷3 = R$ 4,42".
  ok('39b. *** "CEFTRIAXONA 1G PO INJ 1AMP 3,5ML" nao tem pack 3 ***',
    _qtdDoNome('#G.CEFTRIAXONA I/M 1G PO INJ 1AMP 3,5ML') === 1, _qtdDoNome('#G.CEFTRIAXONA I/M 1G PO INJ 1AMP 3,5ML'));
}

// ── E AGORA O QUE ELA NÃO PODE FAZER ──────────────────────────────────────────────────────
// Uma marca cara de verdade tambem custa 3x o generico. Se a regra so olhasse "destoa do
// grupo", ela dividiria preco legitimo por 100 e faria a marca premium parecer a mais barata
// da tela — o erro oposto, e pior, porque leva a comprar errado.
{
  const g = resgata([
    O('GENERICO A', 'DIPIRONA 500MG C/100 CPR', 0.30, 'CX'),
    O('GENERICO B', 'DIPIRONA 500MG C/100 CPR', 0.35, 'CX'),
    O('MARCA CARA', 'NOVALGINA 500MG C/100 CPR', 1.80, 'CX'),
  ]);
  ok('40. marca 6x mais cara NAO e dividida: 1,80 ÷100 = 0,018 nao bate com o mercado (0,30)',
    g.find(o=>o.forn==='MARCA CARA').compra === 1.80, g.find(o=>o.forn==='MARCA CARA').compra);
}
{
  // sem pack no nome, nao ha (1) — a regra nem tenta, por mais que o preco destoe
  const g = resgata([
    O('A', 'SORO FISIOLOGICO 500ML', 5.10, 'FR'),
    O('B', 'SORO FISIOLOGICO 500ML', 5.40, 'FR'),
    O('C', 'SORO FISIOLOGICO 500ML', 300.00, 'FR'),
  ]);
  ok('41. preco absurdo mas SEM pack no nome fica como esta (a tela nao inventa divisor)',
    g.find(o=>o.forn==='C').compra === 300, g.find(o=>o.forn==='C').compra);
}
{
  // UM PEER SÓ BASTA — e isto e deliberado, nao descuido. O caso real da ELLO tem exatamente
  // dois fornecedores no grupo, ou seja UM peer. Exigir dois deixaria o defeito que motivou a
  // regra sem correcao. O que sustenta a decisao com um peer so nao e a quantidade de amostras
  // e sim a COINCIDENCIA: o nome dizer "C/100" E o valor dividido por 100 cair em cima desse
  // peer sao dois fatos independentes. Bater por acaso exigiria o pack explicar a razao exata.
  const g = resgata([ O('A','X 1G C/100', 4.50, 'FA'), O('B','X 1G CX C/100', 450, null) ]);
  ok('42. com um peer só a regra AGE, desde que a divisão caia em cima dele',
    g.find(o=>o.forn==='B').incerto === true, g.find(o=>o.forn==='B'));
}
{
  // ...e o contraprova: um peer so, mas a divisao NAO cai nele -> nao corrige.
  const g = resgata([ O('A','X 1G C/100', 4.50, 'FA'), O('B','X 1G CX C/100', 9000, null) ]);
  ok('42b. um peer e divisão que NÃO cai nele (9000÷100=90 vs 4,50) -> nem sinaliza',
    !g.find(o=>o.forn==='B').incerto, g.find(o=>o.forn==='B'));
}
{
  // a divisao tem que CAIR no mercado: pack errado no nome nao pode ser usado
  const g = resgata([
    O('A','ITEM C/10 UND', 2.00,'CX'), O('B','ITEM C/10 UND', 2.20,'CX'),
    O('C','ITEM C/10 UND', 900.00,'CX'),   // ÷10 = 90, longe dos ~2
  ]);
  ok('43. 900 ÷10 = 90 nao bate com o mercado (~2) -> nao corrige, fica visivel como esta',
    g.find(o=>o.forn==='C').compra === 900, g.find(o=>o.forn==='C').compra);
}
// ── OS DOIS DEFEITOS QUE A 1ª VERSAO DESTA REGRA TINHA (pegos no ar em 05/08) ─────────────
{
  // CASCATA: a 1a versao lia o preco dos vizinhos DEPOIS de ja ter corrigido alguns. Como a
  // correcao divide por 100, o preco corrigido virava a nova "referencia de mercado" e puxava
  // o vizinho seguinte junto. Medido: 107 linhas resgatadas, entre elas uma ampola de dipirona
  // de R$ 0,56 virando R$ 0,0056. A regra comendo o proprio rabo.
  const g = resgata([
    O('A','DIPIRONA 500MG/ML 2ML 100 AMP', 0.56, 'CX'),
    O('B','DIPIRONA 500MG/ML 2ML 100 AMP', 0.69, 'CX'),
    O('C','DIPIRONA 500MG/ML 2ML 100 AMP', 0.83, 'CX'),
    O('D','DIPIRONA CX C/100 AMP 2ML',    75.00, 'CX'),   // esta SIM e preco de caixa
  ]);
  ok('45. a caixa de verdade (75,00) e sinalizada, com ÷100 = 0,75 como hipotese',
    g.find(o=>o.forn==='D').incerto === true && Math.abs(g.find(o=>o.forn==='D').pareceCaixa.corr - 0.75) < 1e-9, g.find(o=>o.forn==='D'));
  ok('46. *** e as 3 ampolas de preco unitario legitimo NAO sao tocadas (sem cascata) ***',
    g.filter(o=>['A','B','C'].includes(o.forn)).every(o => !o.incerto),
    g.filter(o=>['A','B','C'].includes(o.forn)).map(o=>o.compra));
}
{
  // MINIMO x MEDIANA: com min, UMA linha ja errada pra baixo entrega a referencia inteira e
  // faz todo o resto do grupo parecer "3x acima do mercado". A mediana precisa que METADE do
  // grupo esteja errada pra ser enganada.
  const g = resgata([
    O('ERRADA','ITEM C/100 UND',  0.02, 'CX'),   // linha ja furada pra baixo no banco
    O('BOA1',  'ITEM C/100 UND',  2.00, 'CX'),
    O('BOA2',  'ITEM C/100 UND',  2.10, 'CX'),
    O('BOA3',  'ITEM C/100 UND',  2.20, 'CX'),
  ]);
  ok('47. uma linha furada pra baixo nao arrasta o grupo (mediana ~2,10, nao min 0,02)',
    g.filter(o=>o.forn.startsWith('BOA')).every(o => !o.incerto),
    g.filter(o=>o.forn.startsWith('BOA')).map(o=>o.compra));
}
{
  // quem ja veio dividido pelo cmpUnitario nao e mexido de novo (divisao dupla)
  const o = { forn:'A', produto:'X 100FRS/AMP', compra:4.75, und:'CX', pack:100, incerto:false, bruto:475 };
  const g = resgata([ o, O('B','X 100FRS/AMP', 4.80,'FA'), O('C','X 100FRS/AMP', 4.90,'FA') ]);
  ok('44. opcao com pack>1 ja resolvido nao passa pela regra de novo', o.compra === 4.75, o.compra);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
