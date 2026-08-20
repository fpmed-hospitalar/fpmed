/* ════════════════════════════════════════════════════════════════════════════════════════════
   SUITE testa_ata_entrada — A CATRACA DO CAMINHO DE ENTRADA (fatia B31, 20/08/2026)

   Ela guarda cinco promessas, e a primeira delas não é uma opinião: é um defeito que foi MEDIDO
   no banco, inserindo de verdade e lendo o que voltou.

   ══ 1. `confirmacao: 0` EM CADA LINHA, E POR QUÊ ═════════════════════════════════════════════
   A `v_negocio_itens_ganhos` mostra só a confirmação MAIS ALTA. Medido em 20/08, no negócio de
   ensaio 2569:
     · OMITIR a coluna (o que a tela da B12 fazia) deixa o `default 1`, a trigger nunca dispara, e
       uma correção futura entra também como `1` — a view devolve a lista VELHA e a NOVA
       misturadas. O rastro está morto e o sintoma é uma tabela com o dobro dos itens.
     · MANDAR `0` com a trigger antiga fazia ela disparar LINHA A LINHA: um lote de 3 saiu **2, 3
       e 4**, e a view devolveu **UMA** linha. Marcar 3 itens e a tela mostrar 1, sem erro.
   A trigger foi consertada (o número passou a ser decidido uma vez por transação) e a tela manda
   `0`. Os dois lados são cobrados aqui.

   ══ 2. A LISTA SOBE COMPLETA, E NÃO O QUE MUDOU ══════════════════════════════════════════════
   Consequência direta do item 1: uma gravação parcial apagaria da VISTA todo item anterior, sem
   erro nenhum, com o rastro intacto no banco para provar que eles existiam.

   ══ 3. `null` É "NÃO INFORMADO"; `0` É UMA AFIRMAÇÃO ═════════════════════════════════════════
   Item marcado sem preço entra com `valor_unitario` e `total` nulos — nunca R$ 0,00, que diria
   "ganhei este item de graça". É a lei da casa, e aqui ela vira contrato.

   ══ 4. A ORIGEM DE QUEM NINGUÉM TOCOU NÃO É REBAIXADA A "digitado" ═══════════════════════════
   "Número lido por IA" e "número digitado" erram de jeitos diferentes — é o motivo de a coluna
   existir. Regravar a lista por este caminho não pode AFIRMAR que alguém digitou o que a IA leu.

   ══ 5. A QUANTIDADE DO EDITAL É SUGESTÃO, E SUGESTÃO PRECISA DE UM CLIQUE ════════════════════
   Ela é dado publicado sobre a COMPRA: ganhar o item 7 não quer dizer ganhar as 200 unidades
   dele. Copiar sozinho seria a tela digitando pelo usuário o número que decide o faturamento.

     node tests/testa_ata_entrada.js
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { semComentario } = require('../tools/regua_visual.js');
const RAIZ = path.join(__dirname, '..');
const R = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');

const semComentarioSQL = s => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const NEG = semComentario(R('fpmed_negocios.html'));
const MOTOR = semComentario(R('fpmed_ata_entrada.js'));
const DDL = semComentarioSQL(R('ddl/entrada_da_ata.sql'));
const SW = R('sw.js');
const E = require('../fpmed_ata_entrada.js');

/* O PEDAÇO DA TELA QUE É DESTA FATIA. Recorte, e não o arquivo inteiro — cobrar do arquivo todo
   daria vermelho sobre código de outra fatia, que é a forma mais rápida de uma catraca ser
   desligada. */
const ini = NEG.indexOf('let MARCAS = {};');
const fim = NEG.indexOf('async function anexarAta(id){');
const TRECHO = (ini >= 0 && fim > ini) ? NEG.slice(ini, fim) : '';

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 320) + ']' : '')); } n++; };
console.log('SUITE testa_ata_entrada — o codigo acabou; o dado nao comecou\n');

// Um item do edital, no formato exato que a `carregarItensEdital` devolve.
const IT = (numero, qtd, ref, extra) => Object.assign({
  numero_item: numero, descricao: 'item ' + numero, unidade: 'UN',
  quantidade: qtd, valor_unitario_ref: ref,
  resultado_vencedor: null, resultado_cnpj: null, resultado_valor_unit: null,
  resultado_quantidade: null, resultado_situacao: null }, extra || {});
const GANHO = (item, qtd, unit, extra) => Object.assign({
  item_n: item, descricao: 'item ' + item, quantidade: qtd, valor_unitario: unit,
  total: (qtd != null && unit != null) ? qtd * unit : null,
  marca: null, marca_origem: null, origem: 'ia', confirmacao: 3 }, extra || {});
const MEU = '47.110.418/0001-15';

