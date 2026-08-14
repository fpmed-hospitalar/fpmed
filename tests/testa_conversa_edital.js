// SUITE testa_conversa_edital — conversar com o edital de dentro da ficha (fatia B6).
// Uso: node tests/testa_conversa_edital.js
//
// ══ O QUE ESTA SUITE GUARDA ════════════════════════════════════════════════════════════════
// 1. OS QUATRO ESTADOS SEPARADOS. "Ainda nao coletei" e "o PNCP nao publicou edital" tem a
//    MESMA cara se a tela so perguntar "tem texto?" — e as acoes sao OPOSTAS: numa vale esperar
//    a coleta, na outra vale anexar a mao, porque insistir nao traz o que nao existe. E a licao
//    que o arquiteto escreveu na fatia A6, e ela vale inteira deste lado.
// 2. O REGIME DE CUSTO INTACTO. O contrato do A e literal: *nao escreva uma segunda checagem de
//    permissao nem uma segunda conta de custo do seu lado*. Duas respostas para "quem pode
//    gastar?" e "quanto custou?" um dia discordam — num numero que vira fatura.
// 3. AS TRES TRADUCOES DE ERRO. "Nao esta liberado para o seu usuario" NUNCA pode virar "deu
//    erro": o primeiro e uma resposta do produto, o segundo faz a pessoa reportar defeito e
//    alguem procurar bug que nao existe.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const raiz = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(raiz, 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');
const ENC = fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');
const MOTOR = fs.readFileSync(path.join(raiz, 'fpmed_leitor_motor.js'), 'utf8').replace(/\r\n/g, '\n');

function bloco(ini, fim) {
  const s = src.indexOf(ini); const e = src.indexOf(fim, s);
  if (s < 0 || e < 0) throw new Error('ancora: ' + ini);
  return src.slice(s, e);
}

// ── uma tela de mentira, so com o que este bloco toca ──
const elementos = {};
const novoEl = () => ({ innerHTML: '', textContent: '', value: '', disabled: false,
  style: {}, className: '', appendChild(){}, });
const doc = { getElementById: k => (elementos[k] = elementos[k] || novoEl()),
              createElement: () => novoEl() };
let RESPOSTA_FETCH = [];
let STATUS_FETCH = 200;
const base = {
  esc: s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  SB_URL: 'https://exemplo.supabase.co', SB_H: {},
  NEG: [], ABERTO: 5, ANEXOS_EDITAL: [],
  document: doc, window: {},
  podeLerEdital: () => true,
  custoDaLeitura: j => '<div class="salvo">custo desta leitura: <b>R$ ' + Number(j.brl).toFixed(2) + '</b></div>',
  pdfParaTextoNeg: async () => 'texto do pdf anexado',
  fetch: async () => ({ ok: STATUS_FETCH < 400, status: STATUS_FETCH, json: async () => RESPOSTA_FETCH }),
};
const sandbox = vm.createContext(new Proxy(base, {
  has: () => true,
  get(t, k) {
    if (typeof k === 'symbol') return undefined;
    if (k in t) return t[k];
    if (Object.prototype.hasOwnProperty.call(globalThis, k)) return globalThis[k];
    throw new ReferenceError(k + ' — nome usado na conversa que nao existe no escopo dela');
  },
  set(t, k, v) { t[k] = v; return true; },
}));
const corpo = bloco('let EDITAL_CONVERSA = null;', 'async function anexarEdital(');
const API = vm.runInContext('(function(){' + corpo
  + '\nreturn { carregarConversaEdital, pintaConversaEdital, conversaCaixa, perguntarAoEdital,'
  + '  estado: () => EDITAL_CONVERSA, poe: v => { EDITAL_CONVERSA = v; } };})()', sandbox);

let p = 0, f = 0;
const ok = (n, c, got) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (got !== undefined ? ' [' + JSON.stringify(got) + ']' : '')); } };
console.log('SUITE testa_conversa_edital — conversar com o edital sem sair da ficha\n');

const NEGOCIO = (ctrl) => { base.NEG = [{ id: 5, numero_controle: ctrl, orgao: 'PREFEITURA' }]; };

