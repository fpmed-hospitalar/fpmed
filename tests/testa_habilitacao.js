// SUITE testa_habilitacao — a fase renomeada, a tarefa que virou botao, e as tarefas do dia a dia.
//
// TRES DECISOES QUE ESTA SUITE TRAVA, e cada uma tem um jeito barato de dar errado:
//   1. RENOMEAR SO O ROTULO. A chave `classificacao` esta gravada em 2.555 linhas, no check
//      constraint, no MAPA_STATUS do semeador e no historico de alteracoes. Trocar o VALOR
//      exigiria migracao de dado pra mudar uma palavra que so existe pra ser lida.
//   2. CHECKLIST QUE VIRA BOTAO SAI DO CHECKLIST. Checkbox que duplica acao real pode estar
//      marcado enquanto a acao nao aconteceu — o checklist afirmando o que nao foi feito.
//   3. TAREFA COM DATA E LEMBRETE COM DATA SAO A MESMA COISA no banco. Duas tabelas com os
//      mesmos campos seriam dois caminhos ate o sino e dois lugares pra corrigir.
//
//   node tests/testa_habilitacao.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const N = R('fpmed_negocios.html');
const P = R('fpmed_pecas.html');
const DDL = R('ddl', 'lembretes_tipo.sql');

// A FILEIRA DO RODAPÉ, recortada. Ela cresce (Arquivar · Recurso · Ler edital · CMED ·
// Documentos · Fechar), e todo assert que casava a distância entre dois botões quebrava a cada
// botão novo. Recortar o bloco e perguntar pelo conteúdo é estável e diz o que se quer dizer.
function fileiraDoRodape() {
  const i = N.indexOf('class="dw-acoes"');
  if (i < 0) return '';
  const j = N.indexOf('fecharDrawer()', i);
  return j < 0 ? '' : N.slice(i, j + 40);
}

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_habilitacao — rotulo, checklist e tarefas\n');

