// SUITE testa_telemetria_adotada — A TELEMETRIA NAS QUATRO TELAS DO B, E A REGRA DE PRIVACIDADE.
//
// POR QUE ELA EXISTE, e por que ela nasce ANTES do arquivo que ela guarda:
// a fatia B26 manda adotar o `fpmed_telemetria.js` nas quatro telas do B (Negocios, Proposta,
// Ajuda, Documentos). O arquivo e do A (fatia A35 da caixa dele) e NAO EXISTE ainda. A caixa do B
// diz, com estas palavras: "Nao escreva o trecho de novo. Uma fonte de verdade. Se o arquivo ainda
// nao existir quando voce chegar aqui, NAO IMPROVISE".
//
// Entao esta suite nao improvisa o trecho. Ela guarda as TRES coisas que ja da pra guardar hoje,
// e que continuam valendo depois:
//
//   1. UMA FONTE DE VERDADE — nenhuma tela do B pode ter o trecho do PostHog ou do Sentry
//      chumbado dentro dela. Trecho repetido em sete telas e sete lugares pra esquecer de
//      atualizar. Isto e verificavel HOJE e fica vermelho no dia em que alguem colar o trecho.
//
//   2. A ADOCAO NAO PODE SER ESQUECIDA — no dia em que o `fpmed_telemetria.js` aparecer na raiz,
//      esta suite passa a EXIGIR que as quatro telas o chamem, e fica vermelha ate elas chamarem.
//      Enquanto ele nao existe, ela IMPRIME a divida com o nome do arquivo que falta.
//      >>> Divida contada em voz alta e fila; divida escondida e mentira. A regra e da
//          tests/telas_adotadas.json, e vale aqui igual.
//
//   3. CONTEUDO NUNCA VAI EM EVENTO — a REGRA DE PRIVACIDADE do docs/TELEMETRIA.md diz que evento
//      e sobre COMPORTAMENTO, nao sobre CONTEUDO ("filtrou por UF" e evento bom; "filtrou por
//      UF=GO, produto=dipirona, empresa=X" e vazamento com nome de metrica). As telas do B sao
//      justamente as que tem dado de cliente: proposta, documento anexado, CNPJ.
//      >>> E AQUI ESTA O CUIDADO QUE ESTA SUITE TOMA CONSIGO MESMA: hoje as quatro telas tem ZERO
//          chamada de telemetria, entao um assert que so varresse as telas ficaria VERDE SEM
//          OLHAR NADA — e assert cego e pior que assert vermelho, que e a lei desta casa. Por isso
//          o detector e provado nas DUAS DIRECOES contra trechos de mentira (bloco 4) antes de
//          ser apontado para as telas de verdade (bloco 3).
//
//   node tests/testa_telemetria_adotada.js
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_telemetria_adotada — a telemetria nas 4 telas do B, e a privacidade\n');

const TELAS_DO_B = ['fpmed_negocios.html', 'fpmed_giovana.html', 'fpmed_ajuda.html', 'fpmed_documentos.html'];
const ARQUIVO_UNICO = 'fpmed_telemetria.js';

const lido = {};
TELAS_DO_B.forEach(t => { lido[t] = fs.readFileSync(path.join(raiz, t), 'utf8'); });

