// ============================================================================
// prova_automacoes_vivas.js — a coleta e o boletim continuam rodando?
//
// >>> POR QUE ESTA PROVA NÃO OLHA O GITHUB. Com o repositório privado,
// /actions/runs some da API pública — precisaria de token. Mas olhar o GitHub
// provaria só que o WORKFLOW EXECUTOU, e não é isso que interessa: workflow que
// roda e não grava nada é workflow que falhou por dentro, com check verde.
//
// Esta prova olha o RESULTADO no banco: o que a coleta gravou e o que o boletim
// carimbou. É a mesma doutrina da lição S2 — medir pelo caminho de quem usa, e
// não pelo caminho que é mais fácil de medir.
//
// ══ O VERMELHO FALSO QUE ESTA FERRAMENTA DEU DURANTE DIAS (corrigido 12/08) ═══
// Ela media `licitacoes_acompanhadas` e concluía "o índice não recebe licitação
// há 160 horas". DUAS TABELAS DISPUTAM O NOME "ÍNDICE", e ela olhava a errada:
//
//   `licitacoes` ................. É O ÍNDICE DA COLETA. É onde a edge function
//        grava, é o que a tela Encontrar consulta primeiro e é de onde o boletim
//        tira as novidades. Medido em 12/08: 3.197 linhas, coletado_em de hoje.
//   `licitacoes_acompanhadas` .... é o HISTÓRICO PRÓPRIO DE PARTICIPAÇÃO (a
//        semente do Calendário 2025). Ela está parada em 06/08 porque ninguém
//        acompanhou certame novo desde então — e isso NÃO é defeito de coleta.
//
// >>> O PREÇO DISSO NÃO FOI SÓ UM [FALHA] FEIO: o diagnóstico "A COLETA ESTÁ
//     FALHANDO HÁ ~6 DIAS" foi escrito no CONTINUAR_AQUI a partir deste número.
//     A coleta estava rodando; quem estava errado era o instrumento. Medir a
//     coisa errada com precisão é pior que não medir — vira certeza.
//
// ══ E O VEREDITO AGORA SAI DO MESMO MOTOR DO SINO ════════════════════════════
// A pergunta "isto é alarme?" tem UMA resposta, em `fpmed_alarme_coleta.js`, e
// três leitores: o sino do Negócios, o e-mail do dono e esta prova. Antes daqui
// eu tinha um limiar próprio ("30h sem linha nova"), que é uma SEGUNDA regra —
// e ela acusaria todo domingo, quando não há publicação pra coletar.
//
//   node tools/prova_automacoes_vivas.js
// ============================================================================
'use strict';
const fs = require('fs');
const ALARME = require('../fpmed_alarme_coleta.js');

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const URL = (seg.match(/https:\/\/[a-z]{20}\.supabase\.co/) || [])[0];
const chaves = seg.match(/eyJ[\w.\-]{100,}/g) || [];

const agora = new Date();
/* Campo pode vir nulo, vir só a data (`2026-08-11`) ou vir um texto que não é
   data nenhuma. As três coisas têm que sair legíveis: a primeira versão disto
   estourou com "Invalid time value" no meio da medição e derrubou a prova —
   ferramenta de diagnóstico que morre no primeiro campo estranho não diagnostica. */
const dt = (d) => { if (!d) return null; const x = new Date(d); return isNaN(x) ? null : x; };
const horas = (d) => { const x = dt(d); return x ? Math.round((agora - x) / 36e5 * 10) / 10 : null; };
const quando = (d) => { const x = dt(d); return x ? x.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
  : (d ? String(d) + ' (nao e data)' : '(nunca)'); };

