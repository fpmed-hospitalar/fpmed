// SERVIDOR ESTÁTICO MÍNIMO — só para as provas de navegador rodarem sozinhas.
//
// 01/09/2026 (B37). Nasceu de uma prova que ficou vermelha sem nada ter mudado no código: as
// provas apontavam para um servidor local em 127.0.0.1:8099 que a OUTRA janela tinha subido, e
// quando ela fechou, a minha prova passou a dizer "0 ok, 1 falha" com um timeout de navegação.
//
// >>> É A MESMA DOENÇA QUE ESTA CASA JÁ NOMEOU DUAS VEZES: teste que fica vermelho por motivo
//     que não é o defeito ensina todo mundo a ignorar vermelho. E era pior que ruído — o
//     vermelho aqui NÃO distinguia "o lote quebrou" de "o servidor de outra pessoa fechou".
//     Prova que depende de um processo que ela não controla não é prova, é palpite com sorte.
//
// Ele serve o diretório do projeto e só ele: nada de listagem, nada de subir de pasta.
//
//   const { sobeSePreciso } = require('./servidor_estatico');
//   const srv = await sobeSePreciso('http://127.0.0.1:8099');   // reusa se já houver um de pé
//   ... ; await srv.fecha();
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const raiz = path.join(__dirname, '..');

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.pdf': 'application/pdf', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function responde(req, res) {
  let p;
  try { p = decodeURIComponent(url.parse(req.url).pathname); } catch { res.writeHead(400); return res.end(); }
  const alvo = path.join(raiz, p === '/' ? '/index.html' : p);
  // A trava do diretório: `..` no endereço não pode sair da raiz do projeto.
  if (!path.resolve(alvo).startsWith(path.resolve(raiz))) { res.writeHead(403); return res.end('fora da raiz'); }
  fs.stat(alvo, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, {'content-type':'text/plain; charset=utf-8'}); return res.end('não achei ' + p); }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream',
      'content-length': st.size, 'cache-control': 'no-store' });
    fs.createReadStream(alvo).pipe(res);
  });
}

function respondeEm(base) {
  return new Promise((ok) => {
    const r = http.get(base + '/fpmed_negocios.html', (res) => { res.resume(); ok(res.statusCode === 200); });
    r.on('error', () => ok(false));
    r.setTimeout(2500, () => { r.destroy(); ok(false); });
  });
}

// Reusa o servidor que já estiver de pé; se não houver, sobe um. `fecha()` só derruba o que ELE
// subiu — derrubar o processo de outra janela seria pior do que o problema que isto resolve.
async function sobeSePreciso(base) {
  if (await respondeEm(base)) return { base, proprio: false, fecha: async () => {} };
  const porta = Number((base.match(/:(\d+)/) || [, '8099'])[1]);
  const srv = http.createServer(responde);
  await new Promise((ok, erro) => { srv.once('error', erro); srv.listen(porta, '127.0.0.1', ok); });
  return { base, proprio: true, fecha: () => new Promise(ok => srv.close(ok)) };
}

module.exports = { sobeSePreciso, respondeEm };
