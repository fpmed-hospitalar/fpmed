// SUITE testa_declaracoes — DECLARACAO E DOCUMENTO ASSINADO: O SISTEMA GERA, QUEM ASSINA CONFERE.
//
// Modulo 2.10 da spec, 08/08/2026. Segundo dos 14.
//
// O PROBLEMA REAL: todo edital exige o mesmo maco de declaracoes -- nao emprega menor, ME/EPP,
// fato impeditivo, proposta independente. Muda so a empresa, o orgao e o numero do processo.
// Hoje isso e copiar de um edital anterior no Word e trocar o cabecalho na mao, que e como o
// numero do processo do CONCORRENTE aparece na declaracao da FPMED.
//
// O QUE ESTA SUITE PROTEGE:
//   1. O AVISO DE REVISAO HUMANA E INEGOCIAVEL. Declaracao tem valor legal e e assinada; a
//      propria spec exige revisao. O sistema nao pode deixar alguem achar que GERAR e o mesmo
//      que CONFERIR. E o aviso NAO sai na impressao -- ele e pra quem opera, nao pro pregoeiro.
//   2. RAZAO SOCIAL E CNPJ VEM DO CONFIG, nunca digitados. Digitar a cada declaracao e como sai
//      declaracao com um digito errado no CNPJ -- e declaracao com CNPJ errado e invalida.
//   3. O TEXTO EMITIDO E CONGELADO, com a VERSAO do modelo que o gerou. Se a redacao melhorar
//      (ou a lei mudar), o que se imprime hoje nao pode deixar de ser o que foi assinado ontem.
//   4. ERRO DE LEITURA NAO VIRA "nenhuma declaracao emitida".
//
//   node tests/testa_declaracoes.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');

const tela = ler('fpmed_declaracoes.html');
const ddl  = ler('ddl/declaracoes.sql').replace(/--[^\n]*/g, '');
const sw   = ler('sw.js');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_declaracoes — o sistema gera, quem assina confere\n');

// ══════════ 1. O AVISO DE REVISAO HUMANA ══════════
ok('1. *** a tela avisa que e MODELO BASE, nao peca pronta ***',
  /Modelo base, não peça pronta/.test(tela));
ok('2. *** e manda conferir contra o EDITAL antes de assinar ***',
  /Confira o texto contra o edital antes de assinar/.test(tela));
ok('3. ...com a razao: o que vale e o instrumento convocatorio, nao o que o gerador supoe',
  /que está escrito no instrumento convocatório/.test(tela.replace(/\s+/g, ' ')));
ok('4. *** o aviso NAO sai na impressao (e pra quem opera, nao pro pregoeiro) ***',
  /@media print\{[\s\S]{0,400}\.aviso-legal[^}]*display:none/.test(tela));
ok('5. o banco guarda QUEM revisou, e comeca nulo (gerar != conferir)',
  /revisado_por\s+uuid/.test(ddl) && /revisado_em\s+timestamptz/.test(ddl));
ok('6. ...e a tela marca visivelmente a que ninguem conferiu', /não conferida/.test(tela));

// ══════════ 2. OS DADOS DA EMPRESA NAO SAO DIGITADOS ══════════
ok('7. *** razao social e CNPJ vem do config do cliente ***',
  /LIMEDTEC_CLIENTE\.empresa/.test(tela) && /EMP\.razaoSocial/.test(tela) && /EMP\.cnpj/.test(tela));
ok('8. ...e nao ha campo pra digitar CNPJ na tela', !/id="f-cnpj"/.test(tela));
ok('9. o cabecalho e montado num lugar so (senao um modelo sai sem o CNPJ e ninguem nota)',
  /function dadosEmpresa\(\)/.test(tela) && (tela.match(/\$\{e\.cab\}/g) || []).length >= 6);
ok('10. faltando dado, aparece o buraco em vez de sair em branco',
  /\[RAZÃO SOCIAL\]/.test(tela) && /\[CNPJ\]/.test(tela) && /\[NOME DO REPRESENTANTE\]/.test(tela));

