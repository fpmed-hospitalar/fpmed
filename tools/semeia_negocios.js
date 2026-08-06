// ═══════════════════════════════════════════════════════════════════════════════
// SEMEIA o funil de NEGOCIOS a partir das 2.555 licitacoes acompanhadas (item 9, 06/08/2026)
//
// Uso:  node tools/semeia_negocios.js              -> PREVIEW (nada gravado)
//       node tools/semeia_negocios.js --conferir   -> AUDITA o que ja esta no banco (so leitura)
//       node tools/semeia_negocios.js --apply      -> INSERT (so em tabela vazia)
//
// POR QUE SEMEAR: funil vazio nao se avalia. Com as 2.555 linhas do Calendario 2025 o funil
// mostra, na primeira abertura, onde a empresa esta -- e a taxa de vitoria real sai de graca.
//
// >>> REGRA DE OURO DO LEMUEL (06/08): a planilha Calendario 2025 e COMO A FPMED TRABALHA.
//     O funil ESPELHA o processo deles; nao inventa um novo. Por isso o mapa abaixo e uma
//     TABELA EXPLICITA com os 9 status que realmente existem nas 2.555 linhas -- levantados do
//     banco, nao supostos -- e o codigo RECUSA status desconhecido em vez de mandar pro default.
//     Status sem destino declarado e negocio que some do funil sem ninguem perceber.
//
// >>> A DECISAO QUE MAIS IMPORTA AQUI: so o que esta ABERTO entra no kanban. As linhas de
//     historico entram ARQUIVADAS. Kanban com 2.555 cartoes nao e funil -- e a lista de
//     tudo que ja aconteceu, e ninguem arrasta nada nela. O historico continua valendo pelos
//     KPIs (taxa de vitoria por portal/orgao), que e pra isso que ele serve.
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');

const APPLY = process.argv.includes('--apply');
const CONFERIR = process.argv.includes('--conferir');

// ── AS 15 TAREFAS-MODELO (spec 6.2 do LICITACOES_SPEC.md) ──────────────────────────────────
// Uma secao por fase. Elas nascem com o negocio: checklist que o operador precisa CRIAR e
// checklist que ele nao usa.
const TAREFAS_MODELO = [
  ['oportunidade',  'Analisar o edital'],
  ['oportunidade',  'Providenciar documentação de habilitação/qualificação'],
  ['oportunidade',  'Solicitar esclarecimentos / Impugnar edital'],
  ['qualificacao',  'Analisar mercado'],
  ['qualificacao',  'Analisar concorrentes'],
  ['qualificacao',  'Definir o melhor produto/serviço para a disputa'],
  ['disputa',       'Cadastrar proposta no portal'],
  ['disputa',       'Fazer composição de preços'],
  ['disputa',       'Definir a estratégia de preços'],
  ['disputa',       'Participar da disputa'],
  ['classificacao', 'Analisar documentação dos concorrentes'],
  ['classificacao', 'Analisar produto dos concorrentes'],
  ['classificacao', 'Enviar recurso / contrarrazão'],
  ['classificacao', 'Enviar proposta atualizada'],
  ['contrato',      'Assinar contrato'],
];
const novasTarefas = () => TAREFAS_MODELO.map(([secao, texto]) => ({ secao, texto, feita: false }));

