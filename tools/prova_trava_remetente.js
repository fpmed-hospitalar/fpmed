// ============================================================================
// prova_trava_remetente.js — a prova AO VIVO de que nenhum e-mail da FPMED sai
// por domínio da GlobalMed.
//
// AUTORIZADA PELO LEMUEL EM 11/08, nestas condições exatas: apontar o
// BOLETIM_REMETENTE pra @globalmedgo por segundos, chamar com o parâmetro
// `teste` (que NÃO marca `vistos_email`), confirmar a RECUSA, remover o secret
// imediatamente e relatar.
//
// >>> POR QUE A SONDA VEM ANTES DA CHAMADA DE VERDADE.
// Sem ela a prova é ambígua: se eu aponto o remetente pro domínio proibido e a
// função mesmo assim envia, eu não sei se a TRAVA FALHOU ou se o SECRET AINDA
// NÃO TINHA PROPAGADO pro contêiner. De fora os dois casos são idênticos — e um
// é defeito grave, o outro é só pressa minha. A sonda (`{conferir:true}`) diz
// qual domínio está valendo sem ler jornal, sem montar e-mail e sem chamar o
// provedor. Só depois de ver o domínio proibido no ar é que a chamada real
// acontece. Prova que confunde dois motivos não prova nenhum dos dois.
//
// >>> ESPERA CRESCENTE, NÃO MARTELO (F4). Propagação de secret leva alguns
// segundos; o laço espera 2s, 4s, 8s... e desiste limpo em vez de bater na API.
//
// >>> O SECRET SAI NO `finally`. Se qualquer passo estourar no meio, a remoção
// acontece do mesmo jeito. E o pior caso de falhar a remoção é o boletim ficar
// BLOQUEADO — nunca vazando. A trava erra pro lado seguro por construção.
//
// NÃO IMPRIME SEGREDO NENHUM. Domínio de remetente não é segredo: é o que vai
// impresso no cabeçalho de todo e-mail que sai.
//
//   node tools/prova_trava_remetente.js
// ============================================================================
'use strict';
const fs = require('fs');

const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const pega = (re) => (seg.match(re) || [])[1] || null;
const SBP = (seg.match(/sbp_[A-Za-z0-9]+/) || [])[0];
const REF = pega(/https:\/\/([a-z]{20})\.supabase\.co/) || pega(/PROJECT_REF\s*[=:]\s*([a-z]{20})/i);
const BTOKEN = pega(/BOLETIM_TOKEN\s*[=:]\s*(\S+)/i);
const DESTINO_TESTE = 'lemuelempresas7@outlook.com';   // caixa do dono, autorizada por ele

/* ══ O ALVO É FIXO, E CONFERIDO ═══════════════════════════════════════════════
   Esta ferramenta ESCREVE (seta e apaga um secret), e escritor que descobre o
   alvo em tempo de execução pode ser apontado pra qualquer projeto — inclusive
   o da GlobalMed — sem que ninguém veja no diff.
   A suíte `testa_compliance` reprova exatamente isso, e reprovou esta ferramenta
   na primeira versão. Ela estava certa: eu lia o ref do arquivo de segredos e
   confiava. Agora o ref da FPMED está escrito aqui e é CONFERIDO antes de
   qualquer escrita — se o segredos.local.txt apontar pra outro projeto, isto
   para, em vez de mexer no lugar errado. */
const REF_FPMED = 'xzdowrksuswekwffoluk';

const PROIBIDO = 'FPMED <boletim@globalmedgo.com.br>';
const FN = `https://${REF}.supabase.co/functions/v1/enviar-boletim`;
const MGMT = `https://api.supabase.com/v1/projects/${REF}/secrets`;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const linha = (s) => console.log(s);

async function sonda() {
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'x-boletim-token': BTOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ conferir: true }),
  });
  return { status: r.status, corpo: await r.json().catch(() => ({})) };
}

async function setSecret(valor) {
  const r = await fetch(MGMT, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + SBP, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ name: 'BOLETIM_REMETENTE', value: valor }]),
  });
  return r.status;
}

async function apagaSecret() {
  const r = await fetch(MGMT, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + SBP, 'Content-Type': 'application/json' },
    body: JSON.stringify(['BOLETIM_REMETENTE']),
  });
  return r.status;
}

