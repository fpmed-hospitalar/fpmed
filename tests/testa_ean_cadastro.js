// SUITE testa_ean_cadastro — EAN SUGERIDO ERRADO É PIOR QUE EAN NENHUM.
//
// O EAN é o PRIMEIRO degrau do teto CMED (EAN -> registro -> substância+dose). Um EAN errado
// não dá erro em lugar nenhum: ele casa com OUTRO produto e devolve um teto com cara de certo.
// Teto errado em licitação vira glosa. Por isso esta suíte não testa "achou o EAN" — ela testa,
// principalmente, que a tela SE RECUSA a afirmar quando a CMED não é unânime.
//
// ── O ACHADO QUE DESENHOU O CASAMENTO (medido em 14/08 contra o banco real) ─────────────────
// O caminho óbvio era casar `cotacoes.marca` com `cmed_regua.marca_norm`. Deu 10 linhas de
// 8.832 — porque os dois campos não falam da mesma coisa: `cotacoes.marca` guarda o
// LABORATÓRIO ("HIPOLABOR", "TEUTO") e `marca_norm` é o nome comercial da planilha da CMED
// ("DOPACRIS", "NOVALGINA"). O casamento honesto é SUBSTÂNCIA + DOSE + LABORATÓRIO.
//
//   node tests/testa_ean_cadastro.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_sistema_final.html'), 'utf8');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_ean_cadastro — EAN e registro ANVISA no cadastro de produtos\n');

// ── as funções REAIS da tela, recortadas por âncora (não recopiadas) ───────────────────────
const L = src.split(/\r?\n/);
const bloco = (de, ate) => {
  const s = L.findIndex(x => x.includes(de));
  if (s < 0) throw new Error('âncora inicial sumiu: ' + de);
  let e = -1;
  for (let i = s + 1; i < L.length; i++) if (L[i].includes(ate)) { e = i; break; }
  if (e < 0) throw new Error('âncora final sumiu: ' + ate);
  return L.slice(s, e).join('\n');
};
const T = new Function(
  bloco('function _gmNorm(s)', 'var _GM_SAL_RE') + '\n' +
  bloco('var _GM_SAL_RE', 'var _GM_MATCAT_RE') + '\n' +
  bloco('function doseKey(produto)', '// Chave de agrupamento') + '\n' +
  bloco('function _undNum(und)', 'function qtdEmbalagem(') + '\n' +
  bloco('function _eanDigitos(s)', '// ── A CAIXA DE SUGESTÃO DO CADASTRO') + '\n' +
  'return { normPA, doseKey, eanDigitoConfere, eanLabCasa, escolheSugestaoCmed, _eanDigitos, _eanLabTokens };'
)();

// ══════════ 1. DÍGITO VERIFICADOR — a única conferência que dá pra fazer sem perguntar a ninguém ══════════
{
  // EANs REAIS, copiados da cmed_regua deste banco
  ok('1. EAN real da CMED passa (7896112110347 — aminofilina Teuto)', T.eanDigitoConfere('7896112110347'));
  ok('2. EAN real da CMED passa (7891317435936 — cilostazol Eurofarma)', T.eanDigitoConfere('7891317435936'));
  ok('3. EAN real da CMED passa (7898122910313 — cimetidina Hypofarma)', T.eanDigitoConfere('7898122910313'));
  // um dígito trocado é o erro de digitação mais comum, e é exatamente o que o mod-10 pega
  ok('4. *** um dígito trocado NÃO passa (7896112110447) ***', !T.eanDigitoConfere('7896112110447'));
  ok('5. dígito verificador errado no fim não passa', !T.eanDigitoConfere('7896112110348'));
  ok('6. comprimento fora de 8/12/13/14 não passa (12 dígitos a menos)', !T.eanDigitoConfere('789611211034'));
  ok('7. vazio não passa (e não estoura)', !T.eanDigitoConfere(''));
  ok('8. nulo não passa (e não estoura)', !T.eanDigitoConfere(null));
  ok('9. aceita EAN escrito com separadores (só os dígitos importam)', T.eanDigitoConfere('7896-1121-10347'));
  ok('10. GTIN-8 válido passa (40170725)', T.eanDigitoConfere('40170725'));
}

