/* ════════════════════════════════════════════════════════════════════════════════════════════
   preenche_prazo.js — "AINDA DÁ TEMPO?" PARA AS LICITAÇÕES QUE NÃO SABEM RESPONDER
                        (fatia A33, 19/08/2026)

   ══ A PERGUNTA ═════════════════════════════════════════════════════════════════════════════
   A primeira coisa que um gestor de licitação quer saber é se ainda dá tempo de disputar
   (BASE_VISUAL, Parte 1). Medido hoje no índice: 8.599 de 11.843 licitações — 72,6% — não têm
   janela de proposta. Para sete de cada dez linhas, a nossa tela não responde a primeira
   pergunta.

   ══ E ANTES DE SAIR PEDINDO, ESTE ARQUIVO PERGUNTA *POR QUÊ* — PORQUE A RESPOSTA NÃO É UMA ══
   A tentação era rodar a varredura em cima das 8.599 e comemorar o que voltasse. A medição diz
   que isso seria pedir três mil vezes por dado que o PNCP não tem. O buraco tem TRÊS causas
   diferentes, e só uma delas é nossa. O que separa as três é a PORTA por onde a linha entrou:

     · a porta de CONSULTA (`/api/consulta/v1/contratacoes/publicacao`) TEM o campo da janela;
     · a porta de BUSCA (`/api/search/`) NÃO tem — medido campo a campo na resposta viva em
       19/08: 54 campos, nenhum `dataAberturaProposta`/`dataEncerramentoProposta`. Os campos de
       data que ela traz são publicação, atualização, assinatura e vigência do CONTRATO, que são
       outro fato. O `bruto->>_coleta = 'busca'` marca quem entrou por ali.

   E o cruzamento das duas com a modalidade é a resposta inteira (medido em 19/08, 11.843 linhas):

     entrou pela CONSULTA (perguntamos à porta certa)      com janela   sem janela   % com
       modalidade  6 · Pregão Eletrônico ................     1.659           1      99,94%
       modalidade  8 · Dispensa ..........................     1.583       1.608      49,6%
       modalidade  9 · Inexigibilidade ...................         2       1.273       0,16%

   >>> ISSO NÃO É BURACO NOSSO, É O FATO. Perguntamos à porta certa e o PNCP devolveu vazio para
       1.608 dispensas e 1.273 inexigibilidades — e faz sentido jurídico: dispensa e
       inexigibilidade são contratação DIRETA, e muitas simplesmente não abrem janela de
       proposta. O pregão eletrônico, que é competitivo por natureza, tem 99,94%. Repetir a
       varredura nessas 2.882 custaria requisição e não mudaria uma linha.
   >>> O BURACO DE VERDADE SÃO OS 3.108 PREGÕES ELETRÔNICOS QUE ENTRARAM PELA BUSCA. Pela porta
       certa, a taxa medida da modalidade 6 é 99,94% — ou seja, quase todos TÊM o dado lá, e o
       que falta é a gente perguntar. São 3.108 licitações competitivas em que a tela hoje não
       diz se ainda dá tempo.
   >>> E OS 2.068 CREDENCIAMENTOS (modalidade 12) SÃO O TERCEIRO CASO, E ELE SAI DECLARADO:
       o `coleta_pncp.js` varre `6,8,9` — a modalidade 12 NUNCA foi pedida à porta certa, nem uma
       vez. Então eu não tenho taxa medida para ela, e não vou inventar uma por analogia
       ("credenciamento é chamamento aberto, logo não tem prazo" é plausível e não é medição).
       Ela entra no alvo com prioridade baixa e a primeira rodada MEDE a taxa dela.

   ══ POR QUE ELE SONDA A PORTA ANTES DE COMEÇAR, E POR QUE A SONDA SEPARA 4xx DE 504 ═════════
   É a lei da A30, e ela nasceu de um defeito real: o watchdog tratava 4xx igual a timeout, e
   por isso dizia "o portal está fora" quando a verdade era "eu perguntei errado". Aqui a sonda
   classifica em três, e cada uma manda numa direção diferente:
       2xx ....... a porta está aberta — pode preencher
       4xx ....... a porta está aberta e a PERGUNTA está errada — conserta a pergunta, não espera
       5xx/timeout o serviço está fora — PULA, anota, e não dispara 3.000 requisições num muro
   Sem essa sonda, a primeira coisa que este arquivo faria num dia de PNCP fora seria bater 70
   segundos por combinação contra um gateway que responde 504.

   ══ ELE REUSA O COLETOR EM VEZ DE ESCREVER UM SEGUNDO ═══════════════════════════════════════
   O `tools/coleta_pncp.js` varre a janela INCREMENTAL (da última coleta boa até hoje) e não
   aceita mirar um dia de 2026-07-14. Chamá-lo por linha de comando não resolve o alvo desta
   fatia — mas reescrever a normalização aqui criaria a segunda régua do mesmo número, e no dia
   em que as duas discordassem sobre um campo, a errada estaria verde.
   >>> ENTÃO O QUE SE REUSA É EXATAMENTE A PARTE QUE PODE DIVERGIR: `normaliza` e `valida` vêm
       do coletor por `require` (ele tem `if (require.main !== module) return`, é feito para
       isso), junto com o breaker, o ritmo anti-429 e o backoff. O que fica aqui é só a pergunta
       (dia · uf · modalidade) e a mesma chamada de upsert, com o mesmo
       `on_conflict=portal,cnpj,ano,sequencial`. Zero campo mapeado duas vezes.
   >>> E ELE NÃO TOCA NO CARIMBO DE FRESCOR, de propósito. `coleta_status.ultima_ok` e
       `ultimo_dia_ok` falam de "até que dia o índice está EM DIA". Uma repescagem de 14/07 que
       avançasse esse carimbo faria a tela dizer que está em dia com hoje por causa de uma
       varredura de um mês atrás — mentira sobre a idade do dado, que é o defeito que o próprio
       coletor gasta quinze linhas para evitar.
   >>> A LEI DAS COLUNAS `resultado_*` FICA CUMPRIDA POR CONSTRUÇÃO: o corpo do upsert é o que o
       `normaliza` devolve, e ele não tem nenhuma delas.

     node tools/preenche_prazo.js                 -> mede o buraco e sonda a porta (NÃO grava)
     node tools/preenche_prazo.js --plano         -> + imprime o alvo, combinação a combinação
     node tools/preenche_prazo.js --preencher     -> roda o coletor no alvo e mede antes/depois
     node tools/preenche_prazo.js --preencher --teto 40   -> limita as combinações desta rodada
     node tools/preenche_prazo.js --mod 6         -> só uma modalidade
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
// O coletor tem `if (require.main !== module) return` — requerê-lo NÃO dispara coleta nenhuma.
const C = require('./coleta_pncp.js');

/* O SEGREDO É LIDO SÓ QUANDO ALGUÉM VAI USÁ-LO. Lê-lo no topo faria a suíte precisar de
   `segredos.local.txt` para testar três funções puras que não falam com banco nenhum — e teste
   que exige segredo é teste que não roda em máquina limpa. */
