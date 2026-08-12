// ============================================================
// Supabase Edge Function: enviar-boletim   (FPMED — módulo 2.14 da spec)
//
// O QUE ELA RESOLVE: o jornal (busca salva) já mostra "8 novas desde a sua última leitura" —
// mas só pra quem abre o sistema. Quem só abre quando lembra perde o edital que abre amanhã.
// Esta função manda o boletim do dia anterior, de madrugada, pra quem assinou.
//
// ══ A REGRA DE OURO DO BOLETIM: ESPERAR O DIA FECHAR ═════════════════════════════════════════
// O boletim é do dia D-1 INTEIRO, disparado de madrugada. Mandar durante o dia perderia o que
// for publicado depois do corte — e perderia EM SILÊNCIO, que é o pior jeito de perder. Quem
// recebe um boletim às 14h acredita que aquilo é o dia todo.
//
// ══ DE ONDE SAI O DADO ═══════════════════════════════════════════════════════════════════════
// Do NOSSO índice (`licitacoes`), nunca do PNCP ao vivo: a fonte caiu ~6× em 3 dias e um
// boletim que depende dela mandaria "nada novo" quando a verdade é "não consegui perguntar".
// >>> E POR ISSO ELE CONFERE O CARIMBO: se o índice não fechou o dia D-1, o boletim NÃO SAI e
//     grava o motivo. Boletim vazio é lido como "não teve nada"; ausência de boletim é lida
//     como "algo está errado" — que é a verdade nesse caso.
//
// ══ O QUE ESTA FUNÇÃO NÃO É ══════════════════════════════════════════════════════════════════
// Ela não é a tela. Os filtros que ela aplica são os que existem como COLUNA (data, UF,
// modalidade) mais a palavra-chave; o refino fino (portal, modo de disputa, faixa de valor,
// SRP) mora no navegador. Por isso o e-mail DIZ, no rodapé, que a tela é a autoridade e leva
// pra lá. Um número aqui que discordasse do número de lá, sem avisar, seria pior que nenhum.
// >>> Registrado como dívida: unificar o refino num módulo só, carregado pelos dois lados.
//
// CONTRATO:
//   POST /functions/v1/enviar-boletim
//   header: x-boletim-token: <BOLETIM_TOKEN>     (segredo dedicado — NÃO é a service_role)
//   body opcional: { "dia": "2026-08-10", "teste": "email@destino" }
//   resposta: { ok, jornais, enviados, pulados, semChave, erro }
//
// >>> SEM RESEND_API_KEY ELA NÃO FINGE QUE MANDOU. Responde `semChave: true`, não marca nada
//     como enviado e não altera `vistos_email`. É o estado esperado enquanto o Lemuel não
//     criar a conta: tudo pronto, faltando a chave.
// ============================================================

/* ══ O MOTOR DO ALARME DA COLETA, COLADO AQUI PELO DEPLOY ════════════════════════════════════
   A linha abaixo NÃO é comentário morto: o `tools/deploy_edge.js` a substitui pelo conteúdo do
   `fpmed_alarme_coleta.js` na hora de publicar. O repositório guarda UMA cópia da regra "isto é
   alarme?", e ela é a mesma que o sino do Negócios lê. Reescrever a regra aqui em TypeScript
   criaria a segunda definição — e no dia em que uma mudasse, o sino diria uma coisa e o e-mail
   diria outra sobre o mesmo banco. */
// @inline fpmed_alarme_coleta.js
const ALARME: any = (globalThis as any).AlarmeColeta || null;

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;   // injetada pela plataforma
const TOKEN = Deno.env.get("BOLETIM_TOKEN");                // segredo dedicado do agendador
const RESEND = Deno.env.get("RESEND_API_KEY");              // o que falta pra ligar
const REMETENTE = Deno.env.get("BOLETIM_REMETENTE") || "FPMED <onboarding@resend.dev>";
const URL_SISTEMA = "https://fpmed-hospitalar.github.io/fpmed/fpmed_licitacoes.html";

/* ══ A TRAVA DE COMPLIANCE DO REMETENTE ═══════════════════════════════════════
   REGRA MASTER: nenhum e-mail da FPMED sai por domínio da GlobalMed. Marca de
   uma empresa no e-mail da outra é o mesmo cruzamento que a regra proíbe — só
   que visível pro cliente, com o domínio impresso no cabeçalho.

   >>> POR QUE ISSO É UMA TRAVA NO CÓDIGO E NÃO UM AVISO NO MANUAL.
   Auditado em 11/08: `BOLETIM_REMETENTE` NÃO está configurado, então o remetente
   é o `onboarding@resend.dev` — nada de errado sai hoje. O perigo é o de amanhã:
   o Resend só entrega pra fora com DOMÍNIO VERIFICADO, e o único domínio
   verificado na conta é o `globalmedgo.com.br`. Quer dizer que, no dia em que
   alguém for "fazer o boletim chegar no cliente", a solução que funciona de
   primeira é exatamente a proibida — e ela funciona, e ninguém percebe.
   Regra que depende de alguém lembrar cede no dia da pressa (S5). Esta cede não.

   O certo é verificar `fpmed.com.br` (send.fpmed.com.br) e apontar o remetente
   pra lá. Até isso acontecer, destinatário = só o dono. */
