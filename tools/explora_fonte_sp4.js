/* Sondagem 4 da fatia A22 — onde o "Painel de Oportunidades" do compras.sp.gov.br busca o dado.
   Antes de escrever coletor é preciso achar a PORTA; e antes de achar a porta é preciso ler o
   robots. node tools/explora_fonte_sp4.js */
'use strict';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
async function pega(url, extra) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetch(url, { headers: Object.assign({ 'User-Agent': UA, Accept: 'text/html,application/json;q=0.9,*/*' }, extra || {}), signal: ac.signal });
    const txt = await r.text();
    return { http: r.status, tam: txt.length, corpo: txt, url: r.url, tipo: r.headers.get('content-type') || '' };
  } catch (e) { return { erro: e.name === 'AbortError' ? 'timeout' : String(e.message), causa: e.cause && e.cause.code }; }
  finally { clearTimeout(t); }
}

(async () => {
  console.log('SONDAGEM 4 — a porta do Painel de Oportunidades (compras.sp.gov.br)\n');

  const rb = await pega('https://compras.sp.gov.br/robots.txt');
  console.log('── robots.txt do compras.sp.gov.br (ele manda) ──');
  String(rb.corpo || '').split('\n').forEach(l => l.trim() && console.log('  ' + l.trim()));
  await pausa(1200);

  const p = await pega('https://compras.sp.gov.br/painel-de-oportunidades/');
  console.log('\n── o painel: de onde ele puxa o dado ──');
  const c = String(p.corpo || '');
  // endereços de API que a própria página declara
  const urls = [...new Set([...c.matchAll(/https?:\/\/[a-z0-9.\-]+\.(?:gov|org|com)\.br[^\s"'<>)]{0,120}/gi)].map(m => m[0]))];
  const apis = urls.filter(u => /api|json|service|rest|dados|consulta|oportunidade|pncp/i.test(u));
  console.log('  endereços com cara de porta de dados (' + apis.length + ' de ' + urls.length + '):');
  apis.slice(0, 20).forEach(u => console.log('      ' + u.slice(0, 130)));
  // iframes: painel de BI costuma ser embutido
  const ifr = [...c.matchAll(/<iframe[^>]+src="([^"]+)"/gi)].map(m => m[1]);
  console.log('  iframes (' + ifr.length + '):');
  ifr.slice(0, 6).forEach(u => console.log('      ' + u.slice(0, 130)));
  // texto visível: o painel diz de onde vem?
  const txt = c.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const m = txt.match(/.{0,140}(PNCP|Portal Nacional|BEC|integra).{0,140}/i);
  console.log('  o que a página diz sobre a origem:');
  console.log('      ' + (m ? m[0].trim().slice(0, 280) : '(não menciona PNCP nem BEC)'));

  await pausa(1200);
  const cp = await pega('https://compras.sp.gov.br/consulta-publica/');
  const t2 = String(cp.corpo || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  console.log('\n── a "consulta pública" do portal: o que ela é ──');
  console.log('      ' + t2.slice(0, 500).trim());

  console.log('\n>>> Nada coletado. Sondagem decide SE vale construir.');
})().catch(e => { console.error('ERRO ' + e.message); process.exit(1); });
