/* ════════════════════════════════════════════════════════════════════════════════════════════
   tools/roda_medicao_tela.js — O CONDUTOR DA MEDIÇÃO NA TELA PINTADA (fatia A32, 19/08/2026)

   ══ O FIM DE UMA DESCULPA DE CINCO RODADAS ══════════════════════════════════════════════════
   "Isto é medição do ARQUIVO; quem responde é a tela, e eu não logo" — escrito com honestidade
   cinco rodadas seguidas, e verdadeiro cada vez. Acabou. Este arquivo sobe o Chrome que já está
   na máquina, serve o NOSSO sistema por um servidor estático local e mede o que só a tela
   responde.

   ══ POR QUE playwright-core E O CHROME DA MÁQUINA, E NÃO O PACOTE COMPLETO ══════════════════
   O `playwright` completo baixa ~100 MB de navegador próprio. O `playwright-core` não baixa
   nada e sabe dirigir o Chrome instalado (`channel: 'chrome'`). O dono já tem Chrome — usá-lo
   custa zero download, zero disco e zero espera. E o MCP do Playwright continua servindo para
   navegação exploratória; ele trava quando as duas janelas da fábrica o disputam, e uma
   medição que só roda quando a outra janela está parada não é uma medição repetível.

   ══ ELE NÃO ESCREVE MEDIDOR NENHUM — CARREGA OS DOIS QUE JÁ EXISTEM ═════════════════════════
     tools/medidor_tela.js ......... do trabalhador B (fatia B21): vazamento, alvo de toque,
                                     os 4 estados. Reusado, não reescrito.
     tools/mede_contraste_pintado.js do A (esta fatia): o contraste computado, que era a peça
                                     que faltava — a pendência 5 dos sete pares.

   ══ AS REGRAS DURAS DA FATIA, E ONDE CADA UMA ESTÁ CUMPRIDA NO CÓDIGO ═══════════════════════
   · SÓ O NOSSO SISTEMA. A URL é `http://127.0.0.1:<porta>/` servida pelo servidor estático do
     projeto (`tools/servidor_estatico.js`), cuja raiz é travada em `C:\fpmed`. Nenhum site de
     terceiro é aberto — a lista de alvos é conferida contra o prefixo antes de navegar. Este
     condutor SOBE o servidor sozinho se ele não estiver de pé.
   · `clientWidth`, NUNCA `innerWidth`. Está dentro do medidor do B, e o relatório imprime os
     DOIS lado a lado para que a diferença (a barra de rolagem) apareça em vez de virar 16px de
     vazamento fantasma.
   · SE PEDIR LOGIN, PARA E ANOTA. Este arquivo não digita senha, não preenche formulário e não
     tem campo de credencial em lugar nenhum. Ele detecta a barreira e a declara.
   · PRINT ANTES E DEPOIS em `logs/`.

     node tools/roda_medicao_tela.js                      -> mede as telas do A
     node tools/roda_medicao_tela.js --tela fpmed_licitacoes.html
     node tools/roda_medicao_tela.js --marca antes        -> nomeia os prints (antes/depois)
     node tools/roda_medicao_tela.js --json logs/x.json   -> grava o retrato para comparar
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const RAIZ = path.join(__dirname, '..');
const LOGS = path.join(RAIZ, 'logs');
const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const PORTA = parseInt(arg('--porta'), 10) || 8123;
const BASE = 'http://127.0.0.1:' + PORTA + '/';
const MARCA = arg('--marca') || 'medicao';
const TELAS = (arg('--tela') || 'fpmed_licitacoes.html').split(',').map(s => s.trim()).filter(Boolean);

/* AS DUAS LARGURAS DA BASE, PARTE 4. 390 é o celular de referência; 1366 é o notebook que a
   maioria dos compradores públicos usa. Não são "duas medidas quaisquer": são as duas em que a
   BASE manda medir vazamento. */
