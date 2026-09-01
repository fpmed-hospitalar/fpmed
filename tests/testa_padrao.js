// SUITE testa_padrao - a PROVA DO PADRAO (prova_padrao).
//
// == POR QUE ELA MORA EM tests/ E NAO EM tools/ =================================
// Porque "o padrao que nao se fiscaliza vira enfeite" (secao 7 do
// PADRAO_EXCELENCIA.md). Uma prova em tools/ so roda quando alguem lembra dela -
// e ninguem lembra de fiscalizar a propria disciplina no dia em que esta com
// pressa, que e exatamente o dia em que a disciplina cede. Aqui dentro, ela roda
// em TODA rodada do run_all e fica vermelha no minuto em que o padrao for
// desrespeitado.
//
// == O QUE ELA NAO CONSEGUE VERIFICAR ===========================================
// Se o relatorio entregue no chat seguiu o modelo, e se o teste do bater o olho
// foi honesto. As duas dependem de mim, e por isso estao escritas em publico no
// documento que o dono le - a fiscalizacao delas e ele.
//
//   node tests/testa_padrao.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = (...p) => path.join(__dirname, '..', ...p);
const existe = (...p) => fs.existsSync(raiz(...p));
const ler = (...p) => fs.readFileSync(raiz(...p), 'utf8').replace(/\r\n/g, '\n');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_padrao - a prova do padrao\n');

// ── 1. os documentos existem ─────────────────────────────────────────────────
// Doutrina que sumiu do repo nao rege nada. Este bloco e o mais bobo da suite e
// o mais importante: e o que impede o padrao de morrer de esquecimento.
const DOCS = {
  'docs/constituicao.md': 'a ordem permanente do dono',
  'docs/manual_fundamentos.md': 'a ciencia (F1-F9)',
  'docs/manual_excelencia.md': 'o metodo (L, P, A)',
  'docs/manual_design.md': 'o visual (Regra Zero, D1-D14)',
  'docs/PADRAO_EXCELENCIA.md': 'o documento-mestre',
  'docs/jornadas.md': 'as jornadas com nota',
};
let n = 1;
for (const d in DOCS) { ok(n + '. existe ' + d + ' - ' + DOCS[d], existe(d)); n++; }

const PAD = existe('docs/PADRAO_EXCELENCIA.md') ? ler('docs/PADRAO_EXCELENCIA.md') : '';
const CON = existe('docs/constituicao.md') ? ler('docs/constituicao.md') : '';
const FUN = existe('docs/manual_fundamentos.md') ? ler('docs/manual_fundamentos.md') : '';
const EXC = existe('docs/manual_excelencia.md') ? ler('docs/manual_excelencia.md') : '';
const DES = existe('docs/manual_design.md') ? ler('docs/manual_design.md') : '';
const JOR = existe('docs/jornadas.md') ? ler('docs/jornadas.md') : '';

// ── 2. cada documento traz o que o dono exigiu ───────────────────────────────
// Documento esvaziado por um "resumo" bem-intencionado e documento perdido: o
// arquivo continua la, o conteudo nao.
ok(n + '. o padrao tem as 7 secoes que o dono pediu',
  ['A PÁGINA DE OURO', 'A LINHA DE PRODUÇÃO', 'DEFINIÇÃO DE PRONTO',
   'LIÇÕES DE SANGUE', 'JURAMENTO DO RELATÓRIO', 'DOCUMENTO VIVO',
   'AUTO-FISCALIZAÇÃO'].every(s => PAD.includes(s)),
  ['A PÁGINA DE OURO', 'A LINHA DE PRODUÇÃO', 'DEFINIÇÃO DE PRONTO',
   'LIÇÕES DE SANGUE', 'JURAMENTO DO RELATÓRIO', 'DOCUMENTO VIVO',
   'AUTO-FISCALIZAÇÃO'].filter(s => !PAD.includes(s))); n++;

