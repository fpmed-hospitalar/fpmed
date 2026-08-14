// SUITE testa_painel_resultados - o painel de resultados da Encontrar (passo 6 do molde).
//
// == O QUE MUDOU, E POR QUE PRECISA DE GUARDA ==================================
// Os resultados eram uma PILHA DE CARTOES soltos; viraram LINHAS dentro de UM
// painel, com cabecalho e rodape. Numa troca de moldura como essa, tres coisas
// podem sumir sem ninguem notar - e as tres sao as que esta suite trava:
//
//  1. O CABECALHO PODE PASSAR A MENTIR. Ele diz "N de M publicadas no periodo" e
//     "N abrem hoje". Se o "de M" cair, "12" sozinho deixa de dizer se o filtro
//     cortou 3 ou 300 - e essa e a informacao que evita a conclusao errada de que
//     "nao tem nada publicado".
//  2. O RODAPE PODE FINGIR PAGINACAO. O molde escreve "Mostrando 1-20 de 2.312".
//     Aqui NAO HA paginacao: a lista inteira esta na tela. Copiar aquela frase
//     seria prometer uma pagina 2 que nao existe, e quem a procurasse concluiria
//     que o sistema perdeu resultado.
//  3. A DENSIDADE PODE DERRUBAR A LISTA. Ela mora no localStorage, que estoura em
//     navegacao privada em alguns navegadores. Uma PREFERENCIA DE LAYOUT nao pode
//     levar junto o resultado da busca.
//
//   node tests/testa_painel_resultados.js
'use strict';
const fs = require('fs'), path = require('path');
const L = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const LIMPO = L.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const CSS1 = L.replace(/\s*\n\s*/g, '');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_painel_resultados - o painel (passo 6 do molde)\n');

