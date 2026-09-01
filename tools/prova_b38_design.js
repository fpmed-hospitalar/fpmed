// PROVA DA FATIA B38 — o passe de design nas quatro telas do B, medido em vez de olhado.
//
// 01/09/2026. A caixa pediu "cara profissional" e deu a régua junto, com número: `#2CA9E0` dá
// 2,67:1 e `#8DC63F` dá 2,04:1 sobre branco; AA pede 4,5:1 em corpo. As duas cores de marca são
// preenchimento, borda e faixa — nunca letra.
//
// >>> POR QUE ESTA PROVA MEDE O PIXEL PINTADO E NÃO O CSS: a cor que chega no olho não é a que
//     está escrita na regra. Ela passa por herança, por `var()` que outra tela remapeia, por
//     `opacity`, e por um fundo que pode vir de três ancestrais acima. Foi assim que se descobriu
//     que `--azul-claro` NÃO é um azul claro na Negócios: ela vale `#115d84` (7,18:1). Auditar o
//     arquivo teria acusado 25 defeitos que não existem — e teria deixado passar os que existem,
//     que estavam em `::after` e em botão pintado por JavaScript.
//
// O que ele faz em cada tela, a 1366 e a 390:
//   · anda em TODO elemento com texto próprio visível, sobe até o primeiro fundo opaco de
//     verdade, e calcula o contraste WCAG contra ele;
//   · cobra 4,5:1 em corpo e 3:1 em texto grande (>=24px, ou >=18,66px em negrito), que é a
//     regra da norma e não um número escolhido aqui;
//   · guarda o print em prints/b38_<tela>_<largura>.png para o antes/depois ficar olhável.
//
// >>> O QUE ELE NÃO ALCANÇA, E ESTÁ DITO EM VEZ DE ESCONDIDO: sem o crachá do dono a tela abre
//     só com a casca — funil vazio, tabela sem linha. Então o que esta prova mede é o CROMO da
//     tela (cabeçalho, botões, faixas, vazios), não as tabelas cheias. As tabelas são cobradas
//     por regra de CSS, na seção 2, que é o que dá para provar sem dado.
//
//   node tools/prova_b38_design.js [--base http://127.0.0.1:8099] [--marca antes|depois]
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = (arg('--base', 'http://127.0.0.1:8099')).replace(/\/+$/, '');
const MARCA = arg('--marca', 'depois');
const RAIZ = path.join(__dirname, '..');
const PRINTS = path.join(RAIZ, 'prints');
const TELAS = ['fpmed_negocios.html', 'fpmed_giovana.html', 'fpmed_ajuda.html', 'fpmed_documentos.html'];
const LARGURAS = [1366, 390];

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) { p++; console.log('  ok    ' + n + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 260) + ']' : '')); } else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 700) + ']' : '')); } };

// A auditoria roda DENTRO da página: contraste depende do que foi pintado, não do que foi escrito.
function auditor() {
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const rgb = s => { const m = String(s).match(/([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/);
    return m ? { c: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] } : null; };
  const razao = (a, b) => { const [L1, L2] = [lum(a), lum(b)].sort((x, y) => y - x); return (L1 + 0.05) / (L2 + 0.05); };
  // O FUNDO É O PRIMEIRO ANCESTRAL OPACO. Parar no pai direto acusaria todo texto dentro de um
  // <span> sem fundo, que é quase todo texto da casa.
  const fundoDe = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = rgb(getComputedStyle(n).backgroundColor);
      if (c && c.a >= 0.95) return c.c;
      n = n.parentElement;
    }
    const c = rgb(getComputedStyle(document.documentElement).backgroundColor);
    return (c && c.a >= 0.95) ? c.c : [255, 255, 255];
  };
  const achados = [], vistos = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (!txt) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.1) continue;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const cor = rgb(cs.color); if (!cor || cor.a < 0.5) continue;
    const bg = fundoDe(el);
    const rz = razao(cor.c, bg);
    const px = parseFloat(cs.fontSize), peso = parseInt(cs.fontWeight) || 400;
    const grande = px >= 24 || (px >= 18.66 && peso >= 700);
    const pede = grande ? 3 : 4.5;
    if (rz < pede) {
      const chave = cs.color + '|' + bg.join(',') + '|' + Math.round(px) + '|' + peso;
      if (vistos.has(chave)) continue; vistos.add(chave);
      achados.push({ razao: +rz.toFixed(2), pede, cor: cs.color, fundo: 'rgb(' + bg.join(', ') + ')',
        px: Math.round(px), peso, onde: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
        texto: txt.slice(0, 40) });
    }
  }
  return achados.sort((a, b) => a.razao - b.razao);
}

