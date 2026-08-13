// SUITE testa_pesquisa_avancada — O REFINO NAO PODE MENTIR SOBRE O QUE SUMIU DA TELA.
//
// Item 9, 4o pedaco: pesquisa avancada completa + Orgaos + Desertas. Extrai as funcoes REAIS do
// fpmed_licitacoes.html (nao recopia).
//
// O QUE ESTA SUITE PROTEGE, e o motivo de cada coisa:
//   1. FILTRO QUE CORTA EM SILENCIO e o pior defeito possivel aqui. Quem le "3 licitacoes hoje"
//      quando na verdade sao "3 que passaram no refino ligado ontem" toma decisao com a tela
//      errada. Por isso todo criterio ativo vira PILL, e a suite exige isso.
//   2. LICITACAO SEM VALOR ESTIMADO NAO PODE SUMIR na faixa de valor -- dispensa costuma vir sem
//      estimado, e e exatamente a oportunidade pequena que a FPMED disputa.
//   3. "DESERTA" SO COM DADO DECLARADO. A tentacao e inferir deserta de "encerrou e nao tem
//      valorTotalHomologado" -- mas homologacao leva semanas, entao isso encheria a lista de
//      processo VIVO e mandaria alguem atras dele. A suite trava as duas fontes legitimas.
//
//   node tests/testa_pesquisa_avancada.js
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const ddl = fs.readFileSync(path.join(__dirname, '..', 'ddl', 'orgaos.sql'), 'utf8');

// A ancora de FIM da extracao da janela: o IIFE que aplica o padrao no DOM. Ele NAO entra na
// extracao (a suite nao tem DOM) e precisa ser unico no arquivo.
const FIM_JANELA = "(function(){\n  const j = janelaPadrao();";
function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora: ' + ini);
  return src.slice(s, e);
}

// DOM de mentira: so o que as funcoes usam (value + innerHTML). Assim o refino roda fora do
// navegador sem virar uma segunda copia do codigo dentro do teste.
const CAMPOS = {};
const elem = id => (CAMPOS[id] === undefined ? null : CAMPOS[id]);
const doc = { getElementById: elem };
// O `window` carrega o motor DE VERDADE: desde 10/08 o bloco de constantes da tela abre com
// `const { semAcento, ... } = window.LimedtecTetoCMED` em vez de escrever as funcoes de novo.
const win = { LimedtecTetoCMED: require(path.join(__dirname, '..', 'fpmed_teto_cmed.js')) };

// A ancora foi ate `ultimoDiaUtil` porque o `filtrosDaTela()` (06/08, Meus Jornais) precisa de
// `iso` e `ultimoDiaUtil` pra decidir se a janela de data e movel ou fixa. Extrair menos que
// isso quebraria o refino aqui por falta de dependencia, nao por defeito.
const ctx = (new Function('document', 'window',
  bloco('const brl =', FIM_JANELA) +
  bloco('const CRUZ = new Map()', 'function aderencia') +
  bloco('const _CAMPOS_REFINO', '// ══ ÓRGÃOS') +
  'return { refino, casaRefino, pillsRefino, criteriosRefino, populaPortais, desertaDe, _ehSrp, CRUZ, chaveLic, semAcento };'))(doc, win);
const { refino, casaRefino, pillsRefino, criteriosRefino, populaPortais, desertaDe, _ehSrp, CRUZ, chaveLic } = ctx;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_pesquisa_avancada — refino, orgaos e desertas\n');

// helper: monta o "documento" com os campos do refino
function campos(o) {
  for (const k of ['f-portal', 'f-modo', 'f-sit', 'f-orgao', 'f-srp', 'f-vmin', 'f-vmax']) CAMPOS[k] = { value: '' };
  for (const k in o) CAMPOS['f-' + k] = { value: o[k] };
  win._soDesertas = !!o._desertas;
  return refino();
}
const LIC = {
  orgaoEntidade: { cnpj: '01612092000123', razaoSocial: 'MUNICIPIO DE URUACU' },
  unidadeOrgao: { nomeUnidade: 'SECRETARIA DE SAUDE', municipioNome: 'Uruaçu', ufSigla: 'GO' },
  anoCompra: 2026, sequencialCompra: 42,
  usuarioNome: 'Bolsa Nacional De Compras - BNC',
  modoDisputaNome: 'Aberto', situacaoCompraNome: 'Divulgada no PNCP',
  srp: true, valorTotalEstimado: 250000, objetoCompra: 'AQUISICAO DE MEDICAMENTOS',
};
const com = o => ({ ...LIC, ...o });

