// SUITE testa_itens_no_negocio — a aba Itens do negocio e o teto CMED por baixo (fatia B3).
// Uso: node tests/testa_itens_no_negocio.js
//
// ══ A LEI QUE ESTA SUITE GUARDA ════════════════════════════════════════════════════════════
// Ordem do dono, literal: *a CMED nunca abre janela nem aba fora*. A comparacao contra o teto
// legal e uma COLUNA da linha do item, dentro da ficha do negocio. Um botao que leva pra outra
// tela — mesmo "so um atalho" — larga o negocio pra tras e so volta pelo botao do navegador.
//
// ══ E A SEGUNDA LEI, QUE E DE SEGURANCA E NAO DE DESENHO ═══════════════════════════════════
// "Nao encontrado na CMED" NUNCA pode virar verde e NUNCA pode virar zero. Item que a tabela
// nao conhece pode ser material (que nao tem teto legal) ou remedio cujo nome nao casou. Verde
// afirmaria uma conferencia que ninguem fez; "teto R$ 0,00" seria pior, porque zero e um numero
// e numero se acredita.
//
// As funcoes sao EXTRAIDAS e EXECUTADAS (nao recopiadas, e nao so lidas por regex): a licao do
// defeito de 13/08 e que ler o fonte prova que a frase foi escrita, nao que ela chega na tela.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const raiz = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(raiz, 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');

function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora: ' + ini);
  return src.slice(s, e);
}

const NADA = () => '';
const base = {
  esc: s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  brl: n => (n == null ? '—' : 'R$ ' + Number(n).toFixed(2).replace('.', ',')),
  fraseReguaNeg: () => 'régua: CMED publicada em 01/07/2026',
  SB_URL: '', SB_H: {}, NEG: [], ABERTO: null,
  fetch: () => Promise.reject(new Error('a suite nao vai a rede')),
  document: { getElementById: () => null, querySelector: () => null },
  carregarIdxCMED: () => Promise.reject(new Error('sem rede')),
  window: {},
};
const sandbox = vm.createContext(new Proxy(base, {
  has: () => true,
  get(t, k) {
    if (typeof k === 'symbol') return undefined;
    if (k in t) return t[k];
    if (Object.prototype.hasOwnProperty.call(globalThis, k)) return globalThis[k];
    throw new ReferenceError(k + ' — nome usado na aba Itens que nao existe no escopo dela');
  },
  set(t, k, v) { t[k] = v; return true; },
}));
const corpo = bloco('let ITENS_EDITAL = [], ITENS_DE = null', '/* ══ OS PRAZOS QUE PENDEM DESTA DATA');
const API = vm.runInContext('(function(){' + corpo
  + '\nreturn { participoDoItem, linhaDeItem, tetoDoItem, rodapeDosItens,'
  + '  poe: (itens, cmed) => { ITENS_EDITAL = itens; ITENS_CMED = cmed; } };})()', sandbox);

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? ' [' + JSON.stringify(got) + ']' : '')); } };
console.log('SUITE testa_itens_no_negocio — a aba Itens e o teto CMED por baixo\n');

// ══════════════════════════════════════════════════════════════════════════════════════════
// 1. QUAIS ITENS SAO MEUS — e o que "sem marcacao" quer dizer
// O contrato do A (docs/contrato_itens_editais.md, secao 2) e explicito: sem `itens` na URL
// quer dizer O PREGAO INTEIRO, e nao "nenhum item". Tratar ausencia como zero apagaria a lista
// do negocio que veio sem marcacao — que e o caso mais comum.
// ══════════════════════════════════════════════════════════════════════════════════════════
ok('1. *** sem `itens_participo`, TODO item e meu (o pregao inteiro) ***',
  API.participoDoItem({ itens_participo: null }, '7') === true);
ok('2. ...inclusive quando a coluna nem existe no registro',
  API.participoDoItem({}, '7') === true);
ok('3. com lista, so os da lista sao meus',
  API.participoDoItem({ itens_participo: ['1', '3'] }, '3') === true
  && API.participoDoItem({ itens_participo: ['1', '3'] }, '2') === false);
// *** `numero_item` E TEXTO ***: o PNCP manda "1", "01" e "1.1", e os tres existem (contrato,
// secao 1). Comparar como numero fundiria "01" e "1" — a colisao que a chave unica impede.
ok('4. *** a comparacao e por TEXTO: "01" nao e "1" ***',
  API.participoDoItem({ itens_participo: ['01'] }, '1') === false
  && API.participoDoItem({ itens_participo: ['1.1'] }, '1.1') === true);
ok('5. numero vindo como number nao quebra a comparacao',
  API.participoDoItem({ itens_participo: ['3'] }, 3) === true);
// Lista VAZIA e diferente de NULL: `[]` = alguem viu a lista e desmarcou tudo.
ok('6. lista vazia nao e "o pregao inteiro" — e nenhum item',
  API.participoDoItem({ itens_participo: [] }, '1') === false);

