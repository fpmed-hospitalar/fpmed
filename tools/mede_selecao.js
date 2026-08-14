/* ══════════════════════════════════════════════════════════════════════════════════════════
   mede_selecao.js — A LINHA SELECIONADA, MEDIDA (fatia A17, 14/08/2026)

   O dono decidiu a divergência nº 1 do `docs/molde_encontrar.md`: *fica o NOSSO* — fundo azul
   claro mais a barrinha na cor do PRAZO. Razão dele: a barrinha carrega INFORMAÇÃO (urgência)
   e no molde ela é decoração; informação vence decoração.

   A decisão fecha o "qual azul", e ABRE a pergunta que esta ferramenta responde: *o nosso azul
   dá para ver?* Uma seleção que existe no CSS e não existe no olho é pior que a divergência,
   porque ninguém reclama dela — a pessoa só clica de novo achando que não pegou.

   >>> O QUE SE MEDE AQUI NÃO É CONTRASTE DE TEXTO. São dois FUNDOS vizinhos, e o critério certo
       é o 1.4.11 da WCAG (não-texto): 3:1 para o que precisa ser distinguido. Dois fundos claros
       de uma lista não alcançam 3:1 sem virar azul-marinho — e a lista inteira ficaria listrada
       de cor forte. Por isso a leitura honesta é DUPLA e está impressa abaixo:
         · a razão WCAG entre os fundos (o número que a regra pede), e
         · o degrau de LUMINÂNCIA em pontos (o número que diz se o olho separa).
       Declarar só o primeiro esconderia que ele não se aplica bem aqui; declarar só o segundo
       seria inventar uma métrica pra fugir da regra. Os dois, com o motivo escrito.

   >>> E MEDE-SE TAMBÉM O QUE A REGRA REALMENTE COBRA: o TEXTO por cima do fundo selecionado, e
       a BARRINHA DE PRAZO contra ele — porque a decisão do dono é justamente manter a barra, e
       manter uma barra que some no fundo novo seria manter o nome dela, não a informação.

     node tools/mede_selecao.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const TEMA = fs.readFileSync(path.join(RAIZ, 'fpmed_tema.css'), 'utf8');

/* O ANCORAGEM NÃO PODE SER `^\s*`, E ISSO CUSTOU UM SUSTO: o tema declara PARES na mesma linha
   (`--sinal-perigo-tinta: #B42318;   --sinal-perigo-fundo: #FEF0EF;`), e um leitor ancorado no
   começo da linha não enxerga o segundo. Eu quase declarei que `--sinal-perigo-fundo` não
   existia — ou seja, quase reportei como defeito o meu próprio leitor. */
