// ═══════════════════════════════════════════════════════════════════════════════
// COLETOR DO PNCP -> tabela `licitacoes`   (item 10, 05/08/2026)
//
// Uso:  node tools/coleta_pncp.js                  -> incremental (desde a última coleta OK)
//       node tools/coleta_pncp.js --dias 30        -> força uma janela de N dias
//       node tools/coleta_pncp.js --preview        -> não grava, só mostra o que viria
//
// POR QUE ELE EXISTE: o PNCP caiu 4 VEZES em dois dias. A tela não trava (AbortController +
// cache de 15 min), mas fica INÚTIL enquanto a fonte estiver fora. Com índice próprio ela passa
// a ter dado sempre, e o PNCP vira fonte de ATUALIZAÇÃO em vez de dependência de tempo real.
// É o mesmo desenho que o SIGA usa (achado do Lemuel, seção 2.0B do LICITACOES_SPEC.md).
//
// AS TRÊS GARANTIAS QUE A SPEC PEDIU, e o motivo de cada uma:
//   1. BACKOFF EXPONENCIAL — insistir de imediato numa API que caiu só piora. Espera dobrando.
//   2. CIRCUIT BREAKER — depois de N falhas seguidas, PARA. Sem isso, uma queda longa vira um
//      laço batendo na porta e uma conta de execução no CI.
//   3. INCREMENTAL — busca só desde a última coleta que deu certo. Reprocessar tudo toda vez é
//      o jeito garantido de bater em rate limit e de ficar mais lento a cada mês que passa.
//
// >>> NUNCA APAGA. Se o PNCP estiver fora, o que já está no banco FICA. Uma coleta que falha
//     tem que deixar a tela igual ao que estava, nunca vazia.
//
// A service_role é usada AQUI, na execução local. Ela NUNCA vai pro CI: em produção quem grava
// é a edge function com segredo dedicado (decisão do Lemuel).
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const PREVIEW = process.argv.includes('--preview');

// ── PARÂMETROS DA COLETA ───────────────────────────────────────────────────────────────────
// GO é o mercado; as vizinhas entram porque órgão de divisa compra de quem está do lado.
const UFS = (arg('--uf') || 'GO,DF,MG,MT,MS,TO,BA').split(',').map(s => s.trim()).filter(Boolean);
// 6 = pregão eletrônico · 8 = dispensa · 9 = inexigibilidade. São as que a FPMED disputa.
const MODALIDADES = (arg('--mod') || '6,8,9').split(',').map(s => parseInt(s.trim())).filter(Boolean);
/* TAM_PAGINA — MEDIDO DUAS VEZES, e as duas medições estão certas:
     04/08, consulta de JANELA (7 dias de uma vez): com 50 a API não respondia; com 10, ~450 ms.
     10/08, consulta de UM DIA (a varredura mudou hoje): 10 → 437 ms · 20 → 764 ms · 50 → 778 ms,
            todas HTTP 200. O que não cabia era o VOLUME da janela larga, não o tamanho da página.
   Tem que ser IGUAL ao da edge function — a suíte testa_coleta_agendada trava isso, porque dois
   coletores com ritmos diferentes fazem a produção se comportar diferente do que se testa aqui. */
const TAM_PAGINA = 50;
const TETO_PAGINAS = 40;    // por (uf, modalidade, dia) — teto de segurança, com aviso se truncar
const TIMEOUT_MS = 20000;   // o mesmo AbortController estrutural da tela

