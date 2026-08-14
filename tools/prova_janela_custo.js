/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_janela_custo.js — A JANELA DE CUSTO CONTRA O BANCO DE VERDADE (fatia A16, 14/08/2026)

   A suite `testa_janela_custo` prova o CAMINHO: a janela monta, mostra o valor, o Esc cancela,
   o foco nasce no "Cancelar". Ela roda offline e não pode responder a pergunta que o dono
   realmente comprou, que é sobre DINHEIRO:

     1. abrir a janela (orçar) NÃO cria linha em `usos_ia` — olhar o preço é de graça;
     2. clicar em CANCELAR na janela não gasta — nem uma linha, nem um centavo;
     3. clicar em CONFIRMAR gasta UMA VEZ SÓ — e não duas, que é o defeito que um portão
        somado a um diálogo novo produz sem avisar.

   >>> O TERCEIRO É O QUE NASCEU COM ESTA FATIA. Até a A12 o portão perguntava com o `confirm()`
       e seguia; agora ele ABRE UM DIÁLOGO, espera uma promessa e só então gasta. Um `await` a
       mais no lugar errado, um ouvinte de clique registrado duas vezes, e a leitura sairia em
       duplicidade — cobrando dobrado por um "sim" só. Isso não aparece na tela: aparece na
       fatura. Por isso a prova conta o livro-caixa antes e depois de CADA gesto.

   >>> ELA GASTA DE VERDADE, E DE PROPÓSITO — uma leitura mínima (algumas centenas de chars,
       fração de centavo). Provar "confirmar cobra uma vez" sem deixar cobrar nenhuma é
       impossível, e uma prova que não gasta nada não prova nada sobre gasto.

     node tools/prova_janela_custo.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RAIZ = path.join(__dirname, '..');
const { criaDom } = require(path.join(RAIZ, 'tests', 'dom_minimo.js'));

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const ANON = (seg.match(/anon[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H_SR = { apikey: SR, Authorization: 'Bearer ' + SR };
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

async function livro() {
  const r = await fetch(`${SB}/rest/v1/usos_ia?select=id,usd`, { headers: H_SR });
  const j = await r.json();
  return { linhas: j.length, usd: j.reduce((s, x) => s + (Number(x.usd) || 0), 0) };
}
async function token() {
  for (const email of ['licitacao@fpmed.com.br', 'comercial@fpmed.com.br']) {
    try {
      const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: SENHA }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (j.access_token) { console.log(`  (logado como ${email})`); return j.access_token; }
    } catch { }
  }
  return null;
}

/* O MOTOR RODA COM UM DOM DE MENTIRA E UM `fetch` DE VERDADE. É essa combinação que dá a prova:
   a janela é a mesma que a tela desenha, e o dinheiro que sai é o dinheiro de verdade. */
function montaMotor(doc, tk) {
  const caixa = {
    window: { document: doc, LIMEDTEC_CLIENTE: { banco: { url: SB } }, gmAuth: { session: { access_token: tk } } },
    console, fetch: globalThis.fetch, AbortSignal: globalThis.AbortSignal,
  };
  vm.createContext(caixa);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'fpmed_leitor_motor.js'), 'utf8'), caixa,
    { filename: 'fpmed_leitor_motor.js' });
  return caixa.window.LeitorEdital;
}

/* Espera a janela aparecer no `body`. Ela nasce dentro de um `await` (o orçamento vai ao
   servidor primeiro), então ela não está lá no instante seguinte à chamada. */
async function esperaJanela(doc, ms = 25000) {
  const fim = Date.now() + ms;
  for (;;) {
    const v = doc.body.querySelector('.fp-custo-veu');
    if (v) return v;
    if (Date.now() > fim) throw new Error('a janela de custo não apareceu em ' + ms + 'ms');
    await new Promise(r => setTimeout(r, 50));
  }
}

/* MAIS DE 500 CARACTERES, E O NÚMERO NÃO É ESTÉTICO: a edge function recusa com HTTP 400 um
   texto menor que isso ("veio pobre demais para valer uma leitura"), e ela está certa — pagar
   por um resumo de nada é o pior desfecho de uma leitura cobrada. O primeiro rascunho desta
   prova mandava 233 chars e apanhou dessa barreira, o que é a barreira funcionando. */
