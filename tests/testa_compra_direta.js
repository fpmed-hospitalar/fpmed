// SUITE testa_compra_direta — O SINAL DE "COMPRAR DIRETO" TEM QUE VIR DE DADO QUE EXISTE.
//
// A tela da Global ranqueia fabricantes pelo HISTORICO DE COMPRA. A FPMED nao tem esse dado --
// a tabela `compras` esta vazia. Portar o patch daria uma tela sem uma linha, e uma tela vazia
// nao e "pronta pra quando o dado chegar": e uma tela que ninguem abre duas vezes.
//
// PORTOU-SE A IDEIA, NAO A CONSULTA (regra do SYNC_GLOBAL.md pros arquivos de porte manual).
// O sinal sai das 7.195 linhas de cotacao de distribuidor, com 473 fabricantes e zero sem
// marca (medido em 05/08).
//
// >>> E POR ISSO A TELA PRECISA DIZER O QUE O NUMERO E. Ele NAO e "quanto compramos da EMS",
//     e "quanto do nosso catalogo passa pela EMS via distribuidor". Quem ler como historico de
//     compra tira conclusao errada -- e essa suite guarda o aviso na tela, nao so o calculo.
//
//   node tests/testa_compra_direta.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');
function fn(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + nome + '\\s*\\(').exec(src);
  if (!m) throw new Error('nao achei function ' + nome);
  let i = src.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < src.length; j++) { if (src[j] === '{') n++; else if (src[j] === '}') { n--; if (!n) return src.slice(m.index, j + 1); } }
  throw new Error('chave nao fechou: ' + nome);
}
function konst(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:var|const|let)\\s+' + nome + '\\s*=[^;]*;').exec(src);
  if (!m) throw new Error('nao achei const ' + nome); return m[0];
}
const ctx = (new Function(`var cotacoes = [];
  ${konst('_CMP_CALIBRE')} ${konst('_CMP_UND_UNITARIA')} ${konst('_CMP_UND_AGREGADORA')} ${konst('_CMP_UM_DECLARADO')}
  ${konst('_GM_SAL_RE')}
  ${fn('doseKey')} ${fn('_gmNorm')} ${fn('_undNum')} ${fn('_qtdDoNome')} ${fn('_semCalibre')} ${fn('qtdEmbalagem')} ${fn('cmpUnitario')}
  ${fn('cdirChave')} ${fn('cdirRanking')}
  return { cdirChave, cdirRanking, setCot: function(a){ cotacoes = a; } };`))();
const { cdirChave, cdirRanking, setCot } = ctx;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_compra_direta — o ranking de fabricantes\n');

const L = (forn, marca, produto, unit, tipo) =>
  ({ fornecedor: forn, marca, produto, compra_unit: unit, und: 'UN', tipo: tipo||'fornecedor' });

// ══════════ 1. SPREAD — o sinal que aponta DINHEIRO ══════════
// O mesmo produto+marca variando de preco entre distribuidores e a margem que o intermediario
// esta capturando. E o unico dos tres sinais que diz quanto ha em jogo.
{
  setCot([
    L('A','EMS','OMEPRAZOL 20MG', 10),
    L('B','EMS','OMEPRAZOL 20MG', 15),          // +50% sobre o menor
  ]);
  const r = cdirRanking();
  ok('1. *** spread de 10 -> 15 e 50% ***', Math.abs(r[0].spread - 50) < 0.01, r[0]);
  ok('2. conta 1 item', r[0].itens === 1, r[0].itens);
  ok('3. e 2 distribuidores', r[0].forns === 2, r[0].forns);
  ok('4. e diz em quantos produtos o spread foi medido', r[0].comSpread === 1, r[0].comSpread);
}
{
  // produto com UM distribuidor so nao entra no spread. Contar 0% ali diluiria a media de quem
  // realmente varia -- e o ranking passaria a premiar quem tem pouca cobertura.
  setCot([
    L('A','EMS','OMEPRAZOL 20MG', 10),
    L('B','EMS','OMEPRAZOL 20MG', 15),
    L('A','EMS','DIPIRONA 500MG', 5),           // so um distribuidor: fora do spread
  ]);
  const r = cdirRanking();
  ok('5. *** produto com 1 distribuidor nao dilui o spread ***', Math.abs(r[0].spread - 50) < 0.01, r[0].spread);
  ok('6. ...mas ele CONTA nos itens (a dependencia existe)', r[0].itens === 2, r[0].itens);
  ok('7. ...e o spread declara que foi medido em 1 produto so', r[0].comSpread === 1, r[0].comSpread);
}
{
  // marca sem nenhum produto com 2 distribuidores: spread null, nao zero. Zero diria "nao ha
  // margem em jogo", quando a verdade e "nao da pra saber".
  setCot([ L('A','TEUTO','X 1G', 4), L('A','TEUTO','Y 2G', 6) ]);
  const r = cdirRanking();
  ok('8. *** sem par de precos, spread e null e nao 0 ***', r[0].spread === null, r[0].spread);
}

