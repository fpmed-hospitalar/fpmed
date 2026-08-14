// ═══════════════════════════════════════════════════════════════════════════════════════════
// VARREDURA DE CLIQUE MORTO E DE AFORDÂNCIA DESONESTA — fatia B12 (14/08/2026, Trabalhador B)
//
//   node tools/varre_cliques.js                 (os territórios do B: Negócios e Proposta)
//   node tools/varre_cliques.js <arquivo.html>  (qualquer tela)
//
// ── AS DUAS DOENÇAS QUE ELA CAÇA, E ELAS SÃO OPOSTAS ────────────────────────────────────────
//   CLIQUE MORTO ......... tem cara de clicável, a pessoa clica, e NADA acontece. O caso mais
//                          comum é `onclick="fazAlgo()"` com `fazAlgo` que não existe mais: o
//                          navegador estoura no console, que ninguém abre, e a tela fica muda.
//   AFORDÂNCIA MENTIROSA . cursor de mão em coisa que não é botão. Ela não quebra nada — ela
//                          gasta o clique da pessoa e ensina que a tela mente.
//
// ── POR QUE ISTO É UMA VARREDURA DE TEXTO, E NÃO UM NAVEGADOR ───────────────────────────────
// Quase todo elemento clicável destas duas telas nasce DENTRO de template literal, montado em
// tempo de execução, em caminho que só existe depois de um filtro, de um clique e de um dado
// específico. Um navegador só vê o que foi pintado; o texto tem TODOS os caminhos.
// >>> ELA NÃO SUBSTITUI O CLIQUE DE GENTE — a verificação de que o botão faz A COISA CERTA é de
//     quem usa. O que esta varredura garante é o degrau de baixo: que ele faz ALGUMA coisa.
//
// ── SÓ-LEITURA. Não altera arquivo nenhum.
// ═══════════════════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
// `resolve` e não `join`: assim dá pra apontar a varredura para uma CÓPIA em pasta temporária,
// que é como o tools/prova_varre_cliques.js prova que ela ainda enxerga defeito.
const R = f => fs.readFileSync(path.resolve(raiz, f), 'utf8').replace(/\r\n/g, '\n');

const ALVOS = process.argv[2] ? [process.argv[2]] : ['fpmed_negocios.html', 'fpmed_giovana.html'];

/* Os arquivos que estas telas carregam por <script src>. As funções deles são globais de
   verdade, e chamá-las de um onclick não é clique morto.
   >>> A LISTA SAI DO PRÓPRIO HTML, e não daqui: tela que ganha um <script src> novo passa a ser
       medida com ele sem ninguém lembrar de vir aqui. */
function irmaosDe(html) {
  return [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1])
    .filter(f => /\.js$/.test(f) && fs.existsSync(path.resolve(raiz, f)));
}

// ── QUEM ESTÁ DEFINIDO ──────────────────────────────────────────────────────────────────────
const DECLARA = [
  /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,
  /\basync\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g,
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g,
  /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g,
];
function definidasEm(src) {
  const s = new Set();
  for (const re of DECLARA) for (const m of src.matchAll(re)) s.add(m[1]);
  return s;
}

// O que o navegador já traz, e o que estas telas usam de objeto global com ponto (que a varredura
// de chamada simples nem olha, mas vale listar para o relatório não mentir sobre cobertura).
const DO_NAVEGADOR = new Set([
  'alert', 'confirm', 'prompt', 'print', 'open', 'close', 'focus', 'blur', 'scrollTo',
  'setTimeout', 'clearTimeout', 'setInterval', 'history', 'location', 'event',
]);
/* PALAVRA DA LINGUAGEM NÃO É FUNÇÃO QUE FALTA. A 1ª versão desta varredura acusou `if()` como
   clique morto três vezes, porque `onkeydown="if(event.key==='Enter') …"` casa com o mesmo
   desenho de `nome(`. Acusação falsa gasta a confiança na ferramenta inteira — e uma ferramenta
   em que ninguém confia é uma ferramenta que ninguém roda. */
