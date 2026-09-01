// BACKUP FRESCO das tabelas da FPMED -> JSON local em C:\fpmed\backups\backup_<data>\
// So LEITURA (GET). Rodar ANTES de qualquer rodada longa. NAO altera nada.
// A chave service_role NAO fica aqui (repo publico): e lida do segredos.local.txt (gitignored).
// ATENCAO: o PostgREST da FPMED pagina em 1000 (nao 2000 como o GlobalMed) -> limit=1000.
//
// ══ POR QUE A LISTA DE TABELAS NAO E MAIS ESCRITA A MAO (06/08/2026) ═════════════════════════
// Ate hoje este arquivo tinha 11 nomes cravados, copiados do db_schema.sql de 22/07. De 04/08
// em diante o banco ganhou 11 tabelas novas -- licitacoes, negocios, cmed_precos, cmed_pf,
// perfis, jornais, empresas, pack_confirmado, contatos_industria, licitacoes_acompanhadas e
// coleta_status -- e NENHUMA delas entrava no backup. O log dizia "saida=0" e a tarefa agendada
// aparecia verde: o backup terminava bem, com metade do banco de fora.
//
// >>> ESSE E O MODO DE FALHA QUE IMPORTA. Backup que falha alto alguem conserta no mesmo dia;
//     backup que dá certo pela metade so aparece no dia da restauracao, que e o pior dia
//     possivel pra descobrir. Uma lista escrita a mao envelhece toda vez que alguem cria uma
//     tabela e nao lembra de vir aqui -- e ninguem lembra.
//
// Agora as tabelas sao DESCOBERTAS no proprio banco, pelo indice do PostgREST (o OpenAPI da
// raiz /rest/v1/). Tabela criada semana que vem entra no backup sozinha, sem ninguem editar
// este arquivo. As VIEWS ficam de fora porque sao consulta derivada: guardar cmed_regua e
// guardar cmed_pf + cmed_precos de novo, com outro nome.
const fs = require('fs');
const path = require('path');

const SEG = 'C:/fpmed/segredos.local.txt';
if (!fs.existsSync(SEG)) { console.error('segredos.local.txt nao encontrado em ' + SEG + ' — abortando (nada foi lido).'); process.exit(1); }
const seg = fs.readFileSync(SEG, 'utf8');
const m = seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i);
if (!m) { console.error('service_role nao encontrada em C:\\fpmed\\segredos.local.txt — abortando (nada foi lido).'); process.exit(1); }
const SR = m[1];
const SB = "https://xzdowrksuswekwffoluk.supabase.co", H = { apikey: SR, Authorization: "Bearer " + SR };

// Views expostas com POST porque o Postgres as considera atualizaveis. Nao sao dado proprio:
// `cotacoes_vendedor` e a `cotacoes` sem as colunas de custo. Guardar seria o mesmo dado duas
// vezes, e o de baixo ja esta guardado.
const DERIVADAS = new Set(['cotacoes_vendedor']);

function stamp(){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; }