const DOMINIOS_PROIBIDOS = ["globalmedgo.com.br", "globalmed.com.br"];
const dominioDe = (rem: string) => (rem.match(/@([^>\s]+)/) || [])[1]?.toLowerCase() || "";
function remetenteProibido(rem: string) {
  const d = dominioDe(rem);
  return DOMINIOS_PROIBIDOS.some((p) => d === p || d.endsWith("." + p)) ? d : null;
}

const H = { apikey: SB_SR, Authorization: "Bearer " + SB_SR, "Content-Type": "application/json" };
const TETO_LINHAS = 25;      // no e-mail; o resto vira "e mais N — abrir no sistema"
const TETO_VISTOS = 800;     // mesma poda do `vistos` da tela: memória não cresce sem fim

const semAcento = (s: string) => {
  let o = "";
  for (const c of String(s || "").normalize("NFD")) {
    const k = c.codePointAt(0)!;
    if (k >= 0x300 && k <= 0x36f) continue;
    o += c;
  }
  return o.toLowerCase();
};

const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));

const brl = (n: unknown) => {
  const v = Number(n);
  return isFinite(v) && v > 0
    ? "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
    : "valor não informado";
};

const dm = (iso: string) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "");

/* ══ O E-MAIL ═══════════════════════════════════════════════════════════════════════════════
   HTML de tabela e estilo INLINE, sem <style> e sem imagem externa: cliente de e-mail corta
   folha de estilo e bloqueia imagem por padrão, e um boletim que chega quebrado uma vez deixa
   de ser lido pra sempre. Nada de rastreador — o que se quer saber é se ele abriu o SISTEMA. */
// O bloco das sessões do dia. Fica ANTES da lista de novidades porque é o único item do e-mail
// com hora marcada — o resto pode ser lido à tarde.
function blocoSessoes(sessoes: any[]) {
  if (!sessoes.length) return "";
  const linhas = sessoes.map((s) => {
    const hora = String(s.abertura || "").slice(11, 16);
    const quem = [s.modalidade, s.numero].filter(Boolean).join(" ") || "Certame";
    const onde = [s.municipio, s.uf].filter(Boolean).join("/");
    return `<tr><td style="padding:9px 12px;border-bottom:1px solid #f0d9a8;font:13px/1.5 Arial,sans-serif;color:#5c4409">
      <b style="font-size:15px">${esc(hora || "--:--")}</b> &nbsp; ${esc(quem)}
      ${s.orgao ? " · " + esc(s.orgao) : ""}${onde ? " · " + esc(onde) : ""}
      ${s.portal ? `<div style="color:#8a7433;font-size:12px;margin-top:2px">${esc(s.portal)}</div>` : ""}
    </td></tr>`;
  }).join("");
  return `<div style="margin:0 22px 4px;border:1px solid #e8c96a;background:#fff8e6;border-radius:10px;overflow:hidden">
    <div style="background:#f3dea0;padding:10px 12px;font:bold 13px Arial,sans-serif;color:#5c4409">
      ⏰ HOJE TEM SESSÃO — ${sessoes.length} certame(s)</div>
    <table style="width:100%;border-collapse:collapse">${linhas}</table>
  </div>`;
}

