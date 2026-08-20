/* ══════════════════════════════════════════════════════════════════════════════════════════════
   SUITE testa_token_definido — TODO `var(--x)` QUE UMA TELA USA EXISTE ONDE ELA VAI PROCURAR
   (fatia B27, 20/08/2026)

   ══ DE ONDE ELA VEIO — UM DEFEITO MEU, MEDIDO NO NAVEGADOR ══════════════════════════════════
   O `fpmed_documentos.html` é uma ILHA DE TEMA: ele não carrega o `fpmed_tema.css`, por decisão
   declarada e com teste próprio (`testa_tema_tela_propria`). A fatia B19 trouxe a escala de TEXTO
   para dentro da ilha e escreveu o motivo com todas as letras:

     "`var(--txt-1)` numa tela que não carrega o `fpmed_tema.css` é um token que ninguém define.
      Em CSS isso não dá erro nem avisa — o `font-size` inteiro fica inválido e a letra volta ao
      padrão do navegador."

   **A fatia B25 caiu na mesma armadilha, no mesmo arquivo, seis dias depois.** Ela escreveu
   `var(--esp-1/2/3)` em quatro regras novas (a etiqueta de versão, a caixa do histórico, a linha
   do histórico e o aviso de substituição) e não trouxe a grade de espaço junto. Os `--esp-*` só
   existem no `fpmed_tema.css`.

   MEDIDO EM 20/08 na tela pintada, com o navegador, e não deduzido do CSS:
     `--esp-1..4` devolvem string VAZIA no `:root`;
     `.doc .versao`  -> margin-left 0px, padding 0px  (a pastilha "versão 2" nasce COLADA no nome)
     `.hist`         -> padding-left 0px               (o histórico não recua)
     `.hist .linha`  -> padding 0px                    (as linhas colam umas nas outras)
     `.subst`        -> padding 0px                    (o aviso âmbar com o texto na borda)

   ══ E POR QUE NENHUMA DAS OITO CATRACAS PEGOU ═══════════════════════════════════════════════
   Porque nenhuma delas fazia ESTA pergunta. A `testa_espaco_token` cobra que o espaço venha da
   grade — e ele vinha: `var(--esp-2)` É a grade, escrito certo. A `testa_cor_token` cobra cor por
   token — e a cor estava certa. Todas leem a INTENÇÃO escrita na regra, e a intenção estava
   impecável. O que ninguém perguntava é se o token existe no lugar onde ESTA tela vai procurá-lo.
   >>> É a mesma família do detector cego da B26: instrumento que confirma o que eu quis dizer, em
       vez de medir o que a máquina vai fazer. A diferença é que aqui o erro era silencioso nas
       duas pontas — o CSS não reclama, e a régua elogiava.

   ══ COMO ELA DECIDE O QUE UMA TELA "ALCANÇA" ═══════════════════════════════════════════════
   O universo de tokens de um arquivo é a soma de:
     1. o que ele mesmo declara (`--x: valor` em qualquer bloco do próprio arquivo);
     2. o `fpmed_tema.css`, SE ele o carregar por `<link>`;
     3. o que o `limedtec-config.js` escreve em tempo de execução — e só quando a tela NÃO tem
        `data-tema` (o próprio `aplicaTema` sai antes de escrever quando ela tem). A lista dessas
        variáveis é lida do `limedtec-config.js`, não digitada aqui.
   Token com FALLBACK (`var(--x, 12px)`) não é cobrado: quem escreveu já respondeu à pergunta.

     node tests/testa_token_definido.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
/* ══ O COMENTÁRIO NÃO É CÓDIGO, E A PRIMEIRA VERSÃO DESTA CATRACA NÃO SABIA DISSO ═════════════
   Rodei, e ela acusou TRÊS órfãos: `--x-rgb` na L48 do documentos, `--y` na L1041 do licitações
   e `--token` na L1084 da Giovana. Fui ver os três: **os três estão dentro de comentário**, e os
   três são a PROSA EXPLICANDO A REGRA — "a forma `rgba(var(--x-rgb), .13)` é a que o próprio
   tema da casa publica", e outras duas iguais.
   >>> É O MESMO CASO QUE A `testa_numero_honesto` REGISTRA SOBRE A `fpmed_ajuda.html`: o guia só
       consegue ensinar a regra nomeando o que ela proíbe. Uma catraca que cobra do exemplo
       ensina a apagar a explicação — e explicação apagada é a causa da próxima geração do mesmo
       defeito. Cobra-se do que o navegador executa, e o navegador não executa comentário.
   `semComentario` vem da `tools/regua_visual.js` por `require`, com o cuidado dela de não
   confundir `image/*` e `https://` com abertura de comentário. Reescrever esse recorte aqui seria
   herdar de novo um defeito que o A já pagou para consertar. */
const { semComentario } = require('../tools/regua_visual.js');
const R = f => fs.readFileSync(path.join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
// o texto EXECUTÁVEL do arquivo (o comentário vira espaço, e as linhas não se deslocam — por
// isso o número de linha do achado continua sendo o número de linha do arquivo de verdade)
const Rx = f => semComentario(R(f));

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '\n        ' + e : '')); } };
console.log('SUITE testa_token_definido — todo var(--x) existe onde a tela vai procurar\n');

/* AS TELAS COBRADAS são as sete da casa. A lista é explícita e não um `*.html`: o repositório tem
   mockup, molde e página de amostra que ninguém serve, e cobrar deles encheria a catraca de
   vermelho que trabalho nenhum apaga — que é a coisa que esta casa mais combate. */
const TELAS = [
  'fpmed_licitacoes.html', 'fpmed_negocios.html', 'fpmed_giovana.html', 'fpmed_ajuda.html',
  'fpmed_documentos.html', 'fpmed_declaracoes.html', 'fpmed_pecas.html', 'fpmed_conferidor.html',
];

