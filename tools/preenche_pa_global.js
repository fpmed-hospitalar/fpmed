// Preenche principio_ativo das linhas de ESTOQUE PROPRIO (fornecedor='1') que estao sem PA.
//   node tools/preenche_pa_global.js            -> PREVIEW (nada gravado)
//   node tools/preenche_pa_global.js --gravar   -> grava (SO com OK do Lemuel)
//
// POR QUE ASSIM: a FPMED nao tem a tabela cmed_pf (Bloco 3 do sync, nao portado) e a
// cmed_dicionario esta VAZIA — por isso o resolvePA do app devolve nada e o import deixou o
// campo NULL. A fonte de verdade disponivel aqui e o proprio banco: 3.738 linhas de
// distribuidor JA tem principio_ativo, formando um vocabulario de ~938 PAs reais.
//
// REGRA DE OURO: nao inventa PA. So grava quando casa contra esse vocabulario, em 2 camadas
// de confianca. O que nao casar fica NULL e sai listado — melhor vazio que errado, porque PA
// errado vira comparacao de preco errada na Competitividade.
'use strict';
const fs = require('fs');

const GRAVAR = process.argv.includes('--gravar');
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const SR = seg.match(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

// --- funcoes REAIS da tela (mesma normalizacao que a Competitividade usa) ---
const src = fs.readFileSync('C:/fpmed/fpmed_sistema_final.html', 'utf8');
function fn(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + nome + '\\s*\\(').exec(src);
  if (!m) throw new Error('nao achei ' + nome);
  let i = src.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') n++;
    else if (src[j] === '}') { n--; if (!n) return src.slice(m.index, j + 1); }
  }
  throw new Error('chave nao fechou: ' + nome);
}
function konst(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:var|const|let)\\s+' + nome + '\\s*=[^;]*;').exec(src);
  if (!m) throw new Error('nao achei const ' + nome);
  return m[0];
}
const ctx = (new Function(`
  ${konst('CPZ_SALT')} ${konst('_GM_SAL_RE')}
  ${fn('normPA')} ${fn('_gmNorm')} ${fn('doseKey')} ${fn('_cpzPaNorm')}
  return { normPA, _gmNorm, doseKey, _cpzPaNorm };
`))();

