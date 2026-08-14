// SUITE testa_calendario_na_busca - a terceira fonte da Encontrar (item 7e).
//
// == O PEDIDO, E O QUE ELE CRIA DE RISCO ======================================================
// "A busca da Encontrar tambem tem que ACHAR o Calendario 2025 que o Natanael usa (os pregoes
// que importamos, que hoje vivem no funil e a busca nao encontra). Marcar a origem de cada
// resultado: 'do seu Calendario 2025' x 'indice PNCP' x 'busca nacional ao vivo'."
//
// TRES COISAS PODEM DAR ERRADO AQUI, E AS TRES MUDAM DECISAO DE NEGOCIO:
//
//  1. LER 1.000 DE 2.555 E ACHAR QUE LEU TUDO (S1). O PostgREST daqui corta em 1000. Sem
//     paginar, a tela responderia "a FPMED nunca disputou albumina" olhando 39% da base — e
//     alguem decidiria entrar num pregao achando que e a primeira vez.
//  2. FALHA DE LEITURA VIRAR "NUNCA DISPUTAMOS" (S6). Esta e a pior confusao possivel nesta
//     tela: 403 de vendedor, sessao vencida ou rede fora NAO podem sair como lista vazia.
//     "Nao consegui olhar" e "nao ha" sao afirmacoes diferentes.
//  3. O HISTORICO SE PASSAR POR OPORTUNIDADE. Um pregao de 2025 desenhado igual a uma licitacao
//     aberta faz alguem tentar disputar o que ja acabou. Por isso a fonte e declarada, a barra
//     e sempre cinza e a nota diz "isto e historico da casa".
//
//   node tests/testa_calendario_na_busca.js
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const L = fs.readFileSync(path.join(RAIZ, 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const SW = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8').replace(/\r\n/g, '\n');
const DDL = fs.readFileSync(path.join(RAIZ, 'ddl', 'licitacoes_acompanhadas.sql'), 'utf8');
const semCom = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const LIMPO = semCom(L);
const CSS1 = L.replace(/\s*\n\s*/g, '');

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
const CARREGA = corpo(LIMPO, 'carregarCalendario');
const FILTRA = corpo(LIMPO, 'filtraCalendario');
const PINTA = corpo(LIMPO, 'pintaCalendario');
const DISPARA = corpo(LIMPO, 'dispararCalendario');
const PROTEGIDO = corpo(LIMPO, 'calendarioProtegido');
const RENDER = corpo(LIMPO, 'render');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_calendario_na_busca - a terceira fonte da Encontrar (7e)\n');

// ── 0. o extrator achou tudo (assert cego e pior que assert vermelho) ────────────────────────
ok(n + '. o extrator achou as cinco funcoes inteiras',
  CARREGA.length > 300 && FILTRA.length > 150 && PINTA.length > 1000
  && DISPARA.length > 500 && PROTEGIDO.length > 100,
  { CARREGA: CARREGA.length, FILTRA: FILTRA.length, PINTA: PINTA.length,
    DISPARA: DISPARA.length, PROTEGIDO: PROTEGIDO.length }); n++;

// ── 1. a busca REALMENTE pergunta ao Calendario ──────────────────────────────────────────────
ok(n + '. *** a busca pergunta a tabela do Calendario 2025 ***',
  /licitacoes_acompanhadas/.test(CARREGA) && /origem=eq\.calendario_2025/.test(CARREGA)); n++;
/* Sem esta linha no render, a fonte existe e nunca e consultada — que e literalmente o estado
   de ontem ("os pregoes vivem no funil e a busca nao encontra"). */
ok(n + '. *** e o render CHAMA a busca do Calendario ***',
  /calendarioProtegido\(kws, excl\)/.test(RENDER)); n++;
/* A CHAMADA VEM ANTES DO `return` DO CASO VAZIO. Foi o defeito de 11/08 no bloco nacional: com
   "0 batem" a fonte extra nunca rodava — justamente quando ela mais vale. A fonte nova nao pode
   nascer com o defeito que a antiga levou meses pra corrigir. */
(function () {
  const iCal = RENDER.indexOf('calendarioProtegido');
  const iVazio = RENDER.indexOf('if(!hits.length)');
  ok(n + '. *** e ANTES do return do caso vazio (indice zerado e quando o historico mais vale) ***',
    iCal > 0 && iVazio > 0 && iCal < iVazio, { iCal, iVazio }); n++;
})();

// ── 2. paginar, ou mentir sobre a base (S1) ──────────────────────────────────────────────────
ok(n + '. *** a leitura e PAGINADA: 2.555 linhas e o PostgREST corta em 1000 ***',
  /lerPaginado\(/.test(CARREGA)); n++;
/* E o `lerPaginado` tem que continuar sendo o que pagina de verdade — se alguem trocar por um
   fetch simples com limit, este assert cai junto com o de cima. */
ok(n + '. e ninguem trocou por um fetch cru com limit (que e como a paginacao morre)',
  !/limit=\d+/.test(CARREGA) && !/fetch\(/.test(CARREGA)); n++;
ok(n + '. a tabela do DDL e mesmo a do Calendario (2.555 linhas, origem calendario_2025)',
  /origem\s+text not null default 'calendario_2025'/.test(DDL)); n++;

// ── 3. "nao consegui olhar" NUNCA vira "nao ha" (S6) ─────────────────────────────────────────
/* Este e o assert mais importante da suite. `lerPaginado` devolve null quando NADA foi lido, e
   null aqui tem que virar AVISO, nunca lista vazia — porque "a FPMED nunca disputou isto" e uma
   afirmacao que muda a decisao de participar. */
ok(n + '. *** falha de leitura vira null, e null NAO e lista vazia ***',
  /if\(j === null\)/.test(CARREGA) && /_calErro = /.test(CARREGA)); n++;
/* O assert nao cobra a frase LITERAL porque ela tem um <b> no meio ("Isto <b>não</b> quer
   dizer..."), e cobrar marcacao e cobrar o meio. Ele cobra as DUAS metades do sentido: que a
   tela nega a conclusao errada, e que ela diz qual foi o problema de verdade. */
ok(n + '. *** e a tela DIZ que nao conseguiu olhar, em vez de afirmar que nao ha ***',
  /nunca disputou isto/.test(DISPARA) && /não consegui olhar/.test(DISPARA)); n++;
/* O 403 do vendedor e o caso concreto disso: a tabela e de GESTOR por causa do valor_ganho. */
ok(n + '. a tabela e mesmo de gestor no DDL (por isso o 403 do vendedor e esperado)',
  /Leitura de GESTOR/i.test(DDL) || /gestor/i.test(DDL)); n++;
/* E a leitura e INDEPENDENTE: o 403 daqui nao pode derrubar o indice nem o nacional. O escudo
   sincrono e o que garante isso do lado da tela. */
ok(n + '. um estouro sincrono nao derruba a lista inteira (o mesmo escudo do nacional)',
  /try\{ dispararCalendario/.test(PROTEGIDO) && /continua valendo/.test(PROTEGIDO)); n++;

// ── 4. zero medido e dito como zero ──────────────────────────────────────────────────────────
/* Zero aqui e RESPOSTA, e das boas: "a casa nunca disputou isto" muda a conversa. Entao ele e
   dito, e dito com o tamanho da base consultada — senao se le como "a busca nao funcionou". */
ok(n + '. *** zero e dito como zero, com o tamanho da base que foi consultada ***',
  /zero quer dizer zero/.test(DISPARA) && /certames que a FPMED acompanhou/.test(DISPARA)); n++;
/* Sem palavra-chave o bloco SOME, e isso e diferente de sumir calado: sem termo nao ha pergunta
   a fazer ao historico, e despejar 2.555 linhas de 2025 seria ruido com aparencia de trabalho. */
ok(n + '. sem palavra-chave ele nao aparece (2.555 linhas de 2025 embaixo do resultado e ruido)',
  /if\(!kws\.length\)\{ box\.style\.display = 'none'/.test(DISPARA)); n++;

// ── 5. o filtro e o MESMO do indice ──────────────────────────────────────────────────────────
/* Uma segunda regra de casamento criaria o par que diverge: a busca acharia no indice e nao
   acharia no Calendario, pela mesma palavra. "farmaceutico" tem que achar "FARMACEUTICO" nas
   tres fontes, e quem garante isso e o semAcento compartilhado. */
ok(n + '. *** o filtro usa o MESMO semAcento do indice (uma regra, tres fontes) ***',
  /semAcento\(String\(l\.objeto/.test(FILTRA)); n++;
ok(n + '. e respeita os termos de exclusao, como o indice',
  /excl\.length && excl\.some/.test(FILTRA)); n++;

// ── 6. historico nao pode se passar por oportunidade ─────────────────────────────────────────
ok(n + '. *** a fonte e declarada no painel ("do seu Calendario 2025") ***',
  /do seu Calendário 2025/.test(PINTA) && /selo-fonte hist/.test(PINTA)); n++;
ok(n + '. *** e a nota diz que isto e HISTORICO, nao licitacao aberta ***',
  /histórico da casa<\/b>, não licitação aberta/.test(PINTA)); n++;
/* A barra e SEMPRE cinza: historico nao tem urgencia, e uma barra azul de "aberta" numa linha
   de 2025 seria a tela sugerindo uma disputa que ja acabou. E a mesma decisao medida do 7d. */
/* A classe ganhou o `clicavel` na fatia A21 (o cartao inteiro abre o detalhe do historico), e o
   assert passa a olhar as DUAS coisas que ele sempre guardou: a barra e `prazo-nd`, e nao ha
   `prazo-urg` nenhum neste painel. Amarrar no texto exato da lista de classes deixaria o proximo
   acrescimo vermelho sem nada ter piorado. */
ok(n + '. *** a barra e sempre cinza: historico nao tem prazo correndo ***',
  /class="lic clicavel prazo-nd"/.test(PINTA) && !/prazo-urg/.test(PINTA)); n++;

// ── 7. as TRES fontes se identificam do mesmo jeito ──────────────────────────────────────────
/* A ordem do dono e "marcar a origem de cada resultado". O lugar onde ela vale por trinta
   linhas de uma vez e o cabecalho do painel que as contem — mas os TRES tem que ter. */
ok(n + '. *** as tres listas declaram a origem, e com o MESMO desenho ***',
  /nosso índice do PNCP/.test(LIMPO) && /do seu Calendário 2025/.test(LIMPO)
  && /ao vivo · PNCP/.test(LIMPO)
  && (LIMPO.match(/class="selo-fonte/g) || []).length >= 3); n++;
ok(n + '. e a variante do historico e ambar (outra natureza), nao um segundo desenho',
  /\.selo-fonte\.hist\{background:var\(--ambar-50\);color:var\(--ambar-700\)\}/.test(CSS1)); n++;

// ── 8. dinheiro: perder nao e ganhar zero (S6 de novo) ───────────────────────────────────────
ok(n + '. *** "valor ganho" so aparece quando houve ganho (perder nao e ganhar R$ 0) ***',
  /ganho \? '<div class="dado"><small>Valor ganho/.test(PINTA)); n++;
ok(n + '. e "N ganhas" no cabecalho so aparece quando ha',
  /ganhas \? ' · <b>' \+ ganhas/.test(PINTA)); n++;
/* ACHADO NO LACO VISUAL: o `brl` da tela arredonda pro real inteiro, e R$ 63.034.332,63 saiu
   como "R$ 63.034.333". Num valor ESTIMADO isso e arredondamento honesto; num VALOR GANHO e um
   numero que nao bate com a planilha que alguem vai usar pra conferir. */
ok(n + '. *** o valor ganho sai com os CENTAVOS (estimativa se arredonda, dinheiro recebido nao) ***',
  /brlExato\(l\.valor_ganho\)/.test(PINTA)
  && /minimumFractionDigits:2/.test(LIMPO)
  && !/brl\(l\.valor_ganho\)/.test(PINTA)); n++;

// ── 9. o teto da lista e DITO (nada de truncar em silencio) ──────────────────────────────────
/* Cortar em 30 e legitimo; cortar calado nao. Quem ve 30 e nao sabe que ha 214 conclui que ha
   30 — e essa e a mesma familia do "limit=3000 que o servidor ignorou". */
ok(n + '. *** o corte em 30 e DITO, com o total por tras ***',
  /achados\.length > CAL_TETO/.test(PINTA) && /mais recentes de <b>/.test(PINTA)); n++;
ok(n + '. e a ordem da lista esta escrita', /abertura mais recente/.test(PINTA)); n++;

// ── 10. a casca (S13) ────────────────────────────────────────────────────────────────────────
/* A FORMA, e nao o valor — pelo motivo escrito no testa_busca_nacional_molde: cravar a string
   faz o assert ficar vermelho na publicacao seguinte, pedindo pra nao publicar. Que a VERSAO
   subiu NO MESMO COMMIT e promessa de ritual (Definicao de Pronto), nao coisa que um regex
   sobre o arquivo consiga saber. */
ok(n + '. a VERSAO do sw tem a forma datada e numerada que faz o cache virar',
  /VERSAO = 'limedtec-fpmed-\d{4}-\d{2}-\d{2}-\d+'/.test(SW)); n++;
/* O bloco tem que estar no HTML, FORA do #lista: dentro, o `lista.innerHTML = h` do render o
   apagaria a cada busca — e o sintoma seria a fonte nova "sumindo" sozinha. */
(function () {
  const iL = L.indexOf('<div id="lista">'), iC = L.indexOf('<div id="calendario"'), iN = L.indexOf('<div id="nacional"');
  const meio = iL >= 0 && iC > iL ? L.slice(iL, iC) : '';
  const abre = (meio.match(/<div\b/g) || []).length, fecha = (meio.match(/<\/div>/g) || []).length;
  ok(n + '. o bloco esta FORA do #lista, e entre o indice e o nacional (do mais nosso ao mais alheio)',
    iL >= 0 && iC > iL && iN > iC && abre > 0 && abre === fecha, { iL, iC, iN, abre, fecha }); n++;
})();

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