// ── MAPA OFICIAL: STATUS DA PLANILHA -> FASE DO FUNIL ──────────────────────────────────────
// Os 9 status abaixo sao os que EXISTEM de fato nas 2.555 linhas (contagem de 06/08/2026 ao
// lado). O vocabulario da planilha e de ACOMPANHAMENTO ("descartado", "participou"); o do
// funil e de ESTAGIO. A traducao nao e 1:1 e as escolhas estao aqui, explicitas, porque a
// alternativa (espalhar ifs pela tela) faz a regra virar folclore em duas semanas.
//
//   vivo=true  -> pode estar no jogo; so sai do kanban se a data de abertura ja tiver passado.
//   vivo=false -> saiu do jogo por decisao (nossa ou do orgao), ou ja aconteceu. Sempre arquiva.
const MAPA_STATUS = {
  'EM ANALISE':     { fase: 'oportunidade',  vivo: true,  n: 11,   nota: 'ainda decidindo se entra' },
  'PARTICIPAR':     { fase: 'qualificacao',  vivo: true,  n: 22,   nota: 'decidiu entrar; preparando a disputa' },
  'SUSPENSO':       { fase: 'qualificacao',  vivo: true,  n: 27,   nota: 'parado pelo orgao, mas vivo' },
  'ADIADO':         { fase: 'qualificacao',  vivo: true,  n: 4,    nota: 'remarcado, mas vivo' },
  'PARTICIPOU':     { fase: 'classificacao', vivo: false, n: 693,  nota: 'disputou; a sessao ja passou' },
  'DESCARTADO':     { fase: 'oportunidade',  vivo: false, n: 1779, nota: 'analisou e nao seguiu' },
  'NAO PARTICIPOU': { fase: 'oportunidade',  vivo: false, n: 13,   nota: 'ia entrar e nao entrou' },
  'REVOGADO':       { fase: 'oportunidade',  vivo: false, n: 4,    nota: 'o orgao revogou' },
  'CANCELADO':      { fase: 'oportunidade',  vivo: false, n: 2,    nota: 'o orgao cancelou' },
};
const norm = s => String(s == null ? '' : s).toUpperCase().trim().replace(/\s+/g, ' ');

// >>> O RESULTADO MANDA NO ESTAGIO: se a linha tem VALOR GANHO, ela terminou em CONTRATO,
//     qualquer que fosse o status. Sao 105 linhas (104 PARTICIPOU + 1 PARTICIPAR); a planilha
//     as vezes ficou no status de antes do resultado, e o dinheiro e o fato mais forte.
function faseDe(status, valorGanho) {
  if (Number(valorGanho) > 0) return 'contrato';
  const m = MAPA_STATUS[norm(status)];
  if (!m) throw new Error('STATUS SEM DESTINO no mapa: "' + status + '" — declare em MAPA_STATUS antes de semear');
  return m.fase;
}

// ARQUIVADO = nao esta no jogo. Duas razoes independentes:
//   1. o status diz que saiu (descartado, revogado, cancelado) ou que ja aconteceu (participou);
//   2. a data de abertura JA PASSOU -- por melhor que fosse o negocio, nao da mais pra agir.
// A segunda e a que tira 2,5 mil cartoes do kanban e deixa uma duzia.
//
// ⚠️ COMPARACAO POR TEXTO, de proposito. `new Date('2026-08-06') < hoje` da TRUE em GO: a string
//    vira meia-noite UTC = 21h do dia ANTERIOR no fuso -03. Com isso a licitacao que abre HOJE
//    -- justamente a mais urgente do funil -- nascia arquivada. Defeito medido em 06/08 (a de
//    08:00 no BLL sumiu do kanban). 'YYYY-MM-DD' compara certo como string e nao tem fuso.
function arquivar(status, abertura, hoje) {
  const m = MAPA_STATUS[norm(status)];
  if (!m) throw new Error('STATUS SEM DESTINO no mapa: "' + status + '"');
  if (!m.vivo) return true;
  if (!abertura) return true;                       // sem data nao da pra dizer que esta aberto
  return ymd(abertura) < ymd(hoje);
}
function ymd(d) {
  if (typeof d === 'string') return d.slice(0, 10);
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

const FASES = ['oportunidade', 'qualificacao', 'disputa', 'classificacao', 'contrato'];

module.exports = { TAREFAS_MODELO, novasTarefas, faseDe, arquivar, ymd, MAPA_STATUS, FASES, norm };
if (require.main !== module) return;

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
if (!SR) { console.error('service_role nao encontrada'); process.exit(1); }
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

async function tudo(path) {
  let out = [], off = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/${path}&limit=1000&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error(path + ' -> HTTP ' + r.status);
    const d = await r.json();
    if (!Array.isArray(d) || !d.length) break;
    out = out.concat(d); if (d.length < 1000) break; off += 1000;
  }
  return out;
}

