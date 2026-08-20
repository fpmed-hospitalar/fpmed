/* ══════════════════════════════════════════════════════════════════════════════════════════════
   fpmed_teto_homologado.js — O TETO COMPETITIVO (fatia B28, 20/08/2026)

   ══ O BURACO QUE ELE FECHA ══════════════════════════════════════════════════════════════════
   O `docs/BASE_FUNCOES_PROFISSIONAIS.md` abre com a frase que é o maior buraco deste produto:
   **"nós damos ao gestor o teto legal e não damos o teto competitivo."** A CMED diz até onde é
   PERMITIDO cobrar. Ninguém diz por quanto aquele item **já foi vendido de verdade** para o poder
   público. Quem sabe disso ganha o pregão; quem não sabe, chuta.
   O dado existe: `licitacao_itens.resultado_valor_unit` e companhia. Este arquivo é a regra que
   transforma essas linhas numa resposta — e ele é UM arquivo porque duas telas fazem a mesma
   pergunta. Duas implementações de "por quanto isto já saiu?" dariam dois números para o mesmo
   item, e um deles estaria errado sem ninguém saber qual. É a família de defeito mais cara deste
   projeto (o preço unitário) e ela não vai se repetir aqui.

   ══ A COBERTURA HOJE, MEDIDA E NÃO ESTIMADA (20/08/2026) ════════════════════════════════════
     · 310.982 itens de edital no índice
     · 192 com resultado homologado  ->  0,06%
     · e os 192 vêm de UM único certame (Pedra Bonita/MG, pregão eletrônico, material escolar)
     · 192 resultados  ->  192 chaves DISTINTAS: **nenhum produto se repete**
   >>> A ÚLTIMA LINHA É A MAIS IMPORTANTE DESTA FATIA. Com o dado de hoje, o caminho da FAIXA e da
       MEDIANA — o que a caixa pede para quando há mais de um resultado do mesmo produto — **nunca
       roda**. Escrevê-lo e prová-lo só contra exemplos meus seria repetir, com todas as letras, o
       detector cego da B26: "um detector provado só contra exemplos que eu mesmo escrevi herda o
       meu engano inteiro, e herda em silêncio, com relatório verde".
       Então a mediana é provada contra um ORÁCULO INDEPENDENTE: os 192 valores REAIS da tabela,
       com o `percentile_cont` do Postgres do outro lado (`tools/prova_teto_homologado.js`). O
       Postgres não é uma fixture minha, e ele não erra do mesmo jeito que eu.

   ══ A CHAVE É ESTRITA DE PROPÓSITO, E ISSO CUSTA COBERTURA ══════════════════════════════════
   Duas descrições casam só quando dizem a MESMA coisa (descrição inteira, sem acento, sem
   pontuação, sem o número do item que o PNCP às vezes cola na frente). Um casamento frouxo daria
   mais linhas verdes e cada uma delas seria um preço de OUTRO produto no lugar do seu.
   MEDIDO nos 192: "LAPIS PRETO GRAFITE COM BORRACHA ACOPLADA" saiu por **R$ 9,30** e "LAPIS PRETO
   GRAFITE COM CORPO EM FORMATO REDONDO" saiu por **R$ 0,40**. Uma chave por primeira palavra
   casaria os dois e diria ao gestor que lápis já saiu por quarenta centavos. Num pregão isso não
   é imprecisão: é lance perdido, ou proposta inexequível.
   >>> ENTÃO O ESTADO VAZIO É A REGRA, E NÃO A EXCEÇÃO — e ele tem de dizer isso com todas as
       letras. "Ainda não temos resultado homologado para este item" é uma frase honesta; célula
       em branco, R$ 0,00 ou um travessão são três maneiras diferentes de o olho ler "não houve".

   ══ MEDIANA, NUNCA MÉDIA ════════════════════════════════════════════════════════════════════
   Um pregão desesperado (empresa que precisa de caixa, ou que errou a conta) puxa a média e não
   move a mediana. A média de [10, 10, 10, 1] é 7,75 — um preço que ninguém praticou. A mediana é
   10, que é o que o mercado faz. Quem monta preço pela média entra abaixo do que precisava.

   ══ O QUE ESTE ARQUIVO NÃO FAZ ══════════════════════════════════════════════════════════════
   · Não devolve CNPJ para a tela. O `resultado_cnpj` FICA no dado — ele é o que responde "fui eu
     que ganhei?" e o Negócios já o usa para isso. O que não sai é o CNPJ **na tela de proposta**:
     nome de concorrente em destaque ali é convite para o uso errado.
   · Não publica percentual de cobertura por produto. Ele sabe quantos resultados ACHOU; não sabe
     quantos itens iguais existem no Brasil. Percentual sem denominador conhecido é número
     inventado com cara de medida.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  /* A mesma normalização sem acento das telas da casa (`semAcento`), escrita aqui porque este
     arquivo é carregado ANTES delas e não pode depender de qual tela o incluiu. */
  function semAcento(s) {
    let o = '';
    for (const c of String(s == null ? '' : s).normalize('NFD')) {
      const k = c.codePointAt(0);
      if (k >= 0x300 && k <= 0x36f) continue;
      o += c;
    }
    return o;
  }

  /* ── A CHAVE ────────────────────────────────────────────────────────────────────────────────
     >>> O PREFIXO `"12 , "` É REAL E FOI MEDIDO: em 204 dos 310.982 itens do índice a descrição
         publicada começa com o próprio número do item e uma vírgula ("103 , LAPIS PRETO..."). E
         192 desses 204 são justamente os que TÊM resultado — ou seja, é do jeito de publicar
         daquele órgão, não uma regra geral. Sem tirar o prefixo, o mesmo produto publicado como
         item 12 num edital e item 47 noutro nunca casaria, e o motivo seria invisível.
     >>> A PONTUAÇÃO VIRA ESPAÇO em vez de sumir: "CX/100" e "CX 100" são a mesma coisa dita de
         dois jeitos; apagar a barra colaria "CX100", que é outra palavra. */
  /* >>> `NFKD` E NÃO `NFD`, E ISSO FOI UM DEFEITO ACHADO PELA PRÓPRIA CATRACA DESTA FATIA.
         O `NFD` decompõe acento, mas NÃO desfaz sobrescrito: `M²` continua sendo o caractere
         U+00B2, o filtro `[^A-Z0-9]` o joga fora, e a chave de "PAPEL A4 75G/M²" sai
         "PAPEL A4 75G M" enquanto a de "papel a4 75g m2" sai "PAPEL A4 75G M2". O MESMO produto,
         duas chaves, e o casamento nunca aconteceria.
     >>> E NÃO É HIPÓTESE DE LABORATÓRIO: **27 dos 192** resultados que existem hoje têm `²`, `³`,
         `º` ou `ª` na descrição — 14% deles. "GRAMATURA DE 200 G/M²" está literalmente lá. Com
         `NFD`, um sétimo do pouco dado que temos ficaria fora do alcance da comparação, em
         silêncio, e o sintoma seria "o teto competitivo quase nunca acha nada" — indistinguível
         da cobertura baixa que é o estado normal desta fatia. Defeito escondido atrás de um
         estado vazio legítimo é o que dura anos.
     >>> `NFKD` resolve porque ele é a normalização de COMPATIBILIDADE: ela troca `²` por `2`,
         `ª` por `a`, e a ligadura `ﬁ` por `fi`. O que ela NÃO faz é bagunçar unidade: o micro
         (`µ`) vira o mu grego, que o filtro descarta do mesmo jeito que descartava antes — então
         `µL` e `ML` continuam sendo chaves diferentes, que é o certo. */
  function chave(descricao) {
    return semAcento(String(descricao == null ? '' : descricao).normalize('NFKD'))
      .replace(/^\s*\d+\s*,\s*/, '')            // o número do item colado na frente
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  /* ── A MEDIANA ──────────────────────────────────────────────────────────────────────────────
     Par: a média dos dois do meio (é a definição, e é a mesma que o `percentile_cont` do Postgres
     usa — o que permite os dois serem conferidos um contra o outro). Ímpar: o do meio.
     >>> ORDENAÇÃO NUMÉRICA EXPLÍCITA. `[10, 9, 100].sort()` devolve `[10, 100, 9]` em JavaScript,
         porque o padrão compara TEXTO. Numa lista de preços isso não dá erro: dá uma mediana
         errada, calada, e com cara de certa. */
  function mediana(valores) {
    const v = (valores || []).map(Number).filter(x => isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /* ── O ÍNDICE ───────────────────────────────────────────────────────────────────────────────
     `linhas` são as linhas de `licitacao_itens` que TÊM `resultado_valor_unit`. `certames` é um
     mapa `numero_controle -> {orgao, municipio, uf, data}` — a tela busca à parte porque a tabela
     de itens não tem chave estrangeira declarada para `licitacoes` (é assim de propósito: item de
     licitação que veio do PNCP ao vivo não tem linha no índice).
     >>> `total` E `truncado` ENTRAM NO ÍNDICE, E NÃO SÃO ENFEITE: hoje são 192 linhas e cabem numa
         ida. No dia em que forem 30.000, a consulta vai bater no teto do servidor e devolver uma
         PARTE — e uma tela que não sabe que leu uma parte diz "não há resultado" com toda a
         convicção sobre um item que tem. Foi exatamente o defeito do `limit=3000` do Negócios.
         O índice guarda o número e a tela avisa; ninguém corta em silêncio. */
  function indexa(linhas, opcoes) {
    const o = opcoes || {};
    const certames = o.certames || {};
    const por = new Map();
    let usadas = 0;
    for (const l of (linhas || [])) {
      const valor = Number(l.resultado_valor_unit);
      // ZERO NÃO É PREÇO HOMOLOGADO. É a mesma lição do `valor_unitario_ref` (7.456 itens com
      // zero, escritos como se fossem preço): zero é um número, e número se acredita.
      if (!(valor > 0)) continue;
      const k = chave(l.descricao);
      if (!k) continue;
      const c = certames[l.numero_controle] || {};
      if (!por.has(k)) por.set(k, []);
      por.get(k).push({
        valor,
        quantidade: l.resultado_quantidade != null ? Number(l.resultado_quantidade)
                  : (l.quantidade != null ? Number(l.quantidade) : null),
        unidade: l.unidade || null,
        situacao: l.resultado_situacao || null,
        // O VENCEDOR SEM CNPJ. O nome vai porque órgão público publica o vencedor por obrigação
        // legal; o CNPJ fica no dado, onde o Negócios já o usa para responder "fui eu?".
        vencedor: l.resultado_vencedor || null,
        numero_controle: l.numero_controle,
        numero_item: String(l.numero_item == null ? '' : l.numero_item),
        orgao: c.orgao || null,
        municipio: c.municipio || null,
        uf: c.uf || null,
        /* ══ A DATA É A DA SESSÃO, NUNCA A `resultado_lido_em` ═══════════════════════════════
           `resultado_lido_em` é quando NÓS lemos o resultado — não quando o preço foi formado.
           Rotular uma como a outra seria um número certo com nome errado, e nome de dado que
           mente é pior que dado que falta: alguém compararia "preço de agosto" com um pregão de
           junho e concluiria que o mercado subiu. Quando não há data de sessão, fica `null` e a
           tela escreve "data não informada" — que é a verdade. */
        data: c.data || null,
      });
      usadas++;
    }
    return {
      por,
      linhas: usadas,
      total: o.total == null ? usadas : Number(o.total),
      truncado: !!o.truncado,
      certames,
    };
  }

  /* ── A AVALIAÇÃO ────────────────────────────────────────────────────────────────────────────
     TRÊS RESPOSTAS, E AS TRÊS SÃO DIFERENTES:
       · `null` .......... não sei — o índice não carregou. NUNCA vira "não há".
       · `{n: 0}` ........ carregou, e não há resultado para este produto. É o estado honesto, e
                           com a cobertura de hoje ele é a resposta de quase todo item.
       · `{n: 1..}` ...... há, e aqui estão a faixa, a mediana e a folga.
     >>> `ignorar` TIRA O PRÓPRIO ITEM DA CONTA. Sem isso, um item do certame de Pedra Bonita se
         compararia consigo mesmo e a tela diria "já foi homologado por R$ 27" sobre a linha cujo
         resultado É R$ 27 — uma tautologia com cara de pesquisa de mercado. O resultado do próprio
         item é outro bloco na tela, e ele diz que é do próprio item. */
  function avaliar(pedido, idx) {
    if (!idx || !idx.por) return null;
    const p = pedido || {};
    const k = chave(p.descricao);
    if (!k) return { n: 0, chave: '', motivo: 'sem descrição para comparar' };

    const ign = p.ignorar || {};
    const achados = (idx.por.get(k) || []).filter(x =>
      !(ign.numero_controle && x.numero_controle === ign.numero_controle
        && String(ign.numero_item) === x.numero_item));

    if (!achados.length) return { n: 0, chave: k, truncado: !!idx.truncado };

    const valores = achados.map(x => x.valor);
    const med = mediana(valores);
    const min = Math.min.apply(null, valores);
    const max = Math.max.apply(null, valores);

    /* A FOLGA COMPETITIVA, no MESMO formato da folga legal do teto CMED (`(teto-preço)/teto`),
       de propósito: as duas aparecem lado a lado na tela, e duas folgas com sinais invertidos
       fariam a pessoa ler "-12%" como boa numa e ruim na outra.
         positivo = o seu preço está ABAIXO do que já saiu (você tem folga para disputar)
         negativo = o seu preço está ACIMA do que já saiu (entrar assim é perder, não é ilegal)
       >>> E ELA É CONTRA A MEDIANA, não contra o mínimo: o mínimo é o lance de quem se
           desesperou, e perseguir o desespero alheio é como se monta proposta inexequível.
       >>> `null` QUANDO NÃO HÁ PREÇO PARA COMPARAR, e null NUNCA vira 0%: 0% é uma afirmação
           ("ficou exatamente no preço de mercado"), e ela seria falsa. */
    const preco = p.precoUnit != null && Number(p.precoUnit) > 0 ? Number(p.precoUnit) : null;
    const folgaPct = (preco != null && med > 0) ? ((med - preco) / med) * 100 : null;

    // o mais recente primeiro: quem tem data, por data; quem não tem, no fim (nunca no topo —
    // "sem data" no lugar de destaque parece a informação mais nova, e é o contrário).
    const ordenados = achados.slice().sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return String(b.data).localeCompare(String(a.data));
    });

    return {
      n: achados.length,
      chave: k,
      mediana: med, min, max,
      /* A FAIXA SÓ EXISTE COM MAIS DE UM. Com um resultado só, `min` e `max` são o MESMO número,
         e escrever "de R$ 27 a R$ 27" faz uma medida única parecer uma pesquisa. */
      temFaixa: achados.length > 1 && min !== max,
      folgaPct,
      recentes: ordenados,
      ultimo: ordenados[0],
      truncado: !!idx.truncado,
    };
  }

  /* ── A DÍVIDA, DITA COM NÚMERO ──────────────────────────────────────────────────────────────
     O rodapé que a caixa pediu: *"resultado homologado disponível em N de M itens desta
     licitação"*. Ele conta os itens DESTA licitação que têm resultado próprio — que é um
     denominador que a tela CONHECE. Não há aqui nenhum percentual sobre "quantos itens iguais
     existem", porque esse número ninguém sabe. */
  function cobertura(itens) {
    const lista = itens || [];
    const com = lista.filter(i => Number(i && i.resultado_valor_unit) > 0).length;
    return { com, de: lista.length };
  }

  raiz.FPMED_TETO_HOMOLOGADO = { chave, mediana, indexa, avaliar, cobertura };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.FPMED_TETO_HOMOLOGADO;
})(typeof window !== 'undefined' ? window : globalThis);
