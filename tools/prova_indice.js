/* ════════════════════════════════════════════════════════════════════════════════════════════
   prova_indice.js — O ATALHO DA BUSCA, CONTRA O BANCO REAL (reescrita na fatia A30, 15/08/2026)

   ══ POR QUE ELA FOI REESCRITA, E O QUE ESTAVA ERRADO ════════════════════════════════════════
   A versão anterior veio PORTADA DA GLOBAL em 04/08 e **nunca rodou nesta casa um dia sequer**.
   Ela pedia três coisas que a FPMED não tem:
       tools/le_banco.js ....... nunca foi portado
       motor_busca.js .......... aqui o motor mora DENTRO do fpmed_giovana.html
       tests/fixtures/ ......... a pasta não existe neste repositório
   Rodá-la dava `Cannot find module` na primeira linha. Prova quebrada parada no repositório é
   pior que prova nenhuma: ela ensina a equipe a ignorar vermelho.

   >>> E O PIOR NÃO ERA O VERMELHO — ERA O VERDE QUE ELA SUSTENTAVA. O comentário de cabeçalho da
       `tests/testa_indice.js` (suíte VERDE, que roda toda rodada) dizia, e ainda dizia hoje de
       manhã: *"A verificação contra o banco REAL (1.569 consultas, zero divergência) está em
       tools/prova_indice.js"*. Aquelas 1.569 consultas foram rodadas na GLOBAL, contra o banco
       da Global. Aqui elas nunca aconteceram. Um número real, de outro lugar, citado como se
       fosse desta casa — o formato mais caro de mentira que existe, porque tem duas casas
       decimais e cara de conta feita.

   ══ POR QUE ELA NÃO É REDUNDANTE (a caixa mandou apagar se fosse) ═══════════════════════════
   Duas provas vizinhas, e nenhuma responde o que esta responde:
   · `tests/testa_indice.js` roda os dois caminhos sobre um banco SINTÉTICO de 20 linhas,
     escolhidas a dedo. Ele prova o ARGUMENTO (o 4-grama cobre o substring, os três baldes
     cobrem a distância de edição 1). É rápido, offline e entra na suíte.
   · `tools/prova_cobertura_itens.js` mede outra coisa inteiramente: quantas licitações do
     índice do PNCP já tiveram os itens lidos. Nada a ver com a busca por produto.
   Esta aqui roda sobre os PRODUTOS DE VERDADE. E a diferença não é de tamanho, é de natureza —
   é a lição da amostra da fatia A27: *amostra que só pega o caso comum prova o layout bonito*.
   Um índice fura no nome torto, no acento, no pack escrito de um jeito que ninguém previu; e o
   banco tem milhares deles, escritos por gente, ao longo de anos.

   ══ A DIVERGÊNCIA COM A CAIXA, DECLARADA ════════════════════════════════════════════════════
   A caixa mandou "contar linhas do índice e conferir 1 registro contra o PNCP". Isso não se
   aplica: **este `índice` não é o índice de licitações do PNCP** — é o índice de candidatos da
   BUSCA POR PRODUTO (`_bmIdxCandidatos`), que serve o `buscarMelhorProduto` da tela de
   Proposta. Não há registro do PNCP para conferir; a fonte da verdade dele é a varredura
   completa da tabela `cotacoes`, e é contra ela que a prova compara. Quem conta linhas do
   índice do PNCP contra o servidor é o `tools/conta_indice.js`, da fatia A29.

   ══ SÓ LEITURA, E O MOTOR VEM DO ARQUIVO DE VERDADE ═════════════════════════════════════════
   Zero escrita no banco. E as funções não são recopiadas: são RECORTADAS do
   `fpmed_giovana.html` pelos mesmos marcadores que a `testa_indice` usa — se alguém renomear
   uma delas, esta prova quebra na hora, em vez de continuar medindo uma cópia velha.

     node tools/prova_indice.js              (a amostra padrão: 1.500 consultas)
     node tools/prova_indice.js --tudo       (um nome de produto por linha do banco)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };
const TUDO = process.argv.includes('--tudo');

/* ── 1 · O MOTOR, RECORTADO DO ARQUIVO QUE ESTÁ NO AR ───────────────────────────────────────
   Mesmos marcadores da `tests/testa_indice.js`. Duas listas de marcadores seriam duas verdades
   sobre onde o motor começa — e um dia uma delas recortaria metade. */
