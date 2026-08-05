// SUITE testa_empresa_cliente — A EMPRESA DO CLIENTE JA NASCE CADASTRADA.
//
// DECISAO DO LEMUEL (05/08): no SIGA o cliente cadastra a propria empresa numa tela. Aqui nao —
// ela ja vem preenchida. O cliente nao abre o sistema numa tela vazia pedindo "adicione sua
// empresa", porque esse dado veio no cadastro dele e quem instala ja tem como preencher.
// E o seletor "Todas as empresas" + o badge nos cards do funil FICAM VISIVEIS mesmo com uma
// empresa so (ele corrigiu minha recomendacao de esconder — vale a dele).
//
// A FONTE DA VERDADE E O cliente.config.js, nao o banco: e o unico arquivo que o cria_cliente
// escreve, entao instalacao nova nasce com a empresa certa sem ninguem lembrar de rodar nada.
// Esta suite guarda esse contrato — se o config perder o bloco `empresas`, o funil passa a
// mostrar card sem dono e ninguem descobre ate alguem olhar a tela.
//
//   node tests/testa_empresa_cliente.js
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const { cnpjValido, soDigitos } = require('../tools/semeia_empresa.js');

function carregaConfig() {
  const cfgSrc = fs.readFileSync(path.join(raiz, 'cliente.config.js'), 'utf8');
  const libSrc = fs.readFileSync(path.join(raiz, 'limedtec-config.js'), 'utf8');
  const win = {};
  new Function('window', 'document', 'module', cfgSrc + '\n' + libSrc)(win, undefined, undefined);
  return win.LIMEDTEC;
}

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_empresa_cliente — a empresa do cliente ja nasce cadastrada\n');

const L = carregaConfig();

// ══════════ 1. O CLIENTE NAO ABRE O SISTEMA SEM EMPRESA ══════════
{
  const l = L.empresas();
  ok('1. *** o cliente.config.js traz pelo menos uma empresa ***', l.length >= 1, l.length);
  ok('2. empresas() devolve LISTA (o molde pode ter cliente com 2 CNPJs)', Array.isArray(l));
  const pr = L.empresaPrincipal();
  ok('3. existe uma principal definida', !!pr, pr);
  ok('4. e a principal e a FPMED', /^FPMED DISTRIBUIDORA/.test(pr.razaoSocial), pr && pr.razaoSocial);
}

// ══════════ 2. O DADO TEM QUE SER O REAL, NAO UM PLACEHOLDER ══════════
// A pre-condicao de deploy do projeto proibe placeholder no ar. Empresa semeada com
// "[RAZAO SOCIAL]" seria pior que empresa nenhuma: apareceria no badge de todo card.
{
  const e = L.empresaPrincipal();
  ok('5. razao social sem placeholder', !/\[|PREENCHER|RAZAO SOCIAL\]/i.test(e.razaoSocial), e.razaoSocial);
  ok('6. *** o CNPJ e valido (digito verificador confere) ***', cnpjValido(e.cnpj), e.cnpj);
  ok('7. e e o CNPJ da FPMED que ja esta no cadastro/documentos', soDigitos(e.cnpj) === '47110418000115', e.cnpj);
  ok('8. tem UF (o card do funil mostra "orgao + UF" e a empresa filtra por estado)', !!e.uf, e.uf);
  ok('9. tem cidade', !!e.cidade, e.cidade);
}

// ══════════ 3. O CNPJ DO CONFIG BATE COM O DOS DOCUMENTOS ══════════
// Duplicacao conhecida e registrada: a razao social e o CNPJ TAMBEM estao escritos a mao no
// cabecalho do PDF de proposta e no sistema_final, desde o rebrand de 22/07. Enquanto as duas
// fontes existirem, elas NAO PODEM divergir — o dia em que divergirem, o documento que vai pro
// cliente diz uma coisa e o funil diz outra.
{
  const e = L.empresaPrincipal();
  const num = soDigitos(e.cnpj);
  const fmt = e.cnpj;
  ['fpmed_giovana.html', 'fpmed_sistema_final.html'].forEach((arq, i) => {
    const src = fs.readFileSync(path.join(raiz, arq), 'utf8');
    ok(`${10 + i}. o CNPJ do config bate com o impresso no ${arq}`,
      src.includes(fmt) || soDigitos(src).includes(num), arq);
  });
}

// ══════════ 4. VALIDACAO DE CNPJ — o guarda que impede identidade inventada ══════════
// CNPJ errado no badge do funil e o sistema afirmando uma identidade juridica que nao existe.
ok('12. CNPJ real da FPMED passa', cnpjValido('47.110.418/0001-15'));
ok('13. o mesmo sem pontuacao passa', cnpjValido('47110418000115'));
ok('14. digito verificador trocado NAO passa', !cnpjValido('47.110.418/0001-16'));
ok('15. 14 digitos iguais nao passa (11111111111111 tem DV valido por acaso)', !cnpjValido('11111111111111'));
ok('16. curto demais nao passa', !cnpjValido('4711041800011'));
ok('17. vazio nao passa', !cnpjValido(''));
ok('18. null nao quebra', !cnpjValido(null));
ok('19. texto nao passa', !cnpjValido('CNPJ DA EMPRESA'));

// ══════════ 5. UMA PRINCIPAL SO ══════════
// Duas principais deixariam o funil sem saber qual empresa mostrar no badge, e a escolha
// viraria "a que o banco devolver primeiro" — nao-determinismo em cima de identidade juridica.
{
  const l = L.empresas();
  ok('20. no maximo uma empresa marcada como principal', l.filter(e => e.principal).length <= 1,
    l.filter(e => e.principal).map(e => e.razaoSocial));
  ok('21. o DDL tambem trava isso no banco (indice unico parcial)',
    /unique index[^;]*empresas_uma_principal[^;]*where principal/is.test(fs.readFileSync(path.join(raiz, 'ddl', 'empresas.sql'), 'utf8')));
  ok('22. e a unicidade do CNPJ vale sobre o NUMERO, nao sobre a pontuacao',
    /cnpj_norm[^;]*generated always as[^;]*regexp_replace/is.test(fs.readFileSync(path.join(raiz, 'ddl', 'empresas.sql'), 'utf8')));
}

// ══════════ 6. DECISAO REGISTRADA: badge e seletor FICAM VISIVEIS ══════════
// Eu recomendei esconder os dois com uma empresa so; ele decidiu mostrar, igual ao SIGA.
// O teste guarda a DECISAO, nao a minha opiniao — pra que ninguem reabra isto por engano.
{
  const spec = fs.readFileSync(path.join(raiz, 'LICITACOES_SPEC.md'), 'utf8');
  ok('23. a decisao esta escrita no spec do item 9', /MOSTRAR, igual ao SIGA/i.test(spec));
  ok('24. ...e diz explicitamente "mesmo com uma empresa so"', /mesmo com uma empresa s[óo]/i.test(spec));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
