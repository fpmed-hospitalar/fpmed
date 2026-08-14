/* ══════════════════════════════════════════════════════════════════════════════════════════
   mede_busca_produto.js — A BUSCA DO GESTOR, MEDIDA COM OS TERMOS DELE (fatia A20, 14/08/2026)

   ══ POR QUE SÓ AGORA ═══════════════════════════════════════════════════════════════════════
   Na fatia A8 esta mesma medição foi feita e o resultado foi ZERO em quase tudo — mas o zero
   era da BASE, não da busca: `licitacao_itens` tinha 195 linhas de UMA licitação, e o `objeto`
   do PNCP é genérico ("aquisição de material médico-hospitalar", 226 caracteres em média).
   Medir a qualidade da busca ali teria sido medir o vazio.
   Depois da A18 são **40 mil itens em 2.631 licitações**. Agora a pergunta "a busca responde
   bem?" tem sobre o que ser feita, e a resposta pode ser lida como resposta.

   ══ O QUE ELA MEDE, E POR QUE NÃO É SÓ "QUANTOS ACHOU" ═════════════════════════════════════
   Para cada termo, ela roda a MESMA função que a tela roda (`buscar_licitacoes`) e separa:
     · quantas licitações casaram pelo OBJETO  (a compra inteira é daquilo);
     · quantas casaram pelos ITENS             (há um item no meio de outros);
     · quantos ITENS distintos casaram         (1 em 500 e 180 em 195 são coisas opostas).
   E roda as VARIAÇÕES do mesmo termo — plural, acento, abreviação. Duas grafias da mesma coisa
   devolvendo números diferentes é defeito de busca, e é invisível quando se mede só uma.

   >>> O QUE ESTA FERRAMENTA NÃO FAZ: inventar equivalência clínica. "albumina" não é "albumina
       bovina de laboratório", e um sinônimo que junte as duas faria a tela oferecer reagente de
       bancada a quem vende hemoderivado. A tabela `busca_sinonimos` é editável de propósito —
       quem sabe que "equipo macrogotas" e "equipo de soro" são a mesma coisa é quem vende.

     node tools/mede_busca_produto.js                (a tabela inteira)
     node tools/mede_busca_produto.js --termo gaze   (um termo, com exemplos)
     node tools/mede_busca_produto.js --json         (para comparar antes/depois)
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = n => process.argv.includes(n);

/* ══ OS TERMOS SÃO OS DO NATANAEL, e as grafias são as que a mão dele digita ═════════════════
   Cada produto tem DOIS grupos, e separá-los foi um conserto desta própria ferramenta:

     · EQUIVALENTES — plural e acento. Elas são a MESMA pergunta escrita de outro jeito e TÊM
       que dar o mesmo número. Divergir aqui é defeito de busca, e foi assim que o "equipos" a
       539 apareceu depois que o "equipo" já estava consertado em 35.
     · REFINAMENTOS — o termo com mais palavras ("albumina humana", "luva de procedimento").
       Eles são MAIS ESTREITOS por desenho: a busca é E, não OU. Cobrar deles o mesmo número
       seria reprovar a busca por fazer o certo.

   >>> O PRIMEIRO RASCUNHO MISTURAVA OS DOIS e gritava "as grafias divergem" em 5 de 10 termos —
       4 dos gritos eram sobre refinamento funcionando. Alarme que dispara sobre o certo é
       exatamente o alarme que se aprende a ignorar, e aí o quinto grito (o real) passa batido. */
const TERMOS = [
  { produto: 'albumina', equivalentes: ['albumina', 'albuminas'], refinamentos: ['albumina humana'] },
  { produto: 'dipirona', equivalentes: ['dipirona', 'dipironas'], refinamentos: ['dipirona sodica', 'dipirona sódica'] },
  { produto: 'soro fisiológico', equivalentes: ['soro fisiologico', 'soro fisiológico'],
    refinamentos: ['soro'], truncadas: ['soro fisiol'] },
  { produto: 'seringa', equivalentes: ['seringa', 'seringas'] },
  { produto: 'luva', equivalentes: ['luva', 'luvas'], refinamentos: ['luva de procedimento', 'luva procedimento'] },
  { produto: 'equipo', equivalentes: ['equipo', 'equipos'], refinamentos: ['equipo macrogotas'] },
  { produto: 'cateter', equivalentes: ['cateter', 'cateteres', 'catéter'] },
  { produto: 'gaze', equivalentes: ['gaze', 'gazes'] },
  { produto: 'omeprazol', equivalentes: ['omeprazol'], refinamentos: ['omeprazol 20mg'] },
  { produto: 'dieta enteral', equivalentes: ['dieta enteral', 'dieta enteral'],
    refinamentos: ['enteral', 'nutricao enteral'] },
];
const grafiasDe = t => [].concat(t.equivalentes || [], t.refinamentos || [], t.truncadas || []);

