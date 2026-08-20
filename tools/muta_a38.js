/* ═══════════════════════════════════════════════════════════════════════════════════════════
   muta_a38.js — A CATRACA DO RELÓGIO, PROVADA VERMELHA (fatia A38 · 20/08/2026)

   Uma suíte que nunca ficou vermelha é indistinguível de uma suíte quebrada — a A31 desta casa
   pagou caro por isso (oito catracas verdes sobre 320 linhas que elas não liam). Então a
   `tests/testa_relogio_prazo.js` não vale nada até alguém QUEBRAR a regra no arquivo DE VERDADE
   e ela gritar.

   As oito mutações são as que alguém faria de boa fé, e três delas merecem o nome:
     · trocar o corte de 7 dias por 3 — o recorte do molde virando gosto de quem passou;
     · devolver a barra da esquerda para a urgência da ABERTURA, que é o que ela era ontem e o
       que qualquer um restauraria "consertando" a fatia sem ler o porquê;
     · fazer o rodapé de seleção contar o `ESCOLHIDAS.size` em vez da interseção com a lista —
       que é o gesto óbvio, e que faz o botão dizer "Cruzar as 3" sobre uma lista com uma.

   O alvo é sempre um trecho DE UMA LINHA SÓ: a mutação da A36 se enganou sozinha procurando
   alvo com `\n` num arquivo CRLF e relatou "o trecho não está mais lá", que é o mesmo defeito
   que ela caçava. E a restauração é conferida BYTE A BYTE.

     node tools/muta_a38.js
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ALVO = path.join(RAIZ, 'fpmed_licitacoes.html');
const SUITE = path.join(RAIZ, 'tests', 'testa_relogio_prazo.js');

/* [ nome, trecho procurado, trecho trocado, que assert tem de gritar ] */
const MUTACOES = [
  ['o corte do ambar vira 3 dias — o recorte do molde virando gosto de quem passou',
   '  return dias <= 7',
   '  return dias <= 3',
   '4'],

  ['"faltam N dias" vira a data seca (a subtracao volta a ser trabalho de quem le)',
   "  const quanto = 'faltam ' + dias + (dias === 1 ? ' dia' : ' dias');",
   "  const quanto = quando;",
   '1, 6'],

  ['a barra da esquerda VOLTA para a urgencia da abertura (o conserto que alguem faria sem ler)',
   '\'<div class="lic clicavel\'+rel.classe+(escolhida?\' escolhida\':\'\')+\'" onclick="cliqueCartao(event,\'+i+\')">\'',
   '\'<div class="lic clicavel\'+urg.classe+(escolhida?\' escolhida\':\'\')+\'" onclick="cliqueCartao(event,\'+i+\')">\'',
   '13'],

  ['"prazo nao informado" vira travessao (a celula vazia sem explicacao, item 7 do molde)',
   "  if(!d) return { classe:' rel-nd', quanto:'prazo não informado', quando:'', faixa:'nd',",
   "  if(!d) return { classe:' rel-nd', quanto:'—', quando:'', faixa:'nd',",
   '7, 8'],

  ['"encerrada" passa a ser dito como "encerra hoje" (duas situacoes opostas com o mesmo texto)',
   "  if(dias < 0)   return { classe:' rel-fim',   quanto:'encerrada', quando, faixa:'fim',",
   "  if(dias < 0)   return { classe:' rel-fim',   quanto:'encerra hoje', quando, faixa:'fim',",
   '7'],

  ['a comparacao volta a ser de 24 HORAS, e nao de dia de calendario (o defeito de fuso de 06/08)',
   '  const dias = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - dia0) / 86400000);',
   '  const dias = Math.floor((d - agora) / 86400000);',
   '11'],

  ['o rodape de selecao conta o Set em vez da intersecao com a lista pintada',
   '  return (window._hits || []).filter(l => ESCOLHIDAS.has(chaveLic(l)));',
   '  return [...ESCOLHIDAS].map(k => ({ _k: k }));',
   '25'],

  ['a frase da ordenacao volta a ser fixa em "encerra primeiro" (numero certo, legenda errada)',
   "     + (hits.length===1?'licitação':'licitações')+', ordenadas por <b>'",
   "     + (hits.length===1?'licitação':'licitações')+', ordenadas por quem <b>encerra primeiro</b>'+'<b hidden>'",
   '34'],

  ['o replaceState vira pushState — cada tecla de refino vira uma entrada no historico',
   "    history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + (location.hash || ''));",
   "    history.pushState(null, '', location.pathname + (s ? '?' + s : '') + (location.hash || ''));",
   '50'],

  ['a ordem vinda da URL passa a ser aceita crua ("ordenadas por drop table" no rodape)',
   "    if(o && ['encerramento','abertura','valor','aderencia'].includes(o)) ORDEM = o;",
   '    if(o) ORDEM = o;',
   '55'],

  ['a janela MOVEL passa a ser gravada na URL (o link, aberto amanha, pesquisa ONTEM calado)',
   "    if(f.janela && f.janela.tipo === 'fixa'){ p.set('de', f.janela.de); p.set('ate', f.janela.ate); }",
   "    p.set('de', document.getElementById('f-de').value);",
   '53'],

  ['"limpar tudo" passa a aparecer com UM chip so (dois controles com o mesmo efeito lado a lado)',
   '    + (cs.length > 1',
   '    + (cs.length > 0',
   '43'],

  ['a tabela da lista passa a mostrar OS 212 itens do edital, e nao os 4 do cliente (item 6)',
   '  const meus = r.itens.filter(x => x.pares && x.pares.length);',
   '  const meus = r.itens.slice();',
   '61'],

  ['a folga troca a base para a REFERENCIA (dois itens com a mesma folga real, numeros diferentes)',
   '  const pct = (t.teto - uE.valor) / t.teto * 100;',
   '  const pct = (t.teto - uE.valor) / uE.valor * 100;',
   '63'],

  ['quantidade zero volta a ser impressa como "0" ("nao vao comprar nada")',
   "      + '<td class=\"num\">' + (Number(it.quantidade) > 0",
   "      + '<td class=\"num\">' + (Number(it.quantidade) >= 0",
   '67'],

  ['o valor dos itens passa a somar so o que se sabe e a chamar de total (o menor passando por completo)',
   '    +   (temValor === meus.length && somaMeus > 0',
   '    +   (somaMeus > 0',
   '68'],

  ['o rodape para de separar as duas causas da divida ("2 sem teto" manda procurar defeito)',
   "          + ': ' + [ semRef  ? semRef  + ' sem preço de referência no edital' : '',",
   "          + ': ' + [ '',",
   '69'],

  ['as duas densidades viram uma so — a tabela deixa de obedecer a preferencia da casa',
   '.painel-res.compacta .itens-meus{--im-linha:40px}',
   '.painel-res.compacta .itens-meus{--im-linha:48px}',
   '72'],

  ['a tabela deixa de rolar por dentro e a PAGINA passa a andar de lado a 390px (item 16)',
   '.itens-meus{overflow-x:auto}',
   '.itens-meus{overflow-x:visible}',
   '74'],

  ['clicar na tabela volta a abrir o painel de detalhe por tabela',
   '  let h = \'<div class="itens-meus" onclick="event.stopPropagation()">\'',
   '  let h = \'<div class="itens-meus">\'',
   '77'],

  ['o cartao aberto volta a ter DOIS primarios (dois primarios e o mesmo que nenhum)',
   '            + \' <button class="btn sec mini" onclick="abrirDetalhe(\'+i+\')">Ver itens e detalhes</button>\'',
   '            + \' <button class="btn mini" onclick="abrirDetalhe(\'+i+\')">Ver itens e detalhes</button>\'',
   '78, 79'],
];

