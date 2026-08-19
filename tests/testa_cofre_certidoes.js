// SUITE testa_cofre_certidoes — O COFRE GANHOU VERSAO, E O PASSADO PRECISA CONTINUAR INTEIRO.
//
// Fatia B25, 19/08/2026 — primeiro item da ordem de obra aprovada pelo dono.
//
// O QUE ESTA SUITE PROTEGE, E POR QUE CADA UMA:
//   1. SUBSTITUIR NAO E EDITAR. Editar diz "eu errei o que estava escrito"; substituir diz
//      "aquela certidao valeu ate aqui, esta vale daqui". A CND que valia NO DIA DA SESSAO e a
//      que habilita: se em outubro o orgao pedir a certidao valida em agosto e o cofre so tiver
//      a mais recente, a empresa perde um recurso que ela ganharia.
//   2. A MIGRACAO E ADITIVA DE VERDADE. Tres `add column if not exists` e a view recriada com as
//      colunas antigas nas MESMAS posicoes. `create or replace view` recusa qualquer outra
//      coisa, e a alternativa seria `drop view` — que e o que a regra da casa proibe.
//   3. ESTADO HONESTO. "Sem validade" nao pode virar "em dia", e nao pode dizer "nao vence":
//      a tela nao sabe se o documento nao vence ou se alguem esqueceu de digitar a data.
//   4. O PAINEL FECHA A CONTA. Os quatro estados somam o total. Antes desta fatia os sem
//      validade eram contados numa variavel que ninguem lia — diferenca sem nome no painel.
//   5. A ORDEM DAS DUAS GRAVACOES. Nasce a nova, depois a velha sai. A falha no meio deixa DUAS
//      vias visiveis (feio e consertavel) em vez de ZERO (invisivel e perigoso).
//
//   node tests/testa_cofre_certidoes.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');
const semC = s => s.replace(/--[^\n]*/g, '');

const tela = ler('fpmed_documentos.html');
const ddl  = semC(ler('ddl/documentos_versao.sql'));
const base = semC(ler('ddl/documentos.sql'));

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_cofre_certidoes — a versao nova, e o passado que continua inteiro\n');

/* AS FUNCOES SAO ARRANCADAS DA TELA, e nao recopiadas: uma copia aqui envelheceria em silencio
   e esta suite passaria a atestar um codigo que nao esta mais rodando em lugar nenhum. */
const pega = re => (tela.match(re) || [])[0] || '';
const API = new Function(
  pega(/function contaSituacoes\(docs\)\{[\s\S]*?\n\}/) + '\n'
  + pega(/const caminhoNaUrl = [^\n]*\n/) + '\n'
  + pega(/const esc = [^\n]*\n/) + '\n'
  + pega(/const jsq = [^\n]*\n/) + '\n'
  + 'return { contaSituacoes, caminhoNaUrl, jsq };')();

// ══════════ 1. A MIGRACAO E ADITIVA ══════════
ok(n + '. as tres colunas entram com `if not exists` (seguro re-rodar)',
  ['substitui_id', 'versao', 'substituido_em']
    .every(c => new RegExp('add column if not exists ' + c).test(ddl))); n++;
ok(n + '. *** nada de `drop` nesta migracao (nem view, nem coluna, nem tabela) ***',
  !/\bdrop\s+(view|column|table)\b/i.test(ddl), (ddl.match(/\bdrop\s+\w+/gi) || [])); n++;
/* >>> ESTE ASSERT E O QUE IMPEDE A MIGRACAO DE DEIXAR DE SER ADITIVA SEM NINGUEM PERCEBER.
       `create or replace view` recusa mudanca de nome OU DE POSICAO nas colunas que ja existiam.
       Um `select d.*` aqui cuspiria as tres novas ANTES de `dias_para_vencer`, o comando falharia
       com "cannot change name of view column", e o conserto obvio (e errado) seria `drop view`. */
