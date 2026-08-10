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
// >>> E DESDE 10/08 EXISTE UM SEGUNDO CARIMBO, `ultimo_dia_ok`, que é o que a tela realmente
//     precisa: ATÉ QUE DIA o índice está completo. `ultima_ok` fala da EXECUÇÃO ("a rodada
//     terminou?"), e com o volume real de publicação a resposta é não quase sempre — as três
//     rodadas de 10/08 gravaram 190, 213 e 272 linhas e nenhuma fechou a janela. `ultimo_dia_ok`
//     fala do DADO, e é um fato que sobrevive a uma rodada cortada no meio.
//
// ⚠️ ORÇAMENTO DE TEMPO: edge function não roda para sempre, e a janela NÃO cabe nele — medido
//    em 10/08: nem um único dia cabe, quando o PNCP está limitando (3 × 429, pausa em 2,4 s).
//    Por isso a varredura vai do dia MAIS NOVO pro mais velho e grava dia a dia: o que o
//    orçamento corta é sempre o dia velho, nunca a publicação de hoje. Melhor rodar curto e
//    voltar — 3 vezes ao dia, com sobreposição de 2 dias.
//
// DEPLOY e SEGREDO: ver o README.md ao lado.
// ============================================================

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SR  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;   // injetada pela plataforma, não pelo CI
const TOKEN  = Deno.env.get("COLETA_TOKEN");                 // segredo dedicado do agendador

/* TAM_PAGINA — MEDIDO DUAS VEZES, e as duas medições estão certas:
     04/08, consulta de JANELA (7 dias de uma vez): com 50 a API não respondia (fetch pendurada
            >45 s) e com 10 respondia em ~450 ms. Daí o 10.
     10/08, consulta de UM DIA (a varredura mudou hoje): 10 → 437 ms · 20 → 764 ms · 50 → 778 ms,
            todas HTTP 200. O que não cabia era o VOLUME da janela larga, não o número da página.
   E o 10 tinha virado o gargalo: com 42 requisições por rodada (100 s de orçamento ÷ 2,4 s de
   pausa depois dos 429), 10 por página não fecha um dia de 7 UFs × 3 modalidades. Com 50, a
   maioria das combinações vira UMA requisição — e o dia fecha, que é o que destrava o carimbo.
   >>> A tela (fpmed_licitacoes.html) segue com 10 DE PROPÓSITO: lá a busca é por PERÍODO
       escolhido pelo operador, que pode ser largo — é o caso da medição de 04/08. */
