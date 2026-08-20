/* ══════════════════════════════════════════════════════════════════════════════════════════════
   muta_b29.js — APONTA A CATRACA DO PISO PARA O MATERIAL DE VERDADE (20/08/2026)

   Mesma lei do `muta_b28.js`, e ela vem da B26: *"um detector provado só contra exemplos que eu
   mesmo escrevi herda o meu engano inteiro, e herda em silêncio, com relatório verde."* Aqui a
   `tests/testa_piso.js` é apontada para os arquivos REAIS da fatia, com o defeito plantado dentro
   deles, e cobrada de vermelho.

   ══ E ELA MEDE OS DOIS LADOS ════════════════════════════════════════════════════════════════
   `deveRuir: true` são defeitos — a catraca TEM de ficar vermelha. `deveRuir: false` são
   mudanças legítimas (prosa que nomeia o que a regra proíbe) — e a catraca TEM de deixar passar.
   Catraca que fica vermelha com as duas não protege nada; ela só ensina a apagar comentário.

     node tools/muta_b29.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ARQUIVOS = [
  'fpmed_piso.js', 'fpmed_giovana.html', 'fpmed_documentos.html', 'sw.js',
  'ddl/operacao_parametros.sql', 'tools/regua_visual.js', 'tests/testa_piso.js',
  // A régua do A lê o tema e a lista de telas adotadas no `require` — sem eles a cópia nem
  // carrega, e o controle acusaria "já está vermelha" sobre um erro de arquivo faltando.
  'fpmed_tema.css', 'tests/telas_adotadas.json',
];
const SUITE = 'testa_piso.js';
const MOTOR = 'fpmed_piso.js';
const GIO = 'fpmed_giovana.html';
const DOC = 'fpmed_documentos.html';
const DDL = 'ddl/operacao_parametros.sql';

const MUTACOES = [
  // ── as que TÊM de ficar vermelhas ────────────────────────────────────────────────────────
  /* O DEFEITO CENTRAL DA FATIA, e ele é de um caractere: trocar a divisão pela multiplicação. O
     resultado continua parecendo um piso, com quatro casas decimais e tudo. Com 25% de alíquota
     ele fica 6,25% abaixo do piso de verdade — e o sintoma aparece meses depois, na margem. */
  { nome: 'o imposto passa a MULTIPLICAR em vez de dividir', deveRuir: true, arq: MOTOR,
    de: /var piso = custoTotal \/ \(1 - aliq\);/, para: 'var piso = custoTotal * (1 + aliq);' },
  { nome: 'a alíquota deixa de virar fração (10 em vez de 0,10)', deveRuir: true, arq: MOTOR,
    de: /var aliq = num\(t\.aliquota_pct\) \/ 100;/, para: 'var aliq = num(t.aliquota_pct);' },
  /* O ATALHO MAIS TENTADOR DE TODOS: "enquanto ninguém cadastra, assume zero". Com alíquota zero
     o piso vira o custo, o gestor vê folga que não existe, e a tela fica MAIS perigosa do que
     quando não mostrava nada. */
  { nome: 'sem parâmetro, o motor assume alíquota ZERO e mostra piso mesmo assim', deveRuir: true, arq: MOTOR,
    de: /if \(faltando\.length\) return \{ ok: false, motivo: 'sem_parametro', faltam: faltando \};/,
    para: "if (faltando.length) { params = { tributos:{regime:'simples',aliquota_pct:0}, frete:{frete_tipo:'valor',frete_valor:0}, rateio:{custo_fixo_mensal:0,volume_mensal:1} }; }" },
  { nome: 'custo ZERO passa a valer como custo de compra', deveRuir: true, arq: MOTOR,
    de: /if \(!\(custo > 0\)\) return \{ ok: false, motivo: 'sem_custo', faltam: \[\] \};/,
    para: "if (custo == null) return { ok: false, motivo: 'sem_custo', faltam: [] };" },
  { nome: 'o custo ESTIMADO (venda ÷ 1,25) passa a virar piso', deveRuir: true, arq: MOTOR,
    de: /if \(q\.custoEstimado && !\(num\(q\.custoUnit\) > 0\)\)\n      return \{ estado: 'custo_estimado', piso: null \};/,
    para: '' },
  { nome: 'volume mensal ZERO deixa de contar como falta (o rateio vira infinito)', deveRuir: true, arq: MOTOR,
    de: /if \(completo && c\.chave === 'rateio' && !\(num\(l\.volume_mensal\) > 0\)\) completo = false;/, para: '' },
  { nome: 'alíquota de 100% deixa de contar como falta (o divisor vira zero)', deveRuir: true, arq: MOTOR,
    de: /if \(a === null \|\| a < 0 \|\| a >= 100\) completo = false;/, para: 'if (a === null) completo = false;' },
  /* ZERO INFORMADO É UMA RESPOSTA. Confundi-lo com "não informado" apagaria o piso de uma operação
     inteira cujo fornecedor entrega sem cobrar frete — e o motivo seria invisível. */
  { nome: 'frete ZERO informado passa a contar como parâmetro que falta', deveRuir: true, arq: MOTOR,
    de: /return l\[k\] !== null && l\[k\] !== undefined && l\[k\] !== '';/,
    para: 'return !!l[k];' },
  { nome: 'a vigência que começa HOJE deixa de valer hoje (`<` no lugar de `<=`)', deveRuir: true, arq: MOTOR,
    de: /if \(!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(ini\) \|\| ini > data\) return;/,
    para: "if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(ini) || ini >= data) return;" },
  { nome: 'a vigência FUTURA passa a valer hoje', deveRuir: true, arq: MOTOR,
    de: /\|\| ini > data\) return;/, para: ') return;' },
  { nome: 'o piso exibido passa a arredondar PARA BAIXO', deveRuir: true, arq: MOTOR,
    de: /pisoCentavos: Math\.ceil\(piso \* 100 - 1e-9\) \/ 100,/, para: 'pisoCentavos: Math.floor(piso * 100) / 100,' },
  { nome: 'o prejuízo total vira ZERO quando não se sabe a quantidade', deveRuir: true, arq: MOTOR,
    de: /out\.prejuizoTotal = un > 0 \? out\.prejuizoUnit \* un : null;/,
    para: 'out.prejuizoTotal = out.prejuizoUnit * (un || 0);' },
  { nome: 'a folga vira 0% quando não há preço proposto', deveRuir: true, arq: MOTOR,
    de: /if \(!\(preco > 0\)\) return out;/, para: 'if (!(preco > 0)) { out.folgaPct = 0; return out; }' },
  /* A CONTA REIMPLEMENTADA NA TELA — a família de defeito mais cara deste projeto, agora num
     número que decide lance. */
  { nome: 'a Proposta reimplementa a conta do piso por conta própria', deveRuir: true, arq: GIO,
    de: /function avaliarPiso\(c, precoUnit\)\{/,
    para: 'function pisoLocal(custo, a){ return custo / (1 - a); }\nfunction avaliarPiso(c, precoUnit){' },
  { nome: 'a Proposta deixa de carregar o motor compartilhado', deveRuir: true, arq: GIO,
    de: /<script src="fpmed_piso\.js"><\/script>/, para: '' },
  { nome: 'a Documentos deixa de carregar o motor (e passa a ter a própria lista)', deveRuir: true, arq: DOC,
    de: /<script src="fpmed_piso\.js"><\/script>/, para: '' },
  { nome: 'o selo do estado vazio vira R$ 0,00', deveRuir: true, arq: GIO,
    de: /'">não dá para calcular o piso: falta '/, para: "'\">R$ 0,00 '" },
  { nome: 'o selo deixa de nomear o que falta', deveRuir: true, arq: GIO,
    de: /não dá para calcular o piso: falta '/, para: "piso indisponivel '" },
  { nome: 'a conta aberta some (fica só o total)', deveRuir: true, arq: GIO,
    de: /<div id="piso-conta-\$\{c\.id\}">\$\{pisoContaHTML\(avaliarPiso\(c, precoUnit\)\)\}<\/div>/, para: '' },
  { nome: 'o selo do piso para de repintar tecla a tecla', deveRuir: true, arq: GIO,
    de: /const bp = document\.getElementById\('piso-badge-'\+id\);[\s\S]*?\n  \}\n  calcTotal\(\);/,
    para: '  calcTotal();' },
  { nome: 'o preço abaixo do piso passa a ser BLOQUEADO em vez de avisado', deveRuir: true, arq: GIO,
    de: /function pisoContaHTML\(r\)\{/,
    para: 'function pisoContaHTML(r){ if(r && r.abaixo){ alert("abaixo do piso"); }' },
  { nome: 'o motor sai da casca do service worker', deveRuir: true, arq: 'sw.js',
    de: /\n\s*'\.\/fpmed_piso\.js',[^\n]*\n/, para: '\n' },
  /* ══ ESTE PADRÃO ERA FIXO E PAROU DE CASAR (corrigido em 20/08, pela fatia B30) ═════════════
     Ele procurava `-87` exato. Quando a B30 bumpou a casca para -88, a mutação deixou de casar —
     e mutação que não casa **não fica vermelha: ela se declara "escapada"**, e o placar passa a
     acusar um buraco na catraca que não existe. Ou seja: o controle que existe para medir a
     catraca passou a mentir sobre ela, e ninguém teria olhado se o placar não fosse lido.
     >>> A forma certa é a que a própria `testa_piso.js` já usava para o mesmo número: tratar a
         versão como PISO, e não como igualdade. O `sw.js` é o único arquivo que as duas janelas
         editam no mesmo dia, e a regra combinada é que o número só sobe. */
  { nome: 'a casca ganha arquivo novo mas ninguém bumpa a versão', deveRuir: true, arq: 'sw.js',
    de: /limedtec-fpmed-\d{4}-\d{2}-\d{2}-\d+/, para: 'limedtec-fpmed-2026-08-20-86' },
  { nome: 'o banco passa a aceitar meio componente (o CHECK some)', deveRuir: true, arq: DDL,
    de: /constraint op_par_coerente check \(/, para: 'constraint op_par_frouxo check (true) /* (' },
  { nome: 'o banco passa a aceitar volume mensal ZERO', deveRuir: true, arq: DDL,
    de: /volume_mensal     numeric check \(volume_mensal > 0\),/, para: 'volume_mensal     numeric,' },
  { nome: 'aparece uma policy de DELETE (parâmetro apagado = proposta sem explicação)', deveRuir: true, arq: DDL,
    de: /revoke all on public\.operacao_parametros from anon;/,
    para: 'create policy op_par_del on public.operacao_parametros for delete to authenticated using (true);\nrevoke all on public.operacao_parametros from anon;' },

  // ── as que NÃO podem ficar vermelhas ─────────────────────────────────────────────────────
  /* A prosa desta casa nomeia o que a regra proíbe — é a única maneira de um comentário ensinar
     uma regra. Se a catraca cobrar do comentário, o conserto vira "apagar a explicação", e
     explicação apagada é a causa da próxima geração do mesmo defeito. */
  { nome: 'um comentário explica por que NÃO se multiplica por (1 + alíquota)', deveRuir: false, arq: MOTOR,
    de: /function calcular\(pedido\) \{/,
    para: '/* nunca custo * (1 + aliq): o imposto incide sobre a venda, e por isso ele divide */\nfunction calcular(pedido) {' },
  { nome: 'a Proposta ganha comentário citando a divisão do piso', deveRuir: false, arq: GIO,
    de: /function pisoBadgeHTML\(r\)\{/,
    para: '/* a conta custo / (1 - aliq) mora no motor, nunca aqui */\nfunction pisoBadgeHTML(r){' },
  { nome: 'a Documentos ganha comentário citando R$ 0,00 como proibido', deveRuir: false, arq: DOC,
    de: /function pintaParametros\(\)\{/,
    para: '/* aqui nunca sai R$ 0,00 no lugar de "nao informado" */\nfunction pintaParametros(){' },
];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'muta-b29-'));
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

console.log('=== MUTAÇÃO DA FATIA B29 — a catraca do piso contra o material de verdade ===\n');
semeia();
const ctrl = roda();
console.log(`  controle · ${SUITE} ${ctrl.verde ? 'VERDE' : '*** JÁ ESTÁ VERMELHA ***'}`);
if (!ctrl.verde) {
  // Sem este passo, uma suíte já vermelha faria TODA mutação `deveRuir:true` "passar" — e o placar
  // sairia cheio sem ter provado nada. É o formato exato do detector cego da B26.
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