ok(n + '. *** a view lista as colunas a mao, sem `d.*` (e o que a mantem aditiva) ***',
  /create or replace view public\.v_documentos_situacao/.test(ddl) && !/select d\.\*/.test(ddl)); n++;
{
  const corpo = (ddl.match(/create or replace view public\.v_documentos_situacao[\s\S]*?from public\.documentos/) || [''])[0];
  const iSit = corpo.indexOf('as situacao'), iNovas = corpo.indexOf('d.substitui_id, d.versao, d.substituido_em');
  ok(n + '. ...e as tres novas vem DEPOIS de dias_para_vencer e situacao',
    iSit > 0 && iNovas > iSit, [iSit, iNovas]); n++;
}
ok(n + '. *** `versao` nasce em 1 com piso conferido (toda linha ja existente e a primeira dela) ***',
  /versao integer not null default 1 check \(versao >= 1\)/.test(ddl)); n++;
/* O ponteiro aponta para TRAS de proposito: um ponteiro para frente teria de ser reescrito na
   linha ANTIGA a cada substituicao, ou seja um UPDATE numa linha que ja e historico. Historico
   que muda nao e historico. */
ok(n + '. *** `substitui_id` aponta para tras (a nova conhece a velha, e nao o contrario) ***',
  /substitui_id bigint references public\.documentos\(id\)/.test(ddl)
  && !/substituido_por/.test(ddl)); n++;
ok(n + '. a corrente e indexada (o historico e lido por documento e por versao)',
  /documentos_substitui_idx/.test(ddl) && /documentos_versao_idx/.test(ddl)); n++;
ok(n + '. e o PostgREST e avisado do esquema novo (a pegadinha do cache)',
  /notify pgrst, 'reload schema'/.test(ddl)); n++;

// ══════════ 2. A VIEW DO HISTORICO ══════════
ok(n + '. *** existe a view que enxerga quem ja saiu de cena ***',
  /create or replace view public\.v_documentos_historico/.test(ddl)); n++;
{
  const h = (ddl.match(/create or replace view public\.v_documentos_historico[\s\S]*?;/) || [''])[0];
  /* ELA E O OPOSTO DA OUTRA, e e por isso que e uma view separada em vez de um parametro: a da
     tela responde "o que vale hoje", esta responde "o que valeu". Se ela filtrasse `ativo`, o
     historico simplesmente nao existiria — a versao substituida sumiria de todo mundo. */
  ok(n + '. *** ...e ela NAO filtra `ativo` (senao nao haveria historico nenhum) ***',
    !!h && !/where d\.ativo/.test(h), h.slice(-80)); n++;
  ok(n + '. ...e ela herda a RLS de quem consulta, como a outra',
    /security_invoker = on/.test(h)); n++;
}
ok(n + '. *** o `anon` e revogado nas DUAS views (a do historico ve tudo que a empresa ja teve) ***',
  /revoke all on public\.v_documentos_historico from anon/.test(ddl)
  && /revoke all on public\.v_documentos_situacao\s+from anon/.test(ddl)); n++;
ok(n + '. e a base continua com a RLS que ja tinha (escrever e de gestor)',
  /doc_ins[\s\S]{0,90}cargo_gestor\(\)/.test(base) && /doc_upd[\s\S]{0,120}cargo_gestor\(\)/.test(base)); n++;

// ══════════ 3. O TIPO VIROU LISTA ══════════
{
  const sel = (tela.match(/<select id="f-tipo"[\s\S]*?<\/select>/) || [''])[0];
  ok(n + '. *** o tipo e uma LISTA, e nao mais campo livre ***', !!sel, 'nao achei o <select id=f-tipo>'); n++;
  /* Campo livre num agrupador e como a mesma certidao vira tres ("CND federal", "cnd Federal",
     "Certidao Negativa Federal"): o filtro por tipo passa a mentir e quem confere a habilitacao
     acha que falta um documento que esta ali. */
  const exigidos = ['CND Federal', 'CND Estadual', 'CND Municipal', 'FGTS', 'Trabalhista',
    'Contrato Social', 'Balanço', 'Atestado de Capacidade Técnica', 'Alvará',
    'Licença Sanitária', 'AFE'];
  const faltando = exigidos.filter(t => !sel.includes(t));
  ok(n + '. *** os onze tipos que o dono listou estao la ***', faltando.length === 0, faltando); n++;
  /* A VALVULA E DECLARADA: lista fechada num pais que inventa exigencia de habilitacao toda
     semana viraria a tela recusando um documento real. */
  ok(n + '. ...e termina em "outro", com campo aberto (a valvula declarada)',
    /value="__outro"/.test(sel) && /id="f-tipo-outro"/.test(tela)); n++;
  ok(n + '. *** e um tipo GRAVADO fora da lista nao some ao substituir (cai em "outro") ***',
    /function poeTipo\(valor\)/.test(tela) && /s\.value = '__outro'; o\.value = v;/.test(tela)); n++;
}

