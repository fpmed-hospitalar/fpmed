/* ════════════════════════════════════════════════════════════════════════════════════════════
   SUITE testa_vai_embora — A CATRACA DA LISTA DA MANHÃ (fatia B32, 20/08/2026)

   A tela responde UMA pergunta: *"o que morre primeiro se eu não fizer nada hoje?"*. E o defeito
   desta fatia tem uma forma que nenhuma outra tem nesta casa: **ele não quebra nada.** Uma lista
   de urgência com uma linha a menos continua bonita, continua rápida, continua verde — e o
   sintoma é uma ata que venceu.

   ══ AS CINCO PROMESSAS QUE ESTA SUÍTE GUARDA ═════════════════════════════════════════════════

   1. **ESTA TELA NÃO REDEFINE O QUE É "VENCENDO".** Ela pergunta a cada módulo: a certidão traz a
      `situacao` já decidida pelo cofre (com o `dias_aviso` de cada documento, B27), a ata traz a
      `situacao` já decidida pela `v_atas_vigencia` (corte de 60 dias, B30). Um corte próprio aqui
      faria a MESMA ata sair "vencendo" na aba Ata e sumir da lista da manhã — duas telas
      discordando sobre o mesmo contrato, que é o defeito que a `v_documentos_situacao` existe
      para evitar. A ÚNICA janela que nasce nesta fatia é a da licitação, e o critério dela está
      publicado (30 dias, e o porquê).

   2. **NADA AQUI É ESTIMATIVA.** Linha sem data NÃO APARECE — e o rodapé diz quantas ficaram de
      fora e por quê. Lista de urgência com item chutado ensina a ignorar a lista, e uma lista de
      urgência ignorada é pior que nenhuma: ela ocupa o lugar da que funcionaria.

   3. **A ORDEM É ÚNICA E O COMPARADOR É TOTAL.** É a lição da B28 — `sort()` sem comparador dá
      número errado, calado, com cara de certo. Aqui o empate tem desempate declarado, senão a
      lista se reorganiza sozinha entre dois carregamentos do mesmo dia e alguém clica na linha
      errada.

   4. **VAZIO É VITÓRIA, E TEM QUE PARECER.** Esta é a única tela desta casa em que a boa notícia
      e o defeito têm a MESMA cara: um espaço calmo. "Nada vencendo" e "eu não consegui olhar"
      precisam ser visualmente impossíveis de confundir.

   5. **A CONTA DE DIAS ESTÁ ESCRITA DUAS VEZES NESTA CASA**, aqui e no `fpmed_ata_saldo.js`, de
      propósito (a lista da manhã não depende da aba Ata estar carregada). Duas implementações da
      mesma regra é o par que um dia diverge — e no dia em que divergirem, a MESMA ata sai com
      dois prazos diferentes em duas telas. Esta suíte mede as duas, uma contra a outra, sobre o
      intervalo inteiro em que os cortes decidem.

     node tests/testa_vai_embora.js
   ════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { semComentario } = require('../tools/regua_visual.js');
const RAIZ = path.join(__dirname, '..');
const R = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');

const NEG_BRUTO = R('fpmed_negocios.html');
const NEG = semComentario(NEG_BRUTO);
const MOTOR = semComentario(R('fpmed_vai_embora.js'));
const MOTOR_BRUTO = R('fpmed_vai_embora.js');
const SW = R('sw.js');
const V = require('../fpmed_vai_embora.js');
const SALDO = require('../fpmed_ata_saldo.js');

/* O PEDAÇO DA TELA QUE É DESTA FATIA. Recorte, e não o arquivo inteiro: cobrar do arquivo todo
   daria vermelho sobre código de outra fatia, que é a forma mais rápida de uma catraca ser
   desligada. */
