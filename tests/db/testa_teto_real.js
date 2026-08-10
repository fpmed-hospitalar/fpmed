// GUARD DE BANCO — o motor do teto contra a CMED DE VERDADE (25.702 apresentações).
//
// O tests/testa_teto_cmed.js roda contra um índice de mentira: ele prova a LÓGICA. Este roda
// contra o banco: prova que a lógica encontra o que existe. Os dois são necessários e nenhum
// substitui o outro — um índice de mentira sempre casa, porque foi eu que escrevi as duas pontas.
//
// >>> ELE TAMBEM MEDE A TAXA DE CASAMENTO, que é o número honesto desta ferramenta: se o motor
//     só casasse 5% dos itens, o Conferidor seria um "não encontrado" com passos extras. O
//     número fica impresso pra ser olhado, não escondido atrás de um verde.
//
//   node tests/db/testa_teto_real.js
'use strict';
const fs = require('fs'), path = require('path');
const { Client } = require('pg');
const M = require(path.join(__dirname, '..', '..', 'fpmed_teto_cmed.js'));

const REF = 'xzdowrksuswekwffoluk';
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const m = seg.match(/DB_PASSWORD\s*[:=]\s*(\S+)/i);
if (!m) { console.error('DB_PASSWORD nao encontrada — abortando.'); process.exit(1); }
const ALVOS = [
  { host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
  { host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
];

let ok = 0, fail = 0;
const t = (nome, cond, extra = '') => { if (cond) { ok++; console.log('  ok   ' + nome); }
                                        else { fail++; console.log('  FALHA ' + nome + '  ' + extra); } };

(async () => {
  let c = null, ultimo;
  for (const a of ALVOS) {
    const cli = new Client({ ...a, password: m[1], database: 'postgres',
                             ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    try { await cli.connect(); c = cli; break; } catch (e) { ultimo = e; try { await cli.end(); } catch (_) {} }
  }
  if (!c) { console.error('ERRO de conexao: ' + ultimo.message); process.exit(1); }

  console.log('\n=== O MOTOR DO TETO CONTRA A CMED REAL ===\n');

  const teto = (await c.query('select subst_norm, dose_key, apresentacoes, teto_min, teto_max, tem_cap from cmed_teto')).rows;
  const dic  = (await c.query('select marca_norm, substancia from cmed_dicionario')).rows;
  const idx  = M.indexar({ regua: [], teto, dicionario: dic });

  console.log(`  base: ${teto.length} chaves de teto · ${dic.length} pares marca->PA\n`);
  t('a base de teto tem conteudo (a view cmed_teto nao esta vazia)', teto.length > 1000, teto.length);
  t('o dicionario marca->PA tem conteudo', dic.length > 1000, dic.length);

  // ── 1. ITENS QUE TEM QUE CASAR ──────────────────────────────────────────────────────────
  // Escolhidos entre os princípios ativos mais comuns em licitação hospitalar.
  const DEVE_CASAR = ['DIPIRONA 1000MG COMPRIMIDO', 'DIPIRONA 500MG COMPRIMIDO'];
  for (const d of DEVE_CASAR) {
    const r = M.avaliar({ descricao: d, precoUnit: 0.01, unitario: true }, idx);
    t('casa: ' + d, r.situacao !== 'nao_encontrado', 'via=' + r.via + ' teto=' + r.teto);
  }

  // ── 2. O QUE NAO PODE CASAR ─────────────────────────────────────────────────────────────
  // Material e correlato não têm preço tabelado. Casar isso seria o motor inventando teto.
  for (const d of ['PARAFUSO SEXTAVADO 10MM ACO', 'CADEIRA DE ESCRITORIO GIRATORIA', 'PAPEL A4 75G RESMA']) {
    const r = M.avaliar({ descricao: d, precoUnit: 10, unitario: true }, idx);
    t('*** NAO casa (nao e medicamento): ' + d, r.situacao === 'nao_encontrado', 'casou com ' + r.evidencia);
  }

  // ── 3. O TETO VEM MESMO DO BANCO, E E UNITARIO ──────────────────────────────────────────
  const dip = M.avaliar({ descricao: 'DIPIRONA 1000MG', precoUnit: 0.01, unitario: true }, idx);
  if (dip.teto != null) {
    t('*** o teto e UNITARIO (medicamento comum fica abaixo de R$ 50/unidade) ***',
      dip.teto > 0 && dip.teto < 50, 'teto=' + dip.teto);
    t('a faixa min<=max', dip.faixa && dip.faixa[0] <= dip.faixa[1], JSON.stringify(dip.faixa));
    t('*** usa o MENOR da faixa ***', dip.teto === dip.faixa[0], dip.teto + ' vs ' + JSON.stringify(dip.faixa));
  } else { t('DIPIRONA 1000MG tem teto na base', false, 'nao achou'); }

  // ── 4. A TAXA DE CASAMENTO CONTRA O NOSSO ESTOQUE REAL ──────────────────────────────────
  // O numero honesto da ferramenta. Nao ha meta aqui: o teste IMPRIME e so falha se der ZERO,
  // porque zero significa que o motor nao serve pra nada.
  const est = (await c.query(
    `select produto from cotacoes where tipo = 'global' and produto is not null limit 400`)).rows;
  let casou = 0;
  for (const e of est) {
    const r = M.avaliar({ descricao: e.produto, precoUnit: 1, unitario: true }, idx);
    if (r.situacao !== 'nao_encontrado') casou++;
  }
  const pct = est.length ? (casou / est.length * 100) : 0;
  console.log(`\n  >>> TAXA DE CASAMENTO no estoque proprio: ${casou}/${est.length} (${pct.toFixed(1)}%)`);
  console.log('      (estoque tem material e correlato, que NAO tem teto CMED — nao se espera 100%)\n');
  t('o motor casa alguma coisa do estoque real (zero significaria que ele nao serve)', casou > 0, casou);

  // ── 5. O MOTOR CONSEGUE COMPARAR PRECO CONTRA TETO NO DADO REAL? ────────────────────────
  // >>> ATENCAO A QUEM LER ESTE NUMERO: o "acima" impresso aqui NAO e um achado de negocio.
  //     Ele usa uma unitarizacao GROSSEIRA (venda dividida pelo primeiro numero do `und`), e
  //     este projeto tem uma funcao inteira pra isso — `unitarioNosso`, no fpmed_licitacoes —
  //     justamente porque a divisao ingenua erra: pack nao detectado vira divisor 1 e o preco
  //     de CAIXA e comparado com teto UNITARIO, o que joga quase tudo pra "acima".
  //     A medida seria de verdade com a unitarizacao boa; aqui ela serve so pra provar que o
  //     motor CONSEGUE comparar. O achado real registrado no item 1B foi de 28 chaves acima.
  //     Nao repita este numero como se fosse diagnostico.
  const comPreco = (await c.query(
    `select produto, global_venda1 as venda, und from cotacoes
      where tipo = 'global' and global_venda1 is not null and global_venda1 > 0 limit 600`)).rows;
  let acima = 0, avaliados = 0;
  for (const e of comPreco) {
    const un = String(e.und || '').match(/\d+/);
    const div = un ? Math.max(1, parseInt(un[0], 10)) : 1;
    const r = M.avaliar({ descricao: e.produto, precoUnit: Number(e.venda) / div, unitario: true }, idx);
    if (r.situacao === 'acima') acima++;
    if (r.situacao === 'acima' || r.situacao === 'abaixo') avaliados++;
  }
  console.log(`  >>> comparados: ${avaliados} · dos quais "acima": ${acima}`);
  console.log('      ⚠️ NAO e diagnostico: a unitarizacao aqui e grosseira (venda/und) e infla o');
  console.log('         "acima". Serve so pra provar que o motor compara. Ver o comentario no teste.');
  t('o motor consegue avaliar preco contra teto no dado real', avaliados > 0, avaliados);

  await c.end();
  console.log(`\n───────────────────────────────\n${ok} ok, ${fail} falha(s)`);
  console.log(fail ? '>>> VERMELHO' : '>>> TUDO VERDE');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
