// SUITE testa_resultado_item — A MEMORIA DE PRECO, E A CARENCIA QUE A TORNA EDUCADA
// (fatia A40 · 20/08/2026)
//
// == A EXIGENCIA QUE ESTA SUITE GUARDA =========================================================
// A caixa A40: "Traga resultado homologado do PNCP para as licitacoes ENCERRADAS (...) Ritmo
// educado e orcamento declarado, igual a A34. E o mesmo saldo com cadencia."
//
// == E O ACHADO QUE VIROU A REGRA: A CARENCIA ==================================================
// Resultado e UMA requisicao POR ITEM — nao existe endpoint de lote (sondado em 20/08: o
// /compras/{ano}/{seq}/resultados devolve 404). Entao a pergunta que separa ferramenta de abuso
// e "a partir de quando vale a pena bater nesta porta?". Medido (40 licitacoes, 108 perguntas):
//     < 7 dias .... 0 de 26 (0%)   <<< ZERO
//     7-30 dias ... 8 de 21 (38%)
//     30-90 dias .. 13 de 21 (62%)
//     90-180 ...... 10 de 20 (50%)
//     > 180 ....... 8 de 20 (40%)
// Das 7.122 encerradas do indice, 4.355 (61%) encerraram ha menos de 7 dias. Uma varredura "de
// todas as encerradas" gastaria a MAIOR PARTE das requisicoes contra um servico publico na unica
// faixa que medidamente nao responde nada.
//
// == E "NAO PERGUNTEI" NAO E "NAO EXISTE" ======================================================
// Sem o carimbo de "ja perguntei", os 39.976 itens de encerradas voltam para a fila em TODA
// rodada, para sempre — a fila se reenche com as respostas que ela ja obteve. E a lei da A19 no
// esquema (ddl/resultado_perguntado.sql).
//
//   node tests/testa_resultado_item.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const C = require('../tools/coleta_resultado_item.js');
const src = fs.readFileSync(path.join(raiz, 'tools', 'coleta_resultado_item.js'), 'utf8');
const ddl = fs.readFileSync(path.join(raiz, 'ddl', 'resultado_perguntado.sql'), 'utf8');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_resultado_item — a memoria de preco, com carencia e cadencia\n');

// ══════════ 1. O TETO E DIMENSIONADO PELA DIVIDA (a lei da A34, aqui) ══════════
{
  ok('1. o coletor pode ser IMPORTADO sem disparar a coleta e sem ler a chave-mestra',
    typeof C.planoDaRodada === 'function' && typeof C.textoDoSaldo === 'function');
  ok('2. ...e o corpo da rodada so dispara quando o arquivo E o comando',
    /if \(require\.main !== module\) return;/.test(src));
  const iBanco = src.indexOf('function banco()');
  const iSeg = src.indexOf("'segredos.local.txt'");
  const iFim = src.lastIndexOf('return _banco;');
  ok('3. *** o segredo e lido DENTRO de banco(), nunca ao carregar o arquivo ***',
    iBanco > 0 && iSeg > iBanco && iSeg < iFim, { banco: iBanco, segredo: iSeg, fim: iFim });

  const curta = C.planoDaRodada({ divida: 40, orcamentoMin: 60, taxaAnterior: 2.8 });
  ok('4. *** divida menor que o orcamento: o teto e a DIVIDA (nao se pede alvo que nao existe) ***',
    curta.teto === 40 && curta.zeraHoje === true, curta);

  const longa = C.planoDaRodada({ divida: 515, orcamentoMin: 20, taxaAnterior: 2.8 });
  ok('5. *** divida maior que o orcamento: o teto e o que CABE, e a rodada NAO se diz completa ***',
    longa.teto === longa.cabe && longa.teto < 515 && longa.zeraHoje === false, longa);
  ok('6. o teto NUNCA e um numero fixo escrito no arquivo',
    !/const TETO(_RODADA)?\s*=\s*\d+/.test(src) && /Math\.min\(divida, cabe\)/.test(src));

  ok('7. o orcamento tem 25% de folga de relogio — encher ate a borda e morrer na 1a lentidao',
    /\* 0\.75/.test(src) || /0\.75/.test(src));

  /* Uma rodada que morreu em dois segundos sem processar nada devolveria taxa perto de zero, e o
     teto seguinte seria astronomico — a rodada morreria de novo, por culpa da propria medicao. */
  const absurda = C.planoDaRodada({ divida: 999, orcamentoMin: 20, taxaAnterior: 0.01 });
  ok('8. *** taxa absurda e RECUSADA: medicao de rodada morta nao dimensiona a proxima ***',
    absurda.medida === false && absurda.segPorLic === C.SEG_POR_LIC_PADRAO, absurda);
  ok('9. o valor de partida e o PIOR caso conhecido, nao o melhor (errar para a cautela)',
    C.SEG_POR_LIC_PADRAO >= 2.8, C.SEG_POR_LIC_PADRAO);
}

