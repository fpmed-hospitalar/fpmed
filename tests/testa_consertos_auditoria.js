// SUITE testa_consertos_auditoria — os quatro consertos que a auditoria do Trabalhador B
// apontou em 14/08 (fatia A14).
//
// == O QUE ELA PROTEGE, E POR QUE CADA UM ======================================
// 1. O ENDERECO DO BANCO NO `window`. `const` no topo de um <script> fica no
//    escopo lexico e NAO vira propriedade de `window` — e o motor do leitor
//    procura `glob.SB_URL`. Sem a linha, "conversar com o edital" morre em "nao
//    sei o endereco", e o sintoma NAO aponta pro motor. Duas telas ja caíram
//    nisso. O assert existe porque a linha parece supérflua pra quem le rapido:
//    ela repete um nome que ja esta ali em cima, e e exatamente isso que faz
//    alguem apagar "limpando".
// 2. O KIT DE TAREFAS EM 14. "Enviar proposta atualizada" virou botao real em
//    11/08 e saiu do modelo da tela; o semeador ficou com 15. Duas listas com o
//    mesmo nome e conteudo diferente e como um negocio nasce diferente conforme
//    quem o criou.
// 3. A FUNCAO "BUSCAR EDITAL AGORA" com as tres travas: autenticacao, freio e
//    registro. A que mais importa e a primeira — porta aberta faz um servico
//    publico (PNCP) trabalhar em nome da FPMED a pedido de qualquer um.
// 4. A FILA DAS ATAS QUE RECUSA CASAMENTO FRACO. Medido: juntar por UF+ano+numero
//    deu 2 correspondencias "unicas" e AS DUAS eram de cidade errada. Resultado
//    de item amarrado no edital errado nao aparece como defeito — aparece como
//    um preco plausivel dentro da tela em que se decide preco.
//
//   node tests/testa_consertos_auditoria.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const T = R('fpmed_licitacoes.html');
const M = R('fpmed_leitor_motor.js');
const S = R('tools', 'semeia_negocios.js');
const F = R('supabase', 'functions', 'buscar-edital', 'index.ts');
const D = R('ddl', 'usos_coleta_edital.sql');
const A = R('tools', 'fila_resultado_atas.js');
const semJs = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const Tc = semJs(T), Mc = semJs(M), Sc = semJs(S), Fc = semJs(F), Ac = semJs(A);

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_consertos_auditoria — os 4 consertos da auditoria do B (fatia A14)\n');

// ══════════ 1. O ENDERECO DO BANCO CHEGA AO MOTOR DO LEITOR ══════════
ok(n + '. *** a Encontrar publica o SB_URL no global (senao o leitor nao acha) ***',
  /^window\.SB_URL = SB_URL;$/m.test(Tc)); n++;
/* Publicar DEPOIS de declarar, senao e ReferenceError na carga da tela — e a tela inteira morre,
   nao so o leitor. Assert de ordem, e nao so de presenca. */
ok(n + '. ...e depois da declaracao do const (antes seria ReferenceError na carga)',
  Tc.indexOf('const SB_URL =') < Tc.indexOf('window.SB_URL = SB_URL')); n++;
/* A CAUSA DE RAIZ: o motor procurava uma chave que o cliente.config.js nunca teve. */
ok(n + '. *** e a causa de raiz foi consertada no motor: a chave e `banco`, nao `supabase` ***',
  /c\.banco && c\.banco\.url/.test(Mc)); n++;
ok(n + '. ...sem tirar o caminho antigo (config velha de cliente nao pode quebrar)',
  /c\.supabase && c\.supabase\.url/.test(Mc)); n++;
ok(n + '. ...e a ordem coloca o certo primeiro',
  Mc.indexOf('c.banco && c.banco.url') < Mc.indexOf('c.supabase && c.supabase.url')); n++;
/* CONTROLE POSITIVO: o `cliente.config.js` de verdade tem que ter a chave que o motor procura,
   senao este assert todo mede a concordancia de dois arquivos errados entre si. */
