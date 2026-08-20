// SUITE testa_pncp_fora — O PORTAL FORA DO AR NAO PODE MAIS ALCANCAR QUEM ESTA BUSCANDO.
//
// URGENCIA de 10/08: o Natanael digitou um termo no Encontrar e levou o painel VERMELHO
// "Nao consegui falar com o PNCP", com o nosso indice tendo resultado logo acima. A experiencia
// virou "sistema quebrado" num momento em que o sistema tinha a resposta na mao.
//
// FORAM TRES DEFEITOS, e o do meio e o que ninguem tinha visto:
//   1. A COLETA estava parada: 12 rodadas agendadas, 12 falhas, porque o secret COLETA_TOKEN
//      nunca foi configurado no GitHub. O indice congelou em 06/08.
//   2. *** O TERMO DIGITADO NUNCA CHEGAVA AO BANCO. *** O `buscarNoBanco` filtrava por data + UF
//      + modalidade; a palavra-chave so era aplicada DEPOIS, no navegador. Com o indice parado e
//      a data padrao sendo o ultimo dia util, o banco devolvia ZERO e a tela caia no PNCP ao
//      vivo — que estava fora. O termo dele nunca foi perguntado a quem tinha resposta.
//   3. O TOM: painel vermelho de erro fatal mesmo havendo resultado.
//
// ══ REESCRITA NA FATIA A34 (20/08), E A RAZAO E QUE A CAUSA-RAIZ MORREU ═══════════════════════
// Ate 19/08 esta suite guardava um CONSERTO DE CONVIVENCIA: o banco primeiro, o portal depois, e
// um tom brando pro dia em que o portal caisse. A ordem do dono em 19/08 (*"buscar o PNCP uma vez
// por dia e deixar salvo"*) tirou o portal de dentro da busca. Nao ha mais "depois".
//
// >>> ENTAO OS ASSERTS MUDARAM DE ALVO, E NAO DE EXIGENCIA. Os treze que cobravam a
//     `avisoBrandoPNCP`, o `aoVivo` e a queda pro portal cobravam a MELHOR forma possivel de
//     conviver com um risco que agora nao existe. Guarda-los depois disso seria travar a tela num
//     defeito ja consertado — e um deles (o 12) travaria a volta do proprio caminho que causou a
//     urgencia.
// >>> O QUE NAO PODE SUMIR, E ESTA TUDO AQUI EMBAIXO: (a) o termo continua chegando ao banco;
//     (b) "nao consegui ler" continua diferente de "nao ha"; (c) vermelho so quando nao ha nada;
//     (d) a tela nunca esconde a idade do dado. A (d) e NOVA e e a conta que a A34 paga: quem
//     deixa de perguntar ao portal na hora do uso passa a dever a idade do que mostra.
//
//   node tests/testa_pncp_fora.js
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'fpmed_licitacoes.html'), 'utf8').replace(/\r\n/g, '\n');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_pncp_fora — o portal fora do ar nao alcanca mais quem busca\n');

/* O CORPO DA `buscar()` E MEDIDO SOZINHO, e nao o arquivo inteiro. O botao nacional e a leitura
   de itens de UM cartao continuam falando com o PNCP, e devem: os dois sao GESTO de quem clicou.
   O que nao pode voltar e o disparo automatico no meio de uma busca. */
const corpoBuscar = (() => {
  const i = src.indexOf('async function buscar(){');
  return i < 0 ? '' : src.slice(i, src.indexOf('\nfunction marcaBusca(', i));
})();

// ══════════ 1. A CAUSA-RAIZ: A BUSCA NAO FALA COM O PORTAL ══════════
ok('1. *** o extrator achou a `buscar()` inteira (assert cego e pior que assert vermelho) ***',
  corpoBuscar.length > 2000, { tamanho: corpoBuscar.length });
