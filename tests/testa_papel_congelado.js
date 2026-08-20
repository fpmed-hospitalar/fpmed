// SUITE testa_papel_congelado — A REGUA SABE QUE O PAPEL ESTA CONGELADO (fatia A37 · 20/08/2026)
//
// == O IMPASSE QUE ESTA SUITE FECHA ============================================================
// A Giovana ficou parada em 2 catracas vermelhas, 1 assert cada, e as duas caem sobre O PAPEL —
// congelado por ordem do dono desde a B8 e comparado byte a byte pela prova. Nenhuma das duas
// podia ficar verde por trabalho nenhum: consertar a linha REPROVA a prova do papel.
//
// >>> VERMELHO QUE MISTURA VERDADEIRO COM FALSO ENSINA TODO MUNDO A IGNORAR VERMELHO. A frase e
//     do proprio trabalhador B, que ja pagou por ela. Manter esse vermelho e ensinar a casa a
//     ignorar a catraca — que e a coisa mais cara que uma catraca pode fazer.
//
// O defeito nao estava na tela do B nem no papel do dono: estava NA REGUA, que media como se
// tudo fosse tela quando uma parte daquele arquivo esta sob ordem de congelamento.
//
// == E ISTO NAO E ABRIR EXCECAO PARA ESCONDER DIVIDA ===========================================
// A divida continua contada em voz alta, numa linha propria, com arquivo, linha e regiao de cada
// achado. E a mesma lei que ja vale para o documento gerado em janela nova, para o `:root` da
// ilha de tema e para a citacao em prosa: NAO SE EXCLUI, SEPARA-SE.
//
//   node tests/testa_papel_congelado.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const R = require('../tools/regua_visual.js');
const P = require('../tools/prova_papel_congelado.js');
const srcRegua = fs.readFileSync(path.join(raiz, 'tools', 'regua_visual.js'), 'utf8');
const srcCatraca = fs.readFileSync(path.join(raiz, 'tests', 'catraca.js'), 'utf8');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_papel_congelado — cada achado na coluna certa\n');