(async () => {
  if (!SBP || !REF || !BTOKEN) {
    console.error('falta token/ref/BOLETIM_TOKEN no segredos.local.txt'); process.exit(1);
  }
  if (REF !== REF_FPMED) {
    console.error('ABORTADO: o segredos.local.txt aponta para o projeto ' + REF
      + ', e esta ferramenta so opera no projeto da FPMED. Nenhuma escrita foi feita.');
    process.exit(1);
  }

  let veredito = 'INCONCLUSIVO';
  let enviouAlgo = null;

  try {
    linha('PASSO 1 — como esta ANTES de eu mexer');
    const antes = await sonda();
    linha('  dominio no remetente: ' + antes.corpo.remetente_dominio + '   proibido: ' + antes.corpo.proibido);
    if (antes.corpo.proibido) {
      linha('  >>> PARANDO: o remetente JA estava em dominio proibido antes de eu mexer.');
      linha('      Isso e achado, nao teste. Nao vou alterar nada.');
      veredito = 'JA ESTAVA PROIBIDO ANTES — investigar';
      return;
    }

    linha('\nPASSO 2 — aponto o remetente pro dominio PROIBIDO (por segundos)');
    linha('  POST secret -> HTTP ' + await setSecret(PROIBIDO));

    linha('\nPASSO 3 — espero a propagacao, com espera crescente (F4), SEM enviar nada');
    let propagou = false;
    for (let i = 0, ms = 2000; i < 6; i++, ms *= 2) {
      await espera(ms);
      const s = await sonda();
      linha('  tentativa ' + (i + 1) + ' (apos ' + (ms / 1000) + 's): dominio=' + s.corpo.remetente_dominio
        + '  proibido=' + s.corpo.proibido);
      if (s.corpo.remetente_dominio === 'globalmedgo.com.br') {
        propagou = true;
        if (!s.corpo.proibido) {
          linha('  >>> DEFEITO GRAVE: o dominio proibido esta no ar e a sonda diz que esta LIBERADO.');
          veredito = 'DEFEITO GRAVE — a trava nao reconheceu o dominio';
          return;
        }
        break;
      }
    }
    if (!propagou) {
      linha('  >>> o secret nao propagou a tempo. NAO vou chamar de verdade: uma chamada agora');
      linha('      nao provaria nada, so poria um e-mail na caixa dele por nada.');
      veredito = 'INCONCLUSIVO — secret nao propagou (nenhum envio tentado)';
      return;
    }

    linha('\nPASSO 4 — agora sim, a CHAMADA DE VERDADE, com o parametro teste');
    const r = await fetch(FN, {
      method: 'POST',
      headers: { 'x-boletim-token': BTOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ teste: DESTINO_TESTE }),
    });
    const c = await r.json().catch(() => ({}));
    linha('  HTTP ' + r.status);
    linha('  ok: ' + c.ok + '   compliance: ' + (c.compliance || '(nenhum)'));
    linha('  enviados: ' + (c.enviados === undefined ? '(a funcao nem chegou a essa parte)' : c.enviados));
    enviouAlgo = c.enviados;

    if (c.ok === false && c.compliance === 'remetente_proibido' && c.enviados === undefined) {
      linha('\n  A TRAVA SEGUROU. A rodada foi recusada inteira, nenhum e-mail saiu,');
      linha('  e a mensagem que ela devolve ensina o conserto certo:');
      linha('    "' + String(c.erro).slice(0, 150) + '..."');
      veredito = 'TRAVA SEGUROU';
    } else if (c.enviados > 0) {
      linha('\n  >>> DEFEITO GRAVE: saiu e-mail com remetente da GlobalMed.');
      veredito = 'DEFEITO GRAVE — e-mail enviado com remetente proibido';
    } else {
      linha('\n  >>> resultado inesperado; ver o corpo cru abaixo.');
      linha('  ' + JSON.stringify(c).slice(0, 400));
      veredito = 'INESPERADO — conferir manualmente';
    }
  } catch (e) {
    linha('\n  ERRO no meio da prova: ' + e.message);
    veredito = 'ERRO — ' + e.message;
  } finally {
    linha('\nPASSO 5 — removendo o secret (roda mesmo se algo acima estourou)');
    let st = null;
    try { st = await apagaSecret(); } catch (e) { st = 'erro: ' + e.message; }
    linha('  DELETE secret -> HTTP ' + st);

    let voltou = null;
    for (let i = 0, ms = 2000; i < 5; i++, ms *= 2) {
      await espera(ms);
      try {
        const s = await sonda();
        linha('  conferindo a volta (apos ' + (ms / 1000) + 's): dominio=' + s.corpo.remetente_dominio
          + '  proibido=' + s.corpo.proibido);
        if (s.corpo.remetente_dominio !== 'globalmedgo.com.br') { voltou = s.corpo.remetente_dominio; break; }
      } catch (e) { linha('  sonda falhou: ' + e.message); }
    }

    console.log('\n' + '='.repeat(70));
    console.log('VEREDITO: ' + veredito);
    console.log('e-mails enviados na prova: ' + (enviouAlgo === undefined || enviouAlgo === null ? 'NENHUM' : enviouAlgo));
    console.log('remetente restaurado para: ' + (voltou || 'NAO CONFIRMADO — CONFERIR A MAO'));
    console.log('='.repeat(70));
    if (!voltou) process.exit(1);
  }
})();
