// SUITE testa_meus_arquivos — "MEUS ARQUIVOS" DO NEGOCIO (fatia B15, 14/08/2026).
//
// == O PEDIDO ==================================================================
// Antigo, da pilha do SigaPregao: *todos os documentos daquele certame num lugar
// so, agrupados por CATEGORIA (edital e anexos · proposta · habilitacao · ata ·
// recurso · outros), cada categoria empilhando VERSOES.*
//
// == A REGRA DE PROJETO QUE ESTA SUITE EXISTE PRA TRAVAR =======================
// A caixa foi explicita: *"NAO criar um segundo lugar de guardar arquivo. Se hoje
// ha mais de um, unifique a VISAO sem migrar dado (aditivo)."* Entao aqui se prova
// que "Meus arquivos" e uma VISAO:
//   1. nenhuma tabela nova — grava no MESMO `negocio_anexos`;
//   2. anexar chama o MESMO `subirAnexo` das outras tres telas;
//   3. o DDL desta fatia so TROCA UM CHECK (nada de drop table/column);
//   4. e nada e migrado: o que estava em `proposta` continua em `proposta`.
//
// == E AS TRES PROCEDENCIAS NAO VALEM A MESMA COISA ============================
// Numa impugnacao, "o edital que eu baixei do PNCP" e "o edital que alguem me
// mandou" sao argumentos diferentes. A etiqueta nao e enfeite.
//
//   node tests/testa_meus_arquivos.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const HTML = R('fpmed_negocios.html');
const DDL = R('ddl', 'anexos_habilitacao_recurso.sql');
const DDL_BASE = R('ddl', 'negocio_anexos.sql');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_meus_arquivos — todo o papel do certame num lugar so (fatia B15)\n');

// ══════════ 0. AS PECAS PURAS, ARRANCADAS DO HTML E EXECUTADAS ══════════
const fCat = (HTML.match(/const CAT_NOMES = \{[\s\S]*?\n\};/) || [])[0];
const fGav = (HTML.match(/const ARQ_GAVETAS = \[[\s\S]*?\n\];/) || [])[0];
const fGaveta = (HTML.match(/const gavetaDaCategoria = [^\n]+/) || [])[0];
const fUni = (HTML.match(/function unificaArquivos\(doNegocio, doPncp, daEmpresa\)\{[\s\S]*?\n\}/) || [])[0];
/* A busca por "document" solto reprovava a funcao CERTA: ela fala de "documento do certame" e
   "documento da empresa" nas frases que a tela mostra. O que se quer proibir e o USO do DOM —
   entao o assert pergunta por `document.`, `fetch(` e `window.`, que e o que uma funcao impura
   escreveria. Assert que reprova o certo ensina a desligar o teste. */