let _SB = null, _H = null;
function banco() {
  if (_SB) return { SB: _SB, H: _H };
  const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
  _SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
  const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
  if (!SR) { console.error('service_role nao encontrada em segredos.local.txt'); process.exit(1); }
  _H = { apikey: SR, Authorization: 'Bearer ' + SR };
  return { SB: _SB, H: _H };
}

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const PREENCHER = process.argv.includes('--preencher');
const PLANO = process.argv.includes('--plano');
const TETO_COMBOS = parseInt(arg('--teto'), 10) || 60;
const SO_MOD = (arg('--mod') || '').split(',').map(s => parseInt(s, 10)).filter(Boolean);

const dormir = ms => new Promise(r => setTimeout(r, ms));

/* TAM_PAGINA e o teto de páginas são os MESMOS do coletor e da edge function, e isso não é
   estilo: dois clientes com ritmos diferentes fazem a produção se comportar diferente do que
   se testa aqui (é o que a `testa_coleta_agendada` trava). */
const TAM_PAGINA = 50;
const TETO_PAGINAS = 40;
const TIMEOUT_MS = 20000;

/* O `puxa` do coletor mora depois do `return` do módulo e não é exportado, então ele é
   reescrito aqui — mas em cima das MESMAS peças exportadas (breaker, backoff, ritmo,
   esperaRateLimit), que são as que decidem o comportamento. 429 não é queda: ele desacelera e
   não gasta o orçamento de falhas, exatamente como lá. */
