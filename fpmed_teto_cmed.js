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

  // ── ESTAS QUATRO SÃO CÓPIA VERBATIM DO fpmed_licitacoes.html ────────────────────────────
  // O cruzamento do Licitações já as usa e já foi validado no ar contra dado real (4 defeitos
  // corrigidos em 05/08: calibre French virando pack, match por 1 palavra, volume confundido com
  // concentração, corrida com o gm-auth). Reescrever aqui seria refazer aquela depuração.
  // >>> E A CÓPIA É VIGIADA: o tests/testa_teto_cmed.js compara as duas versões e fica VERMELHO
  //     se alguém mexer em uma e esquecer da outra. A cópia não é o problema; a cópia
  //     silenciosa é. (O conserto definitivo é o Licitações passar a carregar este arquivo —
  //     registrado como pendência, não feito hoje pra não mexer no cruzamento que está no ar.)
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

  const API = { semAcento, doses, concMags, forma, indexar, chavesDoseDe, avaliar, resumir };
  raiz.LimedtecTetoCMED = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