function montaEmail(nome: string, dia: string, itens: any[], sobraram: number, resumoFiltros: string, sessoes: any[] = []) {
  const linhas = itens.map((l) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e6edf3;font:13px/1.5 Arial,sans-serif;color:#173A5E">
        <b>${esc(l.orgao || "órgão não informado")}</b>
        ${l.municipio ? ` · ${esc(l.municipio)}${l.uf ? "/" + esc(l.uf) : ""}` : ""}
        <div style="color:#4a6076;margin-top:3px">${esc(String(l.objeto || "").slice(0, 220))}</div>
        <div style="color:#7a8ea3;margin-top:4px;font-size:12px">
          ${esc(l.modalidade || "")}${l.numero_compra ? " nº " + esc(l.numero_compra) : ""} ·
          ${brl(l.valor_estimado)}
          ${l.data_abertura ? " · abre em " + esc(String(l.data_abertura).slice(8, 10) + "/" + String(l.data_abertura).slice(5, 7)) : ""}
        </div>
      </td>
    </tr>`).join("");

  return `<div style="background:#f4f7fa;padding:22px 0;font-family:Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #dfe7ee">
    <div style="background:#173A5E;padding:18px 22px">
      <div style="color:#fff;font-size:17px;font-weight:bold">FPMED · ${esc(nome)}</div>
      <div style="color:#8DC63F;font-size:13px;margin-top:3px">publicações de ${esc(dm(dia))}</div>
    </div>
    ${blocoSessoes(sessoes)}
    <div style="padding:16px 22px 6px;font:13px/1.6 Arial,sans-serif;color:#4a6076">
      <b style="color:#173A5E">${itens.length}${sobraram ? "+" : ""} nova(s)</b> no seu jornal.
      <div style="color:#7a8ea3;font-size:12px;margin-top:4px">${esc(resumoFiltros)}</div>
    </div>
    <table style="width:100%;border-collapse:collapse">${linhas}</table>
    ${sobraram ? `<div style="padding:12px 22px;font:13px Arial,sans-serif;color:#4a6076">
      e mais <b>${sobraram}</b> — abra no sistema pra ver todas.</div>` : ""}
    <div style="padding:16px 22px 22px">
      <a href="${URL_SISTEMA}" style="display:inline-block;background:#2CA9E0;color:#fff;text-decoration:none;
         padding:11px 20px;border-radius:8px;font:bold 14px Arial,sans-serif">Abrir no sistema</a>
    </div>
    <div style="padding:14px 22px;background:#f8fafc;border-top:1px solid #e6edf3;
         font:11px/1.6 Arial,sans-serif;color:#7a8ea3">
      Este boletim é do dia ${esc(dm(dia))} FECHADO — ele espera o dia terminar pra não perder o
      que sai depois do corte. A contagem vem do índice próprio da FPMED; <b>a tela é a
      autoridade</b>: ela pode mostrar um número menor, porque lá valem também os filtros finos
      (portal, modo de disputa, faixa de valor) que não cabem neste resumo.
      <br>Para deixar de receber, desmarque o envio no painel "Meus Jornais".
    </div>
  </div>
</div>`;
}

/* ══ O E-MAIL DE ALARME ══════════════════════════════════════════════════════════════════════
   ELE NÃO É UM BOLETIM MAGRO — é a explicação da ausência do boletim. Quando o índice está
   atrasado, esta função JÁ SE RECUSAVA a enviar (a regra "boletim vazio é lido como 'não teve
   nada'"), e a decisão registrada era que a AUSÊNCIA seria lida como "algo está errado".
   >>> MAS AUSÊNCIA NÃO É MENSAGEM. Ninguém repara no e-mail que não chegou — foi exatamente
       assim que 12 falhas seguidas de coleta passaram despercebidas entre 07 e 10/08. O alarme
       transforma o silêncio em aviso, e vai para as MESMAS pessoas que estavam esperando o
       boletim daquele dia. Não é um destinatário novo: é quem já ia ser servido.
   Sem números inventados: ele repete o que a linha da `coleta_status` diz, e nada além. */
function montaAlarme(v: any, st: any, dia: string) {
  /* ══ NADA DE CARIMBO CRU NESTE E-MAIL ═══════════════════════════════════════════════════════
     ACHADO NA PROVA AO VIVO DE 12/08 — e só olhando o e-mail que CHEGOU. A tabela imprimia
     `2026-08-12T15:56:08.88+00:00` no meio de um texto todo em português, e datas em ISO
     (`2026-08-08`) no mesmo e-mail que escreve `11/08/2026` duas linhas acima.
     >>> E O PIOR NÃO ERA A FEIURA, ERA O FUSO. O carimbo é UTC, e Goiás é UTC−3: quem lesse
         "15:56" concluiria que a coleta tinha rodado às 15:56 da tarde, quando foram 12:56.
         Hora sem fuso não é imprecisa, é ERRADA — e erra pra mais, bem no campo que a pessoa
         usa pra decidir se a coleta acabou de tentar ou parou de manhã.
     Por isso `hm` diz a hora de GOIÁS e escreve "(horário de Goiás)" ao lado: a única hora que
     não precisa de rótulo é a que já está no fuso de quem lê — e mesmo essa merece o rótulo
     quando o dado nasceu em UTC. */
  const hm = (iso: unknown) => {
    if (!iso) return "—";
    const d = new Date(String(iso));
    if (isNaN(+d)) return String(iso);            // veio algo que não é data: mostra cru, sem inventar
    const go = new Date(+d - 3 * 3600 * 1000);    // UTC−3, o fuso de Goiás
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(go.getUTCDate())}/${p(go.getUTCMonth() + 1)} às ${p(go.getUTCHours())}:${p(go.getUTCMinutes())}`
         + ` <span style="font-weight:400;color:#7a8ea3">(horário de Goiás)</span>`;
  };
  // data pura (`date`, sem hora) — DD/MM/AAAA, o mesmo formato do resto do e-mail
  const dia_ = (d: unknown) => (d ? dm(String(d).slice(0, 10)) : "—");
  const linha = (rot: string, val: unknown, jaEhHtml = false) =>
    `<tr><td style="padding:6px 0;font:13px Arial,sans-serif;color:#7a8ea3">${esc(rot)}</td>
         <td style="padding:6px 0;font:bold 13px Arial,sans-serif;color:#173A5E">${jaEhHtml ? val : esc(val ?? "—")}</td></tr>`;
  return `<div style="background:#f4f7fa;padding:22px 0;font-family:Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #dfe7ee">
    <div style="background:#8a2b2b;padding:18px 22px">
      <div style="color:#fff;font-size:17px;font-weight:bold">FPMED · a busca de licitações pode estar incompleta</div>
      <div style="color:#f3c9c9;font-size:13px;margin-top:3px">${esc(v.titulo)}</div>
    </div>
    <div style="padding:18px 22px 4px;font:14px/1.65 Arial,sans-serif;color:#33475b">
      ${esc(v.detalhe)}
    </div>
    <div style="padding:6px 22px 4px;font:13px/1.6 Arial,sans-serif;color:#33475b">
      <b>Por isso o boletim de ${esc(dm(dia))} não foi enviado.</b> Um boletim curto seria lido
      como "teve pouca coisa" — e o que houve foi coleta incompleta, que é outra conversa.
    </div>
    <div style="padding:10px 22px">
      <table style="width:100%;border-collapse:collapse">
        ${linha("último dia coletado por inteiro", dia_(st?.ultimo_dia_ok))}
        ${linha("última tentativa da coleta", hm(st?.ultima_tentativa), true)}
        ${linha("último erro registrado", st?.ultimo_erro)}
      </table>
    </div>
    <div style="padding:6px 22px 4px;font:13px/1.7 Arial,sans-serif;color:#33475b">
      <b>O que conferir, nesta ordem:</b><br>
      1. a coleta do PNCP rodou hoje? (GitHub → Actions → <i>Coleta PNCP</i>)<br>
      2. a edge function <code>coletar-licitacoes</code> responde?<br>
      3. o segredo <code>COLETA_TOKEN</code> ainda vale?<br>
      4. o projeto do banco está ativo (não pausado)?
    </div>
    <div style="padding:16px 22px 22px">
      <a href="${URL_SISTEMA}" style="display:inline-block;background:#2CA9E0;color:#fff;text-decoration:none;
         padding:11px 20px;border-radius:8px;font:bold 14px Arial,sans-serif">Abrir a busca mesmo assim</a>
    </div>
    <div style="padding:14px 22px;background:#f8fafc;border-top:1px solid #e6edf3;
         font:11px/1.6 Arial,sans-serif;color:#7a8ea3">
      A busca continua funcionando — ela mostra o que já foi coletado. O risco é o do que
      <b>não</b> foi: licitação publicada depois do último dia fechado pode não aparecer.
      <br>Este aviso sai no máximo uma vez por dia, no lugar do boletim que faltou.
    </div>
  </div>
</div>`;
}

