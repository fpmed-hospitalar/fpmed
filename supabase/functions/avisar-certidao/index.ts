// ============================================================================================
// Supabase Edge Function: avisar-certidao   (FPMED — fatia B27, 20/08/2026)
//
// O QUE ELA RESOLVE: o cofre de certidões já sabe dizer, na tela, quem está vencido e quem está
// vencendo. Só que ele diz isso para quem ABRE a tela. Certidão vence sozinha, no fim de semana,
// enquanto ninguém está olhando — e o dia em que ela importa é o dia da sessão, quando já é
// tarde. Esta função leva o aviso até a pessoa.
//
// ══ ELA NÃO DISPARA SOZINHA, E ISSO É DECISÃO DA CAIXA ═══════════════════════════════════════
// Nesta fatia existe UM caminho: o botão "enviar um aviso de teste para mim agora". Não há cron,
// não há agendador, não há `verify_jwt=false` com token de robô. Mandar e-mail sozinho, sem o
// dono ter visto um, é exatamente o tipo de automação que não se liga sem ele ver primeiro — e
// quando ligar, ele já vai saber como o e-mail é, porque terá recebido um.
// >>> POR ISSO `automatico` NÃO EXISTE COMO PARÂMETRO. Um parâmetro que hoje é sempre `false` é
//     um interruptor esperando alguém encostar. Quando a fatia do disparo chegar, ela entra com
//     agendador e trava própria — e não descomentando uma linha aqui.
//
// ══ QUEM ABRE A PORTA É A SESSÃO DA PESSOA, E NÃO UM SEGREDO NA PÁGINA ══════════════════════
// As outras funções desta casa (`coletar-licitacoes`, `enviar-boletim`) são chamadas por ROBÔ, e
// por isso usam um segredo dedicado no cabeçalho. Esta é chamada pelo NAVEGADOR de uma pessoa
// logada — e um segredo dedicado teria de viver dentro do `fpmed_documentos.html`, que está num
// repositório público. Ou seja: a porta ficaria escancarada com aparência de fechada.
//   O crachá aqui é o JWT da sessão, validado no `/auth/v1/user` pelo próprio Supabase. Depois de
//   validado, o cargo é lido das claims (`app_metadata.role`) — a MESMA fonte que a função
//   `public.jwt_cargo()` do banco lê para decidir a RLS. Duas leituras da mesma verdade, e não
//   duas verdades.
// >>> E A LISTA DE DOCUMENTOS É LIDA COM O TOKEN DA PESSOA, NÃO COM A `service_role`. Esta função
//     NÃO recebe a service_role em lugar nenhum: se a RLS do cofre estivesse errada, a leitura
//     falharia aqui — em vez de a função passar por cima dela e o defeito continuar invisível.
//     É a lição da B16, onde uma prova com service_role atestou "funciona" por dias com o botão
//     Anexar quebrado.
//
// ══ O QUE VAI NO E-MAIL, E O QUE NUNCA VAI ═══════════════════════════════════════════════════
// Vai: nome do documento, tipo, órgão emissor, número e data de validade. Nada mais.
// NÃO vai: o arquivo (nem anexo, nem link), o CNPJ da empresa, observação, nem o caminho no
// cofre. Vale a REGRA DE PRIVACIDADE do `docs/TELEMETRIA.md` — "nunca envie dado de certidão,
// conteúdo de documento anexado" — e aqui ela se aplica com um ajuste honesto: o aviso é INÚTIL
// sem dizer QUAL certidão está vencendo, então o identificador vai e o conteúdo não.
// >>> DOCUMENTO SEM VALIDADE NÃO ENTRA. Ele não está vencendo, está SEM DATA — e um aviso que
//     diz "sua certidão está para vencer" sobre um contrato social que não vence é a maneira de
//     ensinar alguém a ignorar os avisos verdadeiros. Quem conta essa história é o painel da
//     tela, que tem o contador próprio "sem validade informada"; o e-mail cala sobre eles.
//     Quem decide isso é a view `v_documentos_avisar` — uma definição só de "vencendo", no banco.
//
// CONTRATO:
//   POST /functions/v1/avisar-certidao
//   headers: Authorization: Bearer <JWT da sessão>   ·   apikey: <anon>
//   body: { "conferir": true }             -> estado, SEM enviar nada
//         { "teste": true, "para": "..." } -> manda UM e-mail (para = o da sessão, se omitido)
//   resposta: { ok, id, para, documentos, erro }
// ============================================================================================

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY");
// O MESMO secret do boletim, de propósito: o remetente da FPMED é um só. Dois secrets seriam dois
// endereços para a mesma empresa, e o dia em que um fosse corrigido o outro continuaria errado.
const REMETENTE = Deno.env.get("BOLETIM_REMETENTE") || "FPMED <onboarding@resend.dev>";
const URL_SISTEMA = "https://fpmed-hospitalar.github.io/fpmed/fpmed_documentos.html";

