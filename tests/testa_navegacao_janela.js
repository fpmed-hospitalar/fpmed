// SUITE testa_navegacao_janela — UMA JANELA SO. CLICOU NO MENU, ABRE POR CIMA.
//
// 07/08/2026, relato do Lemuel com print: "os itens da secao SISTEMAS abrem em outra
// aba/janela independente". No app instalado isso e pior que feio -- joga o operador pro
// navegador e quebra a experiencia de aplicativo.
//
// >>> O QUE A INVESTIGACAO ACHOU, e vale registrar porque contraria o palpite natural:
//     os itens do MENU nunca abriram janela nova. Os 7 usam `location.href` e nao existe
//     `target="_blank"` nem `window.open` em nenhum deles. Quem abria eram os ATALHOS DO
//     MANIFEST (`shortcuts`): no app instalado eles aparecem no botao direito do icone e na
//     jump list da barra de tarefas, e o padrao do sistema operacional para atalho de app e
//     abrir UMA JANELA NOVA. Duas janelas do mesmo sistema, cada uma com a sua sessao em
//     memoria, e o operador sem saber qual e a de verdade.
//
//   node tests/testa_navegacao_janela.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');

/* ── ALCANCE (12/08, navegação única) ──────────────────────────────────────────────────────
   A barra do portal morreu: as sete entradas dela agora saem só do menu lateral. Estes asserts
   sempre protegeram "há caminho daqui pra tela X", e não "existe uma <nav class=portal>" — a
   barra era o MEIO, o alcance é o FIM. O predicado abaixo aceita os dois meios e não afrouxa
   nenhum: pelo menu, exige que a tela MONTE o menu, CARREGUE o script, e que o destino esteja
   declarado lá. Três condições, não uma. */
const _MENU_SRC = require('fs').readFileSync(require('path').join(raiz, 'limedtec-menu.js'), 'utf8');
const alcanca = (src, destino) => {
  const d = destino.replace(/\./g, '\\.');
  if (new RegExp('href="' + d + '"').test(src)) return true;             // caminho direto na tela
  return /limedtec-menu\.js/.test(src)                                   // a tela carrega o menu
      && /data-limedtec-menu/.test(src)                                  // ...e o monta
      && new RegExp("href: '" + d + "'").test(_MENU_SRC);                // ...e o menu leva lá
};

const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');

const sistema = ler('fpmed_sistema_final.html');
const manifest = JSON.parse(ler('manifest.webmanifest'));
const gerador = ler('tools/gera_manifest.js');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_navegacao_janela — uma janela so, navegacao por cima\n');

