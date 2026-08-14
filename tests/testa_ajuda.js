// SUITE testa_ajuda — O GUIA DO USUÁRIO (fpmed_ajuda.html), fatia B11.
//
// ── POR QUE ESTA SUÍTE MEDE PROSA, E ISSO AQUI É LEGÍTIMO ──────────────────────────────────────
// Em quase toda suíte deste projeto, assert que lê prosa é um defeito: ele mede o comentário e
// não o código. Aqui é o contrário — a ENTREGA É A PROSA. O que esta página promete é ser
// entendida pelo Natanael e pela equipe, e as duas maneiras de quebrar isso são medíveis:
//   1. entrar palavra de dentro da máquina ("edge function", "tsvector", "JSON", "RLS");
//   2. entrar cor escrita à mão, e a página deixar de ser do mesmo sistema que as outras.
//
// ── A VARREDURA DE COR É DO ARQUIVO INTEIRO, E ISSO TEM MOTIVO ────────────────────────────────
// A varredura da Proposta já passou verde com onze cores vivas na tela porque olhava só DENTRO
// do atributo de estilo. Aqui não há exceção nenhuma: nem bloco de estilo, nem atributo, nem
// ícone embutido, nem <link>. Uma única sequência de cor em qualquer lugar do arquivo derruba.
//
//   node tests/testa_ajuda.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const R = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');
const A = R('fpmed_ajuda.html');
const TEMA = R('fpmed_tema.css');

let p = 0, f = 0;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_ajuda — o guia do usuário no molde e sem jargão\n');

// ── 1. A PÁGINA É DO MOLDE ────────────────────────────────────────────────────
ok('1. a página existe e carrega o tema do sistema', /<link rel="stylesheet" href="fpmed_tema\.css">/.test(A));
ok('2. ela pendura o menu do sistema, sem redesenhar nenhum', /data-limedtec-menu/.test(A) && /<script src="limedtec-menu\.js"><\/script>/.test(A));
ok('3. *** e NÃO altera o menu: nenhuma lista de itens de menu foi escrita aqui ***',
  !/LimedtecMenu\s*\.\s*(itens|adicionar|registrar)/.test(A));
ok('4. a largura do menu vem do token, e não de um número copiado',
  /margin-left:var\(--menu-largura\)/.test(A) && !/margin-left:\s*2[0-9][0-9]px/.test(A));

