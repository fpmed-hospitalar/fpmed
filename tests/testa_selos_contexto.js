// SUITE testa_selos_contexto — OS SELOS DE CONTEXTO NA FICHA DO NEGOCIO (fatia B14, 14/08/2026).
//
// == POR QUE ELES EXISTEM DENTRO DO NEGOCIO ====================================
// O A poe os mesmos selos na tela Encontrar. La a pergunta e "vale a pena olhar?";
// aqui e "quanto eu ofereco?" — e e a segunda que decide dinheiro. Um gestor que
// descobre que o certame e REGISTRO DE PRECO so na hora de assinar ja montou o
// preco de um fornecimento unico.
//
// == O QUE ESTA SUITE PROTEGE ==================================================
//  1. QUE NENHUM SELO SEJA INVENTADO. Campo ausente no banco = selo ausente na
//     tela. Nunca deduzido, nunca chutado a partir de outro campo.
//  2. QUE `srp:false` E `srp:null` NAO SEJAM A MESMA COISA na hora de nao desenhar
//     — um e "nao e registro de preco", o outro e "a coleta nao trouxe".
//  3. QUE O ORCAMENTO SIGILOSO USE AS PALAVRAS DO PNCP, e nao uma tabela de
//     dominio copiada pra dentro desta tela.
//  4. QUE ZERO NAO SEJA REFERENCIA. Medido em 14/08: `valor_unitario_ref` nunca e
//     nulo neste banco, mas e ZERO em 7.456 dos 40.342 itens (277 certames). A tela
//     escrevia "R$ 0,00 · referencia do edital" para todos eles — um preco que
//     ninguem publicou, escrito como se existisse — enquanto a coluna do teto, na
//     MESMA linha, ja dizia "nada a comparar".
//  5. QUE O TETO DA CMED APARECA justamente onde o edital calou.
//
//   node tests/testa_selos_contexto.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const HTML = R('fpmed_negocios.html');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_selos_contexto — os selos que mudam a decisao do gestor (fatia B14)\n');

// ══════════ 0. AS DUAS FUNCOES PURAS, ARRANCADAS DO HTML E EXECUTADAS ══════════
/* Mesma escolha da B13, pelo mesmo motivo da B2: suite que confere o codigo-fonte por expressao
   regular fica verde sobre funcao que nunca roda. Estas duas nasceram sem DOM e sem rede pra
   poderem ser EXECUTADAS aqui, com dado presente e com dado ausente. */
const fSemRef = (HTML.match(/const semReferencia = it => [^\n]+/) || [])[0];
const fSelos = (HTML.match(/function selosDoContexto\(lic, itens\)\{[\s\S]*?\n\}/) || [])[0];
ok(n + '. *** `semReferencia` e `selosDoContexto` existem e sao puras ***',
  !!fSemRef && !!fSelos && !/document|fetch|window/.test(fSelos)); n++;
if (!fSemRef || !fSelos) { console.log('\nRESULTADO: ' + p + ' ok, ' + (f + 1) + ' falha(s)'); process.exit(1); }
const semReferencia = new Function(fSemRef + '; return semReferencia;')();
const selos = new Function(fSemRef + '; ' + fSelos + '; return selosDoContexto;')();
const tem = (l, txt) => l.some(x => x.txt === txt);
const acha = (l, txt) => l.find(x => x.txt === txt);

// ══════════ 1. ZERO NAO E REFERENCIA ══════════
/* O defeito medido desta fatia. 7.456 itens em 277 certames vinham com `valor_unitario_ref` = 0,
   e a condicao antiga (`!= null`) dava `true` pra todos eles. */
ok(n + '. *** zero NAO e referencia (o defeito medido: 7.456 itens em 277 certames) ***',
  semReferencia({ valor_unitario_ref: 0 }) === true); n++;
ok(n + '. *** "0" em texto tambem nao (o PostgREST devolve numeric como string) ***',
  semReferencia({ valor_unitario_ref: '0' }) === true); n++;
ok(n + '. *** nulo e ausente tambem nao ***',
  semReferencia({ valor_unitario_ref: null }) === true && semReferencia({}) === true
  && semReferencia(null) === true); n++;
ok(n + '. *** e um preco de verdade E referencia ***',
  semReferencia({ valor_unitario_ref: 27 }) === false
  && semReferencia({ valor_unitario_ref: '4.16' }) === false); n++;
/* Preco negativo nao existe em edital; se aparecer, e sujeira — e sujeira nao vira referencia. */
ok(n + '. *** e valor negativo nao passa por referencia ***',
  semReferencia({ valor_unitario_ref: -1 }) === true); n++;

