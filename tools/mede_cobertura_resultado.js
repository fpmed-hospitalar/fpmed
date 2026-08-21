/* ══════════════════════════════════════════════════════════════════════════════════════════
   mede_cobertura_resultado.js — A CADÊNCIA DA MEMÓRIA DE PREÇO (fatia A45, 21/08/2026)

   ══ O QUE A CAIXA A45 PEDIU, E O QUE MEDIR REVELOU ════════════════════════════════════════
   A caixa pediu: *"meça quanto dá para cobrir com o ritmo atual e publique a cadência, como
   fez na A34: quantas rodadas para chegar a 10%, a 25%."*

   A resposta honesta é que **10% dos itens não é alcançável pelo ritmo, e o ritmo não é o
   gargalo.** Só item de licitação ENCERRADA pode ter resultado publicado — e as encerradas são
   uma fração pequena do índice. Publicar "faltam N rodadas para 10%" seria prometer uma data
   para uma coisa que a coleta não controla.

   >>> ENTÃO O NÚMERO DE 0,9% ESTAVA COM O DENOMINADOR ERRADO. Dividir por TODOS os itens do
       índice mistura o que pode responder com o que nunca poderá — é como medir a cobrança de
       uma dívida dividindo pelo dinheiro do mundo. Este medidor publica os DOIS denominadores,
       lado a lado, e diz qual deles é a conta da coleta.

   ══ "NÃO PERGUNTEI" x "NÃO EXISTE" — O NÚMERO QUE A CAIXA MANDOU PUBLICAR ═════════════════
   O achado da A40 no esquema (`resultado_perguntado_em`) existe justamente para separar as
   duas coisas. Este medidor publica a separação: quantos foram perguntados, quantos voltaram
   COM resultado e quantos voltaram com o PNCP dizendo que não há. Um item perguntado e sem
   resultado NÃO é buraco de cobertura — é resposta, e ela conta como trabalho FEITO.

   ══ A REGRA DA CADÊNCIA É IMPORTADA, NÃO COPIADA ══════════════════════════════════════════
   O `planoDaRodada` vem do próprio `coleta_resultado_item.js`. Duas réguas de cadência
   acabariam discordando, e a que discorda calada é a que fica. E a conexão vem do
   `roda_sql.js`, pelo mesmo motivo — foi por isso que a senha dele virou leitura preguiçosa.

     node tools/mede_cobertura_resultado.js
     node tools/mede_cobertura_resultado.js --minutos 60    (cadência com outro orçamento)
   >>> ELE NÃO TOCA NO PNCP E NÃO ESCREVE NADA. São nove SELECT e uma conta.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const { conecta } = require('./roda_sql.js');
const { planoDaRodada, CARENCIA_DIAS } = require('./coleta_resultado_item.js');

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const ORCAMENTO_MIN = parseInt(arg('--minutos'), 10) || 20;
const CARENCIA = parseInt(arg('--carencia'), 10) || CARENCIA_DIAS;

const fmt = n => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const pct = (a, b) => (b > 0 ? (100 * a / b).toFixed(2).replace('.', ',') + '%' : '—');
const linha = (r) => console.log(r);

/* O `interval` entra por parâmetro do Postgres e não por concatenação: `--carencia` vem da linha
   de comando, e concatenar entrada de fora dentro de SQL é a porta que ninguém devia deixar
   aberta nem numa ferramenta de leitura. */
