// SUITE testa_rebrand — o verificador de rebrand (tools/confere_rebrand.js) funciona MESMO?
//
// POR QUE ESTA SUITE EXISTE: um verificador que so responde "limpo" e pior que nao ter
// verificador — ele da uma sensacao de cobertura que nao existe. Entao aqui se testa nas DUAS
// direcoes: (1) ele PEGA cada marcador proibido quando eu planto um de proposito; (2) ele NAO
// pega o que e legitimo (o DADO 'GLOBAL', que e fornecedor proprio e tem que ficar).
//
// O caso 2 e o que importa de verdade: se a regra fosse /GLOBAL/ em vez de /GlobalMed/, o
// verificador acusaria estoque proprio como vazamento de marca e alguem "consertaria" o dado.
//
//   node tests/testa_rebrand.js
const path = require('path');
const fs = require('fs');
const { confereTexto, PROIBIDO, PUBLICADOS } = require(path.join(__dirname, '..', 'tools', 'confere_rebrand.js'));

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? ' [got ' + JSON.stringify(got) + ']' : '')); } };
console.log('SUITE testa_rebrand — o verificador de rebrand\n');

// base limpa: um "arquivo" que satisfaz o exigido generico
const LIMPO = 'FPMED Hospitalar — sistema interno\n';
const achou = (txt, regra, arq) => confereTexto(arq || 'fpmed_teste.html', txt)
  .some(a => a.tipo === 'proibido' && a.regra === regra);

// ── 1. RED TESTS: cada regra proibida tem que ser pega ──────────────────────
ok('pega a marca GlobalMed',        achou(LIMPO + '<title>GlobalMed - Sistema</title>', 'marca GlobalMed'));
ok('pega GLOBALMED em caixa alta',  achou(LIMPO + 'logo GLOBALMED aqui', 'marca GlobalMed'));
ok('pega o Supabase da Global',     achou(LIMPO + 'https://vikewlbhkrikcalzsbeb.supabase.co', 'Supabase da Global'));
ok('pega o telefone da Global',     achou(LIMPO + 'fone (62) 99612-7968', 'telefone da Global'));
ok('pega e-mail hardcoded',        achou(LIMPO + "if(u==='isadora.vendas@globo.com')", 'e-mail hardcoded'));
ok('pega o GitHub pessoal',         achou(LIMPO + 'https://lemuelbarros.github.io/x', 'GitHub pessoal do Lemuel'));
ok('pega o verde da GlobalMed',     achou(LIMPO + '.btn{background:#00c27a}', 'verde da GlobalMed'));
ok('pega o navy do rebrand DARK',   achou(LIMPO + '.side{background:#0A141C}', 'navy do rebrand DARK'));
ok('pega o escuro da giovana',      achou(LIMPO + '.tit{background:#0d1b2a}', 'escuro da giovana da Global'));
ok('pega modelo de IA caro',        achou(LIMPO + 'model: "claude-opus-4-20250514"', 'modelo de IA caro'));
ok('pega placeholder juridico',     achou(LIMPO + 'CNPJ: [CNPJ]', 'placeholder juridico'));

// toda regra da lista tem red test? (trava a suite envelhecer calada quando alguem add regra)
ok('toda regra PROIBIDO tem red test nesta suite',
   PROIBIDO.length === 11, PROIBIDO.length);

// ── 2. O QUE NAO PODE SER PEGO: o DADO 'GLOBAL' e legitimo ─────────────────
// Regra master do projeto: a MARCA sai, o DADO fica (fornecedor='1', tipo='global', estoque proprio).
const dado = LIMPO + [
  "if (c.tipo === 'global') return 'estoque proprio';",
  "const GLOBAL = linhas.filter(l => l.fornecedor === '1');",
  '<option value="GLOBAL">Só Estoque FPMED</option>',
  "nomeForn('GLOBAL')",
].join('\n');
ok('NAO acusa tipo=global (dado)',       !achou(dado, 'marca GlobalMed'), confereTexto('x.html', dado));
ok('NAO acusa a palavra GLOBAL sozinha', confereTexto('fpmed_teste.html', dado).filter(a => a.tipo === 'proibido').length === 0);