// ══════════ 1. PORTAL — o filtro que o SIGA tem e que aqui vale dinheiro ══════════
// O portal e onde a disputa acontece, e o item 8 MEDIU a taxa de vitoria da FPMED por portal
// (BNC 23,0% · LICITANET 22,9% · BLL 19,6% · GOV.BR 13,0%).
ok('1. portal vazio nao filtra nada', casaRefino(LIC, campos({})) === true);
ok('2. *** portal casa exato ***', casaRefino(LIC, campos({ portal: 'Bolsa Nacional De Compras - BNC' })) === true);
ok('3. ...e portal diferente sai', casaRefino(LIC, campos({ portal: 'Compras.gov.br' })) === false);
ok('4. licitacao sem portal declarado sai quando o filtro exige um',
  casaRefino(com({ usuarioNome: null }), campos({ portal: 'Compras.gov.br' })) === false);

// ══════════ 2. MODO DE DISPUTA E SITUACAO ══════════
ok('5. modo de disputa casa', casaRefino(LIC, campos({ modo: 'Aberto' })) === true);
ok('6. modo diferente sai', casaRefino(LIC, campos({ modo: 'Aberto-Fechado' })) === false);
ok('7. *** comparacao sem acento e sem caixa (o PNCP varia a grafia) ***',
  casaRefino(com({ situacaoCompraNome: 'ANULADA' }), campos({ sit: 'Anulada' })) === true);
ok('8. situacao diferente sai', casaRefino(LIC, campos({ sit: 'Revogada' })) === false);

// ══════════ 3. REGISTRO DE PRECOS ══════════
ok('9. srp booleano true e reconhecido', _ehSrp({ srp: true }) === true);
ok('10. ...e a string "true" tambem (o banco devolve o bruto como JSON)', _ehSrp({ srp: 'true' }) === true);
ok('11. srp false/ausente nao e SRP', _ehSrp({ srp: false }) === false && _ehSrp({}) === false);
ok('12. "so registro de precos" corta quem nao e SRP',
  casaRefino(LIC, campos({ srp: 'so' })) === true && casaRefino(com({ srp: false }), campos({ srp: 'so' })) === false);
ok('13. *** "excluir registro de precos" corta o SRP ***',
  casaRefino(LIC, campos({ srp: 'nao' })) === false && casaRefino(com({ srp: false }), campos({ srp: 'nao' })) === true);

// ══════════ 4. ORGAO / UNIDADE / MUNICIPIO / CNPJ ══════════
ok('14. casa pela razao social', casaRefino(LIC, campos({ orgao: 'uruacu' })) === true);
ok('15. *** casa pelo municipio COM acento digitado ***', casaRefino(LIC, campos({ orgao: 'Uruaçu' })) === true);
ok('16. casa pela unidade', casaRefino(LIC, campos({ orgao: 'secretaria de saude' })) === true);
ok('17. casa pelo CNPJ (o que o diretorio de Orgaos conhece com certeza)',
  casaRefino(LIC, campos({ orgao: '01612092000123' })) === true);
ok('18. termo que nao existe sai', casaRefino(LIC, campos({ orgao: 'rio verde' })) === false);
ok('19. *** ";" e OU, a MESMA convencao do campo de palavras-chave desta tela ***',
  casaRefino(LIC, campos({ orgao: 'rio verde; uruacu' })) === true);

// ══════════ 5. FAIXA DE VALOR — o ponto onde e facil sumir com oportunidade ══════════
ok('20. minimo corta abaixo', casaRefino(com({ valorTotalEstimado: 1000 }), campos({ vmin: '5000' })) === false);
ok('21. minimo mantem acima', casaRefino(LIC, campos({ vmin: '5000' })) === true);
ok('22. maximo corta acima', casaRefino(LIC, campos({ vmax: '1000' })) === false);
ok('23. faixa fechada funciona nos dois lados',
  casaRefino(LIC, campos({ vmin: '100000', vmax: '300000' })) === true
  && casaRefino(LIC, campos({ vmin: '300000', vmax: '400000' })) === false);
