// PROVA DA FATIA B36b — o pdf.js que a fpmed_negocios.html carrega DE VERDADE.
//
// 01/09/2026. A caixa pediu a prova no lugar certo: "a versão medida NO AR (a que o navegador
// carregou, não a que está no HTML)". Ler o HTML e ver `4.2.67` escrito prova só que alguém
// digitou 4.2.67 — não prova que o navegador foi buscar isso, que o CDN entregou, que o módulo
// carregou, nem que a tela ainda extrai o mesmo texto depois da troca de mecanismo (UMD -> ESM).
//
// >>> POR QUE ELE ABRE A TELA DE VERDADE E NÃO UMA PÁGINA DE TESTE: uma página de teste que
//     copia as 12 linhas do carregador prova a CÓPIA, não a tela. Aqui o script navega para a
//     `fpmed_negocios.html` servida pelo servidor local e chama a `carregarPdfjsNeg()` e a
//     `pdfParaTextoNeg()` que a própria tela define — se alguém quebrar o carregador, esta prova
//     cai junto, que é exatamente o que se quer de uma prova.
//
// >>> BROWSER PRÓPRIO, DE PROPÓSITO: a outra janela (trabalhador A) ocupa o perfil do
//     playwright-mcp. Este script sobe um Chrome com `userDataDir` só dele, em pasta temporária,
//     para as duas janelas medirem ao mesmo tempo sem uma derrubar a outra.
//
//   node tools/prova_b36b_pdfjs.js [--base http://127.0.0.1:8099] [--visivel]
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = (arg('--base', 'http://127.0.0.1:8099')).replace(/\/+$/, '');
const TELA = BASE + '/fpmed_negocios.html';
const PDF = 'FPMED_Estoque_para_importar.pdf';   // 3.113.307 bytes, 30 páginas — o mesmo do A na A50

