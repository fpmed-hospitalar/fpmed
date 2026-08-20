/* ══════════════════════════════════════════════════════════════════════════════════════════════
   SUITE testa_ata_saldo — A CATRACA DO SALDO DA ATA (fatia B30, 20/08/2026)

   Ela guarda uma promessa só, dita de seis maneiras, porque é uma promessa que cede em silêncio:

   >>> **`null` é "não informado". `0` é "acabou", e isso é uma AFIRMAÇÃO.**

   As duas frases mandam o gestor para lados opostos — uma manda cobrar o órgão, a outra manda
   esquecer a ata. E o defeito que troca uma pela outra **não levanta exceção, não pinta vermelho
   e não quebra teste nenhum**: ele imprime um número redondo, com cara de conta feita, numa tela
   que vira faturamento. É a mesma família do `sort()` sem comparador da B28 — *dá número errado,
   calado, com cara de certo.*

   ══ AS SEIS FORMAS ══════════════════════════════════════════════════════════════════════════
   1. **SALDO SEM EMPENHO É `null`, E NÃO A QUANTIDADE INTEIRA.** O atalho ("ninguém empenhou,
      então ainda posso entregar tudo") é uma afirmação sobre o comportamento do ÓRGÃO que
      ninguém verificou — e ele enche a agenda de faturamento de dinheiro que não existe.
   2. **O TOTAL NÃO SOMA O QUE NÃO SABE, E DIZ QUANTO FICOU DE FORA.** Desconhecido somado como
      zero é a forma silenciosa de errar para baixo: o número fecha e parece completo.
   3. **"SOMOU ZERO" E "NÃO HAVIA O QUE SOMAR" SÃO ESTADOS DIFERENTES.** Nos dois `t.saldo` é 0.
      Hoje, nas 108 atas desta casa, o segundo é sempre o verdadeiro — e o primeiro diria
      "acabou".
   4. **O NÚMERO INCOERENTE É MOSTRADO, NÃO RECUSADO.** Entregue maior que empenhado acontece (o
      órgão pede antes de lançar o empenho). Digitação recusada vira anotação no caderno de
      alguém, fora do sistema.
   5. **O PRAZO É CONTADO COM `Math.round`.** É ele — e não o horário escolhido — que absorve o
      fuso; ver a correção escrita no motor. `Math.floor` trunca todo prazo para baixo.
   6. **AS SEM VIGÊNCIA VÃO PARA O FIM.** "Sem data" no lugar de destaque parece a mais urgente,
      e é o contrário: é a que ninguém sabe.

   ══ E ELA COBRA DO CÓDIGO, NÃO DA PROSA ═════════════════════════════════════════════════════
   Todo assert de tela roda sobre o texto SEM COMENTÁRIO (`semComentario`), e todo assert de DDL
   sobre o SQL sem comentário. A lição é da B26 e ela já pegou o autor uma vez, na B29, no arquivo
   em que a explicação era mais longa que a regra: *um assert que aceita o comentário como prova
   do código não está provando o código.*

     node tests/testa_ata_saldo.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { semComentario } = require('../tools/regua_visual.js');
const RAIZ = path.join(__dirname, '..');
const R = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');

const semComentarioSQL = s => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
const MOTOR = semComentario(R('fpmed_ata_saldo.js'));
const NEG   = semComentario(R('fpmed_negocios.html'));
const SW    = semComentario(R('sw.js'));
const DDL   = semComentarioSQL(R('ddl/ata_saldo.sql'));
const M = require('../fpmed_ata_saldo.js');

/* O PEDAÇO DA TELA QUE É DESTA FATIA. Os asserts de "a tela não reimplementa a conta" precisam
   deste recorte e não do arquivo inteiro: a `fpmed_negocios.html` JÁ tem um `86400000` legítimo
   (o `diasDesde`, de outra fatia e de outra pergunta), e cobrar do arquivo todo daria um vermelho
   sobre código que não é meu — que é a forma mais rápida de uma catraca ser desligada. */
