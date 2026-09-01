// O QUE MORREU ENQUANTO NINGUÉM OLHOU — fatia B40, 01/09/2026.
//
// ══ POR QUE ESTA FERRAMENTA EXISTE ═════════════════════════════════════════════════════════════
// A tela da B32 responde *"o que morre primeiro se eu não fizer nada hoje?"*. Ela ficou ONZE DIAS
// sem ninguém abrir — a caixa do trabalhador B ficou parada de 21/08 a 01/09 — e o relógio não
// parou junto. A caixa da rodada 13 pediu a conta dessa parada, e ela é a única fatia desta
// rodada que não é código novo: é uma pergunta ao passado.
//
// >>> ELA NÃO REIMPLEMENTA NADA. O que decide "vencendo" é o `fpmed_vai_embora.js`, o mesmo
//     arquivo que a tela carrega, carregado aqui do mesmo jeito. Se eu reescrevesse a regra aqui,
//     o relatório responderia sobre a MINHA régua e não sobre a tela — e é a tela que o dono abre.
//
// >>> E ELA LÊ BACKUP, NÃO O BANCO, POR DUAS RAZÕES E AS DUAS SÃO BOAS: (1) o `anon` leva 401 em
//     `negocios` e `licitacoes` (a RLS está certa) e eu não tenho o crachá do dono; (2) o banco só
//     sabe HOJE. A pergunta "o que morreu no intervalo" precisa dos dois instantes, e os dois
//     instantes existem no disco: os backups guardam as VIEWS já materializadas, com a `situacao`
//     que elas devolviam NAQUELE dia. É o único lugar da casa que tem o passado.
//
//   node tools/vai_embora_entre_backups.js [pasta_antes] [pasta_depois]
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const BK = path.join(raiz, 'backups');

const arg2 = process.argv.slice(2);
const escolhe = () => {
  const pastas = fs.readdirSync(BK).filter(n => /^backup_\d{4}-\d{2}-\d{2}_\d{4}$/.test(n)).sort();
  if (pastas.length < 2) throw new Error('preciso de dois backups em backups/; achei ' + pastas.length);
  return [pastas[pastas.length - 2], pastas[pastas.length - 1]];
};
const [ANTES, DEPOIS] = arg2.length >= 2 ? arg2 : escolhe();

const le = (pasta, arq) => {
  const p = path.join(BK, pasta, arq);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};
// o dia do backup, tirado do NOME da pasta — é ele que vira o "hoje" da simulação
const diaDe = (pasta) => (pasta.match(/(\d{4}-\d{2}-\d{2})/) || [, null])[1];

// o motor da tela, carregado como a tela o carrega
const win = {};
new Function('window', 'module', fs.readFileSync(path.join(raiz, 'fpmed_vai_embora.js'), 'utf8'))(win, undefined);
const V = win.FPMED_VAI_EMBORA;
if (!V || typeof V.juntar !== 'function') { console.log('não consegui carregar o fpmed_vai_embora.js'); process.exit(2); }

/* AS TRÊS FONTES, MONTADAS COMO A TELA MONTA (fpmed_negocios.html, `carregarVaiEmbora`).
   O recorte da terceira é o da tela e está publicado lá: negócio VIVO (não arquivado) fora da
   fase `contrato`. Mudar esse recorte aqui faria o relatório falar de uma lista que ninguém vê. */
