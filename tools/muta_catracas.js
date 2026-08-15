/* ════════════════════════════════════════════════════════════════════════════════════════════
   muta_catracas.js — A PROVA DE QUE AS 8 CATRACAS SÃO CATRACAS (fatia A28, 15/08/2026)

   ══ A LEI QUE VALE MAIS QUE AS OITO REGRAS ══════════════════════════════════════════════════
   *Catraca que nunca ficou vermelha não é catraca.* Toda regra desta casa nasce com MUTAÇÃO:
   quebra-se de propósito, confere-se que o teste fica vermelho NOMEANDO ARQUIVO E LINHA,
   restaura-se — **e confere-se que a mutação alterou o arquivo**. Mutação que não mudou nada não
   prova nada, e isso já enganou gente aqui.

   ══ AS QUATRO PERGUNTAS QUE ESTE ARQUIVO RESPONDE, POR CATRACA ══════════════════════════════
     1. a mutação ALTEROU o arquivo?            (senão, o resto é teatro)
     2. a catraca ficou VERMELHA?               (código de saída ≠ 0)
     3. ela NOMEOU o arquivo e a linha certos?  (endereço errado manda consertar o lugar errado)
     4. o arquivo VOLTOU byte a byte?           (mutação que suja o repositório é pior que nenhuma)

   ══ E POR QUE ELE ESCREVE NO ARQUIVO DE VERDADE, E NÃO NUMA CÓPIA ═══════════════════════════
   Porque a catraca lê o caminho real, e uma cópia temporária provaria que a catraca funciona
   sobre uma cópia. O risco é gerenciado do jeito certo: o conteúdo original fica em memória
   ANTES de qualquer escrita, a restauração acontece em `finally`, e a pergunta 4 confere byte a
   byte que ele voltou. Se a máquina cair no meio, `git checkout <arquivo>` desfaz — e o teste
   diz, no fim, se ficou alguma coisa suja.

     node tools/muta_catracas.js            (as 8)
     node tools/muta_catracas.js contraste  (só a que casar com o nome)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');

/* Cada mutação diz: em que arquivo, o que trocar, e QUAL FRASE a catraca precisa cuspir.
   A frase esperada contém arquivo e linha — é assim que a pergunta 3 é feita de verdade, e não
   por "saiu alguma coisa vermelha". */
const MUTACOES = [
  { catraca: 'testa_cor_token', arquivo: 'fpmed_licitacoes.html',
    de: 'background:var(--azul-50);display:grid;place-items:center;color:var(--azul-700)',
    para: 'background:#eaf6fc;display:grid;place-items:center;color:var(--azul-700)',
    porque: 'troca o token do fundo do selo por o hex EQUIVALENTE — mesma cor, e mesmo assim '
      + 'errado: no dia em que a paleta mudar, o token acompanha e o hex fica para trás' },

  { catraca: 'testa_espaco_token', arquivo: 'fpmed_licitacoes.html',
    de: '.dens{display:flex;gap:var(--esp-1);padding:var(--esp-1)',
    para: '.dens{display:flex;gap:3px;padding:var(--esp-1)',
    porque: 'poe 3px de volta no trilho do alternador — o "quase alinhado" que ninguem sabe nomear' },

  { catraca: 'testa_texto_piso', arquivo: 'fpmed_licitacoes.html',
    de: 'font-size:var(--txt-1);font-weight:var(--peso-semi);white-space:nowrap}\n.urg--hoje',
    para: 'font-size:var(--txt-0);font-weight:var(--peso-semi);white-space:nowrap}\n.urg--hoje',
    porque: 'devolve a pastilha de PRAZO para os 10px — o furo POR TOKEN, que quem procura '
      + 'numero nunca acha' },

  { catraca: 'testa_icones', arquivo: 'fpmed_licitacoes.html',
    de: "+ ic('mais') + ' Adicionar aos meus negócios</button>'",
    para: "+ '＋ Adicionar aos meus negócios</button>'",
    porque: 'devolve o U+FF0B (o "mais" de largura inteira) ao botao verde — o caractere que '
      + 'parece icone e muda com a fonte instalada' },

  { catraca: 'testa_toque_celular', arquivo: 'fpmed_licitacoes.html',
    de: '.det-fechar{width:44px;height:44px}',
    para: '.det-fechar{width:32px;height:32px}',
    porque: 'encolhe o botao de FECHAR, que e so icone — o caso perigoso que o molde nomeia' },

  { catraca: 'testa_contraste', arquivo: 'limedtec-menu.js',
    de: "'  background:var(--azul-600);color:var(--branco);display:grid;place-items:center;',",
    para: "'  background:var(--azul-500);color:var(--branco);display:grid;place-items:center;',",
    porque: 'devolve o quadrado da marca ao azul-500, onde o branco da 2,67:1' },

  /* >>> ESTA MUTAÇÃO NASCEU ERRADA, E FOI ELA QUE ACHOU O BURACO. A primeira versão trocava a
         PRIMEIRA ocorrência de `position:sticky` no arquivo — e a primeira é a do `.topo`, o
         cabeçalho da PÁGINA, que a catraca de tabela não tem por que julgar. Ela ficou verde, e
         eu quase escrevi "a catraca de tabela não sabe ficar vermelha".
         Ao ir ver POR QUE, apareceu o defeito de verdade: a catraca perguntava "alguma tabela
         tem cabeçalho fixo?" e a Encontrar tem TRÊS — só uma obedecia, e as outras duas
         passavam de carona. A mutação errada expôs uma regra frouxa. Agora ela mira a tabela
         nominalmente, e a regra é POR TABELA. */
  { catraca: 'testa_tabela_densa', arquivo: 'fpmed_licitacoes.html',
    de: '.det-tab2 thead th{position:sticky',
    para: '.det-tab2 thead th{position:static',
    porque: 'solta o cabecalho da tabela dos 500 itens — rolou trinta linhas, perdeu a legenda '
      + 'de qual coluna e o teto CMED' },

  { catraca: 'testa_numero_honesto', arquivo: 'fpmed_licitacoes.html',
    de: "? '<span class=\"hint\" style=\"font-weight:var(--peso-normal)\">não informado</span>' : brl(n);",
    para: "? 'R$ 0,00' : brl(n);",
    porque: 'faz o valor ausente virar R$ 0,00 — o defeito real dos 7.456 itens na tela onde se '
      + 'decide preco' },
];