const ini = NEG.indexOf('function pintaVigenciaAta(id){');
const fim = NEG.indexOf('async function anexarAta(id){');
const TRECHO = (ini >= 0 && fim > ini) ? NEG.slice(ini, fim) : '';

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 320) + ']' : '')); } n++; };
console.log('SUITE testa_ata_saldo — ata sem saldo e papel; ata com saldo e agenda de faturamento\n');

// Um item ganho, no formato que a `ganhosDoNegocio` devolve.
const IT = (item, qtd, unit) => ({ item: item, descricao: 'item ' + item, unidade: 'CX',
                                   quantidade: qtd, unitario: unit, nosso: true });
const SD = (item, emp, ent) => ({ item_n: item, empenhado: emp, entregue: ent,
                                  origem: 'informado', informado_por: 'a@b.c' });

// ── 1. SALDO SEM EMPENHO É `null`, E NUNCA A QUANTIDADE ─────────────────────────────────────
console.log('-- 1. o saldo desconhecido nao vira a quantidade inteira --');
{
  const l = M.linhas([IT('1', 100, 10)], [])[0];
  ok('*** sem empenho informado, o saldo e `null` — e NAO os 100 registrados ***',
    l.saldo === null, l.saldo);
  ok('*** e o saldo em dinheiro tambem e `null` (R$ 0,00 diria que o que sobrou nao vale nada) ***',
    l.saldoValor === null, l.saldoValor);
  ok('a linha sabe que ninguem informou nada', l.informado === false, l.informado);
}
{
  const l = M.linhas([IT('1', 100, 10)], [SD('1', 30, null)])[0];
  ok('com 30 empenhados de 100, o saldo e 70', l.saldo === 70, l.saldo);
  ok('e o saldo em dinheiro e 70 x 10 = 700', l.saldoValor === 700, l.saldoValor);
  ok('a linha sai marcada como informada por gente', l.informado === true && l.origem === 'informado',
    [l.informado, l.origem]);
}
{
  /* EMPENHO ZERO É UMA RESPOSTA, e diferente de "não informado": alguém olhou e o órgão não
     empenhou nada. Aí o saldo É a quantidade inteira — porque houve afirmação. */
  const l = M.linhas([IT('1', 100, 10)], [SD('1', 0, null)])[0];
  ok('*** empenho ZERO informado e uma resposta: o saldo passa a ser os 100 ***',
    l.saldo === 100, l.saldo);
}
{
  // ITEM SEM QUANTIDADE PUBLICADA: subtrair de um número que não existe daria saldo negativo
  // com cara de conta.
  const l = M.linhas([IT('1', null, 10)], [SD('1', 30, null)])[0];
  ok('*** sem quantidade registrada, o saldo e `null` mesmo com o empenho digitado ***',
    l.saldo === null, l.saldo);
}
{
  const l = M.linhas([IT('1', 100, null)], [SD('1', 30, null)])[0];
  ok('*** sem preco homologado, o saldo existe em unidades (70) e NAO vira reais ***',
    l.saldo === 70 && l.saldoValor === null, [l.saldo, l.saldoValor]);
}
{
  const l = M.linhas([IT('1', 100, 10)], [SD('1', 30, 12)])[0];
  ok('a entregar = empenhado - entregue = 18', l.aEntregar === 18, l.aEntregar);
  const l2 = M.linhas([IT('1', 100, 10)], [SD('1', 30, null)])[0];
  ok('*** sem entrega informada, "a entregar" e `null` e nao os 30 empenhados ***',
    l2.aEntregar === null, l2.aEntregar);
}
{
  // A CHAVE É TEXTO DOS DOIS LADOS. Número aqui e texto lá fariam "07" e "7" serem itens
  // diferentes na ata do mesmo pregão — com o saldo gravado ao lado, em branco.
  const l = M.linhas([{ item: 7, quantidade: 100, unitario: 10 }], [{ item_n: '7', empenhado: 40 }])[0];
  ok('*** o item 7 (numero) casa com o saldo do item "7" (texto) ***', l.saldo === 60, l.saldo);
}