// ══════════════════════════════════════════════════════════════════════════════════════════
// 2. A COLUNA DO TETO — os quatro estados, executados
// ══════════════════════════════════════════════════════════════════════════════════════════
const ITEM = (n, ref) => ({ numero_item: n, descricao: 'ITEM ' + n, quantidade: 10, unidade: 'UN', valor_unitario_ref: ref });

API.poe([], null);
ok('7. antes da conferencia a coluna diz "conferindo", e nao "sem teto"',
  /conferindo/.test(API.tetoDoItem(ITEM('1', 1.5))));

API.poe([], 'erro');
const erro = API.tetoDoItem(ITEM('1', 1.5));
ok('8. *** falha ao ler a CMED NAO vira "sem teto" — sao coisas diferentes ***',
  /indisponível/.test(erro) && !/sem teto CMED/.test(erro), erro);
ok('9. ...e a tela diz que a diferenca e essa', /não é "sem teto" — é que eu não li/.test(erro));

API.poe([], { '1': { situacao: 'abaixo', teto: 0.573, tipoTeto: 'PF', folgaPct: 26.7, confianca: 'exata' } });
const verde = API.tetoDoItem(ITEM('1', 0.42));
ok('10. cabe no teto: verde, com o teto e a folga escritos',
  /cabe no teto/.test(verde) && /R\$ 0,57/.test(verde) && /folga 26\.7%/.test(verde), verde);
ok('11. ...e sem selo de confianca quando o casamento foi EXATO (ggrem/registro/EAN)',
  !/casou por/.test(verde));

API.poe([], { '1': { situacao: 'acima', teto: 0.8871, tipoTeto: 'PF', pctAcima: 362.2, confianca: 'media' } });
const vermelho = API.tetoDoItem(ITEM('1', 4.10));
ok('12. estoura o teto: vermelho, com quanto passou',
  /estoura o teto/.test(vermelho) && /362\.2%/.test(vermelho), vermelho);
// *** O PALPITE TEM QUE SE ANUNCIAR ***: casar por substancia chutada da primeira palavra do
// nome e encostar um teto legal num palpite. Sem o selo, quem le nao tem como saber.
ok('13. *** casamento por palpite vem com o selo dizendo que e palpite ***',
  /palpite do nome/.test(vermelho), vermelho);
API.poe([], { '1': { situacao: 'abaixo', teto: 1, tipoTeto: 'PMVG', folgaPct: 10, confianca: 'alta' } });
ok('14. ...e casamento por dicionario diz que veio do dicionario',
  /dicionário CMED/.test(API.tetoDoItem(ITEM('1', 0.5))));
ok('15. o tipo de teto (PF/PMVG) e mostrado, e nao presumido',
  /teto PMVG/.test(API.tetoDoItem(ITEM('1', 0.5))));

// *** O ESTADO QUE ESTA SUITE EXISTE PRA PROTEGER ***
API.poe([], { '1': { situacao: 'nao_encontrado', teto: null } });
const neutro = API.tetoDoItem(ITEM('1', 9.99));
ok('16. *** item que a CMED nao conhece fica NEUTRO — nao verde ***',
  /sem teto CMED/.test(neutro) && !/cabe no teto/.test(neutro), neutro);
ok('17. *** e NUNCA mostra teto R$ 0,00 (zero e um numero, e numero se acredita) ***',
  !/R\$ 0,00/.test(neutro), neutro);
ok('18. ...e diz por que pode nao ter casado', /material.*nome não casou/.test(neutro));
API.poe([], {});
ok('19. item sem resultado nenhum tambem cai no neutro, e nao no verde',
  /sem teto CMED/.test(API.tetoDoItem(ITEM('9', 5))));

// Sem preco de referencia nao ha comparacao — e isso nao e "dentro do teto".
API.poe([], { '1': { situacao: 'abaixo', teto: 5 } });
const semRef = API.tetoDoItem(ITEM('1', null));
ok('20. *** edital sem preco de referencia: nada a comparar, e nao "cabe" ***',
  /nada a comparar/.test(semRef) && !/cabe no teto/.test(semRef), semRef);
ok('21. ...e referencia ZERO tambem nao vira comparacao',
  /nada a comparar/.test(API.tetoDoItem(ITEM('1', 0))));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 3. A LINHA INTEIRA
// ══════════════════════════════════════════════════════════════════════════════════════════
API.poe([], { '1': { situacao: 'abaixo', teto: 5, tipoTeto: 'PF', folgaPct: 12, confianca: 'exata' } });
const meu = API.linhaDeItem({ itens_participo: ['1'] }, ITEM('1', 3));
const alheio = API.linhaDeItem({ itens_participo: ['9'] }, ITEM('1', 3));
ok('22. o item que eu disputo vem destacado', /class="it-l meu"/.test(meu));
ok('23. *** e o que nao e meu fica APAGADO, nao SUMIDO ***', /class="it-l apagado"/.test(alheio));
ok('24. ...e diz por que esta apagado', /não é um item deste negócio/.test(alheio));
ok('25. a linha traz descricao, quantidade e unidade', /ITEM 1/.test(meu) && /10 UN/.test(meu));
ok('26. a linha diz que o preco mostrado e a REFERENCIA DO EDITAL', /referência do edital/.test(meu));
ok('27. sem referencia, o rotulo "referência do edital" nao aparece se contradizendo',
  !/referência do edital/.test(API.linhaDeItem({}, ITEM('1', null))));
