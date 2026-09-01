// le_backup.js — LER DE VOLTA UM BACKUP QUE NÃO CABE NA MEMÓRIA.
//
// 01/09/2026 (A49). Companheiro obrigatório da correção do backup_tabelas.js, e ele existe
// por um susto que só apareceu porque fui conferir o próprio conserto.
//
// A A49 consertou a GRAVAÇÃO: a licitacao_itens (428.658 linhas, 845,8 MB) passou a ser
// escrita em streaming e entrou no backup pela primeira vez. Aí tentei ler o arquivo de volta
// com require() para provar que estava íntegro, e levei o mesmo erro do outro lado:
//
//     Error: Cannot create a string longer than 0x1fffffe8 characters  (ERR_STRING_TOO_LONG)
//
// >>> O TETO DO V8 MORDE NAS DUAS PONTAS. fs.readFileSync e JSON.parse precisam do arquivo
//     INTEIRO numa string, e o limite é ~536 MB. O arquivo tem 846 MB. Ou seja: o backup
//     estava no disco, íntegro e completo — e mesmo assim NÃO SE ABRIA pelo caminho normal.
//
// Backup que não se lê não é backup: é a mesma armadilha de 06/08 (backup verde pela metade)
// com outra roupa. Ela só apareceria no DIA DA RESTAURAÇÃO, que é o pior dia possível.
//
// Este leitor varre o arquivo em pedaços de 4 MB e devolve um objeto por vez, sem nunca
// materializar o array inteiro. Não usa JSON.parse no arquivo todo — só em cada objeto,
// que é pequeno.
//
//   node tools/le_backup.js <arquivo.json>            conta e valida
//   node tools/le_backup.js <arquivo.json> 3          idem, e mostra os 3 primeiros
'use strict';
const fs = require('fs');

// Percorre um arquivo que contém UM array JSON de objetos e chama cb(obj) para cada um.
// Respeita aspas e escape: uma chave dentro de string não conta como profundidade.
function porObjeto(arquivo, cb) {
  const fd = fs.openSync(arquivo, 'r');
  const TAM = 4 * 1024 * 1024;
  const buf = Buffer.allocUnsafe(TAM);
  let resto = '', prof = 0, dentro = false, escapado = false, atual = '', n = 0;
  try {
    let lidos;
    while ((lidos = fs.readSync(fd, buf, 0, TAM, null)) > 0) {
      // corta no limite de caractere: guarda o pedaço final incompleto para o próximo laço
      const texto = resto + buf.toString('utf8', 0, lidos);
      resto = '';
      for (const ch of texto) {
        if (prof > 0) atual += ch;
        if (dentro) {
          if (escapado) escapado = false;
          else if (ch === '\\') escapado = true;
          else if (ch === '"') dentro = false;
          continue;
        }
        if (ch === '"') { dentro = true; continue; }
        if (ch === '{') { if (prof === 0) atual = '{'; prof++; }
        else if (ch === '}') {
          prof--;
          if (prof === 0) { cb(JSON.parse(atual), n++); atual = ''; }
        }
      }
    }
  } finally { fs.closeSync(fd); }
  return n;
}

if (require.main === module) {
  const arquivo = process.argv[2];
  const mostrar = parseInt(process.argv[3] || '0', 10);
  if (!arquivo) { console.error('uso: node tools/le_backup.js <arquivo.json> [quantos mostrar]'); process.exit(1); }
  if (!fs.existsSync(arquivo)) { console.error('não existe: ' + arquivo); process.exit(1); }

  const mb = (fs.statSync(arquivo).size / 1048576).toFixed(1);
  console.log(`\nlendo ${arquivo}  (${mb} MB)\n`);
  const t0 = Date.now();
  let chaves = null;
  const n = porObjeto(arquivo, (obj, i) => {
    if (i === 0) chaves = Object.keys(obj);
    if (i < mostrar) console.log('  [' + i + '] ' + JSON.stringify(obj).slice(0, 160));
  });
  console.log(`\nOBJETOS LIDOS: ${n}`);
  console.log(`colunas do 1º: ${chaves ? chaves.length : 0}${chaves ? ' (' + chaves.slice(0, 6).join(', ') + '…)' : ''}`);
  console.log(`tempo: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('\nSe este número bate com o _resumo.json, o backup está íntegro E legível.');
}

module.exports = { porObjeto };
