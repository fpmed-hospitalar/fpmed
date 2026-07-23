// SUITE testa_desfundir — blindagem contra linha grudada do relatorio de estoque GLOBAL:
// egNomeSuspeito (detecta) + egDesfundir (limpa o rabo do PA anterior). Recriada permanente;
// extrai as funcoes REAIS do fpmed_sistema_final.html.  node tests/testa_desfundir.js
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','fpmed_sistema_final.html'),'utf8');
const L=src.split(/\r?\n/);
const slice=(a,b,inc)=>{const s=L.findIndex(x=>x.includes(a));let e=-1;for(let i=s+1;i<L.length;i++){if(L[i].includes(b)){e=i;break;}}if(s<0||e<0)throw new Error('anchor '+a+' / '+b);return L.slice(s,inc?e+1:e).join('\n');};
// _gmNorm (dep) + o bloco EG_FARM..egDesfundir. cotacoes stubado (=[]) p/ o egNomeBanco.
const blk = slice('function _gmNorm(s)','var _GM_SAL_RE',false) + '\n' +
            slice('const EG_FARM','function egProcessar',false);
const ctx=(new Function('let cotacoes=[];'+blk+'\nreturn {egNomeSuspeito,egDesfundir,setCot:function(a){cotacoes=a;}};'))();
const {egNomeSuspeito,egDesfundir}=ctx;
let p=0,f=0; const ok=(n,c,e)=>{if(c)p++;else{f++;console.log('  FALHA '+n+(e!=null?' [got '+JSON.stringify(e)+']':''));}};
console.log('SUITE testa_desfundir — linha grudada do relatorio\n');

// egNomeSuspeito: as 4 assinaturas
ok('rodape "Emitido em" no nome', /Emitido em/i.test(egNomeSuspeito('METILPREDNISOLONA Emitido em: 09/07/2026 13:45')||''), egNomeSuspeito('METILPREDNISOLONA Emitido em: 09/07/2026 13:45'));
ok('data-hora colada', egNomeSuspeito('PRODUTO X 09/07/2026 13:45')!==null, egNomeSuspeito('PRODUTO X 09/07/2026 13:45'));
ok('palavra duplicada', /duplicada/.test(egNomeSuspeito('ESCOPOLAMINA ESCOPOLAMINA 20MG/ML')||''), egNomeSuspeito('ESCOPOLAMINA ESCOPOLAMINA 20MG/ML'));
ok('2 farmacos colados', /2 f/.test(egNomeSuspeito('PREDNISOLONA FUROSEMIDA 10MG/ML')||''), egNomeSuspeito('PREDNISOLONA FUROSEMIDA 10MG/ML'));
ok('2 farmacos HIDROCORTISONA METILPREDNISOLONA', egNomeSuspeito('HIDROCORTISONA METILPREDNISOLONA 125MG')!==null, egNomeSuspeito('HIDROCORTISONA METILPREDNISOLONA 125MG'));
// nomes LIMPOS nao disparam
ok('nome limpo FUROSEMIDA passa', egNomeSuspeito('FUROSEMIDA 10MG/ML IV IM CX100 AMP 2ML')===null, egNomeSuspeito('FUROSEMIDA 10MG/ML IV IM CX100 AMP 2ML'));
ok('nome limpo DIPIRONA passa', egNomeSuspeito('DIPIRONA 500MG/ML CX100 AMP')===null, egNomeSuspeito('DIPIRONA 500MG/ML CX100 AMP'));
ok('nome limpo METILPREDNISOLONA passa', egNomeSuspeito('METILPREDNISOLONA 125MG CX25 FR AMP')===null, egNomeSuspeito('METILPREDNISOLONA 125MG CX25 FR AMP'));

// egDesfundir: rabo do PA anterior grudado no prefixo -> corta (heuristica, sem ancora de banco)
ok('corta prefixo = sufixo do PA anterior (ESCOPOLAMINA)', egDesfundir('ESCOPOLAMINA 20MG/ML INJ CX100', 'BUTILBROMETO DE ESCOPOLAMINA', '446')==='20MG/ML INJ CX100' || egDesfundir('ESCOPOLAMINA ESCOPOLAMINA 20MG/ML INJ', 'BUTILBROMETO DE ESCOPOLAMINA', '446')==='ESCOPOLAMINA 20MG/ML INJ', egDesfundir('ESCOPOLAMINA ESCOPOLAMINA 20MG/ML INJ', 'BUTILBROMETO DE ESCOPOLAMINA', '446'));
ok('nome limpo sem PA anterior fica intacto', egDesfundir('FUROSEMIDA 10MG/ML IV IM CX100 AMP', '', '470')==='FUROSEMIDA 10MG/ML IV IM CX100 AMP', egDesfundir('FUROSEMIDA 10MG/ML IV IM CX100 AMP', '', '470'));
ok('nunca corta o nome inteiro (sobra >=2 palavras)', (()=>{const r=egDesfundir('ESCOPOLAMINA', 'BUTILBROMETO DE ESCOPOLAMINA', '446'); return r==='ESCOPOLAMINA';})(), egDesfundir('ESCOPOLAMINA', 'BUTILBROMETO DE ESCOPOLAMINA', '446'));
ok('sem match no PA anterior fica intacto', egDesfundir('DIPIRONA 500MG CX100', 'CLORETO DE SODIO', '999')==='DIPIRONA 500MG CX100', egDesfundir('DIPIRONA 500MG CX100', 'CLORETO DE SODIO', '999'));

console.log('\nRESULTADO: '+p+' ok, '+f+' falha(s)');
process.exitCode=f?1:0;
