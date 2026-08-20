/* ══════════════════════════════════════════════════════════════════════════════════════════════
   SUITE testa_piso — A CATRACA DA CALCULADORA DE PISO (fatia B29, 20/08/2026)

   Ela guarda cinco promessas, e as cinco cedem em silêncio se ninguém as vigiar:

   1. **O IMPOSTO DIVIDE, NÃO MULTIPLICA.** `× (1 + alíq)` é a conta que qualquer um faz de
      cabeça, é uma linha de código, e o resultado continua parecendo certo. Com 25% ela devolve
      um piso **6,25% ABAIXO** do piso — e o sintoma é lance ganho com prejuízo, meses depois,
      sem ninguém ligar as duas coisas.

   2. **SEM PARÂMETRO NÃO HÁ PISO.** Nem R$ 0,00, nem "0% de margem", nem número provisório. O
      atalho tentador é "assume 0% de imposto enquanto ninguém cadastra" — e aí o piso vira o
      custo, o gestor vê folga que não existe, e a tela ficou MAIS perigosa do que quando não
      mostrava nada.

   3. **ZERO NÃO É CUSTO.** Há uma linha com `compra_unit = 0` neste banco (medido). Aceitar zero
      daria a ela o menor piso do sistema, com cara de conta feita. Terceira vez que este projeto
      encontra "zero escrito como se fosse preço" — `valor_unitario_ref`, `resultado_valor_unit`,
      e agora `compra_unit`.

   4. **PISO SOBRE CUSTO ESTIMADO É PISO CHUTADO.** O `custoRef` (venda ÷ 1,25) do estoque GLOBAL
      serve para exibir markup; usá-lo no piso esconderia um chute dentro de um número com quatro
      casas decimais.

   5. **UMA CONTA SÓ.** A tela pergunta, o motor responde. Uma conta reimplementada dentro da
      Proposta seria a família de defeito mais cara deste projeto outra vez — num número que
      decide lance.

   ══ E ELA COBRA DO CÓDIGO, NÃO DA PROSA ═════════════════════════════════════════════════════
   Todo assert de tela roda sobre o texto sem comentário (`semComentario`). A lição é da B26: um
   assert que aceita o comentário como prova do código não está provando o código.

     node tests/testa_piso.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { semComentario } = require('../tools/regua_visual.js');
const RAIZ = path.join(__dirname, '..');
const R = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');

const MOTOR = semComentario(R('fpmed_piso.js'));
const GIO = semComentario(R('fpmed_giovana.html'));
const DOC = semComentario(R('fpmed_documentos.html'));
const SW = semComentario(R('sw.js'));
/* ══ O DDL TAMBÉM É LIDO SEM COMENTÁRIO, E ISSO FOI UM DEFEITO ACHADO PELA MUTAÇÃO ═══════════
   A primeira versão desta suíte cobrava `op_par_coerente` do texto CRU do arquivo — e a prosa do
   cabeçalho cita o nome do CHECK três vezes ("o `op_par_coerente` torna IMPOSSÍVEL gravar meio
   componente"). Apagar o CHECK e deixar o comentário passava VERDE.
   >>> É a lição da B26 na letra: *"um assert que aceita o comentário como prova do código não
       está provando o código"* — e desta vez ela pegou a mim, no arquivo em que a explicação é
       mais longa que a regra. Todo assert de DDL desta suíte roda sobre `DDL`, sem comentário. */
const semComentarioSQL = s => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
const DDL = semComentarioSQL(R('ddl/operacao_parametros.sql'));
const P = require('../fpmed_piso.js');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 320) + ']' : '')); } n++; };
console.log('SUITE testa_piso — o terceiro número, e o único que protege o bolso\n');

const PAR = {
  tributos: { componente: 'tributos', vigencia_inicio: '2026-01-01', regime: 'simples', aliquota_pct: 10 },
  frete:    { componente: 'frete',    vigencia_inicio: '2026-01-01', frete_tipo: 'valor', frete_valor: 0 },
  rateio:   { componente: 'rateio',   vigencia_inicio: '2026-01-01', custo_fixo_mensal: 0, volume_mensal: 1 },
};