// ══════════════════════════════════════════════════════════════════════════════════════════
// 1. OS CINCO ESTADOS — e por que eles precisam ser cinco
// ══════════════════════════════════════════════════════════════════════════════════════════
(async () => {
NEGOCIO('03659166002156-1-000034/2026');

// *** PEGA O MAIOR TEXTO, E NAO O PRIMEIRO ***
// Medido pelo arquiteto num caso real: o edital deu 71.105 caracteres e o termo de referencia
// deu 173.557 — e e no TR que costuma estar a tabela de itens, que e sobre o que se pergunta.
// "O primeiro que tiver texto" entregaria o menor por acaso de ordenacao.
RESPOSTA_FETCH = [
  { titulo: 'Edital', tipo: 'Edital', texto_extraido: 'e', texto_chars: 71105, texto_paginas: 38, extracao_erro: null },
  { titulo: 'Termo de Referência', tipo: 'Anexo', texto_extraido: 't', texto_chars: 173557, texto_paginas: 96, extracao_erro: null },
];
await API.carregarConversaEdital(5);
let c = API.estado();
ok('1. com texto no banco, da pra conversar', c.estado === 'pronto', c.estado);
ok('2. *** e o texto escolhido e o MAIOR, nao o primeiro da lista ***',
  c.titulo === 'Termo de Referência' && c.chars === 173557, { titulo: c.titulo, chars: c.chars });
ok('3. a tela sabe quantos outros arquivos existem do mesmo certame', c.outros === 1, c.outros);

RESPOSTA_FETCH = [];
await API.carregarConversaEdital(5);
ok('4. *** sem linha nenhuma = "ainda nao coletei", e nao "nao existe" ***',
  API.estado().estado === 'nao_coletado', API.estado());

RESPOSTA_FETCH = [{ titulo: null, texto_extraido: null, texto_chars: 0,
  extracao_erro: 'o PNCP não publicou arquivo para esta licitação' }];
await API.carregarConversaEdital(5);
ok('5. *** "o PNCP nao publicou" e um estado PROPRIO — nao adianta esperar ***',
  API.estado().estado === 'sem_arquivo', API.estado());

RESPOSTA_FETCH = [{ titulo: 'Edital', texto_extraido: null, texto_chars: 0,
  extracao_erro: 'PDF escaneado (sem camada de texto)' }];
await API.carregarConversaEdital(5);
ok('6. arquivo existe mas sem texto extraido e um terceiro estado',
  API.estado().estado === 'sem_texto' && /escaneado/.test(API.estado().motivo || ''), API.estado());

NEGOCIO(null);
await API.carregarConversaEdital(5);
ok('7. negocio sem numero de controle (os do Calendario 2025) tem estado proprio',
  API.estado().estado === 'sem_controle');

// *** ERRO DE REDE NAO VIRA "NAO TEM EDITAL" ***: a acao de quem nao tem e anexar, e mandar
// anexar o que ja esta la e fazer a pessoa trabalhar por causa de uma falha de rede.
NEGOCIO('03659166002156-1-000034/2026');
STATUS_FETCH = 500;
await API.carregarConversaEdital(5);
ok('8. *** falha de leitura vira ERRO, e nao "nao tem edital" ***',
  API.estado().estado === 'erro', API.estado());
STATUS_FETCH = 200;

// ══════════════════════════════════════════════════════════════════════════════════════════
// 2. O QUE CADA ESTADO DIZ NA TELA — as acoes sao diferentes, e os textos tambem
// ══════════════════════════════════════════════════════════════════════════════════════════
const pinta = est => { API.poe(est); API.pintaConversaEdital(5); return elementos['cv-cx'].innerHTML; };
ok('9. "ainda nao coletei" explica que a coleta passa pelos MEUS NEGOCIOS',
  /meus negócios/.test(pinta({ estado: 'nao_coletado' })));
ok('10. ...e oferece o caminho imediato: anexar o edital',
  /Anexe o edital/.test(pinta({ estado: 'nao_coletado' })));
ok('11. *** "o PNCP nao publicou" DIZ que nao adianta esperar ***',
  /não adianta esperar/.test(pinta({ estado: 'sem_arquivo' })));
ok('12. "sem texto" explica o motivo mais comum (PDF escaneado)',
  /escaneado/.test(pinta({ estado: 'sem_texto' })));
ok('13. "sem controle" diz que o negocio nao veio do PNCP',
  /não veio do PNCP/.test(pinta({ estado: 'sem_controle' })));
ok('14. *** o erro diz que NAO quer dizer que o edital nao exista ***',
  /não<\/b> quer dizer que ele não exista/.test(pinta({ estado: 'erro', motivo: 'HTTP 500' })));

// O ANEXO E A SEGUNDA FONTE: 105 negocios do funil vieram do Calendario e nenhum tem numero
// de controle. Sem ele, esta secao seria inutil justamente pra maioria.
base.ANEXOS_EDITAL = [];
ok('15. sem anexo, nao aparece o botao de usar o anexo',
  !/usar o edital anexado/.test(pinta({ estado: 'sem_controle' })));
base.ANEXOS_EDITAL = [{ categoria: 'edital', arquivo_path: 'p', arquivo_nome: 'edital.pdf', versao: 1 }];
ok('16. *** com edital anexado, da pra conversar com ELE mesmo sem PNCP ***',
  /usar o edital anexado/.test(pinta({ estado: 'sem_controle' })));

const pronto = pinta({ estado: 'pronto', de: 'pncp', texto: 'x', titulo: 'Termo de Referência',
  chars: 173557, paginas: 96, outros: 3 });
ok('17. o estado pronto mostra DE ONDE veio a resposta e o tamanho do texto',
  /Termo de Referência/.test(pronto) && /173\.557/.test(pronto) && /96 páginas/.test(pronto));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 3. O REGIME DE CUSTO E PERMISSAO — o que esta tela NAO faz
// ══════════════════════════════════════════════════════════════════════════════════════════
base.podeLerEdital = () => false;
const semPermissao = API.conversaCaixa(5);
ok('18. quem nao esta no piloto nao recebe o campo de pergunta',
  !/id="cv-p"/.test(semPermissao));
// *** E ESCONDER O CAMPO NAO E A PERMISSAO ***: quem barra e a edge function, com 403 conferido
// contra o JWT. A tela DIZ isso, em vez de deixar parecer que ela decide.
ok('19. *** ...e a tela diz que quem decide e o SERVIDOR, nao ela ***',
  /Quem decide é o servidor, não esta tela/.test(semPermissao));
base.podeLerEdital = () => true;
const comPermissao = API.conversaCaixa(5);
ok('20. *** o aviso de custo vai junto do botao que gasta ***',
  /leitura paga/.test(comPermissao) && /usos_ia/.test(comPermissao));
ok('21. ...e o selo "IA · tem custo" fica no titulo da secao, antes do campo',
  /Conversar com o edital <span class="selo-ia">IA · tem custo<\/span>/.test(src));

// *** NENHUMA SEGUNDA CONTA DE CUSTO E NENHUMA SEGUNDA LISTA DE PERMISSAO ***
const BLOCO = corpo;
ok('22. *** o bloco da conversa nao chama a edge function direto — so o motor ***',
  !/functions\/v1\/ler-edital/.test(BLOCO) && /LeitorEdital/.test(BLOCO));
ok('23. *** e nao grava em usos_ia por conta propria ***', !/usos_ia\b/.test(BLOCO.replace(/usos_ia<\/b>/g, '')));
ok('24. a permissao da tela e a MESMA funcao ja usada pelo botao do rodape',
  /podeLerEdital\(\)/.test(BLOCO) && /const LEITORES_EDITAL = /.test(src));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 4. AS TRES TRADUCOES DE ERRO DO CONTRATO
// ══════════════════════════════════════════════════════════════════════════════════════════
API.poe({ estado: 'pronto', de: 'pncp', texto: 'texto do edital', titulo: 'Edital', chars: 10 });
const perguntaCom = async marca => {
  base.window.LeitorEdital = { perguntar: async () => { const e = new Error('x'); if (marca) e[marca] = true; throw e; } };
  elementos['cv-p'] = elementos['cv-p'] || novoEl();
  elementos['cv-p'].value = 'exige registro na ANVISA?';
  await API.perguntarAoEdital(5);
  return elementos['cv-resposta'].innerHTML;
};
const r403 = await perguntaCom('semPermissao');
ok('25. *** 403 vira "nao esta liberado para o seu usuario", NUNCA "deu erro" ***',
  /não está liberada para o seu usuário/.test(r403) && !/deu erro/.test(r403), r403);
ok('26. ...e a tela diz que isso nao e falha', /Não é falha/.test(r403));
const rSessao = await perguntaCom('semSessao');
ok('27. sessao expirada manda entrar de novo — e avisa que nada foi cobrado',
  /<b>sessão expirou<\/b>/.test(rSessao) && /nada foi cobrado/i.test(rSessao), rSessao);
const rTexto = await perguntaCom('semTexto');
ok('28. sem texto tambem avisa que nada foi cobrado', /nada foi cobrado/i.test(rTexto), rTexto);

// A RESPOSTA BOA: corpo + custo + a ressalva de conferir contra o documento.
let enviado = null;
base.window.LeitorEdital = { perguntar: async o => { enviado = o;
  return { dados: { resposta: 'Sim, o item 7.3 exige registro na ANVISA.' }, brl: 0.31, leituraId: 41 }; } };
elementos['cv-p'].value = 'exige registro na ANVISA?';
await API.perguntarAoEdital(5);
const boa = elementos['cv-resposta'].innerHTML;
ok('29. a pergunta vai junto do texto do edital, e nao sozinha',
  enviado && enviado.texto === 'texto do edital' && enviado.pergunta === 'exige registro na ANVISA?', enviado);
ok('30. a resposta aparece na tela', /exige registro na ANVISA/.test(boa));
ok('31. *** o custo da leitura aparece com ela ***', /custo desta leitura/.test(boa));
// *** A RESSALVA NAO E FORMALIDADE ***: a resposta e de uma IA lendo um PDF, e quem decide preco
// e prazo com base nela precisa saber que ha um documento por tras para conferir.
ok('32. *** e a tela manda conferir contra o documento antes de decidir preco ou prazo ***',
  /confira contra o documento antes de decidir preço ou prazo/.test(boa));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 5. A LIGACAO COM O MOTOR — o defeito que quase deixou tudo isso morto
// ══════════════════════════════════════════════════════════════════════════════════════════
ok('33. *** a tela CARREGA a porta interna do leitor ***',
  /<script src="fpmed_leitor_motor\.js"><\/script>/.test(src));
ok('34. ...e ela ja estava na casca do service worker',
  /'\.\/fpmed_leitor_motor\.js'/.test(fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8')));
// *** O DEFEITO MEDIDO EM 14/08 ***: `urlDaEdge()` procura o endereco em
// LIMEDTEC_CLIENTE.supabase.url || glob.SB_URL || gmAuth.SB — e os TRES eram indefinidos aqui,
// porque `const SB_URL` fica no escopo lexico e nao vira propriedade de window. A conversa
// morreria em "nao sei o endereco do servico de leitura".
ok('35. *** o motor procura o endereco em `glob.SB_URL` ***',
  /glob\.SB_URL/.test(MOTOR));
ok('36. *** e esta tela expoe `SB_URL` no window, senao o motor nao acha o endereco ***',
  /window\.SB_URL = SB_URL;/.test(src));
ok('37. o motor continua sem segunda checagem de permissao (o 403 vem do servidor)',
  /r\.status === 403/.test(MOTOR) && !/LEITORES/.test(MOTOR));

// ══════════════════════════════════════════════════════════════════════════════════════════
// 6. A MESMA REGRA NAS DUAS TELAS
// A regra do "maior texto" esta escrita duas vezes porque sao dois HTML sem modulo comum. Se uma
// mudar sozinha, esta linha fica vermelha antes de as duas telas comecarem a responder coisas
// diferentes sobre o mesmo edital.
// ══════════════════════════════════════════════════════════════════════════════════════════
ok('38. *** a tela Encontrar tambem ordena por texto_chars decrescente ***',
  /sort\(\(a,b\) => \(b\.texto_chars\|\|0\) - \(a\.texto_chars\|\|0\)\)/.test(ENC.replace(/\s+/g, ' ').replace(/ \|\| /g, '||')),
  (ENC.match(/sort\(\(a,b\) => \(b\.texto_chars[^\n]*/) || [''])[0]);
ok('39. ...e o Negocios ordena pela mesma chave',
  /sort\(\(a,b\) => \(b\.texto_chars \|\| 0\) - \(a\.texto_chars \|\| 0\)\)/.test(src));
ok('40. as duas reconhecem o mesmo marcador de "o PNCP nao publicou arquivo"',
  /não publicou arquivo/.test(ENC) && /não publicou arquivo/.test(src));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
})();
