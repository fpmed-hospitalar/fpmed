// SUITE testa_proposta_pmvg — a proposta anexada e a conferencia dela contra o teto legal.
//
// ══ O QUE ESTA SECAO ENTREGA ════════════════════════════════════════════════════════════════
// Nao e "guardar um PDF": e responder, ANTES do pregao, se a proposta cabe no teto. Item acima
// do PMVG numa venda ao governo DESCLASSIFICA — e e o erro que ninguem ve olhando a planilha,
// porque o numero parece um preco normal.
//
// ══ AS QUATRO DECISOES QUE ELA TRAVA ════════════════════════════════════════════════════════
//   1. NENHUMA ENGINE NOVA. A conferencia usa o MESMO `LimedtecTetoCMED` do Conferidor, com a
//      MESMA leitura de PDF — que subiu pro motor por causa desta tela. Duas leituras do mesmo
//      PDF sao duas respostas para "este preco e legal?", e uma delas esta errada sem ninguem
//      saber qual.
//   2. VERSOES EMPILHAM. Mandar de novo nao apaga o que foi enviado antes — e o que foi enviado
//      antes e o unico registro do que a empresa propos em cada rodada.
//   3. "NAO ENCONTRADO" NAO E "DENTRO DO TETO". Somar os dois daria um verde que nao existe.
//   4. A REGUA E DITA, E VIAJA COM O PAPEL. A CMED publica todo mes; conferencia sem a data da
//      edicao e afirmacao sem prazo de validade.
//
// PROVADO NO AR (11/08, tools/prova_conferencia_proposta.js, contra a CMED do banco):
//   15 linhas · 7 acima e 7 abaixo do teto por construcao · **0 erros de veredito**
//   (a linha que nao e medicamento caiu em "nao encontrado", e nao em "dentro do teto")
//
//   node tests/testa_proposta_pmvg.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const N = R('fpmed_negocios.html');
const M = R('fpmed_teto_cmed.js');
const C = R('fpmed_conferidor.html');
const D = R('ddl', 'negocio_anexos.sql');
const P = R('tools', 'prova_conferencia_proposta.js');
const RLS = R('tests', 'db', 'testa_anexos_rls.js');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_proposta_pmvg — a proposta anexada, conferida contra o teto\n');

// ══════════ 1. NENHUMA ENGINE NOVA ══════════
ok('1. *** a leitura da proposta subiu pro MOTOR (nao foi copiada) ***',
  /function precoDaLinha\(txt\)/.test(M) && /function itensDoTexto\(txt\)/.test(M));
ok('2. *** e o Conferidor passou a ler DE LA, com os mesmos nomes ***',
  /const \{ precoDaLinha, itensDoTexto \} = T;/.test(C)
  && !/^function precoDaLinha/m.test(C) && !/^function itensDoTexto/m.test(C));
ok('3. ...com o motivo escrito no motor (duas leituras = duas respostas pra mesma pergunta)',
  /Duas respostas para "este preço está acima do teto\?"/.test(uc(M)));
ok('4. ...e o motivo escrito no Conferidor (mudou de lugar, nao de comportamento)',
  /MUDOU DE LUGAR EM 11\/08, não de comportamento/.test(C));
ok('5. *** a ficha usa `avaliar` e `resumir` do motor, e nao uma conta propria ***',
  /T\.avaliar\(\{ descricao: it\.descricao, precoUnit: it\.precoUnit, unitario: it\.precoUnit != null, paraGoverno: true \}, idx\)/.test(N)
  && /const res = T\.resumir\(resultado\);/.test(N));
ok('6. ...e recusa conferir se o motor nao carregou (em vez de inventar um teto)',
  /o motor de teto não carregou — recarregue a tela/.test(N));
ok('7. *** o teto e o do GOVERNO (PMVG), e a decisao esta explicada ***',
  /paraGoverno: true/.test(N) && /Conferir contra o PF numa proposta pro governo aprovaria preço que\s*desclassifica/.test(uc(N)));
ok('8. a tela DIZ que e o mesmo motor do Conferidor', /É o <b>mesmo motor<\/b> do Conferidor/.test(N));

// ══════════ 2. O ANEXO, VERSIONADO ══════════
ok('9. *** existe a aba Proposta com contador ***',
  /\['prop','Proposta','dw-prop-n'\]/.test(N));