// ── 1. O IMPOSTO DIVIDE ─────────────────────────────────────────────────────────────────────
console.log('── 1. o imposto incide sobre a venda ──');
const r100 = P.calcular({ custoUnit: 100, params: PAR });
/* O COMPORTAMENTO, e não o texto. Com custo 100 e 10%, o piso certo é 111,111… A conta intuitiva
   daria 110 — e a 110 o imposto é 11, sobrando 99 para pagar um custo de 100. */
ok('*** o piso de custo 100 com 10% é 111,111… e NÃO 110 ***',
  Math.abs(r100.piso - 1000 / 9) < 1e-9, r100.piso);
ok('*** no piso, o que sobra depois do imposto é EXATAMENTE o custo (identidade) ***',
  Math.abs(r100.piso * 0.9 - 100) < 1e-9, r100.piso * 0.9);
const r25 = P.calcular({ custoUnit: 100, params: { tributos: { regime: 'real', aliquota_pct: 25 }, frete: PAR.frete, rateio: PAR.rateio } });
ok('*** com 25%, o piso é 133,33 — a conta intuitiva (125) fica 6,25% abaixo ***',
  Math.abs(r25.piso - 400 / 3) < 1e-9 && Math.abs((1 - 125 / r25.piso) * 100 - 6.25) < 1e-6, r25.piso);
/* O ASSERT PELO AVESSO: o motor não pode conter a multiplicação. O padrão procura a ASSINATURA da
   conta errada (`* (1 + ...)` sobre a alíquota), não a palavra — quem comete o erro não o chama
   de erro. E ele não pode passar a existir "só num caso especial". */
ok('*** o motor não tem nenhuma multiplicação por (1 + alíquota) escondida ***',
  !/\*\s*\(\s*1\s*\+\s*a(liq)?\b/.test(MOTOR), (MOTOR.match(/\*\s*\(\s*1\s*\+[^)]*\)/g) || []).slice(0, 3));
ok('...e a divisão por (1 − alíquota) está lá, uma vez só',
  (MOTOR.match(/\/\s*\(\s*1\s*-\s*aliq\s*\)/g) || []).length === 1);
ok('as parcelas somam o piso (a conta que a tela mostra fecha)',
  Math.abs(r100.parcelas.compra + r100.parcelas.frete + r100.parcelas.rateio + r100.parcelas.impostos - r100.piso) < 1e-9);

// ── 2. SEM PARÂMETRO NÃO HÁ PISO ────────────────────────────────────────────────────────────
console.log('── 2. o que falta tem nome, e não vira zero ──');
const nada = P.vigentes([], '2026-08-20');
ok('*** sem nenhum parâmetro, faltam os TRÊS componentes ***', P.faltas(nada).length === 3);
ok('...e cada falta traz o NOME do que falta, para a tela repetir',
  P.faltas(nada).every(x => /regime|frete|custo fixo/.test(x.falta)), P.faltas(nada).map(x => x.falta));
const semP = P.avaliar({ custoUnit: 10, precoUnit: 30, params: nada });
ok('*** `avaliar` devolve estado `sem_parametro` e piso NULL — nunca 0 ***',
  semP.estado === 'sem_parametro' && semP.piso === null, semP);
/* O ATALHO PROIBIDO, cobrado pelo avesso: nada de "assume 0% enquanto ninguém cadastra". Um
   default silencioso aqui faria o piso virar o custo e a tela ficar MAIS perigosa que vazia. */
ok('*** o motor não tem alíquota padrão escondida (nem 0, nem outra) ***',
  !/aliquota_pct\s*\|\|/.test(MOTOR) && !/aliquota\w*\s*=\s*\d/.test(MOTOR));
