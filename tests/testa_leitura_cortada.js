// SUITE testa_leitura_cortada — A IA CORTA O PEDIDO NO LIMITE DE TOKENS, E ISSO NAO PODE
// PASSAR CALADO.
//
// PORTADO DA GLOBAL (bloco 1 do sync de codigo, 10/08). Correcao PURA: nao muda o que a tela faz
// quando dá certo -- so acrescenta a recusa quando a resposta veio pela metade.
//
// O MODO DE FALHA E O PIOR POSSIVEL: a lista chega COMPLETA NA APARENCIA, com as ultimas linhas
// simplesmente ausentes, e o contador conta o que chegou sem saber o que faltou. Na Global isso
// aconteceu com dado real -- um pedido saiu com 77 de 91 itens sem ninguem perceber.
//
// >>> POR QUE E BLOQUEIO E NAO AVISO: com a leitura cortada, gerar proposta e gerar proposta
//     errada, e o operador nao tem como saber o que ficou de fora olhando a tela.
//
//   node tests/testa_leitura_cortada.js
'use strict';
const fs = require('fs'), path = require('path');
const G = fs.readFileSync(path.join(__dirname, '..', 'fpmed_giovana.html'), 'utf8').replace(/\r\n/g, '\n');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_leitura_cortada — resposta da IA cortada nunca passa calada\n');

// ══════════ 1. AS DUAS LEITURAS ESTAO COBERTAS ══════════
// A giovana chama a IA em DOIS lugares (a leitura simples de foto/PDF e o leitor estruturado).
// Cobrir so um deixaria o buraco aberto no outro -- e o segundo e o mais traicoeiro, porque
// JSON truncado costuma AINDA PARECER JSON depois do conserto de chaves.
const chamadas = (G.match(/functions\/v1\/ler-pedido/g) || []).length;
ok('1. a tela chama a IA em 2 lugares (se virar 3, este teste avisa)', chamadas === 2, chamadas);
const travas = (G.match(/stop_reason === 'max_tokens'/g) || []).length;
ok('2. *** as DUAS leituras conferem o stop_reason ***', travas === 2, travas);

// ══════════ 2. E BLOQUEIO, NAO AVISO ══════════
ok('3. *** as duas dizem "NAO USE ESTE RESULTADO" ***',
  (G.match(/Não use este resultado/g) || []).length === 2);
ok('4. *** e as duas PARAM ali (return), em vez de seguir com a lista pela metade ***',
  /LEITURA CORTADA[\s\S]{0,700}?btn\.disabled = false;[\s\S]{0,60}?return;/.test(G));
ok('5. a leitura simples ainda ESCONDE o resultado parcial da tela',
  /getElementById\('ia-resultado'\)\.style\.display = 'none';/.test(G));
ok('6. ...e diz quantas linhas chegaram (o numero e a evidencia de que faltou)',
  /Chegaram ' \+ _n \+ ' linha\(s\), mas o pedido tem <b>MAIS<\/b>/.test(G));
ok('7. e as duas mandam dividir o pedido — a saida, nao so o problema',
  (G.match(/Divida o pedido em partes/g) || []).length === 2);

// ══════════ 3. A RAZAO FICA ESCRITA ══════════
// Sem isto, a proxima pessoa le um `if` que "nunca dispara" e o apaga.
ok('8. *** o codigo registra que a lista chega COMPLETA NA APARENCIA ***',
  /COMPLETA NA APARÊNCIA/.test(G));
ok('9. ...e o caso real que motivou (77 de 91 itens, sem ninguem perceber)',
  /77 de 91 itens sem\s*\n?\s*ninguém perceber/.test(G) || /77 de 91 itens/.test(G));
ok('10. ...e por que e BLOQUEIO e nao aviso',
  /gerar proposta é gerar proposta\s*\n?\s*errada/.test(G));
ok('11. e que veio PORTADO da Global (rastro do sync, pra nao reportar como achado novo)',
  /PORTADO DA GLOBAL/.test(G) && /portada da Global/.test(G));

// ══════════ 4. O QUE NAO PODE TER MUDADO ══════════
// Correcao pura: o caminho feliz continua igual.
ok('12. o erro da API continua sendo mostrado como erro real (nao vira "nenhum produto")',
  /Não mascarar erro da API como "nenhum produto"/.test(G));
ok('13. "nenhum produto encontrado" continua existindo, separado da leitura cortada',
  /NENHUM_PRODUTO_ENCONTRADO/.test(G));
ok('14. o caminho feliz da leitura simples continua abrindo o resultado',
  /Lista extraída! Revise e clique em Buscar/.test(G));
ok('15. o modelo continua sendo o haiku (decisao de custo de 22/07)',
  /claude-haiku-4-5/.test(G));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
