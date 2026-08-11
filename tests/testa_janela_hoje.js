// SUITE testa_janela_hoje — o intervalo do Encontrar abre em HOJE, e no fim de semana pega a
// sexta junto.
//
// ══ O QUE MUDOU, E POR QUE A REGRA ANTIGA TINHA RAZAO ATE NAO TER MAIS ══════════════════════
// Ate 11/08 a tela abria no ULTIMO DIA UTIL — num dia 11 ela mostrava 10. A razao era boa: a
// publicacao do dia corrente so entra ao longo do dia, e abrir em "hoje" deixava a tela vazia as
// 7h da manha.
// >>> O QUE DERRUBOU A REGRA foi o preco dela: quem abre a tela quer o que saiu HOJE, e quem nao
//     repara na data acha que esta vendo o dia e esta vendo ontem. Tela vazia de manha e honesta;
//     tela cheia de ontem parecendo hoje, nao.
// >>> E o problema que ela resolvia ja tem outra solucao no ar: o carimbo "indice completo ate
//     DD/MM" diz exatamente ate onde a coleta chegou.
//
// A FUNCAO E TESTADA NOS 7 DIAS, e nao no dia em que a suite roda — senao ela so provaria o
// comportamento de terca-feira, e o caso que importa (sabado e domingo) nunca seria exercitado.
//
//   node tests/testa_janela_hoje.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const L = R('fpmed_licitacoes.html');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_janela_hoje — o Encontrar abre em hoje\n');

// ── A FUNCAO REAL, extraida do HTML (nao recopiada) ────────────────────────────────────────
// Recopiar a funcao aqui provaria que a MINHA copia funciona, que nao interessa a ninguem.
const iso = d => d.toISOString().slice(0, 10);
const bloco = (() => {
  const i = L.indexOf('function janelaPadrao()');
  if (i < 0) return '';
  const j = L.indexOf('\n}', i);
  return j < 0 ? '' : L.slice(i, j + 2);
})();
ok('1. *** a funcao `janelaPadrao` existe e foi extraida do arquivo ***', bloco.length > 80);
const janelaPadrao = new Function('iso', 'Date', bloco + '; return janelaPadrao;')(iso, Date);

// ── OS 7 DIAS ───────────────────────────────────────────────────────────────────────────────
// Fixo um relogio por dia da semana e pergunto o que a funcao devolve. 2026-08-10 e uma
// SEGUNDA — dai a semana inteira sai somando dias.
const REAL = Date;
function comDia(iso8601, fn) {
  const fixo = new REAL(iso8601 + 'T10:00:00-03:00');
  class D extends REAL { constructor(...a) { if (!a.length) return new REAL(fixo); return new REAL(...a); } }
  D.now = () => fixo.getTime();
  const jp = new Function('iso', 'Date', bloco + '; return janelaPadrao;')(iso, D);
  return fn(jp());
}
const DIAS = [
  ['2026-08-10', 'segunda', 'hoje'],
  ['2026-08-11', 'terca',   'hoje'],
  ['2026-08-12', 'quarta',  'hoje'],
  ['2026-08-13', 'quinta',  'hoje'],
  ['2026-08-14', 'sexta',   'hoje'],
  ['2026-08-15', 'sabado',  'sexta-hoje'],
  ['2026-08-16', 'domingo', 'sexta-hoje'],
];
console.log('  o que a funcao devolve em cada dia da semana:');
DIAS.forEach(([dia, nome, esperado]) => {
  const j = comDia(dia, x => x);
  const eh = (j.de === j.ate) ? 'hoje' : 'sexta-hoje';
  console.log(`    ${nome.padEnd(8)} ${dia} -> ${j.de} .. ${j.ate}   (${eh})`);
  ok(`2.${nome} · ${nome} devolve "${esperado}"`, eh === esperado, { de: j.de, ate: j.ate });
  if (esperado === 'hoje') ok(`3.${nome} · e as duas pontas sao o proprio dia`, j.de === dia && j.ate === dia, j);
  else {
    ok(`3.${nome} · a ponta final e HOJE`, j.ate === dia, j);
    ok(`4.${nome} · e a inicial e a SEXTA anterior (14/08)`, j.de === '2026-08-14', j);
  }
});

// ══════════ 2. NUNCA EM CACHE ══════════
ok('5. *** a data e calculada na ABERTURA, e nao guardada ***',
  /\(function\(\)\{\s*const j = janelaPadrao\(\);/.test(L));
ok('6. ...e o motivo esta escrito (data em cache = valor certo de ontem servido hoje)',
  /Data em cache é o mesmo\s*defeito da versão velha do app/.test(uc(L)));
ok('7. *** nao sobrou nenhum uso do `ultimoDiaUtil` ***', !/ultimoDiaUtil/.test(L));

// ══════════ 3. O QUE A REGRA ANTIGA RESOLVIA ══════════
ok('8. *** o motivo da regra antiga esta registrado (nao foi apagado como se fosse besteira) ***',
  /A razão original era\s*defensável/.test(uc(L)));
ok('9. *** e o que derrubou ela tambem ***',
  /tela cheia de ontem parecendo hoje, não/.test(uc(L)));
ok('10. ...e onde o problema dela foi resolvido melhor',
  /o carimbo "índice completo até DD\/MM"/.test(uc(L)));
ok('11. *** o fim de semana e excecao com motivo, e nao capricho ***',
  /sábado e domingo não têm publicação/.test(uc(L))
  && /seria garantir tela vazia por natureza/.test(uc(L)));

// ══════════ 4. OS JORNAIS NAO QUEBRAM ══════════
ok('12. *** jornal com janela MOVEL passa a abrir em hoje, sem mexer em jornal salvo ***',
  /if\(!f \|\| !f\.janela \|\| f\.janela\.tipo === 'movel'\) return janelaPadrao\(\);/.test(L));
ok('13. ...com o motivo escrito', /sem ninguém precisar mexer em jornal salvo nenhum/.test(uc(L)));
ok('14. *** jornal com janela FIXA continua fixo ***',
  /return \{de: f\.janela\.de\|\|'', ate: f\.janela\.ate\|\|f\.janela\.de\|\|''\};/.test(L));
ok('15. *** a deteccao de "movel" compara as DUAS pontas (o padrao virou intervalo) ***',
  /const movel = \(de === pad\.de && ate === pad\.ate\);/.test(L));
ok('16. *** e o rotulo do jornal diz a DATA, e nao o nome da regra ***',
  /'📅 ' \+ \(j\.de === j\.ate \? 'hoje' : br\(j\.de\)\+'–'\+br\(j\.ate\)\) \+ ' \(move sozinho\)'/.test(L));
ok('17. ...com o motivo (o operador quer saber a data que vai abrir)',
  /o operador quer saber a DATA que vai abrir/.test(uc(L)));

// ══════════ 5. O BOLETIM NAO FOI TOCADO ══════════
// Pedido explicito: la o D-1 fechado e regra de ouro e continua.
const Y = R('.github', 'workflows', 'boletim-diario.yml');
ok('18. *** o boletim continua no D-1 fechado ***', /ESPERAR O DIA FECHAR/.test(Y));
ok('19. ...e nada de `janelaPadrao` foi parar nele', !/janelaPadrao/.test(Y));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
