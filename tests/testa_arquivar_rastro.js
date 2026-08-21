/* ════════════════════════════════════════════════════════════════════════════════════════════
   SUITE testa_arquivar_rastro — QUEM ARQUIVOU, E POR QUÊ (fatia B34, 21/08/2026)

   ══ O DEFEITO QUE ESTA CATRACA EXISTE PARA NÃO DEIXAR VOLTAR ═════════════════════════════════
   A B31 (20/08) construiu uma distinção de DOIS ESTADOS no banco e pendurou duas views nela:
     · nasceu arquivado na importação -> `arquivado = true`, `arquivado_em` NULO
     · alguém DECIDIU tirar           -> `arquivado_em` preenchido, com motivo e autor
   A `v_atas_vigencia` mostra o que NÃO tem carimbo; a `v_atas_arquivadas` mostra o que TEM. A
   razão está escrita no `ddl/entrada_da_ata.sql`: filtrar pela bandeira deixaria a aba Ata com
   zero linhas, porque as 108 atas desta base vieram arquivadas da importação.

   >>> E O BOTÃO "Arquivar" DO KANBAN GRAVAVA `{ arquivado: true }` E MAIS NADA. Ou seja: do
       primeiro clique de gente em diante, a decisão da pessoa entrava no banco BYTE A BYTE IGUAL
       às 2.551 linhas que uma máquina arquivou sozinha em 06/08, em 1,7 segundo. A distinção
       existia no esquema e morria no botão — e ninguém veria, porque nada dá erro.

   >>> O PIOR CASO ERA A ATA, e ele é silencioso nas duas pontas: arquivar uma ata pelo kanban
       tirava o cartão do funil e DEIXAVA a ata no painel de vigência e na lista da manhã, porque
       a view só olha o carimbo. O dono arquivava e a tela continuava cobrando.

   ══ E O RASTRO DO DEFEITO ESTAVA NO DADO, MEDIDO ANTES DE QUALQUER CONSERTO ═══════════════════
   Em 21/08, dos 2.560 negócios arquivados: 2.551 da importação, 1 com carimbo completo, e **8
   arquivados sem carimbo nenhum** — cliques cujo dia ninguém tem mais como saber. Esses 8 são a
   pegada do botão, e é por isso que eles ganharam um valor PRÓPRIO (`decisao_sem_carimbo`) em vez
   de uma data inventada.

   ══ O QUE ESTA SUÍTE COBRA, E O QUE ELA DE PROPÓSITO NÃO COBRA ═══════════════════════════════
   Ela cobra o MOTOR (que é onde a regra passou a morar) e o CAMINHO da tela até ele. Ela NÃO
   cobra o número de linhas do banco: número de banco é prova, e prova mede-se contra o banco
   (`tools/prova_b34_rastro.js`), não contra um literal que envelhece sozinho na segunda semana.

     node tests/testa_arquivar_rastro.js
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { semComentario } = require('../tools/regua_visual.js');
const RAIZ = path.join(__dirname, '..');
const R = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');

const semComentarioSQL = s => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const NEG   = semComentario(R('fpmed_negocios.html'));
const MOTOR = semComentario(R('fpmed_ata_entrada.js'));
const DDL   = semComentarioSQL(R('ddl/rastro_arquivamento.sql'));
const DDL_BRUTO = R('ddl/rastro_arquivamento.sql');
const E = require('../fpmed_ata_entrada.js');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 320) + ']' : '')); } n++; };
console.log('SUITE testa_arquivar_rastro — a bandeira nao diz por que, e agora ha quem diga\n');

/* O RECORTE DA TELA QUE É DESTA FATIA: as duas funções do kanban. Cobrar o arquivo inteiro faria
   um assert desta fatia passar por causa de código de outra — a lição do `TRECHO` da B31. */
function recorte(ini, fim) {
  const a = NEG.indexOf(ini); if (a < 0) throw new Error('ancora sumiu: ' + ini);
  const b = NEG.indexOf(fim, a); if (b < 0) throw new Error('ancora sumiu: ' + fim);
  return NEG.slice(a, b);
}
const TRECHO = recorte('async function arquivar(id)', 'async function abrirDrawer(id)');

