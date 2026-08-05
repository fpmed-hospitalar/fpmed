// ═══════════════════════════════════════════════════════════════════════════════
// SEMEIA A(S) EMPRESA(S) DO CLIENTE na tabela `empresas`, lendo do cliente.config.js
// Item 9 (funil de Negocios), 05/08/2026. Decisao do Lemuel.
//
// Uso:  node tools/semeia_empresa.js            -> PREVIEW (nada gravado)
//       node tools/semeia_empresa.js --apply    -> INSERT das que ainda nao existem
//
// POR QUE ESTE TOOL EXISTE: no SIGA o cliente cadastra a propria empresa numa tela. Aqui a
// decisao foi que ela JA NASCE CADASTRADA — o cliente nao abre o sistema numa tela vazia
// pedindo "adicione sua empresa", porque esse dado veio no cadastro dele e quem instala o
// sistema ja tem como preencher.
//
// A FONTE DA VERDADE E O cliente.config.js, nao o banco. E o unico arquivo que o cria_cliente
// escreve, entao instalacao nova nasce com a empresa certa sem ninguem lembrar de nada. Este
// tool so materializa aquilo no banco, pra que o funil consiga fazer join e filtrar por empresa
// sem depender de JS carregado.
//
// NAO E DESTRUTIVO: insere so o que falta, comparando pelo CNPJ so-digitos. Empresa que ja
// existe e PULADA, nunca sobrescrita — mudar razao social de empresa ja cadastrada e decisao
// de negocio (muda o que sai no documento), nao efeito colateral de um seeder.
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');

// carrega o config do cliente + a logica do molde num escopo isolado (sem window/document)
function carregaConfig() {
  const raiz = path.join(__dirname, '..');
  const cfgSrc = fs.readFileSync(path.join(raiz, 'cliente.config.js'), 'utf8');
  const libSrc = fs.readFileSync(path.join(raiz, 'limedtec-config.js'), 'utf8');
  const win = {};
  new Function('window', 'document', 'module', cfgSrc + '\n' + libSrc)(win, undefined, undefined);
  return win.LIMEDTEC;
}

const soDigitos = s => String(s == null ? '' : s).replace(/[^0-9]/g, '');
// Valida o DV do CNPJ. Nao e preciosismo: CNPJ errado no badge do funil e no filtro por empresa
// significa o sistema afirmando uma identidade juridica que nao existe. Melhor recusar a semear.
function cnpjValido(cnpj) {
  const c = soDigitos(cnpj);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base, pesos) => {
    let s = 0;
    for (let i = 0; i < pesos.length; i++) s += parseInt(base[i], 10) * pesos[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(c, [5,4,3,2,9,8,7,6,5,4,3,2]);
  const d2 = dv(c, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return d1 === parseInt(c[12], 10) && d2 === parseInt(c[13], 10);
}

module.exports = { soDigitos, cnpjValido };
if (require.main !== module) return;

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
if (!SR) { console.error('service_role nao encontrada'); process.exit(1); }
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

(async () => {
  console.log(APPLY ? '[APPLY]' : '[PREVIEW — nada e gravado]');
  const L = carregaConfig();
  const doConfig = L.empresas();
  if (!doConfig.length) {
    console.error('\nO cliente.config.js nao tem `empresas`. Nada a semear.');
    console.error('Sem empresa cadastrada o funil mostra card sem dono — preencher o config antes.');
    process.exit(1);
  }
  console.log(`empresas no cliente.config.js: ${doConfig.length}`);

  // valida ANTES de olhar o banco: dado ruim nao chega perto do insert
  const invalidas = doConfig.filter(e => !e.razaoSocial || !cnpjValido(e.cnpj));
  if (invalidas.length) {
    console.error('\nRECUSADO — empresa com razao social vazia ou CNPJ invalido (DV nao confere):');
    invalidas.forEach(e => console.error(`  ${e.razaoSocial || '(sem razao social)'} · ${e.cnpj || '(sem cnpj)'}`));
    console.error('CNPJ errado no badge do funil e o sistema afirmando uma identidade que nao existe.');
    process.exit(1);
  }
  const principais = doConfig.filter(e => e.principal);
  if (principais.length > 1) {
    console.error(`\nRECUSADO — ${principais.length} empresas marcadas como \`principal\`. So pode haver uma.`);
    process.exit(1);
  }
  if (!principais.length) console.log('AVISO: nenhuma marcada como `principal` — a primeira sera usada como padrao.');

  const r0 = await fetch(`${SB}/rest/v1/empresas?select=id,razao_social,cnpj,cnpj_norm,principal`, { headers: H });
  if (r0.status === 404 || r0.status === 400) {
    console.error('\ntabela empresas nao existe — rodar antes: node tools/roda_sql.js --arquivo ddl/empresas.sql');
    process.exit(1);
  }
  const jaTem = await r0.json();
  const existentes = new Set((jaTem || []).map(e => e.cnpj_norm));
  console.log(`empresas ja no banco: ${jaTem.length}`);

  const faltam = doConfig.filter(e => !existentes.has(soDigitos(e.cnpj)));
  const pulados = doConfig.length - faltam.length;

  console.log('\n── PREVIEW ────────────────────────────────────────────');
  console.log(`a inserir ... ${faltam.length}`);
  faltam.forEach(e => console.log(`   + ${e.razaoSocial}  ·  ${e.cnpj}  ·  ${e.cidade || '—'}/${e.uf || '—'}${e.principal ? '  [PRINCIPAL]' : ''}`));
  if (pulados) {
    console.log(`ja existiam (PULADAS, nunca sobrescritas) ... ${pulados}`);
    doConfig.filter(e => existentes.has(soDigitos(e.cnpj))).forEach(e => console.log(`   = ${e.razaoSocial}  ·  ${e.cnpj}`));
  }

  if (!APPLY) { console.log('\nPreview OK. Gravar com --apply.'); return; }
  if (!faltam.length) { console.log('\nnada a inserir — o banco ja esta em dia com o config.'); return; }

  const linhas = faltam.map(e => ({
    razao_social: e.razaoSocial, cnpj: e.cnpj, ie: e.ie || null,
    cidade: e.cidade || null, uf: e.uf || null, principal: !!e.principal,
  }));
  const r = await fetch(`${SB}/rest/v1/empresas`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(linhas) });
  if (!r.ok) { console.error('ERRO: ' + r.status + ' ' + (await r.text()).slice(0, 240)); process.exit(1); }
  const criadas = await r.json();
  console.log(`\ngravadas: ${criadas.length}`);
  criadas.forEach(e => console.log(`   #${e.id}  ${e.razao_social}  ·  ${e.cnpj}${e.principal ? '  [PRINCIPAL]' : ''}`));
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