const filtro = process.argv[2];
const lista = filtro ? MUTACOES.filter(m => m.catraca.includes(filtro)) : MUTACOES;
if (!lista.length) { console.error('nenhuma mutacao casa com "' + filtro + '"'); process.exit(1); }

let ok = 0, falhou = 0, sujo = [];
console.log('MUTACAO DAS CATRACAS — quebra de proposito, confere o vermelho, restaura.\n');

for (const m of lista) {
  const p = path.join(RAIZ, m.arquivo);
  const original = fs.readFileSync(p, 'utf8');
  let veredito = [];

  try {
    /* 1 · A MUTAÇÃO ALTEROU O ARQUIVO? */
    const alvo = original.replace(/\r\n/g, '\n');
    if (!alvo.includes(m.de)) {
      console.log('  ✗ ' + m.catraca + '  A MUTACAO NAO ENCONTROU O ALVO — o arquivo mudou de '
        + 'forma e esta mutacao virou teatro. Trecho procurado: ' + JSON.stringify(m.de.slice(0, 60)));
      falhou++; continue;
    }
    const mutado = m.primeiraOcorrencia
      ? alvo.replace(m.de, m.para)
      : alvo.split(m.de).join(m.para);
    if (mutado === alvo) {
      console.log('  ✗ ' + m.catraca + '  A MUTACAO NAO ALTEROU NADA');
      falhou++; continue;
    }
    const linhaMutada = alvo.slice(0, alvo.indexOf(m.de)).split('\n').length;
    fs.writeFileSync(p, mutado);
    veredito.push('mutou (L' + linhaMutada + ', ' + (mutado.length - alvo.length) + ' bytes)');

    /* 2 e 3 · FICOU VERMELHA, NOMEANDO ARQUIVO E LINHA? */
    const r = spawnSync(process.execPath, [path.join(RAIZ, 'tests', m.catraca + '.js')],
      { cwd: RAIZ, encoding: 'utf8' });
    const saida = (r.stdout || '') + (r.stderr || '');
    const vermelha = r.status !== 0 && /FALHA/.test(saida);
    const nomeia = new RegExp(m.arquivo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\d+').test(saida)
      || saida.includes(m.arquivo);
    const linhaCitada = (saida.match(new RegExp(m.arquivo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':(\\d+)')) || [])[1];

    if (!vermelha) veredito.push('*** NAO FICOU VERMELHA ***');
    else veredito.push('vermelha');
    if (!nomeia) veredito.push('*** NAO NOMEOU O ARQUIVO ***');
    else veredito.push('nomeou ' + m.arquivo + (linhaCitada ? ':' + linhaCitada : ''));
    if (linhaCitada && Math.abs(Number(linhaCitada) - linhaMutada) > 3)
      veredito.push('*** APONTOU L' + linhaCitada + ' e a mutacao foi na L' + linhaMutada + ' ***');

    const bom = vermelha && nomeia;
    console.log('  ' + (bom ? '✓' : '✗') + ' ' + m.catraca.padEnd(22) + veredito.join(' · '));
    console.log('      quebrou: ' + m.porque);
    if (!bom) {
      falhou++;
      console.log('      --- o que a catraca disse ---');
      saida.split('\n').filter(l => /FALHA|RESULTADO/.test(l)).slice(0, 4)
        .forEach(l => console.log('      ' + l.trim()));
    } else ok++;
  } finally {
    /* 4 · VOLTOU BYTE A BYTE? */
    fs.writeFileSync(p, original);
    if (fs.readFileSync(p, 'utf8') !== original) sujo.push(m.arquivo);
  }
}

console.log('\n───────────────────────────────');
console.log('MUTACOES: ' + ok + ' provada(s), ' + falhou + ' falha(s) de ' + lista.length);
if (sujo.length) console.log('>>> ARQUIVO NAO RESTAURADO: ' + sujo.join(', ') + ' — rode `git checkout` neles');
console.log(falhou || sujo.length ? '>>> VERMELHO' : '>>> AS 8 CATRACAS SABEM FICAR VERMELHAS');
process.exitCode = (falhou || sujo.length) ? 1 : 0;
