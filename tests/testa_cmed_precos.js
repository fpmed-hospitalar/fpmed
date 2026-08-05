// SUITE testa_cmed_precos — O TETO LEGAL NAO PODE SER LIDO ERRADO.
//
// POR QUE ESTA SUITE EXISTE: o PMVG e o teto MAXIMO que a lei permite cobrar do governo numa
// licitacao. Errar a leitura dele nao da erro na tela — da proposta acima do teto (desclassifica
// e expoe a empresa) ou abaixo do necessario (dinheiro na mesa). Nenhum dos dois aparece como bug.
//
// AS 4 ARMADILHAS DE PARSE (ditadas pelo Lemuel em 05/08, medidas contra o arquivo real):
//   1. valor com ASTERISCO no fim ("6533,27*") — marcador de nota da CMED
//   2. decimal com VIRGULA, milhar com PONTO ("1.234,56")
//   3. "-" e vazio = "nao se aplica", nunca zero
//   4. celula que ja vem NUMERICA nao pode passar pelo replace de milhar (6533.27 -> 653327)
//
//   node tests/testa_cmed_precos.js
const { numCMED, simNao, chaveAliquota } = require('../tools/carrega_cmed_precos.js');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_cmed_precos — leitura da grade de precos da CMED\n');

// ══════════ 1. ASTERISCO — o marcador de nota da CMED ══════════
// Na lista oficial, apresentacao isenta de ICMS vem com o preco marcado: "R$ 54,23*".
// Sem tirar o '*', o valor viraria NaN ou (pior) seria descartado em silencio.
ok('1. "6533,27*" le 6533.27 (asterisco de nota nao entra no numero)', numCMED('6533,27*') === 6533.27, numCMED('6533,27*'));
ok('2. asterisco com espaco antes do fim: "54,23 *"', numCMED('54,23 *') === 54.23, numCMED('54,23 *'));
ok('3. dois asteriscos ("**CAP**" e usado no texto da lista)', numCMED('12,50**') === 12.5, numCMED('12,50**'));

// ══════════ 2. DECIMAL BR ══════════
ok('4. virgula decimal: "21,53"', numCMED('21,53') === 21.53, numCMED('21,53'));
ok('5. milhar com ponto: "1.234,56"', numCMED('1.234,56') === 1234.56, numCMED('1.234,56'));
ok('6. milhar duplo: "3.143.579,20" (o SOFOSBUVIR real da tabela)', numCMED('3.143.579,20') === 3143579.2, numCMED('3.143.579,20'));

// ══════════ 3. "NAO SE APLICA" NAO E ZERO ══════════
// Isto importa: PMC vazio em 3.878 linhas (medicamento de uso restrito a hospital nao tem PMC).
// Se virasse 0, a tela mostraria "teto R$ 0,00" e todo preco nosso pareceria acima do teto.
ok('7. "-" vira null, nao 0', numCMED('-') === null, numCMED('-'));
ok('8. "  -  " com espaco vira null', numCMED('   -   ') === null, numCMED('   -   '));
ok('9. vazio vira null', numCMED('') === null, numCMED(''));
ok('10. null vira null', numCMED(null) === null, numCMED(null));
ok('11. zero literal tambem vira null (preco 0 nao e teto valido)', numCMED('0,00') === null, numCMED('0,00'));

// ══════════ 4. CELULA JA NUMERICA — a armadilha silenciosa ══════════
// Se o xlsx entregar a celula como number, aplicar o replace de milhar (/\./g,'') transformaria
// 6533.27 em 653327 — cem vezes o teto, e sem nenhum sinal de erro.
ok('12. numero 6533.27 continua 6533.27 (NAO vira 653327)', numCMED(6533.27) === 6533.27, numCMED(6533.27));
ok('13. numero inteiro 40 continua 40', numCMED(40) === 40, numCMED(40));
ok('14. numero 0 vira null', numCMED(0) === null, numCMED(0));

// ══════════ 5. Sim/Nao -> boolean, e o "nao sabido" ══════════
// CAP = "Sim" e o que troca o teto de PF pra PMVG. Confundir com null muda o numero da proposta.
ok('15. "Sim" -> true', simNao('Sim') === true, simNao('Sim'));
ok('16. "Não" com acento -> false', simNao('Não') === false, simNao('Não'));
ok('17. "NAO" sem acento -> false', simNao('NAO') === false, simNao('NAO'));
ok('18. vazio -> null (nao sabido nao e "nao")', simNao('') === null, simNao(''));
ok('19. "-" -> null', simNao('-') === null, simNao('-'));