const SQL = `
  select
    (select count(*) from licitacao_itens)                                       as itens_total,
    (select count(*) from licitacao_itens where resultado_valor_unit is not null) as com_resultado,
    (select count(*) from licitacao_itens where resultado_perguntado_em is not null) as perguntados,
    (select count(*) from licitacao_itens
       where resultado_perguntado_em is not null and resultado_valor_unit is null) as perguntou_sem_resultado,
    (select count(distinct licitacao_id) from licitacao_itens
       where resultado_valor_unit is not null)                                   as certames_com_resultado,
    (select count(*) from licitacoes)                                            as lic_total,
    (select count(*) from licitacoes where data_encerramento is null)            as lic_sem_prazo,
    (select count(*) from licitacoes where data_encerramento < now())            as encerradas,
    (select count(*) from licitacoes
       where data_encerramento < now() - ($1 || ' days')::interval)              as maduras,
    (select count(*) from licitacoes
       where data_encerramento < now() - ($1 || ' days')::interval
         and resultado_perguntado_em is null)                                    as divida_lic,
    (select count(*) from licitacao_itens i join licitacoes l on l.id = i.licitacao_id
       where l.data_encerramento < now())                                        as itens_em_encerradas,
    (select count(*) from licitacao_itens i join licitacoes l on l.id = i.licitacao_id
       where l.data_encerramento < now() - ($1 || ' days')::interval)            as itens_em_maduras,
    (select count(*) from licitacao_itens i join licitacoes l on l.id = i.licitacao_id
       where l.data_encerramento < now() - ($1 || ' days')::interval
         and l.resultado_perguntado_em is null)                                  as itens_na_divida_bruto,
    /* ══ O TETO DE 120 ITENS POR LICITAÇÃO FAZ A DÍVIDA EM ITENS CONTAR DUAS VEZES ═══════════
       Quando o teto morde, a licitação NÃO é carimbada (é o desenho da A40: ela volta na
       próxima com o que faltou). Só que os itens que JÁ foram perguntados nela continuam
       dentro de uma licitação sem carimbo — e uma conta feita só pelo carimbo da LICITAÇÃO os
       conta como se nunca tivessem sido perguntados. Medido hoje: 3.992 no bruto, 2.792 de
       verdade; os 1.200 de diferença são 10 licitações × o teto de 120. */
    (select count(*) from licitacao_itens i join licitacoes l on l.id = i.licitacao_id
       where l.data_encerramento < now() - ($1 || ' days')::interval
         and l.resultado_perguntado_em is null
         and i.resultado_perguntado_em is null)                                  as itens_na_divida,
    (select count(distinct l.id) from licitacoes l join licitacao_itens i on i.licitacao_id = l.id
       where l.data_encerramento < now() - ($1 || ' days')::interval
         and l.resultado_perguntado_em is null
         and i.resultado_perguntado_em is not null)                              as lic_truncadas,
    /* ══ AS DUAS COLUNAS TÊM QUE CONTAR A MESMA HISTÓRIA ═══════════════════════════════════
       Item COM valor de resultado e SEM carimbo de "perguntei" é uma contradição: alguém
       gravou a resposta sem registrar a pergunta. Medido hoje: 192, todos de UMA licitação —
       são exatamente os da coleta à mão da A7, anteriores ao esquema da A40. Não é defeito
       ativo (a licitação está carimbada, então eles não voltam para a fila), mas é a única
       divergência entre as duas colunas do banco inteiro, e ela precisa ter nome. */
    (select count(*) from licitacao_itens
       where resultado_valor_unit is not null and resultado_perguntado_em is null) as valor_sem_carimbo,
    /* ══ O GARGALO DE VERDADE, E ELE NÃO É NEM O RITMO NEM O ESTOQUE DE ENCERRADAS ═════════
       O coleta_resultado_item pergunta o resultado DOS ITENS QUE ESTÃO NA NOSSA TABELA
       (ver o leLista de licitacao_itens com resultado_perguntado_em=is.null). Licitação sem
       item lido é carimbada de graça e não rende resultado nenhum.
       (Sem crase neste comentário DE PROPÓSITO: ele mora dentro de um template literal, e uma
        crase aqui fecha a string do SQL no meio — foi o que aconteceu na primeira escrita.)
       E quem lê item é a carga diária — que lê os das VIVAS, de propósito ("ler os itens de um
       edital cujo prazo passou não serve para PROPOR nada"). Ou seja: a memória de preço está
       presa a uma decisão tomada em OUTRA ferramenta, por um motivo que era certo para a outra
       pergunta. Medido hoje: 2.687 das 2.848 licitações da dívida (94%) não têm item nenhum. */
    (select count(*) from licitacoes
       where data_encerramento < now() - ($1 || ' days')::interval
         and itens_lidos_em is null)                                             as maduras_sem_itens_lidos,
    (select count(*) from licitacoes
       where data_encerramento < now() - ($1 || ' days')::interval
         and resultado_perguntado_em is null and itens_lidos_em is null)         as divida_sem_itens_lidos
`;

