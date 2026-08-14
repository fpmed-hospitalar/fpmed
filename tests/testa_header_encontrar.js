// SUITE testa_header_encontrar - o header sticky da Encontrar (passo 3 do molde).
//
// == O QUE ESTA SUITE GUARDA, E POR QUE CADA COISA ==============================
// O header do molde substituiu DUAS faixas (a `topfaixa` cinza e o cabecalho com o
// H1 solto). Numa troca dessas, o que se perde nao aparece: some uma linha de HTML
// e ninguem sente falta ate precisar dela. As tres coisas que a suite trava sao
// exatamente as tres que dariam pra perder em silencio:
//
//  1. A PORTA DE SAIDA. Ha ordem expressa do dono - "tela sem porta de saida e
//     beco" - e duas suites diferentes ja pegaram isso antes. O "← Sistema" virou
//     a RAIZ DA TRILHA; se alguem simplificar a trilha pras duas migalhas do molde,
//     a tela vira beco de novo.
//  2. O SELO DA BASE NUNCA AFIRMA SEM SABER. No molde ele e um selo verde FIXO
//     escrevendo "Base sincronizada". Fixo, ele so afirma - e este projeto ja viu a
//     coleta parar duas vezes sem ninguem notar. Aqui ele le o estado pelo MESMO
//     motor do sino e do e-mail, e "nao sei" tem cor propria.
//  3. O GANCHO DO PWA. O `data-limedtec-instalar` vivia na faixa que morreu. Sem
//     ele o app deixa de ser instalavel EM SILENCIO - nada quebra, ninguem repara.
//
//   node tests/testa_header_encontrar.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const L = R('fpmed_licitacoes.html');
const ALARME = require('../fpmed_alarme_coleta.js');
const uc = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/* ══ O ARQUIVO SEM COMENTARIO, e ele foi preciso NA PRIMEIRA RODADA (S10 outra vez) ═══════════
   Tres asserts ficaram vermelhos por instrumento, nao por defeito: eles procuravam "⌘K",
   "Buscar em todo o sistema" e "topfaixa" no arquivo inteiro - e as tres expressoes existem
   dentro dos COMENTARIOS que explicam por que elas NAO estao na tela. O comentario que registra
   a decisao acusava a decisao. O que se mede aqui e o que o navegador ve. */
const LIMPO = L.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_header_encontrar - o header sticky\n');

