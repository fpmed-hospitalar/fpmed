// SUITE testa_ean_na_proposta — MARCA, EAN E REGISTRO ANVISA NA LINHA DO ITEM (fatia B17).
//
// == O PEDIDO ==================================================================
// Edital de medicamento costuma exigir marca, EAN e registro ANVISA NA PROPOSTA.
// Ate a B17 a linha do item mostrava so a MARCA — e o EAN e o registro ja vinham
// do banco no `select=*`, chegavam na tela e nao eram desenhados em canto nenhum.
//
// == A REGRA QUE ESTA SUITE EXISTE PRA TRAVAR ==================================
// *** ONDE FALTA, NAO SE INVENTA — E TAMBEM NAO SE ESCONDE. ***
// Sumir com a linha quando o campo esta vazio faria a proposta parecer completa.
// Escrever um EAN "provavel" seria pior ainda: um EAN errado nao da erro em lugar
// nenhum, ele casa com OUTRO produto e devolve um teto com cara de certo. E a
// mesma doutrina que a testa_ean_cadastro defende no cadastro, agora na proposta.
//
// == E O PAPEL CONTINUA CONGELADO ==============================================
// O documento impresso esta congelado por ordem da caixa desde a B8. A linha nova
// e `no-print`, e esta suite confere que o papel nao ganhou coluna nem celula.
// A prova byte a byte das tres regioes do papel e outra:
//     node tools/prova_papel_congelado.js
//
//   node tests/testa_ean_na_proposta.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const HTML = R('fpmed_giovana.html');
const pega = re => (HTML.match(re) || [])[0] || '';

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_ean_na_proposta — a identidade do item na proposta (fatia B17)\n');

// ═════════ 0. AS PECAS, ARRANCADAS DO HTML E EXECUTADAS ═════════
const fEsc = pega(/function _escEd\(s\)\{[\s\S]*?\n\}/);
const fEan = pega(/function eanValido\(v\) \{[\s\S]*?\n\}/);
const fId = pega(/function identidadeDoItem\(c\)\{[\s\S]*?\n\}/);
const fHtml = pega(/function identidadeHTML\(c\)\{[\s\S]*?\n\}/);
const fIr = pega(/function irParaPendenciaEan\(produto\)\{[\s\S]*?\n\}/);
ok(n + '. (controle) as quatro pecas da fatia foram encontradas',
  !!fEsc && !!fEan && !!fId && !!fHtml && !!fIr); n++;
if (!fId || !fHtml) { console.log('\nRESULTADO: ' + p + ' ok, ' + (f + 1) + ' falha(s)'); process.exit(1); }

/* PURAS DE PROPOSITO: se `identidadeDoItem` tocasse o DOM ou a rede, esta suite nao
   poderia executa-la — e o que nao se executa se prova por leitura, que e como o
   defeito da B15 passou. */
