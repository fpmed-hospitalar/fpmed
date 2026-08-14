/* ══════════════════════════════════════════════════════════════════════════════════════════
   valida-controle — "ESTE NÚMERO DO PNCP É MESMO O DESTE NEGÓCIO?"
   Fatia A19 · 14/08/2026 · decisão do dono: *"prepare o caminho — mas barato. Nada de mutirão;
   quem quiser recuperar informa o número, e o resto segue sozinho."*

   O QUE ELA FAZ: recebe um `numero_controle` digitado por uma pessoa e o id do negócio, e
   responde se aquele número EXISTE no PNCP e se ele BATE com o que o negócio diz. Quando bate
   (ou quando a pessoa confirma a divergência), grava a chave no negócio — e é essa chave que
   faz o coletor de resultado por item enxergar o negócio e trazer os itens ganhos.

   ══ POR QUE ELA EXISTE, SE A TELA PODERIA PERGUNTAR AO PNCP SOZINHA ═════════════════════════
   Poderia, e é aí que mora o problema: a regra de "bate ou não bate" ficaria escrita na tela do
   Negócios, e uma segunda cópia dela já existe no `tools/valida_controle_pncp.js` (o caminho do
   operador). Duas respostas para "esse número é válido?" um dia discordam — e o dia em que
   discordarem é o dia em que alguém amarrar um resultado no edital errado.
   >>> ALÉM DISSO, QUEM ESCREVE EM `negocios` PRECISA PASSAR POR AQUI DE QUALQUER JEITO: a
       validação e a gravação têm que ser o MESMO ato. Validar na tela e gravar em outro lugar
       deixa a porta aberta pra gravar sem validar.

   ══ O QUE ELA NÃO FAZ ══════════════════════════════════════════════════════════════════════
   >>> NÃO ADIVINHA. Não existe caminho aqui que receba UF+ano+número e devolva um palpite.
       Medido em 14/08: casar assim deu 2 "únicos" e os DOIS eram de cidade errada; refeito
       hoje com o índice maior, as 4 ambíguas continuam todas erradas. O número vem de gente.
   >>> NÃO GASTA IA e não escreve em `usos_ia`. São duas requisições GET ao PNCP.
   >>> NÃO COLETA NADA. Ela abre a porta; quem traz os itens é o coletor de sempre.
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

const TIMEOUT_MS = 20000;

/* ══ AS FUNÇÕES PURAS — ESPELHO DO tools/valida_controle_pncp.js ═══════════════════════════
   Dois runtimes (node e Deno), um comportamento. A suíte `testa_controle_informado` compara os
   dois arquivos e reprova se um mudar sozinho — é o mesmo arranjo já em pé entre o
   `coleta_pncp.js` e a `coletar-licitacoes`, e existe porque um validador que aceita no
   operador e recusa na tela (ou o contrário) é pior que não ter validador. */

/* O sequencial vai com zeros à esquerda no número de controle e SEM eles na URL — `000782` vira
   `782`. Mandar com zero devolve 404, e 404 aqui seria lido como "esta licitação não existe":
   o erro mais convincente possível. */
function partesControle(controle: string) {
  const m = String(controle || "").trim().match(/^(\d{14})-(\d+)-(\d+)\/(\d{4})$/);
  if (!m) return null;
  return { cnpj: m[1], ordem: m[2], sequencial: String(Number(m[3])), ano: m[4] };
}

const VAZIAS = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "MUNICIPIO", "MUNICIPAL", "PREFEITURA",
  "ESTADO", "ESTADUAL", "FUNDO", "SECRETARIA", "SEC", "CAMARA", "GOVERNO", "PODER", "PUBLICO",
  "ADMINISTRACAO", "DIRETA", "INDIRETA", "AUTARQUIA", "FUNDACAO", "INSTITUTO", "SERVICO", "SAUDE"]);
function tokens(nome: string) {
  return String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9\s]/g, " ").split(/\s+/)
    .filter((t) => t.length >= 3 && !VAZIAS.has(t));
}
/* Metade dos tokens significativos do MENOR conjunto tem que aparecer no outro. O menor, e não
   a média: "PALMEIRAS DE GOIAS" contra "MUNICIPIO DE PALMEIRAS DE GOIAS SECRETARIA MUNICIPAL DE
   SAUDE" é a mesma entidade com nome mais longo. Sem nome dos dois lados, `null` = "não sei",
   que é diferente de "não bate". */
function nomesBatem(a: string, b: string): boolean | null {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return null;
  const [menor, maior] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const set = new Set(maior);
  return menor.filter((t) => set.has(t)).length / menor.length >= 0.5;
}
function anoDoNegocio(neg: any): number | null {
  const n = String((neg && neg.numero) || "").match(/\/\s*(\d{4})\s*$/);
  if (n) return Number(n[1]);
  if (neg && neg.abertura) { const d = new Date(neg.abertura); if (!isNaN(+d)) return d.getUTCFullYear(); }
  return null;
}

