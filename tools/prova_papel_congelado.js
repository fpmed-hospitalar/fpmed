/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_papel_congelado.js — O DOCUMENTO IMPRESSO DA PROPOSTA NÃO MUDOU · 14/08/2026

   O papel da Proposta está CONGELADO por ordem da caixa desde a B8. "Congelado" não é uma
   intenção: é uma coisa que dá pra MEDIR. Esta prova recorta as regiões que fazem o papel e
   compara o que está no disco com o que está numa versão anterior do git, byte a byte.

     · o HTML do `print-doc` (a folha em si: cabeçalho, tabela, rodapé)
     · o CSS de impressão (o `@media print` e o bloco DOCUMENTO DE IMPRESSÃO)
     · a função `gerarPDF` (quem preenche a folha antes do `window.print()`)
     · o `OBS_PADRAO` (o aviso legal impresso na folha) — entrou na fatia A37; a razão está
       escrita na própria região, lá embaixo

   Comparar o ARQUIVO INTEIRO não serviria: toda fatia mexe na tela, e um diff que sempre acusa
   é um diff que ninguém lê. Comparar as regiões responde a pergunta certa — "o que sai na
   impressora mudou?" — e responde com um sim ou um não.

   ══ E A PARTIR DA FATIA A37 (20/08/2026) ESTE ARQUIVO É A FONTE DE VERDADE DE UMA SEGUNDA ═══
   ══ PERGUNTA: "esta linha está sob jurisdição da régua visual, ou sob ordem de congelamento?" ══
   A `tools/regua_visual.js` media a Giovana inteira como se tudo fosse tela — e duas catracas
   ficaram vermelhas sobre linhas que NÃO PODEM ficar verdes por trabalho nenhum, porque mexer
   nelas reprova esta prova aqui. Vermelho que mistura verdadeiro com falso ensina a casa a
   ignorar vermelho.
   >>> ENTÃO A RÉGUA IMPORTA AS REGIÕES DAQUI, e não copia uma lista. Uma fonte de verdade só:
       se a prova mudar de região, a régua muda junto, no mesmo instante e sem ninguém lembrar.
   >>> E A ISENÇÃO É ANCORADA NO HASH, NÃO NA LINHA. `IMPRESSAO_DIGITAL` é o retrato declarado
       das regiões. Se qualquer uma não bater, a régua PARA E GRITA e a isenção daquela região é
       SUSPENSA — sem isso, a isenção viraria a porta dos fundos por onde se muda o papel do
       hospital sem ninguém ver. É o que separa esta decisão de um `// ignore`.

     node tools/prova_papel_congelado.js [ref-do-git]      (padrão: HEAD)
     node tools/prova_papel_congelado.js --impressao       (o retrato atual das regiões)
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const ALVO = 'fpmed_giovana.html';

const norm = s => String(s).replace(/\r\n/g, '\n');
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

/* As regiões, como EXPRESSÃO e não como função de recorte: a régua precisa da POSIÇÃO (para
   saber que a linha do `font-size:10px` está dentro do `gerarPDF`), e uma função que só devolve
   o texto joga a posição fora. `m.index` de um `match` sem `g` é exatamente o que faltava. */
