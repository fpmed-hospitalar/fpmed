// SUITE testa_lembrete_sessao — O LEMBRETE DA ABERTURA NASCE SOZINHO E ACOMPANHA A DATA.
//
// O pedido: "todo negocio com data de abertura ganha o lembrete SOZINHO; se a abertura for
// editada (adiamento), o lembrete acompanha".
//
// >>> A DECISAO QUE FAZ ISSO FUNCIONAR: o lembrete da sessao e DERIVADO de `negocios.abertura`,
//     e NAO uma linha gravada em `lembretes`. Gravar faria o oposto do pedido — no dia do
//     adiamento haveria a data nova na ficha e a VELHA no lembrete, e alguem apareceria na
//     sessao errada. E e a regra que o projeto ja tinha escrito: o sino avisa FATO (a sessao
//     abre) e fato se le de onde ja esta; LEMBRETE e INTENCAO, e intencao precisa de tabela.
//
//   node tests/testa_lembrete_sessao.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const N = R('fpmed_negocios.html');
const FN = R('supabase', 'functions', 'enviar-boletim', 'index.ts');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_lembrete_sessao — o lembrete que ninguem digita\n');

// ══════════ 1. DERIVADO, NAO GRAVADO ══════════
ok('1. *** existe a funcao que deriva o lembrete da abertura ***', /function lembreteDaSessao\(n\)\{/.test(N));
ok('2. *** ela le de `negocios.abertura` — nao ha INSERT de lembrete automatico ***',
  /if\(!n \|\| !n\.abertura \|\| n\.arquivado\) return null;/.test(N)
  && !/rest\/v1\/lembretes`[\s\S]{0,200}automático/.test(N));
ok('3. ...e o motivo esta escrito (gravar faria a data velha sobreviver ao adiamento)',
  /a data nova na ficha e a velha no lembrete/.test(N.replace(/\s*\n\s*\/\/?\s*/g, ' ')));
ok('4. sessao que JA PASSOU nao vira lembrete', /if\(!dia \|\| dia < hoje\) return null;/.test(N));
ok('5. *** ele nao tem caixinha de "feito": ninguem conclui que a sessao vai abrir ***',
  /ninguém "conclui" que a sessão vai abrir/.test(N));

// ══════════ 2. NA ABA LEMBRETES ══════════
ok('6. *** aparece marcado como automatico ***', /automático — abertura da sessão/.test(N));
ok('7. ...em PRIMEIRO lugar (quem le precisa saber que ninguem digitou aquilo)',
  /box\.innerHTML = cabeca \+ LEMBRETES\.map/.test(N));
ok('8. e conta no numero da aba junto com os digitados',
  /LEMBRETES\.filter\(l => !l\.feito\)\.length \+ \(auto \? 1 : 0\)/.test(N));
ok('9. destaca HOJE e AMANHA (vespera e dia, como pedido)',
  /É HOJE/.test(N) && /é amanhã/.test(N) && /dia === hoje \? 'hoje' : dia === amanha \? 'amanha'/.test(N));
ok('10. negocio sem lembrete digitado E sem abertura continua dizendo que nao ha nada',
  /if\(!LEMBRETES\.length && !auto\)\{ box\.innerHTML = '<div class="salvo">Nenhum lembrete/.test(N));

// ══════════ 3. NO SINO ══════════
ok('11. *** o sino mostra a HORA da sessao ***', /\$\{h \? h \+ ' · ' : ''\}/.test(N));
ok('12. ...em hoje E amanha', /nf-sec">abre hoje[\s\S]{0,120}linha\(x,'hoje',true\)/.test(N)
  && /nf-sec">abre amanhã[\s\S]{0,120}linha\(x,'',true\)/.test(N));

// ══════════ 4. O WHATSAPP — O QUE DA DE GRACA ══════════
// Envio automatico exige contratacao. Nada foi contratado; o que existe e o caminho gratuito.
ok('13. *** o botao abre o WhatsApp com a mensagem PRONTA (wa.me) ***',
  /https:\/\/wa\.me\/\?text=' \+ encodeURIComponent\(textoAvisoSessao\(n\)\)/.test(N));
ok('14. *** e sem numero: escolher o contato e da pessoa ***',
  /wa\.me\/\?text=/.test(N) && /o sistema não tem \(nem quer ter\) a agenda dela/.test(N));
ok('15. a mensagem tem o que o aviso precisa ter (certame, orgao, local, hora, portal)',
  /\*Sessão de licitação\*/.test(N) && /'Abertura: ' \+ dia \+ \(hora \? ' às ' \+ hora : ''\)/.test(N)
  && /n\.orgao \? 'Órgão: '/.test(N) && /n\.portal \? 'Portal: '/.test(N));
ok('16. *** e esta escrito que envio automatico e CONTRATACAO, nao codigo ***',
  /exige contratar/.test(N) && /Twilio/.test(N) && /Nada disso foi contratado/.test(N));
ok('17. o botao do zap so aparece onde avisar ainda muda o resultado (hoje/amanha)',
  /é onde avisar alguém ainda muda o\s*\n?\s*\/\/ resultado/.test(N) || /ainda muda o/.test(N));

// ══════════ 5. O E-MAIL DA MANHA ══════════
ok('18. *** o boletim ganhou o bloco das sessoes de hoje ***', /function blocoSessoes\(sessoes/.test(FN));
ok('19. ...lido de `negocios.abertura`, o MESMO lugar do sino', /rest\/v1\/negocios`\s*\n?\s*\+ `\?select=id,titulo,orgao/.test(FN));
ok('20. *** e o dia e o de GOIAS, nao o UTC ***',
  /Date\.now\(\) - 3 \* 3600 \* 1000/.test(FN) && /não UTC/.test(FN));
ok('21. *** SESSAO DE HOJE FAZ O E-MAIL SAIR mesmo sem licitacao nova ***',
  /if \(!novas\.length && !sessoes\.length\) \{ pulados\+\+;/.test(FN));
ok('22. ...com o motivo (o item mais urgente morria por uma regra de outro assunto)',
  /o item mais urgente do sistema morrendo por/.test(FN.replace(/\s*\n\s*\/\/\s*/g, ' ')));
ok('23. *** o ASSUNTO lidera com a sessao quando ha uma ***',
  /HOJE tem sessão \(\$\{sessoes\.length\}\)/.test(FN));
ok('24. o bloco fica ANTES da lista de novidades (e o unico item com hora marcada)',
  FN.indexOf('${blocoSessoes(sessoes)}') < FN.indexOf('nova(s)</b> no seu jornal'));
ok('25. da pra PROVAR o bloco num dia que tenha sessao (senao "nao quebrou" != "funciona")',
  /body\.sessoesDe/.test(FN) && /"não quebrou" não é o mesmo que "funciona"/.test(FN.replace(/\s*\n\s*\/\/\s*/g, ' ')));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
