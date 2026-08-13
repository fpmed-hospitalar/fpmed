// GUARD DE BANCO — o casamento do item 8 contra a CMED DE VERDADE (25.702 linhas).
//
// == POR QUE ESTE ARQUIVO EXISTE, alem da testa_cmed_base ====================================
// A `tests/testa_cmed_base.js` prova a LOGICA contra um indice de mentira: ela responde
// "a regra esta certa?". Esta aqui responde outra pergunta, que nenhum indice falso responde:
// "a regra ACHA o que existe na base real, e a cardinalidade que ela pressupoe e verdade?".
//
// >>> A ORDEM REGISTRO-ANTES-DE-EAN E UMA DECISAO APOIADA EM MEDICAO, e medicao envelhece.
//     Se uma edicao nova da CMED trouxer registros repetidos, a premissa cai — e a ordem que
//     hoje esta certa passa a estar errada, EM SILENCIO. E este teste que grita.
//
//   node tests/db/testa_cmed_chaves_reais.js
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const M = require(path.join(RAIZ, 'fpmed_teto_cmed.js'));
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
if (!SR) { console.error('sem service_role no segredos.local.txt'); process.exit(1); }
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

// O PostgREST daqui corta em 1000 (S1). Paginar, e CONFERIR se truncou.
async function tudo(q) {
  let out = [], de = 0;
  for (;;) {
    const r = await fetch(SB + '/rest/v1/' + q, { headers: Object.assign({ Range: de + '-' + (de + 999) }, H) });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + q);
    const j = await r.json();
    out = out.concat(j);
    if (j.length < 1000) return out;
    de += 1000;
    if (de > 60000) throw new Error('paginacao passou de 60k — teto de seguranca');
  }
}