const HTML = fs.readFileSync(path.join(RAIZ, 'fpmed_giovana.html'), 'utf8');
const linhas = HTML.split(/\r?\n/);
function bloco(de, ate) {
  const i = linhas.findIndex(l => l.includes(de));
  if (i < 0) throw new Error('marcador de INÍCIO não existe mais no fpmed_giovana.html: ' + de
    + '\n   (alguém renomeou a função — a prova para de propósito, em vez de medir uma cópia velha)');
  let f = -1;
  for (let k = i + 1; k < linhas.length; k++) if (linhas[k].includes(ate)) { f = k; break; }
  if (f < 0) throw new Error('marcador de FIM não existe mais: ' + ate);
  return linhas.slice(i, f).join('\n');
}
const ctx = (new Function(
  'let cotacoes=[];let _bmCmed=new Map();let _bmClasseB=new Set();console.warn=function(){};\n'
  + bloco('function _undNum(und)', 'let searchTO') + '\n'
  + bloco('const _bmStrip = s =>', 'busca antiga') + '\n'
  + 'return { buscar: buscarMelhorProduto, candidatos: _bmIdxCandidatos,'
  + '         setCot:function(a){cotacoes=a;_bmIdx=null;},'
  + '         setIdx:function(on){_bmIdxOff=!on;_bmIdx=null;} };'))();

/* ── 2 · O BANCO, INTEIRO — e o teto de 1000 do PostgREST, de novo ──────────────────────────
   Ler `select=*` e medir o `length` devolveria 1000 sempre, e a prova diria "zero divergência
   em 1.000 produtos" sobre um banco de 20 mil. Este defeito já custou uma manchete errada nesta
   obra (a giovana paginava a CMED em 2000 e o PostgREST daqui corta em 1000). Aqui a leitura é
   PAGINADA e o total vem do servidor. */
async function leTudo(tabela, colunas) {
  const passo = 1000;
  let saida = [], de = 0, total = null;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/${tabela}?select=${colunas}&order=id.asc`, {
      headers: { ...H, Range: `${de}-${de + passo - 1}`, Prefer: 'count=exact' } });
    if (!r.ok) throw new Error(tabela + ' -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 140));
    if (total === null) total = parseInt(String(r.headers.get('content-range') || '').split('/')[1], 10);
    const lote = await r.json();
    if (!Array.isArray(lote) || !lote.length) break;
    saida = saida.concat(lote);
    de += lote.length;
    if (saida.length >= total || lote.length < passo) break;
  }
  /* A CONFERÊNCIA DO PRÓPRIO INSTRUMENTO, antes de qualquer número: o que eu li tem de bater
     com o que o servidor diz que existe. Uma leitura curta que passasse calada faria a prova
     publicar "zero divergência" sobre a parte que ela conseguiu ler. */
  if (isFinite(total) && saida.length !== total)
    throw new Error('li ' + saida.length + ' de ' + total + ' linhas de `' + tabela
      + '` — leitura curta. A prova PARA: número sobre leitura incompleta é número bonito.');
  return { linhas: saida, total };
}