function fontesDe(pasta) {
  const cert = (le(pasta, 'v_documentos_situacao.json') || [])
    .filter(d => d.situacao === 'vencido' || d.situacao === 'vencendo');
  const atas = le(pasta, 'v_atas_vigencia.json') || [];
  const arqu = le(pasta, 'v_atas_arquivadas.json') || [];
  const neg = le(pasta, 'negocios.json') || [];
  const vivos = neg.filter(n => !n.arquivado && n.estagio !== 'contrato');
  /* A DATA DO ÍNDICE NÃO É LIDA AQUI, e isso está declarado em vez de escondido: ela viria de
     `licitacoes.data_encerramento`, e a tela mediu em 20/08 que NENHUM negócio vivo tem certame
     amarrado — então as datas vêm todas da ficha, e o ramo do índice não muda nada hoje. Se um
     dia amarrarem, este relatório passa a divergir da tela, e é por isso que ele CONTA quantos
     vivos têm `licitacao_id`: para o dia em que deixar de ser zero não passar despercebido. */
  const comCertame = vivos.filter(n => n.licitacao_id).length;
  const licitacoes = vivos.map(n => ({
    id: n.id, titulo: n.titulo, orgao: n.orgao, municipio: n.municipio, uf: n.uf,
    estagio: n.estagio, valor_estimado: n.valor_estimado,
    prazo: n.abertura, prazo_origem: 'abertura da sessão (ficha)',
  }));
  return {
    fontes: { certidoes: cert, atas: atas.concat(arqu.map(a => Object.assign({ situacao: 'sem_vigencia' }, a))), licitacoes },
    meta: { vivos: vivos.length, comCertame, negocios: neg.length, certidoesNaView: (le(pasta, 'v_documentos_situacao.json') || []).length },
  };
}

const A = fontesDe(ANTES), D = fontesDe(DEPOIS);
const diaA = diaDe(ANTES), diaD = diaDe(DEPOIS);
const vaoDias = Math.round((new Date(diaD + 'T12:00:00') - new Date(diaA + 'T12:00:00')) / 86400000);
const rA = V.juntar(A.fontes, diaA);
const rD = V.juntar(D.fontes, diaD);

const chave = l => l.fonte + ':' + l.id;
const mapA = new Map(rA.linhas.map(l => [chave(l), l]));
const mapD = new Map(rD.linhas.map(l => [chave(l), l]));
const br = s => s ? String(s).split('-').reverse().join('/') : '—';
const dinheiro = v => v == null ? null : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('  O QUE ACONTECEU ENQUANTO NINGUÉM OLHOU — a conta dos ' + vaoDias + ' dias parados');
console.log('  de ' + br(diaA) + ' (' + ANTES + ')  até  ' + br(diaD) + ' (' + DEPOIS + ')');
console.log('════════════════════════════════════════════════════════════════════════════════\n');

/* ── 0. O QUE A LISTA ESTÁ DE FATO VIGIANDO ────────────────────────────────────────────────────
   ESTA SEÇÃO VEM PRIMEIRO PORQUE ELA MUDA A LEITURA DE TODAS AS OUTRAS. Um relatório que diz
   "nada morreu" e para aí é um relatório tranquilizador; se a razão de nada ter morrido é que
   não há nada real sendo vigiado, "nada morreu" vira a frase mais perigosa do documento.
   >>> É a mesma armadilha que a `resultado_zero` desta casa persegue: silêncio pode querer dizer
       "está tudo bem" ou "eu não estava olhando", e só a segunda pede providência. */
const EH_TESTE = /PROVA B\d+|registro de teste/i;
const docsTodos = le(DEPOIS, 'v_documentos_situacao.json') || [];
const atasTodas = le(DEPOIS, 'v_atas_vigencia.json') || [];
const parte = (lista, ehTeste, temData) => ({
  total: lista.length,
  teste: lista.filter(ehTeste).length,
  reais: lista.filter(x => !ehTeste(x)).length,
  reaisComData: lista.filter(x => !ehTeste(x) && temData(x)).length,
});
const dcs = parte(docsTodos, d => EH_TESTE.test(String(d.nome || '') + String(d.tipo || '')), d => !!d.validade);
const ats = parte(atasTodas, a => EH_TESTE.test(String(a.titulo || '')), a => !!a.ata_vigencia_fim);
console.log('0) O QUE A LISTA ESTÁ VIGIANDO DE VERDADE em ' + br(diaD) + ':');
console.log('   certidões no cofre ....... ' + dcs.total + '  (' + dcs.teste + ' de teste · ' + dcs.reais + ' reais, ' + dcs.reaisComData + ' com data de validade)');
console.log('   atas ..................... ' + ats.total + '  (' + ats.teste + ' de teste · ' + ats.reais + ' reais, ' + ats.reaisComData + ' com vigência preenchida)');
if (dcs.reaisComData === 0 && ats.reaisComData === 0) {
  console.log('\n   >>> LEIA ISTO ANTES DO RESTO: NENHUM registro REAL tem data. A lista da manhã não');
  console.log('       deixou de avisar nada durante a parada porque não há nada real para ela avisar.');
  console.log('       O encanamento está pronto e o dado não começou — e enquanto for assim, esta tela');
  console.log('       vai continuar calma todo dia, inclusive nos dias em que devia gritar.');
  console.log('       NÃO É DEFEITO DE CÓDIGO, é dado que falta. É trabalho do dono, não da fábrica.');
}
console.log('');

