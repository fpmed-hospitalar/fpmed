// ============================================================================================
// prova_conferencia_proposta.js — PROVA que a conferencia da proposta anexada roda de ponta a
// ponta: le o PDF, casa contra a CMED pelo MESMO motor do Conferidor, e o resultado bate.
//
// ══ O QUE ELE PROVA, E O QUE NAO ════════════════════════════════════════════════════════════
// PROVA: que o motor compartilhado (`fpmed_teto_cmed.js`) le uma proposta real, casa os itens
// contra a tabela CMED DO BANCO e devolve teto item a item — e que o numero que a tela mostraria
// e esse. Roda no node, importando o motor DE VERDADE (nao uma copia).
// NAO PROVA: o clique de anexar (isso e storage e RLS, provados em tests/db/testa_anexos_rls.js).
//
// >>> A PROPOSTA DE TESTE E MONTADA A PARTIR DA PROPRIA CMED, e isso e proposital: pego
//     apresentacoes reais do banco e escrevo linhas de proposta com preco ABAIXO e ACIMA do teto
//     conhecido. Assim da pra conferir o veredito contra uma resposta que eu ja sei — que e a
//     unica forma de saber se o "dentro do teto" significa alguma coisa.
//     Uma proposta de verdade so diria "rodou"; esta diz "acertou".
//
//   node tools/prova_conferencia_proposta.js
// ============================================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const T = require(path.join(RAIZ, 'fpmed_teto_cmed.js'));   // O MOTOR DE VERDADE
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

