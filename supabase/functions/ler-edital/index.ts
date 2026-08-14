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
//   body: { tarefa:'resumo'|'itens', modo:'texto'|'pdf-nativo', texto?|pdfBase64?, motivo?,
//           titulo?, url?, mb?, paginas?, chars?, cambio? }
//   resposta: { ok, dados, modo, tarefa, modoMotivo, usage, usd, brl, leituraId }
//
// ══ AS DUAS TAREFAS ══════════════════════════════════════════════════════════════════════════
// `resumo` le o edital e devolve o que a pessoa precisa saber pra decidir se disputa.
// `itens`  le o ANEXO DE ITENS e devolve a tabela — e essa vira PROPOSTA. Sao dois prompts, dois
// tetos de saida e dois jeitos de dar errado; o que elas dividem e a permissao e o contador.
// ============================================================

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");

const MODELO = "claude-haiku-4-5";
const USD_ENTRADA_MTOK = 1.00;   // tabela publica da Anthropic
const USD_SAIDA_MTOK = 5.00;
// A saida custa 5x a entrada, entao o teto e apertado de proposito — MAS ele muda com a tarefa.
// Resumo cabe em 2 mil tokens. Uma tabela de 80 itens com descricao COMPLETA de medicamento
// ("Dipirona sodica 500mg/mL solucao injetavel ampola 2mL, embalagem com...") passa fácil de 6 mil.
// Teto de resumo aplicado a itens nao devolve tabela menor: devolve tabela CORTADA no meio.
const MAX_SAIDA: Record<string, number> = {
  resumo: 2000, itens: 12000, juntar: 3000,
  // Os dois relatorios do Gerenciamento de Ata sao tabelas item a item, como a extracao de itens
  // — e o mapa de precos e a maior de todas, porque traz uma LINHA POR CONCORRENTE de cada item.
  "itens-ganhos": 12000, "mapa-precos": 16000,
};

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

/* MEDIDO NAS 7 LEITURAS REAIS DESTA BASE (usos_ia, 14/08): 2,90 · 2,92 · 3,01 · 3,04 · 3,04 ·
   3,05 · 3,05 chars por token de entrada. Fica 3,00.
   >>> NÃO É O "4 CHARS POR TOKEN" QUE TODO MUNDO REPETE: aquilo é do inglês. Em português, com
       este tokenizador, dá 3 — e usar 4 subestimaria a entrada em 33% num aviso de custo, que é
       a única direção em que um aviso de custo não pode errar. */
const CHARS_POR_TOKEN = 3.00;

/* O CÂMBIO É BUSCADO AQUI, E NÃO MANDADO PELA TELA, quando o assunto é ORÇAMENTO. Um preço em
   reais que o próprio navegador calculou com um dólar que ele mesmo escolheu não é um preço:
   é uma sugestão. Falhou a cotação -> devolve `null` e a tela mostra em dólar, dizendo que é
   dólar. Inventar 5,00 seria a lição S6 com cifrão. */
/* ══ DUAS FONTES, E A SEGUNDA NASCEU DE UMA MEDIÇÃO ═══════════════════════════════════════════
   A `awesomeapi` é a que a tela do Leitor já usava, e ela responde bem DO NAVEGADOR — medido:
   6 leituras reais gravaram câmbio entre 5,10 e 5,19. Da edge function, na primeira prova desta
   fatia, ela devolveu NADA e o orçamento saiu em dólar.
   >>> UMA COTAÇÃO COM UMA FONTE SÓ É UMA COTAÇÃO QUE UM DIA NÃO EXISTE, e aqui o efeito não é
       um erro: é um preço em dólar aparecendo pra quem paga em real, na hora de decidir gastar.
   A ordem é deliberada: a brasileira primeiro (é a que a casa já conferiu contra o câmbio do
   dia), a internacional como rede. E se as duas falharem, devolve `null` — a tela mostra em
   dólar e DIZ que é dólar. Inventar 5,00 seria a lição S6 com cifrão. */
