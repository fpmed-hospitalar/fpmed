// SUITE testa_contrato_itens — o contrato entre a Encontrar (A) e o Negocios (B).
//
// == POR QUE ELA EXISTE ========================================================
// O `docs/contrato_itens_editais.md` e a UNICA coisa que a outra janela le pra se
// ligar ao que esta tela produz. Documento e codigo divergindo em silencio e a
// forma mais cara de quebrar duas frentes de uma vez: o B escreve contra o que
// esta escrito, o A muda o que esta no codigo, e ninguem descobre ate alguem
// clicar "adicionar aos meus negocios" e o assistente abrir vazio — sem erro, sem
// aviso, sem nada pra investigar.
//
// >>> ENTAO ESTA SUITE MEDE OS DOIS LADOS CONTRA O MESMO FATO. Nao basta o
//     documento dizer `?adicionar=`; a tela tem que enviar `?adicionar=`. Nao
//     basta a tela mandar o `numero_controle`; o documento tem que prometer o
//     `numero_controle`.
//
//   node tests/testa_contrato_itens.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const DOC = R('docs', 'contrato_itens_editais.md');
const L = R('fpmed_licitacoes.html');
const DDL = R('ddl', 'licitacao_itens.sql');
const MOTOR = R('fpmed_leitor_motor.js');
const semCom = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const LIMPO = semCom(L);

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_contrato_itens — o contrato A <-> B\n');

// ══════════ 1. O DOCUMENTO EXISTE E COBRE OS CINCO PONTOS PEDIDOS ══════════
for (const [tema, re] of [
  ['1) onde vivem os itens de cada licitacao', /licitacao_itens/],
  ['2) o parametro ?adicionar=<id>&itens=<ids>', /\?adicionar=/],
  ['3) como chamar o leitor internamente', /LeitorEdital\.perguntar/],
  ['4) texto extraido e link do PDF', /licitacao_arquivos[\s\S]*texto_extraido/],
  ['5) onde fica o resultado por item', /resultado_vencedor/],
]) { ok(n + '. o contrato cobre ' + tema, re.test(DOC)); n++; }

// ══════════ 2. OS DOIS LADOS CONCORDAM SOBRE A CHAVE ══════════
/* A chave e `numero_controle`, e nao o `id`, porque a tela mostra licitacao de DUAS fontes: o
   nosso indice (tem id) e o PNCP ao vivo (nao tem linha nenhuma aqui). */
ok(n + '. *** o documento promete `numero_controle` como chave ***',
  /numero_controle.*, nunca o `id`|A chave: `numero_controle`/.test(DOC)); n++;
/* ══ A ANCORA MUDOU DE ENDERECO NA FATIA A21, E O QUE ELA PROTEGE NAO MUDOU ══════════════════
   O assert cobrava a linha DENTRO do `mandarDetalheProFunil`. Na A21 o CARTAO passou a oferecer
   a mesma acao ("Adicionar aos meus negocios") e a montagem do endereco virou UMA funcao,
   `irProNegocios` — porque duas montagens do mesmo endereco e como o `&itens=` some de um dos
   lados sem ninguem perceber.
   >>> ENTAO O QUE ELE COBRA AGORA E A FUNCAO UNICA: a chave continua sendo o numeroControlePNCP,
       e continua sendo a UNICA. Um assert amarrado ao nome da funcao antiga teria ficado
       vermelho por uma mudanca que melhora exatamente o que ele guarda. */
ok(n + '. *** e a tela ENVIA o numeroControlePNCP, e nao outra chave ***',
  /adicionar=' \+ encodeURIComponent\(id\)/.test(LIMPO)
  && /const id = String\(\(l && l\.numeroControlePNCP\) \|\| ''\)\.trim\(\)/.test(LIMPO)); n++;