// ── 2. *** COR: ZERO À MÃO, NO ARQUIVO INTEIRO *** ────────────────────────────
const hexes = [...new Set(A.match(/#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b/g) || [])];
ok('5. *** nenhuma cor em hex no arquivo INTEIRO (nem no estilo, nem no ícone, nem em atributo) ***',
  hexes.length === 0, hexes);
const funcoesCor = [...new Set(A.match(/\b(rgba?|hsla?|color-mix)\s*\(/g) || [])];
ok('6. e nenhuma cor montada por função (rgb/hsl/color-mix)', funcoesCor.length === 0, funcoesCor);
const nomeadas = [...new Set((A.match(/(?:color|background|border-color|border-left|background-color)\s*:\s*(?!var\()[a-z-]+/g) || [])
  .filter(s => !/:\s*(transparent|inherit|currentcolor|none|unset|initial|0|1px|2px|3px)/i.test(s)))];
ok('7. e nenhuma cor por nome ("red", "white") escapando pelo lado', nomeadas.length === 0, nomeadas);

/* TODO TOKEN CITADO PRECISA EXISTIR NO TEMA. Sem este assert, `var(--cinza-850)` — que não
   existe — passaria em todos os anteriores e a página ficaria com um pedaço sem cor nenhuma.
   É o mesmo defeito que a Proposta já teve, e ele só aparece no navegador, nunca num diff. */
const usados = [...new Set((A.match(/var\(--[a-z0-9-]+\)/g) || []).map(s => s.slice(6, -1)))];
const faltando = usados.filter(t => !new RegExp('--' + t + '\\s*:', 'm').test(TEMA));
ok('8. *** todo token usado aqui existe mesmo no fpmed_tema.css ***', faltando.length === 0, faltando);
ok('9. e a página usa tokens de verdade (não é uma página sem estilo passando no teste)',
  usados.length >= 25, usados.length);

// ── 3. *** SEM JARGÃO TÉCNICO *** ─────────────────────────────────────────────
// A lista é do que ESTA CASA já escreveu em código e documento — não é uma lista genérica de
// palavras difíceis. Cada uma delas apareceria naturalmente se o guia fosse escrito por quem
// construiu o sistema em vez de por quem vai usá-lo.
const PROIBIDAS = [
  'tsvector', 'edge function', 'edge-function', 'supabase', 'postgrest', 'rls', 'jsonb',
  'json', 'api', 'endpoint', 'query', 'upsert', 'cache', 'service worker', 'token',
  'jwt', 'commit', 'deploy', 'regex', 'ilike', 'select ', 'null', 'array', 'backend',
  'front-end', 'frontend', 'bucket', 'webhook', 'cron', 'timeout', 'http',
];
// O corpo visível, sem os comentários de código (que são para quem mantém, não para quem lê)
// e sem o bloco de estilo e as etiquetas de <script>/<link>.
const VISIVEL = A
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<style>[\s\S]*?<\/style>/g, ' ')
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');
const achadas = PROIBIDAS.filter(w => new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(VISIVEL));
ok('10. *** nenhuma palavra de dentro da máquina no texto que o usuário lê ***', achadas.length === 0, achadas);

// ── 4. COMPLIANCE: NADA DE FPMED INTERNA / GLOBALMED ─────────────────────────
ok('11. *** o guia não cita a GlobalMed nem a instalação interna ***',
  !/globalmed|global med|fpmed interna|instala[çc][ãa]o interna/i.test(VISIVEL));
ok('12. o rodapé manda para o suporte da LIMEDTEC', /suporte da LIMEDTEC/.test(VISIVEL));

// ── 5. AS SEIS ETAPAS DA JORNADA ESTÃO TODAS LÁ ──────────────────────────────
const SECOES = [
  ['s1', 'Encontrar oportunidades'],
  ['s2', 'Adicionar aos meus negócios'],
  ['s3', 'Tocar o negócio'],
  ['s4', 'Proposta'],
  ['s5', 'Ata'],
  ['s6', 'Conversar com o edital'],
];
let n = 13;
for (const [id, titulo] of SECOES) {
  ok(n + '. a seção "' + titulo + '" existe e é alcançável pelo índice',
    new RegExp('id="' + id + '"').test(A) && new RegExp('href="#' + id + '"').test(A) && A.includes(titulo));
  n++;
}

// ── 6. *** O CUSTO DA IA ESTÁ ÀS CLARAS *** ──────────────────────────────────
// Esta é a única parte do guia em que ficar calado custaria dinheiro do dono.
ok(n + '. *** o guia diz que CADA leitura custa dinheiro de verdade ***',
  /[Cc]ada leitura custa dinheiro de verdade/.test(VISIVEL)); n++;
ok(n + '. ...e que o valor aparece ANTES de confirmar', /mostra o valor antes de você confirmar/.test(VISIVEL)); n++;
ok(n + '. ...e que ver o preço e cancelar não custam nada',
  /[Vv]er o preço não custa nada/.test(VISIVEL) && /cancelar depois de ver também não/.test(VISIVEL)); n++;
ok(n + '. ...e que o valor mostrado é TETO, não a conta fechada',
  /valor mostrado é o .{0,12}teto/i.test(VISIVEL)); n++;
ok(n + '. ...e diz quando NÃO usar (a pergunta cara que a tela já responde de graça)',
  /Quando\s+não\s+usar/i.test(VISIVEL)); n++;
ok(n + '. a busca do edital é apontada como SEM custo — porque ela é',
  /não .{0,4} tem o selo de custo|não .{0,4}tem selo de custo/i.test(VISIVEL)); n++;

// ── 7. AS HONESTIDADES QUE NÃO PODEM SAIR DO GUIA ────────────────────────────
ok(n + '. *** o guia ensina que "sem teto" não é aprovação ***',
  /não quer dizer .{0,4}pode cobrar o que quiser/i.test(VISIVEL)); n++;
ok(n + '. *** ...e que linha sem selo é linha NÃO conferida ***',
  /sem selo nenhum é linha .{0,4}NÃO conferida/i.test(VISIVEL)); n++;
ok(n + '. o guia manda mudar A DATA DA SESSÃO no adiamento, e não tarefa por tarefa',
  /Não .{0,4}remarque tarefa por tarefa/i.test(VISIVEL)); n++;
ok(n + '. e explica que nenhum item marcado quer dizer O PREGÃO INTEIRO',
  /no .{0,4}pregão inteiro/i.test(VISIVEL)); n++;

// ── 8. AFORDÂNCIA HONESTA (a mesma régua da B12) ─────────────────────────────
// A página tem UM tipo de elemento clicável — o link do índice — e um enfeite que PARECE botão
// (a amostra `.bt` citada no meio do texto). Se a amostra ganhar cursor de mão, ela vira o
// clique morto que esta casa caça.
ok(n + '. a amostra de botão citada no texto tem cursor de texto, não de mão',
  /\.bt\{[^}]*cursor:default/.test(A)); n++;
ok(n + '. ...e ela não é clicável de verdade (nem onclick, nem href)',
  !/class="bt"[^>]*(onclick|href)/.test(A)); n++;
ok(n + '. os links do índice têm foco visível pra quem anda de teclado',
  /\.indice a:focus-visible\{[^}]*box-shadow:var\(--foco\)/.test(A)); n++;
ok(n + '. as setas do desenho de fluxo não são lidas em voz alta (a ordem já está nas caixas)',
  (A.match(/class="seta" aria-hidden="true"/g) || []).length >= 8); n++;

// ── 9. O CAMINHO DE VOLTA ────────────────────────────────────────────────────
// *** ESTA PÁGINA NASCEU SEM SAÍDA, e quem pegou foi a testa_caminho_de_volta — que lê a lista de
//     telas do próprio service worker, e não uma lista escrita à mão. Quem abre a AJUDA é
//     justamente quem está perdido: prender essa pessoa numa tela sem volta é o pior lugar
//     possível para esse defeito. Os asserts abaixo são para ele não voltar por aqui.
ok(n + '. *** a página tem caminho de volta ***', /id="lt-voltar"/.test(A) && /← Sistema/.test(A)); n++;
ok(n + '. ...e o destino vem do config do cliente, não chumbado nesta página',
  /LIMEDTEC\.telaPrincipal\(\)/.test(A) && !/fpmed_sistema_final/.test(A)); n++;
ok(n + '. ...e sem config o link fica ESCONDIDO, em vez de levar a 404',
  /if \(!destino\) return;/.test(A) && /style="display:none">← Sistema/.test(A)); n++;

// ── 10. E A LIMITAÇÃO DECLARADA ──────────────────────────────────────────────
ok(n + '. *** a página assume que não tem print de tela, e diz por quê ***',
  /não tem print de tela/i.test(A) && /não entra no sistema|não faz login/i.test(A)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