async function puxa(url, breaker, ritmo) {
  let t = 0, t429 = 0;
  while (t < 4) {
    if (breaker.aberto) return { erro: 'breaker aberto' };
    if (ritmo.estourou) return { erro: `rate limit persistente do PNCP (${ritmo.vezes}x)` };
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ac.signal });
      clearTimeout(to);
      if (r.status === 429) {
        const espera = C.esperaRateLimit(t429, r.headers.get('retry-after'));
        ritmo.freou(); t429++;
        await dormir(espera);
        continue;
      }
      if (!r.ok) { t++; breaker.falhou(); await dormir(C.esperaBackoff(t)); continue; }
      const j = await r.json();
      breaker.ok();
      return { dados: j.data || [], paginas: j.totalPaginas || 1 };
    } catch (e) {
      clearTimeout(to);
      t++; breaker.falhou();
      await dormir(C.esperaBackoff(t));
    }
  }
  return { erro: 'falhou 4x' };
}

/* A CONTAGEM VEM DO SERVIDOR (`Content-Range` com `count=exact`), como no `conta_indice.js`.
   Contar pelo `length` de um `select=*` devolveria 1000 sempre — o teto do PostgREST. */
async function conta(filtro) {
  const { SB, H } = banco();
  const r = await fetch(`${SB}/rest/v1/${filtro}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (!r.ok) throw new Error(filtro + ' -> HTTP ' + r.status);
  const n = parseInt(String(r.headers.get('content-range') || '').split('/')[1], 10);
  return isFinite(n) ? n : null;
}

/* Lê o índice inteiro em páginas de 1000, só as quatro colunas de que a conta precisa.
   É o nosso banco: 12 requisições internas, nenhuma contra o portal público. */
async function leIndice() {
  const { SB, H } = banco();
  const linhas = [];
  for (let off = 0; off < 60000; off += 1000) {
    const r = await fetch(`${SB}/rest/v1/licitacoes`
      + `?select=id,uf,modalidade_cod,data_publicacao,data_encerramento,bruto->>_coleta`
      + `&order=id&limit=1000&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error('leitura do indice -> HTTP ' + r.status);
    const j = await r.json();
    if (!j.length) break;
    linhas.push(...j);
    if (j.length < 1000) break;
  }
  return linhas;
}

/* ── A SONDA — a lei da A30, em três respostas e não em duas ───────────────────────────────── */
const PORTA_CONSULTA = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';

/* A CLASSIFICAÇÃO É PURA, e ela está separada da requisição de propósito: é ELA que carrega a
   lei da A30, e lei dentro de um `fetch` não tem como ser testada sem o portal na frente. */
function classificaSonda(http, erroDeRede) {
  if (erroDeRede) return 'fora';                       // timeout/queda: não houve resposta
  if (http >= 200 && http < 300) return 'aberta';
  if (http >= 400 && http < 500) return 'pergunta-errada';   // 4xx é NOSSO erro, não queda
  return 'fora';                                       // 5xx (inclusive o 504 do gateway)
}

