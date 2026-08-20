/* ═══════════════════════════════════════════════════════════════════════════════════════════
   prova_busca_local.js — O BANCO FILTRA IGUALZINHO AO NAVEGADOR? (fatia A34, 19/08/2026)

   ══ A PERGUNTA, E POR QUE ELA NÃO PODE FICAR SEM RESPOSTA ═══════════════════════════════════
   A A34 tirou o filtro de palavra do navegador e pôs no banco. Ganho medido: 18.946 KB → alguns
   KB por busca. Mas mudar ONDE o filtro roda tem um risco que não dá sintoma: se a régua do
   banco (`public.sem_acento` + `ilike`) for um fio diferente da régua do JavaScript
   (`semAcento(...).includes(...)`), a tela passa a NÃO MOSTRAR licitações que antes mostrava —
   e ninguém reclama do que não apareceu. É a pior categoria de regressão desta obra.

   >>> ENTÃO A IGUALDADE É MEDIDA, E SOBRE O ÍNDICE INTEIRO, NÃO SOBRE EXEMPLO ESCOLHIDO A DEDO.
       Esta ferramenta baixa os 11.843 `objeto` (só a coluna: ~2 MB, e uma vez), aplica o MESMO
       `semAcento` que a tela usa — copiado letra por letra do fpmed_teto_cmed.js — e compara o
       conjunto que ele acha com o conjunto que o `ilike` do banco acha. Divergiu uma linha, ela
       é impressa com o objeto inteiro.

     node tools/prova_busca_local.js
     node tools/prova_busca_local.js --termo "dipirona,cirúrgico,farmac"
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };

/* O `semAcento` da tela, copiado do fpmed_teto_cmed.js. A cópia aqui é DE PROPÓSITO e é o
   contrário da cópia que esta obra combate: ela existe para que a divergência apareça. Se o
   motor mudar e esta cópia não, o número abaixo muda e a prova acusa. */
const semAcento = s => {
  let o = '';
  for (const c of String(s || '').normalize('NFD')) {
    const k = c.codePointAt(0);
    if (k >= 0x300 && k <= 0x36f) continue;
    o += c;
  }
  return o.toLowerCase();
};

const TERMOS = (arg('--termo') || 'dipirona,albumina,seringa,farmac,medicamento,cirúrgico,solução,hospitalar')
  .split(',').map(s => s.trim()).filter(Boolean);

async function todasAsLinhas(sel) {
  let out = [], de = 0;
  for (let p = 0; p < 30; p++) {
    const r = await fetch(`${SB}/rest/v1/licitacoes?select=${sel}&order=id.asc`,
      { headers: { ...H, Range: de + '-' + (de + 999) } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    out = out.concat(j);
    if (j.length < 1000) return out;
    de += 1000;
  }
  return out;
}

/* O `%` e o `_` são coringas do LIKE; `*` é o coringa do PostgREST. Um termo com qualquer um
   dos três viraria uma busca diferente da que a pessoa digitou — e "seringa 20%" é um termo
   plausível neste ramo. */
const escapaLike = t => String(t).replace(/([%_\\])/g, '\\$1');

(async () => {
  console.log('lendo os objetos do índice (só a coluna `objeto`)…');
  const linhas = await todasAsLinhas('id,objeto');
  console.log('  ' + linhas.length + ' linhas\n');

  let falhas = 0;
  console.log('termo            JS(tela)   banco   iguais?');
  for (const t of TERMOS) {
    const alvo = semAcento(t);
    const noJs = new Set(linhas.filter(l => semAcento(l.objeto || '').includes(alvo)).map(l => l.id));

    /* PAGINADO, e este comentário é a lápide de um erro cometido AQUI, nesta ferramenta, na
       primeira execução: eu pedi `Range: 0-19999` de uma vez e o PostgREST devolveu 1.000. O
       termo "hospitalar" (1.354 licitações) acusou "só no JS: 354" — e o defeito era da RÉGUA,
       não do banco. É o mesmo teto de 1.000 que já mordeu o dicionário CMED e a busca da tela.
       Quarta vez. Régua que não pagina mede errado e culpa o medido. */
    const noBanco = new Set();
    for (let de = 0; de < 30000; de += 1000) {
      const r = await fetch(`${SB}/rest/v1/licitacoes?select=id&texto_busca=ilike.*${encodeURIComponent(escapaLike(alvo))}*&order=id.asc`,
        { headers: { ...H, Range: de + '-' + (de + 999) } });
      const j = await r.json();
      if (!Array.isArray(j) || !j.length) break;
      j.forEach(l => noBanco.add(l.id));
      if (j.length < 1000) break;
    }

    const soJs = [...noJs].filter(x => !noBanco.has(x));
    const soBanco = [...noBanco].filter(x => !noJs.has(x));
    const igual = !soJs.length && !soBanco.length;
    if (!igual) falhas++;
    console.log('  ' + t.padEnd(14) + String(noJs.size).padStart(7) + String(noBanco.size).padStart(9)
      + '   ' + (igual ? 'SIM' : 'NÃO — só no JS: ' + soJs.length + ' · só no banco: ' + soBanco.length));
    for (const id of soJs.slice(0, 3)) {
      const l = linhas.find(x => x.id === id);
      console.log('      [só no JS]    #' + id + ' ' + String(l.objeto).slice(0, 110));
    }
    for (const id of soBanco.slice(0, 3)) {
      const l = linhas.find(x => x.id === id);
      console.log('      [só no banco] #' + id + ' ' + String(l && l.objeto).slice(0, 110));
    }
  }
  console.log(falhas ? '\n❌ ' + falhas + ' termo(s) divergiram — a busca do banco NÃO é a busca da tela.'
                     : '\n✅ as duas réguas dão o mesmo conjunto em todos os termos.');
  process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
