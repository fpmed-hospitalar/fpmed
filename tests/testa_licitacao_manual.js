// SUITE testa_licitacao_manual — o que o PNCP nao acha entra no funil mesmo assim.
//
// ══ O CASO ══════════════════════════════════════════════════════════════════════════════════
// Procurou no nosso indice, procurou no Brasil inteiro pelo PNCP, e a licitacao existe assim
// mesmo: veio da BLL, de convite, de e-mail do orgao. Sem isto, o funil so sabe do que o PNCP
// conta — e o que nao esta la nao existe pra empresa.
//
// ══ AS TRES DECISOES ════════════════════════════════════════════════════════════════════════
//   1. O QUE NASCE E UM NEGOCIO NORMAL. Nao ha "negocio manual" como especie separada: ha um
//      negocio cuja ORIGEM foi a mao de alguem, e isso fica dito na ficha.
//   2. OS CAMPOS SAO OS DA FICHA, e nenhum a mais. Pedir "so o essencial" produziria um negocio
//      pela metade que nao aparece direito no funil, na agenda nem no sino — e ninguem
//      entenderia por que.
//   3. A DUPLICATA E AVISADA, E NAO IMPEDIDA. Orgao que republica o mesmo pregao existe, e
//      recusar a criacao obrigaria a inventar um numero diferente pra contornar a trava — que e
//      como se estraga um indice.
//
//   node tests/testa_licitacao_manual.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const N = R('fpmed_negocios.html');
const L = R('fpmed_licitacoes.html');
const uc = s => s.replace(/\s*\n\s*(?:\/\/|--|\*)?\s*/g, ' ');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_licitacao_manual — o que o PNCP nao acha\n');

// ══════════ 1. OS DOIS BOTOES ══════════
ok('1. *** ha "+ Incluir licitacao" no Negocios ***', /onclick="abrirFormManual\(\)" id="lk-manual"/.test(N));
ok('2. *** e no Encontrar, junto da busca ***', /onclick="incluirLicitacaoManual\(\)"/.test(L));
ok('3. *** o do Encontrar LEVA pro Negocios, e nao duplica o formulario ***',
  /location\.href = 'fpmed_negocios\.html';/.test(L) && !/function abrirFormManual/.test(L));
ok('4. ...com o motivo (dois jeitos de incluir, e um fica pra tras)',
  /um deles\s*ficaria pra trás na primeira vez que a ficha ganhasse um campo/.test(uc(L)));
ok('5. *** ele leva o termo procurado pro OBJETO ***',
  /objeto: termo \|\| null/.test(L) && /if\(ob && ctx\.objeto\) ob\.value = ctx\.objeto;/.test(N));
ok('6. ...e NAO inventa orgao nem numero',
  /Órgão e número ela não sabe, e não inventa/.test(uc(L)));
ok('7. o contexto e consumido de uma vez (recarregar nao reabre o que foi fechado)',
  /sessionStorage\.removeItem\('fpmed_incluir_manual'\)/.test(N));