// ══════════ 2. NENHUM SELO NASCE DE CAMPO QUE O BANCO NAO TEM ══════════
/* ══ ESTE E O ASSERT QUE A CAIXA PEDIU COM ESTAS PALAVRAS ═══════════════════════════════════
   "se um campo ainda nao for coletado, NAO invente — mostre nada". Medido em 14/08: ZERO das
   3.876 licitacoes do indice tem `orcamentoSigilosoCodigo` no `bruto`. Entao hoje, no banco de
   verdade, este caminho e o normal — e ele nao pode desenhar nada. */
const nada = selos({ id: 1, modo_disputa: null, srp: null, sigiloso_txt: null, sigiloso_cod: null }, []);
ok(n + '. *** licitacao sem nenhum dos campos NAO gera selo nenhum ***', nada.length === 0, nada); n++;
ok(n + '. *** sem licitacao nenhuma tambem nao ***',
  selos(null, []).length === 0 && selos(false, []).length === 0 && selos(undefined, []).length === 0); n++;
/* Erro de leitura NAO e "nao e registro de preco": e uma afirmacao sobre o certame que a tela
   nao pode fazer se nem conseguiu ler a linha dele. */
ok(n + '. *** e erro de leitura nao vira selo nenhum (nao sei != nao e) ***',
  selos({ erro: 'HTTP 500', srp: 'true' }, []).length === 0); n++;

// ══════════ 3. REGISTRO DE PRECO ══════════
const srpSim = selos({ srp: 'true', modo_disputa: null }, []);
ok(n + '. *** srp true -> selo VERDE "Registro de preco" ***',
  tem(srpSim, 'Registro de preço') && acha(srpSim, 'Registro de preço').tom === 'verde', srpSim); n++;
ok(n + '. ...e a dica diz o que muda na decisao (a ata vale por ate 12 meses)',
  /12 meses/.test(acha(srpSim, 'Registro de preço').dica)); n++;
ok(n + '. *** srp false -> NENHUM selo (nao e registro de preco, e isso nao e aviso) ***',
  !tem(selos({ srp: 'false' }, []), 'Registro de preço')); n++;
ok(n + '. *** srp null (a coleta nao trouxe) -> NENHUM selo ***',
  !tem(selos({ srp: null }, []), 'Registro de preço')); n++;

// ══════════ 4. ORCAMENTO SIGILOSO — AS PALAVRAS SAO DO PNCP ══════════
const sig = selos({ sigiloso_txt: 'Compra parcialmente sigilosa', sigiloso_cod: '2' }, []);
ok(n + '. *** com a descricao do PNCP -> selo AMBAR "Orcamento sigiloso" ***',
  tem(sig, 'Orçamento sigiloso') && acha(sig, 'Orçamento sigiloso').tom === 'ambar', sig); n++;
ok(n + '. *** e a dica repete as PALAVRAS DO PNCP, nao uma traducao minha ***',
  acha(sig, 'Orçamento sigiloso').dica === 'Compra parcialmente sigilosa'); n++;
ok(n + '. *** "Sem sigilo" nao vira aviso (o caso comum nao e noticia) ***',
  !tem(selos({ sigiloso_txt: 'Sem sigilo', sigiloso_cod: '1' }, []), 'Orçamento sigiloso')); n++;
/* O CODIGO SOZINHO NAO VIRA NOME. Traduzir 1/2/3 aqui seria manter, dentro desta tela, uma
   tabela de dominio do PNCP que ninguem atualiza — e que muda sem avisar. */
ok(n + '. *** codigo sem descricao NAO vira selo (a tela nao traduz tabela de dominio do PNCP) ***',
  !tem(selos({ sigiloso_cod: '2', sigiloso_txt: null }, []), 'Orçamento sigiloso')); n++;
