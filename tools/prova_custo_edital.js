// ============================================================
// prova_custo_edital.js — MODO PROVA DE CUSTO do leitor de edital com IA.
//
// POR QUE ESTE ARQUIVO EXISTE: o leitor de edital e o unico item da spec que custa DINHEIRO POR
// USO, e edital tem 80 paginas. Antes de liberar isso pros usuarios, o Lemuel precisa saber
// quanto custa UM edital — medido, nao estimado. Este script le um edital REAL do PNCP, manda
// pro Claude Haiku e imprime o custo em reais.
//
// >>> ELE NAO LIBERA NADA. Nao mexe em tela, nao grava no banco, nao cria menu. So mede.
//
// >>> DOIS CAMINHOS, DE PROPOSITO (10/08, 2a rodada): o PDF NATIVO (a API converte cada pagina
//     em texto + IMAGEM, e a imagem e o que pesa) e o TEXTO EXTRAIDO com o MESMO pdf.js que o
//     navegador ja usa no Conferidor e no Atualizar Estoque. A pergunta que so a medicao
//     responde: quanto mais barato fica, e o que se PERDE junto — tabela e diagrama nao
//     sobrevivem a extracao de texto.
//
// USO:
//   node tools/prova_custo_edital.js                 (pega um edital do nosso indice)
//   node tools/prova_custo_edital.js --url <pdf>     (um PDF especifico)
//   node tools/prova_custo_edital.js --texto         (manda o TEXTO extraido, nao o PDF)
//   node tools/prova_custo_edital.js --rotulo x      (nome do arquivo de saida, pra comparar)
//   node tools/prova_custo_edital.js --so-baixar     (baixa e mede o tamanho, sem gastar credito)
//
// PRECO (tabela publica da Anthropic, claude-haiku-4-5): US$ 1,00 por milhao de tokens de
// ENTRADA e US$ 5,00 por milhao de SAIDA. O PDF entra como documento nativo — a propria API
// converte pagina em texto+imagem, e e por isso que a conta de entrada e a que manda aqui.
// A cotacao do dolar e buscada na hora (AwesomeAPI, aberta); com ela fora, o script diz o custo
// em dolar e AVISA que nao converteu — inventar cambio seria pior que nao converter.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const PROXY = SB + '/functions/v1/ler-pedido';
const ORIGEM = 'https://fpmed-hospitalar.github.io';   // a trava de origem da edge function
const MODELO = 'claude-haiku-4-5';
const USD_ENTRADA_POR_MTOK = 1.00;
const USD_SAIDA_POR_MTOK = 5.00;

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = (n) => process.argv.includes(n);

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

// O QUE SE PEDE PRO MODELO. Deliberadamente CURTO na saida: o custo de saida e 5x o de entrada,
// e o que o operador precisa e um resumo que caiba na tela — nao o edital reescrito.
const PERGUNTA = `Voce esta lendo o EDITAL de uma licitacao publica brasileira para uma
distribuidora de medicamentos e material hospitalar. Responda SOMENTE com JSON, sem texto antes
ou depois, neste formato:
{
 "objeto": "o que esta sendo comprado, em uma linha",
 "orgao": "quem compra",
 "modalidade": "pregao eletronico / dispensa / etc",
 "abertura": "data e hora da sessao, como aparece no edital",
 "entrega_prazo": "prazo de entrega exigido",
 "entrega_local": "onde entregar",
 "pagamento": "prazo e forma de pagamento",
 "amostra": true ou false (exige amostra?),
 "registro_precos": true ou false,
 "habilitacao": ["os documentos de habilitacao exigidos, um por item"],
 "penalidades": "multas e sancoes, resumido",
 "pontos_de_atencao": ["armadilhas que fariam a empresa perder ou se prejudicar"],
 "nao_encontrado": ["campos acima que o edital NAO deixa claro"]
}
Se algo nao estiver no documento, NAO invente: ponha o campo em "nao_encontrado".`;

/* ── EXTRACAO DE TEXTO — a MESMA do navegador, verbatim ──────────────────────────────────────
   pdfjs-dist 3.11.174 e exatamente a versao que o Conferidor e o Atualizar Estoque carregam do
   CDN. Usar outra aqui mediria uma extracao que o app nao faz — o numero sairia bonito e nao
   valeria nada.
   Agrupa por Y pra preservar a LINHA: sem isso o texto sai embaralhado coluna a coluna, e num
   edital e justamente a linha que amarra o item ao prazo e ao valor. */
