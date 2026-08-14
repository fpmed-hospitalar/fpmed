/* ══════════════════════════════════════════════════════════════════════════════════════════
   valida_controle_pncp.js — O NÚMERO DO PNCP INFORMADO À MÃO (fatia A19, 14/08/2026)

   ══ DE ONDE VEM ESTA FATIA ═════════════════════════════════════════════════════════════════
   As 105 Atas do funil vieram do "Calendário 2025" — uma planilha —, e nenhuma tem a chave do
   PNCP. Sem chave não há o que pedir ao portal: o PNCP responde por número de controle.
   Medido em 14/08 (fatia A14): tentar casar na marra por UF + ano + número deu 2 casamentos
   "únicos" **e os dois estavam errados** — "60/2026 · GO · Palmeiras de Goiás" casou com a
   Câmara Municipal de JATAÍ. O número de pregão se repete entre municípios.

   >>> A DECISÃO DO DONO (14/08): *"SIM, prepare o caminho — mas barato. Nada de mutirão; quem
       quiser recuperar informa o número, e o resto segue sozinho."*

   Ou seja: o computador NÃO adivinha. Uma pessoa que sabe qual é o pregão digita o número, e
   este arquivo faz a única coisa que a máquina pode fazer melhor que ela — CONFERIR.

   ══ A ESCADA DE CONFERÊNCIA, E POR QUE CADA DEGRAU BLOQUEIA OU SÓ AVISA ═════════════════════
     1. FORMATO ...... `<cnpj de 14>-<n>-<sequencial>/<ano>`. Não parseou, não há o que pedir.
                       BLOQUEIA — não é opinião, é sintaxe.
     2. EXISTE ....... o PNCP responde pelos itens/arquivos daquela compra? 404 vem com
                       "Contratação não cadastrada." BLOQUEIA — número que não existe não vira
                       resultado nenhum, e aceitar deixaria um negócio apontando pro vazio.
     3. ANO .......... o ano do número de controle contra o ano do negócio. BLOQUEIA quando os
                       dois são conhecidos e diferentes: ano errado é quase sempre dígito trocado.
     4. ÓRGÃO ........ a razão social do CNPJ (o PNCP responde por `/orgaos/{cnpj}`) contra o
                       órgão do negócio. **SÓ AVISA.** Ver abaixo — e é a decisão mais
                       importante deste arquivo.
     5. MUNICÍPIO .... quando a compra já está no NOSSO índice, ele traz município e órgão. É a
                       conferência mais forte que existe, e é a que pegou as duas de 14/08.
                       **SÓ AVISA**, pelo mesmo motivo do órgão.

   >>> POR QUE ÓRGÃO E MUNICÍPIO AVISAM EM VEZ DE BLOQUEAR. Comparar NOME de órgão é comparar
       texto escrito por gente: "MUNICIPIO DE PALMEIRAS DE GOIAS", "PREFEITURA MUNICIPAL DE
       PALMEIRAS DE GOIÁS" e "P. M. PALMEIRAS DE GOIÁS" são a mesma entidade. Qualquer regra
       apertada o bastante pra pegar a divergência de verdade também recusaria essas três — e
       recusar o número CERTO de quem digitou certo é o jeito mais rápido de ensinar a pessoa a
       ignorar o aviso.
       >>> ENTÃO A RESPOSTA HONESTA É MOSTRAR OS DOIS NOMES LADO A LADO e deixar a pessoa
           decidir. Ela sabe qual pregão ganhou; a máquina não. O que a máquina garante é que
           salvar com divergência exige um "sim" explícito (`confirmado: true`) — e que o
           bloqueio existe onde a máquina TEM razão (formato, existência, ano).

   ══ O QUE ESTE ARQUIVO NÃO FAZ ═════════════════════════════════════════════════════════════
   >>> NÃO CASA NA MARRA. Não existe função aqui que receba UF+ano+número e devolva um palpite.
       A junção conservadora do `fila_resultado_atas.js` continua sendo a única, e ela exige
       município e recusa o resto — o resultado honesto dela hoje é zero de 105.
   >>> NÃO COLETA. Depois de gravar o número, quem traz os itens ganhos é o coletor de sempre
       (`coleta_resultados.js`, via `fila_resultado_atas.js`). Este arquivo abre a porta; não
       constrói uma segunda estrada até o PNCP.

     node tools/valida_controle_pncp.js --controle <numero>                 (só confere)
     node tools/valida_controle_pncp.js --negocio <id> --controle <numero>  (confere contra o negócio)
     node tools/valida_controle_pncp.js --negocio <id> --controle <n> --gravar
     node tools/valida_controle_pncp.js --negocio <id> --controle <n> --gravar --confirmado
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';

/* ══ AS FUNÇÕES PURAS ══════════════════════════════════════════════════════════════════════
   Elas são a MESMA lógica que a edge function `valida-controle` repete em Deno — e a suíte
   `testa_controle_informado` trava as duas juntas. É o mesmo arranjo já usado entre o
   `coleta_pncp.js` e a `coletar-licitacoes`: dois runtimes, um comportamento, e um assert que
   avisa no dia em que um dos dois mudar sozinho. */