ok('*** faltando SÓ o rateio, ainda não há piso (dois de três não é dois terços de piso) ***',
  P.avaliar({ custoUnit: 10, params: { tributos: PAR.tributos, frete: PAR.frete, rateio: null } }).estado === 'sem_parametro');
ok('rateio com volume ZERO conta como falta (divisão por nada não vira piso infinito)',
  P.faltas({ tributos: PAR.tributos, frete: PAR.frete, rateio: { custo_fixo_mensal: 1, volume_mensal: 0 } }).length === 1);
ok('alíquota de 100% conta como falta (o divisor seria zero, e acima dele o piso sairia NEGATIVO)',
  P.faltas({ tributos: { regime: 'real', aliquota_pct: 100 }, frete: PAR.frete, rateio: PAR.rateio }).length === 1);
/* FRETE ZERO É RESPOSTA, e tem de continuar sendo. Confundir "zero informado" com "não informado"
   apagaria o piso de uma operação inteira cujo fornecedor entrega sem cobrar. */
ok('*** frete ZERO informado NÃO conta como falta (zero é uma resposta) ***',
  P.faltas({ tributos: PAR.tributos, frete: { frete_tipo: 'valor', frete_valor: 0 }, rateio: PAR.rateio }).length === 0);

// ── 3. ZERO NÃO É CUSTO, E ESTIMADO NÃO É CUSTO ─────────────────────────────────────────────
console.log('── 3. o custo que não existe ──');
ok('*** custo ZERO não vira piso (há uma linha assim neste banco, medida) ***',
  P.avaliar({ custoUnit: 0, precoUnit: 5, params: PAR }).estado === 'sem_custo');
ok('custo nulo idem', P.avaliar({ custoUnit: null, params: PAR }).estado === 'sem_custo');
ok('*** custo ESTIMADO (venda ÷ 1,25) não vira piso — piso sobre chute é chute ***',
  P.avaliar({ custoUnit: null, custoEstimado: true, params: PAR }).estado === 'custo_estimado');
ok('...e nesses estados a folga é ausente, nunca 0%',
  P.avaliar({ custoUnit: 0, precoUnit: 5, params: PAR }).folgaPct == null);

// ── 4. A FOLGA, O PREJUÍZO E O ARREDONDAMENTO ───────────────────────────────────────────────
console.log('── 4. a terceira folga e o sinal de perigo ──');
const acima = P.avaliar({ custoUnit: 90, precoUnit: 200, unidades: 1000, params: PAR });
/* O SINAL É O MESMO DAS OUTRAS DUAS FOLGAS DA LINHA: positivo = sobra. Três selos lado a lado com
   sinais trocados fariam a mesma pessoa ler "-12%" como bom num e ruim noutro. */
ok('*** preço acima do piso dá folga POSITIVA (o mesmo sinal do teto legal e do competitivo) ***',
  acima.folgaPct > 0 && acima.abaixo === false, acima.folgaPct);
ok('a folga é sobre o PREÇO (é o que se compara com as outras duas), e em reais também',
  Math.abs(acima.folgaPct - ((200 - acima.piso) / 200) * 100) < 1e-9 && Math.abs(acima.folgaReais - (200 - acima.piso)) < 1e-9);
const perde = P.avaliar({ custoUnit: 90, precoUnit: 50, unidades: 1000, params: PAR });
ok('*** abaixo do piso: prejuízo por unidade E no item inteiro, com número ***',
  perde.abaixo === true && perde.prejuizoUnit > 0
  && Math.abs(perde.prejuizoTotal - perde.prejuizoUnit * 1000) < 1e-6, { u: perde.prejuizoUnit, t: perde.prejuizoTotal });
ok('sem quantidade, o prejuízo total é null — e nunca zero ("não custa nada" seria o contrário)',
  P.avaliar({ custoUnit: 90, precoUnit: 50, params: PAR }).prejuizoTotal === null);
ok('sem preço proposto, a folga é null e NUNCA 0% (0% afirmaria "ficou exatamente no piso")',
  P.avaliar({ custoUnit: 90, params: PAR }).folgaPct === null);
