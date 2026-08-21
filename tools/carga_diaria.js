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
     node tools/carga_diaria.js --minutos 25    (ORDEM DO DONO: orçamento total, todas as etapas)
     node tools/carga_diaria.js --teto-automatico 120   (até onde a REGRA pode ir sozinha; padrão 60)
     node tools/carga_diaria.js --carimbos-pendentes   (reenvia carimbo que a rede não deixou gravar)

   ══ E A RODADA NÃO DEPENDE MAIS DE UMA ÚLTIMA CHAMADA (fatia A39, 20/08/2026) ════════════════
   A rodada inteira terminava num `POST coleta_status` sem retentativa, com um `.catch` que
   devolvia um objeto falso-ok: um `fetch failed` ali apagava a prestação de contas de vinte
   minutos de trabalho que JÁ ESTAVA no banco. Agora essa chamada é teimosa (espera crescente,
   teto de tentativas) e, ao desistir, GRAVA O QUE TEM em `logs/carimbo_pendente_*.json`.
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
const SO_PENDENTES = tem('--carimbos-pendentes');
/* 12 HORAS — o MESMO número que `FRESCOR_HORAS` no fpmed_licitacoes.html. Se um dia mudar, muda
   nos dois: a tela chamando de velho o que o condutor chama de fresco é uma contradição visível
   para o operador e invisível para quem lê só um dos dois arquivos. */
const FRESCOR_HORAS = 12;
/* ══ O ORÇAMENTO DEIXOU DE SER UM NÚMERO E VIROU UMA DECISÃO (fatia A44, 21/08/2026) ═════════
   Era `parseInt(--minutos) || 20`. O 20 não sabia nada sobre a dívida, então quando a dívida
   ficava grande a única saída era o DONO abrir o Explorador e dar dois cliques num .bat com
   `--forcar --minutos 213`. A Lei da Autonomia diz que o dono não é operador — a regra abaixo
   é a tentativa de tirar essa conta da mão dele. Ver `orcamentoDaRodada`. */
const ORCAMENTO_PADRAO_MIN = 20;
const TETO_AUTOMATICO_MIN = parseInt(arg('--teto-automatico'), 10) || 60;
const ORCAMENTO_PEDIDO = parseInt(arg('--minutos'), 10) || null;

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

