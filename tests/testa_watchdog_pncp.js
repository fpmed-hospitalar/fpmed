// SUITE testa_watchdog_pncp — A ROTINA QUE ESPERA O PNCP VOLTAR (fatia A18, 14/08/2026).
//
// == POR QUE ESTA SUITE E O UNICO JEITO DE PROVAR ESTE CODIGO ====================
// O caminho que importa no watchdog e o da VOLTA — e ele e, por definicao, o que
// nao acontece enquanto se testa. A API de consulta do PNCP esta fora desde 14/08
// (medido: TimeoutError em 20.013 ms hoje mesmo, na primeira sondagem gravada).
// Esperar ela voltar pra descobrir se o watchdog funciona e exatamente o desenho
// que o watchdog existe pra evitar.
// Por isso a rodada inteira recebe as dependencias de fora: aqui o PNCP e um
// dublê que responde o que a suite mandar, o banco e um array, e a varredura e uma
// funcao que anota que foi chamada. O que roda e o codigo de verdade.
//
// == O QUE ESTA SUITE PROTEGE ===================================================
//  1. QUE A PRIMEIRA SONDAGEM NAO SEJA VIRADA. Sem anterior nao ha "mudou", e
//     anunciar "o PNCP VOLTOU" na estreia faria a primeira noticia dele ser falsa.
//  2. QUE A VOLTA DISPARE A VARREDURA — uma vez, e nao a cada sondagem "no ar"
//     depois que a API se estabilizar (isso viraria uma varredura de 15 em 15 min
//     para sempre, batendo num portal publico).
//  3. QUE A DURACAO DA QUEDA SAIA DA PRIMEIRA FALHA DA SEQUENCIA, e nao da ultima
//     — senao toda queda pareceria durar um intervalo de agendador.
//  4. QUE 204 E 429 CONTEM COMO "NO AR". Domingo sem licitacao nao e queda, e
//     "devagar" so quem esta no ar sabe dizer.
//  5. QUE A SONDAGEM QUE FALHOU SEJA GRAVADA. Log so de sucesso diria "voltou as
//     04h12" sem dizer desde quando estava fora.
//  6. QUE ELE NAO INVENTE DATA e nao reimplemente o coletor.
//
//   node tests/testa_watchdog_pncp.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const W = require('../tools/watchdog_pncp.js');
const FONTE = R('tools', 'watchdog_pncp.js');
const DDL = R('ddl', 'pncp_sondagens.sql');
const semJs = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const Wc = semJs(FONTE);

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_watchdog_pncp — a rotina que espera o PNCP voltar (fatia A18)\n');

/* ══ O MUNDO DE MENTIRA ════════════════════════════════════════════════════════════════════
   `historico` e o banco: as sondagens ja gravadas, da mais nova pra mais velha — e a leitura
   reproduz a mesma conta da dependencia real (achar a PRIMEIRA falha da sequencia atual). */
function mundo(cfg) {
  const c = cfg || {};
  const gravadas = [];
  let disparos = 0;
  const hist = (c.historico || []).slice();
  return {
    gravadas, get disparos() { return disparos; },
    dep: {
      agora: () => new Date(c.agora || '2026-08-15T04:12:00.000Z'),
      log: () => {},
      buscar: async (url, o) => {
        if (c.resposta === 'timeout') {
          /* O ABORT DE VERDADE: a sonda arma um AbortController de 20s e a suite nao pode
             esperar 20 segundos. O dublê aborta na hora, pelo mesmo sinal — o que se exercita
             e o `catch` real do codigo, e nao um atalho. */
          const e = new Error('The operation was aborted'); e.name = 'AbortError'; throw e;
        }
        if (c.resposta === 'rede') throw new Error('fetch failed');
        return { status: c.resposta };
      },
      async leUltima() {
        if (!hist.length) return null;
        const ult = hist[0];
        let inicio = ult.criado_em;
        for (const s of hist) { if (!!s.no_ar !== !!ult.no_ar) break; inicio = s.criado_em; }
        return { ...ult, fora_desde_calculado: inicio, amostra: hist.length };
      },
      async grava(l) { gravadas.push(l); return { id: gravadas.length, ...l }; },
      async contaNulas() { return disparos ? (c.nulasDepois != null ? c.nulasDepois : 1900) : (c.nulasAntes != null ? c.nulasAntes : 1955); },
      async dispara() { disparos++; return { ok: c.disparoOk === false ? false : true, erro: c.disparoOk === false ? 'a varredura quebrou' : null, saida: '' }; },
    },
  };
}
const FORA = t => ({ no_ar: false, criado_em: t });
const NOAR = t => ({ no_ar: true, criado_em: t });

