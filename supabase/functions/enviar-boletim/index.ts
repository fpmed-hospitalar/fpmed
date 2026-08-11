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

Deno.serve(async (req) => {
  const J = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

  // PORTA: segredo dedicado. Sem segredo configurado a função fica FECHADA, nunca aberta —
  // "sem segredo, libera" é como endpoint de escrita vira público por esquecimento.
  if (!TOKEN) return J({ error: "BOLETIM_TOKEN nao configurado" }, 503);
  if (req.method !== "POST") return J({ error: "use POST" }, 405);
  if (req.headers.get("x-boletim-token") !== TOKEN) return J({ error: "nao autorizado" }, 401);

  /* A TRAVA DE COMPLIANCE, ANTES DE QUALQUER TRABALHO. Ela recusa a rodada inteira em vez de
     pular o envio: pular deixaria o boletim "quase funcionando" e o motivo escondido no meio
     de um relatório de sucesso. Aqui a rodada para, ninguém marca `vistos_email`, e a mensagem
     diz o conserto — que é VERIFICAR fpmed.com.br, não trocar código. */
  const proibido = remetenteProibido(REMETENTE);
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

  let body: any = {};
  try { body = await req.json(); } catch { /* body é opcional */ }

  // O DIA D-1, no fuso de Goiás (UTC-3). Em UTC, às 8h da manhã lá são 5h — e usar o dia UTC
  // faria o boletim de segunda falar de domingo em algumas madrugadas e de sábado em outras.
  const agoraGO = new Date(Date.now() - 3 * 3600 * 1000);
  const ontem = new Date(agoraGO); ontem.setUTCDate(ontem.getUTCDate() - 1);
  const dia = String(body.dia || ontem.toISOString().slice(0, 10));

  // >>> O ÍNDICE FECHOU ESSE DIA? Se não fechou, o boletim NÃO SAI. Um boletim curto é lido
  //     como "teve pouca coisa"; o que houve foi coleta incompleta, que é outra conversa.
  let ultimoDiaOk: string | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/coleta_status?fonte=eq.PNCP&select=ultimo_dia_ok`, { headers: H });
    const j = await r.json();
    if (Array.isArray(j) && j[0]?.ultimo_dia_ok) ultimoDiaOk = String(j[0].ultimo_dia_ok).slice(0, 10);
  } catch { /* trata como não sabido */ }
  if (!body.forcar && (!ultimoDiaOk || ultimoDiaOk < dia)) {
    return J({ ok: false, dia, ultimoDiaOk, enviados: 0,
      erro: "o indice ainda nao fechou o dia " + dia + " — boletim NAO enviado de proposito" });
  }

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