async function pega(rota) {
  let out = [], off = 0;
  while (true) {
    const r = await fetch(`${SB}/rest/v1/${rota}&limit=1000&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + rota);
    const d = await r.json(); out = out.concat(d);
    if (d.length < 1000 || off > 30000) break;
    off += 1000;
  }
  return out;
}

(async () => {
  console.log('=== PROVA DA CONFERENCIA DE PROPOSTA CONTRA O TETO ===\n');

  console.log('lendo a tabela CMED do banco (a mesma que a tela le)...');
  const [teto, dicionario, vigArr] = await Promise.all([
    pega('cmed_teto?select=subst_norm,dose_key,apresentacoes,teto_min,teto_max,tem_cap'),
    pega('cmed_dicionario?select=marca_norm,substancia'),
    fetch(`${SB}/rest/v1/v_cmed_vigencia?select=*`, { headers: H }).then(r => r.json()),
  ]);
  const vig = vigArr[0] || {};
  console.log(`  ${teto.length.toLocaleString('pt-BR')} chaves de teto · ${dicionario.length.toLocaleString('pt-BR')} marcas no dicionario`);
  console.log(`  regua: CMED publicada em ${String(vig.vigente_desde || '').slice(0, 10)} (ha ${vig.dias_desde} dias)`);
  const IDX = T.indexar({ regua: [], teto, dicionario });

  /* ── A PROPOSTA DE TESTE, com gabarito ────────────────────────────────────────────────────
     >>> A 1a VERSAO DESTA PROVA MONTOU AS DESCRICOES DA CHAVE NORMALIZADA (`subst_norm` +
         `dose_key`), e so 3 de 12 casaram. O erro era da PROVA, nao do motor: chave normalizada
         nao e texto de proposta — ninguem escreve "DIPIRONASODICA 500MG/ML" numa planilha. Uma
         prova que alimenta o motor com um formato que ele nunca vai ver mede outra coisa.
         Agora as linhas saem da APRESENTACAO REAL da CMED, que e o texto que de fato aparece
         numa proposta de medicamento. */
  /* >>> E A 2a VERSAO CAIU TODA EM ASSOCIACOES ("A + B"), porque `offset=200` pega uma janela
         CONTIGUA da tabela, que esta em ordem alfabetica — 12 itens seguidos sao 12 variacoes do
         mesmo remedio. Associacao e o caso mais dificil de casar, entao a prova estava medindo o
         pior cenario e chamando de media.
         Agora a amostra e ESPALHADA pela tabela inteira (uma a cada N), que e o que se parece com
         uma proposta de verdade: remedios diferentes, de letras diferentes. */
  const apres = await pega('cmed_pf?select=subst_norm,apresentacao,dose_key&apresentacao=not.is.null&order=subst_norm');
  const porChave = new Map(teto.map(t => [t.subst_norm + '|' + t.dose_key, t]));
  const ALVO = 14;
  const passo = Math.max(1, Math.floor(apres.length / (ALVO * 6)));
  const amostra = [];
  for (let i = 0; i < apres.length && amostra.length < ALVO; i += passo) {
    const a = apres[i];
    const t = porChave.get(a.subst_norm + '|' + a.dose_key);
    if (!t || !(t.teto_min > 0.5)) continue;
    if (amostra.some(x => x.subst_norm === a.subst_norm)) continue;   // varia a substancia
    // A DESCRICAO E "SUBSTANCIA + APRESENTACAO", que e como o item aparece numa proposta real.
    amostra.push({ subst_norm: a.subst_norm, desc: (a.subst_norm + ' ' + a.apresentacao).replace(/\s+/g, ' ').trim(), t });
  }
  if (amostra.length < 6) { console.error('nao consegui montar a amostra a partir da CMED do banco.'); process.exit(1); }

  const brl = n => Number(n).toFixed(2).replace('.', ',');
  const linhas = [], gabarito = [];
  amostra.forEach((x, i) => {
    const abaixo = i % 2 === 0;
    // 20% abaixo do teto minimo, ou 60% acima do teto maximo — longe da fronteira de proposito:
    // a prova nao e sobre arredondamento, e sim sobre o veredito.
    const preco = abaixo ? x.t.teto_min * 0.8 : x.t.teto_max * 1.6;
    linhas.push(x.desc + '   ' + brl(preco));
    gabarito.push({ desc: x.desc, esperado: abaixo ? 'abaixo' : 'acima', preco, teto_min: x.t.teto_min, teto_max: x.t.teto_max });
  });
  // Uma linha que NAO e medicamento: tem que cair em "nao encontrado", e nao em "dentro do teto".
  linhas.push('LUVA DE PROCEDIMENTO NAO CIRURGICA TAMANHO M CAIXA COM 100   24,90');
  gabarito.push({ desc: 'LUVA DE PROCEDIMENTO', esperado: 'nao_encontrado' });

  const texto = linhas.join('\n');
  console.log(`\nproposta de teste: ${linhas.length} linhas (${gabarito.filter(g => g.esperado === 'abaixo').length} abaixo, `
    + `${gabarito.filter(g => g.esperado === 'acima').length} acima, 1 que nao e medicamento)`);

  // ── LE E AVALIA — pelo motor, exatamente como a tela faz ────────────────────────────────
  const itens = T.itensDoTexto(texto);
  const resultado = itens.map(it => Object.assign({}, it,
    T.avaliar({ descricao: it.descricao, precoUnit: it.precoUnit, unitario: true, paraGoverno: true }, IDX)));
  const res = T.resumir(resultado);

  console.log(`\n=== O VEREDITO ===`);
  console.log(`linhas lidas ........ ${res.total}`);
  console.log(`dentro do teto ...... ${res.ok}`);
  console.log(`ACIMA do teto ....... ${res.acima}`);
  console.log(`nao encontrados ..... ${res.naoEncontrados}`);
  console.log(`sem preco ........... ${res.semPreco}`);

  console.log('\n=== CONTRA O GABARITO ===');
  let acertos = 0, erros = [];
  resultado.forEach((r, i) => {
    const g = gabarito[i];
    if (!g) return;
    // "nao encontrado" quando se esperava um veredito de preco NAO conta como erro do motor: quer
    // dizer que a descricao sintetica nao casou. Isso e informacao, e aparece separado.
    if (g.esperado === 'nao_encontrado') { if (r.situacao === 'nao_encontrado') acertos++; else erros.push(`${g.desc} -> esperava nao_encontrado, veio ${r.situacao}`); return; }
    if (r.situacao === 'nao_encontrado') return;   // contado adiante
    if (r.situacao === g.esperado) acertos++;
    else erros.push(`${g.desc.slice(0, 50)} · preco ${brl(g.preco)} · teto ${brl(g.teto_min)}-${brl(g.teto_max)} -> esperava ${g.esperado}, veio ${r.situacao}`);
  });
  const naoCasou = resultado.filter((r, i) => gabarito[i] && gabarito[i].esperado !== 'nao_encontrado' && r.situacao === 'nao_encontrado').length;
  console.log(`acertos ............. ${acertos}`);
  console.log(`nao casaram ......... ${naoCasou}  (descricao sintetica; nao e erro de veredito)`);
  console.log(`ERROS DE VEREDITO ... ${erros.length}`);
  erros.forEach(e => console.log('   ' + e));

  console.log('\n=== ASSERTS ===');
  /* >>> O QUE ESTE ASSERT PROTEGE, E O QUE ELE NAO PROMETE. Ele nao e uma nota do motor: taxa de
         casamento depende de como o edital escreve, e "descricao da CMED contra indice da CMED"
         e o cenario mais favoravel que existe. O que ele impede e o unico desfecho que tornaria
         o resto da prova vazio — um motor que casa NADA passaria com "0 erros de veredito",
         porque nao teria emitido veredito nenhum. Por isso o piso e baixo e explicito. */
  const casaram = resultado.length - naoCasou - 1;
  console.log(`taxa de casamento ... ${casaram}/${gabarito.length - 1} (informacao, nao nota: ver comentario no codigo)`);
  ok('1. *** o motor casou o suficiente pra o veredito significar alguma coisa (>=4) ***',
    casaram >= 4, { casaram });
  ok('2. *** ZERO erros de veredito: quem estava acima veio acima, quem estava abaixo veio abaixo ***',
    erros.length === 0, { erros: erros.slice(0, 3) });
  ok('3. *** a linha que NAO e medicamento caiu em "nao encontrado", e nao em "dentro do teto" ***',
    resultado[resultado.length - 1].situacao === 'nao_encontrado', { veio: resultado[resultado.length - 1].situacao });
  ok('4. o resumo separa nao-encontrado de dentro-do-teto (somar seria a mentira do arquivo)',
    res.ok + res.acima + res.naoEncontrados + res.semPreco === res.total);
  ok('5. *** a regua tem data (senao o resultado e um numero sem prazo de validade) ***',
    !!vig.vigente_desde, { vig });
  ok('6. as funcoes de leitura vem do MOTOR, e nao de uma copia',
    typeof T.itensDoTexto === 'function' && typeof T.precoDaLinha === 'function');

  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('ERRO: ' + (e && e.message)); process.exit(1); });
