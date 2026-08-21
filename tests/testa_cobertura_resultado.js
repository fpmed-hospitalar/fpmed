/* ══════════════════════════════════════════════════════════════════════════════════════════
   testa_cobertura_resultado.js — A CADÊNCIA DA MEMÓRIA DE PREÇO (fatia A45, 21/08/2026)

   ══ O QUE ESTA CATRACA GUARDA ═════════════════════════════════════════════════════════════
   A caixa A45 pediu a cadência "quantas rodadas para 10%, para 25%". Medir a resposta revelou
   que a pergunta tinha o denominador errado e que o gargalo não é o ritmo. Esta suíte guarda
   as três coisas que essa medição descobriu:

     1. A PROJEÇÃO NÃO PODE VOLTAR A SER "licitações × rendimento médio". A primeira escrita
        multiplicava 2.848 licitações da dívida por 9,5 itens/licitação e anunciava +27.088.
        Falso: 94% das licitações da dívida NÃO TÊM ITEM LIDO, e o coletor as carimba de graça.
        A conta certa é "itens PENDENTES × taxa de resposta" = +1.762.
        >>> Média aplicada ao conjunto errado é o jeito mais limpo de publicar um número que
            ninguém consegue contestar e que está errado.

     2. "NÃO EXISTE" TEM QUE CONTINUAR DISTINGUÍVEL DE "NÃO PERGUNTEI" — a lei da A19 e o
        achado de esquema da A40. São 1.919 itens perguntados a que o PNCP respondeu que não há
        resultado, e eles são TRABALHO FEITO, não buraco de cobertura.

     3. O MEDIDOR NÃO ESCREVE E NÃO PERGUNTA AO PNCP. Ele é nove SELECT e uma conta.

   ══ E ELA RODA SEM BANCO E SEM CHAVE-MESTRA ═══════════════════════════════════════════════
   O `require` do medidor NÃO abre conexão (foi para isso que ele ganhou o portão) e a senha do
   `roda_sql` virou leitura preguiçosa na mesma fatia. Regra que só se testa com a chave-mestra
   na mão é regra que ninguém testa.

     node tests/testa_cobertura_resultado.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const M = require('../tools/mede_cobertura_resultado.js');
const src = fs.readFileSync(path.join(raiz, 'tools', 'mede_cobertura_resultado.js'), 'utf8');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => {
  if (c) { p++; console.log('  ok   ' + t); }
  else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); }
};

console.log('=== A CADENCIA DA MEMORIA DE PRECO (fatia A45) ===\n');

// ══ 1. A PROJEÇÃO ════════════════════════════════════════════════════════════════════════
console.log('── 1. a projeção, e a média que ela recusa ──');
ok(n++ + '. as regras podem ser IMPORTADAS sem banco, sem chave-mestra e sem rodar nada',
  typeof M.projecao === 'function' && typeof M.taxaDeResposta === 'function' && typeof M.SQL === 'string');

/* Os números MEDIDOS em 21/08/2026 12:10. Se um dia a realidade mudar, o que muda é o valor
   lido do banco — a REGRA (pendentes × taxa) é o que esta suíte guarda. */
const PENDENTES = 2792, PERGUNTADOS = 5202, SEM_RESULTADO = 1919;
const taxa = M.taxaDeResposta(PERGUNTADOS, SEM_RESULTADO);
ok(n++ + '. a taxa de resposta é medida (perguntados - sem resultado) / perguntados = 63,1%',
  Math.abs(taxa - 0.6311) < 0.0002, taxa);
ok(n++ + '. *** a projeção multiplica os itens PENDENTES pela taxa: +1.762, e não +27.088 ***',
  M.projecao({ itensPendentes: PENDENTES, taxaResposta: taxa }) === 1762,
  M.projecao({ itensPendentes: PENDENTES, taxaResposta: taxa }));
/* A conta ERRADA, escrita aqui de propósito, para o número dela ficar no arquivo com o nome de
   errado. 2.848 licitações x 9,5 itens/lic = 27.056 — quinze vezes o certo. */
ok(n++ + '. ...e a conta antiga (licitações × rendimento) daria 15x mais',
  Math.round(2848 * 9.5) > 15 * 1762, Math.round(2848 * 9.5));

ok(n++ + '. dívida zerada projeta ganho ZERO (e não um número por arredondamento)',
  M.projecao({ itensPendentes: 0, taxaResposta: taxa }) === 0);
/* A lei da A19 na aritmética: sem medida não se inventa uma. */
ok(n++ + '. *** sem taxa medida a projeção devolve null, e não um palpite ***',
  M.projecao({ itensPendentes: PENDENTES, taxaResposta: null }) === null
  && M.projecao({ itensPendentes: PENDENTES, taxaResposta: 1.7 }) === null
  && M.taxaDeResposta(0, 0) === null);
ok(n++ + '. ...e "perguntei 0" nunca vira "taxa 0%" (dividir por zero calado é o pior dos dois)',
  M.taxaDeResposta(0, 0) === null && M.taxaDeResposta(null, null) === null);
/* Um "sem resultado" maior que "perguntados" é banco inconsistente, não taxa negativa. */
ok(n++ + '. sem-resultado maior que perguntados é recusado, e não vira taxa negativa',
  M.taxaDeResposta(10, 20) === null);

