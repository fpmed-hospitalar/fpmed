/* ══════════════════════════════════════════════════════════════════════════════════════════════
   prova_aviso_certidao.js — ARQUIVAR, CONTAR E AVISAR, DO COMEÇO AO FIM (fatia B27) · 20/08/2026

   A caixa pede três coisas, com estas palavras:
     (a) *"`ativo = false` com carimbo e motivo, feito pela tela"* · *"o painel de contagem NÃO
         conta arquivado. Conferir contra o SQL, com número no relatório."*
     (b) *"Prova: o teste enviado, o id de retorno do Resend, e a consulta que escolheu os
         documentos conferida contra o SQL."*

   ══ O CRACHÁ É O DO NAVEGADOR, DE NOVO E PELO MESMO MOTIVO ══════════════════════════════════
   `service_role` passa por cima de TODA a RLS. Uma prova com ela diria "funciona" mesmo se as
   policies estivessem erradas — foi o buraco que deixou o botão Anexar quebrado por dias na B16,
   com o banco em ZERO linhas e as suítes verdes. Aqui tudo passa pelo token de uma sessão de
   verdade, o mesmo que o navegador do Natanael carrega. A edge function `avisar-certidao` também
   não recebe service_role: ela lê o cofre com ESTE token.

   ══ E A CONTA DO PAINEL É ARRANCADA DA TELA, NÃO REESCRITA ══════════════════════════════════
   `contaSituacoes` vem do `fpmed_documentos.html` por recorte. Reescrevê-la aqui provaria o banco
   e não provaria a tela — que é o mesmo buraco por outro lado.

   ══ O QUE ESTA PROVA MANDA PARA FORA, E POR QUE ISSO É SEGURO ═══════════════════════════════
   Ela dispara UM e-mail de verdade, pelo Resend. O conteúdo dele são os documentos que estão
   vencendo AGORA — e, medido antes de mandar, os únicos documentos nesse estado são os registros
   `[PROVA B27]` que ESTA prova acabou de criar. Nenhuma certidão real da empresa entra no e-mail.
   >>> ISSO NÃO É SORTE, É CONFERIDO: o assert 12 reprova se aparecer no aviso qualquer documento
       cujo nome não comece pela marca de prova. Se um dia o Natanael cadastrar uma CND de verdade
       que esteja vencendo, esta prova PARA de mandar e-mail e diz por quê — em vez de despachar
       o documento dele para dentro de uma conta de terceiro sem ninguém perceber.

     node tools/prova_aviso_certidao.js
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const ANON = (seg.match(/anon[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
const SENHA = (seg.match(/^\s*SENHA_PADRAO\s*[:=]\s*(\S+)/im) || [])[1] || 'adm2026';

const HTML = fs.readFileSync(path.join(RAIZ, 'fpmed_documentos.html'), 'utf8').replace(/\r\n/g, '\n');
const pega = re => (HTML.match(re) || [])[0] || '';
const API = new Function(
  pega(/function contaSituacoes\(docs\)\{[\s\S]*?\n\}/) + '\n'
  + 'return { contaSituacoes };')();

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };

const MARCA = '[PROVA B27 — registro de teste, pode arquivar]';
const iso = d => d.toISOString().slice(0, 10);
const hoje = new Date();
const emDias = k => iso(new Date(hoje.getTime() + k * 86400000));

let TK = null;
const H = extra => Object.assign({ apikey: ANON, Authorization: 'Bearer ' + TK }, extra || {});

async function token() {
  for (const email of ['licitacao@fpmed.com.br', 'comercial@fpmed.com.br']) {
    const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: SENHA }) }).catch(() => null);
    if (r && r.ok) { const j = await r.json(); if (j.access_token) return { tk: j.access_token, email }; }
  }
  return null;
}
async function le(q) {
  const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H() });
  if (!r.ok) throw new Error(q + ' -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 140));
  return r.json();
}
async function grava(corpo) {
  const r = await fetch(`${SB}/rest/v1/documentos`, {
    method: 'POST', headers: H({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error('gravar -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return (await r.json())[0];
}
// O MESMO PATCH QUE A TELA MANDA. Se ele divergir do da tela, a prova para de provar a tela — por
// isso os três campos são exatamente os do `confirmarArquivamento`.
async function ajusta(id, campos) {
  const r = await fetch(`${SB}/rest/v1/documentos?id=eq.${id}`, {
    method: 'PATCH', headers: H({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(campos) });
  if (!r.ok) throw new Error('ajustar -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return (await r.json())[0];
}

/* REAPROVEITA OS PRÓPRIOS REGISTROS, e isso não é economia: criar dois documentos por execução
   deixaria vinte certidões de mentira no cofre depois de dez rodadas — e apagá-las é DELETE, que
   a regra da casa proíbe sem o dono. Ela acha os seus dois pelo NOME e só cria o que faltar.
   >>> E A VALIDADE É REALINHADA A CADA RODADA, de propósito: as datas são relativas a HOJE, e um
       registro reaproveitado daqui a um mês estaria em outro estado — a prova passaria a reprovar
       sozinha, sem nada ter quebrado. É a mesma decisão da B25, pelo mesmo motivo. */
