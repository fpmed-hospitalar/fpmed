/* ═══════════════════════════════════════════════════════════════════════════════════════════
   coleta_resultado_item.js — A MEMÓRIA DE PREÇO (fatia A40, 20/08/2026)

   ══ A TELA ESTÁ PRONTA E O DADO NÃO EXISTE ══════════════════════════════════════════════════
   O trabalhador B entregou a B28: as telas dele já mostram por quanto o item JÁ FOI VENDIDO ao
   poder público, ao lado do teto CMED. Medido pelo arquiteto em 20/08:
       `resultado_valor_unit` preenchido em 192 de 358.710 itens — 0,053%
   e os 192 vêm de UM único certame (Pedra Bonita/MG, material escolar), colhido à mão na A7. O
   B provou a mediana contra o `percentile_cont` do Postgres e deixou o caminho da FAIXA escrito
   e NÃO EXERCIDO, porque não há dois resultados do mesmo produto no banco inteiro.
   >>> ESTE COLETOR EXISTE PARA LIGAR AQUELE CAMINHO. Ele não desenha nada: ele enche a coluna.

   ══ E AS ENCERRADAS DEIXAM DE SER LIXO ══════════════════════════════════════════════════════
   A carga diária conta 5.305 licitações ENCERRADAS sem item e as trata (com razão) como dívida
   que não vale pagar: ler os itens de um edital cujo prazo passou não serve para PROPOR nada.
   Para memória de PREÇO é o contrário — só a encerrada tem resultado. O mesmo dado é lixo para
   uma pergunta e é o buraco nº 1 do produto para a outra.

   ══ A CARÊNCIA, E ELA É MEDIDA — É O ACHADO DESTA FATIA ═════════════════════════════════════
   Resultado é UMA requisição POR ITEM: não existe endpoint de lote (sondado em 20/08 — o
   `/compras/{ano}/{seq}/resultados` devolve 404, e o `/itens/{n}/resultados` devolve 204 quando
   ainda não há julgamento). Então a pergunta que decide se isto é ferramenta ou abuso é: *a
   partir de quando vale a pena bater nesta porta?*

   MEDIDO em 20/08 (`tools/_a40_carencia.js`, 40 licitações, 4 itens cada, 108 perguntas):

       encerrada há    itens perguntados    com resultado
       ─────────────   ─────────────────    ─────────────
       < 7 dias                    26        0   (0%)     <<< ZERO
       7 a 30 dias                 21        8   (38%)
       30 a 90 dias                21       13   (62%)
       90 a 180 dias               20       10   (50%)
       > 180 dias                  20        8   (40%)

   >>> ZERO DE VINTE E SEIS, E ESSA FAIXA É A MAIORIA DA FILA: das 7.122 encerradas do índice,
       4.355 (61%) encerraram há menos de 7 dias. Uma varredura "de todas as encerradas" gastaria
       a MAIOR PARTE das requisições contra um serviço público na única faixa que medidamente não
       responde nada — e o log diria "0 resultados" sem dizer por quê, o que faria a próxima
       pessoa concluir que o PNCP não publica resultado.
   >>> A CARÊNCIA NÃO É TOLERÂNCIA, É PONTARIA. Homologação leva dias; perguntar antes disso é
       perguntar a resposta que ainda não foi escrita. O número (7 dias) é o primeiro degrau onde
       a medição deixa de ser zero, e ele é PARÂMETRO (`--carencia`), não tinta.

   ══ "NÃO PERGUNTEI" NÃO É "NÃO EXISTE" — E SEM ISSO A FILA NUNCA ESVAZIA ════════════════════
   `resultado_lido_em` só é escrito quando HÁ resultado. Sem um segundo carimbo, o item que
   voltou vazio é indistinguível do item que nunca foi perguntado — e os 39.976 itens de
   encerradas voltariam para a fila em TODA rodada, para sempre. É a lei da A19 no esquema, e ela
   virou `ddl/resultado_perguntado.sql`: `resultado_perguntado_em` no item e na licitação.

   ══ RITMO EDUCADO E ORÇAMENTO DECLARADO, IGUAL À A34 ════════════════════════════════════════
   Teto dimensionado pela dívida (nunca um número fixo), ritmo aprendido da rodada anterior e
   gravado no carimbo, e o saldo dito COM CADÊNCIA — "faltam N; neste orçamento são M rodadas;
   numa só, `--minutos X`". Saldo sem cadência esconde a única pergunta que importa: isto está
   sendo pago, ou está andando para trás?

     node tools/coleta_resultado_item.js                (rodada padrão, 20 min)
     node tools/coleta_resultado_item.js --minutos 60
     node tools/coleta_resultado_item.js --saldo        (só mede a dívida; não toca no PNCP)
     node tools/coleta_resultado_item.js --previa       (diz o que faria; não grava)
     node tools/coleta_resultado_item.js --carencia 30  (só o que encerrou há 30+ dias)
     node tools/coleta_resultado_item.js --controle 01640429000106-1-000117/2026
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
/* Emprestados, e não copiados: duas réguas de "estou indo rápido demais" acabam discordando, e
   as duas batem no mesmo portal público. A que discorda calada é a que fica. */
