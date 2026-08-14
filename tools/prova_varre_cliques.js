// ═══════════════════════════════════════════════════════════════════════════════════════════
// O RED TEST DA VARREDURA — fatia B12 (14/08/2026, Trabalhador B)
//
//   node tools/prova_varre_cliques.js
//
// ── POR QUE ESTE ARQUIVO EXISTE ────────────────────────────────────────────────────────────
// A `tools/varre_cliques.js` terminou dizendo ZERO ACHADOS nas duas telas. Esse é exatamente o
// resultado que não se pode acreditar sem prova: uma varredura que fosse ficando mais frouxa a
// cada acusação falsa também termina em zero, e as duas terminações são indistinguíveis pelo
// número. *** VERDE SÓ VALE QUANDO O VERMELHO É POSSÍVEL. ***
//
// Cada caso abaixo INJETA um defeito de verdade numa cópia da tela, em pasta temporária, e
// exige que a varredura acuse — e acuse NA CATEGORIA CERTA. Acusar na categoria errada é quase
// tão ruim quanto não acusar: manda a pessoa procurar no lugar errado.
//
// SÓ-LEITURA no repositório: tudo acontece em cópia temporária.
// ═══════════════════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

const raiz = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'b12-'));
const VARRE = path.join(__dirname, 'varre_cliques.js');

const roda = arquivo => {
  try { return { saida: cp.execSync(`node "${VARRE}" "${arquivo}"`, { encoding: 'utf8' }), achou: false }; }
  catch (e) { return { saida: (e.stdout || '') + (e.stderr || ''), achou: true }; }
};
const contaDe = (saida, rotulo) => {
  const m = saida.match(new RegExp(rotulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*(\\d+|nenhum)'));
  return !m ? null : (m[1] === 'nenhum' ? 0 : +m[1]);
};

const CASOS = [
  { tela: 'fpmed_negocios.html', nome: 'clique morto: o onclick chama funcao que nao existe',
    categoria: 'CLIQUE MORTO (função que não existe)',
    de: 'onclick="abrirFormManual()"', para: 'onclick="abrirFormularioManual()"' },

  { tela: 'fpmed_negocios.html', nome: 'clique morto: a funcao foi renomeada e o botao ficou apontando pro nome velho',
    categoria: 'CLIQUE MORTO (função que não existe)',
    de: 'function fecharDrawer(', para: 'function fecharGaveta(' },

  { tela: 'fpmed_negocios.html', nome: 'cursor de mao num texto que nao faz nada',
    categoria: 'cursor de mão sem ação',
    de: '<div class="dir">', para: '<div class="dir"><span style="cursor:pointer">ordenar</span>' },

  { tela: 'fpmed_negocios.html', nome: 'ancora sem destino e sem acao (o link que nao e link)',
    categoria: 'âncora sem destino e sem ação',
    de: '<div class="dir">', para: '<div class="dir"><a class="lnk-x">ver tudo</a>' },

  { tela: 'fpmed_negocios.html', nome: 'botao sem acao nenhuma',
    categoria: 'botão sem ação',
    de: '<div class="dir">', para: '<div class="dir"><button class="btn-x">Exportar</button>' },

  { tela: 'fpmed_negocios.html', nome: 'a classe promete clique na folha de estilo e o elemento nao cumpre',
    categoria: 'classe promete clique e o elemento não cumpre',
    de: '<div class="dir">', para: '<div class="dir"><span class="lnk">ordenar</span>' },

  { tela: 'fpmed_negocios.html', nome: 'clica e NAO parece que clica (acao invisivel)',
    categoria: 'clica mas NÃO parece que clica',
    de: '<div class="dir">', para: '<div class="dir"><span onclick="pinta()">ordenar</span>' },

  /* O "enviando…" sozinho NÃO basta como injeção: a mesma função tem, mais acima, o aviso de
     "escolha o PDF" — e ele também é resposta imediata, num caminho de guarda. A varredura está
     certa em contá-lo; a injeção é que precisava apagar TODA a resposta anterior ao `fetch`. */
  { tela: 'fpmed_negocios.html', nome: 'clique MUDO: o botao vai a rede sem avisar que foi',
    categoria: 'clique MUDO (vai à rede sem avisar)',
    de: "  if(!arq){ msg.textContent = 'escolha o PDF da proposta.'; return; }\n  bt.disabled = true; msg.textContent = 'enviando…';",
    para: '  if(!arq){ return; }' },

  { tela: 'fpmed_negocios.html', nome: 'clique MUDO: o conserto da marcacao de tarefa e desfeito',
    categoria: 'clique MUDO (vai à rede sem avisar)',
    de: 'pintaLembretes(negId); pintaNotif();          // resposta imediata: nada de rede até aqui', para: '' },

  { tela: 'fpmed_giovana.html', nome: 'na Proposta: clique morto no botao que gera o PDF',
    categoria: 'CLIQUE MORTO (função que não existe)',
    de: 'function gerarPDF(', para: 'function gerarPdfDoc(' },

  { tela: 'fpmed_giovana.html', nome: 'na Proposta: botao sem acao',
    categoria: 'botão sem ação',
    de: '<body>', para: '<body><button class="btn">Enviar</button>' },
];

let barradas = 0; const escaparam = [];

// ── CONTROLE: sem defeito injetado, as duas telas TÊM de sair limpas ────────────────────────
for (const tela of ['fpmed_negocios.html', 'fpmed_giovana.html']) {
  const copia = path.join(tmp, tela);
  fs.writeFileSync(copia, fs.readFileSync(path.join(raiz, tela)));
  const r = roda(copia);
  console.log(`  CONTROLE  ${tela}: ${r.achou ? '>>> JA ACUSA SEM DEFEITO — o resto nao valeria nada' : 'limpa'}`);
  if (r.achou) { console.log(r.saida.split('\n').filter(l => /·/.test(l)).slice(0, 6).join('\n')); process.exit(1); }
}

console.log('');
for (const c of CASOS) {
  const original = fs.readFileSync(path.join(raiz, c.tela), 'utf8').replace(/\r\n/g, '\n');
  if (!original.includes(c.de)) { escaparam.push(c.nome + '  (ANCORA NAO ENCONTRADA)'); console.log('  ANCORA?   ' + c.nome); continue; }
  const copia = path.join(tmp, 'x_' + c.tela);
  fs.writeFileSync(copia, original.replace(c.de, c.para));
  const r = roda(copia);
  const n = contaDe(r.saida, c.categoria);
  if (r.achou && n) { barradas++; console.log(`  PEGOU     ${c.nome}   -> ${c.categoria}: ${n}`); }
  else { escaparam.push(c.nome + (r.achou ? '  (acusou, mas em OUTRA categoria)' : '  (nao acusou nada)')); console.log('  ESCAPOU   ' + c.nome); }
}

console.log(`\nRED TEST: ${barradas} de ${CASOS.length} defeitos injetados foram pegos`);
if (escaparam.length) { console.log('>>> ESCAPARAM:'); escaparam.forEach(e => console.log('    - ' + e)); }
process.exitCode = escaparam.length ? 1 : 0;