/* O FORMATO DO PNCP: `<cnpj>-<n>-<sequencial>/<ano>`. O sequencial vai com zeros à esquerda no
   número de controle e SEM eles na URL — `000782` vira `782`. Mandar com zero devolve 404, e
   404 aqui seria lido como "esta licitação não existe": o erro mais convincente possível. */
function partesControle(controle) {
  const m = String(controle || '').trim().match(/^(\d{14})-(\d+)-(\d+)\/(\d{4})$/);
  if (!m) return null;
  return { cnpj: m[1], ordem: m[2], sequencial: String(Number(m[3])), ano: m[4] };
}

/* NORMALIZAÇÃO DE NOME DE ÓRGÃO. Tira acento, caixa e pontuação, e remove as palavras que
   TODO órgão público tem — elas não distinguem ninguém e, contadas, fariam "MUNICIPIO DE X" e
   "MUNICIPIO DE Y" parecerem 50% iguais. O que sobra é o nome próprio, que é o que importa. */
const VAZIAS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'MUNICIPIO', 'MUNICIPAL', 'PREFEITURA',
  'ESTADO', 'ESTADUAL', 'FUNDO', 'SECRETARIA', 'SEC', 'CAMARA', 'GOVERNO', 'PODER', 'PUBLICO',
  'ADMINISTRACAO', 'DIRETA', 'INDIRETA', 'AUTARQUIA', 'FUNDACAO', 'INSTITUTO', 'SERVICO', 'SAUDE']);
function tokens(nome) {
  return String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/)
    .filter(t => t.length >= 3 && !VAZIAS.has(t));
}

/* "BATE?" — metade dos tokens significativos do MENOR conjunto tem que aparecer no outro.
   >>> O MENOR, E NÃO A MÉDIA: "PALMEIRAS DE GOIAS" contra "MUNICIPIO DE PALMEIRAS DE GOIAS
       SECRETARIA MUNICIPAL DE SAUDE E SANEAMENTO" é a mesma entidade com um nome mais longo, e
       medir pela média reprovaria por causa das palavras a mais.
   >>> E QUANDO UM DOS DOIS NÃO TEM NOME, A RESPOSTA É `null` — "não sei", que é diferente de
       "não bate". Devolver `false` faria um negócio sem órgão preenchido virar divergência. */
function nomesBatem(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return null;
  const [menor, maior] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const set = new Set(maior);
  const comuns = menor.filter(t => set.has(t)).length;
  return comuns / menor.length >= 0.5;
}

/* O ANO DO NEGÓCIO. Ele mora em dois lugares e nenhum é obrigatório: no `numero` da compra
   ("60/2026") e na data de abertura. Quando nenhum dos dois responde, o ano é `null` — e "não
   sei o ano" NÃO pode virar bloqueio, senão negócio antigo sem data nenhuma ficaria impossível
   de recuperar, que é exatamente a gente que esta fatia veio atender. */
