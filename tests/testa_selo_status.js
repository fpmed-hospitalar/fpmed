// SUITE testa_selo_status — UM SELO QUE MENTE E PIOR QUE SELO NENHUM.
//
// 06/08/2026. Nasceu de um defeito que o Lemuel viu NO AR: o rodapé da barra lateral mostrava
// "Sem conexão · Supabase · FPMED" ENQUANTO o dashboard exibia dados recém-carregados do
// proprio Supabase. Quem le aquilo para de confiar no sistema inteiro -- e com razao, porque
// naquele instante o sistema estava afirmando duas coisas contrarias na mesma tela.
//
// ERAM DOIS DEFEITOS, e o segundo e o que deixava o primeiro invisivel:
//   1. `setDbStatus()` so era chamado no `iniciar()`. UMA falha no boot (a piscada de rede do
//      refresh de sessao, por exemplo) pintava "Sem conexao" e nunca mais atualizava. Todas as
//      consultas seguintes funcionavam e o selo continuava vermelho -- para sempre.
//   2. `sbGet` NAO OLHAVA `r.ok`. Um 401/403/5xx devolve objeto de erro, que nao e array, entao
//      o `break` mandava `[]` de volta. Pra quem chamava, "nao consegui perguntar" e "nao tem
//      nada" viravam a MESMA resposta -- e o selo nunca ficava sabendo da falha.
//      E o mesmo defeito que fechamos no banco no mesmo dia, do lado de ca.
//
// O que esta suite trava:
//   1. o selo e escrito pelo FUNIL das consultas, nunca por um segundo lugar;
//   2. `sbGet` estoura em erro de servidor em vez de devolver lista vazia;
//   3. recarga que falha NAO esvazia a tela (o ultimo dado bom continua valendo);
//   4. a falha carrega MOTIVO -- "Sem conexao" sozinho manda reiniciar o computador; "sua
//      sessao expirou" manda fazer login, que e o que resolve.
//
//   node tests/testa_selo_status.js
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8').replace(/\r\n/g, '\n');

function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora: ' + ini);
  return src.slice(s, e);
}

// ── DOM e rede de mentira: as funcoes REAIS do arquivo rodam fora do navegador ──
const EL = {
  'db-dot': { className: '', closest: () => EL['db-status'] },
  'db-status-text': { textContent: '', closest: () => EL['db-status'] },
  'db-status': { title: '' },
};
const doc = { getElementById: id => EL[id] || null };
let RESPOSTA = null;                     // o que o fetch de mentira devolve
const fetchFalso = async () => {
  if (typeof RESPOSTA === 'function') return RESPOSTA();
  return RESPOSTA;
};
const resp = (status, corpo) => ({ ok: status >= 200 && status < 300, status,
  json: async () => corpo, statusText: 'HTTP ' + status });

const ctx = (new Function('document', 'fetch', 'console',
  "const SUPA_URL2='http://x'; const SUPA_KEY2='k'; const SH={};\n" +
  bloco('let _dbUltimoOk = null;', 'async function sbPost') +
  bloco('function setDbStatus(online, motivo)', '// ─── NAVEGAÇÃO') +
  'return { sbGet, setDbStatus, _marcaDb, _motivoDb };'))(doc, fetchFalso, { warn(){}, error(){} });
const { sbGet, setDbStatus } = ctx;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_selo_status — o selo tem que dizer o que a ultima consulta deu\n');

const selo = () => EL['db-status-text'].textContent;
const dica = () => EL['db-status'].title;

