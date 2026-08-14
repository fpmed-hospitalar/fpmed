/* ══════════════════════════════════════════════════════════════════════════════════════════
   indexar-licitacao — "ESTE CERTAME DO AO VIVO PASSA A EXISTIR NO NOSSO ÍNDICE"
   Fatia A21 · 14/08/2026 · ordem da caixa: *"o painel ao vivo traz certame fora do índice: ao
   clicar em qualquer ação, gravar a licitação no índice primeiro (aditivo, com selo de origem),
   para o negócio nunca nascer sem vínculo (a lição do numero_controle)."*

   ══ O PROBLEMA, EM UMA FRASE ═══════════════════════════════════════════════════════════════
   O painel "ao vivo · PNCP" existe justamente para mostrar o que o nosso índice NÃO tem. Quando
   alguém age sobre uma dessas linhas — abre o detalhe, manda pro funil —, o negócio do outro
   lado fica com `numero_controle` e sem `licitacao_id`, para sempre: não há linha no índice pra
   apontar. É a fatia A9 de novo, um degrau antes. Lá foram 2.561 negócios sem chave nenhuma.

   ══ POR QUE UMA EDGE FUNCTION, E NÃO A TELA GRAVANDO DIRETO ════════════════════════════════
   A `licitacoes` NÃO TEM policy de INSERT para `authenticated`, e isso é decisão registrada na
   própria DDL: *"Nem `authenticated` escreve aqui: a tela não coleta"*. Abrir a tabela pra
   escrita do navegador pra economizar uma função seria trocar uma trava por uma pressa.

   ══ ELA NÃO ACREDITA NO NAVEGADOR — E ESSE É O PONTO MAIS IMPORTANTE DAQUI ═════════════════
   A primeira versão desta função ia gravar os campos que a tela mandasse no corpo do pedido.
   Isso poria texto vindo do cliente dentro do índice que o sistema inteiro trata como "o que o
   PNCP publicou" — e um índice que mistura fato publicado com o que alguém digitou deixa de
   servir de referência de preço, que é para o que ele existe.
   >>> MEDIDO EM 14/08: o `/api/search/` do PNCP RESOLVE PELO NÚMERO DE CONTROLE. Perguntar
       `q=05816630000152-1-005964/2026` devolve `total: 1` e o registro certo. Então a função
       pergunta ELA MESMA, e o corpo do pedido serve só para dizer QUAL número olhar.
   >>> O CORPO PODE MANDAR `dados`, e eles são IGNORADOS na gravação. Ficam guardados no `bruto`
       apenas se a consulta ao PNCP falhar? NÃO — nesse caso ela não grava nada. "Não consegui
       perguntar" nunca vira "gravei o que me disseram" (a regra da A19, aplicada à escrita).

   ══ E ELA SÓ INSERE. NUNCA ATUALIZA. ═══════════════════════════════════════════════════════
   Se o número já está no índice, ela responde `{ja:true}` e vai embora. A varredura normal é a
   dona destas linhas; uma segunda escrita por cima, com dado mais pobre (a busca não traz janela
   de proposta nem valor estimado), APAGARIA campos que já estavam certos. É o mesmo cuidado das
   colunas `resultado_*` da fatia A9: o que não está no corpo do upsert não pode virar null.

   ══ E A CHAVE NATURAL NÃO MUDA ═════════════════════════════════════════════════════════════
   `portal` continua 'PNCP' — a fonte é a mesma. Quem diz que esta linha entrou por outra porta é
   a coluna `origem_registro` (ddl/licitacoes_origem.sql), que fica FORA da chave natural de
   propósito: dentro dela, o coletor gravaria uma segunda linha do mesmo certame no dia em que
   passasse por ele.
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
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const TIMEOUT_MS = 20000;
/* O `/api/search/` RECUSA CLIENTE SEM User-Agent DE NAVEGADOR — a conexão é cortada
   (ECONNRESET). Isso foi medido na fatia A13 e vale para qualquer runtime que não seja o
   navegador, inclusive o Deno daqui. Não é burlar barreira: é a mesma página pública de consulta
   que qualquer pessoa abre, e o cabeçalho é o que a página manda. */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const PNCP_BUSCA = "https://pncp.gov.br/api/search/";

