/* ══════════════════════════════════════════════════════════════════════════════════════════
   watchdog_pncp.js — A ROTINA QUE ESPERA O PNCP VOLTAR (fatia A18, 14/08/2026)

   ══ 15/08/2026 (fatia A30): A API DE CONSULTA ESTÁ NO AR — E ERA ESTE ARQUIVO QUE NÃO
      CONSEGUIA PERCEBER ════════════════════════════════════════════════════════════════════════
   Tudo o que está escrito logo abaixo sobre "a API de consulta está fora" foi verdade em 14/08 e
   **deixou de ser**. Medido em 15/08, nesta máquina, com 1,5 s entre as chamadas:

       tamanhoPagina=1  ->  HTTP 400 em 305 ms   ("must be greater than or equal to 10")
       tamanhoPagina=10 ->  HTTP 200 em 727 ms   (dado de verdade: IBAMA, publicado em 13/08)

   A sonda pedia UM registro; a API exige DEZ no mínimo e recusa o resto. E o watchdog carimbava
   esse HTTP 400 como "fora do ar" — igualzinho a um timeout de 20 s. Ele teria dito "fora" para
   sempre, com carimbo de hora e tudo, enquanto o portal respondia em menos de um segundo.
   Os dois defeitos estão consertados abaixo, cada um explicado no seu lugar:
     · `TAM_SONDA = 10`, o mínimo que a API aceita;
     · e a sonda passou a separar "o portal não respondeu" de "eu perguntei errado".
   >>> O QUE ISSO NÃO DESFAZ: a A13 mediu TimeoutError de 30 s em 14/08, e aquilo era real. A API
       esteve fora mesmo. O que este arquivo não sabia fazer era perceber a VOLTA — que é a única
       coisa para a qual ele foi construído.

   ══ O PROBLEMA, MEDIDO E NÃO SUPOSTO (o retrato de 14/08, mantido como registro) ════════════
   A API de CONSULTA do PNCP — a que alimenta a varredura diária — está fora. Medido em 14/08,
   e conferido de novo hoje nesta fatia:

       /api/consulta/v1/contratacoes/publicacao ....... TimeoutError em 30.009 ms
       /api/pncp/v1/orgaos/.../compras/.../itens ...... HTTP 404 em 88 ms (respondeu)

   Ou seja: o portal está DE PÉ e a porta que a varredura usa é que não abre. Não é defeito
   nosso, e não há o que consertar deste lado — falta a janela em que ela responda.

   Enquanto isso, a porta que ficou aberta (`coleta_pncp_busca.js`, fatia A13) traz a licitação
   SEM a janela de proposta, e a deixa NULL de propósito: data inventada num sistema de prazo é
   pior que data ausente. São 1.955 linhas assim.

   >>> O QUE NÃO DÁ PRA FAZER É FICAR OLHANDO. A volta pode ser às 3 da manhã de um domingo, e a
       janela pode durar minutos. Quem tem que perceber é uma rotina, não uma pessoa — e é a
       diferença entre "quando o PNCP voltar a gente recolhe" e recolher de verdade.

   ══ O QUE ELE FAZ ══════════════════════════════════════════════════════════════════════════
     1. SONDA a API de consulta com UMA requisição de UM registro (o pedido mais barato que
        ainda prova que ela responde);
     2. GRAVA a sondagem em `pncp_sondagens` — a que falhou também, porque é ela que dá a
        duração da queda. Um log só de sucessos diria "voltou às 04h12" sem dizer desde quando
        estava fora;
     3. na VIRADA de fora → no ar, DISPARA sozinho a varredura normal (`coleta_pncp.js`), que é
        quem preenche as datas pela mesma chave natural;
     4. registra o antes e o depois da contagem de datas nulas — porque "a API voltou" sem "e a
        varredura serviu pra alguma coisa" é meia notícia.

   ══ O QUE ELE NÃO FAZ, E POR QUÊ ═══════════════════════════════════════════════════════════
   >>> NÃO RECUA TRÊS ANOS. As 1.955 linhas com data nula vão de 12/09/2023 a 14/08/2026. Mandar
       a varredura cobrir 1.070 dias contra uma API pública que acabou de voltar do fora do ar
       não é diligência, é a primeira coisa que a derrubaria de novo. Ele dispara a varredura
       NORMAL — incremental, com backoff, breaker e rodízio de UF já embutidos —, e ela recolhe
       a janela recente. As antigas ficam para rodadas seguintes, e o log DIZ quantas ficaram.
       Um watchdog que mente sobre cobertura é pior que nenhum.
   >>> NÃO INVENTA DATA. Ele não deduz janela de proposta de lugar nenhum: ou o PNCP responde,
       ou a coluna continua NULL.
   >>> NÃO SONDA EM LAÇO. Uma execução = uma sondagem. Quem repete é o agendador (ABRIR_FILA /
       tarefa do Windows / Actions). Laço aqui viraria um processo eterno batendo num portal
       público, que é exatamente o que o circuit breaker do coletor existe pra impedir.

     node tools/watchdog_pncp.js                 (sonda, grava e dispara se voltou)
     node tools/watchdog_pncp.js --so-sondar     (sonda e grava; não dispara nada)
     node tools/watchdog_pncp.js --forca-disparo (dispara mesmo sem virada — para conferir)
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const RAIZ = path.join(__dirname, '..');

/* A URL DA SONDA É A MESMA DA VARREDURA. Sondar um endereço diferente do que a varredura usa
   seria testar uma porta e abrir outra — e o dia em que só a de consulta caísse, o watchdog
   diria "no ar" e a varredura falharia em seguida. */
