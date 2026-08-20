/* ══════════════════════════════════════════════════════════════════════════════════════════
   coleta_resultados.js — OS ITENS DO EDITAL E O QUE ACONTECEU COM CADA UM (fatia A7, 14/08/2026)

   Duas coisas na mesma passada, e elas são a mesma coisa em dois momentos:
     1. os ITENS do edital (descrição, quantidade, unidade, valor de referência);
     2. o RESULTADO de cada item (quem ganhou, por quanto, quanto foi homologado).

   >>> POR QUE JUNTAS: o resultado é um atributo do ITEM, e o PNCP só entrega o resultado se
       você souber o `numeroItem`. Duas ferramentas separadas fariam a segunda ter que
       redescobrir a lista da primeira — duas leituras do mesmo endpoint, e duas respostas
       possíveis para "quantos itens tem este edital".

   ══ SÓ AS LICITAÇÕES DOS MEUS NEGÓCIOS ═════════════════════════════════════════════════════
   Mesma regra da fatia A6, e pelo mesmo motivo: resultado por item é UMA requisição POR ITEM.
   Um edital de 500 itens são 500 chamadas. Fazer isso para o Brasil inteiro seria abusar de um
   serviço público para guardar o que ninguém vai olhar. As portas são `--controle` e
   `--meus-negocios`; não existe "varre tudo".

   ══ ADITIVO: O QUE ESTA FERRAMENTA ESCREVE, ELA MESMA CRIOU ════════════════════════════════
   `licitacao_itens` nasceu vazia em 14/08 (ddl/licitacao_itens.sql) e só este coletor escreve
   nela. O upsert por (numero_controle, numero_item) REFAZ a linha que ele mesmo pôs — que é
   "refazer o atual", e não "apagar o anterior". Nenhum dado de outra origem corre risco.

     node tools/coleta_resultados.js --controle 01640429000106-1-000117/2026
     node tools/coleta_resultados.js --meus-negocios [--teto 10]
     node tools/coleta_resultados.js --controle ... --previa
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = n => process.argv.includes(n);
const PREVIA = tem('--previa');
const TETO = parseInt(arg('--teto') || '10', 10);
/* TETO DE ITENS POR LICITAÇÃO. Resultado é 1 requisição por item; um edital de 500 itens são
   500 chamadas ao PNCP. O teto é declarado, e quando ele morde a linha DIZ — teto silencioso
   é o mesmo defeito do `limit=1000` com outro número. */
const TETO_ITENS = parseInt(arg('--teto-itens') || '300', 10);

async function pncp(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(45000) });
  if (!r.ok) { const e = new Error('o PNCP respondeu ' + r.status); e.status = r.status; throw e; }
  /* ══ 200 COM CORPO VAZIO É "AINDA NÃO HÁ", E NÃO FALHA DE PARSE ═══════════════════════════
     MEDIDO em 14/08 numa licitação real de Pedra Bonita/MG: em 3 dos 195 itens o endpoint de
     resultados devolve **HTTP 200 com o corpo em branco**. `r.json()` estoura ali com
     "Unexpected end of JSON input", e do jeito que eu tinha escrito isso virava uma linha de
     ⚠️ no console — barulho de erro para o caso NORMAL de um item que ainda não foi julgado.
     >>> RUÍDO DE ERRO NO CASO NORMAL É COMO SE ENSINA ALGUÉM A IGNORAR ERRO. E o item já cai
         em "ainda sem resultado" pelo caminho certo, com os campos em `null`. */
  const t = await r.text();
  if (!t.trim()) return [];
  return JSON.parse(t);
}
const num = v => (v == null || v === '' || !isFinite(Number(v))) ? null : Number(v);

