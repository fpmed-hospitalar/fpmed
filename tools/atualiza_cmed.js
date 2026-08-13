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

// A descoberta mora em tools/pastas_cmed.js desde 13/08: procura em dados_cmed/ e, como
// fallback, na raiz. Quatro ferramentas tinham a sua propria copia deste laco com `C:/fpmed`
// escrito a mao, e as quatro quebrariam quando as planilhas saissem da raiz.
const achar = require('./pastas_cmed.js').achar;

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

/* ══ A CONFERENCIA DO ACERVO — UMA SO, CHAMADA NOS DOIS MOMENTOS ═══════════════════════════
   O que merece alarme depois do item 10 nao e QUANTAS edicoes existem (guardar a anterior e o
   desenho: e ela que mantem auditavel o teto de uma proposta antiga), e sim se alguma esta
   INCOMPLETA — carga que morreu no meio deixa edicao com um punhado de linhas.
   >>> ANTES E DEPOIS PEDEM ACOES DIFERENTES DE QUEM LE, e por isso o momento entra no texto:
       ANTES, edicao vigente incompleta e motivo pra PARAR — carregar por cima de uma base que
       ja esta mentindo so empilha problema. DEPOIS, ela e o diagnostico do que acabou de
       acontecer, e parar nao desfaz nada; o que serve e dizer com todas as letras que a regua
       de hoje saiu de uma carga pela metade.
   >>> E E UMA FUNCAO SO PORQUE EU TINHA ESCRITO DUAS. A mutacao de 13/08 passou verde
       justamente por causa disso: mutei uma copia e o assert continuou casando com a outra.
       Duas conferencias do mesmo defeito sao duas respostas que um dia discordam. */
