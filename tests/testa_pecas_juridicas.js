// SUITE testa_pecas_juridicas — PECA FORA DO PRAZO NAO E PECA FRACA: E PECA QUE NAO EXISTE.
//
// Modulo 2.9 da spec, 08/08/2026. Terceiro dos 14.
//
// >>> O QUE DECIDE ESTA TELA E O PRAZO, e nao a redacao. Impugnacao e esclarecimento tem prazo
//     em DIAS UTEIS antes da abertura (Lei 14.133/2021, art. 164). Recurso corre da sessao
//     (art. 165). O pregoeiro nem le peca protocolada fora do prazo -- entao um gerador que
//     escreve um texto lindo e deixa passar a data nao ajudou em nada. Por isso o prazo e a
//     PRIMEIRA coisa que a tela calcula e mostra.
//
// O QUE ESTA SUITE PROTEGE:
//   1. DIA UTIL, nao dia corrido. Contar corrido daria uma data mais cedo e faria a empresa
//      achar que perdeu prazo que ainda tem -- ou o contrario, que e pior.
//   2. A TELA ADMITE O QUE NAO SABE: feriado nao entra na conta, e ela DIZ isso. Uma tabela de
//      feriados municipais que ninguem mantem envelhece em silencio e passa a mentir com cara
//      de precisao.
//   3. O AVISO DE RESPONSABILIDADE E MAIS FORTE QUE O DA DECLARACAO: peca protocolada VINCULA
//      a empresa. Quem protocola responde pelo que esta escrito.
//   4. A IA NAO ESCREVE A TESE. O formulario e guiado (fatos/fundamento/pedido); quando o leitor
//      de edital entrar, ele preenche os FATOS -- a tese continua sendo de gente.
//
//   node tests/testa_pecas_juridicas.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');

const tela = ler('fpmed_pecas.html');
const ddl  = ler('ddl/pecas_juridicas.sql').replace(/--[^\n]*/g, '');
const sw   = ler('sw.js');

// extrai a funcao REAL de dias uteis e roda contra datas conhecidas
const src = tela.slice(tela.indexOf('function menosDiasUteis'), tela.indexOf('const brData'));
const menosDiasUteis = new Function(src + '; return menosDiasUteis;')();

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
console.log('SUITE testa_pecas_juridicas — o prazo primeiro, a redacao depois\n');

// ══════════ 1. A CONTA DE DIAS UTEIS, CONTRA DATAS REAIS ══════════
{
  // 2026-08-12 e uma QUARTA. 3 dias uteis antes = 2026-08-07 (sexta).
  ok('1. *** 3 dias uteis antes de quarta 12/08/2026 = sexta 07/08 ***',
    iso(menosDiasUteis('2026-08-12', 3)) === '2026-08-07', iso(menosDiasUteis('2026-08-12', 3)));
  // 2026-08-10 e uma SEGUNDA. 3 dias uteis antes = 2026-08-05 (quarta) -- pulando sabado e domingo.
  ok('2. *** o fim de semana NAO conta: 3 uteis antes de segunda 10/08 = quarta 05/08 ***',
    iso(menosDiasUteis('2026-08-10', 3)) === '2026-08-05', iso(menosDiasUteis('2026-08-10', 3)));
  // se contasse corrido, daria 07/08 (sexta) -- 2 dias a MAIS de prazo do que a empresa tem
  ok('3. ...e o resultado e DIFERENTE do dia corrido (era esse o erro que a conta evita)',
    iso(menosDiasUteis('2026-08-10', 3)) !== '2026-08-07');
  // 2026-08-13 e quinta; 1 dia util antes = quarta 12/08
  ok('4. um dia util antes de quinta 13/08 = quarta 12/08', iso(menosDiasUteis('2026-08-13', 1)) === '2026-08-12');
  ok('5. sem data de sessao nao inventa prazo', menosDiasUteis(null, 3) === null);
}

// ══════════ 2. O PRAZO NA TELA ══════════
ok('6. *** o prazo aparece antes de tudo, com a data limite ***', /function caixaPrazo\(\)/.test(tela) && /Prazo até/.test(tela));
ok('7. *** prazo vencido e dito com todas as letras ***', /PRAZO VENCIDO/.test(tela));
ok('8. ...e "acaba hoje" tem aviso proprio (o dia mais perigoso)', /O PRAZO ACABA HOJE/.test(tela));
ok('9. *** a tela ADMITE que feriado nao entra na conta ***',
  /Feriado não entra nesta conta/.test(tela) && /confira o calendário do órgão/.test(tela));
ok('10. ...e diz o que ela garante: sabado e domingo fora', /sábado e domingo fora/.test(tela));
ok('11. peca de sessao (intencao/recurso) nao finge calcular por data de abertura',
  /Este prazo corre na própria sessão/.test(tela));