const { criaBreaker, esperaBackoff, criaRitmo, esperaRateLimit } = require('./coleta_pncp.js');

/* A credencial é lida QUANDO FOR USADA, e não ao carregar o arquivo — a lição da A34: regra que
   só pode ser testada com a chave-mestra na mão é regra que ninguém testa. */
let _banco = null;
function banco() {
  if (_banco) return _banco;
  const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
  const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
  const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
  if (!SR) { console.error('service_role nao encontrada em segredos.local.txt'); process.exit(1); }
  _banco = { SB, H: { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' } };
  return _banco;
}

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = n => process.argv.includes(n);
const dormir = ms => new Promise(r => setTimeout(r, ms));
const num = v => (v == null || v === '' || !isFinite(Number(v))) ? null : Number(v);
const fmt = n => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

const PREVIA = tem('--previa');
const SO_SALDO = tem('--saldo');
const ORCAMENTO_MIN = parseInt(arg('--minutos'), 10) || 20;
/* 7 DIAS — o primeiro degrau onde a medição deixa de ser zero. Ver o cabeçalho: 0 de 26 abaixo
   disso. É parâmetro porque a realidade pode mudar; é 7 porque foi o que se mediu hoje. */
const CARENCIA_DIAS = parseInt(arg('--carencia'), 10) || 7;
/* TETO DE ITENS POR LICITAÇÃO. Um edital de 600 itens são 600 requisições, e ele sozinho comeria
   a rodada inteira. Quando o teto morde, a licitação NÃO é carimbada: ela volta na próxima, com
   os itens que faltam. Teto silencioso é o mesmo defeito do `limit=1000` com outro número. */
const TETO_ITENS_POR_LIC = parseInt(arg('--itens-por-lic'), 10) || 120;
const SEG_POR_LIC_PADRAO = 6.0;   // valor de partida: pior caso conhecido, não o melhor

/* ══ O PLANO DA RODADA — FUNÇÃO PURA, PORQUE ELA É A REGRA DA FATIA ═══════════════════════════
   Entra: a dívida medida, o orçamento em minutos e a taxa que a rodada anterior deixou.
   Sai:   o teto, e a CADÊNCIA — em quantas rodadas deste tamanho a dívida se paga.
   Não lê banco, não imprime, não roda nada — é por isso que a catraca consegue perguntar
   "qual o teto para 1.817 de dívida?" sem falar com o governo. */
function planoDaRodada(o) {
  const orcamentoMin = o.orcamentoMin;
  const divida = (o.divida != null && o.divida > 0) ? o.divida : null;
  /* `> 0.2` recusa medida absurda: uma rodada que morreu em dois segundos sem processar nada
     devolveria uma taxa perto de zero e o teto seguinte seria astronômico — e aí a rodada
     morreria de novo, agora por culpa da própria medição. O piso é maior que o da carga porque
     aqui a unidade é mais cara: uma licitação são N requisições, não uma. */
  const taxa = Number(o.taxaAnterior);
  const medida = isFinite(taxa) && taxa > 0.2;
  const segPorLic = medida ? taxa : SEG_POR_LIC_PADRAO;
  /* os 25% de folga são do relógio, e não do alvo: uma rodada que enche o orçamento até a borda
     é uma rodada que a primeira lentidão da rede mata no meio. */
  const segundosUteis = orcamentoMin * 60 * 0.75;
  const cabe = Math.max(5, Math.floor(segundosUteis / segPorLic));
  const teto = divida == null ? cabe : Math.max(5, Math.min(divida, cabe));
  const zeraHoje = divida == null ? true : divida <= cabe;
  const rodadasParaZerar = (divida != null && !zeraHoje) ? Math.ceil(divida / cabe) : null;
  const minutosParaZerar = (divida != null && !zeraHoje)
    ? Math.ceil((divida * segPorLic) / (60 * 0.75)) : null;
  return { segPorLic, medida, cabe, teto, divida, zeraHoje, rodadasParaZerar, minutosParaZerar };
}

/* ══ O SALDO DITO POR INTEIRO — saldo E cadência ═════════════════════════════════════════════
   A mesma regra da A34, e ela mora aqui junto do plano que a alimenta: separá-las é como uma
   delas passa a mentir sobre a outra. */
function textoDoSaldo(saldo, plano) {
  if (saldo == null) return null;                       // a lei da A19: não medi ≠ está zerada
  if (saldo <= 0) return 'saldo: a fila de resultado das encerradas está zerada';
  const base = 'saldo: faltam ' + fmt(saldo) + ' licitações encerradas sem resultado perguntado';
  if (!plano || plano.rodadasParaZerar == null) return base;
  return base + ' — neste orçamento são ' + plano.rodadasParaZerar
    + ' rodadas; para zerar numa só, --minutos ' + plano.minutosParaZerar;
}

/* `vencedor` e `linhaDoItem` são declarações de função: ficam de pé mesmo com o `return` abaixo,
   e é por isso que a catraca consegue exercitá-las sem a chave-mestra e sem falar com o PNCP. */
module.exports = { planoDaRodada, textoDoSaldo, vencedor, linhaDoItem,
                   CARENCIA_DIAS: 7, SEG_POR_LIC_PADRAO };
if (require.main !== module) return;

// ── as conversas ────────────────────────────────────────────────────────────────────────────
const TENTATIVAS_BANCO = 3;
async function fetchBanco(url, opcoes, oQue) {
  let ultimo = null;
  for (let t = 0; t < TENTATIVAS_BANCO; t++) {
    try { return await fetch(url, opcoes); }
    catch (e) {
      /* Só falha de TRANSPORTE cai aqui. 4xx/5xx voltam como `r` e quem chamou confere o `r.ok`.
         É o irmão do conserto da A34, e ele existe pelo mesmo motivo: `r.ok` só existe se a
         resposta CHEGOU. */
      ultimo = e;
      if (t === TENTATIVAS_BANCO - 1) break;
      const espera = esperaBackoff(t);
      console.log(`    ! banco (${oQue}): ${e.message} — nova tentativa em ${espera / 1000}s`);
      await dormir(espera);
    }
  }
  throw new Error(`${oQue}: ${ultimo && ultimo.message} (${TENTATIVAS_BANCO} tentativas)`);
}

async function le(caminho, oQue, extra) {
  const { SB, H } = banco();
  const r = await fetchBanco(SB + '/rest/v1/' + caminho, { headers: Object.assign({}, H, extra || {}) }, oQue);
  if (!r.ok) {
    const t = await r.text();
    console.error(`\n🔴 não consegui perguntar ao banco (${oQue}): HTTP ${r.status} ${t.slice(0, 160)}`);
    console.error('   ISTO NÃO É "não achei" — é "não consegui olhar". As duas levam a ações diferentes.');
    process.exit(1);
  }
  return r;
}
async function leLista(caminho, oQue) {
  const j = await (await le(caminho, oQue)).json();
  if (!Array.isArray(j)) { console.error(`\n🔴 a resposta de ${oQue} veio 200 mas não é uma lista`); process.exit(1); }
  return j;
}
// A contagem vem do SERVIDOR (`content-range`). Contar pelo `length` devolveria 1000 — o teto do
// PostgREST que já mordeu esta obra quatro vezes.
async function conta(caminho, oQue) {
  const r = await le(caminho, oQue, { Prefer: 'count=exact', Range: '0-0' });
  const n = parseInt(String(r.headers.get('content-range') || '').split('/')[1], 10);
  return isFinite(n) ? n : null;
}

/* ══ A CONVERSA COM O PNCP ═══════════════════════════════════════════════════════════════════
   204 e corpo em branco são "ainda não foi julgado" — a resposta NORMAL, e não uma falha. Ruído
   de erro no caso normal é como se ensina alguém a ignorar erro (lição da A7, repetida aqui).
   404 idem: o órgão não publicou o resultado daquele item. */
async function puxaResultado(url, breaker, ritmo) {
  let t = 0, t429 = 0;
  while (t < 4) {
    if (breaker.aberto) return { erro: 'breaker aberto' };
    if (ritmo.estourou) return { erro: `rate limit persistente do PNCP (${ritmo.vezes}x)` };
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 45000);
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ac.signal });
      clearTimeout(to);
      if (r.status === 429) {
        const espera = esperaRateLimit(t429++, r.headers.get('retry-after'));
        const nova = ritmo.freou();
        console.log(`    ~ 429 — desacelerando pra ${nova}ms entre chamadas, esperando ${espera / 1000}s`);
        await dormir(espera);
        continue;
      }
      if (r.status === 404 || r.status === 204) { breaker.ok(); return { semResultado: true }; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      breaker.ok();
      if (!txt.trim()) return { semResultado: true };
      const j = JSON.parse(txt);
      if (!Array.isArray(j)) return { erro: '200 com algo que não é uma lista' };
      return { dados: j };
    } catch (e) {
      clearTimeout(to);
      const abriu = breaker.falhou();
      const espera = esperaBackoff(t++);
      console.log(`    ! ${e.name === 'AbortError' ? 'timeout' : e.message} (falha ${breaker.seguidas})`
        + (abriu ? ' — BREAKER ABERTO, parando' : ` — nova tentativa em ${espera / 1000}s`));
      if (abriu) return { erro: String(e.message || e.name) };
      await dormir(espera);
    }
  }
  return { erro: 'esgotou as tentativas' };
}

