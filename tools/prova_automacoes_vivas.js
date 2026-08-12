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
//   node tools/prova_automacoes_vivas.js
// ============================================================================
'use strict';
const fs = require('fs');

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
    const marcos = campos.map(c => s[c]).filter(Boolean).map(d => new Date(d)).sort((a, b) => b - a);
    const maisNovo = marcos[0];
    diz(!!maisNovo && horas(maisNovo) <= 14,
      'a coleta gravou nas ultimas 14h (o intervalo entre duas rodadas do cron e 6h)',
      maisNovo ? horas(maisNovo) + 'h atras' : 'sem carimbo');
  } else diz(false, 'li a coleta_status', 'nao voltou linha');

  // O que ela TROUXE: carimbo é intenção, linha nova é resultado.
  const lic = await get('licitacoes_acompanhadas?select=criado_em&order=criado_em.desc&limit=1');
  if (lic && lic[0]) {
    const h = horas(lic[0].criado_em);
    console.log('    licitacao mais recente no indice: ' + quando(lic[0].criado_em) + '   (' + h + 'h atras)');
    diz(h <= 30, 'o indice recebeu licitacao nas ultimas 30h', h + 'h');
  } else console.log('    (a tabela nao tem criado_em ou nao voltou — nao conto como falha)');

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
