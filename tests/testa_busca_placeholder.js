// SUITE testa_busca_placeholder — o campo de busca nasce VAZIO, e o ramo vira regra por dentro.
//
// ══ O QUE MUDOU ═════════════════════════════════════════════════════════════════════════════
// O campo vinha PREENCHIDO com "medicamento; hospitalar; material medico; farmac; soro;
// correlatos" como VALOR. Pra buscar outra coisa, o operador tinha que selecionar e apagar tudo.
// Atrito em todo uso — e a tela parecendo que alguem deixou uma pesquisa aberta ali.
//
// ══ O FILTRO NAO SUMIU, MUDOU DE LUGAR ══════════════════════════════════════════════════════
// Campo vazio continua filtrando pelo ramo da FPMED, agora por REGRA INTERNA. O comportamento e
// o mesmo; o que mudou e que a regra deixou de morar num campo de texto editavel, onde qualquer
// apagada acidental mudava o que a tela busca sem ninguem perceber.
//
// >>> E A TELA DIZ ISSO. Sem a linha de dica, quem digita "cadeira" e nao acha nada nao descobre
//     que a tela estava filtrando o ramo por dentro — e conclui que a busca esta quebrada.
//
//   node tests/testa_busca_placeholder.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const L = R('fpmed_licitacoes.html');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_busca_placeholder — campo vazio, ramo por dentro\n');

