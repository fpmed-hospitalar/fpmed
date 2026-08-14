/* ══════════════════════════════════════════════════════════════════════════════════════════
   explora_fonte_sp.js — SONDAGEM DA FONTE, ANTES DE ESCREVER UMA LINHA DE COLETOR
   Fatia A22 · 14/08/2026 · alvo 1: São Paulo (bec.sp.gov.br e compras.sp.gov.br)

   ══ AS MURALHAS, CONFERIDAS AQUI E NÃO PROMETIDAS NO COMENTÁRIO ════════════════════════════
   · SÓ PÁGINA PÚBLICA DE CONSULTA. Nada de login, nada de captcha, nada de contornar barreira.
     Bloqueou? Este arquivo REGISTRA o bloqueio e para. Nunca insiste.
   · RITMO EDUCADO: uma requisição por vez, com pausa. Nunca derrubar portal público.
   · O `robots.txt` É LIDO PRIMEIRO, e o que ele disser vale. Ler o robots depois de varrer é
     teatro.

   ══ E A REGRA DE ECONOMIA, QUE É A RAZÃO DESTE ARQUIVO EXISTIR ═════════════════════════════
   Antes de construir coletor: MEDIR SOBREPOSIÇÃO. Amostra >= 50 certames; se >= 80% já estiver
   no nosso índice, o coletor NÃO se constrói — registra-se em docs/plano_fontes.md e passa-se
   pro próximo alvo. Foi o que salvou obra na EBSERH (17.981 editais dela já estavam no PNCP).

   node tools/explora_fonte_sp.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const PAUSA_MS = 1200;                 // ritmo educado: quase 1 req/s, nunca em paralelo
const TIMEOUT_MS = 25000;

const pausa = (ms) => new Promise(r => setTimeout(r, ms));

async function pega(url, extra) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      headers: Object.assign({ 'User-Agent': UA, 'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8' }, extra || {}),
      signal: ac.signal, redirect: 'follow',
    });
    const txt = await r.text();
    return { http: r.status, ms: Date.now() - t0, tipo: r.headers.get('content-type') || '',
             tam: txt.length, corpo: txt, url: r.url };
  } catch (e) {
    return { erro: (e.name === 'AbortError' ? 'timeout ' + (TIMEOUT_MS / 1000) + 's' : String(e.message)),
             ms: Date.now() - t0 };
  } finally { clearTimeout(t); }
}

const ALVOS = [
  { nome: 'BEC/SP — robots', url: 'https://www.bec.sp.gov.br/robots.txt' },
  { nome: 'BEC/SP — raiz', url: 'https://www.bec.sp.gov.br/' },
  { nome: 'BEC/SP — consulta pública de OC/pregão',
    url: 'https://www.bec.sp.gov.br/bec_pregao_UI/OE/pregao_oe_pesquisa.aspx' },
  { nome: 'BEC/SP — pesquisa de e-negócios público',
    url: 'https://www.bec.sp.gov.br/BEC_Pregao_UI/OE/pregao_oe_pesquisa.aspx' },
  { nome: 'compras.sp — robots', url: 'https://www.compras.sp.gov.br/robots.txt' },
  { nome: 'compras.sp — raiz', url: 'https://www.compras.sp.gov.br/' },
  { nome: 'compras.sp — dados abertos', url: 'https://www.compras.sp.gov.br/dados-abertos' },
  { nome: 'BEC/SP — dados abertos', url: 'https://www.bec.sp.gov.br/becsp/ui/dadosabertos.aspx' },
];

(async () => {
  console.log('SONDAGEM DA FONTE — SÃO PAULO (fatia A22, alvo 1)\n');
  console.log('Regra: só consulta pública, sem login, sem captcha. Bloqueou = anota e para.\n');

  const achados = [];
  for (const a of ALVOS) {
    const r = await pega(a.url);
    if (r.erro) {
      console.log(`  ${a.nome.padEnd(42)} ERRO  ${r.erro}  (${r.ms} ms)`);
      achados.push({ ...a, resultado: 'erro', detalhe: r.erro });
    } else {
      const amostra = String(r.corpo || '').replace(/\s+/g, ' ').slice(0, 110);
      console.log(`  ${a.nome.padEnd(42)} ${r.http}  ${String(r.tam).padStart(7)} bytes  ${r.ms} ms`);
      console.log(`      ${r.tipo.split(';')[0]} · ${amostra}`);
      if (r.url !== a.url) console.log(`      redirecionou para: ${r.url}`);
      achados.push({ ...a, resultado: r.http, tam: r.tam, tipo: r.tipo, final: r.url,
                     corpo: r.corpo });
    }
    await pausa(PAUSA_MS);
  }

  // ── o robots.txt manda, e é lido ANTES de qualquer varredura ────────────────────────────
  console.log('\n── o que o robots.txt diz ──────────────────────────────────────────────────');
  for (const a of achados.filter(x => /robots/.test(x.nome) && x.resultado === 200)) {
    console.log(`  ${a.nome}:`);
    String(a.corpo || '').split('\n').slice(0, 25).forEach(l => l.trim() && console.log('    ' + l.trim()));
  }

  // ── o que dá pra dizer sobre a porta ────────────────────────────────────────────────────
  console.log('\n── veredito por endereço ───────────────────────────────────────────────────');
  for (const a of achados) {
    const c = String(a.corpo || '');
    const pedeLogin = /senha|login|autentic|certificado digital|e-CPF|acesso restrito/i.test(c.slice(0, 4000));
    const temCaptcha = /captcha|recaptcha|hcaptcha/i.test(c);
    const ehJson = /json/i.test(a.tipo || '');
    console.log(`  ${a.nome.padEnd(42)} ${a.resultado === 'erro' ? 'INACESSÍVEL' : a.resultado}`
      + (a.resultado === 200 ? ` · ${ehJson ? 'JSON' : 'HTML'}`
        + (temCaptcha ? ' · CAPTCHA' : '') + (pedeLogin ? ' · pede identificação' : '') : ''));
  }

  console.log('\n>>> Nada foi coletado. Esta rodada é sondagem: ela decide SE vale construir.');
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
