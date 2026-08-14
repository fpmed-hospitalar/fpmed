/* ══════════════════════════════════════════════════════════════════════════════════════════
   coleta_pncp_busca.js — A PORTA QUE ESTÁ ABERTA (fatia A13, 14/08/2026)

   ══ POR QUE ESTA FERRAMENTA NASCEU NUMA FATIA DE "FONTES EXTRA-PNCP" ═══════════════════════
   A A13 mandava agregar fontes fora do PNCP, em ordem de valor: licitacoes-e, EBSERH/Petronect,
   Sistema S — com muralhas inegociáveis: só página pública, sem login, sem burlar barreira; se
   o portal bloquear ou exigir desafio, PULA e anota. Medido em 14/08, uma por uma:

     · licitacoes-e (Banco do Brasil) .. HTTP 403 em TUDO, inclusive no `/robots.txt`. Não dá
       nem pra ler o arquivo que diria o que é permitido. Barreira anti-robô: MURALHA, pulei.
     · Petronect ...................... portal SAP com sessão; o `/robots.txt` devolve página de
       erro do runtime. E é da Petrobras — não é compra de saúde. Pulei.
     · EBSERH ......................... **17.981 editais dela JÁ ESTÃO NO PNCP**, publicados por
       ela mesma. Ela não é fonte nova: é conteúdo que a fonte que já temos publica.
     · Sistema S ...................... parcialmente no PNCP (o SENAC publica lá; SESI/SESC/SENAI
       aparecem mais como CONTRATADOS por municípios do que como publicadores).

   >>> ENTÃO A FASE 2 NÃO ENTREGOU FONTE NOVA, E A MEDIÇÃO DIZ POR QUÊ. O que ela entregou foi
       melhor: a descoberta de que o valor que se procurava fora já está dentro — e de que a
       porta que usamos pra buscá-lo estava fechada.

   ══ A PORTA FECHADA, E A QUE ESTÁ ABERTA ═══════════════════════════════════════════════════
   O índice é abastecido pela API de CONSULTA do PNCP (`/api/consulta/v1/contratacoes/publicacao`),
   e ela está FORA desde 14/08 — TimeoutError em 30 s, medido de novo agora. Enquanto isso, o
   endpoint de BUSCA (`/api/search/`) responde normal: é o mesmo que a tela Encontrar já chama na
   "busca nacional", público, sem chave, com `access-control-allow-origin: *`.
   >>> ESTA FERRAMENTA USA A PORTA QUE ESTÁ ABERTA. Não é fonte nova nem raspagem: é a API
       pública do próprio PNCP, a mesma que a tela usa, com ritmo educado.

   ══ E ELA COLETA POR TERMO, QUE É O QUE A A9 MEDIU QUE IMPORTA ══════════════════════════════
   A varredura por UF traz tudo de sete estados e nada dos outros vinte. A busca por termo traz
   "albumina" do Brasil inteiro. Com o achado da A8 (o produto mora no ITEM, não no objeto) e a
   A9 já enchendo `licitacao_itens`, coletar por termo é o caminho que responde à pergunta que o
   operador faz de verdade: *quem está comprando o que eu vendo?*

   ══ O QUE A BUSCA NÃO ENTREGA, DITO ANTES DE ALGUÉM PROCURAR ═══════════════════════════════
   O `/api/search/` **não traz a janela da proposta** (`dataAberturaProposta` /
   `dataEncerramentoProposta`). Eu ia buscá-la no detalhe da compra — e MEDI, agora:

     /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}   -> HTTP 301, com a mensagem
        "Este endpoint foi movido para: /api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}"
     /api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{seq} -> TimeoutError em 30.034 ms

   Ou seja: o detalhe da COMPRA mudou de casa para dentro da API de consulta, que é justamente a
   que está fora. O detalhe dos ITENS (`/api/pncp/v1/.../itens`) continua no ar e respondendo em
   milissegundos — é outro serviço.

   >>> ENTÃO A LICITAÇÃO ENTRA SEM A JANELA DE PROPOSTA, E ISSO É DITO EM TRÊS LUGARES: no
       console da rodada (quantas entraram sem prazo), no `bruto` (`_coleta: 'busca'`) e aqui.
       A alternativa seria não coletar — e ela é pior: uma licitação sem prazo no índice ainda
       responde "quem compra albumina", que é a pergunta que o operador faz. O que NÃO se pode
       é inventar uma data.
   >>> E O BURACO SE FECHA SOZINHO quando o PNCP voltar: o `coleta_pncp.js` grava pela MESMA
       chave natural (portal, cnpj, ano, sequencial), então a varredura normal vai PREENCHER a
       janela dessas linhas em vez de duplicá-las.

     node tools/coleta_pncp_busca.js --previa                (não grava; mostra o que traria)
     node tools/coleta_pncp_busca.js --termos albumina,dipirona
     node tools/coleta_pncp_busca.js --teto 200 --paginas 4
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const { criaBreaker, esperaBackoff, criaRitmo, esperaRateLimit, FALHAS_ATE_ABRIR, normaliza, valida } = require('./coleta_pncp.js');

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const PREVIA = process.argv.includes('--previa');
const TETO = parseInt(arg('--teto') || '300', 10);
const PAGINAS = parseInt(arg('--paginas') || '3', 10);
const TAM_PAGINA = 50;
/* ══ SÓ O QUE ESTÁ RECEBENDO PROPOSTA, E ISSO É DECISÃO, NÃO FILTRO ═════════════════════════
   MEDIDO em 14/08: "albumina" com `status=todos` dá 3.658 editais, e os primeiros são de 2023 e
   2024 — a busca ordena por RELEVÂNCIA, não por data. Com `status=recebendo_proposta` dá 169, e
   eles são de julho e agosto de 2026.
   >>> DESPEJAR OS 3.658 NO ÍNDICE SERIA ENCHER A BUSCA DE EDITAL ENCERRADO HÁ DOIS ANOS. Índice
       grande não é índice bom: quem procura oportunidade quer o que ainda dá pra disputar, e o
       resto vira ruído com aparência de cobertura. `--status todos` existe para quem quiser
       pesquisa histórica de propósito. */