let _cotacao: { v: number | null; em: number } = { v: null, em: 0 };
async function cotacaoUSD(): Promise<number | null> {
  if (_cotacao.v && Date.now() - _cotacao.em < 3600_000) return _cotacao.v;
  const fontes: Array<() => Promise<number>> = [
    async () => {
      const r = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL", { signal: AbortSignal.timeout(8000) });
      return parseFloat((await r.json())?.USDBRL?.bid);
    },
    async () => {
      const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=BRL", { signal: AbortSignal.timeout(8000) });
      return Number((await r.json())?.rates?.BRL);
    },
  ];
  for (const f of fontes) {
    try {
      const v = await f();
      /* A FAIXA DE SANIDADE EXISTE PORQUE COTAÇÃO ERRADA É PIOR QUE COTAÇÃO NENHUMA: uma API que
         mude de formato e devolva 1 (ou 0,19, a taxa invertida) transformaria um orçamento de
         R$ 5 em R$ 1 — e o aviso de custo passaria a mentir para menos, que é a direção proibida. */
      if (isFinite(v) && v > 3 && v < 12) { _cotacao = { v, em: Date.now() }; return v; }
    } catch { /* tenta a próxima */ }
  }
  return null;
}

const PERGUNTA_RESUMO = `Voce esta lendo o EDITAL de uma licitacao publica brasileira para uma
distribuidora de medicamentos e material hospitalar. Responda SOMENTE com JSON, sem texto antes
ou depois, neste formato:
{"objeto":"","orgao":"","modalidade":"","abertura":"","entrega_prazo":"","entrega_local":"",
"pagamento":"","amostra":true,"registro_precos":true,"habilitacao":[],"penalidades":"",
"pontos_de_atencao":[],"nao_encontrado":[]}
Se algo nao estiver no documento, NAO invente: ponha o nome do campo em "nao_encontrado".`;

/* ══ A EXTRACAO DA TABELA DE ITENS ═══════════════════════════════════════════════════════════
   O que sai daqui vira PROPOSTA — ou seja, dinheiro. Por isso o prompt e mais duro que o do
   resumo em tres pontos, e cada um corresponde a um jeito conhecido de a extracao estragar:
     1. NAO INVENTAR ITEM que nao esta na tabela (a IA "completa" sequencia numerica se deixarem);
     2. NAO CONVERTER quantidade nem unidade — copiar como esta escrito. Converter aqui seria uma
        segunda regra de embalagem, brigando com a que a ponte ja aplica no lado da proposta;
     3. DIZER QUANDO NAO ACHOU a tabela, em vez de devolver lista vazia como se o edital nao
        tivesse itens. Lista vazia e "nao tem"; `tabela_encontrada:false` e "nao achei". */
const PERGUNTA_ITENS = `Voce esta lendo o EDITAL de uma licitacao publica brasileira. Extraia a
TABELA DE ITENS (o anexo com a relacao de produtos/servicos a serem cotados).
Responda SOMENTE com JSON, sem texto antes ou depois:
{"tabela_encontrada": true, "onde": "em que anexo/pagina a tabela estava",
 "itens":[{"n":"numero do item como esta no edital","descricao":"descricao COMPLETA do item",
           "quantidade":0,"unidade":"unidade de fornecimento como esta escrita",
           "valor_unitario":0}],
 "observacao":"o que voce nao conseguiu ler com certeza"}
REGRAS OBRIGATORIAS:
- Copie a descricao INTEIRA de cada item, sem resumir: ela e o que identifica o produto.
- NAO invente item nem complete sequencia de numeracao. Se o edital pula do 12 para o 15,
  devolva so os que existem.
- NAO converta quantidade nem unidade. Copie como esta escrito no documento.
- Se o valor unitario estimado nao aparecer, use null. NAO estime.
- Se voce NAO encontrar a tabela de itens, devolva {"tabela_encontrada": false, "itens": []} e
  explique em "observacao". Lista vazia sem esse aviso seria dizer que o edital nao tem itens.`;

