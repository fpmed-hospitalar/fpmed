/* ══════════════════════════════════════════════════════════════════════════════════════════════
   tools/projeta_retencao.js — "QUANTAS VOLTAS ATE A PASTA DE BACKUP BATER O TETO?"

   Fatia A51 (01/09/2026). O arquiteto pediu o numero, e a lapis a conta erra: a regra
   ("os 3 mais recentes + o ultimo de cada mes") interage com o calendario, e o resultado
   nao e linear. Entao esta ferramenta nao recalcula a regra — ela IMPORTA a regra de
   `tools/retencao_backup.js` e roda volta a volta. Reimplementar aqui seria criar a segunda
   versao da regra, que e exatamente o defeito que a A51 foi consertar.

   >>> ELA MORA EM tools/ E NAO EM _arquivo_de_medicao PORQUE A CATRACA A CITA. A
       `tests/testa_retencao_backup.js` diz "reproduza com esta ferramenta"; se ela fosse
       gitignorada, quem clonasse o repo leria uma instrucao apontando para o nada.

     node tools/projeta_retencao.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const { decide } = require('./retencao_backup.js');

const TETO = 4000;      // MB — o mesmo teto da catraca
const NOVO = 1089.7;    // MB por backup, medido no de 01/09/2026 (com a licitacao_itens dentro)

// O estado real de 01/09/2026, medido.
const peso = {
  'backup_2026-08-22_0944': 232.0,
  'backup_2026-08-30_0330': 240.6,
  'backup_2026-09-01_1559': 1089.7,
};
let pastas = Object.keys(peso);

const p2 = n => String(n).padStart(2, '0');
let d = new Date(2026, 8, 1);

console.log('volta | data       | pastas | MB       | teto ' + TETO);
console.log('------+------------+--------+----------+---------------------------');
const r0 = decide(pastas);
console.log('   0  | 2026-09-01 |   ' + String(r0.fica.length).padStart(2) +
            '   | ' + r0.fica.reduce((s, x) => s + peso[x.nome], 0).toFixed(1).padStart(8));

let estourou = null;
for (let v = 1; v <= 200; v++) {
  d = new Date(d.getTime() + 86400000);         // uma volta por dia — o ritmo medido do motor
  const nome = 'backup_' + d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + '_1200';
  peso[nome] = NOVO;
  pastas.push(nome);
  pastas = decide(pastas).fica.map(x => x.nome);
  const mb = pastas.reduce((s, n) => s + peso[n], 0);
  if (v <= 3 || v % 15 === 0 || (!estourou && mb > TETO)) {
    console.log(String(v).padStart(5) + ' | ' + nome.slice(7, 17) + ' |   ' +
      String(pastas.length).padStart(2) + '   | ' + mb.toFixed(1).padStart(8) +
      (mb > TETO ? '  <<< ESTOUROU' : ''));
  }
  if (!estourou && mb > TETO) estourou = { v, nome, mb, pastas: pastas.slice() };
}

console.log('');
if (estourou) {
  console.log('>>> O TETO ESTOURA NA VOLTA ' + estourou.v + ' (' + estourou.nome.slice(7, 17) + '), com ' +
    estourou.mb.toFixed(1) + ' MB em ' + estourou.pastas.length + ' pastas:');
  for (const n of estourou.pastas) console.log('      ' + n + '  ' + peso[n].toFixed(1) + ' MB');
  console.log('');
  console.log('>>> E NAO E O NUMERO DE VOLTAS QUE ESTOURA - E O NUMERO DE MESES.');
  console.log('    "3 recentes + o ultimo de cada mes" guarda UM backup POR MES, PARA SEMPRE.');
  console.log('    A ' + NOVO.toFixed(1) + ' MB cada, a pasta cresce ~1,09 GB por mes que passa,');
  console.log('    e nao estabiliza em nada. A causa nao e o teto estar baixo: e a regra nao ter teto.');
} else {
  console.log('>>> nao estourou em 200 voltas.');
}
