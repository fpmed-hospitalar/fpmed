// ============================================================
// upgrade_compute.js — troca o COMPUTE do banco da FPMED (Nano -> Micro) pela Management API.
//
// POR QUE EXISTE: a investigação de 06/08 mediu que o Nano NÃO é gargalo de nada — latência
// 43,3 ms de média, consulta mais pesada 206 ms, zero OOM em 48 h de log. O Micro entra como
// FOLGA DE RAM (0,5 GB -> 1 GB), não como correção de problema medido. Está registrado assim
// para ninguém, daqui a três meses, achar que o banco estava com defeito.
//
// >>> A TROCA REINICIA O BANCO (1-2 min). Por isso ela é AGENDADA pra madrugada, e não rodada
//     no meio do expediente. Decisão do Lemuel (10/08): "1-2 min offline às 3h não atrapalha".
//
// >>> CUSTO: ~US$ 0,01344/hora (~US$ 10/mês), coberto pelo crédito de compute do plano Pro.
//     Isto é uma ação COM FATURA. Por isso o padrão é PRÉVIA: sem --aplicar, não muda nada.
//
// USO:
//   node tools/upgrade_compute.js                 (prévia — mostra o estado e não muda nada)
//   node tools/upgrade_compute.js --aplicar       (troca de verdade; reinicia o banco)
//   node tools/upgrade_compute.js --aplicar --variante ci_small     (outro tamanho)
//
// O token sbp_ é lido do segredos.local.txt (gitignored) e NUNCA passa pela linha de comando.
// A saída vai pro console E pro backups/upgrade_compute.log — quem agenda pra 3h da manhã não
// está acordado pra ler o console.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');

const REF = 'xzdowrksuswekwffoluk';
const RAIZ = path.join(__dirname, '..');
const LOG = path.join(RAIZ, 'backups', 'upgrade_compute.log');

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tem = (n) => process.argv.includes(n);
const VARIANTE = arg('--variante') || 'ci_micro';
const APLICAR = tem('--aplicar');

function diz(linha) {
  const l = `[${new Date().toISOString()}] ${linha}`;
  console.log(l);
  try {
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    fs.appendFileSync(LOG, l + '\n', 'utf8');
  } catch (_) { /* log é conforto, não pode derrubar a troca */ }
}

const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const TOK = (seg.match(/sbp_[A-Za-z0-9]+/) || [])[0];
if (!TOK) { diz('ERRO: token sbp_ (Management API) nao encontrado no segredos.local.txt'); process.exit(1); }

