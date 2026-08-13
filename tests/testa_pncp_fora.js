// SUITE testa_pncp_fora — PNCP FORA DO AR COM RESULTADO NA TELA E CONTRATEMPO, NAO FALHA.
//
// URGENCIA de 10/08: o Natanael digitou um termo no Encontrar e levou o painel VERMELHO
// "Nao consegui falar com o PNCP", com o nosso indice tendo resultado logo acima. A experiencia
// virou "sistema quebrado" num momento em que o sistema tinha a resposta na mao.
//
// FORAM TRES DEFEITOS, e o do meio e o que ninguem tinha visto:
//   1. A COLETA estava parada: 12 rodadas agendadas, 12 falhas, porque o secret COLETA_TOKEN
//      nunca foi configurado no GitHub. O indice congelou em 06/08 (decisao do Lemuel, nao
//      corrigivel daqui — mas e a causa de o banco nao ter o dia de hoje).
//   2. *** O TERMO DIGITADO NUNCA CHEGAVA AO BANCO. *** O `buscarNoBanco` filtra por data + UF
//      + modalidade; a palavra-chave so era aplicada DEPOIS, no navegador. Com o indice parado
//      em 06/08 e a data padrao sendo o ultimo dia util, o banco devolvia ZERO e a tela caia no
//      PNCP ao vivo — que estava fora. O termo dele nunca foi perguntado a quem tinha resposta.
//   3. O TOM: painel vermelho de erro fatal mesmo havendo resultado.
//
//   node tests/testa_pncp_fora.js
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_pncp_fora — o indice na frente, e o vermelho no lugar certo\n');

// ══════════ 1. BANCO PRIMEIRO, DE VERDADE ══════════
ok('1. *** existe a busca no indice INTEIRO, sem janela de data ***',
  /async function buscarNoBancoAmplo\(uf, mod\)/.test(src));
ok('2. *** ela e acionada quando a janela vem vazia E ha termo digitado ***',
  /if\(\(!doBanco \|\| !doBanco\.length\) && kws\.length\)\{[\s\S]{0,200}buscarNoBancoAmplo/.test(src));
ok('3. ...e a tela DIZ que ampliou a janela (senao o operador acha que aquilo e do dia)',
  /fora da janela de datas/.test(src) && /nada publicado no período escolhido/.test(src));
ok('4. *** a busca ampla NAO manda o termo pro banco (evita 2o filtro de palavra) ***',
  !/buscarNoBancoAmplo[\s\S]{0,600}objeto=ilike/.test(src));
ok('5. ...e a razao esta escrita: o filtro do banco erra em acento', /"FARMACÊUTICO"/.test(src));
ok('6. *** o banco e consultado ATE no "Atualizar agora" (vira rede de seguranca) ***',
  /doBanco = await buscarNoBanco\(uf, mod, de, ate\);/.test(src)
  && !/if\(!aoVivo\)\{[\s\S]{0,120}doBanco = await buscarNoBanco/.test(src));
ok('7. ...com a razao: pedir dado fresco nao pode custar o dado que ja se tinha',
  /não pode custar o dado que já se\s+tinha/.test(src.replace(/\s+/g,' ')) || /não pode custar o dado/.test(src));

// ══════════ 2. O TOM ══════════
ok('8. *** existe a faixa DISCRETA pro PNCP fora do ar ***', /function avisoBrandoPNCP\(quando, emDiaAte\)/.test(src));
ok('9. ...com o texto que o Lemuel pediu', /O portal do governo \(PNCP\) não respondeu agora/.test(src));
ok('10. ...dizendo de quando e o indice mostrado', /Mostrando o nosso índice/.test(src) && /atualizado em/.test(src));
ok('11. ...e oferecendo a acao', /Tentar o PNCP de novo/.test(src) && /onclick="atualizarAgora\(\)"/.test(src));
ok('12. *** com resultado na tela, NAO pinta o painel vermelho ***',
  /if\(doBanco && doBanco\.length\)\{[\s\S]{0,200}avisoBrandoPNCP\(quando, emDiaAte\);\s*return;/.test(src));
ok('13. ...e o cache tambem cai na faixa discreta, nao no vermelho',
  /if\(emCache\)\{[\s\S]{0,240}avisoBrandoPNCP\(quando, emDiaAte\);\s*return;/.test(src));
ok('14. a faixa e visualmente contida (nao usa a classe de erro)',
  /\.aviso-brando\{/.test(src) && /faixa\.className = 'aviso-brando'/.test(src));
ok('15. *** e a razao esta escrita: pintar de vermelho um sistema que funciona ensina a desconfiar dele ***',
  /ensina o operador a desconfiar dele/.test(src));

// ══════════ 3. AS DUAS CAUSAS SEPARADAS NA MENSAGEM ══════════
ok('16. *** o vermelho so aparece quando nao ha NADA a mostrar ***',
  /Sem resultado por dois motivos ao mesmo tempo/.test(src));
ok('17. *** e separa "PNCP fora" de "nada no nosso indice" ***',
  /O portal do governo \(PNCP\) não respondeu:/.test(src) && /E o nosso índice não tem nada/.test(src));
ok('18. ...dizendo PARA QUE TERMO o indice nao tem nada', /para <b>' \+ esc\(kws\.join\(' \/ '\)\)/.test(src));
ok('19. *** e denuncia quando a coleta NUNCA rodou (a causa-raiz de hoje) ***',
  /a coleta nunca rodou com sucesso/.test(src));
ok('20. a razao de separar esta escrita: a acao e diferente',
  /"espera o portal voltar" não é "procura outro termo"/.test(src));

// ══════════ 4. NADA REGREDIU ══════════
ok('21. o carimbo de procedencia continua dizendo de quando e o dado',
  /coletados em \$\{quando\.toLocaleDateString/.test(src));
/* REAPONTADO em 13/08 (item 7f): o ⚠️ virou <use> do sprite. O aviso continua inteiro — o que
   saiu foi o emoji, e o assert cobrava justamente ele. */
ok('22. e continua avisando quando a ultima coleta falhou', /a última coleta falhou/.test(src));
ok('23. a busca ampla respeita UF e modalidade escolhidas',
  /if \(uf\)  q \+= `&uf=eq\.\$\{encodeURIComponent\(uf\)\}`/.test(src)
  && /if \(mod\) q \+= `&modalidade_cod=eq\./.test(src));
ok('24. ...e tem timeout, como toda chamada de rede desta tela', /setTimeout\(\(\)=>ctrl\.abort\(\), TIMEOUT_MS\)/.test(src));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