/* O PNCP pode publicar MAIS DE UM resultado por item (remanescente, cancelamento,
   reclassificação). Fica o de menor `ordemClassificacaoSrp` entre os NÃO cancelados — quem
   ganhou é o primeiro classificado que não foi cancelado. Pegar o último inserido entregaria um
   CANCELAMENTO como se fosse o vencedor, e essa regra é a mesma da A7: uma só, e emprestada. */
function vencedor(lista) {
  if (!Array.isArray(lista) || !lista.length) return null;
  const vivos = lista.filter(x => !x.dataCancelamento);
  if (!vivos.length) return null;
  return vivos.sort((a, b) => (a.ordemClassificacaoSrp || 99) - (b.ordemClassificacaoSrp || 99))[0];
}

/* ══ TODA LINHA DO LOTE TEM AS MESMAS CHAVES — E ISSO NÃO É ESTILO, É O CONTRATO ══════════════
   Um upsert em lote vira UM `INSERT ... VALUES (…),(…)`: a lista de colunas é UMA só. Por isso o
   PostgREST recusa o lote INTEIRO com `PGRST102 "All object keys must match"` quando um objeto
   tem chave que o outro não tem.
   >>> E ISSO DERRUBOU A PRIMEIRA RODADA DE VERDADE, medido às 15:02: a linha do item COM
       resultado tinha 10 chaves e a do item SEM tinha 4 — e como quase toda licitação tem os
       dois, o lote que passava era a EXCEÇÃO. É o irmão do `23502` da rodada anterior, e os dois
       nasceram do mesmo hábito: montar a linha aos pedaços, com `if`.
   >>> A CORREÇÃO NÃO É UM `try` — é a linha ter FORMA. Uma função só, que devolve sempre o mesmo
       conjunto de chaves, com ou sem vencedor. Assim o formato deixa de depender do que o PNCP
       respondeu, e passa a ser conferível sem falar com o governo (ver a catraca).
   >>> O NULO AQUI É AFIRMAÇÃO, NÃO DESCUIDO. A consulta dos pendentes só traz item com
       `resultado_valor_unit is null`: escrever `null` não apaga resultado de ninguém — diz
       "perguntei, e não havia julgamento". É a coluna nova falando a terceira resposta. */
