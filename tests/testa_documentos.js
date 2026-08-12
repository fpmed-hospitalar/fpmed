// SUITE testa_documentos — CERTIDAO VENCIDA E O JEITO MAIS BOBO DE PERDER LICITACAO.
//
// Modulo 2.6 da spec, 08/08/2026 — o primeiro dos 14 a entrar.
// A empresa faz tudo certo (acha o edital, monta o preco, vai a sessao) e e desclassificada
// porque uma CND venceu ha tres dias. Nao e falta de sistema, e falta de alguem olhando um
// prazo -- e e exatamente o que software resolve bem.
//
// O QUE ESTA SUITE PROTEGE:
//   1. A CONTA DE DIAS MORA NUM LUGAR SO (a view do banco). Se a tela e o sino calculassem cada
//      um o seu, um diria "vence em 5 dias" e o outro "vencido" no mesmo dia. Foi exatamente
//      esse par -- duas implementacoes da mesma regra -- que custou caro no preco unitario.
//   2. ERRO DE LEITURA NAO VIRA "ESTA TUDO CERTO". Com o banco fora, o sino tem que dizer
//      "nao sei", nunca "nenhuma certidao vencendo" -- a mesma licao do resto do projeto.
//   3. O ARQUIVO E TAO PROTEGIDO QUANTO A FICHA. Bucket privado + policies simetricas as da
//      tabela: se o arquivo fosse mais frouxo, bastaria adivinhar o caminho pra ler o balanco.
//   4. `dias_aviso` E POR DOCUMENTO. Certidao federal sai em minutos, alvara da vigilancia leva
//      semanas; avisar os dois com a mesma antecedencia trata como iguais coisas que nao sao.
//
//   node tests/testa_documentos.js
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');

/* ── ALCANCE (12/08, navegação única) ──────────────────────────────────────────────────────
   A barra do portal morreu: as sete entradas dela agora saem só do menu lateral. Estes asserts
   sempre protegeram "há caminho daqui pra tela X", e não "existe uma <nav class=portal>" — a
   barra era o MEIO, o alcance é o FIM. O predicado abaixo aceita os dois meios e não afrouxa
   nenhum: pelo menu, exige que a tela MONTE o menu, CARREGUE o script, e que o destino esteja
   declarado lá. Três condições, não uma. */
const _MENU_SRC = require('fs').readFileSync(require('path').join(raiz, 'limedtec-menu.js'), 'utf8');
const alcanca = (src, destino) => {
  const d = destino.replace(/\./g, '\\.');
  if (new RegExp('href="' + d + '"').test(src)) return true;             // caminho direto na tela
  return /limedtec-menu\.js/.test(src)                                   // a tela carrega o menu
      && /data-limedtec-menu/.test(src)                                  // ...e o monta
      && new RegExp("href: '" + d + "'").test(_MENU_SRC);                // ...e o menu leva lá
};

const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');

const tela = ler('fpmed_documentos.html');
const neg  = ler('fpmed_negocios.html');
const lic  = ler('fpmed_licitacoes.html');
const sw   = ler('sw.js');
const semC = s => s.replace(/--[^\n]*/g, '');
const ddl  = semC(ler('ddl/documentos.sql'));
const sto  = semC(ler('ddl/documentos_storage.sql'));

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_documentos — habilitacao em dia, e o aviso antes do prazo\n');

// ══════════ 1. O BANCO ══════════
ok('1. tabela documentos criada com `if not exists` (seguro re-rodar)', /create table if not exists public\.documentos/.test(ddl));
ok('2. *** validade pode ser NULA (contrato social nao vence) ***', /validade\s+date,/.test(ddl));
ok('3. *** dias_aviso e POR DOCUMENTO, com faixa sensata ***',
  /dias_aviso\s+integer not null default 30 check \(dias_aviso >= 0 and dias_aviso <= 365\)/.test(ddl));
ok('4. o arquivo NAO fica na tabela: guarda-se o caminho', /arquivo_path\s+text/.test(ddl) && !/bytea/.test(ddl));
ok('5. empresa_id desde o comeco (a spec e multi-empresa e o modelo daqui ja e)',
  /empresa_id\s+bigint references public\.empresas\(id\)/.test(ddl));
ok('6. documento substituido some da lista sem sumir do historico (`ativo`)', /ativo\s+boolean not null default true/.test(ddl));

// ══════════ 2. A CONTA DE DIAS, NUM LUGAR SO ══════════
ok('7. *** existe a view que classifica a situacao ***', /create or replace view public\.v_documentos_situacao/.test(ddl));
ok('8. ...com os 4 estados, e `sem_validade` separado de `ok`',
  /'sem_validade'/.test(ddl) && /'vencido'/.test(ddl) && /'vencendo'/.test(ddl) && /'ok'/.test(ddl));
ok('9. *** "vencendo" respeita o dias_aviso DAQUELE documento ***',
  /d\.validade <= current_date \+ d\.dias_aviso/.test(ddl));
ok('10. a view herda a RLS de quem consulta (nao vira porta lateral)', /security_invoker = on/.test(ddl));
ok('11. *** a TELA nao recalcula: le a situacao da view ***',
  /v_documentos_situacao/.test(tela) && !/dias_para_vencer\s*=/.test(tela));