// ══════════ 2. LABORATÓRIO — o nome curto do nosso cadastro x a razão social da CMED ══════════
{
  ok('11. *** "TEUTO" casa com "LABORATORIO TEUTO BRASILEIRO S/A" (o nome NÃO é o começo) ***',
    T.eanLabCasa('TEUTO', 'LABORATORIO TEUTO BRASILEIRO S/A'));
  ok('12. "EMS" casa com "EMS S/A"', T.eanLabCasa('EMS', 'EMS S/A'));
  ok('13. "CRISTALIA" casa com "CRISTÁLIA PRODUTOS QUÍMICOS FARMACÊUTICOS LTDA." (acento não atrapalha)',
    T.eanLabCasa('CRISTALIA', 'CRISTÁLIA PRODUTOS QUÍMICOS FARMACÊUTICOS LTDA.'));
  ok('14. "UNIAO QUIMICA" casa com "UNIÃO QUÍMICA FARMACÊUTICA NACIONAL S/A" (dois tokens)',
    T.eanLabCasa('UNIAO QUIMICA', 'UNIÃO QUÍMICA FARMACÊUTICA NACIONAL S/A'));
  ok('15. "HYPOFARMA" casa com "HYPOFARMA - INSTITUTO DE HYPODERMIA E FARMÁCIA LTDA"',
    T.eanLabCasa('HYPOFARMA', 'HYPOFARMA - INSTITUTO DE HYPODERMIA E FARMÁCIA LTDA'));
  ok('16. *** laboratório diferente NÃO casa ***', !T.eanLabCasa('MEDQUIMICA', 'EUROFARMA LABORATORIOS S.A.'));
  ok('17. marca vazia não casa com ninguém (senão casaria com todo mundo)', !T.eanLabCasa('', 'EMS S/A'));
  ok('18. *** só palavra-de-enfeite não casa: "LABORATORIO" sozinho não identifica ninguém ***',
    !T.eanLabCasa('LABORATORIO', 'LABORATORIO TEUTO BRASILEIRO S/A'));
  ok('19. "EMS GENERICO" não casa com "EMS S/A" — sobra token que a CMED não confirma',
    !T.eanLabCasa('EMS GENERICO', 'EMS S/A'));
}

// ── linhas REAIS da cmed_regua deste banco (conferidas à mão em 14/08) ─────────────────────
const CMED = {
  aminofilina: [{ subst_norm:'AMINOFILINA', dose_key:'100MG', qtd_apres:20, ean1:'7896112110347',
                  registro:'1037004450021', laboratorio:'LABORATORIO TEUTO BRASILEIRO S/A',
                  apresentacao:'100 MG COM CT  BL AL PLAS PVC TRANS X 20' }],
  cilostazol: [
    { subst_norm:'CILOSTAZOL', dose_key:'50MG', qtd_apres:30, ean1:'7891317435936',
      registro:'1004309920025', laboratorio:'EUROFARMA LABORATORIOS S.A.',
      apresentacao:'50 MG COM CT BL AL PLAS PVC/PVDC TRANS X 30' },
    { subst_norm:'CILOSTAZOL', dose_key:'50MG', qtd_apres:60, ean1:'7891317452254',
      registro:'1004309920033', laboratorio:'EUROFARMA LABORATORIOS S.A.',
      apresentacao:'50 MG COM CT BL AL PLAS PVC/PVDC TRANS X 60' }],
  dopamina: [
    { subst_norm:'CLORIDRATO DE DOPAMINA', dose_key:'5MG/ML+10ML', qtd_apres:100, ean1:'7898123906384',
      registro:'1134301160046', laboratorio:'HIPOLABOR FARMACEUTICA LTDA',
      apresentacao:'5 MG/ML SOL INJ CX 100 AMP VD AMB X 10 ML' },
    { subst_norm:'CLORIDRATO DE DOPAMINA', dose_key:'5MG/ML+10ML', qtd_apres:50, ean1:'7896112190745',
      registro:'1037003950047', laboratorio:'LABORATORIO TEUTO BRASILEIRO S/A',
      apresentacao:'5 MG/ML SOL DIL INFUS CX 50 AMP VD AMB X 10 ML' }]
};