const bloco = (HTML.match(/function selosDoContexto\(lic, itens\)\{[\s\S]*?\n\}/) || [])[0];
ok(n + '. *** e nao ha, no codigo, mapa de codigo -> nome do sigiloso ***',
  !/sigiloso_cod\s*===?\s*['"]?[123]/.test(bloco) && !/\{\s*1:\s*['"]/.test(bloco)); n++;

// ══════════ 5. MODO DE DISPUTA ══════════
for (const md of ['Aberto', 'Fechado', 'Aberto-Fechado', 'Fechado-Aberto', 'Dispensa Com Disputa']) {
  ok(n + `. modo de disputa "${md}" vira selo com o valor do PNCP`,
    tem(selos({ modo_disputa: md }, []), 'Disputa: ' + md)); n++;
}
/* "Nao se aplica" E RESPOSTA, e por isso aparece. Escondendo-o, o silencio da linha significaria
   duas coisas ao mesmo tempo: "nao se aplica" e "a coleta nao trouxe". */
ok(n + '. *** "Nao se aplica" tambem aparece (senao o silencio teria dois significados) ***',
  tem(selos({ modo_disputa: 'Não se aplica' }, []), 'Disputa: Não se aplica')); n++;
ok(n + '. *** modo nulo -> nenhum selo de disputa ***',
  selos({ modo_disputa: null }, []).length === 0 && selos({ modo_disputa: '  ' }, []).length === 0); n++;

// ══════════ 6. SEM VALOR DE REFERENCIA — O SELO QUE SAI DOS ITENS ══════════
/* Este e o que o dono pediu quando falou do sigiloso: nao deixar o "—" com cara de dado que
   faltou. Ele nao depende do campo que falta — depende dos itens, que estao no banco. */
const todosZero = [{ valor_unitario_ref: 0 }, { valor_unitario_ref: 0 }, { valor_unitario_ref: '0' }];
ok(n + '. *** edital inteiro sem referencia -> selo AMBAR "Sem valor de referencia" ***',
  tem(selos({ srp: null }, todosZero), 'Sem valor de referência')); n++;
ok(n + '. ...e a dica nomeia a regua que sobra (o teto da CMED)',
  /teto da CMED é a única régua/.test(acha(selos({}, todosZero), 'Sem valor de referência').dica)); n++;
ok(n + '. *** um item com preco ja derruba o selo (ele e sobre o edital INTEIRO) ***',
  !tem(selos({}, [{ valor_unitario_ref: 0 }, { valor_unitario_ref: 12 }]), 'Sem valor de referência')); n++;
/* Lista vazia e "ainda nao li os itens", nao "o edital nao publicou preco". Sao respostas
   opostas: numa vale esperar a coleta, na outra nao adianta. */
ok(n + '. *** lista de itens VAZIA nao vira "sem referencia" (nao li != nao existe) ***',
  !tem(selos({}, []), 'Sem valor de referência')
  && !tem(selos({}, null), 'Sem valor de referência')); n++;

// ══════════ 7. A LINHA DO ITEM E A COLUNA DO TETO ══════════
ok(n + '. *** a linha do item usa `semReferencia` (e nao mais `!= null`) ***',
  /const temRef = !semReferencia\(it\)/.test(HTML)); n++;
ok(n + '. *** e a coluna do teto usa a MESMA funcao (uma regra so pro zero) ***',
  /if\(semReferencia\(it\)\)\{/.test(HTML)); n++;
/* O teto ja esta calculado quando o edital cala: `avaliar` devolve `sem_preco` mas devolve o
   `teto` junto, porque ele e atributo do REMEDIO e nao da comparacao. */
ok(n + '. *** sem referencia, o teto da CMED aparece como a UNICA REGUA ***',
  /o edital não publicou referência — esta é a única régua/.test(HTML)); n++;
ok(n + '. *** e ele sai em NEUTRO, nunca em verde ***',
  /<b class="neutro">teto \$\{esc\(r\.tipoTeto \|\| 'CMED'\)\}/.test(HTML)); n++;
ok(n + '. *** quando nem a CMED conhece, a tela diz as duas ausencias ***',
  /sem referência e sem teto/.test(HTML)); n++;
/* O aviso da aba CONTA, porque a acao de quem le muda com o numero: um item sem referencia e um
   caso; o edital inteiro sem referencia e outra disputa. */
ok(n + '. *** o aviso da aba Itens conta quantos itens estao sem referencia ***',
  /sem \+ ' de ' \+ ITENS_EDITAL\.length \+ ' itens/.test(HTML)); n++;
ok(n + '. *** e explica por que nao mostra R\$ 0,00 ***',
  /e não '\s*\n?\s*\+ 'R\$ 0,00/.test(HTML) || /R\$ 0,00, que seria um preço que ninguém publicou/.test(HTML)); n++;

// ══════════ 8. O CONTEXTO NAO ATRAVESSA DE UM NEGOCIO PARA OUTRO ══════════
ok(n + '. *** abrir outro negocio zera a licitacao lida ***',
  /CTX_LIC = null;\n  if\(ABERTO === id\)\{ carregarRastro/.test(HTML)); n++;
ok(n + '. *** e os selos sao repintados quando os itens chegam (a corrida das duas leituras) ***',
  /pintaControlePNCP\(id\);\n  \/\* E OS SELOS TAMBÉM[\s\S]{0,300}?pintaContexto\(id\);/.test(HTML)); n++;
/* O `bruto` inteiro tem dezenas de chaves; traze-lo por causa de dois campos seria pagar banda
   por negocio aberto. */
ok(n + '. (controle) os campos do `bruto` vem por apelido, e nao o `bruto` inteiro',
  /srp:bruto->>srp/.test(HTML) && !/select=id,numero_controle,modo_disputa,valor_estimado,bruto&/.test(HTML)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