const VERSAO_ESPERADA = '4.2.67';
const VERSAO_VULNERAVEL = '3.11.174';            // CVE-2024-4367

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) { p++; console.log('  ok   ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

(async () => {
  console.log('PROVA B36b — pdf.js medido no ar, dentro da fpmed_negocios.html\n');
  console.log('  tela: ' + TELA);

  let chromium;
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('\n  SEM playwright-core — não dá para medir no navegador. Não vou supor.'); process.exit(2); }

  const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')].find(a => fs.existsSync(a));
  if (!CHROME) { console.log('\n  SEM Chrome instalado no caminho conhecido. Não vou supor.'); process.exit(2); }

  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'fpmed-b36b-'));
  const ctx = await chromium.launchPersistentContext(perfil, {
    executablePath: CHROME, headless: !process.argv.includes('--visivel'), viewport: { width: 1366, height: 900 },
  });

  // A REDE É A TESTEMUNHA: o HTML pode dizer qualquer coisa; o que o navegador PEDIU, não.
  const pedidos = [];
  ctx.on('request', r => { if (/pdf\.js\//.test(r.url())) pedidos.push(r.url()); });
  const erros = [];
  const pg = await ctx.newPage();
  pg.on('pageerror', e => erros.push(String(e.message)));

  try {
    await pg.goto(TELA, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.waitForTimeout(1200);

    // 1. as funções da TELA existem (se a tela mudou de nome, a prova tem que cair)
    const tem = await pg.evaluate(() => ({
      carregar: typeof carregarPdfjsNeg, extrair: typeof pdfParaTextoNeg,
      // e o que está ESCRITO no HTML, para separar "digitado" de "carregado"
      escrito: (typeof PDFJS_CDN_NEG === 'string') ? PDFJS_CDN_NEG : null,
    }));
    ok('1. a tela define carregarPdfjsNeg e pdfParaTextoNeg', tem.carregar === 'function' && tem.extrair === 'function', tem);
    if (tem.carregar !== 'function') throw new Error('a tela não expõe o carregador — o resto da prova não vale');

    // 2. O NÚMERO NO AR: quem responde é o módulo que o CDN entregou, não a constante do arquivo.
    //    `antesDoImport` é medido ANTES de qualquer chamada: é ele que prova que o global não
    //    existia — e portanto que quem o criou foi o próprio módulo 4.x, não outra tela.
    const antesDoImport = await pg.evaluate(() => typeof window.pdfjsLib);
    const medido = await pg.evaluate(async () => {
      const mod = await carregarPdfjsNeg();
      return {
        versao: mod.version || null, worker: mod.GlobalWorkerOptions.workerSrc || null,
        globalTipo: typeof window.pdfjsLib,
        globalVersao: window.pdfjsLib && window.pdfjsLib.version,
        globalEhOModulo: window.pdfjsLib === mod,
      };
    });
    ok('2. *** a versão que o NAVEGADOR carregou é a ' + VERSAO_ESPERADA + ' (CVE-2024-4367 corrigida) ***',
      medido.versao === VERSAO_ESPERADA, medido.versao);
    ok('3. o worker aponta para o .mjs da mesma versão', /4\.2\.67\/pdf\.worker\.min\.mjs$/.test(String(medido.worker)), medido.worker);

    /* 4. O ACHADO DA B36b, E ELE CORRIGE UMA FRASE NOSSA. Estava escrito na casa (A50) que "não
          há mais `window.pdfjsLib`". Medido aqui: o global NÃO existe antes do import e PASSA A
          EXISTIR depois — o build ESM da 4.2.67 o cria como efeito colateral, na versão certa.
          O que sumiu foi o global que se pode ESPERAR com `script.onload`; o global em si voltou.
       >>> E É POR ISSO QUE O ATALHO `if(window.pdfjsLib) return ...` TINHA QUE SAIR, e não por
           estética: `window.pdfjsLib !== mod` (medido). Com o atalho de pé, a primeira chamada
           devolvia o módulo e as seguintes devolveriam OUTRO objeto — mesma versão, objeto
           diferente, e a `GlobalWorkerOptions.workerSrc` que configuramos foi no módulo. Defeito
           que só aparece na segunda leitura de PDF da sessão. */
    ok('4. o global window.pdfjsLib não existe antes do import (quem o cria é o módulo 4.x)',
      antesDoImport === 'undefined', antesDoImport);
    ok('5. e quando ele nasce, nasce na ' + VERSAO_ESPERADA + ' — nenhuma UMD velha injetada na aba',
      medido.globalTipo === 'undefined' || medido.globalVersao === VERSAO_ESPERADA,
      { tipo: medido.globalTipo, versao: medido.globalVersao, ehOModulo: medido.globalEhOModulo });

    // 6. a tela ainda LÊ um edital de verdade — troca de mecanismo que quebra a leitura não serve.
    //    O `byteLength` é lido ANTES do getDocument: o pdf.js transfere o ArrayBuffer para o
    //    worker e o buffer fica DESANEXADO — medir depois devolve 0 e mente sobre o tamanho.
    const leitura = await pg.evaluate(async (nome) => {
      const t0 = performance.now();
      const buf = await (await fetch(nome)).arrayBuffer();
      const bytes = buf.byteLength;
      const txt = await pdfParaTextoNeg(buf);
      return { bytes, caracteres: txt.length, linhas: txt.split('\n').length, ms: Math.round(performance.now() - t0), amostra: txt.slice(0, 120) };
    }, PDF);
    ok('6. a tela extraiu texto de um PDF de verdade (' + leitura.bytes + ' bytes)', leitura.bytes > 0 && leitura.caracteres > 1000, { bytes: leitura.bytes, caracteres: leitura.caracteres, linhas: leitura.linhas, ms: leitura.ms });
    console.log('       amostra: ' + JSON.stringify(leitura.amostra.replace(/\s+/g, ' ')));

    /* 7. LER DUAS VEZES. A primeira leitura passa pelo import; a segunda pelo cache do
          `_pdfjsNeg`. Era exatamente aí que o atalho removido mordia, então a prova tem que
          exercitar o segundo caminho e não só o primeiro. */
    const segunda = await pg.evaluate(async (nome) => {
      const buf = await (await fetch(nome)).arrayBuffer();
      const txt = await pdfParaTextoNeg(buf);
      return { caracteres: txt.length };
    }, PDF);
    ok('7. a SEGUNDA leitura da sessão devolve o mesmo texto (o caminho do cache também funciona)',
      segunda.caracteres === leitura.caracteres, { primeira: leitura.caracteres, segunda: segunda.caracteres });

    // 8. a catraca velha continua de pé — camada nova NÃO aposenta camada velha
    const fonte = fs.readFileSync(path.join(__dirname, '..', 'fpmed_negocios.html'), 'utf8');
    const chamadas = [...fonte.matchAll(/getDocument\s*\(([\s\S]{0,400}?)\)\s*\.promise/g)];
    ok('8. o isEvalSupported:false continua em TODA chamada desta tela (2 camadas, não 1)',
      chamadas.length > 0 && chamadas.every(m => /isEvalSupported\s*:\s*false/.test(m[1])), chamadas.length + ' chamada(s)');

    // 9. a rede não foi buscar a versão vulnerável nenhuma vez
    const vulner = pedidos.filter(u => u.includes(VERSAO_VULNERAVEL));
    ok('9. o navegador não pediu a ' + VERSAO_VULNERAVEL + ' nenhuma vez', vulner.length === 0, vulner);
    console.log('       pediu de fato: ' + JSON.stringify([...new Set(pedidos)], null, 0));

    ok('10. a tela carregou sem erro de JavaScript', erros.length === 0, erros.slice(0, 3));
  } catch (e) {
    f++; console.log('  FALHA (exceção): ' + e.message);
  } finally {
    await ctx.close();
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
  }

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exit(f ? 1 : 0);
})();