// ── 1. OS CANDIDATOS SAEM DO EDITAL, E NÃO DO RESULTADO ─────────────────────────────────────
console.log('-- 1. a lista de marcar e a do EDITAL --');
{
  /* MEDIDO NO BANCO: dos 192 itens com resultado publicado no único certame desta base, ZERO
     estão sob o nosso CNPJ. Uma lista feita do resultado nasceria VAZIA aqui. */
  const c = E.candidatos([IT('1', 200, 38.2), IT('2', 50, 8.04)], [], MEU);
  ok('*** os dois itens do edital viram candidatos, mesmo sem resultado publicado nenhum ***',
    c.length === 2, c.length);
  ok('e o estado deles e "o portal nao publicou resultado" (nao e "nao ganhei")',
    c[0].estado === 'sem_resultado' && c[1].estado === 'sem_resultado',
    c.map(x => x.estado));
  ok('a quantidade do edital vem como REFERENCIA, com nome proprio',
    c[0].qtdEdital === 200 && c[0].quantidade === null, [c[0].qtdEdital, c[0].quantidade]);
  ok('*** e o preco de referencia do edital NAO vira o preco marcado ***',
    c[0].refEdital === 38.2 && c[0].unitario === null, [c[0].refEdital, c[0].unitario]);
}
{
  const c = E.candidatos([
    IT('1', 10, 5, { resultado_cnpj: '47110418000115', resultado_valor_unit: 4 }),
    IT('2', 10, 5, { resultado_cnpj: '05191550000230', resultado_valor_unit: 3, resultado_vencedor: 'OUTRA LTDA' }),
  ], [], MEU);
  ok('*** o item publicado sob o NOSSO CNPJ e reconhecido como nosso ***',
    c[0].estado === 'meu_publicado', c[0].estado);
  ok('*** e o publicado sob OUTRO CNPJ diz isso, sem impedir a marcacao ***',
    c[1].estado === 'de_outro' && c[1].resultadoVencedor === 'OUTRA LTDA', c[1].estado);
}
{
  const c = E.candidatos([IT('1', 10, 5)], [GANHO('1', 7, 4)], MEU);
  ok('o item ja confirmado nasce MARCADO, com os numeros que ja estao no banco',
    c[0].marcado === true && c[0].quantidade === 7 && c[0].unitario === 4,
    [c[0].marcado, c[0].quantidade, c[0].unitario]);
  ok('e o estado dele diz que ja esta na lista', c[0].estado === 'confirmado', c[0].estado);
}
{
  // A CHAVE É TEXTO DOS DOIS LADOS, e é a mesma decisão da `ata_saldo.sql`: número aqui e texto
  // lá fariam "07" e "7" serem itens diferentes na ata do mesmo pregão.
  const c = E.candidatos([IT(7, 10, 5)], [GANHO('7', 3, 2)], MEU);
  ok('*** o item 7 numerico casa com o "7" texto do banco ***',
    c[0].marcado === true && c[0].item === '7', [c[0].item, c[0].marcado]);
}

