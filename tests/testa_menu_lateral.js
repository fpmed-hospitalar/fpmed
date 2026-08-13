// SUITE testa_menu_lateral - o menu de modulos, item 3 da reforma.
//
// == O QUE ESTA SUITE GUARDA ===================================================
// Tres coisas, e as tres ja custaram caro em algum lugar deste projeto:
//
//  1. QUE O MENU NAO SE MONTE SOZINHO. Incluir o script numa tela nao pode mudar
//     nada; o menu so aparece onde houver [data-limedtec-menu]. E o "sem apagao"
//     aplicado a navegacao: menu que nasce em 15 telas de uma vez, se nascer
//     torto, nasce torto em 15 lugares.
//  2. QUE COR E ESPACO VENHAM SO DO TEMA. A versao anterior deste arquivo tinha
//     cor chumbada e EMOJI como icone. Ela nunca foi ao ar - mas so porque
//     alguem leu. Agora quem le e o assert.
//  3. QUE O MODULO ACESO SEJA O CERTO. Menu a gente nao le, a gente clica: item
//     errado aceso passa meses sem ninguem reparar.
//
//   node tests/testa_menu_lateral.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const M = R('limedtec-menu.js');
const uc = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*\n\s*(?:\/\/|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_menu_lateral - o menu de modulos\n');

// ── 1. o menu roda de verdade, num DOM de mentira ────────────────────────────
// Em vez de procurar texto no arquivo, a suite EXECUTA o modulo contra um DOM
// minimo e olha o que saiu. Assert que le codigo prova que o codigo esta escrito;
// assert que roda o codigo prova que ele funciona.
function domFalso(url, hash) {
  const feitos = [];
  const el = (tag) => ({
    tag, id: '', className: '', attrs: {}, filhos: [], _html: '', textContent: '',
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; },
    appendChild(c) { this.filhos.push(c); feitos.push(c); return c; },
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
  });
  const head = el('head');
  const doc = {
    readyState: 'complete', head,
    createElement: (t) => el(t),
    getElementById: (id) => feitos.find(x => x.id === id) || null,
    querySelector: (sel) => (/fpmed_tema\.css/.test(sel)
      ? feitos.find(x => x.tag === 'link' && /fpmed_tema\.css/.test(x.href || '')) || null : null),
    /* A pagina de mentira TEM conteudo (um <body>), mas NAO tem ponto de montagem.
       Isso e o que torna o assert 2 capaz de morder: se alguem trocar o seletor
       [data-limedtec-menu] por qualquer outro que exista na pagina, o menu monta
       e o teste fica vermelho. Antes esta funcao devolvia [] pra tudo, e ai a
       mutacao "menu passa a se montar sozinho" passava VERDE - o DOM falso era
       incapaz de reproduzir o defeito que a suite dizia guardar. */
    querySelectorAll: (sel) => (String(sel).indexOf('data-limedtec-menu') >= 0 ? [] : [el('body')]),
    addEventListener() {},
  };
  const win = { location: { pathname: url, hash: hash || '' }, document: doc };
  return { win, doc, feitos };
}

function carrega(url, hash) {
  const { win, doc, feitos } = domFalso(url, hash);
  const fn = new Function('window', 'document', M + '\nreturn window.LimedtecMenu;');
  const api = fn(win, doc);
  return { api, doc, feitos, win };
}

let n = 1;
const base = carrega('/fpmed_licitacoes.html');
ok(n + '. o arquivo carrega e exporta a API', !!(base.api && base.api.montar)); n++;
ok(n + '. carregar NAO monta nada sozinho (sem [data-limedtec-menu], nada acontece)',
  base.feitos.filter(x => x.tag === 'nav').length === 0); n++;