const STATUS = arg('--status') || 'recebendo_proposta';

/* OS TERMOS SÃO OS DO RAMO DA FPMED, e são os MESMOS seis que a tela usa quando o campo de busca
   está vazio (`CATEGORIAS_RAMO` no fpmed_licitacoes.html). Duas listas do "que é o nosso ramo"
   acabariam discordando, e a discordância apareceria como "a tela mostra o que a coleta não
   trouxe" — que ninguém liga a duas constantes em arquivos diferentes.

   ══ COM **UMA** TROCA, DECLARADA, E ELA TEM MOTIVO TÉCNICO ═════════════════════════════════
   A tela usa `'farmac'` — um PEDAÇO de palavra — porque lá o filtro é `String.includes()`, e o
   pedaço pega "farmacêutico", "farmácia" e "farmacológico" de uma vez. Aqui o consumidor é um
   motor de BUSCA TEXTUAL, que casa PALAVRA: mandar `farmac` a ele é mandar um termo que não
   existe em documento nenhum, e a resposta seria zero — silenciosamente, porque zero também é
   uma resposta válida.
   >>> ENTÃO A TROCA É `farmac -> farmacêutico`, E SÓ ELA. A suíte cobra exatamente isso: as duas
       listas iguais a menos deste par. Assim a próxima diferença — a que alguém acrescentar sem
       pensar — fica vermelha, e esta, que é deliberada, não fica. */
const TERMOS_RAMO = ['medicamento', 'hospitalar', 'material médico', 'farmacêutico', 'soro', 'correlatos'];

