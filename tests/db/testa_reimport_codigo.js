// Prova, contra o BANCO REAL (só leitura), que o próximo import do estoque casa as linhas
// existentes em vez de duplicá-las — que era o risco do código sem zero à esquerda.
// Simula o que a tela faz: egNormCod nos dois lados (relatório e banco) e conta os
// códigos do relatório que NÃO acham par no banco (esses virariam INSERT = duplicata).
//   node tests/db/testa_reimport_codigo.js
'use strict';
const fs = require('fs'), path = require('path');
const { lerEstoque } = require('../../tools/le_estoque_fpmed');

const RAIZ = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(RAIZ, 'fpmed_sistema_final.html'), 'utf8');
function fn(nome) {
  const m = new RegExp('(?:^|\\n)\\s*function\\s+' + nome + '\\s*\\(').exec(src);
  let i = src.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') n++;
    else if (src[j] === '}') { n--; if (!n) return src.slice(m.index, j + 1); }
  }
}
const { egNormCod } = (new Function(fn('egNormCod') + 'return { egNormCod };'))();

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const SR = seg.match(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };
const PLANILHA = 'C:/fpmed/Pasta1.xlsx';

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) { p++; console.log('  ok   ' + n); } else { f++; console.log('  FALHA ' + n + (got !== undefined ? ' [' + JSON.stringify(got) + ']' : '')); } };

(async () => {
  console.log('\n=== Reimport do estoque: casa ou duplica? (banco real, so leitura) ===\n');
  let banco = [], off = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/cotacoes?select=id,codigo&fornecedor=eq.1&limit=1000&offset=${off}`, { headers: H });
    const d = await r.json();
    if (!Array.isArray(d) || !d.length) break;
    banco = banco.concat(d); if (d.length < 1000) break; off += 1000;
  }
  const doRelatorio = lerEstoque(PLANILHA).linhas;

  // como a tela monta os dois lados
  const chavesBanco = new Set(banco.map(c => egNormCod(c.codigo)));
  const chavesRel = [...new Set(doRelatorio.map(x => egNormCod(x.codigo)))];
  const semPar = chavesRel.filter(k => !chavesBanco.has(k));

  console.log(`  banco: ${banco.length} linhas · ${chavesBanco.size} chaves`);
  console.log(`  relatorio: ${doRelatorio.length} linhas · ${chavesRel.length} chaves\n`);

  ok(`todo codigo do relatorio acha par no banco (0 INSERT = 0 duplicata)`,
     semPar.length === 0, semPar.slice(0, 8));
  ok('o banco guarda o codigo COM zero (formato do ERP)',
     banco.every(c => /^\d{7}$/.test(String(c.codigo))),
     banco.filter(c => !/^\d{7}$/.test(String(c.codigo))).slice(0, 5).map(c => c.codigo));
  ok('a chave de comparacao continua SEM zero (simetrica)',
     egNormCod('0000010') === '10' && egNormCod('10') === '10');
  ok('nenhuma chave do banco colide com duas grafias',
     chavesBanco.size === new Set(banco.map(c => egNormCod(c.codigo))).size);

  console.log(`\n${p} ok, ${f} falha(s)`);
  console.log(f ? '>>> VERMELHO' : '>>> TUDO VERDE');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