async function conferirAcervo(momento) {
  try {
    const re = await fetch(`${SB}/rest/v1/cmed_edicoes?select=edicao,apresentacoes,vigente`, { headers: H });
    const lista = re.ok ? await re.json() : [];
    const magras = lista.filter(e => Number(e.apresentacoes) < 1000);
    if (!magras.length) return;
    console.log(`  ⚠️ ${magras.length} edicao(oes) com menos de 1.000 linhas — carga que morreu no meio:`);
    magras.forEach(e => console.log(`     ${String(e.edicao).slice(0, 10)}: ${e.apresentacoes} linhas`
      + (e.vigente ? '  <-- E A VIGENTE, isto E grave' : '  (nao e a vigente; nao afeta a tela)')));
    if (magras.some(e => e.vigente)) {
      if (momento === 'antes') parar('a edicao VIGENTE esta incompleta — o teto de hoje sai de uma carga pela metade');
      else console.log('  ⛔ A EDICAO VIGENTE FICOU INCOMPLETA. A regua esta cega: NAO use esta base pra conferir teto ate recarregar.');
    }
  } catch (e) { console.log('  ⚠️ nao consegui conferir o acervo de edicoes (' + e.message + ')'); }
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
    /* ══ ESTE ALARME MUDOU DE ALVO (item 10, 13/08/2026) ═══════════════════════════════════
       Ele parava quando havia mais de uma edicao na base, porque conviver ERA sintoma de carga
       pela metade. Depois da decisao de VERSIONAR POR EDICAO, conviver e o DESENHO — e o alarme
       de ontem pararia TODA carga a partir da segunda.
       >>> O QUE ELE PASSA A VIGIAR e o que continua sendo defeito de verdade: edicao guardada
           com CONTAGEM ESTRANHA. A CMED publica ~26 mil apresentacoes por edicao; uma edicao
           com um punhado de linhas nao e historico, e uma carga que morreu no meio.
       >>> E ELE NAO PARA MAIS, SO AVISA: com o versionamento, uma edicao velha incompleta nao
           impede a nova de entrar — ela e passado, e o vigente e outro. Parar aqui seria deixar
           a base desatualizada por causa de uma sujeira que nao afeta o teto de hoje. */
    const edicoes = Number(atual.edicoes) || 1;
    if (edicoes > 1) console.log(`  ${edicoes} edicoes guardadas (versionamento ligado — a anterior nao e apagada).`);
    await conferirAcervo('antes');
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

  /* ── 5. A CARGA — DELEGADA, E SAO DUAS TABELAS ─────────────────────────────────────────────
     *** DEFEITO ACHADO NA CARGA DE 13/08, RODANDO ESTE PROPRIO COMANDO. ***
     Esta rotina chamava SO o `carrega_cmed_precos.js`. A `cmed_pf` — que guarda substancia,
     produto, apresentacao e o `dose_key` — ficava na EDICAO ANTERIOR, e ninguem via.
     >>> O ESTRAGO NAO ERA "METADE FALTANDO", ERA PIOR: a `cmed_edicao_vigente` responde
         separado por metade (pf_vigente e gov_vigente), entao a regua continuava respondendo —
         juntando NOME E DOSE de uma edicao com PRECO da outra. Medido no ar naquele dia:
         pf_vigente 2026-07-21 · gov_vigente 2026-08-11, regua com 25.702 das 26.001 linhas e a
         `cmed_teto` caindo de 4.875 para 4.857 chaves. Nada estourou. Nada ficou vermelho.
         Um teto legal servido de duas edicoes ao mesmo tempo e exatamente o que este item
         inteiro existe pra impedir.
     >>> A ORDEM IMPORTA: a `cmed_pf` primeiro. Se a segunda carga falhar no meio, o estado que
         sobra e "pf nova, precos velho" — e a `cmed_regua` junta por GGREM exigindo AS DUAS na
         sua vigente, entao ela encolhe de forma VISIVEL em vez de servir mistura silenciosa.
         Das duas metades imcompletas possiveis, esta e a que denuncia a si mesma.
     >>> E QUEM COBRA ISSO AGORA E O `tools/prova_cmed_edicao.js`, com o assert
         "as DUAS metades da regua estao na MESMA edicao". Ele teria pego o buraco na hora. */
  console.log('\n── carregando 1/2: cmed_pf (substancia, apresentacao, dose_key) ──');
  execFileSync(process.execPath, [path.join(__dirname, 'carrega_cmed_pf.js'),
    arqSite, '--apply'], { stdio: 'inherit' });

  console.log('\n── carregando 2/2: cmed_precos (PF, PMC, PMVG por aliquota, CAP) ──');
  execFileSync(process.execPath, [path.join(__dirname, 'carrega_cmed_precos.js'),
    '--site', arqSite, '--gov', arqGov, '--apply', '--merge'], { stdio: 'inherit' });

  // ── 6. CONFERIR DEPOIS, E NAO SO ANTES ──────────────────────────────────────────────────
  // Carga que termina sem erro nao e carga que deu certo. O numero que decide e o do BANCO
  // depois — inclusive `edicoes`, que denuncia carga pela metade.
  console.log('\n── a regua DEPOIS da carga ───────────────────────────');
  try {
    const r = await fetch(`${SB}/rest/v1/v_cmed_vigencia?select=*`, { headers: H });
    const d = (await r.json())[0];
    /* ══ AS DUAS METADES SAO IMPRESSAS SEPARADAS, E ISSO E O CONSERTO DE UM NUMERO MENTIROSO ══
       Esta linha imprimia `vigente_desde`, que e o MENOR das duas datas, ao lado de
       `apresentacoes`, que conta so a metade do GOVERNO. Na carga de 13/08 ela escreveu
       "publicada em 2026-07-21 · 26.001 apresentacoes" — a data de uma metade com a contagem da
       outra. Um numero que nao descreve nenhum estado real do banco e pior que nenhum numero:
       ele me fez ler "carregou" quando metade nao tinha carregado. */
    const pf = String(d.publicada_site).slice(0, 10), gov = String(d.publicada_gov).slice(0, 10);
    console.log(`  cmed_pf     publicada em ${pf}`);
    console.log(`  cmed_precos publicada em ${gov} · ${Number(d.apresentacoes).toLocaleString('pt-BR')} apresentacoes`);
    console.log(`  edicoes guardadas na base: ${d.edicoes}`);
    if (pf !== gov) {
      console.log('  ⛔ AS DUAS METADES ESTAO EM EDICOES DIFERENTES. A regua esta juntando nome e');
      console.log('     dose de uma edicao com preco da outra — teto legal misturado, e sem sintoma');
      console.log('     na tela. Rode a carga de novo; se persistir, PARE de usar a regua ate conferir.');
    }
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
    /* ══ O ALARME DE "DUAS EDICOES" MORREU AQUI, E ISSO E DECISAO, NAO ESQUECIMENTO ══════════
       Ele dizia "⛔ ficaram DUAS edicoes na base — a carga entrou pela metade" e disparou na
       carga de 13/08, quando a carga tinha dado certo. Depois do item 10, GUARDAR A EDICAO
       ANTERIOR E O DESENHO: e ela que mantem auditavel o teto de uma proposta antiga. Alarme
       que acusa o comportamento correto ensina a ignorar alarme — e o proximo, o de verdade,
       passa junto.
       >>> O QUE MERECE ALARME MUDOU DE ALVO: nao e QUANTAS edicoes existem, e se alguma esta
           INCOMPLETA — e essa conferencia JA EXISTIA aqui, na checagem de ANTES da carga.
           Eu tinha escrito uma segunda copia dela; a mutacao pegou (o assert continuava verde
           porque o padrao aparecia duas vezes no arquivo, e eu mutei a copia errada).
           Duas conferencias do mesmo defeito e o comeco de duas respostas diferentes pra
           mesma pergunta, num numero que vira teto legal. Agora e UMA, chamada nos dois
           momentos — e o momento entra no texto, porque "antes" e "depois" pedem acoes
           diferentes de quem le. */
    await conferirAcervo('depois');
  } catch (e) { console.log('  ⚠️ nao consegui reler a vigencia: ' + e.message); }

  console.log('\n>>> O DOWNLOAD AUTOMATICO: investigado em 11/08 e NAO implementado. A pagina da');
  console.log('    ANVISA/CMED entrega as duas planilhas por link que muda a cada publicacao e');
  console.log('    fica atras de uma pagina que nao tem endpoint estavel nem versionado. Um');
  console.log('    baixador por raspagem quebraria calado na primeira mudanca de layout do site,');
  console.log('    e "nao baixou" viraria "a regua nao mudou" — que e a mentira que este projeto');
  console.log('    nao aceita. Baixar as duas planilhas a mao e por na raiz continua sendo o');
  console.log('    passo humano; TUDO o que vem depois esta automatizado neste comando.');
})().catch(e => { console.error('ERRO: ' + (e && e.message)); process.exit(1); });
