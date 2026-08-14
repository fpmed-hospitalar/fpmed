// SUITE testa_busca_nacional_molde - a busca nacional do PNCP com a cara do molde (item 7d).
//
// == O QUE MUDOU, E POR QUE PRECISA DE GUARDA =================================================
// A busca nacional saia como TABELA CRUA de seis colunas (UF/ITEM/ORGAO/MODALIDADE/PUBLICADO/
// PORTAL) logo abaixo do painel do passo 6 - duas listas de licitacao na mesma tela, com dois
// desenhos. Agora e o MESMO painel e as MESMAS linhas.
//
// Numa troca dessas, o que pode sumir sem ninguem notar e justamente o que foi MEDIDO:
//
//  1. O VALOR E O PORTAL PODEM VOLTAR CHUTADOS. Medido em 30 resultados, dois termos:
//     `valor_global` vem vazio em 30 de 30 e NAO EXISTE campo de portal na resposta do PNCP.
//     A tabela antiga imprimia a coluna PORTAL com um travessao. Rotulo com travessao ocupa o
//     mesmo espaco do dado e ainda faz a pessoa procurar o que nao existe - e o passo seguinte,
//     que e o perigoso, e alguem "preencher" aquilo com R$ 0 (licao S6).
//  2. A BARRA DE URGENCIA PODE PINTAR A LISTA INTEIRA. Medido: "albumina" 26/30 com vigencia,
//     ZERO no futuro; "dipirona" 22/30, ZERO no futuro. Com a regua do indice (vermelho =
//     encerrada) as trinta linhas sairiam vermelhas, e trinta barras vermelhas nao sao trinta
//     avisos - sao um fundo vermelho. A cor tem que marcar a EXCECAO.
//  3. O SPRITE PODE VIRAR DUAS COPIAS DE NOVO. O selo do orgao ja existia nos dois arquivos com
//     desenhos QUASE iguais (colunas em 5/9.5/14.5/19 contra 5.5/10/14/18.5). Enquanto o
//     fpmed_negocios.html ainda tiver sprite inline, esta suite compara simbolo a simbolo.
//
//   node tests/testa_busca_nacional_molde.js
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const L = fs.readFileSync(path.join(RAIZ, 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const SW = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8').replace(/\r\n/g, '\n');
const ICO = require(path.join(RAIZ, 'fpmed_icones.js'));
const semCom = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const LIMPO = semCom(L);
const CSS1 = L.replace(/\s*\n\s*/g, '');

/* O EXTRATOR CONTA CHAVES BALANCEADAS, e nao e capricho: a versao nao-gulosa deste extrator ja
   parou na primeira chave interna e mediu meia funcao (achado do passo 3). Meia funcao passa em
   assert de ausencia por motivo errado - o trecho que provaria o contrario ficou de fora. */
function corpo(fonte, nome) {
  const i = fonte.indexOf('function ' + nome);
  if (i < 0) return '';
  const ini = fonte.indexOf('{', i);
  if (ini < 0) return '';
  let n = 0;
  for (let k = ini; k < fonte.length; k++) {
    if (fonte[k] === '{') n++;
    else if (fonte[k] === '}') { n--; if (!n) return fonte.slice(ini, k + 1); }
  }
  return '';
}
const PINTA = corpo(LIMPO, 'pintaNacional');
const DISPARA = corpo(LIMPO, 'dispararBuscaNacional');
const PROTEGIDO = corpo(LIMPO, 'nacionalProtegido');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_busca_nacional_molde - o painel do molde na busca nacional (7d)\n');

// ── 0. o extrator achou o que ia medir (senao TUDO abaixo passa por motivo errado) ───────────
ok(n + '. o extrator achou as tres funcoes inteiras (assert cego e pior que assert vermelho)',
  PINTA.length > 1200 && DISPARA.length > 200 && PROTEGIDO.length > 100,
  { pinta: PINTA.length, dispara: DISPARA.length, protegido: PROTEGIDO.length }); n++;

// ── 1. e um PAINEL, e nao uma tabela crua ────────────────────────────────────────────────────
ok(n + '. *** a busca nacional usa o MESMO painel do indice, e nao um desenho proprio ***',
  /class="painel-res"/.test(PINTA) && /class="lic/.test(PINTA)); n++;
ok(n + '. a tabela crua morreu (nada de <table>/<thead>/<td> na busca nacional)',
  !/<table|<thead|<tbody|<td |<th /.test(PINTA)); n++;
/* A anatomia da linha e a MESMA do indice: se um dia o nacional ganhar classes proprias, as duas
   listas voltam a divergir - que e o defeito que este item veio consertar. */
ok(n + '. a linha tem a anatomia do indice (selo, titulo, objeto, dados, acoes)',
  ['class="selo"', 'class="titulo"', 'class="obj"', 'class="dados"', 'class="acoes"']
    .every(c => PINTA.includes(c))); n++;
ok(n + '. cabecalho e rodape do painel existem (o rodape tambem FECHA a lista)',
  /class="cabecalho"/.test(PINTA) && /class="rodape-painel"/.test(PINTA)); n++;

// ── 2. o que o PNCP NAO manda nao aparece chutado ────────────────────────────────────────────
ok(n + '. *** o VALOR nao entra na linha: o PNCP nao manda (medido, 0 de 30) ***',
  !/Valor estimado/.test(PINTA) && !/valorTotalEstimado|valor_global/.test(PINTA)); n++;
ok(n + '. *** o PORTAL nao entra: nao existe campo pra ele na resposta ***',
  !/>PORTAL</.test(PINTA) && !/<small>Portal<\/small>/.test(PINTA)); n++;
/* A conta de brl() nunca deve ser chamada aqui: e ela que transforma ausencia em "R$ 0" (S6).
   Este assert e o que impede a "melhoria" de alguem que ache que falta o valor na lista. */
ok(n + '. e ninguem formata dinheiro na busca nacional (e assim que ausencia vira R$ 0)',
  !/brl\(/.test(PINTA)); n++;
ok(n + '. as duas ausencias sao DITAS na nota, e nao so omitidas',
  /não informa o portal/.test(PINTA) && /não traz o valor/.test(PINTA)); n++;

// ── 3. a vigencia: a cor marca a excecao, e "nao sei" nao vira data ──────────────────────────
ok(n + '. *** a barra padrao e CINZA — vencida ou sem data nao acendem cor ***',
  /\.lic\.prazo-nd::before\{background:var\(--cinza-300\)\}/.test(CSS1)
  && /prazo-nd/.test(PINTA)); n++;
/* Sem `data_fim_vigencia` a linha diz isso em PALAVRAS. O que nao pode acontecer e a data sumir
   em silencio e a linha ficar visualmente igual a uma cuja vigencia foi conferida. */
ok(n + '. vigencia ausente e dita ("nao informada"), nao apagada',
  /vigência não informada/.test(PINTA)); n++;
ok(n + '. vigencia vencida diz a DATA em que venceu (nao so "encerrada")',
  /vigência encerrada em '\+fmt\(/.test(PINTA)); n++;
/* AS DUAS SO PODEM SER DISTINGUIDAS PELO CRACHA, porque a barra e a mesma cinza nas duas. Se um
   dia o cracha sumir, a linha sem data e a linha vencida ficam indistinguiveis. */
ok(n + '. a barra nunca anda sozinha: os tres casos tem cracha escrito',
  (PINTA.match(/bdg/g) || []).length >= 3); n++;
ok(n + '. so quem esta de pe ganha cor (ambar <=2 dias, senao o padrao)',
  /dias<=2 \? ' prazo-urg' : ''/.test(PINTA)); n++;
/* "N ainda vigentes" no cabecalho segue a regra do "abrem hoje" do indice: so aparece quando
   existe. "0 ainda vigentes" em toda busca e ruido diario, e ruido diario ensina a nao ler. */
ok(n + '. "N ainda vigentes" so aparece quando ha (0 todo dia ensina a ignorar o cabecalho)',
  /vivas \? ' · <b>' \+ vivas/.test(PINTA)); n++;
/* E a conta e feita ANTES de desenhar, uma vez, sobre a MESMA lista que vira linha. Se ela fosse
   refeita por linha, cabecalho e linhas poderiam discordar. */
ok(n + '. a contagem sai da MESMA leitura que desenha as linhas (uma conta, dois lugares)',
  /const vigs = itens\.map\(vigencia\)/.test(PINTA) && /vigs\[k\]/.test(PINTA)); n++;

// ── 4. o que ja existia e nao podia sumir ────────────────────────────────────────────────────
ok(n + '. o grifo do termo continua no objeto (e o que responde "por que ESTE apareceu?")',
  /grifa\(i\.description/.test(PINTA)); n++;
ok(n + '. "ja no nosso indice" continua MARCADO, e nao escondido',
  /já no nosso índice/.test(PINTA)); n++;
ok(n + '. a ordem por semelhanca continua ESCRITA, com o numero que a justifica',
  /semelhança com o termo/.test(PINTA) && /0 de 20/.test(PINTA)); n++;
ok(n + '. o caso vazio continua dizendo que zero quer dizer zero',
  /zero quer dizer zero/.test(PINTA)); n++;
/* ══ ESTE ASSERT MUDOU DE LADO NA FATIA A21, POR ORDEM DO DONO ═══════════════════════════════
   Ele cobrava que "abrir no PNCP" fosse a acao DA LINHA — e era, porque era a UNICA que este
   painel tinha. O dono abriu a busca e viu exatamente isso: um painel inteiro cuja unica funcao
   era mandar a pessoa embora do sistema.
   >>> AGORA A PRIMARIA E "Ver itens e detalhes", que abre o MESMO detalhe do indice, e o PNCP
       desceu pra "⋯ mais acoes" — como ja estava no painel principal desde a A3. A regra e que
       sair do sistema deixe de ser o caminho de menor resistencia, nao que ele deixe de existir.
   >>> ENTAO O ASSERT COBRA AS DUAS COISAS: o link continua existindo e abrindo fora (com
       `rel="noopener"`), e NAO e mais a acao primaria da linha. */
ok(n + '. *** "abrir no PNCP" continua existindo, mas desceu de acao primaria pra "mais acoes" ***',
  /Abrir no PNCP/.test(PINTA) && /rel="noopener"/.test(PINTA)
  && /mais ações<\/button><span class="cx">/.test(PINTA)
  && /<button class="btn mini" onclick="abrirDetalheVivo\(/.test(PINTA)); n++;

// ── 5. os tres estados que nao sao resultado ─────────────────────────────────────────────────
/* A REGRA DURA de 11/08: com termo no campo este bloco pinta SEMPRE. Busca que falha calada
   parece busca que nao existe - foi o defeito que o operador reportou. */
ok(n + '. sem termo o bloco ENSINA o gesto, em vez de sumir',
  /faixa-nacional/.test(DISPARA) && /um único termo/.test(DISPARA)); n++;
ok(n + '. carregando tem estado proprio ("procurando ...")',
  /procurando "/.test(DISPARA)); n++;
ok(n + '. o erro da rede aparece, e diz que o indice acima continua valendo',
  /faixa-nacional atencao/.test(PINTA) && /continua valendo|só o nosso índice/.test(PINTA)); n++;
ok(n + '. o escudo do render tambem fala (tela quebrada vira bloco que diz que quebrou)',
  /faixa-nacional atencao/.test(PROTEGIDO)); n++;
/* O ERRO NAO GRITA (adendo de excelencia): ambar de atencao, nao vermelho de falha grave - o
   indice continua na tela, entao nada foi perdido. */
ok(n + '. e o erro nao grita: ambar de atencao, nao vermelho de falha',
  /\.faixa-nacional\.atencao\{border-color:var\(--ambar-100\);background:var\(--ambar-50\)\}/.test(CSS1)); n++;

// ── 6. emoji como icone (D11) ────────────────────────────────────────────────────────────────
/* A varredura da tela INTEIRA e item proprio da fila (51 ocorrencias medidas). Aqui a trava e
   so do que esta rodada reescreveu: o que nasce agora nao pode nascer fora da regra. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
ok(n + '. *** zero emoji-icone no que o 7d escreveu (D11) ***',
  !EMOJI.test(PINTA) && !EMOJI.test(DISPARA) && !EMOJI.test(PROTEGIDO),
  { pinta: (PINTA.match(EMOJI) || [])[0], dispara: (DISPARA.match(EMOJI) || [])[0] }); n++;
ok(n + '. e os icones saem do sprite compartilhado, por <use>',
  /<use href="#ic-globo"/.test(PINTA) && /<use href="#ic-orgao"/.test(PINTA)); n++;

// ── 7. o sprite e fonte unica ────────────────────────────────────────────────────────────────
ok(n + '. a Encontrar carrega o sprite, e ANTES do conteudo que o usa',
  L.indexOf('<script src="fpmed_icones.js">') > L.indexOf('<body>')
  && L.indexOf('<script src="fpmed_icones.js">') < L.indexOf('id="nacional"')); n++;
ok(n + '. o sprite tem os dois icones que o 7d precisou',
  ICO.ICONES.includes('ic-globo') && ICO.ICONES.includes('ic-sai')); n++;
/* O SELO DO INDICE PAROU DE SER <path> ESCRITO A MAO. Esta era a copia que ja tinha divergido
   meio pixel - e e a que prova que o problema nao e teorico. */
ok(n + '. *** o selo do indice usa o sprite: a copia escrita a mao morreu ***',
  /class="selo" aria-hidden="true"><svg><use href="#ic-orgao"\/><\/svg>/.test(LIMPO)
  && !/M9\.5 21V10/.test(L)); n++;
/* ENQUANTO O NEGOCIOS TIVER SPRITE INLINE, ele tem que bater com a fonte unica. E este assert e
   escrito pra continuar verde no dia em que ele adotar o modulo e apagar o inline: a checagem so
   vale quando ha o que checar. Assert que exige que o mundo fique parado envelhece mal. */
const NEG = fs.readFileSync(path.join(RAIZ, 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');
const inline = {};
let m2, re2 = /<symbol id="(ic-[a-z-]+)" viewBox="0 0 24 24">([\s\S]*?)<\/symbol>/g;
while ((m2 = re2.exec(NEG))) inline[m2[1]] = m2[2];
const qtInline = Object.keys(inline).length;
const divergem = Object.keys(inline).filter(k => ICO.SIMBOLOS[k] !== inline[k]);
ok(n + '. *** o sprite inline do Negocios nao pode divergir da fonte unica ***',
  qtInline === 0 || divergem.length === 0,
  { inline: qtInline, divergem }); n++;
console.log('    (o Negocios ainda tem ' + qtInline + ' simbolo(s) inline; quando ele adotar o'
  + ' fpmed_icones.js esse numero vira 0 e o assert segue verde)');

// ── 8. a casca (S13) ─────────────────────────────────────────────────────────────────────────
ok(n + '. o sprite entrou na casca do service worker, no mesmo commit em que a tela depende dele',
  /'\.\/fpmed_icones\.js'/.test(SW)); n++;
/* REAPONTADO no mesmo dia em que foi escrito (item 7e), e a licao e boa demais pra apagar: eu
   cravei a string `-2026-08-13-39`. Na publicacao SEGUINTE ela virou -40 e o assert ficou
   vermelho sem nada ter piorado — pior, ele estava me pedindo pra NAO publicar.
   >>> UM TESTE ESTATICO NAO CONSEGUE PROVAR QUE A VERSAO "SUBIU NO MESMO COMMIT": isso e
       promessa de RITUAL, e quem a guarda e a Definicao de Pronto, nao um regex. O que ele
       consegue provar e a FORMA — que existe uma VERSAO datada e numerada, que e o que faz o
       cache do service worker virar. Cravar o valor so transformava cada publicacao num
       vermelho de rotina, e vermelho de rotina e como se aprende a ignorar vermelho. */
ok(n + '. e a VERSAO tem a forma datada e numerada que faz o cache virar',
  /VERSAO = 'limedtec-fpmed-\d{4}-\d{2}-\d{2}-\d+'/.test(SW)); n++;

// ── 9. idempotencia da injecao (F4) ──────────────────────────────────────────────────────────
/* Duas tags na mesma pagina nao podem injetar dois sprites: id repetido no documento faz o
   <use> pegar um dos dois por sorte. Aqui o modulo roda de verdade contra um DOM de mentira. */
(function () {
  let html = '';
  const falso = {
    _tem: false,
    getElementById(id) { return (id === 'ic-sprite' && falso._tem) ? {} : null; },
    currentScript: null,
    body: { insertAdjacentHTML(_, s) { html += s; falso._tem = true; } },
    documentElement: {},
  };
  global.document = falso;
  const primeira = ICO.injeta();
  const segunda = ICO.injeta();
  delete global.document;
  ok(n + '. injetar duas vezes injeta UMA (id repetido faz o <use> pegar por sorte)',
    primeira === true && segunda === false && (html.match(/id="ic-sprite"/g) || []).length === 1,
    { primeira, segunda }); n++;
})();

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
