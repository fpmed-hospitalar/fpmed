// SUITE testa_bug5_concentracao — ARITMETICA DE CONCENTRACAO e os de-para do bug #5 da 68036.
//
// DE ONDE VEM: 24 itens da proposta 68036 sairam "sem match" estando no estoque ou na lista de um
// fornecedor. O diagnostico (tools/diag_bug5.js, que instrumenta o motor e diz QUAL barreira
// rejeitou cada linha) mostrou que a maioria nao era falta de sinonimo — era CONTA:
//   2% e 20MG/G e 20MG/ML sao a MESMA concentracao        (1% = 1g/100ml = 10mg/ml)
//   250MG/5ML e 50MG/ML sao a MESMA concentracao          (dose por volume -> concentracao)
//   200+40MG/5ML sao DOIS componentes por 5ml             (a unidade escrita so no fim vale pros dois)
//   2MG/ML x 2ML = 4MG                                    (dose total = concentracao x volume)
// e um defeito puro no meio: "1.200.000UI" era lido como 200UI (o separador de milhar virava
// decimal). Os dois lados erravam junto, entao o casamento ate funcionava — mas "5.000.000UI"
// virava 0UI, e dose errada e o tipo de erro que chega no paciente, nao no total.
//
// AS LINHAS DE PRODUTO AQUI SAO REAIS, copiadas do banco pelo diagnostico.
//   node tests/testa_bug5_concentracao.js
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
  'return { api:{ buscarMelhorProduto, _bmDoses, _bmMl, _bmDoseTotalEqSemVol, _bmVaso }, setCot:function(a){cotacoes=a;} };';
const ctx = (new Function(factory))();
const { buscarMelhorProduto, _bmDoses, _bmMl, _bmDoseTotalEqSemVol, _bmVaso } = ctx.api;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e != null ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_bug5_concentracao — aritmetica de concentracao\n');

const R = (produto, o) => Object.assign({ produto, principio_ativo: '', und: '', compra_unit: '10.00',
  global_venda1: '', tipo: 'fornecedor', fornecedor: 'FORN_A', estoque: '0' }, o || {});
const busca = (cot, q) => { ctx.setCot(cot); return buscarMelhorProduto(q); };
const nome = r => r ? r.produto : null;
const dz = t => [..._bmDoses(t)].sort();

// ══════════ O DEFEITO PURO: SEPARADOR DE MILHAR ══════════
// Nao e regra de negocio, e leitura errada de numero. A regex casava o ultimo grupo de 3 digitos
// como se fosse a parte decimal: "1.200.000UI" -> 200UI, "600.000UI" -> 600UI, "5.000.000UI" -> 0UI.
{
  ok('1. *** 1.200.000UI vale 1200000 UI, nao 200 ***', dz('BEPEBEN 1.200.000UI C/50').join() === '1200000UI', dz('BEPEBEN 1.200.000UI C/50'));
  ok('2. *** 600.000UI vale 600000 UI, nao 600 ***', dz('PENICILINA G BENZ 600.000 UI').join() === '600000UI', dz('PENICILINA G BENZ 600.000 UI'));
  ok('3. *** 5.000.000UI vale 5000000 UI, nao 0 ***', dz('PENICILINA CRISTALICA 5.000.000UI').join() === '5000000UI', dz('PENICILINA CRISTALICA 5.000.000UI'));
  ok('4. 5.000UI da heparina vale 5000', dz('HEPARINA 5.000UI').join() === '5000UI', dz('HEPARINA 5.000UI'));
  ok('5. 20.000UI/G da nistatina vale 20000', dz('NISTATINA 20.000UI/G').join() === '20000UI/ML', dz('NISTATINA 20.000UI/G'));
  // >>> A GUARDA: decimal escrito com PONTO nao pode virar milhar. Digoxina 0,125MG existe.
  ok('6. *** "0.125MG" continua 0,125MG (nao vira 125MG) ***', dz('DIGOXINA 0.125MG').join() === '0.125MG', dz('DIGOXINA 0.125MG'));
  ok('7. e "0,125MG" com virgula tambem', dz('DIGOXINA 0,125MG').join() === '0.125MG', dz('DIGOXINA 0,125MG'));
  ok('8. "3,5ML" nao e dose nenhuma', dz('CEFTRIAXONA 1G CX C/1 FR+1 AMP 3,5ML DIL').indexOf('3.5MG') < 0, dz('CEFTRIAXONA 1G CX C/1 FR+1 AMP 3,5ML DIL'));
  // e o casamento continua distinguindo as duas penicilinas (que e o que importa de verdade)
  ok('9. *** 600.000 NAO casa 1.200.000 ***',
    nome(busca([R('PENICILINA G BENZ 1.200.000 UI S/DIL CX/50FRS TEUTO')], 'PENICILINA G BENZ 600.000UI')) === null);
}

