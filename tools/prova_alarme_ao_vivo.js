// ============================================================================
// prova_alarme_ao_vivo.js — o alarme da coleta CHEGA MESMO na caixa do dono?
//
// >>> ESTA PROVA ESCREVE NO BANCO, E POR ISSO ELA EXISTE COMO ARQUIVO.
// A `prova_alarme_email` responde tudo que dá pra responder sem efeito: o motor
// subiu, o servidor concorda comigo, a trava de remetente está na frente. O que
// ela NÃO alcança é a única coisa que o dono realmente compra: **o e-mail chega,
// e o texto dele serve?**
// Pra isso é preciso um índice atrasado, e o índice está em dia — então a única
// forma é FINGIR o atraso por alguns segundos.
//
// ══ O QUE ELA TOCA, E O QUE ELA DEVOLVE ═════════════════════════════════════
// Toca DUAS colunas de UMA linha (`coleta_status` da fonte PNCP):
//   ultimo_dia_ok    -> recua alguns dias, pra acender o alarme
//   alarme_email_em  -> a própria função carimba ao enviar
// e devolve as duas EXATAMENTE como estavam, no `finally` — inclusive se a
// chamada falhar no meio.
//
// >>> O CARIMBO É O QUE MAIS IMPORTA DESFAZER, e é o que seria fácil esquecer:
//     ele é a trava de 20 h. Deixá-lo preenchido faria o alarme de VERDADE de
//     amanhã de manhã ser engolido em silêncio — a prova do alarme teria
//     desligado o alarme.
//
// AUTORIZAÇÃO: o Lemuel liberou este UPDATE temporário em 12/08/2026, nominal e
// só para este fim. Nenhum outro UPDATE está autorizado por esta liberação.
//
//   node tools/prova_alarme_ao_vivo.js --destino lemuelbarros@outlook.com
//   node tools/prova_alarme_ao_vivo.js --so-ver     (não escreve nada)
// ============================================================================
'use strict';
const fs = require('fs');

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const URL = (seg.match(/https:\/\/[a-z]{20}\.supabase\.co/) || [])[0];
const chaves = seg.match(/eyJ[\w.\-]{100,}/g) || [];
const leSegredo = (c) => (seg.match(new RegExp('^\\s*' + c + '\\s*[:=]\\s*(\\S+)\\s*$', 'im')) || [])[1];

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const DESTINO = arg('--destino');
const SO_VER = process.argv.includes('--so-ver');
const DIAS_ATRASO = 4;      // > DIAS_INDICE_VELHO (2), com folga

let ok = 0, falha = 0;
const diz = (bom, t, d) => { console.log('  ' + (bom ? '[ok]   ' : '[FALHA]') + ' ' + t + (d ? '   ' + d : '')); bom ? ok++ : falha++; };