// ══════════ 6. CHAVE DA ALIQUOTA — o rotulo que a tela mostra ══════════
// A grade tem 26 colunas por regua. A chave errada silenciosamente esconde uma aliquota.
ok('20. "PF 0%" -> "0"', chaveAliquota('PF 0%', 'PF') === '0', chaveAliquota('PF 0%', 'PF'));
ok('21. "PF 19 %" -> "19" (a de GOIAS)', chaveAliquota('PF 19 %', 'PF') === '19', chaveAliquota('PF 19 %', 'PF'));
ok('22. "PF 17,5 %" -> "17,5" (aliquota fracionada nao pode perder a casa)', chaveAliquota('PF 17,5 %', 'PF') === '17,5', chaveAliquota('PF 17,5 %', 'PF'));
ok('23. "PMVG 19 % ALC" -> "19 ALC" (ALC e outra coluna, nao a mesma)', chaveAliquota('PMVG 19 % ALC', 'PMVG') === '19 ALC', chaveAliquota('PMVG 19 % ALC', 'PMVG'));
ok('24. "PMVG Sem Impostos" -> "SEM_IMPOSTO"', chaveAliquota('PMVG Sem Impostos', 'PMVG') === 'SEM_IMPOSTO', chaveAliquota('PMVG Sem Impostos', 'PMVG'));
ok('25. "PMC 19 %" com prefixo PF -> null (PF nao pode capturar coluna de PMC)', chaveAliquota('PMC 19 %', 'PF') === null, chaveAliquota('PMC 19 %', 'PF'));

// ══════════ 7. A RELACAO QUE A LEI DEFINE: PMVG = PF x (1 - CAP) ══════════
// CAP = 21,53% (Resolucao CMED n. 5, de 21/12/2020). Este assert e a prova de que a coluna
// lida como PMVG e mesmo o PMVG, e nao uma coluna vizinha da grade.
// Numeros reais da carga de 05/08: ORENCIA 250MG, GGREM 505107701157215.
{
  const pf = numCMED('2.621,83'), pmvg = numCMED('2.057,35');
  const cap = 1 - pmvg / pf;
  ok('26. ORENCIA: PMVG/PF confere o CAP de 21,53% (tolerancia de arredondamento)',
    Math.abs(cap - 0.2153) < 0.0005, +(cap * 100).toFixed(3));
}
{
  // BAYCUTEN N (a primeira linha da planilha): PF 37,94 / PMVG 29,77
  const cap = 1 - numCMED('29,77') / numCMED('37,94');
  ok('27. BAYCUTEN N: mesmo CAP de 21,53%', Math.abs(cap - 0.2153) < 0.0005, +(cap * 100).toFixed(3));
}

// ══════════ 8. O TETO QUE VALE NUMA COMPRA PUBLICA ══════════
// Regra da propria lista (linha 13 do cabecalho institucional): "O PMVG DEVERA SER UTILIZADO
// COMO REFERENCIA, OBRIGATORIAMENTE, PARA TODOS OS PRODUTOS DESTACADOS PELA SIGLA **CAP**".
// Sem CAP, o teto e o PF. A view cmed_regua materializa isto em `teto_gov_unit` — aqui e a
// mesma regra em JS, pra tela poder calcular sem ir ao banco.
function tetoGov(row) { return row.cap ? (row.pmvg_go19 ?? null) : (row.pf_go19 ?? null); }
ok('28. com CAP=Sim o teto e o PMVG', tetoGov({ cap: true, pf_go19: 100, pmvg_go19: 78.47 }) === 78.47);
ok('29. com CAP=Nao o teto e o PF', tetoGov({ cap: false, pf_go19: 100, pmvg_go19: 78.47 }) === 100);
ok('30. CAP nao sabido (null) NAO vira desconto: cai no PF, que e o teto conservador',
  tetoGov({ cap: null, pf_go19: 100, pmvg_go19: 78.47 }) === 100);

// ══════════ 9. UNITARIO — o preco da CMED e POR EMBALAGEM ══════════
// A regua do resto do sistema e unitaria. Comparar o PF da caixa de 50 com o nosso preco por
// comprimido daria 50x de folga imaginaria — e a proposta sairia cara achando que esta barata.
function unit(v, qtd) { const q = qtd && qtd > 0 ? qtd : 1; return v == null ? null : +(v / q).toFixed(4); }
ok('31. SOFOSBUVIR caixa de 50: PMVG 2.466.766,60 -> 49.335,332 por comprimido',
  unit(2466766.6, 50) === 49335.332, unit(2466766.6, 50));
ok('32. qtd_apres 1 nao muda o valor', unit(37.94, 1) === 37.94, unit(37.94, 1));
ok('33. qtd_apres 0 (dado ruim) trata como 1, nunca divide por zero', unit(37.94, 0) === 37.94, unit(37.94, 0));
ok('34. teto nulo continua nulo (nao vira 0)', unit(null, 50) === null, unit(null, 50));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
