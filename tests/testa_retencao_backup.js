// SUITE testa_retencao_backup — `backups/` NÃO PODE CRESCER SEM FIM.
//
// Fatia A51 (01/09/2026). Nasceu de um número: a pasta chegou a **2.400 MB em 23 backups**, e
// passou a crescer ~1.090 MB POR VOLTA desde que a `licitacao_itens` (846 MB sozinha) entrou no
// backup pela primeira vez, na A49. Antes disso uma volta custava ~75 MB.
//
// >>> A CONTA QUE ASSUSTA: em 75 MB por volta, encher 100 GB levaria mais de mil voltas. Em
//     1.090 MB por volta, leva 92. O conserto do backup foi certo E deixou uma bomba-relógio,
//     porque ninguém tinha definido retenção — a pasta simplesmente nunca tinha sido grande.
//
// A regra (do arquiteto): os 3 backups mais recentes + o último de cada mês.
// Quem aplica é `tools/retencao_backup.js`, que MOVE para `backups/_a_remover/` e nunca apaga.
// Esta suíte é a catraca: ela falha quando a regra deixa de ser obedecida.
//
//   node tests/testa_retencao_backup.js
'use strict';
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'backups');
const PADRAO = /^backup_(\d{4})-(\d{2})-(\d{2})_(\d{4})$/;

// ── O TETO, E DE ONDE ELE SAIU (medido, não escolhido de olho) ──────────────────────────────
// Guardamos 3 backups. O maior medido até hoje é o de 01/09, com 1.089,7 MB. Três daquele
// tamanho dão 3.269 MB. O teto é 4.000 MB: cabe o pior caso de hoje com ~22% de folga para a
// base crescer, e ainda assim grita muito antes de a pasta virar problema de disco.
// Se este teto for estourado por crescimento honesto da base, NÃO o aumente no reflexo:
// meça primeiro se ainda faz sentido guardar 3 cópias inteiras.
//
// ╔══════════════════════════════════════════════════════════════════════════════════════════╗
// ║  ESTA CATRACA VAI FALHAR EM 03/10/2026, E ISSO ESTÁ PREVISTO — NÃO É DEFEITO NOVO.        ║
// ╚══════════════════════════════════════════════════════════════════════════════════════════╝
// Projetei a pasta rodando a PRÓPRIA regra volta a volta (A51, 01/09/2026), com o peso medido
// de 1.089,7 MB por backup:
//
//     hoje (01/09) .... 3 pastas ..... 1.562,3 MB
//     +2 voltas ....... 4 pastas ..... 3.509,7 MB   (entra o "último de agosto" permanente)
//     +32 voltas ...... 5 pastas ..... 4.599,4 MB   <<< ESTOURA, em 03/10/2026
//     +105 voltas ..... 7 pastas ..... 6.778,8 MB
//     +195 voltas ..... 10 pastas .... 10.047,9 MB  (março/2027)
//
// >>> A CAUSA NÃO É O TETO ESTAR BAIXO. É QUE A REGRA NÃO TEM TETO.
//     "os 3 mais recentes + o último de cada mês" guarda **um backup por mês, para sempre**.
//     A 1,09 GB cada, a pasta cresce ~1,09 GB por mês que passa — para sempre. Estabiliza em
//     nada. O que hoje parece resolvido só parece porque só existe UM mês na pasta.
//
//     Isto é a classe de defeito que se instala **pelo tempo e não pelo commit**, a mesma do
//     backup que quebrou em 30/08 por crescimento. Ninguém vai mexer em nada e um dia ela
//     falha sozinha. Quando falhar, é ISTO — não vá procurar o que quebrou.
//
// >>> A REGRA É DO ARQUITETO ("a decisão é minha, não sua"), então eu MEDI e não mudei.
//     A decisão que falta é dele, e são três caminhos: (a) pôr teto no "último de cada mês"
//     (ex.: só os 6 últimos meses); (b) guardar o mensal em forma reduzida em vez da cópia
//     inteira; (c) aceitar ~1,09 GB/mês por escrito e subir o teto com consciência.
//     Reprodução: `node _projeta_retencao_a51.js` (arquivo de medição, gitignorado).
const TETO_MB = 4000;
const GUARDAR_RECENTES = 3;

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
const mb = n => +(n / 1048576).toFixed(1);
function tamanho(d) {
  let t = 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const a = path.join(d, e.name);
    t += e.isDirectory() ? tamanho(a) : fs.statSync(a).size;
  }
  return t;
}

console.log('SUITE testa_retencao_backup — a pasta de backup tem teto\n');