// ══════════ 3. O CASAMENTO QUE ACERTA (os 3 conferidos à mão contra a cmed_regua) ══════════
{
  const s = T.escolheSugestaoCmed({ produto:'G AMINOFILINA 100MG CX 20COMP', marca:'TEUTO', principio_ativo:'AMINOFILINA' }, CMED.aminofilina);
  ok('20. *** aminofilina Teuto: EAN 7896112110347 ***', s.ean === '7896112110347', s);
  ok('21. ...com o registro junto', s.registro === '1037004450021', s.registro);
  ok('22. ...e a apresentação, pra quem confere não ter que ir na planilha', /X 20/.test(s.apresentacao), s.apresentacao);
  ok('23. ...sem motivo de recusa, porque não houve recusa', s.motivo === '', s.motivo);

  const c = T.escolheSugestaoCmed({ produto:'CIMETIDINA INJ.150MG/ML 100X2ML(HYCIMET)', marca:'HYPOFARMA', principio_ativo:'CIMETIDINA' },
    [{ subst_norm:'CIMETIDINA', dose_key:'150MG/ML+2ML', qtd_apres:100, ean1:'7898122910313', registro:'1038700250029',
       laboratorio:'HYPOFARMA - INSTITUTO DE HYPODERMIA E FARMÁCIA LTDA', apresentacao:'150 MG/ML SOL INJ CX 100 AMP VD AMB X 2 ML' }]);
  ok('24. *** cimetidina Hypofarma: EAN 7898122910313 (dose com volume, 150MG/ML+2ML) ***', c.ean === '7898122910313', c);

  // o PA do nosso cadastro vem SEM o sal; o da CMED vem COM ele. Sem normalizar os dois, nada casa.
  const d = T.escolheSugestaoCmed({ produto:'CLORIDRATO DE DOPAMINA 5 MG/ML 100AMP 10ML (G)', marca:'HIPOLABOR', principio_ativo:'DOPAMINA' }, CMED.dopamina);
  ok('25. *** "DOPAMINA" casa com "CLORIDRATO DE DOPAMINA" da CMED (o sal é tirado dos dois lados) ***',
    d.ean === '7898123906384', d);
}

// ══════════ 4. O DESEMPATE PELA EMBALAGEM ESCRITA NO NOME ══════════
// O cilostazol da Eurofarma tem DUAS apresentações na mesma dose (30 e 60 comprimidos), com EANs
// diferentes. Sem este desempate ele cairia na pendência; com ele, o "CX 30COMP" do nome resolve.
{
  const s30 = T.escolheSugestaoCmed({ produto:'G CILOSTAZOL 50MG CX 30COMP', marca:'EUROFARMA', principio_ativo:'CILOSTAZOL' }, CMED.cilostazol);
  ok('26. *** "CX 30COMP" escolhe a embalagem de 30 (EAN 7891317435936) ***', s30.ean === '7891317435936', s30);
  const s60 = T.escolheSugestaoCmed({ produto:'G CILOSTAZOL 50MG CX 60COMP', marca:'EUROFARMA', principio_ativo:'CILOSTAZOL' }, CMED.cilostazol);
  ok('27. ...e "CX 60COMP" escolhe a de 60 (EAN 7891317452254) — não é sempre a primeira', s60.ean === '7891317452254', s60);
  ok('28. *** os dois EANs são DIFERENTES: sem o desempate, um dos dois estaria errado ***',
    s30.ean !== s60.ean && s30.ean && s60.ean);

  // sem quantidade no nome não há o que desempatar — e aí a resposta certa é "não sei"
  const sSem = T.escolheSugestaoCmed({ produto:'CILOSTAZOL 50MG', marca:'EUROFARMA', principio_ativo:'CILOSTAZOL' }, CMED.cilostazol);
  ok('29. *** nome sem a embalagem: NÃO sugere EAN (2 candidatos, e chutar seria mentir) ***', sSem.ean === '', sSem);
  ok('30. ...e o motivo diz o que aconteceu, com o número de candidatos', /2 apresenta/.test(sSem.motivo), sSem.motivo);
  ok('31. ...e o registro também fica vazio, porque os dois registros também divergem', sSem.registro === '', sSem.registro);
  // quantidade que não existe em nenhuma candidata NÃO pode zerar o conjunto nem forçar escolha
  const sQ = T.escolheSugestaoCmed({ produto:'CILOSTAZOL 50MG CX 90COMP', marca:'EUROFARMA', principio_ativo:'CILOSTAZOL' }, CMED.cilostazol);
  ok('32. embalagem inexistente (90) não força escolha nem apaga as candidatas', sQ.ean === '' && sQ.candidatos === 2, sQ);
}

