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
  for (const tela of ['fpmed_licitacoes.html', 'fpmed_negocios.html', 'fpmed_giovana.html',
                      'fpmed_vendas.html', 'fpmed_viabilidade.html', 'fpmed_painel.html',
                      'limedtec-usuarios.html']) {
    const re = new RegExp("nav-item[^>]*onclick=\"location\\.href='" + tela.replace('.', '\\.') + "'\"");
    ok('5.' + tela + ' abre na mesma janela', re.test(nav), tela);
  }
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
