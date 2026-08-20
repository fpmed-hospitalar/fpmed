// SUITE testa_itens_em_lote — encher `licitacao_itens` em lote e buscar por dentro dele
// (fatia A9, 14/08/2026).
//
// == POR QUE ELA EXISTE ========================================================
// A A8 mediu: "albumina" aparece 0 vezes nos 3.201 OBJETOS do indice. O objeto do
// PNCP e generico ("aquisicao de material medico-hospitalar"); o nome do produto
// mora na descricao do ITEM. Com 195 itens de UMA licitacao no banco, buscar por
// produto respondia "nao achei" sobre um pais que esta comprando.
//
// >>> O QUE ESTA SUITE PROTEGE, EM UMA FRASE CADA:
//     1. que a coleta em lote NAO escreva resultado — as colunas `resultado_*`
//        ficam fora do corpo do upsert de proposito, porque o que nao esta no
//        corpo nao entra no ON CONFLICT DO UPDATE. Se um dia entrarem com null,
//        uma varredura de itens APAGA os 192 resultados conferidos na A7, em
//        silencio e com cara de trabalho feito. E o defeito mais caro possivel
//        aqui, e o unico que nenhuma tela mostraria.
//     2. que a licitacao achada PELO ITEM sobreviva ao filtro de palavra da tela
//        — sem isso ela e trazida do banco e jogada fora na linha seguinte,
//        porque o objeto dela nao diz "albumina", que e exatamente o motivo de
//        ela precisar dos itens pra ser encontrada.
//     3. que o selo de cobertura exista e seja lido do banco. Enquanto a carga
//        anda, "nao achei" pode ser "ninguem compra" ou "ainda nao li os itens" —
//        e responder as duas com a mesma cara de certeza e um palpite fantasiado.
//
//   node tests/testa_itens_em_lote.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const L = R('tools', 'coleta_itens_lote.js');
const T = R('fpmed_licitacoes.html');
// o DDL da A34 entra na suite porque metade da promessa da busca por item mora nele agora
const D = R('ddl', 'busca_local.sql');
const semJs = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const Lc = semJs(L), Tc = semJs(T);

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_itens_em_lote — itens em lote e a busca por dentro deles (fatia A9)\n');

// ══════════ 1. O COLETOR NAO PODE APAGAR RESULTADO ══════════
/* O assert e sobre o CODIGO EXECUTAVEL (comentario removido), senao a propria explicacao de
   por que `resultado_*` nao entra faria a suite passar sozinha.
   >>> E ELE VEM COM CONTROLE POSITIVO, porque assert de AUSENCIA passa em arquivo vazio, em
       arquivo renomeado e em arquivo que alguem apagou pela metade — ou seja, ele fica verde
       justamente nos cenarios em que ninguem quer que ele fique. Primeiro se prova que o corpo
       do upsert existe e tem as colunas de item; so entao "e nao tem resultado" quer dizer algo. */
const CORPO = (Lc.match(/linhas\.push\(\{[\s\S]*?\n    \}\);/) || [''])[0];
ok(n + '. (controle) o corpo do upsert existe e monta as colunas do item',
  /numero_controle:/.test(CORPO) && /numero_item:/.test(CORPO)
  && /descricao:/.test(CORPO) && /valor_unitario_ref:/.test(CORPO), CORPO.slice(0, 60)); n++;
ok(n + '. *** o corpo do upsert NAO carrega nenhuma coluna resultado_* ***',
  !!CORPO && !/resultado_(vencedor|cnpj|valor_unit|quantidade|situacao|lido_em)\s*:/.test(CORPO),
  (CORPO.match(/resultado_\w+\s*:/g) || [])); n++;
ok(n + '. ...e o motivo esta escrito, com o numero (192) do que se perderia',
  /APAGARIA os 192 resultados/.test(L)); n++;
ok(n + '. *** o upsert diz o alvo do conflito (sem `on_conflict` o banco recusa com 23505) ***',
  /on_conflict=numero_controle,numero_item/.test(Lc)
  && /resolution=merge-duplicates/.test(Lc)); n++;
ok(n + '. e nao ha DELETE / TRUNCATE / DROP em lugar nenhum do coletor',
  !/\b(delete|truncate|drop)\b/i.test(Lc.replace(/https?:\/\/\S+/g, ''))); n++;

// ══════════ 2. A ORDEM DOS ALVOS: PRIMEIRO O QUE E MEU ══════════
ok(n + '. *** o funil vem antes das vivas ***',
  Lc.indexOf('alvosDoFunil') < Lc.indexOf('alvosVivos')); n++;
ok(n + '. o funil olha os DOIS caminhos (licitacao_id E numero_controle)',
  /licitacao_id,numero_controle/.test(Lc)
  && /numero_controle=in\./.test(Lc)); n++;
/* Prazo curto primeiro: rodada cortada no meio deixa de fora o que ainda da tempo amanha. */
ok(n + '. *** as vivas vem da que encerra ANTES pra que encerra depois ***',
  /data_encerramento=gte\.\$\{agora\}/.test(Lc.replace(/\s+/g, ''))
  || /order=data_encerramento\.asc/.test(Lc)); n++;
