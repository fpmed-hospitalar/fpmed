// SUITE testa_teto_cmed — UM CONFERIDOR QUE DA VERDE NO QUE NAO CONFERIU E PIOR QUE NENHUM.
//
// Motor compartilhado do Conferidor de Proposta (2.11) e do Gerador de Proposta (2.7),
// 08/08/2026. Conferir proposta pronta e sugerir preco na hora de montar sao A MESMA CONTA em
// dois momentos -- escrever duas vezes e criar o par que diverge, e este projeto ja pagou por
// isso no preco unitario (uma tela dividia pelo pack, a outra nao).
//
// O QUE ESTA SUITE PROTEGE:
//   1. NAO ENCONTRADO != DENTRO DO TETO. A regra mais importante. Item que nao casa volta como
//      `nao_encontrado`, nunca "ok" -- e o resumo conta os dois SEPARADAMENTE. Dar confianca
//      onde nao ha informacao e o jeito de alguem mandar a proposta errada.
//   2. PRECO DE CAIXA NAO ENTRA NA CONTA. `unitario` e DECLARADO por quem chama. Comparar preco
//      de caixa com teto unitario daria "10x acima" e mandaria refazer uma proposta correta.
//   3. FAIXA -> USA O MENOR TETO. DIPIRONA 1000MG tem 31 apresentacoes com teto entre R$ 0,61 e
//      R$ 1,45 (medido no banco em 08/08). O maior faria passar preco que estoura o teto real.
//   4. AS COPIAS DAS FUNCOES DE DOSE NAO PODEM DIVERGIR do fpmed_licitacoes.html.
//
//   node tests/testa_teto_cmed.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const M = require(path.join(raiz, 'fpmed_teto_cmed.js'));
const licit = fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const motor = fs.readFileSync(path.join(raiz, 'fpmed_teto_cmed.js'), 'utf8').replace(/\r\n/g, '\n');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_teto_cmed — o motor do teto legal\n');

// ── indice de mentira, com dado no formato REAL do banco ──
const IDX = M.indexar({
  regua: [
    { ggrem:'1010203040506', ean1:'7891234567890', subst_norm:'METILPREDNISOLONA',
      apresentacao:'CX 1 FA VD TRANS X 2 ML', pf_unit: 22.25, pmvg_unit: 17.46, cap: true },
    { ggrem:'2020304050607', ean1:'7899999999999', subst_norm:'DIPIRONA',
      apresentacao:'CX 200 CPR', pf_unit: 0.90, pmvg_unit: null, cap: false },
  ],
  teto: [
    { subst_norm:'DIPIRONA', dose_key:'1000MG', apresentacoes: 31, teto_min: 0.6137, teto_max: 1.4460, tem_cap: false },
    { subst_norm:'ONDANSETRONA', dose_key:'2MG', apresentacoes: 5, teto_min: 1.10, teto_max: 3.00, tem_cap: true },
  ],
  dicionario: [ { marca_norm:'NOVALGINA', substancia:'DIPIRONA' } ],
});

// ══════════ 1. A REGRA QUE MANDA: NAO ENCONTRADO != OK ══════════
{
  const r = M.avaliar({ descricao:'PARAFUSO SEXTAVADO 10MM', precoUnit: 3, unitario:true }, IDX);
  ok('1. *** item que nao casa volta `nao_encontrado` ***', r.situacao === 'nao_encontrado', r.situacao);
  ok('2. ...e NAO traz teto nem folga (nada pra tela pintar de verde)',
    r.teto === null && r.folgaRS === null && r.pctAcima === null);
  const res = M.resumir([r, { situacao:'abaixo' }, { situacao:'acima' }, { situacao:'abaixo' }]);
  ok('3. *** o resumo conta nao-encontrado SEPARADO do ok ***',
    res.ok === 2 && res.acima === 1 && res.naoEncontrados === 1, res);
  ok('4. ...e o total fecha', res.total === 4);
}