// e as cores da FPMED nao podem disparar nada
const paleta = LIMPO + ':root{--verde:#2CA9E0;--navy:#173A5E;--fverde:#8DC63F;}';
ok('NAO acusa a paleta da FPMED', confereTexto('fpmed_teste.html', paleta).filter(a => a.tipo === 'proibido').length === 0);
// nem o tema escuro PROPRIO da tela de Licitacoes (paleta da FPMED, nao da Global)
const escuroProprio = LIMPO + ':root{--bg:#0B1622;--topo:#08111B;--header:#132234;}';
ok('NAO acusa o escuro PROPRIO do Licitacoes',
   confereTexto('fpmed_licitacoes.html', escuroProprio).filter(a => a.tipo === 'proibido').length === 0);
// e o modelo que a FPMED usa de proposito
ok('NAO acusa o claude-haiku-4-5 (o modelo da FPMED)',
   !achou(LIMPO + 'model: "claude-haiku-4-5"', 'modelo de IA caro'));

// ── 3. A OUTRA DIRECAO: o porte APAGOU algo da FPMED ───────────────────────
const semFpmed = 'sistema interno, sem marca nenhuma';
ok('acusa quando o nome FPMED some',
   confereTexto('fpmed_teste.html', semFpmed).some(a => a.tipo === 'sumiu' && a.regra === 'nome FPMED'));
ok('acusa quando o Supabase da FPMED some do gm-auth',
   confereTexto('gm-auth.js', LIMPO).some(a => a.tipo === 'sumiu' && a.regra === 'Supabase da FPMED'));
ok('acusa quando o venda_unit_forn some da giovana (vendedor perde preco)',
   confereTexto('fpmed_giovana.html', LIMPO + 'xzdowrksuswekwffoluk #173A5E 3290-4241')
     .some(a => a.tipo === 'sumiu' && a.regra === 'fallback do vendedor'));
ok('acusa quando a guarda data-tema some do limedtec-config',
   confereTexto('limedtec-config.js', 'var CFG = {};')
     .some(a => a.tipo === 'sumiu' && a.regra === 'guarda data-tema (diverge do molde desde 05/08)'));

// ── 4. O MOLDE e agnostico de marca DE PROPOSITO ───────────────────────────
ok('limedtec-*.js NAO precisa citar FPMED (a marca vem do config)',
   !confereTexto('limedtec-pwa.js', 'function instalar(){}').some(a => a.tipo === 'sumiu' && a.regra === 'nome FPMED'));
ok('mas limedtec-*.js ainda e conferido contra o proibido',
   achou('function x(){ /* GlobalMed */ }', 'marca GlobalMed', 'limedtec-pwa.js'));

// ── 5. EXCECAO com motivo: gm-auth.js cita o proprio nome ──────────────────
ok('a excecao do gm-auth vale so pro gm-auth',
   !achou(LIMPO + '<script src="gm-auth.js"></script>', 'marca GlobalMed', 'gm-auth.js'));

// ── 6. ESTADO REAL: os arquivos publicados hoje estao limpos ───────────────
const RAIZ = path.join(__dirname, '..');
let sujos = 0, conferidos = 0;
for (const n of PUBLICADOS) {
  const fp = path.join(RAIZ, n);
  if (!fs.existsSync(fp)) continue;
  conferidos++;
  const a = confereTexto(n, fs.readFileSync(fp, 'utf8'));
  if (a.length) { sujos++; a.forEach(x => console.log('    >> ' + n + ' ' + x.tipo + ': ' + x.regra)); }
}
ok('os ' + conferidos + ' arquivos publicados estao com o rebrand limpo', sujos === 0, sujos);
ok('esta conferindo o sistema_final, a giovana e o gm-auth de verdade', conferidos >= 15, conferidos);

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
