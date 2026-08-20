/* ═══════════════════════════════════════════════════════════════════════════════════════════
   mede_encontrar.js — A RÉGUA DA BUSCA DA TELA "ENCONTRAR" (fatia A34, 19/08/2026)

   ══ POR QUE ELA EXISTE ══════════════════════════════════════════════════════════════════════
   O dono disse, com estas palavras: *"sobre o PNCP a busca tá muito ruim ainda, não tá
   profissional"* e *"talvez pra não ficar travando"*. "Travando" é uma sensação; para consertar
   é preciso um NÚMERO — e o mesmo número antes e depois, tirado pela MESMA régua. Foi a lição
   da `conta_indice.js`: antes medido com um curl e depois com outro já apareceu como ganho uma
   vez nesta obra.

   ══ O QUE ELA MEDE — CADA CHAMADA QUE A TELA FAZ HOJE, EM SEQUÊNCIA ══════════════════════════
   A `buscar()` da Encontrar faz, por busca com termo, isto:
     1. `buscarNoBanco`      — licitações da JANELA de datas, `select=bruto`, paginado de 1000
     2. `buscarNoBancoAmplo` — se a janela deu vazio: **o ÍNDICE INTEIRO**, `select=bruto`
     3. `buscarPorItens`     — `licitacao_itens` por tsvector, cortado em 400 por termo
     4. `brutosPorControle`  — as que casaram por item e não estavam na lista
   e, quando nada disso responde, cai no PNCP ao vivo.

   >>> O QUE ESTA RÉGUA CONTA E NENHUMA OUTRA CONTAVA: os BYTES. O tempo sozinho engana num dia
       de rede boa; o volume não. `select=bruto` traz a resposta inteira do PNCP por linha —
       é aí que mora o "travando", e é um número que dá para ver.

   ══ E ELA MEDE TAMBÉM O CAMINHO NOVO ════════════════════════════════════════════════════════
   O `buscar_licitacoes` (RPC da A8) filtra no BANCO e devolve as colunas da tela, não o `bruto`.
   Medir os dois lado a lado no mesmo minuto é a única forma honesta de dizer que um é melhor.

     node tools/mede_encontrar.js                        (os 3 termos do dono)
     node tools/mede_encontrar.js --termo gaze
     node tools/mede_encontrar.js --json arquivo.json    (grava para comparar depois)
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const TERMOS = (arg('--termo') || 'dipirona,albumina,seringa').split(',').map(s => s.trim()).filter(Boolean);

const PAG_BANCO = 1000, TETO_PAGINAS_BANCO = 20, TETO_ITENS_BUSCA = 400;

/* Bytes: `res.text()` e o comprimento da string. Não é o tamanho comprimido no fio — é o que o
   navegador precisa PARSEAR e guardar, que é o que faz a aba travar. Dito para que ninguém
   compare este número com o do painel de rede e ache que um dos dois mente. */
async function pede(url, extra) {
  const t0 = Date.now();
  const r = await fetch(url, { headers: Object.assign({}, H, extra || {}) });
  const txt = await r.text();
  return { ms: Date.now() - t0, bytes: txt.length, status: r.status,
           cr: r.headers.get('content-range') || '', txt };
}

// ── 1. A leitura paginada de `bruto`, exatamente como a tela faz ───────────────────────────
async function lerPaginado(qBase) {
  let ms = 0, bytes = 0, linhas = 0, paginas = 0, truncou = false;
  for (let p = 0, de = 0; p < TETO_PAGINAS_BANCO; p++, de += PAG_BANCO) {
    const r = await pede(qBase, { Range: de + '-' + (de + PAG_BANCO - 1) });
    ms += r.ms; bytes += r.bytes; paginas++;
    if (r.status >= 400) break;
    let j; try { j = JSON.parse(r.txt); } catch (_) { break; }
    if (!Array.isArray(j) || !j.length) break;
    linhas += j.length;
    if (j.length < PAG_BANCO) break;
    if (p === TETO_PAGINAS_BANCO - 1) truncou = true;
  }
  return { ms, bytes, linhas, paginas, truncou };
}

const iso = d => d.toISOString().slice(0, 10);

