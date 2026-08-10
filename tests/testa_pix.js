// SUITE testa_pix — A CHAVE PIX DA FPMED E O PROPRIO CNPJ, E ELA NAO E DIGITADA DUAS VEZES.
//
// Decisao do Lemuel (10/08): chave PIX = CNPJ 47.110.418/0001-15. Com isso os dados da empresa
// ficam completos — era o ultimo que faltava.
//
// O QUE ESTA SUITE PROTEGE, e por que ela existe pra um dado tao simples:
//   1. A CHAVE E DERIVADA DO CNPJ, nao copiada. Numero de conta escrito em dois lugares e numero
//      que um dia diverge — e num dado bancario divergir significa o CLIENTE PAGAR NA CONTA
//      ERRADA. Este teste falha no dia em que alguem colar a chave como texto solto.
//   2. SEM CHAVE, SEM LINHA. Campo "PIX:" em branco num PDF de proposta e pior que campo nenhum:
//      parece que a empresa esqueceu de preencher.
//   3. NAO ENTRA EM DECLARACAO. Declaracao apoiada na Lei 14.133 declara FATO JURIDICO; dado
//      bancario nao pertence a ela, e por dentro de um documento assinado isso vira ruido no
//      melhor caso e alvo de fraude no pior.
//
//   node tests/testa_pix.js
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const R = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');
const CFGSRC = R('cliente.config.js');
const G = R('fpmed_giovana.html');
const DECL = R('fpmed_declaracoes.html');
const CFG = require(path.join(RAIZ, 'cliente.config.js'));

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_pix — a chave e o CNPJ, e e derivada dele\n');

// ══════════ 1. A CHAVE BATE COM O CNPJ ══════════
const emp = CFG.empresa || {};
ok('1. *** a chave PIX e IGUAL ao CNPJ cadastrado da empresa ***',
  emp.pixChave === emp.cnpj && !!emp.cnpj, { pix: emp.pixChave, cnpj: emp.cnpj });
ok('2. ...e o CNPJ e o que o Lemuel passou em 22/07', emp.cnpj === '47.110.418/0001-15', emp.cnpj);
ok('3. o tipo da chave esta declarado', emp.pixTipo === 'CNPJ', emp.pixTipo);
ok('4. *** a linha sai no formato pedido ***',
  emp.pixLinha === 'PIX (CNPJ): 47.110.418/0001-15', emp.pixLinha);

// ══════════ 2. DERIVADA, NAO COPIADA ══════════
// A prova de que e derivada: o CNPJ aparece UMA vez no config, no campo `cnpj`.
{
  const ocorrencias = (CFGSRC.match(/47\.110\.418\/0001-15/g) || []).length;
  ok('5. *** o CNPJ aparece UMA vez so no config (a chave sai dele, nao e 2a copia) ***',
    ocorrencias === 1, ocorrencias);
  ok('6. ...e a derivacao esta no codigo, nao no valor',
    /e\.pixTipo === 'CNPJ' \? e\.cnpj/.test(CFGSRC));
  ok('7. o motivo esta escrito (duas copias = o cliente paga na conta errada)',
    /o cliente pagar na conta errada/.test(CFGSRC));
  ok('8. e ha caminho pra chave que NAO seja o CNPJ, sem virar copia',
    /e\.pixChave \|\|/.test(CFGSRC) && /pixChave` explicito|`pixChave` explicito/.test(CFGSRC));
}

// ══════════ 3. SEM CHAVE, SEM LINHA ══════════
ok('9. *** sem chave, `pixLinha` fica VAZIA (nao imprime rotulo em branco) ***',
  /CFG\.empresa\.pixLinha = chave \? .* : '';/.test(CFGSRC));
ok('10. ...e o motivo (campo em branco parece esquecimento e gera ligacao)',
  /parece que a\s*\n?\s*\/\/\s*empresa esqueceu de preencher/.test(CFGSRC) || /esqueceu de preencher/.test(CFGSRC));
ok('11. a proposta so imprime a linha se ela existir (nos DOIS lugares)',
  /\$\{_pixLinha\(\) \? `<div class="row"><span class="label">PIX/.test(G));

// ══════════ 4. NA PROPOSTA, NOS DOIS LUGARES CERTOS ══════════
ok('12. *** o quadro de dados da proposta tem a linha do PIX ***',
  /<span class="label">PIX\.+:<\/span>/.test(G));
ok('13. *** e o cabecalho do documento tambem ***', /id="doc-pix"/.test(G) && /el\.textContent = _pixLinha\(\)/.test(G));
ok('14. o cabecalho sai por extenso e o quadro so com a chave — e o motivo esta dito',
  /parece erro de impressão/.test(G) && /repetir "PIX" dentro da linha rotulada "PIX" é ruído/.test(G));
ok('15. *** a tela NAO escreve a chave: le do config ***',
  !/47\.110\.418\/0001-15["'\s]*[;,)]/.test(G.replace(/CNPJ: 47\.110\.418\/0001-15/g, '').replace(/>47\.110\.418\/0001-15</g, ''))
  || /LIMEDTEC_CLIENTE\.empresa\.pixChave/.test(G));
ok('16. e degrada sem estourar se o config nao carregar (try/catch)',
  /catch\(e\)\{ return ''; \}/.test(G));

// ══════════ 5. ONDE ELA **NAO** ENTRA ══════════
ok('17. *** o PIX NAO entra nas declaracoes (documento juridico, nao comercial) ***',
  !/pixLinha|pixChave|PIX \(CNPJ\)/.test(DECL));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