ok('2. *** dentro da busca nao ha UMA chamada ao PNCP ***',
  !/pncp\.gov\.br/i.test(corpoBuscar) && !/puxarPagina\(/.test(corpoBuscar)
  && !/await buscarNacional\(/.test(corpoBuscar));
ok('3. *** e a bandeira `aoVivo`, que mandava ignorar o banco, deixou de existir no arquivo ***',
  !/aoVivo/.test(src));
ok('4. ...e a constante do endereco de consulta saiu, com lapide no lugar (endereco vivo e convite a religar)',
  !/const API = 'https:\/\/pncp\.gov\.br/.test(src)
  && /A CONSTANTE `API` SAIU DAQUI NA FATIA A34/.test(src));
ok('5. o que sobrou de PNCP na tela e GESTO, e esta dito quais sao os tres',
  /os três são GESTO EXPLÍCITO, nunca automático/.test(src));
ok('6. *** o "Atualizar agora" rele o NOSSO indice, e nao forca mais o ao vivo ***',
  /function atualizarAgora\(\)\{ buscar\(\); \}/.test(src));
ok('7. ...com a razao escrita: o botao nao promete o que nao faz',
  /E ELE NÃO PROMETE O QUE NÃO FAZ/.test(src));

// ══════════ 2. O DEFEITO Nº 2 DA URGENCIA: O TERMO CHEGA AO BANCO ══════════
// Este e o unico dos tres que a A34 nao dispensou — ela o levou mais longe. Em 10/08 o conserto
// foi perguntar ao INDICE INTEIRO quando a janela vinha vazia; a A34 mandou o TERMO junto, para
// que o banco devolvesse so quem casou em vez de 23 MB para o navegador filtrar.
ok('8. *** existe a busca no indice INTEIRO, sem janela de data ***',
  /async function buscarNoBancoAmplo\(uf, mod, kws\)/.test(src));
ok('9. *** ela e acionada quando a janela vem vazia E ha termo digitado ***',
  /if\(\(!doBanco \|\| !doBanco\.length\) && kws\.length\)\{[\s\S]{0,200}buscarNoBancoAmplo/.test(src));
ok('10. ...e a tela DIZ que ampliou a janela (senao o operador acha que aquilo e do dia)',
  /fora da janela de datas/i.test(src) && /nada publicado no período escolhido/.test(src));
ok('11. *** e o termo vai pro banco pela coluna SEM ACENTO, que e a mesma regra do navegador ***',
  /&texto_busca=ilike\./.test(src) && !/objeto=ilike/.test(src));
ok('12. ...e o `%` e o `_` do LIKE sao escapados (senao "seringa 20%" vira outra busca)',
  /const escapaLike = /.test(src) && /escapaLike\(k\)/.test(src));
ok('13. a busca ampla respeita UF e modalidade escolhidas',
  /if \(uf\)  q \+= `&uf=eq\.\$\{encodeURIComponent\(uf\)\}`/.test(src)
  && /if \(mod\) q \+= `&modalidade_cod=eq\./.test(src));
ok('14. ...e tem timeout, como toda chamada de rede desta tela',
  /setTimeout\(\(\)=>ctrl\.abort\(\), TIMEOUT_MS\)/.test(src));

// ══════════ 3. O TOM: O VERMELHO SO QUANDO NAO HA NADA ══════════
// A `avisoBrandoPNCP` morreu junto com a causa dela. O que ela protegia — nao pintar de vermelho
// um sistema que esta funcionando — continua, e agora e mais facil de cumprir: com o portal fora
// da busca, o unico "nao achei" possivel e sobre o NOSSO indice.
ok('15. *** o painel de vazio NAO usa a classe de erro (ele e aviso, nao falha) ***',
  /lista\.innerHTML = '<div class="aviso" style="text-align:left/.test(src));
ok('16. ...e diz PARA QUE TERMO o indice nao tem nada',
  /Procurei <b>' \+ esc\(kws\.join\(' \/ '\)\)/.test(src));
ok('17. ...e se foi no periodo escolhido ou no indice inteiro',
  /janelaAmpliada \? ' no índice inteiro' : ' no período escolhido'/.test(src));
ok('18. *** e denuncia quando a coleta NUNCA rodou (a causa-raiz de 10/08) ***',
  /const podeEstarVelho = !emDiaAte && !quando;/.test(src)
  && /E o índice ainda não foi carregado nenhuma vez com sucesso/.test(src));
ok('19. ...com a razao de separar as duas: nao e resposta sobre o Brasil, e sobre uma gaveta vazia',
  /não é resposta sobre o Brasil, é resposta sobre uma gaveta vazia/.test(src));
ok('20. *** "nao consegui ler" continua diferente de "nao ha" (o null do lerPaginado) ***',
  /if\(!r\.ok\) return out\.length \? out : null;/.test(src)
  && /\}catch\(e\)\{ return null; \}/.test(src));
ok('21. e o bloco nacional nao fica mudo no vazio: o convite pinta nos DOIS desfechos',
  (src.match(/\n\s*convidaNacional\(\);/g) || []).length === 2);

// ══════════ 4. A CONTA QUE A A34 PAGA: A IDADE DO DADO ══════════
/* NAO PERGUNTAR AO PORTAL NA HORA DO USO TEM UM PRECO, e ele e exatamente este: uma licitacao
   publicada ha dez minutos nao aparece ate a proxima carga. Trocar 70 s de espera por uma frase
   honesta so e um bom negocio porque a frase esta la. Sem estes asserts, a A34 seria uma tela
   rapida e muda — que e pior que a lenta, porque a lentidao a pessoa ve e a idade nao. */
ok('22. *** existe a faixa de frescor, e ela le o carimbo da CARGA (nao o da coleta) ***',
  /async function faixaFrescor\(\)/.test(src)
  && /coleta_status\?fonte=eq\.CARGA&select=ultima_ok,ultima_tentativa,ultimo_erro,detalhe/.test(src));
ok('23. ...e os dois carimbos continuam separados (o selo do header le `PNCP`)',
  /fonte=eq\.PNCP/.test(src));
ok('24. *** `ultima_ok` NULL vira ALARME, e nao a hora da ultima TENTATIVA ***',
  /if\(!c \|\| !c\.ultima_ok\)\{/.test(src)
  && /A carga nunca terminou por inteiro/.test(src)
  && /el\.className = 'frescor atencao';/.test(src));
ok('25. ...com a razao escrita: e verdade da licitacao e mentira do item',
  /verdade da LICITAÇÃO e mentira do ITEM/.test(src));
ok('26. *** carga velha nao e escondida: a faixa fica ambar e diz a idade real ***',
  /const velho = idade > FRESCOR_HORAS \* 3600000;/.test(src)
  && /atualizados há <b>' \+ idadeEmPalavras\(idade\)/.test(src));
ok('27. ...e o numero de horas e UM SO, compartilhado com o condutor da carga',
  /const FRESCOR_HORAS = 12;/.test(src)
  && /const FRESCOR_HORAS = 12;/.test(
      fs.readFileSync(path.join(__dirname, '..', 'tools', 'carga_diaria.js'), 'utf8')));

// ══════════ 5. NADA REGREDIU ══════════
ok('28. o carimbo de procedencia continua dizendo de quando e o dado',
  /coletados em \$\{quando\.toLocaleDateString/.test(src));
ok('29. e continua avisando quando a ultima coleta falhou', /a última coleta falhou/.test(src));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
