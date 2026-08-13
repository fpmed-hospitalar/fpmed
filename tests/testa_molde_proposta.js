// SUITE testa_molde_proposta - a Proposta (fpmed_giovana.html) entrando no design system.
// Item 8b, fatias 1 (a paleta) e 2 (a moldura).
//
// == POR QUE O CORACAO DESTA SUITE E UMA MEDICAO, E NAO UMA COMPARACAO DE TEXTO ==========
// Esta e a tela em que o PRECO E DECIDIDO e a proposta sai para o hospital. Antes desta
// fatia ela tinha paleta propria, e a medicao achou **12 dos 17 pares reprovando em AA** -
// incluindo o rotulo de TODO o formulario (3,05:1), o placeholder de todo campo (2,07:1) e
// o botao primario (2,67:1).
//
// Um assert que comparasse strings ("o CSS diz var(--azul-600)") ficaria verde no dia em que
// alguem clareasse o --azul-600 no tema. Entao esta suite RESOLVE os apelidos ate o valor
// final, no arquivo do tema, e roda a formula da WCAG nos pares que a tela USA DE VERDADE.
// Se um token afundar la, o vermelho acende aqui.
//
// A formula e a mesma da testa_tema - uma regua so pro projeto. Duas copias da mesma conta
// e o jeito classico de uma envelhecer calada.
//
//   node tests/testa_molde_proposta.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const R = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');
const G = R('fpmed_giovana.html');
const TEMA = R('fpmed_tema.css');
/* O bloco de estilo, e SO ele. `split('</style>')[0]` traria o <head> inteiro junto - com o
   favicon em data-URI e os <link> - e foi exatamente o que fez o assert de "cor chumbada"
   acusar um `#fff` que estava no ICONE, nao no CSS. Fatiar por marcador de abertura E de
   fechamento e a diferenca entre medir o CSS e medir o arquivo. */
