/* ══════════════════════════════════════════════════════════════════════════════════════════════
   prova_teto_homologado.js — DO BANCO À TELA, COM O DADO DE VERDADE (fatia B28) · 20/08/2026

   A caixa pede, com estas palavras: *"um item dos 192 com resultado, mostrado do banco à tela; um
   item sem, mostrando o estado honesto; a contagem do rodapé conferida contra o SQL"*.

   ══ O QUE ESTA PROVA FAZ DE DIFERENTE, E POR QUÊ ════════════════════════════════════════════
   Ela NÃO inventa item nenhum. Ela lê as 192 linhas reais de `licitacao_itens` que têm resultado
   homologado, monta o índice com o MOTOR de verdade (`fpmed_teto_homologado.js`, por `require`) e
   roda a função de desenho ARRANCADA do `fpmed_negocios.html`. O que ela assere é o HTML que a
   tela produziria — não uma reescrita dele.

   ══ A MEDIANA É PROVADA CONTRA UM ORÁCULO QUE NÃO SOU EU ════════════════════════════════════
   Medido hoje: os 192 resultados dão **192 chaves distintas**. Nenhum produto se repete. Ou seja,
   o caminho da FAIXA e da MEDIANA — que a caixa pede para quando há mais de um resultado do mesmo
   produto — **não roda com o dado de hoje**. Provar a mediana com uma lista que eu escrevesse
   seria repetir o detector cego da B26 com outro nome: eu escreveria a fixture e a função com a
   mesma cabeça, no mesmo minuto, e as duas concordariam mesmo erradas.
   >>> ENTÃO O ORÁCULO É O POSTGRES. A prova joga os 192 valores REAIS na `mediana()` do motor e
       pergunta ao banco, pelo `percentile_cont(0.5)`, qual é a resposta. O Postgres não é uma
       fixture minha e ele não erra do mesmo jeito que eu. O mesmo vale para min e max.
   >>> E O NÚMERO "ZERO PRODUTOS REPETIDOS" SAI NO RELATÓRIO, em vez de ficar escondido atrás de um
       verde. Dívida contada em voz alta é fila; dívida escondida é mentira.

     node tools/prova_teto_homologado.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const T = require(path.join(RAIZ, 'fpmed_teto_homologado.js'));

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const ANON = (seg.match(/anon[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';

/* ══ A TELA É ARRANCADA, NÃO REESCRITA ═══════════════════════════════════════════════════════
   `homologadoDoItem` e as três funções de que ela depende vêm do `fpmed_negocios.html` por
   recorte. Reescrevê-las aqui provaria o motor e não provaria a tela — que é o mesmo buraco por
   outro lado, e é o buraco que deixou o botão Anexar quebrado por dias na B16. */
const HTML = fs.readFileSync(path.join(RAIZ, 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');
const pega = re => { const m = HTML.match(re); if (!m) throw new Error('não achei na tela: ' + re); return m[0]; };
const TELA = new Function('window', 'ITENS_DE', 'ITENS_HOMOL', 'HOMOL_ERRO',
  pega(/const esc = [^\n]*\n/)
  + pega(/const brl = [^\n]*\n/)
  + pega(/const semReferencia = [^\n]*\n/)
  + pega(/function dataBR\(ymd\)\{[\s\S]*?\n\}/) + '\n'
  + pega(/function homologadoDoItem\(it\)\{[\s\S]*?\n\}/) + '\n'
  + pega(/function rodapeDoHomologado\(\)\{[\s\S]*?\n\}/) + '\n'
  + 'return { homologadoDoItem, rodapeDoHomologado, dataBR };');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 400) + ']' : '')); } };

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
async function le(q, extra) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H(extra) });
  if (!r.ok) throw new Error(q + ' -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 140));
  return { linhas: await r.json(), range: r.headers.get('content-range') };
}

