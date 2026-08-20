/* ══════════════════════════════════════════════════════════════════════════════════════════════
   SUITE testa_teto_homologado — A CATRACA DO TETO COMPETITIVO (fatia B28, 20/08/2026)

   Ela guarda quatro promessas, e as quatro cedem em silêncio se ninguém as vigiar:

   1. **UMA REGRA SÓ PARA AS DUAS TELAS.** Negócios e Proposta fazem a mesma pergunta sobre o
      mesmo dado. No dia em que alguém copiar a conta para dentro de uma delas "só para ajustar
      um detalhe", as duas passam a dar números diferentes para o mesmo item — e ninguém sabe
      qual acreditar. É a família de defeito mais cara deste projeto (o preço unitário).

   2. **MEDIANA, NUNCA MÉDIA.** Um pregão desesperado puxa a média e não move a mediana. A média
      de [10, 10, 10, 1] é 7,75 — um preço que ninguém praticou. Trocar uma pela outra é uma
      linha, e o resultado continua parecendo certo.

   3. **O ESTADO VAZIO DIZ QUE NÓS NÃO TEMOS O DADO** — e não que o produto nunca foi vendido.
      Com 0,06% de cobertura medida, ele é a resposta de quase todo item. R$ 0,00, travessão e
      célula em branco são três maneiras diferentes de o olho ler "não houve".

   4. **O CNPJ DO CONCORRENTE NÃO VAI PARA A TELA.** Ele fica no dado, onde o Negócios já o usa
      para responder "fui eu que ganhei?". Nome e documento de concorrente em destaque numa tela
      de proposta é convite para o uso errado.

   ══ E ELA COBRA DO CÓDIGO, NÃO DA PROSA ═════════════════════════════════════════════════════
   Todo assert roda sobre o texto sem comentário (`semComentario`, da régua do A). A lição é da
   B26: um assert que aceita o comentário como prova do código não está provando o código.

     node tests/testa_teto_homologado.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { semComentario } = require('../tools/regua_visual.js');
const RAIZ = path.join(__dirname, '..');
const R = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');

const MOTOR_CRU = R('fpmed_teto_homologado.js');
const MOTOR = semComentario(MOTOR_CRU);
const NEG = semComentario(R('fpmed_negocios.html'));
const GIO = semComentario(R('fpmed_giovana.html'));
const SW = semComentario(R('sw.js'));
const T = require('../fpmed_teto_homologado.js');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 300) + ']' : '')); } n++; };
console.log('SUITE testa_teto_homologado — o teto competitivo, e uma regra só\n');

// ── 1. UMA REGRA SÓ ─────────────────────────────────────────────────────────────────────────
console.log('── 1. uma regra, duas telas ──');
for (const [nome, txt] of [['Negócios', NEG], ['Proposta', GIO]]) {
  ok(nome + ' carrega o motor compartilhado',
    /<script src="fpmed_teto_homologado\.js"><\/script>/.test(txt));
  ok(nome + ' chama `avaliar` do motor, e não uma conta própria',
    /FPMED_TETO_HOMOLOGADO[\s\S]{0,60}\.avaliar\(|T\.avaliar\(/.test(txt));
}
/* >>> O ASSERT PELO AVESSO: nenhuma das duas telas pode CALCULAR mediana por conta própria. O
       padrão procura a assinatura da conta (ordenar e pegar o do meio), não a palavra — quem
       reimplementa raramente chama de "mediana". */
for (const [nome, txt] of [['Negócios', NEG], ['Proposta', GIO]]) {
  ok(nome + ': *** não há mediana reimplementada na tela ***',
    !/Math\.floor\([^)]*\.length\s*\/\s*2\s*\)/.test(txt)
    && !/function\s+mediana|const\s+mediana\s*=/.test(txt),
    (txt.match(/Math\.floor\([^)]*length[^)]*\)/g) || []).slice(0, 3));
}
ok('o motor entra na casca do service worker (senão o recurso existe só para quem chegou hoje)',
  /\.\/fpmed_teto_homologado\.js/.test(SW));
