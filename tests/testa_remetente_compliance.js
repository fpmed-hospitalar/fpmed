// SUITE testa_remetente_compliance - nenhum e-mail da FPMED sai por dominio da GlobalMed.
//
// == DE ONDE VEIO ==============================================================
// Auditoria independente do dono, 11/08: o UNICO dominio verificado na conta do
// Resend e o globalmedgo.com.br. Isso cria uma armadilha silenciosa, e a
// armadilha e o motivo desta suite existir:
//
//   · hoje nao ha violacao - `BOLETIM_REMETENTE` nao esta configurado, entao o
//     remetente cai no onboarding@resend.dev e so entrega pro dono da conta;
//   · o perigo e o de amanha. O Resend so entrega pra FORA com dominio
//     verificado. No dia em que alguem for "fazer o boletim chegar no cliente",
//     a solucao que funciona de primeira e EXATAMENTE a proibida - apontar o
//     remetente pro dominio da GlobalMed. E ela funciona. E ninguem percebe,
//     porque o e-mail chega bonito e entregue.
//
// Marca de uma empresa no e-mail da outra e o mesmo cruzamento que a regra
// master proibe, so que impresso no cabecalho e visivel pro cliente.
//
// == POR QUE TRAVA NO CODIGO, E NAO AVISO NO MANUAL ============================
// Licao S5: regra que depende de alguem lembrar cede no dia da pressa. A trava
// nao cede. E a trava recusa a RODADA INTEIRA em vez de pular o envio - pular
// deixaria o boletim "quase funcionando" com o motivo escondido dentro de um
// relatorio de sucesso, que e como defeito de compliance sobrevive por meses.
//
//   node tests/testa_remetente_compliance.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const F = R('supabase', 'functions', 'enviar-boletim', 'index.ts');
// O comentario do codigo e escrito em portugues com acento, e a suite le sem:
// assert que depende de acento quebra na primeira vez que alguem editar o texto
// em outro teclado, e quebra por um motivo que nao tem nada a ver com a regra.
const uc = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*\n\s*(?:\/\/|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_remetente_compliance - o dominio da Global fora do e-mail da FPMED\n');

// ── 1. a trava existe e roda cedo ────────────────────────────────────────────
// A LISTA e lida do arquivo e usada de verdade mais abaixo. Antes disso ela era
// conferida procurando o texto "globalmedgo.com.br" no arquivo inteiro - e um
// teste de mutacao mostrou o furo: apagar o dominio DA LISTA passava verde,
// porque o nome continuava escrito no comentario logo acima. Assert que aceita o
// comentario como prova do codigo nao esta provando o codigo.
const mLista = F.match(/const DOMINIOS_PROIBIDOS\s*=\s*\[([^\]]*)\]/);
const LISTA = mLista ? (mLista[1].match(/"([^"]+)"/g) || []).map(s => s.replace(/"/g, '')) : [];
ok('1. a lista de dominios proibidos existe', !!mLista);
ok('2. e a LISTA (nao o comentario) cobre os dois dominios da GlobalMed',
  LISTA.includes('globalmedgo.com.br') && LISTA.includes('globalmed.com.br'), LISTA);
ok('3. ha uma funcao que decide, em vez de um if solto no meio do envio',
  /function remetenteProibido/.test(F));
ok('4. a trava roda ANTES de ler jornal, montar e-mail ou chamar o Resend',
  F.indexOf('remetenteProibido(REMETENTE)') < F.indexOf('api.resend.com') &&
  F.indexOf('remetenteProibido(REMETENTE)') < F.indexOf('rest/v1/jornais'));
// O BLOCO da trava, recortado pelas proprias chaves - nao por distancia em
// caracteres. A versao anterior media 400 caracteres a partir de
// `remetenteProibido(REMETENTE)` e ficou vermelha assim que a sonda entrou no
// meio: o codigo estava certo, a regua e que era de borracha. Assert que depende
// de distancia quebra em toda edicao vizinha, e assert que quebra por nada treina
// a pessoa a ignorar vermelho.
const iTrava = F.indexOf('if (proibido) return J({');
const bloco = iTrava < 0 ? '' : F.slice(iTrava, F.indexOf('}, 200);', iTrava));
ok('5. e ela recusa a rodada inteira, nao pula so o envio',
  iTrava >= 0 && /compliance:\s*"remetente_proibido"/.test(bloco) && /ok:\s*false/.test(bloco));