ok(n + '. *** a leitura da identidade e pura (nao toca DOM nem rede) ***',
  !/\bdocument\.|\bfetch\(|\bwindow\./.test(fId)); n++;

const monta = podeImportar => new Function('podeImportarCotacao',
  fEsc + '\nfunction esc(s){ return _escEd(s); }\n' + fEan + '\n' + fId + '\n' + fHtml
  + '\nreturn { identidadeDoItem, identidadeHTML };')(() => podeImportar);
const T = monta(true);        // gestor: enxerga o atalho
const T_VEND = monta(false);  // vendedor: a aba da pendencia nao abre pra ele

// EANs REAIS, copiados da cmed_regua deste banco (os mesmos da testa_ean_cadastro)
const EAN_OK = '7896112110347';
const ITEM_COM = { produto: 'AMINOFILINA 24MG/ML', marca: 'TEUTO', ean: EAN_OK, registro_anvisa: '1.0043.0155' };
const ITEM_SEM = { produto: 'DIPIRONA 500MG', marca: 'HIPOLABOR', ean: null, registro_anvisa: null };

// ═════════ 1. O ITEM QUE TEM: MOSTRA, SEM ENFEITE ═════════
{
  const id = T.identidadeDoItem(ITEM_COM), h = T.identidadeHTML(ITEM_COM);
  ok(n + '. o item com EAN devolve o codigo so com digitos', id.ean === EAN_OK); n++;
  ok(n + '. e devolve o registro ANVISA como veio', id.registro === '1.0043.0155'); n++;
  ok(n + '. e nao acusa falta nenhuma', id.faltas.length === 0, id.faltas); n++;
  ok(n + '. *** a tela escreve o EAN e o registro ***',
    h.includes('EAN ' + EAN_OK) && h.includes('ANVISA 1.0043.0155'), h); n++;
  ok(n + '. e nao escreve "sem EAN" num item que tem EAN', !/sem EAN/.test(h), h); n++;
  ok(n + '. nem oferece o atalho de preencher pra quem ja esta preenchido',
    !/irParaPendenciaEan/.test(h), h); n++;
}

// ═════════ 2. O ITEM QUE NAO TEM: DIZ QUE NAO TEM ═════════
{
  const id = T.identidadeDoItem(ITEM_SEM), h = T.identidadeHTML(ITEM_SEM);
  ok(n + '. *** o item sem EAN devolve nulo — nada e chutado ***',
    id.ean === null && id.registro === null && id.eanFecha === null, id); n++;
  ok(n + '. e a falta e nomeada (pra quem quiser contar)',
    id.faltas.includes('ean') && id.faltas.includes('registro') && !id.faltas.includes('marca'), id.faltas); n++;
  ok(n + '. *** a tela escreve "sem EAN cadastrado" ***', /sem EAN cadastrado/.test(h), h); n++;
  ok(n + '. *** e "sem registro ANVISA" ***', /sem registro ANVISA/.test(h), h); n++;
  /* O ASSERT MAIS IMPORTANTE DESTA SUITE: nenhum digito pode aparecer onde o banco
     tem nulo. Se um dia alguem "melhorar" isto com um palpite por nome, cai aqui. */
  ok(n + '. *** NENHUM numero aparece onde o banco tem nulo ***', !/\d{8,}/.test(h), h); n++;
  ok(n + '. *** e o atalho para a fila de pendencia e oferecido ***',
    /irParaPendenciaEan\('DIPIRONA 500MG'\)/.test(h), h); n++;
}

// ═════════ 3. O EAN QUE NAO FECHA E DENUNCIADO ═════════
/* Um digito trocado nao da erro em canto nenhum: casa com OUTRO produto e devolve um
   teto com cara de certo. Exibir o numero como se valesse e o pior dos mundos. */
{
  const torto = { ...ITEM_COM, ean: '7896112110447' };
  const h = T.identidadeHTML(torto);
  ok(n + '. *** EAN com digito verificador errado e DENUNCIADO na linha ***',
    /não fecha/.test(h), h); n++;
  ok(n + '. e o numero errado continua visivel (pra pessoa achar o erro de digitacao)',
    h.includes('7896112110447')); n++;
  ok(n + '. e ele nao e tratado como "sem EAN" — sao problemas diferentes',
    !/sem EAN cadastrado/.test(h)); n++;
  ok(n + '. o julgamento vem de eanValido, e nao de um palpite',
    T.identidadeDoItem(torto).eanFecha === false
    && T.identidadeDoItem(ITEM_COM).eanFecha === true); n++;
  ok(n + '. EAN escrito com separador continua valendo (so os digitos contam)',
    T.identidadeDoItem({ ...ITEM_COM, ean: '7896-1121-10347' }).ean === EAN_OK); n++;
}

// ═════════ 4. AFORDANCIA HONESTA: O ATALHO SO PRA QUEM CHEGA LA ═════════
/* A pendencia mora na aba "Importar Cotacao", que o `gTab` recusa pra quem nao e
   gestor. Um link que nao leva a lugar nenhum e uma tela mentindo. */
{
  const h = T_VEND.identidadeHTML(ITEM_SEM);
  ok(n + '. *** vendedor NAO ve o atalho (a aba da pendencia e de gestor) ***',
    !/irParaPendenciaEan/.test(h), h); n++;
  ok(n + '. mas continua vendo o que falta — a informacao nao e de gestor, o botao e',
    /sem EAN cadastrado/.test(h) && /sem registro ANVISA/.test(h), h); n++;
  ok(n + '. e o proprio atalho confere o cargo de novo antes de trocar de aba',
    /podeImportarCotacao\(\)\) return/.test(fIr), fIr.slice(0, 120)); n++;
  ok(n + '. e leva o produto junto (a caixa pediu "o produto ja vem identificado")',
    /abrirPendenciaEan\(produto\)/.test(fIr)); n++;
}