(async () => {
  // ══════════ 1. A PRIMEIRA SONDAGEM NUNCA E VIRADA ══════════
  {
    const m = mundo({ resposta: 200, historico: [] });
    const r = await W.roda(m.dep, {});
    ok(n + '. *** a primeira sondagem de todas NAO e virada (nao ha "mudou" sem anterior) ***',
      r.virada.virada === false && r.virada.primeira === true); n++;
    ok(n + '. ...e ela NAO dispara a varredura (a estreia nao pode ser uma noticia falsa)',
      m.disparos === 0); n++;
    ok(n + '. ...mas FICA gravada, para a proxima ter com o que comparar',
      m.gravadas.length === 1 && m.gravadas[0].no_ar === true); n++;
  }

  // ══════════ 2. FORA CONTINUA FORA: NADA ACONTECE, MAS TUDO E REGISTRADO ══════════
  {
    const m = mundo({ resposta: 'timeout', historico: [FORA('2026-08-15T04:00:00Z'), FORA('2026-08-14T20:00:00Z')] });
    const r = await W.roda(m.dep, {});
    ok(n + '. *** fora -> fora nao e virada, e nao dispara nada ***',
      r.virada.virada === false && m.disparos === 0); n++;
    /* Log so de sucesso diria "voltou as 04h12" sem dizer desde quando estava fora. A duracao
       da queda so existe se as tentativas que FALHARAM tambem estiverem registradas. */
    ok(n + '. *** a sondagem que FALHOU tambem e gravada (e ela que da a duracao da queda) ***',
      m.gravadas.length === 1 && m.gravadas[0].no_ar === false
      && /timeout em 20000 ms/.test(m.gravadas[0].erro), m.gravadas[0]); n++;
    ok(n + '. ...e o tempo da tentativa entra junto (timeout tambem e medida)',
      typeof m.gravadas[0].ms === 'number'); n++;
  }

  // ══════════ 3. A VOLTA — O CAMINHO QUE O MUNDO REAL NAO DEIXA EXERCITAR ══════════
  {
    /* A queda comecou as 20h de 14/08 e a sondagem de agora e 04h12 de 15/08 = 492 min. As duas
       sondagens FORA sao da mesma sequencia; a NO AR mais velha e de antes da queda. */
    const m = mundo({
      resposta: 200, agora: '2026-08-15T04:12:00.000Z',
      historico: [FORA('2026-08-15T04:00:00Z'), FORA('2026-08-14T20:00:00Z'), NOAR('2026-08-14T19:45:00Z')],
      nulasAntes: 1955, nulasDepois: 1902,
    });
    const r = await W.roda(m.dep, {});
    ok(n + '. *** SIMULANDO A VOLTA: fora -> no ar E VIRADA ***', r.virada.virada === true); n++;
    ok(n + '. *** e a virada DISPARA a varredura normal, sozinha ***', m.disparos === 1); n++;
    /* Usar a ULTIMA falha faria toda queda parecer ter durado um intervalo de agendador (12 min
       aqui). A queda comecou na PRIMEIRA falha da sequencia. */
    ok(n + '. *** a duracao sai da PRIMEIRA falha da sequencia: 492 min, e nao 12 ***',
      r.virada.fora_minutos === 492, r.virada.fora_minutos); n++;
    ok(n + '. ...e o inicio da queda fica gravado (nao so a duracao)',
      m.gravadas[0].fora_desde === '2026-08-14T20:00:00Z', m.gravadas[0].fora_desde); n++;
    /* "A API voltou" sem "e a varredura serviu pra alguma coisa" e meia noticia. */
    ok(n + '. *** o antes E o depois das datas nulas ficam no log (a prova de que serviu) ***',
      m.gravadas[0].datas_antes === 1955 && m.gravadas[0].datas_depois === 1902
      && m.gravadas[0].disparou === true, m.gravadas[0]); n++;
  }

  // ══════════ 4. NO AR CONTINUA NO AR: NAO DISPARA DE NOVO ══════════
  {
    const m = mundo({ resposta: 200, historico: [NOAR('2026-08-15T04:00:00Z'), NOAR('2026-08-15T03:45:00Z')] });
    await W.roda(m.dep, {});
    /* Sem isto, a varredura rodaria de 15 em 15 minutos para sempre depois que a API se
       estabilizasse — um watchdog que vira o abuso que ele deveria evitar. */
    ok(n + '. *** no ar -> no ar NAO dispara de novo (senao vira varredura a cada 15 min) ***',
      m.disparos === 0 && m.gravadas[0].disparou !== true); n++;
  }

  // ══════════ 5. A QUEDA TAMBEM E VIRADA — E NAO DISPARA NADA ══════════
  {
    const m = mundo({ resposta: 'rede', historico: [NOAR('2026-08-15T04:00:00Z')] });
    const r = await W.roda(m.dep, {});
    ok(n + '. *** no ar -> fora e virada (a queda tambem e noticia) ***',
      r.virada.virada === true && m.gravadas[0].virada === true); n++;
    ok(n + '. ...e obviamente NAO dispara varredura contra uma API que acabou de cair',
      m.disparos === 0); n++;
    ok(n + '. ...e o motivo fica escrito ("nao sei" tem causa)',
      /fetch failed/.test(m.gravadas[0].erro), m.gravadas[0].erro); n++;
  }

  // ══════════ 6. O QUE CONTA COMO "NO AR" ══════════
  /* 204 = "nao houve publicacao nesse dia nessa UF". Exigir dado faria um domingo parecer queda.
     429 = "devagar" — e so quem esta no ar sabe dizer isso. */
  for (const [http, esperado, porque] of [[200, true, 'respondeu com dado'],
                                          [204, true, 'domingo sem licitacao NAO e queda'],
                                          [429, true, 'so quem esta no ar sabe dizer "devagar"'],
                                          [500, false, 'erro do servidor e queda'],
                                          [503, false, 'indisponivel e queda']]) {
    const m = mundo({ resposta: http, historico: [] });
    const r = await W.roda(m.dep, {});
    ok(n + `. HTTP ${http} conta como ${esperado ? 'NO AR' : 'FORA'} — ${porque}`,
      r.atual.no_ar === esperado, { http, no_ar: r.atual.no_ar }); n++;
  }

  // ══════════ 7. --so-sondar NAO DISPARA, MAS NAO ESCONDE ══════════
  {
    const m = mundo({ resposta: 200, historico: [FORA('2026-08-15T04:00:00Z')] });
    const r = await W.roda(m.dep, { soSondar: true });
    ok(n + '. *** --so-sondar nao dispara a varredura... ***', m.disparos === 0); n++;
    ok(n + '. ...mas a virada continua REGISTRADA (a decisao de nao agir nao apaga o fato)',
      r.virada.virada === true && m.gravadas[0].virada === true && m.gravadas[0].disparou !== true); n++;
  }

  // ══════════ 8. QUANDO A VARREDURA FALHA, O LOG DIZ ══════════
  {
    const m = mundo({ resposta: 200, historico: [FORA('2026-08-15T04:00:00Z')], disparoOk: false });
    await W.roda(m.dep, {});
    /* Gravar `disparou: true` sem o erro faria o log afirmar que a coleta rodou quando ela
       quebrou — e a proxima virada so viria na proxima queda. */
    ok(n + '. *** varredura que falha grava o PORQUE, e nao um "disparou" limpo ***',
      m.gravadas[0].disparou === true && /a varredura quebrou/.test(m.gravadas[0].disparo_erro || ''),
      m.gravadas[0]); n++;
  }

  // ══════════ 9. O QUE ELE NAO FAZ ══════════
  /* A sonda tem que falhar pelo MESMO criterio pelo qual a varredura falha. Um teto mais
     generoso aqui declararia "no ar" uma API que a varredura nao consegue usar. */
  ok(n + '. *** a sonda usa o MESMO endereco da varredura e o MESMO teto de 20 s ***',
    W.URL_SONDA === 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao'
    && W.TIMEOUT_MS === 20000
    && /TIMEOUT_MS = 20000/.test(Wc)); n++;
  /* ══ ESTE ASSERT GUARDAVA O DEFEITO, E NAO A REGRA (corrigido na fatia A30, 15/08/2026) ══════
     Ele exigia, com todas as letras, `tamanhoPagina=1` — "o pedido mais barato que ainda prova
     que ela responde". A API do PNCP RECUSA 1: `must be greater than or equal to 10`, HTTP 400.
     Medido na mesma maquina, 1,5 s entre as chamadas:
         tamanhoPagina=1  -> HTTP 400 em 305 ms
         tamanhoPagina=10 -> HTTP 200 em 727 ms, com dado de verdade
     Ou seja: o watchdog inteiro — tabela propria, log de toda sondagem, disparo automatico na
     virada, estes 33 asserts — vigiava a volta de uma API perguntando de um jeito que ela
     SEMPRE recusa. Ele diria "fora do ar" para sempre. E este assert, verde desde 14/08,
     garantia que continuasse assim: ele era o cadeado do erro.
     >>> AGORA ELE COBRA A PROMESSA: a sonda pede o MENOR tamanho de pagina que a API ACEITA.
         Trocar 10 por 20 passa (continua sendo um pedido pequeno); voltar para 1 ou 5 reprova,
         porque nenhum dos dois existe do lado de la. */
  ok(n + '. ...pedindo o MENOR tamanho de pagina que a API ACEITA (o minimo dela e 10)',
    W.TAM_SONDA >= 10 && /tamanhoPagina=' \+ TAM_SONDA/.test(Wc) && /TAM_SONDA = 10/.test(Wc),
    { TAM_SONDA: W.TAM_SONDA }); n++;
  /* E O 4xx NAO E QUEDA. Um HTTP 400 em 305 ms e o servidor VIVO recusando o nosso pedido —
     carimba-lo como "fora do ar" e o mesmo defeito da A19 pelo avesso ("nao consegui perguntar"
     nunca vira "nao existe"). A sonda passa a separar os dois, e a diferenca tem de aparecer no
     texto do erro, senao quem le o log continua sem saber de quem e a culpa. */
  ok(n + '. *** um HTTP 4xx e "eu perguntei errado", e nao "o portal esta fora" ***',
    /culpaNossa/.test(Wc) && /A SONDA ESTA ERRADA/.test(Wc)
    && /r\.status >= 400 && r\.status < 500/.test(Wc)); n++;
  /* Reescrever backoff/breaker/rodizio aqui seria um SEGUNDO coletor com um segundo
     comportamento contra o mesmo portal publico. O watchdog so aperta o botao. */
  ok(n + '. *** ele CHAMA a varredura normal, nao reimplementa coletor ***',
    /coleta_pncp\.js/.test(Wc)
    && !/criaBreaker|esperaBackoff|codigoModalidadeContratacao=\$\{/.test(Wc)); n++;
  ok(n + '. *** e nao ha laco: uma execucao = uma sondagem (quem repete e o agendador) ***',
    !/while \(true\)|setInterval/.test(Wc)); n++;
  /* Data inventada num sistema de prazo e pior que data ausente. */
  ok(n + '. *** ele nao escreve data de abertura em lugar nenhum (nao inventa janela) ***',
    !/data_abertura['"]?\s*:/.test(Wc) && !/PATCH/.test(Wc)); n++;
  /* Sondagem que falha NAO e falha do watchdog — e a noticia dele. Sair com codigo de erro faria
     o agendador tratar o PNCP fora do ar como watchdog quebrado, e alarmar a coisa errada. */
  ok(n + '. *** sondagem que falha nao faz o watchdog sair com erro (isso alarmaria o errado) ***',
    /process\.exitCode = 0;/.test(Wc)); n++;

  // ══════════ 10. A TABELA E ADITIVA E FECHADA PRO ANON ══════════
  ok(n + '. *** o DDL e 100% aditivo: nada de drop/truncate de tabela ***',
    /create table if not exists public\.pncp_sondagens/.test(DDL)
    && !/drop table|truncate|delete from/i.test(DDL)); n++;
  ok(n + '. *** RLS ligada, anon revogado, e so o logado le ***',
    /enable row level security/.test(DDL) && /revoke all on public\.pncp_sondagens from anon/.test(DDL)
    && /grant select on public\.pncp_sondagens to authenticated/.test(DDL)
    && !/for insert|for update|for delete/.test(DDL)); n++;
  /* Existem DUAS portas no PNCP e elas caem separado (medido: consulta em timeout, detalhe em
     88 ms). Um log que diz so "o PNCP" afirmaria que o portal inteiro caiu. */
  ok(n + '. *** o log diz QUAL porta caiu (consulta e detalhe caem separado — medido) ***',
    /api\s+text not null default 'consulta'/.test(DDL) && /api: 'consulta'/.test(Wc)); n++;
  ok(n + '. ...e guarda HISTORIA, nao estado (e a historia que responde "quanto tempo ficou fora")',
    /fora_desde/.test(DDL) && /fora_minutos/.test(DDL) && /criado_em/.test(DDL)
    && /bigserial primary key/.test(DDL)); n++;

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})();
