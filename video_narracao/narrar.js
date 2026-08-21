// Narracao do video LIMEDTEC - v2
// 1) tenta voz neural Microsoft (msedge-tts, voz Antonio)
// 2) se falhar, cai para a voz do Google Translate (sem dependencia)
const fs = require("fs");
const path = require("path");
const https = require("https");

const falas = JSON.parse(fs.readFileSync(path.join(__dirname, "falas.json"), "utf8"));
const outDir = path.join(__dirname, "narracao");
fs.mkdirSync(outDir, { recursive: true });

function logErro(prefixo, e) {
  const msg = (e && (e.message || e.msg)) ? (e.message || e.msg) : String(e);
  console.log(prefixo + " -> " + msg);
  if (e && e.stack) console.log("   " + String(e.stack).split("\n")[1] || "");
}

async function synthEdge(texto) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
  const tts = new MsEdgeTTS();
  await tts.setMetadata("pt-BR-AntonioNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const r = await tts.toStream(texto);
  const stream = r && r.audioStream ? r.audioStream : r; // versoes diferentes
  return await new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", c => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    setTimeout(() => reject(new Error("timeout 30s")), 30000);
  });
}

function synthGoogle(texto) {
  const url = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=pt-BR&q=" +
    encodeURIComponent(texto);
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, res => {
      if (res.statusCode !== 200) { reject(new Error("HTTP " + res.statusCode)); res.resume(); return; }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

async function main() {
  let usouGoogle = false;
  for (let i = 0; i < falas.length; i++) {
    const nome = "cena" + String(i + 1).padStart(2, "0");
    const alvo = path.join(outDir, nome + ".mp3");
    if (fs.existsSync(alvo) && fs.statSync(alvo).size > 1000) { console.log(nome + ": ja existe"); continue; }
    let buf = null;
    for (let t = 1; t <= 2 && !buf; t++) {
      try { buf = await synthEdge(falas[i]); if (buf.length < 1000) { buf = null; throw new Error("audio vazio"); } }
      catch (e) { logErro(nome + ": voz Microsoft tentativa " + t, e); await new Promise(r => setTimeout(r, 1500)); }
    }
    if (!buf) {
      try {
        buf = await synthGoogle(falas[i]);
        if (buf.length < 1000) throw new Error("audio vazio");
        usouGoogle = true;
        console.log(nome + ": OK pela voz Google (" + buf.length + " bytes)");
      } catch (e) { logErro(nome + ": voz Google tambem falhou", e); process.exitCode = 1; return; }
    } else {
      console.log(nome + ": OK pela voz Microsoft (" + buf.length + " bytes)");
    }
    fs.writeFileSync(alvo, buf);
  }
  console.log("\nNARRACAO COMPLETA: " + falas.length + " arquivos em " + outDir);
  if (usouGoogle) console.log("(algumas falas sairam na voz Google - feminina padrao)");
}
main().catch(e => { logErro("ERRO GERAL", e); process.exitCode = 1; });