/* ══ O ORÇAMENTO DA RODADA — A CONTA QUE SAIU DA MÃO DO DONO (fatia A44, 21/08/2026) ═════════
   Entra: a dívida medida, a taxa que a rodada anterior deixou, e o que o dono pediu (ou nada).
   Sai:   quantos minutos esta rodada vale, QUEM decidiu, e o orçamento de CADA etapa.
   Não faz: não lê banco, não imprime, não roda nada — é regra, e regra tem que ter catraca.

   ══ A CONTA, COM OS NÚMEROS DE HOJE (21/08/2026, 11:37) ═════════════════════════════════════
       dívida 3.094 vivas sem item · ritmo MEDIDO 0,755 s por licitação · padrão 20 min
       zerar de uma vez = 3.094 × 0,755 / (0,45 × 60 × 0,75) = 116 min
   Com o padrão de 20 min cabem 429 por rodada: são 8 rodadas, e nesse meio-tempo chega mais.
   Com o teto automático de 60 min cabem 1.609: são 2 rodadas, e ninguém precisa clicar em nada.

   ══ POR QUE OS MINUTOS EXTRAS VÃO SÓ PARA OS ITENS ══════════════════════════════════════════
   Este é o achado da fatia, e ele é MEDIDO, não teórico. Em 20/08 o dono rodou o
   ZERAR_DIVIDA_ITENS.bat com `--minutos 213` para pagar a dívida de itens. Só que o orçamento
   é rateado pelo `FATIA`, então a VARREDURA também ganhou 47 minutos — e ela usou 1.263 s para
   trazer **7.273 licitações novas**. A dívida que ele estava pagando terminou a rodada MAIOR
   do que começou (4.456 -> 4.558). Comprar tempo para todas as etapas para pagar a dívida de
   uma delas é encher o balde pelo mesmo cano que se esvazia.
   >>> ENTÃO, QUANDO QUEM DECIDE SOU EU, só a etapa de itens cresce. A varredura e os prazos
       ficam com a fatia do orçamento PADRÃO — o mesmo tempo que teriam numa rodada comum.
   >>> QUANDO QUEM DECIDE É O DONO (`--minutos`), NADA DISSO SE APLICA: o número dele é o
       orçamento inteiro e todas as etapas crescem, como sempre foi. Reinterpretar a ordem de
       quem mandou seria consertar o defeito trocando-o por um pior — uma ferramenta que faz
       outra coisa com o número que você digitou.

   ══ E A "MÁQUINA OCIOSA" DA CAIXA: EU NÃO SEI MEDIR ISSO, E NÃO VOU FINGIR ══════════════════
   A caixa A44 pediu para gastar mais "quando a dívida é grande e a máquina está ociosa". A
   dívida eu meço. A ociosidade não: esta carga roda como PRIMEIRO ATO do ciclo do trabalhador,
   ou seja, exatamente quando a fábrica está trabalhando — nunca quando está ociosa. Inventar
   um sensor de ociosidade (hora do dia, carga de CPU) seria trocar um número honesto por um
   palpite com cara de medida.
   >>> O QUE ENTROU NO LUGAR É UM TETO DECLARADO: `TETO_AUTOMATICO_MIN`. Sozinho eu vou até
       ele e não passo. Acima dele, quem decide continua sendo o dono, e a ferramenta DIZ o
       número que ele teria de passar.

   ══ O QUE SE PERDE ══════════════════════════════════════════════════════════════════════════
   Previsibilidade do relógio. Hoje a rodada leva 8 min e sempre 8. Com a regra ela leva de 8 a
   ~29 min (60 × 0,45 = 27 min de itens + a fatia padrão das outras duas), conforme a dívida —
   e a fábrica só começa a fatia da caixa depois. Medido nos ciclos do trabalhador A
   (logs/motor_A.log, 14 a 21/08): dos 10 ciclos de trabalho de verdade, a mediana é 57 min e o
   maior foi 176. Uma carga de 29 min cabe nessa faixa, mas ela come metade de um ciclo mediano.
   >>> E NÃO SE PERDE REQUISIÇÃO CONTRA O PNCP: pagar 3.094 de dívida custa 3.094 perguntas,
       sejam elas em 2 rodadas ou em 8. Em 8 rodadas custa AS MESMAS 3.094 mais 6 varreduras e
       6 sondagens de prazo a mais. A regra pergunta MENOS ao serviço público, não mais. */
