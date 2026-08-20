/* ═══════════════════════════════════════════════════════════════════════════════════════════
   carga_diaria.js — O CONDUTOR ÚNICO DA CARGA (fatia A34, 19/08/2026)

   ══ A ORDEM DO DONO, com as palavras dele ═══════════════════════════════════════════════════
   *"sobre o PNCP a busca tá muito ruim ainda, não tá profissional"* e *"talvez pra não ficar
   travando, buscar o PNCP uma vez por dia e deixar salvo"*.

   A primeira metade virou a A34 na tela: a busca deixou de falar com o portal (era ela que
   baixava 18.946 KB e esperava até 70 s por um 504). Esta é a segunda metade — se a busca não
   pergunta mais, alguém tem que perguntar, e esse alguém roda FORA da hora do uso.

   ══ POR QUE UM CONDUTOR, E NÃO TRÊS COMANDOS NUM .bat ═══════════════════════════════════════
   Porque as três etapas têm ORDEM e dependência, e escrevê-las soltas é como elas saem de ordem:
     1. VARREDURA  (`coleta_pncp.js`) ..... traz as licitações novas;
     2. ITENS      (`coleta_itens_lote.js`) lê os itens DAS QUE ENTRARAM — e só faz sentido
                                            depois da 1, senão lê os itens de ontem de novo;
     3. PRAZOS     (`preenche_prazo.js`) .. pergunta a janela de proposta à porta certa, e ele
                                            mesmo SONDA e desiste se a porta estiver fora (A33).
   >>> E PORQUE O CARIMBO PRECISA SER DA RODADA INTEIRA. Cada ferramenta já grava o que é dela;
       o que não existia era um lugar dizendo "a rodada começou às X, terminou às Y, entraram N,
       ficaram M, e o motivo foi este". É esse carimbo que a FAIXA DE FRESCOR da tela lê — e sem
       ele a tela ou fica muda sobre a idade do dado, ou inventa.

   ══ ELE MESMO É O AGENDADOR, E ISSO FOI DECISÃO ═════════════════════════════════════════════
   NÃO instala nada no Windows (isso é do dono). Em vez disso ele roda no começo de cada rodada
   da fábrica e decide sozinho: se a última carga boa foi há menos de 12 horas, imprime "carga
   fresca, pulando" e sai em menos de um segundo, sem tocar no PNCP.
   >>> A FÁBRICA VIRA O AGENDADOR, sem nada instalado. E o número 12 é o MESMO que a tela usa
       para acender o âmbar da faixa (`FRESCOR_HORAS`): dois números diferentes fariam a tela
       chamar de velho o que o condutor considera fresco, e ninguém entenderia por quê.

   ══ O ORÇAMENTO DE TEMPO É DECLARADO, E O QUE NÃO COUBE É DITO ══════════════════════════════
   Uma carga sem teto vira um processo que ninguém sabe quando acaba, e a fábrica tem ciclos.
   Cada etapa tem seu orçamento; estourou, ela é interrompida e o CARIMBO REGISTRA que foi
   interrompida e quanto faltou. Rodada cortada que se carimba como completa é a mentira mais
   cara que uma coleta pode contar — ela faz a tela dizer "completo até hoje" sobre meia base.

     node tools/carga_diaria.js                 (a rodada, com a regra das 12 horas)
     node tools/carga_diaria.js --forcar        (roda mesmo com carga fresca)
     node tools/carga_diaria.js --carimbo       (só mostra o último carimbo, não roda nada)
     node tools/carga_diaria.js --previa        (diz o que faria, não executa nem grava)
     node tools/carga_diaria.js --minutos 25    (orçamento total, padrão 20)
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const RAIZ = path.join(__dirname, '..');

/* ══ A CREDENCIAL É LIDA QUANDO FOR USADA, E NÃO AO CARREGAR O ARQUIVO ═══════════════════════
   Ela era lida na primeira linha, e isso trancava a porta para a catraca: quem faz `require`
   deste arquivo só para PERGUNTAR a regra do teto acabava lendo a `service_role` do disco e
   saindo por `process.exit(1)` numa máquina sem o segredo. Regra que só pode ser testada com a
   chave-mestra na mão é regra que ninguém testa — e a do teto estava sem catraca nenhuma. */
let _banco = null;
function banco() {
  if (_banco) return _banco;
  const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
  const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
  const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
  if (!SR) { console.error('service_role nao encontrada em segredos.local.txt'); process.exit(1); }
  _banco = { SB, H: { apikey: SR, Authorization: 'Bearer ' + SR } };
  return _banco;
}

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = n => process.argv.includes(n);

const FORCAR  = tem('--forcar');
const PREVIA  = tem('--previa');
const SO_CARIMBO = tem('--carimbo');
/* 12 HORAS — o MESMO número que `FRESCOR_HORAS` no fpmed_licitacoes.html. Se um dia mudar, muda
   nos dois: a tela chamando de velho o que o condutor chama de fresco é uma contradição visível
   para o operador e invisível para quem lê só um dos dois arquivos. */
