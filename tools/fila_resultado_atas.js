/* ══════════════════════════════════════════════════════════════════════════════════════════
   fila_resultado_atas.js — OS NEGÓCIOS EM ATA NA FILA DO RESULTADO POR ITEM
   Fatia A14, item 4 · 14/08/2026.

   O QUE ELE FAZ: pega os negócios que terminaram em ATA (fase `contrato` — os que a FPMED
   GANHOU), descobre o número de controle do PNCP de cada um e manda o `coleta_resultados.js`
   buscar itens e resultado por item. Caminho DE GRAÇA: é a API pública do PNCP, sem IA paga.

   ══ A MEDIÇÃO QUE MANDA NESTA FERRAMENTA, E ELA É UM "NÃO" ═════════════════════════════════
   Medido em 14/08 sobre as 105 Atas: **ZERO têm `numero_controle`** e **zero têm
   `licitacao_id`**. Elas vieram do Calendário 2025 — uma planilha — que nunca teve a chave do
   PNCP. Sem chave não há o que pedir ao portal: o PNCP responde por número de controle.

   >>> E EU TENTEI CASAR NA MARRA, E O RESULTADO FOI O MOTIVO DE NÃO FAZER ISSO. Juntando por
       UF + ano + número da compra, as 105 deram: 2 casamentos "únicos", 3 ambíguos, 100 sem
       nada. E os DOIS únicos estavam ERRADOS quando olhados de perto:
           "60/2026 · GO · PALMEIRAS DE GOIÁS"  casou com  CÂMARA MUNICIPAL DE JATAÍ
           "4/2026 · GO · PARAÚNA"              casou com  MUNICÍPIO DE CAMPO LIMPO DE GOIÁS
       Cidades diferentes, órgãos diferentes. O número de pregão se repete entre municípios —
       "P.E. 4/2026" existe em centenas de prefeituras no mesmo ano.
   >>> ENTÃO A REGRA AQUI EXIGE O MUNICÍPIO TAMBÉM, e recusa qualquer coisa menos. Com ela, o
       resultado honesto de hoje é ZERO de 105 — e zero é a resposta certa. Amarrar o resultado
       de OUTRA licitação num negócio ganho não daria erro nenhum: daria um "quem venceu" e um
       "por quanto" plausíveis, sobre um edital que não é o nosso, dentro da tela que a pessoa
       usa pra decidir preço. Erro que parece dado é pior que erro que parece erro.

   ══ ENTÃO POR QUE A FERRAMENTA EXISTE ══════════════════════════════════════════════════════
   Porque a chave passou a ser gravada. Desde a fatia A9, "Mandar pro funil" na Encontrar grava
   `numero_controle` (e `licitacao_id` quando a licitação está no índice) — antes ele gravava só
   o `numero` da compra. Todo negócio nascido daqui pra frente entra nesta fila sozinho. O que
   não volta é o passado que veio da planilha, e isso está dito no relatório, não escondido
   numa contagem.

     node tools/fila_resultado_atas.js              (PRÉVIA — só diz o que faria)
     node tools/fila_resultado_atas.js --executar   (chama o coletor pra cada Ata resolvida)
     node tools/fila_resultado_atas.js --teto 20
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const EXECUTAR = process.argv.includes('--executar');
const TETO = parseInt(arg('--teto') || '30', 10);

const soNum = s => String(s || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
const chave = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]/g, '');
function parteNumero(s) {
  const m = String(s || '').match(/^(\d+)\s*\/\s*(\d{4})$/);
  return m ? { n: soNum(m[1]), ano: Number(m[2]) } : { n: soNum(s), ano: null };
}

async function le(q, faixa) {
  const h = faixa ? { ...H, Range: faixa } : H;
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: h });
  if (!r.ok) throw new Error(`${q} -> HTTP ${r.status}`);
  return r.json();
}

async function indiceInteiro() {
  /* O ÍNDICE VEM PAGINADO. Esta instância corta em 1000 e não avisa — é a terceira vez que o
     mesmo teto morde esta obra, e uma leitura parcial aqui viraria "não achei correspondência"
     sobre licitações que estão no banco. */
  let out = [], de = 0;
  for (;;) {
    const lote = await le('licitacoes?select=id,numero_controle,numero_compra,ano,uf,municipio,orgao',
      `${de}-${de + 999}`);
    if (!Array.isArray(lote) || !lote.length) break;
    out = out.concat(lote);
    if (lote.length < 1000) break;
    de += 1000;
  }
  return out;
}