(async () => {
  let SR = null;
  for (const k of chaves) {
    const r = await fetch(URL + '/rest/v1/perfis?select=id&limit=1',
      { headers: { apikey: k, Authorization: 'Bearer ' + k } }).catch(() => null);
    if (r && r.ok) { SR = k; break; }
  }
  if (!SR) { console.error('nao consegui ler o banco'); process.exit(1); }
  const H = { apikey: SR, Authorization: 'Bearer ' + SR };
  const get = (q) => fetch(URL + '/rest/v1/' + q, { headers: H }).then(r => r.ok ? r.json() : null).catch(() => null);

  let ok = 0, falha = 0;
  const diz = (bom, t, d) => { console.log('  ' + (bom ? '[ok]   ' : '[FALHA]') + ' ' + t + (d ? '   ' + d : '')); bom ? ok++ : falha++; };

  console.log('=== A COLETA DO PNCP (cron 09/15/21 UTC) ===');
  const st = await get('coleta_status?select=*');
  if (st && st[0]) {
    const s = st[0];
    const campos = Object.keys(s).filter(k => /data|hora|ultim|_ok|_em$/i.test(k));
    for (const c of campos) console.log('    ' + c.padEnd(22) + quando(s[c]) + (horas(s[c]) !== null ? '   (' + horas(s[c]) + 'h atras)' : ''));

    /* O VEREDITO VEM DO MOTOR DO SINO, e não de um limiar escrito aqui. Ver o
       cabeçalho: dois limiares para a mesma pergunta divergem, e o daqui já
       divergia — ele acusava "carimbo velho" onde a regra de lá tolera a janela
       normal de 6h. Quem manda é `fpmed_alarme_coleta.js`. */
    const v = ALARME.avaliar(s, agora);
    diz(v === null, 'o motor do alarme (o MESMO do sino) diz que a coleta esta em dia',
      v ? v.titulo + ' — ' + v.detalhe : 'sem alarme');
  } else diz(false, 'li a coleta_status', 'nao voltou linha');

  /* ══ AS DUAS TABELAS, COM O NOME DE CADA UMA DITO ═══════════════════════════
     Elas já foram confundidas uma vez e o custo foi um diagnóstico inteiro
     errado (ver cabeçalho). Aqui as duas aparecem SEMPRE, lado a lado, com o
     que cada uma é — quem lê a saída não precisa lembrar a diferença. */
  const contar = async (tab) => {
    const r = await fetch(URL + '/rest/v1/' + tab + '?select=id&limit=1',
      { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } }).catch(() => null);
    return r ? (r.headers.get('content-range') || '').split('/')[1] : '?';
  };

  // O ÍNDICE DA COLETA — carimbo é intenção, linha nova é resultado.
  const lic = await get('licitacoes?select=coletado_em&order=coletado_em.desc&limit=1');
  const pub = await get('licitacoes?select=data_publicacao&order=data_publicacao.desc&limit=1');
  console.log('    `licitacoes` (O INDICE DA COLETA — a tela Encontrar le daqui)');
  console.log('        linhas ................ ' + await contar('licitacoes'));
  if (lic && lic[0]) console.log('        coletado por ultimo ... ' + quando(lic[0].coletado_em)
    + '   (' + horas(lic[0].coletado_em) + 'h atras)');
  if (pub && pub[0]) console.log('        publicacao mais nova .. ' + String(pub[0].data_publicacao));

  // A OUTRA — mostrada de propósito, pra ninguém achar que ela é a coleta.
  const ac = await get('licitacoes_acompanhadas?select=criado_em&order=criado_em.desc&limit=1');
  console.log('    `licitacoes_acompanhadas` (HISTORICO DE PARTICIPACAO — NAO e a coleta)');
  console.log('        linhas ................ ' + await contar('licitacoes_acompanhadas'));
  if (ac && ac[0]) console.log('        acompanhado por ultimo  ' + quando(ac[0].criado_em)
    + '   (parada aqui e normal: so cresce quando alguem acompanha certame novo)');

  console.log('\n=== O BOLETIM (cron 08:17 UTC) ===');
  const j = await get('jornais?select=*');
  if (j && j[0]) {
    for (const jj of j) {
      const env = jj.ultimo_envio || jj.enviado_em || null;
      console.log('    jornal "' + (jj.nome || '?') + '"  enviar_email=' + jj.enviar_email
        + '  ultimo envio: ' + quando(env) + (horas(env) !== null ? '   (' + horas(env) + 'h atras)' : ''));
      diz(horas(env) !== null && horas(env) <= 30,
        'o boletim carimbou envio nas ultimas 30h (o cron e diario)',
        horas(env) === null ? 'nunca carimbou' : horas(env) + 'h');
    }
  } else diz(false, 'li os jornais', 'nao voltou linha');

  console.log('\n=== O QUE ISSO PROVA, E O QUE NAO PROVA ===');
  console.log('  PROVA: a automacao continua produzindo RESULTADO no banco com o repo privado.');
  console.log('  NAO PROVA: o consumo de minutos do Actions (precisa de token de billing),');
  console.log('             nem o site do Pages (esse se mede pela prova_pos_trancamento).');

  console.log('\n' + '='.repeat(70));
  console.log('RESULTADO: ' + ok + ' ok, ' + falha + ' falha(s)');
  console.log('='.repeat(70));
  if (falha) process.exitCode = 1;
})();
