/* ══════════════════════════════════════════════════════════════════════════════════════════
   coleta_itens_lote.js — ENCHER `licitacao_itens` EM LOTE (fatia A9, 14/08/2026)

   ══ POR QUE ESTA FERRAMENTA EXISTE, E POR QUE ELA NÃO É A `coleta_resultados.js` ═══════════
   A A8 mediu e o achado mudou a fila: buscar "albumina" no índice dá ZERO, e não por defeito da
   busca — o `objeto` do PNCP é genérico ("aquisição de material médico-hospitalar"), e o nome do
   produto mora na descrição do ITEM. Com 195 itens de UMA licitação em 3.201, a busca por produto
   responde "não achei" sobre um país que está comprando.

   >>> A DIFERENÇA DE CUSTO É O DESENHO INTEIRO DESTA FERRAMENTA:
         · ITEM      -> 1 requisição por PÁGINA de 100 itens. Uma licitação inteira = 1 chamada.
         · RESULTADO -> 1 requisição por ITEM. Um edital de 500 itens = 500 chamadas.
       A `coleta_resultados.js` faz as DUAS coisas e por isso é (e continua sendo) sob demanda,
       só para as licitações dos meus negócios. Esta aqui faz SÓ a primeira — e é justamente por
       ela ser barata que varrer o índice vivo deixa de ser abuso e passa a ser leitura normal.
   >>> E ELA NÃO ESCREVE UMA ÚNICA COLUNA DE RESULTADO. Não é esquecimento: as colunas
       `resultado_*` ficam FORA do corpo do upsert de propósito, porque o que não está no corpo
       não entra no `ON CONFLICT DO UPDATE`. Se elas fossem junto com `null`, esta varredura
       APAGARIA os 192 resultados que a A7 conferiu item a item contra o PNCP. Uma coleta de
       itens que zera resultado seria a pior espécie de defeito: silenciosa, e parecendo trabalho.

   ══ ORDEM: PRIMEIRO O QUE É MEU, DEPOIS O QUE ESTÁ VIVO ════════════════════════════════════
     1. FUNIL ....... licitações amarradas a negócio não arquivado (por `licitacao_id` ou por
                      `numero_controle`). São as que alguém desta casa está disputando.
     2. VIVAS ....... `data_encerramento >= agora`, da que encerra ANTES para a que encerra
                      depois. Prazo curto primeiro: se a rodada for cortada no meio, o que ficou
                      de fora é o que ainda dá tempo de coletar amanhã.
     3. o resto só com `--inclui-sem-prazo` (1.426 linhas do índice não têm encerramento; elas
        não são "vivas", e chamá-las assim seria inventar prazo).

   ══ RETOMADA: O CARIMBO É NO ÍNDICE, NÃO NA MEMÓRIA DA RODADA ══════════════════════════════
   `licitacoes.itens_qtd` e `licitacoes.itens_lidos_em` já existiam no DDL ("preenchido quando os
   itens já foram lidos") e estavam em 0 de 3.201. É neles que a rodada marca o que já leu, e é
   por eles que a próxima rodada sabe onde continuar. Sem carimbo, retomar seria re-perguntar ao
   PNCP tudo de novo a cada vez — o mesmo tráfego, de graça, contra um serviço público.
   >>> LICITAÇÃO SEM ITEM PUBLICADO TAMBÉM GANHA CARIMBO, com `itens_qtd = 0`. "Perguntei e o
       PNCP não tem" é uma resposta, e sem gravá-la a rodada seguinte perguntaria de novo, para
       sempre. `--refazer` é a porta para reler quem já tem carimbo.

   ══ SEGURANÇA ═════════════════════════════════════════════════════════════════════════════
   Nada de DELETE/TRUNCATE. O upsert é por (numero_controle, numero_item) com `on_conflict`
   explícito — o conserto da A7, que aqui vale de novo: sem ele o PostgREST insere e o banco
   recusa com 23505. Re-rodar REESCREVE a linha que esta mesma ferramenta pôs.
   O único UPDATE que ela faz em `licitacoes` é nos dois campos de carimbo acima — que existem
   para isto e não guardam acervo nenhum.

     node tools/coleta_itens_lote.js --funil                      (só o que está no funil)
     node tools/coleta_itens_lote.js --vivas [--teto 200]         (o índice vivo, em lote)
     node tools/coleta_itens_lote.js --vivas --teto 50 --previa   (não grava nada)
     node tools/coleta_itens_lote.js --controle <numero_controle>
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const { criaBreaker, esperaBackoff, criaRitmo, esperaRateLimit, FALHAS_ATE_ABRIR } = require('./coleta_pncp.js');

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = n => process.argv.includes(n);
const PREVIA = tem('--previa');
const TETO = parseInt(arg('--teto') || '200', 10);
const PAUSA_BASE = parseInt(arg('--pausa') || '300', 10);
/* Teto de PÁGINAS por licitação: 6 × 100 = 600 itens. Quando ele morde, a linha DIZ e a licitação
   NÃO ganha carimbo — carimbar leitura truncada como completa é como se perde um edital grande
   sem ninguém ver. Ela volta na próxima rodada.
   >>> `--paginas N` LEVANTA O TETO PARA UMA RODADA (fatia A24). Ele existe porque a varredura do
       índice terminou com DOZE licitações eternamente truncadas: cada uma tem mais de 600 itens,
       então elas nunca ganham carimbo e voltam para sempre — uma fila que nunca esvazia e um
       tráfego que se repete de graça contra um serviço público. Levantar o teto no PADRÃO seria
       trocar 5.268 leituras rápidas por 5.268 leituras longas para atender 12 casos; levantá-lo
       SÓ na rodada que vai atrás desses 12 é o gesto do tamanho do problema. */