/* A TAXA REAL DA ÚLTIMA RODADA, do carimbo — a mesma que o coletor usa para dimensionar o teto.
   Chutar 6,0 aqui daria uma cadência que não é a da máquina; ler o carimbo dá a da máquina. */
const SQL_CARIMBO = `select detalhe from coleta_status where fonte = 'RESULTADO_ITEM'`;

/* Quantos itens com resultado cada licitação fechada rende, MEDIDO na última rodada. É este
   número que transforma "faltam N licitações" em "faltam M itens" — sem ele, a cadência em
   itens seria uma regra de três com um fator inventado. */
function rendimento(d) {
  if (!d) return null;
  const lics = Number(d.licitacoes_fechadas), itens = Number(d.itens_com_resultado);
  return (lics > 0 && isFinite(itens)) ? itens / lics : null;
}

/* ══ A PROJEÇÃO — E ELA JÁ ERRRARA UMA VEZ, POR MÉDIA APLICADA AO CONJUNTO ERRADO ══════════
   A primeira escrita multiplicava as 2.848 licitações da dívida por 9,5 (o rendimento medido)
   e anunciava +27.088 itens. Falso: a última rodada rendeu 9,5 porque caiu em licitações QUE
   TINHAM ITENS LIDOS, e 94% das da dívida de hoje não têm nenhum — o coletor as visita, acha a
   lista vazia, carimba e segue, com ganho zero.
   >>> A REGRA CERTA MULTIPLICA O QUE EXISTE PARA PERGUNTAR pela taxa de resposta. Média
       aplicada ao conjunto errado é o jeito mais limpo de publicar um número que ninguém
       consegue contestar e que está errado.
   É função à parte, e exportada, para que a catraca cobre exatamente esta escolha. */
function projecao(o) {
  /* ══ `Number(null)` É ZERO, E ZERO AQUI É UMA AFIRMAÇÃO ═════════════════════════════════
     A primeira escrita fazia só `Number(o.taxaResposta)` e caía na armadilha: sem taxa medida,
     a projeção devolvia 0 e o medidor publicava "zerar a dívida inteira ganharia +0 itens".
     Isso não é ausência de resposta, é uma resposta ERRADA e desanimadora — e é a lei da A19
     na aritmética: "não medi" nunca pode virar "medi e deu zero". O `== null` explícito é o
     que separa as duas. (Achado pelo assert 6 da catraca, e não por leitura.) */
  if (o == null || o.itensPendentes == null || o.taxaResposta == null) return null;
  const pendentes = Number(o.itensPendentes);
  const taxa = Number(o.taxaResposta);
  if (!isFinite(pendentes) || pendentes < 0 || !isFinite(taxa) || taxa < 0 || taxa > 1) return null;
  return Math.round(pendentes * taxa);
}

function taxaDeResposta(perguntados, semResultado) {
  const p = Number(perguntados), s = Number(semResultado);
  if (!isFinite(p) || p <= 0 || !isFinite(s) || s < 0 || s > p) return null;
  return (p - s) / p;
}

/* A PORTA DA CATRACA: quem faz `require` recebe as regras puras e o texto do SQL, e NÃO abre
   conexão com o banco. A mesma lei da A34 que fez a senha do roda_sql virar leitura preguiçosa. */
module.exports = { projecao, taxaDeResposta, rendimento, pct, SQL };
if (require.main !== module) return;