// ── 2. A GRAVAÇÃO: `confirmacao: 0` E A LISTA COMPLETA ──────────────────────────────────────
console.log('\n-- 2. a gravacao, e o defeito que foi medido no banco --');
{
  const c = E.candidatos([IT('1', 10, 5), IT('2', 20, 6), IT('3', 30, 7)], [], MEU);
  const r = E.linhasParaGravar(c, [
    { item: '1', marcado: true, quantidade: 4, unitario: 3 },
    { item: '2', marcado: true, quantidade: 2, unitario: null },
    { item: '3', marcado: false },
  ], 'a@b.c');
  ok('sobem so os itens marcados', r.linhas.length === 2, r.linhas.map(l => l.item_n));
  ok('*** TODA linha leva `confirmacao: 0` — "banco, escolha" ***',
    r.linhas.every(l => l.confirmacao === 0), r.linhas.map(l => l.confirmacao));
  ok('*** item marcado SEM preco entra com preco `null`, nunca zero ***',
    r.linhas[1].valor_unitario === null, r.linhas[1].valor_unitario);
  ok('*** e o total dele e `null` tambem (R$ 0,00 diria "ganhei de graca") ***',
    r.linhas[1].total === null, r.linhas[1].total);
  ok('o total so existe com os dois numeros: 4 x 3 = 12', r.linhas[0].total === 12, r.linhas[0].total);
  ok('a linha sai marcada como digitada por gente',
    r.linhas.every(l => l.origem === 'digitado'), r.linhas.map(l => l.origem));
  ok('e com o nome de quem digitou', r.linhas[0].confirmado_por === 'a@b.c', r.linhas[0].confirmado_por);
  ok('a marca NUNCA e inventada por este caminho',
    r.linhas.every(l => l.marca === null && l.marca_origem === null), r.linhas.map(l => l.marca));
}
{
  /* A LISTA SOBE COMPLETA. Marcar um item novo num negócio que já tem dois confirmados tem de
     subir TRÊS linhas — a view mostra só a confirmação mais alta, e as duas antigas sumiriam. */
  const c = E.candidatos([IT('1', 10, 5), IT('2', 20, 6), IT('3', 30, 7)],
                         [GANHO('1', 4, 3), GANHO('2', 5, 2)], MEU);
  const r = E.linhasParaGravar(c, [{ item: '3', marcado: true, quantidade: 1, unitario: 1 }], 'a@b.c');
  ok('*** marcar 1 item novo sobe as 3 linhas, e nao 1 (a view mostra so a confirmacao mais alta) ***',
    r.linhas.length === 3, r.linhas.map(l => l.item_n));
  ok('*** e a origem das DUAS que ninguem tocou continua "ia" ***',
    r.linhas[0].origem === 'ia' && r.linhas[1].origem === 'ia' && r.linhas[2].origem === 'digitado',
    r.linhas.map(l => l.origem));
}
{
  const c = E.candidatos([IT('1', 10, 5)], [GANHO('1', 4, 3)], MEU);
  const r = E.linhasParaGravar(c, [{ item: '1', marcado: true, quantidade: 9, unitario: 3 }], 'a@b.c');
  ok('*** mexer no numero de uma linha lida por IA rebaixa a origem dela para "digitado" ***',
    r.linhas[0].origem === 'digitado' && r.linhas[0].quantidade === 9, r.linhas[0]);
}
{
  const c = E.candidatos([IT('1', 10, 5)], [GANHO('1', 4, 3)], MEU);
  const r = E.linhasParaGravar(c, [{ item: '1', marcado: true, quantidade: 4, unitario: 3 }], 'a@b.c');
  ok('e nao mudar nada e reconhecido como nao-mudanca (o carimbo nao se aplica sozinho)',
    r.mudou === false, r.mudou);
}
{
  const c = E.candidatos([IT('1', 10, 5)], [GANHO('1', 4, 3)], MEU);
  const r = E.linhasParaGravar(c, [{ item: '1', marcado: false }], 'a@b.c');
  ok('*** desmarcar TUDO sobe uma lista vazia — e isso e uma afirmacao, nao um engano ***',
    r.linhas.length === 0 && r.mudou === true, [r.linhas.length, r.mudou]);
}
{
  const c = E.candidatos([IT('1', 10, 5), IT('2', 10, 5)], [], MEU);
  const r = E.linhasParaGravar(c, [
    { item: '1', marcado: true, quantidade: -5, unitario: 3 },
    { item: '2', marcado: true, quantidade: 1, unitario: -1 },
  ], 'a@b.c');
  ok('*** numero negativo e recusado E DIZ QUAL LINHA (numa lista de 195, recusar sem apontar e recusar sem dizer nada) ***',
    r.erros.length === 2 && /item 1/.test(r.erros[0]) && /item 2/.test(r.erros[1]), r.erros);
}
{
  /* O QUE NÃO É RECUSADO, E É DECISÃO. Preço acima da referência e quantidade acima da do edital
     acontecem de verdade; digitação recusada vira anotação no caderno de alguém, fora do
     sistema. É a mesma lei da B30. */
  const c = E.candidatos([IT('1', 10, 5)], [], MEU);
  const r = E.linhasParaGravar(c, [{ item: '1', marcado: true, quantidade: 999, unitario: 900 }], 'a@b.c');
  ok('*** quantidade maior que a do edital e preco acima da referencia PASSAM (a tela mostra, nao recusa) ***',
    r.erros.length === 0 && r.linhas[0].quantidade === 999, [r.erros, r.linhas[0].quantidade]);
}
{
  const c = E.candidatos([IT('1', null, null)], [], MEU);
  const r = E.linhasParaGravar(c, [{ item: '1', marcado: true, quantidade: null, unitario: null }], 'a@b.c');
  ok('marcar sem numero nenhum e legitimo: "este item e meu" ja e informacao',
    r.linhas.length === 1 && r.linhas[0].quantidade === null && r.linhas[0].total === null, r.linhas[0]);
}
{
  /* ══ O CAMPO VAZIO CHEGA COMO STRING VAZIA, E NÃO COMO `null` ═══════════════════════════════
     Achado pela `muta_b31`: a suíte ficava VERDE com `num('')` devolvendo `0`. O `value` de um
     `<input type=number>` esvaziado é `''` — nunca `null` —, então este é o caminho REAL pelo qual
     um campo em branco chega ao motor, e era justamente o que ninguém media. Um `0` aqui grava
     "ganhei este item de graça" com o nome de quem só apagou o que tinha digitado. */
  const c = E.candidatos([IT('1', 10, 5), IT('2', 10, 5)], [], MEU);
  const r = E.linhasParaGravar(c, [
    { item: '1', marcado: true, quantidade: '', unitario: '' },
    { item: '2', marcado: true, quantidade: '4', unitario: '2,5' },
  ], 'a@b.c');
  ok('*** campo esvaziado (string vazia, que e o que o input devolve) vira `null`, e nunca 0 ***',
    r.linhas[0].quantidade === null && r.linhas[0].valor_unitario === null && r.linhas[0].total === null,
    r.linhas[0]);
  ok('e o campo com numero em texto vira numero de verdade', r.linhas[1].quantidade === 4, r.linhas[1].quantidade);
  ok('texto que nao e numero vira `null`, e nao NaN (NaN no banco vira erro ou zero)',
    r.linhas[1].valor_unitario === null, r.linhas[1].valor_unitario);
}
{
  /* A MARCA NUNCA É DEDUZIDA. Escapou da primeira versão desta suíte: o vencedor publicado é o
     nome da EMPRESA que ganhou, não a marca do produto — e preenchê-la por dedução é chute num
     campo que decide habilitação técnica e faturamento. */
  const c = E.candidatos([IT('1', 10, 5, { resultado_vencedor: 'FARMACE IND LTDA',
    resultado_cnpj: '05191550000230', resultado_valor_unit: 4 })], [], MEU);
  const r = E.linhasParaGravar(c, [{ item: '1', marcado: true, quantidade: 1, unitario: 1 }], 'a@b.c');
  ok('*** a marca NAO e deduzida do vencedor publicado (aquilo e a empresa, nao a marca) ***',
    r.linhas[0].marca === null && r.linhas[0].marca_origem === null, r.linhas[0]);
}

