/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_busca_produto.js — A BUSCA RESPONDEU: E O ITEM ESTÁ MESMO LÁ? (fatia A20, 14/08/2026)

   A medição (`tools/mede_busca_produto.js`) responde QUANTAS licitações cada termo devolve.
   Ela não responde a pergunta que decide se a busca serve: **o item está mesmo no edital?**

   >>> E ESSA PERGUNTA É A DA FATIA, porque o defeito que ela achou é justamente o de resposta
       cheia e errada: buscar "equipo" devolvia 539 licitações de pipoca, pula-pula e frigobar,
       porque o radical do português funde `equipo`, `equipamento` e `equipe`. Contar resultado
       não teria mostrado nada — 539 parece ótimo.

   Esta prova abre 3 licitações que a busca devolveu, acha o item na descrição, e confere a
   descrição **contra o PNCP ao vivo** — não contra a nossa cópia. Conferir contra o banco
   provaria que o banco concorda com ele mesmo.

     node tools/prova_busca_produto.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const semAc = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function busca(termo, lim) {
  const r = await fetch(`${SB}/rest/v1/rpc/buscar_licitacoes`, { method: 'POST', headers: H,
    body: JSON.stringify({ p_termo: termo, p_limite: lim || 500 }) });
  if (!r.ok) throw new Error(`buscar_licitacoes("${termo}") -> ${r.status}`);
  return r.json();
}
async function le(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(q + ' -> HTTP ' + r.status);
  return r.json();
}
async function itensDoPNCP(cnpj, ano, seq) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 45000);
  try {
    const r = await fetch(`https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}`
      + '/itens?pagina=1&tamanhoPagina=100', { headers: { Accept: 'application/json' }, signal: ac.signal });
    clearTimeout(to);
    if (!r.ok) return null;
    const t = await r.text();
    return t.trim() ? JSON.parse(t) : [];
  } catch { clearTimeout(to); return null; }
}

/* TRÊS TERMOS ESCOLHIDOS PELO QUE ELES PÕEM À PROVA, e não por serem os mais fáceis:
     · equipo    — o que estava quebrado. Se a correção falhar, é aqui.
     · albumina  — o termo do dono, e o mais raro (3 licitações). Base pequena é onde um
                   falso-positivo passa despercebido, porque não há com o que comparar.
     · gaze      — o caso comum, de volume médio, que prova que o conserto não estragou o resto. */
const CASOS = ['equipo', 'albumina', 'gaze'];