ok(n + '. ...e as 1.426 sem data de encerramento NAO entram como "vivas"',
  /inclui-sem-prazo/.test(Lc) && /alvosSemPrazo/.test(Lc)); n++;

// ══════════ 3. RETOMADA: O CARIMBO E NO BANCO ══════════
ok(n + '. *** a rodada marca o que leu em licitacoes.itens_lidos_em ***',
  /itens_lidos_em:/.test(Lc) && /itens_qtd:/.test(Lc)); n++;
ok(n + '. ...e a proxima rodada pula quem ja tem carimbo',
  /itens_lidos_em=is\.null/.test(Lc)); n++;
/* "Perguntei e o PNCP nao tem" e uma RESPOSTA. Sem grava-la, toda rodada futura pergunta de novo,
   pra sempre, contra um servico publico. */
ok(n + '. *** licitacao sem item publicado tambem ganha carimbo (itens_qtd = 0) ***',
  /carimba\(l,\s*0\)/.test(Lc)); n++;
/* Carimbar leitura truncada como completa e como se perde um edital grande sem ninguem ver. */
ok(n + '. *** leitura TRUNCADA nao ganha carimbo — ela volta na proxima rodada ***',
  /if\s*\(!r\.truncou\)\s*await carimba/.test(Lc)); n++;

// ══════════ 4. RITMO EDUCADO CONTRA SERVICO PUBLICO ══════════
/* Emprestado do coletor do indice, e nao copiado: uma segunda regua de "estou indo rapido demais"
   acabaria discordando da primeira, e as duas batem no MESMO portal publico. */
ok(n + '. *** backoff, breaker e rate-limit vem do coletor do indice, nao de copia ***',
  /require\('\.\/coleta_pncp\.js'\)/.test(Lc)
  && /criaBreaker/.test(Lc) && /criaRitmo/.test(Lc) && /esperaRateLimit/.test(Lc)); n++;
ok(n + '. 429 desacelera a rodada (nao conta como queda pro breaker)',
  /r\.status === 429/.test(Lc) && /ritmo\.freou\(\)/.test(Lc)); n++;
/* Achado da A6: o PNCP responde 404 quando o orgao nao anexou nada. Tratar como queda faria o
   caso MAIS COMUM abrir o breaker e derrubar a rodada inteira. */
ok(n + '. *** 404 e "nao ha", nao e falha — e nao abre o breaker ***',
  /r\.status === 404.*breaker\.ok\(\)/s.test(Lc)); n++;

// ══════════ 5. A TELA: QUEM CASOU NO ITEM SOBREVIVE AO FILTRO DE PALAVRA ══════════
/* ══ REAPONTADO NA FATIA A34 (20/08) — A PERGUNTA E A MESMA, QUEM AGREGA E QUE MUDOU ══════════
   O assert cobrava a URL crua (`licitacao_itens?select=numero_controle,numero_item,descricao`
   com `busca=wfts(pt_sem_acento)`), porque a tela pedia UMA LINHA POR ITEM e montava o mapa
   `numero_controle -> quantos` em JavaScript. Era essa agregacao no navegador que obrigava o
   teto de 400 — e o teto e o que a A34 matou.
   >>> ENTAO O ASSERT AGORA COBRA AS DUAS PONTAS, e nao so a de ca: que a tela chame a RPC e que
       a RPC exista no DDL com o MESMO tsvector (`pt_sem_acento`). Cobrar so a chamada deixaria
       passar uma RPC que casasse por outra regra — e regra de casamento trocada em silencio e o
       defeito que ninguem reclama, porque ninguem reclama do que nao apareceu. */
