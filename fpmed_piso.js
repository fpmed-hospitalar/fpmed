/* ══════════════════════════════════════════════════════════════════════════════════════════════
   fpmed_piso.js — A CALCULADORA DE PISO (fatia B29, 20/08/2026)

   ══ O TERCEIRO NÚMERO, E O ÚNICO QUE PROTEGE O BOLSO ════════════════════════════════════════
   Depois da B3 a tela diz **até onde é permitido** (teto CMED). Depois da B28 ela diz **por
   quanto já foi vendido** (teto competitivo). Faltava o número que impede o prejuízo: **abaixo
   de quanto eu não posso ir**. Ganhar pregão abaixo do piso é a forma mais cara de ganhar — o
   contrato dura doze meses e a perda se repete em cada entrega.

   ══ A LEI DESTA FATIA, E ELA VALE MAIS QUE A CONTA ══════════════════════════════════════════
   Enquanto faltar componente, **não há piso**. Nem R$ 0,00, nem "0% de margem", nem um número
   provisório com etiqueta de provisório. A tela diz o NOME do que falta e o caminho para
   informar. **Piso chutado é pior que piso ausente**, e o motivo é o uso: o gestor não olha o
   piso para se informar, olha para decidir se cobre o lance. Um piso ausente faz ele parar e
   perguntar; um piso errado faz ele dar o lance.

   ══ A CONTA, E O ERRO QUE ELA EXISTE PARA NÃO COMETER ═══════════════════════════════════════
   O imposto **incide sobre a VENDA**, não sobre o custo. Então ele não se soma ao custo: ele
   entra DIVIDINDO.

       ERRADO :  piso = (custo + frete + rateio) × (1 + alíquota)
       CERTO  :  piso = (custo + frete + rateio) ÷ (1 − alíquota)

   Com custo 100 e alíquota 10%, o errado dá 110 — e a 110 o imposto é 11, sobrando 99 para
   pagar um custo de 100: **prejuízo de 1 real num preço que a tela apresentou como piso**.
   O certo dá 111,111…, o imposto é 11,111… e sobra exatamente 100. Zero.
   >>> E O ERRO CRESCE COM A ALÍQUOTA. No Lucro Real, com 25% efetivos, o errado devolve 125 e o
       certo 133,33: o piso errado fica **6,25% ABAIXO** do piso de verdade. Numa disputa isso é
       exatamente a folga que o gestor acha que tem e não tem.
   >>> O ASSERT QUE GUARDA ISSO NÃO É UM EXEMPLO MEU, É UMA IDENTIDADE: no piso, o que sobra
       depois do imposto tem de ser IGUAL ao custo. `piso × (1 − alíq) − (custo+frete+rateio) = 0`.
       Identidade não concorda comigo por engano, do jeito que uma fixture minha concordaria.

   ══ ARREDONDAR PISO PARA BAIXO É CRIAR UM PISO ABAIXO DO PISO ═══════════════════════════════
   `compra_unit` tem 4 casas neste banco e o piso sai com dízima quase sempre. Um piso de
   R$ 111,1111 exibido como R$ 111,11 é onze décimos de centavo abaixo do piso — irrelevante numa
   unidade e R$ 111 em cem mil unidades, que é o tamanho de uma ata. Então o número EXIBIDO é
   arredondado **para cima**, sempre: `pisoCentavos >= piso`, e há assert disso.

   ══ O QUE ESTE ARQUIVO NÃO FAZ ══════════════════════════════════════════════════════════════
   · Não decide alíquota. Regime tributário é fato da contabilidade da empresa, não dedução de
     software. Ele consome a alíquota EFETIVA que alguém informou, com data de vigência, e não
     tem nenhuma tabela de anexo do Simples escondida aqui: uma tabela dessas desatualiza em
     silêncio e passa a devolver piso errado com cara de piso calculado.
   · Não usa `custos_fixos`. MEDIDO: aquela tabela tem 2 linhas e as duas são custo do SISTEMA
     (Supabase Pro e o addon de compute), não da operação. Ratear a conta do banco de dados no
     preço da dipirona seria um número certo com nome errado — o pior tipo.
   · Não calcula piso sobre custo estimado. O `custoRef` da Proposta (venda ÷ 1,25, usado quando
     o item é do estoque GLOBAL) é referência para MOSTRAR markup, não custo de compra. Piso
     sobre custo estimado é piso chutado, e a lei acima proíbe.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  /* ── OS TRÊS COMPONENTES ────────────────────────────────────────────────────────────────────
     Cada um versiona SOZINHO, com a sua própria data de vigência — a caixa pediu "cada campo com
     data de vigência" e o motivo é real: alíquota muda em janeiro e frete muda quando troca a
     transportadora, em meses diferentes. Um snapshot único obrigaria a recadastrar o frete que
     não mudou só para registrar a alíquota que mudou, e o que não muda recadastrado à mão é o
     que entra errado.
     >>> O QUE NÃO SE FAZ É VERSIONAR CAMPO A CAMPO DENTRO DO COMPONENTE: "custo fixo mensal" e
         "volume mensal" com datas diferentes montariam um rateio que nunca existiu — o custo de
         março dividido pelo volume de agosto. O componente é a menor unidade que faz sentido
         sozinha, e é ela que tem data. */
  var COMPONENTES = [
    { chave: 'tributos', rotulo: 'regime tributário',
      falta: 'o regime tributário e a alíquota efetiva',
      campos: ['regime', 'aliquota_pct'] },
    { chave: 'frete', rotulo: 'frete padrão',
      falta: 'o frete padrão (em % do custo ou em R$ por unidade)',
      campos: ['frete_tipo', 'frete_valor'] },
    { chave: 'rateio', rotulo: 'rateio de custo fixo',
      falta: 'o custo fixo mensal e o volume mensal para o rateio',
      campos: ['custo_fixo_mensal', 'volume_mensal'] },
  ];

  var REGIMES = {
    simples:   'Simples Nacional',
    presumido: 'Lucro Presumido',
    real:      'Lucro Real',
  };

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var x = Number(v);
    return isFinite(x) ? x : null;
  }

  /* ── QUAL PARÂMETRO VALE NUMA DATA ──────────────────────────────────────────────────────────
     O que vale é a linha de MAIOR `vigencia_inicio` que seja <= a data pedida. Proposta velha
     continua explicável porque ela pergunta pela data DELA, não por hoje.
     >>> DATA COMPARADA COMO TEXTO ISO, DE PROPÓSITO. `'2026-08-20' <= '2026-09-01'` é verdade em
         ordem alfabética porque o ISO é ordenável assim, e comparar texto não passa por fuso
         horário nenhum. `new Date('2026-08-20')` em Goiás é 19/08 21:00, e uma vigência que
         começa hoje deixaria de valer hoje — um dia inteiro de piso ausente, sem sintoma. */
  function vigentes(linhas, em) {
    var data = String(em || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) data = hojeISO();
    var achado = { tributos: null, frete: null, rateio: null, em: data };
    (linhas || []).forEach(function (l) {
      if (!l || l.ativo === false) return;
      var c = l.componente;
      if (!(c in achado) || c === 'em') return;
      var ini = String(l.vigencia_inicio || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ini) || ini > data) return;
      var atual = achado[c];
      if (!atual || String(atual.vigencia_inicio).slice(0, 10) < ini) achado[c] = l;
    });
    return achado;
  }

  /* A data de hoje em ISO, montada dos campos LOCAIS. `toISOString()` devolve UTC: às 21h de
     Goiás ele já escreveu o dia seguinte, e a vigência de amanhã passaria a valer hoje à noite. */
  function hojeISO(d) {
    var x = d || new Date();
    var m = String(x.getMonth() + 1).padStart(2, '0');
    var dia = String(x.getDate()).padStart(2, '0');
    return x.getFullYear() + '-' + m + '-' + dia;
  }

  /* ── O QUE FALTA, COM NOME ──────────────────────────────────────────────────────────────────
     Devolve a lista dos componentes ausentes ou incompletos. "Incompleto" conta como ausente e
     isso não é rigor decorativo: um rateio com custo fixo e sem volume não é meio rateio, é uma
     divisão por nada. */
  function faltas(p) {
    var v = p || {};
    var out = [];
    COMPONENTES.forEach(function (c) {
      var l = v[c.chave];
      var completo = !!l && c.campos.every(function (k) {
        return l[k] !== null && l[k] !== undefined && l[k] !== '';
      });
      if (completo && c.chave === 'rateio' && !(num(l.volume_mensal) > 0)) completo = false;
      if (completo && c.chave === 'tributos') {
        var a = num(l.aliquota_pct);
        // 100% ou mais não é alíquota alta: é uma conta impossível. Com alíq >= 1 o divisor
        // (1 − alíq) é zero ou negativo, e o "piso" sairia infinito ou NEGATIVO — um número
        // absurdo com cara de resultado. Melhor tratar como parâmetro que falta.
        if (a === null || a < 0 || a >= 100) completo = false;
      }
      if (!completo) out.push({ componente: c.chave, rotulo: c.rotulo, falta: c.falta });
    });
    return out;
  }

  /* ── A CONTA ────────────────────────────────────────────────────────────────────────────────
     Devolve as PARCELAS, e não só o total. Gestor que não vê a conta não confia no número, e com
     razão: um piso é uma afirmação sobre o dinheiro dele.
     >>> A ORDEM NA TELA É compra → frete → rateio → custo total → impostos → piso, e ela é
         diferente da ordem que a caixa desenhou (que punha o imposto em segundo). É de propósito:
         o imposto só pode ser calculado depois do custo total, porque ele incide sobre a VENDA e
         não sobre o custo. Mostrá-lo antes do subtotal seria desenhar uma conta que ninguém
         consegue refazer na calculadora — e o ponto das parcelas é justamente que dê para
         refazer. */
  function calcular(pedido) {
    var q = pedido || {};
    var params = q.params || {};
    var faltando = faltas(params);
    if (faltando.length) return { ok: false, motivo: 'sem_parametro', faltam: faltando };

    var custo = num(q.custoUnit);
    if (!(custo > 0)) return { ok: false, motivo: 'sem_custo', faltam: [] };

    var t = params.tributos, f = params.frete, r = params.rateio;
    var aliq = num(t.aliquota_pct) / 100;

    // O FRETE EM % É SOBRE O CUSTO DE COMPRA, e não sobre a venda: frete é despesa nossa de
    // trazer a mercadoria, e ela se dimensiona pelo que se comprou. Frete calculado sobre a venda
    // subiria sozinho toda vez que o preço subisse, o que não descreve caminhão nenhum.
    var frete = f.frete_tipo === 'pct' ? custo * (num(f.frete_valor) / 100) : num(f.frete_valor);
    var rateio = num(r.custo_fixo_mensal) / num(r.volume_mensal);

    var custoTotal = custo + frete + rateio;
    var piso = custoTotal / (1 - aliq);
    var impostos = piso * aliq;

    return {
      ok: true,
      piso: piso,
      // >>> PARA CIMA, SEMPRE. Ver o cabeçalho: piso arredondado para baixo é um piso abaixo do
      //     piso, e quem der o lance nele perde dinheiro achando que empatou.
      pisoCentavos: Math.ceil(piso * 100 - 1e-9) / 100,
      parcelas: {
        compra: custo,
        frete: frete,
        rateio: rateio,
        custoTotal: custoTotal,
        impostos: impostos,
      },
      regime: t.regime,
      regimeRotulo: REGIMES[t.regime] || t.regime,
      aliquotaPct: num(t.aliquota_pct),
      freteTipo: f.frete_tipo,
      freteValor: num(f.frete_valor),
      custoFixoMensal: num(r.custo_fixo_mensal),
      volumeMensal: num(r.volume_mensal),
      vigencias: {
        tributos: String(t.vigencia_inicio || '').slice(0, 10),
        frete: String(f.vigencia_inicio || '').slice(0, 10),
        rateio: String(r.vigencia_inicio || '').slice(0, 10),
      },
    };
  }

  /* ── A TERCEIRA FOLGA, E O SINAL DE PERIGO ──────────────────────────────────────────────────
     `avaliar` é o que a tela chama. Ela devolve um ESTADO, e cada estado tem uma frase própria:

       · `sem_parametro` .. falta componente — a tela nomeia qual e não mostra piso nenhum
       · `sem_custo` ...... o item não tem custo de compra cadastrado (1.416 dos 8.832, medido)
       · `custo_estimado` . o custo que a tela tem é derivado (venda ÷ 1,25), não é compra
       · `ok` ............. há piso, e há folga ou prejuízo

     >>> A FOLGA TEM O MESMO SINAL DAS OUTRAS DUAS, de propósito: positivo = sobra. Três selos na
         mesma linha com sinais trocados fariam a pessoa ler "-12%" como bom num e ruim noutro.
     >>> E A FOLGA É SOBRE O PREÇO, NÃO SOBRE O PISO. `(preço − piso) / preço` responde "quanto do
         que eu recebo é folga", que é a pergunta de quem vai dar lance. `/piso` responderia
         "quantos por cento acima do piso eu estou", que é a mesma informação dita de um jeito que
         não se compara com as outras duas folgas da linha — e elas ficam lado a lado.
     >>> PREJUÍZO NÃO BLOQUEIA. O dono pode ter razão para ir abaixo do piso (queimar estoque perto
         do vencimento vale mais que segurar). A tela avisa com NÚMERO — quanto por unidade e
         quanto no item inteiro — e deixa ele decidir. Impedir seria a tela sabendo do negócio
         dele mais que ele. */
  function avaliar(pedido) {
    var q = pedido || {};
    if (q.custoEstimado && !(num(q.custoUnit) > 0))
      return { estado: 'custo_estimado', piso: null };

    var c = calcular(q);
    if (!c.ok) return { estado: c.motivo, faltam: c.faltam, piso: null };

    var preco = num(q.precoUnit);
    var out = {
      estado: 'ok',
      piso: c.piso,
      pisoCentavos: c.pisoCentavos,
      parcelas: c.parcelas,
      regime: c.regime, regimeRotulo: c.regimeRotulo, aliquotaPct: c.aliquotaPct,
      freteTipo: c.freteTipo, freteValor: c.freteValor,
      custoFixoMensal: c.custoFixoMensal, volumeMensal: c.volumeMensal,
      vigencias: c.vigencias,
      folgaReais: null, folgaPct: null, abaixo: false, prejuizoUnit: null, prejuizoTotal: null,
    };
    // Sem preço proposto não há folga, e `null` NUNCA vira 0%: 0% é a afirmação "ficou exatamente
    // no piso", e ela seria falsa.
    if (!(preco > 0)) return out;

    out.folgaReais = preco - c.piso;
    out.folgaPct = ((preco - c.piso) / preco) * 100;
    out.abaixo = preco < c.piso;
    if (out.abaixo) {
      out.prejuizoUnit = c.piso - preco;
      var un = num(q.unidades);
      // Sem saber quantas unidades, o prejuízo total fica `null` — e não zero. Zero seria dizer
      // que vender abaixo do piso não custa nada, que é o contrário do que o selo existe para
      // dizer.
      out.prejuizoTotal = un > 0 ? out.prejuizoUnit * un : null;
    }
    return out;
  }

  raiz.FPMED_PISO = {
    COMPONENTES: COMPONENTES, REGIMES: REGIMES,
    hojeISO: hojeISO, vigentes: vigentes, faltas: faltas, calcular: calcular, avaliar: avaliar,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.FPMED_PISO;
})(typeof window !== 'undefined' ? window : globalThis);