function veredito(e: any) {
  const p = e.partes;
  if (!p) {
    return { ok: false, veredito: "formato", podeGravar: false, divergencias: [],
      mensagem: "Esse não é um número de controle do PNCP. O formato é 14 dígitos do CNPJ, um traço, "
        + "um número, outro traço, o sequencial, barra e o ano — por exemplo 03659166002156-1-000034/2026. "
        + "Ele aparece na página da licitação no PNCP." };
  }
  if (e.existe === false) {
    return { ok: false, veredito: "nao_existe", podeGravar: false, divergencias: [],
      mensagem: "O PNCP não conhece essa contratação. O número tem o formato certo, mas não há compra "
        + `${p.sequencial}/${p.ano} publicada pelo CNPJ ${p.cnpj}. Confira o número na página do pregão — `
        + "é comum trocar o sequencial pelo número do edital, que são diferentes." };
  }
  if (e.existe == null) {
    /* NÃO CONSEGUI PERGUNTAR ≠ NÃO EXISTE. Recusar aqui faria uma queda do PNCP virar "seu número
       está errado" — e a pessoa apagaria um número certo. */
    return { ok: false, veredito: "nao_sei", podeGravar: false, divergencias: [],
      mensagem: "Não consegui falar com o PNCP agora para conferir esse número. Não quer dizer que ele "
        + "esteja errado — quer dizer que eu não consegui olhar. Tente de novo daqui a pouco." };
  }

  const div: any[] = [];
  if (e.anoNegocio != null && Number(e.anoNegocio) !== Number(p.ano)) {
    div.push({ campo: "ano", informado: p.ano, negocio: String(e.anoNegocio), bloqueia: true });
  }
  const bateOrgao = e.orgaoPNCP ? nomesBatem(e.orgaoPNCP, e.orgaoNegocio) : null;
  if (bateOrgao === false) div.push({ campo: "órgão", informado: e.orgaoPNCP, negocio: e.orgaoNegocio, bloqueia: false });
  const bateMun = e.municipioIndice ? nomesBatem(e.municipioIndice, e.municipioNegocio) : null;
  if (bateMun === false) div.push({ campo: "município", informado: e.municipioIndice, negocio: e.municipioNegocio, bloqueia: false });

  const d = div.find((x) => x.bloqueia);
  if (d) {
    return { ok: false, veredito: "diverge", podeGravar: false, divergencias: div,
      mensagem: `Esse número é de ${d.campo === "ano" ? "outro ano" : "outro " + d.campo}: o PNCP diz `
        + `${d.informado} e este negócio diz ${d.negocio}. Não vou amarrar os dois — um resultado do `
        + "edital errado não aparece como defeito, aparece como um preço plausível na tela em que se decide preço." };
  }
  if (div.length) {
    return { ok: false, veredito: "diverge", podeGravar: true, divergencias: div,
      mensagem: "O número existe no PNCP, mas o nome não é o mesmo que está no negócio:\n"
        + div.map((x) => `  · ${x.campo}: o PNCP diz "${x.informado}" e o negócio diz "${x.negocio}"`).join("\n")
        + "\nIsso pode ser só o mesmo órgão escrito de outro jeito — quem sabe é você. Confirme para gravar assim mesmo." };
  }
  return { ok: true, veredito: "confere", podeGravar: true, divergencias: [],
    mensagem: e.orgaoPNCP ? `Confere: ${e.orgaoPNCP} · compra ${p.sequencial}/${p.ano}.`
      : `O PNCP conhece a compra ${p.sequencial}/${p.ano} do CNPJ ${p.cnpj}.` };
}

// ── as duas perguntas ao PNCP ──────────────────────────────────────────────────────────────
async function pncp(url: string) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ac.signal });
    clearTimeout(to);
    const txt = await r.text();
    return { http: r.status, corpo: txt.trim() ? JSON.parse(txt) : null };
  } catch (e) { clearTimeout(to); return { http: null, erro: String((e as Error).name) }; }
}

/* "EXISTE?" PELA PORTA QUE ESTÁ ABERTA. O detalhe da compra mudou pra dentro da API de CONSULTA
   (HTTP 301, medido em 14/08) e a consulta está fora — perguntar por lá devolveria timeout pra
   todo mundo e este validador nunca aprovaria nada. `/itens` e `/arquivos` são da API de DETALHE,
   respondem em ~80 ms e dizem "Contratação não cadastrada." com 404.
   >>> AS DUAS PORTAS, E NÃO SÓ UMA: uma compra pode não ter item publicado e ainda assim existir
       (o caso mais comum do 404, medido na fatia A6). Parar na primeira recusaria número CERTO. */
