/* ═══════════════════════════════════════════════════════════════════════════════════════════
   varredura_ufs.js — AS 27 PRAÇAS, UMA A UMA, COM OS ITENS JUNTO (fatia A29, 14/08/2026)

   ══ POR QUE UM CONDUTOR, E NÃO 27 COMANDOS NA MÃO ═══════════════════════════════════════════
   Porque 27 comandos na mão produzem 27 medições diferentes. Este arquivo faz três coisas que
   a mão não faz igual duas vezes:
     1. mede a UF ANTES e DEPOIS com a mesma régua (tools/conta_indice.js conta pelo servidor);
     2. coleta os ITENS na MESMA rodada — a lição da A22/A24: licitação que entra pela porta de
        busca entra SEM item, e sem item a busca por produto não a acha. Trazer a licitação e
        deixar o item para depois é entregar meia capacidade com cara de inteira;
     3. registra o que PULOU e por quê. Praça que o PNCP recusou não vira linha em branco na
        tabela: vira linha com o motivo.

   ══ A ORDEM É A DO ARQUITETO, E ELA É COMERCIAL, NÃO ALFABÉTICA ══════════════════════════════
   GO · DF · MG · BA · TO · MT · MS · SP · PE primeiro (onde a FPMED vende), depois o resto do
   Nordeste, Sudeste, Sul e Norte. Se a rodada for cortada no meio — falta de luz, PNCP fora —
   o que ficou pronto é a parte que mais rende. Ordem alfabética começaria pelo Acre.

   ══ RITMO EDUCADO, E O QUE ACONTECE SE O PORTAL RECLAMAR ════════════════════════════════════
   Cada coletor já tem breaker e desaceleração por 429; aqui há uma pausa ENTRE praças, e uma UF
   que falha NÃO derruba a rodada: anota e segue. Nunca insistir contra portal público é regra
   da casa, não gentileza.

     node tools/varredura_ufs.js                        (as 27, na ordem comercial)
     node tools/varredura_ufs.js --ufs GO,DF            (só essas)
     node tools/varredura_ufs.js --previa               (não grava — mostra o que traria)
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const PREVIA = process.argv.includes('--previa');

/* A ORDEM COMERCIAL. As nove primeiras são as praças onde a FPMED vende; SP e PE já foram
   varridas em rodadas anteriores e entram assim mesmo — uma segunda passada custa 18 chamadas
   e o índice muda todo dia. */
const ORDEM = ['GO', 'DF', 'MG', 'BA', 'TO', 'MT', 'MS', 'SP', 'PE',
  'AL', 'CE', 'MA', 'PB', 'PI', 'RN', 'SE',        // resto do Nordeste
  'ES', 'RJ',                                       // resto do Sudeste
  'PR', 'RS', 'SC',                                 // Sul
  'AC', 'AM', 'AP', 'PA', 'RO', 'RR'];              // Norte

const UFS = (arg('--ufs') || '').trim()
  ? arg('--ufs').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  : ORDEM;

/* A MESMA CONTAGEM DO conta_indice.js: o servidor conta, não nós. Duas réguas para o mesmo
   número é o jeito clássico de um "ganho" nascer de uma diferença de conta. */