const TETO_PAGINAS = parseInt(arg('--paginas') || '6', 10);
const TAM_PAGINA = 100;

const dormir = ms => new Promise(r => setTimeout(r, ms));
const num = v => (v == null || v === '' || !isFinite(Number(v))) ? null : Number(v);

/* ══ A CONVERSA COM O NOSSO BANCO TAMBÉM PRECISA SOBREVIVER A UM PISCAR DE REDE (A34 · 20/08) ══
   *** MEDIDO, E ESTE É O NÚMERO: *** a carga de hoje às 09:10 rodou 1.109 SEGUNDOS na etapa de
   itens, pagou 940 da dívida (2.149 → 1.209 vivas sem item) e morreu com `ERRO: fetch failed`.
   O `ultima_ok` da carga não avançou, e a faixa de frescor da tela ficou âmbar dizendo "a carga
   nunca terminou por inteiro" — sobre uma rodada que tinha trabalhado dezoito minutos.

   ══ ONDE ESTAVA O BURACO, e ele não era do lado do governo ══════════════════════════════════
   A conversa com o PNCP (`puxaItens`) tem backoff, breaker e rate-limit desde a A9: uma falha de
   rede ali é retentada e, no pior caso, vira `{erro}` de UMA licitação — o laço conta e segue.
   As três chamadas ao NOSSO banco não tinham nada disso:
     · a gravação em lote (`licitacao_itens`),
     · o carimbo (`PATCH licitacoes`),
     · a leitura de alvos (`le`).
   Elas conferem `r.ok` — o que já é mais do que a família de defeitos que o B achou na Proposta
   fazia —, mas `r.ok` só existe se a resposta CHEGOU. Num `fetch failed` não há `r`: a promessa
   REJEITA, a exceção sobe até o `.catch` do fim do arquivo e o processo sai com 1.
   >>> ENTÃO O DEFEITO NÃO É "NÃO CONFERIU O ok" — É CONFERIR SÓ O ok. São dois desfechos
       diferentes ("respondeu mal" e "não respondeu") e o segundo não passa por lugar nenhum onde
       o primeiro é tratado. É o irmão do `Array.isArray` da Proposta virado do avesso.

   ══ E O CONSERTO NÃO PODE TRANSFORMAR ESCRITA FALHA EM ESCRITA FEITA ════════════════════════
   Esta é a linha que não se cruza: retentar é legítimo, engolir não. Depois das tentativas, o
   erro CONTINUA sendo erro — ele volta como `{erro}` da licitação, o laço conta em `erro++`, a
   linha sai no log e a licitação FICA SEM CARIMBO, então ela volta na próxima rodada. O que muda
   é só o alcance: uma licitação perdida em vez de uma rodada inteira.
   >>> O BACKOFF É O MESMO DO COLETOR DO ÍNDICE (`esperaBackoff`), emprestado e não copiado, pela
       razão de sempre: duas réguas de "estou indo rápido demais" acabam discordando. */