/* ══ A TRAVA DE COMPLIANCE DO REMETENTE — A MESMA REGRA DO BOLETIM ═══════════════════════════
   REGRA MASTER (COMPLIANCE.md): nenhum e-mail da FPMED sai por domínio da GlobalMed. Marca de
   uma empresa no e-mail da outra é o mesmo cruzamento que a regra proíbe, só que impresso no
   cabeçalho e visível para quem recebe.
   >>> MEDIDO HOJE, 20/08, com a chave da própria FPMED: o ÚNICO domínio verificado na conta do
       Resend continua sendo o `globalmedgo.com.br`. Ou seja, a armadilha que a `enviar-boletim`
       nomeou em 11/08 continua armada — e agora com uma porta a mais para ela. Quem for "fazer o
       aviso de certidão chegar na equipe" vai encontrar, de primeira, a solução proibida: ela
       funciona, o e-mail chega bonito, e ninguém percebe.
   >>> POR QUE A LISTA ESTÁ ESCRITA AQUI E NÃO IMPORTADA DE UM ARQUIVO SÓ: a Management API sobe
       UM arquivo por função, e o mecanismo `@inline` do `tools/deploy_edge.js` cola um `.js` do
       repositório. Usá-lo aqui obrigaria a mexer na `enviar-boletim` (que não é do meu
       território) para as duas passarem a ler a mesma cópia. Então a segunda cópia existe — e
       ela NÃO é deixada solta: a `tests/testa_aviso_certidao.js` arranca as DUAS listas dos DOIS
       arquivos e reprova se elas divergirem em um caractere. Cópia vigiada não é fonte dupla de
       verdade; é uma fonte com um cão de guarda. A dívida (unificar via `@inline`) está no
       relatório, com o motivo. */
const DOMINIOS_PROIBIDOS = ["globalmedgo.com.br", "globalmed.com.br"];
const dominioDe = (rem: string) => (rem.match(/@([^>\s]+)/) || [])[1]?.toLowerCase() || "";
function remetenteProibido(rem: string) {
  const d = dominioDe(rem);
  return DOMINIOS_PROIBIDOS.some((p) => d === p || d.endsWith("." + p)) ? d : null;
}

const CARGOS_GESTOR = ["diretor", "gerente", "admin"];

const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));

const dm = (iso: unknown) => {
  const s = String(iso || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4) : "—";
};

/* ══ O E-MAIL ═══════════════════════════════════════════════════════════════════════════════
   HTML de tabela com estilo INLINE, sem `<style>`, sem imagem externa e sem rastreador — a mesma
   forma do boletim, e pela mesma razão: cliente de e-mail corta folha de estilo e bloqueia imagem
   por padrão, e um aviso que chega quebrado uma vez deixa de ser lido para sempre.
   >>> A ORDEM É VENCIDO PRIMEIRO. Vencido não é "vencendo com mais urgência": é outro estado, e
       é o único que já custou a habilitação. Ordenar por dias faz o vencido de 9 dias aparecer
       depois do que vence amanhã, e a linha mais grave do e-mail some no meio da lista. */
