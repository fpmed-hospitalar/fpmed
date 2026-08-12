// SUITE testa_alarme_coleta — O INDICE ESTA EM DIA, E O ALARME SO ACENDE QUANDO HA O QUE FAZER.
//
// A CICATRIZ: a Coleta PNCP falhou 12 vezes seguidas entre 07 e 10/08 e voltou sozinha ao verde.
// Ninguem soube. "Falha que se conserta sozinha some do olhar."
//
// >>> O QUE ESTA SUITE PROTEGE, E QUE E MAIS DIFICIL QUE "acender": o alarme NAO acender quando
//     o sistema esta saudavel. Alarme que grita todo dia nao e sensivel — e quebrado e ninguem
//     descobriu. O caso 1 abaixo e o estado REAL do banco em 12/08, com o sistema em ordem:
//     ultima_ok NULL e ultimo_erro "esgotou as tentativas". Se o alarme acender nele, ele nasce
//     morto.
//
//   node tests/testa_alarme_coleta.js
'use strict';
const path = require('path');
const A = require(path.join(__dirname, '..', 'fpmed_alarme_coleta.js'));

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) { p++; console.log('  ok  ' + n); } else { f++; console.log('  FALHA  ' + n + (e != null ? '  -> ' + JSON.stringify(e) : '')); } };
console.log('SUITE testa_alarme_coleta — so acende quando ha o que fazer\n');

const AGORA = new Date('2026-08-12T18:00:00Z');
const h = (n) => new Date(AGORA.getTime() - n * 36e5).toISOString();   // n horas atras
const d = (n) => new Date(Date.UTC(2026, 7, 12 - n)).toISOString().slice(0, 10);   // n dias atras

// ══ 1. O ESTADO REAL DE 12/08, COM O SISTEMA SAUDAVEL ═══════════════════════════════════════
// >>> ESTE E O ASSERT MAIS IMPORTANTE DA SUITE. Medido no banco: ultima_ok NULL, ultimo_erro
//     "esgotou as tentativas" (a cota do PNCP), e o indice em dia com 962 licitacoes de ontem.
//     Um alarme presos nesses dois campos estaria aceso AGORA, com tudo funcionando.
{
  const real = { fonte: 'PNCP', ultima_ok: null, ultima_tentativa: h(2),
                 ultimo_erro: 'esgotou as tentativas', ultimo_dia_ok: '2026-08-12',
                 registros: 0, parcial: false };
  ok('*** 1. o estado REAL de 12/08 (ultima_ok NULL + erro de cota, indice em dia) NAO alarma ***',
    A.avaliar(real, AGORA) === null, A.avaliar(real, AGORA));
}

// ══ 2. FONTE FORA DO AR NAO E ALARME NOSSO ══════════════════════════════════════════════════
// Decisao ja registrada no coleta-pncp.yml: "um X vermelho diario treina qualquer um a ignorar
// o CI". Enquanto o indice continuar novo, nao ha acao possivel de quem le.
{
  const pncpFora = { ultima_ok: null, ultima_tentativa: h(1), ultimo_erro: 'HTTP 503 no PNCP',
                     ultimo_dia_ok: d(1) };
  ok('*** 2. PNCP fora do ar, mas indice novo -> NAO alarma (o problema e dele, nao ha o que fazer) ***',
    A.avaliar(pncpFora, AGORA) === null, A.avaliar(pncpFora, AGORA));
}

// ══ 3. O DIA DE HOJE EM CURSO NAO CONTA ═════════════════════════════════════════════════════
// O dia corrente esta sendo varrido agora; cobrar dia incompleto acenderia o alarme toda manha.
{
  ok('3. ultimo_dia_ok = hoje -> em dia', A.avaliar({ ultima_tentativa: h(1), ultimo_dia_ok: d(0) }, AGORA) === null);
  ok('4. ultimo_dia_ok = ontem -> ainda em dia (1 dia de folga, a volta leva rodadas)',
    A.avaliar({ ultima_tentativa: h(1), ultimo_dia_ok: d(1) }, AGORA) === null);
}