// ══════════ 3. O TEXTO EMITIDO E CONGELADO ══════════
ok('11. *** o conteudo final e gravado, nao so os campos ***', /conteudo\s+text not null/.test(ddl));
ok('12. *** com a VERSAO do modelo que o gerou ***', /modelo_versao\s+text not null/.test(ddl) && /MODELO_VERSAO = '/.test(tela));
ok('13. e o que se grava e o TEXTO DA TELA (o operador pode ter editado)',
  /conteudo: document\.getElementById\('previa'\)\.innerText/.test(tela));
ok('14. a previa e editavel', /setAttribute\('contenteditable','true'\)/.test(tela));

// ══════════ 4. OS MODELOS ══════════
{
  const ids = (tela.match(/\{ id:'([a-z_]+)'/g) || []).map(s => s.replace(/.*'([a-z_]+)'.*/, '$1'));
  ok('15. os modelos comuns de edital estao la',
    ['menor','habilitacao','fato_impeditivo','proposta_independente','reserva_cargos','me_epp','servidor'].every(x => ids.includes(x)), ids);
  ok('16. *** e existe a personalizada (edital que pede redacao propria) ***', ids.includes('personalizada'));
  ok('17. cada modelo diz em que norma se apoia (sem isso ninguem confere)',
    (tela.match(/base:'/g) || []).length >= 8);
  ok('18. *** apoiados na Lei 14.133/2021, que e a lei vigente ***',
    /Lei 14\.133\/2021/.test(tela) && /14\.133/.test(tela));
  ok('19. o de menor cita o dispositivo certo (CF art. 7º, XXXIII)', /art\. 7º da Constituição Federal/.test(tela));
  ok('20. *** o de ME\/EPP avisa pra nao apresentar se a empresa nao for ***',
    /Se a empresa NÃO for ME\/EPP, esta declaração não deve ser apresentada/.test(tela));
}

// ══════════ 5. RLS ══════════
ok('21. RLS ligada', /alter table public\.declaracoes enable row level security/.test(ddl));
ok('22. todo logado LE (quem monta a proposta precisa saber o que ja foi declarado)',
  /dec_sel[\s\S]{0,90}using \(true\)/.test(ddl));
ok('23. *** so gestor EMITE (a declaracao e assinada por quem responde pela empresa) ***',
  /dec_ins[\s\S]{0,90}cargo_gestor\(\)/.test(ddl));
ok('24. anon revogado', /revoke all on public\.declaracoes from anon/.test(ddl));
ok('25. da pra amarrar a declaracao ao negocio do funil', /negocio_id\s+bigint references public\.negocios\(id\)/.test(ddl));

// ══════════ 6. A TELA NO PORTAL ══════════
{
  for (const t of ['fpmed_licitacoes.html', 'fpmed_negocios.html', 'fpmed_documentos.html']) {
    ok('26.' + t + ' tem a aba Declaracoes', /href="fpmed_declaracoes\.html"/.test(ler(t)));
  }
  ok('27. a propria tela carrega a barra do portal (caminho de volta)',
    /<nav class="portal">[\s\S]{0,400}href="fpmed_licitacoes\.html"/.test(tela));
  ok('28. entrou na casca do app instalado', /'\.\/fpmed_declaracoes\.html'/.test(sw));
  ok('29. espera o gm-auth antes de consultar (a raiz das travadas de 07/08)',
    /gm-auth-ready/.test(tela) && /if\(window\.gmAuth\) iniciar\(\)/.test(tela));
  ok('30. *** erro ao ler o historico NAO vira "nenhuma declaracao emitida" ***',
    /Não consegui ler o histórico/.test(tela));
  ok('31. imprime pelo navegador, como os outros PDFs do sistema', /window\.print\(\)/.test(tela));
  ok('32. na impressao sai so o documento (some menu, formulario e historico)',
    /@media print\{[\s\S]{0,400}\.barra-acoes[^}]*display:none/.test(tela));
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
