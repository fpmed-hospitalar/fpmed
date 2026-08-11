// SUITE testa_ficha_editavel — PREGAO ADIADO COM DATA VELHA FAZ O SINO AVISAR NO DIA ERRADO.
//
// URGENCIA do Lemuel, 08/08/2026, com o sistema JA EM USO REAL. Os campos vindos da carga do
// Calendario eram somente leitura, e o mundo real muda: pregao e ADIADO, SUSPENSO, CANCELADO,
// REMARCADO. Um aviso que aponta o dia errado e pior que aviso nenhum -- quem confia nele perde
// a sessao.
//
// O QUE ESTA SUITE PROTEGE:
//   1. O RASTRO E POR GATILHO, NAO PELA TELA. Se dependesse do front, bastaria alterar por
//      outra via -- um script, o painel do Supabase, uma tela futura -- pra mudanca acontecer
//      SEM rastro. E o rastro que falha justamente na alteracao que ninguem quis assumir e o
//      rastro que nao serve.
//   2. `anotacoes` NAO E TOCADA. E a observacao historica da planilha: memoria da operacao, nao
//      campo de log. Misturar o que a empresa escreveu com o que o sistema anotou nao tem volta.
//   3. SITUACAO E FATO DO MUNDO, NAO FASE DO FUNIL. Pregao suspenso continua na fase em que
//      estava; virar `estagio` faria perder onde ele parou quando voltasse.
//   4. PARADO != SUMIDO. Cancelado/suspenso fica no funil, esmaecido e etiquetado. Arquivar
//      continua sendo decisao de gente.
//   5. AGENDA E SINO USAM A DATA NOVA NA HORA -- senao o operador salva e continua vendo o
//      negocio no dia velho, e conclui que nao salvou.
//
//   node tests/testa_ficha_editavel.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');

const tela = ler('fpmed_negocios.html');
const ddl  = ler('ddl/negocios_editavel.sql').replace(/--[^\n]*/g, '');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_ficha_editavel — o mundo muda, a ficha acompanha, e fica o rastro\n');

// ══════════ 1. A SITUACAO DO CERTAME ══════════
ok('1. coluna `situacao` existe, com default seguro', /add column if not exists situacao text not null default 'normal'/.test(ddl));
ok('2. *** os 5 estados, e so eles (check) ***',
  /check \(situacao in \('normal','adiado','suspenso','cancelado','remarcado'\)\)/.test(ddl));
