// SUITE testa_relogio_prazo — O RELOGIO E A BARRA DO CARTAO, E O RODAPE DE SELECAO
// (fatia A38 · molde_encontrar_v2 itens 3, 4, 11 e 14 · 20/08/2026)
//
// == O QUE O MOLDE v2 MANDA, LITERAL =========================================================
//   item 3: "O relogio e a informacao no 1 de cada cartao, alinhado a direita, em tamanho
//            grande: 'faltam 3 dias', com a data embaixo. Verde > 7 dias, ambar 1-7, vermelho
//            no mesmo dia."
//   item 4: "Barra colorida na borda esquerda repetindo esse sinal — o olho acha antes de ler."
//   item 14:"Rodape de selecao so existe com item marcado, e diz o numero exato do que a acao
//            vai atingir."
//
// == E A DIVERGENCIA QUE ESTA SUITE GUARDA ====================================================
// A barra da esquerda ja carregava um sinal de tempo: a URGENCIA DA ABERTURA (A3). O molde v2
// manda ela repetir o RELOGIO, que le o ENCERRAMENTO. As duas nao cabem na mesma barra, e a
// escolha foi o molde — porque o que faz alguem perder um edital e o PRAZO acabar, nao a sessao
// passar. A abertura continua dita EM PALAVRAS na pastilha `urg--*`, e ha assert cobrando isso:
// a decisao foi trocar a data que a regua le, nao apagar a outra pergunta.
//
// == E UM ACHADO QUE NAO ERA DA FATIA =========================================================
// O rodape do painel afirmava, em negrito e em toda busca, "ordenadas por quem ENCERRA primeiro".
// A lista nunca esteve: a ordem padrao e a ABERTURA (decisao escrita da A3) e desde que o seletor
// existe ela pode ser valor ou aderencia. Numero certo, legenda errada — o mesmo defeito do
// "publicadas no dia", e pior, porque a legenda descreve a ORDEM.
//
//   node tests/testa_relogio_prazo.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const TELA = fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8');
const TEMA = fs.readFileSync(path.join(raiz, 'fpmed_tema.css'), 'utf8');
const MOLDE = fs.readFileSync(path.join(raiz, 'docs', 'molde_encontrar_v2.html'), 'utf8');
/* O CSS sem quebras, para casar regra escrita em duas linhas — o mesmo recorte que as outras
   catracas desta casa ja usam. */
const CSS = TELA.replace(/\s*\n\s*/g, '');

/* A FUNCAO DE VERDADE, recortada do arquivo de verdade — nao uma copia "parecida" aqui dentro.
   Copia envelhece sem ninguem ver: e exatamente o defeito que esta suite existe para pegar. */
function fn(nome) {
  const m = new RegExp('(?:^|\\n)\\s*function\\s+' + nome + '\\s*\\(').exec(TELA);
  if (!m) throw new Error('nao achei a funcao ' + nome + ' em fpmed_licitacoes.html');
  let i = TELA.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < TELA.length; j++) {
    if (TELA[j] === '{') n++;
    else if (TELA[j] === '}') { n--; if (!n) return TELA.slice(m.index, j + 1); }
  }
  throw new Error('chave nao fechou: ' + nome);
}
const DEPS = "const dt = s => { if(!s) return null; const d=new Date(s); return isNaN(d)?null:d; };"
  + "const fmtDt = s => { const d=dt(s); return d ? d.toLocaleDateString('pt-BR')+' as '+"
  + "d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '—'; };";
const { relogioPrazo, urgenciaAbertura } = (new Function(
  DEPS + fn('relogioPrazo') + fn('urgenciaAbertura') + 'return { relogioPrazo, urgenciaAbertura };'))();

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_relogio_prazo — o relogio, a barra e o rodape de selecao (A38)\n');

