// SUITE testa_telemetria — O ARQUIVO ÚNICO, A COTA, O MASCARAMENTO E O FILTRO DE PRIVACIDADE.
// Fatia A35 · 20/08/2026 · o par desta suite é a tests/testa_telemetria_adotada.js (do B), que
// guarda a adoção nas quatro telas DELE. Esta guarda o arquivo em si e as telas do A.
//
// ══ A EXIGÊNCIA (c) DA CAIXA, COM AS PALAVRAS DELA ═══════════════════════════════════════════
// *"um teste que QUEBRA se a chamada de init sumir da página"*. É o bloco 3. E ele é a metade
// barata da prova: as outras duas (o evento SAIU com 200, o evento CHEGOU no painel) precisam de
// navegador e de servidor, e estão no tools/prova_telemetria.js e no relatório.
//
// ══ POR QUE ESTA SUITE EXECUTA O ARQUIVO EM VEZ DE SÓ LER ════════════════════════════════════
// O filtro de privacidade é a peça que decide o que sai da máquina do dono. Provar por regex que
// "existe uma função chamada limpa" é provar que alguém escreveu o nome certo — e o nome certo em
// cima de uma função que deixa o CNPJ passar é pior que nenhuma função, porque ele dá sossego.
// >>> ENTÃO O BLOCO 4 CARREGA O ARQUIVO DE VERDADE, com um `window` de mentira, e manda CPF,
//     CNPJ, e-mail, telefone e um texto de 500 caracteres pelo filtro. O que ele afirma é o que
//     o código FAZ, não o que ele parece fazer.
// >>> E ELE PROVA NAS DUAS DIREÇÕES: um valor bom TEM que passar. Um filtro que recusa tudo
//     passaria em todo assert de "não vazou" e entregaria um painel vazio — assert cego é pior
//     que assert vermelho, que é a lei desta casa.
//
//   node tests/testa_telemetria.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_telemetria — o arquivo unico, a cota, o mascaramento e o filtro\n');

const ARQ = 'fpmed_telemetria.js';
const CAMINHO = path.join(raiz, ARQ);
// AS TELAS DO A. `fpmed_licitacoes.html` é a da fatia; as outras entram na medida em que forem
// adotando — e a lista sendo explícita é o que faz uma tela nova NÃO entrar por engano nem
// escapar por esquecimento.
const TELAS_DO_A = ['fpmed_licitacoes.html'];

// ══════════ 1. O ARQUIVO EXISTE, E É UM SÓ ══════════
ok('1. o ' + ARQ + ' existe na raiz', fs.existsSync(CAMINHO));
if (!fs.existsSync(CAMINHO)) { console.log('\nRESULTADO: ' + p + ' ok, ' + (f + 1) + ' falha(s)'); process.exit(1); }
const fonte = fs.readFileSync(CAMINHO, 'utf8');