/* A CASCA SÓ É REMONTADA QUANDO A VERSÃO MUDA — arquivo novo na lista sem bump não é baixado por
   quem já instalou. O `-86` é o bump desta fatia; este assert existe para o dia em que alguém
   acrescentar um arquivo à casca e esquecer o número. */
ok('...e a versão da casca foi bumpada nesta fatia (-86 ou maior)',
  (Number((SW.match(/limedtec-fpmed-\d{4}-\d{2}-\d{2}-(\d+)/) || [])[1]) || 0) >= 86,
  (SW.match(/limedtec-fpmed-[\d-]+/) || [])[0]);

// ── 2. MEDIANA, NUNCA MÉDIA ─────────────────────────────────────────────────────────────────
console.log('── 2. mediana, nunca média ──');
/* O COMPORTAMENTO, e não o texto: a função é exercida com o caso que separa as duas. Com
   [1, 10, 10, 10] a média é 7,75 e a mediana é 10 — e é a mediana que descreve o mercado. */
ok('*** a mediana de [1, 10, 10, 10] é 10, e não a média 7,75 ***',
  T.mediana([1, 10, 10, 10]) === 10, T.mediana([1, 10, 10, 10]));
ok('...e com lista ímpar ela pega o do meio', T.mediana([3, 1, 2]) === 2, T.mediana([3, 1, 2]));
/* O ERRO CLÁSSICO: `sort()` sem comparador ordena como TEXTO. `[10, 9, 100]` vira `[10, 100, 9]`
   e a mediana sai 100 em vez de 10. Não dá erro — dá um número errado com cara de certo. */
ok('*** ela ordena por NÚMERO e não por texto (o sort() nu daria 100 aqui) ***',
  T.mediana([10, 9, 100]) === 10, T.mediana([10, 9, 100]));
ok('lista vazia devolve null, e null nunca vira 0', T.mediana([]) === null, T.mediana([]));
ok('e o motor não tem nenhuma média escondida',
  !/reduce\([^)]*\+[^)]*\)\s*\/\s*\w+\.length/.test(MOTOR));

// ── 3. AS TRÊS RESPOSTAS, E ELAS SÃO DIFERENTES ─────────────────────────────────────────────
console.log('── 3. não sei ≠ não há ──');
ok('*** sem índice, `avaliar` devolve null (não sei) — nunca `{n:0}` ***',
  T.avaliar({ descricao: 'X' }, null) === null);
const vazio = T.indexa([], {});
ok('*** com índice e sem resultado, devolve `{n:0}` (não há) ***',
  T.avaliar({ descricao: 'X' }, vazio) && T.avaliar({ descricao: 'X' }, vazio).n === 0);
// zero não é preço homologado — a mesma lição do `valor_unitario_ref` (7.456 itens com zero)
const comZero = T.indexa([{ descricao: 'A', resultado_valor_unit: 0, numero_controle: 'c', numero_item: '1' }], {});
ok('*** resultado com valor ZERO não entra no índice (zero não é preço) ***',
  comZero.linhas === 0 && T.avaliar({ descricao: 'A' }, comZero).n === 0, comZero.linhas);

// ── 4. A CHAVE É ESTRITA ────────────────────────────────────────────────────────────────────
console.log('── 4. a chave não casa produto diferente ──');
/* Os dois exemplos são REAIS, dos 192: "LAPIS PRETO GRAFITE COM BORRACHA ACOPLADA" saiu por
   R$ 9,30 e "LAPIS PRETO GRAFITE COM CORPO EM FORMATO REDONDO" por R$ 0,40. Uma chave frouxa
   casaria os dois e diria ao gestor que lápis já saiu por quarenta centavos. */
