// SUITE testa_voltar_historico — VOLTAR PELO HISTORICO NAO PODE DEVOLVER A TELA CONGELADA.
//
// 07/08/2026. Bloqueador nº1 da entrega, reproduzido pelo Lemuel TRES vezes em ~15 minutos de
// uso normal, nos DOIS ambientes (app instalado e navegador):
//   Dashboard carrega normal -> entra em Licitacoes -> aperta VOLTAR -> o Dashboard volta
//   TRAVADO: cartoes em "Carregando...", "Carregando do Supabase..." eterno, e o toast vermelho
//   "Verifique se as tabelas foram criadas no Supabase" -- com o banco intacto e as 22 tabelas
//   no lugar.
//
// ERAM TRES COISAS, todas do mesmo engano: tratar o boot como se acontecesse UMA VEZ.
//   1. `iniciar()` roda uma vez, inline, no fim do script. Voltando pelo historico o navegador
//      restaura a pagina do BFCACHE: nenhum script roda de novo. A tela volta exatamente no
//      estado em que saiu -- e ela saiu no meio da carga.
//   2. A guarda de 25s era armada UMA VEZ, na analise do script. Sair aos 3s e voltar aos 40s
//      fazia o timer VELHO carimbar "A carga demorou demais" numa tela que nunca teve chance.
//      O relogio contava enquanto a pessoa estava em outra pagina.
//   3. Sair da pagina ABORTA as consultas em voo, e o catch acusava o banco de nao ter as
//      tabelas. Aborto de navegacao nao e tabela inexistente -- mesma familia da licao
//      "rede != sessao morta" do gm-auth (06/08): um erro generico virando a acusacao errada.
//
// >>> A MENSAGEM ERRADA NAO E SO RUIDO. "Verifique se as tabelas foram criadas" manda a pessoa
//     procurar no lugar errado e, no dia da entrega, diz ao cliente que o sistema nao foi
//     instalado direito. Ela agora exige o banco RESPONDER isso (42P01 / 404).
//
//   node tests/testa_voltar_historico.js
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8').replace(/\r\n/g, '\n');

function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora: ' + ini);
  return src.slice(s, e);
}

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_voltar_historico — a volta tem que recarregar, nao congelar\n');

// ── as funcoes REAIS, fora do navegador ──
const EVENTOS = {};
const EL = {};
function elem(id) {
  if (!EL[id]) EL[id] = { id, innerHTML: '', get textContent(){ return String(this.innerHTML).replace(/<[^>]*>/g,''); } };
  return EL[id];
}
elem('tabela-recentes'); elem('cot-lista');
const doc = {
  getElementById: id => EL[id] || null,
  querySelectorAll: sel => sel.split(',').map(s => EL[s.trim().replace('#','')]).filter(Boolean),
};
const win = { addEventListener: (ev, fn) => { (EVENTOS[ev] = EVENTOS[ev] || []).push(fn); } };
let AGENDADOS = [];
const setT = (fn, ms) => { const h = { fn, ms, vivo: true }; AGENDADOS.push(h); return h; };
const clearT = h => { if (h) h.vivo = false; };
let INICIOU = 0;

const ctx = (new Function('document', 'window', 'setTimeout', 'clearTimeout', 'iniciar', 'toast', 'console',
  "let _cotTs = 1; function _falhaCarga(msg){ ['tabela-recentes','cot-lista'].forEach(id=>{ const e=document.getElementById(id); if(e && /Carregando/i.test(e.textContent)) e.innerHTML='<b>'+msg+'</b>'; }); }\n" +
  bloco('const _PLACEHOLDER_CARGA', '// Recarrega cotações do banco') +
  bloco('function _mensagemDeFalha(e)', 'let _tentouDeNovo') +
  'return { _telaPresa, _armaGuardaCarga, _cancelaGuardaCarga, _ehAbortoDeSaida, _zeraEstadoCarga,' +
  '         _recarregarTudo, _mensagemDeFalha, _falhaCarga, getCotTs: () => _cotTs, setSaindo: v => { _saindoDaPagina = v; } };'
))(doc, win, setT, clearT, async () => { INICIOU++; }, () => {}, { error(){}, warn(){} });

