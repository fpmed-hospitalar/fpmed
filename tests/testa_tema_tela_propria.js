// SUITE testa_tema_tela_propria — O TEMA DO CLIENTE NAO PODE INVADIR TELA DE PALETA PROPRIA.
//
// A REGRESSAO (medida no ar em 05/08, 20h25, print do Lemuel): a tela de Licitacoes — a UNICA
// escura do sistema — apareceu com fundo BRANCO, o titulo "Encontrar" branco-no-branco ilegivel
// e os paineis escuros boiando num fundo claro.
//
// CAUSA: o aplicaTema escreve as cores do cliente como STYLE INLINE no <html>, e style inline
// vence qualquer `:root{}` de folha de estilo. O `:root{--bg:#0B1622}` da tela era trocado pelo
// #F5F9FC do cliente sem nenhum aviso.
//
// POR QUE NINGUEM VIU ANTES: o defeito existia em TODAS as telas desde que o tema entrou. Nas
// claras o --bg proprio (#F4F7FA) e o do cliente (#F5F9FC) sao quase a mesma cor, entao a
// sobrescrita nao aparecia. So a tela escura tinha contraste pra denunciar. Este teste existe
// porque "esta bonito na tela" nao e prova de que a regra esta valendo.
//
// A REGRA: `data-tema` no <html> significa "esta tela e dona da propria paleta".
//
//   node tests/testa_tema_tela_propria.js
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_tema_tela_propria — tema do cliente x tela de paleta propria\n');

// ── DOM de mentira, so o que o aplicaTema toca ────────────────────────────────────────────
// Sem jsdom de proposito: a superficie usada e minuscula (setProperty, getAttribute,
// setAttribute) e uma dependencia nova pra isto seria peso sem retorno.
function fakeDoc(atributos) {
  const attrs = Object.assign({}, atributos || {});
  const escritas = {};
  return {
    documentElement: {
      style: { setProperty: (k, v) => { escritas[k] = v; } },
      getAttribute: k => (k in attrs ? attrs[k] : null),
      setAttribute: (k, v) => { attrs[k] = v; },
    },
    _escritas: escritas, _attrs: attrs,
  };
}
// carrega o molde num escopo isolado, com document e window de mentira
function carrega(doc) {
  const cfgSrc = fs.readFileSync(path.join(raiz, 'cliente.config.js'), 'utf8');
  const libSrc = fs.readFileSync(path.join(raiz, 'limedtec-config.js'), 'utf8');
  const win = {};
  new Function('window', 'document', 'module', cfgSrc + '\n' + libSrc)(win, doc, undefined);
  return win.LIMEDTEC;
}

// ══════════ 1. TELA DE PALETA PROPRIA: nenhuma cor entra ══════════
{
  const doc = fakeDoc({ 'data-tema': 'dark' });
  carrega(doc).aplicaTema();
  ok('1. *** com data-tema="dark", NENHUMA variavel de cor e escrita ***',
    Object.keys(doc._escritas).length === 0, doc._escritas);
  ok('2. ...em especial o --bg, que era o que invertia o fundo',
    doc._escritas['--bg'] === undefined, doc._escritas['--bg']);
  ok('3. ...mas o produto continua marcado (identidade nao e cor)',
    doc._attrs['data-limedtec-produto'] === 'LIMEDTEC', doc._attrs);
}

// ══════════ 2. TELA NORMAL: o tema do cliente CONTINUA valendo ══════════
// Metade indispensavel do teste. Uma correcao que simplesmente desligasse o aplicaTema
// passaria no bloco 1 e quebraria o white-label inteiro sem ninguem notar.
{
  const doc = fakeDoc({});
  carrega(doc).aplicaTema();
  ok('4. *** sem data-tema, as cores do cliente SAO escritas ***',
    Object.keys(doc._escritas).length > 0, doc._escritas);
  ok('5. --bg recebe o fundo claro da FPMED', doc._escritas['--bg'] === '#F5F9FC', doc._escritas['--bg']);
  ok('6. --ciano recebe o azul da marca', doc._escritas['--ciano'] === '#2CA9E0', doc._escritas['--ciano']);
  ok('7. --ciano2 recebe o verde', doc._escritas['--ciano2'] === '#8DC63F', doc._escritas['--ciano2']);
  ok('8. --txt recebe o navy', doc._escritas['--txt'] === '#173A5E', doc._escritas['--txt']);
  ok('9. e o produto tambem e marcado', doc._attrs['data-limedtec-produto'] === 'LIMEDTEC');
}

// ══════════ 3. QUALQUER valor em data-tema conta como "tela manda" ══════════
// A marcacao e um sinal de posse, nao um enum de temas: o dia em que alguem escrever
// data-tema="sepia" numa tela, o aplicaTema tem que sair do caminho do mesmo jeito.
{
  const doc = fakeDoc({ 'data-tema': 'sepia' });
  carrega(doc).aplicaTema();
  ok('10. data-tema="sepia" tambem bloqueia a sobrescrita', Object.keys(doc._escritas).length === 0, doc._escritas);
}
{
  const doc = fakeDoc({ 'data-tema': '' });
  carrega(doc).aplicaTema();
  ok('11. data-tema VAZIO nao conta (atributo em branco e descuido, nao decisao)',
    Object.keys(doc._escritas).length > 0, doc._escritas);
}

// ══════════ 4. A MARCACAO ESTA NA TELA CERTA ══════════
{
  const lic = fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8');
  ok('12. *** o fpmed_licitacoes.html marca data-tema="dark" no <html> ***',
    /<html[^>]*\sdata-tema="dark"/.test(lic));
  ok('13. ...e continua declarando a paleta escura propria',
    /--bg:\s*#0B1622/i.test(lic) && /--painel:\s*#132234/i.test(lic), null);
  ok('14. ...com o azul e o verde da FPMED (nao as cores da instalacao de origem)',
    /--azul:\s*#2CA9E0/i.test(lic) && /--verde:\s*#8DC63F/i.test(lic));
  // a correcao NAO pode ter sido feita na base do !important
  const cssLic = lic.slice(lic.indexOf('<style>'), lic.indexOf('</style>'));
  ok('15. e nao foi resolvido com !important na variavel (isso so adiaria a proxima colisao)',
    !/--bg\s*:[^;]*!important/i.test(cssLic));
}

// ══════════ 5. AS TELAS CLARAS NAO GANHARAM data-tema por engano ══════════
// Se alguem marcasse uma tela clara como "tema proprio", ela pararia de receber a marca do
// cliente e o white-label silenciosamente deixaria de funcionar naquela tela.
{
  const claras = ['fpmed_sistema_final.html', 'fpmed_giovana.html', 'fpmed_vendas.html',
                  'fpmed_viabilidade.html', 'fpmed_painel.html', 'fpmed_competitividade.html',
                  'dashboard_clientes.html', 'index.html'];
  const marcadas = claras.filter(a => /<html[^>]*\sdata-tema=/.test(fs.readFileSync(path.join(raiz, a), 'utf8')));
  ok('16. nenhuma tela CLARA se declarou dona do tema (elas seguem o cliente)',
    marcadas.length === 0, marcadas);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