async function umaLicitacao(lic) {
  const base = `https://pncp.gov.br/api/pncp/v1/orgaos/${lic.cnpj}/compras/${lic.ano}/${lic.sequencial}`;
  let itens = [], truncou = false;
  for (let p = 1; p <= 6; p++) {
    let lote;
    try { lote = await pncp(`${base}/itens?pagina=${p}&tamanhoPagina=100`); }
    catch (e) {
      if (e.status === 404 && p === 1) { console.log(`  ${lic.numero_controle}  ○ o PNCP não tem itens para esta licitação`); return { semItens: true }; }
      console.log(`  ${lic.numero_controle}  ⚠️ ${e.message}`); return { erro: e.message };
    }
    /* "PÁGINA VAZIA" (fim normal) e "200 que não é lista" (resposta que ninguém sabe ler) saíam
       pela mesma porta calada — e aí a segunda virava a primeira, e a licitação era contada como
       "nenhum item". A19: não consegui ler nunca vira não existe. (A36 · 20/08) */
    if (!Array.isArray(lote)) {
      console.log(`  ${lic.numero_controle}  ⚠️ o PNCP respondeu 200 com algo que não é uma lista`);
      return { erro: '200 sem lista de itens' };
    }
    if (!lote.length) break;
    itens = itens.concat(lote);
    if (lote.length < 100) break;
    if (p === 6) truncou = true;
  }
  if (!itens.length) { console.log(`  ${lic.numero_controle}  ○ nenhum item`); return { semItens: true }; }
  const alvo = itens.slice(0, TETO_ITENS);
  console.log(`  ${lic.numero_controle}  ${itens.length} item(ns)`
    + (truncou ? '  ⚠️ LEITURA TRUNCADA (bateu no teto de páginas)' : '')
    + (itens.length > TETO_ITENS ? `  ⚠️ resultado só dos ${TETO_ITENS} primeiros (teto)` : ''));

  const linhas = [];
  let comResultado = 0, semResultado = 0;
  for (const it of alvo) {
    const nItem = String(it.numeroItem != null ? it.numeroItem : '');
    if (!nItem) continue;
    const l = {
      numero_controle: lic.numero_controle,
      licitacao_id: lic.id || null,
      numero_item: nItem,
      descricao: String(it.descricao || '(sem descrição)'),
      quantidade: num(it.quantidade),
      unidade: it.unidadeMedida || null,
      valor_unitario_ref: num(it.valorUnitarioEstimado),
      situacao: it.situacaoCompraItemNome || null,
      bruto: it,
      resultado_vencedor: null, resultado_cnpj: null, resultado_valor_unit: null,
      resultado_quantidade: null, resultado_situacao: null, resultado_lido_em: null,
    };
    /* ══ O RESULTADO ═══════════════════════════════════════════════════════════════════════
       404 aqui quer dizer "este item ainda não tem resultado publicado" — e é o caso NORMAL de
       uma licitação em andamento. Ele NÃO é erro, e o item fica com os campos de resultado em
       `null`, que é exatamente o "ainda não sei" que o DDL promete. */
    try {
      const rs = await pncp(`${base}/itens/${encodeURIComponent(nItem)}/resultados`);
      const r0 = Array.isArray(rs) && rs.length
        /* O PNCP pode publicar MAIS DE UM resultado por item (remanescente, cancelamento,
           reclassificação). Fica o de menor `ordemClassificacaoSrp` entre os NÃO cancelados —
           quem ganhou é o primeiro classificado que não foi cancelado. Pegar o último inserido
           entregaria um cancelamento como se fosse o vencedor. */
        ? rs.filter(x => !x.dataCancelamento).sort((a, b) => (a.ordemClassificacaoSrp || 99) - (b.ordemClassificacaoSrp || 99))[0]
        : null;
      if (r0) {
        l.resultado_vencedor   = r0.nomeRazaoSocialFornecedor || null;
        l.resultado_cnpj       = r0.niFornecedor || null;
        l.resultado_valor_unit = num(r0.valorUnitarioHomologado);
        l.resultado_quantidade = num(r0.quantidadeHomologada);
        l.resultado_situacao   = it.situacaoCompraItemNome || 'homologado';
        l.resultado_lido_em    = new Date().toISOString();
        comResultado++;
      } else semResultado++;
    } catch (e) {
      if (e.status !== 404) console.log(`     ⚠️ item ${nItem}: ${e.message}`);
      semResultado++;
    }
    linhas.push(l);
  }
  console.log(`     ${comResultado} com resultado publicado · ${semResultado} ainda sem`);

  if (PREVIA) { console.log('     [PRÉVIA — nada gravado]'); return { previa: true }; }
  for (let i = 0; i < linhas.length; i += 200) {
    /* ══ `on_conflict` É OBRIGATÓRIO, E EU DESCOBRI ISSO NO 23505 ═════════════════════════════
       `resolution=merge-duplicates` sozinho resolve conflito contra a CHAVE PRIMÁRIA — e aqui a
       PK é o `id` bigserial, enquanto a chave de negócio é (numero_controle, numero_item), que
       vive num índice único. Sem dizer o alvo, o PostgREST insere e o banco recusa com
       `23505 duplicate key`.
       >>> ELE FALHOU BARULHENTO, E ISSO FOI SORTE. O mesmo erro na coleta de arquivos (fatia
           A6) só não apareceu porque cada licitação foi coletada UMA vez — e o meu assert
           afirmava "re-rodar REESCREVE, não duplica", que era falso. Uma promessa de suíte que
           ninguém tinha executado. Corrigido nos dois. */
    const r = await fetch(`${SB}/rest/v1/licitacao_itens?on_conflict=numero_controle,numero_item`, {
      method: 'POST', headers: { ...H, Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(linhas.slice(i, i + 200)),
    });
    if (!r.ok) { console.log('     ERRO ao gravar: ' + r.status + ' ' + (await r.text()).slice(0, 180)); return { erro: 'gravacao' }; }
  }
  return { gravou: linhas.length, comResultado };
}

(async () => {
  console.log('=== ITENS E RESULTADO POR ITEM (fatia A7) ===' + (PREVIA ? '   [PRÉVIA]' : ''));
  const controle = arg('--controle');
  const meus = tem('--meus-negocios');
  if (!controle && !meus) {
    console.error('\nuso:  --controle <numero_controle>   |   --meus-negocios [--teto N]   [--previa]');
    console.error('\nNÃO existe modo "varre tudo": resultado e 1 requisicao POR ITEM, e um edital de 500');
    console.error('itens sao 500 chamadas. Isso pro Brasil inteiro e abusar de um servico publico.');
    process.exit(1);
  }

  /* ══ A MESMA CORREÇÃO DA `coleta_editais.js`, PELA MESMA RAZÃO (A36 · 20/08) ═════════════════
     As três leituras eram `await (await fetch(...)).json()` sem conferência. Num 403,
     `alvos.length` vinha `undefined` e o programa escrevia **"não achei esta licitação no
     índice"** — uma afirmação sobre o índice feita por quem não conseguiu olhar o índice. É o
     defeito que a A19 nomeou: *"não consegui perguntar" NUNCA vira "não existe"*.
     >>> AS DUAS FERRAMENTAS SÃO IRMÃS E O CONSERTO É IGUAL NAS DUAS, de propósito. Consertar só
         uma criaria o par que diverge — e a próxima pessoa a ler acharia que a diferença é
         intencional. */
  const le = async (q, oQue) => {
    let r;
    try { r = await fetch(`${SB}/rest/v1/${q}`, { headers: H }); }
    catch (e) { console.error(`\n🔴 não consegui perguntar ao banco (${oQue}): ${e.message}`); process.exit(1); }
    if (!r.ok) {
      console.error(`\n🔴 não consegui perguntar ao banco (${oQue}): HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
      console.error('   ISTO NÃO É "não achei" — é "não consegui olhar". As duas levam a ações diferentes.');
      process.exit(1);
    }
    const j = await r.json();
    if (!Array.isArray(j)) { console.error(`\n🔴 a resposta de ${oQue} veio 200 mas não é uma lista`); process.exit(1); }
    return j;
  };

  let alvos = [];
  if (controle) {
    alvos = await le(`licitacoes?select=id,numero_controle,cnpj,ano,sequencial&numero_controle=eq.${encodeURIComponent(controle)}`, 'a licitação pelo número de controle');
    if (!alvos.length) { console.error('\nnão achei esta licitação no índice: ' + controle); process.exit(1); }
  } else {
    const negs = await le('negocios?select=licitacao_id&arquivado=is.false', 'os negócios abertos');
    const ids = [...new Set(negs.map(n => n.licitacao_id).filter(Boolean))];
    console.log(`\n${negs.length} negócio(s) aberto(s) · ${ids.length} com licitação do índice ligada`);
    if (ids.length) alvos = await le(`licitacoes?select=id,numero_controle,cnpj,ano,sequencial&id=in.(${ids.join(',')})&limit=${TETO}`, 'as licitações do funil');
  }

  console.log(`\nlicitações: ${alvos.length}`);
  let ok = 0, sem = 0, erro = 0, totalRes = 0;
  for (const l of alvos.slice(0, TETO)) {
    const r = await umaLicitacao(l);
    if (r.gravou || r.previa) { ok++; totalRes += (r.comResultado || 0); }
    else if (r.semItens) sem++; else erro++;
  }
  console.log(`\n── resumo ──  ${ok} licitação(ões) · ${totalRes} item(ns) com resultado · ${sem} sem itens · ${erro} com erro`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