ok(n++ + '. o rendimento por licitação existe, mas só para DIMENSIONAR o lever',
  Math.abs(M.rendimento({ licitacoes_fechadas: 268, itens_com_resultado: 2549 }) - 9.51) < 0.01);
ok(n++ + '. ...e ele é null sem carimbo, em vez de virar 6,0 de partida',
  M.rendimento(null) === null && M.rendimento({ licitacoes_fechadas: 0, itens_com_resultado: 5 }) === null);

// ══ 2. O SQL ═════════════════════════════════════════════════════════════════════════════
console.log('\n── 2. o SQL: só lê, e a carência entra por parâmetro ──');
const sql = M.SQL;
ok(n++ + '. *** o medidor SÓ LÊ: nem insert, nem update, nem delete, nem drop ***',
  !/\b(insert|update|delete|drop|truncate|alter|create)\b/i.test(sql));
/* `--carencia` vem da linha de comando. Concatenar entrada de fora dentro de SQL é a porta que
   ninguém devia deixar aberta nem numa ferramenta de leitura. */
/* ══ TODOS OS INTERVALOS, E NÃO "existe um $1 em algum lugar" ═══════════════════════════════
   A primeira escrita deste assert perguntava só `/\$1/.test(sql)`. O `tools/muta_a45.js`
   trocou UM dos cinco intervalos por `' 7 days'` fixo e ele passou verde — porque os outros
   quatro ainda tinham o $1. Um assert de presença não guarda um arquivo com cinco cópias da
   mesma coisa; o que guarda é a CONTAGEM bater. */
{
  const totalIntervalos = (sql.match(/::interval/g) || []).length;
  const comParametro = (sql.match(/\(\$1 \|\| ' days'\)::interval/g) || []).length;
  ok(n++ + '. *** TODOS os intervalos entram por $1 — nenhuma carência escrita à mão no SQL ***',
    totalIntervalos > 0 && comParametro === totalIntervalos, { totalIntervalos, comParametro });
  ok(n++ + '. ...e a carência não é concatenada no texto do SQL do lado do JavaScript',
    !/\+ *CARENCIA/.test(src.slice(src.indexOf('const SQL'), src.indexOf('const SQL_CARIMBO'))));
}
ok(n++ + '. o SQL conta as DUAS colunas do carimbo (a do item e a da licitação)',
  /i\.resultado_perguntado_em is null/.test(sql) && /l\.resultado_perguntado_em is null/.test(sql));
ok(n++ + '. *** e mede "perguntou e o PNCP disse que NÃO HÁ" como coisa própria ***',
  /perguntou_sem_resultado/.test(sql));
ok(n++ + '. ...e a divergência entre as duas colunas (valor gravado sem pergunta registrada)',
  /valor_sem_carimbo/.test(sql));
ok(n++ + '. mede a dívida em itens pelas DUAS colunas, e guarda o bruto para comparar',
  /itens_na_divida_bruto/.test(sql) && /itens_na_divida\b/.test(sql) && /lic_truncadas/.test(sql));
ok(n++ + '. *** e mede o gargalo: quantas da dívida não têm item lido nenhum ***',
  /divida_sem_itens_lidos/.test(sql) && /maduras_sem_itens_lidos/.test(sql));

// ══ 3. A REGRA É EMPRESTADA, NÃO COPIADA ═════════════════════════════════════════════════
console.log('\n── 3. uma régua só ──');
ok(n++ + '. *** a cadência vem do `planoDaRodada` do próprio coletor, e não de uma cópia ***',
  /require\('\.\/coleta_resultado_item\.js'\)/.test(src) && /planoDaRodada\(\{/.test(src)
  && !/function planoDaRodada/.test(src));
ok(n++ + '. ...e a conexão vem do `roda_sql`, e não de um segundo `new Client`',
  /require\('\.\/roda_sql\.js'\)/.test(src) && !/new Client/.test(src));
/* O portão: sem ele, a suíte que perguntasse "quanto rende zerar a dívida?" abriria conexão. */
ok(n++ + '. ...e o medidor tem o portão do `require.main`, senão este teste abriria o banco',
  /if \(require\.main !== module\) return;/.test(src));

// ══ 4. O QUE ELE DIZ EM VOZ ALTA ═════════════════════════════════════════════════════════
console.log('\n── 4. o que ele publica, e o que ele se recusa a prometer ──');
ok(n++ + '. *** publica os DOIS denominadores lado a lado ***',
  /sobre TODOS os itens do índice/.test(src) && /sobre os que PODEM responder/.test(src));
ok(n++ + '. *** diz que 10% e 25% dependem do ESTOQUE de encerradas, não do ritmo ***',
  /O GARGALO NÃO É A VELOCIDADE, É O ESTOQUE/.test(src) && /NÃO alcançável hoje/.test(src));
ok(n++ + '. declara que a estimativa do lever é estimativa, e por quê',
  /É ESTIMATIVA, e a base dela é uma média de OUTRO conjunto/.test(src));
ok(n++ + '. *** e devolve ao dono a decisão de produto que não é do trabalhador ***',
  /DECISÃO DE PRODUTO, NÃO MINHA/.test(src));
ok(n++ + '. ...e diz, no fim, que não escreveu nada e não tocou no PNCP',
  /nada foi escrito, e o PNCP não foi tocado/.test(src));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
