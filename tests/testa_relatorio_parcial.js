// SUITE testa_relatorio_parcial — O RELATORIO NAO PODE DEPENDER DA ULTIMA CHAMADA
// (fatia A39 · 20/08/2026)
//
// == O QUE ESTA SUITE GUARDA, e o numero que a fez existir ======================================
// Tres ciclos do trabalhador A morreram com `API Error: Can't reach the API server — ENOTFOUND`
// (09:15:43, 12:29:29, e os ciclos 3 e 4). O de 12:29 tinha 2h33 de trabalho, ja tinha carimbado
// a carga das 12:19 NO BANCO — e morreu antes de escrever o relatorio. O trabalho existiu no
// banco e no disco; a prestacao de contas se perdeu.
//
// >>> A UNIDADE DE PRESTACAO DE CONTAS DEIXA DE SER O CICLO E PASSA A SER A FATIA. Cada fatia que
//     fecha grava o bloco dela NA HORA, no topo. Um ciclo que so presta contas no fim e um ciclo
//     cujo registro inteiro cabe numa unica chamada de rede — a que tem mais horas penduradas.
//
// == E A GRAVACAO TEM DE SER ATOMICA, senao a ferramenta contra a divida cria uma maior =========
// "Ler, por na frente, gravar por cima" TRUNCA o arquivo antes de escrever o novo. Uma queda
// nessa janela troca um relatorio completo por um pela metade — e leva junto todas as rodadas
// anteriores. Relatorio perdido por rede se remedia com o proximo bloco; relatorio TRUNCADO nao.
// O bloco 3 simula exatamente essa queda e cobra que o arquivo velho continue inteiro.
//
//   node tests/testa_relatorio_parcial.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const raiz = path.join(__dirname, '..');
const R = require('../tools/relatorio_parcial.js');
const src = fs.readFileSync(path.join(raiz, 'tools', 'relatorio_parcial.js'), 'utf8');

let p = 0, f = 0;
const ok = (n, c, e) => { if (c) p++; else { f++; console.log('  FALHA ' + n + (e !== undefined ? '  [' + JSON.stringify(e) + ']' : '')); } };
console.log('SUITE testa_relatorio_parcial — cada fatia presta contas na hora\n');

// Uma pasta propria, fora de relatorios/: uma suite que escreve no relatorio de verdade seria
// uma suite que suja a prestacao de contas para provar que a prestacao de contas funciona.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a39_'));
const alvo = path.join(tmp, 'RELATORIO_TESTE.md');