const REGIOES = [
  { nome: 'o HTML do papel (print-doc)',
    re: /<div class="print-doc" id="print-doc">[\s\S]*?\n<!-- MODAL MANUAL -->/ },
  { nome: 'o CSS de impressão (@media print + DOCUMENTO DE IMPRESSÃO)',
    re: /\/\* PRINT \*\/[\s\S]*?<\/style>/ },
  { nome: 'gerarPDF (quem preenche a folha)',
    re: /function gerarPDF\(\)[\s\S]*?\n\}/ },

  /* ══ A QUARTA REGIÃO, E ELA ENTROU NA FATIA A37 (20/08/2026) ═══════════════════════════════
     `OBS_PADRAO` é o AVISO LEGAL IMPRESSO na proposta — o texto que diz ao órgão público que a
     cotação teve auxílio de inteligência artificial e que o estoque é rotativo. Ele mora numa
     `var` do JavaScript e é escrito no `<div id="print-obs-padrao">`, que está DENTRO da
     primeira região congelada aqui em cima. Ou seja: a caixa da folha estava congelada e O TEXTO
     QUE ELA IMPRIME não estava — congelar o envelope e deixar a carta solta.

     >>> E ELE JÁ ESTAVA CONGELADO NA PRÁTICA, por duas suítes que não se conhecem: o
         `testa_molde_proposta` (assert 52) guarda este literal PELO AVESSO citando a ordem do
         dono de 13/08 ("peça formal que vai pro órgão público"), e o `testa_pdf_proposta`
         recorta a declaração do arquivo com `konst('OBS_PADRAO')` e a EXECUTA. O que faltava era
         o congelamento estar escrito no lugar onde esta casa registra congelamento.

     ══ POR QUE ISTO NÃO É "AUMENTAR A ISENÇÃO PARA CABER O RESULTADO" ═════════════════════════
     A fatia A37 decidiu que achado dentro de papel congelado sai da alçada da régua. Os DOIS
     achados vermelhos da Giovana são o mesmo caso — mas só um deles caía numa região declarada
     aqui, e o outro (o `⚠` deste literal) ficava vermelho por acidente de ARQUIVO, e não por
     diferença de natureza: as três saídas dele estão fechadas, e o próprio B provou cada uma.
     >>> A ALTERNATIVA SERIA UMA LISTA DE EXCEÇÃO À PARTE, com arquivo e linha escritos à mão —
         que é exatamente o `// ignore` que a decisão do arquiteto proíbe, e que apodrece na
         primeira vez que alguém mover uma linha. "Uma fonte de verdade só" quer dizer: o que
         está congelado se registra AQUI, e a régua lê daqui.
     >>> E A ISENÇÃO CONTINUA ESTREITA E ANCORADA: é este literal, com hash declarado. Mudar um
         byte dele faz a régua PARAR E GRITAR, igual às outras três. Se o dono descongelar o
         aviso, basta apagar estas duas linhas e o vermelho volta sozinho.

     ══ E A ÂNCORA É O COMEÇO DA LINHA (`^` com `m`), o que não é capricho ══════════════════════
     A PRIMEIRA versão desta expressão pegou a MENÇÃO ao literal dentro do comentário que explica
     o assert 52 — ele cita a declaração para contar a história, e o recorte congelou 1.556 chars
     de comentário no lugar do aviso de verdade. É o defeito 14 da régua com outra roupa:
     instrumento que confunde o REGISTRO com o REGISTRADO. Declaração abre a linha; citação vem
     indentada dentro da prosa. */
  { nome: 'OBS_PADRAO (o aviso legal impresso na proposta)',
    re: /^var OBS_PADRAO = '[\s\S]*?';/m },
];

/* ══ O RETRATO DECLARADO DAS REGIÕES ═════════════════════════════════════════════════════════
   Medido em 20/08/2026 com `node tools/prova_papel_congelado.js --impressao`. Ele NÃO substitui
   a comparação com o git — são duas perguntas: o git responde "mudou desde aquele commit?", e
   isto aqui responde "o que a régua está isentando é o mesmo papel que o dono congelou?".
   >>> ATUALIZAR ESTE BLOCO É UM ATO CONSCIENTE, e é para ser. Quem mexer no papel por ordem do
       dono roda `--impressao` e cola o número novo — e o commit dessa mudança fica na história
       com nome e data. Um hash que se atualiza sozinho não guarda nada. */
const IMPRESSAO_DIGITAL = {
  'o HTML do papel (print-doc)':                                { chars: 2589, hash: '8ed4d8c6c51f77e2' },
  'o CSS de impressão (@media print + DOCUMENTO DE IMPRESSÃO)': { chars: 3226, hash: 'a72b9b811ae2692e' },
  /* Os 5.865 chars e o `87029407681cbf3b` do `gerarPDF` são exatamente os números que o
     trabalhador B mediu na B24 e que o arquiteto repetiu na caixa da A37 — duas medições
     independentes que batem, e é por isso que este recorte é o mesmo recorte. */
  'gerarPDF (quem preenche a folha)':                           { chars: 5865, hash: '87029407681cbf3b' },
  'OBS_PADRAO (o aviso legal impresso na proposta)':            { chars: 385,  hash: 'b9f2133ceba85112' },
};

/* Recorta as regiões de um texto qualquer e devolve posição, linhas e impressão digital.
   Região que o recorte NÃO acha volta com `achou: false` — âncora quebrada NÃO é "igual", e um
   assert que passa por não ter encontrado nada é pior que assert nenhum. */
function recorta(bruto) {
  const txt = norm(bruto);
  return REGIOES.map(({ nome, re }) => {
    const m = txt.match(re);
    if (!m) return { nome, achou: false, texto: '', chars: 0, hash: null, ini: -1, fim: -1,
                     linhaIni: -1, linhaFim: -1 };
    const ini = m.index, fim = m.index + m[0].length;
    const linhaIni = txt.slice(0, ini).split('\n').length;
    return { nome, achou: true, texto: m[0], chars: m[0].length, hash: hash(m[0]), ini, fim,
             linhaIni, linhaFim: linhaIni + m[0].split('\n').length - 1 };
  });
}

/* A pergunta que a régua faz: "as regiões congeladas deste texto continuam sendo o papel que o
   dono congelou?" Devolve as regiões e a lista das que DIVERGIRAM — e é a divergência que
   suspende a isenção. */