// ══════════ 1. O ROTULO MUDOU, A CHAVE NAO ══════════
ok('1. *** a fase se chama Habilitacao na tela ***', /\{ k:'classificacao', n:'Habilitação'/.test(N));
ok('2. *** e a CHAVE continua `classificacao` (nada de migracao de dado) ***',
  /k:'classificacao'/.test(N) && !/k:'habilitacao'/.test(N));
ok('3. nao sobrou "Classificação" visivel em lugar nenhum',
  (N.match(/Classificação/g) || []).length === 1);   // so a que explica a troca, no comentario
ok('4. o rotulo sai de UM lugar (FASES) — etiquetas, quadros e filtros leem dali',
  /const nomeFase = k => \(FASES\.find\(f=>f\.k===k\)\|\|\{\}\)\.n \|\| k;/.test(N));
ok('5. e o motivo esta escrito (rotulo e apresentacao; chave e identidade)',
  /Rótulo é apresentação; chave é identidade/.test(N));
ok('6. o filtro/contador de disputados continua usando a CHAVE', /n\.estagio==='classificacao'/.test(N));

// ══════════ 2. A TAREFA QUE VIROU BOTAO ══════════
ok('7. *** "Enviar proposta atualizada" saiu do checklist fixo ***',
  !/'Enviar proposta atualizada'/.test(N));
ok('8. ...e a regra geral ficou registrada pras proximas',
  /todo item do checklist que virar\s*\n?\s*função real SAI da lista fixa/.test(N.replace(/\s*\n\s*/g, ' '))
  || /virar\s+função real SAI da lista fixa/.test(N.replace(/\s*\n\s*/g, ' ')));
ok('9. *** e o que JA esta gravado nao e mexido (negocio antigo mantem os 15) ***',
  /Apagar item de checklist de negócio fechado seria reescrever o/.test(N.replace(/\s*\n\s*\/\/?\s*/g, ' ')));
ok('10. o "Enviar recurso / contrarrazão" CONTINUA no checklist (nao virou botao sozinho)',
  /'Enviar recurso \/ contrarrazão'/.test(N));

// ══════════ 3. TAREFAS PERSONALIZADAS ══════════
// ── 11/08, correcao do Lemuel: o checklist fixo saiu INTEIRO da tela (as 15 caixinhas, o
//    "4/15" da aba e o medidor com a barrinha nos cards). A aba Tarefas passou a ser SO as
//    personalizadas. O dado nao foi apagado.
ok('10b. *** as 15 caixinhas sairam da ficha ***', !/marcaTarefa\(/.test(N) || /foi REMOVIDA em 11\/08/.test(N));
ok('10c. *** o medidor "4/15" saiu do card da lista e do funil ***',
  !/class="prog">☑/.test(N) && !/barra-prog/.test(N));
ok('10d. *** e o "4/15" saiu da aba ***', !/Tarefas\$\{t \? ` \$\{feitas\}\/\$\{t\.length\}`/.test(N));
ok('10e. *** o DADO continua no banco (some da tela, nao do banco) ***',
  /Some da tela, não do banco/.test(N) && !/tarefas: null/.test(N));
ok('10f. desarquivar nao cria mais checklist invisivel',
  !/campos\.tarefas = novasTarefas\(\)/.test(N) && /dado invisível é o que um dia alguém acha/.test(N));
ok('10g. o contador da aba conta as ABERTAS (numero que nao baixa nao informa)',
  /const abertas = TAREFAS_LIVRES\.filter\(x => !x\.feito\)\.length;/.test(N));

ok('11. *** existe o "+ adicionar tarefa" na aba Tarefas ***',
  /\+ adicionar tarefa<\/button>/.test(N) && /id="tar-titulo"/.test(N));
ok('12. com texto livre, data OPCIONAL e prioridade', /id="tar-quando" type="datetime-local"/.test(N) && /id="tar-prio"/.test(N));
ok('13. *** a data e opcional e a tela DIZ o que muda ***',
  /Tarefa com data e hora <b>entra no sino<\/b>/.test(N) && /Sem data, fica só na lista/.test(N));
ok('14. ...e o motivo (data obrigatoria faria a pessoa inventar uma)',
  /data inventada vira alerta que ninguém quer/.test(N.replace(/\s*\n\s*\/\/?\s*/g, ' ')));
ok('15. *** tarefa e lembrete moram na MESMA tabela, separados por `tipo` ***',
  /tipo: 'tarefa'/.test(N) && /add column if not exists tipo text not null default 'lembrete'/.test(DDL));
ok('16. ...com os dois valores travados no banco', /check \(tipo in \('lembrete','tarefa'\)\)/.test(DDL));
ok('17. o DDL e ADITIVO', !/\b(drop|delete|truncate)\b/i.test(DDL.replace(/--[^\n]*/g, '')));
ok('18. UMA leitura serve as duas abas (duas chamadas seriam dois erros pra uma informacao)',
  /LEMBRETES = todos\.filter\(x => \(x\.tipo \|\| 'lembrete'\) === 'lembrete'\);/.test(N)
  && /TAREFAS_LIVRES = todos\.filter\(x => x\.tipo === 'tarefa'\);/.test(N));

// ══════════ 4. NO SINO ══════════
ok('19. *** tarefa com data entra no sino ***', /select=id,negocio_id,titulo,quando,prioridade,tipo/.test(N));
ok('20. ...e o sino DIZ se e tarefa ou lembrete', /const eTarefa = l\.tipo === 'tarefa';/.test(N)
  && /\$\{eTarefa\?'tarefa · ':''\}/.test(N));
ok('21. ...com o motivo (pedem coisas diferentes de quem le)',
  /"tarefa atrasada" e "lembrete atrasado" pedem/.test(N.replace(/\s*\n\s*\/\/\s*/g, ' ')));
ok('22. tarefa SEM data nao vira alerta (o filtro do sino e por `quando`)',
  /quando=lt\.\$\{amanha\.toISOString\(\)\}/.test(N));

// ══════════ 5. O ATALHO DAS PECAS ══════════
// (o bloco tem o comentário explicando a decisão no meio, então a distância é maior)
ok('23. *** existe o botao na fileira do rodape da ficha ***',
  // 11/08, 2ª vez: este assert casava a DISTÂNCIA até o `fecharDrawer` e quebrava toda vez que a
  // fileira ganhava um botão — duas vezes no mesmo dia, sem nada do que ele protege ter mudado.
  // Agora ele recorta a fileira e pergunta se o botão está DENTRO dela, que é o que ele sempre
  // quis dizer: ação da ficha mora na fileira do rodapé, e não solta no meio da tela.
  fileiraDoRodape().includes('irParaPecas(${n.id})'));
ok('24. *** ele NAO duplica as Pecas: leva contexto e abre a tela que ja existe ***',
  /location\.href = 'fpmed_pecas\.html';/.test(N) && /atalho com contexto/i.test(N));
ok('25. ...e o motivo (o que diverge, nelas, e prazo legal)',
  /o que diverge, nelas, é prazo legal/.test(N.replace(/\s*\n\s*/g, ' ')));
ok('26. leva so o que a ficha SABE (orgao, portal, nº, abertura, objeto)',
  /orgao: n\.orgao \|\| null, portal: n\.portal \|\| null/.test(N) && /abertura: n\.abertura \|\| null/.test(N));
ok('27. *** e diz que fatos, fundamento e pedido continuam sendo de quem escreve ***',
  /Os fatos, o fundamento e o pedido/.test(P));
ok('28. a tela de Pecas so preenche campo VAZIO (nao sobrescreve o que ja foi digitado)',
  /if\(el && !String\(el\.value\|\|''\)\.trim\(\) && val\) el\.value = val;/.test(P));
ok('29. ...e consome uma vez (recarregar nao repoe por baixo do que a pessoa mudou)',
  /sessionStorage\.removeItem\('fpmed_peca_certame'\)/.test(P));
ok('30. a cidade da assinatura vem da EMPRESA, nao do orgao',
  /quem assina a peça é a FPMED/.test(P));
ok('31. sem o contexto, a tela de Pecas abre como antes (nao quebra)',
  /if\(!cru\) return;/.test(P));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
