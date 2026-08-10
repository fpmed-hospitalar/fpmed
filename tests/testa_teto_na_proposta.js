// SUITE testa_teto_na_proposta — CONFERIR DEPOIS DE MANDAR A PROPOSTA E CONFERIR TARDE.
//
// Integracao do motor do teto no gerador de proposta (fpmed_giovana.html), 08/08/2026.
// Fecha o item 5: o Conferidor confere a proposta PRONTA; aqui a mesma conta entra no instante
// em que o preco e DECIDIDO.
//
// O QUE ESTA SUITE PROTEGE:
//   1. E O MESMO MOTOR, nao uma segunda conta. Duas implementacoes de "meu preco x teto"
//      acabariam discordando, e a que discorda na hora da proposta e a que custa caro.
//   2. FALHA AO LER A CMED NAO VIRA "ESTA TUDO DENTRO DO TETO". Sem indice, a tela nao afirma
//      nada sobre teto -- que e diferente de afirmar que esta ok.
//   3. NAO BLOQUEIA, AVISA. Travar o campo transformaria um aviso correto num impedimento
//      errado (a tela tambem monta proposta pra hospital privado).
//   4. O SELO ACOMPANHA O PRECO DIGITADO. Vermelho que fica na tela depois de resolvido ensina
//      todo mundo a ignorar vermelho.
//
//   node tests/testa_teto_na_proposta.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const g = fs.readFileSync(path.join(raiz, 'fpmed_giovana.html'), 'utf8').replace(/\r\n/g, '\n');
const conf = fs.readFileSync(path.join(raiz, 'fpmed_conferidor.html'), 'utf8').replace(/\r\n/g, '\n');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_teto_na_proposta — o teto onde o preco e decidido\n');

// ══════════ 1. O MESMO MOTOR NAS DUAS TELAS ══════════
ok('1. *** a proposta carrega o motor compartilhado ***', /<script src="fpmed_teto_cmed\.js"><\/script>/.test(g));
ok('2. *** e o Conferidor carrega o MESMO arquivo ***', /<script src="fpmed_teto_cmed\.js"><\/script>/.test(conf));
ok('3. a proposta chama `avaliar` do motor, nao uma conta propria',
  /window\.LimedtecTetoCMED\.avaliar\(/.test(g));
ok('4. ...e nao ha conta de teto reimplementada na proposta',
  !/pctAcima\s*=/.test(g) && !/folgaPct\s*=/.test(g));
ok('5. usa a MESMA view do banco que o Conferidor', /cmed_teto\?select=/.test(g) && /cmed_teto\?select=/.test(conf));

// ══════════ 2. FALHA NAO VIRA APROVACAO ══════════
ok('6. *** sem indice, `avaliarTeto` devolve null (nao "ok") ***',
  /if\(!_tetoIdx \|\| !window\.LimedtecTetoCMED\) return null;/.test(g));
ok('7. *** e o selo de null e VAZIO, nunca um verde ***', /if\(!r\) return '';/.test(g));
ok('8. item que nao casou tambem vira null (nao_encontrado nao e aprovacao)',
  /\(r\.situacao === 'acima' \|\| r\.situacao === 'abaixo'\) \? r : null/.test(g));
ok('9. *** a falha de leitura da CMED e registrada, e a razao esta escrita ***',
  /NÃO PODE VIRAR "ESTÁ TUDO DENTRO DO TETO"/.test(g) && /console\.warn\('teto CMED indisponível/.test(g));

// ══════════ 3. AVISA, NAO BLOQUEIA ══════════
ok('10. *** a razao de nao bloquear esta escrita no codigo ***',
  /NÃO BLOQUEIA, AVISA/.test(g) && /impedimento errado/.test(g));
ok('11. o campo de preco continua editavel (nenhum disabled foi introduzido)',
  /oninput="setPrecoEdit\('\$\{c\.id\}',this\.value\)"/.test(g));
ok('12. o alerta explica a consequencia (pode ser desclassificada), nao so a cor',
  /pode ser desclassificada/.test(g));

// ══════════ 4. O SELO ACOMPANHA O PRECO ══════════
ok('13. *** editar o preco repinta o selo na hora ***',
  /const bt = document\.getElementById\('teto-badge-'\+id\);/.test(g));
ok('14. ...com a razao escrita (vermelho que nao apaga ensina a ignorar vermelho)',
  /aprende a ignorá-lo/.test(g));
ok('15. o selo existe por item, com id proprio', /id="teto-badge-\$\{c\.id\}"/.test(g));
ok('16. e fica COLADO no preco e no MKP (aviso longe da decisao nao muda decisao)',
  /margem-badge-\$\{c\.id\}[\s\S]{0,600}teto-badge-\$\{c\.id\}/.test(g));

// ══════════ 5. CARGA E VISIBILIDADE ══════════
ok('17. a CMED e carregada na PRIMEIRA vez que entra item, nao no boot',
  /function addItem\(c\) \{[\s\S]{0,450}carregarTetoCMED\(\)/.test(g)
  && !/DOMContentLoaded[\s\S]{0,200}carregarTetoCMED/.test(g));
ok('18. ...e ao chegar repinta os itens que ja estavam', /then\(idx => \{ if\(idx\) repintarTetos\(\); \}\)/.test(g));
ok('19. carga unica: a segunda chamada reusa a promessa em voo',
  /if\(_tetoCarregando\) return _tetoCarregando;/.test(g));
ok('20. pagina em 1000 (o PostgREST daqui corta em 1000)', /off > 30000/.test(g) && /limit=1000/.test(g));
ok('21. *** o teto aparece TAMBEM pro vendedor restrito (teto e lei, nao intel de custo) ***',
  // o badge de MKP tem gate `ehRestrito()`; o de teto NAO pode ter
  !/ehRestrito\(\)\?''\:`<span id="teto-badge/.test(g) && /<span id="teto-badge-\$\{c\.id\}">/.test(g));
ok('22. ...e a razao esta escrita', /o teto é lei, não é intel de\s+custo/.test(g.replace(/\s+/g,' ')) || /teto é lei/.test(g));
ok('23. o selo nao sai no PDF do cliente (e ferramenta interna de decisao)',
  /@media print\{ \.teto-badge\{display:none !important\} \}/.test(g));
ok('24. a proposta e tratada como venda ao governo (e o caso da licitacao)',
  /paraGoverno: true/.test(g));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
