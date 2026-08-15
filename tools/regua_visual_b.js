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
// >>> DEFEITO 11 DESTA RÉGUA — O PIOR DE TODOS, PORQUE ELE ERA POR OMISSÃO E ATESTAVA SAÚDE.
//     A régua achava que "papel" é só o que está dentro de `@media print`. Na Proposta NÃO É: a
//     folha que vai para o hospital é a `.print-doc`, que fica `display:none` na tela e vira
//     `display:block` na impressão — ou seja, o CSS dela mora FORA do `@media print`, logo
//     abaixo do marcador de comentário PRINT.
//     O número que ela publicava era este: `[papel: 0]` na Proposta. Medido depois de enxergar
//     a região: dos 21 hex "da tela", 18 SÃO DO PAPEL; dos 58 furos de piso, 10 SÃO DO PAPEL
//     (o documento imprime em 9, 10 e 11px, e o piso de 12 vale para TELA — o próprio molde
//     declara o papel como a exceção). "papel: 0" não era atestado de limpeza: era a régua
//     dizendo que não enxergava a folha.
//     E o risco não era o número: eu ia rodar o aplicador do molde nesses 28 achados. O papel
//     está CONGELADO por ordem da caixa desde a B8, e a `tools/prova_papel_congelado.js`
//     compara as três regiões byte a byte — eu teria reescrito a folha que vai para o hospital
//     e derrubado a prova, com o estrago já no disco.
// >>> A FRONTEIRA É A MESMA DA PROVA, DE PROPÓSITO. Duas âncoras para o mesmo fato viram duas
//     verdades, e a que divergir vai ser justamente a que ninguém está olhando (BASE 2.3). Se a
//     prova mudar de recorte, esta régua e o aplicador mudam junto.
// SÃO AS TRÊS REGIÕES DA PROVA, e não só o CSS: a folha em si (o HTML do `print-doc`, onde mora
// o `<img>` do logo), o CSS de impressão e o `gerarPDF` que preenche a folha. Copiar duas das
// três teria deixado o logo do papel sendo cobrado como PNG solto na tela.
const ANCORAS_DO_PAPEL = [
  /<div class="print-doc" id="print-doc">[\s\S]*?\n<!-- MODAL MANUAL -->/,
  /\/\* PRINT \*\/[\s\S]*?<\/style>/,
  /function gerarPDF\(\)[\s\S]*?\n\}/,
];
function blocosDePapel(txt) {
  const achados = [];
  for (const re of ANCORAS_DO_PAPEL) {
    const m = re.exec(txt);
    if (m) achados.push({ consulta: 'print (papel congelado — ancora do prova_papel_congelado)',
                          ini: m.index, fim: m.index + m[0].length });
  }
  return achados;
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
/* >>> DEFEITO 13 — O QUE A RÉGUA NÃO ENXERGAVA, e foi o mais caro dos treze: ela apagava
   `/*…*​/` no ARQUIVO INTEIRO. Só que `/*` não é comentário em HTML. Na Proposta existe
   `accept="image/*,application/pdf"` — e aquele `/*` do `image/*` abriu um comentário falso que
   engoliu 288 LINHAS (20.530 chars, da 508 à 795), incluindo a abertura do `<script>` que
   carrega quase todo o JavaScript da tela.
   DUAS CONSEQUÊNCIAS:
     1. o defeito 12 não funcionava — a régua achava que aquele script não era script;
     2. e ela estava CALADA sobre 288 linhas da tela.
   >>> E AQUI EU ERREI, E O ERRO FICA ESCRITO PORQUE ELE ENSINA. Ao achar o buraco eu contei o
   que havia lá dentro — 4 hex (`#888`, `#000`), um 🔒 e um `<img>` — e escrevi neste mesmo
   comentário que eram "defeitos de verdade que ela nunca contou". NÃO ERAM. Consertada a
   fronteira, os cinco caíram na coluna certa sozinhos: `#888` e `#000` são o `print-obs` da
   FOLHA (linhas 732-736), o `<img>` é o LOGO do papel, e o 🔒 é um comentário de HTML avisando
   para não pôr coluna de fornecedor no PDF do cliente. Nenhum é defeito de tela; mexer neles
   seria justamente violar o congelamento.
   A lição não é "não era nada": é que enquanto ela estava cega ela também não podia me dizer
   que estava tudo bem ali. Cega, ela não sabia acusar NEM absolver. Eu contei antes de
   classificar, e contar sem classificar é o mesmo pecado das manchetes de régua ruim que a
   BASE registra — só que desta vez o erro era meu, e não dela.
   >>> O CONSERTO É DE FRONTEIRA, e não de expressão: `/*` só é comentário DENTRO de `<style>` e
   de `<script>`. Em HTML o comentário é `<!-- -->`, e um `/*` em atributo é conteúdo. As regiões
   saem do texto ORIGINAL, antes de qualquer apagamento — foi apagar primeiro e recortar depois
   que destruiu a fronteira. */
function semComentario(txt) {
  const branco = m => m.replace(/[^\n]/g, ' ');
  let saida = txt.replace(/<!--[\s\S]*?-->/g, branco);
  const troca = (re, limpa) => {
    let m;
    while ((m = re.exec(txt))) {
      const ini = m.index + m[0].indexOf(m[1]);
      saida = saida.slice(0, ini) + limpa(saida.substr(ini, m[1].length)) + saida.slice(ini + m[1].length);
    }
  };
  const semBloco = s => s.replace(/\/\*[\s\S]*?\*\//g, branco);
  troca(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, semBloco);
  // no <script> saem os dois: o de bloco e o de LINHA (defeito 12)
  troca(/<script\b[^>]*>([\s\S]*?)<\/script>/gi,
        s => semBloco(s).replace(/^([ \t]*)\/\/[^\n]*/gm,
                                 (l, id) => id + ' '.repeat(l.length - id.length)));
  return saida;
}

/* >>> DEFEITO 12 — E É A TERCEIRA VEZ QUE O COMENTÁRIO MORDE ESTA RÉGUA (depois do 1 e do 10).
   Ela apagava comentário de HTML e de bloco, e não o de LINHA (`//`). Medido na Proposta: os
   TRÊS hex "chumbados na tela" eram a linha que registra a medição de contraste que condenou
   essas mesmas três cores — `#22c55e 2,29:1 · #f59e0b 2,15:1 · #ef4444 3,76:1 sobre branco` —,
   e OITO dos onze pictogramas eram comentários descrevendo a tela ("o card marca ⚠️ via
   qtdEmbDiv", "botão 🚫 do card", "botão 🔍 Buscar"). A régua estava cobrando de mim o registro
   de por que aquelas cores saíram. Assert que só fica verde se eu apagar a explicação está
   contra a lei do porquê escrito — é o precedente do assert 15 do testa_tema_tela_propria, que
   esta mesma régua cita no bloco de cima e não estava cumprindo.

   >>> E ELE É PROPOSITALMENTE TÍMIDO, porque régua emudece tão fácil quanto grita:
   1. só dentro de `<script>` — `//` fora dali é `https://`, e apagar até o fim da linha comeria
      marcação de verdade;
   2. só quando o `//` ABRE a linha (depois de espaço). Comentário no fim de uma linha de código
      continua sendo lido, então um emoji plantado ali continua sendo cobrado.
   O erro que sobra é sempre para MAIS. Uma régua que erra para mais me faz olhar; uma que erra
   para menos me faz publicar "está limpo". (O apagamento em si mora no `semComentario` acima,
   junto com o do defeito 13 — os dois precisam da MESMA fronteira de `<script>`, e separá-los
   foi como o 12 nasceu quebrado.) */
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
// O PAPEL ENTRA AQUI PELO MESMO MOTIVO DO PISO (defeito 11): o documento congelado tem 18 hex
// escritos à mão, e eles NÃO são defeito de tela — a folha não carrega o tema, e mexer neles é
// justamente o que a caixa proíbe. Coluna própria: não se exclui, separa-se.
function medeCor(txt, blocos, docs) {
  const limpo = semComentario(txt);
  const hex = [], rgb = [];
  const onde = pos => emDocGerado(docs, pos) ? 'doc'
                    : dentroDe(blocos, pos, ehPrint) ? 'papel' : 'tela';
  let m;
  const reHex = /#[0-9a-fA-F]{3,8}\b/g;
  while ((m = reHex.exec(limpo)))
    hex.push({ linha: linhaDe(limpo, m.index), valor: m[0], onde: onde(m.index) });
  const reRgb = /\brgba?\s*\(\s*([^)]*)/g;
  while ((m = reRgb.exec(limpo))) {
    if (/^var\(/.test(m[1].trim())) continue;           // token na forma rgba(var(--x-rgb),a)
    rgb.push({ linha: linhaDe(limpo, m.index), valor: 'rgb(' + m[1].trim().slice(0, 24),
               onde: onde(m.index) });
  }
  const todos = hex.concat(rgb);
  return { hex: hex.filter(x => x.onde === 'tela'), rgb: rgb.filter(x => x.onde === 'tela'),
           papel: todos.filter(x => x.onde === 'papel'),
           docGerado: todos.filter(x => x.onde === 'doc') };
}

// 3.4 ÍCONES. Emoji e pictograma escritos como TEXTO, e <img> de PNG no corpo da tela.
// O favicon do <head> NÃO é ícone de tela — sai em coluna própria em vez de ser excluído.
const RE_EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}\u{2900}-\u{297F}\u{FF01}-\u{FF60}]/gu;
function medeIcones(txt, blocos, docs) {
  const limpo = semComentario(txt);
  const emoji = [];
  const onde = pos => emDocGerado(docs, pos) ? 'doc'
                    : dentroDe(blocos, pos, ehPrint) ? 'papel' : 'tela';
  let m;
  RE_EMOJI.lastIndex = 0;
  while ((m = RE_EMOJI.exec(limpo))) {
    // a seta tipográfica de navegação ("← Sistema") é caractere de texto, não pictograma:
    // ela entra em coluna própria, para o número não misturar duas coisas diferentes.
    // >>> E O MESMO VALE PARA O BLOCO DE LARGURA INTEIRA (U+FF01–FF60), onde mora o "＋" que a
    //     Proposta usava. ISSO EU APRENDI LEVANDO VERMELHO: a régua o chamou de pictograma, eu
    //     troquei por um SVG, e o assert 62 do testa_molde_proposta me derrubou — a casa já
    //     tinha decidido, com razão escrita, que sinal de mais em rótulo de botão é TIPOGRAFIA,
    //     "mesma fronteira das setas", e que desenhar um SVG para ele deixa a tela pior.
    //     Ele continua sendo achado, porque é defeito de verdade (largura CJK numa tela em
    //     português, que muda de desenho por fonte instalada) — mas o conserto dele é o
    //     caractere ASCII, e NÃO o sprite. Coluna própria é o que diz isso sem precisar de mim.
    const cp = m[0].codePointAt(0);
    const seta = /[\u{2190}-\u{21FF}\u{2900}-\u{297F}]/u.test(m[0]);
    const largo = cp >= 0xFF01 && cp <= 0xFF60;
    emoji.push({ linha: linhaDe(limpo, m.index), valor: m[0], seta, largo,
                 cod: 'U+' + cp.toString(16).toUpperCase(),
                 onde: onde(m.index) });
  }
  // >>> O `<img>` DO LOGO DA FOLHA (defeito 11 de novo): ele mora no HTML congelado do
  //     `print-doc`. Cobrá-lo como "PNG solto na tela" mandaria trocar por sprite o logo da
  //     proposta que vai para o hospital — a única imagem do sistema que É para ser imagem.
  const png = [], pngPapel = [];
  const reImg = /<img\b[^>]*>/gi;
  while ((m = reImg.exec(limpo)))
    (onde(m.index) === 'tela' ? png : pngPapel)
      .push({ linha: linhaDe(limpo, m.index), valor: m[0].slice(0, 70) });
  const desenho = e => !e.seta && !e.largo;
  return { pictograma: emoji.filter(e => desenho(e) && e.onde === 'tela'),
           seta: emoji.filter(e => e.seta),
           largura: emoji.filter(e => e.largo && e.onde === 'tela'), img: png,
           papel: emoji.filter(e => desenho(e) && e.onde === 'papel').concat(pngPapel),
           docGerado: emoji.filter(e => desenho(e) && e.onde === 'doc') };
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
  /* BOTÃO SÓ DE ÍCONE SEM ALVO DECLARADO — a conta que faltava, e ela nasceu de uma escolha da
     fatia B19 na Proposta. O alvo de 44 dos botões só de ícone é dado por uma CLASSE escrita à
     mão (`btn-ic`), e não por `button:has(> svg:only-child)`, porque `:has()` não existe em
     nenhum arquivo deste projeto e onde ele não for entendido o alvo some sem avisar.
     O preço de escrever à mão é o esquecimento: o próximo botão só de ícone nasce sem a classe
     e ninguém percebe. Então a régua conta os dois — quantos existem e quantos estão marcados —
     e a diferença é o que ficou sem alvo. Regra escolhida à mão precisa de quem conte à mão. */
  const soIcone = [], semMarca = [];
  const reB = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let b;
  while ((b = reB.exec(txt))) {
    const dentro = b[2].replace(/<svg[\s\S]*?<\/svg>/gi, '[SVG]')
                       .replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
    if (!/^(\[SVG\]|[^\w\s]{1,3})$/.test(dentro)) continue;   // tem palavra: o texto dá largura
    const achado = { linha: linhaDe(txt, b.index), trecho: b[0].slice(0, 60).replace(/\s+/g, ' ') };
    soIcone.push(achado);
    if (!/\bclass\s*=\s*["'][^"']*\bbtn-ic\b/.test(b[1])) semMarca.push(achado);
  }
  return { temBloco: celulares.length > 0, blocos: celulares.length, curtos,
           soIcone, semMarca };
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
  // o papel entra na MESMA lista dos @media: quem pergunta "estou no papel?" pergunta uma vez só
  const blocos = blocosDeMedia(txt).concat(blocosDePapel(txt));
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
    cor: medeCor(txt, blocos, docs),
    icones: medeIcones(txt, blocos, docs),
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
              '   [papel: ' + n(r.cor.papel) + ' · doc gerado: ' + n(r.cor.docGerado) + ']');
  console.log('   ICONES .......... ' + n(r.icones.pictograma) + ' pictogramas + ' +
              n(r.icones.img) + ' <img>' + '   [setas: ' + n(r.icones.seta) +
              ' · largura inteira: ' + n(r.icones.largura) +
              ' · papel: ' + n(r.icones.papel) +
              ' · doc gerado: ' + n(r.icones.docGerado) + ']');
  console.log('   TOQUE 44px ...... bloco de celular: ' + (r.toque.temBloco ? r.toque.blocos : 'NENHUM') +
              ' · ' + n(r.toque.curtos) + ' alvos curtos declarados' +
              ' · botao so-de-icone: ' + n(r.toque.soIcone) +
              ', dos quais ' + n(r.toque.semMarca) + ' SEM alvo');
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