const FRESCOR_HORAS = 12;
const ORCAMENTO_MIN = parseInt(arg('--minutos'), 10) || 20;

/* ══ O RATEIO DO ORÇAMENTO — E ELE FOI MEDIDO, NÃO CHUTADO (1ª rodada, 19/08 16:24) ══════════
     varredura ..  24 s para 1.736 licitações novas (ela tem teto próprio por rodada)
     itens ..... 216 s para 400 licitações  ->  0,54 s por licitação
     prazos .... a sonda + 60 combinações não coube em 264 s e foi MORTA pelo orçamento
   >>> O PRIMEIRO RATEIO (0,35 / 0,45 / 0,20) MATOU A ETAPA DE PRAZOS NO MEIO, e etapa morta por
       tempo não pode ser confundida com etapa que terminou: ela reprovou a rodada inteira e o
       carimbo não avançou. O conserto é dar à etapa o tempo que ela MEDIDAMENTE precisa — e não
       afrouxar a regra que a reprovou.
     · a varredura é curta porque ela mesma tem teto de páginas por (uf, modalidade, dia);
     · os itens são a etapa longa por natureza, e o teto dela é calculado a partir do orçamento
       logo abaixo, para que ela termine em vez de ser interrompida;
     · os prazos ficam com quase um terço porque a porta VOLTOU (200 em 754 ms, medido nesta
       mesma rodada) — e com a porta aberta ele tem 2.358 combinações para percorrer. */
const FATIA = { varredura: 0.22, itens: 0.45, prazos: 0.33 };
/* ══ SEGUNDOS POR LICITAÇÃO — E ELE NÃO É MAIS UMA CONSTANTE ═════════════════════════════════
   Era `0.54`, medido uma vez (216 s / 400) e escrito com tinta. Na rodada de 20/08 o mesmo passo
   levou ~2,0 s por licitação — QUASE QUATRO VEZES MAIS — e o teto calculado com o número velho
   pediu 2.149 para uma etapa que só dava conta de ~800. A etapa foi morta no meio pelo relógio.

   >>> É O DEFEITO DO TETO FIXO COM ROUPA NOVA. Eu tinha acabado de matar o "400 por rodada" por
       não acompanhar a realidade, e pus no lugar um teto calculado a partir de uma CONSTANTE
       que também não acompanha. Um número medido uma vez e nunca mais é um número fixo com
       cara de medição — e a diferença entre os dois é só o tempo que leva para o mundo mudar.
   >>> ENTÃO A TAXA VEM DA RODADA ANTERIOR. O condutor lê no próprio carimbo quanto tempo a
       etapa de itens levou e quantas licitações ela processou, e usa ISSO. Na primeira vez (sem
       carimbo, ou carimbo velho sem a medida) ele cai no valor de partida — que é o pior caso
       conhecido, e não o melhor: errar para o lado do otimismo é como uma etapa morre no meio,
       errar para o lado da cautela é uma rodada que sobra tempo e paga menos dívida.
   >>> E A MEDIDA ENTRA NO CARIMBO. Sem gravá-la, a rodada seguinte repetiria o erro desta —
       aprender sem anotar é não aprender. */
const SEG_POR_LIC_PADRAO = 2.0;
/* O `[N/M]` é a barra de progresso do próprio `coleta_itens_lote.js`, e é a única testemunha de
   quantas licitações a etapa REALMENTE processou antes de o relógio matá-la. Contar pela dívida
   antes menos a dívida depois não serve: entre as duas medidas chegam licitações novas, e o
   número sairia menor do que o trabalho feito. */
const ULTIMO_PROGRESSO = /\[(\d+)\/(\d+)\]/;