// ── 2. o modulo aceso ────────────────────────────────────────────────────────
const CASOS = [
  ['/fpmed_licitacoes.html', '', 'buscar', 'a tela Encontrar acende Buscar'],
  ['/fpmed_licitacoes.html', '#radar', 'radar', 'o mesmo arquivo com #radar acende Radar'],
  ['/fpmed_licitacoes.html', '#jornais', 'jornais', 'e com #jornais acende Meus Jornais'],
  ['/fpmed_licitacoes.html', '#lk-desertas', 'desertas', 'e com #lk-desertas acende Desertas'],
  ['/fpmed_negocios.html', '', 'negocios', 'Negocios'],
  ['/fpmed_edital_ia.html', '', 'leitor', 'Leitor de edital'],
  /* REAPONTADO em 13/08 (item 8): "Conferir CMED" SAIU da lista de modulos — a CMED virou base
     por baixo de todo preco, e um item de menu ensinava que conferir o teto e uma parada
     separada. A tela continua existindo e continua alcancavel pelo RODAPE, mas ela nao e mais
     um modulo — entao ela acende NADA, exatamente como qualquer tela de fora da lista.
     >>> O assert nao virou "nao testa mais": ele passou a cobrar o comportamento NOVO, que e o
         menu nao mentir marcando um modulo que nao corresponde a tela aberta. */
  ['/fpmed_conferidor.html', '', null, 'Conferir CMED saiu da lista: nao acende modulo nenhum'],
  ['/fpmed_giovana.html', '', 'proposta', 'Proposta'],
  ['/fpmed_documentos.html', '', 'documentos', 'Documentos'],
  ['/fpmed_sistema_final.html', '', 'sistema', 'Sistema comercial'],
  ['/uma_tela_que_nao_esta_no_menu.html', '', null, 'tela de fora nao acende NADA (em vez de acender a primeira)'],
];
for (const [url, hash, esperado, porque] of CASOS) {
  const c = carrega(url, hash);
  const deu = c.api.moduloAtual(null);
  ok(n + '. ' + porque, deu === esperado, { deu, esperado }); n++;
}

// ── 3. a montagem ────────────────────────────────────────────────────────────
const c = carrega('/fpmed_negocios.html');
const alvo = { attrs: {}, filhos: [], setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }, appendChild(x) { this.filhos.push(x); } };
const nav = c.api.montar(alvo);
ok(n + '. montar() devolve o <nav> e o pendura no alvo', !!nav && alvo.filhos.length === 1); n++;
ok(n + '. o nav tem rotulo de acessibilidade', nav.getAttribute('aria-label') === 'Modulos do sistema'
  || /Módulos do sistema/.test(nav.getAttribute('aria-label') || '')); n++;
const html = nav.innerHTML;
ok(n + '. montar() duas vezes no mesmo alvo nao duplica o menu',
  c.api.montar(alvo) === null && alvo.filhos.length === 1); n++;
ok(n + '. o modulo da tela aberta esta marcado com aria-current',
  /aria-current="page"/.test(html) && (html.match(/aria-current/g) || []).length === 1); n++;
ok(n + '. e a marcacao nao e so cor: tem a classe que aplica fundo, cor E barra',
  /class="lm-on"/.test(html)); n++;
/* ══ ESTE ASSERT MUDOU DE LADO EM 12/08, e o registro importa ═══════════════════════════════
   Ele cobrava o Calendario DESLIGADO com "em breve" — que era a verdade ate o item 6 existir.
   Agora ele cobra o contrario: link de verdade, sem "em breve", apontando pra visao do
   Negocios. O que NAO mudou e a regra por tras dos dois: o item ocupa o MESMO lugar na lista
   antes e depois, porque menu que muda de tamanho a cada entrega faz a pessoa reaprender onde
   as coisas ficam.
   >>> E O MECANISMO DO "em breve" CONTINUA COBRADO logo abaixo, com o Favoritas. Sem isso,
       apagar o suporte a `emBreve` do menu passaria despercebido. */
ok(n + '. o Calendario ACENDEU: link de verdade pra visao do Negocios, sem "em breve"',
  /href="fpmed_negocios\.html#calendario"/.test(html)
  && !/lm-off[^>]*>\s*(<svg[\s\S]*?<\/svg>)?\s*Calend/.test(html)); n++;
/* O "EM BREVE" FICOU SEM NENHUM MORADOR quando o Calendario acendeu — era o ultimo. Entao ele
   passa a ser provado pelo MECANISMO, e nao por um item que por acaso esteja desligado hoje:
   a suite poe um modulo falso na lista, monta de novo e olha o que saiu.
   >>> POR QUE NAO APAGUEI O MECANISMO (L7 diz pra apagar codigo morto): ele nao esta morto, esta
       VAZIO. A regra de produto que ele serve continua valendo e vai ser usada no proximo modulo
       da fila que nascer pela metade — e ela e uma decisao ja tomada, nao um "vai que precisa".
       Sem este assert, porem, ele quebraria em silencio e so se descobriria no dia do uso. */
