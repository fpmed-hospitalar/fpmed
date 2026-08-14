// SUITE testa_abastece_edital — o abastecimento de editais (fatia A6).
//
// == O QUE ELA GUARDA ==========================================================
// Tres coisas, e as tres ja custaram caro em algum lugar deste projeto:
//
//  1. QUE NAO EXISTA MODO "VARRE TUDO". A caixa proibe baixar em massa o Brasil
//     inteiro, e a porta que nao existe nao e esquecida num dia de pressa. Um
//     edital tem 2 a 12 MB; o indice vai a dezenas de milhares com a fatia A8.
//  2. QUE "NAO PUBLICOU" SEJA DIFERENTE DE "NAO CONSEGUI PERGUNTAR". Medido em
//     14/08: o PNCP responde 404 quando o orgao nao anexou nada. Tratar isso como
//     erro de rede faria a tela dizer "ainda nao coletei" para sempre sobre uma
//     licitacao que o PNCP JA respondeu que nao tem edital.
//  3. QUE PDF ESCANEADO NAO VIRE "EDITAL VAZIO". Documento que e uma FOTO nao tem
//     texto — e devolver string vazia como se o edital fosse vazio seria a mentira
//     mais cara desta fatia.
//
//   node tests/testa_abastece_edital.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const C = R('tools', 'coleta_editais.js');
const L = R('fpmed_licitacoes.html');
const DDL = R('ddl', 'licitacao_itens.sql');
const semCom = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const CODE = semCom(C), LCODE = semCom(L);

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_abastece_edital — o abastecimento (fatia A6)\n');

// ══════════ 1. NAO EXISTE "VARRE TUDO" ══════════
ok(n + '. *** as UNICAS portas sao --controle e --meus-negocios ***',
  /--controle/.test(CODE) && /--meus-negocios/.test(CODE)
  && !/--tudo|--todas|--brasil|--varrer/.test(CODE)); n++;
ok(n + '. *** sem uma das duas, ele RECUSA e explica (nao assume "tudo") ***',
  /if \(!controle && !meus\)/.test(CODE) && /process\.exit\(1\)/.test(CODE)); n++;
ok(n + '. ...e o motivo da proibicao esta escrito, com os numeros',
  /PROIBIDO baixar em massa/.test(C) && /2 a 12 MB/.test(C)); n++;
/* O TETO EXISTE E E NOMEADO. Sem ele, "--meus-negocios" num dia de funil cheio baixaria
   centenas de PDFs de uma vez. */
ok(n + '. ha um teto de licitacoes por rodada, e ele e uma constante lida do argumento',
  /const TETO = parseInt\(arg\('--teto'\) \|\| '20', 10\)/.test(CODE)); n++;

// ══════════ 2. OS TRES ESTADOS, QUE SAO TRES E NAO DOIS ══════════
/* MEDIDO em 14/08 com Jandaia/GO: o PNCP responde 404 quando nao ha arquivo. Eu tinha escrito
   esperando `[]`, e o caso mais comum do fallback honesto caia no balde de erro. */
ok(n + '. *** 404 do PNCP e "nao publicou arquivo", e NAO falha de rede ***',
  /if \(e\.status !== 404\)/.test(CODE) && /arqs = \[\];/.test(CODE)); n++;
ok(n + '. ...com o motivo medido escrito (o 404 real de Jandaia)',
  /MEDIDO em 14\/08 com uma licitação real de Jandaia\/GO/.test(C)); n++;
/* GRAVAR UMA LINHA PRO CASO SEM ARQUIVO E O QUE SEPARA OS DOIS ESTADOS. Sem ela, "nao publicou"
   e "nunca coletei" ficam indistinguiveis — e as acoes sao opostas (anexar a mao x ir buscar). */
ok(n + '. *** o caso SEM ARQUIVO grava uma linha com o motivo, em vez de nao gravar nada ***',
  /sem-arquivo:\/\/pncp/.test(CODE) && /o PNCP não publicou arquivo para esta licitação/.test(CODE)); n++;
ok(n + '. e a tela distingue os TRES estados (nunca coletado · sem arquivo · com texto)',
  /semArquivo:true/.test(LCODE) && /DET\.edital = null/.test(LCODE) && /ed\.texto/.test(LCODE)); n++;
ok(n + '. ...e diz coisas DIFERENTES em cada um (as acoes sao diferentes)',
  /Edital não publicado no PNCP/.test(L) && /Ainda não busquei o edital/.test(L)); n++;

// ══════════ 3. PDF ESCANEADO NAO VIRA EDITAL VAZIO ══════════
ok(n + '. *** menos de 200 chars por pagina e marcado como provavel PDF escaneado ***',
  /texto\.length < paginas \* 200/.test(CODE) && /provavelmente PDF escaneado/.test(CODE)); n++;