const CSS = (G.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
// o bloco do DOCUMENTO DE IMPRESSAO e excecao declarada: ele e papel, nao tela
const CSS_TELA = CSS.split('/* DOCUMENTO DE IMPRESSÃO */')[0];
const CSS_PRINT = (CSS.split('/* DOCUMENTO DE IMPRESSÃO */')[1] || '');
const semCom = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const TELA_LIMPA = semCom(CSS_TELA);
const CSS1 = G.replace(/\s*\n\s*/g, '');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_molde_proposta - a Proposta no design system (item 8b, fatias 1 e 2)\n');

// ── 0. a regua: token -> valor, e a formula da WCAG ──────────────────────────
const tokenDoTema = nome => {
  const m = TEMA.match(new RegExp('--' + nome + ':\\s*(#[0-9a-fA-F]{3,8})'));
  return m ? m[1] : null;
};
/* Resolve um apelido da tela ate o HEX final: --verde -> var(--azul-600) -> #1576a5.
   E de proposito que ele NAO aceita valor literal no apelido: se alguem escrever
   `--verde:#2CA9E0` de novo, isto devolve null e os asserts de contraste caem. */
const resolve = apelido => {
  const m = TELA_LIMPA.match(new RegExp('--' + apelido + ':\\s*var\\(--([a-z0-9-]+)\\)'));
  return m ? tokenDoTema(m[1]) : null;
};
const lum = hex => {
  const h = hex.replace('#', '');
  const hh = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const c = [0, 2, 4].map(i => {
    const v = parseInt(hh.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, o) => o - m);
  return (x + 0.05) / (y + 0.05);
};

// ── 1. a tela entrou no sistema ──────────────────────────────────────────────
ok(n + '. a tela carrega o fpmed_tema.css', /<link rel="stylesheet" href="fpmed_tema\.css">/.test(G)); n++;
/* A ORDEM IMPORTA: o tema tem que vir ANTES do <style> da tela, senao os apelidos apontam
   pra tokens que ainda nao existem e cada um deles resolve pra vazio - a tela abriria sem
   cor nenhuma. E o defeito apareceria so no navegador, nunca num diff. */
/* *** INSTRUMENTO TORTO, PEGO NA PRIMEIRA RODADA. *** Este assert media a posicao do primeiro
   `<style>` do ARQUIVO - e o primeiro estava dentro do COMENTARIO que explica esta mesma regra
   ("ele vem ANTES do <style> de proposito"). Ou seja: o assert reprovava a tela por causa da
   propria anotacao que a descreve. E a mesma familia de defeito que este projeto ja nomeou duas
   vezes (S9/S10): a mutacao que trocava o comentario em vez do codigo.
   >>> Mede-se no arquivo SEM COMENTARIO. */
const G_SEM_COM = G.replace(/<!--[\s\S]*?-->/g, '');
ok(n + '. ...e ele vem ANTES do <style> da tela (senao os apelidos apontam pro nada)',
  G_SEM_COM.indexOf('href="fpmed_tema.css"') > 0
  && G_SEM_COM.indexOf('href="fpmed_tema.css"') < G_SEM_COM.indexOf('<style>')); n++;

// ── 2. NENHUM APELIDO TEM VALOR PROPRIO ──────────────────────────────────────
/* Esta e a promessa que faz a camada de traducao ser traducao, e nao uma SEGUNDA PALETA.
   No dia em que um apelido voltar a ter hex proprio, a tela passa a ter duas fontes de cor
   e uma delas vai envelhecer calada. */
const APELIDOS = ['verde', 'verde-escuro', 'verde-claro', 'bg', 'texto', 'muted', 'borda',
                  'vermelho', 'navy', 'fverde', 'card', 'sombra'];
/* NAO use `--x:\s*(?!var\()` aqui: o `\s*` retrocede e o lookahead passa sempre que houver
   mais de um espaco depois dos dois-pontos. A primeira versao deste assert acusou os DOZE
   apelidos de terem valor proprio quando nenhum tinha. Le-se o valor e testa-se o valor. */
const valorDoApelido = a => {
  const m = TELA_LIMPA.match(new RegExp('--' + a + ':\\s*([^;]+);'));
  return m ? m[1].trim() : null;
};
const comValorProprio = APELIDOS.filter(a => {
  const v = valorDoApelido(a);
  return v === null || !/^var\(--[a-z0-9-]+\)$/.test(v);
}).map(a => a + ' = ' + valorDoApelido(a));
ok(n + '. *** nenhum apelido do legado tem valor proprio - todos apontam pra token ***',
  comValorProprio.length === 0, comValorProprio); n++;
/* Os apelidos NAO PODEM SUMIR, e isso foi medido: 133 usos deles vivem FORA da folha de
   estilo, dentro de HTML gerado pelo script, onde nenhuma varredura de CSS enxerga. Apagar
   os nomes deixaria esses pedacos sem cor, e o defeito so apareceria no dia em que alguem
   abrisse aquele trecho. */
const fora = G.split('</style>').slice(1).join('</style>');
const usosFora = APELIDOS.reduce((s, a) => s + (fora.match(new RegExp('var\\(--' + a + '[,)]', 'g')) || []).length, 0);
ok(n + '. ...e eles continuam existindo, porque o script os usa fora do CSS (>100 usos)',
  usosFora > 100, { usosForaDoCss: usosFora }); n++;

// ── 3. O MAPA E POR OFICIO, E ESSA E A DECISAO DA FATIA ──────────────────────
/* `--verde` (que apesar do nome sempre foi o AZUL da marca) e usado nos TRES oficios que a
   rampa do tema separa: fundo que carrega texto branco, borda/acento, e TEXTO azul. Um
   apelido so nao pode virar tres tokens - entao ele vira o degrau que passa em AA nos tres.
   >>> O ASSERT EXISTE PRA QUE "aproximar mais da marca" nao signifique um dia trocar o 600
       pelo 500 aqui - que e a coisa mais natural do mundo pra quem esta olhando a tela e nao
       mediu. O 500 e a marca; ele nao carrega texto branco (2,67:1). */
ok(n + '. *** o --verde aponta pro azul-600 (a cor da ACAO), e nao pro 500 da marca ***',
  /--verde:\s*var\(--azul-600\)/.test(TELA_LIMPA)
  && !/--verde:\s*var\(--azul-500\)/.test(TELA_LIMPA)); n++;
ok(n + '. o --verde-escuro aponta pro azul-700 (texto azul e hover), o oficio dele no tema',
  /--verde-escuro:\s*var\(--azul-700\)/.test(TELA_LIMPA)); n++;
/* O #1B8DC4 e a licao S12 LITERAL - o azul de acao que "parecia bonito" e media 3,71:1. O
   tema o aposentou uma vez; aqui ele tinha sobrevivido porque a tela tinha paleta propria. */
ok(n + '. *** e o #1B8DC4 da licao S12 nao existe mais no CSS de tela ***',
  !/#1[bB]8[dD]{1}[cC]4/.test(TELA_LIMPA)); n++;
ok(n + '. o --muted subiu pro cinza-600 (era 3,05:1 como rotulo de formulario)',
  /--muted:\s*var\(--cinza-600\)/.test(TELA_LIMPA)); n++;

// ── 4. *** AA MEDIDO NOS PARES QUE A TELA USA DE VERDADE *** ─────────────────
const C = {};
for (const a of APELIDOS) C[a] = resolve(a);
C.branco = tokenDoTema('branco');
C.placeholder = tokenDoTema('cinza-500');
ok(n + '. todos os apelidos de cor resolvem ate um valor do tema',
  APELIDOS.filter(a => a !== 'sombra').every(a => !!C[a]),
  APELIDOS.filter(a => a !== 'sombra' && !C[a])); n++;

const PARES = [
  [C.texto, C.bg, 'texto principal sobre a pagina'],
  [C.texto, C.card, 'texto principal dentro do cartao'],
  [C.muted, C.card, 'ROTULO do formulario e detalhe do item'],
  [C.muted, C.bg, 'texto de apoio sobre a pagina'],
  [C.placeholder, C.card, 'placeholder do campo'],
  [C.navy, C.card, 'titulo do cartao e o preco do item'],
  [C.branco, C.verde, 'BOTAO PRIMARIO: branco sobre a cor da acao'],
  [C.branco, C['verde-escuro'], 'botao primario no hover'],
  [C.branco, C.navy, 'branco sobre o navy (toast)'],
  [C['verde-escuro'], C['verde-claro'], 'selo: texto sobre o azul palido'],
  [C.vermelho, C.card, 'vermelho de erro sobre cartao'],
  [C.verde, C.card, 'TEXTO azul (aba ativa, link) sobre cartao'],
  [C.verde, C.bg, 'TEXTO azul sobre a pagina'],
  [C.muted, C['verde-claro'], 'selo do teto "ok"'],
];
const reprovados = [];
for (const [a, b, onde] of PARES) {
  if (!a || !b) { reprovados.push(onde + ' (nao resolveu)'); continue; }
  const r = contraste(a, b);
  if (r < 4.5) reprovados.push(onde + ' = ' + r.toFixed(2) + ':1');
}
ok(n + '. *** OS ' + PARES.length + ' PARES QUE A TELA USA PASSAM EM AA (4,5:1) ***',
  reprovados.length === 0, reprovados); n++;
/* O par que o tema PROIBE, e que esta tela nao usa: branco sobre o verde da marca da 2,04:1.
   O assert existe pelo avesso - ele barra o dia em que alguem pintar um botao de verde com
   letra branca aqui "porque o verde e da marca". */
const brancoNoVerde = contraste(C.branco, C.fverde);
ok(n + '. o verde da marca continua sem carregar texto branco (o tema proibe, ' + brancoNoVerde.toFixed(2) + ':1)',
  brancoNoVerde < 4.5
  && !/background:\s*var\(--fverde\)[^}]*color:\s*var\(--branco\)/.test(TELA_LIMPA)); n++;

// ── 4b. *** A COLISAO COM O TEMA WHITE-LABEL, MEDIDA DOS DOIS LADOS *** ──────
/* ACHADO NO NAVEGADOR, e a suite estatica nao podia ver sozinha: `--bg` e `--borda` NAO sao
   so nossos. O `aplicaTema` (limedtec-config.js) escreve os nomes CRUS `--bg`, `--panel`,
   `--txt` e `--borda` direto no `documentElement.style` - estilo em linha, que ganha de
   qualquer `:root`. Para esses dois, o token e o PADRAO e a cor do cliente SOBREPOE (ele so
   escreve `if (c[k])`). Isso e o white-label funcionando.
   >>> ENTAO MEDIR SO O TOKEN SERIA MEDIR A METADE QUE NAO APARECE. Os pares que caem sobre o
       fundo da pagina sao medidos NOS DOIS CAMINHOS - com o token e com a cor que este cliente
       configurou. Se um dia alguem escurecer o `bg` do cliente, o vermelho acende aqui. */
const CFG = R('cliente.config.js');
const CRUAS = R('limedtec-config.js').match(/var CORES_CRUAS = \{([\s\S]*?)\}/);
ok(n + '. o arquivo registra que --bg e --borda colidem com o tema white-label',
  /o token abaixo é o \*\*padrão\*\*, e a cor do cliente \*\*sobrepõe\*\*/.test(G.replace(/\s+/g, ' '))); n++;
ok(n + '. ...e a colisao e real: o tema escreve mesmo esses dois nomes crus',
  !!CRUAS && /bg:\s*'--bg'/.test(CRUAS[1]) && /borda:\s*'--borda'/.test(CRUAS[1])); n++;
const bgCliente = (CFG.match(/\bbg:\s*'(#[0-9a-fA-F]{3,8})'/) || [])[1];
ok(n + '. e o cliente define mesmo um bg proprio (senao nao ha o que medir do outro lado)',
  !!bgCliente, { bgDoCliente: bgCliente }); n++;
/* Os tres pares que caem sobre o FUNDO DA PAGINA, medidos com a cor que o cliente configurou -
   que e a que o operador da FPMED enxerga de verdade. */
const SOBRE_A_PAGINA = [
  [C.texto, 'texto principal'],
  [C.muted, 'texto de apoio'],
  [C.verde, 'texto azul (link, aba ativa)'],
];
const ruinsNoCliente = bgCliente
  ? SOBRE_A_PAGINA.filter(([t]) => contraste(t, bgCliente) < 4.5)
      .map(([t, o]) => o + ' = ' + contraste(t, bgCliente).toFixed(2) + ':1')
  : ['sem bg do cliente'];
ok(n + '. *** e os pares passam em AA TAMBEM sobre o fundo que o cliente configurou ***',
  ruinsNoCliente.length === 0, ruinsNoCliente); n++;

// ── 5. o CSS DE TELA nao tem mais cor chumbada ───────────────────────────────
const hexTela = [...new Set(TELA_LIMPA.match(/#[0-9a-fA-F]{3,6}\b/g) || [])];
ok(n + '. nao sobrou cor chumbada no CSS de tela', hexTela.length === 0, hexTela); n++;
const rgbaTela = [...new Set(TELA_LIMPA.match(/rgba?\([^)]+\)/g) || [])];
ok(n + '. nem rgb()/rgba() chumbado', rgbaTela.length === 0, rgbaTela); n++;

// ── 6. *** O DOCUMENTO IMPRESSO FICOU DE FORA, E ISSO E DECISAO *** ──────────
/* O `.print-doc` e o documento que o HOSPITAL RECEBE. Ele nao e tela: e papel, com outra
   restricao (tinta, contraste no impresso) e com valor comercial - trocar o navy do
   cabecalho muda o documento que sai assinado. Isso e decisao de NEGOCIO, nao de design
   system, e esta anotada pro checkpoint.
   >>> O ASSERT E PELO AVESSO: ele guarda que o bloco continua INTOCADO. Sem ele, a proxima
       passagem "terminaria o trabalho" tokenizando o papel junto - sem ninguem decidir. */
ok(n + '. *** o bloco do documento impresso NAO foi tokenizado (decisao declarada) ***',
  CSS_PRINT.length > 0 && !/var\(--/.test(semCom(CSS_PRINT))); n++;
ok(n + '. ...e ele continua com as cores da marca que o papel usa hoje',
  /#173A5E/.test(CSS_PRINT) && /#1E2A36/.test(CSS_PRINT)); n++;
ok(n + '. e o arquivo registra por que o papel ficou de fora',
  /Ele não é tela: é papel/.test(G.replace(/\s+/g, ' '))); n++;

// ── 7. o que a fatia NAO pode ter quebrado ───────────────────────────────────
/* O selo do teto some na impressao - a suite testa_teto_na_proposta cobra a linha inteira.
   Repito o assert aqui porque a fatia MEXEU nesse seletor: quem muda a regra tem que ver o
   vermelho na propria suite, e nao so na do vizinho. */
ok(n + '. o selo do teto continua sumindo na impressao',
  /@media print\{ \.teto-badge\{display:none !important\} \}/.test(G)); n++;
ok(n + '. e o selo "acima" usa o par fechado do tema (tinta 700 sobre fundo 50)',
  /\.teto-badge\.acima\{background:var\(--vermelho-50\);color:var\(--vermelho-700\)/.test(CSS1)); n++;

// ══════════════════════════════════════════════════════════════════════════════
// FATIA 2 — A MOLDURA
// ══════════════════════════════════════════════════════════════════════════════
const LIMPO = G.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const NEG = R('fpmed_negocios.html').replace(/\s*\n\s*/g, '');
const ENC = R('fpmed_licitacoes.html').replace(/\s*\n\s*/g, '');
const MENU = R('limedtec-menu.js');

// ── 8. as duas faixas velhas morreram, e o que elas carregavam sobreviveu ────
ok(n + '. a topfaixa e a top-bar nao existem mais (nem no CSS, nem na marcacao)',
  !/class="topfaixa"|class="top-bar"/.test(LIMPO)
  && !/^\.topfaixa\{/m.test(CSS) && !/^\.top-bar\{/m.test(CSS)); n++;
ok(n + '. *** A PORTA DE SAIDA CONTINUA: a trilha leva ao sistema comercial ***',
  /<nav class="trilha"[\s\S]{0,400}?href="fpmed_sistema_final\.html"/.test(LIMPO)); n++;
ok(n + '. ...e a trilha diz FERRAMENTAS, que e o grupo do modulo no menu lateral',
  /<nav class="trilha"[\s\S]{0,600}?>Ferramentas</.test(LIMPO)
  && /<nav class="trilha"[\s\S]{0,900}?aria-current="page">Proposta</.test(LIMPO)); n++;
/* Se alguem renomear o grupo la e esquecer aqui, a trilha passa a apontar pra uma gaveta que
   nao existe - e trilha errada e pior que trilha nenhuma, porque ela ENSINA o mapa. */
ok(n + '. ...e esse grupo existe mesmo no menu (a trilha nao inventa taxonomia)',
  /\{ g: 'Ferramentas' \}/.test(MENU)
  && /id: 'proposta'[\s\S]{0,120}?fpmed_giovana\.html/.test(MENU)); n++;
ok(n + '. o menu lateral e carregado (sem ele a tela vira beco)',
  /<script src="limedtec-menu\.js"><\/script>/.test(LIMPO)
  && /<div data-limedtec-menu><\/div>/.test(LIMPO)); n++;
ok(n + '. o gancho do PWA vive na FAIXA INTERNA, na regua do conteudo',
  /<div class="faixa-int" data-limedtec-instalar>/.test(LIMPO)); n++;

// ── 9. a moldura e A MESMA das outras duas, e nao uma parecida ───────────────
/* Tres telas do mesmo sistema com tres vocabularios produzem o desalinhamento que o olho
   percebe e ninguem consegue nomear. O assert cobra as TRES pontas de cada classe: a regra
   existe AQUI, existe LA (nas duas), e a marcacao usa o nome. */
for (const cls of ['topo', 'trilha', 'pagina-topo', 'faixa-int']) {
  const aqui = new RegExp('\\.' + cls + '\\{').test(CSS1);
  const laNeg = new RegExp('\\.' + cls + '\\{').test(NEG);
  const laEnc = new RegExp('\\.' + cls + '\\{').test(ENC);
  const usada = new RegExp('class="' + cls + '"').test(LIMPO);
  ok(n + '. a classe .' + cls + ' e a MESMA das tres telas (vocabulario unico)',
    aqui && laNeg && laEnc && usada, { aqui, negocios: laNeg, encontrar: laEnc, usada }); n++;
}
ok(n + '. e a altura do header e a mesma das tres (52px de min-height)',
  /\.topo \.faixa-int\{[^}]*min-height:52px/.test(CSS1)
  && /\.topo \.faixa-int\{[^}]*min-height:52px/.test(NEG)); n++;
ok(n + '. o header e sticky',
  /\.topo\{[^}]*position:sticky/.test(CSS1)); n++;

// ── 10. *** A TRILHA NAO PODE SER ESPREMIDA A ZERO *** ──────────────────────
/* MEDIDO NO NAVEGADOR NESTA FATIA: com `flex-wrap:nowrap` (que e o que as outras duas telas
   usam acima de 900px) a trilha chega a LARGURA ZERO aqui. La sobra espaco - a regua e de
   1420px e a faixa carrega so a trilha e o sino. AQUI a regua e de 800px (e a coluna do
   formulario) e a faixa carrega tambem o n do orcamento, dois botoes e o selo do banco; com
   `nowrap`, quem e espremido primeiro e a trilha, porque e a unica peca com `min-width:0`.
   >>> A PORTA DE SAIDA DESAPARECENDO E O "BECO" QUE A ORDEM DO DONO PROIBE. Entao a faixa
       quebra em duas linhas quando falta espaco, e a trilha nao encolhe nunca. */
ok(n + '. *** a trilha nao encolhe: a porta de saida nao pode ser espremida a zero ***',
  /\.trilha\{flex:0 0 auto\}/.test(CSS1)); n++;
ok(n + '. ...e o header desta tela NAO forca nowrap (foi por ele que a trilha zerou)',
  !/@media\(min-width:901px\)\{\.topo \.faixa-int\{[^}]*flex-wrap:nowrap/.test(CSS1)); n++;
ok(n + '. o arquivo registra por que esta moldura diverge das outras duas aqui',
  /AQUI NÃO SOBRA/.test(G.replace(/\s+/g, ' '))); n++;

// ── 11. a reserva do gm-auth veio COM a funcao que a preenche ────────────────
/* OUTRO DEFEITO QUE SO A MEDICAO NO NAVEGADOR PEGOU: eu portei o CSS da reserva e esqueci a
   funcao que a calcula. O `var(--reserva-auth, 0px)` caia sempre no valor de emergencia, e a
   regra PARECIA de pe enquanto nao reservava nada. */
ok(n + '. *** a reserva do gm-auth tem quem a preencha (CSS sem a funcao nao reserva nada) ***',
  /padding-right:calc\(var\(--esp-4\) \+ var\(--reserva-auth, 0px\)\)/.test(CSS1)
  && /function reservaAuth\(\)\{/.test(LIMPO)
  && /setProperty\('--reserva-auth'/.test(LIMPO)); n++;
ok(n + '. e a largura dela e MEDIDA da etiqueta, nao chutada em px',
  /getElementById\('gm-auth-bar'\)[\s\S]{0,200}?getBoundingClientRect\(\)\.width/.test(LIMPO)); n++;
ok(n + '. ...e ela e recalculada quando a janela muda de tamanho',
  /addEventListener\('resize', reservaAuth\)/.test(LIMPO)); n++;

// ── 12. *** A REGRA MAIS PERIGOSA: A IMPRESSAO *** ──────────────────────────
/* E por esta impressao que sai o PDF da proposta que vai pro hospital. A lista do @media print
   e uma lista branca as avessas: ela NOMEIA o que some. Toda peca de moldura que entra na tela
   tem de entrar ali junto, no MESMO commit - senao aparece no documento. */
/* *** MAIS UM INSTRUMENTO TORTO, PEGO NA PRIMEIRA RODADA. *** A primeira versao era
   `@media print\{([\s\S]*?)\n\}` - e ela casava com o PRIMEIRO `@media print` do arquivo (o
   de uma linha so, do selo do teto) e corria ate a proxima quebra com chave, engolindo umas
   duzentas linhas de CSS. Os asserts passavam POR ACIDENTE, porque o texto engolido continha o
   bloco certo mais adiante.
   >>> Le-se com CHAVES BALANCEADAS, e escolhe-se o bloco pelo que ele CONTEM (o `.print-doc`),
       e nao pela ordem em que aparece. Assert que passa por acidente e pior que assert que
       falta: ele compra confianca sem entregar nada. */
const blocoBalanceado = (txt, marcador) => {
  let i = -1;
  while ((i = txt.indexOf(marcador, i + 1)) !== -1) {
    let j = txt.indexOf('{', i), nivel = 0, k = j;
    for (; k < txt.length; k++) {
      if (txt[k] === '{') nivel++;
      else if (txt[k] === '}') { nivel--; if (!nivel) break; }
    }
    const corpo = txt.slice(j + 1, k);
    if (corpo.includes('.print-doc')) return corpo;
  }
  return '';
};
const PRINT = blocoBalanceado(CSS, '@media print');
ok(n + '. *** a impressao esconde o header novo ***', /\.topo/.test(PRINT)); n++;
/* O menu e `position:fixed` e NAO TEM @media print proprio (conferido no arquivo, nao suposto):
   sem esta linha a barra lateral inteira sairia impressa em cima da proposta. */
ok(n + '. *** e esconde o MENU, que nao se esconde sozinho ***',
  /#limedtec-menu/.test(PRINT) && /\[data-limedtec-menu\]/.test(PRINT)); n++;
ok(n + '. ...e a premissa e verdadeira: o limedtec-menu.js nao tem @media print nenhum',
  !/@media\s+print/.test(MENU)); n++;
/* A margem que abre espaco pro menu na tela empurraria o documento inteiro pra direita no papel. */
ok(n + '. e a margem do menu e zerada no papel',
  /margin-left:0\s*!important/.test(PRINT)); n++;
ok(n + '. o documento continua sendo o unico a aparecer na impressao',
  /\.print-doc\{display:block!important;?\}/.test(PRINT.replace(/\s/g, ''))
  && /\.main-wrap\{display:none!important;?\}/.test(PRINT.replace(/\s/g, ''))); n++;
ok(n + '. e o arquivo registra por que o menu precisou entrar na lista',
  /O MENU NÃO SE ESCONDE SOZINHO/.test(G.replace(/\s+/g, ' '))); n++;

// ══════════════════════════════════════════════════════════════════════════════
// FATIA 3a — O SPRITE ÚNICO
// ══════════════════════════════════════════════════════════════════════════════
const ICONES = R('fpmed_icones.js');

ok(n + '. a tela carrega o sprite da FONTE UNICA', /<script src="fpmed_icones\.js"><\/script>/.test(LIMPO)); n++;
/* Copiar os simbolos pra ca criaria a TERCEIRA copia do mesmo desenho - que e exatamente a
   doenca que o fpmed_icones.js existe pra curar (o selo do orgao ja tinha divergido meio pixel
   entre duas telas antes de ele nascer). */
ok(n + '. ...e NAO copiou o sprite pra dentro (nada de <symbol> inline)',
  !/<symbol\s/.test(LIMPO)); n++;
ok(n + '. a regra .ic e a MESMA das outras telas (24x24, traco 1.8, currentColor, tamanho em em)',
  /\.ic\{[^}]*stroke:currentColor/.test(CSS1)
  && /\.ic\{[^}]*stroke-width:1\.8/.test(CSS1)
  && /\.ic\{width:1em;height:1em/.test(CSS1)
  && /\.ic\{width:1em;height:1em/.test(NEG)); n++;

/* *** O ASSERT QUE PEGA ICONE INVISIVEL. *** `<use href="#ic-xis">` apontando pra um simbolo
   que nao existe nao da erro nenhum: o navegador desenha NADA, em silencio. E o defeito mais
   caro de perseguir, porque a tela nao reclama - ela so fica sem o desenho. */
const usados = [...new Set((LIMPO.match(/<use href="#(ic-[a-z0-9-]+)"/g) || [])
  .map(x => x.replace(/<use href="#/, '').replace(/"/, '')))];
const noSprite = new Set((ICONES.match(/'(ic-[a-z0-9-]+)':/g) || []).map(x => x.slice(1, -2)));
const orfaos = usados.filter(i => !noSprite.has(i));
ok(n + '. *** todo <use> aponta pra um simbolo que EXISTE (icone orfao nao da erro, so some) ***',
  usados.length > 0 && orfaos.length === 0, { usados: usados.length, orfaos }); n++;

/* ══ O QUE **NAO** VIRA ICONE, E OS TRES MOTIVOS SAO DIFERENTES ═══════════════════════════════
   1. SETAS TIPOGRAFICAS (U+2190..U+21FF) ficam. Fronteira declarada do projeto desde o sprite
      do Negocios e reafirmada no item 7f: seta dentro de texto corrido nao e icone. Um assert
      que proibisse TUDO obrigaria a trocar as 28 por SVG e deixaria a tela pior. */
/* O assert nasceu como "existe pelo menos UMA seta" - e uma mutacao que trocou TODAS as `→` por
   SVG passou verde, porque sobravam `←`, `↑` e `↓`. A fronteira nao e "uma seta": e o conjunto
   delas. Entao cobra-se o PAR: as setas continuam existindo em quantidade, E ninguem comecou a
   desenhar seta com o sprite nesta tela (que e como o zelo entraria). */
const SETAS = (G.match(/[\u{2190}-\u{21FF}]/gu) || []).length;
ok(n + '. *** as setas tipograficas FICAM (fronteira declarada, nao esquecimento) ***',
  SETAS >= 20 && !/<use href="#ic-seta"/.test(G), { setas: SETAS }); n++;
/* 2. O TEXTO QUE VAI PRO PAPEL. O `OBS_PADRAO` e escrito no `#print-obs-padrao`, ou seja, ele
      entra no DOCUMENTO IMPRESSO - e o documento esta CONGELADO por ordem do dono (13/08):
      "ele e peca formal que vai pro orgao publico, e mudanca nele exige aval do cliente".
      O assert e pelo avesso: ele guarda que o glifo continua la. */
ok(n + '. *** o aviso que vai pro PAPEL continua intocado (documento congelado, ordem do dono) ***',
  /var OBS_PADRAO = '⚠ OBSERVAÇÕES:/.test(G)); n++;
/* 3. E A ARMADILHA QUE QUASE ME PEGOU: `toast()` e varios botoes usam `textContent`. Enfiar um
      `<svg>` numa dessas strings faria a MARCACAO SER IMPRESSA COMO TEXTO na cara do usuario.
      Onde o destino e textContent, o glifo ou fica ou sai - virar icone, nunca. */
const textContentComSvg = (G.match(/textContent\s*=\s*[^;\n]*<svg/g) || []);
ok(n + '. *** ninguem enfiou <svg> numa string de textContent (viraria texto na tela) ***',
  textContentComSvg.length === 0, textContentComSvg.slice(0, 3)); n++;
/* ══ E O OUTRO LADO DA MESMA REGRA: onde o destino e texto puro, o emoji SAIU ════════════════
   Nao da pra virar icone ali, entao a saida honesta foi deixar a frase - que ja diz o que
   aconteceu e ja tem cor propria (o `.toast.error` pinta a mensagem de erro).
   >>> O ASSERT LE AS LINHAS DE DESTINO-TEXTO e cobra que nenhuma carregue emoji. Ele nao conta
       o arquivo inteiro de proposito: a fatia 3 esta declaradamente pela metade, e contagem
       global viraria vermelha na proxima passagem sem nada ter piorado. */
const linhasDeTexto = G.split('\n').filter(l =>
  /textContent\s*=|toast\(|alert\(|confirm\(/.test(l) && !/OBS_PADRAO/.test(l));
const textoComEmoji = linhasDeTexto
  .filter(l => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(l))
  .map(l => l.trim().slice(0, 70));
ok(n + '. *** nenhuma mensagem de texto puro carrega emoji (D11 onde svg nao entra) ***',
  textoComEmoji.length === 0, textoComEmoji.slice(0, 3)); n++;
ok(n + '. e o arquivo registra por que o sprite nao foi copiado pra ca',
  /é o `fpmed_icones\.js`, a fonte única do sistema/.test(G.replace(/\s+/g, ' '))); n++;

/* ══ A PROMESSA DA FATIA, E ELA NAO E UM NUMERO ══════════════════════════════════════════════
   Assert de contagem ("sobraram 17 emoji") viraria vermelho na proxima fatia sem nada ter
   piorado - e a fatia 3 esta DECLARADAMENTE pela metade: 🤖, 💰, 🗑, 🚀 e 🔴 nao tem desenho no
   sprite ainda, e inventar um icone as pressas e pior que manter o emoji mais um dia.
   >>> ENTAO A PROMESSA E OUTRA, e ela e verificavel hoje e continua valendo depois: ONDE JA HA
       DESENHO, NAO SE USA EMOJI. Quando a 3b acrescentar os cinco simbolos ao sprite, este
       mesmo assert passa a cobrar os cinco sozinho, sem eu reescrever nada. */
/* ══ ATENCAO AO INSTRUMENTO: `LIMPO` NAO SERVE PRA ASSERT DE MARCACAO ════════════════════════
   *** ACHADO POR UMA MUTACAO QUE PASSOU VERDE. *** O `LIMPO` tira comentario de bloco com uma
   expressao nao-gulosa - e este arquivo tem abre-comentario e fecha-comentario DENTRO de
   strings e expressoes regulares do JavaScript. O stripper casa de um abre qualquer ate o
   proximo fecha e ENGOLE MARCACAO DE VERDADE no meio. Provado: um h3 com emoji reintroduzido
   por mutacao simplesmente sumia do `LIMPO`, e o assert ficava verde sem ter olhado nada.
   (E este proprio comentario ja quebrou a suite uma vez por conter o fecha-comentario literal:
    o mesmo defeito, na ferramenta que o descreve.)
   >>> Para MARCACAO usa-se `MARCACAO`, que tira so o comentario de HTML - que e o unico que
       pode conter `<h3>`. Um `<h3>` escrito dentro de comentario de JS passa a ser contado; e
       raro, e errar para o lado de reportar demais e o lado certo de errar. */
const MARCACAO = G.replace(/<!--[\s\S]*?-->/g, '');
const EQUIV = { '📄': 'ic-documento', '🔍': 'ic-lupa', '🔎': 'ic-lupa', '📝': 'ic-lapis',
                '📥': 'ic-baixar', '📦': 'ic-caixa', '❌': 'ic-x', '✕': 'ic-x',
                '🖨': 'ic-impressora', '📎': 'ic-clipe', '📤': 'ic-sai' };
const comDesenhoDisponivel = Object.keys(EQUIV).filter(e => noSprite.has(EQUIV[e]));
const h3Ruins = (MARCACAO.match(/<h3[^>]*>[^<]{0,40}/g) || [])
  .filter(h => comDesenhoDisponivel.some(e => h.includes(e)));
ok(n + '. *** nenhum <h3> usa emoji para o qual o sprite JA tem desenho ***',
  h3Ruins.length === 0, h3Ruins.slice(0, 3)); n++;
/* O `<label>` do formulario e o outro lugar de alta visibilidade: e o rotulo de cada campo. */
const labelRuins = (MARCACAO.match(/<label[^>]*>[^<]{0,40}/g) || [])
  .filter(h => comDesenhoDisponivel.some(e => h.includes(e)));
ok(n + '. ...nem os rotulos de campo (<label>)', labelRuins.length === 0, labelRuins.slice(0, 3)); n++;

// ══════════════════════════════════════════════════════════════════════════════
// O RAMO MORTO DO `c.ean` (pedido do dono, 13/08)
// ══════════════════════════════════════════════════════════════════════════════
/* Esta tela filtrava `cotacoes` por `c.ean`, e esta PROVADO que a coluna nao existe: o banco
   responde HTTP 400 - "column cotacoes.ean does not exist". O filtro devolvia sempre vazio e o
   motor caia no caminho de texto, que e o que sempre aconteceu de verdade.
   >>> O PERIGOSO ERA O COMENTARIO, nao o codigo: ele afirmava "a estreia mediu 63,1% de batida
       contra a CMED", e quem lesse concluiria que existe casamento por codigo funcionando aqui.
       Codigo morto engana pouco; codigo morto COM MEDICAO ESCRITA ao lado engana muito. */
ok(n + '. *** o ramo morto do EAN saiu dos DOIS lugares (escolha e confianca) ***',
  !/cotacoes\.filter\(c => c\.ean/.test(LIMPO)
  && !/c\.ean && String\(c\.ean\)/.test(LIMPO)
  && !/casou por EAN/.test(LIMPO)); n++;
/* Deixar UM dos dois lados de pe seria pior que deixar os dois: o motor pararia de usar o EAN
   pra ESCOLHER e continuaria a usa-lo pra se dizer CONFIANTE. */
ok(n + '. ...e nenhum `.ean` sobrou no codigo (so no comentario que explica a remocao)',
  !/\.ean\b/.test(LIMPO)); n++;
/* O VALIDADOR FICA, e e decisao declarada: ele e puro (texto -> EAN-13 valido), nao custa nada
   parado, e e a peca que se reconecta no dia em que a decisao do cadastro vier. Apaga-lo seria
   jogar fora a metade que a pergunta pendente precisa. */
/* Nao basta o NOME aparecer: a primeira versao deste assert procurava a string `_bmEanDoTexto`,
   e uma mutacao que renomeou a funcao pra `_bmEanDoTextoRemovido` passou verde - porque o nome
   novo CONTEM o antigo. Cobra-se a DECLARACAO. */
ok(n + '. o validador de EAN-13 continua no arquivo (a decisao do cadastro e do dono)',
  /function _bmEanDoTexto\s*\(/.test(G)); n++;
ok(n + '. e a remocao esta explicada, com a prova do banco junto',
  /column cotacoes\.ean does not exist/.test(G)
  && /decisão do dono, já registrada no checkpoint/.test(G.replace(/\s+/g, ' '))); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
