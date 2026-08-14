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
   sem ninguém ver. Ela volta na próxima rodada. */
const TETO_PAGINAS = 6;
const TAM_PAGINA = 100;

const dormir = ms => new Promise(r => setTimeout(r, ms));
const num = v => (v == null || v === '' || !isFinite(Number(v))) ? null : Number(v);

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
    const r = await fetch(`${SB}/rest/v1/licitacao_itens?on_conflict=numero_controle,numero_item`, {
      method: 'POST', headers: { ...H, Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(linhas.slice(i, i + 200)),
    });
    if (!r.ok) return { erro: 'gravação ' + r.status + ' ' + (await r.text()).slice(0, 160) };
  }
  return { gravou: linhas.length, truncou };
}

/* O carimbo só é posto quando a leitura foi INTEIRA. Leitura truncada volta na próxima rodada;
   marcá-la como lida seria perder o resto de um edital grande em silêncio. */
async function carimba(lic, qtd) {
  if (PREVIA) return;
  const r = await fetch(`${SB}/rest/v1/licitacoes?id=eq.${lic.id}`, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ itens_qtd: qtd, itens_lidos_em: new Date().toISOString() }),
  });
  if (!r.ok) console.log(`     ⚠️ não consegui carimbar a licitação ${lic.id}: HTTP ${r.status}`);
}

const CAMPOS = 'id,numero_controle,cnpj,ano,sequencial,uf,data_encerramento,itens_lidos_em';

async function le(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H });
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

async function alvosVivos(quantos) {
  const agora = new Date().toISOString();
  return le(`licitacoes?select=${CAMPOS}&data_encerramento=gte.${agora}`
    + `&itens_lidos_em=is.null&order=data_encerramento.asc&limit=${quantos}`);
}

async function alvosSemPrazo(quantos) {
  return le(`licitacoes?select=${CAMPOS}&data_encerramento=is.null`
    + `&itens_lidos_em=is.null&order=data_publicacao.desc&limit=${quantos}`);
}

(async () => {
  console.log('=== ITENS DO EDITAL EM LOTE (fatia A9) ===' + (PREVIA ? '   [PRÉVIA — nada gravado]' : ''));
  const controle = arg('--controle');
  const funil = tem('--funil');
  const vivas = tem('--vivas');
  const semPrazo = tem('--inclui-sem-prazo');
  if (!controle && !funil && !vivas) {
    console.error('\nuso:  --funil  |  --vivas [--teto N] [--inclui-sem-prazo]  |  --controle <n>   [--previa] [--pausa ms]');
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
    if (!tem('--refazer')) alvos = alvos.filter(l => !l.itens_lidos_em);
  }

  console.log(`\nalvos: ${alvos.length}`);
  const breaker = criaBreaker(FALHAS_ATE_ABRIR);
  const ritmo = criaRitmo(PAUSA_BASE);
  let ok = 0, itensTotal = 0, sem = 0, erro = 0, truncadas = 0, parou = null;

  for (let i = 0; i < alvos.length; i++) {
    const l = alvos[i];
    const r = await umaLicitacao(l, breaker, ritmo);
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
