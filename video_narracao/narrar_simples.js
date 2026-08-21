// Narracao SEM DOWNLOAD DE FERRAMENTA - usa so o Node que ja esta no PC.
// Voz do Google Translate (pt-BR). Rode: GERAR_SIMPLES.bat
const fs = require("fs");
const path = require("path");
const https = require("https");

const falas = JSON.parse(fs.readFileSync(path.join(__dirname, "falas.json"), "utf8"));
const outDir = path.join(__dirname, "narracao");
fs.mkdirSync(outDir, { recursive: true });

function synthGoogle(texto) {
  const url = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=pt-BR&q=" +
    encodeURIComponent(texto);
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, res => {
      if (res.statusCode !== 200) { reject(new Error("HTTP " + res.statusCode)); res.resume(); return; }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(new Error("timeout")); });
  });
}

(async () => {
  for (let i = 0; i < falas.length; i++) {
    const nome = "cena" + String(i + 1).padStart(2, "0");
    const alvo = path.join(outDir, nome + ".mp3");
    if (fs.existsSync(alvo) && fs.statSync(alvo).size > 1000) { console.log(nome + ": ja existe"); continue; }
    let ok = false;
    for (let t = 1; t <= 3 && !ok; t++) {
      try {
        const buf = await synthGoogle(falas[i]);
        if (buf.length < 1000) throw new Error("audio vazio (" + buf.length + " bytes)");
        fs.writeFileSync(alvo, buf);
        console.log(nome + ": OK (" + buf.length + " bytes)");
        ok = true;
      } catch (e) {
        console.log(nome + ": tentativa " + t + " falhou -> " + (e.message || String(e)));
        await new Promise(r => setTimeout(r, 1500 * t));
      }
    }
    if (!ok) { console.error("\nFALHOU em " + nome + ". Rode de novo - continua de onde parou."); process.exitCode = 1; return; }
  }
  console.log("\nNARRACAO COMPLETA: " + falas.length + " arquivos na pasta narracao");
})();