async function pdfParaTexto(buf) {
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const linhas = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const x = it.transform[4], y = it.transform[5];
      let alvo = linhas.find(l => Math.abs(l.y - y) <= 2.5);
      if (!alvo) { alvo = { y, itens: [] }; linhas.push(alvo); }
      alvo.itens.push({ x, str: it.str });
    }
    linhas.sort((a, b) => b.y - a.y);
    out += linhas.map(l => l.itens.sort((a, b) => a.x - b.x).map(i => i.str).join(' ')).join('\n') + '\n';
  }
  return { texto: out, paginas: doc.numPages };
}

async function cotacaoDolar() {
  try {
    const r = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL', { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const v = parseFloat(j.USDBRL && j.USDBRL.bid);
    return isFinite(v) && v > 0 ? v : null;
  } catch (e) { return null; }
}

// Acha um edital de verdade: pega uma licitacao do NOSSO indice e pede a lista de arquivos dela
// ao PNCP. O maior PDF costuma ser o edital (os pequenos sao aviso, ata, anexo de planilha).
async function achaEdital() {
  const r = await fetch(`${SB}/rest/v1/licitacoes?select=cnpj,ano,sequencial,orgao,objeto,numero_controle`
    + `&order=valor_estimado.desc&limit=12`, { headers: H });
  const linhas = await r.json();
  for (const l of linhas) {
    const u = `https://pncp.gov.br/api/pncp/v1/orgaos/${l.cnpj}/compras/${l.ano}/${l.sequencial}/arquivos`;
    try {
      const ra = await fetch(u, { signal: AbortSignal.timeout(20000) });
      if (!ra.ok) { console.log(`  (${l.numero_controle}: lista de arquivos HTTP ${ra.status})`); continue; }
      const arqs = await ra.json();
      const pdfs = (Array.isArray(arqs) ? arqs : []).filter(a => /\.pdf$/i.test(a.titulo || a.nomeArquivo || ''));
      if (!pdfs.length) { console.log(`  (${l.numero_controle}: sem PDF)`); continue; }
      // heuristica: o que tem "edital" no nome; senao o primeiro
      const alvo = pdfs.find(a => /edital/i.test(a.titulo || a.nomeArquivo || '')) || pdfs[0];
      return { lic: l, arquivo: alvo };
    } catch (e) { console.log(`  (${l.numero_controle}: ${e.name})`); }
    await new Promise(s => setTimeout(s, 800));   // o PNCP tem cota dura — ver o coletor
  }
  return null;
}

