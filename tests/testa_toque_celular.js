/* CATRACA 5/8 — testa_toque_celular (fatia A28, 15/08/2026)
   REPROVA: alvo declarado abaixo de 44px dentro de `@media (max-width:480px)`; `min-height` em
   elemento inline (que não faz nada); e — a parte que quase não entrou — a AUSÊNCIA de alvos.

   ══ O NÚMERO MAIS PERIGOSO QUE UMA MEDIÇÃO PODE DEVOLVER ════════════════════════════════════
   Quando a régua desta fatia mediu a Encontrar pela primeira vez, ela disse "0 alvos curtos".
   Estava CERTA e era INÚTIL: a tela tinha uma única linha de @media(max-width:480px) — a grade
   dos indicadores virando uma coluna — e nenhum alvo declarado. Zero curtos porque zero alvos.
   >>> É a PARTE 4 da BASE_VISUAL na versão mais barata: "tela com portão de login medida sem
       sessão mede a moldura". Aqui a régua media um cômodo que ninguém tinha construído, e
       devolvia saúde. Por isso a catraca EXIGE que os alvos existam. Ausência não é aprovação.

   ══ OS DOIS CASOS PERIGOSOS, QUE O MOLDE NOMEIA ═════════════════════════════════════════════
   1. BOTÃO SÓ DE ÍCONE: texto dá largura de graça, ícone não. Com só `min-height` ele vira uma
      tira alta e estreita — 44 de altura e 15 de largura não é um alvo de 44.
   2. `min-height` EM ELEMENTO INLINE não faz nada. `<a>` e `<span>` precisam de `inline-flex`
      (ou block) para aceitar altura. Um CSS que promete 44 e entrega 17 é pior que um que
      declara 17: o primeiro passa em auditoria de leitura de arquivo.

   ══ E O QUE NÃO É ALVO ══════════════════════════════════════════════════════════════════════
   O `::before` da caixinha de marcar e o `<svg>` dentro do botão são o DESENHO. A receita do
   molde é justamente "alvo de 44 transparente + quadradinho de 18 no miolo": uma catraca que
   contasse a peça de dentro reprovaria exatamente quem obedeceu. Os dois defeitos já foram
   pagos — um pelo trabalhador B, outro por esta régua — e estão registrados no instrumento.

     node tests/testa_toque_celular.js
   ──────────────────────────────────────────────────────────────────────────────────────────── */
'use strict';
const { catraca, onde, R } = require('./catraca.js');

/* Tela que não tem elemento clicável nenhum não precisa de bloco de celular. A pergunta é feita
   ao ARQUIVO, e não presumida: se há `onclick`, `<button>` ou `.btn`, há dedo para acomodar. */
const temClique = txt => /<button\b|onclick=|class="btn|\.btn\b|role\s*=\s*["']button/i.test(txt);

const regra = ({ arquivo, r, ok }) => {
  const txt = R.semComentario(R.leia(arquivo));
  const clicavel = temClique(txt);

  if (clicavel) {
    ok(arquivo + ' declara bloco de celular (@media max-width:480px) — ele TEM elemento clicável',
      r.toque.temBloco,
      'nenhum @media (max-width:480px) no arquivo. "0 alvos curtos" aqui significa '
      + '"0 alvos", e ausencia nao e aprovacao');

    /* E o bloco tem de declarar alvos DE VERDADE, não só ajustar a grade. Conta quantas regras
       ali dentro chegam aos 44 — se a resposta é zero, o bloco existe e não serve. */
    const alvos = contaAlvos(txt);
    ok(arquivo + ': o bloco de celular declara alvos de ' + R.ALVO_TOQUE + 'px ('
      + alvos + ' regra(s))',
      !r.toque.temBloco || alvos > 0,
      'o bloco existe mas nao declara nenhum alvo de 44px — ele ajusta o layout e deixa o dedo '
      + 'de fora');
  }

  ok('nenhum alvo abaixo de ' + R.ALVO_TOQUE + 'px no celular, em ' + arquivo
    + ' (' + r.toque.curtos.length + ')',
    r.toque.curtos.length === 0,
    r.toque.curtos.length
      ? onde(arquivo, r.toque.curtos, a => a.prop + ':' + a.valor + 'px em `' + a.seletor + '`') : '');

  ok('nenhuma promessa vazia de altura em elemento inline, em ' + arquivo
    + ' (' + r.toque.promessaVazia.length + ')',
    r.toque.promessaVazia.length === 0,
    r.toque.promessaVazia.length
      ? onde(arquivo, r.toque.promessaVazia, a => '`' + a.seletor + '` pede min-height:'
          + a.valor + 'px sem display — em elemento inline isso nao pinta nada') : '');
};

/* Conta regras que declaram 44px (ou mais) de altura OU largura dentro do bloco de celular.
   O 44 é lido do instrumento, não digitado aqui — duas fontes para o mesmo número é como uma
   envelhece calada. */
function contaAlvos(txt) {
  let n = 0;
  for (const m of txt.matchAll(/@media([^{]*)\{/g)) {
    const cond = /max-width\s*:\s*(\d+)px/.exec(m[1]);
    if (!cond || Number(cond[1]) > 480) continue;
    let i = m.index + m[0].length, prof = 1;
    while (i < txt.length && prof > 0) { if (txt[i] === '{') prof++; else if (txt[i] === '}') prof--; i++; }
    const corpo = txt.slice(m.index, i);
    for (const d of corpo.matchAll(/\b(min-height|height|min-width|width)\s*:\s*([\d.]+)px/gi))
      if (parseFloat(d[2]) >= R.ALVO_TOQUE) n++;
  }
  return n;
}

regra.conta = r => r.toque.temBloco
  ? (r.toque.curtos.length + ' alvo(s) curto(s) em ' + r.toque.blocos + ' bloco(s)')
  : 'SEM bloco de celular';

catraca('testa_toque_celular', 'alvo de 44x44 no celular — e ausencia nao e aprovacao', regra);