// ── 2 e 3. O TOTAL NÃO SOMA O QUE NÃO SABE, E SABE DIZER QUE NÃO SOMOU NADA ──────────────────
console.log('\n-- 2. o total diz quantas linhas ficaram de fora dele --');
{
  const ls = M.linhas([IT('1', 100, 10), IT('2', 50, 4), IT('3', 20, 1)], [SD('1', 30, null)]);
  const t = M.totais(ls);
  ok('*** o saldo total soma SO a linha informada (70), e nao 70+50+20 ***', t.saldo === 70, t.saldo);
  ok('e diz que 2 dos 3 itens ficaram de fora', t.semInfo === 2 && t.itens === 3, [t.semInfo, t.itens]);
  ok('`comSaldo` conta as linhas que ENTRARAM na soma', t.comSaldo === 1, t.comSaldo);
  ok('o valor total do saldo e 700', t.saldoValor === 700, t.saldoValor);
}
{
  /* A LINHA QUE EXISTE MAS NÃO DIZ NADA. Alguém abriu o item, digitou só a ENTREGA e saiu sem o
     empenho — a linha da `ata_saldo` existe, `informado` é `true`, e o empenho continua `null`.
     Contá-la como informada faria o total prometer completude que não há: o `semInfo` cairia para
     zero e a tela diria "todos os itens informados" com o saldo de todos eles desconhecido. */
  const ls = M.linhas([IT('1', 100, 10)], [SD('1', null, 5)]);
  ok('*** linha que existe mas nao tem empenho ainda conta como SEM informacao ***',
    M.totais(ls).semInfo === 1, M.totais(ls).semInfo);
  ok('e o saldo dela continua `null`', ls[0].saldo === null, ls[0].saldo);
  ok('mesmo tendo `informado: true` (a linha existe, o dado e que nao)',
    ls[0].informado === true, ls[0].informado);
}
{
  const t = M.totais(M.linhas([IT('1', 100, 10), IT('2', 50, 4)], []));
  ok('*** ATA NOVA: `t.saldo` e 0 mas `comSaldo` e 0 — os dois estados ficam distinguiveis ***',
    t.saldo === 0 && t.comSaldo === 0, [t.saldo, t.comSaldo]);
  const t2 = M.totais(M.linhas([IT('1', 100, 10)], [SD('1', 100, null)]));
  ok('*** ATA ESGOTADA: `t.saldo` e 0 mas `comSaldo` e 1 — este zero SIGNIFICA "acabou" ***',
    t2.saldo === 0 && t2.comSaldo === 1, [t2.saldo, t2.comSaldo]);
}
{
  /* `semQtd` E `semPreco` SÃO CONTAS DIFERENTES, e a fixture prova isso separando-as: DOIS itens
     sem quantidade publicada, UM com saldo mas sem preço. Se as duas fossem a mesma conta (ou se
     uma somasse a outra), este 2-contra-1 não sairia — que é o defeito que o assert vigia.
     >>> A DISTINÇÃO NÃO É ACADÊMICA: `semQtd` é dado que o certame não publicou e `semPreco`
         também, mas o primeiro impede o SALDO e o segundo só impede os REAIS. Quem lê a tela faz
         coisas diferentes com cada um. */
  const t = M.totais(M.linhas(
    [IT('1', null, 10), IT('4', null, 10), IT('2', 50, null)],
    [SD('1', 10, null), SD('4', 10, null), SD('2', 10, null)]));
  ok('`semQtd` conta os DOIS itens sem quantidade publicada', t.semQtd === 2, t.semQtd);
  ok('`semPreco` conta so o UM item com saldo e sem preco', t.semPreco === 1, t.semPreco);
  ok('*** as duas contas nao se confundem: 2 sem quantidade contra 1 sem preco ***',
    t.semQtd === 2 && t.semPreco === 1, [t.semQtd, t.semPreco]);
  ok('*** e os dois itens sem quantidade nao entram no total, mesmo com empenho digitado ***',
    t.saldo === 40 && t.comSaldo === 1, [t.saldo, t.comSaldo]);
}

