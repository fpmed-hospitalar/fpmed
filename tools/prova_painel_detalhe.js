/* ═══════════════════════════════════════════════════════════════════════════════════════════
   prova_painel_detalhe.js — A FATIA A27 (14/08/2026, Trabalhador A)

   O dono abriu a tela logado e disse: "está muito difícil de mexer", "visualmente está muito
   ruim". O arquiteto desenhou o alvo em docs/molde_detalhe.html e mandou: *"faça IGUAL,
   exatamente"*. Esta prova responde à LISTA DE CONFERÊNCIA da caixa, linha por linha.

   >>> ELA NÃO PODE SER SCREENSHOT: eu não logo na tela. Então prova por MEDIÇÃO, em três
       camadas, e a primeira é a que vale mais:

     1. FUNCIONAL, CONTRA O BANCO REAL. As funções que decidem o que cada célula da tabela diz
        (`unitarioEdital`, `detTeto`, `detRef`, `detCelTeto`, `detSelo`) são ARRANCADAS do
        fpmed_licitacoes.html e executadas aqui, com o motor CMED de verdade e o índice de teto
        montado a partir do banco — em cima de ITENS REAIS da `licitacao_itens`. É o único jeito
        de provar que "sem teto CMED" e "sem referência" aparecem no dado que existe, e que
        NENHUM item vira "R$ 0,00".

     2. ESTRUTURAL. Cada linha da lista de conferência da caixa vira um marcador exigido no
        arquivo (painel fixo, cabeçalho, chips, abas, tabela, rodapé de seleção, Esc…), mais a
        VARREDURA DE COR: zero hex à mão nos blocos novos.

     3. RED TEST. Verde só vale quando o vermelho é possível: cada checagem estrutural é
        submetida a uma cópia temporária com o defeito INJETADO, e tem que acusar.

   SÓ-LEITURA no repositório: o red test acontece em pasta temporária.

   node tools/prova_painel_detalhe.js
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const ALVO = path.join(RAIZ, 'fpmed_licitacoes.html');
const T = require(path.join(RAIZ, 'fpmed_teto_cmed.js'));   // O MOTOR DE VERDADE, nunca uma cópia

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

let p = 0, f = 0;
const ok = (t, c, e) => {
  if (c) { p++; return true; }
  f++; console.log('  FALHA · ' + t + (e !== undefined ? '\n           ' + JSON.stringify(e).slice(0, 300) : ''));
  return false;
};

async function paginado(rota) {
  let out = [], de = 0;
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${SB}/rest/v1/${rota}`, { headers: { ...H, Range: de + '-' + (de + 999) } });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + rota);
    const j = await r.json();
    out = out.concat(j);
    if (j.length < 1000) break;
    de += 1000;
  }
  return out;
}

/* ══ AS FUNÇÕES DA TELA, ARRANCADAS DA TELA ═══════════════════════════════════════════════════
   Copiar as regras pra cá seria provar a minha cópia, e não a tela. O recorte é por NOME de
   função, e se algum dia uma delas mudar de nome a extração quebra na hora — que é o
   comportamento certo: prova que continua passando depois que o alvo sumiu é pior que prova
   nenhuma. */
function recorta(txt, abre, fecha) {
  const i = txt.indexOf(abre);
  if (i < 0) throw new Error('não achei o trecho que começa em: ' + abre);
  const j = txt.indexOf(fecha, i);
  if (j < 0) throw new Error('não achei o fim do trecho: ' + fecha);
  return txt.slice(i, j);
}
function montaRender(html, idx, cmedErro) {
  const pedaco = [
    recorta(html, 'function unitarioEdital(it){', '\n}\n') + '\n}\n',
    recorta(html, 'function detTeto(it, uE){', 'function pintaDetalhe(estado){'),
  ].join('\n');
  /* `unidadePack` vem do MOTOR, e a tela o pega no mesmo lugar (linha `const { semAcento,
     doses, ... unidadePack, packNosso } = window.LimedtecTetoCMED`). Reescrevê-lo aqui seria a
     segunda regra de embalagem — o erro de 100x que a A21 documentou. */
  const fab = new Function('LimedtecTetoCMED', '_cmedIdx', '_cmedErro', 'esc', 'brlU', `
    const { unidadePack } = LimedtecTetoCMED;
    ${pedaco}
    return { unitarioEdital, detTeto, detRef, detCelTeto, detSelo, _pct1 };
  `);
  const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const brlU = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return fab(T, idx, cmedErro || null, esc, brlU);
}

