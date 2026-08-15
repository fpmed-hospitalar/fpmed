#!/usr/bin/env node
/* APLICADOR DO MOLDE — fatia B19, território do trabalhador B.
 *
 * As duas correções MECÂNICAS da fatia (piso de texto e grade de 8) são centenas de ocorrências
 * em quatro arquivos. Feitas à mão elas viram digitação, e digitação erra calada. Feitas aqui
 * elas viram REGRA ESCRITA, repetível e conferível pela régua — que é o que o molde pede.
 *
 * ELE NÃO INVENTA DEGRAU. Onde o valor não cabe na grade sem torcer, ele RECUSA e imprime a
 * linha, para eu decidir e RELATAR — exatamente a ordem da caixa ("o que não couber você RELATA
 * em vez de inventar degrau novo").
 *
 *   node tools/aplica_molde_b.js <arquivo.html> --espaco --piso        (grava)
 *   node tools/aplica_molde_b.js <arquivo.html> --espaco --piso --seco (só mostra)
 */
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const GRADE = [0, 4, 8, 12, 16, 20, 24, 32, 48, 64];

/* ══ A REGRA DE ARREDONDAMENTO, DECLARADA ═══════════════════════════════════════════════════
   1. ZERO NÃO É DEGRAU DE ARREDONDAMENTO. Quem escreveu `padding:2px` queria espaço; 0 é
      AUSÊNCIA de espaço, que é outra decisão, não um arredondamento. Então 1, 2 e 3 sobem
      para 4 — nunca caem para 0.
   2. DE 4 PARA CIMA: o degrau mais próximo.
   3. EMPATE VAI PARA O MENOR. Esta tela é a de comparar centenas de itens, e "densidade é
      respeito" (BASE, PARTE 1.5): 10px é o valor mais repetido da Negócios (59 vezes), e
      empurrá-lo para 12 inflaria a tela inteira em que o gestor compara. 10 -> 8.
   4. FORA DE ALCANCE: NADA ANDA MAIS DE 8px — a largura de um degrau inteiro da parte grossa
      da grade. Acima disso o aplicador RECUSA e manda relatar: mudar 96 para 64 não é
      arredondar, é redesenhar, e redesenhar é decisão, não conta.
      >>> A PRIMEIRA VERSÃO DESTA TRAVA ERA UM PERCENTUAL (25%) e recusava 6px -> 4px, que é
          arredondamento comum, enquanto deixaria passar coisa grande. Percentual é apertado
          embaixo e frouxo em cima; o que importa aqui é a DISTÂNCIA, que é o que o olho vê. */
function degrau(v) {
  if (v === 0) return { ok: true, valor: 0 };
  if (v < 4) return { ok: true, valor: 4, nota: 'zero nao e degrau: sobe pro 4' };
  let melhor = GRADE[0], dist = Infinity;
  for (const g of GRADE) {
    const d = Math.abs(g - v);
    if (d < dist || (d === dist && g < melhor)) { melhor = g; dist = d; }
  }
  if (dist > 8) return { ok: false, valor: melhor, nota: 'anda ' + dist + 'px — mais de um degrau' };
  return { ok: true, valor: melhor };
}

/* AS MESMAS FRONTEIRAS DA RÉGUA: papel e documento gerado não entram no conserto de tela.
   >>> E "PAPEL" NÃO É SÓ `@media print` — foi o defeito 11 da régua, achado antes de este
   aplicador rodar na Proposta, e por pouco. A folha que vai para o hospital é a `.print-doc`:
   ela fica `display:none` na tela, então o CSS dela mora FORA do `@media print`. Este aplicador
   teria reescrito 18 hex e 10 tamanhos de letra do documento CONGELADO desde a B8, e a
   `tools/prova_papel_congelado.js` teria ficado vermelha — depois de o estrago estar no disco.
   As âncoras são copiadas da prova de propósito: uma fronteira, três leitores. */