async function garante({ nome, tipo, validade }) {
  const cheio = MARCA + ' ' + nome;
  const achados = await le(`v_documentos_historico?select=*&nome=eq.${encodeURIComponent(cheio)}&order=id.asc&limit=1`);
  if (achados.length) {
    const d = achados[0];
    const precisa = {};
    if (String(d.validade || '').slice(0, 10) !== String(validade || '')) precisa.validade = validade;
    // reencena a cena: um registro que a rodada anterior deixou arquivado mediria o nada aqui
    if (d.ativo === false) { precisa.ativo = true; precisa.arquivado_em = null; precisa.arquivado_motivo = null; precisa.desarquivado_em = null; }
    if (Object.keys(precisa).length) return Object.assign({}, d, await ajusta(d.id, precisa));
    return d;
  }
  return grava({ nome: cheio, tipo, orgao_emissor: 'fatia B27', validade, dias_aviso: 30, versao: 1 });
}

async function chamaFuncao(corpo) {
  const r = await fetch(`${SB}/functions/v1/avisar-certidao`, {
    method: 'POST', headers: H({ 'Content-Type': 'application/json' }), body: JSON.stringify(corpo) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (_) {}
  return { http: r.status, j, txt: t };
}

(async () => {
  console.log('=== ARQUIVAR, CONTAR E AVISAR (fatia B27) ===\n');
  const s = await token();
  if (!s) { console.error('nenhum e-mail logou com a SENHA_PADRAO.'); process.exit(1); }
  TK = s.tk;
  console.log(`  sessão de verdade: ${s.email}   (service_role NÃO é usada nesta prova)\n`);

  // ══════════ 0. AS COLUNAS NOVAS EXISTEM E A MIGRAÇÃO FOI ADITIVA ══════════════════════════
  const umaLinha = await le('v_documentos_situacao?select=*&limit=1');
  const colunas = umaLinha.length ? Object.keys(umaLinha[0]) : [];
  ok(n + '. *** a view da tela ganhou arquivamento e destinatário sem perder nada ***',
    ['arquivado_em', 'arquivado_motivo', 'arquivado_por', 'desarquivado_em', 'email_aviso',
     'situacao', 'dias_para_vencer', 'versoes_anteriores'].every(c => colunas.includes(c)), colunas); n++;
  /* A ORDEM DE NOVO, e pelo mesmo motivo da B25: `create or replace view` recusa mudança de
     POSIÇÃO. Se alguém puser uma coluna nova no meio, a migração deixa de ser aditiva e passa a
     exigir `drop view` — que é o que a regra da casa proíbe. Este assert é o alarme disso. */
  ok(n + '. ...e as colunas da B25 continuam nas MESMAS posições (aditiva de novo)',
    colunas.indexOf('versoes_anteriores') < colunas.indexOf('arquivado_em')
    && colunas.indexOf('versao') < colunas.indexOf('arquivado_em'), colunas.slice(-8)); n++;

  // ══════════ 1. OS DOIS REGISTROS DA PROVA ═════════════════════════════════════════════════
  console.log('  ─── 1. dois documentos que o aviso TEM de escolher ───');
  const vencendo = await garante({ nome: 'CND Estadual (vencendo)', tipo: 'CND Estadual', validade: emDias(10) });
  const vencida  = await garante({ nome: 'CND Municipal (vencida)', tipo: 'CND Municipal', validade: emDias(-3) });
  const estados = await le(`v_documentos_situacao?select=id,situacao,dias_para_vencer&id=in.(${vencendo.id},${vencida.id})`);
  const eV = estados.find(x => x.id === vencendo.id), eX = estados.find(x => x.id === vencida.id);
  console.log(`    ${vencendo.id} -> ${eV && eV.situacao} (${eV && eV.dias_para_vencer} dias)`);
  console.log(`    ${vencida.id} -> ${eX && eX.situacao} (${eX && eX.dias_para_vencer} dias)`);
  ok(n + '. o de 10 dias cai em "vencendo" (dentro do aviso de 30)',
    eV && eV.situacao === 'vencendo' && eV.dias_para_vencer === 10, eV); n++;
  ok(n + '. o de -3 dias cai em "vencido"',
    eX && eX.situacao === 'vencido' && eX.dias_para_vencer === -3, eX); n++;

  // ══════════ 2. A CONSULTA QUE ESCOLHE O AVISO, CONFERIDA CONTRA O SQL ══════════════════════
  console.log('\n  ─── 2. quem entra no aviso × o banco ───');
  const avisar = await le('v_documentos_avisar?select=*&order=validade.asc');
  const situacoes = await le('v_documentos_situacao?select=id,nome,situacao');
  const esperado = situacoes.filter(d => d.situacao === 'vencido' || d.situacao === 'vencendo');
  console.log(`    v_documentos_avisar: ${avisar.length}   ·   vencido+vencendo na view da tela: ${esperado.length}`);
  ok(n + '. *** a view do aviso e a view da tela escolhem EXATAMENTE os mesmos documentos ***',
    avisar.length === esperado.length
    && avisar.every(a => esperado.some(e => e.id === a.id)), [avisar.map(a => a.id), esperado.map(e => e.id)]); n++;
  /* >>> O ASSERT DA CAIXA: documento SEM VALIDADE não entra no aviso. Ele não está vencendo, está
         sem data — e um aviso que diz "sua certidão está para vencer" sobre um contrato social que
         não vence é como se ensina alguém a ignorar os avisos verdadeiros. */
  const semVal = situacoes.filter(d => d.situacao === 'sem_validade');
  console.log(`    sem validade no cofre: ${semVal.length} — e nenhum deles pode estar no aviso`);
  ok(n + '. *** nenhum documento SEM VALIDADE entrou no aviso (são ' + semVal.length + ' no cofre) ***',
    semVal.length > 0 && !avisar.some(a => semVal.some(v => v.id === a.id)),
    semVal.map(v => v.id)); n++;

  // ══════════ 3. ARQUIVAR — E O PAINEL NÃO CONTA O ARQUIVADO ════════════════════════════════
  console.log('\n  ─── 3. arquivar, e o painel × o SQL ───');
  const antes = await le('v_documentos_situacao?select=situacao');
  const contaAntes = API.contaSituacoes(antes);
  console.log('    painel ANTES (função da tela):', JSON.stringify(contaAntes), '· total', antes.length);

  const MOTIVO = 'registro de teste do sistema';
  const arq = await ajusta(vencida.id, { ativo: false, arquivado_em: new Date().toISOString(),
    arquivado_motivo: MOTIVO, desarquivado_em: null, atualizado_em: new Date().toISOString() });
  ok(n + '. *** ARQUIVAR grava carimbo e motivo, e NÃO apaga a linha (nada de DELETE) ***',
    arq.ativo === false && !!arq.arquivado_em && arq.arquivado_motivo === MOTIVO,
    [arq.ativo, arq.arquivado_em, arq.arquivado_motivo]); n++;

  const depois = await le('v_documentos_situacao?select=situacao');
  const contaDepois = API.contaSituacoes(depois);
  console.log('    painel DEPOIS (função da tela):', JSON.stringify(contaDepois), '· total', depois.length);
  ok(n + '. *** o arquivado SAIU do painel — o total caiu exatamente 1 ***',
    depois.length === antes.length - 1, [antes.length, depois.length]); n++;
  ok(n + '. ...e ele saiu do contador CERTO (um vencido a menos, o resto igual)',
    contaDepois.vencido === contaAntes.vencido - 1
    && contaDepois.vencendo === contaAntes.vencendo
    && contaDepois.ok === contaAntes.ok
    && contaDepois.sem_validade === contaAntes.sem_validade, [contaAntes, contaDepois]); n++;

  // O LADO DO BANCO, contado pelo PostgREST e não pela mesma lista — se fosse a mesma lista, os
  // dois números seriam o mesmo número dito duas vezes.
  const grupos = {};
  for (const est of ['vencido', 'vencendo', 'ok', 'sem_validade']) {
    const r = await fetch(`${SB}/rest/v1/v_documentos_situacao?select=id&situacao=eq.${est}`,
      { headers: H({ Prefer: 'count=exact', Range: '0-0' }) });
    grupos[est] = parseInt(String(r.headers.get('content-range') || '/0').split('/')[1], 10);
  }
  console.log('    banco  (count=exact)         :', JSON.stringify(grupos));
  ok(n + '. *** os quatro números do painel batem com o banco DEPOIS de arquivar ***',
    ['vencido', 'vencendo', 'ok', 'sem_validade'].every(k => contaDepois[k] === grupos[k]),
    [contaDepois, grupos]); n++;
  ok(n + '. *** e eles FECHAM com o total (nenhum documento fica sem contador) ***',
    Object.values(contaDepois).reduce((a, b) => a + b, 0) === depois.length,
    [contaDepois, depois.length]); n++;

  // A GAVETA — e ela não pode mostrar quem foi SUBSTITUÍDO, só quem foi ARQUIVADO
  const gaveta = await le('v_documentos_arquivados?select=*&order=arquivado_em.desc');
  const historico = await le('v_documentos_historico?select=id,ativo,substituido_em,arquivado_em');
  const inativos = historico.filter(h => h.ativo === false);
  const substituidos = inativos.filter(h => h.substituido_em && !h.arquivado_em);
  console.log(`    inativos no cofre: ${inativos.length} · na gaveta: ${gaveta.length} · substituídos: ${substituidos.length}`);
  ok(n + '. *** a gaveta mostra o que foi ARQUIVADO e não o que foi substituído ***',
    gaveta.some(g => g.id === vencida.id)
    && !gaveta.some(g => substituidos.some(x => x.id === g.id)),
    [gaveta.map(g => g.id), substituidos.map(x => x.id)]); n++;

  // ══════════ 4. DESARQUIVAR — E O CARIMBO NÃO SOME ═════════════════════════════════════════
  console.log('\n  ─── 4. devolver à lista, sem apagar o carimbo ───');
  const volta = await ajusta(vencida.id, { ativo: true, desarquivado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString() });
  ok(n + '. *** devolver NÃO apaga `arquivado_em`/`arquivado_motivo` — quem desfaz um ato não '
    + 'desfaz o fato de ter feito ***',
    volta.ativo === true && !!volta.desarquivado_em && !!volta.arquivado_em
    && volta.arquivado_motivo === MOTIVO, volta); n++;
  const gaveta2 = await le('v_documentos_arquivados?select=id');
  ok(n + '. ...e ele saiu da gaveta e voltou para a lista',
    !gaveta2.some(g => g.id === vencida.id), gaveta2.map(g => g.id)); n++;

  // ══════════ 5. O E-MAIL DE VERDADE ════════════════════════════════════════════════════════
  console.log('\n  ─── 5. o aviso de teste, pelo Resend ───');
  const sonda = await chamaFuncao({ conferir: true });
  console.log('    sonda:', JSON.stringify(sonda.j));
  ok(n + '. a sonda responde o estado SEM enviar nada (chave, cargo, remetente)',
    sonda.http === 200 && sonda.j && sonda.j.ok === true && sonda.j.gestor === true
    && sonda.j.chave_configurada === true && sonda.j.proibido === false, sonda.j); n++;
  ok(n + '. *** e ela diz, por escrito, que o disparo automático NÃO está ligado ***',
    sonda.j && sonda.j.automatico === false, sonda.j && sonda.j.automatico); n++;

  /* >>> A TRAVA DE PRIVACIDADE DESTA PRÓPRIA PROVA. Ela manda um e-mail de verdade; o conteúdo
         são os documentos que estão vencendo AGORA. Se algum deles for uma certidão real do
         Natanael, a prova PARA — porque despachar documento real da empresa para dentro de uma
         conta de e-mail de terceiro, só para deixar um teste verde, é exatamente o tipo de
         "só dessa vez" que o COMPLIANCE.md proíbe com todas as letras. */
  const avisarAgora = await le('v_documentos_avisar?select=id,nome');
  const forasteiros = avisarAgora.filter(d => !String(d.nome || '').startsWith('[PROVA'));
  ok(n + '. *** o aviso só contém registro de PROVA — nenhuma certidão real sai daqui ***',
    forasteiros.length === 0, forasteiros.map(d => d.nome)); n++;
  if (forasteiros.length) {
    console.log('\n  >>> ENVIO CANCELADO DE PROPÓSITO: há documento real no aviso. Isto não é falha do');
    console.log('      código — é a trava funcionando. Rode de novo depois de arquivar ou ajustar');
    console.log('      o documento real, ou mande o aviso pela TELA, que é onde o dono decide.');
  } else {
    // 1º tiro: para o e-mail DA SESSÃO, que é o padrão do botão da tela.
    const t1 = await chamaFuncao({ teste: true });
    console.log(`    para a sessão (${s.email}) -> ok=${t1.j && t1.j.ok} · ${(t1.j && (t1.j.id || t1.j.erro) || '').toString().slice(0, 150)}`);
    let idFinal = t1.j && t1.j.id, paraFinal = t1.j && t1.j.para;

    /* ══ O 403 DE CONTA EM MODO DE TESTE — MEDIDO, NÃO SUPOSTO ═══════════════════════════════
       A conta do Resend está compartilhada com a GlobalMed (medido hoje: o único domínio
       verificado nela é `globalmedgo.com.br`) e por isso continua em modo de teste para a FPMED:
       ela só entrega para o e-mail dono da conta. Em vez de eu escrever esse endereço aqui — o
       que seria uma segunda cópia de um dado que muda —, a prova LÊ o endereço da recusa e tenta
       de novo. Assim ela continua valendo no dia em que o domínio for verificado: aí o primeiro
       tiro dá certo e este bloco nem roda. */
    if (!(t1.j && t1.j.ok)) {
      const dono = String((t1.j && t1.j.erro) || '').match(/entrega para ([^\s.]+@[^\s.]+\.[^\s,.]+)/);
      if (dono) {
        console.log(`    a conta está em modo de teste e só entrega para ${dono[1]} — repetindo para lá`);
        const t2 = await chamaFuncao({ teste: true, para: dono[1] });
        console.log(`    para o dono da conta -> ok=${t2.j && t2.j.ok} · id ${t2.j && t2.j.id}`);
        idFinal = t2.j && t2.j.id; paraFinal = t2.j && t2.j.para;
      }
    }
    ok(n + '. *** O E-MAIL SAIU DE VERDADE, e o Resend devolveu um id ***',
      !!idFinal, [idFinal, paraFinal, t1.j && t1.j.erro]); n++;
    console.log(`\n    >>> id do Resend: ${idFinal}   ·   destino: ${paraFinal}`);
  }

  // ══════════ 6. A PORTA ════════════════════════════════════════════════════════════════════
  console.log('\n  ─── 6. a porta da função e a das views ───');
  const semTk = await fetch(`${SB}/functions/v1/avisar-certidao`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"teste":true}' });
  console.log(`    sem crachá -> HTTP ${semTk.status}`);
  ok(n + '. *** sem crachá de sessão a função recusa (401) — ela não é um relé de e-mail ***',
    semTk.status === 401, semTk.status); n++;

  const semTeste = await chamaFuncao({});
  ok(n + '. sem `{"teste":true}` ela recusa — não há caminho automático nesta fatia',
    semTeste.http === 400 && semTeste.j && semTeste.j.ok === false, semTeste.j); n++;

  const semCracha = async q => (await fetch(`${SB}/rest/v1/${q}`,
    { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } })).status;
  const aArq = await semCracha('v_documentos_arquivados?select=id&limit=1');
  const aAvi = await semCracha('v_documentos_avisar?select=id&limit=1');
  console.log(`    anon -> v_documentos_arquivados: HTTP ${aArq} · v_documentos_avisar: HTTP ${aAvi}`);
  /* AS DUAS VIEWS NOVAS SÃO O RISCO DA FATIA. `v_documentos_avisar` carrega número de certidão e
     órgão emissor; `v_documentos_arquivados` enxerga tudo que já foi tirado do cofre. View nova
     aberta ao `anon` é o defeito clássico de fatia de esquema — e este assert é ele, à queima
     roupa, do lado de fora. */
  ok(n + '. *** o `anon` não lê nenhuma das duas views novas ***', aArq >= 400 && aAvi >= 400, [aArq, aAvi]); n++;

  console.log('\n  PENDÊNCIA: esta prova deixou 2 registros de teste no cofre (o nome de cada um');
  console.log('  começa com "' + MARCA + '"). Agora eles podem ser tirados PELA TELA, no botão');
  console.log('  "arquivar" — que é a fatia inteira. Nenhum DELETE foi usado.');
  console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
  process.exitCode = f ? 1 : 0;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