function orcamentoDaRodada(o) {
  const padrao = (o.padrao != null) ? o.padrao : ORCAMENTO_PADRAO_MIN;
  const teto = (o.tetoAutomatico != null) ? o.tetoAutomatico : TETO_AUTOMATICO_MIN;
  /* O rateio: `minutosItens` manda na etapa de itens, `minutosOutros` nas outras duas. Quando
     os dois são iguais, é o rateio de sempre — e é assim que a ordem do dono continua sendo a
     ordem do dono. */
  const reparte = (minutosItens, minutosOutros) => ({
    varredura: minutosOutros * FATIA.varredura,
    itens: minutosItens * FATIA.itens,
    prazos: minutosOutros * FATIA.prazos,
  });
  const fecha = (r) => Object.assign(r, {
    minutosDeRelogio: Math.round((r.etapas.varredura + r.etapas.itens + r.etapas.prazos) * 10) / 10,
  });

  const pedido = Number(o.pedidoDoDono);
  if (isFinite(pedido) && pedido > 0) {
    return fecha({ minutos: pedido, quem: 'dono', querido: null, teto, padrao,
      etapas: reparte(pedido, pedido),
      frase: 'orçamento de ' + pedido + ' min — ORDEM DO DONO (--minutos); todas as etapas crescem' });
  }

  /* A pergunta "quanto custa zerar" é a MESMA regra do teto dos itens, e ela mora no
     `planoDeItens`. Refazer a conta aqui criaria a segunda régua — e a que discorda calada é a
     que fica. O `minutosParaZerar` não depende do orçamento; o `zeraHoje` depende, e é por isso
     que a pergunta é feita contra o PADRÃO: "a dívida cabe numa rodada comum?". */
  const seco = planoDeItens({ dividaVivas: o.dividaVivas, orcamentoMin: padrao, taxaAnterior: o.taxaAnterior });
  if (seco.divida == null || seco.zeraHoje || seco.minutosParaZerar == null) {
    return fecha({ minutos: padrao, quem: 'padrao', querido: null, teto, padrao,
      etapas: reparte(padrao, padrao),
      frase: 'orçamento padrão de ' + padrao + ' min — a dívida cabe nele' });
  }

  const querido = seco.minutosParaZerar;
  /* ══ A REGRA NUNCA ENCOLHE A RODADA — E O PISO NÃO É CÓDIGO, É UMA INVARIANTE ═══════════════
     Eu tinha escrito `Math.max(padrao, Math.min(querido, teto))`, com o `Math.max` de cinto de
     segurança. O `tools/muta_a44.js` tirou o `Math.max` e a catraca NÃO reclamou — então fui
     ver: ele era inalcançável. Chegar aqui exige `!zeraHoje`, isto é `divida > cabe`; e
     `cabe = padrao·0,45·60·0,75 / seg` enquanto `querido = divida·seg / (0,45·60·0,75)`. As
     duas são a MESMA conversão em sentidos opostos, então `divida > cabe` implica
     `querido > padrao`, para qualquer padrão. O cinto nunca podia apertar.
     >>> E A CASA JÁ CHAMA ISSO DE DEFEITO, com estas palavras (testa_busca_placeholder, 32):
         *"um gesto sem efeito, que é a pior categoria de código vivo"*. Então ele saiu.
     >>> O QUE FICOU NO LUGAR NÃO É NADA: é o assert 63 da catraca, que varre 40 pares de
         (dívida, ritmo) e exige `minutos >= padrao` em todos. A garantia era da ÁLGEBRA, e
         álgebra se guarda com prova, não com uma linha que finge trabalhar. Se um dia alguém
         desacoplar as duas fórmulas, é o 63 que grita — o `Math.max` teria escondido. */
  const minutos = Math.min(querido, teto);
  const bateuNoTeto = querido > teto;
  return fecha({ minutos, quem: bateuNoTeto ? 'teto' : 'divida', querido, teto, padrao,
    etapas: reparte(minutos, padrao),
    frase: bateuNoTeto
      ? 'a dívida pediria ' + querido + ' min e eu paro no teto automático de ' + teto
        + ' min — acima disso quem decide é o dono: --minutos ' + querido
      : 'a dívida pede ' + querido + ' min e eu compro os ' + minutos
        + ' (teto automático: ' + teto + ' min)' });
}

const agora = () => new Date();
const iso = d => d.toISOString();
const dormir = ms => new Promise(r => setTimeout(r, ms));