ok('24. *** licitacao SEM valor estimado NUNCA e cortada pela faixa ***',
  casaRefino(com({ valorTotalEstimado: null }), campos({ vmin: '5000', vmax: '9000' })) === true);
ok('25. ...nem com valor zero (dispensa costuma vir assim, e e o que a FPMED disputa)',
  casaRefino(com({ valorTotalEstimado: 0 }), campos({ vmin: '5000' })) === true);
ok('26. campo de valor vazio nao vira 0 (senao tudo passaria a ter minimo 0)',
  campos({ vmin: '' }).vmin === null && campos({ vmax: 'abc' }).vmax === null);

// ══════════ 6. DESERTAS — so dado declarado, nunca inferencia ══════════
ok('27. licitacao normal nao e deserta', desertaDe(LIC) === null);
ok('28. *** REVOGADA e situacao declarada pelo PNCP ***',
  (desertaDe(com({ situacaoCompraNome: 'Revogada' })) || {}).rotulo === 'REVOGADA');
ok('29. ANULADA idem', (desertaDe(com({ situacaoCompraNome: 'Anulada' })) || {}).rotulo === 'ANULADA');
ok('30. SUSPENSA idem', (desertaDe(com({ situacaoCompraNome: 'Suspensa' })) || {}).rotulo === 'SUSPENSA');
ok('31. *** o rotulo SEMPRE vem com o motivo (selo sem porque vira boato na tela) ***',
  /situação declarada no PNCP/.test((desertaDe(com({ situacaoCompraNome: 'Revogada' })) || {}).motivo || ''));
{
  // a 2a fonte: situacao DECLARADA dos itens, que so e sabida depois de ler os itens
  const l = com({ sequencialCompra: 99 });
  CRUZ.set(chaveLic(l), { itens: [1, 2, 3, 4], casados: 0, desertos: 3, quando: Date.now() });
  const d = desertaDe(l);
  ok('32. *** item marcado Deserto/Fracassado no PNCP marca a licitacao ***', (d || {}).rotulo === 'DESERTA/FRACASSADA', d);
  ok('33. ...dizendo QUANTOS de quantos', /3 de 4 itens/.test((d || {}).motivo || ''), (d || {}).motivo);
}
{
  const l = com({ sequencialCompra: 98 });
  CRUZ.set(chaveLic(l), { itens: [1, 2], casados: 1, desertos: 0, quando: Date.now() });
  ok('34. itens lidos e NENHUM deserto: a tela nao afirma nada', desertaDe(l) === null);
}
{
  // >>> A NAO-INFERENCIA, que e uma decisao e nao um esquecimento: encerrada ha tempos e sem
  //     valor homologado NAO vira deserta. Homologacao leva semanas.
  const velha = com({ sequencialCompra: 97, dataEncerramentoProposta: '2026-01-10T09:00:00', valorTotalHomologado: null });
  ok('35. *** "encerrou e nao homologou" NAO e deserta (seria processo vivo virando caducado) ***',
    desertaDe(velha) === null);
  ok('36. ...e o motivo esta escrito no codigo, pra ninguem "consertar" isso depois',
    /Homologação leva semanas/.test(src) && /pior que filtro nenhum/.test(src));
}
ok('37. o filtro "so desertas" corta a licitacao normal',
  casaRefino(LIC, campos({ _desertas: 1 })) === false
  && casaRefino(com({ situacaoCompraNome: 'Revogada' }), campos({ _desertas: 1 })) === true);

// ══════════ 7. AS PILLS — filtro invisivel e o defeito que esta suite existe pra impedir ══════
ok('38. sem refino, nenhuma pill', pillsRefino(campos({})).length === 0);
{
  const r = campos({ portal: 'BLL Compras', modo: 'Aberto', sit: 'Revogada', orgao: 'uruacu',
                     srp: 'nao', vmin: '1000', vmax: '5000', _desertas: 1 });
  const ps = pillsRefino(r).join(' | ');
  ok('39. *** TODO criterio ativo aparece em pill ***', pillsRefino(r).length === 8, pillsRefino(r));
  ok('40. a pill nomeia o portal', /BLL Compras/.test(ps));
  ok('41. a pill diz "sem registro de precos" em portugues, nao "nao"', /sem registro de preços/.test(ps), ps);
  ok('42. a pill mostra a faixa de valor formatada', /≥/.test(ps) && /≤/.test(ps), ps);
  ok('43. a pill avisa que so desertas estao sendo mostradas', /só desertas/.test(ps), ps);
}

