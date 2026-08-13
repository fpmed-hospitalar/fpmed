// SUITE testa_grifo — o grifo do termo buscado no cartao de resultado (item 7, fatia 3b).
//
// == POR QUE ESTE GRIFO MERECE SUITE PROPRIA ===================================================
// Ele faz a UNICA coisa desta tela que mistura texto de terceiro com HTML nosso: pega o objeto
// do edital — que vem do PNCP, escrito por quem quiser — e insere uma tag no meio dele. Errar a
// ordem de "escapar" e "marcar" produz um dos dois defeitos, e os dois sao ruins de achar:
//
//   escapar DEPOIS de marcar .... o proprio <mark> vira &lt;mark&gt; e aparece escrito na tela;
//   nao escapar ................. objeto com "<" vira HTML dentro da nossa pagina.
//
// E ele tem uma DEPENDENCIA INVISIVEL: o indice e calculado no texto sem acento e aplicado no
// texto original. Isso so funciona porque `semAcento` troca letra por letra e PRESERVA O
// COMPRIMENTO. No dia em que ele passar a remover caractere, as posicoes deslizam e o grifo
// marca a palavra errada — sem erro nenhum no console. O ultimo assert guarda exatamente isso.
//
//   node tests/testa_grifo.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const { semAcento } = require(path.join(raiz, 'fpmed_teto_cmed.js'));

function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora nao encontrada: ' + ini);
  return src.slice(s, e);
}

// O termo buscado vem do campo #f-kw. Aqui o documento e de mentira e o campo e um objeto —
// a funcao le do mesmo jeito que le na tela.
function comTermo(termo) {
  const doc = { getElementById: id => (id === 'f-kw' ? { value: termo } : null) };
  const fn = new Function('document', 'semAcento',
    bloco('const esc = s =>', 'const { semAcento, doses') + 'return grifa;');
  return fn(doc, semAcento);
}

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? '  [' + JSON.stringify(got) + ']' : '')); } };
console.log('SUITE testa_grifo — o termo buscado marcado no objeto do edital\n');
let n = 1;

// ── 1. o basico: marca o que casou, e so ─────────────────────────────────────
const g = comTermo('albumina');
ok(n + '. marca o termo no meio do objeto',
  g('Aquisicao de albumina humana 20%') === 'Aquisicao de <mark>albumina</mark> humana 20%',
  g('Aquisicao de albumina humana 20%')); n++;
ok(n + '. marca TODAS as ocorrencias, nao so a primeira',
  (g('albumina e mais albumina').match(/<mark>/g) || []).length === 2, g('albumina e mais albumina')); n++;
ok(n + '. objeto sem o termo volta intacto, sem marca nenhuma',
  g('Aquisicao de seringas') === 'Aquisicao de seringas'); n++;
ok(n + '. objeto vazio nao quebra', g('') === '' && g(null) === ''); n++;

// ── 2. ACENTO — o caso que mais importa neste ramo ───────────────────────────
// "farmaceutico" digitado tem que achar "FARMACÊUTICO" escrito. Sem isso o grifo falta
// justamente nas palavras do ramo, que sao as acentuadas.
const gf = comTermo('farmaceutico');
ok(n + '. termo SEM acento acha a palavra COM acento',
  gf('Servico FARMACÊUTICO hospitalar').includes('<mark>FARMACÊUTICO</mark>'),
  gf('Servico FARMACÊUTICO hospitalar')); n++;
ok(n + '. e o texto marcado sai com o acento ORIGINAL, nao o normalizado',
  !gf('Servico FARMACÊUTICO hospitalar').includes('FARMACEUTICO')); n++;
ok(n + '. maiuscula e minuscula nao importam',
  comTermo('ALBUMINA')('de albumina humana').includes('<mark>albumina</mark>')); n++;

