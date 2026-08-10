// Carrega os municípios do Brasil com UM PONTO cada, para o Radar (módulo 2.5).
//
//   node tools/carrega_municipios.js            -> PRÉVIA (não grava nada)
//   node tools/carrega_municipios.js --apply    -> grava
//
// FONTE, e por que duas chamadas:
//   1. /api/v1/localidades/municipios  -> id, nome, UF e REGIÃO (não tem coordenada)
//   2. /api/v3/malhas/estados/{uf}     -> o polígono de cada município (não tem nome)
//   As duas se juntam pelo CÓDIGO IBGE. Uma UF por vez: a malha do país inteiro numa tacada é
//   um download grande que falha no meio e não dá pra retomar; por UF, uma falha custa uma UF.
//
// >>> O PONTO É O CENTROIDE DA ÁREA, calculado pela fórmula do polígono (não a média dos
//     vértices). A média dos vértices puxa o ponto para onde o desenho tem mais detalhe — num
//     município com litoral recortado e sertão reto, ela cai no litoral. O centroide de área
//     não tem esse viés.
//
// >>> `qualidade=minima`: o Radar precisa de um PONTO, não do contorno. A malha detalhada seria
//     ~50x maior para mudar o centroide em metros.
'use strict';
const fs = require('fs');

const APLICAR = process.argv.includes('--apply');
const SB = 'https://xzdowrksuswekwffoluk.supabase.co';
const seg = fs.readFileSync('C:/fpmed/segredos.local.txt', 'utf8');
const SR = seg.match(/service_role[\s\S]{0,240}?(eyJ[A-Za-z0-9._-]{60,})/i)[1];
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };

const semAcento = s => { let o=''; for(const c of String(s||'').normalize('NFD')){ const k=c.codePointAt(0); if(k>=0x300&&k<=0x36f) continue; o+=c; } return o.toLowerCase(); };
const pausa = ms => new Promise(r => setTimeout(r, ms));

// Centroide de área de um anel (fórmula do polígono). Devolve null se a área der zero — anel
// degenerado existe em ilha minúscula da malha simplificada, e um ponto inventado ali seria
// pior que ponto nenhum: o município apareceria no raio errado.
function centroideAnel(anel){
  let a = 0, x = 0, y = 0;
  for(let i = 0, j = anel.length - 1; i < anel.length; j = i++){
    const [x0, y0] = anel[j], [x1, y1] = anel[i];
    const f = x0 * y1 - x1 * y0;
    a += f; x += (x0 + x1) * f; y += (y0 + y1) * f;
  }
  a *= 0.5;
  if (!isFinite(a) || Math.abs(a) < 1e-12) return null;
  return [x / (6 * a), y / (6 * a)];
}
// Multipolígono: fica com o MAIOR anel. Município com ilhas não pode ter o ponto puxado pra ilha.
function pontoDaGeometria(g){
  if(!g) return null;
  const aneis = g.type === 'Polygon' ? [g.coordinates[0]]
    : g.type === 'MultiPolygon' ? g.coordinates.map(p => p[0])
    : [];
  let melhor = null, maior = -1;
  for(const anel of aneis){
    if(!Array.isArray(anel) || anel.length < 4) continue;
    let a = 0;
    for(let i = 0, j = anel.length - 1; i < anel.length; j = i++)
      a += anel[j][0] * anel[i][1] - anel[i][0] * anel[j][1];
    a = Math.abs(a / 2);
    if(a > maior){ const c = centroideAnel(anel); if(c){ maior = a; melhor = c; } }
  }
  return melhor;                                  // [lon, lat] — GeoJSON é x,y
}

async function pega(url, tentativas = 3){
  for(let i = 1; i <= tentativas; i++){
    try{
      const r = await fetch(url);
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    }catch(e){
      if(i === tentativas) throw e;
      await pausa(800 * i);                       // o IBGE às vezes recusa em rajada
    }
  }
}

(async () => {
  console.log('1. lista de municípios (nome, UF, região)…');
  const lista = await pega('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
  const porCodigo = new Map();
  for(const m of lista){
    const uf = m.microrregiao?.mesorregiao?.UF || m['regiao-imediata']?.['regiao-intermediaria']?.UF;
    if(!uf) continue;
    porCodigo.set(String(m.id), { codigo_ibge: m.id, nome: m.nome, nome_norm: semAcento(m.nome),
      uf: uf.sigla, regiao: uf.regiao?.sigla || null, lat: null, lon: null });
  }
  console.log('   ' + porCodigo.size + ' municípios');

  const UFS = [...new Set([...porCodigo.values()].map(m => m.uf))].sort();
  console.log('\n2. malha de cada UF (' + UFS.length + ')…');
  const idUF = {};
  for(const m of lista){ const uf = m.microrregiao?.mesorregiao?.UF; if(uf) idUF[uf.sigla] = uf.id; }

  let comPonto = 0, semPonto = [];
  for(const uf of UFS){
    const url = `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${idUF[uf]}`
              + `?formato=application/vnd.geo+json&intrarregiao=municipio&qualidade=minima`;
    let gj;
    try{ gj = await pega(url); }
    catch(e){ console.log('   ' + uf + ': FALHOU (' + e.message + ') — as cidades dela ficam sem ponto'); continue; }
    let n = 0;
    for(const f of (gj.features || [])){
      const cod = String(f.properties?.codarea || '').slice(0, 7);
      const alvo = porCodigo.get(cod);
      if(!alvo) continue;
      const p = pontoDaGeometria(f.geometry);
      if(!p) continue;
      alvo.lon = +p[0].toFixed(6); alvo.lat = +p[1].toFixed(6); n++; comPonto++;
    }
    console.log('   ' + uf + ': ' + n + ' com ponto');
    await pausa(120);
  }
  semPonto = [...porCodigo.values()].filter(m => m.lat == null);

  console.log('\n── RESUMO ──');
  console.log('  municípios ............ ' + porCodigo.size);
  console.log('  com coordenada ........ ' + comPonto);
  console.log('  SEM coordenada ........ ' + semPonto.length + (semPonto.length ? '  (entram na tabela mesmo assim, e o Radar os ignora dizendo por quê)' : ''));
  const go = [...porCodigo.values()].filter(m => m.uf === 'GO' && m.lat != null);
  const ap = go.find(m => m.nome_norm === 'aparecida de goiania');
  if(ap) console.log('  conferência (Aparecida de Goiânia): lat ' + ap.lat + ' · lon ' + ap.lon);

  if(!APLICAR){
    console.log('\n>>> PRÉVIA. Nada foi gravado. Rode com --apply para gravar.');
    return;
  }

  console.log('\n3. gravando…');
  const linhas = [...porCodigo.values()];
  let gravadas = 0;
  for(let i = 0; i < linhas.length; i += 500){
    const lote = linhas.slice(i, i + 500);
    const r = await fetch(`${SB}/rest/v1/municipios?on_conflict=codigo_ibge`, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(lote) });
    if(!r.ok){ console.error('   ERRO no lote ' + i + ': ' + (await r.text()).slice(0, 200)); process.exit(1); }
    gravadas += lote.length;
    console.log('   ' + gravadas + '/' + linhas.length);
  }
  console.log('\n>>> GRAVADO: ' + gravadas + ' municípios.');
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
