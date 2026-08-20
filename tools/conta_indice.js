/* ═══════════════════════════════════════════════════════════════════════════════════════════
   conta_indice.js — O RETRATO DO ÍNDICE, UF A UF (fatia A29, 14/08/2026)

   ══ POR QUE UMA FERRAMENTA SÓ PARA CONTAR ═══════════════════════════════════════════════════
   Porque "antes → depois" só vale se as duas pontas forem medidas pela MESMA régua. Nas rodadas
   passadas o antes vinha de um `curl` improvisado e o depois de outro, e a diferença entre as
   duas contas já apareceu como ganho uma vez. Uma régua só, chamada duas vezes, não tem como
   discordar de si mesma.

   ══ O TETO DE 1000 DO POSTGREST, DE NOVO ════════════════════════════════════════════════════
   Contar por `select=*` e medir o `length` devolveria 1000 sempre. Aqui a contagem vem do
   cabeçalho `Content-Range` com `Prefer: count=exact` — é o servidor contando, não nós.

     node tools/conta_indice.js                 (tabela UF a UF + totais)
     node tools/conta_indice.js --json arquivo  (grava o retrato para comparar depois)
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE',
  'PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

/* A contagem vem do SERVIDOR (Content-Range), não de um array que o teto de 1000 corta. */
async function conta(filtro) {
  const r = await fetch(`${SB}/rest/v1/${filtro}`, {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!r.ok) throw new Error(filtro + ' -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const cr = r.headers.get('content-range') || '';
  const n = parseInt(String(cr).split('/')[1], 10);
  return isFinite(n) ? n : null;
}

(async () => {
  const retrato = { quando: new Date().toISOString(), ufs: {}, totais: {} };
  retrato.totais.licitacoes = await conta('licitacoes?select=id');
  retrato.totais.itens = await conta('licitacao_itens?select=id');
  retrato.totais.com_itens = await conta('licitacoes?select=id&itens_lidos_em=not.is.null');
  retrato.totais.da_busca = await conta('licitacoes?select=id&bruto->>_coleta=eq.busca');
  retrato.totais.da_busca_sem_itens = await conta(
    'licitacoes?select=id&bruto->>_coleta=eq.busca&itens_lidos_em=is.null');
  /* Os 192 resultados da A7 entram no retrato porque são o que NÃO pode se mexer: coluna
     resultado_* fora do corpo do upsert é lei desde a A9, e lei sem medida é conselho. */
  retrato.totais.resultados_a7 = await conta('licitacao_itens?select=id&resultado_lido_em=not.is.null');

  for (const uf of UFS) {
    retrato.ufs[uf] = {
      licitacoes: await conta(`licitacoes?select=id&uf=eq.${uf}`),
      com_itens: await conta(`licitacoes?select=id&uf=eq.${uf}&itens_lidos_em=not.is.null`),
    };
  }

  const dest = process.argv.indexOf('--json') > -1 ? process.argv[process.argv.indexOf('--json') + 1] : null;
  console.log('=== RETRATO DO ÍNDICE — ' + retrato.quando + ' ===\n');
  console.log('UF    licitações   com itens');
  for (const uf of UFS) {
    const u = retrato.ufs[uf];
    console.log(uf.padEnd(5) + String(u.licitacoes).padStart(10) + String(u.com_itens).padStart(11));
  }
  const somaUf = UFS.reduce((s, uf) => s + (retrato.ufs[uf].licitacoes || 0), 0);
  console.log('\nsoma das 27 UFs ....... ' + somaUf);
  console.log('licitações no índice .. ' + retrato.totais.licitacoes
    + '   (a diferença de ' + (retrato.totais.licitacoes - somaUf) + ' são as de UF nula)');
  console.log('itens .................. ' + retrato.totais.itens);
  console.log('licitações com itens ... ' + retrato.totais.com_itens);
  console.log('vindas da porta busca .. ' + retrato.totais.da_busca
    + '   (sem itens ainda: ' + retrato.totais.da_busca_sem_itens + ')');
  console.log('resultados da A7 ....... ' + retrato.totais.resultados_a7 + '   (não pode cair)');
  if (dest) { fs.writeFileSync(dest, JSON.stringify(retrato, null, 2)); console.log('\nretrato gravado em ' + dest); }
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