async function sondaPorta() {
  const d = new Date(Date.now() - 864e5);
  const dia = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  /* A PERGUNTA DA SONDA É A MESMA QUE A COLETA FAZ, e isso é de propósito: sonda que pergunta
     diferente do coletor pode voltar verde para uma pergunta que o coletor nunca faria. Foi
     exatamente o defeito do watchdog na A30 (`tamanhoPagina=1`, que a API sempre recusa). */
  const url = `${PORTA_CONSULTA}?dataInicial=${dia}&dataFinal=${dia}`
    + `&codigoModalidadeContratacao=6&uf=GO&pagina=1&tamanhoPagina=50`;
  const t0 = Date.now();
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 75000);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ac.signal });
    clearTimeout(to);
    const corpo = (await r.text()).slice(0, 160).replace(/\s+/g, ' ');
    return { estado: classificaSonda(r.status, null), http: r.status, ms: Date.now() - t0, corpo };
  } catch (e) {
    clearTimeout(to);
    return { estado: classificaSonda(null, e), http: null, ms: Date.now() - t0,
             corpo: e.name + ': ' + e.message };
  }
}

/* ── O ALVO — só o que tem chance MEDIDA de voltar preenchido ──────────────────────────────── */
/* A taxa por modalidade é calculada AQUI, do próprio índice, e não escrita à mão: número
   chumbado num script envelhece calado, e este envelheceria a cada coleta. O que está no
   cabeçalho é o retrato do dia em que a fatia rodou; o que manda é esta conta. */
function taxaPorModalidade(linhas) {
  const t = new Map();
  for (const l of linhas) {
    if (l._coleta === 'busca') continue;          // a busca não traz o campo: não é amostra
    const k = l.modalidade_cod;
    if (k == null) continue;
    if (!t.has(k)) t.set(k, { com: 0, sem: 0 });
    t.get(k)[l.data_encerramento ? 'com' : 'sem']++;
  }
  return t;
}

function montaAlvo(linhas, taxas) {
  /* Só entram as linhas SEM prazo que entraram pela BUSCA — as que vieram pela consulta já
     receberam a resposta do PNCP, e "vazio" ali é o fato, não a falta de pergunta. */
  const combos = new Map();
  let jaPerguntamos = 0, semData = 0;
  for (const l of linhas) {
    if (l.data_encerramento) continue;
    if (l._coleta !== 'busca') { jaPerguntamos++; continue; }
    if (!l.data_publicacao || !l.modalidade_cod || !l.uf) { semData++; continue; }
    if (SO_MOD.length && !SO_MOD.includes(l.modalidade_cod)) continue;
    const k = l.data_publicacao + '|' + l.modalidade_cod + '|' + l.uf;
    if (!combos.has(k)) combos.set(k, { dia: l.data_publicacao, mod: l.modalidade_cod, uf: l.uf, linhas: 0 });
    combos.get(k).linhas++;
  }
  /* A ORDEM É POR RENDIMENTO ESPERADO — linhas × taxa medida daquela modalidade pela porta
     certa. Modalidade nunca pedida à porta certa entra com taxa DESCONHECIDA e vai para o fim,
     em vez de receber uma taxa inventada. Se a rodada for cortada no meio (breaker, 429, falta
     de luz), o que ficou pronto é o que mais responde "ainda dá tempo?". */
  const lista = [...combos.values()].map(c => {
    const t = taxas.get(c.mod);
    const amostra = t ? t.com + t.sem : 0;
    const taxa = amostra >= 30 ? t.com / amostra : null;   // amostra curta não vira taxa
    return { ...c, taxa, amostra, rende: c.linhas * (taxa == null ? 0.001 : taxa) };
  }).sort((a, b) => b.rende - a.rende);
  return { lista, jaPerguntamos, semData };
}

/* As três funções PURAS saem para a suíte. Elas são onde moram as decisões que erram calado:
   de quem se tira a taxa, quem entra no alvo, e o que separa "portal fora" de "perguntei
   errado". O resto deste arquivo é requisição, e requisição a suíte não testa sem o portal. */