function anoDoNegocio(neg) {
  const n = String((neg && neg.numero) || '').match(/\/\s*(\d{4})\s*$/);
  if (n) return Number(n[1]);
  if (neg && neg.abertura) { const d = new Date(neg.abertura); if (!isNaN(d)) return d.getUTCFullYear(); }
  return null;
}

/* ══ O VEREDITO ════════════════════════════════════════════════════════════════════════════
   Função pura: recebe o que já foi olhado e decide. Pura porque é ela que responde "pode
   gravar?", e uma decisão dessas tem que ser testável sem rede — inclusive nos casos em que o
   PNCP está fora, que é hoje. */
function veredito(entrada) {
  const e = entrada || {};
  const p = e.partes;
  if (!p) {
    return {
      ok: false, veredito: 'formato', podeGravar: false, divergencias: [],
      mensagem: 'Esse não é um número de controle do PNCP. O formato é '
        + '14 dígitos do CNPJ, um traço, um número, outro traço, o sequencial, barra e o ano — '
        + 'por exemplo 03659166002156-1-000034/2026. Ele aparece na página da licitação no PNCP.',
    };
  }
  if (e.existe === false) {
    return {
      ok: false, veredito: 'nao_existe', podeGravar: false, divergencias: [],
      mensagem: 'O PNCP não conhece essa contratação. O número tem o formato certo, mas não há '
        + `compra ${p.sequencial}/${p.ano} publicada pelo CNPJ ${p.cnpj}. Confira o número na `
        + 'página do pregão — é comum trocar o sequencial pelo número do edital, que são diferentes.',
    };
  }
  if (e.existe == null) {
    /* NÃO CONSEGUI PERGUNTAR ≠ NÃO EXISTE. Recusar aqui faria uma queda do PNCP virar "seu
       número está errado" — e a pessoa apagaria um número certo. */
    return {
      ok: false, veredito: 'nao_sei', podeGravar: false, divergencias: [],
      mensagem: 'Não consegui falar com o PNCP agora para conferir esse número. Não quer dizer '
        + 'que ele esteja errado — quer dizer que eu não consegui olhar. Tente de novo daqui a pouco.',
    };
  }

  const div = [];
  /* O ANO BLOQUEIA porque ele é a única conferência de identidade que não depende de comparar
     texto escrito por gente: ou é 2025 ou é 2026. E ano errado é quase sempre dígito trocado. */
  if (e.anoNegocio != null && Number(e.anoNegocio) !== Number(p.ano)) {
    div.push({ campo: 'ano', informado: p.ano, negocio: String(e.anoNegocio), bloqueia: true });
  }
  const bateOrgao = e.orgaoPNCP ? nomesBatem(e.orgaoPNCP, e.orgaoNegocio) : null;
  if (bateOrgao === false) {
    div.push({ campo: 'órgão', informado: e.orgaoPNCP, negocio: e.orgaoNegocio, bloqueia: false });
  }
  const bateMun = e.municipioIndice ? nomesBatem(e.municipioIndice, e.municipioNegocio) : null;
  if (bateMun === false) {
    div.push({ campo: 'município', informado: e.municipioIndice, negocio: e.municipioNegocio, bloqueia: false });
  }

  const bloqueado = div.some(d => d.bloqueia);
  if (bloqueado) {
    const d = div.find(x => x.bloqueia);
    return {
      ok: false, veredito: 'diverge', podeGravar: false, divergencias: div,
      mensagem: `Esse número é de ${d.campo === 'ano' ? 'outro ano' : 'outro ' + d.campo}: `
        + `o PNCP diz ${d.informado} e este negócio diz ${d.negocio}. `
        + 'Não vou amarrar os dois — um resultado do edital errado não aparece como defeito, '
        + 'aparece como um preço plausível na tela em que se decide preço.',
    };
  }
  if (div.length) {
    return {
      ok: false, veredito: 'diverge', podeGravar: true, divergencias: div,
      mensagem: 'O número existe no PNCP, mas o nome não é o mesmo que está no negócio:\n'
        + div.map(d => `  · ${d.campo}: o PNCP diz "${d.informado}" e o negócio diz "${d.negocio}"`).join('\n')
        + '\nIsso pode ser só o mesmo órgão escrito de outro jeito — quem sabe é você. '
        + 'Confirme para gravar assim mesmo.',
    };
  }
  return {
    ok: true, veredito: 'confere', podeGravar: true, divergencias: [],
    mensagem: e.orgaoPNCP
      ? `Confere: ${e.orgaoPNCP} · compra ${p.sequencial}/${p.ano}.`
      : `O PNCP conhece a compra ${p.sequencial}/${p.ano} do CNPJ ${p.cnpj}.`,
  };
}

