// SUITE testa_eglixo — egLixo: descarta rodape/cabecalho do relatorio de estoque GLOBAL ANTES de
// parsear (nao sao produtos). Recriada permanente; extrai a funcao REAL do
// fpmed_sistema_final.html.  node tests/testa_eglixo.js
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','fpmed_sistema_final.html'),'utf8');
const L=src.split(/\r?\n/);
const slice=(a,b,inc)=>{const s=L.findIndex(x=>x.includes(a));let e=-1;for(let i=s+1;i<L.length;i++){if(L[i].includes(b)){e=i;break;}}if(s<0||e<0)throw new Error('anchor '+a+' / '+b);return L.slice(s,inc?e+1:e).join('\n');};
const blk=slice('function egLixo(l)','function egNomeBanco',false);
const ctx=(new Function(blk+'\nreturn {egLixo};'))();
const {egLixo}=ctx;
let p=0,f=0; const ok=(n,c)=>{if(c)p++;else{f++;console.log('  FALHA '+n);}};
console.log('SUITE testa_eglixo — rodape/cabecalho do relatorio\n');

// LIXO (descartar)
ok('descarta "Emitido em"', egLixo('Emitido em: 09/07/2026 13:45:25')===true);
ok('descarta "Impresso em"', egLixo('Impressao 21/07/2026')===true);
ok('descarta "Relatorio de Estoque"', egLixo('RELATORIO DE ESTOQUE GLOBAL')===true);
ok('descarta "Pagina 1 de 3"', egLixo('Pagina: 1 de 3')===true);
ok('descarta "Pag 1/3"', egLixo('Pag 1/3')===true);
ok('descarta cabecalho repetido (Produto Codigo Venda, sem cod 7 digitos)', egLixo('PRODUTO CODIGO PRINCIPIO ATIVO MARCA ESTOQUE VENDA')===true);

// PRODUTO REAL (manter)
ok('mantem linha de produto real (tem cod 7 digitos)', egLixo('0001964 DIPIRONA 500MG/ML CX100 AMP 12,50 150')===false);
ok('mantem nome de produto comum', egLixo('FUROSEMIDA 10MG/ML IV IM CX100 AMP 2ML')===false);
ok('mantem cabecalho-like MAS com cod 7 digitos (e produto)', egLixo('1234567 PRODUTO CODIGO X')===false);

console.log('\nRESULTADO: '+p+' ok, '+f+' falha(s)');
process.exitCode=f?1:0;
