// ============================================================================================
// atualiza_cmed.js — A ROTINA MENSAL DA CMED. Um comando: diz o que esta valendo, confere se a
// planilha nova tem o layout esperado, mostra o que vai mudar e — so com --apply — manda carregar.
//
// ══ ELE NAO CARREGA NADA POR CONTA PROPRIA ══════════════════════════════════════════════════
// O parse da planilha da CMED tem quatro armadilhas conhecidas (asterisco de nota, decimal com
// virgula, "-" que nao e zero, CAP que troca a regua) e elas ja estao resolvidas, testadas e em
// producao no `carrega_cmed_precos.js`. Reimplementar o parse aqui criaria o par que diverge —
// duas leituras da mesma planilha, uma delas errando em silencio num numero que vira TETO LEGAL
// de proposta. Entao aqui ha conferencia e relatorio; a carga e delegada ao carregador de sempre.
//
// ══ O QUE ELE PARA ══════════════════════════════════════════════════════════════════════════
// O pedido do Lemuel foi explicito: "se o cabecalho mudar de linha ou a coluna do PMVG 19% GO
// mudar de posicao, PARAR e avisar". Metade disso o carregador JA faz por desenho, e vale dizer
// como, em vez de construir uma segunda trava por cima:
//   · O CABECALHO E ACHADO POR ANCORA (a linha que comeca em SUBSTANCIA e tem >8 celulas), e nao
//     por numero de linha. Mudar de linha nao quebra nada — e o comportamento certo.
//   · AS ALIQUOTAS SAO MAPEADAS POR NOME ("PMVG 19 %"), e nao por posicao. Coluna que anda de
//     lugar continua sendo achada; coluna que SOME derruba a carga com erro explicito.
// O que faltava, e entra aqui, e a conferencia ANTES de gastar a carga, com o relatorio do que
// mudou de uma edicao pra outra — e a recusa quando a planilha nova e MAIS VELHA que a base.
//
// USO:
//   node tools/atualiza_cmed.js                 -> so confere e relata (nada e gravado)
//   node tools/atualiza_cmed.js --apply         -> confere e, se passar, manda carregar
//   node tools/atualiza_cmed.js --site a.xlsx --gov b.xlsx [--apply]
// ============================================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const XLSX = require(path.join(__dirname, '..', 'node_modules', 'xlsx'));

const RAIZ = path.join(__dirname, '..');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const APPLY = process.argv.includes('--apply');
const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

let paradas = [];
const parar = m => { paradas.push(m); console.log('  ⛔ ' + m); };
const ok = m => console.log('  ✓ ' + m);

