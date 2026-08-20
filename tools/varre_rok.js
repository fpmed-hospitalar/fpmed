/* ═══════════════════════════════════════════════════════════════════════════════════════════
   varre_rok.js — A FAMÍLIA DO `r.ok`, VARRIDA NO TERRITÓRIO DO A (fatia A36, 20/08/2026)

   ══ O DEFEITO QUE MANDOU FAZER ISTO, e ele foi achado pelo B na Proposta ════════════════════
   Num 401 o PostgREST não devolve uma LISTA — devolve um OBJETO de erro
   (`{"code":"42501","message":"permission denied"}`). O código fazia:

       const j = await r.json();
       if (!Array.isArray(j)) break;        // <- sai do laço, calado
       ...
       // e adiante: "0 itens", com distintivo VERDE

   Ou seja: a leitura que FALHOU seguiu como leitura que TERMINOU. O `Array.isArray` foi usado
   como prova de sucesso, e ele não é — ele é prova de FORMA. Toda resposta de erro do PostgREST
   é um objeto bem formado, e todo objeto bem formado passa por qualquer teste de forma.

   ══ AS TRÊS FORMAS DA MESMA FAMÍLIA, e a varredura procura as três ══════════════════════════
   1. `fetch` cujo resultado nunca é conferido (`r.ok` / `r.status` não aparecem);
   2. `Array.isArray` (ou `.length`) usado como se fosse prova de sucesso, quando o `r.ok`
      daquele mesmo `fetch` não foi conferido;
   3. laço que SAI (break/return) sem registrar nada — o "silêncio" da lição.

   ══ POR QUE A VARREDURA EXISTE COMO FERRAMENTA, E NÃO COMO LEITURA À MÃO ════════════════════
   Porque o território tem 28 `fetch` só nas telas e mais de cem nos `tools/`, e porque a
   pergunta volta: toda vez que alguém escrever um `fetch` novo, a mesma varredura responde de
   novo. Ler à mão uma vez responde hoje e não responde amanhã.

   >>> E ELA É PROVADA NAS DUAS DIREÇÕES ANTES DE OLHAR O CÓDIGO DE VERDADE (`--prova`). Um
       detector que não acha nada é indistinguível de um detector quebrado — foi a lição da A31,
       em que oito catracas deram verde sobre 320 linhas que elas não estavam lendo.

     node tools/varre_rok.js            (o território do A)
     node tools/varre_rok.js --prova    (só a prova do detector, nas duas direções)
     node tools/varre_rok.js --tudo     (inclui tools/ e supabase/functions)
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const tem = n => process.argv.includes(n);

/* ══ O TERRITÓRIO DO A, ESCRITO E NÃO DEDUZIDO ═══════════════════════════════════════════════
   A lista é explícita porque a fronteira é de CAIXA, não de pasta: `fpmed_negocios.html` mora ao
   lado e é do B. Varrer por glob traria as telas dele e eu estaria consertando território alheio
   — que é o jeito mais rápido de as duas janelas se atropelarem no mesmo commit. */
const TELAS_E_LIBS = [
  'fpmed_licitacoes.html', 'limedtec-menu.js', 'fpmed_teto_cmed.js', 'fpmed_leitor_motor.js',
  'fpmed_alarme_coleta.js', 'limedtec-config.js', 'limedtec-sessao.js', 'limedtec-licenca.js',
  'limedtec-papeis.js', 'limedtec-pwa.js', 'gm-auth.js',
];
const FERRAMENTAS = ['tools/coleta_pncp.js', 'tools/coleta_itens_lote.js', 'tools/coleta_pncp_busca.js',
  'tools/preenche_prazo.js', 'tools/watchdog_pncp.js', 'tools/coleta_editais.js',
  'tools/coleta_resultados.js', 'tools/carga_diaria.js', 'tools/valida_controle_pncp.js'];

/* Comentário é PROSA. Varrer com o comentário dentro faria a explicação de por que o
   `Array.isArray` não é prova reprovar o arquivo que a explica — o defeito que esta casa já
   achou cinco vezes (régua do A na B22, mutação do B na B25). */