(async () => {
  if (!DESTINO && !SO_VER) {
    console.error('faltou --destino <email>. Sem destino explicito eu nao mando e-mail nenhum.');
    process.exit(1);
  }
  const TOKEN = leSegredo('BOLETIM_TOKEN');
  if (!TOKEN) { console.error('BOLETIM_TOKEN nao esta no segredos.local.txt'); process.exit(1); }

  // service_role: e a unica chave que escreve na coleta_status (a RLS fecha pro resto)
  let SR = null;
  for (const k of chaves) {
    const r = await fetch(URL + '/rest/v1/coleta_status?select=fonte&limit=1',
      { headers: { apikey: k, Authorization: 'Bearer ' + k } }).catch(() => null);
    if (r && r.ok) { SR = k; break; }
  }
  if (!SR) { console.error('nao consegui ler o banco'); process.exit(1); }
  const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };
  const ler = async () => (await (await fetch(URL + '/rest/v1/coleta_status?fonte=eq.PNCP&select=*', { headers: H })).json())[0];
  const gravar = (campos) => fetch(URL + '/rest/v1/coleta_status?fonte=eq.PNCP', {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(campos) });

  const ANTES = await ler();
  console.log('=== O ESTADO DE AGORA (o que tem que voltar exatamente assim) ===');
  console.log('    ultimo_dia_ok ...... ' + JSON.stringify(ANTES.ultimo_dia_ok));
  console.log('    alarme_email_em .... ' + JSON.stringify(ANTES.alarme_email_em));
  console.log('    ultima_tentativa ... ' + JSON.stringify(ANTES.ultima_tentativa));
  if (SO_VER) { console.log('\n--so-ver: nao escrevi nada.'); return; }

  const fingido = new Date(Date.now() - DIAS_ATRASO * 864e5).toISOString().slice(0, 10);
  let resposta = null;

  try {
    console.log('\n=== 1. FINGINDO O INDICE ATRASADO (temporario) ===');
    const r1 = await gravar({ ultimo_dia_ok: fingido, alarme_email_em: null });
    diz(r1.ok, 'recuei o ultimo_dia_ok para ' + fingido + ' (' + DIAS_ATRASO + ' dias)', 'HTTP ' + r1.status);

    // conferir que o motor DAQUI ja enxerga o alarme — se nao enxergar, o teste nao vale
    const A = require('../fpmed_alarme_coleta.js');
    const v = A.avaliar(await ler(), new Date());
    diz(!!v && v.nivel === 'grave', 'o motor passou a acusar alarme grave', v ? v.titulo : 'nenhum');

    console.log('\n=== 2. CHAMANDO A FUNCAO DE VERDADE (ela vai mandar o e-mail) ===');
    const r2 = await fetch(URL + '/functions/v1/enviar-boletim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-boletim-token': TOKEN },
      body: JSON.stringify({ teste: DESTINO }),
    });
    resposta = await r2.json().catch(() => ({}));
    console.log(JSON.stringify(resposta, null, 2));

    diz(resposta.alarme && resposta.alarme.nivel === 'grave',
      '*** a funcao decidiu que era alarme (e nao mandou boletim) ***',
      resposta.alarme ? resposta.alarme.titulo : 'sem alarme na resposta');
    diz(resposta.alarmeEnviado === 1, '*** o e-mail SAIU, para 1 destinatario ***',
      'alarmeEnviado=' + resposta.alarmeEnviado
      + (resposta.alarmeFalhas && resposta.alarmeFalhas.length ? ' · falhas: ' + JSON.stringify(resposta.alarmeFalhas) : ''));
    diz(resposta.enviados === 0, 'e NENHUM boletim normal foi enviado junto', 'enviados=' + resposta.enviados);

    // a trava de repeticao: a 2a chamada seguida NAO pode mandar outro e-mail igual
    console.log('\n=== 3. A TRAVA DE REPETICAO (2a chamada, na sequencia) ===');
    const r3 = await fetch(URL + '/functions/v1/enviar-boletim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-boletim-token': TOKEN },
      body: JSON.stringify({ teste: DESTINO }),
    });
    const j3 = await r3.json().catch(() => ({}));
    diz(j3.alarmeEnviado === 0, '*** a 2a chamada NAO mandou outro e-mail igual ***',
      'alarmeEnviado=' + j3.alarmeEnviado + ' · ' + (j3.nota || ''));
  } finally {
    console.log('\n=== 4. DESFAZENDO (isto roda mesmo se algo acima falhar) ===');
    const r = await gravar({ ultimo_dia_ok: ANTES.ultimo_dia_ok, alarme_email_em: ANTES.alarme_email_em });
    const DEPOIS = await ler();
    diz(r.ok && DEPOIS.ultimo_dia_ok === ANTES.ultimo_dia_ok,
      '*** ultimo_dia_ok voltou ao original ***', JSON.stringify(DEPOIS.ultimo_dia_ok));
    diz(DEPOIS.alarme_email_em === ANTES.alarme_email_em,
      '*** o CARIMBO da trava voltou ao original (senao o alarme de amanha seria engolido) ***',
      JSON.stringify(DEPOIS.alarme_email_em));
    // o resto da linha nao podia ter sido tocado
    diz(DEPOIS.ultima_tentativa === ANTES.ultima_tentativa && DEPOIS.registros === ANTES.registros,
      'e o resto da linha nao foi tocado', 'ultima_tentativa e registros iguais');

    console.log('\n' + '='.repeat(70));
    console.log('RESULTADO: ' + ok + ' ok, ' + falha + ' falha(s)');
    console.log('='.repeat(70));
    if (resposta && resposta.alarmeEnviado === 1) {
      console.log('>>> CONFERIR NA CAIXA de ' + DESTINO + ': assunto comecando com');
      console.log('    "FPMED · [COLETA]". O corpo tem que dizer POR QUE o boletim nao veio.');
    }
    if (falha) process.exitCode = 1;
  }
})();