// DESCOBERTA: o indice do PostgREST lista tudo que o banco expoe. Quem aceita POST e
// tabela-base (ou view atualizavel); quem so aceita GET e view de leitura.
async function descobre(){
  const r = await fetch(`${SB}/rest/v1/`, { headers: H });
  if (!r.ok) throw new Error('nao consegui listar as tabelas (HTTP ' + r.status + ')');
  const spec = await r.json();
  const tabelas = [], views = [];
  for (const p of Object.keys(spec.paths || {})) {
    if (p === '/' || p.includes('{')) continue;
    const nome = p.replace(/^\//, '');
    if (nome.startsWith('rpc/')) continue;
    if (spec.paths[p].post) tabelas.push(nome); else views.push(nome);
  }
  return { tabelas: tabelas.filter(t => !DERIVADAS.has(t)).sort(), views: views.sort(),
           derivadas: tabelas.filter(t => DERIVADAS.has(t)) };
}

// ── A TABELA GRANDE NAO CABE NUMA STRING (A49, 01/09/2026) ──────────────────────────────
// Ate hoje esta funcao juntava TODAS as paginas num array e o chamador fazia
// JSON.stringify(rows) de uma vez. Isso funcionou por um ano e parou de funcionar sozinho,
// sem ninguem mexer em nada: a licitacao_itens passou de 425.437 linhas / 876 MB, e o
// JSON.stringify de um array desse tamanho estoura o TETO DE STRING DO V8. O erro que ficou
// registrado no backup de 30/08 foi exatamente "Invalid string length".
//
// >>> E O PIOR MODO DE FALHA DE NOVO, pelo mesmo motivo do defeito de 06/08 que criou esta
//     suite: o backup terminava, gravava 51 de 52, e so a catraca acusou. A tabela que ficava
//     de fora era a MAIOR do banco - 3 de cada 4 linhas do sistema inteiro.
//
// A correcao nao muda o formato do arquivo: continua um JSON array valido. O que muda e que
// ele e ESCRITO AOS PEDACOS, uma linha por vez, e nenhuma string grande existe em memoria.
// Cada JSON.stringify agora e de UMA linha, e nao do banco inteiro.
// Retorna a contagem de linhas gravadas.
async function baixaPara(tab, destino){
  const fd = fs.openSync(destino, 'w');
  let off = 0, n = 0;
  try {
    fs.writeSync(fd, '[');
    while(true){
      const r = await fetch(`${SB}/rest/v1/${tab}?select=*&limit=1000&offset=${off}`,{headers:H});
      if(!r.ok){ if(off===0) throw new Error(r.status+' '+(await r.text()).slice(0,80)); break; }
      const d = await r.json();
      if(!Array.isArray(d)||!d.length) break;
      for(const linha of d) fs.writeSync(fd, (n++ ? ',' : '') + JSON.stringify(linha));
      if(d.length<1000) break;
      off += 1000;
    }
    fs.writeSync(fd, ']');
  } finally { fs.closeSync(fd); }
  return n;
}

(async()=>{
  let achado;
  try { achado = await descobre(); }
  catch(e){ console.error('ABORTANDO: ' + e.message + ' — melhor nenhum backup do que um backup que nao sabe o que faltou.'); process.exit(1); }

  const dir = path.join('C:/fpmed/backups', 'backup_'+stamp());
  fs.mkdirSync(dir, { recursive:true });
  const resumo = {}; const falhas = [];
  console.log(`  (descobertas ${achado.tabelas.length} tabelas no banco; ${achado.views.length} views e ${achado.derivadas.length} derivada(s) ficam de fora)`);
  for(const t of achado.tabelas){
    const destino = path.join(dir,t+'.json');
    try{ const n=await baixaPara(t, destino); resumo[t]=n; console.log(`  ${t.padEnd(24)} ${n} linhas`); }
    // O arquivo parcial TEM que sumir: como a gravacao agora e em streaming, uma tabela que
    // falha no meio deixa no disco um .json truncado, sem o ']' final. Um backup com arquivo
    // pela metade e pior que um backup sem o arquivo - na restauracao ele parece existir.
    catch(e){ try{ fs.unlinkSync(destino); }catch(_){} resumo[t]='ERRO: '+e.message; falhas.push(t); console.log(`  ${t.padEnd(24)} FALHOU (${e.message.slice(0,40)})`); }
  }
  fs.writeFileSync(path.join(dir,'_resumo.json'), JSON.stringify({
    quando: stamp(), descobertas: achado.tabelas.length, salvas: achado.tabelas.length - falhas.length,
    falhas, views_fora: achado.views, derivadas_fora: achado.derivadas, tabelas: resumo }, null, 2));
  console.log('\nBACKUP em: '+dir);
  // >>> SAIDA != 0 QUANDO FALTOU TABELA. Antes, tabela que estourava era so uma linha "PULADA"
  //     no log e a tarefa agendada continuava verde. Backup incompleto tem que ACUSAR.
  if (falhas.length) { console.error(`\n!! BACKUP INCOMPLETO: ${falhas.length} tabela(s) nao salvas -> ${falhas.join(', ')}`); process.exit(2); }
})();