const semComentario = s => s
  .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/^([ \t]*)\/\/.*$/gm, (m, a) => a + ' '.repeat(Math.max(0, m.length - a.length)));

const linhaDe = (s, i) => s.slice(0, i).split('\n').length;

/* ══ O RECORTE: DE UM `fetch(` ATÉ O FIM DA CHAMADA, E DEPOIS A JANELA DE CONFERÊNCIA ════════
   ══ E A JANELA TEM DOIS TAMANHOS, PORQUE HÁ DOIS NÍVEIS DE CERTEZA ═══════════════════════════
   Quando o `fetch` tem uma VARIÁVEL que o recebe, a busca é por `<nome>.ok` — e esse casamento é
   inequívoco: o `.ok` de outra resposta não tem esse nome. Aí a janela pode ser larga sem risco
   de inocentar por acaso, e ela precisa ser: a `carga_diaria.js` confere o carimbo 1.200
   caracteres depois do `fetch`, com o resumo da rodada impresso no meio, e com 600 ela aparecia
   como defeito que não era.
   >>> QUANDO NÃO HÁ NOME, a busca é por um `.ok` QUALQUER — e aí janela larga é perigosa: um
       `.ok` de dez linhas adiante, de outra resposta, inocentaria este `fetch`. Por isso ela
       fica curta. Duas certezas diferentes, dois tamanhos; um número só para os dois casos
       erraria em um deles, e o erro seria SEMPRE para o lado de deixar passar. */
const JANELA_COM_NOME = 1600;
const JANELA_SEM_NOME = 600;
const JANELA = JANELA_COM_NOME;