// ── 4. O NÚMERO INCOERENTE É MOSTRADO, NÃO RECUSADO ─────────────────────────────────────────
console.log('\n-- 4. o numero estranho aparece; recusa-lo o empurraria pra fora do sistema --');
{
  const l = M.linhas([IT('1', 100, 10)], [SD('1', 120, null)])[0];
  ok('empenhado maior que a quantidade vira alerta', l.alertas.length === 1, l.alertas);
  ok('*** e a linha CONTINUA na lista, com o saldo negativo a mostra (-20) ***',
    l.saldo === -20, l.saldo);
  const l2 = M.linhas([IT('1', 100, 10)], [SD('1', 30, 45)])[0];
  ok('entregue maior que o empenhado vira alerta', l2.alertas.length === 1, l2.alertas);
  ok('e a linha continua na lista', l2.item === '1', l2.item);
  const t = M.totais([l, l2]);
  ok('o total conta quantas linhas tem numero incoerente', t.comAlerta === 2, t.comAlerta);
}

// ── 5. O PRAZO ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- 5. o prazo, e o que de fato absorve o fuso --');
{
  ok('*** a ata que vence HOJE da 0 dias (e nao -1 nem 1) ***',
    M.vigencia('2026-08-20', '2026-08-20').dias === 0, M.vigencia('2026-08-20', '2026-08-20').dias);
  /* E O DIA DE HOJE AINDA É "VENCENDO", NÃO "VENCIDA". A ata vale até o fim do dia do vencimento,
     e chamá-la de vencida no dia arranca o último dia em que ainda dá para faturar — justamente
     o dia em que o aviso mais serve para alguma coisa. */
  ok('*** e ela e "vencendo", NAO "vencida": o ultimo dia ainda e um dia ***',
    M.vigencia('2026-08-20', '2026-08-20').situacao === 'vencendo',
    M.vigencia('2026-08-20', '2026-08-20').situacao);
  ok('ata que venceu ontem: -1 dia e situacao "vencida"',
    M.vigencia('2026-08-19', '2026-08-20').dias === -1
    && M.vigencia('2026-08-19', '2026-08-20').situacao === 'vencida');
  ok('*** o corte de "vencendo" e 60 dias, e o dia 60 AINDA e vencendo ***',
    M.vigencia('2026-10-19', '2026-08-20').situacao === 'vencendo',
    M.vigencia('2026-10-19', '2026-08-20'));
  ok('*** e o dia 61 ja e "vigente" — o limite existe de verdade ***',
    M.vigencia('2026-10-20', '2026-08-20').situacao === 'vigente',
    M.vigencia('2026-10-20', '2026-08-20'));
  ok('61 dias sao contados como 61', M.vigencia('2026-10-20', '2026-08-20').dias === 61);
  /* O CORTE É 60 E NÃO OS 30 DO COFRE DE CERTIDÕES, e a diferença tem motivo: certidão se tira
     em dias; esvaziar o saldo de uma ata é vender, empenhar e entregar. */
  ok('o corte da ata NAO e o do cofre de certidoes (30)',
    M.vigencia('2026-09-30', '2026-08-20').situacao === 'vencendo',
    M.vigencia('2026-09-30', '2026-08-20'));
  ok('*** data em branco e "sem_vigencia" com dias `null` — nunca "nao vence" ***',
    M.vigencia(null, '2026-08-20').situacao === 'sem_vigencia'
    && M.vigencia(null, '2026-08-20').dias === null);
  ok('texto que nao e data tambem e "sem_vigencia"',
    M.vigencia('em breve', '2026-08-20').situacao === 'sem_vigencia');
  ok('timestamp com hora e cortado nos 10 primeiros caracteres',
    M.vigencia('2026-10-20T03:00:00Z', '2026-08-20').dias === 61);
  /* O ASSERT QUE VIGIA O `Math.round`, e ele é sobre COMPORTAMENTO. Um ano inteiro de datas
     seguidas tem de dar exatamente 1 dia de passo — com `Math.floor` e um fuso a leste, o passo
     escorrega e todo prazo sai truncado para baixo, calado. */
  let passoOk = true, base = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 365; i++) {
    const d1 = new Date(base + i * 86400000).toISOString().slice(0, 10);
    const d2 = new Date(base + (i + 1) * 86400000).toISOString().slice(0, 10);
    if (M.vigencia(d2, d1).dias !== 1) { passoOk = false; break; }
  }
  ok('*** 365 dias seguidos de 2026: cada passo vale EXATAMENTE 1 dia ***', passoOk);
  ok('o motor nao arredonda pra baixo (nao ha Math.floor na conta de dias)',
    !/Math\.floor\([^)]*86400000/.test(MOTOR) && /Math\.round\(/.test(MOTOR));
}