Deno.serve(async (req) => {
  const J = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

  // PORTA: segredo dedicado. Sem segredo configurado a função fica FECHADA, nunca aberta —
  // "sem segredo, libera" é como endpoint de escrita vira público por esquecimento.
  if (!TOKEN) return J({ error: "BOLETIM_TOKEN nao configurado" }, 503);
  if (req.method !== "POST") return J({ error: "use POST" }, 405);
  if (req.headers.get("x-boletim-token") !== TOKEN) return J({ error: "nao autorizado" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* body é opcional */ }

  const proibido = remetenteProibido(REMETENTE);

  /* SONDA DE COMPLIANCE — `{"conferir": true}` responde QUAL DOMÍNIO está no remetente e se
     ele está barrado, SEM ler jornal, SEM montar e-mail e SEM chamar o provedor.

     >>> POR QUE ELA EXISTE. Sem ela, provar a trava ao vivo é ambíguo: se eu aponto o remetente
     pro domínio proibido e a função MESMO ASSIM envia, eu não sei se a trava falhou ou se o
     secret ainda não tinha propagado pro contêiner. Os dois casos parecem iguais de fora, e um
     deles é defeito grave enquanto o outro é só pressa minha. A sonda separa os dois antes de
     qualquer envio acontecer.
     Domínio de remetente não é segredo — é o que vai impresso no cabeçalho de todo e-mail. */
  /* A sonda responde TAMBÉM o veredito do alarme da coleta, e pela mesma razão que ela existe:
     provar sem efeito. É o único jeito de perguntar "o alarme dispararia agora?" sem colocar um
     e-mail na caixa de alguém — e um alarme que só dá pra conferir disparando é um alarme que
     ninguém confere. `motor_alarme:false` denuncia deploy feito sem a diretiva `@inline`. */
  if (body.conferir === true) {
    let st: any = null;
    try {
      const r = await fetch(`${SB_URL}/rest/v1/coleta_status?fonte=eq.PNCP&select=*`, { headers: H });
      const j = await r.json();
      if (Array.isArray(j) && j[0]) st = j[0];
    } catch { /* vira "nao sei" no veredito, que é o que o motor responde pra linha ausente */ }
    const v = ALARME ? ALARME.avaliar(st, new Date()) : null;
    return J({
      ok: true,
      remetente_dominio: dominioDe(REMETENTE) || "(sem dominio)",
      proibido: !!proibido,
      nota: proibido
        ? "BARRADO: dominio da GlobalMed no remetente da FPMED. Nenhum envio aconteceria."
        : "liberado para envio",
      motor_alarme: !!ALARME,
      alarme: ALARME ? (v || null) : "MOTOR AUSENTE — deploy sem a diretiva @inline",
      alarme_resumo: ALARME ? ALARME.resumo(v) : null,
      alarme_ultimo_email: st?.alarme_email_em || null,
      coleta: st ? { ultimo_dia_ok: st.ultimo_dia_ok, ultima_tentativa: st.ultima_tentativa,
                     ultimo_erro: st.ultimo_erro } : null,
    }, 200);
  }

  /* A TRAVA DE COMPLIANCE, ANTES DE QUALQUER TRABALHO. Ela recusa a rodada inteira em vez de
     pular o envio: pular deixaria o boletim "quase funcionando" e o motivo escondido no meio
     de um relatório de sucesso. Aqui a rodada para, ninguém marca `vistos_email`, e a mensagem
     diz o conserto — que é VERIFICAR fpmed.com.br, não trocar código. */
  if (proibido) return J({
    ok: false,
    compliance: "remetente_proibido",
    erro: "O remetente do boletim esta configurado no dominio " + proibido + ", que e da GlobalMed. "
      + "Nenhum e-mail da FPMED sai por dominio da GlobalMed - a marca de uma empresa no e-mail da "
      + "outra e o mesmo cruzamento que a regra master proibe, so que impresso no cabecalho, visivel "
      + "pro cliente. O conserto e verificar o dominio fpmed.com.br (send.fpmed.com.br) em "
      + "resend.com/domains e apontar o secret BOLETIM_REMETENTE pra la. Ate isso acontecer, "
      + "destinatario = so o dono. Nenhum e-mail foi enviado e nada foi marcado como visto.",
  }, 200);

  // `body` já foi lido lá em cima, antes da sonda e da trava — não se lê de novo aqui.

  // O DIA D-1, no fuso de Goiás (UTC-3). Em UTC, às 8h da manhã lá são 5h — e usar o dia UTC
  // faria o boletim de segunda falar de domingo em algumas madrugadas e de sábado em outras.
  const agoraGO = new Date(Date.now() - 3 * 3600 * 1000);
  const ontem = new Date(agoraGO); ontem.setUTCDate(ontem.getUTCDate() - 1);
  const dia = String(body.dia || ontem.toISOString().slice(0, 10));

  /* ══ O ESTADO DA COLETA — A LINHA INTEIRA, e não só o carimbo do dia ═════════════════════════
     Antes daqui saía só o `ultimo_dia_ok`, que responde "o índice fechou esse dia?". O alarme
     precisa de mais: `ultima_tentativa` é o que denuncia o pior caso — agendador parado, com o
     carimbo de dia CONGELADO num valor bom. Nele o índice PARECE em dia porque ninguém está
     olhando pra ele. */
  let statusColeta: any = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/coleta_status?fonte=eq.PNCP&select=*`, { headers: H });
    const j = await r.json();
    if (Array.isArray(j) && j[0]) statusColeta = j[0];
  } catch { /* trata como não sabido */ }
  const ultimoDiaOk: string | null = statusColeta?.ultimo_dia_ok
    ? String(statusColeta.ultimo_dia_ok).slice(0, 10) : null;

  /* O veredito vem do motor colado no topo — o MESMO que o sino do Negócios lê.
     Sem motor (deploy feito sem a diretiva `@inline`) a resposta DIZ isso: função que perde uma
     capacidade em silêncio é a que faz alguém confiar num alarme que não existe mais. */
  const alarme = ALARME ? ALARME.avaliar(statusColeta, new Date()) : null;

  /* ══ AS SESSÕES DE HOJE ═════════════════════════════════════════════════════════════════════
     "HOJE tem sessão: Pregão 19/2026, Prefeitura X, às 09:00" — é o aviso que muda o dia de
     alguém, e por isso vai no TOPO do boletim, antes das licitações novas.
     >>> ELE VEM DE `negocios.abertura`, o mesmo lugar de onde o sino lê. Não há tabela de
         "lembrete de sessão": a abertura é FATO, e fato se lê de onde já está — se a data for
         adiada na ficha, o e-mail de amanhã já sai com a nova, sem ninguém sincronizar nada.
     >>> DIA DE GOIÁS, não UTC: às 5h da manhã lá são 8h UTC, e usar o dia UTC faria o "hoje" do
         e-mail ser o dia certo por acaso e o errado nas madrugadas de virada. */
  // `sessoesDe` existe pra PROVAR o bloco num dia que tenha sessão — num dia sem nenhuma, o
  // caminho nunca roda e "não quebrou" não é o mesmo que "funciona". Em produção fica ausente e
  // vale o dia de hoje.
  const hojeGO = String(body.sessoesDe || new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10));
  let sessoes: any[] = [];
  try {
    const rs = await fetch(`${SB_URL}/rest/v1/negocios`
      + `?select=id,titulo,orgao,municipio,uf,portal,numero,modalidade,abertura,estagio`
      + `&arquivado=is.false&abertura=gte.${hojeGO}T00:00:00&abertura=lte.${hojeGO}T23:59:59`
      + `&order=abertura.asc`, { headers: H });
    if (rs.ok) sessoes = await rs.json();
  } catch { /* sem sessões conhecidas: o boletim segue sem o bloco */ }

  const rj = await fetch(`${SB_URL}/rest/v1/jornais?enviar_email=eq.true&select=*`, { headers: H });
  if (!rj.ok) return J({ ok: false, erro: "nao consegui ler os jornais: HTTP " + rj.status }, 200);
  const jornais = await rj.json();
  // `chaveConfigurada` vai TAMBÉM na saída curta (10/08): sem isso, o único jeito de saber se o
  // provedor já está ligado era assinar um jornal — ou seja, mexer no dado de alguém só pra
  // conferir configuração. Estado tem que ser observável sem efeito colateral.
  if (!Array.isArray(jornais) || !jornais.length) {
    return J({ ok: true, dia, jornais: 0, enviados: 0, chaveConfigurada: !!RESEND,
      nota: "nenhum jornal assinado — marque '📧 e-mail' num jornal na tela de Licitações" });
  }

  // e-mails dos donos, do auth (e não de uma cópia que envelhece na tabela)
  const donos = new Map<string, string>();
  try {
    const ru = await fetch(`${SB_URL}/auth/v1/admin/users?per_page=200`, { headers: H });
    const ju = await ru.json();
    for (const u of (ju.users || ju || [])) if (u?.id && u?.email) donos.set(u.id, u.email);
  } catch { /* sem isso, só valem os email_destino explícitos */ }

  /* ══ O ALARME DA COLETA — ANTES DO BOLETIM, E NO LUGAR DELE ═════════════════════════════════
     Com a coleta parada, o boletim de hoje seria mentira: ele contaria "as novidades do dia" a
     partir de um índice que não recebeu o dia. Então a ordem é esta — primeiro o aviso, e o
     boletim não sai.
     >>> DESTINATÁRIO: os MESMOS assinantes do boletim, e ninguém a mais. Não é um canal novo,
         é o canal que já existia dizendo por que não veio o de sempre. E a trava de compliance
         do remetente já rodou lá em cima: alarme não é motivo pra furar a regra do domínio.
     >>> UMA VEZ POR DIA. Esta função roda 2× (o cron das 08:17 e a rede das 11:23), e o mesmo
         aviso duas vezes na mesma manhã ensina a ignorar os dois. A trava é o carimbo
         `alarme_email_em`, com 20h — ver o ddl/alarme_coleta_email.sql. */
  if (alarme && !body.forcar) {
    const HORAS_ENTRE_AVISOS = 20;
    const ultimo = statusColeta?.alarme_email_em ? new Date(statusColeta.alarme_email_em) : null;
    const horasDesde = ultimo && !isNaN(+ultimo) ? (Date.now() - +ultimo) / 36e5 : Infinity;
    const base = { ok: false, dia, ultimoDiaOk, enviados: 0,
                   alarme: { nivel: alarme.nivel, titulo: alarme.titulo, detalhe: alarme.detalhe },
                   erro: ALARME.resumo(alarme) + " — boletim NAO enviado de proposito" };

    if (horasDesde < HORAS_ENTRE_AVISOS) {
      return J({ ...base, alarmeEnviado: 0,
        nota: "alarme ja avisado ha " + Math.round(horasDesde) + "h; o proximo sai depois de "
            + HORAS_ENTRE_AVISOS + "h (esta funcao roda 2x por dia)" });
    }
    if (!RESEND) return J({ ...base, alarmeEnviado: 0, chaveConfigurada: false,
      nota: "RESEND_API_KEY nao configurada — o alarme nao foi enviado e NADA foi carimbado" });

    // um destino por pessoa: dois jornais do mesmo dono não viram dois e-mails do mesmo aviso
    const destinos = [...new Set(jornais
      .map((j: any) => body.teste || j.email_destino || donos.get(j.usuario))
      .filter(Boolean))] as string[];
    if (!destinos.length) return J({ ...base, alarmeEnviado: 0,
      nota: "sem destinatario conhecido — ninguem foi avisado" });

    let avisados = 0; const falhas: string[] = [];
    for (const para of destinos) {
      const re = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
        body: JSON.stringify({ from: REMETENTE, to: [para],
          subject: "FPMED · " + ALARME.resumo(alarme), html: montaAlarme(alarme, statusColeta, dia) }),
      });
      if (re.status >= 200 && re.status < 300) avisados++;
      else falhas.push(para + ": HTTP " + re.status + " " + (await re.text()).slice(0, 120));
    }

    /* SÓ CARIMBA SE ALGUÉM FOI AVISADO. Carimbar antes faria a trava de 20h calar o aviso de
       amanhã por causa de uma tentativa que não chegou a ninguém — o silêncio de novo. */
    if (avisados) {
      await fetch(`${SB_URL}/rest/v1/coleta_status?fonte=eq.PNCP`, {
        method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
        body: JSON.stringify({ alarme_email_em: new Date().toISOString() }),
      }).catch(() => {});
    }
    return J({ ...base, alarmeEnviado: avisados, alarmeFalhas: falhas });
  }

  // >>> O ÍNDICE FECHOU ESSE DIA? Se não fechou, o boletim NÃO SAI. Um boletim curto é lido
  //     como "teve pouca coisa"; o que houve foi coleta incompleta, que é outra conversa.
  //     >>> ESTE CAMINHO SOBROU PRA FAIXA DE TOLERÂNCIA DO ALARME: um único dia de atraso não
  //         alarma (a volta leva algumas rodadas), mas também não rende boletim honesto.
  //         Silêncio de um dia é aceitável; de dois em diante o bloco acima manda o aviso.
  if (!body.forcar && (!ultimoDiaOk || ultimoDiaOk < dia)) {
    return J({ ok: false, dia, ultimoDiaOk, enviados: 0, motorAlarme: !!ALARME,
      erro: "o indice ainda nao fechou o dia " + dia + " — boletim NAO enviado de proposito" });
  }

  let enviados = 0, pulados = 0, semChave = 0;
  const detalhe: any[] = [];

  for (const j of jornais) {
    const f = j.filtros || {};
    const destino = j.email_destino || donos.get(j.usuario) || null;
    if (!destino) { pulados++; detalhe.push({ jornal: j.nome, motivo: "sem e-mail de destino" }); continue; }

    // consulta do dia D-1 com os filtros que EXISTEM como coluna
    let q = `${SB_URL}/rest/v1/licitacoes?select=numero_controle,orgao,municipio,uf,objeto,modalidade,`
      + `numero_compra,valor_estimado,data_abertura&data_publicacao=eq.${dia}&order=valor_estimado.desc&limit=400`;
    if (f.uf) q += `&uf=eq.${encodeURIComponent(f.uf)}`;
    if (f.mod) q += `&modalidade_cod=eq.${encodeURIComponent(f.mod)}`;
    const rl = await fetch(q, { headers: H });
    if (!rl.ok) { pulados++; detalhe.push({ jornal: j.nome, motivo: "consulta HTTP " + rl.status }); continue; }
    let linhas = await rl.json();

    // palavra-chave e exclusão, com a MESMA normalização sem acento da tela
    const kws = String(f.kw || "").split(/[,;\n]/).map((s: string) => semAcento(s).trim()).filter(Boolean);
    const excl = String(f.excluir || "").split(/[,;\n]/).map((s: string) => semAcento(s).trim()).filter(Boolean);
    const texto = (l: any) => semAcento([l.objeto, l.orgao, l.municipio].filter(Boolean).join(" "));
    if (kws.length) linhas = linhas.filter((l: any) => kws.some((k: string) => texto(l).includes(k)));
    if (excl.length) linhas = linhas.filter((l: any) => !excl.some((k: string) => texto(l).includes(k)));

    // O DELTA DO E-MAIL, com memória PRÓPRIA (ver o comentário do ddl/boletim.sql)
    const vistos: string[] = Array.isArray(j.vistos_email) ? j.vistos_email : [];
    const jaVi = new Set(vistos);
    const novas = linhas.filter((l: any) => l.numero_controle && !jaVi.has(l.numero_controle));

    // NADA NOVO NÃO VIRA E-MAIL. Boletim que chega vazio todo dia deixa de ser aberto, e no dia
    // em que tiver algo dentro já vai estar sendo ignorado junto com os outros.
    // >>> MAS SESSÃO DE HOJE MANDA O E-MAIL SAIR. Antes desta linha, um dia sem licitação nova
    //     engolia o aviso de que HAVIA SESSÃO HOJE — o item mais urgente do sistema morrendo por
    //     causa de uma regra que existia pra outro assunto.
    if (!novas.length && !sessoes.length) { pulados++; detalhe.push({ jornal: j.nome, motivo: "nada novo" }); continue; }

    if (!RESEND) {
      semChave++;
      detalhe.push({ jornal: j.nome, novas: novas.length, motivo: "RESEND_API_KEY nao configurada" });
      continue;   // >>> NÃO marca `vistos_email`: no dia em que a chave entrar, nada foi perdido
    }

    const mostrar = novas.slice(0, TETO_LINHAS);
    const html = montaEmail(j.nome, dia, mostrar, Math.max(0, novas.length - mostrar.length),
      [f.kw ? "palavras: " + f.kw : "", f.uf ? "UF " + f.uf : "", f.mod ? "modalidade " + f.mod : ""]
        .filter(Boolean).join(" · ") || "sem filtro de palavra", sessoes);

    const re = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: REMETENTE,
        to: [body.teste || destino],
        // O ASSUNTO LIDERA COM A SESSÃO quando há uma: é o que a pessoa precisa saber olhando a
        // lista de e-mails, sem abrir. "3 novas em Medicamentos GO" não faz ninguém correr.
        subject: sessoes.length
          ? `FPMED · HOJE tem sessão (${sessoes.length}) — ${dm(dia)}`
          : `FPMED · ${novas.length} nova(s) em "${j.nome}" — ${dm(dia)}`,
        html,
      }),
    });
    const txtRe = await re.text();
    const deuCerto = re.status >= 200 && re.status < 300;

    /* ══ O 403 DE CONTA EM MODO DE TESTE, TRADUZIDO ═════════════════════════════════════════
       MEDIDO em 10/08: com a conta do Resend recem-criada e SEM DOMINIO VERIFICADO, ele so
       aceita enviar para o e-mail dono da conta. Todo destinatario diferente volta 403
       `validation_error`. Guardar o texto cru faria alguem, daqui a um mes, ler
       "You can only send testing emails to your own email address" na tela e nao entender que
       o conserto e VERIFICAR O DOMINIO — nao trocar a chave nem mexer no codigo.
       O erro do provedor continua no fim da mensagem: traduzir nao pode ser esconder. */
    let erroLegivel = "HTTP " + re.status + " " + txtRe.slice(0, 200);
    if (re.status === 403 && /only send testing emails/i.test(txtRe)) {
      const dono = (txtRe.match(/\(([^)]+@[^)]+)\)/) || [])[1] || "o e-mail dono da conta";
      erroLegivel = "A conta do Resend ainda esta em modo de teste: ela so entrega para " + dono
        + ". Para mandar o boletim para a equipe, verifique o dominio fpmed.com.br em "
        + "resend.com/domains e troque o remetente (secret BOLETIM_REMETENTE). [" + txtRe.slice(0, 120) + "]";
    }

    // >>> SÓ MARCA COMO VISTO SE O ENVIO DEU CERTO. Marcar antes faria a licitação sumir do
    //     próximo boletim sem nunca ter chegado a ninguém — perda silenciosa.
    const patch: Record<string, unknown> = {
      ultimo_envio: new Date().toISOString(),
      ultimo_envio_qtd: deuCerto ? novas.length : null,
      ultimo_envio_erro: deuCerto ? null : erroLegivel.slice(0, 400),
    };
    if (deuCerto && !body.teste) {
      patch.vistos_email = vistos.concat(novas.map((l: any) => l.numero_controle)).slice(-TETO_VISTOS);
    }
    await fetch(`${SB_URL}/rest/v1/jornais?id=eq.${j.id}`, {
      method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(patch),
    }).catch(() => {});

    if (deuCerto) { enviados++; detalhe.push({ jornal: j.nome, novas: novas.length, para: body.teste || destino }); }
    else { pulados++; detalhe.push({ jornal: j.nome, motivo: erroLegivel.slice(0, 300) }); }
  }

  return J({
    ok: true, dia, ultimoDiaOk,
    jornais: jornais.length, enviados, pulados, semChave,
    chaveConfigurada: !!RESEND,
    detalhe,
  });
});
