// SUITE testa_controle_informado — O NUMERO DO PNCP INFORMADO A MAO (fatia A19, 14/08/2026).
//
// == A DECISAO DO DONO ==========================================================
// 14/08: *"SIM, prepare o caminho — mas barato. Nada de mutirao; quem quiser
// recuperar informa o numero, e o resto segue sozinho."*
//
// == POR QUE ESTA FATIA EXISTE, EM NUMEROS ======================================
// As 105 Atas vieram do Calendario 2025 (uma planilha) e nenhuma tem a chave do
// PNCP. Casar na marra por UF+ano+numero foi MEDIDO duas vezes e errou as duas:
// em 14/08 deu 2 "unicos" e os DOIS eram de cidade errada (Palmeiras de Goias
// casando com Jatai); refeito com o indice ja em 3.876 linhas, as 4 ambiguas
// continuam TODAS de municipio errado. O numero vem de gente, nao de palpite.
//
// == O QUE ESTA SUITE PROTEGE ===================================================
//  1. QUE NINGUEM VOLTE A ADIVINHAR. Nao pode existir, nestes arquivos, caminho
//     que receba UF+ano+numero e devolva um palpite.
//  2. QUE A ESCADA DE CONFERENCIA BLOQUEIE ONDE A MAQUINA TEM RAZAO (formato,
//     existencia, ano) e so AVISE onde ela nao tem (nome de orgao e de municipio
//     sao texto escrito por gente).
//  3. QUE "NAO CONSEGUI PERGUNTAR" NUNCA VIRE "NAO EXISTE". Uma queda do PNCP
//     virando "seu numero esta errado" faria a pessoa apagar um numero certo.
//  4. QUE OS DOIS RUNTIMES DIGAM A MESMA COISA. A logica vive em node (o caminho
//     do operador) e em Deno (a edge que a tela do B chama). Um validador que
//     aceita num lado e recusa no outro e pior que nao ter validador.
//  5. QUE GRAVAR SEJA UM PEDIDO EXPLICITO, e nunca efeito de conferir.
//
//   node tests/testa_controle_informado.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const V = require('../tools/valida_controle_pncp.js');
const NODE = R('tools', 'valida_controle_pncp.js');
const DENO = R('supabase', 'functions', 'valida-controle', 'index.ts');
const CONTRATO = R('docs', 'contrato_itens_editais.md');
const FILA = R('tools', 'fila_resultado_atas.js');
const semJs = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const Nc = semJs(NODE), Dc = semJs(DENO);

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_controle_informado — o numero do PNCP informado a mao (fatia A19)\n');

// ══════════ 1. O FORMATO ══════════
const CERTO = '01640429000106-1-000117/2026';
ok(n + '. *** o numero de controle e lido em CNPJ / sequencial / ano ***',
  JSON.stringify(V.partesControle(CERTO)) === JSON.stringify({ cnpj: '01640429000106', ordem: '1', sequencial: '117', ano: '2026' }),
  V.partesControle(CERTO)); n++;
/* O SEQUENCIAL PERDE OS ZEROS A ESQUERDA, e isso nao e estetica: `000117` na URL devolve 404, e
   404 aqui seria lido como "esta licitacao nao existe" — o erro mais convincente possivel. */
ok(n + '. *** o sequencial sai SEM zeros a esquerda (com eles a URL do PNCP da 404) ***',
  V.partesControle(CERTO).sequencial === '117'); n++;
for (const ruim of ['PE 60/2026', '60/2026', '', null, '0164042900010-1-000117/2026',
                    '01640429000106-1-000117/26', '01640429000106-000117/2026']) {
  ok(n + '. formato recusado: ' + JSON.stringify(ruim), V.partesControle(ruim) === null); n++;
}

// ══════════ 2. A ESCADA: QUEM BLOQUEIA E QUEM SO AVISA ══════════
const base = { partes: V.partesControle(CERTO), existe: true, anoNegocio: 2026,
  orgaoPNCP: 'MUNICIPIO DE PEDRA BONITA', orgaoNegocio: 'MUNICIPIO DE PEDRA BONITA',
  municipioIndice: 'Pedra Bonita', municipioNegocio: 'Pedra Bonita' };

ok(n + '. *** tudo batendo: CONFERE e pode gravar ***',
  (() => { const v = V.veredito(base); return v.ok && v.veredito === 'confere' && v.podeGravar; })()); n++;