/* ARREDONDAR PISO PARA BAIXO É CRIAR UM PISO ABAIXO DO PISO. Irrelevante numa unidade, R$ 111 em
   cem mil — que é o tamanho de uma ata. */
const dizima = P.calcular({ custoUnit: 100, params: PAR });
ok('*** o piso exibido é arredondado PARA CIMA (111,1111 -> 111,12) ***',
  dizima.pisoCentavos === 111.12, dizima.pisoCentavos);
ok('...e ele nunca fica abaixo do calculado', dizima.pisoCentavos >= dizima.piso);
ok('exatamente NO piso não é "abaixo" (a fronteira não escorrega)',
  P.avaliar({ custoUnit: 90, precoUnit: P.calcular({ custoUnit: 90, params: PAR }).piso, params: PAR }).abaixo === false);

// ── 5. A VIGÊNCIA ───────────────────────────────────────────────────────────────────────────
console.log('── 5. proposta velha continua explicável ──');
const linhas = [
  { componente: 'tributos', vigencia_inicio: '2026-01-01', regime: 'simples', aliquota_pct: 6 },
  { componente: 'tributos', vigencia_inicio: '2026-07-01', regime: 'presumido', aliquota_pct: 11 },
  { componente: 'tributos', vigencia_inicio: '2099-01-01', regime: 'real', aliquota_pct: 25 },
];
ok('*** em 15/06 vale a alíquota de janeiro, e não a de julho ***',
  P.vigentes(linhas, '2026-06-15').tributos.aliquota_pct === 6);
ok('...em 20/08 vale a de julho', P.vigentes(linhas, '2026-08-20').tributos.aliquota_pct === 11);
/* A LINHA QUE COMEÇA HOJE VALE HOJE. É o caso que um `<` no lugar de `<=` erraria, e ele custaria
   um dia inteiro de piso ausente sem sintoma nenhum. */
ok('*** a vigência que começa NA data pedida já vale nela ***',
  P.vigentes(linhas, '2026-07-01').tributos.aliquota_pct === 11);
ok('*** e a vigência FUTURA não vale hoje (senão a alíquota de 2099 já estaria no preço) ***',
  P.vigentes(linhas, '2026-08-20').tributos.aliquota_pct !== 25);
ok('linha inativa não entra na disputa',
  P.vigentes([{ componente: 'tributos', vigencia_inicio: '2026-08-01', regime: 'real', aliquota_pct: 25, ativo: false }], '2026-08-20').tributos === null);
/* A DATA É COMPARADA COMO TEXTO ISO, e não como `Date`. `new Date('2026-08-20')` é UTC: às 21h de
   Goiás ele já é 21/08, e uma vigência de amanhã passaria a valer hoje à noite. */