/* AS DATAS SAO CONSTRUIDAS A PARTIR DE UM "AGORA" FIXO, e nao de `new Date()` solto: uma suite
   que muda de resultado conforme a hora em que roda e uma suite que um dia falha sozinha as
   23h58 e ninguem entende por que. */
const AGORA = new Date(2026, 7, 20, 13, 0, 0);              // 20/08/2026, 13h
const emDias = (d, h) => new Date(2026, 7, 20 + d, h == null ? 9 : h, 0, 0).toISOString();

// ══════════ 1. OS CINCO ESTADOS DO RELOGIO (molde item 3) ══════════
{
  const hoje  = relogioPrazo(emDias(0), AGORA);
  const tres  = relogioPrazo(emDias(3), AGORA);
  const sete  = relogioPrazo(emDias(7), AGORA);
  const oito  = relogioPrazo(emDias(8), AGORA);
  const passou= relogioPrazo(emDias(-5), AGORA);
  const nada  = relogioPrazo(null, AGORA);

  ok(n + '. *** o texto do molde e literal: "faltam 3 dias" ***', tres.quanto === 'faltam 3 dias', tres.quanto); n++;
  ok(n + '. ...e a data vem embaixo, e nao no lugar do "faltam" (o molde tem as DUAS)',
    /^encerra \d{2}\/\d{2}\/\d{4}/.test(tres.quando), tres.quando); n++;
  ok(n + '. *** vermelho no MESMO DIA ***', hoje.faixa === 'hoje' && hoje.quanto === 'encerra hoje', hoje); n++;
  ok(n + '. *** ambar de 1 a 7 dias — e o SETE ainda e ambar, que e onde a borda mente ***',
    tres.faixa === 'perto' && sete.faixa === 'perto', { tres: tres.faixa, sete: sete.faixa }); n++;
  ok(n + '. *** verde a partir de 8 — o degrau imediatamente depois do corte ***',
    oito.faixa === 'longe', oito); n++;
  /* "faltam 1 dias" e o erro de plural que toda tela comete uma vez. */
  ok(n + '. o singular do dia esta certo ("faltam 1 dia")',
    relogioPrazo(emDias(1), AGORA).quanto === 'faltam 1 dia', relogioPrazo(emDias(1), AGORA).quanto); n++;

  // ══ AS DUAS AUSENCIAS, E ELAS SAO DIFERENTES (molde item 7) ══
  ok(n + '. *** "encerrada" e "prazo nao informado" sao respostas DIFERENTES ***',
    passou.quanto === 'encerrada' && nada.quanto === 'prazo não informado', { passou: passou.quanto, nada: nada.quanto }); n++;
  ok(n + '. *** e nenhuma das duas e um travessao, um zero ou uma celula vazia ***',
    !/^[—\-]?$/.test(passou.quanto) && !/^[—\-]?$/.test(nada.quanto)
    && !/R\$\s*0/.test(nada.quanto)); n++;
  ok(n + '. ...e "prazo nao informado" diz no title que e IGNORANCIA, nao ausencia de prazo',
    /não sei qual é/.test(nada.titulo), nada.titulo); n++;
  ok(n + '. sem prazo NAO ganha data ("encerra —" seria o travessao pela porta dos fundos)',
    nada.quando === ''); n++;

  /* O DEFEITO DE FUSO QUE JA ARQUIVOU UM NEGOCIO SOZINHO (06/08): comparar 24 horas em vez de
     dia de calendario. Um encerramento as 9h de amanha esta a 20 horas — e "faltam 0 dias" para
     quem le as 13h de hoje seria o pior de todos os textos possiveis. */
  ok(n + '. *** compara DIA DE CALENDARIO: encerramento as 9h de amanha e "faltam 1 dia", nunca "hoje" ***',
    relogioPrazo(emDias(1, 9), AGORA).faixa === 'perto'
    && relogioPrazo(emDias(1, 9), AGORA).quanto === 'faltam 1 dia'); n++;
  ok(n + '. ...e encerramento as 23h de HOJE continua sendo "encerra hoje"',
    relogioPrazo(emDias(0, 23), AGORA).faixa === 'hoje'); n++;
}

