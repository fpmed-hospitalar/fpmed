// SUITE testa_cmed_no_detalhe - a CMED encostada no preco, no detalhe do item (item 8, telas).
//
// == O QUE ESTA FATIA FEZ =====================================================================
// A CMED deixou de ser ABA e virou BASE: o teto legal passou a aparecer NA LINHA do item do
// edital, ao lado do preco que o orgao estimou. E o "Conferir CMED" saiu do menu, porque um
// item de menu ensina que conferir o teto e uma parada separada que alguem lembra de fazer.
//
// TRES COISAS PODEM DAR ERRADO AQUI, E AS TRES SAO CARAS:
//
//  1. TETO CHUTADO. Item que nao casa com a CMED tem que ficar EM SILENCIO. Material e
//     correlato nao tem teto CMED por natureza — inventar um faria a tela dizer "acima do teto
//     legal" sobre um parafuso.
//  2. FALHA DE LEITURA VIRAR "SEM TETO". Se a consulta a CMED falhar e o indice for montado
//     sobre o vazio, a tela responde "nao encontrado" pra TUDO — e "nao encontrado" e uma
//     afirmacao sobre a CMED, nao sobre a nossa rede (S6 no lugar mais caro possivel).
//  3. A TELA FICAR SEM O ACESSO. Tirar do menu sem por em lugar nenhum obriga a decorar a URL.
//
//   node tests/testa_cmed_no_detalhe.js
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const L = fs.readFileSync(path.join(RAIZ, 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const MENU = fs.readFileSync(path.join(RAIZ, 'limedtec-menu.js'), 'utf8').replace(/\r\n/g, '\n');
const SW = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8').replace(/\r\n/g, '\n');
const semCom = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const LIMPO = semCom(L), MENU_LIMPO = semCom(MENU);

function corpo(fonte, nome) {
  const i = fonte.indexOf('function ' + nome);
  if (i < 0) return '';
  const ini = fonte.indexOf('{', i);
  let c = 0;
  for (let k = ini; k < fonte.length; k++) {
    if (fonte[k] === '{') c++;
    else if (fonte[k] === '}') { c--; if (!c) return fonte.slice(ini, k + 1); }
  }
  return '';
}
const CARREGA = corpo(LIMPO, 'carregarCMED');
const CELULA = corpo(LIMPO, 'celTetoCMED');
const TABELA = corpo(LIMPO, 'tabelaItens');
const VER = corpo(LIMPO, 'verItens');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_cmed_no_detalhe - a CMED encostada no preco (item 8)\n');

ok(n + '. o extrator achou as quatro pecas (assert cego e pior que assert vermelho)',
  CARREGA.length > 400 && CELULA.length > 500 && TABELA.length > 400 && VER.length > 200,
  { CARREGA: CARREGA.length, CELULA: CELULA.length, TABELA: TABELA.length, VER: VER.length }); n++;

// ── 1. o teto aparece NA LINHA, encostado no preco ───────────────────────────────────────────
ok(n + '. *** a coluna do teto existe na tabela do detalhe do item ***',
  /<th[^>]*>Teto CMED<\/th>/.test(LIMPO) && /celTetoCMED\(it, uE\)/.test(TABELA)); n++;
/* ENCOSTADA no preco, e nao no fim da linha: um teto legal a tres colunas do numero que ele
   limita e informacao que existe e nao e usada. */
ok(n + '. e ela vem LOGO DEPOIS do unitario do edital (encostada, como a ordem pede)',
  TABELA.indexOf('celTetoCMED') > TABELA.indexOf('celPreco(uE)')
  && TABELA.indexOf('celTetoCMED') - TABELA.indexOf('celPreco(uE)') < 120,
  { distancia: TABELA.indexOf('celTetoCMED') - TABELA.indexOf('celPreco(uE)') }); n++;
/* Este assert nasceu FRACO e a mutacao pegou: ele cobrava que `r.tipoTeto` APARECESSE no
   arquivo — e ele aparece tambem dentro do `title`, entao trocar o rotulo visivel por um texto
   fixo passava verde. Agora cobra que o valor seja EMITIDO na saida. */
ok(n + '. a celula diz qual teto e (PMVG x PF), porque sao reguas diferentes',
  /\+r\.tipoTeto\+/.test(CELULA.replace(/\s/g, '')) && /PMVG/.test(CELULA) && /PF/.test(CELULA)); n++;
/* Esta tela mostra licitacao PUBLICA: `paraGoverno:true` aqui e correto e nao e chute. Com
   CAP=Sim o teto e o PMVG por obrigacao legal (Resolucao CMED 5/2020). */
ok(n + '. *** declara paraGoverno: e licitacao publica, entao com CAP o teto e o PMVG ***',
  /paraGoverno: true/.test(CELULA)); n++;

// ── 2. nao casou = silencio, nunca teto chutado ──────────────────────────────────────────────
ok(n + '. *** item que nao casa fica em SILENCIO (sem teto), nunca com teto chutado ***',
  /if\(r\.teto == null\)/.test(CELULA) && /sem teto CMED/.test(CELULA)); n++;
/* E o silencio EXPLICA: material e correlato nao tem teto CMED por natureza. Sem essa frase,
   "sem teto CMED" se le como "o sistema nao achou", e alguem vai procurar o defeito. */
ok(n + '. e o silencio diz POR QUE (material e correlato nao tem teto por natureza)',
  /não têm teto\s*\n?\s*\+?\s*'?CMED por natureza|material e correlato/i.test(CELULA)); n++;
/* Fraco na 1a versao (a mutacao pegou): cobrava que o texto existisse no arquivo, e um `grau`
   esvaziado deixava a variavel morta com o codigo todo ainda la. Agora cobra que o `grau` SAIA
   no retorno E que ele venha do r.confianca. */
ok(n + '. o grau de confianca vai ESCRITO na celula, pra quem le saber o que esta olhando',
  /const grau = r\.confianca === 'exata' \? '' :/.test(CELULA)
  && /\+ grau \+/.test(CELULA.replace(/\s+/g, ' '))
  && /provável/.test(CELULA) && /confira/.test(CELULA)); n++;
/* A FAIXA aparece quando existe porque o teto e da APRESENTACAO, nao do principio ativo:
   DIPIRONA 1000MG tem 31 apresentacoes entre R$ 0,61 e R$ 1,45. */
ok(n + '. e a faixa aparece quando existe (o teto e da apresentacao, nao do principio ativo)',
  /r\.faixa && r\.faixa\[0\] !== r\.faixa\[1\]/.test(CELULA)); n++;

// ── 3. leitura que falhou NAO vira "sem teto" (S6) ───────────────────────────────────────────
/* Fraco na 1a versao: `_cmedErro` e "nao sei" apareciam no arquivo mesmo com a GUARDA desligada
   (`if(false) return`). O que importa e que o erro seja CONSULTADO antes de qualquer conclusao —
   e que ele venha ANTES do teste de casamento, senao a tela diz "sem teto CMED" quando a
   verdade e "nao consegui perguntar". */
ok(n + '. *** leitura falha vira "nao sei", e nao "este item nao tem teto" ***',
  /if\(_cmedErro\) return/.test(CELULA) && /não sei/.test(CELULA)
  && CELULA.indexOf('_cmedErro') < CELULA.indexOf('r.teto == null'),
  { erroAntes: CELULA.indexOf('_cmedErro'), tetoNulo: CELULA.indexOf('r.teto == null') }); n++;
/* `lerPaginado` devolve null quando NADA foi lido. Montar o indice sobre null faria a tela
   responder "nao encontrado" pra tudo — afirmacao sobre a CMED, feita por causa da nossa rede. */
ok(n + '. *** e o indice NAO e montado sobre leitura que falhou ***',
  /if\(teto === null \|\| dic === null\) throw/.test(CARREGA)); n++;
ok(n + '. a CMED nao derruba o cruzamento (ela e o acrescimo; o cruzamento e o pedido)',
  /catch\(e\)\{ _cmedErro =/.test(CARREGA) && /Promise\.all\(\[ puxarItens\(l\), carregarCMED\(\) \]\)/.test(VER)); n++;

// ── 4. o carregamento e o mesmo do Conferidor, e e paginado ──────────────────────────────────
ok(n + '. *** paginado: 4.875 e 6.283 passam de 1000, e o PostgREST corta em 1000 (S1) ***',
  (CARREGA.match(/lerPaginado\(/g) || []).length === 2
  && !/limit=\d+/.test(CARREGA), { chamadas: (CARREGA.match(/lerPaginado\(/g) || []).length }); n++;
/* A REGUA INTEIRA (25.702) NAO ENTRA: o item de edital nao traz ggrem/registro/EAN, entao o
   caminho exato nao dispara aqui. Baixar 25 mil linhas pra um caminho que nao vai rodar e
   pagar tres vezes o preco por nada. */
ok(n + '. e a regua inteira NAO e baixada (o item de edital nao traz chave exata)',
  /regua: \[\]/.test(CARREGA) && !/cmed_regua/.test(CARREGA)); n++;
ok(n + '. carrega UMA vez por sessao (nao a cada licitacao aberta)',
  /if\(_cmedIdx \|\| _cmedErro\) return/.test(CARREGA) && /if\(_cmedPromessa\) return _cmedPromessa/.test(CARREGA)); n++;

// ── 5. "Conferir CMED" saiu do menu, mas a tela nao ficou inalcancavel ───────────────────────
ok(n + '. *** "Conferir CMED" saiu da lista de modulos ***',
  !/\{ id: 'conferir', rotulo: 'Conferir CMED'/.test(MENU_LIMPO)); n++;
ok(n + '. *** mas a tela continua alcancavel, pelo rodape ***',
  /class="lm-crua" href="fpmed_conferidor\.html"/.test(MENU_LIMPO)); n++;
/* Discreta NAO e escondida: ela e link de verdade, com icone e alvo de clique. O que muda e o
   PESO. Esconder de vez obrigaria a decorar a URL. */
ok(n + '. e ela e um link de verdade, com icone e foco visivel (discreta nao e escondida)',
  /svg\('conferir'\)/.test(MENU_LIMPO) && /\.lm-crua:focus-visible/.test(MENU)); n++;
ok(n + '. a tela do conferidor continua na casca do service worker (nao virou link quebrado)',
  /'\.\/fpmed_conferidor\.html'/.test(SW)); n++;
ok(n + '. e o arquivo dela continua existindo no repo',
  fs.existsSync(path.join(RAIZ, 'fpmed_conferidor.html'))); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
