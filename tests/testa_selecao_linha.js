// SUITE testa_selecao_linha — A LINHA SELECIONADA, DECLARADA E MEDIDA (fatia A17, 14/08/2026).
//
// == A DECISAO DO DONO ==========================================================
// Divergencia n. 1 do docs/molde_encontrar.md, decidida em 14/08: *fica o NOSSO* —
// fundo azul claro mais a barrinha na cor do PRAZO. Razao dele, escrita: a
// barrinha carrega INFORMACAO (urgencia); no molde ela e decoracao. Informacao
// vence decoracao, e selecao invisivel e pior que divergencia.
//
// == O QUE ESTA SUITE PROTEGE ===================================================
//  1. QUE A DIVERGENCIA CONTINUE DECLARADA. Divergencia sem registro vira, dois
//     meses depois, "alguem esqueceu de copiar o molde" — e o proximo a passar
//     por ali "conserta" para o molde, apagando uma decisao do dono sem saber que
//     existiu. O registro E o conserto.
//  2. QUE A SELECAO CONTINUE VISIVEL. Selecao que existe no CSS e nao existe no
//     olho e pior que divergencia: ninguem reclama, a pessoa so clica de novo
//     achando que nao pegou.
//  3. QUE A SELECAO NAO SE CONFUNDA COM O HOVER. Se os dois degraus forem
//     parecidos, "marcado" e "o mouse passou aqui" viram o mesmo aviso, e quem
//     tira o mouse da lista deixa de saber o que marcou.
//  4. QUE NENHUM TEXTO DA LINHA CAIA ABAIXO DE AA QUANDO ELA E SELECIONADA. Este
//     foi o DEFEITO REAL que a fatia achou, e ele era CONDICIONAL: a linha nascia
//     legal e ficava ilegal no instante em que alguem a marcava. Auditoria de tela
//     parada nunca ve, porque tela parada nao tem linha selecionada.
//  5. QUE A BARRA CONTINUE SENDO A BARRA DO PRAZO — que e literalmente o motivo
//     pelo qual o dono manteve o nosso desenho.
//
//   node tests/testa_selecao_linha.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const TEMA = R('fpmed_tema.css');
const TELA = R('fpmed_licitacoes.html');
const DOC = R('docs', 'molde_encontrar.md');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_selecao_linha — a linha selecionada, declarada e medida (fatia A17)\n');

/* A ancora NAO e `^\s*`: o tema declara pares na mesma linha (tinta e fundo do mesmo sinal), e
   ancorar no comeco da linha esconderia o segundo — acusando de inexistente um token que existe. */
