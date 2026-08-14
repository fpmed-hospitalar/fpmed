// ═══════════════════════════════════════════════════════════════════════════════════════════
// PROVA DA FATIA B10 — A FILA DE EAN COMEÇA POR QUEM ESTÁ EM NEGÓCIO ATIVO
//                                                              (14/08/2026, Trabalhador B)
//
//   node tools/prova_ean_negocio_ativo.js
//
// ── O QUE ELA MEDE ─────────────────────────────────────────────────────────────────────────
// Roda AS MESMAS funções da tela (recortadas por âncora do fpmed_sistema_final.html) contra o
// banco REAL, e mostra: quais negócios estão ativos, por qual caminho cada um chega ao edital,
// quantos itens foram lidos, quantos produtos sem EAN sobem para o topo — e CONTRA QUAL ITEM
// cada um casou, para poder ser conferido a olho.
//
// ── E ELA TENTA DERRUBAR O PRÓPRIO RESULTADO ───────────────────────────────────────────────
// Todo produto marcado é re-conferido por um normalizador ESCRITO DE OUTRO JEITO (tabela de
// acentos à mão, em vez de NFD). Se os dois discordarem em uma linha que seja, a prova falha:
// duas implementações que erram igual é coincidência que não se compra barato.
//
// ── 100% SÓ-LEITURA ────────────────────────────────────────────────────────────────────────
// Nenhum INSERT, UPDATE ou DELETE. Isto aqui só olha.
// ═══════════════════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// ── as funções REAIS da tela, recortadas por âncora ────────────────────────────────────────
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');
const L = src.split(/\r?\n/);
const bloco = (de, ate) => {
  const s = L.findIndex(x => x.includes(de));
  if (s < 0) throw new Error('âncora inicial não encontrada: ' + de);
  let e = -1;
  for (let i = s + 1; i < L.length; i++) if (L[i].includes(ate)) { e = i; break; }
  if (e < 0) throw new Error('âncora final não encontrada: ' + ate);
  return L.slice(s, e).join('\n');
};
const TELA = new Function(
  bloco('function _eanDigitos(s)', 'function _eanEsc') + '\n' +
  bloco('function eanGruposSemEan(lista)', 'function _eanTotalProdutos') + '\n' +
  bloco('var EAN_NEG_MAX_EDITAIS', 'async function _eanCarregaNegocioAtivo') + '\n' +
  'return { eanGruposSemEan, _eanNormTexto, _eanIndiceItens, _eanEmNegocioAtivo, _eanDigitos,' +
  '         _eanNegocioAtivoQ, _EAN_CARA_DE_CONTROLE, EAN_NEG_MAX_EDITAIS,' +
  '         ligaIndice: function(v){ _eanNegAtivo = v; } };'
)();

// ── o normalizador INDEPENDENTE, para conferir o da tela ───────────────────────────────────
const ACENTOS = { 'Á':'A','À':'A','Â':'A','Ã':'A','Ä':'A','É':'E','È':'E','Ê':'E','Ë':'E',
  'Í':'I','Ì':'I','Î':'I','Ï':'I','Ó':'O','Ò':'O','Ô':'O','Õ':'O','Ö':'O','Ú':'U','Ù':'U',
  'Û':'U','Ü':'U','Ç':'C','Ñ':'N' };
