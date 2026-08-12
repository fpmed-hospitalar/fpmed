// SUITE testa_credenciamento — credenciamento junto a industria: modelagem, trilha e o esquecido.
//
// ══ AS QUATRO DECISOES QUE ESTA SUITE TRAVA ═════════════════════════════════════════════════
//   1. O CREDENCIAMENTO E DA EMPRESA, NAO DO NEGOCIO. O pedido veio como "secao na ficha do
//      negocio" e a secao esta la — mas modelar por negocio faria cada pregao criar um pedido
//      novo pra mesma industria, e em tres meses a pergunta "eu ja sou credenciado na EMS?"
//      teria oito respostas.
//   2. A TRILHA E ESCRITA PELO BANCO. Historico que a tela escreve e historico que a tela pode
//      esquecer de escrever: basta um caminho novo de atualizacao pra mudanca acontecer sem
//      rastro, e o buraco so aparece quando alguem pergunta "desde quando isso esta parado?".
//   3. NAO SE APAGA. Sem policy de DELETE a RLS nega — o pedido registrado e o unico documento
//      que a empresa tem quando a industria diz "voces nunca solicitaram".
//   4. O QUE ISTO EXISTE PRA PEGAR E O PEDIDO ESQUECIDO. Credenciamento parado nao doi em lugar
//      nenhum ate o dia do pregao. Por isso ele muda a cor do cartao, conta na aba e toca o sino.
//
//   node tests/testa_credenciamento.js
//   (o comportamento no banco — trigger e RLS — e provado em tests/db/testa_credenciamento_rls.js)
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const N = R('fpmed_negocios.html');
const D = R('ddl', 'credenciamentos.sql');
const PROVA = R('tests', 'db', 'testa_credenciamento_rls.js');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_credenciamento — o pedido que nao se apaga e o pedido esquecido\n');

// ══════════ 1. A MODELAGEM ══════════
ok('1. *** a chave unica e (empresa, industria) — UM credenciamento por par ***',
  /create unique index if not exists credenciamentos_empresa_industria\s*\n\s*on public\.credenciamentos \(empresa_id, industria_norm\);/.test(D));
ok('2. *** e o negocio entra como ORIGEM, nao como dono ***',
  /negocio_id\s+bigint\s+references public\.negocios\(id\) on delete set null/.test(D));
ok('3. ...e o motivo esta escrito (por negocio, a mesma industria teria oito linhas)',
  /haveria oito linhas "EMS - solicitado" e ninguem saberia qual e a de verdade/.test(uc(D)));
