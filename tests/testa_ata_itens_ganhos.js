/* ══════════════════════════════════════════════════════════════════════════════════════════════
   SUITE testa_ata_itens_ganhos — A ATA MOSTRA O QUE ELE GANHOU, COM OS PREÇOS (fatia B23)

   Palavras do dono, em 14/08: *"esse que já tá em ata tem que aparecer os itens que ganhei com os
   preços, tá muito superficial, entende"*.

   ══ ESTE TESTE CHAMA AS FUNÇÕES, NÃO LÊ O ARQUIVO ═════════════════════════════════════════════
   É a lição da B20, e ela custou caro para ser aprendida: um teste que confere se a regra está
   ESCRITA fica verde no dia em que a regra está escrita e quebrada. As três funções desta fatia
   (`ganhosDoNegocio`, `faltaDoResultado` e o formatador `brl`) são recortadas do arquivo e
   EXECUTADAS aqui, com o dado no formato em que ele chega do banco.

   ══ O QUE ESTA SUÍTE GUARDA, E POR QUÊ CADA UMA ═══════════════════════════════════════════════
   1. `valor_ganho` NÃO É PORTEIRO. Ele é um campo que alguém digita; enquanto ele era a condição
      para o quadro aparecer, um negócio em Ata com 192 itens homologados no nosso banco mostrava
      NADA (medido: negócio 2567, licitação 6719). Ausência de digitação apagando dado publicado.
   2. PREÇO AUSENTE SAI COMO TRAVESSÃO E NÃO SOMA. R$ 0,00 numa linha de ata não é célula vazia:
      é a afirmação de que o órgão vai pagar zero por aquele item. Mesma lição do `fmtBRL`.
   3. A FRASE DO ESTADO VAZIO MUDA COM O CASO. "o PNCP não publicou" e "o PNCP publicou e nenhum
      item é seu" são coisas diferentes; a tela que disser a mesma frase para as duas mente para
      uma delas.
   4. UNIDADE VEM DO ITEM DO EDITAL, e sem par ela fica em branco — unidade deduzida num documento
      que vira faturamento é o pior tipo de chute.

     node tests/testa_ata_itens_ganhos.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_negocios.html'), 'utf8');

function corpoDaFuncao(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + nome + '\\s*\\(').exec(src);
  if (!m) throw new Error('nao achei a function ' + nome + ' — a ancora do teste quebrou');
  let i = src.indexOf('{', m.index + m[0].length - 1), n = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') n++;
    else if (src[j] === '}') { n--; if (!n) return src.slice(m.index, j + 1); }
  }
  throw new Error('chave nao fechou: ' + nome);
}
function constante(nome) {
  const m = new RegExp('(?:^|\\n)\\s*(?:const|let|var)\\s+' + nome + '\\s*=[^;\\n]*;').exec(src);
  if (!m) throw new Error('nao achei a const ' + nome);
  return m[0];
}

/* O `esc` da tela usa DOM; aqui ele vira uma troca de texto pura. Isto NÃO é o teste fingindo
   que a função é outra: `esc` não participa de nenhuma regra que esta suíte julga — ela julga
   número, origem e frase. Trocar o que não se julga é o que deixa o resto executável. */
const ctx = (new Function(`
  const esc = s => String(s == null ? '' : s);
  ${constante('_soNum')}
  ${constante('brl')}
  let EMPRESAS = [], ITENS_GANHOS = [], ITENS_EDITAL = [], ITENS_ERRO = null;
  ${corpoDaFuncao('ganhosDoNegocio')}
  ${corpoDaFuncao('faltaDoResultado')}
  return {
    ganhosDoNegocio, faltaDoResultado, brl, _soNum,
    põe: (e, g, i, err) => { EMPRESAS = e; ITENS_GANHOS = g; ITENS_EDITAL = i; ITENS_ERRO = err || null; }
  };`))();
const { ganhosDoNegocio, faltaDoResultado, brl, põe } = ctx;

let p = 0, f = 0;
const ok = (t, cond, extra) => {
  if (cond) { p++; return; }
  f++; console.log('  FALHA ' + t + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : ''));
};
console.log('SUITE testa_ata_itens_ganhos — a ata mostra o que ele ganhou, com os precos\n');