/* ══ A PASSADA FINAL DO RESUMO EM PARTES (map-reduce) ═════════════════════════════════════════
   Cada parte devolve um resumo do PEDACO que leu. Juntar isso no navegador daria uma colcha:
   cinco "objeto" diferentes, cinco "abertura", e ninguem sabendo qual vale. Entao a juncao e uma
   leitura tambem — mas barata, porque o que entra sao os resumos, e nao o edital.
   >>> O CONFLITO NAO E RESOLVIDO NO ESCURO. Quando duas partes discordam de um campo, a resposta
       traz as duas versoes em `conflitos`, dizendo de que parte veio cada uma. Escolher uma
       calado seria inventar uma certeza que a leitura nao teve. */
const PERGUNTA_JUNTAR = `Abaixo estao RESUMOS PARCIAIS de um mesmo edital de licitacao publica
brasileira, cada um feito a partir de UMA PARTE do documento. Junte-os num resumo unico.
Responda SOMENTE com JSON, sem texto antes ou depois, neste formato:
{"objeto":"","orgao":"","modalidade":"","abertura":"","entrega_prazo":"","entrega_local":"",
"pagamento":"","amostra":true,"registro_precos":true,"habilitacao":[],"penalidades":"",
"pontos_de_atencao":[],"nao_encontrado":[],
 "conflitos":[{"campo":"","versoes":["parte 2 disse X","parte 4 disse Y"]}]}
REGRAS OBRIGATORIAS:
- NAO invente nada que nao esteja nos resumos parciais.
- Se DUAS partes disserem coisas diferentes do mesmo campo, NAO escolha uma: ponha as duas em
  "conflitos", dizendo de qual parte veio cada uma, e deixe o campo com a que aparecer mais vezes.
- "habilitacao" e "pontos_de_atencao" sao LISTAS: junte todas as partes e tire so as repetidas.
- Em "nao_encontrado" ponha so o que NENHUMA parte encontrou.`;

/* ══ OS ITENS GANHOS ═════════════════════════════════════════════════════════════════════════
   Le o documento de resultado (itens ganhos / ata da sessao) e devolve o que a empresa ganhou.
   O total daqui vira SUGESTAO para o campo `valor_ganho`, que alimenta a TAXA DE VITORIA — e por
   isso o prompt e o mais desconfiado dos cinco:
     · nao inventar item, nao completar sequencia;
     · dizer QUANTOS itens o documento tinha ao todo (e o denominador do "ganhou X de Y", e sem
       ele o X sozinho nao informa nada);
     · e separar o que ele NAO conseguiu ler, em vez de deixar de fora em silencio. */
const PERGUNTA_GANHOS = `Voce esta lendo o RESULTADO de uma licitacao publica brasileira (ata da
sessao, mapa de apuracao ou relacao de itens adjudicados). A empresa que pergunta e a que consta
como VENCEDORA nos itens que ganhou.
Responda SOMENTE com JSON, sem texto antes ou depois:
{"encontrado": true, "empresa": "a razao social da nossa empresa como aparece no documento",
 "itens_no_documento": 0,
 "ganhos":[{"n":"numero do item","descricao":"descricao COMPLETA","quantidade":0,
            "unidade":"","valor_unitario":0,"total":0,"fornecedor":"quem venceu"}],
 "perdidos":[{"n":"","descricao":"","vencedor":"","valor_unitario":0}],
 "nao_consegui_ler":["o que ficou ilegivel ou ambiguo"],
 "observacao":""}
REGRAS OBRIGATORIAS:
- NAO invente item nem complete sequencia de numeracao.
- "itens_no_documento" e o TOTAL de itens que aparecem no documento, ganhos ou nao.
- "total" de cada item ganho = quantidade x valor_unitario. Se faltar um dos dois, use null e
  NAO estime.
- Um item so entra em "ganhos" se o documento disser explicitamente que a nossa empresa venceu.
  Na duvida, ponha em "nao_consegui_ler" — nunca chute a nosso favor.
- Se voce NAO encontrar resultado nenhum, devolva {"encontrado": false} e explique em
  "observacao". Lista vazia sem esse aviso seria dizer que a empresa nao ganhou nada.`;

