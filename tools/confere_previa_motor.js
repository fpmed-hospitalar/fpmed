// Valida a PREVIA do porte do motor ANTES de gravar: sintaxe dos blocos <script>, referencias
// indefinidas nas fatias do motor, e um teste funcional minimo de busca.
//   node tools/confere_previa_motor.js [arquivo.html]
'use strict';
const fs = require('fs');
const ARQ = process.argv[2] || 'C:/fpmed/tools/_previa_giovana.html';
const html = fs.readFileSync(ARQ, 'utf8');
let erros = 0;

// ── 1. sintaxe de cada bloco <script> inline ──
{
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m, i = 0, ruins = 0;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/.test(m[1] || '')) continue;
    if (!m[2].trim()) continue;
    i++;
    try { new Function(m[2]); }
    catch (e) { ruins++; erros++; console.log('  ✗ bloco ' + i + ': ' + e.message); }
  }
  console.log((ruins ? '✗' : '✓') + ' sintaxe: ' + i + ' bloco(s), ' + ruins + ' com erro');
}

// ── 2. as fatias do motor carregam com o ambiente minimo? ──
const L = html.split(/\r?\n/);
function fatia(ini, fim) {
  const s = L.findIndex(x => x.includes(ini));
  let e = -1; for (let i = s + 1; i < L.length; i++) { if (L[i].includes(fim)) { e = i; break; } }
  return L.slice(s, e).join('\n');
}
let api = null;
try {
  api = (new Function(
    'let cotacoes=[];let _bmCmed=new Map();let _bmClasseB=new Set();let itens=[];\n'
    + 'let _packColunaAtual=null;let _marcasCache=null;let _marcasCacheTs=0;\n'
    + 'const SUPA_URL="https://x";const SUPA_KEY="k";console.warn=function(){};\n'
    + 'function renderItens(){}\n'
    + fatia('function _undNum(und)', 'let searchTO') + '\n'
    + fatia('const _bmStrip = s =>', 'busca antiga') + '\n'
    + 'return { buscarMelhorProduto, pv, incluiNaBusca, _bmDoses, _bmDiscrimConflito, _bmIdxCandidatos,'
    + ' _portao: typeof _portaoQualidade === "function", setCot:function(a){cotacoes=a;_bmIdx=null;} };'))();
  console.log('✓ as duas fatias do motor carregam com o ambiente minimo');
} catch (e) { erros++; console.log('✗ fatias NAO carregam: ' + e.message); }

// ── 3. teste funcional: o motor porta as melhorias de verdade? ──
if (api) {
  const R = (produto, pa, o) => Object.assign({ id: produto, produto, principio_ativo: pa || '', und: '',
    compra_unit: '10', compra_caixa: '', global_venda1: '', tipo: 'fornecedor', fornecedor: 'X',
    estoque: '5' }, o || {});
  const casos = [
    ['dose em UI nao vira quantidade', () => {
      const s = [...api._bmDoses('BENZATACIL 1.200.000 UI')];
      return s.length === 1 && s[0] === '1200000UI'; }],
    ['aritmetica: 2% == 20MG/ML', () => [...api._bmDoses('CETOCONAZOL 2%')][0] === '20MG/ML'],
    ['aritmetica: 250MG/5ML == 50MG/ML', () => [...api._bmDoses('CEFALEXINA 250MG/5ML')][0] === '50MG/ML'],
    ['associacao 50/12,5MG sao DUAS doses', () => api._bmDoses('LOSARTANA HCTZ 50/12,5MG').size === 2],
    ['barreira do calibre existe', () => api._bmDiscrimConflito('LAMINA BISTURI N 15', 'LAMINA BISTURI N.23') === true],
    ['indice devolve candidatos', () => { api.setCot([R('DIPIRONA 500MG CX10', 'DIPIRONA')]);
      const c = api._bmIdxCandidatos('dipirona', null, [], null); return !!c && c.length === 1; }],
    ['preco de caixa sem pack nao vira unitario', () => api.pv(R('X SEM PACK NO NOME', '', { compra_unit: null, compra_caixa: '400' })) === 0],
    ['venda_unit_forn (FPMED) preservado', () => Math.abs(api.pv(R('Y', '', { compra_unit: null, compra_caixa: null, venda_unit_forn: '7.50' })) - 7.5) < 0.001],
    ['busca casa o produto certo', () => { api.setCot([R('DIPIRONA 500MG/ML AMP 2ML CX100', 'DIPIRONA'), R('DIPIRONA 500MG CX10 CPR', 'DIPIRONA')]);
      const r = api.buscarMelhorProduto('DIPIRONA SODICA 500MG/ML AMPOLA 2ML'); return !!r && /AMP 2ML/.test(r.produto); }],
    ['mono nao recebe combo', () => { api.setCot([R('LOSARTANA POTASSICA HIDROCLOROTIAZIDA 50/12,5MG C/30', '')]);
      return api.buscarMelhorProduto('HIDROCLOROTIAZIDA 12,5MG CPR') === null; }],
  ];
  let ok = 0;
  casos.forEach(([nome, fn]) => { let r = false; try { r = !!fn(); } catch (e) { r = false; }
    if (r) ok++; else { erros++; console.log('  ✗ ' + nome); } });
  console.log((ok === casos.length ? '✓' : '✗') + ' funcional: ' + ok + ' de ' + casos.length + ' melhorias presentes e funcionando');
}

console.log(erros ? '\n>>> ' + erros + ' PROBLEMA(S)' : '\n>>> PREVIA OK');
process.exitCode = erros ? 1 : 0;