const URL_SONDA = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';

/* ══ E O TAMANHO DA PÁGINA É O DEFEITO INTEIRO DA A18 (achado na fatia A30) ══════════════════
   A sonda nasceu com `tamanhoPagina=1` — "uma requisição de UM registro", que era a intenção
   educada. A API do PNCP RECUSA 1: `must be greater than or equal to 10`, HTTP 400 em 305 ms.
   >>> E O NÚMERO CERTO JÁ ESTAVA ESCRITO NESTA CASA. O `fpmed_licitacoes.html` tem, desde
       04/08: *"tamanhoPagina=10: MEDIDO em 04/08. (…) O mínimo aceito pela API é 10."* A
       informação existia no repositório, medida e comentada, e a fatia A18 escreveu 1 assim
       mesmo. Não foi falta de medição — foi uma medição que já existia e não foi consultada.
   >>> 10 CONTINUA SENDO O PEDIDO MAIS BARATO POSSÍVEL: é o mínimo que a API aceita. Não dá
       para pedir menos, e por isso a educação da sonda não mudou nada. */
const TAM_SONDA = 10;
/* 20 s é o MESMO teto do coletor. A sondagem tem que falhar pelo mesmo critério pelo qual a
   varredura falha; um teto mais generoso aqui declararia "no ar" uma API que a varredura não
   consegue usar. */
const TIMEOUT_MS = 20000;

