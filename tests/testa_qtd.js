// SUITE testa_qtd — granularidade de embalagem (recriada permanente; extrai as funcoes REAIS do
// fpmed_giovana.html). qtdEmbalagem/_qtdDoNome/_undNum/qtdEmbDiv.  node tests/testa_qtd.js
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','fpmed_giovana.html'),'utf8');
const L=src.split(/\r?\n/);
const slice=(a,b,inc)=>{const s=L.findIndex(x=>x.includes(a));let e=-1;for(let i=s+1;i<L.length;i++){if(L[i].includes(b)){e=i;break;}}if(s<0||e<0)throw new Error('anchor '+a+' / '+b);return L.slice(s,inc?e+1:e).join('\n');};
const blk=slice('function _undNum(und)','function pareceCaixaPeer',false);
const ctx=(new Function('console.warn=function(){};'+blk+'\nreturn {qtdEmbalagem,_qtdDoNome,_undNum,qtdEmbDiv};'))();
const {qtdEmbalagem,_qtdDoNome,_undNum,qtdEmbDiv}=ctx;
let p=0,f=0; const ok=(n,c,e)=>{if(c)p++;else{f++;console.log('  FALHA '+n+(e!=null?' [got '+e+']':''));}};
console.log('SUITE testa_qtd — granularidade de embalagem\n');

// _undNum (numero no UND)
ok('undNum CX10=10', _undNum('CX10')===10, _undNum('CX10'));
ok('undNum CX/30=30', _undNum('CX/30')===30, _undNum('CX/30'));
ok('undNum vazio=0', _undNum('')===0, _undNum(''));
ok('undNum 9999 fora do range=0', _undNum('9999')===0, _undNum('9999'));

// _qtdDoNome (le so do nome)
ok('nome CX28=28 (Venvanse)', _qtdDoNome('*VENVANSE 50MG CX28 CAPS (A3)')===28, _qtdDoNome('*VENVANSE 50MG CX28 CAPS (A3)'));
ok('nome C/30=30', _qtdDoNome('LISDEX 30MG C/30 CPS')===30, _qtdDoNome('LISDEX 30MG C/30 CPS'));
ok('nome C/240ML=1 (medida, nao contagem)', _qtdDoNome('XPE FR C/240ML')===1, _qtdDoNome('XPE FR C/240ML'));
ok('nome 50X100ML=50 (NxM ml)', _qtdDoNome('SORO 50X100ML')===50, _qtdDoNome('SORO 50X100ML'));
ok('nome 10X10 CPR=100 (NxM cpr)', _qtdDoNome('DIPIRONA 10X10 CPR')===100, _qtdDoNome('DIPIRONA 10X10 CPR'));
ok('nome 30 CPR=30', _qtdDoNome('AMOXI 500MG 30 CPR')===30, _qtdDoNome('AMOXI 500MG 30 CPR'));
ok('nome recipiente 1o e nao soma (4 SER+4CAN=4)', _qtdDoNome('MOUNJARO 4 SER 0,5ML+4CAN')===4, _qtdDoNome('MOUNJARO 4 SER 0,5ML+4CAN'));
ok('nome acessorio (+2 seringas) nao vira qtd', _qtdDoNome('SANDIMMUN SOL ORAL 50ML + 2 SERINGAS')===1, _qtdDoNome('SANDIMMUN SOL ORAL 50ML + 2 SERINGAS'));
ok('nome PCT 50G=1 (peso, nao contagem)', _qtdDoNome('ALGODAO PCT 50G')===1, _qtdDoNome('ALGODAO PCT 50G'));
ok('nome sem qtd=1', _qtdDoNome('PANTOPRAZOL 40MG')===1, _qtdDoNome('PANTOPRAZOL 40MG'));
ok('nome CX25 FR=25', _qtdDoNome('CEFTRIAX 1G CX25 FR')===25, _qtdDoNome('CEFTRIAX 1G CX25 FR'));

// qtdEmbalagem (uniao: und manda; senao nome; default 1)
ok('qtdEmb und CX10 manda', qtdEmbalagem('CX10','DIPIRONA')===10, qtdEmbalagem('CX10','DIPIRONA'));
ok('qtdEmb sem und usa nome', qtdEmbalagem('','DIPIRONA CX20 CPR')===20, qtdEmbalagem('','DIPIRONA CX20 CPR'));
ok('qtdEmb und 30 prevalece sobre nome 10', qtdEmbalagem('30','X C/10')===30, qtdEmbalagem('30','X C/10'));
ok('qtdEmb default 1', qtdEmbalagem('','PANTOPRAZOL 40MG')===1, qtdEmbalagem('','PANTOPRAZOL 40MG'));

// qtdEmbDiv (aviso de divergencia und x nome)
ok('qtdEmbDiv divergencia detectada', /diverge/.test(qtdEmbDiv('30','X C/10')||''), qtdEmbDiv('30','X C/10'));
ok('qtdEmbDiv sem divergencia = null', qtdEmbDiv('10','X C/10')===null, qtdEmbDiv('10','X C/10'));

console.log('\nRESULTADO: '+p+' ok, '+f+' falha(s)');
process.exitCode=f?1:0;