ok(n + '. *** a tela pergunta o termo aos itens pela RPC que agrega NO BANCO ***',
  /rpc\/itens_por_licitacao\?p_termo=/.test(Tc)
  && /create or replace function public\.itens_por_licitacao\(p_termo text\)/.test(D)
  && /websearch_to_tsquery\('public\.pt_sem_acento'/.test(D)); n++;
/* ESTE E O ASSERT QUE MAIS IMPORTA DA TELA. Sem esta linha o resultado por item e trazido do
   banco e descartado logo em seguida, porque o objeto nao casa — e a busca continua respondendo
   zero, so que com o dobro do trabalho. */
ok(n + '. *** e a licitacao que casou no ITEM passa pelo filtro de palavra ***',
  /return !!\(porItem && porItem\.has\(_numCtrl\(l\)\)\);/.test(Tc)); n++;
ok(n + '. ...mas o refino e a exclusao continuam valendo antes dela',
  (function () {
    const m = Tc.match(/const casa = l => \{[\s\S]*?\n  \};/);
    if (!m) return false;
    const c = m[0];
    return c.indexOf('excl.some') < c.indexOf('porItem.has')
        && c.indexOf('casaRefino') < c.indexOf('porItem.has');
  })()); n++;
ok(n + '. *** o cartao MOSTRA a descricao que casou, e nao so um selo mudo ***',
  /class="etq doitem"/.test(Tc) && /'item: “'/.test(Tc)); n++;
ok(n + '. ...com o tamanho do casamento (1 item em 500 nao e 180 em 195)',
  /m\.n > 1 \? ' \+' \+ \(m\.n - 1\)/.test(Tc)); n++;
ok(n + '. a etiqueta nova usa TOKEN do tema, sem hex a mao',
  /\.etq\.doitem\{background:var\(--roxo-50\);color:var\(--roxo-700\)\}/.test(T)); n++;

// ══════════ 6. O SELO DE COBERTURA NAO MENTE ══════════
ok(n + '. *** a cobertura e CONTADA no banco (nao ha numero escrito a mao) ***',
  /contar\('licitacoes\?itens_lidos_em=not\.is\.null'\)/.test(Tc)
  && /contar\('licitacoes'\)/.test(Tc)); n++;
ok(n + '. ...e a tela escreve "itens carregados de X de Y licitacoes"',
  /itens carregados de \$\{cobertura\.comItens/.test(Tc)); n++;
ok(n + '. ...dizendo que a carga ainda anda enquanto X < Y',
  /a carga ainda está andando/.test(Tc)); n++;
/* ══ O TETO DE 400 MORREU NA A34, E O AVISO NAO MORREU JUNTO ═════════════════════════════════
   Medido antes de matar: "seringa" tinha 2.585 itens casados e a tela lia 400; "dipirona", 556 e
   lia 400. A agregacao passou para o banco e a resposta virou UMA LINHA POR LICITACAO, entao o
   teto deixou de ser necessario em vez de ser aumentado.
   >>> MAS O `_itensTruncou` CONTINUA, e o assert cobra isso de proposito: sobrou o teto de 1.000
       do PostgREST, que e outra conversa e muito mais rara. Apagar o aviso junto com a causa
       deixaria a tela muda no dia em que a causa voltasse por outra porta — e a tela ficaria
       muda exatamente como ficou em 11/08. */
ok(n + '. *** e o teto que sobrou (o do PostgREST) se DECLARA quando morde ***',
  /_itensTruncou/.test(Tc) && /const TETO_LIC_ITENS = 1000;/.test(Tc)
  && /parou no teto de \$\{TETO_LIC_ITENS\} licitações por termo/.test(Tc)
  && /linhas\.length >= TETO_LIC_ITENS/.test(Tc)); n++;
/* As CONTAGENS da tela continuam vindo do servidor, pelo `content-range`, sem baixar linha: e o
   que impede um numero lido de meia base de se apresentar como total. O assert casava numa linha
   so e o `contar()` passou a ocupar duas — entao ele olha as duas. */
ok(n + '. ...e as contagens continuam vindo do content-range, nao das linhas lidas',
  /content-range[\s\S]{0,120}split\('\/'\)\[1\]/.test(Tc)
  && /Prefer.{0,4}: 'count=exact'/.test(Tc)); n++;
/* Termo vem de campo de texto e pode ter virgula, aspas ou parentese — os tres caracteres que
   quebram a sintaxe do `or=()` do PostgREST. */
ok(n + '. uma chamada por termo, sem montar `or=()` com entrada de gente',
  !/or=\(busca\./.test(Tc)); n++;

// ══════════ 7. A CHAVE DO PNCP DEIXA DE SE PERDER NA PONTE PRO FUNIL ══════════
/* MEDIDO em 14/08: `negocios.numero_controle` e `negocios.licitacao_id` estavam NULOS nas 2.561
   linhas. Sem a chave, nada volta do negocio pro edital: as portas `--meus-negocios` das duas
   coletas encontravam ZERO alvos, e o contrato com o Negocios (A5) diz que a ligacao e por
   `numero_controle`. */
ok(n + '. *** "Mandar pro funil" grava o numero_controle do PNCP ***',
  /numero_controle: l\.numeroControlePNCP \|\| null/.test(Tc)); n++;
ok(n + '. ...e o licitacao_id quando a licitacao esta no nosso indice',
  /licitacao_id: licId/.test(Tc)
  && /numero_controle=eq\.`\s*\n?\s*\+ encodeURIComponent\(l\.numeroControlePNCP\)/.test(Tc)); n++;
ok(n + '. ...e o motivo (a licitacao ao vivo nao tem id) esta escrito',
  /Gravar só o id perderia a licitação ao vivo/.test(T)); n++;

// ══════════ 8. O `<b>` QUE A TELA IMPRIMIA COMO TEXTO ══════════
/* A string da procedencia passa por `esc()` no render — e com razao, ela carrega numeros e datas
   montados em cinco lugares. O `<b>` que morava nela era desenhado literalmente na tela. */
ok(n + '. *** a procedencia nao carrega markup (ela e escapada, e virava texto na tela) ***',
  !/<b>fora da janela de datas<\/b>/.test(Tc)
  && /FORA DA JANELA DE DATAS/.test(Tc)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
