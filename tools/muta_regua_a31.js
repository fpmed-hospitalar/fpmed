/* ════════════════════════════════════════════════════════════════════════════════════════════
   muta_regua_a31.js — A PROVA DOS QUATRO CONSERTOS DA RÉGUA (fatia A31, 16/08/2026)

   ══ POR QUE ESTE ARQUIVO EXISTE, E POR QUE ELE É DIFERENTE DO muta_catracas.js ═══════════════
   O `muta_catracas.js` responde "a catraca sabe ficar vermelha?". Ele mede as três telas
   ADOTADAS, porque é só nelas que a catraca reprova. Os quatro consertos desta fatia são de
   ISENÇÃO — a régua passa a NÃO cobrar coisas que cobrava — e isenção tem um risco próprio, que
   é o pior risco que uma régua pode correr:

       *Verde de quem não olhou é indistinguível de verde de quem conferiu.*

   Foi a frase que o arquiteto escreveu sobre o defeito 10 desta régua, e ela vale em dobro aqui:
   toda isenção é uma licença para parar de olhar, e uma isenção larga demais apaga defeito de
   verdade sem ninguém perceber. Então cada conserto é medido nas DUAS direções, e as duas
   perguntas têm de passar juntas:

     A) A ISENÇÃO NÃO CEGOU — planta-se um defeito REAL do lado de FORA da fronteira (uma linha
        depois do papel acabar, uma regra fora do `:root` da ilha, o mesmo literal sem aspa
        curva) e a régua tem de continuar achando, com arquivo e linha.
     B) A ISENÇÃO NÃO É ANISTIA — tira-se a CONDIÇÃO que a justifica (a linha que revela o papel
        no `@media print`, o `data-tema` do `<html>`) e o defeito tem de VOLTAR inteiro. Isenção
        que sobrevive à queda da própria condição não é fronteira: é nome numa lista.

   As telas medidas aqui são as do trabalhador B, que estão em `pendentes` — a catraca não
   reprova por elas, então a mutação afere a RÉGUA (que é o que as oito catracas leem) e não o
   código de saída da catraca. Está declarado de propósito: dizer "a catraca ficou vermelha"
   quando ela nem julga aquele arquivo seria o mesmo tipo de número emprestado que a A30 achou.

   ══ AS QUATRO PERGUNTAS DE SEMPRE, HERDADAS DO muta_catracas.js ═════════════════════════════
     1. a mutação ALTEROU o arquivo?          2. a medida mudou como se esperava?
     3. o endereço citado é o certo?          4. o arquivo VOLTOU byte a byte?

     node tools/muta_regua_a31.js          (as 9)
     node tools/muta_regua_a31.js papel    (só as que casarem com o nome)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const CAMINHO_REGUA = path.join(__dirname, 'regua_visual.js');

// A régua é recarregada a cada mutação: ela lê o arquivo no `mede()`, mas o cache do `require`
// guardaria o TEMA, e uma medida com tema velho seria medida de outro sistema.
function mede(arquivo) {
  delete require.cache[require.resolve(CAMINHO_REGUA)];
  return require(CAMINHO_REGUA).mede(arquivo);
}

/* Cada mutação diz: o arquivo, o que trocar, o que a medida tem de virar, e POR QUÊ.
   `espera` recebe o retrato mutado e o retrato ORIGINAL, e devolve
   { ok: bool, disse: 'o que a régua disse' } — o `disse` sai no relatório mesmo quando passa,
   porque prova sem número é opinião. */