/* ══ O MAPA DE PRECOS DA DISPUTA ═════════════════════════════════════════════════════════════
   Este e o unico dos cinco que NAO serve pra executar nada: serve pra aprender. Ele le a ata da
   sessao e monta, item a item, quanto cada um ofereceu — e a distancia do nosso lance pro
   vencedor. E a inteligencia comercial da derrota: mostra ONDE e POR QUANTO se perdeu.
   >>> A DIFERENCA E CALCULADA AQUI? NAO. O prompt pede os NUMEROS; a conta (R$ e %) e feita na
       tela, com aritmetica, e nao pela IA. Modelo de linguagem errando uma subtracao e um jeito
       silencioso de a analise inteira ficar errada — e essa conta e barata demais pra terceirizar. */
const PERGUNTA_MAPA = `Voce esta lendo a ATA DA SESSAO / MAPA DE PRECOS de uma licitacao publica
brasileira. Monte o mapa da disputa, item a item, com os valores de CADA participante.
Responda SOMENTE com JSON, sem texto antes ou depois:
{"encontrado": true, "nossa_empresa": "a razao social da nossa empresa como aparece",
 "itens":[{"n":"numero do item","descricao":"",
           "nosso_preco":0, "nossa_situacao":"vencedor|perdedor|desclassificado|nao_participamos",
           "vencedor":"quem venceu","preco_vencedor":0,
           "concorrentes":[{"empresa":"","preco":0,"situacao":""}]}],
 "nao_consegui_ler":[], "observacao":""}
REGRAS OBRIGATORIAS:
- Copie os valores COMO ESTAO no documento. NAO calcule diferencas, percentuais nem medias.
- Se um item nao trouxer o preco de algum participante, use null. NAO estime.
- Se a nossa empresa nao apareceu num item, "nosso_preco" e null e "nossa_situacao" e
  "nao_participamos". Isso e diferente de ter perdido.
- Se o documento nao for uma ata/mapa de precos, devolva {"encontrado": false} e diga por que.`;

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

  // ── O QUE VOCE QUER QUE EU LEIA (resumo, tabela de itens, ou a juncao dos parciais) ──────
  // As cinco leituras. `TAREFAS` num objeto só, e não numa escada de ternários: com duas dava pra
  // ler, com cinco a escada passa a esconder qual prompt vai com qual teto — e é justamente esse
  // par que precisa estar óbvio, porque teto errado corta a resposta no meio.
  const PROMPTS: Record<string, string> = {
    resumo: PERGUNTA_RESUMO, itens: PERGUNTA_ITENS, juntar: PERGUNTA_JUNTAR,
    "itens-ganhos": PERGUNTA_GANHOS, "mapa-precos": PERGUNTA_MAPA,
  };
  const tarefa = PROMPTS[String(body.tarefa || "")] ? String(body.tarefa) : "resumo";
  const PERGUNTA = PROMPTS[tarefa];

  // ── A LEITURA EM PARTES ──────────────────────────────────────────────────────────────────
  // `lote` amarra as N chamadas numa cobranca so. `parte`/`partes` sao pro prompt saber que esta
  // vendo um PEDACO — sem isso o modelo tenta responder "abertura" e "orgao" de um bloco que so
  // tem a tabela de itens, e inventa. Dizer "voce esta vendo a parte 3 de 7" e o que autoriza
  // ele a devolver campo vazio sem se sentir incompleto.
  const lote = String(body.lote || "").slice(0, 80) || null;
  const partes = Math.max(1, Math.min(200, Number(body.partes) || 1));
  const parte = Math.max(1, Math.min(partes, Number(body.parte) || 1));
  const cabecalhoParte = partes > 1
    ? `Este documento foi dividido em ${partes} partes e voce esta lendo a PARTE ${parte} de ${partes}.\n`
      + `Responda SO com o que estiver NESTA parte. Campo que nao aparecer aqui fica vazio ou em\n`
      + `"nao_encontrado" — outra parte pode te-lo, e juntar e trabalho de outra etapa. NAO invente\n`
      + `para preencher.\n\n`
    : "";

  /* ══ ORÇAMENTO: "QUANTO VAI CUSTAR?", RESPONDIDO AQUI E EM MAIS LUGAR NENHUM (fatia A12) ═════
     O dono decidiu em 14/08 que a conversa com o edital FICA, com o cliente CIENTE DO CUSTO —
     ou seja, a tela precisa dizer o preço ANTES de gastar. E o contrato desta função é literal:
     *não escreva uma segunda conta de custo do seu lado*.
     >>> ENTÃO O ORÇAMENTO NASCE AQUI, e não no navegador. Se a tela estimasse por conta própria,
         passariam a existir duas respostas para "quanto isto custa" — uma que aparece na
         pergunta e outra que vira fatura — e no dia em que a tabela de preço da Anthropic mudar,
         só uma delas seria corrigida. O anúncio ficaria mais barato que a cobrança, e ninguém
         teria como notar até o fechamento do mês.
     >>> ELE NÃO GASTA NADA e não registra nada: sai antes da chamada à Anthropic, de propósito.
         Cancelar tem que custar zero, e "zero" aqui é estrutural — não há o que cancelar.

     ══ OS DOIS NÚMEROS, E DE ONDE SAI CADA UM ═════════════════════════════════════════════════
     · ENTRADA: `chars / CHARS_POR_TOKEN`, e o divisor é MEDIDO, não a regra de bolso. Sete
       leituras reais desta base deram 2,90 a 3,05 chars por token (média 3,00) em português.
       O "4 chars por token" que se repete por aí é do inglês e subestimaria a entrada em 33% —
       num aviso de custo, errar para menos é o único erro que não se pode cometer.
     · SAÍDA: o TETO da tarefa (`MAX_SAIDA`), e não a média. A saída custa 5× a entrada e varia
       muito (medido: `itens` já saiu com 213 e com 8.878 tokens). Anunciar a média faria a
       cobrança passar do anunciado em metade das vezes. O aviso diz "até", e o "até" é verdade. */
  if (body.orcar === true) {
    const chars = Math.max(0, Number(body.chars) || 0);
    const nPartes = partes;
    const tokensEntrada = Math.round(chars / CHARS_POR_TOKEN);
    const tetoSaida = MAX_SAIDA[tarefa] * nPartes;
    const usd = (tokensEntrada / 1e6) * USD_ENTRADA_MTOK + (tetoSaida / 1e6) * USD_SAIDA_MTOK;
    const cambio = await cotacaoUSD();
    return J({
      orcamento: {
        modelo: MODELO, tarefa, partes: nPartes, chars,
        charsPorToken: CHARS_POR_TOKEN,
        tokensEntrada, tetoSaida,
        usd: +usd.toFixed(6),
        cambio,
        brl: cambio ? +(usd * cambio).toFixed(4) : null,
        teto: true,   // é um TETO, e a tela precisa dizer "até" e não "cerca de"
      },
    });
  }

  const modo = body.modo === "pdf-nativo" ? "pdf-nativo" : "texto";
  let bloco: any;
  if (modo === "texto") {
    const t = String(body.texto || "");
    // A tela ja confere isto antes de mandar; aqui e a segunda barreira. Pagar por um resumo de
    // nada e o pior desfecho possivel de uma leitura que vai ser cobrada de alguem.
    // >>> A JUNCAO E A EXCECAO: o que entra nela sao resumos parciais, que sao curtos de
    //     proposito. Exigir 500 caracteres ali recusaria justamente a etapa mais barata.
    if (t.length < 500 && tarefa !== "juntar") {
      return J({ error: "o texto extraido veio pobre demais para valer uma leitura" }, 400);
    }
    bloco = { type: "text", text: (tarefa === "juntar" ? "RESUMOS PARCIAIS:\n\n" : "EDITAL (texto extraido do PDF):\n\n") + t };
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
        max_tokens: MAX_SAIDA[tarefa],
        messages: [{ role: "user", content: [bloco, { type: "text", text: cabecalhoParte + PERGUNTA }] }],
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
    if (j.stop_reason === "max_tokens") {
      // >>> TABELA CORTADA E PIOR QUE TABELA NENHUMA. Dá pra salvar os itens completos que vieram
      //     antes do corte — e é justamente isso que nao se faz aqui. Uma lista de 40 itens de um
      //     edital de 80 nao se parece com erro nenhum: parece um edital de 40 itens. Ela viraria
      //     proposta, e a proposta iria pro pregao faltando metade.
      throw new Error(tarefa === "itens"
        ? "a tabela nao coube na resposta e voltou cortada — entregar metade dos itens como se fosse a lista inteira seria pior que nao entregar"
        : "a leitura foi cortada no limite de tamanho");
    }
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
  // >>> E LEITURA EM PARTES E UM REGISTRO SO. Se cada parte virasse uma linha, a conta do mes
  //     mostraria "23 leituras" para UM edital lido — tecnicamente correto e comercialmente
  //     indefensavel. Quem soma e o banco (`registra_uso_ia`), com `on conflict` atomico: duas
  //     partes que voltem juntas nao sobrescrevem a soma uma da outra.
  let leituraId: number | null = null;
  let regErro: string | null = null;
  if (entrada > 0 || erro) {
    const linha = {
      usuario: user.id, email,
      edital_titulo: String(body.titulo || "").slice(0, 300) || null,
      edital_url: String(body.url || "").slice(0, 500) || null,
      edital_mb: Number(body.mb) || null,
      modo, modo_motivo: String(body.motivo || "") || null, tarefa,
      paginas: Number(body.paginas) || null, chars: Number(body.chars) || null,
      modelo: MODELO, tokens_entrada: entrada, tokens_saida: saida, segundos,
      usd: +usd.toFixed(6), cambio, brl: cambio ? +(usd * cambio).toFixed(4) : null,
      ok: !erro, erro: erro ? erro.slice(0, 300) : null,
      lote, partes,
    };
    /* >>> UM CONTADOR DE FATURAMENTO NAO PODE FALHAR CALADO. Este `try` existia com um `catch {}`
           vazio, pelo motivo certo: o registro falhar nao pode engolir a leitura que a pessoa ja
           pagou. Mas em 11/08 ele engoliu outra coisa — a tarefa `juntar` nasceu sem entrar no
           check constraint da coluna, o insert passou a levantar erro, e o silencio transformou
           isso em custo consumido e NAO cobrado. Ninguem teria descoberto ate a fatura da
           Anthropic nao bater com a conta do mes.
           Agora a leitura continua sendo entregue — e o `registrado: false` sobe junto, pra tela
           dizer que aquela leitura NAO entrou no contador. */
    try {
      const reg = await fetch(`${SB_URL}/rest/v1/rpc/registra_uso_ia`, {
        method: "POST", headers: H_SR, body: JSON.stringify({ p: linha }),
      });
      if (reg.ok) leituraId = Number(await reg.json()) || null;
      else regErro = "o contador respondeu " + reg.status + ": " + (await reg.text()).slice(0, 160);
    } catch (e) { regErro = "nao consegui falar com o contador: " + String((e as Error)?.message || e); }
  }

  // Erro DEPOIS de consumir token traz o custo junto: a pessoa precisa saber que pagou, mesmo
  // sem receber a tabela. Custo escondido em erro e a forma mais rapida de a conta do mes nao
  // fechar com a fatura.
  // `cortou` volta separado do texto do erro porque a tela AGE diferente nele: leitura cortada
  // se refaz com bloco menor; erro de rede se repete igual. Fazer a tela decidir isso lendo a
  // frase do erro seria amarrar comportamento a uma string que um dia alguem reescreve.
  const cortou = !!erro && /cortad|max_tokens|nao coube/i.test(erro);
  // `registrado` é a resposta à pergunta "esta leitura entrou na conta?". Ela não é derivável do
  // `leituraId` sozinho: numa leitura em partes, a 2ª parte pode falhar no contador enquanto a 1ª
  // já devolveu um id — e aí o id existe e o custo desta parte não está lá.
  const registrado = !regErro;
  if (erro) return J({ ok: false, erro, cortou, modo, tarefa, parte, partes, leituraId,
                       registrado, regErro,
                       usd: +usd.toFixed(4), brl: cambio ? +(usd * cambio).toFixed(4) : null }, 200);
  return J({
    ok: true, dados, modo, tarefa, parte, partes, modoMotivo: body.motivo || null, leituraId,
    registrado, regErro,
    usage: { entrada, saida }, segundos, modelo: MODELO,
    usd: +usd.toFixed(4), cambio, brl: cambio ? +(usd * cambio).toFixed(4) : null,
  });
});