function linhaDoItem(lic, it, v, agora) {
  return {
    numero_controle: lic.numero_controle,
    numero_item: it.numero_item,
    descricao: it.descricao,
    resultado_perguntado_em: agora,                                  // SEMPRE — perguntei
    resultado_vencedor:   v ? (v.nomeRazaoSocialFornecedor || null) : null,
    resultado_cnpj:       v ? (v.niFornecedor || null) : null,
    resultado_valor_unit: v ? num(v.valorUnitarioHomologado) : null,
    resultado_quantidade: v ? num(v.quantidadeHomologada) : null,
    resultado_situacao:   v ? (v.situacaoCompraItemResultadoNome || 'homologado') : null,
    resultado_lido_em:    v ? agora : null,                          // SÓ quando há resultado
  };
}

/* ══ O RETRATO — a mesma régua nas duas pontas ═══════════════════════════════════════════════
   Antes e depois medidos pela MESMA função. Esta obra já pagou por medir o antes com um curl e o
   depois com outro: a diferença entre as duas contas apareceu como ganho (A29). */
async function retrato() {
  const [itens, comResultado, perguntados] = await Promise.all([
    conta('licitacao_itens?select=id', 'total de itens'),
    conta('licitacao_itens?select=id&resultado_valor_unit=not.is.null', 'itens com resultado'),
    conta('licitacao_itens?select=id&resultado_perguntado_em=not.is.null', 'itens perguntados'),
  ]);
  return { itens, com_resultado: comResultado, perguntados };
}