const vFmt = V.veredito({ ...base, partes: null });
ok(n + '. *** formato invalido BLOQUEIA... ***', vFmt.veredito === 'formato' && !vFmt.podeGravar); n++;
/* "Numero invalido" nao e mensagem: a pessoa precisa saber o que digitar. */
ok(n + '. ...e a mensagem ENSINA o formato, com exemplo',
  /14 dígitos do CNPJ/.test(vFmt.mensagem) && /03659166002156-1-000034\/2026/.test(vFmt.mensagem)); n++;

const vNao = V.veredito({ ...base, existe: false });
ok(n + '. *** compra inexistente BLOQUEIA... ***', vNao.veredito === 'nao_existe' && !vNao.podeGravar); n++;
ok(n + '. ...e a mensagem nomeia o engano mais provavel (sequencial x numero do edital)',
  /sequencial/.test(vNao.mensagem) && /número do edital/.test(vNao.mensagem)); n++;

/* ══ ESTE E O ASSERT QUE MAIS IMPORTA DA SEGURANCA DESTA FATIA ══════════════════════════════
   "Nao consegui perguntar" e "nao existe" sao respostas OPOSTAS. Com o PNCP fora — que e o
   estado de hoje —, confundir as duas faria o validador dizer "seu numero esta errado" a todo
   mundo, e a pessoa apagaria um numero certo. */
const vSei = V.veredito({ ...base, existe: null });
ok(n + '. *** "nao consegui perguntar" NUNCA vira "nao existe" ***',
  vSei.veredito === 'nao_sei' && !vSei.podeGravar
  && /não quer dizer que ele esteja errado/i.test(vSei.mensagem.replace(/\n/g, ' ')), vSei.mensagem); n++;

const vAno = V.veredito({ ...base, anoNegocio: 2025 });
ok(n + '. *** ano diferente BLOQUEIA (ou e 2025 ou e 2026 — isso nao e opiniao) ***',
  vAno.veredito === 'diverge' && vAno.podeGravar === false && /outro ano/.test(vAno.mensagem)); n++;
/* Negocio antigo sem data nenhuma e justamente a gente que esta fatia veio atender. Bloquear
   por "nao sei o ano" tornaria a recuperacao impossivel para quem mais precisa dela. */
ok(n + '. *** ano DESCONHECIDO nao bloqueia (senao negocio antigo sem data ficava impossivel) ***',
  V.veredito({ ...base, anoNegocio: null }).veredito === 'confere'); n++;

const vOrg = V.veredito({ ...base, orgaoPNCP: 'CAMARA MUNICIPAL DE JATAI' });
/* NOME DE ORGAO E TEXTO ESCRITO POR GENTE. Qualquer regra apertada o bastante pra pegar a
   divergencia de verdade tambem recusaria "PREFEITURA MUNICIPAL DE X" contra "MUNICIPIO DE X" —
   e recusar o numero CERTO de quem digitou certo ensina a pessoa a ignorar o aviso. */
ok(n + '. *** orgao diferente AVISA, mas deixa gravar com confirmacao ***',
  vOrg.veredito === 'diverge' && vOrg.podeGravar === true
  && vOrg.divergencias.some(d => d.campo === 'órgão' && d.bloqueia === false), vOrg.divergencias); n++;
ok(n + '. ...e a mensagem mostra OS DOIS NOMES lado a lado (quem sabe e a pessoa)',
  /CAMARA MUNICIPAL DE JATAI/.test(vOrg.mensagem) && /MUNICIPIO DE PEDRA BONITA/.test(vOrg.mensagem)); n++;
const vMun = V.veredito({ ...base, municipioIndice: 'Jataí' });
ok(n + '. *** municipio diferente AVISA (e foi ele que pegou as duas erradas de 14/08) ***',
  vMun.veredito === 'diverge' && vMun.podeGravar === true
  && vMun.divergencias.some(d => d.campo === 'município')); n++;

// ══════════ 3. A COMPARACAO DE NOME, NOS CASOS QUE IMPORTAM ══════════
/* Os tres primeiros sao a MESMA entidade escrita de tres jeitos. Se a regra reprovasse qualquer
   um deles, o aviso viraria ruido e ninguem mais leria. */
