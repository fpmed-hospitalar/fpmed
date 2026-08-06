// SUITE testa_usuarios_acessos — A TELA QUE CRIA GENTE NAO PODE SER O BURACO POR ONDE ALGUEM
// ENTRA, E O PORTE DE UMA TELA DO MOLDE NAO PODE MUDAR O COMPORTAMENTO DAS QUE JA FUNCIONAM.
//
// Porte de 06/08/2026: limedtec-usuarios.html + limedtec-sessao.js, vindos do molde (so leitura
// da origem). Eram 2 dos 8 arquivos que o verificador do kit acusou como faltando de verdade.
//
// O QUE ESTA SUITE PROTEGE, e o motivo de cada coisa:
//   1. A TABELA `perfis` FECHADA. Ela estava LEGIVEL PELA INTERNET ate 06/08 (o ddl/03 do kit
//      cria a tabela e nao liga RLS nem revoga o anon). A tela de Usuarios grava nessa tabela:
//      portar a tela sem fechar a porta seria construir em cima do buraco.
//   2. NENHUM DADO DA GLOBALMED VEIO NO PORTE. Os dois arquivos sao MOLDE (nascem iguais em todo
//      cliente), mas "e molde" e uma afirmacao — aqui ela e verificada byte a byte.
//   3. A `limedtec-sessao.js` SO ENTRA NA TELA DE USUARIOS. Ela aplica um patch no window.fetch
//      que BLOQUEIA toda leitura /rest/v1/ enquanto o perfil nao estiver confirmado e troca
//      `cotacoes` por `cotacoes_vendedor`. Isso pertence a migracao restritiva (ddl/05), que esta
//      PARADA esperando OK. Solta-la nas 7 telas que funcionam hoje, de carona num porte de tela
//      nova, e exatamente o tipo de efeito colateral que este projeto nao aceita.
//   4. A TRAVA DO ULTIMO GESTOR. Se o unico gestor ativo se rebaixar ou se desativar, ninguem —
//      nem ele — desfaz pela tela: so com acesso direto ao banco. E o unico erro sem volta aqui.
//
//   node tests/testa_usuarios_acessos.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');

const tela = ler('limedtec-usuarios.html');
const sessao = ler('limedtec-sessao.js');
const config = ler('limedtec-config.js');
const sw = ler('sw.js');
const menu = ler('fpmed_sistema_final.html');
const ddlPerfis = ler('ddl/perfis_fecha_anon.sql').replace(/--[^\n]*/g, '');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_usuarios_acessos — porte da tela de Usuarios e o portao de perfil\n');

