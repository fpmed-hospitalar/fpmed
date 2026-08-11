// ============================================================================================
// fechamento_mes.js — O FECHAMENTO MENSAL DA FPMED. Um comando, duas planilhas.
//
// ══ POR QUE DUAS, E POR QUE ELAS NAO PODEM SER A MESMA ══════════════════════════════════════
//   1. fechamento_interno_AAAA-MM.xlsx — o do Lemuel. Custo REAL da IA, custos fixos, preco de
//      repasse e LUCRO. E o papel que responde "esta dando dinheiro?".
//   2. fatura_fpmed_AAAA-MM.xlsx — o do cliente. SO os valores de repasse: o que ele paga.
//
// >>> A FATURA NAO PODE CONTER CUSTO NEM MARGEM NEM LUCRO. Nao e delicadeza: e a diferenca entre
//     um documento comercial e a planilha de custos da sua fornecedora. Uma linha de "custo real"
//     esquecida na aba errada e uma renegociacao de contrato. Por isso as duas planilhas sao
//     MONTADAS SEPARADAMENTE, a partir de listas diferentes — e nao uma copia da outra com
//     colunas escondidas. Coluna escondida em .xlsx nao esta escondida: esta a um clique.
//     A conferencia no fim do script LE O ARQUIVO GRAVADO e recusa entregar se achar palavra
//     proibida na fatura. Confiar no codigo que acabei de escrever nao e conferir.
//
// ══ DE ONDE VEM CADA NUMERO ═════════════════════════════════════════════════════════════════
//   · uso de IA .... `v_leituras_cobranca` — a MESMA view que a tela mostra. O repasse ja vem
//     calculado la (custo x (1+margem), arredondado pra cima no centavo), num lugar so.
//   · custos fixos . tabela `custos_fixos`, com vigencia. Assinatura que comecou dia 10 nao
//     custa o mes inteiro — mas rateio por dia e decisao comercial que ninguem tomou, entao
//     aqui ela entra INTEIRA e o relatorio DIZ desde quando vale. Inventar rateio seria pior.
//   · margem ....... `cobranca_config.margem_repasse`, tambem num lugar so.
//
// USO:
//   node tools/fechamento_mes.js                 -> mes corrente
//   node tools/fechamento_mes.js --mes 2026-08   -> um mes especifico
//   node tools/fechamento_mes.js --so-ver        -> so imprime, nao grava planilha
// ============================================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const XLSX = require(path.join(RAIZ, 'node_modules', 'xlsx'));
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = n => process.argv.includes(n);

// O mes de referencia. Sem `--mes`, o corrente — e o script DIZ qual usou, porque rodar o
// fechamento no dia 1o de setembro querendo agosto e o erro mais facil de cometer aqui.
const hoje = new Date();
const MES = arg('--mes') || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
if (!/^\d{4}-\d{2}$/.test(MES)) { console.error('use --mes AAAA-MM'); process.exit(1); }
const [ANO, M] = MES.split('-').map(Number);
const INI = new Date(Date.UTC(ANO, M - 1, 1));
const FIM = new Date(Date.UTC(ANO, M, 1));

const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d2 = v => Math.round(Number(v || 0) * 100) / 100;

