// SUITE testa_janela_custo — A JANELA DE CUSTO NO PADRAO DO MOLDE (fatia A16, 14/08/2026).
//
// == O QUE MUDOU, E POR QUE ISSO NAO E COSMETICA =================================
// Ate a A12 quem perguntava "custa ate R$ X, confirmar?" era o `confirm()` do
// navegador. Ele cumpria a funcao — bloqueante, impossivel de nao ver — e falhava
// na unica coisa que um aviso de gasto nao pode falhar: parecia do NAVEGADOR, nao
// do produto que vai cobrar. Caixa cinza do sistema, o endereco do site no topo,
// tipografia que nao e a nossa, e um "OK / Cancelar" que nao diz o que vai
// acontecer. Quem paga precisa reconhecer quem esta cobrando.
//
// == O QUE ESTA SUITE PROTEGE ===================================================
//  1. QUE A JANELA MORE NO MOTOR, E SEJA UMA SO. A tentacao era desenha-la na
//     Encontrar, que foi quem pediu. Ai o Negocios precisaria da dele, e existiriam
//     DUAS janelas de custo — o mesmo defeito da segunda conta de custo um degrau
//     acima: dois textos para o mesmo gasto, e um dia so um deles e corrigido.
//  2. QUE A COR SO SAIA DO TOKEN. Janela nova e exatamente onde uma segunda paleta
//     entra num sistema. Aqui ha varredura: ZERO hex escrito a mao no CSS dela.
//  3. QUE O DADO ENTRE ESCAPADO. O nome do documento vem do PNCP — de fora. A
//     moldura nasce markup e o dado entra por textContent (a licao da A10), e aqui
//     ela vale em dobro: e o dialogo que protege o dinheiro de quem clica.
//  4. QUE O ACIDENTE CAIA SEMPRE DO LADO QUE NAO COBRA. Esc cancela, clique no veu
//     cancela, e o foco nasce no "Cancelar" — porque neste dialogo o Enter gasta.
//  5. QUE O PORTAO CONTINUE LIGADO POR PADRAO depois da troca (a A12 inteira segue
//     valendo; o que mudou foi QUEM pergunta, nunca SE pergunta).
//
//   node tests/testa_janela_custo.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const MOTOR = R('fpmed_leitor_motor.js');
const TEMA = R('fpmed_tema.css');
const ENC = R('fpmed_licitacoes.html');
const semJs = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const Mc = semJs(MOTOR);

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_janela_custo — a janela de custo no padrao do molde (fatia A16)\n');

/* O DOM MINIMO mora em tests/dom_minimo.js, e mora la porque a PROVA VIVA
   (tools/prova_janela_custo.js) usa o mesmo — a janela precisa ser exercitada contra o banco de
   verdade pra provar "confirmar gasta uma vez so", e duas copias do dublê seriam duas realidades
   diferentes contra as quais medir a mesma janela. */
const { criaDom } = require('./dom_minimo.js');

function carregaMotor(doc) {
  const win = { document: doc };
  const caixa = { window: win, console };
  vm.createContext(caixa);
  vm.runInContext(MOTOR, caixa, { filename: 'fpmed_leitor_motor.js' });
  return win.LeitorEdital;
}

const ORC = { brl: 0.2612, usd: 0.0498, chars: 173557, partes: 2, tokensEntrada: 57852, teto: true };

// ══════════════ 1. A JANELA E UMA SO, E MORA NO MOTOR ══════════════
/* Se ela morasse na tela, o Negocios precisaria da dele. A fatia diz "exponha-a pelo motor
   (funcao unica), para o Negocios do B herdar sem escrever nada" — e o assert e literalmente isso. */
ok(n + '. *** o motor EXPOE a janela como funcao unica (o B herda sem escrever nada) ***',
  /janelaDeCusto: janelaDeCusto/.test(Mc) && /function janelaDeCusto\(texto, dados\)/.test(Mc)); n++;
ok(n + '. *** e ela e o confirmador PADRAO (nao "a tela liga se lembrar") ***',
  /var confirmador = janelaDeCusto;/.test(Mc)); n++;
/* A Encontrar so PASSA o nome do documento; ela nao desenha janela, nao escreve preco, nao
   monta veu. No dia em que qualquer uma dessas tres coisas aparecer la, este assert cai. */