/* ══ O PLANO DA ETAPA DE ITENS — FUNÇÃO PURA, PORQUE ELA É A REGRA DA FATIA ═══════════════════
   Entra: a dívida medida, o orçamento em minutos e a taxa que a rodada anterior deixou.
   Sai:   o teto, e a CADÊNCIA — em quantas rodadas deste tamanho a dívida se paga.
   Não faz: não lê banco, não imprime, não roda nada.

   >>> POR QUE ELA SAIU DE DENTRO DO CORPO DA RODADA. Ela era quatro linhas soltas no meio de
       uma função de 200 que só roda com a `service_role` na mão e falando com o PNCP. Regra que
       só se observa rodando a coisa inteira é regra sem catraca — e esta é EXATAMENTE a
       exigência (b) da caixa, a que trocou o teto fixo de 400 pelo teto da dívida.

   ══ E MEDIR A CADÊNCIA REVELOU QUE O DEFEITO DO TETO FIXO TINHA UMA TERCEIRA PORTA ═══════════
   Medido hoje, 20/08 13:12, com o ritmo real já aprendido (0,94 s por licitação):

       dívida 4.558 vivas · orçamento PADRÃO de 20 min · teto da rodada: 429

   O teto obedece a dívida, como a caixa mandou — mas ele é o MENOR entre a dívida e o que cabe,
   e com o orçamento padrão o que cabe são 429. A rotina escrita no CONTINUAR_AQUI.txt
   (`node tools/carga_diaria.js`, sem argumento) roda com esse padrão. Ou seja: o "400 por
   rodada" que esta fatia matou voltou pela porta do ORÇAMENTO, com o número 429 e sem nome.

   >>> E A FRASE ANTIGA ERA VERDADEIRA E INSUFICIENTE. "faltam N, volto na próxima" é uma
       PROMESSA: ela faz quem lê entender que mais algumas rodadas pagam a conta. Com 429 por
       rodada contra 4.558, são ONZE rodadas — e nesse meio-tempo a varredura da PRÓPRIA
       rodada traz mais vivas do que a etapa de itens paga (medido: +2.989 chegaram enquanto
       2.887 eram pagas). Dizer só o saldo esconde a cadência, e é a cadência que responde
       "isto está sendo pago ou está andando para trás?".
   >>> ENTÃO A REGRA NÃO AFROUXA E O NÚMERO NÃO ENGORDA: quem decide gastar 3 horas de máquina é
       o dono, não eu. O que muda é que o condutor passa a DIZER o tamanho da conta e o
       `--minutos` que a zeraria — em vez de prometer uma próxima rodada que não alcança. */
function planoDeItens(o) {
  const orcamentoMin = o.orcamentoMin;
  const divida = (o.dividaVivas != null && o.dividaVivas > 0) ? o.dividaVivas : null;
  /* `> 0.05` recusa medida absurda: uma etapa que morreu em dois segundos sem processar nada
     devolveria uma taxa perto de zero e o teto seguinte seria astronômico — e aí a etapa
     morreria de novo, agora por culpa da própria medição. */
  const taxa = Number(o.taxaAnterior);
  const medida = isFinite(taxa) && taxa > 0.05;
  const segPorLic = medida ? taxa : SEG_POR_LIC_PADRAO;
  /* os 25% de folga são do relógio, não do alvo: uma etapa que enche o orçamento até a borda é
     uma etapa que a primeira lentidão da rede mata no meio. */
  const segundosUteis = orcamentoMin * FATIA.itens * 60 * 0.75;
  const cabe = Math.max(50, Math.floor(segundosUteis / segPorLic));
  const teto = divida == null ? cabe : Math.max(50, Math.min(divida, cabe));
  const zeraHoje = divida == null ? true : divida <= cabe;
  /* A cadência só existe quando há dívida E ela não cabe. `Math.ceil` porque meia rodada não
     paga meia dívida: a rodada que sobra é uma rodada inteira. */
  const rodadasParaZerar = (divida != null && !zeraHoje) ? Math.ceil(divida / cabe) : null;
  /* O `--minutos` que zeraria numa rodada só, pela mesma conta ao contrário. Ele é ARREDONDADO
     PARA CIMA: um número que dá "quase" faz a etapa morrer no relógio no último punhado. */
  const minutosParaZerar = (divida != null && !zeraHoje)
    ? Math.ceil((divida * segPorLic) / (FATIA.itens * 60 * 0.75))
    : null;
  return { segPorLic, medida, cabe, teto, divida, zeraHoje, rodadasParaZerar, minutosParaZerar };
}

/* ══ O SALDO DITO POR INTEIRO — saldo E cadência ═════════════════════════════════════════════
   Ele é medido DEPOIS, pela mesma régua do antes (`retrato`), e não deduzido do teto: entre o
   começo e o fim da rodada chegam licitações novas, e um saldo calculado por subtração diria
   "faltam 0" com a fila cheia.
   >>> O SALDO NÃO É ERRO, e a distinção é de propósito: ele NÃO entra em `motivos` (que vira o
       `ultimo_erro` da linha), senão a tela — que lê `ultimo_erro` para dizer "a última carga
       falhou" — acusaria falha em toda rodada honesta. */
function textoDoSaldo(saldoVivas, plano) {
  if (saldoVivas == null) return null;
  if (saldoVivas <= 0) return 'saldo: a dívida das vivas está zerada';
  const base = 'saldo: faltam ' + saldoVivas.toLocaleString('pt-BR') + ' vivas sem item';
  /* O plano desta rodada é o que diz se "volto na próxima" é promessa cumprível. Sem ele (não
     deveria acontecer, mas o texto não pode depender disso) fica só o saldo, sem promessa. */
  if (!plano || plano.rodadasParaZerar == null) return base + ' — volto na próxima';
  return base + ' — neste orçamento são ' + plano.rodadasParaZerar
    + ' rodadas; para zerar numa só, --minutos ' + plano.minutosParaZerar;
}