const A = '103 , LAPIS PRETO GRAFITE COM BORRACHA ACOPLADA NA EXTREMIDADE';
const B = '104 , LAPIS PRETO GRAFITE COM CORPO EM FORMATO REDONDO';
ok('*** dois lápis diferentes NÃO casam (chave estrita) ***', T.chave(A) !== T.chave(B), [T.chave(A), T.chave(B)]);
/* >>> O PREFIXO `"103 , "` É REAL: 204 dos 310.982 itens do índice publicam o número do item na
       frente da descrição, e 192 deles são justamente os que têm resultado. Sem tirar o prefixo,
       o mesmo produto publicado como item 12 num edital e 47 noutro nunca casaria. */
ok('*** o mesmo produto casa mesmo com número de item diferente na frente ***',
  T.chave('12 , CANETA AZUL') === T.chave('47 , CANETA AZUL'), [T.chave('12 , CANETA AZUL'), T.chave('47 , CANETA AZUL')]);
ok('...e acento e pontuação não separam o que é igual',
  T.chave('PAPEL A4, 75G/M²') === T.chave('papel a4 75g m2'), [T.chave('PAPEL A4, 75G/M²'), T.chave('papel a4 75g m2')]);

// ── 5. A FAIXA, A FOLGA E O SINAL ───────────────────────────────────────────────────────────
console.log('── 5. a faixa e as duas folgas ──');
const tres = T.indexa([
  { descricao: 'CANETA', resultado_valor_unit: 10, numero_controle: 'a', numero_item: '1' },
  { descricao: 'CANETA', resultado_valor_unit: 20, numero_controle: 'b', numero_item: '1' },
  { descricao: 'CANETA', resultado_valor_unit: 30, numero_controle: 'c', numero_item: '1' },
], {});
const r3 = T.avaliar({ descricao: 'CANETA', precoUnit: 15 }, tres);
ok('com três resultados, sai faixa e mediana', r3.n === 3 && r3.temFaixa && r3.mediana === 20
  && r3.min === 10 && r3.max === 30, r3);
/* O SINAL É O MESMO DA FOLGA DO TETO LEGAL — positivo = sobra. Dois badges lado a lado com sinais
   invertidos fariam a mesma pessoa ler "-12%" como boa num e ruim no outro. */
ok('*** preço abaixo da mediana dá folga POSITIVA (o mesmo sinal do teto legal) ***',
  Math.abs(r3.folgaPct - 25) < 0.001, r3.folgaPct);
ok('...e preço acima dá folga negativa',
  T.avaliar({ descricao: 'CANETA', precoUnit: 25 }, tres).folgaPct < 0);
ok('*** sem preço para comparar, a folga é null e NUNCA 0% ***',
  T.avaliar({ descricao: 'CANETA' }, tres).folgaPct === null);
/* COM UM RESULTADO SÓ NÃO HÁ FAIXA: `min` e `max` são o MESMO número, e escrever "de R$ 27 a
   R$ 27" faz uma medida única parecer uma pesquisa de mercado. */
const um = T.indexa([{ descricao: 'CANETA', resultado_valor_unit: 10, numero_controle: 'a', numero_item: '1' }], {});
ok('*** com UM resultado não há faixa (senão "de R$ 10 a R$ 10" viraria pesquisa) ***',
  T.avaliar({ descricao: 'CANETA' }, um).temFaixa === false);
/* O ITEM NÃO SE COMPARA CONSIGO MESMO: sem isto, um item do certame de Pedra Bonita diria "já foi
   homologado por R$ 27" sobre a linha cujo resultado É R$ 27 — tautologia com cara de pesquisa. */
ok('*** o próprio item é tirado da conta (`ignorar`) ***',
  T.avaliar({ descricao: 'CANETA', ignorar: { numero_controle: 'a', numero_item: '1' } }, um).n === 0);

// ── 6. O QUE NÃO PODE APARECER NA TELA ──────────────────────────────────────────────────────
console.log('── 6. o CNPJ e o percentual inventado ──');
ok('*** o motor não devolve CNPJ nenhum para a tela ***', !/cnpj/i.test(MOTOR),
  (MOTOR.match(/\w*cnpj\w*/ig) || []));
