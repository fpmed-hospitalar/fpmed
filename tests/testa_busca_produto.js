// SUITE testa_busca_produto — A BUSCA POR PRODUTO, MEDIDA DE VERDADE (fatia A20, 14/08/2026).
//
// == O ACHADO QUE ESTA FATIA PRODUZIU ===========================================
// Buscar "equipo" — o equipo de soro, produto que a FPMED vende — devolvia 539
// licitacoes, e as primeiras eram pipoca, pula-pula, trio eletrico e frigobar.
// A causa nao e a busca: e o STEMMER do portugues, que reduz
//     equipo · equipamento · equipe
// ao MESMO radical `equip`. Provado pelos numeros: os TRES devolviam 539.
//
// >>> E ISSO E PIOR QUE O ZERO DA FATIA A8. La a busca dizia "nao achei" sobre um
//     pais que estava comprando — ruim, mas honesto na cara. Aqui ela devolve 539
//     resultados PLAUSIVEIS e quase todos errados. Resposta cheia e errada custa
//     mais tempo que resposta vazia, e ensina a nao confiar na ferramenta.
//
// == O QUE ESTA SUITE PROTEGE ===================================================
//  1. QUE O CONSERTO SEJA UMA LISTA, E NAO UMA REGRA GERAL. Medi 15 termos do
//     ramo: 14 tem 93-100% de confirmacao literal e UM tem 15%. Exigir palavra
//     inteira em tudo destruiria o que o radical faz de bom ("cateteres" achando
//     "cateter"). Trocar uma coisa boa por causa de uma excecao e como se perde
//     uma busca inteira para consertar um caso.
//  2. QUE O PLURAL CAIA NA MESMA LISTA. Na primeira versao a lista casava pelo
//     termo exato: "equipo" caiu para 35 e "equipos" ficou em 539. A busca
//     passaria a estar certa ou errada conforme a letra final.
//  3. QUE NENHUM SINONIMO INVENTE EQUIVALENCIA CLINICA. "albumina" nao e
//     "albumina bovina" (reagente de bancada) — e esse erro nao aparece como
//     erro, aparece como oportunidade.
//  4. QUE A LISTA E OS SINONIMOS CONTINUEM EDITAVEIS, em tabela e nao no codigo:
//     quem descobre que "equipo" traz pula-pula e quem usa a busca todo dia.
//
//   node tests/testa_busca_produto.js
'use strict';
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const DDL = R('ddl', 'busca_palavra_inteira.sql');
const MEDE = R('tools', 'mede_busca_produto.js');
const PROVA = R('tools', 'prova_busca_produto.js');