function rodaSuite() {
  const r = spawnSync(process.execPath, [SUITE], { cwd: RAIZ, encoding: 'utf8' });
  const m = /RESULTADO: (\d+) ok, (\d+) falha/.exec(r.stdout || '');
  return { vermelha: r.status !== 0, ok: m ? +m[1] : null, falhas: m ? +m[2] : null,
           saida: (r.stdout || '') + (r.stderr || '') };
}

const original = fs.readFileSync(ALVO);          // Buffer: bytes, nao texto
const texto = original.toString('utf8');

console.log('MUTACAO DA CATRACA DO RELOGIO — ' + path.relative(RAIZ, ALVO) + '\n');

const partida = rodaSuite();
let p = 0, f = 0;
const conta = (c, msg) => { if (c) { p++; console.log('  OK   ' + msg); } else { f++; console.log('  FALHA ' + msg); } };
conta(!partida.vermelha, 'a suite parte VERDE (' + partida.ok + ' asserts) — sem isso nada abaixo mede nada');
if (partida.vermelha) { console.log(partida.saida); process.exit(1); }

for (const [nome, de, para, quem] of MUTACOES) {
  const achou = texto.indexOf(de);
  if (achou < 0) { f++; console.log('  FALHA  o trecho nao esta no arquivo: ' + nome); continue; }
  if (texto.indexOf(de, achou + 1) >= 0) { f++; console.log('  FALHA  o trecho aparece mais de uma vez: ' + nome); continue; }

  fs.writeFileSync(ALVO, texto.replace(de, para), 'utf8');
  const r = rodaSuite();
  fs.writeFileSync(ALVO, original);               // restaura ANTES de julgar, sempre

  conta(r.vermelha, nome + '  ->  VERMELHA (esperado nos asserts ' + quem + '; deu '
    + (r.falhas == null ? 'sem resultado' : r.falhas + ' falha(s)') + ')');
}

const depois = fs.readFileSync(ALVO);
conta(depois.equals(original), 'o arquivo voltou IDENTICO byte a byte (' + original.length
  + ' bytes -> ' + depois.length + ')');

const fim = rodaSuite();
conta(!fim.vermelha, 'e a suite volta VERDE no fim (' + fim.ok + ' asserts) — nao ficou defeito plantado');

console.log('\nRESULTADO: ' + p + ' de ' + (p + f));
if (f) process.exit(1);