const EMP  = [{ id: 1, razao_social: 'FPMED', cnpj: '47.110.418/0001-15' }];
const MEU  = '47110418000115';
const NEG_ATA = { id: 9, estagio: 'contrato', empresa_id: 1, licitacao_id: 6719,
                  numero_controle: '0164-1-000117/2026', valor_ganho: null };

// item do edital no formato exato do `select` da tela (conferido contra licitacao_itens)
const item = (n, o) => Object.assign({
  numero_item: String(n), descricao: 'ITEM ' + n, quantidade: 10, unidade: 'UN',
  valor_unitario_ref: null, situacao: null,
  resultado_vencedor: null, resultado_cnpj: null, resultado_valor_unit: null,
  resultado_quantidade: null, resultado_situacao: null }, o || {});

// ══════════ 1. O `valor_ganho` DEIXOU DE SER PORTEIRO ══════════
põe(EMP, [], [item(1, { resultado_vencedor: 'FPMED', resultado_cnpj: MEU,
                        resultado_valor_unit: 4.16, resultado_quantidade: 200 })]);
let l = ganhosDoNegocio(NEG_ATA);
ok('1. *** com valor_ganho NULO, o item homologado do PNCP ainda aparece ***', l.length === 1, l.length);
ok('2. ...e ele traz o preço unitário homologado', l[0].unitario === 4.16, l[0].unitario);
ok('3. ...e o total da linha é unitário × quantidade do RESULTADO', l[0].total === 832, l[0].total);
ok('4. ...e a unidade vem do item do edital', l[0].unidade === 'UN', l[0].unidade);
ok('5. ...e a linha se declara publicada pelo PNCP (não confirmada por nós)', l[0].nosso === false);

// ══════════ 2. ITEM DE OUTRA EMPRESA NÃO É MEU ══════════
põe(EMP, [], [item(1, { resultado_vencedor: 'OUTRA LTDA', resultado_cnpj: '99999999000199',
                        resultado_valor_unit: 9.9, resultado_quantidade: 5 })]);
ok('6. *** item ganho por OUTRO CNPJ não entra na minha ata ***', ganhosDoNegocio(NEG_ATA).length === 0);

// sem CNPJ cadastrado não dá pra afirmar que é meu — e a tela não chuta
põe([{ id: 1, cnpj: null }], [], [item(1, { resultado_vencedor: 'FPMED', resultado_cnpj: MEU,
                                            resultado_valor_unit: 1, resultado_quantidade: 1 })]);
ok('7. *** sem CNPJ na empresa, nenhum item é declarado meu ***', ganhosDoNegocio(NEG_ATA).length === 0);

// ══════════ 3. PREÇO AUSENTE: TRAVESSÃO, NUNCA R$ 0,00 ══════════
põe(EMP, [], [item(1, { resultado_vencedor: 'FPMED', resultado_cnpj: MEU,
                        resultado_valor_unit: null, resultado_quantidade: 10 })]);
l = ganhosDoNegocio(NEG_ATA);
ok('8. *** item publicado SEM valor unitário continua na lista ***', l.length === 1, l.length);
ok('9. ...com unitário NULO, e não zero (zero é uma afirmação: "é de graça")', l[0].unitario === null, l[0].unitario);
ok('10. ...e com total NULO, e não zero', l[0].total === null, l[0].total);
ok('11. *** e o formatador escreve travessão para ausência ***', brl(null) === '—', brl(null));
ok('12. ...mas o zero DE VERDADE continua saindo como R$ 0,00',
   /0,00/.test(brl(0)) && /R\$/.test(brl(0)), brl(0));

// o item sem preço NÃO SOMA no total da ata — é a conta que a tela faz
põe(EMP, [], [item(1, { resultado_vencedor: 'FPMED', resultado_cnpj: MEU, resultado_valor_unit: 2, resultado_quantidade: 10 }),
              item(2, { resultado_vencedor: 'FPMED', resultado_cnpj: MEU, resultado_valor_unit: null, resultado_quantidade: 10 })]);
l = ganhosDoNegocio(NEG_ATA);
const soma = l.reduce((s, x) => s + (Number(x.total) || 0), 0);
ok('13. *** o item sem preço não entra no total da ata ***', soma === 20, soma);

