/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_cofre_certidoes.js — O COFRE DE CERTIDÕES, DO COMEÇO AO FIM (fatia B25) · 19/08/2026

   A caixa pede, com estas palavras: *"o caminho inteiro provado com o crachá do navegador:
   anexar, gravar, listar, baixar, substituir por versão nova mantendo o histórico. Nada de
   service_role na prova."* E depois: *"um documento real do começo ao fim, um caso vencido, um
   caso sem validade, e a contagem do painel conferida contra o banco."*

   ══ POR QUE O CRACHÁ IMPORTA MAIS AQUI DO QUE EM QUALQUER OUTRA TELA ════════════════════════
   A `service_role` passa por cima de TODA a RLS. Uma prova com ela diria "funciona" mesmo se as
   policies do cofre estivessem todas erradas — foi exatamente esse buraco que deixou o botão
   Anexar quebrado por dias na B16, com o banco em ZERO linhas e as suítes verdes. Então aqui a
   `service_role` não é usada em nenhuma leitura nem em nenhuma escrita: tudo passa pelo token
   de uma sessão de verdade, que é o mesmo que o navegador do Natanael carrega.

   ══ E AS FUNÇÕES SÃO ARRANCADAS DA TELA, NÃO REESCRITAS ═════════════════════════════════════
   `contaSituacoes` e `tipoDoArquivo` vêm do `fpmed_documentos.html` por recorte. Reescrevê-las
   aqui provaria o banco e não provaria a tela — que é o mesmo buraco por outro lado.

     node tools/prova_cofre_certidoes.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const ANON = (seg.match(/anon[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';

const HTML = fs.readFileSync(path.join(RAIZ, 'fpmed_documentos.html'), 'utf8').replace(/\r\n/g, '\n');
const pega = re => (HTML.match(re) || [])[0] || '';
const API = new Function(
  pega(/const MIME_POR_EXT = \{[\s\S]*?\};/) + '\n'
  + pega(/function tipoDoArquivo\(arq\)\{[\s\S]*?\n\}/) + '\n'
  + pega(/function contaSituacoes\(docs\)\{[\s\S]*?\n\}/) + '\n'
  + pega(/const caminhoNaUrl = [^\n]*\n/) + '\n'
  + 'return { tipoDoArquivo, contaSituacoes, caminhoNaUrl };')();

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

const PDF_MINIMO = corpo => Buffer.from(
  '%PDF-1.4\n% ' + corpo + '\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
  + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
  + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n'
  + 'trailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');

const MARCA = '[PROVA B25 — registro de teste, pode apagar]';
const iso = d => d.toISOString().slice(0, 10);
const hoje = new Date();
const emDias = k => iso(new Date(hoje.getTime() + k * 86400000));

let TK = null;
const H = extra => Object.assign({ apikey: ANON, Authorization: 'Bearer ' + TK }, extra || {});

async function token() {
  for (const email of ['licitacao@fpmed.com.br', 'comercial@fpmed.com.br']) {
    const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: SENHA }) }).catch(() => null);
    if (r && r.ok) { const j = await r.json(); if (j.access_token) return { tk: j.access_token, email }; }
  }
  return null;
}
async function le(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H() });
  if (!r.ok) throw new Error(q + ' -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 140));
  return r.json();
}
// O ENVIO DO ARQUIVO, do jeito que a tela faz: /storage/v1/, crachá da sessão, tipo do arquivo.
async function sobe(alvo, bytes, nomeArquivo) {
  const tipo = API.tipoDoArquivo({ name: nomeArquivo, type: '' });
  const r = await fetch(`${SB}/storage/v1/object/documentos/${API.caminhoNaUrl(alvo)}`, {
    method: 'POST', headers: H({ 'Content-Type': tipo }), body: bytes });
  return { http: r.status, corpo: (await r.text()).slice(0, 140) };
}
async function grava(corpo) {
  const r = await fetch(`${SB}/rest/v1/documentos`, {
    method: 'POST', headers: H({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error('gravar -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return (await r.json())[0];
}
async function ajusta(id, campos) {
  const r = await fetch(`${SB}/rest/v1/documentos?id=eq.${id}`, {
    method: 'PATCH', headers: H({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(campos) });
  if (!r.ok) throw new Error('ajustar -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return (await r.json())[0];
}

/* ══ A PROVA REAPROVEITA OS PRÓPRIOS REGISTROS, E ISSO NÃO É ECONOMIA ═══════════════════════
   A primeira versão desta prova criava quatro documentos por execução. Rodar dez vezes deixaria
   quarenta certidões de mentira no cofre do Natanael — e apagá-las é DELETE, que a regra da casa
   proíbe sem o dono. Ou seja: uma prova que suja o dado de produção e não pode limpar depois.
   Então ela procura os seus quatro pelo NOME (que começa com a marca lá de cima) e só cria o que
   faltar. O total no cofre para em quatro, para sempre, quantas vezes ela rode.
   >>> E A VALIDADE É REALINHADA A CADA RODADA, de propósito: as datas são relativas a HOJE
       ("vence em 120 dias"), e um registro reaproveitado daqui a seis meses estaria VENCIDO —
       a prova passaria a reprovar sozinha, sem nada ter quebrado. Realinhar é o que mantém o
       vermelho significando alguma coisa. */
async function garante({ nome, tipo, validade, versao, substitui_id }) {
  const cheio = MARCA + ' ' + nome;
  // `order=id.asc` não é enfeite: sem ordem explícita o PostgREST devolve na ordem física, e a
  // prova passaria a reaproveitar um registro diferente a cada dia, sem ninguém entender por quê.
  const achados = await le(`v_documentos_historico?select=*&nome=eq.${encodeURIComponent(cheio)}&order=id.asc&limit=1`);
  if (achados.length) {
    const d = achados[0];
    const alvoVal = validade === undefined ? null : validade;
    if (String(d.validade || '').slice(0, 10) !== String(alvoVal || '')) {
      return Object.assign({}, d, await ajusta(d.id, { validade: alvoVal }));
    }
    return d;
  }
  const arqNome = 'prova-b25.pdf';
  // A PASTA NO CAMINHO É DE PROPÓSITO: é o caso que quebrava o "abrir arquivo" (o escape da
  // barra), e um defeito só está provado consertado se o caso dele continuar sendo exercido.
  const alvo = 'prova-b25/' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '-' + arqNome;
  const bytes = PDF_MINIMO(nome);
  const up = await sobe(alvo, bytes, arqNome);
  if (up.http !== 200) throw new Error('o cofre recusou o arquivo: HTTP ' + up.http + ' ' + up.corpo);
  return grava({ nome: cheio, tipo, orgao_emissor: 'fatia B25',
    validade: validade === undefined ? null : validade, dias_aviso: 30,
    arquivo_path: alvo, arquivo_nome: arqNome, arquivo_bytes: bytes.length,
    versao: versao || 1, substitui_id: substitui_id || null });
}

(async () => {
  console.log('=== O COFRE DE CERTIDÕES, DO COMEÇO AO FIM (fatia B25) ===\n');
  const s = await token();
  if (!s) { console.error('nenhum e-mail logou com a SENHA_PADRAO.'); process.exit(1); }
  TK = s.tk;
  console.log(`  sessão de verdade: ${s.email}   (service_role NÃO é usada nesta prova)\n`);

  // ══════════ 0. A COLUNA NOVA EXISTE E É ADITIVA ═══════════════════════════════════════════
  const umaLinha = await le('v_documentos_situacao?select=*&limit=1');
  const colunas = umaLinha.length ? Object.keys(umaLinha[0]) : [];
  ok(n + '. *** a view da tela ganhou versão/histórico sem perder nada do que já tinha ***',
    ['versao', 'substitui_id', 'substituido_em', 'versoes_anteriores', 'situacao', 'dias_para_vencer']
      .every(c => colunas.includes(c)), colunas); n++;
  // A ORDEM IMPORTA e não é estilo: `create or replace view` recusa mudança de posição, e é por
  // isso que as três novas foram para o FIM. Se alguém as puser no meio, a migração para de ser
  // aditiva e passa a exigir `drop view` — que é o que a regra da casa proíbe.
  ok(n + '. ...e as colunas antigas continuam nas MESMAS posições (a migração foi aditiva)',
    colunas.indexOf('dias_para_vencer') < colunas.indexOf('versao')
    && colunas.indexOf('situacao') < colunas.indexOf('versao'),
    colunas.slice(-6)); n++;

  // ══════════ 1. UM DOCUMENTO REAL, DO COMEÇO AO FIM ════════════════════════════════════════
  console.log('  ─── 1. anexar · gravar · listar · baixar ───');
  const emDia = await garante({ nome: 'CND Federal', tipo: 'CND Federal', validade: emDias(120) });
  console.log(`    documento ${emDia.id} gravado com arquivo ${emDia.arquivo_path}`);
  ok(n + '. *** ANEXAR e GRAVAR: a linha nasceu com caminho, nome e tamanho do arquivo ***',
    !!emDia.arquivo_path && !!emDia.arquivo_nome && emDia.arquivo_bytes > 0,
    [emDia.arquivo_path, emDia.arquivo_bytes]); n++;

  const naTela = await le(`v_documentos_situacao?select=*&id=eq.${emDia.id}`);
  ok(n + '. *** LISTAR: a tela enxerga, e a situação dele é "ok" (vence em 120 dias) ***',
    naTela.length === 1 && naTela[0].situacao === 'ok', naTela[0] && naTela[0].situacao); n++;
  ok(n + '. ...e ele nasce na versão 1, sem passado', naTela[0].versao === 1
    && naTela[0].substitui_id === null && Number(naTela[0].versoes_anteriores) === 0,
    [naTela[0].versao, naTela[0].substitui_id, naTela[0].versoes_anteriores]); n++;

  // BAIXAR de verdade: assinar a URL E puxar os bytes. Assinar e não buscar provaria a policy e
  // não provaria o arquivo — e um caminho gravado errado só aparece na hora de baixar.
  // Assina com o MESMO escape que a tela usa (arrancado dela). O caminho desta prova tem PASTA
  // de propósito — é o caso que quebrava, e prova que não quebra mais só se ele estiver aqui.
  const assina = async (caminho, escapa) => {
    const r = await fetch(`${SB}/storage/v1/object/sign/documentos/${(escapa || API.caminhoNaUrl)(caminho)}`, {
      method: 'POST', headers: H({ 'Content-Type': 'application/json' }), body: JSON.stringify({ expiresIn: 60 }) });
    if (!r.ok) return null;
    return (await r.json()).signedURL;
  };
  const url1 = await assina(emDia.arquivo_path);
  const baixado = url1 ? await fetch(SB + '/storage/v1' + url1) : null;
  const corpo1 = baixado && baixado.ok ? Buffer.from(await baixado.arrayBuffer()) : null;
  ok(n + '. *** BAIXAR: a URL assinada sai e os bytes voltam — e são um PDF ***',
    !!corpo1 && corpo1.length === emDia.arquivo_bytes && corpo1.slice(0, 5).toString() === '%PDF-',
    corpo1 ? [corpo1.length, emDia.arquivo_bytes] : 'não baixou'); n++;

  /* ══ O DEFEITO DO CAMINHO, MEDIDO NOS DOIS SENTIDOS ═════════════════════════════════════
     Achado nesta fatia, com este arquivo, que está numa PASTA (`prova-b25/…`). O jeito antigo
     — `encodeURIComponent` no caminho inteiro — escapa a barra, e o cofre ASSINA do mesmo
     jeito: HTTP 200, com `%2F` dentro da URL assinada. Quem falha é o download depois, com um
     400 seco. Assinar respondendo 200 é o que fazia o defeito parecer inexistente.
     >>> ELE ESTAVA DORMINDO: o `salvar()` de hoje monta caminho sem pasta. Ele acordaria no dia
         em que alguém organizasse o cofre por empresa ou por ano — e aí TODA certidão pareceria
         perdida de uma vez. Este par de asserts é o despertador. */
  const urlErrada = await assina(emDia.arquivo_path, encodeURIComponent);
  const baixErrada = urlErrada ? await fetch(SB + '/storage/v1' + urlErrada) : null;
  console.log(`    caminho com pasta · escape inteiro -> assina ${urlErrada ? 200 : 'erro'},`
    + ` baixa ${baixErrada ? baixErrada.status : '-'}`);
  console.log(`    caminho com pasta · escape por pedaço -> assina 200, baixa ${baixado ? baixado.status : '-'}`);
  ok(n + '. *** o escape antigo ASSINA e mesmo assim não baixa (o 200 mentia) ***',
    !!urlErrada && /%2F/.test(urlErrada) && !!baixErrada && baixErrada.status >= 400,
    [urlErrada && urlErrada.slice(0, 60), baixErrada && baixErrada.status]); n++;

  // ══════════ 2. OS DOIS ESTADOS QUE A CAIXA PEDIU ══════════════════════════════════════════
  console.log('\n  ─── 2. um vencido e um sem validade ───');
  const vencido = await garante({ nome: 'CRF FGTS (vencida)', tipo: 'CRF FGTS', validade: emDias(-9) });
  const semVal  = await garante({ nome: 'Contrato Social', tipo: 'Contrato Social', validade: null });
  /* O VENCIDO SÓ APARECE NA VISTA DA TELA ENQUANTO ESTIVER ATIVO, e a parte 3 desta prova o
     aposenta. Numa segunda execução ele chegaria aqui já aposentado e a parte 2 mediria o
     nada. Reencenar a cena é o que mantém a prova provando a mesma coisa toda vez — e isto é
     um registro DESTA prova, marcado no nome, nunca um documento do Natanael. */
  if (vencido.ativo === false) await ajusta(vencido.id, { ativo: true, substituido_em: null });
  const dois = await le(`v_documentos_situacao?select=id,situacao,dias_para_vencer&id=in.(${vencido.id},${semVal.id})`);
  const sV = dois.find(x => x.id === vencido.id), sS = dois.find(x => x.id === semVal.id);
  console.log(`    vencido -> ${sV && sV.situacao} (${sV && sV.dias_para_vencer} dias)`);
  console.log(`    sem validade -> ${sS && sS.situacao} (${sS && sS.dias_para_vencer} dias)`);
  ok(n + '. *** o vencido sai VENCIDO, com os dias negativos ***',
    sV && sV.situacao === 'vencido' && sV.dias_para_vencer === -9, sV); n++;
  /* >>> ESTE É O ASSERT QUE A CAIXA CHAMOU DE "ESTADO HONESTO", e ele é o oposto de um detalhe:
         um documento sem data NÃO PODE cair em "ok". "Em dia" é uma promessa, e a única coisa
         que a tela sabe sobre este documento é que ninguém digitou a data dele. */
  ok(n + '. *** o sem validade NÃO é "ok": é um estado próprio, e dias_para_vencer é nulo ***',
    sS && sS.situacao === 'sem_validade' && sS.dias_para_vencer === null, sS); n++;

  // ══════════ 3. SUBSTITUIR MANTENDO O HISTÓRICO ════════════════════════════════════════════
  console.log('\n  ─── 3. substituir por versão nova, mantendo o histórico ───');
  const antesDaTroca = await le(`v_documentos_situacao?select=id&id=eq.${vencido.id}`);
  // A ORDEM DA TELA: nasce a nova, depois a velha sai de cena. É o lado seguro da falha.
  const v2 = await garante({ nome: 'CRF FGTS (via nova)', tipo: 'CRF FGTS',
    validade: emDias(150), versao: 2, substitui_id: vencido.id });
  const patch = await fetch(`${SB}/rest/v1/documentos?id=eq.${vencido.id}`, {
    method: 'PATCH', headers: H({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ativo: false, substituido_em: new Date().toISOString() }) });
  ok(n + '. *** a via anterior sai de cena com o crachá da sessão (HTTP ' + patch.status + ') ***',
    patch.ok, patch.status); n++;

  const listaAgora = await le('v_documentos_situacao?select=id,nome,versao,substitui_id,versoes_anteriores&order=validade.asc.nullslast');
  const idsVisiveis = listaAgora.map(x => x.id);
  ok(n + '. *** a versão ANTIGA sumiu da lista da tela ***',
    antesDaTroca.length === 1 && !idsVisiveis.includes(vencido.id), idsVisiveis); n++;
  const naLista = listaAgora.find(x => x.id === v2.id);
  ok(n + '. ...e a NOVA está lá, na versão 2, apontando para a que ela substituiu',
    !!naLista && naLista.versao === 2 && naLista.substitui_id === vencido.id, naLista); n++;
  ok(n + '. *** e o cartão sabe que existe passado, contado pelo BANCO (1 versão anterior) ***',
    !!naLista && Number(naLista.versoes_anteriores) === 1, naLista && naLista.versoes_anteriores); n++;

  /* O HISTÓRICO NÃO É "A LINHA CONTINUA NO BANCO": é a linha continuar ALCANÇÁVEL e o ARQUIVO
     dela continuar baixável. Uma certidão histórica que não abre não serve para o recurso, que
     é a única razão de ela existir. */
  const hist = await le(`v_documentos_historico?select=*&id=eq.${vencido.id}`);
  ok(n + '. *** a versão antiga continua INTEIRA no histórico (e marcada como substituída) ***',
    hist.length === 1 && hist[0].ativo === false && !!hist[0].substituido_em
    && hist[0].arquivo_path === vencido.arquivo_path, hist[0]); n++;
  const url2 = await assina(hist[0].arquivo_path);
  const b2 = url2 ? await fetch(SB + '/storage/v1' + url2) : null;
  ok(n + '. *** e o ARQUIVO dela ainda baixa — é ele que prova a habilitação daquele dia ***',
    !!b2 && b2.ok && (await b2.arrayBuffer()).byteLength === vencido.arquivo_bytes,
    url2 ? 'baixou' : 'não assinou'); n++;

  // ══════════ 4. A CONTAGEM DO PAINEL, CONFERIDA CONTRA O BANCO ═════════════════════════════
  console.log('\n  ─── 4. a contagem do painel × o banco ───');
  const todosNaView = await le('v_documentos_situacao?select=situacao');
  const daTela = API.contaSituacoes(todosNaView);          // a MESMA função que o painel usa
  // O lado do banco: contado pelo PostgREST, agrupado por situação — não pela mesma lista.
  const grupos = {};
  for (const est of ['vencido', 'vencendo', 'ok', 'sem_validade']) {
    const r = await fetch(`${SB}/rest/v1/v_documentos_situacao?select=id&situacao=eq.${est}`,
      { headers: H({ Prefer: 'count=exact', Range: '0-0' }) });
    grupos[est] = parseInt(String(r.headers.get('content-range') || '/0').split('/')[1], 10);
  }
  console.log('    painel (função da tela):', JSON.stringify(daTela));
  console.log('    banco  (count=exact)  :', JSON.stringify(grupos));
  ok(n + '. *** os quatro números do painel batem com o banco, um a um ***',
    ['vencido', 'vencendo', 'ok', 'sem_validade'].every(k => daTela[k] === grupos[k]),
    [daTela, grupos]); n++;
  const soma = Object.values(daTela).reduce((a, b) => a + b, 0);
  ok(n + '. *** e eles FECHAM com o total (nenhum documento fica sem contador) ***',
    soma === todosNaView.length, [soma, todosNaView.length]); n++;
  ok(n + '. ...inclusive os sem validade, que antes da B25 eram somados e jogados fora',
    daTela.sem_validade >= 1, daTela.sem_validade); n++;

  // ══════════ 5. O ANON CONTINUA DE FORA — DAS DUAS VIEWS ═══════════════════════════════════
  console.log('\n  ─── 5. a view nova não abriu porta para o `anon` ───');
  const semCracha = async q => (await fetch(`${SB}/rest/v1/${q}`,
    { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } })).status;
  const aSit = await semCracha('v_documentos_situacao?select=id&limit=1');
  const aHis = await semCracha('v_documentos_historico?select=id&limit=1');
  console.log(`    anon -> v_documentos_situacao: HTTP ${aSit} · v_documentos_historico: HTTP ${aHis}`);
  /* A VIEW DO HISTÓRICO É A MAIS PERIGOSA DAS DUAS: ela é a única que não filtra `ativo`, ou
     seja é a única que enxerga tudo que a empresa já teve. Uma view nova aberta ao `anon` é o
     defeito que a `testa_rls_cobertura` existe para pegar — e este assert é ele, à queima-roupa. */
  ok(n + '. *** o `anon` não lê nenhuma das duas views (nem a que enxerga o histórico inteiro) ***',
    aSit >= 400 && aHis >= 400, [aSit, aHis]); n++;

  console.log('\n  PENDÊNCIA: esta prova deixou 4 registros de teste (o título de cada um começa');
  console.log('  com "' + MARCA + '") e 4 arquivos no bucket. Apagá-los é DELETE — decisão do dono.');
  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