// ══════════ PORCENTAGEM == MG/ML == MG/G ══════════
// 1% = 1g em 100ml = 10mg/ml. Nao e dicionario, e conta: produto novo entra sozinho.
{
  ok('10. *** 2% == 20MG/ML ***', dz('LIDOCAINA 2%').join() === '20MG/ML', dz('LIDOCAINA 2%'));
  ok('11. *** 50% == 500MG/ML ***', dz('SULFATO MAGNESIO 50%').join() === '500MG/ML', dz('SULFATO MAGNESIO 50%'));
  ok('12. *** 0,9% == 9MG/ML ***', dz('SORO FISIOLOGICO 0,9%').join() === '9MG/ML', dz('SORO FISIOLOGICO 0,9%'));
  ok('13. *** 20MG/G == 20MG/ML (grama e mililitro sao a mesma base) ***',
    dz('CETOCONAZOL 20MG/G').join() === '20MG/ML', dz('CETOCONAZOL 20MG/G'));

  // CASO 2 do pedido — o cliente escreveu A MESMA concentracao nas DUAS notacoes
  ok('14. *** SULFATO DE MAGNESIO 500MG/ML (50%) 10ML -> SULFATO MAGNESIO 50% CX200 FR AMP 10ML ***',
    nome(busca([R('SULFATO MAGNESIO 50% CX200 FR AMP 10ML', { principio_ativo: 'SULFATO DE MAGNESIO' })],
      'SULFATO DE MAGNESIO 500MG/ML (50%) 10ML')) === 'SULFATO MAGNESIO 50% CX200 FR AMP 10ML');
  ok('15. e as duas notacoes juntas viram UMA dose so (nao um composto de dois)',
    dz('SULFATO DE MAGNESIO 500MG/ML (50%) 10ML').join() === '500MG/ML', dz('SULFATO DE MAGNESIO 500MG/ML (50%) 10ML'));
  ok('16. *** a de 10% continua fora (concentracao diferente e produto diferente) ***',
    nome(busca([R('SULFATO MAGNESIO 10% F/A 200X10ML', { principio_ativo: 'SULFATO DE MAGNESIO' })],
      'SULFATO DE MAGNESIO 500MG/ML (50%) 10ML')) === null);

  // CASO 3 — creme: 2% == 20MG/G
  ok('17. *** CETOCONAZOL 2% 30G -> CETOCONAZOL 20MG/G CX100 BISNAGAS 30G ***',
    nome(busca([R('CETOCONAZOL 20MG/G CX100 BISNAGAS 30G', { principio_ativo: 'CETOCONAZOL' })],
      'CETOCONAZOL 2% 30G')) === 'CETOCONAZOL 20MG/G CX100 BISNAGAS 30G');

  // CASO 5 — lidocaina com vasoconstritor
  ok('18. *** LIDOCAINA + EPINEFRINA 20MG/ML -> HYPOCAINA 2% C/VASO CONST CX25 AMP 20ML ***',
    nome(busca([R('HYPOCAINA 2% C/VASO CONST CX25 AMP 20ML', { principio_ativo: 'LIDOCAINA' })],
      'LIDOCAINA + EPINEFRINA 20MG/ML')) === 'HYPOCAINA 2% C/VASO CONST CX25 AMP 20ML');
}

// ══════════ EPINEFRINA = VASOCONSTRITOR (guarda dos dois lados) ══════════
// Anestesico COM vaso e SEM vaso sao produtos diferentes — trocar um pelo outro muda o
// procedimento. O motor so olhava "C/V" e "S/V"; o cliente escreve o vasoconstritor pelo NOME.
{
  ok('19. *** "EPINEFRINA" no pedido significa COM vasoconstritor ***', _bmVaso('LIDOCAINA + EPINEFRINA 20MG/ML') === 'COM', _bmVaso('LIDOCAINA + EPINEFRINA 20MG/ML'));
  ok('20. "ADRENALINA" tambem', _bmVaso('LIDOCAINA C/ ADRENALINA') === 'COM');
  ok('21. e "C/VASO CONST" continua COM', _bmVaso('HYPOCAINA 2% C/VASO CONST CX25 AMP 20ML') === 'COM');
  ok('22. "S/V" continua SEM', _bmVaso('HYPOCAINA LIDOCAINA 2% S/V 20MG/ML CX100 AMP 5ML') === 'SEM');
  ok('23. *** pedido COM epinefrina NAO pode receber a versao SEM vaso ***',
    nome(busca([R('LIDOCAINA 2% S/VASO 20ML GENERICO HYPOFARMA (AMP)', { principio_ativo: 'LIDOCAINA' })],
      'LIDOCAINA + EPINEFRINA 20MG/ML')) === null);
}

