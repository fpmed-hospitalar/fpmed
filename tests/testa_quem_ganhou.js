/* ════════════════════════════════════════════════════════════════════════════════════════════
   SUITE testa_quem_ganhou — QUEM LEVOU, E POR QUANTO (fatia B35, 21/08/2026)

   ══ A PERGUNTA, E POR QUE ELA É OUTRA ═══════════════════════════════════════════════════════
   O `avaliar` da B28 responde *"por quanto este produto já saiu?"*. Esta responde *"QUEM levou?"*
   — a pergunta que o gestor faz depois de perder. São dois blocos na mesma linha da tela e duas
   funções no mesmo motor, porque a segunda precisa de uma coisa que a primeira jogava fora.

   ══ A IDENTIDADE É O CNPJ, E ISSO FOI MEDIDO ════════════════════════════════════════════════
   Nos 3.437 resultados COM PREÇO de 288 certames (são 3.475 com resultado, e 38 trazem preço
   zero, que não é preço) há **392 CNPJs para 404 grafias de nome**: doze empresas
   aparecem com dois nomes, e nem sempre por erro de digitação — "APAMED HOSPITALAR EIRELI" e
   "APAMED HOSPITALAR LTDA- EPP" são a mesma empresa depois da conversão de EIRELI; "C A
   DISTRIBUIDORA DE PRODUTOS HOSPITALARES EIRELI" e "C.A. HOSPITALAR LTDA" também. Agrupar por
   NOME partiria doze fornecedores em dois e diria que cada metade ganhou metade das vezes.
   >>> E o inverso foi medido e não acontece: ZERO nomes compartilhados por dois CNPJs.
   >>> O CNPJ É A CHAVE E NÃO SAI NA TELA. As duas coisas cabem juntas: a tela imprime `nome`.

   ══ O RANKING QUE ESTA SUÍTE PROÍBE ═════════════════════════════════════════════════════════
   392 fornecedores, e **344 ganharam exatamente UM certame**. Um só ganhou seis. Uma tela de
   "maiores fornecedores" construída sobre isso seria uma lista em que 88% das linhas valem n=1,
   publicada com a autoridade de quem mediu o país. Por isso a função é POR PRODUTO, e toda
   resposta carrega `certames` — o denominador anda junto com o número, nunca no rodapé.

   ══ E A DISPERSÃO, QUE É A RESPOSTA À PENDÊNCIA 5 DO A ══════════════════════════════════════
   O A sugeriu um piso de comprimento para a chave ("OLEO" junta R$ 8,99 com R$ 45,00). Medido:
   dos 150 produtos com 2+ resultados, 20 têm chave curta; num corte de 3x, **9 produtos ficam
   marcados e só 2 são de chave curta**. Os piores são longos ("FILTRO COMBUSTIVEL TIPO
   COMBUSTIVEL OLEO DIE…", 8 resultados, R$ 18 a R$ 229), e CEBOLA/CENOURA/MELANCIA — chaves de 6
   a 8 letras — variam 1,1x. O comprimento é o critério errado nas duas direções; o que separa
   "a chave juntou coisas diferentes" de "o mercado é largo" é a DISPERSÃO dos preços.

     node tests/testa_quem_ganhou.js
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { semComentario } = require('../tools/regua_visual.js');
const RAIZ = path.join(__dirname, '..');
const R = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');
const T = require('../fpmed_teto_homologado.js');

const NEG = semComentario(R('fpmed_negocios.html'));
const GIO = semComentario(R('fpmed_giovana.html'));
const MOTOR = semComentario(R('fpmed_teto_homologado.js'));
const BLOCO = (NEG.match(/function homologadoDoItem\(it\)\{[\s\S]*?\n\}/) || [''])[0];

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 320) + ']' : '')); } n++; };
console.log('SUITE testa_quem_ganhou — quem levou, e sobre quantos certames\n');

// Uma linha de `licitacao_itens` com resultado, no formato que a tela busca.
const L = (desc, valor, cnpj, nome, ctrl, item, data) => ({
  descricao: desc, resultado_valor_unit: valor, resultado_cnpj: cnpj, resultado_vencedor: nome,
  numero_controle: ctrl, numero_item: String(item), quantidade: 1, unidade: 'UN',
});
const idx = (linhas, certames) => T.indexa(linhas, { certames: certames || {} });

// ══════════════════════════════════════════════════════════════════════════════════════════
// 1. A IDENTIDADE É O CNPJ, E O RÓTULO É O NOME
// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('-- 1. quem e quem --');
{
  const i = idx([
    L('CANETA AZUL', 10, '111', 'APAMED HOSPITALAR EIRELI', 'a', 1),
    L('CANETA AZUL', 12, '111', 'APAMED HOSPITALAR LTDA- EPP', 'b', 1),
    L('CANETA AZUL', 11, '222', 'OUTRA LTDA', 'c', 1),
  ], { a: { data: '2026-01-01' }, b: { data: '2026-06-01' }, c: { data: '2026-03-01' } });
  const g = T.quemGanhou({ descricao: 'CANETA AZUL' }, i);
  ok('*** duas grafias do MESMO CNPJ são UM fornecedor, com duas vitorias ***',
    g.fornecedores.length === 2 && g.fornecedores[0].vezes === 2, g.fornecedores.map(x => [x.nome, x.vezes]));
  ok('*** e o nome mostrado e o MAIS RECENTE (empresa que trocou de nome aparece pelo de agora) ***',
    g.fornecedores[0].nome === 'APAMED HOSPITALAR LTDA- EPP', g.fornecedores[0].nome);
  ok('o de mais vitorias vem primeiro', g.fornecedores[0].vezes > g.fornecedores[1].vezes);
  ok('a faixa de cada fornecedor sai com ele', g.fornecedores[0].min === 10 && g.fornecedores[0].max === 12);
  ok('*** e com UMA vitoria nao ha faixa (senao "de R$ 11 a R$ 11" viraria pesquisa) ***',
    g.fornecedores[1].temFaixa === false && g.fornecedores[0].temFaixa === true);
  ok('o CNPJ vai no objeto (e a chave de exportacao), mas quem pinta usa `nome`',
    g.fornecedores[0].cnpj === '111' && typeof g.fornecedores[0].nome === 'string');
}
/* ══ OS TRÊS ASSERTS DE DETERMINISMO, E ELES SÃO BURACOS QUE A `muta_b35` ACHOU NESTA SUÍTE ═══
   As três mutações — tirar o desempate alfabético do nome, tirar o desempate do nome na ORDEM da
   lista, e cortar em cinco sem contar o resto — passaram VERDES na primeira rodada da catraca.
   Nenhuma delas quebra nada visível: a tela continua bonita. O que elas quebram é a tela dizer a
   MESMA COISA duas vezes seguidas — e "o mesmo item mostrou dois fornecedores diferentes ontem e
   hoje" é a espécie de defeito que ninguém consegue reproduzir para reclamar. */
{
  // mesmo CNPJ, duas grafias, SEM data e com a mesma frequência: só o alfabeto desempata.
  const i = idx([
    L('CANETA', 10, '111', 'ZETA LTDA', 'a', 1),
    L('CANETA', 12, '111', 'ALFA LTDA', 'b', 1),
  ]);
  const um = T.quemGanhou({ descricao: 'CANETA' }, i).fornecedores[0].nome;
  const dois = T.quemGanhou({ descricao: 'CANETA' }, i).fornecedores[0].nome;
  ok('*** empate total no nome cai no alfabeto — e a resposta e a MESMA nas duas leituras ***',
    um === 'ALFA LTDA' && um === dois, [um, dois]);
}
{
  // dois fornecedores com o MESMO numero de vitorias e de certames: so o nome desempata.
  const g = T.quemGanhou({ descricao: 'CANETA' }, idx([
    L('CANETA', 10, '111', 'ZETA LTDA', 'a', 1),
    L('CANETA', 12, '222', 'ALFA LTDA', 'b', 1),
  ]));
  ok('*** empate em vitorias e certames cai no alfabeto (a ordem nao muda entre duas aberturas) ***',
    g.fornecedores.map(x => x.nome).join('|') === 'ALFA LTDA|ZETA LTDA',
    g.fornecedores.map(x => x.nome));
}
{
  const g = T.quemGanhou({ descricao: 'CANETA' }, idx([L('CANETA', 10, '111', null, 'a', 1)]));
  ok('*** vencedor nao publicado NAO ganha nome generico ("fornecedor") ***',
    g.fornecedores[0].nome === null, g.fornecedores[0].nome);
}
{
  /* SEM CNPJ PUBLICADO, cada linha é o seu próprio grupo. Juntar todos os "sem CNPJ" num balde
     afirmaria que são a mesma empresa — o erro exato que o CNPJ existe para não cometer. */
  const g = T.quemGanhou({ descricao: 'CANETA' }, idx([
    L('CANETA', 10, null, 'UM LTDA', 'a', 1),
    L('CANETA', 12, null, 'DOIS LTDA', 'b', 1),
  ]));
  ok('*** sem CNPJ, dois nomes NAO viram um fornecedor so ***', g.fornecedores.length === 2,
    g.fornecedores.map(x => x.nome));
}
{
  const g = T.quemGanhou({ descricao: 'CANETA' }, idx([L('CANETA', 10, '111', null, 'a', 1)]));
  ok('vencedor nao publicado nao vira nome inventado: fica nulo',
    g.fornecedores[0].nome === null, g.fornecedores[0]);
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 2. O DENOMINADOR ANDA JUNTO COM O NÚMERO
// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n-- 2. sobre quantos certames --');
{
  const g = T.quemGanhou({ descricao: 'CANETA' }, idx([
    L('CANETA', 10, '111', 'UM', 'a', 1), L('CANETA', 11, '111', 'UM', 'a', 2),
    L('CANETA', 12, '111', 'UM', 'b', 1),
  ]));
  ok('*** `certames` conta certames DISTINTOS, e nao linhas ***', g.n === 3 && g.certames === 2,
    [g.n, g.certames]);
  ok('...e o mesmo vale por fornecedor (3 vitorias em 2 certames)',
    g.fornecedores[0].vezes === 3 && g.fornecedores[0].certames === 2);
  ok('*** a tela imprime os DOIS numeros juntos, na mesma frase ***',
    /resultado\(s\) em ' \+ g\.certames \+ ' certame\(s\)/.test(BLOCO), BLOCO.slice(0, 60));
}
{
  const g = T.quemGanhou({ descricao: 'CANETA' }, idx([L('CANETA', 10, '111', 'UM', 'a', 1)]));
  ok('*** um resultado se declara um resultado (`umResultado`) ***', g.umResultado === true);
  ok('*** e a tela escreve que um resultado nao e historico ***',
    /um resultado não é histórico, é um caso/.test(BLOCO));
}
{
  const g = T.quemGanhou({ descricao: 'CANETA' }, idx([
    L('CANETA', 10, '111', 'UM', 'a', 1), L('CANETA', 11, '111', 'UM', 'b', 1)]));
  ok('*** um fornecedor so se declara (`umFornecedor`) ***', g.umFornecedor === true);
  ok('*** e a tela diz que e o unico NOS RESULTADOS QUE TEMOS, nao no mercado ***',
    /nos resultados que nós temos/.test(BLOCO) && /não quer dizer que seja o único que disputa/.test(BLOCO));
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 3. NÃO EXISTE RANKING GLOBAL — E ISSO É UMA AUSÊNCIA COBRADA
// ══════════════════════════════════════════════════════════════════════════════════════════
// Ausência não se prova com um teste que "passa porque não achou nada" — este cobra o CAMINHO:
// a função só responde a um PEDIDO com descrição, e não há função que devolva o país.
console.log('\n-- 3. o ranking que nao existe --');
ok('*** `quemGanhou` exige uma descricao: sem pedido, nao ha resposta global ***',
  T.quemGanhou({ descricao: '' }, idx([L('CANETA', 10, '111', 'UM', 'a', 1)])).n === 0);
ok('*** e o motor NAO exporta nenhuma funcao de ranking ***',
  !Object.keys(T).some(k => /rank|top|maiores|lideres/i.test(k)), Object.keys(T));
ok('...nem a tela monta uma lista de fornecedores fora do produto',
  !/maiores fornecedores|ranking de fornecedor/i.test(NEG));
/* O NÚMERO QUE SUSTENTA A RECUSA FICA ESCRITO, com a fonte. Regra sem o número que a justifica é
   a primeira coisa que alguém "simplifica" seis meses depois. */
ok('*** o motor registra POR QUE nao ha ranking, com o numero medido ***',
  /\*\*344 deles\s+ganharam exatamente UM certame\*\*/.test(R('fpmed_teto_homologado.js'))
  && /\*\*392 fornecedores\*\*/.test(R('fpmed_teto_homologado.js')));
/* E O NÚMERO ESCRITO NÃO PODE VIRAR FOLCLORE: a prosa aponta para quem o remede. Comentário com
   número que ninguém confere é a mesma coisa que número inventado, só que com data. */
ok('...e aponta para a prova que remede esse numero contra o banco',
  /prova_b35_quem_ganhou\.js/.test(R('fpmed_teto_homologado.js')));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 4. A DISPERSÃO — E O COMPRIMENTO DA CHAVE NÃO É O CRITÉRIO
// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n-- 4. quando a faixa nao merece confianca --');
{
  // "OLEO": R$ 8,99 e R$ 45,00 — os números reais medidos no banco em 21/08.
  const g = T.quemGanhou({ descricao: 'OLEO' }, idx([
    L('OLEO', 8.99, '111', 'UM', 'a', 1), L('OLEO', 45, '222', 'DOIS', 'b', 1)]));
  ok('*** 5x entre o menor e o maior marca o produto como disperso ***', g.disperso === true, g.razao);
  ok('...e a razao sai medida, para a tela poder dize-la', Math.round(g.razao) === 5, g.razao);
}
{
  // CEBOLA: chave de 6 letras, 1,1x — chave curta e comportada. Um piso de comprimento a calaria.
  const g = T.quemGanhou({ descricao: 'CEBOLA' }, idx([
    L('CEBOLA', 7.99, '111', 'UM', 'a', 1), L('CEBOLA', 8.99, '222', 'DOIS', 'b', 1)]));
  ok('*** chave CURTA e preco coerente NAO e marcada (o comprimento nao e o criterio) ***',
    g.disperso === false && g.chave.length <= 12, [g.chave, g.razao]);
}
{
  // O pior caso medido é de chave LONGA: 44 caracteres, R$ 18 a R$ 229.
  const d = 'FILTRO COMBUSTIVEL TIPO COMBUSTIVEL OLEO DIESEL';
  const g = T.quemGanhou({ descricao: d }, idx([
    L(d, 18, '111', 'UM', 'a', 1), L(d, 229, '222', 'DOIS', 'b', 1)]));
  ok('*** chave LONGA e preco espalhado E marcada (o piso de comprimento a deixaria passar) ***',
    g.disperso === true && g.chave.length > 12, [g.chave.length, g.razao]);
}
{
  const g = T.quemGanhou({ descricao: 'CANETA' }, idx([L('CANETA', 10, '111', 'UM', 'a', 1)]));
  ok('*** com um resultado so nao ha dispersao a declarar ***', g.disperso === false);
}
ok('o limite e uma constante declarada, e nao um numero solto no meio do codigo',
  T.LIMITE_DISPERSAO === 3 && /LIMITE_DISPERSAO/.test(MOTOR));
ok('*** marcar NAO esconde: os fornecedores continuam na resposta ***',
  T.quemGanhou({ descricao: 'OLEO' }, idx([
    L('OLEO', 8.99, '111', 'UM', 'a', 1), L('OLEO', 45, '222', 'DOIS', 'b', 1)])).fornecedores.length === 2);
/* ══ ESTES TRÊS COBRAM O DESVIO, E NÃO O TEXTO — E É POR ISSO QUE ELES EXISTEM ═══════════════
   A primeira versão desta suíte cobrava só que as frases ESTIVESSEM no arquivo. A `muta_b35`
   trocou `if(g.disperso)` por `if(false)` e a catraca ficou VERDE: o aviso continuava escrito,
   guardado dentro de um ramo que nunca roda. Texto presente não prova caminho tomado — é a
   diferença entre a tela ter a frase e a tela dizer a frase. */
ok('*** e a tela avisa NO LUGAR da lideranca, nao ao lado dela ***',
  /preços dispersos demais para dizer quem ganha mais/.test(BLOCO)
  && /juntar produtos diferentes com o mesmo nome/.test(BLOCO));
ok('*** e o aviso e alcancado pelo `g.disperso` — nao e frase guardada num ramo morto ***',
  /if\(g\.disperso\)\{/.test(BLOCO)
  && BLOCO.indexOf('if(g.disperso){') < BLOCO.indexOf('preços dispersos demais'), BLOCO.length);
ok('...e ele imprime a RAZAO medida, para ser conferivel em vez de opiniao',
  /Number\(g\.razao\)/.test(BLOCO) && /entre o menor e o maior/.test(BLOCO));
ok('*** o disperso e um DESVIO do caminho normal: os outros dois ramos ficam no `else` ***',
  /\} else if\(g\.umFornecedor\)\{/.test(BLOCO) && /\} else \{/.test(BLOCO));
/* A LISTA CORTA EM CINCO, E CORTE EM SILÊNCIO É O DEFEITO QUE ESTA CASA PERSEGUE DESDE O
   `limit=3000`: cinco nomes numa tela parecem "os fornecedores", e não "cinco dos dezoito". */
ok('*** a lista mostra no maximo 5 e CONTA quantos ficaram de fora ***',
  /slice\(0, 5\)/.test(BLOCO) && /const resto = g\.fornecedores\.length - mostra\.length/.test(BLOCO)
  && /e mais ' \+ resto/.test(BLOCO), BLOCO.slice(-400));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 5. O CNPJ NÃO VAI PARA A TELA — NENHUMA DAS DUAS
// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n-- 5. o nome sai; o CNPJ fica no dado --');
ok('*** o bloco do Negocios NAO imprime `resultado_cnpj` nem `.cnpj` ***',
  !!BLOCO && !/resultado_cnpj/.test(BLOCO) && !/\.cnpj\b/.test(BLOCO), BLOCO.slice(0, 120));
/* A PROPOSTA É O CASO QUE A CAIXA NOMEIA: "nome de concorrente em destaque numa tela de proposta
   é convite para o uso errado". Lá não entra nem o nome — e o papel dela está congelado. */
ok('*** a Proposta NAO ganhou quem-ganhou nenhum (nem nome, nem CNPJ) ***',
  !/quemGanhou/.test(GIO), (GIO.match(/quemGanhou/g) || []).length);
ok('...e o nome do vencedor SAI no Negocios, que e onde a pergunta nasce',
  /esc\(it\.resultado_vencedor\)/.test(BLOCO));
/* ISTO AQUI É UMA CORREÇÃO, E ELA VALE UM ASSERT PRÓPRIO: até a B34 a linha escrevia a expressão
   literal "o vencedor" quando o órgão TINHA publicado o nome. O dado estava lá (3.475 nomes, zero
   em branco) e a tela gastava o espaço para informar que existe um vencedor. */
ok('*** e a tela nao escreve mais a palavra "o vencedor" no lugar do nome ***',
  !/\? 'o vencedor'/.test(BLOCO));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 6. NÃO SEI ≠ NÃO HÁ, E O ESTADO VAZIO É FRASE
// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n-- 6. os tres estados --');
ok('*** indice nao carregado devolve `null` — e NUNCA vira "nao ha" ***',
  T.quemGanhou({ descricao: 'CANETA' }, null) === null);
ok('carregado e sem resultado devolve n:0 com a chave, e nao null',
  (() => { const g = T.quemGanhou({ descricao: 'ZZZ' }, idx([L('CANETA', 10, '111', 'UM', 'a', 1)]));
    return g && g.n === 0 && g.chave === 'ZZZ' && Array.isArray(g.fornecedores); })());
ok('*** o vazio e uma FRASE, e ela diz que falta o preco E quem ganhou ***',
  /ainda não temos resultado para este item/.test(BLOCO) && /nem o preço nem quem ganhou/.test(BLOCO));
ok('...e nao e R$ 0,00 nem um travessao solto',
  !/R\$\s*0,00/.test(BLOCO) && !/>\s*—\s*</.test(BLOCO));
ok('o proprio item continua fora da conta (`ignorar`), como no avaliar',
  T.quemGanhou({ descricao: 'CANETA', ignorar: { numero_controle: 'a', numero_item: '1' } },
    idx([L('CANETA', 10, '111', 'UM', 'a', 1)])).n === 0);
ok('e o truncamento viaja junto com a resposta',
  T.quemGanhou({ descricao: 'CANETA' },
    T.indexa([L('CANETA', 10, '111', 'UM', 'a', 1)], { total: 99, truncado: true })).truncado === true);
/* O TETO DA CONSULTA JÁ TINHA SIDO ESTOURADO SEM NINGUÉM VER: a A40 levou os resultados de 192
   para 3.475 e o `limit` era 2.000. O mecanismo avisava; ninguém lia o aviso de um recurso que
   parecia funcionar. Este assert existe para o número não ficar para trás outra vez calado. */
ok('*** o teto da consulta cabe no dado de hoje (3.475 resultados) ***',
  (() => { const m = NEG.match(/const HOMOL_TETO = (\d+);/); return m && Number(m[1]) >= 3475; })(),
  (NEG.match(/const HOMOL_TETO = (\d+);/) || [])[1]);

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;