(async () => {
  console.log('=== ATAS NA FILA DO RESULTADO POR ITEM (fatia A14 item 4) ==='
    + (EXECUTAR ? '' : '   [PRÉVIA — nada coletado]'));

  const atas = await le('negocios?select=id,titulo,numero,orgao,municipio,uf,abertura,valor_ganho,'
    + 'numero_controle,licitacao_id&estagio=eq.contrato&limit=500');
  console.log(`\n${atas.length} negócio(s) em Ata (fase contrato)`);

  const comChave = atas.filter(a => a.numero_controle);
  const comId = atas.filter(a => !a.numero_controle && a.licitacao_id);
  console.log(`  com numero_controle gravado ....... ${comChave.length}`);
  console.log(`  sem ele, mas com licitacao_id ..... ${comId.length}`);

  // ── resolve os que têm licitacao_id ────────────────────────────────────────────────────
  const resolvidos = new Map();          // negocio.id -> { numero_controle, como }
  for (const a of comChave) resolvidos.set(a.id, { nc: a.numero_controle, como: 'numero_controle gravado' });
  if (comId.length) {
    const ids = [...new Set(comId.map(a => a.licitacao_id))];
    const lics = await le(`licitacoes?select=id,numero_controle&id=in.(${ids.join(',')})`);
    const porId = new Map(lics.map(l => [l.id, l.numero_controle]));
    for (const a of comId) {
      const nc = porId.get(a.licitacao_id);
      if (nc) resolvidos.set(a.id, { nc, como: 'licitacao_id' });
    }
  }

  // ── a junção conservadora, para quem não tem nem uma nem outra ──────────────────────────
  const orfaos = atas.filter(a => !resolvidos.has(a.id));
  let unico = 0, ambiguo = 0, semNada = 0, recusadoPorMunicipio = 0;
  if (orfaos.length) {
    const idx = new Map();
    for (const l of await indiceInteiro()) {
      const k = `${l.uf}|${l.ano}|${soNum(l.numero_compra)}`;
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(l);
    }
    for (const a of orfaos) {
      const p = parteNumero(a.numero);
      const ano = p.ano || (a.abertura ? new Date(a.abertura).getUTCFullYear() : null);
      const bate = idx.get(`${a.uf}|${ano}|${p.n}`) || [];
      if (!bate.length) { semNada++; continue; }
      if (bate.length > 1) { ambiguo++; continue; }
      /* ══ O MUNICÍPIO É OBRIGATÓRIO, E ELE É O ASSUNTO DESTA FERRAMENTA ═════════════════════
         Sem esta conferência, as duas correspondências "únicas" de 14/08 teriam entrado — e as
         duas eram de cidade errada. Um resultado de item amarrado no edital errado não aparece
         como defeito: aparece como um preço plausível dentro da tela em que se decide preço. */
      if (chave(bate[0].municipio) !== chave(a.municipio)) {
        recusadoPorMunicipio++;
        console.log(`  ✗ ${a.numero} · ${a.uf} · ${a.municipio}  →  recusado: o índice traz `
          + `${bate[0].municipio} (${bate[0].orgao})`);
        continue;
      }
      unico++;
      resolvidos.set(a.id, { nc: bate[0].numero_controle, como: 'junção número+UF+ano+município' });
    }
  }

  console.log(`\n  junção conservadora: ${unico} aceita(s) · ${recusadoPorMunicipio} recusada(s) por município`
    + ` · ${ambiguo} ambígua(s) · ${semNada} sem correspondência no índice`);
  console.log(`\n>>> NA FILA: ${resolvidos.size} de ${atas.length} Ata(s) com número de controle do PNCP.`);
  if (!resolvidos.size) {
    console.log('    As Atas vieram do Calendário 2025 (uma planilha), que nunca teve a chave do');
    console.log('    PNCP. Sem chave não há o que pedir ao portal. Desde a fatia A9 a Encontrar');
    console.log('    grava o numero_controle ao mandar pro funil — quem nascer daqui pra frente');
    console.log('    entra nesta fila sozinho. Ver o cabeçalho deste arquivo.');
    return;
  }

  if (!EXECUTAR) {
    for (const [id, r] of [...resolvidos].slice(0, TETO)) console.log(`  negócio ${id} → ${r.nc}  (${r.como})`);
    console.log('\n(prévia — rode com --executar pra coletar)');
    return;
  }

  let ok = 0, erro = 0;
  for (const [id, r] of [...resolvidos].slice(0, TETO)) {
    console.log(`\n── negócio ${id} → ${r.nc}  (${r.como})`);
    try {
      /* CHAMA O COLETOR QUE JÁ EXISTE, e não uma segunda cópia da mesma lógica: o resultado por
         item tem regra própria (o de menor ordemClassificacaoSrp entre os não cancelados), e
         uma segunda implementação dela um dia entregaria um cancelamento como vencedor. */
      const saida = execFileSync(process.execPath,
        [path.join(__dirname, 'coleta_resultados.js'), '--controle', r.nc],
        { encoding: 'utf8', timeout: 600000 });
      process.stdout.write(saida.split('\n').filter(l => l.trim()).slice(-3).join('\n') + '\n');
      ok++;
    } catch (e) {
      console.log('  ⚠️ ' + String(e.message || e).split('\n')[0]);
      erro++;
    }
  }
  console.log(`\n── resumo ──  ${ok} Ata(s) coletada(s) · ${erro} com erro`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
