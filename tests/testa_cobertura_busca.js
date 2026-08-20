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
// metade da promessa da busca passou a morar no DDL na fatia A34 — entao ele entra na suite
const DDL = fs.readFileSync(path.join(__dirname, '..', 'ddl', 'busca_local.sql'), 'utf8').replace(/\r\n/g, '\n');

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
/* ══ REAPONTADO DE NOVO EM 14/08 (fatia A9) — E DESTA VEZ O ASSERT FICOU MAIS DURO, NAO MENOS ══
   A fatia A9 trouxe uma consulta que NAO pagina: `brutosPorControle`, que busca licitacoes por
   uma LISTA EXPLICITA de numeros de controle. A tentacao era abrir uma excecao pro nome dela.
   >>> EXCECAO POR NOME E COMO ESTE ASSERT MORRE: o proximo que nao paginar tambem ganha o
       dele, e em tres meses a regra vale pra nada. Entao a excecao e por PROVA, e ela custa um
       assert NOVO (2b): a consulta so escapa da paginacao se buscar por lista explicita de
       chave unica E se o tamanho do lote for provadamente menor que a pagina do PostgREST.
       Com isso, a resposta nao pode ser cortada — nao porque alguem tomou cuidado, mas porque
       nao ha linhas suficientes pra cortar. */
