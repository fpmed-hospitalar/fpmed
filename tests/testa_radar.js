// SUITE testa_radar — "0 LICITACOES" NAO PODE SER LIDO COMO "NAO TEM LICITACAO AQUI".
//
// Modulo 2.5 da spec, 08/08/2026. Segunda metade do item 4 (a base geografica ja estava no ar).
//
// A PERGUNTA QUE O RADAR RESPONDE E LOGISTICA, nao juridica: vale a viagem? da pra entregar? o
// frete come a margem? Por isso o resultado sai ordenado por DISTANCIA e nao por valor -- uma
// licitacao de R$ 2 mi a 600 km pode valer menos que uma de R$ 80 mil a 40 km.
//
// O QUE ESTA SUITE PROTEGE:
//   1. A FRASE QUE NAO PODE FALTAR: a contagem e do NOSSO indice, nao do Brasil. Sem ela,
//      "0 licitacoes" se le como "nao ha licitacao nessa regiao" quando a verdade pode ser
//      "ainda nao coletamos" -- e alguem deixa de olhar uma regiao inteira por causa disso.
//   2. CAIXA E QUADRADO, RAIO E CIRCULO. Filtrar so pela caixa entregaria cidade a 1,41x o raio
//      pedido (a diagonal do quadrado). O refino por distancia e obrigatorio.
//   3. CIDADE SEM COORDENADA E DECLARADA, nao posicionada no chute.
//   4. LICITACAO ENCERRADA NAO E OPORTUNIDADE: sai da conta.
//
//   node tests/testa_radar.js
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');

// a funcao REAL de distancia, rodada contra pares de coordenadas conhecidos
const distanciaKm = new Function(
  src.slice(src.indexOf('const RAIO_TERRA_KM'), src.indexOf('let RD_REF')) + '; return distanciaKm;')();

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_radar — distancia certa, e a contagem dizendo de onde vem\n');

// ══════════ 1. A DISTANCIA, CONTRA PARES REAIS ══════════
{
  const APG = [-16.810013, -49.261084];   // Aparecida de Goiania (centroide, da nossa base)
  const GYN = [-16.66, -49.30];           // Goiania
  const BSB = [-15.79, -47.88];           // Brasilia
  const SP  = [-23.55, -46.63];           // Sao Paulo

  const d1 = distanciaKm(APG[0], APG[1], GYN[0], GYN[1]);
  ok('1. Aparecida de Goiania -> Goiania ~18 km', d1 > 12 && d1 < 25, d1.toFixed(1));
  const d2 = distanciaKm(APG[0], APG[1], BSB[0], BSB[1]);
  ok('2. Aparecida -> Brasilia ~190 km', d2 > 165 && d2 < 215, d2.toFixed(1));
  const d3 = distanciaKm(GYN[0], GYN[1], SP[0], SP[1]);
  ok('3. Goiania -> Sao Paulo ~810 km', d3 > 750 && d3 < 880, d3.toFixed(1));
  ok('4. mesmo ponto = 0 km', distanciaKm(APG[0], APG[1], APG[0], APG[1]) < 0.001);
  // acos fora de [-1,1] por erro de ponto flutuante devolveria NaN e sumiria com a cidade
  ok('5. *** ponto identico nao vira NaN (o acos e travado em [-1,1]) ***',
    !isNaN(distanciaKm(-16.81, -49.26, -16.81, -49.26)));
  ok('6. a distancia e simetrica', Math.abs(distanciaKm(APG[0],APG[1],SP[0],SP[1]) - distanciaKm(SP[0],SP[1],APG[0],APG[1])) < 0.001);
}

// ══════════ 2. CAIXA x CIRCULO ══════════
ok('7. *** pede a CAIXA ao banco (nao baixa os 5.570 pontos) ***',
  /lat=gte\.\$\{\(RD_REF\.lat-dLat\)/.test(src) && /lon=gte\.\$\{\(RD_REF\.lon-dLon\)/.test(src));
ok('8. a longitude encolhe com o cosseno da latitude (senao a caixa fica torta longe do equador)',
  /Math\.cos\(RD_REF\.lat \* Math\.PI\/180\)/.test(src));
ok('9. *** e REFINA por distancia depois: caixa e quadrado, raio e circulo ***',
  /\.filter\(m => m\.km <= raio\)/.test(src));
ok('10. ...com a razao escrita (o canto do quadrado entregaria 1,41x o raio)',
  /1,41× o raio pedido/.test(src));
ok('11. o cosseno tem piso (perto do polo o divisor iria a zero)', /Math\.max\(0\.2, Math\.cos/.test(src));

// ══════════ 3. A FRASE QUE NAO PODE FALTAR ══════════
ok('12. *** a tela diz que a contagem e do NOSSO indice, nao do Brasil ***',
  /A contagem é do <b>nosso índice<\/b>/.test(src));
ok('13. *** e diz o que "0" pode significar ***',
  /pode significar “ainda não coletamos”/.test(src));
ok('14. ...e informa quantas licitacoes o indice tem, pra dimensionar', /\$\{lics\.length\} licitação\(ões\) coletadas/.test(src));
ok('15. avisa que a distancia e entre CENTROIDES (nao entre sedes)', /entre os <b>centroides<\/b>/.test(src));

// ══════════ 4. AS RECUSAS ══════════
ok('16. *** cidade sem coordenada e DECLARADA, nao posicionada no chute ***',
  /ainda não tem coordenada na base do IBGE/.test(src));
ok('17. *** licitacao ENCERRADA sai da conta (nao e oportunidade) ***',
  /if\(fim && fim < agora\) return false;/.test(src));
ok('18. sem cidade de referencia nao varre nada', /escolha a cidade de referência na lista/.test(src));
ok('19. erro de leitura vira aviso, nao lista vazia', /catch\(e\)\{[\s\S]{0,200}aviso err/.test(src));

// ══════════ 5. O DESENHO ══════════
ok('20. *** ordena por DISTANCIA, nao por valor (a pergunta e logistica) ***',
  /comLic = dentro\.filter\(m => m\.lic > 0\)\.sort\(\(a,b\) => a\.km - b\.km\)/.test(src));
ok('21. cidade sem licitacao aparece separada, no fim (mas aparece)',
  /cidade\(s\) no raio sem licitação no nosso índice/.test(src));
ok('22. o autocomplete pergunta ao banco por prefixo (nao baixa a lista inteira)',
  /nome_norm=like\.\$\{encodeURIComponent\(q\+'%'\)\}/.test(src) && /limit=12/.test(src));
ok('23. ...e espera o operador parar de digitar', /_rdTimer = setTimeout/.test(src));
ok('24. comeca na cidade da propria empresa (e de la que a entrega sai)',
  /LIMEDTEC_CLIENTE.*\.empresa[\s\S]{0,160}emp\.cidade/.test(src));
ok('25. o Radar entrou nos links do Encontrar (e ferramenta de busca, nao 6a aba)',
  /onclick="abrirRadar\(\)"/.test(src) && /<div id="radar">/.test(src));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
