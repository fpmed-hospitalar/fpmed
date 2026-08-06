// ============================================================
// Supabase Edge Function: coletar-licitacoes   (FPMED — item 10)
//
// O QUE ELA RESOLVE: a tela de Licitações precisa de dado SEMPRE, e o PNCP caiu 4 vezes em dois
// dias. O índice próprio (tabela `licitacoes`) é a resposta — mas alguém tem que alimentá-lo
// sozinho, 3x por dia, sem uma pessoa rodando script no notebook.
//
// >>> POR QUE UMA EDGE FUNCTION E NÃO O GITHUB ACTIONS DIRETO NO BANCO (decisão do Lemuel, 05/08):
//     o repo é PÚBLICO e a `service_role` IGNORA TODA A RLS. Pôr a service_role nos Secrets do
//     Actions é pôr a chave-mestra do banco num pipeline. Aqui a chave fica DENTRO do Supabase
//     (a plataforma injeta SUPABASE_SERVICE_ROLE_KEY no runtime) e o CI só conhece um segredo
//     DEDICADO e DESCARTÁVEL. Se esse segredo vazar, o estrago é o que ESTA função sabe fazer:
//     gravar licitação pública. Não o banco inteiro.
//
// CONTRATO:
//   POST /functions/v1/coletar-licitacoes
//   header: x-coleta-token: <COLETA_TOKEN>       (segredo dedicado — NÃO é a service_role)
//   body opcional: { "dias": 7, "ufs": "GO,DF", "modalidades": "6,8,9" }
//   resposta: { ok, coletadas, gravadas, janela, breakerAberto, erro }
//
// >>> NUNCA APAGA. Se o PNCP estiver fora, o que já está no banco FICA. Coleta que falha tem que
//     deixar a tela igual ao que estava — nunca vazia. É a mesma garantia do tools/coleta_pncp.js.
//
// >>> O CARIMBO DE FRESCOR (`coleta_status.ultima_ok`) SÓ AVANÇA em rodada que terminou sem
//     breaker aberto e sem erro. A tela mostra esse campo como "coletados às HH:MM": avançá-lo
//     numa rodada que falhou faria a tela mentir sobre a idade do dado.
//
// ⚠️ ORÇAMENTO DE TEMPO: edge function não roda para sempre. Por isso a janela padrão daqui é
//    CURTA (7 dias) e o teto de páginas é menor que o do script local — 3 chamadas por dia
//    cobrem o incremento com folga, e uma função que estoura o tempo grava PELA METADE e ainda
//    assim não avança o carimbo (o `erro` fica preenchido). Melhor rodar curto e voltar.
//
// DEPLOY e SEGREDO: ver o README.md ao lado.
// ============================================================

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SR  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;   // injetada pela plataforma, não pelo CI
const TOKEN  = Deno.env.get("COLETA_TOKEN");                 // segredo dedicado do agendador

const TAM_PAGINA = 10;      // MEDIDO em 04/08: com 50 a API não responde; com 10 responde em ~450ms
const TETO_PAGINAS = 12;    // menor que o do script local: aqui o orçamento é de segundos
const TIMEOUT_MS = 20000;
const FALHAS_ATE_ABRIR = 5;
const DIAS_PADRAO = 7;
const TETO_MS = 100000;     // para de coletar e grava o que tem, antes da plataforma cortar

// ── RITMO (anti-429) — mesma regra do tools/coleta_pncp.js, e tem que continuar sendo ────────
// MEDIDO em 06/08/2026, na PRIMEIRA coleta que de fato conversou com o PNCP (esta função): 70
// licitações gravadas e então HTTP 429. A fonte estava SAUDÁVEL — só disse "devagar".
// >>> 429 NÃO É QUEDA. Tratar igual à queda fez o breaker matar a rodada com a API no ar, e a
//     retentativa de 1s bate mais forte em quem acabou de pedir pra desacelerar.
// A correção não é retentar melhor, é ANDAR MAIS DEVAGAR: a pausa entre chamadas DOBRA a cada
// 429 e não volta a acelerar dentro da rodada.
const PAUSA_MS = 300;
const PAUSA_TETO_MS = 8000;
const TETO_RATE_LIMIT = 20;   // sem teto, cota esgotada vira laço até a plataforma cortar

const H = { apikey: SB_SR, Authorization: "Bearer " + SB_SR, "Content-Type": "application/json" };
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Espera dobrando a partir de 1s, com teto de 30s — insistir de imediato numa API que caiu
// só piora. O teto existe pra que uma queda longa não vire espera de 8 minutos.
const esperaBackoff = (t: number) => Math.min(1000 * Math.pow(2, t), 30000);

function criaBreaker(limite = FALHAS_ATE_ABRIR) {
  let seguidas = 0, aberto = false;
  return {
    ok() { seguidas = 0; },
    falhou() { seguidas++; if (seguidas >= limite) aberto = true; return aberto; },
    get aberto() { return aberto; },
    get seguidas() { return seguidas; },
  };
}

