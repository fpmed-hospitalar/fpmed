// SUITE testa_cobertura_busca — A BUSCA NAO PODE DIZER "ZERO" SABENDO MENOS DO QUE SABE.
//
// DEFEITO MEDIDO EM 11/08 (relato do Natanael: "albumina" de 26/07 a 11/08 deu 0):
//   as duas consultas ao banco pediam `limit=1000` e paravam ai. O PostgREST desta instancia
//   TAMBEM corta em 1000. Com o indice em 1.881 linhas, 881 NUNCA chegavam a tela — e como quem
//   filtra a palavra e o navegador, o "0 batem" era calculado sobre o pedaco carregado.
//   O operador lia "nenhuma licitacao de albumina" quando a resposta honesta era "nenhuma NAS
//   QUE EU CARREGUEI". Tela que responde 0 com meia base e pior que tela que nao responde.
//
// >>> E JA ERA A SEGUNDA VEZ que o teto de 1000 desta instancia mordeu o projeto: a primeira foi
//     o dicionario CMED, que paginava em 2000 e lia 1.000 de 6.283 achando que lia tudo. Por isso
//     esta suite trava a PAGINACAO, e nao so o numero.
//
//   node tests/testa_cobertura_busca.js
'use strict';
const fs = require('fs'), path = require('path');
const L = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_cobertura_busca — a busca le o indice INTEIRO\n');

// ══════════ 1. NENHUMA CONSULTA PARA EM 1000 ══════════
ok('1. *** nenhuma consulta ao indice usa `limit=1000` ***', !/licitacoes\?select=bruto[^`']*limit=1000/.test(L));
/* REAPONTADO em 13/08 (item 7e): ele cobrava `=== 2`, o numero de consultas que existiam no dia
   em que foi escrito. A terceira fonte da busca (o Calendario 2025) entrou e o assert ficou
   vermelho sem NADA ter piorado — ele media a QUANTIDADE, e a promessa e "toda consulta de
   lista pagina".
   >>> AGORA ELE PROCURA AS CONSULTAS E COBRA CADA UMA. Assim ele passa a cobrir sozinho a
       QUARTA fonte, no dia em que ela existir — que e o oposto de precisar ser atualizado a
       cada uma. Um assert que exige ser reescrito a cada crescimento e um assert que, na
       terceira pressa, alguem "conserta" trocando o numero sem ler o que ele guardava. */
(function () {
  const consultas = [...L.matchAll(/\$\{SB_URL\}\/rest\/v1\/(licitacoes|licitacoes_acompanhadas)\?select=/g)];
  /* A JANELA OLHA PROS DOIS LADOS, e isso me custou um vermelho: as consultas aparecem nas duas
     formas — `const q = ...` e depois `lerPaginado(q)` (a chamada vem DEPOIS), e
     `lerPaginado(`...`)` com a consulta embutida (a chamada vem ANTES). Olhando so pra frente,
     a segunda forma parecia nao paginar. */
  const semPaginar = consultas.filter(m =>
    !/lerPaginado\(/.test(L.slice(Math.max(0, m.index - 300), m.index + 700))).map(m => m[1]);
  ok('2. *** TODA consulta de lista ao banco passa pela leitura paginada ***',
    consultas.length >= 3 && semPaginar.length === 0,
    { consultas: consultas.length, semPaginar });
})();
ok('3. existe UMA funcao de paginacao (nao duas copias do laco)',
  (L.match(/async function lerPaginado\(/g) || []).length === 1);
ok('4. ela pagina pelo header Range, do jeito que o PostgREST entende',
  /Range: de \+ '-' \+ \(de \+ PAG_BANCO - 1\)/.test(L));
ok('5. e para quando a pagina vem incompleta (nao chuta mais uma volta)',
  /if\(j\.length < PAG_BANCO\) return out;/.test(L));

// ══════════ 2. O TETO E DECLARADO, E DITO ══════════
// Um teto silencioso seria o mesmo defeito com outro numero.
ok('6. o teto de paginas e uma constante nomeada', /TETO_PAGINAS_BANCO = 20/.test(L));
ok('7. *** e bater no teto MARCA que a leitura foi parcial ***',
  /window\._bancoTruncou = true;/.test(L));
ok('8. ...com o motivo escrito (fingir que leu tudo e o erro que este conserto desfaz)',
  /em vez de fingir que leu tudo/.test(L));

// ══════════ 3. "NAO SEI" CONTINUA DIFERENTE DE "ZERO" ══════════
// Esta era a regra que ja existia e nao podia quebrar no conserto: banco fora devolve null (a
// tela cai pro PNCP ao vivo), e nao lista vazia.
ok('9. *** sem ler NADA, devolve null (= "nao sei"), nao lista vazia ***',
  /if\(!r\.ok\) return out\.length \? out : null;/.test(L));
ok('10. e o erro de rede continua devolvendo null', /\}catch\(e\)\{ return null; \}/.test(L));

// ══════════ 4. O ROTULO NAO MENTE ══════════
// "publicadas no dia" sobre um periodo de 17 dias: numero certo, legenda errada — o jeito mais
// barato de alguem tirar a conclusao errada de um dado correto.
ok('11. *** o rotulo fixo "publicadas no dia" saiu ***', !/>publicadas no dia</.test(L));
ok('12. *** e o texto passa a dizer o periodo consultado ***',
  /'publicadas de ' \+ dm\(de\) \+ ' a ' \+ dm\(ate\)/.test(L));
ok('13. periodo de um dia so continua dizendo o dia', /'publicadas em ' \+ dm\(de\)/.test(L));
ok('14. e sem periodo, nao inventa nada', /\? 'publicadas'/.test(L));

// ══════════ 5. O QUE NAO PODE TER MUDADO ══════════
// A regra de 10/08: o termo NAO vai pro banco, porque o filtro do banco e sensivel a acento e
// perderia o que o semAcento do navegador acha.
ok('15. *** o termo continua NAO indo pro banco (o acento perderia resultado) ***',
  /o do banco é sensível a acento/.test(L) && !/objeto=ilike/.test(L));
ok('16. e a busca ampla (indice inteiro) continua existindo', /async function buscarNoBancoAmplo\(/.test(L));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
