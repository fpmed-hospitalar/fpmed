// SUITE testa_busca_nacional_banco — a busca que o BANCO faz (fatia A8, fase 1).
//
// == POR QUE ELA EXISTE ========================================================
// Ate esta fatia, a busca do indice era: a tela BAIXA as licitacoes do periodo e
// filtra em JavaScript. Isso funciona com 3.201 linhas em 7 UFs e PARA de
// funcionar com 27 — nao por lentidao, mas porque o PostgREST corta a leitura, e
// busca que le metade da base responde "nao achei" sobre o que existe. E a mesma
// licao do `limit=1000` que ja mordeu esta obra duas vezes, com a base
// multiplicada. Quem filtra passa a ser o banco, que enxerga tudo.
//
// >>> E ELA GUARDA O ACHADO QUE MUDOU O DESENHO: o `objeto` do PNCP e generico
//     ("aquisicao de material medico-hospitalar"), e o nome do produto mora na
//     descricao dos ITENS. Medido: "caneta" aparece 0 vezes em 3.201 objetos e 5
//     vezes nos 195 itens de UMA licitacao. Sem buscar nos itens, coletar as 27
//     UFs so multiplicaria por 4 uma base que continua respondendo zero.
//
//   node tests/testa_busca_nacional_banco.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const B = R('ddl', 'busca_licitacoes.sql');
const I = R('ddl', 'busca_itens.sql');
const C = R('tools', 'coleta_pncp.js');
const P = R('docs', 'plano_fontes.md');
const semSql = s => s.replace(/--.*$/gm, '');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_busca_nacional_banco — a busca no banco (fatia A8)\n');

// ══════════ 1. AS TRES COISAS QUE A BUSCA PRECISA ACERTAR ══════════
ok(n + '. *** ACENTO: a configuracao usa `unaccent` no mapeamento ***',
  /alter mapping for hword, hword_part, word with unaccent, portuguese_stem/.test(B)); n++;
/* Se o `unaccent` entrar so num lado (indice ou consulta), o indice nao e usado e a busca varre
   a tabela inteira — funciona e fica lenta, que e o pior jeito de errar. */