// ══════════ 2. A BARRA REPETE O RELOGIO — UMA CONTA SO (molde item 4) ══════════
{
  ok(n + '. *** a classe da barra sai da MESMA chamada que o texto (nunca duas contas) ***',
    /const rel = relogioPrazo\(l\.dataEncerramentoProposta, agora\);/.test(TELA)
    && /class="lic clicavel'\+rel\.classe/.test(TELA)); n++;
  ok(n + '. as cinco regras da barra existem, e cada faixa tem a sua',
    /\.lic\.rel-hoje::before\{background:var\(--sinal-perigo-barra\)\}/.test(CSS)
    && /\.lic\.rel-perto::before\{background:var\(--sinal-atencao-barra\)\}/.test(CSS)
    && /\.lic\.rel-longe::before\{background:var\(--sinal-bom-icone\)\}/.test(CSS)
    && /\.lic\.rel-fim::before\{background:var\(--cinza-300\)\}/.test(CSS)
    && /\.lic\.rel-nd::before\{background:var\(--sinal-normal-barra\)\}/.test(CSS)); n++;
  /* ZERO HEX A MAO: a cor vem do token, sempre — inclusive na miuda. */
  const bloco = CSS.slice(CSS.indexOf('.lic.rel-hoje::before'), CSS.indexOf('.selbar{'));
  ok(n + '. *** nenhum hex e nenhum rgba() escritos a mao no bloco do relogio e da barra ***',
    !/#[0-9a-fA-F]{3,8}\b/.test(bloco) && !/rgba?\(/.test(bloco), bloco.slice(0, 160)); n++;
  ok(n + '. e os tres pares usados sao os que o TEMA reserva para urgencia (nao inventei par novo)',
    /--sinal-perigo-barra/.test(TEMA) && /--sinal-atencao-barra/.test(TEMA) && /--sinal-bom-icone/.test(TEMA)); n++;

  // ── O RELOGIO E GRANDE, E FICA A DIREITA (molde item 3) ──
  ok(n + '. *** o relogio e alinhado a DIREITA e em tamanho grande (--txt-4 = 20px, o do molde) ***',
    /\.lic \.relogio\{[^}]*text-align:right/.test(CSS)
    && /\.lic \.relogio \.quanto\{[^}]*font-size:var\(--txt-4\)/.test(CSS)); n++;
  ok(n + '. ...e o numero e tabular, senao a coluna de relogios nao alinha o algarismo',
    /\.lic \.relogio \.quanto\{[^}]*font-variant-numeric:tabular-nums/.test(CSS)); n++;
  ok(n + '. o molde tambem pede 20px, e nao e coincidencia — e o mesmo numero',
    /\.relogio \.quanto\{font-size:20px/.test(MOLDE.replace(/\s*\n\s*/g, ''))); n++;

  // ── E O QUE A ABERTURA PERDEU FOI A BARRA, NAO A VOZ ──
  ok(n + '. *** a abertura continua dita EM PALAVRAS (a pastilha urg--* segue no cartao) ***',
    /urg\.pastilha/.test(TELA)
    && urgenciaAbertura(emDias(0), AGORA).pastilha.indexOf('abre hoje') > -1); n++;
  ok(n + '. *** e o cracha "encerra em Nd" SAIU: uma tela com duas verdades sobre o mesmo prazo '
    + 'ensina a nao ler nenhuma das duas ***',
    !/bdg [va]">encerra em/.test(TELA) && !/'encerra em '\+dias\+'d'/.test(TELA)); n++;
  ok(n + '. ...e a celula "Encerra em" tambem saiu do rodape de dados (era a TERCEIRA voz)',
    !/<small>Encerra em<\/small>/.test(TELA)); n++;
}

// ══════════ 3. O RODAPE DE SELECAO (molde item 14) ══════════
{
  ok(n + '. *** ele SO existe com item marcado (`hidden` no HTML, e so pintado com selecao) ***',
    /<div id="selbar" class="selbar" hidden><\/div>/.test(TELA)
    && /if\(!n\)\{ bar\.hidden = true; bar\.innerHTML = ''; return; \}/.test(TELA)); n++;
  ok(n + '. *** e diz o NUMERO EXATO do que a acao vai atingir, no proprio rotulo do botao ***',
    /' Cruzar as ' \+ n \+ ' com o estoque<\/button>'/.test(TELA)); n++;
  /* O NUMERO E DO QUE ESTA NA TELA, e nao do que ja foi clicado algum dia: a selecao guarda
     CHAVE, e uma busca nova pode ter tirado metade das marcadas da lista. */
  ok(n + '. *** o numero sai da INTERSECAO com a lista pintada, nunca do tamanho do Set ***',
    /function licsEscolhidas\(\)\{\s*return \(window\._hits \|\| \[\]\)\.filter\(l => ESCOLHIDAS\.has\(chaveLic\(l\)\)\);/
      .test(TELA.replace(/\r/g, ''))); n++;
  ok(n + '. ...e ele reconta depois de a lista ser repintada',
    /lista\.innerHTML = h;[\s\S]{0,400}?pintaEscolhidas\(\);/.test(TELA)); n++;

  // ── NUMERO HONESTO DENTRO DO RODAPE (molde item 7, aqui dentro) ──
  ok(n + '. *** valor: soma so quem informou, e DIZ de quantas e ***',
    /const comValor = ls\.filter\(l => Number\(l\.valorTotalEstimado\) > 0\);/.test(TELA)
    && /\(de ' \+ comValor\.length \+ '\)/.test(TELA)); n++;
  ok(n + '. ...e quando ninguem informou, ele diz isso — nao mostra R\$ 0,00',
    /valor estimado não informado/.test(TELA) && !/brl\(0\)/.test(TELA)); n++;
  ok(n + '. *** "itens meus" so aparece depois do cruzamento, e diz em quantas ele rodou ***',
    /itens ainda não cruzados com o estoque/.test(TELA)
    && /' \+ cruzadas\.length \+ ' de ' \+ n \+ ' cruzadas\)/.test(TELA)); n++;

  // ── A COR E O LUGAR ──
  ok(n + '. o fundo e o --navy, que o TEMA reserva com estas palavras para "barra flutuante"',
    /\.selbar\{[^}]*background:var\(--navy\)/.test(CSS)
    && /barra flutuante/.test(TEMA)); n++;
  ok(n + '. *** sticky e nao fixed: barra fixa flutuaria sobre o rodape da pagina para sempre ***',
    /\.selbar\{position:sticky;bottom:0/.test(CSS)); n++;
  /* A ordem da casa (A16): o overlay de sessao caida cobre TUDO. Uma barra de acao por cima de um
     pedido de login ofereceria um gesto que nao pode ser executado. */
  ok(n + '. *** e o z-index dela e baixo — nada disputa com o overlay de sessao caida ***',
    /\.selbar\{[^}]*z-index:5[;}]/.test(CSS)); n++;
  ok(n + '. no celular os botoes chegam a 44px, e a caixinha de marcar NAO engorda (item 15)',
    /@media \(max-width:480px\)\{\.selbar\{[^}]*\}\.selbar \.dir\{[^}]*\}\.selbar \.dir \.btn\{[^}]*min-height:44px/.test(CSS)
    && !/\.lic \.sel input\{[^}]*(44px|min-height)/.test(CSS)); n++;
  ok(n + '. limpar a selecao desmarca as caixas de verdade, e nao so esvazia o Set',
    /function limpaSelecao\(\)\{[\s\S]{0,400}?input:checked'\)\.forEach/.test(TELA)); n++;
}

// ══════════ 4. O ACHADO: O RODAPE AFIRMAVA UMA ORDEM QUE A LISTA NAO TINHA ══════════
{
  ok(n + '. *** a frase da ordenacao nao e mais fixa em "encerra primeiro" ***',
    !/ordenadas por quem <b>encerra primeiro<\/b>/.test(TELA)); n++;
  ok(n + '. *** ela sai de um mapa, e ele tem UMA entrada para cada opcao do seletor ***',
    /const ORDEM_ROTULO = \{ encerramento:'fecha primeiro', abertura:'abre primeiro',/.test(TELA)); n++;
  /* SE ALGUEM ACRESCENTAR UMA QUINTA OPCAO NO <select> E ESQUECER O MAPA, este assert acende. */
  const opcoes = [...TELA.matchAll(/<option value="(\w+)"'\+\(ORDEM==='/g)].map(m => m[1]);
  const rotulos = (TELA.match(/const ORDEM_ROTULO = \{([\s\S]*?)\};/) || [, ''])[1];
  ok(n + '. *** toda opcao do seletor tem rotulo no mapa (opcao nova nao pode nascer muda) ***',
    opcoes.length >= 4 && opcoes.every(o => new RegExp('\\b' + o + ':').test(rotulos)),
    { opcoes, rotulos }); n++;
  ok(n + '. ...e o fallback e o proprio valor, e nao "undefined" impresso na tela',
    /ORDEM_ROTULO\[ORDEM\] \|\| ORDEM/.test(TELA)); n++;
}

// ══════════ 5. A ORDENACAO E O "LIMPAR TUDO" (molde itens 11 e 9) ══════════
{
  /* O MOLDE v2 poe "fecha primeiro" como PRIMEIRA opcao — e a ordem das opcoes de um seletor e
     ela mesma um recado sobre qual e a pergunta principal da tela. */
  ok(n + '. *** "Fecha primeiro" existe, e e a PRIMEIRA opcao do seletor ***',
    /<option value="encerramento"'\+\(ORDEM==='encerramento'\?' selected':''\)\+'>Fecha primeiro<\/option>'\s*\n\s*\+\s*'<option value="abertura"/
      .test(TELA.replace(/\r/g, '')), (TELA.match(/<option value="\w+"/g) || []).slice(0, 5)); n++;
  ok(n + '. *** e ela e o PADRAO — a lista nao pode ser ordenada por uma data e gritar outra ***',
    /let ORDEM = 'encerramento';/.test(TELA)); n++;
  ok(n + '. ...e ela le o MESMO campo que o relogio do cartao (nunca dois campos de prazo)',
    /const da = dt\(a\.dataEncerramentoProposta\), db = dt\(b\.dataEncerramentoProposta\);/.test(TELA)
    && /relogioPrazo\(l\.dataEncerramentoProposta, agora\)/.test(TELA)); n++;
  /* "prazo nao informado" no topo de "fecha primeiro" seria a AUSENCIA de dado se passando pela
     urgencia maxima — o zero fingindo de dado, na coluna do tempo. */
  ok(n + '. *** quem nao tem encerramento vai pro FIM, e nao pro topo ***',
    /const semData = 8640000000000;/.test(TELA)
    && /\(da \? da\.getTime\(\) : semData\) - \(db \? db\.getTime\(\) : semData\)/.test(TELA)); n++;
  ok(n + '. a abertura NAO saiu do seletor — ela continua sendo uma pergunta legitima',
    /<option value="abertura"[\s\S]{0,80}Abertura mais próxima/.test(TELA)); n++;

  // ── "LIMPAR TUDO" AO LADO DOS CHIPS (molde item 9) ──
  ok(n + '. *** "limpar tudo" existe ao lado dos chips, e nao so dentro do painel fechado ***',
    /class="chip-limpar" onclick="limparRefino\(\)"/.test(TELA)); n++;
  ok(n + '. ...e ele chama o MESMO limparRefino do painel (nao uma segunda limpeza "parecida")',
    (TELA.match(/function limparRefino\(\)/g) || []).length === 1); n++;
  /* Com UM chip so, o "x" dele ja e o "limpar tudo": dois controles com o mesmo efeito lado a
     lado e a pessoa parando para decidir qual dos dois usar. */
  ok(n + '. *** ele so aparece com MAIS DE UM chip ***', /cs\.length > 1/.test(TELA)); n++;
  ok(n + '. e ele NAO tem cara de chip — link de acao no meio de rotulos, como no molde',
    /\.chip-limpar\{[^}]*border:0;background:none/.test(CSS)
    && /\.chip\.limpar\{background:transparent;border:0/.test(MOLDE.replace(/\s*\n\s*/g, ''))); n++;
}

// ══════════ 6. O ESTADO NA URL — "a URL vira a fotografia da tela" (molde item 10) ══════════
{
  ok(n + '. *** as QUATRO coisas do molde entram na URL: busca, filtros, ordenacao e densidade ***',
    /p\.set\(id\.replace\(\/\^f-\/,''\), v\)/.test(TELA)
    && /_URL_CAMPOS = \['f-kw','f-excluir','f-uf','f-mod','f-portal','f-modo','f-sit','f-srp',/.test(TELA)
    && /p\.set\('ordem', ORDEM\)/.test(TELA)
    && /p\.set\('densidade','compacta'\)/.test(TELA)); n++;
  /* `pushState` faria cada tecla de refino virar uma entrada no historico, e o VOLTAR do
     navegador levaria trinta cliques para sair da tela. */
  ok(n + '. *** replaceState, NUNCA pushState — a URL acompanha, nao grava trilha ***',
    /history\.replaceState\(null, '', location\.pathname/.test(TELA)
    && !/history\.pushState/.test(TELA)); n++;
  ok(n + '. ...e ela preserva o hash (a rota do painel nao pode morrer porque um filtro mudou)',
    /\+ \(location\.hash \|\| ''\)\);/.test(TELA)); n++;
  ok(n + '. campo vazio NAO vira parametro vazio na barra de enderecos',
    /if\(v\) p\.set\(/.test(TELA)); n++;
  /* A JANELA MOVEL NA URL FARIA O LINK, ABERTO AMANHA, PESQUISAR ONTEM EM SILENCIO. E a mesma
     lei que o jornal desta tela ja segue desde que ele existe. */
  ok(n + '. *** so a janela FIXA entra na URL — a movel gravada viraria uma data velha calada ***',
    /if\(f\.janela && f\.janela\.tipo === 'fixa'\)\{ p\.set\('de', f\.janela\.de\); p\.set\('ate', f\.janela\.ate\); \}/.test(TELA)); n++;
  ok(n + '. ...e as duas datas andam juntas na volta (meia janela e uma janela que ninguem escolheu)',
    /if\(p\.get\('de'\) && p\.get\('ate'\)\)\{/.test(TELA)); n++;
  /* ORDEM VINDA DE FORA E TEXTO DE ESTRANHO. Aceitar qualquer coisa faria o rodape imprimir o
     lixo recebido como se fosse um criterio ("ordenadas por drop table"). */
  ok(n + '. *** ordem vinda da URL e conferida contra a lista de opcoes, nunca aceita crua ***',
    /if\(o && \['encerramento','abertura','valor','aderencia'\]\.includes\(o\)\) ORDEM = o;/.test(TELA)); n++;
  ok(n + '. *** `?busca=1` separa "a tela com filtros prontos" de "a tela ja respondida" ***',
    /return p\.get\('busca'\) === '1';/.test(TELA) && /if\(buscarJa\) buscaNova\(\);/.test(TELA)); n++;
  /* Quem troca a densidade nao faz busca nenhuma — e se essa chamada apagasse o `busca=1`, a URL
     deixaria de trazer o resultado por causa de um gesto que nao tem nada a ver com ele. */
  ok(n + '. ...e trocar a densidade NAO apaga o `busca=1` que ja estava la',
    /const jaTinha = new URLSearchParams\(location\.search\)\.get\('busca'\) === '1';/.test(TELA)
    && /comBusca === undefined \? jaTinha : comBusca/.test(TELA)); n++;
  ok(n + '. o boot restaura ANTES de pintar os chips (senao a tela abre dizendo "sem filtro" com sete)',
    /const buscarJa = aplicaEstadoDaURL\(\);[\s\S]{0,300}?pintaChips\(\);/.test(TELA.replace(/\r/g,''))); n++;
  /* URL E CONFORTO. Ela nunca pode derrubar a busca — que e o oficio da tela. */
  ok(n + '. *** e nada disso pode derrubar a lista: as duas funcoes sao envolvidas em try ***',
    /\}catch\(e\)\{ \/\* URL é conforto; ela NUNCA pode derrubar a busca \*\/ \}/.test(TELA)
    && /function aplicaEstadoDaURL\(\)\{\s*try\{/.test(TELA.replace(/\r/g,''))); n++;
  ok(n + '. a URL e gravada onde a lista JA existe (depois do innerHTML), e nao na intencao',
    /lista\.innerHTML = h;[\s\S]{0,600}?gravaEstadoNaURL\(true\);/.test(TELA)); n++;
}

// ══════════ 7. OS ITENS NA PROPRIA LISTA (molde itens 5, 6, 8 e 13) ══════════
{
  ok(n + '. *** as SETE colunas do molde estao na lista, e nao so no detalhe ***',
    /<th class="num">Nº<\/th><th class="desc">Descrição do item<\/th>/.test(TELA)
    && /<th class="num">Qtd<\/th><th>Un<\/th>/.test(TELA)
    && /<th class="num">Referência<\/th>/.test(TELA)
    && /Teto CMED<\/th>/.test(TELA) && /Folga<\/th>/.test(TELA)); n++;
  ok(n + '. *** so os itens do estoque do cliente, por padrao (item 6) ***',
    /const meus = r\.itens\.filter\(x => x\.pares && x\.pares\.length\);/.test(TELA)); n++;
  ok(n + '. ...e ha o caminho para o resto ("Ver os N itens"), com o N do edital inteiro',
    /'Ver os ' \+ total \+ ' ' \+ \(total === 1 \? 'item' : 'itens'\) \+ ' →<\/button>'/.test(TELA)); n++;

  /* A FOLGA VEM DA MESMA CONTA DO DETALHE. Duas formulas de folga na mesma tela e como um item
     aparece com 25% na lista e 23% no detalhe — e a pessoa nao tem como saber qual acreditar. */
  ok(n + '. *** a folga usa o TETO como base, como a A27 declarou (nao a referencia do molde) ***',
    /const pct = \(t\.teto - uE\.valor\) \/ t\.teto \* 100;/.test(TELA)); n++;
  ok(n + '. ...e o teto vem do MESMO detTeto que o painel de detalhe usa (uma regua so)',
    /const t = detTeto\(it, uE\);/.test(TELA)
    && (TELA.match(/function detTeto\(/g) || []).length === 1); n++;

  // ── NUMERO HONESTO NA TABELA (item 7 do molde, aqui dentro) ──
  ok(n + '. *** os quatro "nao da pra dizer" sao DISTINTOS, e nenhum e um travessao mudo ***',
    /texto:'lendo a régua…'/.test(TELA) && /texto:'não sei'/.test(TELA)
    && /texto:'sem casamento'/.test(TELA) && /texto:'não informado'/.test(TELA)); n++;
  /* O PNCP devolve 0 quando o orgao nao publicou a quantidade — e "0" numa coluna de quantidade
     le-se como "nao vao comprar nada". */
  ok(n + '. *** quantidade zero DIZ "não informada", e nao imprime um zero ***',
    /Number\(it\.quantidade\) > 0[\s\S]{0,200}?não publicou a quantidade deste item">não informada/.test(TELA)); n++;
  ok(n + '. *** o valor dos itens so e somado se TODAS as linhas tiverem preco e quantidade ***',
    /temValor === meus\.length && somaMeus > 0/.test(TELA) && /valor não somável/.test(TELA)); n++;

  // ── O RODAPE CONTA A DIVIDA E SEPARA AS CAUSAS (item 8) ──
  ok(n + '. *** o rodape diz quantos ficaram sem teto E POR QUE, com as duas causas separadas ***',
    /sem preço de referência no edital/.test(TELA)
    && /sem casamento na tabela da CMED/.test(TELA)
    && /const semTeto = semRef \+ semCasa;/.test(TELA)); n++;
  /* Contar a divida sobre os 212 do edital faria o rodape falar de linhas que nao estao ali. */
  ok(n + '. ...e a divida e contada sobre OS QUE A TABELA MOSTRA, nao sobre o edital inteiro',
    /if\(f\.estado === 'sem-ref'\)   semRef\+\+;/.test(TELA)); n++;
  ok(n + '. leitura truncada e DITA no cabecalho (o "de N no edital" seria um total que nao e o total)',
    /r\.truncado \? ' <span class="im-nota" title="a leitura do edital bateu no teto de páginas/.test(TELA)); n++;

  // ── TABELA DENSA (item 13) ──
  ok(n + '. *** 40px compacta / 48px confortavel, por VARIAVEL — nao por segunda regra de tabela ***',
    /\.itens-meus\{--im-linha:48px;/.test(CSS)
    && /\.painel-res\.compacta \.itens-meus\{--im-linha:40px\}/.test(CSS)
    && /height:var\(--im-linha\)/.test(CSS)); n++;
  ok(n + '. cabecalho fixo, numero a direita com tabular-nums, fio de 1px e SEM zebra',
    /\.im-tab thead th\{position:sticky;top:0/.test(CSS)
    && /\.im-tab \.num,\.im-tab th\.num\{text-align:right;font-variant-numeric:tabular-nums/.test(CSS)
    && /\.im-tab th,\.im-tab td\{[^}]*border-bottom:1px solid var\(--linha\)/.test(CSS)
    && !/\.im-tab tbody tr:nth-child/.test(CSS)); n++;
  /* Sete colunas nao cabem num celular, e a saida honesta e a tabela rolar DENTRO da moldura —
     nunca a pagina inteira andar de lado (item 16). */
  ok(n + '. *** a 390px a tabela rola por dentro; a pagina nao anda de lado ***',
    /\.itens-meus\{overflow-x:auto\}/.test(CSS)); n++;

  // ── E ELE NAO PODE APARECER ONDE NAO HA LEITURA ──
  ok(n + '. *** sem cruzamento, sem bloco — o cartao continua dizendo "itens ainda não lidos" ***',
    /if\(!r \|\| !Array\.isArray\(r\.itens\) \|\| !r\.itens\.length\) return '';/.test(TELA)
    && /itens ainda não lidos/.test(TELA)); n++;
  ok(n + '. ...e ele entra sem repintar a lista (o "Cruzar todas" nao joga a pessoa pro topo)',
    /const caixa = document\.getElementById\('im-' \+ i\);[\s\S]{0,200}?caixa\.innerHTML = blocoItensMeus\(l, i\);/
      .test(TELA.replace(/\r/g, ''))); n++;
  /* Clicar na tabela nao pode abrir o painel de detalhe: o cartao inteiro e clicavel desde a A21,
     e quem esta lendo uma celula de teto nao pediu para trocar de tela. */
  ok(n + '. *** clicar dentro da tabela NAO abre o detalhe por tabela (o cartao inteiro e clicavel) ***',
    /<div class="itens-meus" onclick="event\.stopPropagation\(\)">/.test(TELA)); n++;
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
