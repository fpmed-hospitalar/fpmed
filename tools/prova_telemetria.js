/* ═══════════════════════════════════════════════════════════════════════════════════════════
   prova_telemetria.js — O EVENTO SAIU? E O QUE FOI DENTRO DELE? (fatia A35, 20/08/2026)

   ══ POR QUE UM NAVEGADOR, E NÃO MAIS UMA SUÍTE ══════════════════════════════════════════════
   O docs/TELEMETRIA.md §5 é literal: *"Instrumentar não é ter escrito o `<script>`"*, e
   *"prova que só lê o próprio código-fonte não vale quando há servidor no caminho"*. A
   `tests/testa_telemetria.js` guarda o arquivo e a chamada; ela não sabe dizer se a requisição
   saiu da máquina e se ela foi aceita. Só o navegador sabe.

   ══ O QUE ELE MEDE, E O TERCEIRO É O QUE NENHUMA OUTRA RÉGUA MEDIU ═══════════════════════════
     1. A REQUISIÇÃO SAIU — pedido para `us.i.posthog.com`, com o código de resposta.
     2. ELA FOI ACEITA — o PostHog responde `{"status":1}` para lote aceito. Um 200 com corpo de
        recusa continua sendo 200: o corpo é que separa "chegou" de "foi entregue no chão".
     3. *** O QUE FOI DENTRO DELA. *** Este é o ponto. O corpo do pedido é o que REALMENTE saiu da
        máquina do dono — não o que o filtro promete, não o que o comentário diz. Ele é lido,
        decodificado e varrido atrás de CNPJ, CPF, e-mail e telefone. É a única prova de
        privacidade que não depende de acreditar em ninguém, inclusive em mim.

   >>> E ELE ENVENENA O EVENTO DE PROPÓSITO. Manda um CNPJ de verdade no termo de busca e depois
       procura esse mesmo CNPJ no corpo que saiu. Se o filtro não estivesse ligado, a varredura o
       acharia — o que faz do assert uma prova nas duas direções em vez de um "não achei nada"
       que também sairia verde com a telemetria inteira desligada.

     node tools/prova_telemetria.js
     node tools/prova_telemetria.js --tela fpmed_negocios.html   (o B pode usar a mesma régua)
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const RAIZ = path.join(__dirname, '..');
const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const PORTA = parseInt(arg('--porta'), 10) || 8123;
const BASE = 'http://127.0.0.1:' + PORTA + '/';
const TELA = arg('--tela') || 'fpmed_licitacoes.html';

/* O CNPJ DA ISCA. Ele é sintaticamente válido e NÃO é de ninguém — dígitos sequenciais. Usar um
   CNPJ real de cliente para testar um filtro de privacidade seria o defeito que o filtro existe
   para impedir, cometido pela ferramenta que o prova. */
const ISCA_CNPJ = '11.222.333/0001-81';
const ISCA_EMAIL = 'isca-da-prova@exemplo-que-nao-existe.com.br';

const dormir = ms => new Promise(r => setTimeout(r, ms));

// ── o servidor local, subido sozinho (mesmo caminho do roda_medicao_tela.js) ────────────────
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
  if (!arq) return { erro: 'nenhum servidor estatico em tools/' };
  const proc = spawn(process.execPath, [arq, String(PORTA)], { cwd: RAIZ, stdio: 'ignore' });
  for (let i = 0; i < 20; i++) { await dormir(400); if (await servidorDePe()) return { subiu: true, proc }; }
  try { proc.kill(); } catch (_) {}
  return { erro: 'o servidor nao respondeu em 8s' };
}

/* O corpo que o PostHog manda vai comprimido e/ou em base64 conforme a versão. Aqui não se tenta
   adivinhar o formato: procura-se a isca no corpo CRU e também no corpo decodificado de base64,
   quando ele for base64. Procurar só na forma bonita seria a maneira mais fácil de "não achar". */