(function () {
  const c2 = carrega('/fpmed_negocios.html');
  c2.api.MODULOS.push({ id: 'sistema', rotulo: 'Modulo de mentira', emBreve: true });
  const alvo2 = { attrs: {}, filhos: [], setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }, appendChild(x) { this.filhos.push(x); } };
  const h2 = c2.api.montar(alvo2).innerHTML;
  ok(n + '. o mecanismo do "em breve" continua vivo: item desligado, com aviso e SEM link',
    /lm-off/.test(h2) && /em breve/.test(h2) && /Modulo de mentira/.test(h2)
    && !/href="[^"]*Modulo de mentira/.test(h2)); n++;
})();
// O menu so acende o Calendario COM o hash. Sem ele, quem responde por fpmed_negocios e o
// Negocios — os dois acesos ao mesmo tempo seria o menu dizendo que voce esta em dois lugares.
ok(n + '. abrir fpmed_negocios COM #calendario acende o Calendario, e nao o Negocios',
  carrega('/fpmed_negocios.html', '#calendario').api.moduloAtual(null) === 'calendario'); n++;
ok(n + '. e um #calendario numa OUTRA tela nao acende o Calendario (modulo e tela + hash)',
  carrega('/fpmed_licitacoes.html', '#calendario').api.moduloAtual(null) === 'buscar'); n++;
ok(n + '. o tema e carregado se a tela ainda nao tiver',
  c.feitos.some(x => x.tag === 'link' && /fpmed_tema\.css/.test(x.href || ''))); n++;

