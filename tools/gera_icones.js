// ICONES DO LIMEDTEC - gera PNG de verdade, sem nenhuma dependencia.
//
// POR QUE NAO UM SVG: o manifest aceita SVG, mas o prompt de instalacao do Chrome e o icone da
// janela sao mais confiaveis com PNG 192/512, e o "maskable" (o recorte que o Android/Windows faz)
// so se comporta com bitmap. Como o projeto nao tem biblioteca de imagem e nao vou trazer uma pra
// desenhar uma letra, o PNG e escrito na mao: IHDR + IDAT (deflate do zlib nativo) + IEND.
//
// ISTO E PLACEHOLDER. O Lemuel manda a logo definitiva depois; o que importa aqui e a forma do
// arquivo estar certa pra troca ser so substituir o PNG.
//   node tools/gera_icones.js
'use strict';
const fs = require('fs');
const zlib = require('zlib');

// --- PNG minimo -------------------------------------------------------------------------------
const CRCT = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c; } return t; })();
const crc32 = buf => { let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRCT[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0; };
const chunk = (tipo, dados) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8 bits, RGBA
  const linhas = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    linhas[y * (w * 4 + 1)] = 0;                                        // filtro "none"
    rgba.copy(linhas, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(linhas, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// --- o desenho --------------------------------------------------------------------------------
const FUNDO = [0xF5, 0xF9, 0xFC];    // --bg do TEMA CLARO da FPMED
const CIANO = [0x2C, 0xA9, 0xE0];    // azul FPMED (--destaque)
const CLARO = [0x17, 0x3A, 0x5E];    // azul-escuro FPMED, pro degrade da letra

// desenha com supersampling 4x: sem isso a diagonal do canto arredondado e a serifa da letra saem
// serrilhadas em 192px, e icone serrilhado num instalador e a primeira coisa que parece amadora.
function desenha(N, safe) {
  const S = 4, W = N * S;
  const buf = Buffer.alloc(N * N * 4);
  const raio = W * 0.22;
  // a letra L: haste vertical + pe horizontal, dentro da area segura
  const m = W * (safe ? 0.30 : 0.24);              // margem (maskable = letra menor)
  const alt = W - 2 * m, esp = alt * 0.20;
  const lx = W / 2 - alt * 0.30, ly = m;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let ac = [0, 0, 0, 0];
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const px = x * S + sx + 0.5, py = y * S + sy + 0.5;
        // fundo com cantos arredondados (maskable e quadrado cheio: o SO e que recorta)
        let dentro = true;
        if (!safe) {
          const cx = Math.min(Math.max(px, raio), W - raio), cy = Math.min(Math.max(py, raio), W - raio);
          dentro = ((px - cx) ** 2 + (py - cy) ** 2) <= raio * raio;
        }
        if (!dentro) { ac[3] += 0; continue; }
        const haste = px >= lx && px < lx + esp && py >= ly && py < ly + alt;
        const pe = py >= ly + alt - esp && py < ly + alt && px >= lx && px < lx + alt * 0.62;
        let cor = FUNDO;
        if (haste || pe) { const t = py / W; cor = [
          Math.round(CLARO[0] + (CIANO[0] - CLARO[0]) * t),
          Math.round(CLARO[1] + (CIANO[1] - CLARO[1]) * t),
          Math.round(CLARO[2] + (CIANO[2] - CLARO[2]) * t)]; }
        ac[0] += cor[0]; ac[1] += cor[1]; ac[2] += cor[2]; ac[3] += 255;
      }
      const n = S * S, i = (y * N + x) * 4;
      const a = ac[3] / n;
      buf[i] = a ? Math.round(ac[0] / (ac[3] / 255)) : 0;
      buf[i + 1] = a ? Math.round(ac[1] / (ac[3] / 255)) : 0;
      buf[i + 2] = a ? Math.round(ac[2] / (ac[3] / 255)) : 0;
      buf[i + 3] = Math.round(a);
    }
  }
  return png(N, N, buf);
}

try { fs.mkdirSync('C:/fpmed/icones', { recursive: true }); } catch (e) {}
const saida = [
  ['C:/fpmed/icones/limedtec-192.png', desenha(192, false)],
  ['C:/fpmed/icones/limedtec-512.png', desenha(512, false)],
  ['C:/fpmed/icones/limedtec-512-maskable.png', desenha(512, true)],
];
saida.forEach(([p, b]) => { fs.writeFileSync(p, b); console.log('  ' + p + '  ' + b.length + ' bytes'); });
console.log('\n>>> PLACEHOLDER. Trocar pela logo do Lemuel = substituir estes 3 arquivos.');