// ══════════ 4. NOSSA CONFIRMAÇÃO MANDA, E O PNCP FICA AO LADO ══════════
põe(EMP, [{ item_n: 1, descricao: 'ITEM 1', marca: 'ACME', quantidade: 10, valor_unitario: 3, total: 30 }],
        [item(1, { resultado_vencedor: 'FPMED', resultado_cnpj: MEU, resultado_valor_unit: 2.5, resultado_quantidade: 10 })]);
l = ganhosDoNegocio(NEG_ATA);
ok('14. *** quando os dois existem, vale o NOSSO preço na linha ***', l[0].unitario === 3, l[0].unitario);
ok('15. ...e o do PNCP fica guardado ao lado, para a conferência', l[0].pncp && l[0].pncp.unitario === 2.5, l[0].pncp);
ok('16. *** a unidade do edital preenche a nossa confirmação, que não a guarda ***',
   l[0].unidade === 'UN', l[0].unidade);
// e sem par no edital, unidade fica em branco — nunca deduzida
põe(EMP, [{ item_n: 7, descricao: 'ITEM 7', quantidade: 1, valor_unitario: 1, total: 1 }], []);
ok('17. *** sem o par no edital, a unidade fica NULA (nunca deduzida) ***',
   ganhosDoNegocio(NEG_ATA)[0].unidade === null, ganhosDoNegocio(NEG_ATA)[0].unidade);

// ══════════ 5. A FRASE DO VAZIO MUDA COM O CASO ══════════
põe(EMP, [], []);
ok('18. *** sem amarração com o certame, a frase pede o número de controle ***',
   /número de controle/i.test(faltaDoResultado({ id: 1, empresa_id: 1 })));

põe(EMP, [], []);
ok('19. *** amarrado e sem itens: a frase diz que a coleta ainda não trouxe ***',
   /ainda não foram coletados/i.test(faltaDoResultado(NEG_ATA)));

põe(EMP, [], [item(1), item(2)]);
const semPub = faltaDoResultado(NEG_ATA);
ok('20. *** com itens e sem resultado: "ainda não sei" NÃO É "não ganhei" ***',
   /ainda não sei/i.test(semPub) && /não publicou/i.test(semPub), semPub.slice(0, 90));

põe(EMP, [], [item(1, { resultado_vencedor: 'OUTRA', resultado_cnpj: '99999999000199', resultado_valor_unit: 5 }),
              item(2)]);
const nenhumMeu = faltaDoResultado(NEG_ATA);
ok('21. *** publicado e nenhum é meu: a frase diz os DOIS números e o CNPJ conferido ***',
   /1<\/b> dos 2/.test(nenhumMeu) && /47\.110\.418\/0001-15/.test(nenhumMeu), nenhumMeu.slice(0, 120));
ok('22. ...e oferece a saída certa (anexar a ata e confirmar), sem afirmar que perdemos',
   /anexe a ata/i.test(nenhumMeu) && !/perdemos|não ganhou/i.test(nenhumMeu));

põe([{ id: 1, cnpj: null }], [], [item(1, { resultado_vencedor: 'X', resultado_cnpj: 'Y', resultado_valor_unit: 1 })]);
ok('23. *** sem CNPJ na ficha, a frase diz que a tela NÃO CHUTA quais são seus ***',
   /não chuta/i.test(faltaDoResultado({ id: 1, empresa_id: 1, licitacao_id: 6719 })));

/* ERRO DE LEITURA NÃO VIRA "NÃO TEM" — e é a mesma lição que a Proposta pagou nesta rodada, onde
   um 401 saía como "Supabase Online · 0 itens". Aqui a frase do erro tem de ser DIFERENTE da
   frase do vazio: se as duas forem iguais, quem lê conclui que não ganhou nada. */
põe(EMP, [], [], 'o banco respondeu 500');
const comErro = faltaDoResultado(NEG_ATA);
põe(EMP, [], []);
const semNada = faltaDoResultado(NEG_ATA);
ok('24. *** com ITENS_ERRO, a frase é de ERRO e diz que isso não nega a existência ***',
   /não consegui ler/i.test(comErro) && /não<\/b> quer dizer que não existam/i.test(comErro),
   comErro.slice(0, 100));
ok('25. ...e ela é DIFERENTE da frase de "não tem item" — as duas iguais fariam concluir que perdeu',
   comErro !== semNada);

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
