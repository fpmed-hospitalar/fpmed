/* ══════════════════════════════════════════════════════════════════════════════════════════════
   mede_rampa_ilha.js — AS DUAS RAMPAS DE TOM DA ILHA ESCURA, COM O CONTRASTE CALCULADO
   (fatia B27, 20/08/2026)

   ══ POR QUE ESTE ARQUIVO EXISTE ═════════════════════════════════════════════════════════════
   A PENDÊNCIA 4 que eu subi na rodada 8 era: *"a ilha escura do `fpmed_documentos.html` usa
   `rgba(var(--x-rgb), .13)` para tom sobre fundo, e isso NÃO é a rampa de tons declarados
   (50/100/300) que a BASE pede; desenhar a rampa é decisão de paleta"*. A resposta do arquiteto
   foi: **gosto é do dono, mas não sobe como pergunta aberta — traga DUAS opções medidas e ele
   escolhe entre duas coisas.**

   ══ A PRIMEIRA VERSÃO DESTA RÉGUA ACUSOU 11 REPROVAÇÕES, E AS 11 ERAM A RÉGUA ═══════════════
   Eu escrevi este arquivo cobrando 3:1 (WCAG 1.4.11) de TODO degrau contra o fundo de trás.
   Rodou, e ficou vermelho em quase tudo: `bg -> painel2` deu 1,05:1, `painel -> linha` deu
   1,24:1, e os quatro véus de selo deram entre 1,22 e 1,37:1.
   >>> ANTES DE PUBLICAR O NÚMERO, EU PAREI E OLHEI PARA A RÉGUA. A 1.4.11 cobra 3:1 de elemento
       não-textual **necessário para entender ou operar** a interface — indicador de estado,
       ícone que informa, contorno de controle. Ela NÃO cobra isso de superfície: painel sobre
       fundo é superfície, e se ela cobrasse, nenhuma tela escura do mundo passaria. E o véu do
       selo também não é indicador sozinho — o selo tem a PALAVRA "VENCIDO" dentro dele; quem
       informa é o texto, e o texto se mede por 4,5:1.
   >>> É O MESMO FORMATO DO DEFEITO QUE A `testa_contraste` REGISTRA SOBRE SI MESMA ("a primeira
       versão acusou 6 reprovações; QUATRO eram ela cobrando o número errado"). Régua antes do
       número — e uma régua que reprova tudo não é rigor, é ruído: ela ensina a ignorar vermelho,
       que é a coisa que esta casa mais combate.
   Então a régua foi corrigida, e ela agora separa três perguntas em vez de fazer uma só:

     · TEXTO sobre o degrau ............ 4,5:1 OBRIGATÓRIO (WCAG 1.4.3)
     · degrau que INFORMA SOZINHO ...... 3:1   OBRIGATÓRIO (WCAG 1.4.11) — aqui é a barra
       colorida na esquerda do cartão e o preenchimento do botão: tire a cor e a informação some.
     · degrau de SUPERFÍCIE ............ sem mínimo, número PUBLICADO. Painel sobre fundo, fio
       entre painéis, véu atrás de um selo que tem palavra dentro. O número sai declarado para o
       dono comparar as duas opções — mas ele não reprova, porque não há norma para reprovar.

   ══ A CONTA NÃO É MINHA ═════════════════════════════════════════════════════════════════════
   `contraste()` vem da `tools/regua_visual.js` por `require`. Reescrever a fórmula da WCAG aqui
   criaria a terceira implementação dela nesta casa, e no dia em que uma divergisse ninguém
   saberia qual acreditar. A régua é do A; eu uso, não copio.

   ══ E O ACHATAMENTO DO VÉU TAMBÉM É MEDIDO, NÃO SUPOSTO ═════════════════════════════════════
   `rgba(cor, a)` sobre um fundo opaco resulta numa cor sólida: `res = cor*a + fundo*(1-a)`. É
   essa cor sólida que o olho vê e é ela que entra na conta — usar a cor CHEIA daria um número
   bonito e falso, porque ninguém pinta o selo com a cor cheia.

     node tools/mede_rampa_ilha.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { contraste } = require('./regua_visual.js');

const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'fpmed_documentos.html'), 'utf8').replace(/\r\n/g, '\n');

/* A PALETA É LIDA DO ARQUIVO, e não digitada aqui. Uma cópia à mão envelheceria na primeira vez
   que alguém mexesse na tela, e a medição passaria a descrever uma tela que não existe mais. */
