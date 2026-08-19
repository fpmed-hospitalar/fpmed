/* ════════════════════════════════════════════════════════════════════════════════════════════
   regua_visual.js — O INSTRUMENTO ÚNICO DAS 8 CATRACAS (fatia A28, 15/08/2026)

   ══ POR QUE UMA RÉGUA SÓ, E NÃO OITO ═══════════════════════════════════════════════════════
   Porque as oito catracas fazem a MESMA leitura de arquivo antes de julgar: onde começa um
   `@media print`, o que é comentário, o que é documento gerado em janela nova, quanto vale
   `--txt-1` em pixel. Oito cópias dessa leitura são oito chances de duas catracas discordarem
   sobre o mesmo arquivo — e no dia em que discordarem, a que estiver errada estará VERDE.
   Uma régua só, chamada oito vezes, não tem como discordar de si mesma.

   ══ ESTA RÉGUA NASCEU COM DÍVIDA PAGA: OS 8 DEFEITOS QUE O B JÁ ENCONTROU ═══════════════════
   A `tools/regua_visual_b.js` foi escrita pelo trabalhador B na fatia B19, porque as catracas
   ainda não existiam. Ele caçou OITO defeitos na régua dele, e cada um está preservado aqui,
   com o crédito, porque um defeito de régua só se paga uma vez:
     1. comentário apagado sem preservar quebra de linha → a régua apontava a LINHA ERRADA;
     2. `--txt-0` (10px) furava o piso por TOKEN, invisível para quem procura número;
     3. `rgba(var(--azul-500-rgb),.55)` NÃO é cor chumbada — é o token na forma publicada;
     4. `document.write('<!doctype…')` é OUTRO MEIO (janela sem o tema) → coluna própria;
     5. `\bwidth` casa dentro de `max-width`, que é o CONTRÁRIO de peça fixa;
     6. a condição do `@media(max-width:900px)` era contada como peça de largura fixa;
     7. `::before` não é alvo de toque — reprovar o quadradinho é reprovar quem obedeceu;
     8. o "seletor" do alvo curto era, na verdade, as declarações da própria regra.

   ══ A GRADE E O PISO SAEM DO TEMA, NÃO DAQUI ════════════════════════════════════════════════
   `fpmed_tema.css` é a fonte de verdade de espaço e de texto. Escrever a grade à mão neste
   arquivo criaria a SEGUNDA grade do sistema — e no dia em que o tema ganhasse um degrau, a
   catraca reprovaria o uso legítimo dele. Aqui a grade é LIDA dos `--esp-*` e a escala de texto
   dos `--txt-*`. Quem guarda o tema é a `tests/testa_tema.js` (assert 16 e 17: todo `--esp-*` é
   múltiplo de 4 e vale o número do passo × 4).

     node tools/regua_visual.js                  -> mede as telas adotadas
     node tools/regua_visual.js arquivo.html     -> mede um arquivo
     node tools/regua_visual.js --json           -> o retrato em JSON
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

const leia = arq => fs.readFileSync(path.join(RAIZ, arq), 'utf8').replace(/\r\n/g, '\n');

/* ── 0 · O TEMA, RESOLVIDO EM NÚMERO ────────────────────────────────────────────────────────
   Um `:root` só, lido uma vez. `TOKENS` guarda o valor cru de cada token (para a conta de
   contraste); `GRADE` e `ESCALA_TEXTO` são as duas leituras numéricas que as catracas usam. */
