#!/usr/bin/env node
/* RÉGUA VISUAL — o instrumento do trabalhador B para a fatia B19.
 *
 * POR QUE ELA EXISTE: a caixa B19 manda aplicar o docs/MOLDE_VISUAL.md nas minhas quatro telas,
 * e a divisão do trabalho deu as 5 catracas ao A (ferramenta compartilhada). Quando cheguei elas
 * NÃO existiam — a caixa prevê o caso: "faça a fatia medindo do seu jeito e diga no relatório".
 * Esta é a minha medição. Ela é ESTÁTICA e REPETÍVEL de propósito (PARTE 4 da BASE_VISUAL):
 * eu não logo no sistema, e tela com portão de login medida sem sessão mede a MOLDURA.
 *
 * A LEI DA RÉGUA (PARTE 4.1 da BASE): régua antes do número. Então cada conta abaixo diz
 * exatamente O QUE está contando, e o que ela NÃO alcança sai declarado, não escondido.
 *
 *   node tools/regua_visual_b.js                 -> mede as 4 telas do B
 *   node tools/regua_visual_b.js arquivo.html    -> mede um arquivo
 *   node tools/regua_visual_b.js --json          -> devolve o retrato em JSON
 */
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');

// A GRADE DE 8 É A DO TEMA DA CASA, NÃO A DO MOLDE IMPORTADO.
// O MOLDE_VISUAL.md fecha em 4·8·12·16·20·24·40·64; o fpmed_tema.css publica
// --esp-1..6 (4,8,12,16,20,24) + --esp-8:32 + --esp-12:48 + --esp-16:64, e NÃO tem 40.
// A caixa manda: "onde a BASE e o molde da casa discordarem, o MOLDE DA CASA MANDA".
// Então a grade medida é a do tema, com 32 e 48 dentro e 40 fora. Divergência declarada.
const GRADE = [0, 4, 8, 12, 16, 20, 24, 32, 48, 64];
const PISO_TEXTO = 12;   // px — piso de tela; @media print sai em coluna própria
const ALVO_TOQUE = 44;   // px — largura E altura, só em @media (max-width:480px)

const TELAS_DO_B = ['fpmed_negocios.html', 'fpmed_giovana.html',
                    'fpmed_ajuda.html', 'fpmed_documentos.html'];

/* ── 1. Contexto de @media: sem isto a conta mistura papel com tela ────────────────────────
   O erro que a BASE registra ("uma régua que contava o documento impresso como texto de
   tela") é exatamente o que este bloco impede. Ele acha cada `@media ... {` e fecha o bloco
   contando chaves, para saber, de cada posição do arquivo, dentro de que mídia ela está. */
