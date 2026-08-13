// SUITE testa_cmed_base - a CMED como CAMADA DE BASE (item 8): casamento com grau de confianca.
//
// == O QUE O ITEM 8 ACRESCENTOU AO MOTOR ======================================================
// Ordem do dono (13/08): "casamento por registro/EAN e substancia+apresentacao COM GRAU DE
// CONFIANCA - nao casou = silencio, nunca teto chutado."
//
// TRES COISAS NOVAS, e as tres saem de MEDICAO na base real (25.702 linhas):
//
//  1. REGISTRO VEM ANTES DO EAN, e a ordem e contra-intuitiva. Medido:
//       REGISTRO .. 25.701 distintos, 1 colisao (irmaos com a MESMA dose e embalagem)
//       EAN1 ...... 25.544 distintos, 155 colisoes, grupos de ate 3
//     Quem e mais unico vai primeiro. O senso comum diria o contrario.
//
//  2. O `porEan` ERA UM Map DE LINHA UNICA. Nos 155 casos de colisao, a ULTIMA linha lida
//     vencia em silencio - o motor devolvia teto exato com cara de certeza, escolhido por
//     ordem de leitura. Agora guarda GRUPO, e grupo com tetos diferentes cai na regra da
//     faixa: usa-se o MENOR e a faixa viaja junto.
//
//  3. O GRAU DE CONFIANCA separa o que antes tinha a mesma cara: substancia vinda do
//     DICIONARIO ('alta') e substancia CHUTADA da primeira palavra do nome ('media').
//     Encostar um teto legal no preco apoiado num palpite e a forma educada de chutar.
//
//   node tests/testa_cmed_base.js
'use strict';
const path = require('path');
const M = require(path.join(__dirname, '..', 'fpmed_teto_cmed.js'));

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_cmed_base - o casamento com grau de confianca (item 8)\n');

/* A suite EXECUTA o motor contra um indice de mentira, em vez de procurar texto no arquivo.
   Indice de mentira prova a LOGICA; quem prova que ela ACHA o que existe e a
   tests/db/testa_teto_real.js, que roda contra a CMED de verdade. As duas coisas sao
   diferentes e as duas precisam existir. */
const REGUA = [
  // o mesmo EAN em DUAS linhas com tetos diferentes: e o caso dos 155 medidos
  { ggrem: 'G-A', ean1: '7891000000001', registro: '1000000000001', subst_norm: 'DIPIRONA',
    apresentacao: 'CX 10 CP', pf_unit: 1.45, pmvg_unit: 1.10, cap: true },
  { ggrem: 'G-B', ean1: '7891000000001', registro: '1000000000002', subst_norm: 'DIPIRONA',
    apresentacao: 'CX 20 CP', pf_unit: 0.90, pmvg_unit: 0.70, cap: true },
  // chave limpa, sem colisao
  { ggrem: 'G-C', ean1: '7891000000009', registro: '1000000000009', subst_norm: 'AMOXICILINA',
    apresentacao: 'FR 150ML', pf_unit: 5.00, pmvg_unit: 4.00, cap: false },
];
const TETO = [
  { subst_norm: 'DIPIRONA', dose_key: '500MG', teto_min: 0.61, teto_max: 1.45,
    tem_cap: true, apresentacoes: 31 },
];
const DIC = [{ marca_norm: 'novalgina', substancia: 'DIPIRONA' }];
const idx = M.indexar({ regua: REGUA, teto: TETO, dicionario: DIC });
const av = (item, op) => M.avaliar(item, idx, op);

// ── 0. o indice tem as tres portas ───────────────────────────────────────────────────────────
ok(n + '. o indice ganhou a porta do REGISTRO, alem de ggrem e ean',
  !!idx.porRegistro && idx.porRegistro.size === 3 && idx.porGgrem.size === 3,
  { registro: idx.porRegistro && idx.porRegistro.size }); n++;
ok(n + '. e o tamanho e reportado, pra quem carrega saber o que entrou',
  idx.tamanho.registro === 3 && idx.tamanho.ean === 2, idx.tamanho); n++;

// ── 1. as chaves exatas ──────────────────────────────────────────────────────────────────────
ok(n + '. casa por GGREM, com confianca exata',
  (r => r.via === 'ggrem' && r.confianca === 'exata')(av({ ggrem: 'G-C', precoUnit: 1, unitario: true }))); n++;
ok(n + '. *** casa por REGISTRO — a chave que a medicao mostrou ser a mais unica ***',
  (r => r.via === 'registro' && r.confianca === 'exata' && r.teto === 5)
    (av({ registro: '1000000000009', precoUnit: 1, unitario: true }))); n++;
