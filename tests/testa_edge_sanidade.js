// SUITE testa_edge_sanidade - o erro que derruba uma edge function sem avisar.
//
// == A LICAO S15, DE HOJE ======================================================
// Publiquei a `enviar-boletim` com `let body` declarado DUAS VEZES no mesmo
// escopo. O deploy respondeu "OK, versao 9, status ACTIVE" - porque a Management
// API RECEBE o arquivo, ela nao COMPILA o arquivo. A funcao subiu quebrada e toda
// chamada passou a morrer antes da primeira linha. Eu so descobri porque a minha
// propria sonda voltou vazia; se eu nao estivesse medindo naquele minuto, o
// boletim ficaria fora do ar ate alguem reclamar de e-mail que nao chegou.
//
// >>> "DEPLOY OK" NAO E "FUNCAO DE PE". Sao duas afirmacoes diferentes, e a
//     primeira nao implica a segunda.
//
// == POR QUE ESTA CHECAGEM, E NAO UM COMPILADOR =================================
// Nao ha deno nem typescript nesta maquina, e instalar um compilador so pra isso
// seria dependencia nova pra manter - foi por esse mesmo motivo que a CLI do
// Supabase nunca entrou aqui. Entao a suite nao tenta compilar: ela procura
// EXATAMENTE a classe de erro que ja derrubou uma funcao de verdade, que e
// redeclaracao no mesmo escopo. Cobertura estreita e honesta vale mais que
// cobertura larga imaginaria.
//
// A segunda metade da regra nao cabe em assert e por isso esta escrita aqui:
// TODO DEPLOY TERMINA COM UMA CHAMADA REAL A FUNCAO. Foi o que faltou hoje.
//
//   node tests/testa_edge_sanidade.js
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'supabase', 'functions');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_edge_sanidade - deploy OK nao e funcao de pe\n');

/* ══ O LEITOR ══════════════════════════════════════════════════════════════════
   A primeira versao desta suite usava regex pra tirar comentario e string, e deu
   DOIS vermelhos falsos de uma vez: contou 11 chaves abrindo e 15 fechando num
   arquivo saudavel, e acusou redeclaracao de `r` na ler-edital, que esta no ar
   funcionando ha dias. Os dois eram defeito do instrumento:

     · comentario de fim de linha nao era removido, entao um apostrofo dentro de
       um comentario ("o 'chat'") abria uma string imaginaria que engolia o
       codigo seguinte inteiro;
     · a indentacao foi usada como palpite de escopo — e escopo nao se le por
       indentacao. Os dois `r` da ler-edital moram em funcoes diferentes.

   Licao S10: medida ruim se investiga NA MEDIDA primeiro. Consertar o arquivo por
   causa de um instrumento torto teria estragado o que estava certo.

   Entao o instrumento virou um leitor de verdade: percorre caractere a caractere
   sabendo quando esta dentro de string, template, regex ou comentario, e mantem
   uma PILHA DE ESCOPOS por chave aberta. `let` e `const` sao de bloco — duas
   declaracoes do mesmo nome no MESMO bloco sao erro de sintaxe; em blocos
   diferentes, nao sao nada. */
function leEscopos(src) {
  const pilha = [new Map()];
  const repetidos = [];
  let i = 0, prev = '';
  const n = src.length;
  const antesPermiteRegex = (c) => c === '' || '(,=:[!&|?{};+-*%~^<>'.includes(c) || /\s/.test(c);

  while (i < n) {
    const c = src[i], d = src[i + 1];

    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'") { const q = c; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; prev = q; continue; }
    if (c === '`') { i++; let prof = 0; while (i < n) { if (src[i] === '\\') { i += 2; continue; } if (src[i] === '$' && src[i + 1] === '{') { prof++; i += 2; continue; } if (src[i] === '}' && prof > 0) { prof--; i++; continue; } if (src[i] === '`' && prof === 0) break; i++; } i++; prev = '`'; continue; }
    if (c === '/' && antesPermiteRegex(prev)) {
      let j = i + 1, dentro = false, achou = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') dentro = true; else if (src[j] === ']') dentro = false;
        else if (src[j] === '/' && !dentro) { achou = true; break; }
        j++;
      }
      if (achou) { i = j + 1; while (i < n && /[gimsuyd]/.test(src[i])) i++; prev = '/'; continue; }
    }

    if (c === '{') { pilha.push(new Map()); i++; prev = c; continue; }
    if (c === '}') { if (pilha.length > 1) pilha.pop(); i++; prev = c; continue; }

    const m = /^(let|const|var)\s+([A-Za-z_$][\w$]*)/.exec(src.slice(i, i + 60));
    if (m && !/[\w$.]/.test(prev)) {
      const topo = pilha[pilha.length - 1];
      const nome = m[2];
      if (topo.has(nome)) repetidos.push(nome + ' (bloco ' + (pilha.length - 1) + ')');
      topo.set(nome, true);
      i += m[0].length; prev = 'x'; continue;
    }

    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return { repetidos, profundidadeFinal: pilha.length - 1 };
}

const funcoes = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter(d => fs.existsSync(path.join(dir, d, 'index.ts')))
  : [];

let n = 1;
ok(n + '. achei as edge functions no repo', funcoes.length > 0, funcoes); n++;

for (const fn of funcoes) {
  const src = fs.readFileSync(path.join(dir, fn, 'index.ts'), 'utf8').replace(/\r\n/g, '\n');

  const r = leEscopos(src);
  ok(n + '. ' + fn + ': nenhum nome declarado duas vezes no MESMO bloco (licao S15)',
    r.repetidos.length === 0, r.repetidos); n++;

  // Chave que abre e nao fecha: o corte no meio de uma edicao. O leitor conta
  // ignorando string, template, regex e comentario - que foi onde a contagem
  // por regex se perdeu.
  ok(n + '. ' + fn + ': chaves balanceadas (todo bloco aberto foi fechado)',
    r.profundidadeFinal === 0, r.profundidadeFinal); n++;

  // Toda funcao tem que ter porta: sem segredo configurado, FECHADA, nunca aberta.
  ok(n + '. ' + fn + ': tem porta de autorizacao (nao nasce publica)',
    /Deno\.env\.get\(["'][A-Z_]*TOKEN["']\)/.test(src) || /verify_jwt/.test(src) ||
    /Authorization/.test(src)); n++;
}

// A `enviar-boletim` carrega a trava de compliance; se alguem apagar o arquivo
// inteiro por engano, o assert de existencia avisa antes do commit.
ok(n + '. a enviar-boletim continua no repo, com a trava e a sonda',
  funcoes.includes('enviar-boletim') &&
  /remetenteProibido/.test(fs.readFileSync(path.join(dir, 'enviar-boletim', 'index.ts'), 'utf8')) &&
  /conferir === true/.test(fs.readFileSync(path.join(dir, 'enviar-boletim', 'index.ts'), 'utf8'))); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
