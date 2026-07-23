// SUITE testa_cpz_via — discriminador de VIA (IM x IV) + cheiro de mistura + limpeza de outlier do
// Comparativo/Competitividade (recriada permanente; extrai as funcoes REAIS do
// fpmed_sistema_final.html).  node tests/testa_cpz_via.js
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','fpmed_sistema_final.html'),'utf8');
const L=src.split(/\r?\n/);
const slice=(a,b,inc)=>{const s=L.findIndex(x=>x.includes(a));let e=-1;for(let i=s+1;i<L.length;i++){if(L[i].includes(b)){e=i;break;}}if(s<0||e<0)throw new Error('anchor '+a+' / '+b);return L.slice(s,inc?e+1:e).join('\n');};
// _cpzMed + _cpzLimpa (outlier) ; _CPZ_VIAS.._cpzMistura (via/apresentacao)
const blk = slice('function _cpzMed(a)','function _cpzMoney',false) + '\n' +
            slice('var _CPZ_VIAS =','function _cpzVsGenerico',false);
const ctx=(new Function(blk+'\nreturn {_cpzMed,_cpzLimpa,_cpzVias,_cpzViaOk,_cpzApr,_cpzSetOk,_cpzMistura};'))();
const {_cpzMed,_cpzLimpa,_cpzVias,_cpzViaOk,_cpzApr,_cpzSetOk,_cpzMistura}=ctx;
let p=0,f=0; const ok=(n,c,e)=>{if(c)p++;else{f++;console.log('  FALHA '+n+(e!=null?' [got '+JSON.stringify(e)+']':''));}};
console.log('SUITE testa_cpz_via — via (IMxIV) + mistura + outlier\n');

// _cpzVias: marcadores de via
ok('via IV', JSON.stringify(_cpzVias('ARTRINID IV 100MG'))==='["IV"]', _cpzVias('ARTRINID IV 100MG'));
ok('via IM', JSON.stringify(_cpzVias('CETOPROFENO IM AMPOLA'))==='["IM"]', _cpzVias('CETOPROFENO IM AMPOLA'));
ok('via IV/IM = ambos', _cpzVias('DEXA IV IM 2ML').indexOf('IV')>=0 && _cpzVias('DEXA IV IM 2ML').indexOf('IM')>=0, _cpzVias('DEXA IV IM 2ML'));
ok('via ausente = []', _cpzVias('DIPIRONA 500MG CPR').length===0, _cpzVias('DIPIRONA 500MG CPR'));

// _cpzViaOk: intersecao; so decide quando OS DOIS tem marcador
ok('IV x IM = incompativel', _cpzViaOk(['IV'],['IM'])===false);
ok('IV x IV = ok', _cpzViaOk(['IV'],['IV'])===true);
ok('IV,IM x IM = ok (intersecao)', _cpzViaOk(['IV','IM'],['IM'])===true);
ok('IV x sem-marcador = ok (nao filtra)', _cpzViaOk(['IV'],[])===true);

// _cpzApr: recipiente ; PO/LIOF nao entra (nao e recipiente)
ok('apr FR AMP = {FRASCO,AMP}', _cpzApr('CEFTRIAX FR AMP').indexOf('FRASCO')>=0 && _cpzApr('CEFTRIAX FR AMP').indexOf('AMP')>=0, _cpzApr('CEFTRIAX FR AMP'));
ok('FR AMP casa AMP (setOk)', _cpzSetOk(_cpzApr('X FR AMP'),_cpzApr('Y AMP'))===true);
ok('FR AMP casa FRASCO (setOk)', _cpzSetOk(_cpzApr('X FR AMP'),_cpzApr('Y FRASCO'))===true);

// _cpzMistura: (a) variacao >3x em pool pequeno ; (b) via/apresentacao disjuntas
ok('mistura: via IV x IM no pool', /vias diferentes/.test(_cpzMistura([{cu:10,prod:'ARTRINID IV 100MG'},{cu:11,prod:'CETOPRO IM AMP'}])||''), _cpzMistura([{cu:10,prod:'ARTRINID IV 100MG'},{cu:11,prod:'CETOPRO IM AMP'}]));
ok('mistura: variacao >3x em pool pequeno', /variam/.test(_cpzMistura([{cu:1,prod:'X'},{cu:10,prod:'Y'}])||''), _cpzMistura([{cu:1,prod:'X'},{cu:10,prod:'Y'}]));
ok('sem mistura: mesmo via, precos proximos', _cpzMistura([{cu:10,prod:'X IV'},{cu:11,prod:'Y IV'},{cu:12,prod:'Z IV'}])===null, _cpzMistura([{cu:10,prod:'X IV'},{cu:11,prod:'Y IV'},{cu:12,prod:'Z IV'}]));
ok('pool grande (>4) nao flaga so por >3x', _cpzMistura([{cu:1,prod:'A'},{cu:2,prod:'B'},{cu:3,prod:'C'},{cu:4,prod:'D'},{cu:10,prod:'E'}])===null, _cpzMistura([{cu:1,prod:'A'},{cu:2,prod:'B'},{cu:3,prod:'C'},{cu:4,prod:'D'},{cu:10,prod:'E'}]));

// _cpzMed / _cpzLimpa
ok('mediana impar', _cpzMed([1,3,2])===2, _cpzMed([1,3,2]));
ok('mediana par', _cpzMed([1,2,3,4])===2.5, _cpzMed([1,2,3,4]));
ok('limpa tira outlier baixo (<med/3) e alto (>med*3)', (()=>{const r=_cpzLimpa([{cu:1},{cu:10},{cu:11},{cu:12},{cu:100}]); return !r.some(x=>x.cu===1)&&!r.some(x=>x.cu===100)&&r.some(x=>x.cu===11);})(), JSON.stringify(_cpzLimpa([{cu:1},{cu:10},{cu:11},{cu:12},{cu:100}])));

console.log('\nRESULTADO: '+p+' ok, '+f+' falha(s)');
process.exitCode=f?1:0;