ok(n + '. (controle) o cliente.config.js realmente expoe `banco.url`',
  /banco\s*:\s*\{[\s\S]{0,200}?url\s*:/.test(R('cliente.config.js'))); n++;

// ══════════ 2. O KIT DE TAREFAS ALINHADO EM 14 ══════════
const KIT = (Sc.match(/const TAREFAS_MODELO = \[[\s\S]*?\n\];/) || [''])[0];
ok(n + '. (controle) o kit do semeador existe e tem itens', /\['oportunidade'/.test(KIT)); n++;
ok(n + '. *** o kit do semeador tem 14 itens, e nao 15 ***',
  (KIT.match(/\n\s*\['/g) || []).length === 14, (KIT.match(/\n\s*\['/g) || []).length); n++;
ok(n + '. *** e "Enviar proposta atualizada" saiu dele (virou botao real em 11/08) ***',
  !/'Enviar proposta atualizada'/.test(Sc)); n++;
/* Foi assim que o "15" sobreviveu tres dias a uma lista de 14: o numero estava escrito a mao. */
ok(n + '. *** e nenhum texto do semeador escreve o numero a mao ***',
  !/× 15 itens/.test(Sc) && /TAREFAS_MODELO\.length/.test(Sc)); n++;
/* Os 2.555 registros gravados NAO sao mexidos: apagar item de checklist de negocio ja fechado
   seria reescrever o que a pessoa marcou. */
ok(n + '. ...e o motivo de nao mexer no que ja esta gravado esta escrito',
  /2\.555 REGISTROS ANTIGOS NAO SAO TOCADOS/.test(S)); n++;

// ══════════ 3. "BUSCAR EDITAL AGORA" — AS TRES TRAVAS ══════════
ok(n + '. *** sem Bearer valido a funcao responde 401 ***',
  /if \(!\/\^Bearer\\s\+\\S\+\/i\.test\(auth\)\) return J\(\{ error: "faca login pra buscar o edital" \}, 401\);/.test(Fc)); n++;
/* O JWT e conferido CONTRA O SERVIDOR, e nao lido do corpo: um token que "parece" um token nao
   basta, senao a trava e um formato e nao uma identidade. */
ok(n + '. ...e a identidade e conferida no /auth/v1/user, nao lida do corpo do pedido',
  /auth\/v1\/user/.test(Fc) && /if \(!user \|\| !user\.id\) return J\([^)]*401\)/.test(Fc)); n++;
ok(n + '. *** ha freio por usuario, contado por hora ***',
  /TETO_HORA/.test(Fc) && /usadas >= TETO_HORA/.test(Fc) && /\}, 429\)/.test(Fc)); n++;