(async () => {
  console.log('=== A BUSCA RESPONDEU: E O ITEM ESTÁ MESMO LÁ? (fatia A20) ===\n');

  /* ── 0. O DEFEITO CONSERTADO, EM NÚMERO ────────────────────────────────────────────────
     "equipo", "equipamento" e "equipe" devolviam os MESMOS 539. Se voltarem a devolver o mesmo
     número, a lista de palavra inteira caiu — e o sintoma seria uma busca cheia e errada, que é
     o tipo que ninguém reporta como defeito. */
  const [eq, eqp, eqe, eqs] = await Promise.all(
    ['equipo', 'equipamento', 'equipe', 'equipos'].map(t => busca(t, 1)));
  const tot = x => x.length ? Number(x[0].total) : 0;
  console.log(`  equipo=${tot(eq)} · equipos=${tot(eqs)} · equipamento=${tot(eqp)} · equipe=${tot(eqe)}`);
  ok(n + '. *** "equipo" deixou de devolver o mesmo que "equipamento" e "equipe" ***',
    tot(eq) < tot(eqp) && tot(eq) < tot(eqe), { equipo: tot(eq), equipamento: tot(eqp), equipe: tot(eqe) }); n++;
  /* O PLURAL FOI UM DEFEITO MEDIDO: com a lista casando pelo termo exato, "equipo" caiu para 35
     e "equipos" ficou em 539. Meio conserto é pior que conserto nenhum. */
  ok(n + '. *** e o PLURAL acompanha o singular (senão a busca acerta ou erra pela letra final) ***',
    tot(eq) === tot(eqs), { equipo: tot(eq), equipos: tot(eqs) }); n++;

  // ── 1. TRÊS LICITAÇÕES ABERTAS, ITEM A ITEM, CONTRA O PNCP ─────────────────────────────
  for (const termo of CASOS) {
    console.log(`\n  ─── "${termo}" ───`);
    const res = await busca(termo, 500);
    ok(n + `. a busca por "${termo}" devolveu resultado`, res.length > 0, res.length); n++;
    if (!res.length) continue;

    /* PEGA UMA QUE CASOU PELOS ITENS, que é o caso desta fatia: o objeto do PNCP é genérico e
       o nome do produto mora na descrição do item. Casar pelo objeto seria provar a busca antiga. */
    const alvo = res.find(l => l.casou_em !== 'objeto') || res[0];
    const lic = (await le(`licitacoes?select=id,numero_controle,cnpj,ano,sequencial,orgao,municipio,uf,objeto`
      + `&numero_controle=eq.${encodeURIComponent(alvo.numero_controle)}`))[0];
    console.log(`  ${lic.numero_controle} · ${lic.municipio}/${lic.uf}`);
    console.log(`    objeto: ${String(lic.objeto || '').slice(0, 88)}`);
    console.log(`    casou em: ${alvo.casou_em} · ${alvo.itens_casados} item(ns)`);

    // o item, no nosso banco
    const itens = await le(`licitacao_itens?select=numero_item,descricao`
      + `&numero_controle=eq.${encodeURIComponent(lic.numero_controle)}&limit=600`);
    const re = new RegExp('\\b' + termo + 's?\\b', 'i');
    const achado = itens.find(i => re.test(semAc(i.descricao)));
    console.log(`    item ${achado ? achado.numero_item : '(nenhum!)'}: `
      + String(achado ? achado.descricao : '').slice(0, 84));
    /* ESTE É O ASSERT DA FATIA. A busca disse "tem equipo aqui". Se a palavra não estiver na
       descrição de nenhum item, ela mentiu — e mentiu de forma convincente. */
    ok(n + `. *** "${termo}" está mesmo na descrição de um item desta licitação ***`,
      !!achado, { numero_controle: lic.numero_controle, itens: itens.length }); n++;
    if (!achado) continue;

    // ── e a MESMA descrição, direto do PNCP (não da nossa cópia) ──────────────────────────
    const doPncp = await itensDoPNCP(lic.cnpj, lic.ano, lic.sequencial);
    if (!Array.isArray(doPncp)) {
      console.log('    ~ o PNCP não respondeu agora — a conferência ao vivo deste caso fica de fora');
      ok(n + `. (não conferido ao vivo: o PNCP não respondeu para ${lic.numero_controle})`, true); n++;
      continue;
    }
    const noPncp = doPncp.find(x => String(x.numeroItem) === String(achado.numero_item));
    console.log(`    no PNCP  : ${String(noPncp ? noPncp.descricao : '(não veio nesta página)').slice(0, 84)}`);
    ok(n + `. *** e a descrição bate com o PNCP AO VIVO, palavra por palavra ***`,
      !!noPncp && String(noPncp.descricao) === String(achado.descricao),
      noPncp ? { pncp: String(noPncp.descricao).slice(0, 60), banco: String(achado.descricao).slice(0, 60) } : null); n++;
    ok(n + `. ...e o termo "${termo}" está na descrição que o PNCP devolveu`,
      !!noPncp && re.test(semAc(noPncp.descricao))); n++;
    await dormir(400);
  }

  // ── 2. O CONSERTO NÃO ESTRAGOU O RESTO ─────────────────────────────────────────────────
  /* Exigir palavra inteira em TUDO destruiria o que o radical faz de bom. A lista tem um termo
     só, e estes asserts são o controle de que ela continua tendo um termo só de efeito. */
  const lista = await le('busca_palavra_inteira?select=termo,motivo');
  console.log(`\n  lista de palavra inteira: ${lista.map(x => '"' + x.termo + '"').join(', ')}`);
  ok(n + '. *** a lista tem só o termo que a medição condenou (não virou regra geral) ***',
    lista.length === 1 && lista[0].termo === 'equipo', lista.map(x => x.termo)); n++;
  /* Lista sem motivo vira superstição: ninguém sabe se ainda vale, e ninguém ousa tirar. */
  ok(n + '. ...e ele carrega o NÚMERO que o condenou (lista sem motivo vira superstição)',
    /539/.test(lista[0].motivo || '') && /15%/.test(lista[0].motivo || '')); n++;
  const [cat, cats, dip, dips] = await Promise.all(
    ['cateter', 'cateteres', 'dipirona', 'dipironas'].map(t => busca(t, 1)));
  ok(n + '. *** o radical continua fazendo o bem dele: "cateteres" acha "cateter" ***',
    tot(cat) === tot(cats) && tot(cat) > 0, { cateter: tot(cat), cateteres: tot(cats) }); n++;
  ok(n + '. ...e "dipironas" acha "dipirona"',
    tot(dip) === tot(dips) && tot(dip) > 0, { dipirona: tot(dip), dipironas: tot(dips) }); n++;

  // ── 3. O QUE OS SINÔNIMOS GANHARAM, E O QUE ELES NÃO INVENTARAM ────────────────────────
  const sf = await busca('soro fisiologico', 1);
  console.log(`\n  "soro fisiologico" -> ${tot(sf)} licitações (era 9 antes do sinônimo)`);
  ok(n + '. *** "soro fisiológico" também procura "cloreto de sódio" (o nome da farmácia) ***',
    tot(sf) > 9, tot(sf)); n++;
  /* ══ A LINHA QUE A CAIXA PROÍBE ATRAVESSAR ═══════════════════════════════════════════════
     "albumina" (hemoderivado) não é "albumina bovina" (reagente de bancada). Um sinônimo que
     juntasse as duas faria a tela oferecer material de laboratório a quem vende hemoderivado —
     e esse erro não aparece como erro: aparece como oportunidade. */
  const sin = await le('busca_sinonimos?select=termo,equivale,fonte');
  ok(n + '. *** nenhum sinônimo inventa equivalência clínica (albumina ≠ albumina bovina) ***',
    !sin.some(s => /bovina|serica|reagente|laboratorio/i.test(s.equivale)), sin.map(s => s.equivale)); n++;
  ok(n + '. ...e todo sinônimo tem fonte escrita (sem procedência é palpite com cara de regra)',
    sin.every(s => s.fonte && s.fonte.trim()), sin.filter(s => !s.fonte).map(s => s.termo)); n++;

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