const TENTATIVAS_BANCO = 3;
async function fetchBanco(url, opcoes, oQue) {
  let ultimo = null;
  for (let t = 0; t < TENTATIVAS_BANCO; t++) {
    try {
      return await fetch(url, opcoes);
    } catch (e) {
      /* SÓ A FALHA DE TRANSPORTE CAI AQUI. Resposta 4xx/5xx não levanta exceção — ela volta como
         `r` e quem chamou confere o `r.ok`, como sempre conferiu. Retentar um 401 seria bater
         três vezes na mesma porta trancada. */
      ultimo = e;
      if (t === TENTATIVAS_BANCO - 1) break;
      const espera = esperaBackoff(t);
      console.log(`    ! banco (${oQue}): ${e.message} — nova tentativa em ${espera / 1000}s`);
      await dormir(espera);
    }
  }
  throw new Error(`${oQue}: ${ultimo && ultimo.message} (${TENTATIVAS_BANCO} tentativas)`);
}

// ── a conversa com o PNCP, com backoff e rate-limit emprestados do coletor do índice ────────
// Emprestados, e não copiados: uma segunda régua de "estou indo rápido demais" acabaria
// discordando da primeira, e as duas batem no mesmo portal público.
async function puxaItens(url, breaker, ritmo) {
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
      /* 404 AQUI NÃO É FALHA, É RESPOSTA. Achado da A6, repetido aqui: o PNCP devolve 404 quando o
         órgão não anexou/publicou nada — eu esperava lista vazia. Tratar como queda faria o caso
         MAIS COMUM abrir o circuit breaker e derrubar a rodada inteira. */
      if (r.status === 404) { breaker.ok(); return { vazio: true }; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      breaker.ok();
      if (!txt.trim()) return { vazio: true };     // 200 com corpo em branco (medido na A7)
      const j = JSON.parse(txt);
      return { dados: Array.isArray(j) ? j : [] };
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

async function umaLicitacao(lic, breaker, ritmo) {
  const base = `https://pncp.gov.br/api/pncp/v1/orgaos/${lic.cnpj}/compras/${lic.ano}/${lic.sequencial}`;
  let itens = [], truncou = false;
  for (let p = 1; p <= TETO_PAGINAS; p++) {
    const r = await puxaItens(`${base}/itens?pagina=${p}&tamanhoPagina=${TAM_PAGINA}`, breaker, ritmo);
    if (r.erro) return { erro: r.erro };
    if (r.vazio) break;
    const lote = r.dados || [];
    if (!lote.length) break;
    itens = itens.concat(lote);
    if (lote.length < TAM_PAGINA) break;
    if (p === TETO_PAGINAS) truncou = true;
    await dormir(ritmo.pausa);
  }

  if (!itens.length) return { semItens: true };

  const linhas = [];
  for (const it of itens) {
    const nItem = String(it.numeroItem != null ? it.numeroItem : '');
    if (!nItem) continue;
    linhas.push({
      numero_controle: lic.numero_controle,
      licitacao_id: lic.id || null,
      numero_item: nItem,
      descricao: String(it.descricao || '(sem descrição)'),
      quantidade: num(it.quantidade),
      unidade: it.unidadeMedida || null,
      valor_unitario_ref: num(it.valorUnitarioEstimado),
      situacao: it.situacaoCompraItemNome || null,
      bruto: it,
      // resultado_* NÃO entra aqui. Ver o cabeçalho: fora do corpo = fora do UPDATE do conflito.
    });
  }
  if (!linhas.length) return { semItens: true };
  if (PREVIA) return { gravou: linhas.length, truncou, previa: true };

  for (let i = 0; i < linhas.length; i += 200) {
    const r = await fetchBanco(`${SB}/rest/v1/licitacao_itens?on_conflict=numero_controle,numero_item`, {
      method: 'POST', headers: { ...H, Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(linhas.slice(i, i + 200)),
    }, 'gravação de itens');
    if (!r.ok) return { erro: 'gravação ' + r.status + ' ' + (await r.text()).slice(0, 160) };
  }
  return { gravou: linhas.length, truncou };
}

/* O carimbo só é posto quando a leitura foi INTEIRA. Leitura truncada volta na próxima rodada;
   marcá-la como lida seria perder o resto de um edital grande em silêncio. */
async function carimba(lic, qtd) {
  if (PREVIA) return;
  /* O CARIMBO É O ÚNICO QUE PODE FALHAR SEM DERRUBAR NADA, e por um motivo bom: sem ele a
     licitação simplesmente volta na próxima rodada e os itens são regravados por cima (o upsert
     é idempotente). Perder o carimbo custa uma releitura; perder a rodada custa dezoito minutos.
     >>> MAS A FALHA DE TRANSPORTE PRECISA SER DITA IGUAL À DE RESPOSTA. Antes, um HTTP 500 saía
         no log e um `fetch failed` matava o processo — dois desfechos com a mesma consequência
         prática e tratamentos opostos. */
  let r;
  try {
    r = await fetchBanco(`${SB}/rest/v1/licitacoes?id=eq.${lic.id}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ itens_qtd: qtd, itens_lidos_em: new Date().toISOString() }),
    }, 'carimbo');
  } catch (e) {
    console.log(`     ⚠️ não consegui carimbar a licitação ${lic.id}: ${e.message} — ela volta na próxima rodada`);
    return;
  }
  if (!r.ok) console.log(`     ⚠️ não consegui carimbar a licitação ${lic.id}: HTTP ${r.status}`);
}

const CAMPOS = 'id,numero_controle,cnpj,ano,sequencial,uf,data_encerramento,itens_lidos_em';

/* A LEITURA DE ALVOS CONTINUA PODENDO DERRUBAR A RODADA, e isso é decisão e não esquecimento:
   ela roda ANTES do laço, quando nada foi feito ainda, e sem a lista de alvos não há trabalho a
   preservar. O que ela ganha é a retentativa — três tentativas contra um piscar de rede, e aí sim
   o erro sobe com o nome da consulta junto. */
async function le(q) {
  const r = await fetchBanco(`${SB}/rest/v1/${q}`, { headers: H }, 'leitura');
  if (!r.ok) throw new Error(`${q} -> HTTP ${r.status}`);
  return r.json();
}

/* ══ ALVOS ═════════════════════════════════════════════════════════════════════════════════
   >>> MEDIDO EM 14/08, E É UM ACHADO: `negocios.licitacao_id` está NULO nas 2.561 linhas, e
       `negocios.numero_controle` também. O botão antigo "Mandar pro funil" grava o `numero`
       (o nº da compra) e nunca gravou a chave do PNCP. Ou seja: a prioridade 1 desta rodada
       hoje encontra ZERO licitações — não porque ninguém disputa nada, mas porque a ponte
       perdeu a chave no caminho. O conserto está na Encontrar (mesma fatia); esta função
       continua olhando os DOIS campos, porque é assim que ela fica certa antes e depois. */
async function alvosDoFunil() {
  const negs = await le('negocios?select=licitacao_id,numero_controle&arquivado=is.false');
  const ids = [...new Set(negs.map(n => n.licitacao_id).filter(Boolean))];
  const ctrls = [...new Set(negs.map(n => n.numero_controle).filter(Boolean))];
  let out = [];
  if (ids.length) out = out.concat(await le(`licitacoes?select=${CAMPOS}&id=in.(${ids.join(',')})`));
  if (ctrls.length) {
    const lista = ctrls.map(c => '"' + String(c).replace(/"/g, '') + '"').join(',');
    out = out.concat(await le(`licitacoes?select=${CAMPOS}&numero_controle=in.(${lista})`));
  }
  const vistos = new Set();
  return out.filter(l => !vistos.has(l.id) && vistos.add(l.id));
}

/* ══ O TETO DE 1000 DO POSTGREST, DECLARADO ═══════════════════════════════════════════════════
   Esta instância pagina em 1000 e NÃO avisa: pedir `limit=1300` devolve 1000 com cara de lista
   inteira. Foi assim que a primeira rodada em lote leu 1.000 das 1.292 vivas e terminou dizendo
   "1000/1000" — número certo, conclusão errada. É a terceira vez que o mesmo teto morde esta
   obra (o dicionário CMED e a busca da tela foram as outras duas), e por isso aqui ele é PAGINADO
   em vez de confiado. */
const PAG = 1000;
async function paginado(base, quantos) {
  let out = [];
  for (let de = 0; out.length < quantos; de += PAG) {
    const pedaco = Math.min(PAG, quantos - out.length);
    const lote = await le(`${base}&limit=${pedaco}&offset=${de}`);
    if (!Array.isArray(lote) || !lote.length) break;
    out = out.concat(lote);
    if (lote.length < pedaco) break;
  }
  return out;
}

async function alvosVivos(quantos) {
  const agora = new Date().toISOString();
  return paginado(`licitacoes?select=${CAMPOS}&data_encerramento=gte.${agora}`
    + `&itens_lidos_em=is.null&order=data_encerramento.asc`, quantos);
}

async function alvosSemPrazo(quantos) {
  return paginado(`licitacoes?select=${CAMPOS}&data_encerramento=is.null`
    + `&itens_lidos_em=is.null&order=data_publicacao.desc`, quantos);
}

/* ══ AS QUE ENTRARAM PELA PORTA DE BUSCA (alvo da fatia A24) ═══════════════════════════════
   A A22 trouxe 1.400 licitações pelo `/api/search/`, e essa porta não devolve item nenhum —
   entraram com objeto, órgão e chave, e mais nada. Sem item, a busca por produto não as acha,
   os chips de categoria não nascem e o teto CMED não tem o que comparar.
   >>> POR QUE UM ALVO PRÓPRIO, E NÃO `--inclui-sem-prazo`: elas TAMBÉM são sem prazo (a busca
       não traz janela), então o alvo genérico as pegaria — MISTURADAS com as 429 antigas, na
       ordem de `data_publicacao`. Se a rodada for cortada no meio, quem fica de fora deveria
       ser a licitação velha, não a que acabou de chegar. Ordenar por publicação DESC é chute
       sobre isso; declarar o alvo é medida.
   O carimbo `bruto->>_coleta` é posto pela própria `coleta_pncp_busca.js` — é o único jeito
   honesto de saber a procedência de uma linha depois que ela virou índice. */
/* ══ O RESTO DO ÍNDICE ═════════════════════════════════════════════════════════════════════
   Sobram as ENCERRADAS sem itens — 522 depois da A24. Elas não dão mais para disputar, e por
   isso não são prioridade nenhuma; mas o item delas é PREÇO PRATICADO, e preço praticado é o
   que faz o teto CMED e a comparação de proposta valerem alguma coisa. Coletar por último é o
   lugar certo delas: nunca antes de uma licitação viva. */
async function alvosDoResto(quantos) {
  return paginado(`licitacoes?select=${CAMPOS}&itens_lidos_em=is.null&order=data_publicacao.desc`, quantos);
}

async function alvosDaBusca(quantos) {
  return paginado(`licitacoes?select=${CAMPOS}&bruto->>_coleta=eq.busca`
    + `&itens_lidos_em=is.null&order=data_publicacao.desc`, quantos);
}

(async () => {
  console.log('=== ITENS DO EDITAL EM LOTE (fatia A9) ===' + (PREVIA ? '   [PRÉVIA — nada gravado]' : ''));
  const controle = arg('--controle');
  const funil = tem('--funil');
  const vivas = tem('--vivas');
  const daBusca = tem('--da-busca');
  const semPrazo = tem('--inclui-sem-prazo');
  if (!controle && !funil && !vivas && !daBusca && !tem('--resto')) {
    console.error('\nuso:  --funil  |  --vivas [--teto N] [--inclui-sem-prazo]  |  --da-busca [--teto N]'
      + '  |  --resto [--teto N]  |  --controle <n>   [--previa] [--pausa ms]');
    process.exit(1);
  }

  let alvos = [];
  if (controle) {
    alvos = await le(`licitacoes?select=${CAMPOS}&numero_controle=eq.${encodeURIComponent(controle)}`);
    if (!alvos.length) { console.error('\nnão achei esta licitação no índice: ' + controle); process.exit(1); }
  } else {
    if (funil) {
      const f = await alvosDoFunil();
      console.log(`\nfunil: ${f.length} licitação(ões) amarrada(s) a negócio aberto`);
      if (!f.length) console.log('       (nenhum negócio aberto tem licitacao_id nem numero_controle — ver o comentário do código)');
      alvos = alvos.concat(f);
    }
    if (daBusca) {
      const falta = Math.max(0, TETO - alvos.length);
      const b = falta ? await alvosDaBusca(falta) : [];
      console.log(`da porta de BUSCA, sem itens lidos: ${b.length} nesta rodada (teto ${TETO})`);
      alvos = alvos.concat(b);
    }
    if (vivas) {
      const falta = Math.max(0, TETO - alvos.length);
      const v = falta ? await alvosVivos(falta) : [];
      console.log(`vivas sem itens lidos: ${v.length} nesta rodada (teto ${TETO})`);
      alvos = alvos.concat(v);
      if (semPrazo && alvos.length < TETO) {
        const s = await alvosSemPrazo(TETO - alvos.length);
        console.log(`sem prazo informado:   ${s.length} nesta rodada`);
        alvos = alvos.concat(s);
      }
    }
    if (tem('--resto') && alvos.length < TETO) {
      const s = await alvosDoResto(TETO - alvos.length);
      console.log(`resto do índice (inclui as já encerradas): ${s.length} nesta rodada`);
      alvos = alvos.concat(s);
    }
    if (!tem('--refazer')) alvos = alvos.filter(l => !l.itens_lidos_em);
  }

  console.log(`\nalvos: ${alvos.length}`);
  const breaker = criaBreaker(FALHAS_ATE_ABRIR);
  const ritmo = criaRitmo(PAUSA_BASE);
  let ok = 0, itensTotal = 0, sem = 0, erro = 0, truncadas = 0, parou = null;

  /* ══ O ESCUDO DO LAÇO — UMA LICITAÇÃO PERDIDA, NUNCA A RODADA (A34 · 20/08) ═════════════════
     O `fetchBanco` retenta e, esgotadas as tentativas, LEVANTA — de propósito, porque escrita que
     falhou não pode voltar como escrita feita. Sem este `catch` a exceção subiria até o fim do
     arquivo e mataria o processo, que é exatamente o que aconteceu às 09:10 de hoje depois de
     dezoito minutos de trabalho já pago.
     >>> AQUI ELA VIRA `{erro}` DA LICITAÇÃO, e daí em diante o caminho já existia desde a A9: o
         laço conta em `erro++`, a linha sai no log com o número de controle, e a licitação FICA
         SEM CARIMBO — então ela volta na próxima rodada. Nada é dado por lido.
     >>> E O BREAKER CONTINUA MANDANDO. Se as falhas forem seguidas, ele abre e a rodada para com
         o motivo escrito. O escudo muda o ALCANCE de uma falha, não a régua de quando desistir. */
  for (let i = 0; i < alvos.length; i++) {
    const l = alvos[i];
    let r;
    try {
      r = await umaLicitacao(l, breaker, ritmo);
    } catch (e) {
      r = { erro: String(e.message || e) };
      breaker.falhou();
    }
    if (r.erro) {
      erro++;
      console.log(`  [${i + 1}/${alvos.length}] ${l.numero_controle}  ⚠️ ${r.erro}`);
      if (breaker.aberto || ritmo.estourou) { parou = r.erro; break; }
    } else if (r.semItens) {
      sem++;
      console.log(`  [${i + 1}/${alvos.length}] ${l.numero_controle}  ○ o PNCP não publicou itens`);
      await carimba(l, 0);
    } else {
      ok++; itensTotal += r.gravou;
      if (r.truncou) truncadas++;
      console.log(`  [${i + 1}/${alvos.length}] ${l.numero_controle}  ${r.gravou} item(ns)`
        + (r.truncou ? '  ⚠️ LEITURA TRUNCADA (teto de páginas) — sem carimbo, volta na próxima' : ''));
      if (!r.truncou) await carimba(l, r.gravou);
    }
    await dormir(ritmo.pausa);
  }

  console.log(`\n── resumo ──  ${ok} licitação(ões) com itens · ${itensTotal} item(ns) gravado(s) · `
    + `${sem} sem item publicado · ${erro} com erro` + (truncadas ? ` · ${truncadas} truncada(s)` : ''));
  if (ritmo.vezes) console.log(`⏱️  ${ritmo.vezes} rate limit(s) — terminou a ${ritmo.pausa}ms entre chamadas`);
  if (parou) console.log(`🔴 A RODADA PAROU: ${parou}. O que já foi gravado FICA, e a próxima rodada continua daqui.`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
