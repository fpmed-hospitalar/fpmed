// SUITE testa_varredura_clique — NENHUM CLIQUE MORTO, E NENHUMA AFORDÂNCIA MENTIROSA.
// Fatia B12 (14/08/2026, Trabalhador B) · territórios do B: Negócios e Proposta.
//
// ── AS DUAS DOENÇAS, E ELAS SÃO OPOSTAS ────────────────────────────────────────────────────
//   CLIQUE MORTO ......... tem cara de clicável e não faz nada. Estoura no console (que ninguém
//                          abre) e a tela fica muda.
//   AFORDÂNCIA MENTIROSA . cursor de mão em coisa que não é botão. Não quebra nada — gasta o
//                          clique da pessoa e ensina que a tela mente.
// A terceira, que só apareceu quando a varredura foi escrita: o CLIQUE MUDO, que vai à rede sem
// dizer que foi. A régua da casa é 100ms por interação, e nenhuma rede cabe nisso — o que cabe
// é o RECONHECIMENTO.
//
// ── ESTA SUÍTE NÃO REESCREVE A VARREDURA: ELA A EXECUTA ────────────────────────────────────
// A ferramenta é tools/varre_cliques.js e o red test dela é tools/prova_varre_cliques.js (11 de
// 11 defeitos injetados pegos, incluindo um em cada categoria). Aqui ficam (1) o portão que
// exige ZERO achados nas duas telas e (2) os asserts dos três consertos desta fatia — porque
// "a varredura está limpa" é uma frase que envelhece, e "o botão desliga no clique" não é.
//
//   node tests/testa_varredura_clique.js
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const raiz = path.join(__dirname, '..');
const R = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');
const N = R('fpmed_negocios.html');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_varredura_clique — clique morto, afordância mentirosa e clique mudo\n');

// ══════════ 1. O PORTÃO: A VARREDURA TEM DE SAIR LIMPA ══════════
let saida = '', limpou = true;
try { saida = cp.execSync('node ' + JSON.stringify(path.join(raiz, 'tools', 'varre_cliques.js')), { encoding: 'utf8' }); }
catch (e) { limpou = false; saida = (e.stdout || '') + (e.stderr || ''); }
const achados = (saida.match(/TOTAL DE ACHADOS:\s*(\d+)/) || [, '?'])[1];
ok('1. *** a varredura de clique sai LIMPA nas duas telas do B ***', limpou && achados === '0',
  { achados, primeiros: (saida.match(/^\s+· .*$/gm) || []).slice(0, 5) });
ok('2. ...e ela olhou as duas telas, e não uma só',
  /fpmed_negocios\.html/.test(saida) && /fpmed_giovana\.html/.test(saida));
ok('3. ...e olhou as SETE doenças, e não uma amostra delas',
  ['CLIQUE MORTO', 'cursor de mão sem ação', 'âncora sem destino', 'botão sem ação',
   'classe promete clique', 'clica mas NÃO parece que clica', 'clique MUDO'].every(t => saida.includes(t)));

// ══════════ 2. A FERRAMENTA CONSEGUE FICAR VERMELHA ══════════
// *** ZERO ACHADOS SÓ VALE SE O VERMELHO FOR POSSÍVEL. *** Uma varredura que fosse ficando
// frouxa a cada acusação falsa também termina em zero, e os dois zeros são iguais no papel.
{
  const P = R('tools/prova_varre_cliques.js');
  ok('4. *** existe red test da varredura, com um defeito injetado por categoria ***',
    ['CLIQUE MORTO', 'cursor de mão sem ação', 'âncora sem destino e sem ação', 'botão sem ação',
     'classe promete clique e o elemento não cumpre', 'clica mas NÃO parece que clica',
     'clique MUDO (vai à rede sem avisar)'].every(c => P.includes(c)));
  ok('5. ...e ele confere o CONTROLE antes (a tela limpa tem de sair limpa lá dentro também)',
    /CONTROLE/.test(P) && /JA ACUSA SEM DEFEITO/.test(P));
  ok('6. ...e cobra a categoria certa, não só "acusou alguma coisa"',
    /acusou, mas em OUTRA categoria/.test(P));
}

