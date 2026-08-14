/* ══════════════════════════════════════════════════════════════════════════════════════════
   prova_estado_sem_arquivo.js — A FATIA A23 CONTRA O DADO REAL (14/08/2026)

   A pendência do TRABALHADOR B, em uma frase: *"o PNCP respondeu 'sem arquivo publicado' e a
   tela voltava a dizer 'ainda não foi buscado' depois do F5"*.

   ══ O DEFEITO ERA DE PORTA, E NÃO DE REGRA ═════════════════════════════════════════════════
   O `tools/coleta_editais.js` (a porta do operador) já gravava a linha do "sem arquivo" desde a
   fatia A6. A edge `buscar-edital` (a porta das TELAS) respondia `semArquivo: true` e não gravava
   nada. Duas portas para o mesmo fato, e só uma com memória: quem clicava pela tela recebia a
   frase certa e a perdia no F5 seguinte — e clicava de novo, para sempre.

   O QUE ESTA PROVA MEDE:
     1. que o estado FICA no banco depois que a edge responde (é o F5 simulado: pergunta ao
        banco, não à resposta da chamada);
     2. que ele NÃO cria linha duplicada quando a pessoa clica de novo — a sentinela do
        `url_pncp` é parte da chave única, e as duas portas usam a MESMA;
     3. que a frase gravada é a que a TELA procura (`não publicou arquivo`) — um texto diferente
        aqui faria a tela deixar de reconhecer o que ela mesma mandou gravar;
     4. que "não consegui perguntar" continua sendo diferente de "não tem".

   node tools/prova_estado_sem_arquivo.js
   ══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const ANON = (seg.match(/anon[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '\n         ' + JSON.stringify(e) : '')); } };

async function token() {
  for (const email of ['licitacao@fpmed.com.br', 'comercial@fpmed.com.br']) {
    try {
      const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: SENHA }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (j.access_token) return j.access_token;
    } catch { }
  }
  return null;
}
const le = async (q) => (await (await fetch(`${SB}/rest/v1/${q}`, { headers: H })).json());

(async () => {
  console.log('PROVA DA FATIA A23 — o "sem arquivo no PNCP" sobrevive ao F5\n');

  // ── 1. AS DUAS PORTAS GRAVAM A MESMA SENTINELA ──────────────────────────────────────────
  const cli = fs.readFileSync(path.join(RAIZ, 'tools', 'coleta_editais.js'), 'utf8');
  const edge = fs.readFileSync(path.join(RAIZ, 'supabase', 'functions', 'buscar-edital', 'index.ts'), 'utf8');
  const tela = fs.readFileSync(path.join(RAIZ, 'fpmed_licitacoes.html'), 'utf8');
  ok(n + '. *** as DUAS portas usam a MESMA sentinela de url (senão dá linha dupla por porta) ***',
    /url_pncp: 'sem-arquivo:\/\/pncp'/.test(cli) && /url_pncp: "sem-arquivo:\/\/pncp"/.test(edge)); n++;
  ok(n + '. *** e a MESMA frase — que é a que a tela procura pra reconhecer o estado ***',
    /o PNCP não publicou arquivo para esta licitação/.test(cli)
    && /o PNCP não publicou arquivo para esta licitação/.test(edge)
    && /\/não publicou arquivo\/\.test\(a\.extracao_erro/.test(tela)); n++;
  ok(n + '. ...e a tela mostra QUANDO foi conferido (é conferência datada, não verdade eterna)',
    /semArquivo:true, quando: semArq\.coletado_em/.test(tela)
    && /conferido em ' \+ fmtDt\(DET\.edital\.quando\)/.test(tela)); n++;
  /* A SEGUNDA PORTA DO MESMO BURACO: 200 com lista que não tem edital. `editais` vazio ->
     `linhas` vazia -> nada gravado -> "ainda não foi buscado" no F5, igual ao 404. */
  ok(n + '. *** e o caso "publicou arquivos, nenhum é edital" também grava estado ***',
    /url_pncp: "sem-edital:\/\/pncp"/.test(edge)
    && /arqs\.length && !editais\.length/.test(edge)); n++;
  ok(n + '. ...com frase DIFERENTE do 404, porque a ação é outra (olhar os anexos x anexar à mão)',
    /nenhum `\s*\n?\s*\+ `deles e edital ou termo de referencia/.test(edge)
    || /nenhum deles e edital ou termo de referencia/.test(edge.replace(/`\s*\n\s*\+ `/g, ''))); n++;
  /* GRAVAR NÃO PODE DERRUBAR A RESPOSTA: se a escrita falhar, a pessoa continua vendo a frase
     certa. O pior que acontece é voltar ao comportamento de antes desta fatia. */
  ok(n + '. a falha da gravação não vira erro da busca (a resposta ao usuário continua certa)',
    /catch \(_\) \{\s*\n?[\s\S]{0,400}?\}\s*\n\s*await registra/.test(edge)); n++;

  // ── 2. O ESTADO QUE JÁ EXISTE NO BANCO ──────────────────────────────────────────────────
  console.log('\n── o que já está gravado ───────────────────────────────────────────────────');
  const semArq = await le('licitacao_arquivos?select=numero_controle,url_pncp,extracao_erro,coletado_em'
    + '&url_pncp=like.sem-*');
  console.log(`  linhas de estado "sem arquivo/sem edital": ${semArq.length}`);
  semArq.slice(0, 5).forEach(x => console.log(`    ${x.numero_controle} · ${x.url_pncp}`
    + ` · ${String(x.coletado_em || '').slice(0, 16).replace('T', ' ')}`));
  ok(n + '. *** existe pelo menos UM estado gravado (o fallback honesto da A6 está de pé) ***',
    semArq.length > 0, { linhas: semArq.length }); n++;
  ok(n + '. ...e toda linha de estado carrega o MOTIVO escrito (nunca ausência muda)',
    semArq.every(x => String(x.extracao_erro || '').trim().length > 10)); n++;
  ok(n + '. ...e o QUANDO (é ele que a tela mostra pra decidir se vale conferir de novo)',
    semArq.every(x => !!x.coletado_em)); n++;

  // ── 3. O F5 SIMULADO, CONTRA A EDGE DE VERDADE ──────────────────────────────────────────
  console.log('\n── o F5 simulado: a edge responde, e o banco lembra ────────────────────────');
  const tk = await token();
  if (!tk) {
    console.log('  ~ nenhum e-mail logou com a SENHA_PADRAO: a metade autenticada não foi medida.');
  } else {
    /* ══ QUAL CASO USAR, E POR QUE ESTE ═════════════════════════════════════════════════════
       Eu ia procurar uma licitação com 404 em `/arquivos` (o caso do 1º buraco). MEDIDO hoje:
       **0 em 240 licitações do índice** respondem 404 — todas publicaram algum arquivo. É por
       isso que o defeito passou despercebido tanto tempo: o estado que ele apagava quase nunca
       acontece na base atual.
       >>> O SEGUNDO BURACO, ESSE SIM, É COMUM: 8 em 80 licitações têm arquivos e NENHUM deles é
           edital ou termo de referência (aviso de contratação direta, estudo técnico, mapa de
           riscos). Era exatamente o mesmo silêncio — `editais` vazio, nada gravado, "ainda não
           foi buscado" no F5 seguinte — e ninguém tinha nomeado esse caso.
       A prova usa o caso que ACONTECE, e diz por que trocou. */
    const cands = await le('licitacoes?select=numero_controle,cnpj,ano,sequencial,orgao,municipio'
      + '&order=data_publicacao.asc&limit=90');
    const jaTem = new Set(semArq.map(x => x.numero_controle));
    const EH_EDITAL = (t) => /edital|termo de referência|termo de referencia/i.test(String(t || ''));
    let alvo = null, tipos = null, quatro04 = 0, testadas = 0;
    for (const c of cands) {
      if (jaTem.has(c.numero_controle)) continue;
      try {
        const r = await fetch(`https://pncp.gov.br/api/pncp/v1/orgaos/${c.cnpj}/compras/${c.ano}/${c.sequencial}/arquivos`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
        testadas++;
        if (r.status === 404) { quatro04++; alvo = c; tipos = '(404 — o órgão não anexou nada)'; break; }
        if (!r.ok) continue;
        const a = await r.json();
        if (Array.isArray(a) && a.length && !a.some(y => EH_EDITAL(y.tipoDocumentoNome))) {
          alvo = c; tipos = [...new Set(a.map(y => y.tipoDocumentoNome))].join(', ');
          break;
        }
      } catch { /* segue */ }
    }
    console.log(`  varridas ${testadas} licitações · 404 em /arquivos: ${quatro04}`);
    if (!alvo) {
      console.log('  ~ nenhuma candidata caiu num dos dois estados agora — F5 não medido.');
    } else {
      console.log(`  tipos publicados: ${tipos}`);
      console.log(`  alvo: ${alvo.numero_controle} · ${alvo.orgao} · ${alvo.municipio}`);
      const chama = async () => {
        const r = await fetch(`${SB}/functions/v1/buscar-edital`, {
          method: 'POST',
          headers: { apikey: ANON, Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
          body: JSON.stringify({ numero_controle: alvo.numero_controle }),
        });
        let j = null; try { j = await r.json(); } catch { }
        return { http: r.status, corpo: j };
      };
      const r1 = await chama();
      ok(n + '. a edge responde o estado (sem arquivo OU sem edital) e diz que GRAVOU',
        r1.http === 200 && r1.corpo && (r1.corpo.semArquivo === true || r1.corpo.semEdital === true)
        && r1.corpo.gravouEstado === true, r1); n++;
      // ═══ O F5: pergunta ao BANCO, e não à resposta da chamada ═══
      const depois = await le('licitacao_arquivos?select=numero_controle,url_pncp,extracao_erro,coletado_em'
        + `&numero_controle=eq.${encodeURIComponent(alvo.numero_controle)}`);
      ok(n + '. *** e O ESTADO FICA NO BANCO — é isto que sobrevive ao F5 ***',
        depois.length === 1 && /^sem-(arquivo|edital):\/\/pncp$/.test(depois[0].url_pncp || '')
        && String(depois[0].extracao_erro || '').length > 10, depois); n++;
      ok(n + '. ...com o QUANDO preenchido', depois.length === 1 && !!depois[0].coletado_em,
        depois[0] && depois[0].coletado_em); n++;
      // ═══ clicar de novo não pode criar segunda linha ═══
      await chama();
      const dedois = await le('licitacao_arquivos?select=id'
        + `&numero_controle=eq.${encodeURIComponent(alvo.numero_controle)}`);
      ok(n + '. *** clicar de novo NÃO cria segunda linha (a sentinela é parte da chave única) ***',
        dedois.length === 1, { linhas: dedois.length }); n++;
      console.log(`  gravado: ${depois[0] && depois[0].url_pncp} · `
        + `${String(depois[0] && depois[0].coletado_em || '').slice(0, 16).replace('T', ' ')}`);
    }
  }

  // ── 4. OS OUTROS DOIS MIÚDOS DA A23 ─────────────────────────────────────────────────────
  console.log('\n── os outros dois miúdos ──────────────────────────────────────────────────');
  const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
  /* O DETECTOR É O MESMO DO CONSERTO: `Ã` sozinho NÃO é sintoma ("NÃO", "VERSÃO" são corretos).
     O sintoma é `Ã` seguido da faixa 0x80–0xBF, que é a segunda metade de um par UTF-8 lido
     byte a byte. Um assert que proibisse `Ã` reprovaria português correto. */
  const quebrados = sw.split('\n').map((l, i) => ({ l, i: i + 1 }))
    .filter(x => /Ã[-¿]|â€|â”|â•/.test(x.l));
  ok(n + '. *** o comentário do sw.js está legível (zero acento quebrado) ***',
    quebrados.length === 0, quebrados.slice(0, 3).map(x => x.i + ': ' + x.l.slice(0, 70))); n++;
  ok(n + '. ...e o português correto continua lá (o conserto não apagou "NÃO"/"VERSÃO")',
    /VERSÃO muda/.test(sw) && /NÃO DÁ PRA REAPROVEITAR/.test(sw)); n++;
  ok(n + '. ...e a versão do service worker SUBIU (senão o conserto não chega em quem já instalou)',
    /const VERSAO = 'limedtec-fpmed-2026-08-13-79'/.test(sw)); n++;

  const menu = fs.readFileSync(path.join(RAIZ, 'limedtec-menu.js'), 'utf8');
  ok(n + '. *** o guia do FPMED ganhou entrada no menu (ele estava na casca e inalcançável) ***',
    /href="fpmed_ajuda\.html"/.test(menu) && /Como usar o FPMED/.test(menu)); n++;
  ok(n + '. ...no RODAPÉ, e não na lista de módulos (ler o guia não é etapa do fluxo)',
    /lm-rodape[\s\S]{0,200}?fpmed_ajuda\.html/.test(menu)); n++;
  ok(n + '. ...e a tela do guia existe de verdade (item de menu para tela ausente é beco)',
    fs.existsSync(path.join(RAIZ, 'fpmed_ajuda.html'))); n++;
  ok(n + '. ...e ela está na casca do service worker (senão o guia é a tela que quebra offline)',
    /fpmed_ajuda\.html/.test(sw)); n++;

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message + '\n' + e.stack); process.exit(1); });