// ══════════ 2. PRECO DE CAIXA NAO ENTRA ══════════
{
  const semDeclarar = M.avaliar({ descricao:'DIPIRONA 1000MG', precoUnit: 120 }, IDX);
  ok('5. *** sem declarar `unitario`, nao compara: volta `sem_preco` ***',
    semDeclarar.situacao === 'sem_preco', semDeclarar.situacao);
  ok('6. ...mas o TETO foi achado (a tela pode mostrar o teto e pedir o preco certo)',
    semDeclarar.teto === 0.6137, semDeclarar.teto);
  ok('7. preco zero nao vira "dentro do teto"',
    M.avaliar({ descricao:'DIPIRONA 1000MG', precoUnit: 0, unitario:true }, IDX).situacao === 'sem_preco');
  ok('8. preco ausente idem',
    M.avaliar({ descricao:'DIPIRONA 1000MG', unitario:true }, IDX).situacao === 'sem_preco');
}

// ══════════ 3. ACIMA E ABAIXO, COM A CONTA CERTA ══════════
{
  const acima = M.avaliar({ descricao:'DIPIRONA 1000MG COMPRIMIDO', precoUnit: 1.00, unitario:true }, IDX);
  ok('9. *** preco acima do menor teto e ACUSADO ***', acima.situacao === 'acima', acima.situacao);
  // 1.00 vs 0.6137 -> 62.94% acima
  ok('10. ...com o % acima correto', Math.abs(acima.pctAcima - 62.94) < 0.05, acima.pctAcima);
  const abaixo = M.avaliar({ descricao:'DIPIRONA 1000MG COMPRIMIDO', precoUnit: 0.50, unitario:true }, IDX);
  ok('11. preco abaixo devolve a folga em R$', Math.abs(abaixo.folgaRS - 0.1137) < 0.0005, abaixo.folgaRS);
  ok('12. ...e a folga em %', Math.abs(abaixo.folgaPct - 18.53) < 0.05, abaixo.folgaPct);
  ok('13. preco EXATAMENTE no teto conta como dentro (o teto e o limite legal, nao o proibido)',
    M.avaliar({ descricao:'DIPIRONA 1000MG', precoUnit: 0.6137, unitario:true }, IDX).situacao === 'abaixo');
}

// ══════════ 4. A FAIXA: USA O MENOR ══════════
{
  const r = M.avaliar({ descricao:'DIPIRONA 1000MG', precoUnit: 1.00, unitario:true }, IDX);
  ok('14. *** o teto usado e o MENOR da faixa ***', r.teto === 0.6137, r.teto);
  ok('15. ...e a faixa inteira volta, pra quem quiser olhar', r.faixa[0] === 0.6137 && r.faixa[1] === 1.4460, r.faixa);
  ok('16. ...e quantas apresentacoes tem naquela chave', r.apresentacoes === 31, r.apresentacoes);
  // com o MAIOR teto (1.446) o preco de 1.00 passaria como "dentro" -- que e o erro que a regra evita
  ok('17. *** com o teto MAIOR o mesmo preco passaria: e por isso que se usa o menor ***',
    1.00 < 1.4460 && r.situacao === 'acima');
}

// ══════════ 5. QUAL TETO SE APLICA (PF x PMVG) ══════════
{
  const gov = M.avaliar({ descricao:'METILPREDNISOLONA', ggrem:'1010203040506', precoUnit: 20, unitario:true, paraGoverno:true }, IDX);
  ok('18. *** venda ao governo COM CAP usa o PMVG ***', gov.tipoTeto === 'PMVG' && gov.teto === 17.46, gov);
  ok('19. ...e 20,00 contra teto 17,46 e ACIMA', gov.situacao === 'acima');
  const priv = M.avaliar({ descricao:'METILPREDNISOLONA', ggrem:'1010203040506', precoUnit: 20, unitario:true, paraGoverno:false }, IDX);
  ok('20. *** fora do governo usa o PF, e o MESMO preco fica dentro ***',
    priv.tipoTeto === 'PF' && priv.teto === 22.25 && priv.situacao === 'abaixo', priv.situacao);
  const semCap = M.avaliar({ descricao:'DIPIRONA', ggrem:'2020304050607', precoUnit: 0.5, unitario:true, paraGoverno:true }, IDX);
  ok('21. *** governo SEM CAP continua no PF (o desconto so e obrigatorio com CAP) ***',
    semCap.tipoTeto === 'PF' && semCap.teto === 0.90, semCap.tipoTeto);
  ok('22. o motor NAO adivinha se e governo: quem chama declara',
    M.avaliar({ descricao:'METILPREDNISOLONA', ggrem:'1010203040506', precoUnit: 20, unitario:true }, IDX).tipoTeto === 'PF');
}