(async () => {
  console.log('=== PROVA DE CUSTO — leitor de edital com IA ===\n');

  let url = arg('--url'), rotulo = 'PDF informado na linha de comando';
  if (!url) {
    console.log('procurando um edital real no PNCP (a partir do nosso indice)...');
    const achado = await achaEdital();
    if (!achado) { console.error('nao consegui achar um PDF de edital agora (PNCP recusando).'); process.exit(1); }
    url = achado.arquivo.url || achado.arquivo.uri || achado.arquivo.link;
    rotulo = `${achado.lic.orgao} · ${achado.arquivo.titulo || achado.arquivo.nomeArquivo}`;
    console.log('edital: ' + rotulo);
    console.log('url: ' + url);   // impressa pra dar pra REPETIR a medicao no outro modo
    console.log('objeto: ' + String(achado.lic.objeto || '').slice(0, 120));
  }

  console.log('baixando o PDF...');
  const rp = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!rp.ok) { console.error('download HTTP ' + rp.status); process.exit(1); }
  const buf = Buffer.from(await rp.arrayBuffer());
  const mb = buf.length / 1024 / 1024;
  console.log(`baixado: ${mb.toFixed(2)} MB`);
  if (!buf.slice(0, 5).toString('latin1').startsWith('%PDF')) {
    console.error('o arquivo baixado NAO e um PDF — abortando antes de gastar credito.'); process.exit(1);
  }
  // A API aceita ate 32 MB de requisicao. Passar disso nao e "caro", e ERRO — e melhor parar aqui
  // do que descobrir com a chamada recusada.
  if (mb > 25) { console.error('PDF de ' + mb.toFixed(1) + ' MB — acima do que a requisicao aceita. Abortando.'); process.exit(1); }

  // O MODO TEXTO extrai ANTES de decidir mandar: se a extracao vier vazia (PDF escaneado, so
  // imagem), mandar assim seria pedir resumo de nada e pagar por isso. Melhor parar e dizer.
  const MODO = tem('--texto') ? 'texto' : 'pdf-nativo';
  let bloco = null, paginas = null, chars = null;
  if (MODO === 'texto') {
    console.log('extraindo o texto com o pdf.js (o mesmo do navegador)...');
    const ex = await pdfParaTexto(buf);
    paginas = ex.paginas; chars = ex.texto.length;
    console.log(`  ${paginas} paginas · ${chars.toLocaleString('pt-BR')} caracteres de texto`);
    if (chars < 500) {
      console.error('a extracao devolveu quase nada — este PDF e imagem (escaneado). O caminho de '
        + 'texto NAO serve pra ele; so o PDF nativo le. Abortando antes de gastar credito.');
      process.exit(1);
    }
    bloco = { type: 'text', text: 'EDITAL (texto extraido do PDF):\n\n' + ex.texto };
  } else {
    bloco = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } };
  }

  if (tem('--so-baixar')) { console.log('\n--so-baixar: nada foi enviado, zero credito gasto.'); return; }

  console.log(`enviando pro ${MODELO} (modo ${MODO})...`);
  const t0 = Date.now();
  const r = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGEM },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 2000,
      messages: [{ role: 'user', content: [bloco, { type: 'text', text: PERGUNTA }] }],
    }),
    signal: AbortSignal.timeout(300000),
  });
  const segundos = Math.round((Date.now() - t0) / 1000);
  const txt = await r.text();
  if (!r.ok) { console.error('HTTP ' + r.status + ' ' + txt.slice(0, 400)); process.exit(1); }
  const j = JSON.parse(txt);
  if (j.error) { console.error('erro da API: ' + JSON.stringify(j.error).slice(0, 300)); process.exit(1); }

  const u = j.usage || {};
  const entrada = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  const saida = u.output_tokens || 0;
  const usd = (entrada / 1e6) * USD_ENTRADA_POR_MTOK + (saida / 1e6) * USD_SAIDA_POR_MTOK;
  const cambio = await cotacaoDolar();

  console.log('\n=== O QUE CUSTOU ===');
  console.log(`modo .............. ${MODO}` + (paginas ? ` (${paginas} pag · ${chars.toLocaleString('pt-BR')} chars)` : ''));
  console.log(`tempo ............. ${segundos}s`);
  console.log(`tokens de entrada . ${entrada.toLocaleString('pt-BR')}`);
  console.log(`tokens de saida ... ${saida.toLocaleString('pt-BR')}`);
  console.log(`custo em dolar .... US$ ${usd.toFixed(4)}`);
  if (cambio) {
    console.log(`cambio (agora) .... R$ ${cambio.toFixed(4)} / US$`);
    console.log(`>>> CUSTO DESTE EDITAL: R$ ${(usd * cambio).toFixed(4)}`);
    console.log(`>>> 100 editais: R$ ${(usd * cambio * 100).toFixed(2)}  ·  1.000: R$ ${(usd * cambio * 1000).toFixed(2)}`);
  } else {
    console.log('cambio ............ NAO consegui buscar. Custo fica em dolar — inventar taxa seria pior.');
  }

  const resposta = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  console.log('\n=== O QUE ELE LEU (primeiros 1200 caracteres) ===');
  console.log(resposta.slice(0, 1200));

  // Um arquivo POR MEDICAO (--rotulo), pra dar pra pôr os dois modos lado a lado depois. Um
  // arquivo unico sobrescrito e o que fez a 1a rodada perder a resposta do primeiro edital.
  const nome = 'prova_custo_' + (arg('--rotulo') || (MODO === 'texto' ? 'texto' : 'pdf')) + '.json';
  const destino = path.join(RAIZ, 'backups', nome);
  try {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, JSON.stringify({
      quando: new Date().toISOString(), edital: rotulo, url, mb: +mb.toFixed(2),
      modo: MODO, paginas, chars, modelo: MODELO, segundos, entrada, saida, usd: +usd.toFixed(4),
      cambio, brl: cambio ? +(usd * cambio).toFixed(4) : null, resposta,
    }, null, 1), 'utf8');
    console.log('\nmedicao gravada em backups/' + nome + ' (gitignored)');
  } catch (e) { /* o log e conforto */ }
})().catch(e => { console.error('ERRO: ' + (e && e.message)); process.exit(1); });
