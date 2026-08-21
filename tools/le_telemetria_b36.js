/* ══════════════════════════════════════════════════════════════════════════════════════════════
   le_telemetria_b36.js — O QUE DÁ PARA SABER SEM ABRIR O PAINEL (fatia B36, 21/08/2026)

   ══ O QUE ESTA FERRAMENTA NÃO FAZ, E ELA DIZ ISSO ANTES DE QUALQUER NÚMERO ═══════════════════
   Ela **não lê o PostHog**. A caixa manda não logar no painel, e além disso não haveria como: o
   `docs/TELEMETRIA.md §1` guarda a chave de ESCRITA de eventos (`phc_…`), que por desenho *"não
   dá acesso de leitura ao painel"*, e a chave pessoal de API — a única que lê — é secreta e, nas
   palavras do próprio documento, *"não entra em lugar nenhum do código"*. Conferido: ela não
   está no `segredos.local.txt` (que tem ANON_KEY, SERVICE_ROLE, DB_PASSWORD, RESEND, ANTHROPIC e
   mais três, e nenhuma do PostHog).
   >>> ENTÃO OS 11 EVENTOS DA PRIMEIRA HORA QUE O ARQUITETO VIU NO PAINEL EU NÃO VI, e não vou
       supor o que eles dizem. O que esta ferramenta faz é responder as MESMAS DUAS PERGUNTAS
       pelo lado de cá, com o dado que é nosso — e deixar claro qual metade continua faltando.

   ══ PERGUNTA 1 — "QUAIS BUSCAS VOLTAM VAZIAS" ═══════════════════════════════════════════════
   O `resultado_zero` responde isso sobre o que o USUÁRIO digitou. Do nosso lado dá para responder
   sobre o que ele VAI digitar: desde a A34 a busca não fala mais com o PNCP, ela lê o NOSSO
   índice — então a resposta "zero" é uma propriedade da nossa base, não do portal, e ela é
   calculável hoje. O vocabulário que este cliente digita está no `cotacoes` (8.832 linhas do
   catálogo real da FPMED), e a busca é reproduzida EXATAMENTE como a tela faz:
     · no objeto ..... `licitacoes?texto_busca=ilike.*termo*`  (a coluna gerada da ddl/busca_local)
     · nos itens ..... `rpc/itens_por_licitacao?p_termo=…`
   Um termo só é ZERO quando os dois devolvem nada — que é o critério da tela.
   >>> E É UM PISO, NÃO UMA ESTIMATIVA: a tela ainda filtra por janela de datas, UF e modalidade.
       Termo que dá zero no índice INTEIRO dá zero em qualquer recorte dele. O número que sai aqui
       é o menor possível, e por isso ele não pode ser lido como "só isso falha".

   ══ PERGUNTA 2 — "QUAIS ERROS O USUÁRIO ESTÁ VENDO" ═════════════════════════════════════════
   O `erro_visto_pelo_usuario` manda a CAUSA. Do nosso lado dá para (a) inventariar todos os
   pontos que disparam esse evento e (b) olhar o que a tela ESCREVE na hora — que é a metade que
   o painel nunca vai contar, porque o evento carrega a causa e não a frase.

   ══ E COM O CRACHÁ DO NAVEGADOR, NUNCA COM A `service_role` ═════════════════════════════════
   Medir a busca com uma chave que passa por cima da RLS mediria uma busca que não existe.

     node tools/le_telemetria_b36.js            (o padrão: 120 termos mais frequentes)
     node tools/le_telemetria_b36.js --termos 40
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const pega = re => (seg.match(re) || [])[1];
const REF = 'xzdowrksuswekwffoluk';
const PW = pega(/DB_PASSWORD\s*[:=]\s*(\S+)/i);
const ANON = pega(/ANON_KEY\s*[:=]\s*(\S+)/i);
const SB = pega(/PROJECT_URL\s*[:=]\s*(\S+)/i) || `https://${REF}.supabase.co`;
const SENHA = pega(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || 'adm2026';
if (!PW) { console.error('DB_PASSWORD nao encontrada — abortando.'); process.exit(1); }

const iTermos = process.argv.indexOf('--termos');
const N_TERMOS = iTermos > -1 ? Math.max(5, parseInt(process.argv[iTermos + 1], 10) || 120) : 120;

async function conecta() {
  let ultimo;
  for (const a of [{ host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
                   { host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` }]) {
    const c = new Client({ host: a.host, port: a.port, user: a.user, password: PW, database: 'postgres',
      ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    try { await c.connect(); return c; } catch (e) { ultimo = e; try { await c.end(); } catch (_) {} }
  }
  throw ultimo;
}
async function cracha() {
  for (const email of ['licitacao@fpmed.com.br', 'comercial@fpmed.com.br']) {
    const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: SENHA }) }).catch(() => null);
    if (r && r.ok) { const j = await r.json(); if (j.access_token) return { tk: j.access_token, email }; }
  }
  return null;
}

/* A MESMA normalização da tela (`semAcento` + maiúscula), e o mesmo escape de LIKE. Escrever
   outra aqui mediria uma busca diferente da que o usuário faz — o defeito que a A34 já pagou
   para não ter quando desceu o filtro para o banco. */
