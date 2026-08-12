// ============================================================================
// prova_alarme_email.js — o alarme da coleta chega por e-mail? (prova SEM ENVIAR)
//
// >>> POR QUE ELA EXISTE, E POR QUE NAO MANDA E-MAIL NENHUM.
// A suite prova a LOGICA (contra o arquivo) e ate executa o motor colado. O que
// ela nao alcanca e o que so a funcao NO AR sabe: o motor subiu junto? o veredito
// que o servidor calcula agora e o mesmo que eu calculo aqui? o carimbo da trava
// de repeticao esta onde deveria?
// Tudo isso a sonda `{"conferir": true}` responde SEM EFEITO — sem ler jornal,
// sem montar e-mail e sem chamar o provedor. Alarme que so da pra conferir
// disparando e alarme que ninguem confere.
//
// >>> O QUE ELA **NAO** PROVA, e esta escrito na saida: que o e-mail chega na
//     caixa. Isso poe uma mensagem de verdade no e-mail do dono e depende de
//     autorizacao dele — do mesmo jeito que a prova da trava de remetente
//     dependeu em 11/08.
//
//   node tools/prova_alarme_email.js
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const ALARME = require(path.join(__dirname, '..', 'fpmed_alarme_coleta.js'));

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const URL = (seg.match(/https:\/\/[a-z]{20}\.supabase\.co/) || [])[0];
const leSegredo = (c) => (seg.match(new RegExp('^\\s*' + c + '\\s*[:=]\\s*(\\S+)\\s*$', 'im')) || [])[1];

let ok = 0, falha = 0;
const diz = (bom, t, d) => { console.log('  ' + (bom ? '[ok]   ' : '[FALHA]') + ' ' + t + (d ? '   ' + d : '')); bom ? ok++ : falha++; };

(async () => {
  const TOKEN = leSegredo('BOLETIM_TOKEN');
  if (!TOKEN) { console.error('BOLETIM_TOKEN nao esta no segredos.local.txt'); process.exit(1); }

  console.log('=== A SONDA DA FUNCAO NO AR (nao envia nada) ===');
  const r = await fetch(URL + '/functions/v1/enviar-boletim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-boletim-token': TOKEN },
    body: JSON.stringify({ conferir: true }),
  });
  const j = await r.json().catch(() => ({}));
  console.log(JSON.stringify(j, null, 2));

  diz(r.status === 200, 'a sonda respondeu 200', 'HTTP ' + r.status);

  // 1. O MOTOR SUBIU? Deploy por outro caminho (sem a diretiva @inline) subiria a funcao SEM o
  //    alarme, e ela seguiria mandando boletim como sempre. O dono continuaria confiando num
  //    aviso que deixou de existir — a cicatriz de novo, agora com a nossa assinatura.
  diz(j.motor_alarme === true, '*** o motor do alarme subiu junto com a funcao (@inline) ***',
    'motor_alarme=' + j.motor_alarme);

  // 2. O SERVIDOR E EU CONCORDAMOS? Este e o assert que a suite nao consegue dar: ela roda a
  //    minha copia contra dado de mentira. Aqui e o veredito do SERVIDOR, sobre o banco de
  //    verdade, comparado com o que a mesma regra diz aqui do lado de fora.
  if (j.coleta) {
    const meu = ALARME.avaliar({ ...j.coleta }, new Date());
    const dele = j.alarme && typeof j.alarme === 'object' ? j.alarme : null;
    const iguais = (meu === null && dele === null)
      || (!!meu && !!dele && meu.nivel === dele.nivel && meu.titulo === dele.titulo);
    diz(iguais, '*** o veredito do SERVIDOR e o meu batem (uma regra so, dois lugares) ***',
      'servidor: ' + (dele ? dele.titulo : 'em dia') + '  |  aqui: ' + (meu ? meu.titulo : 'em dia'));
    console.log('    estado da coleta agora: ultimo_dia_ok=' + j.coleta.ultimo_dia_ok
      + '  ultima_tentativa=' + String(j.coleta.ultima_tentativa || '').slice(0, 16));
  } else diz(false, 'a sonda devolveu o estado da coleta', 'veio vazio');

  // 3. A TRAVA DE COMPLIANCE CONTINUA DE PE — o alarme sai pelo mesmo remetente do boletim.
  diz(j.proibido === false, 'o remetente segue liberado (nao e dominio da GlobalMed)',
    'dominio: ' + j.remetente_dominio);

  // 4. O CARIMBO DA TRAVA DE REPETICAO existe como campo (mesmo que ainda nulo).
  diz('alarme_ultimo_email' in j, 'a trava de repeticao esta observavel na sonda',
    'ultimo e-mail de alarme: ' + (j.alarme_ultimo_email || '(nenhum ainda)'));

  console.log('\n=== O QUE ISTO PROVA, E O QUE NAO PROVA ===');
  console.log('  PROVA: a funcao NO AR carrega o mesmo motor do sino, concorda com ele sobre o');
  console.log('         banco de verdade, e a trava de remetente segue na frente do envio.');
  console.log('  NAO PROVA: que o e-mail CHEGA na caixa. Isso poe uma mensagem de verdade no');
  console.log('         e-mail do dono e precisa da autorizacao dele — como foi com a prova da');
  console.log('         trava de remetente em 11/08.');
  if (j.alarme === null) {
    console.log('  E HOJE NAO HA O QUE DISPARAR: a coleta esta em dia, entao nenhum e-mail sairia');
    console.log('         nem se eu chamasse a funcao inteira. Isso e o alarme funcionando.');
  }

  console.log('\n' + '='.repeat(70));
  console.log('RESULTADO: ' + ok + ' ok, ' + falha + ' falha(s)');
  console.log('='.repeat(70));
  if (falha) process.exitCode = 1;
})();