(async () => {
  const hoje = new Date();
  const de = iso(new Date(hoje.getTime() - 29 * 864e5)), ate = iso(hoje);
  const out = { quando: new Date().toISOString(), janela: { de, ate }, termos: {} };

  // A JANELA — é o primeiro pedido de toda busca, com ou sem termo.
  const janela = await lerPaginado(
    `${SB}/rest/v1/licitacoes?select=bruto&data_publicacao=gte.${de}&data_publicacao=lte.${ate}&order=data_publicacao.desc`);
  out.janela_30_dias = janela;

  // O ÍNDICE INTEIRO — o pedido que a tela faz quando a janela vem vazia e há termo digitado.
  const amplo = await lerPaginado(`${SB}/rest/v1/licitacoes?select=bruto&order=data_publicacao.desc`);
  out.indice_inteiro = amplo;

  for (const t of TERMOS) {
    const linha = {};

    // 3. a busca nos itens, com o teto de 400 que a fatia manda matar
    const it = await pede(
      `${SB}/rest/v1/licitacao_itens?select=numero_controle,numero_item,descricao`
      + `&busca=wfts(pt_sem_acento).${encodeURIComponent(t)}`,
      { Prefer: 'count=exact', Range: '0-' + (TETO_ITENS_BUSCA - 1) });
    const totalItens = Number(String(it.cr).split('/')[1]);
    let lidos = 0; try { lidos = JSON.parse(it.txt).length; } catch (_) {}
    linha.itens_hoje = { ms: it.ms, bytes: it.bytes, lidos, total: isFinite(totalItens) ? totalItens : null,
                         cortou: isFinite(totalItens) && totalItens > lidos };

    // 4. o caminho NOVO: o banco agrega e devolve UMA linha por licitação
    const rpc = await pede(`${SB}/rest/v1/rpc/buscar_licitacoes?p_termo=${encodeURIComponent(t)}&p_limite=100`);
    let n = null; try { const j = JSON.parse(rpc.txt); n = Array.isArray(j) ? j.length : null; } catch (_) {}
    linha.rpc = { ms: rpc.ms, bytes: rpc.bytes, status: rpc.status, devolvidas: n,
                  total: (() => { try { const j = JSON.parse(rpc.txt); return j[0] ? Number(j[0].total) : 0; } catch (_) { return null; } })() };

    /* ══ 5. O QUE A TELA FAZ DEPOIS DA A34 — a MESMA régua, o outro caminho (20/08) ═══════════
       Sem esta parte a ferramenta media só o antes, e o "depois" teria que sair de outro lugar —
       que é exatamente o erro da A29 que o cabeçalho deste arquivo promete não repetir: antes
       medido com um curl e depois com outro já apareceu como ganho uma vez nesta obra.
       >>> ELA REPRODUZ AS TRÊS CHAMADAS DA `buscar()` NOVA, letra por letra:
             a) `buscarNoBanco`  — a janela COM o termo junto (`texto_busca=ilike`), paginada;
             b) `buscarNoBancoAmplo` — o índice inteiro com o termo, quando a janela vem vazia;
             c) `buscarPorItens` — a RPC `itens_por_licitacao`, que agrega no banco.
       >>> O `escapaLike` É O MESMO DA TELA. Medir com um termo escapado de outro jeito mediria
           uma busca que ninguém faz. */
    const escapaLike = s => String(s).replace(/([%_\\])/g, '\\$1');
    const alvo = encodeURIComponent('*' + escapaLike(t) + '*');
    const janelaTermo = await lerPaginado(
      `${SB}/rest/v1/licitacoes?select=numero_controle,bruto&data_publicacao=gte.${de}&data_publicacao=lte.${ate}`
      + `&order=data_publicacao.desc&texto_busca=ilike.${alvo}`);
    const amploTermo = await lerPaginado(
      `${SB}/rest/v1/licitacoes?select=numero_controle,bruto&order=data_publicacao.desc&texto_busca=ilike.${alvo}`);
    const rpcItens = await pede(`${SB}/rest/v1/rpc/itens_por_licitacao?p_termo=${encodeURIComponent(t)}`);
    let licsPorItem = null;
    try { const j = JSON.parse(rpcItens.txt); licsPorItem = Array.isArray(j) ? j.length : null; } catch (_) {}
    linha.depois = {
      janela: janelaTermo,
      indice_inteiro: amploTermo,
      itens_rpc: { ms: rpcItens.ms, bytes: rpcItens.bytes, status: rpcItens.status, licitacoes: licsPorItem },
      /* O TOTAL DA BUSCA é o pior caso REAL da tela: a janela com termo + a RPC dos itens. O
         índice inteiro só entra quando a janela vem vazia, e somá-lo sempre inflaria o "depois"
         com um pedido que na maioria das buscas não acontece. Ele é medido e mostrado à parte. */
      ms: janelaTermo.ms + rpcItens.ms,
      bytes: janelaTermo.bytes + rpcItens.bytes,
    };

    out.termos[t] = linha;
  }

  // ── o retrato ────────────────────────────────────────────────────────────────────────────
  const kb = b => (b / 1024).toFixed(0).padStart(8) + ' KB';
  console.log('=== RÉGUA DA BUSCA — ' + out.quando + ' ===\n');
  console.log('O QUE A TELA BAIXA ANTES DE FILTRAR QUALQUER PALAVRA:');
  console.log('  janela de 30 dias .... ' + kb(janela.bytes) + '  ' + String(janela.ms).padStart(6) + ' ms  '
    + janela.linhas + ' linhas em ' + janela.paginas + ' páginas');
  console.log('  índice INTEIRO ....... ' + kb(amplo.bytes) + '  ' + String(amplo.ms).padStart(6) + ' ms  '
    + amplo.linhas + ' linhas em ' + amplo.paginas + ' páginas'
    + (amplo.truncou ? '  ⚠ BATEU NO TETO DE 20 PÁGINAS' : ''));
  console.log('\ntermo         itens(hoje, teto 400)              RPC no banco');
  for (const t of TERMOS) {
    const l = out.termos[t];
    console.log('  ' + t.padEnd(12)
      + (String(l.itens_hoje.lidos) + ' de ' + l.itens_hoje.total).padEnd(16)
      + String(l.itens_hoje.ms).padStart(5) + 'ms'
      + (l.itens_hoje.cortou ? ' ✂ CORTOU' : '        ')
      + '   ' + String(l.rpc.total).padStart(6) + ' licitações  '
      + String(l.rpc.ms).padStart(5) + 'ms  ' + kb(l.rpc.bytes));
  }
  /* ══ O ANTES E O DEPOIS LADO A LADO, NA MESMA RÉGUA E NO MESMO MINUTO ═══════════════════════
     O "antes" é o que a tela fazia até 19/08: baixar a janela inteira (ou o índice inteiro) em
     `bruto` e filtrar a palavra no navegador. Ele NÃO é uma lembrança — está sendo medido agora,
     nesta mesma execução, contra o mesmo banco. O "depois" é o que ela faz desde a A34. */
  console.log('\n═══ A BUSCA POR TERMO, ANTES x DEPOIS (mesma régua, mesmo minuto) ═══');
  console.log('termo         ANTES (baixa a janela e filtra aqui)   DEPOIS (o banco filtra)');
  for (const t of TERMOS) {
    const d = out.termos[t].depois;
    console.log('  ' + t.padEnd(12)
      + (kb(janela.bytes) + '  ' + String(janela.ms) + ' ms').padEnd(26)
      + '   ' + kb(d.bytes) + '  ' + String(d.ms).padStart(5) + ' ms'
      + '   (' + d.janela.linhas + ' linhas da janela + ' + d.itens_rpc.licitacoes + ' por item)');
  }
  console.log('\n  e quando a janela vem vazia, o "índice inteiro" com o termo junto:');
  for (const t of TERMOS) {
    const a = out.termos[t].depois.indice_inteiro;
    console.log('    ' + t.padEnd(12) + kb(amplo.bytes) + ' → ' + kb(a.bytes)
      + '   ' + String(amplo.ms) + ' ms → ' + String(a.ms) + ' ms   (' + a.linhas + ' linhas)');
  }

  const dest = arg('--json');
  if (dest) { fs.writeFileSync(dest, JSON.stringify(out, null, 2)); console.log('\nretrato gravado em ' + dest); }
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