// ── 3. OS TOTAIS DIZEM O QUE NÃO SABEM ──────────────────────────────────────────────────────
console.log('\n-- 3. o total diz quantas linhas ficaram de fora dele --');
{
  const c = E.candidatos([IT('1', 10, 5), IT('2', 10, 5), IT('3', 10, 5)], [], MEU);
  const t = E.totaisMarcacao(c, [
    { item: '1', marcado: true, quantidade: 2, unitario: 3 },
    { item: '2', marcado: true, quantidade: 5, unitario: null },
    { item: '3', marcado: true, quantidade: null, unitario: 4 },
  ]);
  ok('3 marcados', t.marcados === 3, t.marcados);
  ok('*** so 1 entrou na soma, e o contador diz isso ***', t.comTotal === 1, t.comTotal);
  ok('e o total e 6 (2 x 3), sem somar o desconhecido como zero', t.total === 6, t.total);
  ok('1 sem preco e 1 sem quantidade, contados separadamente (pedem acoes diferentes)',
    t.semPreco === 1 && t.semQtd === 1, [t.semPreco, t.semQtd]);
}
{
  const c = E.candidatos([IT('1', 10, 5)], [], MEU);
  const t = E.totaisMarcacao(c, [{ item: '1', marcado: true, quantidade: 3, unitario: null }]);
  /* ══ O CONTADOR QUE PARECE SUPÉRFLUO E É A REGRA INTEIRA — a lição da B30, de novo ═══════════
     Com `comTotal === 0` a tela NÃO imprime o total: `0` ali se leria como "ganhei tudo isso por
     nada". Sem o contador, "somou zero" e "não havia o que somar" são a mesma tela. */
  ok('*** um marcado sem preco: `total` e 0 mas `comTotal` e 0, e e o contador que manda a tela se calar ***',
    t.total === 0 && t.comTotal === 0, [t.total, t.comTotal]);
}

// ── 4. A CÓPIA DAS QUANTIDADES DO EDITAL ────────────────────────────────────────────────────
console.log('\n-- 4. a sugestao do edital precisa de um clique, e nao apaga digitacao --');
{
  const c = E.candidatos([IT('1', 200, 5), IT('2', 50, 5), IT('3', null, 5)], [], MEU);
  const r = E.copiaQuantidades(c, [
    { item: '1', marcado: true, quantidade: null, unitario: null },
    { item: '2', marcado: true, quantidade: 30, unitario: null },
    { item: '3', marcado: true, quantidade: null, unitario: null },
  ]);
  const por = {}; r.marcas.forEach(m => { por[m.item] = m; });
  ok('a quantidade vazia recebe a do edital', por['1'].quantidade === 200, por['1'].quantidade);
  ok('*** e a que alguem DIGITOU nao e sobrescrita (quem escreveu 30 onde o edital diz 50 tinha um motivo) ***',
    por['2'].quantidade === 30, por['2'].quantidade);
  ok('item sem quantidade no edital fica vazio, e o contador diz quantos',
    por['3'].quantidade === null && r.semQtdNoEdital === 1, [por['3'].quantidade, r.semQtdNoEdital]);
  ok('copiou 1', r.copiadas === 1, r.copiadas);
}
{
  const c = E.candidatos([IT('1', 200, 5)], [], MEU);
  const r = E.copiaQuantidades(c, [{ item: '1', marcado: false }]);
  ok('*** e ela NAO toca no que nao esta marcado (195 itens preenchidos apagam a escolha de quem marcou) ***',
    r.copiadas === 0 && r.marcas.length === 0, [r.copiadas, r.marcas.length]);
}