function criaRitmo(base = PAUSA_MS, teto = PAUSA_TETO_MS) {
  let pausa = base, vezes = 0;
  return {
    get pausa() { return pausa; },
    get vezes() { return vezes; },
    freou() { vezes++; pausa = Math.min(pausa * 2, teto); return pausa; },
    get estourou() { return vezes > TETO_RATE_LIMIT; },
  };
}
// Obedece o `Retry-After` quando vem (o servidor sabe da própria cota melhor que nós) e, sem
// ele, começa em 5s — não em 1s como a queda.
function esperaRateLimit(tentativa: number, retryAfter: string | null) {
  const h = parseInt(String(retryAfter), 10);
  if (isFinite(h) && h > 0) return Math.min(h * 1000, 60000);
  return Math.min(5000 * Math.pow(2, tentativa), 60000);
}

const yyyymmdd = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

// Janela incremental: da última coleta OK até hoje, com 2 dias de sobreposição — publicação
// pode ser corrigida depois, e reler dois dias é barato perto de perder uma alteração.
function janela(ultimaOk: Date | null, hoje: Date, dias: number) {
  const fim = new Date(hoje);
  let ini: Date;
  if (ultimaOk) { ini = new Date(ultimaOk); ini.setDate(ini.getDate() - 2); }
  else { ini = new Date(fim); ini.setDate(ini.getDate() - dias + 1); }
  if (ini > fim) ini = new Date(fim);
  return { ini, fim };
}

// `bruto` guarda a resposta inteira. No dia em que faltar um campo, ele está lá — e não é
// preciso recoletar pra descobrir o que a API mandava.
function normaliza(x: any) {
  const org = x.orgaoEntidade || {}, un = x.unidadeOrgao || {};
  const num = (v: any) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
  return {
    portal: "PNCP",
    cnpj: String(org.cnpj || "").replace(/\D/g, ""),
    ano: parseInt(x.anoCompra) || null,
    sequencial: parseInt(x.sequencialCompra) || null,
    numero_controle: x.numeroControlePNCP || null,
    numero_compra: x.numeroCompra != null ? String(x.numeroCompra) : null,
    modalidade: x.modalidadeNome || null,
    modalidade_cod: parseInt(x.modalidadeId) || null,
    modo_disputa: x.modoDisputaNome || null,
    situacao: x.situacaoCompraNome || null,
    orgao: org.razaoSocial || null,
    unidade: un.nomeUnidade || null,
    municipio: un.municipioNome || null,
    uf: un.ufSigla || null,
    objeto: x.objetoCompra || null,
    valor_estimado: num(x.valorTotalEstimado),
    data_publicacao: x.dataPublicacaoPncp ? String(x.dataPublicacaoPncp).slice(0, 10) : null,
    data_abertura: x.dataAberturaProposta ? String(x.dataAberturaProposta) : null,
    data_encerramento: x.dataEncerramentoProposta ? String(x.dataEncerramentoProposta) : null,
    link_sistema: x.linkSistemaOrigem || null,
    bruto: x,
    atualizado_em: new Date().toISOString(),
  };
}
const valida = (r: any) => !!(r.cnpj && r.ano && r.sequencial);   // sem chave natural não entra

async function puxa(url: string, breaker: ReturnType<typeof criaBreaker>, ritmo: ReturnType<typeof criaRitmo>) {
  let t = 0;      // tentativas de FALHA (queda/timeout) — só estas gastam o orçamento
  let t429 = 0;   // rate limits, contados à parte: a API está no ar
  while (t < 4) {
    if (breaker.aberto) return { erro: "breaker aberto" } as any;
    if (ritmo.estourou) return { erro: `rate limit persistente do PNCP (${ritmo.vezes}x)` } as any;
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { signal: ac.signal });
      clearTimeout(to);
      // 429 não passa pelo breaker de propósito: ele existe pra "a fonte caiu", e aqui ela
      // respondeu. O que muda é o RITMO da rodada, não o contador de falhas.
      if (r.status === 429) {
        const espera = esperaRateLimit(t429++, r.headers.get("retry-after"));
        ritmo.freou();
        await dormir(espera);
        continue;
      }
      if (r.status === 204) { breaker.ok(); return { dados: [], total: 0, paginas: 1 }; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      breaker.ok();
      return { dados: j.data || [], total: j.totalRegistros || 0, paginas: j.totalPaginas || 1 };
    } catch (e: any) {
      clearTimeout(to);
      const abriu = breaker.falhou();
      if (abriu) return { erro: String(e?.message || e?.name || e) } as any;
      await dormir(esperaBackoff(t++));
    }
  }
  return { erro: "esgotou as tentativas" } as any;
}