// ══════════ 4. ESTADO HONESTO ══════════
/* "SEM VALIDADE" dizia que o documento nao vence — uma PROMESSA que esta tela nao tem como
   cumprir, porque ela nao distingue contrato social (que de fato nao vence) de CND que alguem
   esqueceu de datar. O que ela sabe dizer e o que acontece: ninguem vai ser avisado. */
ok(n + '. *** o rotulo diz "VALIDADE NAO INFORMADA", e nao "sem validade" ***',
  /sem_validade:'VALIDADE NÃO INFORMADA'/.test(tela)); n++;
/* >>> E ELE OLHA O CODIGO SEM OS COMENTARIOS, DE PROPOSITO. A primeira versao deste assert
       reprovava por causa da PROSA que explica por que a promessa saiu — o mesmo defeito que o B
       achou quatro vezes na regua do A na fatia B22: instrumento que confunde o registro com o
       registrado cobra mais de quem explica mais. Numa casa onde o porque escrito e lei, esse
       defeito nao erra o numero: ele ensina a parar de escrever o porque. */
const semProsa = tela.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
                     .replace(/(^|\s)\/\/[^\n]*/g, '$1');
ok(n + '. *** e a tela nao promete mais "nao vence" em lugar nenhum ***',
  !/não vence/.test(semProsa),
  (semProsa.match(/[^\n]*não vence[^\n]*/g) || []).slice(0, 3)); n++;
ok(n + '. ...e a frase do cartao diz a CONSEQUENCIA (ele nao avisa ninguem)',
  /validade não informada — este documento não avisa ninguém/.test(tela)); n++;
ok(n + '. e o formulario avisa disso ANTES, no campo',
  /em branco = validade não informada/.test(tela)); n++;

// ══════════ 5. O PAINEL FECHA A CONTA ══════════
ok(n + '. *** o quinto contador (sem validade informada) esta no painel ***',
  /regua sem_validade/.test(tela) && /sem validade informada/.test(tela)); n++;
ok(n + '. ...e ele nao e verde (verde e promessa, e aqui a promessa seria falsa)',
  /\.regua\.sem_validade b\{color:var\(--muted\)\}/.test(tela)); n++;
{
  /* A CONTA E PURA, e por isso da pra rodar aqui e pra conferir contra o banco na prova. Ela
     estava embutida no meio do `pinta()`, cercada de innerHTML: so era possivel conferi-la
     abrindo a tela e olhando. */
  const c = API.contaSituacoes([{ situacao: 'ok' }, { situacao: 'ok' }, { situacao: 'vencido' },
                                { situacao: 'sem_validade' }]);
  ok(n + '. *** a conta do painel e uma funcao pura, testavel sem abrir a tela ***',
    c.ok === 2 && c.vencido === 1 && c.sem_validade === 1 && c.vencendo === 0, c); n++;
  /* AUSENCIA NAO E A MESMA COISA QUE ZERO. Se as chaves nascessem do dado, um estado sem nenhum
     documento sumiria do painel — e "0 vencidos" e a resposta mais importante que a tela da. */
  const vazio = API.contaSituacoes([]);
  ok(n + '. *** com o cofre vazio, os quatro contadores mostram ZERO — nao somem ***',
    Object.keys(vazio).length === 4 && Object.values(vazio).every(v => v === 0), vazio); n++;
  const soma = Object.values(c).reduce((a, b) => a + b, 0);
  ok(n + '. *** e os quatro fecham com o total (nenhum documento fica sem contador) ***',
    soma === 4, soma); n++;
  ok(n + '. lista nula nao quebra a conta (o painel nasce antes do dado chegar)',
    API.contaSituacoes(null).ok === 0); n++;
}