// ── BACKOFF + CIRCUIT BREAKER (puros, exportados pra suíte) ────────────────────────────────
// Espera dobrando a partir de 1s, com teto de 30s. O teto existe pra que uma queda longa não
// vire uma espera de 8 minutos entre tentativas — a essa altura é melhor desistir e voltar
// depois, que é o que o breaker faz.
function esperaBackoff(tentativa) { return Math.min(1000 * Math.pow(2, tentativa), 30000); }
// Depois de N falhas SEGUIDAS o coletor para. Sucesso zera o contador: uma falha isolada no
// meio de uma coleta longa não pode derrubar a rodada inteira.
const FALHAS_ATE_ABRIR = 5;
function criaBreaker(limite) {
  let seguidas = 0, aberto = false;
  return {
    ok() { seguidas = 0; },
    falhou() { seguidas++; if (seguidas >= (limite || FALHAS_ATE_ABRIR)) aberto = true; return aberto; },
    get aberto() { return aberto; },
    get seguidas() { return seguidas; },
  };
}
// ── RITMO (anti-429) ───────────────────────────────────────────────────────────────────────
// MEDIDO em 06/08/2026, na primeira coleta que de fato conversou com o PNCP (pela edge
// function): 70 licitações gravadas e então **HTTP 429**. Ou seja, a fonte estava SAUDÁVEL —
// só disse "você está indo rápido demais".
// >>> 429 NÃO É QUEDA, e tratar igual à queda tem dois efeitos ruins:
//     1. o circuit breaker mata a rodada com a API no ar (foi o que aconteceu: breaker aberto,
//        carimbo não avançou, rodada marcada como falha — e não havia falha nenhuma);
//     2. a retentativa de 1s bate MAIS FORTE em quem acabou de pedir pra desacelerar.
// A correção de verdade não é retentar melhor, é ANDAR MAIS DEVAGAR: pausa entre chamadas que
// DOBRA a cada 429 e não volta a acelerar dentro da rodada — voltar a acelerar só provoca o
// próximo 429. E um teto de 429 por rodada, senão cota esgotada vira laço eterno.
const PAUSA_MS = 300;
const PAUSA_TETO_MS = 8000;
const TETO_RATE_LIMIT = 20;
function criaRitmo(base, teto) {
  let pausa = base || PAUSA_MS, vezes = 0;
  const tetoP = teto || PAUSA_TETO_MS;
  return {
    get pausa() { return pausa; },
    get vezes() { return vezes; },
    freou() { vezes++; pausa = Math.min(pausa * 2, tetoP); return pausa; },
    get estourou() { return vezes > TETO_RATE_LIMIT; },
  };
}
// Espera do 429: obedece o `Retry-After` quando o servidor manda um (ele sabe da própria cota
// melhor que qualquer heurística nossa) e, sem ele, começa em 5s — não em 1s como a queda.
function esperaRateLimit(tentativa, retryAfter) {
  const h = parseInt(retryAfter, 10);
  if (isFinite(h) && h > 0) return Math.min(h * 1000, 60000);
  return Math.min(5000 * Math.pow(2, tentativa), 60000);
}

// Janela incremental: da última coleta OK até hoje, com 2 dias de sobreposição — publicação
// pode ser corrigida depois, e reler dois dias é barato perto de perder uma alteração.
const DIAS_1A_COLETA = 30;
function janela(ultimaOk, hoje, diasForcados) {
  const fim = new Date(hoje);
  // "N dias" significa N dias INCLUSIVE dos dois extremos, nos dois caminhos. A 1ª versão
  // usava `-30` aqui e `-N+1` no forçado: `--dias 30` dava 30 dias e o padrão dava 31.
  // Dois significados da mesma palavra na mesma função é o tipo de coisa que vira bug de
  // contagem meses depois, quando alguém comparar os dois resultados e não entender.
  const recua = n => { const d = new Date(fim); d.setDate(d.getDate() - n + 1); return d; };
  let ini;
  if (diasForcados) ini = recua(diasForcados);
  else if (ultimaOk) { ini = new Date(ultimaOk); ini.setDate(ini.getDate() - 2); }
  else ini = recua(DIAS_1A_COLETA);
  if (ini > fim) ini = new Date(fim);
  return { ini, fim };
}
const yyyymmdd = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

// ── NORMALIZAÇÃO: a resposta do PNCP vira linha da nossa tabela ────────────────────────────
// `bruto` guarda a resposta inteira. No dia em que faltar um campo, ele está lá — e não é
// preciso recoletar pra descobrir o que a API mandava.
function normaliza(x) {
  const org = x.orgaoEntidade || {}, un = x.unidadeOrgao || {};
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };
  const dt = v => (v ? String(v) : null);
  return {
    portal: 'PNCP',
    cnpj: String(org.cnpj || '').replace(/\D/g, ''),
    ano: parseInt(x.anoCompra) || null,
    sequencial: parseInt(x.sequencialCompra) || null,
    numero_controle: x.numeroControlePNCP || null,
    numero_compra: x.numeroCompra != null ? String(x.numeroCompra) : null,
    modalidade: x.modalidadeNome || null,
    modalidade_cod: parseInt(x.modalidadeId) || null,
    modo_disputa: x.modoDisputaNome || null,
    situacao: x.situacaoCompraNome || null,
    orgao: org.razaoSocial || null,
    unidade: un.nomeUnidade || null,
    municipio: un.municipioNome || null,
    uf: un.ufSigla || null,
    objeto: x.objetoCompra || null,
    valor_estimado: num(x.valorTotalEstimado),
    data_publicacao: dt(x.dataPublicacaoPncp) ? String(x.dataPublicacaoPncp).slice(0, 10) : null,
    data_abertura: dt(x.dataAberturaProposta),
    data_encerramento: dt(x.dataEncerramentoProposta),
    link_sistema: x.linkSistemaOrigem || null,
    bruto: x,
    atualizado_em: new Date().toISOString(),
  };
}
const valida = r => !!(r.cnpj && r.ano && r.sequencial);   // sem chave natural não entra