// ══════════ 2. O QUE NÃO ENTRA NO RANKING ══════════
{
  setCot([
    L('1','EMS','OMEPRAZOL 20MG', 10),                       // estoque proprio
    L('A','EMS','OMEPRAZOL 20MG', 12, 'industria'),          // ja e industria
    L('B','EMS','OMEPRAZOL 20MG', 20),
    L('C','EMS','OMEPRAZOL 20MG', 22),
  ]);
  const r = cdirRanking();
  ok('9. *** estoque proprio (fornecedor 1) fica de fora: nao ha intermediario ***', r[0].forns === 2, r[0].forns);
  ok('10. *** quem JA e industria fica de fora: ja compramos direto ***',
    Math.abs(r[0].spread - 10) < 0.01, r[0].spread);   // 20 -> 22 = 10%, sem o 12 da industria
}
{
  // linha sem marca nao vira fabricante "vazio"
  setCot([ L('A','','X', 10), L('B','','X', 20), L('A','EMS','Y', 5), L('B','EMS','Y', 6) ]);
  const r = cdirRanking();
  ok('11. linha sem marca nao entra', r.length === 1 && r[0].marca === 'EMS', r.map(x=>x.marca));
}
{
  // preco INCERTO (caixa sem pack sabido) nao pode formar spread: comparar caixa com unidade
  // daria um spread inventado de milhares por cento
  setCot([
    { fornecedor:'A', marca:'EMS', produto:'DIPIRONA CX', und:'CX', compra_caixa: 470 },   // incerto
    { fornecedor:'B', marca:'EMS', produto:'DIPIRONA CX', und:'AMP', compra_unit: 4.7 },
    L('C','EMS','OUTRO 1G', 10), L('D','EMS','OUTRO 1G', 11),
  ]);
  const r = cdirRanking();
  ok('12. *** preco "conferir emb." nao entra no spread (evitaria um spread de 9.900%) ***',
    Math.abs(r[0].spread - 10) < 0.01, r[0].spread);
}

// ══════════ 3. AGREGAÇÃO POR MARCA ══════════
{
  setCot([
    L('A','EMS','P1', 10), L('B','EMS','P1', 12),      // 20%
    L('A','EMS','P2', 10), L('B','EMS','P2', 14),      // 40%
  ]);
  const r = cdirRanking();
  ok('13. o spread da marca e a MEDIA dos spreads dos produtos', Math.abs(r[0].spread - 30) < 0.01, r[0].spread);
  ok('14. distribuidores contam distinto entre produtos', r[0].forns === 2, r[0].forns);
  ok('15. e o preco medio sai dos precos, nao dos spreads', Math.abs(r[0].precoMedio - 11.5) < 0.01, r[0].precoMedio);
}
{
  setCot([ L('A','ems','P1', 10), L('B','EMS ','P1', 12) ]);
  const r = cdirRanking();
  ok('16. marca casa sem depender de caixa/espaco ("ems" e "EMS " sao a mesma)', r.length === 1, r.map(x=>x.marca));
}