/* O sequencial vai com zeros à esquerda no número de controle e SEM eles na URL — `000782` vira
   `782`. É a mesma leitura da edge `valida-controle` (fatia A19), e tem que continuar sendo. */
export function partesControle(controle: string) {
  const m = String(controle || "").trim().match(/^(\d{14})-(\d+)-(\d+)\/(\d{4})$/);
  if (!m) return null;
  return { cnpj: m[1], ordem: m[2], sequencial: String(Number(m[3])), ano: m[4] };
}

/* ══ A TRADUÇÃO DA FORMA DE BUSCA PARA A LINHA DO ÍNDICE ═══════════════════════════════════
   >>> O QUE A BUSCA NÃO MANDA FICA NULO, NUNCA ZERO NEM FALSO: `data_abertura`,
       `data_encerramento` e `valor_estimado` não existem nessa resposta (medido campo a campo).
       Preenchê-los faria a linha AFIRMAR "sem prazo, R$ 0" sobre uma compra a que ninguém
       perguntou nada — e essa linha entra num índice que a tela usa pra decidir participação.
   >>> `bruto` GUARDA A RESPOSTA COMO ELA VEIO, com o carimbo `_coleta:'busca'` — exatamente o
       mesmo formato que o `tools/coleta_pncp_busca.js` grava. Duas formas de "linha vinda da
       busca" seria a tela precisando saber ler três dialetos em vez de dois. */
export function linhaDoAchado(x: any, controle: string) {
  const p = partesControle(controle);
  if (!p) return null;
  const seq = Number(String(x.numero_sequencial ?? p.sequencial).replace(/\D/g, ""));
  if (!seq) return null;
  return {
    portal: "PNCP",
    origem_registro: "busca_ao_vivo",
    cnpj: p.cnpj,
    ano: Number(x.ano ?? p.ano),
    sequencial: seq,
    numero_controle: controle,
    numero_compra: x.numero_sequencial != null ? String(x.numero_sequencial) : null,
    modalidade: x.modalidade_licitacao_nome ?? null,
    modalidade_cod: x.modalidade_licitacao_id != null ? Number(x.modalidade_licitacao_id) : null,
    situacao: x.situacao_nome ?? null,
    orgao: x.orgao_nome ?? null,
    unidade: x.unidade_nome ?? null,
    municipio: x.municipio_nome ?? null,
    uf: x.uf ?? null,
    objeto: x.description ?? x.title ?? null,
    data_publicacao: x.data_publicacao_pncp ? String(x.data_publicacao_pncp).slice(0, 10) : null,
    link_sistema: x.item_url ? "https://pncp.gov.br" + x.item_url : null,
    bruto: Object.assign({ _coleta: "busca", _origem: "indexar-licitacao" }, x),
  };
}