// ── 6. A ORDEM DE QUEM VENCE PRIMEIRO ───────────────────────────────────────────────────────
console.log('\n-- 6. a ordem do dinheiro indo embora --');
{
  const atas = [
    { id: 1, ata_vigencia_fim: '2026-12-01' },
    { id: 2, ata_vigencia_fim: null },
    { id: 3, ata_vigencia_fim: '2026-09-01' },
    { id: 4, ata_vigencia_fim: '2026-08-01' },
    { id: 5, ata_vigencia_fim: null },
  ];
  const o = M.ordenaPorVencimento(atas).map(x => x.id);
  ok('*** quem vence primeiro vem primeiro ***', String(o.slice(0, 3)) === '4,3,1', o);
  ok('*** as SEM vigencia vao pro FIM, nunca pro topo ***', String(o.slice(3)) === '2,5', o);
  ok('a ordem entre as sem data e estavel (pelo id), e nao sorteio',
    String(M.ordenaPorVencimento(atas).map(x => x.id)) === String(o), o);
  ok('*** ordenar nao mexe na lista original (a tela reordena sem perder a de origem) ***',
    atas[0].id === 1 && atas.length === 5);
}

// ── 7. A TELA: O QUE ELA NÃO PODE FAZER ─────────────────────────────────────────────────────
console.log('\n-- 7. a tela pergunta; a conta mora no motor --');
ok('o Negocios carrega o motor do saldo',
  /<script src="fpmed_ata_saldo\.js"><\/script>/.test(NEG));
ok('o trecho da fatia foi encontrado no arquivo', TRECHO.length > 2000, TRECHO.length);
ok('*** a tela NAO conta dias por conta propria (nem 86400000, nem getTime) ***',
  !/86400000|getTime\(\)/.test(TRECHO));