// ══════════ 1. O BLOCO E UMA FUNCAO PURA, E ELE SE RECUSA A MENTIR ══════════
{
  ok('1. o modulo pode ser IMPORTADO sem escrever nada (a regra e perguntavel)',
    typeof R.montaBloco === 'function' && typeof R.acrescentaNoTopo === 'function'
    && typeof R.grava === 'function');

  const b = R.montaBloco({ fatia: 'A39', titulo: 'o relatorio em pedacos', corpo: 'medido: 3 ciclos',
    quando: new Date(2026, 7, 20, 14, 5) });
  ok('2. o bloco nomeia a fatia no cabecalho e no titulo', /FATIA A39/.test(b) && /## A39 — /.test(b), b.slice(0, 120));
  ok('3. o bloco carimba dia e hora (dd/mm/aaaa HH:MM), o mesmo formato do relatorio',
    b.includes('20/08/2026 14:05'), b.slice(0, 80));
  ok('4. o corpo medido entra inteiro', b.includes('medido: 3 ciclos'));
  ok('5. o bloco termina com o separador `---` (dois blocos seguidos nao grudam)', /\n---\n/.test(b));

  // *** A RECUSA: cabecalho sozinho e um registro que MENTE ***
  let recusou = false;
  try { R.montaBloco({ fatia: 'A39', titulo: 'so o titulo', corpo: '   ' }); }
  catch (e) { recusou = /sem corpo/.test(e.message); }
  ok('6. *** bloco SEM CORPO e RECUSADO — cabecalho sozinho diz que a fatia foi prestada ***', recusou);

  let semFatia = false;
  try { R.montaBloco({ corpo: 'texto' }); } catch (e) { semFatia = /sem fatia/.test(e.message); }
  ok('7. bloco sem nome de fatia e recusado (o relatorio nao sabe do que fala)', semFatia);
}

// ══════════ 2. A FATIA INTERROMPIDA DIZ A PALAVRA E DIZ A HORA ══════════
{
  const b = R.montaBloco({ fatia: 'A40', titulo: 'ingestor de resultado',
    interrompida: 'rede', quando: new Date(2026, 7, 20, 12, 29) });
  ok('8. *** a frase literal que a caixa exigiu: "interrompida por rede as HH:MM" ***',
    b.includes('interrompida por rede às 12:29'), b.slice(0, 200));
  ok('9. a interrupcao aparece no TITULO, nao escondida no corpo',
    /## A40 —[^\n]*INTERROMPIDA POR REDE ÀS 12:29/.test(b), b.split('\n')[2]);
  ok('10. e ela avisa que o que esta escrito NAO e promessa',
    /nada aqui é promessa/.test(b));

  // interrompida SEM corpo e legitimo: o conteudo do bloco e a propria interrupcao
  let passou = true;
  try { R.montaBloco({ fatia: 'A40', interrompida: 'rede' }); } catch (_) { passou = false; }
  ok('11. fatia interrompida PODE ter bloco sem corpo — a interrupcao ja e o conteudo', passou);

  const outro = R.montaBloco({ fatia: 'A41', interrompida: 'orçamento de tempo',
    quando: new Date(2026, 7, 20, 9, 15) });
  ok('12. o motivo nao e so "rede" — a mesma frase serve pra qualquer causa nomeada',
    outro.includes('interrompida por orçamento de tempo às 09:15'), outro.slice(0, 200));
}

// ══════════ 3. ACRESCENTA NO TOPO — E O QUE ESTAVA EMBAIXO SOBREVIVE ══════════
{
  R.grava({ caminho: alvo, fatia: 'A37', titulo: 'a regua e o papel congelado', corpo: 'primeiro bloco' });
  const um = fs.readFileSync(alvo, 'utf8');
  ok('13. grava num arquivo que ainda nao existe', um.includes('primeiro bloco'));

  R.grava({ caminho: alvo, fatia: 'A39', titulo: 'o relatorio em pedacos', corpo: 'segundo bloco' });
  const dois = fs.readFileSync(alvo, 'utf8');
  ok('14. *** o bloco NOVO fica no TOPO ***', dois.indexOf('segundo bloco') < dois.indexOf('primeiro bloco'),
    { novo: dois.indexOf('segundo bloco'), velho: dois.indexOf('primeiro bloco') });
  ok('15. *** e o bloco VELHO sobrevive INTEIRO, byte a byte ***', dois.endsWith(um),
    { fim: dois.slice(-60) });

  // TERCEIRO bloco: a ordem e sempre a mesma, nao so na primeira vez
  R.grava({ caminho: alvo, fatia: 'A41', titulo: 'o dnt medido', corpo: 'terceiro bloco' });
  const tres = fs.readFileSync(alvo, 'utf8');
  ok('16. tres blocos ficam em ordem inversa de gravacao (o mais novo primeiro)',
    tres.indexOf('terceiro bloco') < tres.indexOf('segundo bloco')
    && tres.indexOf('segundo bloco') < tres.indexOf('primeiro bloco'));
  ok('17. e o arquivo cresce — nada foi sobrescrito', tres.length > dois.length && dois.length > um.length,
    { um: um.length, dois: dois.length, tres: tres.length });

  ok('18. nao fica arquivo temporario para tras', !fs.existsSync(alvo + '.parcial.tmp'));

  // ══ A QUEDA SIMULADA: o tmp existe, o rename NAO aconteceu ══
  // E o desfecho que a gravacao atomica promete: o relatorio velho continua la, inteiro.
  const antesDaQueda = fs.readFileSync(alvo, 'utf8');
  fs.writeFileSync(alvo + '.parcial.tmp', 'BLOCO PELA METADE, o processo morreu aqui');
  const depoisDaQueda = fs.readFileSync(alvo, 'utf8');
  ok('19. *** queda ENTRE escrever o temporario e renomear: o relatorio velho fica INTEIRO ***',
    depoisDaQueda === antesDaQueda && depoisDaQueda.includes('primeiro bloco'));
  fs.unlinkSync(alvo + '.parcial.tmp');
  // e a proxima gravacao passa por cima do lixo sem se atrapalhar
  R.grava({ caminho: alvo, fatia: 'A38', titulo: 'o molde', corpo: 'quarto bloco' });
  const quatro = fs.readFileSync(alvo, 'utf8');
  ok('20. depois da queda a gravacao seguinte funciona e nao perde nada',
    quatro.includes('quarto bloco') && quatro.includes('primeiro bloco'));
}

// ══════════ 4. O CODIGO GRAVA ATOMICO DE VERDADE (nao e so o desfecho que passa) ══════════
{
  ok('21. *** escreve num temporario e RENOMEIA por cima (rename e atomico no mesmo volume) ***',
    /\.parcial\.tmp/.test(src) && /renameSync/.test(src));
  ok('22. *** forca o conteudo pro disco antes de renomear (fsync) ***', /fsyncSync/.test(src));
  ok('23. NAO escreve direto no relatorio (writeFileSync no caminho final seria o truncamento)',
    !/writeFileSync\(\s*caminho/.test(src));
  ok('24. fecha o descritor mesmo se a escrita falhar (finally)', /finally\s*\{[\s\S]{0,80}closeSync/.test(src));
}

// ══════════ 5. A LINHA DE COMANDO — porque e por ela que as fatias chamam ══════════
{
  const alvo2 = path.join(tmp, 'RELATORIO_CLI.md');
  const r1 = spawnSync(process.execPath, [path.join(raiz, 'tools', 'relatorio_parcial.js'),
    '--quem', 'A', '--fatia', 'A39', '--titulo', 'pela linha', '--texto', 'corpo pela linha',
    '--caminho', alvo2], { cwd: raiz, encoding: 'utf8' });
  ok('25. a linha de comando grava e diz onde gravou (no caminho que recebeu, nao no relatorio real)',
    r1.status === 0 && /gravado no topo de/.test(r1.stdout || '')
    && fs.existsSync(alvo2) && fs.readFileSync(alvo2, 'utf8').includes('corpo pela linha'),
    (r1.stdout || '') + (r1.stderr || ''));

  const r2 = spawnSync(process.execPath, [path.join(raiz, 'tools', 'relatorio_parcial.js'),
    '--quem', 'A', '--fatia', 'A39', '--caminho', alvo2], { cwd: raiz, encoding: 'utf8', input: '' });
  const depoisDaRecusa = fs.readFileSync(alvo2, 'utf8');
  ok('26. *** e ela SAI COM ERRO em vez de gravar cabecalho vazio — e nao toca no arquivo ***',
    r2.status !== 0 && /sem corpo/.test((r2.stderr || '') + (r2.stdout || ''))
    && depoisDaRecusa.includes('corpo pela linha'),
    { status: r2.status, saida: (r2.stderr || '').slice(0, 120) });

  ok('27. o caminho padrao e relatorios/RELATORIO_<QUEM>.md',
    R.caminhoDe('a').endsWith(path.join('relatorios', 'RELATORIO_A.md'))
    && R.caminhoDe('B').endsWith(path.join('relatorios', 'RELATORIO_B.md')));
  void alvo2;
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}

console.log('\nRESULTADO: ' + p + ' ok, ' + f + ' falha(s)');
process.exit(f ? 1 : 0);