async function pega(rota) {
  let out = [], off = 0;
  while (true) {
    const r = await fetch(`${SB}/rest/v1/${rota}&limit=1000&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + rota);
    const d = await r.json(); out = out.concat(d);
    if (d.length < 1000 || off > 30000) break;   // o PostgREST daqui pagina em 1000
    off += 1000;
  }
  return out;
}

const ROTULO_TAREFA = {
  resumo: 'Leitura de edital (resumo)',
  itens: 'Leitura de edital (tabela de itens)',
  juntar: 'Leitura de edital (juncao de partes)',
  'itens-ganhos': 'Leitura de resultado (itens ganhos)',
  'mapa-precos': 'Leitura de resultado (mapa de precos)',
};
const ROTULO_TIPO = {
  edital: 'Leitor de edital', 'pedido-proposta': 'Leitura de pedido (proposta)',
  'pedido-foto': 'Leitura de pedido (foto)',
};

(async () => {
  console.log(`=== FECHAMENTO DE ${MES} ===\n`);

  const [usos, fixos, cfg] = await Promise.all([
    pega(`v_leituras_cobranca?select=*&quando=gte.${INI.toISOString()}&quando=lt.${FIM.toISOString()}&order=quando.asc`),
    pega('custos_fixos?select=*&order=id.asc'),
    fetch(`${SB}/rest/v1/cobranca_config?select=margem_repasse&id=eq.1`, { headers: H }).then(r => r.json()),
  ]);
  const margem = Number((cfg[0] || {}).margem_repasse);
  if (!isFinite(margem)) { console.error('nao consegui ler a margem de repasse — abortando.'); process.exit(1); }

  // ── OS USOS DE IA ─────────────────────────────────────────────────────────────────────────
  // >>> LEITURA QUE FALHOU DEPOIS DE CONSUMIR TOKEN TAMBEM CUSTOU, e entra na conta. Cobrar do
  //     cliente por leitura que nao entregou nada e outra discussao — e uma DECISAO COMERCIAL,
  //     que nao e minha. Entao o relatorio SEPARA as duas e mostra o numero das duas formas.
  const okUsos = usos.filter(u => u.ok);
  const falhas = usos.filter(u => !u.ok);
  // >>> E O QUE NAO TEM CAMBIO NAO ENTRA NA SOMA EM REAL. Sem a cotacao do dia nao ha valor em
  //     R$ — inventar um cambio medio pra "fechar a conta" seria produzir um numero que ninguem
  //     consegue reproduzir. Elas aparecem contadas e listadas a parte.
  const semCambio = usos.filter(u => u.brl == null);
  const comCambio = usos.filter(u => u.brl != null);

  const custoIA = comCambio.reduce((s, u) => s + Number(u.brl || 0), 0);
  const custoIAok = comCambio.filter(u => u.ok).reduce((s, u) => s + Number(u.brl || 0), 0);
  const repasseTotal = comCambio.reduce((s, u) => s + Number(u.repasse_brl || 0), 0);
  const repasseOk = comCambio.filter(u => u.ok).reduce((s, u) => s + Number(u.repasse_brl || 0), 0);

  // ── OS CUSTOS FIXOS ───────────────────────────────────────────────────────────────────────
  // Vale no mes se comecou antes do fim do mes e nao terminou antes do comeco dele.
  const vigentes = fixos.filter(f => {
    const de = f.vigente_de ? new Date(f.vigente_de) : new Date(0);
    const ate = f.vigente_ate ? new Date(f.vigente_ate) : new Date('2999-12-31');
    return de < FIM && ate >= INI;
  });
  /* ══ O CAMBIO DOS CUSTOS FIXOS — E O DEFEITO QUE ESTA VERSAO CONSERTA ═════════════════════
     A 1a versao deste script recusava converter custo fixo em dolar sem `cambio` gravado na
     linha, pela regra certa ("numero que ninguem reproduz nao entra em fechamento"). O resultado,
     medido em 2026-08: os dois custos fixos (US$ 25 + US$ 10) viraram **R$ 0,00** e o relatorio
     imprimiu **LUCRO R$ 1,66**.
     Esse numero e falso. Com US$ 35 de assinatura o mes esta profundamente negativo — e o
     relatorio dizia o contrario, com o aviso de "sem valor" tres linhas acima, onde ninguem
     conecta os dois.
     >>> TRATAR "NAO SEI O CAMBIO" COMO "CUSTO ZERO" E EXATAMENTE O ERRO QUE ESTE PROJETO NAO
         ACEITA. Entao a regra mudou: converte com a cotacao DO DIA, buscada na hora, e DIZ que
         converteu e com qual taxa. Uma aproximacao anunciada e reproduzivel (a taxa esta escrita)
         vale mais que um zero silencioso. Se nem a cotacao vier, ai sim fica pendente — e o LUCRO
         passa a ser mostrado como INCOMPLETO, e nao como numero. */
  let cambioHoje = null;
  try {
    const rc = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL', { signal: AbortSignal.timeout(8000) });
    const v = parseFloat((await rc.json()).USDBRL.bid);
    if (isFinite(v) && v > 0) cambioHoje = v;
  } catch (e) { /* tratado abaixo: sem cotacao, o custo fica pendente e o lucro fica incompleto */ }

  const fixosComValor = vigentes.map(f => {
    const brlDireto = f.valor_brl != null ? Number(f.valor_brl) : null;
    const daLinha = (f.valor_usd != null && f.cambio != null) ? Number(f.valor_usd) * Number(f.cambio) : null;
    const doDia = (f.valor_usd != null && cambioHoje) ? Number(f.valor_usd) * cambioHoje : null;
    const brlFinal = brlDireto != null ? brlDireto : (daLinha != null ? daLinha : doDia);
    return {
      ...f, _brl: brlFinal, _pendente: brlFinal == null,
      // Qual taxa produziu o numero — e a informacao que torna a conta reproduzivel.
      _fonte: brlDireto != null ? 'valor em R$ cadastrado'
            : daLinha != null ? 'cambio cadastrado na linha (R$ ' + Number(f.cambio).toFixed(4) + ')'
            : doDia != null ? 'CONVERTIDO pela cotacao de hoje (R$ ' + cambioHoje.toFixed(4) + ')' : null,
      _aproximado: brlDireto == null && daLinha == null && doDia != null,
    };
  });
  const custoFixo = fixosComValor.reduce((s, f) => s + (f._brl || 0), 0);
  const fixosPendentes = fixosComValor.filter(f => f._pendente);
  const fixosAproximados = fixosComValor.filter(f => f._aproximado);

  // ── O RELATORIO NA TELA ───────────────────────────────────────────────────────────────────
  console.log(`margem de repasse ..... ${margem}%  (de cobranca_config, um lugar so)`);
  console.log(`\nUSO DE IA no mes`);
  console.log(`  leituras .............. ${usos.length}  (${okUsos.length} ok · ${falhas.length} falharam)`);
  const porTarefa = {};
  usos.forEach(u => { const k = u.tarefa || 'resumo'; porTarefa[k] = (porTarefa[k] || 0) + 1; });
  Object.entries(porTarefa).forEach(([k, n]) => console.log(`    ${String(ROTULO_TAREFA[k] || k).padEnd(42)} ${n}`));
  console.log(`  custo real (R$) ....... ${brl(custoIA)}   [so as ok: ${brl(custoIAok)}]`);
  console.log(`  repasse (R$) .......... ${brl(repasseTotal)}   [so as ok: ${brl(repasseOk)}]`);
  if (semCambio.length) console.log(`  ⚠️ ${semCambio.length} leitura(s) SEM cambio do dia — fora da soma em R$ (listadas na planilha)`);

  console.log(`\nCUSTOS FIXOS vigentes em ${MES}`);
  fixosComValor.forEach(f => console.log(`  ${String(f.descricao).padEnd(34)} `
    + (f._pendente ? 'SEM VALOR EM R$ (nao ha cambio nem cotacao)' : 'R$ ' + brl(f._brl).padStart(9))
    + `  · ${f._fonte || '—'}  · desde ${String(f.vigente_de).slice(0, 10)}`));
  if (!fixosComValor.length) console.log('  (nenhum)');
  console.log(`  total ................. R$ ${brl(custoFixo)}`);
  if (fixosAproximados.length) console.log(`  ℹ️ ${fixosAproximados.length} convertido(s) pela cotacao de hoje — a taxa esta escrita acima e na planilha`);
  if (fixosPendentes.length) console.log(`  ⚠️ ${fixosPendentes.length} custo(s) fixo(s) sem valor em R$ — NAO entraram no total`);

  const lucro = repasseTotal - custoIA - custoFixo;
  // >>> LUCRO COM CUSTO CONHECIDO DE FORA NAO E LUCRO, E UM NUMERO BONITO. Quando algo que se
  //     sabe que existe ficou fora da conta, o resultado deixa de ser apresentado como valor e
  //     passa a ser apresentado como INCOMPLETO — com o que falta dito na mesma linha. A versao
  //     anterior imprimia "LUCRO R$ 1,66" num mes com US$ 35 de assinatura fora da soma.
  const incompleto = fixosPendentes.length > 0 || semCambio.length > 0;
  console.log(`\nRESULTADO DO MES`);
  console.log(`  cobrado (repasse) ..... R$ ${brl(repasseTotal)}`);
  console.log(`  custo da IA ........... R$ ${brl(custoIA)}`);
  console.log(`  custos fixos .......... R$ ${brl(custoFixo)}`);
  console.log(`  ────────────────────────────────────`);
  if (incompleto) {
    console.log(`  LUCRO (INCOMPLETO) .... R$ ${brl(lucro)}` + (lucro < 0 ? '   ⚠️ NEGATIVO' : ''));
    console.log(`  ⚠️ ESTE NUMERO NAO ESTA FECHADO:`);
    if (fixosPendentes.length) console.log(`     · ${fixosPendentes.length} custo(s) fixo(s) ficaram de fora (${fixosPendentes.map(f => f.descricao).join(', ')})`);
    if (semCambio.length) console.log(`     · ${semCambio.length} leitura(s) sem cambio do dia ficaram de fora do custo`);
    console.log(`     Resolva isso antes de usar o lucro pra decidir qualquer coisa.`);
  } else {
    console.log(`  LUCRO ................. R$ ${brl(lucro)}` + (lucro < 0 ? '   ⚠️ NEGATIVO' : ''));
  }

  if (tem('--so-ver')) { console.log('\n--so-ver: nenhuma planilha gravada.'); return; }
  if (!usos.length && !fixosComValor.length) {
    console.log('\nNao ha nada a fechar neste mes — nenhuma planilha gravada.');
    return;
  }

  const destino = path.join(RAIZ, 'backups', 'fechamento');
  fs.mkdirSync(destino, { recursive: true });
  const quando = new Date().toLocaleString('pt-BR');

  // ══ 1. O FECHAMENTO INTERNO ════════════════════════════════════════════════════════════════
  const wbI = XLSX.utils.book_new();
  const resumoI = [
    ['FECHAMENTO INTERNO — FPMED', ''],
    ['Mes de referencia', MES],
    ['Gerado em', quando],
    ['Margem de repasse aplicada', margem + '%'],
    [],
    ['Cobrado do cliente (repasse)', d2(repasseTotal)],
    ['Custo real da IA', d2(custoIA)],
    ['Custos fixos', d2(custoFixo)],
    [incompleto ? 'LUCRO (INCOMPLETO — ver abaixo)' : 'LUCRO', d2(lucro)],
    ...(incompleto ? [
      ['ATENCAO: este lucro NAO esta fechado.'],
      ...(fixosPendentes.length ? [['  custos fixos fora da conta', fixosPendentes.map(f => f.descricao).join(' · ')]] : []),
      ...(semCambio.length ? [['  leituras sem cambio do dia (fora do custo)', semCambio.length]] : []),
    ] : []),
    ...(fixosAproximados.length ? [['Custos fixos convertidos pela cotacao de hoje', 'R$ ' + cambioHoje.toFixed(4) + '/US$']] : []),
    [],
    ['Leituras no mes', usos.length],
    ['  das quais falharam', falhas.length],
    ['  sem cambio do dia (fora da soma em R$)', semCambio.length],
  ];
  XLSX.utils.book_append_sheet(wbI, XLSX.utils.aoa_to_sheet(resumoI), 'Resumo');

  const detI = usos.map(u => ({
    'Data': new Date(u.quando).toLocaleString('pt-BR'),
    'Quem': String(u.email || '').split('@')[0],
    'Ferramenta': ROTULO_TIPO[u.tipo] || u.tipo,
    'O que foi lido': ROTULO_TAREFA[u.tarefa] || u.tarefa,
    'Documento': u.edital_titulo || '',
    'Partes': u.partes || 1,
    'Deu certo': u.ok ? 'sim' : 'NAO',
    'Erro': u.erro || '',
    'Tokens entrada': u.tokens_entrada, 'Tokens saida': u.tokens_saida,
    'Custo US$': u.usd, 'Cambio': u.cambio,
    'Custo R$': u.brl, 'Repasse R$': u.repasse_brl,
    'Lucro R$': (u.brl != null && u.repasse_brl != null) ? d2(u.repasse_brl - u.brl) : null,
  }));
  const wsDetI = XLSX.utils.json_to_sheet(detI.length ? detI : [{ 'Data': '(nenhuma leitura no mes)' }]);
  wsDetI['!cols'] = [{ wch: 17 }, { wch: 12 }, { wch: 20 }, { wch: 34 }, { wch: 40 }, { wch: 7 }, { wch: 9 }, { wch: 34 }, { wch: 14 }, { wch: 12 }, { wch: 11 }, { wch: 9 }, { wch: 10 }, { wch: 11 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wbI, wsDetI, 'Uso de IA');

  const fixI = fixosComValor.map(f => ({
    'Descricao': f.descricao, 'Valor US$': f.valor_usd, 'Cambio': f.cambio,
    'Valor R$': f._brl, 'Vigente desde': String(f.vigente_de).slice(0, 10),
    'Vigente ate': f.vigente_ate ? String(f.vigente_ate).slice(0, 10) : '(sem fim)',
    'Observacao': f.observacao || '',
    'De onde saiu o valor em R$': f._fonte || '',
    'Situacao': f._pendente ? 'SEM VALOR EM R$ — nao entrou no total'
              : f._aproximado ? 'convertido pela cotacao de hoje (aproximado)' : '',
  }));
  XLSX.utils.book_append_sheet(wbI, XLSX.utils.json_to_sheet(fixI.length ? fixI : [{ 'Descricao': '(nenhum)' }]), 'Custos fixos');
  const arqInterno = path.join(destino, `fechamento_interno_${MES}.xlsx`);
  XLSX.writeFile(wbI, arqInterno);

  // ══ 2. A FATURA DO CLIENTE ═════════════════════════════════════════════════════════════════
  // MONTADA DO ZERO, e nao a partir da interna. O que nao e escrito aqui nao existe no arquivo —
  // e e assim que se garante que custo e margem nao vazam: nao por esconder, por nao colocar.
  const wbF = XLSX.utils.book_new();
  // >>> A FATURA COBRA SO O QUE DEU CERTO. Cobrar leitura que nao entregou nada seria uma
  //     decisao comercial que ninguem tomou — e o relatorio interno mostra a diferenca, pro
  //     Lemuel decidir depois se quer cobrar.
  // >>> E NAO COBRA LEITURA DE TESTE. A 1a rodada deste script, com os dados reais de agosto,
  //     produziu uma fatura com "LINHA DE TESTE DA RLS" e "PROVA DO CONSERTO" dentro — as minhas
  //     proprias leituras de prova, cobradas do cliente. O custo delas foi REAL (a Anthropic
  //     cobrou), entao elas continuam no fechamento interno; o que nao pode e ir pra fatura.
  //     A marca e a coluna `teste`, posta A MAO. Adivinhar pelo titulo seria pior: um edital que
  //     por acaso se chamasse "teste_hospital.pdf" sairia de graca, e ninguem notaria.
  const cobravel = comCambio.filter(u => u.ok && !u.teste);
  const testes = comCambio.filter(u => u.ok && u.teste);
  const totalFatura = cobravel.reduce((s, u) => s + Number(u.repasse_brl || 0), 0);
  const capaF = [
    ['FATURA — SERVICOS DE INTELIGENCIA ARTIFICIAL', ''],
    ['Mes de referencia', MES],
    ['Emitida em', quando],
    [],
    ['Leituras realizadas', cobravel.length],
    ['VALOR TOTAL (R$)', d2(totalFatura)],
    [],
    ['Cada leitura de documento com IA e cobrada por uso.'],
    ['O detalhamento por leitura esta na aba "Detalhamento".'],
  ];
  XLSX.utils.book_append_sheet(wbF, XLSX.utils.aoa_to_sheet(capaF), 'Fatura');

  const detF = cobravel.map(u => ({
    'Data': new Date(u.quando).toLocaleString('pt-BR'),
    'Usuario': String(u.email || '').split('@')[0],
    'Servico': ROTULO_TAREFA[u.tarefa] || ROTULO_TIPO[u.tipo] || 'Leitura com IA',
    'Documento': u.edital_titulo || '',
    'Paginas': u.paginas || '',
    'Valor R$': u.repasse_brl,
  }));
  const wsDetF = XLSX.utils.json_to_sheet(detF.length ? detF : [{ 'Data': '(nenhuma leitura cobravel no mes)' }]);
  wsDetF['!cols'] = [{ wch: 17 }, { wch: 14 }, { wch: 38 }, { wch: 44 }, { wch: 9 }, { wch: 12 }];
  if (detF.length) XLSX.utils.sheet_add_aoa(wsDetF, [[], ['', '', '', '', 'TOTAL', d2(totalFatura)]], { origin: -1 });
  XLSX.utils.book_append_sheet(wbF, wsDetF, 'Detalhamento');
  const arqFatura = path.join(destino, `fatura_fpmed_${MES}.xlsx`);
  XLSX.writeFile(wbF, arqFatura);

  // ══ 3. A CONFERENCIA — LENDO O ARQUIVO GRAVADO ═════════════════════════════════════════════
  // >>> ELA LE O .XLSX DO DISCO, e nao as variaveis daqui. O que se quer provar e sobre o
  //     ARQUIVO que vai pro cliente — e o codigo que acabei de escrever e justamente a coisa em
  //     que nao se pode confiar pra conferir a si mesmo.
  const lido = XLSX.readFile(arqFatura);
  const textoFatura = lido.SheetNames.map(n => XLSX.utils.sheet_to_csv(lido.Sheets[n])).join('\n').toLowerCase();
  const PROIBIDAS = ['custo', 'margem', 'lucro', 'us$', 'usd', 'cambio', 'câmbio', 'token', 'anthropic', 'haiku'];
  const achadas = PROIBIDAS.filter(p => textoFatura.includes(p));
  console.log('\n=== CONFERENCIA DA FATURA (lendo o arquivo gravado) ===');
  if (achadas.length) {
    console.log('  ⛔ A FATURA CONTEM PALAVRA QUE NAO PODE SAIR: ' + achadas.join(', '));
    console.log('     O arquivo foi gravado, mas NAO ENVIE. Isto e vazamento de custo/margem pro cliente.');
    try { fs.renameSync(arqFatura, arqFatura.replace('.xlsx', '_NAO_ENVIAR.xlsx')); } catch (e) { }
    process.exitCode = 1;
  } else {
    console.log('  ✓ nenhuma palavra de custo, margem, lucro, cambio ou token na fatura');
  }
  // E a soma da fatura tem que bater com o repasse das leituras cobraveis (ok e nao-teste).
  const repasseCobravel = cobravel.reduce((s, u) => s + Number(u.repasse_brl || 0), 0);
  const bate = Math.abs(totalFatura - repasseCobravel) < 0.005;
  console.log('  ' + (bate ? '✓' : '⛔') + ` total da fatura R$ ${brl(totalFatura)} x repasse cobravel R$ ${brl(repasseCobravel)}`);
  if (!bate) process.exitCode = 1;
  if (testes.length) console.log(`  ✓ ${testes.length} leitura(s) de teste ficaram FORA da fatura (e dentro do fechamento interno)`);

  /* ── O AVISO DE LEITURA QUE PARECE TESTE ─────────────────────────────────────────────────
     Ele NAO exclui nada — so aponta. Excluir por palavra no titulo seria deixar de faturar um
     edital de verdade que por acaso tem "prova" ou "teste" no nome, e ninguem notaria: a fatura
     sairia menor e parecendo certa.
     O que ele faz e o que da pra fazer sem decidir no lugar de ninguem: mostrar as suspeitas e o
     comando exato pra marcar, se for o caso. */
  const SUSPEITO = /teste|prova|rls|demo|sandbox/i;
  const suspeitas = cobravel.filter(u => SUSPEITO.test(String(u.edital_titulo || '')));
  if (suspeitas.length) {
    console.log(`\n  ⚠️ ${suspeitas.length} leitura(s) NA FATURA tem cara de teste — CONFIRA antes de enviar:`);
    suspeitas.forEach(u => console.log(`     nº ${u.id} · ${String(u.edital_titulo || '').slice(0, 56)} · R$ ${brl(u.repasse_brl)}`));
    console.log(`     Se forem teste mesmo, marque assim (e rode o fechamento de novo):`);
    console.log(`     update public.usos_ia set teste = true where id in (${suspeitas.map(u => u.id).join(',')});`);
    console.log(`     >>> Eu NAO marco sozinho: excluir da fatura por palavra no titulo deixaria de`);
    console.log(`         faturar um edital de verdade chamado "prova_de_conceito.pdf" sem ninguem ver.`);
  }

  console.log(`\ngravados em backups/fechamento/ (gitignored):`);
  console.log(`  ${path.basename(arqInterno)}`);
  console.log(`  ${path.basename(arqFatura)}`);
})().catch(e => { console.error('ERRO: ' + (e && e.message)); process.exit(1); });