// ── a rodada ────────────────────────────────────────────────────────────────────────────────
(async () => {
  const limite = new Date(Date.now() - CARENCIA_DIAS * 86400000).toISOString();
  const controle = arg('--controle');

  /* Os FILTROS moram numa constante só, e as duas consultas (contar e listar) são a mesma
     pergunta com colunas diferentes. Escrevê-los duas vezes é como o teto passa a contar uma
     dívida que a listagem não percorre — e ninguém descobre, porque os dois números só se
     encontram no relatório. */
  const ELEGIVEIS = '&itens_lidos_em=not.is.null&resultado_perguntado_em=is.null'
    + '&data_encerramento=lt.' + limite;
  const contaDivida = () => conta('licitacoes?select=id' + ELEGIVEIS, 'a dívida de resultado');

  console.log('=== RESULTADO HOMOLOGADO POR ITEM (fatia A40) ===' + (PREVIA ? '   [PRÉVIA]' : ''));
  console.log('carência: ' + CARENCIA_DIAS + ' dias desde o encerramento'
    + '   (medido em 20/08: 0 de 26 itens têm resultado abaixo de 7 dias)');

  const antes = await retrato();
  const divida = controle ? null : await contaDivida();
  console.log('ANTES: ' + fmt(antes.com_resultado) + ' de ' + fmt(antes.itens) + ' itens com resultado ('
    + (antes.itens ? (antes.com_resultado / antes.itens * 100).toFixed(3) : '—') + '%)'
    + ' · ' + fmt(antes.perguntados) + ' já perguntados');

  // o carimbo da rodada anterior, para a taxa
  let carimboAntes = null;
  try {
    const j = await (await le('coleta_status?fonte=eq.RESULTADO_ITEM&select=*', 'o carimbo anterior')).json();
    carimboAntes = (Array.isArray(j) && j[0]) ? j[0] : null;
  } catch (_) {}

  const plano = planoDaRodada({
    divida, orcamentoMin: ORCAMENTO_MIN,
    taxaAnterior: carimboAntes && carimboAntes.detalhe && carimboAntes.detalhe.seg_por_lic,
  });
  console.log('DÍVIDA: ' + fmt(divida) + ' licitações encerradas elegíveis'
    + '   · ritmo: ' + plano.segPorLic.toFixed(2) + ' s/licitação '
    + (plano.medida ? '(medido na rodada anterior)' : '(valor de partida)')
    + '   · cabem: ' + fmt(plano.cabe) + '   · teto: ' + fmt(plano.teto));
  if (!plano.zeraHoje) console.log('   ⚠ neste orçamento (' + ORCAMENTO_MIN + ' min) são '
    + plano.rodadasParaZerar + ' rodadas para zerar. Numa só: --minutos ' + plano.minutosParaZerar);

  if (SO_SALDO) { console.log('\n' + textoDoSaldo(divida, plano)); return; }

  const alvos = controle
    ? await leLista('licitacoes?select=id,numero_controle,cnpj,ano,sequencial,data_encerramento'
        + '&numero_controle=eq.' + encodeURIComponent(controle), 'a licitação pelo controle')
    /* DA QUE ENCERROU MAIS RECENTEMENTE PARA A MAIS ANTIGA, dentro do que a carência libera. A
       razão é de PRODUTO e não de rendimento: memória de preço vale mais quanto mais fresca, e
       um preço homologado de vinte dias atrás responde melhor "até onde posso baixar" do que um
       de dois anos. As taxas medidas por faixa (38% · 62% · 50% · 40%) são próximas o bastante
       para que a ordem não seja decidida por elas — e elas saem no log, para quem quiser. */
    : await leLista('licitacoes?select=id,numero_controle,cnpj,ano,sequencial,data_encerramento'
        + ELEGIVEIS + '&order=data_encerramento.desc&limit=' + plano.teto, 'as licitações elegíveis');

  if (!alvos.length) { console.log('\nnada elegível nesta rodada.'); console.log(textoDoSaldo(divida, plano)); return; }

  if (PREVIA) {
    console.log('\n--previa: perguntaria o resultado dos itens de ' + alvos.length + ' licitação(ões),');
    console.log('a começar por ' + alvos[0].numero_controle + ' (encerrou ' + alvos[0].data_encerramento + ').');
    console.log('nada foi executado e nada foi gravado.');
    return;
  }

  const t0 = Date.now();
  const limiteMs = ORCAMENTO_MIN * 60000;
  const breaker = criaBreaker(), ritmo = criaRitmo();
  let feitas = 0, itensPerguntados = 0, ganhos = 0, semRes = 0, erros = 0, truncadas = 0, interrompida = false;

  for (const lic of alvos) {
    if (Date.now() - t0 > limiteMs) { interrompida = true; break; }
    /* `descricao` vem junto porque ela é NOT NULL sem `default`, e o upsert do PostgREST é um
       INSERT ... ON CONFLICT: a linha do corpo precisa ser válida como INSERT mesmo quando ela
       vai virar UPDATE. A primeira versão mandava só `id` + as colunas de resultado e o banco
       recusou 85 gravações com `23502 not-null violation` — e a rodada CARIMBOU as 15 licitações
       assim mesmo, porque o erro só saía no log. Ver `gravaItens`: agora ele devolve o desfecho,
       e carimbo sem gravação não acontece mais. */
    const pendentes = await leLista('licitacao_itens?select=id,numero_item,descricao'
      + '&numero_controle=eq.' + encodeURIComponent(lic.numero_controle)
      + '&resultado_perguntado_em=is.null&resultado_valor_unit=is.null'
      + '&order=numero_item.asc&limit=' + (TETO_ITENS_POR_LIC + 1), 'os itens pendentes');

    const truncou = pendentes.length > TETO_ITENS_POR_LIC;
    const lote = pendentes.slice(0, TETO_ITENS_POR_LIC);
    if (!lote.length) {
      /* Licitação sem item pendente: carimba e segue. Sem isto ela voltaria toda rodada e a fila
         nunca encolheria — o mesmo defeito, um andar acima, que a coluna nova veio matar. */
      await carimbaLicitacao(lic.id);
      feitas++;
      continue;
    }

    const base = `https://pncp.gov.br/api/pncp/v1/orgaos/${lic.cnpj}/compras/${lic.ano}/${lic.sequencial}`;
    const agora = new Date().toISOString();
    const atualiza = [];
    let comResNesta = 0, erroNesta = false;
    for (const it of lote) {
      if (Date.now() - t0 > limiteMs) { interrompida = true; break; }
      const r = await puxaResultado(`${base}/itens/${encodeURIComponent(it.numero_item)}/resultados`, breaker, ritmo);
      itensPerguntados++;
      if (r.erro) { erros++; erroNesta = true; break; }
      const v = r.dados ? vencedor(r.dados) : null;
      if (v) { comResNesta++; ganhos++; } else semRes++;
      atualiza.push(linhaDoItem(lic, it, v, agora));
      await dormir(ritmo.pausa);
    }

    const gravou = atualiza.length ? await gravaItens(atualiza) : true;
    /* ══ O CARIMBO SÓ VAI SE A LEITURA FOI INTEIRA **E A GRAVAÇÃO PASSOU** ═════════════════════
       Truncada pelo teto, cortada pelo relógio, interrompida por erro OU com a gravação recusada
       pelo banco: a licitação FICA SEM carimbo e volta na próxima rodada, com os itens que
       faltam. Carimbar uma leitura parcial como completa é a mentira mais cara que uma coleta
       pode contar — ela faz o banco dizer "já perguntei tudo" sobre metade.
       >>> E O `&& gravou` NÃO ESTAVA AQUI NA PRIMEIRA VERSÃO. A primeira rodada de verdade
           recusou as 85 gravações com `23502` e carimbou as 15 licitações assim mesmo: o erro
           saía no log, e o log não é uma condição. Foi preciso desfazer os 15 carimbos à mão. */
    if (!truncou && !erroNesta && !interrompida && gravou) { await carimbaLicitacao(lic.id); feitas++; }
    else if (truncou) truncadas++;
    else if (!gravou) erros++;

    console.log('  [' + (feitas + truncadas) + '/' + alvos.length + '] ' + lic.numero_controle
      + '  ' + lote.length + ' item(ns) perguntado(s) · ' + comResNesta + ' com resultado'
      + (truncou ? '  ⚠ TRUNCADA no teto de ' + TETO_ITENS_POR_LIC + ' — volta na próxima' : '')
      + (erroNesta ? '  ⚠ erro — volta na próxima' : ''));
    if (breaker.aberto) { console.log('  BREAKER ABERTO — parando a rodada.'); break; }
  }

  const gastou = Date.now() - t0;
  const depois = await retrato();
  const saldo = controle ? null : await contaDivida();
  const planoFim = planoDaRodada({ divida, orcamentoMin: ORCAMENTO_MIN,
    taxaAnterior: plano.medida ? plano.segPorLic : null });
  const saldoTexto = textoDoSaldo(saldo, planoFim);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('=== RESULTADO POR ITEM — fim (' + (gastou / 60000).toFixed(1) + ' min) ==='
    + (interrompida ? '   ⚠ INTERROMPIDA pelo orçamento' : ''));
  console.log('  licitações ..... ' + feitas + ' fechadas · ' + truncadas + ' truncadas (voltam) · '
    + erros + ' com erro');
  console.log('  itens .......... ' + fmt(itensPerguntados) + ' perguntados · ' + fmt(ganhos)
    + ' COM resultado · ' + fmt(semRes) + ' ainda sem julgamento');
  console.log('  cobertura ...... ' + fmt(antes.com_resultado) + ' → ' + fmt(depois.com_resultado)
    + ' de ' + fmt(depois.itens) + ' itens ('
    + (depois.itens ? (depois.com_resultado / depois.itens * 100).toFixed(3) : '—') + '%)');
  if (saldoTexto) console.log('  ' + saldoTexto);

  const detalhe = {
    inicio: new Date(t0).toISOString(), fim: new Date().toISOString(),
    minutos: +(gastou / 60000).toFixed(1), orcamento_min: ORCAMENTO_MIN,
    carencia_dias: CARENCIA_DIAS,
    licitacoes_fechadas: feitas, licitacoes_truncadas: truncadas, licitacoes_com_erro: erros,
    itens_perguntados: itensPerguntados, itens_com_resultado: ganhos, itens_sem_julgamento: semRes,
    cobertura_antes: antes.com_resultado, cobertura_depois: depois.com_resultado,
    itens_total: depois.itens,
    teto: plano.teto, cabe_no_orcamento: plano.cabe,
    divida_antes: divida, divida_depois: saldo,
    rodadas_para_zerar: planoFim.rodadasParaZerar, minutos_para_zerar: planoFim.minutosParaZerar,
    /* A TAXA APRENDIDA, para a próxima rodada dimensionar o teto com ela. Aprender sem anotar é
       não aprender. Se nada foi processado, guarda a que foi USADA — nunca zero. */
    seg_por_lic: (feitas + truncadas) > 0
      ? +((gastou / 1000) / (feitas + truncadas)).toFixed(3) : plano.segPorLic,
    interrompida,
    saldo: saldoTexto,
  };
  const motivos = [];
  if (interrompida) motivos.push('INTERROMPIDA pelo orçamento de tempo');
  if (breaker.aberto) motivos.push('o breaker do PNCP abriu');
  if (erros) motivos.push(erros + ' licitação(ões) com erro — voltam na próxima');
  detalhe.porque = [motivos.length ? motivos.join(' · ') : 'a rodada percorreu o teto inteiro',
                    saldoTexto].filter(Boolean).join(' · ');

  const linha = {
    fonte: 'RESULTADO_ITEM',
    ultima_tentativa: detalhe.fim,
    ultimo_erro: motivos.length ? motivos.join(' · ').slice(0, 400) : null,
    registros: ganhos,
    atualizado_em: detalhe.fim,
    detalhe,
  };
  if (!interrompida && !breaker.aberto) linha.ultima_ok = detalhe.fim;

  const { SB, H } = banco();
  const r = await fetchBanco(`${SB}/rest/v1/coleta_status?on_conflict=fonte`, {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify([linha]),
  }, 'gravar o carimbo').catch(e => ({ ok: false, status: e.message }));
  if (!r || !r.ok) console.error('⚠️  não consegui gravar o carimbo: ' + (r && r.status));

  console.log('  por quê ........ ' + detalhe.porque);
  process.exitCode = (interrompida || breaker.aberto) ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });

async function carimbaLicitacao(id) {
  const { SB, H } = banco();
  const r = await fetchBanco(`${SB}/rest/v1/licitacoes?id=eq.${id}`, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ resultado_perguntado_em: new Date().toISOString() }),
  }, 'carimbar a licitação');
  if (!r.ok) console.log('    ! não consegui carimbar a licitação ' + id + ': HTTP ' + r.status);
}

/* ══ A GRAVAÇÃO É UM UPSERT EM LOTE, e não um PATCH por linha ═════════════════════════════════
   120 PATCHes por licitação seriam 120 idas ao banco para escrever o que cabe numa. O alvo do
   conflito é a CHAVE DE NEGÓCIO (`numero_controle,numero_item`), que é onde mora o índice único
   — a PK é o `id` bigserial, e pedir conflito por ela faz o PostgREST inserir e o banco recusar
   com `23505` (a lição que a A7 pagou).
   >>> E O CORPO CARREGA `descricao` PORQUE ELA É NOT NULL SEM DEFAULT. Um upsert é um
       `INSERT ... ON CONFLICT`: a linha precisa ser válida como INSERT mesmo quando ela vai
       virar UPDATE. O valor mandado é o MESMO que acabou de ser lido do banco — não se inventa
       descrição aqui.
   >>> O QUE CONTINUA FORA DO CORPO fica intacto no UPDATE do conflito: quantidade, unidade,
       valor de referência, situação e `bruto`. É a mesma lei que a A9 escreveu ao deixar
       `resultado_*` fora do corpo do coletor de ITENS — agora do outro lado do espelho. */
async function gravaItens(linhas) {
  const { SB, H } = banco();
  let tudoOk = true;
  for (let i = 0; i < linhas.length; i += 200) {
    const r = await fetchBanco(`${SB}/rest/v1/licitacao_itens?on_conflict=numero_controle,numero_item`, {
      method: 'POST', headers: { ...H, Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(linhas.slice(i, i + 200)),
    }, 'gravar o resultado dos itens');
    if (!r.ok) {
      tudoOk = false;
      console.log('    ! ERRO ao gravar: ' + r.status + ' ' + (await r.text()).slice(0, 180));
    }
  }
  /* O DESFECHO SOBE. Um `console.log` de erro não é uma condição — quem chama precisa PODER
     decidir não carimbar, e para isso precisa saber. */
  return tudoOk;
}