ok('12. o prazo calculado e GRAVADO junto com a peca', /prazo_final: limite/.test(tela) && /prazo_final\s+date/.test(ddl));
ok('13. e o historico acusa peca cujo prazo venceu sem protocolo', /prazo venceu sem protocolo/.test(tela));

// ══════════ 3. RESPONSABILIDADE ══════════
ok('14. *** o aviso diz que e ESQUELETO, nao peca pronta ***', /esqueleto de peça, não uma peça pronta/.test(tela));
ok('15. *** e que quem protocola RESPONDE pelo que esta escrito ***',
  /quem protocola responde pelo que está\s+escrito/.test(tela.replace(/\s+/g, ' ')) || /quem protocola responde/.test(tela));
ok('16. ...e manda procurar advogado na duvida', /Em caso de dúvida, advogado/.test(tela));
ok('17. o aviso nao sai na impressao', /@media print\{[\s\S]{0,300}\.aviso-legal[^}]*display:none/.test(tela));
ok('18. o banco guarda quem revisou, e comeca nulo', /revisado_por\s+uuid/.test(ddl));
ok('19. a tela marca a peca que ninguem conferiu', /não conferida/.test(tela));

// ══════════ 4. O FORMULARIO GUIADO ══════════
ok('20. *** fatos, fundamento e pedido sao campos separados do texto final ***',
  /fatos\s+text/.test(ddl) && /fundamento\s+text/.test(ddl) && /pedido\s+text/.test(ddl)
  && /id="f-fatos"/.test(tela) && /id="f-fund"/.test(tela) && /id="f-pedido"/.test(tela));
ok('21. o texto final tambem e congelado, com a versao do modelo',
  /conteudo\s+text not null/.test(ddl) && /modelo_versao\s+text not null/.test(ddl));
ok('22. deixar fundamento/pedido em branco usa o padrao do tipo (nao sai buraco)',
  /v\('f-fund'\) \|\| SEL\.fundPadrao/.test(tela) && /v\('f-pedido'\) \|\| SEL\.pedidoPadrao/.test(tela));
ok('23. mas os FATOS nao tem padrao: eles sao do caso, e a tela pede',
  /\[DESCREVA OS FATOS/.test(tela));
ok('24. *** registrado que a IA NAO escreve a tese (pra ninguem achar que foi esquecimento) ***',
  /A IA NÃO ESCREVE ESTA PEÇA HOJE/.test(ler('ddl/pecas_juridicas.sql')));

// ══════════ 5. OS 5 TIPOS ══════════
{
  const ids = (tela.match(/\{ id:'([a-z_]+)'/g) || []).map(s => s.replace(/.*'([a-z_]+)'.*/, '$1'));
  ok('25. os 5 tipos da spec estao la',
    ['impugnacao','esclarecimento','intencao_recurso','recurso','contrarrazoes'].every(x => ids.includes(x)), ids);
  ok('26. e o banco so aceita esses 5', /check \(tipo in \('impugnacao','esclarecimento','intencao_recurso','recurso','contrarrazoes'\)\)/.test(ddl));
  ok('27. cada tipo cita o dispositivo do prazo', /art\. 164/.test(tela) && /art\. 165/.test(tela));
  ok('28. impugnacao e esclarecimento com 3 dias uteis (art. 164)',
    /id:'impugnacao', titulo:'Impugnação ao edital', prazoDias:3/.test(tela)
    && /id:'esclarecimento'[\s\S]{0,60}prazoDias:3/.test(tela));
}

// ══════════ 6. RLS E PORTAL ══════════
ok('29. RLS ligada', /alter table public\.pecas_juridicas enable row level security/.test(ddl));
ok('30. so gestor emite', /pj_ins[\s\S]{0,90}cargo_gestor\(\)/.test(ddl));
ok('31. anon revogado', /revoke all on public\.pecas_juridicas from anon/.test(ddl));
{
  for (const t of ['fpmed_licitacoes.html','fpmed_negocios.html','fpmed_documentos.html','fpmed_declaracoes.html']) {
    ok('32.' + t + ' tem a aba Peças', /href="fpmed_pecas\.html"/.test(ler(t)));
  }
  ok('33. a propria tela tem a barra do portal', /<nav class="portal">[\s\S]{0,500}href="fpmed_licitacoes\.html"/.test(tela));
  ok('34. entrou na casca do app', /'\.\/fpmed_pecas\.html'/.test(sw));
  ok('35. espera o gm-auth antes de consultar', /gm-auth-ready/.test(tela));
  ok('36. erro ao ler historico nao vira "nenhuma peca emitida"', /Não consegui ler o histórico/.test(tela));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