ok(n + '. ...e ha UMA montagem so do endereco (o cartao e o detalhe passam pela mesma funcao)',
  (LIMPO.match(/adicionar=' \+ encodeURIComponent/g) || []).length === 1
  && /function irProNegocios\(l, itens\)/.test(LIMPO)
  && /irProNegocios\(DET\.lic, detItensMarcados\(\)\)/.test(LIMPO)); n++;
/* ESTE ASSERT NASCEU DE UM DEFEITO MEU: eu tinha deixado um fallback pro `chaveLic`
   (cnpj/ano/sequencial). Uma chave de outro formato chega no outro lado como "nao encontrei
   esta licitacao" — sem erro e sem aviso, so um assistente que abre vazio. */
ok(n + '. *** sem numero de controle a tela DIZ que nao da, em vez de navegar torto ***',
  /* O QUE NAO PODE EXISTIR E O FALLBACK PRA `chaveLic` DENTRO DA PONTE — nao a palavra
     `chaveLic` no arquivo inteiro. Ela e a chave do cache de itens desde sempre (`_numCtrl` do
     jornal usa, e a A21 passou a usa-la pra INVALIDAR o cache no "buscar os itens agora"). Um
     assert que proibisse o nome no arquivo todo ficaria vermelho por usos que nao tem nada a
     ver com o que ele guarda — entao ele olha DENTRO da funcao da ponte, e so ela. */
  (() => {
    const i = LIMPO.indexOf('function irProNegocios(l, itens){');
    if (i < 0) return false;
    const corpo = LIMPO.slice(i, LIMPO.indexOf('\n}', i));
    // a funcao NAO navega sem a chave: devolve `false`, e quem chamou e que fala com a tela
    return !/chaveLic/.test(corpo) && /if\(!id\) return false;/.test(corpo);
  })()
  && /não trouxe o número de controle do PNCP/.test(L)); n++;
ok(n + '. o `itens` vai separado por virgula, como o documento diz',
  /itens=' \+ encodeURIComponent\(itens\.join\(','\)\)/.test(LIMPO)
  && /separados por vírgula/.test(DOC)); n++;
/* "SEM ITENS" SIGNIFICA O PREGAO INTEIRO, e nao "nenhum item". O documento diz isso porque a
   leitura contraria criaria negocio sem item nenhum e ninguem entenderia por que. */
/* O TEXTO CORRIDO DO MARKDOWN QUEBRA LINHA ONDE ELE QUISER, e o assert nao pode depender de
   onde a linha quebrou — senao reformatar o paragrafo deixa a suite vermelha sem nada ter
   piorado. Mede-se o documento com o espaco em branco normalizado. */
const DOC1 = DOC.replace(/\s+/g, ' ');
ok(n + '. e o documento diz o que significa vir SEM `itens` (o pregao inteiro)',
  /o pregão inteiro.{0,20}e não “nenhum item”/.test(DOC1)); n++;

// ══════════ 3. O ESQUEMA E ADITIVO, E A CHAVE UNICA EXISTE ══════════
/* ESTE ASSERT NASCEU VERMELHO LENDO O PROPRIO COMENTARIO DO DDL, que diz "zero DELETE, zero
   DROP" — a lapide honesta que TEM que citar o que nao faz. 3a vez que isto me morde nesta
   caixa. Assert de ausencia le CODIGO, nunca prosa: senao explicar bem uma proibicao passa a
   quebrar a suite, e a saida facil vira apagar a explicacao. */
const SQL = DDL.replace(/--.*$/gm, '');
ok(n + '. *** o DDL e 100% ADITIVO (zero DROP TABLE, zero DELETE, zero TRUNCATE) ***',
  !/drop\s+table/i.test(SQL) && !/\bdelete\b/i.test(SQL) && !/truncate/i.test(SQL)
  /* `drop policy if exists` ANTES do `create policy` E aditivo e e o padrao do projeto: ele
     derruba a policy que ele mesmo cria, pra poder recriar. Nao e drop de dado nem de tabela. */
  && /drop policy if exists/i.test(SQL)); n++;
ok(n + '. *** ha chave unica por (licitacao, item) — senao releitura duplica o edital ***',
  /unique index if not exists licitacao_itens_chave[\s\S]{0,120}\(numero_controle, numero_item\)/.test(DDL)); n++;
/* O PNCP manda "1", "01" e "1.1". Inteiro perderia o "1.1" e fundiria "01" com "1" — a colisao
   que a chave unica existe pra impedir. */
ok(n + '. *** `numero_item` e TEXTO, e o motivo esta escrito ***',
  /numero_item\s+text\s+not null/.test(DDL) && /"1\.1"/.test(DDL) && /é TEXTO, e isso não é descuido/.test(DOC)); n++;
ok(n + '. o resultado por item mora na propria tabela do item, com o motivo escrito',
  /resultado_vencedor/.test(DDL) && /atributos DO MESMO ITEM/.test(DDL)); n++;
ok(n + '. *** e NULL no resultado e "ainda nao sei", nao "nao ganhei" ***',
  /NULL É "AINDA NÃO SEI", E NÃO "NÃO GANHEI"/.test(DDL) && /ainda não sei/.test(DOC)); n++;

// ══════════ 4. O MOTOR DO LEITOR, COMO O CONTRATO PROMETE ══════════
ok(n + '. o contrato promete as tres marcas de erro, e o motor as poe',
  /semPermissao/.test(DOC) && /semSessao/.test(DOC) && /semTexto/.test(DOC)
  && /semPermissao = true/.test(MOTOR) && /semSessao = true/.test(MOTOR) && /semTexto = true/.test(MOTOR)); n++;
/* O CONTRATO PROIBE O OUTRO LADO DE ESCREVER SUA PROPRIA CHECAGEM. Duas respostas pra "quem
   pode gastar?" um dia discordam, num numero que vira fatura. */
ok(n + '. *** o contrato PROIBE segunda checagem de permissao/custo do outro lado ***',
  /Não escreva uma segunda checagem de permissão nem uma segunda conta de custo/.test(DOC)); n++;
ok(n + '. ...e diz onde os tres moram de verdade (edge function, servidor)',
  /edge function `ler-edital`/.test(DOC) && /usos_ia/.test(DOC)); n++;

// ══════════ 5. O DOCUMENTO NAO PROMETE O QUE NAO EXISTE ══════════
/* ══ REAPONTADO NA FATIA A7 ═══════════════════════════════════════════════════════════════
   Ele cobrava a palavra "vazia". As tabelas DEIXARAM de estar vazias quando as fatias A6 e A7
   rodaram — entao o assert passou a exigir que o documento mentisse ao contrario.
   >>> O QUE ELE PROTEGIA E ATEMPORAL, e e isso que ele cobra agora: o contrato tem que declarar
       o ESTADO REAL das tabelas, com numero medido. Documento que descreve o futuro como
       presente e pior que documento nenhum — o outro lado escreve contra uma tabela cheia e
       recebe vazio. Documento que descreve o passado como presente e o mesmo erro ao contrario.
   >>> E ELE COBRA O LIMITE JUNTO: as tabelas sao abastecidas SOB DEMANDA, entao elas nunca tem
       o Brasil inteiro. Quem ler o contrato sem essa frase vai supor cobertura total e
       concluir "esta licitacao nao existe" quando a verdade e "ninguem pediu ela ainda". */
ok(n + '. *** o contrato declara o ESTADO REAL das tabelas, com numero medido ***',
  /195 itens/.test(DOC) && /192/.test(DOC)); n++;
ok(n + '. *** ...e avisa que o abastecimento e SOB DEMANDA, nunca o Brasil inteiro ***',
  /sob demanda\*\*, nunca em massa|abastecidas \*\*sob demanda\*\*/.test(DOC)
  && /e não o Brasil inteiro/.test(DOC)); n++;
ok(n + '. e ele diz o que JA DA pra usar hoje, item a item',
  /Resumo do que já dá para usar hoje/.test(DOC)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