/* ══════════ 7b. OS CHIPS DA BARRA DE BUSCA (passo 5 do molde · 13/08) ══════════════════════
   Os criterios ativos sairam da fila de pilulas de SO LEITURA acima da lista e viraram CHIPS
   dentro da barra de busca, cada um com um "×". Duas coisas mudaram, e as duas tem assert:
     1. a lista de criterios passou a ser de OBJETOS (`criteriosRefino`), e a `pillsRefino`
        virou uma VISTA dela — porque o chip precisa saber de QUE CAMPO ele veio pra poder
        desliga-lo, e a frase corrida do resumo do jornal continua precisando ser frase;
     2. o criterio agora se desliga de dentro da barra, sem procurar o campo na coluna.
   >>> O ASSERT QUE MAIS IMPORTA E O DA LISTA UNICA. Duas listas — uma pros chips, outra pras
       frases — seriam a garantia de que uma delas ia esquecer o criterio novo. E seria a de
       leitura, que e justamente a que o operador usa pra entender por que a busca deu pouco. */
{
  const cheio = { portal: 'BLL Compras', modo: 'Aberto', sit: 'Revogada', orgao: 'uruacu',
                  srp: 'nao', vmin: '1000', vmax: '5000', _desertas: 1 };
  const r = campos(cheio);
  const cs = criteriosRefino(r);
  ok('43b. *** chip e frase saem da MESMA lista (uma so, e a frase e vista dela) ***',
    cs.length === pillsRefino(r).length
    && JSON.stringify(cs.map(c => c.frase)) === JSON.stringify(pillsRefino(r)),
    { chips: cs.length, frases: pillsRefino(r).length });
  ok('43c. todo chip sabe de que CAMPO veio (senao o "×" nao teria o que desligar)',
    cs.every(c => typeof c.id === 'string' && c.id.length > 0),
    cs.filter(c => !c.id));
  ok('43d. e todo chip tem rotulo fraco + valor forte (D9 dentro de uma peca de 26px)',
    cs.every(c => c.rotulo && c.valor), cs.filter(c => !c.rotulo || !c.valor));
  /* O `desertas` NAO e campo de formulario, e sim um estado da tela. Se o "×" dele tentasse
     limpar um `getElementById('_desertas')`, o chip sumiria e o filtro continuaria ligado — o
     pior dos dois mundos, porque a tela passaria a filtrar sem dizer que filtra. */
  const des = cs.find(c => c.campo === 'desertas');
  ok('43e. o "so desertas" tem caminho PROPRIO (ele e estado da tela, nao campo)',
    !!des && des.id === '_desertas', des);
  ok('43f. os demais apontam pro id do campo de verdade',
    cs.filter(c => c.campo !== 'desertas').every(c => /^f-/.test(c.id)),
    cs.filter(c => c.campo !== 'desertas' && !/^f-/.test(c.id)));
  ok('43g. sem refino ligado, nenhum chip', criteriosRefino(campos({})).length === 0);
}

