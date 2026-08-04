// SUITE testa_mono_x_combo — MONODROGA NAO PODE RECEBER ASSOCIACAO.
//
// O CASO REAL (bug #4 da proposta 68036): a linha "56 HIDROCLOROTIAZIDA 12,5MG CPR" recebia
// "LOSARTANA POTASSICA HIDROCLOROTIAZIDA 50/12,5MG 60 COMPRIMIDOS" — outro medicamento, com uma
// droga a mais que o paciente nao deveria tomar. Erro de dose aparece no total; erro de
// PRINCIPIO ATIVO chega no paciente.
//
// POR QUE ESCAPAVA: a linha nao tem '+' em lugar nenhum e tem principio_ativo VAZIO, entao a
// barreira de combo (que le o '+' do PA) nao a via. E a dose lida era so "12,5MG" — o "50/"
// ficava orfao — que bate exatamente com a do pedido. Duas defesas cegas ao mesmo tempo.
// O CONSERTO NAO E UMA BARREIRA NOVA: e ler os dois numeros da dose. Com {50MG, 12.5MG} contra
// {12.5MG}, a barreira de dose que ja existia rejeita sozinha.
//   node tests/testa_mono_x_combo.js
const fs = require('fs'), path = require('path');
const lines = fs.readFileSync(path.join(__dirname, '..', 'fpmed_giovana.html'), 'utf8').split(/\r?\n/);
function block(a, b) {
  const s = lines.findIndex(l => l.includes(a));
  let e = -1; for (let i = s + 1; i < lines.length; i++) { if (lines[i].includes(b)) { e = i; break; } }
  return lines.slice(s, e).join('\n');
}
const ctx = (new Function('let cotacoes=[];let _bmCmed=new Map();let _bmClasseB=new Set();console.warn=function(){};\n'
  + block('function _undNum(und)', 'let searchTO') + '\n'
  + block('const _bmStrip = s =>', '/* ─── busca antiga') + '\n'
  + 'return { api:{ buscarMelhorProduto, _bmDoses }, setCot:function(a){cotacoes=a;} };'))();
const { buscarMelhorProduto, _bmDoses } = ctx.api;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e != null ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_mono_x_combo — monodroga x associacao\n');

const R = (produto, o) => Object.assign({ produto, principio_ativo: '', und: '', compra_unit: '10.00',
  global_venda1: '', tipo: 'fornecedor', fornecedor: 'FORN_A', estoque: '0' }, o || {});
const busca = (cot, q) => { ctx.setCot(cot); return buscarMelhorProduto(q); };
const nome = r => r ? r.produto : null;
const dz = t => [..._bmDoses(t)].sort();

// ══════════ A DOSE DUPLA COM BARRA E UMA ASSOCIACAO ══════════
{
  ok('1. *** "50/12,5MG" sao DUAS doses, nao uma ***',
    dz('LOSARTANA POTASSICA HIDROCLOROTIAZIDA 50/12,5MG 60 COMPRIMIDOS').join() === ['12.5MG', '50MG'].sort().join(),
    dz('LOSARTANA POTASSICA HIDROCLOROTIAZIDA 50/12,5MG 60 COMPRIMIDOS'));
  ok('2. "100/25MG" tambem', dz('LOSARTANA + HIDROCLOROTIAZIDA 100/25MG C/30 COMPRIMIDOS EMS').join()
    === ['100MG', '25MG'].sort().join(), dz('LOSARTANA + HIDROCLOROTIAZIDA 100/25MG C/30'));
  ok('3. e "20/12,5MG" do enalapril', dz('ENALAPRIL HIDROCLOROTIAZIDA 20/12,5MG C/30').join()
    === ['12.5MG', '20MG'].sort().join(), dz('ENALAPRIL HIDROCLOROTIAZIDA 20/12,5MG C/30'));
  ok('4. a monodroga continua com UMA dose so', dz('HIDROCLOROTIAZIDA 12,5MG CPR').join() === '12.5MG',
    dz('HIDROCLOROTIAZIDA 12,5MG CPR'));
}

