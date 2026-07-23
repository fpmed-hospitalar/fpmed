// SUITE testa_cmp_pa — normalizacao de PA + chave do Comparativo de Fornecedores (recriada
// permanente; extrai as funcoes REAIS do fpmed_sistema_final.html).  node tests/testa_cmp_pa.js
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','fpmed_sistema_final.html'),'utf8');
const L=src.split(/\r?\n/);
const slice=(a,b,inc)=>{const s=L.findIndex(x=>x.includes(a));let e=-1;for(let i=s+1;i<L.length;i++){if(L[i].includes(b)){e=i;break;}}if(s<0||e<0)throw new Error('anchor '+a+' / '+b);return L.slice(s,inc?e+1:e).join('\n');};
// _gmNorm, _GM_SAL_RE, normPA, _GM_MATCAT_RE, ehMaterialPA, doseKey, _CMP_SALT/_ION, _cmpPaRobusto, chaveAgrupamento
const blk=slice('function _gmNorm(s)','async function resolvePA',false);
const ctx=(new Function(blk+'\nreturn {normPA,doseKey,ehMaterialPA,_cmpPaRobusto,chaveAgrupamento};'))();
const {normPA,doseKey,ehMaterialPA,_cmpPaRobusto,chaveAgrupamento}=ctx;
let p=0,f=0; const ok=(n,c,e)=>{if(c)p++;else{f++;console.log('  FALHA '+n+(e!=null?' [got '+e+']':''));}};
console.log('SUITE testa_cmp_pa — PA robusto + chave do comparativo\n');

// _cmpPaRobusto: mesmo farmaco escrito diferente cai na MESMA chave
const eq=(a,b)=>_cmpPaRobusto(a)===_cmpPaRobusto(b);
ok('AZITROMICINA DIHIDRATADA == AZITROMICINA', eq('AZITROMICINA DIHIDRATADA','AZITROMICINA'));
ok('PROMETAZINA CLORIDRATO == PROMETAZINA', eq('PROMETAZINA CLORIDRATO','PROMETAZINA'));
ok('BROMETO DE ROCURONIO == ROCURONIO', eq('BROMETO DE ROCURONIO','ROCURONIO'));
ok('CEFTRIAXONA SODICA == CEFTRIAXONA', eq('CEFTRIAXONA SODICA','CEFTRIAXONA'));
ok('SUCCINATO SODICO DE METILPREDNISOLONA == METILPREDNISOLONA', eq('SUCCINATO SODICO DE METILPREDNISOLONA','METILPREDNISOLONA'));
ok('DIPIRONA SODICA == DIPIRONA', eq('DIPIRONA SODICA','DIPIRONA'));
// guarda de ion: sais de SODIO diferentes NAO podem colidir
ok('CLORETO DE SODIO != BICARBONATO DE SODIO', !eq('CLORETO DE SODIO','BICARBONATO DE SODIO'));
ok('MORFINA != METADONA', !eq('MORFINA','METADONA'));

// doseKey: massa absoluta ignora volume; concentracao/volume entram quando nao ha massa
ok('doseKey 500MG', doseKey('AMOXI 500MG CX30')==='500MG', doseKey('AMOXI 500MG CX30'));
ok('doseKey 1G', doseKey('CEFTRIAXONA 1G IV')==='1G', doseKey('CEFTRIAXONA 1G IV'));
ok('doseKey massa ignora ML (500MG 5ML->500MG)', doseKey('VIT C 500MG 5ML')==='500MG', doseKey('VIT C 500MG 5ML'));
ok('doseKey concentracao 50MG/ML', /50MG\/ML/.test(doseKey('DIMORF 10MG/ML')||'') || doseKey('DIMORF 10MG/ML').includes('10MG/ML'), doseKey('DIMORF 10MG/ML'));
ok('doseKey so volume 100ML', doseKey('AGUA 100ML')==='100ML', doseKey('AGUA 100ML'));
ok('doseKey %', doseKey('SORO GLICOSE 5%')==='5%', doseKey('SORO GLICOSE 5%'));

// ehMaterialPA
ok('ehMaterialPA vazio=material', ehMaterialPA('')===true);
ok('ehMaterialPA OUTROS=material', ehMaterialPA('OUTROS')===true);
ok('ehMaterialPA LUVA=material', ehMaterialPA('LUVA')===true);
ok('ehMaterialPA DIPIRONA=nao', ehMaterialPA('DIPIRONA')===false);

// chaveAgrupamento
ok('chave PA junta dihidratada c/ pura', chaveAgrupamento({principio_ativo:'AZITROMICINA DIHIDRATADA',produto:'X 500MG'})===chaveAgrupamento({principio_ativo:'AZITROMICINA',produto:'Y 500MG'}));
ok('chave material vira MAT|', chaveAgrupamento({principio_ativo:'OUTROS',produto:'LUVA NITRILICA M'}).startsWith('MAT|'));

console.log('\nRESULTADO: '+p+' ok, '+f+' falha(s)');
process.exitCode=f?1:0;