const LARGURAS = [{ w: 390, h: 844, nome: 'celular-390' }, { w: 1366, h: 768, nome: 'notebook-1366' }];

/* OS SETE PARES DA PENDÊNCIA 5 — os que a régua estática declarou "só a tela pintada responde".
   A lista sai da própria régua (`contraste.naoMedidos`) e está escrita aqui para o condutor não
   depender de a régua rodar antes; o relatório confere as duas contas e reclama se divergirem. */
const PARES_PENDENTES = ['.buscabox input', '.chip-f button', '.dens button',
  '.mais .cx a', '.mais .cx button', '.lm-selo-ia', '.lic .titulo', '.aviso.vazio'];

const dormir = ms => new Promise(r => setTimeout(r, ms));

/* ── O SERVIDOR: sobe sozinho se não estiver de pé, e a raiz é travada lá dentro ───────────
   >>> ELE NÃO ERA SUBIDO POR AQUI, e isso quebrou a medição no meio da fatia: o servidor
       estático mudou de nome na outra janela (`servidor_local.js` -> `servidor_estatico.js`)
       e este arquivo mandou "suba-o antes" citando um caminho que não existia mais. Ferramenta
       que depende de alguém lembrar de um passo manual é passo manual — e a lei da autonomia
       diz que passo manual repetido é defeito de processo, não rotina. Agora ele acha o
       servidor pelo nome que existir e o sobe sozinho. */
const NOMES_SERVIDOR = ['servidor_estatico.js', 'servidor_local.js'];
function servidorDePe() {
  return new Promise(res => {
    const r = http.get(BASE, { timeout: 2500 }, x => { x.resume(); res(true); });
    r.on('error', () => res(false));
    r.on('timeout', () => { r.destroy(); res(false); });
  });
}
async function garanteServidor() {
  if (await servidorDePe()) return { subiu: false, proc: null };
  const arq = NOMES_SERVIDOR.map(n => path.join(__dirname, n)).find(p => fs.existsSync(p));
  if (!arq) return { erro: 'nenhum servidor estatico em tools/ (' + NOMES_SERVIDOR.join(' ou ') + ')' };
  const proc = spawn(process.execPath, [arq, String(PORTA)],
    { cwd: RAIZ, detached: false, stdio: 'ignore' });
  for (let i = 0; i < 20; i++) {
    await dormir(400);
    if (await servidorDePe()) return { subiu: true, proc, arq: path.basename(arq) };
  }
  try { proc.kill(); } catch (_) {}
  return { erro: 'subi o ' + path.basename(arq) + ' e ele nao respondeu em 8s' };
}

/* ── A BARREIRA DE LOGIN: detectar, declarar, NÃO tentar passar ──────────────────────────── */
/* A caixa é literal: "Se a tela pedir login, PARE nela e anote. Você não tem senha, não pede
   senha, não digita senha." Então este arquivo procura o SINAL da barreira e o carrega para o
   relatório junto com o que conseguiu medir antes dela. */
/* `page.evaluate(string)` avalia a string como EXPRESSÃO, e não como função a ser chamada:
   passar `() => {…}` devolve a FUNÇÃO, não o resultado dela. Por isso tudo aqui é IIFE.

   >>> DEFEITO DESTE ARQUIVO, ACHADO NA PRIMEIRA MEDIÇÃO: ele perguntava
       `document.querySelector('input[type=password]')` e gritava BARREIRA na Encontrar — que
       estava aberta, com o menu, os filtros e o estado vazio desenhados. O `gm-auth.js` deixa o
       portão de login MONTADO e ESCONDIDO no DOM de toda tela; existir não é barrar. Detector
       que confunde "está no HTML" com "está na frente do usuário" é a mesma família do defeito
       12 da régua visual, e o custo aqui seria pior: um relatório dizendo "parei na barreira"
       sobre uma tela que dava para medir inteira. A pergunta agora é se o campo está PINTADO. */