const ini = NEG.indexOf('let VE = null');
const fim = NEG.indexOf('function _aoAutenticar()');
const TRECHO = (ini >= 0 && fim > ini) ? NEG.slice(ini, fim) : '';
// O CSS mora longe do script, e as promessas do desenho são cobradas nele — não no JS.
const cssI = NEG_BRUTO.indexOf('.ve-cx{');
const cssF = NEG_BRUTO.indexOf('/* ── PROPOSTA ANEXADA ── */');
const CSS = (cssI >= 0 && cssF > cssI) ? NEG_BRUTO.slice(cssI, cssF) : '';
/* ══ E A REGRA DA COR É COBRADA SEM OS COMENTÁRIOS, POR UM MOTIVO MEDIDO ═════════════════════
   A `muta_b32` acendeu esta suíte com uma mudança LEGÍTIMA: um comentário que diz *"nada de #hex
   nem rgba() aqui"*. A palavra `rgba()` dentro da explicação virava vermelho, e o conserto teria
   sido **apagar a explicação** — que é a causa da próxima geração do mesmo defeito. É a mesma
   lição que a `muta_b29` cobrou, e a mesma que reescreveu um assert da `testa_ata_saldo` na B31:
   **cobrar o LUGAR, nunca a PALAVRA.** A regra continua exata; só deixou de ler prosa. */
const CSS_SEM_PROSA = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
// E o esqueleto nasce no HTML, antes de qualquer fetch.
const htmlI = NEG_BRUTO.indexOf('<div id="vai-embora"');
const HTML = htmlI >= 0 ? NEG_BRUTO.slice(htmlI, htmlI + 700) : '';

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + '. ' + t + (e !== undefined ? '  [' + JSON.stringify(e).slice(0, 320) + ']' : '')); } n++; };
console.log('SUITE testa_vai_embora — o que morre primeiro se eu nao fizer nada hoje\n');

const HOJE = '2026-08-20';
// As fontes no formato EXATO em que o banco as devolve — `v_documentos_situacao`,
// `v_atas_vigencia` e os negócios vivos do funil. Inventar um formato mais limpo aqui seria
// provar o motor contra um banco que não existe.
const CERT = (id, validade, situacao, extra) => Object.assign({
  id: id, nome: 'CND ' + id, tipo: 'certidão', orgao_emissor: 'Receita Federal',
  validade: validade, situacao: situacao }, extra || {});
const ATA = (id, fim2, situacao, extra) => Object.assign({
  id: id, titulo: 'ata ' + id, orgao: 'Município', municipio: 'Jataí', uf: 'GO', numero: '9/2026',
  ata_vigencia_fim: fim2, situacao: situacao, valor_ganho: 1000, itens_com_saldo: 0,
  arquivado_em: null }, extra || {});
const LIC = (id, prazo, extra) => Object.assign({
  id: id, titulo: 'pregão ' + id, orgao: 'Município', municipio: 'Jataí', uf: 'GO',
  estagio: 'analise', valor_estimado: 5000, prazo: prazo }, extra || {});

// ── 1. ESTA TELA NÃO REDEFINE O QUE É "VENCENDO" ────────────────────────────────────────────
console.log('\n-- 1. o corte nao nasce aqui: ele e perguntado a cada modulo --');
{
  /* A CERTIDÃO QUE VENCE EM 40 DIAS: o cofre pode dizer que ela está `vencendo` (alvará com
     `dias_aviso` de 60) ou `vigente` (CND com aviso de 30). O motor tem de OBEDECER às duas —
     se ele tivesse um corte próprio, uma das duas sairia errada, e seria sempre a mesma. */
  const longe = '2026-09-29'; // 40 dias
  const a = V.juntar({ certidoes: [CERT(1, longe, 'vencendo')], atas: [], licitacoes: [] }, HOJE);
  const b = V.juntar({ certidoes: [CERT(2, longe, 'vigente')], atas: [], licitacoes: [] }, HOJE);
  ok('*** a certidao que o COFRE chamou de vencendo entra, mesmo faltando 40 dias ***',
    a.linhas.length === 1 && a.linhas[0].dias === 40, a.linhas);
  ok('*** e a MESMA data, que o cofre chamou de vigente, NAO entra ***',
    b.linhas.length === 0, b.linhas);
  ok('o vencido entra e sai marcado como vencido',
    V.juntar({ certidoes: [CERT(3, '2026-08-01', 'vencido')], atas: [], licitacoes: [] }, HOJE)
      .linhas[0].vencido === true);
  ok('a certidao vigente nao entra',
    V.juntar({ certidoes: [CERT(4, '2027-08-01', 'vigente')], atas: [], licitacoes: [] }, HOJE)
      .linhas.length === 0);
}
{
  const a = V.juntar({ certidoes: [], atas: [ATA(9, '2026-10-01', 'vencendo')], licitacoes: [] }, HOJE);
  const b = V.juntar({ certidoes: [], atas: [ATA(9, '2026-10-01', 'vigente')], licitacoes: [] }, HOJE);
  ok('*** a ata obedece a `situacao` da v_atas_vigencia, e nao a um corte desta tela ***',
    a.linhas.length === 1 && b.linhas.length === 0);
  ok('a ata vencida entra marcada como vencida',
    V.juntar({ certidoes: [], atas: [ATA(9, '2026-07-01', 'vencida')], licitacoes: [] }, HOJE)
      .linhas[0].vencido === true);
}
ok('*** o motor NAO tem numero 60 nem `dias_aviso` proprios — ele so tem a janela da licitacao ***',
  !/\b60\b/.test(MOTOR) && !/dias_aviso/.test(MOTOR), (MOTOR.match(/\b60\b/) || [])[0]);