function montaEmail(docs: any[], ehTeste: boolean) {
  const vencidos = docs.filter((d) => d.situacao === "vencido");
  const vencendo = docs.filter((d) => d.situacao === "vencendo");

  const linha = (d: any) => {
    const grave = d.situacao === "vencido";
    const dias = Number(d.dias_para_vencer);
    const quando = grave
      ? `venceu em <b>${esc(dm(d.validade))}</b> — há ${isFinite(dias) ? Math.abs(dias) : "?"} dia(s)`
      : `vence em <b>${esc(dm(d.validade))}</b> — em ${isFinite(dias) ? dias : "?"} dia(s)`;
    const sub = [d.tipo, d.orgao_emissor, d.numero ? "nº " + d.numero : null].filter(Boolean).map(esc).join(" · ");
    return `<tr><td style="padding:11px 14px;border-bottom:1px solid #e6edf3;font:13px/1.55 Arial,sans-serif;color:#173A5E;
        border-left:4px solid ${grave ? "#c0392b" : "#e0a04a"}">
      <b style="font-size:14px">${esc(d.nome)}</b>${Number(d.versao) > 1 ? ` <span style="color:#7a8ea3;font-weight:400">(versão ${esc(d.versao)})</span>` : ""}
      ${sub ? `<div style="color:#4a6076;margin-top:3px">${sub}</div>` : ""}
      <div style="color:${grave ? "#c0392b" : "#8a6d1f"};margin-top:4px">${quando}</div>
    </td></tr>`;
  };

  const bloco = (titulo: string, lista: any[], cor: string) => !lista.length ? "" : `
    <div style="padding:14px 22px 4px;font:bold 13px Arial,sans-serif;color:${cor}">${esc(titulo)}</div>
    <table style="width:100%;border-collapse:collapse">${lista.map(linha).join("")}</table>`;

  return `<div style="background:#f4f7fa;padding:22px 0;font-family:Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #dfe7ee">
    <div style="background:#173A5E;padding:18px 22px">
      <div style="color:#fff;font-size:17px;font-weight:bold">FPMED · documentos de habilitação</div>
      <div style="color:#8DC63F;font-size:13px;margin-top:3px">${
        docs.length ? `${docs.length} documento(s) pedindo atenção` : "nenhum documento vencendo hoje"}</div>
    </div>
    ${ehTeste ? `<div style="margin:16px 22px 0;padding:10px 12px;background:#fff8e6;border:1px solid #e8c96a;
        border-radius:8px;font:13px/1.5 Arial,sans-serif;color:#5c4409">
      <b>Este é um aviso de TESTE</b>, pedido por alguém no botão da tela de Documentos. O envio
      automático ainda não está ligado — este e-mail existe para o senhor ver como ele é antes de
      alguém decidir ligá-lo.</div>` : ""}
    ${bloco("JÁ VENCIDOS — desclassificam na sessão de hoje", vencidos, "#c0392b")}
    ${bloco("VENCENDO — dentro da antecedência de aviso de cada um", vencendo, "#8a6d1f")}
    ${!docs.length ? `<div style="padding:18px 22px;font:14px/1.6 Arial,sans-serif;color:#33475b">
      Nenhuma certidão está vencida ou dentro do prazo de aviso agora. Este e-mail saiu porque
      alguém pediu o teste — o aviso de verdade só existe quando há o que avisar.</div>` : ""}
    <div style="padding:16px 22px 22px">
      <a href="${URL_SISTEMA}" style="display:inline-block;background:#2CA9E0;color:#fff;text-decoration:none;
         padding:11px 20px;border-radius:8px;font:bold 14px Arial,sans-serif">Abrir o cofre de documentos</a>
    </div>
    <div style="padding:14px 22px;background:#f8fafc;border-top:1px solid #e6edf3;
         font:11px/1.6 Arial,sans-serif;color:#7a8ea3">
      Cada documento tem a <b>própria antecedência de aviso</b> — certidão federal sai em minutos,
      alvará da vigilância leva semanas, e avisar os dois com a mesma antecedência trata como
      iguais coisas que não são. Este aviso não carrega arquivo, anexo nem CNPJ: ele diz qual
      documento e até quando, e o resto está no cofre.
      <br><b>A tela é a autoridade</b> — ela mostra também os documentos sem data de validade, que
      não entram neste aviso porque não estão vencendo: estão sem data, e é outra conversa.
    </div>
  </div>
</div>`;
}