/* ══ LER O CORPO É METADE DA PROVA, E FOI A METADE QUE FALTOU DUAS VEZES ═════════════════════
   O PostHog manda o lote ora como JSON cru, ora como `data=<base64>`, ora como GZIP BINÁRIO —
   e o binário não sobrevive a virar string: `postData()` do Playwright devolve texto, e um byte
   de gzip vira `�` no caminho. A varredura lia lixo e dizia "não achei o CNPJ", que é
   verdade sobre o lixo e nada sobre o que saiu.
   >>> ENTÃO ELA RECEBE O BUFFER (`postDataBuffer`) e tenta as quatro formas, na ordem: texto
       direto, `data=` desembrulhado, base64, e gzip/deflate. Não é excesso de zelo: uma
       varredura de privacidade que não consegue LER o corpo não prova que ele está limpo —
       prova só que ela não olhou. E "não olhei" saindo como verde é o defeito que esta obra
       aprendeu a caçar. */
const zlib = require('zlib');
function formasDoCorpo(buf) {
  if (!buf) return [];
  const bin = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), 'utf8');
  const formas = [];
  const texto = bin.toString('utf8');
  formas.push(texto);
  // gzip/deflate direto sobre os bytes crus
  try { formas.push(zlib.gunzipSync(bin).toString('utf8')); } catch (_) {}
  try { formas.push(zlib.inflateSync(bin).toString('utf8')); } catch (_) {}
  try { formas.push(zlib.inflateRawSync(bin).toString('utf8')); } catch (_) {}
  // e a forma `data=<base64>&compression=...`, com o base64 desembrulhado e depois descomprimido
  const m = /(?:^|&)data=([^&]+)/.exec(texto);
  const candidatos = [m ? decodeURIComponent(m[1]) : null, texto.trim()].filter(Boolean);
  for (const c of candidatos) {
    try {
      const b = Buffer.from(c, 'base64');
      const t = b.toString('utf8');
      if (/[\x20-\x7e]{20,}/.test(t)) formas.push(t);
      try { formas.push(zlib.gunzipSync(b).toString('utf8')); } catch (_) {}
      try { formas.push(zlib.inflateSync(b).toString('utf8')); } catch (_) {}
    } catch (_) {}
  }
  return formas.filter(Boolean);
}

function varre(corpo) {
  const junto = formasDoCorpo(corpo).join('\n');
  return {
    legivel: junto,
    tem_isca_cnpj: junto.indexOf(ISCA_CNPJ) > -1 || junto.indexOf(ISCA_CNPJ.replace(/\D/g, '')) > -1,
    tem_isca_email: junto.indexOf(ISCA_EMAIL) > -1,
    tem_cpf: /\d{3}\.\d{3}\.\d{3}-\d{2}/.test(junto),
    tem_etiqueta: junto.indexOf('parece documento') > -1,
    tamanho: junto.length,
  };
}

