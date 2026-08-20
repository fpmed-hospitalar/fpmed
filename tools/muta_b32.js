/* ══════════════════════════════════════════════════════════════════════════════════════════════
   muta_b32.js — APONTA A CATRACA DA LISTA DA MANHÃ PARA O MATERIAL DE VERDADE (20/08/2026)

   Mesma lei do `muta_b30.js`, e ela vem da B26: *"um detector provado só contra exemplos que eu
   mesmo escrevi herda o meu engano inteiro, e herda em silêncio, com relatório verde."* A
   `tests/testa_vai_embora.js` nasceu VERDE na primeira rodada — e suíte que nasce verde é
   exatamente a que ninguém sabe se morde. Aqui ela é apontada para os arquivos REAIS da fatia,
   com o defeito plantado dentro deles, e cobrada de vermelho.

   ══ O QUE ESTA FATIA TEM DE PARTICULAR, E É PIOR QUE O DA B30 ═══════════════════════════════
   Na B30 o defeito imprimia um número redondo com cara de conta feita. **Aqui o defeito não
   imprime nada.** Uma linha a menos numa lista de urgência não levanta exceção, não pinta
   vermelho, não muda o tempo de carregamento: a tela fica mais curta, e lista curta lê-se como
   *"pouca coisa vencendo"*. O sintoma aparece semanas depois, na forma de uma ata que venceu.
   >>> POR ISSO QUASE TODA MUTAÇÃO DAQUI É UM `return` A MAIS OU UM CORTE A MENOS. É o formato do
       defeito verdadeiro desta tela, e é o que a catraca precisa provar que enxerga.

   ══ E ELA MEDE OS DOIS LADOS ════════════════════════════════════════════════════════════════
   `deveRuir: true` são defeitos — a catraca TEM de ficar vermelha. `deveRuir: false` são
   mudanças legítimas (prosa que nomeia o que a regra proíbe) — e a catraca TEM de deixar passar.
   Catraca que fica vermelha com as duas não protege nada; ela só ensina a apagar comentário.

     node tools/muta_b32.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ARQUIVOS = [
  'fpmed_vai_embora.js', 'fpmed_negocios.html', 'sw.js', 'tests/testa_vai_embora.js',
  // O OUTRO MOTOR ENTRA PORQUE ELE É O ORÁCULO da conta de dias — a suíte mede as duas
  // implementações uma contra a outra. Sem ele a cópia nem carrega.
  'fpmed_ata_saldo.js',
  // A régua do A é lida no `require` da suíte; o tema e a lista de telas adotadas são lidos por
  // ela. Sem eles o controle acusaria "já está vermelha" sobre um erro de arquivo faltando.
  // >>> `prova_papel_congelado.js` ENTROU NESTA LISTA EM 20/08 E NÃO ESTAVA NAS DE ANTES. A fatia
  //     A37 fez a régua do A passar a `require` a prova do papel congelado — e a partir daquele
  //     commit as `muta_b28/b29/b30` param no controle com *"JÁ ESTÁ VERMELHA"*, que é abortar,
  //     não escapar. O sintoma é honesto (elas param e dizem), mas a lista de arquivos de uma
  //     mutação é uma DEPENDÊNCIA IMPLÍCITA: ela quebra quando outra janela mexe no que ela copia.
  'tools/regua_visual.js', 'tools/prova_papel_congelado.js',
  'fpmed_tema.css', 'tests/telas_adotadas.json',
];
const SUITE = 'testa_vai_embora.js';
const MOTOR = 'fpmed_vai_embora.js';
const NEG = 'fpmed_negocios.html';
const OUTRO = 'fpmed_ata_saldo.js';

const MUTACOES = [
  // ── O CORTE QUE NÃO PODE NASCER AQUI ──────────────────────────────────────────────────────
  /* A MUTAÇÃO MAIS IMPORTANTE DESTA FATIA, e é a que um programador apressado escreveria de boa
     fé: "a tela é de 30 dias, então filtra tudo por 30". A partir daí a MESMA ata sai "vencendo"
     na aba Ata e ausente da lista da manhã — duas telas discordando sobre o mesmo contrato. */
  { nome: '*** a tela passa a ter corte PROPRIO e ignora a `situacao` que o cofre decidiu ***',
    deveRuir: true, arq: MOTOR,
    de: /if \(d\.situacao !== 'vencido' && d\.situacao !== 'vencendo'\) return;/,
    para: 'if (dias(d.validade, h) > 30) return;' },
  { nome: '*** a ata passa a obedecer um corte desta tela em vez do da v_atas_vigencia ***',
    deveRuir: true, arq: MOTOR,
    de: /if \(a\.situacao !== 'vencida' && a\.situacao !== 'vencendo'\) return;/,
    para: 'if (dias(a.ata_vigencia_fim, h) > 30) return;' },
  { nome: 'a janela da licitacao vira a da ata (60), e a lista enche de coisa que nao e pra hoje',
    deveRuir: true, arq: MOTOR, de: /var JANELA_LICITACAO = 30;/, para: 'var JANELA_LICITACAO = 60;' },
  { nome: 'a licitacao que ja passou volta a aparecer (nao ha o que propor sobre ela)',
    deveRuir: true, arq: MOTOR,
    de: /if \(d < 0\) \{ divida\.licitacaoJaPassou\+\+; return; \}/, para: '' },

  // ── O DEFEITO QUE NÃO IMPRIME NADA: A LINHA QUE SOME ──────────────────────────────────────
  { nome: '*** a certidao sem validade some sem ser contada no rodape ***', deveRuir: true, arq: MOTOR,
    de: /\{ divida\.certidaoSemValidade\+\+; return; \}/, para: '{ return; }' },
  { nome: '*** a ata sem validade some sem ser contada no rodape ***', deveRuir: true, arq: MOTOR,
    de: /\{ divida\.ataSemValidade\+\+; return; \}/, para: '{ return; }' },
  { nome: 'a licitacao sem data some sem ser contada', deveRuir: true, arq: MOTOR,
    de: /\{ divida\.licitacaoSemData\+\+; return; \}/, para: '{ return; }' },
  { nome: 'a licitacao que ja passou some sem ser contada', deveRuir: true, arq: MOTOR,
    de: /\{ divida\.licitacaoJaPassou\+\+; return; \}/, para: '{ return; }' },
  /* A ESTIMATIVA ENTRANDO PELA PORTA DOS FUNDOS: sem data, mas com uma data inventada. É o
     oposto do defeito acima e faz mais estrago — a linha aparece com um prazo que ninguém
     digitou, e alguém age sobre ele. */
  { nome: '*** a ata sem validade passa a entrar com uma data chutada ***', deveRuir: true, arq: MOTOR,
    de: /if \(a\.situacao === 'sem_vigencia' \|\| dataISO\(a\.ata_vigencia_fim\) == null\) \{ divida\.ataSemValidade\+\+; return; \}/,
    para: "if (dataISO(a.ata_vigencia_fim) == null) { a.ata_vigencia_fim = h; a.situacao = 'vencendo'; }" },

  // ── A ATA ARQUIVADA RESSUSCITANDO ─────────────────────────────────────────────────────────
  /* Esta tela desfazendo, em silêncio, um ato de gente: alguém arquivou com motivo e carimbo, e
     a lista da manhã traz a ata de volta como se nada tivesse acontecido. */
  { nome: '*** a ata arquivada volta a aparecer na lista da manha ***', deveRuir: true, arq: MOTOR,
    de: /if \(a\.arquivado_em\) \{ divida\.ataArquivada\+\+; return; \}/, para: '' },
  { nome: 'a arquivada e testada DEPOIS da validade, e passa a ser contada como "sem validade"',
    deveRuir: true, arq: MOTOR,
    de: /if \(a\.arquivado_em\) \{ divida\.ataArquivada\+\+; return; \}\n      if \(a\.situacao === 'sem_vigencia'/,
    para: "if (a.situacao === 'sem_vigencia'" },

  // ── A ORDEM, E O COMPARADOR PARCIAL ───────────────────────────────────────────────────────
  /* A LIÇÃO DA B28, no formato desta tela. Um comparador que só compara `dias` é ESTÁVEL no V8
     para arrays curtos e vira instável a partir de certo tamanho — quer dizer que ele funciona no
     dia do teste e reordena sozinho no dia em que a casa tiver dado. */
  { nome: '*** o desempate some e a lista se reorganiza sozinha entre dois carregamentos ***',
    deveRuir: true, arq: MOTOR,
    de: /if \(a\.dias !== b\.dias\) return a\.dias - b\.dias;\n      if \(PESO\[a\.fonte\] !== PESO\[b\.fonte\]\) return PESO\[a\.fonte\] - PESO\[b\.fonte\];\n      return \(a\.id \|\| 0\) - \(b\.id \|\| 0\);/,
    para: 'return a.dias - b.dias;' },
  { nome: 'o desempate por id some (duas atas do mesmo dia trocam de lugar)', deveRuir: true, arq: MOTOR,
    de: /return \(a\.id \|\| 0\) - \(b\.id \|\| 0\);/, para: 'return 0;' },
  { nome: '*** a ordem se inverte e quem morre primeiro vai pro FIM da lista ***',
    deveRuir: true, arq: MOTOR,
    de: /if \(a\.dias !== b\.dias\) return a\.dias - b\.dias;/,
    para: 'if (a.dias !== b.dias) return b.dias - a.dias;' },
  { nome: 'a lista passa a separar por tipo antes do prazo (as tres telas de volta)',
    deveRuir: true, arq: MOTOR,
    de: /if \(a\.dias !== b\.dias\) return a\.dias - b\.dias;\n      if \(PESO\[a\.fonte\] !== PESO\[b\.fonte\]\) return PESO\[a\.fonte\] - PESO\[b\.fonte\];/,
    para: 'if (PESO[a.fonte] !== PESO[b.fonte]) return PESO[a.fonte] - PESO[b.fonte];\n      if (a.dias !== b.dias) return a.dias - b.dias;' },

  // ── A CONTA DE DIAS ───────────────────────────────────────────────────────────────────────
  { nome: '*** a conta de dias diverge da do `fpmed_ata_saldo.js` (Math.floor) ***',
    deveRuir: true, arq: MOTOR, de: /return Math\.round\(/, para: 'return Math.floor(' },
  { nome: 'some o T12:00:00 de um dos lados (a folga contra o fuso vira meia folga)',
    deveRuir: true, arq: MOTOR,
    de: /new Date\(h \+ 'T12:00:00'\)/, para: "new Date(h + 'T00:00:00')" },
  { nome: 'o timestamptz do banco deixa de ser cortado em 10 e vira Date completo',
    deveRuir: true, arq: MOTOR,
    de: /var s = String\(v == null \? '' : v\)\.slice\(0, 10\);/, para: "var s = String(v == null ? '' : v);" },
  /* O ORÁCULO SENDO QUEBRADO DO OUTRO LADO. Se a suíte só medisse este motor, ela ficaria verde
     com o `fpmed_ata_saldo.js` errado — e a divergência entre as duas telas é o defeito.

     ══ AQUI ESTAVA `Math.ceil`, E ELE MEDIA ZERO ═════════════════════════════════════════════
     A primeira versão desta mutação trocava o `Math.round` do outro motor por `Math.ceil` e
     ESCAPOU. Fui ver por quê, e a resposta é a medição da B30 dita ao contrário: com os dois
     lados em `T12:00:00` e um fuso de deslocamento fixo (UTC−3), a divisão dá **sempre um
     inteiro exato** — então `round`, `ceil` e `floor` devolvem o mesmo número, e trocar um pelo
     outro é código EQUIVALENTE, não defeito. O `Math.round` daqueles dois arquivos não está
     arredondando nada nesta máquina: ele é a apólice contra o fuso que esta máquina não tem.
     >>> ISSO VALE PARA A `muta_b30.js` TAMBÉM, e está anotado no relatório: a mutação
         `round -> floor` de lá fica vermelha por um assert de TEXTO (`!/Math.floor/`), e não
         porque algum número mudou. O assert de texto é legítimo — o defeito é real no fuso
         errado — mas quem ler o placar precisa saber qual metade o pegou.
     >>> A MUTAÇÃO QUE MEDE DE VERDADE é esta: tirar o `T12:00:00` de UM lado do outro motor. Aí
         a diferença deixa de ser inteira, o arredondamento passa a decidir, e as duas telas
         começam a discordar sobre a mesma ata — que é exatamente o defeito que este oráculo
         existe para pegar. */
  { nome: '*** o OUTRO motor e que passa a divergir, e a catraca tem de ver do mesmo jeito ***',
    deveRuir: true, arq: OUTRO,
    de: /new Date\(h \+ 'T12:00:00'\)\) \/ 86400000\);/, para: "new Date(h)) / 86400000);" },

  // ── A LEI DA CASA: `null` É "NÃO INFORMADO", `0` É UMA AFIRMAÇÃO ──────────────────────────
  { nome: '*** ata sem item informado passa a dizer "0 itens com saldo" ***', deveRuir: true, arq: MOTOR,
    de: /unidades: num\(a\.itens_com_saldo\) \|\| null,/, para: 'unidades: num(a.itens_com_saldo) || 0,' },

  // ── AS FRASES QUE FAZEM O RODAPÉ SER CONFERÍVEL ──────────────────────────────────────────
  { nome: 'o rodape perde o numero e passa a dizer "algumas atas"', deveRuir: true, arq: MOTOR,
    de: /f\.push\(d\.ataSemValidade \+ \(d\.ataSemValidade === 1 \? ' ata está' : ' atas estão'\)/,
    para: "f.push('algumas atas estão'" },
  { nome: '*** o rodape nasce mesmo sem divida ("0 atas fora desta lista" e ruido com cara de aviso) ***',
    deveRuir: true, arq: MOTOR,
    de: /if \(d\.ataSemValidade\)\n      f\.push/, para: 'if (true)\n      f.push' },
  { nome: 'a frase da certidao deixa de negar o "nao vence"', deveRuir: true, arq: MOTOR,
    de: /Sem data não é "não vence": é "ninguém digitou"\./, para: 'Sem data.' },
  { nome: '"vence em 0 dias" volta no lugar de "vence HOJE"', deveRuir: true, arq: MOTOR,
    de: /if \(d === 0\) return l\.fonte === 'licitacao' \? 'fecha HOJE' : 'vence HOJE';/, para: '' },
  { nome: 'o singular do passado some e sai "venceu ha 1 dias"', deveRuir: true, arq: MOTOR,
    de: /\(Math\.abs\(d\) === 1 \? ' dia' : ' dias'\)/, para: "' dias'" },
  { nome: 'o verbo da ata vira o da certidao (renovar uma ata nao quer dizer nada)',
    deveRuir: true, arq: MOTOR, de: /verbo: 'empenhar',/, para: "verbo: 'renovar'," },
  { nome: 'a acao por extenso some e sobra so o que esta acontecendo', deveRuir: true, arq: MOTOR,
    de: /acao: 'cobrar empenho e entrega do saldo que resta',/, para: "acao: 'ata'," },
  { nome: 'a procedencia da data da licitacao some da linha', deveRuir: true, arq: MOTOR,
    de: /prazoOrigem: l\.prazo_origem \|\| null,/, para: '' },

  // ── A TELA ────────────────────────────────────────────────────────────────────────────────
  { nome: 'o Negocios deixa de carregar o motor da lista da manha', deveRuir: true, arq: NEG,
    de: /<script src="fpmed_vai_embora\.js"><\/script>/, para: '' },
  /* O ESTADO VAZIO VIRANDO TELA EM BRANCO. É a mutação cujo sintoma é indistinguível da boa
     notícia — e desta vez indistinguível também do defeito de leitura. */
  { nome: '*** "nada vencendo" vira uma tela em branco ***', deveRuir: true, arq: NEG,
    de: /<div class="ve-vazio">/, para: '<div style="display:none">' },
  { nome: '*** o vazio passa a prometer um numero unico ("nada nos proximos 30 dias") ***',
    deveRuir: true, arq: NEG,
    de: /Nenhuma certidão dentro do próprio aviso, nenhuma ata vencendo '\n      \+ 'em 60 dias e nenhuma licitação sua fechando em ' \+ V\.JANELA_LICITACAO \+ ' dias\./,
    para: "Nada nos próximos 30 dias." },
  { nome: '*** as tres fontes caidas passam a virar tela calma em vez de vermelha ***',
    deveRuir: true, arq: NEG,
    de: /if\(!VE \|\| \(VE_FALHOU\.length >= 3\)\)\{/, para: 'if(false){' },
  { nome: 'a fonte que faltou deixa de ser nomeada', deveRuir: true, arq: NEG,
    de: /'<div class="salvo" style="margin-top:8px;color:var\(--vermelho-700\)"><b>Faltou uma fonte:<\/b> '/,
    para: "''; const _x = ('" },
  { nome: 'o esqueleto do HTML some e o bloco nasce vazio (le-se como "nada vencendo")',
    deveRuir: true, arq: NEG,
    de: /<div class="fp-skeleton fp-skeleton--cartao" aria-hidden="true" style="height:44px"><\/div>/,
    para: '' },
  { nome: 'o esqueleto passa a dizer "nada vencendo" antes de ter olhado', deveRuir: true, arq: NEG,
    de: /<span class="sub">lendo os prazos…<\/span>/, para: '<span class="sub">nada vencendo</span>' },
  { nome: '*** a linha vira <div> com onclick e o teclado deixa de alcancar ***',
    deveRuir: true, arq: NEG,
    de: /\+ l\.map\(x => `<button class="ve-l /, para: '+ l.map(x => `<div class="ve-l ' },
  /* A `de` DESTA MUTAÇÃO PRECISOU DE ÂNCORA, e o motivo é uma medição: a declaração
     `border-left:4px solid var(--cinza-400);` aparece DUAS vezes na `fpmed_negocios.html` — a
     outra é de outra fatia, 87 linhas acima. Sem a âncora, o `replace` (sem `/g`) mordia a
     PRIMEIRA, que não é desta tela: a mutação "escapava" acusando um buraco na catraca que não
     existia, e o buraco verdadeiro (o assert solto, que casava em qualquer lugar) ficava escondido
     atrás dela. Mutação que muta o arquivo errado mente para os dois lados. */
  { nome: 'a barra da esquerda some e a urgencia passa a depender so de cor', deveRuir: true, arq: NEG,
    de: /\.ve-l\{display:flex;gap:12px;align-items:center;padding:8px 12px;border:1px solid var\(--linha\);\n  border-left:4px solid var\(--cinza-400\);/,
    para: '.ve-l{display:flex;gap:12px;align-items:center;padding:8px 12px;border:1px solid var(--linha);\n  ' },
  { nome: 'a cor entra a mao, fora do tema', deveRuir: true, arq: NEG,
    de: /\.ve-l\.vencido\{border-left-color:var\(--vermelho-300\);background:var\(--vermelho-50\)\}/,
    para: '.ve-l.vencido{border-left-color:#e11d48;background:#fff1f2}' },
  { nome: 'o numero de dias perde o tabular e a coluna passa a dancar', deveRuir: true, arq: NEG,
    de: /min-width:56px;\n  text-align:right;font-variant-numeric:tabular-nums;color:var\(--cinza-800\)\}/,
    para: 'min-width:56px;\n  text-align:right;color:var(--cinza-800)}' },
  { nome: '*** a tela passa a contar os dias por conta propria ***', deveRuir: true, arq: NEG,
    de: /\$\{esc\(V\.frase\(x\)\)\}/,
    para: '${esc(Math.round((new Date(x.quando) - Date.now())/86400000) + " dias")}' },
  { nome: 'a tela monta o rodape da divida a mao', deveRuir: true, arq: NEG,
    de: /const frases = V\.frasesDaDivida\(d\);/, para: "const frases = d.ataSemValidade ? [d.ataSemValidade + ' atas'] : [];" },
  { nome: 'a tela deixa de perguntar ao motor quem entra na lista', deveRuir: true, arq: NEG,
    de: /VE = V\.juntar\(\{/, para: 'VE = { linhas: [], divida: {}, contagem: {} }; const _ignora = ({' },
  { nome: '*** as tres leituras deixam de ter try/catch e uma queda derruba a lista inteira ***',
    deveRuir: true, arq: NEG,
    de: /\}catch\(e\)\{ VE_FALHOU\.push\(\{ fonte: nome, erro: e\.message \}\); return null; \}/,
    para: '}finally{}' },
  { nome: 'as arquivadas deixam de ser lidas e o rodape nunca sabe que elas existem',
    deveRuir: true, arq: NEG,
    de: /le\('gaveta de atas arquivadas', 'v_atas_arquivadas\?select=id,arquivado_em'\),/,
    para: 'Promise.resolve([]),' },
  { nome: 'a lista da manha passa a rodar ANTES do carregar() (nasce com duas fontes de tres)',
    deveRuir: true, arq: NEG,
    de: /carregar\(\)\.then\(\(\) => \{ pinta\(\); carregarVaiEmbora\(\);/,
    para: 'carregarVaiEmbora(); carregar().then(() => { pinta();' },
  { nome: 'a terceira fonte passa a incluir negocio arquivado e ata (o recorte publicado muda calado)',
    deveRuir: true, arq: NEG,
    de: /const vivos = \(NEG \|\| \[\]\)\.filter\(n => !n\.arquivado && n\.estagio !== 'contrato'\);/,
    para: 'const vivos = (NEG || []);' },
  { nome: 'a procedencia da data some da tela', deveRuir: true, arq: NEG,
    de: /prazo_origem: doIndice \? 'encerramento da proposta \(PNCP\)' : 'abertura da sessão \(ficha\)'/,
    para: "prazo_origem: null" },
  { nome: 'o saldo da ata some da linha e a perda perde o tamanho', deveRuir: true, arq: NEG,
    de: /: ' · <span class="sd-nao">saldo não informado<\/span>'\) : ''\}/, para: ": '') : ''}" },

  // ── A CASCA ───────────────────────────────────────────────────────────────────────────────
  { nome: 'o motor sai da casca do service worker', deveRuir: true, arq: 'sw.js',
    de: /\n\s*'\.\/fpmed_vai_embora\.js',[^\n]*\n/, para: '\n' },
  /* O PADRÃO É GENÉRICO DE PROPÓSITO. Fixar o número exato faz a mutação parar de casar no dia do
     próximo bump — e mutação que não casa não fica vermelha: ela se declara "escapada" e o placar
     acusa um buraco que não existe. */
  { nome: 'a casca ganha arquivo novo mas ninguem bumpa a versao', deveRuir: true, arq: 'sw.js',
    de: /limedtec-fpmed-\d{4}-\d{2}-\d{2}-\d+/, para: 'limedtec-fpmed-2026-08-20-88' },

  // ── AS QUE **NÃO** PODEM FICAR VERMELHAS ──────────────────────────────────────────────────
  /* A prosa desta casa NOMEIA o que a regra proíbe — é a única maneira de um comentário ensinar
     uma regra. Se a catraca cobrar do comentário, o conserto vira "apagar a explicação", e
     explicação apagada é a causa da próxima geração do mesmo defeito. */
  { nome: 'um comentario cita o corte de 60 dias como o que NAO se redefine aqui',
    deveRuir: false, arq: MOTOR, de: /function juntar\(fontes, hoje\) \{/,
    para: '/* nunca um corte proprio de 60 dias aqui: quem decide e a v_atas_vigencia */\n  function juntar(fontes, hoje) {' },
  { nome: 'um comentario cita o Math.floor como o erro a evitar', deveRuir: false, arq: MOTOR,
    de: /function num\(v\) \{/,
    para: '/* Math.floor aqui faria esta conta divergir da do fpmed_ata_saldo.js */\n  function num(v) {' },
  { nome: 'um comentario explica por que o desempate existe', deveRuir: false, arq: MOTOR,
    de: /var PESO = \{ certidao: 0, ata: 1, licitacao: 2 \};/,
    para: '/* sem desempate a lista se reorganiza sozinha, como o sort() nu da B28 */\n    var PESO = { certidao: 0, ata: 1, licitacao: 2 };' },
  { nome: 'a tela ganha comentario citando "tela em branco" como proibido', deveRuir: false, arq: NEG,
    de: /function pintaVaiEmbora\(\)\{/,
    para: '/* aqui nunca sai tela em branco: vazio e vitoria e tem que parecer */\nfunction pintaVaiEmbora(){' },
  { nome: 'o CSS ganha comentario dizendo que hex a mao e proibido', deveRuir: false, arq: NEG,
    de: /\.ve-divida\{/, para: '/* nada de #hex nem rgba() aqui: so token do tema */\n.ve-divida{' },
];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'muta-b32-'));
function semeia() {
  for (const rel of ARQUIVOS) {
    const dest = path.join(TMP, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, rel), dest);
  }
}
function roda() {
  try { execFileSync(process.execPath, [path.join(TMP, 'tests', SUITE)], { stdio: 'pipe', encoding: 'utf8' }); return { verde: true, saida: '' }; }
  catch (e) { return { verde: false, saida: String((e.stdout || '') + (e.stderr || '')) }; }
}

console.log('=== MUTACAO DA FATIA B32 — a catraca da lista da manha contra o material de verdade ===\n');
semeia();
const ctrl = roda();
console.log(`  controle · ${SUITE} ${ctrl.verde ? 'VERDE' : '*** JA ESTA VERMELHA ***'}`);
if (!ctrl.verde) {
  // Sem este passo, uma suíte já vermelha faria TODA mutação `deveRuir:true` "passar" — e o placar
  // sairia cheio sem ter provado nada. É o formato exato do detector cego da B26.
  console.log(ctrl.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 6).join('\n'));
  console.log('\n>>> ABORTADO: com a suite ja vermelha, a mutacao nao prova nada.');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(1);
}
console.log('');

let pegou = 0, escapou = 0, falso = 0;
const escapadas = [], falsas = [];
for (const m of MUTACOES) {
  semeia();
  const alvo = path.join(TMP, m.arq);
  const antes = fs.readFileSync(alvo, 'utf8').replace(/\r\n/g, '\n');
  const depois = antes.replace(m.de, m.para);
  if (depois === antes) {
    escapou++; escapadas.push(m.nome + '  (o padrao nao casou — o alvo mudou de forma)');
    console.log(`  ?? ${m.nome}\n     >>> o padrao nao casou; esta mutacao nao mediu nada`);
    continue;
  }
  fs.writeFileSync(alvo, depois, 'utf8');
  const r = roda();
  if (m.deveRuir) {
    if (!r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  vermelha, como devia`); }
    else { escapou++; escapadas.push(m.nome); console.log(`  ** ESCAPOU: ${m.nome}  ->  a catraca ficou VERDE`); }
  } else {
    if (r.verde) { pegou++; console.log(`  ok  ${m.nome}  ->  passou, como devia (nao e defeito)`); }
    else {
      falso++; falsas.push(m.nome);
      console.log(`  ** FALSO VERMELHO: ${m.nome}`);
      console.log('     ' + r.saida.split('\n').filter(l => /FALHA/.test(l)).slice(0, 2).join('\n     '));
    }
  }
}
fs.rmSync(TMP, { recursive: true, force: true });

console.log('\n== PLACAR ==');
console.log(`  ${pegou} de ${MUTACOES.length} mutacoes se comportaram como deviam`);
console.log(`  ${escapou} escaparam · ${falso} falso(s) vermelho(s)`);
if (escapadas.length) console.log('\n  ESCAPARAM:\n   - ' + escapadas.join('\n   - '));
if (falsas.length) console.log('\n  FALSO VERMELHO:\n   - ' + falsas.join('\n   - '));
process.exitCode = (escapou || falso) ? 1 : 0;