// ══ 4. INDICE VELHO ACENDE ══════════════════════════════════════════════════════════════════
{
  const v = A.avaliar({ ultima_tentativa: h(1), ultimo_dia_ok: d(2) }, AGORA);
  ok('*** 5. dois dias de atraso -> ALARMA (e o limite decidido) ***', !!v && v.nivel === 'grave', v);
  ok('6. e diz o numero, nao so que "esta atrasado"', !!v && v.atraso === 2, v && v.atraso);
  ok('7. e diz a CONSEQUENCIA (licitacao nova pode nao estar na busca)',
    !!v && /pode n[aã]o estar na busca/.test(v.detalhe), v && v.detalhe);
  const v5 = A.avaliar({ ultima_tentativa: h(1), ultimo_dia_ok: d(5) }, AGORA);
  ok('8. cinco dias tambem alarma, com o numero certo', !!v5 && v5.atraso === 5, v5 && v5.atraso);
}

// ══ 5. "NEM TENTOU" — o caso que o carimbo de dia NAO pega ══════════════════════════════════
// >>> Com o agendador parado, `ultimo_dia_ok` fica CONGELADO num valor BOM. O indice parece em
//     dia porque ninguem esta olhando pra ele. Este e o apagao mais perigoso, e por isso vem
//     antes na ordem de avaliacao.
{
  const congelado = { ultima_tentativa: h(30), ultimo_dia_ok: d(0) };   // dia BOM, mas parado ha 30h
  const v = A.avaliar(congelado, AGORA);
  ok('*** 9. agendador parado ha 30h COM indice aparentemente em dia -> ALARMA ***',
    !!v && v.nivel === 'grave', v);
  ok('10. e o motivo dito e o certo (parou de rodar, nao "indice velho")',
    !!v && /parou de rodar/.test(v.titulo), v && v.titulo);
  ok('11. e diz ha quantas horas', !!v && v.horas === 30, v && v.horas);
}

// ══ 6. O LIMITE DE 12h NAO ALARMA NA JANELA NORMAL ══════════════════════════════════════════
// O cron roda de 6 em 6 h. Se o limite fosse 6, ele alarmaria em toda janela — o alarme viraria
// o barulho que ele existe pra evitar.
{
  ok('*** 12. 7h sem tentar (janela NORMAL de 6h + folga) nao alarma ***',
    A.avaliar({ ultima_tentativa: h(7), ultimo_dia_ok: d(0) }, AGORA) === null);
  ok('13. 11h ainda nao alarma (uma janela perdida e tolerada)',
    A.avaliar({ ultima_tentativa: h(11), ultimo_dia_ok: d(0) }, AGORA) === null);
  ok('*** 14. 12h alarma — DUAS janelas seguidas sem tentativa ***',
    (A.avaliar({ ultima_tentativa: h(12), ultimo_dia_ok: d(0) }, AGORA) || {}).nivel === 'grave');
}

// ══ 7. AUSENCIA E "NAO SEI", NUNCA "ESTA TUDO BEM" ══════════════════════════════════════════
{
  const v = A.avaliar(null, AGORA);
  ok('*** 15. sem linha nenhuma -> "nao sei" (nao silencio) ***', !!v && v.nivel === 'nao_sei', v);
  const s = A.avaliar({ ultimo_dia_ok: d(0) }, AGORA);   // sem ultima_tentativa
  ok('16. sem carimbo de tentativa -> alarma (nao passa por "deve estar tudo bem")',
    !!s && s.nivel === 'grave', s);
  const n = A.avaliar({ ultima_tentativa: h(1), ultimo_dia_ok: null }, AGORA);
  ok('17. sem dia fechado -> atencao, e diz o que falta', !!n && n.nivel === 'atencao', n);
}

// ══ 8. A MESMA FRASE NOS DOIS CANAIS ════════════════════════════════════════════════════════
// O sino e o e-mail leem a MESMA funcao: duas copias da regra diriam coisas diferentes sobre o
// mesmo banco, e a pessoa nao saberia em qual acreditar.
{
  const v = A.avaliar({ ultima_tentativa: h(40), ultimo_dia_ok: d(0) }, AGORA);
  ok('18. o resumo do grave e marcado, pra achar no assunto do e-mail', /^\[COLETA\]/.test(A.resumo(v)), A.resumo(v));
  ok('19. e em dia o resumo diz que esta em dia', A.resumo(null) === 'Coleta em dia', A.resumo(null));
}

// ══ 9. OS LIMITES SAO NOMEADOS, E NAO NUMEROS SOLTOS ════════════════════════════════════════
{
  ok('20. os dois limites tem nome e estao expostos (numero solto ninguem sabe se pode mudar)',
    A.DIAS_INDICE_VELHO === 2 && A.HORAS_SEM_TENTAR === 12, [A.DIAS_INDICE_VELHO, A.HORAS_SEM_TENTAR]);
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
