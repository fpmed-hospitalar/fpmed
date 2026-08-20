// SUITE testa_familia_rok — A FAMILIA DO `r.ok` NAO PODE VOLTAR (fatia A36 · 20/08/2026).
//
// == O DEFEITO QUE DEU ORIGEM A ELA, achado pelo B na tela Proposta =============================
// Num 401 o PostgREST nao devolve uma LISTA — devolve um OBJETO de erro. O codigo fazia
// `if (!Array.isArray(j)) break;` e seguia: a leitura que FALHOU virou leitura que TERMINOU, com
// distintivo VERDE escrito "0 itens".
//
// >>> O `Array.isArray` NAO E PROVA DE SUCESSO — E PROVA DE FORMA. Toda resposta de erro do
//     PostgREST e um objeto bem formado, e todo objeto bem formado passa por qualquer teste de
//     forma. A caixa A36 mandou varrer o territorio do A atras dos irmaos. Foram 11, em 5
//     arquivos, de 64 `fetch` varridos — e o mais caro deles fazia o `coleta_pncp.js` gravar o
//     `ultimo_dia_ok` PARA TRAS depois de uma leitura de estado que falhou em silencio.
//
// == POR QUE ISTO E UMA SUITE, E NAO SO UMA VARREDURA FEITA UMA VEZ ============================
// Porque a varredura responde HOJE. Um `fetch` novo escrito daqui a duas semanas nao passa por
// ela — passa por esta suite, que roda em toda rodada da fabrica junto com as outras 140.
//
// >>> E ELA USA O DETECTOR DA FERRAMENTA, IMPORTADO, e nao uma copia dele. Duas copias sao duas
//     reguas medindo o mesmo territorio, e elas discordam no dia em que uma das duas melhorar —
//     e a que discorda calada e a que fica. E a mesma licao do `criaBreaker` que os dois
//     coletores IMPORTAM em vez de copiar.
// >>> O BLOCO 1 PROVA O DETECTOR ANTES DE O BLOCO 2 APONTA-LO PARA O CODIGO DE VERDADE. Sem ele,
//     "0 achados" seria indistinguivel de um detector quebrado — a licao da A31, em que oito
//     catracas deram verde sobre 320 linhas que elas nao estavam lendo.
//
//   node tests/testa_familia_rok.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const V = require('../tools/varre_rok.js');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_familia_rok — o `r.ok` conferido em todo fetch do territorio do A\n');

// ══════════ 1. O DETECTOR, PROVADO NAS DUAS DIRECOES ══════════
{
  ok('1. as fixtures existem nas tres classes (assert cego e pior que assert vermelho)',
    V.BOM.length >= 4 && V.RUIM.length >= 5 && V.ENTREGUES.length >= 2,
    { bom: V.BOM.length, ruim: V.RUIM.length, entregues: V.ENTREGUES.length });

  const passouIndevido = V.BOM.filter(([, js]) => V.analisa(js).length > 0).map(([n]) => n);
  ok('2. *** o detector NAO acusa quem confere o ok (4 formas legitimas) ***',
    passouIndevido.length === 0, passouIndevido);

  const escapou = V.RUIM.filter(([, js]) => V.analisa(js).length === 0).map(([n]) => n);
  ok('3. *** e ACUSA as cinco formas do defeito, inclusive o da Proposta letra por letra ***',
    escapou.length === 0, escapou);

  /* O `fetch` DEVOLVIDO tem outro dono, e o detector precisa saber a diferenca entre "conferido"
     e "entregue". Tratar entrega como conferencia perderia o dia em que ninguem confere do outro
     lado; tratar entrega como defeito encheria a lista de falso alarme e ensinaria a ignora-la. */
  const classificouMal = V.ENTREGUES.filter(([, js]) => {
    const a = V.analisa(js);
    return a.length !== 0 || a.entregues !== 1;
  }).map(([n]) => n);
  ok('4. *** e separa "entregue ao chamador" de "conferido" e de "esquecido" ***',
    classificouMal.length === 0, classificouMal);

  // a mutacao mais barata e mais provavel: alguem apaga a conferencia de um fetch que existe
  ok('5. ...e o defeito plantado numa forma REAL desta casa e pego',
    V.analisa("const r = await fetch(`${SB}/rest/v1/coleta_status?fonte=eq.PNCP&select=*`, { headers: H });\n"
      + "const j = await r.json();\nif (Array.isArray(j) && j[0]) usa(j[0]);").length === 1);
}