// ══════════ 6. POR ONDE CASOU — a tela precisa saber a confianca ══════════
{
  ok('23. GGREM casa e diz que foi por GGREM',
    M.avaliar({ descricao:'x', ggrem:'1010203040506', precoUnit:1, unitario:true }, IDX).via === 'ggrem');
  ok('24. EAN casa e diz que foi por EAN',
    M.avaliar({ descricao:'x', ean:'7891234567890', precoUnit:1, unitario:true }, IDX).via === 'ean');
  ok('25. EAN com pontuacao tambem casa (o codigo vem sujo do leitor)',
    M.avaliar({ descricao:'x', ean:'789-1234.567890', precoUnit:1, unitario:true }, IDX).via === 'ean');
  ok('26. *** por nome+dose casa e DIZ que foi o caminho menos preciso ***',
    M.avaliar({ descricao:'DIPIRONA 1000MG', precoUnit:1, unitario:true }, IDX).via === 'pa+dose');
  ok('27. a marca vira principio ativo pelo dicionario da CMED',
    M.avaliar({ descricao:'NOVALGINA 1000MG CPR', precoUnit:1, unitario:true }, IDX).via === 'pa+dose');
  ok('28. GGREM tem prioridade sobre nome (o mais confiavel ganha)',
    M.avaliar({ descricao:'DIPIRONA 1000MG', ggrem:'1010203040506', precoUnit:1, unitario:true }, IDX).via === 'ggrem');
  ok('29. o resultado traz a evidencia do casamento (sem isso ninguem confere)',
    !!M.avaliar({ descricao:'DIPIRONA 1000MG', precoUnit:1, unitario:true }, IDX).evidencia);
}

// ══════════ 7. AS COPIAS NAO PODEM DIVERGIR DO LICITACOES ══════════
// A cópia nao e o problema; a copia SILENCIOSA e. Se alguem corrigir a dose num arquivo e
// esquecer do outro, o Conferidor e o Licitacoes passam a discordar sobre o mesmo produto.
{
  const corpo = (txt, nome) => {
    const i = txt.indexOf('function ' + nome + '(');
    if(i < 0) return null;
    let n = 0, j = txt.indexOf('{', i);
    for(let k = j; k < txt.length; k++){
      if(txt[k] === '{') n++;
      else if(txt[k] === '}'){ n--; if(!n) return txt.slice(i, k+1).replace(/\s+/g,' ').trim(); }
    }
    return null;
  };
  for(const fn of ['doses','concMags','forma']){
    const a = corpo(licit, fn), b = corpo(motor, fn);
    ok('30.`' + fn + '` e IDENTICA nos dois arquivos', a && b && a === b,
      a === b ? undefined : { licitacoes: (a||'').slice(0,90), motor: (b||'').slice(0,90) });
  }
  ok('31. semAcento tambem', licit.includes("const semAcento = s => { let o=''") && motor.includes("const semAcento = s => { let o=''"));
  ok('32. *** e o arquivo REGISTRA que a copia e vigiada (pra ninguem "limpar" o teste) ***',
    /a cópia\s+silenciosa é/.test(motor.replace(/\s+/g,' ')) || /A cópia não é o problema/.test(motor));
}

// ══════════ 8. O MOTOR E COMPARTILHADO DE VERDADE ══════════
ok('33. exporta pro navegador E pro node (as duas telas e o teste)',
  /raiz\.LimedtecTetoCMED = API/.test(motor) && /module\.exports = API/.test(motor));
ok('34. indexar declara o tamanho do que carregou (pra tela dizer "conferi contra N")',
  !!M.indexar({}).tamanho);
ok('35. indice vazio nao estoura: devolve nao_encontrado',
  M.avaliar({ descricao:'DIPIRONA 1000MG', precoUnit:1, unitario:true }, M.indexar({})).situacao === 'nao_encontrado');
ok('36. item nulo nao estoura', M.avaliar(null, IDX).situacao === 'nao_encontrado');

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