// ══════════ 1. NADA DA GLOBALMED ENTROU NO PORTE ══════════
{
  // >>> A CHECAGEM DO BANCO E POR COERENCIA INTERNA, e NAO citando o ref do projeto da origem.
  //     Escrever aquele identificador aqui publicaria o projeto Supabase de outra empresa num
  //     repositorio PUBLICO — foi exatamente o defeito que devolvi pro kit em 06/08, e o
  //     testa_compliance me pegou cometendo o mesmo. A pergunta certa nao e "e o ref deles?" e
  //     sim "e ALGUM ref cravado no arquivo?": o molde tem que pegar o banco do config, sempre.
  const PROIBIDO = [
    ['nome da GlobalMed', /globalmed/i],
    ['qualquer projeto Supabase cravado no arquivo', /https:\/\/[a-z0-9]+\.supabase\.co/i],
    ['telefone da origem', /99612-7968/],
    ['e-mail de pessoa hardcoded', /isadora|@globalmed/i],
    ['verde da marca da origem', /#00c27a/i],
  ];
  for (const [rotulo, re] of PROIBIDO) {
    ok('1.' + rotulo + ' fora da tela de Usuarios', !re.test(tela));
    ok('2.' + rotulo + ' fora do portao de sessao', !re.test(sessao));
  }
  // e o outro sentido: molde de verdade nao carrega o nome de cliente NENHUM
  ok('3. *** a tela e MOLDE: nao cita FPMED nem nenhum cliente (o que muda e o dado, no banco) ***',
    !/fpmed/i.test(tela.replace(/fpmed_giovana|fpmed_sistema/gi, '')), 'tela cita cliente');
  ok('4. o banco vem do config (é assim que a mesma tela serve qualquer cliente)',
    /LIMEDTEC\.urlBanco\(\)/.test(tela) && /LIMEDTEC\.urlBanco\(\)/.test(sessao));
}

// ══════════ 2. O PORTAO DE SESSAO SO ENTRA NESTA TELA ══════════
{
  ok('5. a tela de Usuarios carrega o portao', /<script src="limedtec-sessao\.js"/.test(tela));
  ok('6. ...declarando de que permissao ela precisa', /data-exige="gerir_usuarios"/.test(tela));
  const TELAS = ['fpmed_sistema_final.html', 'fpmed_giovana.html', 'fpmed_licitacoes.html',
                 'fpmed_negocios.html', 'fpmed_vendas.html', 'fpmed_viabilidade.html',
                 'fpmed_painel.html', 'index.html'];
  const invadidas = TELAS.filter(t => /limedtec-sessao\.js/.test(ler(t)));
  // >>> A GARANTIA MAIS IMPORTANTE DESTA SUITE. O patch do fetch da sessao devolve 403 pra toda
  //     leitura enquanto o perfil nao esta confirmado. Ligado nas telas que funcionam hoje, um
  //     `perfis` incompleto derrubaria o sistema inteiro de uma vez — e ninguem ligou isso de
  //     proposito: ele viria de carona num porte de tela nova.
  ok('7. *** o portao NAO entrou em nenhuma das 8 telas que ja funcionam ***',
    invadidas.length === 0, invadidas);
  ok('8. o patch do fetch existe mesmo (a garantia 7 nao e vazia)',
    /raiz\.fetch = async function/.test(sessao) && /status: 403/.test(sessao));
  ok('9. ...e ele so REESCREVE leitura, nunca desvia escrita pra uma view',
    /metodo === 'GET' \|\| metodo === 'HEAD'/.test(sessao));
  ok('10. sem papel confirmado = negado, nunca "acesso por omissao"',
    /if \(estado !== 'ok' \|\| !perfil\) return false;/.test(sessao));
  ok('11. le o PROPRIO perfil por id (gestor pegaria o de um colega em linhas\[0\])',
    /perfis\?select=papel,ativo,permissoes&id=eq\./.test(sessao));
}

// ══════════ 3. A TABELA `perfis` ESTA FECHADA ══════════
{
  ok('12. *** RLS ligada em perfis ***', /alter table public\.perfis enable row level security/.test(ddlPerfis));
  ok('13. *** e o anon revogado — a chave anon esta num repo PUBLICO ***',
    /revoke all on public\.perfis from anon/.test(ddlPerfis));
  ok('14. escrever em perfis exige gerir_usuarios', /perfis_gestor_escreve[\s\S]*limedtec_pode\('gerir_usuarios'/.test(ddlPerfis));
  ok('15. *** cada um le o PROPRIO perfil (senao o vendedor nao descobre o proprio papel) ***',
    /perfis_le_o_proprio[\s\S]*id = auth\.uid\(\)/.test(ddlPerfis));
  // os nomes tem que ser os MESMOS do ddl/05 do kit: quando ele rodar, tem que SUBSTITUIR estas
  // policies, e nao empilhar uma segunda regra com outro nome dizendo quase a mesma coisa.
  const kit = ler('kit_cliente/ddl/05_rls_e_policies.sql');
  for (const nome of ['perfis_gestor_escreve', 'perfis_gestor_le', 'perfis_le_o_proprio']) {
    ok('16.' + nome + ' usa o mesmo nome do ddl/05 do kit',
      ddlPerfis.includes(nome) && kit.includes(nome));
  }
}

// ══════════ 4. A TRAVA DO ULTIMO GESTOR ══════════
{
  ok('17. *** a tela barra a mudanca que deixaria o sistema sem gestor ativo ***',
    /gestoresAtivosDepois\(id, papel, ativo\) === 0/.test(tela));
  ok('18. ...contando o estado DEPOIS da mudanca, e nao o de agora',
    /const pa = \(p\.id === id\) \? papel : p\.papel;/.test(tela));
  ok('19. ...e explica o que fazer, em vez de so recusar', /Promova outra pessoa antes/.test(tela));
  ok('20. o banco tem a MESMA trava por trigger (a tela explica, o banco protege)',
    /perfis_exige_gestor/.test(ler('kit_cliente/ddl/03_perfis_e_papeis.sql')));
}

// ══════════ 5. O QUE A TELA SE RECUSA A FAZER ══════════
{
  ok('21. *** 200 com lista vazia e FALHA, nao sucesso (RLS barrando UPDATE devolve 200 e 0 linha) ***',
    /if\(!Array\.isArray\(d\) \|\| !d\.length\) throw new Error/.test(tela));
  ok('22. *** ninguem e APAGADO: quem sai e desativado (apagar mata a autoria de meses) ***',
    /Ninguém é apagado aqui/.test(tela) && !/method: 'DELETE'/.test(tela));
  // conferido no CODIGO sem comentario: os dois arquivos EXPLICAM por que nao usam a service_role,
  // e um teste que lesse o texto reprovaria justamente o arquivo que documenta a regra.
  const semComentario = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  ok('23. a service_role NAO vai pro navegador (ela ignora toda a RLS)',
    !/service_role/i.test(semComentario(tela)) && !/service_role/i.test(semComentario(sessao)));
  ok('24. chave de GESTOR nao aparece como caixinha ajustavel (seria promover por configuracao)',
    /PROIBIDAS = \{ gerir_usuarios:1, configurar:1, importar:1 \}/.test(tela));
  ok('25. a senha provisoria e sorteada com crypto, nao com Math.random',
    /crypto\.getRandomValues/.test(tela) && !/Math\.random/.test(tela));
}

// ══════════ 6. A TELA ESTA ALCANCAVEL, E COM O TEMA DO CLIENTE ══════════
{
  ok('26. *** tem link no menu (modulo pronto e invisivel ja aconteceu aqui com o Licitacoes) ***',
    /location\.href='limedtec-usuarios\.html'/.test(menu));
  ok('27. entrou no cache do app instalado', /'\.\/limedtec-usuarios\.html'/.test(sw));
  ok('28. ...com as duas dependencias que so ela usa',
    /'\.\/limedtec-sessao\.js'/.test(sw) && /'\.\/limedtec-papeis\.js'/.test(sw));
  // >>> NAO CRAVAR O NUMERO DA VERSAO AQUI. A primeira redacao deste assert exigia
  //     `limedtec-fpmed-2026-08-06-4` e ficou VERMELHA no dia seguinte, quando outra correcao
  //     subiu o sw pra -5 — reprovando uma mudanca CERTA. Teste que quebra com o trabalho
  //     normal treina todo mundo a ignorar o vermelho. O que importa e a REGRA: existe versao,
  //     e ela carrega a data (e por ela que se sabe se a casca no ar e a de hoje).
  ok('29. o service worker tem versao datada (senao o navegador serve a lista velha)',
    /const VERSAO = 'limedtec-fpmed-\d{4}-\d{2}-\d{2}-\d+'/.test(sw),
    (sw.match(/const VERSAO = '[^']+'/) || [])[0]);
  // a tela do molde pede as cores com prefixo (--lt-*); o config da FPMED so escrevia os nomes
  // crus. Sem isto a unica tela ESCURA do sistema seria a de Usuarios, por acidente.
  ok('30. *** o config passou a OFERECER as cores com prefixo, que e o que a tela do molde pede ***',
    /CORES_LT = \{ bg: '--lt-bg'/.test(config) && /var\(--lt-bg/.test(tela));
  ok('31. ...sem largar os nomes crus, que as 7 telas de hoje ainda usam',
    /CORES_CRUAS = \{ bg: '--bg'/.test(config));
  ok('32. *** e o data-tema continua cortando OS DOIS (a garantia do testa_tema_tela_propria) ***',
    /if \(el\.getAttribute\('data-tema'\)\) return;[\s\S]{0,200}CORES_LT/.test(config));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