// ── 1. o painel existe e envolve as linhas ───────────────────────────────────
ok(n + '. o painel de resultados existe, com cabecalho e rodape',
  /\.painel-res\{/.test(CSS1) && /\.painel-res \.cabecalho\{/.test(CSS1)
  && /\.painel-res \.rodape-painel\{/.test(CSS1)); n++;
ok(n + '. as linhas ficam DENTRO dele (o painel abre antes do laco e fecha depois)',
  /class="painel-res[\s\S]{0,2000}?hits\.forEach/.test(LIMPO)
  && /rodape-painel[\s\S]{0,400}?<\/div>'\s*\+?\s*\n?\s*\+\s*'<\/div>'/.test(LIMPO)
  || /rodape-painel[\s\S]{0,300}?'\s*\+\s*'<\/div>'/.test(LIMPO)); n++;
/* Cabecalho e rodape sao MOLDURA, nao conteudo — e o degrau da superficie sutil e o que diz isso
   sem gastar mais uma borda. Se um dia os dois virarem branco, o painel fica sem articulacao. */
ok(n + '. cabecalho e rodape usam a superficie sutil (eles sao moldura, nao conteudo)',
  /\.painel-res \.cabecalho\{[^}]*background:var\(--superficie-sutil\)/.test(CSS1)
  && /\.painel-res \.rodape-painel\{[^}]*background:var\(--superficie-sutil\)/.test(CSS1)); n++;
/* A linha NAO levanta no hover: linha que sobe dentro de um painel arrasta a de baixo e a lista
   inteira treme. Foi por isso que o `transform` saiu junto com o cartao. */
ok(n + '. o hover da linha e de FUNDO, e nao um levantar (linha que sobe faz a lista tremer)',
  /\.lic:hover\{background:var\(--linha-hover\)\}/.test(CSS1)
  && !/\.lic:hover\{[^}]*transform/.test(CSS1)); n++;

// ── 2. o cabecalho nao pode mentir ───────────────────────────────────────────
ok(n + '. *** o cabecalho diz N DE M — "12" sozinho nao diz se o filtro cortou 3 ou 300 ***',
  /<b>'\+hits\.length\+'<\/b> de <b>'\+todos\.length\+'<\/b>/.test(LIMPO)); n++;
/* "abrem hoje" so aparece QUANDO EXISTE. "0 abrem hoje" e ruido em todo dia sem abertura, e
   ruido diario e como se ensina alguem a nao ler o cabecalho. */
ok(n + '. "abrem hoje" so aparece quando ha (0 todo dia ensina a ignorar o cabecalho)',
  /abremHoje \? ' · <b>'\+abremHoje/.test(LIMPO)); n++;
/* E a contagem de "abrem hoje" e do DIA LOCAL, pelo mesmo motivo do indicador do topo: uma
   sessao das 8h de amanha ja e "amanha" as 21h de hoje em UTC. */
ok(n + '. e ela usa o dia LOCAL, como o indicador do topo',
  /_hoje0 = new Date\(agora\.getFullYear\(\), agora\.getMonth\(\), agora\.getDate\(\)\)/.test(LIMPO)); n++;
/* ══ ESTE ASSERT MUDOU DE LADO EM 14/08 (fatia A3), E A DECISAO ANTERIOR ESTAVA CERTA ═════════
   Ele cobrava que o seletor NAO existisse, e o motivo escrito era bom: "das tres opcoes do
   molde, a aderencia e Parte B (precisa de backend) e a de valor seria funcao nova — e seletor
   com uma opcao so e um controle que ensina a pessoa a clicar a toa".
   >>> O QUE MUDOU NAO FOI A OPINIAO, FOI O DADO. A aderencia virou numero real na fatia A3, sem
       backend nenhum: o cruzamento ja guardava casados E total, e ninguem tinha dividido um
       pelo outro. Com as tres opcoes existindo de verdade, o controle deixou de ser enfeite.
   >>> E O QUE ELE PROTEGIA CONTINUA COBRADO, agora do lado certo: as tres opcoes tem que
       EXISTIR (nao basta desenhar o seletor) e a ordem PADRAO tem que continuar sendo a
       abertura — ordenar por valor por padrao poria o contrato grande e distante na frente da
       sessao que comeca em duas horas. */
ok(n + '. *** o seletor de ordenacao entrou, e as TRES opcoes existem de verdade ***',
  /id="sel-ordem"/.test(LIMPO) && /Abertura mais próxima/.test(LIMPO)
  && /Maior valor estimado/.test(LIMPO) && /Maior aderência/.test(LIMPO)
  && /function ordenaHits/.test(LIMPO)); n++;
ok(n + '. ...e a ordem PADRAO continua sendo a abertura (a pergunta que abre o dia do gestor)',
  /let ORDEM = 'abertura'/.test(LIMPO)); n++;
ok(n + '. *** e quem nao tem o criterio vai pro FIM, nunca pro topo (zero fingindo de dado) ***',
  /Number\(b\.valorTotalEstimado\)\|\|-1/.test(LIMPO)
  && /aderenciaPct\(b\) == null \? -1/.test(LIMPO)
  && /semData = 8640000000000/.test(LIMPO)); n++;

// ── 3. o rodape nao pode fingir paginacao ────────────────────────────────────
ok(n + '. *** o rodape diz que a lista NAO pagina, em vez de copiar "1-20 de 2.312" ***',
  /esta lista não pagina/.test(LIMPO)
  && !/Mostrando 1[–-]/.test(LIMPO)); n++;
ok(n + '. e ele diz quantas estao na tela (o rodape tambem FECHA o painel)',
  /Mostrando <b>'\+hits\.length\+'<\/b>/.test(LIMPO)); n++;

// ── 4. a densidade ───────────────────────────────────────────────────────────
// Aqui a suite EXECUTA as duas funcoes contra um localStorage e um DOM de mentira,
// em vez de procurar texto: o que importa e o que elas FAZEM.
const bloco = (ini, fim) => { const s = L.indexOf(ini), e = L.indexOf(fim, s); return L.slice(s, e); };
function carrega(storage) {
  const classes = new Set();
  const painel = { classList: { toggle: (c, v) => { v ? classes.add(c) : classes.delete(c); } } };
  const botoes = [
    { textContent: 'Confortável', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } },
    { textContent: 'Compacta',    attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } },
  ];
  const doc = { getElementById: id => (id === 'painel-res' ? painel : null),
                querySelectorAll: () => botoes };
  const fn = new Function('localStorage', 'document',
    bloco('function densidade(){', '\n// ══ UI DO CRUZAMENTO')
    + '\nreturn { densidade, poeDensidade };');
  return { api: fn(storage, doc), classes, botoes };
}
const memoria = (() => { const m = {}; return {
  getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; })();
{
  const { api, classes, botoes } = carrega(memoria);
  ok(n + '. o padrao e Confortavel (sem escolha guardada)', api.densidade() === 'confortavel'); n++;
  api.poeDensidade('compacta');
  ok(n + '. escolher Compacta guarda a preferencia E marca o painel',
    api.densidade() === 'compacta' && classes.has('compacta'),
    { guardado: api.densidade(), classes: [...classes] }); n++;
  ok(n + '. e o botao ativo fica marcado pra quem le em voz alta (aria-pressed)',
    botoes[1].attrs['aria-pressed'] === 'true' && botoes[0].attrs['aria-pressed'] === 'false',
    botoes.map(b => b.textContent + '=' + b.attrs['aria-pressed'])); n++;
  api.poeDensidade('confortavel');
  ok(n + '. voltar pra Confortavel tira a marca do painel',
    api.densidade() === 'confortavel' && !classes.has('compacta')); n++;
  /* ══ ESTE ASSERT PASSOU VERDE NUMA MUTACAO, e o conserto e o que ele ensina ═══
     Ele fazia `poeDensidade('gigante')` e conferia o resultado — mas quem normaliza
     ali e o ESCRITOR, entao ele nunca tocava no LEITOR. Com o leitor devolvendo o
     valor cru (a mutacao), a suite continuava verde.
     >>> A defesa de verdade tem que valer nos DOIS lados, porque o valor guardado
         nao vem so daqui: ele sobrevive a versoes da tela, e um 'gigante' escrito
         por uma versao antiga tem que cair no padrao ao ser LIDO hoje. Entao o
         assert passou a sujar o armazenamento DIRETO e conferir a leitura. */
  memoria.setItem('fpmed_densidade', 'gigante');
  ok(n + '. valor estranho GUARDADO nao vira um terceiro modo — a LEITURA cai no confortavel',
    api.densidade() === 'confortavel', api.densidade()); n++;
  ok(n + '. ...e o escritor tambem normaliza (a defesa vale nos dois lados)',
    (api.poeDensidade('gigante'), memoria.getItem('fpmed_densidade')) === 'confortavel',
    memoria.getItem('fpmed_densidade')); n++;
}
/* ══ O ASSERT QUE VALE MAIS DESTE BLOCO ═══════════════════════════════════════
   O localStorage ESTOURA em navegacao privada em alguns navegadores. Uma
   PREFERENCIA DE LAYOUT nao pode levar junto o resultado da busca — e sem o
   try/catch e exatamente isso que acontece: a `render` inteira morre no meio,
   porque a `densidade()` e chamada montando o cabecalho do painel. */
{
  const explode = { getItem: () => { throw new Error('sem localStorage'); },
                    setItem: () => { throw new Error('sem localStorage'); } };
  const { api } = carrega(explode);
  let caiu = false;
  try { api.densidade(); api.poeDensidade('compacta'); } catch (e) { caiu = true; }
  ok(n + '. *** localStorage indisponivel NAO derruba a lista: cai no padrao e segue ***',
    !caiu && api.densidade() === 'confortavel', { estourou: caiu }); n++;
}
/* Trocar a densidade NAO repinta a lista: repintar perderia os itens ja cruzados (o bloco que a
   pessoa abriu) e faria a tela piscar por causa de um respiro. */
ok(n + '. trocar a densidade nao repinta a lista (so troca a classe do painel)',
  /function poeDensidade\(d\)\{[\s\S]{0,600}?classList\.toggle\('compacta'/.test(LIMPO)
  && !/function poeDensidade\(d\)\{[\s\S]{0,600}?rerender\(\)/.test(LIMPO)); n++;
/* A compacta RECOLHE O OBJETO, e nao so o padding: num modo de varredura o que ocupa altura e o
   texto do objeto. So o padding renderia 6px por linha, o que nao e modo nenhum. */
ok(n + '. a compacta recolhe o objeto de 3 linhas pra 1, e nao so o respiro',
  /\.painel-res\.compacta \.lic \.obj\{-webkit-line-clamp:1/.test(CSS1)); n++;

/* ── 6. A NOTA DE ADERENCIA TEM TRES FAIXAS (bater-o-olho com o molde, fatia A11) ────────────
   O molde manda a barra em TRES cores (#4E9A06 >=80 · #2CA9E0 >=65 · #94A3B8 abaixo) e a tela
   pintava TUDO de verde.
   >>> E ISSO NAO ERA FEIURA, ERA UMA AFIRMACAO ERRADA. Verde e o sinal de "bom" deste sistema
       inteiro; em 22% de aderencia ele dizia "otimo" sobre um edital que quase nao tem nada
       nosso — na linha em que se decide montar proposta. O rotulo dizia 22% e a cor dizia
       vai fundo, e quando os dois discordam quem ganha e a cor. */
ok(n + '. *** a aderencia tem TRES faixas, e nao uma cor so ***',
  /function faixaAderencia\(pct\)\{ return pct >= 80 \? 'alta' : pct >= 65 \? 'media' : 'baixa'; \}/.test(LIMPO)); n++;
ok(n + '. ...e a faixa e aplicada na linha (a classe sai junto do desenho)',
  /class="aderencia '\+faixaAderencia\(pct\)\+'"/.test(LIMPO)); n++;
ok(n + '. ...com cor propria pra barra E pro numero em cada faixa',
  /\.aderencia\.media \.barra i\{background:var\(--azul-600\)\}/.test(CSS1)
  && /\.aderencia\.media \.pct\{color:var\(--sinal-info-tinta\)\}/.test(CSS1)
  && /\.aderencia\.baixa \.barra i\{background:var\(--cinza-500\)\}/.test(CSS1)
  && /\.aderencia\.baixa \.pct\{color:var\(--cinza-600\)\}/.test(CSS1)); n++;
/* O trilho do molde e o tom de DIVISOR, e a tela usava o de BORDA DE CARTAO — um tom acima.
   E a altura na linha e 4px (os 5px sao do bloco do drawer, que e outra peca). */
ok(n + '. o trilho e a altura da barra vieram do molde (divisor, 4px)',
  /\.aderencia \.barra\{width:52px;height:4px;border-radius:var\(--raio-pilula\);background:var\(--borda-divisor\)/.test(CSS1)); n++;
/* AS DUAS CORES CLARAS DO MOLDE REPROVARAM na medicao contra o trilho (minimo 3:1 de componente
   grafico): #2CA9E0 = 2,36:1 e #94A3B8 = 2,56:1. Desceram um degrau na nossa rampa, que e a
   mesma fuga ja paga no botao primario. O assert cobra que a medicao esteja ESCRITA — regra de
   AA sem o numero ao lado e a que alguem afrouxa primeiro. */
ok(n + '. *** e a fuga de AA esta medida e escrita, com os numeros ***',
  /#2CA9E0 = 2,36:1 REPROVA/.test(L) && /#94A3B8 = 2,56:1 REPROVA/.test(L)
  && /#4E9A06 = 3,12:1 passa/.test(L)); n++;
/* Zero hex a mao continua valendo: o molde manda pelo TOKEN, e cor escrita na regra e a que
   envelhece sozinha quando o tema muda. */
ok(n + '. nenhuma das faixas escreve hex a mao (so token do tema)',
  !/\.aderencia\.(media|baixa) [^\n]*#[0-9A-Fa-f]{6}/.test(L)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