/* ══ A REDE QUE PISCA NÃO PODE SER O FIM DA RODADA (fatia A39, 20/08/2026) ═══════════════════
   A rodada inteira deste condutor termina em UMA chamada: o `POST coleta_status` que grava o
   carimbo. Um `fetch failed` ali apagava a prestação de contas de vinte minutos de trabalho que
   JÁ ESTAVA FEITO — as licitações no banco, os itens no banco, e o carimbo em lugar nenhum. É o
   mesmo defeito que matou três ciclos do trabalhador A com `ENOTFOUND`, um deles com 2h33 de
   trabalho: quem só presta contas no fim tem o registro inteiro pendurado na chamada mais frágil.

   >>> ESPERA CRESCENTE E TETO DE TENTATIVAS, e nada de engolir. Depois das tentativas o erro
       CONTINUA sendo erro — ele sobe, sai no console e a rodada não se declara boa. O que muda é
       o alcance: uma gravação adiada em vez de uma rodada inteira sem registro.
   >>> SÓ FALHA DE TRANSPORTE ENTRA AQUI. Um 401 ou um 409 voltam como `r` e quem chamou confere
       o `r.ok`, como sempre conferiu — retentar um 401 é bater três vezes na mesma porta trancada.
   >>> A ESCADA É A MESMA DO `coleta_itens_lote.js` em espírito (2s · 6s · 18s): rápida o
       bastante para atravessar um piscar de roteador, curta o bastante para não comer o
       orçamento da rodada seguinte. */
const TENTATIVAS_REDE = 4;
const esperaCrescente = t => Math.min(18000, 2000 * Math.pow(3, t));
const ehQuedaDeRede = e => /fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network/i
  .test(String((e && e.message) || e));
/* O PLANO DA TEIMOSIA É UM PARÂMETRO COM PADRÃO, e não um número escrito dentro do laço. A razão
   é a lição da A34, agora da casa: uma catraca que quisesse provar "ele retenta e desiste" com o
   plano de produção esperaria 26 segundos por assert, e teste lento é teste que ninguém roda.
   >>> E O PADRÃO CONTINUA SENDO O DE PRODUÇÃO — a suíte confere OS DOIS: que o padrão é 4
       tentativas com 2s·6s·18s, e que o comportamento é o certo, com o plano curto. */
const PLANO_PADRAO = { tentativas: TENTATIVAS_REDE, espera: esperaCrescente };

async function fetchTeimoso(url, opcoes, oQue, plano) {
  const { tentativas, espera: quantoEsperar } = Object.assign({}, PLANO_PADRAO, plano || {});
  let ultimo = null;
  for (let t = 0; t < tentativas; t++) {
    try { return await fetch(url, opcoes); }
    catch (e) {
      /* SÓ A FALHA DE TRANSPORTE CAI AQUI. Resposta 4xx/5xx não levanta exceção — ela volta como
         `r` e quem chamou confere o `r.ok`, como sempre conferiu. */
      ultimo = e;
      if (t === tentativas - 1) break;
      const ms = quantoEsperar(t);
      console.log('    ! rede (' + oQue + '): ' + e.message + ' — nova tentativa em ' + ms / 1000 + 's');
      await dormir(ms);
    }
  }
  const erro = new Error(oQue + ': ' + (ultimo && ultimo.message) + ' (' + tentativas + ' tentativas)');
  erro.quedaDeRede = ehQuedaDeRede(ultimo);
  erro.tentativas = tentativas;
  throw erro;
}

/* ══ E AO DESISTIR, GRAVA O QUE TEM ══════════════════════════════════════════════════════════
   O carimbo que não chegou ao banco vai pro disco, inteiro, com o nome da hora. Ele não substitui
   a gravação — ele impede que o trabalho medido desapareça enquanto a porta está fechada.
   `node tools/carga_diaria.js --carimbos-pendentes` reenvia o que estiver lá e só apaga o arquivo
   DEPOIS de o banco confirmar. Apagar antes seria trocar um registro adiado por nenhum. */
const PASTA_PENDENTES = path.join(RAIZ, 'logs');
let _seq = 0;   // duas quedas no mesmo milissegundo não podem virar um arquivo só
function guardaCarimboEmDisco(linha, porque, pasta) {
  const destino = pasta || PASTA_PENDENTES;
  try {
    if (!fs.existsSync(destino)) fs.mkdirSync(destino, { recursive: true });
    const nome = 'carimbo_pendente_' + new Date().toISOString().replace(/[:.]/g, '-')
      + '_' + String(++_seq).padStart(2, '0') + '.json';
    const caminho = path.join(destino, nome);
    fs.writeFileSync(caminho, JSON.stringify({ porque, gravado_em: new Date().toISOString(), linha }, null, 2), 'utf8');
    return caminho;
  } catch (e) { return null; }
}