ok('a faixa da validade pergunta ao motor', /M\.vigencia\(n\.ata_vigencia_fim/.test(TRECHO));
ok('a tabela do saldo pergunta ao motor', /M\.linhas\(itens, ATA_SALDOS\)/.test(TRECHO)
  && /M\.totais\(ls\)/.test(TRECHO));
ok('*** sem o motor a faixa NAO nasce, em vez de nascer com a conta feita na tela ***',
  /if\(!M\)\{ box\.innerHTML = ''; return; \}/.test(TRECHO));
ok('a ordem "ata vencendo primeiro" existe no seletor',
  /<option value="ata_vence">/.test(NEG));
ok('e ela usa a comparacao do motor, nao uma copia',
  /FPMED_ATA_SALDO\.ordenaPorVencimento\(l\)/.test(NEG));
/* ══ A FIAÇÃO, E ELA É O DEFEITO QUE NÃO SE REPRODUZ ══════════════════════════════════════════
   O saldo lê a MESMA lista que o quadro de cima, e essa lista chega por DUAS leituras assíncronas
   que correm juntas (`carregarItensGanhos` e `carregarItensEdital`). Sem repintar nos dois
   pontos de chegada, quem chegar primeiro decide se a tabela do saldo aparece — e o sintoma é o
   pior de todos: **a tela certa metade das vezes, sem ninguém saber reproduzir.** É a mesma linha
   que a `pintaItensGanhos` já tem desde a B23, pelo mesmo motivo. */
/* CONTAR OCORRÊNCIAS NÃO SERVE AQUI, e a mutação provou: com "pelo menos 3", apagar UMA das duas
   repinturas deixava 3 (as outras duas chamadas mais a definição da função) e a catraca passava.
   O que precisa ser cobrado é o PAR: onde a lista de itens é repintada, o saldo é repintado
   JUNTO. Se um dia nascer um terceiro ponto de chegada, este assert continua exigindo o par. */
{
  const pares = (NEG.match(/pintaItensGanhos\(id\);\s*pintaSaldoAta\(id\);/g) || []).length;
  const sozinhos = (NEG.match(/pintaItensGanhos\(id\);/g) || []).length;
  ok('*** TODA repintura da lista de itens repinta o saldo junto ***',
    pares === sozinhos && pares === 2, [pares, sozinhos]);
}
ok('e a ficha aberta pinta a validade e vai buscar o saldo',
  /pintaVigenciaAta\(id\); carregarSaldoAta\(id\);/.test(NEG));
ok('a aba Ata tem o lugar da validade e o lugar do saldo',
  /id="ata-vigencia"/.test(NEG) && /id="ata-saldo"/.test(NEG));

console.log('\n-- 8. o campo que nao digita pelo usuario --');
/* O `value="0"` NUM CAMPO VAZIO seria a tela fazendo, com o nome de quem abriu a ficha, a única
   afirmação que esta fatia inteira existe para não fazer. */
ok('*** o campo nasce VAZIO quando nao ha dado (nunca `value="0"`) ***',
  /== null \? '' :/.test(TRECHO) && !/value="0"/.test(TRECHO));
ok('e o placeholder diz o que o vazio significa',
  /placeholder="não informado"/.test(TRECHO));
/* ══ ESTES DOIS ASSERTS SÃO EXATOS DE PROPÓSITO, E O MOTIVO É UMA FALHA DA PRIMEIRA VERSÃO ═════
   Escritos frouxos (`/class="sd-nao">não informado</`) eles passavam VERDE com o defeito dentro:
   a frase "não informado" aparece DUAS vezes no trecho — na célula e no total — e apagá-la de uma
   ainda deixava a outra para o padrão casar. A mutação `muta_b30.js` mostrou os dois escapando, e
   é exatamente o buraco que um assert por palavra solta produz: ele mede que a PALAVRA existe em
   algum lugar, não que o LUGAR certo a use. */
ok('*** a celula sem dado sai como "nao informado", nao como travessao nem zero ***',
  /const naoInf = '<span class="sd-nao">não informado<\/span>';/.test(TRECHO));
ok('*** o TOTAL se cala quando nenhuma linha entrou nele (e nao imprime 0) ***',
  /\(t\.comSaldo === 0 \? '<span class="sd-nao">não informado<\/span>'\s*:\s*nb\(t\.saldo\)/.test(TRECHO));
ok('e diz, com todas as letras, que isso nao e saldo zero',
  /não é saldo zero/.test(TRECHO));
ok('a ata sem itens lidos diz isso', /Esta ata ainda não tem itens lidos/.test(TRECHO));
ok('*** o erro de leitura NAO e mostrado como "nao informado" ***',
  /Não consegui ler o saldo/.test(TRECHO));
ok('e ele avisa pra nao digitar por cima', /Não digite por cima/.test(TRECHO));
ok('a validade em branco nao promete "nao vence"',
  /não<\/b> quer dizer que ela não vença/.test(TRECHO));

console.log('\n-- 9. a gravacao --');
ok('*** o que a tela grava e sempre `origem: informado` ***',
  /origem: 'informado'/.test(TRECHO));
ok("*** a tela NUNCA escreve origem 'pncp' — dado digitado nao se confunde com publicado ***",
  !/origem: *'pncp'/.test(TRECHO));
ok('o upsert usa a chave unica (negocio_id, item_n)',
  /on_conflict=negocio_id,item_n/.test(TRECHO) && /resolution=merge-duplicates/.test(TRECHO));
ok('*** so sobe o que MUDOU (senao o carimbo de "quando alguem olhou" vira o do ultimo clique) ***',
  /if\(emp === l\.empenhado && ent === l\.entregue\) return;/.test(TRECHO));
ok('linha em branco que nunca existiu nao e gravada',
  /if\(emp === null && ent === null && !l\.informado\) return;/.test(TRECHO));
ok('o `atualizado_em` e mandado a mao (o default do banco so vale no insert)',
  /atualizado_em: agora/.test(TRECHO));
ok('*** a tela nunca manda DELETE no saldo ***',
  !/method: *'DELETE'[\s\S]{0,200}ata_saldo/.test(NEG) && !/ata_saldo[\s\S]{0,200}method: *'DELETE'/.test(NEG));
ok('a unica recusa e a data de fim antes da de inicio', /fim < ini/.test(TRECHO));

// ── 10. O DDL ───────────────────────────────────────────────────────────────────────────────
console.log('\n-- 10. o banco --');
ok('a tabela nasce', /create table if not exists public\.ata_saldo/.test(DDL));
ok('*** `empenhado` e `entregue` sao ANULAVEIS de proposito ***',
  /empenhado\s+numeric check \(empenhado >= 0\)/.test(DDL)
  && !/empenhado\s+numeric[^,]*not null/.test(DDL));
ok('e nao aceitam numero negativo',
  /check \(empenhado >= 0\)/.test(DDL) && /check \(entregue\s+>= 0\)/.test(DDL));
ok('*** uma linha por item (a segunda seria dois saldos e a escolha viraria sorteio) ***',
  /unique \(negocio_id, item_n\)/.test(DDL));
ok('a chave do item e TEXTO nos dois lados', /item_n\s+text not null/.test(DDL));
ok("a origem tem CHECK e ja preve a fonte que nao existe ainda",
  /check \(origem in \('informado','pncp'\)\)/.test(DDL));
ok('a origem nasce como informado', /default 'informado'/.test(DDL));
ok('*** NAO existe policy de DELETE — saldo informado nao se apaga, se grava por cima ***',
  !/for delete/i.test(DDL));
ok('e o anon nao chega perto', /revoke all on public\.ata_saldo from anon/.test(DDL));
ok('escrever e do gestor', /cargo_gestor\(\)/.test(DDL));
ok('a view respeita o cracha de quem pergunta', /security_invoker = on/.test(DDL));
ok('*** a view poe as sem vigencia no fim ***', /nulls last/.test(DDL));
ok('a vigencia e coluna do negocio, e aditiva',
  /alter table public\.negocios add column if not exists ata_vigencia_fim/.test(DDL));
ok('*** o DDL e so ADITIVO: nenhum DROP TABLE, DELETE ou TRUNCATE ***',
  !/\bdrop\s+(table|column)\b/i.test(DDL) && !/\bdelete\s+from\b/i.test(DDL)
  && !/\btruncate\b/i.test(DDL));
ok('nem UPDATE destrutivo', !/^\s*update\s+public\./im.test(DDL));

// ── 11. O SERVICE WORKER ────────────────────────────────────────────────────────────────────
console.log('\n-- 11. a casca --');
ok('o motor esta na casca', /'\.\/fpmed_ata_saldo\.js'/.test(SW));
/* ══ A VERSÃO É COBRADA COMO PISO (>= 88), E NÃO COMO IGUALDADE ═══════════════════════════════
   A primeira versão deste assert cobrava `-88` exato — e seria uma mina para a próxima janela: o
   `sw.js` é o único arquivo que as DUAS frentes editam no mesmo dia, e a regra combinada é *"quem
   commitar depois SOBE o número, nunca volta"*. Com igualdade, o bump legítimo do A para -89
   deixaria a MINHA catraca vermelha, sobre código correto, num arquivo que não é meu.
   >>> O DEFEITO NÃO É TEÓRICO: ele acabou de acontecer no sentido inverso. A `muta_b29.js`
       procurava `-87` e parou de casar quando eu bumpei para -88 — a mutação passou a medir nada
       e se declarou "escapada". Quem viu foi o placar da mutação, não a suíte.
   >>> A `testa_piso.js` já tinha acertado isto (ela cobra `>= 87`). Copiar a forma certa do
       vizinho é mais barato que descobrir a errada de novo. */
ok('*** e a versao foi bumpada para 88 ou mais (arquivo novo na lista sem bump nao e baixado) ***',
  (Number((SW.match(/limedtec-fpmed-\d{4}-\d{2}-\d{2}-(\d+)/) || [])[1]) || 0) >= 88,
  (SW.match(/limedtec-fpmed-[\d-]+/) || [])[0]);

console.log('\n' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