const tk = t => {
  const m = TEMA.match(new RegExp('(?:^|;)\\s*--' + t + '\\s*:\\s*([^;]+);', 'm'));
  if (!m) throw new Error('token --' + t + ' não existe no fpmed_tema.css');
  return m[1].trim();
};
const lum = hex => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map(i => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const f2 = x => (Math.round(x * 100) / 100).toFixed(2);
const pts = (a, b) => (Math.round(Math.abs(lum(a) - lum(b)) * 10000) / 100).toFixed(2);

const NORMAL = tk('branco');          // .lic          — a linha em repouso
const HOVER = tk('linha-hover');      // .lic:hover    — o mouse está aqui
const SEL = tk('azul-50');            // .lic.escolhida — a linha selecionada

console.log('=== A LINHA SELECIONADA, MEDIDA (fatia A17) ===\n');
console.log('  normal ..... --branco       ' + NORMAL);
console.log('  hover ...... --linha-hover  ' + HOVER);
console.log('  selecionada  --azul-50      ' + SEL + '\n');

console.log('  PAR                              WCAG     degrau de luminância');
const par = (rot, a, b) => console.log('  ' + rot.padEnd(32) + f2(razao(a, b)).padStart(5) + ':1'
  + ('  ' + pts(a, b) + ' pts').padStart(22));
par('selecionada x normal', SEL, NORMAL);
par('selecionada x hover', SEL, HOVER);
par('hover x normal (referência)', HOVER, NORMAL);

/* A COMPARAÇÃO QUE DECIDE: a seleção precisa ser MAIS visível que o hover. Se o degrau dela for
   parecido com o do hover, "selecionado" e "o mouse passou aqui" viram o mesmo aviso — e a
   pessoa deixa de saber o que está marcado quando tira o mouse da lista. */
const degrauSel = Math.abs(lum(SEL) - lum(NORMAL));
const degrauHover = Math.abs(lum(HOVER) - lum(NORMAL));
console.log('\n  a seleção é ' + (degrauSel / degrauHover).toFixed(1) + 'x mais marcada que o hover'
  + '  (' + pts(SEL, NORMAL) + ' pts contra ' + pts(HOVER, NORMAL) + ')');
console.log('  ' + (degrauSel > degrauHover * 2
  ? '>>> PASSA: selecionado e "mouse em cima" não se confundem.'
  : '>>> REPROVA: selecionado ficou parecido demais com o hover.'));

/* E A SELEÇÃO NÃO É SÓ O FUNDO. O molde compensa o fundo quase-branco dele virando a barra da
   esquerda de azul; o dono decidiu que a NOSSA barra continua na cor do prazo. Então quem
   carrega o "estou selecionado" aqui é o fundo sozinho — e é por isso que ele é mais azul. */
/* ══ OS TONS SÃO LIDOS DA TELA, E NÃO ESCRITOS AQUI À MÃO ══════════════════════════════════
   O primeiro rascunho desta ferramenta tinha uma lista de tokens digitada por mim, e ela é
   exatamente o tipo de lista que envelhece calada: alguém acrescenta um `color:` novo dentro de
   `.lic` e a medição continua verde sobre uma tela que mudou. Agora a lista sai das REGRAS de
   `.lic` do `fpmed_licitacoes.html` — se nascer um tom novo na linha, ele aparece aqui sozinho. */
const TELA = fs.readFileSync(path.join(RAIZ, 'fpmed_licitacoes.html'), 'utf8');
const regrasDaLinha = (TELA.match(/^\.lic[^{\n]*\{[^}]*\}/gm) || []).join('\n');
const tonsDeTexto = [...new Set(
  [...regrasDaLinha.matchAll(/(?:^|[;{\s])color\s*:\s*var\((--[a-z0-9-]+)\)/g)].map(m => m[1].slice(2))
)];

console.log('\n  --- o TEXTO por cima do fundo selecionado (AA = 4,5:1) ---');
console.log('  (tons lidos das regras `.lic` do fpmed_licitacoes.html, não de uma lista à mão)');
let textoReprova = 0;
for (const t of tonsDeTexto) {
  const rSel = razao(tk(t), SEL), rNor = razao(tk(t), NORMAL);
  const mal = rSel < 4.5;
  if (mal) textoReprova++;
  console.log('  --' + t.padEnd(10) + tk(t) + '  sobre selecionada ' + f2(rSel).padStart(6) + ':1'
    + '  (sobre normal ' + f2(rNor) + ':1)  ' + (mal ? 'REPROVA' : 'passa'));
}
console.log('  ' + (textoReprova
  ? '>>> ' + textoReprova + ' tom(ns) de texto REPROVAM quando a linha está selecionada.'
  : '>>> todo texto da linha continua em AA depois de selecionada.'));

/* ══ A BARRINHA DE PRAZO — O MOTIVO DA DECISÃO DO DONO, E O QUE A MEDIÇÃO DIZ DELA ═══════════
   O dono manteve o nosso desenho porque *a barrinha carrega INFORMAÇÃO (urgência)*. Então ela
   tem que ser medida, e medida contra o fundo NOVO: na linha selecionada o vizinho dela é o
   --azul-50, e não mais o branco.

   >>> E O CRITÉRIO PRECISA SER O CERTO, SENÃO A MEDIÇÃO MENTE NAS DUAS DIREÇÕES. O 1.4.11 da
       WCAG pede 3:1 para objeto gráfico *necessário para entender o conteúdo* — e abre exceção
       para o que também está disponível EM TEXTO. Aqui a urgência está: toda linha traz a
       pílula "abre hoje" / "abre amanhã" / "abre em N dias" / "sessão já passou", com tinta e
       fundo escolhidos juntos. A barra é o atalho do olho; a pílula é a informação.
   >>> POR ISSO A SAÍDA IMPRIME OS DOIS FUNDOS. Se uma barra estiver fraca na seleção E fraca no
       branco, o problema não é da seleção — é dela, e é antigo. Chamar isso de defeito da fatia
       seria culpar a mudança errada. */
console.log('\n  --- a BARRA DE PRAZO contra o fundo selecionado (objeto gráfico) ---');
const barras = [
  ['hoje    (perigo)', 'sinal-perigo-barra'],
  ['amanhã  (atenção)', 'sinal-atencao-barra'],
  ['depois  (normal)', 'sinal-normal-barra'],
  ['encerrada', 'cinza-300'],
];
let piorouComSelecao = 0;
for (const [rot, t] of barras) {
  const rSel = razao(tk(t), SEL), rNor = razao(tk(t), NORMAL);
  /* O QUE ESTA FATIA RESPONDE É "a seleção estragou?", e não "esta barra é forte?". Uma barra
     que já era fraca no branco continua fraca — isso é assunto de outra fatia, e a saída diz. */
  const cruzou = rNor >= 3 && rSel < 3;
  if (cruzou) piorouComSelecao++;
  console.log('  ' + rot.padEnd(20) + tk(t) + '  sobre selecionada ' + f2(rSel).padStart(5) + ':1'
    + '  (sobre normal ' + f2(rNor) + ':1)  '
    + (cruzou ? 'A SELEÇÃO DERRUBOU' : rSel >= 3 ? 'passa 3:1' : 'fraca nos DOIS fundos (não é da seleção)'));
}
console.log('\n  ' + (piorouComSelecao
  ? '>>> ' + piorouComSelecao + ' barra(s) passavam no branco e param de passar na seleção — isto É da fatia.'
  : '>>> nenhuma barra passa a reprovar POR CAUSA da seleção.'));

/* A PÍLULA É QUEM SUSTENTA A EXCEÇÃO ACIMA, então ela é medida aqui — e não citada de boca.
   Se ela um dia reprovar, a barra fraca deixa de ter cobertura e vira defeito de verdade. */
console.log('\n  --- a PÍLULA de urgência, que diz a MESMA coisa em palavras (AA = 4,5:1) ---');
let pilulaMal = 0;
for (const [rot, base] of [['hoje', 'perigo'], ['amanhã', 'atencao'], ['depois', 'normal'], ['encerrada', 'neutro']]) {
  const r = razao(tk('sinal-' + base + '-tinta'), tk('sinal-' + base + '-fundo'));
  if (r < 4.5) pilulaMal++;
  console.log('  ' + rot.padEnd(12) + tk('sinal-' + base + '-tinta') + ' sobre ' + tk('sinal-' + base + '-fundo')
    + '  ' + f2(r).padStart(6) + ':1  ' + (r >= 4.5 ? 'passa' : 'REPROVA'));
}
console.log('  ' + (pilulaMal
  ? '>>> ' + pilulaMal + ' pílula(s) REPROVAM — a barra fraca perde a cobertura de texto.'
  : '>>> a urgência está em texto legível em toda linha: a barra é reforço, não a única fonte.'));

console.log('\n(os números desta saída são os que estão declarados em docs/molde_encontrar.md)');