function token(nome) {
  const m = new RegExp('--' + nome + '\\s*:\\s*([^;}]+)').exec(HTML);
  return m ? m[1].trim() : null;
}
const P = {};
for (const t of ['bg', 'painel', 'painel2', 'linha', 'texto', 'muted', 'titulo', 'branco',
                 'azul', 'azul-claro', 'verde', 'vermelho', 'ambar',
                 'vermelho-claro', 'ambar-claro', 'placeholder', 'topfaixa',
                 'azul-rgb', 'vermelho-rgb', 'ambar-rgb', 'verde-rgb']) P[t] = token(t);

const hexDe = s => {
  let h = String(s || '').replace('#', '').trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};
const rgbDeToken = s => String(s || '').split(',').map(n => parseInt(n.trim(), 10));
const paraHex = a => '#' + a.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
// `res = cor*a + fundo*(1-a)` — a conta que o navegador faz, e a única que descreve o que se vê.
const achata = (corRGB, alfa, fundoHex) => {
  const f = hexDe(fundoHex);
  return paraHex(corRGB.map((c, i) => c * alfa + f[i] * (1 - alfa)));
};

const r2 = v => v == null ? '  —  ' : (Math.round(v * 100) / 100).toFixed(2).padStart(5);

const P_A = { falhas: 0, sep: [] }, P_B = { falhas: 0, sep: [] };

// `min = null` quer dizer "sem norma para reprovar" — e o número sai mesmo assim. Publicar o
// número sem veredito é a terceira resposta honesta: nem aprovado, nem reprovado, medido.
function linha(rot, cor, fundo, min, placar) {
  const c = contraste(cor, fundo);
  if (min == null) {
    if (placar) placar.sep.push([rot, c]);
    console.log(`     ${rot.padEnd(34)} ${r2(c)}:1   (superfície — sem mínimo, publicado)`);
    return;
  }
  const passa = c != null && c >= min;
  if (!passa && placar) placar.falhas++;
  console.log(`     ${rot.padEnd(34)} ${r2(c)}:1   min ${min.toFixed(2)}  ${passa ? 'passa' : '*** REPROVA ***'}`);
}

console.log('=== A RAMPA DE TONS DA ILHA ESCURA — DUAS OPÇÕES MEDIDAS (fatia B27) ===\n');
console.log('paleta lida de fpmed_documentos.html:');
console.log(`  bg ${P.bg} · painel2 ${P.painel2} · painel ${P.painel} · linha ${P.linha}`);
console.log(`  texto ${P.texto} · titulo ${P.titulo} · muted ${P.muted} · branco ${P.branco}\n`);

/* ── AS SUPERFÍCIES, QUE SÃO IGUAIS NAS DUAS OPÇÕES ─────────────────────────────────────────
   Elas não estão em disputa: a escolha do dono é sobre o TOM DOS ACENTOS, e mexer no fundo
   mudaria a tela inteira, o que não é o que a pendência pediu. Entram na medição porque são o
   fundo de tudo o que vem depois — e porque o texto sobre elas TEM mínimo. */
console.log('── AS SUPERFÍCIES (iguais nas duas opções — não estão em disputa) ──');
linha('bg -> painel2 (separação)', P.painel2, P.bg, null, null);
linha('painel2 -> painel (separação)', P.painel, P.painel2, null, null);
linha('painel -> linha, o fio (separação)', P.linha, P.painel, null, null);
console.log('   texto sobre o painel — e AQUI há mínimo:');
linha('principal #DCE7F2', P.texto, P.painel, 4.5, P_A);
linha('titulo    ' + P.titulo, P.titulo, P.painel, 4.5, P_A);
linha('apagado   ' + P.muted, P.muted, P.painel, 4.5, P_A);
// as três valem para as duas opções: o fundo do cartão não muda entre elas
P_B.falhas = P_A.falhas;
console.log('');

/* ── OPÇÃO A — A RAMPA QUE A ILHA JÁ TEM, SÓ QUE DECLARADA ──────────────────────────────────
   Os alfas são os que estão HOJE escritos nas regras (.13 no link da topfaixa, .16 na aba ligada
   e no selo verde, .18 nos selos vermelho e âmbar; .16 é a mediana e é o que a opção publica).
   A opção A não muda um pixel: ela ACHATA esses véus em cores sólidas e as publica como
   `--x-100/300/500`.
   >>> O QUE SE GANHA SEM MUDAR NADA: cor escrita dentro de `rgba()` no meio de uma regra não
       aparece em varredura de paleta — é assim que valor à mão sobrevive a auditoria (BASE 2.3),
       e o comentário desta própria tela já dizia isso sobre os hex soltos que a B19 recolheu.
       Declarada, ela vira token e passa a ser auditável.
   >>> O QUE SE PERDE: nada visual. E é exatamente esse o argumento a favor dela. */