ok(n + '. ...e a MESMA configuracao vale no indice e na consulta',
  /to_tsvector\('public\.pt_sem_acento'/.test(B)
  && /websearch_to_tsquery\('public\.pt_sem_acento'/.test(I)); n++;
ok(n + '. *** RADICAL: a config e copiada do `portuguese`, e nao do `simple` ***',
  /copy = portuguese/.test(B) && !/copy = simple/.test(B)); n++;
ok(n + '. *** SINONIMO: mora em TABELA editavel, nao em lista no codigo ***',
  /create table if not exists public\.busca_sinonimos/.test(B)
  && /quem sabe que "equipo macrogotas"/.test(B)); n++;

// ══════════ 2. A COLUNA E GERADA, NAO PREENCHIDA ══════════
/* Coluna que alguem precisa lembrar de atualizar e coluna que um dia fica velha — e busca sobre
   indice velho nao acha o que chegou ontem, sem nenhum sintoma alem de "nao achei". */
ok(n + '. *** o vetor da licitacao e GERADO pelo banco (nao ha o que esquecer de atualizar) ***',
  /add column if not exists busca tsvector\s*\n\s*generated always as/.test(B)); n++;
ok(n + '. idem o vetor do item',
  /add column if not exists busca tsvector\s*\n\s*generated always as/.test(I)); n++;
ok(n + '. e ha indice GIN nos dois (senao a busca varre a tabela)',
  /using gin \(busca\)/.test(B) && /using gin \(busca\)/.test(I)); n++;

// ══════════ 3. O ACHADO QUE MUDOU O DESENHO ══════════
/* ANCORADO NO INICIO DA PALAVRA: a 1a versao usava /por_item as \(/ sem `\b`, e a mutacao que
   renomeou o CTE pra `zz_por_item` passou VERDE — substring casa com o nome trocado. Assert de
   presenca sem ancora e assert que aceita qualquer coisa terminada naquilo. */
ok(n + '. *** a busca olha o objeto E os itens ***',
  /\bpor_item as \(/.test(I)
  && /i\.busca @@ \(select tq from q\)/.test(I)
  /* e o CTE tem que ser USADO no join — declarar sem juntar seria codigo morto com cara de
     funcionalidade, e a busca continuaria olhando so o objeto. */
  && /left join por_item pi on pi\.numero_controle = l\.numero_controle/.test(I)
  && /or pi\.n is not null/.test(I)); n++;
ok(n + '. *** e DIZ onde casou (objeto x item sao oportunidades diferentes) ***',
  /casou_em text/.test(I) && /'objeto e itens'/.test(I) && /'itens'/.test(I)); n++;
ok(n + '. ...com quantos itens casaram (1 em 500 e 180 em 195 sao tamanhos opostos)',
  /itens_casados bigint/.test(I)); n++;
ok(n + '. *** e a medicao que motivou isso esta escrita, com os numeros ***',
  /albumina \.\. 0/.test(I) && /"caneta" aparece 0 vezes em 3\.201 objetos/.test(I)); n++;
ok(n + '. ...inclusive a conclusao: coletar 27 UFs sozinho NAO resolveria',
  /COLETAR AS 27 UFs NÃO RESOLVERIA/.test(I) && /não era ABRANGÊNCIA, era PROFUNDIDADE/.test(I)); n++;

// ══════════ 4. A REGRA DE BUSCA MORA NUM LUGAR SO ══════════
/* Tres montagens do mesmo filtro (tela, boletim, jornais) e como tres telas passam a discordar
   sobre o que existe. */
ok(n + '. *** a busca e uma FUNCAO do banco, nao um filtro montado na tela ***',
  /create or replace function public\.buscar_licitacoes/.test(I)); n++;
ok(n + '. *** ela devolve o TOTAL junto (senao a tela diz "30" quando ha 3.000) ***',
  /count\(\*\) over \(\) as total/.test(I)); n++;
ok(n + '. e o limite tem teto (nenhum chamador consegue pedir a base inteira de uma vez)',
  /least\(coalesce\(p_limite, 100\), 500\)/.test(I)); n++;
ok(n + '. so quem esta logado executa (anon revogado)',
  /revoke execute on function public\.buscar_licitacoes/.test(I)
  && /grant execute on function public\.buscar_licitacoes/.test(I)); n++;

// ══════════ 5. AS 27 UFs, E A ORDEM DELAS ══════════
ok(n + '. *** a coleta cobre as 27 UFs ***', (function () {
  const m = C.match(/const UFS = \(arg\('--uf'\) \|\| \[([\s\S]*?)\]\.join/);
  if (!m) return false;
  const ufs = (m[1].match(/'[A-Z]{2}'/g) || []).map(s => s.replace(/'/g, ''));
  return new Set(ufs).size === 27;
})(), (C.match(/const UFS[\s\S]{0,400}?\.join/) || [''])[0].match(/'[A-Z]{2}'/g)?.length); n++;
/* A varredura marca UF por UF e o dia so fecha quando todas terminam. Se a janela acabar no
   meio, o que ficou pronto tem que ser o que mais importa. */
ok(n + '. *** e GO vem PRIMEIRO — coleta interrompida entrega o mercado, nao o Acre ***',
  /'GO','DF','MG','MT','MS','TO','BA'/.test(C) && /A ORDEM DA LISTA NÃO É ALFABÉTICA/.test(C)); n++;
ok(n + '. ...e o comentario separa isto da proibicao de baixar EDITAIS em massa',
  /A proibição é\s*sobre EDITAIS/.test(C.replace(/\n\s*/g, ' '))); n++;

// ══════════ 6. O SELETOR DE PORTAIS LE NUMERO REAL ══════════
ok(n + '. *** a view de portais conta do banco, e nao de uma lista suposta ***',
  /create or replace view public\.v_portais/.test(B) && /count\(\*\) as total/.test(B)); n++;
ok(n + '. ...e ela separa ABERTAS do total (o numero que decide o dia e o das abertas)',
  /count\(\*\) filter \(where data_encerramento >= now\(\)\) as abertas/.test(B)); n++;

// ══════════ 7. AS FASES 2 e 3 FORAM REGISTRADAS, NAO CONSTRUIDAS ══════════
for (const [f2, re] of [
  ['licitacoes-e (Banco do Brasil)', /licitacoes-e/],
  ['EBSERH / Petronect (estatais, lei 13.303)', /EBSERH/ ],
  ['Sistema S', /Sistema S/],
]) { ok(n + '. o plano registra ' + f2, re.test(P)); n++; }
ok(n + '. *** cada fonte futura e coletor separado na MESMA tabela, com selo de origem ***',
  /MESMA tabela `licitacoes`/.test(P) && /selo de\s*origem na coluna `portal`/.test(P.replace(/\n/g, '\n'))); n++;
/* O ponto que decide nao e tecnico, e por isso ele nao pode virar tarefa sem o dono. */
/* O texto corrido do markdown quebra linha onde quiser — mede-se com o espaco normalizado,
   senao reformatar um paragrafo deixa a suite vermelha sem nada ter piorado. (Ja me pegou uma
   vez nesta caixa, no contrato do B.) */
/* E TIRA O `>` DA CITACAO EM BLOCO: o markdown quebra a linha e reabre a citacao no meio da
   frase, entao o texto normalizado fica "é do > dono". Medir prosa exige normalizar a PROSA,
   nao so o espaco em branco. */
const P1 = P.replace(/^\s*>\s?/gm, '').replace(/\s+/g, ' ');
ok(n + '. *** e o plano diz que raspar portal sem API e DECISAO DO DONO, nao tarefa ***',
  /decisão de fazê-lo é do dono, não minha/.test(P1)
  && /registrado como decisão pendente, não como tarefa/.test(P1)); n++;
ok(n + '. o plano registra o que foi medido do PNCP (consulta fora, detalhe no ar)',
  /TimeoutError em 30\.022 ms/.test(P) && /HTTP 200 em 179 ms/.test(P)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
