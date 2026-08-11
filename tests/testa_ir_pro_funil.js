// SUITE testa_ir_pro_funil — do cartao da LISTA para a coluna dele nos QUADROS.
//
// A lista responde "o que eu tenho"; o funil responde "em que pe esta". Quem via um negocio na
// lista e queria o segundo trocava de visao e CACAVA o card entre as colunas — e o titulo do
// card e curto, entao cacar com o olho e justamente o que da errado.
//
// O QUE ESTA SUITE PROTEGE (as duas armadilhas do botao):
//   1. O FILTRO DE FASE ESCONDERIA O ALVO. Com uma etiqueta de fase ligada, mandar ir pro funil
//      de um negocio de OUTRA fase levaria a uma tela sem o card — e o botao pareceria quebrado.
//      Ele solta o filtro E AVISA que soltou.
//   2. O FILTRO DE EMPRESA **NAO** e mexido: ele responde "de quem e este funil". Trazer negocio
//      de outra empresa seria responder outra pergunta. Ai a tela avisa e NAO vai.
//
//   node tests/testa_ir_pro_funil.js
'use strict';
const fs = require('fs'), path = require('path');
const N = fs.readFileSync(path.join(__dirname, '..', 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_ir_pro_funil — o botao que leva o card ate a coluna dele\n');

// ══════════ 1. O BOTAO ══════════
ok('1. *** existe o botao "ir pro funil" ***', /irProFunil\(\$\{n\.id\}\)/.test(N) && /ir pro funil<\/button>/.test(N));
ok('2. ...no MESMO bloco de acoes do "arquivar" (mesmo estilo, nada inventado)',
  /<div class="acoes">[\s\S]{0,260}irProFunil[\s\S]{0,400}arquivar\(/.test(N));
ok('3. ...e como <button>, igual ao arquivar (nao um link ou icone novo)',
  /<button onclick="event\.stopPropagation\(\);irProFunil/.test(N));
ok('4. o clique NAO abre a ficha junto (stopPropagation, como o arquivar)',
  /event\.stopPropagation\(\);irProFunil/.test(N));
ok('5. *** NAO aparece dentro dos Quadros — o card ja esta no funil la ***',
  /\$\{noKanban \? '' : `<button onclick="event\.stopPropagation\(\);irProFunil/.test(N));

// A agenda usa a MESMA funcao card(), sem o segundo argumento — entao o botao vai junto sem
// codigo novo. Se um dia a agenda passar a montar card proprio, este assert cai.
ok('6. *** a agenda usa o mesmo card(), entao ganha o botao tambem ***',
  /class="ag-hora">\$\{horaDe\(n\.abertura\)\|\|'--:--'\}<\/div>\$\{card\(n\)\}/.test(N));
ok('7. e o kanban chama card(n,true) — e por isso que la nao tem botao', /card\(n,true\)/.test(N));

// ══════════ 2. A TROCA DE VISAO E O DESTAQUE ══════════
ok('8. *** o botao troca pra visao QUADROS ***', /setVis\('quadros'\);\s*\/\/ pinta\(\)/.test(N));
ok('9. *** o destaque SOBREVIVE a troca de visao ***',
  // marca antes de trocar; quem acende e a pintura dos Quadros
  /_destaque = id;\s*\n\s*setVis\('quadros'\)/.test(N)
  && /corpo\.innerHTML = kanban\(l\); ligarArrasto\(\); aplicarDestaque\(\);/.test(N));
ok('10. o card e encontrado pelo id que o proprio kanban ja escreve',
  /data-id="\$\{n\.id\}"/.test(N) && /querySelector\('\.card\[data-id="' \+ _destaque/.test(N));
ok('11. *** rola ate o card (achar com o olho comeca por ele estar na tela) ***',
  /scrollIntoView\(\{ behavior:'smooth', block:'center'/.test(N));
ok('12. *** e o realce e TEMPORARIO ***', /setTimeout\(\(\) => alvo\.classList\.remove\('achado'\), 4000\)/.test(N));
ok('13. ...com o motivo escrito (marca que fica vira sujeira que ninguem sabe tirar)',
  /vira sujeira que ninguém sabe como tirar/.test(N));
ok('14. o realce acende UMA vez: repintar depois nao reacende',
  /_destaque = null;\s+\/\/ uma vez só: repintar depois não reacende/.test(N));
ok('15. existe a classe .achado e ela PULSA (movimento e o que o olho acha)',
  /\.card\.achado\{/.test(N) && /@keyframes achei/.test(N));
ok('16. ...e respeita quem pediu menos animacao no sistema',
  /prefers-reduced-motion: reduce\)\{ \.card\.achado\{animation:none\} \}/.test(N));

// ══════════ 3. OS FILTROS ══════════
ok('17. *** filtro de FASE que esconderia o alvo e SOLTO ***',
  /if\(FASE_SEL && FASE_SEL !== n\.estagio\)\{ FASE_SEL = null; soltouFase = true; \}/.test(N));
ok('18. ...e a tela DIZ que soltou (mudanca silenciosa de filtro e pior que filtro nenhum)',
  /Tirei o filtro de fase para mostrar este negócio na coluna dele/.test(N));
ok('19. *** filtro de EMPRESA NAO e mexido: a tela avisa e NAO vai ***',
  /Este negócio é de outra empresa[\s\S]{0,120}Troque para "Todas as empresas"/.test(N)
  && /return;\s*\n\s*\}\s*\n\s*let soltouFase/.test(N));
// (o comentario quebra linha no arquivo; normaliza antes de olhar)
ok('20. ...com o motivo (o filtro de empresa responde "de quem e este funil")',
  /ele responde "de quem é este funil"/.test(N.replace(/\s*\n\s*/g, ' ')));
ok('21. negocio ARQUIVADO nao aparece no kanban — o botao reabre o filtro pra ele existir la',
  /if\(n\.arquivado\) document\.getElementById\('f-arquivados'\)\.checked = true;/.test(N));
ok('22. o aviso some sozinho (explicacao de um clique, nao estado do sistema)',
  /if\(d\.parentNode\) d\.parentNode\.removeChild\(d\); \}, 6000\)/.test(N));
ok('23. negocio que nao existe mais nao estoura', /const n = NEG\.find\(x => x\.id === id\);\s*\n\s*if\(!n\) return;/.test(N));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