// ══════════ 2. A COTA E O MASCARAMENTO — os dois avisos do docs/TELEMETRIA.md ══════════
// O `tracesSampleRate` é o único número desta fatia que custa DINHEIRO se estiver errado: o
// padrão do loader é 1, captura toda transação e queima a cota grátis em dias. O assert casa o
// valor exato porque "existe a palavra tracesSampleRate" ficaria verde com `1` escrito ao lado.
{
  ok('2a. tracesSampleRate é 0.1 (o padrão 1 queima a cota)', /tracesSampleRate\s*:\s*0\.1\b/.test(fonte));
  ok('2b. e não sobrou nenhum tracesSampleRate: 1', !/tracesSampleRate\s*:\s*1\b/.test(fonte));

  // MASCARAMENTO TOTAL POR PADRÃO, nos DOIS gravadores. `maskAllInputs` já vem de fábrica; o que
  // NÃO vem é o mascaramento do texto MOSTRADO — e nesta casa o que está na tela é CNPJ de órgão,
  // valor de proposta e descrição de item. Ou seja: a parte perigosa é a que o padrão deixa passar.
  ok('2c. PostHog: maskTextSelector "*" (esconde o texto MOSTRADO, não só o digitado)',
    /maskTextSelector\s*:\s*['"]\*['"]/.test(fonte));
  ok('2d. PostHog: maskAllInputs', /maskAllInputs\s*:\s*true/.test(fonte));
  // O autocapture manda o TEXTO DO ELEMENTO junto do clique — o rótulo do botão e o que estiver
  // no cartão. É a porta mais silenciosa deste arquivo para conteúdo sair.
  ok('2e. PostHog: autocapture DESLIGADO', /autocapture\s*:\s*false/.test(fonte));
  ok('2f. Sentry: maskAllText no replay', /maskAllText\s*:\s*true/.test(fonte));
  ok('2g. Sentry: blockAllMedia no replay', /blockAllMedia\s*:\s*true/.test(fonte));
  ok('2h. Sentry: sendDefaultPii false (a URL vai em todo evento, e é onde token vaza)',
    /sendDefaultPii\s*:\s*false/.test(fonte));
  ok('2i. person_profiles identified_only (não cria perfil de anônimo)',
    /person_profiles\s*:\s*['"]identified_only['"]/.test(fonte));
}

// ══════════ 3. A EXIGÊNCIA (c): QUEBRA SE O INIT SUMIR ══════════
// Duas metades, e as duas precisam existir para a telemetria funcionar:
//   · o arquivo tem que CHAMAR o init dos dois serviços;
//   · a tela tem que CARREGAR o arquivo.
// Apagar qualquer uma delas desliga a telemetria em silêncio — que é o desfecho que este bloco
// existe para impedir. O `posthog.init` some num refactor de renomeação sem ninguém notar,
// porque nada na tela muda de aparência.
{
  ok('3a. o arquivo chama posthog.init', /posthog\s*\.\s*init\s*\(/.test(fonte));
  ok('3b. com a chave do projeto LIMEDTEC', /phc_[A-Za-z0-9]{20,}/.test(fonte));
  ok('3c. e o host us.i.posthog.com', /us\.i\.posthog\.com/.test(fonte));
  ok('3d. o arquivo carrega o loader do Sentry', /sentry-cdn\.com/i.test(fonte));
  ok('3e. e configura o Sentry pelo gancho oficial (sentryOnLoad)', /sentryOnLoad/.test(fonte));

  const chamaOArquivo = new RegExp('<script[^>]+src\\s*=\\s*["\'][^"\']*' + ARQ.replace(/\./g, '\\.'));
  const semChamar = TELAS_DO_A.filter(t => !chamaOArquivo.test(fs.readFileSync(path.join(raiz, t), 'utf8')));
  ok('3f. *** as telas do A carregam o ' + ARQ + ' ***', semChamar.length === 0, semChamar);

  /* >>> O DETECTOR PROVADO NAS DUAS DIREÇÕES. Uma tela que NÃO chama tem que reprovar — senão o
         assert 3f ficaria verde sobre uma regex quebrada, e é exatamente assim que uma catraca
         passa a dar verde sobre um pedaço de arquivo que ela não está lendo (lição da A31). */
  ok('3g. e o detector reprova uma tela que não chama (prova ao contrário)',
    !chamaOArquivo.test('<html><head><script src="outra_coisa.js"></script></head></html>'));
}

// ══════════ 4. O FILTRO DE PRIVACIDADE, EXECUTADO ══════════
// Aqui o arquivo é CARREGADO, não lido. O `window` é de mentira e o `location.protocol` é
// `file:` de propósito: o portão do próprio arquivo desliga a telemetria nesse caso, então
// nenhuma requisição sai e nenhum script de CDN é buscado. O que sobra de pé é a API — que é
// justamente o que se quer exercitar.
{
  const janela = {};
  const doc = {
    createElement: () => ({ setAttribute() {} }),
    getElementsByTagName: () => [],
    head: { appendChild() {} },
    documentElement: { appendChild() {} },
  };
  janela.document = doc;
  janela.location = { protocol: 'file:', search: '' };
  janela.console = { warn() {} };   // o arquivo avisa no console; aqui o aviso é ruído

  let API = null, erro = null;
  try {
    // `new Function` e não `require`: o arquivo é um IIFE de navegador, não um módulo Node — ele
    // fala com `window` e `document`, e não tem `module.exports`. Dar a ele um `window` de
    // mentira é a forma honesta de executá-lo aqui; envolvê-lo num `module.exports` seria
    // testar uma versão que não é a que roda em produção.
    new Function('window', 'document', 'console', 'location', fonte)(janela, doc, janela.console, janela.location);
    API = janela.FPMED_TELEMETRIA;
  } catch (e) { erro = e.message; }

  ok('4a. o arquivo executa num navegador de mentira sem estourar', !erro, erro);
  ok('4b. e publica window.FPMED_TELEMETRIA', !!API);

  if (API) {
    ok('4c. em file:// ele NÃO liga (não polui o painel com sessão de desenvolvimento)',
      API.ligada() === false);

    // A LISTA DOS SEIS, FECHADA. Um nome fora dela é recusado — é o que impede um `capture()`
    // solto de virar evento órfão que ninguém sabe de onde veio.
    const seis = ['busca_executada', 'resultado_zero', 'licitacao_aberta',
                  'item_comparado_com_cmed', 'adicionado_aos_negocios', 'erro_visto_pelo_usuario'];
    const lista = API.eventos();
    ok('4d. os seis eventos da primeira leva estão na lista',
      seis.every(n => lista.indexOf(n) > -1), lista);
    ok('4e. e a lista tem SÓ eles (lista fechada)', lista.length === seis.length, lista);
    ok('4f. um evento fora da lista é recusado', API.evento('evento_inventado', {}) === false);

    // ── O FILTRO, COM DADO DE VERDADE ──────────────────────────────────────────────────────
    const limpa = API._limpa;

    // DIREÇÃO 1 — O QUE TEM QUE PASSAR. Sem este assert, um filtro que devolve `{}` sempre
    // passaria em todos os outros e entregaria um painel vazio com cara de painel seguro.
    {
      const r = limpa({ resultados: 12, tem_uf: true, termo: 'dipirona', de: 'busca' });
      ok('4g. passa número', r.resultados === 12, r);
      ok('4h. passa booleano', r.tem_uf === true, r);
      ok('4i. passa o termo de busca (vocabulário de catálogo)', r.termo === 'dipirona', r);
      ok('4j. passa a origem', r.de === 'busca', r);
    }

    // DIREÇÃO 2 — O QUE NÃO PODE PASSAR DE JEITO NENHUM.
    // Não sai mascarado nem cortado: sai a etiqueta `(parece documento)`, que conta que HOUVE
    // algo ali sem contar o quê.
    {
      const CNPJ = '12.345.678/0001-95', CPF = '123.456.789-09';
      ok('4k. CNPJ vira etiqueta', limpa({ termo: CNPJ }).termo === '(parece documento)', limpa({ termo: CNPJ }));
      ok('4l. CPF vira etiqueta', limpa({ termo: CPF }).termo === '(parece documento)', limpa({ termo: CPF }));
      ok('4m. e-mail vira etiqueta', limpa({ termo: 'natanael@fpmed.com.br' }).termo === '(parece documento)');
      ok('4n. telefone vira etiqueta', limpa({ termo: '(62) 99999-8888' }).termo === '(parece documento)');
      // e a etiqueta NÃO carrega pedaço do documento junto — seria vazamento com nome de proteção
      ok('4o. e a etiqueta não leva pedaço do número junto',
        !/\d/.test(limpa({ termo: CNPJ }).termo || ''));
    }

    // TEXTO LONGO é objeto de edital, descrição de item, corpo de proposta. 80 caracteres é curto
    // demais para caber um deles e mais que suficiente para um termo de busca.
    {
      const longo = 'AQUISICAO DE MEDICAMENTOS E MATERIAL MEDICO HOSPITALAR PARA A REDE MUNICIPAL '.repeat(8);
      const r = limpa({ termo: longo });
      ok('4p. texto longo é cortado', r.termo.length <= 81, r.termo.length);
      ok('4q. e o corte é dito com reticências', /…$/.test(r.termo));
    }

    // CHAVE DE TEXTO FORA DA LISTA CURTA — é assim que `empresa`, `orgao` ou `objeto` chegariam
    // ao painel sem má intenção nenhuma: alguém acrescenta uma propriedade e ninguém revisa.
    {
      const r = limpa({ empresa: 'FPMED Distribuidora', orgao: 'Prefeitura de Goiânia', objeto: 'aquisicao' });
      ok('4r. chave de texto fora da lista some inteira', Object.keys(r).length === 0, r);
    }

    // OBJETO E ARRAY não passam: eles carregam estrutura, e estrutura carrega o que ninguém leu.
    {
      const r = limpa({ termo: 'gaze', lixo: { cnpj: '12.345.678/0001-95' }, lista: [1, 2] });
      ok('4s. objeto aninhado não passa', r.lixo === undefined, r);
      ok('4t. array não passa', r.lista === undefined, r);
      ok('4u. e o que era bom no mesmo pacote continua passando', r.termo === 'gaze', r);
    }
  }
}

// ══════════ 5. A TELA DO A CHAMA OS EVENTOS ══════════
// Ter o arquivo carregado e não chamar nada é telemetria instalada e muda. Este bloco cobra que
// os eventos que fazem sentido NESTA tela existam no código dela — e ele nomeia cada um, porque
// "há pelo menos uma chamada" ficaria verde com cinco dos seis apagados.
{
  const tela = fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8');
  // sem comentário: a prosa desta casa CITA os nomes dos eventos ao explicar a regra, e um
  // detector que confunde o registro com o registrado cobra mais de quem explica mais.
  const codigo = tela.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const DA_TELA = ['busca_executada', 'resultado_zero', 'licitacao_aberta',
                   'item_comparado_com_cmed', 'adicionado_aos_negocios', 'erro_visto_pelo_usuario'];
  DA_TELA.forEach((n, i) => {
    ok('5' + String.fromCharCode(97 + i) + '. a Encontrar dispara ' + n,
      new RegExp("tel\\s*\\(\\s*['\"]" + n + "['\"]").test(codigo));
  });
  // E A TELA NÃO PODE TER O TRECHO CHUMBADO — a mesma regra que o B guarda nas telas dele.
  ok('5g. e a chave do PostHog NÃO está chumbada na tela', !/phc_[A-Za-z0-9]{20,}/.test(codigo));
  ok('5h. nem o init do PostHog', !/posthog\s*\.\s*init\s*\(/.test(codigo));
}

// ══════════ 6. PAINEL VAZIO COM CAUSA (fatia A41 · 20/08/2026) ══════════
// O achado é do trabalhador B, lendo este arquivo: `respect_dnt: true` faz o PostHog NÃO ENVIAR
// NADA de quem tem "Do Not Track" ligado. Está certo e é generoso — *"mas se o Natanael tiver DNT
// ligado sem saber, o painel dele fica vazio e ninguém vai suspeitar do motivo."*
//
// >>> O RESPEITO AO DNT NÃO SE DESLIGA. Quem pediu para não ser seguido não é. O que a fatia faz
//     é dar NOME ao silêncio — painel vazio com causa é dado; painel vazio sem causa é armadilha.
{
  ok('6a. *** o respeito ao DNT continua LIGADO (esta fatia não o desliga, e não pode) ***',
    /respect_dnt:\s*true/.test(fonte));

  // ── o módulo executado de verdade, com um navegador de mentira ──
  // Provar por regex que "existe uma função chamada dnt" é provar que alguém escreveu o nome
  // certo — e o nome certo em cima de uma função que responde errado é pior que nenhuma.
  const carrega = (doNotTrack) => {
    const janela = {
      location: { protocol: 'https:', search: '' },
      localStorage: { getItem: () => null, setItem: () => {} },
      navigator: { doNotTrack, userAgent: 'teste' },
      document: {
        createElement: () => ({ style: {}, setAttribute() {} }),
        getElementsByTagName: () => [],
        head: { appendChild() {} }, documentElement: { appendChild() {} },
      },
      console: { warn() {} },
      posthog: null,
    };
    janela.window = janela;
    const vm = require('vm');
    const ctx = vm.createContext(janela);
    // `navigator` e `window` precisam existir como globais soltos, como no navegador
    vm.runInContext('var navigator = window.navigator; var location = window.location;'
      + ' var document = window.document; var console = window.console;', ctx);
    try { vm.runInContext(fonte, ctx); } catch (e) { return { erro: e.message }; }
    return janela.FPMED_TELEMETRIA || { erro: 'o módulo não se expôs' };
  };

  const ligado = carrega('1');
  ok('6b. *** DNT ligado: o módulo LÊ o "1" do navegador ***',
    ligado.dnt && ligado.dnt() === true, ligado.erro || (ligado.dnt && ligado.dnt()));
  ok('6c. *** ...e devolve a CAUSA em palavras, para a tela poder dizer ***',
    ligado.motivo && /Do Not Track/.test(String(ligado.motivo())), ligado.motivo && ligado.motivo());

  const naoDeclarado = carrega(null);
  ok('6d. *** DNT NÃO DECLARADO é `null`, e não `false` ***',
    naoDeclarado.dnt && naoDeclarado.dnt() === null, naoDeclarado.dnt && naoDeclarado.dnt());
  ok('6e. ...e nesse caso NÃO há causa nenhuma a dizer (o caso normal não pinta nada)',
    naoDeclarado.motivo && naoDeclarado.motivo() === null, naoDeclarado.motivo && naoDeclarado.motivo());

  const recusou = carrega('0');
  ok('6f. DNT declarado como "0" (aceito) é `false` — os três estados são distintos',
    recusou.dnt && recusou.dnt() === false, recusou.dnt && recusou.dnt());

  ok('6g. as TRÊS grafias são lidas (a especificação morreu no meio: navigator, window, ms)',
    /navigator\.doNotTrack/.test(fonte) && /window\.doNotTrack/.test(fonte)
    && /navigator\.msDoNotTrack/.test(fonte));

  // ── e a TELA diz ──
  const tela = fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8');
  const codigo = tela.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('6h. *** a tela tem o lugar onde a causa é dita ***', /id="tel-desligada"/.test(codigo));
  ok('6i. ...e ela é pintada no caminho normal da busca', /avisoTelemetria\(\)/.test(codigo));
  ok('6j. *** e a FRASE vem do módulo, não da tela (uma fonte de verdade) ***',
    /FPMED_TELEMETRIA[\s\S]{0,80}\.motivo\(\)/.test(codigo)
    && !/Do Not Track/.test(codigo.replace(/motivo/g, '')));
  ok('6k. o aviso NUNCA derruba a tela (um recado de métrica não quebra a busca)',
    /function avisoTelemetria\(\)\{\s*try\{/.test(codigo.replace(/\s+/g, ' ').replace(/function avisoTelemetria\(\) *\{ *try *\{/, 'function avisoTelemetria(){try{'))
    || /function avisoTelemetria\(\)\{[\s\S]{0,80}try\{/.test(codigo));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