// ── 5. ARQUIVAR A ATA ───────────────────────────────────────────────────────────────────────
console.log('\n-- 5. arquivar, e nao apagar --');
{
  ok('*** sem motivo, o arquivamento e RECUSADO ***',
    E.pedidoArquivar('', '', 'a@b.c', '2026-08-20T00:00:00Z').ok === false);
  ok('"outro" sem texto tambem e recusado',
    E.pedidoArquivar('outro', '   ', 'a@b.c', '2026-08-20T00:00:00Z').ok === false);
  const r = E.pedidoArquivar('outro', 'a prefeitura cancelou', 'a@b.c', '2026-08-20T00:00:00Z');
  ok('com "outro" e texto, o motivo gravado e o TEXTO (e nao a palavra "outro")',
    r.ok && r.campos.arquivado_motivo === 'a prefeitura cancelou', r.campos);
  const r2 = E.pedidoArquivar('registro de teste', '', 'a@b.c', '2026-08-20T00:00:00Z');
  ok('*** o pedido leva bandeira, carimbo, motivo E autor — os quatro ***',
    r2.campos.arquivado === true && r2.campos.arquivado_em === '2026-08-20T00:00:00Z'
    && r2.campos.arquivado_motivo === 'registro de teste' && r2.campos.arquivado_por === 'a@b.c', r2.campos);
  ok('*** e o pedido NAO tem DELETE nem apaga campo nenhum ***',
    Object.keys(r2.campos).every(k => /^arquivado/.test(k)), Object.keys(r2.campos));
}
{
  const d = E.pedidoDesarquivar('2026-08-21T00:00:00Z');
  ok('*** desarquivar limpa o CARIMBO (e ele que a v_atas_vigencia filtra) ***',
    d.arquivado_em === null && d.arquivado === false, d);
  ok('*** e NAO apaga o motivo nem o autor: quem desfaz um ato nao desfaz o fato de ter feito ***',
    !('arquivado_motivo' in d) && !('arquivado_por' in d), Object.keys(d));
  ok('e a terceira data fica gravada', d.desarquivado_em === '2026-08-21T00:00:00Z', d.desarquivado_em);
}