Deno.serve(async (req) => {
  const J = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

  // ── PORTA: segredo dedicado, nada mais ────────────────────────────────────────────────────
  // Sem TOKEN configurado a função fica FECHADA em vez de aberta. O contrário — "sem segredo,
  // libera" — é como um endpoint de escrita acaba público por esquecimento de configuração.
  if (!TOKEN) return J({ error: "COLETA_TOKEN nao configurado no projeto — funcao fechada" }, 500);
  if (req.method !== "POST") return J({ error: "use POST" }, 405);
  if (req.headers.get("x-coleta-token") !== TOKEN) return J({ error: "nao autorizado" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* body é opcional */ }

  const UFS = String(body.ufs || "GO,DF,MG,MT,MS,TO,BA").split(",").map((s) => s.trim()).filter(Boolean);
  const MODS = String(body.modalidades || "6,8,9").split(",").map((s) => parseInt(s.trim())).filter(Boolean);
  const DIAS = parseInt(body.dias) || DIAS_PADRAO;
  const t0 = Date.now();

  // estado anterior (pra janela incremental)
  let ultimaOk: Date | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/coleta_status?fonte=eq.PNCP&select=*`, { headers: H });
    const j = await r.json();
    if (Array.isArray(j) && j[0]?.ultima_ok) ultimaOk = new Date(j[0].ultima_ok);
  } catch { /* sem estado = primeira coleta */ }

  const { ini, fim } = janela(ultimaOk, new Date(), DIAS);
  const breaker = criaBreaker();
  const ritmo = criaRitmo();
  const achados = new Map<string, any>();
  let erro: string | null = null, truncou = 0, estourouTempo = false;

  for (const uf of UFS) {
    for (const mod of MODS) {
      if (breaker.aberto || estourouTempo) break;
      let pag = 1, totalPag = 1;
      do {
        if (Date.now() - t0 > TETO_MS) { estourouTempo = true; break; }
        const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao`
          + `?dataInicial=${yyyymmdd(ini)}&dataFinal=${yyyymmdd(fim)}`
          + `&codigoModalidadeContratacao=${mod}&uf=${uf}&pagina=${pag}&tamanhoPagina=${TAM_PAGINA}`;
        const r = await puxa(url, breaker, ritmo);
        if (r.erro) { erro = r.erro; break; }
        totalPag = Math.min(r.paginas || 1, TETO_PAGINAS);
        if ((r.paginas || 1) > TETO_PAGINAS && pag === 1) truncou++;
        for (const x of r.dados) {
          const n = normaliza(x);
          if (!valida(n)) continue;
          achados.set(`${n.cnpj}|${n.ano}|${n.sequencial}`, n);
        }
        pag++;
        await dormir(ritmo.pausa);   // o que EVITA o 429; retentar melhor só o remedia
      } while (pag <= totalPag && !breaker.aberto);
      if (breaker.aberto) break;
    }
  }

  // >>> NUNCA APAGA: sem resultado, o banco fica como está e a tela continua servindo.
  const regs = [...achados.values()];
  let gravadas = 0;
  for (let i = 0; i < regs.length; i += 200) {
    const lote = regs.slice(i, i + 200);
    const r = await fetch(`${SB_URL}/rest/v1/licitacoes?on_conflict=portal,cnpj,ano,sequencial`, {
      method: "POST",
      headers: { ...H, Prefer: "return=minimal,resolution=merge-duplicates" },
      body: JSON.stringify(lote),
    });
    if (!r.ok) { erro = "gravacao HTTP " + r.status + " " + (await r.text()).slice(0, 160); break; }
    gravadas += lote.length;
  }

  // carimbo de frescor — só avança em rodada inteira e sem falha
  const okDeVerdade = !breaker.aberto && !erro && !estourouTempo;
  const st: Record<string, unknown> = {
    fonte: "PNCP",
    ultima_tentativa: new Date().toISOString(),
    ultimo_erro: erro || (estourouTempo ? "orcamento de tempo esgotado" : null),
    registros: gravadas,
    atualizado_em: new Date().toISOString(),
  };
  if (okDeVerdade) st.ultima_ok = new Date().toISOString();
  await fetch(`${SB_URL}/rest/v1/coleta_status?on_conflict=fonte`, {
    method: "POST", headers: { ...H, Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify([st]),
  }).catch(() => {});

  // 200 mesmo em rodada parcial: o agendador não deve tratar "o PNCP estava fora" como falha
  // do nosso lado e ficar reexecutando. O campo `ok` diz a verdade pra quem lê o relatório.
  return J({
    ok: okDeVerdade,
    coletadas: regs.length,
    gravadas,
    janela: `${yyyymmdd(ini)}→${yyyymmdd(fim)}`,
    truncou,
    breakerAberto: breaker.aberto,
    rateLimits: ritmo.vezes,
    pausaFinalMs: ritmo.pausa,
    estourouTempo,
    erro,
    segundos: Math.round((Date.now() - t0) / 1000),
  });
});