// O comentario e prosa, nao codigo — e prosa que EXPLICA a regra citando o que ela proibe nao pode
// reprovar. Foi o defeito que eu achei quatro vezes na regua do A (B22) e uma vez na minha propria
// mutacao (B25): instrumento que confunde o registro com o registrado cobra mais de quem explica
// mais, e numa casa onde o porque escrito e lei isso ensina a parar de escrever o porque.
const semComentario = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ══════════ 1. UMA FONTE DE VERDADE: o trecho nao pode estar chumbado na tela ══════════
// A chave e casada por PADRAO (`phc_` + 20+), nao pelo literal: assim ela pega tambem o dia em
// que alguem colar a chave de OUTRO projeto do PostHog, e esta suite nao vira mais um lugar onde
// a chave do projeto esta escrita.
{
  const CHUMBADO = [
    ['a chave de projeto do PostHog', /phc_[A-Za-z0-9]{20,}/],
    ['o init do PostHog', /posthog\s*\.\s*init\s*\(/],
    ['o loader do Sentry', /sentry-cdn\.com/i],
    ['o DSN do Sentry', /ingest\.[a-z]{2}\.sentry\.io/i],
  ];
  let n = 1;
  CHUMBADO.forEach(([nome, re]) => {
    const culpadas = TELAS_DO_B.filter(t => re.test(semComentario(lido[t])));
    ok(n + '. *** ' + nome + ' NAO esta chumbado em nenhuma tela do B ***', culpadas.length === 0, culpadas);
    n++;
  });
}

// ══════════ 2. A ADOCAO NAO PODE SER ESQUECIDA ══════════
// Duas metades de uma mesma catraca. Enquanto o arquivo nao existe ela cobra o que EXISTE hoje
// (a fila escrita em voz alta). No minuto em que ele aparecer, ela cobra a adocao — e o vermelho
// chega sozinho, sem ninguem precisar lembrar que a espera acabou.
{
  const existe = fs.existsSync(path.join(raiz, ARQUIVO_UNICO));
  if (existe) {
    /* >>> LE A TELA SEM COMENTARIO, e isto foi o tools/muta_telemetria_b26.js que me ensinou.
           A primeira versao lia o arquivo cru, e a mutacao "alguem COMENTA a linha por um minuto"
           ESCAPOU: um `<!-- <script src=...> -->` casava com a busca e contava como adocao. E
           comentar a linha nao e hipotese de laboratorio — e o jeito nº 1 de uma etiqueta sumir
           de verdade, porque quem comenta pretende descomentar. */
    const semChamar = TELAS_DO_B.filter(t =>
      !new RegExp('<script[^>]+src\\s*=\\s*["\'][^"\']*' + ARQUIVO_UNICO.replace('.', '\\.')).test(semComentario(lido[t])));
    ok('5. *** o ' + ARQUIVO_UNICO + ' existe, e as 4 telas do B o chamam ***', semChamar.length === 0, semChamar);
  } else {
    ok('5. o ' + ARQUIVO_UNICO + ' ainda NAO existe na raiz — a fatia B26 segue na fila', true);
    console.log('       >>> DIVIDA EM VOZ ALTA: falta o ' + ARQUIVO_UNICO + ' (fatia A35, do A).');
    console.log('           No dia em que ele nascer, este assert 5 vira EXIGENCIA e fica vermelho');
    console.log('           ate as 4 telas do B o chamarem: ' + TELAS_DO_B.join(' · '));
  }
}

// ══════════ 3+4. CONTEUDO NUNCA VAI EM EVENTO ══════════
// O detector: acha as chamadas de captura e olha SO os argumentos delas. O que reprova e ler dado
// da tela ali dentro — `.value` de um campo, o texto de um no, o innerHTML. Nome de evento e
// numero podem; conteudo digitado por gente, nao.
// >>> O NOME DO GLOBAL E `FPMED_TELEMETRIA`, e ele esta escrito aqui porque eu ERREI ele.
//     A primeira versao deste detector dizia `LIMEDTEC_TELEMETRIA` — eu escrevi a suite antes de
//     o arquivo do A existir e chutei o nome pelo prefixo das outras bibliotecas da casa
//     (limedtec-menu, limedtec-tema). As quatro mutacoes de vazamento ESCAPARAM, e o bloco 4
//     continuou verde o tempo todo, porque as fixtures dele foram escritas pela mesma mao e com o
//     mesmo chute. Detector provado so contra exemplo que eu mesmo inventei herda o meu engano
//     inteiro — foi o tools/muta_telemetria_b26.js, apontado para as TELAS DE VERDADE, que viu.
//     Por isso o casamento e por sufixo (`*_TELEMETRIA.evento`): o dia em que o arquivo for
//     renomeado, o detector continua enxergando em vez de ficar cego em silencio.
function vazamentosEmEvento(js) {
  const achados = [];
  const CAPTURA = /(?:posthog\s*\.\s*capture|Sentry\s*\.\s*capture[A-Za-z]*|[A-Za-z_$][\w$]*TELEMETRIA\s*\.\s*evento)\s*\(/g;
  let m;
  while ((m = CAPTURA.exec(js)) !== null) {
    // recorta a chamada equilibrando parenteses — regex sozinha nao fecha chamada aninhada
    let i = m.index + m[0].length, nivel = 1;
    while (i < js.length && nivel > 0) {
      if (js[i] === '(') nivel++;
      else if (js[i] === ')') nivel--;
      i++;
    }
    const args = js.slice(m.index + m[0].length, i - 1);
    const LEITURA_DE_TELA = [/\.\s*value\b/, /\.\s*textContent\b/, /\.\s*innerText\b/, /\.\s*innerHTML\b/,
                             /getElementById\s*\(/, /querySelector(?:All)?\s*\(/, /\bFormData\b/];
    LEITURA_DE_TELA.forEach(re => { if (re.test(args)) achados.push({ chamada: m[0], trecho: args.slice(0, 60) }); });
  }
  return achados;
}

// ── 4. O DETECTOR PROVADO NAS DUAS DIRECOES, ANTES DE OLHAR AS TELAS ────────────────────────────
// Sem este bloco o assert 3 seria verde por nao haver o que olhar. Um detector nao provado que
// nao acha nada e indistinguivel de um detector quebrado que nunca acha nada.
{
  // As fixtures usam a FORMA REAL das minhas telas — `window.X && X.evento(...)` com o nome
  // FPMED_TELEMETRIA — e nao uma forma idealizada. Fixture que nao se parece com o codigo de
  // verdade e o jeito de um detector ficar verde sobre uma tela que ele nao consegue ler.
  const BOM = [
    "posthog.capture('busca_executada', { resultados: n, termo_generico: true })",
    "posthog.capture('resultado_zero', { origem: 'busca' })",
    "window.FPMED_TELEMETRIA && FPMED_TELEMETRIA.evento('adicionado_aos_negocios', { qtd: itens.length })",
  ];
  const RUIM = [
    "posthog.capture('busca_executada', { termo: document.getElementById('q').value })",
    "posthog.capture('proposta_gerada', { cliente: campoCliente.value })",
    "Sentry.captureMessage('erro', { extra: box.innerHTML })",
    "window.FPMED_TELEMETRIA && FPMED_TELEMETRIA.evento('doc_anexado', { nome: f.querySelector('#f-nome').textContent })",
  ];
  ok('6. o detector deixa passar evento que fala de COMPORTAMENTO (3 de 3)',
    BOM.every(s => vazamentosEmEvento(s).length === 0), BOM.filter(s => vazamentosEmEvento(s).length));
  ok('7. *** e barra evento que carrega CONTEUDO da tela (4 de 4) ***',
    RUIM.every(s => vazamentosEmEvento(s).length > 0), RUIM.filter(s => !vazamentosEmEvento(s).length));
  // o recorte por parenteses equilibrados importa: uma regex ganancia pegaria a linha inteira e
  // acusaria o `.value` de QUALQUER codigo que viesse depois da chamada.
  ok('8. ...e nao contamina o que vem DEPOIS da chamada (o recorte fecha no parentese certo)',
    vazamentosEmEvento("posthog.capture('ok', { n: 1 });\nconst t = campo.value;").length === 0);
  ok('9. ...nem o que vem ANTES dela',
    vazamentosEmEvento("const t = campo.value;\nposthog.capture('ok', { n: 1 });").length === 0);
}

// ── 3. APONTADO PARA AS QUATRO TELAS DE VERDADE ────────────────────────────────────────────────
{
  const sujas = [];
  TELAS_DO_B.forEach(t => { vazamentosEmEvento(semComentario(lido[t])).forEach(v => sujas.push(Object.assign({ tela: t }, v))); });
  ok('10. *** nenhuma tela do B manda CONTEUDO da tela dentro de um evento ***', sujas.length === 0, sujas.slice(0, 4));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
