/* ══════════════════════════════════════════════════════════════════════════════════════════
   FPMED — MOTOR DO TETO CMED  ·  "meu preço unitário x o teto legal"
   Módulo 2.11 + 2.7 da spec (Conferidor de Proposta e Gerador de Proposta), 08/08/2026.

   ══ POR QUE ESTE ARQUIVO EXISTE, e não duas telas com a mesma conta ═══════════════════════
   Conferir uma proposta pronta e sugerir o preço na hora de montar são A MESMA CONTA feita em
   dois momentos. Escrever duas vezes é criar o par que diverge — e este projeto já pagou por
   isso uma vez, no preço unitário (uma tela dividia pelo pack, a outra não, e o preço de caixa
   virava unitário sem sinal). Uma engine só, duas telas em cima.

   ══ AS TRÊS REGRAS QUE MANDAM AQUI ════════════════════════════════════════════════════════

   1. NÃO ENCONTRADO ≠ DENTRO DO TETO.  É a regra mais importante do arquivo. Item que não casa
      com a CMED volta como `nao_encontrado`, nunca como "ok". Um conferidor que dá verde no que
      não conferiu é pior que conferidor nenhum: ele dá confiança onde não há informação, e
      quem confia manda a proposta.

   2. PREÇO SEMPRE UNITÁRIO NOS DOIS LADOS.  Regra do projeto desde 04/08. O preço da CMED é POR
      EMBALAGEM; o teto unitário sai dividido por `qtd_apres`, e é assim que a `cmed_regua` já
      entrega. Se o preço que entra aqui for de caixa, a comparação é lixo — por isso a função
      EXIGE que quem chama declare que o valor é unitário, e devolve `sem_preco` se não for.

   3. QUANDO A CMED TEM FAIXA, USA-SE O MENOR TETO.  "DIPIRONA 1000MG" tem 31 apresentações com
      teto entre R$ 0,61 e R$ 1,45 (medido em 08/08). O teto é da APRESENTAÇÃO, não do princípio
      ativo — então um número único seria invenção. Usar o MAIOR faria passar preço que estoura
      o teto da apresentação real; usar o MENOR, no máximo, manda conferir uma vez a mais.
      O resultado carrega a faixa inteira para quem quiser olhar.

   ══ QUAL TETO SE APLICA ═══════════════════════════════════════════════════════════════════
   Venda ao GOVERNO com CAP=Sim  ->  PMVG (o desconto é obrigatório, Resolução CMED 5/2020)
   Qualquer outro caso           ->  PF
   Quem decide é quem chama, por `paraGoverno` — a tela pergunta, o motor não adivinha.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  // ── AS QUATRO FUNÇÕES DE DOSE, EM UM LUGAR SÓ ───────────────────────────────────────────
  // Elas nasceram no fpmed_licitacoes.html, onde o cruzamento por item já as validou no ar
  // contra dado real (4 defeitos corrigidos em 05/08: calibre French virando pack, match por 1
  // palavra, volume confundido com concentração, corrida com o gm-auth). Em 08/08 vieram pra cá
  // COPIADAS, com um teste comparando as duas versões — o que impede a divergência SILENCIOSA,
  // não a divergência. E a cópia pegou defeito na primeira execução: esta aqui nasceu sem duas
  // linhas do `forma` (colírio/oftálmico e spray/aerossol), e colírio virava "forma
  // desconhecida" de um lado e não do outro.
  // >>> 10/08: A CÓPIA ACABOU. O fpmed_licitacoes.html carrega este arquivo e não escreve mais
  //     nenhuma das quatro. Quem mexer numa regra de dose mexe AQUI, e as três telas
  //     (Licitações, Conferidor e Propostas) mudam juntas — que é o ponto.
  const semAcento = s => { let o=''; for(const c of String(s||'').normalize('NFD')){ const k=c.codePointAt(0); if(k>=0x300&&k<=0x36f) continue; o+=c; } return o.toLowerCase(); };

  function doses(s){
    const t = semAcento(s).replace(/,/g,'.');
    const out = new Set(); let m;
    const re = /(\d+(?:\.\d+)?)\s*(mg\/ml|mcg\/ml|ui\/ml|g\/ml|mg|mcg|ui|ml|%|g\b)/g;
    while((m = re.exec(t))){
      const n = parseFloat(m[1]);                    // 03ml -> 3ml · 0.100mg -> 0.1mg
      if(!isFinite(n)) continue;
      out.add(n + m[2].trim());
    }
    // GAUGE de agulha: o nosso nome escreve "22GX1" (o `g` colado no `x` não fecha \b e escapava
    // do laço acima) e o edital escreve "23 g x 1". Sem isto, 22G e 23G casavam como se fossem a
    // mesma agulha — que é exatamente o erro que o discriminador de dose existe pra impedir.
    const reG = /(\d{1,2})\s*g\s*x\s*\d/g;
    while((m = reG.exec(t))) out.add(parseFloat(m[1]) + 'g');
    // CATMAT escreve a medida como "capacidade: 3" (sem unidade) onde o nosso nome escreve "3ML".
    // Sem isto, a seringa de 60 ml casava com o item de 3 ml, porque o lado do edital não tinha
    // dose nenhuma pra discordar. Só vale quando o número vem PELADO — "capacidade: 100 litros"
    // traz unidade e é ignorado de propósito (bebedouro não é seringa).
    const reC = /capacidade\s*:?\s*(\d+(?:\.\d+)?)(?!\s*[a-z0-9])/g;
    while((m = reC.exec(t))) out.add(parseFloat(m[1]) + 'ml');
    return out;
  }

  // CONCENTRAÇÃO ≠ VOLUME. Visto no ar em 05/08: "ACETILCISTEINA 40MG/ML XPE 120ML" do edital
  // casou como "dose confere" com a nossa de 20MG só porque os dois dizem 120ML — o volume do
  // frasco é EMBALAGEM, a concentração é a IDENTIDADE do medicamento. Aqui a concentração vira
  // uma magnitude comparável ("20mg/ml" e "20mg" viram ambos 20mg, que é a mesma coisa dita de
  // dois jeitos) e passa a ser condição de aceite quando os DOIS lados a declaram.
  function concMags(s){
    let t = semAcento(s).replace(/,/g,'.');
    const out = new Set(); let m;
    // "50MG/5ML" é 10 mg por ml, NÃO 50 — e o edital escreve a mesma coisa como "10MG/ML".
    // Visto no ar em 05/08: sem esta redução, a nossa ACEBROFILINA 50MG/5ML aparecia como
    // "dose confere" num item de 50MG/ML, que é cinco vezes mais concentrado. O trecho é
    // consumido aqui pra não ser relido lá embaixo como um "50mg" solto.
    t = t.replace(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ui)\s*\/\s*(\d+(?:\.\d+)?)\s*ml/g, (todo, n, u, d) => {
      const por = parseFloat(n) / parseFloat(d);
      if(isFinite(por) && por > 0) out.add(+por.toFixed(4) + u);
      return ' ';
    });
    const re = /(\d+(?:\.\d+)?)\s*(mg\/ml|mcg\/ml|ui\/ml|g\/ml|mg|mcg|ui|%|g\b)/g;
    while((m = re.exec(t))){
      const n = parseFloat(m[1]);
      if(!isFinite(n)) continue;
      out.add(n + m[2].split('/')[0].trim());          // 500mg/ml -> 500mg
    }
    return out;
  }

  // FORMA FARMACÊUTICA: comprimido não é injetável, e xarope não é pomada. Sem isto, "DIPIRONA
  // 500MG 200CPR" casava com "dipirona 500 mg/ml solução injetável" — mesmo princípio, mesmo
  // número, produto completamente diferente. null = não deu pra saber, e aí não rejeita nada.
  function forma(s){
    const t = semAcento(s);
    if(/injet|ampola|\bamp\b|f\s*\/\s*a|frasco.ampola|\biv\b|\bim\b|infusao|bolsa/.test(t)) return 'INJ';
    if(/comprimid|\bcpr\b|\bcomp\b|caps|drage|\bdrg\b|revestid/.test(t))                    return 'ORAL_SOL';
    if(/xarope|\bxpe\b|suspensao|solucao oral|gotas|\bgts\b|elixir|sache/.test(t))          return 'ORAL_LIQ';
    if(/pomada|creme|\bgel\b|unguento|locao|topic/.test(t))                                  return 'TOPICO';
    if(/colirio|oftalmic/.test(t))                                                           return 'OFT';
    if(/spray|aeross?ol|inalat|nebuliz/.test(t))                                             return 'SPRAY';
    return null;
  }

  /* ── EMBALAGEM: QUANTAS UNIDADES TEM UMA "CAIXA" ────────────────────────────────────────
     Entrou aqui em 10/08, junto com a ponte "itens do edital -> gerador de proposta". Não é
     assunto novo: é a REGRA 2 do cabeçalho ("preço sempre unitário nos dois lados") vista do
     outro ângulo — pra unitarizar é preciso saber o pack, e pra converter a quantidade de um
     edital na quantidade da NOSSA embalagem também.
     >>> POR QUE NO MOTOR, e não em cada tela: esta é a família de defeito que mais custou neste
         projeto (preço de caixa mostrado como unitário, unidade virando caixa no faturamento).
         Três telas fazem a mesma pergunta; três respostas seriam três chances de divergir.
     >>> `null` É RESPOSTA. "Caixa" sem contagem não é caixa de 1 — é caixa de quantidade
         desconhecida. Devolver 1 por otimismo é o que transforma um preço de caixa em preço
         unitário sem ninguém ver. Quem recebe null tem que DIZER "conferir embalagem". */

  // Unidade do EDITAL (campo `unidadeMedida` do PNCP): "Caixa 100 UN"->100 · "Unidade"->1
  // "Frasco 1000 ML"->1 e "Galão 5 L"->1 (o número é MEDIDA, não contagem).
  // "Caixa" sem número -> null (não sei).
  const _MEDIDA    = /^(ml|l|g|kg|mg|mcg|m|cm|mm|litro|litros|grama|gramas|metro|metros)$/;
  const _AGREGADOR = /(caixa|cx|embalagem|emb|pacote|pct|fardo|kit|conjunto|maco|saco|display|cartucho)/;
  function unidadePack(u){
    const t = semAcento(u||'').trim();
    if(!t) return 1;
    const m = t.match(/(\d+(?:[.,]\d+)?)\s*([a-z]+)?/);
    if(m){
      const n = parseFloat(m[1].replace(',','.')), unidade = m[2]||'';
      if(_MEDIDA.test(unidade)) return 1;
      return (n>1 && n<=100000) ? n : 1;
    }
    return _AGREGADOR.test(t) ? null : 1;
  }

  // Unidade do NOSSO estoque. "AMP"/"FR"/"UND" já é a unidade de venda (pack 1 sabido);
  // "CX"/"PCT" é agregador — sem contagem no nome não dá pra unitarizar. O silêncio (und vazio)
  // também é "não sei", nunca 1 por otimismo.
  const _UND_UNITARIA   = /^(und|un|unid|unidade|amp|ampola|fa|fr|frasco|cpr|comp|cp|caps|cap|lt|litro|pc|par|tb|tubo|bg|bisnaga|rl|rolo|gl|sc|kg|mt)$/;
  const _UND_AGREGADORA = /^(cx|caixa|ct|cart|pct|pacote|fd|fardo|dp|display|kit|cj|conj|bls|blister|env)$/;
  // `qtdEmb` é o pack que a tela conseguiu LER (do campo und ou do nome do produto) — cada tela
  // tem o seu leitor, com as manhas dela (calibre French, NxM CPR, frasco-ampola). Aqui só se
  // decide o que fazer quando ele não leu nada.
  function packNosso(und, qtdEmb){
    if(qtdEmb > 1) return qtdEmb;
    const u = semAcento(und||'').replace(/[^a-z]/g,'');
    if(_UND_UNITARIA.test(u)) return 1;
    if(_UND_AGREGADORA.test(u) || !u) return null;   // caixa sem contagem, ou silêncio
    return 1;
  }

  // ── O ÍNDICE ────────────────────────────────────────────────────────────────────────────
  // Montado uma vez, a partir do que a tela leu do banco. Três caminhos de busca, do mais
  // confiável para o menos — e o resultado sempre DIZ por qual deles casou.
  function indexar({ regua = [], teto = [], dicionario = [] } = {}){
    const porGgrem = new Map(), porEan = new Map(), porPaDose = new Map(), marcaParaPa = new Map();
    for(const r of regua){
      if(r.ggrem) porGgrem.set(String(r.ggrem).trim(), r);
      if(r.ean1)  porEan.set(String(r.ean1).replace(/\D/g,''), r);
    }
    for(const t of teto){
      const k = (t.subst_norm || '') + '|' + (t.dose_key || '');
      porPaDose.set(k, t);
    }
    for(const d of dicionario){
      const de = semAcento(d.marca_norm || d.de || '');
      const para = (d.substancia || d.para || '').toUpperCase();
      if(de && para && !marcaParaPa.has(de)) marcaParaPa.set(de, para);
    }
    return { porGgrem, porEan, porPaDose, marcaParaPa,
             tamanho: { regua: porGgrem.size, teto: porPaDose.size, dicionario: marcaParaPa.size } };
  }

  // A dose_key da CMED junta a concentração e a apresentação ("500MG", "0.5G/ML+100ML"). Aqui
  // só se tenta a parte de concentração — casar a apresentação exata pelo nome seria chute.
  function chavesDoseDe(descricao){
    const out = [];
    for(const d of doses(descricao)) out.push(String(d).toUpperCase());
    for(const c of concMags(descricao)) out.push(String(c).toUpperCase());
    return [...new Set(out)];
  }

  const num = v => { const n = Number(v); return isFinite(n) ? n : null; };

  /* ── A AVALIAÇÃO ────────────────────────────────────────────────────────────────────────
     item: { descricao, precoUnit, unitario:true, ggrem, ean, paraGoverno }
     devolve sempre um objeto com `situacao`, que é o que a tela pinta:
       'acima'          — passou do teto legal  (traz pctAcima)
       'abaixo'         — dentro do teto        (traz folgaRS e folgaPct)
       'nao_encontrado' — não casou com a CMED  (a tela NÃO pode mostrar como ok)
       'sem_preco'      — não deu pra comparar  (preço ausente, zero, ou não declarado unitário)
     ─────────────────────────────────────────────────────────────────────────────────────── */
  function avaliar(item, idx){
    const r = { descricao: item && item.descricao, via: null, teto: null, tipoTeto: null,
                faixa: null, apresentacoes: null, cap: null, situacao: 'nao_encontrado',
                pctAcima: null, folgaRS: null, folgaPct: null, evidencia: null };
    if(!item || !idx) return r;

    const preco = num(item.precoUnit);
    // >>> "unitario" é DECLARADO por quem chama, não presumido. Preço de caixa comparado com
    //     teto unitário daria "10x acima do teto" e mandaria refazer uma proposta correta.
    const precoVale = preco != null && preco > 0 && item.unitario === true;

    // 1. GGREM — a chave da própria CMED. Não há como errar.
    const g = item.ggrem && idx.porGgrem.get(String(item.ggrem).trim());
    // 2. EAN — o código de barras da embalagem.
    const e = !g && item.ean && idx.porEan.get(String(item.ean).replace(/\D/g,''));
    const exato = g || e;

    if(exato){
      r.via = g ? 'ggrem' : 'ean';
      r.cap = !!exato.cap;
      const usaPmvg = item.paraGoverno === true && exato.cap === true;
      r.tipoTeto = usaPmvg ? 'PMVG' : 'PF';
      r.teto = num(usaPmvg ? exato.pmvg_unit : exato.pf_unit);
      r.evidencia = [exato.subst_norm, exato.apresentacao].filter(Boolean).join(' · ');
    } else {
      // 3. PA + dose. O PA vem do nome, ou da marca pelo dicionário CMED.
      const desc = semAcento(item.descricao || '');
      let pa = null;
      for(const [marca, subst] of idx.marcaParaPa){
        if(marca.length >= 4 && desc.includes(marca)){ pa = subst; break; }
      }
      const chaves = chavesDoseDe(item.descricao || '');
      let achado = null, paUsado = null;
      const candidatos = pa ? [pa] : [];
      if(!pa){
        // sem marca conhecida: tenta o começo do nome como princípio ativo
        const prim = (item.descricao || '').toUpperCase().replace(/[^A-Z ]/g,' ').trim().split(/\s+/)[0];
        if(prim && prim.length >= 4) candidatos.push(prim);
      }
      for(const c of candidatos){
        for(const k of chaves){
          const t = idx.porPaDose.get(c + '|' + k);
          if(t){ achado = t; paUsado = c; break; }
        }
        if(achado) break;
      }
      if(achado){
        r.via = 'pa+dose';
        r.cap = !!achado.tem_cap;
        r.tipoTeto = (item.paraGoverno === true && achado.tem_cap === true) ? 'PMVG' : 'PF';
        // >>> O MENOR DA FAIXA. Ver a regra 3 no cabeçalho: o teto é da apresentação, e um
        //     número único seria invenção. O maior faria passar preço que estoura o teto real.
        r.teto = num(achado.teto_min);
        r.faixa = [num(achado.teto_min), num(achado.teto_max)];
        r.apresentacoes = achado.apresentacoes != null ? Number(achado.apresentacoes) : null;
        r.evidencia = paUsado + ' · ' + (achado.dose_key || '');
      }
    }

    if(r.teto == null){ r.situacao = 'nao_encontrado'; return r; }
    if(!precoVale){ r.situacao = 'sem_preco'; return r; }

    if(preco > r.teto){
      r.situacao = 'acima';
      r.pctAcima = +(((preco - r.teto) / r.teto) * 100).toFixed(2);
    } else {
      r.situacao = 'abaixo';
      r.folgaRS  = +(r.teto - preco).toFixed(4);
      r.folgaPct = +(((r.teto - preco) / r.teto) * 100).toFixed(2);
    }
    return r;
  }

  // Resumo para o topo da tela: X ok · Y acima · Z não encontrados. Os não encontrados são
  // contados SEPARADAMENTE — somar com os "ok" é a mentira que este arquivo existe pra evitar.
  function resumir(resultados){
    const r = { total: resultados.length, ok: 0, acima: 0, naoEncontrados: 0, semPreco: 0 };
    for(const x of resultados){
      if(x.situacao === 'abaixo') r.ok++;
      else if(x.situacao === 'acima') r.acima++;
      else if(x.situacao === 'sem_preco') r.semPreco++;
      else r.naoEncontrados++;
    }
    return r;
  }

  /* ══ LER A PROPOSTA — subiu do Conferidor pro motor em 11/08 ═══════════════════════════════
     Ela vivia dentro do <script> do fpmed_conferidor.html. Quando a ficha do negócio passou a
     conferir a proposta anexada contra o PMVG, havia duas saídas: copiar estas 15 linhas pra lá,
     ou trazê-las pra cá. Copiar seria criar duas leituras da mesma proposta — e no dia em que
     alguém melhorar a de um lado (um formato de preço novo, uma coluna a mais), o outro passa a
     ler o MESMO PDF de um jeito diferente. Duas respostas para "este preço está acima do teto?"
     é o defeito mais caro que este arquivo existe pra impedir.
     >>> O CONFERIDOR CONTINUA CHAMANDO PELO MESMO NOME (ele lê do motor agora), então nada mudou
         pra quem usa aquela tela. */

  // O PREÇO É O ÚLTIMO NÚMERO DA LINHA. Não é adivinhação: proposta tem descrição à esquerda e
  // valores à direita, e o último costuma ser o unitário ou o total. Quando houver dois números,
  // a tela mostra o que leu — conferir uma leitura errada é fácil; descobrir depois, não.
  function precoDaLinha(txt){
    const nums = String(txt).match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+[.,]\d+|-?\d+/g);
    if(!nums || !nums.length) return null;
    const s = nums[nums.length-1];
    // "1.234,56" (BR) vs "1234.56" — vírgula manda quando existe
    const n = s.includes(',') ? parseFloat(s.replace(/\./g,'').replace(',','.')) : parseFloat(s);
    return isFinite(n) ? n : null;
  }
  function itensDoTexto(txt){
    return String(txt).split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 5)
      .map(l => ({ linha: l, descricao: l.replace(/[\d.,;\t ]+$/,'').trim() || l, precoUnit: precoDaLinha(l) }))
      .filter(x => x.descricao.length >= 4);
  }

  const API = { semAcento, doses, concMags, forma, unidadePack, packNosso,
                indexar, chavesDoseDe, avaliar, resumir,
                precoDaLinha, itensDoTexto };
  raiz.LimedtecTetoCMED = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
