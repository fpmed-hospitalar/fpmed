/* Sondagem 3 da fatia A22 — compras.sp.gov.br (o que responde), diários municipais e Sistema S.
   Mesmas muralhas: só consulta pública, sem login, sem captcha, robots manda, ritmo educado.
   node tools/explora_fonte_sp3.js */
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
const IMPERVA = (c) => /Pardon Our Interruption|_Incapsula_|imperva/i.test(String(c || '').slice(0, 4000));
const CAPTCHA = (c) => /recaptcha|hcaptcha|g-recaptcha/i.test(String(c || ''));

async function linha(nome, url, extra) {
  const x = await pega(url, extra);
  if (x.erro) { console.log('  ' + nome.padEnd(46) + 'ERRO ' + x.erro + (x.causa ? ' (' + x.causa + ')' : '')); await pausa(1200); return x; }
  const marca = (IMPERVA(x.corpo) ? ' · MURALHA(Imperva)' : '') + (CAPTCHA(x.corpo) ? ' · CAPTCHA' : '')
    + (/json/i.test(x.tipo) ? ' · JSON' : '');
  console.log('  ' + nome.padEnd(46) + x.http + ' · ' + String(x.tam).padStart(7) + ' b · '
    + x.tipo.split(';')[0] + marca + (x.url !== url ? '\n      -> ' + x.url : ''));
  await pausa(1200);
  return x;
}

(async () => {
  console.log('SONDAGEM 3 — compras.sp.gov.br, diários municipais e Sistema S\n');

  console.log('── 1. o portal de compras do estado de São Paulo ──');
  const raiz = await linha('compras.sp.gov.br (raiz)', 'https://compras.sp.gov.br/');
  await linha('compras.sp — robots', 'https://compras.sp.gov.br/robots.txt');
  if (raiz && raiz.corpo) {
    /* O QUE A PRÓPRIA PÁGINA APONTA é melhor que endereço que eu chutar: os links dela dizem
       onde mora a consulta pública, e chutar caminho é como se descobre um 404 achando que
       descobriu uma muralha. */
    const hrefs = [...String(raiz.corpo).matchAll(/href="([^"]{4,140})"/g)].map(m => m[1]);
    const bons = [...new Set(hrefs.filter(h => /pesquis|consult|licit|consulta-publica|edital|oportunidade|aberto/i.test(h)))];
    console.log('  links de consulta que a própria página oferece (' + bons.length + '):');
    bons.slice(0, 14).forEach(h => console.log('      ' + h.slice(0, 120)));
    for (const h of bons.slice(0, 4)) {
      const u = h.startsWith('http') ? h : 'https://compras.sp.gov.br' + (h.startsWith('/') ? '' : '/') + h;
      await linha('  ' + h.slice(0, 40), u);
    }
  }

  console.log('\n── 2. diários oficiais municipais (as associações estaduais) ──');
  for (const [nome, u] of [
    ['DOU (in.gov.br) robots', 'https://www.in.gov.br/robots.txt'],
    ['diariomunicipal.sc.gov.br (FECAM/SC)', 'https://www.diariomunicipal.sc.gov.br/'],
    ['diariomunicipal.com.br (AMUPE etc) robots', 'https://www.diariomunicipal.com.br/robots.txt'],
    ['diariomunicipal.com.br — raiz', 'https://www.diariomunicipal.com.br/'],
    ['diariomunicipal.sc.gov.br — robots', 'https://www.diariomunicipal.sc.gov.br/robots.txt'],
  ]) {
    const x = await linha(nome, u);
    if (/robots/.test(nome) && x && x.corpo && x.http === 200) {
      String(x.corpo).split('\n').slice(0, 12).forEach(l => l.trim() && console.log('      | ' + l.trim()));
    }
  }

  console.log('\n── 3. Sistema S (SESI/SENAI) — portal de fornecedores, consulta pública ──');
  for (const [nome, u] of [
    ['SESI/SENAI compras (robots)', 'https://compras.sesisenai.org.br/robots.txt'],
    ['SESI/SENAI compras (raiz)', 'https://compras.sesisenai.org.br/'],
    ['Licitações SENAI DN', 'https://www.portaldaindustria.com.br/senai/canais/licitacoes/'],
    ['Compras Sistema S (fiesp/sp)', 'https://www.sesisp.org.br/licitacoes'],
  ]) {
    const x = await linha(nome, u);
    if (/robots/.test(nome) && x && x.corpo && x.http === 200) {
      String(x.corpo).split('\n').slice(0, 12).forEach(l => l.trim() && console.log('      | ' + l.trim()));
    }
  }

  console.log('\n>>> Nada coletado. Sondagem decide SE vale construir.');
})().catch(e => { console.error('ERRO ' + e.message); process.exit(1); });
