// SUITE testa_acoes_cartao — a fatia A21: o cartao inteiro abre, e as acoes seguem o estado.
//
// == O QUE MUDOU, E POR QUE PRECISA DE GUARDA ==================================
// O dono abriu a busca e viu cartoes cuja UNICA acao era "abrir no PNCP" — um botao que so
// sabe mandar embora do sistema. A A21 mexeu em cinco coisas que podem regredir caladas:
//
//  1. O CARTAO INTEIRO PASSOU A ABRIR O DETALHE. O risco de volta e sutil: basta alguem
//     esquecer o `closest(...)` do `cliqueCartao` pra marcar a caixa de selecao virar "abrir
//     o painel" — um gesto com dois efeitos, que e como se ensina alguem a ter medo de clicar.
//  2. AS ACOES SEGUEM O ESTADO. "Adicionar aos meus negocios" num pregao encerrado FUNCIONA:
//     cria o negocio, e o negocio nasce morto. Nenhum teste de "a tela abre" pega isso.
//  3. AS 400 LINHAS MUDAS. O `bruto` do indice vem em duas formas. A traducao precisa existir
//     em TODAS as portas de leitura — a quarta porta que alguem acrescentar sem tradutor
//     devolve cartao em branco de novo.
//  4. O QUE A FONTE NAO MANDA NAO PODE VIRAR ZERO. "R$ 0" e "abertura —" sao afirmacoes.
//  5. O CHIP DE CATEGORIA NAO PODE VOLTAR A SER PALPITE NO TITULO, e a lista filtrada nao
//     pode esconder caladamente as que ainda nao foram lidas.
//
//   node tests/testa_acoes_cartao.js
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const L = fs.readFileSync(path.join(RAIZ, 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const LIMPO = L.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const CSS1 = L.replace(/\s*\n\s*/g, '');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_acoes_cartao — a fatia A21 (o cartao inteiro, e as acoes por estado)\n');

// ── 1. O CARTAO INTEIRO ABRE O DETALHE, NOS TRES PAINEIS ─────────────────────
/* A classe do cartao do INDICE deixou de vir da urgencia da ABERTURA e passou a vir do RELOGIO
   do encerramento (fatia A38, molde v2 itens 3 e 4) — `urg.classe` virou `rel.classe`. O que
   este assert guarda continua sendo o mesmo: o cartao inteiro e clicavel nos tres paineis. */
ok(n + '. *** os TRES paineis tem cartao clicavel (indice, calendario e ao vivo) ***',
  /class="lic clicavel'\+rel\.classe/.test(LIMPO)          // indice
  && /class="lic clicavel'\+v\.classe\+'" onclick="cliqueVivo/.test(LIMPO)   // ao vivo
  && /class="lic clicavel prazo-nd" onclick="cliqueHistorico/.test(LIMPO)); n++;
/* O `closest` E O CORACAO DISSO. Sem ele, marcar a caixa de selecao ou abrir "mais acoes"
   abriria o painel junto. E ele tem que olhar o ANCESTRAL e nao a etiqueta do alvo: o clique
   de verdade quase sempre cai no <b>, no <svg> ou no texto DENTRO do botao. */
const CONTROLES = "'button,a,input,select,textarea,label,summary,.mais'";
ok(n + '. *** o clique no cartao IGNORA todo controle de verdade sob o cursor ***',
  (LIMPO.match(new RegExp('closest\\(' + CONTROLES.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\)', 'g')) || []).length === 3); n++;
ok(n + '. ...e as tres funcoes de clique existem, uma por painel',
  /function cliqueCartao\(ev, i\)/.test(LIMPO) && /function cliqueVivo\(ev, k\)/.test(LIMPO)
  && /function cliqueHistorico\(ev, k\)/.test(LIMPO)); n++;
/* O TITULO CONTINUA SENDO <button>, e nao vira o cartao: o cartao contem botoes, caixa e links,
   e botao dentro de botao e markup invalido que o leitor de tela anuncia errado. O caminho de
   teclado e o titulo; o clique no corpo e atalho de mouse por cima. */
ok(n + '. *** o cartao NAO vira role="button" (ele contem controles; seria markup invalido) ***',
  !/class="lic clicavel[^"]*"[^>]*role="button"/.test(LIMPO)
  && /<button type="button" class="titulo" onclick="abrirDetalhe\(/.test(LIMPO)
  && /<button type="button" class="titulo" onclick="abrirDetalheVivo\(/.test(LIMPO)); n++;
ok(n + '. o cursor diz que da pra clicar, e a linha NAO levanta (lista que treme, 13/08)',
  /\.lic\.clicavel\{cursor:pointer\}/.test(CSS1)
  && !/\.lic\.clicavel[^}]*transform/.test(CSS1)); n++;

// ── 2. AS ACOES SEGUEM O ESTADO ──────────────────────────────────────────────
ok(n + '. os tres estados existem, e "sem prazo" e um deles (nao um balde de encerrada)',
  /const EST_ABERTA = 'aberta', EST_ENCERRADA = 'encerrada', EST_SEM_PRAZO = 'sem-prazo'/.test(LIMPO)); n++;
/* QUEM DECIDE E A DATA. A `situacaoCompraNome` vale "Divulgada no PNCP" em 100% do indice
   (medido em 14/08): tem cara de estado e nao discrimina nada. */
ok(n + '. *** quem decide o estado e a DATA DE ENCERRAMENTO, nao a situacao declarada ***',
  /const fim = dt\(l && l\.dataEncerramentoProposta\);/.test(LIMPO)
  && !/estadoLic[\s\S]{0,400}situacaoCompraNome/.test(LIMPO)); n++;
/* A VIGENCIA SO FECHA. Vigencia correndo NAO prova que da pra disputar — o prazo de proposta
   fecha semanas antes. Ler "vigente" como "aberta" poria o botao verde em cima de um pregao
   cuja sessao ja passou. */
ok(n + '. *** vigencia so FECHA: vencida conclui encerrada, correndo NAO conclui aberta ***',
  /if\(vig && vig <= ag\) return EST_ENCERRADA;\s*\n\s*return EST_SEM_PRAZO;/.test(LIMPO)); n++;
ok(n + '. *** so a ABERTA oferece "Adicionar aos meus negocios" ***',
  /est === EST_ABERTA\s*\n?\s*[\s\S]{0,300}?Adicionar aos meus negócios/.test(LIMPO)); n++;
ok(n + '. *** a ENCERRADA oferece "Usar como referencia de preco", e nao adicionar ***',
  /est === EST_ENCERRADA[\s\S]{0,400}?Usar como referência de preço/.test(LIMPO)
  && /Ver itens e resultado/.test(LIMPO)); n++;
ok(n + '. ...e o detalhe segue o MESMO estado (senao a regra cai com um clique a mais)',
  /const acoes = '<div class="acoes"[\s\S]{0,200}?est === EST_ABERTA/.test(LIMPO)
  && /Certame encerrado\.<\/b> Não dá para disputar/.test(L)); n++;
/* "SEM ITENS LIDOS" TEM QUE DIZER ISSO E OFERECER O CAMINHO — nunca lista vazia com cara de
   "nao tem". Sao dois lugares: a etiqueta do cartao e o vazio do detalhe. */
ok(n + '. *** sem itens lidos, o cartao DIZ isso e o botao vira "Buscar os itens agora" ***',
  /itens ainda não lidos/.test(L) && /Buscar os itens agora/.test(L)
  && /cats \? ' Cruzar com nosso estoque' : ' Buscar os itens agora'/.test(LIMPO)); n++;
ok(n + '. ...e a lista vazia do detalhe nao afirma que o edital nao tem itens',
  /Não há itens lidos para este edital/.test(L)
  && /eles podem estar só dentro do arquivo do edital/.test(L)
  && /function recarregarItensDetalhe/.test(LIMPO)); n++;
// "abrir no PNCP" desceu pra "mais acoes" nos DOIS paineis que o tinham como acao de linha
ok(n + '. *** "abrir no PNCP" desceu pra "mais acoes" tambem no painel ao vivo ***',
  !/class="acoes"><a class="btn sec mini" href='\+alvo/.test(LIMPO)
  && /aria-haspopup="true">⋯ mais ações<\/button><span class="cx">'[\s\S]{0,600}?Abrir no PNCP/.test(LIMPO)); n++;

// ── 3. AS DUAS FORMAS DO `bruto`, TRADUZIDAS NUMA PORTA SO ───────────────────
ok(n + '. o tradutor existe e reconhece as duas formas',
  /function normalizaBruto\(b\)/.test(LIMPO)
  && /if\(b\.objetoCompra != null \|\| b\.orgaoEntidade\) return b;/.test(LIMPO)
  && /if\(b\.numero_controle_pncp == null\) return b;/.test(LIMPO)); n++;
/* AS TRES PORTAS DE LEITURA DO INDICE passam pelo tradutor. Este assert e o que impede a
   QUARTA porta de nascer sem ele — que e como as 400 linhas voltariam a ser mudas. */
ok(n + '. *** as TRES portas de leitura do indice traduzem (a quarta sem tradutor volta a mentir) ***',
  (LIMPO.match(/normalizaBruto\(x\.bruto\)/g) || []).length === 3
  && (LIMPO.match(/x => x\.bruto\)\.filter/g) || []).length === 0); n++;
ok(n + '. ...e o painel ao vivo usa O MESMO tradutor (a resposta da busca e a mesma forma)',
  /function licDoVivo\(k\)\{[\s\S]{0,180}?normalizaBruto\(i\)/.test(LIMPO)); n++;

// ── 4. O QUE A FONTE NAO MANDA NAO VIRA ZERO ─────────────────────────────────
ok(n + '. *** valor que nao veio nao e "R$ 0" — e "nao informado" ***',
  /function celValor\(v\)/.test(LIMPO)
  && /celValor\(l\.valorTotalEstimado\)/.test(LIMPO)
  && !/<small>Valor estimado<\/small><span>'\+brl\(l\.valorTotalEstimado\)/.test(LIMPO)); n++;
ok(n + '. ...e "abertura em —" virou "abertura nao informada", com o motivo no title',
  /abertura não informada<\/span>/.test(L)
  && /que não devolve a janela de proposta/.test(L)); n++;
ok(n + '. *** o tradutor NAO preenche prazo, valor nem SRP (o que a busca nao manda fica nulo) ***',
  (() => {
    const i = LIMPO.indexOf('function normalizaBruto(b){');
    const corpo = LIMPO.slice(i, LIMPO.indexOf('\n}', i));
    return !/dataAberturaProposta/.test(corpo) && !/dataEncerramentoProposta/.test(corpo)
      && !/valorTotalEstimado/.test(corpo) && !/srp/.test(corpo);
  })()); n++;

// ── 5. OS CHIPS DE CATEGORIA ─────────────────────────────────────────────────
/* A `categorias(objeto)` lia o OBJETO: numa base do ramo hospitalar isso pinta "Medicamentos"
   e "Material hospitalar" em quase tudo, porque o objeto padrao e "aquisicao de medicamentos e
   material medico-hospitalar". A etiqueta dizia o que o TEXTO dizia, nao o que o edital TEM. */
ok(n + '. *** o cartao NAO usa mais a categoria por palavra do objeto ***',
  !/const cats = categorias\(l\.objetoCompra\)/.test(LIMPO)
  && /const cats = categoriasDosItens\(l\)/.test(LIMPO)); n++;
ok(n + '. *** casou na CMED = medicamento; nao casou = material (fato apurado, nao palpite) ***',
  /poe\(t && t\.teto != null \? 'medicamento' : 'material'\)/.test(LIMPO)); n++;
ok(n + '. *** sem itens lidos OU sem a CMED carregada, NAO ha chip ***',
  /if\(!r \|\| !Array\.isArray\(r\.itens\) \|\| !r\.itens\.length\) return null;/.test(LIMPO)
  && /if\(!_cmedIdx\) return null;/.test(LIMPO)); n++;
ok(n + '. *** e o chip FILTRA (chip que nao filtra e enfeite) ***',
  /function filtrarPorCategoria\(cat\)/.test(LIMPO)
  && /class="etq chip/.test(LIMPO) && /\.etq\.chip\{/.test(CSS1)); n++;
/* FILTRAR NAO PODE ESCONDER CALADO. As que ainda nao foram lidas nao tem chip — e sumir com
   elas faria "3 de 40" parecer resposta sobre as 40, quando 31 nem foram olhadas. */
ok(n + '. *** e a lista filtrada CONFESSA quantas ficaram de fora por nao terem sido lidas ***',
  /let semItensNoFiltro = 0;/.test(LIMPO)
  && /fora da conta: itens ainda não lidos/.test(L)); n++;
/* O PAR DE COR DO CHIP LIGADO E O MEDIDO (verde-500 + cinza-800 = 8,96:1, o mesmo do .bdg.nova).
   E o hover NAO pode ficar com o --verde-700 do .etq: sobre --verde-200 ele da 4,06:1 e reprova
   em AA para texto pequeno — o hover apagaria a etiqueta na hora exata em que o dedo esta nela. */
ok(n + '. o chip ligado usa o par medido, e o hover nao reprova em contraste',
  /\.etq\.chip\.on\{background:var\(--verde-500\);color:var\(--cinza-800\)/.test(CSS1)
  && /\.etq\.chip:hover\{background:var\(--verde-200\);color:var\(--verde-800\)\}/.test(CSS1)); n++;

// ── 6. A ANATOMIA DO DETALHE ─────────────────────────────────────────────────
/* ══ OS SEIS ASSERTS DESTE BLOCO FICARAM VERMELHOS NA A27, E FICARAM VERMELHOS POR SEIS DIAS ══
   A A27 trocou a anatomia do detalhe (sanfona -> tabela, ficha `<small>` -> `.f-rot`, `<h4>` ->
   aba) e estes asserts continuaram procurando o markup ANTIGO. Nenhuma promessa tinha sido
   quebrada — exceto UMA, e ela só apareceu porque o assert existia: o "é a UASG no Comprasnet"
   sumiu de verdade, e sobrou um número sem ofício na tela. Está de volta.
   >>> O QUE ISSO ENSINA, E É O MOTIVO DE ESTAR ESCRITO AQUI: assert preso ao markup avisa
       "mudou", nunca "piorou" — é a mesma lição S8 que o testa_tema já pagou três vezes.
       Estes agora cobram a PROMESSA (o dado chegou à tela, com o nome certo do lado), e não o
       nome da etiqueta que o carrega. E o pior dos dois mundos era o silêncio: quatro suítes
       vermelhas em pé ensinam a equipe inteira a ignorar vermelho. */
ok(n + '. *** o codigo da unidade (a UASG) chegou a tela — e DIZ que e a UASG ***',
  /unidade '\s*\n?\s*\+ esc\(un\.codigoUnidade\)/.test(LIMPO) && /é a UASG no '/.test(L)); n++;
ok(n + '. o cabecalho traz publicacao, abertura E encerramento (as tres datas)',
  /f-rot">Publicação</.test(L) && /f-rot">Abertura da sessão</.test(L)
  && /f-rot">Encerramento</.test(L)); n++;
/* O `tetoCurto` MORREU NA A27 e foi APAGADO, com o motivo escrito no lugar dele — teto que
   ninguem chama e a semente da segunda regra de teto. O que a promessa pede continua: o teto na
   LINHA, sem abrir sanfona nenhuma. Quem faz isso agora e a COLUNA "Teto CMED" da tabela. */
ok(n + '. o teto CMED esta na LINHA do item (quem varre 300 itens nao abre 300 sanfonas)',
  /<th class="num" style="width:150px">Teto CMED<\/th>/.test(L)
  && /function detCelTeto\(t\)/.test(LIMPO) && /\+ '<td class="num">'\+detCelTeto\(t\)\+'<\/td>'/.test(LIMPO)
  && !/function tetoCurto\(/.test(LIMPO)); n++;
ok(n + '. ...e ele e a MESMA chamada do celTetoCMED (uma resposta so pro teto legal)',
  (LIMPO.match(/LimedtecTetoCMED\.avaliar\(\{/g) || []).length >= 2
  && /paraGoverno: true,\s*\n\s*\}, _cmedIdx\);/.test(LIMPO)); n++;
/* SIGILOSO NAO E TRAVESSAO. Quando o orgao nao publica o valor de referencia, a linha DIZ isso:
   "—" no lugar do numero faz a pessoa procurar um dado que ninguem escondeu por engano. */
ok(n + '. *** item sigiloso DIZ "orcamento sigiloso" na coluna da referencia, nao um travessao ***',
  /it\.orcamentoSigiloso === true/.test(LIMPO)
  && /uE\.status === 'sigiloso'/.test(LIMPO) && /">orçamento sigiloso<\/span>/.test(L)
  /* E a frase do title e a que da o ofício ao aviso: sem referencia publicada, o teto da CMED
     deixa de ser um numero a mais e passa a ser a UNICA regua legal da linha. */
  && /o teto da CMED ao lado é a única régua legal que sobra/.test(L)); n++;
ok(n + '. os tres selos de contexto existem, e o sigiloso vem do ITEM',
  /REGISTRO DE PREÇO<\/span>/.test(L) && /ORÇAMENTO SIGILOSO<\/span>/.test(L)
  && /x\.it\.orcamentoSigiloso === true/.test(LIMPO)); n++;
/* O `<h4>` saiu na A27 porque quem nomeia a secao agora e a ABA — titulo repetindo o nome da
   aba logo abaixo dela e a mesma palavra duas vezes. O que a promessa cobra sao os QUATRO
   dados: nome, tipo, tamanho e se o texto ja foi extraido. */
ok(n + '. a secao de arquivos mostra nome, tipo, tamanho e o que JA FOI extraido',
  /function secaoDocumentos\(\)/.test(LIMPO)
  && /<span class="nome">/.test(LIMPO) && /<span class="tipo">/.test(LIMPO)
  && /<span class="tam">/.test(LIMPO)
  && /texto extraído · /.test(L) && /sem texto extraído/.test(L)); n++;
ok(n + '. o resultado por item traz vencedor, quantidade, valor e a MARGEM contra o teto',
  /function secaoResultado\(l\)/.test(LIMPO) && /<th>Vencedor<\/th>/.test(L)
  && /<th>Margem<\/th>/.test(L)
  && /const d = \(uR\.valor - t\.teto\) \/ t\.teto \* 100;/.test(LIMPO)); n++;
/* A MARGEM SO SAI COM OS DOIS LADOS UNITARIOS. O preco do resultado vem na unidade do EDITAL
   ("Caixa 100 UN") e o teto da CMED e por unidade: comparar sem desembalar da erro de 100x. */
ok(n + '. *** e a margem so aparece com os dois lados unitarios (senao e erro de 100x) ***',
  /if\(_cmedIdx && uR\.status === 'ok'\)\{/.test(LIMPO)
  && /const uR = unitarioEdital\(it\);/.test(LIMPO)); n++;
ok(n + '. resultado nao lido NAO vira "ninguem ganhou"',
  /Ainda <b>não coletei o resultado<\/b>/.test(L)
  && /quer dizer que ele tenha sido deserto/.test(L)); n++;
// a busca dentro dos itens PUXA PRO TOPO em vez de filtrar
ok(n + '. *** a busca nos itens puxa o que casou pro TOPO, e nao some com o resto ***',
  /d\.itens\.filter\(casaTermo\)\.concat\(d\.itens\.filter\(x => !casaTermo\(x\)\)\)/.test(LIMPO)
  /* A frase mudou de forma na A27 e ficou melhor: ela diz que a lista continua INTEIRA nos dois
     casos — com resultado ("mostrando todos, os que casam vêm primeiro") e sem nenhum ("a lista
     continua inteira"). O caso do zero e o que mais importa: e nele que filtrar esvaziaria a
     tela e faria o edital de 300 itens parecer ter nenhum. */
  && /mostrando todos, os que casam vêm primeiro/.test(L)
  && /a lista continua inteira/.test(L)); n++;
ok(n + '. ...e o termo e grifado pela MESMA regra do objeto (um grifo so na tela)',
  /function grifaCom\(texto, termo\)/.test(LIMPO)
  && /grifaCom\(String\(it\.descricao\|\|'—'\), DET\.busca\)/.test(LIMPO)); n++;

// ── 7. O AO VIVO GRAVA NO INDICE ANTES DE AGIR ───────────────────────────────
ok(n + '. *** agir num certame do ao vivo grava a licitacao no indice primeiro ***',
  /guardarNoIndice\(l\);\s*\n\s*return abrirDetalheDe/.test(LIMPO)
  && /functions\/v1\/indexar-licitacao/.test(LIMPO)); n++;
ok(n + '. ...e quem grava e uma EDGE, porque a `licitacoes` nao aceita insert de authenticated',
  /a `licitacoes` não tem policy de INSERT para\s*\n?\s*`authenticated`/.test(L)); n++;
ok(n + '. ...e a falha da gravacao NAO derruba o detalhe (ele le do PNCP, nao do nosso indice)',
  /O detalhe abre do mesmo jeito/.test(L)); n++;

// ── 8. O DETALHE DO HISTORICO NAO ADIVINHA ───────────────────────────────────
/* A fatia A14 mediu: das 105 Atas, casar por numero+ano+orgao deu 2 "unicas" e as DUAS eram de
   municipio errado. O Calendario nao guarda numero de controle — entao o detalhe do historico
   oferece o CAMINHO (jogar o numero na busca) e nunca o palpite. */
ok(n + '. *** o detalhe do historico NAO casa automaticamente com o indice ***',
  /function abrirHistorico\(k\)/.test(LIMPO)
  && /Procurar este certame no índice/.test(L)
  && /as 4 junções ambíguas eram todas de município errado/.test(L)); n++;
ok(n + '. ...e ele diz que ali nao ha edital nem teto CMED, em vez de mostrar secao vazia',
  /Não há itens do PNCP nem teto '[\s\S]{0,60}'CMED aqui/.test(L)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