const agora = () => new Date();
const iso = d => d.toISOString();

async function pede(caminho, extra) {
  const { SB, H } = banco();
  const r = await fetch(SB + '/rest/v1/' + caminho, { headers: Object.assign({}, H, extra || {}) });
  return r;
}

/* A contagem vem do SERVIDOR (`content-range`), como na `conta_indice.js`. Contar pelo `length`
   de um array devolveria 1000 — é o teto do PostgREST que já mordeu esta obra quatro vezes. */
async function conta(filtro) {
  try {
    const r = await pede(filtro, { Prefer: 'count=exact', Range: '0-0' });
    if (!r.ok) return null;
    const n = parseInt(String(r.headers.get('content-range') || '').split('/')[1], 10);
    return isFinite(n) ? n : null;
  } catch (_) { return null; }
}

async function leCarimbo() {
  try {
    const r = await pede('coleta_status?fonte=eq.CARGA&select=*');
    if (!r.ok) return null;
    const j = await r.json();
    return (Array.isArray(j) && j[0]) ? j[0] : null;
  } catch (_) { return null; }
}

/* ══ O RETRATO — a mesma régua nas duas pontas ═══════════════════════════════════════════════
   Antes e depois medidos pela MESMA função. Na A29 esta obra já pagou por medir o antes com um
   curl e o depois com outro: a diferença entre as duas contas apareceu como ganho. */
/* ══ A DÍVIDA QUE IMPORTA É A DAS VIVAS, e isso é medida e não opinião (20/08) ═══════════════
   `sem_itens` cru era 5.007 e parecia uma montanha. Repartido (`tools/mede_divida_itens.js`):
     2.149 VIVAS (prazo aberto)  ·  1.883 SEM PRAZO (data NULL)  ·  975 ENCERRADAS.
   >>> A etapa de itens chama `--vivas`, que é `data_encerramento >= agora`. Ou seja: das 5.007,
       ela só ALCANÇA 2.149. Dimensionar o teto por 5.007 seria mirar num alvo que a própria
       ferramenta não pode acertar, e o saldo declarado nunca fecharia — dívida perpétua com
       aparência de meta.
   >>> E AS ENCERRADAS NÃO SÃO DÍVIDA: ler os itens de um edital cujo prazo passou custa o mesmo
       e não serve para propor nada. Contá-las na meta faria a carga parecer eternamente atrasada
       por causa de trabalho que ninguém quer que ela faça. */
async function retrato() {
  const agoraIso = new Date().toISOString();
  const [licitacoes, itens, comItens, semPrazo, vivasSemItens] = await Promise.all([
    conta('licitacoes?select=id'),
    conta('licitacao_itens?select=id'),
    conta('licitacoes?select=id&itens_lidos_em=not.is.null'),
    conta('licitacoes?select=id&data_encerramento=is.null'),
    conta('licitacoes?select=id&itens_lidos_em=is.null&data_encerramento=gte.' + agoraIso),
  ]);
  const semItens = (licitacoes != null && comItens != null) ? licitacoes - comItens : null;
  return { licitacoes, itens, com_itens: comItens, sem_itens: semItens, sem_prazo: semPrazo,
           vivas_sem_itens: vivasSemItens };
}

/* ══ RODAR UMA ETAPA ═════════════════════════════════════════════════════════════════════════
   A saída da etapa vai para a tela AO VIVO (`inherit` do stdio não serve porque eu também
   preciso guardar as últimas linhas no carimbo), e as ÚLTIMAS LINHAS ficam guardadas. Guardar a
   saída inteira encheria o `detalhe` de kilobytes de log; guardar nenhuma faria o carimbo dizer
   "falhou" sem dizer por quê — e "falhou" sem motivo é o mesmo que não avisar.
   >>> O ORÇAMENTO MATA O PROCESSO E ISSO É REGISTRADO. Uma etapa morta por tempo NÃO é uma etapa
       que terminou: ela vira `interrompida: true` no carimbo, e a rodada inteira deixa de poder
       se chamar completa. */