/* O `/api/search/` RECUSA CLIENTE SEM `User-Agent` DE NAVEGADOR — medido em 11/08: a conexão é
   cortada (ECONNRESET) enquanto a API de consulta responde 200 normalmente. Não é disfarce: o
   nome da FPMED vai junto, e é por ele que o portal sabe quem está chamando. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPMED-Hospitalar/1.0 (coleta de licitacoes publicas; licitacao@fpmed.com.br)';
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function pega(url, breaker, ritmo, aceitaJson) {
  let t = 0, t429 = 0;
  while (t < 4) {
    if (breaker.aberto) return { erro: 'breaker aberto' };
    if (ritmo.estourou) return { erro: `rate limit persistente do PNCP (${ritmo.vezes}x)` };
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(30000) });
      if (r.status === 429) {
        const espera = esperaRateLimit(t429++, r.headers.get('retry-after'));
        const nova = ritmo.freou();
        console.log(`    ~ 429 — desacelerando pra ${nova}ms, esperando ${espera / 1000}s`);
        await dormir(espera);
        continue;
      }
      if (r.status === 404) { breaker.ok(); return { vazio: true }; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      breaker.ok();
      if (!txt.trim()) return { vazio: true };
      return { dados: JSON.parse(txt) };
    } catch (e) {
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

async function jaNoIndice(controles) {
  const tenho = new Set();
  for (let i = 0; i < controles.length; i += 80) {
    const lote = controles.slice(i, i + 80).map(c => '"' + String(c).replace(/["(),]/g, '') + '"').join(',');
    const r = await fetch(`${SB}/rest/v1/licitacoes?select=numero_controle&numero_controle=in.(${lote})`, { headers: H });
    if (!r.ok) continue;
    for (const x of await r.json()) tenho.add(x.numero_controle);
  }
  return tenho;
}

(async () => {
  console.log('=== COLETA PELO ENDPOINT DE BUSCA DO PNCP (fatia A13) ===' + (PREVIA ? '   [PRÉVIA]' : ''));
  const termos = (arg('--termos') || '').trim()
    ? arg('--termos').split(',').map(s => s.trim()).filter(Boolean)
    : TERMOS_RAMO;
  console.log(`termos: ${termos.join(' · ')}`);
  console.log(`status: ${STATUS}` + (STATUS === 'recebendo_proposta' ? '  (só o que ainda dá pra disputar)' : '  ⚠️ inclui edital já encerrado'));
  console.log(`teto: ${TETO} licitações novas · ${PAGINAS} página(s) de ${TAM_PAGINA} por termo\n`);

  const breaker = criaBreaker(FALHAS_ATE_ABRIR);
  const ritmo = criaRitmo(400);

  // ── 1. ACHAR ─────────────────────────────────────────────────────────────────────────────
  const achados = new Map();     // numero_controle -> {cnpj, ano, seq, termo}
  for (const termo of termos) {
    let doTermo = 0;
    for (let p = 1; p <= PAGINAS; p++) {
      const u = 'https://pncp.gov.br/api/search/?q=' + encodeURIComponent(termo)
        + `&tipos_documento=edital&pagina=${p}&tam_pagina=${TAM_PAGINA}&status=${encodeURIComponent(STATUS)}`;
      const r = await pega(u, breaker, ritmo);
      if (r.erro) { console.log(`  "${termo}" p${p}: ${r.erro}`); break; }
      const itens = (r.dados && r.dados.items) || [];
      if (!itens.length) break;
      for (const x of itens) {
        const nc = x.numero_controle_pncp;
        const cnpj = String(x.orgao_cnpj || '').replace(/\D/g, '');
        const ano = parseInt(x.ano, 10);
        const seq = parseInt(x.numero_sequencial, 10);
        if (!nc || !cnpj || !ano || !seq) continue;        // sem chave natural não entra
        if (!achados.has(nc)) { achados.set(nc, { cnpj, ano, seq, termo, cru: x }); doTermo++; }
      }
      await dormir(ritmo.pausa);
    }
    console.log(`  "${termo}" → ${doTermo} novo(s) no conjunto (total acumulado ${achados.size})`);
  }

  // ── 2. O QUE JÁ É NOSSO NÃO SE REESCREVE À TOA ───────────────────────────────────────────
  /* A licitação que já está no índice veio da varredura normal, COM a janela de proposta. Se ela
     entrasse de novo por aqui, o upsert sobrescreveria a linha inteira e APAGARIA o prazo que já
     tínhamos — trocando dado bom por dado incompleto, em silêncio, com cara de "atualizei". */
  const todos = [...achados.keys()];
  const tenho = await jaNoIndice(todos);
  const novos = todos.filter(nc => !tenho.has(nc)).slice(0, TETO);
  console.log(`\nachados: ${todos.length} · já no índice: ${tenho.size} · novos: ${novos.length}`
    + (todos.length - tenho.size > TETO ? `  (teto de ${TETO}; ${todos.length - tenho.size - TETO} ficam pra próxima)` : ''));

  // ── 3. MONTAR A LINHA COM O QUE A BUSCA DÁ ───────────────────────────────────────────────
  const linhas = novos.map(nc => {
    const x = achados.get(nc).cru;
    const num = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };
    return {
      portal: 'PNCP',                       // ela É do PNCP; selo de origem não se inventa
      cnpj: String(x.orgao_cnpj || '').replace(/\D/g, ''),
      ano: parseInt(x.ano, 10) || null,
      sequencial: parseInt(x.numero_sequencial, 10) || null,
      numero_controle: x.numero_controle_pncp || nc,
      numero_compra: x.numero != null ? String(x.numero) : null,
      modalidade: x.modalidade_licitacao_nome || null,
      modalidade_cod: parseInt(x.modalidade_licitacao_id, 10) || null,
      situacao: x.situacao_nome || null,
      orgao: x.orgao_nome || null,
      unidade: x.unidade_nome || null,
      municipio: x.municipio_nome || null,
      uf: x.uf || null,
      /* O `description` da busca é o texto que o PNCP indexa — às vezes o objeto, às vezes a
         descrição do item que casou. É ele que alimenta o tsvector, e é por ele que "albumina"
         passa a achar. O `title` entra junto porque sozinho o description às vezes é curto. */
      objeto: [x.title, x.description].filter(Boolean).join(' — ').trim() || null,
      valor_estimado: num(x.valor_global),
      data_publicacao: x.data_publicacao_pncp ? String(x.data_publicacao_pncp).slice(0, 10) : null,
      /* data_abertura / data_encerramento NÃO ENTRAM: a busca não os traz e o detalhe da compra
         está fora do ar (301 -> consulta -> timeout). Ficam NULL, que é "não sei" — e a
         varredura normal os preenche quando o PNCP voltar, pela mesma chave natural. */
      link_sistema: x.item_url ? 'https://pncp.gov.br' + x.item_url : null,
      bruto: Object.assign({ _coleta: 'busca', _termo: achados.get(nc).termo }, x),
      atualizado_em: new Date().toISOString(),
    };
  }).filter(valida);   // sem chave natural não entra — a mesma trava da varredura

  if (linhas.length) {
    const ufs = {};
    linhas.forEach(l => ufs[l.uf || '?'] = (ufs[l.uf || '?'] || 0) + 1);
    console.log(`\n${linhas.length} linha(s) prontas · ${linhas.length} SEM janela de proposta `
      + `(o detalhe da compra está fora do ar — ver o cabeçalho)`);
    console.log('  por UF: ' + Object.entries(ufs).sort((a, b) => b[1] - a[1])
      .map(([u, n]) => `${u} ${n}`).join(' · '));
    linhas.slice(0, 5).forEach(l => console.log(`    ${l.uf} · ${String(l.orgao || '').slice(0, 42)} · ${String(l.objeto || '').slice(0, 58)}`));
  }

  if (PREVIA) { console.log('\n[PRÉVIA — nada gravado]'); return; }
  let gravadas = 0;
  for (let i = 0; i < linhas.length; i += 200) {
    /* MESMA TABELA, SELO DE ORIGEM NO `portal` — o padrão que o Calendário 2025 estabeleceu e
       que o plano_fontes registra. Duas tabelas de licitação seriam duas respostas para "o que
       existe?".
       >>> O ALVO DO CONFLITO É A CHAVE NATURAL `(portal, cnpj, ano, sequencial)`, que é o índice
           único que a tabela TEM — e não o `numero_controle`, que parece a chave e não tem índice
           único. Errar isso não dá linha duplicada: dá `23505 duplicate key` e a rodada inteira
           não grava nada. É a lição da A7, e ela custou uma tarde. */
    const r = await fetch(`${SB}/rest/v1/licitacoes?on_conflict=portal,cnpj,ano,sequencial`, {
      method: 'POST', headers: { ...H, Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(linhas.slice(i, i + 200)),
    });
    if (!r.ok) { console.log('  ERRO ao gravar: ' + r.status + ' ' + (await r.text()).slice(0, 200)); break; }
    gravadas += linhas.slice(i, i + 200).length;
  }
  console.log(`\n── resumo ──  ${gravadas} licitação(ões) gravada(s) no índice`);
  if (ritmo.vezes) console.log(`⏱️  ${ritmo.vezes} rate limit(s) — terminou a ${ritmo.pausa}ms entre chamadas`);
  if (breaker.aberto) console.log('🔴 BREAKER ABERTO — a rodada parou; o que foi gravado FICA.');
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