// ══════════ DOSE POR VOLUME -> CONCENTRACAO (250MG/5ML == 50MG/ML) ══════════
{
  ok('24. *** 250MG/5ML == 50MG/ML ***', dz('CEFALEXINA 250MG/5ML SUSP').join() === '50MG/ML', dz('CEFALEXINA 250MG/5ML SUSP'));
  ok('25. "5MG/ML" (denominador 1 implicito) continua igual', dz('BROMOPRIDA 5MG/ML').join() === '5MG/ML');
  ok('26. *** CEFALEXINA SUSP 50MG/ML 60ML -> CEFALEXINA 250MG/5ML SUSP 60ML ***',
    nome(busca([R('CEFALEXINA 250MG/5ML SUSP 60ML TEUTO', { principio_ativo: 'CEFALEXINA' })],
      'CEFALEXINA SUSP 50MG/ML 60ML')) === 'CEFALEXINA 250MG/5ML SUSP 60ML TEUTO');
  ok('27. *** a de 100ML continua fora: volume e barreira ***',
    nome(busca([R('CEFALEXINA 250MG/5ML SUSP 100ML', { principio_ativo: 'CEFALEXINA' })],
      'CEFALEXINA SUSP 50MG/ML 60ML')) === null);
  // composto com a unidade so no fim: "200+40MG/5ML" = 40MG/ML + 8MG/ML
  ok('28. *** 200+40MG/5ML == 40MG/ML + 8MG/ML ***',
    dz('BACTRIM 200+40MG/5ML SUSP 100ML').join() === ['40MG/ML', '8MG/ML'].sort().join(),
    dz('BACTRIM 200+40MG/5ML SUSP 100ML'));
  ok('29. e "40+8MG/ML" do pedido da o mesmo par',
    dz('SULFA+TRIM 40+8MG/ML 50ML').join() === ['40MG/ML', '8MG/ML'].sort().join(),
    dz('SULFA+TRIM 40+8MG/ML 50ML'));
}

// ══════════ DOSE TOTAL SEM VOLUME DECLARADO (o caso do pancuronio) ══════════
// A regra "dose total = concentracao x volume" exigia volume nos DOIS lados. So que um pedido
// normal escreve SO a dose total ("BROMETO DE PANCURONIO 4MG") — nunca o volume. Ou seja: a regra
// nunca podia disparar justamente no caso mais comum. Agora, quando o lado da MASSA nao declara
// volume, quem manda e o volume do lado da CONCENTRACAO. A conta continua EXATA, sem folga.
{
  const eq = (a, b) => _bmDoseTotalEqSemVol(_bmDoses(a), _bmMl(a), _bmDoses(b), _bmMl(b));
  ok('30. *** 4MG (sem volume) == 2MG/ML x 2ML ***', eq('BROMETO DE PANCURONIO 4MG', 'BROM. DE PANCURONIO 2MG/ML 2ML') === true);
  ok('31. simetrico', eq('BROM. DE PANCURONIO 2MG/ML 2ML', 'BROMETO DE PANCURONIO 4MG') === true);
  ok('32. *** BROMETO DE PANCURONIO 4MG -> BROM. DE PANCURONIO 2MG/ML 2ML CRISTALIA CX/50AMP ***',
    nome(busca([R('BROM. DE PANCURONIO 2MG/ML 2ML CRISTALIA CX/50AMP', { principio_ativo: 'BROMETO DE PANCURONIO' })],
      'BROMETO DE PANCURONIO 4MG')) === 'BROM. DE PANCURONIO 2MG/ML 2ML CRISTALIA CX/50AMP');
  // AS GUARDAS: a conta tem que FECHAR, e sem volume no candidato nao ha conta
  ok('33. *** 4MG NAO casa 2MG/ML x 5ML (=10MG) ***', eq('BROMETO DE PANCURONIO 4MG', 'PANCURONIO 2MG/ML 5ML') === false);
  ok('34. *** sem volume no candidato, nao ha conta: 10MG nao casa 10MG/ML ***',
    eq('DIMORF 10MG', 'DIMORF 10MG/ML') === false);
  ok('35. e se o pedido declara volume DIFERENTE, continua barrado',
    eq('PANCURONIO 4MG 5ML', 'PANCURONIO 2MG/ML 2ML') === false);
}

