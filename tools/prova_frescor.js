/* ═══════════════════════════════════════════════════════════════════════════════════════════
   prova_frescor.js — OS TRÊS ESTADOS DA FAIXA DE FRESCOR, NA TELA PINTADA (fatia A34, 20/08)

   ══ POR QUE ELA PRECISA SER PROVADA NO NAVEGADOR ════════════════════════════════════════════
   A faixa de frescor é a CONTA que a A34 paga: quem deixa de perguntar ao portal na hora do uso
   passa a dever a idade do que mostra. A regra da caixa é dura e é uma frase — *"NUNCA esconda
   dado velho: diga a idade"* — e ela tem três desfechos, dos quais **dois quase nunca
   acontecem** no dia a dia: a carga velha e o "não sei".
   >>> UM ESTADO QUE SÓ APARECE NO DIA RUIM É UM ESTADO QUE NINGUÉM NUNCA VIU. Ler o código e
       concluir que ele funciona é a mesma classe de erro que esta obra vem caçando; e esperar o
       dia ruim para descobrir que a faixa quebrou é descobrir tarde.
   >>> ENTÃO O CARIMBO É TROCADO NA TELA, e não no banco. A `carimboCarga()` é substituída por
       uma que devolve o carimbo que eu quero, a `faixaFrescor()` de verdade roda em cima dela, e
       o que se mede é o que o NAVEGADOR PINTOU: as classes, o texto e a cor computada.
       Trocar o carimbo no BANCO para ver a faixa âmbar seria mexer em dado de produção para
       fazer um teste — que é o oposto do que esta casa faz.

   ══ O QUE SE MEDE, e nenhum dos três é opinião ══════════════════════════════════════════════
     fresco (≤ 12 h) .. faixa NEUTRA, com a hora e os dois números do índice
     velho (> 12 h) ... faixa ÂMBAR, com a IDADE REAL em horas ou dias — nunca escondida
     não sei .......... `ultima_ok` NULL: âmbar, e dizendo "a carga nunca terminou por inteiro",
                        NUNCA a hora da última TENTATIVA (que é verdade da licitação e mentira
                        do item)

     node tools/prova_frescor.js
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const RAIZ = path.join(__dirname, '..');
const PORTA = 8123;
const BASE = 'http://127.0.0.1:' + PORTA + '/';
const TELA = 'fpmed_licitacoes.html';
const dormir = ms => new Promise(r => setTimeout(r, ms));

function servidorDePe() {
  return new Promise(res => {
    const r = http.get(BASE, { timeout: 2500 }, x => { x.resume(); res(true); });
    r.on('error', () => res(false));
    r.on('timeout', () => { r.destroy(); res(false); });
  });
}
async function garanteServidor() {
  if (await servidorDePe()) return { subiu: false, proc: null };
  const arq = path.join(__dirname, 'servidor_estatico.js');
  if (!fs.existsSync(arq)) return { erro: 'nao achei tools/servidor_estatico.js' };
  const proc = spawn(process.execPath, [arq, String(PORTA)], { cwd: RAIZ, stdio: 'ignore' });
  for (let i = 0; i < 20; i++) { await dormir(400); if (await servidorDePe()) return { subiu: true, proc }; }
  try { proc.kill(); } catch (_) {}
  return { erro: 'o servidor nao respondeu em 8s' };
}

/* OS TRÊS CARIMBOS. O `detalhe` tem os campos que o `tools/carga_diaria.js` grava de verdade —
   copiar a forma real importa: um carimbo de mentira com outra forma provaria que a faixa
   funciona sobre um objeto que nunca vai existir. */
const CASOS = [
  {
    nome: 'FRESCO (2 horas)',
    horas: 2,
    carimbo: h => ({ ultima_ok: new Date(Date.now() - h * 3600000).toISOString(),
                     ultima_tentativa: new Date(Date.now() - h * 3600000).toISOString(),
                     ultimo_erro: null,
                     detalhe: { licitacoes: 14583, itens: 278055, sem_itens: 4067 } }),
    esperaAmbar: false,
  },
  {
    nome: 'VELHO (3 dias)',
    horas: 72,
    carimbo: h => ({ ultima_ok: new Date(Date.now() - h * 3600000).toISOString(),
                     ultima_tentativa: new Date(Date.now() - h * 3600000).toISOString(),
                     ultimo_erro: null,
                     detalhe: { licitacoes: 14583, itens: 278055, sem_itens: 4067 } }),
    esperaAmbar: true,
  },
  {
    nome: 'NAO SEI (ultima_ok NULL, com tentativa recente)',
    horas: 0,
    carimbo: () => ({ ultima_ok: null,
                      ultima_tentativa: new Date(Date.now() - 3 * 3600000).toISOString(),
                      ultimo_erro: 'itens: terminou com codigo 1',
                      detalhe: { licitacoes: 14583, itens: 278055 } }),
    esperaAmbar: true,
  },
];

