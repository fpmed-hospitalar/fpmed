// VERIFICADOR DE REBRAND — guarda permanente do porte GlobalMed -> FPMED.
//
// POR QUE EXISTE: o Lemuel liberou os Blocos 2 e 4 do sync "COM VERIFICADOR DE REBRAND".
// Todo porte anterior conferia o rebrand DENTRO do proprio script de porte (porta_motor_da_global.js).
// Isso protege o porte que passou por aquele script e nada mais. Bloco 2 e PORTE MANUAL no
// fpmed_sistema_final.html — escrito a mao, sem script de porte — entao a conferencia precisa ser
// uma ferramenta separada, que roda sobre o ARQUIVO FINAL, venha ele de onde vier.
//
// O QUE ELE NAO E: nao e um linter de estilo. Ele responde UMA pergunta: "entrou alguma coisa da
// GlobalMed nos arquivos que a FPMED publica, ou sumiu alguma coisa que e da FPMED?"
//
// DISTINCAO QUE IMPORTA (checklist do SYNC_GLOBAL.md): a MARCA "GlobalMed" e proibida; o DADO
// 'GLOBAL' (fornecedor='1', tipo='global', estoque proprio) e legitimo e TEM que ficar. Por isso o
// padrao proibido e /GlobalMed|GLOBALMED/ e nunca /GLOBAL/.
//
//   node tools/confere_rebrand.js              -> confere os arquivos publicados
//   node tools/confere_rebrand.js --arquivo X  -> confere so um arquivo
//   node tools/confere_rebrand.js --texto      -> le um arquivo avulso por caminho (previa de porte)
//   node tools/confere_rebrand.js --json       -> saida de maquina (pra suite)
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

// ── ARQUIVOS QUE A FPMED PUBLICA ──────────────────────────────────────────────
// So o que vai pro ar. tools/ e tests/ ficam de fora de proposito: eles LEEM de C:\globalmed e
// citam a Global por necessidade (e o sync inteiro vive la). Doc (.md, CONTINUAR_AQUI) idem.
const PUBLICADOS = [
  'fpmed_sistema_final.html', 'fpmed_giovana.html', 'fpmed_vendas.html', 'fpmed_viabilidade.html',
  'fpmed_competitividade.html', 'fpmed_painel.html', 'fpmed_licitacoes.html', 'fpmed_template.html',
  'dashboard_clientes.html', 'index.html', 'reset-senha.html',
  'gm-auth.js', 'sw.js', 'cliente.config.js',
  'limedtec-config.js', 'limedtec-licenca.js', 'limedtec-papeis.js', 'limedtec-pwa.js', 'limedtec-tema.js',
];