for (const [a, b, esperado, porque] of [
  ['MUNICIPIO DE PEDRA BONITA', 'PREFEITURA MUNICIPAL DE PEDRA BONITA', true, 'mesma entidade, nome mais longo'],
  ['PALMEIRAS DE GOIAS', 'MUNICIPIO DE PALMEIRAS DE GOIAS SECRETARIA MUNICIPAL DE SAUDE', true, 'nome curto dentro do longo'],
  ['MUNICIPIO DE ITABERAI', 'Município de Itaberaí', true, 'acento e caixa nao mudam entidade'],
  ['MUNICIPIO DE PALMEIRAS DE GOIAS', 'CAMARA MUNICIPAL DE JATAI', false, 'a divergencia real de 14/08'],
  ['MUNICIPIO DE MINACU', 'MUNICIPIO DE EDEIA', false, 'a outra divergencia real de 14/08'],
]) {
  ok(n + `. nome "${a.slice(0, 24)}…" x "${b.slice(0, 24)}…" -> ${esperado ? 'bate' : 'NAO bate'} (${porque})`,
    V.nomesBatem(a, b) === esperado, { r: V.nomesBatem(a, b) }); n++;
}
/* SEM NOME DE UM DOS LADOS, A RESPOSTA E `null` = "nao sei". Devolver `false` faria um negocio
   com o campo orgao vazio virar divergencia — e a planilha das Atas tem varios assim. */
ok(n + '. *** sem nome de um dos lados a resposta e "nao sei", e nao "nao bate" ***',
  V.nomesBatem('', 'MUNICIPIO DE X') === null && V.nomesBatem('MUNICIPIO DE X', null) === null); n++;
/* As palavras que TODO orgao publico tem nao distinguem ninguem. Contadas, fariam "MUNICIPIO DE
   X" e "MUNICIPIO DE Y" parecerem 50% iguais — e 50% e exatamente o corte. */
ok(n + '. (controle) as palavras genericas sao descartadas antes de comparar',
  JSON.stringify(V.tokens('PREFEITURA MUNICIPAL DE PEDRA BONITA')) === JSON.stringify(['PEDRA', 'BONITA']),
  V.tokens('PREFEITURA MUNICIPAL DE PEDRA BONITA')); n++;
ok(n + '. (controle) e sozinhas elas nao casam nada',
  V.nomesBatem('MUNICIPIO DE', 'MUNICIPIO DE') === null); n++;

// ══════════ 4. O ANO DO NEGOCIO SAI DE ONDE EXISTIR ══════════
ok(n + '. o ano sai do numero da compra quando ele traz ("34/2026")',
  V.anoDoNegocio({ numero: '34/2026' }) === 2026); n++;
ok(n + '. ...ou da data de abertura quando o numero nao traz',
  V.anoDoNegocio({ numero: '34', abertura: '2025-03-10T00:00:00Z' }) === 2025); n++;
ok(n + '. ...e e null quando nenhum dos dois responde (e null NAO bloqueia)',
  V.anoDoNegocio({ numero: '34' }) === null && V.anoDoNegocio({}) === null); n++;

// ══════════ 5. NINGUEM VOLTA A ADIVINHAR ══════════
/* PROIBIDO pela caixa, com a medicao por tras: casar por UF+ano+numero errou nas duas vezes em
   que foi medido. Nenhum destes arquivos pode ter esse caminho. */
/* ══ ESTE ASSERT ERROU NA PRIMEIRA ESCRITA, E O ERRO ENSINA ════════════════════════════════
   Escrevi "nao pode aparecer `numero_compra`" — e reprovou, porque os dois arquivos SELECIONAM
   `numero_compra` da licitacao pra MOSTRAR na conferencia. Selecionar um campo pra exibir nao e
   casar por ele. O que a caixa proibe e BUSCAR por ele.
   >>> ENTAO O ASSERT PASSOU A COBRAR A PROIBICAO DE VERDADE: a unica chave de consulta e o
       `numero_controle`. Nenhum filtro por numero_compra, por uf ou por ano. */
const filtros = s => [...s.matchAll(/(?:\?|&)([a-z_]+)=(?:eq|like|ilike|in)\./g)].map(m => m[1]);
const chavesN = [...new Set(filtros(Nc))], chavesD = [...new Set(filtros(Dc))];
ok(n + '. *** a busca da licitacao e SO por numero_controle — nunca por numero_compra/uf/ano ***',
  !chavesN.some(k => /numero_compra|^uf$|^ano$/.test(k))
  && !chavesD.some(k => /numero_compra|^uf$|^ano$/.test(k))
  && chavesN.includes('numero_controle') && chavesD.includes('numero_controle'),
  { node: chavesN, deno: chavesD }); n++;
ok(n + '. *** e a unica juncao do sistema continua exigindo MUNICIPIO e recusando o resto ***',
  /chave\(bate\[0\]\.municipio\) !== chave\(a\.municipio\)/.test(FILA)); n++;
/* O validador nao constroi uma segunda estrada ate o PNCP: ele abre a porta, e quem traz os
   itens e o coletor de sempre. */