module.exports = { partesControle, tokens, nomesBatem, anoDoNegocio, veredito, VAZIAS };

// ══════════════════════════════════════════════════════════════════════════════════════════
// A PARTE QUE FALA COM O MUNDO — só quando chamado direto.
// ══════════════════════════════════════════════════════════════════════════════════════════
if (require.main !== module) return;

const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = n => process.argv.includes(n);

const TIMEOUT_MS = 20000;
async function pncp(url) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ac.signal });
    clearTimeout(to);
    const txt = await r.text();
    return { http: r.status, corpo: txt.trim() ? JSON.parse(txt) : null };
  } catch (e) { clearTimeout(to); return { http: null, erro: e.name === 'AbortError' ? 'timeout' : String(e.message) }; }
}

/* "EXISTE?" PERGUNTADO PELA PORTA QUE ESTÁ ABERTA. O detalhe da compra mudou pra dentro da API
   de CONSULTA (HTTP 301, medido hoje), e a consulta está fora — perguntar por lá devolveria
   timeout pra todo mundo e o validador nunca aprovaria nada. Já `/itens` e `/arquivos` são da
   API de DETALHE, que responde em ~80 ms, e as duas dizem "Contratação não cadastrada." com
   404 quando a compra não existe. É a mesma porta que a coleta de itens usa. */
async function existeNoPNCP(p) {
  const base = `https://pncp.gov.br/api/pncp/v1/orgaos/${p.cnpj}/compras/${p.ano}/${p.sequencial}`;
  const it = await pncp(`${base}/itens?pagina=1&tamanhoPagina=1`);
  if (it.http === 200) return { existe: true, itens: Array.isArray(it.corpo) ? it.corpo.length : 0 };
  if (it.http === 404) {
    /* SEGUNDA PORTA ANTES DE DIZER "NÃO EXISTE": uma compra pode não ter item publicado e ainda
       assim existir (é o caso mais comum do 404, medido na fatia A6). Dizer "não existe" pra
       ela recusaria um número CERTO. */
    const ar = await pncp(`${base}/arquivos`);
    if (ar.http === 200) return { existe: true, itens: 0 };
    if (ar.http === 404) return { existe: false };
    return { existe: null, erro: ar.erro || ('HTTP ' + ar.http) };
  }
  return { existe: null, erro: it.erro || ('HTTP ' + it.http) };
}

async function orgaoNoPNCP(cnpj) {
  const r = await pncp(`https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}`);
  return r.http === 200 && r.corpo ? String(r.corpo.razaoSocial || '') : null;
}

async function le(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(q + ' -> HTTP ' + r.status);
  return r.json();
}

