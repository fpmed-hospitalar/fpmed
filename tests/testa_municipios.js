// SUITE testa_municipios — A BASE GEOGRAFICA DO RADAR (modulo 2.5, 08/08/2026)
//
// O Radar responde "quais cidades num raio de N km daqui tem licitacao aberta com este termo?".
// Sem um ponto por municipio ele nao existe -- e um ponto ERRADO e pior que ponto nenhum: manda
// o vendedor pro lado errado do estado com cara de precisao.
//
// O QUE ESTA SUITE PROTEGE:
//   1. O PONTO E CENTROIDE DE AREA, nao media de vertices. A media puxa o ponto pra onde o
//      desenho tem mais detalhe -- num municipio com litoral recortado e sertao reto, ela cai
//      no litoral.
//   2. MULTIPOLIGONO FICA COM O MAIOR ANEL. Municipio com ilha nao pode ter o ponto na ilha.
//   3. ANEL DEGENERADO NAO VIRA PONTO INVENTADO. Area zero devolve null, e o municipio fica
//      sem coordenada -- que o Radar declara, em vez de posicionar errado.
//   4. A CHAVE E O CODIGO IBGE, nao o nome: "Bom Jesus" existe em 5 estados.
//
//   node tests/testa_municipios.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');

const loader = ler('tools/carrega_municipios.js');
const ddl = ler('ddl/municipios.sql').replace(/--[^\n]*/g, '');

// extrai as funcoes REAIS de geometria do loader e roda contra formas conhecidas
const geo = new Function(loader.slice(loader.indexOf('function centroideAnel'),
                                     loader.indexOf('async function pega'))
  + '; return { centroideAnel, pontoDaGeometria };')();
const { centroideAnel, pontoDaGeometria } = geo;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;
console.log('SUITE testa_municipios — um ponto por cidade, e o ponto certo\n');

// ══════════ 1. O CENTROIDE, CONTRA FORMAS CONHECIDAS ══════════
{
  // quadrado 0..10: centroide exato no meio
  const quad = [[0,0],[10,0],[10,10],[0,10],[0,0]];
  const c = centroideAnel(quad);
  ok('1. quadrado 10x10 -> centro em (5,5)', perto(c[0],5) && perto(c[1],5), c);

  // >>> O CASO QUE JUSTIFICA A FORMULA: um quadrado com MUITOS vertices num lado so.
  //     A media dos vertices seria puxada pro lado detalhado; o centroide de area, nao.
  const denso = [[0,0]];
  for(let x = 0; x <= 10; x += 0.5) denso.push([x, 0]);        // borda de baixo cheia de pontos
  denso.push([10,10],[0,10],[0,0]);
  const cd = centroideAnel(denso);
  const mediaX = denso.reduce((s,v)=>s+v[0],0)/denso.length;
  const mediaY = denso.reduce((s,v)=>s+v[1],0)/denso.length;
  ok('2. *** centroide de area ignora o excesso de vertices num lado ***',
    perto(cd[0],5,0.01) && perto(cd[1],5,0.01), cd);
  ok('3. ...e a MEDIA DOS VERTICES erraria (era esse o viés)', Math.abs(mediaY - 5) > 1, {mediaX, mediaY});

  ok('4. area zero devolve null (ponto inventado seria pior que ponto nenhum)',
    centroideAnel([[1,1],[1,1],[1,1],[1,1]]) === null);
}

// ══════════ 2. MULTIPOLIGONO: O MAIOR ANEL ══════════
{
  const continente = [[0,0],[10,0],[10,10],[0,10],[0,0]];       // area 100
  const ilha       = [[100,100],[101,100],[101,101],[100,101],[100,100]];  // area 1
  const pt = pontoDaGeometria({ type:'MultiPolygon', coordinates:[[ilha],[continente]] });
  ok('5. *** multipoligono fica com o MAIOR anel (ilha nao rouba o ponto) ***',
    perto(pt[0],5,0.01) && perto(pt[1],5,0.01), pt);
  const pp = pontoDaGeometria({ type:'Polygon', coordinates:[continente] });
  ok('6. poligono simples funciona', perto(pp[0],5) && perto(pp[1],5));
  ok('7. geometria ausente ou vazia nao estoura',
    pontoDaGeometria(null) === null && pontoDaGeometria({type:'Polygon',coordinates:[[[0,0],[1,1]]]}) === null);
  ok('8. devolve [lon, lat] — a ordem do GeoJSON (trocar poria o Brasil na Somália)',
    /GeoJSON é x,y/.test(loader));
}

// ══════════ 3. A FONTE E A CHAVE ══════════
ok('9. *** a fonte e o IBGE nas duas pontas (nome e malha) ***',
  /servicodados\.ibge\.gov\.br\/api\/v1\/localidades\/municipios/.test(loader)
  && /servicodados\.ibge\.gov\.br\/api\/v3\/malhas\/estados/.test(loader));
ok('10. *** a chave e o codigo IBGE, nao o nome ***',
  /codigo_ibge\s+integer primary key/.test(ddl) && /on_conflict=codigo_ibge/.test(loader));
ok('11. guarda o nome normalizado (a busca casa "uruacu" com "Uruaçu")', /nome_norm\s+text not null/.test(ddl));
ok('12. guarda a REGIAO (o boletim agrupa por região, seção 8.1 da spec)', /regiao\s+text/.test(ddl));
ok('13. usa `qualidade=minima` (precisamos de um ponto, não do contorno)', /qualidade=minima/.test(loader));
ok('14. baixa UMA UF POR VEZ (falha custa uma UF, não o país)', /malhas\/estados\/\$\{idUF\[uf\]\}/.test(loader));
ok('15. tenta de novo antes de desistir (o IBGE recusa em rajada)', /async function pega\(url, tentativas = 3\)/.test(loader));

// ══════════ 4. PREVIA ANTES DE GRAVAR, E RLS ══════════
ok('16. *** prévia por padrão; só grava com --apply (a regra do projeto) ***',
  /const APLICAR = process\.argv\.includes\('--apply'\)/.test(loader) && /PRÉVIA\. Nada foi gravado/.test(loader));
ok('17. o resumo declara quantos ficaram SEM coordenada', /SEM coordenada/.test(loader));
ok('18. RLS ligada e anon revogado',
  /alter table public\.municipios enable row level security/.test(ddl) && /revoke all on public\.municipios from anon/.test(ddl));
ok('19. *** ninguém escreve pela API: só policy de SELECT ***',
  /create policy mun_sel on public\.municipios for select/.test(ddl)
  && !/municipios for insert/.test(ddl) && !/municipios for update/.test(ddl));
ok('20. índice para o filtro geográfico (varrer 5.570 com trigonometria a cada busca é caro à toa)',
  /municipios_geo_idx  on public\.municipios \(lat, lon\)/.test(ddl));
ok('21. *** o DDL declara que o ponto é CENTROIDE e não a SEDE (não vender precisão que não tem) ***',
  /SÃO O CENTROIDE DA ÁREA, NÃO A SEDE/.test(ler('ddl/municipios.sql')));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