const api = async (caminho, opts) => {
  const r = await fetch('https://api.supabase.com' + caminho,
    Object.assign({ headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' } }, opts || {}));
  const txt = await r.text();
  let corpo = null; try { corpo = JSON.parse(txt); } catch (_) { corpo = txt; }
  return { status: r.status, corpo };
};

(async () => {
  diz(APLICAR ? '=== TROCA DE COMPUTE (aplicando) ===' : '=== TROCA DE COMPUTE (previa — nada muda) ===');

  const proj = await api('/v1/projects/' + REF);
  if (proj.status !== 200) { diz('ERRO: nao consegui ler o projeto (HTTP ' + proj.status + ')'); process.exit(1); }
  diz(`projeto ${proj.corpo.name} · ${proj.corpo.region} · status ${proj.corpo.status}`);

  const add = await api('/v1/projects/' + REF + '/billing/addons');
  if (add.status !== 200) { diz('ERRO: nao consegui ler os addons (HTTP ' + add.status + ')'); process.exit(1); }
  const atual = (add.corpo.selected_addons || []).find(a => a.type === 'compute_instance');
  diz('compute atual: ' + (atual ? atual.variant.identifier : 'ci_nano (padrao, sem addon)'));

  const disp = (add.corpo.available_addons || []).find(a => a.type === 'compute_instance');
  const alvo = disp && (disp.variants || []).find(v => v.id === VARIANTE);
  if (!alvo) { diz('ERRO: variante ' + VARIANTE + ' nao esta disponivel neste projeto'); process.exit(1); }
  diz(`alvo: ${alvo.id} (${alvo.name}) · ${alvo.meta.cpu_cores} vCPU · ${alvo.meta.memory_gb} GB RAM · ${alvo.price.description}`);

  // JÁ ESTÁ NO ALVO: não reinicia o banco à toa. Reiniciar pra chegar onde já se está é o tipo
  // de "operação inofensiva" que derruba o sistema por nada.
  if (atual && atual.variant && atual.variant.identifier === VARIANTE) {
    diz('>>> JA ESTA em ' + VARIANTE + ' — nada a fazer. O banco NAO foi reiniciado.');
    return;
  }

  if (!APLICAR) {
    diz('>>> PREVIA: nada foi alterado. Para trocar de verdade:');
    diz('    node tools/upgrade_compute.js --aplicar');
    diz('    (a troca REINICIA o banco por 1-2 min — rodar de madrugada)');
    return;
  }

  diz('aplicando ' + VARIANTE + '... (o banco reinicia; 1-2 min)');
  /* >>> PATCH, E NAO POST. A tarefa agendada disparou 03:00 em ponto de 11/08 e falhou com
         `HTTP 404 Cannot POST /v1/projects/.../billing/addons`: a Management API trocou o metodo
         de escrita, e o POST deixou de existir. O GET na MESMA rota continuou respondendo 200,
         que e o que fazia a previa parecer saudavel.
         Descoberto sem aplicar nada: mandei corpo vazio em PUT, PATCH e POST — PUT e POST deram
         404 (rota nao existe pra eles) e PATCH deu 400 reclamando do CORPO, que e a resposta de
         quem existe. Descobrir metodo por tentativa de escrita seria arriscar aplicar sem querer;
         corpo invalido de proposito nao muda nada. */
  const r = await api('/v1/projects/' + REF + '/billing/addons', {
    method: 'PATCH',
    body: JSON.stringify({ addon_type: 'compute_instance', addon_variant: VARIANTE }),
  });
  if (r.status < 200 || r.status >= 300) {
    diz('ERRO na troca: HTTP ' + r.status + ' ' + JSON.stringify(r.corpo).slice(0, 400));
    // >>> 404 AQUI QUER DIZER QUE A ROTA MUDOU DE NOVO, e nao que o projeto sumiu — o GET da
    //     mesma rota funcionou dez linhas acima. Dizer isso poupa a proxima investigacao.
    if (r.status === 404) diz('    (o GET desta MESMA rota respondeu 200 — entao o projeto existe e '
      + 'quem mudou foi o METODO de escrita da Management API. Foi assim em 11/08, quando era POST.)');
    process.exit(1);
  }
  diz('troca aceita pela Management API (HTTP ' + r.status + ')');

  // CONFERE DEPOIS DE VOLTAR. "A API aceitou" não é "o banco está no ar" — e quem vai ler este
  // log de manhã precisa saber qual das duas coisas aconteceu.
  for (let i = 1; i <= 20; i++) {
    await new Promise(s => setTimeout(s, 15000));
    const p = await api('/v1/projects/' + REF);
    diz(`  conferindo (${i}/20): status ${p.status === 200 ? p.corpo.status : 'HTTP ' + p.status}`);
    if (p.status === 200 && p.corpo.status === 'ACTIVE_HEALTHY') {
      const dep = await api('/v1/projects/' + REF + '/billing/addons');
      const ag = (dep.corpo.selected_addons || []).find(a => a.type === 'compute_instance');
      diz('>>> BANCO DE VOLTA · compute agora: ' + (ag ? ag.variant.identifier : 'sem addon'));
      // prova de vida de verdade: uma consulta REAL, não só o status da plataforma
      try {
        const sr = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
        const t0 = Date.now();
        const q = await fetch(`https://${REF}.supabase.co/rest/v1/coleta_status?select=fonte&limit=1`,
          { headers: { apikey: sr, Authorization: 'Bearer ' + sr } });
        diz(`>>> consulta real: HTTP ${q.status} em ${Date.now() - t0}ms`);
      } catch (e) { diz('>>> consulta real FALHOU: ' + e.message); }
      return;
    }
  }
  diz('!! o projeto nao voltou pra ACTIVE_HEALTHY em 5 min — conferir no painel do Supabase');
  process.exit(2);
})().catch(e => { diz('ERRO: ' + (e && e.message)); process.exit(1); });