async function pede(caminho, extra) {
  const { SB, H } = banco();
  return await fetchTeimoso(SB + '/rest/v1/' + caminho,
    { headers: Object.assign({}, H, extra || {}) }, 'GET ' + caminho.split('?')[0]);
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

/* Devolve `{ok}` como um `fetch` devolveria, mais `pendente` com o caminho do disco quando a
   porta não abriu. Quem chama continua conferindo `r.ok` — o desfecho novo é ADITIVO. */
/* `onde` (o endereço e o cabeçalho) e `pasta` (o disco) são PARÂMETROS com padrão de produção,
   pela mesma razão do plano da teimosia: sem eles, provar "a rede caiu e o carimbo foi pro disco"
   exigiria a `service_role` na mão e escreveria no `logs/` de verdade — e regra que só se testa
   com a chave-mestra na mão é regra que ninguém testa. */
async function gravaCarimbo(linha, onde, plano, pasta) {
  const { SB, H } = onde || banco();
  try {
    const r = await fetchTeimoso(`${SB}/rest/v1/coleta_status?on_conflict=fonte`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify([linha]),
    }, 'gravar o carimbo', plano);
    if (r.ok) return r;
    /* RESPONDEU MAL também perde o carimbo se ninguém guardar. 4xx/5xx não é queda de rede, mas o
       trabalho da rodada some do mesmo jeito — e o disco custa nada. */
    const guardado = guardaCarimboEmDisco(linha, 'o banco respondeu HTTP ' + r.status, pasta);
    return { ok: false, status: r.status, pendente: guardado };
  } catch (e) {
    const guardado = guardaCarimboEmDisco(linha, e.message, pasta);
    return { ok: false, status: e.message, pendente: guardado, quedaDeRede: !!e.quedaDeRede };
  }
}

/* ══ REENVIAR O QUE FICOU NO DISCO ═══════════════════════════════════════════════════════════
   O arquivo só é apagado DEPOIS de o banco confirmar. Apagar antes trocaria um registro adiado
   por nenhum — que é exatamente o defeito que esta fatia veio matar. */
