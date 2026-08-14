/* ══════════════════════════════════════════════════════════════════════════════════════════
   buscar-edital — "BUSCAR EDITAL AGORA", sob demanda, para UMA licitação.
   Fatia A14 item 3 · 14/08/2026 · decisão do dono.

   O QUE ELA FAZ: recebe um negócio (ou um número de controle), pergunta ao PNCP quais arquivos
   aquela licitação publicou, baixa o que for EDITAL ou TERMO DE REFERÊNCIA, extrai o texto e
   grava em `licitacao_arquivos`. É esse texto que o "conversar com o edital" lê depois.

   ══ POR QUE NO SERVIDOR, E NÃO NO NAVEGADOR ════════════════════════════════════════════════
   A tela já sabe extrair PDF (pdf.js está lá desde o Leitor). O que ela NÃO tem é como escrever
   em `licitacao_arquivos`: aquela tabela é de leitura pra quem está logado, e quem escreve é a
   service_role. Fazer a tela gravar exigiria abrir a escrita pro navegador — ou seja, trocar uma
   trava de banco por uma promessa de front-end. E o resultado ficaria só na aba de quem clicou:
   o colega ao lado abriria a mesma licitação e veria "edital não coletado".

   ══ AS TRÊS TRAVAS, E POR QUE CADA UMA ═════════════════════════════════════════════════════
   1. AUTENTICAÇÃO OBRIGATÓRIA. Sem `Bearer` válido, 401. Esta função faz um serviço público
      (PNCP) trabalhar a pedido nosso; porta aberta é o nosso endereço servindo de alavanca.
   2. FREIO POR USUÁRIO (rate-limit), contado da `usos_coleta_edital` — a MESMA tabela do
      registro, e não uma segunda. Duas contagens da mesma coisa um dia discordam, justo no dia
      em que alguém for auditar um abuso.
   3. REGISTRO DE USO SEMPRE, inclusive quando falha. Registrar só o sucesso faria a tentativa
      que derruba o PNCP ser a única invisível — e o freio contaria zero pra quem bate mais.

   >>> ELA NÃO GASTA IA, e por isso NÃO escreve em `usos_ia`. O custo aqui é banda e CPU. Enfiar
       linhas de custo zero no livro-caixa da IA faria o número que vira fatura contar o que não
       é fatura.

   ══ O QUE ELA NUNCA FAZ ════════════════════════════════════════════════════════════════════
   · não varre o Brasil: é UMA licitação por chamada, sempre nomeada por quem chamou;
   · não guarda o PDF inteiro — só o TEXTO e o LINK ORIGINAL (regra da fatia A6);
   · não apaga nada: o upsert é por (numero_controle, url_pncp) e reescreve a linha dela mesma.
   ══════════════════════════════════════════════════════════════════════════════════════════ */

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H_SR = { apikey: SB_SR, Authorization: "Bearer " + SB_SR, "Content-Type": "application/json" };

const ALLOWED_ORIGINS = [
  "https://fpmed-hospitalar.github.io",
  "https://sistema.fpmed.com.br",
];
function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

/* O FREIO. 20 coletas por hora por pessoa: bem acima do uso humano normal (quem trabalha um
   negócio de cada vez não chega perto) e bem abaixo do que um laço acidental faria. O número
   está aqui, declarado, e não espalhado numa condição. */
const TETO_HORA = 20;

/* Teto por chamada. Um edital com 12 anexos são 12 downloads de 2 a 12 MB — e a resposta a
   "buscar edital agora" não melhora com a minuta de contrato junto. */
const TETO_ARQUIVOS = 3;
const TETO_BYTES = 25 * 1024 * 1024;

/* O que conta como edital: o `tipoDocumentoNome` é dado do PNCP, não palpite nosso. Minuta de
   contrato e minuta de ata são o DEPOIS da disputa. Mesma regra do tools/coleta_editais.js. */
const EH_EDITAL = (t: string) => /edital|termo de referência|termo de referencia/i.test(String(t || ""));

/* ══ NÚMERO DE CONTROLE -> CNPJ / ANO / SEQUENCIAL ═════════════════════════════════════════
   O formato do PNCP é `<cnpj>-1-<sequencial>/<ano>`, por exemplo
   `03659166002156-1-000034/2026`. Derivar daqui (em vez de só ler do nosso índice) é o que
   permite coletar o edital de uma licitação que veio AO VIVO do PNCP e não tem linha no índice
   — e essa é metade do que a tela Encontrar mostra. */
function partes(controle: string) {
  const m = String(controle || "").match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);
  if (!m) return null;
  return { cnpj: m[1], sequencial: String(Number(m[2])), ano: m[3] };
}

