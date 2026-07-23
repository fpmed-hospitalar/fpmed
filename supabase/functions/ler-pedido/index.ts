// ============================================================
// Supabase Edge Function: ler-pedido  (FPMED)
// Proxy PUBLICO para a API de Mensagens da Anthropic (Claude).
// Usado por fpmed_giovana.html e fpmed_sistema_final.html (Importar Cotacao/Espelho)
// para ler pedido/espelho por IA (foto/PDF -> JSON estruturado).
//
// Contrato (o app chama SEM Authorization):
//   POST /functions/v1/ler-pedido
//   body: { model, max_tokens, messages }   (mesmo shape da Messages API)
//   resposta: o JSON cru da Anthropic (o app le data.content[].text)
//
// TRAVA DE ORIGEM (anti-abuso de credito): so aceita chamadas cujo header
// Origin seja um dos ALLOWED_ORIGINS abaixo. Navegadores nao deixam uma
// pagina forjar o Origin, entao isso barra qualquer site de terceiros de
// queimar o credito Anthropic. (Cliente fora de navegador ainda consegue
// forjar o header — e uma trava de abuso casual, nao autenticacao.)
//
// DEPLOY: precisa ser PUBLICO -> verify_jwt=false (ver supabase/config.toml).
// SEGREDO NECESSARIO: ANTHROPIC_API_KEY (chave da FPMED, NAO a do GlobalMed).
//   Dashboard: Edge Functions > Manage secrets > add ANTHROPIC_API_KEY
//   CLI:       supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ============================================================

const ALLOWED_ORIGINS = [
  "https://fpmed-hospitalar.github.io", // GitHub Pages da FPMED (producao)
  "https://sistema.fpmed.com.br",       // dominio proprio futuro (pos-venda)
];

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const permitida = ALLOWED_ORIGINS.includes(origin);
  const CORS = corsHeaders(permitida ? origin : ALLOWED_ORIGINS[0]);

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Trava de origem: sem Origin permitido, nao gasta credito.
  if (!permitida) {
    return new Response(JSON.stringify({ error: "origem nao autorizada" }), {
      status: 403, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "use POST" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY nao configurada no projeto FPMED" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "JSON invalido" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const payload = {
    model: body.model || "claude-haiku-4-5",  // custo: Haiku 4.5 ($1/$5 MTok) — conferido na doc oficial 22/07/2026
    max_tokens: body.max_tokens || 8000,
    messages: body.messages || [],
  };

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await r.text(); // repassa o corpo cru (sucesso ou erro) tal como veio
  return new Response(data, {
    status: r.status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