const { _gmNorm, doseKey, _cpzPaNorm } = ctx;
const limpaPrefixo = s => String(s == null ? '' : s).replace(/^[*#+>&@.\s]+/, '');

async function tudo(filtro, cols) {
  let out = [], off = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/cotacoes?select=${cols}&${filtro}&limit=1000&offset=${off}`, { headers: H });
    const d = await r.json();
    if (!Array.isArray(d) || !d.length) break;
    out = out.concat(d); if (d.length < 1000) break; off += 1000;
  }
  return out;
}

(async () => {
  console.log('\n══ PREENCHER principio_ativo do estoque proprio ══  modo: ' +
              (GRAVAR ? 'GRAVAR' : 'PREVIEW (nada sera gravado)') + '\n');

  const glob = await tudo('fornecedor=eq.1', 'id,produto,principio_ativo,marca');
  const conc = await tudo('fornecedor=neq.1&principio_ativo=not.is.null', 'produto,principio_ativo');
  const alvo = glob.filter(g => !g.principio_ativo || !String(g.principio_ativo).trim());
  console.log(`estoque proprio: ${glob.length} linhas · sem PA: ${alvo.length}`);
  console.log(`vocabulario: ${conc.length} linhas de distribuidor com PA\n`);

  // --- vocabulario de PAs conhecidos (normalizado -> grafia canonica mais frequente) ---
  const freq = new Map();                       // paNorm -> Map(grafia -> n)
  for (const c of conc) {
    const pa = String(c.principio_ativo || '').trim();
    if (!pa) continue;
    const k = _cpzPaNorm(pa);
    if (k.length < 3) continue;
    if (!freq.has(k)) freq.set(k, new Map());
    const g = freq.get(k);
    g.set(pa, (g.get(pa) || 0) + 1);
  }
  const canonico = new Map();                   // paNorm -> grafia vencedora
  for (const [k, g] of freq) {
    canonico.set(k, [...g.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }

  // --- camada A: mesmo PRODUTO (nome normalizado) ja cotado por distribuidor com PA ---
  const porProduto = new Map();                 // nomeNorm -> PA canonico
  for (const c of conc) {
    const n = _gmNorm(limpaPrefixo(c.produto));
    if (!n) continue;
    const pa = String(c.principio_ativo || '').trim();
    if (!pa || !porProduto.has(n)) porProduto.set(n, pa);
  }

  // --- camada B: token(s) do nome batem num PA do vocabulario ---
  function porNome(nome) {
    const n = _gmNorm(limpaPrefixo(nome));
    if (!n) return null;
    const cands = [];
    (String(nome || '').match(/\(([^)]*)\)/g) || []).forEach(x => {      // conteudo de parenteses (marca/sinonimo)
      const t = x.replace(/[()]/g, '');
      if (t.indexOf('+') < 0) { const q = _cpzPaNorm(t); if (q.length >= 4) cands.push(q); }
    });
    const w = n.split(' ').filter(s => s.length >= 3);
    if (w[0] && w[1]) cands.push(_cpzPaNorm(w[0] + ' ' + w[1]));         // 2 tokens antes de 1 (mais especifico)
    if (w[0]) cands.push(_cpzPaNorm(w[0]));
    for (const c of cands) if (c.length >= 4 && canonico.has(c)) return canonico.get(c);
    return null;
  }

  const plano = [];
  const contas = { A: 0, B: 0, nao: 0 };
  const naoResolvidos = [];
  for (const g of alvo) {
    const nomeN = _gmNorm(limpaPrefixo(g.produto));
    let pa = porProduto.get(nomeN) || null, via = 'A';
    if (!pa) { pa = porNome(g.produto); via = 'B'; }
    if (!pa) { contas.nao++; if (naoResolvidos.length < 8) naoResolvidos.push(g.produto.slice(0, 58)); continue; }
    contas[via]++;
    plano.push({ id: g.id, pa, via, produto: g.produto });
  }

  console.log('── RESOLUCAO ──');
  console.log(`  A) mesmo produto ja cotado por distribuidor ... ${contas.A}`);
  console.log(`  B) nome bate num PA do vocabulario ........... ${contas.B}`);
  console.log(`  nao resolvido (fica NULL, nao chuta) ......... ${contas.nao}`);
  console.log(`  TOTAL a gravar: ${plano.length}\n`);
  console.log('  amostra A: ' + plano.filter(p => p.via === 'A').slice(0, 3).map(p => `${p.produto.slice(0,42)} -> ${p.pa}`).join(' | '));
  console.log('  amostra B: ' + plano.filter(p => p.via === 'B').slice(0, 3).map(p => `${p.produto.slice(0,42)} -> ${p.pa}`).join(' | '));
  console.log('  nao resolvidos (amostra): ' + naoResolvidos.join(' | ') + '\n');

  // --- projecao: quantos passam a formar chave da Competitividade ---
  const chavesC = new Set();
  for (const c of conc) {
    const p = _cpzPaNorm(c.principio_ativo || ''), d = doseKey(c.produto || '');
    if (p.length >= 3 && d) chavesC.add(p + '|' + d);
  }
  let comChave = 0, comConcorrente = 0;
  for (const p of plano) {
    const pk = _cpzPaNorm(p.pa), dk = doseKey(p.produto || '');
    if (pk.length >= 3 && dk) { comChave++; if (chavesC.has(pk + '|' + dk)) comConcorrente++; }
  }
  console.log('── PROJECAO NA COMPETITIVIDADE ──');
  console.log(`  formam chave (PA + dose) .................... ${comChave}`);
  console.log(`  E tem concorrente cotando a mesma chave ..... ${comConcorrente}  <-- entram na tela\n`);

  if (!GRAVAR) {
    console.log('PREVIEW encerrado — nada gravado. Para gravar: node tools/preenche_pa_global.js --gravar\n');
    return;
  }

  // --- BACKUP antes de qualquer escrita ---
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const dir = 'C:/fpmed/backups';
  fs.mkdirSync(dir, { recursive: true });
  const arq = `${dir}/backup_pa_global_${stamp}.json`;
  fs.writeFileSync(arq, JSON.stringify({ quando: stamp, antes: glob }, null, 1));
  console.log(`BACKUP das ${glob.length} linhas em: ${arq}\n`);

  // --- PATCH por id (nunca em massa) ---
  let ok = 0, erro = 0;
  for (const p of plano) {
    const r = await fetch(`${SB}/rest/v1/cotacoes?id=eq.${p.id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ principio_ativo: p.pa }) });
    if (r.status === 204) ok++;
    else { erro++; if (erro <= 3) console.log(`  erro id=${p.id}: HTTP ${r.status} ${(await r.text()).slice(0,90)}`); }
    if (ok % 200 === 0 && ok) console.log(`  ...${ok}/${plano.length}`);
  }
  console.log(`\nGRAVADO: ${ok} linhas · erros: ${erro}`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
