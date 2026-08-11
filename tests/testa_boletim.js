// SUITE testa_boletim — O BOLETIM DIARIO POR E-MAIL (modulo 2.14).
//
// A REGRA DE OURO, registrada no SPEC antes de existir codigo: ESPERAR O DIA FECHAR. O boletim e
// do dia D-1 INTEIRO. Disparar durante o dia perderia o que sai depois do corte -- e perderia EM
// SILENCIO, porque quem recebe as 14h acredita que aquilo e o dia todo.
//
// AS RECUSAS QUE ESTA SUITE TRAVA (todas do mesmo tipo: nao afirmar o que nao se sabe):
//   1. SEM A CHAVE DO PROVEDOR ELE NAO FINGE QUE MANDOU -- e, principalmente, NAO MARCA ninguem
//      como notificado. No dia em que a chave entrar, nada foi perdido.
//   2. INDICE QUE NAO FECHOU O DIA NAO VIRA BOLETIM. Boletim curto e lido como "teve pouca
//      coisa"; ausencia de boletim e lida como "algo esta errado" -- que e a verdade ali.
//   3. `vistos_email` E SEPARADO de `vistos`. Se o e-mail carimbasse o `vistos`, o boletim das
//      5h "leria" o jornal pela pessoa e a tela diria "nada novo" as 8h sobre o que ela ainda
//      nao olhou. Dois leitores, duas memorias.
//   4. SO MARCA COMO VISTO SE O ENVIO DEU CERTO -- senao a licitacao some do proximo boletim sem
//      nunca ter chegado a ninguem.
//   5. NADA NOVO NAO VIRA E-MAIL: boletim vazio todo dia deixa de ser aberto.
//
//   node tests/testa_boletim.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const FN   = R('supabase', 'functions', 'enviar-boletim', 'index.ts');
const YML  = R('.github', 'workflows', 'boletim-diario.yml');
const DDL  = R('ddl', 'boletim.sql');
const TELA = R('fpmed_licitacoes.html');
const CFG  = R('supabase', 'config.toml');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_boletim — o boletim diario por e-mail\n');

// ══════════ 1. A REGRA DE OURO: O DIA FECHADO ══════════
ok('1. *** o dia padrao e ONTEM, nao hoje ***',
  /ontem\.setUTCDate\(ontem\.getUTCDate\(\) - 1\)/.test(FN));
ok('2. *** e ontem no fuso de GOIAS, nao no UTC ***',
  /Date\.now\(\) - 3 \* 3600 \* 1000/.test(FN) && /fuso de Goiás/.test(FN));
ok('3. ...com o motivo escrito (usar o dia UTC faria a madrugada falar do dia errado)',
  /faria o boletim de segunda falar de domingo/.test(FN));
ok('4. *** o cron e de madrugada: 08h UTC = 05h de Goias ***',
  /cron: '0 8 \* \* \*'/.test(YML) && /05h de Goiás/.test(YML));
ok('5. e a razao da regra de ouro esta no YML, nao so no codigo',
  /ESPERAR O DIA FECHAR/.test(YML) && /perderia EM SILÊNCIO/.test(YML));

// ══════════ 2. INDICE INCOMPLETO NAO VIRA BOLETIM ══════════
ok('6. *** confere `ultimo_dia_ok` antes de mandar qualquer coisa ***',
  /coleta_status\?fonte=eq\.PNCP&select=ultimo_dia_ok/.test(FN));
ok('7. *** e se o indice nao fechou o dia, NAO ENVIA e diz por que ***',
  /if \(!body\.forcar && \(!ultimoDiaOk \|\| ultimoDiaOk < dia\)\)/.test(FN)
  && /boletim NAO enviado de proposito/.test(FN));
ok('8. ...com o motivo (boletim curto e lido como "teve pouca coisa")',
  /Boletim vazio é lido como "não teve nada"/.test(FN));