function yyyymmdd(d) {
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

/* ══ A SONDA ═══════════════════════════════════════════════════════════════════════════════
   Sem retentativa, e isso é desenho: o watchdog responde "ela está no ar AGORA?", e insistir
   três vezes transformaria a resposta em "ela esteve no ar em algum momento dos últimos dois
   minutos". Quem insiste é a varredura, que tem backoff e breaker para isso. */
async function sonda(dep) {
  const buscar = dep.buscar;
  const ontem = new Date(dep.agora());
  ontem.setDate(ontem.getDate() - 1);
  const url = URL_SONDA + `?dataInicial=${yyyymmdd(ontem)}&dataFinal=${yyyymmdd(ontem)}`
    + '&codigoModalidadeContratacao=6&uf=GO&pagina=1&tamanhoPagina=' + TAM_SONDA;
  const t0 = Date.now();
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await buscar(url, { signal: ac.signal });
    clearTimeout(to);
    const ms = Date.now() - t0;
    /* 204 É RESPOSTA: "não houve publicação nesse dia nessa UF" prova que a API está viva tanto
       quanto um 200 cheio. Exigir dado faria um domingo sem licitação parecer queda.
       429 TAMBÉM É RESPOSTA, e das mais claras: só quem está no ar sabe dizer "devagar". */
    const noAr = r.status === 200 || r.status === 204 || r.status === 429;
    /* ══ E O 4xx NÃO É "FORA DO AR": É "EU PERGUNTEI ERRADO" (fatia A30) ═══════════════════════
       Esta é a causa por baixo do `tamanhoPagina=1`. Um HTTP 400 em 305 ms é o servidor VIVO
       recusando o MEU pedido — e o watchdog o carimbava como queda do portal, exatamente como
       carimbaria um timeout de 20 s. Duas coisas opostas com o mesmo nome:
         · timeout / rede ..... o portal não respondeu. Não há o que fazer deste lado; é esperar.
         · HTTP 4xx ........... o portal respondeu, e disse que a MINHA pergunta está errada.
                                Há tudo a fazer, e do nosso lado.
       É a mesma lei da fatia A19, que já custou caro uma vez: *"não consegui perguntar" NUNCA
       vira "não existe"*. Aqui ela aparece pelo avesso — "perguntei errado" virava "o portal
       está fora", e o resultado é um vigia que espera para sempre uma queda que já terminou. */
    const culpaNossa = r.status >= 400 && r.status < 500 && r.status !== 429;
    let corpo = '';
    if (culpaNossa) { try { corpo = (await r.text()).slice(0, 160); } catch (e) { corpo = ''; } }
    return { no_ar: noAr, http: r.status, ms, sondaErrada: culpaNossa,
      erro: noAr ? null
        : culpaNossa
          ? 'A SONDA ESTA ERRADA, e nao o portal: HTTP ' + r.status + ' em ' + ms
            + 'ms — o PNCP respondeu e recusou o pedido' + (corpo ? ' · ' + corpo : '')
          : 'HTTP ' + r.status };
  } catch (e) {
    clearTimeout(to);
    return {
      no_ar: false, http: null, ms: Date.now() - t0,
      erro: e.name === 'AbortError' ? `timeout em ${TIMEOUT_MS} ms` : String(e.message || e.name),
    };
  }
}

/* ══ A VIRADA ══════════════════════════════════════════════════════════════════════════════
   Função PURA de propósito: é ela que decide se hoje é notícia, e uma decisão dessas tem que
   ser testável sem rede, sem banco e sem esperar o PNCP cair.
   >>> A PRIMEIRA SONDAGEM DE TODAS NÃO É VIRADA. Sem anterior não há "mudou"; chamar de virada
       faria o watchdog anunciar "o PNCP VOLTOU" na primeira vez que rodasse, com a API tendo
       ficado no ar o tempo todo — e a primeira notícia dele seria falsa. */
function decideVirada(anterior, atual, agora) {
  if (!anterior) return { virada: false, fora_desde: null, fora_minutos: null, primeira: true };
  if (!!anterior.no_ar === !!atual.no_ar) return { virada: false, fora_desde: null, fora_minutos: null };
  if (!atual.no_ar) return { virada: true, fora_desde: null, fora_minutos: null };   // caiu
  /* VOLTOU: a queda começou na PRIMEIRA sondagem falha da sequência, e não na última. Usar a
     última faria toda queda parecer ter durado um intervalo de agendador. */
  const desde = anterior.fora_desde_calculado || anterior.criado_em || null;
  const min = desde ? Math.round((new Date(agora) - new Date(desde)) / 60000) : null;
  return { virada: true, fora_desde: desde, fora_minutos: min };
}

