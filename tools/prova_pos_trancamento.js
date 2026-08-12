// ============================================================================
// prova_pos_trancamento.js — as provas de depois que o repositório virou PRIVADO.
//
// O que se protegeu NÃO foi segredo — a medição de 11/08 mostrou que não havia
// nenhum exposto (só a chave `anon`, que é pública por natureza). O que se
// protegeu foi O PRODUTO: o esquema do banco, as 94 suítes, o kit_cliente e o
// molde LIMEDTEC deixaram de ser clonáveis por qualquer um.
//
// >>> A PROVA QUE IMPORTA É A DO DESLOGADO. Eu, aqui, estou autenticado no git
// local — se eu medir com a minha credencial, eu provo que EU consigo, que é o
// contrário do que se quer saber. Toda chamada abaixo vai SEM autenticação
// nenhuma, que é como o mundo vê o repositório.
//
//   node tools/prova_pos_trancamento.js
// ============================================================================
'use strict';
const H = { 'User-Agent': 'fpmed-prova', Accept: 'application/vnd.github+json' };
const DONO = 'fpmed-hospitalar', REPO = 'fpmed';
const SITE = 'https://fpmed-hospitalar.github.io/fpmed/';

let ok = 0, falha = 0;
const diz = (bom, titulo, detalhe) => {
  console.log('  ' + (bom ? '[ok]   ' : '[FALHA]') + ' ' + titulo + (detalhe ? '   ' + detalhe : ''));
  bom ? ok++ : falha++;
};

(async () => {
  console.log('=== 1. O REPOSITÓRIO ESTÁ MESMO TRANCADO? (sem autenticação) ===');
  const r = await fetch(`https://api.github.com/repos/${DONO}/${REPO}`, { headers: H });
  diz(r.status === 404, 'API do repo responde 404 pra quem está deslogado', 'HTTP ' + r.status);
  if (r.ok) {
    const j = await r.json();
    diz(j.private === true, 'campo private', String(j.private));
  }

  console.log('\n=== 2. RAW E CLONE BLOQUEADOS ===');
  /* raw.githubusercontent: é por onde alguém copiaria um arquivo sem clonar.
     >>> TODO ARQUIVO DESTA LISTA TEM QUE EXISTIR NO REPO. A primeira versão da
     lista começava com `README.md`, que NÃO existe aqui — e o 404 de "arquivo
     inexistente" é idêntico ao 404 de "repo trancado". O teste deu verde por
     motivo errado, e verde por motivo errado é pior que vermelho: ele encerra a
     investigação. Um assert que não sabe distinguir os dois 404 não prova nada. */
  for (const arq of ['COMPLIANCE.md', 'CONTINUAR_AQUI.txt', 'ddl/negocios.sql',
    'kit_cliente/MOLDE.txt', 'fpmed_tema.css', 'docs/PADRAO_EXCELENCIA.md']) {
    const rr = await fetch(`https://raw.githubusercontent.com/${DONO}/${REPO}/master/${arq}`, { headers: H });
    diz(rr.status === 404, 'raw bloqueado: ' + arq, 'HTTP ' + rr.status);
  }
  // clone anônimo: o endpoint que o `git clone` usa antes de baixar qualquer coisa.
  const rc = await fetch(`https://github.com/${DONO}/${REPO}.git/info/refs?service=git-upload-pack`, { headers: H });
  diz(rc.status === 401 || rc.status === 404, 'clone anônimo recusado', 'HTTP ' + rc.status);

  // a página do repo no navegador
  const rh = await fetch(`https://github.com/${DONO}/${REPO}`, { headers: H, redirect: 'manual' });
  diz(rh.status === 404 || rh.status === 302, 'página do repo não abre deslogado', 'HTTP ' + rh.status);

  console.log('\n=== 3. O SITE CONTINUA NO AR (o que o cliente usa) ===');
  const telas = ['index.html', 'fpmed_licitacoes.html', 'fpmed_negocios.html',
    'fpmed_edital_ia.html', 'reset-senha.html', 'manifest.webmanifest', 'sw.js',
    'fpmed_tema.css', 'cliente.config.js', 'logo_fpmed.png'];
  for (const t of telas) {
    const rs = await fetch(SITE + t, { headers: H });
    const txt = rs.ok && /\.(html|js|css|webmanifest)$/.test(t) ? await rs.text() : '';
    diz(rs.ok, 'no ar: ' + t, 'HTTP ' + rs.status + (txt ? '  ' + Math.round(txt.length / 1024) + ' KB' : ''));
  }

  console.log('\n=== 4. O PWA CONTINUA INSTALÁVEL ===');
  const rm = await fetch(SITE + 'manifest.webmanifest', { headers: H });
  if (rm.ok) {
    const m = await rm.json().catch(() => null);
    diz(!!m, 'manifest é JSON válido');
    if (m) {
      diz(Array.isArray(m.icons) && m.icons.length > 0, 'manifest declara ícones', (m.icons || []).length + ' ícones');
      for (const ic of (m.icons || []).slice(0, 3)) {
        const u = ic.src.startsWith('http') ? ic.src : SITE + ic.src.replace(/^\.?\//, '');
        const ri = await fetch(u, { headers: H });
        diz(ri.ok, 'ícone no ar: ' + ic.src, 'HTTP ' + ri.status);
      }
    }
  }
  const rsw = await fetch(SITE + 'sw.js', { headers: H });
  if (rsw.ok) {
    const s = await rsw.text();
    const v = (s.match(/VERSAO\s*=\s*['"]([^'"]+)/) || [])[1];
    diz(!!v, 'service worker servido, com VERSAO', v || '?');
  }

  console.log('\n=== 5. AS AUTOMAÇÕES NA COTA NOVA ===');
  console.log('  (execuções e minutos precisam de token — ver a nota no fim)');
  const ra = await fetch(`https://api.github.com/repos/${DONO}/${REPO}/actions/runs?per_page=1`, { headers: H });
  console.log('  GET /actions/runs sem token -> HTTP ' + ra.status
    + (ra.status === 404 ? '   (esperado num repo privado: também some da vista pública)' : ''));

  console.log('\n' + '='.repeat(72));
  console.log('RESULTADO: ' + ok + ' ok, ' + falha + ' falha(s)');
  console.log('='.repeat(72));
  if (falha) process.exitCode = 1;
})();
