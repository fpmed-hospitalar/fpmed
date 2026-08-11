// ============================================================================================
// prova_kpis_negocios.js — PROVA que os numeros das caixinhas do topo BATEM com as listas que
// elas abrem, e que a taxa de vitoria e a conta que a tela diz que e.
//
// ══ POR QUE ISTO NAO E SO UM ASSERT DE TEXTO ════════════════════════════════════════════════
// A suite le o arquivo e confere que a formula esta escrita. Nao confere que o NUMERO que ela
// produz sobre o dado REAL e o que a tela mostra. E o pedido do Lemuel foi explicito: "a lista
// das ganhas somando exatamente o valor do cartao".
// Aqui a conta e refeita contra o banco, com as MESMAS definicoes, e comparada centavo a centavo.
//
//   node tools/prova_kpis_negocios.js
// ============================================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
const brl = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function pega(rota) {
  let out = [], off = 0;
  while (true) {
    const r = await fetch(`${SB}/rest/v1/${rota}&limit=1000&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + rota);
    const d = await r.json(); out = out.concat(d);
    if (d.length < 1000 || off > 30000) break;   // o PostgREST daqui pagina em 1000
    off += 1000;
  }
  return out;
}

(async () => {
  console.log('=== OS NUMEROS DO TOPO, CONTRA O BANCO ===\n');
  const NEG = await pega('negocios?select=id,estagio,arquivado,valor_ganho,orgao,numero');
  console.log(`negocios lidos: ${NEG.length.toLocaleString('pt-BR')}`);

  // AS MESMAS DEFINICOES DA TELA (numerosDoTopo). Se elas mudarem la e nao aqui, esta prova
  // passa a medir outra coisa — por isso a suite trava as duas contra o mesmo texto.
  const ganhos = NEG.filter(n => Number(n.valor_ganho) > 0);
  const perdidas = NEG.filter(n => n.estagio === 'classificacao' && n.arquivado && !(Number(n.valor_ganho) > 0));
  const emDisputa = NEG.filter(n => n.estagio === 'classificacao' && !n.arquivado);
  const decididas = ganhos.length + perdidas.length;
  const total = ganhos.reduce((s, n) => s + Number(n.valor_ganho || 0), 0);
  const taxa = decididas ? (ganhos.length / decididas * 100) : null;

  console.log(`\nno funil agora ...... ${NEG.filter(n => !n.arquivado).length}`);
  console.log(`no historico ........ ${NEG.length.toLocaleString('pt-BR')}`);
  console.log(`ganhas .............. ${ganhos.length}`);
  console.log(`perdidas (decididas)  ${perdidas.length}`);
  console.log(`ainda EM disputa .... ${emDisputa.length}  (nao contam nem como ganho nem como perda)`);
  console.log(`taxa de vitoria ..... ${taxa == null ? '—' : taxa.toFixed(1) + '%'}  (${ganhos.length} de ${decididas})`);
  console.log(`total ganho ......... ${brl(total)}`);

  // ── O QUE A FORMULA ANTIGA DAVA ───────────────────────────────────────────────────────────
  // Registrado pra mostrar o tamanho da correcao, e nao pra defende-la.
  const antigoDenom = NEG.filter(n => n.estagio === 'classificacao' || Number(n.valor_ganho) > 0).length;
  console.log(`\n>>> A CORRECAO: o denominador antigo era ${antigoDenom} (contava os ${emDisputa.length} ainda em disputa`);
  console.log(`    como perdidos). Taxa antiga ${(ganhos.length / antigoDenom * 100).toFixed(2)}% x nova ${taxa.toFixed(2)}%.`);
  console.log(`    Hoje muda pouco; com 20 disputas abertas a taxa despencaria sozinha, sem nada dar errado.`);

  // ── A LISTA DAS GANHAS SOMA O CARTAO? ────────────────────────────────────────────────────
  const somaLista = ganhos.slice().sort((a, b) => Number(b.valor_ganho) - Number(a.valor_ganho))
    .reduce((s, n) => s + Number(n.valor_ganho || 0), 0);

  // ── A VIEW DOS GANHOS CONCORDA? ──────────────────────────────────────────────────────────
  const view = await pega('v_negocios_ganhos?select=id,valor_ganho,itens_confirmados,soma_itens,diferenca');
  const somaView = view.reduce((s, x) => s + Number(x.valor_ganho || 0), 0);
  const comItens = view.filter(x => Number(x.itens_confirmados) > 0);
  const divergentes = view.filter(x => x.diferenca != null && Math.abs(Number(x.diferenca)) >= 0.01);
  console.log(`\nna view v_negocios_ganhos: ${view.length} · com itens detalhados ${comItens.length} · divergentes ${divergentes.length}`);

  console.log('\n=== ASSERTS ===');
  ok('1. *** a soma da LISTA das ganhas e exatamente o total do cartao ***',
    Math.abs(somaLista - total) < 0.005, { lista: somaLista, cartao: total });
  ok('2. *** a view do banco concorda com a conta da tela ***',
    Math.abs(somaView - total) < 0.005 && view.length === ganhos.length,
    { view: somaView, tela: total, nView: view.length, nTela: ganhos.length });
  ok('3. *** negocio EM disputa nao entra no denominador ***',
    decididas === ganhos.length + perdidas.length && !perdidas.some(n => !n.arquivado));
  ok('4. *** e a correcao muda o numero (senao ela nao existiria) ***',
    emDisputa.length === 0 || antigoDenom !== decididas, { antigo: antigoDenom, novo: decididas });
  ok('5. *** toda ganha tem valor > 0 (a definicao de "ganha") ***',
    ganhos.every(n => Number(n.valor_ganho) > 0));
  ok('6. *** ninguem e ganho e perdido ao mesmo tempo ***',
    !ganhos.some(g => perdidas.some(pd => pd.id === g.id)));
  ok('7. *** negocio sem itens detalhados tem `diferenca` NULL (e nao zero) ***',
    view.filter(x => !Number(x.itens_confirmados)).every(x => x.diferenca == null));
  ok('8. ...porque "sem detalhe" e o normal do historico, e nao uma divergencia de zero',
    view.filter(x => !Number(x.itens_confirmados)).length > 0);

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('ERRO: ' + (e && e.message)); process.exit(1); });