ok('4. *** a comparacao de nome e normalizada por TRIGGER, nunca a mao ***',
  /create trigger cred_normaliza_t before insert or update/.test(D)
  && /new\.industria_norm := upper\(regexp_replace\(/.test(D));
ok('5. ...e ela so resolve GRAFIA — nao tenta adivinhar que duas empresas sao a mesma',
  /adivinhar que sao a mesma empresa e o tipo de\s*esperteza que um dia funde duas industrias distintas/.test(uc(D)));
ok('6. os quatro status estao travados no banco',
  /check \(status in \('solicitado','em_analise','aprovado','negado'\)\)/.test(D));
ok('7. *** solicitado_em e respondido_em sao DUAS datas diferentes ***',
  /solicitado_em timestamptz not null default now\(\)/.test(D) && /respondido_em timestamptz/.test(D));
ok('8. ...com o motivo (usar criado_em pra contar atraso erraria em pedido cadastrado depois)',
  /Usar `criado_em` pra contar atraso erraria em todo pedido cadastrado depois de enviado/.test(uc(D)));

// ══════════ 2. A TRILHA SAI DO BANCO ══════════
ok('9. *** a trigger de historico existe e roda em insert E update ***',
  /create trigger cred_historia_t after insert or update on public\.credenciamentos/.test(D));
ok('10. *** ela grava o pedido inicial (de_status null) ***',
  /values \(new\.id, null, new\.status, new\.criado_por, 'pedido registrado'\)/.test(D));
ok('11. *** e SO o status faz historia (corrigir telefone nao e passo do processo) ***',
  /if \(new\.status is distinct from old\.status\) then/.test(D));
ok('12. ...com o motivo (historico que registra tudo vira historico que ninguem le)',
  /um histórico\s*que registra tudo vira um histórico que ninguém lê/.test(uc(D)));
ok('13. *** a TELA nao escreve historico em lugar nenhum ***',
  !/credenciamento_historico`?,\s*\{method:'POST'/.test(N)
  && !/POST[\s\S]{0,120}credenciamento_historico/.test(N));
ok('14. ...e ela DIZ que quem escreve e o banco',
  /A TRILHA NÃO É ESCRITA AQUI/.test(N) && /uma trigger no banco/.test(uc(N)));
ok('15. a tela le a trilha em UMA chamada pra todos os cartoes (nao uma por cartao)',
  /credenciamento_id=in\.\(\$\{ids\}\)/.test(N) && /N chamadas seriam N erros possíveis/.test(uc(N)));

// ══════════ 3. NAO SE APAGA ══════════
ok('16. *** nao ha policy de DELETE em credenciamentos ***',
  !/create policy[^\n]*on public\.credenciamentos for delete/i.test(D));
ok('17. *** nem no historico ***',
  !/create policy[^\n]*on public\.credenciamento_historico for delete/i.test(D));
ok('18. *** e o historico tambem nao tem UPDATE (linha que se edita nao e historico) ***',
  !/create policy[^\n]*on public\.credenciamento_historico for update/i.test(D)
  && /linha de historico que se edita nao e historico/.test(uc(D)));
ok('19. o grant do historico e so select+insert', /grant select, insert on public\.credenciamento_historico to authenticated;/.test(D));
ok('20. o anon nao alcanca nenhuma das duas',
  /revoke all on public\.credenciamentos from anon;/.test(D) && /revoke all on public\.credenciamento_historico from anon;/.test(D));
ok('21. ...e o motivo esta escrito (e a unica prova de que o pedido foi feito)',
  /o unico documento\s*que a empresa tem quando a industria diz "voces nunca solicitaram"/.test(uc(D)));
ok('22. *** e ha PROVA de comportamento no banco, nao so leitura de arquivo ***',
  /tests\/db\/testa_credenciamento_rls\.js/.test(PROVA) || /o registro que nao se apaga/.test(PROVA));
ok('23. ...e a prova olha a LINHA, nao o status da resposta (a licao de 10/08)',
  /olhar a LINHA, e nao o status da resposta/.test(uc(PROVA)));
ok('24. ...e nao suja o banco (roda em transacao com rollback)',
  /rollback;/.test(PROVA) && /set local role authenticated;/.test(PROVA));
ok('25. ...com a RLS valendo de verdade no meio dela',
  /sem isso a conexao seria dona da tabela e passaria por cima de toda policy/.test(uc(PROVA)));
ok('26. e ela IMPRIME o numero que usou pra decidir', /o banco respondeu: historico=/.test(PROVA));

// ══════════ 4. A ABA NA FICHA ══════════
ok('27. *** existe a aba Credenciamentos, com contador ***',
  /\['cred','Credenciamentos','dw-cred-n'\]/.test(N));
ok('28. *** ela mostra os credenciamentos DA EMPRESA, nao so os deste negocio ***',
  /empresa_id=eq\.\$\{n\.empresa_id\}/.test(N));
ok('29. ...marcando os que nasceram deste negocio',
  /const daqui = c\.negocio_id === id;/.test(N) && /deste negócio<\/span>/.test(N));
ok('30. ...e o motivo (a pergunta "ja sou credenciado na EMS?" e feita nesta tela)',
  /a pergunta que o operador realmente faz — "eu já sou credenciado na EMS\?"/.test(uc(N)));
ok('31. *** o contador da aba conta os PARADOS, e nao o total ***',
  /const parados = CREDS\.filter\(credParado\)\.length;/.test(N));
ok('32. ...com o motivo ("Credenciamentos 12" nao pede nada de ninguem)',
  /não pede nada de ninguém/.test(uc(N)));
ok('33. *** erro de leitura NAO vira "nenhum credenciamento" ***',
  /isto <b>não<\/b> quer dizer que não existam/.test(N));
ok('34. a tela oferece os quatro status como passos (menos o atual)',
  /CRED_FASES\.filter\(f => f\.k !== c\.status\)/.test(N));
ok('35. *** aprovado\/negado carimba a data da resposta ***',
  /campos\.respondido_em = \(status === 'aprovado' \|\| status === 'negado'\) \? new Date\(\)\.toISOString\(\) : null;/.test(N));
ok('36. ...e voltar pra solicitado LIMPA a data (o pedido refeito nao foi respondido)',
  /manter a antiga faria a conta de dias\s*do novo pedido nascer errada/.test(uc(N)));
ok('37. *** pedido duplicado responde a pergunta certa, e nao um erro cru ***',
  /if\(r\.status === 409\)\{/.test(N) && /já existe um credenciamento desta empresa com/.test(N));

// ══════════ 5. O ESQUECIDO — O QUE ISTO EXISTE PRA PEGAR ══════════
ok('38. *** o corte de "parado" e 7 dias, como pedido ***', /const CRED_DIAS_PARADO = 7;/.test(N));
ok('39. *** e ele mora num lugar SO (cartao, aba e sino leem dali) ***',
  (N.match(/CRED_DIAS_PARADO/g) || []).length >= 3 && !/>= 7\b/.test(N.replace(/CRED_DIAS_PARADO = 7/, '')));
ok('40. ...com o motivo (tres numeros um dia discordariam sobre o que e estar parado)',
  /três lugares que, se\s*tivessem cada um o seu número, um dia discordariam/.test(uc(N)));
// >>> REAPONTADO EM 12/08 (tema claro): cobrava a TINTA EXATA `rgba(224,160,74,.55)`. A promessa
//     e "parado muda a BORDA do cartao, e nao so um texto no meio da linha" — a cor e o meio, e
//     ela virou token quando a tela deixou de ser escura.
ok('41. *** parado muda a BORDA do cartao, e nao so um texto ***',
  /\.cred\.parado\{border-color:var\(--ambar-\d00\)\}/.test(N));
ok('42. ...com o motivo (e o defeito que a secao existe pra pegar)',
  /pedido esquecido é o defeito que esta seção existe pra pegar/.test(uc(N)));
ok('43. *** o sino conta os parados no badge ***',
  /const credParados = Array\.isArray\(CRED_SINO\) \? CRED_SINO\.length : 0;/.test(N)
  // >>> O ASSERT MEDIA A SOMA INTEIRA, e reprovava no dia em que uma QUARTA fonte entrasse no
  //     sino (entrou: o alarme da coleta, 12/08). A promessa e "credParados entra no badge",
  //     e nao "a soma tem exatamente estas quatro parcelas". Contar a letra reprova o desenho
  //     certo, que e o jeito mais rapido de ensinar alguem a ignorar a suite. (licao S8)
  && /const total = [^;]*\bcredParados\b[^;]*;/.test(N));
ok('44. ...pela mesma regra do documento vencido (fica aceso ate alguem RESOLVER)',
  /fica aceso até\s*alguém RESOLVER, e resolver é possível hoje/.test(uc(N)));
ok('45. *** o corte do sino e feito no BANCO, nao na tela ***',
  /solicitado_em=lt\.\$\{limite\.toISOString\(\)\}/.test(N));
ok('46. ...com o motivo (senao le a lista inteira toda vez pra usar dois)',
  /leria a lista inteira de credenciamentos da empresa\s*toda vez que alguém abre o funil, pra usar dois/.test(uc(N)));
ok('47. *** credenciamento vem por ULTIMO no sino (e o aviso mais lento) ***',
  /ele é o mais LENTO dos\s*avisos/.test(uc(N)));
ok('48. falha de leitura do sino vira "nao sei", e nunca "nao ha pedido parado"',
  /então <b>não sei<\/b> se há pedido parado/.test(N));
ok('49. e o vazio do sino menciona os credenciamentos (senao ele afirma o que nao checou)',
  /nenhum credenciamento parado/.test(N));

// ══════════ 6. O PEDIDO (o documento) ══════════
ok('50. *** existe o botao "Gerar o pedido" em cada credenciamento ***',
  /cartaCredenciamento\(\$\{c\.id\}\)/.test(N) && /📝 Gerar o pedido/.test(N));
ok('51. *** os dados da empresa saem do cliente.config.js, nao digitados aqui ***',
  /const emp = \(window\.LIMEDTEC_CLIENTE && LIMEDTEC_CLIENTE\.empresa\) \|\| \{\};/.test(N)
  && !/47\.110\.418/.test(N));
ok('52. ...com o motivo (numero de documento em dois lugares um dia diverge)',
  /número de documento em dois lugares é número que\s*um dia diverge/.test(uc(N)));
ok('53. *** dado que falta e MARCADO no texto, e nao deixado em branco ***',
  /falta\.push\(nome\); return '«' \+ nome \+ ' — falta no cadastro»'/.test(N));
ok('54. ...e o aviso do que falta vem ANTES do texto',
  /carta com dado em branco é carta que se envia sem ver/.test(uc(N)));
ok('55. *** a cidade da assinatura e a da EMPRESA, e nao um padrao chutado ***',
  /dado\(emp\.cidade, 'cidade da empresa'\)/.test(N) && !/emp\.cidade \|\| 'Goiânia'/.test(N));
ok('56. ...com o motivo (errar o unico dado que ninguem confere)',
  /errar o único dado que ninguém confere/.test(uc(N)));
ok('57. a carta diz PARA QUAL certame o credenciamento e pedido, quando ha um',
  /A solicitação decorre da participação no certame/.test(N));
ok('58. ...e tem um caminho quando nao ha negocio de origem',
  /A solicitação decorre da participação em certames públicos/.test(N));
ok('59. o pop-up bloqueado e DITO, e nao um clique que nao faz nada',
  /o navegador bloqueou a janela — libere o pop-up/.test(N));

// ══════════ 7. O DDL EM SI ══════════
ok('60. *** o DDL nao apaga nada de DADO ***',
  !/\b(delete from|truncate|drop table|drop column)\b/i.test(D.replace(/--[^\n]*/g, '')));
// Os DROPs que existem sao SO de trigger e policy — objetos que se recriam sem custo, e que
// precisam sair pra o arquivo rodar 2x. Nenhum drop de tabela, coluna, indice ou view.
ok('61. ...e os unicos DROPs sao de trigger/policy, pra poder rodar 2x',
  (D.match(/^drop\s+(\w+)/gim) || []).every(l => /^drop\s+(trigger|policy)$/i.test(l))
  && /drop trigger if exists/.test(D) && /drop policy if exists/.test(D));
ok('62. *** ele nao toca em contatos_industria (que responde outra pergunta) ***',
  !/contatos_industria/.test(D.replace(/--[^\n]*/g, '')));
ok('63. ...e diz qual pergunta e (QUEM e o contato de cada marca)',
  /que responde outra pergunta: QUEM e o\s*contato de cada marca/.test(uc(D)));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