// ══════════ 1. O CAMPO NASCE VAZIO ══════════
ok('1. *** o campo nasce VAZIO ***', /<input id="f-kw" value=""/.test(L));
ok('2. *** e nao sobrou o valor antigo em lugar nenhum do HTML do campo ***',
  !/id="f-kw" value="medicamento/.test(L));
ok('3. *** com placeholder que da exemplo de item ***',
  /placeholder="busque por item — ex\.: albumina, dipirona…"/.test(L));
ok('4. ...e o motivo da troca esta escrito (atrito em todo uso)',
  /o operador tinha\s*que selecionar e apagar tudo pra buscar outra coisa/.test(uc(L)));

// ══════════ 2. O RAMO VIROU REGRA INTERNA ══════════
ok('5. *** as seis categorias existem como constante ***',
  /const CATEGORIAS_RAMO = \['medicamento', 'hospitalar', 'material medico', 'farmac', 'soro', 'correlatos'\];/.test(L));
ok('6. *** e sao as MESMAS seis de antes (nao aproveitei pra mexer na lista) ***',
  ['medicamento', 'hospitalar', 'material medico', 'farmac', 'soro', 'correlatos']
    .every(x => new RegExp("'" + x + "'").test(L)));
ok('7. *** campo vazio -> ramo; campo com termo -> so o termo ***',
  /function palavrasDaBusca\(\)\{[\s\S]{0,240}if\(!cru\) return CATEGORIAS_RAMO/.test(L));
ok('8. ...e o motivo (quem escreveu "albumina" quer albumina, nao "albumina dentro do ramo")',
  /que é a mesma coisa com um jeito de esconder resultado/.test(uc(L)));
ok('9. *** a busca usa a funcao, e nao le o campo direto ***',
  /const kws  = palavrasDaBusca\(\);/.test(L)
  && !/const kws  = document\.getElementById\('f-kw'\)/.test(L));
ok('10. *** e o comentario separa isto das CATEGORIAS da etiqueta verde ***',
  /Aquelas classificam o que JÁ apareceu;\s*estas decidem o que aparece/.test(uc(L)));
ok('11. ...com o risco de fundir as duas dito',
  /fundir as duas faria mexer numa etiqueta mudar o resultado da busca/.test(uc(L)));

// ══════════ 3. A TELA DIZ O QUE O VAZIO FAZ ══════════
ok('12. *** existe a linha de dica embaixo do campo ***', /<div class="hint" id="dica-kw"/.test(L));
ok('13. *** ela muda com o que esta escrito ***', /function pintaDicaBusca\(\)/.test(L));
ok('14. *** vazio: diz que esta mostrando o ramo, e lista as seis ***',
  /Mostrando o <b>ramo da FPMED<\/b> \(medicamento, hospitalar, material médico, farmac, soro, /.test(L));
ok('15. *** com termo: diz que e SO aquilo, e como voltar ***',
  /— só isso\. Apague pra voltar ao ramo da FPMED/.test(L));
ok('16. ...e ela e repintada enquanto a pessoa digita',
  /kw\.addEventListener\('input', pintaDicaBusca\)/.test(L));
ok('17. ...com o motivo (senao o operador acha que a lista filtra por magica)',
  /o operador acha que a lista\s*filtra por mágica/.test(uc(L)));

// ══════════ 4. OS JORNAIS NAO QUEBRAM ══════════
ok('18. *** jornal SEM palavra passa a filtrar pelo ramo (a mesma regra da tela) ***',
  /: CATEGORIAS_RAMO\.map\(s => semAcento\(s\)\);/.test(L));
ok('19. ...com o motivo (senao ele traria o PNCP inteiro e o contador de "novas" viraria ruido)',
  /treinando o operador a ignorá-lo/.test(uc(L)));
ok('20. *** jornal salvo COM palavra continua igual (kw preenchido sempre mandou sozinho) ***',
  /um\s*`kw` preenchido sempre mandou sozinho/.test(uc(L)));
ok('21. ...e nenhum jornal salvo precisou ser migrado',
  /Os que foram salvos antes de 11\/08 guardaram as seis\s*categorias como TEXTO no `kw`/.test(uc(L)));
ok('22. abrir um jornal repinta a dica (senao ela descreve a busca anterior)',
  /pintaDicaBusca\(\);/.test(L.slice(L.indexOf('function aplicaFiltros'))));

// ══════════ 5. E A SUITE DOS JORNAIS FOI CORRIGIDA, NAO SILENCIADA ══════════
const J = R('tests', 'testa_meus_jornais.js');
ok('23. *** o assert de "sem palavra nao filtra" virou "sem palavra filtra o ramo" ***',
  /jornal sem palavra filtra pelo RAMO \(e nao traz tudo\)/.test(J));
ok('24. ...e o comentario diz por que ele NAO podia ficar como estava',
  /ele estaria travando o comportamento que\s*quebraria o produto/.test(uc(J)));

// ══════════ 6. OS FILTROS SAIRAM DA GAVETA (reforma Prime, 11/08) ══════════
// Eles moravam atras do link "Pesquisa avancada", FECHADOS. Quem nao clicasse nao sabia que UF,
// modalidade, valor e situacao existiam — e buscava sem saber que dava pra filtrar.
ok('25. *** os filtros sao uma COLUNA, e nao uma gaveta ***',
  /#painel-busca\{display:grid;grid-template-columns:262px 1fr/.test(L)
  && !/#avancada\{display:none/.test(L));
ok('26. *** e a coluna tem titulo "Filtros", como no Prime ***', /<h5>Filtros<\/h5>/.test(L));
ok('27. *** eles ficam FIXOS ao rolar ***', /#avancada\{[\s\S]{0,200}position:sticky/.test(L));
ok('28. ...com o motivo (subir ate o topo pra trocar a UF e o atrito que faz ninguem filtrar)',
  /o tipo de atrito que faz ninguem filtrar/.test(uc(L)));
ok('29. *** o link "Pesquisa avancada" saiu (abrir o que ja esta aberto nao faz nada) ***',
  !/>Pesquisa avançada<\/a>/.test(L));
ok('30. *** NENHUM filtro foi acrescentado nem tirado ***',
  ['f-uf','f-mod','f-excluir','f-modo','f-sit','f-orgao','f-srp','f-vmin','f-vmax']
    .every(id => new RegExp('id="' + id + '"').test(L)));
ok('31. ...e o codigo diz isso (mesmos campos, mesmos ids, so deixaram de estar escondidos)',
  /NENHUM FILTRO FOI ACRESCENTADO NEM TIRADO/.test(L));
ok('32. *** `.open` continua existindo porque codigo antigo ainda o chama ***',
  /#avancada\.open\{\}/.test(L) && /`soDesertas\(\)` e o Radar abrem a gaveta por/.test(uc(L)));
ok('33. a coluna vira pilha no celular', /@media\(max-width:900px\)\{#painel-busca\{grid-template-columns:1fr\}\}/.test(L));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
