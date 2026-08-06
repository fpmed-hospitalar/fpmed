// SUITE testa_filtro_fornecedor — FILTRO QUE NAO FILTRA E PIOR QUE FILTRO NENHUM.
//
// O DEFEITO (Bloco 2 do sync, medido na FPMED em 05/08): o filtro de fornecedor da tela
// Cotacoes estava 100% MORTO, por dois motivos somados:
//   1. o dropdown nascia da tabela `fornecedores`, que tem ZERO linhas neste banco — entao ele
//      so tinha "Todos fornecedores". Nao havia nada pra escolher.
//   2. mesmo com a tabela cheia, o `value` do option era o `id` da tabela e o filtro comparava
//      com `c.fornecedor`, que guarda o CODIGO ('1', '18', 'SANTA CRUZ'). id x codigo nunca bate.
// Na Global o mesmo defeito matava 44 dos 48 valores; aqui matava os 46.
//
// POR QUE ISSO E GRAVE E NAO COSMETICO: o usuario escolhe um fornecedor, a lista vem vazia, e
// ele conclui que a empresa nao tem cotacao daquele fornecedor. O sistema respondeu uma mentira
// com cara de resposta. Nao ha erro na tela, nao ha nada no console.
//
//   node tests/testa_filtro_fornecedor.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_filtro_fornecedor — o filtro de fornecedor das Cotacoes\n');

// ── replica das duas funcoes, na mesma forma que rodam na tela ────────────────────────────
function montaOpcoes(cotacoes) {
  const cont = {};
  (cotacoes || []).forEach(c => { const n = c.fornecedor_nome || 'FPMED'; cont[n] = (cont[n] || 0) + 1; });
  const nomes = Object.keys(cont).sort((a, b) => cont[b] - cont[a] || a.localeCompare(b));
  return { nomes, cont };
}
function filtra(cotacoes, f) {
  return (cotacoes || []).filter(c => (!f || (c.fornecedor_nome || 'FPMED') === f));
}

// dado com a cara do banco real: codigo numerico, codigo textual e o estoque proprio
const BASE = [
  { fornecedor: '1',           fornecedor_nome: 'FPMED',       produto: 'DIPIRONA 500MG' },
  { fornecedor: '1',           fornecedor_nome: 'FPMED',       produto: 'SORO 500ML' },
  { fornecedor: '18',          fornecedor_nome: 'MCW',         produto: 'OMEPRAZOL 40MG' },
  { fornecedor: 'SANTA CRUZ',  fornecedor_nome: 'SANTA CRUZ',  produto: 'AMOXICILINA' },
  { fornecedor: 'SANTA CRUZ',  fornecedor_nome: 'SANTA CRUZ',  produto: 'CEFALOTINA' },
  { fornecedor: 'SANTA CRUZ',  fornecedor_nome: 'SANTA CRUZ',  produto: 'DIPIRONA' },
  { fornecedor: '2',           fornecedor_nome: 'SUPERMEDICA',  produto: 'PANTOPRAZOL' },
];

// ══════════ 1. O DROPDOWN NASCE DO QUE EXISTE ══════════
{
  const { nomes, cont } = montaOpcoes(BASE);
  ok('1. *** o dropdown tem opcao (antes vinha vazio: a tabela fornecedores tem 0 linhas) ***',
    nomes.length > 0, nomes.length);
  ok('2. tem exatamente os fornecedores presentes nas cotacoes', nomes.length === 4, nomes);
  ok('3. ordenado por volume: SANTA CRUZ (3) primeiro', nomes[0] === 'SANTA CRUZ', nomes);
  ok('4. FPMED (2) em segundo', nomes[1] === 'FPMED', nomes);
  ok('5. a contagem confere', cont['SANTA CRUZ'] === 3 && cont['FPMED'] === 2 && cont['MCW'] === 1, cont);
  // empate resolvido alfabeticamente, pra ordem nao variar entre recargas
  ok('6. empate desempata por nome (ordem estavel entre recargas)', nomes[2] === 'MCW' && nomes[3] === 'SUPERMEDICA', nomes);
}