const M = [

  /* ══════════ DEFEITO 11 — o `/*` que não abre comentário ══════════════════════════════════ */
  { nome: 'D11-a · a régua VOLTOU a olhar o que o accept="image/*" cegava',
    arquivo: 'fpmed_giovana.html',
    de: '<div class="total-row"><span>Subtotal</span>',
    para: '<div class="total-row" style="color:#BADA55"><span>Subtotal</span>',
    porque: 'planta um hex numa linha da TELA que fica dentro das 287 linhas que o curinga de '
      + 'MIME apagava. Antes do conserto a régua nem enxergava esta linha — e dava atestado '
      + 'de saúde. Se ela não achar agora, a cegueira voltou.',
    espera: (m, o) => {
      const novo = m.cor.tela.filter(c => c.valor.toUpperCase() === '#BADA55');
      return { ok: novo.length === 1 && m.cor.tela.length === o.cor.tela.length + 1,
               disse: 'cor.tela ' + o.cor.tela.length + ' -> ' + m.cor.tela.length
                 + (novo.length ? '  achou #BADA55 na L' + novo[0].linha : '  NAO ACHOU o #BADA55') };
    } },

  { nome: 'D11-b · e comentário de verdade CONTINUA sendo comentário',
    arquivo: 'fpmed_giovana.html',
    de: '/* DOCUMENTO DE IMPRESSÃO */',
    para: '/* DOCUMENTO DE IMPRESSÃO — nota: aqui havia um #BADA55 antes da B8 */',
    porque: 'o conserto do 11 estreitou o recorte do comentário, e recorte estreito demais faria '
      + 'a régua começar a CONTAR o conteúdo do comentário — que é exatamente o defeito 1 desta '
      + 'régua (o comentário do calibre French contado como preço) pelo avesso. O hex está '
      + 'dentro de um comentário que abre depois de quebra de linha: tem de continuar invisível.',
    espera: (m, o) => ({ ok: m.cor.tela.length === o.cor.tela.length,
      disse: 'cor.tela ' + o.cor.tela.length + ' -> ' + m.cor.tela.length + ' (tem de nao mexer)' }) },

  /* ══════════ DEFEITO 12 — a fronteira do papel ════════════════════════════════════════════ */
  { nome: 'D12-a · a fronteira do papel FECHA — a linha seguinte volta a ser tela',
    arquivo: 'fpmed_giovana.html',
    de: '<div id="modal-manual" style="display:none;position:fixed;inset:0;background:var(--veu);',
    para: '<div id="modal-manual" style="display:none;position:fixed;inset:0;background:#BADA55;',
    porque: 'este `<div>` é a PRIMEIRA coisa depois de o `</div>` da folha fechar. Se o leitor '
      + 'de subárvore errar o fecho, ele engole daqui até o fim do arquivo e a régua fica cega '
      + 'em 4.400 linhas — com relatório verde. É a mesma armadilha do defeito 11, montada pelo '
      + 'próprio conserto do defeito 12.',
    espera: (m, o) => {
      const novo = m.cor.tela.filter(c => c.valor.toUpperCase() === '#BADA55');
      return { ok: novo.length === 1,
               disse: novo.length ? 'achou #BADA55 na L' + novo[0].linha + ' (fora do papel, certo)'
                 : 'NAO ACHOU — a subarvore do papel engoliu o resto do arquivo' };
    } },

  { nome: 'D12-b · sem a linha que REVELA no papel, a folha volta a ser tela',
    arquivo: 'fpmed_giovana.html',
    de: '  .print-doc{display:block!important;}\n',
    para: '',
    porque: 'a isenção do papel não vale por o seletor se chamar `print`: ela vale porque o CSS '
      + 'prova que aquilo está ESCONDIDO na tela e REVELADO no papel. Tirando a metade que '
      + 'revela, `.print-doc` deixa de ser raiz de papel — e os 22 hex + 12 espaços + 12 '
      + 'tamanhos têm de voltar inteiros para a coluna da tela. Se não voltarem, a régua está '
      + 'isentando pelo NOME, e qualquer um esconde defeito chamando a classe de print-alguma-coisa.',
    espera: (m, o) => ({
      ok: m.papel.raizes.indexOf('.print-doc') < 0 && m.cor.tela.length >= o.cor.tela.length + 20
          && m.texto.tela.length >= o.texto.tela.length + 10,
      disse: 'raizes=[' + m.papel.raizes.join(',') + ']  cor.tela ' + o.cor.tela.length + ' -> '
        + m.cor.tela.length + '  texto.tela ' + o.texto.tela.length + ' -> ' + m.texto.tela.length }) },

  { nome: 'D12-c · nome PARECIDO não entra no papel (.print-doc nao alcanca .print-documento)',
    arquivo: 'fpmed_giovana.html',
    de: '.print-doc .doc-emissao{',
    para: '.print-documento-x{color:#BADA55}\n.print-doc .doc-emissao{',
    porque: 'o casamento por prefixo é a porta de fundo clássica: `.print-doc` não pode alcançar '
      + '`.print-documento-x`, que é OUTRA classe e não tem nada a ver com a folha. Se alcançar, '
      + 'basta batizar uma regra de tela com um nome que comece igual para ela sumir da conta.',
    espera: (m, o) => {
      const novo = m.cor.tela.filter(c => c.valor.toUpperCase() === '#BADA55');
      return { ok: novo.length === 1,
               disse: novo.length ? 'achou #BADA55 na L' + novo[0].linha + ' (nao virou papel, certo)'
                 : 'NAO ACHOU — o prefixo virou porta de fundo' };
    } },

  /* ══════════ DEFEITO 13 — o `:root` da ilha de tema declarada ═════════════════════════════ */
  { nome: 'D13-a · hex FORA do :root da ilha continua reprovando',
    arquivo: 'fpmed_documentos.html',
    de: '.ic{width:1em;height:1em;stroke:currentColor;',
    para: '.ic{width:1em;height:1em;stroke:#BADA55;',
    porque: 'a isenção é da FONTE de cor da ilha, e não da ilha inteira. Cor redigitada no meio '
      + 'de uma regra é justamente o que o B tirou desta tela nesta mesma fatia (11 hex + 6 '
      + 'rgba). Se a isenção vazar para as regras, o trabalho dele desmancha sem aviso.',
    espera: (m, o) => {
      const novo = m.cor.tela.filter(c => c.valor.toUpperCase() === '#BADA55');
      return { ok: novo.length === 1 && m.cor.tela.length === o.cor.tela.length + 1,
               disse: 'cor.tela ' + o.cor.tela.length + ' -> ' + m.cor.tela.length
                 + (novo.length ? '  achou na L' + novo[0].linha : '  NAO ACHOU') };
    } },

  { nome: 'D13-b · sem o <html data-tema>, o :root deixa de ser fonte e os 17 voltam',
    arquivo: 'fpmed_documentos.html',
    de: '<html lang="pt-BR" data-tema="escuro">',
    para: '<html lang="pt-BR">',
    porque: 'a ilha se declara pelo MESMO atributo que faz o `limedtec-config.js` não escrever '
      + 'cor nenhuma nesta tela e que a `testa_tema_tela_propria` guarda dos dois lados. Tirando '
      + 'o atributo, a tela passa a receber o tema do cliente — e aí o `:root` dela não é fonte '
      + 'de nada, é cor chumbada por cima do tema. Os 17 têm de voltar.',
    espera: (m, o) => ({
      ok: m.ilhaDeTema === false && m.cor.fonteIlha.length === 0 && m.cor.tela.length >= 17,
      disse: 'ilhaDeTema=' + m.ilhaDeTema + '  fonteIlha ' + o.cor.fonteIlha.length + ' -> '
        + m.cor.fonteIlha.length + '  cor.tela ' + o.cor.tela.length + ' -> ' + m.cor.tela.length }) },

  /* ══════════ DEFEITO 14 — o literal citado na prosa ═══════════════════════════════════════ */
  { nome: 'D14-a · aspa RETA continua reprovando (aspa reta e sintaxe, nao citacao)',
    arquivo: 'fpmed_ajuda.html',
    de: '<b>“Sem referência” não é o mesmo que “R$ 0,00”.</b>',
    para: '<b>"Sem referência" não é o mesmo que "R$ 0,00".</b>',
    porque: 'a fronteira inteira do conserto 14 é a aspa CURVA, que é pontuação de prosa e nunca '
      + 'sintaxe de código. Se a aspa reta também isentar, então `const vazio = \'R$ 0,00\'` '
      + 'passa a ser isento — e a catraca mais importante das oito deixa de existir.',
    espera: (m, o) => ({
      ok: m.numero.mentiras.length === o.numero.mentiras.length + 1 && m.numero.citacoes.length === 0,
      disse: 'mentiras ' + o.numero.mentiras.length + ' -> ' + m.numero.mentiras.length
        + '  citacoes ' + o.numero.citacoes.length + ' -> ' + m.numero.citacoes.length
        + (m.numero.mentiras.length ? '  (L' + m.numero.mentiras[0].linha + ')' : '') }) },

  { nome: 'D14-b · literal SOLTO na tela continua reprovando',
    arquivo: 'fpmed_ajuda.html',
    /* O ALVO PRECISA SER ÚNICO, e a primeira versão não era: `<div class="aviso aviso--cuidado">`
       aparece QUATRO vezes nesta tela, o `split/join` mutou as quatro e a mutação passou a
       provar outra coisa (4 mentiras em vez de 1). Mutação que muda mais do que diz que muda é
       a mesma família do endereço errado. O alvo agora carrega a linha seguinte junto. */
    de: '<div class="aviso aviso--cuidado">\n        <b>“Sem referência”',
    para: '<div class="aviso aviso--cuidado">\n        <span class="val">R$ 0,00</span>\n        <b>“Sem referência”',
    porque: 'o caso que a catraca nasceu para pegar: o zero PINTADO como se fosse preço. Ele '
      + 'está aqui a três linhas da citação isenta, no mesmo bloco — se a régua isentar por '
      + 'vizinhança em vez de por aspa, ela some com este também.',
    espera: (m, o) => ({
      ok: m.numero.mentiras.length === o.numero.mentiras.length + 1 && m.numero.citacoes.length === 1,
      disse: 'mentiras ' + o.numero.mentiras.length + ' -> ' + m.numero.mentiras.length
        + '  citacoes segue em ' + m.numero.citacoes.length
        + (m.numero.mentiras.length ? '  (L' + m.numero.mentiras[0].linha + ')' : '') }) },
];

