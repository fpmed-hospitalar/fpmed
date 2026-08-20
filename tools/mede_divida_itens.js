/* ═══════════════════════════════════════════════════════════════════════════════════════════
   mede_divida_itens.js — DE QUEM É A DÍVIDA DE ITENS, E POR QUÊ (fatia A34, 20/08/2026)

   ══ A PERGUNTA QUE A CAIXA FEZ, COM AS PALAVRAS DELA ════════════════════════════════════════
   *"publicar no relatório quantas licitações do índice ficam sem itens depois de uma carga
   completa, E POR QUÊ"*. O "quantas" já tinha resposta (`conta_indice.js`); o "por quê" não
   tinha nenhuma, e sem ele o número é só um saldo — não diz se é dívida que a carga alcança
   amanhã ou dívida que ela nunca vai alcançar, que são dois problemas diferentes.

   ══ POR QUE ELE NÃO É UM NÚMERO SÓ ══════════════════════════════════════════════════════════
   A etapa de itens do condutor chama `coleta_itens_lote.js --vivas`, e `--vivas` quer dizer
   `data_encerramento >= agora`. Então "sem itens" se reparte em três populações com destinos
   OPOSTOS, e somá-las esconde exatamente o que interessa:

     VIVAS ......... prazo ainda aberto. É a dívida que a carga de amanhã zera, e é a única que
                     dói de verdade: é uma licitação que o operador pode ganhar hoje.
     SEM PRAZO ..... `data_encerramento` NULL. O `--vivas` NÃO as alcança (só com
                     `--inclui-sem-prazo`), então elas ficam paradas para sempre — e a fatia A33
                     mostrou que a maioria não tem prazo porque a porta de consulta do PNCP
                     esteve fora, não porque o edital não tenha prazo.
     ENCERRADAS .... o prazo já passou. Ler os itens delas custa o mesmo e não serve para propor:
                     é dívida que NÃO deve ser paga, e contá-la junto faz a meta parecer pior do
                     que é. Ela é histórico, e histórico se lê quando alguém pede.

   >>> ENTÃO A META HONESTA NÃO É "ZERO SEM ITENS". É "zero VIVAS sem itens". Publicar o total
       como se fosse a meta seria assinar uma dívida que ninguém pretende pagar.

     node tools/mede_divida_itens.js
     node tools/mede_divida_itens.js --json arquivo.json
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const seg = fs.readFileSync(path.join(RAIZ, 'segredos.local.txt'), 'utf8');
const SB = seg.match(/PROJECT_URL\s*[:=]\s*(\S+)/i)[1].replace(/\/$/, '');
const SR = (seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i) || [])[1];
if (!SR) { console.error('service_role nao encontrada em segredos.local.txt'); process.exit(1); }
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

/* A contagem vem do SERVIDOR (`content-range`), como na `conta_indice.js`: contar pelo `length`
   de um array devolveria 1000, que é o teto do PostgREST — e ele já mordeu esta obra quatro
   vezes. E o `r.ok` é conferido: num 401 o PostgREST devolve um OBJETO de erro, e uma leitura que
   falhou seguindo como leitura que terminou é a família de defeitos da fatia A36. */
async function conta(filtro) {
  const r = await fetch(`${SB}/rest/v1/${filtro}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (!r.ok) throw new Error(filtro + ' -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 140));
  const n = parseInt(String(r.headers.get('content-range') || '').split('/')[1], 10);
  if (!isFinite(n)) throw new Error(filtro + ' -> content-range sem total');
  return n;
}

(async () => {
  const agora = new Date().toISOString();
  const SEM = 'licitacoes?select=id&itens_lidos_em=is.null';

  const [total, comItens, semItens, semPrazo, vivas, encerradas] = await Promise.all([
    conta('licitacoes?select=id'),
    conta('licitacoes?select=id&itens_lidos_em=not.is.null'),
    conta(SEM),
    conta(SEM + '&data_encerramento=is.null'),
    conta(SEM + '&data_encerramento=gte.' + agora),
    conta(SEM + '&data_encerramento=lt.' + agora),
  ]);

  const out = { quando: agora, total, com_itens: comItens, sem_itens: semItens,
                sem_prazo: semPrazo, vivas: vivas, encerradas: encerradas,
                soma_das_tres: semPrazo + vivas + encerradas };

  const pct = n => total ? (n * 100 / total).toFixed(1) + '%' : '—';
  const n = x => Number(x).toLocaleString('pt-BR');
  console.log('=== A DÍVIDA DE ITENS, REPARTIDA — ' + agora + ' ===\n');
  console.log('  índice inteiro ......... ' + n(total));
  console.log('  com itens lidos ........ ' + n(comItens) + '   (' + pct(comItens) + ')');
  console.log('  SEM itens lidos ........ ' + n(semItens) + '   (' + pct(semItens) + ')');
  console.log('    · VIVAS (prazo aberto) ...... ' + n(vivas)
    + '   <- a única dívida que a carga deve zerar');
  console.log('    · SEM PRAZO (data NULL) ..... ' + n(semPrazo)
    + '   <- fora do alcance de `--vivas`; ver fatia A33');
  console.log('    · ENCERRADAS (prazo passou) . ' + n(encerradas)
    + '   <- histórico; ler os itens não serve para propor');
  /* A soma tem que bater com o total, e se não bater é porque apareceu uma quarta população que
     eu não conheço — o que é notícia, não detalhe. Régua que não confere consigo mesma já passou
     por certa nesta obra uma vez. */
  console.log('\n  conferência: ' + n(semPrazo) + ' + ' + n(vivas) + ' + ' + n(encerradas)
    + ' = ' + n(out.soma_das_tres) + (out.soma_das_tres === semItens ? '  ✅ bate com o "sem itens"'
      : '  ⚠️  NÃO BATE com ' + n(semItens) + ' — há uma população que esta régua não conhece'));

  const i = process.argv.indexOf('--json');
  if (i > -1 && process.argv[i + 1]) {
    fs.writeFileSync(process.argv[i + 1], JSON.stringify(out, null, 2));
    console.log('\nretrato gravado em ' + process.argv[i + 1]);
  }
  process.exitCode = out.soma_das_tres === semItens ? 0 : 1;
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