const TEXTO = [
  'PREGÃO ELETRÔNICO Nº 000/2026 — TERMO DE REFERÊNCIA (TRECHO DE PROVA).',
  'OBJETO: aquisição de albumina humana 20% frasco-ampola 50ml, dipirona sódica 500mg/ml ampola,',
  'soro fisiológico 0,9% 500ml bolsa e seringa descartável 10ml com agulha, destinados ao',
  'abastecimento da farmácia hospitalar da unidade municipal de saúde.',
  'PRAZO DE ENTREGA: 10 (dez) dias corridos contados do recebimento da nota de empenho.',
  'CRITÉRIO DE JULGAMENTO: menor preço por item, admitida a cotação de marca equivalente desde',
  'que comprovada a equivalência técnica e o registro válido na ANVISA.',
  'CONDIÇÃO DE PAGAMENTO: 30 (trinta) dias após o atesto da nota fiscal pelo setor competente.',
  'VALIDADE DA PROPOSTA: 60 (sessenta) dias. GARANTIA: prazo de validade mínimo de 12 meses na',
  'data da entrega. AMOSTRA: poderá ser exigida do primeiro colocado, no prazo de 3 dias úteis.',
  'ESTE TRECHO EXISTE APENAS PARA PROVAR QUE CONFIRMAR NA JANELA DE CUSTO COBRA UMA VEZ SÓ.',
].join(' ');