const { _telaPresa, _armaGuardaCarga, _cancelaGuardaCarga, _ehAbortoDeSaida,
        _zeraEstadoCarga, _recarregarTudo, _mensagemDeFalha, _falhaCarga } = ctx;

const disparar = (ev, arg) => (EVENTOS[ev] || []).forEach(fn => fn(arg));
const carregando = () => { EL['tabela-recentes'].innerHTML = 'Carregando do Supabase...'; EL['cot-lista'].innerHTML = 'Carregando...'; };
const carregado  = () => { EL['tabela-recentes'].innerHTML = '<table>dados</table>'; EL['cot-lista'].innerHTML = '<table>dados</table>'; };

// ══════════ 1. OS PASSOS EXATOS DO LEMUEL ══════════
{
  carregado();
  INICIOU = 0;
  disparar('pagehide');                                   // entra em Licitacoes
  disparar('pageshow', { persisted: true });              // aperta VOLTAR (bfcache)
  ok('1. *** voltar pelo bfcache RECARREGA o dashboard (era isto que nao acontecia) ***',
    INICIOU === 1, INICIOU);
  ok('2. ...e a recarga invalida o cache de 60s (dado de agora, nao o de antes de sair)',
    ctx.getCotTs() === 0, ctx.getCotTs());
}
// duas idas e voltas seguidas, como ele pediu pra testar
{
  INICIOU = 0;
  for (let i = 0; i < 2; i++) { disparar('pagehide'); disparar('pageshow', { persisted: true }); }
  ok('3. *** duas idas e voltas recarregam as duas vezes ***', INICIOU === 2, INICIOU);
}
// volta SEM bfcache (o navegador reexecuta, mas a tela pode voltar presa)
{
  INICIOU = 0; carregando();
  disparar('pageshow', { persisted: false });
  ok('4. volta sem bfcache com a tela presa tambem recarrega', INICIOU === 1, INICIOU);
  INICIOU = 0; carregado();
  disparar('pageshow', { persisted: false });
  ok('5. ...e carga normal ja concluida NAO recarrega a toa', INICIOU === 0, INICIOU);
}

// ══════════ 2. A GUARDA DE 25s NAO PODE CONTAR ENQUANTO A PESSOA ESTA FORA ══════════
{
  AGENDADOS = []; carregando();
  _armaGuardaCarga();
  const t1 = AGENDADOS[AGENDADOS.length - 1];
  ok('6. a guarda e armada A CADA carga, com 25s', t1 && t1.ms === 25000);
  disparar('pagehide');                                   // saiu da pagina
  ok('7. *** sair da pagina DESARMA a guarda (o relogio velho carimbava a tela ao voltar) ***',
    t1.vivo === false);
  // e mesmo que o timer velho dispare, ele nao pinta nada enquanto estiver "fora"
  ctx.setSaindo(true); carregando();
  t1.fn();
  ok('8. ...e um timer velho que dispare fora da pagina nao pinta erro',
    /Carregando/i.test(EL['tabela-recentes'].textContent), EL['tabela-recentes'].textContent);
  ctx.setSaindo(false);
  // com a pessoa NA pagina e a tela presa, a guarda continua fazendo o trabalho dela
  AGENDADOS = []; carregando(); _armaGuardaCarga();
  AGENDADOS[AGENDADOS.length - 1].fn();
  ok('9. a guarda AINDA avisa quando a tela realmente travou com a pessoa olhando',
    /demorou demais/i.test(EL['tabela-recentes'].textContent), EL['tabela-recentes'].textContent);
}