async function buscaNoPNCP(controle: string) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const u = PNCP_BUSCA + "?q=" + encodeURIComponent(controle)
      + "&tipos_documento=edital&pagina=1&tam_pagina=10&status=todos";
    const r = await fetch(u, { headers: { Accept: "application/json", "User-Agent": UA }, signal: ac.signal });
    clearTimeout(to);
    if (!r.ok) return { erro: "o PNCP respondeu " + r.status };
    const j = await r.json();
    const itens = Array.isArray(j.items) ? j.items : [];
    /* PROCURA O REGISTRO EXATO NA RESPOSTA, e não pega `items[0]`. A busca é por texto: um dia
       ela pode devolver um edital que só CITA aquele número. Gravar o primeiro seria indexar
       outra licitação com o número de controle desta — o pior erro possível aqui, porque ele
       tem a mesma cara de um acerto. */
    const achado = itens.find((x: any) => String(x.numero_controle_pncp || "").trim() === controle);
    if (!achado) return { naoAchou: true, devolvidos: itens.length };
    return { achado };
  } catch (e) {
    clearTimeout(to);
    return { erro: (e as Error).name === "AbortError" ? "o PNCP não respondeu em 20s" : String((e as Error).message) };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const CORS = cors(ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  const J = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return J({ error: "use POST" }, 405);

  // ── 1. QUEM É VOCÊ (o JWT decide, nunca o corpo do pedido) ────────────────────────────────
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(auth)) return J({ error: "faca login" }, 401);
  let user: any = null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_SR, Authorization: auth } });
    if (r.ok) user = await r.json();
  } catch { /* trata como nao autenticado */ }
  if (!user || !user.id) return J({ error: "sessao invalida — entre de novo" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return J({ error: "corpo invalido" }, 400); }
  const controle = String(body.numero_controle || "").trim();
  if (!controle) return J({ error: "informe o numero_controle" }, 422);
  const p = partesControle(controle);
  if (!p) {
    return J({ error: "formato", mensagem: "Esse não é um número de controle do PNCP. O formato é "
      + "14 dígitos do CNPJ, traço, número, traço, sequencial, barra e ano." }, 422);
  }

  // ── 2. JÁ ESTÁ NO ÍNDICE? Então não há nada a fazer, e isso é resposta boa ─────────────────
  const q = await fetch(`${SB_URL}/rest/v1/licitacoes?select=id,origem_registro`
    + `&numero_controle=eq.${encodeURIComponent(controle)}`, { headers: H_SR });
  if (q.ok) {
    const j = await q.json();
    if (j.length) return J({ ok: true, ja: true, id: j[0].id, origem_registro: j[0].origem_registro });
  }

  // ── 3. O PNCP É QUEM DIZ O QUE ESTA LICITAÇÃO É ───────────────────────────────────────────
  const r = await buscaNoPNCP(controle);
  if ((r as any).erro) {
    /* NÃO CONSEGUI PERGUNTAR ≠ NÃO EXISTE, e aqui a consequência de confundir é gravar. Sem
       resposta do PNCP, não entra linha nenhuma. */
    return J({ error: "nao_sei", mensagem: "Não consegui falar com o PNCP agora para conferir "
      + "este certame (" + (r as any).erro + "). Não gravei nada — prefiro não guardar do que "
      + "guardar o que não confirmei." }, 503);
  }
  if ((r as any).naoAchou) {
    return J({ error: "nao_existe", mensagem: "O PNCP não devolveu nenhuma contratação com esse "
      + "número de controle. Não gravei." }, 409);
  }

  const linha = linhaDoAchado((r as any).achado, controle);
  if (!linha) return J({ error: "nao_consegui_ler", mensagem: "O PNCP respondeu, mas sem os campos "
    + "mínimos para montar a linha do índice." }, 422);

  // ── 4. INSERT, E SÓ INSERT ────────────────────────────────────────────────────────────────
  /* `Prefer: resolution=ignore-duplicates` em vez de upsert: se a varredura normal gravou este
     certame entre o passo 2 e agora (corrida real — a coleta roda 3x por dia), o certo é NÃO
     escrever por cima. A linha dela sabe mais que a nossa. */
  const g = await fetch(`${SB_URL}/rest/v1/licitacoes?on_conflict=portal,cnpj,ano,sequencial`, {
    method: "POST",
    headers: { ...H_SR, Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify([linha]),
  });
  if (!g.ok) {
    const txt = await g.text();
    return J({ error: "nao_consegui_gravar", http: g.status, detalhe: txt.slice(0, 300) }, 500);
  }
  const gravadas = await g.json();
  return J({
    ok: true, ja: false, gravou: gravadas.length > 0,
    id: gravadas.length ? gravadas[0].id : null,
    numero_controle: controle,
    origem_registro: "busca_ao_vivo",
    mensagem: gravadas.length
      ? "Guardado no índice, com o selo de que veio da busca ao vivo."
      : "Já havia uma linha com esta chave natural — não escrevi por cima.",
  });
});