ok('a UNICA janela desta fatia e a da licitacao, e ela e uma constante com nome',
  /var JANELA_LICITACAO = 30;/.test(MOTOR) && V.JANELA_LICITACAO === 30);
ok('*** e o criterio do recorte esta PUBLICADO no proprio arquivo (numero com recorte publica o criterio) ***',
  /POR QUE 30 E NÃO OS 60 DA ATA/.test(MOTOR_BRUTO));

// ── 2. NADA AQUI É ESTIMATIVA ───────────────────────────────────────────────────────────────
console.log('\n-- 2. sem data a linha nao aparece, e o rodape conta --');
{
  const r = V.juntar({
    certidoes: [CERT(1, null, 'sem_validade'), CERT(2, '2026-08-25', 'vencendo')],
    atas: [ATA(9, null, 'sem_vigencia'), ATA(10, '2026-09-10', 'vencendo')],
    licitacoes: [LIC(20, null), LIC(21, '2026-08-30')],
  }, HOJE);
  ok('*** a certidao sem validade NAO vira uma linha ***', r.contagem.certidao === 1);
  ok('*** a ata sem validade NAO vira uma linha ***', r.contagem.ata === 1);
  ok('*** a licitacao sem data NAO vira uma linha ***', r.contagem.licitacao === 1);
  ok('e as tres ficam contadas no rodape, uma a uma',
    r.divida.certidaoSemValidade === 1 && r.divida.ataSemValidade === 1 && r.divida.licitacaoSemData === 1,
    r.divida);
  const fr = V.frasesDaDivida(r.divida);
  ok('*** o rodape sai com NUMERO, e nao com "algumas" ***',
    fr.length === 3 && fr.every(s => /^\d+ /.test(s)), fr);
  ok('a frase da ata explica por que sem data nao da pra saber quem morre primeiro',
    /sem a data não há como saber se ela morre primeiro/.test(fr.join(' ')));
  ok('*** e a da certidao diz que sem data NAO e "nao vence": e "ninguem digitou" ***',
    /não é "não vence": é "ninguém digitou"/.test(fr.join(' ')), fr);
}
{
  // ROD APÉ VAZIO É RODAPÉ QUE NÃO NASCE. "0 atas fora desta lista" é ruído com cara de aviso.
  const r = V.juntar({ certidoes: [], atas: [], licitacoes: [] }, HOJE);
  ok('sem divida, o rodape nao nasce (nada de "0 atas fora desta lista")',
    V.frasesDaDivida(r.divida).length === 0);
}
{
  /* A LICITAÇÃO QUE JÁ PASSOU NÃO ENTRA — não há o que propor. Mas ela também NÃO SOME: silêncio
     por corte é o que faz um número parecer completo. */
  const r = V.juntar({ certidoes: [], atas: [], licitacoes: [LIC(20, '2026-08-14')] }, HOJE);
  ok('*** a licitacao que ja passou nao entra na lista ***', r.linhas.length === 0);
  ok('mas o rodape a conta, com o verbo do que aconteceu', r.divida.licitacaoJaPassou === 1);
  ok('e a frase avisa que um negocio parado na Disputa parou no meio',
    /parou no meio/.test(V.frasesDaDivida(r.divida).join(' ')));
}
{
  const r = V.juntar({ certidoes: [], atas: [], licitacoes: [LIC(20, '2026-09-19'), LIC(21, '2026-09-20')] }, HOJE);
  ok('*** a licitacao a 30 dias entra, e a de 31 nao ***',
    r.linhas.length === 1 && r.linhas[0].id === 20, r.linhas.map(x => x.id + ':' + x.dias));
}