// ═════════ 5. NOME DE PRODUTO E TEXTO DE TERCEIRO ═════════
/* Vem de planilha de fornecedor. Ele acaba dentro de um `onclick` — a aspa dupla
   fecharia o atributo e a simples fecharia a string do JavaScript. */
{
  const veneno = { produto: 'GAZE 7,5" <img src=x onerror=alert(1)> \'ok\'', marca: 'X', ean: null, registro_anvisa: null };
  const h = T.identidadeHTML(veneno);
  ok(n + '. *** aspa dupla do nome nao fecha o atributo onclick ***',
    !/irParaPendenciaEan\('[^']*"/.test(h), h.slice(0, 200)); n++;
  ok(n + '. *** aspa simples do nome nao fecha a string do JavaScript ***',
    /&#39;ok&#39;/.test(h), h.slice(0, 220)); n++;
  ok(n + '. *** e a marcacao do texto de terceiro nao vira HTML ***',
    !/<img/.test(h) && /&lt;img/.test(h), h.slice(0, 220)); n++;
}

// ═════════ 6. ITEM QUEBRADO NAO DERRUBA A LISTA ═════════
/* `renderItens` desenha a lista INTEIRA de uma vez. Um item torto que estoure aqui
   apaga a proposta toda da tela — e o operador nao ve item nenhum, so um vazio. */
{
  ok(n + '. item sem campo nenhum nao estoura', (() => {
    try { T.identidadeHTML({}); return true; } catch (e) { return false; } })()); n++;
  ok(n + '. item nulo nao estoura', (() => {
    try { T.identidadeHTML(null); return true; } catch (e) { return false; } })()); n++;
  ok(n + '. e um item vazio acusa as tres faltas',
    T.identidadeDoItem({}).faltas.join(',') === 'marca,ean,registro',
    T.identidadeDoItem({}).faltas); n++;
}

// ═════════ 7. O PAPEL NAO GANHOU NADA ═════════
/* Congelado desde a B8. A prova byte a byte e o tools/prova_papel_congelado.js;
   aqui ficam os asserts estruturais, que rodam sem git e sem rede. */
{
  /* >>> ESTE ASSERT PRENDIA O PIXEL, E A FATIA B19 O DERRUBOU SEM NADA TER PIORADO. Ele exigia
     `style="margin-top:3px"` — e a B19 pos os espacos desta tela na grade de 8, entao o 3 virou
     4 e a ancora quebrou. A pergunta do assert nunca foi "quantos pixels tem a margem": e "a
     linha da identidade vive na TELA e nao no PAPEL?". Um assert que reprova a arrumacao do
     espaco em nome do `no-print` protege a coisa errada e atrapalha a certa - e o pior e que
     ele reprova em VERMELHO, que e o sinal reservado pro defeito de verdade.
     Agora ele olha o que importa (a classe `no-print` e a chamada da identidade) e deixa o
     espaco em paz. O margin continua conferido, mas por quem e dono desse assunto: a regua. */
  const linhaNova = pega(/<div class="item-det no-print"[^>]*>\$\{identidadeHTML\(c\)\}<\/div>/);
  ok(n + '. *** a linha da identidade e `no-print` — ela vive na tela, nao no papel ***',
    !!linhaNova, linhaNova); n++;
  const papel = pega(/<div class="print-doc" id="print-doc">[\s\S]*?\n<!-- MODAL MANUAL -->/);
  ok(n + '. (controle) achei o papel', papel.length > 500); n++;
  ok(n + '. *** o papel nao fala de EAN nem de ANVISA — nada foi acrescentado la ***',
    !/EAN|ANVISA|identidadeHTML/i.test(papel)); n++;
  const cabecalhos = (papel.match(/<th[\s>]/g) || []).length;
  ok(n + '. *** a tabela do papel continua com as MESMAS 8 colunas ***',
    cabecalhos === 8, cabecalhos); n++;
  const pdf = pega(/function gerarPDF\(\)[\s\S]*?\n\}/);
  ok(n + '. *** e a linha de item do PDF continua com 8 celulas ***',
    (pdf.match(/<td/g) || []).length === 8, (pdf.match(/<td/g) || []).length); n++;
  ok(n + '. e o gerarPDF nao chama a funcao nova',
    !/identidadeHTML|identidadeDoItem/.test(pdf)); n++;
}

// ═════════ 8. O CHAO QUE FALTAVA: hdr() E esc() ═════════
/* Eles nunca existiram nesta tela, e por isso as tres funcoes da fatia do EAN
   estouravam um ReferenceError — a pendencia caia no proprio catch, a busca na CMED
   morria antes de perguntar. Medido em execucao: tools/prova_ean_na_proposta.js. */
{
  ok(n + '. *** `hdr()` e declarado na tela ***', /^function hdr\(\)\{/m.test(HTML)); n++;
  ok(n + '. *** `esc()` e declarado na tela ***', /^function esc\(s\)\{/m.test(HTML)); n++;
  /* UM escapador so. Dois e onde um deles um dia deixa passar uma aspa — e o que
     passa nao aparece como erro, aparece como HTML de terceiro executando. */
  ok(n + '. *** e `esc` REUSA o `_escEd` que a tela ja tinha (nao nasceu um segundo) ***',
    /^function esc\(s\)\{ return _escEd\(s\); \}$/m.test(HTML)); n++;
  ok(n + '. `hdr()` devolve COPIA dos cabecalhos, e nao o objeto vivo',
    /return Object\.assign\(\{\}, H\)/.test(pega(/^function hdr\(\)\{[^\n]*/m))); n++;
  /* As tres funcoes que dependiam deles continuam chamando — o conserto foi dar o
     chao, e nao reescrever as tres. */
  for (const fn of ['abrirPendenciaEan', 'buscarEanNaCmed', 'eanAplicar']) {
    const corpo = pega(new RegExp('(?:async )?function ' + fn + '\\([^)]*\\) ?\\{[\\s\\S]*?\\n\\}'));
    ok(n + '. (controle) `' + fn + '` continua no arquivo e usa o par', !!corpo
      && (/hdr\(\)/.test(corpo) || /esc\(/.test(corpo)), corpo.slice(0, 60)); n++;
  }
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
