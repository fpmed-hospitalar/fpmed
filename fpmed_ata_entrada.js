/* ══════════════════════════════════════════════════════════════════════════════════════════════
   fpmed_ata_entrada.js — O CAMINHO DE ENTRADA DO DADO DA ATA (fatia B31, 20/08/2026)

   ══ O GARGALO, EM UMA FRASE ═════════════════════════════════════════════════════════════════
   Três telas entregues nas três rodadas anteriores funcionam e estão VAZIAS. O código acabou; o
   dado não começou. E o dado que falta não é o que o poder público publica — é o que **só o dono
   sabe**: que ata é dele, qual item ele ganhou, por quanto. Para isso não existe coleta. Existe
   caminho de entrada, ou não existe nada.

   ══ ESTE ARQUIVO É A CONTA, E A TELA SÓ PERGUNTA ════════════════════════════════════════════
   Regra que a B28 pagou para aprender: conta reimplementada dentro da tela é a família de defeito
   mais cara deste projeto. Aqui ela viraria faturamento — de novo.

   ══ AS TRÊS LEIS QUE DECIDEM CADA LINHA DAQUI ═══════════════════════════════════════════════
   1. **`null` é "não informado"; `0` é "acabou", e isso é uma afirmação.** Item marcado sem preço
      entra com preço `null` e total `null` — nunca R$ 0,00, que diria "ganhei este item de graça".
   2. **Dado digitado nunca se confunde com dado publicado.** Tudo que sai daqui é `origem:
      'digitado'`. O que a coleta publicou continua sendo do PNCP e não é reescrito por este
      caminho — os dois convivem na mesma tabela e cada linha diz de onde veio.
   3. **A quantidade do edital é SUGESTÃO, e a sugestão precisa de um clique de gente.** Ela é
      dado publicado sobre a compra, não afirmação sobre o que EU ganhei: ganhar o item 7 não quer
      dizer ganhar as 200 unidades dele. Copiar sozinho seria a tela digitando pelo usuário a
      afirmação que decide faturamento.

   ══ E UMA ARMADILHA QUE SÓ APARECE NA SEGUNDA GRAVAÇÃO ══════════════════════════════════════
   A `v_negocio_itens_ganhos` mostra **só a confirmação mais alta**. Então gravar não acrescenta:
   gravar SUBSTITUI a lista inteira desta ata. Uma tela que subisse só os itens recém-marcados
   apagaria da vista todos os anteriores — sem erro, sem aviso, e com o rastro intacto no banco
   para provar que eles existiam. Por isso `linhasParaGravar` monta a lista COMPLETA, e por isso
   ela carrega para dentro da confirmação nova o que veio da leitura por IA (marca, origem) em vez
   de rebaixar tudo a "digitado": quem não tocou numa linha não afirmou nada sobre ela.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var x = Number(v);
    return isFinite(x) ? x : null;
  }
  function soNum(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

  /* ── OS CANDIDATOS: OS ITENS DO CERTAME, CADA UM DIZENDO O QUE JÁ SE SABE DELE ───────────────
     A lista da esquerda desta fatia. Ela é dos ITENS DO EDITAL, e não do resultado publicado —
     e essa é a decisão que faz o caminho existir: se ela viesse do resultado, um item ganho cujo
     resultado o PNCP nunca publicou (ou publicou sob outro CNPJ, ou não publicou ainda) **não
     teria linha para ser marcado**. Medido em 20/08: dos 192 itens com resultado no único certame
     desta base, ZERO estão sob o nosso CNPJ. Uma lista feita do resultado nasceria vazia
     justamente na casa em que ela precisa funcionar.

     >>> `estado` NÃO É ENFEITE, É O QUE IMPEDE A TELA DE MENTIR NOS DOIS SENTIDOS:
         · 'meu_publicado'  — o PNCP publicou este item sob o NOSSO CNPJ. Já é nosso sem ninguém
                              digitar; marcar à mão aqui seria digitar por cima de dado oficial.
         · 'de_outro'       — o PNCP publicou sob OUTRO CNPJ. Marcar continua PERMITIDO e a tela
                              avisa: a publicação pode estar sob o CNPJ da matriz, ou errada. A
                              confirmação de gente manda sobre a publicação — é a lei da B5.
         · 'sem_resultado'  — o portal não publicou nada deste item. `null` é "ainda não sei", e
                              **não** "não ganhei". É o caso mais comum e o mais barato de perder.
         · 'confirmado'     — já está na nossa lista de ganhos. */
  function candidatos(itensEdital, jaGanhos, meuCnpj) {
    var meu = soNum(meuCnpj);
    var porItem = {};
    (jaGanhos || []).forEach(function (g) {
      porItem[String(g.item_n == null ? '' : g.item_n)] = g;
    });

    return (itensEdital || []).map(function (it) {
      var k = String(it.numero_item == null ? '' : it.numero_item);
      var g = porItem[k] || null;
      var rCnpj = soNum(it.resultado_cnpj);
      var rUnit = num(it.resultado_valor_unit);
      var temResultado = rUnit != null || !!it.resultado_vencedor;
      var estado = g ? 'confirmado'
        : (!temResultado ? 'sem_resultado'
          : (meu && rCnpj === meu ? 'meu_publicado' : 'de_outro'));

      return {
        item: k,
        descricao: it.descricao || null,
        unidade: it.unidade || null,
        // A QUANTIDADE DO EDITAL É REFERÊNCIA, e o nome da chave diz isso. Ela nunca vai para a
        // gravação sem passar por `copiaQuantidades`, que é um clique de gente.
        qtdEdital: num(it.quantidade),
        refEdital: num(it.valor_unitario_ref),
        resultadoUnit: rUnit,
        resultadoQtd: num(it.resultado_quantidade),
        resultadoVencedor: it.resultado_vencedor || null,
        resultadoCnpj: it.resultado_cnpj || null,
        estado: estado,
        // O QUE JÁ ESTÁ GRAVADO, quando está. É o que a tela mostra dentro do campo — e é o que
        // `linhasParaGravar` devolve intacto se ninguém mexer.
        marcado: !!g,
        quantidade: g ? num(g.quantidade) : null,
        unitario: g ? num(g.valor_unitario) : null,
        marca: g ? (g.marca || null) : null,
        marcaOrigem: g ? (g.marca_origem || null) : null,
        origem: g ? (g.origem || null) : null,
      };
    });
  }

  /* ── A LISTA QUE VAI PARA O BANCO ────────────────────────────────────────────────────────────
     `marcas` é o que a tela leu dos campos: { item, marcado, quantidade, unitario }.
     Devolve `{ linhas, erros, mudou }`.

     >>> A LISTA É COMPLETA, E NÃO O QUE MUDOU. Ver o cabeçalho: a view mostra só a confirmação
         mais alta, então uma gravação parcial apagaria da vista o que não subiu.
     >>> `total` SÓ EXISTE COM OS DOIS NÚMEROS. Quantidade sem preço não vira reais, e um total
         zerado aqui diria que o item foi ganho de graça — é a mesma regra do `saldoValor`.
     >>> NÚMERO NEGATIVO É RECUSADO E DIZ QUAL LINHA. Quantidade negativa não é dado incomum, é
         dado impossível; e recusar sem apontar a linha, numa lista de 195, é recusar sem dizer
         nada. Todo o resto passa: preço acima do teto, quantidade acima da do edital e item que o
         PNCP deu a outro são coisas que ACONTECEM, e a tela mostra em vez de barrar. */
  function linhasParaGravar(cands, marcas, quem) {
    var porItem = {};
    (marcas || []).forEach(function (m) { porItem[String(m.item)] = m; });

    var linhas = [], erros = [], mudou = false;
    (cands || []).forEach(function (c) {
      var m = porItem[c.item];
      var marcado = m ? !!m.marcado : c.marcado;
      var qtd = m && m.marcado ? num(m.quantidade) : c.quantidade;
      var unit = m && m.marcado ? num(m.unitario) : c.unitario;
      // TOCADA = alguém mexeu nos números DESTA linha agora. É o que decide a `origem` lá
      // embaixo, e é o que separa "eu afirmei este número" de "este número já estava aqui".
      var tocada = !!(m && m.marcado && (qtd !== c.quantidade || unit !== c.unitario));

      if (marcado !== c.marcado || tocada) mudou = true;

      if (!marcado) return;
      if (qtd != null && qtd < 0) erros.push('item ' + c.item + ': quantidade negativa');
      if (unit != null && unit < 0) erros.push('item ' + c.item + ': preço negativo');

      linhas.push({
        item_n: c.item,
        descricao: String(c.descricao || '(sem descrição no edital)').slice(0, 600),
        // A MARCA NUNCA É INVENTADA — e este caminho não a pergunta. Ela vem da ata lida por IA
        // ou do casamento com o estoque; aqui ela passa adiante quando já existe e fica vazia
        // quando não existe. Preenchê-la por dedução é o pior tipo de chute num documento que
        // vira faturamento.
        marca: c.marca || null,
        marca_origem: c.marcaOrigem || null,
        quantidade: qtd,
        valor_unitario: unit,
        total: (qtd != null && unit != null) ? qtd * unit : null,
        /* A ORIGEM DE QUEM JÁ ESTAVA LÁ É PRESERVADA. Rebaixar a 'digitado' uma linha que veio de
           leitura por IA seria esta tela AFIRMANDO que alguém digitou aquele número — e "número
           lido" e "número digitado" erram de jeitos diferentes, que é o motivo de a coluna
           existir. Só é 'digitado' o que passou por este caminho. */
        origem: (c.marcado && c.origem && !tocada) ? c.origem : 'digitado',
        confirmado_por: quem || null,
        // 0 = "banco, escolha". MEDIDO em 20/08: omitir esta coluna deixa o `default 1` e a
        // gravação nunca sucede a anterior — as duas listas apareceriam misturadas na view.
        confirmacao: 0,
      });
    });
    return { linhas: linhas, erros: erros, mudou: mudou };
  }

  /* ── OS TOTAIS DA MARCAÇÃO, COM O QUE FICOU DE FORA ──────────────────────────────────────────
     Todo total desta casa diz quantas linhas não entraram nele. Aqui há DOIS motivos de ficar de
     fora, e eles pedem ações diferentes de quem lê: `semQtd` é trabalho que falta (ninguém
     digitou), `semPreco` é o número que decide o faturamento e ainda não foi dito. */
  function totaisMarcacao(cands, marcas) {
    var r = linhasParaGravar(cands, marcas, null);
    var t = { marcados: 0, semQtd: 0, semPreco: 0, comTotal: 0, total: 0, unidades: 0 };
    r.linhas.forEach(function (l) {
      t.marcados++;
      if (l.quantidade == null) t.semQtd++; else t.unidades += l.quantidade;
      if (l.valor_unitario == null) t.semPreco++;
      if (l.total != null) { t.total += l.total; t.comTotal++; }
    });
    return t;
  }

  /* ── A COPIA DAS QUANTIDADES DO EDITAL ───────────────────────────────────────────────────────
     Um clique de gente, e só sobre os itens JÁ MARCADOS. Copiar para os não marcados encheria de
     número uma lista de 195 itens que a pessoa ainda não escolheu — e depois ninguém saberia
     quais ela escolheu de verdade.
     >>> E ELA NÃO SOBRESCREVE O QUE JÁ FOI DIGITADO. Quem escreveu 50 onde o edital diz 200 tinha
         um motivo; um botão de conveniência que apaga a digitação de alguém é um botão que faz
         estrago calado. */
  function copiaQuantidades(cands, marcas) {
    var porItem = {};
    (marcas || []).forEach(function (m) { porItem[String(m.item)] = m; });
    var saida = [], copiadas = 0, semQtdNoEdital = 0;
    (cands || []).forEach(function (c) {
      var m = porItem[c.item];
      if (!m || !m.marcado) return;
      if (num(m.quantidade) != null) { saida.push(m); return; }
      if (c.qtdEdital == null) { semQtdNoEdital++; saida.push(m); return; }
      copiadas++;
      saida.push({ item: c.item, marcado: true, quantidade: c.qtdEdital, unitario: m.unitario });
    });
    return { marcas: saida, copiadas: copiadas, semQtdNoEdital: semQtdNoEdital };
  }

  /* ── O ARQUIVAMENTO DA ATA ───────────────────────────────────────────────────────────────────
     Espelho do cofre da B27: `arquivado = true` COM carimbo e motivo, nunca DELETE. Ata é papel
     de prova — quem tirou uma da frente um dia vai precisar mostrar que ela existiu.
     >>> O MOTIVO É OBRIGATÓRIO, e é a única recusa daqui. Sem motivo a gaveta vira um cemitério
         anônimo: daqui a seis meses ninguém sabe se a ata saiu porque foi cadastrada por engano,
         porque acabou, ou porque alguém errou o clique — e a diferença entre as três decide se
         ela volta.
     >>> DESARQUIVAR NÃO APAGA O CARIMBO. `arquivado_em` volta a nulo (é ele que a gaveta e a
         `v_atas_vigencia` filtram), e `desarquivado_em` guarda que a ata já saiu uma vez. Quem
         desfaz um ato não desfaz o fato de ter feito. */
  var MOTIVOS_ARQUIVO = [
    'cadastrada por engano',
    'ata encerrada (saldo esgotado)',
    'ata cancelada pelo órgão',
    'registro de teste',
    'outro',
  ];

  function pedidoArquivar(motivo, texto, quem, agoraISO) {
    var m = String(motivo || '').trim();
    if (!m) return { ok: false, erro: 'escolha o motivo — a gaveta sem motivo é um cemitério anônimo.' };
    if (m === 'outro') {
      var t = String(texto || '').trim();
      if (!t) return { ok: false, erro: 'escreva o motivo.' };
      m = t.slice(0, 200);
    }
    return { ok: true, campos: {
      arquivado: true,
      arquivado_em: agoraISO || new Date().toISOString(),
      arquivado_motivo: m,
      arquivado_por: quem || null,
      arquivado_origem: 'decisao',
    } };
  }

  /* ── O ARQUIVAR DO KANBAN (fatia B34, 21/08/2026) ────────────────────────────────────────────
     ══ O DEFEITO QUE ESTAVA AQUI, E ELE DERROTAVA A REGRA DA B31 NO PRIMEIRO CLIQUE ═══════════
     A B31 (20/08) construiu uma distinção de dois estados e pendurou duas views nela:
       · nasceu arquivado na importação -> `arquivado = true`, `arquivado_em` NULO
       · alguém DECIDIU tirar           -> `arquivado_em` preenchido, com motivo e autor
     A `v_atas_vigencia` e a `v_atas_arquivadas` filtram pelo CARIMBO justamente por isso.

     Só que o botão "Arquivar" do kanban gravava `{ arquivado: true }` E MAIS NADA. Ou seja: a
     partir do primeiro clique de gente, a decisão da pessoa ficava BYTE A BYTE IGUAL às 2.551
     linhas da importação — a distinção existia no banco e morria no botão.
     >>> E O RASTRO DISSO ESTÁ NO DADO: 8 linhas (origem `licitacoes`, `manual` e as de prova)
         estão arquivadas sem carimbo nenhum. Foram cliques. O banco não tem como dizer quando.
     >>> O PIOR CASO É A ATA. Arquivar uma ata pelo kanban tirava o cartão do funil e DEIXAVA a
         ata no painel de vigência e na lista da manhã — porque a view só olha o carimbo. O dono
         arquivava, e a tela continuava cobrando. Nenhum erro aparecia.

     ══ POR QUE A ATA É RECUSADA AQUI EM VEZ DE SER RESOLVIDA AQUI ══════════════════════════════
     Porque o motivo é obrigatório para ata (a razão está três parágrafos acima) e o kanban não
     tem onde pedir motivo. Fazer o kanban arquivar ata sem motivo consertaria a view e criaria o
     cemitério anônimo — trocaria um defeito por outro que a casa já decidiu não ter. A recusa
     manda para o único lugar que faz a coisa inteira, e ele fica na MESMA ficha, logo abaixo. */
  function pedidoArquivarNegocio(negocio, quem, agoraISO) {
    var n = negocio || {};
    if (n.estagio === 'contrato') {
      return { ok: false, erro: 'Esta é uma ATA: arquive por "Arquivar esta ata", na aba Ata desta '
        + 'mesma ficha — lá o motivo é obrigatório, e é ele que tira a ata do painel de vigência '
        + 'e da lista da manhã. Arquivar por aqui tiraria só o cartão do funil.' };
    }
    return { ok: true, campos: {
      arquivado: true,
      arquivado_em: agoraISO || new Date().toISOString(),
      arquivado_por: quem || null,
      arquivado_origem: 'decisao',
    } };
  }

  /* A VOLTA É UMA SÓ, e é esta, para os dois caminhos. Duas funções com o mesmo nome e conteúdo
     diferente é como a casa já perdeu um checklist de 15 itens que virou 14 num lugar só. */
  function pedidoDesarquivar(agoraISO) {
    return { arquivado: false, arquivado_em: null,
             desarquivado_em: agoraISO || new Date().toISOString() };
  }

  raiz.FPMED_ATA_ENTRADA = {
    candidatos: candidatos,
    linhasParaGravar: linhasParaGravar,
    totaisMarcacao: totaisMarcacao,
    copiaQuantidades: copiaQuantidades,
    pedidoArquivar: pedidoArquivar,
    pedidoArquivarNegocio: pedidoArquivarNegocio,
    pedidoDesarquivar: pedidoDesarquivar,
    MOTIVOS_ARQUIVO: MOTIVOS_ARQUIVO,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.FPMED_ATA_ENTRADA;
})(typeof window !== 'undefined' ? window : globalThis);
