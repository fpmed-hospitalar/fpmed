// SUITE testa_backup_cobertura — BACKUP QUE DA CERTO PELA METADE E PIOR QUE BACKUP QUE FALHA.
//
// 06/08/2026. Nasceu de um defeito REAL encontrado neste dia: a tarefa agendada
// LIMEDTEC-backup-002 rodava, gravava "saida=0" no log e aparecia VERDE — salvando
// 11 das 22 tabelas. As 11 de fora eram justamente as construidas de 04/08 em diante
// (licitacoes, negocios, cmed_precos, cmed_pf, perfis, jornais, empresas,
// pack_confirmado, contatos_industria, licitacoes_acompanhadas, coleta_status):
// 56.586 das 71.703 linhas do banco estavam sem copia nenhuma.
//
// A CAUSA era uma lista de nomes escrita a mao, copiada do db_schema.sql de 22/07. Ela
// envelhece toda vez que alguem cria uma tabela e nao lembra de vir aqui — e ninguem lembra.
//
// >>> POR QUE ISTO E O PIOR MODO DE FALHA POSSIVEL: backup que estoura, alguem conserta no
//     mesmo dia. Backup que termina bem com metade do banco de fora so aparece no dia da
//     RESTAURACAO, que e o pior dia possivel pra descobrir.
//
// Esta suite trava as tres coisas que impedem a volta do defeito:
//   1. a lista de tabelas e DESCOBERTA no banco, nao escrita aqui;
//   2. tabela que falha faz o processo sair com codigo != 0 (a tarefa agendada fica VERMELHA);
//   3. views ficam de fora com motivo declarado (guardar uma view e guardar o mesmo dado 2x).
//
//   node tests/testa_backup_cobertura.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(raiz, '.claude', 'hooks', 'backup_tabelas.js'), 'utf8').replace(/\r\n/g, '\n');
// o codigo SEM comentario: um comentario que fala de descoberta nao descobre nada
const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_backup_cobertura — o backup nao pode ficar para tras do banco\n');

// ══════════ 1. A LISTA E DESCOBERTA, NAO DECORADA ══════════
ok('1. *** existe uma funcao que DESCOBRE as tabelas no proprio banco ***',
  /async function descobre\s*\(/.test(codigo));
ok('2. ...e ela le o indice do PostgREST (a raiz /rest/v1/)',
  /fetch\(`\$\{SB\}\/rest\/v1\/`/.test(codigo));
ok('3. ...separando tabela-base (aceita POST) de view (so GET)',
  /spec\.paths\[p\]\.post/.test(codigo));
// A CATRACA: nenhuma lista de nomes de tabela cravada no arquivo. Se alguem "consertar" um dia
// voltando a escrever ['cotacoes','clientes',...], este assert acusa.
const TABELAS_CONHECIDAS = ['cotacoes', 'clientes', 'fornecedores', 'orcamentos', 'compras',
  'itens_a_cotar', 'notas', 'pedidos_compra', 'cmed_dicionario', 'licitacoes', 'negocios',
  'cmed_precos', 'cmed_pf', 'perfis', 'jornais', 'empresas', 'pack_confirmado'];
const cravadas = TABELAS_CONHECIDAS.filter(t => new RegExp("['\"]" + t + "['\"]").test(codigo));
ok('4. *** NENHUM nome de tabela de dado cravado no codigo (era a causa do defeito) ***',
  cravadas.length === 0, cravadas);
ok('5. a unica excecao declarada e a view derivada, e ela tem nome proprio de excecao',
  /DERIVADAS = new Set\(\['cotacoes_vendedor'\]\)/.test(codigo));

// ══════════ 2. FALHA TEM QUE FALHAR ALTO ══════════
ok('6. *** tabela que nao salva faz o processo sair != 0 (a tarefa agendada fica VERMELHA) ***',
  /if \(falhas\.length\)[\s\S]{0,220}process\.exit\(2\)/.test(codigo));
ok('7. ...e o nome de cada tabela que faltou aparece na saida', /falhas\.join\(', '\)/.test(codigo));
ok('8. nao conseguir LISTAR as tabelas aborta — melhor nenhum backup que um backup cego',
  /catch\(e\)\{ console\.error\('ABORTANDO/.test(codigo));
ok('9. o resumo grava quantas foram descobertas x quantas salvas (da pra conferir depois)',
  /descobertas: achado\.tabelas\.length/.test(codigo) && /salvas: achado\.tabelas\.length - falhas\.length/.test(codigo));
ok('10. ...e registra o que ficou de fora, com nome (nada sai em silencio)',
  /views_fora: achado\.views/.test(codigo) && /derivadas_fora: achado\.derivadas/.test(codigo));

// ══════════ 3. SEGUE SENDO SO LEITURA ══════════
ok('11. *** nenhuma escrita no banco: so GET ***',
  !/method:\s*['"](POST|PATCH|DELETE|PUT)['"]/.test(codigo));
ok('12. a service_role continua vindo do segredos.local.txt, nunca do repo (que e publico)',
  /segredos\.local\.txt/.test(src) && !/eyJ[A-Za-z0-9._-]{60,}/.test(src));
ok('13. pagina em 1000 (o PostgREST daqui corta em 1000, nao 2000)', /limit=1000/.test(codigo));

// ══════════ 4. O ULTIMO BACKUP DE VERDADE, NO DISCO ══════════
// Nao e teste de codigo: e a pergunta que interessa — o backup mais recente cobre o banco?
const dirBk = path.join(raiz, 'backups');
const pastas = fs.existsSync(dirBk)
  ? fs.readdirSync(dirBk).filter(d => /^backup_\d{4}-\d{2}-\d{2}_\d{4}$/.test(d)).sort()
  : [];
if (!pastas.length) {
  ok('14. ha pelo menos um backup gravado em backups/', false, 'nenhuma pasta backup_*');
} else {
  const ultima = pastas[pastas.length - 1];
  const resumoPath = path.join(dirBk, ultima, '_resumo.json');
  ok('14. o backup mais recente (' + ultima + ') tem _resumo.json', fs.existsSync(resumoPath));
  if (fs.existsSync(resumoPath)) {
    const r = JSON.parse(fs.readFileSync(resumoPath, 'utf8'));
    ok('15. *** o resumo declara quantas tabelas foram descobertas ***', typeof r.descobertas === 'number', r.descobertas);
    ok('16. *** e SALVOU todas as que descobriu ***', r.salvas === r.descobertas, { salvas: r.salvas, descobertas: r.descobertas });
    ok('17. sem falhas registradas', Array.isArray(r.falhas) && r.falhas.length === 0, r.falhas);
    // as 11 que estavam de fora ate hoje: se alguma sumir do backup de novo, esta linha acusa
    const NOVAS = ['licitacoes', 'negocios', 'cmed_precos', 'cmed_pf', 'perfis', 'jornais',
                   'empresas', 'pack_confirmado', 'contatos_industria', 'licitacoes_acompanhadas',
                   'coleta_status'];
    const faltando = NOVAS.filter(t => !(t in (r.tabelas || {})));
    ok('18. *** as 11 tabelas construidas de 04/08 em diante estao no backup ***',
      faltando.length === 0, faltando);
  }
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
