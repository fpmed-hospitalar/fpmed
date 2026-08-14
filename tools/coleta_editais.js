/* ══════════════════════════════════════════════════════════════════════════════════════════
   coleta_editais.js — O ABASTECIMENTO DE EDITAIS (fatia A6, 14/08/2026)

   O que ele faz: para uma licitação, descobre no PNCP quais arquivos ela publicou, guarda o
   LINK e o TIPO de cada um, e EXTRAI O TEXTO do que for edital. É esse texto que a IA lê no
   "conversar com o edital" — e é guardá-lo que permite perguntar dez vezes pagando UMA
   extração.

   ══ O QUE ELE **NÃO** FAZ, E ISSO É REGRA DA CAIXA ═════════════════════════════════════════
   *"PROIBIDO baixar em massa o Brasil inteiro. Só sob demanda + meus negócios."*
   Não há modo "varre tudo". As duas portas são:
     · `--controle <numero_controle>` .... sob demanda (uma licitação, a que alguém abriu);
     · `--meus-negocios` ................ só as licitações que estão no funil.
   >>> POR QUE A PROIBIÇÃO É DESENHO E NÃO DISCIPLINA: um edital tem 2 a 12 MB. O índice tem
       3.201 licitações hoje e vai a dezenas de milhares com a fatia A8. Baixar tudo é
       centenas de gigabytes de banda do PNCP — um serviço público — para ler o que ninguém
       pediu. A porta que não existe não é esquecida num dia de pressa.

   ══ O PDF INTEIRO NÃO É GUARDADO AQUI ══════════════════════════════════════════════════════
   O que fica no banco é o TEXTO (que é o que a IA usa) e o LINK ORIGINAL (que é o que uma
   pessoa abre para conferir). O PDF completo só entra para licitação que está nos meus
   negócios, e no bucket de anexos — que é território da outra janela.

     node tools/coleta_editais.js --controle 03659166002156-1-000034/2026
     node tools/coleta_editais.js --meus-negocios [--teto 20]
     node tools/coleta_editais.js --controle ... --previa     (não grava nada)
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = n => process.argv.includes(n);
const PREVIA = tem('--previa');
const TETO = parseInt(arg('--teto') || '20', 10);

/* O QUE CONTA COMO EDITAL. O PNCP tipa os documentos, e o `tipoDocumentoNome` é dado dele, não
   inferência nossa. Só o que é edital (ou termo de referência) vale a extração: minuta de
   contrato e minuta de ata são o DEPOIS da disputa, e extrair as três triplicaria o custo pra
   responder pior — a IA teria três documentos e teria que adivinhar qual responde a pergunta. */
const EH_EDITAL = t => /edital|termo de referência|termo de referencia/i.test(String(t || ''));
const TETO_MB = 25;   // acima disto o texto quase certamente é escaneado; ver o comentário abaixo

async function pncp(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) { const e = new Error('o PNCP respondeu ' + r.status); e.status = r.status; throw e; }
  return r.json();
}

/* ══ A EXTRAÇÃO ═══════════════════════════════════════════════════════════════════════════
   pdf.js, o MESMO motor que a tela do Leitor e o Conferidor já usam no navegador. Uma segunda
   biblioteca de PDF daria dois textos diferentes do mesmo documento — e o texto é o que a IA
   lê para responder sobre uma licitação de milhões.
   >>> PDF ESCANEADO NÃO TEM TEXTO, e isso não é falha: é um documento que é uma FOTO. Devolver
       string vazia como se o edital fosse vazio seria a mentira mais cara desta fatia. Quando
       sai quase nada, a extração registra o motivo e a tela dirá que precisa de leitura por
       imagem (que é caminho de IA, não de parser). */
async function extraiTexto(buf) {
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false }).promise;
  const partes = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await doc.getPage(p);
    const c = await pg.getTextContent();
    /* AGRUPA POR Y PRA PRESERVAR A LINHA — a mesma técnica do Atualizar Estoque. Sem isso, uma
       tabela de itens vira uma sopa de palavras e a IA lê quantidade de um item com a descrição
       de outro. */
    const linhas = new Map();
    for (const it of c.items) {
      const y = Math.round((it.transform ? it.transform[5] : 0) * 2) / 2;
      if (!linhas.has(y)) linhas.set(y, []);
      linhas.get(y).push(it.str);
    }
    const ordenadas = [...linhas.entries()].sort((a, b) => b[0] - a[0]).map(([, ps]) => ps.join(' ').replace(/\s+/g, ' ').trim());
    partes.push(ordenadas.filter(Boolean).join('\n'));
  }
  return { texto: partes.join('\n\n'), paginas: doc.numPages };
}

async function jaTem(controle) {
  const r = await fetch(`${SB}/rest/v1/licitacao_arquivos?select=id,url_pncp,texto_chars&numero_controle=eq.${encodeURIComponent(controle)}`, { headers: H });
  return r.ok ? r.json() : [];
}

