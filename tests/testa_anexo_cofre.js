// SUITE testa_anexo_cofre — O CRACHA E O TIPO NAS CHAMADAS AO COFRE (fatia B16, 14/08/2026).
//
// == O QUE ESTA SUITE EXISTE PRA IMPEDIR ======================================
// O cofre de arquivos (Supabase Storage) tem DUAS travas, e o projeto ja esbarrou
// em cada uma numa fatia diferente:
//
//   TRAVA 1 - O CRACHA. As policies `docs_storage_sobe` e `docs_storage_le` exigem
//     `authenticated`. O `gm-auth.js` troca o cracha pelo da sessao SO em
//     `/rest/v1/` (linha `input.indexOf('/rest/v1/')`), entao toda chamada a
//     `/storage/v1/` ia com a chave `anon` e era recusada pela RLS.
//   TRAVA 2 - O TIPO. O cofre valida o formato pelo `Content-Type`. Mandar o
//     cabecalho do REST (`application/json`) num ENVIO DE ARQUIVO da 415.
//
// MEDIDO NO COFRE DE VERDADE em 14/08 (tools/prova_anexo_documentos.js), com a
// sessao de um usuario real e nao com a service_role:
//     cracha anon   + application/pdf   ->  400 {"statusCode":"403","...row-level security..."}
//     cracha sessao + application/json  ->  400 {"statusCode":"415","invalid_mime_type"}
//     cracha sessao + application/pdf   ->  200
//
// == POR QUE UMA SUITE DE CODIGO-FONTE, SE A REGRA E "PERGUNTE AO SERVIDOR" ====
// Porque as duas fazem coisas diferentes. Quem PROVA que funciona e a prova, que
// fala com o cofre. Esta suite e o ALARME: ela reprova no dia em que alguem
// reescrever um envio de volta para o jeito antigo, sem precisar de rede nem de
// senha para tocar. A prova mede o presente; a suite protege o futuro.
//
// == E ELA OLHA AS DUAS TELAS ==================================================
// A B15 consertou o tipo no Negocios e mediu com a SERVICE_ROLE, que passa por
// cima de toda RLS - entao provou o cofre e nao provou o navegador, e o "Anexar"
// continuou morrendo uma trava adiante. Um assert que so olhasse uma tela
// repetiria esse erro.
//
//   node tests/testa_anexo_cofre.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');

const TELAS = [
  { arq: 'fpmed_documentos.html', nome: 'Documentos' },
  { arq: 'fpmed_negocios.html', nome: 'Negocios' },
];
const GM = R('gm-auth.js');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_anexo_cofre — o cracha e o tipo nas chamadas ao cofre (fatia B16)\n');

// ═════════ 0. A PREMISSA DA SUITE INTEIRA, CONFERIDA E NAO SUPOSTA ═════════
/* Todo assert daqui para baixo so faz sentido porque o gm-auth NAO cobre o
   storage. Se um dia ele passar a cobrir, este assert cai primeiro e conta o
   porque — em vez de deixar 15 asserts virarem cerimonia sem motivo. */
const patch = (GM.match(/window\.fetch = async function[\s\S]*?\n  \};/) || [])[0] || '';
ok(n + '. (premissa) o gm-auth so troca o cracha em /rest/v1/ — o storage fica de fora',
  /indexOf\('\/rest\/v1\/'\)/.test(patch) && !/storage\/v1/.test(patch)); n++;