// ══════════ 2. A CADENCIA — a diferenca entre um saldo e uma promessa ══════════
{
  const longa = C.planoDaRodada({ divida: 515, orcamentoMin: 20, taxaAnterior: 2.8 });
  ok('10. *** quando nao zera, o plano diz EM QUANTAS RODADAS zera ***',
    longa.rodadasParaZerar >= 2 && Number.isInteger(longa.rodadasParaZerar), longa.rodadasParaZerar);
  ok('11. ...e diz o --minutos que zeraria numa rodada so',
    longa.minutosParaZerar > 20, longa.minutosParaZerar);

  /* A CONTA FECHA NELA MESMA: devolvo ao plano o proprio --minutos que ele recomendou e exijo que
     agora a divida CAIBA. Numero recomendado que nao resolve o que prometeu e pior que nenhum. */
  const comOTempo = C.planoDaRodada({ divida: 515, orcamentoMin: longa.minutosParaZerar, taxaAnterior: 2.8 });
  ok('12. *** e o --minutos recomendado DE FATO zera: a conta fecha nela mesma ***',
    comOTempo.zeraHoje === true && comOTempo.teto === 515, comOTempo);

  const curta = C.planoDaRodada({ divida: 40, orcamentoMin: 60, taxaAnterior: 2.8 });
  ok('13. quando zera hoje NAO ha cadencia — nao se inventa promessa onde nao ha divida',
    curta.rodadasParaZerar === null && curta.minutosParaZerar === null, curta);

  const t = C.textoDoSaldo(515, longa);
  ok('14. *** o saldo diz o NUMERO e a CADENCIA, e nao so "volto na proxima" ***',
    /515/.test(t) && /rodadas/.test(t) && /--minutos \d+/.test(t), t);
  ok('15. divida zerada: o texto diz zerada, e nao promete rodada nenhuma',
    /zerada/.test(C.textoDoSaldo(0, longa)), C.textoDoSaldo(0, longa));
  ok('16. *** saldo que nao pode ser medido NAO vira "zerada" (a lei da A19) ***',
    C.textoDoSaldo(null, longa) === null);
}