const tk = t => {
  const m = TEMA.match(new RegExp('(?:^|;)\\s*--' + t + '\\s*:\\s*([^;]+);', 'm'));
  return m ? m[1].trim() : null;
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
const r2 = x => Math.round(x * 100) / 100;

const NORMAL = tk('branco'), HOVER = tk('linha-hover'), SEL = tk('azul-50');

// ══════════ 1. O DESENHO E O NOSSO, E ELE E O QUE O DONO DECIDIU ══════════
ok(n + '. (controle) os tres fundos existem no tema', !!NORMAL && !!HOVER && !!SEL); n++;
ok(n + '. *** a linha selecionada usa o NOSSO azul (--azul-50), como o dono decidiu ***',
  /\.lic\.escolhida\{background:var\(--azul-50\)\}/.test(TELA)); n++;
/* Sem esta linha, passar o mouse sobre uma linha ja marcada a devolveria pro tom do hover — a
   selecao "sumiria" justamente enquanto a pessoa aponta pra ela. */
ok(n + '. ...e o hover NAO apaga a selecao (linha marcada continua marcada sob o mouse)',
  /\.lic\.escolhida:hover\{background:var\(--azul-50\)\}/.test(TELA)); n++;
/* O MOTIVO DA DECISAO DO DONO, em codigo: a barra continua pintada pelo PRAZO, e nao vira azul
   quando a linha e selecionada. Uma regra `.lic.escolhida::before{background:...}` seria adotar
   a metade do molde que o dono recusou.
   >>> EM 20/08 (fatia A38) A BARRA TROCOU DE DATA, NAO DE OFICIO: o molde v2 manda ela repetir o
       RELOGIO, que le o ENCERRAMENTO — antes ela lia a ABERTURA. As classes viraram `rel-*`. O
       que este assert guarda continua sendo o mesmo e e o que o dono decidiu: a barra carrega
       PRAZO, com os pares medidos do tema, e NADA a pinta de azul quando a linha e selecionada.
       Prender o assert ao nome antigo teria feito uma decisao de COR morrer numa renomeacao. */
ok(n + '. *** a barra da esquerda continua na cor do PRAZO — nada a pinta de azul ao selecionar ***',
  /\.lic\.rel-hoje::before\{background:var\(--sinal-perigo-barra\)\}/.test(TELA)
  && /\.lic\.rel-perto::before\{background:var\(--sinal-atencao-barra\)\}/.test(TELA)
  && !/\.lic\.escolhida::before/.test(TELA)); n++;
/* E A BARRA NAO PODE FICAR ORFA: se alguem tirar o `rel.classe` do cartao, as regras acima
   continuam no CSS e a catraca acima continua verde — com a barra azul em toda linha. */
ok(n + '. ...e a classe do relogio E de fato aplicada no cartao (regra viva, nao CSS orfao)',
  /class="lic clicavel'\+rel\.classe\+/.test(TELA)
  && /const rel = relogioPrazo\(l\.dataEncerramentoProposta, agora\);/.test(TELA)); n++;

// ══════════ 2. A DIVERGENCIA ESTA DECLARADA, COM A RAZAO ══════════
/* Divergencia sem registro vira "alguem esqueceu de copiar o molde", e o proximo a passar por
   ali conserta pro molde — apagando uma decisao do dono sem saber que ela existiu. */
ok(n + '. *** a divergencia esta DECLARADA em docs/molde_encontrar.md ***',
  /DIVERG[ÊE]NCIA DECLARADA/i.test(DOC)); n++;
ok(n + '. *** e a RAZAO do dono esta escrita: a barra carrega prazo, e informacao vence decoracao ***',
  /informa[çc][ãa]o vence decora[çc][ãa]o/i.test(DOC)); n++;
ok(n + '. ...e ela nao ficou mais listada como pergunta em aberto pro dono',
  !/Decis[ãa]o do dono: manter os dois azuis nossos, ou adotar o par completo do molde\?/.test(DOC)); n++;
/* A medicao tem que estar NO DOC, e nao so num terminal que ninguem guardou. */
ok(n + '. *** os numeros medidos estao no doc (contraste declarado, nao prometido) ***',
  /9,57 pts/.test(DOC) && /5,57:1/.test(DOC) && /4,14:1/.test(DOC)); n++;

// ══════════ 3. A SELECAO E VISIVEL, E NAO SE CONFUNDE COM O HOVER ══════════
const degrauSel = Math.abs(lum(SEL) - lum(NORMAL));
const degrauHover = Math.abs(lum(HOVER) - lum(NORMAL));
/* DOIS FUNDOS CLAROS NAO ALCANCAM 3:1 sem virar azul-marinho, e uma lista listrada de cor forte
   seria pior de ler. O criterio honesto e o degrau de luminancia — e o assert declara que e
   isso que esta sendo medido, em vez de fingir que 1,10:1 e um numero bom. */
ok(n + '. *** a selecao marca a linha (degrau de luminancia contra o branco) ***',
  degrauSel * 100 >= 8, { pts: r2(degrauSel * 100), razaoWCAG: r2(razao(SEL, NORMAL)) }); n++;
ok(n + '. *** e ela e pelo menos o DOBRO do hover (marcado nao se confunde com "mouse aqui") ***',
  degrauSel >= degrauHover * 2,
  { selecao: r2(degrauSel * 100), hover: r2(degrauHover * 100) }); n++;
/* O AVISO PRIMARIO DA SELECAO NAO E O FUNDO, E ISSO PRECISA ESTAR DITO: e a caixa NATIVA
   marcada, que traz teclado, leitor de tela e contraste de sistema. O fundo e reforco. Sem a
   caixa, um fundo de 1,10:1 seria a unica pista de estado — e ai seria pouco. */
ok(n + '. *** o aviso primario e a CAIXA nativa marcada; o fundo e reforco ***',
  /aria-label="selecionar esta licita/.test(TELA)
  && /\.lic \.sel input\{[^}]*accent-color:var\(--azul-600\)/.test(TELA)); n++;
ok(n + '. ...e o acento dela passa 3:1 sobre o fundo selecionado (objeto grafico)',
  razao(tk('azul-600'), SEL) >= 3, r2(razao(tk('azul-600'), SEL))); n++;

// ══════════ 4. O DEFEITO CONDICIONAL QUE A FATIA ACHOU ══════════
/* ══ O ACHADO DA A17 ═══════════════════════════════════════════════════════════════════════
   O --cinza-500 e o cinza mais claro que ainda passa em AA — e passa POR 0,05 SOBRE O BRANCO
   (4,55:1). O fundo da linha selecionada nao e branco. Medido sobre o --azul-50 ele cai pra
   4,14:1 e REPROVA: a linha nascia legal e ficava ilegal ao ser marcada.
   Este assert le os tons DAS REGRAS `.lic` da tela — nao de uma lista escrita aqui, que
   envelheceria calada no dia em que alguem acrescentasse um `color:` novo na linha. */
const regrasDaLinha = (TELA.match(/^\.lic[^{\n]*\{[^}]*\}/gm) || []).join('\n');
const tonsDaLinha = [...new Set(
  [...regrasDaLinha.matchAll(/(?:^|[;{\s])color\s*:\s*var\((--[a-z0-9-]+)\)/g)].map(m => m[1].slice(2))
)];
ok(n + '. (controle) achei os tons de texto da linha lendo as regras `.lic` da tela',
  tonsDaLinha.length >= 3, tonsDaLinha); n++;
const reprovam = tonsDaLinha
  .map(t => ({ token: t, sobreSelecao: r2(razao(tk(t), SEL)) }))
  .filter(x => x.sobreSelecao < 4.5);
ok(n + '. *** TODO texto da linha continua em AA depois de selecionada (o achado da A17) ***',
  reprovam.length === 0, reprovam); n++;
/* CONTROLE POSITIVO: sem ele o assert acima ficaria verde numa tela sem texto nenhum. E ele
   prova o achado — o tom que estava la reprova mesmo. */
ok(n + '. (controle) e o --cinza-500 REPROVA sobre a selecao — era ele que estava na linha',
  razao(tk('cinza-500'), SEL) < 4.5 && razao(tk('cinza-500'), NORMAL) >= 4.5,
  { sobreSelecao: r2(razao(tk('cinza-500'), SEL)), sobreBranco: r2(razao(tk('cinza-500'), NORMAL)) }); n++;
ok(n + '. ...e a linha nao usa mais o --cinza-500 como cor de texto',
  !/(?:^|[;{\s])color:var\(--cinza-500\)/.test(regrasDaLinha)); n++;

// ══════════ 5. A BARRA DE PRAZO, MEDIDA CONTRA O FUNDO NOVO ══════════
/* O criterio certo importa nas DUAS direcoes. O 1.4.11 pede 3:1 para objeto grafico *necessario
   para entender o conteudo*, e abre excecao pro que tambem esta EM TEXTO. Aqui esta: toda linha
   traz a pilula "abre hoje" / "abre amanha" / "abre em N dias" / "sessao ja passou".
   >>> O QUE ESTA FATIA RESPONDE E "a selecao estragou?", nao "esta barra e forte?". Uma barra
       que ja era fraca no branco continua fraca — assunto de outra fatia. */
const BARRAS = ['sinal-perigo-barra', 'sinal-atencao-barra', 'sinal-normal-barra', 'cinza-300'];
const derrubadas = BARRAS.filter(t => razao(tk(t), NORMAL) >= 3 && razao(tk(t), SEL) < 3);
ok(n + '. *** nenhuma barra de prazo passa a reprovar POR CAUSA da selecao ***',
  derrubadas.length === 0, derrubadas); n++;
/* E A PILULA E QUEM SUSTENTA A EXCECAO — entao ela e medida, e nao citada de boca. Se ela um dia
   reprovar, a barra fraca perde a cobertura de texto e vira defeito de verdade. */
const pilulas = [['perigo'], ['atencao'], ['normal'], ['neutro']]
  .map(([b]) => ({ sinal: b, razao: r2(razao(tk('sinal-' + b + '-tinta'), tk('sinal-' + b + '-fundo'))) }));
ok(n + '. *** a urgencia esta em TEXTO legivel em toda linha (a barra e reforco, nao a unica fonte) ***',
  pilulas.every(x => x.razao >= 4.5), pilulas.filter(x => x.razao < 4.5)); n++;
ok(n + '. (controle) e a pilula realmente aparece em toda linha, com as quatro palavras',
  /abre hoje/.test(TELA) && /abre amanhã/.test(TELA)
  && /abre em '\+diff\+' dias/.test(TELA) && /sessão já passou/.test(TELA)); n++;

// ══════════ 6. A MEDICAO E REPRODUZIVEL ══════════
/* Numero em documento sem ferramenta que o refaca e numero que ninguem confere de novo. */
ok(n + '. *** existe a ferramenta que refaz a medicao (tools/mede_selecao.js) ***',
  fs.existsSync(path.join(__dirname, '..', 'tools', 'mede_selecao.js'))); n++;
ok(n + '. ...e o doc aponta pra ela',
  /tools\/mede_selecao\.js/.test(DOC)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