// ── as dependências reais (o banco, o PNCP, a varredura) ───────────────────────────────────
function dependenciasReais() {
  const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
  const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
  const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
  const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };
  return {
    buscar: (u, o) => fetch(u, o),
    agora: () => new Date(),
    log: (...a) => console.log(...a),

    /* A ÚLTIMA SONDAGEM, E O INÍCIO DA QUEDA JUNTO. Para saber "desde quando está fora" não
       basta a última linha: é preciso a primeira falha da sequência atual. Vêm as 200 últimas
       de uma vez (uma requisição) e a conta é feita aqui — 200 sondagens a 15 min são dois
       dias, e queda mais longa que isso o log declara como "pelo menos". */
    async leUltima() {
      const r = await fetch(`${SB}/rest/v1/pncp_sondagens`
        + '?select=id,no_ar,criado_em&api=eq.consulta&order=criado_em.desc&limit=200', { headers: H });
      if (!r.ok) throw new Error('não consegui ler pncp_sondagens: HTTP ' + r.status);
      const j = await r.json();
      if (!j.length) return null;
      const ult = j[0];
      let inicio = ult.criado_em;
      for (const s of j) { if (!!s.no_ar !== !!ult.no_ar) break; inicio = s.criado_em; }
      return { ...ult, fora_desde_calculado: inicio, amostra: j.length };
    },

    async grava(linha) {
      const r = await fetch(`${SB}/rest/v1/pncp_sondagens`, {
        method: 'POST', headers: { ...H, Prefer: 'return=representation' },
        body: JSON.stringify(linha),
      });
      if (!r.ok) throw new Error('não consegui gravar a sondagem: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
      return (await r.json())[0];
    },

    /* ══ O `r.ok` ENTROU NA FATIA A36 (20/08) ══════════════════════════════════════════════════
       Sem ele, um 401 fazia esta função devolver `NaN` — porque a resposta de erro não traz
       `content-range` e `Number(undefined)` é NaN. E NaN é o pior tipo de "não sei": ele não
       levanta, não é falso, e vai parar no log do watchdog dentro de uma frase.
       >>> `null` É O "NÃO SEI" DESTA CASA, e quem chama já sabe distinguir. A regra é a mesma
           da A19: não consegui perguntar nunca vira uma resposta. */
    async contaNulas() {
      const r = await fetch(`${SB}/rest/v1/licitacoes?select=id&data_abertura=is.null`,
        { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
      if (!r.ok) return null;
      const n = Number((r.headers.get('content-range') || '').split('/')[1]);
      return isFinite(n) ? n : null;
    },

    /* A VARREDURA NORMAL, e não uma segunda coleta escrita aqui. O `coleta_pncp.js` já tem
       backoff, circuit breaker, rodízio de UF com memória e janela incremental — reescrever
       qualquer parte disso seria criar um segundo coletor com um segundo comportamento contra
       o mesmo portal público. O watchdog só APERTA O BOTÃO. */
    dispara() {
      return new Promise(resolve => {
        const p = execFile(process.execPath, [path.join(__dirname, 'coleta_pncp.js')],
          { cwd: RAIZ, maxBuffer: 32 * 1024 * 1024, timeout: 20 * 60000 },
          (err, stdout, stderr) => resolve({
            ok: !err, erro: err ? String(err.message || err).slice(0, 400) : null,
            saida: String(stdout || '').split('\n').slice(-12).join('\n'),
          }));
        p.stdout.on('data', d => process.stdout.write('    | ' + String(d).replace(/\n(?!$)/g, '\n    | ')));
      });
    },
  };
}

/* ══ A RODADA ══════════════════════════════════════════════════════════════════════════════
   Toda ela recebe as dependências de fora. É o que permite provar o caminho da VOLTA sem
   esperar o PNCP voltar de verdade — e o caminho da volta é justamente o que nunca é exercitado
   quando se testa com o mundo real, porque o mundo real está fora do ar. */
async function roda(dep, opcoes) {
  const o = opcoes || {};
  const log = dep.log || (() => {});
  const anterior = await dep.leUltima();
  const atual = await sonda(dep);
  const v = decideVirada(anterior, atual, dep.agora());

  log(`  sondagem: ${atual.no_ar ? 'NO AR' : 'FORA'}`
    + (atual.http ? ` · HTTP ${atual.http}` : '') + ` · ${atual.ms} ms`
    + (atual.erro ? ` · ${atual.erro}` : ''));
  if (anterior) log(`  anterior: ${anterior.no_ar ? 'NO AR' : 'FORA'} em ${String(anterior.criado_em).slice(0, 19)}`);
  else log('  anterior: (nenhuma — esta é a primeira sondagem, e primeira nunca é virada)');

  const linha = {
    api: 'consulta', no_ar: atual.no_ar, http: atual.http, ms: atual.ms, erro: atual.erro,
    virada: v.virada, fora_desde: v.fora_desde || null, fora_minutos: v.fora_minutos,
  };

  /* O DISPARO ACONTECE NA VIRADA DE VOLTA, e só nela. Disparar a cada sondagem "no ar" faria a
     varredura rodar de 15 em 15 minutos para sempre depois que a API se estabilizasse. */
  const deveDisparar = (v.virada && atual.no_ar) || o.forcaDisparo === true;
  if (deveDisparar && !o.soSondar) {
    linha.datas_antes = await dep.contaNulas();
    log(`\n  >>> ${o.forcaDisparo && !v.virada ? 'DISPARO FORÇADO' : 'O PNCP VOLTOU'}`
      + (v.fora_minutos != null ? ` (ficou fora ${v.fora_minutos} min)` : '')
      + ` — datas de abertura nulas agora: ${linha.datas_antes == null ? 'não consegui contar' : linha.datas_antes}`);
    log('  >>> disparando a varredura normal (tools/coleta_pncp.js)…\n');
    const r = await dep.dispara();
    linha.disparou = true;
    linha.disparo_erro = r.ok ? null : r.erro;
    linha.datas_depois = await dep.contaNulas();
    log(`\n  varredura: ${r.ok ? 'terminou' : 'FALHOU — ' + r.erro}`);
    /* A SUBTRAÇÃO SÓ SAI QUANDO AS DUAS PONTAS FORAM MEDIDAS. Com uma delas em "não sei", o
       `antes - depois` viraria NaN — ou, pior, um número plausível se um dos lados fosse zero.
       "Preencheu N" é uma afirmação sobre trabalho feito; ela não pode nascer de uma conta que
       não pôde ser feita. */
    log(`  datas de abertura nulas: ${linha.datas_antes == null ? '?' : linha.datas_antes}`
      + ` -> ${linha.datas_depois == null ? '?' : linha.datas_depois}`
      + (linha.datas_antes != null && linha.datas_depois != null
          ? `  (${linha.datas_antes - linha.datas_depois} preenchida(s))`
          : '  (não consegui contar as duas pontas — não dá para dizer quantas foram)'));
    /* A CONTA QUE FALTA É A HONESTA: sobrou o quê? A varredura normal cobre a janela recente,
       e as linhas antigas ficam para as rodadas seguintes. Dizer só "preencheu N" faria uma
       cobertura parcial parecer completa — o defeito que esta obra já pagou três vezes. */
    if (linha.datas_depois > 0) {
      log(`  ⚠️  ainda faltam ${linha.datas_depois} — a varredura normal é incremental e cobre a`);
      log('      janela recente; as antigas voltam nas próximas rodadas. Não é conclusão, é saldo.');
    }
  } else if (deveDisparar && o.soSondar) {
    log('\n  >>> houve virada, mas --so-sondar: nada foi disparado (a sondagem FICA gravada).');
  }

  const gravada = await dep.grava(linha);
  if (v.primeira) log('\n  (primeira sondagem registrada — a próxima já sabe comparar)');
  else if (v.virada) log(`\n  *** VIRADA REGISTRADA: ${atual.no_ar ? 'o PNCP VOLTOU' : 'o PNCP CAIU'} ***`);
  else log('\n  (sem mudança de estado — nada a anunciar)');
  return { anterior, atual, virada: v, linha, gravada };
}

module.exports = { sonda, decideVirada, roda, dependenciasReais, URL_SONDA, TAM_SONDA, TIMEOUT_MS, yyyymmdd };

if (require.main === module) {
  const tem = n => process.argv.includes(n);
  (async () => {
    console.log('=== WATCHDOG DO PNCP (fatia A18) ===\n');
    const r = await roda(dependenciasReais(), { soSondar: tem('--so-sondar'), forcaDisparo: tem('--forca-disparo') });
    process.exitCode = 0;   // sondagem que falha NÃO é falha do watchdog: é a notícia dele.
    return r;
  })().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
}