// ══════════ 3. A CARENCIA — a pontaria que separa ferramenta de abuso ══════════
{
  ok('17. *** a carencia existe, e ela e o primeiro degrau onde a medicao deixou de ser zero ***',
    C.CARENCIA_DIAS === 7);
  ok('18. ...e ela e PARAMETRO (--carencia), nao tinta',
    /--carencia/.test(src) && /parseInt\(arg\('--carencia'\)/.test(src));
  ok('19. o filtro de elegiveis USA a carencia (data_encerramento < agora - carencia)',
    /data_encerramento=lt\.' \+ limite/.test(src)
    && /CARENCIA_DIAS \* 86400000/.test(src));
  ok('20. *** os cinco numeros medidos estao ESCRITOS no arquivo — a regra tem a razao junto ***',
    /0 de 26/.test(src) && /38%/.test(src) && /62%/.test(src) && /4\.355/.test(src));
  ok('21. e o coletor DIZ a carencia no console antes de comecar',
    /console\.log\('carência: ' \+ CARENCIA_DIAS/.test(src));
}

// ══════════ 4. "NAO PERGUNTEI" NAO E "NAO EXISTE" (a lei da A19 no esquema) ══════════
{
  ok('22. o DDL e ADITIVO e so — nenhum drop, nenhum delete, nenhum update',
    /add column if not exists/i.test(ddl)
    && !/\bdrop\b|\bdelete\b|\btruncate\b|^\s*update\b/im.test(ddl));
  ok('23. *** a coluna do "ja perguntei" existe no ITEM e na LICITACAO ***',
    /alter table public\.licitacao_itens[\s\S]{0,120}resultado_perguntado_em/i.test(ddl)
    && /alter table public\.licitacoes[\s\S]{0,120}resultado_perguntado_em/i.test(ddl));
  ok('24. ...e o porque esta escrito no comentario da coluna, no banco',
    /comment on column public\.licitacao_itens\.resultado_perguntado_em/i.test(ddl)
    && /já perguntei/i.test(ddl));
  /* Estes tres deixaram de perguntar ao TEXTO e passaram a perguntar a FUNCAO: `linhaDoItem` e
     exportada, e exercita-la e mais barato e mais verdadeiro que casar uma expressao regular com
     o jeito de escrever de quem passou por aqui. */
  const LIC = { numero_controle: '00000000000191-1-000001/2026' };
  const IT = { numero_item: 3, descricao: 'SERINGA 10ML' };
  const V = { nomeRazaoSocialFornecedor: 'FORNECEDOR X', niFornecedor: '00000000000191',
              valorUnitarioHomologado: '1.25', quantidadeHomologada: '100',
              situacaoCompraItemResultadoNome: 'Homologado' };
  const comV = C.linhaDoItem(LIC, IT, V, 'AGORA');
  const semV = C.linhaDoItem(LIC, IT, null, 'AGORA');

  ok('25. *** o carimbo do item e escrito SEMPRE, com resultado ou sem ***',
    comV.resultado_perguntado_em === 'AGORA' && semV.resultado_perguntado_em === 'AGORA', semV);
  ok('26. ...e o `resultado_lido_em` continua sendo escrito SO quando ha resultado',
    comV.resultado_lido_em === 'AGORA' && semV.resultado_lido_em === null,
    { com: comV.resultado_lido_em, sem: semV.resultado_lido_em });
  ok('27. o filtro de itens pendentes usa as DUAS colunas (nem perguntado, nem com resultado)',
    /resultado_perguntado_em=is\.null&resultado_valor_unit=is\.null/.test(src));

  /* ══════════ O DEFEITO QUE A PRIMEIRA RODADA DE VERDADE REVELOU, AS 15:02 ══════════
     `PGRST102 — All object keys must match`. Um upsert em lote vira UM `INSERT ... VALUES
     (…),(…)`: a lista de colunas e UMA so. A linha do item COM resultado tinha 10 chaves, a do
     item SEM tinha 4 — e como quase toda licitacao tem os dois, o lote que passava era a
     EXCECAO. O `&& gravou` da secao 5 fez o trabalho dele (nenhuma licitacao foi carimbada a
     toa), mas a rodada nao pagava divida nenhuma. Estes asserts existem para isso nao voltar. */
  ok('27b. *** as duas linhas tem EXATAMENTE as mesmas chaves (o contrato do lote do PostgREST) ***',
    JSON.stringify(Object.keys(comV).sort()) === JSON.stringify(Object.keys(semV).sort()),
    { com: Object.keys(comV).sort(), sem: Object.keys(semV).sort() });
  ok('27c. ...e as seis colunas de resultado estao PRESENTES na linha sem vencedor, valendo null',
    ['resultado_vencedor', 'resultado_cnpj', 'resultado_valor_unit', 'resultado_quantidade',
     'resultado_situacao', 'resultado_lido_em'].every(k => k in semV && semV[k] === null), semV);
  ok('27d. *** a linha nao e mais montada aos pedacos com `if` — ela tem FORMA ***',
    !/const linha = \{[\s\S]{0,400}?if \(v\) \{[\s\S]{0,400}?linha\.resultado_/.test(src)
    && /atualiza\.push\(linhaDoItem\(lic, it, v, agora\)\);/.test(src));
  ok('27e. o numero vem do `num()` (string "1.25" do PNCP vira 1.25, e vazio vira null)',
    comV.resultado_valor_unit === 1.25 && comV.resultado_quantidade === 100,
    { v: comV.resultado_valor_unit, q: comV.resultado_quantidade });
  ok('27f. situacao sem nome cai no literal "homologado", e nao em undefined',
    C.linhaDoItem(LIC, IT, { valorUnitarioHomologado: 9 }, 'A').resultado_situacao === 'homologado');
}

// ══════════ 5. CARIMBO SO DEPOIS DE GRAVAR — o defeito que a 1a rodada real revelou ══════════
{
  /* A PRIMEIRA RODADA DE VERDADE recusou 85 gravacoes com `23502 not-null violation` — e carimbou
     as 15 licitacoes assim mesmo, porque o erro so saia no LOG. Log nao e condicao. Foi preciso
     desfazer os 15 carimbos a mao. Estes asserts existem para que isso nao volte. */
  ok('28. *** a gravacao DEVOLVE o desfecho (um console.log de erro nao e uma condicao) ***',
    /return tudoOk;/.test(src) && /const gravou = atualiza\.length \? await gravaItens/.test(src));
  ok('29. *** e o carimbo da licitacao exige a gravacao ter passado ***',
    /if \(!truncou && !erroNesta && !interrompida && gravou\)/.test(src));
  ok('30. leitura TRUNCADA pelo teto nao carimba — a licitacao volta com os itens que faltam',
    /const truncou = pendentes\.length > TETO_ITENS_POR_LIC;/.test(src)
    && /volta na próxima/.test(src));
  ok('31. o upsert mira a CHAVE DE NEGOCIO, e nao a PK (a licao do 23505 da A7)',
    /on_conflict=numero_controle,numero_item/.test(src) && !/on_conflict=id/.test(src));
  ok('32. ...e o corpo carrega `descricao`, que e NOT NULL sem default (a licao do 23502)',
    /descricao: it\.descricao/.test(src) && /select=id,numero_item,descricao/.test(src));
}

// ══════════ 6. O QUE A COLETA NAO PODE FAZER ══════════
{
  /* EXERCITADO, e nao casado por regex: o PNCP publica mais de um resultado por item
     (remanescente, cancelamento, reclassificacao) e pegar o ULTIMO inserido entregaria um
     CANCELAMENTO como se fosse o vencedor. */
  const lista = [
    { ordemClassificacaoSrp: 2, niFornecedor: 'B' },
    { ordemClassificacaoSrp: 1, niFornecedor: 'A', dataCancelamento: '2026-08-01' },
    { ordemClassificacaoSrp: 3, niFornecedor: 'C' },
  ];
  ok('33. *** vencedor e o 1o classificado NAO CANCELADO — pegar o ultimo entregaria um cancelamento ***',
    C.vencedor(lista).niFornecedor === 'B', C.vencedor(lista));
  ok('33b. ...e lista com TODOS cancelados devolve null (nao ha vencedor, e isso nao e um erro)',
    C.vencedor([{ ordemClassificacaoSrp: 1, dataCancelamento: 'x' }]) === null
    && C.vencedor([]) === null && C.vencedor(null) === null);
  ok('34. 204 e corpo em branco sao "ainda nao julgado", e nao falha (ruido de erro no caso normal)',
    /r\.status === 404 \|\| r\.status === 204/.test(src) && /semResultado: true/.test(src));
  ok('35. o ritmo, o backoff e o breaker sao EMPRESTADOS do coletor do indice, nao copiados',
    /require\('\.\/coleta_pncp\.js'\)/.test(src)
    && !/function esperaBackoff|function criaBreaker/.test(src));
  ok('36. "nao consegui perguntar ao banco" NUNCA vira "nao achei" (a lei da A19)',
    /ISTO NÃO É "não achei" — é "não consegui olhar"/.test(src));
  ok('37. a taxa aprendida ENTRA no carimbo — aprender sem anotar e nao aprender',
    /seg_por_lic:/.test(src) && /rodadas_para_zerar: planoFim\.rodadasParaZerar/.test(src));
  ok('38. *** `ultima_ok` so e escrito quando a rodada nao foi cortada ***',
    /if \(!interrompida && !breaker\.aberto\) linha\.ultima_ok = detalhe\.fim;/.test(src));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
