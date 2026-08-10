// ============================================================
// Supabase Edge Function: ler-edital   (FPMED — modulo 2.8 da spec) · 10/08/2026
//
// O LEITOR DE EDITAL COM IA, LIBERADO EM PILOTO. Duas coisas moram aqui de proposito, e as duas
// pelo mesmo motivo: **fora daqui elas nao valem nada**.
//
// 1. A PERMISSAO. O Lemuel liberou o leitor SO pro gestor de licitacao, "por permissao, nao por
//    esconder botao". Esconder o botao na tela para quem olha a tela; nao para quem abre o
//    console e chama o endpoint. Aqui o JWT do Supabase e VERIFICADO no servidor e o e-mail e
//    conferido contra a lista abaixo. Sem token valido e sem estar na lista, nao ha leitura —
//    e nao ha gasto.
//
// 2. O CONTADOR. A leitura vai ser COBRADA. Um contador que a propria tela escreve e um contador
//    que o pagante pode escrever. Aqui quem grava e esta funcao, com a service_role, DEPOIS de a
//    chamada ter acontecido e com os numeros que a Anthropic devolveu — nao com os que o
//    navegador disse que gastou.
//
// ══ O MODO HIBRIDO ═══════════════════════════════════════════════════════════════════════════
// Quem decide o modo e a TELA, que e onde o pdf.js roda: ela extrai o texto e, se vier pobre
// (menos de 500 caracteres = edital escaneado, so imagem), manda o PDF inteiro e diz por que.
// A funcao registra o modo E O MOTIVO, e devolve os dois pra tela mostrar.
// >>> MEDIDO EM 10/08, nos mesmos 2 editais: o texto custa ~55% menos e ocupa ~1/2,5 do
//     contexto. Mas texto so serve quando existe texto — dai o hibrido, e nao "sempre texto".
//
// CONTRATO:
//   POST /functions/v1/ler-edital
//   header: Authorization: Bearer <JWT do Supabase, do usuario logado>
//   body: { modo:'texto'|'pdf-nativo', texto?|pdfBase64?, motivo?, titulo?, url?, mb?,
//           paginas?, chars?, cambio? }
//   resposta: { ok, dados, modo, modoMotivo, usage, usd, brl, leituraId }
// ============================================================

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");

const MODELO = "claude-haiku-4-5";
const USD_ENTRADA_MTOK = 1.00;   // tabela publica da Anthropic
const USD_SAIDA_MTOK = 5.00;
const MAX_TOKENS_SAIDA = 2000;   // a saida custa 5x a entrada; o resumo tem que caber na tela

// ── QUEM PODE LER (piloto, decisao do Lemuel em 10/08) ──────────────────────────────────────
// Lista EXPLICITA de e-mail. Nao e cargo: os tres usuarios da FPMED sao gestor_geral, entao
// gate por cargo liberaria pra todos. Acrescentar alguem e uma linha aqui — e fica no git quem
// foi acrescentado e quando, que e o registro que uma decisao de custo merece.
const LEITORES = ["licitacao@fpmed.com.br"];

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

const H_SR = { apikey: SB_SR, Authorization: "Bearer " + SB_SR, "Content-Type": "application/json" };