// Descricao vem do banco e entra no HTML: sem escape, um "<" derruba a aba inteira.
const perigo = API.linhaDeItem({}, { numero_item: '1', descricao: '<img src=x>', quantidade: 1, unidade: 'UN', valor_unitario_ref: 1 });
ok('28. *** o que vem do banco e escapado antes de virar HTML ***',
  perigo.indexOf('<img src=x>') < 0 && /&lt;img/.test(perigo));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 4. O RODAPE — o que ele CONFESSA
// ══════════════════════════════════════════════════════════════════════════════════════════
API.poe([], { '1': { situacao: 'abaixo' }, '2': { situacao: 'acima' }, '3': { situacao: 'nao_encontrado' } });
const rod = API.rodapeDosItens();
ok('29. o rodape conta dentro / acima / sem teto', /1<\/b> dentro/.test(rod) && /1<\/b> acima/.test(rod) && /1<\/b> sem teto/.test(rod), rod);
// *** ESTE E O AVISO QUE IMPEDE UMA LEITURA CARA ***: o preco da esquerda e do EDITAL, e nao
// a nossa proposta. Vermelho aqui e o ORGAO referenciando acima do teto — e nao um preco nosso
// que precise ser refeito.
ok('30. *** o rodape diz que a coluna NAO e a sua proposta ***',
  /não<\/b> é\s*a sua proposta/.test(rod.replace(/\n\s*/g, ' ')), rod.slice(0, 200));
ok('31. ...e que vermelho quer dizer que o ORGAO referenciou acima',
  /órgão<\/b> referenciou acima do teto/.test(rod.replace(/\n\s*/g, ' ')));
ok('32. *** "sem teto na CMED" nao quer dizer "dentro do teto", e esta escrito ***',
  /Sem teto na CMED não quer dizer dentro do teto/.test(rod.replace(/\n\s*/g, ' ')));
ok('33. a regua (qual edicao da CMED) vai junto do resultado', /régua: CMED publicada/.test(rod));
API.poe([], null);
ok('34. antes de conferir, o rodape nao inventa contagem nenhuma',
  !/dentro ·/.test(API.rodapeDosItens()));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 5. A LEI DO DONO, no codigo que esta no ar
// ══════════════════════════════════════════════════════════════════════════════════════════
const semComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
const CODIGO = semComentarios(src);
ok('35. *** nenhum caminho EXECUTAVEL do Negocios leva pro Conferidor ***',
  !/fpmed_conferidor\.html/.test(CODIGO));
ok('36. *** e o bloco da aba Itens nao abre janela, aba nem outra tela ***',
  !/window\.open|_blank|location\.href/.test(semComentarios(bloco('let ITENS_EDITAL = [], ITENS_DE = null', '/* ══ OS PRAZOS QUE PENDEM DESTA DATA'))));
ok('37. a acao do rodape da ficha e a propria aba, e nao uma navegacao',
  /fn: `abaFicha\(document\.querySelector\('\[data-aba=itens\]'\),'itens'\)`/.test(src));
// *** O MOTOR DE TETO PRECISA ESTAR NA PAGINA ***: ate 14/08 ele nao estava, e a conferencia
// de proposta desta tela respondia "o motor de teto nao carregou" em TODA tentativa. Nenhuma
// suite via, porque todas conferiam a funcao que CHAMA o motor, e nao a etiqueta que o traz.
ok('38. *** a tela CARREGA o motor de teto (o <script> que faltava desde sempre) ***',
  /<script src="fpmed_teto_cmed\.js"><\/script>/.test(src));
ok('39. ...e ele ja estava na casca do service worker, entao offline nao muda',
  /'\.\/fpmed_teto_cmed\.js'/.test(fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8')));
ok('40. a aba Itens existe na fileira de abas da ficha', /\['itens','Itens','dw-itens-n'\]/.test(src));
// A leitura da CMED e cara: a tabela inteira. Ela nao pode acontecer so porque alguem clicou
// num card pra ver a data da sessao.
ok('41. *** a tabela CMED so e lida quando a aba Itens abre, e nao a cada ficha ***',
  /qual === 'itens' && ABERTO && ITENS_CMED === null && ITENS_EDITAL\.length/.test(src));
ok('42. ...e uma vez so: o indice fica em memoria entre negocios',
  /if\(IDX_CMED\) return IDX_CMED;/.test(src));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
