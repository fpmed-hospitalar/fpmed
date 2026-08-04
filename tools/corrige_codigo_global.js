// Repoe os zeros a esquerda no codigo das linhas de estoque proprio (fornecedor='1').
//   node tools/corrige_codigo_global.js            -> PREVIEW
//   node tools/corrige_codigo_global.js --gravar   -> grava (SO com OK do Lemuel)
//
// O import de 04/08 gravou a CHAVE DE COMPARACAO (sem zero) no lugar do codigo do ERP:
// 0000010 virou 10 em 1.381 linhas. Aqui o zero volta.
// PROVA DE IDA E VOLTA: cada codigo corrigido tem que EXISTIR na planilha original.
// Se algum nao existir, o script PARA e nao grava nada.
'use strict';
const fs = require('fs');
const { normCodigo, lerEstoque } = require('./le_estoque_fpmed');

const GRAVAR = process.argv.includes('--gravar');
const PLANILHA = 'C:/fpmed/Pasta1.xlsx';
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const SR = seg.match(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

(async () => {
  console.log('\n══ Repor zeros no codigo do estoque proprio ══  modo: ' +
              (GRAVAR ? 'GRAVAR' : 'PREVIEW (nada sera gravado)') + '\n');

  let linhas = [], off = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/cotacoes?select=id,codigo,produto&fornecedor=eq.1&limit=1000&offset=${off}`, { headers: H });
    const d = await r.json();
    if (!Array.isArray(d) || !d.length) break;
    linhas = linhas.concat(d); if (d.length < 1000) break; off += 1000;
  }
  console.log(`estoque proprio no banco: ${linhas.length} linhas`);

  const daPlanilha = new Set(lerEstoque(PLANILHA).linhas.map(x => x.codigo));
  console.log(`codigos distintos na planilha: ${daPlanilha.size}\n`);

  const plano = [], jaOk = [], forasteiros = [];
  for (const l of linhas) {
    const novo = normCodigo(l.codigo);
    if (novo === String(l.codigo || '')) { jaOk.push(l); continue; }
    if (!daPlanilha.has(novo)) { forasteiros.push({ id: l.id, de: l.codigo, para: novo, produto: l.produto }); continue; }
    plano.push({ id: l.id, de: l.codigo, para: novo });
  }

  console.log('── PLANO ──');
  console.log(`  ja corretos (nao mexe) ............. ${jaOk.length}`);
  console.log(`  a corrigir (confirmados na planilha) ${plano.length}`);
  console.log(`  SEM par na planilha (nao mexe) ..... ${forasteiros.length}`);
  console.log('  amostra: ' + plano.slice(0, 5).map(p => `${p.de} -> ${p.para}`).join(' · ') + '\n');

  if (forasteiros.length) {
    console.log('  ⚠ codigos sem par na planilha (ficam como estao):');
    forasteiros.slice(0, 10).forEach(f => console.log(`     id=${f.id} ${f.de} -> ${f.para}?  ${String(f.produto).slice(0, 46)}`));
    console.log('');
  }

  if (!GRAVAR) { console.log('PREVIEW encerrado — nada gravado. Para gravar: --gravar\n'); return; }
  if (!plano.length) { console.log('nada a fazer.\n'); return; }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  fs.mkdirSync('C:/fpmed/backups', { recursive: true });
  const arq = `C:/fpmed/backups/backup_codigo_global_${stamp}.json`;
  fs.writeFileSync(arq, JSON.stringify({ quando: stamp, antes: linhas }, null, 1));
  console.log(`BACKUP das ${linhas.length} linhas em: ${arq}\n`);

  let ok = 0, erro = 0;
  for (const p of plano) {
    const r = await fetch(`${SB}/rest/v1/cotacoes?id=eq.${p.id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ codigo: p.para }) });
    if (r.status === 204) ok++;
    else { erro++; if (erro <= 3) console.log(`  erro id=${p.id}: HTTP ${r.status} ${(await r.text()).slice(0, 90)}`); }
    if (ok && ok % 300 === 0) console.log(`  ...${ok}/${plano.length}`);
  }
  console.log(`\nGRAVADO: ${ok} · erros: ${erro}`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