(async () => {
  console.log('PROVA DO ÍNDICE DE BUSCA — os dois caminhos, sobre o banco REAL. Só leitura.\n');

  const cot = await leTudo('cotacoes',
    'id,fornecedor,tipo,produto,principio_ativo,marca,und,compra_unit,compra_caixa,estoque,global_venda1');
  console.log('  cotações lidas ....... ' + cot.linhas.length + ' de ' + cot.total + ' (o servidor contou)');
  ctx.setCot(cot.linhas);

  /* AS CONSULTAS SÃO OS NOMES DO PRÓPRIO BANCO, e isso é ADVERSARIAL de propósito: é o texto
     mais parecido possível com o cadastro, que é justamente onde um índice furado apareceria —
     ele acha o produto pelo caminho longo e não acha pelo atalho. */
  const passo = TUDO ? 1 : Math.max(1, Math.floor(cot.linhas.length / 1500));
  const consultas = [];
  for (let i = 0; i < cot.linhas.length; i += passo)
    consultas.push(String(cot.linhas[i].produto || '').slice(0, 70));
  const uniq = [...new Set(consultas.filter(q => q && q.length > 2))];
  console.log('  consultas ............ ' + uniq.length
    + (TUDO ? '  (--tudo: uma por linha do banco)' : '  (amostra 1 a cada ' + passo + ')') + '\n');

  const roda = ligado => {
    ctx.setIdx(ligado);
    const t0 = Date.now();
    const r = uniq.map(q => { const x = ctx.buscar(q); return x ? x.id : null; });
    return { r, ms: Date.now() - t0 };
  };
  process.stdout.write('  varredura completa (sem atalho)… ');
  const sem = roda(false);
  console.log(sem.ms + 'ms');
  process.stdout.write('  com o índice…                    ');
  const com = roda(true);
  console.log(com.ms + 'ms\n');

  let dif = 0; const exemplos = [];
  for (let i = 0; i < uniq.length; i++) {
    if (sem.r[i] === com.r[i]) continue;
    dif++;
    if (exemplos.length < 12) {
      const a = cot.linhas.find(x => x.id === sem.r[i]), b = cot.linhas.find(x => x.id === com.r[i]);
      exemplos.push({ q: uniq[i], sem: a ? a.produto : 'NADA', com: b ? b.produto : 'NADA' });
    }
  }

  console.log('══ RESULTADO ═══════════════════════════════════════════');
  console.log('  consultas comparadas ..: ' + uniq.length);
  console.log('  DIVERGÊNCIAS ..........: ' + dif);
  console.log('  casaram sem o índice ..: ' + sem.r.filter(Boolean).length);
  console.log('  casaram com o índice ..: ' + com.r.filter(Boolean).length);
  console.log('  ganho .................: ' + (sem.ms / Math.max(1, com.ms)).toFixed(1) + 'x');

  if (dif) {
    console.log('\n  >>> O ÍNDICE MUDA RESPOSTA. Ele NÃO pode ser usado assim: produto que some do');
    console.log('      atalho não vira erro — vira "não encontrado" na proposta, em silêncio.');
    for (const e of exemplos) {
      console.log('      pedido: ' + e.q.slice(0, 60));
      console.log('         varredura: ' + String(e.sem).slice(0, 60));
      console.log('         índice   : ' + String(e.com).slice(0, 60));
    }
  } else {
    console.log('\n  >>> ZERO DIVERGÊNCIA em ' + uniq.length + ' consultas contra ' + cot.linhas.length);
    console.log('      produtos REAIS. O atalho devolve exatamente o mesmo que a varredura.');
  }

  // quantos candidatos o atalho poupa — e quantas vezes ele DESISTE e varre tudo assim mesmo
  ctx.setIdx(true);
  let soma = 0, n = 0, desiste = 0;
  for (const q of uniq.slice(0, 400)) {
    const pal = String(q).toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (!pal.length) continue;
    const cand = ctx.candidatos(pal[0], null, [], null);
    if (cand === null) { desiste++; continue; }
    soma += cand.length; n++;
  }
  if (n) console.log('\n  candidatos visitados por consulta: ' + Math.round(soma / n) + ' de '
    + cot.linhas.length + '  (' + (soma / n / cot.linhas.length * 100).toFixed(1) + '%)'
    + '   ·   desistências (varre tudo): ' + desiste);

  process.exitCode = dif ? 1 : 0;
})().catch(e => { console.error('\nERRO: ' + e.message); process.exit(1); });