let p = 0, f = 0, n = 1;
const ok = (t, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + t + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_busca_produto — a busca por produto, medida de verdade (fatia A20)\n');

// ══════════ 1. A LISTA E UMA TABELA, E CADA LINHA TEM MOTIVO ══════════
ok(n + '. *** a lista de palavra inteira e TABELA, nao lista no codigo ***',
  /create table if not exists public\.busca_palavra_inteira/.test(DDL)); n++;
/* Lista sem motivo vira supersticao: ninguem sabe se ainda vale, e ninguem ousa tirar. */
ok(n + '. *** e a coluna `motivo` existe, com o comentario dizendo por que ***',
  /motivo\s+text/.test(DDL) && /supersti/i.test(DDL)); n++;
ok(n + '. *** o unico termo semeado e "equipo", com o NUMERO que o condenou ***',
  /values \('equipo'/.test(DDL) && /539/.test(DDL) && /15%/.test(DDL)); n++;
ok(n + '. *** o DDL e ADITIVO: nada de drop/truncate de TABELA ***',
  !/drop table|truncate|delete from/i.test(DDL)); n++;
/* O drop de FUNCAO esta la e e legitimo — funcao e codigo, nao acervo —, e o proprio arquivo
   diz isso em voz alta porque a palavra e a mesma que a regra de seguranca proibe. */
ok(n + '. ...e o unico `drop` e de FUNCAO, com a distincao escrita em voz alta',
  /drop function if exists public\.buscar_licitacoes/.test(DDL)
  && /função é\s+código, não acervo/.test(DDL)); n++;
ok(n + '. *** RLS ligada e anon revogado na tabela nova ***',
  /alter table public\.busca_palavra_inteira enable row level security/.test(DDL)
  && /revoke all on public\.busca_palavra_inteira from anon/.test(DDL)
  && /grant select on public\.busca_palavra_inteira to authenticated/.test(DDL)); n++;

// ══════════ 2. A CONFIRMACAO LITERAL SO EXISTE ONDE A LISTA MANDA ══════════
/* `\m` e `\M` sao inicio e fim de PALAVRA no regex do Postgres: `\m(equipo)s?\M` aceita "equipo"
   e "equipos" e recusa "equipamento" e "equipe". */
ok(n + '. *** o padrao usa fronteira de PALAVRA (\\m … \\M), e nao "contem" ***',
  /'\\m\(' \|\|/.test(DDL) && /\)s\?\\M'/.test(DDL)); n++;
/* Sem o `s?`, quem digitasse "equipo" deixaria de achar "equipos" — e a lista viraria um
   conserto que quebra outra coisa. */
ok(n + '. *** o plural continua achando (o `s?` no padrao) ***', /s\?\\M/.test(DDL)); n++;
/* FORA da lista, o padrao e NULL e NADA muda. Este e o assert que impede a lista de virar regra
   geral pela porta dos fundos. */
ok(n + '. *** fora da lista o padrao e NULL e a busca nao muda em nada ***',
  /\(select re from padrao\) is null\s*$/m.test(DDL)
  || (DDL.match(/\(select re from padrao\) is null/g) || []).length >= 3,
  (DDL.match(/\(select re from padrao\) is null/g) || []).length); n++;
ok(n + '. ...e a confirmacao vale nos DOIS lados: no objeto E na descricao do item',
  /unaccent\(lower\(coalesce\(i\.descricao, ''\)\)\) ~ \(select re from padrao\)/.test(DDL)
  && /unaccent\(lower\(coalesce\(l\.objeto, ''\)\)\) ~ \(select re from padrao\)/.test(DDL)); n++;

// ══════════ 3. O PLURAL CAI NA MESMA LISTA (o defeito medido) ══════════
/* Meio conserto e pior que conserto nenhum: a busca estaria certa ou errada conforme a pessoa
   digitasse a letra final, e ninguem descobriria por que. */
ok(n + '. *** o termo, OU ele sem o "s" final, casa com a lista ***',
  /b\.termo = regexp_replace\(\(select termo from normalizado\), 's\$', ''\)/.test(DDL)); n++;
ok(n + '. ...e o defeito esta REGISTRADO no arquivo, com os dois numeros',
  /"equipo" caiu de 539 para 35, e \*\*"equipos" continuou em 539\*\*/.test(DDL)); n++;
/* Sem o canonico, quem digitasse o plural perderia os sinonimos do singular — a mesma familia
   de defeito de novo, um degrau adiante. */
ok(n + '. *** os sinonimos sao procurados pelo termo CANONICO (senao o plural os perde) ***',
  /canonico as \(/.test(DDL) && /where s\.termo = \(select termo from canonico\)/.test(DDL)); n++;
/* Se a lista desligasse os sinonimos em silencio, cadastrar "equipo -> equipo macrogotas"
   passaria a nao ter efeito nenhum, e ninguem saberia. */
ok(n + '. *** e os sinonimos entram no padrao literal (a lista nao os desliga em silencio) ***',
  /select public\.unaccent\(lower\(s\.equivale\)\)[\s\S]{0,200}where s\.termo = \(select termo from canonico\)[\s\S]{0,120}\) y where t <> ''/.test(DDL)); n++;

// ══════════ 4. A LINHA CLINICA QUE NAO SE ATRAVESSA ══════════
/* "albumina" (hemoderivado) nao e "albumina bovina" (reagente de bancada). Medido nesta fatia:
   o primeiro resultado de "albumina" na base E "albumina de soro bovino (BSA)", num edital de
   BIOLOGIA MOLECULAR. A busca esta certa (a palavra esta la); o que seria errado e um SINONIMO
   juntando as duas — a tela ofereceria reagente a quem vende hemoderivado. */
const sinonimos = (DDL.match(/insert into public\.busca_sinonimos[\s\S]*?on conflict do nothing;/) || [''])[0];
ok(n + '. (controle) achei o bloco de sinonimos semeados', sinonimos.length > 200, sinonimos.length); n++;
ok(n + '. *** nenhum sinonimo semeado inventa equivalencia clinica ***',
  !/bovina|bovino|serica|reagente|laboratorio/i.test(sinonimos)); n++;
ok(n + '. *** e a proibicao esta ESCRITA, com o exemplo do dono ***',
  /"albumina" não é "albumina bovina"/.test(DDL) && /reagente de bancada/.test(DDL)); n++;
ok(n + '. ...e todo sinonimo semeado carrega `fonte`',
  (sinonimos.match(/'vocabulario do ramo/g) || []).length >= 7,
  (sinonimos.match(/'vocabulario do ramo/g) || []).length); n++;

// ══════════ 5. A FERRAMENTA DE MEDICAO SEPARA O QUE E DEFEITO DO QUE NAO E ══════════
/* O primeiro rascunho misturava grafia equivalente com refinamento e gritava em 5 de 10 termos —
   4 dos gritos eram sobre refinamento funcionando. Alarme que dispara sobre o certo e o alarme
   que se aprende a ignorar, e ai o quinto grito (o real) passa batido. */
ok(n + '. *** a medicao separa EQUIVALENTE (plural/acento) de REFINAMENTO (mais palavras) ***',
  /equivalentes:/.test(MEDE) && /refinamentos:/.test(MEDE)); n++;
ok(n + '. *** e so cobra igualdade das EQUIVALENTES (refinamento estreito nao e defeito) ***',
  /x\.tipo === 'equivalente'/.test(MEDE) && /a busca sendo "E"/.test(MEDE)); n++;
ok(n + '. *** os 10 termos do Natanael estao todos na medicao ***',
  ['albumina', 'dipirona', 'soro fisiológico', 'seringa', 'luva', 'equipo', 'cateter', 'gaze',
   'omeprazol', 'dieta enteral'].every(t => MEDE.includes(`produto: '${t}'`))); n++;
/* Cobertura silenciosa e o defeito que esta obra ja pagou tres vezes: o que a busca NAO faz tem
   que estar escrito, e nao arredondado. */
ok(n + '. *** o limite (busca por pedaco de palavra) e DECLARADO, e nao arredondado ***',
  /LIMITE DECLARADO/.test(MEDE) && /nunca meia palavra/.test(MEDE)); n++;
ok(n + '. *** a medicao sai com codigo de erro quando ha divergencia de equivalentes ***',
  /process\.exitCode = divergem \? 1 : 0/.test(MEDE)); n++;

// ══════════ 6. A PROVA CONFERE CONTRA O PNCP, E NAO CONTRA A PROPRIA COPIA ══════════
/* Conferir contra o banco provaria que o banco concorda com ele mesmo. */
ok(n + '. *** a prova abre a licitacao no PNCP AO VIVO e compara a descricao ***',
  /pncp\.gov\.br\/api\/pncp\/v1\/orgaos/.test(PROVA)
  && /String\(noPncp\.descricao\) === String\(achado\.descricao\)/.test(PROVA)); n++;
/* O objeto do PNCP e generico; o nome do produto mora no item. Provar com uma que casou pelo
   objeto seria provar a busca ANTIGA. */
ok(n + '. *** e escolhe uma que casou pelos ITENS (casar pelo objeto provaria a busca antiga) ***',
  /res\.find\(l => l\.casou_em !== 'objeto'\)/.test(PROVA)); n++;
ok(n + '. *** os tres casos sao escolhidos pelo que poem a prova, e o motivo esta escrito ***',
  /CASOS = \['equipo', 'albumina', 'gaze'\]/.test(PROVA)
  && /o que estava quebrado/.test(PROVA) && /Base pequena é onde um/.test(PROVA)); n++;

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exitCode = f ? 1 : 0;