// ── MODO --conferir: audita o que JA esta no banco, sem escrever nada ──────────────────────
// Existe porque o mapa e a promessa "nenhum status fica sem destino". Promessa sem verificador
// dura ate a proxima carga trazer um status novo.
async function conferir() {
  const ac = await tudo('licitacoes_acompanhadas?select=id,status,abertura,hora,valor_ganho,observacao&order=id');
  const ng = await tudo('negocios?select=id,acompanhada_id,estagio,arquivado&order=id');
  console.log(`acompanhadas: ${ac.length} · negocios: ${ng.length}`);

  const novos = [...new Set(ac.map(x => norm(x.status)))].filter(s => !MAPA_STATUS[s]);
  console.log(novos.length ? `\n⚠️  STATUS FORA DO MAPA (${novos.length}): ${novos.join(' · ')}` : '\n✅ todos os status da planilha estao no MAPA_STATUS');

  const comNeg = new Set(ng.map(n => n.acompanhada_id));
  const orfas = ac.filter(x => !comNeg.has(x.id));
  console.log(orfas.length ? `⚠️  acompanhadas SEM negocio: ${orfas.length}` : '✅ toda acompanhada virou negocio (nenhuma ficou sem destino)');

  const byAc = new Map(ac.map(x => [x.id, x]));
  const tab = new Map();
  for (const n of ng) {
    const k = norm((byAc.get(n.acompanhada_id) || {}).status) + ' → ' + n.estagio + (n.arquivado ? '  (arquivado)' : '  (ATIVO)');
    tab.set(k, (tab.get(k) || 0) + 1);
  }
  console.log('\nSTATUS DA PLANILHA → FASE DO FUNIL');
  [...tab.entries()].sort().forEach(([k, v]) => console.log('   ' + k.padEnd(48) + String(v).padStart(6)));

  // divergencias: o que o mapa DE HOJE diria x o que esta gravado
  const hoje = new Date();
  let div = 0;
  for (const n of ng) {
    const a = byAc.get(n.acompanhada_id); if (!a) continue;
    let f, q;
    try { f = faseDe(a.status, a.valor_ganho); q = arquivar(a.status, a.abertura, hoje); } catch (e) { continue; }
    if (f !== n.estagio || q !== n.arquivado) {
      if (div === 0) console.log('\nDIVERGENCIAS entre o mapa atual e o que esta gravado (nada e corrigido aqui):');
      if (div < 15) console.log(`   negocio ${n.id}: ${norm(a.status)} ${a.abertura} · gravado ${n.estagio}/${n.arquivado ? 'arq' : 'ativo'} · mapa diria ${f}/${q ? 'arq' : 'ativo'}`);
      div++;
    }
  }
  console.log(div ? `   total: ${div} linha(s). Corrigir exige UPDATE — precisa de OK.` : '\n✅ zero divergencia entre o mapa atual e o banco');
}

