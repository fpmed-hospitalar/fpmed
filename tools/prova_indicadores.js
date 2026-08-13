// ============================================================================================
// prova_indicadores.js — PROVA que os quatro indicadores do topo da Encontrar sao o BANCO, e
// nao o numero bonito do molde.
//
// == POR QUE ESTA PROVA EXISTE, E POR QUE ELA NAO E UMA SUITE ================================
// A suite le o arquivo e confere que a consulta esta escrita. Ela NAO consegue dizer se a
// consulta devolve o numero certo — nem se devolve numero nenhum. E o risco aqui e especifico:
// os quatro numeros do molde sao FICTICIOS (945.699 na base, 9.050 novas, 71 no funil, 11 abrem
// hoje) e estao escritos no README dele. Um deles vazando pra tela seria a licao S6 acontecendo
// em cima de um numero que o dono usa pra decidir se vale procurar hoje.
//
// == O QUE ELA FAZ DE DIFERENTE DE "chamar e imprimir" =======================================
// Ela conta DUAS VEZES, por caminhos diferentes, e compara:
//   1. pelo `content-range` do PostgREST com `Prefer: count=exact` — o caminho que a TELA usa;
//   2. baixando as linhas e contando na mao, paginado de 1000 em 1000 — o caminho lento.
// Se os dois discordarem, o barato esta mentindo, e e o barato que esta na tela.
// >>> Foi assim que a licao S1 nasceu nesta casa: o `limit=3000` que o servidor ignorou calado.
//
// == O QUE ELA **NAO** PROVA, e esta dito ====================================================
// Ela usa a service_role, que IGNORA a RLS. Entao ela prova a CONSULTA e o NUMERO, nao a
// permissao. O caminho de permissao (o vendedor que recebe 403 no `negocios` e ve "—" no lugar
// do numero, sem derrubar os outros tres) e coberto pela suite e pelo desenho das 4 leituras
// independentes.
//
//   node tools/prova_indicadores.js
// ============================================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
if (!SR) { console.log('nao achei a service_role no segredos.local.txt'); process.exit(1); }
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

// O caminho BARATO — exatamente o que a tela faz (contar(caminho) no fpmed_licitacoes.html).
async function contaBarato(caminho) {
  const r = await fetch(`${SB}/rest/v1/${caminho}${caminho.includes('?') ? '&' : '?'}select=id&limit=1`,
    { headers: Object.assign({ Prefer: 'count=exact' }, H) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const n = Number(String(r.headers.get('content-range') || '').split('/')[1]);
  if (!isFinite(n)) throw new Error('resposta sem contagem');
  return n;
}
// O caminho LENTO — baixa e conta. Pagina em 1000 porque e nisso que o PostgREST daqui corta.
async function contaLento(caminho) {
  let total = 0, off = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/${caminho}${caminho.includes('?') ? '&' : '?'}select=id&limit=1000&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    total += d.length;
    if (d.length < 1000 || off > 200000) break;
    off += 1000;
  }
  return total;
}

// Os numeros de demonstracao do molde. Nenhum deles pode aparecer como resultado de consulta.
const FICTICIOS = [945699, 9050, 71, 11, 2312];

(async () => {
  console.log('=== OS QUATRO INDICADORES DA ENCONTRAR, CONTRA O BANCO ===\n');

  const agora = new Date();
  const ontem = new Date(agora.getTime() - 24 * 36e5);
  const ini = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
  const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);

  const ALVOS = [
    ['Licitacoes no indice', 'licitacoes'],
    ['Novas em 24 h',        'licitacoes?coletado_em=gte.' + encodeURIComponent(ontem.toISOString())],
    ['Em acompanhamento',    'negocios?arquivado=is.false'],
    ['Abrem hoje',           'licitacoes?data_abertura=gte.' + encodeURIComponent(ini.toISOString())
                           + '&data_abertura=lte.' + encodeURIComponent(fim.toISOString())],
  ];

  const lidos = {};
  for (const [nome, caminho] of ALVOS) {
    let barato = null, lento = null, erro = null;
    try { barato = await contaBarato(caminho); lento = await contaLento(caminho); }
    catch (e) { erro = e.message; }
    lidos[nome] = barato;
    console.log(`  ${nome.padEnd(24)} ${erro ? 'ERRO: ' + erro : String(barato).padStart(8) + '   (recontado: ' + lento + ')'}`);
    ok(`a consulta de "${nome}" responde`, erro === null, erro);
    ok(`e os dois caminhos de contagem concordam em "${nome}" (S1: o servidor ja mentiu uma vez)`,
      erro !== null || barato === lento, { barato, lento });
  }

  console.log('');
  // ── A prova pelo avesso: nenhum numero da tela pode ser um dos de demonstracao do molde.
  const batendo = Object.entries(lidos).filter(([, v]) => FICTICIOS.includes(v));
  ok('*** nenhum dos quatro numeros e um dos ficticios do molde (S6) ***',
    batendo.length === 0, batendo);

  // ── E a coerencia entre eles, que e o que pega consulta trocada:
  ok('"novas em 24 h" nao pode ser maior que o indice inteiro',
    lidos['Novas em 24 h'] === null || lidos['Licitacoes no indice'] === null
    || lidos['Novas em 24 h'] <= lidos['Licitacoes no indice'],
    { novas: lidos['Novas em 24 h'], base: lidos['Licitacoes no indice'] });
  ok('"abrem hoje" nao pode ser maior que o indice inteiro',
    lidos['Abrem hoje'] === null || lidos['Licitacoes no indice'] === null
    || lidos['Abrem hoje'] <= lidos['Licitacoes no indice'],
    { hoje: lidos['Abrem hoje'], base: lidos['Licitacoes no indice'] });
  /* O indice tem que ter dado dentro. Um "0" nas quatro passaria em tudo acima e significaria
     que a tela vai mostrar zeros o dia inteiro sem nada estar tecnicamente errado. */
  ok('o indice NAO esta vazio (quatro zeros passariam em todos os asserts acima)',
    (lidos['Licitacoes no indice'] || 0) > 0, lidos['Licitacoes no indice']);

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  if (f) process.exit(1);
})().catch(e => { console.log('ERRO: ' + e.message); process.exit(1); });
