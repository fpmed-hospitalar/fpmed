/* ══════════════════════════════════════════════════════════════════════════════════════════════
   muta_b35.js — A CATRACA DE "QUEM GANHOU" CONTRA O MATERIAL DE VERDADE (21/08/2026)

   Mesma lei do `muta_b34.js`, e ela vem da B26: *"um detector provado só contra exemplos que eu
   mesmo escrevi herda o meu engano inteiro, e herda em silêncio, com relatório verde."*

   ══ E AQUI ELA É MAIS NECESSÁRIA QUE DE COSTUME ═════════════════════════════════════════════
   A `testa_quem_ganhou` ficou verde na PRIMEIRA execução, com 38 asserts. Suíte que nasce verde
   ou está certa ou não está olhando — e as duas se parecem exatamente. As mutações abaixo são a
   única maneira de saber qual das duas é.

   `deveRuir: true` são defeitos — a catraca TEM de ficar vermelha. `deveRuir: false` são mudanças
   legítimas (prosa que nomeia o que a regra proíbe) — e a catraca TEM de deixar passar.

     node tools/muta_b35.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ARQUIVOS = [
  'fpmed_teto_homologado.js', 'fpmed_negocios.html', 'fpmed_giovana.html',
  'tests/testa_quem_ganhou.js', 'tests/testa_teto_homologado.js',
  // A régua do A é lida no `require` das suítes, e desde a A37 ela `require` a prova do papel.
  'tools/regua_visual.js', 'tools/prova_papel_congelado.js',
  'fpmed_tema.css', 'tests/telas_adotadas.json', 'sw.js',
];
/* DUAS SUÍTES: a nova e a da B28, que mede o MESMO motor por outro ângulo. Rodar só a nova
   esconderia que o `avaliar` e o `quemGanhou` compartilham a chave e o `ignorar` — e uma mutação
   na chave tem de ficar vermelha nas duas, senão uma delas está confiando na outra. */
const SUITES = ['testa_quem_ganhou.js', 'testa_teto_homologado.js'];
const SUITE = SUITES.join(' + ');
const MOTOR = 'fpmed_teto_homologado.js';
const NEG = 'fpmed_negocios.html';