// ══════════ 6. SUBSTITUIR, E A ORDEM DAS DUAS GRAVACOES ══════════
{
  const salvar = (tela.match(/async function salvar\(\)\{[\s\S]*?\n\}/) || [''])[0];
  ok(n + '. a gravacao leva `substitui_id` e `versao`',
    /substitui_id: velho \? velho\.id : null/.test(salvar) && /versao: velho \? \(velho\.versao \|\| 1\) \+ 1 : 1/.test(salvar)); n++;
  /* ══ A ORDEM E A DECISAO, E ELA TEM UM LADO SEGURO ═══════════════════════════════════════
     Se a rede cair entre as duas chamadas: nesta ordem sobram DUAS vias do mesmo documento —
     feio, visivel na hora, consertavel com um clique. Na ordem inversa sobrariam ZERO: a
     certidao que valia teria saido da lista e a nova nunca teria nascido, e o painel diria
     "3 em dia" com uma certidao a menos. Entre o defeito que grita e o que se esconde,
     escolhe-se o que grita. */
  const iPost = salvar.indexOf("rest/v1/documentos`, {method:'POST'");
  const iPatch = salvar.indexOf("method:'PATCH'");
  ok(n + '. *** a versao nova NASCE antes de a velha sair de cena (o lado seguro da falha) ***',
    iPost > 0 && iPatch > iPost, [iPost, iPatch]); n++;
  ok(n + '. *** a velha nao e apagada: fica `ativo=false` com a data de quando saiu ***',
    /ativo:false, substituido_em:new Date\(\)\.toISOString\(\)/.test(salvar)
    && !/method:'DELETE'/.test(tela)); n++;
  /* Se a segunda chamada falhar, a versao nova JA ESTA GRAVADA. Dizer "nao consegui salvar" ali
     seria mentira, e a pessoa mandaria de novo — criando uma terceira via. */
  ok(n + '. *** a falha no meio conta a verdade (a nova foi gravada, a velha nao saiu) ***',
    /a versão nova foi gravada, mas a anterior NÃO saiu da lista/.test(salvar)); n++;
}
{
  const abrir = (tela.match(/function abrirSubstituicao\(id\)\{[\s\S]*?\n\}/) || [''])[0];
  /* HERDAR A VALIDADE ANTIGA SERIA O PIOR DEFEITO POSSIVEL AQUI: a versao nova nasceria com a
     data da velha e a tela diria "em dia" sobre um papel que ninguem conferiu. */
  ok(n + '. *** a substituicao NAO herda validade, emissao, numero nem arquivo ***',
    /\['f-numero','f-emissao','f-validade','f-arq'\]\.forEach/.test(abrir), abrir.slice(0, 60)); n++;
  ok(n + '. ...mas herda o que IDENTIFICA o documento (nome, tipo, orgao, dias de aviso)',
    /f-nome'\)\.value\s*=\s*d\.nome/.test(abrir) && /poeTipo\(d\.tipo\)/.test(abrir)
    && /f-orgao'\)\.value\s*=\s*d\.orgao_emissor/.test(abrir) && /f-aviso'\)\.value/.test(abrir)); n++;
  ok(n + '. e o formulario AVISA que aquilo e uma substituicao, nao um documento novo',
    /aviso-subst/.test(tela) && /Substituindo a <b>versão/.test(abrir)); n++;
}
/* Sair do formulario tem de apagar a substituicao pendente: deixa-la de pe faria o proximo
   "+ Novo documento" aposentar em silencio um documento que ninguem mandou aposentar. */
ok(n + '. *** fechar o formulario zera a substituicao pendente ***',
  /function fecharForm\(\)\{[\s\S]*?SUBSTITUINDO = null;[\s\S]*?\n\}/.test(tela)); n++;