// ══════════ 5. AS RECUSAS — o coração desta fatia ══════════
{
  const mat = T.escolheSugestaoCmed({ produto:'LUVA P/ PROCEDIMENTO LATEX TAM. P COM PO C/100 UND', marca:'DESCARPACK', principio_ativo:'' }, CMED.aminofilina);
  ok('33. *** material sem princípio ativo: EAN vazio ***', mat.ean === '' && mat.registro === '', mat);
  ok('34. ...e o motivo explica que a CMED só conhece medicamento', /só conhece medicamento/.test(mat.motivo), mat.motivo);

  const lab = T.escolheSugestaoCmed({ produto:'G CILOSTAZOL 50MG CX 30COMP', marca:'MEDQUIMICA', principio_ativo:'CILOSTAZOL' }, CMED.cilostazol);
  ok('35. *** laboratório errado NÃO herda o EAN de outro fabricante ***', lab.ean === '', lab);
  ok('36. ...e o motivo nomeia o laboratório que não bateu', /MEDQUIMICA/.test(lab.motivo), lab.motivo);

  const dose = T.escolheSugestaoCmed({ produto:'AMINOFILINA 240MG CX 20COMP', marca:'TEUTO', principio_ativo:'AMINOFILINA' }, CMED.aminofilina);
  ok('37. *** dose diferente NÃO casa (240MG x 100MG) ***', dose.ean === '', dose);
  ok('38. ...e o motivo separa "não tem a substância" de "não tem nesta dose"', /nesta dose/.test(dose.motivo), dose.motivo);

  const nada = T.escolheSugestaoCmed({ produto:'ALBUMINA HUMANA 20% IV 50ML FRC/AMP', marca:'GRIFOLS', principio_ativo:'ALBUMINA HUMANA' }, CMED.aminofilina);
  ok('39. substância que não está na CMED: vazio, com o motivo certo', nada.ean === '' && /não tem esta substância/.test(nada.motivo), nada);

  ok('40. lista de candidatas vazia não estoura', T.escolheSugestaoCmed({ produto:'X', marca:'Y', principio_ativo:'Z' }, []).ean === '');
  ok('41. cotação nula não estoura', T.escolheSugestaoCmed(null, CMED.aminofilina).ean === '');
  ok('42. candidatas nulas não estouram', T.escolheSugestaoCmed({ produto:'X', principio_ativo:'AMINOFILINA' }, null).ean === '');
}

// ══════════ 6. O DEFEITO QUE A MEDIÇÃO EVITOU, RECONSTITUÍDO ══════════
// Casar `cotacoes.marca` (laboratório) com `cmed_regua.marca_norm` (nome comercial) acertava
// 10 linhas em 8.832. Este assert existe pra ninguém "simplificar" de volta pra lá.
{
  ok('43. *** o casamento NÃO usa marca_norm (o campo que parecia o certo e acertava 0,1%) ***',
    !/marca_norm/.test(bloco('function _eanDigitos(s)', '// ── A CAIXA DE SUGESTÃO DO CADASTRO')));
  ok('44. ...e usa laboratorio, subst_norm e dose_key, que é onde o dado realmente está',
    /laboratorio/.test(src) && /subst_norm/.test(src) && /dose_key/.test(src));
}