function normOutroJeito(s) {
  let up = String(s == null ? '' : s).toUpperCase(), out = '';
  for (const ch of up) out += (ACENTOS[ch] !== undefined ? ACENTOS[ch] : ch);
  return out.replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── banco (mesma escada de conexão do tools/roda_sql.js) ───────────────────────────────────
const REF = 'xzdowrksuswekwffoluk';
const PW = (fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8').match(/DB_PASSWORD\s*[:=]\s*(\S+)/i) || [])[1];
if (!PW) { console.error('DB_PASSWORD não encontrada'); process.exit(1); }
const ALVOS = [
  { nome: 'direta',    host: `db.${REF}.supabase.co`,               port: 5432, user: 'postgres' },
  { nome: 'pooler',    host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
  { nome: 'pooler-tx', host: 'aws-0-sa-east-1.pooler.supabase.com', port: 6543, user: `postgres.${REF}` },
];
async function conecta() {
  let ultimo;
  for (const a of ALVOS) {
    const c = new Client({ host: a.host, port: a.port, user: a.user, password: PW, database: 'postgres',
                           ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    try { await c.connect(); console.log(`[conexão: ${a.nome}]`); return c; } catch (e) { ultimo = e; try { await c.end(); } catch (_) {} }
  }
  throw ultimo;
}

let falhas = 0;
const ok = (nome, cond, extra) => {
  console.log((cond ? '  [OK]   ' : '  [FALHA]') + ' ' + nome + (extra !== undefined ? '  ->  ' + JSON.stringify(extra) : ''));
  if (!cond) falhas++;
};

(async () => {
  const db = await conecta();
  try {
    // ── 1. os negócios, e o filtro de "ativo" que a tela usa ───────────────────────────────
    const negs = (await db.query(
      `select id, numero, numero_controle, licitacao_id, estagio, situacao, arquivado, orgao
         from negocios where coalesce(arquivado,false) = false order by id`)).rows;
    const ativos = negs.filter(TELA._eanNegocioAtivoQ);

    console.log('\n═══ B10 · PROVA DA ORDEM POR NEGÓCIO ATIVO ═══');
    console.log(`  negócios não arquivados ...... ${negs.length}`);
    console.log(`  ...destes, ATIVOS ............ ${ativos.length}  (fora: contrato/perdido/cancelado)`);

    // ── 2. de cada negócio ativo ao edital, pelos três caminhos ────────────────────────────
    const porControle = new Map();
    const caminho = [];
    for (const n of ativos) {
      let nc = String(n.numero_controle || '').trim(), via = 'numero_controle';
      if (!nc && TELA._EAN_CARA_DE_CONTROLE.test(String(n.numero || '').trim())) {
        nc = String(n.numero).trim(); via = 'numero (com cara de controle)';
      }
      if (!nc && n.licitacao_id) {
        const r = (await db.query('select numero_controle from licitacoes where id = $1', [n.licitacao_id])).rows[0];
        if (r && r.numero_controle) { nc = r.numero_controle; via = 'licitacao_id'; }
      }
      caminho.push({ id: n.id, estagio: n.estagio, situacao: n.situacao, via: nc ? via : 'SEM EDITAL', nc: nc || '—' });
      if (nc) { if (!porControle.has(nc)) porControle.set(nc, []); porControle.get(nc).push(n); }
    }
    console.log('\n  ── como cada negócio ativo chega (ou não) ao edital ──');
    for (const c of caminho) {
      console.log(`     #${String(c.id).padStart(5)} ${String(c.estagio || '').padEnd(14)} ${String(c.situacao || '').padEnd(10)} ${c.via.padEnd(30)} ${c.nc}`);
    }

    // ── 3. os itens desses editais ─────────────────────────────────────────────────────────
    const controles = [...porControle.keys()].slice(0, TELA.EAN_NEG_MAX_EDITAIS);
    const itens = [];
    let editaisComItens = 0;
    for (const nc of controles) {
      const r = (await db.query(
        'select numero_item, descricao from licitacao_itens where numero_controle = $1', [nc])).rows;
      if (r.length) editaisComItens++;
      const neg = porControle.get(nc)[0];
      for (const it of r) itens.push({ numero_item: it.numero_item, descricao: it.descricao,
                                       controle: nc, orgao: neg.orgao || '', negocio_id: neg.id });
    }
    console.log(`\n  editais de negócio ativo ..... ${controles.length}`);
    console.log(`  ...com itens no índice ....... ${editaisComItens}`);
    console.log(`  itens lidos .................. ${itens.length}`);

    // ── 4. a marcação, com a MESMA função da tela ──────────────────────────────────────────
    TELA.ligaIndice({ ok: true, indice: TELA._eanIndiceItens(itens) });
    const cot = (await db.query(
      'select id, produto, marca, principio_ativo, ean, registro_anvisa, estoque from cotacoes')).rows;
    // ── O TEMPO, MEDIDO DOS DOIS JEITOS ────────────────────────────────────────────────────
    // Frio é a primeira chamada da vida da página (com o JIT ainda esquentando); quente é toda
    // vez que alguém clica em "Ver a lista". Os dois importam, e são números diferentes — dizer
    // só o quente esconderia a abertura da tela, e dizer só o frio condenaria cada clique.
    const cronometra = (f, n) => { const t = process.hrtime.bigint(); for (let k = 0; k < n; k++) f(); return Number(process.hrtime.bigint() - t) / 1e6 / n; };
    const frio = cronometra(() => TELA.eanGruposSemEan(cot), 1);
    const quenteComSelo = cronometra(() => TELA.eanGruposSemEan(cot), 8);
    const indiceLigado = { ok: true, indice: TELA._eanIndiceItens(itens) };
    TELA.ligaIndice(null);
    const quenteSemSelo = cronometra(() => TELA.eanGruposSemEan(cot), 8);   // a linha de base de antes da B10
    TELA.ligaIndice(indiceLigado);
    const grupos = TELA.eanGruposSemEan(cot);
    const marcados = grupos.filter(g => g.negAtivo);
    const semPa = grupos.filter(g => !String(g.principio_ativo || '').trim()).length;

    console.log(`\n  linhas de cotação ............ ${cot.length}`);
    console.log(`  produtos SEM EAN (grupos) .... ${grupos.length}`);
    console.log(`  ...sem princípio ativo ....... ${semPa}  (não podem ser casados por substância)`);
    console.log(`  ...EM NEGÓCIO ATIVO .......... ${marcados.length}`);
    console.log(`\n  tempo (abrir a tela, frio) ... ${frio.toFixed(1)} ms`);
    console.log(`  tempo (cada clique, quente) .. ${quenteComSelo.toFixed(1)} ms   ·  sem a B10 era ${quenteSemSelo.toFixed(1)} ms`);
    console.log(`  o que a B10 acrescentou ...... ${(quenteComSelo - quenteSemSelo).toFixed(1)} ms  (régua da casa: 100 ms por interação)`);

    // ── 5. o topo da lista, para conferir a olho ───────────────────────────────────────────
    console.log('\n  ── o topo da lista, como a tela vai mostrar ──');
    grupos.slice(0, 10).forEach((g, i) => {
      const it = g.negAtivo;
      console.log(`   ${String(i + 1).padStart(2)}. ${g.produto.slice(0, 46).padEnd(46)} ${(g.marca || '—').slice(0, 14).padEnd(14)} ${g.ids.length} linha(s)`);
      console.log(`       ${it ? 'em negócio ativo #' + it.negocio_id + ' · item ' + it.numero_item + ': ' + String(it.descricao).slice(0, 74)
                             : '(sem selo: ' + (String(g.principio_ativo || '').trim() ? 'princípio ativo não aparece em edital ativo' : 'sem princípio ativo') + ')'}`);
    });

    // ── 6. OS ASSERTS ──────────────────────────────────────────────────────────────────────
    console.log('\n  ── conferências ──');
    ok('1. os marcados vêm todos ANTES dos não marcados',
      grupos.findIndex(g => !g.negAtivo) === marcados.length || marcados.length === grupos.length,
      { primeiro_sem_selo: grupos.findIndex(g => !g.negAtivo), marcados: marcados.length });

    let discordou = 0, exemploDiscordancia = null;
    for (const g of marcados) {
      const pa = ' ' + normOutroJeito(g.principio_ativo) + ' ';
      const d  = ' ' + normOutroJeito(g.negAtivo.descricao) + ' ';
      if (d.indexOf(pa) < 0) { discordou++; if (!exemploDiscordancia) exemploDiscordancia = { pa, d }; }
    }
    ok('2. *** o outro normalizador confirma TODOS os casamentos ***', discordou === 0,
      discordou ? exemploDiscordancia : discordou);

    ok('3. nenhum produto SEM princípio ativo recebeu selo',
      !marcados.some(g => !String(g.principio_ativo || '').trim()));

    ok('4. produto com EAN não está na lista (a pendência continua sendo pendência)',
      !grupos.some(g => g.ids.some(id => {
        const l = cot.find(c => c.id === id);
        return l && TELA._eanDigitos(l.ean);
      })));

    ok('5. o clique (quente) cabe na régua de 100 ms', quenteComSelo <= 100, quenteComSelo.toFixed(1) + ' ms');
    ok('6. ...e a B10 não é quem gasta: ela acrescenta menos de 15 ms',
      (quenteComSelo - quenteSemSelo) < 15, (quenteComSelo - quenteSemSelo).toFixed(1) + ' ms');

    ok('7. *** o selo aponta um item REAL do edital de um negócio ativo ***',
      marcados.every(g => g.negAtivo.numero_item != null && g.negAtivo.descricao
                       && porControle.has(g.negAtivo.controle)));

    // o contraste com a regra frouxa que foi REPROVADA — medido aqui, não citado de memória
    const palavras = new Set();
    for (const it of itens) for (const w of TELA._eanNormTexto(it.descricao).split(' ')) if (w.length >= 4) palavras.add(w);
    const frouxa = grupos.filter(g => {
      const p = TELA._eanNormTexto(g.principio_ativo);
      const w0 = p.split(' ').filter(w => w.length >= 4)[0];
      return !!w0 && palavras.has(w0);
    }).length;
    console.log(`\n  regra frouxa (só a 1ª palavra do princípio ativo) marcaria ${frouxa}`);
    console.log(`  a regra que está no ar (frase inteira) marca .................. ${marcados.length}`);
    console.log(`  ruído evitado ................................................. ${frouxa - marcados.length} produtos`);
    ok('8. a regra do ar é mais estrita que a frouxa (e o ruído está medido)', frouxa >= marcados.length,
      { frouxa, estrita: marcados.length });

    console.log(`\nRESULTADO: ${falhas ? falhas + ' FALHA(S)' : 'tudo conferido'}`);
    process.exitCode = falhas ? 1 : 0;
  } finally { await db.end(); }
})().catch(e => { console.error('ERRO: ' + e.message); process.exitCode = 1; });