ok(n + '. casa por EAN, com confianca exata',
  (r => r.via === 'ean' && r.confianca === 'exata')
    (av({ ean: '7891000000009', precoUnit: 1, unitario: true }))); n++;
/* O REGISTRO TEM QUE VENCER O EAN quando os dois vem. Se a ordem inverter, os 155 casos de
   colisao de EAN passam a decidir o teto no lugar de uma chave que quase nao colide. */
ok(n + '. *** o registro vence o EAN quando os dois vem juntos ***',
  (r => r.via === 'registro')
    (av({ registro: '1000000000009', ean: '7891000000001', precoUnit: 1, unitario: true }))); n++;
ok(n + '. e o ggrem vence os dois',
  (r => r.via === 'ggrem')
    (av({ ggrem: 'G-C', registro: '1000000000001', ean: '7891000000001', precoUnit: 1, unitario: true }))); n++;
/* Digito nao-numerico no meio nao pode quebrar a chave: a planilha colada escreve com pontos. */
ok(n + '. a chave ignora pontuacao (planilha colada escreve com ponto e traco)',
  (r => r.via === 'registro')
    (av({ registro: '1.000.000.000-009', precoUnit: 1, unitario: true }))); n++;

// ── 2. a colisao de EAN nao pode ser resolvida por sorte ─────────────────────────────────────
const col = av({ ean: '7891000000001', precoUnit: 1, unitario: true });
ok(n + '. *** EAN repetido NAO escolhe uma linha por ordem de leitura ***',
  col.faixa != null && col.apresentacoes === 2, { faixa: col.faixa, apres: col.apresentacoes }); n++;
/* MENOR TETO na colisao, pela mesma regra 3 do cabecalho do motor: o maior faria passar preco
   que estoura o teto da apresentacao real. */
ok(n + '. *** e usa o MENOR teto do grupo (o maior deixaria passar preco acima) ***',
  col.teto === 0.90, { teto: col.teto }); n++;
/* `col.faixa &&` antes de indexar, e nao e zelo generico: sem isso a suite EXPLODE quando a
   faixa some, em vez de reportar a falha — e suite que explode PARA DE AVALIAR o resto, entao
   uma regressao nos asserts seguintes ficaria escondida atras do crash. Achado rodando a
   mutacao: duas mutacoes ficaram "vermelhas" por TypeError, nao por assert. */
ok(n + '. a faixa inteira viaja junto, pra tela poder mostrar o que foi considerado',
  !!col.faixa && col.faixa[0] === 0.90 && col.faixa[1] === 1.45, col.faixa); n++;
ok(n + '. e a evidencia AVISA que havia mais de uma linha com a mesma chave',
  /mesma chave/.test(String(col.evidencia)), { evidencia: col.evidencia }); n++;
/* Grupo cujos tetos sao IGUAIS nao vira faixa: faixa de um numero so e ruido que faz a tela
   mandar conferir onde nao ha o que conferir. */
const idx2 = M.indexar({ regua: [
  { ggrem: 'X1', ean1: '7', registro: 'R1', subst_norm: 'A', pf_unit: 2, pmvg_unit: 1, cap: false },
  { ggrem: 'X2', ean1: '7', registro: 'R2', subst_norm: 'A', pf_unit: 2, pmvg_unit: 1, cap: false }] });
ok(n + '. mas grupo com tetos IGUAIS nao vira faixa (faixa de um numero so e ruido)',
  (r => r.teto === 2 && r.faixa === null)(M.avaliar({ ean: '7', precoUnit: 1, unitario: true }, idx2))); n++;

// ── 3. o grau de confianca do caminho por nome ───────────────────────────────────────────────
ok(n + '. *** marca reconhecida no dicionario -> confianca ALTA ***',
  (r => r.via === 'pa+dose' && r.confianca === 'alta')
    (av({ descricao: 'NOVALGINA 500MG', precoUnit: 1, unitario: true }))); n++;
ok(n + '. *** primeira palavra chutada como principio ativo -> confianca MEDIA ***',
  (r => r.via === 'pa+dose' && r.confianca === 'media')
    (av({ descricao: 'DIPIRONA 500MG', precoUnit: 1, unitario: true }))); n++;
/* As duas devolviam resultado com a MESMA cara antes do item 8 — e e por isso que a distincao
   precisa existir: quem le a tela nao tinha como saber que um deles saiu de um palpite. */