async function busca(termo) {
  const r = await fetch(`${SB}/rest/v1/rpc/buscar_licitacoes`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ p_termo: termo, p_limite: 500 }),
  });
  if (!r.ok) throw new Error(`buscar_licitacoes("${termo}") -> HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const linhas = await r.json();
  const total = linhas.length ? Number(linhas[0].total) : 0;
  const porObjeto = linhas.filter(l => l.casou_em !== 'itens').length;
  const porItem = linhas.filter(l => l.casou_em !== 'objeto').length;
  const itens = linhas.reduce((s, l) => s + Number(l.itens_casados || 0), 0);
  return { total, porObjeto, porItem, itens, amostra: linhas.slice(0, 3) };
}

(async () => {
  const so = arg('--termo');
  const lista = so ? [{ produto: so, equivalentes: [so] }] : TERMOS;
  const saida = [];
  let divergem = 0;

  if (!tem('--json')) {
    console.log('=== A BUSCA POR PRODUTO, MEDIDA (fatia A20) ===\n');
    const sin = await (await fetch(`${SB}/rest/v1/busca_sinonimos?select=termo,equivale&order=termo`, { headers: H })).json();
    console.log(`  sinônimos cadastrados: ${sin.length}`);
    for (const s of sin) console.log(`    "${s.termo}" também procura "${s.equivale}"`);
    console.log('');
    console.log('  grafia                  tipo         licit.   pelo objeto  pelos itens  itens casados');
    console.log('  ' + '─'.repeat(88));
  }

  for (const t of lista) {
    for (const g of grafiasDe(t)) {
      const r = await busca(g);
      const tipo = (t.equivalentes || []).includes(g) ? 'equivalente'
        : (t.truncadas || []).includes(g) ? 'truncada' : 'refinamento';
      saida.push({ produto: t.produto, grafia: g, tipo, ...r, amostra: undefined });
      if (!tem('--json')) {
        console.log('  ' + g.padEnd(24) + tipo.padEnd(13)
          + String(r.total).padStart(7)
          + String(r.porObjeto).padStart(13)
          + String(r.porItem).padStart(13)
          + String(r.itens).padStart(15));
      }
    }
    /* SÓ AS EQUIVALENTES SÃO COBRADAS. Se "gaze" e "gazes" devolvem números diferentes, uma das
       duas está mentindo pra quem digitou — e é esse o defeito que esta ferramenta existe pra
       achar. Refinamento mais estreito não é defeito, é a busca sendo "E". */
    const eq = saida.filter(x => x.produto === t.produto && x.tipo === 'equivalente');
    const nums = [...new Set(eq.map(x => x.total))];
    if (nums.length > 1) {
      divergem++;
      if (!tem('--json')) {
        console.log(`  ${' '.repeat(24)}⚠️  DEFEITO: grafias equivalentes de "${t.produto}" `
          + `devolvem números diferentes: ${eq.map(x => `${x.grafia}=${x.total}`).join(' · ')}`);
      }
    }
    if (so && !tem('--json')) {
      console.log('\n  exemplos:');
      const r = await busca(grafiasDe(t)[0]);
      for (const a of r.amostra) {
        console.log(`    ${a.numero_controle} · ${a.municipio}/${a.uf} · casou em ${a.casou_em}`
          + ` · ${a.itens_casados} item(ns)`);
        console.log(`      ${String(a.objeto || '').slice(0, 90)}`);
      }
    }
  }

  if (tem('--json')) { console.log(JSON.stringify(saida, null, 1)); return; }

  const zeros = saida.filter(x => x.total === 0);
  console.log('\n  ' + '─'.repeat(88));
  console.log(`  ${saida.length} grafia(s) medida(s) · ${divergem} produto(s) com grafias equivalentes divergindo`
    + ` · ${zeros.length} com ZERO resultado`);
  if (zeros.length) console.log('    zeradas: ' + zeros.map(z => `"${z.grafia}" (${z.tipo})`).join(', '));
  /* O LIMITE DECLARADO, e ele não é conserto desta fatia: busca por PEDAÇO de palavra ("soro
     fisiol") não existe. O tsvector casa palavra inteira ou radical, nunca prefixo digitado pela
     metade — e o índice trigram, que serviria, existe só sobre o `objeto`, e não sobre a
     descrição dos itens, que é onde o nome do produto mora. Fica escrito em vez de arredondado. */
  const trunc = saida.filter(x => x.tipo === 'truncada');
  if (trunc.length) {
    console.log('\n  LIMITE DECLARADO: busca por pedaço de palavra não existe —'
      + ` ${trunc.map(t => `"${t.grafia}" = ${t.total}`).join(', ')}.`);
    console.log('    O tsvector casa palavra inteira ou radical, nunca meia palavra. Não é');
    console.log('    defeito desta fatia; é uma porta que ninguém abriu ainda.');
  }
  process.exitCode = divergem ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