(async () => {
  const controle = arg('--controle');
  const negocioId = arg('--negocio');
  if (!controle) { console.error('uso: --controle <numero> [--negocio <id>] [--gravar] [--confirmado]'); process.exit(1); }

  console.log('=== NÚMERO DO PNCP INFORMADO À MÃO (fatia A19) ===\n');
  console.log(`  informado: ${controle}`);
  const p = partesControle(controle);
  if (p) console.log(`  lido como: CNPJ ${p.cnpj} · compra ${p.sequencial} · ano ${p.ano}`);

  let neg = null;
  if (negocioId) {
    const l = await le(`negocios?select=id,titulo,numero,orgao,municipio,uf,abertura,estagio,numero_controle,licitacao_id&id=eq.${negocioId}`);
    neg = l[0] || null;
    if (!neg) { console.error(`\nnão achei o negócio ${negocioId}`); process.exit(1); }
    console.log(`  negócio ${neg.id}: ${neg.titulo || '(sem título)'}`);
    console.log(`    nº ${neg.numero || '—'} · ${neg.orgao || '—'} · ${neg.municipio || '—'}/${neg.uf || '—'}`
      + ` · estágio ${neg.estagio}`);
    if (neg.numero_controle) console.log(`    ⚠️  já tem número de controle: ${neg.numero_controle}`);
  }

  const ex = p ? await existeNoPNCP(p) : { existe: null };
  const orgaoPNCP = p && ex.existe ? await orgaoNoPNCP(p.cnpj) : null;
  /* O NOSSO ÍNDICE É A CONFERÊNCIA MAIS FORTE quando ele conhece a compra: ele traz MUNICÍPIO,
     que é justamente o campo que pegou as duas correspondências erradas de 14/08. */
  const noIndice = p ? (await le(`licitacoes?select=id,orgao,municipio,uf,numero_compra&numero_controle=eq.${encodeURIComponent(controle)}`))[0] : null;
  if (orgaoPNCP) console.log(`\n  o PNCP diz: ${orgaoPNCP}`);
  if (noIndice) console.log(`  no nosso índice: ${noIndice.orgao} · ${noIndice.municipio}/${noIndice.uf}`);
  else if (p && ex.existe) console.log('  (esta compra não está no nosso índice — a conferência de município fica de fora)');

  const v = veredito({
    partes: p, existe: ex.existe,
    anoNegocio: neg ? anoDoNegocio(neg) : null,
    orgaoPNCP, orgaoNegocio: neg ? neg.orgao : null,
    municipioIndice: noIndice ? noIndice.municipio : null,
    municipioNegocio: neg ? neg.municipio : null,
  });

  console.log(`\n  VEREDITO: ${v.veredito.toUpperCase()}${v.ok ? '' : (v.podeGravar ? '  (dá pra gravar confirmando)' : '  (não dá pra gravar)')}`);
  console.log('  ' + v.mensagem.split('\n').join('\n  '));

  if (!tem('--gravar')) { console.log('\n(só conferi — rode com --gravar pra amarrar ao negócio)'); return; }
  if (!neg) { console.error('\n--gravar exige --negocio <id>'); process.exit(1); }
  if (!v.podeGravar) { console.error('\nNÃO GRAVEI: ' + v.veredito); process.exit(1); }
  if (v.divergencias.length && !tem('--confirmado')) {
    console.error('\nNÃO GRAVEI: há divergência. Rode com --confirmado se você tem certeza.');
    process.exit(1);
  }

  /* GRAVA OS DOIS CAMPOS, e não só um. É o conserto da A9 de novo: `numero_controle` é a chave
     que o PNCP entende, e `licitacao_id` é a que amarra ao nosso índice quando ele conhece a
     licitação. Gravar só um deixa metade da ponte de pé. */
  const corpo = { numero_controle: controle };
  if (noIndice) corpo.licitacao_id = noIndice.id;
  const r = await fetch(`${SB}/rest/v1/negocios?id=eq.${neg.id}`, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(corpo),
  });
  if (!r.ok) { console.error('\nnão consegui gravar: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200)); process.exit(1); }
  console.log(`\n  ✓ GRAVADO no negócio ${neg.id}: numero_controle=${controle}`
    + (corpo.licitacao_id ? ` · licitacao_id=${corpo.licitacao_id}` : ' (sem licitacao_id: a compra não está no índice)'));
  console.log('  A porta do coletor é essa: o `fila_resultado_atas.js` lê este campo, e este');
  console.log('  negócio entra na fila do resultado por item na próxima rodada.');
  console.log(`\n  para trazer os itens ganhos agora:  node tools/fila_resultado_atas.js --executar`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