// ── 6. A TELA NÃO REIMPLEMENTA A CONTA ──────────────────────────────────────────────────────
console.log('\n-- 6. a conta mora no motor, e a tela so pergunta --');
ok('a tela carrega o motor', /<script src="fpmed_ata_entrada\.js"><\/script>/.test(R('fpmed_negocios.html')));
ok('*** a tela chama `linhasParaGravar` do motor ***', /E\.linhasParaGravar\(/.test(TRECHO));
/* ══ ESTE ASSERT COBRAVA "PELO MENOS UM", E ISSO NÃO É COBRAR NADA ═══════════════════════════
   Achado pela `muta_b31`: `E.totaisMarcacao(` aparece DUAS vezes nesta tela — no desenho do quadro
   e no rodapé que acompanha a digitação — e a suíte ficava verde com a PRIMEIRA trocada por uma
   conta escrita à mão. Um `.test()` diz "existe em algum lugar"; o defeito estava no outro lugar.
   >>> A REGRA GERAL, e ela vale para toda catraca de recorte: quando a promessa é *"a conta mora
       no motor"*, o que se cobra é a CONTAGEM, não a existência. */
ok('*** e `candidatos`, e `copiaQuantidades` ***',
  /E\.candidatos\(/.test(NEG) && /E\.copiaQuantidades\(/.test(TRECHO));
ok('*** e `totaisMarcacao` nos DOIS lugares que mostram o total (o quadro e o rodape que acompanha a digitacao) ***',
  (TRECHO.match(/E\.totaisMarcacao\(/g) || []).length === 2,
  (TRECHO.match(/E\.totaisMarcacao\(/g) || []).length);
ok('*** a tela NAO monta a linha do banco por conta propria (nada de `item_n:` solto nela) ***',
  !/item_n:\s*/.test(TRECHO), (TRECHO.match(/item_n:.*/) || [])[0]);
ok('*** e nao calcula total nenhum: nenhuma multiplicacao de quantidade por preco na tela ***',
  !/quantidade\s*\*\s*(unit|valor)/.test(TRECHO));
ok('sem o motor, o quadro NAO nasce (em vez de nascer com a conta feita na tela)',
  /if\(!E\)\{ box\.innerHTML = ''; return; \}/.test(TRECHO));

// ── 7. O QUE A TELA DIZ, E O QUE ELA NÃO DEIXA DE DIZER ─────────────────────────────────────
console.log('\n-- 7. os quatro estados e os avisos que decidem --');
/* ══ ESTES DOIS ASSERTS NASCERAM VERMELHOS, E O DEFEITO ERA DELES ═══════════════════════════
   Escritos como uma frase inteira, eles atravessavam uma emenda de string (`'…lista inteira</b> '
   + 'como uma confirmação nova…'`) e reprovavam código correto. Assert que depende de ONDE a
   string foi quebrada é assert que fica vermelho no dia em que alguém reindenta o arquivo — e
   vermelho falso ensina a desligar catraca mais rápido que catraca que nunca acende.
   >>> O CONSERTO NÃO É AFROUXAR: é cobrar as duas metades da promessa separadamente, cada uma
       com palavras que só existem nesta frase. */
ok('*** o aviso de que gravar SUBSTITUI a lista esta escrito na tela ***',
  /lista inteira<\/b>/.test(TRECHO) && /como uma confirmação nova/.test(TRECHO));
ok('e que a anterior nao se apaga', /não se apaga/.test(TRECHO));
ok('*** o estado ERRO diz qual foi e nao vira "nao tem itens" ***',
  /Não consegui ler os itens do certame/.test(TRECHO)
  && /dizer que este certame não tenha itens/.test(TRECHO));
ok('*** o estado VAZIO reusa a `faltaDoResultado`, e nao escreve uma quinta frase ***',
  /faltaDoResultado\(n\)/.test(TRECHO));
ok('o estado CARREGANDO da aba existe (a lista chega depois e o quadro repinta)',
  /pintaMarcarGanhos\(id\);/.test(NEG.slice(NEG.indexOf('async function carregarItensEdital'))));
/* MESMO ACHADO DA `muta_b31`, MESMA FORMA: o total é impresso em DOIS lugares (o quadro e o
   rodapé da digitação), e cobrar "existe um" deixava o outro livre para imprimir R$ 0,00. */
ok('*** o total se cala quando nenhuma linha entrou nele — nos DOIS lugares que o imprimem ***',
  (TRECHO.match(/t\.comTotal \? brl\(t\.total\) : '<span class="sd-nao">sem preço informado<\/span>'/g) || []).length === 2,
  (TRECHO.match(/brl\(t\.total\)/g) || []).length);
ok('*** a tela diz, em voz alta, que este caminho e DE GRACA (o outro cobra) ***',
  /Este caminho é de graça/.test(TRECHO) && /cobra por leitura/.test(TRECHO));
ok('*** e que o que entra por aqui sai marcado "informado por voce" ***',
  /informado por você/.test(TRECHO));
ok('*** desmarcar tudo e gravar pede confirmacao (o resultado parece erro de carregamento) ***',
  /!r\.linhas\.length && !confirm\(/.test(TRECHO));
ok('*** a tela confere o EFEITO (quantas linhas voltaram), e nao o codigo HTTP ***',
  /volta\.length === r\.linhas\.length/.test(TRECHO));
ok('a referencia do edital fica FORA do campo, em cinza',
  /class="mk-ref">\$\{c\.qtdEdital/.test(TRECHO) && /class="mk-ref">\$\{c\.refEdital/.test(TRECHO));
/* ══ O ASSERT COBRAVA UMA REDAÇÃO, E O DEFEITO TEM MIL ═══════════════════════════════════════
   Ele proibia literalmente `value="${c.refEdital}"`. A `muta_b31` escreveu
   `value="${unit == null ? (c.refEdital || '') : unit}"` — o MESMO defeito, com outra redação — e
   a suíte ficou verde. É a lição de sempre desta casa dita numa terceira forma: **cobrar a
   estrutura certa é mais forte que proibir uma redação errada.** Aqui a estrutura é exata: os dois
   campos só podem nascer com o valor que já estava gravado, ou vazios.
   >>> E ISSO NÃO É COSMÉTICA: a quantidade é do EDITAL (o que o órgão vai comprar) e o preço é o
       ESTIMADO. Nenhum dos dois é afirmação sobre o que EU ganhei; postos dentro do campo, viram. */
ok('*** o campo da quantidade nasce com o que ja estava gravado, ou VAZIO — nunca com a do edital ***',
  /value="\$\{qtd == null \? '' : qtd\}"/.test(TRECHO), (TRECHO.match(/id="mk-qtd[\s\S]{0,220}/) || [])[0]);
ok('*** e o campo do preco, com o meu preco gravado ou VAZIO — nunca com o estimado do edital ***',
  /value="\$\{unit == null \? '' : unit\}"/.test(TRECHO), (TRECHO.match(/id="mk-un[\s\S]{0,220}/) || [])[0]);
/* O `!ehGestor()` aparece em DOIS quadros desta fatia (marcar e arquivar). Cobrar o `if` solto
   deixava um dos dois virar público sem acender nada — achado da `muta_b31`. O que se cobra é a
   FRASE de cada um, que é o que o usuário lê e o que distingue os dois lugares. */
ok('marcar item e acao de gestor', /marcar itens ganhos é ação de gestor/.test(TRECHO));
ok('e arquivar tambem', (TRECHO.match(/arquivar é ação de gestor/g) || []).length === 2,
  (TRECHO.match(/arquivar é ação de gestor/g) || []).length);
/* ══ O SELO DE CADA LINHA, E POR QUE ELE É REGRA E NÃO ENFEITE ═══════════════════════════════
   Ele impede a tela de mentir nos DOIS sentidos. "publicado sob outro CNPJ" não impede marcar — a
   publicação pode estar sob o CNPJ da matriz, ou estar errada, e a confirmação de gente manda
   sobre a publicação (lei da B5). O que o selo faz é obrigar quem marca a SABER o que está
   contrariando. Sem ele, marcar um item que o portal deu a outra empresa vira um clique inocente. */
ok('*** os quatro estados tem selo proprio na linha, e o "sob outro CNPJ" e um deles ***',
  /já na sua lista/.test(TRECHO) && /o PNCP já publicou como seu/.test(TRECHO)
  && /publicado sob outro CNPJ/.test(TRECHO) && /o portal não publicou resultado/.test(TRECHO));
ok('e a linha do "de outro" diz A QUEM o portal deu', /o portal deu a/.test(TRECHO));
/* ══ DIGITAR NÃO REPINTA A TABELA, E ISSO É CORRETUDE, NÃO CONFORTO ══════════════════════════
   Repintar a cada tecla devolve o cursor ao fim do campo e a rolagem ao topo — numa lista de 195
   itens, quem digita "1250" acaba com "0521" em outra linha. É o defeito clássico de campo
   controlado, e ele não levanta erro nenhum. */
/* O CORPO DA FUNÇÃO É RECORTADO ATÉ A PRÓXIMA `function`, e não por um `[\s\S]*?` solto: a versão
   preguiçosa atravessava o fim da `mkCampo` e casava com o `pintaMarcarGanhos` da `mkCopiaEdital`,
   três funções abaixo — assert vermelho sobre código certo, que é o jeito mais rápido de alguém
   desligar uma catraca. Regex que não sabe onde a função acaba não sabe do que está falando. */
{
  const iM = TRECHO.indexOf('function mkCampo(id, item, qual, valor){');
  const corpoCampo = iM >= 0 ? TRECHO.slice(iM, TRECHO.indexOf('\nfunction ', iM + 10)) : '';
  const iN = TRECHO.indexOf('function mkMarca(id, item, ligado){');
  const corpoMarca = iN >= 0 ? TRECHO.slice(iN, TRECHO.indexOf('\nfunction ', iN + 10)) : '';
  ok('*** digitar NAO repinta a tabela (o cursor voltaria pro fim do campo a cada tecla) ***',
    corpoCampo.length > 100 && !/pintaMarcarGanhos\(/.test(corpoCampo), corpoCampo.slice(0, 300));
  /* ══ A LEI DA CASA TEM DOIS PORTÕES, E ESTE FICAVA ABERTO ════════════════════════════════════
     O motor já era cobrado (`''` vira `null`), mas a TELA converte antes: quem apaga o que digitou
     passa por esta linha, e não pela do motor. A `muta_b31` trocou o `null` por `0` aqui e a suíte
     ficou verde — o campo esvaziado gravaria "ganhei este item de graça", com o nome de quem só
     apagou. Uma lei cobrada em um só dos dois lugares por onde o dado passa é meia lei. */
  ok('*** campo esvaziado na TELA volta a "nao informado", e nunca a zero ***',
    /m\[qual\] = s === '' \? null :/.test(corpoCampo), corpoCampo.slice(0, 300));
  ok('e texto que nao e numero tambem vira `null` na tela, e nao NaN',
    /isFinite\(x\) \? x : null/.test(corpoCampo));
  ok('mas MARCAR repinta (o total muda, a linha muda de fundo, os campos destravam)',
    /pintaMarcarGanhos\(id\);/.test(corpoMarca), corpoMarca.slice(0, 200));
}
ok('*** a caixinha de marcar tem `aria-label` (nao e um `div` fingindo botao) ***',
  /aria-label="marcar o item \$\{esc\(c\.item\)\} como ganho por mim"/.test(TRECHO));

// ── 8. O ARQUIVAR NA TELA ───────────────────────────────────────────────────────────────────
console.log('\n-- 8. o arquivar na tela --');
ok('a aba tem o lugar do arquivar', /id="ata-arquivo"/.test(R('fpmed_negocios.html')));
ok('*** a tela usa `pedidoArquivar` do motor (a recusa do motivo nao e reescrita aqui) ***',
  /E\.pedidoArquivar\(/.test(TRECHO));
ok('*** e `pedidoDesarquivar` ***', /E\.pedidoDesarquivar\(/.test(TRECHO));
ok('*** a tela NAO chama DELETE em lugar nenhum desta fatia ***',
  !/method:\s*['"]DELETE['"]/.test(TRECHO));
ok('a ata arquivada mostra o carimbo com data, motivo e autor',
  /arquivada em/.test(TRECHO) && /motivo:/.test(TRECHO) && /por/.test(TRECHO));
ok('*** e a tela avisa que desarquivar NAO apaga o carimbo ***',
  /não apaga o carimbo acima/.test(TRECHO));
ok('*** e que nada foi apagado (o saldo, os itens e os documentos continuam) ***',
  /nada foi apagado/.test(TRECHO));
/* OS DOIS GESTOS AVISAM A LISTA DA MANHÃ, e cobrar "existe uma chamada" deixava um dos dois
   mudo — achado da `muta_b31`. Arquivar sem avisar deixa a ata arquivada no topo da tela até
   alguém recarregar a página; desarquivar sem avisar esconde uma ata que voltou a ter prazo. */
ok('arquivar E desarquivar avisam a lista da manha na mesma hora',
  (TRECHO.match(/carregarVaiEmbora\(\);/g) || []).length === 2,
  (TRECHO.match(/carregarVaiEmbora\(\);/g) || []).length);

// ── 9. O DDL ────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 9. o banco --');
ok('*** a trigger decide UMA VEZ POR TRANSACAO (`set_config` local), e nao linha a linha ***',
  /perform set_config\(chave, new\.confirmacao::text, true\)/.test(DDL));
ok('*** e a chave e POR NEGOCIO (um lote pode tocar dois) ***',
  /'fpmed\.nig_' \|\| new\.negocio_id::text/.test(DDL));
ok('*** o `true` do set_config e o que impede o numero de grudar na CONEXAO do PostgREST ***',
  /set_config\([^)]*,\s*true\)/.test(DDL));
ok('as quatro colunas do arquivamento entram como ADITIVO',
  ['arquivado_em', 'arquivado_motivo', 'arquivado_por', 'desarquivado_em']
    .every(c => new RegExp('add column if not exists\\s+' + c).test(DDL)));
ok('*** a v_atas_vigencia filtra pelo CARIMBO, e nao pela bandeira ***',
  /and n\.arquivado_em is null/.test(DDL) && !/and not n\.arquivado\b/.test(DDL));
/* ══ ESTE ASSERT TINHA UM `||` NO FIM, E O `||` ERA UMA PORTA ABERTA ═════════════════════════
   A segunda metade dele aceitava qualquer `arquivado_em is not null` em QUALQUER lugar do arquivo
   — e existe um no `create index ... where arquivado_em is not null`, 40 linhas acima. A
   `muta_b31` trocou o filtro da gaveta por `and n.arquivado` (a bandeira que as 108 atas da
   importação já trazem, o que faria a gaveta nascer mentindo "108 arquivadas") e a suíte ficou
   VERDE, satisfeita pelo índice. **Um `||` num assert é um caminho por onde o defeito passa.**
   >>> O CONSERTO cobra o filtro dentro da VIEW, e cobra também que a bandeira NÃO seja usada
       como filtro em lugar nenhum — que é a promessa inteira do bloco 2 do DDL. */
{
  const iniGav = DDL.indexOf('create or replace view public.v_atas_arquivadas');
  const gaveta = iniGav >= 0 ? DDL.slice(iniGav, iniGav + 900).replace(/\s+/g, ' ') : '';
  ok('*** e a gaveta tambem — as 108 atas com a bandeira ligada nao sao "arquivadas por alguem" ***',
    /where n\.estagio = 'contrato' and n\.arquivado_em is not null/.test(gaveta), gaveta.slice(0, 300));
  ok('*** a BANDEIRA `arquivado` nao filtra view nenhuma desta fatia (so o carimbo filtra) ***',
    !/\b(and|where)\s+n\.arquivado\b(?!_)/.test(DDL), (DDL.match(/(and|where)\s+n\.arquivado\b(?!_)/) || [])[0]);
  ok('*** e a gaveta respeita o cracha de quem pergunta (security_invoker) ***',
    /create or replace view public\.v_atas_arquivadas\s+with \(security_invoker = on\)/.test(DDL));
  ok('a vigencia tambem', /create or replace view public\.v_atas_vigencia\s+with \(security_invoker = on\)/.test(DDL));
}
ok('*** nenhum DROP TABLE, DELETE, TRUNCATE nem UPDATE no DDL ***',
  !/\b(drop\s+table|delete\s+from|truncate|update\s+public\.)/i.test(DDL));
ok('e nenhum `drop view` (a regra da casa: aditivo)', !/drop\s+view/i.test(DDL));
ok('as views novas sao negadas ao anon', /revoke all\s+on public\.v_atas_arquivadas\s+from anon/.test(DDL));
ok('e concedidas a quem esta logado', /grant select on public\.v_atas_arquivadas to authenticated/.test(DDL));

// ── 10. A CASCA ─────────────────────────────────────────────────────────────────────────────
console.log('\n-- 10. a casca --');
ok('*** o motor novo esta na casca do service worker ***',
  /'\.\/fpmed_ata_entrada\.js'/.test(SW));
/* A VERSÃO É COBRADA COMO `>=`, E NUNCA COMO IGUALDADE. `sw.js` é o único arquivo que as duas
   janelas editam no mesmo dia, e a regra combinada é "quem commitar depois SOBE o número". Com
   igualdade, o bump legítimo do A deixaria esta catraca vermelha sobre código correto, num
   arquivo que não é meu — foi o defeito que a B30 (miúdo) já pagou uma vez. */
ok('*** e a versao foi bumpada para 89 ou mais ***',
  (Number((SW.match(/limedtec-fpmed-\d{4}-\d{2}-\d{2}-(\d+)/) || [])[1]) || 0) >= 89,
  (SW.match(/limedtec-fpmed-[\d-]+/) || [])[0]);

// ── 11. A PROSA NÃO SUBSTITUI A REGRA ───────────────────────────────────────────────────────
console.log('\n-- 11. o motor cobra de si mesmo --');
ok('o motor exporta as seis funcoes',
  ['candidatos', 'linhasParaGravar', 'totaisMarcacao', 'copiaQuantidades', 'pedidoArquivar', 'pedidoDesarquivar']
    .every(k => typeof E[k] === 'function'));
ok('*** o `confirmacao: 0` esta no CODIGO do motor, e nao so no comentario ***',
  /confirmacao:\s*0,/.test(MOTOR));
ok('*** e a lista de motivos e do motor, para a tela nao inventar um sexto ***',
  Array.isArray(E.MOTIVOS_ARQUIVO) && E.MOTIVOS_ARQUIVO.length >= 4 && /MOTIVOS_ARQUIVO/.test(TRECHO));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