// ── PROIBIDO: se aparecer, o rebrand vazou ───────────────────────────────────
// Cada linha e um item do checklist de REBRAND do SYNC_GLOBAL.md.
const PROIBIDO = [
  ['marca GlobalMed',            /GlobalMed|GLOBALMED|Globalmed/g,        'checklist: nome. (o DADO "GLOBAL" e legitimo e nao entra aqui)'],
  ['Supabase da Global',         /vikewlbhkrikcalzsbeb/g,                 'checklist: URL/anon SEMPRE da FPMED'],
  ['telefone da Global',         /99612-?7968/g,                          'checklist: telefone (62) 3290-4241 / WhatsApp (62) 98147-9532'],
  ['e-mail hardcoded',           /isadora[a-z0-9._%+-]*@/gi,              'checklist: FPMED usa gate por ROLE, nunca e-mail cravado'],
  ['GitHub pessoal do Lemuel',   /lemuelbarros/gi,                        'deploy: a URL publica e fpmed-hospitalar/fpmed'],
  ['CNPJ da GlobalMed',          /2[0-9]\.\d{3}\.\d{3}\/0001-\d{2}/g,     'pre-condicao de deploy: so o CNPJ 47.110.418/0001-15 da FPMED'],
  ['verde da GlobalMed',         /#00c27a|#007a4d|#e6fff5/gi,             'checklist: paleta FPMED (#2CA9E0 / #173A5E / #8DC63F)'],
  ['navy do rebrand DARK',       /#0A141C|#10212C|#3AB6CE/gi,             'BLOCO 5 do SYNC_GLOBAL.md: a Global foi pro escuro, a FPMED e clara'],
  ['escuro da giovana da Global',/#0d1b2a|#1e3048|#29b8ff/gi,             'BLOCO 5: nao adotar a casca escura da tela de Propostas'],
  ['modelo de IA caro',          /claude-(?:opus|sonnet)-[\w.-]+/gi,      'decisao de custo 22/07: o ler-pedido da FPMED usa claude-haiku-4-5'],
  ['placeholder juridico',       /\[(?:RAZAO SOCIAL FPMED|CNPJ|ENDERECO|WHATSAPP)\]/g, 'pre-condicao de deploy: zero placeholder no ar'],
];

// ── EXIGIDO: se sumir, o porte apagou a FPMED ────────────────────────────────
// Vale por ARQUIVO — nem todo arquivo tem telefone. A chave e o nome do arquivo (ou '*').
// ATENCAO ao '*': os limedtec-*.js sao o MOLDE white-label e sao AGNOSTICOS DE MARCA POR DESENHO —
// a marca deles entra pelo cliente.config.js em runtime. Exigir "FPMED" neles inverteria a
// arquitetura (e o proximo cliente do molde nao passaria). Por isso ficam fora do '*'.
const SEM_MARCA_POR_DESENHO = /^limedtec-.*\.js$/;
const EXIGIDO = {
  '*':                        [['nome FPMED', /FPMED/]],
  'gm-auth.js':               [['Supabase da FPMED', /xzdowrksuswekwffoluk/]],
  'fpmed_sistema_final.html': [['Supabase da FPMED', /xzdowrksuswekwffoluk/], ['navy FPMED', /#173A5E/i], ['telefone FPMED', /3290-4241/]],
  'fpmed_giovana.html':       [['Supabase da FPMED', /xzdowrksuswekwffoluk/], ['navy FPMED', /#173A5E/i], ['telefone FPMED', /3290-4241/],
                               ['fallback do vendedor', /venda_unit_forn/]],
  'fpmed_vendas.html':        [['Supabase da FPMED', /xzdowrksuswekwffoluk/]],
  'fpmed_viabilidade.html':   [['Supabase da FPMED', /xzdowrksuswekwffoluk/]],
  'limedtec-config.js':       [['guarda data-tema (diverge do molde desde 05/08)', /data-tema/]],
};

// ── EXCECOES CONHECIDAS ──────────────────────────────────────────────────────
// Cada excecao precisa de MOTIVO escrito. Excecao sem motivo vira porta dos fundos em 3 meses.
const EXCECOES = [
  { arquivo: 'gm-auth.js', regra: 'marca GlobalMed', trecho: /gm-auth/,
    motivo: 'o NOME DO ARQUIVO gm-auth.js e legado do clone e e citado por 10 telas; renomear e outra tarefa' },
];

function ehExcecao(arquivo, regra, linha) {
  return EXCECOES.some(e => e.arquivo === arquivo && e.regra === regra && e.trecho.test(linha));
}

function confereTexto(nomeArq, txt) {
  const achados = [];
  const linhas = txt.split(/\r?\n/);
  for (const [regra, re, dica] of PROIBIDO) {
    linhas.forEach((l, i) => {
      re.lastIndex = 0;
      const m = l.match(re);
      if (!m) return;
      if (ehExcecao(nomeArq, regra, l)) return;
      achados.push({ tipo: 'proibido', arquivo: nomeArq, linha: i + 1, regra, dica,
                     amostra: l.trim().slice(0, 110), vezes: m.length });
    });
  }
  const exig = (SEM_MARCA_POR_DESENHO.test(nomeArq) ? [] : (EXIGIDO['*'] || []))
                 .concat(EXIGIDO[nomeArq] || []);
  for (const [nome, re] of exig) {
    if (!re.test(txt)) achados.push({ tipo: 'sumiu', arquivo: nomeArq, regra: nome,
      dica: 'estava no arquivo da FPMED e o porte tirou' });
  }
  return achados;
}

function main() {
  const argv = process.argv.slice(2);
  const soJson = argv.includes('--json');
  const iA = argv.indexOf('--arquivo');
  const iT = argv.indexOf('--texto');
  let alvos;
  if (iT >= 0) {                       // caminho avulso (previa de porte, fora da raiz)
    const p = argv[iT + 1];
    alvos = [[path.basename(p), fs.readFileSync(p, 'utf8')]];
  } else if (iA >= 0) {
    const n = argv[iA + 1];
    alvos = [[n, fs.readFileSync(path.join(RAIZ, n), 'utf8')]];
  } else {
    alvos = PUBLICADOS.filter(n => fs.existsSync(path.join(RAIZ, n)))
                      .map(n => [n, fs.readFileSync(path.join(RAIZ, n), 'utf8')]);
  }

  const achados = [];
  for (const [n, t] of alvos) achados.push(...confereTexto(n, t));

  if (soJson) { console.log(JSON.stringify({ arquivos: alvos.length, achados }, null, 2)); process.exitCode = achados.length ? 1 : 0; return; }

  console.log('══ VERIFICADOR DE REBRAND — GlobalMed x FPMED ══');
  console.log('   ' + alvos.length + ' arquivo(s) publicado(s) · ' + PROIBIDO.length + ' regras de proibicao\n');

  const proib = achados.filter(a => a.tipo === 'proibido');
  const sumiu = achados.filter(a => a.tipo === 'sumiu');

  if (!proib.length) console.log('   ✓ nada da GlobalMed nos arquivos publicados');
  else {
    console.log('   ✗ ' + proib.length + ' ocorrencia(s) da GlobalMed:\n');
    for (const a of proib) {
      console.log('     ' + a.arquivo + ':' + a.linha + '  [' + a.regra + ']');
      console.log('        ' + a.amostra);
      console.log('        -> ' + a.dica);
    }
  }
  console.log('');
  if (!sumiu.length) console.log('   ✓ tudo que e da FPMED continua nos arquivos');
  else {
    console.log('   ✗ ' + sumiu.length + ' marcador(es) da FPMED sumiram:\n');
    for (const a of sumiu) console.log('     ' + a.arquivo + '  [' + a.regra + '] -> ' + a.dica);
  }

  console.log('\n───────────────────────────────');
  console.log(achados.length ? '>>> ' + achados.length + ' PROBLEMA(S) — nao commitar assim.' : '>>> REBRAND LIMPO.');
  process.exitCode = achados.length ? 1 : 0;
}

if (require.main === module) main();
module.exports = { confereTexto, PROIBIDO, EXIGIDO, PUBLICADOS };