// ── 3. SEGURANCA — texto de terceiro entrando na pagina ──────────────────────
// O objeto vem do PNCP. Este bloco e o que impede a tela de executar o que vier de la.
const gs = comTermo('teste');
ok(n + '. objeto com HTML e ESCAPADO (nao vira tag na pagina)',
  gs('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;',
  gs('<script>alert(1)</script>')); n++;
ok(n + '. e continua escapado MESMO quando ha grifo no mesmo texto',
  gs('<b>teste</b>') === '&lt;b&gt;<mark>teste</mark>&lt;/b&gt;', gs('<b>teste</b>')); n++;
ok(n + '. aspas do objeto nao escapam do atributo',
  gs('diz "teste" aqui').includes('&quot;'), gs('diz "teste" aqui')); n++;
// A ordem errada (marcar antes de escapar) produziria a tag ESCRITA na tela. Este assert
// morre se alguem inverter os dois passos.
ok(n + '. a marca sai como TAG de verdade, e nao escrita na tela',
  gs('teste').includes('<mark>') && !gs('teste').includes('&lt;mark&gt;')); n++;

// ── 4. o que NAO se grifa ────────────────────────────────────────────────────
ok(n + '. termo vazio nao grifa nada', comTermo('')('albumina humana') === 'albumina humana'); n++;
ok(n + '. termo de 1 letra nao grifa (grifar todo "a" do paragrafo e ruido)',
  comTermo('a')('albumina humana') === 'albumina humana'); n++;
ok(n + '. so espacos nao grifa', comTermo('   ')('albumina') === 'albumina'); n++;
ok(n + '. dentro de um termo de varias palavras, a de 1 letra e ignorada e as outras valem',
  comTermo('a albumina')('de albumina humana').includes('<mark>albumina</mark>')
  && (comTermo('a albumina')('de albumina humana').match(/<mark>/g) || []).length === 1,
  comTermo('a albumina')('de albumina humana')); n++;

// ── 5. VARIAS PALAVRAS e a sobreposicao ──────────────────────────────────────
const g2 = comTermo('albumina humana');
ok(n + '. cada palavra do termo e procurada por si',
  (g2('albumina (humana) 20%').match(/<mark>/g) || []).length === 2, g2('albumina (humana) 20%')); n++;
// Duas palavras coladas gerariam <mark> dentro de <mark> se as faixas nao fossem fundidas —
// e HTML aninhado assim quebra o estilo de um jeito que so aparece com dado real.
ok(n + '. faixas coladas sao FUNDIDAS, sem <mark> dentro de <mark>',
  !/<mark>[^<]*<mark>/.test(g2('albumina humana 20%')), g2('albumina humana 20%')); n++;
ok(n + '. e o texto continua inteiro depois da fusao',
  g2('albumina humana 20%').replace(/<\/?mark>/g, '') === 'albumina humana 20%'); n++;
// A promessa geral: grifar NUNCA muda o texto, so o embrulho.
ok(n + '. em qualquer caso, tirar as marcas devolve o objeto escapado original',
  ['albumina humana 20%', 'nada aqui', '<b>albumina</b>', 'ALBUMINA e albumina']
    .every(t => g2(t).replace(/<\/?mark>/g, '') === t.replace(/[<>&"]/g,
      c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])))); n++;

// ── 6. A DEPENDENCIA INVISIVEL ───────────────────────────────────────────────
// O indice sai do texto sem acento e e aplicado no original. Se `semAcento` deixar de
// preservar o comprimento, as posicoes deslizam e o grifo marca no lugar errado — calado.
ok(n + '. semAcento PRESERVA O COMPRIMENTO (a premissa do grifo por indice)',
  ['FARMACÊUTICO', 'ação', 'São Paulo', 'coração/ãõçéíú']
    .every(t => semAcento(t).length === t.length),
  ['FARMACÊUTICO', 'ação', 'São Paulo', 'coração/ãõçéíú'].map(t => t + ' -> ' + semAcento(t).length + '/' + t.length)); n++;
// E se um dia ela nao preservar, o grifo tem que DESISTIR em vez de marcar errado.
ok(n + '. e o codigo tem a saida de emergencia escrita, pro dia em que ela nao preservar',
  /chave\.length !== cru\.length/.test(src)); n++;

// ── 7. o pior dado real (D12) ────────────────────────────────────────────────
const enorme = 'Registro de precos para eventual aquisicao de albumina humana 20% '.repeat(12);
ok(n + '. objeto de ' + enorme.length + ' caracteres nao quebra e grifa todas as ocorrencias',
  (g2(enorme).match(/<mark>/g) || []).length === 24, (g2(enorme).match(/<mark>/g) || []).length); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
