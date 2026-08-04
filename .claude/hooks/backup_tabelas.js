// BACKUP FRESCO das tabelas da FPMED -> JSON local em C:\fpmed\backups\backup_<data>\
// So LEITURA (GET). Rodar ANTES de qualquer rodada longa. NAO altera nada.
// A chave service_role NAO fica aqui (repo publico): e lida do segredos.local.txt (gitignored).
// ATENCAO: o PostgREST da FPMED pagina em 1000 (nao 2000 como o GlobalMed) -> limit=1000.
const fs = require('fs');
const path = require('path');

const SEG = 'C:/fpmed/segredos.local.txt';
if (!fs.existsSync(SEG)) { console.error('segredos.local.txt nao encontrado em ' + SEG + ' — abortando (nada foi lido).'); process.exit(1); }
const seg = fs.readFileSync(SEG, 'utf8');
const m = seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i);
if (!m) { console.error('service_role nao encontrada em C:\\fpmed\\segredos.local.txt — abortando (nada foi lido).'); process.exit(1); }
const SR = m[1];
const SB = "https://xzdowrksuswekwffoluk.supabase.co", H = { apikey: SR, Authorization: "Bearer " + SR };
// Tabelas do db_schema.sql + estoque_backup (snapshots do Atualizar Estoque). Sem prospects (fora do pacote).
const TABELAS = ['cotacoes','fornecedores','clientes','compras','compra_itens','orcamentos','itens_a_cotar','pedidos_compra','notas','cmed_dicionario','estoque_backup'];

function stamp(){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; }
async function all(tab){ let out=[],off=0; while(true){ const r=await fetch(`${SB}/rest/v1/${tab}?select=*&limit=1000&offset=${off}`,{headers:H}); if(!r.ok){ if(off===0) throw new Error(r.status+' '+(await r.text()).slice(0,80)); break; } const d=await r.json(); if(!Array.isArray(d)||!d.length)break; out=out.concat(d); if(d.length<1000)break; off+=1000; } return out; }

(async()=>{
  const dir = path.join('C:/fpmed/backups', 'backup_'+stamp());
  fs.mkdirSync(dir, { recursive:true });
  const resumo = {};
  for(const t of TABELAS){
    try{ const rows=await all(t); fs.writeFileSync(path.join(dir,t+'.json'), JSON.stringify(rows)); resumo[t]=rows.length; console.log(`  ${t.padEnd(16)} ${rows.length} linhas`); }
    catch(e){ resumo[t]='ERRO/inexistente: '+e.message; console.log(`  ${t.padEnd(16)} PULADA (${e.message.slice(0,40)})`); }
  }
  fs.writeFileSync(path.join(dir,'_resumo.json'), JSON.stringify({quando:stamp(), tabelas:resumo}, null, 2));
  console.log('\nBACKUP em: '+dir);
})();