function blocosDeMedia(txt) {
  const blocos = [];
  const re = /@media([^{]*)\{/g;
  let m;
  while ((m = re.exec(txt))) {
    const consulta = m[1].trim();
    let i = re.lastIndex, prof = 1;
    while (i < txt.length && prof > 0) {
      const c = txt[i];
      if (c === '{') prof++;
      else if (c === '}') prof--;
      i++;
    }
    blocos.push({ consulta, ini: m.index, fim: i });
  }
  return blocos;
}
const dentroDe = (blocos, pos, teste) =>
  blocos.some(b => pos >= b.ini && pos < b.fim && teste(b.consulta));

const ehPrint   = q => /\bprint\b/.test(q);
const ehCelular = q => /max-width\s*:\s*(\d+)px/.test(q) &&
                       Number(/max-width\s*:\s*(\d+)px/.exec(q)[1]) <= 480;

/* ── 2. O que PINTA x o que só EXPLICA ──────────────────────────────────────────────────────
   Precedente da casa (assert 15 do testa_tema_tela_propria): a varredura de cor lê o arquivo
   SEM comentário. Um assert que só fica verde se eu apagar a explicação está contra a lei do
   "porquê escrito". Comentário de HTML e de bloco saem; o resto fica. */
// >>> APAGA O COMENTÁRIO PRESERVANDO AS QUEBRAS DE LINHA. A primeira versão trocava o
//     comentário por espaços e apontava linha ERRADA (o #111 "da linha 3006" era um `}`).
//     Régua que erra o endereço manda consertar o lugar errado — é o mesmo defeito de família
//     que a BASE chama de "régua antes do número", só que no eixo do arquivo.
function semComentario(txt) {
  const branco = m => m.replace(/[^\n]/g, ' ');
  return txt.replace(/<!--[\s\S]*?-->/g, branco)
            .replace(/\/\*[\s\S]*?\*\//g, branco);
}
const linhaDe = (txt, pos) => txt.slice(0, pos).split('\n').length;

/* ── 2b. O DOCUMENTO GERADO EM JANELA NOVA É OUTRO MEIO ────────────────────────────────────
   A Negócios monta 4 relatórios com `document.write('<!doctype html>…</html>')`. Aquilo é um
   DOCUMENTO para ler e imprimir, numa janela que NÃO carrega o fpmed_tema.css — token ali não
   resolve (e a régua flagrou um `var(--cinza-600)` escrito lá dentro, que hoje não pinta nada).
   PARTE 4.4 da BASE: não se exclui, separa-se. Então isto vira COLUNA PRÓPRIA, com o número
   publicado do lado, e não some da conta.
   O recorte é AUTOMÁTICO (do `document.write(` até o `</html>');`) e não um marcador que o
   autor escreve — marcador à mão seria uma porta para esconder defeito de tela aqui dentro. */
function blocosDeDocGerado(txt) {
  const blocos = [];
  const re = /\.write\s*\(\s*['"`]<!doctype/gi;
  let m;
  while ((m = re.exec(txt))) {
    const fim = txt.indexOf('</html>', re.lastIndex);
    blocos.push({ ini: m.index, fim: fim < 0 ? txt.length : fim + 7 });
  }
  return blocos;
}
const emDocGerado = (docs, pos) => docs.some(b => pos >= b.ini && pos < b.fim);

/* ── 3. As contas ───────────────────────────────────────────────────────────────────────── */

/* OS TOKENS DE TEXTO DO TEMA, RESOLVIDOS EM PIXEL.
   >>> ESTE BLOCO NASCEU DE UM ERRO DA PRÓPRIA RÉGUA, e fica escrito porque é o defeito que a
   BASE chama de "régua ruim": a primeira versão contava só `font-size:<n>px` e deu **0 abaixo
   do piso** na Ajuda — atestado de saúde falso. A Ajuda tem `font-size:var(--txt-0)`, e
   `--txt-0` vale **10px** no fpmed_tema.css. O piso furado por TOKEN é invisível para quem
   procura número. São 4 usos nas minhas telas, e eu teria publicado "Ajuda limpa". */
function tokensDeTexto() {
  const css = fs.readFileSync(path.join(raiz, 'fpmed_tema.css'), 'utf8');
  const mapa = {};
  const re = /(--txt-[a-z0-9-]+)\s*:\s*([\d.]+)px/gi;
  let m;
  while ((m = re.exec(css))) mapa[m[1]] = Number(m[2]);
  return mapa;
}
const TOKENS_TEXTO = tokensDeTexto();

// 3.1 PISO DE TEXTO. Conta `font-size` abaixo de 12px escrito de DUAS formas: em pixel cru e
// pelo token do tema que vale menos que o piso. Alcança CSS de <style>, atributo style= e
// string escrita por JavaScript — a forma é a mesma nos três.
// `@media print` NÃO é excluído: vai para coluna própria (PARTE 4.4 — não se exclui, separa-se).
function medeTexto(txt, blocos, docs) {
  const achados = { tela: [], papel: [], docGerado: [] };
  const guarda = (pos, valor, trecho, viaToken) => {
    const alvo = emDocGerado(docs, pos) ? achados.docGerado
               : dentroDe(blocos, pos, ehPrint) ? achados.papel : achados.tela;
    alvo.push({ linha: linhaDe(txt, pos), valor, trecho, viaToken: !!viaToken });
  };
  let m;
  const rePx = /font-size\s*:\s*([\d.]+)px/gi;
  while ((m = rePx.exec(txt))) {
    if (Number(m[1]) < PISO_TEXTO) guarda(m.index, Number(m[1]), m[0], false);
  }
  const reVar = /font-size\s*:\s*var\(\s*(--txt-[a-z0-9-]+)/gi;
  while ((m = reVar.exec(txt))) {
    const v = TOKENS_TEXTO[m[1]];
    if (v !== undefined && v < PISO_TEXTO) guarda(m.index, v, m[0], true);
  }
  return achados;
}

// 3.2 ESPAÇO NA GRADE DE 8. Conta só propriedade de ESPAÇO (padding/margin/gap) — largura,
// altura e posição não são espaço e entrariam de carona inflando o número.
function medeEspaco(txt, blocos, docs) {
  const fora = [];
  const re = /\b(padding|margin|gap|row-gap|column-gap)(-top|-right|-bottom|-left)?\s*:\s*([^;}"']+)/gi;
  let m;
  while ((m = re.exec(txt))) {
    const valores = m[3].match(/-?[\d.]+px/g) || [];
    for (const v of valores) {
      const n = Math.abs(Number(v.replace('px', '')));
      if (GRADE.includes(n)) continue;
      fora.push({ linha: linhaDe(txt, m.index), prop: m[1] + (m[2] || ''), valor: n,
                  papel: dentroDe(blocos, m.index, ehPrint), doc: emDocGerado(docs, m.index) });
    }
  }
  return { tela: fora.filter(x => !x.papel && !x.doc), papel: fora.filter(x => x.papel),
           docGerado: fora.filter(x => x.doc && !x.papel) };
}

// 3.3 COR CHUMBADA. `#hex` e `rgb()/rgba()` escritos na tela — inclusive vindos de JS, que é
// como cor à mão sobrevive a auditoria de folha de estilo (BASE 2.3).
// >>> `rgba(var(--azul-500-rgb),.55)` NÃO É COR CHUMBADA: é o token sendo usado na forma que o
//     próprio fpmed_tema.css publica para isso (`--azul-500-rgb: 44,169,224`). A primeira
//     versão contava esses 6 como defeito — mandaria eu "consertar" o uso CERTO do token.
function medeCor(txt, docs) {
  const limpo = semComentario(txt);
  const hex = [], rgb = [];
  let m;
  const reHex = /#[0-9a-fA-F]{3,8}\b/g;
  while ((m = reHex.exec(limpo)))
    hex.push({ linha: linhaDe(limpo, m.index), valor: m[0], doc: emDocGerado(docs, m.index) });
  const reRgb = /\brgba?\s*\(\s*([^)]*)/g;
  while ((m = reRgb.exec(limpo))) {
    if (/^var\(/.test(m[1].trim())) continue;           // token na forma rgba(var(--x-rgb),a)
    rgb.push({ linha: linhaDe(limpo, m.index), valor: 'rgb(' + m[1].trim().slice(0, 24),
               doc: emDocGerado(docs, m.index) });
  }
  return { hex: hex.filter(x => !x.doc), rgb: rgb.filter(x => !x.doc),
           docGerado: hex.filter(x => x.doc).concat(rgb.filter(x => x.doc)) };
}

// 3.4 ÍCONES. Emoji e pictograma escritos como TEXTO, e <img> de PNG no corpo da tela.
// O favicon do <head> NÃO é ícone de tela — sai em coluna própria em vez de ser excluído.
const RE_EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}\u{2900}-\u{297F}\u{FF01}-\u{FF60}]/gu;
function medeIcones(txt, docs) {
  const limpo = semComentario(txt);
  const emoji = [];
  let m;
  RE_EMOJI.lastIndex = 0;
  while ((m = RE_EMOJI.exec(limpo))) {
    // a seta tipográfica de navegação ("← Sistema") é caractere de texto, não pictograma:
    // ela entra em coluna própria, para o número não misturar duas coisas diferentes.
    const seta = /[\u{2190}-\u{21FF}\u{2900}-\u{297F}]/u.test(m[0]);
    emoji.push({ linha: linhaDe(limpo, m.index), valor: m[0], seta,
                 cod: 'U+' + m[0].codePointAt(0).toString(16).toUpperCase(),
                 doc: emDocGerado(docs, m.index) });
  }
  const png = [];
  const reImg = /<img\b[^>]*>/gi;
  while ((m = reImg.exec(limpo))) png.push({ linha: linhaDe(limpo, m.index), valor: m[0].slice(0, 70) });
  return { pictograma: emoji.filter(e => !e.seta && !e.doc), seta: emoji.filter(e => e.seta),
           docGerado: emoji.filter(e => e.doc && !e.seta), img: png };
}

// 3.5 ALVO DE TOQUE. Só olha DENTRO de `@media (max-width:480px)`: fora dali o alvo é o
// ponteiro e engordar estraga a densidade (BASE 2.6). Reprova dimensão < 44px declarada ali,
// e diz se a tela sequer TEM bloco de celular — tela sem bloco não tem alvo nenhum medido.
function medeToque(txt, blocos) {
  const celulares = blocos.filter(b => ehCelular(b.consulta));
  const curtos = [];
  for (const b of celulares) {
    const corpo = txt.slice(b.ini, b.fim);
    const re = /\b(min-height|height|min-width|width)\s*:\s*([\d.]+)px/gi;
    let m;
    while ((m = re.exec(corpo))) {
      const n = Number(m[2]);
      if (n >= ALVO_TOQUE) continue;
      // acha o SELETOR da regra: ele é o que vem ANTES do `{` desta regra, e depois do `}` (ou
      // do `{` do @media) que a fecha por cima.
      // >>> DEFEITO 8 DESTA RÉGUA, do mesmo bloco: a primeira versão fazia
      //     `max(lastIndexOf('}'), lastIndexOf('{'))` sobre o texto até o achado — e o `{`
      //     desta regra é SEMPRE o último, então o que ela chamava de "seletor" eram as
      //     DECLARAÇÕES da própria regra ("content:"";position:absolute;top:50%…"). Ela dizia
      //     que havia alvo curto sem dizer de quem, e nenhuma tela tinha bloco de celular pra
      //     que alguém percebesse. Régua que erra o endereço manda consertar o lugar errado —
      //     é o defeito 1 desta mesma régua, de novo, no outro eixo.
      //     >>> E ELA MORA NUM LUGAR SÓ (`seletorDe`, na seção 3.6): a mesma conta nasceu de novo
      //     no medidor de grade, e duas cópias de uma regra divergem — a que divergir vai ser
      //     justamente a que ninguém olha (BASE 2.3, uma fonte de verdade por fato).
      const sel = seletorDe(txt, b.ini + m.index);
      // >>> DEFEITO 7 DESTA RÉGUA, achado ao aplicar a receita da caixinha de marcar: ela
      //     contava o `::before` como alvo curto. PSEUDO-ELEMENTO NÃO É ALVO — ele não recebe
      //     clique nenhum; quem recebe é o elemento pai, e é o pai que tem os 44. A receita do
      //     molde é exatamente "alvo de 44 transparente + quadradinho de 18 desenhado no
      //     miolo": uma régua que conta o quadradinho reprova justamente quem obedeceu.
      if (/::?(before|after)\b/.test(sel)) continue;
      curtos.push({ linha: linhaDe(txt, b.ini + m.index), seletor: sel.slice(0, 60),
                    prop: m[1], valor: n });
    }
  }
  return { temBloco: celulares.length > 0, blocos: celulares.length, curtos };
}

// 3.6 VAZAMENTO HORIZONTAL — candidatos estáticos. NÃO é a medição do navegador: é a lista de
// PEÇAS DE LARGURA FIXA, que o molde nomeia como a causa quase sempre (regra 3). O que só a
// tela pintada responderia sai declarado no relatório, não convertido em número bonito.
//
// >>> DEFEITO 5 DESTA RÉGUA, achado ao aplicar a fatia na Negócios: `\bwidth` casa DENTRO de
//     `max-width`, porque o hífen é fronteira de palavra. E `max-width` é o CONTRÁRIO de peça
//     fixa — é o teto que faz a peça encolher. A régua listava `max-width:1420px` e a própria
//     condição `@media(max-width:900px)` como causa de vazamento: mandaria eu "consertar" a
//     peça que já obedece. Agora a propriedade tem de começar palavra, e a condição de @media
//     (o trecho entre `@media` e o `{`) sai da conta — condição não é peça.
// >>> DEFEITO 6, do mesmo bloco: ela contava dentro do `document.write()`. Os 4 relatórios da
//     Negócios abrem em janela própria, com a largura do papel — 4 das 18 "peças fixas" eram o
//     `max-width` do corpo do documento gerado. Vai para coluna própria, como o resto.
// >>> DEFEITO 9 DESTA RÉGUA, e é o MESMO defeito dos 5 e 7 pela terceira vez: ela contava a
//     CURA como se fosse a doença. As "9 grades rígidas" da Negócios eram, uma a uma:
//       · `repeat(auto-fit,minmax(190px,1fr))` — a grade que se dobra sozinha, que é exatamente
//         o conserto que o molde manda usar (3 delas);
//       · `minmax(0,1fr)` — o remédio nomeado do `min-width:auto` (2 delas);
//       · `.lem-novo` e `.cred-novo`, que JÁ TÊM `grid-template-columns:1fr` num
//         `@media(max-width:700px)` duas linhas abaixo (2 delas);
//       · e — o retrato do defeito — a PRÓPRIA linha de conserto `@media(max-width:760px)
//         {.ficha{grid-template-columns:96px 1fr}}`, contada como grade rígida nova.
//     A causa comum às três vezes: a régua perguntava *"tem px escrito aqui?"*, e todo conserto
//     de CSS se escreve com px. A pergunta certa é outra, e é a que a caixa faz:
//     **"o que está EM VIGOR quando a janela tem 390px?"**
//
//     Então esta seção passa a resolver a cascata: para cada propriedade de cada seletor, vale a
//     ÚLTIMA declaração que se aplica a 390px (fora de @media, ou dentro de um cujo teste passe
//     em 390). LIMITE DECLARADO: o seletor é comparado como TEXTO. `.ficha` e `.dw .ficha` são
//     dois seletores para esta régua, mesmo que o segundo vença o primeiro na tela real. O erro
//     que isso pode causar é sempre para MAIS (relatar peça que já obedece), nunca para menos —
//     e uma régua que erra para mais me faz olhar; uma que erra para menos me faz publicar
//     "está limpo".
function condicoesDeMedia(txt) {
  const zonas = [];
  const re = /@media([^{]*)\{/g;
  let m;
  while ((m = re.exec(txt))) zonas.push([m.index, re.lastIndex]);
  return zonas;
}
// A consulta de @media vale numa janela de 390px? `min-width:N` acima de 390 não vale;
// `max-width:N` abaixo de 390 não vale; `print` não é tela.
const LARGURA_TESTE = 390;
function valeEm390(consulta) {
  if (ehPrint(consulta)) return false;
  let m;
  const reMin = /min-width\s*:\s*([\d.]+)px/gi;
  while ((m = reMin.exec(consulta))) if (Number(m[1]) > LARGURA_TESTE) return false;
  const reMax = /max-width\s*:\s*([\d.]+)px/gi;
  while ((m = reMax.exec(consulta))) if (Number(m[1]) < LARGURA_TESTE) return false;
  return true;
}
const aplicaEm390 = (blocos, pos) =>
  blocos.filter(b => pos >= b.ini && pos < b.fim).every(b => valeEm390(b.consulta));

// O seletor da regra que contém `pos`: o texto entre o `}` (ou o `{` do @media) anterior e o
// `{` desta regra. Mesma lógica que o defeito 8 consertou no medidor de toque — e por isso ela
// mora aqui, num lugar só: duas cópias divergem, e a que divergir será a que ninguém olha.
// >>> DEFEITO 10, achado no MESMO minuto em que o 9 foi consertado, e é filho dele: entre o `}`
//     anterior e o `{` da regra mora, quase sempre, o COMENTÁRIO que explica a regra. A régua
//     estava chamando de seletor `"/* ── LEMBRETES ── */ .lem-novo"`. Com o comentário dentro da
//     chave, `#notif` da linha 194 e `#notif` do bloco do celular viravam DUAS peças diferentes,
//     e o conserto não recebia crédito do próprio conserto — a peça consertada continuava sendo
//     cobrada. Nesta casa o comentário é obrigatório (a lei do "porquê escrito"), então uma
//     régua que se confunde com comentário cobra mais de quem explica mais.
function seletorDe(txt, pos) {
  const antes = txt.slice(0, pos);
  const abre = antes.lastIndexOf('{');
  if (abre < 0) return '';
  const cabeca = antes.slice(0, abre);
  return cabeca.slice(Math.max(cabeca.lastIndexOf('}'), cabeca.lastIndexOf('{')) + 1)
               .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
               .trim().replace(/\s+/g, ' ');
}

/* QUANTO MEDE, NO MÍNIMO, CADA TRILHA DE UMA GRADE.
   `120px` mede 120. `minmax(90px,1fr)` mede 90. `minmax(0,...)` mede 0 — é o remédio. `1fr`,
   `auto`, `%` e `min-content` dependem do CONTEÚDO: aqui eles valem `null`, e null NÃO vira
   zero. `1fr` nasce com `min-width:auto`, ou seja, ele não encolhe abaixo do que tem dentro —
   é a armadilha que o molde nomeia, e ela não tem número no arquivo. Só a tela pintada tem. */
function pisoDaGrade(valor) {
  let v = valor.trim().replace(/\s+/g, ' ');
  // repeat(auto-fit|auto-fill, X) DOBRA SOZINHA: na janela estreita ela vira uma coluna só.
  v = v.replace(/repeat\(\s*auto-(?:fit|fill)\s*,\s*([^)]*\)?[^)]*)\)/gi, '$1');
  // repeat(3, X) é literal: vira X X X
  v = v.replace(/repeat\(\s*(\d+)\s*,\s*([^)]*\)?[^)]*)\)/gi,
                (t, n, x) => new Array(Number(n)).fill(x.trim()).join(' '));
  const trilhas = v.match(/minmax\([^)]*\)|[^\s]+/g) || [];
  let piso = 0, conteudo = 0;
  for (const t of trilhas) {
    const mm = /minmax\(\s*([^,]+),/i.exec(t);
    const alvo = mm ? mm[1].trim() : t;
    const px = /^([\d.]+)px$/i.exec(alvo);
    if (px) { piso += Number(px[1]); continue; }
    if (/^0$/.test(alvo)) continue;                 // minmax(0,…) — encolhe até sumir
    conteudo++;                                     // 1fr / auto / % — depende do conteúdo
  }
  return { piso, conteudo, trilhas: trilhas.length };
}

function medeLargura(txt, blocos, docs) {
  const cond = condicoesDeMedia(txt);
  const emCondicao = pos => cond.some(([a, b]) => pos >= a && pos < b);

  // ── PEÇA DE LARGURA FIXA. Vale a última declaração de `width`/`min-width` daquele seletor
  //    que esteja em vigor a 390px: `#notif{width:380px}` deixou de ser peça fixa no dia em que
  //    o bloco do celular passou a dizer `#notif{width:calc(100vw - …)}`, e continuar contando
  //    o 380 seria mandar consertar o que já foi consertado.
  const porChave = new Map();
  let m;
  const reW = /(^|[^\w-])(min-width|width)\s*:\s*([^;}"'`]+)/gi;
  while ((m = reW.exec(txt))) {
    const pos = m.index + m[1].length;
    if (emCondicao(pos)) continue;                  // condição de @media não é peça
    if (dentroDe(blocos, pos, ehPrint)) continue;   // papel tem largura de papel
    if (!aplicaEm390(blocos, pos)) continue;        // regra que não vale nesta janela
    const px = /^\s*([\d.]+)px\s*(!important)?\s*$/i.exec(m[3]);
    const chave = seletorDe(txt, pos) + ' ‖ ' + m[2].toLowerCase();
    porChave.set(chave, { linha: linhaDe(txt, pos), prop: m[2],
                          valor: px ? Number(px[1]) : null, doc: emDocGerado(docs, pos) });
  }
  const vigentes = [...porChave.values()].filter(x => x.valor !== null && x.valor > 360);
  const fixos = vigentes.filter(x => !x.doc);
  const docGerado = vigentes.filter(x => x.doc);

  // ── GRADE. Mesma cascata, e o julgamento passa a ser por MEDIDA e não por "tem px":
  //    ESTOURA  = a soma dos pisos fixos já não cabe em 390 com os respiros — é certeza.
  //    CANDIDATA = tem trilha fixa E trilha de conteúdo (`1fr`/`auto` sem `minmax(0,`), que
  //    nasce com `min-width:auto`. Isto é CANDIDATA, não veredito: quanto o conteúdo mede só a
  //    tela pintada responde, e converter isso em número seria o erro que a BASE proíbe.
  const porGrade = new Map();
  const reG = /grid-template-columns\s*:\s*([^;}"'`]+)/gi;
  while ((m = reG.exec(txt))) {
    if (emCondicao(m.index)) continue;
    if (dentroDe(blocos, m.index, ehPrint)) continue;
    if (!aplicaEm390(blocos, m.index)) continue;
    const p = pisoDaGrade(m[1]);
    porGrade.set(seletorDe(txt, m.index), {
      linha: linhaDe(txt, m.index), seletor: seletorDe(txt, m.index).slice(0, 46),
      valor: m[1].trim().slice(0, 46), piso: p.piso, conteudo: p.conteudo,
      doc: emDocGerado(docs, m.index) });
  }
  const CABE = 360;   // 390 menos os dois respiros da faixa
  const todas = [...porGrade.values()];
  const grades = todas.filter(g => !g.doc && g.piso > CABE);
  //    E `1fr 1fr 1fr` continua candidata mesmo com piso ZERO: é o exemplo que o próprio molde
  //    escreve ("três campos de data estouram sempre, por mais `fr` que se escreva"), porque o
  //    item de grade nasce `min-width:auto`. Sem esta linha o conserto do defeito 9 teria
  //    apagado um defeito verdadeiro junto com os oito falsos — que é exatamente o risco de
  //    consertar régua: ela emudece tão fácil quanto grita.
  const candidatas = todas.filter(g => !g.doc && g.piso <= CABE &&
                                  (g.conteudo >= 3 || (g.piso > 0 && g.conteudo > 0)));
  return { fixos, docGerado, grades, candidatas,
           gradesDoc: todas.filter(g => g.doc && g.piso > CABE) };
}

/* ── 4. O retrato ───────────────────────────────────────────────────────────────────────── */
function mede(arquivo) {
  const txt = fs.readFileSync(path.join(raiz, arquivo), 'utf8');
  const blocos = blocosDeMedia(txt);
  const docs = blocosDeDocGerado(txt);
  return {
    arquivo,
    bytes: txt.length,
    linhas: txt.split('\n').length,
    docsGerados: docs.length,
    carregaTema: /<link[^>]+fpmed_tema\.css/.test(txt),
    carregaSprite: /fpmed_icones\.js/.test(txt),
    texto: medeTexto(txt, blocos, docs),
    espaco: medeEspaco(txt, blocos, docs),
    cor: medeCor(txt, docs),
    icones: medeIcones(txt, docs),
    toque: medeToque(txt, blocos),
    largura: medeLargura(txt, blocos, docs),
  };
}

function imprime(r) {
  const n = a => a.length;
  console.log('\n══ ' + r.arquivo + '  (' + r.linhas + ' linhas)');
  console.log('   tema fpmed_tema.css: ' + (r.carregaTema ? 'SIM' : 'NAO') +
              ' · sprite fpmed_icones.js: ' + (r.carregaSprite ? 'SIM' : 'NAO'));
  console.log('   PISO 12px ....... ' + n(r.texto.tela) + ' abaixo do piso EM TELA' +
              ' (dos quais ' + r.texto.tela.filter(x => x.viaToken).length + ' por TOKEN)' +
              '   [papel: ' + n(r.texto.papel) + ' · doc gerado: ' + n(r.texto.docGerado) + ']');
  console.log('   GRADE DE 8 ...... ' + n(r.espaco.tela) + ' espacos fora da grade' +
              '   [papel: ' + n(r.espaco.papel) + ' · doc gerado: ' + n(r.espaco.docGerado) + ']');
  console.log('   COR CHUMBADA .... ' + n(r.cor.hex) + ' hex + ' + n(r.cor.rgb) + ' rgb()' +
              '   [doc gerado: ' + n(r.cor.docGerado) + ']');
  console.log('   ICONES .......... ' + n(r.icones.pictograma) + ' pictogramas + ' +
              n(r.icones.img) + ' <img>' + '   [setas: ' + n(r.icones.seta) +
              ' · doc gerado: ' + n(r.icones.docGerado) + ']');
  console.log('   TOQUE 44px ...... bloco de celular: ' + (r.toque.temBloco ? r.toque.blocos : 'NENHUM') +
              ' · ' + n(r.toque.curtos) + ' alvos curtos declarados');
  console.log('   LARGURA FIXA .... ' + n(r.largura.fixos) + ' pecas >360px em vigor a 390 + ' +
              n(r.largura.grades) + ' grades que ESTOURAM' +
              '   [candidatas: ' + n(r.largura.candidatas) +
              ' · doc gerado: ' + (n(r.largura.docGerado) + n(r.largura.gradesDoc)) + ']');
}

// só imprime quando é CHAMADA na linha de comando: exigido porque as suítes fazem
// require() dela para medir, e um relatório inteiro no meio da suíte esconde a falha.
if (require.main !== module) { module.exports = { mede, GRADE, PISO_TEXTO, ALVO_TOQUE, TELAS_DO_B }; return; }

const args = process.argv.slice(2);
const json = args.includes('--json');
const alvos = args.filter(a => !a.startsWith('--'));
const lista = alvos.length ? alvos : TELAS_DO_B;
const retrato = lista.map(mede);

if (json) {
  console.log(JSON.stringify(retrato, null, 1));
} else {
  console.log('RÉGUA VISUAL DO B — medição estática, repetível (o que só a tela pintada');
  console.log('responderia sai DECLARADO no relatório, não convertido em número).');
  retrato.forEach(imprime);
  const soma = (f) => retrato.reduce((a, r) => a + f(r), 0);
  console.log('\n── TOTAL DAS 4 TELAS ────────────────────────────────');
  console.log('   piso: ' + soma(r => r.texto.tela.length) + ' em tela  (papel: ' +
              soma(r => r.texto.papel.length) + ')');
  console.log('   grade: ' + soma(r => r.espaco.tela.length) + '  ·  cor: ' +
              soma(r => r.cor.hex.length + r.cor.rgb.length) + '  ·  icones: ' +
              soma(r => r.icones.pictograma.length + r.icones.img.length));
  console.log('   toque curto: ' + soma(r => r.toque.curtos.length) + '  ·  largura fixa: ' +
              soma(r => r.largura.fixos.length));
}
module.exports = { mede, GRADE, PISO_TEXTO, ALVO_TOQUE, TELAS_DO_B };
