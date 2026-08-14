// SUITE testa_custo_as_claras — O AVISO DE CUSTO ANTES DE GASTAR (fatia A12, 14/08/2026).
//
// == A DECISAO DO DONO ==========================================================
// 14/08: *"a conversa com o edital FICA, com os clientes cientes do custo"*. Ou
// seja, antes de CADA leitura a pessoa ve quanto vai custar e diz sim.
//
// == O QUE ESTA SUITE PROTEGE, E POR QUE CADA COISA ==============================
//  1. QUE O PRECO VENHA DO SERVIDOR. O contrato do motor e literal: *nao escreva
//     uma segunda conta de custo do seu lado*. Uma estimativa feita no navegador
//     criaria DUAS respostas para "quanto isto custa" — uma que aparece na
//     pergunta e outra que vira fatura. No dia em que o preco da Anthropic mudar,
//     so uma seria corrigida, e o anuncio ficaria mais barato que a cobranca sem
//     ninguem notar ate o fechamento do mes.
//  2. QUE O PORTAO SEJA LIGADO POR PADRAO. Quem chamar o motor sem passar por ele
//     precisa DIZER `confirmado: true` — o que aparece na revisao de codigo. O
//     desenho contrario (a tela liga se lembrar) e aquele em que a primeira tela
//     nova gasta sem avisar e ninguem descobre ate a fatura.
//  3. QUE O NUMERO SEJA O TETO, E NAO A MEDIA. A saida da IA ja variou de 213 a
//     8.878 tokens NA MESMA TAREFA. Anunciar a media faria a cobranca passar do
//     anunciado em metade das vezes; o aviso diz "ate", e o "ate" e verdade.
//  4. QUE ORCAR NAO GASTE. Ele sai da edge ANTES da chamada a IA: cancelar custa
//     zero porque nao ha o que cancelar. (A contagem no banco esta na prova viva,
//     tools/prova_custo_as_claras.js — aqui se trava o CAMINHO.)
//
//   node tests/testa_custo_as_claras.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const M = R('fpmed_leitor_motor.js');
const E = R('supabase', 'functions', 'ler-edital', 'index.ts');
const T = R('fpmed_licitacoes.html');
const semJs = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const Mc = semJs(M), Ec = semJs(E), Tc = semJs(T);

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_custo_as_claras — o custo antes do gasto (fatia A12)\n');

// ══════════ 1. O PRECO NASCE NO SERVIDOR, E SO LA ══════════
ok(n + '. *** a edge function responde orcamento sem gastar ***',
  /if \(body\.orcar === true\)/.test(Ec) && /orcamento:/.test(Ec)); n++;
/* O `return` do orcamento tem que vir ANTES da chamada a Anthropic. Depois dela, "nao gasta"
   seria so uma frase — o dinheiro ja teria saido. */
ok(n + '. *** e ele SAI antes da chamada a IA (por isso cancelar custa zero) ***',
  Ec.indexOf('body.orcar === true') < Ec.indexOf('api.anthropic.com')); n++;
/* Se o orcamento passasse pelo registro, "olhar o preco" viraria linha no livro-caixa. */
ok(n + '. ...e nao passa perto do registro em usos_ia',
  Ec.indexOf('body.orcar === true') < Ec.indexOf('registra_uso_ia')); n++;
ok(n + '. o orcamento fica DEPOIS da autenticacao e da permissao (nao e porta de sondagem)',
  Ec.indexOf('auth/v1/user') < Ec.indexOf('body.orcar === true')
  && Ec.indexOf('LEITORES.includes(email)') < Ec.indexOf('body.orcar === true')); n++;

// ══════════ 2. O MOTOR NAO FAZ CONTA DE CUSTO ══════════
/* ESTE E O ASSERT QUE O CONTRATO PEDE EM VOZ ALTA. O motor pode PEDIR o preco; nao pode
   CALCULAR. Tabela de preco no navegador e o segundo numero que um dia discorda do primeiro. */
ok(n + '. *** o motor NAO tem tabela de preco nem multiplica token por dolar ***',
  !/USD_ENTRADA_MTOK|USD_SAIDA_MTOK|1e6/.test(Mc)
  && !/MAX_SAIDA|TETO_SAIDA/.test(Mc)
  && !/CHARS_POR_TOKEN/.test(Mc)); n++;
ok(n + '. ...ele PEDE o orcamento ao servidor',
  /orcar: true/.test(Mc) && /j\.orcamento/.test(Mc)); n++;
/* CONTROLE POSITIVO: sem ele, o assert de ausencia acima ficaria verde num motor apagado. */
ok(n + '. (controle) e o motor realmente expoe orcar / frasePreco / confirmador',
  /orcar: orcar/.test(Mc) && /frasePreco: frasePreco/.test(Mc)
  && /get confirmador\(\)/.test(Mc) && /set confirmador\(fn\)/.test(Mc)); n++;