const TAM_PAGINA = 50;
// TETO_PAGINAS por (uf, modalidade, DIA). Era 12 quando a consulta pedia a janela de 7 dias de
// uma vez; agora pede um dia por vez, e 12 páginas × 10 = 120 licitações num único dia de GO no
// pregão eletrônico ESTOURA — medido em 10/08, `truncou: 1`. E truncar não é só perder linha: um
// dia truncado NÃO pode ser carimbado como completo, então o teto baixo travava o carimbo de
// frescor no mesmo lugar em que o bug anterior o travava. 30 páginas = 300 por uf/mod/dia.
// Continua menor que o do script local (40): aqui o orçamento é de segundos.
const TETO_PAGINAS = 30;
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
  let ultimoDiaOk: string | null = null;      // yyyy-mm-dd, o dia mais novo já coberto INTEIRO
  let diaEmCurso: string | null = null;       // de que dia é o progresso guardado
  let ufsFeitas: string[] = [];               // UFs já varridas nesse dia, por rodadas anteriores
  try {
    const r = await fetch(`${SB_URL}/rest/v1/coleta_status?fonte=eq.PNCP&select=*`, { headers: H });
    const j = await r.json();
    if (Array.isArray(j) && j[0]?.ultima_ok) ultimaOk = new Date(j[0].ultima_ok);
    if (Array.isArray(j) && j[0]?.ultimo_dia_ok) ultimoDiaOk = String(j[0].ultimo_dia_ok).slice(0, 10);
    if (Array.isArray(j) && j[0]?.dia_em_curso) diaEmCurso = String(j[0].dia_em_curso).slice(0, 10);
    if (Array.isArray(j) && Array.isArray(j[0]?.ufs_feitas)) ufsFeitas = j[0].ufs_feitas.slice();
  } catch { /* sem estado = primeira coleta */ }

  const { ini, fim } = janela(ultimaOk, new Date(), DIAS);
  const breaker = criaBreaker();
  const ritmo = criaRitmo();
  let erro: string | null = null, truncou = 0, estourouTempo = false;
  let coletadas = 0, gravadas = 0;
  let ultimoDiaCompleto: string | null = null;   // yyyy-mm-dd do dia MAIS NOVO coberto inteiro

  /* ══ DIA A DIA, DO MAIS NOVO PRO MAIS VELHO ═══════════════════════════════════════════════
     ATÉ 10/08 ESTA VARREDURA PEDIA A JANELA INTEIRA de uma vez (dataInicial=ini&dataFinal=fim)
     e caminhava as páginas até o orçamento acabar. MEDIDO em 10/08, com o índice sendo enchido
     pela primeira vez: com a janela de 7 dias, os 100 s foram gastos em 04–06/08 e o dia de HOJE
     ficou com 25 linhas; forçando `--dias 1`, entraram 272. O coletor perdia sistematicamente a
     publicação MAIS NOVA — que é a única razão de ele existir.
     A mesma marca aparecia por UF: das 7 configuradas, só GO, DF e MG entravam; MT/MS/TO/BA
     nunca eram alcançadas.
     >>> AGORA O ORÇAMENTO É GASTO DE TRÁS PRA FRENTE. Se ele acabar, o que fica de fora é o dia
         VELHO — que ou já foi coletado numa rodada anterior, ou pode ser buscado à mão. Perder o
         dia velho é atraso; perder o dia de hoje é a tela não ter o edital que abre amanhã.
     >>> E CADA DIA É GRAVADO AO FECHAR, não tudo no fim: rodada cortada no meio deixa no banco
         os dias que já terminou, em vez de nada. */
  const diasDaJanela: Date[] = [];
  for (const d = new Date(fim); d >= ini; d.setDate(d.getDate() - 1)) diasDaJanela.push(new Date(d));

  /* ══ RODÍZIO DE UF: A RODADA LEMBRA ONDE PAROU ════════════════════════════════════════════
     MEDIDO em 10/08, sondando o PNCP direto, uma requisição a cada 700 ms: as 7 primeiras
     responderam 200 e da 8ª em diante vieram 14 × HTTP 429 seguidos. A cota dele é DURA e não se
     resolve indo mais devagar dentro da rodada — um dia inteiro são 21 combinações (7 UFs × 3
     modalidades) e não existe rodada de 100 s que faça 21 chamadas contra essa cota.
     >>> POR ISSO SEM MEMÓRIA O RODÍZIO NÃO ACONTECE: toda rodada recomeçava em GO e morria antes
         de MT/MS/TO/BA. Medido no banco em 10/08: 689 licitações, TODAS de GO, DF e MG. As
         outras quatro UFs nunca tinham sido coletadas uma única vez.
     >>> AGORA CADA RODADA CONTINUA DE ONDE A ANTERIOR PAROU, e quando a volta se completa o dia
         é carimbado e o progresso ZERA — para a próxima rodada varrer o dia de novo e pegar o
         que foi publicado no meio da tarde. "Completo até 10/08" é um passe inteiro que já
         aconteceu, não a promessa de que nada mais vai ser publicado hoje. */
  const diaMaisNovo = yyyymmdd(fim).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  if (diaEmCurso !== diaMaisNovo) { diaEmCurso = diaMaisNovo; ufsFeitas = []; }
  let voltaFechou = false;

  /* ══ PESO DAS PRAÇAS: GO EM TODA RODADA (decisão do Lemuel, 10/08) ════════════════════════
     O rodízio puro tratava as 7 UFs como iguais, e elas não são: GO é onde a FPMED disputa. Com
     o rodízio sozinho, Goiás era revisto uma vez por volta — e a volta leva ~2 rodadas, ou seja
     ~1,5× por dia. Agora GO entra SEMPRE, na frente, e as outras 6 seguem no rodízio com
     memória. Frescor de GO passa de ~1,5× para 3× por dia (o cron), sem custar cobertura das
     outras: GO são ~6 requisições de um dia, e a rodada faz de 20 a 40.
     >>> A LISTA É DE CASA, NÃO DA API: quem muda a praça principal muda AQUI e nos dois
         coletores, e a suíte trava que os dois dizem a mesma coisa. Se um dia a FPMED abrir
         filial, a UF nova entra nesta lista — não em `UFS`, que é só o universo de busca.
     >>> E `ufsSempre` continua entrando em `ufsFeitas`: a volta só fecha quando TODAS as 7
         passaram, e Goiás passar toda rodada não pode fazer a volta parecer fechada sem as
         outras — é a mesma conta de antes, com GO chegando na frente. */
  const UFS_SEMPRE = UFS.filter((u) => u === "GO");

  for (const dia of diasDaJanela) {
    const iso = yyyymmdd(dia).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    const doDiaNovo = iso === diaMaisNovo;
    // no dia mais novo: a praça principal primeiro, SEMPRE, e depois o que o rodízio ainda deve.
    // Nos dias velhos, varre tudo que der — ninguém guarda progresso deles.
    const ufsDaVez = doDiaNovo
      ? UFS_SEMPRE.concat(UFS.filter((u) => !UFS_SEMPRE.includes(u) && !ufsFeitas.includes(u)))
      : UFS;
    const achados = new Map<string, any>();
    let diaInteiro = true;                    // vi TODAS as UFs, todas as modalidades, sem teto?
    for (const uf of ufsDaVez) {
      let ufInteira = true;
      for (const mod of MODS) {
        if (breaker.aberto || estourouTempo || erro) { diaInteiro = false; ufInteira = false; break; }
        let pag = 1, totalPag = 1;
        do {
          if (Date.now() - t0 > TETO_MS) { estourouTempo = true; diaInteiro = false; break; }
          const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao`
            + `?dataInicial=${yyyymmdd(dia)}&dataFinal=${yyyymmdd(dia)}`
            + `&codigoModalidadeContratacao=${mod}&uf=${uf}&pagina=${pag}&tamanhoPagina=${TAM_PAGINA}`;
          const r = await puxa(url, breaker, ritmo);
          if (r.erro) { erro = r.erro; diaInteiro = false; break; }
          totalPag = Math.min(r.paginas || 1, TETO_PAGINAS);
          // teto de páginas batido = eu NÃO vi o dia inteiro. Carimbar como completo aqui seria
          // dizer "este dia está fechado" sobre um dia do qual falta pedaço.
          if ((r.paginas || 1) > TETO_PAGINAS && pag === 1) { truncou++; diaInteiro = false; }
          for (const x of r.dados) {
            const n = normaliza(x);
            if (!valida(n)) continue;
            achados.set(`${n.cnpj}|${n.ano}|${n.sequencial}`, n);
          }
          pag++;
          await dormir(ritmo.pausa);   // o que EVITA o 429; retentar melhor só o remedia
        } while (pag <= totalPag && !breaker.aberto);
        if (breaker.aberto) { diaInteiro = false; ufInteira = false; break; }
        if (estourouTempo) { ufInteira = false; break; }
      }
      // a UF só entra no progresso quando as 3 modalidades dela foram lidas: meia UF marcada
      // como feita seria um buraco que nenhuma rodada futura voltaria pra tapar
      if (doDiaNovo && ufInteira && !ufsFeitas.includes(uf)) ufsFeitas.push(uf);
      if (breaker.aberto || estourouTempo || erro) break;
    }

    // >>> NUNCA APAGA: sem resultado, o banco fica como está e a tela continua servindo.
    const regs = [...achados.values()];
    coletadas += regs.length;
    for (let i = 0; i < regs.length; i += 200) {
      const lote = regs.slice(i, i + 200);
      const r = await fetch(`${SB_URL}/rest/v1/licitacoes?on_conflict=portal,cnpj,ano,sequencial`, {
        method: "POST",
        headers: { ...H, Prefer: "return=minimal,resolution=merge-duplicates" },
        body: JSON.stringify(lote),
      });
      if (!r.ok) { erro = "gravacao HTTP " + r.status + " " + (await r.text()).slice(0, 160); diaInteiro = false; break; }
      gravadas += lote.length;
    }
    // O DIA MAIS NOVO fecha quando a VOLTA fecha (todas as UFs, somando rodadas), e não quando
    // uma rodada sozinha dá conta — com a cota do PNCP, nenhuma dá. Os dias velhos continuam
    // valendo pelo que a rodada viu, porque ninguém guarda progresso deles.
    const fechouAgora = doDiaNovo
      ? (UFS.every((u) => ufsFeitas.includes(u)) && !truncou && !erro)
      : diaInteiro;
    if (doDiaNovo && fechouAgora) voltaFechou = true;
    if (fechouAgora && !ultimoDiaCompleto) ultimoDiaCompleto = iso;
    if (breaker.aberto || estourouTempo || erro) break;
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
  /* ══ ATÉ QUE DIA O ÍNDICE ESTÁ EM DIA ═════════════════════════════════════════════════════
     `ultima_ok` responde "a última rodada terminou inteira?" — e a resposta, com este volume de
     publicação, é NÃO todas as vezes: as três rodadas de 10/08 gravaram 190, 213 e 272 linhas e
     nenhuma fechou a janela. A tela então dizia "a última coleta falhou" com o índice crescendo
     de 70 pra 651. Erro pro lado seguro, mas erro.
     `ultimo_dia_ok` responde a pergunta que a tela realmente faz: ATÉ QUE DIA eu posso confiar
     que o índice tem tudo. É um fato sobre o DADO, não sobre a execução.
     >>> SÓ ANDA PRA FRENTE. Rodada que só alcançou dias velhos não pode puxar o carimbo pra trás:
         o dia novo continua coberto, e regredir faria a tela desconfiar do que está certo. */
  if (ultimoDiaCompleto && (!ultimoDiaOk || ultimoDiaCompleto > ultimoDiaOk)) st.ultimo_dia_ok = ultimoDiaCompleto;
  // O PROGRESSO DA VOLTA. Fechou a volta -> ZERA, pra próxima rodada varrer o dia de novo e
  // pegar o que foi publicado depois. O carimbo do dia já guarda que a volta aconteceu.
  st.dia_em_curso = diaEmCurso;
  st.ufs_feitas = voltaFechou ? [] : ufsFeitas;
  await fetch(`${SB_URL}/rest/v1/coleta_status?on_conflict=fonte`, {
    method: "POST", headers: { ...H, Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify([st]),
  }).catch(() => {});

  // 200 mesmo em rodada parcial: o agendador não deve tratar "o PNCP estava fora" como falha
  // do nosso lado e ficar reexecutando. O campo `ok` diz a verdade pra quem lê o relatório.
  return J({
    ok: okDeVerdade,
    coletadas,
    gravadas,
    janela: `${yyyymmdd(ini)}→${yyyymmdd(fim)}`,
    ultimoDiaCompleto,                       // até que dia esta rodada fechou o índice
    diasDaJanela: diasDaJanela.length,
    diaEmCurso,                              // de que dia é o progresso guardado
    ufsFeitas,                               // quais UFs desse dia já foram varridas
    faltamUFs: UFS.filter((u) => !ufsFeitas.includes(u)),
    ufsSempre: UFS_SEMPRE,                   // a praça principal, revista em toda rodada
    voltaFechou,
    truncou,
    breakerAberto: breaker.aberto,
    rateLimits: ritmo.vezes,
    pausaFinalMs: ritmo.pausa,
    estourouTempo,
    erro,
    segundos: Math.round((Date.now() - t0) / 1000),
  });
});