// ── 2. o comportamento da funcao de decisao, exercitado de verdade ───────────
// Nao adianta conferir que o codigo existe: o que importa e o que ele DECIDE.
// A funcao e extraida do arquivo real e rodada aqui - se o texto mudar, este
// bloco muda junto, e nao ha copia paralela envelhecendo em silencio.
const trecho = F.match(/const dominioDe[\s\S]*?\n\}/);
ok('6. da pra extrair a funcao real do arquivo (a suite nao recopia a regra)', !!trecho);
let remetenteProibido = null;
if (trecho) {
  const src = trecho[0]
    .replace(/const DOMINIOS_PROIBIDOS[^;]*;/, '')
    .replace(/:\s*string/g, '').replace(/\(rem\)/g, '(rem)');
  // eslint-disable-next-line no-new-func
  // A lista vem do ARQUIVO (LISTA), nao de uma copia escrita aqui: assim os casos
  // abaixo exercitam a regra que esta no ar, e nao uma versao paralela dela.
  remetenteProibido = new Function('DOMINIOS_PROIBIDOS',
    src + '\nreturn remetenteProibido;')(LISTA);
}

const CASOS = [
  ['FPMED <boletim@globalmedgo.com.br>', true,  'o caso exato do risco de amanha'],
  ['<x@GLOBALMEDGO.COM.BR>',             true,  'maiuscula nao escapa'],
  ['FPMED <a@send.globalmedgo.com.br>',  true,  'subdominio tambem nao escapa'],
  ['FPMED <a@globalmed.com.br>',         true,  'o outro dominio da Global'],
  ['FPMED <onboarding@resend.dev>',      false, 'o padrao de hoje continua passando'],
  ['FPMED <boletim@send.fpmed.com.br>',  false, 'o destino certo, quando o dominio for verificado'],
  ['FPMED <boletim@fpmed.com.br>',       false, 'o dominio proprio'],
  ['boletim@fpmed.com.br',               false, 'sem nome de exibicao'],
  ['FPMED <a@naoglobalmed.com.br>',      false, 'dominio que so TERMINA parecido nao e o mesmo'],
];
let n = 7;
for (const [rem, esperado, porque] of CASOS) {
  const deu = remetenteProibido ? !!remetenteProibido(rem) : null;
  ok(n + '. ' + (esperado ? 'BARRA' : 'deixa passar') + ': ' + rem + ' - ' + porque, deu === esperado, deu);
  n++;
}

// ── 3. a mensagem ensina o conserto certo ────────────────────────────────────
// Erro de compliance que so diz "proibido" faz a pessoa procurar jeito de
// contornar. O texto tem que dizer QUAL e o caminho legitimo, senao o contorno
// vira o caminho.
const msg = F.slice(F.indexOf('remetente_proibido'), F.indexOf('remetente_proibido') + 900);
ok(n + '. a mensagem diz o conserto: verificar fpmed.com.br', /fpmed\.com\.br/.test(msg)); n++;
ok(n + '. aponta o lugar exato (resend.com/domains) e o secret a trocar',
  /resend\.com\/domains/.test(msg) && /BOLETIM_REMETENTE/.test(msg)); n++;
ok(n + '. diz a regra provisoria: ate la, destinatario = so o dono', /so o dono/.test(msg)); n++;
ok(n + '. e garante por escrito que nada foi enviado nem marcado como visto',
  /nada foi marcado como visto/i.test(msg)); n++;

// ── 4. a memoria do porque (L6) ──────────────────────────────────────────────
ok(n + '. o codigo registra POR QUE a trava existe, e nao so o que ela faz',
  /a solucao que funciona de primeira e exatamente a proibida/i.test(uc(F))); n++;
ok(n + '. e registra o fato medido em 11/08: hoje o remetente NAO esta configurado',
  /BOLETIM_REMETENTE. NAO esta configurado/i.test(uc(F).replace(/`/g, '.'))); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