// A pagina de ouro tem teto de 15 linhas por decisao do dono. Se ela crescer,
// deixa de ser o que se rele antes de cada tarefa e vira mais um manual.
const ouro = (PAD.match(/## 1 · A PÁGINA DE OURO[\s\S]*?\n---/) || [''])[0];
const linhasOuro = (ouro.match(/^\d+\.\s/gm) || []).length;
ok(n + '. a pagina de ouro cabe em 15 linhas (senao ela deixa de ser releitura e vira manual)',
  linhasOuro > 0 && linhasOuro <= 15, linhasOuro); n++;

ok(n + '. a linha de producao tem as 8 estacoes, cada uma com criterio de "pode passar"',
  (PAD.match(/### Estação \d/g) || []).length === 8 &&
  (PAD.match(/\*\*Pode passar quando:\*\*/g) || []).length === 8,
  { estacoes: (PAD.match(/### Estação \d/g) || []).length,
    criterios: (PAD.match(/\*\*Pode passar quando:\*\*/g) || []).length }); n++;

ok(n + '. a definicao de pronto e uma lista de caixas, nao um paragrafo bonito',
  ((PAD.match(/## 3 · DEFINIÇÃO DE PRONTO[\s\S]*?\n---/) || [''])[0].match(/^- \[ \]/gm) || []).length >= 15); n++;

ok(n + '. o modelo de relatorio traz todos os campos do juramento',
  ['FILA', 'O QUE MUDOU NA TELA DELE', 'AS DECISÕES E AS LEIS',
   'O QUE FOI PROVADO', 'RITUAL', 'PRINTS', 'JORNADAS', 'PRECISO DO LEMUEL']
   .every(c => PAD.includes(c))); n++;

ok(n + '. a constituicao nomeia o tripe inteiro',
  ['manual_fundamentos.md', 'manual_excelencia.md', 'manual_design.md'].every(x => CON.includes(x))); n++;
ok(n + '. os nove fundamentos estao no manual da ciencia',
  [1,2,3,4,5,6,7,8,9].every(i => new RegExp('## F' + i + '\\.').test(FUN))); n++;
ok(n + '. a lei L11 (pesquisar antes de construir) esta no manual do metodo',
  /### L11\./.test(EXC) && /Regra Zero/.test(EXC)); n++;
ok(n + '. as 14 leis do visual estao no manual do design',
  Array.from({length: 14}, (_, i) => i + 1).every(i => new RegExp('### D' + i + '\\.').test(DES)),
  Array.from({length: 14}, (_, i) => i + 1).filter(i => !new RegExp('### D' + i + '\\.').test(DES))); n++;
ok(n + '. o processo por tela termina no teste do bater o olho', /TESTE DO BATER O OLHO/.test(DES)); n++;

// ── 3. as licoes de sangue ───────────────────────────────────────────────────
// Licao sem regra e anedota: bonita de contar, inutil pra impedir a repeticao.
const licoes = PAD.match(/### S(\d+) —/g) || [];
const nums = licoes.map(x => +x.match(/\d+/)[0]);
ok(n + '. existe capitulo de licoes de sangue com licao de verdade', nums.length >= 10, nums.length); n++;
ok(n + '. as licoes sao numeradas em sequencia, sem buraco e sem repetida (relatorio antigo cita o numero)',
  nums.every((x, i) => x === i + 1), nums); n++;
const corpoLicoes = (PAD.match(/## 4 · AS LIÇÕES DE SANGUE[\s\S]*?\n## 5/) || [''])[0];
ok(n + '. TODA licao traz a regra que a impede de voltar',
  (corpoLicoes.match(/> \*\*Regra:\*\*/g) || []).length === nums.length,
  { licoes: nums.length, regras: (corpoLicoes.match(/> \*\*Regra:\*\*/g) || []).length }); n++;

// As quatro que este projeto pagou mais caro. Se alguem "enxugar" o capitulo,
// que pelo menos nao consiga enxugar estas.
ok(n + '. a licao do teto do servidor esta escrita', /limit=3000|PostgREST/.test(corpoLicoes)); n++;
ok(n + '. a licao da prova que passou com a tela errada esta escrita',
  /mesmo caminho do usuário/.test(corpoLicoes)); n++;
ok(n + '. a licao do "nao sei" que virou zero esta escrita', /nunca vira zero/.test(corpoLicoes)); n++;
ok(n + '. a licao do erro engolido esta escrita', /catch` vazio|catch \{\}/.test(corpoLicoes)); n++;

// ── 4. o documento vivo ──────────────────────────────────────────────────────
ok(n + '. a regra de atualizacao exige medicao (susto e achismo nao entram)',
  /custou caro e foi medido/.test(PAD)); n++;
ok(n + '. e proibe renumerar licao', /nunca são renumeradas/.test(PAD)); n++;

// ── 5. as jornadas ───────────────────────────────────────────────────────────
// Contar SEIS linhas nao prova que as seis jornadas estao la: a numeracao tem que
// ser 1..6 exatamente. (Um teste de mutacao trocou a jornada 3 pela 9 e este
// assert passou verde - o buraco era meu, e esta e a correcao.)
const numJor = (JOR.match(/^\| (\d+) \|/gm) || []).map(x => +x.match(/\d+/)[0]);
ok(n + '. as 6 jornadas estao na tabela, numeradas de 1 a 6 sem buraco',
  numJor.length === 6 && numJor.every((x, i) => x === i + 1), numJor); n++;
ok(n + '. cada jornada tem nota de cor', (JOR.match(/🔴|🟡|🟢/g) || []).length >= 6); n++;
ok(n + '. e cada linha tem o "por que" escrito junto da nota (nota sem motivo nao vale)',
  (JOR.match(/^\| \d+ \|/gm) || []).every((_, i) => {
    const linha = JOR.split('\n').filter(l => /^\| \d+ \|/.test(l))[i];
    return linha.split('|').filter(Boolean).pop().trim().length > 60;
  })); n++;

// ── 6. o tema, que e onde o padrao vira pixel ────────────────────────────────
ok(n + '. o design system existe', existe('fpmed_tema.css')); n++;
const CSS = existe('fpmed_tema.css') ? ler('fpmed_tema.css') : '';
const semCom = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const mRaiz = semCom.match(/:root\s*\{([\s\S]*?)\n\}/);
const fora = mRaiz ? semCom.replace(mRaiz[0], '') : semCom;

ok(n + '. tem as familias de token obrigatorias',
  ['--cinza-800', '--azul-500', '--verde-500', '--esp-4', '--raio-cartao',
   '--sombra-1', '--txt-2', '--peso-semi', '--transicao', '--foco']
   .every(t => (mRaiz ? mRaiz[1] : '').includes(t))); n++;

// A regra que mais depende de disciplina humana e a que mais precisa de assert.
ok(n + '. ZERO cor fora do :root - a regra que sustenta o P6 inteiro',
  (fora.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) || []).length === 0,
  (fora.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) || [])); n++;
ok(n + '. ZERO espacamento literal em padding/margin/gap',
  (fora.match(/(?:padding|margin|gap)[a-z-]*\s*:\s*[^;}]*?\b\d+px/g) || []).length === 0,
  (fora.match(/(?:padding|margin|gap)[a-z-]*\s*:\s*[^;}]*?\b\d+px/g) || [])); n++;

// "Sem apagao" aplicado ao CSS: carregar o tema em qualquer tela nao muda um pixel
// sozinho. E o que permite adotar tela a tela em vez de tudo de uma vez.
const seletores = (fora.match(/(^|\})\s*([^{}@]+)\{/g) || [])
  .map(s => s.replace(/^[\}\s]*/, '').replace(/\s*\{$/, '').trim())
  .flatMap(s => s.split(',').map(x => x.trim()))
  .filter(s => s && !/^\d+%$/.test(s) && s !== 'from' && s !== 'to');
/* ══ A A53 (01/09/2026): ELE MEDIA A LETRA; A PROMESSA E "NAO AGE SEM A TELA PEDIR" ═══════
   Exigia que todo seletor COMECASSE com `.` ou `:root`. A A53 trouxe o caso em que o proxy
   e a promessa se separam: `html:has(body.fp-imprimivel) #gm-auth-overlay`, dentro do
   @media print. O #gm-auth-overlay do gm-auth.js e filho direto do <html> - nao mora no
   <body> -, entao nenhum seletor iniciado em `.fp-imprimivel` alcanca ele. A regra precisa
   comecar em `html`, mas e TRANCADA por :has(body.fp-imprimivel): em tela que nao optou,
   ela nao existe. A promessa esta intacta; so a letra nao estava.
   >>> AGORA COBRA A PROMESSA: todo seletor tem de CONTER uma classe .fp- (ou ser :root).
       Continua barrando `button{...}` e `#alguma-coisa{...}` soltos, que era o ponto.
   >>> ESTA MESMA REGRA MORA EM DUAS SUITES (aqui e no testa_tema, assert 18). Alinhei as
       duas; a divida de ter DUAS VOZES para a mesma regra fica anotada - foi ela que fez
       este assert reprovar sozinho depois de a irma ja ter sido corrigida. */
ok(n + '. o tema e inerte: todo seletor e trancado por uma classe .fp-, entao carregar nao muda tela nenhuma',
  seletores.every(s => /\.fp-/.test(s) || /^:root\b/.test(s)),
  seletores.filter(s => !/\.fp-/.test(s) && !/^:root\b/.test(s))); n++;

// Estado que nao existe no tema nasce improvisado na tela - e improviso nao se
// repete igual duas vezes, que e o oposto de P6.
const ESTADOS = {
  // O skeleton e cobrado pelo brilho, e nao pelo nome da classe: classe vazia
  // com o nome certo passaria num assert que so procura o seletor.
  'carregando (skeleton)': /\.fp-skeleton\{[^}]*fp-brilho/,
  'vazio com acao': /\.fp-vazio\{/,
  'erro que nao grita': /\.fp-aviso--erro\{/,
  'hover': /--clicavel:hover\{/,
  'foco visivel': /:focus-visible\{/,
  'desabilitado': /\[disabled\]/,
};
for (const e in ESTADOS) { ok(n + '. estado desenhado no tema: ' + e, ESTADOS[e].test(semCom)); n++; }

// ── 7. a fiscalizacao do contraste continua viva ─────────────────────────────
// "AA medido, nao AA alegado" so vale enquanto a medicao existir. Se alguem
// apagar o bloco de contraste da suite do tema, o padrao perde o dente mais
// afiado que ele tem - e perde em silencio.
ok(n + '. a suite do tema existe', existe('tests/testa_tema.js')); n++;
const TT = existe('tests/testa_tema.js') ? ler('tests/testa_tema.js') : '';
// Os TRES coeficientes, e nao "algum deles": o olho humano nao pesa vermelho,
// verde e azul igual, e trocar um so ja transforma a medicao em decoracao.
// (Outro buraco achado por mutacao: com "ou", adulterar o 0.2126 passava verde.)
ok(n + '. ela calcula contraste pela formula da WCAG, com os tres coeficientes intactos',
  /0\.2126/.test(TT) && /0\.7152/.test(TT) && /0\.0722/.test(TT) &&
  /1\.055/.test(TT) && /0\.03928/.test(TT) && /12\.92/.test(TT)); n++;
ok(n + '. e mede pelo menos 20 pares reais do tema', (TT.match(/^\s*\['/gm) || []).length >= 20,
  (TT.match(/^\s*\['/gm) || []).length); n++;
ok(n + '. o limite cobrado e o AA de texto normal (4.5:1)', />= 4\.5/.test(TT)); n++;
ok(n + '. e ha assert exigindo que o verde da marca REPROVE como texto (senao alguem "conserta" a marca)',
  /reprova como texto sobre branco/.test(TT)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