ok(n + '. e as duas continuam achando o mesmo teto (o grau informa, nao muda a conta)',
  av({ descricao: 'NOVALGINA 500MG', precoUnit: 1, unitario: true }).teto ===
  av({ descricao: 'DIPIRONA 500MG', precoUnit: 1, unitario: true }).teto); n++;

// ── 4. "nao casou = silencio, nunca teto chutado" ────────────────────────────────────────────
const nada = av({ descricao: 'PARAFUSO SEXTAVADO 5MM', precoUnit: 1, unitario: true });
ok(n + '. *** o que nao casa volta nao_encontrado, com teto NULO ***',
  nada.situacao === 'nao_encontrado' && nada.teto === null && nada.confianca === null); n++;
ok(n + '. e nao_encontrado NUNCA e "abaixo" (a regra 1 do motor, que o item 8 nao afrouxou)',
  nada.situacao !== 'abaixo'); n++;

// ── 5. a trava do grau minimo ────────────────────────────────────────────────────────────────
const rebaixado = av({ descricao: 'DIPIRONA 500MG', precoUnit: 1, unitario: true }, { confiancaMinima: 'alta' });
ok(n + '. *** quem exige grau ALTA nao recebe teto vindo de palpite ***',
  rebaixado.situacao === 'nao_encontrado' && rebaixado.teto === null); n++;
/* O REBAIXAMENTO NAO APAGA O QUE FOI ACHADO: a tela que quiser oferecer "achei algo parecido,
   quer conferir?" tem com o que fazer isso. O que ela nao pode e AFIRMAR um teto legal. */
ok(n + '. *** mas o rebaixamento nao apaga a pista: via, confianca e motivo continuam ***',
  rebaixado.via === 'pa+dose' && rebaixado.confianca === 'media'
  && /abaixo do grau alta/.test(String(rebaixado.motivo)), { motivo: rebaixado.motivo }); n++;
ok(n + '. exigir EXATA tambem rebaixa o que veio do dicionario',
  av({ descricao: 'NOVALGINA 500MG', precoUnit: 1, unitario: true }, { confiancaMinima: 'exata' })
    .situacao === 'nao_encontrado'); n++;
ok(n + '. e a chave exata passa em qualquer exigencia',
  av({ registro: '1000000000009', precoUnit: 1, unitario: true }, { confiancaMinima: 'exata' })
    .situacao === 'abaixo'); n++;
/* Sem `opcoes` o motor tem que se comportar como antes do item 8 — as tres telas que ja o
   chamam nao passam opcoes nenhuma. */
ok(n + '. *** sem opcoes, o motor se comporta como antes (as telas de hoje nao passam nada) ***',
  (r => r.situacao === 'acima' && r.teto === 0.61)
    (M.avaliar({ descricao: 'DIPIRONA 500MG', precoUnit: 1, unitario: true }, idx))); n++;

// ── 6. o teto que se aplica continua sendo decidido por quem chama ───────────────────────────
/* Eu tinha escrito este assert com um `||` de reserva, porque nao tinha certeza do numero. Um
   assert com saida de emergencia passa em qualquer caso e nao guarda nada — e o mesmo vicio dos
   asserts cegos que esta obra ja pegou varias vezes. O valor esta cravado: G-A tem pmvg_unit
   1.10, entao governo+CAP tem que devolver exatamente isso. */
ok(n + '. governo + CAP -> PMVG, com o valor do PMVG e nao o do PF',
  (r => r.tipoTeto === 'PMVG' && r.teto === 1.10)
    (av({ ggrem: 'G-A', paraGoverno: true, precoUnit: 1, unitario: true })),
  av({ ggrem: 'G-A', paraGoverno: true, precoUnit: 1, unitario: true })); n++;
ok(n + '. sem declarar governo -> PF, mesmo com CAP (o motor nao adivinha)',
  (r => r.tipoTeto === 'PF')(av({ ggrem: 'G-A', precoUnit: 1, unitario: true }))); n++;
ok(n + '. governo sem CAP -> PF (o desconto so e obrigatorio com CAP)',
  (r => r.tipoTeto === 'PF' && r.teto === 5)
    (av({ ggrem: 'G-C', paraGoverno: true, precoUnit: 1, unitario: true }))); n++;
/* Preco de CAIXA nunca vira comparacao: `unitario` e DECLARADO. Regra 2 do motor, e o item 8
   nao pode ter afrouxado ela ao mexer no caminho das chaves. */
ok(n + '. preco nao declarado unitario continua virando sem_preco, mesmo com chave exata',
  (r => r.situacao === 'sem_preco')(av({ registro: '1000000000009', precoUnit: 10 }))); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