// ══════════ 3. O PORTAO E LIGADO POR PADRAO ══════════
ok(n + '. *** sem `confirmado: true`, o motor ORCA e PERGUNTA antes de gastar ***',
  /if \(o\.confirmado !== true\) \{/.test(Mc)); n++;
ok(n + '. *** e um "nao" vira erro MARCADO como cancelamento (nao e falha) ***',
  /ex\.cancelado = true/.test(Mc) && /nada foi cobrado/.test(Mc)); n++;
/* A saida facil seria "nao consegui orcar, entao segue" — e ela pula justamente a parte que o
   dono mandou existir. Nao saber o preco e motivo pra NAO gastar. */
ok(n + '. *** nao consegui orcar -> NAO gasta (e nao "segue sem avisar") ***',
  /ec\.semOrcamento = true/.test(Mc)
  && /não vou gastar sem te dizer quanto custa/.test(M)); n++;
/* Portao que se abre sozinho quando nao sabe perguntar nao e portao. */
ok(n + '. *** sem `confirm` disponivel a resposta padrao e NAO ***',
  /typeof glob\.confirm === 'function'\) \? !!glob\.confirm\(texto\) : false/.test(Mc)); n++;
ok(n + '. ...e o confirmador so aceita funcao (nao da pra desligar o portao por acidente)',
  /set confirmador\(fn\) \{ if \(typeof fn === 'function'\) confirmador = fn; \}/.test(Mc)); n++;

// ══════════ 4. O NUMERO ANUNCIADO E O TETO, E A FRASE DIZ ISSO ══════════
ok(n + '. *** a frase diz "custa ATE", porque o valor e teto e nao media ***',
  /'Esta leitura custa até '/.test(Mc) && /O valor é o TETO/.test(Mc)); n++;
ok(n + '. ...e o servidor marca o orcamento como teto',
  /teto: true/.test(Ec) && /tetoSaida = MAX_SAIDA\[tarefa\] \* nPartes/.test(Ec)); n++;
/* MEDIDO nas 7 leituras reais desta base: 2,90 a 3,05 chars por token. O "4 chars por token" e
   do ingles e subestimaria a entrada em 33% — a unica direcao em que um aviso de custo nao pode
   errar. O assert cobra o numero E a medicao escrita, porque constante sem procedencia e a que
   alguem "arredonda" na proxima pressa. */
ok(n + '. *** a razao chars/token e 3,00, MEDIDA, e a medicao esta escrita ***',
  /const CHARS_POR_TOKEN = 3\.00;/.test(Ec)
  && /2,90 · 2,92 · 3,01 · 3,04 · 3,04 ·/.test(E)
  && /NÃO É O "4 CHARS POR TOKEN"/.test(E)); n++;
/* "R$ 0.26" lido por quem escreve "0,26" a vida inteira passa por vinte e seis. */
ok(n + '. o valor sai com virgula decimal (pt-BR), e nao com ponto',
  /toLocaleString\('pt-BR', \{ minimumFractionDigits: 2/.test(Mc)); n++;

// ══════════ 5. O CAMBIO ══════════
ok(n + '. *** o cambio vem do SERVIDOR (preco em real calculado no navegador nao e preco) ***',
  /await cotacaoUSD\(\)/.test(Ec) && !/awesomeapi/.test(Mc)); n++;
/* Uma cotacao com uma fonte so e uma cotacao que um dia nao existe — e medido nesta fatia: da
   edge function a awesomeapi devolveu nada, e o orcamento saiu em dolar pra quem paga em real. */
ok(n + '. ...com DUAS fontes, e a segunda nasceu de uma medicao',
  /awesomeapi/.test(Ec) && /frankfurter/.test(Ec)
  && /ela devolveu NADA e o orçamento saiu em dólar/.test(E)); n++;
/* Cotacao errada e pior que cotacao nenhuma: uma API que mude de formato e devolva a taxa
   invertida transformaria R$ 5 em R$ 1, e o aviso passaria a mentir PARA MENOS. */
ok(n + '. *** e ha faixa de sanidade (3 a 12), senao taxa invertida vira preco falso ***',
  /isFinite\(v\) && v > 3 && v < 12/.test(Ec)); n++;
ok(n + '. sem cotacao, o preco sai em DOLAR e diz que e dolar (nunca inventa 5,00)',
  /não consegui a cotação do dólar agora/.test(M) && /return null;/.test(Ec)); n++;

// ══════════ 6. A TELA REAGE, MAS NAO DECIDE ══════════
ok(n + '. *** a Encontrar nao pinta aviso de custo proprio (quem pergunta e o motor) ***',
  !/custa até/.test(Tc)); n++;
/* Pintar de vermelho quem clicou em "nao" ensina a pessoa a desconfiar do sistema justamente
   quando ele obedeceu. */
ok(n + '. ...e cancelar aparece como aviso NEUTRO, dizendo que nada foi cobrado',
  /if\(e\.cancelado\)\{/.test(Tc) && /nada foi cobrado<\/b>/.test(Tc)
  && !/if\(e\.cancelado\)\{[\s\S]{0,200}aviso err/.test(Tc)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
