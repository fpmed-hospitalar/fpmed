// SUITE testa_codigo_erp — o código do ERP tem 7 dígitos com zeros à esquerda (0000010).
// Extrai as funções REAIS do fpmed_sistema_final.html (egNormCod/egCodGravar) e do
// tools/le_estoque_fpmed.js (normCodigo).
//
// NASCEU DE UM BUG REAL (04/08/2026): o import gravou 1.381 códigos truncados (0000010 -> 10)
// porque o que ia pro banco era a chave de comparação (sem zero), não o código do ERP.
// O que estes asserts travam:
//   1) o que GRAVA preserva/repõe os 7 dígitos;
//   2) o que COMPARA continua tirando zeros — e simétrico, senão a transição duplicaria;
//   3) linha antiga ("10") e linha nova ("0000010") casam na MESMA chave.
//   node tests/testa_codigo_erp.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');
function fn(nome) {
  const m = new RegExp('(?:^|\\n)\\s*function\\s+' + nome + '\\s*\\(').exec(src);
  if (!m) throw new Error('nao achei ' + nome);
  let i = src.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') n++;
    else if (src[j] === '}') { n--; if (!n) return src.slice(m.index, j + 1); }
  }
  throw new Error('chave nao fechou: ' + nome);
}
const { egNormCod, egCodGravar } = (new Function(fn('egNormCod') + fn('egCodGravar') +
  'return { egNormCod, egCodGravar };'))();
const { normCodigo } = require('../tools/le_estoque_fpmed');

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? ' [got ' + JSON.stringify(got) + ']' : '')); } };
console.log('SUITE testa_codigo_erp — codigo do ERP com zeros a esquerda\n');

// --- 1) GRAVAÇÃO: repõe os 7 dígitos ---
ok('gravar 10 -> 0000010', egCodGravar('10') === '0000010', egCodGravar('10'));
ok('gravar 9 -> 0000009', egCodGravar('9') === '0000009', egCodGravar('9'));
ok('gravar 103993 -> 0103993', egCodGravar('103993') === '0103993', egCodGravar('103993'));
ok('gravar ja padded nao muda', egCodGravar('0020001') === '0020001', egCodGravar('0020001'));
ok('gravar 8 digitos passa intacto', egCodGravar('12345678') === '12345678', egCodGravar('12345678'));
ok('gravar nao-numerico passa intacto', egCodGravar('AB-12') === 'AB-12', egCodGravar('AB-12'));
ok('gravar vazio = vazio', egCodGravar('') === '', egCodGravar(''));
ok('gravar null nao quebra', egCodGravar(null) === '', egCodGravar(null));

// --- 2) COMPARAÇÃO: continua tirando zeros ---
ok('comparar 0000010 -> 10', egNormCod('0000010') === '10', egNormCod('0000010'));
ok('comparar 10 -> 10', egNormCod('10') === '10', egNormCod('10'));
ok('comparar 0000000 -> 0 (nao vira vazio)', egNormCod('0000000') === '0', egNormCod('0000000'));

// --- 3) O QUE IMPORTA: velho e novo casam na mesma chave (transição sem duplicar) ---
ok('linha ANTIGA (10) e NOVA (0000010) na mesma chave',
   egNormCod('10') === egNormCod(egCodGravar('10')), [egNormCod('10'), egNormCod(egCodGravar('10'))]);
ok('linha ja corrigida no banco casa com o relatorio',
   egNormCod('0000010') === egNormCod('10'));
ok('idempotente: gravar duas vezes nao muda',
   egCodGravar(egCodGravar('10')) === egCodGravar('10'), egCodGravar(egCodGravar('10')));

// --- 4) o leitor de xlsx faz o MESMO que a tela (as duas portas de entrada) ---
for (const c of ['10', '9', '103993', '0020001', '12345678', 'AB-12']) {
  ok('leitor xlsx == tela para ' + c, normCodigo(c) === egCodGravar(c), [normCodigo(c), egCodGravar(c)]);
}
// o xlsx entrega celula numerica: 10 (number) tem que virar '0000010' igual
ok('leitor trata celula NUMERICA (10 number)', normCodigo(10) === '0000010', normCodigo(10));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