// As variáveis que o `aplicaTema()` escreve em tempo de execução — LIDAS do arquivo dele, para
// não existir aqui uma segunda lista envelhecendo em silêncio.
const CFG = Rx('limedtec-config.js');
const DO_TEMA_JS = new Set(
  (CFG.match(/var CORES_(?:CRUAS|LT) = \{[^}]*\}/g) || [])
    .flatMap(bloco => (bloco.match(/'(--[a-z0-9-]+)'/g) || []).map(s => s.replace(/'/g, ''))));

const TEMA_CSS = Rx('fpmed_tema.css');
const declaradosEm = txt => new Set((txt.match(/(--[a-z0-9-]+)\s*:/gi) || [])
  .map(s => s.replace(/\s*:$/, '').toLowerCase()));
const DO_TEMA_CSS = declaradosEm(TEMA_CSS);

console.log(`  universo: fpmed_tema.css declara ${DO_TEMA_CSS.size} tokens · `
  + `limedtec-config.js escreve ${DO_TEMA_JS.size} em tempo de execução\n`);
ok('0. a lista do limedtec-config.js foi lida de verdade (e não ficou vazia)', DO_TEMA_JS.size > 0,
  [...DO_TEMA_JS].join(' '));

for (const tela of TELAS) {
  const txt = Rx(tela);
  const carregaTema = /<link[^>]+fpmed_tema\.css/.test(txt);
  const temDataTema = /<html[^>]*\bdata-tema=/.test(txt);

  const universo = new Set(declaradosEm(txt));
  if (carregaTema) DO_TEMA_CSS.forEach(t => universo.add(t));
  // A tela com `data-tema` NÃO recebe nada do `aplicaTema` — ele sai antes de escrever. É por
  // isso que a ilha não pode contar com os nomes crus, e é exatamente a condição que criou o
  // defeito desta fatia. Tratar as duas iguais aqui esconderia justamente o caso perigoso.
  if (!temDataTema) DO_TEMA_JS.forEach(t => universo.add(t));

  /* USOS: `var(--x)` SEM fallback. O `[^,)]*` até a vírgula é o que separa "eu não respondi" de
     "eu respondi com um padrão" — e só o primeiro é cobrável. */
  const usados = new Map();   // token -> primeira linha em que aparece
  const re = /var\(\s*(--[a-z0-9-]+)\s*\)/gi;
  let m;
  while ((m = re.exec(txt))) {
    const t = m[1].toLowerCase();
    if (!usados.has(t)) usados.set(t, txt.slice(0, m.index).split('\n').length);
  }

  const orfaos = [...usados].filter(([t]) => !universo.has(t));
  const rot = tela + (temDataTema ? ' [ilha de tema]' : '') + (carregaTema ? ' [+tema.css]' : '');
  ok(rot + ': os ' + usados.size + ' tokens que ela usa existem onde ela procura', orfaos.length === 0,
    orfaos.length
      ? orfaos.map(([t, l]) => 'L' + l + '  ' + t + '  <- ninguém define isto para esta tela').join('\n        ')
      : undefined);
}

/* ── A PROVA DE QUE A CATRACA ENXERGA ────────────────────────────────────────────────────────
   Uma catraca que só diz "verde" nunca provou nada. Foi o defeito do detector da B26 — ele varria
   quatro telas atrás de um nome que não existia e o auto-teste dele estava verde, porque as
   fixtures saíram da mesma mão, no mesmo minuto, com o mesmo chute.
   >>> ENTÃO AQUI A PROVA NÃO USA EXEMPLO INVENTADO POR MIM: ela pega o `fpmed_documentos.html`
       DE VERDADE, apaga dele a linha da grade de espaço — recriando exatamente o estado em que o
       arquivo estava até hoje de manhã — e cobra vermelho. Se este assert ficar verde, a catraca
       está cega para o defeito que ela nasceu para pegar. */
const orfaosDe = t => {
  const x = semComentario(t);
  const uni = declaradosEm(x);
  if (/<link[^>]+fpmed_tema\.css/.test(x)) DO_TEMA_CSS.forEach(k => uni.add(k));
  if (!/<html[^>]*\bdata-tema=/.test(x)) DO_TEMA_JS.forEach(k => uni.add(k));
  return [...new Set((x.match(/var\(\s*(--[a-z0-9-]+)\s*\)/gi) || [])
    .map(s => s.replace(/var\(\s*|\s*\)/g, '').toLowerCase()))].filter(k => !uni.has(k));
};
const REAL = R('fpmed_documentos.html');
// o estado do arquivo ANTES desta fatia: a linha `--esp-1:4px;...` fora
const COMO_ERA = REAL.replace(/\n\s*--esp-1:[^\n]*\n/, '\n');
ok('P1. a catraca ACHA os órfãos no arquivo DE VERDADE sem a grade (o estado real da B25)',
  COMO_ERA !== REAL && orfaosDe(COMO_ERA).filter(t => t.startsWith('--esp-')).length >= 3,
  'mutou=' + (COMO_ERA !== REAL) + '  achou=' + orfaosDe(COMO_ERA).join(','));
ok('P2. e o mesmo arquivo, como ele está agora, passa limpo', orfaosDe(REAL).length === 0,
  orfaosDe(REAL).join(','));
const FAKE_FB = '<html data-tema="escuro"><style>:root{--a:1px}\n.x{padding:var(--esp-2, 8px)}</style>';
ok('P3. e ela NÃO cobra de quem já respondeu com fallback `var(--x, 8px)`',
  orfaosDe(FAKE_FB).length === 0, orfaosDe(FAKE_FB).join(','));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
