// PROVA DE EQUIVALENCIA DO INDICE — contra o banco REAL da FPMED, so leitura.
// Portado da Global em 04/08 pelo tools/porta_suites_da_global.js (URL e caminhos da FPMED).
//
// O indice de candidatos existe pra visitar ~200 linhas em vez de 20.705. O risco dele e o
// OPOSTO do risco de lentidao: um indice que perde uma linha tira produto da busca EM SILENCIO —
// ninguem reclama, o item so nao aparece na proposta e vira "nao encontrado".
// O argumento de superconjunto esta escrito no codigo (4-gramas cobrem o substring, e os baldes
// (primeira letra, comprimento +-1) cobrem a distancia de edicao 1). Isto aqui e a VERIFICACAO
// EMPIRICA desse argumento: roda os DOIS caminhos, no mesmo processo e no mesmo banco, e compara
// resultado a resultado. Qualquer divergencia e motivo pra NAO usar o indice.
//   node tools/prova_indice.js
'use strict';
const fs = require('fs');
const RAIZ = 'C:/fpmed';
const { leTudoConferido } = require(RAIZ + '/tools/le_banco.js');
const seg = fs.readFileSync(RAIZ + '/segredos.local.txt', 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };
console.warn = function(){};

(async () => {
  const cot = await leTudoConferido('https://xzdowrksuswekwffoluk.supabase.co', H, 'cotacoes',
    'select=id,fornecedor,tipo,produto,principio_ativo,marca,und,compra_unit,compra_caixa,estoque,global_venda1');
  require(RAIZ + '/motor_busca.js');
  const M = globalThis.MotorBusca;
  M.setCotacoes(cot);
  try { const d = await (await fetch('https://xzdowrksuswekwffoluk.supabase.co/rest/v1/dicionario_marca_pa?select=tipo,de,para,aviso', { headers: H })).json();
        if (Array.isArray(d) && M.setDic) M.setDic(d); } catch (e) {}
  const base = M.getCotacoes();
  console.log('cotacoes na busca: ' + base.length);

  // ── O CONJUNTO DE CONSULTAS: nao invento, uso o que o sistema recebe de verdade ──
  const consultas = [];
  const fix = f => { try { return fs.readFileSync(RAIZ + '/tests/fixtures/' + f, 'utf8').split(/\r?\n/)
    .map(s => s.trim()).filter(Boolean); } catch (e) { return []; } };
  fix('pedido_medicamentos_91.txt').forEach(l => consultas.push(l.replace(/^\s*\d{1,3}[\s).-]+/, '').trim()));
  fix('pedido_cirurgico_37.txt').forEach(l => consultas.push(l.replace(/\s*-\s*\d+\s+\w+\s*$/, '').trim()));
  fix('pedido_materiais_18.txt').forEach(l => consultas.push(l.split(';')[0].trim()));
  fix('pedido_onco_63622.txt').forEach(l => consultas.push(l.trim()));
  fix('pedido_eduardo_68574.txt').forEach(l => consultas.push(l.trim()));
  // + o NOME DE CADA PRODUTO DO BANCO (amostra grande e adversarial: o texto mais parecido
  //   possivel com o cadastro, que e onde um indice furado apareceria)
  const passo = Math.max(1, Math.floor(base.length / 1200));
  for (let i = 0; i < base.length; i += passo) consultas.push(String(base[i].produto || '').slice(0, 70));
  const uniq = [...new Set(consultas.filter(q => q && q.length > 2))];
  console.log('consultas: ' + uniq.length + '  (fixtures reais + amostra dos nomes do banco)\n');

  const roda = (on) => { M.setIndice(on); const t = Date.now();
    const r = uniq.map(q => { const x = M.buscarMelhorProduto(q); return x ? x.id : null; });
    return { r, ms: Date.now() - t }; };

  console.log('rodando SEM indice (varredura completa)...');
  const semIdx = roda(false);
  console.log('rodando COM indice...');
  const comIdx = roda(true);

  let dif = 0; const exemplos = [];
  for (let i = 0; i < uniq.length; i++) {
    if (semIdx.r[i] !== comIdx.r[i]) { dif++;
      if (exemplos.length < 12) { const a = base.find(x => x.id === semIdx.r[i]), b = base.find(x => x.id === comIdx.r[i]);
        exemplos.push({ q: uniq[i], sem: a ? a.produto : 'NADA', com: b ? b.produto : 'NADA' }); } }
  }

  console.log('\n══ RESULTADO ══');
  console.log('   consultas comparadas...: ' + uniq.length);
  console.log('   DIVERGENCIAS...........: ' + dif);
  console.log('   casaram (sem indice)...: ' + semIdx.r.filter(Boolean).length);
  console.log('   casaram (com indice)...: ' + comIdx.r.filter(Boolean).length);
  console.log('   tempo sem indice.......: ' + semIdx.ms + 'ms  (' + (semIdx.ms / uniq.length).toFixed(1) + 'ms por consulta)');
  console.log('   tempo com indice.......: ' + comIdx.ms + 'ms  (' + (comIdx.ms / uniq.length).toFixed(1) + 'ms por consulta)');
  console.log('   ganho..................: ' + (semIdx.ms / Math.max(1, comIdx.ms)).toFixed(1) + 'x');
  if (dif) {
    console.log('\n   >>> DIVERGENCIAS (o indice NAO pode ser usado assim):');
    exemplos.forEach(e => { console.log('      pedido: ' + e.q.slice(0, 58));
      console.log('         sem indice: ' + String(e.sem).slice(0, 60));
      console.log('         com indice: ' + String(e.com).slice(0, 60)); });
  } else {
    console.log('\n   >>> ZERO DIVERGENCIA em ' + uniq.length + ' consultas. O indice devolve exatamente o');
    console.log('       mesmo produto que a varredura completa, e o faz '
      + (semIdx.ms / Math.max(1, comIdx.ms)).toFixed(1) + 'x mais rapido.');
  }

  // quantos candidatos o indice poupa, em media
  M.setIndice(true);
  let soma = 0, n = 0, nulos = 0;
  uniq.slice(0, 400).forEach(q => { const pal = String(q).toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (!pal.length) return; const cand = M._bmIdxCandidatos(pal[0], null, [], null);
    if (cand === null) { nulos++; return; } soma += cand.length; n++; });
  if (n) console.log('\n   candidatos visitados por consulta: ' + Math.round(soma / n) + ' de ' + base.length
    + '  (' + (soma / n / base.length * 100).toFixed(1) + '%)   ·   desistencias (varre tudo): ' + nulos);
  process.exitCode = dif ? 1 : 0;
})();
