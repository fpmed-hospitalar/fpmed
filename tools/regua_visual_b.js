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
      // acha o seletor da regra: o texto entre o `}` (ou `{` do media) anterior e o `{` desta
      const antes = corpo.slice(0, m.index);
      const corte = Math.max(antes.lastIndexOf('}'), antes.lastIndexOf('{'));
      const sel = antes.slice(corte + 1).split('{')[0].trim().replace(/\s+/g, ' ');
      curtos.push({ linha: linhaDe(txt, b.ini + m.index), seletor: sel.slice(0, 60),
                    prop: m[1], valor: n });
    }
  }
  return { temBloco: celulares.length > 0, blocos: celulares.length, curtos };
}

// 3.6 VAZAMENTO HORIZONTAL — candidatos estáticos. NÃO é a medição do navegador: é a lista de
// PEÇAS DE LARGURA FIXA, que o molde nomeia como a causa quase sempre (regra 3). O que só a
// tela pintada responderia sai declarado no relatório, não convertido em número bonito.
function medeLargura(txt, blocos) {
  const fixos = [];
  let m;
  const re = /\b(min-width|width)\s*:\s*([\d.]+)px/gi;
  while ((m = re.exec(txt))) {
    const n = Number(m[2]);
    if (n <= 360) continue;                                  // cabe em 390 com folga de margem
    if (dentroDe(blocos, m.index, ehPrint)) continue;        // papel tem largura de papel
    fixos.push({ linha: linhaDe(txt, m.index), prop: m[1], valor: n });
  }
  const grades = [];
  const reG = /grid-template-columns\s*:\s*([^;}"']+)/gi;
  while ((m = reG.exec(txt))) {
    const v = m[1].trim();
    // grade de coluna FIXA (px) ou de 3+ colunas sem minmax: item de grade nasce min-width:auto
    if (/\d+px/.test(v) || (!/minmax|auto-fit|auto-fill/.test(v) && (v.match(/fr/g) || []).length >= 3))
      grades.push({ linha: linhaDe(txt, m.index), valor: v.slice(0, 60) });
  }
  return { fixos, grades };
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
    largura: medeLargura(txt, blocos),
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
  console.log('   LARGURA FIXA .... ' + n(r.largura.fixos) + ' pecas >360px + ' +
              n(r.largura.grades) + ' grades rigidas');
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