async function reenviaPendentes(onde, plano, pasta) {
  const dir = pasta || PASTA_PENDENTES;
  if (!fs.existsSync(dir)) { console.log('não há carimbo pendente no disco.'); return 0; }
  const arquivos = fs.readdirSync(dir).filter(n => /^carimbo_pendente_.*\.json$/.test(n)).sort();
  if (!arquivos.length) { console.log('não há carimbo pendente no disco.'); return 0; }
  let enviados = 0;
  for (const nome of arquivos) {
    const caminho = path.join(dir, nome);
    let guardado;
    try { guardado = JSON.parse(fs.readFileSync(caminho, 'utf8')); }
    catch (e) { console.log('  ! ' + nome + ': não consegui ler (' + e.message + ') — fica onde está'); continue; }
    const { SB, H } = onde || banco();
    let r;
    try {
      r = await fetchTeimoso(`${SB}/rest/v1/coleta_status?on_conflict=fonte`, {
        method: 'POST',
        headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify([guardado.linha]),
      }, 'reenviar ' + nome, plano);
    } catch (e) { console.log('  ! ' + nome + ': ' + e.message + ' — fica no disco'); continue; }
    /* SÓ APAGA DEPOIS DE O BANCO CONFIRMAR. Apagar antes trocaria um registro adiado por nenhum —
       que é exatamente o defeito que esta fatia veio matar. */
    if (!r.ok) { console.log('  ! ' + nome + ': HTTP ' + r.status + ' — fica no disco'); continue; }
    fs.unlinkSync(caminho);
    enviados++;
    console.log('  ✓ ' + nome + ' gravado no banco e removido do disco (era de ' + guardado.gravado_em + ')');
  }
  console.log(enviados + ' de ' + arquivos.length + ' carimbo(s) pendente(s) enviado(s).');
  return enviados;
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
  /* QUEM DECIDIU O ORÇAMENTO aparece no carimbo lido (A44): "60 min" sem dono é uma frase
     ambígua — pode ser a regra tendo comprado tempo ou o dono tendo digitado. */
  if (d.orcamento_quem) console.log('  orçamento ....... ' + num(d.orcamento_min) + ' min'
    + '  · decidido por: ' + ({ dono: 'ORDEM DO DONO (--minutos)', padrao: 'o padrão (a dívida cabia nele)',
                                divida: 'a REGRA, comprando o que a dívida pedia',
                                teto: 'a REGRA, PARADA no teto automático' }[d.orcamento_quem] || d.orcamento_quem)
    + (d.orcamento_quem === 'teto' ? '  (a dívida pediria ' + num(d.orcamento_querido) + ' min)' : '')
    + (d.orcamento_etapas_min ? '  · etapas: varredura ' + d.orcamento_etapas_min.varredura
        + ' · itens ' + d.orcamento_etapas_min.itens
        + ' · prazos ' + d.orcamento_etapas_min.prazos : ''));
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
module.exports = { planoDeItens, textoDoSaldo, orcamentoDaRodada,
  ORCAMENTO_PADRAO_MIN, TETO_AUTOMATICO_MIN,
  FRESCOR_HORAS, FATIA, SEG_POR_LIC_PADRAO,
  /* A A39 também: a teimosia da rede e o carimbo que vai pro disco são regras, e regra sem porta
     de pergunta é regra sem catraca. Nenhuma delas lê a `service_role` ao ser importada. */
  fetchTeimoso, esperaCrescente, ehQuedaDeRede, PLANO_PADRAO, TENTATIVAS_REDE,
  guardaCarimboEmDisco, gravaCarimbo, reenviaPendentes, PASTA_PENDENTES };
if (require.main !== module) return;

(async () => {
  /* Antes de qualquer coisa que fale com a rede: se ficou carimbo no disco de uma rodada que não
     conseguiu gravar, ele vai primeiro. Deixar para depois seria repetir a aposta na última
     chamada, que é o defeito inteiro desta fatia. */
  if (SO_PENDENTES) { await reenviaPendentes(); return; }

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

  const antes = await retrato();
  console.log('ANTES: ' + num(antes.licitacoes) + ' licitações · ' + num(antes.itens) + ' itens · '
    + num(antes.sem_itens) + ' sem itens lidos · ' + num(antes.sem_prazo) + ' sem prazo');

  /* ══ O ORÇAMENTO É DECIDIDO DEPOIS DO RETRATO, e não antes (A44) ═══════════════════════════
     Ele era uma constante lida da linha de comando na primeira linha do arquivo — ou seja,
     decidido ANTES de alguém saber o tamanho da dívida. Um orçamento escolhido sem olhar a
     conta é um orçamento que só pode estar certo por sorte. */
  const orc = orcamentoDaRodada({
    dividaVivas: antes.vivas_sem_itens,
    taxaAnterior: carimboAntes && carimboAntes.detalhe && carimboAntes.detalhe.seg_por_lic,
    pedidoDoDono: ORCAMENTO_PEDIDO,
  });
  const ORCAMENTO_MIN = orc.minutos;
  console.log('orçamento: ' + orc.frase);
  console.log('  relógio no pior caso: ' + orc.minutosDeRelogio + ' min'
    + '   (varredura ' + orc.etapas.varredura.toFixed(1)
    + ' · itens ' + orc.etapas.itens.toFixed(1)
    + ' · prazos ' + orc.etapas.prazos.toFixed(1) + ')');
  /* A frase abaixo é a fatia inteira dita em uma linha: quem lê o log precisa entender por que
     a varredura não cresceu junto sem ir ler o cabeçalho do arquivo. */
  if (orc.quem === 'divida' || orc.quem === 'teto')
    console.log('  >>> só a etapa de ITENS cresceu. A varredura ficou com a fatia do padrão ('
      + orc.padrao + ' min) de propósito: em 20/08 uma varredura com orçamento grande trouxe '
      + '7.273 licitações novas e a dívida terminou a rodada MAIOR do que começou.');

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

  /* ══ O ORÇAMENTO DE CADA ETAPA VEM DE `orc.etapas`, NÃO DE UMA MULTIPLICAÇÃO AQUI (A44) ═════
     Enquanto era `ORCAMENTO_MIN * e.fatia`, o rateio estava escrito em DOIS lugares (aqui e na
     prévia) e a regra que decide quanto cada etapa vale não tinha onde ser perguntada. Agora
     ela é uma só, e é a mesma que a catraca lê. */
  const minutosDa = e => orc.etapas[e.nome];

  if (PREVIA) {
    console.log('\n--previa: rodaria, nesta ordem —');
    etapas.forEach(e => console.log('   ' + e.nome.padEnd(12) + 'node ' + e.args.join(' ')
      + '   (' + minutosDa(e).toFixed(1) + ' min)'));
    console.log('\nnada foi executado e nada foi gravado.');
    return;
  }

  const feitas = [];
  for (const e of etapas) {
    feitas.push(await rodaEtapa(e.nome, e.args, Math.round(minutosDa(e) * 60000)));
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
    /* ══ QUEM DECIDIU O ORÇAMENTO, GRAVADO (A44) ═══════════════════════════════════════════
       Sem isto, ler `orcamento_min: 60` dias depois não diz se foi a regra que comprou o tempo
       ou se o dono digitou o número — e são duas histórias diferentes sobre a mesma fábrica.
       `orcamento_querido` é o que a dívida teria pedido: quando ele é maior que o teto, está
       registrado que a regra PAROU no teto, e quanto faltou para ela. */
    orcamento_quem: orc.quem,
    orcamento_querido: orc.querido,
    orcamento_teto_automatico: orc.teto,
    orcamento_relogio_min: orc.minutosDeRelogio,
    orcamento_etapas_min: {
      varredura: +orc.etapas.varredura.toFixed(1),
      itens: +orc.etapas.itens.toFixed(1),
      prazos: +orc.etapas.prazos.toFixed(1),
    },
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

  /* A CHAMADA QUE CARREGA A RODADA INTEIRA. Ela é teimosa (espera crescente, teto de tentativas)
     e, se ainda assim não passar, o carimbo vai pro DISCO em vez de evaporar — ver `fetchTeimoso`
     e `guardaCarimboEmDisco` no topo. O `.catch` que estava aqui devolvia um objeto falso-ok e
     seguia em frente: o aviso saía, e o trabalho da rodada ficava sem registro nenhum. */
  const r = await gravaCarimbo(linha);

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
  if (!r || !r.ok) {
    console.error('⚠️  não consegui gravar o carimbo: ' + (r && r.status));
    if (r && r.pendente) {
      console.error('   O CARIMBO ESTÁ NO DISCO, INTEIRO: ' + path.relative(RAIZ, r.pendente));
      console.error('   reenvie com:  node tools/carga_diaria.js --carimbos-pendentes');
    } else {
      console.error('   E NÃO CONSEGUI GUARDÁ-LO NEM NO DISCO — o registro desta rodada se perdeu.');
    }
    /* Uma rodada cujo carimbo não chegou ao banco NÃO é uma rodada boa: a faixa da tela vai
       continuar mostrando a idade da carga anterior, e o código de saída tem de dizer isso. */
    process.exitCode = 1;
    return;
  }

  process.exitCode = okDeVerdade ? 0 : 1;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