(async () => {
  console.log('=== PROVA — a janela de custo, contra o banco (fatia A16) ===\n');
  const tk = await token();
  if (!tk) { console.log('  ~ NÃO CONFERI: nenhum e-mail logou com a SENHA_PADRAO.'); process.exitCode = 1; return; }

  // ── 1. ABRIR A JANELA (ORÇAR) É DE GRAÇA ────────────────────────────────────────────────
  const doc = criaDom();
  const M = montaMotor(doc, tk);
  ok(n + '. (controle) o motor carregou e expõe a janela como função única',
    !!M && typeof M.janelaDeCusto === 'function' && typeof M.perguntar === 'function'); n++;

  const L0 = await livro();
  console.log(`  livro-caixa antes ......... ${L0.linhas} linha(s) · US$ ${L0.usd.toFixed(6)}`);

  let cancelou = false, erro1 = null;
  const p1 = M.perguntar({ texto: TEXTO, tarefa: 'resumo',
    documento: { nome: 'Termo de Referência (prova A16)', chars: TEXTO.length, paginas: 1 } })
    .then(() => { erro1 = 'NÃO DEVERIA TER LIDO'; })
    .catch(e => { cancelou = !!e.cancelado; erro1 = e.message; });

  const veu = await esperaJanela(doc);
  const cx = veu.querySelector('.fp-custo-cx');
  console.log('\n  --- a janela que apareceu ---');
  console.log('   título ..... ' + cx.querySelector('.fp-custo-tit').textContent);
  console.log('   documento .. ' + cx.querySelector('.fp-custo-doc').textContent);
  console.log('   destaque ... ' + cx.querySelector('.fp-custo-preco-rot').textContent.toUpperCase()
    + '  ' + cx.querySelector('.fp-custo-preco-val').textContent);
  console.log('   nota ....... ' + cx.querySelector('.fp-custo-nota').textContent);
  console.log('   botões ..... ' + cx.querySelectorAll('button').map(b => b.textContent).join('  |  '));
  console.log('   foco em .... ' + (doc.activeElement ? doc.activeElement.textContent : '(nenhum)'));
  console.log('  -----------------------------\n');

  ok(n + '. *** a janela mostra o que vai ser lido: nome do documento E tamanho ***',
    /Termo de Referência \(prova A16\)/.test(cx.querySelector('.fp-custo-doc').textContent)
    && new RegExp(String(TEXTO.length).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' caracteres')
      .test(cx.querySelector('.fp-custo-doc').textContent)); n++;
  const valor = cx.querySelector('.fp-custo-preco-val').textContent;
  ok(n + '. *** e o VALOR em destaque, vindo do servidor, em reais com vírgula ***',
    /^R\$ \d+,\d{2}$/.test(valor), valor); n++;
  ok(n + '. ...com a frase honesta de que é TETO e o cobrado é o medido',
    /TETO/.test(cx.querySelector('.fp-custo-nota').textContent)
    && /consumo real medido/.test(cx.querySelector('.fp-custo-nota').textContent)); n++;
  ok(n + '. ...e o foco nasce no CANCELAR (neste diálogo o Enter gasta dinheiro)',
    doc.activeElement === cx.querySelector('[data-fp="nao"]')); n++;

  const L1 = await livro();
  console.log(`  livro-caixa com a janela ABERTA ... ${L1.linhas} linha(s) · US$ ${L1.usd.toFixed(6)}`);
  /* ORÇAR NÃO GASTA, E "NÃO GASTA" AQUI É O LIVRO NÃO SE MEXER — não a promessa de que não se
     mexeu. O orçamento sai da edge function antes da chamada à IA. */
  ok(n + '. *** abrir a janela (orçar) NÃO criou linha em usos_ia ***',
    L1.linhas === L0.linhas, { antes: L0.linhas, depois: L1.linhas }); n++;
  ok(n + '. *** e NÃO somou um centavo ***', Math.abs(L1.usd - L0.usd) < 1e-9,
    { antes: L0.usd, depois: L1.usd }); n++;

  // ── 2. CANCELAR NA JANELA NÃO GASTA ─────────────────────────────────────────────────────
  doc._clica(cx.querySelector('[data-fp="nao"]'));
  await p1;
  const L2 = await livro();
  console.log(`  livro-caixa após CANCELAR ........ ${L2.linhas} linha(s) · US$ ${L2.usd.toFixed(6)}`);
  ok(n + '. *** clicar em Cancelar aborta a leitura, marcada como cancelamento (não é falha) ***',
    cancelou === true, erro1); n++;
  ok(n + '. *** e cancelar NÃO gerou registro nem custo ***',
    L2.linhas === L0.linhas && Math.abs(L2.usd - L0.usd) < 1e-9, { antes: L0, depois: L2 }); n++;
  ok(n + '. ...e a janela saiu da tela (não fica véu órfão cobrindo o sistema)',
    !doc.body.querySelector('.fp-custo-veu')); n++;

  // ── 3. CONFIRMAR GASTA UMA VEZ SÓ ───────────────────────────────────────────────────────
  /* ESTE É O ASSERT QUE NASCEU COM A FATIA. Cobrar dobrado por um "sim" só não aparece na tela;
     aparece na fatura, no fim do mês, sem ninguém saber de onde veio. */
  let leu = null, erro2 = null;
  const p2 = M.perguntar({ texto: TEXTO, tarefa: 'resumo',
    documento: { nome: 'Termo de Referência (prova A16)', chars: TEXTO.length, paginas: 1 } })
    .then(r => { leu = r; }).catch(e => { erro2 = e.message; });
  const veu2 = await esperaJanela(doc);
  doc._clica(veu2.querySelector('[data-fp="sim"]'));
  await p2;
  const L3 = await livro();
  console.log(`\n  livro-caixa após CONFIRMAR ....... ${L3.linhas} linha(s) · US$ ${L3.usd.toFixed(6)}`);
  console.log(`  a leitura cobrou US$ ${(L3.usd - L2.usd).toFixed(6)} em ${L3.linhas - L2.linhas} registro(s)`);
  ok(n + '. *** confirmar na janela LEVA A LEITURA ADIANTE (o serviço respondeu) ***',
    !erro2 && !!leu, erro2); n++;
  ok(n + '. *** e gastou UMA VEZ SÓ — uma linha, não duas ***',
    L3.linhas === L2.linhas + 1, { antes: L2.linhas, depois: L3.linhas }); n++;
  ok(n + '. ...e o que foi cobrado é maior que zero (senão o assert acima estaria contando nada)',
    L3.usd > L2.usd, { antes: L2.usd, depois: L3.usd }); n++;
  /* O ANUNCIADO É TETO: o cobrado tem que caber DENTRO dele. Se um dia o cobrado passar do
     anunciado, o aviso deixou de ser verdade — e é este assert que grita. */
  const cobradoUSD = L3.usd - L2.usd;
  const orc = await M.orcar({ chars: TEXTO.length, tarefa: 'resumo', partes: 1 });
  ok(n + '. *** o COBRADO cabe dentro do TETO anunciado (o "até" é verdade) ***',
    cobradoUSD <= Number(orc.usd) + 1e-9,
    { anunciadoUSD: orc.usd, cobradoUSD: Number(cobradoUSD.toFixed(6)) }); n++;
  console.log(`  anunciado até US$ ${orc.usd} · cobrado US$ ${cobradoUSD.toFixed(6)}`);

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