(async () => {
  console.log('=== O TETO COMPETITIVO, DO BANCO À TELA (fatia B28) ===\n');
  const s = await token();
  if (!s) { console.error('nenhum e-mail logou com a SENHA_PADRAO.'); process.exit(1); }
  TK = s.tk;
  console.log(`  sessão de verdade: ${s.email}   (service_role NÃO é usada nesta prova)\n`);

  // ══════════ 1. A COBERTURA, MEDIDA E NÃO ESTIMADA ═════════════════════════════════════════
  console.log('  ─── 1. a cobertura de hoje ───');
  const tot = await le('licitacao_itens?select=id&limit=1', { Prefer: 'count=exact', Range: '0-0' });
  const totalItens = parseInt(String(tot.range || '/0').split('/')[1], 10);
  const res = await le('licitacao_itens?resultado_valor_unit=not.is.null'
    + '&select=numero_controle,numero_item,descricao,unidade,quantidade,valor_unitario_ref,'
    + 'resultado_valor_unit,resultado_quantidade,resultado_situacao,resultado_vencedor,resultado_cnpj'
    + '&order=resultado_lido_em.desc&limit=2000', { Prefer: 'count=exact' });
  const linhas = res.linhas;
  const totalRes = parseInt(String(res.range || '/0').split('/')[1], 10);
  const pct = (totalRes / totalItens * 100);
  console.log(`    ${totalRes} resultados homologados em ${totalItens} itens  ->  ${pct.toFixed(3)}%`);
  ok(n + '. o índice de resultados existe e foi lido inteiro (nada truncado hoje)',
    linhas.length === totalRes && totalRes > 0, [linhas.length, totalRes]); n++;

  const certamesCom = [...new Set(linhas.map(l => l.numero_controle))];
  console.log(`    e eles vêm de ${certamesCom.length} certame(s): ${certamesCom.slice(0, 3).join(', ')}`);

  // ══════════ 2. O ÍNDICE, COM O MOTOR DE VERDADE ═══════════════════════════════════════════
  console.log('\n  ─── 2. o índice, e quantos produtos se repetem ───');
  const ctrls = certamesCom.slice(0, 300).map(c => '"' + String(c).replace(/"/g, '') + '"').join(',');
  const certames = {};
  const lic = await le(`licitacoes?numero_controle=in.(${encodeURIComponent(ctrls)})`
    + '&select=numero_controle,orgao,municipio,uf,data_abertura');
  for (const c of lic.linhas) certames[c.numero_controle] = {
    orgao: c.orgao, municipio: c.municipio, uf: c.uf,
    data: c.data_abertura ? String(c.data_abertura).slice(0, 10) : null };
  const idx = T.indexa(linhas, { certames, total: totalRes, truncado: false });

  const repetidos = [...idx.por.entries()].filter(([, v]) => v.length > 1);
  console.log(`    ${idx.linhas} linhas -> ${idx.por.size} chaves distintas · produtos com MAIS DE UM resultado: ${repetidos.length}`);
  ok(n + '. o índice usou todas as linhas com valor > 0', idx.linhas === linhas.filter(l => Number(l.resultado_valor_unit) > 0).length,
    [idx.linhas, linhas.length]); n++;
  /* >>> ESTE ASSERT NÃO É UMA EXIGÊNCIA, É UM TERMÔMETRO — e por isso ele é impresso mesmo quando
         passa. Hoje ele mede ZERO produtos repetidos, o que quer dizer que o caminho da faixa e da
         mediana não roda em produção. No dia em que o ingestor do A trouxer o segundo certame, este
         número sobe e a prova passa a exercer o caminho de verdade sozinha. */
  console.log(`    >>> TERMÔMETRO DA FATIA: com ${repetidos.length} produto(s) repetido(s), o caminho`);
  console.log('        da FAIXA e da MEDIANA ' + (repetidos.length ? 'JÁ roda com dado real.' : 'NÃO roda com o dado de hoje.'));

  // ══════════ 3. A MEDIANA CONTRA O ORÁCULO DO POSTGRES ═════════════════════════════════════
  console.log('\n  ─── 3. a mediana × o percentile_cont do Postgres ───');
  /* A aritmética é provada sobre os 192 valores REAIS, com o banco do outro lado. Não há fixture
     nenhuma aqui: se a minha `mediana()` discordar do Postgres, uma das duas está errada — e a do
     Postgres é a definição. */
  const valores = linhas.map(l => Number(l.resultado_valor_unit)).filter(v => v > 0);
  const meu = { mediana: T.mediana(valores), min: Math.min.apply(null, valores), max: Math.max.apply(null, valores) };
  const rpc = await fetch(`${SB}/rest/v1/rpc/mediana_resultado_homologado`, {
    method: 'POST', headers: H({ 'Content-Type': 'application/json' }), body: '{}' });
  /* O PostgREST devolve `returns table` como LISTA, mesmo com uma linha só — e a primeira versão
     deste bloco leu `doBanco.mediana` direto, que é `undefined`. Os dois asserts ficaram vermelhos
     com os números IDÊNTICOS impressos logo acima (13.015 dos dois lados). Vermelho de prova mal
     escrita é o mesmo veneno do vermelho permanente: ensina a olhar o número e ignorar o veredito. */
  let doBanco = null;
  if (rpc.ok) { const j = await rpc.json(); doBanco = Array.isArray(j) ? j[0] : j; }
  console.log('    motor  :', JSON.stringify(meu));
  console.log('    banco  :', JSON.stringify(doBanco));
  const perto = (a, b) => a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.0000001;
  ok(n + '. *** a mediana do motor bate com o `percentile_cont(0.5)` do Postgres, nos 192 valores reais ***',
    !!doBanco && perto(meu.mediana, doBanco.mediana), [meu, doBanco]); n++;
  ok(n + '. ...e o mínimo e o máximo também', !!doBanco && perto(meu.min, doBanco.minimo) && perto(meu.max, doBanco.maximo),
    [meu, doBanco]); n++;
  /* O ERRO CLÁSSICO DA MEDIANA EM JAVASCRIPT, exercido de propósito sobre valores REAIS: `sort()`
     sem comparador ordena como TEXTO, e `[10, 9, 100]` vira `[10, 100, 9]`. Isso não dá erro —
     dá uma mediana errada, calada, com cara de certa. Este assert prova que o motor não caiu nela.
     >>> A "prova textual" é calculada aqui de propósito diferente do motor: se as duas fossem
         iguais, o assert seria o motor concordando consigo mesmo. */
  const textual = (arr => { const v = arr.slice().sort(); const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (Number(v[m - 1]) + Number(v[m])) / 2; })(valores);
  console.log(`    (a mesma lista ordenada como TEXTO daria mediana ${textual} — o erro que o motor não comete)`);
  ok(n + '. *** o motor ordena por número, e não por texto (a mediana textual seria outra) ***',
    !perto(meu.mediana, textual) || valores.length < 3, [meu.mediana, textual]); n++;

  // ══════════ 4. UM ITEM COM RESULTADO — DO BANCO À TELA ════════════════════════════════════
  console.log('\n  ─── 4. um item COM resultado, do banco à tela ───');
  const comCnpj = linhas.filter(l => String(l.resultado_cnpj || '').replace(/\D/g, '').length >= 11);
  const alvo = comCnpj[0] || linhas[0];
  const doCertame = certames[alvo.numero_controle] || {};
  console.log(`    item ${alvo.numero_item} de ${alvo.numero_controle}: ${String(alvo.descricao).slice(0, 58)}…`);
  console.log(`    homologado por R$ ${alvo.resultado_valor_unit} · ${doCertame.orgao || '(sem órgão)'} · sessão ${doCertame.data || '(sem data)'}`);
  const api = TELA({ FPMED_TETO_HOMOLOGADO: T }, alvo.numero_controle, idx, null);
  const html = api.homologadoDoItem(alvo);
  console.log('    HTML da tela: ' + html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 190));

  ok(n + '. *** a tela diz "este item foi homologado por" com o VALOR do banco ***',
    /foi homologado por/.test(html) && html.includes(Number(alvo.resultado_valor_unit)
      .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })), html.slice(0, 200)); n++;
  const qtd = alvo.resultado_quantidade != null ? Number(alvo.resultado_quantidade) : Number(alvo.quantidade);
  ok(n + '. ...com a quantidade, também do banco',
    !isFinite(qtd) || html.includes(qtd.toLocaleString('pt-BR')), [qtd, html.slice(0, 260)]); n++;
  /* ══ O ASSERT MAIS IMPORTANTE DO BLOCO, E ELE É PELO AVESSO ═════════════════════════════════
     O CNPJ do vencedor NÃO pode aparecer na tela — ele fica no dado, onde a `ganhosDoNegocio` já o
     usa para responder "fui EU que ganhei?". Nome e documento de concorrente em destaque numa tela
     de proposta é convite para o uso errado. Este assert usa o CNPJ REAL da linha: se um dia
     alguém "melhorar" o bloco acrescentando o vencedor por extenso, ele fica vermelho na hora. */
  const cnpjCru = String(alvo.resultado_cnpj || '');
  const cnpjNum = cnpjCru.replace(/\D/g, '');
  ok(n + '. *** o CNPJ do vencedor NÃO aparece na tela (nem cru, nem só os dígitos) ***',
    !cnpjNum || (!html.includes(cnpjCru) && !html.includes(cnpjNum)), [cnpjCru, html.slice(0, 260)]); n++;
  ok(n + '. ...e o nome do concorrente também não: a tela escreve "o vencedor"',
    !alvo.resultado_vencedor || !html.includes(alvo.resultado_vencedor), alvo.resultado_vencedor); n++;
  if (doCertame.data) {
    /* A DATA É A DA SESSÃO, e o `T12:00:00` do `dataBR` é o que impede o fuso de voltar um dia.
       Sem ele, uma sessão de 16/06 sairia como 15/06 — e ninguém desconfia de uma data plausível. */
    const esperada = new Date(doCertame.data + 'T12:00:00').toLocaleDateString('pt-BR');
    console.log(`    data da sessão: banco ${doCertame.data} -> tela ${api.dataBR(doCertame.data)}`);
    ok(n + '. *** a data da sessão sai sem voltar um dia pelo fuso (o T12:00:00) ***',
      api.dataBR(doCertame.data) === esperada && /^\d{2}\/\d{2}\/\d{4}$/.test(esperada)
      && esperada.slice(0, 2) === doCertame.data.slice(8, 10),
      [doCertame.data, api.dataBR(doCertame.data)]); n++;
  }

  // ══════════ 5. UM ITEM SEM RESULTADO — O ESTADO HONESTO ══════════════════════════════════
  console.log('\n  ─── 5. um item SEM resultado, e o estado honesto ───');
  const sem = await le('licitacao_itens?resultado_valor_unit=is.null'
    + '&select=numero_controle,numero_item,descricao,unidade,quantidade,valor_unitario_ref,'
    + 'resultado_valor_unit,resultado_quantidade,resultado_situacao,resultado_vencedor&limit=1');
  const vazio = sem.linhas[0];
  console.log(`    item ${vazio.numero_item} de ${vazio.numero_controle}: ${String(vazio.descricao).slice(0, 58)}…`);
  const htmlVazio = TELA({ FPMED_TETO_HOMOLOGADO: T }, vazio.numero_controle, idx, null).homologadoDoItem(vazio);
  const texto = htmlVazio.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log('    HTML da tela: ' + texto.slice(0, 190));
  ok(n + '. *** o estado vazio DIZ que não temos o dado, com todas as letras ***',
    /ainda não temos resultado homologado para este item/.test(texto), texto.slice(0, 160)); n++;
  /* AS TRÊS MANEIRAS DE O OLHO LER "NÃO HOUVE", e a caixa proíbe as três: R$ 0,00 é um preço que
     ninguém praticou, o travessão parece um campo vazio, e o branco parece um defeito da tela. */
  ok(n + '. *** e ele não é "R$ 0,00", nem um traço, nem uma célula em branco ***',
    !/R\$\s*0,00/.test(texto) && !/^[\s—–-]*$/.test(texto) && texto.length > 40, texto); n++;
  ok(n + '. ...e ele não afirma que o produto nunca foi vendido — afirma que NÓS não temos',
    /o resultado por item chega do PNCP/.test(texto), texto.slice(0, 200)); n++;

  // ══════════ 6. O RODAPÉ, CONFERIDO CONTRA O SQL ══════════════════════════════════════════
  console.log('\n  ─── 6. o rodapé × o SQL ───');
  const ctrl = certamesCom[0];
  const doEdital = await le(`licitacao_itens?numero_controle=eq.${encodeURIComponent(ctrl)}`
    + '&select=numero_item,descricao,quantidade,unidade,valor_unitario_ref,resultado_valor_unit'
    + '&order=id&limit=2000');
  const cob = T.cobertura(doEdital.linhas);
  const doBancoCom = await le(`licitacao_itens?numero_controle=eq.${encodeURIComponent(ctrl)}`
    + '&resultado_valor_unit=not.is.null&select=id&limit=1', { Prefer: 'count=exact', Range: '0-0' });
  const doBancoTot = await le(`licitacao_itens?numero_controle=eq.${encodeURIComponent(ctrl)}`
    + '&select=id&limit=1', { Prefer: 'count=exact', Range: '0-0' });
  const sqlCom = parseInt(String(doBancoCom.range || '/0').split('/')[1], 10);
  const sqlTot = parseInt(String(doBancoTot.range || '/0').split('/')[1], 10);
  console.log(`    tela: ${cob.com} de ${cob.de}   ·   banco (count=exact): ${sqlCom} de ${sqlTot}`);
  ok(n + '. *** a contagem do rodapé bate com o SQL, nos dois números ***',
    cob.com === sqlCom && cob.de === sqlTot, [cob, { sqlCom, sqlTot }]); n++;

  const rod = TELA({ FPMED_TETO_HOMOLOGADO: T }, ctrl, idx, null);
  const htmlRod = new Function('window', 'ITENS_DE', 'ITENS_HOMOL', 'HOMOL_ERRO', 'ITENS_EDITAL', 'esc',
    pega(/function rodapeDoHomologado\(\)\{[\s\S]*?\n\}/) + '\nreturn rodapeDoHomologado();')
    ({ FPMED_TETO_HOMOLOGADO: T }, ctrl, idx, null, doEdital.linhas, x => String(x));
  const textoRod = htmlRod.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log('    rodapé: ' + textoRod.slice(0, 200));
  ok(n + '. ...e a frase do rodapé traz os dois números que a caixa pediu',
    textoRod.includes(String(sqlCom)) && textoRod.includes(String(sqlTot))
    && /Resultado homologado disponível em/.test(textoRod), textoRod.slice(0, 200)); n++;
  /* >>> "NÃO INVENTE DENOMINADOR": o rodapé não pode publicar percentual nenhum. Ele sabe quantos
         itens DESTE edital têm resultado; não sabe quantos itens iguais existem no Brasil. */
  ok(n + '. *** e o rodapé NÃO publica percentual — o denominador do mercado ninguém conhece ***',
    !/%/.test(textoRod), textoRod); n++;

  // ══════════ 7. A OUTRA TELA — A PROPOSTA, COM O MESMO MOTOR ══════════════════════════════
  console.log('\n  ─── 7. a Proposta (fpmed_giovana.html), com o MESMO índice ───');
  /* As funções vêm da Giovana por recorte, como as do Negócios. O ponto deste bloco não é repetir
     o anterior: é provar que as DUAS telas, com o MESMO índice, dizem a mesma coisa sobre o mesmo
     produto. Se um dia alguém copiar a regra para dentro de uma delas, os números começam a
     divergir aqui — e é esse o defeito que o arquivo único existe para impedir. */
  const G = fs.readFileSync(path.join(RAIZ, 'fpmed_giovana.html'), 'utf8').replace(/\r\n/g, '\n');
  const pegaG = re => { const m = G.match(re); if (!m) throw new Error('não achei na Giovana: ' + re); return m[0]; };
  const PROP = new Function('window', '_homolIdx', '_homolErro', 'esc', 'fmtBRL',
    pegaG(/function avaliarHomologado\(c, precoUnit\)\{[\s\S]*?\n\}/) + '\n'
    + pegaG(/function homolBadgeHTML\(r\)\{[\s\S]*?\n\}/) + '\n'
    + 'return { avaliarHomologado, homolBadgeHTML };')(
      { FPMED_TETO_HOMOLOGADO: T }, idx, null,
      x => String(x == null ? '' : x).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])),
      v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  /* ══ O CASO QUE CASA, E POR QUE ELE PRECISA DE UMA EXPLICAÇÃO HONESTA ═══════════════════════
     Nenhum produto da tabela `cotacoes` (medicamento e material hospitalar) casa com os 192
     resultados que existem hoje (material escolar de um município de Minas). Isso não é defeito:
     é a cobertura de 0,06% aparecendo. Para exercer o caminho do ACHOU, o "produto" abaixo é a
     descrição REAL de um item dos 192, lida do banco agora — o dado continua sendo dado de
     verdade; o que é montado aqui é só o formato de uma linha de proposta.
     >>> E ISSO ESTÁ DITO EM VOZ ALTA em vez de escondido atrás de um verde: no dia em que o
         ingestor do A trouxer resultado de medicamento, este bloco passa a casar com produto de
         verdade sozinho, e nada aqui precisa mudar. */
  const precoAbaixo = Number(alvo.resultado_valor_unit) * 0.8;
  const precoAcima = Number(alvo.resultado_valor_unit) * 1.25;
  const cAbaixo = { id: 'x1', produto: alvo.descricao };
  const bAbaixo = PROP.homolBadgeHTML(PROP.avaliarHomologado(cAbaixo, precoAbaixo));
  const bAcima = PROP.homolBadgeHTML(PROP.avaliarHomologado(cAbaixo, precoAcima));
  console.log('    preço 20% abaixo -> ' + bAbaixo.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110));
  console.log('    preço 25% acima  -> ' + bAcima.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110));
  ok(n + '. *** a Proposta acha o mesmo resultado que o Negócios, pelo mesmo índice ***',
    /já saiu por/.test(bAbaixo) && bAbaixo.includes(Number(alvo.resultado_valor_unit)
      .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })), bAbaixo.slice(0, 200)); n++;
  ok(n + '. *** preço abaixo do já homologado sai como FOLGA (verde), e acima sai como APERTO ***',
    /class="homol-badge folga"/.test(bAbaixo) && /abaixo/.test(bAbaixo)
    && /class="homol-badge aperto"/.test(bAcima) && /ACIMA/.test(bAcima), [bAbaixo.slice(0, 80), bAcima.slice(0, 80)]); n++;
  /* O SINAL TEM DE SER O MESMO DO TETO LEGAL: positivo = sobra. Dois badges lado a lado com
     sinais invertidos fariam a mesma pessoa ler "-12%" como boa num e ruim no outro. */
  ok(n + '. ...e a folga é 20,0% para um preço 20% abaixo (o sinal bate com o do teto legal)',
    /20,0% abaixo/.test(bAbaixo), bAbaixo.slice(0, 140)); n++;
  ok(n + '. *** e o CNPJ do vencedor não entra no badge nem no título dele ***',
    !cnpjNum || (!bAbaixo.includes(cnpjCru) && !bAbaixo.includes(cnpjNum)), bAbaixo.slice(0, 200)); n++;

  // o caso comum: um produto REAL da tabela de cotações, que hoje não casa com nada
  const cot = await le('cotacoes?select=produto&produto=not.is.null&limit=1');
  const prodReal = (cot.linhas[0] || {}).produto || 'DIPIRONA 500MG';
  const bVazio = PROP.homolBadgeHTML(PROP.avaliarHomologado({ id: 'x2', produto: prodReal }, 10));
  console.log(`    produto real da tabela ("${String(prodReal).slice(0, 40)}") -> `
    + bVazio.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90));
  ok(n + '. *** e um produto real do catálogo cai no estado honesto, sem R$ 0,00 e sem branco ***',
    /ainda sem resultado homologado/.test(bVazio) && !/R\$\s*0,00/.test(bVazio), bVazio.slice(0, 200)); n++;

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
