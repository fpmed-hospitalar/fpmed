/* ══════════════════════════════════════════════════════════════════════════════════════════════
   fpmed_ata_saldo.js — O SALDO DA ATA (fatia B30, 20/08/2026)

   ══ A PERGUNTA QUE FALTAVA ══════════════════════════════════════════════════════════════════
   A B23 destravou a aba Ata, quando achou o `valor_ganho` fazendo de porteiro do que a tela
   mostrava. O que ficou faltando é a pergunta que o gestor faz toda semana: **"dessa ata que eu
   ganhei, quanto ainda posso entregar?"** Ata sem saldo é papel; ata com saldo é agenda de
   faturamento.

   ══ A REGRA QUE MANDA NESTE ARQUIVO INTEIRO ═════════════════════════════════════════════════
   **`null` é "não informado". `0` é "acabou", e isso é uma afirmação.**
   Uma ata recém-cadastrada tem TODO saldo desconhecido. Preencher com zero — ou, pior, deduzir
   "ninguém empenhou ainda, então empenhado = 0" — faria a tela dizer que o órgão não comprou nada
   quando a verdade é que ninguém olhou. As duas frases levam a decisões opostas: uma manda cobrar
   o órgão, a outra manda esquecer a ata.
   >>> E O SALDO SEGUE A MESMA LEI. Sem empenho informado, o saldo é `null` — nunca a quantidade
       inteira. "Ainda posso entregar tudo" é uma afirmação sobre o órgão que ninguém verificou.

   ══ O QUE ESTE ARQUIVO NÃO FAZ ══════════════════════════════════════════════════════════════
   · Não inventa empenho a partir de nada. MEDIDO em 20/08: **não existe empenho por item em
     nenhuma tabela desta casa** — nem no índice do PNCP, nem em `negocio_itens_ganhos` (que tem
     ZERO linhas). Enquanto a fonte não existir, o número vem de gente e sai marcado como tal.
   · Não soma o que não sabe. O total de saldo soma só as linhas informadas e DIZ quantas ficaram
     de fora. Tratar desconhecido como zero num total é a forma silenciosa de mentir: o número
     fecha, parece completo, e está errado para baixo.
   · Não recusa número estranho. Entregue maior que empenhado acontece (o órgão pede antes de
     lançar o empenho). A tela MOSTRA a incoerência; recusar a digitação empurraria o dado para o
     caderno de alguém, fora do sistema.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var x = Number(v);
    return isFinite(x) ? x : null;
  }

  /* ── AS LINHAS DA ATA COM SALDO ─────────────────────────────────────────────────────────────
     `itens` são as linhas que a aba Ata já mostra (a junção das duas fontes: o que NÓS
     confirmamos e o que o PNCP publicou sob o nosso CNPJ). `saldos` são as linhas da `ata_saldo`,
     que é o que alguém digitou.
     >>> A FONTE DOS ITENS É A MESMA DO QUADRO DE CIMA, e isso é decisão de projeto. Uma segunda
         lista de itens da ata seria o par que um dia diverge — e aqui ele já divergiu uma vez
         (a B23 achou a aba Itens mostrando o resultado do PNCP e a aba Ata mostrando nada). */
  function linhas(itens, saldos) {
    var porItem = {};
    (saldos || []).forEach(function (s) { porItem[String(s.item_n)] = s; });

    return (itens || []).map(function (it) {
      var k = String(it.item == null ? '' : it.item);
      var s = porItem[k] || null;
      var qtd = num(it.quantidade);
      var unit = num(it.unitario);
      var emp = s ? num(s.empenhado) : null;
      var ent = s ? num(s.entregue) : null;

      /* O SALDO É `null` QUANDO NÃO SE SABE O EMPENHO, e não a quantidade inteira. Ver o
         cabeçalho: "ainda posso entregar tudo" é uma afirmação sobre o órgão.
         E é `null` também quando a QUANTIDADE não é conhecida — item de ata sem quantidade
         publicada existe, e subtrair de um número que não existe daria um saldo negativo com
         cara de conta. */
      var saldo = (qtd != null && emp != null) ? qtd - emp : null;
      var aEntregar = (emp != null && ent != null) ? emp - ent : null;

      var alertas = [];
      if (qtd != null && emp != null && emp > qtd)
        alertas.push('empenhado maior que a quantidade registrada');
      if (emp != null && ent != null && ent > emp)
        alertas.push('entregue maior que o empenhado');

      return {
        item: k,
        descricao: it.descricao || null,
        unidade: it.unidade || null,
        quantidade: qtd,
        unitario: unit,
        empenhado: emp,
        entregue: ent,
        saldo: saldo,
        aEntregar: aEntregar,
        // O SALDO EM DINHEIRO é o que responde "quanto ainda dá para faturar". Sem preço unitário
        // ele fica `null`: quantidade sem preço não vira reais, e um R$ 0,00 aqui seria dizer que
        // o saldo não vale nada.
        saldoValor: (saldo != null && unit != null) ? saldo * unit : null,
        informado: !!s,
        origem: s ? s.origem : null,
        informadoPor: s ? s.informado_por : null,
        informadoEm: s ? (s.atualizado_em || s.informado_em) : null,
        observacao: s ? s.observacao : null,
        alertas: alertas,
        nosso: !!it.nosso,
      };
    });
  }

  /* ── OS TOTAIS, E O QUE ELES DIZEM QUE NÃO SABEM ────────────────────────────────────────────
     Todo total vem com o número de linhas que NÃO entraram nele. Um total sozinho parece completo
     — e é exatamente assim que "R$ 120 mil de saldo" esconde que metade da ata não foi informada.
     >>> `semInfo` E `semPreco` SÃO COISAS DIFERENTES: a primeira é trabalho que falta (ninguém
         digitou o empenho), a segunda é dado que o certame não publicou. As duas tiram a linha do
         total, e por motivos que exigem ações diferentes de quem lê. */
  function totais(ls) {
    var t = { itens: 0, registrado: 0, empenhado: 0, entregue: 0, saldo: 0, saldoValor: 0,
              semInfo: 0, semPreco: 0, semQtd: 0, comAlerta: 0, valorTotal: 0,
              comSaldo: 0, comValor: 0 };
    (ls || []).forEach(function (l) {
      t.itens++;
      if (l.quantidade != null) t.registrado += l.quantidade; else t.semQtd++;
      if (l.quantidade != null && l.unitario != null) t.valorTotal += l.quantidade * l.unitario;
      if (!l.informado || l.empenhado == null) { t.semInfo++; }
      else {
        t.empenhado += l.empenhado;
        if (l.entregue != null) t.entregue += l.entregue;
      }
      if (l.saldo != null) { t.saldo += l.saldo; t.comSaldo++; }
      if (l.saldo != null && l.unitario == null) t.semPreco++;
      if (l.saldoValor != null) { t.saldoValor += l.saldoValor; t.comValor++; }
      if (l.alertas && l.alertas.length) t.comAlerta++;
    });
    /* ══ OS DOIS CONTADORES QUE FAZEM O TOTAL PODER SE CALAR ═════════════════════════════════
       `comSaldo` e `comValor` são quantas linhas ENTRARAM em cada soma — e sem eles a tela não
       tem como distinguir os dois estados que este arquivo inteiro existe para separar:
       **"o saldo somou zero"** e **"nenhuma linha tinha saldo para somar"**. Nos dois casos
       `t.saldo` é `0`, e os dois `0` mandam o gestor para lados opostos: um diz "a ata acabou,
       esqueça", o outro diz "ninguém informou nada, vá cobrar". Numa ata recém-cadastrada — que
       é o estado de TODAS as 108 atas desta casa hoje — o segundo é sempre o verdadeiro. */
    return t;
  }

  /* ── A VALIDADE DA ATA ──────────────────────────────────────────────────────────────────────
     A mesma lei do "ainda dá tempo" da tela Encontrar: o que tem prazo responde primeiro.
     >>> O CORTE DE "VENCENDO" É 60 DIAS, e não os 30 do cofre de certidões. A diferença tem
         motivo: certidão se tira em dias, e um aviso de 30 dias é folga de sobra. Esvaziar o saldo
         de uma ata é vender, empenhar e entregar — isso não se faz em trinta dias, e um aviso que
         chega quando já não dá tempo é um aviso que só serve para dar a notícia.
     >>> `null` NA DATA NÃO É "NÃO VENCE". Ata sempre vence — em regra, doze meses. Data em branco
         é data que ninguém digitou, e a tela diz isso: prometer "não vence" seria a tela afirmando
         uma coisa sobre um contrato que ela não leu. */
  function vigencia(fim, hoje) {
    var f = String(fim == null ? '' : fim).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f))
      return { situacao: 'sem_vigencia', dias: null };
    var h = String(hoje || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(h)) h = hojeISO();
    /* ══ A DIFERENÇA EM DIAS, E UMA CORREÇÃO QUE EU DEVO A ESTE ARQUIVO ═══════════════════════
       Aqui estava escrito que sem o `T12:00:00` uma ata que vence HOJE sairia "vence amanhã",
       porque `new Date('2026-08-20')` monta meia-noite UTC. **Fui medir e a frase era falsa.**
       Com UTC-3, as três formas (meio-dia local, meia-noite local, sem sufixo) devolvem 0, 61 e
       -1 nos mesmos casos — porque quem absorve o deslocamento de 3 horas é o `Math.round`, e
       não o horário escolhido. Eu tinha escrito um perigo plausível sem medi-lo, que é
       exatamente o que esta casa cobra de quem escreve aqui.
       >>> O QUE FAZ O TRABALHO, ENTÃO, É O `Math.round` — e é ele que precisa ser vigiado.
           Trocá-lo por `Math.floor` faz a ata que vence HOJE sair como "venceu há 1 dia" no
           primeiro fuso a leste, e trunca todo prazo para baixo. É a mutação que a catraca cobra.
       >>> E O `T12:00:00` FICA, com o motivo VERDADEIRO: ele afasta os dois lados 12 horas de
           qualquer virada de dia, então nenhum fuso do planeta (o extremo é UTC+14) empurra a
           conta para o degrau errado. É folga barata contra um erro caro — mas é folga, não é a
           regra, e o comentário não pode vender uma pela outra. */
    var dias = Math.round((new Date(f + 'T12:00:00') - new Date(h + 'T12:00:00')) / 86400000);
    return {
      dias: dias,
      situacao: dias < 0 ? 'vencida' : (dias <= 60 ? 'vencendo' : 'vigente'),
    };
  }

  function hojeISO(d) {
    var x = d || new Date();
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-'
         + String(x.getDate()).padStart(2, '0');
  }

  /* ── A ORDEM: QUEM VENCE PRIMEIRO ───────────────────────────────────────────────────────────
     A ordem do dinheiro indo embora. As sem vigência ficam no FIM, nunca no topo: "sem data" no
     lugar de destaque parece a mais urgente, e é o contrário — é a que ninguém sabe. */
  function ordenaPorVencimento(atas) {
    return (atas || []).slice().sort(function (a, b) {
      var fa = a && a.ata_vigencia_fim ? String(a.ata_vigencia_fim).slice(0, 10) : null;
      var fb = b && b.ata_vigencia_fim ? String(b.ata_vigencia_fim).slice(0, 10) : null;
      if (!fa && !fb) return (a.id || 0) - (b.id || 0);
      if (!fa) return 1;
      if (!fb) return -1;
      if (fa === fb) return (a.id || 0) - (b.id || 0);
      return fa < fb ? -1 : 1;
    });
  }

  raiz.FPMED_ATA_SALDO = {
    linhas: linhas, totais: totais, vigencia: vigencia,
    ordenaPorVencimento: ordenaPorVencimento, hojeISO: hojeISO,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.FPMED_ATA_SALDO;
})(typeof window !== 'undefined' ? window : globalThis);