// ══════════════════════════════════════════════════════════════════════════════════════════
// 1. O MOTOR ARQUIVA COM RASTRO — OS QUATRO CAMPOS, E NENHUM A MENOS
// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('-- 1. arquivar pelo kanban deixa rastro --');
{
  const r = E.pedidoArquivarNegocio({ id: 7, estagio: 'classificacao' }, 'a@b.c', '2026-08-21T10:00:00Z');
  ok('*** o pedido leva bandeira, CARIMBO, autor e origem — os quatro ***',
    r.ok && r.campos.arquivado === true && r.campos.arquivado_em === '2026-08-21T10:00:00Z'
    && r.campos.arquivado_por === 'a@b.c' && r.campos.arquivado_origem === 'decisao', r.campos);
  /* ESTE É O ASSERT QUE O DEFEITO NÃO PASSAVA. Sem carimbo, a linha fica indistinguível das
     2.551 da importação — e é a `v_atas_vigencia` que decide o que é indistinguível de quê. */
  ok('*** e o CARIMBO nunca sai nulo: e ele que separa decisao de importacao ***',
    !!r.campos.arquivado_em);
  ok('a origem diz `decisao`, que e o que a coluna do banco declara para o clique',
    r.campos.arquivado_origem === 'decisao', r.campos.arquivado_origem);
  ok('*** e o pedido NAO apaga campo nenhum: so escreve `arquivado*` ***',
    Object.keys(r.campos).every(k => /^arquivado/.test(k)), Object.keys(r.campos));
  ok('sem autor conhecido, o campo vai NULO — e nulo e "nao informado", nunca um nome inventado',
    E.pedidoArquivarNegocio({ estagio: 'disputa' }, null, '2026-08-21T10:00:00Z').campos.arquivado_por === null);
  ok('sem hora passada, ele carimba a de agora (e nao deixa passar sem carimbo)',
    !!E.pedidoArquivarNegocio({ estagio: 'disputa' }, 'a@b.c').campos.arquivado_em);
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 2. A ATA É RECUSADA NO KANBAN — E A RECUSA DIZ PARA ONDE IR
// ══════════════════════════════════════════════════════════════════════════════════════════
// Não é zelo: arquivar ata pelo kanban tirava o cartão do funil e deixava a ata no painel de
// vigência, porque a view filtra o carimbo. Consertar só o carimbo aqui resolveria a view e
// criaria o cemitério anônimo que o motivo obrigatório existe para impedir. A recusa é a única
// saída que não troca um defeito por outro.
console.log('\n-- 2. a ata nao se arquiva por aqui --');
{
  const r = E.pedidoArquivarNegocio({ id: 9, estagio: 'contrato' }, 'a@b.c', '2026-08-21T10:00:00Z');
  ok('*** negocio em `contrato` (ata) e RECUSADO pelo caminho do kanban ***', r.ok === false, r);
  ok('...e a recusa NAO vem com campos (recusa que grava e recusa de mentira)',
    !r.campos, Object.keys(r));
  ok('*** e ela diz PARA ONDE ir, com o nome do botao que existe de verdade ***',
    /Arquivar esta ata/.test(r.erro) && /aba Ata/.test(r.erro), r.erro);
  ok('...e diz o que aconteceria se ela nao recusasse (o painel de vigencia)',
    /painel de vigência/.test(r.erro) && /motivo é obrigatório/.test(r.erro), r.erro);
  ok('o botao da ATA continua existindo e continua exigindo motivo',
    E.pedidoArquivar('', '', 'a@b.c', '2026-08-21T10:00:00Z').ok === false);
  ok('...e ele tambem passou a gravar a ORIGEM (os dois caminhos falam a mesma lingua)',
    E.pedidoArquivar('registro de teste', '', 'a@b.c', '2026-08-21T10:00:00Z')
      .campos.arquivado_origem === 'decisao');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 3. A VOLTA É UMA SÓ, PARA OS DOIS CAMINHOS
// ══════════════════════════════════════════════════════════════════════════════════════════
// Até 21/08 o `desarquivar` do kanban gravava só `{ arquivado:false }` — e deixava o carimbo
// para trás. O negócio voltava ao funil AINDA DIZENDO, no dado, que alguém o tinha arquivado; e
// se fosse ata, ela ficava fora do painel de vigência depois de voltar.
console.log('\n-- 3. a volta limpa o carimbo, e nao a historia --');
{
  const d = E.pedidoDesarquivar('2026-08-21T11:00:00Z');
  ok('*** a volta limpa o CARIMBO (e ele que a v_atas_vigencia filtra) ***',
    d.arquivado === false && d.arquivado_em === null, d);
  ok('*** e NAO apaga motivo, autor nem origem: quem desfaz um ato nao desfaz o fato ***',
    !('arquivado_motivo' in d) && !('arquivado_por' in d) && !('arquivado_origem' in d), Object.keys(d));
  ok('e a terceira data fica gravada', d.desarquivado_em === '2026-08-21T11:00:00Z');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 4. A TELA CHAMA O MOTOR — NÃO REESCREVE A REGRA
// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n-- 4. a regra mora num lugar so --');
ok('*** o kanban ARQUIVA pelo motor ***', /E\.pedidoArquivarNegocio\(/.test(TRECHO));
ok('*** e DESARQUIVA pelo motor, a mesma funcao que a aba Ata usa ***',
  /E\.pedidoDesarquivar\(/.test(TRECHO));
ok('...e grava o objeto que o motor devolveu, nao um escrito na tela',
  /gravar\(id, p\.campos\)/.test(TRECHO));
/* ESTE ASSERT É O QUE IMPEDE O DEFEITO DE VOLTAR PELA PORTA DOS FUNDOS: alguém "simplificando" a
   tela reescreveria `{ arquivado:true }` inteirinho, e tudo continuaria funcionando na aparência. */
ok('*** a tela NAO monta mais o `{ arquivado:true }` a mao (foi assim que o carimbo sumiu) ***',
  !/\{\s*arquivado\s*:\s*true\s*\}/.test(TRECHO), (TRECHO.match(/\{[^{}]*arquivado[^{}]*\}/g) || []).slice(0, 4));
ok('a recusa da ata e MOSTRADA a pessoa (recusa silenciosa e botao que nao faz nada)',
  /if\(!p\.ok\)\{\s*alert\(p\.erro\)/.test(TRECHO), TRECHO.slice(TRECHO.indexOf('p.ok'), TRECHO.indexOf('p.ok') + 60));
ok('...e ela vem ANTES do confirm (perguntar e depois recusar e fazer a pessoa decidir a toa)',
  TRECHO.indexOf('alert(p.erro)') < TRECHO.indexOf('confirm('), [TRECHO.indexOf('alert(p.erro)'), TRECHO.indexOf('confirm(')]);
ok('quem arquivou vai junto: a tela pega o e-mail da sessao, nao um nome digitado',
  /gmAuth\.user\.email/.test(TRECHO));
ok('o motor exporta as tres funcoes do arquivamento',
  ['pedidoArquivar', 'pedidoArquivarNegocio', 'pedidoDesarquivar'].every(k => typeof E[k] === 'function'));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 5. O DDL É ADITIVO, E O UPDATE É CERCADO PELA EVIDÊNCIA
// ══════════════════════════════════════════════════════════════════════════════════════════
// A caixa mandou tratar o UPDATE com o mesmo cuidado do DELETE. O que torna este seguro não é a
// intenção: é que ele escreve numa coluna criada duas linhas acima, e só onde ela está nula.
console.log('\n-- 5. o DDL nao destroi e nao se repete --');
ok('*** ZERO delete / drop / truncate no arquivo ***',
  !/\b(delete|drop\s+table|drop\s+view|truncate)\b/i.test(DDL), (DDL.match(/\b(delete|drop|truncate)\b/gi) || []));
ok('a coluna nasce com `add column if not exists` (roda duas vezes sem erro)',
  /add column if not exists arquivado_origem/.test(DDL));
{
  const ups = DDL.match(/update public\.negocios[\s\S]*?;/g) || [];
  ok('*** sao TRES updates, um por grupo de evidencia ***', ups.length === 3, ups.length);
  ok('*** e os TRES exigem `arquivado_origem is null` — nenhum sobrescreve valor existente ***',
    ups.every(u => /arquivado_origem is null/.test(u)), ups.map(u => u.slice(0, 60)));
  ok('*** e os TRES exigem `arquivado` — quem esta no funil nao ganha origem de arquivamento ***',
    ups.every(u => /\band arquivado\b/.test(u)), ups.length);
  /* O RECORTE É A CLÁUSULA `set`, E NÃO O COMANDO INTEIRO — a primeira versão deste assert olhava
     o comando todo e reprovava por causa do `arquivado_em is null` do WHERE, que é justamente a
     evidência que torna o UPDATE seguro. Instrumento que confunde a condição com o efeito. */
  const clausulaSet = u => u.slice(u.indexOf(' set '), u.indexOf(' where '));
  ok('*** NENHUM deles ESCREVE em `arquivado` ou `arquivado_em` — as duas colunas que as views leem ***',
    ups.every(u => /arquivado_origem =/.test(clausulaSet(u))
                && !/\barquivado\s*=/.test(clausulaSet(u))
                && !/\barquivado_em\s*=/.test(clausulaSet(u))), ups.map(clausulaSet));
  ok('o grupo da importacao e reconhecido pela origem E pela ausencia de carimbo',
    /origem = 'calendario_2025'/.test(ups[0]) && /arquivado_em is null/.test(ups[0]));
  /* `origem` é `not null` no esquema, mas `is distinct from` custa o mesmo e não depende disso —
     um `<>` aqui deixaria de fora, em silêncio, qualquer linha que ficasse nula amanhã. */
  ok('*** o grupo dos cliques sem carimbo usa `is distinct from` (um `<>` perderia o nulo calado) ***',
    /is distinct from 'calendario_2025'/.test(ups[1]), ups[1].slice(-90));
  ok('o grupo com carimbo e o que TEM carimbo (nao se deduz decisao de outra coisa)',
    /arquivado_em is not null/.test(ups[2]));
}
ok('*** e a data que ninguem sabe NAO e inventada: nenhum update escreve now() ***',
  !/set[^;]*now\(\)/i.test(DDL) && !/set[^;]*current_timestamp/i.test(DDL));
ok('a view de auditoria nasce com security_invoker (view nao inventa permissao)',
  /create or replace view public\.v_arquivamento_origem[\s\S]{0,80}security_invoker = on/.test(DDL));
ok('...e `anon` nao entra nela', /revoke all\s+on public\.v_arquivamento_origem\s+from anon/.test(DDL));
ok('o PostgREST e avisado do esquema novo (senao a tela grava numa coluna que ele nao conhece)',
  /notify pgrst/.test(DDL));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 6. AS DUAS OPÇÕES RECUSADAS FICAM ESCRITAS, COM O NÚMERO MEDIDO
// ══════════════════════════════════════════════════════════════════════════════════════════
// A caixa pediu duas opções medidas em vez de uma decisão. Elas não são conversa: são a razão de
// esta fatia NÃO ter mexido na bandeira, e quem ler o arquivo daqui a três meses precisa achá-las
// no mesmo lugar que a decisão — senão a próxima pessoa refaz a pergunta do zero.
console.log('\n-- 6. o que NAO foi feito, e por que --');
/* ══ O RECORTE É POR BLOCO, E ISSO SAIU DE UMA MEDIÇÃO ═══════════════════════════════════════
   A primeira versão destes asserts procurava `2.566` e `semeia_negocios.js` no ARQUIVO INTEIRO —
   e a `tools/muta_b34.js` mostrou que dois defeitos passavam por baixo: apagar o número de dentro
   da OPÇÃO B, ou apagar o endereço de dentro do achado, deixava a catraca VERDE, porque as mesmas
   palavras aparecem em outro parágrafo. Procurar no arquivo todo é a mesma cegueira do `accept`
   da régua na A31: relatório verde de quem olhou o lugar errado. */
const blocoDoc = (ini, fim) => {
  const a = DDL_BRUTO.indexOf(ini); if (a < 0) return '';
  const b = DDL_BRUTO.indexOf(fim, a + ini.length);
  return DDL_BRUTO.slice(a, b < 0 ? DDL_BRUTO.length : b);
};
const OP_A = blocoDoc('-- OPÇÃO A —', '-- OPÇÃO B —');
const OP_B = blocoDoc('-- OPÇÃO B —', '-- OPÇÃO C —');
const ACHADO = blocoDoc('-- E NINGUÉM LIGOU', '-- ══ AS DUAS OPÇÕES');

ok('*** a opcao de carimbar as atas esta escrita, com o efeito medido DENTRO dela ***',
  !!OP_A && /ZERO/.test(OP_A) && /v_atas_vigencia/.test(OP_A) && /107/.test(OP_A), OP_A.length);
ok('*** a opcao de desligar a bandeira esta escrita, com o numero do kanban DENTRO dela ***',
  !!OP_B && /\b6\b/.test(OP_B) && /2\.566/.test(OP_B), OP_B.slice(0, 120));
ok('...e as duas estao marcadas como RECUSADAS (opcao listada sem veredito vira fila)',
  /RECUSADA/.test(OP_A) && /RECUSADA/.test(OP_B));
ok('*** o achado diz QUEM ligou a bandeira, com o endereco da razao, no proprio paragrafo ***',
  !!ACHADO && /semeia_negocios\.js/.test(ACHADO) && /06\/08/.test(ACHADO)
  && /DE PROPÓSITO/.test(ACHADO), ACHADO.slice(0, 140));
ok('e diz o numero VERDADEIRO, que e maior que o da caixa (2.559, e nao 108)',
  /2\.559/.test(DDL_BRUTO) && /2\.566/.test(DDL_BRUTO) && /108/.test(DDL_BRUTO));
ok('a coluna se explica sozinha no banco (comment), com os tres valores',
  /comment on column public\.negocios\.arquivado_origem/.test(DDL)
  && /importacao_calendario_2025/.test(DDL) && /decisao_sem_carimbo/.test(DDL));
ok('*** e a bandeira velha passou a dizer, nela mesma, que sozinha nao responde nada ***',
  /comment on column public\.negocios\.arquivado is/.test(DDL) && /arquivado_origem/.test(DDL));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