ok(n + '. ...e o motivo vai pro banco (`extracao_erro`), nao so pro console',
  /linha\.extracao_erro = `saiu quase sem texto/.test(CODE)); n++;
ok(n + '. ha teto de tamanho, e ele tambem registra o motivo em vez de estourar',
  /TETO_MB = 25/.test(CODE) && /acima do teto de \$\{TETO_MB\} MB/.test(CODE)); n++;

// ══════════ 4. SO O EDITAL E BAIXADO ══════════
/* Baixar os cinco arquivos multiplicaria banda e tempo por 5 pra guardar texto que ninguem vai
   perguntar — e daria tres documentos pra IA adivinhar qual responde. */
ok(n + '. *** so edital e termo de referencia sao baixados; o resto fica so com link e tipo ***',
  /const EH_EDITAL = t => \/edital\|termo de referência\|termo de referencia\/i/.test(CODE)
  && /if \(EH_EDITAL\(a\.tipoDocumentoNome\)\) \{/.test(CODE)); n++;
ok(n + '. o tipo vem do PNCP (`tipoDocumentoNome`), e nao de palpite nosso sobre o nome do arquivo',
  /tipoDocumentoNome/.test(CODE) && /é dado dele, não\s*inferência nossa/.test(C.replace(/\n\s*/g, ' '))); n++;

// ══════════ 5. O PDF INTEIRO NAO ENTRA NO BANCO ══════════
ok(n + '. *** a tabela guarda TEXTO e LINK, nunca o PDF ***',
  !/pdf_bytes|pdf_base64|arquivo_bin/.test(DDL) && /texto_extraido\s+text/.test(DDL)); n++;
ok(n + '. ...e o motivo esta escrito no DDL',
  /O PDF INTEIRO \*\*NÃO\*\* ENTRA AQUI|PDF INTEIRO/.test(DDL)); n++;

// ══════════ 6. RE-RODAR NAO DUPLICA ══════════
/* ══ ESTE ASSERT PASSOU VERDE NUMA MUTACAO QUE DEVIA TE-LO MATADO ═══════════════════════════
   Ele procurava `resolution=merge-duplicates` em QUALQUER lugar do arquivo — e ha DUAS
   escritas na tabela (a do caso sem arquivo e a do lote). Mutei uma, a outra segurou o verde.
   E a mesma armadilha que ja me pegou na rodada da CMED, e a licao e sempre a mesma: assert
   que confere se o padrao EXISTE fica cego pra ocorrencia que nao tem.
   >>> AGORA ELE PROCURA CADA ESCRITA E COBRA UMA POR UMA — e passa a cobrir sozinho a terceira,
       no dia em que ela existir. Sem o upsert, re-rodar a coleta do mesmo edital duplicaria a
       linha e a tela passaria a ver dois editais onde ha um. */
(function () {
  /* A JANELA OLHA PRA FRENTE a partir de cada escrita, e nao tenta casar o bloco inteiro: as
     duas chamadas tem formatacao diferente e o `body` de uma tem chaves aninhadas, entao um
     regex de bloco casa uma e perde a outra — que foi exatamente o que aconteceu na 1a versao
     deste assert, e ele acusou "1 escrita" quando ha duas. */
  const alvos = [...CODE.matchAll(/rest\/v1\/licitacao_arquivos`,\s*\{/g)];
  const escritas = alvos.map(m => CODE.slice(m.index, m.index + 220));
  const semUpsert = escritas.filter(e => !/resolution=merge-duplicates/.test(e));
  ok(n + '. *** TODA escrita na licitacao_arquivos e upsert — re-rodar REESCREVE, nao duplica ***',
    escritas.length >= 2 && semUpsert.length === 0,
    { escritas: escritas.length, semUpsert: semUpsert.length }); n++;
})();
ok(n + '. ...e a chave unica que sustenta o upsert existe no DDL',
  /unique index if not exists licitacao_arquivos_chave/.test(DDL)); n++;
/* O PostgREST recusa lote com objetos de chaves diferentes (PGRST102). So as linhas de EDITAL
   ganham texto — entao o lote PRECISA ser normalizado. */
ok(n + '. *** todas as linhas do lote levam as MESMAS chaves (PGRST102) ***',
  /const CAMPOS = \[/.test(CODE) && /\(c in l\) \? l\[c\] : null/.test(CODE)); n++;

// ══════════ 7. A TELA PEGA O MAIOR TEXTO, E NAO O PRIMEIRO ══════════
/* Medido num caso real: o edital deu 71.105 chars e o termo de referencia 173.557 — e e no TR
   que costuma estar a tabela de itens. "O primeiro que tiver texto" entregaria o menor por
   acaso de ordenacao. */
ok(n + '. *** a tela usa o MAIOR texto entre os arquivos, nao o primeiro ***',
  /sort\(\(a,b\) => \(b\.texto_chars\|\|0\) - \(a\.texto_chars\|\|0\)\)/.test(LCODE)); n++;
ok(n + '. ...com a medicao registrada (edital 71.105 x TR 173.557)',
  /71\.105 chars e o termo de\s*referência 173\.557/.test(L.replace(/\n\s*/g, ' '))); n++;

// ══════════ 8. O AVISO DE CUSTO CHEGA ANTES DO CLIQUE ══════════
ok(n + '. *** o estado do edital aparece AO LADO do botao, antes de gastar ***',
  /páginas pronto para leitura/.test(L) && /o aviso que chega depois do clique chega depois do gasto/i.test(L.replace(/\n\s*/g, ' '))); n++;
ok(n + '. e o selo IA acompanha o botao que dispara o gasto',
  /Conversar com o edital <span class="lm-selo-ia">IA<\/span>/.test(L)); n++;
ok(n + '. a tela carrega o motor do leitor (senao o botao chama funcao que nao existe)',
  /<script src="fpmed_leitor_motor\.js"><\/script>/.test(L)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