function rodaEtapa(nome, args, limiteMs) {
  return new Promise(resolve => {
    const t0 = Date.now();
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(`▶ ${nome} — orçamento ${Math.round(limiteMs / 60000)} min`);
    console.log(`  node ${args.join(' ')}`);
    console.log('══════════════════════════════════════════════════════════════');
    const p = spawn(process.execPath, args, { cwd: RAIZ });
    const ultimas = [];
    /* O ÚLTIMO `[N/M]` É GUARDADO ENQUANTO PASSA, e não pescado nas últimas linhas no fim. Uma
       etapa que termina normalmente imprime um resumo depois da barra, e a barra sairia da
       janela das 12 últimas — justamente no caso em que a medida é confiável. */
    let feito = null;
    const guarda = buf => {
      const txt = buf.toString();
      process.stdout.write(txt);
      for (const l of txt.split(/\r?\n/)) {
        if (!l.trim()) continue;
        const m = ULTIMO_PROGRESSO.exec(l);
        if (m) feito = parseInt(m[1], 10);
        ultimas.push(l.trim());
        if (ultimas.length > 12) ultimas.shift();
      }
    };
    p.stdout.on('data', guarda);
    p.stderr.on('data', guarda);

    let interrompida = false;
    const relogio = setTimeout(() => { interrompida = true; try { p.kill(); } catch (_) {} }, limiteMs);

    p.on('close', codigo => {
      clearTimeout(relogio);
      resolve({ nome, codigo, ms: Date.now() - t0, interrompida, feito, ultimas: ultimas.slice(-6) });
    });
    p.on('error', e => {
      clearTimeout(relogio);
      resolve({ nome, codigo: -1, ms: Date.now() - t0, interrompida, feito, erro: e.message, ultimas });
    });
  });
}

const hm = d => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const num = n => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

function mostraCarimbo(c) {
  if (!c) { console.log('não há carimbo de carga ainda (a coleta nunca rodou por este condutor).'); return; }
  const d = c.detalhe || {};
  console.log('=== ÚLTIMO CARIMBO DE CARGA ===');
  console.log('  última OK ....... ' + (c.ultima_ok ? new Date(c.ultima_ok).toLocaleString('pt-BR') : '—'));
  console.log('  última tentativa  ' + (c.ultima_tentativa ? new Date(c.ultima_tentativa).toLocaleString('pt-BR') : '—'));
  console.log('  erro ............ ' + (c.ultimo_erro || '—'));
  console.log('  licitações ...... ' + num(d.licitacoes) + '   (entraram nesta rodada: ' + num(d.entraram) + ')');
  console.log('  itens ........... ' + num(d.itens) + '   (entraram: ' + num(d.itens_entraram) + ')');
  console.log('  sem itens lidos . ' + num(d.sem_itens));
  console.log('  VIVAS sem item .. ' + num(d.divida_vivas_antes) + ' → ' + num(d.divida_vivas_depois)
    + '   (teto da rodada: ' + num(d.teto_itens) + ')');
  console.log('  sem prazo ....... ' + num(d.sem_prazo));
  if (d.saldo) console.log('  saldo ........... ' + d.saldo);
  if (d.rodadas_para_zerar) console.log('  cadência ........ ' + d.rodadas_para_zerar
    + ' rodadas de ' + num(d.orcamento_min) + ' min para zerar (numa só: --minutos '
    + num(d.minutos_para_zerar) + ')');
  if (Array.isArray(d.etapas)) for (const e of d.etapas)
    console.log('   · ' + String(e.nome).padEnd(12) + ' código ' + e.codigo
      + (e.interrompida ? ' (INTERROMPIDA pelo orçamento)' : '') + '  ' + Math.round(e.ms / 1000) + 's');
  if (d.porque) console.log('  por quê ......... ' + d.porque);
}

/* ══ A PORTA DA CATRACA ══════════════════════════════════════════════════════════════════════
   Quem faz `require` deste arquivo recebe as duas regras puras e NÃO dispara a rodada. Sem este
   portão, a suíte que perguntasse "qual o teto para 4.558 de dívida?" abriria conexão com o
   Supabase e chamaria o PNCP — um teste que fala com o governo não é um teste, é uma coleta.
   >>> E é o mesmo caminho da `testa_familia_rok`: ela IMPORTA o detector da ferramenta em vez de
       copiá-lo. Duas cópias são duas réguas, e a que discorda calada é a que fica. */
module.exports = { planoDeItens, textoDoSaldo, FRESCOR_HORAS, FATIA, SEG_POR_LIC_PADRAO };
if (require.main !== module) return;