ok('1. a pasta backups/ existe', fs.existsSync(DIR));
if (!fs.existsSync(DIR)) { console.log('\nRESULTADO: ' + p + ' ok, ' + (f + 1) + ' falha(s)'); process.exit(1); }

const datadas = fs.readdirSync(DIR, { withFileTypes: true })
  .filter(e => e.isDirectory() && PADRAO.test(e.name)).map(e => e.name).sort();

ok('2. há pelo menos um backup guardado (pasta vazia é pior que pasta cheia)', datadas.length > 0, datadas.length);

// Quantas PODEM existir: as N recentes + uma por mês presente. Não é número fixo — ele
// acompanha a passagem do tempo sozinho, senão a catraca envelheceria e viraria mentira.
const meses = new Set(datadas.map(n => n.slice(7, 14)));
const maximo = GUARDAR_RECENTES + meses.size;
ok(`3. *** a regra de retenção está sendo aplicada (máx. ${maximo}: ${GUARDAR_RECENTES} recentes + ${meses.size} mês/meses) ***`,
  datadas.length <= maximo, { tem: datadas.length, maximo });

const ativo = datadas.reduce((s, n) => s + tamanho(path.join(DIR, n)), 0);
console.log(`  (backups ativos: ${datadas.length} pasta(s), ${mb(ativo)} MB — teto ${TETO_MB} MB)`);
ok(`4. *** os backups ativos cabem no teto de ${TETO_MB} MB ***`, mb(ativo) <= TETO_MB, mb(ativo));

// ══════════════════════════════════════════════════════════════════════════════════════════
// A REGRA, PROVADA CONTRA MESES DE MENTIRA
// ══════════════════════════════════════════════════════════════════════════════════════════
// Os testes 1-4 acima olham a pasta REAL — e a pasta real tem UM mês só. Ou seja: metade da
// regra ("o último de cada mês") estava escrita e **nunca tinha rodado**. Ela só seria
// exercitada quando o calendário virasse, e aí ninguém estaria olhando. É a mesma classe de
// defeito que o backup levou em 30/08: o que se instala **pelo tempo e não pelo commit**.
// Aqui a regra roda em memória, com nomes inventados, sem tocar em disco nenhum.
const { decide } = require('../tools/retencao_backup.js');
const nomes = r => r.map(x => x.nome);

