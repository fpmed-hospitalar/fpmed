// SUITE testa_caminho_de_volta — NENHUMA TELA PODE PRENDER QUEM ENTROU NELA.
//
// O Lemuel abriu "Usuarios e acessos" e nao tinha como voltar: a barra do gm-auth ocupa a
// DIREITA (e-mail, chave, Sair) e a esquerda estava vazia. Quem entra so sai pelo botao do
// navegador — e no aplicativo INSTALADO esse botao pode nem existir.
//
// A varredura de 10/08 achou TRES telas assim: limedtec-usuarios (a que ele viu),
// fpmed_competitividade e dashboard_clientes. Esta suite existe pra a quarta nao acontecer.
//
// >>> A LISTA DE TELAS NAO E ESCRITA AQUI: sai do SHELL do sw.js, que e o que o Pages publica.
//     Uma lista a mao envelheceria no dia em que entrasse tela nova — e tela nova e exatamente
//     o caso que este teste existe pra pegar.
//
//   node tests/testa_caminho_de_volta.js
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const R = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');
const SW = R('sw.js');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_caminho_de_volta — toda tela tem como voltar\n');

// As unicas dispensadas, e cada uma por um motivo que vale escrever:
const DISPENSADAS = {
  'index.html': 'splash: o proximo passo dela JA e o sistema',
  'fpmed_sistema_final.html': 'e o proprio menu — voltar pra onde?',
  'reset-senha.html': 'fluxo de login, fora da sessao: nao ha sistema pra voltar ainda',
};

const telas = [...SW.matchAll(/'\.\/([a-z0-9_-]+\.html)'/gi)].map(m => m[1]);
ok('1. a lista de telas sai do SHELL do sw.js (nao e escrita no teste)', telas.length >= 12, telas.length);

const semVolta = [];
for (const t of telas) {
  if (DISPENSADAS[t]) continue;
  if (!fs.existsSync(path.join(RAIZ, t))) continue;
  const s = R(t);
  // conta como caminho de volta: o menu, o portal pai, ou o link montado pelo molde a partir
  // do config (as telas de molde nao podem chumbar o nome do menu)
  const tem = /fpmed_sistema_final\.html/.test(s)
           || /fpmed_licitacoes\.html/.test(s)
           || /LIMEDTEC\.telaPrincipal/.test(s);
  if (!tem) semVolta.push(t);
}
ok('2. *** NENHUMA tela de primeiro nivel sem caminho de volta ***', semVolta.length === 0, semVolta);

// As tres que estavam quebradas em 10/08 — cada uma com seu assert, pra a regressao dizer QUAL
ok('3. limedtec-usuarios (a que o Lemuel achou) tem o link', /id="lt-voltar"/.test(R('limedtec-usuarios.html')));
ok('4. fpmed_competitividade tem o link', /← Sistema/.test(R('fpmed_competitividade.html')));
ok('5. dashboard_clientes tem o link', /← Sistema/.test(R('dashboard_clientes.html')));
ok('6. o leitor de edital tem os DOIS (menu e portal de Licitacoes)',
  /← Sistema/.test(R('fpmed_edital_ia.html')) && /← Licitações/.test(R('fpmed_edital_ia.html')));

// ══════════ O CONSERTO DE FABRICA ══════════
// A tela de Usuarios e do MOLDE: chumbar `fpmed_sistema_final.html` nela quebraria todo cliente
// cujo menu tem outro nome. Quem sabe o nome e o config do cliente.
{
  const U = R('limedtec-usuarios.html'), CFG = R('limedtec-config.js'), CLI = R('cliente.config.js');
  ok('7. *** a tela do molde NAO chumba o nome da tela principal ***',
    !/fpmed_sistema_final/.test(U));
  ok('8. ...ela pergunta ao config', /LIMEDTEC\.telaPrincipal\(\)/.test(U));
  ok('9. o molde expoe `telaPrincipal`', /telaPrincipal: telaPrincipal/.test(CFG));
  ok('10. e o cliente responde qual e a dele', /telaPrincipal: 'fpmed_sistema_final\.html'/.test(CLI));
  ok('11. *** sem config, o molde ESCONDE o link em vez de inventar um ***',
    /if \(!destino\) return;/.test(U) && /style="display:none"/.test(U));
  ok('12. ...e o motivo esta escrito (link pra 404 e pior que link nenhum)',
    /link que leva a 404/i.test(CFG) || /404 é pior que link nenhum/i.test(U));
  ok('13. o conserto esta marcado como DE FABRICA (vale pra qualquer cliente)',
    /CONSERTO DE FABRICA/.test(CFG) && /conserto de fábrica/i.test(U));
}

// ══════════ ONDE O LINK FICA ══════════
// A barra do gm-auth ocupa a direita. Se a volta tambem fosse pra direita, brigaria com ela.
ok('14. o link fica a ESQUERDA, e a razao esta registrada',
  /barra do gm-auth ocupa a (direita|DIREITA)/i.test(R('limedtec-usuarios.html')));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
