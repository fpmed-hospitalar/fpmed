// SUITE testa_estado_sem_arquivo — a fatia A23: o estado "sem arquivo no PNCP" tem que sobreviver
// ao F5, o comentario do sw.js tem que ser legivel, e o guia tem que ser alcancavel.
//
// == O DEFEITO ERA DE PORTA, E NAO DE REGRA ====================================
// O `tools/coleta_editais.js` (a porta do operador) gravava a linha do "sem arquivo" desde a
// fatia A6. A edge `buscar-edital` (a porta das TELAS) respondia `semArquivo: true` e NAO gravava
// nada. Quem clicava pela tela recebia a frase certa e a perdia no F5 seguinte — e clicava de
// novo, para sempre. Duas portas para o mesmo fato, e so uma com memoria.
//
// O QUE ESTA SUITE TRAVA:
//  1. as duas portas usam a MESMA sentinela de `url_pncp` — sentinela diferente = uma linha de
//     "nao tem arquivo" POR PORTA, e a chave unica deixa de deduplicar;
//  2. a frase gravada e a que a TELA procura — texto diferente e a tela deixando de reconhecer
//     o que ela mesma mandou gravar;
//  3. o segundo buraco (publicou arquivos, nenhum e edital) tambem grava, e com frase PROPRIA:
//     a acao e outra (olhar os anexos no portal x anexar a mao);
//  4. o "quando", porque isto e conferencia datada e nao verdade eterna.
//
//   node tests/testa_estado_sem_arquivo.js
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const CLI = fs.readFileSync(path.join(RAIZ, 'tools', 'coleta_editais.js'), 'utf8').replace(/\r\n/g, '\n');
const EDGE = fs.readFileSync(path.join(RAIZ, 'supabase', 'functions', 'buscar-edital', 'index.ts'), 'utf8').replace(/\r\n/g, '\n');
const TELA = fs.readFileSync(path.join(RAIZ, 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const SW = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8').replace(/\r\n/g, '\n');
const MENU = fs.readFileSync(path.join(RAIZ, 'limedtec-menu.js'), 'utf8').replace(/\r\n/g, '\n');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_estado_sem_arquivo — a fatia A23\n');

// ── 1. AS DUAS PORTAS GRAVAM O MESMO FATO DO MESMO JEITO ─────────────────────
ok(n + '. *** as DUAS portas usam a MESMA sentinela de url_pncp ***',
  /url_pncp: 'sem-arquivo:\/\/pncp'/.test(CLI) && /url_pncp: "sem-arquivo:\/\/pncp"/.test(EDGE)); n++;
ok(n + '. *** e a MESMA frase, que e a que a tela procura pra reconhecer o estado ***',
  /o PNCP não publicou arquivo para esta licitação/.test(CLI)
  && /o PNCP não publicou arquivo para esta licitação/.test(EDGE)
  && /\/não publicou arquivo\/\.test\(a\.extracao_erro/.test(TELA)); n++;
ok(n + '. *** a edge GRAVA o estado, e nao so devolve (era so devolver — dai o F5) ***',
  /if \(r\.status === 404\) \{[\s\S]{0,2200}?licitacao_arquivos\?on_conflict=numero_controle,url_pncp/.test(EDGE)); n++;
/* GRAVAR NAO PODE DERRUBAR A RESPOSTA: se a escrita falhar, a pessoa continua vendo a frase
   certa. O pior que acontece e voltar ao comportamento de antes desta fatia. */
ok(n + '. ...e a falha da gravacao nao vira erro da busca',
  /catch \(_\) \{[\s\S]{0,500}?\}\s*\n\s*await registra\(\{ usuario_id: user\.id, email, numero_controle: controle, negocio_id: negocioId,\s*\n\s*arquivos: 0/.test(EDGE)); n++;

// ── 2. O SEGUNDO BURACO, QUE NINGUEM TINHA NOMEADO ───────────────────────────
/* MEDIDO em 14/08: 0 em 240 licitacoes do indice respondem 404 em /arquivos — e e por isso que o
   defeito passou despercebido. Mas 8 em 80 tem arquivos e NENHUM e edital ou TR (aviso de
   contratacao direta, estudo tecnico, mapa de riscos). Mesmo silencio, caso muito mais comum. */
ok(n + '. *** "publicou arquivos, nenhum e edital" tambem grava estado ***',
  /url_pncp: "sem-edital:\/\/pncp"/.test(EDGE)
  && /arqs\.length && !editais\.length/.test(EDGE)); n++;
ok(n + '. ...com frase e sentinela PROPRIAS (a acao e outra: olhar anexos x anexar a mao)',
  /nenhum `[\s\S]{0,40}deles e edital ou termo de referencia/.test(EDGE)
  && /semEdital: true/.test(EDGE)); n++;
ok(n + '. ...e a tela distingue os dois estados na frase que mostra',
  /nenhum é edital ou/.test(TELA) && /Vale olhar os anexos no portal/.test(TELA)); n++;

// ── 3. O "QUANDO" ────────────────────────────────────────────────────────────
/* Isto e uma CONFERENCIA datada, e nao uma verdade eterna: um orgao pode anexar o edital depois.
   Dizer so "nao publicou" faria a pessoa nunca mais mandar conferir. */
ok(n + '. *** a tela mostra QUANDO foi conferido ***',
  /semArquivo:true, quando: semArq\.coletado_em/.test(TELA)
  && /conferido em ' \+ fmtDt\(DET\.edital\.quando\)/.test(TELA)); n++;
ok(n + '. ...e o campo vem na consulta (sem ele o "quando" seria undefined calado)',
  /select=titulo,tipo,url_pncp,bytes,coletado_em/.test(TELA)); n++;

// ── 4. O COMENTARIO DO sw.js ─────────────────────────────────────────────────
/* O detector: `Ã` sozinho NAO e sintoma — "NAO" e "VERSAO" com til sao portugues correto. O
   sintoma e `Ã` seguido da faixa 0x80–0xBF, a segunda metade de um par UTF-8 lido byte a byte. */
const quebradas = SW.split('\n').map((l, i) => ({ l, i: i + 1 }))
  .filter(x => /Ã[-¿]|â€|â”|â•/.test(x.l));
ok(n + '. *** o comentario do sw.js esta legivel (zero acento quebrado) ***',
  quebradas.length === 0, quebradas.slice(0, 3).map(x => x.i + ': ' + x.l.slice(0, 60))); n++;
ok(n + '. ...e o portugues correto continua la (o conserto nao apagou "NAO"/"VERSAO")',
  /VERSÃO muda/.test(SW) && /NÃO DÁ PRA REAPROVEITAR/.test(SW)); n++;
/* SEM BUMP, O CONSERTO NAO CHEGA em quem ja instalou a casca — e o sintoma continuaria
   identico, o que se le como "o conserto nao funcionou". */
/* ESTE ASSERT FIXAVA O NUMERO EXATO (-79) e reprovava na fatia B16, que bumpou pra -80 por um
   motivo proprio e legitimo. Assert que reprova o CERTO ensina a desligar o teste — e o que ele
   quer proteger nao e "a versao e 79": e "a A21 bumpou, e nenhum bump posterior desandou o dela".
   Entao agora ele le o numero e exige que seja o da A21 OU MAIOR. Um bump pra tras (ou o sumico
   da nota da A21) continua reprovando, que e o defeito de verdade. */
const _vsw = +((SW.match(/const VERSAO = 'limedtec-fpmed-\d{4}-\d{2}-\d{2}-(\d+)'/) || [])[1] || -1);
ok(n + '. ...e a versao do service worker subiu pela fatia A21 (e nunca voltou atras)',
  _vsw >= 79 && /-79 pela FATIA A21/.test(SW), _vsw); n++;
ok(n + '. e a logica do sw.js nao foi tocada (so comentario)',
  /const CACHE = 'limedtec-shell-' \+ VERSAO;/.test(SW)
  && /addEventListener\('fetch'/.test(SW)); n++;

// ── 5. O GUIA GANHOU ENTRADA NO MENU ─────────────────────────────────────────
/* Uma tela viva que nao tem como ser alcancada e pior que uma tela que nao existe: ela esta no
   cache de todo mundo, custa deploy, e o unico jeito de chegar nela era decorando a URL. */
ok(n + '. *** o guia do FPMED ganhou entrada no menu ***',
  /href="fpmed_ajuda\.html"/.test(MENU) && /Como usar o FPMED/.test(MENU)); n++;
ok(n + '. ...no RODAPE, e nao na lista de modulos (ler o guia nao e etapa do fluxo)',
  /lm-rodape[\s\S]{0,260}?fpmed_ajuda\.html/.test(MENU)
  && !/\{ id: 'ajuda'/.test(MENU)); n++;
ok(n + '. ...e ANTES da consulta CMED (quem clica em "como usar" nao sabe o que e a CMED)',
  MENU.indexOf('fpmed_ajuda.html') < MENU.indexOf('fpmed_conferidor.html')); n++;
ok(n + '. ...com icone do MESMO conjunto (24x24, traco 1.8), e nao um emoji solto',
  /ajuda: '<circle cx="12" cy="12" r="8\.5"\/>/.test(MENU)); n++;
ok(n + '. ...e a tela existe e esta na casca (item de menu pra tela ausente e beco)',
  fs.existsSync(path.join(RAIZ, 'fpmed_ajuda.html')) && /fpmed_ajuda\.html/.test(SW)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
