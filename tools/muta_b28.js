/* ══════════════════════════════════════════════════════════════════════════════════════════════
   muta_b28.js — APONTA A CATRACA DO TETO COMPETITIVO PARA O MATERIAL DE VERDADE
   (20/08/2026)

   Mesma lei do `muta_b27.js`, e ela vem da B26: *"um detector provado só contra exemplos que eu
   mesmo escrevi herda o meu engano inteiro, e herda em silêncio, com relatório verde."* Aqui a
   `tests/testa_teto_homologado.js` é apontada para os arquivos REAIS da fatia, com o defeito
   plantado dentro deles, e cobrada de vermelho.

   ══ E ELA MEDE OS DOIS LADOS ════════════════════════════════════════════════════════════════
   `deveRuir: true` são defeitos — a catraca TEM de ficar vermelha. `deveRuir: false` são
   mudanças legítimas (prosa que nomeia o que a regra proíbe, comentário novo) — e a catraca TEM
   de deixar passar. Catraca que fica vermelha com as duas não protege nada.

     node tools/muta_b28.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ARQUIVOS = [
  'fpmed_teto_homologado.js', 'fpmed_negocios.html', 'fpmed_giovana.html', 'sw.js',
  'tools/regua_visual.js', 'tests/telas_adotadas.json', 'fpmed_tema.css',
  'tests/testa_teto_homologado.js',
];
const SUITE = 'testa_teto_homologado.js';
const MOTOR = 'fpmed_teto_homologado.js';
const NEG = 'fpmed_negocios.html';
const GIO = 'fpmed_giovana.html';

const MUTACOES = [
  // ── as que TÊM de ficar vermelhas ────────────────────────────────────────────────────────
  /* A TROCA MAIS PERIGOSA DA FATIA, e é de uma linha: um pregão desesperado puxa a média e não
     move a mediana. O resultado continua parecendo um preço razoável — e é justamente por parecer
     razoável que ninguém desconfia. */
  { nome: 'a mediana vira MÉDIA', deveRuir: true, arq: MOTOR,
    de: /return v\.length % 2 \? v\[m\] : \(v\[m - 1\] \+ v\[m\]\) \/ 2;/,
    para: 'return v.reduce((a, b) => a + b, 0) / v.length;' },
  { nome: 'o sort() perde o comparador (ordena como TEXTO)', deveRuir: true, arq: MOTOR,
    de: /\.sort\(\(a, b\) => a - b\)/, para: '.sort()' },
  { nome: 'zero passa a contar como preço homologado', deveRuir: true, arq: MOTOR,
    de: /if \(!\(valor > 0\)\) continue;/, para: 'if (valor == null) continue;' },
  { nome: 'sem índice, `avaliar` devolve "não há" em vez de "não sei"', deveRuir: true, arq: MOTOR,
    de: /if \(!idx \|\| !idx\.por\) return null;/, para: 'if (!idx || !idx.por) return { n: 0 };' },
  { nome: 'o item passa a se comparar consigo mesmo (`ignorar` some)', deveRuir: true, arq: MOTOR,
    de: /const achados = \(idx\.por\.get\(k\) \|\| \[\]\)\.filter\(x =>[\s\S]*?\);/,
    para: 'const achados = (idx.por.get(k) || []);' },
  { nome: 'um resultado só vira "faixa" (de R$ 10 a R$ 10)', deveRuir: true, arq: MOTOR,
    de: /temFaixa: achados\.length > 1 && min !== max,/, para: 'temFaixa: true,' },
  { nome: 'a chave afrouxa para as 3 primeiras palavras (casa lápis com lápis diferente)', deveRuir: true, arq: MOTOR,
    de: /\.trim\(\)\n      \.replace\(\/\\s\+\/g, ' '\);/,
    para: ".trim().replace(/\\s+/g, ' ').split(' ').slice(0, 3).join(' ');" },
  /* O DEFEITO QUE A CATRACA ACHOU DE VERDADE NESTA FATIA: com `NFD`, `M²` e `M2` viram chaves
     diferentes — e 27 dos 192 resultados que existem hoje têm sobrescrito na descrição. */
  { nome: 'a normalização volta para NFD (M² deixa de casar com M2)', deveRuir: true, arq: MOTOR,
    de: /\.normalize\('NFKD'\)/, para: ".normalize('NFD')" },
  { nome: 'o CNPJ do vencedor vai para a tela do Negócios', deveRuir: true, arq: NEG,
    de: /'<i>' \+ \(it\.resultado_vencedor \? 'o vencedor'/,
    para: "'<i>' + (it.resultado_cnpj ? esc(it.resultado_cnpj) : 'o vencedor'" },
  { nome: 'o rodapé passa a publicar percentual (denominador inventado)', deveRuir: true, arq: NEG,
    de: /item\(ns\) desta licitação\. '/,
    para: "item(ns) desta licitacao (' + Math.round(c.com/Math.max(1,c.de)*100) + '%). '" },
  { nome: 'o estado vazio vira R$ 0,00', deveRuir: true, arq: NEG,
    de: /<b class="vazio">ainda não temos resultado homologado para este item<\/b>/,
    para: '<b class="vazio">R$ 0,00</b>' },
  { nome: 'a Proposta reimplementa a mediana por conta própria', deveRuir: true, arq: GIO,
    de: /function avaliarHomologado\(c, precoUnit\)\{/,
    para: 'function mediana(v){ const s=v.slice().sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; }\nfunction avaliarHomologado(c, precoUnit){' },
  { nome: 'a Proposta deixa de carregar o motor compartilhado', deveRuir: true, arq: GIO,
    de: /<script src="fpmed_teto_homologado\.js"><\/script>/, para: '' },
  { nome: 'o motor sai da casca do service worker', deveRuir: true, arq: 'sw.js',
    de: /\n\s*'\.\/fpmed_teto_homologado\.js',[^\n]*\n/, para: '\n' },
  /* ARQUIVO NOVO NA CASCA SEM BUMP não é baixado por quem já instalou: a casca só é remontada
     quando a versão muda. O recurso existiria só para quem chegou hoje. */
  { nome: 'a casca ganha arquivo novo mas ninguém bumpa a versão', deveRuir: true, arq: 'sw.js',
    de: /limedtec-fpmed-2026-08-20-86/, para: 'limedtec-fpmed-2026-08-20-85' },
  { nome: 'a falha de leitura vira "não há resultado"', deveRuir: true, arq: NEG,
    de: /não consegui ler os resultados homologados/, para: 'sem resultado homologado' },

  // ── as que NÃO podem ficar vermelhas ─────────────────────────────────────────────────────
  /* A prosa desta casa nomeia o que a regra proíbe — é a única maneira de um comentário ensinar
     uma regra. Se a catraca cobrar do comentário, o conserto vira "apagar a explicação", e
     explicação apagada é a causa da próxima geração do mesmo defeito. */
  { nome: 'um comentário explica por que NÃO se usa a média', deveRuir: false, arq: MOTOR,
    de: /function mediana\(valores\) \{/,
    para: '/* a media de [10,10,10,1] e 7,75 e a mediana e 10 — por isso aqui nao ha media */\nfunction mediana(valores) {' },
  { nome: 'um comentário cita `resultado_cnpj` explicando por que ele não sai', deveRuir: false, arq: NEG,
    de: /function homologadoDoItem\(it\)\{/,
    para: '/* o resultado_cnpj fica no dado e NAO vem para ca — ver o cabecalho */\nfunction homologadoDoItem(it){' },
  { nome: 'um comentário no rodapé cita "percentual" e um sinal de %', deveRuir: false, arq: NEG,
    de: /function rodapeDoHomologado\(\)\{/,
    para: '/* aqui nao sai percentual nenhum: nada de 100% sem denominador conhecido */\nfunction rodapeDoHomologado(){' },
  { nome: 'a Proposta ganha um comentário citando Math.floor(x.length / 2)', deveRuir: false, arq: GIO,
    de: /function homolBadgeHTML\(r\)\{/,
    para: '/* a conta Math.floor(v.length / 2) mora no motor, nunca aqui */\nfunction homolBadgeHTML(r){' },
];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'muta-b28-'));
function semeia() {
  for (const rel of ARQUIVOS) {
    const dest = path.join(TMP, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, rel), dest);
  }
}
function roda() {
  try { execFileSync(process.execPath, [path.join(TMP, 'tests', SUITE)], { stdio: 'pipe', encoding: 'utf8' }); return { verde: true, saida: '' }; }
  catch (e) { return { verde: false, saida: String((e.stdout || '') + (e.stderr || '')) }; }
}

console.log('=== MUTAÇÃO DA FATIA B28 — a catraca contra o material de verdade ===\n');
semeia();
const ctrl = roda();
console.log(`  controle · ${SUITE} ${ctrl.verde ? 'VERDE' : '*** JÁ ESTÁ VERMELHA ***'}`);
if (!ctrl.verde) {
  // Sem este passo, uma suíte já vermelha faria TODA mutação `deveRuir:true` "passar" — e o
  // placar sairia cheio sem ter provado nada. É o formato exato do detector cego da B26.
  console.log(ctrl.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 6).join('\n'));
  console.log('\n>>> ABORTADO: com a suíte já vermelha, a mutação não prova nada.');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(1);
}
console.log('');

let pegou = 0, escapou = 0, falso = 0;
const escapadas = [], falsas = [];
for (const m of MUTACOES) {
  semeia();
  const alvo = path.join(TMP, m.arq);
  const antes = fs.readFileSync(alvo, 'utf8').replace(/\r\n/g, '\n');
  const depois = antes.replace(m.de, m.para);
  if (depois === antes) {
    escapou++; escapadas.push(m.nome + '  (o padrão não casou — o alvo mudou de forma)');
    console.log(`  ?? ${m.nome}\n     >>> o padrão não casou; esta mutação não mediu nada`);
    continue;
  }
  fs.writeFileSync(alvo, depois, 'utf8');
  const r = roda();
  if (m.deveRuir) {
    if (!r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  vermelha, como devia`); }
    else { escapou++; escapadas.push(m.nome); console.log(`  ** ESCAPOU: ${m.nome}  ->  a catraca ficou VERDE`); }
  } else {
    if (r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  passou, como devia (não é defeito)`); }
    else {
      falso++; falsas.push(m.nome);
      console.log(`  ** FALSO VERMELHO: ${m.nome}`);
      console.log('     ' + r.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 2).join('\n     '));
    }
  }
}
fs.rmSync(TMP, { recursive: true, force: true });

console.log('\n══ PLACAR ══');
console.log(`  ${pegou} de ${MUTACOES.length} mutações se comportaram como deviam`);
console.log(`  ${escapou} escaparam · ${falso} falso(s) vermelho(s)`);
if (escapadas.length) console.log('\n  ESCAPARAM:\n   - ' + escapadas.join('\n   - '));
if (falsas.length) console.log('\n  FALSO VERMELHO:\n   - ' + falsas.join('\n   - '));
process.exitCode = (escapou || falso) ? 1 : 0;