// ── 1. O QUE VIROU VENCIDO NO INTERVALO ─────────────────────────────────────────────────────
/* É A LINHA QUE A CAIXA PEDIU COM NOME E DATA. "Estava vencendo em 22/08 e está vencido em
   01/09" é a única frase desta ferramenta que atribui uma perda ao tempo parado — as outras
   descrevem estado, esta descreve uma passagem. */
const morreram = [...mapD.values()].filter(l => l.vencido && mapA.has(chave(l)) && !mapA.get(chave(l)).vencido);
console.log('1) MORREU NO INTERVALO — estava "vencendo" em ' + br(diaA) + ' e está VENCIDO em ' + br(diaD) + ':');
if (!morreram.length) console.log('   nenhuma. Nada que já estivesse na lista atravessou a linha nestes ' + vaoDias + ' dias.\n');
else { morreram.forEach(l => console.log('   · [' + l.verbo + '] ' + l.titulo + (l.detalhe ? '  (' + l.detalhe + ')' : '')
  + '\n       venceu em ' + br(l.quando) + ' — há ' + Math.abs(l.dias) + ' dia(s)'
  + (l.valor != null ? ' · ' + dinheiro(l.valor) : ''))); console.log(''); }

/* ── 1b. O NEGÓCIO QUE PERDEU A SESSÃO NO INTERVALO ────────────────────────────────────────────
   ESTA SEÇÃO NASCEU DE UM BURACO NESTA PRÓPRIA FERRAMENTA, e o buraco só apareceu porque o
   relatório foi lido em vez de entregue: a primeira rodada disse "nenhuma licitação na lista" e,
   três linhas abaixo, "negócio com a sessão já passada: 7 (era 6)". Um negócio ATRAVESSOU a data
   da sessão durante a parada — e ele não estava em lugar nenhum do relatório com nome, porque o
   motor da tela, por desenho, tira do lista quem já passou (`divida.licitacaoJaPassou`) e só o
   CONTA. Para a tela isso está certo: não há o que fazer sobre uma sessão de ontem, e a lista é
   de urgência, não de arrependimento.
   >>> MAS AQUI A PERGUNTA É OUTRA. A caixa pediu *"o que passou de 'renovar' para 'perdeu'"* — e
       era exatamente esta linha. Um contador que sobe de 6 para 7 não diz o nome de ninguém, e
       "perdemos um" sem saber qual é uma informação que ninguém consegue usar. */
const prazoDe = (fs_) => new Map(fs_.licitacoes.map(l => [l.id, l.prazo]));
const pA = prazoDe(A.fontes), pD = prazoDe(D.fontes);
const passouISO = (iso, dia) => iso && String(iso).slice(0, 10) < dia;
const perderamSessao = D.fontes.licitacoes.filter(l =>
  passouISO(pD.get(l.id), diaD) && pA.has(l.id) && !passouISO(pA.get(l.id), diaA));