module.exports = { esperaBackoff, criaBreaker, janela, normaliza, valida, yyyymmdd, FALHAS_ATE_ABRIR,
                   criaRitmo, esperaRateLimit, PAUSA_MS, PAUSA_TETO_MS, TETO_RATE_LIMIT };
if (require.main !== module) return;

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
if (!SR) { console.error('service_role nao encontrada'); process.exit(1); }
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function puxa(url, breaker, ritmo) {
  let t = 0;        // tentativas de FALHA (queda/timeout) — só estas gastam o orçamento
  let t429 = 0;     // rate limits, contados à parte: a API está no ar
  while (t < 4) {
    if (breaker.aberto) return { erro: 'breaker aberto' };
    if (ritmo.estourou) return { erro: `rate limit persistente do PNCP (${ritmo.vezes}x)` };
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { signal: ac.signal });
      clearTimeout(to);
      // 429 não passa pelo breaker de propósito: ele existe pra "a fonte caiu", e aqui ela
      // respondeu. O que muda é o RITMO da rodada inteira, não o contador de falhas.
      if (r.status === 429) {
        const espera = esperaRateLimit(t429++, r.headers.get('retry-after'));
        const nova = ritmo.freou();
        console.log(`    ~ 429 rate limit — desacelerando pra ${nova}ms entre chamadas, esperando ${espera / 1000}s`);
        await dormir(espera);
        continue;
      }
      if (r.status === 204) { breaker.ok(); return { dados: [], total: 0 }; }   // sem resultado
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      breaker.ok();
      return { dados: j.data || [], total: j.totalRegistros || 0, paginas: j.totalPaginas || 1 };
    } catch (e) {
      clearTimeout(to);
      const abriu = breaker.falhou();
      const espera = esperaBackoff(t++);
      console.log(`    ! ${e.name === 'AbortError' ? 'timeout' : e.message} (falha ${breaker.seguidas})`
        + (abriu ? ' — BREAKER ABERTO, parando' : ` — nova tentativa em ${espera / 1000}s`));
      if (abriu) return { erro: String(e.message || e.name) };
      await dormir(espera);
    }
  }
  return { erro: 'esgotou as tentativas' };
}