Deno.serve(async (req) => {
  const J = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), {
      status,
      headers: {
        "Content-Type": "application/json",
        // Chamada de NAVEGADOR: sem estes cabeçalhos o `fetch` da tela morre no preflight e a
        // pessoa vê "não consegui" sem nenhuma causa. A porta continua fechada — quem autoriza é
        // o JWT, não a origem; CORS não é autenticação e não está fazendo esse papel aqui.
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });

  if (req.method === "OPTIONS") return J({ ok: true });
  if (req.method !== "POST") return J({ error: "use POST" }, 405);

  // ── 1. QUEM ESTÁ CHAMANDO ────────────────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization") || "";
  const tk = auth.replace(/^Bearer\s+/i, "").trim();
  if (!tk) return J({ ok: false, erro: "sem sessão — recarregue a página e entre de novo" }, 401);

  const ru = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: "Bearer " + tk },
  });
  if (!ru.ok) {
    return J({ ok: false, erro: "sua sessão expirou — recarregue a página e entre de novo" }, 401);
  }
  const user = await ru.json();
  const emailDaSessao = String(user?.email || "");
  const cargo = String(user?.app_metadata?.role || "vendedor").toLowerCase();
  const ehGestor = CARGOS_GESTOR.includes(cargo);

  let body: any = {};
  try { body = await req.json(); } catch { /* body é opcional */ }

  const proibido = remetenteProibido(REMETENTE);

  /* ── 2. A SONDA — responde o ESTADO sem colocar e-mail na caixa de ninguém ────────────────
     Mesma razão da sonda da `enviar-boletim`, e ela se provou lá: sem isto, a única maneira de
     saber se a chave está configurada e se o remetente está liberado é MANDANDO um e-mail. Uma
     configuração que só se confere disparando é uma configuração que ninguém confere.
     >>> ELA RESPONDE ATÉ PARA QUEM NÃO É GESTOR, de propósito: saber que "só gestor envia" não é
         segredo — é o que a tela precisa para desabilitar o botão em vez de deixar a pessoa
         clicar e levar um 403 sem explicação. */
  if (body.conferir === true) {
    return J({
      ok: true,
      email_da_sessao: emailDaSessao,
      cargo, gestor: ehGestor,
      chave_configurada: !!RESEND,
      remetente_dominio: dominioDe(REMETENTE) || "(sem dominio)",
      proibido: !!proibido,
      nota: proibido
        ? "BARRADO: dominio da GlobalMed no remetente da FPMED. Nenhum envio aconteceria."
        : (RESEND ? "liberado para envio" : "sem RESEND_API_KEY — nada seria enviado"),
      automatico: false,
      nota_automatico: "o disparo automatico NAO esta ligado nesta fatia; so o botao de teste envia",
    });
  }

  // ── 3. SÓ GESTOR ENVIA ───────────────────────────────────────────────────────────────────
  // Mesma simetria da tabela `documentos` (a policy exige `cargo_gestor()`): quem responde pela
  // empresa é quem manda e-mail em nome dela.
  if (!ehGestor) {
    return J({ ok: false, erro: "só gestor pode enviar o aviso — entre com uma conta de diretor ou gerente", cargo }, 403);
  }

  /* ── 4. A TRAVA DE COMPLIANCE, ANTES DE QUALQUER TRABALHO ─────────────────────────────────
     Ela recusa a chamada inteira em vez de "pular o envio": pular deixaria o aviso quase
     funcionando com o motivo escondido dentro de uma resposta de sucesso. */
  if (proibido) {
    return J({
      ok: false,
      compliance: "remetente_proibido",
      erro: "O remetente esta configurado no dominio " + proibido + ", que e da GlobalMed. Nenhum e-mail "
        + "da FPMED sai por dominio da GlobalMed. O conserto e verificar o dominio fpmed.com.br em "
        + "resend.com/domains e apontar o secret BOLETIM_REMETENTE pra la. Nenhum e-mail foi enviado.",
    });
  }

  if (body.teste !== true) {
    return J({
      ok: false,
      erro: "esta funcao so tem um caminho nesta fatia: o aviso de TESTE, pedido pelo botao da tela "
        + "({\"teste\": true}). O disparo automatico ainda nao existe — e nao existe de proposito.",
    }, 400);
  }

  /* ── 5. OS DOCUMENTOS — LIDOS COM O CRACHÁ DA PESSOA ──────────────────────────────────────
     `v_documentos_avisar` é a definição única de "vencendo" (ddl/documentos_arquivo.sql). Se esta
     função montasse a própria consulta, existiriam duas respostas para a mesma pergunta e a tela
     e o e-mail poderiam discordar sobre o mesmo cofre. E ela é `security_invoker`: quem lê é a
     pessoa, com a RLS dela — a service_role não aparece nesta função em lugar nenhum. */
  const rd = await fetch(
    `${SB_URL}/rest/v1/v_documentos_avisar?select=*&order=situacao.asc,validade.asc`,
    { headers: { apikey: ANON, Authorization: "Bearer " + tk } },
  );
  if (!rd.ok) {
    return J({ ok: false, erro: "nao consegui ler os documentos: HTTP " + rd.status + " " + (await rd.text()).slice(0, 140) });
  }
  const docs = await rd.json();

  // ── 6. PARA QUEM ─────────────────────────────────────────────────────────────────────────
  // Padrão: o e-mail da própria sessão ("para mim agora"). O campo da tela pode trocar — é um
  // gestor desta empresa decidindo para onde vai o aviso DELA, que é exatamente quem pode.
  const para = String(body.para || emailDaSessao || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) {
    return J({ ok: false, erro: "endereco de destino invalido: " + (para || "(vazio)") }, 400);
  }
  if (!RESEND) {
    return J({
      ok: false, chave_configurada: false, documentos: docs.length,
      erro: "RESEND_API_KEY nao esta configurada no projeto — NADA foi enviado e nada foi marcado. "
        + "Este e o estado esperado ate alguem colar a chave em Edge Function Secrets.",
    });
  }

  const assunto = docs.length
    ? `FPMED · ${docs.length} documento(s) de habilitacao pedindo atencao`
    : "FPMED · aviso de teste do cofre de documentos";

  const re = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
    body: JSON.stringify({ from: REMETENTE, to: [para], subject: assunto, html: montaEmail(docs, true) }),
  });
  const txt = await re.text();
  let json: any = null; try { json = JSON.parse(txt); } catch { /* resposta não-JSON vira texto cru */ }

  if (re.status < 200 || re.status >= 300) {
    /* ══ O 403 DE CONTA EM MODO DE TESTE, TRADUZIDO — E A TRADUÇÃO NÃO ESCONDE ═════════════
       A mesma tradução que a `enviar-boletim` já faz, porque é a mesma conta e o mesmo 403.
       Guardar o texto cru faria alguém ler "You can only send testing emails to your own email
       address" e concluir que a chave está errada — quando o conserto é VERIFICAR O DOMÍNIO.
       O erro do provedor continua no fim da mensagem: traduzir não pode ser esconder. */
    let erro = "HTTP " + re.status + " " + txt.slice(0, 200);
    if (re.status === 403 && /only send testing emails/i.test(txt)) {
      const dono = (txt.match(/\(([^)]+@[^)]+)\)/) || [])[1] || "o e-mail dono da conta";
      erro = "A conta do Resend ainda esta em modo de teste: ela so entrega para " + dono
        + ". Para o aviso chegar na equipe, verifique o dominio fpmed.com.br em resend.com/domains "
        + "e troque o remetente (secret BOLETIM_REMETENTE). [" + txt.slice(0, 120) + "]";
    }
    return J({ ok: false, para, documentos: docs.length, erro });
  }

  // O `id` do Resend é a prova de que o e-mail existiu do lado de lá — é ele que se consulta
  // depois (`GET /emails/<id>`) para saber se foi entregue. Devolvê-lo para a tela é o que permite
  // a pessoa dizer "não chegou" e alguém ter o que rastrear.
  return J({
    ok: true,
    id: json?.id || null,
    para,
    documentos: docs.length,
    vencidos: docs.filter((d: any) => d.situacao === "vencido").length,
    vencendo: docs.filter((d: any) => d.situacao === "vencendo").length,
    remetente_dominio: dominioDe(REMETENTE),
  });
});
