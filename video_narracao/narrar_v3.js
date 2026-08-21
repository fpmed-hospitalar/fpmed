// v3 - voz neural Microsoft via @andresaya/edge-tts (corrige o erro 403/Connect Error)
// Rodar em C:\fpmed\video_narracao:  npm install @andresaya/edge-tts  &&  node narrar_v3.js
const fs = require("fs");
const path = require("path");
const { EdgeTTS } = require("@andresaya/edge-tts");

const falas = JSON.parse(fs.readFileSync(path.join(__dirname, "falas.json"), "utf8"));
const outDir = path.join(__dirname, "narracao_v3");
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  for (let i = 0; i < falas.length; i++) {
    const nome = "cena" + String(i + 1).padStart(2, "0");
    const alvo = path.join(outDir, nome + ".mp3");
    if (fs.existsSync(alvo) && fs.statSync(alvo).size > 1000) { console.log(nome + ": ja existe"); continue; }
    let ok = false;
    for (let t = 1; t <= 3 && !ok; t++) {
      try {
        const tts = new EdgeTTS();
        await tts.synthesize(falas[i], "pt-BR-AntonioNeural", { rate: "+6%", pitch: "0Hz", volume: "+0%" });
        await tts.toFile(path.join(outDir, nome)); // grava nome.mp3
        if (!fs.existsSync(alvo) || fs.statSync(alvo).size < 1000) throw new Error("arquivo pequeno/ausente");
        console.log(nome + ": OK (" + fs.statSync(alvo).size + " bytes)");
        ok = true;
      } catch (e) {
        console.log(nome + ": tentativa " + t + " -> " + ((e && e.message) || String(e)));
        await new Promise(r => setTimeout(r, 2000 * t));
      }
    }
    if (!ok) { console.error("FALHOU " + nome); process.exitCode = 1; return; }
  }
  console.log("VOZ V3 COMPLETA: " + falas.length + " mp3 em narracao_v3");
})();