const SINAL_LOGIN = `(() => {
  const pintado = el => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const t = (document.body && document.body.innerText || '').slice(0, 4000);
  const senhas = [].slice.call(document.querySelectorAll('input[type=password]'));
  const campoSenha = senhas.some(pintado);
  const portao = [].slice.call(document.querySelectorAll('#gm-auth-overlay,.gm-auth-overlay,[data-gm-auth]'))
    .some(pintado);
  const frase = /entrar com|fa\\u00e7a login|faca login|sess\\u00e3o expirada|sessao expirada|sem permiss\\u00e3o|sem permissao|acesso negado/i.test(t);
  const vazioTotal = (t.trim().length < 40);
  return { campoSenha, portao, frase, vazioTotal,
           senhasNoDom: senhas.length, senhasPintadas: senhas.filter(pintado).length,
           amostra: t.replace(/\\s+/g,' ').slice(0, 180) };
})()`;

async function injeta(page, arquivo) {
  const src = fs.readFileSync(path.join(RAIZ, 'tools', arquivo), 'utf8');
  return page.evaluate(src);
}

(async () => {
  if (!fs.existsSync(LOGS)) fs.mkdirSync(LOGS, { recursive: true });
  const srv = await garanteServidor();
  if (srv.erro) { console.error('SERVIDOR: ' + srv.erro); process.exit(1); }
  console.log('MEDICAO NA TELA PINTADA — Chrome da maquina, servidor local, so o nosso sistema.');
  console.log('base: ' + BASE + (srv.subiu ? '  (subi o ' + srv.arq + ' agora)' : '  (ja estava de pe)')
    + '   telas: ' + TELAS.join(', ') + '\n');

  const navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const retrato = { quando: new Date().toISOString(), base: BASE, telas: {} };

  try {
    for (const tela of TELAS) {
      const url = BASE + tela;
      if (!url.startsWith(BASE)) { console.log('RECUSADO (fora da raiz local): ' + url); continue; }
      retrato.telas[tela] = {};
      console.log('══ ' + tela);

      for (const L of LARGURAS) {
        const ctx = await navegador.newContext({ viewport: { width: L.w, height: L.h },
          deviceScaleFactor: 1, locale: 'pt-BR' });
        const page = await ctx.newPage();
        const erros = [];
        page.on('pageerror', e => erros.push(String(e.message).slice(0, 160)));
        page.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text().slice(0, 160)); });

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          /* Espera o JS montar. `networkidle` travaria numa tela que faz polling; o que
             interessa é dar tempo de a tela pintar o que ela pinta sozinha. */
          await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
          await dormir(3500);

          const barreira = await page.evaluate(SINAL_LOGIN);
          const janela = await page.evaluate(`({
            clientWidth: document.documentElement.clientWidth,
            innerWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
          })`);

          await injeta(page, 'medidor_tela.js');
          await injeta(page, 'mede_contraste_pintado.js');

          /* ══ A TELA VAZIA NÃO PINTA OS SETE PARES, E ISSO NÃO É DETALHE ═══════════════════
             Na primeira medição, SEIS dos oito seletores pendentes voltaram "0 casamentos": a
             Encontrar abre no estado vazio ("Ajuste os filtros e clique na lupa para buscar") e
             `.lic .titulo`, `.chip-f button`, `.dens button` só existem DEPOIS que a busca
             traz resultado. Medir a tela parada e declarar "não pintado" seria trocar um "não
             sei" por outro — exatamente a pendência que esta fatia veio fechar.
             >>> ENTÃO O CONDUTOR MEDE DOIS MOMENTOS: a tela como ela abre (o estado VAZIO, que
                 é um dos quatro obrigatórios) e a tela DEPOIS de buscar (o estado CHEIO, onde
                 moram os pares). Os dois vão para o retrato — o vazio não é rascunho do cheio.
             >>> E ELE CHAMA `buscar()` EM VEZ DE CLICAR NA LUPA, de propósito: já está medido
                 nesta casa que o clique de mouse do automatizador não dispara a navegação aqui.
                 A função é o caminho REAL do código — é ela que o `onclick` chama. */
          const medeAgora = async () => ({
            vazamento: await page.evaluate('__medidor.vazamento()'),
            alvos: L.w <= 480 ? await page.evaluate('__medidor.alvos()') : null,
            estados: await page.evaluate('__medidor.estados()'),
            pares: await page.evaluate('__contraste.mede(' + JSON.stringify(PARES_PENDENTES) + ')'),
            varredura: await page.evaluate('__contraste.varreTudo()'),
          });

          const vazio = await medeAgora();
          const pngVazio = path.join(LOGS, `${MARCA}_${tela.replace(/\.html$/, '')}_${L.nome}_vazio.png`);
          await page.screenshot({ path: pngVazio, fullPage: false });

          const buscou = await page.evaluate(
            `(typeof buscar === 'function' ? (buscar(), 'chamou buscar()') : 'a tela nao expoe buscar()')`);
          await dormir(6000);
          let comoEncheu = 'busca real';
          let quantasLinhas = await page.evaluate(`document.querySelectorAll('.lic').length`);

          /* ══ A BARREIRA É REAL, E O QUE SE FAZ DIANTE DELA ═══════════════════════════════
             `buscar()` bate no nosso Supabase, volta HTTP 401 (a RLS exige sessão) e o portão
             do `gm-auth` pinta. A caixa é literal: *"Se a tela pedir login, PARE nela e anote.
             Você não tem senha, não pede senha, não digita senha."* Então nenhuma credencial é
             digitada aqui, nem existe campo para ela neste arquivo.
             >>> MAS PARAR NA BARREIRA NÃO É PARAR NA MEDIÇÃO, e a diferença importa: o que a
                 pendência 5 pergunta é sobre CSS — que cor o `.lic .titulo` fica quando pintado
                 sobre o fundo que ele herda. Isso não depende de QUEM é o dado; depende de o
                 componente estar na tela. Então a lista é desenhada com dado SINTÉTICO, feito
                 aqui, chamando a MESMA função `render()` que a busca real chamaria.
             >>> O QUE ISSO MEDE E O QUE NÃO MEDE, dito antes de alguém perguntar: mede o nosso
                 CSS no nosso markup, com as classes reais e a herança real — que é a coisa que
                 só a tela pintada responde. NÃO mede se o dado real cabe no espaço (texto de
                 órgão mais longo pode vazar), e por isso o objeto sintético usa nomes LONGOS de
                 propósito. E não lê uma linha do banco: zero requisição, zero sessão, RLS
                 intocada. */
          if (quantasLinhas === 0) {
            const sintetico = await page.evaluate(`(() => {
              if (typeof render !== 'function') return 'a tela nao expoe render()';
              const iso = d => new Date(Date.now() + d*864e5).toISOString();
              const um = (seq, fim, abre) => ({
                numeroControlePNCP: '00000000000191-1-00' + seq + '/2026',
                numeroCompra: String(seq), anoCompra: 2026, sequencialCompra: seq,
                modalidadeNome: 'Pregão Eletrônico', modoDisputaNome: 'Aberto',
                situacaoCompraNome: 'Divulgada no PNCP',
                objetoCompra: 'AQUISICAO DE MEDICAMENTOS E MATERIAL MEDICO HOSPITALAR PARA A REDE '
                  + 'MUNICIPAL DE SAUDE — DIPIRONA SODICA 500MG/ML, SORO FISIOLOGICO 0,9%, SONDA '
                  + 'DE FOLEY CALIBRE 16 FRENCH E CORRELATOS (registro de preco, 12 meses)',
                valorTotalEstimado: 1234567.89,
                dataPublicacaoPncp: iso(-3),
                dataAberturaProposta: abre, dataEncerramentoProposta: fim,
                orgaoEntidade: { cnpj: '00000000000191',
                  razaoSocial: 'SECRETARIA MUNICIPAL DE SAUDE DE APARECIDA DE GOIANIA — FUNDO MUNICIPAL' },
                unidadeOrgao: { ufSigla: 'GO', municipioNome: 'Aparecida de Goiania',
                  nomeUnidade: 'Central de Abastecimento Farmaceutico', codigoUnidade: '1' },
                linkSistemaOrigem: 'https://pncp.gov.br/app/editais',
              });
              // os TRES estados de prazo, para o cartao desenhar os tres cracha diferentes
              const dados = [ um(1, iso(9), iso(1)), um(2, iso(-30), iso(-40)), um(3, null, null) ];
              render(dados, [], [], null, 'dado SINTETICO da medicao A32', null);
              return 'render() com ' + dados.length + ' linhas sinteticas';
            })()`);
            await dormir(1200);
            quantasLinhas = await page.evaluate(`document.querySelectorAll('.lic').length`);
            comoEncheu = 'SINTETICO (' + sintetico + ')';
          }
          /* ══ OS TRÊS PARES QUE MORAM ATRÁS DE UM GESTO ═══════════════════════════════════
             `.mais .cx a` e `.mais .cx button` voltaram "0x0": a gaveta de "⋯ mais ações" nasce
             fechada. `.chip-f button` só existe quando há filtro escolhido. Declarar "não
             pintado" e ir embora seria devolver o mesmo "não sei" com que a fatia começou — o
             navegador serve justamente para dar o gesto.
             >>> O CLIQUE É `el.click()`, e isso já está medido nesta casa: o clique de mouse do
                 automatizador não dispara o `onclick` aqui. Um gesto que não acontece deixaria a
                 gaveta fechada e a medição diria "0x0" achando que mediu. */
          const gestos = await page.evaluate(`(() => {
            const feitos = [];
            /* A gaveta abre pela classe \`on\` no <span class="mais"> — é o que o próprio
               \`onclick\` do botão faz (\`this.parentNode.classList.toggle('on')\`), e é o
               .mais.on .cx{display:block} que a pinta. Clicar o botão OU pôr a classe chegam
               ao mesmo estado; a classe é o caminho que não depende de o clique sintético
               atravessar (já medido nesta casa que ele nem sempre atravessa). */
            const gavetas = [].slice.call(document.querySelectorAll('.lic .mais'));
            gavetas.forEach(g => g.classList.add('on'));
            if (gavetas.length) feitos.push('abriu ' + gavetas.length + ' gaveta(s) ⋯ mais acoes');
            /* Os chips só existem com filtro escolhido: o \`pintaChips\` desenha a partir de
               \`criteriosRefino(refino())\`, que lê os campos. Então o gesto é PREENCHER um
               campo de refino de verdade e mandar a tela redesenhar — e não fabricar o markup
               do chip, que mediria um HTML meu em vez do dela. */
            const campo = document.getElementById('f-orgao');
            if (campo) { campo.value = 'SECRETARIA MUNICIPAL DE SAUDE'; feitos.push('preencheu f-orgao'); }
            const srp = document.getElementById('f-srp');
            if (srp && srp.tagName === 'SELECT' && srp.options.length > 1) { srp.selectedIndex = 1; feitos.push('escolheu f-srp'); }
            if (typeof pintaChips === 'function') {
              try { feitos.push('pintaChips() -> ' + pintaChips() + ' chip(s)'); }
              catch (e) { feitos.push('pintaChips falhou: ' + e.message); }
            }
            return feitos.length ? feitos.join(' · ') : 'nenhum gesto aplicavel';
          })()`);
          await dormir(900);

          const cheio = await medeAgora();
          cheio.gestos = gestos;
          const pngCheio = path.join(LOGS, `${MARCA}_${tela.replace(/\.html$/, '')}_${L.nome}_cheio.png`);
          await page.screenshot({ path: pngCheio, fullPage: false });

          const { vazamento, alvos, estados, pares, varredura } = cheio;
          retrato.telas[tela][L.nome] = { janela, barreira, buscou, comoEncheu, quantasLinhas,
            vazio, cheio, erros, prints: [pngVazio, pngCheio] };
          const png = pngCheio;

          console.log('   ── ' + L.nome + '  (' + L.w + 'x' + L.h + ')');
          console.log('      clientWidth ' + janela.clientWidth + '  ·  innerWidth ' + janela.innerWidth
            + '  ·  scrollWidth ' + janela.scrollWidth
            + (janela.innerWidth !== janela.clientWidth
              ? '   <- a diferenca de ' + (janela.innerWidth - janela.clientWidth) + 'px e a barra de rolagem, e e por isso que a BASE proibe innerWidth'
              : ''));
          const b = barreira;
          if (b.campoSenha || b.portao || b.frase || b.vazioTotal) {
            console.log('      🔒 BARREIRA: ' + (b.campoSenha ? 'campo de senha PINTADO · ' : '')
              + (b.portao ? 'portao de login visivel · ' : '')
              + (b.frase ? 'frase de login/permissao · ' : '') + (b.vazioTotal ? 'tela praticamente vazia · ' : ''));
            console.log('         "' + b.amostra + '"');
            console.log('         PAREI NELA. Nao digito senha, nao peco senha. O que segue e o que da para medir sem sessao.');
          } else if (b.senhasNoDom) {
            console.log('      🔓 sem barreira: ' + b.senhasNoDom + ' campo(s) de senha no DOM e ' + b.senhasPintadas
              + ' pintado(s) — o portao do gm-auth fica montado e escondido; existir nao e barrar');
          }
          console.log('      busca ......... ' + buscou + ' -> ' + comoEncheu + ' · '
            + quantasLinhas + ' linha(s) `.lic` desenhadas');
          console.log('      vazamento ..... ' + (vazamento.vazou > 0
            ? vazamento.vazou + 'px  culpado(s): ' + (vazamento.culpados || []).slice(0, 3)
                .map(c => c.el + ' (+' + c.passouDireita + 'px, largura ' + c.largura + ', pai ' + c.pai + ')').join(' · ')
            : 'nenhum (scrollWidth = clientWidth)'));
          if (alvos) console.log('      alvo de toque . ' + alvos.abaixoDoPiso + ' abaixo de ' + alvos.piso
            + 'px de ' + alvos.total + ' alvos clicaveis MEDIDOS na tela'
            + (alvos.abaixoDoPiso ? '\n         -> ' + alvos.pequenos.slice(0, 6)
                .map(p => p.el + ' ' + p.w + 'x' + p.h + (p.texto ? ' «' + p.texto + '»' : '')).join('\n         -> ') : ''));
          console.log('      4 estados ..... vazio: ' + vazio.estados.encontrados + ' marca(s) · cheio: '
            + estados.encontrados + ' marca(s)'
            + (vazio.estados.itens || []).slice(0, 3).map(i => '\n         · [vazio] ' + i.el + (i.visivel ? ' (pintado)' : ' (escondido)') + ': ' + String(i.texto || '').slice(0, 80)).join('')
            + (estados.itens || []).slice(0, 3).map(i => '\n         · [cheio] ' + i.el + (i.visivel ? ' (pintado)' : ' (escondido)') + ': ' + String(i.texto || '').slice(0, 80)).join(''));
          console.log('      gestos ........ ' + cheio.gestos);
          console.log('      contraste ..... os ' + pares.length + ' pares pendentes, na tela CHEIA:');
          for (const p of pares) {
            if (p.naoPintado) { console.log('         ? ' + p.seletor.padEnd(22) + 'NAO PINTADO — ' + p.motivo); continue; }
            const marca = p.passa === null ? '·' : p.passa ? '✓' : '✗';
            console.log('         ' + marca + ' ' + p.seletor.padEnd(22) + p.razao + ':1 (min ' + p.minimo + ') '
              + p.cor + ' sobre ' + p.fundo + '  [' + p.regra + (p.fundoAssumido ? ' · FUNDO ASSUMIDO BRANCO' : '') + ']'
              + (p.fundosDistintos && p.fundosDistintos.length > 1 ? '  ⚠ ' + p.fundosDistintos.length + ' fundos diferentes' : ''));
          }
          console.log('      varredura ..... ' + varredura.medidos + ' elementos com texto medidos · '
            + varredura.reprovados + ' reprovacoes (' + varredura.unicos.length + ' distintas) · '
            + varredura.isentos + ' isentos (desligado)');
          varredura.unicos.slice(0, 6).forEach(u => console.log('         ✗ ' + u.seletor + '  ' + u.razao
            + ':1 (min ' + u.minimo + ') ' + (u.vezes > 1 ? '×' + u.vezes + ' ' : '') + '«' + u.texto + '»'));
          if (erros.length) console.log('      erros de JS ... ' + erros.length + ': ' + erros.slice(0, 2).join(' | '));
          console.log('      prints ........ ' + path.relative(RAIZ, pngVazio) + '  ·  ' + path.relative(RAIZ, png));
        } catch (e) {
          console.log('   ── ' + L.nome + '  FALHOU: ' + e.message.slice(0, 200));
          retrato.telas[tela][L.nome] = { erro: e.message };
        } finally {
          await ctx.close();
        }
      }
    }
  } finally {
    await navegador.close();
  }

  /* ══ OS 4 ESTADOS, DESENHANDO — item 4 da fatia ═════════════════════════════════════════════
     A régua estática prova que o TEXTO existe no arquivo. Isso é necessário e não é suficiente:
     texto de erro dentro de um `catch` que ninguém alcança está no arquivo e nunca aparece.
     Aqui os estados são PROVOCADOS de verdade, um a um, pela única ponta que dá para segurar
     sem sessão — a REDE. O carregando não se "espera acontecer": ele se produz, segurando a
     resposta; o erro não se supõe: derruba-se a requisição e vê-se o que a tela escreve.
     >>> E ISTO NÃO É SIMULAÇÃO DA TELA, é simulação da REDE. O código que desenha é o mesmo de
         produção, sem uma linha de exceção para teste. */
  if (process.argv.includes('--estados')) {
    console.log('\n══ OS 4 ESTADOS, PROVOCADOS NA REDE (390px)');
    const nav2 = await chromium.launch({ channel: 'chrome', headless: true });
    const cenarios = [
      { nome: 'vazio', prepara: null, espera: 3500, gesto: null },
      /* AS DUAS PONTAS TÊM DE CAIR, e a primeira versão derrubou só uma. Aborti `/rest/v1/**`
         (o nosso banco) e deixei o `pncp.gov.br` passar — e a tela, corretamente, foi tentar o
         PNCP direto. Só que o PNCP está fora HOJE e responde 504 em 70 segundos: a sonda
         esperou 5 e concluiu "o erro não desenha". O erro desenhava; eu é que fui embora antes.
         >>> E ISSO É UM ACHADO POR SI, e vai para o relatório: entre o clique e a mensagem de
             erro há SETENTA SEGUNDOS em que a tela diz "consultando o PNCP…" sem número e sem
             prazo. O estado "carregando" está certo em existir e está mudo sobre quanto falta. */
      { nome: 'carregando', espera: 2500, gesto: 'buscar()',
        prepara: async page => { await page.route('**/rest/v1/**', async r => { await dormir(25000); await r.abort(); });
                                 await page.route('**pncp.gov.br/**', async r => { await dormir(25000); await r.abort(); }); } },
      { nome: 'erro', espera: 6000, gesto: 'buscar()',
        prepara: async page => { await page.route('**/rest/v1/**', r => r.abort('failed'));
                                 await page.route('**pncp.gov.br/**', r => r.abort('failed')); } },
    ];
    for (const c of cenarios) {
      const ctx = await nav2.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
      const page = await ctx.newPage();
      if (c.prepara) await c.prepara(page);
      try {
        await page.goto(BASE + TELAS[0], { waitUntil: 'domcontentloaded', timeout: 30000 });
        await dormir(2500);
        if (c.gesto) await page.evaluate(`(typeof buscar === 'function' ? (buscar(), 1) : 0)`);
        await dormir(c.espera);
        const visto = await page.evaluate(`(() => {
          const pint = el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
            return cs.display!=='none' && cs.visibility!=='hidden' && +cs.opacity!==0 && r.width>0 && r.height>0; };
          /* O ESTADO NAO MORA TODO NO MESMO LUGAR, e a primeira versao desta sonda leu so o
             div#lista — e devolveu "(vazia)" para carregando e erro, como se a tela nao
             desenhasse nada. Ela desenha: o andamento vai para o div#status, que e uma barra
             SEPARADA da lista, de proposito (a lista continua mostrando o resultado velho
             enquanto a busca nova corre). Sonda que le metade da tela reprova a outra metade. */
          const lista = document.getElementById('lista') || document.querySelector('.lista, #resultados');
          const status = document.getElementById('status');
          const t = el => el && pint(el) ? (el.innerText||'').trim().replace(/\\s+/g,' ').slice(0,300) : '';
          const txt = t(lista), sta = t(status);
          const tudo = sta + ' ' + txt;
          const marcas = [].slice.call(document.querySelectorAll('[data-estado],.aviso,.vazio,.carregando,.erro,.skeleton,[aria-busy="true"]'))
            .filter(pint).map(e => ({ el: e.className || e.tagName, texto: (e.innerText||'').trim().replace(/\\s+/g,' ').slice(0,150) }));
          return { textoDaLista: txt, textoDoStatus: sta, marcas: marcas.slice(0, 4),
                   temNumero: /\\d/.test(tudo), temSaida: /tentar de novo|tente de novo|tentar novamente|recarregar/i.test(tudo) };
        })()`);
        const png = path.join(LOGS, `${MARCA}_estado_${c.nome}_390.png`);
        await page.screenshot({ path: png });
        console.log('   ── ' + c.nome.toUpperCase());
        console.log('      #status: "' + (visto.textoDoStatus || '(vazio)') + '"');
        console.log('      #lista:  "' + (visto.textoDaLista || '(vazia)') + '"');
        visto.marcas.forEach(m => console.log('      marca: ' + m.el + ' -> "' + m.texto + '"'));
        if (c.nome === 'carregando') console.log('      COM NUMERO? ' + (visto.temNumero ? 'SIM' : 'NAO — rodinha muda reprova'));
        if (c.nome === 'erro') console.log('      COM SAIDA? ' + (visto.temSaida ? 'SIM' : 'NAO — erro sem caminho de volta reprova'));
        console.log('      print: ' + path.relative(RAIZ, png));
      } catch (e) { console.log('   ── ' + c.nome + '  FALHOU: ' + e.message.slice(0, 160)); }
      finally { await ctx.close(); }
    }
    await nav2.close();
  }

  const dest = arg('--json');
  if (dest) { fs.writeFileSync(path.join(RAIZ, dest), JSON.stringify(retrato, null, 1)); console.log('\nretrato gravado em ' + dest); }

  /* >>> O SERVIDOR QUE ESTE ARQUIVO SUBIU, ESTE ARQUIVO DERRUBA — e o `process.exit(0)` é
         DECLARADO, não decoração. Sem ele a rodada terminava com código 255 mesmo tendo
         medido tudo: sobrava um `spawn` segurando o laço de eventos, e o Node saía por
         caminho de erro. Ferramenta que diz "falhei" depois de dar certo ensina a ignorar o
         código de saída dela — que é a mesma doença do vermelho que ninguém mais lê. */
  if (srv.subiu && srv.proc) { try { srv.proc.kill(); } catch (_) {} }
  process.exit(0);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