const PALAVRA_DA_LINGUAGEM = new Set([
  'if', 'for', 'while', 'switch', 'return', 'typeof', 'catch', 'function', 'do', 'else', 'new',
  'delete', 'void', 'await', 'try',
]);

/* COMENTÁRIO NÃO É TELA. A 1ª versão acusou um `<button>` que estava DENTRO de um comentário de
   projeto ("as células são CONTROLES de verdade (<button>)"). Varredura que lê comentário mede o
   que se escreveu sobre a tela, e não a tela. */
const semComentarioHtml = s => s.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));

/* `class="chip${SEL===k?' on':''}"` é UMA classe (`chip`) mais o que o dado decidir. Partir só
   por espaço devolve `chip${SEL===k?'` — um nome que não existe em folha de estilo nenhuma, e
   que faria a varredura achar que o elemento não usa classe conhecida. */
const classesDoAtributo = valor => valor
  .replace(/\$\{[^}]*\}/g, ' ')
  .split(/\s+/).filter(c => /^[a-zA-Z][\w-]*$/.test(c));

/* Lê o `class="…"` de dentro do bloco de atributos — inclusive quando o valor tem aspas DENTRO
   de um `${…}` (`class="chip${SEL===k?' on':''}"`). Um casamento simples por aspas pararia na
   primeira aspa de dentro e devolveria um pedaço de expressão como se fosse nome de classe. */