const MUTACOES = [
  // ── A IDENTIDADE ─────────────────────────────────────────────────────────────────────────
  /* A PRIMEIRA É A DA FATIA INTEIRA, e ela não levanta erro nenhum: a tela fica bonita, com dois
     fornecedores onde há um, cada um com metade das vitórias. Medido no banco: 12 CNPJs teriam
     virado 24 fornecedores. */
  { nome: '*** o agrupamento passa a ser pelo NOME (12 fornecedores viram 24) ***',
    deveRuir: true, arq: MOTOR,
    de: /const id = a\.cnpj \|\| \('sem-cnpj:' \+ \(a\.vencedor \|\| '\?'\)\);/,
    para: "const id = a.vencedor || a.cnpj || '?';" },
  { nome: 'o CNPJ some do indice (o motor perde a identidade)', deveRuir: true, arq: MOTOR,
    de: /        cnpj: l\.resultado_cnpj \|\| null,/, para: '' },
  { nome: '*** as linhas sem CNPJ viram um fornecedor so (afirma que sao a mesma empresa) ***',
    deveRuir: true, arq: MOTOR,
    de: /\('sem-cnpj:' \+ \(a\.vencedor \|\| '\?'\)\)/, para: "'sem-cnpj'" },
  { nome: 'o nome mostrado passa a ser o mais FREQUENTE, e nao o mais recente',
    deveRuir: true, arq: MOTOR,
    de: /      const dx = x\[1\]\.data \|\| '', dy = y\[1\]\.data \|\| '';\n      if \(dx !== dy\) return dy\.localeCompare\(dx\);\n/,
    para: '' },
  { nome: 'o desempate alfabetico some (a ordem muda entre duas aberturas da tela)',
    deveRuir: true, arq: MOTOR,
    de: /      return x\[0\]\.localeCompare\(y\[0\]\);/, para: '      return 0;' },
  /* A PRIMEIRA VERSÃO DESTA MUTAÇÃO ERA INERTE: `nomes[0][0] || 'fornecedor'` nunca roda quando
     não há vencedor, porque a função já devolveu `null` no `if (!nomes.length)` acima. Mutação
     que não muda comportamento acusa um buraco que é buraco na mutação. O alvo certo é o RETORNO
     do caso vazio, que é onde o nome inventado entraria de verdade. */
  { nome: 'vencedor nao publicado passa a virar um nome inventado', deveRuir: true, arq: MOTOR,
    de: /    if \(!nomes\.length\) return null;/, para: "    if (!nomes.length) return 'fornecedor';" },

  // ── O DENOMINADOR ────────────────────────────────────────────────────────────────────────
  { nome: '*** `certames` passa a contar LINHAS em vez de certames distintos ***',
    deveRuir: true, arq: MOTOR,
    de: /    const certames = new Set\(achados\.map\(x => x\.numero_controle\)\.filter\(Boolean\)\)\.size;/,
    para: '    const certames = achados.length;' },
  { nome: 'o denominador por fornecedor tambem passa a contar linhas', deveRuir: true, arq: MOTOR,
    de: /      const certames = new Set\(linhas\.map\(x => x\.numero_controle\)\.filter\(Boolean\)\)\.size;/,
    para: '      const certames = linhas.length;' },
  { nome: '*** a tela para de imprimir sobre quantos certames a conta foi feita ***',
    deveRuir: true, arq: NEG,
    de: /const base = g\.n \+ ' resultado\(s\) em ' \+ g\.certames \+ ' certame\(s\)';/,
    para: "const base = g.n + ' resultado(s)';" },
  { nome: 'um resultado deixa de se declarar um caso', deveRuir: true, arq: MOTOR,
    de: /      umResultado: achados\.length === 1,/, para: '      umResultado: false,' },
  { nome: 'a tela para de dizer que um resultado nao e historico', deveRuir: true, arq: NEG,
    de: /' — um resultado não é histórico, é um caso\.'/, para: "''" },
  { nome: '*** um fornecedor so passa a ser anunciado como "quem mais ganha" ***',
    deveRuir: true, arq: MOTOR,
    de: /      umFornecedor: fornecedores\.length === 1,/, para: '      umFornecedor: false,' },
  { nome: 'a tela deixa de dizer que o unico e unico NOS NOSSOS DADOS', deveRuir: true, arq: NEG,
    de: /é o único fornecedor <b>nos resultados que nós temos<\/b>, '\n        \+ 'e isso não quer dizer que seja o único que disputa este item\./,
    para: "é o maior fornecedor deste item." },

  // ── A DISPERSÃO ──────────────────────────────────────────────────────────────────────────
  /* O par abaixo é o que separa esta fatia da sugestão que ela recusou: um piso de comprimento
     marcaria CEBOLA (1,1x) e deixaria passar o FILTRO COMBUSTIVEL de 44 caracteres (12,7x). */
  { nome: '*** a dispersao vira um piso de COMPRIMENTO da chave (a sugestao que eu medi e recusei) ***',
    deveRuir: true, arq: MOTOR,
    de: /      disperso: razao != null && razao >= LIMITE_DISPERSAO,/,
    para: '      disperso: achados.length > 1 && k.length <= 12,' },
  { nome: 'o limite de dispersao afrouxa para 50x (nada nunca e marcado)', deveRuir: true, arq: MOTOR,
    de: /const LIMITE_DISPERSAO = 3;/, para: 'const LIMITE_DISPERSAO = 50;' },
  /* A MUTAÇÃO "esconder em vez de declarar" TAMBÉM NASCEU INERTE: ela acrescentava um campo ao
     retorno do caso VAZIO, que não é o caso disperso. Filtrar em silêncio é o defeito de verdade,
     e ele acontece na lista de fornecedores — é lá que a mutação tem de morder. */
  { nome: '*** o produto disperso passa a ser ESCONDIDO em vez de declarado ***',
    deveRuir: true, arq: MOTOR,
    de: /      fornecedores,\n      \/\* AS TRÊS BANDEIRAS/,
    para: '      fornecedores: (razao != null && razao >= LIMITE_DISPERSAO) ? [] : fornecedores,\n      /* AS TRÊS BANDEIRAS' },
  { nome: 'o disperso deixa de ser um DESVIO e vira um aviso ao lado da lideranca',
    deveRuir: true, arq: NEG,
    de: /    \} else if\(g\.umFornecedor\)\{/, para: '    }\n    if(g.umFornecedor){' },
  { nome: 'a tela para de avisar da dispersao e lidera com o nome mesmo assim',
    deveRuir: true, arq: NEG, de: /    if\(g\.disperso\)\{/, para: '    if(false){' },
  { nome: 'o aviso de dispersao perde a razao medida (vira opiniao)', deveRuir: true, arq: NEG,
    de: /\+ Number\(g\.razao\)\.toLocaleString\('pt-BR', \{maximumFractionDigits:1\}\) \+ 'x<\/b> entre o menor e o maior\. '/,
    para: "+ 'muito</b>. '" },

  // ── O RANKING QUE NÃO PODE NASCER ────────────────────────────────────────────────────────
  { nome: '*** o motor ganha uma funcao de ranking global ***', deveRuir: true, arq: MOTOR,
    de: /  raiz\.FPMED_TETO_HOMOLOGADO = \{ chave, mediana, indexa, avaliar, cobertura,/,
    para: '  function maioresFornecedores(idx) { return idx; }\n  raiz.FPMED_TETO_HOMOLOGADO = { chave, mediana, indexa, avaliar, cobertura, maioresFornecedores,' },
  { nome: 'o numero que justifica a recusa do ranking some do motor', deveRuir: true, arq: MOTOR,
    de: /\*\*344 deles\n     ganharam exatamente UM certame\*\*/, para: 'a maioria ganhou pouco' },
  { nome: 'e o total de fornecedores some junto', deveRuir: true, arq: MOTOR,
    de: /\*\*392 fornecedores\*\*/, para: 'muitos fornecedores' },
  { nome: 'a prosa perde o ponteiro para a prova que remede o numero contra o banco',
    deveRuir: true, arq: MOTOR, de: /tools\/prova_b35_quem_ganhou\.js/, para: 'alguma prova' },

  // ── O CNPJ NA TELA ───────────────────────────────────────────────────────────────────────
  { nome: '*** o bloco do Negocios passa a imprimir o CNPJ ao lado do nome ***',
    deveRuir: true, arq: NEG,
    de: /const linha = f => esc\(f\.nome \|\| 'vencedor não publicado'\)/,
    para: "const linha = f => esc(f.nome || 'vencedor não publicado') + ' ' + esc(f.cnpj || '')" },
  { nome: '*** o CNPJ do resultado proprio vai para a linha ***', deveRuir: true, arq: NEG,
    de: /\+ '<i>' \+ \(it\.resultado_vencedor \? esc\(it\.resultado_vencedor\)/,
    para: "+ '<i>' + esc(it.resultado_cnpj || '') + (it.resultado_vencedor ? esc(it.resultado_vencedor)" },
  { nome: 'a tela volta a escrever a palavra "o vencedor" no lugar do nome', deveRuir: true, arq: NEG,
    de: /\(it\.resultado_vencedor \? esc\(it\.resultado_vencedor\) : 'vencedor não publicado'\)/,
    para: "(it.resultado_vencedor ? 'o vencedor' : 'vencedor não publicado')" },
  { nome: '*** a Proposta ganha o bloco de quem ganhou (nome de concorrente na peca do orgao) ***',
    deveRuir: true, arq: 'fpmed_giovana.html',
    de: /const T = window\.FPMED_TETO_HOMOLOGADO;/,
    para: 'const T = window.FPMED_TETO_HOMOLOGADO; const _qg = T && T.quemGanhou;' },

  // ── OS TRÊS ESTADOS ──────────────────────────────────────────────────────────────────────
  { nome: '*** "nao sei" passa a devolver "nao ha" (indice que nao carregou vira mercado vazio) ***',
    deveRuir: true, arq: MOTOR,
    de: /    if \(!idx \|\| !idx\.por\) return null;          \/\/ não sei — o índice não carregou/,
    para: '    if (!idx || !idx.por) return { n: 0, chave: "", certames: 0, fornecedores: [] };' },
  { nome: 'o proprio item deixa de ser tirado da conta (o item se compara consigo mesmo)',
    deveRuir: true, arq: MOTOR,
    de: /    const achados = \(idx\.por\.get\(k\) \|\| \[\]\)\.filter\(x =>\n      !\(ign\.numero_controle && x\.numero_controle === ign\.numero_controle\n        && String\(ign\.numero_item\) === x\.numero_item\)\);\n\n    if \(!achados\.length\) return \{ n: 0, chave: k, certames: 0/,
    para: '    const achados = (idx.por.get(k) || []);\n\n    if (!achados.length) return { n: 0, chave: k, certames: 0' },
  { nome: 'o truncamento para de viajar com a resposta', deveRuir: true, arq: MOTOR,
    de: /      truncado: !!idx\.truncado,\n    \};\n  \}\n\n  \/\* ── A DÍVIDA/, para: '    };\n  }\n\n  /* ── A DÍVIDA' },
  { nome: '*** o teto da consulta volta a 2.000 e o indice nasce truncado todo dia ***',
    deveRuir: true, arq: NEG, de: /const HOMOL_TETO = 5000;/, para: 'const HOMOL_TETO = 2000;' },
  { nome: 'o estado vazio deixa de dizer que falta tambem quem ganhou', deveRuir: true, arq: NEG,
    de: /'<i>nem o preço nem quem ganhou: o resultado por item/, para: "'<i>o resultado por item" },
  { nome: 'a faixa por fornecedor com uma vitoria so vira "de X a X"', deveRuir: true, arq: MOTOR,
    de: /        temFaixa: vs\.length > 1 && Math\.min\.apply\(null, vs\) !== Math\.max\.apply\(null, vs\),/,
    para: '        temFaixa: vs.length > 0,' },
  { nome: 'a ordem passa a ser so por vezes (empate muda de posicao a cada abertura)',
    deveRuir: true, arq: MOTOR,
    de: /      \|\| String\(a\.nome \|\| ''\)\.localeCompare\(String\(b\.nome \|\| ''\)\)\);/, para: ');' },
  { nome: '*** a lista corta em 5 e para de contar quantos ficaram de fora ***',
    deveRuir: true, arq: NEG,
    de: /\(resto > 0 \? ' · <b>e mais ' \+ resto \+ '<\/b>' : ''\)/, para: "''" },

  // ── AS QUE **NÃO** PODEM FICAR VERMELHAS ─────────────────────────────────────────────────
  /* A prosa desta casa NOMEIA o que a regra proíbe. Se a catraca cobrar do comentário, o conserto
     vira "apagar a explicação" — e explicação apagada é a causa da próxima geração do defeito. */
  { nome: 'um comentario cita "maiores fornecedores" como o que nao se publica', deveRuir: false,
    arq: MOTOR, de: /  function quemGanhou\(pedido, idx\) \{/,
    para: '  /* jamais uma lista de "maiores fornecedores" aqui: 346 dos 394 ganharam um certame */\n  function quemGanhou(pedido, idx) {' },
  { nome: 'um comentario cita `resultado_cnpj` como o que nao vai para a tela', deveRuir: false,
    arq: NEG, de: /function homologadoDoItem\(it\)\{/,
    para: '/* aqui nunca sai it.resultado_cnpj: o nome e publicacao legal, o CNPJ e chave de juncao */\nfunction homologadoDoItem(it){' },
  { nome: 'a suite ganha comentario citando o piso de comprimento como o criterio recusado',
    deveRuir: false, arq: 'tests/testa_quem_ganhou.js',
    de: /console\.log\('\\nRESULTADO: '/,
    para: "/* o criterio NAO e k.length <= 12: medido, ele marca CEBOLA e deixa passar o FILTRO */\nconsole.log('\\nRESULTADO: '" },
];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'muta-b35-'));
function semeia() {
  for (const rel of ARQUIVOS) {
    const dest = path.join(TMP, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, rel), dest);
  }
}
function roda() {
  let verde = true, saida = '', quem = [];
  for (const s of SUITES) {
    try { execFileSync(process.execPath, [path.join(TMP, 'tests', s)], { stdio: 'pipe', encoding: 'utf8' }); }
    catch (e) { verde = false; quem.push(s.replace(/^testa_|\.js$/g, '')); saida += String((e.stdout || '') + (e.stderr || '')); }
  }
  return { verde: verde, saida: saida, quem: quem.join(', ') };
}

console.log('=== MUTACAO DA FATIA B35 — quem ganhou, contra o material de verdade ===\n');
semeia();
const ctrl = roda();
console.log(`  controle · ${SUITE} ${ctrl.verde ? 'VERDE' : '*** JA ESTA VERMELHA ***'}`);
if (!ctrl.verde) {
  console.log(ctrl.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 6).join('\n'));
  console.log('\n>>> ABORTADO: com a suite ja vermelha, a mutacao nao prova nada.');
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
    escapou++; escapadas.push(m.nome + '  (o padrao nao casou — o alvo mudou de forma)');
    console.log(`  ?? ${m.nome}\n     >>> o padrao nao casou; esta mutacao nao mediu nada`);
    continue;
  }
  fs.writeFileSync(alvo, depois, 'utf8');
  const r = roda();
  if (m.deveRuir) {
    if (!r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  vermelha (${r.quem}), como devia`); }
    else { escapou++; escapadas.push(m.nome); console.log(`  ** ESCAPOU: ${m.nome}  ->  a catraca ficou VERDE`); }
  } else {
    if (r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  passou, como devia (nao e defeito)`); }
    else {
      falso++; falsas.push(m.nome);
      console.log(`  ** FALSO VERMELHO: ${m.nome}`);
      console.log('     ' + r.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 2).join('\n     '));
    }
  }
}
fs.rmSync(TMP, { recursive: true, force: true });

console.log('\n== PLACAR ==');
console.log(`  ${pegou} de ${MUTACOES.length} mutacoes se comportaram como deviam`);
console.log(`  ${escapou} escaparam · ${falso} falso(s) vermelho(s)`);
if (escapadas.length) console.log('\n  ESCAPARAM:\n   - ' + escapadas.join('\n   - '));
if (falsas.length) console.log('\n  FALSO VERMELHO:\n   - ' + falsas.join('\n   - '));
process.exitCode = (escapou || falso) ? 1 : 0;