ok(n + '. (controle) as quatro pecas da fatia foram encontradas e sao puras',
  !!fCat && !!fGav && !!fGaveta && !!fUni
  && !/\bdocument\.|\bfetch\(|\bwindow\./.test(fUni)); n++;
if (!fCat || !fGav || !fGaveta || !fUni) { console.log('\nRESULTADO: ' + p + ' ok, ' + (f + 1) + ' falha(s)'); process.exit(1); }
const cabeca = fCat + '\n' + fGav + '\n' + fGaveta
  + "\nconst nomeCat = k => CAT_NOMES[k] || k;\n" + fUni + '\n';
const API = new Function(cabeca + 'return { CAT_NOMES, ARQ_GAVETAS, gavetaDaCategoria, unificaArquivos };')();

// ══════════ 1. AS SEIS GAVETAS SAO AS QUE O DONO NOMEOU, NESTA ORDEM ══════════
/* A ordem e a do processo: o edital chega, a proposta vai, a habilitacao e conferida, a ata sai,
   o recurso (quando ha) vem depois. Ordem alfabetica poria "Recurso" antes de "Proposta". */
ok(n + '. *** as seis gavetas do pedido, na ordem do processo ***',
  JSON.stringify(API.ARQ_GAVETAS.map(g => g.n))
  === JSON.stringify(['Edital e anexos', 'Proposta', 'Habilitação', 'Ata', 'Recurso', 'Outros']),
  API.ARQ_GAVETAS.map(g => g.n)); n++;

// ══════════ 2. NENHUMA CATEGORIA DO BANCO FICA ORFA ══════════
/* O CHECK do banco e a lista de verdade. Categoria que existe la e nao cai em gaveta nenhuma e
   arquivo que o negocio tem e a tela nao mostra — a pior falha possivel nesta fatia. */
const doCheck = [...(DDL.match(/'\w+'/g) || [])].map(s => s.replace(/'/g, ''))
  .filter(c => !['negocio_anexos_categoria_check'].includes(c));
const cats = [...new Set(doCheck)].filter(c => /^[a-z_]+$/.test(c));
ok(n + '. (controle) li as categorias do CHECK do banco', cats.length >= 12, cats.length); n++;
const orfas = cats.filter(c => !API.ARQ_GAVETAS.some(g => g.cats.indexOf(c) >= 0));
ok(n + '. *** toda categoria do banco cai numa gaveta — nenhuma some da tela ***',
  orfas.length === 0, orfas); n++;
ok(n + '. *** e toda categoria tem NOME em portugues (nunca o valor cru na tela) ***',
  cats.every(c => API.CAT_NOMES[c] && API.CAT_NOMES[c] !== c),
  cats.filter(c => !API.CAT_NOMES[c])); n++;
/* Categoria futura, criada por outra janela, tem que APARECER — em "Outros", se for preciso.
   Sumir seria a tela decidindo que um arquivo do negocio nao existe. */
ok(n + '. *** categoria que a tela ainda nao conhece cai em "Outros", e nao some ***',
  API.gavetaDaCategoria('algo_que_inventarem_depois') === 'outros'); n++;

// ══════════ 3. AS TRES PROCEDENCIAS ══════════
const doNeg = [{ categoria: 'proposta', arquivo_nome: 'proposta.pdf', versao: 1, enviado_em: '2026-08-01T10:00:00Z', enviado_por: 'a@b.com', bytes: 2048, arquivo_path: 'negocio-1/proposta/x.pdf' }];
const doPncp = [{ titulo: 'Edital 7/2026', tipo: 'Edital', url_pncp: 'https://pncp.gov.br/x.pdf', bytes: 90000, texto_chars: 71105, coletado_em: '2026-08-14T10:00:00Z' }];
const daEmp = [{ id: 9, nome: 'CND Federal', tipo: 'certidao', validade: '2026-12-01', situacao: 'ok', arquivo_path: 'doc/cnd.pdf', arquivo_nome: 'cnd.pdf', arquivo_bytes: 1024, criado_em: '2026-07-01T10:00:00Z' }];
const u = API.unificaArquivos(doNeg, doPncp, daEmp);
ok(n + '. *** as tres fontes entram na MESMA lista ***', u.length === 3, u.length); n++;
ok(n + '. *** e cada uma diz de onde veio ***',
  u.map(x => x.de).sort().join(',') === 'empresa,mao,pncp', u.map(x => x.de)); n++;
ok(n + '. *** o arquivo do PNCP cai em "Edital e anexos" ***',
  u.find(x => x.de === 'pncp').gaveta === 'edital'); n++;
/* O LINK DO PNCP E O ORIGINAL, NUNCA REESCRITO (contrato A5, secao 4): ele e a prova de onde o
   documento veio, e um link nosso por cima disso seria uma copia sem procedencia. */
ok(n + '. *** e ele guarda o link ORIGINAL do portal, nao um caminho nosso ***',
  u.find(x => x.de === 'pncp').url === 'https://pncp.gov.br/x.pdf'
  && !u.find(x => x.de === 'pncp').path); n++;
/* A CATEGORIA DO ARQUIVO DO PNCP E A PALAVRA DO ORGAO. "Termo de Referencia" e mais preciso que
   a nossa gaveta, e e o que esta publicado. */
ok(n + '. *** a categoria mostrada do arquivo do PNCP e o `tipo` que o PNCP publicou ***',
  u.find(x => x.de === 'pncp').rotuloCat === 'Edital'
  && API.unificaArquivos([], [{ tipo: 'Termo de Referência', titulo: 'TR' }], [])[0].rotuloCat === 'Termo de Referência'); n++;
ok(n + '. *** e um TR cai como `anexo_edital`, nao como `edital` (o botao de ler precisa saber qual e) ***',
  API.unificaArquivos([], [{ tipo: 'Termo de Referência', titulo: 'TR' }], [])[0].categoria === 'anexo_edital'
  && u.find(x => x.de === 'pncp').categoria === 'edital'); n++;
ok(n + '. *** o documento da empresa cai em Habilitacao, com a validade junto ***',
  u.find(x => x.de === 'empresa').gaveta === 'habilitacao'
  && u.find(x => x.de === 'empresa').validade === '2026-12-01'); n++;
ok(n + '. *** e a tela avisa que ele vale para TODOS os certames ***',
  /vale para todos os certames/.test(HTML)); n++;

// ══════════ 4. AS VERSOES EMPILHAM, E A ANTIGA FICA ══════════
/* A `versao` sai de TRIGGER por (negocio, categoria) — nao da tela. E nao ha policy de UPDATE
   nem de DELETE. "Nunca sobrescrever" e um numero que o banco calcula. */
const tres = API.unificaArquivos([
  { categoria: 'habilitacao', arquivo_nome: 'a.pdf', versao: 1 },
  { categoria: 'habilitacao', arquivo_nome: 'b.pdf', versao: 3 },
  { categoria: 'habilitacao', arquivo_nome: 'c.pdf', versao: 2 },
], [], []);
ok(n + '. *** nenhuma versao se perde: as tres continuam na lista ***', tres.length === 3); n++;
/* A MAIS NOVA SAI DA MAIOR VERSAO, e nao da posicao na lista: o `order` do banco poderia mudar
   num refactor e a marca passaria a apontar a versao errada sem nada quebrar. */
ok(n + '. *** a "mais nova" e a de MAIOR versao, e nao a primeira da lista ***',
  tres.filter(x => x.maisNova).length === 1
  && tres.find(x => x.maisNova).versao === 3, tres.map(x => [x.versao, x.maisNova])); n++;
/* Versao empilha POR CATEGORIA. Se a conta fosse por gaveta, o "v1" da Ata e o "v1" do Contrato
   pareceriam duas versoes do mesmo documento — e eles nao sao nem o mesmo papel. */
const duasCats = API.unificaArquivos([
  { categoria: 'ata', arquivo_nome: 'ata.pdf', versao: 1 },
  { categoria: 'contrato', arquivo_nome: 'ct.pdf', versao: 1 },
  { categoria: 'contrato', arquivo_nome: 'ct2.pdf', versao: 2 },
], [], []);
ok(n + '. *** a versao empilha POR CATEGORIA, e nao por gaveta ***',
  duasCats.find(x => x.categoria === 'ata').maisNova === true
  && duasCats.filter(x => x.categoria === 'contrato' && x.maisNova).length === 1
  && duasCats.find(x => x.categoria === 'contrato' && x.maisNova).versao === 2); n++;
ok(n + '. *** e as duas caem na MESMA gaveta (Ata), porque e ali que se procura ***',
  duasCats.every(x => x.gaveta === 'ata')); n++;
ok(n + '. *** arquivo sem versao (PNCP, empresa) nao e marcado como "antigo" ***',
  u.filter(x => x.versao == null).every(x => x.maisNova === true)); n++;
ok(n + '. *** e a versao antiga aparece apagada, dizendo que nada se apaga ***',
  /versão anterior — nada se apaga/.test(HTML) && /\.arq-l\.velha\{opacity/.test(HTML)); n++;

// ══════════ 5. LISTAS VAZIAS E FONTE QUE FALHA ══════════
ok(n + '. *** sem nada, a lista e vazia (e nao estoura) ***',
  API.unificaArquivos([], [], []).length === 0
  && API.unificaArquivos(null, null, null).length === 0); n++;
/* UMA FONTE QUE CAI NAO APAGA AS OUTRAS. Se a leitura do PNCP falhar, os anexos a mao continuam
   na tela — e o aviso diz QUAL fonte faltou. "Nao consegui ler" nunca vira "nao existe". */
ok(n + '. *** as tres leituras sao independentes e cada uma guarda a propria falha ***',
  /ARQ_FALHAS\.push\('os arquivos anexados aqui/.test(HTML)
  && /ARQ_FALHAS\.push\('os arquivos baixados do PNCP/.test(HTML)
  && /ARQ_FALHAS\.push\('os documentos da empresa/.test(HTML)); n++;
ok(n + '. *** e "nao consegui ler" nao vira "nao existe" ***',
  /não<\/b> quer dizer que esses arquivos não existam/.test(HTML)); n++;
ok(n + '. *** o aviso da falha vem ANTES da lista (lista curta tem duas explicacoes) ***',
  /box\.innerHTML = aviso \+ html/.test(HTML) && /box\.innerHTML = aviso \+ '<div class="salvo">Nenhum arquivo/.test(HTML)); n++;
/* Sem empresa no negocio nao se le documento nenhum: mostrar os de todas poria a certidao de
   uma empresa na ficha da outra. */
ok(n + '. *** documento da empresa so e lido quando o negocio TEM empresa ***',
  /if\(!n\.empresa_id\) return;/.test(HTML)); n++;

// ══════════ 6. E UMA VISAO, NAO UM SEGUNDO LUGAR DE GUARDAR ══════════
const blocoB15 = (HTML.match(/const ARQ_GAVETAS = \[[\s\S]*?\n\}\n\nfunction carregarRastro|const ARQ_GAVETAS = \[[\s\S]*?anexarEmMeusArquivos[\s\S]*?\n\}/) || [])[0] || '';
ok(n + '. (controle) o bloco da fatia foi recortado', blocoB15.length > 2000, blocoB15.length); n++;
ok(n + '. *** anexar daqui usa o MESMO `subirAnexo` das outras tres telas ***',
  /const r = await subirAnexo\(id, arqs\[i\], cat\);/.test(blocoB15)); n++;
/* Nenhuma tabela nova nasceu. Se um dia alguem criar `meus_arquivos`, este assert reprova. */
ok(n + '. *** nenhuma tabela nova: a tela le negocio_anexos, licitacao_arquivos e documentos ***',
  /rest\/v1\/negocio_anexos\?negocio_id/.test(blocoB15)
  && /rest\/v1\/licitacao_arquivos/.test(blocoB15)
  && /rest\/v1\/v_documentos_situacao/.test(blocoB15)
  && !/meus_arquivos|arquivos_negocio/.test(blocoB15.replace(/carregarMeusArquivos|pintaMeusArquivos|anexarEmMeusArquivos|MEUS ARQUIVOS|Meus arquivos/g, ''))); n++;
/* As abas antigas releem junto: elas leem o MESMO `negocio_anexos`. Sem isso, anexar um edital
   por aqui o deixaria invisivel na aba Informacoes ate fechar e abrir a gaveta — e a pessoa
   anexaria de novo, achando que errou o lugar. */
ok(n + '. *** anexar aqui rele as outras abas (elas leem a mesma tabela) ***',
  /carregarEdital\(id\); carregarProposta\(id\); carregarAta\(id\);/.test(blocoB15)); n++;

// ══════════ 7. O DDL E ADITIVO ══════════
ok(n + '. *** o DDL desta fatia so TROCA o CHECK — nada de drop table/column ***',
  /drop constraint if exists negocio_anexos_categoria_check/.test(DDL)
  && /add constraint negocio_anexos_categoria_check/.test(DDL)
  && !/drop table|drop column|delete from|truncate/i.test(DDL)); n++;
ok(n + '. *** e a regra nova aceita tudo que a antiga aceitava ***',
  (() => {
    const antigas = [...new Set((DDL_BASE.match(/'\w+'/g) || []).map(s => s.replace(/'/g, '')))]
      .filter(c => /^(proposta|ata|contrato|proposta_final|ata_sessao|itens_ganhos|retorno_precos)$/.test(c));
    return antigas.length === 7 && antigas.every(c => DDL.includes("'" + c + "'"));
  })()); n++;
ok(n + '. *** as tres novas sao habilitacao, recurso e outro ***',
  ["'habilitacao'", "'recurso'", "'outro'"].every(c => DDL.includes(c))); n++;
/* `outro` existe porque o mundo tem documento que nao e nenhum dos cinco. Sem uma gaveta pra ele,
   a pessoa classifica errado de proposito — e ai a categoria passa a mentir sobre TODOS. */
ok(n + '. *** e o DDL explica por que `outro` precisa existir ***',
  /passa a mentir sobre TODOS/.test(DDL)); n++;
ok(n + '. *** a trigger de versao e as policies nao foram tocadas ***',
  !/create trigger|drop policy|create policy|alter table public\.negocio_anexos (?!drop constraint|add constraint)/.test(DDL)); n++;

// ══════════ 8. A ABA EXISTE E TEM CONTADOR ══════════
ok(n + '. *** a aba "Meus arquivos" esta na fileira de abas, com contador ***',
  /\['arq','Meus arquivos','dw-arq-n'\]/.test(HTML) && /id="aba-arq"/.test(HTML)); n++;
ok(n + '. *** e o seletor de categoria e montado das gavetas, com os seis grupos ***',
  /function montaSeletorArquivos\(\)\{/.test(HTML) && /<optgroup label="\$\{esc\(g\.n\)\}">/.test(HTML)); n++;
ok(n + '. *** gaveta vazia nao aparece (seis "nenhum" empurram pra baixo os dois que existem) ***',
  /if\(!daGaveta\.length\) return '';/.test(HTML)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