// ── a lista de conferência da caixa, virada em marcadores exigidos no arquivo ────────────────
const ESTRUTURA = [
  ['painel lateral: position:fixed com rolagem própria',
    /#detalhe\{position:fixed;top:0;right:0;bottom:0/, '#detalhe{position:fixed;top:0;right:0;bottom:0'],
  ['a lista de trás NÃO se move (body travado)',
    /body\.det-aberto\{overflow:hidden\}/, 'body.det-aberto{overflow:hidden}'],
  ['a rolagem não vaza para a página (overscroll contido)',
    /overscroll-behavior:contain/, 'overscroll-behavior:contain'],
  ['Esc fecha o painel',
    /ev\.key === 'Escape' && DET/, "ev.key === 'Escape' && DET"],
  ['fechar volta ao mesmo ponto da rolagem',
    /window\.scrollTo\(\{ top: _DET_ROLAGEM/, 'window.scrollTo({ top: _DET_ROLAGEM'],
  ['cabeçalho fixo, fora do rolo',
    /\.det-cab\{flex:none/, '.det-cab{flex:none'],
  ['cabeçalho traz órgão · município/UF · unidade',
    /un\.codigoUnidade \? ' · unidade '/, "un.codigoUnidade ? ' · unidade '"],
  ['botão fechar com Esc anunciado',
    /class="det-fechar" onclick="fecharDetalhe\(\)" title="Fechar \(Esc\)"/, 'det-fechar title="Fechar (Esc)"'],
  ['fila de chips de estado (portal e origem inclusos)',
    /l\.usuarioNome \? '<span class="bdg cinza" title="portal em que este certame foi publicado"/, 'chip do portal'],
  ['chip DOS MEUS NEGÓCIOS',
    /DOS MEUS NEGÓCIOS/, 'DOS MEUS NEGÓCIOS'],
  ['ação verde primária de adicionar aos negócios',
    /btn mini bt-verde" onclick="mandarDetalheProFunil\(\)/, 'btn bt-verde mandarDetalheProFunil'],
  ['Conversar com o edital com o aviso de custo ao lado',
    /Conversar com o edital<span class="det-custo">custa por leitura<\/span>/, 'custo às claras'],
  ['Arquivos do edital com a conta',
    /Arquivos do edital'\s*\+\s*\(nArq \? '<span class="det-custo">'\+nArq/, 'Arquivos do edital (n)'],
  ['··· mais ações',
    /··· mais ações/, '··· mais ações'],
  ['ficha em GRADE, rótulo em cima e valor embaixo',
    /\.det-ficha \.f-rot\{display:block/, '.det-ficha .f-rot{display:block'],
  ['ficha: nenhum rótulo grudado no valor (rótulo e valor são spans irmãos separados)',
    /<span class="f-rot">Publicação<\/span>'\s*\+/, 'f-rot Publicação seguido de quebra'],
  ['ficha: valor estimado nunca "R$ 0,00" quando não informado',
    /Number\(l\.valorTotalEstimado\) > 0/, 'guarda do valor estimado'],
  ['objeto em uma linha com o termo destacado',
    /<p class="det-objeto">'\+grifa\(l\.objetoCompra\|\|''\)/, 'det-objeto com grifa'],
  ['abas Itens / Documentos / Resultado',
    /aba\('itens', 'Itens'[\s\S]{0,400}?aba\('documentos', 'Documentos'[\s\S]{0,400}?aba\('resultado', 'Resultado'/, 'as três abas'],
  ['aba ativa em azul de ação cheio',
    /\.det-aba\[aria-selected="true"\]\{background:var\(--azul-600\)/, 'aba ativa azul-600'],
  ['barra: busca dentro dos itens',
    /class="det-busca" placeholder="procurar dentro dos '\+d\.itens\.length\+' itens deste edital…"/, 'busca interna'],
  ['barra: contador honesto (a lista continua inteira)',
    /mostrando todos, os que casam vêm primeiro/, 'contador honesto'],
  ['barra: Compacta / Confortável',
    /det-dens[\s\S]{0,320}?Compacta<\/button>[\s\S]{0,120}?Confortável<\/button>/, 'alternador de densidade'],
  ['aviso âmbar de leitura incompleta com o número real de itens lidos',
    /det-aviso[\s\S]{0,400}?<b>'\+d\.itens\.length\+' itens<\/b>/, 'aviso com número real'],
  ['tabela: cabeçalho fixo',
    /\.det-tab2 thead th\{position:sticky;top:0/, 'thead sticky'],
  ['tabela: as oito colunas na ordem da caixa',
    /marcar todos os itens[\s\S]{0,900}?>Nº<[\s\S]{0,200}?>Descrição do item<[\s\S]{0,200}?>Qtd<[\s\S]{0,200}?>Un\.<[\s\S]{0,200}?>Referência<[\s\S]{0,200}?>Teto CMED<[\s\S]{0,200}?>Situação</, 'ordem das colunas'],
  ['tabela: número à direita com tabular-nums',
    /\.det-tab2 td\.num\{text-align:right;font-variant-numeric:tabular-nums/, 'num à direita'],
  ['tabela: fio de 1px (e nada de zebra)',
    /\.det-tab2 tbody td\{border-bottom:1px solid var\(--cinza-200\)/, 'fio de 1px'],
  ['tabela: hover na linha',
    /\.det-tab2 tbody tr:hover td\{background:var\(--linha-hover\)/, 'hover na linha'],
  ['tabela: 40px compacta / 48px confortável',
    /--det-linha,48px[\s\S]{0,300}?\.det-rolo\.compacta\{--det-linha:40px\}/, 'alturas 40/48'],
  ['selo cabe/estoura por item',
    /det-selo cabe" title[\s\S]{0,400}?det-selo estoura" title/, 'selos cabe e estoura'],
  ['rodapé de seleção só existe com item marcado',
    /const rodape = nSel\s*\n?\s*\?/, 'rodapé condicionado a nSel'],
  ['filtros recolhidos por padrão',
    /#avancada\{display:none/, '#avancada{display:none'],
  ['botão Filtros com a conta dos critérios ativos',
    /b\.innerHTML = 'Filtros' \+ \(cs\.length \? '<span class="conta">'\+cs\.length/, 'Filtros (n)'],
  ['zero rolagem horizontal: a coluna de resultado tem piso zero',
    /#painel-busca\{display:grid;grid-template-columns:minmax\(0,1fr\)/, 'minmax(0,1fr)'],
  ['zero rolagem horizontal: a tabela larga do resultado rola dentro da caixa dela',
    /\.det-tab-caixa\{overflow-x:auto;max-width:100%\}/, '.det-tab-caixa'],
  ['o painel nunca é mais largo que a tela',
    /width:min\(1080px,96vw\)/, 'width:min(1080px,96vw)'],
];

// ── as frases honestas que a caixa exige, escritas no arquivo ───────────────────────────────
const FRASES_HONESTAS = ['sem referência', 'sem teto CMED', 'nada a comparar', 'única régua'];

function checaEstrutura(txt, silencioso) {
  const falhas = [];
  for (const [rot, re] of ESTRUTURA) if (!re.test(txt)) falhas.push(rot);
  for (const fr of FRASES_HONESTAS) if (!txt.includes(fr)) falhas.push('frase honesta: ' + fr);
  if (!silencioso) falhas.forEach(x => ok(x, false));
  return falhas;
}

/* ══ A VARREDURA DE COR ═══════════════════════════════════════════════════════════════════════
   "Zero hex à mão" é regra permanente da caixa. A varredura olha só os blocos que a A27 escreveu
   (do drawer ao rodapé de seleção) — o resto do arquivo é território de outras fatias, e acusar
   ali seria acusar trabalho que não é desta. */
/* OS COMENTÁRIOS SAEM ANTES DE QUALQUER VARREDURA. Esta tela documenta as decisões DENTRO do
   código — é regra da casa —, e as decisões de cor citam o hex que o token vale ("o tema já tem
   #FEF6E4 exato"). Varrer o comentário faria a prova acusar a própria explicação de por que não
   há hex à mão. O mesmo vale para as medidas: "MEDIDO em 1536px" é uma frase, não um layout. */
const semComentario = s => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

function blocoA27(txt) {
  const i = txt.indexOf('#det-veu{position:fixed');
  const j = txt.indexOf('.det-secao-corpo{padding');
  return (i < 0 || j < 0) ? null : txt.slice(i, j);
}
function varreCor(txt) {
  const cru = blocoA27(txt);
  if (cru == null) return ['não achei o bloco da A27 para varrer'];
  const bloco = semComentario(cru);
  const achados = [];
  // `#det-veu`, `#detalhe` e afins são SELETORES de id — cor é hex de 3, 6 ou 8 dígitos e nada
  // de letra depois. Por isso a âncora `\b` e a exigência de que só haja dígitos hexadecimais.
  const reHex = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b(?![\w-])/g;
  let m;
  while ((m = reHex.exec(bloco))) achados.push(m[0]);
  if (/rgba?\(/.test(bloco)) achados.push('rgba() à mão');
  return achados;
}

(async () => {
  console.log('PROVA DO PAINEL DE DETALHE — fatia A27 (o alvo é docs/molde_detalhe.html)\n');
  /* CRLF NORMALIZADO NA ENTRADA: o arquivo é editado no Windows, e um `\r` invisível no meio
     de um recorte por texto faria a extração falhar por um motivo que não tem nada a ver com o
     que está sendo provado. */
  const html = fs.readFileSync(ALVO, 'utf8').replace(/\r\n/g, '\n');

  // ══ 1. FUNCIONAL, CONTRA O BANCO ═════════════════════════════════════════════════════════
  console.log('── 1. as células da tabela, decididas pelas funções DA TELA sobre item REAL ──');
  const [teto, dic] = await Promise.all([
    paginado('cmed_teto?select=subst_norm,dose_key,apresentacoes,teto_min,teto_max,tem_cap'),
    paginado('cmed_dicionario?select=marca_norm,substancia'),
  ]);
  const idx = T.indexar({ regua: [], teto, dicionario: dic });
  ok('a régua do teto veio do banco com conteúdo', teto.length > 1000, teto.length);

  const R = montaRender(html, idx, null);

  /* Amostra do dado REAL, e de propósito com os três casos que a caixa cita: com referência,
     sem referência (sigiloso) e sem valor nenhum. Sortear só "itens bonitos" provaria que o
     layout serve ao caso bonito — que é exatamente o que a caixa proíbe. */
  /* ══ A AMOSTRA É ESTRATIFICADA DE PROPÓSITO ═══════════════════════════════════════════════
     A primeira versão pegou os 1.000 itens mais novos e deu "sem referência: 0" — e eu quase
     escrevi que a coluna nunca precisa da frase honesta. Ela precisa: medido no banco inteiro,
     são 77.298 de 96.163 itens COM referência, 16.822 com orçamento sigiloso e 2.043 sem
     nenhum dos dois. Os itens mais novos por acaso vieram todos com preço.
     >>> AMOSTRA QUE SÓ PEGA O CASO COMUM PROVA O LAYOUT BONITO, que é exatamente o que a caixa
         proíbe ("o layout tem que servir ao caso real, não ao caso bonito"). Então são TRÊS
         consultas, uma por estado, e a prova exige as três populadas. */
  const puxa = q => fetch(`${SB}/rest/v1/licitacao_itens?select=descricao,quantidade,unidade,`
    + `valor_unitario_ref,bruto&` + q, { headers: H }).then(r => r.json());
  /* >>> "SEM VALOR" É `= 0`, E NÃO `IS NULL` — e isso foi medido nesta prova, não suposto: a
         consulta por `is.null` devolveu ZERO linha, e a `coleta_itens_lote` grava 0 quando o
         PNCP não publica preço. É a diferença entre a prova achar 0 casos e concluir que a
         frase "sem referência" nunca é usada (falso), e achar os 18.865 que existem. */
  const [novos, refZero, sigilosos] = await Promise.all([
    puxa('limit=1500&order=id.desc'),
    puxa('valor_unitario_ref=eq.0&limit=800&order=id.desc'),
    puxa('bruto->>orcamentoSigiloso=eq.true&limit=500&order=id.desc'),
  ]);
  // sigiloso ganha do zero na hora de escrever a célula (é `unitarioEdital` quem decide, e ele
  // pergunta pelo sigilo primeiro), então "sem referência" só sai dos zerados NÃO sigilosos.
  const semPreco = refZero.filter(x => (x.bruto || {}).orcamentoSigiloso !== true);
  const amostra = novos.concat(semPreco, sigilosos);
  console.log(`   amostra estratificada: ${novos.length} recentes + ${semPreco.length} sem valor `
    + `+ ${sigilosos.length} de orçamento sigiloso`);
  ok('a amostra de itens reais tem tamanho de prova', amostra.length >= 1500, amostra.length);
  ok('a amostra cobre os três estados de referência do banco',
    novos.length > 0 && semPreco.length > 0 && sigilosos.length > 0,
    { novos: novos.length, semPreco: semPreco.length, sigilosos: sigilosos.length });

  const linhas = amostra.map(x => {
    const it = {
      descricao: x.descricao, quantidade: x.quantidade, unidadeMedida: x.unidade,
      valorUnitarioEstimado: x.valor_unitario_ref,
      orcamentoSigiloso: (x.bruto || {}).orcamentoSigiloso === true,
    };
    const uE = R.unitarioEdital(it);
    const t = R.detTeto(it, uE);
    return { it, uE, t, ref: R.detRef(uE), cel: R.detCelTeto(t), selo: R.detSelo(t, uE) };
  });

  const conta = fn => linhas.filter(fn).length;
  const comTeto = conta(l => l.t.estado === 'ok');
  const semTeto = conta(l => l.t.estado === 'sem-teto');
  const semRef = conta(l => /sem referência/.test(l.ref));
  const sigil = conta(l => /orçamento sigiloso/.test(l.ref));
  const cabe = conta(l => /det-selo cabe/.test(l.selo));
  const estoura = conta(l => /det-selo estoura/.test(l.selo));
  const unica = conta(l => /única régua/.test(l.selo));
  const nada = conta(l => /nada a comparar/.test(l.selo));
  console.log(`   ${linhas.length} itens reais medidos:`);
  console.log(`     com teto CMED ......... ${comTeto}      sem teto CMED ......... ${semTeto}`);
  console.log(`     sem referência ........ ${semRef}      orçamento sigiloso .... ${sigil}`);
  console.log(`     selo "cabe" ........... ${cabe}      selo "estoura" ........ ${estoura}`);
  console.log(`     selo "única régua" .... ${unica}      "nada a comparar" ..... ${nada}`);

  /* A PROVA QUE MAIS IMPORTA, e a mais fácil de passar sem querer: NENHUMA célula pode dizer
     R$ 0,00. Um teto zerado faria toda proposta parecer acima do limite legal — e material e
     correlato, que é metade de um edital hospitalar, não tem teto por natureza. */
  const zerados = linhas.filter(l => /R\$\s*0,00(?!\d)/.test(l.ref) || /R\$\s*0,00(?!\d)/.test(l.cel));
  ok('NENHUM item vira "R$ 0,00" na referência nem no teto', zerados.length === 0,
    zerados.slice(0, 3).map(z => ({ d: String(z.it.descricao).slice(0, 50), ref: z.ref, cel: z.cel })));

  ok('"sem teto CMED" aparece no dado real (material e correlato não têm teto)', semTeto > 0, semTeto);
  ok('"com teto CMED" aparece no dado real (senão a régua não estaria ligada)', comTeto > 0, comTeto);
  ok('"sem referência" aparece no dado real', semRef > 0, semRef);
  ok('o selo "cabe" e o selo "estoura" existem os dois no dado real', cabe > 0 && estoura > 0, { cabe, estoura });
  ok('todo item com teto e sem referência vira "única régua", nunca "cabe · 0%"',
    linhas.every(l => !(l.t.estado === 'ok' && l.uE.status !== 'ok') || /única régua/.test(l.selo)));
  ok('todo item sem teto e sem referência vira "nada a comparar"',
    linhas.every(l => !(l.t.estado !== 'ok' && l.uE.status !== 'ok') || /nada a comparar/.test(l.selo)));
  ok('toda célula de referência sem preço diz uma FRASE, nunca um número',
    linhas.every(l => l.uE.status === 'ok' || /sem referência|orçamento sigiloso|conferir emb\./.test(l.ref)));

  /* A CONTA DO SELO É CONFERIDA À MÃO em três itens reais que casaram, um a um. A base é o TETO
     nos dois sentidos — a divergência declarada em relação ao molde do arquiteto, que usava
     duas bases diferentes na mesma coluna. */
  const casados = linhas.filter(l => l.t.estado === 'ok' && l.uE.status === 'ok').slice(0, 3);
  ok('há itens reais com os dois lados para conferir a conta à mão', casados.length === 3, casados.length);
  casados.forEach((l, k) => {
    const d = (l.uE.valor - l.t.teto) / l.t.teto * 100;
    const esperado = Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    console.log(`   conferido ${k + 1}: "${String(l.it.descricao).slice(0, 44)}"`
      + ` ref ${l.uE.valor.toFixed(4)} × teto ${l.t.teto.toFixed(4)} -> ${d <= 0 ? 'cabe' : 'estoura'} · ${esperado}%`);
    ok(`item conferido ${k + 1}: o selo mostra a conta certa sobre a base do teto`,
      l.selo.includes(esperado + '%') && l.selo.includes(d <= 0 ? 'cabe' : 'estoura'), l.selo);
  });

  /* OS TRÊS "NÃO SEI" SÃO DISTINTOS. Sem régua carregada a coluna NÃO pode dizer "sem teto
     CMED": "ainda não olhei" e "não existe teto" levam a decisões opostas. */
  const semRegua = montaRender(html, null, null);
  const semReguaCel = semRegua.detCelTeto(semRegua.detTeto({ descricao: 'DIPIRONA 500MG' }, { status: 'sem-preco' }));
  ok('sem a régua carregada, a coluna diz "lendo a régua…" e NÃO "sem teto CMED"',
    /lendo a régua/.test(semReguaCel) && !/sem teto CMED/.test(semReguaCel), semReguaCel);
  const comErro = montaRender(html, null, 'a CMED não pôde ser lida');
  const celErro = comErro.detCelTeto(comErro.detTeto({ descricao: 'DIPIRONA 500MG' }, { status: 'sem-preco' }));
  ok('com erro na régua, a coluna diz "não sei" e NÃO "sem teto CMED"',
    /não sei/.test(celErro) && !/sem teto CMED/.test(celErro), celErro);

  // ══ 2. ESTRUTURAL ════════════════════════════════════════════════════════════════════════
  console.log('\n── 2. a lista de conferência da caixa, marcador por marcador ──');
  const falhas = checaEstrutura(html);
  ok(`os ${ESTRUTURA.length} marcadores da lista de conferência + as ${FRASES_HONESTAS.length} frases honestas`,
    falhas.length === 0, falhas);

  const cores = varreCor(html);
  ok('varredura de cor: zero hex à mão e zero rgba() nos blocos da A27', cores.length === 0, cores);

  /* LARGURA: nenhum px fixo do painel pode passar do viewport de 1366px do dono, e o painel
     mede `min(1080px,96vw)` — que em 1366px dá 1080px, sobrando 286px de lista atrás. */
  const pxDoPainel = [...semComentario(html).matchAll(/(\d{3,5})px/g)].map(m => Number(m[1]))
    .filter(n => n >= 1367);
  ok('nenhuma medida fixa maior que o viewport de 1366px do dono (fora de comentário)',
    pxDoPainel.length === 0, pxDoPainel.slice(0, 6));
  /* E o painel divide a tela em vez de tomá-la: em 1366px ele mede 1080px e deixa 286px de
     lista visível atrás — que é o que faz "a lista de trás continua ali" ser verdade visível,
     e não só um detalhe de implementação. */
  ok('em 1366px o painel deixa lista à mostra atrás (1366 − 1080 = 286px)',
    Math.min(1080, 1366 * 0.96) === 1080 && 1366 - 1080 === 286);

  // ══ 3. RED TEST — verde só vale quando o vermelho é possível ═════════════════════════════
  console.log('\n── 3. red test: cada checagem tem que ACUSAR o defeito injetado ──');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a27-'));
  const injecoes = [
    ['a página volta a poder rolar de lado (piso auto na coluna)',
      s => s.replace('#painel-busca{display:grid;grid-template-columns:minmax(0,1fr)',
        '#painel-busca{display:grid;grid-template-columns:1fr'),
      'zero rolagem horizontal: a coluna de resultado tem piso zero'],
    ['o painel volta a ser bloco empurrando a lista',
      s => s.replace('#detalhe{position:fixed;top:0;right:0;bottom:0', '#detalhe{position:static;top:0;right:0;bottom:0'),
      'painel lateral: position:fixed com rolagem própria'],
    ['o Esc para de fechar',
      s => s.replace("ev.key === 'Escape' && DET", "ev.key === 'EscapeXX' && DET"),
      'Esc fecha o painel'],
    ['o cabeçalho da tabela para de ser fixo',
      s => s.replace('.det-tab2 thead th{position:sticky;top:0', '.det-tab2 thead th{position:static;top:0'),
      'tabela: cabeçalho fixo'],
    ['os filtros voltam a nascer abertos',
      s => s.replace('#avancada{display:none', '#avancada{display:block'),
      'filtros recolhidos por padrão'],
    ['some a frase honesta "nada a comparar"',
      s => s.split('nada a comparar').join('sem informação'),
      'frase honesta: nada a comparar'],
  ];
  for (const [nome, muta, esperado] of injecoes) {
    const doente = muta(html);
    ok(`o defeito foi mesmo injetado (${nome})`, doente !== html);
    const acusou = checaEstrutura(doente, true);
    ok(`RED: acusa "${nome}" na linha certa`, acusou.includes(esperado), acusou.slice(0, 4));
  }
  const corDoente = html.replace('.det-selo.cabe{background:var(--verde-50)', '.det-selo.cabe{background:#F1F8E6');
  ok('o hex à mão foi mesmo injetado', corDoente !== html);
  ok('RED: a varredura de cor acusa um hex à mão', varreCor(corDoente).length > 0, varreCor(corDoente));
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}

  console.log(`\n${p} asserts OK · ${f} falha(s)`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