module.exports = { taxaPorModalidade, montaAlvo, classificaSonda };
if (require.main !== module) return;

(async () => {
  console.log('PREENCHE PRAZO — "ainda da tempo?" para as licitacoes que nao sabem responder\n');

  const total = await conta('licitacoes?select=id');
  const semPrazoAntes = await conta('licitacoes?select=id&data_encerramento=is.null');
  console.log('ANTES:  ' + total + ' licitacoes no indice · ' + semPrazoAntes + ' sem janela de proposta ('
    + (100 * semPrazoAntes / total).toFixed(1) + '%)\n');

  const linhas = await leIndice();
  const taxas = taxaPorModalidade(linhas);

  console.log('POR QUE ELAS ESTAO SEM PRAZO — a taxa medida NA PORTA CERTA (a de consulta):');
  console.log('  mod    com janela   sem janela     taxa      leitura');
  const nomeMod = { 1: 'Leilao-E', 4: 'Concorrencia-E', 5: 'Concorrencia-P', 6: 'Pregao-E', 7: 'Pregao-P',
    8: 'Dispensa', 9: 'Inexigibilidade', 10: 'Manifestacao', 11: 'Pre-qualificacao', 12: 'Credenciamento',
    13: 'Leilao-P', 15: 'Concurso', 16: 'Concorrencia', 18: 'Pregao-EI' };
  for (const [mod, t] of [...taxas].sort((a, b) => (b[1].com + b[1].sem) - (a[1].com + a[1].sem))) {
    const n = t.com + t.sem;
    const taxa = n >= 30 ? (100 * t.com / n).toFixed(2) + '%' : 'amostra curta';
    const leitura = n < 30 ? 'nunca pedida o bastante — nao invento taxa'
      : t.com / n > 0.9 ? 'o PNCP TEM o dado — o que falta e perguntar'
      : t.com / n < 0.1 ? 'o PNCP NAO tem o dado — contratacao direta nao abre janela'
      : 'metade tem, metade nao — o fato varia caso a caso';
    console.log('  ' + String(mod).padStart(3) + String(t.com).padStart(12) + String(t.sem).padStart(13)
      + String(taxa).padStart(15) + '   ' + nomeMod[mod] + ': ' + leitura);
  }

  const { lista, jaPerguntamos, semData } = montaAlvo(linhas, taxas);
  const alvoLinhas = lista.reduce((s, c) => s + c.linhas, 0);
  const rende = Math.round(lista.reduce((s, c) => s + c.rende, 0));
  console.log('\nO BURACO, REPARTIDO PELA CAUSA:');
  console.log('  ' + String(jaPerguntamos).padStart(6) + '  ja perguntamos a porta certa e o PNCP devolveu VAZIO');
  console.log('            -> nao e buraco nosso; e o fato, e a tela ja o diz ("PRAZO NAO INFORMADO")');
  console.log('  ' + String(alvoLinhas).padStart(6) + '  entraram pela BUSCA, que nao carrega o campo — ESTAS sao o alvo');
  console.log('            -> ' + lista.length + ' combinacao(oes) dia x modalidade x uf, rendimento esperado ~' + rende + ' linhas');
  if (semData) console.log('  ' + String(semData).padStart(6) + '  sem data de publicacao/modalidade/uf — nao da para montar a pergunta');

  if (PLANO || PREENCHER) {
    console.log('\nALVO, por rendimento esperado (as 15 primeiras de ' + lista.length + '):');
    lista.slice(0, 15).forEach(c => console.log('   ' + c.dia + ' · mod ' + String(c.mod).padStart(2)
      + ' · ' + c.uf + ' · ' + String(c.linhas).padStart(4) + ' linha(s) · taxa '
      + (c.taxa == null ? 'DESCONHECIDA' : (100 * c.taxa).toFixed(1) + '%')));
  }

  console.log('\nSONDA DA PORTA DE CONSULTA (a mesma pergunta que a coleta faz):');
  const s = await sondaPorta();
  console.log('   ' + (s.http ? 'HTTP ' + s.http : 'sem resposta') + ' em ' + s.ms + 'ms  ->  ' + s.estado.toUpperCase());
  console.log('   ' + s.corpo);

  if (s.estado === 'pergunta-errada') {
    console.log('\n>>> A PORTA ESTA ABERTA E A PERGUNTA ESTA ERRADA (4xx). Isto NAO e "portal fora":');
    console.log('    e a lei da A19/A30. Conserte a pergunta desta sonda antes de culpar o PNCP.');
    process.exitCode = 1; return;
  }
  if (s.estado === 'fora') {
    console.log('\n>>> A PORTA DE CONSULTA ESTA FORA. PULEI o preenchimento, e de proposito: com o');
    console.log('    servico fora, as ' + lista.length + ' combinacoes gastariam ' + Math.round(lista.length * 70 / 60)
      + ' minutos batendo num gateway que responde 504.');
    console.log('    O que NAO mudou: as ' + semPrazoAntes + ' linhas continuam sem prazo, e a tela continua');
    console.log('    dizendo "PRAZO NAO INFORMADO" em vez de fingir que sabe. Rode de novo quando voltar.');
    process.exitCode = 2; return;
  }

  console.log('\n>>> A PORTA ESTA ABERTA.');
  if (!PREENCHER) {
    console.log('    Nada foi gravado (falta `--preencher`). Com ela, rodaria ' + Math.min(lista.length, TETO_COMBOS)
      + ' de ' + lista.length + ' combinacao(oes) — o teto desta rodada e --teto ' + TETO_COMBOS + '.');
    return;
  }

  /* ── O PREENCHIMENTO — uma coisa de cada vez contra o portal público ───────────────────────
     Combinação que falhar NÃO derruba a rodada: anota e segue, que é a regra da casa para
     portal público. E o breaker é COMPARTILHADO entre as combinações: cinco falhas seguidas
     param tudo, porque a essa altura o problema não é a combinação, é o portal. */
  const aRodar = lista.slice(0, TETO_COMBOS);
  if (lista.length > TETO_COMBOS)
    console.log('    ⚠️  TETO: ' + aRodar.length + ' de ' + lista.length + ' combinacoes nesta rodada. '
      + 'As outras ' + (lista.length - aRodar.length) + ' ficam para a proxima — e estao ditas aqui, nao truncadas em silencio.');

  const breaker = C.criaBreaker(C.FALHAS_ATE_ABRIR);
  const ritmo = C.criaRitmo();
  let feitas = 0, gravadas = 0; const falhas = [];

  /* ══ ESTE LAÇO RODAVA CALADO, E ISSO CUSTOU UMA TARDE DE DÚVIDA (A36 · 20/08) ════════════════
     Medido hoje: chamado pela `carga_diaria.js` com orçamento de 39 minutos e a porta aberta, ele
     imprimia a sonda e depois NADA — nem uma linha por combinação. Quem olha o log vê um processo
     parado há meia hora e não tem como distinguir "trabalhando" de "travado".
     >>> E O SILÊNCIO CUSTA MAIS DO QUE PARECE: o `[N/M]` é a única testemunha que a
         `carga_diaria` tem de quanto uma etapa REALMENTE processou antes de o relógio matá-la.
         Sem ele, a etapa de prazos entra no carimbo com `feito: null` e a rodada seguinte não
         aprende nada sobre o ritmo dela.
     >>> O FORMATO É O MESMO `[N/M]` das outras etapas, de propósito: o condutor lê UM formato, e
         um segundo formato aqui seria uma segunda régua para o mesmo número. */
  let n = 0;
  for (const c of aRodar) {
    n++;
    if (breaker.aberto || ritmo.estourou) {
      falhas.push(c.dia + '/' + c.uf + '/mod' + c.mod + ': rodada cortada (breaker/rate limit)');
      console.log(`  [${n}/${aRodar.length}] ${c.dia} ${c.uf} mod${c.mod}  ⏭️ cortada (breaker/rate limit)`);
      continue;
    }
    const dia = c.dia.replace(/-/g, '');
    const achados = new Map();
    let pag = 1, totalPag = 1, ruim = null;
    do {
      const url = `${PORTA_CONSULTA}?dataInicial=${dia}&dataFinal=${dia}`
        + `&codigoModalidadeContratacao=${c.mod}&uf=${c.uf}&pagina=${pag}&tamanhoPagina=${TAM_PAGINA}`;
      const r = await puxa(url, breaker, ritmo);
      if (r.erro) { ruim = r.erro; break; }
      totalPag = Math.min(r.paginas || 1, TETO_PAGINAS);
      for (const x of r.dados) {
        const n = C.normaliza(x);
        if (!C.valida(n)) continue;
        achados.set(`${n.cnpj}|${n.ano}|${n.sequencial}`, n);
      }
      pag++;
      await dormir(ritmo.pausa);
    } while (pag <= totalPag && !breaker.aberto);

    if (ruim) {
      falhas.push(c.dia + '/' + c.uf + '/mod' + c.mod + ': ' + ruim);
      console.log(`  [${n}/${aRodar.length}] ${c.dia} ${c.uf} mod${c.mod}  ⚠️ ${ruim}`);
      await dormir(1200); continue;
    }

    /* O UPSERT É O MESMO DO COLETOR — mesma chave natural, mesma resolução de conflito. O que
       ele faz aqui é PREENCHER a janela das linhas que a busca deixou nulas, sem duplicar
       nenhuma: a chave (portal, cnpj, ano, sequencial) já existe. */
    const regs = [...achados.values()];
    /* A LINHA SAI ANTES DO UPSERT e diz QUANTAS voltaram da porta. Zero aqui é resposta legítima
       (aquele dia/UF/modalidade não teve contratação) e precisa ser visível: uma sequência de
       zeros é a notícia de que o alvo está mal escolhido, e ela não pode se parecer com silêncio. */
    console.log(`  [${n}/${aRodar.length}] ${c.dia} ${c.uf} mod${c.mod}  ${regs.length} da porta`);
    const { SB, H } = banco();
    for (let i = 0; i < regs.length; i += 200) {
      const lote = regs.slice(i, i + 200);
      const r = await fetch(`${SB}/rest/v1/licitacoes?on_conflict=portal,cnpj,ano,sequencial`, {
        method: 'POST',
        headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(lote),
      });
      if (!r.ok) { falhas.push(c.dia + '/' + c.uf + '/mod' + c.mod + ': upsert HTTP ' + r.status); break; }
      gravadas += lote.length;
    }
    feitas++;
    await dormir(1200);   // ritmo educado ENTRE combinacoes, alem do que o `puxa` ja faz
  }

  const semPrazoDepois = await conta('licitacoes?select=id&data_encerramento=is.null');
  console.log('\n───────────────────────────────');
  console.log('DEPOIS: ' + semPrazoDepois + ' sem janela (era ' + semPrazoAntes + ') — '
    + (semPrazoAntes - semPrazoDepois) + ' linha(s) passaram a responder "ainda da tempo?"');
  console.log('combinacoes: ' + feitas + ' ok, ' + falhas.length + ' falha(s) de ' + aRodar.length
    + ' · ' + gravadas + ' registro(s) enviados ao upsert (a maioria e ATUALIZACAO, nao linha nova)');
  falhas.slice(0, 10).forEach(f => console.log('   PULOU ' + f));
  if (semPrazoDepois > 0) {
    console.log('\nO QUE CONTINUA SEM PRAZO, E POR QUE — rode `node tools/preenche_prazo.js` de novo:');
    console.log('   a conta por causa sai no topo do relatorio, e ela separa "o PNCP nao tem"');
    console.log('   de "a gente ainda nao perguntou". As duas continuam contadas em voz alta.');
  }
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