// ══════════ 3. ABORTO DE NAVEGACAO NAO E FALHA DO BANCO ══════════
{
  ok('10. *** AbortError e reconhecido como saida, nao como erro ***',
    _ehAbortoDeSaida({ name: 'AbortError', message: 'The user aborted a request.' }) === true);
  ok('11. ...e "Failed to fetch" durante a saida tambem',
    (() => { ctx.setSaindo(true); const r = _ehAbortoDeSaida(new Error('Failed to fetch')); ctx.setSaindo(false); return r; })() === true);
  ok('12. mas um 401 de verdade NAO e confundido com saida',
    _ehAbortoDeSaida(new Error('sua sessão expirou ou não tem permissão (HTTP 401)')) === false);
}

// ══════════ 4. CADA CAUSA COM A SUA FRASE ══════════
{
  ok('13. *** "verifique as tabelas" SO quando o banco responde 42P01/404 ***',
    _mensagemDeFalha(new Error('relation "x" does not exist (42P01)')).tabela === true);
  ok('14. ...e 404 do PostgREST idem',
    _mensagemDeFalha(new Error('tabela não encontrada (HTTP 404)')).tabela === true);
  ok('15. *** timeout NAO acusa tabela inexistente ***',
    !_mensagemDeFalha(new Error('A carga demorou demais')).tabela);
  ok('16. *** aborto NAO acusa tabela inexistente ***',
    !_mensagemDeFalha(new Error('The user aborted a request')).tabela);
  ok('17. *** sessao expirada NAO acusa tabela inexistente, e manda entrar de novo ***',
    !_mensagemDeFalha(new Error('HTTP 401')).tabela &&
    /Entre novamente/.test(_mensagemDeFalha(new Error('HTTP 401')).txt));
  ok('18. falha desconhecida diz o que houve, sem inventar causa',
    /não consegui falar com o banco/i.test(_mensagemDeFalha(new Error('boom')).txt));
}

// ══════════ 5. ZERAR O ESTADO DE ERRO ══════════
{
  carregando(); _falhaCarga('A carga demorou demais (mais de 25s)');
  ok('19. o erro fica na tela enquanto ninguem faz nada', /demorou demais/i.test(EL['tabela-recentes'].textContent));
  _zeraEstadoCarga();
  ok('20. *** e some quando a tela recarrega (senao a volta traz o erro velho junto) ***',
    /Carregando do Supabase/i.test(EL['tabela-recentes'].textContent), EL['tabela-recentes'].textContent);
}