for (const [nome, txt] of [['Negócios', NEG], ['Proposta', GIO]]) {
  const bloco = (txt.match(/function homologadoDoItem[\s\S]*?\n\}/) || txt.match(/function homolBadgeHTML[\s\S]*?\n\}/) || [''])[0];
  ok(nome + ': o bloco do teto competitivo não imprime `resultado_cnpj`',
    !!bloco && !/resultado_cnpj/.test(bloco), bloco.slice(0, 120));
}
/* "NÃO INVENTE DENOMINADOR": o rodapé sabe quantos itens DESTE edital têm resultado; não sabe
   quantos itens iguais existem no Brasil. Percentual sem denominador conhecido é número
   inventado com cara de medida. */
const ROD = (NEG.match(/function rodapeDoHomologado\(\)\{[\s\S]*?\n\}/) || [''])[0];
ok('*** o rodapé da dívida não publica percentual nenhum ***', !!ROD && !/%/.test(ROD), ROD.slice(0, 200));
ok('...e ele traz os dois números que a caixa pediu (N de M)',
  /Resultado homologado disponível em/.test(ROD) && /c\.com/.test(ROD) && /c\.de/.test(ROD));

// ── 7. O ESTADO HONESTO ─────────────────────────────────────────────────────────────────────
console.log('── 7. o estado vazio, que é o caso comum ──');
const VAZIO_NEG = (NEG.match(/ainda não temos resultado homologado para este item[^']*/) || [''])[0];
ok('*** o Negócios diz "ainda não temos resultado homologado para este item" ***', !!VAZIO_NEG, VAZIO_NEG);
ok('*** e a Proposta diz "ainda sem resultado homologado" ***',
  /ainda sem resultado homologado/.test(GIO));
/* AS TRÊS MANEIRAS DE O OLHO LER "NÃO HOUVE", e a caixa proíbe as três. O padrão procura o
   literal dentro dos blocos do teto competitivo, não na tela inteira (a tela tem outros zeros
   legítimos, e cobrar deles seria vermelho que trabalho nenhum apaga). */
const BLOCO_NEG = (NEG.match(/function homologadoDoItem\(it\)\{[\s\S]*?\n\}/) || [''])[0];
const BLOCO_GIO = (GIO.match(/function homolBadgeHTML\(r\)\{[\s\S]*?\n\}/) || [''])[0];
for (const [nome, b] of [['Negócios', BLOCO_NEG], ['Proposta', BLOCO_GIO]]) {
  ok(nome + ': *** o estado vazio não é R$ 0,00, nem um travessão solto ***',
    !!b && !/R\$\s*0,00/.test(b) && !/>\s*—\s*</.test(b), b.slice(0, 160));
}
/* FALHA DE LEITURA NÃO PODE VIRAR "NÃO HÁ": são coisas diferentes, e a segunda é uma afirmação
   sobre o mercado que ninguém pode fazer sem ter lido a tabela. */
ok('Negócios: falha de leitura tem estado próprio, separado do vazio',
  /HOMOL_ERRO/.test(BLOCO_NEG) && /não consegui ler os resultados homologados/.test(BLOCO_NEG));
ok('Proposta: idem', /_homolErro/.test(BLOCO_GIO) && /histórico indisponível/.test(BLOCO_GIO));

// ── 8. O TRUNCAMENTO É DITO ─────────────────────────────────────────────────────────────────
console.log('── 8. leitura parcial não se apresenta como completa ──');
/* Hoje são 192 linhas e cabem numa ida. No dia em que forem 30.000, o servidor devolve uma PARTE
   — e uma tela que não sabe que leu uma parte diz "não há resultado" com toda a convicção sobre
   um item que tem. Foi o defeito do `limit=3000` desta mesma tela. */
for (const [nome, txt] of [['Negócios', NEG], ['Proposta', GIO]]) {
  ok(nome + ': a consulta pede `count=exact` e o índice guarda se truncou',
    /count=exact/.test(txt) && /truncado:\s*total\s*>\s*linhas\.length/.test(txt));
}
ok('*** e o rodapé AVISA quando a leitura foi parcial ***',
  /truncado/.test(ROD) && /não enxergou/.test(ROD), ROD.slice(-200));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