// ── 4. todo item leva a uma tela QUE EXISTE ──────────────────────────────────
// Este e o assert que impede a falha mais burra e mais provavel: renomear um
// arquivo e deixar o menu apontando pro nome velho. O menu vira um campo minado
// de 404 e ninguem descobre ate um cliente clicar.
const hrefs = [...html.matchAll(/href="([^"#]+)(?:#[^"]*)?"/g)].map(x => x[1]);
const faltando = hrefs.filter(h => !fs.existsSync(path.join(__dirname, '..', h)));
ok(n + '. TODO link do menu aponta pra um arquivo que existe no repo', faltando.length === 0, faltando); n++;
ok(n + '. e ha link de verdade (o assert acima nao passa por lista vazia)', hrefs.length >= 10, hrefs.length); n++;

// ── 5. as regras do tema e do adendo ─────────────────────────────────────────
const CSS = c.api.CSS;
/* ══ O --cinza-400 NAO CARREGA TEXTO (13/08, item 7 fatia 2) ═══════════════════
   Ele vivia em TRES lugares deste arquivo como cor de texto: o rotulo de grupo
   ("OPORTUNIDADES"/"GESTAO"/"FERRAMENTAS"), o "HOSPITALAR" da marca e o "em
   breve". Medido contra branco: **2,44:1** - metade do minimo de AA. Ou seja, o
   rotulo que organiza o menu inteiro nasceu na fronteira do ilegivel, e ninguem
   tinha notado porque cor a gente olha e acha bonita, nao mede (S12).
   >>> O TOKEN CONTINUA NO ARQUIVO, no oficio dele: borda e icone desligado. O que
       este assert proibe e ele voltar a `color:`. Sem ele, a proxima pessoa que
       quiser "deixar o rotulo mais discreto" desfaz o conserto em uma linha. */
const _corDeTexto = [...CSS.matchAll(/color\s*:\s*var\(--([a-z0-9-]+)\)/g)].map(m => m[1]);
ok(n + '. o --cinza-400 nao e usado como COR DE TEXTO (2,44:1 sobre branco reprova em AA)',
  !_corDeTexto.includes('cinza-400'),
  _corDeTexto.filter(c => c === 'cinza-400')); n++;
ok(n + '. e o rotulo de grupo usa o degrau de texto MENOR (--txt-0), que nasceu pra ele',
  /\.lm-grupo\{[\s\S]{0,200}?font-size:var\(--txt-0\)/.test(CSS.replace(/\n/g, ''))); n++;
/* Mede a REGRA do container, e nao o arquivo inteiro: `.lm-cruz` e os `svg` tem
   largura em px de proposito (sao tamanhos de desenho, nao layout). A primeira
   versao deste assert nao separava as duas coisas e acusou o icone - instrumento
   largo demais acusa o inocente, que e a S10 de novo. */
const _regraMenu = (CSS.match(/#limedtec-menu\{[\s\S]*?\}/) || [''])[0];
ok(n + '. a largura do menu vem do token, e nao de um numero repetido em cada tela',
  /width:var\(--menu-largura\)/.test(_regraMenu) && !/width:\s*\d+px/.test(_regraMenu),
  _regraMenu.slice(0, 120)); n++;

ok(n + '. ZERO cor chumbada no CSS do menu - tudo vem de var()',
  (CSS.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) || []).length === 0,
  (CSS.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) || [])); n++;
ok(n + '. ZERO espacamento literal em padding/margin/gap',
  (CSS.match(/(?:padding|margin|gap)[a-z-]*\s*:\s*[^;}]*?\b\d+px/g) || []).length === 0,
  (CSS.match(/(?:padding|margin|gap)[a-z-]*\s*:\s*[^;}]*?\b\d+px/g) || [])); n++;
ok(n + '. ZERO emoji no arquivo inteiro (a versao anterior usava emoji como icone)',
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(M)); n++;
ok(n + '. todo seletor do CSS mora sob #limedtec-menu (nao vaza pra tela que hospeda)',
  (CSS.match(/^[^@\s][^{]*\{/gm) || []).every(s => /#limedtec-menu/.test(s)),
  (CSS.match(/^[^@\s][^{]*\{/gm) || []).filter(s => !/#limedtec-menu/.test(s))); n++;
ok(n + '. o texto usa a escala do tema, nao numero solto',
  !/font-size:\s*\d/.test(CSS)); n++;
ok(n + '. a transicao usa o token de 150ms', /transition:[^;]*var\(--transicao\)/.test(CSS)); n++;
ok(n + '. ha foco visivel no link (quem navega por teclado precisa saber onde esta)',
  /:focus-visible\{[^}]*var\(--foco\)/.test(CSS.replace(/\s+/g, ' ').replace(/ \{/g, '{'))); n++;

/* ══ A SIDEBAR NAVY (13/08, passo 2 do molde) ══════════════════════════════════
   O menu deixou de ser branco. Isso inverte QUAIS tokens de texto sao legitimos
   aqui: os cinzas da rampa foram medidos contra BRANCO, e o mais escuro deles
   (--cinza-800, a tinta principal) sobre o navy da 1,3:1 — some. O contrario do
   defeito de manha, e pela mesma causa: cor escolhida sem olhar o fundo.
   >>> ENTAO O ASSERT E POSITIVO, e nao uma lista de proibidos: toda cor de texto
       do menu tem que sair da familia do navy (ou ser o branco puro, que e o item
       aceso). Assim ele barra qualquer cinza claro que alguem traga depois, e nao
       so os que eu me lembrei de proibir hoje. */
const _tintasPermitidas = ['navy-tinta', 'navy-apoio', 'navy-rotulo', 'navy-marca',
  'navy-selo-tinta', 'branco', 'azul-500', 'navy'];
const _tintasUsadas = [...CSS.matchAll(/color\s*:\s*var\(--([a-z0-9-]+)\)/g)].map(m => m[1]);
ok(n + '. sobre o navy, toda cor de texto sai da familia do navy (cinza de fundo claro some ali)',
  _tintasUsadas.length > 0 && _tintasUsadas.every(t => _tintasPermitidas.indexOf(t) >= 0),
  _tintasUsadas.filter(t => _tintasPermitidas.indexOf(t) < 0)); n++;
ok(n + '. o fundo da sidebar e o navy da marca, e nao um escuro improvisado',
  /background:var\(--navy\)/.test(_regraMenu), _regraMenu.slice(0, 160)); n++;

/* ══ O CONTADOR — o slot existe e nasce VAZIO ══════════════════════════════════
   O molde poe numero em quatro itens, e os quatro sao dado FICTICIO de
   demonstracao (esta escrito no README dele). A ordem do dono sobre os KPIs vale
   igual aqui: numero na tela vem do banco. Entao o menu ganhou o LUGAR do numero,
   e quem o preenche e a tela.
   >>> O ASSERT QUE IMPORTA E O DE ESCONDER. Se `contador` aceitasse `null` como 0,
       uma leitura que FALHOU viraria "nao ha nenhum" na tela — afirmacao diferente
       e possivelmente falsa. E a licao S6 dentro do menu. */
/* O link do RODAPE (a busca crua da CMED, item 8) e `<a>` mas nao e modulo: ele nao tem contador
   e nao deve ter. Contar todos os `href` fazia o assert acusar um slot faltando por causa dele —
   vermelho sem nada ter piorado. Agora a conta e de LINKS DE MODULO. */
const linksModulo = hrefs.length - (html.match(/class="lm-crua"/g) || []).length;
ok(n + '. todo item nasce com o slot do contador VAZIO (numero nenhum e chumbado)',
  (html.match(/class="lm-num" hidden/g) || []).length === linksModulo
  && !/lm-num[^>]*>\s*\d/.test(html),
  { slots: (html.match(/class="lm-num" hidden/g) || []).length, linksModulo }); n++;
(function () {
  /* Um DOM de mentira SO pro contador: ele precisa de querySelector que ache o slot.
     O outro DOM falso nao acha nada de proposito (e o que faz o assert 2 morder). */
  /* A pagina de mentira so tem slot pros modulos que EXISTEM. Isso e o que da dente
     ao ultimo assert: um querySelector que fabrica elemento pra qualquer seletor
     nunca conseguiria reproduzir o "id que nao existe" — e seria o mesmo furo do
     DOM falso que a mutacao pegou em 11/08. */
  const slots = {};
  for (const m of c.api.MODULOS) if (m.id) slots[m.id] = { hidden: true, textContent: '', className: 'lm-num' };
  const fake = { querySelector: sel => {
    const m = /\[data-num="([^"]+)"\]/.exec(sel);
    return (m && slots[m[1]]) ? slots[m[1]] : null;
  } };
  const c3 = carrega('/fpmed_negocios.html');
  const api = new Function('window', 'document', M + '\nreturn window.LimedtecMenu;')(
    { location: { pathname: '/fpmed_negocios.html', hash: '' } },
    Object.assign({ readyState: 'complete', head: { appendChild() {} },
      createElement: () => ({ setAttribute() {}, appendChild() {} }),
      getElementById: () => ({}), querySelectorAll: () => [], addEventListener() {} }, fake));
  ok(n + '. contador(id, n) acende o slot com o numero formatado em pt-BR',
    api.contador('negocios', 2555) === true && slots.negocios.hidden === false
    && slots.negocios.textContent === '2.555', slots.negocios); n++;
  api.contador('negocios', null);
  ok(n + '. e contador(id, null) ESCONDE - leitura que falhou nao vira "0" na tela (S6)',
    slots.negocios.hidden === true && slots.negocios.textContent === '', slots.negocios); n++;
  api.contador('buscar', 12, true);
  ok(n + '. o destaque verde e opcional e sai da classe, nao de cor escrita na mao',
    /lm-num--destaque/.test(slots.buscar.className), slots.buscar.className); n++;
  ok(n + '. contador em id que nao existe devolve false em vez de estourar',
    api.contador('modulo_que_nao_existe', 3) === false); n++;
  void c3;
})();
/* ══ ESTE ASSERT NASCEU DE UMA MUTACAO QUE PASSOU VERDE (13/08) ════════════════
   Tirei o `tabular-nums` do contador e a suite continuou verde. O comentario do
   CSS explicava por que ele existe — o contador fica encostado na borda direita,
   e sem digito de largura fixa "12" e "38" terminam em posicoes diferentes, com a
   coluna dancando a cada troca de tela. Explicacao nao e guarda.
   O mesmo vale pro encosto na direita: sem `margin-left:auto` o numero cola no
   nome do modulo e deixa de ser uma coluna. */
ok(n + '. o contador e uma COLUNA: encostado a direita e com digito de largura fixa',
  /\.lm-num\{[^}]*margin-left:auto/.test(CSS.replace(/\s+/g, ' ').replace(/ \{/g, '{'))
  && /\.lm-num\{[^}]*tabular-nums/.test(CSS.replace(/\s+/g, ' ').replace(/ \{/g, '{')),
  (CSS.match(/\.lm-num\{[^}]*\}/) || [''])[0]); n++;

/* ══ O SELO "IA" (13/08, item 7c) ══════════════════════════════════════════════
   O molde poe um selo verde "IA" no Leitor de edital. Ele nao e enfeite nem
   contador: e AVISO DE NATUREZA — este e o unico modulo do menu que gasta dinheiro
   por uso (cada leitura consome credito e entra no `usos_ia`).
   >>> POR QUE ELE NAO E O SLOT DO CONTADOR, que esta ali do lado: o contador e
       NUMERO e muda; o selo e ROTULO e nao muda. Reaproveitar o slot faria o dia em
       que este item ganhasse contagem APAGAR o aviso — e o aviso e o que impede
       alguem de clicar sem saber que aquilo custa. Por isso os dois convivem, e ha
       assert pra que continuem dois. */
ok(n + '. o Leitor de edital carrega o selo "IA" (aviso de que o modulo custa por uso)',
  (c.api.MODULOS.find(m => m.id === 'leitor') || {}).selo === 'IA'
  && /class="lm-selo"/.test(html)); n++;
ok(n + '. e o selo e outra peca que o contador (rotulo x numero, os dois podem coexistir)',
  /\.lm-selo\{/.test(CSS) && /\.lm-selo \+ \.lm-num\{/.test(CSS)); n++;
ok(n + '. o selo usa o verde da marca com o navy por cima (9,04:1), e nao cor escrita a mao',
  /\.lm-selo\{[^}]*background:var\(--verde-500\)/.test(CSS.replace(/\s*\n\s*/g, ''))
  && /\.lm-selo\{[^}]*color:var\(--navy\)/.test(CSS.replace(/\s*\n\s*/g, ''))); n++;
/* E o selo NAO pode virar decoracao solta: quem o recebe e o modulo, pela lista. Um `<span>`
   chumbado no HTML do menu passaria neste teste se ele olhasse so a marcacao. */
ok(n + '. so quem declara `selo` na lista recebe um (nao ha selo chumbado na marcacao)',
  (html.match(/class="lm-selo"/g) || []).length
    === c.api.MODULOS.filter(m => m.selo).length); n++;

// ── 6. os icones ─────────────────────────────────────────────────────────────
const ICONE = c.api.ICONE;
const MODULOS = c.api.MODULOS.filter(x => x.id);
ok(n + '. todo modulo tem icone', MODULOS.every(m => ICONE[m.id]),
  MODULOS.filter(m => !ICONE[m.id]).map(m => m.id)); n++;
ok(n + '. o telefone do rodape usa ICONE, nao emoji (D11)',
  !!ICONE.telefone && /svg\('telefone'\)/.test(M)); n++;
ok(n + '. os SVG sao todos do mesmo grid 24x24',
  (html.match(/viewBox="([^"]+)"/g) || []).every(v => /0 0 24 24/.test(v))); n++;
ok(n + '. e todos com o mesmo traco', (CSS.match(/stroke-width:\s*([\d.]+)/g) || []).length === 1); n++;
ok(n + '. icone e decorativo pro leitor de tela (o rotulo ja diz o nome)',
  (html.match(/<svg/g) || []).length === (html.match(/aria-hidden="true"/g) || []).length); n++;

// ── 7. estreito ──────────────────────────────────────────────────────────────
ok(n + '. em tela estreita o menu NAO some - vira faixa horizontal',
  /max-width:900px/.test(CSS) && /flex-direction:row/.test(CSS) && !/display:none[^}]*#limedtec-menu\{/.test(CSS)); n++;

// ── 8. a memoria do porque (L6) ──────────────────────────────────────────────
ok(n + '. o arquivo registra por que o menu nao se monta sozinho', /sem apagao/i.test(uc(M))); n++;
ok(n + '. e registra as divergencias com o prototipo, com o motivo de cada uma',
  /DIVERGENCIAS COM O PROTOTIPO/i.test(uc(M)) && /Emoji como icone e PROIBIDO/i.test(uc(M))); n++;
ok(n + '. e deixa a decisao dos icones em aberto pro dono, sem fingir que e Lucide',
  /nao inventei paths dizendo que eram Lucide/i.test(uc(M))); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