function chamadas(js) {
  const out = [];
  const re = /\bfetch\s*\(/g;
  let m;
  while ((m = re.exec(js)) !== null) {
    // fecha a chamada equilibrando parênteses — regex sozinha não fecha chamada aninhada
    let i = m.index + m[0].length, nivel = 1;
    while (i < js.length && nivel > 0) {
      const c = js[i];
      if (c === '(') nivel++;
      else if (c === ')') nivel--;
      i++;
    }
    const antes = js.slice(Math.max(0, m.index - 90), m.index);
    /* A JANELA PARA NO PRÓXIMO `fetch`, e isso é o que impede o conserto de um site de dar
       verde no site seguinte. Sem esse corte, dois `fetch` colados fariam o `r.ok` do segundo
       inocentar o primeiro — que é a forma mais silenciosa de este detector mentir. */
    let depois = js.slice(i, i + JANELA);
    const prox = depois.search(/\bfetch\s*\(/);
    if (prox > -1) depois = depois.slice(0, prox);
    out.push({ ini: m.index, fim: i, antes, depois, alvo: js.slice(m.index, Math.min(i, m.index + 110)) });
  }
  return out;
}

/* O NOME DA VARIÁVEL QUE RECEBE. Sem ele não dá para saber de QUEM é o `.ok` que aparece
   adiante — e um `.ok` de outra resposta inocentaria esta. */
function receptor(antes) {
  const m = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?$/.exec(antes)
         || /([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?$/.exec(antes);
  return m ? m[1] : null;
}

/* Devolve um ARRAY (para o `.length` de sempre) com o número de entregas pendurado nele. A
   contagem precisa sair do mesmo lugar que os achados: separá-la em dois retornos faria alguém
   chamar só um dos dois e a dívida sumir na primeira pressa. */
function analisa(js) {
  const achados = [];
  achados.entregues = 0;
  for (const c of chamadas(js)) {
    const v = receptor(c.antes);
    /* `.then(r => ...)` põe o nome DEPOIS do fetch, e não antes. Sem este caso o detector
       acusaria de "resultado descartado" todo `fetch().then()` do projeto. */
    const mThen = /^\s*\.\s*then\s*\(\s*(?:async\s*)?\(?\s*([A-Za-z_$][\w$]*)/.exec(c.depois);
    const nome = v || (mThen ? mThen[1] : null);
    const janela = nome ? c.depois : c.depois.slice(0, JANELA_SEM_NOME);

    /* ══ O `fetch` QUE É DEVOLVIDO NÃO ESTÁ SEM DONO — ELE TEM OUTRO DONO ════════════════════
       `return fetch(u, o)` e `buscar: (u,o) => fetch(u,o)` entregam a RESPOSTA a quem chamou, e
       é lá que o `r.ok` mora. São as portas desta casa: o `fetchBanco` da `coleta_itens_lote`
       (que retenta e devolve) e o `buscar` do `watchdog_pncp` (a porta injetável que os testes
       trocam por uma de mentira).
       >>> ISSO NÃO É UMA EXCEÇÃO POR NOME, que é como este tipo de detector morre — é uma
           FORMA, verificável em qualquer arquivo: se o valor é devolvido, este trecho não é o
           lugar de conferi-lo. E ela é CONTADA e DITA no resumo, nunca somem em silêncio:
           dívida escondida é mentira, mesmo quando a dívida é de outro. */
    const entregue = /(?:\breturn\s+(?:await\s+)?|=>\s*)$/.test(c.antes);
    if (entregue) { achados.entregues++; continue; }

    const confere = nome
      ? new RegExp('\\b' + nome.replace(/\$/g, '\\$') + '\\s*\\.\\s*(ok|status)\\b').test(janela)
      : /\.\s*(ok|status)\b/.test(janela);

    /* `catch(() => ...)` sozinho NÃO conta como conferência: ele pega a queda do transporte e
       deixa passar o 401, que é justamente o caso do defeito da Proposta. É a distinção que a
       fatia A34 já teve de fazer do outro lado (o `fetch failed` que o `r.ok` não vê). */
    const formaComoProva = /Array\.isArray\s*\(/.test(janela) || /\.\s*length\b/.test(janela);
    const saiCalado = /\b(break|return)\b/.test(janela)
      && !/console\.|throw |erro|falh|aviso|alerta|log\(/i.test(janela);

    if (!confere) {
      achados.push({
        pos: c.ini,
        alvo: c.alvo.replace(/\s+/g, ' ').slice(0, 78),
        nome: nome || '(descartado)',
        tipo: !nome ? 'resultado DESCARTADO (nem `ok` nem variável)'
            : formaComoProva ? 'sem `ok` — e usa FORMA (`Array.isArray`/`length`) como prova'
            : 'sem `ok`',
        calado: saiCalado,
      });
    }
  }
  return achados;
}

// ══════════ A PROVA DO DETECTOR, NAS DUAS DIREÇÕES ══════════════════════════════════════════
// Sem ela, um "0 achados" no território seria indistinguível de um detector quebrado.
const BOM = [
  ["confere r.ok logo depois", "const r = await fetch(u, {headers:H}); if(!r.ok) return null; const j = await r.json();"],
  ["confere pelo status", "const r = await fetch(u); if (r.status === 404) return {vazio:true}; if(!r.ok) throw new Error('x');"],
  ["then com nome próprio", "fetch(u).then(res => { if(!res.ok) throw new Error('x'); return res.json(); })"],
  ["nome diferente do padrão", "const resposta = await fetch(u); if(!resposta.ok) return; "],
];
const RUIM = [
  ["o defeito da Proposta, letra por letra", "const r = await fetch(u, {headers:H}); const j = await r.json(); if(!Array.isArray(j)) break; total += j.length;"],
  ["json direto, sem conferir nada", "const j = await (await fetch(u)).json(); usa(j);"],
  ["then que já pede json sem olhar o ok", "fetch(u).then(x => x.json()).then(j => pinta(j))"],
  ["resultado descartado de vez", "await fetch(u, {method:'POST', body: JSON.stringify(l)}); console.log('gravado');"],
  ["'nao consegui perguntar' virando 'nao existe'", "const a = await (await fetch(u,{headers:H})).json(); if(!a.length){ console.error('nao achei'); process.exit(1); }"],
];
/* As DUAS FORMAS DE ENTREGA, provadas à parte: elas não podem ser acusadas E não podem sumir da
   contagem. Um detector que trata "entregue ao chamador" como "conferido" perde o dia em que
   ninguém confere do outro lado. */
const ENTREGUES = [
  ["porta injetável (arrow)", "const porta = { buscar: (u, o) => fetch(u, o) };"],
  ["envelope com retentativa", "async function pede(u, o){ for(let t=0;t<3;t++){ try { return await fetch(u, o); } catch(e){} } }"],
];

/* ══ A FERRAMENTA TAMBÉM É BIBLIOTECA, E A SUÍTE USA ESTE MESMO CÓDIGO ═══════════════════════
   A `tests/testa_familia_rok.js` importa daqui em vez de reescrever o detector. Uma segunda
   cópia do detector é uma segunda régua — e as duas medem o mesmo território, então elas vão
   discordar no dia em que uma delas melhorar. A lição é a mesma do `criaBreaker` emprestado
   pelos dois coletores em vez de copiado. */
module.exports = { analisa, chamadas, semComentario, TELAS_E_LIBS, FERRAMENTAS, BOM, RUIM, ENTREGUES };
/* Sem esta linha, `require('./varre_rok.js')` VARRERIA o repositório inteiro só de ser
   importado — e a suíte imprimiria a varredura no meio dos asserts. */
if (require.main !== module) return;

if (tem('--prova')) {
  let p = 0, f = 0;
  console.log('=== PROVA DO DETECTOR (as duas direções) ===\n');
  for (const [nome, js] of BOM) {
    const a = analisa(js);
    if (a.length === 0) { p++; console.log('  ✓ deixa passar: ' + nome); }
    else { f++; console.log('  ✗ FALSO ALARME em: ' + nome + '  ' + JSON.stringify(a[0].tipo)); }
  }
  for (const [nome, js] of RUIM) {
    const a = analisa(js);
    if (a.length > 0) { p++; console.log('  ✓ acusa: ' + nome + '   (' + a[0].tipo + ')'); }
    else { f++; console.log('  ✗ ESCAPOU: ' + nome); }
  }
  for (const [nome, js] of ENTREGUES) {
    const a = analisa(js);
    if (a.length === 0 && a.entregues === 1) { p++; console.log('  ✓ conta como ENTREGUE (não acusa, não some): ' + nome); }
    else { f++; console.log('  ✗ classificou errado: ' + nome + '  [acusados ' + a.length + ' · entregues ' + a.entregues + ']'); }
  }
  console.log('\nRESULTADO DA PROVA: ' + p + ' ok, ' + f + ' falha(s)');
  process.exit(f ? 1 : 0);
}

// ══════════ A VARREDURA ═════════════════════════════════════════════════════════════════════
const alvos = TELAS_E_LIBS.concat(tem('--tudo') ? FERRAMENTAS : []);
let total = 0, comDefeito = 0, arquivosSujos = 0, entregues = 0;
console.log('=== A FAMÍLIA DO `r.ok` NO TERRITÓRIO DO A — ' + new Date().toISOString() + ' ===\n');
for (const rel of alvos) {
  const abs = path.join(RAIZ, rel);
  if (!fs.existsSync(abs)) { console.log('  (não existe: ' + rel + ')'); continue; }
  const cru = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
  const js = semComentario(cru);
  const n = chamadas(js).length;
  total += n;
  const achados = analisa(js);
  comDefeito += achados.length;
  entregues += achados.entregues;
  if (!n) continue;
  console.log('  ' + rel.padEnd(30) + String(n).padStart(3) + ' fetch · '
    + (achados.length ? String(achados.length) + ' SEM CONFERIR' : 'todos conferem o ok')
    + (achados.entregues ? '  (+' + achados.entregues + ' entregue(s) ao chamador)' : ''));
  if (achados.length) arquivosSujos++;
  for (const a of achados) {
    console.log('      linha ' + String(linhaDe(js, a.pos)).padStart(5) + '  [' + a.nome + ']  ' + a.tipo
      + (a.calado ? '  · E SAI CALADO' : ''));
    console.log('             ' + a.alvo);
  }
}
console.log('\n── total ──  ' + total + ' fetch varridos · ' + comDefeito + ' sem conferir o `ok`'
  + ' · ' + arquivosSujos + ' arquivo(s) com pelo menos um'
  + ' · ' + entregues + ' entregue(s) ao chamador (conferidos LÁ, e por isso contados aqui)');
process.exitCode = comDefeito ? 1 : 0;
