/* CATRACA 4/8 — testa_icones (fatia A28, 15/08/2026)
   REPROVA: emoji ou pictograma escrito como TEXTO, `<img>` fazendo trabalho de ícone, e — o
   acréscimo desta fatia — `ic('nome')` apontando para um símbolo que NÃO EXISTE no sprite.

   ══ POR QUE O SÍMBOLO INEXISTENTE ENTROU NA CATRACA ═════════════════════════════════════════
   Porque ele falha em SILÊNCIO. `<use href="#ic-mais">` sem o símbolo correspondente não dá
   erro, não aparece no console e não quebra nada: simplesmente não desenha. O botão fica com o
   texto e sem o ícone, e ninguém descobre até alguém olhar. É a versão invisível do "botão que
   não faz nada" que a BASE_ENGENHARIA lista entre as oito denúncias.
   >>> E ELE É REAL AQUI: a Encontrar passou a chamar `ic('mais')` nesta fatia, e o `ic-mais`
       nasceu no sprite na fatia B19 do outro trabalhador. Se um dos dois for publicado sem o
       outro, esta linha fica vermelha no mesmo minuto, dizendo qual símbolo falta.

   ══ A FRONTEIRA DECLARADA: SETA FICA ════════════════════════════════════════════════════════
   Seta tipográfica dentro de texto corrido ("← Sistema", "abrir ↗") é CARACTERE, não desenho de
   botão. Um assert que proibisse tudo obrigaria a trocar 17 setas por SVG e deixaria a tela
   pior. A catraca conta as setas em coluna própria — declaradas, não escondidas.

   ══ E POR QUE EMOJI NÃO SERVE COMO ÍCONE ════════════════════════════════════════════════════
   Ele muda de desenho por sistema operacional e não aceita a cor da marca. O `＋` de largura
   inteira (U+FF0B) que esta tela usava é o caso mais discreto: parece um ícone, é uma letra, e
   muda com a fonte instalada na máquina de quem abriu.

     node tests/testa_icones.js
   ──────────────────────────────────────────────────────────────────────────────────────────── */
'use strict';
const path = require('path');
const { catraca, onde, R } = require('./catraca.js');

const SPRITE = require(path.join(R.RAIZ, 'fpmed_icones.js'));
const NO_SPRITE = new Set(SPRITE.ICONES.map(id => id.replace(/^ic-/, '')));

const regra = ({ arquivo, r, ok }) => {
  ok('zero pictograma como texto em ' + arquivo + ' (' + r.icones.pictograma.length + ')',
    r.icones.pictograma.length === 0,
    r.icones.pictograma.length
      ? onde(arquivo, r.icones.pictograma, a => a.cod + '  «' + a.valor + '»') : '');
  ok('zero <img> fazendo trabalho de ícone em ' + arquivo + ' (' + r.icones.img.length + ')',
    r.icones.img.length === 0,
    r.icones.img.length ? onde(arquivo, r.icones.img, a => a.valor) : '');

  /* O SÍMBOLO CHAMADO EXISTE? — a pergunta que o navegador não faz. */
  const txt = R.semComentario(R.leia(arquivo));
  const chamados = [...txt.matchAll(/\bic\(\s*['"]([a-z0-9-]+)['"]/gi)].map(m => ({
    nome: m[1], linha: R.linhaDe(txt, m.index) }));
  const orfaos = chamados.filter(c => !NO_SPRITE.has(c.nome));
  ok('todo ic(\'nome\') de ' + arquivo + ' existe no sprite ('
    + chamados.length + ' chamada(s), ' + orfaos.length + ' órfã(s))',
    orfaos.length === 0,
    orfaos.length ? onde(arquivo, orfaos, a => 'ic(\'' + a.nome + '\') — nao existe `ic-'
      + a.nome + '` em fpmed_icones.js; o <use> nao desenha nada e nao reclama') : '');

  if (r.icones.seta.length) {
    ok(arquivo + ': ' + r.icones.seta.length + ' seta(s) tipográfica(s) — fronteira DECLARADA '
      + '(seta em texto corrido é caractere, não desenho de botão)', true);
  }
};
regra.conta = r => r.icones.pictograma.length + ' pictograma(s) + ' + r.icones.img.length + ' <img>';

catraca('testa_icones', 'um sprite só, e o símbolo chamado tem que existir', regra);
