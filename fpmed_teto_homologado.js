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
        // O VENCEDOR. O nome vai porque órgão público publica o vencedor por obrigação legal.
        vencedor: l.resultado_vencedor || null,
        /* ══ O CNPJ ENTROU NO ÍNDICE NA B35, E ELE NÃO VAI PARA A TELA ═══════════════════════
           Até a B34 o índice descartava o CNPJ, e o comentário aqui dizia por quê. A B35 mostrou
           que descartá-lo estava errado por um motivo que não era o da tela: **ele é a
           IDENTIDADE do fornecedor, e o nome não é.** Medido nos 3.437 com preço: 392 CNPJs
           para 404 grafias de nome — 12 CNPJs aparecem com dois nomes diferentes, e nem sempre
           por erro de digitação ("APAMED HOSPITALAR EIRELI" e "APAMED HOSPITALAR LTDA- EPP" são
           a mesma empresa depois da conversão de EIRELI; "C A DISTRIBUIDORA DE PRODUTOS
           HOSPITALARES EIRELI" e "C.A. HOSPITALAR LTDA" também). Agrupar por nome partiria um
           fornecedor em dois e diria que cada metade ganhou metade das vezes.
           >>> E o inverso foi medido e NÃO acontece: zero nomes compartilhados por dois CNPJs.
           >>> O QUE CONTINUA VALENDO É A REGRA DA TELA: sai o NOME, nunca o CNPJ. O CNPJ é a
               chave de junção e o campo de exportação; nome de concorrente já é público por
               obrigação legal, e o número que identifica a empresa não precisa estar em
               destaque numa tela onde alguém está montando preço. */
        cnpj: l.resultado_cnpj || null,
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

  /* ── QUEM MAIS ESTÁ GANHANDO (fatia B35, 21/08/2026) ────────────────────────────────────────
     ══ A PERGUNTA QUE O GESTOR FAZ DEPOIS DE PERDER ═════════════════════════════════════════════
     *"Quem levou, e por quanto?"* — e ela é DIFERENTE da que o `avaliar` responde. O `avaliar`
     devolve a faixa de preço; este devolve as PESSOAS: quem ganhou este produto, quantas vezes, em
     que faixa cada um praticou.

     ══ O QUE ESTA FUNÇÃO SE RECUSA A FAZER, E O NÚMERO QUE SUSTENTA A RECUSA ═══════════════════
     Ela é POR PRODUTO e nunca global. Não existe aqui "os maiores fornecedores", e não é
     conservadorismo — é medição. Nos **3.437** resultados COM PREÇO de 288 certames (são 3.475
     linhas com resultado, e 38 delas trazem preço zero em 8 certames — zero não é preço
     homologado, é a mesma lei do `valor_unitario_ref`) há **392 fornecedores**, e **344 deles
     ganharam exatamente UM certame**: 88%. O maior de todos ganhou SEIS. Um ranking construído
     sobre isso seria uma lista em que quase nove de cada dez linhas valem n=1, publicada com a
     autoridade de quem mediu o Brasil. Com 288 certames de um país que faz dezenas de milhares
     por ano, "o maior fornecedor" é uma frase que o dado não pode assinar.
     >>> E OS NÚMEROS ACIMA NÃO ENVELHECEM CALADOS: a `tools/prova_b35_quem_ganhou.js` os mede de
         novo contra o banco a cada rodada e diz o de hoje, em vez de repetir o de ontem.
     >>> POR ISSO TODA RESPOSTA CARREGA `certames`. O denominador não é enfeite do rodapé: ele vai
         junto com o número, porque é ele que diz se o número quer dizer alguma coisa.

     ══ E ELA DIZ QUANDO A PRÓPRIA FAIXA NÃO MERECE CONFIANÇA ═══════════════════════════════════
     A pendência 5 do relatório do A (rodada 9) apontava que a chave fica ambígua em descrição
     curta — "OLEO" junta R$ 8,99 com R$ 45,00 — e sugeria um piso de comprimento. **Medi, e o
     comprimento é o critério errado.** Dos 150 produtos com dois ou mais resultados, 20 têm chave
     de 12 caracteres ou menos; num corte de 3x entre o maior e o menor preço, 9 produtos ficam
     marcados e **só 2 deles são de chave curta**. Os piores são LONGOS:
       · "FILTRO COMBUSTIVEL TIPO COMBUSTIVEL OLEO DIE…" (44 chars, 8 resultados) R$ 18 a R$ 229
       · "FILTRO TIPO AGUA PARA ARREFECIMENTO MATERIAL…" (3 resultados) R$ 46 a R$ 389
     enquanto CEBOLA, CENOURA e MELANCIA — chaves de 6 a 8 letras — variam 1,1x, que é mercado e
     não confusão. Um piso de comprimento silenciaria treze produtos bem-comportados e deixaria
     passar os sete que mais enganam.
     >>> O QUE SEPARA "a chave juntou coisas diferentes" de "o mercado é largo" não está no
         tamanho do texto: está na DISPERSÃO DOS PREÇOS, que é medida e não suposta. O corte é 3x,
         e ele marca 6% dos produtos (9 de 150) — a p90 de todos é 1,69x e a p95 é 4,29x.
     >>> E ELE NÃO ESCONDE NADA. Marcar não tira o produto da lista: faz a tela mostrar os
         resultados um a um em vez de liderar com uma mediana que ninguém pode defender. Filtrar
         em silêncio é o que transformaria este número numa opinião. */
  const LIMITE_DISPERSAO = 3;

  /* Qual nome mostrar quando o mesmo CNPJ aparece com duas grafias: o MAIS RECENTE, porque
     empresa que trocou de nome deve aparecer pelo nome de agora. Empate por data cai na grafia
     mais frequente, e empate nisso cai na ordem alfabética — a terceira regra existe só para a
     resposta ser a MESMA em duas aberturas da tela. Nome que muda a cada repintura faz o usuário
     achar que são dois fornecedores. */
  function nomeDoFornecedor(linhas) {
    const freq = new Map();
    for (const l of linhas) {
      if (!l.vencedor) continue;
      const a = freq.get(l.vencedor) || { n: 0, data: null };
      a.n++;
      if (l.data && (!a.data || String(l.data) > String(a.data))) a.data = l.data;
      freq.set(l.vencedor, a);
    }
    const nomes = [...freq.entries()];
    if (!nomes.length) return null;
    nomes.sort((x, y) => {
      const dx = x[1].data || '', dy = y[1].data || '';
      if (dx !== dy) return dy.localeCompare(dx);
      if (x[1].n !== y[1].n) return y[1].n - x[1].n;
      return x[0].localeCompare(y[0]);
    });
    return nomes[0][0];
  }

  function quemGanhou(pedido, idx) {
    if (!idx || !idx.por) return null;          // não sei — o índice não carregou
    const p = pedido || {};
    const k = chave(p.descricao);
    if (!k) return { n: 0, chave: '', certames: 0, fornecedores: [],
                     motivo: 'sem descrição para comparar' };

    const ign = p.ignorar || {};
    const achados = (idx.por.get(k) || []).filter(x =>
      !(ign.numero_controle && x.numero_controle === ign.numero_controle
        && String(ign.numero_item) === x.numero_item));

    if (!achados.length) return { n: 0, chave: k, certames: 0, fornecedores: [],
                                  truncado: !!idx.truncado };

    /* A IDENTIDADE É O CNPJ. Sem CNPJ publicado, a linha vira o seu próprio grupo com a chave
       `sem-cnpj:<nome>` — juntar todos os "sem CNPJ" num balde só afirmaria que são a mesma
       empresa, que é exatamente o erro que o CNPJ existe para não cometer. */
    const grupos = new Map();
    for (const a of achados) {
      const id = a.cnpj || ('sem-cnpj:' + (a.vencedor || '?'));
      if (!grupos.has(id)) grupos.set(id, []);
      grupos.get(id).push(a);
    }

    const fornecedores = [...grupos.entries()].map(([id, linhas]) => {
      const vs = linhas.map(x => x.valor).filter(x => isFinite(x) && x > 0);
      const certames = new Set(linhas.map(x => x.numero_controle).filter(Boolean)).size;
      return {
        // o CNPJ VAI no objeto (é ele que responde "fui eu?" e é o campo de exportação); quem
        // pinta a tela usa `nome`. A regra de não mostrar está na tela, e não em esconder o dado.
        cnpj: linhas[0].cnpj || null,
        nome: nomeDoFornecedor(linhas),
        vezes: linhas.length,
        certames,
        min: vs.length ? Math.min.apply(null, vs) : null,
        max: vs.length ? Math.max.apply(null, vs) : null,
        mediana: mediana(vs),
        /* MESMA REGRA DO `temFaixa` DO `avaliar`: com um resultado só, min e max são o mesmo
           número, e "de R$ 27 a R$ 27" faz uma medida única parecer uma pesquisa. */
        temFaixa: vs.length > 1 && Math.min.apply(null, vs) !== Math.max.apply(null, vs),
      };
    });

    // mais vezes primeiro; empate pelo nome, para a ordem não mudar entre duas aberturas.
    fornecedores.sort((a, b) => (b.vezes - a.vezes)
      || (b.certames - a.certames)
      || String(a.nome || '').localeCompare(String(b.nome || '')));

    const valores = achados.map(x => x.valor).filter(x => isFinite(x) && x > 0);
    const min = valores.length ? Math.min.apply(null, valores) : null;
    const max = valores.length ? Math.max.apply(null, valores) : null;
    const razao = (min != null && min > 0 && max != null) ? max / min : null;

    const certames = new Set(achados.map(x => x.numero_controle).filter(Boolean)).size;
    return {
      n: achados.length,
      chave: k,
      certames,
      fornecedores,
      /* AS TRÊS BANDEIRAS QUE A TELA USA PARA NÃO EXAGERAR, e as três são fatos, não opiniões:
         · `umResultado` .. um resultado só não é histórico, é um caso.
         · `umFornecedor` . ninguém "ganha mais" quando só há um nome nos dados que temos.
         · `disperso` ..... os preços variam demais para uma mediana só responder pelos dois. */
      umResultado: achados.length === 1,
      umFornecedor: fornecedores.length === 1,
      razao,
      /* A CONDIÇÃO AQUI É SÓ A RAZÃO, e ela já cobre o caso de um resultado só: com uma linha,
         `min` e `max` são o mesmo número e a razão é exatamente 1. Havia aqui um
         `achados.length > 1 &&` que parecia zelo e era CÓDIGO MORTO — a `tools/muta_b35.js`
         provou apagando-o e nada mudou. Guarda que nunca pode disparar ensina a próxima pessoa
         que as guardas deste arquivo são decorativas. */
      disperso: razao != null && razao >= LIMITE_DISPERSAO,
      min, max,
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

  raiz.FPMED_TETO_HOMOLOGADO = { chave, mediana, indexa, avaliar, cobertura,
                                 quemGanhou, nomeDoFornecedor, LIMITE_DISPERSAO };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.FPMED_TETO_HOMOLOGADO;
})(typeof window !== 'undefined' ? window : globalThis);