// ══════════ 7. O HISTORICO NA TELA ══════════
{
  const hist = (tela.match(/async function carregaHistorico\(id\)\{[\s\S]*?\n\}/) || [''])[0];
  ok(n + '. *** o historico le a view do historico (a da tela nao enxerga quem saiu) ***',
    /v_documentos_historico/.test(hist)); n++;
  /* `substitui_id` e uma coluna, e coluna aceita ciclo. Um ciclo aqui travaria a aba inteira do
     navegador em silencio — a tela toda, por causa de um clique num botao de historico. */
  ok(n + '. *** a caminhada pela corrente tem trava de ciclo (senao trava a aba) ***',
    /const vistos = new Set\(\)/.test(hist) && /!vistos\.has\(atual\.substitui_id\)/.test(hist)); n++;
  ok(n + '. *** falha de leitura NAO vira "sem versoes anteriores" ***',
    /não consegui ler o histórico/.test(hist)); n++;
  ok(n + '. ...e o "tentar de novo" rele sem fechar a gaveta (abrir e ler sao duas coisas)',
    /carregaHistorico\(/.test(tela) && /function verHistorico\(id\)\{[\s\S]*?carregaHistorico\(id\);/.test(tela)); n++;
  ok(n + '. a contagem de versoes anteriores vem do BANCO, nao de uma segunda conta na tela',
    /versoes_anteriores/.test(ddl) && /Number\(d\.versoes_anteriores \|\| 0\)/.test(tela)); n++;
}
/* O botao do historico abre a via ANTIGA, que por definicao nao esta na lista `DOCS`. Procurar
   por id ali devolveria `undefined` e o botao nao faria nada, em silencio — a versao invisivel
   do "botao que nao faz nada". */
ok(n + '. *** o "abrir arquivo" recebe o CAMINHO, e nao o id (a via antiga nao esta em DOCS) ***',
  /async function abrirArquivo\(caminho\)\{/.test(tela)); n++;

// ══════════ 8. O CAMINHO DO ARQUIVO NA URL ══════════
/* MEDIDO EM 19/08 no cofre de verdade, com um arquivo em pasta:
     encodeURIComponent(caminho inteiro) -> assinar 200 (com %2F dentro), BAIXAR 400.
   O `salvar()` de hoje nao cria pasta, entao o defeito estava DORMINDO — ele acordaria no dia em
   que alguem organizasse o cofre por empresa ou por ano, e aí TODA certidao pareceria perdida. */
ok(n + '. *** o caminho e escapado por PEDACO (encodeURIComponent escaparia a barra) ***',
  /const caminhoNaUrl = p => String\(p==null\?'':p\)\.split\('\/'\)\.map\(encodeURIComponent\)\.join\('\/'\)/.test(tela)); n++;
// AS DUAS PORTAS SAO `/object/` (subir) e `/object/sign/` (assinar). Consertar so uma deixaria
// o arquivo subindo com um nome e sendo procurado com outro — pior que nao consertar nenhuma.
ok(n + '. ...e ele e usado nas duas portas do cofre (subir e assinar)',
  /object\/documentos\/\$\{caminhoNaUrl\(path\)\}/.test(tela)
  && /object\/sign\/documentos\/\$\{caminhoNaUrl\(caminho\)\}/.test(tela)
  && !/documentos\/\$\{encodeURIComponent/.test(tela),
  (tela.match(/storage\/v1\/object[^`]*/g) || [])); n++;
ok(n + '. *** e ele preserva a barra e escapa o resto (o red test do defeito) ***',
  API.caminhoNaUrl('a b/c#d.pdf') === 'a%20b/c%23d.pdf'
  && API.caminhoNaUrl('x/y/z.pdf') === 'x/y/z.pdf'
  && encodeURIComponent('x/y/z.pdf') !== API.caminhoNaUrl('x/y/z.pdf'),
  API.caminhoNaUrl('a b/c#d.pdf')); n++;
/* O caminho vai DENTRO de um `onclick`, ou seja dentro de uma string JavaScript que esta dentro
   de um atributo HTML. Sao dois escapes, nao um — e depender da lavagem de nome feita em OUTRA
   funcao, cem linhas acima, e a forma de defeito que sobrevive a toda revisao. */
ok(n + '. *** o caminho no `onclick` escapa aspa simples E barra invertida ***',
  API.jsq("o'brien\\x.pdf") === "o\\'brien\\\\x.pdf", API.jsq("o'brien\\x.pdf")); n++;
ok(n + '. ...e o `jsq` e o que os dois botoes de abrir arquivo usam',
  (tela.match(/abrirArquivo\(\\'\s*'\+jsq\(/g) || []).length >= 2,
  (tela.match(/abrirArquivo\([^)]*\)/g) || []).slice(0, 4)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