{
  // três meses, 3 backups em cada. Devem ficar: os 3 últimos + o último de julho + o de agosto
  // (o último de setembro já está entre os 3 recentes, então não conta duas vezes).
  const entrada = [
    'backup_2026-07-05_1000', 'backup_2026-07-15_1000', 'backup_2026-07-28_1000',
    'backup_2026-08-03_1000', 'backup_2026-08-14_1000', 'backup_2026-08-29_1000',
    'backup_2026-09-01_1000', 'backup_2026-09-02_1000', 'backup_2026-09-03_1000',
  ];
  const r = decide(entrada);
  ok('5. *** o último de JULHO sobrevive, mesmo com 6 backups mais novos que ele ***',
    nomes(r.fica).includes('backup_2026-07-28_1000'), nomes(r.fica));
  ok('6. ...e o último de AGOSTO também', nomes(r.fica).includes('backup_2026-08-29_1000'));
  ok('7. ...e os 3 mais recentes, os três', ['backup_2026-09-01_1000','backup_2026-09-02_1000','backup_2026-09-03_1000']
    .every(n => nomes(r.fica).includes(n)));
  ok('8. *** o do MEIO do mês sai (é o que faz a pasta parar de crescer) ***',
    nomes(r.sai).sort().join(',') === ['backup_2026-07-05_1000','backup_2026-07-15_1000','backup_2026-08-03_1000','backup_2026-08-14_1000'].join(','),
    nomes(r.sai));
  ok('9. nada é inventado nem perdido: fica + sai = tudo que entrou',
    r.fica.length + r.sai.length === entrada.length, { fica: r.fica.length, sai: r.sai.length });
}
{
  // ── ESTE BLOCO NASCEU DE UMA MUTAÇÃO QUE SOBREVIVEU ──────────────────────────────────────
  // Troquei o `.sort((a,b)=>a.nome.localeCompare(b.nome))` por um `.sort()` pelado e a suíte
  // continuou verde. Motivo: `.sort()` em objetos compara "[object Object]" com "[object
  // Object]" — não ordena nada — e todos os meus casos já chegavam em ordem cronológica. Ou
  // seja, eu estava provando a regra e **não** estava provando a ordenação.
  //
  // >>> POR QUE ISSO NÃO É DETALHE: `fs.readdirSync` NÃO garante ordem. Numa pasta que
  //     devolvesse embaralhado, "os 3 mais recentes" pegaria três quaisquer — e a ferramenta
  //     MOVERIA OS BACKUPS NOVOS para a quarentena, guardando os velhos. O erro mais caro
  //     possível nesta fatia, e passava verde.
  const desordem = [
    'backup_2026-09-03_1000', 'backup_2026-07-05_1000', 'backup_2026-09-01_1000',
    'backup_2026-08-14_1000', 'backup_2026-07-28_1000', 'backup_2026-09-02_1000',
    'backup_2026-08-29_1000', 'backup_2026-07-15_1000', 'backup_2026-08-03_1000',
  ];
  const r = decide(desordem);
  ok('5a. *** com a entrada EMBARALHADA, os 3 recentes ainda são os 3 mais NOVOS ***',
    ['backup_2026-09-01_1000','backup_2026-09-02_1000','backup_2026-09-03_1000']
      .every(n => r.recentes.has(n)) && r.recentes.size === 3, [...r.recentes]);
  ok('5b. *** ...e nenhum backup de setembro é mandado para a quarentena ***',
    !nomes(r.sai).some(n => n.startsWith('backup_2026-09')), nomes(r.sai));
  ok('5c. ...e o resultado embaralhado é IGUAL ao resultado em ordem',
    nomes(r.fica).slice().sort().join(',') ===
    nomes(decide(desordem.slice().sort()).fica).slice().sort().join(','));
}
{
  // a virada do ano: 2026-12 e 2027-01 são meses DIFERENTES. Ordenar por nome tem que respeitar.
  const r = decide(['backup_2026-12-20_1000', 'backup_2026-12-31_1000',
                    'backup_2027-01-02_1000', 'backup_2027-01-09_1000', 'backup_2027-01-20_1000']);
  ok('10. *** na virada do ano, dezembro guarda o SEU último (não some no janeiro) ***',
    nomes(r.fica).includes('backup_2026-12-31_1000'), nomes(r.fica));
  ok('11. ...e quem sai é o 20/12, não o 31/12', nomes(r.sai).join(',') === 'backup_2026-12-20_1000', nomes(r.sai));
}
{
  const r = decide(['backup_2026-09-01_1000', 'backup_2026-09-02_1000']);
  ok('12. com menos backups do que o mínimo, ninguém sai', r.sai.length === 0 && r.fica.length === 2);
  const vazio = decide([]);
  ok('13. pasta vazia não explode e não manda ninguém sair', vazio.fica.length === 0 && vazio.sai.length === 0);
  const lixo = decide(['_a_remover', 'fechamento', 'backup_2026-09-01_1000', 'nao_e_backup']);
  ok('14. *** o que não casa com o padrão é IGNORADO, nunca movido (a quarentena e a `fechamento` ficam em paz) ***',
    nomes(lixo.fica).join(',') === 'backup_2026-09-01_1000' && lixo.sai.length === 0,
    { fica: nomes(lixo.fica), sai: nomes(lixo.sai) });
}

// ══ A FIAÇÃO: a regra tem de ser CHAMADA, senão ela é um bilhete na geladeira ══════════════
// A regra e esta suíte existiam desde a A51 e NINGUÉM CHAMAVA a ferramenta. A pasta voltaria a
// crescer e a catraca cobraria do dono um passo manual — e o dono não é operador. Agora o
// próprio backup a chama. Isto aqui é para que essa linha não desapareça sem alguém notar.
const hook = fs.readFileSync(path.join(__dirname, '..', '.claude', 'hooks', 'backup_tabelas.js'), 'utf8');
ok('15. *** o backup CHAMA tools/retencao_backup.js --aplicar ao terminar ***',
  /retencao_backup\.js/.test(hook) && /--aplicar/.test(hook));
ok('16. *** ...e só quando o backup fechou COMPLETO (backup ruim não expulsa backup bom) ***',
  /if\s*\(\s*!falhas\.length\s*\)[\s\S]{0,600}retencao_backup\.js/.test(hook));
ok('17. ...e falha da retenção não derruba o backup, que já está no disco',
  /AVISO[\s\S]{0,80}backup esta salvo assim mesmo/.test(hook));

// A quarentena não falha o build: ela é do dono, e apagar é decisão dele. Mas ela precisa
// APARECER, senão vira um depósito silencioso que ninguém lembra de esvaziar.
const qDir = path.join(DIR, '_a_remover');
if (fs.existsSync(qDir)) {
  const q = fs.readdirSync(qDir).length, qb = mb(tamanho(qDir));
  console.log(`\n  AVISO (não é falha): backups/_a_remover/ tem ${q} pasta(s) e ${qb} MB esperando`);
  console.log('  a sua conferência. Nada ali foi apagado por máquina — apague você, quando quiser.');
}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
if (f) process.exit(1);