/* >>> E O SEGUNDO CASO, QUE SÓ APARECEU PORQUE O CONTADOR NÃO FECHOU COM A LISTA. A primeira
       versão desta seção olhou só quem existia nos DOIS retratos, e devolveu "nenhum" — enquanto
       o contador de dívida subia de 6 para 7. A diferença era um negócio que NASCEU no intervalo
       já com a sessão para trás: alguém pôs no funil um pregão cuja data já tinha passado.
       Ele nunca "atravessou" data nenhuma, então a primeira regra não o via; e ele também não é
       uma perda causada pela parada — é uma oportunidade que já chegou perdida. São coisas
       diferentes e por isso saem em listas diferentes, mas nenhuma das duas pode sair calada.
   >>> A LIÇÃO É A MESMA DA CASA INTEIRA: quando um contador e uma lista discordam, quem está
       certo é o contador, e a lista é que está cega. */
const novosPassados = D.fontes.licitacoes.filter(l => !pA.has(l.id) && passouISO(pD.get(l.id), diaD));
console.log('1b) PERDEU A SESSÃO NO INTERVALO — a data estava à frente em ' + br(diaA) + ' e ficou para trás em ' + br(diaD) + ':');
if (!perderamSessao.length) console.log('   nenhum negócio vivo atravessou a data da sessão nestes ' + vaoDias + ' dias.');
else {
  perderamSessao.forEach(l => {
    const q = String(pD.get(l.id)).slice(0, 10);
    const atras = Math.round((new Date(diaD + 'T12:00:00') - new Date(q + 'T12:00:00')) / 86400000);
    console.log('   · [propor -> perdeu] ' + (l.titulo || l.orgao || ('negócio ' + l.id))
      + '\n       sessão em ' + br(q) + ' — passou há ' + atras + ' dia(s), na fase "' + l.estagio + '"'
      + (l.valor_estimado != null ? ' · ' + dinheiro(l.valor_estimado) : '')
      + '\n       (a data é a ' + l.prazo_origem + ')');
  });
}
if (novosPassados.length) {
  console.log('\n   E ' + novosPassados.length + ' NASCEU(RAM) JÁ PASSADO(S) — entrou no funil durante a parada, com a sessão para trás:');
  novosPassados.forEach(l => {
    const q = String(pD.get(l.id)).slice(0, 10);
    const atras = Math.round((new Date(diaD + 'T12:00:00') - new Date(q + 'T12:00:00')) / 86400000);
    console.log('   · [nasceu perdido] #' + l.id + ' ' + (l.titulo || l.orgao || ('negócio ' + l.id))
      + '\n       sessão em ' + br(q) + ' — ' + atras + ' dia(s) atrás, e ele está na fase "' + l.estagio + '"'
      + (l.valor_estimado != null ? ' · ' + dinheiro(l.valor_estimado) : ''));
  });
}
console.log('');

// ── 2. O QUE JÁ ESTAVA VENCIDO ANTES ────────────────────────────────────────────────────────
/* SEPARADO DO 1 DE PROPÓSITO. Somar os dois daria um número maior e uma acusação errada: o que
   já estava vencido em 22/08 não é a conta da parada, é dívida anterior a ela. Número com
   recorte publica o critério do recorte. */
const jaEstavam = [...mapD.values()].filter(l => l.vencido && mapA.has(chave(l)) && mapA.get(chave(l)).vencido);
console.log('2) JÁ ESTAVA VENCIDO ANTES DA PARADA (dívida velha, não é a conta destes ' + vaoDias + ' dias): ' + jaEstavam.length);
jaEstavam.forEach(l => console.log('   · [' + l.verbo + '] ' + l.titulo + ' — venceu em ' + br(l.quando)));
console.log('');

// ── 3. O QUE ENTROU NA LISTA NO INTERVALO ───────────────────────────────────────────────────
const entraram = [...mapD.values()].filter(l => !mapA.has(chave(l)));
console.log('3) ENTROU NA LISTA no intervalo (não estava lá em ' + br(diaA) + '): ' + entraram.length);
entraram.forEach(l => console.log('   · [' + l.verbo + '] ' + l.titulo + ' — ' + V.frase(l.dias)
  + ' (' + br(l.quando) + ')' + (l.vencido ? '  <<< entrou JÁ VENCIDO' : '')));