const PERGUNTA = `Voce esta lendo o EDITAL de uma licitacao publica brasileira para uma
distribuidora de medicamentos e material hospitalar. Responda SOMENTE com JSON, sem texto antes
ou depois, neste formato:
{"objeto":"","orgao":"","modalidade":"","abertura":"","entrega_prazo":"","entrega_local":"",
"pagamento":"","amostra":true,"registro_precos":true,"habilitacao":[],"penalidades":"",
"pontos_de_atencao":[],"nao_encontrado":[]}
Se algo nao estiver no documento, NAO invente: ponha o nome do campo em "nao_encontrado".`;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const CORS = cors(ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  const J = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return J({ error: "use POST" }, 405);
  if (!ANTHROPIC) return J({ error: "ANTHROPIC_API_KEY nao configurada" }, 503);

  // ── 1. QUEM E VOCE (o JWT decide, nao o corpo do pedido) ─────────────────────────────────
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(auth)) return J({ error: "faca login pra usar o leitor" }, 401);
  let user: any = null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_SR, Authorization: auth } });
    if (r.ok) user = await r.json();
  } catch { /* trata como nao autenticado */ }
  if (!user || !user.id || !user.email) return J({ error: "sessao invalida — entre de novo" }, 401);

  // ── 2. VOCE PODE? (a trava real; a tela tambem esconde, mas a tela nao e a trava) ─────────
  const email = String(user.email).toLowerCase();
  if (!LEITORES.includes(email)) {
    return J({
      error: "o leitor de edital esta em piloto e liberado so para o gestor de licitacao",
      detalhe: "cada leitura tem custo e e cobrada; a liberacao e decisao do Lemuel",
    }, 403);
  }

  let body: any = {};
  try { body = await req.json(); } catch { return J({ error: "corpo invalido" }, 400); }

  const modo = body.modo === "pdf-nativo" ? "pdf-nativo" : "texto";
  let bloco: any;
  if (modo === "texto") {
    const t = String(body.texto || "");
    // A tela ja confere isto antes de mandar; aqui e a segunda barreira. Pagar por um resumo de
    // nada e o pior desfecho possivel de uma leitura que vai ser cobrada de alguem.
    if (t.length < 500) return J({ error: "o texto extraido veio pobre demais para valer uma leitura" }, 400);
    bloco = { type: "text", text: "EDITAL (texto extraido do PDF):\n\n" + t };
  } else {
    const b64 = String(body.pdfBase64 || "");
    if (b64.length < 1000) return J({ error: "PDF vazio ou invalido" }, 400);
    bloco = { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } };
  }

  // ── 3. A LEITURA ─────────────────────────────────────────────────────────────────────────
  const t0 = Date.now();
  let dados: any = null, usage: any = {}, erro: string | null = null, bruto = "";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: MAX_TOKENS_SAIDA,
        messages: [{ role: "user", content: [bloco, { type: "text", text: PERGUNTA }] }],
      }),
    });
    const txt = await r.text();
    if (!r.ok) throw new Error("HTTP " + r.status + " " + txt.slice(0, 200));
    const j = JSON.parse(txt);
    if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 200));
    usage = j.usage || {};
    bruto = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    // >>> RESPOSTA CORTADA NAO VIRA RESUMO. Mesma regra que a Global pagou pra aprender: JSON
    //     truncado ainda parece JSON, e o resumo sai faltando campo sem sinal nenhum.
    if (j.stop_reason === "max_tokens") throw new Error("a leitura foi cortada no limite de tamanho");
    try {
      const i = bruto.indexOf("{"), f = bruto.lastIndexOf("}");
      dados = JSON.parse(bruto.slice(i, f + 1));
    } catch { throw new Error("a leitura voltou fora do formato esperado"); }
  } catch (e) { erro = String((e as Error)?.message || e); }

  const segundos = Math.round((Date.now() - t0) / 1000);
  const entrada = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  const saida = usage.output_tokens || 0;
  const usd = (entrada / 1e6) * USD_ENTRADA_MTOK + (saida / 1e6) * USD_SAIDA_MTOK;
  const cambio = Number(body.cambio) > 0 ? Number(body.cambio) : null;

  // ── 4. O REGISTRO — ATE QUANDO DA ERRADO ─────────────────────────────────────────────────
  // Leitura que falhou DEPOIS de consumir token tambem custou. Registrar so o que deu certo
  // faria a conta do mes ser menor que a fatura da Anthropic, e ninguem saberia explicar a
  // diferenca. Por isso `ok` e uma coluna, e nao um motivo pra nao gravar.
  let leituraId: number | null = null;
  if (entrada > 0 || erro) {
    try {
      const reg = await fetch(`${SB_URL}/rest/v1/usos_ia`, {
        method: "POST",
        headers: { ...H_SR, Prefer: "return=representation" },
        body: JSON.stringify([{
          usuario: user.id, email,
          edital_titulo: String(body.titulo || "").slice(0, 300) || null,
          edital_url: String(body.url || "").slice(0, 500) || null,
          edital_mb: Number(body.mb) || null,
          modo, modo_motivo: String(body.motivo || "") || null,
          paginas: Number(body.paginas) || null, chars: Number(body.chars) || null,
          modelo: MODELO, tokens_entrada: entrada, tokens_saida: saida, segundos,
          usd: +usd.toFixed(6), cambio, brl: cambio ? +(usd * cambio).toFixed(4) : null,
          ok: !erro, erro: erro ? erro.slice(0, 300) : null,
        }]),
      });
      if (reg.ok) { const j = await reg.json(); leituraId = (j && j[0] && j[0].id) || null; }
    } catch { /* o registro falhar nao pode engolir a leitura que a pessoa ja pagou */ }
  }

  if (erro) return J({ ok: false, erro, modo, leituraId, usd: +usd.toFixed(4) }, 200);
  return J({
    ok: true, dados, modo, modoMotivo: body.motivo || null, leituraId,
    usage: { entrada, saida }, segundos, modelo: MODELO,
    usd: +usd.toFixed(4), cambio, brl: cambio ? +(usd * cambio).toFixed(4) : null,
  });
});
