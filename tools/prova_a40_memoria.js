/* ═══════════════════════════════════════════════════════════════════════════════════════════
   prova_a40_memoria.js — O ANTES E O DEPOIS DA MEMÓRIA DE PREÇO (fatia A40 · 20/08/2026)

   A caixa pediu três números, e o terceiro é o que importa:
     *"o número de itens com resultado antes e depois, quantos CERTAMES DISTINTOS, e quantos
       PRODUTOS passam a ter dois ou mais resultados — é esse último que liga o caminho da faixa
       e da mediana que o B já escreveu."*

   ══ E A CHAVE DE PRODUTO É A DO B, IMPORTADA — NÃO UMA SEGUNDA ══════════════════════════════
   `fpmed_teto_homologado.js` já define `chave(descricao)`, com a normalização NFKD, o corte do
   `"12 , "` que o PNCP cola na frente e o casamento pela descrição INTEIRA. Escrever aqui uma
   segunda normalização "parecida" daria dois números para a mesma pergunta — e o relatório
   diria que o caminho da faixa ligou enquanto a tela continuaria vazia, ou o contrário. A régua
   é uma só, e ela é a da tela que vai usar o dado.

     node tools/prova_a40_memoria.js
     node tools/prova_a40_memoria.js --antes    (grava o retrato ANTES, para comparar depois)
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const T = require(path.join(RAIZ, 'fpmed_teto_homologado.js'));

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };
const fmt = n => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const RETRATO = path.join(RAIZ, '_a40_retrato_antes.json');

async function conta(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (!r.ok) return null;
  const n = parseInt(String(r.headers.get('content-range') || '').split('/')[1], 10);
  return isFinite(n) ? n : null;
}

/* TODAS as linhas com resultado, paginadas. O `limit=1000` do PostgREST é o teto que já mordeu
   esta obra quatro vezes — contar pelo `length` de uma página daria 1.000 e pronto. */
async function todosComResultado() {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const r = await fetch(`${SB}/rest/v1/licitacao_itens`
      + '?select=numero_controle,numero_item,descricao,resultado_valor_unit,resultado_vencedor'
      + '&resultado_valor_unit=not.is.null&order=id.asc',
      { headers: { ...H, Range: de + '-' + (de + 999) } });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ao ler os resultados');
    const j = await r.json();
    linhas.push(...j);
    if (j.length < 1000) break;
  }
  return linhas;
}

function retratoDaFaixa(linhas) {
  const porChave = new Map();
  for (const l of linhas) {
    const k = T.chave(l.descricao);
    if (!k) continue;
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(l);
  }
  const comDois = [...porChave.entries()].filter(([, v]) => v.length >= 2);
  /* PRODUTO COM DOIS RESULTADOS DO MESMO CERTAME não liga a faixa: é o mesmo pregão, o mesmo dia,
     o mesmo comprador. O que a mediana promete é "o que o MERCADO faz" — e para isso o mesmo
     produto precisa ter saído em certames DIFERENTES. Contar os dois juntos inflaria o número da
     entrega com o que não muda a resposta da tela. */
  const comDoisCertames = comDois.filter(([, v]) => new Set(v.map(x => x.numero_controle)).size >= 2);
  return { produtos: porChave.size, comDois: comDois.length, comDoisCertames: comDoisCertames.length,
           exemplos: comDoisCertames.slice(0, 6).map(([k, v]) => ({
             chave: k.slice(0, 70),
             certames: [...new Set(v.map(x => x.numero_controle))].length,
             valores: v.map(x => Number(x.resultado_valor_unit)),
             mediana: T.mediana(v.map(x => Number(x.resultado_valor_unit))),
           })) };
}

(async () => {
  const [itens, comRes, perguntados, certames] = await Promise.all([
    conta('licitacao_itens?select=id'),
    conta('licitacao_itens?select=id&resultado_valor_unit=not.is.null'),
    conta('licitacao_itens?select=id&resultado_perguntado_em=not.is.null'),
    (async () => {
      /* certames distintos vem da CONTAGEM de licitações que têm ao menos um item com resultado,
         e não de um `distinct` no cliente: com paginação, `distinct` no cliente conta a página. */
      const r = await fetch(`${SB}/rest/v1/licitacoes?select=id&resultado_perguntado_em=not.is.null`,
        { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
      const n = parseInt(String(r.headers.get('content-range') || '').split('/')[1], 10);
      return isFinite(n) ? n : null;
    })(),
  ]);

  const linhas = await todosComResultado();
  const certamesComResultado = new Set(linhas.map(l => l.numero_controle)).size;
  const faixa = retratoDaFaixa(linhas);

  const agora = { itens, comRes, perguntados, licitacoesPerguntadas: certames,
                  certamesComResultado, ...faixa };

  if (process.argv.includes('--antes')) {
    fs.writeFileSync(RETRATO, JSON.stringify(agora, null, 2), 'utf8');
    console.log('retrato ANTES gravado em ' + path.relative(RAIZ, RETRATO));
  }
  const antes = fs.existsSync(RETRATO) ? JSON.parse(fs.readFileSync(RETRATO, 'utf8')) : null;

  console.log('=== A MEMÓRIA DE PREÇO — ANTES E DEPOIS (fatia A40) ===\n');
  const linha = (rot, a, d, extra) =>
    console.log('  ' + rot.padEnd(34) + String(a == null ? '—' : fmt(a)).padStart(9)
      + '  →  ' + String(fmt(d)).padStart(9) + (extra ? '   ' + extra : ''));

  linha('itens com resultado homologado', antes && antes.comRes, comRes,
    '(' + (itens ? (comRes / itens * 100).toFixed(3) : '—') + '% de ' + fmt(itens) + ')');
  linha('CERTAMES distintos com resultado', antes && antes.certamesComResultado, certamesComResultado);
  linha('itens já perguntados ao PNCP', antes && antes.perguntados, perguntados,
    '(o "não perguntei" deixou de ser "não existe")');
  linha('produtos distintos (chave do B)', antes && antes.produtos, faixa.produtos);
  console.log('');
  linha('*** produtos com 2+ resultados', antes && antes.comDois, faixa.comDois);
  linha('*** ...em CERTAMES diferentes', antes && antes.comDoisCertames, faixa.comDoisCertames,
    '<<< é este que liga a FAIXA e a MEDIANA');

  if (faixa.exemplos.length) {
    console.log('\n  os primeiros produtos que passaram a ter faixa (valores reais do banco):');
    for (const e of faixa.exemplos) {
      const v = e.valores.map(x => 'R$ ' + x.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
      console.log('    · ' + e.chave);
      console.log('      ' + e.certames + ' certames · ' + v.join(' · ')
        + '   mediana R$ ' + Number(e.mediana).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    }
  } else {
    console.log('\n  NENHUM produto tem dois resultados em certames diferentes ainda —');
    console.log('  o caminho da faixa e da mediana do B continua escrito e NÃO exercido.');
  }
  console.log('');
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