ok('12. *** e o SINO le a MESMA view (nao ha segunda conta) ***', /v_documentos_situacao/.test(neg));

// ══════════ 3. RLS E O ARQUIVO ══════════
ok('13. RLS ligada', /alter table public\.documentos enable row level security/.test(ddl));
ok('14. todo logado LE (o vendedor precisa saber se a certidao vale)', /doc_sel[\s\S]{0,90}using \(true\)/.test(ddl));
ok('15. *** so gestor escreve ***', /doc_ins[\s\S]{0,90}cargo_gestor\(\)/.test(ddl));
ok('16. anon revogado na tabela E na view', /revoke all on public\.documentos from anon/.test(ddl) && /revoke all on public\.v_documentos_situacao from anon/.test(ddl));
ok('17. *** o STORAGE tem as 4 policies (bucket privado sem policy = ninguem sobe nem le) ***',
  ['docs_storage_le','docs_storage_sobe','docs_storage_troca','docs_storage_apaga'].every(n => sto.includes(n)));
ok('18. *** e elas sao SIMETRICAS a tabela: le todo logado, escreve so gestor ***',
  /docs_storage_le[\s\S]{0,140}using \(bucket_id = 'documentos'\)/.test(sto) &&
  /docs_storage_sobe[\s\S]{0,160}cargo_gestor\(\)/.test(sto));
ok('19. *** toda policy filtra por bucket_id (senao valeria pra qualquer bucket futuro) ***',
  (sto.match(/bucket_id = 'documentos'/g) || []).length >= 4);
ok('20. o link do arquivo e ASSINADO e curto, nao publico', /storage\/v1\/object\/sign/.test(tela) && /expiresIn: 60/.test(tela));

// ══════════ 4. A TELA ══════════
// >>> REAPONTADO EM 12/08: a BARRA DO PORTAL morreu nas duas telas (navegacao unica pelo menu
//     lateral). A promessa e "da pra chegar em Documentos das outras duas telas do modulo" — a
//     barra era o meio. O `alcanca` cobra as tres condicoes: a tela carrega o menu, monta o menu,
//     e o menu declara o destino.
ok('21. da pra chegar em Documentos das outras duas telas do modulo',
  alcanca(lic, 'fpmed_documentos.html') && alcanca(neg, 'fpmed_documentos.html'));
ok('22. ...e ela mesma carrega a barra do portal (o caminho de volta)',
  /<nav class="portal">[\s\S]{0,300}href="fpmed_licitacoes\.html"/.test(tela));
ok('23. *** a regua de situacao vem ANTES da lista (a pergunta e "tem algo vencido?") ***',
  tela.indexOf('id="reguas"') < tela.indexOf('id="lista"'));
ok('24. *** erro de leitura NAO vira "nenhum documento cadastrado" ***',
  /Não consegui ler os documentos/.test(tela));
ok('25. ...e a lista vazia de verdade sugere por onde comecar',
  /Nenhum documento cadastrado ainda/.test(tela) && /CND Federal, FGTS, Trabalhista/.test(tela));
ok('26. espera o gm-auth antes de consultar (a raiz das travadas de 07/08)',
  /gm-auth-ready/.test(tela) && /if\(window\.gmAuth\) iniciar\(\)/.test(tela));
ok('27. entrou na casca do app instalado', /'\.\/fpmed_documentos\.html'/.test(sw));

// ══════════ 5. O SINO — o bloco que estava registrado como IMPOSSIVEL ══════════
ok('28. *** o aviso de "depende de Meus Documentos, que nao existe" SAIU ***',
  !/depende de “Meus Documentos”, que não existe/.test(neg));
ok('29. *** documento vencido/vencendo aparece no sino ***',
  /d\.situacao === 'vencido' \|\| d\.situacao === 'vencendo'/.test(neg));
ok('30. *** e vem ANTES das sessoes: certidao vencida DESCLASSIFICA, sessao de hoje ainda da pra correr ***',
  /habilitação — resolver antes da próxima sessão[\s\S]{0,700}\n\s*\+ h;/.test(neg), 'o bloco de documentos deve ser PREFIXADO em h');
ok('31. *** falha ao ler documento vira "NAO SEI", nunca "esta tudo certo" ***',
  /DOCS === 'erro'/.test(neg) && /não sei<\/b> se há certidão vencendo/.test(neg));
ok('32. os 3 estados de DOCS sao distintos (null ≠ erro ≠ lista)',
  /let DOCS = null;/.test(neg) && /DOCS = rd\.ok \? await rd\.json\(\) : 'erro'/.test(neg));
ok('33. *** documento entra no BADGE (fica aceso ate alguem resolver) ***',
  /const docsRuins = Array\.isArray\(DOCS\)/.test(neg) && /n\.urgentes \+ docsRuins/.test(neg));
ok('34. ...e a razao de a sessao atrasada NAO entrar continua escrita (nao tem mais conserto)',
  /NÃO TEM MAIS CONSERTO/.test(neg));
ok('35. a leitura de documento nao derruba o funil se falhar (chamada separada)',
  /o funil — que é o motivo de a tela existir — continua abrindo/.test(neg));

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