const CSS_TEMA = leia('fpmed_tema.css');
const TOKENS = (() => {
  const mapa = {};
  const semCom = CSS_TEMA.replace(/\/\*[\s\S]*?\*\//g, '');
  const raiz = (semCom.match(/:root\s*\{([\s\S]*?)\n\}/) || [, ''])[1];
  for (const m of raiz.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) mapa[m[1]] = m[2].trim();
  return mapa;
})();

// A grade de espaço: os degraus que o tema publica, mais o zero (que é ausência, não degrau).
const GRADE = [0].concat(
  Object.keys(TOKENS).filter(k => /^--esp-\d+$/.test(k))
    .map(k => parseFloat(TOKENS[k])).filter(isFinite)).sort((a, b) => a - b);

// A escala de texto, token → pixel. É por aqui que o piso furado POR TOKEN aparece.
const ESCALA_TEXTO = (() => {
  const mapa = {};
  for (const k of Object.keys(TOKENS)) {
    if (!/^--txt-\d+$/.test(k)) continue;
    const v = parseFloat(TOKENS[k]);
    if (isFinite(v)) mapa[k] = v;
  }
  return mapa;
})();

const PISO_TEXTO = 12;   // px em tela (BASE_VISUAL 2.1)
const ALVO_TOQUE = 44;   // px, largura E altura, só em @media (max-width:480px)

/* O DEGRAU ZERO É EXCEÇÃO DECLARADA DA CASA, e não um furo tolerado.
   O `fpmed_tema.css` publica `--txt-0: 10px` com o ofício escrito: "rótulo de GRUPO, caixa alta
   e espaçado — nada mais". A BASE_VISUAL manda piso de 12 com uma exceção só (@media print), e
   o molde da casa manda onde os dois discordam — mas a exceção do molde tem CONDIÇÃO, e é ela
   que esta régua cobra.

   >>> A CONDIÇÃO É O ESPAÇAMENTO LARGO, E NÃO O `text-transform`. Foi a primeira versão desta
       régua que cobrava `text-transform:uppercase`, e ela reprovou o "HOSPITALAR" da marca do
       menu — que está em caixa alta ESCRITA NO CONTEÚDO, não no CSS. Cobrar a propriedade em
       vez do fato manda consertar quem já obedece (o mesmo defeito de família que o B pagou
       duas vezes na régua dele). O que efetivamente torna a sigla curta legível a 10px é a
       LETRA ESPAÇADA, e ela é medível: os rótulos de grupo do menu usam .14em, a marca usa
       .22em, e nenhuma frase corrida do sistema passa de .08em. O corte fica em 0,1em.
   >>> DEFEITO 2 DESTA RÉGUA, que este bloco conserta: com a condição antiga, `--txt-0` numa
       frase corrida ficava reprovando (certo) mas o wordmark também (errado). */
const TOKEN_ROTULO_GRUPO = '--txt-0';
const ESPACAMENTO_ROTULO = 0.1;   // em — abaixo disso, 10px é frase pequena, não sigla espaçada

/* ── 1 · CONTEXTO: o que é papel, o que é celular, o que é outro documento ──────────────────*/
function blocosDeMedia(txt) {
  const blocos = [];
  for (const m of txt.matchAll(/@media([^{]*)\{/g)) {
    let i = m.index + m[0].length, prof = 1;
    while (i < txt.length && prof > 0) {
      if (txt[i] === '{') prof++; else if (txt[i] === '}') prof--;
      i++;
    }
    blocos.push({ consulta: m[1].trim(), ini: m.index, fim: i });
  }
  return blocos;
}
const dentroDe = (blocos, pos, teste) => blocos.some(b => pos >= b.ini && pos < b.fim && teste(b.consulta));
const ehPrint = q => /\bprint\b/.test(q);
const ehCelular = q => {
  const m = /max-width\s*:\s*(\d+)px/.exec(q);
  return !!m && Number(m[1]) <= 480;
};

/* DEFEITO 4 DO B: a tela que monta um relatório com `document.write('<!doctype html>…')` está
   escrevendo em OUTRA janela, que não carrega o fpmed_tema.css. Token ali não resolve. Não se
   exclui, separa-se (BASE_VISUAL 4.4): vira coluna própria no retrato. O recorte é automático
   — marcador escrito à mão seria uma porta para esconder defeito de tela aqui dentro. */
function blocosDeDocGerado(txt) {
  const blocos = [];
  for (const m of txt.matchAll(/\.write\s*\(\s*['"`]<!doctype/gi)) {
    const fim = txt.indexOf('</html>', m.index + m[0].length);
    blocos.push({ ini: m.index, fim: fim < 0 ? txt.length : fim + 7 });
  }
  return blocos;
}
const emDocGerado = (docs, pos) => docs.some(b => pos >= b.ini && pos < b.fim);

/* ── 1.b · A FRONTEIRA DO PAPEL ─────────────────────────────────────────────────────────────
   >>> DEFEITO 12 DESTA RÉGUA, medido pelo trabalhador B com número na fatia B19: ela entendia
       por "papel" só o que está dentro de `@media print`, e cobrou 36 defeitos do documento
       congelado da Proposta (18 hex + 7 espaços fora da grade + 11 tamanhos abaixo de 12px).
       Nenhum dos 36 é da tela: os 36 são a folha que sai impressa e vai para o hospital.

   ══ POR QUE `@media print` NÃO É A FRONTEIRA DO PAPEL ═══════════════════════════════════════
   Porque a folha que o hospital recebe não é a tela reformatada — é um documento PRÓPRIO, que
   existe escondido no HTML e só aparece na impressão:
       .print-doc{display:none; …}                 ← o CSS da folha, na folha de estilo normal
       @media print{ .print-doc{display:block!important} }
   O `@media print` guarda uma linha só (a que revela); as outras vinte e duas moram FORA dele,
   porque `display:none` já basta para a tela não ver nada. Ou seja: quanto MAIS bem feito for o
   documento impresso, MENOS dele cabe dentro do `@media print` — e mais a régua o cobrava.

   ══ E O CUSTO DISSO NÃO ERA UM NÚMERO FEIO NUM RELATÓRIO ════════════════════════════════════
   O B escreveu que quase rodou o aplicador do molde em cima destes 36. Se tivesse rodado, o
   aplicador teria trocado `#173A5E` por `var(--azul-700)` e `font-size:9px` por `var(--txt-1)`
   dentro da folha — num documento que é impresso SEM o `fpmed_tema.css` valendo para nada além
   da tela, com token que em papel resolve para o padrão do navegador. A régua não estaria
   errando um número: estaria mandando reescrever o PDF que o hospital assina.

   ══ COMO A RÉGUA RECONHECE O PAPEL — DEDUZIDO, NUNCA DECLARADO À MÃO ════════════════════════
   Marcador escrito à mão (um comentário dizendo "daqui pra baixo é papel") seria uma porta
   para esconder defeito de tela aqui
   dentro — é o mesmo motivo pelo qual o recorte do documento gerado em janela nova é automático
   (defeito 4 do B). Então a régua PERGUNTA AO PRÓPRIO CSS quem é papel, e a resposta tem forma:
       é raiz de papel o seletor que está ESCONDIDO na tela (`display:none` fora do print)
       e REVELADO no papel (`display:` qualquer-outra-coisa dentro de `@media print`).
   As duas metades juntas, e só juntas. Só escondido é menu fechado, aba inativa, card colapsado;
   só revelado no print é cabeçalho de impressão que também vive na tela. Escondido na tela E
   revelado no papel é uma coisa só no sistema inteiro: a folha.

   E a fronteira tem DUAS bordas, porque a folha tem duas metades:
     (a) o CSS — toda regra cujo seletor DESCENDE de uma raiz do papel;
     (b) a MARCAÇÃO — a subárvore do elemento que carrega a raiz (`<div class="print-doc">` até
         o `</div>` que o fecha), que é onde moram os `style=` embutidos da folha.
   Se a subárvore não fechar, a régua NÃO cria a região e declara o arquivo em `semFecho`. Errar
   para o lado de medir demais custa um falso defeito; errar para o lado de medir de menos custa
   a cegueira — e a cegueira já custou 287 linhas nesta mesma régua (defeito 11).

   >>> O QUE ESTA FRONTEIRA NÃO ALCANÇA, e sai DECLARADO em vez de virar exceção silenciosa: o
       JavaScript que ESCREVE dentro do papel. `const linhas = itens.map(…)` monta as linhas da
       tabela impressa vinte linhas antes de alguém fazer `getElementById('print-itens')
       .innerHTML = linhas`, e nenhuma leitura estática liga as duas pontas sem inventar. O que
       está lá continua contando como tela, com esta linha do lado. */
const RE_ABRE_TAG_VAZIA = /^(img|br|hr|input|meta|link|source|track|area|base|col|embed|param|wbr|use|path)$/i;

function raizesDePapel(limpo, blocos) {
  const escondidoNaTela = new Set(), reveladoNoPapel = new Set();
  for (const g of regrasCss(limpo)) {
    const sel = g.sel.trim().replace(/\s+/g, ' ');
    if (!ehSeletorCss(sel)) continue;
    const d = /(?:^|[;{\s])display\s*:\s*([a-z-]+)/i.exec(g.corpo);
    if (!d) continue;
    const noPrint = dentroDe(blocos, g.pos, ehPrint);
    for (const parte of sel.split(',')) {
      const p = parte.trim().replace(/\s*!important\s*$/i, '');
      if (!p) continue;
      if (noPrint) { if (d[1].toLowerCase() !== 'none') reveladoNoPapel.add(p); }
      else if (d[1].toLowerCase() === 'none') escondidoNaTela.add(p);
    }
  }
  return [...reveladoNoPapel].filter(s => escondidoNaTela.has(s));
}

// `.print-doc` alcança `.print-doc .doc-header` e NÃO alcança `.print-docx`: a fronteira do
// nome é um caractere que só pode vir depois do fim de um seletor.
const descendeDe = (sel, raiz) =>
  sel === raiz || (sel.startsWith(raiz) && /[\s.:#[>+~,]/.test(sel[raiz.length]));

// Só é papel a regra em que TODAS as partes da vírgula são papel. Uma regra compartilhada
// (`.print-doc td, .itens td`) pinta na tela também — e o lado seguro é continuar medindo.
const regraEhPapel = (sel, raizes) =>
  sel.split(',').map(s => s.trim()).filter(Boolean)
     .every(p => raizes.some(r => descendeDe(p, r)));

function subarvoreDe(limpo, pos) {
  const abre = /^<([a-zA-Z][\w-]*)/.exec(limpo.slice(pos, pos + 40));
  if (!abre) return null;
  const tag = abre[1];
  const fimAbre = limpo.indexOf('>', pos);
  if (fimAbre < 0) return null;
  if (RE_ABRE_TAG_VAZIA.test(tag) || limpo[fimAbre - 1] === '/') return { ini: pos, fim: fimAbre + 1 };
  const re = new RegExp('<(/?)' + tag + '(?=[\\s/>])', 'gi');
  re.lastIndex = pos;
  let prof = 0, m;
  while ((m = re.exec(limpo))) {
    if (m[1]) { if (--prof === 0) { const f = limpo.indexOf('>', m.index); return { ini: pos, fim: f < 0 ? null : f + 1 }; } }
    else prof++;
  }
  return { ini: pos, fim: null };   // não fechou — quem chama declara, não adivinha
}

function regioesDePapel(txt, blocos) {
  const limpo = limpoCss(txt);
  const raizes = raizesDePapel(limpo, blocos);
  const regioes = [], semFecho = [];
  if (!raizes.length) return { raizes, regioes, semFecho };
  // (a) o CSS da folha
  for (const g of regrasCss(limpo)) {
    const sel = g.sel.trim().replace(/\s+/g, ' ');
    if (!ehSeletorCss(sel) || !regraEhPapel(sel, raizes)) continue;
    regioes.push({ ini: g.pos, fim: g.pos + g.corpo.length + 2, via: 'css:' + sel });
  }
  // (b) a marcação da folha
  const semCom = semComentario(txt);
  for (const raiz of raizes) {
    const m0 = /^[.#]([A-Za-z0-9_-]+)$/.exec(raiz);
    if (!m0) continue;
    const nome = m0[1];
    const re = raiz[0] === '.'
      ? new RegExp('<[a-zA-Z][\\w-]*\\b[^>]*\\bclass\\s*=\\s*["\'][^"\']*\\b' + nome + '\\b[^"\']*["\'][^>]*>', 'g')
      : new RegExp('<[a-zA-Z][\\w-]*\\b[^>]*\\bid\\s*=\\s*["\']' + nome + '["\'][^>]*>', 'g');
    for (const m of semCom.matchAll(re)) {
      const sub = subarvoreDe(semCom, m.index);
      if (!sub || sub.fim === null) { semFecho.push({ linha: linhaDe(semCom, m.index), raiz }); continue; }
      regioes.push({ ini: sub.ini, fim: sub.fim, via: 'marcacao:' + raiz });
    }
  }
  return { raizes, regioes, semFecho };
}
const emPapel = (papel, blocos, pos) =>
  papel.regioes.some(b => pos >= b.ini && pos < b.fim) || dentroDe(blocos, pos, ehPrint);

/* DEFEITO 1 DO B: apagar comentário TEM de preservar as quebras de linha, senão a régua
   aponta o endereço errado e manda consertar o lugar errado.

   >>> DEFEITO 1 DESTA RÉGUA, achado no primeiro retrato: ela só apagava `/* *​/` e `<!-- -->`, e
       um `.html` desta casa é metade JavaScript — os comentários de `//` ficavam inteiros na
       conta. Duas "mentiras de R$ 0,00" do primeiro retrato eram COMENTÁRIOS explicando o bug
       do calibre French ("virava R$ 0,03 por sonda"). A régua estava acusando o registro do
       conserto de um defeito como se fosse o defeito.
   >>> E O RECORTE É ESTREITO DE PROPÓSITO: só apaga `//` que ABRE a linha (depois de espaço).
       `//` no meio da linha pode ser `https://`, `url(//…)` ou estar dentro de uma string — e
       apagar por engano deixaria a régua CEGA, que é o pior lado do erro: régua cega publica
       atestado de saúde. Comentário à direita do código continua contando; está declarado.

   >>> DEFEITO 11 DESTA RÉGUA, e ele é o IRMÃO DO 10: a régua não errou o número, ela PAROU DE
       OLHAR. O recorte estreito valia para o `//` e não valia para o `/*`, e a Proposta tem
           <input type="file" accept="image/*,application/pdf" …>
       O `/*` do curinga de MIME abriu um comentário que só fechou no fecha-bloco seguinte, 287
       linhas adiante — e com ele foram embora, da vista das OITO catracas, a `div.print-doc`
       inteira, o `img` do logotipo e toda a marcação da proposta. Na Documentos o mesmo
       `accept=".pdf,image/*"` cegou 33 linhas. Eram 320 linhas de marcação com atestado de
       saúde emitido por quem não olhou.
   >>> O CONSERTO É O MESMO RECORTE DO `//`, e é medido, não suposto: nos 10 arquivos que a
       régua mede há exatamente TRÊS `/*` colados em caractere que não é espaço, e os três são
       `image/*`. Nenhum comentário legítimo desta casa abre grudado numa letra — comentário
       nasce depois de espaço, de quebra de linha ou no começo do arquivo. Então o `/*` só abre
       comentário quando NADA ou ESPAÇO vem antes dele.
   >>> E ISTO NÃO É REGRA NOVA, é a mesma de sempre aplicada onde faltava: `//` no meio da linha
       pode ser `https://`; `/*` no meio da linha pode ser `image/*`. Os dois casos são a mesma
       frase — "barra no meio de um valor não é comentário". */
function semComentario(txt) {
  const branco = m => m.replace(/[^\n]/g, ' ');
  return txt.replace(/<!--[\s\S]*?-->/g, branco)
            .replace(/(?<![^\s])\/\*[\s\S]*?\*\//g, branco)
            .replace(/^([ \t]*)\/\/[^\n]*/gm, (m, esp) => esp + ' '.repeat(m.length - esp.length));
}
const linhaDe = (txt, pos) => txt.slice(0, pos).split('\n').length;

/* Acha o seletor da regra CSS que contém `pos`. DEFEITO 8 DO B: o `{` da própria regra é sempre
   o último antes do achado — então quem procura "o último `{` ou `}`" encontra as DECLARAÇÕES,
   não o seletor. Aqui recua para antes do `{` da regra e só então procura a fronteira. */
function seletorEm(txt, pos) {
  const antes = txt.slice(0, pos);
  const abre = antes.lastIndexOf('{');
  if (abre < 0) return '';
  const cabeca = antes.slice(0, abre);
  return cabeca.slice(Math.max(cabeca.lastIndexOf('}'), cabeca.lastIndexOf('{')) + 1)
    .trim().replace(/\s+/g, ' ').slice(0, 80);
}
// O corpo da regra que contém `pos` — usado para saber se o `--txt-0` está acompanhado da
// caixa alta e da letra espaçada que justificam o degrau zero.
function corpoDaRegraEm(txt, pos) {
  const abre = txt.lastIndexOf('{', pos);
  if (abre < 0) return '';
  let i = abre + 1, prof = 1;
  while (i < txt.length && prof > 0) {
    if (txt[i] === '{') prof++; else if (txt[i] === '}') prof--;
    i++;
  }
  return txt.slice(abre, i);
}

/* ── 2 · A CONTA DA WCAG ────────────────────────────────────────────────────────────────────
   Mesma fórmula da `tests/testa_tema.js`, e é de propósito que ela apareça aqui: aquela suíte
   mede a PALETA (o par de tokens existe e passa); esta régua mede o USO (a regra da tela põe
   este texto sobre aquele fundo). São duas perguntas diferentes sobre o mesmo número. */
const lum = hex => {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-f]{6,8}$/i.test(h)) return null;
  const c = [0, 2, 4].map(i => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
function contraste(a, b) {
  const x = lum(a), y = lum(b);
  if (x === null || y === null) return null;
  const [alto, baixo] = x >= y ? [x, y] : [y, x];
  return (alto + 0.05) / (baixo + 0.05);
}
/* Resolve `var(--token)` até o hex, inclusive quando um token aponta para outro. Devolve null
   quando não dá para resolver — e null NUNCA vira "passou": vai para a lista de não-medidos,
   que sai declarada. Contraste que não se conseguiu medir contado como aprovado é a mentira
   por omissão que a BASE proíbe. */
function resolveCor(valor, prof) {
  if (valor == null || prof > 6) return null;
  const v = String(valor).trim();
  const mv = /^var\(\s*(--[a-z0-9-]+)\s*(?:,([^)]*))?\)$/i.exec(v);
  if (mv) {
    if (TOKENS[mv[1]] !== undefined) return resolveCor(TOKENS[mv[1]], (prof || 0) + 1);
    return mv[2] ? resolveCor(mv[2], (prof || 0) + 1) : null;
  }
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v.length === 9 ? null : v;   // 8 dígitos = tem alfa
  return null;                                                          // rgba(), gradiente, etc.
}

/* ── 3 · AS OITO MEDIDAS ────────────────────────────────────────────────────────────────────*/

// 3.1 COR — hex e rgb() escritos na tela, inclusive vindos de JS (BASE_VISUAL 2.3).
/* >>> DEFEITO 13 DESTA RÉGUA, medido pelo B: o `:root` de uma ILHA DE TEMA DECLARADA é FONTE DE
       COR, exatamente como o `fpmed_tema.css` é para o resto do sistema — e a régua contava os
       17 hex da definição da ilha (a Documentos) como cor chumbada.

   ══ E A ILHA NÃO SE DECLARA POR COMENTÁRIO — ELA SE DECLARA POR CONTRATO ════════════════════
   O sinal é o `data-tema` no `<html>`, e ele não foi inventado para esta régua: é o MESMO
   atributo que o `limedtec-config.js` lê para não escrever cor nenhuma naquela tela, e que a
   `tests/testa_tema_tela_propria.js` guarda dos dois lados (asserts 1-3: com `data-tema`,
   nenhuma variável entra; assert 16: nenhuma tela clara se declara dona do tema por engano).
   Ou seja: a régua não passa a acreditar em quem diz "sou ilha" — ela lê a MESMA marca que já
   faz o sistema inteiro se comportar de outro jeito naquela tela, e que já tem catraca própria.

   ══ E ISTO É EXCEÇÃO ESTREITA, NÃO ANISTIA ══════════════════════════════════════════════════
   Vale só o que está DENTRO do bloco `:root{…}`. Hex escrito no meio de uma regra da ilha
   continua reprovando — e é bom que continue: o próprio B mediu que a Documentos tinha 23 hex
   + 7 rgba espalhados pelas regras e os levou todos para o `:root`. A exceção protege a fonte
   de cor; ela não protege quem redigita a cor no meio do caminho.
   >>> E NÃO SOME DA CONTA: vai para coluna própria (BASE_VISUAL 4.4 — não se exclui, separa-se). */
function raizesDeIlha(txt) {
  const limpo = semComentario(txt);
  if (!/<html\b[^>]*\sdata-tema\s*=\s*["'][^"']+["']/i.test(limpo)) return [];
  const blocos = [];
  for (const m of limpo.matchAll(/(?:^|[}\s;])(:root\b[^{]*)\{/g)) {
    let i = m.index + m[0].length, prof = 1;
    while (i < limpo.length && prof > 0) { if (limpo[i] === '{') prof++; else if (limpo[i] === '}') prof--; i++; }
    if (prof === 0) blocos.push({ ini: m.index, fim: i });
  }
  return blocos;
}
const emIlha = (ilhas, pos) => ilhas.some(b => pos >= b.ini && pos < b.fim);

function medeCor(txt, docs, papel, blocos, ilhas) {
  const limpo = semComentario(txt);
  const fora = [], doc = [], folha = [], fonteIlha = [];
  const guarda = (pos, a) => (emDocGerado(docs, pos) ? doc
    : emIlha(ilhas, pos) ? fonteIlha
    : emPapel(papel, blocos, pos) ? folha : fora).push(a);
  for (const m of limpo.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    guarda(m.index, { linha: linhaDe(limpo, m.index), valor: m[0], tipo: 'hex' });
  }
  // DEFEITO 3 DO B: `rgba(var(--azul-500-rgb),.55)` é o token na forma que o próprio tema
  // publica para compor alfa. Contá-lo mandaria consertar o uso CERTO do token.
  for (const m of limpo.matchAll(/\brgba?\s*\(\s*([^)]*)/g)) {
    if (/^var\(/.test(m[1].trim())) continue;
    guarda(m.index, { linha: linhaDe(limpo, m.index), valor: 'rgb(' + m[1].trim().slice(0, 28), tipo: 'rgb' });
  }
  return { tela: fora, docGerado: doc, papel: folha, fonteIlha };
}

// 3.2 ESPAÇO — só propriedade de ESPAÇO. Largura/altura/posição não são espaço e entrariam de
// carona inflando o número (a régua tem de contar o que diz que conta).
function medeEspaco(txt, blocos, docs, regPapel) {
  const tela = [], papel = [], doc = [];
  const limpo = semComentario(txt);
  for (const m of limpo.matchAll(/\b(padding|margin|gap|row-gap|column-gap)(-top|-right|-bottom|-left)?\s*:\s*([^;}"'\n]+)/gi)) {
    for (const v of (m[3].match(/-?[\d.]+px/g) || [])) {
      const n = Math.abs(parseFloat(v));
      if (GRADE.includes(n)) continue;
      const a = { linha: linhaDe(limpo, m.index), prop: m[1] + (m[2] || ''), valor: n };
      (emDocGerado(docs, m.index) ? doc : emPapel(regPapel, blocos, m.index) ? papel : tela).push(a);
    }
  }
  return { tela, papel, docGerado: doc };
}

// 3.3 PISO DE TEXTO — pixel cru e token abaixo do piso. DEFEITO 2 DO B.
function medeTextoPiso(txt, blocos, docs, regPapel) {
  const tela = [], papel = [], doc = [], rotuloGrupo = [];
  const limpo = semComentario(txt);
  const guarda = (pos, valor, trecho, viaToken) => {
    const a = { linha: linhaDe(limpo, pos), valor, trecho: trecho.slice(0, 50), viaToken: !!viaToken,
                seletor: seletorEm(limpo, pos) };
    (emDocGerado(docs, pos) ? doc : emPapel(regPapel, blocos, pos) ? papel : tela).push(a);
  };
  for (const m of limpo.matchAll(/font-size\s*:\s*([\d.]+)px/gi)) {
    if (parseFloat(m[1]) < PISO_TEXTO) guarda(m.index, parseFloat(m[1]), m[0], false);
  }
  for (const m of limpo.matchAll(/font-size\s*:\s*var\(\s*(--txt-[a-z0-9-]+)/gi)) {
    const v = ESCALA_TEXTO[m[1]];
    if (v === undefined || v >= PISO_TEXTO) continue;
    if (m[1] === TOKEN_ROTULO_GRUPO) {
      // A exceção declarada só vale ACOMPANHADA: letra espaçada de verdade, na mesma regra.
      const corpo = corpoDaRegraEm(limpo, m.index);
      const ls = /letter-spacing\s*:\s*([\d.]+)em/i.exec(corpo);
      if (ls && parseFloat(ls[1]) >= ESPACAMENTO_ROTULO) {
        rotuloGrupo.push({ linha: linhaDe(limpo, m.index), seletor: seletorEm(limpo, m.index),
                           espacamento: parseFloat(ls[1]) });
        continue;
      }
    }
    guarda(m.index, v, m[0], true);
  }
  return { tela, papel, docGerado: doc, rotuloGrupo };
}

// 3.4 ÍCONES — pictograma escrito como texto e <img> no corpo. A seta tipográfica de texto
// corrido ("← Sistema") tem coluna própria: ela é caractere, não desenho de botão.
const RE_PICTO = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}\u{2900}-\u{297F}\u{FF01}-\u{FF60}\u{2716}\u{2715}\u{2717}\u{2718}\u{2726}\u{2727}\u{2605}\u{2606}]/gu;
const RE_SETA = /[\u{2190}-\u{21FF}\u{2900}-\u{297F}]/u;
/* >>> E O PAPEL TEM COLUNA PRÓPRIA AQUI TAMBÉM, pelo mesmo motivo do documento gerado em janela
       nova: o `<img>` do papel é o LOGOTIPO da empresa impresso no cabeçalho da proposta, e o
       sprite é um `<symbol>` de linha única com `currentColor` — ele é ícone de interface, não
       marca. Trocar o logotipo do documento que o hospital assina por um pictograma do sprite
       seria a régua mandando descaracterizar a papelada da empresa. Ele não some: sai contado. */
function medeIcones(txt, docs, papel, blocos) {
  const limpo = semComentario(txt);
  const picto = [], seta = [], doc = [], folha = [];
  RE_PICTO.lastIndex = 0;
  for (const m of limpo.matchAll(RE_PICTO)) {
    const a = { linha: linhaDe(limpo, m.index), valor: m[0],
                cod: 'U+' + m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0') };
    if (RE_SETA.test(m[0])) seta.push(a);
    else if (emDocGerado(docs, m.index)) doc.push(a);
    else if (emPapel(papel, blocos, m.index)) folha.push(a);
    else picto.push(a);
  }
  const img = [], imgPapel = [];
  for (const m of limpo.matchAll(/<img\b[^>]*>/gi)) {
    if (/rel=|favicon/i.test(m[0])) continue;
    (emPapel(papel, blocos, m.index) ? imgPapel : img)
      .push({ linha: linhaDe(limpo, m.index), valor: m[0].slice(0, 70) });
  }
  return { pictograma: picto, seta, docGerado: doc, papel: folha, img, imgPapel };
}

// 3.5 TOQUE — só dentro de @media (max-width:480px). DEFEITOS 7 e 8 DO B.
// Mede também `min-height` em elemento INLINE, que não faz nada (`<a>` precisa de inline-flex):
// alvo que o CSS promete e o navegador não entrega é pior que alvo curto declarado.
function medeToque(txt, blocos) {
  const limpo = semComentario(txt);
  const celulares = blocos.filter(b => ehCelular(b.consulta));
  const curtos = [], promessaVazia = [];
  for (const b of celulares) {
    const corpo = limpo.slice(b.ini, b.fim);
    for (const m of corpo.matchAll(/\b(min-height|height|min-width|width)\s*:\s*([\d.]+)px/gi)) {
      const n = parseFloat(m[2]);
      const sel = seletorEm(corpo, m.index);
      if (/::?(before|after)\b/.test(sel)) continue;              // pseudo-elemento não é alvo
      /* >>> DEFEITO 6 DESTA RÉGUA, achado aplicando a própria fatia: ela contou o `svg` DENTRO do
             botão como alvo curto. `.chip-f button svg{width:15px}` é o DESENHO; o alvo é o
             botão que o contém, e ele tem os 44. É literalmente o defeito 7 do B (o `::before`
             da caixinha) com outra roupa: régua que conta a peça de dentro reprova justamente
             quem seguiu a receita — "o dedo ganha a área, o olho vê o que via" só é possível se
             a peça de dentro CONTINUAR pequena. */
      if (/\bsvg\b\s*$|\bsvg\b\s*[,{]/.test(sel) || /(^|[\s>+~])(ic|icone)\b\s*$/.test(sel)) continue;
      if (n >= ALVO_TOQUE) continue;
      curtos.push({ linha: linhaDe(limpo, b.ini + m.index), seletor: sel, prop: m[1], valor: n });
    }
    for (const m of corpo.matchAll(/\bmin-height\s*:\s*([\d.]+)px/gi)) {
      const regra = corpoDaRegraEm(corpo, m.index);
      const sel = seletorEm(corpo, m.index);
      if (/::?(before|after)\b/.test(sel)) continue;
      if (/display\s*:\s*(inline-flex|flex|block|inline-block|grid|inline-grid)/i.test(regra)) continue;
      // <a>/<span> sem display declarado é inline: min-height não pinta nada.
      if (/^\s*(a|span|label)[.\s:[]/i.test(sel) || /(^|[\s,>])(a|span)([.:\[]|$)/i.test(sel))
        promessaVazia.push({ linha: linhaDe(limpo, b.ini + m.index), seletor: sel, valor: parseFloat(m[1]) });
    }
  }
  return { temBloco: celulares.length > 0, blocos: celulares.length, curtos, promessaVazia };
}

/* 3.6 CONTRASTE DO USO — o par que a REGRA DA TELA monta.
   A `testa_tema` mede a paleta; aqui se mede o que a tela faz com ela. Uma regra que declara
   `color` e `background` juntos é um par afirmado pelo autor, e é ele que o olho vê.

   ══ AS TRÊS RÉGUAS, E POR QUE UMA SÓ ESTAVA ERRADA ═════════════════════════════════════════
   O primeiro retrato desta régua acusou 6 reprovações. QUATRO DELAS NÃO ERAM DEFEITO — eram a
   régua cobrando o número errado, que é o defeito que a BASE chama de "régua antes do número":

   >>> DEFEITO 3 DESTA RÉGUA — ÍCONE NÃO É TEXTO. `.ind--bom .ic` deu 3,28:1 e foi reprovado
       contra 4,5. Mas ali não há letra nenhuma: é o `currentColor` de um `<svg>`. A régua do
       elemento NÃO-TEXTUAL é 3:1 (WCAG 1.4.11, e a BASE_VISUAL 2.3 repete). 3,28 PASSA. Reprovar
       ícone por 4,5 obrigaria a escurecer o verde do indicador sem nenhum ganho de leitura.
   >>> DEFEITO 4 DESTA RÉGUA — COMPONENTE DESLIGADO NÃO TEM MÍNIMO. Três reprovações eram
       `[disabled]` (campo, botão do tema, botão da tela): cinza-400 sobre cinza-100 = 2,63:1. A
       WCAG 1.4.3 isenta explicitamente texto de componente inativo, e a razão é de PRODUTO, não
       de norma: botão desligado precisa PARECER desligado. "Consertar" isso escurecendo o texto
       apagaria a única pista de que o botão não funciona — a régua estaria mandando criar o
       "botão que não faz nada" que a BASE_ENGENHARIA lista como denúncia de sistema amador.
   >>> E NENHUM DOS DOIS SOME DA CONTA: cada um vai para coluna própria, com o número do lado
       (BASE_VISUAL 4.4 — não se exclui, separa-se). No dia em que alguém puser texto de verdade
       num seletor `.ic`, ele aparece na coluna de não-texto com a razão medida.

   >>> O QUE ESTA CONTA NÃO ALCANÇA, e sai DECLARADO em vez de virar número bonito: par montado
       por herança (texto numa regra, fundo no pai) e par montado em tempo de execução por JS.
       Só a tela pintada responde esses — e eu não logo. */
/* A LISTA É CURTA DE PROPÓSITO, e só entra nela o que EXISTE hoje nos arquivos medidos.
   Nome especulativo aqui ("marcador", "pino", "bolinha") é uma porta aberta: no dia em que
   alguém criar um `.marcador` com texto dentro, ele passaria a ser cobrado por 3:1 sem
   ninguém decidir isso. E a condição dupla também guarda: só é não-texto o seletor da lista
   QUE NÃO DECLARA `font-size` — quem declara tamanho de letra está carregando letra. */
const RE_NAO_TEXTO = /(^|[\s>+~,.#])(ic|icone|barra|trilho|fio)\b|\bsvg\b|::(before|after)\b/i;
const RE_DESLIGADO = /\[disabled\]|:disabled|\[aria-disabled=|\.desligado\b|\.off\b/i;
function medeContraste(txt, blocos, docs) {
  const limpo = limpoCss(txt);
  const pares = [], naoMedidos = [], naoTexto = [], desligados = [];
  for (const g of regrasCss(limpo)) {
    const corpo = g.corpo;
    if (emDocGerado(docs, g.pos)) continue;
    if (!ehSeletorCss(g.sel)) continue;
    const fg = (/(?:^|[;{\s])color\s*:\s*([^;}]+)/i.exec(corpo) || [])[1];
    const bg = (/(?:^|[;{\s])background(?:-color)?\s*:\s*([^;}]+)/i.exec(corpo) || [])[1];
    if (!fg || !bg) continue;
    const sel = g.sel.trim().replace(/\s+/g, ' ');
    const hf = resolveCor(fg.trim()), hb = resolveCor((bg.trim().match(/(var\([^)]*\)|#[0-9a-f]{3,8})/i) || [])[0]);
    if (!hf || !hb) { naoMedidos.push({ linha: linhaDe(limpo, g.pos), seletor: sel, cor: fg.trim().slice(0, 28), fundo: bg.trim().slice(0, 28) }); continue; }
    const r = contraste(hf, hb);
    if (r === null) { naoMedidos.push({ linha: linhaDe(limpo, g.pos), seletor: sel, cor: hf, fundo: hb }); continue; }
    const base = { linha: linhaDe(limpo, g.pos), seletor: sel, cor: hf, fundo: hb, razao: Math.round(r * 100) / 100 };
    if (RE_DESLIGADO.test(sel)) { desligados.push(base); continue; }
    // Texto grande (>=24px, ou >=18.5px em negrito) tem régua de 3:1 (WCAG 1.4.3);
    // elemento não-textual, idem (1.4.11).
    const tam = tamanhoDaRegra(corpo);
    const negrito = /font-weight\s*:\s*(700|800|900|bold|var\(--peso-forte\))/i.test(corpo);
    const semTexto = RE_NAO_TEXTO.test(sel) && !/font-size/i.test(corpo);
    const minimo = (semTexto || tam >= 24 || (tam >= 18.5 && negrito)) ? 3 : 4.5;
    const reg = { ...base, minimo, passa: r >= minimo, papel: dentroDe(blocos, g.pos, ehPrint) };
    (semTexto ? naoTexto : pares).push(reg);
  }
  const todos = pares.concat(naoTexto);
  return { pares: pares.filter(p => !p.papel), naoTexto, desligados,
           papel: pares.filter(p => p.papel), naoMedidos,
           reprovados: todos.filter(p => !p.papel && !p.passa) };
}
function tamanhoDaRegra(corpo) {
  const px = /font-size\s*:\s*([\d.]+)px/i.exec(corpo);
  if (px) return parseFloat(px[1]);
  const tk = /font-size\s*:\s*var\(\s*(--txt-[a-z0-9-]+)/i.exec(corpo);
  if (tk && ESCALA_TEXTO[tk[1]] !== undefined) return ESCALA_TEXTO[tk[1]];
  return 14;   // o corpo padrão do sistema
}

/* 3.7 TABELA DENSA — as quatro regras que a BASE_VISUAL 2.5 fecha e que dá para medir no
   arquivo: cabeçalho fixo · número à direita com dígito tabular · fio de 1px em vez de zebra ·
   altura de linha nas DUAS densidades (40 compacta / 48 confortável), e só nelas.
   >>> A régua só julga arquivo que TEM tabela. Cobrar cabeçalho fixo de uma tela sem `<table>`
       é a catraca inventando defeito para ter o que dizer. */
const ALTURAS_LINHA = [40, 48];

/* >>> DEFEITO 8 DESTA RÉGUA, e ele apareceu no MESMO conserto do defeito 7: um `.html` desta
       casa é metade JavaScript, e `{...}` existe em toda função. Procurar "texto com `th` antes
       de uma chave" achava `'<table class="det-tab2"><thead>' + … {` e chamava de SELETOR meia
       função de 40 linhas — a catraca cuspiu um parágrafo de código como se fosse o nome de uma
       tabela. Um seletor CSS tem forma: começa por letra, `.`, `#`, `[` ou `*`, não tem aspas,
       ponto-e-vírgula e `+` de concatenação, e é curto. Régua que não sabe reconhecer o que
       está lendo dá endereço de coisa nenhuma.
   >>> E ELE NASCEU ERRADO NA PRIMEIRA VERSÃO: recusava quebra de linha, e num arquivo CSS o
       texto entre o `}` de uma regra e o seletor da seguinte SEMPRE tem quebra de linha. Ele
       reprovou o `.det-tab2 thead th` que obedecia e deixou passar o `.itens th` que não. Régua
       que erra o endereço manda consertar o lugar errado — de novo. Agora ele NORMALIZA antes de
       julgar, e a defesa contra o JavaScript fica por conta do que sobrou: aspas, ponto-e-vírgula,
       o `+` de concatenação e o teto de 80 caracteres. */
const ehSeletorCss = bruto => {
  // a aspa de ABERTURA do primeiro pedaço de um CSS-em-JavaScript é costura, não seletor;
  // aspa NO MEIO continua reprovando, que é o que separa CSS de código.
  const s = bruto.trim().replace(/^['"`]+/, '').trim().replace(/\s+/g, ' ');
  return s.length > 0 && s.length <= 80 && !/["'`;+]/.test(s) && /^[a-zA-Z.#*[:]/.test(s);
};

/* ══ O CSS QUE MORA DENTRO DE UM ARRAY DE STRINGS ════════════════════════════════════════════
   >>> DEFEITO 10 DESTA RÉGUA, e ele CEGOU uma catraca inteira por dez minutos. O
       `limedtec-menu.js` monta a folha de estilo dele como um array de linhas:
           '#limedtec-menu .lm-cruz{width:26px;…',
           '  background:var(--azul-600);color:var(--branco);…',
       O leitor de regras novo, com a guarda contra JavaScript, passou a recusar TODAS elas —
       porque cada linha começa com aspa. Resultado: a catraca de contraste deixou de medir o
       menu inteiro e ficou verde. Ela não passou a errar: ela parou de olhar, que é pior,
       porque verde de quem não olhou é indistinguível de verde de quem conferiu.
       (Foi a MUTAÇÃO que pegou: a catraca não ficou vermelha quando eu quebrei o menu de
       propósito. É literalmente para isto que a mutação existe.)
   O conserto apaga só a COSTURA entre dois pedaços de texto colados (`',` + nova linha + `'` e
   `' +` + nova linha + `'`), preservando as quebras de linha — endereço errado é o defeito que
   esta régua mais pagou, e ele não vai voltar por causa de um conserto. */
/* >>> E ELE TAMBÉM NASCEU CURTO: a primeira versão aceitava UMA quebra de linha entre os dois
       pedaços, e o `.lm-cruz` do menu tem um comentário de dez linhas antes dele. Comentário já
       virou espaço em branco quando este trecho roda — mas as quebras de linha ficam (de
       propósito, para o endereço não escorregar), e duas quebras já não casavam. A costura
       aceita qualquer espaço em branco entre a vírgula e a aspa seguinte. */
function costuraStringJs(txt) {
  return txt.replace(/(['"`])[ \t]*[,+]\s*\1/g, m => m.replace(/[^\n]/g, ' '));
}
const limpoCss = txt => costuraStringJs(semComentario(txt));

/* ══ COMO SE LÊ UMA REGRA, E AS DUAS TENTATIVAS QUE DERAM ERRADO ═════════════════════════════
   >>> DEFEITO 9: a primeira tentativa casava `(^|[};]) seletor { corpo }` — e ela CONSOME o `}`
       que fecha a regra, que é justamente o delimitador de que a regra SEGUINTE precisa. Lia uma
       sim, uma não. Aprovou o `.itens th` (sem cabeçalho fixo) e reprovou o `.det-tab2 thead th`
       (com), na mesma passada: veredito CONTRÁRIO em metade dos casos.
   >>> DEFEITO 10: a segunda tentativa foi um leitor que percorria o arquivo achando cada `{`.
       Num `.css` funciona; num `.js` de 560 linhas, cada `function(){}` e cada `if(){}` viram
       fronteira de regra, e o rastreamento do seletor se perde. Ele deixou de enxergar o
       `.lm-cruz` do menu — e a catraca de contraste ficou VERDE por ter parado de olhar, que é
       pior que ficar errada: verde de quem não olhou é indistinguível de verde de quem conferiu.
       (A MUTAÇÃO pegou os dois. É literalmente para isto que ela existe.)
   >>> O QUE FUNCIONA é a varredura pelo BLOCO MAIS INTERNO (`{` sem `{` dentro): ela não depende
       de delimitador nenhum e não tenta rastrear estado ao longo do arquivo. Cada bloco é
       julgado por si — o seletor é procurado para trás, e a guarda `ehSeletorCss` descarta o que
       for JavaScript. Errar aqui custa um bloco, e não a metade do arquivo. */
function* regrasCss(txt) {
  for (const m of txt.matchAll(/\{[^{}]*\}/g))
    yield { sel: seletorEm(txt, m.index + 1), corpo: m[0].slice(1, -1), pos: m.index };
}

/* >>> E O PAPEL SAI INTEIRO DESTA MEDIDA, e a razão não é tolerância — é que as QUATRO regras
       da tabela densa são regras de TELA, e nenhuma delas quer dizer coisa alguma numa folha
       impressa. `position:sticky` num cabeçalho de papel não gruda em nada: papel não rola. A
       zebra "briga com o hover" numa folha que não tem hover. E 40/48px são as densidades da
       INTERFACE — a tabela impressa aperta a linha de propósito, para caber na página que o
       hospital arquiva. Cobrar as quatro do documento congelado seria a régua reprovando o
       papel por não ser tela, que é o mesmo defeito de família do `::before` (defeito 7 do B) e
       do `svg` dentro do botão (defeito 6 desta régua): cobrar de quem já obedeceu, com o
       número certo tirado da régua errada. */
function medeTabelaDensa(txt, docs, blocos, regPapel) {
  const limpo = limpoCss(txt);
  const naFolha = pos => emPapel(regPapel, blocos, pos);
  // a tabela da folha não conta como "esta tela tem tabela": ela não é da tela.
  const tabelasVisiveis = [...limpo.matchAll(/<table\b|<thead\b|role\s*=\s*["']table["']/gi)]
    .filter(m => !naFolha(m.index));
  const tabelasNoPapel = [...limpo.matchAll(/<table\b/gi)].filter(m => naFolha(m.index)).length;
  const temTabela = tabelasVisiveis.length > 0;
  if (!temTabela) return { temTabela: false, tabelasNoPapel, defeitos: [] };
  const defeitos = [];
  /* (a) CABEÇALHO FIXO — POR TABELA, e não "alguma tabela".
     >>> DEFEITO 7 DESTA RÉGUA, e ele foi achado pela MUTAÇÃO, que é exatamente para isso que ela
         existe. A primeira versão perguntava "alguma regra de `th` declara sticky?" e ficava
         verde. A Encontrar tem TRÊS tabelas (`.det-tab2`, `.det-tab`, `.itens`) e só uma
         obedecia: a catraca estava aprovando duas tabelas sem cabeçalho fixo porque a terceira
         tinha. Regra que se satisfaz com um exemplo não é regra, é amostra.
     A tabela é identificada pelo que vem ANTES do `th` no seletor — `.det-tab2 thead th` e
     `.det-tab2 thead th.num` são a mesma tabela; `.itens th` é outra. */
  const porTabela = new Map();
  for (const g of regrasCss(limpo)) {
    if (emDocGerado(docs, g.pos) || naFolha(g.pos)) continue;
    if (!ehSeletorCss(g.sel)) continue;
    if (!/:/.test(g.corpo)) continue;                       // corpo sem declaração não é regra
    const selCru = g.sel.trim().replace(/\s+/g, ' ');
    // cada seletor da vírgula é uma tabela possível; só os que apontam `th` entram
    for (const parte of selCru.split(',')) {
      if (!/\bth\b/.test(parte)) continue;
      const chave = parte.split(/\bth(?:ead)?\b/)[0].trim().replace(/[>+~]\s*$/, '').trim()
        || '(tabela sem classe)';
      if (!porTabela.has(chave)) porTabela.set(chave, { sticky: false, linha: linhaDe(limpo, g.pos) });
      if (/position\s*:\s*sticky/i.test(g.corpo)) porTabela.get(chave).sticky = true;
    }
  }
  for (const [chave, t] of porTabela) if (!t.sticky)
    defeitos.push({ regra: 'cabecalho-fixo', linha: t.linha,
      detalhe: 'a tabela `' + chave + '` nao declara position:sticky no cabecalho — rolou trinta '
        + 'linhas, perdeu a legenda de qual coluna e o teto CMED' });
  // (b) número à direita, com dígito tabular
  const direita = [...limpo.matchAll(/text-align\s*:\s*right/gi)].filter(m => !naFolha(m.index));
  const tabular = /tabular-nums|"tnum"|font-variant-numeric/i.test(limpo);
  if (direita.length && !tabular) defeitos.push({ regra: 'digito-tabular', linha: linhaDe(limpo, direita[0].index),
    detalhe: 'há coluna alinhada à direita e nenhum tabular-nums — a coluna de R$ dança a cada linha' });
  // (c) zebra em tabela interativa (hover existe = a tabela é interativa)
  const temHover = /tr[^{}]*:hover|tbody[^{}]*:hover/i.test(limpo);
  for (const m of limpo.matchAll(/([^{}]*\bnth-child\s*\(\s*(?:even|odd|2n[^)]*)\)[^{}]*)\{([^{}]*)\}/gi)) {
    /* O `m.index` desta expressão aponta o começo do SELETOR, que é o caractere logo depois do
       `}` da regra anterior — e não o corpo da regra. Perguntar "isto é papel?" naquele ponto
       responde pela regra de CIMA, não por esta: a zebra do `.print-doc` ficava reprovando com o
       endereço da linha anterior. A pergunta se faz onde a regra realmente começa, no `{`. */
    const posRegra = m.index + m[1].length;
    if (emDocGerado(docs, posRegra) || naFolha(posRegra)) continue;
    if (!/background/i.test(m[2])) continue;
    if (!temHover) continue;
    defeitos.push({ regra: 'zebra', linha: linhaDe(limpo, posRegra),
      detalhe: 'zebra com fundo numa tabela que tem hover — a listra briga com o hover e com a seleção' });
  }
  /* (d) AS DUAS DENSIDADES, E SÓ ELAS — medidas FORA do bloco de celular.
     Lá dentro o 44px é o ALVO DE TOQUE, e não uma terceira densidade: as duas regras vivem em
     mundos diferentes e cobrar as duas no mesmo lugar reprovaria quem obedeceu às duas. É a
     mesma armadilha do `::before` da caixinha, um andar acima. */
  const alturas = new Set();
  for (const g of regrasCss(limpo)) {
    if (emDocGerado(docs, g.pos) || naFolha(g.pos)) continue;
    if (dentroDe(blocos || [], g.pos, ehCelular)) continue;
    const sel = g.sel.trim().replace(/\s+/g, ' ');
    if (!ehSeletorCss(sel) || !/\b(tr|td|th)\b|\.linha\b|\.lin\b/.test(sel)) continue;
    const h = /\b(?:height|min-height)\s*:\s*([\d.]+)px/i.exec(g.corpo);
    if (h) alturas.add(parseFloat(h[1]));
  }
  for (const h of alturas) if (!ALTURAS_LINHA.includes(h))
    defeitos.push({ regra: 'densidade', linha: 0, detalhe: 'altura de linha ' + h + 'px — as densidades da casa são 40 (compacta) e 48 (confortável)' });
  return { temTabela: true, tabelasNoPapel, tabelas: [...porTabela.keys()],
           semCabecalhoFixo: [...porTabela].filter(([, t]) => !t.sticky).map(([k]) => k),
           tabular, alturas: [...alturas], defeitos };
}

/* 3.8 NÚMERO HONESTO — "R$ 0,00 exibido como preço quando o dado é ausente".
   Três formas de a mentira entrar, e as três são visíveis no arquivo:
     (a) o literal `R$ 0,00` / `R$ 0` escrito na tela;
     (b) `|| 0` / `?? 0` costurado DENTRO da chamada que formata dinheiro — é aqui que
         "não sei" vira zero sem ninguém decidir;
     (c) `.toFixed(` sobre expressão com `|| 0`.
   >>> E ELA COBRA O CONTRÁRIO TAMBÉM: a tela que exibe dinheiro precisa TER pelo menos uma
       frase de ausência escrita ("não informado", "sem referência", "sigiloso"). Catraca que só
       proíbe ensina a esconder; esta exige que a alternativa honesta exista no arquivo. */
const FRASES_HONESTAS = /não informado|nao informado|sem referência|sem referencia|sigiloso|não publicad|nao publicad|não sei|nao sei|ainda não|ainda nao/i;

/* >>> DEFEITO 14 DESTA RÉGUA, e ele é o MESMO da família do defeito 5 (o comentário do calibre
       French contado como preço) — só que um andar acima, e mais caro. A catraca reprovava a
       `fpmed_ajuda.html`, que é a tela do GUIA, por causa da linha que ENSINA ESTA REGRA:
           «"Sem referência" não é o mesmo que "R$ 0,00".»
       A tela zera nas seis outras contas. A única coisa que ela fazia de "errado" era nomear o
       que a regra proíbe — e um guia não tem outro jeito de ensinar. Para ficar verde, o B teria
       de apagar a explicação.

   ══ E ESTE É O DEFEITO MAIS CARO QUE UMA RÉGUA PODE TER NESTA CASA ══════════════════════════
   Régua que pune a explicação empurra todo mundo a apagar a explicação. Numa casa onde o porquê
   escrito é lei — e onde os arquivos são metade comentário de propósito — isso não erra um
   número: corrói a lei. O B achou o mesmo defeito QUATRO vezes na régua dele (1, 10, 12 e 14),
   e o arquiteto escreveu a frase inteira na caixa desta fatia. É defeito de família, e a
   família tem nome: **instrumento que confunde o REGISTRO com o REGISTRADO**.

   ══ A FRONTEIRA, E POR QUE ELA É A ASPA TIPOGRÁFICA ═════════════════════════════════════════
   `“R$ 0,00”` entre aspas CURVAS é MENÇÃO: alguém está falando SOBRE a string.
   `'R$ 0,00'` entre aspas RETAS é USO: é uma string de JavaScript, e ela vai pintar na tela.
   A separação não é gosto de tipografia — é que a aspa curva é pontuação de PROSA e a aspa reta
   é sintaxe de CÓDIGO. Nenhuma linguagem desta casa aceita `“` para abrir string; nenhum texto
   corrido revisado desta casa usa `"` para citar. Então a régua isenta a citação e continua
   cobrando, sem afrouxar um milímetro, o caso que ela nasceu para pegar:
       <span id="val-subtotal">R$ 0,00</span>        ← continua reprovando
       const vazio = 'R$ 0,00';                       ← continua reprovando
       «"Sem referência" não é o mesmo que “R$ 0,00”» ← citação, não some da conta: coluna própria
   >>> A PROVA DE QUE NÃO AFROUXOU está na mutação: trocar as aspas curvas por retas na mesma
       linha do guia devolve a reprovação. */
const ASPA_ABRE = '“‘«';   // “ ‘ «  — pontuação de prosa, nunca sintaxe
const ASPA_FECHA = '”’»';  // ” ’ »

function medeNumeroHonesto(txt, docs) {
  const limpo = semComentario(txt);
  const mentiras = [], citacoes = [];
  /* >>> DEFEITO 5 DESTA RÉGUA: a primeira versão aceitava `[.,]00?`, e por isso lia "R$ 0,0865"
         e "R$ 0,03" como se fossem "R$ 0". Zero seguido de centavo é um PREÇO — e um preço de
         oito décimos de centavo é justamente o que a unitarização produz. A régua estava
         chamando de mentira o número mais honesto do arquivo. O centavo agora é exato ("00") e
         o que vier depois de dígito, vírgula ou ponto derruba o casamento. */
  for (const m of limpo.matchAll(/R\$\s*0(?:[.,]00)?(?![\d.,])/g)) {
    if (emDocGerado(docs, m.index)) continue;
    // a citação é o literal COLADO nas duas aspas curvas — “R$ 0,00”. Aspa de um lado só, ou
    // aspa com texto no meio, não é citação do literal: é prosa que por acaso tem aspas por perto.
    const antes = limpo[m.index - 1], depois = limpo[m.index + m[0].length];
    if (antes && depois && ASPA_ABRE.includes(antes) && ASPA_FECHA.includes(depois)) {
      citacoes.push({ linha: linhaDe(limpo, m.index), trecho: antes + m[0] + depois });
      continue;
    }
    mentiras.push({ linha: linhaDe(limpo, m.index), forma: 'literal', trecho: m[0] });
  }
  for (const m of limpo.matchAll(/\b(brl|moeda|celValor|formataValor|fmtValor)\s*\(([^()]{0,120}?)(\|\||\?\?)\s*0\b/gi)) {
    mentiras.push({ linha: linhaDe(limpo, m.index), forma: 'zero-costurado', trecho: m[0].slice(0, 60) });
  }
  for (const m of limpo.matchAll(/\(([^()]{0,80}?)(\|\||\?\?)\s*0\s*\)\s*\.toFixed\s*\(/g)) {
    mentiras.push({ linha: linhaDe(limpo, m.index), forma: 'zero-no-toFixed', trecho: m[0].slice(0, 60) });
  }
  const exibeDinheiro = /R\$|\bbrl\s*\(|toLocaleString\([^)]*BRL/i.test(limpo);
  const temFraseHonesta = FRASES_HONESTAS.test(limpo);
  return { mentiras, citacoes, exibeDinheiro, temFraseHonesta };
}

/* ── 4 · OS 4 ESTADOS OBRIGATÓRIOS (BASE_ENGENHARIA §4) ─────────────────────────────────────
   Não é uma das oito catracas — é a medida que a fatia A28(e) pede, e ela mora aqui porque
   quem lê o arquivo já é esta régua. "Carregando" só conta COM NÚMERO: rodinha muda reprova. */
function medeEstados(txt, docs) {
  const limpo = semComentario(txt);
  const buscaDado = /\bfetch\s*\(|XMLHttpRequest|supabase|\/rest\/v1\//i.test(limpo);
  return {
    buscaDado,
    vazio: /nenhum[ao]?\s|não encontr|nao encontr|fp-vazio|estado-vazio|sem resultado/i.test(limpo),
    carregandoComNumero: /(lendo|carregando|processando|buscando|conferindo)[^<'"`]{0,40}\d|\bde\s*'\s*\+|\+\s*total|\bde\s+\$\{|\d+\s*de\s*\$\{|de\s*'\s*\+\s*\w+/i.test(limpo)
      || /(lendo|carregando|processando|buscando)[^'"`<]{0,30}['"`]\s*\+\s*\w/i.test(limpo),
    erroComCausa: /tentar de novo|tente de novo|tentar novamente|não respondeu|nao respondeu|fora do ar|sem conexão|sem conexao/i.test(limpo),
    cheio: true,
  };
}

/* ── 5 · O RETRATO ──────────────────────────────────────────────────────────────────────────*/
function mede(arquivo) {
  const txt = leia(arquivo);
  const blocos = blocosDeMedia(txt);
  const docs = blocosDeDocGerado(txt);
  const papel = regioesDePapel(txt, blocos);
  const ilhas = raizesDeIlha(txt);
  return {
    arquivo,
    linhas: txt.split('\n').length,
    docsGerados: docs.length,
    carregaTema: /fpmed_tema\.css/.test(txt),
    carregaSprite: /fpmed_icones\.js/.test(txt),
    papel,
    ilhaDeTema: ilhas.length > 0,
    cor: medeCor(txt, docs, papel, blocos, ilhas),
    espaco: medeEspaco(txt, blocos, docs, papel),
    texto: medeTextoPiso(txt, blocos, docs, papel),
    icones: medeIcones(txt, docs, papel, blocos),
    toque: medeToque(txt, blocos),
    contraste: medeContraste(txt, blocos, docs),
    tabela: medeTabelaDensa(txt, docs, blocos, papel),
    numero: medeNumeroHonesto(txt, docs),
    estados: medeEstados(txt, docs),
  };
}

/* A LISTA DE TELAS ADOTADAS mora em arquivo próprio, versionado, e NÃO nesta régua.
   >>> POR QUE UMA LISTA, E NÃO "TODA TELA DO REPOSITÓRIO": porque catraca que nasce vermelha
       em doze telas ensina todo mundo a ignorar vermelho, que é o defeito que o arquiteto
       nomeou nesta rodada. Verde aqui quer dizer "as telas que já passaram pela fatia
       obedecem"; a dívida das outras NÃO some — cada catraca imprime a lista de pendentes com
       o número medido de cada uma. Dívida escondida é que é mentira; dívida contada, não. */
function adotadas() {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tests', 'telas_adotadas.json'), 'utf8'));
  return j;
}

module.exports = { mede, adotadas, GRADE, ESCALA_TEXTO, PISO_TEXTO, ALVO_TOQUE, ALTURAS_LINHA,
                   TOKENS, contraste, lum, resolveCor, linhaDe, semComentario, leia, RAIZ };

/* ── 6 · LINHA DE COMANDO ───────────────────────────────────────────────────────────────────*/
if (require.main === module) {
  const args = process.argv.slice(2);
  const alvos = args.filter(a => !a.startsWith('--'));
  const lista = alvos.length ? alvos : adotadas().adotadas.concat(adotadas().pendentes);
  const retrato = lista.map(a => { try { return mede(a); } catch (e) { return { arquivo: a, erro: e.message }; } });
  if (args.includes('--json')) { console.log(JSON.stringify(retrato, null, 1)); }
  else {
    console.log('RÉGUA VISUAL — medição estática e repetível. O que só a tela pintada responderia');
    console.log('sai DECLARADO no relatório, nunca convertido em número bonito.\n');
    console.log('grade lida do tema: ' + GRADE.join(' · ') + '   piso: ' + PISO_TEXTO + 'px   alvo: ' + ALVO_TOQUE + 'px\n');
    for (const r of retrato) {
      if (r.erro) { console.log('══ ' + r.arquivo + '  ERRO: ' + r.erro); continue; }
      console.log('══ ' + r.arquivo + '  (' + r.linhas + ' linhas · tema:' + (r.carregaTema ? 'sim' : 'NAO')
        + ' · sprite:' + (r.carregaSprite ? 'sim' : 'NAO') + ')');
      if (r.papel.raizes.length) console.log('   papel ........... raiz(es): ' + r.papel.raizes.join(' · ')
        + ' · ' + r.papel.regioes.length + ' região(ões)'
        + (r.papel.semFecho.length ? '  ⚠ ' + r.papel.semFecho.length + ' marcação(ões) SEM FECHO (não viraram papel)' : ''));
      if (r.ilhaDeTema) console.log('   ilha de tema .... declarada em <html data-tema> — o :root dela é fonte de cor');
      console.log('   cor chumbada .... ' + r.cor.tela.length + '   [doc gerado: ' + r.cor.docGerado.length
        + ' · papel: ' + r.cor.papel.length + ' · fonte da ilha: ' + r.cor.fonteIlha.length + ']');
      console.log('   fora da grade ... ' + r.espaco.tela.length + '   [papel: ' + r.espaco.papel.length + ']');
      console.log('   abaixo do piso .. ' + r.texto.tela.length + '   (por token: '
        + r.texto.tela.filter(x => x.viaToken).length + ' · rótulo de grupo legítimo: ' + r.texto.rotuloGrupo.length
        + ' · papel: ' + r.texto.papel.length + ')');
      console.log('   ícone fora ...... ' + r.icones.pictograma.length + ' pictogramas + ' + r.icones.img.length + ' <img>'
        + '   [papel: ' + r.icones.papel.length + ' pictogramas + ' + r.icones.imgPapel.length + ' <img>]');
      console.log('   toque ........... bloco de celular: ' + (r.toque.temBloco ? r.toque.blocos : 'NENHUM')
        + ' · curtos: ' + r.toque.curtos.length + ' · promessa vazia: ' + r.toque.promessaVazia.length);
      console.log('   contraste ....... ' + r.contraste.reprovados.length + ' reprovados de '
        + (r.contraste.pares.length + r.contraste.naoTexto.length) + ' pares medidos'
        + '   [não-texto (3:1): ' + r.contraste.naoTexto.length
        + ' · desligado (isento): ' + r.contraste.desligados.length
        + ' · não medidos: ' + r.contraste.naoMedidos.length + ']');
      console.log('   tabela densa .... ' + (r.tabela.temTabela ? r.tabela.defeitos.length + ' defeitos' : 'sem tabela na tela')
        + (r.tabela.tabelasNoPapel ? '   [' + r.tabela.tabelasNoPapel + ' tabela(s) no papel — as 4 regras são de tela]' : ''));
      console.log('   número honesto .. ' + r.numero.mentiras.length + ' mentiras'
        + (r.numero.citacoes.length ? ' · ' + r.numero.citacoes.length + ' citação(ões) em prosa (menção, não uso)' : '')
        + (r.numero.exibeDinheiro ? ' · frase de ausência: ' + (r.numero.temFraseHonesta ? 'sim' : 'NAO') : ''));
      console.log('   4 estados ....... ' + (r.estados.buscaDado
        ? 'vazio:' + (r.estados.vazio ? 'sim' : 'NAO')
          + ' · carregando c/ número:' + (r.estados.carregandoComNumero ? 'sim' : 'NAO')
          + ' · erro c/ saída:' + (r.estados.erroComCausa ? 'sim' : 'NAO')
        : 'nao busca dado — os 4 estados nao se aplicam'));
    }
  }
}