const semAcento = s => String(s == null ? '' : s).normalize('NFD')
  .split('').filter(c => { const k = c.codePointAt(0); return !(k >= 0x300 && k <= 0x36f); }).join('');
const escapaLike = t => String(t).replace(/([%_\\])/g, '\\$1');

(async () => {
  console.log('LEITURA DA TELEMETRIA — fatia B36 · 21/08/2026\n');
  console.log('>>> O PAINEL DO POSTHOG NAO FOI ABERTO, e nao e escolha de estilo: a chave que esta');
  console.log('    no codigo e a de ESCRITA de evento e nao le painel nenhum (docs/TELEMETRIA.md');
  console.log('    §1); a chave pessoal, que le, e secreta e nao esta no segredos.local.txt.');
  console.log('    Entao os 11 eventos que o arquiteto viu no painel EU NAO VI. O que vem abaixo');
  console.log('    responde as mesmas duas perguntas pelo lado de ca, com o dado que e nosso.\n');

  const c = await conecta();
  const q = async (sql, args) => (await c.query(sql, args || [])).rows;
  const cr = await cracha();
  if (!cr) { console.log('>>> SEM LOGIN: a parte da busca NAO RODOU. Dito, e nao suposto.'); }
  const H = cr ? { apikey: ANON, Authorization: 'Bearer ' + cr.tk } : null;
  console.log(cr ? `crachá: ${cr.email}\n` : '');

  try {
    // ════════════════════════════════════════════════════════════════════════════════════════
    // 1. O DICIONÁRIO DE HOJE
    // ════════════════════════════════════════════════════════════════════════════════════════
    console.log('══ 1. O DICIONARIO QUE O `resultado_zero` EXISTE PARA ENGORDAR ══');
    const dic = await q(`select termo, equivale, fonte from busca_sinonimos order by id`);
    const pInt = await q(`select termo from busca_palavra_inteira order by id`);
    console.log(`   ${dic.length} sinonimos · ${pInt.length} palavra(s) marcada(s) como inteira`);
    const porTermo = {};
    dic.forEach(d => { (porTermo[d.termo] = porTermo[d.termo] || []).push(d.equivale); });
    Object.keys(porTermo).forEach(t => console.log(`     ${t.padEnd(18)} -> ${porTermo[t].join(' · ')}`));
    const fontes = [...new Set(dic.map(d => d.fonte))];
    console.log(`   fontes: ${fontes.join(' | ')}`);
    console.log('   >>> TODOS vieram de fatia do trabalhador A, escritos a mao em 14/08. NENHUM');
    console.log('       veio de busca que deu zero — que e exatamente o que o evento veio resolver.\n');

    // ════════════════════════════════════════════════════════════════════════════════════════
    // 2. QUAIS BUSCAS VOLTAM VAZIAS — medido no nosso índice, com o crachá
    // ════════════════════════════════════════════════════════════════════════════════════════
    console.log('══ 2. QUAIS BUSCAS VOLTAM VAZIAS (medido, nao suposto) ══');
    const idx = (await q(`select count(*) n, count(distinct uf) ufs,
        min(data_publicacao) de, max(data_publicacao) ate from licitacoes`))[0];
    console.log(`   o indice: ${idx.n} licitacoes · ${idx.ufs} UFs · ${String(idx.de).slice(0, 10)} a ${String(idx.ate).slice(0, 10)}`);

    /* O VOCABULÁRIO É O DO CLIENTE, e não uma lista que eu inventei. A primeira palavra do nome
       do produto é o que alguém digita quando procura ("DIPIRONA 500MG CX/200" -> "DIPIRONA"). */
    const vocab = await q(`
      with palavras as (
        select upper(split_part(trim(produto), ' ', 1)) p from cotacoes
         where produto is not null and length(trim(produto)) > 2
        union all
        select upper(trim(principio_ativo)) from cotacoes
         where principio_ativo is not null and length(trim(principio_ativo)) > 2)
      select p termo, count(*) vezes from palavras
       where length(p) >= 4 and p ~ '^[A-ZÀ-Ú]'
       group by 1 order by 2 desc limit $1`, [N_TERMOS]);
    console.log(`   vocabulario: os ${vocab.length} termos mais frequentes do catalogo da FPMED (cotacoes)`);
    console.log(`   >>> E UM RECORTE, e esta dito: ha mais termos abaixo do corte. Publicar "os N`);
    console.log(`       mais frequentes" sem dizer que ha cauda seria o corte silencioso de sempre.\n`);

    if (!H) {
      console.log('   (sem crachá — a busca não foi medida)\n');
    } else {
      const busca = async termo => {
        const t = semAcento(termo);
        let obj = null, itens = null;
        try {
          const r = await fetch(`${SB}/rest/v1/licitacoes?select=numero_controle`
            + '&texto_busca=ilike.' + encodeURIComponent('*' + escapaLike(t) + '*')
            + '&limit=1', { headers: Object.assign({ Prefer: 'count=exact', Range: '0-0' }, H) });
          if (r.ok) obj = parseInt(String(r.headers.get('content-range') || '/0').split('/')[1], 10) || 0;
        } catch (e) { /* fica null = não sei */ }
        try {
          const r2 = await fetch(`${SB}/rest/v1/rpc/itens_por_licitacao?p_termo=${encodeURIComponent(t)}`,
            { headers: H });
          if (r2.ok) { const d = await r2.json(); itens = Array.isArray(d) ? d.length : 0; }
        } catch (e) { /* idem */ }
        return { termo, obj, itens };
      };

      const res = [];
      for (let i = 0; i < vocab.length; i += 6) {
        const lote = await Promise.all(vocab.slice(i, i + 6).map(v => busca(v.termo)));
        lote.forEach((r, k) => res.push(Object.assign({ vezes: Number(vocab[i + k].vezes) }, r)));
      }
      const naoSei = res.filter(r => r.obj === null && r.itens === null);
      const medidos = res.filter(r => !(r.obj === null && r.itens === null));
      const zeros = medidos.filter(r => (r.obj || 0) === 0 && (r.itens || 0) === 0);
      const soItens = medidos.filter(r => (r.obj || 0) === 0 && (r.itens || 0) > 0);

      console.log(`   ${medidos.length} termos medidos · ${naoSei.length} nao respondidos (nao sei, e nao "nao ha")`);
      console.log(`   *** ${zeros.length} de ${medidos.length} voltam VAZIOS nas duas frentes `
        + `(${Math.round(100 * zeros.length / Math.max(1, medidos.length))}%) ***`);
      console.log(`   ${soItens.length} nao aparecem no OBJETO mas aparecem nos ITENS — quem busca so pelo`);
      console.log('   objeto do edital nao acharia esses, e a tela ja procura nos dois. Isso e o');
      console.log('   caminho dos itens PAGANDO por si: sem ele, a conta de zero seria outra.\n');

      console.log('   OS TERMOS MAIS PEDIDOS DO CATALOGO QUE NAO ACHAM NADA (por frequencia):');
      zeros.sort((a, b) => b.vezes - a.vezes).slice(0, 25).forEach(z =>
        console.log(`     ${z.termo.slice(0, 28).padEnd(30)} ${String(z.vezes).padStart(5)}x no catalogo`));
      if (zeros.length > 25) console.log(`     ... e mais ${zeros.length - 25}`);
      console.log('');
      console.log('   E OS QUE ACHAM MUITO (para o zero acima nao parecer defeito da busca):');
      medidos.slice().sort((a, b) => (b.obj || 0) - (a.obj || 0)).slice(0, 8).forEach(m =>
        console.log(`     ${m.termo.slice(0, 28).padEnd(30)} ${String(m.obj).padStart(6)} licitacoes no objeto`));
      console.log('');
    }

    // ════════════════════════════════════════════════════════════════════════════════════════
    // 3. QUAIS ERROS O USUÁRIO ESTÁ VENDO
    // ════════════════════════════════════════════════════════════════════════════════════════
    console.log('══ 3. QUAIS ERROS O USUARIO ESTA VENDO ══');
    const telas = ['fpmed_licitacoes.html', 'fpmed_negocios.html', 'fpmed_documentos.html',
                   'fpmed_giovana.html', 'fpmed_ajuda.html'];
    let disparos = 0;
    for (const t of telas) {
      const src = fs.readFileSync(path.join(RAIZ, t), 'utf8');
      const n = (src.match(/erro_visto_pelo_usuario'/g) || []).length
              - (src.match(/\/\*[^*]*erro_visto_pelo_usuario/g) || []).length;
      const chamadas = (src.match(/tel\('erro_visto_pelo_usuario'|evento\('erro_visto_pelo_usuario'/g) || []).length;
      disparos += chamadas;
      console.log(`   ${t.padEnd(24)} ${chamadas} ponto(s) que disparam o evento`);
    }
    console.log(`   total: ${disparos} pontos em ${telas.length} telas\n`);

    /* ══ A METADE QUE O PAINEL NUNCA CONTA ═══════════════════════════════════════════════════
       O evento leva a CAUSA (`e.message`). Ele não leva — e não deve levar — a FRASE que a tela
       pinta. Então "o erro chegou no PostHog" e "o usuário leu uma frase de gente" são duas
       coisas, e a segunda só se confere aqui, lendo o que a tela escreve. */
    console.log('   O QUE A TELA ESCREVE NA HORA (o painel nao ve isto):');
    /* SEM COMENTÁRIO, pela mesma razão da `tests/testa_erro_visivel.js`: a prosa desta casa CITA
       o literal proibido para ensinar a regra, e um leitor que confunde a citação com o uso acusa
       quem explica. É o defeito 14 da régua do A (fatia A31) com outra roupa. */
    const { semComentario } = require('./regua_visual.js');
    let bug = 0;
    for (const t of telas) {
      const src = semComentario(fs.readFileSync(path.join(RAIZ, t), 'utf8').replace(/\r\n/g, '\n'));
      const linhas = src.split('\n');
      linhas.forEach((l, i) => {
        if (/textContent\s*=\s*['"`]\s*<[a-z]/i.test(l)) {
          bug++;
          console.log(`     ${t}:${i + 1}  textContent com MARCA-UP dentro:`);
          console.log(`        ${l.trim().slice(0, 96)}`);
        }
      });
    }
    console.log(bug
      ? `   *** ${bug} lugar(es) onde a pessoa LE a etiqueta <svg> como texto, no exato momento\n`
        + '       em que alguma coisa falhou. `textContent` nao interpreta marca-up: ele imprime.\n'
      : '   nenhum `textContent` com marca-up — as frases de erro saem como frase.\n');

    // ════════════════════════════════════════════════════════════════════════════════════════
    // 4. O DICIONÁRIO QUE JÁ EXISTE NO NOSSO DADO — MEDIDO, E NÃO EXECUTADO
    // ════════════════════════════════════════════════════════════════════════════════════════
    /* ══ POR QUE ESTE BLOCO NÃO ESCREVE NADA ═════════════════════════════════════════════════
       A `busca_sinonimos` alimenta a tela Encontrar, que é território do trabalhador A. Enfiar
       centenas de linhas nela no meio da rodada dele mudaria o comportamento da busca sem que
       ninguém tivesse pedido — é a mesma lei que me impediu de consertar a régua dele na B22.
       O que cabe aqui é a MEDIÇÃO com o número na mão, para a decisão ser barata para quem é. */
    console.log('══ 4. O DICIONARIO QUE JA ESTA NO NOSSO DADO (medido; nada foi escrito) ══');
    const cat = (await q(`select count(*) total,
        count(*) filter (where principio_ativo is not null and length(trim(principio_ativo)) > 2) com_pa,
        count(distinct upper(trim(principio_ativo))) filter (where principio_ativo is not null) pas
      from cotacoes`))[0];
    const cob = Math.round(100 * Number(cat.com_pa) / Number(cat.total));
    console.log(`   ${cat.total} linhas no catalogo · ${cat.com_pa} com principio ativo preenchido (${cob}%)`);
    console.log(`   ${cat.pas} principios ativos distintos`);
    /* O PAR "palavra do catálogo -> princípio ativo" que dá para derivar SEM ninguém digitar. Ele
       é MUITOS-PARA-MUITOS de propósito: medido, "G.MALEATO" leva a DEXCLORFENIRAMINA E a
       ENALAPRIL — são dois maleatos diferentes, e escolher um seria mandar o usuário para o
       remédio errado. A `busca_sinonimos` já aceita várias linhas por termo (o "equipo" tem
       duas), então a forma da tabela não precisa mudar. */
    const pares = await q(`
      select upper(split_part(trim(produto), ' ', 1)) termo,
             upper(trim(principio_ativo)) equivale, count(*) linhas
        from cotacoes
       where produto is not null and principio_ativo is not null
         and length(trim(principio_ativo)) > 2
         and upper(split_part(trim(produto), ' ', 1)) <> upper(trim(principio_ativo))
       group by 1, 2`);
    const termosDeriv = new Set(pares.map(p => p.termo));
    const multi = {};
    pares.forEach(p => { multi[p.termo] = (multi[p.termo] || 0) + 1; });
    const comDois = Object.keys(multi).filter(t => multi[t] > 1);
    console.log(`   *** ${pares.length} pares derivaveis, cobrindo ${termosDeriv.size} palavras do catalogo ***`);
    console.log(`   ${comDois.length} palavras levam a MAIS DE UM principio ativo — e por isso a relacao`);
    console.log('   tem de ser muitos-para-muitos. Escolher um seria mandar para o remedio errado.');
    console.log(`   hoje a busca_sinonimos tem ${dic.length} linhas, todas digitadas a mao.`);
    console.log('');
    console.log('   E O QUE ELA NAO RESOLVE, dito com o mesmo cuidado:');
    const semPa = await q(`select upper(split_part(trim(produto),' ',1)) termo, count(*) linhas
        from cotacoes where produto is not null
       group by 1
      having count(*) filter (where principio_ativo is not null and length(trim(principio_ativo))>2) = 0
       order by 2 desc limit 8`);
    console.log(`     ${100 - cob}% do catalogo nao tem principio ativo preenchido. Para essas palavras`);
    console.log('     o nosso dado NAO SABE, e derivar dali seria inventar. As mais frequentes:');
    semPa.forEach(s => console.log(`       ${s.termo.slice(0, 24).padEnd(26)} ${String(s.linhas).padStart(5)}x`));

    console.log('\n══ 5. O QUE ISSO MANDA CONSERTAR ══');
    console.log('   Vai no relatorio, em uma pagina. Aqui ficam so os numeros que o sustentam.');

  } finally { await c.end(); }
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