ok(n + '. *** a Encontrar NAO desenha janela de custo propria (so informa o documento) ***',
  !/fp-custo-veu|custa até|custo-preco/.test(semJs(ENC))
  && /documento: \{ nome: ed\.titulo/.test(ENC)); n++;

// ══════════════ 2. A VARREDURA DE COR: ZERO HEX A MAO ══════════════
/* O MOLDE MANDA "ate o fio de 1px, zero hex a mao". Uma janela nova e onde a segunda paleta do
   sistema costuma nascer — sempre com boa intencao e sempre com um hex "so este aqui". */
const CSS = (MOTOR.match(/var CSS_JANELA = \[([\s\S]*?)\]\.join/) || [])[1] || '';
ok(n + '. (controle) o bloco de CSS da janela foi encontrado no motor', CSS.length > 400, CSS.length); n++;
const hexes = CSS.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
ok(n + '. *** VARREDURA: zero hex escrito a mao no CSS da janela ***', hexes.length === 0, hexes); n++;
const rgbas = CSS.match(/\brgba?\(/g) || [];
ok(n + '. ...e zero rgb()/rgba() a mao (tom claro por alfa e contraste em loteria)',
  rgbas.length === 0, rgbas); n++;
/* CONTROLE POSITIVO: sem ele, os dois asserts acima ficariam verdes num CSS vazio ou sem cor. */
const tokensUsados = [...new Set((CSS.match(/var\((--[a-z0-9-]+)\)/g) || []).map(s => s.slice(4, -1)))];
ok(n + '. (controle) a janela realmente PINTA — e pinta so por token',
  tokensUsados.length >= 10, tokensUsados.length); n++;
/* Token que nao existe no tema nao estoura: o navegador ignora a declaracao e a peca sai
   TRANSPARENTE ou sem espaco. Um erro de digitacao num token vira um dialogo invisivel. */
/* A ANCORA NAO PODE SER `^\s*`: o tema declara PARES na mesma linha (`--sinal-perigo-tinta:
   #B42318;   --sinal-perigo-fundo: #FEF0EF;`), e um leitor ancorado no comeco da linha nao ve o
   segundo — acusaria de orfao um token que existe. Achado ao escrever a A17. */
const orfaos = tokensUsados.filter(t => !new RegExp('(?:^|;)\\s*' + t + '\\s*:', 'm').test(TEMA));
ok(n + '. *** todos os tokens usados EXISTEM no fpmed_tema.css (token orfao = peca invisivel) ***',
  orfaos.length === 0, orfaos); n++;

// ══════════════ 3. O CONTRASTE DO DESTAQUE, MEDIDO ══════════════
/* O valor e a informacao pela qual a janela existe. Ele sai em --azul-800 sobre --azul-50, e um
   par novo de cor sobre cor exige medicao — a rampa foi construida pra fundo branco. */
const tk = t => (TEMA.match(new RegExp('(?:^|;)\\s*--' + t + '\\s*:\\s*([^;]+);', 'm')) || [])[1].trim();
const lum = hex => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map(i => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rValor = razao(tk('azul-800'), tk('azul-50'));
ok(n + '. *** o VALOR em destaque passa em AA sobre o fundo do bloco (medido) ***',
  rValor >= 4.5, { tinta: tk('azul-800'), fundo: tk('azul-50'), razao: Math.round(rValor * 100) / 100 }); n++;
/* O rotulo "CUSTA ATE" e 12px maiusculo: texto pequeno, entao AA cheio, sem excecao de tamanho. */
ok(n + '. ...e o rotulo "custa ate" tambem (12px nao tem desconto de contraste)',
  rValor >= 4.5); n++;
const rNota = razao(tk('cinza-600'), tk('branco'));
ok(n + '. *** a frase honesta do teto passa em AA (ela nao pode ser letrinha ilegivel) ***',
  rNota >= 4.5, { tinta: tk('cinza-600'), razao: Math.round(rNota * 100) / 100 }); n++;

// ══════════════ 4. A JANELA, RODANDO DE VERDADE ══════════════
(async () => {
  // ── 4.1 ela monta, mostra o que vai ser lido e o valor em destaque ──
  {
    const doc = criaDom(); const M = carregaMotor(doc);
    const pr = M.janelaDeCusto('a frase', { orcamento: ORC, documento: { nome: 'Termo de Referência', chars: 173557, paginas: 62 } });
    const veu = doc.body.querySelector('.fp-custo-veu');
    ok(n + '. *** RODANDO: a janela aparece na tela (veu + caixa) ***',
      !!veu && !!veu.querySelector('.fp-custo-cx')); n++;
    ok(n + '. ...e ela e um dialogo de verdade pra quem le em voz alta',
      veu.getAttribute('role') === 'dialog' && veu.getAttribute('aria-modal') === 'true'
      && veu.getAttribute('aria-labelledby') === 'fp-custo-tit'); n++;
    const doc_ = veu.querySelector('.fp-custo-doc').textContent;
    ok(n + '. *** ela DIZ O QUE VAI SER LIDO: nome do documento e tamanho ***',
      /Termo de Referência/.test(doc_) && /173\.557 caracteres/.test(doc_) && /62 páginas/.test(doc_),
      doc_); n++;
    ok(n + '. ...e diz que sao 2 partes quando o orcamento diz que sao',
      /lidos em 2 partes/.test(doc_), doc_); n++;
    const val = veu.querySelector('.fp-custo-preco-val').textContent;
    ok(n + '. *** O VALOR EM DESTAQUE, com virgula decimal e em reais ***',
      val === 'R$ 0,26', val); n++;
    ok(n + '. ...com o rotulo "custa ate" ao lado (o "ate" e a verdade: e teto)',
      /custa até/i.test(veu.querySelector('.fp-custo-preco-rot').textContent)); n++;
    const nota = veu.querySelector('.fp-custo-nota').textContent;
    ok(n + '. *** A FRASE HONESTA: e TETO, e o cobrado e o MEDIDO ***',
      /TETO/.test(nota) && /consumo real medido/.test(nota) && /registrado/.test(nota), nota); n++;
    const bts = veu.querySelectorAll('button').map(b => b.textContent);
    ok(n + '. *** os botoes dizem o VERBO da acao — nunca "OK" ***',
      bts.includes('Confirmar leitura') && bts.includes('Cancelar') && !bts.includes('OK'), bts); n++;
    ok(n + '. ...e o "Confirmar leitura" e a acao PRIMARIA no molde (fp-btn--principal)',
      /fp-btn--principal/.test(veu.querySelector('[data-fp="sim"]').className)
      && !/fp-btn--principal/.test(veu.querySelector('[data-fp="nao"]').className)); n++;
    /* O FOCO NASCE NO CANCELAR, e e a unica escolha desta janela que contraria o habito. Aqui o
       Enter GASTA: um Enter de sobra vindo de um campo de busca confirmaria um gasto que ninguem
       leu. O pior acidente possivel passa a ser nao ler o edital, e nao pagar por engano. */
    ok(n + '. *** o foco nasce no CANCELAR (neste dialogo, o Enter gasta dinheiro) ***',
      doc.activeElement === veu.querySelector('[data-fp="nao"]')); n++;
    doc._clica(veu.querySelector('[data-fp="nao"]'));
    ok(n + '. *** clicar em Cancelar responde NAO ***', (await pr) === false); n++;
    ok(n + '. ...e a janela some da tela (nao fica veu orfao cobrindo o sistema)',
      !doc.body.querySelector('.fp-custo-veu')); n++;
  }
  // ── 4.2 confirmar responde SIM ──
  {
    const doc = criaDom(); const M = carregaMotor(doc);
    const pr = M.janelaDeCusto('x', { orcamento: ORC });
    const veu = doc.body.querySelector('.fp-custo-veu');
    doc._clica(veu.querySelector('[data-fp="sim"]'));
    ok(n + '. *** clicar em Confirmar leitura responde SIM ***', (await pr) === true); n++;
  }
  // ── 4.3 as duas saidas acidentais caem do lado que NAO cobra ──
  {
    const doc = criaDom(); const M = carregaMotor(doc);
    const pr = M.janelaDeCusto('x', { orcamento: ORC });
    doc._tecla('Escape');
    ok(n + '. *** Esc cancela (saida acidental nunca confirma gasto) ***', (await pr) === false); n++;
  }
  {
    const doc = criaDom(); const M = carregaMotor(doc);
    const pr = M.janelaDeCusto('x', { orcamento: ORC });
    const veu = doc.body.querySelector('.fp-custo-veu');
    doc._mouseNo(veu, veu);
    ok(n + '. *** clicar FORA da caixa cancela ***', (await pr) === false); n++;
  }
  /* CONTROLE NEGATIVO do de cima: clique DENTRO da caixa nao pode fechar nada — senao arrastar
     pra selecionar o texto do preco cancelaria a leitura. */
  {
    const doc = criaDom(); const M = carregaMotor(doc);
    let respondeu = false;
    M.janelaDeCusto('x', { orcamento: ORC }).then(() => { respondeu = true; });
    const veu = doc.body.querySelector('.fp-custo-veu');
    doc._mouseNo(veu, veu.querySelector('.fp-custo-cx'));
    await new Promise(r => setTimeout(r, 0));
    ok(n + '. (controle) clicar DENTRO da caixa nao fecha nada', respondeu === false); n++;
  }
  // ── 4.4 sem DOM, a resposta e NAO ──
  {
    const caixa = { window: {}, console }; vm.createContext(caixa);
    vm.runInContext(MOTOR, caixa, { filename: 'motor-sem-dom.js' });
    ok(n + '. *** sem DOM (node/worker) a janela responde NAO, e nao "deixa passar" ***',
      (await caixa.window.LeitorEdital.janelaDeCusto('x', { orcamento: ORC })) === false); n++;
  }
  // ── 4.5 sem preco nao ha botao de confirmar ──
  /* O motor ja barra antes (semOrcamento). Este caminho e pra quem chamar a janela na mao: ela
     diz a verdade em vez de mostrar um destaque vazio, e o botao que gasta SAI DE CENA. */
  {
    const doc = criaDom(); const M = carregaMotor(doc);
    M.janelaDeCusto('não consegui calcular o custo desta leitura', { orcamento: null });
    const veu = doc.body.querySelector('.fp-custo-veu');
    ok(n + '. *** sem preco, o bloco de destaque some e o botao de CONFIRMAR tambem ***',
      !veu.querySelector('.fp-custo-preco') && !veu.querySelector('[data-fp="sim"]')
      && !!veu.querySelector('[data-fp="nao"]')); n++;
    ok(n + '. ...e ela diz por que, em vez de mostrar um destaque vazio',
      /não consegui calcular o custo/.test(veu.querySelector('.fp-custo-nota').textContent)); n++;
  }
  // ── 4.6 sem nome do documento (o caso do Negocios hoje) ela nao inventa nome ──
  {
    const doc = criaDom(); const M = carregaMotor(doc);
    M.janelaDeCusto('x', { orcamento: { brl: 1.5, chars: 9865, partes: 1 } });
    const t = doc.body.querySelector('.fp-custo-doc').textContent;
    ok(n + '. *** sem nome informado ela diz "o documento deste certame" — nao inventa nome ***',
      /o documento deste certame/.test(t) && /9\.865 caracteres/.test(t), t); n++;
    ok(n + '. ...e o valor continua saindo em reais com virgula',
      doc.body.querySelector('.fp-custo-preco-val').textContent === 'R$ 1,50'); n++;
  }
  // ── 4.7 sem cotacao do dolar: sai em dolar E DIZ que e dolar ──
  {
    const doc = criaDom(); const M = carregaMotor(doc);
    M.janelaDeCusto('x', { orcamento: { brl: null, usd: 0.0498, chars: 100, partes: 1 } });
    const v = doc.body.querySelector('.fp-custo-preco-val').textContent;
    ok(n + '. *** sem cotacao do dolar o destaque sai em US$ e AVISA — nunca inventa um 5,00 ***',
      /^US\$ 0,050/.test(v) && /sem cotação do dólar/.test(v), v); n++;
  }
  // ── 4.8 o dado entra ESCAPADO (a licao da A10, no dialogo que protege dinheiro) ──
  {
    const doc = criaDom(); const M = carregaMotor(doc);
    const veneno = '<img src=x onerror=alert(1)>';
    M.janelaDeCusto('x', { orcamento: ORC, documento: { nome: veneno } });
    const alvo = doc.body.querySelector('[data-fp="nome"]');
    ok(n + '. *** o nome do documento entra por textContent: markup vira TEXTO, nao vira tag ***',
      alvo.textContent === veneno && alvo._filhos.length === 1
      && alvo._filhos[0].texto === veneno && !alvo.querySelector('IMG')); n++;
  }
  /* CONTROLE POSITIVO do escape: o dublê SABE construir uma tag a partir de HTML — entao o
     assert acima nao esta verde so porque este DOM ignora markup. */
  {
    const doc = criaDom();
    const d = doc.createElement('div');
    d.innerHTML = '<img src="x">';
    ok(n + '. (controle) o DOM do teste realmente monta tag a partir de HTML',
      !!d.querySelector('IMG')); n++;
  }

  // ══════════════ 5. O PORTAO DA A12 CONTINUA INTEIRO ══════════════
  /* O que a A16 trocou foi QUEM pergunta. SE pergunta, e o que acontece com o "nao", continua
     exatamente como a A12 deixou — e estes asserts existem pra que a troca de janela nunca vire
     a porta de saida do portao. */
  ok(n + '. *** o portao continua LIGADO por padrao (sem `confirmado:true`, orca e pergunta) ***',
    /if \(o\.confirmado !== true\) \{/.test(Mc)); n++;
  ok(n + '. *** e o motor AGUARDA a resposta da janela (dialogo em DOM responde depois) ***',
    /await confirmador\(frasePreco\(orc\), \{ orcamento: orc, documento: o\.documento \|\| null \}\)/.test(Mc)); n++;
  ok(n + '. *** um "nao" continua virando cancelamento marcado, e nao falha ***',
    /ex\.cancelado = true/.test(Mc) && /nada foi cobrado/.test(Mc)); n++;
  ok(n + '. *** o motor CONTINUA sem tabela de preco propria (a conta e do servidor) ***',
    !/USD_ENTRADA_MTOK|USD_SAIDA_MTOK|CHARS_POR_TOKEN|MAX_SAIDA/.test(Mc)
    && /orcar: true/.test(Mc)); n++;
  ok(n + '. ...e o confirmador segue trocavel, so aceitando funcao',
    /set confirmador\(fn\) \{ if \(typeof fn === 'function'\) confirmador = fn; \}/.test(Mc)); n++;
  /* ══ A ETIQUETA DO gm-auth, E O QUE ESTE ASSERT DESCOBRIU (14/08) ═════════════════════════
     A etiqueta (`#gm-auth-bar`, e-mail + sair) e `position:fixed` no canto superior direito com
     z-index 2147483000. Abaixo dela, o veu escureceria a tela inteira MENOS o e-mail de quem
     entrou — e a etiqueta ficaria clicavel por cima de um dialogo modal.
     >>> ESCREVI ESTE ASSERT PROCURANDO "o z-index do gm-auth" NO ARQUIVO INTEIRO, e ele
         reprovou: o primeiro que aparece la nao e o da etiqueta, e sim o do OVERLAY DE LOGIN
         (`#gm-auth-overlay`), em 2147483647 — o teto do inteiro. E esse esta CERTO onde esta:
         quando a sessao cai, a tela de entrar tem que cobrir tudo, inclusive um dialogo de custo
         aberto. Ficar acima DELE seria o defeito. Entao o assert passou a mirar a etiqueta pelo
         id, e nao "o primeiro z-index do arquivo".
     >>> E O SEGUNDO RASCUNHO TAMBEM ERRAVA: ancorar em "gm-auth-bar" pegava a regra de @media
         print, que cita OS DOIS ids na mesma linha e fica a poucos caracteres do z-index do
         overlay. Quem separa os dois de verdade nao e o id, e a POSICAO deles: a etiqueta e um
         canto (`right:8px`) e o login e a tela toda (`inset:0`). */
  const gm = R('gm-auth.js');
  const linhaZ = alvo => (gm.split('\n').find(l => /z-index:\d/.test(l) && alvo.test(l)) || '');
  const zBarra = Number((linhaZ(/right:8px/).match(/z-index:(\d+)/) || [])[1]);
  const zLogin = Number((linhaZ(/inset:0/).match(/z-index:(\d+)/) || [])[1]);
  ok(n + '. (controle) achei os dois z-index do gm-auth: etiqueta e overlay de login',
    zBarra > 0 && zLogin > 0 && zLogin > zBarra, { etiqueta: zBarra, login: zLogin }); n++;
  ok(n + '. *** a janela fica ACIMA da etiqueta do gm-auth (senao ela vaza por cima do modal) ***',
    /z-index:2147483100/.test(CSS) && 2147483100 > zBarra, zBarra); n++;
  ok(n + '. ...e ABAIXO do overlay de login (sessao caida tem que cobrir tudo, inclusive isto)',
    2147483100 < zLogin, zLogin); n++;

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})();
