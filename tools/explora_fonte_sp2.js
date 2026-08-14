/* Sondagem 2 da fatia A22 — o que há DENTRO da porta da BEC/SP, e qual é o endereço real do
   portal de compras do estado. Mesmas muralhas: só consulta pública, ritmo educado, robots vale.
   node tools/explora_fonte_sp2.js */
'use strict';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const pausa = (ms) => new Promise(r => setTimeout(r, ms));
async function pega(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: ac.signal });
    const txt = await r.text();
    return { http: r.status, tam: txt.length, corpo: txt, url: r.url, tipo: r.headers.get('content-type') || '' };
  } catch (e) { return { erro: e.name === 'AbortError' ? 'timeout' : String(e.message), causa: e.cause && e.cause.code }; }
  finally { clearTimeout(t); }
}

(async () => {
  console.log('SONDAGEM 2 — o que a porta da BEC/SP realmente serve\n');

  // 1. o conteúdo da página de consulta (2130 bytes é pouco demais pra ser a lista)
  const r = await pega('https://www.bec.sp.gov.br/bec_pregao_UI/OE/pregao_oe_pesquisa.aspx');
  console.log('── página de consulta pública, conteúdo cru ──');
  console.log(String(r.corpo || '').replace(/\s+/g, ' ').slice(0, 1600));
  await pausa(1200);

  // 2. o portal do estado: qual é o endereço que resolve?
  console.log('\n── qual endereço do portal de compras do estado resolve ──');
  for (const u of [
    'https://compras.sp.gov.br/',
    'https://www.compras.sp.gov.br/',
    'https://portal.compras.sp.gov.br/',
    'https://www.bec.sp.gov.br/BECSP/Home/Home.aspx',
    'https://www.imprensaoficial.com.br/',
    'https://www.in.gov.br/consulta/-/buscar/dou?q=licitacao&s=do3&exactDate=all',
  ]) {
    const x = await pega(u);
    console.log('  ' + u.padEnd(64) + (x.erro ? 'ERRO ' + x.erro + (x.causa ? ' (' + x.causa + ')' : '')
      : x.http + ' · ' + x.tam + ' bytes · ' + (x.tipo.split(';')[0]) + (x.url !== u ? ' -> ' + x.url : '')));
    await pausa(1200);
  }

  // 3. o DOU tem API pública de consulta? (o in.gov.br publica JSON em /consulta)
  console.log('\n── o DOU (in.gov.br) tem porta de consulta que responde JSON? ──');
  for (const u of [
    'https://www.in.gov.br/robots.txt',
    'https://www.in.gov.br/consulta/-/buscar/dou?q=%22aviso%20de%20licita%C3%A7%C3%A3o%22%20medicamento&s=do3&exactDate=all&sortType=0',
  ]) {
    const x = await pega(u);
    if (x.erro) { console.log('  ' + u.slice(0, 70) + ' ERRO ' + x.erro); continue; }
    console.log('  ' + u.slice(0, 70) + ' -> ' + x.http + ' · ' + x.tam + ' bytes · ' + x.tipo.split(';')[0]);
    if (/robots/.test(u)) String(x.corpo).split('\n').slice(0, 20).forEach(l => l.trim() && console.log('      ' + l.trim()));
    else {
      // o in.gov.br embute o resultado num JSON dentro do HTML (params do componente)
      const m = String(x.corpo).match(/"jsonArray"\s*:\s*(\[[\s\S]{0,400})/);
      console.log('      tem jsonArray embutido? ' + (m ? 'SIM' : 'nao'));
      const tit = [...String(x.corpo).matchAll(/class="title-marker"[^>]*>([^<]{5,120})</g)].slice(0, 5);
      tit.forEach(t => console.log('      · ' + t[1].trim()));
    }
    await pausa(1200);
  }
  console.log('\n>>> Nada coletado. Sondagem decide SE vale construir.');
})().catch(e => { console.error('ERRO ' + e.message); process.exit(1); });