/* Duas contagens da mesma coisa um dia discordam — justo no dia de auditar um abuso. */
ok(n + '. ...e o freio conta da MESMA tabela do registro, nao de uma segunda',
  /usos_coleta_edital\?select=id/.test(Fc) && /rest\/v1\/usos_coleta_edital`/.test(Fc)); n++;
/* Registrar so o sucesso faria a tentativa que derruba o PNCP ser a unica invisivel. */
ok(n + '. *** o registro e gravado tambem quando falha (ok: false, com o motivo) ***',
  (Fc.match(/registra\(\{[\s\S]{0,400}?ok: false/g) || []).length >= 3,
  (Fc.match(/registra\(\{[\s\S]{0,400}?ok: false/g) || []).length); n++;
/* Esta chamada NAO gasta IA. Enfiar custo zero no livro-caixa da IA faria o numero que vira
   fatura contar o que nao e fatura. */
ok(n + '. *** e ela NAO escreve em usos_ia (nao gasta IA; livro-caixa e outro) ***',
  !/usos_ia/.test(Fc)); n++;
ok(n + '. o upsert dos arquivos diz o alvo do conflito (sem isso o banco recusa com 23505)',
  /on_conflict=numero_controle,url_pncp/.test(Fc)); n++;
/* 404 no PNCP = "o orgao nao anexou nada". Achado medido na A6: e o caso MAIS COMUM. */
ok(n + '. *** 404 do PNCP vira "edital nao publicado — anexe manualmente", nao erro ***',
  /r\.status === 404/.test(Fc) && /anexe manualmente/.test(Fc)); n++;
/* PDF escaneado nao tem texto, e isso nao e falha: e um documento que e uma FOTO. */
ok(n + '. *** texto quase vazio vira extracao_erro, e nunca texto vazio gravado ***',
  /limpo\.length < 200/.test(Fc) && /escaneado/.test(Fc)); n++;
ok(n + '. *** ela deriva cnpj/ano/sequencial do numero de controle ***',
  /\^\(\\d\{14\}\)-\\d\+-\(\\d\+\)\\\/\(\\d\{4\}\)\$/.test(Fc)); n++;
ok(n + '. ...e o motivo (licitacao ao vivo nao tem linha no indice) esta escrito',
  /veio AO VIVO do PNCP e não tem linha no índice/.test(F)); n++;
ok(n + '. sem numero de controle a resposta e 422 dizendo "anexe manualmente"',
  /semControle: true/.test(Fc) && /\}, 422\)/.test(Fc)); n++;
ok(n + '. e a funcao nao apaga nada (sem DELETE / TRUNCATE / DROP)',
  !/\b(DELETE|TRUNCATE|DROP)\b/i.test(Fc.replace(/https?:\/\/\S+/g, ''))); n++;

// ══════════ 3b. A TABELA DE REGISTRO ══════════
ok(n + '. a tabela de registro e ADITIVA (create table if not exists)',
  /create table if not exists public\.usos_coleta_edital/.test(D)); n++;
ok(n + '. ...com indice pro freio (usuario + tempo)',
  /on public\.usos_coleta_edital \(usuario_id, criado_em desc\)/.test(D)); n++;
ok(n + '. ...com RLS ligada e anon revogado',
  /enable row level security/.test(D) && /revoke all on public\.usos_coleta_edital from anon/.test(D)); n++;
ok(n + '. ...e sem policy de escrita (quem escreve e a service_role)',
  !/for insert/i.test(D) && !/for update/i.test(D)); n++;

// ══════════ 4. A FILA DAS ATAS RECUSA CASAMENTO FRACO ══════════
ok(n + '. *** a juncao exige o MUNICIPIO, e nao so numero+UF+ano ***',
  /chave\(bate\[0\]\.municipio\) !== chave\(a\.municipio\)/.test(Ac)); n++;
ok(n + '. *** e ambiguidade (mais de um candidato) e recusada, nao desempatada ***',
  /if \(bate\.length > 1\) \{ ambiguo\+\+; continue; \}/.test(Ac)); n++;
/* A medicao que motivou a regra tem que ficar no arquivo: sem ela, o proximo a passar por aqui
   afrouxa a junção "porque so falta o municipio" e reintroduz o defeito. */
ok(n + '. *** a medicao que motivou a regra esta escrita, com os dois casos errados ***',
  /CÂMARA MUNICIPAL DE JATAÍ/.test(A) && /CAMPO LIMPO DE GOIÁS/.test(A)
  && /2 casamentos "únicos", 3 ambíguos, 100 sem/.test(A)); n++;
/* Uma segunda implementacao da regra de "quem venceu" um dia entrega um cancelamento como
   vencedor — a regra e do coleta_resultados.js e fica la. */
ok(n + '. *** ela CHAMA o coletor que ja existe, em vez de reimplementar a regra ***',
  /coleta_resultados\.js/.test(Ac) && !/ordemClassificacaoSrp/.test(Ac)); n++;
ok(n + '. e a previa e o padrao (--executar e explicito)',
  /const EXECUTAR = process\.argv\.includes\('--executar'\)/.test(Ac)); n++;
ok(n + '. o indice e lido PAGINADO (o teto de 1000 nao pode virar "nao achei")',
  /indiceInteiro/.test(Ac) && /de \+= 1000/.test(Ac)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