async function umaLicitacao(lic) {
  const rot = `${lic.numero_controle}`;
  const existentes = await jaTem(lic.numero_controle);
  const comTexto = existentes.filter(x => (x.texto_chars || 0) > 0).length;
  if (comTexto) { console.log(`  ${rot}  já tem ${comTexto} arquivo(s) com texto — pulando`); return { pulou: true }; }

  let arqs;
  try {
    arqs = await pncp(`https://pncp.gov.br/api/pncp/v1/orgaos/${lic.cnpj}/compras/${lic.ano}/${lic.sequencial}/arquivos?pagina=1&tamanhoPagina=30`);
  } catch (e) {
    /* ══ 404 AQUI É "NÃO PUBLICOU ARQUIVO", E NÃO FALHA ═══════════════════════════════════
       MEDIDO em 14/08 com uma licitação real de Jandaia/GO: quando o órgão não anexou nada, o
       PNCP responde **404**, e não uma lista vazia. Eu tinha escrito o contrário (esperava
       `[]`), e o efeito era grave: o caso mais comum do fallback honesto caía no balde de
       "erro de rede" e NÃO era registrado — então a tela continuaria dizendo "ainda não
       coletei" para sempre, sobre uma licitação que o PNCP já respondeu que não tem edital.
       >>> "NÃO EXISTE" E "NÃO CONSEGUI PERGUNTAR" SÃO ESTADOS DIFERENTES, e este 404 é o
           primeiro. Os outros erros continuam sendo erro. */
    if (e.status !== 404) {
      console.log(`  ${rot}  ⚠️ não consegui listar os arquivos (${e.message})`);
      return { erro: e.message };
    }
    arqs = [];
  }
  if (!Array.isArray(arqs) || !arqs.length) {
    /* ══ O FALLBACK HONESTO (item (d) da fatia) ═══════════════════════════════════════════
       O PNCP nem sempre publica o edital. Isto é registrado como FATO — uma linha com o
       motivo — e não como ausência. Ausência é indistinguível de "ainda não coletei", e a
       tela precisa poder dizer "o PNCP não publicou" em vez de "não sei". */
    console.log(`  ${rot}  ○ o PNCP não publicou arquivo nenhum para esta licitação`);
    if (!PREVIA) {
      await fetch(`${SB}/rest/v1/licitacao_arquivos`, {
        method: 'POST', headers: { ...H, Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify([{
          numero_controle: lic.numero_controle, licitacao_id: lic.id || null,
          url_pncp: 'sem-arquivo://pncp', titulo: null, tipo: null, sequencial: null,
          extracao_erro: 'o PNCP não publicou arquivo para esta licitação',
        }]),
      });
    }
    return { semArquivo: true };
  }

  const editais = arqs.filter(a => EH_EDITAL(a.tipoDocumentoNome));
  console.log(`  ${rot}  ${arqs.length} arquivo(s), ${editais.length} edital/TR`);

  const linhas = [];
  for (const a of arqs) {
    const linha = {
      numero_controle: lic.numero_controle, licitacao_id: lic.id || null,
      sequencial: a.sequencialDocumento ?? null,
      titulo: a.titulo || null, tipo: a.tipoDocumentoNome || null,
      url_pncp: a.url || a.uri,
    };
    /* SÓ O EDITAL É BAIXADO E EXTRAÍDO. Os outros ficam registrados com link e tipo — quem
       quiser abre no PNCP. Baixar todos multiplicaria banda e tempo por 5 para guardar texto
       que ninguém vai perguntar. */
    if (EH_EDITAL(a.tipoDocumentoNome)) {
      try {
        const r = await fetch(linha.url_pncp, { signal: AbortSignal.timeout(180000) });
        if (!r.ok) throw new Error('download respondeu ' + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        linha.bytes = buf.length;
        if (buf.length > TETO_MB * 1024 * 1024) {
          linha.extracao_erro = `arquivo de ${(buf.length / 1048576).toFixed(1)} MB — acima do teto de ${TETO_MB} MB`;
          console.log(`     ⚠️ ${a.titulo}: ${linha.extracao_erro}`);
        } else {
          const { texto, paginas } = await extraiTexto(buf);
          linha.texto_extraido = texto;
          linha.texto_chars = texto.length;
          linha.texto_paginas = paginas;
          linha.extraido_em = new Date().toISOString();
          /* MENOS DE 200 CARACTERES POR PÁGINA = PDF ESCANEADO. Isto é medição, não palpite:
             um edital de verdade passa de mil por página. Registrar o motivo é o que impede a
             tela de dizer "o edital está vazio". */
          if (texto.length < paginas * 200) {
            linha.extracao_erro = `saiu quase sem texto (${texto.length} chars em ${paginas} páginas) — provavelmente PDF escaneado, precisa de leitura por imagem`;
            console.log(`     ⚠️ ${a.titulo}: ${linha.extracao_erro}`);
          } else {
            console.log(`     ✓ ${String(a.titulo).slice(0, 46)} — ${paginas} pág, ${texto.length.toLocaleString('pt-BR')} chars`);
          }
        }
      } catch (e) {
        linha.extracao_erro = e.message;
        console.log(`     ⚠️ ${String(a.titulo).slice(0, 46)}: ${e.message}`);
      }
    }
    linhas.push(linha);
  }

  if (PREVIA) { console.log('     [PRÉVIA — nada gravado]'); return { previa: true, linhas: linhas.length }; }
  /* ══ TODAS AS LINHAS DO LOTE PRECISAM DAS MESMAS CHAVES ═══════════════════════════════════
     O PostgREST recusa um insert em lote cujos objetos tenham conjuntos de chaves diferentes:
     `PGRST102 — All object keys must match`. E era exatamente o meu caso, porque só as linhas
     de EDITAL ganham `texto_extraido`/`texto_chars`; as de minuta de contrato não.
     >>> NORMALIZAR COM `null` NÃO É O MESMO QUE OMITIR, e aqui o null é o certo: "esta linha
         não tem texto extraído" é um fato sobre ela, e não uma coluna que não existe. */
  const CAMPOS = ['numero_controle', 'licitacao_id', 'sequencial', 'titulo', 'tipo', 'url_pncp',
                  'bytes', 'texto_extraido', 'texto_chars', 'texto_paginas', 'extraido_em', 'extracao_erro'];
  const lote = linhas.map(l => { const o = {}; for (const c of CAMPOS) o[c] = (c in l) ? l[c] : null; return o; });
  /* UPSERT PELA CHAVE (numero_controle, url_pncp): re-rodar a coleta do mesmo edital REESCREVE
     a linha dele, e não cria uma segunda. Isso é "refazer o mesmo", não "apagar o anterior" —
     a mesma distinção do item 10 da CMED. */
  const r = await fetch(`${SB}/rest/v1/licitacao_arquivos`, {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify(lote),
  });
  if (!r.ok) { console.log('     ERRO ao gravar: ' + r.status + ' ' + (await r.text()).slice(0, 160)); return { erro: 'gravacao' }; }
  return { gravou: lote.length };
}

(async () => {
  console.log('=== ABASTECIMENTO DE EDITAIS (fatia A6) ===' + (PREVIA ? '   [PRÉVIA]' : ''));
  const controle = arg('--controle');
  const meus = tem('--meus-negocios');
  if (!controle && !meus) {
    console.error('\nuso:  --controle <numero_controle>   |   --meus-negocios [--teto N]   [--previa]');
    console.error('\nNÃO existe modo "varre tudo", e isso é desenho: a caixa proíbe baixar em massa o');
    console.error('Brasil inteiro. Edital tem 2 a 12 MB; o índice vai a dezenas de milhares.');
    process.exit(1);
  }

  let alvos = [];
  if (controle) {
    alvos = await (await fetch(`${SB}/rest/v1/licitacoes?select=id,numero_controle,cnpj,ano,sequencial,objeto&numero_controle=eq.${encodeURIComponent(controle)}`, { headers: H })).json();
    if (!alvos.length) { console.error('\nnão achei esta licitação no índice: ' + controle); process.exit(1); }
  } else {
    /* SÓ AS DO FUNIL. A junção é por `numero`, que é a mesma chave que a ponte Encontrar ->
       Negócios já usa pra não duplicar negócio. Duas chaves diferentes pra "é o mesmo pregão?"
       seria o defeito que o selo "dos meus negócios" existe pra evitar. */
    const negs = await (await fetch(`${SB}/rest/v1/negocios?select=licitacao_id,numero&arquivado=is.false`, { headers: H })).json();
    const ids = [...new Set(negs.map(n => n.licitacao_id).filter(Boolean))];
    console.log(`\n${negs.length} negócio(s) aberto(s) no funil · ${ids.length} com licitação do índice ligada`);
    if (ids.length) {
      alvos = await (await fetch(`${SB}/rest/v1/licitacoes?select=id,numero_controle,cnpj,ano,sequencial,objeto&id=in.(${ids.join(',')})&limit=${TETO}`, { headers: H })).json();
    }
  }

  console.log(`\nlicitações a abastecer: ${alvos.length}` + (alvos.length > TETO ? ` (teto ${TETO})` : ''));
  let ok = 0, sem = 0, erro = 0;
  for (const l of alvos.slice(0, TETO)) {
    const r = await umaLicitacao(l);
    if (r.gravou || r.previa || r.pulou) ok++; else if (r.semArquivo) sem++; else erro++;
  }
  console.log(`\n── resumo ──  ${ok} abastecida(s) · ${sem} sem arquivo no PNCP · ${erro} com erro`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