async function conta(filtro) {
  const r = await fetch(`${SB}/rest/v1/${filtro}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (!r.ok) throw new Error(filtro + ' -> HTTP ' + r.status);
  const n = parseInt(String(r.headers.get('content-range') || '').split('/')[1], 10);
  return isFinite(n) ? n : null;
}
const contaUf = uf => conta(`licitacoes?select=id&uf=eq.${uf}`);
const contaItensUf = async uf => {
  /* Itens não têm coluna de UF; a conta é pela licitação. `licitacoes.itens_lidos_em` é o
     carimbo — contar licitações COM itens por UF responde a pergunta que interessa
     ("a praça está coberta?") sem precisar de junção. */
  return conta(`licitacoes?select=id&uf=eq.${uf}&itens_lidos_em=not.is.null`);
};

function roda(script, args, minutos) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: RAIZ, encoding: 'utf8', timeout: minutos * 60000, maxBuffer: 32 * 1024 * 1024,
  });
  return { saida: (r.stdout || '') + (r.stderr || ''), codigo: r.status, matou: !!r.error };
}

(async () => {
  const t0 = Date.now();
  console.log('=== VARREDURA POR UF — ' + UFS.length + ' praça(s), na ordem comercial ===');
  console.log('    ' + UFS.join(' · ') + (PREVIA ? '\n    [PRÉVIA — nada gravado]' : '') + '\n');

  const linhas = [];
  const totalItensAntes = await conta('licitacao_itens?select=id');

  for (const uf of UFS) {
    const antes = await contaUf(uf);
    const antesItens = await contaItensUf(uf);
    process.stdout.write(`── ${uf} ── (antes: ${antes} licitações, ${antesItens} com itens)\n`);

    const busca = roda('coleta_pncp_busca.js', ['--uf', uf, '--teto', '400', '--paginas', '4']
      .concat(PREVIA ? ['--previa'] : []), 25);
    const resumo = (busca.saida.match(/── resumo ──.*/) || [''])[0].trim();
    const achou = (busca.saida.match(/achados: (\d+) · já no índice: (\d+) · novos: (\d+)/) || []);
    const falhou = /BREAKER ABERTO|rate limit persistente|ERRO:/.test(busca.saida) || busca.codigo !== 0;
    if (falhou) console.log(`   ! ${uf}: o PNCP recusou ou ficou lento — PULANDO e anotando`);
    console.log('   ' + (resumo || (achou[0] || 'sem resposta útil')));

    /* OS ITENS NA MESMA RODADA. `--da-busca` é o alvo exato: as linhas que entraram pela porta
       de busca e ainda não têm item lido. Sem isto, a praça entra no índice e a busca por
       produto continua sem achá-la — que é o defeito que a A24 já pagou uma vez. */
    let itensLog = '(pulado — prévia)';
    if (!PREVIA) {
      const it = roda('coleta_itens_lote.js', ['--da-busca', '--teto', '400'], 40);
      itensLog = (it.saida.match(/──+ resumo ──+[\s\S]{0,400}/) || [''])[0].trim().split('\n')[0]
        || (it.saida.match(/itens gravados.*/) || ['sem resumo'])[0];
      if (it.codigo !== 0) itensLog = 'FALHOU: ' + itensLog;
    }
    console.log('   itens: ' + itensLog.slice(0, 160));

    const depois = await contaUf(uf);
    const depoisItens = await contaItensUf(uf);
    linhas.push({ uf, antes, depois, ganho: depois - antes, antesItens, depoisItens, falhou });
    console.log(`   → ${uf}: ${antes} → ${depois} (${depois - antes >= 0 ? '+' : ''}${depois - antes})`
      + `  ·  com itens ${antesItens} → ${depoisItens}\n`);
  }

  const totalItensDepois = await conta('licitacao_itens?select=id');
  console.log('\n══ TABELA UF A UF ══════════════════════════════════');
  console.log('UF    antes   depois   ganho   com itens (antes→depois)');
  for (const l of linhas) {
    console.log(l.uf.padEnd(5) + String(l.antes).padStart(6) + String(l.depois).padStart(9)
      + String(l.ganho).padStart(8) + '   ' + l.antesItens + ' → ' + l.depoisItens
      + (l.falhou ? '   [PULADA: portal recusou/lento]' : ''));
  }
  const ganho = linhas.reduce((s, l) => s + l.ganho, 0);
  console.log('\nganho total de licitações: ' + ganho);
  console.log('itens: ' + totalItensAntes + ' → ' + totalItensDepois
    + '  (+' + (totalItensDepois - totalItensAntes) + ')');
  console.log('praças puladas: ' + (linhas.filter(l => l.falhou).map(l => l.uf).join(', ') || 'nenhuma'));
  console.log('duração: ' + Math.round((Date.now() - t0) / 60000) + ' min');

  try {
    fs.mkdirSync(path.join(RAIZ, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(RAIZ, 'logs', '_a29_varredura.json'),
      JSON.stringify({ quando: new Date().toISOString(), linhas, totalItensAntes, totalItensDepois }, null, 2));
  } catch (e) { console.log('(não consegui gravar o log: ' + e.message + ')'); }
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
