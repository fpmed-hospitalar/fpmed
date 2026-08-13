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

// ══════════ 4. A TELA DE LICITACOES DEIXOU DE SER A EXCECAO ══════════
// >>> ATENCAO A ESTE BLOCO: ele foi REESCRITO em 12/08, no item 4 da reforma, e a reescrita
//     precisa de justificativa porque mudar assert pra fazer a propria mudanca passar e
//     exatamente o vicio que o padrao proibe ("excecao no teste ensina a suite a aceitar o
//     errado"). A diferenca aqui: os asserts 12-14 nao guardavam uma PROPRIEDADE, guardavam uma
//     DECISAO — "esta tela e escura" — e a decisao foi revertida pelo dono, por escrito, em dois
//     documentos: a spec da reforma ("tema claro FPMED — nao copiar o dark do SIGA") e o
//     SYNC_GLOBAL ("a FPMED e tema claro por DECISAO DE MARCA. Conflito direto — descartar,
//     nao adaptar"). Assert que guarda decisao revogada nao protege nada: ele so impede a casa
//     de cumprir a propria decisao.
// >>> O QUE A SUITE CONTINUA COBRANDO E A PROPRIEDADE, e ela nao afrouxou: a tela que NAO
//     declara tema tem que receber a cor do cliente (asserts 1-11, intactos), e nenhuma tela
//     clara pode se declarar dona do tema (assert 16, que agora ALCANCA a de Licitacoes).
{
  const lic = fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8');
  ok('12. *** o fpmed_licitacoes.html NAO declara mais tema proprio (virou tela clara) ***',
    !/<html[^>]*\sdata-tema=/.test(lic), (lic.match(/<html[^>]*>/) || [])[0]);
  // e a paleta escura foi embora de verdade — nao ficou escondida atras do atributo removido
  ok('13. ...e a paleta escura sumiu do arquivo (nao so o atributo)',
    !/#0B1622/i.test(lic) && !/#132234/i.test(lic));
  ok('14. ...e ela passou a carregar o design system, que e de onde a cor sai agora',
    /<link[^>]+fpmed_tema\.css/.test(lic));
  /* NENHUMA cor chumbada sobrou: o adendo proibe cor fora dos tokens.
     ══ E ELE PASSOU A OLHAR SO O QUE PINTA (13/08, passo 5 do molde) ═══════════════════════
     Ele varria o ARQUIVO INTEIRO, comentario incluido. Ficou vermelho quando o comentario do
     botao "Buscar" registrou a medicao que justifica a fuga — "o molde usa #2CA9E0 e da
     2,67:1; o token da acao e o #1576A5, 5,04:1". Ou seja: o assert reprovava justamente a
     ANOTACAO de por que nao ha cor chumbada ali.
     >>> Um assert que so pode ficar verde se eu apagar a explicacao esta contra a lei L6
         ("o porque fica escrito"), nao a favor dela. O que ele guarda e cor que PINTA; entao
         ele passa a ler o arquivo sem comentario. Cor chumbada em CSS ou em atributo continua
         reprovando exatamente como antes. */
  const licLimpo = lic.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('15. *** e nao sobrou uma unica cor chumbada na tela ***',
    (licLimpo.match(/#[0-9a-fA-F]{3,6}\b/g) || []).length === 0,
    (licLimpo.match(/#[0-9a-fA-F]{3,6}\b/g) || []).slice(0, 6));
}

// ══════════ 5. AS TELAS CLARAS NAO GANHARAM data-tema por engano ══════════
// Se alguem marcasse uma tela clara como "tema proprio", ela pararia de receber a marca do
// cliente e o white-label silenciosamente deixaria de funcionar naquela tela.
{
  const claras = ['fpmed_sistema_final.html', 'fpmed_giovana.html', 'fpmed_vendas.html',
                  'fpmed_viabilidade.html', 'fpmed_painel.html', 'fpmed_competitividade.html',
                  'dashboard_clientes.html', 'index.html',
                  'fpmed_licitacoes.html'];   // entrou em 12/08: deixou de ser a tela escura
  const marcadas = claras.filter(a => /<html[^>]*\sdata-tema=/.test(fs.readFileSync(path.join(raiz, a), 'utf8')));
  ok('16. nenhuma tela CLARA se declarou dona do tema (elas seguem o cliente)',
    marcadas.length === 0, marcadas);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