// ── 3. A ORDEM É ÚNICA, E O COMPARADOR É TOTAL ──────────────────────────────────────────────
console.log('\n-- 3. quem morre primeiro, e o empate tem desempate declarado --');
{
  const r = V.juntar({
    certidoes: [CERT(1, '2026-08-27', 'vencendo')],                 // 7 dias
    atas: [ATA(9, '2026-08-22', 'vencendo')],                       // 2 dias
    licitacoes: [LIC(20, '2026-08-21')],                            // 1 dia
  }, HOJE);
  ok('*** a lista sai ordenada por quem morre primeiro, sem separar por tipo ***',
    r.linhas.map(x => x.fonte).join(',') === 'licitacao,ata,certidao', r.linhas.map(x => x.fonte));
  ok('o vencido vem antes de tudo (dias negativos)',
    V.juntar({ certidoes: [CERT(1, '2026-08-10', 'vencido')], atas: [], licitacoes: [LIC(20, '2026-08-21')] }, HOJE)
      .linhas[0].fonte === 'certidao');
}
{
  /* O EMPATE. Três coisas morrendo no mesmo dia é o caso comum, não o raro — e é onde um
     comparador parcial deixa a lista se reorganizar sozinha entre dois carregamentos. */
  const mesmo = '2026-08-25';
  const f1 = { certidoes: [CERT(5, mesmo, 'vencendo')], atas: [ATA(9, mesmo, 'vencendo')],
               licitacoes: [LIC(2, mesmo)] };
  const f2 = { licitacoes: [LIC(2, mesmo)], atas: [ATA(9, mesmo, 'vencendo')],
               certidoes: [CERT(5, mesmo, 'vencendo')] };
  const a = V.juntar(f1, HOJE).linhas.map(x => x.fonte + ':' + x.id).join(',');
  const b = V.juntar(f2, HOJE).linhas.map(x => x.fonte + ':' + x.id).join(',');
  ok('*** empate no MESMO dia sai na MESMA ordem, venha a fonte na ordem que vier ***',
    a === b, [a, b]);
  ok('e o desempate declarado e certidao, depois ata, depois licitacao',
    a === 'certidao:5,ata:9,licitacao:2', a);
}
{
  // Empate dentro da MESMA fonte: desempata pelo id, senão duas atas do mesmo dia trocam de lugar.
  const mesmo = '2026-08-25';
  const a = V.juntar({ certidoes: [], licitacoes: [],
    atas: [ATA(88, mesmo, 'vencendo'), ATA(11, mesmo, 'vencendo')] }, HOJE);
  const b = V.juntar({ certidoes: [], licitacoes: [],
    atas: [ATA(11, mesmo, 'vencendo'), ATA(88, mesmo, 'vencendo')] }, HOJE);
  ok('*** duas atas do mesmo dia nao trocam de lugar entre dois carregamentos ***',
    a.linhas.map(x => x.id).join() === '11,88' && b.linhas.map(x => x.id).join() === '11,88',
    [a.linhas.map(x => x.id), b.linhas.map(x => x.id)]);
}
ok('*** o sort tem comparador (a licao da B28: sort() nu da numero errado, calado) ***',
  /linhas\.sort\(function \(a, b\)/.test(MOTOR));

// ── 4. CADA LINHA DIZ O QUE FAZER ───────────────────────────────────────────────────────────
console.log('\n-- 4. o verbo do negocio, um por linha --');
{
  const r = V.juntar({
    certidoes: [CERT(1, '2026-08-27', 'vencendo')],
    atas: [ATA(9, '2026-08-22', 'vencendo')],
    licitacoes: [LIC(20, '2026-08-21')],
  }, HOJE);
  const porFonte = {}; r.linhas.forEach(x => { porFonte[x.fonte] = x; });
  ok('certidao -> renovar', porFonte.certidao.verbo === 'renovar');
  ok('ata -> empenhar', porFonte.ata.verbo === 'empenhar');
  ok('licitacao -> propor', porFonte.licitacao.verbo === 'propor');
  ok('*** e cada linha traz a acao por extenso, nao so o que esta acontecendo ***',
    r.linhas.every(x => typeof x.acao === 'string' && x.acao.length > 10), r.linhas.map(x => x.acao));
  ok('o verbo e UM por linha (nada de "renovar/empenhar")',
    r.linhas.every(x => !/[\/,]/.test(x.verbo)));
}
console.log('\n-- 4b. a frase do prazo tem palavra propria pra hoje e amanha --');
ok('*** "vence HOJE" e nao "vence em 0 dias" ***',
  V.frase({ dias: 0, fonte: 'ata' }) === 'vence HOJE');
ok('a licitacao FECHA, ela nao vence', V.frase({ dias: 0, fonte: 'licitacao' }) === 'fecha HOJE');
ok('amanha tem palavra propria', V.frase({ dias: 1, fonte: 'ata' }) === 'vence amanhã');
ok('o singular do passado nao sai "1 dias"', V.frase({ dias: -1, fonte: 'ata' }) === 'venceu há 1 dia');
ok('e o plural do passado sai certo', V.frase({ dias: -3, fonte: 'ata' }) === 'venceu há 3 dias');

// ── 5. A ATA ARQUIVADA NÃO RESSUSCITA AQUI ──────────────────────────────────────────────────
console.log('\n-- 5. a ata que alguem decidiu arquivar nao volta por esta porta --');
{
  const r = V.juntar({ certidoes: [], licitacoes: [],
    atas: [ATA(9, '2026-08-22', 'vencendo', { arquivado_em: '2026-08-19T10:00:00Z' })] }, HOJE);
  ok('*** a ata com carimbo de arquivamento nao entra na lista da manha ***', r.linhas.length === 0);
  ok('e o rodape diz que ela ficou de fora porque ALGUEM decidiu', r.divida.ataArquivada === 1);
  ok('a frase da arquivada nao acusa falta de dado — ela credita a decisao',
    /alguém decidiu tirá-las da frente, com motivo|alguém decidiu tirá-la/.test(
      V.frasesDaDivida(r.divida).join(' ')), V.frasesDaDivida(r.divida));
}
ok('e o teste do arquivamento vem ANTES do teste da validade (arquivada sem data conta como arquivada)',
  MOTOR.indexOf('divida.ataArquivada++') < MOTOR.indexOf('divida.ataSemValidade++'));

// ── 6. O SALDO DA ATA MEDE O TAMANHO DA PERDA, E ZERO NÃO É ZERO ────────────────────────────
console.log('\n-- 6. a lei da casa: null e "nao informado", 0 e uma afirmacao --');
{
  const semItem = V.juntar({ certidoes: [], licitacoes: [],
    atas: [ATA(9, '2026-08-22', 'vencendo', { itens_com_saldo: 0 })] }, HOJE).linhas[0];
  const comItem = V.juntar({ certidoes: [], licitacoes: [],
    atas: [ATA(9, '2026-08-22', 'vencendo', { itens_com_saldo: 3 })] }, HOJE).linhas[0];
  ok('*** ata sem NENHUM item informado sai com `unidades: null`, e nunca 0 ***',
    semItem.unidades === null, semItem.unidades);
  ok('e a que tem tres itens informados sai com 3', comItem.unidades === 3);
  ok('*** a tela imprime "saldo nao informado" no lugar do zero ***',
    /saldo não informado/.test(TRECHO) && /x\.unidades \?/.test(TRECHO));
}

// ── 7. A CONTA DE DIAS, CONTRA A OUTRA IMPLEMENTAÇÃO DA MESMA REGRA ─────────────────────────
console.log('\n-- 7. dois motores, a mesma regra: o par que um dia diverge --');
{
  /* NÃO É FIXTURE MINHA. A B26 pagou por esta lição: *"um detector provado só contra exemplos que
     eu mesmo escrevi herda o meu engano inteiro, e herda em silêncio, com relatório verde."* Aqui
     o oráculo é o OUTRO motor desta casa — o `fpmed_ata_saldo.js`, cuja `vigencia()` já foi medida
     contra a aritmética de `date` do Postgres na B30 (400 pares, 0 divergências). Se as duas
     divergirem, a MESMA ata sai com dois prazos em duas telas, e ninguém sabe em qual acreditar. */
  let pares = 0, dif = 0, exemplo = null;
  const base = Date.UTC(2026, 7, 20);
  for (let dh = -3; dh <= 3; dh++) {
    const hoje = new Date(base + dh * 86400000).toISOString().slice(0, 10);
    for (let k = -400; k <= 400; k += 3) {
      const alvo = new Date(base + (dh + k) * 86400000).toISOString().slice(0, 10);
      const a = V.dias(alvo, hoje);
      const b = SALDO.vigencia(alvo, hoje).dias;
      pares++;
      if (a !== b) { dif++; if (!exemplo) exemplo = { hoje, alvo, vaiEmbora: a, ataSaldo: b }; }
    }
  }
  ok('*** ' + pares + ' pares de datas: as duas contas de dias desta casa NAO divergem ***',
    dif === 0, exemplo);
  ok('e o intervalo cobre virada de mes, de ano e o 29/02 de 2028',
    pares > 1800);
}
ok('a data com hora (o `timestamptz` do banco) e cortada em 10, e nao interpretada',
  V.dias('2026-08-25T03:00:00.000Z', HOJE) === 5);
ok('lixo no lugar da data vira null, e nao NaN', V.dias('em breve', HOJE) === null);
ok('data nula vira null', V.dias(null, HOJE) === null);
ok('*** o `T12:00:00` esta nos DOIS lados da subtracao (a folga de 12h contra qualquer fuso) ***',
  (MOTOR.match(/T12:00:00/g) || []).length === 2, (MOTOR.match(/T12:00:00/g) || []).length);
ok('*** e quem faz o trabalho e o Math.round, medido na B30 — nao o Math.floor ***',
  /Math\.round\(\(new Date\(f \+ 'T12:00:00'\)/.test(MOTOR) && !/Math\.floor/.test(MOTOR));

// ── 8. UMA FONTE QUE CAI NÃO APAGA AS OUTRAS ────────────────────────────────────────────────
console.log('\n-- 8. lista curta le-se como "pouca coisa vencendo" --');
/* ESTES DOIS ASSERTS NASCERAM DE MUTAÇÕES QUE ESCAPARAM. A suíte tinha ficado verde com o
   `<script>` do motor arrancado da tela e com a gaveta de arquivadas deixando de ser lida — dois
   defeitos que não levantam exceção: no primeiro a tela apaga o bloco inteiro (o `if(!V)`), no
   segundo o rodapé simplesmente para de contar as arquivadas. Nenhum dos dois grita. */
ok('*** a tela carrega o motor da lista da manha (sem o <script>, o bloco some calado) ***',
  /<script src="fpmed_vai_embora\.js"><\/script>/.test(NEG_BRUTO));
ok('*** a gaveta de arquivadas E LIDA — sem ela o rodape nunca sabe que elas existem ***',
  /le\('gaveta de atas arquivadas', 'v_atas_arquivadas/.test(TRECHO));
ok('e elas entram no `juntar` marcadas como sem vigencia, so para serem contadas e descartadas',
  /concat\(\(arq \|\| \[\]\)\.map\(a => Object\.assign\(\{ situacao: 'sem_vigencia' \}, a\)\)\)/.test(TRECHO));
ok('as tres leituras sao independentes, e a que falha e NOMEADA',
  /VE_FALHOU\.push\(\{ fonte: nome, erro: e\.message \}\)/.test(TRECHO));
ok('*** e a tela avisa QUAL fonte faltou, com o nome dela ***',
  /Faltou uma fonte:/.test(TRECHO) && /VE_FALHOU\.map\(f => f\.fonte\)\.join/.test(TRECHO));
ok('*** o aviso diz por que isso importa: lista curta le-se como pouca coisa vencendo ***',
  /lista curta lê-se como pouca coisa vencendo/.test(TRECHO));
ok('*** com as TRES caidas a tela nao finge calma — ela fica vermelha ***',
  /VE_FALHOU\.length >= 3/.test(TRECHO) && /Não consegui ler os prazos/.test(TRECHO));
ok('e ela nega explicitamente a leitura errada ("isto nao quer dizer que nao ha nada vencendo")',
  /não<\/b> quer dizer que não haja nada vencendo/.test(TRECHO));
ok('o `Promise.all` nao deixa uma leitura lenta segurar as outras',
  /await Promise\.all\(\[/.test(TRECHO));
ok('*** cada leitura tem o proprio try/catch — sem isso, um 500 derrubaria o Promise.all inteiro ***',
  /const le = async \(nome, url\) =>/.test(TRECHO) && /catch\(e\)\{ VE_FALHOU\.push/.test(TRECHO));

// ── 9. OS QUATRO ESTADOS, NA TELA ───────────────────────────────────────────────────────────
console.log('\n-- 9. carregando, vazio, erro e cheio --');
ok('*** CARREGANDO nasce no proprio HTML, antes de qualquer fetch ***',
  /<div id="vai-embora" class="ve-cx">/.test(HTML) && /fp-skeleton/.test(HTML));
ok('e o esqueleto NAO diz "nada vencendo" enquanto le — ele diz que esta lendo',
  /lendo os prazos/.test(HTML) && !/[Nn]ada vencendo/.test(HTML));
ok('*** VAZIO E VITORIA, e ele e VERDE, nao uma tela em branco ***',
  /class="ve-vazio"/.test(TRECHO) && /<b>Nada vencendo\.<\/b>/.test(TRECHO));
ok('*** e o vazio nao inventa um numero unico: ele diz os TRES horizontes verdadeiros ***',
  /Nenhuma certidão dentro do próprio aviso/.test(TRECHO)
  && /nenhuma ata vencendo\s+'\s*\+\s*'em 60 dias|em 60 dias/.test(TRECHO)
  && /V\.JANELA_LICITACAO/.test(TRECHO), TRECHO.slice(TRECHO.indexOf('ve-vazio'), TRECHO.indexOf('ve-vazio') + 420));
ok('o vazio ainda mostra o rodape da divida (vitoria com asterisco continua sendo asterisco)',
  TRECHO.indexOf('ve-vazio') > 0 && (TRECHO.match(/ve-divida/g) || []).length >= 2);
ok('ERRO tem cor propria e nao se parece com vazio',
  /vermelho-300/.test(TRECHO) && /vermelho-700/.test(TRECHO));
ok('CHEIO: o cabecalho diz quantas coisas tem prazo', /coisa\(s\) com prazo/.test(TRECHO));

// ── 10. O DESENHO ───────────────────────────────────────────────────────────────────────────
console.log('\n-- 10. o desenho: a cor nunca vai sozinha, e o numero e quem para o olho --');
ok('o CSS desta fatia existe e esta no arquivo', CSS.length > 400, CSS.length);
/* A BARRA É COBRADA DENTRO DA REGRA `.ve-l{`, e não em qualquer lugar do CSS. Medido pela
   `muta_b32`: `border-left:4px solid var(--cinza-400)` aparece DUAS vezes neste arquivo (a outra
   é de outra fatia, na linha 1345), e um assert solto no recorte inteiro ficava verde com a barra
   desta tela apagada. Assert que casa em qualquer lugar é assert que não sabe onde está o defeito. */
ok('*** a barra da esquerda repete o que o numero e a frase ja dizem (WCAG 1.4.1) ***',
  /\.ve-l\{[^}]*border-left:4px solid var\(--cinza-400\)/.test(CSS_SEM_PROSA)
  && /\.ve-l\.vencido\{border-left-color/.test(CSS_SEM_PROSA)
  && /\.ve-l\.perto\{border-left-color/.test(CSS_SEM_PROSA),
  (CSS_SEM_PROSA.match(/\.ve-l\{[^}]*\}/) || [])[0]);
ok('e o verbo, que e a acao, tambem nao depende de cor: ele e uma palavra',
  /\.ve-l \.verbo\{/.test(CSS) && /text-transform:uppercase/.test(CSS));
ok('*** ZERO hex e ZERO rgba() a mao neste CSS — so token do tema ***',
  !/#[0-9a-fA-F]{3,8}\b/.test(CSS_SEM_PROSA) && !/rgba?\(/.test(CSS_SEM_PROSA),
  (CSS_SEM_PROSA.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) || []).slice(0, 5));
ok('o numero de dias e tabular (coluna que nao dança entre linhas)',
  /\.ve-l \.dias\{[^}]*font-variant-numeric:tabular-nums/.test(CSS));
ok('*** e a linha inteira e um <button>, e nao uma <div> com onclick (teclado alcanca) ***',
  /<button class="ve-l /.test(TRECHO) && !/<div class="ve-l /.test(TRECHO));
ok('o icone do vazio e marcado aria-hidden (o texto ao lado ja diz tudo)',
  /class="ve-vazio"[\s\S]{0,200}aria-hidden="true"/.test(TRECHO));

// ── 11. O QUE ESTA TELA NÃO PODE FAZER ──────────────────────────────────────────────────────
console.log('\n-- 11. dado do A: le, nunca escreve --');
ok('*** a tabela `licitacoes` e do A: esta fatia so faz SELECT nela ***',
  /licitacoes\?id=in\./.test(TRECHO)
  && !/method\s*:\s*'(POST|PATCH|PUT|DELETE)'[\s\S]{0,200}licitacoes/.test(TRECHO));
ok('e o recorte da terceira fonte esta publicado: negocio VIVO do funil, fora da fase Ata',
  /const vivos = \(NEG \|\| \[\]\)\.filter\(n => !n\.arquivado && n\.estagio !== 'contrato'\)/.test(TRECHO));
ok('*** a linha diz DE ONDE veio a data (encerramento do PNCP x abertura da ficha) ***',
  /encerramento da proposta \(PNCP\)/.test(TRECHO) && /abertura da sessão \(ficha\)/.test(TRECHO));
ok('e o motor carrega essa procedencia ate a linha', /prazoOrigem: l\.prazo_origem/.test(MOTOR));
ok('*** a lista da manha espera o carregar() — senao nasce com duas fontes de tres, calada ***',
  /carregar\(\)\.then\(\(\) => \{[^}]*carregarVaiEmbora\(\)/.test(NEG));
ok('nenhum numero inventado: o motor nao tem `\\|\\| 0` em cima de dado do banco',
  !/\|\|\s*0\s*[,;)]/.test(MOTOR.replace(/num\(a\.itens_com_saldo\) \|\| null/g, ''))
  || !/(quantidade|valor|saldo|dias)[^\n]*\|\|\s*0/.test(MOTOR));

// ── 12. A CASCA ─────────────────────────────────────────────────────────────────────────────
console.log('\n-- 12. a casca --');
ok('*** o motor da lista da manha esta na casca do service worker ***',
  /'\.\/fpmed_vai_embora\.js'/.test(SW));
/* A VERSÃO É COBRADA COMO `>=`, NUNCA COMO IGUALDADE. O `sw.js` é o único arquivo que as duas
   janelas desta fábrica editam no mesmo dia: cobrar igualdade faria esta suíte ficar vermelha no
   instante em que a outra janela subisse a casca por um motivo dela. É a lição da B30 (miúdo). */
ok('*** e a versao foi bumpada para 89 ou mais (arquivo novo na lista sem bump nao chega em ninguem) ***',
  (Number((SW.match(/limedtec-fpmed-\d{4}-\d{2}-\d{2}-(\d+)/) || [])[1]) || 0) >= 89,
  (SW.match(/limedtec-fpmed-[\d-]+/) || [])[0]);
ok('e a casca explica em prosa por que os dois arquivos novos entraram',
  /fpmed_vai_embora\.js/.test(SW) && /FATIAS B31 e B32/.test(SW));

// ── 13. O MOTOR COBRA DE SI MESMO ───────────────────────────────────────────────────────────
console.log('\n-- 13. o motor cobra de si mesmo --');
ok('a conta mora no motor: a tela nao recalcula dias por conta propria',
  !/Date\.now\(\)\s*\)\s*\/\s*86400000/.test(TRECHO) && !/\/ 86400000/.test(TRECHO));
ok('*** a tela nao decide quem entra na lista: ela entrega as fontes e o motor junta ***',
  /V\.juntar\(\{/.test(TRECHO));
ok('a tela nao escreve a frase do prazo a mao', /V\.frase\(x\)/.test(TRECHO));
ok('nem o rodape da divida', /V\.frasesDaDivida\(d\)/.test(TRECHO));
ok('e o motor nao conhece DOM nenhum', !/document\.|window\.[a-z]/.test(MOTOR.replace(/typeof window !== 'undefined' \? window : globalThis/, '')));
ok('a tela sobrevive ao motor faltando (a casca velha de alguem)',
  /if\(!V\)\{ box\.innerHTML = ''; return; \}/.test(TRECHO));

/* O PREFIXO `RESULTADO:` NÃO É ENFEITE. O `tests/run_all.js` lê o placar de cada suíte com
   `/RESULTADO:\s*(\d+)\s*ok,\s*(\d+)\s*falha/` — suíte que imprime diferente é contada como ZERO
   e o total da casa fica bonito. Foi o que aconteceu com a `testa_ata_saldo.js`, e o defeito era
   assimétrico: quando ela falhava, o `run_all` gritava; quando passava, o placar sumia. */
console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