(function () {
  const consultas = [...L.matchAll(/\$\{SB_URL\}\/rest\/v1\/(licitacoes|licitacoes_acompanhadas)\?select=/g)];
  /* A JANELA OLHA PROS DOIS LADOS, e isso me custou um vermelho: as consultas aparecem nas duas
     formas — `const q = ...` e depois `lerPaginado(q)` (a chamada vem DEPOIS), e
     `lerPaginado(`...`)` com a consulta embutida (a chamada vem ANTES). Olhando so pra frente,
     a segunda forma parecia nao paginar. */
  const semPaginar = consultas.filter(m => {
    const volta = L.slice(Math.max(0, m.index - 300), m.index + 700);
    /* `lerPorTermos` ENTROU NA JANELA NA FATIA A34 (20/08), E ELE NAO E UMA EXCECAO ─────────────
       A A34 desceu o filtro de palavra para o banco: `buscarNoBanco` e `buscarNoBancoAmplo`
       deixaram de chamar `lerPaginado` direto e passaram a chamar `lerPorTermos`, que dispara UMA
       leitura paginada por termo e junta os conjuntos. As duas consultas cairam nesta lista.
       >>> ACEITAR O NOME SEM PROVA SERIA ABRIR A PORTA que o comentario de 14/08 logo abaixo diz
           que mata este assert. Entao a excecao custa um assert novo (2c): `lerPorTermos` so vale
           como paginacao porque ele MESMO passa por `lerPaginado` nos dois caminhos — com termo e
           sem termo. Se alguem trocar o miolo dele por um fetch cru, o 2c fica vermelho e este
           aqui volta a cobrar as duas consultas. */
    if (/lerPaginado\(|lerPorTermos\(/.test(volta)) return false;
    /* DUAS SAIDAS SEM PAGINACAO, e as duas por PROVA e nao por nome:
       1. lista explicita de chave unica, com lote limitado (o assert 2b cobra o limite);
       2. leitura de UMA linha: `numero_controle=eq.<x>&limit=1`. Uma linha nao tem como ser
          cortada por um teto de mil, e chamar isso de "consulta de lista" faria o assert
          cobrar paginacao de um `select ... limit 1` — que e como um assert vira ritual. */
    if (/numero_controle=in\.\(\$\{lote\}\)/.test(volta)) return false;
    return !/numero_controle=eq\.[\s\S]{0,120}?limit=1'/.test(volta);
  }).map(m => m[1]);
  ok('2. *** TODA consulta de lista ao banco pagina — ou busca por lista explicita de chave ***',
    consultas.length >= 3 && semPaginar.length === 0,
    { consultas: consultas.length, semPaginar });
  /* O ASSERT QUE PAGA PELA EXCECAO. Sem ele, "busca por lista explicita" seria so uma frase:
     alguem poe lote de 5.000 e a consulta volta a ser cortada em 1000, com a bencao do 2. */
  const mLote = L.match(/const LOTE_CONTROLES = (\d+);/);
  const mPag = L.match(/const PAG_BANCO = (\d+)/);
  ok('2b. *** e o lote da busca por lista e PROVADAMENTE menor que a pagina do PostgREST ***',
    !!mLote && !!mPag && Number(mLote[1]) < Number(mPag[1]),
    { lote: mLote && mLote[1], pagina: mPag && mPag[1] });
  /* O ASSERT QUE PAGA PELA SEGUNDA EXCECAO (A34). Sem ele, `lerPorTermos` seria um nome que este
     arquivo aceita de olhos fechados — e o teto de 1000 voltaria por dentro dele. Os DOIS
     caminhos sao cobrados: com termo (uma leitura por termo) e sem termo (a janela inteira). */
  const corpoTermos = (() => {
    const i = L.indexOf('async function lerPorTermos(');
    return i < 0 ? '' : L.slice(i, L.indexOf('\n}', i));
  })();
  ok('2c. *** e o `lerPorTermos` pagina nos DOIS caminhos (com termo e sem termo) ***',
    (corpoTermos.match(/lerPaginado\(/g) || []).length === 2
    && /if\(!kws \|\| !kws\.length\) return await lerPaginado\(qBase\);/.test(corpoTermos)
    && !/fetch\(/.test(corpoTermos),
    { chamadas: (corpoTermos.match(/lerPaginado\(/g) || []).length });
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
/* ══ ESTE ASSERT ERA UM FALSO VERDE, E ELE E O TERCEIRO DA MESMA FAMILIA NESTA RODADA ══════════
   Ele guardava a regra de 10/08 — *"o termo NAO vai pro banco, porque o filtro do banco e
   sensivel a acento e perderia o que o semAcento do navegador acha"* — e a media de dois jeitos:
   procurando a FRASE do comentario e recusando `objeto=ilike`.
   >>> A FATIA A34 INVERTEU A REGRA e o assert continuou VERDE, pelas duas metades ao mesmo tempo:
       o comentario velho ficou no arquivo (foi apagado agora) e o filtro novo se chama
       `texto_busca=ilike`, nao `objeto=ilike`. Um assert que mede a placa na porta atesta a casa
       que foi demolida.
   >>> O QUE ELE COBRA AGORA e a razao pela qual a inversao pode existir: o banco NAO filtra
       `objeto` (esse sim erraria acento) — filtra a coluna gerada `sem_acento(objeto)`, que e o
       mesmo `semAcento` do navegador do outro lado. A regra e a mesma; so mudou quem executa. */
ok('15. *** o termo vai pro banco pela coluna SEM ACENTO (`texto_busca`) ***',
  /&texto_busca=ilike\./.test(L)
  && /generated always as \(public\.sem_acento\(coalesce\(objeto, ''\)\)\) stored/.test(DDL));
ok('15b. ...e nunca pelo `objeto` cru, que e o filtro que erraria o acento', !/objeto=ilike/.test(L));
ok('15c. ...com os coringas do LIKE escapados (o "%" de "seringa 20%" e termo plausivel aqui)',
  /escapaLike\(k\)/.test(L) && /replace\(\/\(\[%_\\\\\]\)\/g/.test(L));
/* A PROVA DA IGUALDADE NAO MORA NESTE ARQUIVO, e o assert diz onde ela mora. Um teste estatico
   nao consegue comparar `sem_acento` do Postgres com `semAcento` do JavaScript; quem faz isso e a
   ferramenta que le o indice de verdade e compara conjunto com conjunto. Cobrar aqui que ela
   EXISTA e o que impede a regra de virar promessa. */
ok('15d. *** e a igualdade das duas regras e MEDIDA por ferramenta propria ***',
  fs.existsSync(path.join(__dirname, '..', 'tools', 'prova_busca_local.js'))
  && fs.existsSync(path.join(__dirname, '..', 'ddl', 'busca_local.sql')));
ok('16. e a busca ampla (indice inteiro) continua existindo', /async function buscarNoBancoAmplo\(/.test(L));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
