// SUITE testa_lembretes — INTENCAO QUE NAO FOI ESCRITA MORA NA CABECA DE QUEM PENSOU.
//
// Item 7 da fila / secao 8.2 do SPEC, 08/08/2026. Fecha a fila do 2o mergulho.
//
// >>> POR QUE LEMBRETE PRECISA DE TABELA e o resto do sino nao: tudo que o sino avisa hoje e
//     FATO — a sessao abre amanha, a certidao vence em 5 dias. Fato nao precisa ser guardado,
//     e lido de onde ja esta. Lembrete e o contrario: e uma INTENCAO ("ligar pro fornecedor
//     antes da sessao"), e intencao nao esta escrita em lugar nenhum. Sem tabela, ela mora na
//     cabeca de quem pensou — que e exatamente o problema que ela existe pra resolver.
//
// O QUE ESTA SUITE PROTEGE:
//   1. LEMBRETE E TAO PROTEGIDO QUANTO O NEGOCIO a que ele pertence. O titulo carrega a
//      estrategia ("ligar pro fornecedor X sobre o pregao Y") — deixa-lo mais aberto que a
//      tabela de cima vazaria pelo titulo o que a `negocios` protege.
//   2. FEITO != APAGADO. Lembrete cumprido e historico ("avisamos o fornecedor dia 10").
//   3. ERRO DE LEITURA NAO VIRA "nenhum lembrete agendado".
//   4. AS ABAS: cada uma e uma PERGUNTA diferente sobre o mesmo negocio, e o ESTAGIO fica fora
//      delas — ele e o estado do negocio, precisa estar visivel em qualquer aba.
//
//   node tests/testa_lembretes.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const tela = fs.readFileSync(path.join(raiz, 'fpmed_negocios.html'), 'utf8').replace(/\r\n/g, '\n');
const ddlRaw = fs.readFileSync(path.join(raiz, 'ddl', 'lembretes.sql'), 'utf8');
const ddl = ddlRaw.replace(/--[^\n]*/g, '');
const lic = fs.readFileSync(path.join(raiz, 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_lembretes — a intencao escrita, e o sino avisando por ela\n');

// ══════════ 1. O BANCO ══════════
ok('1. tabela criada com if not exists', /create table if not exists public\.lembretes/.test(ddl));
ok('2. preso ao negocio, e some com ele', /negocio_id\s+bigint not null references public\.negocios\(id\) on delete cascade/.test(ddl));
ok('3. *** prioridade com TRES niveis (cinco viram "todo mundo marca alta") ***',
  /check \(prioridade in \('alta','media','baixa'\)\)/.test(ddl));
ok('4. ...e a razao esta escrita', /viram "todo mundo marca alta"/.test(ddlRaw));
ok('5. *** `feito` e coluna, nao delete (cumprido vira historico) ***',
  /feito\s+boolean not null default false/.test(ddl) && /feito_em\s+timestamptz/.test(ddl));
ok('6. `quando` e obrigatorio (lembrete sem quando nao avisa nada)', /quando\s+timestamptz not null/.test(ddl));
ok('7. indice no caminho quente: aberto e vencendo', /lembretes_abertos_idx on public\.lembretes \(quando\) where not feito/.test(ddl));

// ══════════ 2. RLS — tao protegido quanto o negocio ══════════
ok('8. RLS ligada', /alter table public\.lembretes enable row level security/.test(ddl));
ok('9. *** LER exige cargo_gestor, igual a `negocios` ***', /lem_sel[\s\S]{0,110}cargo_gestor\(\)/.test(ddl));
ok('10. escrever tambem', /lem_ins[\s\S]{0,110}cargo_gestor\(\)/.test(ddl));
ok('11. anon revogado', /revoke all on public\.lembretes from anon/.test(ddl));
ok('12. *** e a razao esta escrita: o titulo vaza a estrategia ***',
  /vazaria pelo\s+título/.test(ddlRaw.replace(/\s+/g,' ')) || /vazaria pelo/.test(ddlRaw));

// ══════════ 3. A ABA E A TELA ══════════
ok('13. *** a ficha tem as 4 abas ***',
  ['info','lembretes','tarefas','obs'].every(a => tela.includes(`onclick="abaFicha(this,'${a}')"`)));
ok('14. *** o ESTAGIO fica FORA das abas (e estado, nao assunto) ***',
  tela.indexOf('<h4>Estágio</h4>') < tela.indexOf('<div class="dw-abas">'));
ok('15. so uma aba visivel por vez', /\.dw-painel\{display:none\}/.test(tela) && /\.dw-painel\.on\{display:block\}/.test(tela));
ok('16. a aba Lembretes mostra quantos estao abertos', /id="dw-lem-n"/.test(tela));
ok('17. quem nao grava nao ve o formulario de agendar', /só quem grava pode agendar lembrete/.test(tela));
ok('18. sem titulo nao agenda', /escreva o que precisa ser feito/.test(tela));
ok('19. *** sem data nao agenda, com a razao dita ***', /lembrete sem quando não avisa nada/.test(tela));
ok('20. *** erro de leitura NAO vira "nenhum lembrete agendado" ***',
  /não consegui ler os lembretes deste negócio/.test(tela));
ok('21. feito continua VISIVEL, so riscado (some seria perder a prova)',
  /\.lem\.feito \.t\{text-decoration:line-through/.test(tela) && /perder a prova de que a coisa foi feita/.test(tela));

// ══════════ 4. O SINO ══════════
ok('22. *** o sino le lembrete ABERTO que vence ate amanha ***',
  /feito=is\.false/.test(tela) && /quando=lt\.\$\{amanha\.toISOString\(\)\}/.test(tela));
ok('23. *** falha ao ler vira "NAO SEI", nunca "nada agendado" ***',
  /não sei<\/b> o que está agendado/.test(tela));
ok('24. *** lembrete entra no badge (fica aceso ate alguem RESOLVER) ***',
  // 11/08: o badge ganhou um 4º termo (credenciamento parado). O assert deixou de casar a soma
  // INTEIRA e passou a exigir o que ele sempre quis proteger — que `lemAbertos` está lá dentro.
  // Casar a soma letra por letra fazia esta suíte quebrar toda vez que OUTRA coisa entrava no
  // sino, o que é ruído: ela não é a dona do badge, é a dona do lembrete.
  /const total = n\.urgentes \+ docsRuins \+ lemAbertos\b/.test(tela));
ok('25. clicar no aviso abre o negocio dono do lembrete', /onclick="irPara\(\$\{l\.negocio_id\}\)"/.test(tela));
// 11/08: a linha do sino passou a servir lembrete E tarefa, entao o sufixo concorda com o
// genero ("atrasado"/"atrasada"). O que este assert protege continua sendo o mesmo: quem
// esta atrasado aparece marcado, e nao se confunde com quem esta no prazo.
ok('26. lembrete atrasado e marcado como tal', /atrasado\?' · atrasad'\+\(eTarefa\?'a':'o'\)/.test(tela));
ok('27. *** vem DEPOIS das sessoes: sessao tem hora do orgao e nao se remarca ***',
  /sessão tem hora marcada pelo\s+órgão e não se remarca/.test(tela.replace(/\s+/g,' '))
  || /não se remarca/.test(tela));
ok('28. criar/marcar lembrete repinta o sino na hora', (tela.match(/pintaNotif\(\);/g)||[]).length >= 3);

// ══════════ 5. ITEM 6 — A QUAL EMPRESA VINCULAR ══════════
ok('29. *** o negocio nasce com empresa_id ***', /empresa_id: emp\.id,/.test(lic));
ok('30. *** com UMA empresa nao pergunta (modal de uma opcao e clique sem informacao) ***',
  /if\(es\.length === 1\) return \{ id: es\[0\]\.id, nome: es\[0\]\.razao_social \};/.test(lic));
ok('31. *** com DUAS ou mais, pergunta — o sistema nao adivinha ***',
  /A qual empresa vincular este negócio\?/.test(lic));
ok('32. cancelar a escolha NAO grava nada', /if\(emp === null\) return;/.test(lic));
ok('33. opcao invalida tambem nao grava', /Opção inválida — nada foi gravado/.test(lic));
ok('34. e o botao DIZ a qual empresa foi, mesmo sem perguntar',
  /'✓ no funil' \+ \(emp\.nome/.test(lic));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