ok('10. *** o anexo vai pro bucket que JA existe ***',
  /storage\/v1\/object\/documentos\//.test(N) && /O BUCKET E O `documentos`, QUE JA EXISTE/.test(D));
ok('11. ...com o motivo (bucket novo = 2o conjunto de policies dizendo a mesma coisa)',
  /dois lugares pra errar\s*quem pode subir arquivo/.test(uc(D)));
/* ══ ESTE ASSERT COBRAVA UMA FRASE, E PASSOU A COBRAR O COMPORTAMENTO (14/08, fatia B15) ══════
   Ele exigia o texto "A VERSÃO NÃO VAI DAQUI" no HTML. A B15 juntou as tres copias do envio numa
   so (`subirAnexo`) e reescreveu o comentario — a regra continuou identica e o assert reprovou a
   palavra. Frase e proxy; o que importa e que NENHUM insert em `negocio_anexos` mande `versao`.
   >>> Agora ele conta os inserts e confere os campos de cada um. Se alguem escrever `versao:` num
       corpo de insert, reprova — inclusive num insert novo que ainda nao existe hoje. */
ok('12. *** a VERSAO nao vai da tela: quem calcula e a trigger ***',
  /create trigger anexo_versao_t before insert on public\.negocio_anexos/.test(D)
  && (() => {
    const corpos = [...N.matchAll(/negocio_id: \w+, categoria[\s\S]{0,320}?\}\)/g)].map(m => m[0]);
    return corpos.length >= 1 && corpos.every(c => !/\bversao\s*:/.test(c));
  })());
ok('13. ...com o motivo (duas abas mandariam "2" e uma sobrescreveria a outra)',
  /duas abas abertas mandariam "2" ao mesmo tempo e uma sobrescreveria a outra/.test(uc(N)));
ok('14. *** as 7 categorias nascem de uma vez (a fundacao serve os dois pedidos) ***',
  /'proposta',/.test(D) && /'ata',/.test(D) && /'contrato',/.test(D) && /'proposta_final',/.test(D)
  && /'ata_sessao',/.test(D) && /'itens_ganhos',/.test(D) && /'retorno_precos'\)\)/.test(D));
ok('15. ...com o motivo (construir dentro do 1o e estender no 2o = dois jeitos de anexar)',
  /Construir isso dentro do primeiro e "estender" no segundo e como nascem dois jeitos de anexar/.test(uc(D)));
ok('16. *** nao ha policy de DELETE nem de UPDATE no anexo ***',
  !/on public\.negocio_anexos for (delete|update)/i.test(D)
  && /versao que se edita nao e versao, e anexo que se apaga nao e prova/.test(D));
ok('17. *** e isso e PROVADO no banco (3 uploads = versao 1,2,3) ***',
  /VERSOES_PROPOSTA=/.test(RLS) && /versoes === '1,2,3'/.test(RLS));
ok('18. ...e a contagem e POR CATEGORIA (a 1a de outra categoria volta pra 1)',
  /vAta === '1'/.test(RLS));