// ══════════ 1. CONSULTA QUE FUNCIONA ACENDE O SELO ══════════
(async () => {
  EL['db-status-text'].textContent = 'Conectando...';
  RESPOSTA = resp(200, [{ id: 1 }]);
  const r1 = await sbGet('cotacoes');
  ok('1. *** consulta que funciona deixa o selo "Supabase Online" ***', selo() === 'Supabase Online', selo());
  ok('2. ...e devolve os dados', Array.isArray(r1) && r1.length === 1);
  ok('3. o ponto fica verde (classe online)', /online/.test(EL['db-dot'].className), EL['db-dot'].className);
  ok('4. a dica diz que a ultima consulta funcionou, com a hora', /Última consulta ao banco funcionou às \d/.test(dica()), dica());

  // ══════════ 2. O DEFEITO CENTRAL: ERRO NAO PODE VIRAR LISTA VAZIA ══════════
  RESPOSTA = resp(401, { code: '42501', message: 'permission denied for table cotacoes' });
  let estourou = false, vazio = null;
  try { vazio = await sbGet('cotacoes'); } catch (e) { estourou = true; }
  ok('5. *** 401 ESTOURA em vez de devolver [] (era o que escondia a falha) ***', estourou === true, { vazio });
  ok('6. *** e o selo cai pra "Sem conexão" NA HORA, sem esperar recarregar a pagina ***',
    selo() === 'Sem conexão', selo());
  ok('7. *** com o MOTIVO em linguagem de gente, nao "42501" ***',
    /sua sessão expirou ou não tem permissão/.test(dica()), dica());
  ok('8. ...e a dica ainda lembra a hora da ultima que funcionou',
    /A última que funcionou foi às \d/.test(dica()), dica());

  // ══════════ 3. A PROXIMA CONSULTA BOA CONSERTA O SELO ══════════
  // Este e o caso do print: o dashboard carregou, entao o selo TEM que voltar a verde sozinho.
  RESPOSTA = resp(200, [{ id: 2 }]);
  await sbGet('fornecedores');
  ok('9. *** consulta boa DEPOIS de uma falha reacende o selo (era isto que nao acontecia) ***',
    selo() === 'Supabase Online', selo());
  ok('10. ...e o ponto volta a verde', /online/.test(EL['db-dot'].className));

  // ══════════ 4. CADA TIPO DE FALHA TEM SUA FRASE ══════════
  const casos = [
    [404, {}, /tabela não encontrada/],
    [500, {}, /o servidor do banco respondeu 500/],
    [403, {}, /não tem permissão/],
    [400, { message: 'coluna inexistente' }, /coluna inexistente/],
  ];
  let i = 11;
  for (const [status, corpo, re] of casos) {
    RESPOSTA = resp(status, corpo);
    try { await sbGet('x'); } catch (e) {}
    ok(i + '. HTTP ' + status + ' explica o que houve', re.test(dica()), dica());
    i++;
  }

  // ══════════ 5. REDE FORA (o fetch nem responde) ══════════
  RESPOSTA = () => { throw new Error('Failed to fetch'); };
  let estourou2 = false;
  try { await sbGet('cotacoes'); } catch (e) { estourou2 = true; }
  ok('15. rede fora tambem estoura', estourou2 === true);
  ok('16. *** e o selo diz que nao falou com o servidor (nao inventa 401) ***',
    /não consegui falar com o servidor/.test(dica()), dica());

  // ══════════ 6. AS GARANTIAS DE CODIGO (o que nao pode voltar) ══════════
  ok('17. *** UM SO lugar escreve no selo: o funil. Nenhuma chamada solta de setDbStatus ***',
    (src.match(/^\s*setDbStatus\(/gm) || []).length === 0,
    (src.match(/^\s*setDbStatus\([^)]*\)/gm) || []));
  ok('18. o `iniciar()` nao acende mais o selo por conta propria',
    /SEM `setDbStatus\(\)` À MÃO AQUI/.test(src));
  ok('19. *** as ESCRITAS tambem marcam o selo (gravar e consulta real) ***',
    (src.match(/_marcaDb\(false, motivo\)/g) || []).length >= 4, (src.match(/_marcaDb\(false, motivo\)/g) || []).length);
  ok('20. sbPost/sbPatch/sbDelete marcam sucesso tambem',
    (src.match(/_marcaDb\(true\)/g) || []).length >= 4);
  ok('21. *** recarga que falha NAO esvazia a tela (mantem o ultimo dado bom) ***',
    /mantendo o último dado bom/.test(src));
  ok('22. ...e so estoura quando nao ha dado nenhum pra manter',
    /if \(Array\.isArray\(cotacoes\) && cotacoes\.length\)[\s\S]{0,140}throw e;/.test(src));

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  if (f) process.exit(1);
})();