/* ══════════ 7c. A BARRA DE BUSCA, no arquivo ══════════════════════════════════════════════
   O que nao da pra provar executando funcao: a cor do botao e a ausencia do "+ Filtro". */
{
  const bruto = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  /* ══ A FUGA MEDIDA, E ELA E O ASSERT MAIS IMPORTANTE DESTE BLOCO ═══════════════════════
     O molde pinta o botao "Buscar" com o #2CA9E0 da marca e texto branco por cima: 2,67:1,
     pouco mais da metade do minimo de AA. E a licao S12 inteira, de novo. O tema ja tem a
     saida: o --azul-600 (#1576A5) e "a cor da acao" e da 5,04:1.
     >>> Este assert existe pra que "aproximar mais do molde" nao signifique um dia trocar o
         600 pelo 500 aqui — que e a coisa mais natural do mundo pra quem esta comparando os
         dois prints lado a lado e nao mediu. */
  const regraGo = (bruto.match(/\.buscabox \.go\{[^}]*\}/) || [''])[0].replace(/\s*\n\s*/g, '');
  ok('43h. *** o botao Buscar usa a COR DA ACAO (azul-600), e nao o azul da marca ***',
    /background:var\(--azul-600\)/.test(regraGo) && !/var\(--azul-500\)/.test(regraGo),
    regraGo.slice(0, 160));
  ok('43i. e ele voltou a ter TEXTO (era um quadrado com lupa, dentro de um campo com outra lupa)',
    /<button class="go"[^>]*>[\s\S]{0,300}?Buscar<\/button>/.test(bruto));
  ok('43j. a barra usa a borda propria dela do molde, e nao a de cartao',
    /\.buscabox\{[^}]*border:1px solid var\(--borda-busca\)/.test(bruto.replace(/\s*\n\s*/g, '')),
    (bruto.match(/\.buscabox\{[^}]*\}/) || [''])[0].slice(0, 200));
  /* O "+ Filtro" do molde abre um popover com os campos disponiveis — porque LA nao ha coluna
     de filtros. Aqui ela existe e esta SEMPRE ABERTA. Um botao pra abrir o que ja esta aberto
     e o "link que nao faz nada" que este arquivo ja removeu uma vez (a "Pesquisa avancada",
     quando os filtros viraram coluna fixa). */
  ok('43k. o "+ Filtro" do molde NAO entrou (a coluna de filtros ja esta sempre aberta)',
    !/\+ Filtro/.test(bruto) && /id="avancada"/.test(bruto));
  /* E a fila de pilulas acima da lista SUMIU. Se ela tivesse ficado, o mesmo criterio estaria
     escrito em dois lugares da mesma tela — e o de baixo sem o "×", ou seja, duas versoes com
     poderes diferentes. */
  ok('43l. a fila de pilulas de leitura acima da lista saiu (o criterio mora num lugar so)',
    !/<div class="refino"><span class="hint">refino ativo:/.test(bruto));
}

// ══════════ 8. A LISTA DE PORTAIS SAI DO RESULTADO, nao de uma lista fixa ══════════
{
  CAMPOS['f-portal'] = { value: '', innerHTML: '' };
  populaPortais([com({ usuarioNome: 'Compras.gov.br' }), com({ usuarioNome: 'BLL Compras' }),
                 com({ usuarioNome: 'Compras.gov.br' }), com({ usuarioNome: null })]);
  const html = CAMPOS['f-portal'].innerHTML;
  ok('44. cada portal aparece UMA vez', (html.match(/Compras\.gov\.br/g) || []).length === 1, html);
  ok('45. portal vazio/nulo nao vira opcao em branco', !/<option><\/option>/.test(html));
  ok('46. em ordem alfabetica de gente (localeCompare pt-BR)',
    html.indexOf('BLL Compras') < html.indexOf('Compras.gov.br'));
  ok('47. e sempre existe "Todos os portais"', /<option value="">Todos os portais<\/option>/.test(html));
}
{
  CAMPOS['f-portal'] = { value: 'Compras.gov.br', innerHTML: '' };
  populaPortais([com({ usuarioNome: 'Compras.gov.br' }), com({ usuarioNome: 'BLL Compras' })]);
  ok('48. a escolha do operador sobrevive a uma nova busca', CAMPOS['f-portal'].value === 'Compras.gov.br',
    CAMPOS['f-portal'].value);
}
{
  // >>> o caso que zeraria a tela em silencio: o portal escolhido nao existe no resultado novo.
  CAMPOS['f-portal'] = { value: 'Licitanet Licitações Eletrônicas LTDA', innerHTML: '' };
  populaPortais([com({ usuarioNome: 'Compras.gov.br' })]);
  ok('49. *** portal que sumiu do resultado volta pra "Todos" (senao a lista zeraria sozinha) ***',
    CAMPOS['f-portal'].value === '', CAMPOS['f-portal'].value);
}

// ══════════ 9. O QUE PRECISA ESTAR NA TELA (fonte) ══════════
ok('50. o refino entra no filtro do render, junto com palavras-chave e exclusoes',
  /if\(!casaRefino\(l, r\)\) return false;/.test(src));
ok('51. *** "Encontrar por No" IGNORA o refino (quem digitou o numero quer AQUELA licitacao) ***',
  /if\(num\) return String\(l\.numeroControlePNCP\|\|''\)\.includes\(num\);/.test(src)
  && /ignora o refino de propósito/.test(src));
ok('52. o render guarda o ultimo resultado, pro refino nao ir a rede',
  /window\._ultimoRender = \{todos, kws, excl, aviso, procedencia\}/.test(src) && /function rerender\(\)/.test(src));