(async () => {
  console.log('PROVA B38 — contraste e tabela nas quatro telas do B  (marca: ' + MARCA + ')\n');
  let chromium;
  try { ({ chromium } = require('playwright-core')); }
  catch { console.log('  SEM playwright-core. Não vou supor.'); process.exit(2); }
  const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')].find(a => fs.existsSync(a));
  if (!CHROME) { console.log('  SEM Chrome no caminho conhecido. Não vou supor.'); process.exit(2); }
  if (!fs.existsSync(PRINTS)) fs.mkdirSync(PRINTS, { recursive: true });

  const srv = await require('./servidor_estatico').sobeSePreciso(BASE);
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'fpmed-b38-'));
  const ctx = await chromium.launchPersistentContext(perfil, { executablePath: CHROME, headless: true,
    viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
  // Crachá forjado só para a tela parar de pé; nada do que se mede aqui depende de quem entrou.
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'gmAuth', { configurable: false, writable: false,
      value: { isGestor: () => true, user: { email: 'b38@fpmed.local' }, pronto: Promise.resolve(true) } });
  });
  const pg = await ctx.newPage();

  const resumo = {};
  let tinhaOverlay = false;
  try {
    // ══════════ 1. CONTRASTE DO QUE FOI PINTADO ══════════
    for (const t of TELAS) {
      for (const L of LARGURAS) {
        await pg.setViewportSize({ width: L, height: L === 390 ? 844 : 900 });
        await pg.goto(BASE + '/' + t, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await pg.waitForTimeout(1800);
        const achados = await pg.evaluate(auditor);
        /* ══ O OVERLAY DE LOGIN SAI DO PRINT, E ISSO PRECISOU SER DESCOBERTO DO JEITO RUIM ══════
           A primeira leva de prints saiu com os OITO arquivos do mesmo tamanho em bytes — e não
           só antes igual a depois: a Negócios igual à Proposta, 17.954 bytes as duas. Eram oito
           fotos do `#gm-auth-overlay`, que cobre a tela inteira enquanto ninguém entrou.
           >>> UM PRINT QUE MOSTRA A MESMA COISA EM QUATRO TELAS NÃO É PROVA DE NADA — e ele
               tinha exatamente a cara de uma prova, arquivo com nome certo na pasta certa. Foi o
               `Get-FileHash` que denunciou, não o olho.
           A tela ESTÁ montada por baixo (a auditoria de contraste acha os elementos dela). Então
           o overlay é escondido só para a foto, depois da auditoria já ter rodado — ele não
           altera contraste nenhum, porque o fundo é calculado subindo a árvore do DOM e não pela
           ordem de empilhamento. */
        const cobria = await pg.evaluate(() => {
          const o = document.getElementById('gm-auth-overlay');
          if (!o) return false;
          o.style.display = 'none';
          return true;
        });
        const arq = path.join(PRINTS, 'b38_' + t.replace('.html', '') + '_' + L + '_' + MARCA + '.png');
        await pg.screenshot({ path: arq });
        resumo[t + '@' + L] = achados;
        if (cobria) tinhaOverlay = true;
      }
    }
    /* ══ A CONTA SEPARA O QUE É MEU DO QUE É DE ARQUIVO COMPARTILHADO ═══════════════════════
       Duas peças pintam texto em CIMA das minhas quatro telas e não são minhas: o botão
       "Instalar aplicativo" (`limedtec-pwa.js`, cor escrita em `style.cssText` no JavaScript) e
       o rótulo de grupo do menu (`limedtec-menu.js`). Elas aparecem nas quatro telas do B e nas
       do A do mesmo jeito — o defeito é de lá, o conserto é de lá.
       >>> POR QUE ELAS SAEM DA CONTA E NÃO DA TELA: uma catraca que nunca pode ficar verde é
           uma catraca que todo mundo aprende a ignorar, e aí ela para de segurar o que ela
           segurava. Mas isenção calada é pior: elas são NOMEADAS uma a uma, com o número
           medido, e a lista é FECHADA — qualquer achado novo, inclusive nesses mesmos arquivos,
           reprova. Isento por origem declarada, não por ficar quieto. */
    const DE_FORA = [
      { texto: 'Instalar aplicativo', de: 'limedtec-pwa.js', razao: 2.67,
        nota: 'cor #2CA9E0 escrita em style.cssText no JS; 2,67:1 sobre branco' },
      { texto: 'Oportunidades', de: 'limedtec-menu.js', razao: 4.05,
        nota: 'rótulo de grupo do menu, 10px/600; 4,05:1 sobre o painel do menu' },
    ];
    const ehDeFora = (a) => DE_FORA.some(x => a.texto.trim() === x.texto && Math.abs(a.razao - x.razao) < 0.4);
    const todos = Object.entries(resumo).flatMap(([k, v]) => v.map(a => Object.assign({ onde_tela: k }, a)));
    const meus = todos.filter(a => !ehDeFora(a));
    const fora = todos.filter(ehDeFora);
    ok('1. *** nenhum texto abaixo do piso AA nas quatro telas, a 1366 e a 390 ***',
      meus.length === 0, meus);
    for (const [k, v] of Object.entries(resumo)) {
      const m = v.filter(a => !ehDeFora(a)).length;
      console.log('       ' + k.padEnd(34) + v.length + ' achado(s)' + (v.length - m ? '  (' + (v.length - m) + ' de arquivo compartilhado)' : ''));
    }
    if (fora.length) {
      console.log('\n  >>> ISENTOS POR ORIGEM — NÃO SÃO DAS TELAS DO B, e continuam sendo defeito:');
      for (const d of DE_FORA) console.log('        ' + d.de.padEnd(20) + '"' + d.texto + '"  ' + d.razao + ':1  — ' + d.nota);
      console.log('        (' + fora.length + ' ocorrência(s) nesta rodada. Recado deixado para o A.)\n');
    }
    console.log('       prints em prints/b38_*_' + MARCA + '.png' + (tinhaOverlay ? '  (overlay de login escondido só para a foto)' : ''));

    /* ══ 1b. O PRINT TEM DE MOSTRAR TELAS DIFERENTES ═════════════════════════════════════════
       Esta é a catraca do erro que acabou de acontecer: oito prints saíram idênticos porque
       eram oito fotos do overlay de login. Arquivo com o nome certo, na pasta certa, do tamanho
       certo — e sem nenhuma informação dentro. Foto é a única prova desta fatia que ninguém
       roda: ela é olhada. Então quem confere que ela não está vazia tem de ser código. */
    const crypto = require('crypto');
    const digitais = {};
    for (const t of TELAS) for (const L of LARGURAS) {
      const arq = path.join(PRINTS, 'b38_' + t.replace('.html', '') + '_' + L + '_' + MARCA + '.png');
      if (fs.existsSync(arq)) digitais[t + '@' + L] = crypto.createHash('sha1').update(fs.readFileSync(arq)).digest('hex').slice(0, 10);
    }
    const distintas = new Set(Object.values(digitais)).size;
    ok('1b. *** os 8 prints mostram 8 coisas diferentes (print igual em 4 telas é print de nada) ***',
      distintas === Object.keys(digitais).length, { prints: Object.keys(digitais).length, distintos: distintas, digitais });

    // ══════════ 2. A TABELA, COBRADA POR REGRA (o dado não abre sem crachá) ══════════
    const N = fs.readFileSync(path.join(RAIZ, 'fpmed_negocios.html'), 'utf8');
    // O seletor é `.pk-tab th`, e não `.pk-tab thead th` — a primeira versão deste assert
    // procurou o segundo, não achou, e acusou uma tabela que JÁ tinha cabeçalho fixo desde a
    // catraca testa_tabela_densa do A. Assert que descreve o código que ele gostaria de ver, em
    // vez do que existe, é assert que dá vermelho falso.
    ok('2. a tabela da Negócios tem cabeçalho fixo (rolar a lista não perde o nome da coluna)',
      /\.pk-tab th\{[^}]*position:sticky/.test(N), null);
    /* ══ 3 e 4: A CAIXA PEDIU ZEBRA E A CASA PROÍBE — ESTES DOIS ASSERTS GUARDAM A PROIBIÇÃO ══
       A rodada 13 pediu "zebra clara" nas tabelas. A BASE_VISUAL 2.5 fecha a tabela densa em
       quatro regras e uma delas é **"fio de 1px EM VEZ DE zebra"**; a régua do A (seção 3.7)
       reprova `nth-child(even)` com `background` em tabela com `:hover`, e escreve o motivo: a
       listra briga com o hover e com a seleção.
       Eu escrevi a zebra, medi que a MINHA não brigava (com `:where()`, especificidade zero,
       a linha marcada continuava vencendo no motor) — e desfiz mesmo assim. Contornar a
       catraca não é o mesmo que mudar o padrão, e quem muda o padrão é quem o escreveu.
       >>> ENTÃO O QUE ESTES ASSERTS COBRAM É O PADRÃO DE VERDADE: o fio existe, e a zebra não
           voltou por distração. Se o arquiteto decidir que a zebra entra, são estes dois que
           ele tem de virar — e aí a decisão fica escrita, em vez de acontecer. */
    ok('3. a densidade vem do FIO de 1px, que é o que a BASE_VISUAL 2.5 manda (e não de zebra)',
      /\.pk-tab td\{[^}]*border-bottom:1px solid/.test(N), null);
    /* O COMENTÁRIO SAI ANTES DA PERGUNTA, e isso não é detalhe: a primeira versão deste assert
       leu o arquivo cru e reprovou — porque o comentário que EXPLICA por que a zebra foi
       desfeita contém a receita dela escrita por extenso. Uma catraca que proíbe falar sobre o
       que ela proíbe empurra o motivo para fora do código, que é onde o motivo morre. A régua
       do A já resolve isso com um `limpoCss`; aqui é a mesma ideia, em uma linha. */
    const semComentario = N.replace(/\/\*[\s\S]*?\*\//g, '');
    ok('4. *** e não há zebra em tabela interativa — o padrão da casa, não a minha preferência ***',
      !/\.pk-tab[^{}]*nth-child\s*\(\s*(?:even|odd|2n)/.test(semComentario), null);
    ok('5. número em tabela é tabular-nums (coluna de dinheiro que dança não dá para comparar)',
      (N.match(/tabular-nums/g) || []).length >= 15, (N.match(/tabular-nums/g) || []).length);

    /* ══ 5b/5c. A CASCATA, MEDIDA NO MOTOR — regex não prova especificidade ═══════════════════
       Os asserts 3 e 4 leem o arquivo, e ler o arquivo prova que a regra foi ESCRITA. Quem
       decide qual cor ganha é a cascata, e ela não está no texto: está no motor. Aqui a prova
       monta uma `.pk-tab mk-tab` de verdade dentro da tela de verdade e pergunta ao
       `getComputedStyle` que cor cada linha ficou.
       >>> É ELE QUE GUARDA A LINHA MARCADA, que era o que a zebra ia atropelar. Ele continua
           aqui mesmo depois de a zebra ter sido desfeita, porque o risco não era a zebra: era
           qualquer regra de fundo com peso maior que `.mk-tab tr.on` (0,2,1) — e a próxima
           pode nascer de outro jeito. A catraca guarda o EFEITO, não a causa de hoje. */
    await pg.setViewportSize({ width: 1366, height: 900 });
    await pg.goto(BASE + '/fpmed_negocios.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(1500);
    const cascata = await pg.evaluate(async () => {
      const d = document.createElement('div');
      d.innerHTML = '<table class="pk-tab mk-tab"><tbody>'
        + '<tr id="z1"><td>1</td></tr><tr id="z2"><td>2</td></tr>'
        + '<tr id="z3"><td>3</td></tr><tr id="z4" class="on"><td>4</td></tr></tbody></table>';
      document.body.appendChild(d);
      const bg = id => getComputedStyle(document.getElementById(id)).backgroundColor;
      const impar = bg('z1'), par = bg('z2'), marcada = bg('z4');
      // o hover não dá para forçar por CSSOM; é medido pela regra que casaria, na ordem da folha
      const z2 = document.getElementById('z2');
      const casam = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } })
        .filter(r => r.selectorText && /pk-tab/.test(r.selectorText) && /background/.test(r.style.cssText || ''))
        .map(r => r.selectorText);
      d.remove();
      return { impar, par, marcada, casam };
    });
    ok('5b. a linha comum não tem fundo próprio — a densidade é o fio, e o fundo fica livre para o estado',
      cascata.par === cascata.impar, { impar: cascata.impar, par: cascata.par });
    ok('5c. *** e a linha MARCADA (.on) pinta diferente das outras, medido no motor ***',
      cascata.marcada !== cascata.par && cascata.marcada !== cascata.impar,
      { marcada: cascata.marcada, par: cascata.par, impar: cascata.impar });
    console.log('       regras de fundo que disputam a linha: ' + JSON.stringify(cascata.casam));

    // ══════════ 3. A REGRA QUE A CAIXA DEU, COBRADA NO ARQUIVO ══════════
    // `--cinza-400` é o token que o próprio tema anota "NUNCA texto (2,89:1)". Se ele voltar
    // como `color:` em tela minha, a suíte pega antes do olho.
    for (const t of TELAS) {
      const S = fs.readFileSync(path.join(RAIZ, t), 'utf8');
      const usos = (S.match(/color:\s*var\(--cinza-400\)/g) || []).length;
      ok('6.' + t + ': o --cinza-400 não é usado como tinta (o próprio tema o marca "NUNCA texto")',
        usos === 0, usos);
    }
  } catch (e) {
    f++; console.log('  FALHA (exceção): ' + e.message);
  } finally {
    await ctx.close(); await srv.fecha();
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
  }
  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exit(f ? 1 : 0);
})();