function confereImpressao(bruto) {
  const regioes = recorta(bruto);
  const divergentes = [];
  for (const r of regioes) {
    const esperado = IMPRESSAO_DIGITAL[r.nome];
    if (!esperado) { divergentes.push({ ...r, porque: 'regiao sem impressao digital declarada' }); continue; }
    if (!r.achou) { divergentes.push({ ...r, porque: 'ANCORA QUEBRADA — o recorte nao achou a regiao', esperado }); continue; }
    if (r.hash !== esperado.hash) {
      divergentes.push({ ...r, porque: 'o papel MUDOU (' + esperado.chars + ' chars ' + esperado.hash
        + ' -> ' + r.chars + ' chars ' + r.hash + ')', esperado });
    }
  }
  return { regioes, divergentes };
}

/* A pergunta da régua, linha a linha: esta linha (1-based, no texto já normalizado) cai dentro
   de alguma região congelada CONFERIDA? Região divergente NÃO isenta ninguém — é assim que a
   isenção deixa de poder ser porta dos fundos. */
function congelaLinha(conferencia, linha) {
  const ruins = new Set(conferencia.divergentes.map(d => d.nome));
  for (const r of conferencia.regioes) {
    if (!r.achou || ruins.has(r.nome)) continue;
    if (linha >= r.linhaIni && linha <= r.linhaFim) return r.nome;
  }
  return null;
}

module.exports = { ALVO, REGIOES, IMPRESSAO_DIGITAL, recorta, confereImpressao, congelaLinha, hash, norm };
if (require.main !== module) return;

// ── linha de comando ────────────────────────────────────────────────────────────────────────
const agoraTxt = norm(fs.readFileSync(path.join(RAIZ, ALVO), 'utf8'));

if (process.argv.includes('--impressao')) {
  console.log('=== IMPRESSAO DIGITAL ATUAL DAS REGIOES CONGELADAS (' + ALVO + ') ===\n');
  console.log('Cole isto em IMPRESSAO_DIGITAL se o dono tiver descongelado e liberado a mudanca:\n');
  for (const r of recorta(agoraTxt)) {
    if (!r.achou) { console.log('  ANCORA QUEBRADA  ' + r.nome); continue; }
    console.log("  '" + r.nome + "': { chars: " + r.chars + ", hash: '" + r.hash + "' },");
    console.log('        linhas ' + r.linhaIni + '-' + r.linhaFim);
  }
  return;
}

const REF = process.argv[2] || 'HEAD';
const antesTxt = norm(execFileSync('git', ['show', REF + ':' + ALVO], { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024 }).toString('utf8'));

console.log(`=== O PAPEL DA PROPOSTA CONTINUA CONGELADO? (${ALVO} · ${REF} -> disco) ===\n`);
let tudoIgual = true;
const antes = recorta(antesTxt), agora = recorta(agoraTxt);
for (let i = 0; i < REGIOES.length; i++) {
  const a = antes[i], b = agora[i];
  /* Região que sumiu do recorte NÃO é "igual": é âncora quebrada, e um assert que passa por
     não ter achado nada é pior que assert nenhum. */
  if (!a.achou || !b.achou) {
    tudoIgual = false;
    console.log(`  ANCORA QUEBRADA  ${a.nome}  (${a.chars} -> ${b.chars} chars)`);
    continue;
  }
  const igual = a.texto === b.texto;
  if (!igual) tudoIgual = false;
  console.log(`  ${igual ? 'IDÊNTICA ' : 'MUDOU !!!'}  ${a.nome}`);
  console.log(`             ${a.chars} chars ${a.hash}  ->  ${b.chars} chars ${b.hash}`);
}

/* ══ E A TERCEIRA PERGUNTA, DA FATIA A37: o que a régua isenta é o papel do dono? ═════════════
   O git responde "mudou desde aquele commit?". Isto responde "a impressão digital declarada, que
   é a que autoriza a isenção da régua, ainda é esta?". As duas divergem no dia em que alguém
   mudar o papel E o commit — e é exatamente esse o dia em que a isenção não pode continuar. */
const conf = confereImpressao(agoraTxt);
if (conf.divergentes.length) {
  tudoIgual = false;
  console.log('\n  ⚠ A IMPRESSAO DIGITAL DECLARADA NAO BATE — a isencao da regua esta SUSPENSA:');
  for (const d of conf.divergentes) console.log('     ' + d.nome + ': ' + d.porque);
  console.log('     Se a mudanca foi por ordem do dono: node tools/prova_papel_congelado.js --impressao');
} else {
  console.log('\n  impressao digital declarada: BATE em todas — a regua pode isentar o papel.');
}

console.log(tudoIgual
  ? '\nRESULTADO: o papel NÃO foi tocado — as regiões estão byte a byte iguais.'
  : '\nRESULTADO: o papel MUDOU. Se não foi de propósito, desfaça; se foi, a caixa precisa saber.');
process.exitCode = tudoIgual ? 0 : 1;