// ── 1. a faixa velha morreu, e o que ela carregava sobreviveu ────────────────
ok(n + '. a topfaixa cinza nao existe mais (nem no CSS, nem no HTML)',
  !/class="topfaixa"/.test(L) && !/^\.topfaixa\{/m.test(L)); n++;
ok(n + '. *** A PORTA DE SAIDA CONTINUA: a trilha leva ao sistema comercial ***',
  /<nav class="trilha"[\s\S]{0,400}?href="fpmed_sistema_final\.html"/.test(L)); n++;
ok(n + '. e a trilha diz onde se esta, ate o fim (Encontrar marcado como pagina atual)',
  /<nav class="trilha"[\s\S]{0,600}?aria-current="page"[^>]*>Encontrar</.test(L)); n++;
ok(n + '. o header e sticky - a lista e longa, e a resposta nao pode rolar pra fora com ela',
  /\.topo\{[^}]*position:sticky/.test(L.replace(/\s*\n\s*/g, ''))); n++;
/* O TELEFONE E O SLOGAN nao foram apagados: eles migraram pro rodape do menu, que esta em toda
   tela. Este assert existe pra que a migracao seja verdade, e nao a metade dela que eu lembrei. */
ok(n + '. o telefone e o slogan sairam do header porque vivem no rodape do MENU (nao foram perdidos)',
  !/topfaixa/.test(LIMPO.split('<body>')[1] || '')
  && /\(62\) 3290-4241/.test(R('limedtec-menu.js'))
  && /Compromisso com qualidade/.test(R('limedtec-menu.js'))); n++;
ok(n + '. *** O GANCHO DO PWA SOBREVIVEU A TROCA DE FAIXA ***',
  /data-limedtec-instalar/.test(L)); n++;
/* ...E ELE ESTA DENTRO DA REGUA. O limedtec-pwa.js pendura o botao como ultimo filho do elemento
   marcado; no `.topo` (que e largura total) ele caia FORA dos 1180px, encostado na borda da tela.
   Medido no navegador antes de mover: 235px contra os 315px de todo o resto. */
ok(n + '. e ele esta na faixa interna, pra o botao nascer dentro da mesma regua do conteudo',
  /<div class="faixa-int" data-limedtec-instalar>/.test(L)); n++;

// ── 2. o cabecalho da pagina ─────────────────────────────────────────────────
ok(n + '. o H1 e o subtitulo vivem no conteudo, e nao numa faixa de sistema',
  /<div class="pagina-topo">[\s\S]{0,400}?<h1>Encontrar<\/h1>/.test(L)); n++;
/* "Salvar busca" NAO e botao novo: e o `salvarJornal()` que ja existia, mudado de lugar. Ele
   morava DENTRO do painel "Meus Jornais", que nasce fechado - pra salvar a busca da tela era
   preciso abrir o painel das buscas ja salvas.
   >>> O ASSERT COBRA O PAR: existe no cabecalho E nao existe mais no painel. Cobrar so a metade
       de cima deixaria passar exatamente o defeito que se quis evitar - dois botoes pra mesma
       acao, que e como nascem dois comportamentos. */
ok(n + '. "Salvar busca" esta no cabecalho da pagina, ao lado da busca que ele salva (D7)',
  /class="btn sec acao"[^>]*onclick="salvarJornal\(\)"/.test(L)); n++;
ok(n + '. ...e NAO ficou uma segunda copia dele dentro do painel Meus Jornais',
  (L.match(/onclick="salvarJornal\(\)"/g) || []).length === 1,
  (L.match(/onclick="salvarJornal\(\)"/g) || []).length); n++;

// ── 3. o gatilho diz o que faz ───────────────────────────────────────────────
/* No molde este controle abre a PALETA DE COMANDOS e diz "Buscar em todo o sistema", com a tecla
   ⌘K em pilula. A paleta e Parte B - o dono mandou anotar, nao construir.
   >>> ENTAO O ROTULO DIZ O QUE ELE FAZ HOJE. Um controle escrito "todo o sistema" que busca so
       nesta tela nao e acabamento, e uma mentira com a roupa certa. Este assert e o que impede
       alguem de "aproximar mais do molde" copiando o texto sem a paleta atras dele. */
ok(n + '. o gatilho do header diz que busca NESTA TELA (a paleta ⌘K e Parte B, e nao existe)',
  /class="gatilho"[\s\S]{0,400}?Buscar nesta tela/.test(LIMPO)
  && !/Buscar em todo o sistema/.test(LIMPO)); n++;
ok(n + '. e ele nao anuncia uma tecla de atalho que nao existe',
  !/<kbd/.test(LIMPO) && !/⌘K/.test(LIMPO)); n++;
ok(n + '. o gatilho leva mesmo ao campo de busca da tela (nao e botao morto)',
  /function focarBusca\(\)\{[\s\S]{0,300}?getElementById\('f-kw'\)[\s\S]{0,200}?\.focus\(\)/.test(L)); n++;

// ── 4. O SELO DA BASE — o teste que vale mais que todos ──────────────────────
// Ele roda o MOTOR DE VERDADE (fpmed_alarme_coleta.js, o mesmo do sino e do e-mail)
// contra linhas de `coleta_status` fabricadas, e confere que cada estado do banco
// cai na classe visual certa. Nao e teste de string: e a regra sendo exercitada.
ok(n + '. a tela CARREGA o motor do alarme (uma regra so pro sino, o e-mail e o selo)',
  /<script src="fpmed_alarme_coleta\.js"><\/script>/.test(L)); n++;
ok(n + '. e le `ultima_tentativa` do banco - sem ela nao da pra distinguir "indice velho" de "agendador parado"',
  /coleta_status\?fonte=eq\.PNCP&select=[^`'"]*ultima_tentativa/.test(L)); n++;

/* A COPIA DA REGRA DO SELO. A funcao real vive dentro do HTML; aqui ela e reproduzida pelo mesmo
   motor, e o assert seguinte compara as duas listas de classe. Se um dia o `pintaSeloBase` ganhar
   um quinto estado sem que este teste saiba, o assert de cobertura reprova. */
const classeDe = v => !v ? 'ok' : (v.nivel === 'nao_sei' ? 'nao-sei' : (v.nivel === 'grave' ? 'grave' : 'atencao'));
const AGORA = new Date('2026-08-13T12:00:00Z');
const CASOS = [
  ['em dia',                {ultima_tentativa:'2026-08-13T09:00:00Z', ultimo_dia_ok:'2026-08-12'}, 'ok'],
  ['indice sem dia fechado',{ultima_tentativa:'2026-08-13T09:00:00Z', ultimo_dia_ok:null},         'atencao'],
  ['indice atrasado',       {ultima_tentativa:'2026-08-13T09:00:00Z', ultimo_dia_ok:'2026-08-06'}, 'grave'],
  ['agendador parado',      {ultima_tentativa:'2026-08-11T09:00:00Z', ultimo_dia_ok:'2026-08-12'}, 'grave'],
  ['leitura falhou',        null,                                                                   'nao-sei'],
];
for (const [nome, linha, esperado] of CASOS) {
  const deu = classeDe(ALARME.avaliar(linha, AGORA));
  ok(n + '. selo · ' + nome + ' -> ' + esperado, deu === esperado, { deu, esperado }); n++;
}
/* ══ O ASSERT QUE E A RAZAO DE ESTE BLOCO EXISTIR ═══════════════════════════════
   O molde pinta o selo de VERDE FIXO. Verde fixo nao informa: ele afirma. Este
   assert prova o contrario pelo avesso - existe pelo menos um estado do banco em
   que o selo NAO fica verde, e ele e o estado que ja aconteceu duas vezes nesta
   casa (a coleta parada). Se alguem "simplificar" o selo de volta pro do molde,
   este e o vermelho que aparece. */
ok(n + '. *** o selo NAO e um verde fixo: com a coleta parada ele fica grave ***',
  classeDe(ALARME.avaliar({ultima_tentativa:'2026-08-11T09:00:00Z', ultimo_dia_ok:'2026-08-12'}, AGORA)) === 'grave'
  && classeDe(ALARME.avaliar({ultima_tentativa:'2026-08-13T09:00:00Z', ultimo_dia_ok:'2026-08-12'}, AGORA)) === 'ok'); n++;
ok(n + '. "nao sei" tem cor PROPRIA - falhar ao ler nao e "tudo bem" nem "tudo mal"',
  /\.selo-base\.nao-sei\{/.test(L)
  && /sinal-neutro-fundo/.test((L.match(/\.selo-base\.nao-sei\{[^}]*\}/) || [''])[0])); n++;
/* ══ ESTE ASSERT NASCEU DE UMA MUTACAO QUE PASSOU VERDE ════════════════════════
   Eu troquei, no HTML, a chamada do motor por `const v = null;` — que faz TODOS os
   estados virarem verde, ou seja, o selo fixo do molde de volta — e a suite ficou
   verde. Porque os cinco asserts acima exercitam o MOTOR, e o motor continuava
   certo: o que a mutacao cortou foi o FIO entre a tela e ele.
   >>> Provar o motor nao prova que a tela o usa. Este assert e o fio. */
ok(n + '. e a TELA usa o motor de verdade (nao um veredito proprio, nem um verde chumbado)',
  /const v = window\.AlarmeColeta\.avaliar\(carimbo, new Date\(\)\);/.test(LIMPO)); n++;
ok(n + '. sem o motor carregado o selo SOME, em vez de inventar um verde',
  /function pintaSeloBase\(carimbo, motorAusente\)\{[\s\S]{0,200}?if\(motorAusente\)\{ el\.hidden = true;/.test(L)); n++;
ok(n + '. o selo nasce escondido (ele nao afirma antes de ler)',
  /<div class="selo-base" id="selo-base" hidden>/.test(L)); n++;
ok(n + '. e ele se repinta a cada busca, e nao so no boot',
  /const carimbo = await carimboColeta\(\);[\s\S]{0,400}?pintaSeloBase\(carimbo,/.test(L)); n++;
/* O selo e lido com o JWT (`coleta_status` tem RLS). Chamado antes da sessao ele responderia 401
   e o selo diria "nao sei" POR ENGANO - e um "nao sei" falso e tao ruim quanto um "tudo bem"
   falso: os dois destroem a confianca no aviso. */
ok(n + '. o selo so e lido DEPOIS da sessao (antes dela, 401 viraria um "nao sei" falso)',
  /iniciarSeloBase\(\);/.test((L.match(/function _aoAutenticar\(\)\{[^}]*\}/) || [''])[0])); n++;

// ── 4b. OS QUATRO INDICADORES (passo 4 do molde) ─────────────────────────────
// A fila de indicadores e do mesmo topo de pagina que o header, e por isso mora nesta
// suite. O que ela guarda aqui e UMA coisa acima de todas: que os numeros sejam do
// BANCO. Os quatro do molde sao ficticios e estao escritos no README dele; um deles
// vazando pra tela e a licao S6 em cima de um numero que o dono usa pra decidir.
const FICTICIOS = ['945.699', '945699', '9.050', '9050', '2.312', '2312'];
ok(n + '. *** nenhum numero de demonstracao do molde esta escrito na tela ***',
  FICTICIOS.every(x => !LIMPO.includes(x)), FICTICIOS.filter(x => LIMPO.includes(x))); n++;
ok(n + '. os quatro indicadores nascem com traco, e nao com numero',
  (LIMPO.match(/<b class="num" id="ind-[a-z]+">—<\/b>/g) || []).length === 4,
  (LIMPO.match(/<b class="num" id="ind-[a-z]+">[^<]*<\/b>/g) || [])); n++;
/* ══ O ROTULO DO PRIMEIRO CARTAO — e ele NAO e o do molde ══════════════════════
   O molde escreve "Na plataforma" embaixo de 945.699. O nosso indice tem ~3 mil e
   cobre 7 UFs desde 06/08. "Na plataforma" ao lado de 3 mil faria alguem concluir
   que ha 3 mil licitacoes no Brasil - e essa e a MESMA armadilha que o Radar ja
   carrega por escrito ("a contagem e do NOSSO indice; 0 pode significar 'ainda nao
   coletamos', nao 'nao tem'"). O rotulo e a legenda dizem de quem e o numero. */
ok(n + '. o 1o cartao diz que a contagem e do NOSSO indice, e nao da plataforma',
  /Licitações no índice/.test(LIMPO) && !/Na plataforma/.test(LIMPO)
  && /não é o Brasil inteiro/.test(LIMPO)); n++;

/* AS QUATRO LEITURAS SAO INDEPENDENTES. A do funil le `negocios`, que e tabela de
   GESTOR: um vendedor recebe 403 ali e 200 nas outras tres. Com uma leitura so, o
   403 de uma derrubaria as quatro, e a tela ficaria muda sobre o indice por causa de
   uma permissao que nao tem nada a ver com ele. */
const _corpoInd = (LIMPO.match(/async function pintaIndicadores\(\)\{[\s\S]*?\n\}/) || [''])[0];
ok(n + '. as quatro contagens sao leituras independentes (um 403 no funil nao derruba as outras tres)',
  /pedidos\.map\(async \(\[id, caminho\]\) => \{[\s\S]{0,200}?try \{[\s\S]{0,200}?catch\(e\)\{/.test(_corpoInd)); n++;
/* ══ O ASSERT QUE VALE MAIS DESTE BLOCO ═══════════════════════════════════════
   Leitura que falha vira TRACO, nunca zero. "0 licitacoes no indice" e "nao consegui
   contar" sao afirmacoes diferentes, e a primeira faz alguem concluir que o sistema
   esta vazio. Licao S6, e ela ja custou um fechamento mensal errado nesta casa. */
ok(n + '. *** o que falha vira TRACO, nunca zero (S6) ***',
  /function poeIndicador\(id, valor, porque\)\{[\s\S]{0,400}?typeof valor === 'number' && isFinite\(valor\)/.test(LIMPO)
  && /el\.textContent = '—';/.test(LIMPO)); n++;
ok(n + '. e o traco diz POR QUE, no title - traco misterioso e pior que numero errado',
  /catch\(e\)\{ conta\[id\] = null; poeIndicador\(id, null, 'não consegui contar: ' \+ e\.message\); \}/.test(LIMPO)); n++;
/* A contagem sai do `content-range` do PostgREST. Se ele vier sem o total (o PostgREST
   manda `*` quando nao conta), NAO da pra inventar 0: a leitura respondeu, mas nao com
   o numero. E o mesmo defeito da S1 - o servidor respondendo outra coisa, calado. */
ok(n + '. a contagem vem do content-range, e sem total ela FALHA em vez de virar zero',
  /const cr = r\.headers\.get\('content-range'\)/.test(LIMPO)
  && /if\(!isFinite\(n\)\) throw new Error\('a resposta veio sem a contagem'\);/.test(LIMPO)); n++;
ok(n + '. e ela nao baixa as linhas pra contar (select=id&limit=1 com Prefer: count=exact)',
  /'select=id&limit=1'[\s\S]{0,120}?'Prefer': 'count=exact'/.test(LIMPO)); n++;
/* "Abrem hoje" e o DIA LOCAL de quem olha, nao o dia UTC: uma sessao das 8h de amanha
   em Goias ja e "amanha" as 21h de hoje em UTC, e o cartao diria o numero errado
   justamente a noite - quando alguem confere a agenda do dia seguinte. */
ok(n + '. "abrem hoje" usa o dia LOCAL, e nao o dia UTC',
  /new Date\(agora\.getFullYear\(\), agora\.getMonth\(\), agora\.getDate\(\), 0, 0, 0\)/.test(LIMPO)
  && /new Date\(agora\.getFullYear\(\), agora\.getMonth\(\), agora\.getDate\(\), 23, 59, 59\)/.test(LIMPO)); n++;
/* OS CONTADORES DO MENU SAEM DA MESMA LEITURA. Duas leituras pro mesmo numero (uma pro
   cartao, outra pro menu) e como nascem dois numeros que um dia discordam na mesma tela. */
ok(n + '. os contadores do menu saem da MESMA leitura dos cartoes (nao de uma segunda consulta)',
  /LimedtecMenu\.contador\('buscar',\s+conta\['ind-novas'\], true\)/.test(_corpoInd)
  && /LimedtecMenu\.contador\('negocios', conta\['ind-funil'\]\)/.test(_corpoInd)); n++;
ok(n + '. e so os dois que tem numero de verdade acendem (Radar e Desertas ficam vazios)',
  !/contador\('radar'/.test(LIMPO) && !/contador\('desertas'/.test(LIMPO)); n++;
ok(n + '. os indicadores so sao lidos DEPOIS da sessao (antes dela, 401 em tudo)',
  /pintaIndicadores\(\);/.test((L.match(/function _aoAutenticar\(\)\{[^}]*\}/) || [''])[0])); n++;

// ── 4c. O POLIMENTO FINAL (item 7c) ──────────────────────────────────────────
/* ══ OS SEIS ATALHOS FICARAM, E ISSO CONTRARIA A PRIMEIRA LEITURA DO PEDIDO ═══
   O pedido mandava tirar os que so REPETEM destino do menu (Radar, Desertas, Meus
   Jornais). Fui conferir antes de apagar: **nenhum dos seis e link**. Os seis
   chamam funcao NESTA tela, e o que o menu lateral tem sao ANCORAS que voltam pra
   ca e disparam exatamente estas mesmas funcoes. Removê-los nao tiraria navegacao
   duplicada: tiraria a ACAO, e o item do menu passaria a levar a um lugar onde nao
   ha mais o que ele promete.
   >>> O proprio pedido previa isto ("se dispara uma ACAO nesta tela, NAO remova —
       so arrume o estilo"), e este assert e o que impede a leitura apressada de
       voltar numa proxima passagem. */
/* ERAM SEIS, VIRARAM CINCO EM 14/08: o "Radar" saiu por decisao do dono (fatia A1), e o atalho
   dele saiu junto com a tela no MESMO commit. Isso nao contradiz o assert — CONFIRMA o que ele
   guarda: o atalho existe enquanto existir a acao que ele dispara. Some a acao, some o atalho.
   O que continua proibido e o inverso: apagar o atalho DEIXANDO a acao, que e o que
   transformaria o item do menu em promessa sem destino. */
for (const fn of ['abrirOrgaos', 'soDesertas', 'abrirJornais', 'porNumero']) {
  ok(n + '. o atalho "' + fn + '" continua na tela — ele dispara ACAO aqui, nao e link repetido',
    new RegExp('<a onclick="' + fn + '\\(\\)').test(LIMPO)
    && new RegExp('function ' + fn + '\\(').test(LIMPO)); n++;
}
ok(n + '. e eles deixaram de ser link azul solto (viraram controle com contorno)',
  /\.links a\{[^}]*border:1px solid var\(--borda-controle\)/.test(L.replace(/\s*\n\s*/g, ''))
  && !/\.links a\{[^}]*color:var\(--azul-700\)/.test(L.replace(/\s*\n\s*/g, ''))); n++;
/* O "+ Incluir licitacao" e o UNICO dos seis que sai da tela (leva ao Negocios com o formulario
   aberto). Por isso e o unico separado por divisoria: acao que troca de tela nao pode ter o
   mesmo peso de acao que abre um painel aqui. */
ok(n + '. o "+ Incluir licitacao" — o unico que SAI da tela — fica do outro lado da divisoria',
  /<span class="sai"><a onclick="incluirLicitacaoManual\(\)"/.test(LIMPO)
  && /\.links \.sai::before\{content:""/.test(L.replace(/\s*\n\s*/g, ''))); n++;

/* O PERIODO E AS DATAS: continuam os `<select>` e `<input type=date>` NATIVOS — um calendario
   proprio significaria reimplementar teclado, leitor de tela, fuso e o calendario do celular, e
   o nativo faz os quatro. O molde pede acabamento, nao calendario proprio.
   >>> O QUE O ASSERT GUARDA e o que estava torto: as tres alturas eram diferentes entre si
       (select e input date nao medem igual), e era isso que fazia a fileira parecer montada as
       pressas. Uma altura so, declarada. */
ok(n + '. as datas continuam nativas (o molde pede acabamento, nao calendario proprio)',
  /<input type="date" id="f-de">/.test(LIMPO) && /<input type="date" id="f-ate">/.test(LIMPO)); n++;
ok(n + '. e os tres controles do periodo tem UMA altura so',
  /\.periodo select,\.periodo input\[type=date\]\{min-height:34px/.test(L.replace(/\s*\n\s*/g, ''))
  && /\.intervalo\{[^}]*min-height:34px/.test(L.replace(/\s*\n\s*/g, ''))); n++;
/* O INTERVALO e UMA peca: as duas datas dentro da mesma moldura. Dois campos soltos com um traco
   no meio leem como dois filtros independentes, e a pessoa preenche um e esquece o outro. */
ok(n + '. o intervalo e UMA moldura com as duas datas dentro (nao dois campos soltos)',
  /\.intervalo\{[^}]*border:1px solid var\(--borda-controle\)/.test(L.replace(/\s*\n\s*/g, ''))
  && /\.intervalo input\[type=date\]\{border:0/.test(L.replace(/\s*\n\s*/g, ''))); n++;
ok(n + '. e o foco vive na MOLDURA, nao no campo escondido dentro dela',
  /\.intervalo:focus-within\{[^}]*var\(--foco\)/.test(L.replace(/\s*\n\s*/g, ''))); n++;

// ── 5. a reserva da etiqueta do gm-auth ──────────────────────────────────────
/* A etiqueta fixa do gm-auth (e-mail + trocar senha + sair) tem z-index maximo e cobria o gatilho
   e o selo. Achado no PRINT, nao na suite - e por isso ele virou assert.
   >>> A LARGURA E MEDIDA, nao chutada: ela muda com o tamanho do e-mail de quem entrou. Um valor
       fixo em px estaria certo pro endereco de hoje e errado pro proximo, e erraria em silencio. */
ok(n + '. a reserva da etiqueta do gm-auth e MEDIDA da etiqueta, e nao um numero chutado',
  /function reservaAuth\(\)\{[\s\S]{0,400}?getElementById\('gm-auth-bar'\)[\s\S]{0,300}?getBoundingClientRect\(\)\.width/.test(L)); n++;
ok(n + '. sem etiqueta (deslogado, impressao) a reserva e zero - o header usa a largura toda',
  /reservaAuth[\s\S]{0,500}?l \? \(l \+ 12\) \+ 'px' : '0px'/.test(L)); n++;
/* ══ E ESTE ASSERT NASCEU DE UM DEFEITO QUE EU MESMO CRIEI ══════════════════════
   A reserva, aplicada em TODA largura, comia a faixa inteira em 390px: 309px de
   reserva num strip de 390 deixa 33px, e a TRILHA ENCOLHIA PARA ZERO. Ou seja: a
   porta de saida desaparecia no celular - o "beco" que a ordem do dono proibe,
   criado por um conserto de outra coisa. So descobri medindo as 3 larguras. */
/* O assert aceita QUALQUER corte a partir de 901px, e nao o numero exato: 901 e o ponto onde o
   menu vira faixa horizontal, e se um dia esse ponto mudar os dois mudam juntos. O que ele
   proibe e a reserva valer em largura de celular. */
const _mediaDaReserva = (LIMPO.match(/@media\(min-width:(\d+)px\)\{[\s\S]{0,300}?padding-right:calc\(var\(--esp-6\) \+ var\(--reserva-auth/) || []);
ok(n + '. *** a reserva so vale no desktop: em 390px ela comia a trilha inteira ***',
  !!_mediaDaReserva[1] && Number(_mediaDaReserva[1]) >= 901
  // e ela nao pode existir TAMBEM solta fora da media query
  && (LIMPO.match(/padding-right:calc\(var\(--esp-6\) \+ var\(--reserva-auth/g) || []).length === 1,
  _mediaDaReserva[1]); n++;

// ── 6. a borda que a sombra do molde deixou de desenhar ──────────────────────
/* Consequencia do passo 1: a sombra saiu de 16px macios pra 2px a 4%. As duas superficies que
   confiavam nela pra desenhar a propria fronteira (`.cartao-busca` e `.lic`) ficaram sem borda
   NENHUMA sobre um fundo a 3,7 pontos do branco. Medido no navegador: border-top-width 0px. */
{
  const regra = (L.match(/\.cartao-busca\{[^}]*\}/) || [''])[0].replace(/\s*\n\s*/g, '');
  ok(n + '. .cartao-busca tem borda: com a sombra do molde (2px a 4%) ela e a unica fronteira',
    /border:1px solid var\(--cinza-200\)/.test(regra), regra.slice(0, 140)); n++;
}
/* ══ O .lic MUDOU DE NATUREZA NO PASSO 6, e este assert mudou com ele ═══════════════════════
   Ele cobrava `border:1px solid` no `.lic`, que na epoca era um CARTAO solto. No passo 6 os
   resultados viraram LINHAS dentro de um painel: a fronteira deixou de ser de cada um e passou
   a ser do painel, com um fio entre as linhas.
   >>> A PROMESSA E A MESMA — a superficie tem fronteira desenhada — e por isso o assert nao foi
       apagado: ele passou a cobrar o par certo (o painel tem borda, e a linha tem o divisor).
       Apagar seria perder o guarda; manter o texto antigo seria cobrar um cartao que nao existe
       mais. */
{
  const painel = (L.match(/\.painel-res\{[^}]*\}/) || [''])[0].replace(/\s*\n\s*/g, '');
  const linha  = (L.match(/\n\.lic\{[^}]*\}/) || [''])[0].replace(/\s*\n\s*/g, '');
  ok(n + '. o painel de resultados tem a fronteira, e a linha tem o divisor (nao os dois, nem nenhum)',
    /border:1px solid var\(--cinza-200\)/.test(painel)
    && /border-bottom:1px solid var\(--borda-divisor\)/.test(linha)
    && !/\bborder:1px/.test(linha),
    { painel: painel.slice(0, 120), linha: linha.slice(0, 120) }); n++;
  ok(n + '. e a ultima linha nao desenha o fio (senao ele encosta na borda do painel)',
    /\.lic:last-child\{border-bottom:0\}/.test(L.replace(/\s*\n\s*/g, ''))); n++;
}

// ── 7. a memoria do porque (L6) ──────────────────────────────────────────────
ok(n + '. o arquivo registra por que o "← Sistema" virou a raiz da trilha',
  /raiz da trilha/i.test(uc(L)) && /porta de sa[ií]da/i.test(uc(L))); n++;
ok(n + '. e registra por que o selo do molde virou instrumento em vez de enfeite',
  /enfeite do molde virou instrumento/i.test(uc(L))); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