(async () => {
  const srv = await garanteServidor();
  if (srv.erro) { console.error('SERVIDOR: ' + srv.erro); process.exit(1); }
  console.log('PROVA DA FAIXA DE FRESCOR — os tres estados, na tela pintada');
  console.log('base: ' + BASE + (srv.subiu ? '  (subi o servidor agora)' : '  (ja estava de pe)') + '\n');

  const navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await navegador.newContext({ viewport: { width: 1366, height: 768 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  await page.goto(BASE + TELA, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await dormir(1500);

  let p = 0, f = 0;
  const ok = (n, c, e) => { if (c) { p++; console.log('    ✓ ' + n); } else { f++; console.log('    ✗ ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

  for (const caso of CASOS) {
    const carimbo = caso.carimbo(caso.horas);
    const r = await page.evaluate(`(async (c) => {
      window.carimboCarga = async () => c;      // a porta trocada, e SO ela
      await faixaFrescor();                     // a funcao de verdade, pintando de verdade
      const el = document.getElementById('frescor');
      const cs = getComputedStyle(el);
      return { classe: el.className, escondido: el.hidden,
               texto: (el.innerText || '').replace(/\\s+/g, ' ').trim(),
               fundo: cs.backgroundColor, cor: cs.color, borda: cs.borderLeftColor };
    })(${JSON.stringify(carimbo)})`);

    console.log('  ── ' + caso.nome);
    console.log('     classe: ' + r.classe + '   fundo: ' + r.fundo);
    console.log('     texto : ' + r.texto.slice(0, 160));
    ok('a faixa apareceu (nao fica muda sobre a idade do dado)', !r.escondido && r.texto.length > 20);
    ok(caso.esperaAmbar ? 'esta em AMBAR (ha idade a denunciar)' : 'esta NEUTRA (carga fresca)',
      /\batencao\b/.test(r.classe) === caso.esperaAmbar, { classe: r.classe });
    /* A COR COMPUTADA, e não a classe: classe é intenção, cor é o que a pessoa vê. Foi a lição
       da A32 — "eu não logo, então isto é medição do arquivo" custou cinco rodadas. */
    ok('...e a cor computada acompanha a classe',
      caso.esperaAmbar ? r.fundo !== 'rgb(255, 255, 255)' && r.fundo !== 'rgba(0, 0, 0, 0)' : true,
      { fundo: r.fundo });

    if (caso.nome.startsWith('FRESCO')) {
      ok('*** diz a HORA da carga e os dois numeros do indice ***',
        /14\.583/.test(r.texto) && /278\.055/.test(r.texto) && /às \d{2}:\d{2}/.test(r.texto));
      ok('...e NAO fala em idade (nao ha idade a denunciar)', !/atualizados há/.test(r.texto));
    }
    if (caso.nome.startsWith('VELHO')) {
      ok('*** NAO esconde: diz a idade real em dias ***', /atualizados há/.test(r.texto) && /3 dias/.test(r.texto));
      /* ACHADO NESTA PROVA, em 20/08: a faixa velha escrevia "há 3 dias (10:48)" — hora sem o
         dia, no unico caso em que o dia importa. Quem bate o olho le "10:48" e completa com "de
         hoje", que e o contrario do que a frase esta dizendo. */
      ok('*** e a hora vem COM A DATA (hora solta seria lida como de hoje) ***',
        /\(em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}\)/.test(r.texto), { texto: r.texto.slice(0, 120) });
      ok('...e o titulo nao desmente o numero ("Indice do dia" sobre dado de 3 dias)',
        /Índice desatualizado/.test(r.texto) && !/Índice do dia/.test(r.texto));
      ok('...e diz o que fazer (a carga roda no comeco de cada rodada)', /a carga roda no começo/.test(r.texto));
    }
    if (caso.nome.startsWith('NAO SEI')) {
      ok('*** diz "a carga nunca terminou por inteiro" ***', /carga nunca terminou por inteiro/.test(r.texto));
      /* ESTE É O ASSERT QUE A CAIXA PEDIU COM NOME: a hora da última TENTATIVA não pode virar a
         hora da carga. Era verdade da licitação e mentira do item. */
      ok('*** e NAO se apresenta como "atualizado hoje as HH:MM" ***',
        !/atualizados hoje às/.test(r.texto) && !/Índice do dia/.test(r.texto));
      ok('...mas DIZ quando foi a ultima tentativa, e que ela nao fechou',
        /última tentativa foi em/.test(r.texto) && /não fechou/.test(r.texto));
      ok('...e carrega o motivo do erro junto', /terminou com codigo 1/.test(r.texto));
    }
  }

  await ctx.close();
  await navegador.close();
  if (srv.subiu && srv.proc) { try { srv.proc.kill(); } catch (_) {} }

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
