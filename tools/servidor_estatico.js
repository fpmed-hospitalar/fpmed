/* ══════════════════════════════════════════════════════════════════════════════════════════════
   tools/servidor_estatico.js — SERVIDOR ESTÁTICO DO PRÓPRIO PROJETO, para medir na tela pintada.

   POR QUE ELE EXISTE (fatia B21, 15/08/2026):
   O Playwright chegou e a caixa manda medir o que só a tela responde. Abrir a tela por
   `file://` não serve: a origem vira `null`, o `fetch` para o Supabase morre em CORS e o
   `localStorage` fica preso a um balde diferente do da URL pública — ou seja, mediríamos uma
   tela que não é a nossa. Um servidor HTTP local dá origem de verdade (`http://127.0.0.1`),
   e é a coisa mais simples que resolve.

   >>> É SÓ O NOSSO SISTEMA, e isso está travado no código: a raiz é C:\fpmed e todo caminho é
       resolvido e CONFERIDO contra a raiz antes de abrir (a trava está no `servir`).
       Servidor de arquivo que aceita `..` entrega o disco inteiro para quem pedir.
   >>> Escuta em 127.0.0.1, nunca em 0.0.0.0: o que é para medir aqui não fica exposto na rede.
   >>> NÃO tem cache: `Cache-Control: no-store`. Medir a tela de ontem por causa de cache é a
       forma mais boba de um número mentir.
   >>> O NOME NÃO É `servidor_local.js` de propósito: o `.gitignore` da casa tem `*_local.js`
       (linha 64), para segurar configuração de máquina fora do repo público. Ferramenta que
       precisa ser versionada não pode se chamar como as que não podem ser.

   USO:  node tools/servidor_estatico.js [porta]        (padrão 8123)

   ── ACRESCENTADO NA B37 (01/09/2026): ELE TAMBÉM VIROU MÓDULO ────────────────────────────────
   Nada do que está acima mudou, e o modo linha de comando continua idêntico — `prova_frescor`,
   `prova_telemetria`, `prova_busca_sem_portal`, `medidor_tela` e `roda_medicao_tela` sobem este
   arquivo com `spawn(node, [ele, porta])` e continuam subindo.

   >>> O QUE FALTAVA, E ME MORDEU: as provas de navegador da B36b/B37 apontavam para um servidor
       que a OUTRA janela tinha subido. Quando aquela janela fechou, a minha prova passou a dizer
       "0 ok, 1 falha" com timeout de navegação — um vermelho que NÃO distingue "o lote quebrou"
       de "o servidor de outra pessoa fechou". Prova que depende de um processo que ela não
       controla não é prova, é palpite com sorte.
   >>> ENTÃO ELE GANHOU `sobeSePreciso(base)`: reusa o servidor que já estiver de pé e, se não
       houver, sobe um NO MESMO PROCESSO (sem `spawn`, sem processo órfão se a prova estourar).
       O `fecha()` só derruba o que ELE subiu — derrubar o servidor de outra janela seria pior
       do que o problema que isto resolve.

       const { sobeSePreciso } = require('./servidor_estatico');
       const srv = await sobeSePreciso('http://127.0.0.1:8099');
       ... ;  await srv.fecha();
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const RAIZ  = path.resolve(__dirname, '..');
const PORTA_PADRAO = 8123;

const TIPOS = {
  '.html':'text/html; charset=utf-8', '.htm':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.webmanifest':'application/manifest+json',
  '.woff':'font/woff', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8',
  '.pdf':'application/pdf', '.map':'application/json; charset=utf-8'
};

function servir(req, res){
  let alvo;
  try { alvo = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]); }
  catch(e){ res.writeHead(400); return res.end('URL invalida'); }
  if (alvo === '/' || alvo === '') alvo = '/index.html';

  const arq = path.resolve(RAIZ, '.' + alvo);
  // ── A TRAVA: o caminho resolvido tem de morar DENTRO da raiz. `..` para fora morre aqui.
  if (arq !== RAIZ && !arq.startsWith(RAIZ + path.sep)){
    res.writeHead(403, {'Content-Type':'text/plain; charset=utf-8'});
    return res.end('403 — fora da raiz do projeto');
  }
  fs.stat(arq, (err, st) => {
    if (err || !st.isFile()){
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
      return res.end('404 — ' + alvo);
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(arq).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(arq).pipe(res);
  });
}

// ── O MODO MÓDULO (B37) ──────────────────────────────────────────────────────────────────────
// Pergunta ao endereço se já há alguém servindo o projeto ali. É `fpmed_negocios.html` e não `/`
// de propósito: um outro servidor qualquer na mesma porta responderia `/`, e aí a prova mediria
// a tela de outra pessoa achando que era a nossa.
function respondeEm(base){
  return new Promise(ok => {
    const r = http.get(base.replace(/\/+$/, '') + '/fpmed_negocios.html', x => { x.resume(); ok(x.statusCode === 200); });
    r.on('error', () => ok(false));
    r.setTimeout(2500, () => { r.destroy(); ok(false); });
  });
}

async function sobeSePreciso(base){
  const b = String(base || ('http://127.0.0.1:' + PORTA_PADRAO)).replace(/\/+$/, '');
  if (await respondeEm(b)) return { base: b, proprio: false, fecha: async () => {} };
  const porta = Number((b.match(/:(\d+)/) || [, PORTA_PADRAO])[1]);
  const srv = http.createServer(servir);
  await new Promise((ok, erro) => { srv.once('error', erro); srv.listen(porta, '127.0.0.1', ok); });
  return { base: b, proprio: true, fecha: () => new Promise(ok => srv.close(ok)) };
}

module.exports = { servir, sobeSePreciso, respondeEm, RAIZ, PORTA_PADRAO };

// ── O MODO LINHA DE COMANDO, INTACTO ─────────────────────────────────────────────────────────
// A guarda `require.main === module` é o que deixa as duas coisas viverem no mesmo arquivo: quem
// dá `require` nele não sobe servidor nenhum sem pedir; quem chama `node tools/servidor_estatico.js`
// tem exatamente o que tinha antes.
if (require.main === module){
  const PORTA = Number(process.argv[2]) || PORTA_PADRAO;
  http.createServer(servir).listen(PORTA, '127.0.0.1', () => {
    console.log('servidor estatico de pe: http://127.0.0.1:' + PORTA + '/  (raiz: ' + RAIZ + ')');
  });
}