// ══════════ O CASO DA 68036, PALAVRA POR PALAVRA ══════════
{
  const combo = R('LOSARTANA POTASSICA HIDROCLOROTIAZIDA 50/12,5MG 60 COMPRIMIDOS', { fornecedor: 'SANTA CRUZ' });
  const pura  = R('HIDROCLOROTIAZIDA 25MG CX30 CPR', { principio_ativo: 'HIDROCLOROTIAZIDA' });
  const pura125 = R('HIDROCLOROTIAZIDA 12,5MG CX30 CPR', { principio_ativo: 'HIDROCLOROTIAZIDA' });

  ok('5. *** "HIDROCLOROTIAZIDA 12,5MG CPR" NAO pode receber o combo com losartana ***',
    nome(busca([combo], 'HIDROCLOROTIAZIDA 12,5MG CPR')) === null,
    nome(busca([combo], 'HIDROCLOROTIAZIDA 12,5MG CPR')));
  ok('6. *** nem quando o combo e a UNICA opcao (melhor nao vender do que vender outro remedio) ***',
    nome(busca([combo, R('OUTRA COISA 10MG')], 'HIDROCLOROTIAZIDA 12,5MG CPR')) === null);
  ok('7. e a hidroclorotiazida PURA de 12,5 casa normalmente',
    nome(busca([combo, pura125], 'HIDROCLOROTIAZIDA 12,5MG CPR')) === 'HIDROCLOROTIAZIDA 12,5MG CX30 CPR');
  ok('8. com as duas puras na mesa, a dose continua mandando (12,5 nao vira 25)',
    nome(busca([pura, pura125], 'HIDROCLOROTIAZIDA 12,5MG CPR')) === 'HIDROCLOROTIAZIDA 12,5MG CX30 CPR');
  ok('9. *** o combo com "+" no nome tambem fica fora ***',
    nome(busca([R('LOSARTANA + HIDROCLOROTIAZIDA 100/25MG C/30 COMPRIMIDOS EMS')], 'HIDROCLOROTIAZIDA 25MG CPR')) === null);
  ok('10. *** e o de enalapril ***',
    nome(busca([R('MALEATO ENALAPRIL HIDROCLOROTIAZIDA 20/12,5MG C/30 COMPRIMIDOS EMS')], 'HIDROCLOROTIAZIDA 12,5MG CPR')) === null);
}

// ══════════ QUEM PEDE A ASSOCIACAO CONTINUA RECEBENDO A ASSOCIACAO ══════════
// A barreira nao pode virar "combo nunca casa": quem escreve as duas doses quer as duas drogas.
{
  const combo = R('LOSARTANA POTASSICA HIDROCLOROTIAZIDA 50/12,5MG 60 COMPRIMIDOS');
  ok('11. *** pedido "LOSARTANA + HIDROCLOROTIAZIDA 50/12,5MG" casa o combo ***',
    nome(busca([combo], 'LOSARTANA + HIDROCLOROTIAZIDA 50/12,5MG')) === 'LOSARTANA POTASSICA HIDROCLOROTIAZIDA 50/12,5MG 60 COMPRIMIDOS');
  ok('12. e a PROPORCAO continua mandando: quem pede 50/12,5 nao recebe 100/25',
    nome(busca([R('LOSARTANA + HIDROCLOROTIAZIDA 100/25MG C/30')], 'LOSARTANA + HIDROCLOROTIAZIDA 50/12,5MG')) === null);
}

// ══════════ A DIPIRONA (a outra metade do bug #4) ══════════
// O pedido real e "43 DIPIRONA SODICA 500MG 2ML AMP". A forma tem que segurar o comprimido.
{
  const cpr = R('DIPIRONA MONOIDRATADA 500MG MEDLEY CAIXA 100 COMPRIMIDOS COM 10 BLIS');
  const amp = R('DIPIRONA 500MG/ML 2ML IM/IV 100 AMP GEN SANTISA', { principio_ativo: 'DIPIRONA' });
  ok('13. *** "DIPIRONA SODICA 500MG 2ML AMP" NAO pode receber comprimido ***',
    nome(busca([cpr], 'DIPIRONA SODICA 500MG 2ML AMP')) === null, nome(busca([cpr], 'DIPIRONA SODICA 500MG 2ML AMP')));
  ok('14. e recebe a ampola quando ela existe',
    nome(busca([cpr, amp], 'DIPIRONA SODICA 500MG/ML AMPOLA 2ML')) === 'DIPIRONA 500MG/ML 2ML IM/IV 100 AMP GEN SANTISA');
  ok('15. *** nem com o comprimido sendo a unica opcao ***',
    nome(busca([cpr, R('SORO FISIOLOGICO 0,9% 250ML')], 'DIPIRONA SODICA 500MG 2ML AMP')) === null);
}

// ══════════ O QUE NAO PODE QUEBRAR ══════════
// "/" aparece em muito lugar que NAO e associacao. Nenhum desses pode virar dose dupla.
{
  ok('16. "5MG/ML" continua uma concentracao, nao duas doses', dz('BROMOPRIDA 5MG/ML').join() === '5MG/ML');
  ok('17. "250MG/5ML" continua concentracao (dose por volume tem regra propria)',
    dz('CEFALEXINA 250MG/5ML SUSP').join() === '50MG/ML', dz('CEFALEXINA 250MG/5ML SUSP'));
  ok('18. "CX/50AMP" nao vira dose', dz('BROM. DE PANCURONIO 2MG/ML 2ML CRISTALIA CX/50AMP').join() === '2MG/ML',
    dz('BROM. DE PANCURONIO 2MG/ML 2ML CRISTALIA CX/50AMP'));
  ok('19. "200+40MG/5ML" continua saindo como os dois por-ml',
    dz('BACTRIM 200+40MG/5ML SUSP 100ML').join() === ['40MG/ML', '8MG/ML'].sort().join(),
    dz('BACTRIM 200+40MG/5ML SUSP 100ML'));
  ok('20. e o combo de metronidazol+nistatina (que o cliente PEDE como combo) segue casando',
    nome(busca([R('METRONIDAZOL 100MG/G + NISTATINA 20.000 UI/G CREME')], 'METRONIDAZOL+NISTATINA CREME VAG'))
    === 'METRONIDAZOL 100MG/G + NISTATINA 20.000 UI/G CREME');
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