ok('19. ...e o DELETE nao apaga (olhando a LINHA, nao o status)', /sobrou === '4'/.test(RLS));
ok('20. o link do anexo e ASSINADO e curto (bucket privado)',
  /storage\/v1\/object\/sign\/documentos\//.test(N) && /expiresIn: 60/.test(N));
ok('21. ...com o motivo (link de proposta que vale para sempre e link que vaza)',
  /Link de proposta que vale para sempre é link que vaza/.test(uc(N)));
ok('22. erro de leitura dos anexos NAO vira "nenhum anexo"',
  /isto <b>não<\/b> quer dizer que não existam/.test(N));
ok('23. ...com o motivo (senao alguem anexa de novo por cima do que ja esta la)',
  /e aí há duas versões da mesma proposta por engano/.test(uc(N)));

// ══════════ 3. O RESULTADO REGISTRADO ══════════
ok('24. *** a conferencia e gravada numa TABELA, e nao numa coluna do negocio ***',
  /create table if not exists public\.negocio_conferencias/.test(D));
ok('25. ...com o motivo (coluna apagaria a anterior, e a pergunta aparece depois que da errado)',
  /a gente ja tinha conferido antes de mandar\?/.test(uc(D)));
ok('26. *** o que se guarda e o PIOR caso, e nao a media ***',
  /pior_pct       numeric/.test(D) && /Media de "quanto acima do teto" esconde o item que estoura/.test(uc(D)));
ok('27. *** a vigencia da CMED e gravada JUNTO do resultado ***',
  /cmed_vigente_desde date/.test(D) && /cmed_vigente_desde: CMED_VIG \? String\(CMED_VIG\.vigente_desde\)\.slice\(0,10\) : null/.test(N));
ok('28. ...com o motivo (resultado sem a regua e numero sem prazo de validade)',
  /um numero\s*sem prazo de validade/.test(uc(D)));
ok('29. o registro falhar nao engole o resultado que a pessoa ja viu',
  /o registro falhar não pode engolir o resultado que a pessoa já viu/.test(N));
ok('30. *** o historico de conferencias aparece na ficha ***', /Conferências anteriores/.test(N));

// ══════════ 4. O SELO NO CARD ══════════
ok('31. *** existe o selo no card ***', /function seloConferencia\(id\)/.test(N) && /\$\{seloConferencia\(n\.id\)\}/.test(N));
ok('32. *** ele so aparece QUANDO HA conferencia ***', /if\(!c\) return '';/.test(N));
ok('33. ...com o motivo (card sem selo e "nao conferido", nao "esta tudo certo")',
  /Card sem selo quer dizer "não conferido", e não\s*"está tudo certo"/.test(uc(N)));
ok('34. ...e o motivo de nao existir selo neutro (200 cinzas ensinam a ignorar os vermelhos)',
  /Um selo neutro em 200 cards ensinaria a ignorar os vermelhos/.test(uc(N)));
ok('35. *** o card mostra a conferencia MAIS NOVA de cada negocio ***',
  /if\(!CONF_POR_NEGOCIO\[c\.negocio_id\]\) CONF_POR_NEGOCIO\[c\.negocio_id\] = c;/.test(N));
ok('36. ...e falha de leitura deixa o card SEM selo (que ja e "nao sei")',
  /sem selo é "não sei", e o card já não afirma nada/.test(N));

// ══════════ 5. "NAO ENCONTRADO" NAO E "DENTRO DO TETO" ══════════
ok('37. *** o placar conta nao-encontrado SEPARADO ***',
  /não achados na CMED/.test(N) && /res\.naoEncontrados/.test(N));
ok('38. *** e a tela DIZ isso com todas as letras ***',
  /Não encontrado na CMED não quer dizer dentro do teto/.test(N));
ok('39. ...explicando as duas causas possiveis (material sem teto x leitura que nao casou)',
  /Pode ser material \(que não tem\s*teto legal\) ou um medicamento que a leitura não casou/.test(uc(N)));
ok('40. ...e o relatorio impresso repete o aviso (o papel sai da tela)',
  (N.match(/Não encontrado na CMED não quer dizer dentro do teto/g) || []).length >= 2);
ok('41. os itens ACIMA aparecem primeiro na lista (e o que decide)',
  /a\.situacao==='acima'\?0:/.test(N));

// ══════════ 6. A REGUA VIAJA COM O PAPEL ══════════
ok('42. *** a ficha le a vigencia junto da tabela CMED ***', /v_cmed_vigencia\?select=\*/.test(N));
ok('43. *** e mostra qual regua usou ***', /function fraseReguaNeg\(\)/.test(N) && /CMED publicada em/.test(N));
ok('44. ...avisando quando passa de 45 dias', /Number\(v\.dias_desde\) > 45/.test(N));
ok('45. *** o relatorio IMPRESSO leva a vigencia no rodape ***',
  /Conferido contra a tabela CMED publicada em <b>/.test(N));
ok('46. ...com o motivo (papel que vive semanas numa pasta)',
  /este papel sai da tela e vive semanas\s*numa pasta/.test(uc(N)));
ok('47. *** e o EXCEL tambem leva ***',
  /Conferido contra a tabela CMED publicada em ' \+ new Date/.test(N) && /sheet_add_aoa/.test(N));
ok('48. ...e os dois AVISAM quando nao conseguiram identificar a edicao',
  (N.match(/não foi possível identificar a edição da CMED/g) || []).length >= 2);
ok('49. o relatorio diz qual teto foi aplicado (PMVG, com CAP onde incide)',
  /Teto aplicado: PMVG/.test(N));
ok('50. e o SheetJS so baixa no clique', /function carregarXlsxNeg\(\)/.test(N) && !/<script src="[^"]*xlsx/.test(N));

// ══════════ 7. A PROVA REAL ══════════
ok('51. *** a prova importa o MOTOR DE VERDADE, e nao uma copia ***',
  /require\(path\.join\(RAIZ, 'fpmed_teto_cmed\.js'\)\);   \/\/ O MOTOR DE VERDADE/.test(P));
ok('52. *** e monta a proposta com GABARITO (precos acima e abaixo por construcao) ***',
  /esperado: abaixo \? 'abaixo' : 'acima'/.test(P));
ok('53. ...com o motivo (uma proposta de verdade so diria "rodou"; esta diz "acertou")',
  /Uma proposta de verdade so diria "rodou"; esta diz "acertou"/.test(uc(P)));
ok('54. *** ela exige ZERO erros de veredito ***', /erros\.length === 0/.test(P));
ok('55. *** e trava que a linha que NAO e medicamento cai em "nao encontrado" ***',
  /LUVA DE PROCEDIMENTO/.test(P) && /caiu em "nao encontrado", e nao em "dentro do teto"/.test(P));
ok('56. *** a amostra e ESPALHADA pela tabela, e nao uma janela contigua ***',
  /const passo = Math\.max\(1, Math\.floor\(apres\.length \/ \(ALVO \* 6\)\)\);/.test(P));
ok('57. ...com o erro que motivou registrado (12 seguidos sao 12 variacoes do mesmo remedio)',
  /12 itens seguidos sao 12 variacoes do\s*mesmo remedio/.test(uc(P)));
ok('58. ...e o erro anterior tambem (chave normalizada nao e texto de proposta)',
  /chave normalizada\s*nao e texto de proposta/.test(uc(P)));
ok('59. *** a taxa de casamento e INFORMACAO, e nao nota do motor ***',
  /informacao, nao nota/.test(P) && /Ele nao e uma nota do motor/.test(uc(P)));
ok('60. ...e o piso existe so pra um motor que casa NADA nao passar',
  /um motor que casa NADA passaria com "0 erros de veredito"/.test(uc(P)));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
