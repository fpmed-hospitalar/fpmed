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
const TAM_PAGINA = 10;      // MEDIDO em 04/08: com 50 a API não responde; com 10 responde em ~450ms
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

module.exports = { esperaBackoff, criaBreaker, janela, normaliza, valida, yyyymmdd, FALHAS_ATE_ABRIR };
if (require.main !== module) return;

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
if (!SR) { console.error('service_role nao encontrada'); process.exit(1); }
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function puxa(url, breaker) {
  for (let t = 0; t < 4; t++) {
    if (breaker.aberto) return { erro: 'breaker aberto' };
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { signal: ac.signal });
      clearTimeout(to);
      if (r.status === 204) { breaker.ok(); return { dados: [], total: 0 }; }   // sem resultado
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      breaker.ok();
      return { dados: j.data || [], total: j.totalRegistros || 0, paginas: j.totalPaginas || 1 };
    } catch (e) {
      clearTimeout(to);
      const abriu = breaker.falhou();
      const espera = esperaBackoff(t);
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
  let ultimaOk = null;
  try {
    const r = await fetch(`${SB}/rest/v1/coleta_status?fonte=eq.PNCP&select=*`, { headers: H });
    const j = await r.json();
    if (Array.isArray(j) && j[0] && j[0].ultima_ok) ultimaOk = new Date(j[0].ultima_ok);
  } catch (_) {}
  const { ini, fim } = janela(ultimaOk, new Date(), parseInt(arg('--dias')) || null);
  console.log(`janela: ${yyyymmdd(ini)} → ${yyyymmdd(fim)}  ${ultimaOk ? `(última coleta OK: ${ultimaOk.toISOString().slice(0,16)})` : '(primeira coleta: 30 dias)'}`);
  console.log(`UFs: ${UFS.join(',')} · modalidades: ${MODALIDADES.join(',')}`);

  const breaker = criaBreaker(FALHAS_ATE_ABRIR);
  const achados = new Map();      // chave natural -> registro (dedup entre UF/modalidade)
  let truncou = 0, erro = null;

  for (const uf of UFS) {
    for (const mod of MODALIDADES) {
      if (breaker.aberto) break;
      let pag = 1, totalPag = 1;
      do {
        const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao`
          + `?dataInicial=${yyyymmdd(ini)}&dataFinal=${yyyymmdd(fim)}`
          + `&codigoModalidadeContratacao=${mod}&uf=${uf}&pagina=${pag}&tamanhoPagina=${TAM_PAGINA}`;
        const r = await puxa(url, breaker);
        if (r.erro) { erro = r.erro; break; }
        totalPag = Math.min(r.paginas || 1, TETO_PAGINAS);
        if ((r.paginas || 1) > TETO_PAGINAS && pag === 1) truncou++;
        for (const x of r.dados) {
          const n = normaliza(x);
          if (!valida(n)) continue;
          achados.set(`${n.cnpj}|${n.ano}|${n.sequencial}`, n);
        }
        pag++;
      } while (pag <= totalPag && !breaker.aberto);
      if (breaker.aberto) break;
    }
  }

  const regs = [...achados.values()];
  console.log(`\ncoletadas: ${regs.length} licitação(ões) únicas`);
  if (truncou) console.log(`⚠️  ${truncou} combinação(ões) uf×modalidade passaram do teto de ${TETO_PAGINAS} páginas — pode haver mais`);
  if (breaker.aberto) console.log(`🔴 BREAKER ABERTO: o PNCP falhou ${breaker.seguidas}x seguidas. A coleta parou.`);

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
  await fetch(`${SB}/rest/v1/coleta_status?on_conflict=fonte`, {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify([st]),
  }).catch(() => {});
  console.log(okDeVerdade ? '✅ coleta concluída — carimbo de frescor avançado'
                          : '⚠️  coleta INCOMPLETA — o carimbo NÃO avançou (a tela vai continuar mostrando a hora da última coleta boa)');
  process.exitCode = okDeVerdade ? 0 : 1;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