// ══════════ 1b. A TERCEIRA FORMA: O LACO QUE SAI CALADO ══════════
/* A caixa A36 pede as tres formas. Esta nao passa pelo detector de cima porque o `r.ok` DELA
   esta conferido — o que ela junta e outra coisa:
       if (!Array.isArray(lote) || !lote.length) break;
   `!lote.length` e a pagina vazia, o fim NORMAL de um laco de paginacao. `!Array.isArray(lote)`
   e um 200 que nao e lista, uma resposta que ninguem sabe ler. Pela mesma porta calada, a
   segunda vira a primeira: a licitacao e contada como "nenhum item", a lista de alvos da rodada
   inteira e cortada no meio, e o banco chega a GRAVAR "o PNCP nao publicou arquivo" sobre uma
   resposta que ninguem entendeu. Foram 6 no territorio, e uma delas era falso alarme (estado
   interno da tela, nao resposta de rede) — reescrita para dizer o que e. */
{
  const acusouTodas = V.CONFLADAS.every(([, js]) => V.lacosConflados(js).length > 0);
  ok('5b. *** o detector da 3a forma acusa a conflacao ***', acusouTodas,
    V.CONFLADAS.filter(([, js]) => !V.lacosConflados(js).length).map(([n]) => n));
  /* E O USO CERTO NAO PODE SER ACUSADO: ha 29 `Array.isArray` legitimos neste territorio, prova
     de FORMA depois de o sucesso ja ter sido conferido. Um detector que os acusasse ensinaria a
     todo mundo a ignorar esta suite. */
  const falsoAlarme = V.SEPARADAS.filter(([, js]) => V.lacosConflados(js).length > 0).map(([n]) => n);
  ok('5c. ...e NAO acusa as duas metades separadas, nem a prova de forma legitima',
    falsoAlarme.length === 0, falsoAlarme);
}

// ══════════ 2. APONTADO PARA O TERRITORIO DE VERDADE ══════════
{
  const alvos = V.TELAS_E_LIBS.concat(V.FERRAMENTAS);
  const faltando = alvos.filter(a => !fs.existsSync(path.join(raiz, a)));
  ok('6. a lista do territorio esta inteira no disco (arquivo sumido nao pode virar zero achado)',
    faltando.length === 0, faltando);

  let varridos = 0, sujos = [], calados = [], formas = 0;
  for (const rel of alvos) {
    const abs = path.join(raiz, rel);
    if (!fs.existsSync(abs)) continue;
    const js = V.semComentario(fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n'));
    varridos += V.chamadas(js).length;
    formas += (js.match(/Array\.isArray/g) || []).length;
    for (const a of V.analisa(js)) sujos.push({ arq: rel, tipo: a.tipo, trecho: a.alvo.slice(0, 50) });
    for (const c of V.lacosConflados(js)) calados.push({ arq: rel, trecho: c.trecho });
  }
  /* O NUMERO MINIMO DE `fetch` E COBRADO, e nao so o zero de achados. Se um dia a lista de
     arquivos ou o extrator quebrarem, o resultado seria "0 sujos" sobre 0 varridos — verde de
     quem nao olhou, que e o defeito que esta suite inteira existe para nao repetir. */
  ok('7. a varredura de fato olhou o territorio (nao deu verde sobre nada)', varridos >= 50, { varridos });
  ok('8. *** nenhum fetch do territorio do A deixa de conferir o `ok` ***', sujos.length === 0, sujos.slice(0, 6));
  /* O MESMO CUIDADO DO 7, PARA A 3a FORMA: se o `Array.isArray` sumisse do territorio inteiro, o
     assert 9 daria verde por nao haver o que olhar. Ha 29 usos LEGITIMOS aqui — e e justamente
     porque eles sao muitos que a conflacao passava despercebida no meio deles. */
  ok('9a. ha usos de `Array.isArray` para a varredura olhar (senao o 9 e verde de quem nao olhou)',
    formas >= 20, { formas });
  ok('9. *** nenhum laco do territorio junta "pagina vazia" com "200 que nao e lista" ***',
    calados.length === 0, calados.slice(0, 6));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