ok('3. *** e NAO virou um `estagio` novo: pregao suspenso continua na fase em que estava ***',
  !/estagio in \([^)]*suspenso/.test(ddl) && /SITUACOES = \[/.test(tela));
ok('4. a tela oferece os 5 na ficha', ['normal','adiado','remarcado','suspenso','cancelado']
  .every(k => new RegExp("k:'" + k + "'").test(tela)));

// ══════════ 2. O RASTRO, POR GATILHO ══════════
ok('5. *** existe a tabela de alteracoes ***', /create table if not exists public\.negocio_alteracoes/.test(ddl));
ok('6. *** e o gatilho que a alimenta ***',
  /create trigger negocios_rastro after update on public\.negocios/.test(ddl));
ok('7. *** o gatilho le auth.uid\(\): quem mudou e quem estava logado, nao quem a tela diz ***',
  /u uuid := auth\.uid\(\)/.test(ddl));
ok('8. guarda DE e PARA, nao so "mudou"', /de\s+text,/.test(ddl) && /para\s+text,/.test(ddl));
ok('9. guarda o e-mail junto (perfil apagado nao apaga o historico)', /quem_email text/.test(ddl));
{
  // cada campo tem que ter (a) a comparacao `is distinct from` e (b) o insert no historico.
  // So o insert nao bastaria: um `if` errado registraria o campo sem nunca disparar.
  const CAMPOS = ['abertura','situacao','portal','numero','orgao','objeto'];
  const semCompara = CAMPOS.filter(c => !new RegExp('new\\.' + c + ' is distinct from old\\.' + c).test(ddl));
  const semInsert  = CAMPOS.filter(c => !new RegExp("'" + c + "',").test(ddl));
  ok('10. *** os 6 campos editaveis sao COMPARADOS no gatilho ***', semCompara.length === 0, semCompara);
  ok('10b. ...e os 6 sao GRAVADOS no historico', semInsert.length === 0, semInsert);
}
ok('11. `estagio` NAO entra no rastro (arrastar card e a operacao mais comum; viraria ruido)',
  !/'estagio',/.test(ddl));
ok('12. objeto e cortado no log (correcao de virgula nao pode inchar a tabela)',
  /left\(coalesce\(old\.objeto,''\), 300\)/.test(ddl));
// A CATRACA: ninguem escreve no historico pela API
ok('13. *** o historico so tem policy de SELECT — ninguem grava por fora do gatilho ***',
  /create policy nalt_sel on public\.negocio_alteracoes for select/.test(ddl)
  && !/negocio_alteracoes for insert/.test(ddl)
  && !/negocio_alteracoes for update/.test(ddl)
  && !/negocio_alteracoes for delete/.test(ddl));
ok('14. anon nao le o historico', /revoke all on public\.negocio_alteracoes from anon/.test(ddl));
ok('15. o gatilho e SECURITY DEFINER (o rastro nao depende de permissao de escrita de ninguem)',
  /security definer/.test(ddl));

// ══════════ 3. `anotacoes` INTOCADA ══════════
ok('16. *** o DDL nao escreve em `anotacoes` ***', !/anotacoes\s*=/.test(ddl) && !/'anotacoes'/.test(ddl));
ok('17. ...e a ficha editavel tambem nao mexe nela', !/ed-anot/.test(tela));
ok('18. a anotacao continua tendo o campo dela, separado', /id="dw-anot"/.test(tela) && /salvaAnot\(/.test(tela));
ok('19. e a observacao da planilha segue marcada como nao editavel',
  /histórico, não editável aqui/.test(tela));

// ══════════ 4. A TELA ══════════
ok('20. *** so quem grava ve campo editavel (campo que daria 403 e convite a perder trabalho) ***',
  /const editavel = gestor && !n\.arquivado;/.test(tela));
// >>> MUDOU EM 08/08 e o teste mudou junto: a ficha de LEITURA (<dl>) foi REMOVIDA. A de campo
//     a campo serve os dois casos — quem nao pode gravar simplesmente nao recebe o botao
//     "Alterar". Manter as duas seria manter duas versoes da mesma tela, e a que ninguem abre e
//     a que envelhece errado (a antiga ja tinha "Modalidade" que a nova nao mostrava, e nao
//     mostrava "Valor estimado" que a nova mostra).
ok('21. *** quem nao grava ve a MESMA ficha, sem o botao Alterar (nao ha 2a versao da tela) ***',
  /\$\{editavel \? `<button class="fc-bt"/.test(tela) && !/<dl class="ficha">/.test(tela));
ok('22. data e hora sao campos separados (o caso nº1 e "adiou pra outro dia")',
  /id="ec-data"/.test(tela) && /id="ec-hora"/.test(tela));
ok('23. *** a abertura e montada como hora LOCAL (a mordida de fuso ja aconteceu aqui) ***',
  /new Date\(data \+ 'T' \+ \(hora \|\| '00:00'\) \+ ':00'\)/.test(tela));
ok('24. portal, numero, orgao e objeto tambem editaveis (erro de digitacao precisa ter conserto)',
  ['portal','numero','orgao','objeto'].every(k => new RegExp("^\\s*" + k + ":\\s*\\{ rot:", 'm').test(tela)));
// 08/08: os DOIS VALORES entraram na ficha, e o `valor_ganho` e o campo mais sensivel dela —
// e ele que alimenta a taxa de vitoria. Editavel sem rastro seria um indicador que qualquer um
// muda e ninguem sabe quem mudou, e indicador assim nao serve pra decidir nada.
ok('24b. *** valor_estimado e valor_ganho sao editaveis ***',
  /valor_estimado:\s*\{ rot:/.test(tela) && /valor_ganho:\s*\{ rot:/.test(tela));
ok('24c. *** e os DOIS entraram no rastro no MESMO dia em que ficaram editaveis ***',
  /new\.valor_ganho is distinct from old\.valor_ganho/.test(ddl)
  && /new\.valor_estimado is distinct from old\.valor_estimado/.test(ddl));
ok('24d. o valor ganho continua so pra gestor', /\$\{gestor \? campo\('valor_ganho'/.test(tela));
// A CATRACA DA EDICAO PONTUAL: um campo aberto por vez. Dois abertos seria o "modo edicao" de
// volta, com o mesmo risco de salvar o que nao se quis.
ok('24e. *** so UM campo aberto por vez ***',
  /if\(_campoAberto && _campoAberto !== k\) abrirDrawer\(id\);/.test(tela));
ok('24f. *** e salva SO o campo alterado (nao a ficha inteira) ***',
  /await gravar\(id, \{ \[k\]: valor \}\);/.test(tela));
ok('24g. cancelar nao grava nada, so repinta', /onclick="abrirDrawer\(\$\{id\}\)">Cancelar/.test(tela));
ok('25. *** salvar re-pinta a AGENDA e o SINO na hora ***',
  /pinta\(\); pintaNotif\(\);/.test(tela));
ok('26. ...e recarrega o rastro logo depois', /carregarRastro\(id\);/.test(tela));
ok('27. o rastro aparece na ficha', /id="dw-rastro"/.test(tela) && /async function carregarRastro/.test(tela));
ok('28. falha ao ler o rastro nao finge que nao houve alteracao',
  /não consegui ler o histórico de alterações/.test(tela));

// ══════════ 5. PARADO != SUMIDO ══════════
ok('29. *** cancelado/suspenso ganha etiqueta no card ***', /sit-tag/.test(tela) && /rotuloSituacao\(sit\)/.test(tela));
ok('30. *** e fica esmaecido, mas CONTINUA no funil ***',
  /const paradoDeVez = k => k === 'cancelado' \|\| k === 'suspenso';/.test(tela)
  && /\.card\.parado\{opacity:\.55/.test(tela));
ok('31. ...e o hover devolve a leitura (cartao ilegivel vira cartao ignorado)',
  /\.card\.parado:hover\{opacity:1/.test(tela));
ok('32. *** nada some sozinho: nao ha filtro escondendo cancelado ***',
  !/situacao\s*!==\s*'cancelado'/.test(tela) && !/filter\(.*cancelado/.test(tela));
ok('33. arquivar continua sendo acao manual', /fn: n\.arquivado \? `desarquivar\(\$\{n\.id\}\)` : `arquivar\(\$\{n\.id\}\)`/.test(tela));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