(async () => {
  const carimboAntes = await leCarimbo();

  if (SO_CARIMBO) { mostraCarimbo(carimboAntes); return; }

  // ── A REGRA DAS 12 HORAS ─────────────────────────────────────────────────────────────────
  if (!FORCAR && carimboAntes && carimboAntes.ultima_ok) {
    const idadeH = (Date.now() - new Date(carimboAntes.ultima_ok).getTime()) / 3600000;
    if (idadeH < FRESCOR_HORAS) {
      console.log(`carga fresca (${idadeH.toFixed(1)} h < ${FRESCOR_HORAS} h) — pulando.`);
      console.log('use --forcar para rodar assim mesmo.');
      return;
    }
  }

  const inicio = agora();
  console.log('=== CARGA DIÁRIA — início ' + inicio.toLocaleString('pt-BR') + ' ===');
  console.log('orçamento total: ' + ORCAMENTO_MIN + ' min');

  const antes = await retrato();
  console.log('ANTES: ' + num(antes.licitacoes) + ' licitações · ' + num(antes.itens) + ' itens · '
    + num(antes.sem_itens) + ' sem itens lidos · ' + num(antes.sem_prazo) + ' sem prazo');

  /* ══ O TETO DOS ITENS É DIMENSIONADO PELA DÍVIDA, NÃO POR UM NÚMERO FIXO ═════════════════════
     Era 400 por rodada, fixo. Com ~2.740 licitações chegando por dia, 400 por rodada NUNCA
     alcança: a dívida cresce ~2.340 por dia mesmo com o condutor rodando. Teto fixo que não
     alcança a chegada é dívida perpétua disfarçada de sucesso.
     >>> ENTÃO ELE É O MENOR ENTRE DOIS NÚMEROS, e os dois são medidos:
           `divida` — quantas VIVAS estão sem item AGORA (a conta do retrato, não um palpite);
           `cabe`   — quantas cabem no orçamento desta etapa, a 0,54 s por licitação, com 25% de
                      folga (SEG_POR_LIC, medido: 216 s / 400).
     >>> PEDIR MAIS DO QUE CABE não faz a etapa render mais: faz o relógio matá-la no meio, e
         etapa morta reprova a rodada inteira. Pedir mais do que a dívida também não: a ferramenta
         simplesmente não tem alvo, e o teto vira um número decorativo no log.
     >>> E O SALDO É DECLARADO NO FIM, com estas palavras: "faltam N, volto na próxima". Uma
         rodada que pagou o que cabia e diz quanto ficou é honesta; uma que pagou o que cabia e
         se cala parece completa. */
  /* A TAXA DA RODADA ANTERIOR, se houver. `> 0.05` recusa medida absurda: uma etapa que morreu
     em dois segundos sem processar nada devolveria uma taxa perto de zero e o teto seguinte
     seria astronômico — e aí a etapa morreria de novo, agora por culpa da própria medição. */
  const plano = planoDeItens({
    dividaVivas: antes.vivas_sem_itens,
    orcamentoMin: ORCAMENTO_MIN,
    taxaAnterior: carimboAntes && carimboAntes.detalhe && carimboAntes.detalhe.seg_por_lic,
  });
  const SEG_POR_LIC = plano.segPorLic;
  const cabeNoOrcamento = plano.cabe;
  const tetoItens = plano.teto;
  const dividaVivas = plano.divida;
  console.log('ritmo dos itens: ' + SEG_POR_LIC.toFixed(2) + ' s por licitação '
    + (plano.medida ? '(medido na rodada anterior)'
                    : '(valor de partida — a rodada anterior não deixou medida)'));
  console.log('DÍVIDA DE ITENS: ' + num(dividaVivas) + ' vivas sem item'
    + '   · cabem nesta rodada: ' + num(cabeNoOrcamento)
    + '   · teto desta rodada: ' + num(tetoItens)
    + (plano.zeraHoje ? '   (dá para zerar hoje)' : '   (não zera hoje — o saldo vai no carimbo)'));
  /* A CADÊNCIA SAI NO CONSOLE ANTES DE A RODADA COMEÇAR, e não só no carimbo do fim: quem
     dispara a carga e vê "11 rodadas" na primeira linha ainda pode decidir dar `--minutos` a
     ela. Dito só no fim, a informação chega quando não serve mais para esta rodada. */
  if (!plano.zeraHoje) console.log('   ⚠ neste orçamento (' + ORCAMENTO_MIN + ' min) são '
    + plano.rodadasParaZerar + ' rodadas para zerar. Numa só: --minutos ' + plano.minutosParaZerar);

  const etapas = [
    { nome: 'varredura', args: ['tools/coleta_pncp.js'], fatia: FATIA.varredura },
    /* `--vivas`: os itens das licitações cujo prazo ainda não passou, da que encerra ANTES para a
       que encerra depois. Se a rodada for cortada, o que ficou de fora é o que ainda dá tempo de
       coletar amanhã — a ordem é da própria ferramenta (A9), e é ela que faz um corte doer menos. */
    { nome: 'itens', args: ['tools/coleta_itens_lote.js', '--vivas', '--teto', String(tetoItens)], fatia: FATIA.itens },
    /* `--preencher`: ele SONDA a porta primeiro e sai com código 2 sem gastar requisição nenhuma
       se ela estiver fora (lei da A33). Chamá-lo aqui é exatamente o que a decisão 1 do arquiteto
       mandou: "tentar de tempos em tempos é o que ele foi desenhado para fazer com segurança". */
    { nome: 'prazos', args: ['tools/preenche_prazo.js', '--preencher'], fatia: FATIA.prazos },
  ];

  if (PREVIA) {
    console.log('\n--previa: rodaria, nesta ordem —');
    etapas.forEach(e => console.log('   ' + e.nome.padEnd(12) + 'node ' + e.args.join(' ')
      + '   (' + Math.round(ORCAMENTO_MIN * e.fatia) + ' min)'));
    console.log('\nnada foi executado e nada foi gravado.');
    return;
  }

  const feitas = [];
  for (const e of etapas) {
    feitas.push(await rodaEtapa(e.nome, e.args, Math.round(ORCAMENTO_MIN * e.fatia * 60000)));
  }

  const depois = await retrato();
  const fim = agora();

  /* ══ O "POR QUÊ" DO CARIMBO — e ele não é um texto livre, é uma conta ═══════════════════════
     A caixa pediu "quantas entraram, quantas ficaram e POR QUÊ". O "por quê" honesto é a soma
     dos motivos que as etapas relataram: interrompida por orçamento, porta fora, ou nada disso.
     >>> `okDeVerdade` é o que decide se `ultima_ok` avança — e é ele que a faixa de frescor lê.
         Avançar o carimbo numa rodada cortada faria a tela dizer "atualizado agora" sobre uma
         carga que não terminou, que é o mesmo defeito do `ultima_ok` da coleta em 10/08.
     >>> DOIS CÓDIGOS DE SAÍDA NÃO SÃO FALHA, e os dois foram descobertos rodando de verdade:

         · `prazos` com CÓDIGO 2 — é a sonda da A33 dizendo "a porta de consulta do PNCP está
           fora". É fato sobre o governo, não sobre nós, e é o desfecho para o qual ela foi
           desenhada. Contá-lo como falha faria a faixa ficar âmbar todo dia de portal fora,
           mesmo com a varredura e os itens completos.

         · `varredura` com CÓDIGO 1 — o `coleta_pncp.js` sai 1 quando a rodada NÃO fechou a
           janela inteira, e isso é o NORMAL desta obra, não a exceção: está escrito no
           ddl/coleta_ultimo_dia.sql desde 10/08 ("nenhuma rodada fecha a janela dentro do
           orçamento", medido com três rodadas de 190/213/272 linhas). Na 1ª execução deste
           condutor a varredura trouxe 1.736 licitações NOVAS e saiu 1 — e eu tinha escrito uma
           regra que reprovava a rodada mais produtiva do dia.
           >>> ISSO NÃO É AFROUXAR A RÉGUA PARA CABER O RESULTADO. A pergunta que o carimbo da
               CARGA responde é "a rodada percorreu as três etapas?". "Até que dia o índice está
               completo?" é outra pergunta, ela já tem carimbo próprio (`coleta_status` fonte
               PNCP, `ultimo_dia_ok`) e é ele que o selo do header lê. Duas perguntas, dois
               carimbos — juntá-los faria um deles mentir sobre o outro.
           >>> E O PARCIAL CONTINUA SENDO DITO: entra em `motivos`, aparece no `porque` do
               carimbo e sai no console. O que ele não faz é apagar o horário da carga. */
  const toleravel = f => (f.nome === 'prazos' && f.codigo === 2) || (f.nome === 'varredura' && f.codigo === 1);
  const motivos = [];
  for (const f of feitas) {
    if (f.interrompida) motivos.push(f.nome + ': INTERROMPIDA pelo orçamento de tempo');
    else if (f.nome === 'prazos' && f.codigo === 2) motivos.push('prazos: a porta de consulta do PNCP está fora (sondada, não adivinhada)');
    else if (f.nome === 'varredura' && f.codigo === 1) motivos.push('varredura: rodada parcial — não fechou a janela inteira (o normal; ver ultimo_dia_ok)');
    else if (f.codigo !== 0) motivos.push(f.nome + ': terminou com código ' + f.codigo
      + (f.ultimas && f.ultimas.length ? ' — ' + f.ultimas[f.ultimas.length - 1].slice(0, 120) : ''));
  }
  const okDeVerdade = !feitas.some(f => f.interrompida || (f.codigo !== 0 && !toleravel(f)));

  /* ══ O SALDO, DITO COM O NÚMERO E COM A CADÊNCIA — exigência (b) da caixa ════════════════════
     A regra mora em `textoDoSaldo`, lá em cima, junto do `planoDeItens` que a alimenta: as duas
     respondem à mesma exigência, e separá-las era como uma delas passava a mentir sobre a outra.
     >>> A CADÊNCIA VEM DO PLANO DESTA RODADA, e não de uma conta refeita aqui com o saldo novo.
         Refazê-la com o saldo do FIM misturaria duas medidas (a dívida do começo, que foi o alvo,
         e a do fim, que já tem chegada nova dentro) e daria um número que não é nem uma nem
         outra. O plano é o que esta rodada prometeu; o saldo é o que ela deixou. */
  const saldoVivas = depois.vivas_sem_itens;
  const saldoTexto = textoDoSaldo(saldoVivas, plano);

  const detalhe = {
    inicio: iso(inicio), fim: iso(fim), minutos: +((fim - inicio) / 60000).toFixed(1),
    licitacoes: depois.licitacoes, itens: depois.itens,
    sem_itens: depois.sem_itens, sem_prazo: depois.sem_prazo,
    /* as três colunas da dívida, para que a faixa da tela e o relatório leiam o MESMO número:
       a que a etapa alcança (vivas), o teto que ela recebeu e o que sobrou. */
    divida_vivas_antes: antes.vivas_sem_itens,
    divida_vivas_depois: saldoVivas,
    teto_itens: tetoItens,
    cabe_no_orcamento: cabeNoOrcamento,
    /* A CADÊNCIA GRAVADA, e não só impressa. Quem abre o carimbo dias depois (`--carimbo`, o
       relatório, o arquiteto) precisa poder ver que a dívida não estava sendo paga NAQUELE dia —
       um número que só existe no console de uma rodada que já rolou não existe. */
    orcamento_min: ORCAMENTO_MIN,
    rodadas_para_zerar: plano.rodadasParaZerar,
    minutos_para_zerar: plano.minutosParaZerar,
    /* A TAXA APRENDIDA NESTA RODADA, para a próxima dimensionar o teto com ela. Se a etapa não
       chegou a processar nada, o campo carrega a taxa que foi USADA — nunca `null` e nunca zero:
       um buraco aqui faria a rodada seguinte voltar ao valor de partida e desaprender. */
    seg_por_lic: (() => {
      const it = feitas.find(f => f.nome === 'itens');
      return (it && it.feito > 0) ? +((it.ms / 1000) / it.feito).toFixed(3) : SEG_POR_LIC;
    })(),
    itens_processados: (feitas.find(f => f.nome === 'itens') || {}).feito || null,
    entraram: (depois.licitacoes != null && antes.licitacoes != null) ? depois.licitacoes - antes.licitacoes : null,
    itens_entraram: (depois.itens != null && antes.itens != null) ? depois.itens - antes.itens : null,
    prazos_ganhos: (antes.sem_prazo != null && depois.sem_prazo != null) ? antes.sem_prazo - depois.sem_prazo : null,
    etapas: feitas.map(f => ({ nome: f.nome, codigo: f.codigo, ms: f.ms, interrompida: f.interrompida, fim_do_log: f.ultimas })),
    saldo: saldoTexto,
    porque: [motivos.length ? motivos.join(' · ') : 'as três etapas terminaram', saldoTexto]
              .filter(Boolean).join(' · '),
  };

  const linha = {
    fonte: 'CARGA',
    ultima_tentativa: iso(fim),
    ultimo_erro: motivos.length ? motivos.join(' · ').slice(0, 400) : null,
    registros: detalhe.entraram,
    atualizado_em: iso(fim),
    detalhe,
  };
  if (okDeVerdade) linha.ultima_ok = iso(fim);

  const gravar = banco();
  const r = await fetch(`${gravar.SB}/rest/v1/coleta_status?on_conflict=fonte`, {
    method: 'POST',
    headers: { ...gravar.H, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify([linha]),
  }).catch(e => ({ ok: false, status: e.message }));

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('=== CARGA DIÁRIA — fim ' + hm(fim) + ' (' + detalhe.minutos + ' min) ===');
  console.log('  licitações ..... ' + num(antes.licitacoes) + ' → ' + num(depois.licitacoes)
    + '   (entraram ' + num(detalhe.entraram) + ')');
  console.log('  itens .......... ' + num(antes.itens) + ' → ' + num(depois.itens)
    + '   (entraram ' + num(detalhe.itens_entraram) + ')');
  console.log('  sem itens lidos  ' + num(antes.sem_itens) + ' → ' + num(depois.sem_itens));
  console.log('  VIVAS sem item . ' + num(antes.vivas_sem_itens) + ' → ' + num(depois.vivas_sem_itens)
    + '   (a dívida que esta etapa alcança; teto desta rodada: ' + num(tetoItens) + ')');
  console.log('  sem prazo ...... ' + num(antes.sem_prazo) + ' → ' + num(depois.sem_prazo));
  for (const f of feitas) console.log('   · ' + f.nome.padEnd(12) + 'código ' + f.codigo
    + (f.interrompida ? ' (INTERROMPIDA)' : '') + '  ' + Math.round(f.ms / 1000) + 's');
  console.log('  por quê ........ ' + detalhe.porque);
  console.log(okDeVerdade ? '✅ carimbo de frescor AVANÇOU — a faixa da Encontrar vai dizer "atualizados hoje às ' + hm(fim) + '"'
                          : '⚠️  carimbo NÃO avançou — a faixa vai continuar mostrando a idade da última carga boa');
  if (!r || !r.ok) console.error('⚠️  não consegui gravar o carimbo: ' + (r && r.status));

  process.exitCode = okDeVerdade ? 0 : 1;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