// ══════════ 7. A TELA ESTÁ MESMO LIGADA NISSO ══════════
{
  ok('45. o cadastro tem o campo EAN', /id="cot-ean"/.test(src));
  ok('46. o cadastro tem o campo Registro ANVISA', /id="cot-registro"/.test(src));
  ok('47. *** nenhum dos dois é obrigatório (nada de required) ***',
    !/id="cot-ean"[^>]*\brequired\b/.test(src) && !/id="cot-registro"[^>]*\brequired\b/.test(src));
  ok('48. o salvamento grava a coluna ean', /\bean:\s*_eanDig\s*\|\|\s*null/.test(src));
  ok('49. o salvamento grava registro_anvisa', /registro_anvisa:\s*_eanDigitos\(document\.getElementById\('cot-registro'\)/.test(src));
  ok('50. *** vazio vira NULL, não string vazia (NULL é "não sabemos"; "" parece resposta) ***',
    /\|\|\s*null\s*,?\s*$/m.test(src.match(/ean:\s*_eanDig\s*\|\|\s*null/)[0] + ',') );
  ok('51. EAN com dígito inválido AVISA antes de salvar', /eanDigitoConfere\(_eanDig\)[\s\S]{0,200}confirm\(/.test(src));
  ok('52. ...e o aviso não bloqueia: dá pra salvar assim mesmo', /OK = salvar assim mesmo[\s\S]{0,80}Cancelar = corrigir/.test(src));
  ok('53. os campos novos são limpos junto com os outros ao fechar o cadastro',
    /'cot-produto','cot-principio','cot-marca','cot-ean','cot-registro'/.test(src));
  ok('54. *** a sugestão NUNCA se grava sozinha: só um clique no botão preenche ***',
    /onclick="cotUsarSugestaoCmed\(\)"/.test(src) && /function cotUsarSugestaoCmed/.test(src));
  ok('55. ...e a tela diz isso com todas as letras', /nada é gravado até você clicar/.test(src));
  ok('56. a consulta à CMED sai no blur, não a cada tecla (cadastro não pode travar por rede)',
    /addEventListener\('blur'[\s\S]{0,140}cotConsultaCmed/.test(src));
  ok('57. a consulta à CMED é SÓ LEITURA (GET na cmed_regua, sem method)',
    /cmed_regua\?select=subst_norm[\s\S]{0,400}fetch\(url,\s*\{\s*headers:\s*SH\s*\}\)/.test(src));
  ok('58. rede caída devolve estado honesto, nunca sugestão inventada',
    /não consegui consultar a CMED agora/.test(src));
}

// ══════════ 8. A LISTA DE PENDÊNCIA ══════════
{
  ok('59. existe o painel "Produtos sem EAN"', /id="ean-pendencia"/.test(src) && /Produtos sem EAN/.test(src));
  ok('60. o painel é remontado a partir da lista COMPLETA, não do filtro da busca',
    /if \(lista === cotacoes\)[\s\S]{0,120}renderEanPendencia\(\)/.test(src));
  ok('61. *** a lista diz quantos ficaram de fora — sem corte silencioso ***',
    /Mostrando ' \+ vis\.length \+ ' de ' \+ _eanPend\.length/.test(src));
  ok('62. e tem como pedir mais', /function eanPendenciaMais/.test(src));
  ok('63. a gravação diz na cara quantas linhas vai tocar', /Gravar em ' \+ g\.ids\.length/.test(src));
  ok('64. ...e pede confirmação com o número antes de gravar', /em ' \+ g\.ids\.length \+ ' linha\(s\)/.test(src));
  // >>> ESTE ASSERT JÁ NASCEU ERRADO UMA VEZ: a 1ª versão procurava a FRASE "aplicar em todos"
  //     e falhou contra o COMENTÁRIO que promete justamente que ela não existe. Assert que lê
  //     prosa mede a prosa. O que precisa ser verdade é sobre o CÓDIGO: só existe um ponto de
  //     escrita, e ele recebe os ids de UM grupo — nunca uma lista montada de vários.
  ok('65. *** só existe UM ponto de escrita de EAN, e ele grava os ids de UM grupo ***',
    (src.match(/await _eanPatchIds\(/g) || []).length === 1 && /await _eanPatchIds\(g\.ids,/.test(src));
  ok('66. a gravação recusa id fora do formato numérico', /id fora do formato — gravação recusada/.test(src));

  // o agrupador: a mesma caneta de 4 fornecedores é UM produto pra completar, não quatro
  const G = new Function(bloco('function _eanDigitos(s)', 'function _eanEsc') + '\n' +
                         bloco('function eanGruposSemEan(lista)', 'function _eanTotalProdutos') + '\n' +
                         'return { eanGruposSemEan };')();
  const base = [
    { id:1, produto:'DIPIRONA 500MG', marca:'TEUTO', principio_ativo:'DIPIRONA', ean:null },
    { id:2, produto:'DIPIRONA 500MG', marca:'TEUTO', principio_ativo:'',         ean:null },
    { id:3, produto:'DIPIRONA 500MG', marca:'EMS',   principio_ativo:'DIPIRONA', ean:null },
    { id:4, produto:'SORO 500ML',     marca:'FRESENIUS', principio_ativo:'',     ean:'7891234567895' },
    { id:5, produto:'',               marca:'X',     principio_ativo:'',         ean:null }
  ];
  const g = G.eanGruposSemEan(base);
  ok('67. *** produto com EAN sai da pendência ***', !g.some(x => x.produto === 'SORO 500ML'), g.map(x => x.produto));
  ok('68. mesmo produto + mesma marca = UM grupo (2 linhas)', g[0].produto === 'DIPIRONA 500MG' && g[0].ids.length === 2, g[0]);
  ok('69. *** mesma marca diferente = grupo SEPARADO (EAN é por fabricante) ***', g.length === 2, g.length);
  ok('70. linha sem nome de produto não vira grupo fantasma', !g.some(x => !x.produto));
  ok('71. o grupo herda o princípio ativo de qualquer linha que o tenha', g[0].principio_ativo === 'DIPIRONA', g[0].principio_ativo);
  ok('72. os grupos vêm ordenados por volume (mais linhas primeiro)', g[0].ids.length >= g[1].ids.length);
  ok('73. EAN em branco (string vazia) continua sendo pendência — "" não é resposta',
    G.eanGruposSemEan([{ id:9, produto:'X', marca:'Y', ean:'' }]).length === 1);
}

// ══════════ 9. B10 — A FILA COMEÇA POR QUEM ESTÁ EM NEGÓCIO ATIVO ══════════
// A medição contra o banco real mora em tools/prova_ean_negocio_ativo.js (1.415 produtos
// marcados, 337 de ruído evitado, +7,3 ms). Aqui ficam as regras que não podem ser afrouxadas
// sem que alguém veja.
{
  const B10 = new Function(
    bloco('var EAN_NEG_MAX_EDITAIS', 'async function _eanCarregaNegocioAtivo') + '\n' +
    'return { _eanNormTexto, _eanIndiceItens, _eanEmNegocioAtivo, _eanNegocioAtivoQ,' +
    '         _EAN_CARA_DE_CONTROLE, liga: function(v){ _eanNegAtivo = v; } };'
  )();
  const itens = [
    { numero_item:'105', descricao:'FUROSEMIDA 10MG/ML – 2ML - SOL. INJETÁVEL IM/IV', controle:'X' },
    { numero_item:'12',  descricao:'ÁGUA DESTILADA PARA AUTOCLAVE 5L', controle:'X' },
    { numero_item:'47',  descricao:'DIPIRONA SÓDICA 500MG COMPRIMIDO', controle:'X' }
  ];
  B10.liga({ ok:true, indice: B10._eanIndiceItens(itens) });

  ok('74. o acento sai dos DOIS lados — "ÁGUA" do edital casa com "AGUA" do cadastro',
    !!B10._eanEmNegocioAtivo({ principio_ativo:'AGUA DESTILADA' }));
  ok('75. o casamento é a FRASE inteira: "DIPIRONA SODICA" casa...',
    !!B10._eanEmNegocioAtivo({ principio_ativo:'DIPIRONA SODICA' }));
  ok('76. *** ...e palavras soltas NÃO casam: "SODICA FUROSEMIDA" não existe em item nenhum ***',
    !B10._eanEmNegocioAtivo({ principio_ativo:'SODICA FUROSEMIDA' }));
  ok('77. *** produto sem princípio ativo nunca recebe selo (não dá pra casar por substância) ***',
    !B10._eanEmNegocioAtivo({ principio_ativo:'' }) && !B10._eanEmNegocioAtivo({}));
  ok('78. o selo devolve O ITEM que casou, e não um "sim" — dá pra conferir contra o edital',
    (B10._eanEmNegocioAtivo({ principio_ativo:'FUROSEMIDA' }) || {}).numero_item === '105');
  ok('79. *** índice não carregado NÃO vira "ninguém está em negócio ativo" ***',
    (function(){ B10.liga(null); const a = B10._eanEmNegocioAtivo({ principio_ativo:'FUROSEMIDA' });
                 B10.liga({ ok:false, motivo:'HTTP 500' }); const b = B10._eanEmNegocioAtivo({ principio_ativo:'FUROSEMIDA' });
                 B10.liga({ ok:true, indice: B10._eanIndiceItens(itens) });
                 return a === null && b === null; })());
  ok('80. ...e a tela DIZ que não conseguiu ler, em vez de mostrar zero',
    /[Nn]ão consegui ler os negócios ativos/.test(src) && /não consegui ver os negócios ativos/.test(src));
  ok('81. negócio arquivado, cancelado ou já em contrato não é negócio ativo',
    !B10._eanNegocioAtivoQ({ arquivado:true }) &&
    !B10._eanNegocioAtivoQ({ situacao:'cancelado' }) &&
    !B10._eanNegocioAtivoQ({ estagio:'contrato' }));
  ok('82. estágio DESCONHECIDO entra como ativo — some-se em silêncio é que não pode',
    B10._eanNegocioAtivoQ({ estagio:'homologacao' }) && B10._eanNegocioAtivoQ({}));
  ok('83. suspenso continua ativo (o pregão volta; cancelado é que não volta)',
    B10._eanNegocioAtivoQ({ situacao:'suspenso', estagio:'oportunidade' }));
  ok('84. o número de controle do PNCP é reconhecido pela cara quando a coluna própria é nula',
    B10._EAN_CARA_DE_CONTROLE.test('11259476000168-1-000097/2026') &&
    !B10._EAN_CARA_DE_CONTROLE.test('52/2026'));
  // O cache do normalizador é Object.create(null): com `{}`, a chave "constructor" devolveria a
  // FUNÇÃO Object em vez do texto, e ela seguiria adiante como se fosse o princípio ativo.
  ok('85. o normalizador não devolve função para produto chamado "constructor"',
    B10._eanNormTexto('constructor') === 'CONSTRUCTOR' && B10._eanNormTexto('__proto__') === 'PROTO');
  ok('86. *** o selo é prioridade de fila, e a tela diz que NÃO é fonte de EAN ***',
    /nunca fonte de EAN/.test(src) && /quem digita o código continua sendo gente/.test(src));
  ok('87. a lista diz quantos produtos não podem receber o selo por não terem princípio ativo',
    /não podem receber o selo/.test(src));
  ok('88. o corte de editais não é silencioso', /parei nos ' \+ EAN_NEG_MAX_EDITAIS \+ ' primeiros editais/.test(src));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