(async () => {
  const c = await conecta();
  let r, carimbo;
  try {
    r = (await c.query(SQL, [String(CARENCIA)])).rows[0];
    carimbo = (await c.query(SQL_CARIMBO)).rows[0];
  } finally { await c.end(); }

  const n = k => Number(r[k]);
  const d = (carimbo && carimbo.detalhe) || null;
  const plano = planoDaRodada({ divida: n('divida_lic'), orcamentoMin: ORCAMENTO_MIN,
                                taxaAnterior: d && d.seg_por_lic });
  const rend = rendimento(d);

  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('  A MEMÓRIA DE PREÇO — COBERTURA E CADÊNCIA (fatia A45)');
  console.log('  ' + new Date().toLocaleString('pt-BR') + '   ·   carência: ' + CARENCIA + ' dias');
  console.log('════════════════════════════════════════════════════════════════════════');

  // ── 1. OS DOIS DENOMINADORES ─────────────────────────────────────────────────────────────
  linha('\n── 1. COBERTURA: o mesmo numerador, dois denominadores ──');
  linha('  itens com resultado ............. ' + fmt(n('com_resultado'))
    + '   em ' + fmt(n('certames_com_resultado')) + ' certames');
  linha('');
  linha('  sobre TODOS os itens do índice ... ' + pct(n('com_resultado'), n('itens_total'))
    + '   (' + fmt(n('com_resultado')) + ' de ' + fmt(n('itens_total')) + ')');
  linha('  sobre os que PODEM responder .... ' + pct(n('com_resultado'), n('itens_em_maduras'))
    + '   (' + fmt(n('com_resultado')) + ' de ' + fmt(n('itens_em_maduras'))
    + ' em encerradas há ' + CARENCIA + '+ dias)');
  linha('  >>> O SEGUNDO É A CONTA DA COLETA. Item de licitação viva não tem resultado publicado');
  linha('      porque a licitação ainda não acabou — ele não é buraco, é futuro.');

  // ── 2. O TETO: o ritmo não é o gargalo ───────────────────────────────────────────────────
  const tetoHoje = n('itens_em_encerradas');
  linha('\n── 2. O TETO DE HOJE, e por que 10% não depende do ritmo ──');
  linha('  itens em licitações ENCERRADAS .. ' + fmt(tetoHoje)
    + '   = ' + pct(tetoHoje, n('itens_total')) + ' do índice');
  linha('  >>> ESSE É O TETO ABSOLUTO: nem que se perguntasse item por item de TODAS as');
  linha('      encerradas, a cobertura sobre o índice inteiro passaria de ' + pct(tetoHoje, n('itens_total')) + '.');
  const taxaResposta = taxaDeResposta(n('perguntados'), n('perguntou_sem_resultado'));
  if (taxaResposta != null) {
    linha('  e o PNCP responde em ' + (100 * taxaResposta).toFixed(1).replace('.', ',') + '% dos itens perguntados,');
    linha('  então o teto REALISTA é ' + pct(Math.round(tetoHoje * taxaResposta), n('itens_total'))
      + ' do índice (' + fmt(Math.round(tetoHoje * taxaResposta)) + ' itens).');
  }
  for (const alvo of [0.10, 0.25]) {
    const precisa = Math.round(alvo * n('itens_total'));
    const alcancavel = taxaResposta != null ? Math.round(tetoHoje * taxaResposta) : tetoHoje;
    linha('  · ' + (alvo * 100) + '% do índice = ' + fmt(precisa) + ' itens  ->  '
      + (precisa <= alcancavel
          ? 'ALCANÇÁVEL com o estoque de encerradas de hoje'
          : 'NÃO alcançável hoje: faltariam ' + fmt(precisa - alcancavel)
            + ' itens que ainda não existem em encerrada nenhuma'));
  }
  linha('  >>> O GARGALO NÃO É A VELOCIDADE, É O ESTOQUE. Mais orçamento não cria encerrada.');
  linha('      O que cria é o tempo passando: ' + fmt(n('encerradas') - n('maduras'))
    + ' encerradas ainda estão dentro da carência de ' + CARENCIA + ' dias e viram fila sozinhas.');
  linha('      E ' + fmt(n('lic_sem_prazo')) + ' licitações do índice não têm data de encerramento:');
  linha('      elas não entram nesta conta de lado nenhum — não dá para saber se já encerraram.');

  // ── 3. "NÃO PERGUNTEI" x "NÃO EXISTE" ────────────────────────────────────────────────────
  linha('\n── 3. O NÚMERO HONESTO: perguntado e sem resposta NÃO é buraco ──');
  linha('  itens perguntados ao PNCP ....... ' + fmt(n('perguntados')));
  linha('    · voltaram COM resultado ...... ' + fmt(n('perguntados') - n('perguntou_sem_resultado'))
    + '   (' + pct(n('perguntados') - n('perguntou_sem_resultado'), n('perguntados')) + ' dos perguntados)');
  linha('    · o PNCP disse que NÃO HÁ ..... ' + fmt(n('perguntou_sem_resultado'))
    + '   (' + pct(n('perguntou_sem_resultado'), n('perguntados')) + ')');
  linha('  >>> ESSES ' + fmt(n('perguntou_sem_resultado')) + ' SÃO TRABALHO FEITO, e não dívida.');
  linha('      Sem o `resultado_perguntado_em` da A40 eles seriam indistinguíveis de "não');
  linha('      perguntei" e voltariam para a fila em toda rodada, para sempre.');
  /* A conferência das duas colunas: resposta gravada sem pergunta registrada. */
  linha('  conferência das duas colunas .... ' + fmt(n('valor_sem_carimbo'))
    + ' item(ns) COM valor e SEM carimbo de "perguntei"');
  if (n('valor_sem_carimbo') > 0) {
    linha('      >>> São os da coleta à mão da A7, anteriores ao esquema da A40. Não voltam para a');
    linha('          fila (a licitação deles está carimbada), mas quem contar "perguntados" pela');
    linha('          coluna do item vai errar por ' + fmt(n('valor_sem_carimbo')) + ' para menos.');
  }

  // ── 4. A CADÊNCIA DA DÍVIDA QUE EXISTE ───────────────────────────────────────────────────
  linha('\n── 4. A CADÊNCIA — sobre a dívida que a coleta REALMENTE tem ──');
  linha('  encerradas há ' + CARENCIA + '+ dias ......... ' + fmt(n('maduras')));
  linha('  dessas, nunca perguntadas ....... ' + fmt(n('divida_lic'))
    + '   (' + fmt(n('itens_na_divida')) + ' itens ainda por perguntar)');
  if (n('lic_truncadas') > 0) {
    linha('  >>> DESSAS, ' + fmt(n('lic_truncadas')) + ' JÁ FORAM VISITADAS e não estão carimbadas:');
    linha('      elas bateram no teto de itens por licitação e voltam para pegar o que faltou.');
    linha('      Contada pelo carimbo da LICITAÇÃO, a dívida em itens daria '
      + fmt(n('itens_na_divida_bruto')) + ' — ' + fmt(n('itens_na_divida_bruto') - n('itens_na_divida'))
      + ' a mais,');
    linha('      porque contaria de novo item que já foi perguntado. A conta certa olha as DUAS colunas.');
  }
  linha('  ritmo ........................... ' + plano.segPorLic.toFixed(2) + ' s por licitação '
    + (plano.medida ? '(MEDIDO na rodada anterior)' : '(valor de partida — sem medida anterior)'));
  linha('  cabem num orçamento de ' + ORCAMENTO_MIN + ' min .... ' + fmt(plano.cabe) + ' licitações');
  if (plano.zeraHoje) {
    linha('  >>> A DÍVIDA CABE NUMA RODADA SÓ. Não há cadência a publicar.');
  } else {
    linha('  >>> SÃO ' + plano.rodadasParaZerar + ' RODADAS de ' + ORCAMENTO_MIN
      + ' min para zerar. Numa só: --minutos ' + plano.minutosParaZerar + '.');
  }
  /* ══ A PROJEÇÃO É FEITA PELOS ITENS PENDENTES, E NÃO PELO RENDIMENTO POR LICITAÇÃO ═══════
     A primeira versão desta linha multiplicava 2.848 licitações por 9,5 (o rendimento da
     última rodada) e anunciava +27.088 itens. É um número bonito e é falso: a última rodada
     rendeu 9,5 porque caiu em licitações QUE TINHAM ITENS LIDOS. As da dívida de hoje, 94% não
     têm nenhum — o coletor vai visitá-las, achar a lista vazia, carimbar e seguir.
     >>> ENTÃO A PROJEÇÃO OLHA O QUE EXISTE PARA PERGUNTAR (itens pendentes), e não o que uma
         média de outro conjunto sugeriria. Média aplicada ao conjunto errado é o jeito mais
         limpo de publicar um número que ninguém consegue contestar e que está errado. */
  if (taxaResposta != null) {
    const ganho = projecao({ itensPendentes: n('itens_na_divida'), taxaResposta });
    linha('  taxa de resposta medida ......... ' + (100 * taxaResposta).toFixed(1).replace('.', ',')
      + '% dos itens perguntados voltam com resultado');
    linha('  >>> ZERAR ESSA DÍVIDA INTEIRA LEVARIA A COBERTURA A ' + fmt(n('com_resultado') + ganho)
      + ' itens = ' + pct(n('com_resultado') + ganho, n('itens_total')) + ' do índice.');
    linha('      É +' + fmt(ganho) + ', e não mais: a projeção multiplica os ' + fmt(n('itens_na_divida'))
      + ' itens PENDENTES');
    linha('      pela taxa de resposta — não o número de licitações por um rendimento médio.');
  }

  // ── 5. O GARGALO DE VERDADE ──────────────────────────────────────────────────────────────
  linha('\n── 5. O GARGALO NÃO É ESTA FERRAMENTA ──');
  linha('  licitações da dívida SEM item lido  ' + fmt(n('divida_sem_itens_lidos'))
    + ' de ' + fmt(n('divida_lic'))
    + '   (' + pct(n('divida_sem_itens_lidos'), n('divida_lic')) + ')');
  linha('  >>> ELAS SERÃO CARIMBADAS DE GRAÇA. O coletor pergunta o resultado DOS ITENS QUE');
  linha('      ESTÃO NA NOSSA TABELA; licitação sem item lido tem a lista vazia, é carimbada e');
  linha('      segue — custo zero de requisição e ganho zero de memória de preço.');
  linha('  >>> E QUEM LÊ ITEM É A CARGA DIÁRIA, QUE LÊ OS DAS VIVAS, DE PROPÓSITO. A razão dela');
  linha('      é boa para a pergunta dela ("ler item de edital vencido não serve para PROPOR").');
  linha('      Para a memória de preço é o contrário — e o mesmo dado é lixo para uma pergunta e');
  linha('      é o buraco nº 1 do produto para a outra (palavras do cabeçalho da A40).');
  if (rend != null) {
    const potencial = Math.round(n('maduras_sem_itens_lidos') * rend);
    linha('  >>> O TAMANHO DO LEVER, ESTIMADO: ler os itens das ' + fmt(n('maduras_sem_itens_lidos'))
      + ' maduras sem item');
    linha('      renderia da ordem de ' + fmt(potencial) + ' itens com resultado (a '
      + rend.toFixed(1).replace('.', ',') + ' por licitação, medido na última rodada) —');
    linha('      cerca de ' + pct(n('com_resultado') + potencial, n('itens_total'))
      + ' do índice. É AQUI que estão os 10%, e não na velocidade.');
    linha('      >>> É ESTIMATIVA, e a base dela é uma média de OUTRO conjunto (as licitações que');
    linha('          já tinham item lido). Serve para dimensionar a decisão, não para prometer.');
  }
  linha('  >>> DECISÃO DE PRODUTO, NÃO MINHA: gastar orçamento de leitura de itens em licitação');
  linha('      ENCERRADA tira orçamento de VIVA, que é a que ainda dá para propor. Quem escolhe');
  linha('      entre "vender amanhã" e "saber o preço" é o dono.');

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log('  nada foi escrito, e o PNCP não foi tocado.');
  console.log('════════════════════════════════════════════════════════════════════════');
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
