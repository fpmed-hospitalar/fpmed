/* ═══════════════════════════════════════════════════════════════════════════════════════════
   mede_dm_certame.js — O SEGUNDO PASSO DA FATIA A25 (14/08/2026, Trabalhador A)

   A `mede_diario_municipal.js` mediu a sobreposição do diariomunicipal.com.br (SIGPub) em
   quatro ângulos, e o mais importante deles saiu FRACO por limitação do método, não da fonte:

     (C) o certame ESPECÍFICO, casado por número+ano ....... 21 de 46  (46%)

   O próprio log diz por quê: aquele casamento foi feito contra a PÁGINA do PNCP por município,
   que devolve no máximo 100 certames. Município grande tem mais que isso — Gravatá tem 1.992 —,
   então "não casou" ali quer dizer, muitas vezes, "está lá, fora da página que eu li".
   >>> 46% É PISO, E PISO NÃO DECIDE NADA. A regra de economia da caixa manda construir coletor
       quando a sobreposição é BAIXA. Parar num número que eu sei estar subestimado seria
       decidir com o dado errado nas duas direções: construir um coletor que não precisa
       existir, ou não construir o que precisa.

   ══ O QUE ESTA FERRAMENTA FAZ DE DIFERENTE ═════════════════════════════════════════════════
   Pergunta ao PNCP por CADA aviso, um a um, pelo `/api/search/` — que resolve por consulta de
   texto e varre o país inteiro, sem página de município no meio. É o mesmo endpoint e o mesmo
   User-Agent identificado da `coleta_pncp_busca.js` (a lição da A22: o portal continua sabendo
   quem chama).

   MURALHAS: só consulta pública, sem login, sem burlar barreira, ritmo educado (1 chamada por
   segundo), e nada é gravado no banco — esta é uma MEDIÇÃO, não uma coleta.

     node tools/mede_dm_certame.js [--json _a25_amupe.json]
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const ARQ = path.join(RAIZ, arg('--json') || '_a25_amupe.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
  + 'Chrome/120.0.0.0 Safari/537.36 FPMED-Hospitalar/1.0 (medicao de fontes publicas; +licitacao@fpmed.com.br)';
const dormir = ms => new Promise(r => setTimeout(r, ms));
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function busca(q) {
  const u = 'https://pncp.gov.br/api/search/?q=' + encodeURIComponent(q)
    + '&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=20&status=todos';
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(30000) });
      if (r.status === 429) { await dormir(4000 * (t + 1)); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (t === 2) return { _erro: e.message };
      await dormir(2000 * (t + 1));
    }
  }
  return { _erro: 'sem resposta' };
}

(async () => {
  const j = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
  const avisos = j.detalhe || [];
  const comNumero = avisos.filter(a => a.numero && a.ano);
  console.log('═══ A25 · o certame do diário existe no PNCP? (pergunta um a um) ═══\n');
  console.log(`fonte: ${j.assoc}/${j.uf} · janela ${j.de} a ${j.ate}`);
  console.log(`avisos de saúde na amostra: ${avisos.length} · com número legível: ${comNumero.length}`);
  console.log(`  (o casamento por página de município já tinha achado ${j.casados})\n`);

  let achou = 0, jaTinha = 0, naoAchou = 0, erro = 0;
  const conferidos = [], casados = [];
  for (let i = 0; i < comNumero.length; i++) {
    const a = comNumero[i];
    /* A CONSULTA É "MUNICÍPIO + NÚMERO/ANO", que é como o certame é nomeado nos dois lados.
       Buscar só pelo número acharia o pregão 2/2026 de 5.570 prefeituras. */
    const q = `${a.municipio} ${a.numero}/${a.ano}`;
    const r = await busca(q);
    if (r._erro) { erro++; console.log(`  [${i + 1}/${comNumero.length}] ${a.municipio} ${q} · ERRO ${r._erro}`); await dormir(1000); continue; }
    const itens = r.items || r.results || [];
    /* ══ A REGRA DE CASAMENTO, APERTADA DEPOIS DE UM FALSO POSITIVO MEDIDO ═══════════════════
       A primeira versão desta função casava contra um BLOB de texto (órgão + unidade +
       município + título + descrição). Ela deu 52%, e o segundo dos três conferidos à mão
       estava ERRADO: "Goiana 7/2026" casou com `00394544000185-1-001695/2026`, que é o
       MINISTÉRIO DA SAÚDE comprando ENERGIA ELÉTRICA para a fábrica da Hemobrás — o registro
       é de Brasília/DF e só menciona "Goiana/PE" no meio da descrição, e o título dele é
       "Edital nº 7/2026", que bateu com o número por coincidência.
       >>> UM FALSO POSITIVO EM TRÊS CONFERIDOS À MÃO É 33% DE ERRO NA AMOSTRA QUE EU MESMO
           ESCOLHI PARA MOSTRAR. O número de 52% estava inflado, e teria decidido a fatia.
       >>> ENTÃO O CASAMENTO PASSOU A USAR OS CAMPOS PRÓPRIOS, e não texto solto:
             · `uf` tem que ser a da associação;
             · `municipio_nome` tem que ser o município do aviso (campo, não menção);
             · `ano` tem que bater;
             · e o número do ÓRGÃO tem que estar no `title` ("Edital nº 7/2026").
       >>> O `numero_sequencial` NÃO SERVE, e isso é a lição da A21 de novo: ele é o sequencial
           do PNCP (1695), e não o número do edital do órgão (7). Comparar os dois casaria
           certame errado com cara de acerto. */
    const mun = semAcento(a.municipio);
    const nTitulo = new RegExp('(^|\\D)0*' + String(a.numero) + '\\s*/\\s*' + String(a.ano) + '(\\D|$)');
    const alvo = itens.find(x =>
      String(x.uf || '').toUpperCase() === String(j.uf || '').toUpperCase()
      && semAcento(x.municipio_nome) === mun
      && String(x.ano || '') === String(a.ano)
      && nTitulo.test(semAcento(x.title))
    );
    if (alvo) {
      achou++;
      casados.push({ a, alvo });
      if (a.pncp_casou) jaTinha++;
      if (conferidos.length < 3) conferidos.push({ a, alvo, q });
      console.log(`  [${i + 1}/${comNumero.length}] ${a.municipio} ${a.numero}/${a.ano} -> ${alvo.numero_controle_pncp || alvo.id || '(sem nº de controle)'}`);
    } else {
      naoAchou++;
      console.log(`  [${i + 1}/${comNumero.length}] ${a.municipio} ${a.numero}/${a.ano} -> não achei (total devolvido: ${itens.length})`);
    }
    await dormir(1000);   // ritmo educado: 1 chamada por segundo contra serviço público
  }

  /* ══ A PERGUNTA QUE DECIDE A FATIA, E NÃO É "ESTÁ LÁ?" ═══════════════════════════════════════
     O "não achei" acima é, na maior parte, limite da BUSCA e não da fonte — medido: pedindo
     "Custódia 10/2026" o PNCP devolve 20 de 127 registros, e os da prefeitura têm título
     "Edital nº 013 - FMS/2026", com sufixo de órgão no meio do número. Ou seja: o certame está
     lá, com outro nome, fora da página que a busca devolveu.
     >>> ENTÃO A SOBREPOSIÇÃO CERTAME-A-CERTAME NÃO SE FECHA POR ESTE CAMINHO, e insistir nela
         seria decidir com um piso. A pergunta que a caixa realmente faz é outra, e está escrita
         nela: o diário "é onde aparece a prefeitura que ATRASA o PNCP". Isso se mede — e é o
         que decide se a fonte tem valor mesmo quando o certame também está no PNCP.
     A conta é: dia do aviso no diário  −  dia da publicação no PNCP. Negativo = o diário chegou
     ANTES. */
  const dias = [];
  for (const c of casados) {
    const [dd, mm, aa] = String(c.a.data).split('-');
    const dDiario = new Date(`${aa}-${mm}-${dd}T00:00:00Z`);
    const dPncp = new Date(String(c.alvo.data_publicacao_pncp || '').slice(0, 10) + 'T00:00:00Z');
    if (isNaN(dDiario) || isNaN(dPncp)) continue;
    dias.push({ mun: c.a.municipio, n: `${c.a.numero}/${c.a.ano}`,
      diario: `${dd}/${mm}`, pncp: String(c.alvo.data_publicacao_pncp).slice(0, 10),
      delta: Math.round((dDiario - dPncp) / 86400000) });
  }
  console.log('\n══ O DIÁRIO CHEGA ANTES DO PNCP? (nos que casaram, dia a dia) ════════════════');
  dias.sort((x, y) => x.delta - y.delta).forEach(d =>
    console.log(`  ${d.mun.padEnd(24)} ${d.n.padEnd(9)} diário ${d.diario} · PNCP ${d.pncp} · `
      + (d.delta < 0 ? `diário ${-d.delta} dia(s) ANTES` : d.delta > 0 ? `diário ${d.delta} dia(s) depois` : 'MESMO dia')));
  const antes = dias.filter(d => d.delta < 0).length;
  const mesmo = dias.filter(d => d.delta === 0).length;
  const depois = dias.filter(d => d.delta > 0).length;
  console.log(`  --> antes: ${antes} · mesmo dia: ${mesmo} · depois: ${depois}  (de ${dias.length} casados)`);

  const base = comNumero.length - erro;
  const pct = base ? Math.round(achou / base * 100) : 0;
  console.log('\n══ (C-refeito) O CERTAME ESPECÍFICO, PERGUNTADO AO PNCP UM A UM ══════════════');
  console.log(`  perguntados ......................... ${base}  (${erro} sem resposta)`);
  console.log(`  ACHADOS no PNCP ..................... ${achou}  (${pct}%)`);
  console.log(`  não achados ......................... ${naoAchou}`);
  console.log(`  já tinham casado pela página do mun.  ${jaTinha}  (antes: ${j.casados})`);
  console.log('\n══ OS 3 CONFERIDOS À MÃO (a caixa pede três) ═════════════════════════════════');
  conferidos.forEach((c, k) => {
    console.log(`  ${k + 1}. diário: ${c.a.municipio}/${j.uf} · ${c.a.modalidade} ${c.a.numero}/${c.a.ano}`
      + (c.a.processo ? ` · processo ${c.a.processo}` : '') + ` · publicado ${c.a.data}`);
    console.log(`     PNCP  : ${c.alvo.numero_controle_pncp || c.alvo.id}`);
    console.log(`             ${String(c.alvo.orgao_nome || c.alvo.title || '').slice(0, 70)}`);
    console.log(`             ${String(c.alvo.description || '').slice(0, 90).replace(/\s+/g, ' ')}`);
    console.log(`     consulta usada: "${c.q}"`);
  });
  console.log(`\n>>> VEREDITO: ${pct >= 80
    ? 'sobreposição ALTA com o PNCP — a fonte não traz certame que o PNCP não tenha.'
    : 'sobreposição abaixo de 80% no casamento um a um — ver a leitura no relatório.'}`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