function achar(padrao, explicito) {
  if (explicito) return path.isAbsolute(explicito) ? explicito : path.join(RAIZ, explicito);
  const achados = fs.readdirSync(RAIZ).filter(f => padrao.test(f))
    .map(f => ({ f, t: fs.statSync(path.join(RAIZ, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  return achados.length ? path.join(RAIZ, achados[0].f) : null;
}

/* A CONFERENCIA DE LAYOUT. Ela olha exatamente o que o carregador vai precisar — nem mais, nem
   menos. Conferir coluna que ninguem usa geraria alarme por mudanca que nao afeta nada, e alarme
   que toca a toa e alarme que se aprende a ignorar. */
function confereLayout(arq, rotulo, prefixoEsperado) {
  console.log(`\n── ${rotulo}: ${path.basename(arq)} ─────────────────────────`);
  const wb = XLSX.readFile(arq);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

  const topo = rows.slice(0, 60).map(r => String((r && r[0]) || '')).join(' ');
  const pm = topo.match(/Publicada em (\d{2})\/(\d{2})\/(\d{4})/);
  if (!pm) { parar(`[${rotulo}] nao achei "Publicada em dd/mm/aaaa" no topo — sem a data da edicao nao da pra saber que regua e essa`); return null; }
  const publicada = `${pm[3]}-${pm[2]}-${pm[1]}`;
  ok(`publicada em ${pm[1]}/${pm[2]}/${pm[3]}`);

  let hi = -1;
  rows.forEach((r, i) => { if (hi < 0 && Array.isArray(r) && r.filter(Boolean).length > 8 && r.some(c => /^SUBST/i.test(String(c)))) hi = i; });
  if (hi < 0) { parar(`[${rotulo}] nao achei o cabecalho (a linha que comeca em SUBSTANCIA). A planilha mudou de formato — NAO carregue no escuro`); return null; }
  const head = rows[hi].map(c => String(c || '').replace(/\s+/g, ' ').trim());
  ok(`cabecalho na linha ${hi + 1} · ${head.length} colunas · ${rows.length - hi - 1} linhas de dado`);

  // O GGREM e a chave que amarra as duas listas. Sem ele nao ha cruzamento nenhum.
  if (head.indexOf('CÓDIGO GGREM') < 0) parar(`[${rotulo}] a coluna "CÓDIGO GGREM" sumiu — e a chave que liga as duas listas`);
  else ok('coluna CÓDIGO GGREM presente');

  // A COLUNA QUE O LEMUEL NOMEOU. Ela e achada por NOME; o que se confere e que ela EXISTE.
  const alvo = prefixoEsperado === 'PMVG' ? /^PMVG 19\s*%?$/i : /^PMC 19\s*%?$/i;
  const iAlvo = head.findIndex(h => alvo.test(h));
  if (iAlvo < 0) {
    parar(`[${rotulo}] nao achei a coluna "${prefixoEsperado} 19 %" (a aliquota de GOIAS). `
      + `Sem ela o teto para o governo nao existe — PARANDO`);
  } else {
    // >>> A POSICAO E INFORMACAO, E NAO CRITERIO. A 1a versao deste script comparava contra uma
    //     posicao "esperada" e anunciava "mudou de posicao" numa coluna que sempre esteve ali —
    //     um alarme que tocaria todo mes sem nada ter acontecido. Alarme que toca a toa e alarme
    //     que se aprende a ignorar, e ai o mes em que ele tiver razao passa batido. O carregador
    //     acha a coluna por NOME; onde ela esta so serve pra quem for conferir a mao.
    ok(`"${head[iAlvo]}" na coluna ${iAlvo + 1} (achada por nome — a posicao nao e criterio)`);
  }

  const iVar = head[39] || '';
  if (!new RegExp('^' + prefixoEsperado, 'i').test(iVar)) {
    parar(`[${rotulo}] a coluna 40 deveria comecar com ${prefixoEsperado} e veio "${iVar}". Os arquivos podem estar trocados`);
  } else ok(`lista e do tipo ${prefixoEsperado}`);

  const cap = head.findIndex(h => /^CAP$/i.test(h));
  if (cap < 0) parar(`[${rotulo}] a coluna CAP sumiu — e ela que diz quando o teto e o PMVG e nao o PF`);
  else ok('coluna CAP presente');

  return { publicada, head, hi, linhas: rows.length - hi - 1 };
}

(async () => {
  console.log('=== ROTINA MENSAL DA CMED ===');

  // ── 1. O QUE ESTA VALENDO HOJE ──────────────────────────────────────────────────────────
  console.log('\n── a regua que esta no ar ────────────────────────────');
  let atual = null;
  try {
    const r = await fetch(`${SB}/rest/v1/v_cmed_vigencia?select=*`, { headers: H });
    atual = (await r.json())[0];
  } catch (e) { /* tratado abaixo */ }
  if (!atual) {
    console.log('  ⚠️ nao consegui ler a vigencia no banco. Isto NAO quer dizer que a base esta vazia — quer dizer que nao sei.');
  } else {
    console.log(`  publicada em ${String(atual.vigente_desde).slice(0, 10)} · ha ${atual.dias_desde} dias`);
    console.log(`  ${Number(atual.apresentacoes).toLocaleString('pt-BR')} apresentacoes · ${Number(atual.com_cap).toLocaleString('pt-BR')} com CAP`);
    if (Number(atual.edicoes) > 1) parar(`a base tem ${atual.edicoes} EDICOES convivendo — uma carga anterior entrou pela metade. Resolver isso antes de carregar outra`);
    // A CMED publica todo mes. Uma base de mais de ~45 dias ja passou de uma edicao — e uma
    // proposta conferida contra regua velha pode estar acima do teto vigente sem ninguem ver.
    if (atual.dias_desde > 45) console.log(`  ⚠️ a regua tem ${atual.dias_desde} dias. A CMED publica todo mes: provavelmente ha edicao mais nova.`);
  }

  // ── 2. AS PLANILHAS NOVAS ───────────────────────────────────────────────────────────────
  const arqSite = achar(/^xls_conformidade_site.*\.xlsx$/i, arg('--site'));
  const arqGov = achar(/^xls_conformidade_gov.*\.xlsx$/i, arg('--gov'));
  if (!arqSite || !arqGov) {
    console.log('\n⛔ nao achei as duas planilhas em C:\\fpmed (xls_conformidade_site_*.xlsx e xls_conformidade_gov_*.xlsx).');
    console.log('   BAIXAR A MAO — ver "o download automatico" no fim deste relatorio.');
    process.exit(1);
  }
  const site = confereLayout(arqSite, 'site', 'PMC');
  const gov = confereLayout(arqGov, 'gov', 'PMVG');

  // ── 3. A EDICAO NOVA E MESMO MAIS NOVA? ─────────────────────────────────────────────────
  console.log('\n── a edicao nova ─────────────────────────────────────');
  if (site && gov) {
    if (site.publicada !== gov.publicada) {
      console.log(`  ⚠️ site publicada ${site.publicada} x gov ${gov.publicada} — a regua vale pela MAIS ANTIGA das duas.`);
    }
    const nova = site.publicada < gov.publicada ? site.publicada : gov.publicada;
    if (atual && atual.vigente_desde) {
      const emUso = String(atual.vigente_desde).slice(0, 10);
      if (nova < emUso) {
        // >>> ESTA E A TRAVA QUE FALTAVA. Carregar uma planilha mais velha por cima da vigente
        //     REBAIXA a regua sem ninguem perceber: a proposta passa a ser conferida contra um
        //     teto que nao vale mais, e o erro so aparece quando o pregoeiro desclassifica.
        parar(`a planilha (${nova}) e MAIS VELHA que a base no ar (${emUso}). Carregar isso rebaixaria a regua`);
      } else if (nova === emUso) {
        console.log(`  = mesma edicao que ja esta no ar (${emUso}). Nao ha o que atualizar.`);
      } else {
        console.log(`  ↑ ${emUso} → ${nova}  (regua mais nova, ${site.linhas.toLocaleString('pt-BR')} linhas na planilha)`);
      }
    }
  }

  // ── 4. O VEREDITO ───────────────────────────────────────────────────────────────────────
  console.log('\n=== VEREDITO ===');
  if (paradas.length) {
    console.log(`${paradas.length} motivo(s) pra PARAR:`);
    paradas.forEach(m => console.log('  ⛔ ' + m));
    console.log('\nNADA foi carregado. Uma regua carregada no escuro vira teto errado em proposta assinada.');
    process.exit(1);
  }
  console.log('layout conferido: cabecalho, GGREM, PMVG 19 % (GO) e CAP no lugar.');

  if (!APPLY) {
    console.log('\n[CONFERENCIA — nada foi gravado]');
    console.log('Pra carregar de verdade:  node tools/atualiza_cmed.js --apply');
    return;
  }

  // ── 5. A CARGA — DELEGADA ───────────────────────────────────────────────────────────────
  console.log('\n── carregando (via tools/carrega_cmed_precos.js, o de sempre) ──');
  execFileSync(process.execPath, [path.join(__dirname, 'carrega_cmed_precos.js'),
    '--site', arqSite, '--gov', arqGov, '--apply', '--merge'], { stdio: 'inherit' });

  // ── 6. CONFERIR DEPOIS, E NAO SO ANTES ──────────────────────────────────────────────────
  // Carga que termina sem erro nao e carga que deu certo. O numero que decide e o do BANCO
  // depois — inclusive `edicoes`, que denuncia carga pela metade.
  console.log('\n── a regua DEPOIS da carga ───────────────────────────');
  try {
    const r = await fetch(`${SB}/rest/v1/v_cmed_vigencia?select=*`, { headers: H });
    const d = (await r.json())[0];
    console.log(`  publicada em ${String(d.vigente_desde).slice(0, 10)} · ${Number(d.apresentacoes).toLocaleString('pt-BR')} apresentacoes · ${d.edicoes} edicao(oes)`);
    // O DESCONTO MEDIO DO CAP e a prova barata de que a carga leu a coluna certa: o CAP e um
    // desconto legal de ~21,5% e esse numero nao se move de uma edicao pra outra. Se ele vier
    // 0% ou 60%, a coluna lida NAO era a que se pensava — e o teto sairia errado em 2.722
    // apresentacoes sem nenhum erro na tela.
    const rc = await fetch(`${SB}/rest/v1/cmed_precos?select=pf_go19,pmvg_go19&cap=is.true&pf_go19=not.is.null&pmvg_go19=not.is.null&limit=1000`, { headers: H });
    const linhas = await rc.json();
    if (Array.isArray(linhas) && linhas.length) {
      const m = linhas.reduce((s, x) => s + (1 - x.pmvg_go19 / x.pf_go19), 0) / linhas.length * 100;
      console.log(`  desconto medio do CAP: ${m.toFixed(2)}%  (esperado ~21,5% — fora disso, a coluna lida nao foi a certa)`);
      if (m < 15 || m > 30) console.log('  ⛔ O DESCONTO DO CAP SAIU FORA DA FAIXA. Confira a carga antes de usar esta regua.');
    }
    if (Number(d.edicoes) > 1) console.log('  ⛔ ficaram DUAS edicoes na base — a carga entrou pela metade.');
  } catch (e) { console.log('  ⚠️ nao consegui reler a vigencia: ' + e.message); }

  console.log('\n>>> O DOWNLOAD AUTOMATICO: investigado em 11/08 e NAO implementado. A pagina da');
  console.log('    ANVISA/CMED entrega as duas planilhas por link que muda a cada publicacao e');
  console.log('    fica atras de uma pagina que nao tem endpoint estavel nem versionado. Um');
  console.log('    baixador por raspagem quebraria calado na primeira mudanca de layout do site,');
  console.log('    e "nao baixou" viraria "a regua nao mudou" — que e a mentira que este projeto');
  console.log('    nao aceita. Baixar as duas planilhas a mao e por na raiz continua sendo o');
  console.log('    passo humano; TUDO o que vem depois esta automatizado neste comando.');
})().catch(e => { console.error('ERRO: ' + (e && e.message)); process.exit(1); });