ok(n + '. *** o validador nao coleta nada — ele so grava a chave ***',
  !/licitacao_itens/.test(Nc) && !/licitacao_itens/.test(Dc)); n++;

// ══════════ 6. GRAVAR E PEDIDO EXPLICITO ══════════
/* Conferir tem que poder ser feito enquanto a pessoa digita, sem medo. Gravar por tabela mudaria
   o dado de um negocio ganho so porque alguem colou um numero pra ver o que dava. */
ok(n + '. *** conferir NAO grava: a gravacao exige `gravar: true` ***',
  /body\.gravar === true/.test(Dc) && /tem\('--gravar'\)/.test(Nc)); n++;
ok(n + '. *** e divergencia so passa com confirmacao explicita ***',
  /body\.confirmado !== true/.test(Dc) && /tem\('--confirmado'\)/.test(Nc)); n++;
/* O conserto da A9 de novo: chave do PNCP E id do indice. Gravar so um deixa metade da ponte. */
ok(n + '. *** grava OS DOIS campos (numero_controle e licitacao_id) ***',
  /numero_controle: controle/.test(Dc) && /corpo\.licitacao_id = noIndice\.id/.test(Dc)
  && /corpo\.licitacao_id = noIndice\.id/.test(Nc)); n++;
ok(n + '. *** a edge exige sessao (401 sem Bearer) ***',
  /faca login pra conferir o numero/.test(Dc) && /401/.test(Dc)); n++;
/* Ela nao gasta IA: sao dois GET ao PNCP. Enfiar linha de custo zero no livro-caixa da IA faria
   o numero que vira fatura contar o que nao e fatura. */
ok(n + '. *** e nao escreve em usos_ia (ela nao gasta IA — sao dois GET) ***',
  !/usos_ia/.test(Dc)); n++;

// ══════════ 7. OS DOIS RUNTIMES DIZEM A MESMA COISA ══════════
/* Node e Deno, um comportamento. Mesmo arranjo ja em pe entre o coleta_pncp.js e a
   coletar-licitacoes: sem este assert, um dos dois muda sozinho e o validador passa a aceitar
   num lado o que recusa no outro. */
const normal = s => s.replace(/\s+/g, ' ').replace(/["']/g, '"');
for (const [nome, re] of [
  ['a regex do formato', /\^\(\\d\{14\}\)-\(\\d\+\)-\(\\d\+\)\\\/\(\\d\{4\}\)\$/],
  ['o corte de 0,5 na comparacao de nome', />= 0\.5/],
  ['o token minimo de 3 letras', /t\.length >= 3/],
]) {
  ok(n + `. *** espelho node x deno: ${nome} e igual nos dois ***`,
    re.test(normal(Nc)) && re.test(normal(Dc))); n++;
}
const vaziasN = (NODE.match(/VAZIAS = new Set\(\[([\s\S]*?)\]\)/) || [])[1] || '';
const vaziasD = (DENO.match(/VAZIAS = new Set\(\[([\s\S]*?)\]\)/) || [])[1] || '';
ok(n + '. *** e a lista de palavras genericas e a MESMA (senao um lado casa e o outro nao) ***',
  vaziasN.length > 50 && normal(vaziasN) === normal(vaziasD),
  { node: vaziasN.length, deno: vaziasD.length }); n++;
for (const v of ['formato', 'nao_existe', 'nao_sei', 'diverge', 'confere']) {
  ok(n + `. o veredito "${v}" existe nos dois runtimes`,
    new RegExp('"' + v + '"|\'' + v + '\'').test(Nc) && new RegExp('"' + v + '"').test(Dc)); n++;
}

// ══════════ 8. O CONTRATO COM O B ESTA ESCRITO ══════════
/* O campo na ficha e do B. Sem o contrato escrito, ele reimplementaria a conferencia na tela —
   e ai existiriam duas respostas para "esse numero e valido?". */
ok(n + '. *** o contrato documenta a edge para o B ligar o campo na ficha ***',
  /valida-controle/.test(CONTRATO)); n++;
ok(n + '. ...com o corpo do pedido e os vereditos possiveis',
  /numero_controle/.test(CONTRATO) && /negocio_id/.test(CONTRATO)
  && /nao_existe/.test(CONTRATO) && /podeGravar/.test(CONTRATO)); n++;
ok(n + '. ...e dizendo o que ele NAO deve fazer (reimplementar a conferencia na tela)',
  /nao_sei/.test(CONTRATO) && /confirmado/.test(CONTRATO)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