(async () => {
  if (CONFERIR) return conferir();
  console.log(APPLY ? '[APPLY]' : '[PREVIEW — nada e gravado]');
  const emp = await tudo('empresas?select=id,razao_social,principal&order=id');
  const empresaId = (emp.find(e => e.principal) || emp[0] || {}).id || null;
  console.log(`empresa vinculada: ${empresaId ? (emp.find(e => e.id === empresaId).razao_social) : '(nenhuma cadastrada)'}`);

  const ac = await tudo('licitacoes_acompanhadas?select=*&order=abertura.desc');
  console.log(`licitacoes acompanhadas: ${ac.length}`);

  // trava: status novo PARA a semeadura em vez de mandar pro default em silencio
  const novos = [...new Set(ac.map(x => norm(x.status)))].filter(s => !MAPA_STATUS[s]);
  if (novos.length) { console.error(`\nRECUSADO: ${novos.length} status sem destino no MAPA_STATUS: ${novos.join(' · ')}`); process.exit(1); }

  const hoje = new Date();
  const regs = ac.map(x => {
    const arq = arquivar(x.status, x.abertura, hoje);
    const est = faseDe(x.status, x.valor_ganho);
    const titulo = [x.modalidade, x.numero].filter(Boolean).join(' ') + (x.orgao ? ' — ' + x.orgao : '');
    return {
      empresa_id: empresaId, acompanhada_id: x.id,
      estagio: est, arquivado: arq,
      titulo: titulo.trim() || (x.orgao || 'sem título'),
      orgao: x.orgao, municipio: x.cidade, uf: x.uf, portal: x.portal,
      modalidade: x.modalidade, numero: x.numero, objeto: x.objeto,
      abertura: x.abertura ? `${x.abertura}T${x.hora || '09:00'}:00-03:00` : null,
      valor_ganho: x.valor_ganho,
      // tarefas SO no que esta em jogo: 15 itens x 2.555 seria 38 mil objetos pra responder
      // uma pergunta que o card arquivado nem faz.
      tarefas: arq ? null : novasTarefas(),
      origem: 'calendario_2025',
    };
  });

  const ativos = regs.filter(r => !r.arquivado);
  const porFase = {}, porFaseArq = {};
  ativos.forEach(r => porFase[r.estagio] = (porFase[r.estagio] || 0) + 1);
  regs.filter(r => r.arquivado).forEach(r => porFaseArq[r.estagio] = (porFaseArq[r.estagio] || 0) + 1);

  console.log('\n── MAPA STATUS → FASE (o que a planilha vira no funil) ──');
  Object.entries(MAPA_STATUS).forEach(([s, m]) =>
    console.log(`   ${s.padEnd(16)} → ${m.fase.padEnd(14)} ${m.vivo ? 'vivo    ' : 'arquiva '} · ${m.nota}`));
  console.log('   (+) qualquer linha com VALOR GANHO > 0 → contrato');

  console.log('\n── PREVIEW ────────────────────────────────────────────');
  console.log(`negocios a criar ........ ${regs.length}`);
  console.log(`  ATIVOS (vao pro kanban) ${ativos.length}`);
  FASES.forEach(f => console.log(`     ${f.padEnd(14)} ${porFase[f] || 0}`));
  console.log(`  arquivados (historico)  ${regs.length - ativos.length}`);
  console.log(`     dos quais em 'contrato' (ganhos) ... ${porFaseArq.contrato || 0}`);
  console.log(`com tarefas materializadas ${regs.filter(r => r.tarefas).length} × 15 itens`);
  console.log('\nativos:');
  ativos.slice(0, 15).forEach(r => console.log(`  [${r.estagio.padEnd(13)}] ${String(r.abertura || '').slice(0, 16).replace('T', ' ')} · ${(r.portal || '—').slice(0, 14).padEnd(14)} · ${(r.titulo || '').slice(0, 52)}`));

  const jaTem = await fetch(`${SB}/rest/v1/negocios?select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (jaTem.status === 404 || jaTem.status === 400) { console.error('\ntabela negocios nao existe — rodar antes: node tools/roda_sql.js --arquivo ddl/negocios.sql'); process.exit(1); }
  const nExist = parseInt((jaTem.headers.get('content-range') || '/0').split('/')[1]) || 0;
  console.log(`\nnegocios ja no banco: ${nExist}`);
  if (!APPLY) { console.log('\nPreview OK. Gravar com --apply. Auditar o que ja esta no banco: --conferir'); return; }
  if (nExist > 0) { console.error('\nRECUSADO: ja ha negocio no banco. Semear de novo duplicaria o funil.'); process.exit(1); }

  let n = 0;
  for (let i = 0; i < regs.length; i += 300) {
    const lote = regs.slice(i, i + 300);
    const r = await fetch(`${SB}/rest/v1/negocios`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(lote) });
    if (!r.ok) { console.error('ERRO no lote ' + i + ': ' + r.status + ' ' + (await r.text()).slice(0, 200)); process.exit(1); }
    n += lote.length;
    if (i % 900 === 0) console.log(`  criados ${n}/${regs.length}…`);
  }
  console.log(`\ncriados: ${n}`);
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