// ══════════ 3. SEM A CHAVE, NAO FINGE ══════════
ok('9. *** sem RESEND_API_KEY nao manda e CONTA isso na resposta ***',
  /if \(!RESEND\) \{\s*\n\s*semChave\+\+;/.test(FN) && /chaveConfigurada: !!RESEND/.test(FN));
ok('10. *** e NAO marca `vistos_email` -- quando a chave entrar, nada foi perdido ***',
  /NÃO marca `vistos_email`: no dia em que a chave entrar, nada foi perdido/.test(FN));
ok('11. o YML trata "falta a chave" como AVISO, nao como X vermelho',
  /::warning::Boletim montado mas NAO enviado/.test(YML) && /X vermelho todo dia treina/.test(YML));

// ══════════ 4. AS DUAS MEMORIAS ══════════
ok('12. *** o delta do e-mail usa `vistos_email`, nunca o `vistos` da tela ***',
  /Array\.isArray\(j\.vistos_email\) \? j\.vistos_email : \[\]/.test(FN)
  && !/j\.vistos\b(?!_email)/.test(FN));
ok('13. a coluna nova existe e o DDL e ADITIVO',
  /add column if not exists vistos_email\s+jsonb/.test(DDL)
  && !/\b(delete|drop|truncate)\b/i.test(DDL.replace(/--[^\n]*/g, '')));
ok('14. *** e o motivo esta no DDL (um canal apagaria a novidade do outro) ***',
  /Um canal apagaria a novidade do outro/.test(DDL));
ok('15. `enviar_email` NASCE FALSE (jornal existente nao comeca a mandar sozinho)',
  /add column if not exists enviar_email\s+boolean not null default false/.test(DDL));
ok('16. `email_destino` nulo = e-mail do dono lido do auth, e o motivo esta dito',
  /Guardar uma cópia do e-mail aqui criaria um endereço que envelhece/.test(DDL));

// ══════════ 5. SO MARCA O QUE FOI ENVIADO ══════════
ok('17. *** so carimba `vistos_email` quando o envio DEU CERTO ***',
  /if \(deuCerto && !body\.teste\) \{\s*\n\s*patch\.vistos_email/.test(FN));
ok('18. ...e o motivo (sumiria do proximo boletim sem ter chegado a ninguem)',
  /sem nunca ter chegado a ninguém/.test(FN));
ok('19. *** envio de TESTE nao carimba nada ***', /!body\.teste/.test(FN) && /teste:/.test(YML));
ok('20. falha de envio fica REGISTRADA na linha do jornal (envio mudo vira "parou de chegar")',
  /ultimo_envio_erro: deuCerto \? null :/.test(FN)
  && /add column if not exists ultimo_envio_erro/.test(DDL));
// 11/08: a regra ganhou uma exceção, e a exceção é mais importante que a regra — SESSÃO DE HOJE
// faz o e-mail sair mesmo sem licitação nova. Antes disso, um dia sem novidade engolia o aviso
// de que havia sessão hoje: o item mais urgente do sistema morrendo por uma regra de outro assunto.
ok('21. *** nada novo NAO vira e-mail — mas sessao de hoje SAI assim mesmo ***',
  /if \(!novas\.length && !sessoes\.length\) \{ pulados\+\+;/.test(FN) && /deixa de ser aberto/.test(FN));

// ══════════ 6. A PORTA ══════════
ok('22. *** sem BOLETIM_TOKEN a funcao fica FECHADA (503), nunca aberta ***',
  /if \(!TOKEN\) return J\(\{ error: "BOLETIM_TOKEN nao configurado" \}, 503\)/.test(FN));
ok('23. token errado ou ausente = 401', /x-boletim-token"\) !== TOKEN\) return J\(\{ error: "nao autorizado" \}, 401\)/.test(FN));
ok('24. so aceita POST', /req\.method !== "POST"/.test(FN));
ok('25. *** a service_role vem da PLATAFORMA, nunca do CI ***',
  /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/.test(FN)
  && !/secrets\.[A-Za-z_]*SERVICE/i.test(YML) && !/eyJ/.test(YML));
ok('26. *** o token do boletim e SEPARADO do da coleta ***',
  /BOLETIM_TOKEN/.test(FN) && !/COLETA_TOKEN/.test(FN)
  && /CADA AGENDADOR TEM O SEU/.test(R('tools', 'deploy_edge.js')));
ok('27. o verify_jwt=false esta declarado no config.toml, nao so no deploy',
  /\[functions\.enviar-boletim\]\s*\nverify_jwt = false/.test(CFG));
ok('28. a funcao NUNCA apaga', !/method:\s*"DELETE"/.test(FN));
ok('29. duas rodadas do boletim nao se sobrepoem (mandaria o mesmo e-mail 2x)',
  /group: boletim-diario/.test(YML) && /cancel-in-progress: false/.test(YML));

// ══════════ 7. O E-MAIL, RODADO DE VERDADE ══════════
{
  // extrai as funcoes puras do TypeScript e roda em node — o mesmo codigo que vai pro ar
  const corpo = (nome) => {
    const i = FN.indexOf('function ' + nome + '(');
    let n = 0;
    for (let k = FN.indexOf('{', i); k < FN.length; k++) {
      if (FN[k] === '{') n++;
      else if (FN[k] === '}') { n--; if (!n) return FN.slice(i, k + 1); }
    }
    return '';
  };
  const semTipos = (s) => s.replace(/: unknown\b/g, '').replace(/: string\b/g, '').replace(/: any\[\]/g, '')
    .replace(/: number\b/g, '').replace(/\(s: unknown\)/g, '(s)').replace(/!/g, '');
  const ctx = (new Function(
    'const URL_SISTEMA = "https://exemplo/fpmed_licitacoes.html";'
    + semTipos(FN.slice(FN.indexOf('const semAcento ='), FN.indexOf('/* ══ O E-MAIL')))
    // `blocoSessoes` entrou em 11/08 e o `montaEmail` passou a chamá-lo: extrair só o segundo
    // deixaria a suíte vermelha por falta de dependência, e não por defeito.
    + semTipos(corpo('blocoSessoes'))
    + semTipos(corpo('montaEmail'))
    + 'return { montaEmail, blocoSessoes, semAcento, brl, dm, esc };'))();

  const html = ctx.montaEmail('Medicamentos GO', '2026-08-09', [
    { orgao: 'MUNICIPIO DE URUACU', municipio: 'Uruaçu', uf: 'GO', objeto: 'AQUISICAO DE MEDICAMENTOS',
      modalidade: 'Pregão Eletrônico', numero_compra: '90014', valor_estimado: 1234567, data_abertura: '2026-08-20T09:00:00' },
    { orgao: 'HOSPITAL X', objeto: 'SORO FISIOLOGICO', modalidade: 'Dispensa', valor_estimado: null },
  ], 7, 'palavras: medicamento · UF GO');

  ok('30. o e-mail traz o nome do jornal e o dia', /Medicamentos GO/.test(html) && /09\/08\/2026/.test(html));
  ok('31. ...e as linhas com orgao, objeto e valor', /URUACU/.test(html) && /R\$\s*1\.234\.567/.test(html), html.match(/R\$[^<]{0,16}/g));
  ok('32. *** valor ausente vira "valor não informado", nunca R$ 0,00 ***',
    /valor não informado/.test(html) && !/R\$\s*0\b/.test(html));
  ok('33. diz quantas sobraram, em vez de cortar calado', /e mais <b>7<\/b>/.test(html));
  ok('34. *** o rodape diz que A TELA E A AUTORIDADE (o numero daqui pode ser maior) ***',
    /<b>a tela é a autoridade<\/b>/.test(html.replace(/\s+/g, ' ')) && /filtros finos/.test(html));
  ok('35. ...e diz como parar de receber (assinatura sem saida vira spam)',
    /deixar de receber/.test(html));
  ok('36. estilo INLINE e zero imagem externa (cliente de e-mail corta folha e bloqueia imagem)',
    !/<style/.test(html) && !/<img/.test(html) && /style="/.test(html));
  ok('37. o HTML escapa o que vem do banco (o objeto e texto de terceiro)',
    ctx.esc('<script>x</script>').indexOf('<') < 0);
  ok('38. semAcento e o MESMO criterio da tela (senao o e-mail acha o que a tela nao acha)',
    ctx.semAcento('FARMACÊUTICO') === 'farmaceutico');
}

// ══════════ 8. A TELA ══════════
ok('39. *** a assinatura e POR JORNAL, com um clique, e reversivel ***',
  /function alternarEnvio\(id\)/.test(TELA) && /enviar_email: novo/.test(TELA));
ok('40. ...e o botao mostra o estado (ligado x desligado)',
  /'📧 e-mail ligado':'📧 e-mail'/.test(TELA));
ok('41. a tela explica que o boletim e do dia FECHADO',
  /dia\s*\n?\s*anterior <b>fechado<\/b>/.test(TELA.replace(/\s+/g, ' ')) || /anterior <b>fechado<\/b>/.test(TELA));
ok('42. *** o texto velho ("exige provedor contratado: esta fora") saiu ***',
  !/está fora até o Lemuel decidir/.test(TELA));
ok('43. falha do ultimo envio aparece na linha do jornal',
  /o último boletim não saiu/.test(TELA));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
