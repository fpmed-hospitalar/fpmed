// SUITE testa_vacina_cache — A ABA VELHA NAO PODE GRAVAR CALADA.
//
// O aviso "Nova versao disponivel" e PASSIVO de proposito: recarregar no meio de uma cotacao de
// 40 linhas perde o trabalho de quem esta digitando. So que passivo tem um custo — a aba fica
// aberta, o usuario ignora a faixa, e horas depois clica em GRAVAR, rodando codigo VELHO contra
// o banco ATUAL. A FPMED ja teve skew de cache uma vez (o `?v=cargos` do gm-auth).
//
// O CASO CARO NAO E A TELA FEIA, E A ESCRITA. Se o codigo velho tem um defeito ja corrigido --
// e em 05/08 saiu daqui uma funcao que gravava preco de CAIXA no campo do unitario -- a aba
// velha reintroduz o defeito NO DADO, e ninguem liga o problema ao cache.
//
//   node tests/testa_vacina_cache.js
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const pwa = fs.readFileSync(path.join(raiz, 'limedtec-pwa.js'), 'utf8');
const sf  = fs.readFileSync(path.join(raiz, 'fpmed_sistema_final.html'), 'utf8');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_vacina_cache — a aba velha x a escrita\n');

// ── carrega o modulo do PWA num DOM de mentira, controlando o estado do service worker ─────
function carrega(estado) {
  const win = {
    addEventListener: function () {},
    LIMEDTEC_PWA: undefined,
    confirm: function (msg) { win._perguntou = msg; return win._resposta; },
    _perguntou: null, _resposta: true,
    location: { protocol: 'https:', hostname: 'x.github.io', reload: function () {} },
    getComputedStyle: function () { return { getPropertyValue: function () { return ''; } }; },
    navigator: {
      serviceWorker: estado.semSW ? undefined : {
        controller: estado.controller ? {} : null,
        addEventListener: function () {},
        register: function () { return { then: function () { return { catch: function () {} }; } }; },
        getRegistration: function () { return Promise.resolve(estado.reg || null); },
      },
    },
    document: { documentElement: {}, createElement: function () { return { style: {}, appendChild: function(){} }; },
                body: { appendChild: function () {} }, addEventListener: function(){} },
  };
  win.window = win;
  new Function('window', 'document', 'navigator', 'getComputedStyle', 'location',
    pwa)(win, win.document, win.navigator, win.getComputedStyle, win.location);
  return win;
}

// o getRegistration resolve num microtask, entao os cenarios rodam dentro de um async
(async () => {
  // aba EM DIA — nao ha versao esperando
  {
    const w = carrega({ controller: true, reg: { waiting: null } });
    await Promise.resolve(); await Promise.resolve();
    ok('1. aba em dia nao e considerada desatualizada', w.LIMEDTEC_PWA.abaDesatualizada() === false, w.LIMEDTEC_PWA.abaDesatualizada());
    ok('2. *** e a gravacao segue SEM perguntar nada ***',
      w.LIMEDTEC_PWA.confirmarSeAbaVelha('a atualizacao do estoque') === true && w._perguntou === null, w._perguntou);
  }

  // aba VELHA — ha um service worker instalado esperando
  {
    const w = carrega({ controller: true, reg: { waiting: {} } });
    await Promise.resolve(); await Promise.resolve();
    ok('3. *** aba com versao nova esperando E desatualizada ***', w.LIMEDTEC_PWA.abaDesatualizada() === true);
    w._resposta = true;
    const seguiu = w.LIMEDTEC_PWA.confirmarSeAbaVelha('a atualizacao do estoque');
    ok('4. ...ela PERGUNTA antes de gravar', typeof w._perguntou === 'string' && w._perguntou.length > 0);
    ok('5. ...e a pergunta e ESPECIFICA da acao, nao um alerta generico',
      /a atualizacao do estoque/.test(w._perguntou), w._perguntou && w._perguntou.slice(0, 80));
    ok('6. ...avisa que pode gravar dado errado SEM DAR ERRO (que e o ponto)',
      /sem dar erro/i.test(w._perguntou));
    ok('7. ...e diz qual e a saida recomendada', /recarregar a pagina primeiro/i.test(w._perguntou));
    ok('8. *** NAO BLOQUEIA: com OK, a gravacao segue ***', seguiu === true);
  }
  {
    const w = carrega({ controller: true, reg: { waiting: {} } });
    await Promise.resolve(); await Promise.resolve();
    w._resposta = false;
    ok('9. e com Cancelar, a gravacao NAO acontece', w.LIMEDTEC_PWA.confirmarSeAbaVelha('x') === false);
  }

  // ══════════ 2. PRIMEIRA VISITA nao pode virar alarme ══════════
  // Sem controller e a primeira instalacao do service worker, nao uma aba velha. Se isto
  // disparasse, todo usuario novo levaria um susto no primeiro salvamento.
  {
    const w = carrega({ controller: false, reg: { waiting: {} } });
    await Promise.resolve(); await Promise.resolve();
    ok('10. *** primeira visita (sem controller) NAO e aba velha ***', w.LIMEDTEC_PWA.abaDesatualizada() === false);
  }

  // ══════════ 3. AUSENCIA DE SERVICE WORKER NAO PODE TRAVAR NADA ══════════
  // Em file:// ou http o SW nem registra. A guarda tem que cair pra "pode gravar".
  {
    const w = carrega({ semSW: true });
    await Promise.resolve(); await Promise.resolve();
    ok('11. sem service worker, nao e aba velha', w.LIMEDTEC_PWA.abaDesatualizada() === false);
    ok('12. ...e a gravacao passa direto', w.LIMEDTEC_PWA.confirmarSeAbaVelha('x') === true);
  }

  // ══════════ 4. A TELA ESTÁ USANDO A GUARDA ══════════
  ok('13. o sistema_final tem o helper com queda pra `true`', /function _podeGravar\(acao\)/.test(sf));
  ok('14. ...e a queda existe mesmo (sem LIMEDTEC_PWA a tela nao trava)',
    /!window\.LIMEDTEC_PWA \|\| !window\.LIMEDTEC_PWA\.confirmarSeAbaVelha/.test(sf));
  ok('15. *** a escrita EM MASSA do estoque passa pela guarda ***',
    /async function egExecutarReal\(\)[\s\S]{0,400}_podeGravar\('a atualização do estoque'\)/.test(sf));
  ok('16. ...e ela avisa o usuario o que fazer quando cancela', /recarregue a página \(F5\)/.test(sf));
  ok('17. o salvamento de cotacao tambem passa', /_podeGravar\('o salvamento desta cotação'\)/.test(sf));
  ok('18. o modulo exporta as duas funcoes', /LIMEDTEC_PWA\.abaDesatualizada = abaDesatualizada/.test(pwa)
    && /LIMEDTEC_PWA\.confirmarSeAbaVelha = confirmarSeAbaVelha/.test(pwa));
  // o molde nao pode ganhar marca de cliente por causa disto
  ok('19. a vacina nao introduziu marca de cliente no molde', !/FPMED|fpmed/.test(pwa));

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})();
