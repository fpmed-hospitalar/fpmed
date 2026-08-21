/* ════════════════════════════════════════════════════════════════════════════════════════════
   SUITE testa_erro_visivel — A FRASE QUE A PESSOA LÊ QUANDO ALGO FALHA (fatia B36, 21/08/2026)

   ══ O DEFEITO, E COMO ELE FOI ACHADO ════════════════════════════════════════════════════════
   Três `catch` da `fpmed_negocios.html` escreviam o aviso assim:

       msg.textContent = '<svg class="ic" aria-hidden="true"><use href="#ic-alerta"/></svg> ' + e.message;

   `textContent` **não interpreta marca-up: ele imprime**. Então, no instante em que alguma coisa
   falhava, a pessoa lia na tela, literalmente:

       <svg class="ic" aria-hidden="true"><use href="#ic-alerta"/></svg> não salvou: HTTP 403

   ══ E O ACHADO É DA TELEMETRIA, PELO AVESSO ═════════════════════════════════════════════════
   Dois dos três lugares são pontos que disparam `erro_visto_pelo_usuario`. O evento sai limpo, a
   causa chega certa no painel, e **o painel não tinha como acusar**: a FRASE que a pessoa lê não
   viaja no evento (e não deve viajar — evento é comportamento, não conteúdo). Foi preciso ler o
   que a tela escreve. É a metade da pergunta *"quais erros o usuário está vendo"* que só se
   responde do lado de cá.
   >>> E É UM DEFEITO QUE DURA: só aparece em caminho de erro. Quem nunca falha nunca vê; quem vê
       está com outro problema na cabeça e não reclama do aviso.

   ══ O CONSERTO NÃO É SÓ `innerHTML` ═════════════════════════════════════════════════════════
   Trocar para `innerHTML` sem escapar passaria a interpretar como marca-up o que vem do servidor
   — trocaria um defeito de aparência por um de segurança. Vai `innerHTML` **com `esc()`**, que é
   o que as outras telas da casa já faziam (`fpmed_documentos.html:951`).

     node tests/testa_erro_visivel.js
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { semComentario } = require('../tools/regua_visual.js');
const RAIZ = path.join(__dirname, '..');
const R = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');
/* ══ A LEITURA É SEM COMENTÁRIO, E ISSO SAIU DE UM FALSO VERMELHO MEDIDO ═════════════════════
   A `tools/muta_b36.js` acrescentou um comentário que CITA o literal proibido — *"nunca
   msg.textContent = '<svg ...>'"* — e esta suíte ficou vermelha. Era falso: o comentário é o que
   ensina a regra, e uma catraca que o reprova transforma o conserto em "apagar a explicação".
   >>> É O DEFEITO 14 DA RÉGUA DO A COM OUTRA ROUPA (fatia A31): instrumento que confunde o
       REGISTRO com o REGISTRADO cobra mais de quem explica mais. A `semComentario` apaga o
       comentário PRESERVANDO as linhas, então o número de linha do achado continua verdadeiro. */
const SEM = (...p) => semComentario(R(...p));

const TELAS = ['fpmed_negocios.html', 'fpmed_documentos.html', 'fpmed_giovana.html',
               'fpmed_ajuda.html', 'fpmed_licitacoes.html'];

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 320) + ']' : '')); } n++; };
console.log('SUITE testa_erro_visivel — o aviso de erro tem de ser uma frase, e nao uma etiqueta\n');

// ══════════════════════════════════════════════════════════════════════════════════════════
// 1. NENHUMA TELA IMPRIME MARCA-UP COMO TEXTO
// ══════════════════════════════════════════════════════════════════════════════════════════
// A regra vale para a casa inteira e não só para onde o defeito estava: um assert que cobre o
// arquivo consertado ensina a não repetir ali, e deixa as outras quatro telas livres.
console.log('-- 1. textContent nao recebe marca-up --');
for (const t of TELAS) {
  const linhas = SEM(t).split('\n');
  const achados = [];
  linhas.forEach((l, i) => {
    if (/textContent\s*=\s*['"`]\s*<[a-z]/i.test(l)) achados.push(t + ':' + (i + 1));
  });
  ok(t + ': *** nenhum `textContent` com etiqueta dentro ***', achados.length === 0, achados);
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 2. E O QUE VIRA MARCA-UP É ESCAPADO
// ══════════════════════════════════════════════════════════════════════════════════════════
/* O par é indivisível: `innerHTML` sem `esc` na mensagem de erro é pior que o defeito que ele
   veio consertar, porque a `e.message` de um `catch` pode carregar texto vindo do servidor. */
console.log('\n-- 2. innerHTML com mensagem de erro vem escapado --');
{
  const linhas = SEM('fpmed_negocios.html').split('\n');
  const cruas = [];
  linhas.forEach((l, i) => {
    if (!/innerHTML\s*=/.test(l)) return;
    // só as linhas que jogam a mensagem de um `catch` na tela
    if (!/\+\s*e\.message|\+\s*esc\(e\.message\)/.test(l)) return;
    if (!/esc\(\s*e\.message\s*\)/.test(l)) cruas.push('fpmed_negocios.html:' + (i + 1) + '  ' + l.trim().slice(0, 90));
  });
  ok('*** Negocios: toda `e.message` que vira innerHTML passa pela `esc()` ***', cruas.length === 0, cruas);
}
{
  const DOC = R('fpmed_documentos.html');
  ok('Documentos ja fazia certo, e continua fazendo (innerHTML + esc)',
    /innerHTML\s*=.*ic-alerta.*esc\(e\.message\)/.test(DOC));
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// 3. OS PONTOS QUE DISPARAM O EVENTO CONTINUAM DE PÉ
// ══════════════════════════════════════════════════════════════════════════════════════════
// O conserto mexeu em três `catch`, e dois deles são pontos de telemetria. Trocar uma linha de
// um `catch` é onde se perde uma chamada sem ninguém notar — a tela continua funcionando e o
// painel simplesmente para de receber, que é a falha mais silenciosa que existe.
console.log('\n-- 3. o evento continua saindo dos mesmos lugares --');
{
  const conta = t => (R(t).match(/(?:tel|FPMED_TELEMETRIA\.evento)\('erro_visto_pelo_usuario'/g) || []).length;
  ok('*** Negocios continua disparando `erro_visto_pelo_usuario` ***', conta('fpmed_negocios.html') >= 1,
    conta('fpmed_negocios.html'));
  ok('Documentos dispara nos dois pontos dela', conta('fpmed_documentos.html') === 2,
    conta('fpmed_documentos.html'));
  ok('Encontrar dispara no ponto dela', conta('fpmed_licitacoes.html') >= 1, conta('fpmed_licitacoes.html'));
  /* A CAUSA VAI; O DADO NÃO. Regra 3 do docs/TELEMETRIA.md, e ela é a razão de o evento não
     carregar a frase da tela — que é justamente por que este defeito precisou ser lido daqui. */
  ok('*** e o que viaja e a CAUSA, nunca o conteudo ***',
    /causa:\s*e\.message/.test(R('fpmed_negocios.html'))
    && /causa:\s*e\.message/.test(R('fpmed_documentos.html')));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
