/* ══════════════════════════════════════════════════════════════════════════════════════════════
   fpmed_vai_embora.js — "O QUE ESTÁ INDO EMBORA" (fatia B32, 20/08/2026)

   ══ A PERGUNTA, E É UMA SÓ ══════════════════════════════════════════════════════════════════
   *"O que morre primeiro se eu não fizer nada hoje?"*
   Quatro rodadas construíram encanamento — o cofre de certidões, o saldo da ata, o índice de
   licitações. Cada um responde bem a SUA pergunta, em três telas diferentes, e nenhum responde a
   esta. Quem abre o sistema de manhã não quer três relatórios: quer uma lista.

   ══ TRÊS FONTES, UM SÓ RELÓGIO ══════════════════════════════════════════════════════════════
   · certidão vencendo ............ do cofre (B25/B27)  -> o verbo é RENOVAR
   · ata vencendo com saldo ....... do saldo da ata (B30) -> o verbo é EMPENHAR
   · licitação sua fechando ....... do índice (dado do A, SÓ LEITURA) -> o verbo é PROPOR

   ══ A REGRA QUE MAIS DECIDIU O DESENHO ══════════════════════════════════════════════════════
   **ESTE ARQUIVO NÃO REDEFINE O QUE É "VENCENDO".** Ele PERGUNTA a cada módulo. A certidão usa o
   `dias_aviso` do próprio documento (o alvará da vigilância e a CND federal não avisam com a
   mesma antecedência, e isso é decisão da B27); a ata usa o corte de 60 dias da B30 (esvaziar
   saldo é vender, empenhar e entregar — não se faz em trinta dias).
   >>> SE ESTA TELA TIVESSE UM CORTE PRÓPRIO, a MESMA ata sairia "vencendo" na aba Ata e ausente
       da lista da manhã — duas telas discordando sobre o mesmo contrato, e ninguém sabendo em
       qual acreditar. É exatamente o defeito que a `v_documentos_situacao` existe para evitar,
       e ele voltaria pela porta da tela nova.
   >>> A ÚNICA JANELA QUE NASCE AQUI É A DA LICITAÇÃO — 30 dias, e o critério está publicado
       abaixo, porque número com recorte publica o critério do recorte.

   ══ NADA AQUI É ESTIMATIVA ══════════════════════════════════════════════════════════════════
   Linha sem data NÃO APARECE, e o rodapé diz quantas ficaram de fora e por quê. Lista de
   urgência com item chutado ensina a ignorar a lista — e uma lista de urgência ignorada é pior
   que nenhuma, porque ela ocupa o lugar da que funcionaria.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  /* ══ O RECORTE DA TERCEIRA FONTE, PUBLICADO ═══════════════════════════════════════════════
     A licitação entra quando a data ainda não passou E falta no máximo 30 dias.
     >>> POR QUE 30 E NÃO OS 60 DA ATA: os dois números medem trabalhos de tamanhos diferentes.
         Esvaziar o saldo de uma ata leva meses; montar uma proposta leva dias. Um aviso de 60
         dias sobre um pregão encheria a lista de coisa que ainda não é para hoje, e lista cheia
         de não-urgente é como a urgência some de vista.
     >>> E A LICITAÇÃO QUE JÁ PASSOU NÃO ENTRA — não há o que fazer sobre ela. Mas ela também não
         SOME: o rodapé a conta, porque negócio na fase Disputa com a sessão há seis dias é um
         fato que alguém precisa ver. Silêncio por corte é o que faz um número parecer completo. */
  var JANELA_LICITACAO = 30;

  function dataISO(v) {
    var s = String(v == null ? '' : v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  function hojeISO(d) {
    var x = d || new Date();
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-'
         + String(x.getDate()).padStart(2, '0');
  }
  /* A CONTA DE DIAS É A MESMA DO `fpmed_ata_saldo.js`, e ela está repetida aqui de propósito
     porque este arquivo tem de rodar sem aquele carregado (a tela da manhã não depende da aba
     Ata). O `T12:00:00` afasta os dois lados 12 horas de qualquer virada de dia; quem faz o
     trabalho é o `Math.round`, e foi ele que a B30 mediu contra o `date` do Postgres — 400 pares,
     0 divergências. A catraca desta fatia mede as DUAS contra o mesmo oráculo, porque duas
     implementações da mesma regra é o par que um dia diverge. */
  function dias(fim, hoje) {
    var f = dataISO(fim); if (!f) return null;
    var h = dataISO(hoje) || hojeISO();
    return Math.round((new Date(f + 'T12:00:00') - new Date(h + 'T12:00:00')) / 86400000);
  }

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var x = Number(v);
    return isFinite(x) ? x : null;
  }

  /* ── A LISTA ─────────────────────────────────────────────────────────────────────────────────
     `fontes` = { certidoes, atas, licitacoes }, cada uma como o banco devolve:
       certidoes  — `v_documentos_situacao`  (situacao já decidida lá, com o `dias_aviso` de cada)
       atas       — `v_atas_vigencia`        (situacao já decidida lá, corte de 60)
       licitacoes — negócios vivos fora da fase Ata, com a data que o índice der

     Devolve `{ linhas, divida, contagem }`. */
  function juntar(fontes, hoje) {
    var h = dataISO(hoje) || hojeISO();
    var linhas = [];
    var divida = { certidaoSemValidade: 0, ataSemValidade: 0, licitacaoSemData: 0,
                   licitacaoJaPassou: 0, ataArquivada: 0 };
    var contagem = { certidao: 0, ata: 0, licitacao: 0 };

    // ── 1. CERTIDÃO — o verbo é RENOVAR ───────────────────────────────────────────────────────
    (fontes && fontes.certidoes || []).forEach(function (d) {
      if (d.situacao === 'sem_validade' || dataISO(d.validade) == null) { divida.certidaoSemValidade++; return; }
      if (d.situacao !== 'vencido' && d.situacao !== 'vencendo') return;
      contagem.certidao++;
      linhas.push({
        fonte: 'certidao', id: d.id,
        titulo: d.nome || d.tipo || 'documento sem nome',
        detalhe: [d.tipo, d.orgao_emissor].filter(Boolean).join(' · ') || null,
        quando: dataISO(d.validade),
        dias: dias(d.validade, h),
        vencido: d.situacao === 'vencido',
        verbo: 'renovar',
        // O QUE FAZER, E NÃO O QUE ESTÁ ACONTECENDO. "CND Estadual vencendo" não diz a ninguém o
        // que fazer com a manhã; "renovar" diz.
        acao: 'renovar a certidão antes da próxima sessão',
        valor: null, unidades: null,
      });
    });

    // ── 2. ATA — o verbo é EMPENHAR ───────────────────────────────────────────────────────────
    (fontes && fontes.atas || []).forEach(function (a) {
      /* ATA ARQUIVADA NÃO ENTRA, e não é filtro de conveniência: alguém DECIDIU tirá-la da
         frente, com motivo e carimbo (B31). Ressuscitá-la aqui seria esta tela desfazendo, em
         silêncio, um ato de gente. */
      if (a.arquivado_em) { divida.ataArquivada++; return; }
      if (a.situacao === 'sem_vigencia' || dataISO(a.ata_vigencia_fim) == null) { divida.ataSemValidade++; return; }
      if (a.situacao !== 'vencida' && a.situacao !== 'vencendo') return;
      contagem.ata++;
      linhas.push({
        fonte: 'ata', id: a.id,
        titulo: a.titulo || a.orgao || ('negócio ' + a.id),
        detalhe: [a.numero, a.municipio && a.uf ? a.municipio + '/' + a.uf : a.uf].filter(Boolean).join(' · ') || null,
        quando: dataISO(a.ata_vigencia_fim),
        dias: dias(a.ata_vigencia_fim, h),
        vencido: a.situacao === 'vencida',
        verbo: 'empenhar',
        acao: 'cobrar empenho e entrega do saldo que resta',
        valor: num(a.valor_ganho),
        // QUANTOS ITENS TÊM SALDO INFORMADO. Zero aqui é `null` e não `0`: "nenhum item informado"
        // e "nenhum item tem saldo" são as duas frases que a B30 inteira existe para separar.
        unidades: num(a.itens_com_saldo) || null,
      });
    });

    // ── 3. LICITAÇÃO — o verbo é PROPOR ───────────────────────────────────────────────────────
    (fontes && fontes.licitacoes || []).forEach(function (l) {
      var quando = dataISO(l.prazo);
      if (quando == null) { divida.licitacaoSemData++; return; }
      var d = dias(quando, h);
      if (d < 0) { divida.licitacaoJaPassou++; return; }
      if (d > JANELA_LICITACAO) return;
      contagem.licitacao++;
      linhas.push({
        fonte: 'licitacao', id: l.id,
        titulo: l.titulo || l.orgao || ('negócio ' + l.id),
        detalhe: [l.estagio, l.municipio && l.uf ? l.municipio + '/' + l.uf : l.uf].filter(Boolean).join(' · ') || null,
        quando: quando,
        dias: d,
        vencido: false,
        verbo: 'propor',
        acao: 'montar e enviar a proposta',
        valor: num(l.valor_estimado),
        unidades: null,
        // DE ONDE VEIO A DATA. O índice do PNCP publica o encerramento da proposta; a ficha do
        // funil guarda a abertura da sessão. Não são a mesma data, e a linha diz qual usou —
        // sem isso, "fecha em 3 dias" seria uma frase que ninguém consegue conferir.
        prazoOrigem: l.prazo_origem || null,
      });
    });

    /* ── A ORDEM: QUEM MORRE PRIMEIRO ──────────────────────────────────────────────────────────
       Ordenação ÚNICA, sem abas e sem filtro por tipo na primeira vista — é a regra da caixa, e
       ela é a fatia inteira: separar por tipo devolveria as três telas que esta veio substituir.
       >>> O COMPARADOR É TOTAL, e isso é a lição da B28 (o `sort()` sem comparador dá número
           errado, calado, com cara de certo). Empate em dias desempata pela fonte e depois pelo
           id — assim a lista não se reorganiza sozinha entre dois carregamentos do mesmo dia,
           que é o defeito que faz alguém clicar na linha errada. */
    var PESO = { certidao: 0, ata: 1, licitacao: 2 };
    linhas.sort(function (a, b) {
      if (a.dias !== b.dias) return a.dias - b.dias;
      if (PESO[a.fonte] !== PESO[b.fonte]) return PESO[a.fonte] - PESO[b.fonte];
      return (a.id || 0) - (b.id || 0);
    });

    return { linhas: linhas, divida: divida, contagem: contagem, janelaLicitacao: JANELA_LICITACAO };
  }

  /* ── A FRASE DO PRAZO ────────────────────────────────────────────────────────────────────────
     "HOJE" E "AMANHÃ" TÊM PALAVRA PRÓPRIA — a mesma regra da B30. "vence em 0 dias" lê-se como
     defeito de programa e não como prazo, e o dia em que ela apareceria é justamente o único em
     que ainda dá para fazer alguma coisa. */
  function frase(l) {
    var d = l.dias;
    if (d < 0) return 'venceu há ' + Math.abs(d) + (Math.abs(d) === 1 ? ' dia' : ' dias');
    if (d === 0) return l.fonte === 'licitacao' ? 'fecha HOJE' : 'vence HOJE';
    if (d === 1) return l.fonte === 'licitacao' ? 'fecha amanhã' : 'vence amanhã';
    return (l.fonte === 'licitacao' ? 'fecha em ' : 'vence em ') + d + ' dias';
  }

  /* ── O RODAPÉ DA DÍVIDA ──────────────────────────────────────────────────────────────────────
     Devolve as frases que faltam, já contadas. Vazio quando não há dívida — e aí o rodapé não
     nasce, em vez de nascer dizendo "0 atas fora desta lista", que é ruído com cara de aviso. */
  function frasesDaDivida(d) {
    var f = [];
    if (d.ataSemValidade)
      f.push(d.ataSemValidade + (d.ataSemValidade === 1 ? ' ata está' : ' atas estão')
        + ' fora desta lista por falta de validade — sem a data não há como saber se ela morre primeiro.');
    if (d.certidaoSemValidade)
      f.push(d.certidaoSemValidade + (d.certidaoSemValidade === 1 ? ' documento está' : ' documentos estão')
        + ' fora desta lista por não ter validade cadastrada. Sem data não é "não vence": é "ninguém digitou".');
    if (d.licitacaoSemData)
      f.push(d.licitacaoSemData + (d.licitacaoSemData === 1 ? ' negócio está' : ' negócios estão')
        + ' fora desta lista por não ter data de sessão.');
    if (d.licitacaoJaPassou)
      f.push(d.licitacaoJaPassou + (d.licitacaoJaPassou === 1 ? ' negócio seu já passou' : ' negócios seus já passaram')
        + ' da data e não aparecem aqui — não há mais o que propor. Se algum continua na Disputa, ele parou no meio.');
    if (d.ataArquivada)
      f.push(d.ataArquivada + (d.ataArquivada === 1 ? ' ata arquivada não entra' : ' atas arquivadas não entram')
        + ' — alguém decidiu tirá-las da frente, com motivo.');
    return f;
  }

  raiz.FPMED_VAI_EMBORA = {
    juntar: juntar, frase: frase, frasesDaDivida: frasesDaDivida,
    dias: dias, hojeISO: hojeISO, JANELA_LICITACAO: JANELA_LICITACAO,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.FPMED_VAI_EMBORA;
})(typeof window !== 'undefined' ? window : globalThis);