for (const t of TELAS) {
  const HTML = R(t.arq);
  console.log('  ── ' + t.nome + ' ──');

  // ═════════ 1. O AJUDANTE DO CRACHA EXISTE E LE A SESSAO DE VERDADE ═════════
  const cab = (HTML.match(/function cabecalhoCofre\(tipo\)\{[\s\S]*?\n\}/) || [])[0];
  const tok = (HTML.match(/function tokenDaSessao\(\)\{[\s\S]*?\n\}/) || [])[0];
  ok(n + '. [' + t.nome + '] existe um ajudante unico que monta o cabecalho do cofre',
    !!cab && !!tok); n++;
  if (!cab || !tok) continue;
  ok(n + '. [' + t.nome + '] ele le o token da sessao do gm-auth (chave `gm_session`)',
    /gm_session/.test(tok) && /access_token/.test(tok)); n++;
  /* SEM SESSAO ELE NAO PODE ESTOURAR: a tela tem que chegar no servidor e mostrar
     a recusa traduzida ("sua sessao expirou"), e nao morrer num TypeError que o
     operador le como "a tela travou". */
  const API = new Function('const SB_KEY="anon-de-teste";const localStorage={getItem:()=>null};'
    + tok + '\n' + cab + '\nreturn cabecalhoCofre;')();
  const semSessao = API('application/pdf');
  ok(n + '. [' + t.nome + '] sem sessao ele NAO estoura — cai no anon e deixa o servidor recusar',
    semSessao.Authorization === 'Bearer anon-de-teste'
    && semSessao.apikey === 'anon-de-teste', semSessao); n++;
  const API2 = new Function('const SB_KEY="anon-de-teste";'
    + 'const localStorage={getItem:()=>JSON.stringify({access_token:"tok-da-sessao"})};'
    + tok + '\n' + cab + '\nreturn cabecalhoCofre;')();
  ok(n + '. [' + t.nome + '] com sessao, o Authorization e o token E o apikey continua o anon',
    API2('application/pdf').Authorization === 'Bearer tok-da-sessao'
    && API2('application/pdf').apikey === 'anon-de-teste', API2('application/pdf')); n++;
  /* O `Content-Type` e OPCIONAL de proposito: quem envia arquivo manda o tipo do
     arquivo, quem assina URL manda json, e ninguem herda o do outro por descuido. */
  ok(n + '. [' + t.nome + '] o tipo e escolhido por quem chama, nunca herdado',
    API2('image/png')['Content-Type'] === 'image/png'
    && !('Content-Type' in API2())); n++;

  // ═════════ 2. TODA CHAMADA AO COFRE PASSA PELO AJUDANTE ═════════
  /* O assert que a caixa pediu com estas palavras: *"assert que falha se o
     cabecalho errado voltar"*. Ele nao confere UMA chamada: confere TODAS, porque
     o defeito da B15 foi exatamente uma copia esquecida. */
  const chamadas = [...HTML.matchAll(/fetch\(`\$\{SB_URL\}\/storage\/v1\/[\s\S]{0,400}?\}\);/g)].map(m => m[0]);
  ok(n + '. [' + t.nome + '] esta tela fala com o cofre (achei as chamadas)',
    chamadas.length > 0, chamadas.length); n++;
  const semAjudante = chamadas.filter(c => !/cabecalhoCofre\(/.test(c));
  ok(n + '. *** [' + t.nome + '] TODAS as ' + chamadas.length + ' chamadas ao cofre levam o cracha da sessao ***',
    semAjudante.length === 0, semAjudante.map(c => c.slice(0, 90))); n++;
  /* SB_H carrega o cracha anon (e, no Negocios, tambem o Content-Type do REST).
     Ele nunca mais pode aparecer numa chamada de storage. */
  const comSB_H = chamadas.filter(c => /\bSB_H\b|\bSB_HW\b/.test(c));
  ok(n + '. *** [' + t.nome + '] nenhuma chamada ao cofre usa SB_H/SB_HW (o cracha anon) ***',
    comSB_H.length === 0, comSB_H.map(c => c.slice(0, 90))); n++;

  // ═════════ 3. O ENVIO DE ARQUIVO MANDA O TIPO DO ARQUIVO ═════════
  const envios = chamadas.filter(c => /\/storage\/v1\/object\/documentos\//.test(c) && !/\/object\/sign\//.test(c));
  ok(n + '. [' + t.nome + '] achei o envio de arquivo', envios.length > 0, envios.length); n++;
  ok(n + '. *** [' + t.nome + '] o envio NAO manda o Content-Type do REST (era o defeito da B15) ***',
    envios.every(c => !/'Content-Type'\s*:\s*'application\/json'/.test(c)),
    envios.filter(c => /application\/json/.test(c)).map(c => c.slice(0, 90))); n++;
  ok(n + '. *** [' + t.nome + '] o envio manda o tipo DO ARQUIVO, decidido por tipoDoArquivo ***',
    envios.every(c => /cabecalhoCofre\(\s*(tipo|tipoDoArquivo\(arq\))\s*\)/.test(c)),
    envios.map(c => c.slice(0, 120))); n++;

  // ═════════ 4. A TELA TRADUZ A RECUSA, NAO GUARDA A LISTA DO COFRE ═════════
  /* Uma segunda lista de formatos aqui um dia discordaria da do cofre — e a tela
     recusaria um arquivo que ele aceita, ou prometeria um que ele recusa. */
  ok(n + '. [' + t.nome + '] a recusa por formato vira instrucao ("converta para PDF")',
    /invalid_mime_type\|415/.test(HTML) && /Converta para PDF e mande de novo/.test(HTML)); n++;
  /* O 403 do cofre vem NO CORPO ({"statusCode":"403"}), com HTTP 400 por fora.
     Quem so olhasse `status===403` traduziria a falta de permissao como um
     "HTTP 400" generico — que nao ensina nada a quem esta na tela. */
  ok(n + '. *** [' + t.nome + '] o 403 e lido do CORPO, nao so do status HTTP ***',
    /"403"|row-level security/.test(HTML)); n++;
  ok(n + '. [' + t.nome + '] e a sessao vencida tem frase propria, com o que fazer',
    /sess(a|ã)o expirou/i.test(HTML)); n++;

  // ═════════ 5. O TIPO SAI DA EXTENSAO QUANDO O NAVEGADOR NAO SABE ═════════
  const fTipo = (HTML.match(/function tipoDoArquivo\(arq\)\{[\s\S]*?\n\}/) || [])[0];
  const fMime = (HTML.match(/const MIME_POR_EXT = \{[\s\S]*?\};/) || [])[0];
  ok(n + '. [' + t.nome + '] a regra do tipo existe e e pura', !!fTipo && !!fMime
    && !/\bdocument\.|\bfetch\(|\bwindow\./.test(fTipo)); n++;
  if (fTipo && fMime) {
    const tipoDe = new Function(fMime + '\n' + fTipo + '\nreturn tipoDoArquivo;')();
    ok(n + '. [' + t.nome + '] o navegador manda quando sabe',
      tipoDe({ name: 'x.bin', type: 'application/pdf' }) === 'application/pdf'); n++;
    ok(n + '. [' + t.nome + '] quando ele nao sabe, a extensao decide (e MAIUSCULA vale)',
      tipoDe({ name: 'CONTRATO.PDF', type: '' }) === 'application/pdf'
      && tipoDe({ name: 'foto.jpeg', type: '' }) === 'image/jpeg'); n++;
    /* Extensao desconhecida NAO pode virar um palpite de PDF: mandar
       "application/pdf" num .docx faria o cofre aceitar um arquivo que ele nao
       deveria guardar, e a mentira so apareceria na hora de abrir. */
    ok(n + '. *** [' + t.nome + '] extensao desconhecida nao vira palpite de PDF ***',
      tipoDe({ name: 'proposta.docx', type: '' }) === 'application/octet-stream',
      tipoDe({ name: 'proposta.docx', type: '' })); n++;
  }
  console.log('');
}

console.log('RESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