async function existeNoPNCP(p: any) {
  const base = `https://pncp.gov.br/api/pncp/v1/orgaos/${p.cnpj}/compras/${p.ano}/${p.sequencial}`;
  const it = await pncp(`${base}/itens?pagina=1&tamanhoPagina=1`);
  if (it.http === 200) return { existe: true };
  if (it.http === 404) {
    const ar = await pncp(`${base}/arquivos`);
    if (ar.http === 200) return { existe: true };
    if (ar.http === 404) return { existe: false };
    return { existe: null };
  }
  return { existe: null };
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
  if (!/^Bearer\s+\S+/i.test(auth)) return J({ error: "faca login pra conferir o numero" }, 401);
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

  // ── 2. O NEGÓCIO (opcional: sem ele, dá pra conferir só a existência) ──────────────────────
  let neg: any = null;
  if (body.negocio_id != null) {
    const r = await fetch(`${SB_URL}/rest/v1/negocios?select=id,titulo,numero,orgao,municipio,uf,`
      + `abertura,estagio,numero_controle,licitacao_id&id=eq.${encodeURIComponent(String(body.negocio_id))}`,
      { headers: H_SR });
    const j = r.ok ? await r.json() : [];
    neg = j[0] || null;
    if (!neg) return J({ error: "nao achei esse negocio" }, 404);
  }

  // ── 3. O PNCP, e o nosso índice quando ele conhece a compra ────────────────────────────────
  const ex = p ? await existeNoPNCP(p) : { existe: null };
  let orgaoPNCP: string | null = null;
  if (p && ex.existe) {
    const o = await pncp(`https://pncp.gov.br/api/pncp/v1/orgaos/${p.cnpj}`);
    if (o.http === 200 && o.corpo) orgaoPNCP = String(o.corpo.razaoSocial || "");
  }
  let noIndice: any = null;
  if (p) {
    const r = await fetch(`${SB_URL}/rest/v1/licitacoes?select=id,orgao,municipio,uf,numero_compra`
      + `&numero_controle=eq.${encodeURIComponent(controle)}`, { headers: H_SR });
    if (r.ok) noIndice = (await r.json())[0] || null;
  }

  const v: any = veredito({
    partes: p, existe: ex.existe,
    anoNegocio: neg ? anoDoNegocio(neg) : null,
    orgaoPNCP, orgaoNegocio: neg ? neg.orgao : null,
    municipioIndice: noIndice ? noIndice.municipio : null,
    municipioNegocio: neg ? neg.municipio : null,
  });
  v.numero_controle = controle;
  v.partes = p;
  v.orgao_pncp = orgaoPNCP;
  v.no_indice = noIndice ? { id: noIndice.id, orgao: noIndice.orgao, municipio: noIndice.municipio, uf: noIndice.uf } : null;
  v.gravou = false;

  // ── 4. GRAVAR É UM PEDIDO EXPLÍCITO, E NUNCA UM EFEITO DE CONFERIR ─────────────────────────
  /* Conferir tem que poder ser feito enquanto a pessoa digita, sem medo. Gravar por tabela mudaria
     o dado de um negócio ganho só porque alguém colou um número pra ver o que dava. */
  if (body.gravar === true) {
    if (!neg) return J({ ...v, error: "gravar exige negocio_id" }, 422);
    if (!v.podeGravar) return J({ ...v, error: v.veredito }, 409);
    if (v.divergencias.length && body.confirmado !== true) {
      return J({ ...v, error: "confirme a divergencia para gravar", precisaConfirmar: true }, 409);
    }
    /* OS DOIS CAMPOS, e não só um — o conserto da A9 de novo. `numero_controle` é a chave que o
       PNCP entende; `licitacao_id` é a que amarra ao nosso índice quando ele conhece a licitação.
       Gravar só um deixa metade da ponte de pé. */
    const corpo: any = { numero_controle: controle };
    if (noIndice) corpo.licitacao_id = noIndice.id;
    const g = await fetch(`${SB_URL}/rest/v1/negocios?id=eq.${neg.id}`, {
      method: "PATCH", headers: { ...H_SR, Prefer: "return=minimal" }, body: JSON.stringify(corpo),
    });
    if (!g.ok) return J({ ...v, error: "nao consegui gravar (" + g.status + ")" }, 500);
    v.gravou = true;
    v.licitacao_id = corpo.licitacao_id || null;
    v.mensagem += "\nGravado. Este negócio entra na fila do resultado por item na próxima rodada do coletor.";
  }

  return J(v);
});