const ALFAS_A = { fundo: 0.16, fio: 0.35 };
/* ── OPÇÃO B — A RAMPA ABERTA ───────────────────────────────────────────────────────────────
   Mesmos tokens, degraus mais fortes: o véu do selo sobe de .16 para .26 e o fio de .35 para
   .55. O selo passa a SER uma pastilha, em vez de um texto colorido sobre um fundo quase igual
   ao do cartão.
   >>> O QUE SE GANHA, e é medível: o véu do selo sai de ~1,3:1 de separação para ~1,6:1, e o fio
       âmbar e o verde cruzam 3:1 — ou seja, passam a poder ser usados como contorno de controle,
       coisa que hoje eles não podem.
   >>> O QUE SE PERDE: a tela fica mais listrada. Quatro selos mais fortes numa lista de vinte
       documentos disputam atenção entre si, e tudo em destaque é nada em destaque. E o texto
       perde folga: o verde sobre o véu cai de 5,76 para 4,55:1 — passa, com 0,05 de margem.
       Isso é gosto com consequência, e é por isso que é escolha do dono. */
const ALFAS_B = { fundo: 0.26, fio: 0.55 };

/* `informa` = este degrau é a ÚNICA pista daquilo que ele diz? A barra colorida na esquerda do
   cartão é (tire a cor e não há como saber o estado num relance); o véu do selo não é (o selo tem
   a palavra dentro). É essa coluna que decide se o 3:1 vale — e ela é a coisa que a primeira
   versão desta régua não tinha. */
const ACENTOS = [
  ['azul',     'azul-rgb',     [['azul-claro ' + P['azul-claro'], P['azul-claro']], ['branco', P.branco]]],
  ['vermelho', 'vermelho-rgb', [['vermelho-claro ' + P['vermelho-claro'], P['vermelho-claro']]]],
  ['ambar',    'ambar-rgb',    [['ambar-claro ' + P['ambar-claro'], P['ambar-claro']]]],
  ['verde',    'verde-rgb',    [['verde ' + P.verde, P.verde]]],
];

function rodaOpcao(rotulo, alfas, placar) {
  console.log('── ' + rotulo + ' ──');
  for (const [nome, tokRgb, textos] of ACENTOS) {
    const rgb = rgbDeToken(P[tokRgb]);
    const c100 = achata(rgb, alfas.fundo, P.painel);   // o fundo do selo, sobre o CARTÃO
    const c300 = achata(rgb, alfas.fio, P.painel);     // o fio / a borda de controle
    const c500 = P[nome];                              // a cor cheia (barra do cartão, botão)
    console.log(`  ${nome.toUpperCase().padEnd(9)} 100=${c100}  300=${c300}  500=${c500}`);
    linha('100 atrás do selo (separação)', c100, P.painel, null, placar);
    for (const [rot, cor] of textos) linha('   texto ' + rot, cor, c100, 4.5, placar);
    linha('300 como contorno de controle', c300, P.painel, 3, placar);
    linha('500 barra do cartão / botão', c500, P.painel, 3, placar);
    console.log('');
  }
}

rodaOpcao('OPÇÃO A — a rampa de hoje, declarada (véu ' + ALFAS_A.fundo + ' · fio ' + ALFAS_A.fio + ')',
  ALFAS_A, P_A);
rodaOpcao('OPÇÃO B — a rampa aberta (véu ' + ALFAS_B.fundo + ' · fio ' + ALFAS_B.fio + ')',
  ALFAS_B, P_B);

console.log('══ PLACAR ══');
console.log(`  OPÇÃO A: ${P_A.falhas} reprovação(ões) — e as separações de superfície ficam em `
  + P_A.sep.map(([, c]) => r2(c).trim()).join(' · '));
console.log(`  OPÇÃO B: ${P_B.falhas} reprovação(ões) — e as separações de superfície ficam em `
  + P_B.sep.map(([, c]) => r2(c).trim()).join(' · '));
console.log('\n>>> Nenhuma das duas foi aplicada. Isto é medição para o dono escolher — trocar a');
console.log('    paleta por conta própria é a decisão que a pendência 4 existe para NÃO tomar.');