console.log('');

// ── 4. O QUE SAIU ───────────────────────────────────────────────────────────────────────────
/* SAIR DA LISTA NÃO É BOA NOTÍCIA POR SI. Uma certidão sai porque foi renovada (ótimo) ou porque
   alguém a apagou; uma ata sai porque foi arquivada (decisão de gente) ou porque perdeu a
   vigência. A ferramenta não adivinha qual: ela diz que saiu e deixa a leitura para quem sabe. */
const sairam = [...mapA.values()].filter(l => !mapD.has(chave(l)));
console.log('4) SAIU DA LISTA: ' + sairam.length + (sairam.length ? '  (renovada, arquivada ou vencida de vez — a lista não adivinha qual)' : ''));
sairam.forEach(l => console.log('   · [' + l.verbo + '] ' + l.titulo + ' — estava com ' + V.frase(l.dias)));
console.log('');

// ── 5. O QUE MORRE A SEGUIR ─────────────────────────────────────────────────────────────────
console.log('5) A MENOS DE 30 DIAS HOJE (' + br(diaD) + ') — o que morre a seguir se ninguém fizer nada:');
const proximos = rD.linhas.filter(l => !l.vencido && l.dias <= 30).sort((a, b) => a.dias - b.dias);
if (!proximos.length) console.log('   nenhuma linha viva dentro de 30 dias.');
proximos.forEach(l => console.log('   · ' + String(l.dias).padStart(3) + 'd  [' + l.verbo + '] ' + l.titulo
  + (l.detalhe ? '  (' + l.detalhe + ')' : '') + (l.valor != null ? ' · ' + dinheiro(l.valor) : '')));
console.log('');

// ── 6. O PLACAR DOS DOIS DIAS ───────────────────────────────────────────────────────────────
const placar = (r, m, dia) => '   ' + br(dia) + '   linhas: ' + String(r.linhas.length).padStart(3)
  + '  (certidão ' + r.contagem.certidao + ' · ata ' + r.contagem.ata + ' · licitação ' + r.contagem.licitacao + ')'
  + '   vencidas: ' + r.linhas.filter(l => l.vencido).length
  + '   negócios vivos: ' + m.vivos;
console.log('6) O PLACAR NOS DOIS DIAS:');
console.log(placar(rA, A.meta, diaA));
console.log(placar(rD, D.meta, diaD));
console.log('');

/* ── 7. A DÍVIDA, E ELA É O RODAPÉ QUE A TELA JÁ MOSTRA ─────────────────────────────────────
   Linha sem data NÃO APARECE na lista, e quem não aparece precisa ser contado em algum lugar —
   senão a lista parece completa. É a regra da B32, e ela vale igual aqui. */
console.log('7) O QUE FICOU DE FORA DA LISTA, E POR QUÊ (a dívida que a tela já publica no rodapé):');
const rot = { certidaoSemValidade: 'certidão sem data de validade', ataSemValidade: 'ata sem vigência',
  licitacaoSemData: 'negócio sem data de abertura', licitacaoJaPassou: 'negócio com a sessão já passada',
  ataArquivada: 'ata arquivada por decisão de alguém (não ressuscita)' };
for (const k of Object.keys(rD.divida)) console.log('   ' + String(rD.divida[k]).padStart(3) + '  ' + rot[k]
  + (rA.divida[k] !== rD.divida[k] ? '   (era ' + rA.divida[k] + ' em ' + br(diaA) + ')' : ''));

if (D.meta.comCertame > 0) {
  console.log('\n   >>> ATENÇÃO: ' + D.meta.comCertame + ' negócio(s) vivo(s) já têm certame amarrado. A tela usaria a data do');
  console.log('       ÍNDICE (encerramento da proposta) para esses, e este relatório usou a da ficha (abertura');
  console.log('       da sessão). Os dois números podem divergir a partir de agora.');
}
console.log('\n════════════════════════════════════════════════════════════════════════════════');