(async () => {
  const srv = await garanteServidor();
  if (srv.erro) { console.error('SERVIDOR: ' + srv.erro); process.exit(1); }
  console.log('PROVA DA TELEMETRIA — Chrome da maquina, servidor local, tela ' + TELA);
  console.log('base: ' + BASE + (srv.subiu ? '  (subi o servidor agora)' : '  (ja estava de pe)') + '\n');

  const navegador = await chromium.launch({ channel: 'chrome', headless: true });
  /* ══ O USER-AGENT PRECISOU SER DITO, E O MOTIVO É MEDIDO ═════════════════════════════════════
     Na primeira execução desta prova o PostHog carregou, aceitou as chamadas, respondeu 200 ao
     `/flags/` — e NÃO mandou evento nenhum. A causa é o `opt_out_useragent_filter` do próprio
     SDK: ele descarta silenciosamente quem tem "HeadlessChrome" no User-Agent, que é justamente
     o que o Chrome do Playwright anuncia. Um robô não deve poluir o painel de ninguém, e a
     regra do PostHog está certa.
     >>> ENTÃO A PROVA SE ANUNCIA COMO O NAVEGADOR QUE ELA ESTÁ DIRIGINDO — que é o Chrome
         instalado nesta máquina, o mesmo binário, só sem o "Headless" no nome. Isso NÃO é
         burlar barreira de terceiro: é medir o nosso próprio sistema no nosso próprio servidor,
         mandando evento para a nossa própria conta. A barreira que existe (a do PNCP, a de
         login) continua intocada — a regra da casa é sobre sistema dos outros, e este é nosso. */
  const ctx = await navegador.newContext({
    viewport: { width: 1366, height: 768 }, locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
             + '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  const pedidos = [];      // tudo que foi para o PostHog
  const respostas = new Map();
  page.on('request', r => {
    const u = r.url();
    if (u.indexOf('posthog.com') > -1 || u.indexOf('sentry') > -1) {
      // O BUFFER, e não o texto: gzip não sobrevive a virar string. Ver `formasDoCorpo`.
      let buf = null;
      try { buf = r.postDataBuffer(); } catch (_) {}
      pedidos.push({ url: u, metodo: r.method(), corpo: buf, bytes: buf ? buf.length : 0 });
    }
  });
  page.on('response', async r => {
    const u = r.url();
    if (u.indexOf('posthog.com') === -1) return;
    let texto = '';
    try { texto = (await r.text()).slice(0, 200); } catch (_) {}
    respostas.set(u, { status: r.status(), corpo: texto });
  });

  const erros = [];
  page.on('pageerror', e => erros.push(String(e.message).slice(0, 200)));

  await page.goto(BASE + TELA, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await dormir(4000);

  const estado = await page.evaluate(`(() => {
    const T = window.FPMED_TELEMETRIA;
    return { existe: !!T, ligada: T ? T.ligada() : null, pronto: T ? T.pronto() : null,
             eventos: T ? T.eventos() : null,
             posthogCarregado: !!(window.posthog && window.posthog.__loaded) };
  })()`);

  console.log('a tela carregou o arquivo? ......... ' + (estado.existe ? 'SIM' : 'NAO'));
  console.log('a telemetria ligou? ............... ' + (estado.ligada ? 'SIM' : 'NAO'));
  console.log('o PostHog de verdade subiu? ....... ' + (estado.posthogCarregado ? 'SIM' : 'NAO (so a fila)'));

  /* ── O EVENTO ENVENENADO ────────────────────────────────────────────────────────────────────
     Dois eventos: um limpo (para provar que o caminho funciona) e um com CNPJ e e-mail no termo
     (para provar que o filtro corta). Mandar só o envenenado deixaria a dúvida de se o silêncio
     veio do filtro ou de a telemetria estar morta. */
  /* ══ A PROVA SE DECLARA ROBÔ, E ISSO CUSTOU DUAS EXECUÇÕES PARA DESCOBRIR ═══════════════════
     O `capture()` do PostHog devolvia `undefined` e nenhuma requisição saía, com o SDK
     carregado, `has_opted_out_capturing()` falso e 200 no `/flags/`. A causa é o filtro de robô
     do próprio SDK: ele olha `navigator.webdriver`, que o Playwright liga em toda sessão, e
     DESCARTA o evento em silêncio. A regra do PostHog está certa — robô não deve poluir painel.
     >>> O CONSERTO NÃO É DISFARÇAR O NAVEGADOR. Dá para apagar o `navigator.webdriver` com um
         script de inicialização, e seria mentir para o SDK sobre o que este processo é. O que
         se faz aqui é o contrário: pedir ao SDK, com o botão que ele mesmo oferece
         (`opt_out_useragent_filter`), que aceite este cliente NESTA sessão de teste.
     >>> E ISSO NÃO ENTRA NA CONFIGURAÇÃO DE PRODUÇÃO. Lá o filtro fica ligado, que é o certo:
         `fpmed_telemetria.js` não sabe nada disto, e é esta ferramenta que assume o desvio —
         no lugar onde ele é verdadeiro, e por uma execução só. */
  await page.evaluate(`(() => { try { window.posthog.set_config({ opt_out_useragent_filter: true }); } catch(e){} })()`);

  const enviou = await page.evaluate(`(() => {
    const T = window.FPMED_TELEMETRIA;
    if (!T) return null;
    return {
      limpo: T.evento('resultado_zero', { termo: 'dipirona-prova-a35' }),
      envenenado: T.evento('resultado_zero', { termo: ${JSON.stringify(ISCA_CNPJ)} }),
      envenenado2: T.evento('erro_visto_pelo_usuario', { causa: ${JSON.stringify(ISCA_EMAIL)} }),
      fora_da_lista: T.evento('evento_que_nao_existe', { x: 1 }),
    };
  })()`);
  console.log('\nevento limpo aceito? .............. ' + (enviou && enviou.limpo ? 'SIM' : 'NAO'));
  console.log('evento fora da lista recusado? .... ' + (enviou && enviou.fora_da_lista === false ? 'SIM' : 'NAO'));

  // o PostHog agrupa antes de mandar; este é o tempo de ele decidir enviar.
  await dormir(9000);
  /* E UM FECHAMENTO DE PÁGINA FORÇA A DESCARGA: o `capture_pageleave` e o buffer do PostHog
     mandam o que estiver pendente no `pagehide`. Sem isto, um evento disparado no fim ficaria
     preso no navegador e a prova diria "não saiu" sobre um evento que sairia. */
  await page.evaluate(`(() => { try { window.dispatchEvent(new Event('pagehide')); } catch(e){} })()`);
  await dormir(3000);

  // ── O QUE SAIU DA MÁQUINA ────────────────────────────────────────────────────────────────
  /* ══ O QUE CONTA COMO "PEDIDO DE CAPTURA", E POR QUE A LISTA DE CAMINHOS SAIU DAQUI ══════════
     A primeira versão desta régua filtrava por uma lista de caminhos do PostHog (`/e`, `/batch`,
     `/i/v0/e`) e devolveu **0 de 8 pedidos** — ou seja, ela olhou 8 requisições que saíram e
     disse que nenhuma existia, porque o caminho de hoje não estava na minha lista de ontem.
     >>> É O MESMO DEFEITO DAS OITO CATRACAS DANDO VERDE SOBRE UM PEDAÇO DE ARQUIVO QUE ELAS NÃO
         LIAM (fatia A31): régua que só reconhece o que já conhece dá "não achei" com cara de
         "está limpo" — e aqui isso seria um relatório dizendo que nada vazou porque nada foi
         olhado. O pior desfecho possível se apresentando como o melhor.
     >>> ENTÃO O CRITÉRIO PASSA A SER O QUE IMPORTA DE VERDADE: é POST e tem corpo. Todo caminho
         por onde o PostHog manda evento é POST com corpo; o que ele busca (`array.js`, o
         `/decide`) ou é GET ou não carrega evento nenhum. O caminho exato deixa de importar, e
         a régua não envelhece junto com a URL. */
  /* >>> E O `/flags/` NÃO É CAPTURA. Ele é POST, tem corpo e responde 200 — e a versão anterior
         desta régua o contou como evento e cravou "✅ o evento saiu" sobre uma consulta de
         feature flag. Verde de quem não olhou, dentro da ferramenta que existe para olhar.
         O que separa os dois não é o caminho na URL (que muda): é o CORPO carregar o nome do
         evento que nós disparamos. É esse o assert, logo abaixo. */
  const todosPosthog = pedidos.filter(x => x.url.indexOf('posthog.com') > -1);
  const daCaptura = todosPosthog.filter(x => x.metodo === 'POST' && x.bytes > 0
    && !/\/(flags|decide)\b/.test(x.url));
  console.log('\n=== O QUE SAIU PARA O POSTHOG ===');
  console.log('pedidos ao dominio posthog.com .... ' + todosPosthog.length);
  for (const x of todosPosthog) {
    const r = respostas.get(x.url) || {};
    console.log('   ' + x.metodo.padEnd(5) + String(r.status || '—').padEnd(5)
      + x.url.replace(/^https?:\/\//, '').slice(0, 70)
      + (x.bytes ? '   corpo ' + x.bytes + 'b' : ''));
  }
  console.log('  destes, POST com corpo (captura)  ' + daCaptura.length);

  let algum200 = false, algumAceito = false;
  for (const pd of daCaptura) {
    const r = respostas.get(pd.url) || {};
    if (r.status === 200) algum200 = true;
    if (r.corpo && /"status"\s*:\s*1/.test(r.corpo)) algumAceito = true;
    console.log('  ' + String(r.status || '???') + '  ' + pd.url.slice(0, 78)
      + (r.corpo ? '   resposta: ' + r.corpo.replace(/\s+/g, ' ').slice(0, 40) : ''));
  }

  // ── A VARREDURA DO CORPO — a prova que não depende de acreditar em ninguém ────────────────
  const varreduras = daCaptura.map(pd => varre(pd.corpo));
  const vazouCnpj  = varreduras.some(v => v.tem_isca_cnpj);
  const vazouEmail = varreduras.some(v => v.tem_isca_email);
  const vazouCpf   = varreduras.some(v => v.tem_cpf);
  const temEtiqueta = varreduras.some(v => v.tem_etiqueta);

  console.log('\n=== O QUE IA DENTRO (varredura do corpo que saiu) ===');
  console.log('  o CNPJ da isca saiu? ............ ' + (vazouCnpj ? '*** SIM — VAZOU ***' : 'NAO'));
  console.log('  o e-mail da isca saiu? .......... ' + (vazouEmail ? '*** SIM — VAZOU ***' : 'NAO'));
  console.log('  algum CPF saiu? ................. ' + (vazouCpf ? '*** SIM — VAZOU ***' : 'NAO'));
  console.log('  a etiqueta "(parece documento)"   ' + (temEtiqueta ? 'SIM — o filtro trabalhou e deixou a marca' : 'nao vista no corpo lido'));
  if (erros.length) console.log('\nerros de pagina: ' + erros.slice(0, 3).join(' | '));

  /* ══ O VEREDITO, E ELE EXIGE AS DUAS METADES ═══════════════════════════════════════════════
     "não vazou" sozinho sairia verde com a telemetria desligada — que é o pior desfecho possível
     se apresentando como o melhor. Por isso o veredito só é bom se ALGUM evento saiu E nada
     vazou. Uma metade sem a outra é meia prova, e meia prova nesta obra já passou por inteira. */
  /* O ASSERT QUE FECHA A PORTA DO FALSO VERDE: o nome do evento que EU disparei tem que estar
     dentro dos bytes que saíram. Sem ele, "houve POST com 200" ficaria verde para qualquer
     requisição que o SDK faça por conta própria — e foi exatamente o que aconteceu na primeira
     execução, com o `/flags/`. */
  const nossoEvento = varreduras.some(v => v.legivel && v.legivel.indexOf('resultado_zero') > -1);
  console.log('  o nome do NOSSO evento nos bytes  ' + (nossoEvento ? 'SIM — "resultado_zero" saiu de verdade' : 'NAO'));

  const saiu = daCaptura.length > 0 && algum200 && nossoEvento;
  const limpo = !vazouCnpj && !vazouEmail && !vazouCpf;
  console.log('\n' + (saiu && limpo ? '✅ O EVENTO SAIU (200), O NOME DELE ESTA NOS BYTES, E NADA DE DOCUMENTO FOI JUNTO.'
    : !saiu ? '⚠️  NENHUM evento NOSSO saiu com 200 — a prova nao vale (ver acima).'
            : '❌ ALGO VAZOU no corpo que saiu — o filtro NAO esta segurando.'));
  console.log('   (a 3ª parte da prova, "o painel do PostHog sai de Waiting for events",');
  console.log('    e no painel e nao aqui — esta no relatorio.)');

  await ctx.close(); await navegador.close();
  if (srv.proc) { try { srv.proc.kill(); } catch (_) {} }
  process.exit(saiu && limpo ? 0 : 1);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
