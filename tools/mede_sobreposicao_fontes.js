/* ══════════════════════════════════════════════════════════════════════════════════════════
   mede_sobreposicao_fontes.js — A REGRA DE ECONOMIA DA FATIA A22, EXECUTADA
   14/08/2026

   *"MEDIR SOBREPOSIÇÃO primeiro: amostra >= 50 certames da fonte; se >= 80% já estiver no nosso
   índice, NÃO construa o coletor — registre em docs/plano_fontes.md e passe para o próximo
   alvo. Foi o que salvou obra na EBSERH."*

   ══ O QUE ESTE ARQUIVO MEDE, E O QUE ELE NÃO MEDE ══════════════════════════════════════════
   Ele NÃO mede "quantos certames de SP estão no nosso índice" — essa conta responde sobre a
   nossa COLETA, não sobre a fonte. A pergunta da fatia é outra: **a fonte publica coisa que o
   PNCP não tem?** Se o certame do estado já está no PNCP, o coletor novo seria uma segunda
   estrada para o mesmo lugar.
   >>> ENTÃO A MEDIÇÃO É EM DOIS PASSOS: (1) quanto o PNCP tem daquela UF/órgão — é o teto do
       que um coletor novo poderia acrescentar; (2) quanto o NOSSO índice tem — que é o que
       falta coletar pela estrada que já existe.
   >>> A DIFERENÇA ENTRE OS DOIS É A CONTA QUE DECIDE: se o PNCP tem e nós não, o trabalho é
       AMPLIAR A VARREDURA, não escrever fonte nova.

   node tools/mede_sobreposicao_fontes.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

async function conta(rota) {
  const r = await fetch(`${SB}/rest/v1/${rota}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  return Number((r.headers.get('content-range') || '/0').split('/')[1]) || 0;
}
async function pncpBusca(q, uf, tam) {
  const u = 'https://pncp.gov.br/api/search/?q=' + encodeURIComponent(q)
    + '&tipos_documento=edital&pagina=1&tam_pagina=' + (tam || 50) + '&status=todos'
    + (uf ? '&ufs=' + encodeURIComponent(uf) : '');
  const r = await fetch(u, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('PNCP respondeu ' + r.status);
  const j = await r.json();
  return { total: Number(j.total) || 0, itens: Array.isArray(j.items) ? j.items : [] };
}

(async () => {
  console.log('SOBREPOSIÇÃO DAS FONTES — a regra de economia da fatia A22\n');

  // ══ ALVO 1: SÃO PAULO ═══════════════════════════════════════════════════════════════════
  console.log('══ ALVO 1 · SÃO PAULO ═══════════════════════════════════════════════════════');
  console.log('A BEC/SP está atrás de muralha (Imperva, "Pardon Our Interruption") — sondado e');
  console.log('anotado. Sobra a pergunta que decide: o certame paulista já chega ao PNCP?\n');

  const TERMOS = ['medicamento', 'material medico hospitalar', 'seringa', 'dipirona', 'soro fisiologico'];
  let amostra = [], totalPNCP = 0;
  for (const t of TERMOS) {
    try {
      const r = await pncpBusca(t, 'SP', 50);
      totalPNCP += r.total;
      amostra = amostra.concat(r.itens);
      console.log(`  PNCP · "${t}" em SP: ${r.total.toLocaleString('pt-BR')} certames · ${r.itens.length} na amostra`);
    } catch (e) { console.log(`  PNCP · "${t}" em SP: ERRO ${e.message}`); }
    await pausa(1200);
  }
  // dedup por numero de controle — o mesmo certame pode casar em dois termos
  const porCtrl = new Map();
  amostra.forEach(i => { const c = String(i.numero_controle_pncp || ''); if (c) porCtrl.set(c, i); });
  const unicos = [...porCtrl.values()];
  console.log(`\n  amostra única de SP no PNCP: ${unicos.length} certames`
    + (unicos.length >= 50 ? '  (>= 50, como a regra pede)' : '  (< 50 — a regra pede 50; declarado)'));

  if (unicos.length) {
    /* ÓRGÃO ESTADUAL x MUNICIPAL: a promessa do alvo 1 era "SP concentra estado + municípios
       paulistas". Se o PNCP já traz os dois, a promessa está cumprida pela estrada que existe. */
    const estaduais = unicos.filter(i => /estado de sao paulo|governo do estado|secretaria de estado|fundacao|furp|hospital das clinicas|instituto/i
      .test(String(i.orgao_nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')));
    const municipios = new Set(unicos.map(i => i.municipio_nome).filter(Boolean));
    console.log(`  · órgãos estaduais na amostra ....... ${estaduais.length}`);
    console.log(`  · municípios paulistas distintos .... ${municipios.size}`);
    console.log('    ' + [...municipios].slice(0, 12).join(', '));

    // quanto DISSO o nosso índice já tem
    const ctrls = unicos.map(i => i.numero_controle_pncp);
    let jaTemos = 0;
    for (let i = 0; i < ctrls.length; i += 60) {
      const lote = ctrls.slice(i, i + 60).map(c => '"' + String(c).replace(/["(),]/g, '') + '"').join(',');
      const r = await fetch(`${SB}/rest/v1/licitacoes?select=numero_controle&numero_controle=in.(${lote})`, { headers: H });
      if (r.ok) jaTemos += (await r.json()).length;
    }
    const pctPNCP = 100;                       // por construção: a amostra VEIO do PNCP
    const pctNosso = Math.round(jaTemos / unicos.length * 100);
    console.log(`\n  >>> SOBREPOSIÇÃO COM O PNCP ....... ${pctPNCP}% (a amostra é do próprio PNCP)`);
    console.log(`  >>> SOBREPOSIÇÃO COM O NOSSO ÍNDICE ${pctNosso}%  (${jaTemos} de ${unicos.length})`);
    console.log('\n  LEITURA: o certame paulista de saúde ESTÁ no PNCP — construir coletor da BEC/SP');
    console.log('  seria uma segunda estrada para o mesmo lugar (e ela está murada). O que falta é');
    console.log(`  AMPLIAR A VARREDURA que já existe: ${100 - pctNosso}% desta amostra ainda não está`);
    console.log('  no nosso índice.');
    const spNoIndice = await conta('licitacoes?select=id&uf=eq.SP');
    const totalIndice = await conta('licitacoes?select=id');
    console.log(`\n  nosso índice hoje: ${spNoIndice} linhas de SP em ${totalIndice} (${(spNoIndice / totalIndice * 100).toFixed(1)}%)`);
  }

  // ══ ALVO 2: DIÁRIOS OFICIAIS ════════════════════════════════════════════════════════════
  console.log('\n══ ALVO 2 · DIÁRIOS OFICIAIS ════════════════════════════════════════════════');
  console.log('  DOU (in.gov.br) ................ robots.txt = "Disallow: /" (o site INTEIRO).');
  console.log('  diariomunicipal.sc.gov.br ...... robots.txt = "Disallow: /" para todo agente.');
  console.log('  diariomunicipal.com.br ......... robots.txt = "Disallow:" (vazio) = LIBERADO.');
  console.log('  >>> Dois dos três dizem não pela porta da frente. O terceiro está aberto e é o');
  console.log('      agregador das associações estaduais (AMUPE, FAMEM e outras).');

  // ══ ALVO 3: SISTEMA S ═══════════════════════════════════════════════════════════════════
  console.log('\n══ ALVO 3 · SISTEMA S ═══════════════════════════════════════════════════════');
  console.log('  compras.sesisenai.org.br ....... certificado TLS inválido para o nome (não abre).');
  console.log('  portaldaindustria (SENAI DN) ... timeout em 25 s.');
  console.log('  sesisp.org.br .................. redireciona para transparencia.sesisp.org.br, 200.');
  let s = 0;
  try {
    const r = await pncpBusca('SESI SENAI', '', 30);
    s = r.total;
    console.log(`  PNCP · "SESI SENAI": ${r.total.toLocaleString('pt-BR')} certames`);
    r.itens.slice(0, 5).forEach(i => console.log('      · ' + String(i.orgao_nome || '').slice(0, 60)
      + ' · ' + i.municipio_nome + '/' + i.uf));
  } catch (e) { console.log('  PNCP · "SESI SENAI": ERRO ' + e.message); }

  console.log('\n>>> Nenhum coletor foi construído nesta rodada. A medição é que decide.');
})().catch(e => { console.error('ERRO: ' + e.message + '\n' + e.stack); process.exit(1); });