const filtro = (process.argv[2] || '').toLowerCase();
const lista = filtro ? M.filter(m => (m.nome + m.arquivo).toLowerCase().includes(filtro)) : M;
if (!lista.length) { console.error('nenhuma mutacao casa com "' + filtro + '"'); process.exit(1); }

console.log('MUTACAO DOS 4 CONSERTOS DA REGUA (fatia A31) — quebra de proposito, confere, restaura.\n');
let ok = 0, falhou = 0; const sujo = [];

for (const m of lista) {
  const p = path.join(RAIZ, m.arquivo);
  const bruto = fs.readFileSync(p, 'utf8');
  const usaCRLF = /\r\n/.test(bruto);
  const alvo = bruto.replace(/\r\n/g, '\n');
  let veredito = [];

  try {
    /* 1 · A MUTAÇÃO ALTEROU O ARQUIVO? Mutação que não mudou nada não prova nada. */
    if (!alvo.includes(m.de)) {
      console.log('  ✗ ' + m.nome + '\n      A MUTACAO NAO ENCONTROU O ALVO — o arquivo mudou de forma '
        + 'e esta mutacao virou teatro. Procurado: ' + JSON.stringify(m.de.slice(0, 70)));
      falhou++; continue;
    }
    const antes = mede(m.arquivo);
    const mutado = alvo.split(m.de).join(m.para);
    if (mutado === alvo) { console.log('  ✗ ' + m.nome + '  A MUTACAO NAO ALTEROU NADA'); falhou++; continue; }
    const linhaMutada = alvo.slice(0, alvo.indexOf(m.de)).split('\n').length;
    fs.writeFileSync(p, usaCRLF ? mutado.replace(/\n/g, '\r\n') : mutado);
    veredito.push('mutou L' + linhaMutada + ' (' + (mutado.length - alvo.length) + ' bytes)');

    /* 2 e 3 · A MEDIDA VIROU O QUE TINHA DE VIRAR, E COM QUE ENDEREÇO? */
    const depois = mede(m.arquivo);
    const v = m.espera(depois, antes);
    veredito.push(v.disse);
    console.log('  ' + (v.ok ? '✓' : '✗') + ' ' + m.nome);
    console.log('      ' + veredito.join(' · '));
    console.log('      quebrou: ' + m.porque);
    if (v.ok) ok++; else falhou++;
  } finally {
    /* 4 · VOLTOU BYTE A BYTE? */
    fs.writeFileSync(p, bruto);
    if (fs.readFileSync(p, 'utf8') !== bruto) sujo.push(m.arquivo);
  }
}

console.log('\n───────────────────────────────');
console.log('MUTACOES: ' + ok + ' provada(s), ' + falhou + ' falha(s) de ' + lista.length);
if (sujo.length) console.log('>>> ARQUIVO NAO RESTAURADO: ' + sujo.join(', ') + ' — rode `git checkout` neles');
console.log(falhou || sujo.length ? '>>> VERMELHO' : '>>> OS 4 CONSERTOS SABEM DIZER NAO');
process.exitCode = (falhou || sujo.length) ? 1 : 0;