// ══════════ PENICILINA: DE-PARA DO NOME + GUARDA DE SUBTIPO ══════════
// "BENZILPENICILINA BENZATINA" (nome oficial) e "PENICILINA G BENZATINA" / "BENZETACIL" sao a
// mesma coisa. Mas benzatina, procaina e cristalica NAO SAO — e o de-para sozinho abriria a porta
// pra trocar uma pela outra, que e erro clinico. Por isso o de-para vem COM a guarda de subtipo.
{
  ok('36. *** BENZILPENICILINA BENZATINA 600.000UI -> PENICILINA G BENZ 600.000 UI TEUTO ***',
    nome(busca([R('PENICILINA G BENZ 600.000 UI S/DIL CX/50FRS TEUTO')], 'BENZILPENICILINA BENZATINA 600.000UI'))
    === 'PENICILINA G BENZ 600.000 UI S/DIL CX/50FRS TEUTO');
  ok('37. e BENZETACIL tambem e a mesma coisa',
    nome(busca([R('BENZETACIL 600.000UI IM CX50 FR AMP')], 'BENZILPENICILINA BENZATINA 600.000UI'))
    === 'BENZETACIL 600.000UI IM CX50 FR AMP');
  ok('38. *** GUARDA: benzatina NAO recebe cristalica (subtipo diferente) ***',
    nome(busca([R('PENICILINA CRISTALICA 600.000UI FR AMP')], 'BENZILPENICILINA BENZATINA 600.000UI')) === null);
  ok('39. *** nem procaina ***',
    nome(busca([R('PENICILINA G PROCAINA 600.000UI FR AMP')], 'BENZILPENICILINA BENZATINA 600.000UI')) === null);
  ok('40. e a dose continua mandando: 600.000 nao vira 1.200.000',
    nome(busca([R('PENICILINA G BENZ 1.200.000 UI S/DIL CX/50FRS TEUTO')], 'BENZILPENICILINA BENZATINA 600.000UI')) === null);
}

// ══════════ AS GUARDAS DE SORO (de-para NAO pode virar vale-tudo) ══════════
// A 68036 pede RINGER SIMPLES e o estoque tem RINGER LACTATO. Sao solucoes diferentes.
{
  ok('41. *** RINGER SIMPLES nao recebe RINGER COM LACTATO ***',
    nome(busca([R('SORO RINGER C/ LACTATO 500ML', { principio_ativo: 'CLORETO DE SODIO' })],
      'SOLUCAO DE RINGER SIMPLES 500ML')) === null);
  ok('42. *** SORO FISIOLOGICO nao recebe SORO GLICOSADO ***',
    nome(busca([R('SORO GLICOSADO 5% CX40 FR 250ML', { principio_ativo: 'GLICOSE' })],
      'CLORETO DE SODIO 0,9% 250ML')) === null);
  ok('43. *** nem GLICOFISIOLOGICO ***',
    nome(busca([R('SORO GLICOFISIOLOGICO CX40 FR 250ML', { principio_ativo: 'CLORETO DE SODIO' })],
      'CLORETO DE SODIO 0,9% 250ML')) === null);
  ok('44. e o soro fisiologico certo continua casando',
    nome(busca([R('SORO FISIOLOGICO 0,9% SF CX40 FR 250ML', { principio_ativo: 'CLORETO DE SODIO' })],
      'CLORETO DE SODIO 0,9% 250ML SIST FECHADO')) === 'SORO FISIOLOGICO 0,9% SF CX40 FR 250ML');
}

// ══════════ O QUE JA FUNCIONAVA NAO PODE QUEBRAR ══════════
// A aritmetica mexe no coracao da comparacao de dose. Estes sao os casos que o motor JA acertava.
{
  ok('45. oncologico do 63622 (dose total x concentracao x volume) segue casando',
    nome(busca([R('ATEZOLIZUMABE 60MG/ML SOL DIL 20ML', { principio_ativo: 'ATEZOLIZUMABE' })],
      'ATEZOLIZUMABE 1200MG FA C/ 20ML')) === 'ATEZOLIZUMABE 60MG/ML SOL DIL 20ML');
  ok('46. dose simples continua exata: 500MG nao casa 250MG',
    nome(busca([R('DIPIRONA 250MG CX10 CPR', { principio_ativo: 'DIPIRONA' })], 'DIPIRONA 500MG')) === null);
  ok('47. e 500MG casa 500MG',
    nome(busca([R('DIPIRONA 500MG CX10 CPR', { principio_ativo: 'DIPIRONA' })], 'DIPIRONA 500MG')) === 'DIPIRONA 500MG CX10 CPR');
  ok('48. MCG continua convertendo pra MG', dz('LEVOTIROXINA 50MCG').join() === '0.05MG', dz('LEVOTIROXINA 50MCG'));
  ok('49. G continua convertendo pra MG', dz('CEFTRIAXONA 1G').join() === '1000MG', dz('CEFTRIAXONA 1G'));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
