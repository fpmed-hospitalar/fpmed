// ============================================================================================
// confere_spec.js — o docs/spec_reforma_prime.md afirma o que a FPMED JA TEM. Este script roda
// cada afirmacao contra o CODIGO, e nao contra a memoria.
//
// POR QUE ELE EXISTE: na 1a versao do spec eu escrevi que a proposta exporta Excel. Nao exporta
// — ela gera PDF por impressao do navegador. Um spec que afirma o que o produto NAO tem e pior
// que spec nenhum: ele vira a base de uma promessa comercial, e quem descobre e o cliente.
//
// >>> RODE ANTES DE MOSTRAR O SPEC PRA ALGUEM, e sempre que um item da fila entrar no ar (a
//     linha da tabela muda de ⚠️ pra ✅, e este script e quem diz que pode mudar).
//
//   node tools/confere_spec.js
// ============================================================================================
const fs = require('fs');
const L = f => { try { return fs.readFileSync('C:/fpmed/' + f, 'utf8'); } catch (e) { return ''; } };
const diz = (o, c) => console.log('  ' + (c ? '✅' : '❌') + ' ' + o);
console.log('CONFERINDO O QUE O SPEC AFIRMA QUE A FPMED TEM:\n');

const NEG = L('fpmed_negocios.html'), LIC = L('fpmed_licitacoes.html');
const GIO = L('fpmed_giovana.html'), CONF = L('fpmed_conferidor.html');
const DOC = L('fpmed_documentos.html'), DEC = L('fpmed_declaracoes.html');
const IA = L('fpmed_edital_ia.html'), FN = L('supabase/functions/ler-edital/index.ts');

diz('multi-empresa: seletor "Todas as empresas"', NEG.includes('Todas as empresas'));
diz('multi-empresa: badge de empresa no card', NEG.includes('class="emp"'));
diz('dados timbrados saem do config (CNPJ derivado)', L('cliente.config.js').includes('CFG.empresa.pixChave = chave'));
diz('busca nacional no PNCP', LIC.includes('function buscarNacional'));
diz('kanban com arrasta-solta', NEG.includes('ligarArrasto'));
diz('radar (tela existe)', LIC.includes('function rodarRadar'));
diz('documentos: alerta de vencimento', DOC.length > 0 && NEG.includes("d.situacao === 'vencido'"));
diz('proposta: ponte edital->proposta', GIO.includes('function importarPedidoEdital'));
diz('proposta: PDF timbrado (por impressao do navegador)', GIO.includes('function gerarPDF()') && GIO.includes('window.print()'));
diz('proposta: export Excel  <-- NAO TEM, e eu tinha escrito que tinha', GIO.includes('XLSX') || GIO.includes('xlsx'));
diz('leitor IA: leitura em partes', IA.includes('function partirPorPagina'));
diz('leitor IA: extracao de itens', FN.includes('PERGUNTA_ITENS'));
diz('leitor IA: contador de custo', FN.includes('registra_uso_ia'));
diz('declaracoes: a tela existe', DEC.length > 0);
diz('lembretes com prioridade', NEG.includes("id=\"lem-prio\""));
diz('trava CMED com vigencia dita', CONF.includes('function frasePelaRegua'));
diz('credenciamento com trilha por trigger', L('ddl/credenciamentos.sql').includes('cred_historia_t'));
diz('preco sempre unitario', GIO.includes('unitario') || CONF.includes('unitario'));

console.log('\nO QUE O SPEC DIZ QUE FALTA (tem que dar ❌ mesmo):');
diz('puxador por ID da compra JA existe?', GIO.includes('ID da compra'));
diz('desconto em lote JA existe?', GIO.includes('desconto em lote') || GIO.includes('margem de desconto'));
// (o PDF timbrado saiu desta lista: ele JA EXISTE, e ficar aqui como "falta" seria o mesmo erro
//  ao contrario. O que falta de verdade e o Excel, e ele esta na lista de cima.)
diz('ZIP dos documentos JA existe?', DOC.includes('ZIP') || DOC.includes('zip'));
diz('etapas renomeaveis por config JA existem?', NEG.includes('FASES_CONFIG') || NEG.includes('rotuloConfig'));
diz('raio por lat/long JA existe?', LIC.includes('haversine') || LIC.includes('lat_long'));