// ══════════ 4. A HONESTIDADE NA TELA ══════════
// O aviso nao e enfeite: sem ele o numero vira "historico de compra" na cabeca de quem le.
{
  ok('17. *** a tela avisa que NAO e historico de compra ***', /NÃO é histórico de compra/.test(src));
  ok('18. ...e diz o que o numero E de fato', /catálogo de cotações/.test(src));
  ok('19. ...e que a tabela de compras esta vazia', /compras da FPMED ainda está vazia/.test(src));
  ok('20. o motivo do porte adaptado esta no codigo', /PORTADO É A IDEIA, NÃO A CONSULTA/.test(src));
}

// ══════════ 4B. COLISAO DE NOMES — o defeito que esta suite pegou ══════════
// Eu batizei tudo com prefixo `cd` (compra direta). So que `cd` JA E da tela Clientes &
// Oportunidades (cd = clientes dash), e function declarations em escopo global se sobrescrevem:
// as MINHAS cdChave/cdInit/cdRender apagaram as DELA. A tela de Clientes teria quebrado calada
// -- nao da erro, so passa a chamar a funcao errada. Prefixo agora e `cdir`.
{
  const declaradas = [...src.matchAll(/function (cd[A-Za-z]+)\s*\(/g)].map(m => m[1]);
  const dup = declaradas.filter((n, i) => declaradas.indexOf(n) !== i);
  ok('20b. *** nenhuma funcao cd* declarada duas vezes (o prefixo `cd` ja era da tela de Clientes) ***',
    dup.length === 0, dup);
  ok('20c. as funcoes da compra direta usam prefixo cdir', /function cdirRanking\s*\(/.test(src) && /function cdirInit\s*\(/.test(src));
  ok('20d. e a tela de Clientes manteve as dela', /function cdInit\s*\(/.test(src) && /function cdRender\s*\(/.test(src));
  ok('20e. o showPage chama a init CERTA de cada uma',
    /'clientes-dash'\) \{ cdInit\(\)/.test(src) && /'compra-direta'\) \{ cdirInit\(\)/.test(src));
  // ids tambem: getElementById nao avisa quando pega o elemento da outra tela
  const ids = [...src.matchAll(/id="(cdir?-[a-z-]+)"/g)].map(m => m[1]);
  const dupIds = ids.filter((n, i) => ids.indexOf(n) !== i);
  ok('20f. e nenhum id duplicado entre as duas telas', dupIds.length === 0, dupIds);
}

// ══════════ 5. A TELA ESTÁ LIGADA E PROTEGIDA ══════════
{
  ok('21. existe o item de menu', /id="nav-compra-direta"/.test(src));
  ok('22. e a pagina', /id="page-compra-direta"/.test(src));
  ok('23. *** some pra quem nao e gestor (e inteligencia comercial, nao referencia) ***',
    /'competitividade','licitacoes','compra-direta'/.test(src));
  ok('24. o DDL restringe a LEITURA a gestor (diferente da CMED, que todo logado le)',
    /create policy cti_sel[^;]*using \(public\.cargo_gestor\(\)\)/.test(
      fs.readFileSync(path.join(__dirname, '..', 'ddl', 'contatos_industria.sql'), 'utf8')));
  ok('25. uma marca = um contato (dois cadastros viram duas conversas com o mesmo fabricante)',
    /unique index[^;]*contatos_industria_marca_uk/.test(
      fs.readFileSync(path.join(__dirname, '..', 'ddl', 'contatos_industria.sql'), 'utf8')));
  ok('26. o texto de abordagem comeca com NUMERO, nao com "voces vendem direto?"',
    /Trabalhamos hoje com \$\{itens\} itens/.test(src));
  ok('27. ...e a tela sobrevive a quem nao pode ler os contatos (nao-gestor)',
    /catch\(e\)\{ _cdContatos = \[\]; \}/.test(src));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