(async () => {
  console.log('GUARD testa_cmed_chaves_reais - o casamento contra a CMED de verdade\n');

  const regua = await tudo('cmed_regua?select=ggrem,ean1,registro,subst_norm,apresentacao,dose_key,qtd_apres,pf_unit,pmvg_unit,teto_gov_unit,cap');
  const teto  = await tudo('cmed_teto?select=*');
  const dic   = await tudo('cmed_dicionario?select=*');
  console.log('regua ' + regua.length + ' · teto ' + teto.length + ' · dicionario ' + dic.length + '\n');

  ok(n + '. a regua veio INTEIRA (se parar em 1000, tudo abaixo mede outra base)',
    regua.length > 20000, { linhas: regua.length }); n++;

  // ── A CARDINALIDADE QUE A ORDEM DAS CHAVES PRESSUPOE ───────────────────────────────────────
  const grupos = (campo) => {
    const m = new Map();
    regua.forEach(x => { const k = String(x[campo] || '').replace(/\D/g, ''); if (!k) return; m.set(k, (m.get(k) || 0) + 1); });
    return { distintos: m.size, repetidas: [...m.values()].filter(v => v > 1).length };
  };
  const gReg = grupos('registro'), gEan = grupos('ean1');
  console.log('  registro: ' + gReg.distintos + ' distintos, ' + gReg.repetidas + ' repetidas');
  console.log('  ean1:     ' + gEan.distintos + ' distintos, ' + gEan.repetidas + ' repetidas\n');

  /* A PREMISSA DA ORDEM, EM UM ASSERT. Nao cravo os numeros de hoje (1 e 155) — uma edicao nova
     da CMED muda os dois legitimamente. O que NAO pode mudar e a RELACAO: o registro tem que
     continuar sendo a chave mais unica, senao a ordem registro-antes-de-ean deixa de fazer
     sentido e vira preferencia sem base. */
  ok(n + '. *** o REGISTRO continua sendo mais unico que o EAN (a premissa da ordem das chaves) ***',
    gReg.repetidas <= gEan.repetidas, { registro: gReg.repetidas, ean: gEan.repetidas }); n++;
  ok(n + '. e o registro continua praticamente 1:1 (menos de 1% de chaves repetidas)',
    gReg.repetidas < regua.length * 0.01, { repetidas: gReg.repetidas, de: regua.length }); n++;

  // ── O MOTOR ACHA O QUE EXISTE ──────────────────────────────────────────────────────────────
  const idx = M.indexar({ regua, teto, dicionario: dic });
  ok(n + '. o indice montou as tres portas com a base real',
    idx.porGgrem.size > 20000 && idx.porRegistro.size > 20000 && idx.porEan.size > 20000,
    idx.tamanho); n++;

  // amostra ESPALHADA, nao uma janela contigua (licao S11: janela contigua pega 12 variacoes do
  // mesmo medicamento e prova que o gerador funciona, nao que o casamento funciona)
  const passo = Math.floor(regua.length / 40) || 1;
  const amostra = regua.filter((_, i) => i % passo === 0).slice(0, 40);

  const porReg = amostra.filter(x => x.registro &&
    M.avaliar({ registro: x.registro, precoUnit: 0.01, unitario: true }, idx).via === 'registro').length;
  const porEan = amostra.filter(x => x.ean1 &&
    ['ean', 'registro'].includes(M.avaliar({ ean: x.ean1, precoUnit: 0.01, unitario: true }, idx).via)).length;
  console.log('  amostra espalhada de ' + amostra.length + ': casou por registro ' + porReg + ' · por ean ' + porEan + '\n');
  ok(n + '. *** o casamento por REGISTRO acha na base real (>=95% da amostra) ***',
    porReg >= Math.floor(amostra.length * 0.95), { casou: porReg, de: amostra.length }); n++;
  ok(n + '. e o casamento por EAN tambem',
    porEan >= Math.floor(amostra.length * 0.95), { casou: porEan, de: amostra.length }); n++;

  // ── E O QUE NAO E MEDICAMENTO CONTINUA NAO CASANDO ─────────────────────────────────────────
  /* Inventar teto pra material seria o pior erro que esta camada pode cometer: o comprador
     publico leria "acima do teto legal" sobre um parafuso, que nao tem teto nenhum. */
  const lixo = ['PARAFUSO SEXTAVADO 5MM', 'CADEIRA DE RODAS ADULTO', 'PAPEL A4 75G RESMA',
                'LUVA DE PROCEDIMENTO NAO CIRURGICA M', 'CATETER INTRAVENOSO 22G'];
  const casaramLixo = lixo.filter(d =>
    M.avaliar({ descricao: d, precoUnit: 1, unitario: true }, idx).situacao !== 'nao_encontrado');
  ok(n + '. *** material e correlato continuam SEM teto (inventar um seria o pior erro) ***',
    casaramLixo.length === 0, { casaram: casaramLixo }); n++;

  // ── O GRAU DE CONFIANCA, NA BASE REAL ──────────────────────────────────────────────────────
  /* Quantos dos que casam por NOME casam com a substancia vinda do dicionario ('alta') e
     quantos por palpite da primeira palavra ('media')? O numero em si nao e assert — ele muda
     com o dicionario. O que se cobra e que os DOIS caminhos existam e sejam distinguiveis. */
  const nomes = amostra.map(x => (x.subst_norm || '') + ' ' + (x.dose_key || '')).filter(s => s.trim().length > 6);
  const graus = {};
  nomes.forEach(d => {
    const r = M.avaliar({ descricao: d, precoUnit: 0.01, unitario: true }, idx);
    const k = r.confianca || 'nao_casou';
    graus[k] = (graus[k] || 0) + 1;
  });
  console.log('  graus no casamento por nome: ' + JSON.stringify(graus) + '\n');
  ok(n + '. o grau de confianca sai preenchido no casamento por nome',
    (graus.alta || 0) + (graus.media || 0) > 0, graus); n++;
  /* E A TRAVA FUNCIONA CONTRA A BASE REAL: exigir 'exata' tem que calar TODO casamento por nome,
     porque nenhum deles e exato por definicao. */
  const sobrouComExata = nomes.filter(d =>
    M.avaliar({ descricao: d, precoUnit: 0.01, unitario: true }, idx, { confiancaMinima: 'exata' })
      .situacao !== 'nao_encontrado').length;
  ok(n + '. *** exigir confianca EXATA cala todo casamento por nome, na base real ***',
    sobrouComExata === 0, { sobrou: sobrouComExata, de: nomes.length }); n++;

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('ERRO: ' + (e && e.message)); process.exit(1); });
