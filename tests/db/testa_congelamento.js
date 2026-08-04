// GUARD DO MARCO DE CONGELAMENTO — compliance de proteção de dados (COMPLIANCE.md).
// Precisa de banco, então roda separado da suíte offline:  node tests/db/testa_congelamento.js
//
// A REGRA: em 04/08/2026 as cotações herdadas da GlobalMed foram CONGELADAS em 20.857 linhas
// (fornecedor <> '1'). A partir daí, a base da FPMED só cresce por meios próprios.
// Este guard falha se esse número subir — o que significaria que alguém trouxe dado de lá
// de novo, apesar da trava de abort no sync.
//
// ⚠️ Crescimento LEGÍTIMO existe: cotação que a própria FPMED recebeu do fornecedor e importou.
// Por isso o guard não proíbe crescer — ele EXIGE que o crescimento esteja registrado abaixo,
// com origem. Número que sobe sem registro = alerta.
'use strict';
const fs = require('fs');
const path = require('path');

// ── MARCO OFICIAL (não editar sem atualizar o COMPLIANCE.md) ──
const CONGELAMENTO = {
  data: '2026-08-04',
  herdadas_distribuidor: 20857,   // fornecedor <> '1' no momento do congelamento
  estoque_proprio: 1381,          // fornecedor = '1' (Pasta1.xlsx da própria FPMED)
  total: 22238,
};

// ── crescimento autorizado DEPOIS do congelamento (cada linha exige origem própria) ──
// Formato: { data, linhas, origem }  — ex.: import de planilha recebida de fornecedor da FPMED.
const CRESCIMENTO_AUTORIZADO = [
  // { data: '2026-08-10', linhas: 320, origem: 'planilha SUPERMEDICA recebida por e-mail pela FPMED' },
];
const autorizado = CRESCIMENTO_AUTORIZADO.reduce((s, x) => s + x.linhas, 0);

const RAIZ = path.join(__dirname, '..', '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const SR = seg.match(/SERVICE_ROLE\s*[:=]\s*(eyJ[A-Za-z0-9._-]+)/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

let p = 0, f = 0;
const ok = (n, c, extra) => { if (c) { p++; console.log('  ok   ' + n); } else { f++; console.log('  FALHA ' + n + (extra ? ' -> ' + extra : '')); } };

async function conta(filtro) {
  const r = await fetch(`${SB}/rest/v1/cotacoes?select=id&${filtro}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  return Number((r.headers.get('content-range') || '/0').split('/')[1]);
}

(async () => {
  console.log('\n=== GUARD DO CONGELAMENTO (COMPLIANCE.md) ===\n');
  const herdadas = await conta('fornecedor=neq.1');
  const proprio = await conta('fornecedor=eq.1');
  const teto = CONGELAMENTO.herdadas_distribuidor + autorizado;

  console.log(`  marco ${CONGELAMENTO.data}: herdadas ${CONGELAMENTO.herdadas_distribuidor} · proprio ${CONGELAMENTO.estoque_proprio}`);
  console.log(`  hoje:              herdadas ${herdadas} · proprio ${proprio}`);
  console.log(`  crescimento autorizado registrado: ${autorizado}\n`);

  ok(`linhas herdadas nao passaram do teto (${teto})`, herdadas <= teto,
     `hoje=${herdadas}, excedente NAO REGISTRADO=${herdadas - teto}`);
  ok('nenhuma linha de distribuidor marcada como estoque proprio da Global',
     (await conta("fornecedor=neq.1&tipo=eq.global")) === 0);
  ok('estoque proprio segue sendo da FPMED (nao encolheu sem registro)',
     proprio >= CONGELAMENTO.estoque_proprio, `hoje=${proprio}`);

  if (herdadas > teto) {
    console.log('\n  ⚠️  Se o crescimento for LEGITIMO (import proprio da FPMED), registre em');
    console.log('      CRESCIMENTO_AUTORIZADO neste arquivo, com data e origem. Se nao for,');
    console.log('      alguem trouxe dado da GlobalMed — investigar antes de qualquer coisa.');
  }
  console.log(`\n${p} ok, ${f} falha(s)`);
  console.log(f ? '>>> VERMELHO' : '>>> TUDO VERDE');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