async function registra(linha: Record<string, unknown>) {
  try {
    await fetch(`${SB_URL}/rest/v1/usos_coleta_edital`, {
      method: "POST", headers: { ...H_SR, Prefer: "return=minimal" },
      body: JSON.stringify(linha),
    });
  } catch { /* o registro falhar não pode derrubar a coleta que já foi feita */ }
}

/* A EXTRAÇÃO. `unpdf` é o pdf.js empacotado pra runtime serverless (sem canvas, sem DOM).
   >>> PDF ESCANEADO NÃO TEM TEXTO, e isso NÃO é falha: é um documento que é uma FOTO. Devolver
       string vazia como se o edital fosse vazio seria a mentira mais cara desta função. Quando
       sai quase nada, a linha vai com `extracao_erro` dizendo o porquê — que é o estado honesto
       que o DDL da A6 já previa. */
async function extrai(buf: ArrayBuffer): Promise<{ texto: string; paginas: number }> {
  const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(doc, { mergePages: true });
  return { texto: String(text || ""), paginas: Number(totalPages) || 0 };
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  const origin = req.headers.get("origin") || "";
  const CORS = cors(ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  const J = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return J({ error: "use POST" }, 405);

  // ── 1. QUEM É VOCÊ (o JWT decide, nunca o corpo do pedido) ──────────────────────────────
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(auth)) return J({ error: "faca login pra buscar o edital" }, 401);
  let user: any = null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_SR, Authorization: auth } });
    if (r.ok) user = await r.json();
  } catch { /* trata como não autenticado */ }
  if (!user || !user.id) return J({ error: "sessao invalida — entre de novo" }, 401);
  const email = String(user.email || "").toLowerCase();

  let body: any = {};
  try { body = await req.json(); } catch { return J({ error: "corpo invalido" }, 400); }

  // ── 2. O FREIO ──────────────────────────────────────────────────────────────────────────
  const desde = new Date(Date.now() - 3600_000).toISOString();
  let usadas = 0;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usos_coleta_edital?select=id`
      + `&usuario_id=eq.${user.id}&criado_em=gte.${desde}`,
      { headers: { ...H_SR, Prefer: "count=exact", Range: "0-0" } });
    usadas = Number(String(r.headers.get("content-range") || "").split("/")[1]) || 0;
  } catch { /* sem conseguir contar, deixa passar: o freio não pode virar uma negação cega */ }
  if (usadas >= TETO_HORA) {
    return J({
      error: `voce ja buscou ${usadas} editais nesta hora (teto ${TETO_HORA})`,
      detalhe: "o teto existe pra nao abusar do PNCP, que e servico publico. Tente daqui a pouco.",
      teto: TETO_HORA, usadas,
    }, 429);
  }

  // ── 3. QUAL LICITAÇÃO ───────────────────────────────────────────────────────────────────
  let controle = String(body.numero_controle || "").trim();
  const negocioId = Number(body.negocio_id) || null;
  if (!controle && negocioId) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/negocios?select=numero_controle,licitacao_id&id=eq.${negocioId}`,
        { headers: H_SR });
      const j = await r.json();
      if (Array.isArray(j) && j[0]) {
        controle = String(j[0].numero_controle || "");
        if (!controle && j[0].licitacao_id) {
          const r2 = await fetch(`${SB_URL}/rest/v1/licitacoes?select=numero_controle&id=eq.${j[0].licitacao_id}`,
            { headers: H_SR });
          const j2 = await r2.json();
          if (Array.isArray(j2) && j2[0]) controle = String(j2[0].numero_controle || "");
        }
      }
    } catch { /* cai no erro de "não sei qual licitação" logo abaixo */ }
  }
  const p = partes(controle);
  if (!p) {
    /* ESTA MENSAGEM É A DO CASO REAL, e não um "parâmetro inválido". Um negócio do Calendário
       2025 não tem número de controle do PNCP — ele veio de uma planilha. Dizer isso é o que
       leva a pessoa a anexar o edital à mão em vez de clicar de novo. */
    await registra({ usuario_id: user.id, email, numero_controle: controle || null, negocio_id: negocioId,
                     ok: false, erro: "sem numero de controle do PNCP", ms: Date.now() - t0 });
    return J({
      error: "este negocio nao tem numero de controle do PNCP",
      detalhe: "so da pra buscar no PNCP o que foi publicado la. Anexe o edital manualmente.",
      semControle: true,
    }, 422);
  }

  // ── 4. O QUE O PNCP TEM ─────────────────────────────────────────────────────────────────
  const base = `https://pncp.gov.br/api/pncp/v1/orgaos/${p.cnpj}/compras/${p.ano}/${p.sequencial}`;
  let arqs: any[] = [];
  try {
    const r = await fetch(`${base}/arquivos?pagina=1&tamanhoPagina=30`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(45000) });
    /* 404 AQUI É "O ÓRGÃO NÃO ANEXOU NADA" — achado medido na fatia A6, quando eu esperava lista
       vazia. É o caso mais comum do fallback honesto, e ele não é erro. */
    if (r.status === 404) {
      await registra({ usuario_id: user.id, email, numero_controle: controle, negocio_id: negocioId,
                       arquivos: 0, extraidos: 0, chars: 0, ok: true, ms: Date.now() - t0 });
      return J({ numero_controle: controle, arquivos: 0, extraidos: 0,
                 aviso: "edital nao publicado no PNCP — anexe manualmente", semArquivo: true });
    }
    if (!r.ok) throw new Error("o PNCP respondeu " + r.status);
    arqs = await r.json();
  } catch (e) {
    await registra({ usuario_id: user.id, email, numero_controle: controle, negocio_id: negocioId,
                     ok: false, erro: String((e as Error).message || e), ms: Date.now() - t0 });
    return J({ error: "nao consegui falar com o PNCP agora", detalhe: String((e as Error).message || e) }, 502);
  }

  const editais = (Array.isArray(arqs) ? arqs : [])
    .filter((a) => EH_EDITAL(a.tipoDocumentoNome))
    .slice(0, TETO_ARQUIVOS);

  // ── 5. BAIXAR, EXTRAIR, GRAVAR ──────────────────────────────────────────────────────────
  const linhas: any[] = [];
  let extraidos = 0, chars = 0;
  for (const a of editais) {
    const url = String(a.url || a.uri || "");
    if (!url) continue;
    const linha: any = {
      numero_controle: controle,
      sequencial: Number(a.sequencialDocumento) || null,
      titulo: String(a.titulo || a.tipoDocumentoNome || ""),
      tipo: String(a.tipoDocumentoNome || ""),
      url_pncp: url,
      bytes: null, texto_extraido: null, texto_chars: null, texto_paginas: null,
      extraido_em: null, extracao_erro: null,
    };
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error("download HTTP " + r.status);
      const buf = await r.arrayBuffer();
      linha.bytes = buf.byteLength;
      if (buf.byteLength > TETO_BYTES) throw new Error(`arquivo de ${Math.round(buf.byteLength / 1048576)} MB — acima do teto de 25 MB`);
      const { texto, paginas } = await extrai(buf);
      const limpo = texto.replace(/ /g, "").trim();
      linha.texto_paginas = paginas;
      /* MENOS DE 200 CARACTERES NUM EDITAL É PDF ESCANEADO, e não edital curto. Gravar isso como
         texto faria a IA responder sobre um documento que ela não leu. */
      if (limpo.length < 200) {
        linha.extracao_erro = `saiu quase nada (${limpo.length} chars em ${paginas} pagina(s)) — provavelmente PDF escaneado; precisa de leitura por imagem`;
      } else {
        linha.texto_extraido = limpo;
        linha.texto_chars = limpo.length;
        linha.extraido_em = new Date().toISOString();
        extraidos++; chars += limpo.length;
      }
    } catch (e) {
      linha.extracao_erro = String((e as Error).message || e).slice(0, 300);
    }
    linhas.push(linha);
  }

  if (linhas.length) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/licitacao_arquivos?on_conflict=numero_controle,url_pncp`, {
        method: "POST", headers: { ...H_SR, Prefer: "return=minimal,resolution=merge-duplicates" },
        body: JSON.stringify(linhas),
      });
      if (!r.ok) throw new Error("gravacao HTTP " + r.status + " " + (await r.text()).slice(0, 160));
    } catch (e) {
      await registra({ usuario_id: user.id, email, numero_controle: controle, negocio_id: negocioId,
                       arquivos: linhas.length, extraidos, chars, ok: false,
                       erro: String((e as Error).message || e), ms: Date.now() - t0 });
      return J({ error: "extrai o edital mas nao consegui gravar", detalhe: String((e as Error).message || e) }, 500);
    }
  }

  await registra({ usuario_id: user.id, email, numero_controle: controle, negocio_id: negocioId,
                   arquivos: linhas.length, extraidos, chars, ok: true, ms: Date.now() - t0 });

  return J({
    numero_controle: controle,
    arquivos: linhas.length,
    extraidos,
    chars,
    /* A TELA PRECISA DISTINGUIR TRÊS FINAIS, e por isso eles vêm separados e não como um "ok":
       achei e extraí · achei e não deu pra extrair (escaneado) · o órgão não publicou nada. */
    semArquivo: linhas.length === 0,
    detalhes: linhas.map((l) => ({ titulo: l.titulo, tipo: l.tipo, chars: l.texto_chars,
                                   paginas: l.texto_paginas, erro: l.extracao_erro })),
    ms: Date.now() - t0,
  });
});