function classesDoElemento(attrs) {
  const i = attrs.search(/\bclass\s*=\s*["'`]/);
  if (i < 0) return [];
  const abre = attrs.slice(i).match(/\bclass\s*=\s*(["'`])/);
  const aspa = abre[1];
  let j = i + abre[0].length, prof = 0, saida = '';
  while (j < attrs.length) {
    const c = attrs[j];
    if (c === '$' && attrs[j + 1] === '{') { prof++; j += 2; continue; }
    if (c === '}' && prof > 0) { prof--; j++; continue; }
    if (c === aspa && prof === 0) break;
    if (prof === 0) saida += c;
    j++;
  }
  return classesDoAtributo(saida);
}

/* ══ COMENTÁRIO DE CÓDIGO TAMBÉM NÃO É TELA — MAS APAGÁ-LO É PERIGOSO ═══════════════════════
   O `<button>` da 1ª versão estava dentro de um bloco de comentário que discute o desenho do
   calendário. Só que a limpeza ingênua (`/*` até o próximo `*\/` no arquivo inteiro) fez uma
   coisa MUITO pior do que o problema que resolvia — e o red test é que a pegou:

     `<input accept="image/*,application/pdf">` na Proposta abre um "comentário" no `/*` do
     `image/*`, e ele só fecha 21.720 caracteres depois. *** 17 dos 46 `onclick` da tela sumiram
     da varredura, e ela ficou verde por CEGUEIRA. ***

   >>> ENTÃO A LIMPEZA SÓ ACONTECE DENTRO DE `<style>` E DE `<script>`, que é onde comentário de
       código existe. Atributo de HTML nunca mais é tocado. */
const semComentarioCodigo = s => s.replace(/(<(style|script)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi,
  (_, abre, tag, dentro, fecha) => abre + dentro.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')) + fecha);

let achadosTotais = 0;
const relatorio = [];

for (const alvo of ALVOS) {
  const BRUTO = R(alvo);
  const H = semComentarioCodigo(semComentarioHtml(BRUTO));   // comentário vira espaço: as linhas não andam
  const irmaos = irmaosDe(BRUTO);
  const definidas = definidasEm(BRUTO);
  for (const f of irmaos) for (const nome of definidasEm(R(f))) definidas.add(nome);

  /* AS CLASSES QUE PROMETEM CLIQUE. É aqui que o clique morto se esconde de verdade: o
     `cursor:pointer` mora na folha de estilo, longe da etiqueta, e ninguém que olha o HTML o vê.
     Só entram as classes do <style> DESTA tela — o tema tem as suas (.fp-btn e companhia) e elas
     são componentes com contrato próprio. */
  /* O COMENTÁRIO DA FOLHA DE ESTILO SAI ANTES DE QUALQUER LEITURA. Estas telas explicam as
     decisões dentro do CSS, e frases como «ele herdava o `cursor:pointer`» viravam REGRA na
     leitura ingênua — inventando promessa e revogação que não existem.
     >>> E A FOLHA SAI DO TEXTO JÁ LIMPO (`H`), e não do bruto: limpar depois de recortar não
         limparia nada, porque a limpeza só age dentro de `<style>` e `<script>` — e o recorte
         justamente tira essas etiquetas. Foi assim por uma versão, e o sintoma foi a tela
         acusando três cartões que estão certos. */
  const CSS = [...H.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
  /* SÓ A ÚLTIMA PARTE DO SELETOR É QUEM RECEBE A REGRA. A 1ª versão pegava toda classe que
     aparecesse no seletor, e por isso `.barra .lnk{cursor:pointer}` marcava a BARRA como
     promessa de clique — 39 acusações, quase todas assim. Quem ganha o cursor é o `.lnk`. */
  /* ══ COMO A PROMESSA DE CLIQUE É LIDA DA FOLHA DE ESTILO ══════════════════════════════════
     Três coisas, e cada uma foi aprendida com uma acusação falsa desta própria varredura:

     1. A PROMESSA É DO CONJUNTO. `.ag-lin.pz{cursor:pointer}` promete na linha que tem AS DUAS
        classes; sozinha, `.ag-lin` é só uma linha de agenda — e a 2ª versão acusou todas elas.
     2. O ANCESTRAL FAZ PARTE DA REGRA. `.anx .n{cursor:pointer}` promete no `.n` DENTRO do
        `.anx`; a 3ª versão acusou todo `<td class="n">` de toda tabela da tela por causa dele.
     3. A ETIQUETA TAMBÉM CONTA. `.pk-tab tbody tr{cursor:pointer}` não cita classe nenhuma no
        alvo — quem promete é o `tr`. Uma varredura só de classe não enxerga essa linha e acusa
        a tabela inteira de "clica e não parece que clica".

     >>> E O ANCESTRAL É CONFERIDO POR APROXIMAÇÃO, o que fica dito aqui em vez de escondido:
         procura-se a marcação do ancestral nos 4.000 caracteres anteriores. Não há árvore aqui —
         o HTML destas telas nasce dentro de template literal, e metade dele nem é HTML válido
         antes de rodar. A aproximação erra para o lado de NÃO acusar, que é o lado certo para
         uma ferramenta que precisa ser rodada. */
  const parteDoSeletor = txt => ({
    tag: (txt.match(/^([a-z][a-z0-9]*)/i) || [, ''])[1].toLowerCase(),
    classes: [...txt.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(c => c[1]),
  });
  const regrasDe = seletor => seletor.split(',').map(parte => {
    const partes = parte.trim().split(/[\s>+~]+/).filter(Boolean);
    if (!partes.length) return null;
    const alvo = parteDoSeletor(partes.pop());
    /* ALVO SEM ETIQUETA E SEM CLASSE CASA COM TUDO, e foi o que aconteceu na 4ª versão: um
       pedaço de `@media (…)` entrou como seletor, o alvo saiu vazio, e a varredura acusou 1.133
       elementos — inclusive o `<html>` e o `<head>`. Regra que casa com tudo não informa nada. */
    if (!alvo.tag && !alvo.classes.length) return null;
    return { alvo, ancestrais: partes.map(parteDoSeletor).filter(a => a.tag || a.classes.length) };
  }).filter(Boolean);

  const prometem = [], revogam = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/cursor\s*:\s*pointer/.test(m[2])) prometem.push(...regrasDe(m[1]));
    /* AS REGRAS QUE TIRAM O CURSOR DE VOLTA. É o padrão que o Negócios já usa e que é o certo:
         .nf{cursor:pointer}  ·  .nf:not([onclick]):not([href]){cursor:default}
       A classe promete clique, e a própria folha desfaz a promessa quando não há ação. Uma classe
       assim NÃO pode ser cobrada como se prometesse sempre — ela já se defende sozinha. */
    if (/cursor\s*:\s*default/.test(m[2])) revogam.push(...regrasDe(m[1]));
  }
  const ANCESTRAL_ALCANCE = 4000;
  const temAncestral = (a, antes) => {
    if (a.classes.length) return a.classes.every(c => new RegExp('class\\s*=\\s*["\'`][^"\'`]*\\b' + c + '\\b').test(antes));
    if (!a.tag) return true;
    /* ANCESTRAL POR ETIQUETA PRECISA ESTAR ABERTO. `.pk-tab tbody tr{cursor:pointer}` não vale
       para a linha do `<tfoot>` — e ela vem DEPOIS do `</tbody>` no mesmo texto. Sem esta
       conferência, toda linha de cabeçalho e de rodapé das tabelas era acusada. */
    const abre = antes.lastIndexOf('<' + a.tag);
    if (abre < 0) return false;
    return antes.lastIndexOf('</' + a.tag) < abre;
  };
  const casa = (r, tag, classes, antes) => {
    if (r.alvo.tag && r.alvo.tag !== tag) return false;
    if (!r.alvo.classes.every(c => classes.includes(c))) return false;
    return r.ancestrais.every(a => temAncestral(a, antes));
  };
  const prometeClique = (tag, classes, antes) =>
    prometem.some(r => casa(r, tag, classes, antes)) && !revogam.some(r => casa(r, tag, classes, antes));
  const classesDeMao = new Set(prometem.flatMap(r => r.alvo.classes));

  // ── 1. CLIQUE MORTO: onclick chamando função que não existe ──────────────────────────────
  // Pega `onclick="nome(` e `onclick='nome(` e também os montados em template literal.
  const chamadas = new Map();   // nome -> quantas vezes
  for (const m of H.matchAll(/\bon(?:click|change|input|submit|keydown|keyup|mouseenter|mouseleave)\s*=\s*["'`]\s*(?:return\s+)?([A-Za-z_$][\w$]*)\s*\(/g)) {
    chamadas.set(m[1], (chamadas.get(m[1]) || 0) + 1);
  }
  const mortas = [...chamadas.entries()]
    .filter(([n]) => !definidas.has(n) && !DO_NAVEGADOR.has(n) && !PALAVRA_DA_LINGUAGEM.has(n))
    .sort((a, b) => b[1] - a[1]);

  // ── 2. AFORDÂNCIA MENTIROSA: cursor de mão sem nada por trás ─────────────────────────────
  // Só o caso INEQUÍVOCO: o cursor está no PRÓPRIO elemento, escrito no atributo de estilo, e a
  // etiqueta não tem onclick, nem href, nem id (id pode receber ouvinte por addEventListener).
  const mentirosos = [];
  for (const m of H.matchAll(/<([a-z][a-z0-9]*)\b([^>]*cursor\s*:\s*pointer[^>]*)>/gi)) {
    const [tudo, tag, attrs] = m;
    if (/\bon[a-z]+\s*=/.test(attrs)) continue;
    if (/\bhref\s*=/.test(attrs)) continue;
    if (/\bid\s*=/.test(attrs)) continue;
    if (/\bdata-[a-z-]+\s*=/.test(attrs)) continue;     // ouvinte por atributo de dado
    /* `<label>` COM CAMPO DENTRO É CLICÁVEL DE VERDADE, e sem uma linha de código: o navegador
       manda o clique para o campo. Cursor de mão nele é honesto — foi a 1ª acusação falsa desta
       varredura, no filtro "ver arquivados" do Negócios. */
    if (tag.toLowerCase() === 'label' &&
        (/\bfor\s*=/.test(attrs) || /<(?:input|select|textarea)\b/i.test(H.slice(m.index, m.index + 500)))) continue;
    mentirosos.push({ linha: H.slice(0, m.index).split('\n').length, trecho: tudo.slice(0, 110) });
  }

  // ── 5. CLASSE QUE PROMETE CLIQUE NA FOLHA DE ESTILO, E O ELEMENTO NÃO CUMPRE ─────────────
  // O clique morto mais difícil de ver: o cursor de mão está a 3.000 linhas dali, no <style>.
  const antesDe = i => H.slice(Math.max(0, i - ANCESTRAL_ALCANCE), i);

  /* ══ PAPEL NÃO É TELA — e esta tela FABRICA papel ═══════════════════════════════════════════
     O Negócios monta, dentro de strings, documentos HTML inteiros para impressão (a lista de
     ganhas, o relatório). Eles têm `<html>`, `<style>` e `<table>` próprios e abrem em OUTRA
     janela: nenhuma regra da folha de estilo desta tela alcança lá dentro, e cursor de mão em
     papel não quer dizer nada.
     >>> A ISENÇÃO É A MESMA QUE A SUÍTE DA PROPOSTA JÁ USA por ordem do dono, e aqui ela é
         DELIMITADA: começa no segundo `<html` do arquivo (o primeiro é a tela) e vai até o
         `</html>` seguinte. Isenção que não tem fim escrito engole a tela junto — foi o que
         aconteceu com o modal manual da Proposta. */
  const papel = [];
  {
    const re = /<html\b/gi; let m, primeiro = true;
    while ((m = re.exec(H))) {
      if (primeiro) { primeiro = false; continue; }
      const fim = H.indexOf('</html>', m.index);
      papel.push([m.index, fim < 0 ? H.length : fim + 7]);
    }
  }
  const ehPapel = i => papel.some(([a, b]) => i >= a && i < b);
  const promessaQuebrada = [];
  for (const m of H.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)) {
    const [tudo, tag, attrs] = m;
    const classes = classesDoElemento(attrs);
    if (ehPapel(m.index)) continue;
    if (!prometeClique(tag.toLowerCase(), classes, antesDe(m.index))) continue;
    if (/\bon[a-z]+\s*=/.test(attrs) || /\bhref\s*=/.test(attrs) || /\bid\s*=/.test(attrs) || /\bdata-[a-z-]+\s*=/.test(attrs)) continue;
    // o elemento que DESFAZ a promessa no próprio estilo já é honesto — e é assim que se faz
    if (/cursor\s*:\s*default/.test(attrs)) continue;
    // campo e botão são controles do navegador: recebem o clique sem ninguém escrever nada
    if (/^(input|select|textarea|button|option|summary)$/.test(tag.toLowerCase())) continue;
    // atributo montado em tempo de execução pode trazer o `onclick` dentro: daqui não dá pra afirmar
    if (/\$\{/.test(attrs)) continue;
    // `<label>` com campo dentro é clicável pelo navegador — a mesma isenção do item 2
    if (tag.toLowerCase() === 'label' &&
        (/\bfor\s*=/.test(attrs) || /<(?:input|select|textarea)\b/i.test(H.slice(m.index, m.index + 500)))) continue;
    promessaQuebrada.push({ linha: H.slice(0, m.index).split('\n').length, classe: classes.join(' '), trecho: tudo.slice(0, 110) });
  }

  // ── 6. O CONTRÁRIO: CLICA, MAS NÃO PARECE QUE CLICA ─────────────────────────────────────
  // `<button>` e `<a href>` já têm afordância do navegador. `div`, `span`, `td`, `tr` e `li` não
  // têm nenhuma: com onclick e sem cursor de mão, a ação existe e ninguém descobre que existe.
  const invisiveis = [];
  for (const m of H.matchAll(/<(div|span|td|tr|li|p|h[1-6])\b([^>]*\bonclick\s*=[^>]*)>/gi)) {
    const [tudo, tag, attrs] = m;
    if (ehPapel(m.index)) continue;
    if (/cursor\s*:\s*pointer/.test(attrs)) continue;
    if (prometeClique(tag.toLowerCase(), classesDoElemento(attrs), antesDe(m.index))) continue;
    /* O VÉU (o escurecido atrás de um painel aberto) É EXCEÇÃO DECLARADA: ele fecha no clique e
       NÃO deve parecer botão — cursor de mão numa área de meia tela convidaria ao clique errado.
       A afordância dele é o painel aberto por cima, não o cursor. */
    if (/\bid\s*=\s*["']velcro["']/.test(attrs)) continue;
    invisiveis.push({ linha: H.slice(0, m.index).split('\n').length, trecho: tudo.slice(0, 110) });
  }

  // ── 3. ÂNCORA SEM DESTINO E SEM AÇÃO ─────────────────────────────────────────────────────
  // `<a>` é o elemento com afordância mais forte da web: o navegador já dá cursor de mão e o
  // leitor de tela já anuncia "link". Um `<a>` que não leva nem faz é a mentira mais barata.
  const ancoras = [];
  for (const m of H.matchAll(/<a\b([^>]*)>/gi)) {
    const attrs = m[1];
    if (/\bhref\s*=/.test(attrs)) continue;
    if (/\bon[a-z]+\s*=/.test(attrs)) continue;
    if (/\bid\s*=/.test(attrs)) continue;
    if (/\bclass\s*=\s*["'][^"']*\bnf\b/.test(attrs)) continue;   // o .nf já tem regra própria
    ancoras.push({ linha: H.slice(0, m.index).split('\n').length, trecho: ('<a' + attrs + '>').slice(0, 110) });
  }

  // ── 4. BOTÃO SEM AÇÃO ────────────────────────────────────────────────────────────────────
  const botoes = [];
  for (const m of H.matchAll(/<button\b([^>]*)>/gi)) {
    const attrs = m[1];
    if (/\bon[a-z]+\s*=/.test(attrs)) continue;
    if (/\bid\s*=/.test(attrs)) continue;
    if (/\btype\s*=\s*["']submit/.test(attrs)) continue;
    if (/\bdata-[a-z-]+\s*=/.test(attrs)) continue;
    botoes.push({ linha: H.slice(0, m.index).split('\n').length, trecho: ('<button' + attrs + '>').slice(0, 110) });
  }

  /* ══ 7. O CLIQUE MUDO: fala com o servidor e não avisa que está falando ═════════════════════
     A régua da casa é 100ms POR INTERAÇÃO — e nenhuma rede cabe em 100ms. O que cabe é o
     RECONHECIMENTO: apagar o botão, escrever "buscando…", trocar o texto. Um clique que sai
     direto para o `fetch` fica mudo pelo tempo que a rede levar, e a pessoa clica de novo.
     >>> A varredura olha o corpo da função e pergunta: antes do PRIMEIRO `fetch`, alguma coisa
         mudou na tela? Não é medição de milissegundo (isso é do navegador) — é a conferência de
         que existe resposta imediata, que é o que a régua realmente exige.
     >>> `await` de coisa que não é rede não conta: o que trava é a viagem, não a promessa. */
  /* `pinta*()` e `render*()` CONTAM como resposta imediata: nesta casa é assim que uma tela é
     repintada a partir do estado que já está na memória, sem rede nenhuma. Sem esta linha, o
     conserto certo (mudar o estado local, repintar, e só então gravar) continuava sendo acusado
     — e assert que reclama do conserto ensina a fazer errado. */
  const RESPOSTA_IMEDIATA = /\b(innerHTML|textContent|innerText|disabled|classList|style\.|value\s*=|toast\s*\(|diz\s*\(|_marcaDb\s*\(|setAttribute|remove\s*\(|appendChild|showModal|abrirModal|fechar|pinta[A-Za-z]*\s*\(|render[A-Za-z]*\s*\()/;
  const corpoDe = nome => {
    const i = H.search(new RegExp('(?:async\\s+)?function\\s+' + nome + '\\s*\\('));
    if (i < 0) return null;
    let j = H.indexOf('{', i), prof = 0;
    if (j < 0) return null;
    for (let k = j; k < H.length; k++) {
      if (H[k] === '{') prof++;
      else if (H[k] === '}') { prof--; if (!prof) return H.slice(j, k + 1); }
    }
    return null;
  };
  const mudos = [];
  for (const nome of chamadas.keys()) {
    if (PALAVRA_DA_LINGUAGEM.has(nome) || DO_NAVEGADOR.has(nome)) continue;
    const corpo = corpoDe(nome);
    if (!corpo) continue;                      // mora num arquivo irmão: não é desta varredura
    const f = corpo.search(/\bfetch\s*\(/);
    if (f < 0) continue;
    if (RESPOSTA_IMEDIATA.test(corpo.slice(0, f))) continue;
    mudos.push({ nome, antes: corpo.slice(0, f).replace(/\s+/g, ' ').trim().slice(-90) });
  }

  const clicaveis = (H.match(/\bon(?:click|change|submit)\s*=/g) || []).length;
  const n = mortas.length + mentirosos.length + ancoras.length + botoes.length
          + promessaQuebrada.length + invisiveis.length + mudos.length;
  achadosTotais += n;
  relatorio.push({ alvo, clicaveis, irmaos, definidas: definidas.size, classesDeMao,
                   mortas, mentirosos, ancoras, botoes, promessaQuebrada, invisiveis, mudos });
}

// ── SAÍDA ───────────────────────────────────────────────────────────────────────────────────
console.log('\n═══ B12 · VARREDURA DE CLIQUE (só-leitura) ═══');
for (const r of relatorio) {
  console.log(`\n── ${r.alvo}`);
  console.log(`   elementos com ação declarada .... ${r.clicaveis}`);
  console.log(`   funções conhecidas .............. ${r.definidas}  (com ${r.irmaos.length} arquivo(s) irmão: ${r.irmaos.join(', ') || '—'})`);
  console.log(`   classes que prometem clique ..... ${r.classesDeMao.size}  (${[...r.classesDeMao].slice(0, 14).join(' ')}${r.classesDeMao.size > 14 ? ' …' : ''})`);

  const bloco = (titulo, itens, fmt) => {
    if (!itens.length) { console.log(`   ${titulo}: nenhum`); return; }
    console.log(`   ${titulo}: ${itens.length}`);
    itens.slice(0, 20).forEach(i => console.log('      · ' + fmt(i)));
    if (itens.length > 20) console.log(`      … e mais ${itens.length - 20}`);
  };
  bloco('CLIQUE MORTO (função que não existe)', r.mortas, ([n, q]) => `${n}()  — chamado ${q}x`);
  bloco('cursor de mão sem ação', r.mentirosos, i => `linha ${i.linha}: ${i.trecho}`);
  bloco('âncora sem destino e sem ação', r.ancoras, i => `linha ${i.linha}: ${i.trecho}`);
  bloco('botão sem ação', r.botoes, i => `linha ${i.linha}: ${i.trecho}`);
  bloco('classe promete clique e o elemento não cumpre', r.promessaQuebrada, i => `linha ${i.linha} [.${i.classe}]: ${i.trecho}`);
  bloco('clica mas NÃO parece que clica', r.invisiveis, i => `linha ${i.linha}: ${i.trecho}`);
  bloco('clique MUDO (vai à rede sem avisar)', r.mudos, i => `${i.nome}()  — antes do fetch: …${i.antes}`);
}
console.log(`\nTOTAL DE ACHADOS: ${achadosTotais}`);
process.exitCode = achadosTotais ? 1 : 0;