// ══════════ 6. AS GARANTIAS DE CODIGO ══════════
{
  ok('21. *** retry automatico UMA vez, nao em laco (laco esconde defeito e martela o banco) ***',
    /if \(!_tentouDeNovo\)[\s\S]{0,200}return iniciar\(\);/.test(src) && /_tentouDeNovo = true;/.test(src));
  ok('22. o boot arma a guarda e a desarma quando termina',
    /_armaGuardaCarga\(\);\s*\/\/ relógio novo/.test(src) && /_cancelaGuardaCarga\(\);\s*\/\/ carregou/.test(src));
  ok('23. *** usa pagehide/pageshow e NAO `unload` (unload desliga o bfcache de todo mundo) ***',
    /addEventListener\('pageshow'/.test(src) && /addEventListener\('pagehide'/.test(src) &&
    !/addEventListener\('unload'/.test(src));
  ok('24. o botao "Tentar de novo" recarrega os dados em vez de recarregar a pagina inteira',
    /onclick="_recarregarTudo\(\)"/.test(src) && !/onclick="location\.reload\(\)"/.test(src));
  ok('25. a carga de cotacoes nao pinta erro quando foi aborto de saida',
    /if \(!_ehAbortoDeSaida\(e\)\) _falhaCarga/.test(src));
}

// ══════════ 7. A CAUSA RAIZ: CORRIDA COM O gm-auth ══════════
// MEDIDO no ar em 07/08: `cotacoes` em memoria = 0 com a tela presa em "Carregando...",
// enquanto a MESMA consulta no console trazia as 8.832 linhas em 5s. Nao era rede, nao era o
// banco, nao era permissao -- era ORDEM. O `iniciar()` disparava antes do gm-auth trocar o
// window.fetch, entao as consultas do boot saiam como `anon`.
// >>> E e isto que explica ter PIORADO hoje: com o anon revogado, o que voltava `200 []`
//     (dashboard vazio, sem erro) passou a voltar 401. A revogacao nao criou o defeito --
//     ela tirou o SILENCIO de cima dele.
{
  ok('26. *** o sistema_final ESPERA o gm-auth antes de carregar dado (a raiz) ***',
    /if \(window\.gmAuth\) _bootUmaVez\(\);/.test(src) &&
    /addEventListener\('gm-auth-ready', _bootUmaVez, \{ once: true \}\)/.test(src));
  ok('27. ...e nao chama `iniciar()` solto no fim do script (era a linha do defeito)',
    !/^iniciar\(\);$/m.test(src));
  ok('28. *** com rede de seguranca: se o gm-auth nunca vier, tenta assim mesmo ***',
    /setTimeout\(_bootUmaVez, 12000\)/.test(src));
  ok('29. ...e o boot nao pode disparar duas vezes (evento + rede de seguranca)',
    /if \(_bootDisparado\) return; _bootDisparado = true;/.test(src));
  // as outras telas que leem o banco no boot tem que ter o mesmo guarda
  const raiz = path.join(__dirname, '..');
  for (const tela of ['fpmed_vendas.html', 'fpmed_painel.html', 'fpmed_giovana.html',
                      'fpmed_licitacoes.html', 'fpmed_negocios.html', 'fpmed_viabilidade.html']) {
    const c = fs.readFileSync(path.join(raiz, tela), 'utf8');
    ok('30.' + tela + ' espera o gm-auth antes de ler o banco', /gm-auth-ready/.test(c));
  }
}

// ══════════ 8. O CAMINHO DE ERRO TEM QUE VALER NO ESTADO MAIS CRU DA PAGINA ══════════
// REGRESSAO REAL de 07/08, vista pelo Lemuel no app: o dashboard mostrou
// "Nao consegui falar com o banco agora: cotacoes is not defined".
// `cotacoes`, `cotacoesCache` e `fornecedores` NUNCA foram declaradas -- nasciam como GLOBAL
// IMPLICITA na primeira atribuicao. Enquanto tudo dava certo ninguem via, porque a atribuicao
// vinha antes de qualquer leitura. O tratamento de falha novo le `cotacoes` no CATCH -- que
// roda justamente quando a carga NAO aconteceu -- e o ReferenceError SUBSTITUIU o erro de
// verdade: em vez de "sua sessao expirou", o operador leu "cotacoes is not defined".
//
// >>> A LICAO E SOBRE O CAMINHO DE ERRO: codigo que so roda quando algo da errado e o menos
//     exercitado do sistema. Foi o primeiro lugar onde uma global implicita de meses cobrou.
{
  for (const v of ['cotacoes', 'cotacoesCache', 'fornecedores']) {
    ok('35.`' + v + '` e DECLARADA antes de qualquer uso (nao e global implicita)',
      new RegExp('^var ' + v + ' = \\[\\];', 'm').test(src));
  }
  ok('36. *** e a declaracao vem ANTES do catch que le a variavel ***',
    src.indexOf('var cotacoes = [];') < src.indexOf('mantendo o último dado bom'),
    { decl: src.indexOf('var cotacoes = [];'), uso: src.indexOf('mantendo o último dado bom') });
  ok('37. ...e antes do proprio sbGet, que e quem estoura primeiro',
    src.indexOf('var cotacoes = [];') < src.indexOf('async function sbGet'));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