// ══════════ 3. O ACHADO QUE QUASE PASSOU: A VARREDURA CEGA ══════════
/* A 1ª limpeza de comentário apagava `/*` até o próximo `*​/` NO ARQUIVO INTEIRO. O
   `accept="image/*,application/pdf"` da Proposta abre um comentário que só fecha 21.720
   caracteres depois — e 17 dos 46 `onclick` da tela sumiram da varredura. Ela ficou VERDE POR
   CEGUEIRA, e quem pegou foi o red test. */
{
  const V = R('tools/varre_cliques.js');
  ok('7. *** a limpeza de comentário só age dentro de <style> e <script> ***',
    V.includes('(<(style|script)\\b[^>]*>)') && !/^const semComentarioCodigo = s => s\.replace\(\/\\\/\\\*/m.test(V));
  ok('8. ...e o motivo está escrito, com o número medido', /21\.720|21720/.test(V));
  const G = R('fpmed_giovana.html');
  ok('9. o caso real que pegou isso continua na Proposta (o assert mede o mundo, não a memória)',
    /accept="[^"]*image\/\*/.test(G));
}

// ══════════ 4. OS TRÊS CONSERTOS DESTA FATIA ══════════
// ── a) confirmar valor ganho: duas ou três viagens ao servidor, e o botão ficava igual
ok('10. *** o botão de confirmar o valor ganho DESLIGA no clique ***',
  /btConf\.disabled = true; btConf\.textContent = 'gravando…'/.test(N));
ok('11. ...e ele tem id próprio pra ser achado', /id="ata-conf-bt"/.test(N));
ok('12. *** gravou: o botão NÃO volta a ser clicável (duas confirmações do mesmo valor sujam o rastro) ***',
  /btConf\.textContent = '✓ confirmado'/.test(N));
ok('13. ...mas se FALHAR ele volta, porque tentar de novo é o certo',
  /btConf\.disabled = false; btConf\.textContent = rotuloConf/.test(N));

// ── b) abrir anexo: assinar a URL é uma viagem, e a tela ficava idêntica
ok('14. *** abrir anexo avisa que está abrindo ***', /el\.textContent = 'abrindo…'/.test(N));
ok('15. ...e trava o segundo clique enquanto abre (dois cliques = duas abas)',
  /el\.style\.pointerEvents = 'none'/.test(N));
ok('16. ...e devolve o rótulo nos DOIS finais, no bom e no ruim',
  (N.match(/devolve\(\);/g) || []).length >= 2 && /const devolve = \(\)/.test(N));
ok('17. o elemento chega por parâmetro, e não por id — são três listas chamando a mesma função',
  (N.match(/abrirAnexo\('\$\{esc\(a\.arquivo_path\)\}', this\)/g) || []).length === 3
  && /async function abrirAnexo\(path, el\)/.test(N));

// ── c) marcar tarefa: o clique mudo que era, na verdade, um clique MENTIROSO
/* O navegador marca a caixinha sozinho. Com a rede caída, ela ficava marcada NA TELA e não
   marcada no banco — e o `catch` engolia a falha sem uma palavra. A tarefa "concluída"
   reaparecia no dia seguinte sem explicação. */
{
  const bloco = (N.match(/async function marcarLembrete\([\s\S]*?\n\}/) || [''])[0];
  ok('18. *** a marcação responde ANTES da rede (a lista e o sino mudam na hora) ***',
    bloco.indexOf('pintaLembretes(negId); pintaNotif();') < bloco.indexOf('fetch(')
    && bloco.indexOf('pintaLembretes') > -1);
  ok('19. *** e o servidor dizendo NÃO deixou de ser engolido em silêncio ***',
    /if\(!r\.ok\) throw new Error\('o servidor respondeu ' \+ r\.status\)/.test(bloco));
  ok('20. *** falhou: a marcação VOLTA como estava... ***', /if\(l\) l\.feito = antes;/.test(bloco));
  ok('21. *** ...e a tela DIZ que voltou (desfazer calado é a mesma mentira ao contrário) ***',
    /voltou como estava/.test(bloco));
  ok('22. o catch mudo de antes não existe mais',
    !/a marcação volta no próximo carregamento/.test(N));
}

// ══════════ 5. O PADRÃO QUE NÃO PODE SE PERDER ══════════
// O `.nf` do Negócios é o modelo: a classe promete clique, e a própria folha de estilo desfaz a
// promessa quando não há ação. Quem escrever a próxima lista copia daqui.
ok('23. *** o padrão de afordância honesta continua na folha de estilo ***',
  /\.nf:not\(\[onclick\]\):not\(\[href\]\)\{cursor:default\}/.test(N));
ok('24. ...e o hover também some junto (cursor certo com hover aceso ainda promete)',
  /\.nf:not\(\[onclick\]\):not\(\[href\]\):hover\{background:transparent;border-color:transparent\}/.test(N));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