const ANCORAS_DO_PAPEL = [
  /<div class="print-doc" id="print-doc">[\s\S]*?\n<!-- MODAL MANUAL -->/,
  /\/\* PRINT \*\/[\s\S]*?<\/style>/,
  /function gerarPDF\(\)[\s\S]*?\n\}/,
];
function regioesFora(txt) {
  const fora = [];
  for (const re of ANCORAS_DO_PAPEL) {
    const m = re.exec(txt);
    if (m) fora.push([m.index, m.index + m[0].length]);
  }
  const reM = /@media([^{]*)\{/g;
  let m;
  while ((m = reM.exec(txt))) {
    if (!/\bprint\b/.test(m[1])) continue;
    let i = reM.lastIndex, prof = 1;
    while (i < txt.length && prof > 0) { const c = txt[i]; if (c === '{') prof++; else if (c === '}') prof--; i++; }
    fora.push([m.index, i]);
  }
  const reD = /\.write\s*\(\s*['"`]<!doctype/gi;
  while ((m = reD.exec(txt))) {
    const f = txt.indexOf('</html>', reD.lastIndex);
    fora.push([m.index, f < 0 ? txt.length : f + 7]);
  }
  return fora;
}
const estaFora = (fora, pos) => fora.some(([a, b]) => pos >= a && pos < b);
const linhaDe = (txt, pos) => txt.slice(0, pos).split('\n').length;

function aplica(arquivo, opcoes) {
  const alvo = path.join(raiz, arquivo);
  let txt = fs.readFileSync(alvo, 'utf8');
  const fora = regioesFora(txt);
  const feitos = [], recusados = [];

  // ── ESPAÇO: só padding/margin/gap. Largura, altura e posição NÃO são espaço e entrariam
  //    de carona mexendo em layout que a fatia não mandou mexer.
  if (opcoes.espaco) {
    const re = /\b(padding|margin|gap|row-gap|column-gap)(-top|-right|-bottom|-left)?\s*:\s*([^;}"'`]+)/gi;
    txt = txt.replace(re, (todo, prop, lado, valor, pos) => {
      if (estaFora(fora, pos)) return todo;
      const novo = valor.replace(/(-?)([\d.]+)px/g, (px, sinal, num) => {
        const v = Number(num);
        if (GRADE.includes(v)) return px;
        const d = degrau(v);
        if (!d.ok) { recusados.push({ linha: linhaDe(txt, pos), prop, valor: v, nota: d.nota }); return px; }
        feitos.push({ tipo: 'espaco', linha: linhaDe(txt, pos), de: v, para: d.valor });
        return sinal + d.valor + 'px';
      });
      return todo.slice(0, todo.length - valor.length) + novo;
    });
  }

  /* ── PISO DE TEXTO: tudo abaixo de 12px vira o TOKEN --txt-1, não o número 12px.
        "font-size:12px está errado mesmo que dê o mesmo pixel — porque no dia em que o piso
        mudar, um sobe e o outro não" (MOLDE_VISUAL, regra de ouro).

     >>> MAS SÓ SE O TOKEN EXISTIR NESTA TELA. Este é o DEFEITO 2 deste aplicador, achado ao
     chegar na quarta tela do B: a `fpmed_documentos.html` é uma ILHA DE TEMA — ela não carrega o
     `fpmed_tema.css` e publica a paleta dela no próprio `:root`. Escrever `var(--txt-1)` ali
     seria escrever um token que NINGUÉM define: em CSS isso não dá erro, não avisa e não pinta
     de vermelho — o `font-size` inteiro vira inválido e a letra volta ao padrão do navegador,
     16px. O aplicador teria "consertado" 6 tamanhos pequenos transformando-os em 6 tamanhos
     GRANDES, e a régua diria que o piso está limpo, porque não há mais número abaixo de 12.
     Defeito que o instrumento CRIA e depois não vê é o pior tipo, e este teria passado.
     Por isso ele agora CONFERE se o token resolve nesta tela (pelo tema carregado ou por um
     `--txt-1:` declarado no próprio arquivo) e RECUSA se não resolver, em vez de escrever. */
  if (opcoes.piso) {
    const temTema = /<link[^>]+fpmed_tema\.css/.test(txt);
    const temTokenProprio = /--txt-1\s*:/.test(txt);
    if (!temTema && !temTokenProprio) {
      const quantos = (txt.match(/font-size\s*:\s*([\d.]+)px/gi) || [])
        .filter(s => Number(/([\d.]+)/.exec(s)[1]) < 12).length;
      recusados.push({ linha: 0, prop: 'font-size', valor: quantos,
        nota: 'ilha de tema sem --txt-1: escrever var(--txt-1) aqui apagaria o tamanho' });
      opcoes.piso = false;
    }
  }
  if (opcoes.piso) {
    txt = txt.replace(/font-size\s*:\s*([\d.]+)px/gi, (todo, num, pos) => {
      if (estaFora(fora, pos)) return todo;
      if (Number(num) >= 12) return todo;
      feitos.push({ tipo: 'piso', linha: linhaDe(txt, pos), de: Number(num), para: 'var(--txt-1)' });
      return 'font-size:var(--txt-1)';
    });
    // e o piso furado POR TOKEN: --txt-0 vale 10px. Trocar o uso, não o tema — o tema é
    // compartilhado com telas que não são minhas, e mexer nele daqui mudaria a tela dos outros.
    txt = txt.replace(/font-size\s*:\s*var\(\s*--txt-0\s*\)/gi, (todo, pos) => {
      if (estaFora(fora, pos)) return todo;
      feitos.push({ tipo: 'piso-token', linha: linhaDe(txt, pos), de: '--txt-0 (10px)', para: 'var(--txt-1)' });
      return 'font-size:var(--txt-1)';
    });
  }

  const resumo = {};
  feitos.forEach(f => { const k = f.tipo + ' ' + f.de + ' -> ' + f.para; resumo[k] = (resumo[k] || 0) + 1; });
  console.log('\n══ ' + arquivo);
  Object.keys(resumo).sort().forEach(k => console.log('   ' + k + '  x' + resumo[k]));
  console.log('   TOTAL TROCADO: ' + feitos.length);
  if (recusados.length) {
    console.log('   >>> RECUSADOS (relatar, nao inventar degrau):');
    recusados.forEach(r => console.log('       L' + r.linha + ' ' + r.prop + ':' + r.valor + 'px — ' + r.nota));
  }
  if (!opcoes.seco) { fs.writeFileSync(alvo, txt); console.log('   GRAVADO.'); }
  else console.log('   (seco — nada gravado)');
  return { feitos, recusados };
}

const args = process.argv.slice(2);
const arquivos = args.filter(a => !a.startsWith('--'));
const opcoes = { espaco: args.includes('--espaco'), piso: args.includes('--piso'), seco: args.includes('--seco') };
if (!arquivos.length) { console.log('uso: node tools/aplica_molde_b.js <arquivo.html> --espaco --piso [--seco]'); process.exit(1); }
arquivos.forEach(a => aplica(a, opcoes));
