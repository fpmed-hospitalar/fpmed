/* ══════════════════════════════════════════════════════════════════════════════════════════════
   prova_vai_embora.js — "O QUE ESTÁ INDO EMBORA", MEDIDO CONTRA O BANCO (fatia B32, 20/08/2026)

   ══ O QUE A CAIXA PEDIU ═════════════════════════════════════════════════════════════════════
   *"As três fontes conferidas contra o SQL uma a uma, o rodapé da dívida com número, e o estado
   vazio desenhado."* É o que está aqui, nessa ordem — e cada fonte é conferida contra uma consulta
   que **não passa pelo mesmo código** que a montou.

   ══ ESTA PROVA NÃO ESCREVE NADA. NENHUMA LINHA ══════════════════════════════════════════════
   A lista da manhã é uma LEITURA das três fontes que outras fatias já povoam. Escrever aqui para
   "fazer a lista aparecer cheia" seria fabricar a prova — a mesma coisa que esta janela recusou na
   B30, com estas palavras: *"a caixa pediu uma ata real do começo ao fim; ela não existe, e eu não
   vou fabricar uma para a prova parecer cheia."* O que aparecer aqui é o estado de hoje.
   >>> A ÚNICA ESCRITA DA RODADA está na `prova_ata_entrada.js`, na ata de ensaio 2569.

   ══ E O DEFEITO QUE ELA CAÇA NÃO LEVANTA EXCEÇÃO ════════════════════════════════════════════
   Uma linha a menos numa lista de urgência não quebra nada: a tela fica mais curta, e lista curta
   lê-se como *"pouca coisa vencendo"*. Por isso toda contagem aqui é comparada com o SQL nos DOIS
   sentidos — quantas entraram E quantas ficaram de fora, com o motivo de cada uma.

     node tools/prova_vai_embora.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const { Client } = require('pg');
const V = require('../fpmed_vai_embora.js');

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const pega = re => (seg.match(re) || [])[1];
const REF = 'xzdowrksuswekwffoluk';
const PW = pega(/DB_PASSWORD\s*[:=]\s*(\S+)/i);
const ANON = pega(/ANON_KEY\s*[:=]\s*(\S+)/i);
const SB = pega(/PROJECT_URL\s*[:=]\s*(\S+)/i) || `https://${REF}.supabase.co`;
const SENHA = pega(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || 'adm2026';
if (!PW) { console.error('DB_PASSWORD nao encontrada — abortando.'); process.exit(1); }

const ALVOS = [
  { host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
  { host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
];
async function conecta() {
  let ultimo;
  for (const a of ALVOS) {
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

let p = 0, f = 0;
const ok = (t, c, e) => { if (c) { p++; console.log('  ok    ' + t); }
  else { f++; console.log('  FALHA ' + t + (e !== undefined ? '\n        [' + JSON.stringify(e).slice(0, 400) + ']' : '')); } };

(async () => {
  const db = await conecta();
  const cr = await cracha();
  if (!cr) { console.error('nao consegui o cracha do navegador — abortando (nao vou usar service_role).'); process.exit(1); }
  const H = { apikey: ANON, Authorization: 'Bearer ' + cr.tk };
  const LE = async u => { const r = await fetch(`${SB}/rest/v1/${u}`, { headers: H });
                          if (!r.ok) throw new Error(u.split('?')[0] + ' respondeu ' + r.status);
                          return r.json(); };
  const HOJE = V.hojeISO();

  console.log('=== "O QUE ESTA INDO EMBORA" — AS TRES FONTES CONTRA O SQL (B32) ===');
  console.log('    cracha do navegador: ' + cr.email + '  ·  hoje: ' + HOJE + '\n');

  // ══ AS TRÊS FONTES, LIDAS EXATAMENTE COMO A TELA AS LÊ ════════════════════════════════════
  const certidoes = await LE('v_documentos_situacao?select=id,nome,tipo,orgao_emissor,validade,'
    + 'dias_para_vencer,situacao&situacao=in.(vencido,vencendo)&order=validade.asc');
  const atas = await LE('v_atas_vigencia?select=*');
  const arq = await LE('v_atas_arquivadas?select=id,arquivado_em');
  /* ══ OS NEGÓCIOS SÃO LIDOS PAGINADOS, DO MESMO JEITO QUE A TELA LÊ ═══════════════════════════
     A primeira versão desta prova pediu `&limit=5000` numa tabela de 2.500 linhas e recebeu **1.000**
     — o `db-max-rows` do PostgREST corta em silêncio, com HTTP 200. O resultado: três dos seis
     negócios vivos não vinham no lote, o motor achou que não existiam, e a prova acusou o MOTOR de
     divergir do SQL (2 contra 5). O motor estava certo; **a prova é que tinha lido menos que a
     tela.** É a família do `200 que baixava 400` da B25 e do `204 que apaga zero linhas` da B30:
     código de sucesso sobre um efeito parcial.
     >>> A LIÇÃO É A REGRA DA PROVA, e não do produto: **prova que lê a fonte de um jeito diferente
         da tela não está medindo a tela.** Aqui ela usa o mesmo `Range` de 1.000 em 1.000 que a
         `lerNegociosPaginado` usa, e para pelo mesmo teto. */
  const PAG = 1000, TETO = 20;
  let negocios = [], pag = 0, truncou = false;
  while (pag < TETO) {
    const de = pag * PAG;
    const r = await fetch(`${SB}/rest/v1/negocios?select=id,titulo,orgao,municipio,uf,estagio,`
      + `valor_estimado,abertura,arquivado,licitacao_id&order=abertura.desc`,
      { headers: Object.assign({}, H, { Range: `${de}-${de + PAG - 1}`, 'Range-Unit': 'items' }) });
    if (!r.ok) throw new Error('negocios respondeu ' + r.status);
    const d = await r.json();
    negocios = negocios.concat(d);
    if (d.length < PAG) break;
    pag++;
    if (pag >= TETO) truncou = true;
  }
  ok('a leitura dos negocios nao bateu no teto de paginacao (' + negocios.length + ' linhas)', !truncou);

  /* ══ A TERCEIRA FONTE, E O CRITÉRIO DO RECORTE PUBLICADO ═════════════════════════════════════
     "licitação fechando com item meu" = NEGÓCIO VIVO deste funil que ainda não chegou à fase Ata.
     Vivo = `arquivado = false`. É o recorte, e o motivo dele está escrito na tela: um negócio no
     funil existe porque alguém desta casa decidiu participar dele, e é ESSA decisão que responde
     "com item meu". Casar item do edital com o nosso catálogo seria estimativa — proibida aqui.
     >>> A DATA vem do índice do A (encerramento da proposta) quando o negócio tem certame
         amarrado, e da ficha (abertura da sessão) quando não tem. Não são a mesma data, e cada
         linha diz qual usou. */
  const vivos = negocios.filter(n => !n.arquivado && n.estagio !== 'contrato');
  const comCertame = vivos.filter(n => n.licitacao_id).map(n => n.licitacao_id);
  let porLic = {};
  if (comCertame.length) {
    const d = await LE(`licitacoes?id=in.(${comCertame.join(',')})&select=id,data_encerramento`);
    d.forEach(l => { porLic[l.id] = l; });
  }
  const licitacoes = vivos.map(n => {
    const l = n.licitacao_id ? porLic[n.licitacao_id] : null;
    const doIndice = l && l.data_encerramento;
    return { id: n.id, titulo: n.titulo, orgao: n.orgao, municipio: n.municipio, uf: n.uf,
             estagio: n.estagio, valor_estimado: n.valor_estimado,
             prazo: doIndice ? l.data_encerramento : n.abertura,
             prazo_origem: doIndice ? 'encerramento da proposta (PNCP)' : 'abertura da sessão (ficha)' };
  });

  const R = V.juntar({ certidoes: certidoes,
    atas: atas.concat(arq.map(a => Object.assign({ situacao: 'sem_vigencia' }, a))),
    licitacoes: licitacoes }, HOJE);

  console.log('    a lista de hoje: ' + R.linhas.length + ' linha(s) — '
    + JSON.stringify(R.contagem));
  console.log('    a divida: ' + JSON.stringify(R.divida) + '\n');

  // ══ 1. CERTIDÃO ══════════════════════════════════════════════════════════════════════════
  console.log('-- 1. certidao vencendo (do cofre da B25/B27) — o verbo e RENOVAR --');
  {
    const sql = (await db.query(`
      select count(*) filter (where situacao in ('vencido','vencendo') and validade is not null) as devem_entrar,
             count(*) filter (where situacao in ('vencido','vencendo') and validade is null)      as sem_validade,
             count(*) filter (where situacao = 'vencido')                                        as vencidos
        from public.v_documentos_situacao`)).rows[0];
    ok('*** as certidoes que entraram batem com o SQL: ' + R.contagem.certidao + ' ***',
      R.contagem.certidao === Number(sql.devem_entrar), [R.contagem.certidao, sql.devem_entrar]);
    ok('e as sem validade ficaram FORA e foram contadas: ' + R.divida.certidaoSemValidade,
      R.divida.certidaoSemValidade === Number(sql.sem_validade),
      [R.divida.certidaoSemValidade, sql.sem_validade]);
    const vencidas = R.linhas.filter(l => l.fonte === 'certidao' && l.vencido).length;
    ok('as vencidas sao marcadas como tal: ' + vencidas, vencidas === Number(sql.vencidos),
      [vencidas, sql.vencidos]);
    /* ══ O CORTE NÃO NASCE NESTA TELA, E É AQUI QUE ISSO SE MEDE ═══════════════════════════════
       O cofre decide "vencendo" com o `dias_aviso` de CADA documento — o alvará da vigilância e a
       CND federal não avisam com a mesma antecedência (B27). Se esta tela tivesse um corte próprio,
       a MESMA certidão sairia "vencendo" no cofre e ausente da lista da manhã.
       >>> A PRIMEIRA VERSÃO DESTE ASSERT COBRAVA "as antecedências são DIFERENTES entre si", e ele
           acendeu vermelho sobre código certo: hoje só há DUAS certidões no cofre, uma vencida e
           uma a 10 dias — não há duas antecedências para serem diferentes. Um assert que exige
           variedade num conjunto de tamanho 1 mede o povoamento da base, não a regra.
       >>> O QUE SE MEDE AGORA É A REGRA: o número de dias desta tela tem de ser o MESMO que o
           cofre publica para o mesmo documento. Se os dois divergirem, a certidão sai "vence em 10
           dias" numa tela e "vence em 9" na outra, e ninguém sabe em qual acreditar — que é o
           defeito que a `v_documentos_situacao` existe para evitar, voltando pela tela nova. */
    const porDoc = {}; certidoes.forEach(d => { porDoc[d.id] = d; });
    const divergem = R.linhas.filter(l => l.fonte === 'certidao'
      && porDoc[l.id] && porDoc[l.id].dias_para_vencer != null
      && Number(porDoc[l.id].dias_para_vencer) !== l.dias);
    ok('*** os dias de cada certidao batem com os que o COFRE publica, uma a uma ***',
      divergem.length === 0, divergem.map(l => [l.id, l.dias, porDoc[l.id].dias_para_vencer]));
    ok('e nenhuma certidao foi barrada por uma janela desta tela (todas as `vencendo` do cofre entraram)',
      R.contagem.certidao === certidoes.filter(d => d.validade != null).length,
      [R.contagem.certidao, certidoes.length]);
    ok('todas as linhas de certidao mandam RENOVAR',
      R.linhas.filter(l => l.fonte === 'certidao').every(l => l.verbo === 'renovar'));
  }

  // ══ 2. ATA ═══════════════════════════════════════════════════════════════════════════════
  console.log('\n-- 2. ata vencendo com saldo (da B30) — o verbo e EMPENHAR --');
  {
    const sql = (await db.query(`
      select count(*) filter (where situacao in ('vencida','vencendo'))                as devem_entrar,
             count(*) filter (where situacao = 'sem_vigencia')                          as sem_validade,
             count(*)                                                                   as na_view
        from public.v_atas_vigencia`)).rows[0];
    const gav = (await db.query('select count(*) as n from public.v_atas_arquivadas')).rows[0];
    ok('*** as atas que entraram batem com o SQL: ' + R.contagem.ata + ' ***',
      R.contagem.ata === Number(sql.devem_entrar), [R.contagem.ata, sql.devem_entrar]);
    ok('*** e as SEM VALIDADE ficaram de fora e foram contadas: ' + R.divida.ataSemValidade + ' ***',
      R.divida.ataSemValidade === Number(sql.sem_validade),
      [R.divida.ataSemValidade, sql.sem_validade]);
    ok('*** as ARQUIVADAS tambem, e por outro motivo — alguem decidiu tira-las: ' + R.divida.ataArquivada + ' ***',
      R.divida.ataArquivada === Number(gav.n), [R.divida.ataArquivada, gav.n]);
    ok('e nenhuma ata arquivada aparece na lista',
      !R.linhas.some(l => l.fonte === 'ata' && arq.some(a => a.id === l.id)));
    /* A CONTA DE DIAS, CONTRA A ARITMÉTICA DE `date` DO POSTGRES — o oráculo que a B30 usou e que
       não erra do mesmo jeito que o `Date` do JavaScript (ela nem conhece fuso). */
    const dias = (await db.query(
      'select id, dias_para_vencer from public.v_atas_vigencia where ata_vigencia_fim is not null')).rows;
    const mapa = {}; dias.forEach(d => { mapa[d.id] = Number(d.dias_para_vencer); });
    const divergem = R.linhas.filter(l => l.fonte === 'ata' && mapa[l.id] !== undefined && mapa[l.id] !== l.dias);
    ok('*** os dias de cada ata batem com o `date` do Postgres, uma a uma ***',
      divergem.length === 0, divergem.map(l => [l.id, l.dias, mapa[l.id]]));
    ok('todas as linhas de ata mandam EMPENHAR',
      R.linhas.filter(l => l.fonte === 'ata').every(l => l.verbo === 'empenhar'));
    /* `null` É "NÃO INFORMADO"; `0` É UMA AFIRMAÇÃO — a lei da casa, medida na linha da lista. */
    const semSaldo = R.linhas.filter(l => l.fonte === 'ata' && l.unidades === null).length;
    ok('*** ata sem item com saldo informado sai com `null`, e nunca com 0: ' + semSaldo + ' linha(s) ***',
      R.linhas.filter(l => l.fonte === 'ata').every(l => l.unidades === null || l.unidades > 0),
      R.linhas.filter(l => l.fonte === 'ata').map(l => l.unidades));
  }

  // ══ 3. LICITAÇÃO ═════════════════════════════════════════════════════════════════════════
  console.log('\n-- 3. licitacao sua fechando (do indice do A, SO LEITURA) — o verbo e PROPOR --');
  {
    /* O SQL REPETE O RECORTE INTEIRO, INCLUSIVE A ESCOLHA DA DATA — se ele repetisse só metade,
       ele concordaria com o motor por acaso. `coalesce(l.data_encerramento, n.abertura)` é a mesma
       regra que a tela aplica, escrita do outro lado. */
    const sql = (await db.query(`
      with vivos as (
        select n.id, coalesce(l.data_encerramento, n.abertura)::date as quando
          from public.negocios n
          left join public.licitacoes l on l.id = n.licitacao_id
         where not n.arquivado and n.estagio <> 'contrato')
      select count(*) filter (where quando is not null and quando >= current_date
                                and quando <= current_date + $1::int)     as devem_entrar,
             count(*) filter (where quando is null)                        as sem_data,
             count(*) filter (where quando is not null and quando < current_date) as ja_passou,
             count(*)                                                      as vivos
        from vivos`, [V.JANELA_LICITACAO])).rows[0];
    console.log('    negocios vivos (nao arquivados, fora da fase Ata): ' + sql.vivos
      + '  ·  com certame amarrado: ' + comCertame.length);
    ok('*** as licitacoes que entraram batem com o SQL: ' + R.contagem.licitacao + ' ***',
      R.contagem.licitacao === Number(sql.devem_entrar), [R.contagem.licitacao, sql.devem_entrar]);
    ok('*** as sem data ficaram de fora e foram contadas: ' + R.divida.licitacaoSemData + ' ***',
      R.divida.licitacaoSemData === Number(sql.sem_data), [R.divida.licitacaoSemData, sql.sem_data]);
    ok('*** e as que ja passaram tambem — nao ha o que propor, mas elas nao SOMEM: '
      + R.divida.licitacaoJaPassou + ' ***',
      R.divida.licitacaoJaPassou === Number(sql.ja_passou), [R.divida.licitacaoJaPassou, sql.ja_passou]);
    ok('a janela publicada e de ' + V.JANELA_LICITACAO + ' dias, e nenhuma linha passa dela',
      R.linhas.filter(l => l.fonte === 'licitacao').every(l => l.dias >= 0 && l.dias <= V.JANELA_LICITACAO),
      R.linhas.filter(l => l.fonte === 'licitacao').map(l => l.dias));
    ok('todas as linhas de licitacao mandam PROPOR',
      R.linhas.filter(l => l.fonte === 'licitacao').every(l => l.verbo === 'propor'));
    ok('*** e cada uma diz DE ONDE veio a data (o indice do PNCP ou a ficha do funil) ***',
      R.linhas.filter(l => l.fonte === 'licitacao').every(l => !!l.prazoOrigem),
      [...new Set(R.linhas.filter(l => l.fonte === 'licitacao').map(l => l.prazoOrigem))]);
  }

  // ══ 4. A ORDEM, E ELA É ÚNICA ════════════════════════════════════════════════════════════
  console.log('\n-- 4. um relogio so: quem morre primeiro --');
  {
    const d = R.linhas.map(l => l.dias);
    ok('*** a lista sai ordenada por quem morre primeiro, sem separar por tipo ***',
      d.every((x, i) => i === 0 || d[i - 1] <= x), d);
    const tipos = R.linhas.map(l => l.fonte);
    ok('e os tipos aparecem MISTURADOS quando os prazos mandam (nada de abas)',
      new Set(tipos).size <= 1 || tipos.join(',') !== [...tipos].sort().join(','), tipos);
    // A ORDEM É ESTÁVEL entre duas montagens do mesmo dia: senão alguém clica na linha errada.
    const R2 = V.juntar({ certidoes: certidoes.slice().reverse(),
      atas: atas.slice().reverse().concat(arq.map(a => Object.assign({ situacao: 'sem_vigencia' }, a))),
      licitacoes: licitacoes.slice().reverse() }, HOJE);
    ok('*** e ela nao muda quando as fontes chegam em outra ordem ***',
      R.linhas.map(l => l.fonte + ':' + l.id).join() === R2.linhas.map(l => l.fonte + ':' + l.id).join(),
      [R.linhas.map(l => l.fonte + ':' + l.id), R2.linhas.map(l => l.fonte + ':' + l.id)]);
  }

  // ══ 5. O RODAPÉ DA DÍVIDA, COM NÚMERO ════════════════════════════════════════════════════
  console.log('\n-- 5. o rodape da divida, com numero (o que a caixa pediu por escrito) --');
  {
    const frases = V.frasesDaDivida(R.divida);
    frases.forEach(s => console.log('    · ' + s));
    const soma = Object.values(R.divida).reduce((a, b) => a + b, 0);
    ok('*** toda divida contada vira frase, e toda frase comeca com um NUMERO ***',
      frases.every(s => /^\d+ /.test(s)) && (soma === 0 ? frases.length === 0 : frases.length > 0),
      frases);
    /* ══ ESTE ASSERT ACENDEU VERMELHO SOBRE UMA FRASE CERTA ═════════════════════════════════════
       Ele proibia a palavra "algum" em qualquer lugar, e a frase da licitação que já passou diz
       *"Se **algum** continua na Disputa, ele parou no meio"* — que é uma condicional legítima
       sobre um caso, e não um número vago. A regra verdadeira é sobre a CONTAGEM: nenhuma frase
       pode começar contando com uma palavra em vez de um número. Cobrar o LUGAR, não a palavra —
       a mesma lição que reescreveu um assert da `testa_ata_saldo` e outro da `testa_vai_embora`. */
    ok('e nenhuma frase CONTA com palavra vaga no lugar do numero',
      frases.every(s => !/^(alguns?|algumas?|vários?|várias)\b/i.test(s.trim())), frases);
    ok('*** a divida cobre os CINCO motivos de ficar de fora, e cada um pede uma acao diferente ***',
      Object.keys(R.divida).length === 5, Object.keys(R.divida));
    ok('sem divida nenhuma, o rodape nao nasce ("0 atas fora desta lista" e ruido com cara de aviso)',
      V.frasesDaDivida({ certidaoSemValidade: 0, ataSemValidade: 0, licitacaoSemData: 0,
                         licitacaoJaPassou: 0, ataArquivada: 0 }).length === 0);
  }

  // ══ 6. O ESTADO VAZIO, DESENHADO ═════════════════════════════════════════════════════════
  console.log('\n-- 6. vazio e vitoria, e tem que parecer --');
  {
    const vazio = V.juntar({ certidoes: [], atas: [], licitacoes: [] }, HOJE);
    ok('sem nada vencendo, a lista sai vazia e sem divida',
      vazio.linhas.length === 0 && V.frasesDaDivida(vazio.divida).length === 0);
    const NEGHTML = fs.readFileSync('C:/fpmed/fpmed_negocios.html', 'utf8');
    ok('*** e a tela desenha isso em VERDE, com o icone do certo — nao uma tela em branco ***',
      /class="ve-vazio"/.test(NEGHTML) && /#ic-certo/.test(NEGHTML)
      && /\.ve-vazio\{[^}]*var\(--verde-300\)/.test(NEGHTML));
    ok('*** e a boa noticia e CONFERIVEL: ela diz os tres horizontes verdadeiros, e nao um numero unico ***',
      /Nenhuma certidão dentro do próprio aviso/.test(NEGHTML)
      && /em 60 dias e nenhuma licitação sua fechando em/.test(NEGHTML));
    ok('o esqueleto do CARREGANDO nasce no HTML e diz que esta lendo (nao que nada vence)',
      /<div id="vai-embora" class="ve-cx">[\s\S]{0,400}lendo os prazos/.test(NEGHTML));
    ok('*** e as tres fontes caidas dao tela VERMELHA, e nao tela calma ***',
      /VE_FALHOU\.length >= 3/.test(NEGHTML) && /Não consegui ler os prazos/.test(NEGHTML));
  }

  await db.end();
  console.log('\n== PLACAR ==');
  console.log('  ' + p + ' ok, ' + f + ' falha(s)');
  console.log('\n  >>> NENHUMA LINHA FOI ESCRITA POR ESTA PROVA. O que aparece acima e o estado de');
  console.log('      hoje, lido com o cracha de ' + cr.email + ' e conferido contra o SQL.');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