ok('*** o motor não constrói `new Date` a partir da vigência (o fuso viraria o dia) ***',
  !/new Date\(\s*(l|linha|atual)\./.test(MOTOR));

// ── 6. UMA CONTA SÓ, E ELA NÃO É REIMPLEMENTADA NA TELA ─────────────────────────────────────
console.log('── 6. a tela pergunta, o motor responde ──');
for (const [nome, txt] of [['Proposta', GIO], ['Documentos', DOC]]) {
  ok(nome + ' carrega o motor compartilhado', /<script src="fpmed_piso\.js"><\/script>/.test(txt));
}
ok('a Proposta chama `avaliar` do motor', /FPMED_PISO[\s\S]{0,80}\.avaliar\(|P\.avaliar\(/.test(GIO));
ok('a Documentos usa a LISTA de componentes do motor, e não uma cópia dela',
  /FPMED_PISO[\s\S]{0,40}COMPONENTES|P\.COMPONENTES/.test(DOC));
/* O ASSERT PELO AVESSO: nenhuma das duas telas pode ter a divisão do piso escrita nela. Quem
   reimplementa raramente chama de "piso" — então o padrão procura a ASSINATURA da conta, e não a
   palavra.
   >>> A PRIMEIRA VERSÃO DESTE ASSERT EXIGIA A PALAVRA "aliq" NO DIVISOR, e a mutação
       `custo / (1 - a)` passou por baixo dela — quem reimplementa também não chama a variável de
       "aliquota". Agora ele cobra a FORMA `/ (1 - …)`, que é o desenho da conta, venha o nome que
       vier. Medido: as duas telas têm ZERO ocorrências dela hoje, então o assert não nasce com
       exceção nenhuma pendurada. */
for (const [nome, txt] of [['Proposta', GIO], ['Documentos', DOC]]) {
  ok(nome + ': *** não há a conta do piso reimplementada na tela ***',
    !/\/\s*\(\s*1\s*-/.test(txt), (txt.match(/\/\s*\(\s*1\s*-[^)]*\)/g) || []).slice(0, 3));
}
ok('o motor entra na casca do service worker (senão o recurso existe só para quem chegou hoje)',
  /\.\/fpmed_piso\.js/.test(SW));
ok('...e a versão da casca foi bumpada nesta fatia (-87 ou maior)',
  (Number((SW.match(/limedtec-fpmed-\d{4}-\d{2}-\d{2}-(\d+)/) || [])[1]) || 0) >= 87,
  (SW.match(/limedtec-fpmed-[\d-]+/) || [])[0]);

// ── 7. A TELA DIZ O QUE FALTA, E MOSTRA A CONTA ─────────────────────────────────────────────
console.log('── 7. a conta aberta e o estado honesto na tela ──');
const BADGE = (GIO.match(/function pisoBadgeHTML\(r\)\{[\s\S]*?\n\}/) || [''])[0];
ok('a Proposta tem o selo do piso', !!BADGE);
ok('*** o selo diz "não dá para calcular o piso" e nomeia o que falta ***',
  /não dá para calcular o piso/.test(BADGE) && /faltam/.test(BADGE), BADGE.slice(0, 200));
ok('*** o estado vazio não é R$ 0,00 nem um travessão solto ***',
  !!BADGE && !/R\$\s*0,00/.test(BADGE) && !/>\s*—\s*</.test(BADGE));
/* "NÃO CONSEGUI LER" ≠ "NÃO ESTÁ CADASTRADO". A segunda mandaria a pessoa cadastrar de novo o que
   já existe — e cadastrar de novo cria uma segunda vigência no mesmo dia, que o índice único do
   banco recusa. Seria um erro em cima de outro, com ela convencida de que a culpa é dela. */
ok('falha de LEITURA tem estado próprio, separado de "falta parâmetro"',
  /estado === 'erro'/.test(BADGE) && /piso indisponível/.test(BADGE)
  && /_pisoErro/.test(GIO) && !/piso indisponível/.test(BADGE.split("sem_parametro")[1] || ''), BADGE.slice(0, 200));
ok('*** e o selo diz "sem custo de compra cadastrado" no item sem custo ***',
  /sem custo de compra cadastrado/.test(BADGE));
const CONTA = (GIO.match(/function pisoContaHTML\(r\)\{[\s\S]*?\n\}/) || [''])[0];
ok('a conta aberta existe e mostra as CINCO parcelas, não só o total',
  !!CONTA && /compra/.test(CONTA) && /frete/.test(CONTA) && /rateio/.test(CONTA)
  && /custo/.test(CONTA) && /impostos/.test(CONTA), CONTA.slice(0, 160));
/* ELA NÃO PODE SER SÓ `title`: tooltip só existe para quem passa o mouse, e "gestor que não vê a
   conta não confia no número" não se resolve com dica escondida. */
/* E ELA TEM DE ESTAR DENTRO DO `renderItens`, e não só nas repinturas. A primeira versão deste
   assert procurava `piso-conta-` na tela inteira — e a mutação que APAGA a conta da linha do item
   passou, porque o mesmo texto continuava existindo no `setPrecoEdit`. O sintoma seria uma conta
   que só aparece depois que alguém digita no preço: invisível para quem só olha. */
const REND = (GIO.match(/function renderItens\(\) \{[\s\S]*?\n\}/) || [''])[0];
ok('*** a conta sai na LINHA do item (dentro do renderItens), e não só num `title` ***',
  /piso-conta/.test(CONTA) && /id="piso-conta-/.test(REND), REND.slice(0, 80));
ok('o prejuízo aparece por unidade E no item inteiro', /prejuizoUnit/.test(CONTA) && /prejuizoTotal/.test(CONTA));
/* AVISA, NÃO IMPEDE: o dono pode ter razão para ir abaixo do piso (queimar estoque perto do
   vencimento). O que ele não pode é ir sem saber de quanto é. */
/* O ASSERT É SOBRE OS BLOCOS DO PISO, e não sobre a tela inteira: a Proposta tem `disabled` e
   `confirm()` legítimos em outros lugares (importação, envio), e cobrar deles seria vermelho que
   trabalho nenhum apaga. */
const AVAL = (GIO.match(/function avaliarPiso\(c, precoUnit\)\{[\s\S]*?\n\}/) || [''])[0];
ok('*** nada no piso bloqueia o preço: sem `disabled`, sem `confirm`, sem `alert` ***',
  !!AVAL && [BADGE, CONTA, AVAL].every(b => !/disabled|confirm\(|alert\(/.test(b)),
  [BADGE, CONTA, AVAL].map(b => (b.match(/disabled|confirm\(|alert\(/) || [''])[0]));
/* OS TRÊS SELOS REPINTAM JUNTOS. Um deles atrasado mostraria duas conclusões sobre preços
   diferentes na mesma linha — pior do que mostrar uma só. */
const SET = (GIO.match(/function setPrecoEdit\(id, v\) \{[\s\S]*?\n\}/) || [''])[0];
ok('*** o selo do piso repinta tecla a tecla, junto com os outros dois ***',
  /piso-badge-/.test(SET) && /teto-badge-/.test(SET) && /homol-badge-/.test(SET));
ok('...e a conta aberta repinta junto com ele', /piso-conta-/.test(SET));
/* ELE SOME DO PAPEL, como os dois irmãos: custo e margem impressos numa proposta que vai para o
   órgão é a última coisa que esta casa quer. */
ok('*** o selo e a conta somem na impressão ***',
  /@media print\{[^}]*\.piso-badge\{display:none/.test(R('fpmed_giovana.html').replace(/\s+/g, ' ').replace(/ \{/g, '{').replace(/\{ /g, '{'))
  || /\.piso-badge\{display:none !important\}/.test(R('fpmed_giovana.html')));

// ── 8. O BANCO GUARDA A LEI ─────────────────────────────────────────────────────────────────
console.log('── 8. meio parâmetro é impossível no banco ──');
ok('a DDL existe e cria a tabela', /create table if not exists public\.operacao_parametros/.test(DDL));
ok('*** o CHECK de coerência existe (meio componente não entra) ***', /op_par_coerente/.test(DDL));
ok('*** volume mensal tem de ser > 0 no próprio banco ***', /volume_mensal\s+numeric\s+check \(volume_mensal > 0\)/.test(DDL));
ok('*** alíquota é barrada em 100% no próprio banco ***', /aliquota_pct < 100/.test(DDL));
ok('duas vigências no mesmo dia são impossíveis (índice único parcial)',
  /create unique index[\s\S]{0,200}componente, vigencia_inicio\)[\s\S]{0,40}where ativo/.test(DDL));
/* SEM DELETE, E É DECISÃO: parâmetro apagado é proposta velha que perde a explicação. */
ok('*** não há policy de DELETE (apagar parâmetro apagaria a explicação de proposta velha) ***',
  !/for delete/.test(DDL));
ok('escrever é só de gestor', /op_par_ins[\s\S]{0,120}cargo_gestor\(\)/.test(DDL));
ok('e ninguém anônimo lê', /revoke all on public\.operacao_parametros from anon/.test(DDL));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