// ══════════ 2. OS CAMPOS SAO OS DA FICHA ══════════
['m-portal', 'm-numero', 'm-orgao', 'm-municipio', 'm-uf', 'm-modalidade',
 'm-abertura', 'm-situacao', 'm-valor', 'm-estagio', 'm-empresa', 'm-objeto'].forEach((id, i) => {
  ok('8.' + (i + 1) + ' campo ' + id, new RegExp('id="' + id + '"').test(N));
});
ok('9. *** o portal tem sugestoes E aceita texto livre (datalist, nao select) ***',
  /<input id="m-portal" list="m-portais"/.test(N) && /const PORTAIS_SUGERIDOS = \[/.test(N));
ok('10. *** a situacao oferece as MESMAS da ficha ***',
  ['normal', 'adiado', 'suspenso', 'cancelado', 'remarcado']
    .every(s => new RegExp('<option value="' + s + '"').test(N)));
ok('11. *** a fase inicial e escolhida, com Oportunidade como padrao ***',
  /f\.k==='oportunidade'\?' selected':''/.test(N));
ok('12. *** e as fases saem de FASES (nao uma lista paralela) ***',
  /\$\{FASES\.map\(f =>\s*`<option value="\$\{f\.k\}"/.test(N));
ok('13. *** a empresa e o mesmo vinculo dos demais ***', /EMPRESAS\.map\(e =>/.test(N));
ok('14. ...e o motivo de nao pedir "so o essencial" esta escrito',
  /o resultado seria um negócio pela metade/.test(uc(N)));

// ══════════ 3. O QUE NASCE E UM NEGOCIO NORMAL ══════════
ok('15. *** grava na tabela `negocios`, e nao numa tabela propria ***',
  /rest\/v1\/negocios`, \{method:'POST'/.test(N));
ok('16. *** com origem `manual` ***', /origem: 'manual',/.test(N));
ok('17. *** e quem criou ***', /criado_por: \(window\.gmAuth && gmAuth\.user && gmAuth\.user\.email\) \|\| null,/.test(N));
ok('18. *** a ficha DIZ a procedencia, e distingue as tres ***',
  /function selaOrigem\(n\)/.test(N) && /Incluída à mão/.test(N)
  && /Importada do Calendário 2025/.test(N) && /Do PNCP<\/b>, pela tela de Licitações/.test(N));
ok('19. ...e diz ONDE CONFERIR cada uma',
  /é o portal de origem/.test(N) && /podem ser conferidos lá/.test(N));
ok('20. ...com o motivo (as tres sao legitimas e nenhuma e igual)',
  /As três são legítimas e nenhuma é igual/.test(uc(N)));
ok('21. *** depois de criar, abre a FICHA do que nasceu ***',
  /if\(novo && novo\.id\) abrirDrawer\(novo\.id\);/.test(N));

// ══════════ 4. A DUPLICATA ══════════
ok('22. *** existe a busca por duplicata ***', /function achaDuplicata\(portal, numero, orgao\)/.test(N));
ok('23. *** por portal + numero + orgao ***',
  /_chaveCert\(x\.numero\) === n/.test(N) && /_chaveCert\(x\.orgao\) === o/.test(N) && /_chaveCert\(x\.portal\) === p/.test(N));
ok('24. *** ignorando acento, maiuscula e pontuacao ***',
  /normalize\('NFD'\)\.replace\(\/\\p\{M\}\/gu,''\)\.toUpperCase\(\)\.replace\(\/\[\^A-Z0-9\]\/g,''\)/.test(N));
ok('25. ...com o motivo ("PE 050/2026" e "pe050/2026" sao o mesmo pregao)',
  /são o mesmo\s*pregão pra quem trabalha, e seriam dois pro banco/.test(uc(N)));
ok('26. *** ela AVISA e oferece abrir o que existe ***',
  /OK = abrir o que já existe/.test(N) && /fecharFormManual\(\); abrirDrawer\(dup\.id\); return;/.test(N));
ok('27. *** e NAO impede a criacao ***',
  /A DUPLICATA É AVISADA ANTES, e não impedida/.test(N));
ok('28. ...com o motivo (obrigaria a inventar um numero pra contornar a trava)',
  /que é\s*como se estraga um índice/.test(uc(N)));

// ══════════ 5. O MINIMO, E A PERMISSAO ══════════
ok('29. *** exige ao menos orgao OU numero ***',
  /if\(!orgao && !numero\)\{ msg\.textContent = 'escreva ao menos o órgão ou o número do certame\.'/.test(N));
ok('30. ...com o motivo (card sem titulo, ninguem acha aquilo de novo)',
  /o negócio existiria só pra atrapalhar a contagem/.test(uc(N)));
ok('31. *** a permissao e a MESMA da ficha ***', /if\(!ehGestor\(\)\)\{/.test(N));
ok('32. ...com o motivo (duas regras de permissao = duas chances de discordarem)',
  /a do banco \(RLS\) venceria as duas de qualquer jeito/.test(uc(N)));
ok('33. e quem nao grava ve o formulario dizendo por que nao pode',
  /Só quem grava negócio pode incluir licitação — é a mesma regra da ficha/.test(N));

// ══════════ 6. NADA DE DELETE ══════════
ok('34. *** nao ha DELETE de negocio em lugar nenhum da tela ***',
  !/method:'DELETE'[\s\S]{0,120}negocios/.test(N));
ok('35. ...e arquivar continua sendo o caminho', /function arquivar\(/.test(N));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