// ══════════ 1. UMA FONTE DE VERDADE SO ══════════
{
  ok('1. a regua IMPORTA as regioes da prova do papel (nao copia uma lista)',
    /require\(['"]\.\/prova_papel_congelado\.js['"]\)/.test(srcRegua));
  /* `//ignore` aparece na PROSA da regua, citado como o que esta decisao NAO e — cobrar a mencao
     seria o defeito 14 da propria regua de volta (instrumento que confunde o registro com o
     registrado). O que se procura e a DIRETIVA: um `// ignore` abrindo a linha. */
  ok('2. *** e NAO ha lista de excecao escrita a mao na regua (arquivo:linha chumbado) ***',
    !/fpmed_giovana\.html\s*:\s*\d+/.test(srcRegua) && !/^\s*\/\/\s*ignore/im.test(srcRegua));
  ok('3. o nome do arquivo isento tambem vem da prova, e nao de uma segunda constante',
    /PAPEL\.ALVO/.test(srcRegua) && !/const\s+\w+\s*=\s*['"]fpmed_giovana\.html['"]/.test(srcRegua));
  ok('4. a prova pode ser importada sem rodar o git nem ler o disco',
    typeof P.confereImpressao === 'function' && typeof P.congelaLinha === 'function'
    && typeof P.recorta === 'function' && P.ALVO === 'fpmed_giovana.html');
}

// ══════════ 2. A ISENCAO E ANCORADA NO HASH, NAO NA LINHA ══════════
{
  const txt = R.leia(P.ALVO);
  const conf = P.confereImpressao(txt);
  ok('5. *** as regioes declaradas BATEM com o arquivo de verdade — a isencao esta autorizada ***',
    conf.divergentes.length === 0, conf.divergentes.map(d => d.nome + ': ' + d.porque));
  ok('6. toda regiao declarada foi ACHADA (ancora quebrada nao e "igual")',
    conf.regioes.every(r => r.achou), conf.regioes.filter(r => !r.achou).map(r => r.nome));
  ok('7. toda regiao achada tem impressao digital declarada — nada isenta sem hash',
    conf.regioes.every(r => !!P.IMPRESSAO_DIGITAL[r.nome]));

  // ── a suspensao: regiao divergente NAO isenta ninguem ──
  const umaRegiao = conf.regioes[0];
  const linhaDentro = umaRegiao.linhaIni + 1;
  ok('8. linha DENTRO de regiao conferida e isentada, com o nome da regiao',
    P.congelaLinha(conf, linhaDentro) === umaRegiao.nome, P.congelaLinha(conf, linhaDentro));
  ok('9. linha FORA de toda regiao NAO e isentada — a isencao e estreita',
    P.congelaLinha(conf, 1) === null && P.congelaLinha(conf, umaRegiao.linhaIni - 1) === null);

  const suspensa = { regioes: conf.regioes, divergentes: [{ nome: umaRegiao.nome }] };
  ok('10. *** regiao com hash DIVERGENTE nao isenta mais nada — a porta dos fundos fica fechada ***',
    P.congelaLinha(suspensa, linhaDentro) === null);

  /* E o hash muda com UM byte trocado, senao a ancora nao ancora nada. O alvo e procurado DENTRO
     do `gerarPDF` de proposito: `font-size:10px` aparece antes, no CSS de impressao, e um
     `replace` nu trocaria a PRIMEIRA ocorrencia — o assert passaria falando de outra regiao. */
  const ondeGera = txt.indexOf('function gerarPDF()');
  const alvo = txt.indexOf('font-size:10px', ondeGera);
  const mexido = txt.slice(0, alvo) + 'font-size:10.0px' + txt.slice(alvo + 'font-size:10px'.length);
  const depois = P.confereImpressao(mexido);
  ok('11. *** um byte trocado dentro do papel faz a conferencia DIVERGIR ***',
    ondeGera > 0 && alvo > ondeGera && depois.divergentes.length === 1
    && /gerarPDF/.test(depois.divergentes[0].nome),
    depois.divergentes.map(d => d.nome));
  ok('12. ...e a divergencia diz o hash de antes e o de depois, nao so "mudou"',
    /chars [0-9a-f]{16} -> \d+ chars [0-9a-f]{16}/.test(depois.divergentes[0].porque),
    depois.divergentes[0].porque);
}

// ══════════ 3. O ACHADO NAO SOME — ELE MUDA DE COLUNA ══════════
{
  const r = R.mede(P.ALVO);
  ok('13. o retrato traz a coluna do papel congelado', !!r.congelado && r.congelado.alvo === true);
  ok('14. *** os 2 achados que travavam a Giovana estao NA COLUNA, com linha e regiao ***',
    r.congelado.achados.length === 2
    && r.congelado.achados.every(a => a.linha > 0 && a.regiao && a.oQue),
    r.congelado.achados.map(a => a.linha + ' ' + a.oQue + ' [' + a.regiao + ']'));
  ok('15. um deles e o texto abaixo do piso dentro do gerarPDF',
    r.congelado.achados.some(a => a.medida === 'texto' && /gerarPDF/.test(a.regiao)));
  ok('16. o outro e o pictograma do aviso legal impresso',
    r.congelado.achados.some(a => a.medida === 'icones' && /OBS_PADRAO/.test(a.regiao)));
  ok('17. *** e as contagens da tela ficaram ZERADAS: o vermelho impossivel acabou ***',
    r.texto.tela.length === 0 && r.icones.pictograma.length === 0,
    { piso: r.texto.tela.length, picto: r.icones.pictograma.length });

  /* Par de contraste que PASSOU nao e achado, e chama-lo de achado inflaria a divida com coisa
     que nunca foi defeito — a regua mentindo para o lado feio, que tambem e mentir. */
  ok('18. par de contraste congelado sai em `contados`, e NAO na lista de achados',
    Array.isArray(r.congelado.contados)
    && r.congelado.achados.every(a => a.campo !== 'pares' && a.campo !== 'naoTexto'));

  // ── a isencao vale so para o arquivo da prova ──
  const outra = R.mede('fpmed_licitacoes.html');
  ok('19. *** tela que nao e o papel NAO ganha isencao nenhuma ***',
    outra.congelado.alvo === false && outra.congelado.achados.length === 0);
}

// ══════════ 4. A CATRACA DIZ EM VOZ ALTA, E GRITA QUANDO PRECISA ══════════
{
  ok('20. a catraca imprime a linha do papel congelado com o numero e a fonte',
    /achado\(s\) dentro do papel congelado por ordem do dono/.test(srcCatraca)
    && /tools\/prova_papel_congelado\.js/.test(srcCatraca));
  ok('21. ...com arquivo, linha e regiao de cada achado (endereco que o editor abre)',
    /c\.arquivo \+ ':' \+ a\.linha/.test(srcCatraca));
  ok('22. *** hash que nao bate vira FALHA de verdade — a catraca PARA E GRITA ***',
    /r\.congelado\.divergentes\.length/.test(srcCatraca) && /f\+\+/.test(srcCatraca)
    && /O PAPEL CONGELADO MUDOU/.test(srcCatraca));
  ok('23. ...e ela diz como consertar, se a mudanca tiver sido ordem do dono',
    /--impressao/.test(srcCatraca));
}

// ══════════ 5. SE O DONO DESCONGELAR, O VERMELHO VOLTA SOZINHO ══════════
{
  /* Nada de lista manual para alguem lembrar de limpar depois: a isencao E as regioes. Tirar a
     regiao da prova apaga a isencao no mesmo ato — e e isso que este assert mede, sem tocar em
     arquivo nenhum: com a lista de regioes vazia, nada e isentado. */
  const vazia = { regioes: [], divergentes: [] };
  ok('24. *** sem regiao declarada, NADA e isentado — descongelar devolve o vermelho sozinho ***',
    P.congelaLinha(vazia, 4232) === null && P.congelaLinha(vazia, 1270) === null);
  ok('25. e a regua deriva a isencao das regioes, sem guardar estado proprio',
    /PAPEL\.congelaLinha/.test(srcRegua) && !/const ISENTOS|const EXCECOES/.test(srcRegua));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