// ══════════ 2. O FILTRO DE FATO FILTRA ══════════
{
  ok('7. *** escolher SANTA CRUZ devolve as 3 linhas dela ***', filtra(BASE, 'SANTA CRUZ').length === 3, filtra(BASE, 'SANTA CRUZ').length);
  ok('8. escolher MCW devolve 1', filtra(BASE, 'MCW').length === 1);
  ok('9. escolher FPMED devolve o estoque proprio (2)', filtra(BASE, 'FPMED').length === 2);
  ok('10. vazio devolve tudo', filtra(BASE, '').length === BASE.length);
  ok('11. e cada opcao do dropdown devolve o mesmo numero que ela promete',
    montaOpcoes(BASE).nomes.every(n => filtra(BASE, n).length === montaOpcoes(BASE).cont[n]));
}

// ══════════ 3. O DEFEITO ANTIGO, RECONSTITUIDO ══════════
// Prova de que a correcao era necessaria: com o filtro comparando contra `c.fornecedor`
// (codigo) e o dropdown entregando id/nome, o resultado era zero.
{
  const filtroAntigo = (cots, f) => cots.filter(c => (!f || c.fornecedor === f));
  ok('12. *** o filtro ANTIGO, recebendo o nome, devolvia ZERO linhas ***',
    filtroAntigo(BASE, 'MCW').length === 0, filtroAntigo(BASE, 'MCW').length);
  ok('13. ...e o novo devolve 1 pro mesmo input', filtra(BASE, 'MCW').length === 1);
  // "SANTA CRUZ" casava por coincidencia (codigo == nome). Era o unico caso que funcionava,
  // e e por isso que o defeito passou despercebido: alguem testou justo com um desses.
  ok('14. o antigo acertava SO onde codigo e nome sao iguais (a coincidencia que escondia o bug)',
    filtroAntigo(BASE, 'SANTA CRUZ').length === 3, filtroAntigo(BASE, 'SANTA CRUZ').length);
}

// ══════════ 4. LINHA SEM fornecedor_nome NAO SOME ══════════
// O banco tem linhas antigas sem a coluna preenchida; o _normFornNome cobre na carga, mas o
// filtro nao pode depender disso pra nao sumir com linha se a normalizacao falhar.
{
  const comBuraco = BASE.concat([{ fornecedor: '1', produto: 'ITEM SEM NOME' }]);
  ok('15. linha sem fornecedor_nome cai em FPMED (default), nao desaparece',
    filtra(comBuraco, 'FPMED').length === 3, filtra(comBuraco, 'FPMED').length);
  ok('16. e ela aparece no dropdown dentro da contagem de FPMED', montaOpcoes(comBuraco).cont['FPMED'] === 3);
}

// ══════════ 5. A TELA ESTA MESMO USANDO ISTO ══════════
{
  ok('17. existe a funcao que monta o filtro a partir das cotacoes', /function preencherFiltroFornecedor\s*\(/.test(src));
  ok('18. o filtro casa por fornecedor_nome, nao mais por c.fornecedor',
    /\(!f \|\| \(c\.fornecedor_nome \|\| 'FPMED'\) === f\)/.test(src));
  ok('19. ...e o `c.fornecedor === f` antigo saiu de vez', !/!f \|\| c\.fornecedor === f/.test(src));
  // >>> Achado no ar em 05/08: eu tinha posto a remontagem em carregarCotacoes(), e o
  //     recarregarCotacoes() -- que e o caminho do showPage e do auto-refresh de 60s -- NAO
  //     passa por la. O dropdown continuava com "Todos fornecedores" e mais nada.
  //     O lugar certo e o _puxarCotacoes: e o unico ponto por onde TODA carga passa.
  ok('20. *** o filtro e remontado dentro do _puxarCotacoes (o unico ponto por onde toda carga passa) ***',
    /function _puxarCotacoes\(\)[\s\S]{0,900}preencherFiltroFornecedor\(\)/.test(src));
  ok('20b. ...e protegido por try/catch (falha ao montar filtro nao pode derrubar a carga)',
    /try \{ preencherFiltroFornecedor\(\); \} catch/.test(src));
  ok('21. o FORMULARIO de nova cotacao continua vindo da tabela fornecedores (precisa do codigo p/ gravar)',
    /getElementById\('cot-fornecedor'\)[\s\S]{0,300}fornecedores\.map/.test(src));
  ok('22. a escolha do usuario e preservada entre recargas', /const sel = s\.value;/.test(src));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