ok('53. ...e o motivo esta dito (a fonte caiu 6x em 3 dias; trocar filtro nao pode custar consulta)',
  /não custa nova consulta ao PNCP|não pode\s*\n?\/\/ custar/.test(src));
/* O PORTAL VALE PORQUE A TAXA DE VITORIA E MEDIDA POR ELE (item 8: BNC 23,0% ·
   LICITANET 22,9% · BLL 19,6% · GOV.BR 13,0%) — por isso ele TEM que estar no card.
   >>> O ASSERT COBRAVA A STRING DO `title` do crachao antigo ("portal em que foi
       publicada"), e ficou vermelho em 13/08 quando o card virou o cartao rico e o
       portal desceu pro rodape como dado rotulado. Nada tinha sumido: ele so mediu o
       MEIO em vez da promessa. E a licao S8 outra vez.
   >>> AGORA ELE COBRA QUE O CAMPO DO PORTAL (`usuarioNome`) SEJA IMPRESSO no card,
       com rotulo — que e o que "o card mostra o portal" sempre quis dizer. */
ok('54. o card mostra o PORTAL, com rotulo, onde quer que ele fique',
  /usuarioNome \? 'Portal'/.test(src) && /esc\(l\.usuarioNome \|\|/.test(src));
ok('55. o card mostra o selo SRP com o que isso significa', /class="bdg laranja"/.test(src) && /Sistema de Registro de Preços/.test(src));
ok('56. o selo de deserta carrega o motivo no title', /class="etq deserta" title="'\+esc\(des\.motivo\)/.test(src));
ok('57. a marca de deserta aparece depois de cruzar, sem re-renderizar a lista',
  /const des = desertaDe\(l\);/.test(src) && /cx\.querySelector\('\.etq\.deserta'\)/.test(src));
ok('58. os itens contam a situacao DECLARADA (situacaoCompraItemNome), nao uma heuristica',
  /situacaoCompraItemNome/.test(src) && /desertos = itens\.filter/.test(src));
ok('59. o resultado vazio avisa que pode ser o refino, nao a busca', /Há refino ligado/.test(src));
ok('60. ...e explica que deserta-por-item so existe depois de ler os itens',
  /só existe depois de ler os itens/.test(src));

// ══════════ 10. ORGAOS — diretorio derivado, e honesto sobre o que conhece ══════════
ok('61. a tela le a view derivada, nao uma tabela paralela pra manter sincronizada',
  /v_orgaos_licitantes\?select=\*/.test(src) && !/from public\.orgaos\b/.test(ddl));
ok('62. *** a tela diz que o diretorio so conhece o que NOS coletamos ***',
  /derivados das \$\{somaLic\} licitações que já coletamos/.test(src) && /não é um cadastro nacional/.test(src));
ok('63. ...e o motivo esta escrito (senao alguem conclui "esse orgao nao compra isso")',
  /esse órgão não compra isso/.test(src) || /esse órgão não compra/.test(ddl));
ok('64. indice vazio nao vira lista vazia sem explicacao', /o índice próprio ainda está vazio/.test(src));
ok('65. clicar no orgao joga o nome no filtro e re-renderiza (sem nova consulta)',
  /function filtrarPorOrgao\(nome\)/.test(src) && /rerender\(\);/.test(src));
ok('66. *** a view herda a RLS da licitacoes (security_invoker) ***',
  /with \(security_invoker = on\)/.test(ddl));
ok('67. ...e o motivo esta no DDL (sem isso ela vira porta lateral pra ler a tabela)',
  /porta lateral/.test(ddl));
ok('68. a view e so pra logado', /grant select on public\.v_orgaos_licitantes to authenticated/.test(ddl)
  && /revoke all on public\.v_orgaos_licitantes from anon/.test(ddl));
ok('69. o DDL e seguro re-rodar e nao derruba nada', /create or replace view/.test(ddl) && !/drop /i.test(ddl));
ok('70. a razao social exibida e a MAIS RECENTE (orgao muda de nome)',
  /array_agg\(l\.orgao order by l\.data_publicacao desc/.test(ddl));
ok('71. o PostgREST e avisado do schema novo (senao a view "nao existe" pra API)',
  /notify pgrst, 'reload schema'/.test(ddl));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
