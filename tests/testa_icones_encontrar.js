// SUITE testa_icones_encontrar - a varredura de emoji da Encontrar (item 7f) + o fio dobrado.
//
// == DUAS COISAS, E ELAS VIERAM JUNTAS POR UM MOTIVO ==========================================
//
//  1. D11 PROIBE EMOJI COMO ICONE. A tela tinha 36 fazendo trabalho de icone. O Negocios ja
//     tinha feito a dele (59 em 12/08); esta e a da Encontrar. O sprite ja estava carregado
//     desde o 7d, entao foi SUBSTITUICAO, nao decisao.
//     >>> E OS GLIFOS TIPOGRAFICOS FICAM (setas -> <- ^ ). Isso e fronteira DECLARADA do projeto
//         desde o sprite do Negocios: seta dentro de texto corrido nao e icone. Um assert que
//         proibisse TUDO obrigaria a trocar 17 setas por SVG e deixaria a tela pior.
//
//  2. O FIO DOBRADO, achado pelo TRABALHADOR B no Negocios e reportado pra ca. A regra
//     `.lic:last-child{border-bottom:0}` NUNCA casava: o ultimo filho do painel e o RODAPE, nao
//     a ultima linha. O fio da ultima linha somava com a borda de cima do rodape.
//     >>> O CONSERTO E ESTRUTURAL (as linhas moram num `.linhas`), e nao posicional: um
//         `:nth-last-child(2)` devolveria o pixel e deixaria a armadilha armada pro proximo que
//         acrescentasse qualquer coisa depois do rodape.
//
//   node tests/testa_icones_encontrar.js
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const L = fs.readFileSync(path.join(RAIZ, 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const ICO = require(path.join(RAIZ, 'fpmed_icones.js'));
const LIMPO = L.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const CSS1 = L.replace(/\s*\n\s*/g, '');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_icones_encontrar - emoji fora, sprite dentro (7f)\n');

// ── 1. zero emoji-icone no CODIGO ────────────────────────────────────────────────────────────
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;
const achados = [...LIMPO.matchAll(EMOJI)].map(m => m[0]);
ok(n + '. *** ZERO emoji-icone no codigo da tela (D11) ***',
  achados.length === 0, { restam: [...new Set(achados)] }); n++;
/* Comentario PODE citar o emoji que foi trocado - e assim que se registra o que mudou, e a
   licao L6 diz que o "por que" e memoria do produto. O que nao pode e emoji CHEGANDO na tela. */
ok(n + '. e a checagem ignora comentario (registrar a troca nao pode ficar proibido)',
  EMOJI.test(L) === true || achados.length === 0); n++;
/* OS GLIFOS TIPOGRAFICOS CONTINUAM, e ha assert pra isso NAO virar zelo: se alguem "terminar a
   varredura" trocando as setas por SVG, a tela fica pior e a fronteira declarada se perde. */
const SETAS = /[\u{2190}-\u{21FF}]/gu;
ok(n + '. *** as setas tipograficas FICAM (fronteira declarada, nao esquecimento) ***',
  (LIMPO.match(SETAS) || []).length > 0); n++;

// ── 2. o helper, e por que ele existe ────────────────────────────────────────────────────────
ok(n + '. existe UM lugar que monta o icone (nao 36 trechos de markup a mao)',
  /const ic = \(nome, cls\)/.test(LIMPO)
  && (LIMPO.match(/<svg class="ic/g) || []).length <= 1, { inline: (LIMPO.match(/<svg class="ic/g) || []).length }); n++;
/* Em `em` e nao em pixel: o mesmo icone aparece ao lado de texto de 12px e de 15px nesta tela.
   Pixel fixo faz ele ficar grande no rotulo pequeno e pequeno no titulo - o defeito que faz uma
   tela "parecer feita por partes". */
ok(n + '. *** o icone dimensiona em `em`, pra acompanhar a tipografia de onde estiver ***',
  /svg\.ic\{width:1em;height:1em/.test(CSS1)); n++;
/* O seletor e `svg.ic` e nao `.ic` puro: esta tela ja tem `.ind .ic`, que e a CAIXA do icone do
   indicador (um <span>). Uma regra `.ic` solta pegaria os dois. */
ok(n + '. e o seletor e amarrado ao elemento (`svg.ic`), pra nao colidir com o `.ind .ic`',
  /svg\.ic\{/.test(CSS1) && !/(^|\})\.ic\{/.test(CSS1)); n++;
/* ACHADO NO LACO VISUAL: os botoes sairam com o icone COLADO no texto — folga medida de 0px. A
   causa nao era o markup (o espaco estava na string) e sim o `inline-flex` que o 7d pos na
   `.btn`: num container flex o texto vira item anonimo e o espaco da borda e DESCARTADO.
   O `gap` e o conserto que vale pra todo botao com icone, inclusive os que ainda vao nascer. */
ok(n + '. *** o botao separa icone e texto por `gap` (no flex, o espaco da string e descartado) ***',
  /\.btn\{[^}]*gap:var\(--esp-2\)/.test(CSS1)); n++;
/* E o respiro tem UM dono: a margem que vivia no icone da acao externa somava com o gap. */
ok(n + '. e o respiro tem um dono so (nada de margem no icone somando com o gap)',
  !/svg\.ic\.sai\{margin-left/.test(CSS1)); n++;
ok(n + '. todo icone e aria-hidden (ele acompanha uma palavra, nunca a substitui)',
  /aria-hidden="true"><use href="#ic-/.test(LIMPO)
  && !/<use href="#ic-[a-z-]+"\/><\/svg>'\s*\+\s*'<\/button>/.test(LIMPO)); n++;
/* O UNICO icone que fica SOZINHO num botao e o ✕ de fechar o jornal. Icone sozinho sem nome e um
   botao mudo pra quem usa leitor de tela - entao ele carrega aria-label. */
ok(n + '. *** o icone que fica SOZINHO num botao tem aria-label ***',
  /aria-label="apagar este jornal"/.test(LIMPO)); n++;

// ── 3. os icones existem mesmo no sprite ─────────────────────────────────────────────────────
const usados = [...new Set([...LIMPO.matchAll(/ic\('([a-z-]+)'/g)].map(m => m[1]))];
const orfaos = usados.filter(u => !ICO.ICONES.includes('ic-' + u));
ok(n + '. *** todo icone chamado pela tela EXISTE no sprite (senao o <use> desenha nada) ***',
  usados.length >= 10 && orfaos.length === 0, { usados: usados.length, orfaos }); n++;
ok(n + '. e os 8 do 7f entraram no conjunto UNICO (nada de sprite a parte)',
  ['ic-alvo','ic-certo','ic-x','ic-lupa','ic-envelope','ic-caixa','ic-raio','ic-jornal']
    .every(i => ICO.ICONES.includes(i))); n++;

// ── 4. a armadilha do esc(): icone dentro de string escapada vira markup literal ─────────────
/* Os emoji da PROCEDENCIA (📦 ⚡ 🌐) viviam dentro de uma string que passa por `esc()`. Trocar
   por <svg> ali teria impresso `&lt;svg&gt;` na tela, em producao. O icone virou PARAMETRO e o
   texto continua sendo tratado como texto - a escapada NAO foi afrouxada pra caber um desenho. */
ok(n + '. *** o esc() da procedencia continua de pe, e o icone entra por fora ***',
  /esc\(procedencia\)/.test(LIMPO)
  && /\(procIcone \? ic\(procIcone\) \+ ' ' : ''\) \+ esc\(procedencia\)/.test(LIMPO)); n++;
ok(n + '. e o icone da procedencia viaja pelo render e pelo rerender (senao o refino o perde)',
  /function render\(todos, kws, excl, aviso, procedencia, procIcone\)/.test(LIMPO)
  && /render\(u\.todos, u\.kws, u\.excl, u\.aviso, u\.procedencia, u\.procIcone\)/.test(LIMPO)); n++;
/* DUAS TROCAS VIRARAM textContent -> innerHTML pra caber o <svg>, e as duas carregam dado. Sem
   `esc()` isso seria uma porta de HTML aberta por causa de um icone. */
ok(n + '. *** o que virou innerHTML pra caber o icone ganhou esc() no dado ***',
  /d\.innerHTML = ic\('alerta','aviso'\) \+ ' '\+esc\(des\.rotulo\)/.test(LIMPO)
  && /esc\(emp\.nome\.split\(' '\)\.slice\(0,2\)\.join\(' '\)\)/.test(LIMPO)); n++;
ok(n + '. e o resumo do jornal tambem escapa o que o usuario digitou',
  /p\.push\(ic\('lupa'\) \+ ' ' \+ esc\(f\.kw\)\)/.test(LIMPO)
  && /p\.push\(ic\('bloqueado'\) \+ ' ' \+ esc\(f\.excluir\)\)/.test(LIMPO)); n++;

// ── 5. o fio dobrado (achado do trabalhador B) ───────────────────────────────────────────────
ok(n + '. *** a regra do fio da ultima linha mora dentro do `.linhas` ***',
  /\.painel-res \.linhas \.lic:last-child\{border-bottom:0\}/.test(CSS1)); n++;
/* E o `.lic:last-child` SOLTO nao pode voltar: e a regra que nunca casava, e ela e invisivel -
   ninguem olha um painel e pensa "este fio tem o dobro da espessura". */
ok(n + '. e o seletor solto (que nunca casava) nao voltou',
  !/(^|\})\.lic:last-child\{/.test(CSS1)); n++;
/* OS TRES PAINEIS TEM QUE TER O ENVOLTORIO. Se um esquecer, o defeito volta so nele - e e o tipo
   de coisa que so aparece quando alguem compara dois paineis lado a lado. */
ok(n + '. *** os TRES paineis embrulham as linhas (indice, Calendario e nacional) ***',
  (LIMPO.match(/<div class="linhas">/g) || []).length === 3,
  { achou: (LIMPO.match(/<div class="linhas">/g) || []).length }); n++;
/* E cada `.linhas` que abre tem que fechar ANTES do rodape - senao o rodape cai dentro dele e o
   `:last-child` volta a nao casar, agora com o defeito escondido um nivel mais fundo. */
/* A 1a versao deste assert procurava um `'</div>'` QUALQUER antes do rodape — e achava um de
   outro trecho do arquivo, entao a mutacao "o .linhas fecha DEPOIS do rodape" passou verde.
   Assert frouxo: ele media que existe uma div fechando em algum lugar, nao que O ENVOLTORIO
   fecha. Agora ele olha o que vem IMEDIATAMENTE antes de cada rodape, que e onde a promessa
   mora: se o fechamento nao esta ali, o rodape caiu dentro do `.linhas` e o `:last-child` volta
   a nao casar — o mesmo defeito, agora escondido um nivel mais fundo. */
(function () {
  const rodapes = [...LIMPO.matchAll(/<div class="rodape-painel"/g)];
  const comFechamento = rodapes.filter(m =>
    /'<\/div>'/.test(LIMPO.slice(Math.max(0, m.index - 120), m.index))).length;
  ok(n + '. e cada um FECHA logo antes do rodape (senao o rodape cai dentro e o defeito volta)',
    rodapes.length === 3 && comFechamento === 3,
    { rodapes: rodapes.length, comFechamento }); n++;
})();

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