// ══════════ 1. TODO ITEM DE MENU NAVEGA NA MESMA JANELA ══════════
{
  // pega o bloco da barra lateral (do <nav> ate o fechamento) pra nao confundir com PDFs
  const nav = sistema.slice(sistema.indexOf('<nav'), sistema.indexOf('</nav>'));
  const itens = nav.match(/<div class="nav-item"[^>]*>/g) || [];
  ok('1. a barra lateral tem itens de menu', itens.length >= 10, itens.length);

  const comBlank = itens.filter(i => /target=["']?_blank/.test(i));
  ok('2. *** NENHUM item de menu abre em aba nova (target="_blank") ***', comBlank.length === 0, comBlank);

  const comOpen = itens.filter(i => /window\.open/.test(i));
  ok('3. *** NENHUM item de menu usa window.open ***', comOpen.length === 0, comOpen);

  // os que trocam de pagina tem que usar location.href
  const cruzam = itens.filter(i => /location\.href/.test(i));
  ok('4. os itens que trocam de tela usam location.href (mesma janela)', cruzam.length >= 6, cruzam.length);

  // e as telas da secao SISTEMAS, uma a uma
  // `fpmed_negocios.html` saiu desta lista em 08/08: ele deixou de ser entrada de menu e virou
  // ABA do portal de Licitacoes. Quem guarda essa rota agora e o testa_funil_negocios.
  for (const tela of ['fpmed_licitacoes.html', 'fpmed_giovana.html',
                      'fpmed_vendas.html', 'fpmed_viabilidade.html', 'fpmed_painel.html',
                      'limedtec-usuarios.html']) {
    const re = new RegExp("nav-item[^>]*onclick=\"location\\.href='" + tela.replace('.', '\\.') + "'\"");
    ok('5.' + tela + ' abre na mesma janela', re.test(nav), tela);
  }
}

// ══════════ 1B. A BARRA DO PORTAL — as duas telas sao UM lugar so (08/08) ══════════
// O menu lateral tem UMA entrada pro modulo. A troca entre Encontrar e Negocios acontece na
// barra do portal, na MESMA janela -- por isso ela e <a href> e nao window.open.
{
  const lic = ler('fpmed_licitacoes.html'), neg = ler('fpmed_negocios.html');
  const barra = s => (s.match(/<nav class="portal">[\s\S]*?<\/nav>/) || [''])[0];
  // 12/08: o Encontrar deixou de ter barra — ele foi a 1a tela a adotar a navegação única.
  ok('17. o Encontrar navega pelo menu lateral (a barra saiu na navegação única)',
    /limedtec-menu\.js/.test(lic) && /data-limedtec-menu/.test(lic) && !barra(lic));
  /* >>> 12/08 — A BARRA MORREU NAS DUAS, e a promessa deste bloco nunca foi "as duas telas tem a
     mesma barra": era "as duas navegam pelo MESMO lugar, senao viram dois sistemas parecidos".
     A barra era o meio, e era o meio RUIM — ela estava copiada em seis telas, e foi assim que a
     entrada do Leitor entrou em duas e faltou nas outras quatro. Agora o lugar unico e o menu. */
  ok('18. o Negocios navega pelo MESMO menu do Encontrar (uma navegacao so, nao duas iguais)',
    /limedtec-menu\.js/.test(neg) && /data-limedtec-menu/.test(neg) && !barra(neg));
  ok('19. *** a navegacao nao abre janela nova em nenhuma das duas ***',
    !/target=|window\.open/.test(_MENU_SRC));
  ok('20. de Encontrar da pra ir pra Negocios', alcanca(lic, 'fpmed_negocios.html'));
  ok('21. ...e de Negocios da pra voltar pro Encontrar', alcanca(neg, 'fpmed_licitacoes.html'));
  // A promessa e ORIENTACAO: quem olha tem que saber onde esta. No Encontrar quem cumpre isso
  // agora e o menu, que DERIVA o modulo do nome do arquivo e acende com `lm-on` +
  // `aria-current`. Derivar e mais forte que marcar na mao: nao ha como a tela esquecer.
  // Agora as DUAS se orientam pelo mesmo mecanismo: o menu DERIVA o modulo do nome do arquivo e
  // acende com `lm-on` + `aria-current`. Derivar e mais forte que marcar na mao — nao ha como a
  // tela esquecer de se marcar, que era exatamente o risco de cada tela ter a sua barra.
  ok('22. cada tela marca onde se esta, e pelo MESMO mecanismo (o menu, que deriva do arquivo)',
    /lm-on/.test(_MENU_SRC) && /aria-current="page"/.test(_MENU_SRC)
    && /limedtec-menu\.js/.test(lic) && /limedtec-menu\.js/.test(neg));
  ok('23. o menu lateral ficou com UMA entrada pro modulo (sem badge PNCP/FUNIL)',
    !/nav-negocios/.test(sistema) && !/>PNCP</.test(sistema) && !/>FUNIL</.test(sistema));
}

// ══════════ 2. A VOLTA TAMBEM ══════════
// "← Sistema" e a outra ponta: se ela abrisse janela nova, o operador acumularia janelas
// so de ir e voltar.
{
  for (const tela of ['fpmed_licitacoes.html', 'fpmed_negocios.html']) {
    const c = ler(tela);
    const volta = (c.match(/<a[^>]*href="fpmed_sistema_final\.html"[^>]*>/g) || [])[0] || '';
    ok('6.' + tela + ' tem o botao "← Sistema"', !!volta, volta);
    ok('7.' + tela + ' volta na MESMA janela (sem target)', !/target=/.test(volta), volta);
  }
}

// ══════════ 3. OS ATALHOS DO MANIFEST — a causa de verdade ══════════
{
  ok('8. *** o manifest NAO declara `shortcuts` (era o que abria janela separada no app) ***',
    !('shortcuts' in manifest), Object.keys(manifest));
  ok('9. ...e o GERADOR tambem nao os recria (senao voltam no proximo gera_manifest)',
    !/shortcuts:\s*\[/.test(gerador));
  ok('10. o gerador explica por que eles sairam (pra ninguem "consertar" devolvendo)',
    /SEM `shortcuts`, e ISTO E O CONSERTO/.test(gerador));
}

// ══════════ 4. O RESTO DO MANIFEST CONTINUA DE PE ══════════
// Tirar shortcuts nao pode ter levado junto o que faz o app ser instalavel.
{
  ok('11. escopo cobre a pasta inteira (navegacao entre telas fica DENTRO do app)',
    manifest.scope === './', manifest.scope);
  ok('12. start_url dentro do escopo', String(manifest.start_url).startsWith('./'), manifest.start_url);
  ok('13. display standalone (janela de app, sem barra de navegador)',
    manifest.display === 'standalone', manifest.display);
  ok('14. os 4 icones continuam la', Array.isArray(manifest.icons) && manifest.icons.length === 4,
    (manifest.icons || []).length);
  ok('15. short_name segue o do cliente', manifest.short_name === 'FPMED', manifest.short_name);
}

// ══════════ 5. window.open QUE PODE FICAR ══════════
// Nem todo window.open e defeito: PDF de proposta e WhatsApp SAO outra janela por natureza.
// A suite existe pra proteger a NAVEGACAO do menu, nao pra proibir a palavra.
{
  const opens = (sistema.match(/window\.open\([^)]*\)/g) || []);
  const legitimos = opens.filter(o => /''|'', *'_blank'|api\.whatsapp|wa\.me/.test(o));
  ok('16. os window.open que restam sao de PDF/impressao e WhatsApp (outra janela de proposito)',
    opens.length === legitimos.length, opens.filter(o => !legitimos.includes(o)));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