(async () => {
  console.log(PREVIEW ? '[PREVIEW — nada e gravado]' : '[COLETA]');
  // estado anterior
  let ultimaOk = null, ultimoDiaOk = null, diaEmCurso = null, ufsFeitas = [];
  try {
    const r = await fetch(`${SB}/rest/v1/coleta_status?fonte=eq.PNCP&select=*`, { headers: H });
    const j = await r.json();
    if (Array.isArray(j) && j[0] && j[0].ultima_ok) ultimaOk = new Date(j[0].ultima_ok);
    if (Array.isArray(j) && j[0] && j[0].ultimo_dia_ok) ultimoDiaOk = String(j[0].ultimo_dia_ok).slice(0, 10);
    if (Array.isArray(j) && j[0] && j[0].dia_em_curso) diaEmCurso = String(j[0].dia_em_curso).slice(0, 10);
    if (Array.isArray(j) && j[0] && Array.isArray(j[0].ufs_feitas)) ufsFeitas = j[0].ufs_feitas.slice();
  } catch (_) {}
  const { ini, fim } = janela(ultimaOk, new Date(), parseInt(arg('--dias')) || null);
  // a origem da janela tem que bater com a janela impressa: `--dias 2` dizendo "primeira
  // coleta: 30 dias" faz quem lê o log conferir a data errada quando algo não fechar.
  const origemJanela = arg('--dias') ? `(janela forçada: ${arg('--dias')} dias)`
    : ultimaOk ? `(última coleta OK: ${ultimaOk.toISOString().slice(0, 16)})`
    : `(primeira coleta: ${DIAS_1A_COLETA} dias)`;
  console.log(`janela: ${yyyymmdd(ini)} → ${yyyymmdd(fim)}  ${origemJanela}`);
  console.log(`UFs: ${UFS.join(',')} · modalidades: ${MODALIDADES.join(',')}`);

  const breaker = criaBreaker(FALHAS_ATE_ABRIR);
  const ritmo = criaRitmo();
  const achados = new Map();      // chave natural -> registro (dedup entre UF/modalidade)
  let truncou = 0, erro = null;
  let ultimoDiaCompleto = null;   // yyyy-mm-dd do dia MAIS NOVO coberto inteiro

  /* ══ DIA A DIA, DO MAIS NOVO PRO MAIS VELHO — a mesma correção da edge function (10/08) ═════
     A varredura pedia a janela inteira de uma vez e caminhava as páginas até acabar o tempo (lá)
     ou o breaker abrir (aqui). MEDIDO em 10/08 na edge function: com a janela de 7 dias, os 100 s
     foram gastos em 04–06/08 e o dia de HOJE ficou com 25 linhas; forçando 1 dia, entraram 272.
     Aqui o script não tem orçamento de tempo, mas tem o BREAKER e o rate limit persistente —
     e quando um dos dois corta a rodada, o que se perde é o resto da varredura. Do jeito antigo,
     o resto era sempre o dia mais novo. Este é o coletor-irmão da função: os dois se comportam
     igual de propósito (é o que a suíte testa_coleta_agendada trava). */
  const diasDaJanela = [];
  for (const d = new Date(fim); d >= ini; d.setDate(d.getDate() - 1)) diasDaJanela.push(new Date(d));

  /* ══ RODÍZIO DE UF: A RODADA LEMBRA ONDE PAROU — mesma correção da edge function (10/08) ═════
     MEDIDO em 10/08, sondando o PNCP direto a uma requisição por 700 ms: as 7 primeiras deram
     200 e da 8ª em diante vieram 14 × HTTP 429 seguidos. A cota é DURA. Sem memória, toda rodada
     recomeçava em GO e morria antes de MT/MS/TO/BA — e o banco provava: 689 licitações, todas de
     GO, DF e MG, as outras quatro nunca coletadas uma vez sequer.
     Aqui o script tem mais fôlego que a função (não há orçamento de segundos, e o `puxa` espera o
     Retry-After), então normalmente ele fecha a volta sozinho. O progresso é compartilhado com a
     função de propósito: os dois alimentam o MESMO índice, e progresso separado faria um desfazer
     a conta do outro. */
  const diaMaisNovo = yyyymmdd(fim).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
  if (diaEmCurso !== diaMaisNovo) { diaEmCurso = diaMaisNovo; ufsFeitas = []; }
  let voltaFechou = false;

  for (const dia of diasDaJanela) {
    const iso = yyyymmdd(dia).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    const doDiaNovo = iso === diaMaisNovo;
    const ufsDaVez = doDiaNovo ? UFS.filter(u => !ufsFeitas.includes(u)) : UFS;
    let diaInteiro = true;
    for (const uf of ufsDaVez) {
      let ufInteira = true;
      for (const mod of MODALIDADES) {
        if (breaker.aberto || erro) { diaInteiro = false; ufInteira = false; break; }
        let pag = 1, totalPag = 1;
        do {
          const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao`
            + `?dataInicial=${yyyymmdd(dia)}&dataFinal=${yyyymmdd(dia)}`
            + `&codigoModalidadeContratacao=${mod}&uf=${uf}&pagina=${pag}&tamanhoPagina=${TAM_PAGINA}`;
          const r = await puxa(url, breaker, ritmo);
          if (r.erro) { erro = r.erro; diaInteiro = false; break; }
          totalPag = Math.min(r.paginas || 1, TETO_PAGINAS);
          if ((r.paginas || 1) > TETO_PAGINAS && pag === 1) { truncou++; diaInteiro = false; }
          for (const x of r.dados) {
            const n = normaliza(x);
            if (!valida(n)) continue;
            achados.set(`${n.cnpj}|${n.ano}|${n.sequencial}`, n);
          }
          pag++;
          await dormir(ritmo.pausa);   // o que EVITA o 429; retentar melhor só o remedia
        } while (pag <= totalPag && !breaker.aberto);
        if (breaker.aberto) { diaInteiro = false; ufInteira = false; break; }
      }
      // a UF só entra no progresso com as 3 modalidades lidas — meia UF marcada como feita seria
      // um buraco que nenhuma rodada futura voltaria pra tapar
      if (doDiaNovo && ufInteira && !ufsFeitas.includes(uf)) ufsFeitas.push(uf);
      if (breaker.aberto || erro) break;
    }
    // O DIA MAIS NOVO fecha quando a VOLTA fecha (todas as UFs, somando rodadas). Dias velhos
    // valem pelo que a rodada viu, porque ninguém guarda progresso deles.
    const fechouAgora = doDiaNovo ? (UFS.every(u => ufsFeitas.includes(u)) && !truncou && !erro) : diaInteiro;
    if (doDiaNovo && fechouAgora) voltaFechou = true;
    if (fechouAgora && !ultimoDiaCompleto) ultimoDiaCompleto = iso;
    if (breaker.aberto || erro) break;
  }

  const regs = [...achados.values()];
  console.log(`\ncoletadas: ${regs.length} licitação(ões) únicas`);
  if (truncou) console.log(`⚠️  ${truncou} combinação(ões) uf×modalidade passaram do teto de ${TETO_PAGINAS} páginas — pode haver mais`);
  if (breaker.aberto) console.log(`🔴 BREAKER ABERTO: o PNCP falhou ${breaker.seguidas}x seguidas. A coleta parou.`);
  if (ritmo.vezes) console.log(`⏱️  ${ritmo.vezes} rate limit(s) — a rodada terminou a ${ritmo.pausa}ms entre chamadas`);

  if (PREVIEW) {
    regs.slice(0, 6).forEach(r => console.log(`  ${r.data_publicacao} · ${r.uf} · ${(r.modalidade||'').slice(0,22)} · ${(r.orgao||'').slice(0,40)}`));
    console.log('\nPreview — nada gravado.');
    return;
  }

  // >>> NUNCA APAGA. Se não veio nada, o banco fica como está e a tela continua servindo o
  //     que já tinha. Coleta que falha tem que deixar a tela igual, nunca vazia.
  let gravadas = 0;
  if (regs.length) {
    for (let i = 0; i < regs.length; i += 200) {
      const lote = regs.slice(i, i + 200);
      const r = await fetch(`${SB}/rest/v1/licitacoes?on_conflict=portal,cnpj,ano,sequencial`, {
        method: 'POST',
        headers: { ...H, Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(lote),
      });
      if (!r.ok) { erro = 'HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160); console.error('ERRO no lote ' + i + ': ' + erro); break; }
      gravadas += lote.length;
    }
    console.log(`gravadas/atualizadas: ${gravadas}`);
  } else {
    console.log('nada a gravar — o que já está no banco FICA (a tela continua servindo).');
  }

  // carimbo de frescor: `ultima_ok` só avança quando a rodada terminou sem breaker aberto e
  // sem erro. É esse campo que a tela mostra como "dados coletados às HH:MM" — avançá-lo numa
  // rodada que falhou faria a tela mentir sobre a idade do dado.
  const okDeVerdade = !breaker.aberto && !erro;
  const st = { fonte: 'PNCP', ultima_tentativa: new Date().toISOString(),
               ultimo_erro: erro || null, registros: gravadas, atualizado_em: new Date().toISOString() };
  if (okDeVerdade) st.ultima_ok = new Date().toISOString();
  // ATÉ QUE DIA O ÍNDICE ESTÁ EM DIA (10/08). `ultima_ok` fala da EXECUÇÃO; este fala do DADO, e
  // sobrevive a uma rodada cortada no meio. SÓ ANDA PRA FRENTE: rodada que alcançou só dia velho
  // não pode puxar o carimbo pra trás — o dia novo continua coberto.
  if (ultimoDiaCompleto && (!ultimoDiaOk || ultimoDiaCompleto > ultimoDiaOk)) st.ultimo_dia_ok = ultimoDiaCompleto;
  // O PROGRESSO DA VOLTA. Fechou -> ZERA, pra próxima rodada varrer o dia de novo e pegar o que
  // foi publicado depois. O carimbo do dia já guarda que a volta aconteceu.
  st.dia_em_curso = diaEmCurso;
  st.ufs_feitas = voltaFechou ? [] : ufsFeitas;
  await fetch(`${SB}/rest/v1/coleta_status?on_conflict=fonte`, {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify([st]),
  }).catch(() => {});
  console.log(okDeVerdade ? '✅ coleta concluída — carimbo de frescor avançado'
                          : '⚠️  coleta INCOMPLETA — o carimbo NÃO avançou (a tela vai continuar mostrando a hora da última coleta boa)');
  console.log(ultimoDiaCompleto ? `📅 índice completo até ${ultimoDiaCompleto}`
                                : '📅 nenhum dia foi coberto por inteiro nesta rodada');
  const faltam = UFS.filter(u => !ufsFeitas.includes(u));
  console.log(voltaFechou ? `🔄 volta do dia ${diaEmCurso} FECHADA (as ${UFS.length} UFs) — o progresso zerou`
    : `🔄 ${diaEmCurso}: ${ufsFeitas.length}/${UFS.length} UFs varridas` + (faltam.length ? ` · faltam ${faltam.join(',')}` : ''));
  process.exitCode = okDeVerdade ? 0 : 1;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
